-- ============================================================
-- CER-05 — Salvati: copertura completa dei contenuti
--
-- CER-05 §14 richiede che i bookmark fatti da Cerca > Media e contenuti
-- confluiscano nella sezione Salvati già esistente, senza creare un secondo
-- sistema di salvataggio. La ricerca copre 5 tabelle contenuto, ma
-- fetch_saved_items / fetch_saved_counts ne coprivano solo 3: mancavano
-- saved_media_profile_posts e saved_fan_media.
--
-- Schema sources reused (verified against the actual migrations before
-- writing this file):
--   20260724110000_clubs_search_and_saved_teams.sql  definizione corrente di
--                                                    fetch_saved_items /
--                                                    fetch_saved_counts
--   20260519090000_media_profile_posts.sql           saved_media_profile_posts,
--                                                    media_profile_posts.cover_url
--   20260515020000_fan_community_profile.sql         saved_fan_media,
--                                                    fan_media_posts (description/tag/visual_url)
--
-- Firma invariata rispetto a 20260724110000, quindi `create or replace`
-- senza drop: nessun rischio di overload ambiguo in PostgREST.
--
-- fan_media_posts non ha `title`: si usa `description`, già vincolata a
-- 280 caratteri dal check di tabella.
-- ============================================================

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

    -- ── saved_teams (squadre interne) ────────────────────────────
    select
      'team'::text                        as kind,
      'saved_teams'::text                 as source_table,
      st.team_id                          as entity_id,
      null::text                          as content_type,
      ct.name                             as title,
      coalesce(parent_club.name, ct.category) as subtitle,
      ct.logo_url                         as thumbnail_url,
      st.created_at                       as saved_at
    from public.saved_teams st
    join public.club_teams ct on ct.id = st.team_id
    join public.clubs parent_club on parent_club.id = ct.club_id
    where st.owner_profile_id = v_uid
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
      coalesce(ftp.thumbnail_url, ftp.media_url) as thumbnail_url,
      sft.created_at                      as saved_at
    from public.saved_fan_tribuna sft
    join public.fan_tribuna_posts ftp on ftp.id = sft.post_id
    where sft.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'content')

    union all

    -- ── saved_media_profile_posts (content) — nuovo in CER-05 ────
    select
      'content'::text                     as kind,
      'saved_media_profile_posts'::text   as source_table,
      smp.post_id                         as entity_id,
      'media_profile'::text               as content_type,
      mpp.title                           as title,
      mpp.kind                            as subtitle,
      mpp.cover_url                       as thumbnail_url,
      smp.created_at                      as saved_at
    from public.saved_media_profile_posts smp
    join public.media_profile_posts mpp on mpp.id = smp.post_id
    where smp.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'content')

    union all

    -- ── saved_fan_media (content) — nuovo in CER-05 ──────────────
    select
      'content'::text                     as kind,
      'saved_fan_media'::text             as source_table,
      sfm.post_id                         as entity_id,
      'fan_media'::text                   as content_type,
      fmp.description                     as title,
      fmp.tag                             as subtitle,
      coalesce(fmp.thumbnail_url, fmp.visual_url) as thumbnail_url,
      sfm.created_at                      as saved_at
    from public.saved_fan_media sfm
    join public.fan_media_posts fmp on fmp.id = sfm.post_id
    where sfm.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'content')

  ) rows
  order by rows.saved_at desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.fetch_saved_items(text, int, int) from public;
grant execute on function public.fetch_saved_items(text, int, int) to authenticated;


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
    (
      (select count(*) from public.saved_clubs where owner_profile_id = v_uid)
      + (select count(*) from public.saved_teams where owner_profile_id = v_uid)
    )::bigint,
    (select count(*) from public.saved_ads         where profile_id       = v_uid)::bigint,
    (
      (select count(*) from public.saved_media_tribuna      where profile_id = v_uid)
      + (select count(*) from public.saved_club_media       where profile_id = v_uid)
      + (select count(*) from public.saved_fan_tribuna      where profile_id = v_uid)
      + (select count(*) from public.saved_media_profile_posts where profile_id = v_uid)
      + (select count(*) from public.saved_fan_media        where profile_id = v_uid)
    )::bigint;
end;
$$;

revoke all on function public.fetch_saved_counts() from public;
grant execute on function public.fetch_saved_counts() to authenticated;
