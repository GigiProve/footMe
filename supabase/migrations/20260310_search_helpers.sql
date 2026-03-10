create or replace function public.search_profiles(
  search_text text default null,
  role_filter public.app_role default null,
  region_filter text default null,
  position_filter public.player_position default null
)
returns table (
  profile_id uuid,
  full_name text,
  role public.app_role,
  region text,
  city text,
  primary_position public.player_position,
  is_available boolean
)
language sql
stable
as $$
  select
    profile.id as profile_id,
    profile.full_name,
    profile.role,
    profile.region,
    profile.city,
    player.primary_position,
    profile.is_available
  from public.profiles profile
  left join public.player_profiles player on player.profile_id = profile.id
  where
    (search_text is null or profile.full_name ilike '%' || search_text || '%')
    and (role_filter is null or profile.role = role_filter)
    and (region_filter is null or profile.region = region_filter)
    and (position_filter is null or player.primary_position = position_filter)
  order by profile.full_name asc;
$$;

create or replace function public.search_recruiting_ads(
  search_text text default null,
  region_filter text default null,
  role_filter public.player_position default null,
  status_filter public.ad_status default 'published'
)
returns table (
  ad_id uuid,
  title text,
  club_name text,
  region text,
  category text,
  role_required public.player_position,
  compensation_summary text,
  status public.ad_status,
  created_at timestamptz
)
language sql
stable
as $$
  select
    ad.id as ad_id,
    ad.title,
    club.name as club_name,
    ad.region,
    ad.category,
    ad.role_required,
    ad.compensation_summary,
    ad.status,
    ad.created_at
  from public.recruiting_ads ad
  join public.clubs club on club.id = ad.club_id
  where
    (search_text is null or ad.title ilike '%' || search_text || '%' or ad.description ilike '%' || search_text || '%' or club.name ilike '%' || search_text || '%')
    and (region_filter is null or ad.region = region_filter)
    and (role_filter is null or ad.role_required = role_filter)
    and (status_filter is null or ad.status = status_filter)
  order by ad.created_at desc;
$$;