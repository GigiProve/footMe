-- Add admin flag to profiles and create tables for club claims/reports.

-- Admin flag on profiles
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Club verification review requests (auto-created when a club is registered)
-- Admin sees all clubs and can change their verification_status directly,
-- so no separate "review request" table is needed — the clubs table itself
-- serves as the queue (filter by verification_status).

-- Club claims: someone claims ownership of an existing club page
create table if not exists public.club_claims (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  claimant_profile_id uuid not null references public.profiles(id) on delete cascade,
  claimant_role_at_club text,
  claimant_email text,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (club_id, claimant_profile_id)
);

-- Club reports: someone flags a club page as fake/impersonation
create table if not exists public.club_reports (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  reporter_profile_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (club_id, reporter_profile_id)
);

-- RLS for club_claims
alter table public.club_claims enable row level security;

create policy "Admins can view all claims"
  on public.club_claims for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "Admins can update claims"
  on public.club_claims for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "Users can create claims"
  on public.club_claims for insert
  with check (claimant_profile_id = auth.uid());

create policy "Users can view own claims"
  on public.club_claims for select
  using (claimant_profile_id = auth.uid());

-- RLS for club_reports
alter table public.club_reports enable row level security;

create policy "Admins can view all reports"
  on public.club_reports for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "Admins can update reports"
  on public.club_reports for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "Users can create reports"
  on public.club_reports for insert
  with check (reporter_profile_id = auth.uid());

create policy "Users can view own reports"
  on public.club_reports for select
  using (reporter_profile_id = auth.uid());

-- Admin RLS: admins can read and update all clubs (for verification)
create policy "Admins can view all clubs"
  on public.clubs for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "Admins can update all clubs"
  on public.clubs for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- Admin RLS: admins can read all profiles (to see club owners)
create policy "Admins can view all profiles"
  on public.profiles for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
