create table if not exists public.coach_career_entries (
  id uuid primary key default gen_random_uuid(),
  coach_profile_id uuid not null references public.coach_profiles(profile_id) on delete cascade,
  team_name text not null,
  team_logo_url text,
  club_id uuid references public.clubs(id) on delete set null,
  category text,
  role text not null,
  experience_type text not null default 'SINGLE_SEASON',
  seasons text[] not null default '{}'::text[],
  period_start_month text,
  period_start_year integer,
  period_end_month text,
  period_end_year integer,
  season_details jsonb not null default '{}'::jsonb,
  results jsonb not null default '[]'::jsonb,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_coach_career_entries_profile
  on public.coach_career_entries(coach_profile_id, sort_order);

create table if not exists public.coach_player_career_entries (
  id uuid primary key default gen_random_uuid(),
  coach_profile_id uuid not null references public.coach_profiles(profile_id) on delete cascade,
  team_name text not null,
  team_logo_url text,
  season text not null,
  category text,
  position text,
  appearances integer not null default 0,
  goals integer not null default 0,
  assists integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_coach_player_career_entries_profile
  on public.coach_player_career_entries(coach_profile_id, sort_order);

create table if not exists public.coach_director_career_entries (
  id uuid primary key default gen_random_uuid(),
  coach_profile_id uuid not null references public.coach_profiles(profile_id) on delete cascade,
  team_name text not null,
  team_logo_url text,
  role text not null,
  seasons text[] not null default '{}'::text[],
  category text,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_coach_director_career_entries_profile
  on public.coach_director_career_entries(coach_profile_id, sort_order);

alter table public.coach_career_entries enable row level security;
alter table public.coach_player_career_entries enable row level security;
alter table public.coach_director_career_entries enable row level security;

drop policy if exists "coach career entries are readable by authenticated users" on public.coach_career_entries;
create policy "coach career entries are readable by authenticated users"
on public.coach_career_entries
for select
to authenticated
using (true);

drop policy if exists "coaches can manage own career entries" on public.coach_career_entries;
create policy "coaches can manage own career entries"
on public.coach_career_entries
for all
to authenticated
using (public.is_current_user(coach_profile_id))
with check (public.is_current_user(coach_profile_id));

drop policy if exists "coach player career entries are readable by authenticated users" on public.coach_player_career_entries;
create policy "coach player career entries are readable by authenticated users"
on public.coach_player_career_entries
for select
to authenticated
using (true);

drop policy if exists "coaches can manage own player career entries" on public.coach_player_career_entries;
create policy "coaches can manage own player career entries"
on public.coach_player_career_entries
for all
to authenticated
using (public.is_current_user(coach_profile_id))
with check (public.is_current_user(coach_profile_id));

drop policy if exists "coach director career entries are readable by authenticated users" on public.coach_director_career_entries;
create policy "coach director career entries are readable by authenticated users"
on public.coach_director_career_entries
for select
to authenticated
using (true);

drop policy if exists "coaches can manage own director career entries" on public.coach_director_career_entries;
create policy "coaches can manage own director career entries"
on public.coach_director_career_entries
for all
to authenticated
using (public.is_current_user(coach_profile_id))
with check (public.is_current_user(coach_profile_id));

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
    open_to_new_role
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
    coalesce(payload.open_to_new_role, false)
  from jsonb_to_record(coalesce(p_coach_profile, '{}'::jsonb)) as payload(
    licenses text[],
    coached_clubs text[],
    coached_categories text[],
    game_philosophy text,
    technical_video_url text,
    preferred_regions text[],
    preferred_provinces text[],
    availability_type text,
    open_to_new_role boolean
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

revoke all on function public.save_coach_career_details(uuid, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.save_coach_career_details(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
