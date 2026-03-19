-- Fix infinite recursion in admin RLS policies.
-- The previous policies used:
--   exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
-- This causes recursion when applied to the profiles table itself, and can also
-- trigger it indirectly on other tables whose policies reference profiles.
--
-- Solution: a SECURITY DEFINER function that reads profiles bypassing RLS.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Re-create all admin policies using the new function.

-- profiles
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

-- clubs
drop policy if exists "Admins can view all clubs" on public.clubs;
create policy "Admins can view all clubs"
  on public.clubs for select
  using (public.is_admin());

drop policy if exists "Admins can update all clubs" on public.clubs;
create policy "Admins can update all clubs"
  on public.clubs for update
  using (public.is_admin());

-- club_claims
drop policy if exists "Admins can view all claims" on public.club_claims;
create policy "Admins can view all claims"
  on public.club_claims for select
  using (public.is_admin());

drop policy if exists "Admins can update claims" on public.club_claims;
create policy "Admins can update claims"
  on public.club_claims for update
  using (public.is_admin());

-- club_reports
drop policy if exists "Admins can view all reports" on public.club_reports;
create policy "Admins can view all reports"
  on public.club_reports for select
  using (public.is_admin());

drop policy if exists "Admins can update reports" on public.club_reports;
create policy "Admins can update reports"
  on public.club_reports for update
  using (public.is_admin());
