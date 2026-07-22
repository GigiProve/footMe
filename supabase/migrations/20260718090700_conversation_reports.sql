-- Migration: conversation_reports table + report_conversation() RPC.
--
-- Mirrors conventions from:
--   20260619100000_content_tag_states_targets_reports.sql (content_tag_reports:
--     reporter-only SELECT, no direct INSERT policy, writes via RPC)
--   20260319400000_fix_admin_rls_recursion.sql (is_admin() security definer
--     helper used for the admin SELECT/UPDATE policies here)


-- ============================================================
-- TABLE: public.conversation_reports
-- ============================================================

create table if not exists public.conversation_reports (
  id                  uuid        primary key default gen_random_uuid(),
  conversation_id     uuid        not null references public.conversations(id) on delete cascade,
  reporter_profile_id uuid        not null references public.profiles(id) on delete cascade,
  reason              text        not null,
  details             text,
  status              text        not null default 'open',
  created_at          timestamptz not null default timezone('utc', now()),

  constraint conversation_reports_reason_check
    check (reason in ('spam', 'messaggio_inappropriato', 'profilo_falso', 'molestie', 'altro')),

  constraint conversation_reports_status_check
    check (status in ('open', 'reviewing', 'resolved', 'dismissed'))
);

create index if not exists conversation_reports_status_created_idx
  on public.conversation_reports (status, created_at desc);

alter table public.conversation_reports enable row level security;

-- Reporters may read their own report rows.
drop policy if exists "reporter reads own conversation reports" on public.conversation_reports;
create policy "reporter reads own conversation reports"
  on public.conversation_reports
  for select
  to authenticated
  using (public.is_current_user(reporter_profile_id));

-- Admins can read and triage all reports.
drop policy if exists "admin reads all conversation reports" on public.conversation_reports;
create policy "admin reads all conversation reports"
  on public.conversation_reports
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admin updates conversation reports" on public.conversation_reports;
create policy "admin updates conversation reports"
  on public.conversation_reports
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No direct INSERT policy; all writes go through report_conversation() RPC.


-- ============================================================
-- RPC: public.report_conversation
-- ============================================================

create or replace function public.report_conversation(
  target_conversation_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
  result_id           uuid;
begin
  if current_profile_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = target_conversation_id
      and participant.profile_id = current_profile_id
  ) then
    raise exception 'Conversazione non trovata';
  end if;

  if p_reason not in ('spam', 'messaggio_inappropriato', 'profilo_falso', 'molestie', 'altro') then
    raise exception 'Motivazione non valida';
  end if;

  -- left()/trim() are strict, so a null p_details stays null here — no
  -- special-casing needed to keep this null-safe.
  insert into public.conversation_reports (conversation_id, reporter_profile_id, reason, details)
  values (target_conversation_id, current_profile_id, p_reason, left(trim(p_details), 2000))
  returning id into result_id;

  return result_id;
end;
$$;

revoke all on function public.report_conversation(uuid, text, text) from public;
grant execute on function public.report_conversation(uuid, text, text) to authenticated;
