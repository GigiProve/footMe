-- Migration: paginate the tagged-content RPCs.
-- Part of RET-04 follow-up — enforces the "Paginate list queries" rule on the
-- tagged-content read paths that were previously unbounded.
--
-- Adds p_limit (default 30) and p_offset (default 0) to:
--   fetch_tagged_content_for_owner
--   fetch_tagged_content_public
--   fetch_tagged_content_for_target
--
-- The UNION ALL result is ordered by published_at desc nulls last and then
-- limit/offset are applied to the whole combined set, so a page spans all three
-- content surfaces in published_at order.
--
-- Adding parameters changes each function's signature. Under PostgREST a 1-arg
-- (or 2-arg) overload plus a new all-defaults overload makes a single-named-arg
-- call ambiguous, so the prior signatures are dropped first. Bodies are otherwise
-- identical to 20260620110000 (security definer, search_path = public, same RLS
-- semantics and target_type/coalesce handling).


-- ============================================================
-- fetch_tagged_content_for_owner (profile targets, status='active')
-- ============================================================

drop function if exists public.fetch_tagged_content_for_owner(uuid);

create or replace function public.fetch_tagged_content_for_owner(
  p_profile_id uuid default auth.uid(),
  p_limit      int  default 30,
  p_offset     int  default 0
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

  -- Clamp paging args to safe bounds.
  if p_limit is null or p_limit < 1 then
    p_limit := 30;
  elsif p_limit > 100 then
    p_limit := 100;
  end if;

  if p_offset is null or p_offset < 0 then
    p_offset := 0;
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

    -- fan_tribuna: profile targets only (target_type='profile'; coalesce handles legacy rows)
    select
      'fan_tribuna'::text,
      fp.id,
      fp.kind,
      fp.title,
      case when fp.kind = 'photo' then fp.thumbnail_url else null::text end,
      fp.profile_id,
      coalesce(pr.full_name, 'Fan'),
      fp.published_at
    from public.fan_tribuna_tagged_players t
    join public.fan_tribuna_posts fp on fp.id = t.post_id and fp.status = 'published'
    join public.profiles pr on pr.id = fp.profile_id
    where t.target_type = 'profile'
      and coalesce(t.target_id, t.player_profile_id) = p_profile_id
      and t.status = 'active'

    order by published_at desc nulls last
    limit p_limit offset p_offset;
end;
$$;

revoke all on function public.fetch_tagged_content_for_owner(uuid, int, int) from public;
grant execute on function public.fetch_tagged_content_for_owner(uuid, int, int) to authenticated;


-- ============================================================
-- fetch_tagged_content_public (profile targets, status in active/reported/in_review)
-- ============================================================

drop function if exists public.fetch_tagged_content_public(uuid);

create or replace function public.fetch_tagged_content_public(
  p_profile_id uuid,
  p_limit      int default 30,
  p_offset     int default 0
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

  if p_limit is null or p_limit < 1 then
    p_limit := 30;
  elsif p_limit > 100 then
    p_limit := 100;
  end if;

  if p_offset is null or p_offset < 0 then
    p_offset := 0;
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
      case when fp.kind = 'photo' then fp.thumbnail_url else null::text end,
      fp.profile_id,
      coalesce(pr.full_name, 'Fan'),
      fp.published_at
    from public.fan_tribuna_tagged_players t
    join public.fan_tribuna_posts fp on fp.id = t.post_id and fp.status = 'published'
    join public.profiles pr on pr.id = fp.profile_id
    where t.target_type = 'profile'
      and coalesce(t.target_id, t.player_profile_id) = p_profile_id
      and t.status in ('active', 'reported', 'in_review')

    order by published_at desc nulls last
    limit p_limit offset p_offset;
end;
$$;

revoke all on function public.fetch_tagged_content_public(uuid, int, int) from public;
grant execute on function public.fetch_tagged_content_public(uuid, int, int) to authenticated;


-- ============================================================
-- fetch_tagged_content_for_target (club/team targets, status='active')
-- ============================================================

drop function if exists public.fetch_tagged_content_for_target(text, uuid);

create or replace function public.fetch_tagged_content_for_target(
  p_target_type text,
  p_target_id   uuid,
  p_limit       int default 30,
  p_offset      int default 0
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

  if p_limit is null or p_limit < 1 then
    p_limit := 30;
  elsif p_limit > 100 then
    p_limit := 100;
  end if;

  if p_offset is null or p_offset < 0 then
    p_offset := 0;
  end if;

  return query
    -- club_media: club/team tags on club media posts
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
    where t.target_type = p_target_type
      and t.target_id   = p_target_id
      and t.status      = 'active'

    union all

    -- media_profile: club/team tags on media-profile posts
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
    where t.target_type = p_target_type
      and t.target_id   = p_target_id
      and t.status      = 'active'

    union all

    -- fan_tribuna: club/team tags on fan tribuna posts
    select
      'fan_tribuna'::text,
      fp.id,
      fp.kind,
      fp.title,
      case when fp.kind = 'photo' then fp.thumbnail_url else null::text end,
      fp.profile_id,
      coalesce(pr.full_name, 'Fan'),
      fp.published_at
    from public.fan_tribuna_tagged_players t
    join public.fan_tribuna_posts fp on fp.id = t.post_id and fp.status = 'published'
    join public.profiles pr on pr.id = fp.profile_id
    where t.target_type = p_target_type
      and t.target_id   = p_target_id
      and t.status      = 'active'

    order by published_at desc nulls last
    limit p_limit offset p_offset;
end;
$$;

revoke all on function public.fetch_tagged_content_for_target(text, uuid, int, int) from public;
grant execute on function public.fetch_tagged_content_for_target(text, uuid, int, int) to authenticated;
