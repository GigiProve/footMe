-- ============================================================
-- CER-05 — Cerca > Media e contenuti: RPC di ricerca
--
-- Schema sources reused (verified against the actual migrations before
-- writing this file):
--   20260726100000_media_search_foundation.sql  media_content_index,
--                                               media_source_index,
--                                               footme_text_array_clean()
--   20260725100000_comuni_geo.sql               footme_normalize_lookup(),
--                                               italian_comuni
--   20260515020000_fan_community_profile.sql    profile_follows
--   20260411100000_remote_schema_sync.sql       club_follows
--   saved_club_media / saved_media_profile_posts / saved_media_tribuna /
--   saved_fan_tribuna / saved_fan_media          (bookmark per contenuto)
--
-- Conventions inherited from 20260724100000_search_profiles_filters.sql,
-- 20260724110000_clubs_search_and_saved_teams.sql e
-- 20260725110000_positions_discovery_rpc.sql:
--   • `p_filters jsonb` piatto, chiave assente = nessun vincolo, chiavi
--     sconosciute ignorate, nessun cast cieco di testo client su enum;
--   • `p_sort text` con whitelist e messaggio d'errore in italiano;
--   • limit/offset clampati server-side;
--   • `count(*) over ()::bigint as total_count` sull'ultima colonna;
--   • `security definer` + `stable` + `set search_path = public`;
--   • `raise exception 'Authentication required'` su auth.uid() null;
--   • revoke from public + grant execute to authenticated.
--
-- `security definer` è obbligatorio qui: media_content_index e
-- media_source_index non sono concesse ad `authenticated` (vedi SECTION 7
-- della migrazione fondamenta) e filtrano già `status = 'published'`, lo
-- stesso predicato delle policy RLS sui post.
--
-- Le anteprime non ricevono excerpt né body: CER-05 §11 vieta testo lungo
-- nelle anteprime, quindi le RPC non li restituiscono affatto — restano
-- disponibili nel dettaglio contenuto.
--
-- Nessun punteggio è esposto: le priorità di §9 sono calcolate come flag
-- booleani interni e usate solo nell'ORDER BY (stessa scelta di
-- search_profiles_page con rank_score).
-- ============================================================


-- ============================================================
-- SECTION 1: helper di matching a token
--
-- Il matching non può essere un solo `ilike '%term%'`: query reali come
-- "Serie D Lombardia" o "Calciomercato Sicilia" combinano categoria e
-- territorio, che nel blob non sono adiacenti. Si richiede quindi che
-- *tutti* i token normalizzati della query siano presenti nel blob.
--
-- I confronti sono ancorati all'inizio di parola su un blob spaziato, con
-- una regola diversa per token corti e lunghi:
--   • token di 1-3 caratteri -> parola intera (' tok ').
--     Serve a evitare falsi positivi come "AC" che matcha "ACquisto" o
--     "D" che matcha "Domenica": su token cortissimi la sottostringa nuda
--     produce rumore che affonda i risultati veri.
--   • token di 4+ caratteri -> prefisso di parola (' tok').
--     Mantiene il matching tollerante su forme flesse e composti
--     ("lombard" -> "lombardia", "highlight" -> "highlights").
-- Entrambi i predicati sono soddisfatti dalla query canonica "Serie D
-- Lombardia" -> {serie, d, lombardia}.
-- ============================================================

create or replace function public.footme_search_tokens(p_query text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(tok), '{}'::text[])
  from unnest(string_to_array(public.footme_normalize_lookup(coalesce(p_query, '')), ' ')) as tok
  where length(tok) > 0;
$$;

-- Pattern di ricerca di un singolo token, già spaziato.
create or replace function public.footme_token_needle(p_token text)
returns text
language sql
immutable
set search_path = public
as $$
  select case when length(p_token) <= 3 then ' ' || p_token || ' ' else ' ' || p_token end;
$$;

create or replace function public.footme_tokens_all_present(
  p_tokens   text[],
  p_haystack text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_tokens is null or cardinality(p_tokens) = 0 then true
    when p_haystack is null or p_haystack = ''         then false
    else not exists (
      select 1
      from unnest(p_tokens) as tok
      where position(public.footme_token_needle(tok) in ' ' || p_haystack || ' ') = 0
    )
  end;
$$;

create or replace function public.footme_tokens_any_present(
  p_tokens   text[],
  p_haystack text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_tokens is null or cardinality(p_tokens) = 0 then false
    when p_haystack is null or p_haystack = ''         then false
    else exists (
      select 1
      from unnest(p_tokens) as tok
      where position(public.footme_token_needle(tok) in ' ' || p_haystack || ' ') > 0
    )
  end;
$$;


-- ============================================================
-- SECTION 2: RPC public.search_media_content_page
--
--   p_filters (jsonb, tutte opzionali):
--     formats           text[]  'articolo' | 'video' | 'foto' | 'post'
--     sources           text[]  'ufficiale' | 'testata' | 'giornalista'
--                               | 'creator' | 'pagina' (su source_kind)
--     categories        text[]  match ILIKE parziale sulle categorie derivate
--     regions           text[]  overlap esatto sulle regioni derivate
--     provinces         text[]  overlap esatto sulle province derivate
--     published_within  text    'today' | 'last7' | 'last30'
--     saved             bool    true -> solo contenuti già salvati
--     followed_sources  bool    true -> solo contenuti di fonti seguite
--     followed_clubs    bool    true -> società seguita come autore o taggata
--     followed_profiles bool    true -> profilo seguito come autore o taggato
--
--   p_sort: 'pertinenza' (default) | 'recenti' | 'evidenza' | 'discussi'
--     La gerarchia di pertinenza di §9 si applica solo a 'pertinenza': gli
--     altri tre ordinamenti sono espliciti e non vanno sovrascritti.
--
--   Nessun filtro per distanza/coordinate: CER-05 §18 vieta
--   geolocalizzazione, posizione attuale, raggio e mappa. La zona è il
--   territorio *trattato*, non quello dell'utente.
-- ============================================================

create or replace function public.search_media_content_page(
  p_query   text  default null,
  p_filters jsonb default null,
  p_sort    text  default 'pertinenza',
  p_limit   int   default 20,
  p_offset  int   default 0
)
returns table (
  content_type         text,
  post_id              uuid,
  content_format       text,
  kind                 text,
  kind_label           text,
  title                text,
  thumbnail_url        text,
  media_type           text,
  duration_seconds     int,
  publisher_type       text,
  publisher_id         uuid,
  publisher_name       text,
  publisher_avatar_url text,
  source_kind          text,
  published_at         timestamptz,
  is_saved             boolean,
  total_count          bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid      uuid   := auth.uid();
  v_filters  jsonb  := coalesce(p_filters, '{}'::jsonb);
  v_sort     text   := coalesce(nullif(trim(coalesce(p_sort, '')), ''), 'pertinenza');
  v_limit    int    := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset   int    := greatest(coalesce(p_offset, 0), 0);
  v_norm     text   := public.footme_normalize_lookup(coalesce(p_query, ''));
  v_tokens   text[] := public.footme_search_tokens(p_query);
  v_formats    text[];
  v_sources    text[];
  v_categories text[];
  v_regions    text[];
  v_provinces  text[];
  v_since      timestamptz;
  v_saved_only        boolean := (v_filters ->> 'saved')::boolean;
  v_followed_sources  boolean := (v_filters ->> 'followed_sources')::boolean;
  v_followed_clubs    boolean := (v_filters ->> 'followed_clubs')::boolean;
  v_followed_profiles boolean := (v_filters ->> 'followed_profiles')::boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_sort not in ('pertinenza', 'recenti', 'evidenza', 'discussi') then
    raise exception 'Ordinamento non supportato';
  end if;

  -- Gli array jsonb vengono validati contro i valori attesi: un valore
  -- sconosciuto viene scartato, non passato al motore di ricerca.
  select nullif(array_agg(distinct v), '{}'::text[]) into v_formats
  from jsonb_array_elements_text(coalesce(v_filters -> 'formats', '[]'::jsonb)) as v
  where v in ('articolo', 'video', 'foto', 'post');

  select nullif(array_agg(distinct v), '{}'::text[]) into v_sources
  from jsonb_array_elements_text(coalesce(v_filters -> 'sources', '[]'::jsonb)) as v
  where v in ('ufficiale', 'testata', 'giornalista', 'creator', 'pagina');

  select nullif(array_agg(distinct trim(v)), '{}'::text[]) into v_categories
  from jsonb_array_elements_text(coalesce(v_filters -> 'categories', '[]'::jsonb)) as v
  where length(trim(v)) > 0;

  select nullif(array_agg(distinct trim(v)), '{}'::text[]) into v_regions
  from jsonb_array_elements_text(coalesce(v_filters -> 'regions', '[]'::jsonb)) as v
  where length(trim(v)) > 0;

  select nullif(array_agg(distinct trim(v)), '{}'::text[]) into v_provinces
  from jsonb_array_elements_text(coalesce(v_filters -> 'provinces', '[]'::jsonb)) as v
  where length(trim(v)) > 0;

  v_since := case v_filters ->> 'published_within'
    when 'today'  then date_trunc('day', timezone('utc', now()))
    when 'last7'  then timezone('utc', now()) - interval '7 days'
    when 'last30' then timezone('utc', now()) - interval '30 days'
    else null
  end;

  return query
  with saved as (
    select 'club_media'::text as content_type, s.post_id
      from public.saved_club_media s          where s.profile_id = v_uid
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
  followed as (
    select 'profile'::text as publisher_type, f.followed_profile_id as publisher_id
      from public.profile_follows f where f.follower_profile_id = v_uid
    union all
    select 'club', f.club_id
      from public.club_follows f   where f.profile_id = v_uid
  ),
  flags as (
    select
      mci.content_type,
      mci.post_id,
      mci.content_format,
      mci.kind,
      mci.title,
      mci.thumbnail_url,
      mci.media_type,
      mci.duration_seconds,
      mci.publisher_type,
      mci.publisher_id,
      mci.publisher_name,
      mci.publisher_avatar_url,
      mci.source_kind,
      mci.published_at,
      mci.engagement_count,
      mci.title_norm,
      (sv.post_id is not null)                                              as is_saved,
      public.footme_tokens_all_present(v_tokens, mci.publisher_norm)        as pub_match,
      public.footme_tokens_all_present(v_tokens, mci.tagged_norm)           as tag_match,
      public.footme_tokens_all_present(v_tokens, mci.title_norm)            as title_match,
      public.footme_tokens_any_present(v_tokens, mci.categories_norm)       as cat_match,
      public.footme_tokens_any_present(v_tokens, mci.territory_norm)        as geo_match
    from public.media_content_index mci
    left join saved sv
      on sv.content_type = mci.content_type and sv.post_id = mci.post_id
    where public.footme_tokens_all_present(v_tokens, mci.search_blob)
      and (v_formats    is null or mci.content_format = any(v_formats))
      and (v_sources    is null or mci.source_kind    = any(v_sources))
      and (v_regions    is null or mci.regions   && v_regions)
      and (v_provinces  is null or mci.provinces && v_provinces)
      and (
        v_categories is null
        or exists (
          select 1
          from unnest(mci.categories) as have, unnest(v_categories) as want
          where have ilike '%' || want || '%'
        )
      )
      and (v_since is null or mci.published_at >= v_since)
      and (coalesce(v_saved_only, false) = false or sv.post_id is not null)
      and (
        coalesce(v_followed_sources, false) = false
        or exists (
          select 1 from followed fo
          where fo.publisher_type = mci.publisher_type
            and fo.publisher_id = mci.publisher_id
        )
      )
      and (
        coalesce(v_followed_clubs, false) = false
        or exists (
          select 1 from public.club_follows cf
          where cf.profile_id = v_uid
            and (
              (mci.publisher_type = 'club' and cf.club_id = mci.publisher_id)
              or cf.club_id = any(mci.tagged_club_ids)
            )
        )
      )
      and (
        coalesce(v_followed_profiles, false) = false
        or exists (
          select 1 from public.profile_follows pf
          where pf.follower_profile_id = v_uid
            and (
              (mci.publisher_type = 'profile' and pf.followed_profile_id = mci.publisher_id)
              or pf.followed_profile_id = any(mci.tagged_profile_ids)
            )
        )
      )
  )
  select
    f.content_type,
    f.post_id,
    f.content_format,
    f.kind,
    public.footme_content_kind_label(f.content_type, f.kind) as kind_label,
    f.title,
    f.thumbnail_url,
    f.media_type,
    f.duration_seconds,
    f.publisher_type,
    f.publisher_id,
    f.publisher_name,
    f.publisher_avatar_url,
    f.source_kind,
    f.published_at,
    f.is_saved,
    count(*) over ()::bigint as total_count
  from flags f
  order by
    -- §9: pubblicato dal soggetto cercato > soggetto taggato > editoriale
    -- pertinente > altri contenuti correlati. Coerenza categoria+territorio
    -- vale come massima pertinenza per le query di categoria/zona.
    (case
       when v_sort <> 'pertinenza' or cardinality(v_tokens) = 0 then 0
       when f.pub_match                                         then 0
       when f.cat_match and f.geo_match                         then 0
       when f.tag_match                                         then 1
       when f.title_match
         and f.source_kind in ('testata', 'giornalista')        then 2
       when f.title_match                                       then 3
       else 4
     end) asc,
    (case
       when v_sort = 'pertinenza' and cardinality(v_tokens) > 0
       then similarity(f.title_norm, v_norm)
       else 0
     end) desc,
    (case when v_sort = 'discussi' then f.engagement_count else 0 end) desc,
    (case
       when v_sort = 'evidenza'
       then f.engagement_count::numeric / (
         1 + greatest(
           0,
           extract(epoch from (timezone('utc', now()) - f.published_at)) / 86400
         )
       )
       else 0
     end) desc,
    f.published_at desc nulls last,
    f.post_id asc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.search_media_content_page(text, jsonb, text, int, int) from public;
grant execute on function public.search_media_content_page(text, jsonb, text, int, int) to authenticated;


-- ============================================================
-- SECTION 3: RPC public.search_media_sources_page
--
-- Le fonti compaiono nella stessa pagina dei contenuti (CER-05 §4/§8) ma
-- con anteprima diversa, quindi hanno una RPC propria. È paginata perché
-- con il filtro "Solo profili Media" diventa la lista primaria.
--
-- p_filters condivide con i contenuti le chiavi: sources, categories,
-- regions, provinces, followed_sources. Le altre sono ignorate.
-- ============================================================

create or replace function public.search_media_sources_page(
  p_query   text  default null,
  p_filters jsonb default null,
  p_limit   int   default 20,
  p_offset  int   default 0
)
returns table (
  source_type       text,
  source_kind       text,
  entity_id         uuid,
  name              text,
  avatar_url        text,
  description       text,
  regions           text[],
  categories        text[],
  topics            text[],
  is_verified       boolean,
  content_count     int,
  last_published_at timestamptz,
  is_following      boolean,
  total_count       bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid   := auth.uid();
  v_filters jsonb  := coalesce(p_filters, '{}'::jsonb);
  v_limit   int    := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset  int    := greatest(coalesce(p_offset, 0), 0);
  v_norm    text   := public.footme_normalize_lookup(coalesce(p_query, ''));
  v_tokens  text[] := public.footme_search_tokens(p_query);
  v_sources    text[];
  v_categories text[];
  v_regions    text[];
  v_provinces  text[];
  v_followed_only boolean := (v_filters ->> 'followed_sources')::boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select nullif(array_agg(distinct v), '{}'::text[]) into v_sources
  from jsonb_array_elements_text(coalesce(v_filters -> 'sources', '[]'::jsonb)) as v
  where v in ('ufficiale', 'testata', 'giornalista', 'creator', 'pagina');

  select nullif(array_agg(distinct trim(v)), '{}'::text[]) into v_categories
  from jsonb_array_elements_text(coalesce(v_filters -> 'categories', '[]'::jsonb)) as v
  where length(trim(v)) > 0;

  select nullif(array_agg(distinct trim(v)), '{}'::text[]) into v_regions
  from jsonb_array_elements_text(coalesce(v_filters -> 'regions', '[]'::jsonb)) as v
  where length(trim(v)) > 0;

  select nullif(array_agg(distinct trim(v)), '{}'::text[]) into v_provinces
  from jsonb_array_elements_text(coalesce(v_filters -> 'provinces', '[]'::jsonb)) as v
  where length(trim(v)) > 0;

  return query
  with followed as (
    select 'media_profile'::text as source_type, f.followed_profile_id as entity_id
      from public.profile_follows f where f.follower_profile_id = v_uid
    union all
    select 'club', f.club_id
      from public.club_follows f   where f.profile_id = v_uid
  ),
  filtered as (
    select
      msi.source_type,
      msi.source_kind,
      msi.entity_id,
      msi.name,
      msi.avatar_url,
      msi.description,
      msi.regions,
      msi.categories,
      msi.topics,
      msi.is_verified,
      msi.content_count,
      msi.last_published_at,
      msi.name_norm,
      (fo.entity_id is not null)                                    as is_following,
      public.footme_tokens_all_present(v_tokens, msi.name_norm)      as name_match
    from public.media_source_index msi
    left join followed fo
      on fo.source_type = msi.source_type and fo.entity_id = msi.entity_id
    where public.footme_tokens_all_present(v_tokens, msi.search_blob)
      and (v_sources   is null or msi.source_kind = any(v_sources))
      and (v_regions   is null or msi.regions   && v_regions)
      and (v_provinces is null or msi.provinces && v_provinces)
      and (
        v_categories is null
        or exists (
          select 1
          from unnest(msi.categories) as have, unnest(v_categories) as want
          where have ilike '%' || want || '%'
        )
      )
      and (coalesce(v_followed_only, false) = false or fo.entity_id is not null)
  )
  select
    f.source_type,
    f.source_kind,
    f.entity_id,
    f.name,
    f.avatar_url,
    f.description,
    f.regions,
    f.categories,
    f.topics,
    f.is_verified,
    f.content_count,
    f.last_published_at,
    f.is_following,
    count(*) over ()::bigint as total_count
  from filtered f
  order by
    (case when cardinality(v_tokens) > 0 and f.name_match then 0 else 1 end) asc,
    (case
       when cardinality(v_tokens) > 0 then similarity(f.name_norm, v_norm)
       else 0
     end) desc,
    f.content_count desc,
    f.last_published_at desc nulls last,
    f.name asc,
    f.entity_id asc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.search_media_sources_page(text, jsonb, int, int) from public;
grant execute on function public.search_media_sources_page(text, jsonb, int, int) to authenticated;


-- ============================================================
-- SECTION 4: RPC public.fetch_media_for_you
--
-- Alimenta la sezione "Per te" della schermata iniziale (CER-05 §3):
-- pochi contenuti, ordinati per affinità e poi per il composito
-- engagement/recency ("In evidenza per te"). Nessun punteggio esposto.
--
-- Deliberatamente senza finestra temporale: l'affinità decide la
-- personalizzazione e l'ordinamento decide la freschezza, così la
-- schermata iniziale non è mai vuota anche quando l'utente non segue
-- ancora nessuno (fallback su contenuti globali in evidenza).
-- ============================================================

create or replace function public.fetch_media_for_you(
  p_limit int default 6
)
returns table (
  content_type         text,
  post_id              uuid,
  content_format       text,
  kind                 text,
  kind_label           text,
  title                text,
  thumbnail_url        text,
  media_type           text,
  duration_seconds     int,
  publisher_type       text,
  publisher_id         uuid,
  publisher_name       text,
  publisher_avatar_url text,
  source_kind          text,
  published_at         timestamptz,
  is_saved             boolean,
  is_personalized      boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_limit  int  := least(greatest(coalesce(p_limit, 6), 1), 20);
  v_region text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select p.region into v_region from public.profiles p where p.id = v_uid;

  return query
  with followed_clubs as (
    select f.club_id from public.club_follows f where f.profile_id = v_uid
  ),
  followed_profiles as (
    select f.followed_profile_id as profile_id
    from public.profile_follows f
    where f.follower_profile_id = v_uid
  ),
  saved as (
    select 'club_media'::text as content_type, s.post_id
      from public.saved_club_media s          where s.profile_id = v_uid
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
  scored as (
    select
      mci.*,
      (sv.post_id is not null) as is_saved,
      (
        case
          when mci.publisher_type = 'club'
            and exists (select 1 from followed_clubs fc where fc.club_id = mci.publisher_id)
          then 3 else 0
        end
        + case
            when mci.publisher_type = 'profile'
              and exists (
                select 1 from followed_profiles fp where fp.profile_id = mci.publisher_id
              )
            then 3 else 0
          end
        + case
            when exists (
              select 1 from followed_clubs fc where fc.club_id = any(mci.tagged_club_ids)
            ) then 2 else 0
          end
        + case
            when exists (
              select 1 from followed_profiles fp
              where fp.profile_id = any(mci.tagged_profile_ids)
            ) then 2 else 0
          end
        + case
            when v_region is not null and v_region = any(mci.regions) then 1 else 0
          end
      ) as affinity
    from public.media_content_index mci
    left join saved sv
      on sv.content_type = mci.content_type and sv.post_id = mci.post_id
    where not (mci.publisher_type = 'profile' and mci.publisher_id = v_uid)
  )
  select
    s.content_type,
    s.post_id,
    s.content_format,
    s.kind,
    public.footme_content_kind_label(s.content_type, s.kind) as kind_label,
    s.title,
    s.thumbnail_url,
    s.media_type,
    s.duration_seconds,
    s.publisher_type,
    s.publisher_id,
    s.publisher_name,
    s.publisher_avatar_url,
    s.source_kind,
    s.published_at,
    s.is_saved,
    (s.affinity > 0) as is_personalized
  from scored s
  order by
    (s.affinity > 0) desc,
    s.affinity desc,
    (
      s.engagement_count::numeric / (
        1 + greatest(
          0,
          extract(epoch from (timezone('utc', now()) - s.published_at)) / 86400
        )
      )
    ) desc,
    s.published_at desc nulls last,
    s.post_id asc
  limit v_limit;
end;
$$;

revoke all on function public.fetch_media_for_you(int) from public;
grant execute on function public.fetch_media_for_you(int) to authenticated;


-- ============================================================
-- SECTION 5: RPC public.fetch_media_sources_discover
--
-- Alimenta "Media da scoprire" (CER-05 §3): solo fonti non ancora seguite,
-- con preferenza al territorio dell'utente. Numero limitato, nessuno
-- scorrimento infinito nella schermata iniziale.
-- ============================================================

create or replace function public.fetch_media_sources_discover(
  p_limit int default 5
)
returns table (
  source_type       text,
  source_kind       text,
  entity_id         uuid,
  name              text,
  avatar_url        text,
  description       text,
  regions           text[],
  categories        text[],
  topics            text[],
  is_verified       boolean,
  content_count     int,
  last_published_at timestamptz,
  is_following      boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_limit  int  := least(greatest(coalesce(p_limit, 5), 1), 20);
  v_region text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select p.region into v_region from public.profiles p where p.id = v_uid;

  return query
  select
    msi.source_type,
    msi.source_kind,
    msi.entity_id,
    msi.name,
    msi.avatar_url,
    msi.description,
    msi.regions,
    msi.categories,
    msi.topics,
    msi.is_verified,
    msi.content_count,
    msi.last_published_at,
    false as is_following
  from public.media_source_index msi
  where msi.entity_id <> v_uid
    and not exists (
      select 1 from public.profile_follows f
      where f.follower_profile_id = v_uid
        and msi.source_type = 'media_profile'
        and f.followed_profile_id = msi.entity_id
    )
    and not exists (
      select 1 from public.club_follows f
      where f.profile_id = v_uid
        and msi.source_type = 'club'
        and f.club_id = msi.entity_id
    )
  order by
    (case when v_region is not null and v_region = any(msi.regions) then 0 else 1 end) asc,
    msi.content_count desc,
    msi.last_published_at desc nulls last,
    msi.name asc,
    msi.entity_id asc
  limit v_limit;
end;
$$;

revoke all on function public.fetch_media_sources_discover(int) from public;
grant execute on function public.fetch_media_sources_discover(int) to authenticated;


-- ============================================================
-- SECTION 6: RPC public.search_media_suggestions
--
-- Autocomplete di CER-05 §6: lista compatta, mai anteprime piene.
-- Gruppi restituiti, in ordine: società · fonte · profilo · argomento ·
-- territorio.
--
-- `target_id` è null per argomento e territorio: quelle righe rilanciano la
-- ricerca con `search_term` invece di navigare a un'entità (§21).
--
-- Come search_global, esce con un `return;` (set vuoto, nessuna eccezione)
-- sotto i 2 caratteri, così il client rende l'empty state senza try/catch.
-- ============================================================

create or replace function public.search_media_suggestions(
  p_query     text,
  p_per_group int default 3
)
returns table (
  group_key   text,
  group_order int,
  target_type text,
  target_id   uuid,
  label       text,
  subtitle    text,
  image_url   text,
  search_term text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_size  int  := least(greatest(coalesce(p_per_group, 3), 1), 10);
  v_term  text := trim(coalesce(p_query, ''));
  v_norm  text := public.footme_normalize_lookup(coalesce(p_query, ''));
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if length(v_term) < 2 or length(v_norm) = 0 then
    return;
  end if;

  return query
  with societa as (
    select
      'societa'::text                              as group_key,
      1                                            as group_order,
      'club'::text                                 as target_type,
      c.id                                         as target_id,
      c.name                                       as label,
      'Società e contenuti correlati'::text        as subtitle,
      c.logo_url                                   as image_url,
      null::text                                   as search_term,
      row_number() over (
        order by similarity(public.footme_normalize_lookup(c.name), v_norm) desc, c.name asc
      )                                            as rnk
    from public.clubs c
    where position(v_norm in public.footme_normalize_lookup(c.name)) > 0
  ),
  squadre as (
    select
      'societa'::text                              as group_key,
      1                                            as group_order,
      'club_team'::text                            as target_type,
      ct.id                                        as target_id,
      ct.name                                      as label,
      concat_ws(' · ', 'Squadra', ct.category)     as subtitle,
      ct.logo_url                                  as image_url,
      null::text                                   as search_term,
      row_number() over (
        order by similarity(public.footme_normalize_lookup(ct.name), v_norm) desc, ct.name asc
      )                                            as rnk
    from public.club_teams ct
    where position(v_norm in public.footme_normalize_lookup(ct.name)) > 0
  ),
  fonti as (
    select
      'fonte'::text                                as group_key,
      2                                            as group_order,
      msi.source_type                              as target_type,
      msi.entity_id                                as target_id,
      msi.name                                     as label,
      concat_ws(' · ',
        case msi.source_kind
          when 'testata'     then 'Testata sportiva'
          when 'giornalista' then 'Giornalista sportivo'
          when 'creator'     then 'Creator'
          when 'ufficiale'   then 'Profilo ufficiale'
          else 'Pagina sportiva'
        end,
        (select r from unnest(msi.regions) as r limit 1)
      )                                            as subtitle,
      msi.avatar_url                               as image_url,
      null::text                                   as search_term,
      row_number() over (
        order by similarity(msi.name_norm, v_norm) desc, msi.content_count desc, msi.name asc
      )                                            as rnk
    from public.media_source_index msi
    -- Solo profili Media: le società compaiono già nel gruppo "societa" e
    -- una riga per entità evita suggerimenti duplicati. La classificazione
    -- "Profilo ufficiale" resta comunque disponibile nei filtri Fonte e
    -- nella lista fonti di search_media_sources_page.
    where msi.source_type = 'media_profile'
      and position(v_norm in msi.search_blob) > 0
  ),
  profili as (
    select
      'profilo'::text                              as group_key,
      3                                            as group_order,
      'profile'::text                              as target_type,
      p.id                                         as target_id,
      p.full_name                                  as label,
      concat_ws(' · ', p.role::text, p.region)     as subtitle,
      p.avatar_url                                 as image_url,
      null::text                                   as search_term,
      row_number() over (
        order by similarity(public.footme_normalize_lookup(p.full_name), v_norm) desc,
                 p.full_name asc
      )                                            as rnk
    from public.profiles p
    where p.role in ('player', 'coach', 'staff', 'director', 'agent')
      and position(v_norm in public.footme_normalize_lookup(p.full_name)) > 0
  ),
  argomenti as (
    select
      'argomento'::text                            as group_key,
      4                                            as group_order,
      null::text                                   as target_type,
      null::uuid                                   as target_id,
      a.label                                      as label,
      'Argomento'::text                            as subtitle,
      null::text                                   as image_url,
      a.label                                      as search_term,
      row_number() over (order by length(a.label) asc, a.label asc) as rnk
    from (
      select distinct trim(raw.v) as label
      from (
        select c.category             as v from public.clubs c
        union all
        select mpp.category                from public.media_profile_posts mpp
          where mpp.status = 'published'
        union all
        select ftp.reference_category      from public.fan_tribuna_posts ftp
          where ftp.status = 'published'
        union all
        select fmp.tag                     from public.fan_media_posts fmp
          where fmp.status = 'published'
      ) raw
      where raw.v is not null
        and length(trim(raw.v)) > 0
        and position(v_norm in public.footme_normalize_lookup(raw.v)) > 0
    ) a
  ),
  territori as (
    select
      'territorio'::text                           as group_key,
      5                                            as group_order,
      null::text                                   as target_type,
      null::uuid                                   as target_id,
      t.label                                      as label,
      t.subtitle                                   as subtitle,
      null::text                                   as image_url,
      t.label                                      as search_term,
      row_number() over (order by t.subtitle asc, t.label asc) as rnk
    from (
      select distinct ic.region as label, 'Regione'::text as subtitle
      from public.italian_comuni ic
      where position(v_norm in public.footme_normalize_lookup(ic.region)) > 0
      union
      select distinct ic.province as label, 'Provincia'::text as subtitle
      from public.italian_comuni ic
      where position(v_norm in public.footme_normalize_lookup(ic.province)) > 0
    ) t
  ),
  combined as (
    select * from societa
    union all select * from squadre
    union all select * from fonti
    union all select * from profili
    union all select * from argomenti
    union all select * from territori
  )
  select
    combined.group_key,
    combined.group_order,
    combined.target_type,
    combined.target_id,
    combined.label,
    combined.subtitle,
    combined.image_url,
    combined.search_term
  from combined
  where combined.rnk <= v_size
  order by combined.group_order asc, combined.rnk asc;
end;
$$;

revoke all on function public.search_media_suggestions(text, int) from public;
grant execute on function public.search_media_suggestions(text, int) to authenticated;

revoke all on function public.footme_search_tokens(text)                 from public;
revoke all on function public.footme_token_needle(text)                  from public;
revoke all on function public.footme_tokens_all_present(text[], text)    from public;
revoke all on function public.footme_tokens_any_present(text[], text)    from public;
grant execute on function public.footme_search_tokens(text)              to authenticated;
grant execute on function public.footme_token_needle(text)               to authenticated;
grant execute on function public.footme_tokens_all_present(text[], text) to authenticated;
grant execute on function public.footme_tokens_any_present(text[], text) to authenticated;
