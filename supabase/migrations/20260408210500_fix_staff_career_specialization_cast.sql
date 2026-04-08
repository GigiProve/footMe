create or replace function public.save_staff_career_details(
  p_profile_id uuid,
  p_staff_profile jsonb default '{}'::jsonb,
  p_career_entries jsonb default '[]'::jsonb,
  p_coach_career_entries jsonb default '[]'::jsonb,
  p_player_career_entries jsonb default '[]'::jsonb
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

  insert into public.staff_profiles (
    profile_id,
    specialization,
    experience_summary,
    certifications,
    preferred_regions,
    preferred_provinces,
    availability_type,
    open_to_work,
    preferred_categories,
    staff_roles,
    primary_staff_role,
    available_from
  )
  select
    p_profile_id,
    case
      when payload.specialization in (
        'fitness_coach',
        'goalkeeper_coach',
        'physiotherapist',
        'match_analyst',
        'team_manager',
        'other'
      )
        then payload.specialization::public.staff_specialization
      else 'other'::public.staff_specialization
    end,
    payload.experience_summary,
    coalesce(payload.certifications, '{}'::text[]),
    coalesce(payload.preferred_regions, '{}'::text[]),
    coalesce(payload.preferred_provinces, '{}'::text[]),
    payload.availability_type,
    coalesce(payload.open_to_work, false),
    coalesce(payload.preferred_categories, '{}'::text[]),
    coalesce(payload.staff_roles, '{}'::text[]),
    payload.primary_staff_role,
    payload.available_from
  from jsonb_to_record(coalesce(p_staff_profile, '{}'::jsonb)) as payload(
    specialization text,
    experience_summary text,
    certifications text[],
    preferred_regions text[],
    preferred_provinces text[],
    availability_type text,
    open_to_work boolean,
    preferred_categories text[],
    staff_roles text[],
    primary_staff_role text,
    available_from text
  )
  on conflict (profile_id) do update
  set
    specialization = excluded.specialization,
    experience_summary = excluded.experience_summary,
    certifications = excluded.certifications,
    preferred_regions = excluded.preferred_regions,
    preferred_provinces = excluded.preferred_provinces,
    availability_type = excluded.availability_type,
    open_to_work = excluded.open_to_work,
    preferred_categories = excluded.preferred_categories,
    staff_roles = excluded.staff_roles,
    primary_staff_role = excluded.primary_staff_role,
    available_from = excluded.available_from,
    updated_at = timezone('utc', now());

  delete from public.staff_career_entries
  where staff_profile_id = p_profile_id;

  insert into public.staff_career_entries (
    id,
    staff_profile_id,
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
    head_coach_name,
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
    entry.head_coach_name,
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
    head_coach_name text,
    sort_order integer
  );

  delete from public.staff_coach_career_entries
  where staff_profile_id = p_profile_id;

  insert into public.staff_coach_career_entries (
    id,
    staff_profile_id,
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
    head_coach_name,
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
    entry.head_coach_name,
    coalesce(entry.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_coach_career_entries, '[]'::jsonb)) as entry(
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
    head_coach_name text,
    sort_order integer
  );

  delete from public.staff_player_career_entries
  where staff_profile_id = p_profile_id;

  insert into public.staff_player_career_entries (
    id,
    staff_profile_id,
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
end;
$$;

revoke all on function public.save_staff_career_details(uuid, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.save_staff_career_details(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
