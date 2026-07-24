-- Migration: CER-03 "Cerca → Società" — saved_teams table + expanded
-- search_clubs_page (kind/filters/sort/counters) + saved-items/saved-counts
-- RPC updates so "squadre interne" can be saved/browsed alongside clubs.
--
-- Mirrors conventions from:
--   20260627090000_saved_profiles_clubs.sql  (saved_clubs table/RLS style)
--   20260627090100_saved_following_rpcs.sql  (fetch_saved_items / fetch_saved_counts)
--   20260722100000_search_cerca.sql          (search_clubs_page v1, search_positions_page
--                                              "published" predicate)
--   20260724100000_search_profiles_filters.sql (p_filters jsonb parsing style, p_sort)
--
-- Schema sources reused (verified against the actual migrations before writing this file):
--   clubs           (id, name, logo_url, city, region, category, updated_at — no province)
--   club_teams      (id, club_id, name, category, team_type in ('senior','youth'),
--                     logo_url, city, region, updated_at)
--   club_affiliations (club_id [madre], affiliate_club_id, relationship_label)
--   club_follows    (profile_id, club_id)
--   recruiting_ads  (club_id, team_id, status, target_role text check in
--                     ('player','coach','staff'), published_at) — same "published"
--                     predicate and club/target_role mapping as search_positions_page.
--
-- All new/redefined RPCs are security definer, set search_path = public, guard on
-- auth.uid(), and grant execute to authenticated only (never anon / service role).


-- ============================================================
-- SECTION 1a: TABLE public.saved_teams
-- ============================================================

create table if not exists public.saved_teams (
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.club_teams(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (owner_profile_id, team_id)
);

create index if not exists saved_teams_team_idx
  on public.saved_teams (team_id);

alter table public.saved_teams enable row level security;

drop policy if exists "users manage own saved teams" on public.saved_teams;
create policy "users manage own saved teams"
on public.saved_teams
for all
to authenticated
using (public.is_current_user(owner_profile_id))
with check (public.is_current_user(owner_profile_id));


-- ============================================================
-- SECTION 1b: RPC public.fetch_saved_items (redefined)
--
-- Same signature/body as 20260627090100_saved_following_rpcs.sql, plus a
-- new `saved_teams` branch (kind = 'team'). Team rows surface under the
-- 'club' bucket in Salvati (p_filter in ('all', 'club')) — there is no
-- separate 'team' filter value.
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
-- SECTION 1c: RPC public.fetch_saved_counts (redefined)
--
-- Same signature/body as 20260627090100_saved_following_rpcs.sql. Teams are
-- folded into clubs_count (no new output column) since Salvati shows teams
-- under the same 'club' bucket as clubs.
-- ============================================================

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
      (select count(*) from public.saved_media_tribuna where profile_id = v_uid)
      + (select count(*) from public.saved_club_media  where profile_id = v_uid)
      + (select count(*) from public.saved_fan_tribuna where profile_id = v_uid)
    )::bigint;
end;
$$;

revoke all on function public.fetch_saved_counts() from public;
grant execute on function public.fetch_saved_counts() to authenticated;


-- ============================================================
-- SECTION 1d: RPC public.search_clubs_page (expanded)
--
-- Paginated "Società" tab: clubs and club_teams (squadre interne) merged
-- into one paginated, filterable, sortable set.
--
--   p_kind: null | 'club' | 'team' | 'affiliate' (as v1)
--   p_filters (jsonb, all optional; absent key = no constraint):
--     categories       text[]  — free-text ILIKE match against category
--     region           text    — exact match
--     city             text    — ILIKE match
--     has_senior       bool    — true → club has a senior team
--     has_youth        bool    — true → club has a youth team
--     has_teams        bool    — true → club has at least one team (senior or youth)
--     has_affiliates   bool    — true → club has >= 1 affiliate (as madre)
--     open_positions   bool    — true → club has >= 1 published recruiting_ads
--     target_roles     text[]  — 'player'|'coach'|'staff'; club has >= 1 published
--                                 ad whose target_role is in the set
--     followed         bool    — true → caller follows the club (club_follows)
--     saved            bool    — true → caller has saved the club (saved_clubs)
--   p_sort: 'relevance' (default) | 'vicini' | 'recent' | 'positions' | 'name'
--     Always tie-broken by name asc, entity_id asc.
--
-- Club-structure/positions/followed/saved filters only ever match kind='club'
-- rows (has_senior/has_youth/affiliate_count/open_positions_count are null
-- for team rows, and club_follows/saved_clubs/recruiting_ads are keyed by
-- club id, never a team id) — team rows are naturally excluded whenever one
-- of these filters is active, matching the "club-structure filter" behavior
-- described for CER-03.
--
-- No province/distance/store filter — no such data on clubs/club_teams.
-- ============================================================

drop function if exists public.search_clubs_page(text, text, int, int);

create or replace function public.search_clubs_page(
  p_query   text  default null,
  p_kind    text  default null,
  p_filters jsonb default null,
  p_sort    text  default 'relevance',
  p_limit   int   default 20,
  p_offset  int   default 0
)
returns table (
  kind                 text,
  entity_id            uuid,
  name                 text,
  logo_url             text,
  city                 text,
  region               text,
  category             text,
  parent_club_id       uuid,
  parent_club_name     text,
  is_affiliate         boolean,
  has_senior           boolean,
  has_youth            boolean,
  affiliate_count      int,
  open_positions_count int,
  total_count          bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid  := auth.uid();
  v_term   text  := trim(coalesce(p_query, ''));
  v_limit  int   := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset int   := greatest(coalesce(p_offset, 0), 0);
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb);
  v_sort   text  := coalesce(nullif(trim(p_sort), ''), 'relevance');
  v_viewer_region text;

  v_categories      text[];
  v_region          text;
  v_city            text;
  v_has_senior      boolean;
  v_has_youth       boolean;
  v_has_teams       boolean;
  v_has_affiliates  boolean;
  v_open_positions  boolean;
  v_target_roles    text[];
  v_followed        boolean;
  v_saved           boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_kind is not null and p_kind not in ('club', 'team', 'affiliate') then
    raise exception 'Filtro società non supportato';
  end if;

  if v_sort not in ('relevance', 'vicini', 'recent', 'positions', 'name') then
    raise exception 'Ordinamento non supportato';
  end if;

  -- -------------------------------------------------------
  -- Filter extraction (defensive; unknown keys ignored — see
  -- 20260724100000_search_profiles_filters.sql for the same style).
  -- -------------------------------------------------------

  select array_agg(elem)
  into v_categories
  from jsonb_array_elements_text(coalesce(v_filters -> 'categories', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  v_region := nullif(trim(coalesce(v_filters ->> 'region', '')), '');
  v_city   := nullif(trim(coalesce(v_filters ->> 'city', '')), '');

  v_has_senior     := (v_filters ->> 'has_senior')::boolean;
  v_has_youth      := (v_filters ->> 'has_youth')::boolean;
  v_has_teams      := (v_filters ->> 'has_teams')::boolean;
  v_has_affiliates := (v_filters ->> 'has_affiliates')::boolean;
  v_open_positions := (v_filters ->> 'open_positions')::boolean;

  select array_agg(elem)
  into v_target_roles
  from jsonb_array_elements_text(coalesce(v_filters -> 'target_roles', '[]'::jsonb)) as elem
  where elem in ('player', 'coach', 'staff');

  v_followed := (v_filters ->> 'followed')::boolean;
  v_saved    := (v_filters ->> 'saved')::boolean;

  select p.region into v_viewer_region
  from public.profiles p
  where p.id = v_uid;

  return query
  with
  clubs_q as (
    select
      'club'::text          as kind,
      c.id                  as entity_id,
      c.name                as name,
      c.logo_url            as logo_url,
      c.city                as city,
      c.region              as region,
      c.category            as category,
      null::uuid            as parent_club_id,
      null::text            as parent_club_name,
      exists (
        select 1 from public.club_affiliations ca
        where ca.affiliate_club_id = c.id
      )                     as is_affiliate,
      exists (
        select 1 from public.club_teams ct
        where ct.club_id = c.id and ct.team_type = 'senior'
      )                     as has_senior,
      exists (
        select 1 from public.club_teams ct
        where ct.club_id = c.id and ct.team_type = 'youth'
      )                     as has_youth,
      (
        select count(*)::int from public.club_affiliations ca
        where ca.club_id = c.id
      )                     as affiliate_count,
      (
        -- Same "published" predicate + club link as search_positions_page.
        select count(*)::int from public.recruiting_ads ra
        where ra.club_id = c.id and ra.status = 'published'
      )                     as open_positions_count,
      c.updated_at          as updated_at,
      (case when v_term <> '' then similarity(lower(c.name), lower(v_term)) else 0 end) as rank_score
    from public.clubs c
    where v_term = '' or c.name ilike '%' || v_term || '%'
  ),
  teams_q as (
    select
      'team'::text          as kind,
      ct.id                 as entity_id,
      ct.name               as name,
      ct.logo_url           as logo_url,
      ct.city               as city,
      ct.region             as region,
      ct.category           as category,
      parent.id             as parent_club_id,
      parent.name           as parent_club_name,
      false                 as is_affiliate,
      null::boolean         as has_senior,
      null::boolean         as has_youth,
      null::int             as affiliate_count,
      null::int             as open_positions_count,
      ct.updated_at         as updated_at,
      (case when v_term <> '' then similarity(lower(ct.name), lower(v_term)) else 0 end) as rank_score
    from public.club_teams ct
    join public.clubs parent on parent.id = ct.club_id
    where v_term = '' or ct.name ilike '%' || v_term || '%'
  ),
  combined as (
    select * from clubs_q
    union all
    select * from teams_q
  ),
  filtered as (
    select combined.*
    from combined
    where
      case p_kind
        when 'club'      then combined.kind = 'club'
        when 'team'       then combined.kind = 'team'
        when 'affiliate'  then combined.kind = 'club' and combined.is_affiliate
        else true
      end
      and (
        v_categories is null
        or exists (
          select 1 from unnest(v_categories) as cat
          where combined.category ilike '%' || cat || '%'
        )
      )
      and (v_region is null or combined.region = v_region)
      and (v_city is null or combined.city ilike '%' || v_city || '%')
      and (coalesce(v_has_senior, false) = false or combined.has_senior = true)
      and (coalesce(v_has_youth, false) = false or combined.has_youth = true)
      and (
        coalesce(v_has_teams, false) = false
        or combined.has_senior = true
        or combined.has_youth = true
      )
      and (
        coalesce(v_has_affiliates, false) = false
        or coalesce(combined.affiliate_count, 0) > 0
      )
      and (
        coalesce(v_open_positions, false) = false
        or coalesce(combined.open_positions_count, 0) > 0
      )
      and (
        v_target_roles is null
        or exists (
          select 1 from public.recruiting_ads ra
          where ra.club_id = combined.entity_id
            and ra.status = 'published'
            and ra.target_role = any(v_target_roles)
        )
      )
      and (
        coalesce(v_followed, false) = false
        or exists (
          select 1 from public.club_follows cf
          where cf.profile_id = v_uid and cf.club_id = combined.entity_id
        )
      )
      and (
        coalesce(v_saved, false) = false
        or exists (
          select 1 from public.saved_clubs sc
          where sc.owner_profile_id = v_uid and sc.club_id = combined.entity_id
        )
      )
  )
  select
    filtered.kind,
    filtered.entity_id,
    filtered.name,
    filtered.logo_url,
    filtered.city,
    filtered.region,
    filtered.category,
    filtered.parent_club_id,
    filtered.parent_club_name,
    filtered.is_affiliate,
    filtered.has_senior,
    filtered.has_youth,
    filtered.affiliate_count,
    filtered.open_positions_count,
    count(*) over ()::bigint as total_count
  from filtered
  order by
    (case
      when v_sort = 'vicini' and v_viewer_region is not null and filtered.region = v_viewer_region
      then 0 else 1
    end) asc,
    (case when v_sort in ('relevance', 'vicini') then filtered.rank_score else 0 end) desc,
    (case when v_sort = 'recent' then filtered.updated_at end) desc nulls last,
    (case when v_sort = 'positions' then filtered.open_positions_count end) desc nulls last,
    filtered.name asc,
    filtered.entity_id asc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.search_clubs_page(text, text, jsonb, text, int, int) from public;
grant execute on function public.search_clubs_page(text, text, jsonb, text, int, int) to authenticated;
