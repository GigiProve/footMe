-- Add fields for the multi-step club onboarding flow.
-- These support the "Completa il profilo" step and representative contact details.

-- Representative contact
alter table public.clubs add column if not exists representative_email text;
alter table public.clubs add column if not exists representative_phone text;

-- Profile completion
alter table public.clubs add column if not exists stadium text;
alter table public.clubs add column if not exists total_members integer;
alter table public.clubs add column if not exists instagram text;
alter table public.clubs add column if not exists facebook text;
alter table public.clubs add column if not exists youth_team_count integer;

-- Constraint: total_members must be positive if present
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clubs_total_members_positive'
  ) then
    alter table public.clubs add constraint clubs_total_members_positive
      check (total_members is null or total_members >= 0);
  end if;
end $$;
