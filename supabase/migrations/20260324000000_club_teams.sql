-- Club Teams: first team (senior) + youth sector teams
-- Each club has exactly one senior team and optionally multiple youth teams.

create table public.club_teams (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  category text not null,
  team_type text not null check (team_type in ('senior', 'youth')),
  parent_team_id uuid references public.club_teams(id) on delete set null,
  inherited boolean not null default true,
  logo_url text,
  city text,
  region text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Only youth teams can have a parent
alter table public.club_teams
  add constraint club_teams_parent_only_youth
  check (parent_team_id is null or team_type = 'youth');

-- One senior team per club
create unique index club_teams_one_senior
  on public.club_teams (club_id) where team_type = 'senior';

-- Lookup index
create index club_teams_club_id on public.club_teams (club_id);

-- Auto-update updated_at
create trigger set_updated_at_club_teams
  before update on public.club_teams
  for each row execute function public.set_updated_at();

-- RLS
alter table public.club_teams enable row level security;

create policy "Anyone can read teams"
  on public.club_teams for select using (true);

create policy "Club owner manages teams"
  on public.club_teams for all
  using (public.owns_club(club_id))
  with check (public.owns_club(club_id));
