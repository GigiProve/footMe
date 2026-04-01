alter table public.staff_profiles
add column if not exists preferred_categories text[] not null default '{}';
