-- Add new Info tab fields to player_profiles, create player_palmares table,
-- extend save_player_profile_details RPC, and add save_player_palmares RPC.

-- Step 1: New columns on player_profiles
alter table public.player_profiles
  add column if not exists open_to_trials boolean not null default false,
  add column if not exists player_objectives text[] not null default '{}'::text[],
  add column if not exists contract_status text,
  add column if not exists contract_expiry date,
  add column if not exists current_condition text;

-- Step 2: New player_palmares table
create table if not exists public.player_palmares (
  id uuid primary key default gen_random_uuid(),
  player_profile_id uuid not null references public.player_profiles(profile_id) on delete cascade,
  competition_name text not null,
  season_label text not null,
  club_name text not null,
  palmares_type text not null default 'trophy',  -- trophy | medal | top_scorer
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_player_palmares_profile on public.player_palmares(player_profile_id);

-- Step 3: RLS on player_palmares
alter table public.player_palmares enable row level security;

drop policy if exists "player palmares are readable by authenticated users" on public.player_palmares;
create policy "player palmares are readable by authenticated users"
on public.player_palmares
for select
to authenticated
using (true);

drop policy if exists "players can manage own palmares" on public.player_palmares;
create policy "players can manage own palmares"
on public.player_palmares
for all
to authenticated
using (public.is_current_user(player_profile_id))
with check (public.is_current_user(player_profile_id));

-- Step 4: Extend save_player_profile_details to include the 5 new fields
create or replace function public.save_player_profile_details(
  p_profile_id uuid,
  p_player_profile jsonb,
  p_career_entries jsonb default '[]'::jsonb
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

  insert into public.player_profiles (
    profile_id,
    preferred_foot,
    height_cm,
    weight_kg,
    primary_position,
    secondary_positions,
    willing_to_change_club,
    availability_type,
    transfer_regions,
    transfer_provinces,
    preferred_categories,
    highlight_video_url,
    open_to_trials,
    player_objectives,
    contract_status,
    contract_expiry,
    current_condition
  )
  select
    p_profile_id,
    payload.preferred_foot,
    payload.height_cm,
    payload.weight_kg,
    coalesce(payload.primary_position, 'central_midfielder'::public.player_position),
    coalesce(payload.secondary_positions, '{}'::public.player_position[]),
    coalesce(payload.willing_to_change_club, false),
    coalesce(payload.availability_type, 'ITALY'),
    coalesce(payload.transfer_regions, '{}'::text[]),
    coalesce(payload.transfer_provinces, '{}'::text[]),
    coalesce(payload.preferred_categories, '{}'::text[]),
    payload.highlight_video_url,
    coalesce(payload.open_to_trials, false),
    coalesce(payload.player_objectives, '{}'::text[]),
    payload.contract_status,
    payload.contract_expiry,
    payload.current_condition
  from jsonb_to_record(coalesce(p_player_profile, '{}'::jsonb)) as payload(
    preferred_foot public.preferred_foot,
    height_cm integer,
    weight_kg integer,
    primary_position public.player_position,
    secondary_positions public.player_position[],
    willing_to_change_club boolean,
    availability_type text,
    transfer_regions text[],
    transfer_provinces text[],
    preferred_categories text[],
    highlight_video_url text,
    open_to_trials boolean,
    player_objectives text[],
    contract_status text,
    contract_expiry date,
    current_condition text
  )
  on conflict (profile_id) do update
  set
    preferred_foot = excluded.preferred_foot,
    height_cm = excluded.height_cm,
    weight_kg = excluded.weight_kg,
    primary_position = excluded.primary_position,
    secondary_positions = excluded.secondary_positions,
    willing_to_change_club = excluded.willing_to_change_club,
    availability_type = excluded.availability_type,
    transfer_regions = excluded.transfer_regions,
    transfer_provinces = excluded.transfer_provinces,
    preferred_categories = excluded.preferred_categories,
    highlight_video_url = excluded.highlight_video_url,
    open_to_trials = excluded.open_to_trials,
    player_objectives = excluded.player_objectives,
    contract_status = excluded.contract_status,
    contract_expiry = excluded.contract_expiry,
    current_condition = excluded.current_condition,
    updated_at = timezone('utc', now());

  with provided_entries as (
    select *
    from jsonb_to_recordset(coalesce(p_career_entries, '[]'::jsonb)) as entry(
      id uuid,
      appearances integer,
      assists integer,
      awards text,
      club_id uuid,
      club_name text,
      competition_name text,
      goals integer,
      minutes_played integer,
      season_label text,
      sort_order integer,
      team_logo_url text,
      season_period text,
      period_start_month smallint,
      period_end_month smallint
    )
  )
  delete from public.player_career_entries career
  where career.player_profile_id = p_profile_id
    and not exists (
      select 1
      from provided_entries entry
      where entry.id is not null
        and entry.id = career.id
    );

  with provided_entries as (
    select *
    from jsonb_to_recordset(coalesce(p_career_entries, '[]'::jsonb)) as entry(
      id uuid,
      appearances integer,
      assists integer,
      awards text,
      club_id uuid,
      club_name text,
      competition_name text,
      goals integer,
      minutes_played integer,
      season_label text,
      sort_order integer,
      team_logo_url text,
      season_period text,
      period_start_month smallint,
      period_end_month smallint
    )
  )
  insert into public.player_career_entries (
    id,
    player_profile_id,
    season_label,
    club_name,
    competition_name,
    appearances,
    goals,
    assists,
    minutes_played,
    awards,
    sort_order,
    team_logo_url,
    club_id,
    season_period,
    period_start_month,
    period_end_month
  )
  select
    coalesce(entry.id, gen_random_uuid()),
    p_profile_id,
    entry.season_label,
    entry.club_name,
    entry.competition_name,
    coalesce(entry.appearances, 0),
    coalesce(entry.goals, 0),
    coalesce(entry.assists, 0),
    coalesce(entry.minutes_played, 0),
    entry.awards,
    coalesce(entry.sort_order, 0),
    entry.team_logo_url,
    entry.club_id,
    coalesce(entry.season_period, 'full'),
    entry.period_start_month,
    entry.period_end_month
  from provided_entries entry
  on conflict (id) do update
  set
    season_label = excluded.season_label,
    club_name = excluded.club_name,
    competition_name = excluded.competition_name,
    appearances = excluded.appearances,
    goals = excluded.goals,
    assists = excluded.assists,
    minutes_played = excluded.minutes_played,
    awards = excluded.awards,
    sort_order = excluded.sort_order,
    club_id = excluded.club_id,
    team_logo_url = excluded.team_logo_url,
    season_period = excluded.season_period,
    period_start_month = excluded.period_start_month,
    period_end_month = excluded.period_end_month;
end;
$$;

revoke all on function public.save_player_profile_details(uuid, jsonb, jsonb) from public;
grant execute on function public.save_player_profile_details(uuid, jsonb, jsonb) to authenticated;

-- Step 5: New save_player_palmares RPC
create or replace function public.save_player_palmares(
  p_profile_id uuid,
  p_entries jsonb
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

  -- Delete all existing entries for this player
  delete from public.player_palmares where player_profile_id = p_profile_id;

  -- Insert new entries
  insert into public.player_palmares (player_profile_id, competition_name, season_label, club_name, palmares_type, sort_order)
  select
    p_profile_id,
    (entry->>'competition_name')::text,
    (entry->>'season_label')::text,
    (entry->>'club_name')::text,
    coalesce((entry->>'palmares_type')::text, 'trophy'),
    coalesce((entry->>'sort_order')::integer, 0)
  from jsonb_array_elements(p_entries) as entry;
end;
$$;

revoke all on function public.save_player_palmares(uuid, jsonb) from public;
grant execute on function public.save_player_palmares(uuid, jsonb) to authenticated;
