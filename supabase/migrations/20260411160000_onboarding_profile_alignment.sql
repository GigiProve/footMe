alter table public.profiles
  add column if not exists residence_country text,
  add column if not exists current_location_country text,
  add column if not exists current_location_city text,
  add column if not exists legal_status text;

alter table public.coach_profiles
  add column if not exists primary_role text,
  add column if not exists available_from text;

drop view if exists public.profiles_with_age;

create view public.profiles_with_age
with (security_invoker = true) as
select
  profile.id,
  profile.role,
  profile.full_name,
  profile.birth_date,
  public.calculate_age(profile.birth_date) as age,
  profile.nationality,
  profile.bio,
  profile.avatar_url,
  profile.region,
  profile.city,
  profile.gender,
  profile.residence,
  profile.domicile,
  profile.residence_country,
  profile.current_location_country,
  profile.current_location_city,
  profile.legal_status,
  profile.is_available,
  profile.is_open_to_transfer,
  profile.languages,
  profile.created_at,
  profile.updated_at
from public.profiles profile;

grant select on public.profiles_with_age to anon;
grant select on public.profiles_with_age to authenticated;

create or replace function public.save_coach_career_details(
  p_profile_id uuid,
  p_coach_profile jsonb default '{}'::jsonb,
  p_career_entries jsonb default '[]'::jsonb,
  p_player_career_entries jsonb default '[]'::jsonb,
  p_director_entries jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
begin
  if current_profile_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_user(p_profile_id) then
    raise exception 'Profile not accessible';
  end if;

  insert into public.coach_profiles (
    profile_id,
    licenses,
    coached_clubs,
    coached_categories,
    game_philosophy,
    technical_video_url,
    preferred_regions,
    preferred_provinces,
    availability_type,
    open_to_new_role,
    primary_role,
    available_from,
    preferred_formation,
    secondary_formations,
    play_styles,
    current_club,
    contract_end,
    preferred_categories
  )
  select
    p_profile_id,
    coalesce(payload.licenses, '{}'::text[]),
    coalesce(payload.coached_clubs, '{}'::text[]),
    coalesce(payload.coached_categories, '{}'::text[]),
    payload.game_philosophy,
    payload.technical_video_url,
    coalesce(payload.preferred_regions, '{}'::text[]),
    coalesce(payload.preferred_provinces, '{}'::text[]),
    payload.availability_type,
    coalesce(payload.open_to_new_role, false),
    payload.primary_role,
    payload.available_from,
    payload.preferred_formation,
    coalesce(payload.secondary_formations, '{}'::text[]),
    coalesce(payload.play_styles, '{}'::text[]),
    payload.current_club,
    payload.contract_end,
    coalesce(payload.preferred_categories, '{}'::text[])
  from jsonb_to_record(coalesce(p_coach_profile, '{}'::jsonb)) as payload(
    licenses text[],
    coached_clubs text[],
    coached_categories text[],
    game_philosophy text,
    technical_video_url text,
    preferred_regions text[],
    preferred_provinces text[],
    availability_type text,
    open_to_new_role boolean,
    primary_role text,
    available_from text,
    preferred_formation text,
    secondary_formations text[],
    play_styles text[],
    current_club text,
    contract_end text,
    preferred_categories text[]
  )
  on conflict (profile_id) do update
  set
    licenses = excluded.licenses,
    coached_clubs = excluded.coached_clubs,
    coached_categories = excluded.coached_categories,
    game_philosophy = excluded.game_philosophy,
    technical_video_url = excluded.technical_video_url,
    preferred_regions = excluded.preferred_regions,
    preferred_provinces = excluded.preferred_provinces,
    availability_type = excluded.availability_type,
    open_to_new_role = excluded.open_to_new_role,
    primary_role = excluded.primary_role,
    available_from = excluded.available_from,
    preferred_formation = excluded.preferred_formation,
    secondary_formations = excluded.secondary_formations,
    play_styles = excluded.play_styles,
    current_club = excluded.current_club,
    contract_end = excluded.contract_end,
    preferred_categories = excluded.preferred_categories,
    updated_at = timezone('utc', now());

  delete from public.coach_career_entries
  where coach_profile_id = p_profile_id;

  insert into public.coach_career_entries (
    id,
    coach_profile_id,
    team_name,
    team_logo_url,
    club_id,
    category,
    role,
    experience_type,
    seasons,
    period_start_month,
    period_start_year,
    period_end_month,
    period_end_year,
    season_details,
    results,
    description,
    sort_order
  )
  select
    coalesce(entry.id, gen_random_uuid()),
    p_profile_id,
    coalesce(entry.team_name, ''),
    entry.team_logo_url,
    entry.club_id,
    entry.category,
    coalesce(entry.role, ''),
    coalesce(entry.experience_type, 'SINGLE_SEASON'),
    coalesce(entry.seasons, '{}'::text[]),
    entry.period_start_month,
    entry.period_start_year,
    entry.period_end_month,
    entry.period_end_year,
    coalesce(entry.season_details, '{}'::jsonb),
    coalesce(entry.results, '[]'::jsonb),
    entry.description,
    coalesce(entry.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_career_entries, '[]'::jsonb)) as entry(
    id uuid,
    team_name text,
    team_logo_url text,
    club_id uuid,
    category text,
    role text,
    experience_type text,
    seasons text[],
    period_start_month text,
    period_start_year integer,
    period_end_month text,
    period_end_year integer,
    season_details jsonb,
    results jsonb,
    description text,
    sort_order integer
  );

  delete from public.coach_player_career_entries
  where coach_profile_id = p_profile_id;

  insert into public.coach_player_career_entries (
    id,
    coach_profile_id,
    team_name,
    team_logo_url,
    season,
    category,
    position,
    appearances,
    goals,
    assists,
    sort_order
  )
  select
    coalesce(entry.id, gen_random_uuid()),
    p_profile_id,
    coalesce(entry.team_name, ''),
    entry.team_logo_url,
    coalesce(entry.season, ''),
    entry.category,
    entry.position,
    coalesce(entry.appearances, 0),
    coalesce(entry.goals, 0),
    coalesce(entry.assists, 0),
    coalesce(entry.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_player_career_entries, '[]'::jsonb)) as entry(
    id uuid,
    team_name text,
    team_logo_url text,
    season text,
    category text,
    position text,
    appearances integer,
    goals integer,
    assists integer,
    sort_order integer
  );

  delete from public.coach_director_career_entries
  where coach_profile_id = p_profile_id;

  insert into public.coach_director_career_entries (
    id,
    coach_profile_id,
    team_name,
    team_logo_url,
    role,
    seasons,
    category,
    description,
    sort_order
  )
  select
    coalesce(entry.id, gen_random_uuid()),
    p_profile_id,
    coalesce(entry.team_name, ''),
    entry.team_logo_url,
    coalesce(entry.role, ''),
    coalesce(entry.seasons, '{}'::text[]),
    entry.category,
    entry.description,
    coalesce(entry.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_director_entries, '[]'::jsonb)) as entry(
    id uuid,
    team_name text,
    team_logo_url text,
    role text,
    seasons text[],
    category text,
    description text,
    sort_order integer
  );
end;
$$;
