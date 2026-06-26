-- Migration: fan_tribuna-aware RPC updates + new fetch_tagged_content_for_target.
-- Part of RET-04 fan content + tag (Fase 1).
--
-- All functions are CREATE OR REPLACE (return types are unchanged).
-- fetch_reported_content_tags: drop-and-recreate because its return type changes
-- (fan_tribuna branch now resolves by target_type, not just player_profile_id).


-- ============================================================
-- search_tag_targets
-- Identical body to 20260619110000 except the profile role filter
-- now includes 'media' so media-role profiles are searchable as tag targets.
-- ============================================================

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

    -- -------------------------------------------------------
    -- Profiles: player, coach, staff, director, media
    -- -------------------------------------------------------
    select
      'profile'::text                    as target_type,
      pwa.id                             as target_id,
      pwa.full_name                      as display_name,
      pwa.avatar_url                     as avatar_url,
      pwa.role::text                     as role_label,

      coalesce(
        case pwa.role::text

          -- ---- PLAYER ----------------------------------------
          when 'player' then (
            select
              case
                when nullif(trim(coalesce(ct.name, c.name, '')), '') is not null
                  and nullif(trim(pp.primary_position::text), '') is not null
                then
                  nullif(trim(coalesce(ct.name, c.name, '')), '')
                  || ' • '
                  || pp.primary_position::text

                when nullif(trim(coalesce(ct.name, c.name, '')), '') is not null
                then nullif(trim(coalesce(ct.name, c.name, '')), '')

                when nullif(trim(pp.primary_position::text), '') is not null
                then pp.primary_position::text

                else null
              end
            from public.player_profiles pp
            left join lateral (
              select cm.club_id, cm.team_id
              from public.club_members cm
              where cm.profile_id = pwa.id
                and cm.status     = 'active'
                and cm.is_current = true
              order by cm.created_at desc
              limit 1
            ) cm on true
            left join public.clubs      c  on c.id  = cm.club_id
            left join public.club_teams ct on ct.id = cm.team_id
            where pp.profile_id = pwa.id
          )

          -- ---- COACH -----------------------------------------
          when 'coach' then (
            select
              case
                when nullif(trim(coalesce(cp.current_club, '')), '') is not null
                  and nullif(trim(coalesce(cp.primary_role, '')), '') is not null
                then
                  nullif(trim(cp.current_club), '')
                  || ' • '
                  || nullif(trim(cp.primary_role), '')

                when nullif(trim(coalesce(cp.current_club, '')), '') is not null
                then nullif(trim(cp.current_club), '')

                when nullif(trim(coalesce(cp.primary_role, '')), '') is not null
                then nullif(trim(cp.primary_role), '')

                else null
              end
            from public.coach_profiles cp
            where cp.profile_id = pwa.id
          )

          -- ---- STAFF -----------------------------------------
          when 'staff' then (
            select
              case
                when nullif(trim(coalesce(c.name, '')), '') is not null
                  and nullif(trim(coalesce(sp.primary_staff_role, '')), '') is not null
                then
                  nullif(trim(c.name), '')
                  || ' • '
                  || nullif(trim(sp.primary_staff_role), '')

                when nullif(trim(coalesce(c.name, '')), '') is not null
                then nullif(trim(c.name), '')

                when nullif(trim(coalesce(sp.primary_staff_role, '')), '') is not null
                then nullif(trim(sp.primary_staff_role), '')

                else null
              end
            from public.staff_profiles sp
            left join lateral (
              select cm.club_id
              from public.club_members cm
              where cm.profile_id = pwa.id
                and cm.status     = 'active'
                and cm.is_current = true
              order by cm.created_at desc
              limit 1
            ) cm on true
            left join public.clubs c on c.id = cm.club_id
            where sp.profile_id = pwa.id
          )

          -- ---- DIRECTOR --------------------------------------
          when 'director' then (
            select
              case
                when nullif(trim(coalesce(c.name, '')), '') is not null
                  and nullif(trim(coalesce(dp.primary_role, '')), '') is not null
                then
                  nullif(trim(c.name), '')
                  || ' • '
                  || nullif(trim(dp.primary_role), '')

                when nullif(trim(coalesce(c.name, '')), '') is not null
                then nullif(trim(c.name), '')

                when nullif(trim(coalesce(dp.primary_role, '')), '') is not null
                then nullif(trim(dp.primary_role), '')

                else null
              end
            from public.director_profiles dp
            left join lateral (
              select cm.club_id
              from public.club_members cm
              where cm.profile_id = pwa.id
                and cm.status     = 'active'
                and cm.is_current = true
              order by cm.created_at desc
              limit 1
            ) cm on true
            left join public.clubs c on c.id = cm.club_id
            where dp.profile_id = pwa.id
          )

          else null
        end,
        -- Final fallback: city
        pwa.city
      , ''
      )                                  as subtitle

    from public.profiles_with_age pwa
    where pwa.role in ('player', 'coach', 'staff', 'director', 'media')
      and pwa.full_name ilike '%' || trim(p_query) || '%'

    union all

    -- -------------------------------------------------------
    -- Clubs
    -- -------------------------------------------------------
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

    -- -------------------------------------------------------
    -- Club teams (squadre interne)
    -- -------------------------------------------------------
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


-- ============================================================
-- report_content_tag
-- fan_tribuna branch updated to match on
--   post_id AND target_type AND coalesce(target_id, player_profile_id)
-- mirroring the club_media branch style.
-- ============================================================

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
      where post_id    = p_post_id
        and target_type = p_target_type
        and coalesce(target_id, player_profile_id) = p_tagged_id;

  elsif p_content_type = 'media_profile' then
    update public.media_profile_post_tagged_targets
      set status = 'reported'
      where post_id    = p_post_id
        and target_type = p_target_type
        and target_id   = p_tagged_id;
  end if;
end;
$$;

revoke all on function public.report_content_tag(text, uuid, uuid, text, text, text) from public;
grant execute on function public.report_content_tag(text, uuid, uuid, text, text, text) to authenticated;


-- ============================================================
-- moderate_content_tag
-- fan_tribuna branch updated to match on
--   coalesce(target_id, player_profile_id) mirroring club_media style.
-- ============================================================

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
        and coalesce(target_id, player_profile_id) = p_tagged_id;

  elsif p_content_type = 'media_profile' then
    update public.media_profile_post_tagged_targets
      set status = v_status
      where post_id    = p_post_id
        and target_id   = p_tagged_id
        and target_type = 'profile';

  else
    raise exception 'Tipo di contenuto non valido';
  end if;
end;
$$;

revoke all on function public.moderate_content_tag(text, uuid, uuid, boolean) from public;
grant execute on function public.moderate_content_tag(text, uuid, uuid, boolean) to authenticated;


-- ============================================================
-- fetch_reported_content_tags
-- fan_tribuna branch now resolves tagged_name by target_type
-- (profile → profiles; club → clubs; team → club_teams).
-- Lateral report join uses coalesce(t.target_id, t.player_profile_id)
-- and cr.target_type = t.target_type.
-- Return type changes → drop first.
-- ============================================================

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
    -- club_media: all target types
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

    -- fan_tribuna: all target types resolved by target_type
    select
      'fan_tribuna'::text,
      t.post_id,
      coalesce(t.target_id, t.player_profile_id),
      case
        when t.target_type = 'profile' then coalesce(fp.full_name, t.display_name, 'Profilo')
        when t.target_type = 'club'    then coalesce(cl.name, t.display_name, 'Società')
        when t.target_type = 'team'    then coalesce(ct.name, t.display_name, 'Squadra')
        else coalesce(t.display_name, 'Sconosciuto')
      end,
      t.created_at,
      r.reason,
      r.note
    from public.fan_tribuna_tagged_players t
    left join public.profiles fp
      on fp.id = t.player_profile_id and t.target_type = 'profile'
    left join public.clubs cl
      on cl.id = t.target_id and t.target_type = 'club'
    left join public.club_teams ct
      on ct.id = t.target_id and t.target_type = 'team'
    left join lateral (
      select reason, note
      from public.content_tag_reports cr
      where cr.content_type = 'fan_tribuna'
        and cr.post_id   = t.post_id
        and cr.tagged_id = coalesce(t.target_id, t.player_profile_id)
        and cr.target_type = t.target_type
      order by cr.created_at desc
      limit 1
    ) r on true
    where t.status in ('reported', 'in_review')

    union all

    -- media_profile: profile targets only
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


-- ============================================================
-- fetch_tagged_content_for_owner
-- fan_tribuna branch: filter on target_type='profile' and
-- coalesce(target_id, player_profile_id); thumbnail from photo posts.
-- ============================================================

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

    order by published_at desc nulls last;
end;
$$;

revoke all on function public.fetch_tagged_content_for_owner(uuid) from public;
grant execute on function public.fetch_tagged_content_for_owner(uuid) to authenticated;


-- ============================================================
-- fetch_tagged_content_public
-- Same shape as fetch_tagged_content_for_owner but status in
-- ('active','reported','in_review') for third-party viewing.
-- fan_tribuna branch gets the same target_type + coalesce update
-- and photo-thumbnail case.
-- ============================================================

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

    order by published_at desc nulls last;
end;
$$;

revoke all on function public.fetch_tagged_content_public(uuid) from public;
grant execute on function public.fetch_tagged_content_public(uuid) to authenticated;


-- ============================================================
-- fetch_tagged_content_for_target
-- NEW RPC. Returns the same 8-column shape as fetch_tagged_content_for_owner
-- but filtered on a specific non-profile target (club or team).
-- Used by the public club/team Media tabs to show all content that tags them.
-- ============================================================

create or replace function public.fetch_tagged_content_for_target(
  p_target_type text,
  p_target_id   uuid
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

    order by published_at desc nulls last;
end;
$$;

revoke all on function public.fetch_tagged_content_for_target(text, uuid) from public;
grant execute on function public.fetch_tagged_content_for_target(text, uuid) to authenticated;
