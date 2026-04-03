alter type public.app_role add value if not exists 'fan';
alter type public.app_role add value if not exists 'media';

create table if not exists public.fan_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  interest_categories text[] not null default '{}',
  interest_regions text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.media_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  entity_name text,
  short_description text,
  logo_url text,
  content_types text[] not null default '{}',
  focus_areas text[] not null default '{}',
  affiliation_type text,
  affiliation_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.fan_profiles enable row level security;
alter table public.media_profiles enable row level security;

drop policy if exists "fan profiles are readable by authenticated users" on public.fan_profiles;
create policy "fan profiles are readable by authenticated users"
on public.fan_profiles
for select
to authenticated
using (true);

drop policy if exists "fans can manage own profile" on public.fan_profiles;
create policy "fans can manage own profile"
on public.fan_profiles
for all
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop policy if exists "media profiles are readable by authenticated users" on public.media_profiles;
create policy "media profiles are readable by authenticated users"
on public.media_profiles
for select
to authenticated
using (true);

drop policy if exists "media users can manage own profile" on public.media_profiles;
create policy "media users can manage own profile"
on public.media_profiles
for all
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop trigger if exists fan_profiles_set_updated_at on public.fan_profiles;
create trigger fan_profiles_set_updated_at
before update on public.fan_profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists media_profiles_set_updated_at on public.media_profiles;
create trigger media_profiles_set_updated_at
before update on public.media_profiles
for each row execute procedure public.set_updated_at();

alter table public.profile_contacts add column if not exists tiktok text;
alter table public.profile_contacts add column if not exists youtube text;
alter table public.profile_contacts add column if not exists website text;
alter table public.profile_contacts add column if not exists show_tiktok boolean not null default false;
alter table public.profile_contacts add column if not exists show_youtube boolean not null default false;
alter table public.profile_contacts add column if not exists show_website boolean not null default false;
