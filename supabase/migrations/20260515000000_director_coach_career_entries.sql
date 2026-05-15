alter table public.director_profiles
add column if not exists coach_career_entries jsonb not null default '[]'::jsonb;
