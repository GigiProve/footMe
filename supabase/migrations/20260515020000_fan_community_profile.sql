alter table public.fan_profiles
  add column if not exists favorite_team_name text,
  add column if not exists favorite_club_id uuid references public.clubs(id) on delete set null;

create index if not exists fan_profiles_favorite_club_idx
  on public.fan_profiles (favorite_club_id);

create table if not exists public.profile_follows (
  follower_profile_id uuid not null references public.profiles(id) on delete cascade,
  followed_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (follower_profile_id, followed_profile_id),
  constraint profile_follows_not_self check (follower_profile_id <> followed_profile_id)
);

create index if not exists profile_follows_followed_idx
  on public.profile_follows (followed_profile_id);

create table if not exists public.fan_media_posts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.fan_profiles(profile_id) on delete cascade,
  description text not null,
  tag text,
  visual_url text not null,
  visual_type text not null,
  thumbnail_url text,
  status text not null default 'published',
  published_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fan_media_posts_description_check check (
    length(trim(description)) between 1 and 280
  ),
  constraint fan_media_posts_visual_url_check check (length(trim(visual_url)) > 0),
  constraint fan_media_posts_visual_type_check check (visual_type in ('image', 'video')),
  constraint fan_media_posts_tag_check check (
    tag is null or tag in (
      'Partita',
      'Tifo',
      'Mercato',
      'Giovani',
      'Serie D',
      'Eccellenza',
      'Opinione',
      'Domanda',
      'Highlights'
    )
  ),
  constraint fan_media_posts_status_check check (status in ('draft', 'published', 'archived'))
);

create index if not exists fan_media_posts_profile_published_idx
  on public.fan_media_posts (profile_id, status, published_at desc);

create table if not exists public.fan_media_likes (
  post_id uuid not null references public.fan_media_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, profile_id)
);

create table if not exists public.saved_fan_media (
  post_id uuid not null references public.fan_media_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, profile_id)
);

create table if not exists public.fan_media_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.fan_media_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fan_media_comments_body_check check (length(trim(body)) > 0)
);

create index if not exists fan_media_comments_post_created_idx
  on public.fan_media_comments (post_id, created_at asc);

alter table public.profile_follows enable row level security;
alter table public.fan_media_posts enable row level security;
alter table public.fan_media_likes enable row level security;
alter table public.saved_fan_media enable row level security;
alter table public.fan_media_comments enable row level security;

drop policy if exists "profile follows readable by authenticated users" on public.profile_follows;
create policy "profile follows readable by authenticated users"
on public.profile_follows
for select
to authenticated
using (true);

drop policy if exists "users manage own profile follows" on public.profile_follows;
create policy "users manage own profile follows"
on public.profile_follows
for all
to authenticated
using (public.is_current_user(follower_profile_id))
with check (public.is_current_user(follower_profile_id));

drop policy if exists "published fan media readable by authenticated users" on public.fan_media_posts;
create policy "published fan media readable by authenticated users"
on public.fan_media_posts
for select
to authenticated
using (status = 'published');

drop policy if exists "fan owners manage own media posts" on public.fan_media_posts;
create policy "fan owners manage own media posts"
on public.fan_media_posts
for all
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop policy if exists "users read fan media likes" on public.fan_media_likes;
create policy "users read fan media likes"
on public.fan_media_likes
for select
to authenticated
using (
  exists (
    select 1
    from public.fan_media_posts post
    where post.id = post_id
      and post.status = 'published'
  )
);

drop policy if exists "users manage own fan media likes" on public.fan_media_likes;
create policy "users manage own fan media likes"
on public.fan_media_likes
for all
to authenticated
using (public.is_current_user(profile_id))
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1
    from public.fan_media_posts post
    where post.id = post_id
      and post.status = 'published'
  )
);

drop policy if exists "users read own saved fan media" on public.saved_fan_media;
create policy "users read own saved fan media"
on public.saved_fan_media
for select
to authenticated
using (public.is_current_user(profile_id));

drop policy if exists "users manage own saved fan media" on public.saved_fan_media;
create policy "users manage own saved fan media"
on public.saved_fan_media
for all
to authenticated
using (public.is_current_user(profile_id))
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1
    from public.fan_media_posts post
    where post.id = post_id
      and post.status = 'published'
  )
);

drop policy if exists "published fan media comments readable by authenticated users" on public.fan_media_comments;
create policy "published fan media comments readable by authenticated users"
on public.fan_media_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.fan_media_posts post
    where post.id = post_id
      and post.status = 'published'
  )
);

drop policy if exists "users insert own fan media comments" on public.fan_media_comments;
create policy "users insert own fan media comments"
on public.fan_media_comments
for insert
to authenticated
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1
    from public.fan_media_posts post
    where post.id = post_id
      and post.status = 'published'
  )
);

drop policy if exists "users update own fan media comments" on public.fan_media_comments;
create policy "users update own fan media comments"
on public.fan_media_comments
for update
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop policy if exists "users and authors delete fan media comments" on public.fan_media_comments;
create policy "users and authors delete fan media comments"
on public.fan_media_comments
for delete
to authenticated
using (
  public.is_current_user(profile_id)
  or exists (
    select 1
    from public.fan_media_posts post
    where post.id = post_id
      and public.is_current_user(post.profile_id)
  )
);

drop trigger if exists fan_media_posts_set_updated_at on public.fan_media_posts;
create trigger fan_media_posts_set_updated_at
before update on public.fan_media_posts
for each row execute procedure public.set_updated_at();

drop trigger if exists fan_media_comments_set_updated_at on public.fan_media_comments;
create trigger fan_media_comments_set_updated_at
before update on public.fan_media_comments
for each row execute procedure public.set_updated_at();
