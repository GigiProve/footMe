create table if not exists public.media_tribuna_posts (
  id uuid primary key default gen_random_uuid(),
  media_profile_id uuid not null references public.media_profiles(profile_id) on delete cascade,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  kind text not null,
  title text not null,
  body text,
  linked_article_id uuid references public.media_profile_posts(id) on delete set null,
  status text not null default 'published',
  published_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint media_tribuna_posts_kind_check check (
    kind in ('editorial_poll', 'article_debate', 'player_vote', 'community_qa')
  ),
  constraint media_tribuna_posts_title_check check (length(trim(title)) between 1 and 180),
  constraint media_tribuna_posts_body_check check (body is null or length(trim(body)) <= 640),
  constraint media_tribuna_posts_status_check check (status in ('draft', 'published', 'archived'))
);

create index if not exists media_tribuna_posts_profile_published_idx
  on public.media_tribuna_posts (media_profile_id, status, published_at desc);

create table if not exists public.media_tribuna_options (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.media_tribuna_posts(id) on delete cascade,
  label text not null,
  player_profile_id uuid references public.profiles(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint media_tribuna_options_label_check check (length(trim(label)) between 1 and 120)
);

create index if not exists media_tribuna_options_post_idx
  on public.media_tribuna_options (post_id, sort_order);

create table if not exists public.media_tribuna_option_votes (
  post_id uuid not null references public.media_tribuna_posts(id) on delete cascade,
  option_id uuid not null references public.media_tribuna_options(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, profile_id)
);

create index if not exists media_tribuna_option_votes_option_idx
  on public.media_tribuna_option_votes (option_id);

create table if not exists public.saved_media_tribuna (
  post_id uuid not null references public.media_tribuna_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, profile_id)
);

create table if not exists public.media_tribuna_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.media_tribuna_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint media_tribuna_comments_body_check check (length(trim(body)) > 0)
);

create index if not exists media_tribuna_comments_post_created_idx
  on public.media_tribuna_comments (post_id, created_at asc);

create table if not exists public.media_tribuna_questions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.media_tribuna_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint media_tribuna_questions_body_check check (length(trim(body)) between 1 and 280)
);

create index if not exists media_tribuna_questions_post_created_idx
  on public.media_tribuna_questions (post_id, created_at asc);

create table if not exists public.media_tribuna_question_votes (
  question_id uuid not null references public.media_tribuna_questions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (question_id, profile_id)
);

alter table public.media_tribuna_posts enable row level security;
alter table public.media_tribuna_options enable row level security;
alter table public.media_tribuna_option_votes enable row level security;
alter table public.saved_media_tribuna enable row level security;
alter table public.media_tribuna_comments enable row level security;
alter table public.media_tribuna_questions enable row level security;
alter table public.media_tribuna_question_votes enable row level security;

drop policy if exists "published media tribuna readable by authenticated users" on public.media_tribuna_posts;
create policy "published media tribuna readable by authenticated users"
on public.media_tribuna_posts
for select
to authenticated
using (status = 'published');

drop policy if exists "media owners manage own tribuna posts" on public.media_tribuna_posts;
create policy "media owners manage own tribuna posts"
on public.media_tribuna_posts
for all
to authenticated
using (public.is_current_user(media_profile_id))
with check (
  public.is_current_user(media_profile_id)
  and public.is_current_user(created_by_profile_id)
);

drop policy if exists "published media tribuna options readable" on public.media_tribuna_options;
create policy "published media tribuna options readable"
on public.media_tribuna_options
for select
to authenticated
using (
  exists (
    select 1 from public.media_tribuna_posts post
    where post.id = post_id and post.status = 'published'
  )
);

drop policy if exists "media owners manage own tribuna options" on public.media_tribuna_options;
create policy "media owners manage own tribuna options"
on public.media_tribuna_options
for all
to authenticated
using (
  exists (
    select 1 from public.media_tribuna_posts post
    where post.id = post_id and public.is_current_user(post.media_profile_id)
  )
)
with check (
  exists (
    select 1 from public.media_tribuna_posts post
    where post.id = post_id and public.is_current_user(post.media_profile_id)
  )
);

drop policy if exists "published media tribuna option votes readable" on public.media_tribuna_option_votes;
create policy "published media tribuna option votes readable"
on public.media_tribuna_option_votes
for select
to authenticated
using (
  exists (
    select 1 from public.media_tribuna_posts post
    where post.id = post_id and post.status = 'published'
  )
);

drop policy if exists "users manage own media tribuna option votes" on public.media_tribuna_option_votes;
create policy "users manage own media tribuna option votes"
on public.media_tribuna_option_votes
for all
to authenticated
using (public.is_current_user(profile_id))
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1
    from public.media_tribuna_options option
    join public.media_tribuna_posts post on post.id = option.post_id
    where option.id = media_tribuna_option_votes.option_id
      and option.post_id = media_tribuna_option_votes.post_id
      and post.status = 'published'
  )
);

drop policy if exists "users read own saved media tribuna" on public.saved_media_tribuna;
create policy "users read own saved media tribuna"
on public.saved_media_tribuna
for select
to authenticated
using (public.is_current_user(profile_id));

drop policy if exists "users manage own saved media tribuna" on public.saved_media_tribuna;
create policy "users manage own saved media tribuna"
on public.saved_media_tribuna
for all
to authenticated
using (public.is_current_user(profile_id))
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1 from public.media_tribuna_posts post
    where post.id = post_id and post.status = 'published'
  )
);

drop policy if exists "published media tribuna comments readable" on public.media_tribuna_comments;
create policy "published media tribuna comments readable"
on public.media_tribuna_comments
for select
to authenticated
using (
  exists (
    select 1 from public.media_tribuna_posts post
    where post.id = post_id and post.status = 'published'
  )
);

drop policy if exists "users insert own media tribuna comments" on public.media_tribuna_comments;
create policy "users insert own media tribuna comments"
on public.media_tribuna_comments
for insert
to authenticated
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1 from public.media_tribuna_posts post
    where post.id = post_id and post.status = 'published'
  )
);

drop policy if exists "users update own media tribuna comments" on public.media_tribuna_comments;
create policy "users update own media tribuna comments"
on public.media_tribuna_comments
for update
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop policy if exists "users and media owners delete media tribuna comments" on public.media_tribuna_comments;
create policy "users and media owners delete media tribuna comments"
on public.media_tribuna_comments
for delete
to authenticated
using (
  public.is_current_user(profile_id)
  or exists (
    select 1 from public.media_tribuna_posts post
    where post.id = post_id and public.is_current_user(post.media_profile_id)
  )
);

drop policy if exists "published media tribuna questions readable" on public.media_tribuna_questions;
create policy "published media tribuna questions readable"
on public.media_tribuna_questions
for select
to authenticated
using (
  exists (
    select 1 from public.media_tribuna_posts post
    where post.id = post_id and post.status = 'published'
  )
);

drop policy if exists "users insert own media tribuna questions" on public.media_tribuna_questions;
create policy "users insert own media tribuna questions"
on public.media_tribuna_questions
for insert
to authenticated
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1 from public.media_tribuna_posts post
    where post.id = post_id
      and post.kind = 'community_qa'
      and post.status = 'published'
  )
);

drop policy if exists "users update own media tribuna questions" on public.media_tribuna_questions;
create policy "users update own media tribuna questions"
on public.media_tribuna_questions
for update
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop policy if exists "users and media owners delete media tribuna questions" on public.media_tribuna_questions;
create policy "users and media owners delete media tribuna questions"
on public.media_tribuna_questions
for delete
to authenticated
using (
  public.is_current_user(profile_id)
  or exists (
    select 1 from public.media_tribuna_posts post
    where post.id = post_id and public.is_current_user(post.media_profile_id)
  )
);

drop policy if exists "published media tribuna question votes readable" on public.media_tribuna_question_votes;
create policy "published media tribuna question votes readable"
on public.media_tribuna_question_votes
for select
to authenticated
using (
  exists (
    select 1
    from public.media_tribuna_questions question
    join public.media_tribuna_posts post on post.id = question.post_id
    where question.id = question_id and post.status = 'published'
  )
);

drop policy if exists "users manage own media tribuna question votes" on public.media_tribuna_question_votes;
create policy "users manage own media tribuna question votes"
on public.media_tribuna_question_votes
for all
to authenticated
using (public.is_current_user(profile_id))
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1
    from public.media_tribuna_questions question
    join public.media_tribuna_posts post on post.id = question.post_id
    where question.id = question_id and post.status = 'published'
  )
);

drop trigger if exists media_tribuna_posts_set_updated_at on public.media_tribuna_posts;
create trigger media_tribuna_posts_set_updated_at
before update on public.media_tribuna_posts
for each row execute procedure public.set_updated_at();

drop trigger if exists media_tribuna_comments_set_updated_at on public.media_tribuna_comments;
create trigger media_tribuna_comments_set_updated_at
before update on public.media_tribuna_comments
for each row execute procedure public.set_updated_at();

drop trigger if exists media_tribuna_questions_set_updated_at on public.media_tribuna_questions;
create trigger media_tribuna_questions_set_updated_at
before update on public.media_tribuna_questions
for each row execute procedure public.set_updated_at();
