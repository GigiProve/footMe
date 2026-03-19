-- Club season history: tracks what category/league a club played in across seasons.
-- Similar pattern to player_career_entries but for clubs.

create table if not exists public.club_season_entries (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  start_year integer not null check (start_year >= 1850 and start_year <= 2100),
  end_year integer check (end_year >= 1850 and end_year <= 2100),
  category text not null,
  league text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

-- end_year NULL means "current / ongoing"
-- CHECK: end_year >= start_year when both are set
alter table public.club_season_entries
  add constraint club_season_entries_year_range
  check (end_year is null or end_year >= start_year);

alter table public.club_season_entries enable row level security;

-- Everyone can read club season entries (public info)
create policy "club season entries are readable by authenticated users"
  on public.club_season_entries for select
  to authenticated
  using (true);

-- Club owners can manage their own club's season entries
create policy "club owners can insert season entries"
  on public.club_season_entries for insert
  to authenticated
  with check (
    exists (
      select 1 from public.clubs
      where clubs.id = club_id
        and clubs.owner_profile_id = auth.uid()
    )
  );

create policy "club owners can update season entries"
  on public.club_season_entries for update
  to authenticated
  using (
    exists (
      select 1 from public.clubs
      where clubs.id = club_id
        and clubs.owner_profile_id = auth.uid()
    )
  );

create policy "club owners can delete season entries"
  on public.club_season_entries for delete
  to authenticated
  using (
    exists (
      select 1 from public.clubs
      where clubs.id = club_id
        and clubs.owner_profile_id = auth.uid()
    )
  );

-- Admin access
create policy "admins can manage club season entries"
  on public.club_season_entries for all
  to authenticated
  using (public.is_admin());
