-- Migration: editorial post modes (source_type, display_mode, source_name) on
-- media_profile_posts, and enriched subtitle for search_tag_targets profiles branch.

-- ============================================================
-- SECTION 1: New columns on media_profile_posts
-- ============================================================

-- source_type: which publish mode created the post.
--   'platform'  → written on-platform (default / existing rows)
--   'link'      → imported from an external URL
--   'pasted'    → text pasted by the author
alter table public.media_profile_posts
  add column if not exists source_type text not null default 'platform';

alter table public.media_profile_posts
  drop constraint if exists media_profile_posts_source_type_check;

alter table public.media_profile_posts
  add constraint media_profile_posts_source_type_check
  check (source_type in ('platform', 'link', 'pasted'));

-- display_mode: for link-imported posts, whether to show only a preview+link
-- or render the full article body inside the app.
--   'full'    → default / platform / pasted posts show full content (default)
--   'preview' → link-imported post shows cover + excerpt + external_url only
alter table public.media_profile_posts
  add column if not exists display_mode text not null default 'full';

alter table public.media_profile_posts
  drop constraint if exists media_profile_posts_display_mode_check;

alter table public.media_profile_posts
  add constraint media_profile_posts_display_mode_check
  check (display_mode in ('preview', 'full'));

-- source_name: nullable label for the original source (e.g. "Gazzetta dello Sport").
-- Relevant when source_type = 'link' or 'pasted'.
alter table public.media_profile_posts
  add column if not exists source_name text;


-- ============================================================
-- SECTION 2: Enriched search_tag_targets — richer profile subtitle
-- ============================================================
--
-- Schema sources used:
--
--   PLAYERS:
--     • player_profiles.primary_position  (player_position enum)
--         added: 20260309000000_initial_schema.sql
--     • club_members (profile_id, club_id, team_id, status, is_current)
--         base:  20260323000000_club_members.sql
--         is_current / team_id added: 20260615120000_club_members_team_and_approval.sql
--     • club_teams.name  (20260324000000_club_teams.sql)
--     • clubs.name       (20260309000000_initial_schema.sql)
--     Subtitle format:  "<team_name> • <primary_position>"
--                    or "<club_name> • <primary_position>"
--                    or "<primary_position>"
--                    or "<city>"  (last resort)
--
--   COACHES:
--     • coach_profiles.current_club  (text, nullable)
--         added: 20260407000003_coach_info_fields.sql
--     • coach_profiles.primary_role  (text, nullable)
--         added: 20260411160000_onboarding_profile_alignment.sql
--     Subtitle format:  "<current_club> • <primary_role>"
--                    or "<current_club>"
--                    or "<primary_role>"
--                    or "<city>"
--
--   STAFF:
--     • staff_profiles.primary_staff_role  (text, nullable)
--         added: 20260330090000_staff_roles_and_experiences.sql
--     • current club via club_members (same join as players)
--     Subtitle format:  "<club_name> • <primary_staff_role>"
--                    or "<club_name>"
--                    or "<primary_staff_role>"
--                    or "<city>"
--
--   DIRECTORS:
--     • director_profiles.primary_role  (text, nullable)
--         added: 20260401220000_director_profiles.sql
--     • current club via club_members (same join as players)
--     Subtitle format:  "<club_name> • <primary_role>"
--                    or "<club_name>"
--                    or "<primary_role>"
--                    or "<city>"
--
-- Security notes:
--   • The function is security definer with set search_path = public.
--   • profiles_with_age is security_invoker=true — reading it inside a
--     security-definer function causes it to execute with the caller's
--     RLS context, not the definer's. This is the same behaviour as the
--     previous version and is intentional (public profiles are visible
--     to all authenticated users; restricted profiles are filtered out
--     by the view's own RLS).
--   • player_profiles, coach_profiles, staff_profiles, director_profiles,
--     club_members, club_teams, clubs all have open SELECT policies for
--     authenticated users (or no policy restricting reads), so joining
--     them under security definer does not leak data beyond what those
--     policies allow for any authenticated caller.
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

    -- -------------------------------------------------------
    -- Profiles: player, coach, staff, director
    -- (excluding fan / media / agent / club_admin)
    -- Subtitle is enriched per-role (see comments above).
    -- -------------------------------------------------------
    select
      'profile'::text                    as target_type,
      pwa.id                             as target_id,
      pwa.full_name                      as display_name,
      pwa.avatar_url                     as avatar_url,
      pwa.role::text                     as role_label,

      -- Build the subtitle from the richest available data for each role.
      coalesce(
        case pwa.role::text

          -- ---- PLAYER ----------------------------------------
          when 'player' then (
            select
              -- Prefer team name (squad within club); fall back to club name.
              -- Then append primary_position.  Degrade gracefully.
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
            -- Most-recent current active club membership
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
        -- Final fallback: city (matches previous contract — never null)
        pwa.city
      , ''
      )                                  as subtitle

    from public.profiles_with_age pwa
    where pwa.role in ('player', 'coach', 'staff', 'director')
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
