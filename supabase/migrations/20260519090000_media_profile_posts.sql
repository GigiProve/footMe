create table if not exists public.media_profile_posts (
  id uuid primary key default gen_random_uuid(),
  media_profile_id uuid not null references public.media_profiles(profile_id) on delete cascade,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  kind text not null,
  category text not null,
  title text not null,
  subtitle text,
  excerpt text,
  body text,
  cover_url text,
  cover_type text,
  external_url text,
  author_name text not null,
  status text not null default 'published',
  published_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint media_profile_posts_kind_check check (kind in ('article', 'news')),
  constraint media_profile_posts_cover_type_check check (
    cover_type is null or cover_type in ('image', 'video')
  ),
  constraint media_profile_posts_status_check check (
    status in ('draft', 'published', 'archived')
  ),
  constraint media_profile_posts_title_check check (length(trim(title)) > 0),
  constraint media_profile_posts_category_check check (length(trim(category)) > 0),
  constraint media_profile_posts_author_check check (length(trim(author_name)) > 0)
);

create index if not exists media_profile_posts_profile_published_idx
  on public.media_profile_posts (media_profile_id, status, published_at desc);

create table if not exists public.media_profile_post_tagged_targets (
  post_id uuid not null references public.media_profile_posts(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, target_type, target_id),
  constraint media_profile_post_tagged_targets_type_check check (
    target_type in ('profile', 'club')
  )
);

create table if not exists public.media_profile_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.media_profile_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint media_profile_post_comments_body_check check (length(trim(body)) > 0)
);

create index if not exists media_profile_post_comments_post_created_idx
  on public.media_profile_post_comments (post_id, created_at asc);

create table if not exists public.saved_media_profile_posts (
  post_id uuid not null references public.media_profile_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, profile_id)
);

alter table public.media_profile_posts enable row level security;
alter table public.media_profile_post_tagged_targets enable row level security;
alter table public.media_profile_post_comments enable row level security;
alter table public.saved_media_profile_posts enable row level security;

drop policy if exists "published media profile posts readable by authenticated users" on public.media_profile_posts;
create policy "published media profile posts readable by authenticated users"
on public.media_profile_posts
for select
to authenticated
using (status = 'published');

drop policy if exists "media owners manage own profile posts" on public.media_profile_posts;
create policy "media owners manage own profile posts"
on public.media_profile_posts
for all
to authenticated
using (public.is_current_user(media_profile_id))
with check (
  public.is_current_user(media_profile_id)
  and public.is_current_user(created_by_profile_id)
);

drop policy if exists "published media profile tags readable by authenticated users" on public.media_profile_post_tagged_targets;
create policy "published media profile tags readable by authenticated users"
on public.media_profile_post_tagged_targets
for select
to authenticated
using (
  exists (
    select 1
    from public.media_profile_posts post
    where post.id = post_id
      and post.status = 'published'
  )
);

drop policy if exists "media owners manage own profile tags" on public.media_profile_post_tagged_targets;
create policy "media owners manage own profile tags"
on public.media_profile_post_tagged_targets
for all
to authenticated
using (
  exists (
    select 1
    from public.media_profile_posts post
    where post.id = post_id
      and public.is_current_user(post.media_profile_id)
  )
)
with check (
  exists (
    select 1
    from public.media_profile_posts post
    where post.id = post_id
      and public.is_current_user(post.media_profile_id)
  )
);

drop policy if exists "published media profile comments readable by authenticated users" on public.media_profile_post_comments;
create policy "published media profile comments readable by authenticated users"
on public.media_profile_post_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.media_profile_posts post
    where post.id = post_id
      and post.status = 'published'
  )
);

drop policy if exists "users insert own media profile comments" on public.media_profile_post_comments;
create policy "users insert own media profile comments"
on public.media_profile_post_comments
for insert
to authenticated
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1
    from public.media_profile_posts post
    where post.id = post_id
      and post.status = 'published'
  )
);

drop policy if exists "users update own media profile comments" on public.media_profile_post_comments;
create policy "users update own media profile comments"
on public.media_profile_post_comments
for update
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop policy if exists "users and media owners delete media profile comments" on public.media_profile_post_comments;
create policy "users and media owners delete media profile comments"
on public.media_profile_post_comments
for delete
to authenticated
using (
  public.is_current_user(profile_id)
  or exists (
    select 1
    from public.media_profile_posts post
    where post.id = post_id
      and public.is_current_user(post.media_profile_id)
  )
);

drop policy if exists "users read own saved media profile posts" on public.saved_media_profile_posts;
create policy "users read own saved media profile posts"
on public.saved_media_profile_posts
for select
to authenticated
using (public.is_current_user(profile_id));

drop policy if exists "users manage own saved media profile posts" on public.saved_media_profile_posts;
create policy "users manage own saved media profile posts"
on public.saved_media_profile_posts
for all
to authenticated
using (public.is_current_user(profile_id))
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1
    from public.media_profile_posts post
    where post.id = post_id
      and post.status = 'published'
  )
);

drop trigger if exists media_profile_posts_set_updated_at on public.media_profile_posts;
create trigger media_profile_posts_set_updated_at
before update on public.media_profile_posts
for each row execute procedure public.set_updated_at();

drop trigger if exists media_profile_post_comments_set_updated_at on public.media_profile_post_comments;
create trigger media_profile_post_comments_set_updated_at
before update on public.media_profile_post_comments
for each row execute procedure public.set_updated_at();
