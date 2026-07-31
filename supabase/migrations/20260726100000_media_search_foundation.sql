-- ============================================================
-- CER-05 — Cerca > Media e contenuti: fondamenta di ricerca
--
-- Questa migrazione NON aggiunge RPC: prepara solo i dati che la ricerca
-- consuma (20260726110000_media_search_rpcs.sql).
--
-- Schema sources reused (verified against the actual migrations before
-- writing this file):
--   20260514001000_club_media_posts.sql        club_media_posts (+likes/comments/tags)
--   20260515020000_fan_community_profile.sql   fan_media_posts (+likes/comments), profile_follows
--   20260515030000_fan_tribuna_posts.sql       fan_tribuna_posts (+votes/comments/tags)
--   20260519090000_media_profile_posts.sql     media_profile_posts (+comments/tags)
--   20260519100000_media_tribuna_posts.sql     media_tribuna_posts (+votes/comments)
--   20260529120000_media_profile_info.sql      media_profiles.editorial_type, covered_*
--   20260619100000_content_tag_states_...sql   tag target_type/target_id/status
--   20260620100000_fan_tribuna_polymorphic...  fan_tribuna media_url/media_type/thumbnail_url
--   20260725100000_comuni_geo.sql              footme_normalize_lookup(), clubs/club_teams.province
--
-- Il progetto non ha una tabella contenuti unificata: i contenuti vivono in
-- 5 tabelle distinte. La ricerca ha bisogno di una superficie sola, quindi
-- qui vengono create viste di sola lettura che le uniscono e ne derivano i
-- dati strutturati (formato, categoria, territorio, tag, engagement).
--
-- DATO DERIVATO, NON AUTORIALE: nessuna tabella contenuto ha città /
-- provincia / regione né categoria calcistica. Categoria e territorio
-- vengono quindi derivati da chi pubblica (clubs.category/province/region/
-- city, profiles.region/city, media_profiles.covered_*) e dalle entità
-- taggate nel contenuto. Conseguenza nota: un contenuto pubblicato da un
-- profilo senza regione e senza club/squadra taggata non è filtrabile per
-- zona. Si risolverà quando la creazione contenuti (fuori dallo scope di
-- CER-05) esporrà i campi in modo esplicito.
--
-- LIMITE DI PERFORMANCE DELIBERATO: `search_blob` è calcolato nella vista e
-- quindi non indicizzabile — il matching a token fa seq scan sulle 5
-- tabelle. È coerente con l'`ilike '%term%'` già usato da search_global /
-- search_profiles_page e accettabile al volume attuale. Gli indici trigram
-- creati qui sotto servono al ranking per similarità sul titolo. Se il
-- volume dei contenuti cresce, il passo successivo è materializzare
-- media_content_index in tabella con trigger di refresh sui 5 post table.
-- ============================================================


-- ============================================================
-- SECTION 1: media_profiles.media_kind
--
-- `editorial_type` è testo libero senza check (es. "Testata giornalistica /
-- Media sportivo"), inutilizzabile come filtro. CER-05 §12/§18 richiede una
-- tipologia strutturata: testata | giornalista | creator | pagina |
-- ufficiale. La colonna resta nullable e senza UI di selezione in questa
-- task: i profili esistenti vengono backfillati dall'euristica sotto, i
-- nuovi ricadono sul fallback finché l'onboarding Media non esporrà il campo.
-- ============================================================

create or replace function public.footme_media_kind_from_text(
  p_editorial_type  text,
  p_affiliation_type text
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when n like '%giornalist%' and n not like '%testata%' then 'giornalista'
    when n like '%creator%' or n like '%influencer%' or n like '%youtub%'
      or n like '%tiktok%' or n like '%podcast%'                        then 'creator'
    when n like '%testata%' or n like '%quotidian%' or n like '%redazion%'
      or n like '%magazine%' or n like '%emittent%' or n like '%radio%'
      or n like '%giornale%' or n like '%tv%'                          then 'testata'
    else 'pagina'
  end
  from (
    select public.footme_normalize_lookup(
      coalesce(nullif(trim(coalesce(p_editorial_type, '')), ''), p_affiliation_type, '')
    ) as n
  ) s;
$$;

comment on function public.footme_media_kind_from_text(text, text) is
  'CER-05: euristica testo libero -> tipologia fonte. Fallback ''pagina''.';

alter table public.media_profiles
  add column if not exists media_kind text;

update public.media_profiles
set media_kind = public.footme_media_kind_from_text(editorial_type, affiliation_type)
where media_kind is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'media_profiles_media_kind_check'
  ) then
    alter table public.media_profiles
      add constraint media_profiles_media_kind_check
      check (
        media_kind is null
        or media_kind in ('testata', 'giornalista', 'creator', 'pagina', 'ufficiale')
      );
  end if;
end $$;


-- ============================================================
-- SECTION 2: helper immutabili condivisi
-- ============================================================

-- Deduplica/normalizza un array di testo: scarta null e stringhe vuote,
-- ordina, rimuove i duplicati. Usato per unire i facet del publisher con
-- quelli delle entità taggate senza ripetizioni.
create or replace function public.footme_text_array_clean(p_values text[])
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(distinct trim(v) order by trim(v)), '{}'::text[])
  from unnest(coalesce(p_values, '{}'::text[])) as v
  where v is not null and length(trim(v)) > 0;
$$;

-- Etichetta italiana del `kind` nativo di ogni tabella contenuto. Entra nel
-- search_blob così che query come "Intervista allenatore" o "Highlights
-- Eccellenza" matchino anche quando il kind in colonna è in inglese.
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
-- SECTION 3: indici
--
-- Nessun indice esisteva su titolo/testo dei contenuti. I GIN trigram
-- servono a similarity() nel ranking; i btree (status, published_at) al
-- sort "Più recenti" e al filtro status = 'published'.
-- ============================================================

create index if not exists club_media_posts_title_trgm_idx
  on public.club_media_posts using gin (title gin_trgm_ops);
create index if not exists media_profile_posts_title_trgm_idx
  on public.media_profile_posts using gin (title gin_trgm_ops);
create index if not exists fan_tribuna_posts_title_trgm_idx
  on public.fan_tribuna_posts using gin (title gin_trgm_ops);
create index if not exists media_tribuna_posts_title_trgm_idx
  on public.media_tribuna_posts using gin (title gin_trgm_ops);
-- fan_media_posts non ha `title`: l'anteprima usa `description`.
create index if not exists fan_media_posts_description_trgm_idx
  on public.fan_media_posts using gin (description gin_trgm_ops);

create index if not exists club_media_posts_status_published_idx
  on public.club_media_posts (status, published_at desc);
create index if not exists media_profile_posts_status_published_idx
  on public.media_profile_posts (status, published_at desc);
create index if not exists fan_tribuna_posts_status_published_idx
  on public.fan_tribuna_posts (status, published_at desc);
create index if not exists media_tribuna_posts_status_published_idx
  on public.media_tribuna_posts (status, published_at desc);
create index if not exists fan_media_posts_status_published_idx
  on public.fan_media_posts (status, published_at desc);


-- ============================================================
-- SECTION 4: viste di supporto (tag, engagement)
--
-- Drop in ordine inverso di dipendenza: le viste sono nuove, il drop serve
-- solo a rendere la migrazione rieseguibile in locale.
-- ============================================================

drop view if exists public.media_content_index cascade;
drop view if exists public.media_source_index cascade;
drop view if exists public.media_content_tag_agg cascade;
drop view if exists public.media_content_tag_facets cascade;
drop view if exists public.media_content_tags cascade;
drop view if exists public.media_content_engagement cascade;


-- I tag polimorfi vivono in 3 tabelle separate (media_tribuna_posts e
-- fan_media_posts non sono taggabili). Le righe legacy hanno target_id null
-- e il solo id profilo nella colonna storica, da cui il coalesce.
create view public.media_content_tags as
  select
    'club_media'::text                        as content_type,
    t.post_id                                 as post_id,
    t.target_type                             as target_type,
    coalesce(t.target_id, t.profile_id)       as target_id
  from public.club_media_tagged_profiles t
  where t.status = 'active'
    and coalesce(t.target_id, t.profile_id) is not null

  union all

  select
    'media_profile'::text,
    t.post_id,
    t.target_type,
    t.target_id
  from public.media_profile_post_tagged_targets t
  where t.status = 'active'

  union all

  select
    'fan_tribuna'::text,
    t.post_id,
    t.target_type,
    coalesce(t.target_id, t.player_profile_id)
  from public.fan_tribuna_tagged_players t
  where t.status = 'active'
    and coalesce(t.target_id, t.player_profile_id) is not null;


-- Risolve ogni tag nei suoi attributi ricercabili. Club e squadre portano
-- categoria + provincia (gli unici dati geografici strutturati del progetto),
-- i profili portano regione/città.
create view public.media_content_tag_facets as
  select
    ct.content_type,
    ct.post_id,
    ct.target_type,
    ct.target_id,
    case ct.target_type
      when 'club' then c.name
      when 'team' then ctm.name
      else p.full_name
    end as target_name,
    case ct.target_type
      when 'club' then c.category
      when 'team' then ctm.category
      else null
    end as target_category,
    case ct.target_type
      when 'club' then c.region
      when 'team' then ctm.region
      else p.region
    end as target_region,
    case ct.target_type
      when 'club' then c.province
      when 'team' then ctm.province
      else null
    end as target_province,
    case ct.target_type
      when 'club' then c.city
      when 'team' then ctm.city
      else p.city
    end as target_city
  from public.media_content_tags ct
  left join public.clubs c        on ct.target_type = 'club'    and c.id = ct.target_id
  left join public.club_teams ctm on ct.target_type = 'team'    and ctm.id = ct.target_id
  left join public.profiles p     on ct.target_type = 'profile' and p.id = ct.target_id;


create view public.media_content_tag_agg as
  select
    tf.content_type,
    tf.post_id,
    array_remove(array_agg(distinct case when tf.target_type = 'club' then tf.target_id end), null)
      as tagged_club_ids,
    array_remove(array_agg(distinct case when tf.target_type = 'team' then tf.target_id end), null)
      as tagged_team_ids,
    array_remove(array_agg(distinct case when tf.target_type = 'profile' then tf.target_id end), null)
      as tagged_profile_ids,
    public.footme_text_array_clean(array_agg(tf.target_name))     as tagged_names,
    public.footme_text_array_clean(array_agg(tf.target_category)) as tag_categories,
    public.footme_text_array_clean(array_agg(tf.target_region))   as tag_regions,
    public.footme_text_array_clean(array_agg(tf.target_province)) as tag_provinces,
    public.footme_text_array_clean(array_agg(tf.target_city))     as tag_cities
  from public.media_content_tag_facets tf
  group by tf.content_type, tf.post_id;


-- Interazioni disponibili per l'ordinamento "Più discussi" / "In evidenza".
-- I contatori non vengono mai mostrati nelle anteprime (CER-05 §11/§19).
create view public.media_content_engagement as
  select e.content_type, e.post_id, sum(e.n)::int as engagement_count
  from (
    select 'club_media'::text as content_type, post_id, count(*) as n
      from public.club_media_likes group by post_id
    union all
    select 'club_media', post_id, count(*)
      from public.club_media_comments group by post_id
    union all
    select 'media_profile', post_id, count(*)
      from public.media_profile_post_comments group by post_id
    union all
    select 'fan_tribuna', post_id, count(*)
      from public.fan_tribuna_comments group by post_id
    union all
    select 'fan_tribuna', post_id, count(*)
      from public.fan_tribuna_poll_votes group by post_id
    union all
    select 'fan_tribuna', post_id, count(*)
      from public.fan_tribuna_support_votes group by post_id
    union all
    select 'media_tribuna', post_id, count(*)
      from public.media_tribuna_comments group by post_id
    union all
    select 'media_tribuna', post_id, count(*)
      from public.media_tribuna_option_votes group by post_id
    union all
    select 'fan_media', post_id, count(*)
      from public.fan_media_likes group by post_id
    union all
    select 'fan_media', post_id, count(*)
      from public.fan_media_comments group by post_id
  ) e
  group by e.content_type, e.post_id;


-- ============================================================
-- SECTION 5: vista public.media_content_index
--
-- `content_format` è la tipologia mostrata all'utente (Articolo / Video /
-- Foto / Post, CER-05 §4) derivata con una regola deterministica unica:
--   media_profile_posts  -> articolo
--   club_media_posts     -> video se visual_type='video';
--                           foto  se visual_type='image' e body assente;
--                           articolo se length(body) >= 400;
--                           altrimenti post
--   fan_tribuna_posts    -> kind='photo' -> video/foto da media_type;
--                           altrimenti post
--   fan_media_posts      -> video/foto da visual_type
--   media_tribuna_posts  -> post (nessun media associato)
--
-- `source_kind` classifica la provenienza (CER-05 §16): 'ufficiale' per i
-- contenuti di società, la media_kind del profilo per testate/giornalisti/
-- creator/pagine, 'tifoso' per i contenuti fan (che restano ricercabili ma
-- non sono selezionabili dal filtro Fonte).
-- ============================================================

create view public.media_content_index as
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
    'articolo'::text,
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
-- SECTION 6: vista public.media_source_index
--
-- Le "fonti" di CER-05 §12 sono due popolazioni distinte:
--   • i profili con role = 'media' (testata / giornalista / creator / pagina),
--     seguibili tramite profile_follows;
--   • le società che pubblicano contenuti ("Profilo ufficiale"), seguibili
--     tramite club_follows.
-- Le società senza alcun contenuto pubblicato non sono fonti e restano
-- fuori: per cercarle esiste già Cerca > Società.
-- ============================================================

create view public.media_source_index as
  select
    'media_profile'::text                            as source_type,
    coalesce(mp.media_kind, 'pagina')                as source_kind,
    p.id                                             as entity_id,
    coalesce(nullif(trim(coalesce(mp.entity_name, '')), ''), p.full_name) as name,
    coalesce(mp.logo_url, p.avatar_url)              as avatar_url,
    coalesce(nullif(trim(coalesce(mp.short_description, '')), ''), p.bio) as description,
    public.footme_text_array_clean(array[p.region] || mp.covered_territories) as regions,
    array[]::text[]                                  as provinces,
    public.footme_text_array_clean(array[p.city])    as cities,
    public.footme_text_array_clean(mp.covered_competitions) as categories,
    public.footme_text_array_clean(mp.covered_topics || mp.covered_teams) as topics,
    (mp.verification_status = 'verified')            as is_verified,
    coalesce(stats.content_count, 0)                 as content_count,
    stats.last_published_at                          as last_published_at,
    public.footme_normalize_lookup(
      coalesce(nullif(trim(coalesce(mp.entity_name, '')), ''), p.full_name)
    )                                                as name_norm,
    public.footme_normalize_lookup(
      concat_ws(' ',
        mp.entity_name,
        p.full_name,
        mp.short_description,
        mp.editorial_type,
        p.region,
        p.city,
        array_to_string(mp.covered_territories, ' '),
        array_to_string(mp.covered_competitions, ' '),
        array_to_string(mp.covered_topics, ' '),
        array_to_string(mp.covered_teams, ' ')
      )
    )                                                as search_blob
  from public.profiles p
  join public.media_profiles mp on mp.profile_id = p.id
  left join lateral (
    select count(*)::int as content_count, max(published_at) as last_published_at
    from public.media_content_index mci
    where mci.publisher_type = 'profile' and mci.publisher_id = p.id
  ) stats on true
  where p.role = 'media'

  union all

  select
    'club'::text,
    'ufficiale'::text,
    c.id,
    c.name,
    c.logo_url,
    nullif(trim(coalesce(c.description, '')), ''),
    public.footme_text_array_clean(array[c.region]),
    public.footme_text_array_clean(array[c.province]),
    public.footme_text_array_clean(array[c.city]),
    public.footme_text_array_clean(array[c.category]),
    public.footme_text_array_clean(array[c.league]),
    false,
    stats.content_count,
    stats.last_published_at,
    public.footme_normalize_lookup(c.name),
    public.footme_normalize_lookup(
      concat_ws(' ', c.name, c.category, c.league, c.region, c.province, c.city)
    )
  from public.clubs c
  join lateral (
    select count(*)::int as content_count, max(published_at) as last_published_at
    from public.media_content_index mci
    where mci.content_type = 'club_media' and mci.publisher_id = c.id
  ) stats on stats.content_count > 0;


-- ============================================================
-- SECTION 7: privilegi
--
-- Supabase concede per default select su tabelle/viste nuove ad anon e
-- authenticated: qui va revocato esplicitamente. Le viste sono lette solo
-- dalle RPC `security definer` di 20260726110000, che riapplicano
-- `status = 'published'` (lo stesso predicato delle policy RLS sui post,
-- come già fa search_global). Nessun accesso diretto da PostgREST.
-- ============================================================

revoke all on table public.media_content_index      from anon, authenticated;
revoke all on table public.media_source_index       from anon, authenticated;
revoke all on table public.media_content_tags       from anon, authenticated;
revoke all on table public.media_content_tag_facets from anon, authenticated;
revoke all on table public.media_content_tag_agg    from anon, authenticated;
revoke all on table public.media_content_engagement from anon, authenticated;

revoke all on function public.footme_media_kind_from_text(text, text) from public;
revoke all on function public.footme_text_array_clean(text[])         from public;
revoke all on function public.footme_content_kind_label(text, text)   from public;
grant execute on function public.footme_media_kind_from_text(text, text) to authenticated;
grant execute on function public.footme_text_array_clean(text[])         to authenticated;
grant execute on function public.footme_content_kind_label(text, text)   to authenticated;
