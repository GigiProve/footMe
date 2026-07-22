-- Migration: Coach profile header — cover image + social summary RPCs.
--
-- Adds public.profiles.cover_url (metadata only; the actual image lives in
-- Supabase Storage bucket "profile-media", same convention as avatar_url).
-- Recreates public.profiles_with_age to expose the new column (the view
-- lists explicit columns, so it cannot be extended with a plain
-- `create or replace view`; the same drop+create pattern was already used
-- in 20260322100000_profiles_with_age_add_languages.sql and
-- 20260411160000_onboarding_profile_alignment.sql).
--
-- Adds three read RPCs for the profile header's social summary:
--   - fetch_profile_social_summary   (follower/following counts + mutuals preview)
--   - fetch_profile_followers        (paginated follower list)
--   - fetch_profile_mutual_connections (paginated mutual-connections list)
--
-- "Mutual connection" (connessione in comune) with a target profile is
-- defined as: a profile P such that the authenticated caller follows P,
-- and P follows the target profile — excluding the caller and the target
-- themselves. This definition is duplicated (by design, mirroring the
-- existing repo convention of inlining logic per-RPC rather than sharing
-- private helpers — see 20260627090100_saved_following_rpcs.sql) across
-- fetch_profile_social_summary and fetch_profile_mutual_connections; keep
-- both in sync if the definition ever changes.
--
-- public.profile_follows and public.profiles both grant unrestricted
-- SELECT to the `authenticated` role (see 20260515020000_fan_community_profile.sql
-- and 20260309000001_rls_policies.sql), so these RPCs are safe to run as
-- SECURITY INVOKER: they execute under the caller's own RLS context and
-- never need elevated privileges. set search_path = public is kept for
-- defense in depth, consistent with the rest of the codebase.


-- ============================================================
-- 1. profiles.cover_url
-- ============================================================

alter table public.profiles
  add column if not exists cover_url text;

-- No RLS/policy changes needed: "users can update own profile" (for update)
-- and "profiles are readable by authenticated users" (for select) apply at
-- the row level (using/with check on public.is_current_user(id)), not per
-- column, so they already cover cover_url.

drop view if exists public.profiles_with_age;

create view public.profiles_with_age
with (security_invoker = true) as
select
  profile.id,
  profile.role,
  profile.full_name,
  profile.birth_date,
  public.calculate_age(profile.birth_date) as age,
  profile.nationality,
  profile.bio,
  profile.avatar_url,
  profile.cover_url,
  profile.region,
  profile.city,
  profile.gender,
  profile.residence,
  profile.domicile,
  profile.residence_country,
  profile.current_location_country,
  profile.current_location_city,
  profile.legal_status,
  profile.is_available,
  profile.is_open_to_transfer,
  profile.languages,
  profile.created_at,
  profile.updated_at
from public.profiles profile;

grant select on public.profiles_with_age to anon;
grant select on public.profiles_with_age to authenticated;


-- ============================================================
-- RPC: public.fetch_profile_social_summary
--
-- Single-row summary for a profile header: follower/following counts and
-- a small preview of mutual connections shared with the caller.
--
-- Returned columns:
--   follower_count   bigint  -- rows in profile_follows where followed_profile_id = target
--   following_count  bigint  -- rows in profile_follows where follower_profile_id = target
--   mutual_total     bigint  -- count of mutual connections (see definition above)
--   mutual_preview   jsonb   -- up to 3 {profile_id, display_name, avatar_url} objects,
--                               most-recently-followed-by-caller first; '[]' if none
-- ============================================================

drop function if exists public.fetch_profile_social_summary(uuid);

create or replace function public.fetch_profile_social_summary(
  target_profile_id uuid
)
returns table (
  follower_count  bigint,
  following_count bigint,
  mutual_total    bigint,
  mutual_preview  jsonb
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  return query
  with mutuals as (
    select
      p.id,
      p.full_name,
      p.avatar_url,
      caller_follows.created_at
    from public.profile_follows caller_follows
    join public.profile_follows target_followed
      on target_followed.follower_profile_id = caller_follows.followed_profile_id
     and target_followed.followed_profile_id = target_profile_id
    join public.profiles p on p.id = caller_follows.followed_profile_id
    where caller_follows.follower_profile_id = v_uid
      and caller_follows.followed_profile_id <> v_uid
      and caller_follows.followed_profile_id <> target_profile_id
  )
  select
    (
      select count(*)
      from public.profile_follows
      where followed_profile_id = target_profile_id
    )::bigint as follower_count,
    (
      select count(*)
      from public.profile_follows
      where follower_profile_id = target_profile_id
    )::bigint as following_count,
    (select count(*) from mutuals)::bigint as mutual_total,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'profile_id', preview.id,
            'display_name', preview.full_name,
            'avatar_url', preview.avatar_url
          )
        )
        from (
          select id, full_name, avatar_url
          from mutuals
          order by created_at desc
          limit 3
        ) preview
      ),
      '[]'::jsonb
    ) as mutual_preview;
end;
$$;

revoke all on function public.fetch_profile_social_summary(uuid) from public;
grant execute on function public.fetch_profile_social_summary(uuid) to authenticated;


-- ============================================================
-- RPC: public.fetch_profile_followers
--
-- Paginated list of a profile's followers, most recent first.
--
-- Returned columns:
--   profile_id    uuid
--   display_name  text
--   avatar_url    text
--   role_label    text  -- profiles.role::text, same convention as other
--                          profile-list RPCs (fetch_followed_profiles etc.)
-- ============================================================

drop function if exists public.fetch_profile_followers(uuid, integer, integer);

create or replace function public.fetch_profile_followers(
  target_profile_id uuid,
  page_limit integer default 20,
  page_offset integer default 0
)
returns table (
  profile_id   uuid,
  display_name text,
  avatar_url   text,
  role_label   text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := least(greatest(coalesce(page_limit, 20), 1), 50);
  v_offset int := greatest(coalesce(page_offset, 0), 0);
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    p.id         as profile_id,
    p.full_name  as display_name,
    p.avatar_url as avatar_url,
    p.role::text as role_label
  from public.profile_follows pf
  join public.profiles p on p.id = pf.follower_profile_id
  where pf.followed_profile_id = target_profile_id
  order by pf.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.fetch_profile_followers(uuid, integer, integer) from public;
grant execute on function public.fetch_profile_followers(uuid, integer, integer) to authenticated;


-- ============================================================
-- RPC: public.fetch_profile_mutual_connections
--
-- Paginated list of mutual connections shared with the target profile
-- (see definition in the header comment above). Ordered by the date the
-- caller started following the mutual profile, most recent first.
--
-- Returned columns: same shape as fetch_profile_followers.
-- ============================================================

drop function if exists public.fetch_profile_mutual_connections(uuid, integer, integer);

create or replace function public.fetch_profile_mutual_connections(
  target_profile_id uuid,
  page_limit integer default 20,
  page_offset integer default 0
)
returns table (
  profile_id   uuid,
  display_name text,
  avatar_url   text,
  role_label   text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := least(greatest(coalesce(page_limit, 20), 1), 50);
  v_offset int := greatest(coalesce(page_offset, 0), 0);
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    p.id         as profile_id,
    p.full_name  as display_name,
    p.avatar_url as avatar_url,
    p.role::text as role_label
  from public.profile_follows caller_follows
  join public.profile_follows target_followed
    on target_followed.follower_profile_id = caller_follows.followed_profile_id
   and target_followed.followed_profile_id = target_profile_id
  join public.profiles p on p.id = caller_follows.followed_profile_id
  where caller_follows.follower_profile_id = v_uid
    and caller_follows.followed_profile_id <> v_uid
    and caller_follows.followed_profile_id <> target_profile_id
  order by caller_follows.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.fetch_profile_mutual_connections(uuid, integer, integer) from public;
grant execute on function public.fetch_profile_mutual_connections(uuid, integer, integer) to authenticated;
