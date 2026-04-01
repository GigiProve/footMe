create table if not exists public.director_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  director_roles text[] not null default '{}',
  primary_role text,
  responsibilities text[] not null default '{}',
  experience_categories text[] not null default '{}',
  main_focus text,
  market_involvement text,
  career_entries jsonb not null default '[]'::jsonb,
  has_other_football_experience boolean not null default false,
  other_football_roles text[] not null default '{}',
  has_played_football boolean not null default false,
  player_career_entries jsonb not null default '[]'::jsonb,
  club_types text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.director_profiles enable row level security;

drop policy if exists "director profiles are readable by authenticated users" on public.director_profiles;
create policy "director profiles are readable by authenticated users"
on public.director_profiles
for select
to authenticated
using (true);

drop policy if exists "directors can manage own profile" on public.director_profiles;
create policy "directors can manage own profile"
on public.director_profiles
for all
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop trigger if exists director_profiles_set_updated_at on public.director_profiles;
create trigger director_profiles_set_updated_at
before update on public.director_profiles
for each row execute procedure public.set_updated_at();
