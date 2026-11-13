-- ============================================================
-- HOM-06.1 — Creazione e modifica Post: dati
--
-- COSA MANCAVA
--
-- Il Feed sa mostrare un Post (HOM-02), un video (HOM-03), la gestione
-- (HOM-04) e le statistiche (HOM-05), ma nessuno sa ancora *crearlo* o
-- *modificarlo* in modo sicuro. Il task HOM-06.1 (§1, §12–§13, §30, §42–§44,
-- §61–§62, §64–§65, §69, §73–§80, §95, §112–§118, §143–§173, §207–§211) chiede
-- un solo composer per tutti i Post e un backend che rivaliduti tutto al
-- publish. Mancano:
--
--   1. Un posto dove una Società o un Media/Creator possa scrivere un Post.
--      Le tre tabelle di Post esistenti sono profile_posts (persone),
--      club_media_posts (Società) e media_profile_posts (Media). Le ultime due
--      hanno un `kind` chiuso (highlights/interview/... e article/news/media) e
--      title/category/author_name obbligatori: un Post di Società non ha un
--      titolo, un Post di un Media non ha categoria né un autore editoriale.
--   2. La classificazione. feed_content_index e media_content_index trattano
--      ogni club_media non-video con body >= 400 caratteri come 'articolo' e
--      ogni media_profile come 'articolo' (salvo kind 'media'): un Post lungo di
--      una Società uscirebbe nel Feed come Articolo (§1 della task HOM-06.1: un
--      solo formato Post, composto da testo, link, IMAGE e VIDEO).
--   3. Il contesto del composer (§14–§20, §61): quali identità l'utente può
--      usare per pubblicare e quali sono i limiti, da UNA sola source of truth.
--   4. Il publish: validazione completa lato server (§30, §207–§211), idempotenza
--      (§118, §176), media dello storage, mention strutturate con range UTF-16,
--      tag deduplicati, link con metadata persistiti (§80), tutto in una
--      transazione.
--   5. Lettura per la modifica e update versionato (§143–§166): stessa riga,
--      stesso content_id (le statistiche HOM-05 restano, §165), autore e media
--      immutabili (§147–§149), concorrenza ottimistica su updated_at (§160–§161),
--      `edited_at` (§166).
--   6. Una tabella di snapshot dei metadata dei link (§75–§80) che la Edge
--      Function `link-preview` riempie con il service role: il client non scrive
--      mai metadata, `publish_post` li legge per id.
--
-- DECISIONI DI LUIGI (2026-11-13) CHE QUESTA MIGRAZIONE REALIZZA
--
--   * Estendere le tabelle esistenti, nessun modello parallelo: PERSON →
--     profile_posts; SOCIETY → club_media_posts con kind 'post'; MEDIA →
--     media_profile_posts con kind 'post'. Per il kind 'post' titolo, categoria
--     e autore editoriale non sono richiesti; il Feed e la ricerca lo
--     classificano SEMPRE come Post, mai come Articolo per lunghezza.
--   * Video: al publish un video accettato nasce 'ready' (non esiste un worker di
--     transcodifica). Il modello resta pronto: lo stato iniziale è un parametro
--     (`post_composer.video_initial_state`), quando il worker esisterà basterà
--     portarlo a 'uploaded' senza toccare la RPC.
--   * Link preview: Edge Function `link-preview` + tabella di snapshot;
--     `publish_post` referenzia lo snapshot per id e non si fida mai di metadata
--     del client.
--   * Identità: PERSON = player, coach, staff, agent, director e fan (il fan si
--     apre a profile_posts come PERSON); il ruolo media scrive solo come MEDIA;
--     club_admin non ha identità PERSON (la Società scrive come Società).
--     SOCIETY = club di cui l'utente è owner o ha la chiave `content_create`
--     (DAS-REV-14, già nel catalogo): `content_create` vale can_publish_post,
--     nessuna chiave nuova. MEDIA: nessun modello di delega.
--
-- PERCHÉ QUESTA SOLUZIONE
--
--   * UNA regola per ciascuna cosa.
--       - identità che possono pubblicare: `footme_composer_identities()`. La
--         usano il contesto del composer e `publish_post`: il client non
--         decide mai chi può scrivere, e un'identità che sparisce tra apertura
--         e publish viene rifiutata (§30, §169).
--       - limiti: `app_policy_settings` `post_composer.*`, letti da
--         `footme_post_limits()`. Il client riceve i limiti dal contesto, il
--         server li applica con la stessa funzione (§61).
--       - capability di modifica: `footme_content_rights` (HOM-04), già usata dal
--         Feed per can_edit. Non esiste un secondo sistema di permessi (§168).
--       - validazione di body/mention/tag/link: quattro funzioni interne usate
--         identiche da publish_post e update_post, così creare e modificare non
--         possono divergere (§144, §155).
--   * Il trigger di allineamento dei media legacy (HOM-02 §7, riemesso da HOM-03
--     §4) CANCELLA la posizione 0 di content_post_media a ogni update del padre
--     quando le colonne visual legacy sono null. Un Post kind 'post' ha i media
--     SOLO su content_post_media (fino a 10, non uno): senza correzione la prima
--     modifica del testo cancellerebbe la prima foto. Il trigger ora esce subito
--     per il kind 'post'.
--   * Mention: l'offset è UTF-16 come nel client (JS `string.slice`), mentre un
--     text Postgres è indicizzato per code point. `footme_utf16_offsets()`
--     costruisce una sola volta la mappa unità→carattere del body (un emoji
--     fuori dal piano base vale 2 unità); un range che cade nel mezzo di una
--     coppia surrogata non ha corrispondenza e viene rifiutato. Il server
--     verifica `slice(start, end) = '@' || display_name`, che il range non si
--     sovrapponga a un altro e che l'identità esista e non sia bloccata.
--   * «Mention senza altro testo» non rende pubblicabile (§13): il testo
--     significativo si valuta sul body PRIVATO dei range delle mention.
--   * Link: il target validato (https, dominio, niente userinfo/porta, non un IP)
--     è persistito in `content_post_extras.link_target` indipendentemente dal
--     testo (§211) e dalla preview. La preview visuale (`link_preview`, la forma
--     che il Feed già legge) si scrive solo se il Post non ha media (§95) e solo
--     se esiste uno snapshot che corrisponde all'URL: il client non invia mai
--     title/description/immagine. L'edit ricalcola da zero: URL cambiato →
--     vecchia preview invalidata (§156), URL tolto → niente preview stale (§157),
--     preview rimossa dall'utente → resta il solo link (§93).
--   * Idempotenza: ricevuta (attore, operation_key) con advisory lock, lo stesso
--     schema delle altre creazioni (gruppi, eventi). Il secondo invio con la
--     stessa chiave restituisce il Post già creato con replayed = true (§118).
--   * Audit: `content_management_audit` (HOM-04) estesa con create/edit; scrive
--     l'attore reale (§25 di HOM-04), mai esposto al client.
--
-- COSA NON FA (dichiarato, non dimenticato)
--
--   * Nessuna transcodifica né lettura dei metadata del file: durata e
--     dimensioni arrivano dal client e il server ne verifica solo i limiti.
--     Esistenza e MIME dell'oggetto si verificano su storage.objects.
--   * Il Post di un Media non ha autore editoriale: `author_name` ripete il nome
--     del Media perché la colonna è NOT NULL e le letture legacy lo mostrano.
--   * `title` e `category` dei kind 'post' sono stringa vuota, non null: restano
--     NOT NULL (nessun lettore legacy tipizzato `string` si rompe) e i CHECK
--     «non vuoto» valgono per tutti gli altri kind.
--   * I Post kind 'post' di Società/Media entrano in ogni lettura che filtra
--     solo per status e non per kind (viste Feed e ricerca, già corrette qui;
--     elenchi legacy della Società: da verificare lato client).
--   * Gli ambienti: l'URL pubblico dello storage non è deducibile dal database.
--     `post_composer.media_public_base_url` è seminata col progetto remoto
--     (formato di getPublicUrl) e si sovrascrive per ambiente. `footme_profile_media_url`
--     ripiega sull'inferenza da un avatar solo se la chiave è stata cancellata.
--   * Un fan non guadagna una policy RLS di insert diretto su profile_posts:
--     pubblica solo da publish_post (definer, con i controlli qui sotto).
--
-- PRIVACY / PERMESSI
--
--   * Ogni RPC client: SECURITY DEFINER con search_path fisso, `revoke from
--     public` + `revoke execute from anon`, grant ad authenticated, controllo
--     auth.uid() nel corpo. Le funzioni interne non hanno execute per i client.
--   * Le tabelle nuove hanno RLS attiva senza policy e senza grant ai client:
--     le scrivono solo le RPC e la Edge Function (service role, che non viene mai
--     usato dal client mobile).
--   * `created_by_profile_id` non compare in nessun payload.
--   * Un'identità non autorizzata, o non più autorizzata al momento del publish,
--     risponde post_permission_denied (42501) senza rivelare altro.
--
-- CODICI ERRORE (nel message, come composer-types.ts)
--   post_permission_denied 42501 · post_edit_denied 42501 ·
--   post_version_conflict 40001 · post_operation_conflict 40001 ·
--   post_not_found P0002 ·
--   post_invalid_content / post_media_limit / post_invalid_media /
--   post_invalid_mention / post_invalid_tag / post_invalid_link 22023.
--   `detail` porta il motivo preciso per i log, mai per l'utente.
--
-- ROLLOUT
--
--   * Additiva. Colonne nuove nullable (edited_at, link_target). I CHECK dei kind
--     e di title/category si ricostruiscono (i vecchi vengono cercati per
--     definizione, non solo per nome: schema drift). Le tre viste/funzioni
--     riemesse (feed_content_index, media_content_index,
--     content_post_sync_legacy_media, footme_feed_item_type) hanno le colonne e
--     le firme invariate.
--   * Nessuna riga esistente cambia classificazione: il nuovo ramo scatta solo
--     per kind = 'post'.
--   * Da fare fuori dal database: deploy della Edge Function `link-preview`
--     (supabase/functions/link-preview). Per un ambiente diverso dal remoto,
--     update di `post_composer.media_public_base_url` in app_policy_settings.
--   * Schema drift: nessuna colonna di recruiting_ads toccata.
--   * Non applicata al remoto: verificare con `npm run supabase:migration:list`.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — schema: kind 'post', edited_at, link_target
-- ============================================================

-- 1a. club_media_posts.kind accetta 'post'. Il CHECK vecchio si cerca per
-- definizione (contiene `kind` e 'highlights'), non per nome.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.club_media_posts'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ~ '\mkind\M'
      and pg_get_constraintdef(con.oid) ~ 'highlights'
  loop
    execute format('alter table public.club_media_posts drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.club_media_posts
  add constraint club_media_posts_kind_check
  check (kind in ('highlights', 'interview', 'market', 'statement', 'training', 'event', 'post'));

-- 1b. media_profile_posts.kind accetta 'post'; titolo e categoria non sono
-- richiesti per il Post (restano NOT NULL: il Post li salva vuoti).
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.media_profile_posts'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ~ '\mkind\M'
      and pg_get_constraintdef(con.oid) ~ 'article'
      and pg_get_constraintdef(con.oid) !~ 'cover'
  loop
    execute format('alter table public.media_profile_posts drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.media_profile_posts
  add constraint media_profile_posts_kind_check
  check (kind in ('article', 'news', 'media', 'post'));

alter table public.media_profile_posts
  drop constraint if exists media_profile_posts_title_check;
alter table public.media_profile_posts
  add constraint media_profile_posts_title_check
  check (kind = 'post' or length(trim(title)) > 0);

alter table public.media_profile_posts
  drop constraint if exists media_profile_posts_category_check;
alter table public.media_profile_posts
  add constraint media_profile_posts_category_check
  check (kind = 'post' or length(trim(category)) > 0);

-- 1c. edited_at (§166). Predisposto, il rendering «Modificato» non è
-- obbligatorio in questa task.
alter table public.profile_posts      add column if not exists edited_at timestamptz;
alter table public.club_media_posts   add column if not exists edited_at timestamptz;
alter table public.media_profile_posts add column if not exists edited_at timestamptz;

-- RLS filtra righe, non colonne: un proprietario che fa UPDATE diretto potrebbe
-- scrivere un edited_at arbitrario. Il trigger ignora il valore scritto da un
-- client e lo imposta lui stesso quando il testo di un contenuto pubblicato
-- cambia; update_post (definer) lo imposta esplicitamente anche quando cambiano
-- solo tag o link.
create or replace function public.content_edited_at_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.edited_at := old.edited_at;
  end if;

  if new.body is distinct from old.body and old.status = 'published' then
    new.edited_at := clock_timestamp();
  end if;

  return new;
end;
$$;

revoke all on function public.content_edited_at_guard() from public;
revoke execute on function public.content_edited_at_guard() from anon, authenticated;

drop trigger if exists content_edited_at_guard on public.profile_posts;
create trigger content_edited_at_guard
before update on public.profile_posts
for each row execute function public.content_edited_at_guard();

drop trigger if exists content_edited_at_guard on public.club_media_posts;
create trigger content_edited_at_guard
before update on public.club_media_posts
for each row execute function public.content_edited_at_guard();

drop trigger if exists content_edited_at_guard on public.media_profile_posts;
create trigger content_edited_at_guard
before update on public.media_profile_posts
for each row execute function public.content_edited_at_guard();

-- 1d. content_post_extras.link_target (§211): il target del link validato dal
-- server, indipendente dal testo e dalla preview. {url, snapshot_id}. `url` è
-- l'URL come l'utente l'ha scritto (serve a riprecaricare la modifica);
-- l'URL da aprire è quello della preview (final_url dello snapshot).
alter table public.content_post_extras
  add column if not exists link_target jsonb;

alter table public.content_post_extras
  drop constraint if exists content_post_extras_link_target_check;
alter table public.content_post_extras
  add constraint content_post_extras_link_target_check check (
    link_target is null
    or (
      jsonb_typeof(link_target) = 'object'
      and (link_target ->> 'url') ~ '^https://'
    )
  );

-- Le scritture dirette del client su extras restano quelle di HOM-02 (policy di
-- proprietà): link_target è anch'essa una colonna che RLS non protegge, ma un
-- proprietario che la altera cambia solo il proprio Post.


-- ============================================================
-- SEZIONE 2 — limiti del composer: una sola source of truth (§61)
-- ============================================================

insert into public.app_policy_settings (key, value, description)
values
  ('post_composer.max_media', to_jsonb(10),
   'HOM-06.1 §61 — numero massimo di media (IMAGE + VIDEO) per Post. Letto da footme_post_limits e inviato al client dal contesto del composer.'),
  ('post_composer.max_body_length', to_jsonb(3000),
   'HOM-06.1 — lunghezza massima del testo di un Post (il CHECK di profile_posts resta a 3000).'),
  ('post_composer.max_video_seconds', to_jsonb(300),
   'HOM-06.1 — durata massima di un singolo VIDEO, in secondi.'),
  ('post_composer.max_tags', to_jsonb(20),
   'HOM-06.1 §99–§110 — persone e Società taggabili in un Post.'),
  ('post_composer.max_mentions', to_jsonb(50),
   'HOM-06.1 §112 — mention nel testo di un Post (content_post_extras ha un tetto fisso a 50).'),
  ('post_composer.video_initial_state', to_jsonb('ready'::text),
   'HOM-06.1 §64–§65 — processing_state dei VIDEO al publish. ready finché non esiste un worker di transcodifica; uploaded/processing quando esisterà.'),
  -- URL pubblico del bucket profile-media del progetto (stesso formato di
  -- supabase.storage.getPublicUrl: <base>/<uid>/posts/<file>, base terminata da
  -- '/'). Seminato col progetto collegato da `supabase:link`; un altro ambiente
  -- (staging, locale) lo sovrascrive con un update su questa chiave.
  ('post_composer.media_public_base_url',
   to_jsonb('https://gwvkjbiuetjltrpugdxo.supabase.co/storage/v1/object/public/profile-media/'::text),
   'HOM-06.1 — base dell URL pubblico degli oggetti di profile-media, usata da publish_post per costruire content_post_media.url dal storage_path. Terminata da /. Sovrascrivibile per ambiente.'),
  ('post_composer.link_snapshot_ttl_hours', to_jsonb(24),
   'HOM-06.1 §80 — validità di uno snapshot di preview riusabile dalla Edge Function link-preview.')
on conflict (key) do nothing;


-- ============================================================
-- SEZIONE 3 — tabelle: snapshot dei link, ricevute di publish, audit
-- ============================================================

-- 3a. Snapshot dei metadata (§75, §80). Scrive solo la Edge Function (service
-- role). RLS attiva, nessuna policy, nessun grant ai client.
create table if not exists public.link_preview_snapshots (
  id             uuid        primary key default gen_random_uuid(),
  normalized_url text        not null,
  original_url   text        not null,
  final_url      text        not null,
  title          text,
  description    text,
  image_url      text,
  favicon_url    text,
  domain         text        not null,
  site_name      text,
  fetched_at     timestamptz not null default timezone('utc', now()),
  fetched_by     uuid        references public.profiles(id) on delete set null,
  constraint link_preview_snapshots_original_https_check check (original_url ~ '^https://'),
  constraint link_preview_snapshots_final_https_check check (final_url ~ '^https://'),
  constraint link_preview_snapshots_image_https_check check (image_url is null or image_url ~ '^https://'),
  constraint link_preview_snapshots_favicon_https_check check (favicon_url is null or favicon_url ~ '^https://'),
  constraint link_preview_snapshots_length_check check (
    char_length(original_url) <= 2048 and char_length(final_url) <= 2048
    and char_length(normalized_url) <= 2048
    and (title is null or char_length(title) <= 500)
    and (description is null or char_length(description) <= 1000)
    and char_length(domain) <= 255
  )
);

create index if not exists link_preview_snapshots_url_fetched_idx
  on public.link_preview_snapshots (normalized_url, fetched_at desc);

alter table public.link_preview_snapshots enable row level security;
revoke all on table public.link_preview_snapshots from anon, authenticated;

-- 3b. Ricevute di publish (§118, §176). Unica per (attore, chiave).
create table if not exists public.post_publish_receipts (
  id             uuid        primary key default gen_random_uuid(),
  actor_id       uuid        not null,
  operation_key  text        not null,
  content_type   text        not null,
  content_id     uuid        not null,
  identity_type  text        not null,
  identity_id    uuid        not null,
  origin         text        not null,
  -- Impronta degli argomenti canonici (identità, testo, mention, tag, media,
  -- link; l'origin no: è navigazione). Stessa chiave con un'altra impronta non è
  -- un retry ma un altro contenuto: post_operation_conflict, non un replay.
  payload_hash   text        not null,
  created_at     timestamptz not null default timezone('utc', now()),
  constraint post_publish_receipts_actor_key_uniq unique (actor_id, operation_key),
  constraint post_publish_receipts_content_type_check
    check (content_type in ('profile_post', 'club_media', 'media_profile'))
);

alter table public.post_publish_receipts enable row level security;
revoke all on table public.post_publish_receipts from anon, authenticated;

-- 3c. Audit: create/edit accanto a delete. I CHECK inline si cercano per
-- definizione (nomi generati dal database, possibile deriva).
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.content_management_audit'::regclass
      and con.contype = 'c'
      and (pg_get_constraintdef(con.oid) ~ '\maction\M'
           or pg_get_constraintdef(con.oid) ~ '\mresult\M')
  loop
    execute format('alter table public.content_management_audit drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.content_management_audit
  add constraint content_management_audit_action_check
  check (action in ('delete', 'create', 'edit'));

alter table public.content_management_audit
  add constraint content_management_audit_result_check
  check (result in ('deleted', 'already_deleted', 'created', 'edited'));

-- 3d. Scritture dirette sui figli di un Post (§148–§150, §207, §209, §211).
-- Le policy HOM-02 "post owners manage post media/extras" lasciano al
-- proprietario scrivere qualunque url, mention, link_preview o link_target:
-- RLS filtra righe, non colonne né contenuti. Per i Post (profile_post sempre;
-- club_media e media_profile solo se il padre ha kind 'post') le uniche
-- scritture ammesse sono quelle delle RPC di questa migrazione, che girano come
-- owner della funzione. Un client (anon/authenticated) riceve 42501.
-- I contenuti non-Post (video editoriale, tribuna, ...) restano scrivibili dal
-- proprietario come prima. Funzione INVOKER di proposito: dentro una definer
-- current_user sarebbe il proprietario e il controllo non vedrebbe il client.
create or replace function public.content_post_children_client_guard()
returns trigger
language plpgsql
as $$
declare
  v_row record;
  v_kind text;
begin
  if current_user not in ('anon', 'authenticated') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  for v_row in
    select old.content_type as ct, old.post_id as id where tg_op in ('UPDATE', 'DELETE')
    union all
    select new.content_type, new.post_id where tg_op in ('INSERT', 'UPDATE')
  loop
    v_kind := null;
    if v_row.ct = 'profile_post' then
      v_kind := 'post';
    elsif v_row.ct = 'club_media' then
      select cm.kind into v_kind from public.club_media_posts cm where cm.id = v_row.id;
    elsif v_row.ct = 'media_profile' then
      select mp.kind into v_kind from public.media_profile_posts mp where mp.id = v_row.id;
    end if;

    if v_kind = 'post' then
      raise exception 'post_direct_write_closed' using errcode = '42501';
    end if;
  end loop;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.content_post_children_client_guard() from public;
revoke execute on function public.content_post_children_client_guard() from anon, authenticated;

drop trigger if exists content_post_children_client_guard on public.content_post_media;
create trigger content_post_children_client_guard
before insert or update or delete on public.content_post_media
for each row execute function public.content_post_children_client_guard();

drop trigger if exists content_post_children_client_guard on public.content_post_extras;
create trigger content_post_children_client_guard
before insert or update or delete on public.content_post_extras
for each row execute function public.content_post_children_client_guard();


-- ============================================================
-- SEZIONE 4 — funzioni interne (nessun execute ai client)
-- ============================================================

-- 4a. Limiti (§61).
create or replace function public.footme_post_limits()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'max_media',
      coalesce((select (s.value #>> '{}')::int from public.app_policy_settings s
                where s.key = 'post_composer.max_media'), 10),
    'max_body_length',
      coalesce((select (s.value #>> '{}')::int from public.app_policy_settings s
                where s.key = 'post_composer.max_body_length'), 3000),
    'max_video_seconds',
      coalesce((select (s.value #>> '{}')::int from public.app_policy_settings s
                where s.key = 'post_composer.max_video_seconds'), 300),
    'max_tags',
      coalesce((select (s.value #>> '{}')::int from public.app_policy_settings s
                where s.key = 'post_composer.max_tags'), 20),
    'max_mentions',
      coalesce((select (s.value #>> '{}')::int from public.app_policy_settings s
                where s.key = 'post_composer.max_mentions'), 50)
  );
$$;

revoke all on function public.footme_post_limits() from public;
revoke execute on function public.footme_post_limits() from anon, authenticated;

-- 4b. Identità che il chiamante può usare per pubblicare (§18–§20, §30).
-- Una sola regola, usata dal contesto e da publish_post. auth.uid() dentro: il
-- viewer non è un parametro, non si può chiedere per conto di altri.
create or replace function public.footme_composer_identities()
returns table (c_type text, c_id uuid, c_rank integer)
language sql
stable
security definer
set search_path = public
as $$
  select 'person'::text, p.id, 0
  from public.profiles p
  where p.id = auth.uid()
    and p.role::text in ('player', 'coach', 'staff', 'agent', 'director', 'fan')

  union all

  select 'society'::text, c.id, 1
  from public.clubs c
  where c.verification_status not in ('suspended', 'rejected', 'flagged')
    and (
      c.owner_profile_id = auth.uid()
      or exists (
        select 1
        from public.club_member_permissions perm
        where perm.club_id = c.id
          and perm.profile_id = auth.uid()
          and perm.permission_key = 'content_create'
      )
    )
    and public.has_club_permission(c.id, 'content_create')

  union all

  select 'media'::text, p.id, 2
  from public.profiles p
  join public.media_profiles mp on mp.profile_id = p.id
  where p.id = auth.uid()
    and p.role::text = 'media';
$$;

revoke all on function public.footme_composer_identities() from public;
revoke execute on function public.footme_composer_identities() from anon, authenticated;

-- 4c. Scheda dell'identità (WireComposerIdentity). Non verifica permessi: la
-- chiamano chi li ha già verificati (contesto, publish) o chi mostra l'autore di
-- un contenuto che il chiamante può modificare (fetch_post_for_edit).
create or replace function public.footme_composer_identity_card(
  p_type text,
  p_id   uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case p_type
    when 'person' then (
      select jsonb_build_object(
        'identity_type', 'person',
        'identity_id',   p.id,
        'name',          coalesce(nullif(btrim(p.full_name), ''), 'Profilo'),
        'avatar_url',    p.avatar_url,
        'is_verified',   false,
        'context_label', 'Profilo personale')
      from public.profiles p
      where p.id = p_id)
    when 'media' then (
      select jsonb_build_object(
        'identity_type', 'media',
        'identity_id',   p.id,
        'name',          coalesce(nullif(btrim(mp.entity_name), ''), nullif(btrim(p.full_name), ''), 'Media'),
        'avatar_url',    coalesce(mp.logo_url, p.avatar_url),
        'is_verified',   exists (
                           select 1 from public.media_profile_verifications mv
                           where mv.media_profile_id = p.id
                             and mv.verification_type = 'profile_verified'
                             and mv.status = 'verified'),
        'context_label', 'Media')
      from public.profiles p
      join public.media_profiles mp on mp.profile_id = p.id
      where p.id = p_id)
    when 'society' then (
      select jsonb_build_object(
        'identity_type', 'society',
        'identity_id',   c.id,
        'name',          c.name,
        'avatar_url',    c.logo_url,
        'is_verified',   (c.verification_status = 'verified'),
        'context_label', 'Società')
      from public.clubs c
      where c.id = p_id)
  end;
$$;

revoke all on function public.footme_composer_identity_card(text, uuid) from public;
revoke execute on function public.footme_composer_identity_card(text, uuid) from anon, authenticated;

-- 4d. URL pubblico di un oggetto di profile-media. Il database non conosce
-- l'URL del progetto: lo legge da app_policy_settings
-- (`post_composer.media_public_base_url`, terminato da '/') e, se manca, lo
-- ricava da un URL profile-media già salvato (prima il proprio avatar, poi
-- quello di chiunque). Null se non determinabile: il chiamante rifiuta.
create or replace function public.footme_profile_media_url(p_path text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_base text;
  v_pat  constant text := '^(https://[^/]+/storage/v1/object/public/profile-media/)';
begin
  select s.value #>> '{}' into v_base
  from public.app_policy_settings s
  where s.key = 'post_composer.media_public_base_url';

  if v_base is null then
    select substring(p.avatar_url from v_pat) into v_base
    from public.profiles p
    where p.id = auth.uid() and p.avatar_url ~ v_pat;
  end if;

  if v_base is null then
    select substring(p.avatar_url from v_pat) into v_base
    from public.profiles p
    where p.avatar_url ~ v_pat
    limit 1;
  end if;

  if v_base is null or v_base !~ '^https://.*/$' then
    return null;
  end if;

  return v_base || p_path;
end;
$$;

revoke all on function public.footme_profile_media_url(text) from public;
revoke execute on function public.footme_profile_media_url(text) from anon, authenticated;

-- 4e. Mappa UTF-16 → carattere. Restituisce un array a[i+1] = offset UTF-16
-- (in unità di codice) che precede il carattere i (0-based); l'ultimo elemento
-- è la lunghezza totale. Un carattere fuori dal piano base vale 2 unità, come
-- in JavaScript. Offset che non è un confine di carattere → array_position null.
create or replace function public.footme_utf16_offsets(p_text text)
returns integer[]
language sql
immutable
set search_path = public
as $$
  select array[0]::int[] || coalesce(
    (select array_agg(w.cum order by w.i)
     from (
       select t.i,
              sum(case when ascii(t.ch) >= 65536 then 2 else 1 end) over (order by t.i)::int as cum
       from regexp_split_to_table(coalesce(p_text, ''), '') with ordinality as t(ch, i)
     ) w),
    array[]::int[]);
$$;

revoke all on function public.footme_utf16_offsets(text) from public;
revoke execute on function public.footme_utf16_offsets(text) from anon, authenticated;

-- 4f. Normalizzazione URL (§88): schema e host minuscoli, niente fragment, niente
-- parametri utm_*, niente porta di default, path '/' se vuoto. Specchio di
-- normalizeUrl in supabase/functions/link-preview/url-normalize.ts (la Edge
-- Function scrive normalized_url con la stessa regola). Non è un controllo di
-- sicurezza: publish_post accetta lo snapshot anche se original_url o final_url
-- coincidono con l'URL inviato.
create or replace function public.footme_normalize_url(p_url text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  m     text[];
  v_q   text;
  v_auth text;
begin
  m := regexp_match(btrim(coalesce(p_url, '')), '^(https?)://([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$', 'i');
  if m is null then
    return null;
  end if;

  v_auth := lower(m[2]);
  if lower(m[1]) = 'https' then
    v_auth := regexp_replace(v_auth, ':443$', '');
  else
    v_auth := regexp_replace(v_auth, ':80$', '');
  end if;

  if m[4] is not null and length(m[4]) > 1 then
    select string_agg(q, '&' order by ord)
    into v_q
    from unnest(string_to_array(substr(m[4], 2), '&')) with ordinality as x(q, ord)
    where q <> '' and q !~* '^utm_';
  end if;

  return lower(m[1]) || '://' || v_auth
         || case when coalesce(m[3], '') = '' then '/' else m[3] end
         || case when v_q is not null then '?' || v_q else '' end;
end;
$$;

revoke all on function public.footme_normalize_url(text) from public;
revoke execute on function public.footme_normalize_url(text) from anon, authenticated;

-- 4g. Mention (§112, §209). Valida e restituisce l'array normalizzato (ordinato
-- per posizione, duplicati esatti scartati). Solleva post_invalid_mention.
create or replace function public.footme_post_normalize_mentions(
  p_body     text,
  p_mentions jsonb,
  p_max      integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_off     integer[] := public.footme_utf16_offsets(p_body);
  v_all     jsonb := '[]'::jsonb;
  v_out     jsonb := '[]'::jsonb;
  v_e       jsonb;
  v_id      uuid;
  v_type    text;
  v_name    text;
  v_start   integer;
  v_end     integer;
  v_cs      integer;
  v_ce      integer;
  v_prev_end integer := -1;
  v_prev    jsonb;
begin
  if p_mentions is null or p_mentions = 'null'::jsonb then
    return '[]'::jsonb;
  end if;

  if jsonb_typeof(p_mentions) <> 'array' then
    raise exception 'post_invalid_mention' using errcode = '22023', detail = 'not_array';
  end if;

  begin
    for v_e in select e from jsonb_array_elements(p_mentions) e loop
      if jsonb_typeof(v_e) <> 'object'
         or coalesce(jsonb_typeof(v_e -> 'start'), '') <> 'number'
         or coalesce(jsonb_typeof(v_e -> 'end'), '') <> 'number'
         or coalesce(jsonb_typeof(v_e -> 'display_name'), '') <> 'string'
         or coalesce(jsonb_typeof(v_e -> 'identity_id'), '') <> 'string'
         or coalesce(jsonb_typeof(v_e -> 'identity_type'), '') <> 'string' then
        raise exception 'post_invalid_mention' using errcode = '22023', detail = 'shape';
      end if;

      v_id    := (v_e ->> 'identity_id')::uuid;
      v_type  := v_e ->> 'identity_type';
      v_name  := v_e ->> 'display_name';
      v_start := (v_e ->> 'start')::integer;
      v_end   := (v_e ->> 'end')::integer;

      if v_type not in ('profile', 'club')
         or v_name <> btrim(v_name) or v_name = '' or char_length(v_name) > 120
         or v_start < 0 or v_end <= v_start then
        raise exception 'post_invalid_mention' using errcode = '22023', detail = 'fields';
      end if;

      v_all := v_all || jsonb_build_array(jsonb_build_object(
        'identity_id', v_id, 'identity_type', v_type, 'display_name', v_name,
        'start', v_start, 'end', v_end));
    end loop;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'post_invalid_mention' using errcode = '22023', detail = 'cast';
  end;

  for v_e in
    select e from jsonb_array_elements(v_all) e
    order by (e ->> 'start')::int, (e ->> 'end')::int, e ->> 'identity_id'
  loop
    v_start := (v_e ->> 'start')::int;
    v_end   := (v_e ->> 'end')::int;
    v_id    := (v_e ->> 'identity_id')::uuid;
    v_type  := v_e ->> 'identity_type';
    v_name  := v_e ->> 'display_name';

    -- Duplicato esatto (stesso range, stessa identità): scartato (§210 per le
    -- mention). Sovrapposizione parziale: rifiutata.
    if v_prev is not null and v_prev = v_e then
      continue;
    end if;
    if v_start < v_prev_end then
      raise exception 'post_invalid_mention' using errcode = '22023', detail = 'overlap';
    end if;

    -- Range → caratteri. Un offset che cade dentro una coppia surrogata, o
    -- oltre la fine del testo, non ha corrispondenza.
    v_cs := array_position(v_off, v_start) - 1;
    v_ce := array_position(v_off, v_end) - 1;
    if v_cs is null or v_ce is null then
      raise exception 'post_invalid_mention' using errcode = '22023', detail = 'range';
    end if;

    if substr(coalesce(p_body, ''), v_cs + 1, v_ce - v_cs) <> '@' || v_name then
      raise exception 'post_invalid_mention' using errcode = '22023', detail = 'token';
    end if;

    if v_type = 'profile' then
      if not exists (select 1 from public.profiles p where p.id = v_id)
         or public.is_profile_blocked_with_viewer(v_id) then
        raise exception 'post_invalid_mention' using errcode = '22023', detail = 'identity';
      end if;
    elsif not exists (select 1 from public.clubs c where c.id = v_id) then
      raise exception 'post_invalid_mention' using errcode = '22023', detail = 'identity';
    end if;

    v_out := v_out || jsonb_build_array(v_e);
    v_prev := v_e;
    v_prev_end := v_end;
  end loop;

  if jsonb_array_length(v_out) > p_max then
    raise exception 'post_invalid_mention' using errcode = '22023', detail = 'too_many';
  end if;

  return v_out;
end;
$$;

revoke all on function public.footme_post_normalize_mentions(text, jsonb, integer) from public;
revoke execute on function public.footme_post_normalize_mentions(text, jsonb, integer) from anon, authenticated;

-- 4h. Testo significativo (§12–§13): il body privato dei range delle mention.
-- `@Marco` da solo non rende pubblicabile il Post.
create or replace function public.footme_post_text_is_meaningful(
  p_body     text,
  p_mentions jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_off    integer[] := public.footme_utf16_offsets(p_body);
  v_rest   text := '';
  v_from   integer := 0;
  v_e      jsonb;
  v_cs     integer;
  v_ce     integer;
begin
  for v_e in
    select e from jsonb_array_elements(coalesce(p_mentions, '[]'::jsonb)) e
    order by (e ->> 'start')::int
  loop
    v_cs := array_position(v_off, (v_e ->> 'start')::int) - 1;
    v_ce := array_position(v_off, (v_e ->> 'end')::int) - 1;
    if v_cs is null or v_ce is null or v_cs < v_from then
      continue;
    end if;
    v_rest := v_rest || substr(coalesce(p_body, ''), v_from + 1, v_cs - v_from);
    v_from := v_ce;
  end loop;

  v_rest := v_rest || substr(coalesce(p_body, ''), v_from + 1);
  return regexp_replace(v_rest, '\s', '', 'g') <> '';
end;
$$;

revoke all on function public.footme_post_text_is_meaningful(text, jsonb) from public;
revoke execute on function public.footme_post_text_is_meaningful(text, jsonb) from anon, authenticated;

-- 4i. Tag (§99–§110, §210). Dedupe, esistenza, limite. post_invalid_tag.
create or replace function public.footme_post_normalize_tags(
  p_tagged jsonb,
  p_max    integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_out  jsonb := '[]'::jsonb;
  v_e    jsonb;
  v_type text;
  v_id   uuid;
  v_item jsonb;
begin
  if p_tagged is null or p_tagged = 'null'::jsonb then
    return '[]'::jsonb;
  end if;

  if jsonb_typeof(p_tagged) <> 'array' then
    raise exception 'post_invalid_tag' using errcode = '22023', detail = 'not_array';
  end if;

  begin
    for v_e in select e from jsonb_array_elements(p_tagged) e loop
      if jsonb_typeof(v_e) <> 'object'
         or coalesce(jsonb_typeof(v_e -> 'target_type'), '') <> 'string'
         or coalesce(jsonb_typeof(v_e -> 'target_id'), '') <> 'string' then
        raise exception 'post_invalid_tag' using errcode = '22023', detail = 'shape';
      end if;

      v_type := v_e ->> 'target_type';
      v_id   := (v_e ->> 'target_id')::uuid;
      if v_type not in ('profile', 'club') then
        raise exception 'post_invalid_tag' using errcode = '22023', detail = 'type';
      end if;

      v_item := jsonb_build_object('target_type', v_type, 'target_id', v_id);
      if v_out @> jsonb_build_array(v_item) then
        continue;
      end if;

      if v_type = 'profile' then
        if not exists (select 1 from public.profiles p where p.id = v_id)
           or public.is_profile_blocked_with_viewer(v_id) then
          raise exception 'post_invalid_tag' using errcode = '22023', detail = 'target';
        end if;
      elsif not exists (select 1 from public.clubs c where c.id = v_id) then
        raise exception 'post_invalid_tag' using errcode = '22023', detail = 'target';
      end if;

      v_out := v_out || jsonb_build_array(v_item);
    end loop;
  exception
    when invalid_text_representation then
      raise exception 'post_invalid_tag' using errcode = '22023', detail = 'cast';
  end;

  if jsonb_array_length(v_out) > p_max then
    raise exception 'post_invalid_tag' using errcode = '22023', detail = 'too_many';
  end if;

  return v_out;
end;
$$;

revoke all on function public.footme_post_normalize_tags(jsonb, integer) from public;
revoke execute on function public.footme_post_normalize_tags(jsonb, integer) from anon, authenticated;

-- 4j. Link (§74–§95, §207, §211). Restituisce {target, preview}:
--   target  = {url, snapshot_id} | null — il link validato, sempre persistito;
--   preview = la forma che il Feed legge (url, title, description, domain,
--             thumbnail_url + favicon/site/snapshot) | null — solo se esiste
--             uno snapshot e il Post non ha media (§95).
-- Il link non blocca MAI il publish (§89): un URL non idoneo (non https, porta
-- diversa da 443, userinfo, IP letterale, host interno, caratteri di controllo,
-- troppo lungo) equivale a nessun link — target e preview null, nessun errore.
-- Solo le forme malformate sollevano post_invalid_link: p_link non oggetto, url
-- non stringa, snapshot_id non uuid, snapshot inesistente o di un altro URL.
create or replace function public.footme_post_resolve_link(
  p_link      jsonb,
  p_has_media boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_url  text;
  v_host text;
  v_sid  uuid;
  v_snap public.link_preview_snapshots;
  v_prev jsonb := null;
begin
  if p_link is null or p_link = 'null'::jsonb then
    return jsonb_build_object('target', null, 'preview', null);
  end if;

  if jsonb_typeof(p_link) <> 'object' or coalesce(jsonb_typeof(p_link -> 'url'), '') <> 'string' then
    raise exception 'post_invalid_link' using errcode = '22023', detail = 'shape';
  end if;

  if coalesce(jsonb_typeof(p_link -> 'snapshot_id'), 'null') <> 'null' then
    begin
      v_sid := (p_link ->> 'snapshot_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'post_invalid_link' using errcode = '22023', detail = 'snapshot_id';
    end;
  end if;

  v_url := btrim(p_link ->> 'url');

  -- Idoneità (§78). L'host si legge fino al primo / ? # : un fragment o una
  -- query non possono nascondere un IP (https://10.0.0.1#a).
  v_host := lower(coalesce(substring(v_url from '^[hH][tT][tT][pP][sS]://([^/?#]*)'), ''));
  v_host := regexp_replace(v_host, ':443$', '');

  if char_length(v_url) > 2048
     or v_url ~ '[[:cntrl:]]'
     or v_url ~ '[[:space:]]'
     or v_host = ''
     or v_host !~ '^[^:@]+\.[^:@]+$'
     or v_host ~ '\.$'
     or v_host ~ '\.(local|internal)$'
     or v_host ~ '^[0-9.]+$'
     or (length(v_url) > length(v_host) + 8
         and substr(v_url, length(v_host) + 9, 1) not in ('/', '?', '#', ':')) then
    return jsonb_build_object('target', null, 'preview', null);
  end if;

  -- Lo schema si scrive minuscolo: il CHECK di link_target e il Feed leggono
  -- '^https://' (§43). Host e path restano come l'utente li ha scritti.
  v_url := 'https://' || substr(v_url, 9);

  if v_sid is not null then
    select * into v_snap from public.link_preview_snapshots s where s.id = v_sid;
    if not found
       or not (v_snap.original_url = v_url
               or v_snap.final_url = v_url
               or v_snap.normalized_url = public.footme_normalize_url(v_url)) then
      raise exception 'post_invalid_link' using errcode = '22023', detail = 'snapshot';
    end if;

    if not p_has_media then
      v_prev := jsonb_strip_nulls(jsonb_build_object(
        'url',           v_snap.final_url,
        'original_url',  v_snap.original_url,
        'title',         v_snap.title,
        'description',   v_snap.description,
        'domain',        v_snap.domain,
        'thumbnail_url', v_snap.image_url,
        'favicon_url',   v_snap.favicon_url,
        'site_name',     v_snap.site_name,
        'snapshot_id',   v_snap.id));
    end if;
  end if;

  return jsonb_build_object(
    'target',  jsonb_strip_nulls(jsonb_build_object('url', v_url, 'snapshot_id', v_sid)),
    'preview', v_prev);
end;
$$;

revoke all on function public.footme_post_resolve_link(jsonb, boolean) from public;
revoke execute on function public.footme_post_resolve_link(jsonb, boolean) from anon, authenticated;


-- ============================================================
-- SEZIONE 5 — classificazione e allineamento: il kind 'post' è sempre un Post
--
-- 5a. content_post_sync_legacy_media: riemessa dalla definizione più recente
--     (20261116090000 §4). Cambia UN punto: esce subito per il kind 'post' (vedi
--     header, «PERCHÉ»). Nessun'altra differenza.
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
  -- HOM-06.1: un Post kind 'post' ha i media SOLO su content_post_media (fino a
  -- 10, non uno). Le colonne visual legacy restano null e questo trigger, che
  -- tratta quella assenza come "la sorgente ha perso il visual", cancellerebbe la
  -- posizione 0 a ogni update del padre. Per il Post non c'è nulla da allineare.
  if v ->> 'kind' = 'post' then
    return new;
  end if;

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


-- 5b. footme_feed_item_type: riemessa dalla definizione più recente
--     (20261116090000 §5). Un media_profile con content_format 'post' (il kind
--     'post', anche con un video) è un Post, non un Articolo e non un video
--     editoriale (§1: un solo formato Post). Per club_media il formato 'post' già
--     dà item_type 'post'. Il resto è identico.

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
      then case p_content_format
             when 'video' then 'video'
             when 'post'  then 'post'
             else 'article'
           end
    when p_content_format = 'articolo' then 'article'
    else 'post'
  end;
$$;

revoke all on function public.footme_feed_item_type(text, text) from public;
revoke execute on function public.footme_feed_item_type(text, text) from anon;
grant execute on function public.footme_feed_item_type(text, text) to authenticated;


-- 5c. feed_content_index: riemessa dalla definizione più recente
--     (20261114090000 §8). Cambiano i soli rami club_media e media_profile, solo
--     per kind = 'post': content_format 'post' (mai 'articolo' per lunghezza) e
--     thumbnail/tipo/durata dalla posizione 0 di content_post_media. Colonne e
--     ordine invariati.

create or replace view public.feed_content_index as

  -- ── club_media_posts (contenuto ufficiale di una società) ──────
  select
    'club_media'::text                                      as content_type,
    cmp.id                                                  as post_id,
    case
      when cmp.kind = 'post'                                    then 'post'
      when cmp.visual_type = 'video'                            then 'video'
      when cmp.visual_type = 'image' and cmp.body is null       then 'foto'
      when length(coalesce(cmp.body, '')) >= 400                then 'articolo'
      else 'post'
    end                                                     as content_format,
    cmp.kind                                                as kind,
    cmp.title                                               as title,
    coalesce(cmp.excerpt, cmp.body)                         as excerpt,
    case when cmp.kind = 'post'
         then coalesce(pm.thumbnail_url, pm.url)
         else coalesce(cmp.thumbnail_url, cmp.visual_url) end   as thumbnail_url,
    case when cmp.kind = 'post' then pm.media_type
         else cmp.visual_type end                           as media_type,
    case when cmp.kind = 'post' then pm.duration_seconds
         else cmp.video_duration_seconds end                as duration_seconds,
    'club'::text                                            as publisher_type,
    cmp.club_id                                             as publisher_id,
    c.name                                                  as publisher_name,
    c.logo_url                                              as publisher_avatar_url,
    'ufficiale'::text                                       as source_kind,
    cmp.interviewee_name                                    as author_name,
    cmp.published_at                                        as published_at,
    c.region                                                as publisher_region,
    (c.verification_status = 'verified')                    as publisher_is_verified,
    coalesce(cmp.body, cmp.excerpt)                         as body
  from public.club_media_posts cmp
  join public.clubs c on c.id = cmp.club_id
  -- HOM-06.1: per il kind 'post' il media di copertina è la posizione 0 di
  -- content_post_media (le colonne visual legacy restano null).
  left join lateral (
    select cpm.thumbnail_url, cpm.url, cpm.media_type, cpm.duration_seconds
    from public.content_post_media cpm
    where cpm.content_type = 'club_media' and cpm.post_id = cmp.id and cmp.kind = 'post'
    order by cpm.position
    limit 1
  ) pm on true
  where cmp.status = 'published'
    and cmp.published_at is not null

  union all

  -- ── media_profile_posts (contenuto editoriale) ──────────────────
  select
    'media_profile'::text,
    mpp.id,
    (case
      when mpp.kind = 'post'                             then 'post'
      when mpp.kind = 'media' and mpp.cover_type = 'video' then 'video'
      when mpp.kind = 'media'                            then 'foto'
      else 'articolo'
    end)::text,
    mpp.kind,
    mpp.title,
    coalesce(mpp.excerpt, mpp.subtitle),
    case when mpp.kind = 'post' then coalesce(pm.thumbnail_url, pm.url) else mpp.cover_url end,
    case when mpp.kind = 'post' then pm.media_type else mpp.cover_type end,
    case when mpp.kind = 'post' then pm.duration_seconds else null::int end,
    'profile'::text,
    mpp.media_profile_id,
    coalesce(mp.entity_name, p.full_name),
    coalesce(mp.logo_url, p.avatar_url),
    coalesce(mp.media_kind, 'pagina'),
    mpp.author_name,
    mpp.published_at,
    p.region,
    (mp.verification_status = 'verified'),
    coalesce(mpp.body, mpp.excerpt, mpp.subtitle)
  from public.media_profile_posts mpp
  join public.media_profiles mp on mp.profile_id = mpp.media_profile_id
  join public.profiles p        on p.id = mpp.media_profile_id
  left join lateral (
    select cpm.thumbnail_url, cpm.url, cpm.media_type, cpm.duration_seconds
    from public.content_post_media cpm
    where cpm.content_type = 'media_profile' and cpm.post_id = mpp.id and mpp.kind = 'post'
    order by cpm.position
    limit 1
  ) pm on true
  where mpp.status = 'published'
    and mpp.published_at is not null

  union all

  -- ── media_tribuna_posts (dibattiti / sondaggi editoriali) ───────
  -- `excerpt` è il body intero: vedi delta 3 nell'header.
  select
    'media_tribuna'::text,
    mtp.id,
    'post'::text,
    mtp.kind,
    mtp.title,
    mtp.body,
    null::text,
    null::text,
    null::int,
    'profile'::text,
    mtp.media_profile_id,
    coalesce(mp.entity_name, p.full_name),
    coalesce(mp.logo_url, p.avatar_url),
    coalesce(mp.media_kind, 'pagina'),
    null::text,
    mtp.published_at,
    p.region,
    (mp.verification_status = 'verified'),
    mtp.body
  from public.media_tribuna_posts mtp
  join public.media_profiles mp on mp.profile_id = mtp.media_profile_id
  join public.profiles p        on p.id = mtp.media_profile_id
  where mtp.status = 'published'
    and mtp.published_at is not null

  union all

  -- ── fan_tribuna_posts (contenuto tifoso: opinioni, foto, sondaggi) ──
  select
    'fan_tribuna'::text,
    ftp.id,
    case
      when ftp.kind = 'photo' and ftp.media_type = 'video' then 'video'
      when ftp.kind = 'photo'                              then 'foto'
      else 'post'
    end,
    ftp.kind,
    ftp.title,
    ftp.body,
    coalesce(ftp.thumbnail_url, ftp.media_url),
    ftp.media_type,
    null::int,
    'profile'::text,
    ftp.profile_id,
    p.full_name,
    p.avatar_url,
    'tifoso'::text,
    null::text,
    ftp.published_at,
    p.region,
    false,
    ftp.body
  from public.fan_tribuna_posts ftp
  join public.profiles p on p.id = ftp.profile_id
  where ftp.status = 'published'
    and ftp.published_at is not null

  union all

  -- ── fan_media_posts (bacheca tifoso: foto e video) ──────────────
  -- title/excerpt invertiti rispetto a media_content_index: vedi delta 2.
  select
    'fan_media'::text,
    fmp.id,
    case when fmp.visual_type = 'video' then 'video' else 'foto' end,
    fmp.tag,
    null::text,
    fmp.description,
    coalesce(fmp.thumbnail_url, fmp.visual_url),
    fmp.visual_type,
    null::int,
    'profile'::text,
    fmp.profile_id,
    p.full_name,
    p.avatar_url,
    'tifoso'::text,
    null::text,
    fmp.published_at,
    p.region,
    false,
    fmp.description
  from public.fan_media_posts fmp
  join public.profiles p on p.id = fmp.profile_id
  where fmp.status = 'published'
    and fmp.published_at is not null

  union all

  -- ── profile_posts (post delle persone: HOM-02) ──────────────────
  -- `kind` e `title` assenti: il Post persona è testo + media, senza
  -- tipologia editoriale. Thumbnail, tipo e durata vengono dalla prima riga
  -- di content_post_media (posizione 0). source_kind 'persona' non coincide
  -- con nessun valore che il Feed usa per le preferenze (testata, giornalista,
  -- creator, pagina). Nessuna verifica esiste per le persone: false.
  select
    'profile_post'::text,
    pp.id,
    'post'::text,
    null::text,
    null::text,
    nullif(pp.body, ''),
    coalesce(m.thumbnail_url, m.url),
    m.media_type,
    m.duration_seconds,
    'profile'::text,
    pp.profile_id,
    p.full_name,
    p.avatar_url,
    'persona'::text,
    null::text,
    pp.published_at,
    p.region,
    false,
    pp.body
  from public.profile_posts pp
  join public.profiles p on p.id = pp.profile_id
  left join lateral (
    select cpm.thumbnail_url, cpm.url, cpm.media_type, cpm.duration_seconds
    from public.content_post_media cpm
    where cpm.content_type = 'profile_post' and cpm.post_id = pp.id
    order by cpm.position
    limit 1
  ) m on true
  where pp.status = 'published'
    and pp.published_at <= timezone('utc', now());

revoke all on table public.feed_content_index from anon, authenticated;


-- 5d. media_content_index (ricerca CER-05): riemessa dalla definizione più
--     recente (20261009160000 §5). Stesse due correzioni di 5c, più l'excerpt: un
--     Post non ha un excerpt in tabella e la ricerca mostra il testo. Colonne e
--     ordine invariati.

create or replace view public.media_content_index as
with base as (

  -- ── club_media_posts (contenuto ufficiale di una società) ───────
  select
    'club_media'::text                                      as content_type,
    cmp.id                                                  as post_id,
    case
      when cmp.kind = 'post'                                    then 'post'
      when cmp.visual_type = 'video'                            then 'video'
      when cmp.visual_type = 'image' and cmp.body is null       then 'foto'
      when length(coalesce(cmp.body, '')) >= 400                then 'articolo'
      else 'post'
    end                                                     as content_format,
    cmp.kind                                                as kind,
    cmp.title                                               as title,
    case when cmp.kind = 'post' then left(cmp.body, 280)
         else cmp.excerpt end                               as excerpt,
    cmp.body                                                as body,
    case when cmp.kind = 'post'
         then coalesce(pm.thumbnail_url, pm.url)
         else coalesce(cmp.thumbnail_url, cmp.visual_url) end   as thumbnail_url,
    case when cmp.kind = 'post' then pm.media_type
         else cmp.visual_type end                           as media_type,
    case when cmp.kind = 'post' then pm.duration_seconds
         else cmp.video_duration_seconds end                as duration_seconds,
    'club'::text                                            as publisher_type,
    cmp.club_id                                             as publisher_id,
    c.name                                                  as publisher_name,
    c.logo_url                                              as publisher_avatar_url,
    'ufficiale'::text                                       as source_kind,
    cmp.interviewee_name                                    as author_name,
    cmp.published_at                                        as published_at,
    array[c.category]                                       as own_categories,
    array[c.region]                                         as own_regions,
    array[c.province]                                       as own_provinces,
    array[c.city]                                           as own_cities,
    array[
      public.footme_content_kind_label('club_media', cmp.kind),
      cmp.player_name,
      cmp.player_previous_club
    ]                                                       as own_topics
  from public.club_media_posts cmp
  join public.clubs c on c.id = cmp.club_id
  -- HOM-06.1: per il kind 'post' il media di copertina è la posizione 0 di
  -- content_post_media (le colonne visual legacy restano null).
  left join lateral (
    select cpm.thumbnail_url, cpm.url, cpm.media_type, cpm.duration_seconds
    from public.content_post_media cpm
    where cpm.content_type = 'club_media' and cpm.post_id = cmp.id and cmp.kind = 'post'
    order by cpm.position
    limit 1
  ) pm on true
  where cmp.status = 'published'

  union all

  -- ── media_profile_posts (contenuto editoriale) ──────────────────
  select
    'media_profile'::text,
    mpp.id,
    (case
      when mpp.kind = 'post'                             then 'post'
      when mpp.kind = 'media' and mpp.cover_type = 'video' then 'video'
      when mpp.kind = 'media'                            then 'foto'
      else 'articolo'
    end)::text,
    mpp.kind,
    mpp.title,
    coalesce(mpp.excerpt, mpp.subtitle, case when mpp.kind = 'post' then left(mpp.body, 280) end),
    mpp.body,
    case when mpp.kind = 'post' then coalesce(pm.thumbnail_url, pm.url) else mpp.cover_url end,
    case when mpp.kind = 'post' then pm.media_type else mpp.cover_type end,
    case when mpp.kind = 'post' then pm.duration_seconds else null::int end,
    'profile'::text,
    mpp.media_profile_id,
    coalesce(mp.entity_name, p.full_name),
    coalesce(mp.logo_url, p.avatar_url),
    coalesce(mp.media_kind, 'pagina'),
    mpp.author_name,
    mpp.published_at,
    public.footme_text_array_clean(array[mpp.category] || mp.covered_competitions),
    public.footme_text_array_clean(array[p.region] || mp.covered_territories),
    array[]::text[],
    array[p.city],
    public.footme_text_array_clean(
      array[public.footme_content_kind_label('media_profile', mpp.kind), mpp.source_name]
      || mp.covered_topics
      || mp.covered_teams
    )
  from public.media_profile_posts mpp
  join public.media_profiles mp on mp.profile_id = mpp.media_profile_id
  join public.profiles p        on p.id = mpp.media_profile_id
  left join lateral (
    select cpm.thumbnail_url, cpm.url, cpm.media_type, cpm.duration_seconds
    from public.content_post_media cpm
    where cpm.content_type = 'media_profile' and cpm.post_id = mpp.id and mpp.kind = 'post'
    order by cpm.position
    limit 1
  ) pm on true
  where mpp.status = 'published'

  union all

  -- ── media_tribuna_posts (dibattiti/sondaggi editoriali) ─────────
  select
    'media_tribuna'::text,
    mtp.id,
    'post'::text,
    mtp.kind,
    mtp.title,
    mtp.body,
    mtp.body,
    null::text,
    null::text,
    null::int,
    'profile'::text,
    mtp.media_profile_id,
    coalesce(mp.entity_name, p.full_name),
    coalesce(mp.logo_url, p.avatar_url),
    coalesce(mp.media_kind, 'pagina'),
    null::text,
    mtp.published_at,
    public.footme_text_array_clean(mp.covered_competitions),
    public.footme_text_array_clean(array[p.region] || mp.covered_territories),
    array[]::text[],
    array[p.city],
    public.footme_text_array_clean(
      array[public.footme_content_kind_label('media_tribuna', mtp.kind)]
      || mp.covered_topics
      || mp.covered_teams
    )
  from public.media_tribuna_posts mtp
  join public.media_profiles mp on mp.profile_id = mtp.media_profile_id
  join public.profiles p        on p.id = mtp.media_profile_id
  where mtp.status = 'published'

  union all

  -- ── fan_tribuna_posts (contenuto tifoso: opinioni, foto, sondaggi) ──
  select
    'fan_tribuna'::text,
    ftp.id,
    case
      when ftp.kind = 'photo' and ftp.media_type = 'video' then 'video'
      when ftp.kind = 'photo'                              then 'foto'
      else 'post'
    end,
    ftp.kind,
    ftp.title,
    ftp.body,
    ftp.body,
    coalesce(ftp.thumbnail_url, ftp.media_url),
    ftp.media_type,
    null::int,
    'profile'::text,
    ftp.profile_id,
    p.full_name,
    p.avatar_url,
    'tifoso'::text,
    null::text,
    ftp.published_at,
    array[ftp.reference_category, rc.category],
    array[p.region, rc.region],
    array[rc.province],
    array[p.city, rc.city],
    array[
      public.footme_content_kind_label('fan_tribuna', ftp.kind),
      ftp.reference_team_name,
      rc.name
    ]
  from public.fan_tribuna_posts ftp
  join public.profiles p     on p.id = ftp.profile_id
  left join public.clubs rc  on rc.id = ftp.reference_club_id
  where ftp.status = 'published'

  union all

  -- ── fan_media_posts (bacheca tifoso: foto e video) ──────────────
  -- Nessun `title` in tabella: l'anteprima usa `description`, già vincolata
  -- a 280 caratteri, troncata a due righe lato client.
  select
    'fan_media'::text,
    fmp.id,
    case when fmp.visual_type = 'video' then 'video' else 'foto' end,
    fmp.tag,
    fmp.description,
    null::text,
    null::text,
    coalesce(fmp.thumbnail_url, fmp.visual_url),
    fmp.visual_type,
    null::int,
    'profile'::text,
    fmp.profile_id,
    p.full_name,
    p.avatar_url,
    'tifoso'::text,
    null::text,
    fmp.published_at,
    array[fmp.tag],
    array[p.region],
    array[]::text[],
    array[p.city],
    array[fmp.tag]
  from public.fan_media_posts fmp
  join public.profiles p on p.id = fmp.profile_id
  where fmp.status = 'published'

)
select
  b.content_type,
  b.post_id,
  b.content_format,
  b.kind,
  b.title,
  b.excerpt,
  b.thumbnail_url,
  b.media_type,
  b.duration_seconds,
  b.publisher_type,
  b.publisher_id,
  b.publisher_name,
  b.publisher_avatar_url,
  b.source_kind,
  b.author_name,
  b.published_at,
  coalesce(eng.engagement_count, 0)                     as engagement_count,
  coalesce(tag.tagged_club_ids, '{}'::uuid[])           as tagged_club_ids,
  coalesce(tag.tagged_team_ids, '{}'::uuid[])           as tagged_team_ids,
  coalesce(tag.tagged_profile_ids, '{}'::uuid[])        as tagged_profile_ids,
  public.footme_text_array_clean(
    b.own_categories || coalesce(tag.tag_categories, '{}'::text[])
  )                                                     as categories,
  public.footme_text_array_clean(
    b.own_regions || coalesce(tag.tag_regions, '{}'::text[])
  )                                                     as regions,
  public.footme_text_array_clean(
    b.own_provinces || coalesce(tag.tag_provinces, '{}'::text[])
  )                                                     as provinces,
  public.footme_text_array_clean(
    b.own_cities || coalesce(tag.tag_cities, '{}'::text[])
  )                                                     as cities,
  public.footme_text_array_clean(b.own_topics)          as topics,
  public.footme_normalize_lookup(b.title)               as title_norm,
  public.footme_normalize_lookup(b.publisher_name)      as publisher_norm,
  public.footme_normalize_lookup(
    array_to_string(coalesce(tag.tagged_names, '{}'::text[]), ' ')
  )                                                     as tagged_norm,
  public.footme_normalize_lookup(
    array_to_string(
      public.footme_text_array_clean(
        b.own_categories || coalesce(tag.tag_categories, '{}'::text[])
      ),
      ' '
    )
  )                                                     as categories_norm,
  public.footme_normalize_lookup(
    array_to_string(
      public.footme_text_array_clean(
        b.own_regions || coalesce(tag.tag_regions, '{}'::text[])
        || b.own_provinces || coalesce(tag.tag_provinces, '{}'::text[])
        || b.own_cities || coalesce(tag.tag_cities, '{}'::text[])
      ),
      ' '
    )
  )                                                     as territory_norm,
  -- Blob unico su cui gira il matching a token. Include titolo, testo,
  -- fonte, autore, nomi delle entità taggate, categorie, territori e
  -- argomenti: è ciò che permette a "AC Como" di trovare un contenuto in cui
  -- la società è taggata ma non citata nel titolo (CER-05 §5).
  public.footme_normalize_lookup(
    concat_ws(' ',
      b.title,
      b.excerpt,
      left(coalesce(b.body, ''), 2000),
      b.publisher_name,
      b.author_name,
      array_to_string(coalesce(tag.tagged_names, '{}'::text[]), ' '),
      array_to_string(
        public.footme_text_array_clean(
          b.own_categories || coalesce(tag.tag_categories, '{}'::text[])
          || b.own_regions || coalesce(tag.tag_regions, '{}'::text[])
          || b.own_provinces || coalesce(tag.tag_provinces, '{}'::text[])
          || b.own_cities || coalesce(tag.tag_cities, '{}'::text[])
          || b.own_topics
        ),
        ' '
      )
    )
  )                                                     as search_blob
from base b
left join public.media_content_tag_agg tag
  on tag.content_type = b.content_type and tag.post_id = b.post_id
left join public.media_content_engagement eng
  on eng.content_type = b.content_type and eng.post_id = b.post_id;

revoke all on table public.media_content_index from anon, authenticated;


-- ============================================================
-- SEZIONE 6 — fetch_post_composer_context (§14–§20, §61)
-- ============================================================

create or replace function public.fetch_post_composer_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return jsonb_build_object(
    'identities', coalesce(
      (select jsonb_agg(x.card order by x.c_rank, x.card ->> 'name', x.card ->> 'identity_id')
       from (
         select i.c_rank,
                public.footme_composer_identity_card(i.c_type, i.c_id) as card
         from public.footme_composer_identities() i
       ) x
       where x.card is not null),
      '[]'::jsonb),
    'limits', public.footme_post_limits());
end;
$$;

revoke all on function public.fetch_post_composer_context() from public;
revoke execute on function public.fetch_post_composer_context() from anon;
grant execute on function public.fetch_post_composer_context() to authenticated;

comment on function public.fetch_post_composer_context() is
  'HOM-06.1 §14–§20, §61: identità con can_publish_post e limiti del composer (WireComposerContext).';


-- ============================================================
-- SEZIONE 7 — publish_post (§12–§13, §30, §42–§44, §61, §69, §95, §112–§118, §207–§211)
-- ============================================================

create or replace function public.publish_post(
  p_operation_key text,
  p_identity_type text,
  p_identity_id   uuid,
  p_body          text,
  p_mentions      jsonb,
  p_tagged        jsonb,
  p_media         jsonb,
  p_link          jsonb,
  p_origin        text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_limits    jsonb := public.footme_post_limits();
  v_receipt   public.post_publish_receipts;
  v_body      text := coalesce(p_body, '');
  v_mentions  jsonb;
  v_tags      jsonb;
  v_link      jsonb;
  v_card      jsonb;
  v_clean     jsonb := '[]'::jsonb;
  v_item      jsonb;
  v_ord       integer;
  v_path      text;
  v_thumb     text;
  v_mtype     text;
  v_mime      text;
  v_url       text;
  v_turl      text;
  v_w         integer;
  v_h         integer;
  v_dur       integer;
  v_alt       text;
  v_prefix    text := coalesce(v_uid::text, '') || '/posts/';
  v_state     text;
  v_ctype     text;
  v_post_id   uuid;
  v_target    jsonb;
  v_preview   jsonb;
  v_t         jsonb;
  v_hash      text;
  v_status    text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_operation_key is null or length(btrim(p_operation_key)) < 8 or length(p_operation_key) > 120 then
    raise exception 'post_invalid_content' using errcode = '22023', detail = 'operation_key';
  end if;

  -- Una sola esecuzione per (attore, chiave) alla volta: il secondo tap aspetta
  -- il primo e legge la sua ricevuta (§118, §176).
  perform pg_advisory_xact_lock(hashtext('post_publish:' || v_uid::text || ':' || p_operation_key));

  select * into v_receipt
  from public.post_publish_receipts r
  where r.actor_id = v_uid and r.operation_key = p_operation_key;

  -- Impronta degli argomenti come arrivano (jsonb ha un testo canonico: ordine
  -- delle chiavi fisso). L'origin non entra: è navigazione, non contenuto.
  v_hash := md5(jsonb_build_object(
    'identity_type', p_identity_type,
    'identity_id',   p_identity_id,
    'body',          coalesce(p_body, ''),
    'mentions',      coalesce(p_mentions, 'null'::jsonb),
    'tagged',        coalesce(p_tagged, 'null'::jsonb),
    'media',         coalesce(p_media, 'null'::jsonb),
    'link',          coalesce(p_link, 'null'::jsonb))::text);

  if found then
    -- Stessa chiave, altro contenuto: non è un retry. Il client ruota la chiave.
    if v_receipt.payload_hash <> v_hash then
      raise exception 'post_operation_conflict' using errcode = '40001', detail = 'payload';
    end if;

    -- Un replay restituisce un Post che esiste ancora, pubblicato. Eliminato o
    -- non più pubblicato: non si presenta come successo (il client creerebbe un
    -- link a un contenuto che non c'è).
    select r.r_status into v_status
    from public.footme_content_rights(v_receipt.content_type, v_receipt.content_id) r;
    if v_status is distinct from 'published' then
      raise exception 'post_operation_conflict' using errcode = '40001', detail = 'gone';
    end if;

    return jsonb_build_object(
      'content_type', v_receipt.content_type,
      'content_id',   v_receipt.content_id,
      'replayed',     true);
  end if;

  -- §30: utente, identità, capability e stato dell'identità si rivalidano qui,
  -- sempre, qualunque cosa il client abbia visto nel contesto.
  if p_identity_type is null or p_identity_id is null
     or not exists (
       select 1 from public.footme_composer_identities() i
       where i.c_type = p_identity_type and i.c_id = p_identity_id) then
    raise exception 'post_permission_denied' using errcode = '42501';
  end if;

  v_card := public.footme_composer_identity_card(p_identity_type, p_identity_id);
  if v_card is null then
    raise exception 'post_permission_denied' using errcode = '42501';
  end if;

  if p_origin is null or p_origin not in (
       'HOME_PER_TE', 'HOME_SEGUITI', 'PERSONAL_PROFILE', 'SOCIETY_PROFILE',
       'MEDIA_PROFILE', 'CONTENT_DETAIL') then
    raise exception 'post_invalid_content' using errcode = '22023', detail = 'origin';
  end if;

  if char_length(v_body) > (v_limits ->> 'max_body_length')::int then
    raise exception 'post_invalid_content' using errcode = '22023', detail = 'body_length';
  end if;

  -- ── media (§42–§44, §61, §207) ────────────────────────────────
  if p_media is null or p_media = 'null'::jsonb then
    p_media := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_media) <> 'array' then
    raise exception 'post_invalid_media' using errcode = '22023', detail = 'not_array';
  end if;

  if jsonb_array_length(p_media) > (v_limits ->> 'max_media')::int then
    raise exception 'post_media_limit' using errcode = '22023';
  end if;

  v_state := coalesce(
    (select s.value #>> '{}' from public.app_policy_settings s
     where s.key = 'post_composer.video_initial_state'), 'ready');
  if v_state not in ('ready', 'uploaded', 'processing') then
    v_state := 'ready';
  end if;

  begin
    for v_item, v_ord in
      select e, (o - 1)::int from jsonb_array_elements(p_media) with ordinality as t(e, o)
    loop
      if jsonb_typeof(v_item) <> 'object'
         or coalesce(jsonb_typeof(v_item -> 'storage_path'), '') <> 'string'
         or coalesce(jsonb_typeof(v_item -> 'media_type'), '') <> 'string' then
        raise exception 'post_invalid_media' using errcode = '22023', detail = 'shape';
      end if;

      v_path  := v_item ->> 'storage_path';
      v_mtype := v_item ->> 'media_type';

      -- Il path deve stare nella cartella dei post dell'attore: non si può
      -- referenziare il file di un altro utente (§207).
      if v_mtype not in ('image', 'video')
         or char_length(v_path) > 300
         or left(v_path, char_length(v_prefix)) <> v_prefix
         or char_length(v_path) = char_length(v_prefix)
         or v_path ~ '(^|/)\.\.(/|$)' or v_path ~ '//' or v_path ~ '[[:cntrl:]]' then
        raise exception 'post_invalid_media' using errcode = '22023', detail = 'path';
      end if;

      if exists (select 1 from jsonb_array_elements(v_clean) c where c ->> 'storage_path' = v_path) then
        raise exception 'post_invalid_media' using errcode = '22023', detail = 'duplicate';
      end if;

      select o.metadata ->> 'mimetype' into v_mime
      from storage.objects o
      where o.bucket_id = 'profile-media' and o.name = v_path;
      if not found
         or (v_mime is not null and v_mime not like v_mtype || '/%') then
        raise exception 'post_invalid_media' using errcode = '22023', detail = 'object';
      end if;

      v_thumb := nullif(v_item ->> 'thumbnail_path', '');
      if v_thumb is not null then
        if char_length(v_thumb) > 300
           or left(v_thumb, char_length(v_prefix)) <> v_prefix
           or char_length(v_thumb) = char_length(v_prefix)
           or v_thumb ~ '(^|/)\.\.(/|$)' or v_thumb ~ '//' or v_thumb ~ '[[:cntrl:]]'
           or not exists (
             select 1 from storage.objects o
             where o.bucket_id = 'profile-media' and o.name = v_thumb) then
          raise exception 'post_invalid_media' using errcode = '22023', detail = 'thumbnail';
        end if;
      end if;

      v_w := nullif(v_item ->> 'width', '')::integer;
      v_h := nullif(v_item ->> 'height', '')::integer;
      v_dur := case when v_mtype = 'video' then nullif(v_item ->> 'duration_seconds', '')::integer end;
      if (v_w is not null and (v_w <= 0 or v_w > 20000))
         or (v_h is not null and (v_h <= 0 or v_h > 20000))
         or (v_dur is not null and v_dur < 0) then
        raise exception 'post_invalid_media' using errcode = '22023', detail = 'size';
      end if;
      if v_dur is not null and v_dur > (v_limits ->> 'max_video_seconds')::int then
        raise exception 'post_invalid_media' using errcode = '22023', detail = 'video_too_long';
      end if;

      v_alt := left(nullif(btrim(coalesce(v_item ->> 'alt_text', '')), ''), 300);

      v_url := public.footme_profile_media_url(v_path);
      v_turl := case when v_thumb is not null then public.footme_profile_media_url(v_thumb) end;
      if v_url is null then
        raise exception 'post_invalid_media' using errcode = '22023', detail = 'storage_base_url_unknown';
      end if;

      v_clean := v_clean || jsonb_build_array(jsonb_build_object(
        'position', v_ord, 'storage_path', v_path, 'media_type', v_mtype,
        'url', v_url, 'thumbnail_url', v_turl, 'width', v_w, 'height', v_h,
        'duration_seconds', v_dur, 'alt_text', v_alt));
    end loop;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'post_invalid_media' using errcode = '22023', detail = 'cast';
  end;

  -- ── mention, tag, link ────────────────────────────────────────
  v_mentions := public.footme_post_normalize_mentions(
    v_body, p_mentions, (v_limits ->> 'max_mentions')::int);
  v_tags := public.footme_post_normalize_tags(p_tagged, (v_limits ->> 'max_tags')::int);
  v_link := public.footme_post_resolve_link(p_link, jsonb_array_length(v_clean) > 0);
  v_target := v_link -> 'target';
  v_preview := v_link -> 'preview';

  -- §12–§13: testo significativo (senza le mention), un media o un URL valido.
  -- Tag e mention da soli non bastano; un video dal path valido sì.
  if not (
       public.footme_post_text_is_meaningful(v_body, v_mentions)
       or jsonb_array_length(v_clean) > 0
       or jsonb_typeof(v_target) = 'object') then
    raise exception 'post_invalid_content' using errcode = '22023', detail = 'empty';
  end if;

  -- ── scrittura ─────────────────────────────────────────────────
  if p_identity_type = 'person' then
    v_ctype := 'profile_post';
    insert into public.profile_posts (profile_id, body)
    values (v_uid, v_body)
    returning id into v_post_id;

  elsif p_identity_type = 'society' then
    v_ctype := 'club_media';
    insert into public.club_media_posts (club_id, created_by_profile_id, kind, title, body)
    values (p_identity_id, v_uid, 'post', '', nullif(v_body, ''))
    returning id into v_post_id;

  else
    v_ctype := 'media_profile';
    insert into public.media_profile_posts
      (media_profile_id, created_by_profile_id, kind, category, title, author_name, body)
    values
      (p_identity_id, v_uid, 'post', '', '', v_card ->> 'name', nullif(v_body, ''))
    returning id into v_post_id;
  end if;

  for v_item in select e from jsonb_array_elements(v_clean) e loop
    insert into public.content_post_media
      (content_type, post_id, position, media_type, url, thumbnail_url,
       width, height, duration_seconds, alt_text, processing_state)
    values
      (v_ctype, v_post_id, (v_item ->> 'position')::smallint, v_item ->> 'media_type',
       v_item ->> 'url', v_item ->> 'thumbnail_url',
       (v_item ->> 'width')::integer, (v_item ->> 'height')::integer,
       (v_item ->> 'duration_seconds')::integer, v_item ->> 'alt_text',
       case when v_item ->> 'media_type' = 'video' then v_state else 'ready' end);
  end loop;

  if jsonb_array_length(v_mentions) > 0 or jsonb_typeof(v_target) = 'object' then
    insert into public.content_post_extras (content_type, post_id, mentions, link_preview, link_target)
    values (v_ctype, v_post_id, v_mentions,
            case when jsonb_typeof(v_preview) = 'object' then v_preview end,
            case when jsonb_typeof(v_target) = 'object' then v_target end);
  end if;

  for v_t in select e from jsonb_array_elements(v_tags) e loop
    if v_ctype = 'profile_post' then
      insert into public.profile_post_tagged_targets (post_id, target_type, target_id)
      values (v_post_id, v_t ->> 'target_type', (v_t ->> 'target_id')::uuid);
    elsif v_ctype = 'club_media' then
      insert into public.club_media_tagged_profiles (post_id, target_type, target_id, profile_id)
      values (v_post_id, v_t ->> 'target_type', (v_t ->> 'target_id')::uuid,
              case when v_t ->> 'target_type' = 'profile' then (v_t ->> 'target_id')::uuid end);
    else
      insert into public.media_profile_post_tagged_targets (post_id, target_type, target_id)
      values (v_post_id, v_t ->> 'target_type', (v_t ->> 'target_id')::uuid);
    end if;
  end loop;

  insert into public.post_publish_receipts
    (actor_id, operation_key, content_type, content_id, identity_type, identity_id, origin, payload_hash)
  values
    (v_uid, p_operation_key, v_ctype, v_post_id, p_identity_type, p_identity_id, p_origin, v_hash);

  insert into public.content_management_audit
    (content_type, post_id, actor_user_id, acting_identity_type, acting_identity_id, action, result)
  values
    (v_ctype, v_post_id, v_uid, p_identity_type, p_identity_id, 'create', 'created');

  return jsonb_build_object(
    'content_type', v_ctype,
    'content_id',   v_post_id,
    'replayed',     false);
end;
$$;

revoke all on function public.publish_post(text, text, uuid, text, jsonb, jsonb, jsonb, jsonb, text) from public;
revoke execute on function public.publish_post(text, text, uuid, text, jsonb, jsonb, jsonb, jsonb, text) from anon;
grant execute on function public.publish_post(text, text, uuid, text, jsonb, jsonb, jsonb, jsonb, text) to authenticated;

comment on function public.publish_post(text, text, uuid, text, jsonb, jsonb, jsonb, jsonb, text) is
  'HOM-06.1: crea un Post (profile_post | club_media kind post | media_profile kind post). Rivalida identità e capability (§30), idempotente per (attore, operation_key) (§118). Errori: post_* come composer-types.ts.';


-- ============================================================
-- SEZIONE 8 — fetch_post_for_edit (§143–§154, §146)
-- ============================================================

create or replace function public.fetch_post_for_edit(
  p_content_type text,
  p_post_id      uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_r       record;
  v_kind    text;
  v_body    text;
  v_idtype  text;
  v_card    jsonb;
  v_ex      public.content_post_extras;
  v_link    jsonb := null;
  v_snap    public.link_preview_snapshots;
  v_url     text;
  v_sid     uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_post_id is null or p_content_type not in ('profile_post', 'club_media', 'media_profile') then
    raise exception 'post_not_found' using errcode = 'P0002';
  end if;

  select * into v_r from public.footme_content_rights(p_content_type, p_post_id) r;
  -- Inesistente, eliminato, bozza o archiviato: non esiste per la modifica.
  if v_r.r_status is distinct from 'published' then
    raise exception 'post_not_found' using errcode = 'P0002';
  end if;

  if p_content_type = 'profile_post' then
    select 'post', pp.body into v_kind, v_body from public.profile_posts pp where pp.id = p_post_id;
    v_idtype := 'person';
  elsif p_content_type = 'club_media' then
    select cm.kind, cm.body into v_kind, v_body from public.club_media_posts cm where cm.id = p_post_id;
    v_idtype := 'society';
  else
    select mp.kind, mp.body into v_kind, v_body from public.media_profile_posts mp where mp.id = p_post_id;
    v_idtype := 'media';
  end if;

  -- Il composer modifica solo i Post: gli altri kind (Articolo, highlights, ...)
  -- hanno un loro editor (HOM-06.2).
  if v_kind is distinct from 'post' or v_r.r_can_edit is not true then
    raise exception 'post_edit_denied' using errcode = '42501';
  end if;

  v_card := public.footme_composer_identity_card(v_idtype, v_r.r_publisher_id);
  if v_card is null then
    raise exception 'post_not_found' using errcode = 'P0002';
  end if;

  select * into v_ex from public.content_post_extras x
  where x.content_type = p_content_type and x.post_id = p_post_id;

  if v_ex.link_target is not null then
    v_url := v_ex.link_target ->> 'url';
    begin
      v_sid := nullif(v_ex.link_target ->> 'snapshot_id', '')::uuid;
    exception when invalid_text_representation then
      v_sid := null;
    end;
    if v_sid is not null then
      select * into v_snap from public.link_preview_snapshots s where s.id = v_sid;
    end if;
    -- I dati della preview vengono dallo snapshot se c'è, altrimenti dalla
    -- link_preview salvata (post legacy, o snapshot rimosso). `has_preview` dice
    -- se il Post ha una preview visuale salvata: snapshot_id null, nessun titolo
    -- e has_preview false = preview rimossa o assente (§93).
    v_link := jsonb_build_object(
      'url',         v_url,
      'snapshot_id', case when v_snap.id is not null then v_snap.id end,
      'title',       coalesce(v_snap.title, v_ex.link_preview ->> 'title'),
      'description', coalesce(v_snap.description, v_ex.link_preview ->> 'description'),
      'image_url',   coalesce(v_snap.image_url, v_ex.link_preview ->> 'thumbnail_url'),
      'domain',      coalesce(v_snap.domain, nullif(v_ex.link_preview ->> 'domain', ''),
                       regexp_replace(split_part(substr(v_url, 9), '/', 1), '^www\.', '')),
      'has_preview', v_ex.link_preview is not null);
  elsif v_ex.link_preview is not null then
    -- Post precedente a HOM-06.1: la preview è l'unico dato di link.
    v_link := jsonb_build_object(
      'url',         v_ex.link_preview ->> 'url',
      'snapshot_id', null,
      'title',       v_ex.link_preview ->> 'title',
      'description', v_ex.link_preview ->> 'description',
      'image_url',   v_ex.link_preview ->> 'thumbnail_url',
      'domain',      coalesce(nullif(v_ex.link_preview ->> 'domain', ''),
                       regexp_replace(split_part(substr(v_ex.link_preview ->> 'url', 9), '/', 1), '^www\.', '')),
      'has_preview', true);
  end if;

  return jsonb_build_object(
    'content_type', p_content_type,
    'content_id',   p_post_id,
    'version',      to_char(v_r.r_updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'author',       v_card,
    'body',         coalesce(v_body, ''),
    'mentions',     coalesce(v_ex.mentions, '[]'::jsonb),
    'tagged', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'target_type', t.target_type,
                 'target_id',   t.target_id,
                 'display_name', case t.target_type when 'profile' then pr.full_name else cl.name end,
                 'avatar_url',  case t.target_type when 'profile' then pr.avatar_url else cl.logo_url end,
                 'is_verified', case t.target_type
                                  when 'profile' then exists (
                                    select 1 from public.media_profile_verifications mv
                                    where mv.media_profile_id = pr.id
                                      and mv.verification_type = 'profile_verified'
                                      and mv.status = 'verified')
                                  else coalesce(cl.verification_status = 'verified', false) end,
                 'subtitle',    case t.target_type when 'profile' then null else cl.category end)
               order by t.created_at, t.target_id)
      from (
        select x.target_type, x.target_id, x.created_at
        from (
          select tt.target_type, tt.target_id, tt.created_at
          from public.profile_post_tagged_targets tt
          where p_content_type = 'profile_post' and tt.post_id = p_post_id and tt.status = 'active'
          union all
          select tt.target_type, coalesce(tt.target_id, tt.profile_id), tt.created_at
          from public.club_media_tagged_profiles tt
          where p_content_type = 'club_media' and tt.post_id = p_post_id and tt.status = 'active'
          union all
          select tt.target_type, tt.target_id, tt.created_at
          from public.media_profile_post_tagged_targets tt
          where p_content_type = 'media_profile' and tt.post_id = p_post_id and tt.status = 'active'
        ) x
        where x.target_type in ('profile', 'club')
      ) t
      left join public.profiles pr on t.target_type = 'profile' and pr.id = t.target_id
      left join public.clubs cl    on t.target_type = 'club'    and cl.id = t.target_id
      where coalesce(case t.target_type when 'profile' then pr.full_name else cl.name end, '') <> ''
    ), '[]'::jsonb),
    'link',         v_link,
    'media', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'position',         m.position,
                 'media_type',       m.media_type,
                 'url',              m.url,
                 'thumbnail_url',    m.thumbnail_url,
                 'width',            m.width,
                 'height',           m.height,
                 'duration_seconds', m.duration_seconds)
               order by m.position)
      from public.content_post_media m
      where m.content_type = p_content_type and m.post_id = p_post_id and m.url is not null
    ), '[]'::jsonb),
    'can_edit',     true);
end;
$$;

revoke all on function public.fetch_post_for_edit(text, uuid) from public;
revoke execute on function public.fetch_post_for_edit(text, uuid) from anon;
grant execute on function public.fetch_post_for_edit(text, uuid) to authenticated;

comment on function public.fetch_post_for_edit(text, uuid) is
  'HOM-06.1 §146: dati del Post per precaricare il composer in modifica (WirePostForEdit). post_not_found se non pubblicato/inesistente, post_edit_denied se il chiamante non può modificarlo o non è un Post.';


-- ============================================================
-- SEZIONE 9 — update_post (§143–§166)
--
-- Stessa riga, stesso content_id: le statistiche HOM-05 restano (§165). I media
-- e l'autore non si toccano mai (§147–§149). Versionata su updated_at (§160–§161).
-- ============================================================

create or replace function public.update_post(
  p_content_type     text,
  p_post_id          uuid,
  p_expected_version text,
  p_body             text,
  p_mentions         jsonb,
  p_tagged           jsonb,
  p_link             jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_limits    jsonb := public.footme_post_limits();
  v_status    text;
  v_kind      text;
  v_updated   timestamptz;
  v_expected  timestamptz;
  v_r         record;
  v_body      text := coalesce(p_body, '');
  v_mentions  jsonb;
  v_tags      jsonb;
  v_link      jsonb;
  v_target    jsonb;
  v_preview   jsonb;
  v_media_n   integer;
  v_idtype    text;
  v_new_ver   timestamptz;
  v_t         jsonb;
  v_now       timestamptz := clock_timestamp();
  v_old_prev  jsonb;
  v_old_tgt   jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_post_id is null then
    raise exception 'post_not_found' using errcode = 'P0002';
  end if;

  -- Lock di riga: due modifiche concorrenti si serializzano e la seconda
  -- rilegge updated_at già cambiato (READ COMMITTED) → conflitto di versione.
  if p_content_type = 'profile_post' then
    select pp.status, 'post', pp.updated_at into v_status, v_kind, v_updated
    from public.profile_posts pp where pp.id = p_post_id for update;
    v_idtype := 'person';
  elsif p_content_type = 'club_media' then
    select cm.status, cm.kind, cm.updated_at into v_status, v_kind, v_updated
    from public.club_media_posts cm where cm.id = p_post_id for update;
    v_idtype := 'society';
  elsif p_content_type = 'media_profile' then
    select mp.status, mp.kind, mp.updated_at into v_status, v_kind, v_updated
    from public.media_profile_posts mp where mp.id = p_post_id for update;
    v_idtype := 'media';
  else
    raise exception 'post_not_found' using errcode = 'P0002';
  end if;

  if v_status is distinct from 'published' then
    raise exception 'post_not_found' using errcode = 'P0002';
  end if;

  -- §159: can_edit e stato si rivalidano dopo il lock (§173).
  select * into v_r from public.footme_content_rights(p_content_type, p_post_id) r;
  if v_kind is distinct from 'post' or v_r.r_can_edit is not true then
    raise exception 'post_edit_denied' using errcode = '42501';
  end if;

  begin
    v_expected := p_expected_version::timestamptz;
  exception when others then
    v_expected := null;
  end;
  if v_expected is null or v_expected <> v_updated then
    raise exception 'post_version_conflict' using errcode = '40001';
  end if;

  if char_length(v_body) > (v_limits ->> 'max_body_length')::int then
    raise exception 'post_invalid_content' using errcode = '22023', detail = 'body_length';
  end if;

  select count(*)::int into v_media_n
  from public.content_post_media m
  where m.content_type = p_content_type and m.post_id = p_post_id;

  v_mentions := public.footme_post_normalize_mentions(
    v_body, p_mentions, (v_limits ->> 'max_mentions')::int);
  v_tags := public.footme_post_normalize_tags(p_tagged, (v_limits ->> 'max_tags')::int);
  -- Ricalcolo da zero (§156–§157): URL cambiato o tolto → niente preview
  -- vecchia; preview rimossa dall'utente (snapshot_id null) → solo il link.
  v_link := public.footme_post_resolve_link(p_link, v_media_n > 0);
  v_target := v_link -> 'target';
  v_preview := v_link -> 'preview';

  -- Preview legacy: un Post precedente a HOM-06.1 ha una link_preview senza
  -- snapshot (non c'è un id da rimandare). Se l'URL non è cambiato, nessuno
  -- snapshot è stato inviato e l'utente non l'ha rimossa (`dismiss_preview`),
  -- la preview esistente resta invece di sparire a ogni modifica del testo.
  -- Una preview con snapshot invece si conserva rimandando lo snapshot_id (lo
  -- restituisce fetch_post_for_edit); senza, è rimossa dall'utente (§93).
  if jsonb_typeof(v_target) = 'object'
     and jsonb_typeof(v_preview) is distinct from 'object'
     and coalesce(jsonb_typeof(p_link -> 'snapshot_id'), 'null') = 'null'
     and coalesce(p_link ->> 'dismiss_preview', 'false') <> 'true' then
    select x.link_preview, x.link_target into v_old_prev, v_old_tgt
    from public.content_post_extras x
    where x.content_type = p_content_type and x.post_id = p_post_id;

    if jsonb_typeof(v_old_prev) = 'object'
       and (v_old_prev ->> 'snapshot_id') is null
       and public.footme_normalize_url(v_target ->> 'url') in (
         public.footme_normalize_url(v_old_prev ->> 'url'),
         public.footme_normalize_url(v_old_prev ->> 'original_url'),
         public.footme_normalize_url(v_old_tgt ->> 'url')) then
      v_preview := v_old_prev;
    end if;
  end if;

  if not (
       public.footme_post_text_is_meaningful(v_body, v_mentions)
       or v_media_n > 0
       or jsonb_typeof(v_target) = 'object') then
    raise exception 'post_invalid_content' using errcode = '22023', detail = 'empty';
  end if;

  if p_content_type = 'profile_post' then
    update public.profile_posts
       set body = v_body, edited_at = v_now, updated_at = v_now
     where id = p_post_id
    returning updated_at into v_new_ver;
  elsif p_content_type = 'club_media' then
    update public.club_media_posts
       set body = nullif(v_body, ''), edited_at = v_now, updated_at = v_now
     where id = p_post_id
    returning updated_at into v_new_ver;
  else
    update public.media_profile_posts
       set body = nullif(v_body, ''), edited_at = v_now, updated_at = v_now
     where id = p_post_id
    returning updated_at into v_new_ver;
  end if;

  if jsonb_array_length(v_mentions) > 0 or jsonb_typeof(v_target) = 'object'
     or exists (select 1 from public.content_post_extras x
                where x.content_type = p_content_type and x.post_id = p_post_id) then
    insert into public.content_post_extras as x
      (content_type, post_id, mentions, link_preview, link_target)
    values
      (p_content_type, p_post_id, v_mentions,
       case when jsonb_typeof(v_preview) = 'object' then v_preview end,
       case when jsonb_typeof(v_target) = 'object' then v_target end)
    on conflict (content_type, post_id) do update
      set mentions     = excluded.mentions,
          link_preview = excluded.link_preview,
          link_target  = excluded.link_target;
  end if;

  -- Tag: si tolgono solo gli attivi non più richiesti; un tag nascosto o
  -- segnalato dalla persona taggata non viene riattivato da una modifica.
  if p_content_type = 'profile_post' then
    delete from public.profile_post_tagged_targets tt
    where tt.post_id = p_post_id and tt.status = 'active'
      and not exists (
        select 1 from jsonb_array_elements(v_tags) e
        where e ->> 'target_type' = tt.target_type and (e ->> 'target_id')::uuid = tt.target_id);
  elsif p_content_type = 'club_media' then
    delete from public.club_media_tagged_profiles tt
    where tt.post_id = p_post_id and tt.status = 'active'
      and not exists (
        select 1 from jsonb_array_elements(v_tags) e
        where e ->> 'target_type' = tt.target_type
          and (e ->> 'target_id')::uuid = coalesce(tt.target_id, tt.profile_id));
  else
    delete from public.media_profile_post_tagged_targets tt
    where tt.post_id = p_post_id and tt.status = 'active'
      and not exists (
        select 1 from jsonb_array_elements(v_tags) e
        where e ->> 'target_type' = tt.target_type and (e ->> 'target_id')::uuid = tt.target_id);
  end if;

  for v_t in select e from jsonb_array_elements(v_tags) e loop
    if p_content_type = 'profile_post' then
      insert into public.profile_post_tagged_targets (post_id, target_type, target_id)
      values (p_post_id, v_t ->> 'target_type', (v_t ->> 'target_id')::uuid)
      on conflict do nothing;
    elsif p_content_type = 'club_media' then
      insert into public.club_media_tagged_profiles (post_id, target_type, target_id, profile_id)
      values (p_post_id, v_t ->> 'target_type', (v_t ->> 'target_id')::uuid,
              case when v_t ->> 'target_type' = 'profile' then (v_t ->> 'target_id')::uuid end)
      on conflict do nothing;
    else
      insert into public.media_profile_post_tagged_targets (post_id, target_type, target_id)
      values (p_post_id, v_t ->> 'target_type', (v_t ->> 'target_id')::uuid)
      on conflict do nothing;
    end if;
  end loop;

  insert into public.content_management_audit
    (content_type, post_id, actor_user_id, acting_identity_type, acting_identity_id, action, result)
  values
    (p_content_type, p_post_id, v_uid, v_idtype, v_r.r_publisher_id, 'edit', 'edited');

  return jsonb_build_object(
    'content_type', p_content_type,
    'content_id',   p_post_id,
    'version',      to_char(v_new_ver at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
end;
$$;

revoke all on function public.update_post(text, uuid, text, text, jsonb, jsonb, jsonb) from public;
revoke execute on function public.update_post(text, uuid, text, text, jsonb, jsonb, jsonb) from anon;
grant execute on function public.update_post(text, uuid, text, text, jsonb, jsonb, jsonb) to authenticated;

comment on function public.update_post(text, uuid, text, text, jsonb, jsonb, jsonb) is
  'HOM-06.1 §155–§161: modifica testo, mention, tag e link di un Post pubblicato. Stesso content_id, media e autore immutabili, versione su updated_at (post_version_conflict 40001).';


-- ============================================================
-- SEZIONE 10 — letture legacy che non filtrano per kind
--
-- Un Post di Società o di Media ha title '' e le colonne visual legacy null
-- (il media sta su content_post_media). Quattro letture SQL lo avrebbero
-- mostrato come riga vuota. Ognuna è riemessa dalla sua definizione più recente
-- (verificato con grep che nessuna migrazione successiva la ridefinisce); firme,
-- colonne e grant invariati. Scelta per lettura:
--
--   * fetch_saved_items (20261118090000 §8): il Post si può salvare
--     (can_save per club_media/media_profile) quindi deve comparire e aprirsi:
--     titolo = primi 80 caratteri del testo (ripiego 'Post'), miniatura = posizione
--     0 di content_post_media.
--   * fetch_tagged_content_for_owner / _public / _for_target (20260620120000): chi è
--     taggato in un Post deve poterlo trovare (§99): stesso ripiego di titolo e
--     miniatura. La tab «Taggato» non è un elenco editoriale.
--   * fetch_dashboard_society_overview (20261102090000): recent_content_preview è
--     "gli ultimi contenuti pubblicati dalla Società": un Post lo è, stesso
--     ripiego. drafts_* non cambia (un Post nasce pubblicato).
--   * fetch_society_profile_editor (20261008140000): il contatore 'media' dell'hub
--     descrive la tab Media della Società, che è editoriale (highlights,
--     interviste, ...) e non mostra i Post: il contatore li esclude per restare
--     uguale a ciò che l'utente vede nella tab.
--
-- Non toccati, e perché: fetch_media_profile_article_categories e la tab Media del
-- Media/Creator filtrano già per kind; la ricerca (media_content_index) e il Feed
-- sono corretti in §5; la ricerca CER-01 (search_cerca) filtra per titolo con
-- almeno 2 caratteri, un titolo vuoto non può corrispondere; l'elenco degli
-- argomenti di ricerca scarta le categorie vuote.
-- ============================================================

create or replace function public.fetch_saved_items(
  p_filter    text    default 'all',
  p_limit     int     default 20,
  p_offset    int     default 0
)
returns table (
  kind          text,
  source_table  text,
  entity_id     uuid,
  content_type  text,
  title         text,
  subtitle      text,
  thumbnail_url text,
  saved_at      timestamptz
)
language plpgsql
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
  select *
  from (

    -- ── saved_profiles ──────────────────────────────────────────
    select
      'profile'::text                     as kind,
      'saved_profiles'::text              as source_table,
      sp.target_profile_id                as entity_id,
      null::text                          as content_type,
      p.full_name                         as title,
      p.role::text                        as subtitle,
      p.avatar_url                        as thumbnail_url,
      sp.created_at                       as saved_at
    from public.saved_profiles sp
    join public.profiles p on p.id = sp.target_profile_id
    where sp.owner_profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'profile')

    union all

    -- ── saved_clubs ──────────────────────────────────────────────
    select
      'club'::text                        as kind,
      'saved_clubs'::text                 as source_table,
      sc.club_id                          as entity_id,
      null::text                          as content_type,
      c.name                              as title,
      coalesce(c.category, c.region)      as subtitle,
      c.logo_url                          as thumbnail_url,
      sc.created_at                       as saved_at
    from public.saved_clubs sc
    join public.clubs c on c.id = sc.club_id
    where sc.owner_profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'club')

    union all

    -- ── saved_teams (squadre interne) ────────────────────────────
    select
      'team'::text                        as kind,
      'saved_teams'::text                 as source_table,
      st.team_id                          as entity_id,
      null::text                          as content_type,
      ct.name                             as title,
      coalesce(parent_club.name, ct.category) as subtitle,
      ct.logo_url                         as thumbnail_url,
      st.created_at                       as saved_at
    from public.saved_teams st
    join public.club_teams ct on ct.id = st.team_id
    join public.clubs parent_club on parent_club.id = ct.club_id
    where st.owner_profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'club')

    union all

    -- ── saved_ads (positions) ────────────────────────────────────
    select
      'position'::text                    as kind,
      'saved_ads'::text                   as source_table,
      sa.ad_id                            as entity_id,
      null::text                          as content_type,
      ra.title                            as title,
      coalesce(ra.region, ra.role_required::text) as subtitle,
      null::text                          as thumbnail_url,
      sa.created_at                       as saved_at
    from public.saved_ads sa
    join public.recruiting_ads ra on ra.id = sa.ad_id
    where sa.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'position')

    union all

    -- ── saved_media_tribuna (content) ───────────────────────────
    select
      'content'::text                     as kind,
      'saved_media_tribuna'::text         as source_table,
      smt.post_id                         as entity_id,
      'media_tribuna'::text               as content_type,
      mtp.title                           as title,
      mtp.kind                            as subtitle,
      null::text                          as thumbnail_url,
      smt.created_at                      as saved_at
    from public.saved_media_tribuna smt
    join public.media_tribuna_posts mtp on mtp.id = smt.post_id
      and mtp.status = 'published'
    where smt.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'content')

    union all

    -- ── saved_club_media (content) ──────────────────────────────
    select
      'content'::text                     as kind,
      'saved_club_media'::text            as source_table,
      scm.post_id                         as entity_id,
      'club_media'::text                  as content_type,
      case when cmp.kind = 'post' then coalesce(nullif(left(btrim(cmp.body), 80), ''), 'Post') else cmp.title end                           as title,
      cmp.kind                            as subtitle,
      coalesce(cmp.thumbnail_url, cmp.visual_url, (select coalesce(m.thumbnail_url, m.url) from public.content_post_media m where m.content_type = 'club_media' and m.post_id = cmp.id and m.position = 0)) as thumbnail_url,
      scm.created_at                      as saved_at
    from public.saved_club_media scm
    join public.club_media_posts cmp on cmp.id = scm.post_id
      and cmp.status = 'published'
    where scm.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'content')

    union all

    -- ── saved_fan_tribuna (content) ─────────────────────────────
    select
      'content'::text                     as kind,
      'saved_fan_tribuna'::text           as source_table,
      sft.post_id                         as entity_id,
      'fan_tribuna'::text                 as content_type,
      ftp.title                           as title,
      ftp.kind                            as subtitle,
      coalesce(ftp.thumbnail_url, ftp.media_url) as thumbnail_url,
      sft.created_at                      as saved_at
    from public.saved_fan_tribuna sft
    join public.fan_tribuna_posts ftp on ftp.id = sft.post_id
      and ftp.status = 'published'
    where sft.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'content')

    union all

    -- ── saved_media_profile_posts (content) — nuovo in CER-05 ────
    select
      'content'::text                     as kind,
      'saved_media_profile_posts'::text   as source_table,
      smp.post_id                         as entity_id,
      'media_profile'::text               as content_type,
      case when mpp.kind = 'post' then coalesce(nullif(left(btrim(mpp.body), 80), ''), 'Post') else mpp.title end                           as title,
      mpp.kind                            as subtitle,
      coalesce(mpp.cover_url, (select coalesce(m.thumbnail_url, m.url) from public.content_post_media m where m.content_type = 'media_profile' and m.post_id = mpp.id and m.position = 0))                       as thumbnail_url,
      smp.created_at                      as saved_at
    from public.saved_media_profile_posts smp
    join public.media_profile_posts mpp on mpp.id = smp.post_id
      and mpp.status = 'published'
    where smp.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'content')

    union all

    -- ── saved_fan_media (content) — nuovo in CER-05 ──────────────
    select
      'content'::text                     as kind,
      'saved_fan_media'::text             as source_table,
      sfm.post_id                         as entity_id,
      'fan_media'::text                   as content_type,
      fmp.description                     as title,
      fmp.tag                             as subtitle,
      coalesce(fmp.thumbnail_url, fmp.visual_url) as thumbnail_url,
      sfm.created_at                      as saved_at
    from public.saved_fan_media sfm
    join public.fan_media_posts fmp on fmp.id = sfm.post_id
      and fmp.status = 'published'
    where sfm.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'content')

  ) rows
  order by rows.saved_at desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.fetch_saved_items(text, int, int) from public;
grant execute on function public.fetch_saved_items(text, int, int) to authenticated;

create or replace function public.fetch_tagged_content_for_owner(
  p_profile_id uuid default auth.uid(),
  p_limit      int  default 30,
  p_offset     int  default 0
)
returns table (
  content_type   text,
  post_id        uuid,
  kind           text,
  title          text,
  thumbnail_url  text,
  publisher_id   uuid,
  publisher_name text,
  published_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- Clamp paging args to safe bounds.
  if p_limit is null or p_limit < 1 then
    p_limit := 30;
  elsif p_limit > 100 then
    p_limit := 100;
  end if;

  if p_offset is null or p_offset < 0 then
    p_offset := 0;
  end if;

  return query
    -- club_media: profile targets only
    select
      'club_media'::text,
      p.id,
      p.kind,
      case when p.kind = 'post' then coalesce(nullif(left(btrim(p.body), 80), ''), 'Post') else p.title end,
      coalesce(p.thumbnail_url, p.visual_url, (select coalesce(m.thumbnail_url, m.url) from public.content_post_media m where m.content_type = 'club_media' and m.post_id = p.id and m.position = 0)),
      p.club_id,
      c.name,
      p.published_at
    from public.club_media_tagged_profiles t
    join public.club_media_posts p on p.id = t.post_id and p.status = 'published'
    join public.clubs c on c.id = p.club_id
    where t.target_type = 'profile'
      and t.target_id = p_profile_id
      and t.status = 'active'

    union all

    -- media_profile: profile targets only
    select
      'media_profile'::text,
      mp.id,
      mp.kind,
      case when mp.kind = 'post' then coalesce(nullif(left(btrim(mp.body), 80), ''), 'Post') else mp.title end,
      coalesce(mp.cover_url, (select coalesce(m.thumbnail_url, m.url) from public.content_post_media m where m.content_type = 'media_profile' and m.post_id = mp.id and m.position = 0)),
      mp.media_profile_id,
      coalesce(pr.full_name, 'Media'),
      mp.published_at
    from public.media_profile_post_tagged_targets t
    join public.media_profile_posts mp on mp.id = t.post_id and mp.status = 'published'
    join public.profiles pr on pr.id = mp.media_profile_id
    where t.target_type = 'profile'
      and t.target_id = p_profile_id
      and t.status = 'active'

    union all

    -- fan_tribuna: profile targets only (target_type='profile'; coalesce handles legacy rows)
    select
      'fan_tribuna'::text,
      fp.id,
      fp.kind,
      fp.title,
      case when fp.kind = 'photo' then fp.thumbnail_url else null::text end,
      fp.profile_id,
      coalesce(pr.full_name, 'Fan'),
      fp.published_at
    from public.fan_tribuna_tagged_players t
    join public.fan_tribuna_posts fp on fp.id = t.post_id and fp.status = 'published'
    join public.profiles pr on pr.id = fp.profile_id
    where t.target_type = 'profile'
      and coalesce(t.target_id, t.player_profile_id) = p_profile_id
      and t.status = 'active'

    order by published_at desc nulls last
    limit p_limit offset p_offset;
end;
$$;

revoke all on function public.fetch_tagged_content_for_owner(uuid, int, int) from public;
grant execute on function public.fetch_tagged_content_for_owner(uuid, int, int) to authenticated;


-- ============================================================
-- fetch_tagged_content_public (profile targets, status in active/reported/in_review)
-- ============================================================

drop function if exists public.fetch_tagged_content_public(uuid);

create or replace function public.fetch_tagged_content_public(
  p_profile_id uuid,
  p_limit      int default 30,
  p_offset     int default 0
)
returns table (
  content_type   text,
  post_id        uuid,
  kind           text,
  title          text,
  thumbnail_url  text,
  publisher_id   uuid,
  publisher_name text,
  published_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_limit is null or p_limit < 1 then
    p_limit := 30;
  elsif p_limit > 100 then
    p_limit := 100;
  end if;

  if p_offset is null or p_offset < 0 then
    p_offset := 0;
  end if;

  return query
    select
      'club_media'::text,
      p.id,
      p.kind,
      case when p.kind = 'post' then coalesce(nullif(left(btrim(p.body), 80), ''), 'Post') else p.title end,
      coalesce(p.thumbnail_url, p.visual_url, (select coalesce(m.thumbnail_url, m.url) from public.content_post_media m where m.content_type = 'club_media' and m.post_id = p.id and m.position = 0)),
      p.club_id,
      c.name,
      p.published_at
    from public.club_media_tagged_profiles t
    join public.club_media_posts p on p.id = t.post_id and p.status = 'published'
    join public.clubs c on c.id = p.club_id
    where t.target_type = 'profile'
      and t.target_id = p_profile_id
      and t.status in ('active', 'reported', 'in_review')

    union all

    select
      'media_profile'::text,
      mp.id,
      mp.kind,
      case when mp.kind = 'post' then coalesce(nullif(left(btrim(mp.body), 80), ''), 'Post') else mp.title end,
      coalesce(mp.cover_url, (select coalesce(m.thumbnail_url, m.url) from public.content_post_media m where m.content_type = 'media_profile' and m.post_id = mp.id and m.position = 0)),
      mp.media_profile_id,
      coalesce(pr.full_name, 'Media'),
      mp.published_at
    from public.media_profile_post_tagged_targets t
    join public.media_profile_posts mp on mp.id = t.post_id and mp.status = 'published'
    join public.profiles pr on pr.id = mp.media_profile_id
    where t.target_type = 'profile'
      and t.target_id = p_profile_id
      and t.status in ('active', 'reported', 'in_review')

    union all

    select
      'fan_tribuna'::text,
      fp.id,
      fp.kind,
      fp.title,
      case when fp.kind = 'photo' then fp.thumbnail_url else null::text end,
      fp.profile_id,
      coalesce(pr.full_name, 'Fan'),
      fp.published_at
    from public.fan_tribuna_tagged_players t
    join public.fan_tribuna_posts fp on fp.id = t.post_id and fp.status = 'published'
    join public.profiles pr on pr.id = fp.profile_id
    where t.target_type = 'profile'
      and coalesce(t.target_id, t.player_profile_id) = p_profile_id
      and t.status in ('active', 'reported', 'in_review')

    order by published_at desc nulls last
    limit p_limit offset p_offset;
end;
$$;

revoke all on function public.fetch_tagged_content_public(uuid, int, int) from public;
grant execute on function public.fetch_tagged_content_public(uuid, int, int) to authenticated;


-- ============================================================
-- fetch_tagged_content_for_target (club/team targets, status='active')
-- ============================================================

drop function if exists public.fetch_tagged_content_for_target(text, uuid);

create or replace function public.fetch_tagged_content_for_target(
  p_target_type text,
  p_target_id   uuid,
  p_limit       int default 30,
  p_offset      int default 0
)
returns table (
  content_type   text,
  post_id        uuid,
  kind           text,
  title          text,
  thumbnail_url  text,
  publisher_id   uuid,
  publisher_name text,
  published_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_limit is null or p_limit < 1 then
    p_limit := 30;
  elsif p_limit > 100 then
    p_limit := 100;
  end if;

  if p_offset is null or p_offset < 0 then
    p_offset := 0;
  end if;

  return query
    -- club_media: club/team tags on club media posts
    select
      'club_media'::text,
      p.id,
      p.kind,
      case when p.kind = 'post' then coalesce(nullif(left(btrim(p.body), 80), ''), 'Post') else p.title end,
      coalesce(p.thumbnail_url, p.visual_url, (select coalesce(m.thumbnail_url, m.url) from public.content_post_media m where m.content_type = 'club_media' and m.post_id = p.id and m.position = 0)),
      p.club_id,
      c.name,
      p.published_at
    from public.club_media_tagged_profiles t
    join public.club_media_posts p on p.id = t.post_id and p.status = 'published'
    join public.clubs c on c.id = p.club_id
    where t.target_type = p_target_type
      and t.target_id   = p_target_id
      and t.status      = 'active'

    union all

    -- media_profile: club/team tags on media-profile posts
    select
      'media_profile'::text,
      mp.id,
      mp.kind,
      case when mp.kind = 'post' then coalesce(nullif(left(btrim(mp.body), 80), ''), 'Post') else mp.title end,
      coalesce(mp.cover_url, (select coalesce(m.thumbnail_url, m.url) from public.content_post_media m where m.content_type = 'media_profile' and m.post_id = mp.id and m.position = 0)),
      mp.media_profile_id,
      coalesce(pr.full_name, 'Media'),
      mp.published_at
    from public.media_profile_post_tagged_targets t
    join public.media_profile_posts mp on mp.id = t.post_id and mp.status = 'published'
    join public.profiles pr on pr.id = mp.media_profile_id
    where t.target_type = p_target_type
      and t.target_id   = p_target_id
      and t.status      = 'active'

    union all

    -- fan_tribuna: club/team tags on fan tribuna posts
    select
      'fan_tribuna'::text,
      fp.id,
      fp.kind,
      fp.title,
      case when fp.kind = 'photo' then fp.thumbnail_url else null::text end,
      fp.profile_id,
      coalesce(pr.full_name, 'Fan'),
      fp.published_at
    from public.fan_tribuna_tagged_players t
    join public.fan_tribuna_posts fp on fp.id = t.post_id and fp.status = 'published'
    join public.profiles pr on pr.id = fp.profile_id
    where t.target_type = p_target_type
      and t.target_id   = p_target_id
      and t.status      = 'active'

    order by published_at desc nulls last
    limit p_limit offset p_offset;
end;
$$;

revoke all on function public.fetch_tagged_content_for_target(text, uuid, int, int) from public;
grant execute on function public.fetch_tagged_content_for_target(text, uuid, int, int) to authenticated;

create or replace function public.fetch_dashboard_society_overview(p_club_id uuid)
returns table (
  -- ── Riepilogo e conteggi ────────────────────────────────────────────
  positions_open_count          integer,
  applications_count            integer,
  teams_count                   integer,
  drafts_count                  integer,
  scheduled_count               integer,

  -- ── Inviti e richieste (§14) ────────────────────────────────────────
  invites_incoming_count        integer,
  invites_pending_count         integer,

  -- ── Conteggio canonico "da gestire" (§10) ───────────────────────────
  applications_to_handle_count  integer,

  -- ── Segnali operativi normalizzati ──────────────────────────────────
  priority_signals              jsonb,
  priority_total_count          integer,

  -- ── Preview ─────────────────────────────────────────────────────────
  applications_preview          jsonb,
  teams_preview                 jsonb,
  drafts_preview                jsonb,
  recent_content_preview        jsonb,

  -- ── Metadata di cache e accesso ─────────────────────────────────────
  access_verified_at            timestamptz,
  data_revision                 bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid   := auth.uid();
  v_caps    text[];
  -- Un perimetro **per capability** (§19). Le coppie `_all` esistono perché
  -- «scope null = illimitato» è la regola più facile da invertire per
  -- sbaglio: scritta una volta, riusata in ogni predicato.
  v_pos_scope  uuid[];
  v_pos_all    boolean;
  v_app_scope  uuid[];
  v_app_all    boolean;
  v_team_scope uuid[];
  v_team_all   boolean;
  v_inv_scope  uuid[];
  v_inv_all    boolean;
  v_req_scope  uuid[];
  v_req_all    boolean;
  -- I contenuti non hanno squadra: `club_media_posts` appartiene alla
  -- Società. Le metriche editoriali esistono quindi solo per chi ha
  -- `content_view` senza restrizione di squadra.
  v_content_all boolean;
  v_now     timestamptz := timezone('utc', now());
  v_signals jsonb  := '[]'::jsonb;
  v_total   integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  v_pos_scope  := public.dashboard_club_capability_scope(p_club_id, 'positions_view');
  v_pos_all    := v_pos_scope is null;
  v_app_scope  := public.dashboard_club_capability_scope(p_club_id, 'applications_view');
  v_app_all    := v_app_scope is null;
  v_team_scope := public.dashboard_club_capability_scope(p_club_id, 'teams_view');
  v_team_all   := v_team_scope is null;
  v_inv_scope  := public.dashboard_club_capability_scope(p_club_id, 'invites_view');
  v_inv_all    := v_inv_scope is null;
  v_req_scope  := public.dashboard_club_capability_scope(p_club_id, 'member_requests_view');
  v_req_all    := v_req_scope is null;
  v_content_all := public.dashboard_club_capability_scope(p_club_id, 'content_view') is null;

  if not ('dashboard_view' = any (v_caps)) then
    return query select
      null::integer, null::integer, null::integer, null::integer, null::integer,
      null::integer, null::integer,
      null::integer,
      null::jsonb, null::integer,
      null::jsonb, null::jsonb, null::jsonb, null::jsonb,
      null::timestamptz, null::bigint;
    return;
  end if;

  -- ── Segnali `new_applications` ────────────────────────────────────────
  if 'applications_view' = any (v_caps) then
    select coalesce(jsonb_agg(signal order by signal->>'occurred_at' desc), '[]'::jsonb)
      into v_signals
    from (
      select jsonb_build_object(
        'type_id',         'new_applications',
        'aggregation_key', 'new_applications:' || p_club_id::text || ':' || ra.id::text,
        'target_kind',     'position',
        'target_id',       ra.id,
        'count',           count(app.id)::integer,
        'role',            ra.role_required::text,
        'team_name',       ct.name,
        'deadline_at',     ra.deadline,
        'occurred_at',     max(app.latest_submitted_at)
      ) as signal
      from public.recruiting_ads ra
      join public.recruiting_applications app
        on app.ad_id = ra.id
       and public.society_application_is_new(
             app.id, app.submission_revision, app.status, ra.status, v_uid
           )
      left join public.club_teams ct on ct.id = ra.team_id
      where ra.club_id = p_club_id
        and ra.status = 'published'
        and (v_app_all or ra.team_id = any (v_app_scope))
      group by ra.id, ra.role_required, ra.deadline, ct.name
      order by max(app.latest_submitted_at) desc
      limit 10
    ) signals;

    select count(*)::integer into v_total
    from (
      select ra.id
      from public.recruiting_ads ra
      join public.recruiting_applications app
        on app.ad_id = ra.id
       and public.society_application_is_new(
             app.id, app.submission_revision, app.status, ra.status, v_uid
           )
      where ra.club_id = p_club_id
        and ra.status = 'published'
        and (v_app_all or ra.team_id = any (v_app_scope))
      group by ra.id
    ) totals;
  end if;

  return query
  select
    case when 'positions_view' = any (v_caps) then (
      select count(*)::integer
      from public.recruiting_ads ra
      where ra.club_id = p_club_id
        and ra.status = 'published'
        and (v_pos_all or ra.team_id = any (v_pos_scope))
    ) end as positions_open_count,

    case when 'applications_view' = any (v_caps) then (
      select count(*)::integer
      from public.recruiting_applications app
      join public.recruiting_ads ra on ra.id = app.ad_id
      where ra.club_id = p_club_id
        and app.status <> 'withdrawn'
        and (v_app_all or ra.team_id = any (v_app_scope))
    ) end as applications_count,

    -- §15: archiviate escluse. Le affiliate non compaiono perché la fonte è
    -- `club_teams`, non `club_affiliations`: una Società collegata non è una
    -- squadra di questa Società.
    case when 'teams_view' = any (v_caps) then (
      select count(*)::integer
      from public.club_teams ct
      where ct.club_id = p_club_id
        and not ct.is_archived
        and (v_team_all or ct.id = any (v_team_scope))
    ) end as teams_count,

    case when 'content_view' = any (v_caps) and v_content_all then (
      select count(*)::integer
      from public.club_media_posts cmp
      where cmp.club_id = p_club_id
        and cmp.status = 'draft'
    ) end as drafts_count,

    -- Contratto predisposto, dominio non ancora capace di programmare:
    -- `club_media_posts.status` ammette draft/published/archived.
    null::integer as scheduled_count,

    /* DAS-REV-19 §15: le richieste in ingresso **esistono** — sono il
       modello canonico delle richieste avviate dalla persona, che il Centro
       legge nella seconda tab. Finché nessuno le leggeva, DAS-REV-07 §14
       imponeva `null` invece di uno zero inventato; ora il numero è reale,
       e resta `null` per chi non ha la chiave di lettura. */
    case when 'member_requests_view' = any (v_caps) then (
      select count(*)::integer
      from public.club_members cm
      where cm.club_id = p_club_id
        and cm.status = 'pending'
        and cm.added_by = 'self_request'
        and cm.profile_id is not null
        and (v_req_all or (cm.team_id is not null and cm.team_id = any (v_req_scope)))
    ) end as invites_incoming_count,

    case when 'invites_view' = any (v_caps) then (
      /* DAS-REV-19 §35: il pending canonico è ora l'Invitation, non una riga
         di organico in stato `pending`. Le proposte storiche sono state
         rispecchiate, quindi il numero non cambia per i dati esistenti e
         comincia a contare quelle nuove, che `club_members` non ha mai. */
      select count(*)::integer
      from public.club_member_invites inv
      where inv.club_id = p_club_id
        and inv.status = 'pending'
        and (
          v_inv_all
          or (inv.scope_type = 'team' and inv.team_id = any (v_inv_scope))
        )
    ) end as invites_pending_count,

    case when 'applications_view' = any (v_caps) then (
      select count(*)::integer
      from public.recruiting_applications app
      join public.recruiting_ads ra on ra.id = app.ad_id
      where ra.club_id = p_club_id
        and public.society_application_is_new(
          app.id, app.submission_revision, app.status, ra.status, v_uid
        )
        and (v_app_all or ra.team_id = any (v_app_scope))
    ) end as applications_to_handle_count,

    case when 'applications_view' = any (v_caps) then v_signals end
      as priority_signals,
    case when 'applications_view' = any (v_caps) then v_total end
      as priority_total_count,

    case when 'applications_view' = any (v_caps) then (
      select coalesce(jsonb_agg(item order by item->>'created_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',         app.id,
          'created_at', app.created_at,
          'status',     app.status,
          'ad_id',      ra.id,
          'ad_title',   ra.title,
          'role',       ra.role_required,
          'team_name',  ct.name,
          'name',       coalesce(nullif(trim(p.full_name), ''), 'Candidato'),
          'avatar_url', p.avatar_url
        ) as item
        from public.recruiting_applications app
        join public.recruiting_ads ra on ra.id = app.ad_id
        join public.profiles p on p.id = app.applicant_profile_id
        left join public.club_teams ct on ct.id = ra.team_id
        where ra.club_id = p_club_id
          and app.status <> 'withdrawn'
          and (v_app_all or ra.team_id = any (v_app_scope))
        order by app.created_at desc
        limit 3
      ) preview
    ) end as applications_preview,

    -- §15: ordinamento sportivo stabile — prima squadra, poi settore
    -- giovanile secondo `sort_order`. Nessun conteggio di giocatori o staff
    -- nel payload: un campo restituito è un campo che prima o poi qualcuno
    -- disegna, e §15 lo vieta.
    case when 'teams_view' = any (v_caps) then (
      select coalesce(jsonb_agg(item order by item->>'rank', item->>'name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',       ct.id,
          'name',     ct.name,
          'category', ct.category,
          'logo_url', ct.logo_url,
          'rank',     lpad((
            case when ct.team_type = 'senior' then 0 else 1 end * 100000
            + greatest(0, least(ct.sort_order, 99999))
          )::text, 6, '0')
        ) as item
        from public.club_teams ct
        where ct.club_id = p_club_id
          and not ct.is_archived
          and (v_team_all or ct.id = any (v_team_scope))
        order by
          case when ct.team_type = 'senior' then 0 else 1 end,
          ct.sort_order,
          ct.name
        limit 3
      ) preview
    ) end as teams_preview,

    case when 'content_view' = any (v_caps) and v_content_all then (
      select coalesce(jsonb_agg(item order by item->>'updated_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',            cmp.id,
          'title',         case when cmp.kind = 'post' then coalesce(nullif(left(btrim(cmp.body), 80), ''), 'Post') else cmp.title end,
          'kind',          cmp.kind,
          'status',        cmp.status,
          'thumbnail_url', coalesce(cmp.thumbnail_url, cmp.visual_url, (select coalesce(m.thumbnail_url, m.url) from public.content_post_media m where m.content_type = 'club_media' and m.post_id = cmp.id and m.position = 0)),
          'updated_at',    cmp.updated_at
        ) as item
        from public.club_media_posts cmp
        where cmp.club_id = p_club_id
          and cmp.status = 'draft'
        order by cmp.updated_at desc
        limit 3
      ) preview
    ) end as drafts_preview,

    case when 'content_view' = any (v_caps) and v_content_all then (
      select coalesce(jsonb_agg(item order by item->>'published_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',            cmp.id,
          'title',         case when cmp.kind = 'post' then coalesce(nullif(left(btrim(cmp.body), 80), ''), 'Post') else cmp.title end,
          'kind',          cmp.kind,
          'status',        cmp.status,
          'thumbnail_url', coalesce(cmp.thumbnail_url, cmp.visual_url, (select coalesce(m.thumbnail_url, m.url) from public.content_post_media m where m.content_type = 'club_media' and m.post_id = cmp.id and m.position = 0)),
          'published_at',  cmp.published_at
        ) as item
        from public.club_media_posts cmp
        where cmp.club_id = p_club_id
          and cmp.status = 'published'
          and cmp.published_at <= v_now
        order by cmp.published_at desc
        limit 3
      ) preview
    ) end as recent_content_preview,

    v_now as access_verified_at,
    (extract(epoch from v_now) * 1000)::bigint as data_revision;
end;
$$;

create or replace function public.fetch_society_profile_editor(
  p_club_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_club              public.clubs%rowtype;
  v_teams_count       integer;
  v_affiliates_count  integer;
  v_positions_count   integer;
  v_media_count       integer;
  v_has_first_team    boolean;
  v_has_youth_teams   boolean;
  v_first_team        jsonb;
begin
  if p_club_id is null or not public.can_manage_society(p_club_id) then
    return null;
  end if;

  select * into v_club from public.clubs where id = p_club_id;

  if not found then
    return null;
  end if;

  -- Squadre attive e pubbliche: la stessa regola del conteggio mostrato nel
  -- Master Profile, non un totale di comodo che includa le archiviate.
  select count(*) into v_teams_count
  from public.club_teams t
  where t.club_id = p_club_id and t.is_public and not t.is_archived;

  select
    bool_or(t.team_type = 'senior'),
    bool_or(t.team_type = 'youth')
  into v_has_first_team, v_has_youth_teams
  from public.club_teams t
  where t.club_id = p_club_id and not t.is_archived;

  select jsonb_build_object('id', t.id, 'name', t.name, 'category', t.category)
    into v_first_team
  from public.club_teams t
  where t.club_id = p_club_id
    and t.team_type = 'senior'
    and not t.is_archived
  order by t.sort_order
  limit 1;

  select count(distinct c.id) into v_affiliates_count
  from public.club_affiliations a
  join public.clubs c on c.id = a.affiliate_club_id
  where a.club_id = p_club_id and a.status = 'confirmed' and a.is_public;

  select count(*) into v_positions_count
  from public.recruiting_ads ad
  where ad.club_id = p_club_id
    and ad.status = 'published'
    and (ad.deadline is null or ad.deadline >= current_date);

  select count(*) into v_media_count
  from public.club_media_posts m
  where m.club_id = p_club_id and m.status = 'published' and m.kind <> 'post';

  return jsonb_build_object(
    'club', jsonb_build_object(
      'id',                   v_club.id,
      'name',                 v_club.name,
      'logo_url',             v_club.logo_url,
      'cover_url',            v_club.cover_url,
      'founding_year',        v_club.founding_year,
      'club_colors',          v_club.club_colors,
      'club_structure',       v_club.club_structure,
      'category',             v_club.category,
      'city',                 v_club.city,
      'province',             v_club.province,
      'region',               v_club.region,
      'country',              v_club.country,
      'headquarters_address', v_club.headquarters_address,
      'stadium',              v_club.stadium,
      'field_address',        v_club.field_address,
      'venue_address_same_as_headquarters', v_club.venue_address_same_as_headquarters,
      'description',          v_club.description,
      -- Valori sempre presenti: l'editor mostra anche ciò che è spento,
      -- altrimenti un contatto nascosto diventerebbe irrecuperabile.
      'club_email',           v_club.club_email,
      'club_phone',           v_club.club_phone,
      'website_url',          v_club.website_url,
      'instagram',            v_club.instagram,
      'facebook',             v_club.facebook,
      'show_club_email',      v_club.show_club_email,
      'show_club_phone',      v_club.show_club_phone,
      'show_website',         v_club.show_website,
      'show_instagram',       v_club.show_instagram,
      'show_facebook',        v_club.show_facebook,
      'verification_status',  v_club.verification_status,
      -- Chiave della concorrenza fra amministratori: il salvataggio la
      -- rimanda indietro e il database rifiuta se nel frattempo è cambiata.
      'updated_at',           v_club.updated_at
    ),
    'counts', jsonb_build_object(
      'teams',      coalesce(v_teams_count, 0),
      'affiliates', coalesce(v_affiliates_count, 0),
      'positions',  coalesce(v_positions_count, 0),
      'media',      coalesce(v_media_count, 0)
    ),
    'teams', jsonb_build_object(
      'has_first_team',   coalesce(v_has_first_team, false),
      'has_youth_teams',  coalesce(v_has_youth_teams, false),
      'first_team',       v_first_team
    )
  );
end;
$$;


-- ============================================================
-- SEZIONE 11 — search_tag_targets: is_verified (§102–§103, §183)
--
-- Il Tagga e l'autocomplete @mention mostrano il check di verifica accanto al
-- nome (§102 persona, §103 Società), ma la RPC non lo esponeva. Riemessa dalla
-- definizione più recente (20260620110000; 20260619100000 e 20260619110000 sono
-- precedenti, nessuna successiva la ridefinisce). Cambia UNA cosa: una colonna
-- OUT in coda, `is_verified`. Un cambio dell'elenco OUT non ammette
-- `create or replace`: drop + create, grant identici (execute ad authenticated,
-- niente anon). I chiamanti che leggono le colonne per nome non si accorgono
-- della colonna in più.
--   profili  → verifica del Media/Creator (media_profile_verifications,
--              profile_verified/verified: la fonte di fetch_dashboard_identities e
--              del Feed); persone false, come nel Feed;
--   Società  → verification_status = 'verified';
--   squadre  → false.
-- ============================================================

drop function if exists public.search_tag_targets(text, int);

create function public.search_tag_targets(
  p_query text,
  p_limit int default 20
)
returns table (
  target_type  text,
  target_id    uuid,
  display_name text,
  avatar_url   text,
  role_label   text,
  subtitle     text,
  is_verified  boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if length(trim(p_query)) < 2 then
    raise exception 'La ricerca richiede almeno 2 caratteri';
  end if;

  return query

    -- -------------------------------------------------------
    -- Profiles: player, coach, staff, director, media
    -- -------------------------------------------------------
    select
      'profile'::text                    as target_type,
      pwa.id                             as target_id,
      pwa.full_name                      as display_name,
      pwa.avatar_url                     as avatar_url,
      pwa.role::text                     as role_label,

      coalesce(
        case pwa.role::text

          -- ---- PLAYER ----------------------------------------
          when 'player' then (
            select
              case
                when nullif(trim(coalesce(ct.name, c.name, '')), '') is not null
                  and nullif(trim(pp.primary_position::text), '') is not null
                then
                  nullif(trim(coalesce(ct.name, c.name, '')), '')
                  || ' • '
                  || pp.primary_position::text

                when nullif(trim(coalesce(ct.name, c.name, '')), '') is not null
                then nullif(trim(coalesce(ct.name, c.name, '')), '')

                when nullif(trim(pp.primary_position::text), '') is not null
                then pp.primary_position::text

                else null
              end
            from public.player_profiles pp
            left join lateral (
              select cm.club_id, cm.team_id
              from public.club_members cm
              where cm.profile_id = pwa.id
                and cm.status     = 'active'
                and cm.is_current = true
              order by cm.created_at desc
              limit 1
            ) cm on true
            left join public.clubs      c  on c.id  = cm.club_id
            left join public.club_teams ct on ct.id = cm.team_id
            where pp.profile_id = pwa.id
          )

          -- ---- COACH -----------------------------------------
          when 'coach' then (
            select
              case
                when nullif(trim(coalesce(cp.current_club, '')), '') is not null
                  and nullif(trim(coalesce(cp.primary_role, '')), '') is not null
                then
                  nullif(trim(cp.current_club), '')
                  || ' • '
                  || nullif(trim(cp.primary_role), '')

                when nullif(trim(coalesce(cp.current_club, '')), '') is not null
                then nullif(trim(cp.current_club), '')

                when nullif(trim(coalesce(cp.primary_role, '')), '') is not null
                then nullif(trim(cp.primary_role), '')

                else null
              end
            from public.coach_profiles cp
            where cp.profile_id = pwa.id
          )

          -- ---- STAFF -----------------------------------------
          when 'staff' then (
            select
              case
                when nullif(trim(coalesce(c.name, '')), '') is not null
                  and nullif(trim(coalesce(sp.primary_staff_role, '')), '') is not null
                then
                  nullif(trim(c.name), '')
                  || ' • '
                  || nullif(trim(sp.primary_staff_role), '')

                when nullif(trim(coalesce(c.name, '')), '') is not null
                then nullif(trim(c.name), '')

                when nullif(trim(coalesce(sp.primary_staff_role, '')), '') is not null
                then nullif(trim(sp.primary_staff_role), '')

                else null
              end
            from public.staff_profiles sp
            left join lateral (
              select cm.club_id
              from public.club_members cm
              where cm.profile_id = pwa.id
                and cm.status     = 'active'
                and cm.is_current = true
              order by cm.created_at desc
              limit 1
            ) cm on true
            left join public.clubs c on c.id = cm.club_id
            where sp.profile_id = pwa.id
          )

          -- ---- DIRECTOR --------------------------------------
          when 'director' then (
            select
              case
                when nullif(trim(coalesce(c.name, '')), '') is not null
                  and nullif(trim(coalesce(dp.primary_role, '')), '') is not null
                then
                  nullif(trim(c.name), '')
                  || ' • '
                  || nullif(trim(dp.primary_role), '')

                when nullif(trim(coalesce(c.name, '')), '') is not null
                then nullif(trim(c.name), '')

                when nullif(trim(coalesce(dp.primary_role, '')), '') is not null
                then nullif(trim(dp.primary_role), '')

                else null
              end
            from public.director_profiles dp
            left join lateral (
              select cm.club_id
              from public.club_members cm
              where cm.profile_id = pwa.id
                and cm.status     = 'active'
                and cm.is_current = true
              order by cm.created_at desc
              limit 1
            ) cm on true
            left join public.clubs c on c.id = cm.club_id
            where dp.profile_id = pwa.id
          )

          else null
        end,
        -- Final fallback: city
        pwa.city
      , ''
      )                                  as subtitle,

      -- Stessa fonte di fetch_dashboard_identities e del Feed: solo il
      -- Media/Creator ha una verifica (media_profile_verifications); le
      -- persone no.
      (pwa.role::text = 'media' and exists (
         select 1 from public.media_profile_verifications mv
         where mv.media_profile_id = pwa.id
           and mv.verification_type = 'profile_verified'
           and mv.status = 'verified'
       ))                                 as is_verified

    from public.profiles_with_age pwa
    where pwa.role in ('player', 'coach', 'staff', 'director', 'media')
      and pwa.full_name ilike '%' || trim(p_query) || '%'

    union all

    -- -------------------------------------------------------
    -- Clubs
    -- -------------------------------------------------------
    select
      'club'::text,
      c.id,
      c.name,
      c.logo_url,
      'club'::text,
      coalesce(c.city, '') as subtitle,
      (c.verification_status = 'verified') as is_verified
    from public.clubs c
    where c.name ilike '%' || trim(p_query) || '%'

    union all

    -- -------------------------------------------------------
    -- Club teams (squadre interne)
    -- -------------------------------------------------------
    select
      'team'::text,
      ct.id,
      ct.name,
      ct.logo_url,
      'team'::text,
      coalesce(ct.category, ct.city, '') as subtitle,
      false as is_verified
    from public.club_teams ct
    where ct.name ilike '%' || trim(p_query) || '%'

    order by display_name
    limit p_limit;
end;
$$;

revoke all on function public.search_tag_targets(text, int) from public;
revoke execute on function public.search_tag_targets(text, int) from anon;
grant execute on function public.search_tag_targets(text, int) to authenticated;
