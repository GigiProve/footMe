-- Add new fields for the redesigned club onboarding flow.
-- All new columns are nullable (except country and verification_status which have defaults)
-- so existing data is not impacted.

-- Identity & branding
alter table public.clubs add column if not exists founding_year integer;
alter table public.clubs add column if not exists club_colors text;
alter table public.clubs add column if not exists country text not null default 'IT';

-- Location
alter table public.clubs add column if not exists headquarters_address text;
alter table public.clubs add column if not exists field_address text;

-- Contact
alter table public.clubs add column if not exists club_email text;
alter table public.clubs add column if not exists club_phone text;
alter table public.clubs add column if not exists website_url text;

-- Normalization (auto-populated via trigger)
alter table public.clubs add column if not exists normalized_name text;

-- Verification / trust
alter table public.clubs add column if not exists verification_status text not null default 'unverified';
alter table public.clubs add column if not exists verified_at timestamptz;
alter table public.clubs add column if not exists verified_by uuid references public.profiles(id);

-- Constraints (idempotent: skip if already present)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clubs_founding_year_range'
  ) then
    alter table public.clubs add constraint clubs_founding_year_range
      check (founding_year is null or (founding_year >= 1850 and founding_year <= extract(year from now())::integer));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'clubs_verification_status_values'
  ) then
    alter table public.clubs add constraint clubs_verification_status_values
      check (verification_status in ('unverified', 'pending_review', 'verified', 'flagged', 'suspended'));
  end if;
end $$;

-- Trigger to auto-populate normalized_name from name.
-- Uses the same logic as the client-side slugify(): NFD normalize, strip
-- diacritics, lowercase, replace non-alphanumeric with hyphens, trim hyphens.
create or replace function public.normalize_club_name()
returns trigger
language plpgsql
as $$
begin
  new.normalized_name := regexp_replace(
    regexp_replace(
      lower(
        translate(
          normalize(new.name, NFD),
          U&'\0300\0301\0302\0303\0304\0305\0306\0307\0308\030A\030B\030C\030D\030E\030F'
          || U&'\0310\0311\0312\0313\0314\0315\0316\0317\0318\0319\031A\031B\031C\031D\031E\031F'
          || U&'\0320\0321\0322\0323\0324\0325\0326\0327\0328\0329\032A\032B\032C\032D\032E\032F',
          ''
        )
      ),
      '[^a-z0-9]+', '-', 'g'
    ),
    '^-+|-+$', '', 'g'
  );
  return new;
end;
$$;

drop trigger if exists clubs_normalize_name on public.clubs;
create trigger clubs_normalize_name
before insert or update of name on public.clubs
for each row execute procedure public.normalize_club_name();

-- Backfill normalized_name for existing rows.
-- The trigger fires on UPDATE OF name, so we update name to itself.
update public.clubs set name = name where normalized_name is null;
