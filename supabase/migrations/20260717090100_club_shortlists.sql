-- Migration: Shortlist (internal scouting) tables — club_shortlists and
-- club_shortlist_entries. Private, club-internal lists of observed profiles
-- with priority/status/notes, gated entirely by the shortlist_* permission
-- group introduced in 20260717090000_club_member_permissions.sql.
--
-- No policy allows unrestricted SELECT: shortlists and their entries are
-- invisible to anyone without an explicit grant or club ownership, including
-- SELECT. No UPDATE policy exists on club_shortlist_entries — value updates
-- (priority/status/note) go exclusively through the update_shortlist_entry
-- RPC in 20260717090200_shortlist_rpcs.sql, since RLS cannot distinguish
-- which columns a raw UPDATE touches.
--
-- Mirrors conventions from:
--   20260323000000_club_members.sql   (named text CHECK constraints)
--   20260324000000_club_teams.sql     (trigger + index style)
--   20260619100000_content_tag_states_targets_reports.sql (parent-scoped RLS via exists/join)


-- ============================================================
-- TABLE: public.club_shortlists
-- ============================================================

create table if not exists public.club_shortlists (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  description text,
  scope text not null default 'tutta_la_societa',
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.club_shortlists
  add constraint club_shortlists_scope_check
  check (scope in (
    'tutta_la_societa',
    'prima_squadra',
    'juniores',
    'under_17',
    'under_15'
  ));

create index if not exists club_shortlists_club_idx
  on public.club_shortlists (club_id);

create trigger set_updated_at_club_shortlists
  before update on public.club_shortlists
  for each row execute function public.set_updated_at();


-- ============================================================
-- TABLE: public.club_shortlist_entries
-- ============================================================

create table if not exists public.club_shortlist_entries (
  id uuid primary key default gen_random_uuid(),
  shortlist_id uuid not null references public.club_shortlists(id) on delete cascade,
  player_profile_id uuid not null references public.profiles(id) on delete cascade,
  priority text not null default 'media',
  evaluation_status text not null default 'da_valutare',
  internal_note text,
  added_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (shortlist_id, player_profile_id)
);

alter table public.club_shortlist_entries
  add constraint club_shortlist_entries_priority_check
  check (priority in ('alta', 'media', 'bassa'));

alter table public.club_shortlist_entries
  add constraint club_shortlist_entries_evaluation_status_check
  check (evaluation_status in (
    'da_valutare',
    'interessante',
    'da_contattare',
    'contattato',
    'non_prioritario',
    'scartato'
  ));

create index if not exists club_shortlist_entries_player_idx
  on public.club_shortlist_entries (player_profile_id);

create trigger set_updated_at_club_shortlist_entries
  before update on public.club_shortlist_entries
  for each row execute function public.set_updated_at();


-- ============================================================
-- RLS: public.club_shortlists
--
-- SELECT/INSERT/UPDATE/DELETE all gated by has_club_permission(); the owner
-- passes implicitly via owns_club() inside that helper. No using(true)
-- anywhere — a club member without shortlist_view sees zero rows.
-- ============================================================

alter table public.club_shortlists enable row level security;

drop policy if exists "authorized members read club shortlists" on public.club_shortlists;
create policy "authorized members read club shortlists"
on public.club_shortlists
for select
to authenticated
using (public.has_club_permission(club_id, 'shortlist_view'));

drop policy if exists "authorized members create club shortlists" on public.club_shortlists;
create policy "authorized members create club shortlists"
on public.club_shortlists
for insert
to authenticated
with check (
  public.has_club_permission(club_id, 'shortlist_create_lists')
  and public.is_current_user(created_by_profile_id)
);

drop policy if exists "authorized members update club shortlists" on public.club_shortlists;
create policy "authorized members update club shortlists"
on public.club_shortlists
for update
to authenticated
using (public.has_club_permission(club_id, 'shortlist_create_lists'))
with check (public.has_club_permission(club_id, 'shortlist_create_lists'));

drop policy if exists "authorized members delete club shortlists" on public.club_shortlists;
create policy "authorized members delete club shortlists"
on public.club_shortlists
for delete
to authenticated
using (public.has_club_permission(club_id, 'shortlist_create_lists'));


-- ============================================================
-- RLS: public.club_shortlist_entries
--
-- Permission checks are resolved against the parent list's club_id via
-- exists()/join, mirroring the club_media_tagged_profiles moderation
-- policy pattern. No UPDATE policy: see header note.
-- ============================================================

alter table public.club_shortlist_entries enable row level security;

drop policy if exists "authorized members read shortlist entries" on public.club_shortlist_entries;
create policy "authorized members read shortlist entries"
on public.club_shortlist_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.club_shortlists cs
    where cs.id = club_shortlist_entries.shortlist_id
      and public.has_club_permission(cs.club_id, 'shortlist_view')
  )
);

drop policy if exists "authorized members add shortlist entries" on public.club_shortlist_entries;
create policy "authorized members add shortlist entries"
on public.club_shortlist_entries
for insert
to authenticated
with check (
  public.is_current_user(added_by_profile_id)
  and exists (
    select 1
    from public.club_shortlists cs
    where cs.id = club_shortlist_entries.shortlist_id
      and public.has_club_permission(cs.club_id, 'shortlist_add_profiles')
  )
  and (
    internal_note is null
    or exists (
      select 1
      from public.club_shortlists cs
      where cs.id = club_shortlist_entries.shortlist_id
        and public.has_club_permission(cs.club_id, 'shortlist_add_notes')
    )
  )
);

drop policy if exists "authorized members remove shortlist entries" on public.club_shortlist_entries;
create policy "authorized members remove shortlist entries"
on public.club_shortlist_entries
for delete
to authenticated
using (
  exists (
    select 1
    from public.club_shortlists cs
    where cs.id = club_shortlist_entries.shortlist_id
      and public.has_club_permission(cs.club_id, 'shortlist_remove_profiles')
  )
);

-- Intentionally no UPDATE policy on club_shortlist_entries.
-- priority / evaluation_status / internal_note changes go exclusively
-- through public.update_shortlist_entry() in the next migration, which
-- enforces per-field permission checks that RLS alone cannot express.
