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
  bio text,
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
    profile.bio,
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
