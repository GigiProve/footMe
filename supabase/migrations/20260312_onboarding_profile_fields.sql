alter table public.profiles
add column if not exists gender text,
add column if not exists residence text,
add column if not exists domicile text,
add column if not exists phone_number text;

alter table public.player_profiles
add column if not exists media_urls text[] default '{}';
