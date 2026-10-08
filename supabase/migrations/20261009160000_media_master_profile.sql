-- ============================================================
-- REV-PROF-21 — Master Profile Media/Creator
--
-- Tre cose mancavano al profilo Media/Creator perché le quattro tab del
-- Master Profile potessero esistere senza inventare un secondo dominio:
--
--   1. una casa per foto e video pubblicati dalla redazione. Le superfici
--      contenuto del Media/Creator sono due — `media_profile_posts` (articoli
--      e news) e `media_tribuna_posts` (sondaggi, dibattiti, vota il
--      migliore, Q&A) — e nessuna delle due ospita un contenuto visivo
--      autonomo. La tab Media non può quindi mostrare articoli con una
--      copertina video: sarebbero articoli, e la task vieta di duplicarli.
--      La soluzione è un terzo `kind` sulla tabella che già esiste: stesso
--      detail, stessi commenti, stessi salvataggi, stessi tag, stessa RLS.
--      Nessuna riga esistente viene riclassificata, quindi nessun articolo
--      si sposta nella tab Media e nessuna foto finisce negli Articoli.
--
--   2. l'esclusione server-side dei contenuti programmati. La policy di
--      lettura pubblica si fermava a `status = 'published'`, e un
--      `published_at` nel futuro — il caso della pubblicazione programmata
--      di HOM-06.2 — restava visibile a tutti. Ora il predicato è completo:
--      il client non è l'unica barriera, come la task richiede.
--
--   3. un serializer pubblico con capabilities calcolate dal backend. Il
--      profilo oggi viene letto a colonne sparse da sei query del client, che
--      per riempire i buchi ricadeva sui dati personali del proprietario —
--      nome, città, regione, avatar. La RPC qui sotto proietta esplicitamente
--      i soli dati editoriali pubblicabili: ciò che non è elencato non può
--      raggiungere il client, nemmeno per distrazione.
--
-- La RPC è `security invoker` — come quelle della Società
-- (20261008090000_society_master_profile.sql) e non come quella del Tifoso
-- (20261008160000_fan_master_profile.sql): `media_profiles` ha una policy di
-- lettura `to authenticated`, e `media_profile_channels` filtra già per
-- `is_public or owner`. Sotto INVOKER quei filtri restano quelli di chi
-- guarda, che è esattamente il comportamento voluto. L'unica eccezione è
-- `profile_contacts`, owner-only: i canali dichiarati pubblici passano da
-- `get_profile_public_contacts`, che è SECURITY DEFINER e applica i flag
-- `show_*` nel database.
--
-- Migrazione non distruttiva: nessun dato viene cancellato, spostato o
-- riscritto. Cambia solo che cosa è leggibile e da chi.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — media_profile_posts: il terzo kind
-- ============================================================
-- 'media' = un contenuto visivo autonomo della redazione (foto o video),
-- senza corpo editoriale. Il tipo del media sta già in `cover_type`, che il
-- modulo Media condiviso sa leggere: non serve una colonna nuova.

alter table public.media_profile_posts
  drop constraint if exists media_profile_posts_kind_check;

alter table public.media_profile_posts
  add constraint media_profile_posts_kind_check
  check (kind in ('article', 'news', 'media'));

comment on column public.media_profile_posts.kind is
  'REV-PROF-21: article | news -> tab Articoli; media -> tab Media (foto e '
  'video della redazione). Nessuna riga esistente e stata riclassificata.';

-- Un contenuto 'media' non ha un corpo da leggere: il titolo resta
-- obbligatorio (vincolo preesistente) e fa da caption accessibile, la
-- copertina è il contenuto. Serve quindi che la copertina ci sia davvero,
-- altrimenti la griglia mostrerebbe una cella vuota.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'media_profile_posts_media_cover_check'
  ) then
    alter table public.media_profile_posts
      add constraint media_profile_posts_media_cover_check
      check (
        kind <> 'media'
        or (cover_url is not null and length(trim(cover_url)) > 0)
      );
  end if;
end $$;

-- Pagination della tab Articoli e della tab Media: le due liste leggono la
-- stessa tabella filtrando su `kind`, e il filtro categoria si applica solo
-- agli Articoli. Un indice per ciascuna lettura, non uno generico.
create index if not exists media_profile_posts_kind_published_idx
  on public.media_profile_posts (media_profile_id, kind, status, published_at desc);

create index if not exists media_profile_posts_category_published_idx
  on public.media_profile_posts (media_profile_id, category, status, published_at desc)
  where kind in ('article', 'news');

-- CER-05 indicizza i contenuti Media/Creator con l'etichetta italiana del
-- loro `kind`. Senza questo caso un contenuto Media resterebbe cercabile ma
-- senza il token di tipo, e una query come "foto TuttoDilettanti" non lo
-- troverebbe per tipo. Il resto della funzione è invariato.
create or replace function public.footme_content_kind_label(
  p_content_type text,
  p_kind         text
)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_content_type
    when 'club_media' then case p_kind
      when 'highlights' then 'Highlights'
      when 'interview'  then 'Intervista'
      when 'market'     then 'Mercato'
      when 'statement'  then 'Comunicato'
      when 'training'   then 'Allenamento'
      when 'event'      then 'Evento'
      else null end
    when 'media_profile' then case p_kind
      when 'article' then 'Articolo'
      when 'news'    then 'News'
      -- REV-PROF-21: contenuto visivo della redazione.
      when 'media'   then 'Foto / Video'
      else null end
    when 'fan_tribuna' then case p_kind
      when 'poll'      then 'Sondaggio'
      when 'proposal'  then 'Proposta'
      when 'formation' then 'Formazione'
      when 'opinion'   then 'Opinione'
      when 'photo'     then 'Foto'
      else null end
    when 'media_tribuna' then case p_kind
      when 'editorial_poll' then 'Sondaggio editoriale'
      when 'article_debate' then 'Dibattito'
      when 'player_vote'    then 'Votazione'
      when 'community_qa'   then 'Domande e risposte'
      else null end
    else null
  end;
$$;


-- ============================================================
-- SEZIONE 2 — contenuti programmati fuori dal profilo pubblico
-- ============================================================
-- `published_at` ha default `now()` e non è nullable: tutte le righe
-- esistenti soddisfano già il predicato, quindi nessun contenuto oggi
-- visibile smette di esserlo. Cambia solo il futuro: un articolo datato
-- domani non è pubblico oggi.
--
-- La policy owner ("media owners manage own profile posts", for all) resta
-- invariata: bozze e programmati restano leggibili da chi li ha scritti,
-- perché è il dominio di gestione — HOM-06.2 — a doverli mostrare.

drop policy if exists "published media profile posts readable by authenticated users"
  on public.media_profile_posts;

create policy "published media profile posts readable by authenticated users"
on public.media_profile_posts
for select
to authenticated
using (
  status = 'published'
  and published_at <= timezone('utc', now())
);

-- Tag e commenti seguono la visibilità del contenuto a cui appartengono: se
-- il post non è pubblico, nemmeno i suoi tag e i suoi commenti lo sono.

drop policy if exists "published media profile tags readable by authenticated users"
  on public.media_profile_post_tagged_targets;

create policy "published media profile tags readable by authenticated users"
on public.media_profile_post_tagged_targets
for select
to authenticated
using (
  exists (
    select 1
    from public.media_profile_posts post
    where post.id = post_id
      and post.status = 'published'
      and post.published_at <= timezone('utc', now())
  )
);

drop policy if exists "published media profile comments readable by authenticated users"
  on public.media_profile_post_comments;

create policy "published media profile comments readable by authenticated users"
on public.media_profile_post_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.media_profile_posts post
    where post.id = post_id
      and post.status = 'published'
      and post.published_at <= timezone('utc', now())
  )
);

-- Stessa regola per la Tribuna: un sondaggio programmato non è ancora
-- aperto, e non deve comparire nella tab di chi guarda.

drop policy if exists "published media tribuna readable by authenticated users"
  on public.media_tribuna_posts;

create policy "published media tribuna readable by authenticated users"
on public.media_tribuna_posts
for select
to authenticated
using (
  status = 'published'
  and published_at <= timezone('utc', now())
);


-- ============================================================
-- SEZIONE 3 — RPC: serializer pubblico del Master Profile
--
-- Una sola riga jsonb con due blocchi:
--
--   entity — identità editoriale pubblicabile. Proiezione esplicita:
--            nome, descrittore, descrizione, logo, cover, ambiti, tipi di
--            contenuto, aree, canali, sito.
--   viewer — modalità e capabilities calcolate qui, non dedotte dal client.
--
-- Non restituisce, per costruzione: nome e cognome del proprietario, data di
-- nascita, nazionalità, città e regione di residenza, telefono, email,
-- avatar personale, ruoli interni, bozze, programmati.
--
-- jsonb e non `returns table`: una colonna OUT che si chiama come una
-- colonna di tabella diventa ambigua dentro la funzione, ed è un errore che
-- si manifesta solo a runtime.
-- ============================================================

create or replace function public.fetch_public_media_profile(
  p_profile_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_profile      record;
  v_media        record;
  v_is_owner     boolean;
  v_is_blocked   boolean;
  v_channels     jsonb;
  v_website      text;
  v_contacts     record;
begin
  if p_profile_id is null then
    return null;
  end if;

  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select p.id, p.role, p.cover_url
    into v_profile
  from public.profiles p
  where p.id = p_profile_id;

  -- Profilo inesistente o di un altro ruolo: nessun payload, non un payload
  -- vuoto. La schermata distingue i due casi.
  if not found or v_profile.role <> 'media' then
    return null;
  end if;

  v_is_owner := v_uid = p_profile_id;

  -- Un blocco in una qualsiasi delle due direzioni rende il profilo non
  -- disponibile, come ovunque nell'app.
  v_is_blocked := not v_is_owner and exists (
    select 1
    from public.user_blocks block
    where (block.blocker_profile_id = v_uid
           and block.blocked_profile_id = p_profile_id)
       or (block.blocker_profile_id = p_profile_id
           and block.blocked_profile_id = v_uid)
  );

  if v_is_blocked then
    return null;
  end if;

  select
    m.entity_name,
    m.short_description,
    m.logo_url,
    m.creator_type,
    m.creator_type_other,
    m.editorial_type,
    m.affiliation_type,
    m.verification_status,
    coalesce(m.focus_areas, '{}'::text[])          as focus_areas,
    coalesce(m.content_types, '{}'::text[])        as content_types,
    coalesce(m.covered_territories, '{}'::text[])  as covered_territories,
    coalesce(m.covered_competitions, '{}'::text[]) as covered_competitions,
    coalesce(m.covered_teams, '{}'::text[])        as covered_teams,
    coalesce(m.covered_topics, '{}'::text[])       as covered_topics
    into v_media
  from public.media_profiles m
  where m.profile_id = p_profile_id;

  -- I canali dichiarati pubblici dall'onboarding (REV-ONB-09) vivono su
  -- `profile_contacts`, owner-only: passano da qui, che applica `show_*` nel
  -- database. Email e telefono esistono in quel payload e non vengono letti:
  -- non sono canali editoriali.
  select c.instagram, c.facebook, c.tiktok, c.youtube, c.website
    into v_contacts
  from public.get_profile_public_contacts(p_profile_id) c;

  -- `media_profile_channels` è la superficie storica, non più alimentata
  -- dall'onboarding ma viva sui profili più vecchi. Le due sorgenti si
  -- uniscono deduplicando per tipo, con la tabella dedicata che vince: se un
  -- canale è stato configurato lì, è quello il valore curato.
  with legacy as (
    select
      ch.channel_type,
      nullif(trim(ch.label), '') as label,
      trim(ch.url)               as url,
      ch.sort_order
    from public.media_profile_channels ch
    where ch.media_profile_id = p_profile_id
      and ch.is_public
      and trim(ch.url) <> ''
  ),
  onboarding as (
    select * from (
      values
        ('website',   nullif(trim(v_contacts.website), ''),   0),
        ('instagram', nullif(trim(v_contacts.instagram), ''), 1),
        ('youtube',   nullif(trim(v_contacts.youtube), ''),   2),
        ('tiktok',    nullif(trim(v_contacts.tiktok), ''),    3),
        ('facebook',  nullif(trim(v_contacts.facebook), ''),  4)
    ) as t(channel_type, url, sort_order)
    where url is not null
  ),
  merged as (
    select channel_type, label, url, sort_order, 0 as source_rank from legacy
    union all
    select channel_type, null, url, sort_order, 1 from onboarding
  ),
  deduplicated as (
    select distinct on (channel_type)
      channel_type, label, url, sort_order
    from merged
    order by channel_type, source_rank, sort_order
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'channel_type', channel_type,
        'label',        label,
        'url',          url
      )
      order by sort_order, channel_type
    ),
    '[]'::jsonb
  )
    into v_channels
  from deduplicated;

  -- "Visita sito" esiste solo con un sito davvero pubblicabile. La
  -- normalizzazione e il controllo del protocollo restano al client, che
  -- apre il link; qui si decide soltanto se il dato è pubblico.
  select url into v_website
  from jsonb_to_recordset(v_channels) as c(channel_type text, url text)
  where c.channel_type = 'website'
  limit 1;

  return jsonb_build_object(
    'entity', jsonb_build_object(
      'profile_id',           p_profile_id,
      -- Nessun fallback sul nome del proprietario: un profilo editoriale
      -- senza nome editoriale resta senza nome, e lo completa in REV-PROF-22.
      'entity_name',          nullif(trim(coalesce(v_media.entity_name, '')), ''),
      'short_description',    nullif(trim(coalesce(v_media.short_description, '')), ''),
      'logo_url',             nullif(trim(coalesce(v_media.logo_url, '')), ''),
      'cover_url',            nullif(trim(coalesce(v_profile.cover_url, '')), ''),
      'creator_type',         v_media.creator_type,
      'creator_type_other',   nullif(trim(coalesce(v_media.creator_type_other, '')), ''),
      'editorial_type',       nullif(trim(coalesce(v_media.editorial_type, '')), ''),
      'affiliation_type',     nullif(trim(coalesce(v_media.affiliation_type, '')), ''),
      'verification_status',  coalesce(v_media.verification_status, 'unverified'),
      'focus_areas',          to_jsonb(coalesce(v_media.focus_areas, '{}'::text[])),
      'content_types',        to_jsonb(coalesce(v_media.content_types, '{}'::text[])),
      'covered_territories',  to_jsonb(coalesce(v_media.covered_territories, '{}'::text[])),
      'covered_competitions', to_jsonb(coalesce(v_media.covered_competitions, '{}'::text[])),
      'covered_teams',        to_jsonb(coalesce(v_media.covered_teams, '{}'::text[])),
      'covered_topics',       to_jsonb(coalesce(v_media.covered_topics, '{}'::text[])),
      'channels',             coalesce(v_channels, '[]'::jsonb),
      'website_url',          v_website
    ),
    'viewer', jsonb_build_object(
      'mode', case when v_is_owner then 'owner' else 'visitor' end,
      -- Una sola realtà editoriale per account nel modello attuale: essere
      -- il proprietario è l'unica autorizzazione possibile. I nomi restano
      -- granulari perché il giorno in cui esisteranno collaboratori la
      -- superficie non cambia, cambia solo il calcolo qui dentro.
      'can_edit_profile',            v_is_owner,
      'can_publish_article',         v_is_owner,
      'can_create_tribuna_content',  v_is_owner,
      'can_manage_tribuna_content',  v_is_owner,
      'can_add_media',               v_is_owner,
      'can_follow',                  not v_is_owner,
      'can_message',                 not v_is_owner,
      'can_share',                   true,
      'can_report',                  not v_is_owner,
      'can_block',                   not v_is_owner,
      'can_view_website',            v_website is not null,
      'is_following', not v_is_owner and exists (
        select 1
        from public.profile_follows f
        where f.followed_profile_id = p_profile_id
          and f.follower_profile_id = v_uid
      )
    )
  );
end;
$$;

comment on function public.fetch_public_media_profile(uuid) is
  'REV-PROF-21: payload pubblico + capabilities del Master Profile '
  'Media/Creator. Proiezione esplicita: nessun dato personale del '
  'proprietario puo uscire da qui.';

revoke all on function public.fetch_public_media_profile(uuid) from public;
grant execute on function public.fetch_public_media_profile(uuid) to authenticated;


-- ============================================================
-- SEZIONE 4 — RPC: categorie dei filtri Articoli
--
-- I chip della tab Articoli non possono essere una lista scritta nel client:
-- la task vieta i filtri hardcodati. Non esiste però una tabella di
-- configurazione delle categorie editoriali, quindi la tassonomia reale è
-- quella degli articoli effettivamente pubblicati da questa realtà. Una
-- aggregazione, non una pagina: il client non deve scaricare tutti gli
-- articoli per sapere quali categorie esistono.
-- ============================================================

create or replace function public.fetch_media_profile_article_categories(
  p_profile_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('category', category, 'article_count', article_count)
      order by article_count desc, category
    ),
    '[]'::jsonb
  )
  from (
    select
      trim(post.category)  as category,
      count(*)::int        as article_count
    from public.media_profile_posts post
    where post.media_profile_id = p_profile_id
      and post.kind in ('article', 'news')
      and post.status = 'published'
      and post.published_at <= timezone('utc', now())
      and trim(post.category) <> ''
    group by trim(post.category)
  ) counted;
$$;

comment on function public.fetch_media_profile_article_categories(uuid) is
  'REV-PROF-21: categorie realmente presenti fra gli articoli pubblicati di '
  'una realta editoriale. Sorgente dei chip filtro, al posto di una lista '
  'hardcodata nel client.';

revoke all on function public.fetch_media_profile_article_categories(uuid) from public;
grant execute on function public.fetch_media_profile_article_categories(uuid) to authenticated;


-- ============================================================
-- SEZIONE 5 — media_content_index: il formato di un contenuto Media
--
-- La vista di CER-05 assegna `content_format = 'articolo'` a ogni riga di
-- `media_profile_posts`, perché finora quella tabella conteneva solo
-- contenuti editoriali. Con il terzo `kind` una foto della redazione
-- risulterebbe un articolo nella ricerca: il formato ora si deriva, per i
-- soli contenuti Media, dal tipo di copertina — la stessa regola che la
-- vista già applica a `club_media_posts` e a `fan_media_posts`.
--
-- Il resto della definizione è identico a quello di
-- 20260726100000_media_search_foundation.sql: `create or replace view` non
-- consente di sostituire una sola espressione, quindi la definizione viene
-- ripetuta per intero con quell'unica differenza.
-- ============================================================

create or replace view public.media_content_index as
with base as (

  -- ── club_media_posts (contenuto ufficiale di una società) ───────
  select
    'club_media'::text                                      as content_type,
    cmp.id                                                  as post_id,
    case
      when cmp.visual_type = 'video'                            then 'video'
      when cmp.visual_type = 'image' and cmp.body is null       then 'foto'
      when length(coalesce(cmp.body, '')) >= 400                then 'articolo'
      else 'post'
    end                                                     as content_format,
    cmp.kind                                                as kind,
    cmp.title                                               as title,
    cmp.excerpt                                             as excerpt,
    cmp.body                                                as body,
    coalesce(cmp.thumbnail_url, cmp.visual_url)             as thumbnail_url,
    cmp.visual_type                                         as media_type,
    cmp.video_duration_seconds                              as duration_seconds,
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
  where cmp.status = 'published'

  union all

  -- ── media_profile_posts (contenuto editoriale) ──────────────────
  select
    'media_profile'::text,
    mpp.id,
    (case
      when mpp.kind = 'media' and mpp.cover_type = 'video' then 'video'
      when mpp.kind = 'media'                            then 'foto'
      else 'articolo'
    end)::text,
    mpp.kind,
    mpp.title,
    coalesce(mpp.excerpt, mpp.subtitle),
    mpp.body,
    mpp.cover_url,
    mpp.cover_type,
    null::int,
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




-- ============================================================
-- SEZIONE 6 — feed_content_index: stessa correzione, altra vista
--
-- HOME-01 ha una vista sorella con la stessa classificazione hardcodata
-- (20260727100000_home_feed_foundation.sql §1). Senza questa correzione una
-- foto della redazione entrerebbe nel Feed con il componente "articolo"
-- invece di "post": `footme_feed_item_type` collassa già 'foto' e 'post' sul
-- componente Post, quindi basta che il formato sia corretto all'origine.
--
-- Anche qui l'unica differenza rispetto alla definizione originale è
-- l'espressione di `content_format`.
-- ============================================================

create or replace view public.feed_content_index as

  -- ── club_media_posts (contenuto ufficiale di una società) ──────
  select
    'club_media'::text                                      as content_type,
    cmp.id                                                  as post_id,
    case
      when cmp.visual_type = 'video'                            then 'video'
      when cmp.visual_type = 'image' and cmp.body is null       then 'foto'
      when length(coalesce(cmp.body, '')) >= 400                then 'articolo'
      else 'post'
    end                                                     as content_format,
    cmp.kind                                                as kind,
    cmp.title                                               as title,
    coalesce(cmp.excerpt, cmp.body)                         as excerpt,
    coalesce(cmp.thumbnail_url, cmp.visual_url)             as thumbnail_url,
    cmp.visual_type                                         as media_type,
    cmp.video_duration_seconds                              as duration_seconds,
    'club'::text                                            as publisher_type,
    cmp.club_id                                             as publisher_id,
    c.name                                                  as publisher_name,
    c.logo_url                                              as publisher_avatar_url,
    'ufficiale'::text                                       as source_kind,
    cmp.interviewee_name                                    as author_name,
    cmp.published_at                                        as published_at,
    c.region                                                as publisher_region,
    (c.verification_status = 'verified')                    as publisher_is_verified
  from public.club_media_posts cmp
  join public.clubs c on c.id = cmp.club_id
  where cmp.status = 'published'
    and cmp.published_at is not null

  union all

  -- ── media_profile_posts (contenuto editoriale) ──────────────────
  select
    'media_profile'::text,
    mpp.id,
    (case
      when mpp.kind = 'media' and mpp.cover_type = 'video' then 'video'
      when mpp.kind = 'media'                            then 'foto'
      else 'articolo'
    end)::text,
    mpp.kind,
    mpp.title,
    coalesce(mpp.excerpt, mpp.subtitle),
    mpp.cover_url,
    mpp.cover_type,
    null::int,
    'profile'::text,
    mpp.media_profile_id,
    coalesce(mp.entity_name, p.full_name),
    coalesce(mp.logo_url, p.avatar_url),
    coalesce(mp.media_kind, 'pagina'),
    mpp.author_name,
    mpp.published_at,
    p.region,
    (mp.verification_status = 'verified')
  from public.media_profile_posts mpp
  join public.media_profiles mp on mp.profile_id = mpp.media_profile_id
  join public.profiles p        on p.id = mpp.media_profile_id
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
    (mp.verification_status = 'verified')
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
    false
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
    false
  from public.fan_media_posts fmp
  join public.profiles p on p.id = fmp.profile_id
  where fmp.status = 'published'
    and fmp.published_at is not null;

-- La vista resta non leggibile direttamente: le RPC del Feed sono
-- SECURITY DEFINER e la interrogano al posto del client.
revoke all on table public.feed_content_index from anon, authenticated;
