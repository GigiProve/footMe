create table if not exists public.fan_tribuna_posts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.fan_profiles(profile_id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  reference_team_name text,
  reference_club_id uuid references public.clubs(id) on delete set null,
  reference_category text,
  formation text,
  status text not null default 'published',
  published_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fan_tribuna_posts_kind_check check (kind in ('poll', 'proposal', 'formation')),
  constraint fan_tribuna_posts_title_check check (length(trim(title)) between 1 and 180),
  constraint fan_tribuna_posts_body_check check (body is null or length(trim(body)) <= 480),
  constraint fan_tribuna_posts_formation_check check (
    formation is null or formation in ('4-3-3', '4-4-2', '3-5-2', '4-2-3-1')
  ),
  constraint fan_tribuna_posts_status_check check (status in ('draft', 'published', 'archived'))
);

create index if not exists fan_tribuna_posts_profile_published_idx
  on public.fan_tribuna_posts (profile_id, status, published_at desc);

create table if not exists public.fan_tribuna_poll_options (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.fan_tribuna_posts(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint fan_tribuna_poll_options_label_check check (length(trim(label)) between 1 and 120)
);

create index if not exists fan_tribuna_poll_options_post_idx
  on public.fan_tribuna_poll_options (post_id, sort_order);

create table if not exists public.fan_tribuna_poll_votes (
  post_id uuid not null references public.fan_tribuna_posts(id) on delete cascade,
  option_id uuid not null references public.fan_tribuna_poll_options(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, profile_id)
);

create index if not exists fan_tribuna_poll_votes_option_idx
  on public.fan_tribuna_poll_votes (option_id);

create table if not exists public.fan_tribuna_support_votes (
  post_id uuid not null references public.fan_tribuna_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, profile_id)
);

create table if not exists public.saved_fan_tribuna (
  post_id uuid not null references public.fan_tribuna_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, profile_id)
);

create table if not exists public.fan_tribuna_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.fan_tribuna_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fan_tribuna_comments_body_check check (length(trim(body)) > 0)
);

create index if not exists fan_tribuna_comments_post_created_idx
  on public.fan_tribuna_comments (post_id, created_at asc);

create table if not exists public.fan_tribuna_tagged_players (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.fan_tribuna_posts(id) on delete cascade,
  player_profile_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  unique (post_id, player_profile_id)
);

create index if not exists fan_tribuna_tagged_players_post_idx
  on public.fan_tribuna_tagged_players (post_id, sort_order);

create table if not exists public.fan_tribuna_lineup_players (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.fan_tribuna_posts(id) on delete cascade,
  slot_key text not null,
  player_profile_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  x_percent numeric not null,
  y_percent numeric not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  unique (post_id, slot_key),
  constraint fan_tribuna_lineup_players_x_check check (x_percent between 0 and 100),
  constraint fan_tribuna_lineup_players_y_check check (y_percent between 0 and 100)
);

create index if not exists fan_tribuna_lineup_players_post_idx
  on public.fan_tribuna_lineup_players (post_id, sort_order);

alter table public.fan_tribuna_posts enable row level security;
alter table public.fan_tribuna_poll_options enable row level security;
alter table public.fan_tribuna_poll_votes enable row level security;
alter table public.fan_tribuna_support_votes enable row level security;
alter table public.saved_fan_tribuna enable row level security;
alter table public.fan_tribuna_comments enable row level security;
alter table public.fan_tribuna_tagged_players enable row level security;
alter table public.fan_tribuna_lineup_players enable row level security;

drop policy if exists "published fan tribuna readable by authenticated users" on public.fan_tribuna_posts;
create policy "published fan tribuna readable by authenticated users"
on public.fan_tribuna_posts
for select
to authenticated
using (status = 'published');

drop policy if exists "fan owners manage own tribuna posts" on public.fan_tribuna_posts;
create policy "fan owners manage own tribuna posts"
on public.fan_tribuna_posts
for all
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop policy if exists "published fan tribuna children readable" on public.fan_tribuna_poll_options;
create policy "published fan tribuna children readable"
on public.fan_tribuna_poll_options
for select
to authenticated
using (
  exists (
    select 1 from public.fan_tribuna_posts post
    where post.id = post_id and post.status = 'published'
  )
);

drop policy if exists "fan owners manage own poll options" on public.fan_tribuna_poll_options;
create policy "fan owners manage own poll options"
on public.fan_tribuna_poll_options
for all
to authenticated
using (
  exists (
    select 1 from public.fan_tribuna_posts post
    where post.id = post_id and public.is_current_user(post.profile_id)
  )
)
with check (
  exists (
    select 1 from public.fan_tribuna_posts post
    where post.id = post_id and public.is_current_user(post.profile_id)
  )
);

drop policy if exists "published fan tribuna poll votes readable" on public.fan_tribuna_poll_votes;
create policy "published fan tribuna poll votes readable"
on public.fan_tribuna_poll_votes
for select
to authenticated
using (
  exists (
    select 1 from public.fan_tribuna_posts post
    where post.id = post_id and post.status = 'published'
  )
);

drop policy if exists "users manage own fan tribuna poll votes" on public.fan_tribuna_poll_votes;
create policy "users manage own fan tribuna poll votes"
on public.fan_tribuna_poll_votes
for all
to authenticated
using (public.is_current_user(profile_id))
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1 from public.fan_tribuna_posts post
    where post.id = post_id and post.status = 'published'
  )
);

drop policy if exists "published fan tribuna support readable" on public.fan_tribuna_support_votes;
create policy "published fan tribuna support readable"
on public.fan_tribuna_support_votes
for select
to authenticated
using (
  exists (
    select 1 from public.fan_tribuna_posts post
    where post.id = post_id and post.status = 'published'
  )
);

drop policy if exists "users manage own fan tribuna support" on public.fan_tribuna_support_votes;
create policy "users manage own fan tribuna support"
on public.fan_tribuna_support_votes
for all
to authenticated
using (public.is_current_user(profile_id))
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1 from public.fan_tribuna_posts post
    where post.id = post_id and post.status = 'published'
  )
);

drop policy if exists "users read own saved fan tribuna" on public.saved_fan_tribuna;
create policy "users read own saved fan tribuna"
on public.saved_fan_tribuna
for select
to authenticated
using (public.is_current_user(profile_id));

drop policy if exists "users manage own saved fan tribuna" on public.saved_fan_tribuna;
create policy "users manage own saved fan tribuna"
on public.saved_fan_tribuna
for all
to authenticated
using (public.is_current_user(profile_id))
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1 from public.fan_tribuna_posts post
    where post.id = post_id and post.status = 'published'
  )
);

drop policy if exists "published fan tribuna comments readable" on public.fan_tribuna_comments;
create policy "published fan tribuna comments readable"
on public.fan_tribuna_comments
for select
to authenticated
using (
  exists (
    select 1 from public.fan_tribuna_posts post
    where post.id = post_id and post.status = 'published'
  )
);

drop policy if exists "users insert own fan tribuna comments" on public.fan_tribuna_comments;
create policy "users insert own fan tribuna comments"
on public.fan_tribuna_comments
for insert
to authenticated
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1 from public.fan_tribuna_posts post
    where post.id = post_id and post.status = 'published'
  )
);

drop policy if exists "users update own fan tribuna comments" on public.fan_tribuna_comments;
create policy "users update own fan tribuna comments"
on public.fan_tribuna_comments
for update
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop policy if exists "users and authors delete fan tribuna comments" on public.fan_tribuna_comments;
create policy "users and authors delete fan tribuna comments"
on public.fan_tribuna_comments
for delete
to authenticated
using (
  public.is_current_user(profile_id)
  or exists (
    select 1 from public.fan_tribuna_posts post
    where post.id = post_id and public.is_current_user(post.profile_id)
  )
);

drop policy if exists "published fan tribuna tagged players readable" on public.fan_tribuna_tagged_players;
create policy "published fan tribuna tagged players readable"
on public.fan_tribuna_tagged_players
for select
to authenticated
using (
  exists (
    select 1 from public.fan_tribuna_posts post
    where post.id = post_id and post.status = 'published'
  )
);

drop policy if exists "fan owners manage own tagged players" on public.fan_tribuna_tagged_players;
create policy "fan owners manage own tagged players"
on public.fan_tribuna_tagged_players
for all
to authenticated
using (
  exists (
    select 1 from public.fan_tribuna_posts post
    where post.id = post_id and public.is_current_user(post.profile_id)
  )
)
with check (
  exists (
    select 1 from public.fan_tribuna_posts post
    where post.id = post_id and public.is_current_user(post.profile_id)
  )
);

drop policy if exists "published fan tribuna lineup players readable" on public.fan_tribuna_lineup_players;
create policy "published fan tribuna lineup players readable"
on public.fan_tribuna_lineup_players
for select
to authenticated
using (
  exists (
    select 1 from public.fan_tribuna_posts post
    where post.id = post_id and post.status = 'published'
  )
);

drop policy if exists "fan owners manage own lineup players" on public.fan_tribuna_lineup_players;
create policy "fan owners manage own lineup players"
on public.fan_tribuna_lineup_players
for all
to authenticated
using (
  exists (
    select 1 from public.fan_tribuna_posts post
    where post.id = post_id and public.is_current_user(post.profile_id)
  )
)
with check (
  exists (
    select 1 from public.fan_tribuna_posts post
    where post.id = post_id and public.is_current_user(post.profile_id)
  )
);

drop trigger if exists fan_tribuna_posts_set_updated_at on public.fan_tribuna_posts;
create trigger fan_tribuna_posts_set_updated_at
before update on public.fan_tribuna_posts
for each row execute procedure public.set_updated_at();

drop trigger if exists fan_tribuna_comments_set_updated_at on public.fan_tribuna_comments;
create trigger fan_tribuna_comments_set_updated_at
before update on public.fan_tribuna_comments
for each row execute procedure public.set_updated_at();
