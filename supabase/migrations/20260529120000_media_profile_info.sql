alter table public.media_profiles
  add column if not exists editorial_type text,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists covered_competitions text[] not null default '{}',
  add column if not exists covered_teams text[] not null default '{}',
  add column if not exists covered_territories text[] not null default '{}',
  add column if not exists covered_topics text[] not null default '{}';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'media_profiles_verification_status_check'
  ) then
    alter table public.media_profiles
      add constraint media_profiles_verification_status_check
      check (verification_status in ('unverified', 'pending_review', 'verified'));
  end if;
end $$;

create table if not exists public.media_profile_channels (
  id uuid primary key default gen_random_uuid(),
  media_profile_id uuid not null references public.media_profiles(profile_id) on delete cascade,
  channel_type text not null,
  label text not null,
  url text not null,
  is_public boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint media_profile_channels_type_check check (
    channel_type in ('website', 'instagram', 'youtube', 'tiktok', 'x', 'twitter', 'facebook', 'newsletter', 'podcast', 'other')
  ),
  constraint media_profile_channels_label_check check (length(trim(label)) > 0),
  constraint media_profile_channels_url_check check (length(trim(url)) > 0)
);

create index if not exists media_profile_channels_profile_order_idx
  on public.media_profile_channels (media_profile_id, is_public, sort_order, label);

create table if not exists public.media_profile_authors (
  id uuid primary key default gen_random_uuid(),
  media_profile_id uuid not null references public.media_profiles(profile_id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  role_label text,
  avatar_url text,
  is_verified boolean not null default false,
  is_public boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint media_profile_authors_display_name_check check (length(trim(display_name)) > 0)
);

create index if not exists media_profile_authors_profile_order_idx
  on public.media_profile_authors (media_profile_id, is_public, sort_order, display_name);

alter table public.media_profile_posts
  add column if not exists author_id uuid references public.media_profile_authors(id) on delete set null;

create index if not exists media_profile_posts_author_idx
  on public.media_profile_posts (author_id);

create table if not exists public.media_profile_contacts (
  id uuid primary key default gen_random_uuid(),
  media_profile_id uuid not null references public.media_profiles(profile_id) on delete cascade,
  contact_type text not null,
  label text not null,
  value text not null,
  href text,
  is_public boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint media_profile_contacts_type_check check (
    contact_type in ('editorial', 'press', 'commercial', 'sponsor', 'phone', 'email', 'other')
  ),
  constraint media_profile_contacts_label_check check (length(trim(label)) > 0),
  constraint media_profile_contacts_value_check check (length(trim(value)) > 0)
);

create index if not exists media_profile_contacts_profile_order_idx
  on public.media_profile_contacts (media_profile_id, is_public, sort_order, label);

create table if not exists public.media_profile_verifications (
  id uuid primary key default gen_random_uuid(),
  media_profile_id uuid not null references public.media_profiles(profile_id) on delete cascade,
  verification_type text not null,
  label text not null,
  status text not null default 'verified',
  is_public boolean not null default true,
  sort_order integer not null default 0,
  verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint media_profile_verifications_type_check check (
    verification_type in ('profile_verified', 'registered_publication', 'authors_verified', 'identity_checked', 'other')
  ),
  constraint media_profile_verifications_status_check check (
    status in ('pending', 'verified', 'rejected')
  ),
  constraint media_profile_verifications_label_check check (length(trim(label)) > 0)
);

create index if not exists media_profile_verifications_profile_order_idx
  on public.media_profile_verifications (media_profile_id, is_public, status, sort_order, label);

alter table public.media_profile_channels enable row level security;
alter table public.media_profile_authors enable row level security;
alter table public.media_profile_contacts enable row level security;
alter table public.media_profile_verifications enable row level security;

drop policy if exists "public media profile channels readable by authenticated users" on public.media_profile_channels;
create policy "public media profile channels readable by authenticated users"
on public.media_profile_channels
for select
to authenticated
using (is_public or public.is_current_user(media_profile_id));

drop policy if exists "media owners manage own profile channels" on public.media_profile_channels;
create policy "media owners manage own profile channels"
on public.media_profile_channels
for all
to authenticated
using (public.is_current_user(media_profile_id))
with check (public.is_current_user(media_profile_id));

drop policy if exists "public media profile authors readable by authenticated users" on public.media_profile_authors;
create policy "public media profile authors readable by authenticated users"
on public.media_profile_authors
for select
to authenticated
using (is_public or public.is_current_user(media_profile_id));

drop policy if exists "media owners manage own profile authors" on public.media_profile_authors;
create policy "media owners manage own profile authors"
on public.media_profile_authors
for all
to authenticated
using (public.is_current_user(media_profile_id))
with check (public.is_current_user(media_profile_id));

drop policy if exists "public media profile contacts readable by authenticated users" on public.media_profile_contacts;
create policy "public media profile contacts readable by authenticated users"
on public.media_profile_contacts
for select
to authenticated
using (is_public or public.is_current_user(media_profile_id));

drop policy if exists "media owners manage own profile contacts" on public.media_profile_contacts;
create policy "media owners manage own profile contacts"
on public.media_profile_contacts
for all
to authenticated
using (public.is_current_user(media_profile_id))
with check (public.is_current_user(media_profile_id));

drop policy if exists "public media profile verifications readable by authenticated users" on public.media_profile_verifications;
create policy "public media profile verifications readable by authenticated users"
on public.media_profile_verifications
for select
to authenticated
using ((is_public and status = 'verified') or public.is_current_user(media_profile_id));

drop policy if exists "media owners manage own profile verifications" on public.media_profile_verifications;
create policy "media owners manage own profile verifications"
on public.media_profile_verifications
for all
to authenticated
using (public.is_current_user(media_profile_id))
with check (public.is_current_user(media_profile_id));

drop trigger if exists media_profile_channels_set_updated_at on public.media_profile_channels;
create trigger media_profile_channels_set_updated_at
before update on public.media_profile_channels
for each row execute procedure public.set_updated_at();

drop trigger if exists media_profile_authors_set_updated_at on public.media_profile_authors;
create trigger media_profile_authors_set_updated_at
before update on public.media_profile_authors
for each row execute procedure public.set_updated_at();

drop trigger if exists media_profile_contacts_set_updated_at on public.media_profile_contacts;
create trigger media_profile_contacts_set_updated_at
before update on public.media_profile_contacts
for each row execute procedure public.set_updated_at();

drop trigger if exists media_profile_verifications_set_updated_at on public.media_profile_verifications;
create trigger media_profile_verifications_set_updated_at
before update on public.media_profile_verifications
for each row execute procedure public.set_updated_at();
