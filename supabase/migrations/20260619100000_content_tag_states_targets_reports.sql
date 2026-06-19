-- Migration: content tag states, non-account targets on club_media, reports table, and RPCs.
-- Phases 1 and 2 of "Tag Società → Profili" feature (RET-02).
--
-- Verified source state:
--   club_media_tagged_profiles   (20260514001000): composite PK (post_id, profile_id),
--                                profile_id NOT NULL, unnamed status check from
--                                20260615120200 → auto-named club_media_tagged_profiles_status_check.
--   fan_tribuna_tagged_players   (20260515030000): surrogate PK id uuid, player_profile_id NOT NULL,
--                                unnamed status check → fan_tribuna_tagged_players_status_check.
--   media_profile_post_tagged_targets (20260519090000): composite PK (post_id,target_type,target_id),
--                                named type check media_profile_post_tagged_targets_type_check,
--                                unnamed status check → media_profile_post_tagged_targets_status_check.
-- All three status checks are unnamed (added via inline check on alter table add column) so
-- PostgreSQL auto-names them as <table>_status_check.


-- ============================================================
-- SECTION 1: Widen status checks on all three tag tables
-- ============================================================

-- 1a. club_media_tagged_profiles
alter table public.club_media_tagged_profiles
  drop constraint if exists club_media_tagged_profiles_status_check;
alter table public.club_media_tagged_profiles
  drop constraint if exists club_media_tagged_profiles_status_check_v2;

alter table public.club_media_tagged_profiles
  add constraint club_media_tagged_profiles_status_check_v2
  check (status in ('active', 'hidden', 'reported', 'in_review', 'removed'));

-- 1b. fan_tribuna_tagged_players
alter table public.fan_tribuna_tagged_players
  drop constraint if exists fan_tribuna_tagged_players_status_check;
alter table public.fan_tribuna_tagged_players
  drop constraint if exists fan_tribuna_tagged_players_status_check_v2;

alter table public.fan_tribuna_tagged_players
  add constraint fan_tribuna_tagged_players_status_check_v2
  check (status in ('active', 'hidden', 'reported', 'in_review', 'removed'));

-- 1c. media_profile_post_tagged_targets
alter table public.media_profile_post_tagged_targets
  drop constraint if exists media_profile_post_tagged_targets_status_check;
alter table public.media_profile_post_tagged_targets
  drop constraint if exists media_profile_post_tagged_targets_status_check_v2;

alter table public.media_profile_post_tagged_targets
  add constraint media_profile_post_tagged_targets_status_check_v2
  check (status in ('active', 'hidden', 'reported', 'in_review', 'removed'));


-- ============================================================
-- SECTION 2: Non-account targets on club_media_tagged_profiles
-- ============================================================
-- Current state: PK (post_id, profile_id), profile_id NOT NULL.
-- Goal: support target_type in ('profile','club','team') with a surrogate PK.
-- profile_id is kept populated for 'profile' targets so the existing UPDATE
-- RLS policy ("tagged user can moderate own club media tag", keyed on
-- profile_id = auth.uid()) continues to work without changes.

-- 2a. Add new columns
alter table public.club_media_tagged_profiles
  add column if not exists target_type text,
  add column if not exists target_id uuid;

-- 2b. Backfill existing rows (all are profile targets)
update public.club_media_tagged_profiles
  set target_type = 'profile',
      target_id   = profile_id
  where target_type is null;

-- 2c. Apply NOT NULL with default on target_type, add named type check.
--     target_type has a default so existing client inserts (profile-only) keep working.
--     target_id is left nullable for now; a BEFORE INSERT trigger auto-fills it from
--     profile_id when not provided, preserving compatibility with the current TS client
--     until Fase 3/4 updates club-media-service.ts to pass target_type/target_id explicitly.
alter table public.club_media_tagged_profiles
  alter column target_type set default 'profile',
  alter column target_type set not null;

alter table public.club_media_tagged_profiles
  drop constraint if exists club_media_tagged_profiles_target_type_check;
alter table public.club_media_tagged_profiles
  add constraint club_media_tagged_profiles_target_type_check
  check (target_type in ('profile', 'club', 'team'));

-- Auto-fill target_id from profile_id for profile-target inserts from the legacy client.
create or replace function public.club_media_tagged_profiles_before_insert()
returns trigger
language plpgsql
as $$
begin
  if new.target_id is null and new.profile_id is not null then
    new.target_id := new.profile_id;
  end if;
  return new;
end;
$$;

drop trigger if exists club_media_tagged_profiles_autofill_target
  on public.club_media_tagged_profiles;

create trigger club_media_tagged_profiles_autofill_target
  before insert on public.club_media_tagged_profiles
  for each row execute function public.club_media_tagged_profiles_before_insert();

-- 2d. Drop the old composite PK FIRST. profile_id cannot lose its NOT NULL while
--     it is still part of a primary key, so the PK drop MUST precede 2e.
--     The auto-generated name for a composite PK created without a CONSTRAINT clause
--     is club_media_tagged_profiles_pkey (PostgreSQL convention).
alter table public.club_media_tagged_profiles
  drop constraint if exists club_media_tagged_profiles_pkey;

-- 2e. Make profile_id nullable (it will be null for club/team targets).
alter table public.club_media_tagged_profiles
  alter column profile_id drop not null;

-- 2f. Add the surrogate primary key.
alter table public.club_media_tagged_profiles
  add column if not exists id uuid not null default gen_random_uuid();

alter table public.club_media_tagged_profiles
  add primary key (id);

-- 2f. Unique constraint to prevent duplicate tags per (post, target)
create unique index if not exists club_media_tagged_profiles_post_target_uniq
  on public.club_media_tagged_profiles (post_id, target_type, target_id);

-- 2g. Reverse-lookup index
create index if not exists club_media_tagged_profiles_target_idx
  on public.club_media_tagged_profiles (target_type, target_id);

-- 2h. New RLS UPDATE policy for club/team target owners.
--     The existing profile UPDATE policy (profile_id = auth.uid()) is kept as-is.
drop policy if exists "club owner can moderate club or team tag on club media" on public.club_media_tagged_profiles;
create policy "club owner can moderate club or team tag on club media"
  on public.club_media_tagged_profiles
  for update
  to authenticated
  using (
    target_type in ('club', 'team')
    and exists (
      select 1
      from public.club_media_posts post
      where post.id = post_id
        and public.owns_club(post.club_id)
    )
  )
  with check (
    target_type in ('club', 'team')
    and exists (
      select 1
      from public.club_media_posts post
      where post.id = post_id
        and public.owns_club(post.club_id)
    )
  );


-- ============================================================
-- SECTION 3: Widen target_type check on media_profile_post_tagged_targets
-- ============================================================

-- Drop the old named constraint and replace with a v2 that includes 'team'.
alter table public.media_profile_post_tagged_targets
  drop constraint if exists media_profile_post_tagged_targets_type_check;
alter table public.media_profile_post_tagged_targets
  drop constraint if exists media_profile_post_tagged_targets_type_check_v2;

alter table public.media_profile_post_tagged_targets
  add constraint media_profile_post_tagged_targets_type_check_v2
  check (target_type in ('profile', 'club', 'team'));

-- Reverse-lookup index (no change to existing PK / unique on this table)
create index if not exists media_profile_post_tagged_targets_type_id_idx
  on public.media_profile_post_tagged_targets (target_type, target_id);


-- ============================================================
-- SECTION 4: Reports table
-- ============================================================

create table if not exists public.content_tag_reports (
  id                  uuid        primary key default gen_random_uuid(),
  content_type        text        not null,
  post_id             uuid        not null,
  tagged_id           uuid        not null,
  target_type         text        not null default 'profile',
  reporter_profile_id uuid        not null references public.profiles(id) on delete cascade,
  reason              text        not null,
  note                text,
  status              text        not null default 'open',
  created_at          timestamptz not null default timezone('utc', now()),

  constraint content_tag_reports_content_type_check
    check (content_type in ('club_media', 'fan_tribuna', 'media_profile')),

  constraint content_tag_reports_target_type_check
    check (target_type in ('profile', 'club', 'team')),

  constraint content_tag_reports_reason_check
    check (reason in (
      'info_non_corrette',
      'uso_improprio',
      'contenuto_offensivo',
      'spam',
      'altro'
    )),

  constraint content_tag_reports_status_check
    check (status in ('open', 'reviewing', 'resolved', 'dismissed'))
);

create index if not exists content_tag_reports_status_created_idx
  on public.content_tag_reports (status, created_at desc);

alter table public.content_tag_reports enable row level security;

-- Reporters may read their own report rows.
drop policy if exists "reporter reads own content tag reports" on public.content_tag_reports;
create policy "reporter reads own content tag reports"
  on public.content_tag_reports
  for select
  to authenticated
  using (public.is_current_user(reporter_profile_id));

-- No direct INSERT policy; all writes go through report_content_tag() RPC.


-- ============================================================
-- SECTION 5: RPCs
-- ============================================================

-- ------------------------------------------------------------
-- 5a. report_content_tag
--     Inserts a report row and marks the tag row as 'reported'.
-- ------------------------------------------------------------
create or replace function public.report_content_tag(
  p_content_type text,
  p_post_id      uuid,
  p_tagged_id    uuid,
  p_reason       text,
  p_target_type  text default 'profile',
  p_note         text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  if p_content_type not in ('club_media', 'fan_tribuna', 'media_profile') then
    raise exception 'Tipo di contenuto non valido';
  end if;

  if p_reason not in (
    'info_non_corrette', 'uso_improprio', 'contenuto_offensivo', 'spam', 'altro'
  ) then
    raise exception 'Motivazione non valida';
  end if;

  if p_target_type not in ('profile', 'club', 'team') then
    raise exception 'Tipo di target non valido';
  end if;

  -- Insert the report record.
  insert into public.content_tag_reports (
    content_type,
    post_id,
    tagged_id,
    target_type,
    reporter_profile_id,
    reason,
    note
  ) values (
    p_content_type,
    p_post_id,
    p_tagged_id,
    p_target_type,
    v_caller,
    p_reason,
    p_note
  );

  -- Mark the relevant tag row as 'reported'.
  if p_content_type = 'club_media' then
    update public.club_media_tagged_profiles
      set status = 'reported'
      where post_id = p_post_id
        and target_type = p_target_type
        and coalesce(target_id, profile_id) = p_tagged_id;

  elsif p_content_type = 'fan_tribuna' then
    update public.fan_tribuna_tagged_players
      set status = 'reported'
      where post_id = p_post_id
        and player_profile_id = p_tagged_id;

  elsif p_content_type = 'media_profile' then
    update public.media_profile_post_tagged_targets
      set status = 'reported'
      where post_id = p_post_id
        and target_type = p_target_type
        and target_id = p_tagged_id;
  end if;
end;
$$;

revoke all on function public.report_content_tag(text, uuid, uuid, text, text, text) from public;
grant execute on function public.report_content_tag(text, uuid, uuid, text, text, text) to authenticated;


-- ------------------------------------------------------------
-- 5b. fetch_tagged_content_for_owner
--     Returns content tagged with the caller's profile (status='active' only).
-- ------------------------------------------------------------
create or replace function public.fetch_tagged_content_for_owner(
  p_profile_id uuid default auth.uid()
)
returns table (
  content_type   text,
  post_id        uuid,
  kind           text,
  title          text,
  thumbnail_url  text,
  publisher_id   uuid,
  publisher_name text,
  published_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
    -- club_media: profile targets only
    select
      'club_media'::text,
      p.id,
      p.kind,
      p.title,
      coalesce(p.thumbnail_url, p.visual_url),
      p.club_id,
      c.name,
      p.published_at
    from public.club_media_tagged_profiles t
    join public.club_media_posts p on p.id = t.post_id and p.status = 'published'
    join public.clubs c on c.id = p.club_id
    where t.target_type = 'profile'
      and t.target_id = p_profile_id
      and t.status = 'active'

    union all

    -- media_profile: profile targets only
    select
      'media_profile'::text,
      mp.id,
      mp.kind,
      mp.title,
      mp.cover_url,
      mp.media_profile_id,
      coalesce(pr.full_name, 'Media'),
      mp.published_at
    from public.media_profile_post_tagged_targets t
    join public.media_profile_posts mp on mp.id = t.post_id and mp.status = 'published'
    join public.profiles pr on pr.id = mp.media_profile_id
    where t.target_type = 'profile'
      and t.target_id = p_profile_id
      and t.status = 'active'

    union all

    -- fan_tribuna: player targets only
    select
      'fan_tribuna'::text,
      fp.id,
      fp.kind,
      fp.title,
      null::text,
      fp.profile_id,
      coalesce(pr.full_name, 'Fan'),
      fp.published_at
    from public.fan_tribuna_tagged_players t
    join public.fan_tribuna_posts fp on fp.id = t.post_id and fp.status = 'published'
    join public.profiles pr on pr.id = fp.profile_id
    where t.player_profile_id = p_profile_id
      and t.status = 'active'

    order by published_at desc nulls last;
end;
$$;

revoke all on function public.fetch_tagged_content_for_owner(uuid) from public;
grant execute on function public.fetch_tagged_content_for_owner(uuid) to authenticated;


-- ------------------------------------------------------------
-- 5c. fetch_tagged_content_public
--     Same shape but status in ('active','reported','in_review') — for third-party viewing.
-- ------------------------------------------------------------
create or replace function public.fetch_tagged_content_public(
  p_profile_id uuid
)
returns table (
  content_type   text,
  post_id        uuid,
  kind           text,
  title          text,
  thumbnail_url  text,
  publisher_id   uuid,
  publisher_name text,
  published_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
    select
      'club_media'::text,
      p.id,
      p.kind,
      p.title,
      coalesce(p.thumbnail_url, p.visual_url),
      p.club_id,
      c.name,
      p.published_at
    from public.club_media_tagged_profiles t
    join public.club_media_posts p on p.id = t.post_id and p.status = 'published'
    join public.clubs c on c.id = p.club_id
    where t.target_type = 'profile'
      and t.target_id = p_profile_id
      and t.status in ('active', 'reported', 'in_review')

    union all

    select
      'media_profile'::text,
      mp.id,
      mp.kind,
      mp.title,
      mp.cover_url,
      mp.media_profile_id,
      coalesce(pr.full_name, 'Media'),
      mp.published_at
    from public.media_profile_post_tagged_targets t
    join public.media_profile_posts mp on mp.id = t.post_id and mp.status = 'published'
    join public.profiles pr on pr.id = mp.media_profile_id
    where t.target_type = 'profile'
      and t.target_id = p_profile_id
      and t.status in ('active', 'reported', 'in_review')

    union all

    select
      'fan_tribuna'::text,
      fp.id,
      fp.kind,
      fp.title,
      null::text,
      fp.profile_id,
      coalesce(pr.full_name, 'Fan'),
      fp.published_at
    from public.fan_tribuna_tagged_players t
    join public.fan_tribuna_posts fp on fp.id = t.post_id and fp.status = 'published'
    join public.profiles pr on pr.id = fp.profile_id
    where t.player_profile_id = p_profile_id
      and t.status in ('active', 'reported', 'in_review')

    order by published_at desc nulls last;
end;
$$;

revoke all on function public.fetch_tagged_content_public(uuid) from public;
grant execute on function public.fetch_tagged_content_public(uuid) to authenticated;


-- ------------------------------------------------------------
-- 5d. search_tag_targets
--     Unified search across profiles (non-fan/media roles), clubs, and club_teams.
--     profiles_with_age is security_invoker=true, so RLS is respected.
--     Minimum query length: 2 characters.
-- ------------------------------------------------------------
create or replace function public.search_tag_targets(
  p_query text,
  p_limit int default 20
)
returns table (
  target_type  text,
  target_id    uuid,
  display_name text,
  avatar_url   text,
  role_label   text,
  subtitle     text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if length(trim(p_query)) < 2 then
    raise exception 'La ricerca richiede almeno 2 caratteri';
  end if;

  return query
    -- Profiles: player, coach, staff, director (excluding fan/media/agent/club_admin)
    select
      'profile'::text,
      pwa.id,
      pwa.full_name,
      pwa.avatar_url,
      pwa.role::text,
      coalesce(pwa.city, '') as subtitle
    from public.profiles_with_age pwa
    where pwa.role in ('player', 'coach', 'staff', 'director')
      and pwa.full_name ilike '%' || trim(p_query) || '%'

    union all

    -- Clubs
    select
      'club'::text,
      c.id,
      c.name,
      c.logo_url,
      'club'::text,
      coalesce(c.city, '') as subtitle
    from public.clubs c
    where c.name ilike '%' || trim(p_query) || '%'

    union all

    -- Club teams (squadre interne)
    select
      'team'::text,
      ct.id,
      ct.name,
      ct.logo_url,
      'team'::text,
      coalesce(ct.category, ct.city, '') as subtitle
    from public.club_teams ct
    where ct.name ilike '%' || trim(p_query) || '%'

    order by display_name
    limit p_limit;
end;
$$;

revoke all on function public.search_tag_targets(text, int) from public;
grant execute on function public.search_tag_targets(text, int) to authenticated;


-- ------------------------------------------------------------
-- 5e. moderate_content_tag (updated — replaces phase3 version)
--     Now matches club_media on coalesce(target_id, profile_id).
-- ------------------------------------------------------------
create or replace function public.moderate_content_tag(
  p_content_type text,
  p_post_id      uuid,
  p_tagged_id    uuid,
  p_dismiss      boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;

  v_status := case when p_dismiss then 'active' else 'hidden' end;

  if p_content_type = 'club_media' then
    update public.club_media_tagged_profiles
      set status = v_status
      where post_id = p_post_id
        and coalesce(target_id, profile_id) = p_tagged_id;

  elsif p_content_type = 'fan_tribuna' then
    update public.fan_tribuna_tagged_players
      set status = v_status
      where post_id = p_post_id
        and player_profile_id = p_tagged_id;

  elsif p_content_type = 'media_profile' then
    update public.media_profile_post_tagged_targets
      set status = v_status
      where post_id = p_post_id
        and target_id = p_tagged_id
        and target_type = 'profile';

  else
    raise exception 'Tipo di contenuto non valido';
  end if;
end;
$$;

-- Grant/revoke already in place from phase3; re-apply defensively.
revoke all on function public.moderate_content_tag(text, uuid, uuid, boolean) from public;
grant execute on function public.moderate_content_tag(text, uuid, uuid, boolean) to authenticated;


-- ------------------------------------------------------------
-- 5f. fetch_reported_content_tags (updated — replaces phase3 version)
--     Now: matches club_media on coalesce(target_id, profile_id);
--          surfaces latest report reason/note via LEFT JOIN;
--          includes 'in_review' rows as well as 'reported'.
--     The phase3 version returns a different column set, and CREATE OR REPLACE
--     cannot change a function's return type, so drop it first.
-- ------------------------------------------------------------
drop function if exists public.fetch_reported_content_tags();

create or replace function public.fetch_reported_content_tags()
returns table (
  content_type      text,
  post_id           uuid,
  tagged_profile_id uuid,
  tagged_name       text,
  created_at        timestamptz,
  report_reason     text,
  report_note       text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;

  return query
    -- club_media: all target types; for profile targets show profile name,
    -- for club/team targets show target name via clubs/club_teams
    select
      'club_media'::text,
      t.post_id,
      coalesce(t.target_id, t.profile_id),
      case
        when t.target_type = 'profile' then coalesce(p.full_name, 'Profilo')
        when t.target_type = 'club'    then coalesce(cl.name, 'Società')
        when t.target_type = 'team'    then coalesce(ct.name, 'Squadra')
        else 'Sconosciuto'
      end,
      t.created_at,
      r.reason,
      r.note
    from public.club_media_tagged_profiles t
    left join public.profiles p
      on p.id = t.profile_id and t.target_type = 'profile'
    left join public.clubs cl
      on cl.id = t.target_id and t.target_type = 'club'
    left join public.club_teams ct
      on ct.id = t.target_id and t.target_type = 'team'
    left join lateral (
      select reason, note
      from public.content_tag_reports cr
      where cr.content_type = 'club_media'
        and cr.post_id = t.post_id
        and cr.tagged_id = coalesce(t.target_id, t.profile_id)
        and cr.target_type = t.target_type
      order by cr.created_at desc
      limit 1
    ) r on true
    where t.status in ('reported', 'in_review')

    union all

    -- fan_tribuna: player targets only
    select
      'fan_tribuna'::text,
      t.post_id,
      t.player_profile_id,
      coalesce(p.full_name, t.display_name, 'Profilo'),
      t.created_at,
      r.reason,
      r.note
    from public.fan_tribuna_tagged_players t
    join public.profiles p on p.id = t.player_profile_id
    left join lateral (
      select reason, note
      from public.content_tag_reports cr
      where cr.content_type = 'fan_tribuna'
        and cr.post_id = t.post_id
        and cr.tagged_id = t.player_profile_id
      order by cr.created_at desc
      limit 1
    ) r on true
    where t.status in ('reported', 'in_review')

    union all

    -- media_profile: profile targets only (club/team not yet supported on this surface)
    select
      'media_profile'::text,
      t.post_id,
      t.target_id,
      coalesce(p.full_name, 'Profilo'),
      t.created_at,
      r.reason,
      r.note
    from public.media_profile_post_tagged_targets t
    join public.profiles p on p.id = t.target_id
    left join lateral (
      select reason, note
      from public.content_tag_reports cr
      where cr.content_type = 'media_profile'
        and cr.post_id = t.post_id
        and cr.tagged_id = t.target_id
        and cr.target_type = 'profile'
      order by cr.created_at desc
      limit 1
    ) r on true
    where t.status in ('reported', 'in_review')
      and t.target_type = 'profile'

    order by 5 desc;
end;
$$;

revoke all on function public.fetch_reported_content_tags() from public;
grant execute on function public.fetch_reported_content_tags() to authenticated;
