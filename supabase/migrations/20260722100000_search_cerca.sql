-- Migration: "Cerca" (search) feature.
--
-- Adds recruiting_ads.deadline + recruiting_ads.target_role, trigram indexes
-- for fast fuzzy search, and four read-only RPCs backing the Cerca screens:
--   - search_global          → unified "quick search" across profiles/clubs/
--                              positions/content, grouped by category.
--   - search_profiles_page   → paginated "Profili" results tab.
--   - search_clubs_page      → paginated "Società" results tab.
--   - search_positions_page  → paginated "Posizioni" (recruiting ads) tab.
--
-- Schema sources reused (see also 20260619110000_editorial_post_modes.sql
-- and 20260627090100_saved_following_rpcs.sql for house RPC style):
--   profiles / profiles_with_age  (20260309000000_initial_schema.sql,
--                                   20260313000003_profiles_with_age_view.sql)
--   player_profiles / coach_profiles / staff_profiles / agent_profiles
--   club_members (is_current, status, team_id)
--   clubs / club_teams / club_affiliations
--   recruiting_ads / saved_ads
--   club_media_posts (20260514001000_club_media_posts.sql)
--   fan_tribuna_posts (20260515030000_fan_tribuna_posts.sql)
--
-- All new RPCs are security definer, set search_path = public, guard on
-- auth.uid(), and grant execute to authenticated only (never anon / service
-- role). Reads of the underlying tables/views inside these functions do not
-- exceed what the existing RLS "readable by authenticated users" policies
-- already allow to any signed-in caller.


-- ============================================================
-- SECTION 1: recruiting_ads schema changes
-- ============================================================

alter table public.recruiting_ads
  add column if not exists deadline date;

alter table public.recruiting_ads
  add column if not exists target_role text not null default 'player';

alter table public.recruiting_ads
  drop constraint if exists recruiting_ads_target_role_check;

alter table public.recruiting_ads
  add constraint recruiting_ads_target_role_check
  check (target_role in ('player', 'coach', 'staff'));


-- ============================================================
-- SECTION 2: Trigram indexes (pg_trgm already enabled by
-- 20260313000001_player_sports_information.sql / 20260313000005_remote_schema_sync.sql;
-- clubs.name already indexed as clubs_name_search_idx)
-- ============================================================

create index if not exists profiles_full_name_trgm_idx
  on public.profiles using gin (full_name gin_trgm_ops);

create index if not exists club_teams_name_trgm_idx
  on public.club_teams using gin (name gin_trgm_ops);

create index if not exists recruiting_ads_title_trgm_idx
  on public.recruiting_ads using gin (title gin_trgm_ops);


-- ============================================================
-- RPC: public.search_global
--
-- Unified "quick search" used by the Cerca landing screen: a short,
-- grouped preview across four categories. Full paginated results per
-- category are served by search_profiles_page / search_clubs_page /
-- search_positions_page.
--
-- Groups (fixed display order): societa, profilo, posizione, contenuto.
-- Each group is ranked internally (by trigram similarity, or recency for
-- content) and capped, then concatenated in the fixed group order.
--
-- Returns empty (no exception) when the query is too short, so callers can
-- render an empty state without a try/catch.
-- ============================================================

drop function if exists public.search_global(text, int, int);

create or replace function public.search_global(
  p_query          text,
  p_per_category   int default 3,
  p_content_limit  int default 2
)
returns table (
  group_key   text,
  target_type text,
  target_id   uuid,
  title       text,
  subtitle    text,
  image_url   text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_term text := trim(coalesce(p_query, ''));
  -- Client-controlled sizes are clamped as defense in depth.
  v_per_category  int := least(greatest(coalesce(p_per_category, 3), 1), 10);
  v_content_limit int := least(greatest(coalesce(p_content_limit, 2), 0), 10);
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if length(v_term) < 2 then
    return;
  end if;

  return query

  with

  -- -------------------------------------------------------
  -- PROFILO: player / coach / staff / agent
  -- Subtitle built per-role, same pattern as search_tag_targets.
  -- -------------------------------------------------------
  profilo_ranked as (
    select
      pwa.id                             as target_id,
      pwa.full_name                      as title,
      coalesce(
        case pwa.role::text

          when 'player' then (
            select
              case
                when player_info.team_or_club is not null
                  and player_info.pos_label is not null
                then player_info.team_or_club || ' • ' || player_info.pos_label
                when player_info.team_or_club is not null
                then player_info.team_or_club
                else player_info.pos_label
              end
            from (
              select
                nullif(trim(coalesce(ct.name, c.name, '')), '') as team_or_club,
                -- Italian labels, mirroring getPlayerPositionLabel on the client
                -- (subtitle is prebuilt here, so the client cannot re-format it).
                case pp.primary_position::text
                  when 'goalkeeper'           then 'Portiere'
                  when 'defender'             then 'Difensore'
                  when 'center_back'          then 'Difensore centrale'
                  when 'right_back'           then 'Terzino destro'
                  when 'left_back'            then 'Terzino sinistro'
                  when 'midfielder'           then 'Centrocampista'
                  when 'defensive_midfielder' then 'Centrocampista difensivo'
                  when 'central_midfielder'   then 'Centrocampista centrale'
                  when 'attacking_midfielder' then 'Trequartista'
                  when 'right_winger'         then 'Ala destra'
                  when 'left_winger'          then 'Ala sinistra'
                  when 'striker'              then 'Attaccante'
                  when 'forward'              then 'Attaccante'
                  else nullif(trim(pp.primary_position::text), '')
                end as pos_label
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
            ) player_info
          )

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

          when 'agent' then 'Procuratore'

          else null
        end,
        pwa.city,
        ''
      )                                   as subtitle,
      pwa.avatar_url                      as image_url,
      similarity(lower(pwa.full_name), lower(v_term)) as rank_score
    from public.profiles_with_age pwa
    where pwa.role in ('player', 'coach', 'staff', 'agent')
      and pwa.full_name ilike '%' || v_term || '%'
  ),
  profilo as (
    select
      'profilo'::text  as group_key,
      'profile'::text  as target_type,
      pr.target_id,
      pr.title,
      pr.subtitle,
      pr.image_url,
      row_number() over (order by pr.rank_score desc) as rnk
    from profilo_ranked pr
    order by pr.rank_score desc
    limit v_per_category
  ),

  -- -------------------------------------------------------
  -- SOCIETA: clubs + club_teams (squadre interne)
  -- -------------------------------------------------------
  club_match as (
    select
      c.id                                as target_id,
      c.name                               as title,
      array_to_string(
        array_remove(
          array[
            nullif(trim(coalesce(c.category, c.league, '')), ''),
            nullif(trim(coalesce(c.city, '')), '')
          ],
          null
        ),
        ' • '
      )                                    as subtitle,
      c.logo_url                           as image_url,
      similarity(lower(c.name), lower(v_term)) as rank_score
    from public.clubs c
    where c.name ilike '%' || v_term || '%'
  ),
  team_match as (
    select
      ct.id                                as target_id,
      ct.name                              as title,
      'Squadra interna • ' || parent.name  as subtitle,
      ct.logo_url                          as image_url,
      similarity(lower(ct.name), lower(v_term)) as rank_score
    from public.club_teams ct
    join public.clubs parent on parent.id = ct.club_id
    where ct.name ilike '%' || v_term || '%'
  ),
  societa_ranked as (
    select 'club'::text as target_type, * from club_match
    union all
    select 'club_team'::text as target_type, * from team_match
  ),
  societa as (
    select
      'societa'::text as group_key,
      sr.target_type,
      sr.target_id,
      sr.title,
      sr.subtitle,
      sr.image_url,
      row_number() over (order by sr.rank_score desc) as rnk
    from societa_ranked sr
    order by sr.rank_score desc
    limit v_per_category
  ),

  -- -------------------------------------------------------
  -- POSIZIONE: published recruiting ads
  -- -------------------------------------------------------
  posizione_ranked as (
    select
      ra.id                                as target_id,
      ra.title                             as title,
      array_to_string(
        array_remove(
          array[
            nullif(trim(c.name), ''),
            nullif(trim(ct.name), ''),
            nullif(trim(ra.category), '')
          ],
          null
        ),
        ' • '
      )                                    as subtitle,
      c.logo_url                           as image_url,
      similarity(lower(ra.title), lower(v_term)) as rank_score,
      ra.published_at                      as published_at
    from public.recruiting_ads ra
    join public.clubs c on c.id = ra.club_id
    left join public.club_teams ct on ct.id = ra.team_id
    where ra.status = 'published'
      and (
        ra.title ilike '%' || v_term || '%'
        or ra.description ilike '%' || v_term || '%'
        or c.name ilike '%' || v_term || '%'
      )
  ),
  posizione as (
    select
      'posizione'::text     as group_key,
      'recruiting_ad'::text as target_type,
      pzr.target_id,
      pzr.title,
      pzr.subtitle,
      pzr.image_url,
      row_number() over (order by pzr.rank_score desc, pzr.published_at desc) as rnk
    from posizione_ranked pzr
    order by pzr.rank_score desc, pzr.published_at desc
    limit v_per_category
  ),

  -- -------------------------------------------------------
  -- CONTENUTO: club_media_posts + fan_tribuna_posts (published only)
  -- Combined and capped to p_content_limit total, most recent first.
  -- -------------------------------------------------------
  content_club_media as (
    select
      cmp.id                                        as target_id,
      cmp.title                                      as title,
      'Contenuto club'::text                         as subtitle,
      coalesce(cmp.thumbnail_url, cmp.visual_url)    as image_url,
      cmp.published_at                               as published_at
    from public.club_media_posts cmp
    where cmp.status = 'published'
      and cmp.title ilike '%' || v_term || '%'
  ),
  content_fan_tribuna as (
    select
      ftp.id                as target_id,
      ftp.title             as title,
      'Tribuna tifosi'::text as subtitle,
      null::text            as image_url,
      ftp.published_at      as published_at
    from public.fan_tribuna_posts ftp
    where ftp.status = 'published'
      and ftp.title ilike '%' || v_term || '%'
  ),
  contenuto_ranked as (
    select 'club_media'::text as target_type, * from content_club_media
    union all
    select 'fan_tribuna'::text as target_type, * from content_fan_tribuna
  ),
  contenuto as (
    select
      'contenuto'::text as group_key,
      cr.target_type,
      cr.target_id,
      cr.title,
      cr.subtitle,
      cr.image_url,
      row_number() over (order by cr.published_at desc) as rnk
    from contenuto_ranked cr
    order by cr.published_at desc
    limit v_content_limit
  )

  select combined.group_key, combined.target_type, combined.target_id,
         combined.title, combined.subtitle, combined.image_url
  from (
    select *, 1 as group_order from societa
    union all
    select *, 2 as group_order from profilo
    union all
    select *, 3 as group_order from posizione
    union all
    select *, 4 as group_order from contenuto
  ) combined
  order by combined.group_order, combined.rnk;
end;
$$;

revoke all on function public.search_global(text, int, int) from public;
grant execute on function public.search_global(text, int, int) to authenticated;


-- ============================================================
-- RPC: public.search_profiles_page
--
-- Paginated "Profili" tab. When p_query is null/empty, runs in browse mode
-- (no name filter, ordered by full_name asc) — used when opening the tab
-- from Esplora with no active query. When p_query is provided, results are
-- ranked by trigram similarity first, full_name asc as tie-break (the same
-- expression naturally covers both modes: similarity is forced to 0 when
-- there is no query, so the tie-break becomes the only ordering).
-- ============================================================

drop function if exists public.search_profiles_page(text, public.app_role, int, int);

create or replace function public.search_profiles_page(
  p_query  text default null,
  p_role   public.app_role default null,
  p_limit  int default 20,
  p_offset int default 0
)
returns table (
  profile_id        uuid,
  full_name         text,
  avatar_url        text,
  role              public.app_role,
  region            text,
  city              text,
  primary_position  public.player_position,
  current_club_name text,
  current_team_name text,
  age               int,
  is_available      boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_term   text := trim(coalesce(p_query, ''));
  v_limit  int  := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset int  := greatest(coalesce(p_offset, 0), 0);
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_role is not null and p_role::text not in ('player', 'coach', 'staff', 'agent') then
    raise exception 'Ruolo di ricerca non supportato';
  end if;

  return query
  select
    pwa.id                as profile_id,
    pwa.full_name,
    pwa.avatar_url,
    pwa.role,
    pwa.region,
    pwa.city,
    pp.primary_position,
    cm_club.name          as current_club_name,
    cm_team.name          as current_team_name,
    pwa.age,
    pwa.is_available
  from public.profiles_with_age pwa
  left join public.player_profiles pp on pp.profile_id = pwa.id
  left join lateral (
    select cm.club_id, cm.team_id
    from public.club_members cm
    where cm.profile_id = pwa.id
      and cm.status     = 'active'
      and cm.is_current  = true
    order by cm.created_at desc
    limit 1
  ) cm on true
  left join public.clubs      cm_club on cm_club.id = cm.club_id
  left join public.club_teams cm_team on cm_team.id = cm.team_id
  where pwa.role in ('player', 'coach', 'staff', 'agent')
    and (p_role is null or pwa.role = p_role)
    and (v_term = '' or pwa.full_name ilike '%' || v_term || '%')
  order by
    (case when v_term <> '' then similarity(lower(pwa.full_name), lower(v_term)) else 0 end) desc,
    pwa.full_name asc,
    pwa.id asc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.search_profiles_page(text, public.app_role, int, int) from public;
grant execute on function public.search_profiles_page(text, public.app_role, int, int) to authenticated;


-- ============================================================
-- RPC: public.search_clubs_page
--
-- Paginated "Società" tab: clubs and club_teams (squadre interne) merged
-- into one paginated set. p_kind:
--   null        → clubs + teams
--   'club'      → clubs only
--   'team'      → teams only
--   'affiliate' → clubs affiliated to another club (via club_affiliations)
-- ============================================================

drop function if exists public.search_clubs_page(text, text, int, int);

create or replace function public.search_clubs_page(
  p_query  text default null,
  p_kind   text default null,
  p_limit  int default 20,
  p_offset int default 0
)
returns table (
  kind             text,
  entity_id        uuid,
  name             text,
  logo_url         text,
  city             text,
  region           text,
  category         text,
  parent_club_name text,
  is_affiliate     boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_term   text := trim(coalesce(p_query, ''));
  v_limit  int  := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset int  := greatest(coalesce(p_offset, 0), 0);
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_kind is not null and p_kind not in ('club', 'team', 'affiliate') then
    raise exception 'Filtro società non supportato';
  end if;

  return query
  with
  clubs_q as (
    select
      'club'::text          as kind,
      c.id                  as entity_id,
      c.name                as name,
      c.logo_url            as logo_url,
      c.city                as city,
      c.region              as region,
      c.category            as category,
      null::text            as parent_club_name,
      exists (
        select 1 from public.club_affiliations ca
        where ca.affiliate_club_id = c.id
      )                     as is_affiliate,
      (case when v_term <> '' then similarity(lower(c.name), lower(v_term)) else 0 end) as rank_score
    from public.clubs c
    where v_term = '' or c.name ilike '%' || v_term || '%'
  ),
  teams_q as (
    select
      'team'::text          as kind,
      ct.id                 as entity_id,
      ct.name               as name,
      ct.logo_url           as logo_url,
      ct.city               as city,
      ct.region             as region,
      ct.category           as category,
      parent.name           as parent_club_name,
      false                 as is_affiliate,
      (case when v_term <> '' then similarity(lower(ct.name), lower(v_term)) else 0 end) as rank_score
    from public.club_teams ct
    join public.clubs parent on parent.id = ct.club_id
    where v_term = '' or ct.name ilike '%' || v_term || '%'
  ),
  combined as (
    select * from clubs_q
    union all
    select * from teams_q
  )
  select combined.kind, combined.entity_id, combined.name, combined.logo_url,
         combined.city, combined.region, combined.category,
         combined.parent_club_name, combined.is_affiliate
  from combined
  where
    case p_kind
      when 'club'      then combined.kind = 'club'
      when 'team'       then combined.kind = 'team'
      when 'affiliate'  then combined.kind = 'club' and combined.is_affiliate
      else true
    end
  order by combined.rank_score desc, combined.name asc, combined.entity_id asc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.search_clubs_page(text, text, int, int) from public;
grant execute on function public.search_clubs_page(text, text, int, int) to authenticated;


-- ============================================================
-- RPC: public.search_positions_page
--
-- Paginated "Posizioni" tab: published recruiting_ads only.
--   p_target      → filter by target_role ('player' | 'coach' | 'staff')
--   p_saved_only  → only ads the caller has saved (saved_ads)
-- ============================================================

drop function if exists public.search_positions_page(text, text, boolean, int, int);

create or replace function public.search_positions_page(
  p_query      text default null,
  p_target     text default null,
  p_saved_only boolean default false,
  p_limit      int default 20,
  p_offset     int default 0
)
returns table (
  ad_id         uuid,
  title         text,
  club_name     text,
  club_logo_url text,
  team_name     text,
  category      text,
  region        text,
  target_role   text,
  deadline      date,
  published_at  timestamptz,
  is_saved      boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_term   text := trim(coalesce(p_query, ''));
  v_limit  int  := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset int  := greatest(coalesce(p_offset, 0), 0);
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_target is not null and p_target not in ('player', 'coach', 'staff') then
    raise exception 'Ruolo target non supportato';
  end if;

  return query
  select
    ra.id            as ad_id,
    ra.title,
    c.name           as club_name,
    c.logo_url       as club_logo_url,
    ct.name          as team_name,
    ra.category,
    ra.region,
    ra.target_role,
    ra.deadline,
    ra.published_at,
    exists (
      select 1 from public.saved_ads sa
      where sa.ad_id = ra.id and sa.profile_id = v_uid
    )                as is_saved
  from public.recruiting_ads ra
  join public.clubs c on c.id = ra.club_id
  left join public.club_teams ct on ct.id = ra.team_id
  where ra.status = 'published'
    and (p_target is null or ra.target_role = p_target)
    and (
      v_term = ''
      or ra.title ilike '%' || v_term || '%'
      or ra.description ilike '%' || v_term || '%'
      or c.name ilike '%' || v_term || '%'
    )
    and (
      not p_saved_only
      or exists (
        select 1 from public.saved_ads sa
        where sa.ad_id = ra.id and sa.profile_id = v_uid
      )
    )
  order by
    (case when v_term <> '' then similarity(lower(ra.title), lower(v_term)) else 0 end) desc,
    ra.published_at desc,
    ra.id asc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.search_positions_page(text, text, boolean, int, int) from public;
grant execute on function public.search_positions_page(text, text, boolean, int, int) to authenticated;
