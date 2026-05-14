create table if not exists public.club_media_posts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  kind text not null,
  title text not null,
  excerpt text,
  body text,
  visual_url text,
  visual_type text,
  thumbnail_url text,
  video_duration_seconds integer,
  player_name text,
  player_role text,
  player_birth_year integer,
  player_previous_club text,
  interviewee_name text,
  event_date timestamptz,
  attachment_label text,
  external_url text,
  status text not null default 'published',
  published_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint club_media_posts_kind_check check (
    kind in ('highlights', 'interview', 'market', 'statement', 'training', 'event')
  ),
  constraint club_media_posts_visual_type_check check (
    visual_type is null or visual_type in ('image', 'video')
  ),
  constraint club_media_posts_status_check check (
    status in ('draft', 'published', 'archived')
  ),
  constraint club_media_posts_duration_check check (
    video_duration_seconds is null or video_duration_seconds >= 0
  ),
  constraint club_media_posts_birth_year_check check (
    player_birth_year is null or player_birth_year between 1900 and 2100
  )
);

create index if not exists club_media_posts_club_published_idx
  on public.club_media_posts (club_id, status, published_at desc);

create table if not exists public.club_media_tagged_profiles (
  post_id uuid not null references public.club_media_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, profile_id)
);

create table if not exists public.club_media_likes (
  post_id uuid not null references public.club_media_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, profile_id)
);

create table if not exists public.saved_club_media (
  post_id uuid not null references public.club_media_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, profile_id)
);

create table if not exists public.club_media_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.club_media_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint club_media_comments_body_check check (length(trim(body)) > 0)
);

create index if not exists club_media_comments_post_created_idx
  on public.club_media_comments (post_id, created_at asc);

alter table public.club_media_posts enable row level security;
alter table public.club_media_tagged_profiles enable row level security;
alter table public.club_media_likes enable row level security;
alter table public.saved_club_media enable row level security;
alter table public.club_media_comments enable row level security;

drop policy if exists "published club media readable by authenticated users" on public.club_media_posts;
create policy "published club media readable by authenticated users"
on public.club_media_posts
for select
to authenticated
using (status = 'published');

drop policy if exists "club owners manage club media posts" on public.club_media_posts;
create policy "club owners manage club media posts"
on public.club_media_posts
for all
to authenticated
using (public.owns_club(club_id))
with check (public.owns_club(club_id) and public.is_current_user(created_by_profile_id));

drop policy if exists "published club media tags readable by authenticated users" on public.club_media_tagged_profiles;
create policy "published club media tags readable by authenticated users"
on public.club_media_tagged_profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.club_media_posts post
    where post.id = post_id
      and post.status = 'published'
  )
);

drop policy if exists "club owners manage club media tags" on public.club_media_tagged_profiles;
create policy "club owners manage club media tags"
on public.club_media_tagged_profiles
for all
to authenticated
using (
  exists (
    select 1
    from public.club_media_posts post
    where post.id = post_id
      and public.owns_club(post.club_id)
  )
)
with check (
  exists (
    select 1
    from public.club_media_posts post
    where post.id = post_id
      and public.owns_club(post.club_id)
  )
);

drop policy if exists "users read club media likes" on public.club_media_likes;
create policy "users read club media likes"
on public.club_media_likes
for select
to authenticated
using (
  exists (
    select 1
    from public.club_media_posts post
    where post.id = post_id
      and post.status = 'published'
  )
);

drop policy if exists "users manage own club media likes" on public.club_media_likes;
create policy "users manage own club media likes"
on public.club_media_likes
for all
to authenticated
using (public.is_current_user(profile_id))
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1
    from public.club_media_posts post
    where post.id = post_id
      and post.status = 'published'
  )
);

drop policy if exists "users read own saved club media" on public.saved_club_media;
create policy "users read own saved club media"
on public.saved_club_media
for select
to authenticated
using (public.is_current_user(profile_id));

drop policy if exists "users manage own saved club media" on public.saved_club_media;
create policy "users manage own saved club media"
on public.saved_club_media
for all
to authenticated
using (public.is_current_user(profile_id))
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1
    from public.club_media_posts post
    where post.id = post_id
      and post.status = 'published'
  )
);

drop policy if exists "published club media comments readable by authenticated users" on public.club_media_comments;
create policy "published club media comments readable by authenticated users"
on public.club_media_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.club_media_posts post
    where post.id = post_id
      and post.status = 'published'
  )
);

drop policy if exists "users insert own club media comments" on public.club_media_comments;
create policy "users insert own club media comments"
on public.club_media_comments
for insert
to authenticated
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1
    from public.club_media_posts post
    where post.id = post_id
      and post.status = 'published'
  )
);

drop policy if exists "users update own club media comments" on public.club_media_comments;
create policy "users update own club media comments"
on public.club_media_comments
for update
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop policy if exists "users and owners delete club media comments" on public.club_media_comments;
create policy "users and owners delete club media comments"
on public.club_media_comments
for delete
to authenticated
using (
  public.is_current_user(profile_id)
  or exists (
    select 1
    from public.club_media_posts post
    where post.id = post_id
      and public.owns_club(post.club_id)
  )
);
