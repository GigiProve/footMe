-- Migration: Follow/Save feature — two new save tables (saved_profiles, saved_clubs)
-- with owner-only RLS policies mirroring the existing saved_ads pattern.
--
-- Mirrors conventions from:
--   20260309000000_initial_schema.sql  (table/constraint style)
--   20260309000001_rls_policies.sql    (saved_ads single "for all" policy)


-- ============================================================
-- RECONCILE pre-existing, untracked tables
--
-- A `saved_profiles` / `saved_clubs` table created out-of-band (not by any
-- migration) may already exist with an incompatible schema. No app code uses
-- such a table, so if it is EMPTY we drop it to recreate with the correct
-- schema; if it holds data we abort loudly so nothing is lost.
-- ============================================================

do $$
declare
  v_rows bigint;
begin
  if to_regclass('public.saved_profiles') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'saved_profiles'
         and column_name = 'owner_profile_id'
     ) then
    execute 'select count(*) from public.saved_profiles' into v_rows;
    if v_rows > 0 then
      raise exception
        'public.saved_profiles already exists with an incompatible schema and % row(s); aborting to avoid data loss. Reconcile this table manually, then re-run the migration.', v_rows;
    end if;
    raise notice 'Dropping empty incompatible public.saved_profiles to recreate it with the correct schema.';
    drop table public.saved_profiles cascade;
  end if;

  if to_regclass('public.saved_clubs') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'saved_clubs'
         and column_name = 'owner_profile_id'
     ) then
    execute 'select count(*) from public.saved_clubs' into v_rows;
    if v_rows > 0 then
      raise exception
        'public.saved_clubs already exists with an incompatible schema and % row(s); aborting to avoid data loss. Reconcile this table manually, then re-run the migration.', v_rows;
    end if;
    raise notice 'Dropping empty incompatible public.saved_clubs to recreate it with the correct schema.';
    drop table public.saved_clubs cascade;
  end if;
end $$;


-- ============================================================
-- TABLE: public.saved_profiles
-- ============================================================

create table if not exists public.saved_profiles (
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  target_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (owner_profile_id, target_profile_id),
  constraint saved_profiles_not_self check (owner_profile_id <> target_profile_id)
);

create index if not exists saved_profiles_target_idx
  on public.saved_profiles (target_profile_id);

alter table public.saved_profiles enable row level security;

drop policy if exists "users manage own saved profiles" on public.saved_profiles;
create policy "users manage own saved profiles"
on public.saved_profiles
for all
to authenticated
using (public.is_current_user(owner_profile_id))
with check (public.is_current_user(owner_profile_id));


-- ============================================================
-- TABLE: public.saved_clubs
-- ============================================================

create table if not exists public.saved_clubs (
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (owner_profile_id, club_id)
);

create index if not exists saved_clubs_club_idx
  on public.saved_clubs (club_id);

alter table public.saved_clubs enable row level security;

drop policy if exists "users manage own saved clubs" on public.saved_clubs;
create policy "users manage own saved clubs"
on public.saved_clubs
for all
to authenticated
using (public.is_current_user(owner_profile_id))
with check (public.is_current_user(owner_profile_id));
