alter table public.coach_profiles
add column if not exists media_items jsonb not null default '[]'::jsonb;
