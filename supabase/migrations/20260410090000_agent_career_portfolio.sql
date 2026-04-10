alter table public.agent_profiles
  add column if not exists agency_role text,
  add column if not exists period_start_month text,
  add column if not exists period_start_year integer,
  add column if not exists period_end_month text,
  add column if not exists period_end_year integer,
  add column if not exists operational_focuses text[] not null default '{}'::text[],
  add column if not exists operational_note text,
  add column if not exists operating_macro_areas text[] not null default '{}'::text[],
  add column if not exists operating_regions text[] not null default '{}'::text[];

create table if not exists public.agent_career_entries (
  id uuid primary key default gen_random_uuid(),
  agent_profile_id uuid not null references public.agent_profiles(profile_id) on delete cascade,
  agency_name text not null,
  agency_logo_url text,
  role text not null,
  period_start_month text,
  period_start_year integer,
  period_end_month text,
  period_end_year integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_agent_career_entries_profile
  on public.agent_career_entries(agent_profile_id, sort_order);

create table if not exists public.agent_managed_player_entries (
  id uuid primary key default gen_random_uuid(),
  agent_profile_id uuid not null references public.agent_profiles(profile_id) on delete cascade,
  linked_profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  avatar_url text,
  primary_position public.player_position,
  birth_year integer,
  category_label text,
  is_free_agent boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_agent_managed_player_entries_profile
  on public.agent_managed_player_entries(agent_profile_id, sort_order);

create index if not exists idx_agent_managed_player_entries_linked_profile
  on public.agent_managed_player_entries(linked_profile_id);

alter table public.agent_career_entries enable row level security;
alter table public.agent_managed_player_entries enable row level security;

drop policy if exists "agent career entries are readable by authenticated users" on public.agent_career_entries;
create policy "agent career entries are readable by authenticated users"
on public.agent_career_entries
for select
to authenticated
using (true);

drop policy if exists "agents can manage own career entries" on public.agent_career_entries;
create policy "agents can manage own career entries"
on public.agent_career_entries
for all
to authenticated
using (public.is_current_user(agent_profile_id))
with check (public.is_current_user(agent_profile_id));

drop policy if exists "agent managed players are readable by authenticated users" on public.agent_managed_player_entries;
create policy "agent managed players are readable by authenticated users"
on public.agent_managed_player_entries
for select
to authenticated
using (true);

drop policy if exists "agents can manage own managed players" on public.agent_managed_player_entries;
create policy "agents can manage own managed players"
on public.agent_managed_player_entries
for all
to authenticated
using (public.is_current_user(agent_profile_id))
with check (public.is_current_user(agent_profile_id));

create or replace function public.save_agent_profile_details(
  p_profile_id uuid,
  p_agent_profile jsonb default '{}'::jsonb,
  p_career_entries jsonb default '[]'::jsonb,
  p_managed_player_entries jsonb default '[]'::jsonb
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

  insert into public.agent_profiles (
    profile_id,
    agency_name,
    agency_logo_url,
    agency_role,
    managed_players_count,
    has_other_football_experience,
    other_football_roles,
    has_played_football,
    player_career_entries,
    player_types,
    main_player_roles,
    open_to_clubs,
    open_to_players,
    is_federation_licensed,
    federation,
    period_start_month,
    period_start_year,
    period_end_month,
    period_end_year,
    operational_focuses,
    operational_note,
    operating_macro_areas,
    operating_regions
  )
  select
    p_profile_id,
    payload.agency_name,
    payload.agency_logo_url,
    payload.agency_role,
    payload.managed_players_count,
    coalesce(payload.has_other_football_experience, false),
    coalesce(payload.other_football_roles, '{}'::text[]),
    coalesce(payload.has_played_football, false),
    coalesce(payload.player_career_entries, '[]'::jsonb),
    coalesce(payload.player_types, '{}'::text[]),
    coalesce(payload.main_player_roles, '{}'::public.player_position[]),
    coalesce(payload.open_to_clubs, true),
    coalesce(payload.open_to_players, true),
    coalesce(payload.is_federation_licensed, false),
    payload.federation,
    payload.period_start_month,
    payload.period_start_year,
    payload.period_end_month,
    payload.period_end_year,
    coalesce(payload.operational_focuses, '{}'::text[]),
    payload.operational_note,
    coalesce(payload.operating_macro_areas, '{}'::text[]),
    coalesce(payload.operating_regions, '{}'::text[])
  from jsonb_to_record(coalesce(p_agent_profile, '{}'::jsonb)) as payload(
    agency_name text,
    agency_logo_url text,
    agency_role text,
    managed_players_count text,
    has_other_football_experience boolean,
    other_football_roles text[],
    has_played_football boolean,
    player_career_entries jsonb,
    player_types text[],
    main_player_roles public.player_position[],
    open_to_clubs boolean,
    open_to_players boolean,
    is_federation_licensed boolean,
    federation text,
    period_start_month text,
    period_start_year integer,
    period_end_month text,
    period_end_year integer,
    operational_focuses text[],
    operational_note text,
    operating_macro_areas text[],
    operating_regions text[]
  )
  on conflict (profile_id) do update
  set
    agency_name = excluded.agency_name,
    agency_logo_url = excluded.agency_logo_url,
    agency_role = excluded.agency_role,
    managed_players_count = excluded.managed_players_count,
    has_other_football_experience = excluded.has_other_football_experience,
    other_football_roles = excluded.other_football_roles,
    has_played_football = excluded.has_played_football,
    player_career_entries = excluded.player_career_entries,
    player_types = excluded.player_types,
    main_player_roles = excluded.main_player_roles,
    open_to_clubs = excluded.open_to_clubs,
    open_to_players = excluded.open_to_players,
    is_federation_licensed = excluded.is_federation_licensed,
    federation = excluded.federation,
    period_start_month = excluded.period_start_month,
    period_start_year = excluded.period_start_year,
    period_end_month = excluded.period_end_month,
    period_end_year = excluded.period_end_year,
    operational_focuses = excluded.operational_focuses,
    operational_note = excluded.operational_note,
    operating_macro_areas = excluded.operating_macro_areas,
    operating_regions = excluded.operating_regions,
    updated_at = timezone('utc', now());

  delete from public.agent_career_entries
  where agent_profile_id = p_profile_id;

  insert into public.agent_career_entries (
    id,
    agent_profile_id,
    agency_name,
    agency_logo_url,
    role,
    period_start_month,
    period_start_year,
    period_end_month,
    period_end_year,
    sort_order
  )
  select
    coalesce(entry.id, gen_random_uuid()),
    p_profile_id,
    coalesce(entry.agency_name, ''),
    entry.agency_logo_url,
    coalesce(entry.role, ''),
    entry.period_start_month,
    entry.period_start_year,
    entry.period_end_month,
    entry.period_end_year,
    coalesce(entry.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_career_entries, '[]'::jsonb)) as entry(
    id uuid,
    agency_name text,
    agency_logo_url text,
    role text,
    period_start_month text,
    period_start_year integer,
    period_end_month text,
    period_end_year integer,
    sort_order integer
  );

  delete from public.agent_managed_player_entries
  where agent_profile_id = p_profile_id;

  insert into public.agent_managed_player_entries (
    id,
    agent_profile_id,
    linked_profile_id,
    display_name,
    avatar_url,
    primary_position,
    birth_year,
    category_label,
    is_free_agent,
    sort_order
  )
  select
    coalesce(entry.id, gen_random_uuid()),
    p_profile_id,
    entry.linked_profile_id,
    coalesce(entry.display_name, ''),
    entry.avatar_url,
    entry.primary_position,
    entry.birth_year,
    entry.category_label,
    coalesce(entry.is_free_agent, false),
    coalesce(entry.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_managed_player_entries, '[]'::jsonb)) as entry(
    id uuid,
    linked_profile_id uuid,
    display_name text,
    avatar_url text,
    primary_position public.player_position,
    birth_year integer,
    category_label text,
    is_free_agent boolean,
    sort_order integer
  );
end;
$$;

revoke all on function public.save_agent_profile_details(uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.save_agent_profile_details(uuid, jsonb, jsonb, jsonb) to authenticated;

create or replace function public.search_agent_player_candidates(
  p_query text,
  p_limit integer default 8
)
returns table (
  profile_id uuid,
  full_name text,
  avatar_url text,
  birth_year integer,
  region text,
  primary_position public.player_position,
  category_label text,
  is_free_agent boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with latest_category as (
    select distinct on (career.player_profile_id)
      career.player_profile_id,
      nullif(trim(career.competition_name), '') as category_label
    from public.player_career_entries career
    order by career.player_profile_id, career.sort_order asc, career.created_at desc
  )
  select
    profile.id as profile_id,
    profile.full_name,
    profile.avatar_url,
    case
      when profile.birth_date is not null
        then extract(year from profile.birth_date)::integer
      else null
    end as birth_year,
    profile.region,
    player.primary_position,
    coalesce(
      latest_category.category_label,
      nullif(player.preferred_categories[1], '')
    ) as category_label,
    coalesce(player.contract_status = 'svincolato', false) as is_free_agent
  from public.profiles profile
  join public.player_profiles player on player.profile_id = profile.id
  left join latest_category on latest_category.player_profile_id = profile.id
  where profile.role = 'player'
    and (
      p_query is null
      or trim(p_query) = ''
      or profile.full_name ilike '%' || trim(p_query) || '%'
    )
  order by
    case
      when p_query is not null and lower(profile.full_name) = lower(trim(p_query))
        then 0
      else 1
    end,
    profile.full_name asc
  limit greatest(coalesce(p_limit, 8), 1);
$$;

revoke all on function public.search_agent_player_candidates(text, integer) from public;
grant execute on function public.search_agent_player_candidates(text, integer) to authenticated;
