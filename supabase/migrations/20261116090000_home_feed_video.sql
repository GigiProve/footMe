-- ============================================================
-- HOM-03 — Feed Video: dati
--
-- COSA MANCAVA
--
-- Il Feed (HOME-01) e il Post social standard (HOM-02) sanno mostrare un media
-- ma il server non classifica né descrive correttamente video e Articoli. Il
-- task HOM-03 (§2, §7, §39, §64–§71, §84, §110–§114) chiede:
--
--   1. Classificazione. `footme_feed_item_type` decideva dal solo formato del
--      contenuto: ogni video di chiunque finiva in item_type 'video' (il
--      renderer editoriale), e ogni contenuto Media/Creator "foto" finiva in
--      'post'. Per HOM-03 un video di Società o di tifosi è un normale Post
--      con un video (§2, §7); è "video editoriale" solo un video del
--      Media/Creator; il resto del Media/Creator è un Articolo (§39).
--   2. Il payload dell'Articolo e del video editoriale era quello legacy: un
--      solo thumbnail, nessun contatore, nessun is_liked, nessuna capability,
--      nessun media[]. Servono per usare la stessa riga azioni del Post (§52).
--   3. Il "Mi piace" non esiste sui contenuti del Media/Creator
--      (`media_profile_posts`): nessuna tabella, quindi `set_content_like` non
--      può scriverlo.
--   4. `content_post_media` non sa dire "caricato, non ancora elaborato"
--      (§64), non porta varianti di streaming né sottotitoli (§71, §84) e il
--      payload non espone created_at.
--   5. Il client non ha modo di sapere che un video in elaborazione è
--      diventato pronto senza ricaricare il Feed (§64, §114).
--   6. Il dettaglio contenuto legacy (/content/[type]/[id]) non riceve il
--      payload del Feed e non può mostrare contatori né Mi piace.
--
-- DECISIONI DI LUIGI (2026-11-12) CHE QUESTA MIGRAZIONE REALIZZA
--
--   * Video social = Post. club_media, fan_media, fan_tribuna e profile_post con
--     video sono item_type 'post'. 'video' resta solo per media_profile con
--     video; media_profile senza video è 'article'. club_media lungo (>= 400
--     caratteri) senza video resta 'article' (§89).
--   * Like reale su Articoli e video editoriali: nuova tabella
--     `media_profile_post_likes`, `set_content_like` esteso a 'media_profile'.
--   * Processing: il client interroga con backoff solo i media visibili in
--     elaborazione, con una RPC leggera.
--
-- PERCHÉ QUESTA SOLUZIONE
--
--   * UNA regola per ciascuna cosa, non una copia per ciascun chiamante.
--       - item_type: `footme_feed_item_type(content_type, content_format)`. La
--         versione a un argomento non può esprimere la regola e viene rimossa:
--         lasciarla vorrebbe dire due risposte diverse alla stessa domanda.
--       - leggibilità nel Feed: `footme_feed_readable_items` (era il blocco
--         `base` di footme_post_payloads). La usano il payload, il poll dei
--         media e lo stato interazioni: un contenuto nascosto, programmato o di
--         un autore bloccato non esce da nessuno dei tre.
--       - elemento di media[]: `footme_media_json`. Il Feed e il poll producono
--         byte per byte lo stesso formato, così il client può sostituire il
--         media di un item in cache senza ricostruire la pagina.
--       - contatori e capabilities: restano in `footme_post_payloads`;
--         `fetch_content_interaction_state` li legge da lì invece di
--         ricalcolarli, quindi il dettaglio non può divergere dal Feed.
--   * La vista `feed_content_index` NON cambia: la sua colonna content_format
--     descrive il media ('video', 'foto', 'articolo', 'post'), non il
--     renderer. La classificazione si decide dove serve, nella funzione.
--   * Il trigger di allineamento dei media legacy (HOM-02 §7) azzerava
--     thumbnail e durata della posizione 0 a ogni update del padre anche per le
--     sorgenti che quelle colonne non le hanno (media_profile: nessuna delle
--     due; fan_*: la durata). Per il video editoriale significava perdere la
--     miniatura e la durata scritte da un compositore o da una pipeline alla
--     prima modifica del titolo. Ora conserva ciò che la sorgente non possiede
--     finché l'url non cambia.
--
-- COSA NON FA (dichiarato, non dimenticato)
--
--   * `media_tribuna` (dibattiti e sondaggi della redazione) resta item_type
--     'post', senza media (non ha un visual) e senza Mi piace (can_like false:
--     non esiste una tabella di like e non è oggetto di HOM-03).
--   * Nessuna pipeline di transcodifica né di sottotitoli: `variants`,
--     `captions` e lo stato 'uploaded' sono solo il modello. Nessuna riga
--     esistente viene riscritta.
--   * Nessuna miniatura per i video editoriali già esistenti: media_profile_posts
--     non ha una colonna miniatura, quindi `media[].thumbnail_url` e
--     `duration_seconds` sono null finché qualcuno non li scrive su
--     content_post_media (il proprietario può, la RLS lo consente). La colonna
--     legacy `thumbnail_url` del Feed continua a valere cover_url anche quando
--     è un video: il client deve leggere la miniatura da media[].
--   * Il poll non aggiorna contatori né stato Like: solo media[].
--   * La ricerca CER-05 (`media_content_index`) non viene toccata.
--   * Il Salva degli Articoli/video editoriali usa la tabella che già esiste
--     (saved_media_profile_posts): nessun Saved nuovo.
--
-- PRIVACY / PERMESSI
--
--   * Tutto è `to authenticated`. anon: revoke esplicito sulla nuova tabella e
--     `revoke execute ... from anon` su ogni funzione (revoke from public non
--     chiude anon perché Supabase concede execute ad anon direttamente).
--   * Le funzioni definer (poll, stato interazioni, leggibilità, payload)
--     controllano auth.uid() o sono interne senza execute ai client.
--   * `created_by_profile_id` e ogni "acted_by" non compaiono mai nel payload
--     (§111).
--   * Blocchi: la policy di scrittura dei like media_profile chiede
--     is_profile_blocked_with_viewer (definer, solo booleano per il chiamante).
--
-- ROLLOUT
--
--   * Additiva e riesponibile. Le righe di `content_post_media` esistenti
--     prendono variants/captions '[]'. Un client precedente continua a
--     funzionare: le chiavi dei Post sono invariate, per Articoli e video
--     editoriali le chiavi legacy restano e se ne aggiungono altre.
--   * Per article/video il `data` del Feed guadagna chiavi (media, contatori,
--     capabilities, summary, ...) e non ne perde: `body` non c'è, perché prima
--     non c'era. L'unico cambiamento di tipo è dei video di Società e tifosi, che
--     passano da item_type 'video' a 'post'; un client che non lo conosce
--     mostra il Post HOM-02, che sa già rendere un video.
--   * Schema drift: nessuna colonna di recruiting_ads toccata.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — media_profile_post_likes (stessa forma e stessa RLS di
-- profile_post_likes, con in più il blocco)
--
-- Contano solo i like di post pubblicati e non programmati. La policy di
-- scrittura chiede anche che la redazione non sia bloccata in nessuna
-- direzione: le policy di media_profile_posts non conoscono i blocchi, quindi
-- senza questa riga un utente bloccato potrebbe mettere Mi piace a un
-- contenuto che il Feed gli nasconde. Togliere il like resta sempre possibile
-- al proprietario del like, anche se il post nel frattempo è stato nascosto.
-- ============================================================

create table if not exists public.media_profile_post_likes (
  post_id    uuid        not null references public.media_profile_posts(id) on delete cascade,
  profile_id uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, profile_id)
);

alter table public.media_profile_post_likes enable row level security;

revoke all on table public.media_profile_post_likes from anon;
grant select, insert, delete on table public.media_profile_post_likes to authenticated;

drop policy if exists "users read media profile post likes" on public.media_profile_post_likes;
create policy "users read media profile post likes"
on public.media_profile_post_likes
for select
to authenticated
using (
  exists (
    select 1 from public.media_profile_posts post
    where post.id = post_id
      and post.status = 'published'
      and post.published_at <= timezone('utc', now())
  )
);

drop policy if exists "users manage own media profile post likes" on public.media_profile_post_likes;
create policy "users manage own media profile post likes"
on public.media_profile_post_likes
for all
to authenticated
using (public.is_current_user(profile_id))
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1 from public.media_profile_posts post
    where post.id = post_id
      and post.status = 'published'
      and post.published_at <= timezone('utc', now())
      and not public.is_profile_blocked_with_viewer(post.media_profile_id)
  )
);


-- ============================================================
-- SEZIONE 2 — content_post_media: stato 'uploaded', variants, captions
--
-- Predisposizione (§71, §84), nessuna pipeline: il modello può già descrivere
-- un media caricato e non ancora elaborato, varianti di streaming e sottotitoli.
-- I due array sono validati da una funzione immutabile, perché un CHECK non può
-- contenere subquery e un array malformato romperebbe il parser del client.
-- ============================================================

alter table public.content_post_media
  drop constraint if exists content_post_media_state_check;

alter table public.content_post_media
  add constraint content_post_media_state_check
  check (processing_state in ('uploaded', 'ready', 'processing', 'failed'));

create or replace function public.content_post_media_array_valid(
  p_value jsonb,
  p_kind  text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_value is null or jsonb_typeof(p_value) <> 'array' then false
    when jsonb_array_length(p_value) > 20 then false
    else not exists (
      select 1
      from jsonb_array_elements(p_value) e
      where jsonb_typeof(e) <> 'object'
         or (e ->> 'url') is null
         or (e ->> 'url') !~ '^https://'
         or (p_kind = 'captions'
             and coalesce(e ->> 'kind', '') not in ('captions', 'subtitles', 'transcript'))
    )
  end;
$$;

-- Execute ad authenticated: NECESSARIO. Un CHECK valuta la funzione con i privilegi
-- di chi scrive la riga (il proprietario del media, via RLS), non del
-- proprietario della funzione: senza il grant ogni insert/update su
-- content_post_media fallisce con "permission denied for function". Provato:
-- revocandolo, 11 verifiche PGlite su 81 cadono. È pura (immutable, nessuna
-- lettura di tabelle) e non espone nulla.
revoke all on function public.content_post_media_array_valid(jsonb, text) from public;
revoke execute on function public.content_post_media_array_valid(jsonb, text) from anon;
grant execute on function public.content_post_media_array_valid(jsonb, text) to authenticated;

alter table public.content_post_media
  add column if not exists variants jsonb not null default '[]'::jsonb,
  add column if not exists captions jsonb not null default '[]'::jsonb;

alter table public.content_post_media
  drop constraint if exists content_post_media_variants_check;
alter table public.content_post_media
  add constraint content_post_media_variants_check
  check (public.content_post_media_array_valid(variants, 'variants'));

alter table public.content_post_media
  drop constraint if exists content_post_media_captions_check;
alter table public.content_post_media
  add constraint content_post_media_captions_check
  check (public.content_post_media_array_valid(captions, 'captions'));


-- ============================================================
-- SEZIONE 3 — footme_media_json: l'elemento di media[] in UN punto
--
-- Lo usano il payload del Feed (footme_post_payloads) e il poll dei media in
-- elaborazione (fetch_content_media_states): il client riceve lo stesso formato
-- da entrambi e può sostituire il media di un item senza ricostruire il Feed.
-- Interna: nessun ruolo client la esegue.
-- ============================================================

create or replace function public.footme_media_json(m public.content_post_media)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'media_id',         m.content_type || ':' || m.post_id::text || ':' || m.position::text,
    'media_type',       m.media_type,
    'position',         m.position,
    'url',              m.url,
    'thumbnail_url',    m.thumbnail_url,
    'width',            m.width,
    'height',           m.height,
    'duration_seconds', m.duration_seconds,
    'alt_text',         m.alt_text,
    'processing_state', m.processing_state,
    'availability',     case when m.url is null then 'unavailable' else 'available' end,
    'created_at',       m.created_at,
    'variants',         m.variants,
    'captions',         m.captions
  );
$$;

revoke all on function public.footme_media_json(public.content_post_media) from public;
revoke execute on function public.footme_media_json(public.content_post_media) from anon, authenticated;


-- ============================================================
-- SEZIONE 4 — content_post_sync_legacy_media: non azzerare ciò che la sorgente
-- non possiede
--
-- Riemessa dalla definizione più recente (20261114090000 §7). Cambia UN punto:
-- l'ON CONFLICT. Prima ogni update del padre riscriveva thumbnail e durata
-- della posizione 0 con quelli del padre; per media_profile (nessuna delle due
-- colonne), e per la durata di fan_tribuna e fan_media, significava azzerare
-- ciò che un compositore o una pipeline aveva scritto direttamente su
-- content_post_media: il video editoriale perdeva miniatura e durata alla
-- prima modifica del titolo. Ora la colonna che la sorgente non ha viene
-- conservata finché l'url non cambia (un url nuovo invalida miniatura e durata
-- vecchie, come già avveniva per dimensioni e alt). Con l'url nuovo tornano ai
-- default anche variants, captions e processing_state: appartengono al file
-- sostituito, non a quello nuovo.
-- ============================================================

create or replace function public.content_post_sync_legacy_media()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v        jsonb := to_jsonb(new);
  v_ct     text;
  v_url    text;
  v_type   text;
  v_thumb  text;
  v_dur    integer;
  -- HOM-03: quali colonne la SORGENTE possiede davvero. Quelle che non ha
  -- (thumbnail e durata di media_profile, durata di fan_*) possono essere
  -- scritte solo direttamente su content_post_media e il trigger non deve
  -- azzerarle a ogni update del padre.
  v_has_thumb boolean := false;
  v_has_dur   boolean := false;
begin
  case tg_table_name
    when 'club_media_posts' then
      v_ct := 'club_media';
      v_url := v ->> 'visual_url';
      v_type := v ->> 'visual_type';
      v_thumb := v ->> 'thumbnail_url';
      v_dur := nullif(v ->> 'video_duration_seconds', '')::integer;
      v_has_thumb := true;
      v_has_dur := true;
    when 'media_profile_posts' then
      v_ct := 'media_profile';
      v_url := v ->> 'cover_url';
      v_type := v ->> 'cover_type';
    when 'fan_tribuna_posts' then
      v_ct := 'fan_tribuna';
      v_url := v ->> 'media_url';
      v_type := v ->> 'media_type';
      v_thumb := v ->> 'thumbnail_url';
      v_has_thumb := true;
    when 'fan_media_posts' then
      v_ct := 'fan_media';
      v_url := v ->> 'visual_url';
      v_type := v ->> 'visual_type';
      v_thumb := v ->> 'thumbnail_url';
      v_has_thumb := true;
    else
      return new;
  end case;

  if coalesce(v_thumb, v_url) is null then
    delete from public.content_post_media m
    where m.content_type = v_ct and m.post_id = new.id and m.position = 0;
  else
    insert into public.content_post_media as m (
      content_type, post_id, position, media_type, url, thumbnail_url, duration_seconds
    ) values (
      v_ct, new.id, 0, coalesce(v_type, 'image'), v_url, v_thumb, v_dur
    )
    on conflict (content_type, post_id, position) do update
      set media_type       = excluded.media_type,
          url              = excluded.url,
          thumbnail_url    = case
                               when v_has_thumb then excluded.thumbnail_url
                               when m.url is distinct from excluded.url then null
                               else m.thumbnail_url
                             end,
          duration_seconds = case
                               when v_has_dur then excluded.duration_seconds
                               when m.url is distinct from excluded.url then null
                               else m.duration_seconds
                             end,
          -- Un visual nuovo ha dimensioni e alt nuovi: tenere quelli vecchi
          -- darebbe al Feed il rapporto sbagliato (spazio riservato errato, §40).
          width            = case when m.url is distinct from excluded.url then null else m.width end,
          height           = case when m.url is distinct from excluded.url then null else m.height end,
          alt_text         = case when m.url is distinct from excluded.url then null else m.alt_text end,
          -- HOM-03: un url nuovo è un FILE nuovo. Varianti di streaming e
          -- sottotitoli del file vecchio non gli appartengono (il client
          -- preferisce una variante a media.url: resterebbe in onda il video
          -- sostituito). Lo stato torna al default di una riga nuova ('ready',
          -- lo stesso del backfill): lo stato 'failed' o 'processing' del file
          -- vecchio non descrive quello nuovo, e una pipeline che lo elabora lo
          -- riporterà a 'processing'/'uploaded' scrivendo sul media.
          variants         = case when m.url is distinct from excluded.url then excluded.variants else m.variants end,
          captions         = case when m.url is distinct from excluded.url then excluded.captions else m.captions end,
          processing_state = case when m.url is distinct from excluded.url then excluded.processing_state else m.processing_state end;
  end if;

  return new;
end;
$$;

revoke all on function public.content_post_sync_legacy_media() from public;
revoke execute on function public.content_post_sync_legacy_media() from anon, authenticated;


-- ============================================================
-- SEZIONE 5 — footme_feed_item_type(content_type, content_format)
--
-- DECISIONE DI LUIGI (2026-11-12): un video di Società o di tifosi è un Post
-- (§2, §7); è "video editoriale" solo un contenuto Media/Creator con video;
-- ogni altro contenuto Media/Creator è un Articolo (§39). La vecchia funzione a
-- un argomento decideva dal solo formato e quindi mandava a 'video' ogni video,
-- di chiunque. Il formato non basta più: serve la sorgente. Una sola funzione,
-- la vecchia viene rimossa in fondo (restava una seconda risposta, diversa, alla
-- stessa domanda).
--
--   club_media / fan_media / fan_tribuna / profile_post con video   -> post
--   club_media 'articolo' (corpo >= 400 caratteri, senza video)      -> article
--   media_profile con video                                          -> video
--   media_profile senza video                                        -> article
--   media_tribuna (dibattiti e sondaggi)                             -> post
--   tutto il resto                                                   -> post
--
-- La colonna `content_format` della vista NON cambia: descrive il media
-- ('video', 'foto', ...), non il renderer. Per questo feed_content_index non
-- viene riemessa.
-- ============================================================

create or replace function public.footme_feed_item_type(
  p_content_type   text,
  p_content_format text
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_content_type = 'media_profile'
      then case when p_content_format = 'video' then 'video' else 'article' end
    when p_content_format = 'articolo' then 'article'
    else 'post'
  end;
$$;

revoke all on function public.footme_feed_item_type(text, text) from public;
revoke execute on function public.footme_feed_item_type(text, text) from anon;
grant execute on function public.footme_feed_item_type(text, text) to authenticated;


-- ============================================================
-- SEZIONE 6 — footme_feed_readable_items: la regola di leggibilità del Feed
--
-- Era il blocco `base` di footme_post_payloads. Ora serve a tre punti (payload,
-- poll dei media, stato interazioni): una sola definizione di "ciò che il Feed
-- mostrerebbe a questo viewer" — pubblicato (lo garantisce la vista), non
-- programmato, autore profilo non bloccato in nessuna direzione. Un contenuto
-- nascosto, programmato o di un autore bloccato non esce da nessuno dei tre.
--
-- Colonne OUT con prefisso r_: dentro i corpi che la chiamano si chiamano come
-- le colonne della vista e sarebbero ambigue. DEFINER perché la vista non è
-- leggibile dal client e user_blocks lo è solo dal bloccante; interna.
-- ============================================================

create or replace function public.footme_feed_readable_items(
  p_viewer        uuid,
  p_content_types text[],
  p_post_ids      uuid[]
)
returns table (
  r_content_type   text,
  r_post_id        uuid,
  r_content_format text,
  r_excerpt        text,
  r_body           text,
  r_publisher_type text,
  r_publisher_id   uuid,
  r_source_kind    text
)
language sql
stable
security definer
set search_path = public
as $$
  with keys as (
    select distinct k.content_type, k.post_id
    from unnest(p_content_types, p_post_ids) as k(content_type, post_id)
  ),
  blocked as (
    select ub.blocked_profile_id as profile_id
    from public.user_blocks ub
    where ub.blocker_profile_id = p_viewer
    union
    select ub.blocker_profile_id
    from public.user_blocks ub
    where ub.blocked_profile_id = p_viewer
  )
  select
    fci.content_type, fci.post_id, fci.content_format, fci.excerpt, fci.body,
    fci.publisher_type, fci.publisher_id, fci.source_kind
  from keys k
  join public.feed_content_index fci
    on fci.content_type = k.content_type and fci.post_id = k.post_id
  -- Predicati espliciti sugli array: il join con `unnest` da solo potrebbe non
  -- essere spinto dentro i sei rami della vista, che verrebbe scansionata
  -- intera per una pagina di 10 elementi.
  where fci.content_type = any(p_content_types)
    and fci.post_id = any(p_post_ids)
    and fci.published_at <= timezone('utc', now())
    and not (
      fci.publisher_type = 'profile'
      and exists (select 1 from blocked bl where bl.profile_id = fci.publisher_id)
    );
$$;

revoke all on function public.footme_feed_readable_items(uuid, text[], uuid[]) from public;
revoke execute on function public.footme_feed_readable_items(uuid, text[], uuid[]) from anon, authenticated;


-- ============================================================
-- SEZIONE 7 — footme_post_payloads: il payload esteso a Articolo e video
--
-- Riemessa dalla definizione più recente (20261114090000 §9). Cambia:
--   * `base` viene da footme_feed_readable_items (stessa regola, un punto);
--   * `media[]` viene da footme_media_json (+ created_at, variants, captions);
--   * i like di media_profile entrano in likes_agg; can_like vale anche per
--     media_profile (i commenti e il salvataggio c'erano già);
--   * `body` resta solo per item_type 'post'; Articoli e video editoriali
--     portano `summary` (testo breve, max 280) al suo posto.
-- Chiamata dalle RPC definer del Feed per post, articoli e video editoriali.
-- ============================================================

create or replace function public.footme_post_payloads(
  p_viewer        uuid,
  p_content_types text[],
  p_post_ids      uuid[]
)
returns table (
  r_content_type text,
  r_post_id      uuid,
  payload        jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with blocked as (
    select ub.blocked_profile_id as profile_id
    from public.user_blocks ub
    where ub.blocker_profile_id = p_viewer
    union
    select ub.blocker_profile_id
    from public.user_blocks ub
    where ub.blocked_profile_id = p_viewer
  ),

  -- Solo ciò che il Feed mostrerebbe: la regola vive in
  -- footme_feed_readable_items (pubblicato, non programmato, autore profilo non
  -- bloccato in nessuna direzione), la stessa che usano il poll dei media e lo
  -- stato interazioni.
  base as (
    select
      ri.r_content_type as content_type, ri.r_post_id as post_id,
      ri.r_content_format as content_format, ri.r_excerpt as excerpt,
      ri.r_body as body, ri.r_publisher_type as publisher_type,
      ri.r_publisher_id as publisher_id, ri.r_source_kind as source_kind
    from public.footme_feed_readable_items(p_viewer, p_content_types, p_post_ids) ri
  ),

  media_agg as (
    select
      m.content_type, m.post_id,
      jsonb_agg(public.footme_media_json(m) order by m.position) as media
    from public.content_post_media m
    join base b on b.content_type = m.content_type and b.post_id = m.post_id
    group by m.content_type, m.post_id
  ),

  likes_agg as (
    select
      l.content_type, l.post_id,
      count(*)::int as n,
      coalesce(bool_or(l.profile_id = p_viewer), false) as liked
    from (
      select 'club_media'::text as content_type, x.post_id, x.profile_id
      from public.club_media_likes x
      join base b on b.content_type = 'club_media' and b.post_id = x.post_id
      union all
      select 'fan_media', x.post_id, x.profile_id
      from public.fan_media_likes x
      join base b on b.content_type = 'fan_media' and b.post_id = x.post_id
      union all
      select 'profile_post', x.post_id, x.profile_id
      from public.profile_post_likes x
      join base b on b.content_type = 'profile_post' and b.post_id = x.post_id
      union all
      select 'media_profile', x.post_id, x.profile_id
      from public.media_profile_post_likes x
      join base b on b.content_type = 'media_profile' and b.post_id = x.post_id
    ) l
    group by l.content_type, l.post_id
  ),

  comments_agg as (
    select c.content_type, c.post_id, count(*)::int as n
    from (
      select 'club_media'::text as content_type, x.post_id
      from public.club_media_comments x
      join base b on b.content_type = 'club_media' and b.post_id = x.post_id
      union all
      select 'media_profile', x.post_id
      from public.media_profile_post_comments x
      join base b on b.content_type = 'media_profile' and b.post_id = x.post_id
      union all
      select 'media_tribuna', x.post_id
      from public.media_tribuna_comments x
      join base b on b.content_type = 'media_tribuna' and b.post_id = x.post_id
      union all
      select 'fan_tribuna', x.post_id
      from public.fan_tribuna_comments x
      join base b on b.content_type = 'fan_tribuna' and b.post_id = x.post_id
      union all
      select 'fan_media', x.post_id
      from public.fan_media_comments x
      join base b on b.content_type = 'fan_media' and b.post_id = x.post_id
    ) c
    group by c.content_type, c.post_id
  ),

  -- Solo tag attivi (§20). fan_tribuna conserva un display_name proprio, usato
  -- come ripiego se l'identità non si risolve più.
  tags_raw as (
    select 'club_media'::text as content_type, t.post_id,
           t.target_type, coalesce(t.target_id, t.profile_id) as target_id,
           null::text as fallback_name, t.created_at
    from public.club_media_tagged_profiles t
    join base b on b.content_type = 'club_media' and b.post_id = t.post_id
    where t.status = 'active'
    union all
    select 'fan_tribuna', t.post_id,
           t.target_type, coalesce(t.target_id, t.player_profile_id),
           t.display_name, t.created_at
    from public.fan_tribuna_tagged_players t
    join base b on b.content_type = 'fan_tribuna' and b.post_id = t.post_id
    where t.status = 'active'
    union all
    select 'media_profile', t.post_id, t.target_type, t.target_id, null::text, t.created_at
    from public.media_profile_post_tagged_targets t
    join base b on b.content_type = 'media_profile' and b.post_id = t.post_id
    where t.status = 'active'
    union all
    select 'profile_post', t.post_id, t.target_type, t.target_id, null::text, t.created_at
    from public.profile_post_tagged_targets t
    join base b on b.content_type = 'profile_post' and b.post_id = t.post_id
    where t.status = 'active'
  ),
  tags_resolved as (
    select
      tr.content_type, tr.post_id, tr.created_at, tr.target_id,
      jsonb_build_object(
        'identity_id',   tr.target_id,
        'identity_type', tr.target_type,
        'display_name',  coalesce(
                           case tr.target_type
                             when 'profile' then pr.full_name
                             when 'club'    then cl.name
                             when 'team'    then ct.name
                           end,
                           tr.fallback_name
                         ),
        'avatar_url',    case tr.target_type
                           when 'profile' then pr.avatar_url
                           when 'club'    then cl.logo_url
                           when 'team'    then coalesce(ct.logo_url, tcl.logo_url)
                         end
      ) as tag,
      coalesce(
        case tr.target_type
          when 'profile' then pr.full_name
          when 'club'    then cl.name
          when 'team'    then ct.name
        end,
        tr.fallback_name
      ) as resolved_name
    from tags_raw tr
    left join public.profiles pr   on tr.target_type = 'profile' and pr.id = tr.target_id
    left join public.clubs cl      on tr.target_type = 'club'    and cl.id = tr.target_id
    left join public.club_teams ct on tr.target_type = 'team'    and ct.id = tr.target_id
    left join public.clubs tcl     on tr.target_type = 'team'    and tcl.id = ct.club_id
    where not (
      tr.target_type = 'profile'
      and exists (select 1 from blocked bl where bl.profile_id = tr.target_id)
    )
  ),
  tags_agg as (
    select
      t.content_type, t.post_id,
      jsonb_agg(t.tag order by t.created_at, t.target_id) as tagged
    from tags_resolved t
    where t.resolved_name is not null
    group by t.content_type, t.post_id
  ),

  -- Identità che pubblica (§80) e dati grezzi per la seconda riga (§9).
  -- Società → 'society'; contenuti di un profilo Media → 'media'; ogni altro
  -- caso (persone, tifosi) → 'person'. La corrente appartenenza di una persona
  -- usa la stessa derivazione di fetch_home_suggested_profiles.
  authored as (
    select
      b.content_type, b.post_id, b.body, b.excerpt, b.source_kind,
      public.footme_feed_item_type(b.content_type, b.content_format) as item_type,
      case
        when b.publisher_type = 'club'                                then 'society'
        when b.content_type in ('media_profile', 'media_tribuna')     then 'media'
        else 'person'
      end as identity_type,
      pr.role::text                as person_role,
      pl.primary_position::text    as person_position,
      cur.club_name,
      cur.team_label,
      cl.category                  as club_category,
      coalesce(
        case when b.publisher_type = 'club' then cl.owner_profile_id = p_viewer end,
        case when b.publisher_type = 'profile' then b.publisher_id = p_viewer end,
        false
      ) as is_own
    from base b
    left join public.clubs cl
      on b.publisher_type = 'club' and cl.id = b.publisher_id
    left join public.profiles pr
      on b.publisher_type = 'profile' and pr.id = b.publisher_id
    left join public.player_profiles pl
      on pl.profile_id = pr.id and pr.role::text = 'player'
    left join lateral (
      select c.name as club_name, ct.name as team_label
      from public.club_members cm
      join public.clubs c on c.id = cm.club_id
      left join public.club_teams ct on ct.id = cm.team_id
      where cm.profile_id = pr.id
        and cm.status = 'active'
        and cm.is_current = true
      order by cm.created_at desc
      limit 1
    ) cur on true
  )

  select
    a.content_type as r_content_type,
    a.post_id      as r_post_id,
    jsonb_build_object(
      'author_identity_type', a.identity_type,
      'author_meta', jsonb_build_object(
        'role',             case when a.identity_type = 'person'  then a.person_role end,
        'primary_position', case when a.identity_type = 'person'  then a.person_position end,
        'club_name',        case when a.identity_type = 'person'  then a.club_name end,
        'team_label',       case when a.identity_type = 'person'  then a.team_label end,
        'club_category',    case when a.identity_type = 'society' then a.club_category end,
        'media_kind',       case when a.identity_type = 'media'   then a.source_kind end
      ),
      'media',        coalesce(ma.media, '[]'::jsonb),
      'mentions',     coalesce(ex.mentions, '[]'::jsonb),
      'tagged',       coalesce(ta.tagged, '[]'::jsonb),
      'link_preview', ex.link_preview,
      'likes_count',    coalesce(la.n, 0),
      'comments_count', coalesce(ca.n, 0),
      'is_liked',       coalesce(la.liked, false),
      'capabilities', jsonb_build_object(
        'can_like',          a.content_type in ('club_media', 'fan_media', 'profile_post', 'media_profile'),
        'can_comment',       a.content_type <> 'profile_post',
        'can_share',         true,
        'can_save',          a.content_type <> 'profile_post',
        'can_report',        not a.is_own,
        'can_edit',          a.is_own,
        'can_delete',        a.is_own,
        'can_view_insights', false
      ),
      'status', 'published'
    )
    -- HOM-03: il Post porta il testo intero; Articolo e video editoriale no
    -- (un articolo può pesare migliaia di caratteri e la preview non lo usa) e
    -- portano invece summary: l'excerpt della vista, al massimo 280 caratteri.
    || case
         when a.item_type = 'post'
           then jsonb_build_object('body', coalesce(a.body, ''))
         else jsonb_build_object('summary', left(nullif(trim(a.excerpt), ''), 280))
       end
    as payload
  from authored a
  left join media_agg ma    on ma.content_type = a.content_type and ma.post_id = a.post_id
  left join likes_agg la    on la.content_type = a.content_type and la.post_id = a.post_id
  left join comments_agg ca on ca.content_type = a.content_type and ca.post_id = a.post_id
  left join tags_agg ta     on ta.content_type = a.content_type and ta.post_id = a.post_id
  left join public.content_post_extras ex
    on ex.content_type = a.content_type and ex.post_id = a.post_id;
$$;

-- Funzione interna: la chiamano solo le RPC definer del Feed. Nessun ruolo
-- client la esegue direttamente (accetta un viewer arbitrario).
revoke all on function public.footme_post_payloads(uuid, text[], uuid[]) from public;
revoke execute on function public.footme_post_payloads(uuid, text[], uuid[]) from anon, authenticated;


-- ============================================================
-- SEZIONE 8 — fetch_home_feed_page: classificazione e payload editoriale
--
-- Riemessa per intero dalla definizione più recente, quella di
-- 20261114090000 §10 (nessuna migrazione successiva la tocca: verificato).
-- Firma, colonne, ranking, cursore, blocco autori e diversificazione sono
-- invariati. Cambiano SOLO:
--   1. item_type = footme_feed_item_type(content_type, content_format);
--   2. il payload di footme_post_payloads viene costruito e fuso in `data`
--      anche per item_type 'article' e 'video', non solo per 'post'.
-- ============================================================

create or replace function public.fetch_home_feed_page(
  p_tab                 text        default 'per_te',
  p_as_of               timestamptz default null,
  p_cursor_bucket       smallint    default null,
  p_cursor_published_at timestamptz default null,
  p_cursor_uid          text        default null,
  p_page_index          int         default 0,
  p_limit               int         default 10
)
returns table (
  item_uid                 text,
  item_type                text,
  rank_position            int,
  rank_bucket              smallint,
  layout_hint              text,
  component_version        smallint,
  title                    text,
  excerpt                  text,
  thumbnail_url            text,
  published_at             timestamptz,
  author_kind              text,
  author_id                uuid,
  author_name              text,
  author_avatar_url        text,
  author_source_kind       text,
  author_is_verified       boolean,
  is_seen                  boolean,
  is_saved                 boolean,
  is_following_author      boolean,
  suggestion_reason_key    text,
  suggestion_reason_label  text,
  nav_kind                 text,
  nav_params               jsonb,
  data                     jsonb,
  as_of                    timestamptz,
  next_cursor_bucket       smallint,
  next_cursor_published_at timestamptz,
  next_cursor_uid          text,
  is_last_page             boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid                 uuid := auth.uid();
  v_as_of               timestamptz;
  v_limit               int := least(greatest(coalesce(p_limit, 10), 1), 30);
  v_page                int := greatest(coalesce(p_page_index, 0), 0);
  v_region              text;
  v_role                text;
  v_pref_active         boolean := false;
  v_wants_clubs         boolean := false;
  v_wants_positions     boolean := false;
  v_wants_local_media   boolean := false;
  v_include_positions   boolean;
  v_target_role         text;
  v_primary_position    public.player_position;
  v_secondary_positions public.player_position[] := '{}';
  v_preferred_regions   text[] := '{}';
  v_popular_threshold   int := public.footme_feed_popularity_threshold();
  v_recent_count        int := 0;
  v_use_floor           boolean := true;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_tab is null or p_tab not in ('per_te', 'seguiti') then
    raise exception 'Tab del Feed non supportata: %', coalesce(p_tab, 'null');
  end if;

  if (p_cursor_uid is null) <> (p_cursor_published_at is null)
     or (p_cursor_uid is null) <> (p_cursor_bucket is null) then
    raise exception
      'Cursore del Feed incompleto: bucket, published_at e uid vanno forniti insieme';
  end if;

  if p_cursor_uid is not null and p_as_of is null then
    raise exception
      'Il cursore del Feed richiede p_as_of: passare l''as_of restituito dalla prima pagina';
  end if;

  v_as_of := coalesce(p_as_of, timezone('utc', now()));

  select p.region, p.role::text into v_region, v_role
  from public.profiles p
  where p.id = v_uid;

  select
    fp.applies_until is not null and fp.applies_until > v_as_of,
    fp.wants_clubs,
    fp.wants_positions,
    fp.wants_local_media
  into v_pref_active, v_wants_clubs, v_wants_positions, v_wants_local_media
  from public.feed_preferences fp
  where fp.profile_id = v_uid;

  v_pref_active := coalesce(v_pref_active, false);

  v_target_role := case
    when v_role = 'player' then 'player'
    when v_role = 'coach'  then 'coach'
    when v_role = 'staff'  then 'staff'
    else null
  end;

  select pp.primary_position, coalesce(pp.secondary_positions, '{}')
  into v_primary_position, v_secondary_positions
  from public.player_profiles pp
  where pp.profile_id = v_uid;

  select coalesce(
    (select pp.transfer_regions from public.player_profiles pp where pp.profile_id = v_uid),
    (select cp.preferred_regions from public.coach_profiles cp where cp.profile_id = v_uid),
    (select sp.preferred_regions from public.staff_profiles sp where sp.profile_id = v_uid),
    '{}'::text[]
  ) into v_preferred_regions;

  v_include_positions :=
    coalesce(v_role, '') in ('player', 'coach', 'staff', 'agent', 'director', 'club_admin')
    or (v_pref_active and coalesce(v_wants_positions, false));

  -- PUNTO A: il floor a 180 giorni si applica solo se c'è abbastanza materiale
  -- recente da riempire una pagina. Su un archivio poco recente cade, così la
  -- Home mostra contenuti vecchi invece di niente. Sonda limitata: costa una
  -- pagina. Deterministica per un dato as_of, quindi il cursore resta valido.
  if p_tab = 'per_te' then
    select count(*) into v_recent_count
    from (
      select 1
      from public.feed_content_index fci
      where fci.published_at <= v_as_of
        and fci.published_at >= v_as_of - interval '180 days'
      limit v_limit
    ) probe;

    v_use_floor := v_recent_count >= v_limit;
  end if;

  return query
  with followed_clubs as (
    select f.club_id from public.club_follows f where f.profile_id = v_uid
  ),
  followed_profiles as (
    select f.followed_profile_id as profile_id
    from public.profile_follows f
    where f.follower_profile_id = v_uid
  ),
  blocked_profiles as (
    select ub.blocked_profile_id as profile_id
    from public.user_blocks ub
    where ub.blocker_profile_id = v_uid
    union
    select ub.blocker_profile_id
    from public.user_blocks ub
    where ub.blocked_profile_id = v_uid
  ),
  saved_content as (
    select 'club_media'::text as content_type, s.post_id
      from public.saved_club_media s           where s.profile_id = v_uid
    union all
    select 'media_profile', s.post_id
      from public.saved_media_profile_posts s  where s.profile_id = v_uid
    union all
    select 'media_tribuna', s.post_id
      from public.saved_media_tribuna s        where s.profile_id = v_uid
    union all
    select 'fan_tribuna', s.post_id
      from public.saved_fan_tribuna s          where s.profile_id = v_uid
    union all
    select 'fan_media', s.post_id
      from public.saved_fan_media s            where s.profile_id = v_uid
  ),
  saved_positions as (
    select sa.ad_id from public.saved_ads sa where sa.profile_id = v_uid
  ),

  -- ── candidati: contenuti ────────────────────────────────────────
  content_candidates as (
    select
      fci.content_type || ':' || fci.post_id::text        as item_uid,
      public.footme_feed_item_type(fci.content_type, fci.content_format) as item_type,
      case
        when p_tab = 'seguiti' then 0::smallint
        else public.footme_feed_rank_bucket(
          aff.affinity,
          coalesce(eng.engagement_count, 0) >= v_popular_threshold,
          fci.published_at,
          v_as_of
        )
      end                                                as rank_bucket,
      fci.published_at                                   as published_at,
      fci.publisher_id                                   as author_key,
      fci.title                                          as title,
      fci.excerpt                                        as excerpt,
      fci.thumbnail_url                                  as thumbnail_url,
      fci.publisher_type                                 as author_kind,
      fci.publisher_id                                   as author_id,
      fci.publisher_name                                 as author_name,
      fci.publisher_avatar_url                           as author_avatar_url,
      fci.source_kind                                    as author_source_kind,
      coalesce(fci.publisher_is_verified, false)         as author_is_verified,
      (sv.post_id is not null)                           as is_saved,
      aff.is_following                                   as is_following_author,
      -- Un contenuto senza altri segnali ma molto commentato ha comunque un
      -- motivo da mostrare: è il "popolare" richiesto.
      coalesce(
        aff.reason_key,
        case
          when coalesce(eng.engagement_count, 0) >= v_popular_threshold
            then 'popular_now'
          else null
        end
      )                                                  as reason_key,
      null::text                                         as reason_entity_name,
      fci.content_type                                   as content_type,
      fci.post_id                                        as post_id,
      fci.kind                                           as kind,
      fci.content_format                                 as content_format,
      fci.media_type                                     as media_type,
      fci.duration_seconds                               as duration_seconds,
      null::uuid                                         as ad_id,
      null::uuid                                         as club_id,
      null::uuid                                         as team_id,
      null::text                                         as team_name,
      null::text                                         as team_type,
      null::text                                         as role_required,
      null::text                                         as category,
      null::text                                         as loc_city,
      null::text                                         as loc_province,
      null::text                                         as loc_region,
      null::text                                         as target_role,
      null::boolean                                      as is_secondary_match
    from public.feed_content_index fci
    left join saved_content sv
      on sv.content_type = fci.content_type and sv.post_id = fci.post_id
    left join public.media_content_engagement eng
      on eng.content_type = fci.content_type and eng.post_id = fci.post_id
    cross join lateral (
      select
        f.is_following,
        greatest(
          case when f.is_following then 2 else 0 end,
          case
            when v_pref_active and (
              (coalesce(v_wants_clubs, false) and fci.publisher_type = 'club')
              or (
                coalesce(v_wants_local_media, false)
                and fci.source_kind in ('testata', 'giornalista', 'creator', 'pagina')
                and v_region is not null
                and fci.publisher_region = v_region
              )
            ) then 1 else 0
          end,
          case
            when v_region is not null and fci.publisher_region = v_region then 1 else 0
          end
        ) as affinity,
        case
          when f.is_following and fci.publisher_type = 'club'    then 'followed_club_publisher'
          when f.is_following and fci.publisher_type = 'profile'  then 'followed_profile_publisher'
          when v_pref_active and (
            (coalesce(v_wants_clubs, false) and fci.publisher_type = 'club')
            or (
              coalesce(v_wants_local_media, false)
              and fci.source_kind in ('testata', 'giornalista', 'creator', 'pagina')
              and v_region is not null
              and fci.publisher_region = v_region
            )
          ) then 'preferred_source'
          when v_region is not null and fci.publisher_region = v_region then 'same_region'
          else null
        end as reason_key
      from (
        select (
          case
            when fci.publisher_type = 'club'
              then exists (select 1 from followed_clubs fc where fc.club_id = fci.publisher_id)
            else exists (select 1 from followed_profiles fp where fp.profile_id = fci.publisher_id)
          end
        ) as is_following
      ) f
    ) aff
    where
      not (fci.publisher_type = 'profile' and fci.publisher_id = v_uid)
      and (
        fci.publisher_type <> 'profile'
        or not exists (select 1 from blocked_profiles bp where bp.profile_id = fci.publisher_id)
      )
      and (p_tab = 'per_te' or aff.is_following)
      and (
        p_tab = 'seguiti'
        or not v_use_floor
        or fci.published_at >= v_as_of - interval '180 days'
      )
      and fci.published_at <= v_as_of
  ),

  -- ── candidati: posizioni aperte ─────────────────────────────────
  position_candidates as (
    select
      'recruiting_ad:' || ra.id::text                    as item_uid,
      'suggested_position'::text                         as item_type,
      case
        when p_tab = 'seguiti' then 0::smallint
        else public.footme_feed_rank_bucket(pa.affinity, false, ra.published_at, v_as_of)
      end                                                as rank_bucket,
      ra.published_at                                    as published_at,
      ra.club_id                                         as author_key,
      ra.title                                           as title,
      null::text                                         as excerpt,
      null::text                                         as thumbnail_url,
      'club'::text                                       as author_kind,
      ra.club_id                                         as author_id,
      c.name                                             as author_name,
      c.logo_url                                         as author_avatar_url,
      'ufficiale'::text                                  as author_source_kind,
      (c.verification_status = 'verified')               as author_is_verified,
      (sp.ad_id is not null)                             as is_saved,
      pa.is_following                                    as is_following_author,
      pa.reason_key                                      as reason_key,
      c.name                                             as reason_entity_name,
      null::text                                         as content_type,
      null::uuid                                         as post_id,
      null::text                                         as kind,
      null::text                                         as content_format,
      null::text                                         as media_type,
      null::int                                          as duration_seconds,
      ra.id                                              as ad_id,
      ra.club_id                                         as club_id,
      ra.team_id                                         as team_id,
      ct.name                                            as team_name,
      ct.team_type                                       as team_type,
      ra.role_required::text                             as role_required,
      coalesce(ra.category, ct.category, c.category)     as category,
      coalesce(ct.city, c.city)                          as loc_city,
      coalesce(ct.province, c.province)                  as loc_province,
      coalesce(ra.region, ct.region, c.region)           as loc_region,
      ra.target_role::text                               as target_role,
      pa.is_secondary_match                              as is_secondary_match
    from public.recruiting_ads ra
    join public.clubs c            on c.id = ra.club_id
    left join public.club_teams ct on ct.id = ra.team_id
    left join saved_positions sp   on sp.ad_id = ra.id
    cross join lateral (
      select
        m.is_following,
        m.is_secondary_match,
        m.role_match,
        m.region_match,
        greatest(
          case when m.is_following then 2 else 0 end,
          case when m.region_match or m.role_match then 1 else 0 end
        ) as affinity,
        case
          when m.is_following then 'followed_club_position'
          when m.role_match   then 'open_position_match'
          when m.region_match then 'same_region'
          else null
        end as reason_key
      from (
        select
          exists (select 1 from followed_clubs fc where fc.club_id = ra.club_id) as is_following,
          (
            v_target_role is not null
            and ra.target_role::text = v_target_role
            and v_primary_position is not null
            and ra.role_required = any(v_secondary_positions)
            and ra.role_required <> v_primary_position
          ) as is_secondary_match,
          (
            v_target_role is not null
            and ra.target_role::text = v_target_role
            and (
              v_primary_position is null
              or ra.role_required = v_primary_position
              or ra.role_required = any(v_secondary_positions)
            )
          ) as role_match,
          (
            coalesce(ra.region, ct.region, c.region) is not null
            and (
              coalesce(ra.region, ct.region, c.region) = v_region
              or coalesce(ra.region, ct.region, c.region) = any(v_preferred_regions)
            )
          ) as region_match
      ) m
    ) pa
    where v_include_positions
      and ra.status = 'published'
      and ra.published_at is not null
      and ra.published_at <= v_as_of
      and (ra.deadline is null or ra.deadline >= current_date)
      and (
        case
          when p_tab = 'seguiti' then pa.is_following
          else pa.is_following or pa.role_match or pa.region_match
        end
      )
      and (
        p_tab = 'seguiti'
        or not v_use_floor
        or ra.published_at >= v_as_of - interval '180 days'
      )
  ),

  candidates as (
    select * from content_candidates
    union all
    select * from position_candidates
  ),

  filtered as (
    select cd.*
    from candidates cd
    where p_cursor_uid is null
       or cd.rank_bucket < p_cursor_bucket
       or (cd.rank_bucket = p_cursor_bucket and cd.published_at < p_cursor_published_at)
       or (
         cd.rank_bucket = p_cursor_bucket
         and cd.published_at = p_cursor_published_at
         and cd.item_uid > p_cursor_uid
       )
  ),
  ordered as (
    select
      f.*,
      row_number() over (
        order by f.rank_bucket desc, f.published_at desc, f.item_uid asc
      ) as base_ord
    from filtered f
    order by f.rank_bucket desc, f.published_at desc, f.item_uid asc
    limit v_limit + 1
  ),
  window_rows as (
    select o.* from ordered o where o.base_ord <= v_limit
  ),
  boundary as (
    select w.rank_bucket, w.published_at, w.item_uid
    from window_rows w
    order by w.base_ord desc
    limit 1
  ),

  diversified as (
    select
      w.*,
      w.base_ord
      + (row_number() over (partition by w.author_key order by w.base_ord) - 1) * 3
      + case
          when w.item_type = 'suggested_position'
            then (row_number() over (partition by w.item_type order by w.base_ord) - 1) * 2
          else 0
        end as final_ord
    from window_rows w
  ),
  emitted as (
    select d.*, row_number() over (order by d.final_ord, d.base_ord) as emit_ord
    from diversified d
  ),

  slot_rows as (
    select sp.slot_offset, sp.item_type
    from public.footme_feed_slot_plan(p_tab, v_page, v_limit) sp
    where sp.slot_offset < (select count(*) from emitted)
  ),

  -- HOM-02/HOM-03: il payload completo di Post, Articoli e video editoriali
  -- della pagina è costruito in batch, una volta, sulle sole chiavi emesse.
  -- Gli array escono dalla stessa aggregazione con lo stesso ordine, quindi
  -- restano allineati.
  post_keys as (
    select
      array_agg(e.content_type order by e.item_uid) as content_types,
      array_agg(e.post_id      order by e.item_uid) as post_ids
    from emitted e
    where e.item_type in ('post', 'article', 'video')
  ),
  post_payloads as (
    select pl.r_content_type, pl.r_post_id, pl.payload
    from post_keys pk
    cross join lateral public.footme_post_payloads(v_uid, pk.content_types, pk.post_ids) pl
  ),

  feed_rows as (
    select
      e.item_uid, e.item_type, e.rank_bucket, e.published_at,
      e.title, e.excerpt, e.thumbnail_url,
      e.author_kind, e.author_id, e.author_name, e.author_avatar_url,
      e.author_source_kind, e.author_is_verified, e.is_saved, e.is_following_author,
      e.reason_key, e.reason_entity_name,
      e.content_type, e.post_id, e.kind, e.content_format,
      e.media_type, e.duration_seconds,
      e.ad_id, e.club_id, e.team_id, e.team_name, e.team_type,
      e.role_required, e.category, e.loc_city, e.loc_province, e.loc_region,
      e.target_role, e.is_secondary_match,
      e.emit_ord::numeric as sort_key
    from emitted e

    union all

    select
      'module:' || s.item_type || ':' || v_page::text, s.item_type,
      0::smallint, null::timestamptz,
      null::text, null::text, null::text,
      null::text, null::uuid, null::text, null::text,
      null::text, false, false, false,
      'not_followed_yet'::text, null::text,
      null::text, null::uuid, null::text, null::text,
      null::text, null::int,
      null::uuid, null::uuid, null::uuid, null::text, null::text,
      null::text, null::text, null::text, null::text, null::text,
      null::text, null::boolean,
      s.slot_offset + 0.5
    from slot_rows s
  )

  select
    fr.item_uid,
    fr.item_type,
    (v_page * v_limit + row_number() over (order by fr.sort_key))::int as rank_position,
    fr.rank_bucket,
    public.footme_feed_layout_hint(
      fr.item_type,
      fr.thumbnail_url is not null,
      length(coalesce(fr.excerpt, ''))
    ) as layout_hint,
    public.footme_feed_component_version(fr.item_type) as component_version,
    fr.title,
    case
      when fr.excerpt is null       then null
      when fr.item_type = 'post'    then left(fr.excerpt, 280)
      else                               left(fr.excerpt, 200)
    end as excerpt,
    fr.thumbnail_url,
    fr.published_at,
    fr.author_kind,
    fr.author_id,
    fr.author_name,
    fr.author_avatar_url,
    fr.author_source_kind,
    fr.author_is_verified,
    false as is_seen,
    fr.is_saved,
    fr.is_following_author,
    fr.reason_key as suggestion_reason_key,
    public.footme_feed_reason_label(fr.reason_key, fr.reason_entity_name) as suggestion_reason_label,
    case
      when fr.item_type = 'suggested_position'                      then 'position'
      when fr.item_type in ('suggested_profiles', 'suggested_clubs') then null
      else 'content'
    end as nav_kind,
    case
      when fr.item_type = 'suggested_position'
        then jsonb_build_object('ad_id', fr.ad_id)
      when fr.item_type in ('suggested_profiles', 'suggested_clubs')
        then null
      else jsonb_build_object('content_type', fr.content_type, 'post_id', fr.post_id)
    end as nav_params,
    case
      when fr.item_type = 'suggested_position' then jsonb_build_object(
        'ad_id',              fr.ad_id,
        'club_id',            fr.club_id,
        'team_id',            fr.team_id,
        'club_name',          fr.author_name,
        'club_logo_url',      fr.author_avatar_url,
        'team_name',          fr.team_name,
        'team_type',          fr.team_type,
        'role_required',      fr.role_required,
        'category',           fr.category,
        'city',               fr.loc_city,
        'province',           fr.loc_province,
        'region',             fr.loc_region,
        'target_role',        fr.target_role,
        'is_secondary_match', coalesce(fr.is_secondary_match, false)
      )
      when fr.item_type in ('suggested_profiles', 'suggested_clubs') then jsonb_build_object(
        'module_key',   fr.item_type,
        'module_limit', 6
      )
      else jsonb_build_object(
        'content_type',     fr.content_type,
        'post_id',          fr.post_id,
        'kind',             fr.kind,
        'kind_label',       public.footme_content_kind_label(fr.content_type, fr.kind),
        'content_format',   fr.content_format,
        'media_type',       fr.media_type,
        'duration_seconds', fr.duration_seconds,
        'is_truncated',     length(coalesce(fr.excerpt, ''))
                              > (case when fr.item_type = 'post' then 280 else 200 end)
      )
      -- HOM-02/HOM-03: Post, Articoli e video editoriali portano le chiavi del
      -- Post social standard; le posizioni e i moduli discovery no.
      || case
           when fr.item_type in ('post', 'article', 'video')
             then coalesce(ppl.payload, '{}'::jsonb)
           else '{}'::jsonb
         end
    end as data,
    v_as_of as as_of,
    case
      when (select count(*) from ordered) > v_limit
        then (select b.rank_bucket from boundary b)
      else null
    end as next_cursor_bucket,
    case
      when (select count(*) from ordered) > v_limit
        then (select b.published_at from boundary b)
      else null
    end as next_cursor_published_at,
    case
      when (select count(*) from ordered) > v_limit
        then (select b.item_uid from boundary b)
      else null
    end as next_cursor_uid,
    ((select count(*) from ordered) <= v_limit) as is_last_page
  from feed_rows fr
  left join post_payloads ppl
    on fr.item_type in ('post', 'article', 'video')
   and ppl.r_content_type = fr.content_type
   and ppl.r_post_id = fr.post_id
  order by fr.sort_key;
end;
$$;

revoke all on function public.fetch_home_feed_page(text, timestamptz, smallint, timestamptz, text, int, int) from public;
revoke execute on function public.fetch_home_feed_page(text, timestamptz, smallint, timestamptz, text, int, int) from anon;
grant execute on function public.fetch_home_feed_page(text, timestamptz, smallint, timestamptz, text, int, int) to authenticated;

-- Il Feed era l'unico chiamante della versione a un argomento.
drop function if exists public.footme_feed_item_type(text);


-- ============================================================
-- SEZIONE 9 — set_content_like: + media_profile
--
-- Riemessa dalla definizione più recente (20261114090000 §11); aggiunge solo il
-- ramo media_profile. Resta SECURITY INVOKER e un SET idempotente.
-- ============================================================

create or replace function public.set_content_like(
  p_content_type text,
  p_post_id      uuid,
  p_liked        boolean
)
returns table (
  likes_count integer,
  is_liked    boolean
)
language plpgsql
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_liked is null then
    raise exception 'Stato del Mi piace mancante';
  end if;

  if p_content_type = 'club_media' then
    if not exists (
      select 1 from public.club_media_posts p
      where p.id = p_post_id and p.status = 'published'
    ) then
      raise exception 'Contenuto non disponibile';
    end if;

    if p_liked then
      insert into public.club_media_likes as l (post_id, profile_id)
      values (p_post_id, v_uid)
      on conflict (post_id, profile_id) do nothing;
    else
      delete from public.club_media_likes l
      where l.post_id = p_post_id and l.profile_id = v_uid;
    end if;

    select count(*)::integer into v_count
    from public.club_media_likes l where l.post_id = p_post_id;

  elsif p_content_type = 'fan_media' then
    if not exists (
      select 1 from public.fan_media_posts p
      where p.id = p_post_id and p.status = 'published'
        and not public.is_profile_blocked_with_viewer(p.profile_id)
    ) then
      raise exception 'Contenuto non disponibile';
    end if;

    if p_liked then
      insert into public.fan_media_likes as l (post_id, profile_id)
      values (p_post_id, v_uid)
      on conflict (post_id, profile_id) do nothing;
    else
      delete from public.fan_media_likes l
      where l.post_id = p_post_id and l.profile_id = v_uid;
    end if;

    select count(*)::integer into v_count
    from public.fan_media_likes l where l.post_id = p_post_id;

  elsif p_content_type = 'profile_post' then
    -- La lettura passa già dalla policy di profile_posts (pubblicato, non
    -- programmato, autore non bloccato).
    if not exists (
      select 1 from public.profile_posts p
      where p.id = p_post_id and p.status = 'published'
    ) then
      raise exception 'Contenuto non disponibile';
    end if;

    if p_liked then
      insert into public.profile_post_likes as l (post_id, profile_id)
      values (p_post_id, v_uid)
      on conflict (post_id, profile_id) do nothing;
    else
      delete from public.profile_post_likes l
      where l.post_id = p_post_id and l.profile_id = v_uid;
    end if;

    select count(*)::integer into v_count
    from public.profile_post_likes l where l.post_id = p_post_id;

  elsif p_content_type = 'media_profile' then
    -- HOM-03: contenuto editoriale. Leggibile come nel Feed: pubblicato, non
    -- programmato, redazione non bloccata in nessuna direzione. Le policy
    -- di media_profile_posts non conoscono i blocchi: li controlla qui.
    if not exists (
      select 1 from public.media_profile_posts p
      where p.id = p_post_id
        and p.status = 'published'
        and p.published_at <= timezone('utc', now())
        and not public.is_profile_blocked_with_viewer(p.media_profile_id)
    ) then
      raise exception 'Contenuto non disponibile';
    end if;

    if p_liked then
      insert into public.media_profile_post_likes as l (post_id, profile_id)
      values (p_post_id, v_uid)
      on conflict (post_id, profile_id) do nothing;
    else
      delete from public.media_profile_post_likes l
      where l.post_id = p_post_id and l.profile_id = v_uid;
    end if;

    select count(*)::integer into v_count
    from public.media_profile_post_likes l where l.post_id = p_post_id;

  else
    raise exception 'Tipo di contenuto non supportato per il Mi piace: %',
      coalesce(p_content_type, 'null');
  end if;

  return query select v_count, p_liked;
end;
$$;

revoke all on function public.set_content_like(text, uuid, boolean) from public;
revoke execute on function public.set_content_like(text, uuid, boolean) from anon;
grant execute on function public.set_content_like(text, uuid, boolean) to authenticated;


-- ============================================================
-- SEZIONE 10 — fetch_content_media_states: il poll leggero dei media
--
-- Il Feed mostra "Video in elaborazione" (§64) e deve accorgersi, senza
-- ricostruire la pagina, che il video è diventato pronto. Il client chiede solo
-- le coppie (content_type, post_id) dei media in elaborazione visibili e
-- riceve lo STESSO `media[]` del Feed (footme_media_json).
--
--   * Leggibilità: la stessa regola del Feed (footme_feed_readable_items). Un
--     contenuto nascosto, programmato o di autore bloccato non restituisce
--     righe: dal poll non si ricava nulla che il Feed non mostrerebbe.
--   * Limite: al massimo 20 coppie per chiamata; oltre, ERRORE (non
--     troncamento: un poll che ignora in silenzio le coppie in più lascia il
--     client convinto di aver aggiornato tutto). Array di lunghezza diversa o
--     nulli: errore.
--   * DEFINER invece di INVOKER: la regola di leggibilità passa dalla vista del
--     Feed e da user_blocks, che il client non può leggere. Controlla auth.uid()
--     e non accetta un viewer in ingresso.
--   * Colonne OUT che si chiamano come colonne di tabella: ogni riferimento nel
--     corpo è qualificato.
-- ============================================================

create or replace function public.fetch_content_media_states(
  p_content_types text[],
  p_post_ids      uuid[]
)
returns table (
  content_type text,
  post_id      uuid,
  media        jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n   integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_n := coalesce(array_length(p_post_ids, 1), 0);

  if p_content_types is null
     or p_post_ids is null
     or coalesce(array_length(p_content_types, 1), 0) <> v_n then
    raise exception 'Coppie contenuto/post non valide';
  end if;

  if v_n > 20 then
    raise exception 'Al massimo 20 contenuti per richiesta';
  end if;

  return query
  select
    ri.r_content_type,
    ri.r_post_id,
    coalesce(
      (
        select jsonb_agg(public.footme_media_json(m) order by m.position)
        from public.content_post_media m
        where m.content_type = ri.r_content_type
          and m.post_id = ri.r_post_id
      ),
      '[]'::jsonb
    )
  from public.footme_feed_readable_items(v_uid, p_content_types, p_post_ids) ri;
end;
$$;

revoke all on function public.fetch_content_media_states(text[], uuid[]) from public;
revoke execute on function public.fetch_content_media_states(text[], uuid[]) from anon;
grant execute on function public.fetch_content_media_states(text[], uuid[]) to authenticated;


-- ============================================================
-- SEZIONE 11 — fetch_content_interaction_state: contatori e Like del dettaglio
--
-- Il dettaglio contenuto legacy (/content/[type]/[id]) non riceve il payload
-- del Feed e deve mostrare lo stesso Mi piace. Non ricalcola nulla: legge i
-- numeri da footme_post_payloads, l'unico posto che li costruisce, quindi
-- contatori e can_like non possono divergere dal Feed. Nessuna riga se il
-- contenuto non è leggibile per il chiamante (stessa regola del Feed).
-- DEFINER: footme_post_payloads è interna.
-- ============================================================

create or replace function public.fetch_content_interaction_state(
  p_content_type text,
  p_post_id      uuid
)
returns table (
  likes_count    integer,
  comments_count integer,
  is_liked       boolean,
  can_like       boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    coalesce((pl.payload ->> 'likes_count')::integer, 0),
    coalesce((pl.payload ->> 'comments_count')::integer, 0),
    coalesce((pl.payload ->> 'is_liked')::boolean, false),
    coalesce((pl.payload -> 'capabilities' ->> 'can_like')::boolean, false)
  from public.footme_post_payloads(
    v_uid, array[p_content_type], array[p_post_id]
  ) pl;
end;
$$;

revoke all on function public.fetch_content_interaction_state(text, uuid) from public;
revoke execute on function public.fetch_content_interaction_state(text, uuid) from anon;
grant execute on function public.fetch_content_interaction_state(text, uuid) to authenticated;
