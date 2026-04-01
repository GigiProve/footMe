create table if not exists public.agent_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  agency_name text,
  agency_logo_url text,
  managed_players_count text,
  has_other_football_experience boolean not null default false,
  other_football_roles text[] not null default '{}',
  has_played_football boolean not null default false,
  player_career_entries jsonb not null default '[]'::jsonb,
  player_types text[] not null default '{}',
  main_player_roles public.player_position[] not null default '{}',
  open_to_clubs boolean not null default true,
  open_to_players boolean not null default true,
  is_federation_licensed boolean not null default false,
  federation text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.agent_profiles enable row level security;

drop policy if exists "agent profiles are readable by authenticated users" on public.agent_profiles;
create policy "agent profiles are readable by authenticated users"
on public.agent_profiles
for select
to authenticated
using (true);

drop policy if exists "agents can manage own profile" on public.agent_profiles;
create policy "agents can manage own profile"
on public.agent_profiles
for all
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop trigger if exists agent_profiles_set_updated_at on public.agent_profiles;
create trigger agent_profiles_set_updated_at
before update on public.agent_profiles
for each row execute procedure public.set_updated_at();
