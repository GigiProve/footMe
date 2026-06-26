-- Migration: Follow/Save feature — read RPCs for saved items, saved counts,
-- followed profiles/clubs, and following count.
--
-- All RPCs are security definer, search_path = public, and scope every query
-- to the caller (auth.uid()). Grant execute to authenticated only.
--
-- Mirrors RPC conventions from:
--   20260615120100_agent_representations.sql
--   20260626120000_representation_relationship_types.sql


-- ============================================================
-- RPC: public.fetch_saved_items
--
-- Returns a normalized list of all items the caller has saved,
-- across six save tables, optionally filtered by kind.
--
-- Returned columns:
--   kind          text       -- 'profile' | 'club' | 'position' | 'content'
--   source_table  text       -- origin table name
--   entity_id     uuid       -- saved entity primary id
--   content_type  text       -- 'media_profile' | 'club_media' | 'fan_tribuna' | NULL
--   title         text
--   subtitle      text
--   thumbnail_url text
--   saved_at      timestamptz
--
-- p_filter: 'all' | 'profile' | 'club' | 'position' | 'content'
-- ============================================================

drop function if exists public.fetch_saved_items(text, int, int);

create or replace function public.fetch_saved_items(
  p_filter    text    default 'all',
  p_limit     int     default 20,
  p_offset    int     default 0
)
returns table (
  kind          text,
  source_table  text,
  entity_id     uuid,
  content_type  text,
  title         text,
  subtitle      text,
  thumbnail_url text,
  saved_at      timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  return query
  select *
  from (

    -- ── saved_profiles ──────────────────────────────────────────
    select
      'profile'::text                     as kind,
      'saved_profiles'::text              as source_table,
      sp.target_profile_id                as entity_id,
      null::text                          as content_type,
      p.full_name                         as title,
      p.role::text                        as subtitle,
      p.avatar_url                        as thumbnail_url,
      sp.created_at                       as saved_at
    from public.saved_profiles sp
    join public.profiles p on p.id = sp.target_profile_id
    where sp.owner_profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'profile')

    union all

    -- ── saved_clubs ──────────────────────────────────────────────
    select
      'club'::text                        as kind,
      'saved_clubs'::text                 as source_table,
      sc.club_id                          as entity_id,
      null::text                          as content_type,
      c.name                              as title,
      coalesce(c.category, c.region)      as subtitle,
      c.logo_url                          as thumbnail_url,
      sc.created_at                       as saved_at
    from public.saved_clubs sc
    join public.clubs c on c.id = sc.club_id
    where sc.owner_profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'club')

    union all

    -- ── saved_ads (positions) ────────────────────────────────────
    select
      'position'::text                    as kind,
      'saved_ads'::text                   as source_table,
      sa.ad_id                            as entity_id,
      null::text                          as content_type,
      ra.title                            as title,
      coalesce(ra.region, ra.role_required::text) as subtitle,
      null::text                          as thumbnail_url,
      sa.created_at                       as saved_at
    from public.saved_ads sa
    join public.recruiting_ads ra on ra.id = sa.ad_id
    where sa.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'position')

    union all

    -- ── saved_media_tribuna (content) ───────────────────────────
    select
      'content'::text                     as kind,
      'saved_media_tribuna'::text         as source_table,
      smt.post_id                         as entity_id,
      'media_tribuna'::text               as content_type,
      mtp.title                           as title,
      mtp.kind                            as subtitle,
      null::text                          as thumbnail_url,
      smt.created_at                      as saved_at
    from public.saved_media_tribuna smt
    join public.media_tribuna_posts mtp on mtp.id = smt.post_id
    where smt.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'content')

    union all

    -- ── saved_club_media (content) ──────────────────────────────
    select
      'content'::text                     as kind,
      'saved_club_media'::text            as source_table,
      scm.post_id                         as entity_id,
      'club_media'::text                  as content_type,
      cmp.title                           as title,
      cmp.kind                            as subtitle,
      coalesce(cmp.thumbnail_url, cmp.visual_url) as thumbnail_url,
      scm.created_at                      as saved_at
    from public.saved_club_media scm
    join public.club_media_posts cmp on cmp.id = scm.post_id
    where scm.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'content')

    union all

    -- ── saved_fan_tribuna (content) ─────────────────────────────
    select
      'content'::text                     as kind,
      'saved_fan_tribuna'::text           as source_table,
      sft.post_id                         as entity_id,
      'fan_tribuna'::text                 as content_type,
      ftp.title                           as title,
      ftp.kind                            as subtitle,
      null::text                          as thumbnail_url,
      sft.created_at                      as saved_at
    from public.saved_fan_tribuna sft
    join public.fan_tribuna_posts ftp on ftp.id = sft.post_id
    where sft.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'content')

  ) rows
  order by rows.saved_at desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.fetch_saved_items(text, int, int) from public;
grant execute on function public.fetch_saved_items(text, int, int) to authenticated;


-- ============================================================
-- RPC: public.fetch_saved_counts
--
-- Returns one row with integer counts for the caller across
-- all six save tables, grouped into four UI buckets.
--
-- Returned columns:
--   profiles_count  bigint
--   clubs_count     bigint
--   positions_count bigint
--   contents_count  bigint   (sum of media_tribuna + club_media + fan_tribuna)
-- ============================================================

drop function if exists public.fetch_saved_counts();

create or replace function public.fetch_saved_counts()
returns table (
  profiles_count  bigint,
  clubs_count     bigint,
  positions_count bigint,
  contents_count  bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    (select count(*) from public.saved_profiles   where owner_profile_id = v_uid)::bigint,
    (select count(*) from public.saved_clubs       where owner_profile_id = v_uid)::bigint,
    (select count(*) from public.saved_ads         where profile_id       = v_uid)::bigint,
    (
      (select count(*) from public.saved_media_tribuna where profile_id = v_uid)
      + (select count(*) from public.saved_club_media  where profile_id = v_uid)
      + (select count(*) from public.saved_fan_tribuna where profile_id = v_uid)
    )::bigint;
end;
$$;

revoke all on function public.fetch_saved_counts() from public;
grant execute on function public.fetch_saved_counts() to authenticated;


-- ============================================================
-- RPC: public.fetch_followed_profiles
--
-- Returns a normalized list of all profiles and clubs the
-- caller follows, optionally filtered by kind.
--
-- Returned columns:
--   kind         text       -- 'profile' | 'club'
--   entity_id    uuid       -- followed profile id or club id
--   name         text
--   role         text       -- profiles.role::text for people; 'club' for clubs
--   subtitle     text
--   avatar_url   text
--   followed_at  timestamptz
--
-- p_filter: 'all' | 'club' | any app_role value
--   ('player', 'coach', 'agent', 'staff', 'director', 'media', 'fan', 'club_admin')
-- ============================================================

drop function if exists public.fetch_followed_profiles(text, int, int);

create or replace function public.fetch_followed_profiles(
  p_filter    text    default 'all',
  p_limit     int     default 20,
  p_offset    int     default 0
)
returns table (
  kind         text,
  entity_id    uuid,
  name         text,
  role         text,
  subtitle     text,
  avatar_url   text,
  followed_at  timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  return query
  select *
  from (

    -- ── profile_follows ─────────────────────────────────────────
    select
      'profile'::text                 as kind,
      pf.followed_profile_id          as entity_id,
      p.full_name                     as name,
      p.role::text                    as role,
      coalesce(p.city, p.region)      as subtitle,
      p.avatar_url                    as avatar_url,
      pf.created_at                   as followed_at
    from public.profile_follows pf
    join public.profiles p on p.id = pf.followed_profile_id
    where pf.follower_profile_id = v_uid
      and (
        p_filter = 'all'
        or (p_filter <> 'club' and p.role::text = p_filter)
      )

    union all

    -- ── club_follows ─────────────────────────────────────────────
    select
      'club'::text                    as kind,
      cf.club_id                      as entity_id,
      c.name                          as name,
      'club'::text                    as role,
      coalesce(c.category, c.region)  as subtitle,
      c.logo_url                      as avatar_url,
      cf.created_at                   as followed_at
    from public.club_follows cf
    join public.clubs c on c.id = cf.club_id
    where cf.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'club')

  ) rows
  order by rows.followed_at desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.fetch_followed_profiles(text, int, int) from public;
grant execute on function public.fetch_followed_profiles(text, int, int) to authenticated;


-- ============================================================
-- RPC: public.fetch_following_count
--
-- Returns total count of profiles + clubs the caller follows.
-- Single integer for preview badges/counters.
-- ============================================================

drop function if exists public.fetch_following_count();

create or replace function public.fetch_following_count()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid   := auth.uid();
  v_count bigint;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select
    (select count(*) from public.profile_follows where follower_profile_id = v_uid)
    + (select count(*) from public.club_follows  where profile_id          = v_uid)
  into v_count;

  return v_count;
end;
$$;

revoke all on function public.fetch_following_count() from public;
grant execute on function public.fetch_following_count() to authenticated;
