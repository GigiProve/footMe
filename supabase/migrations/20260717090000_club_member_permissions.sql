-- Migration: minimal club permission system — generic grant table
-- (club + profile + permission key) plus a stable SQL helper and an RPC
-- that resolves the caller's effective Shortlist / Scouting permissions.
--
-- This is the first of three migrations for the Shortlist (scouting) feature.
-- No "Ruoli e permessi" system exists today: club authorization is currently
-- limited to owns_club() (single admin per club). This table introduces
-- per-member, per-key grants without touching that model — the owner keeps
-- implicit full access via owns_club(), grants only extend access to
-- additional active members.
--
-- Mirrors conventions from:
--   20260309000001_rls_policies.sql   (is_current_user / owns_club helpers)
--   20260323000000_club_members.sql   (named text CHECK constraints)
--   20260627090000_saved_profiles_clubs.sql (table/RLS style)
--   20260627090100_saved_following_rpcs.sql (RPC style)


-- ============================================================
-- TABLE: public.club_member_permissions
--
-- Row-per-grant (not boolean columns): auditable, revocation is a plain
-- delete, and a single generic RLS helper covers every permission key.
-- The permission_key CHECK is scoped to the "shortlist_*" group introduced
-- here; future permission groups extend it via drop + re-add of the
-- constraint (see convention note below).
-- ============================================================

create table if not exists public.club_member_permissions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null,
  granted_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (club_id, profile_id, permission_key)
);

-- Extensible: to add a future permission group, drop this constraint and
-- re-add it with the expanded value list in a new migration.
alter table public.club_member_permissions
  add constraint club_member_permissions_key_check
  check (permission_key in (
    'shortlist_view',
    'shortlist_create_lists',
    'shortlist_add_profiles',
    'shortlist_add_notes',
    'shortlist_edit_status',
    'shortlist_remove_profiles'
  ));

create index if not exists club_member_permissions_club_idx
  on public.club_member_permissions (club_id);

create index if not exists club_member_permissions_profile_idx
  on public.club_member_permissions (profile_id);


-- ============================================================
-- RLS: public.club_member_permissions
--
-- SELECT: the club owner or the grantee themselves.
-- INSERT: owner-only, and only for a club_members row that is active and
--         linked to an account (profile_id not null) — grants never target
--         manual-name-only roster entries.
-- DELETE: owner-only (revoke a grant).
-- No UPDATE policy: grants are immutable; changing one means delete + insert.
-- ============================================================

alter table public.club_member_permissions enable row level security;

drop policy if exists "owner or grantee reads permission grants" on public.club_member_permissions;
create policy "owner or grantee reads permission grants"
on public.club_member_permissions
for select
to authenticated
using (
  public.owns_club(club_id)
  or public.is_current_user(profile_id)
);

drop policy if exists "owner grants permissions to active members" on public.club_member_permissions;
create policy "owner grants permissions to active members"
on public.club_member_permissions
for insert
to authenticated
with check (
  public.owns_club(club_id)
  and exists (
    select 1
    from public.club_members cm
    where cm.club_id = club_member_permissions.club_id
      and cm.profile_id = club_member_permissions.profile_id
      and cm.profile_id is not null
      and cm.status = 'active'
  )
);

drop policy if exists "owner revokes permission grants" on public.club_member_permissions;
create policy "owner revokes permission grants"
on public.club_member_permissions
for delete
to authenticated
using (public.owns_club(club_id));


-- ============================================================
-- FUNCTION: public.has_club_permission
--
-- True when the caller owns the club (implicit full access) OR holds an
-- explicit grant for p_permission AND is still an active club member.
-- Tying the grant to club_members.status = 'active' means a removed member
-- loses access automatically — no cleanup of stale grants required.
-- ============================================================

create or replace function public.has_club_permission(
  p_club_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.owns_club(p_club_id)
    or exists (
      select 1
      from public.club_member_permissions perm
      join public.club_members cm
        on cm.club_id = perm.club_id
        and cm.profile_id = perm.profile_id
      where perm.club_id = p_club_id
        and perm.profile_id = auth.uid()
        and perm.permission_key = p_permission
        and cm.status = 'active'
    );
$$;

revoke all on function public.has_club_permission(uuid, text) from public;
grant execute on function public.has_club_permission(uuid, text) to authenticated;


-- ============================================================
-- RPC: public.fetch_my_shortlist_permissions
--
-- Resolves the caller's effective Shortlist / Scouting permissions per club.
-- Two branches, combined with UNION ALL:
--   - owner branch: every club the caller owns, all six flags true.
--   - member branch: every club where the caller is an active member with
--     at least one shortlist_* grant, flags derived with bool_or per key.
-- Ordered owner-first, then by club name; the mobile client takes the first
-- row (documented v1 limitation for multi-club membership).
--
-- This RPC is the only source of truth for club_id in the Shortlist feature:
-- the session provider only populates club_id for club_admin, so non-owner
-- staff with grants must resolve their club_id here.
-- ============================================================

drop function if exists public.fetch_my_shortlist_permissions();

create or replace function public.fetch_my_shortlist_permissions()
returns table (
  club_id              uuid,
  club_name            text,
  is_owner             boolean,
  can_view             boolean,
  can_create_lists     boolean,
  can_add_profiles     boolean,
  can_add_notes        boolean,
  can_edit_status      boolean,
  can_remove_profiles  boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  return query
  select *
  from (

    -- ── owner branch: implicit full access on every owned club ─────
    select
      c.id                 as club_id,
      c.name                as club_name,
      true                  as is_owner,
      true                  as can_view,
      true                  as can_create_lists,
      true                  as can_add_profiles,
      true                  as can_add_notes,
      true                  as can_edit_status,
      true                  as can_remove_profiles
    from public.clubs c
    where c.owner_profile_id = v_uid

    union all

    -- ── member branch: active membership with >=1 shortlist grant ──
    select
      cm.club_id,
      c.name                as club_name,
      false                 as is_owner,
      bool_or(perm.permission_key = 'shortlist_view')            as can_view,
      bool_or(perm.permission_key = 'shortlist_create_lists')    as can_create_lists,
      bool_or(perm.permission_key = 'shortlist_add_profiles')    as can_add_profiles,
      bool_or(perm.permission_key = 'shortlist_add_notes')       as can_add_notes,
      bool_or(perm.permission_key = 'shortlist_edit_status')     as can_edit_status,
      bool_or(perm.permission_key = 'shortlist_remove_profiles') as can_remove_profiles
    from public.club_members cm
    join public.clubs c
      on c.id = cm.club_id
    join public.club_member_permissions perm
      on perm.club_id = cm.club_id
      and perm.profile_id = cm.profile_id
    where cm.profile_id = v_uid
      and cm.status = 'active'
    group by cm.club_id, c.name

  ) rows
  order by rows.is_owner desc, rows.club_name;
end;
$$;

revoke all on function public.fetch_my_shortlist_permissions() from public;
grant execute on function public.fetch_my_shortlist_permissions() to authenticated;
