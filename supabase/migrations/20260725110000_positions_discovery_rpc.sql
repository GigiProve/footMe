-- ============================================================
-- Cerca -> Posizioni aperte : guided discovery RPC
--
-- Replaces search_positions_page (from 20260722100000_search_cerca.sql)
-- with profile-matching, geographic filtering (regions / provinces /
-- radius) and multiple sort modes. Position location is resolved from
-- the target team (when the ad has team_id) otherwise the club, using
-- the geo columns backfilled in 20260725100000_comuni_geo.sql.
--
-- Backwards compatible: every new parameter has a default, so the
-- previous 5-argument callers still work.
--
-- Notes / data limits:
--   * role matching keys on recruiting_ads.role_required (player
--     positions); coach/staff match on target_role only.
--   * "Stagione" is not filterable (no season column on recruiting_ads).
--   * distance_km / radius require the resolved club/team coordinates;
--     positions without coordinates are excluded when a radius is given
--     and carry a null distance otherwise.
-- ============================================================

drop function if exists public.search_positions_page(text, text, boolean, int, int);

create or replace function public.search_positions_page(
  p_query              text default null,
  p_target             text default null,
  p_saved_only         boolean default false,
  p_positions          text[] default null,
  p_primary_positions  text[] default null,
  p_regions            text[] default null,
  p_provinces          text[] default null,
  p_categories         text[] default null,
  p_team_type          text default null,
  p_club_id            uuid default null,
  p_lat                double precision default null,
  p_lng                double precision default null,
  p_radius_km          double precision default null,
  p_sort               text default null,
  p_limit              int default 20,
  p_offset             int default 0
)
returns table (
  ad_id             uuid,
  title             text,
  club_name         text,
  club_logo_url     text,
  team_name         text,
  team_type         text,
  role_required     text,
  category          text,
  city              text,
  province          text,
  region            text,
  target_role       text,
  deadline          date,
  published_at      timestamptz,
  distance_km       double precision,
  is_secondary_match boolean,
  is_saved          boolean,
  total_count       bigint
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

  if p_sort is not null
     and p_sort not in ('pertinenza', 'recenti', 'vicinanza', 'categoria', 'localita') then
    raise exception 'Ordinamento non supportato';
  end if;

  return query
  with base as (
    select
      ra.id                                   as ad_id,
      ra.title                                as title,
      c.name                                  as club_name,
      c.logo_url                              as club_logo_url,
      ct.name                                 as team_name,
      ct.team_type                            as team_type,
      ra.role_required::text                  as role_required,
      ra.category                             as category,
      coalesce(ct.city, c.city)               as city,
      coalesce(ct.province, c.province)       as province,
      coalesce(ra.region, ct.region, c.region) as region,
      ra.target_role                          as target_role,
      ra.deadline                             as deadline,
      ra.published_at                         as published_at,
      case
        when p_lat is null or p_lng is null then null
        when coalesce(ct.latitude, c.latitude) is null then null
        else 6371 * acos(least(1, greatest(-1,
          sin(radians(p_lat)) * sin(radians(coalesce(ct.latitude, c.latitude))) +
          cos(radians(p_lat)) * cos(radians(coalesce(ct.latitude, c.latitude))) *
          cos(radians(coalesce(ct.longitude, c.longitude) - p_lng))
        )))
      end                                     as distance_km,
      coalesce(
        p_primary_positions is not null
          and not (ra.role_required::text = any(p_primary_positions)),
        false
      )                                       as is_secondary_match,
      exists (
        select 1 from public.saved_ads sa
        where sa.ad_id = ra.id and sa.profile_id = v_uid
      )                                       as is_saved,
      case
        when v_term <> '' then similarity(lower(ra.title), lower(v_term))
        else 0
      end                                     as title_sim
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
      -- role matching applies to player ads only
      and (
        p_positions is null
        or ra.target_role is distinct from 'player'
        or ra.role_required::text = any(p_positions)
      )
      and (p_regions is null
           or coalesce(ra.region, ct.region, c.region) = any(p_regions))
      and (p_provinces is null
           or coalesce(ct.province, c.province) = any(p_provinces))
      and (p_categories is null or ra.category = any(p_categories))
      and (p_team_type is null or ct.team_type = p_team_type)
      and (p_club_id is null or ra.club_id = p_club_id)
  )
  select
    base.ad_id,
    base.title,
    base.club_name,
    base.club_logo_url,
    base.team_name,
    base.team_type,
    base.role_required,
    base.category,
    base.city,
    base.province,
    base.region,
    base.target_role,
    base.deadline,
    base.published_at,
    base.distance_km,
    base.is_secondary_match,
    base.is_saved,
    count(*) over () as total_count
  from base
  where (
    p_lat is null or p_lng is null or p_radius_km is null
    or (base.distance_km is not null and base.distance_km <= p_radius_km)
  )
  order by
    -- the active sort mode leads; remaining keys break ties
    case when p_sort = 'vicinanza' then base.distance_km end asc nulls last,
    case when p_sort = 'recenti'   then base.published_at end desc nulls last,
    case when p_sort = 'categoria' then base.category end asc nulls last,
    case when p_sort = 'localita'  then base.region end asc nulls last,
    case when p_sort = 'localita'  then base.city end asc nulls last,
    base.is_secondary_match asc,
    base.title_sim desc,
    base.published_at desc,
    base.ad_id asc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.search_positions_page(
  text, text, boolean, text[], text[], text[], text[], text[], text, uuid,
  double precision, double precision, double precision, text, int, int
) from public;

grant execute on function public.search_positions_page(
  text, text, boolean, text[], text[], text[], text[], text[], text, uuid,
  double precision, double precision, double precision, text, int, int
) to authenticated;
