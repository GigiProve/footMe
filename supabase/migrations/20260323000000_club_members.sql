-- Club members table: unified roster for players, staff, coaches, directors.
-- Supports both manual entries (name-only) and linked profiles.

create table public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  manual_name text,
  member_role text not null,
  staff_title text,
  status text not null default 'active',
  added_by text not null default 'admin_manual',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Must be player, staff, coach, or director
alter table public.club_members add constraint club_members_role_check
  check (member_role in ('player', 'staff', 'coach', 'director'));

-- Status values
alter table public.club_members add constraint club_members_status_check
  check (status in ('active', 'rejected', 'removed'));

-- How the member was added
alter table public.club_members add constraint club_members_added_by_check
  check (added_by in ('admin_manual', 'self_request', 'invite_link'));

-- Must have either a linked profile or a manual name
alter table public.club_members add constraint club_members_has_identity
  check (profile_id is not null or manual_name is not null);

-- A profile can only be linked once per club
create unique index club_members_unique_profile
  on public.club_members (club_id, profile_id)
  where profile_id is not null;

-- RLS
alter table public.club_members enable row level security;

create policy "club members readable by authenticated users"
  on public.club_members for select to authenticated using (true);

create policy "club owners can insert members"
  on public.club_members for insert to authenticated
  with check (public.owns_club(club_id));

create policy "club owners can update members"
  on public.club_members for update to authenticated
  using (public.owns_club(club_id))
  with check (public.owns_club(club_id));

create policy "club owners can delete members"
  on public.club_members for delete to authenticated
  using (public.owns_club(club_id));

-- Users can request their own membership (self_request)
create policy "users can request own membership"
  on public.club_members for insert to authenticated
  with check (
    profile_id = auth.uid()
    and added_by = 'self_request'
  );

-- Users can update their own membership (e.g. leave)
create policy "users can update own membership"
  on public.club_members for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
