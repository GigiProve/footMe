create extension if not exists pgcrypto;

create type public.app_role as enum ('player', 'coach', 'staff', 'club_admin');
create type public.player_position as enum ('goalkeeper', 'defender', 'midfielder', 'forward');
create type public.preferred_foot as enum ('right', 'left', 'both');
create type public.connection_status as enum ('pending', 'accepted', 'rejected', 'blocked');
create type public.application_status as enum ('submitted', 'reviewing', 'shortlisted', 'rejected', 'withdrawn');
create type public.ad_status as enum ('draft', 'published', 'closed');
create type public.staff_specialization as enum (
  'fitness_coach',
  'goalkeeper_coach',
  'physiotherapist',
  'match_analyst',
  'team_manager',
  'other'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  full_name text not null,
  birth_date date,
  nationality text,
  bio text,
  avatar_url text,
  region text,
  city text,
  is_available boolean not null default false,
  is_open_to_transfer boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.player_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  preferred_foot public.preferred_foot,
  height_cm integer,
  weight_kg integer,
  primary_position public.player_position not null,
  secondary_position public.player_position,
  willing_to_change_club boolean not null default false,
  transfer_regions text[] not null default '{}',
  preferred_categories text[] not null default '{}',
  highlight_video_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.player_career_entries (
  id uuid primary key default gen_random_uuid(),
  player_profile_id uuid not null references public.player_profiles(profile_id) on delete cascade,
  season_label text not null,
  club_name text not null,
  competition_name text,
  appearances integer not null default 0,
  goals integer not null default 0,
  assists integer not null default 0,
  minutes_played integer not null default 0,
  awards text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.coach_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  licenses text[] not null default '{}',
  coached_clubs text[] not null default '{}',
  coached_categories text[] not null default '{}',
  game_philosophy text,
  technical_video_url text,
  preferred_regions text[] not null default '{}',
  open_to_new_role boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.staff_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  specialization public.staff_specialization not null,
  experience_summary text,
  certifications text[] not null default '{}',
  preferred_regions text[] not null default '{}',
  open_to_work boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  slug text not null unique,
  city text not null,
  region text not null,
  category text,
  league text,
  description text,
  logo_url text,
  gallery_urls text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.club_staff_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (club_id, profile_id)
);

create table public.recruiting_ads (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  role_required public.player_position not null,
  age_min integer,
  age_max integer,
  category text,
  region text,
  compensation_summary text,
  description text not null,
  status public.ad_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.saved_ads (
  ad_id uuid not null references public.recruiting_ads(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (ad_id, profile_id)
);

create table public.recruiting_applications (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.recruiting_ads(id) on delete cascade,
  applicant_profile_id uuid not null references public.profiles(id) on delete cascade,
  player_profile_id uuid not null references public.player_profiles(profile_id) on delete cascade,
  cover_message text,
  status public.application_status not null default 'submitted',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (ad_id, applicant_profile_id)
);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_profile_id uuid not null references public.profiles(id) on delete cascade,
  addressee_profile_id uuid not null references public.profiles(id) on delete cascade,
  status public.connection_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (requester_profile_id <> addressee_profile_id),
  unique (requester_profile_id, addressee_profile_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (conversation_id, profile_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  media_url text,
  sent_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz
);

create index profiles_role_idx on public.profiles(role);
create index clubs_region_idx on public.clubs(region);
create index recruiting_ads_status_idx on public.recruiting_ads(status);
create index recruiting_ads_region_idx on public.recruiting_ads(region);
create index recruiting_applications_ad_idx on public.recruiting_applications(ad_id);
create index connections_requester_idx on public.connections(requester_profile_id);
create index connections_addressee_idx on public.connections(addressee_profile_id);
create index messages_conversation_idx on public.messages(conversation_id, sent_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger player_profiles_set_updated_at
before update on public.player_profiles
for each row execute procedure public.set_updated_at();

create trigger coach_profiles_set_updated_at
before update on public.coach_profiles
for each row execute procedure public.set_updated_at();

create trigger staff_profiles_set_updated_at
before update on public.staff_profiles
for each row execute procedure public.set_updated_at();

create trigger clubs_set_updated_at
before update on public.clubs
for each row execute procedure public.set_updated_at();

create trigger recruiting_ads_set_updated_at
before update on public.recruiting_ads
for each row execute procedure public.set_updated_at();

create trigger recruiting_applications_set_updated_at
before update on public.recruiting_applications
for each row execute procedure public.set_updated_at();

create trigger connections_set_updated_at
before update on public.connections
for each row execute procedure public.set_updated_at();