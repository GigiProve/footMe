alter table public.coach_profiles
add column if not exists availability_type text,
add column if not exists preferred_provinces text[] not null default '{}';
