-- Migration: CER-02 "Cerca → Profili" advanced filters, sort and metadata.
--
-- Redefines public.search_profiles_page (introduced by
-- 20260722100000_search_cerca.sql) to add per-category metadata columns,
-- a jsonb advanced-filters payload (p_filters) and a sort mode (p_sort),
-- while keeping the original 11 columns first and in the same order for
-- backward compatibility with older clients during the rollout window.
--
-- Schema sources reused for the new predicates/columns (verified against
-- the actual migrations before writing this file):
--   player_profiles   (contract_expiry, transfer_provinces, transfer_regions,
--                       availability_type, preferred_foot, height_cm,
--                       highlight_video_url, media_urls, media_items,
--                       willing_to_change_club)
--   coach_profiles     (primary_role, licenses[], coached_categories[],
--                       preferred_provinces[], open_to_new_role)
--   coach_career_entries / coach_director_career_entries / coach_player_career_entries
--                      (best-effort proxies for "stagioni minime" and
--                       "esperienze precedenti")
--   staff_profiles     (primary_staff_role, staff_roles[], certifications[],
--                       preferred_categories[], preferred_provinces[], open_to_work)
--   agent_profiles / agent_career_entries
--                      (operating_regions[]/operating_macro_areas[],
--                       player_types[], managed_players_count,
--                       period_start_year → years_experience proxy)
--   club_teams.team_type ('senior' | 'youth') — reliable discriminator for
--                       the staff "ambito" filter when the profile is
--                       currently tesserato (see 20260324000000_club_teams.sql).
--
-- Option-string sources that must stay aligned with this migration:
--   - agent managed-player bands: apps/mobile/src/features/onboarding/agent/agent-options.ts
--     (AGENT_MANAGED_PLAYERS_OPTIONS: '1-5 calciatori' | '5-15 calciatori' | '15+ calciatori')
--   - coach licenses: apps/mobile/src/features/onboarding/coach/CoachRoleStep.tsx
--     ('UEFA Pro' | 'UEFA A' | 'UEFA B' | 'UEFA C' | 'Patentino base')
--   - "settore giovanile" category set (coach context / staff scope heuristic):
--     Juniores, Allievi, Giovanissimi, Berretti, Scuola Calcio, Settore Giovanile
--
-- Deliberately deferred: GIN indexes on the new array columns used for
-- overlap (&&) predicates (transfer_provinces, preferred_provinces,
-- coached_categories, staff_roles, certifications, operating_regions, ...).
-- v1 data volumes do not justify the write/storage overhead yet; revisit
-- once "Cerca > Profili" traffic and table sizes grow.

create index if not exists profiles_updated_at_idx
  on public.profiles (updated_at desc);

create index if not exists profiles_region_idx
  on public.profiles (region);


-- ============================================================
-- RPC: public.search_profiles_page (redefined)
-- ============================================================

drop function if exists public.search_profiles_page(text, public.app_role, int, int);

create or replace function public.search_profiles_page(
  p_query   text default null,
  p_role    public.app_role default null,
  p_limit   int default 20,
  p_offset  int default 0,
  p_filters jsonb default null,
  p_sort    text default 'relevance'
)
returns table (
  profile_id            uuid,
  full_name             text,
  avatar_url            text,
  role                  public.app_role,
  region                text,
  city                  text,
  primary_position      public.player_position,
  current_club_name     text,
  current_team_name     text,
  age                   int,
  is_available          boolean,
  birth_year            int,
  is_open_to_transfer   boolean,
  current_category      text,
  coach_primary_role    text,
  coach_top_license     text,
  coach_context         text,
  open_to_new_role      boolean,
  staff_primary_role    text,
  experience_summary    text,
  open_to_work          boolean,
  agency_name           text,
  managed_players_count text,
  agent_operating_areas text[],
  open_to_players       boolean,
  years_experience      int,
  total_count           bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_term         text := trim(coalesce(p_query, ''));
  v_limit        int  := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset       int  := greatest(coalesce(p_offset, 0), 0);
  v_filters      jsonb := coalesce(p_filters, '{}'::jsonb);
  v_sort         text := coalesce(nullif(trim(p_sort), ''), 'relevance');
  v_current_year int  := extract(year from current_date)::int;
  v_viewer_region text;
  v_swap         int;

  -- "Settore giovanile" category set, shared by coach_context and the
  -- staff scope fallback heuristic. Keep aligned with the categories
  -- surfaced by onboarding (player-sports.ts YOUTH_CATEGORY_OPTIONS /
  -- PLAYER_CATEGORY_OPTIONS use a slightly different list; this is the
  -- coarser "youth vs first team" split used only for search filters).
  v_youth_categories text[] := array[
    'Juniores', 'Allievi', 'Giovanissimi', 'Berretti', 'Scuola Calcio', 'Settore Giovanile'
  ];

  -- shared
  v_region       text;
  v_is_available boolean;

  -- player
  v_p_positions           public.player_position[];
  v_p_classe_min          int;
  v_p_classe_max          int;
  v_p_situation           text;
  v_p_categories          text[];
  v_p_provinces           text[];
  v_p_transfer_areas      text[];
  v_p_is_open_to_transfer boolean;
  v_p_preferred_foot      public.preferred_foot;
  v_p_height_min          int;
  v_p_height_max          int;
  v_p_has_video           boolean;

  -- coach
  v_c_role               text;
  v_c_licenses           text[];
  v_c_context            text;
  v_c_min_seasons        int;
  v_c_coached_categories text[];
  v_c_provinces          text[];
  v_c_open_to_new_role   boolean;
  v_c_backgrounds        text[];

  -- staff
  v_s_roles              text[];
  v_s_has_certifications boolean;
  v_s_certifications     text[];
  v_s_categories         text[];
  v_s_scope              text;
  v_s_provinces          text[];
  v_s_open_to_work       boolean;

  -- agent
  v_a_operating_areas        text[];
  v_a_player_types           text[];
  v_a_managed_bands          text[];
  v_a_min_years              int;
  v_a_is_federation_licensed boolean;
  v_a_open_to_players        boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_role is not null and p_role::text not in ('player', 'coach', 'staff', 'agent') then
    raise exception 'Ruolo di ricerca non supportato';
  end if;

  if v_sort not in ('relevance', 'recent', 'vicini', 'classe_asc', 'classe_desc') then
    raise exception 'Ordinamento non supportato';
  end if;

  -- -------------------------------------------------------
  -- Filter extraction: defensive parsing of p_filters.
  -- Unknown keys are ignored. Enum-typed columns are only ever cast from
  -- client text after checking it against enum_range(...) — client text is
  -- NEVER cast blindly to an enum. Plain text[] overlap filters do not need
  -- this guard (no cast happens, equality/overlap against garbage values is
  -- simply a no-match). Numeric filters are clamped to sane bounds and
  -- swapped when min > max.
  -- -------------------------------------------------------

  v_region := nullif(trim(coalesce(v_filters ->> 'region', '')), '');
  v_is_available := (v_filters ->> 'is_available')::boolean;

  -- player.positions
  select array_agg(pos)
  into v_p_positions
  from (
    select distinct (elem)::public.player_position as pos
    from jsonb_array_elements_text(coalesce(v_filters #> '{player,positions}', '[]'::jsonb)) as elem
    where elem = any(enum_range(null::public.player_position)::text[])
  ) valid_positions;

  -- player.classe_min / classe_max (canonical = birth year)
  v_p_classe_min := nullif(v_filters #>> '{player,classe_min}', '')::int;
  v_p_classe_max := nullif(v_filters #>> '{player,classe_max}', '')::int;

  if v_p_classe_min is not null then
    v_p_classe_min := least(greatest(v_p_classe_min, 1940), v_current_year);
  end if;

  if v_p_classe_max is not null then
    v_p_classe_max := least(greatest(v_p_classe_max, 1940), v_current_year);
  end if;

  if v_p_classe_min is not null and v_p_classe_max is not null and v_p_classe_min > v_p_classe_max then
    v_swap := v_p_classe_min;
    v_p_classe_min := v_p_classe_max;
    v_p_classe_max := v_swap;
  end if;

  v_p_situation := case trim(coalesce(v_filters #>> '{player,situation}', ''))
    when 'svincolato'  then 'svincolato'
    when 'tesserato'   then 'tesserato'
    when 'disponibile' then 'disponibile'
    when 'in_scadenza' then 'in_scadenza'
    else null
  end;

  select array_agg(elem)
  into v_p_categories
  from jsonb_array_elements_text(coalesce(v_filters #> '{player,categories}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  select array_agg(elem)
  into v_p_provinces
  from jsonb_array_elements_text(coalesce(v_filters #> '{player,provinces}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  select array_agg(elem)
  into v_p_transfer_areas
  from jsonb_array_elements_text(coalesce(v_filters #> '{player,transfer_areas}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  v_p_is_open_to_transfer := (v_filters #>> '{player,is_open_to_transfer}')::boolean;

  v_p_preferred_foot := case
    when (v_filters #>> '{player,preferred_foot}') = any(enum_range(null::public.preferred_foot)::text[])
      then (v_filters #>> '{player,preferred_foot}')::public.preferred_foot
    else null
  end;

  v_p_height_min := nullif(v_filters #>> '{player,height_min}', '')::int;
  v_p_height_max := nullif(v_filters #>> '{player,height_max}', '')::int;

  if v_p_height_min is not null then
    v_p_height_min := least(greatest(v_p_height_min, 100), 230);
  end if;

  if v_p_height_max is not null then
    v_p_height_max := least(greatest(v_p_height_max, 100), 230);
  end if;

  if v_p_height_min is not null and v_p_height_max is not null and v_p_height_min > v_p_height_max then
    v_swap := v_p_height_min;
    v_p_height_min := v_p_height_max;
    v_p_height_max := v_swap;
  end if;

  v_p_has_video := (v_filters #>> '{player,has_video}')::boolean;

  -- coach.*
  v_c_role := nullif(trim(coalesce(v_filters #>> '{coach,coach_role}', '')), '');

  select array_agg(elem)
  into v_c_licenses
  from jsonb_array_elements_text(coalesce(v_filters #> '{coach,licenses}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  v_c_context := case trim(coalesce(v_filters #>> '{coach,context}', ''))
    when 'prima_squadra'     then 'prima_squadra'
    when 'settore_giovanile' then 'settore_giovanile'
    when 'entrambi'          then 'entrambi'
    else null
  end;

  v_c_min_seasons := nullif(v_filters #>> '{coach,min_seasons}', '')::int;
  if v_c_min_seasons is not null then
    v_c_min_seasons := greatest(v_c_min_seasons, 0);
  end if;

  select array_agg(elem)
  into v_c_coached_categories
  from jsonb_array_elements_text(coalesce(v_filters #> '{coach,coached_categories}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  select array_agg(elem)
  into v_c_provinces
  from jsonb_array_elements_text(coalesce(v_filters #> '{coach,provinces}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  v_c_open_to_new_role := (v_filters #>> '{coach,open_to_new_role}')::boolean;

  select array_agg(elem)
  into v_c_backgrounds
  from jsonb_array_elements_text(coalesce(v_filters #> '{coach,backgrounds}', '[]'::jsonb)) as elem
  where elem in ('ex_calciatore', 'preparatore_atletico', 'collaboratore_tecnico', 'osservatore');

  -- staff.*
  select array_agg(elem)
  into v_s_roles
  from jsonb_array_elements_text(coalesce(v_filters #> '{staff,staff_roles}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  v_s_has_certifications := (v_filters #>> '{staff,has_certifications}')::boolean;

  select array_agg(elem)
  into v_s_certifications
  from jsonb_array_elements_text(coalesce(v_filters #> '{staff,certifications}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  select array_agg(elem)
  into v_s_categories
  from jsonb_array_elements_text(coalesce(v_filters #> '{staff,categories}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  v_s_scope := case trim(coalesce(v_filters #>> '{staff,scope}', ''))
    when 'prima_squadra'     then 'prima_squadra'
    when 'settore_giovanile' then 'settore_giovanile'
    when 'entrambi'          then 'entrambi'
    else null
  end;

  select array_agg(elem)
  into v_s_provinces
  from jsonb_array_elements_text(coalesce(v_filters #> '{staff,provinces}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  v_s_open_to_work := (v_filters #>> '{staff,open_to_work}')::boolean;

  -- agent.*
  select array_agg(elem)
  into v_a_operating_areas
  from jsonb_array_elements_text(coalesce(v_filters #> '{agent,operating_areas}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  select array_agg(elem)
  into v_a_player_types
  from jsonb_array_elements_text(coalesce(v_filters #> '{agent,player_types}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  select array_agg(elem)
  into v_a_managed_bands
  from jsonb_array_elements_text(coalesce(v_filters #> '{agent,managed_bands}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  v_a_min_years := nullif(v_filters #>> '{agent,min_years}', '')::int;
  if v_a_min_years is not null then
    v_a_min_years := greatest(v_a_min_years, 0);
  end if;

  v_a_is_federation_licensed := (v_filters #>> '{agent,is_federation_licensed}')::boolean;
  v_a_open_to_players := (v_filters #>> '{agent,open_to_players}')::boolean;

  select p.region into v_viewer_region
  from public.profiles p
  where p.id = v_uid;

  return query
  select
    pwa.id                as profile_id,
    pwa.full_name,
    pwa.avatar_url,
    pwa.role,
    pwa.region,
    pwa.city,
    pp.primary_position,
    cm_club.name          as current_club_name,
    cm_team.name          as current_team_name,
    pwa.age,
    pwa.is_available,
    (case when pwa.birth_date is not null then extract(year from pwa.birth_date)::int else null end) as birth_year,
    pwa.is_open_to_transfer,
    coalesce(cm_team.category, cm_club.category) as current_category,
    cp.primary_role       as coach_primary_role,
    (case
      when 'UEFA Pro'       = any(coalesce(cp.licenses, '{}'::text[])) then 'UEFA Pro'
      when 'UEFA A'         = any(coalesce(cp.licenses, '{}'::text[])) then 'UEFA A'
      when 'UEFA B'         = any(coalesce(cp.licenses, '{}'::text[])) then 'UEFA B'
      when 'UEFA C'         = any(coalesce(cp.licenses, '{}'::text[])) then 'UEFA C'
      when 'Patentino base' = any(coalesce(cp.licenses, '{}'::text[])) then 'Patentino base'
      else null
    end)                  as coach_top_license,
    coach_ctx.value       as coach_context,
    cp.open_to_new_role,
    sp.primary_staff_role as staff_primary_role,
    sp.experience_summary,
    sp.open_to_work,
    ap.agency_name,
    ap.managed_players_count,
    coalesce(nullif(ap.operating_macro_areas, '{}'::text[]), ap.operating_regions) as agent_operating_areas,
    ap.open_to_players,
    (case when agent_start.min_start_year is not null then v_current_year - agent_start.min_start_year else null end) as years_experience,
    count(*) over () as total_count
  from public.profiles_with_age pwa
  left join public.player_profiles pp on pp.profile_id = pwa.id
  left join public.coach_profiles  cp on cp.profile_id = pwa.id
  left join public.staff_profiles  sp on sp.profile_id = pwa.id
  left join public.agent_profiles  ap on ap.profile_id = pwa.id
  left join lateral (
    select cm.club_id, cm.team_id
    from public.club_members cm
    where cm.profile_id = pwa.id
      and cm.status     = 'active'
      and cm.is_current = true
    order by cm.created_at desc
    limit 1
  ) cm on true
  left join public.clubs      cm_club on cm_club.id = cm.club_id
  left join public.club_teams cm_team on cm_team.id = cm.team_id
  -- coach_context: derived from coached_categories vs. the youth-set above.
  left join lateral (
    select case
      when 'Prima Squadra' = any(coalesce(cp.coached_categories, '{}'::text[]))
       and coalesce(cp.coached_categories, '{}'::text[]) && v_youth_categories
        then 'entrambi'
      when 'Prima Squadra' = any(coalesce(cp.coached_categories, '{}'::text[]))
        then 'prima_squadra'
      when coalesce(cp.coached_categories, '{}'::text[]) && v_youth_categories
        then 'settore_giovanile'
      else null
    end as value
  ) coach_ctx on true
  -- min_seasons proxy: distinct seasons[] labels + years covered by
  -- period_start_year..coalesce(period_end_year, current year) for entries
  -- that only recorded a period range. Best-effort, documented in the
  -- header comment above; sparse/legacy data can under-count.
  left join lateral (
    select count(distinct season_key) as season_count
    from (
      select unnest(cce.seasons) as season_key
      from public.coach_career_entries cce
      where cce.coach_profile_id = pwa.id
        and coalesce(array_length(cce.seasons, 1), 0) > 0
      union all
      select gs::text as season_key
      from public.coach_career_entries cce2
      cross join lateral generate_series(
        cce2.period_start_year,
        coalesce(cce2.period_end_year, v_current_year)
      ) as gs
      where cce2.coach_profile_id = pwa.id
        and coalesce(array_length(cce2.seasons, 1), 0) = 0
        and cce2.period_start_year is not null
    ) all_seasons
  ) coach_seasons on true
  -- staff scope: prefer the reliable club_teams.team_type discriminator of
  -- the current team when tesserato; otherwise fall back to the same
  -- youth-set heuristic applied to preferred_categories.
  left join lateral (
    select case
      when cm_team.team_type = 'senior' then 'prima_squadra'
      when cm_team.team_type = 'youth'  then 'settore_giovanile'
      when 'Prima Squadra' = any(coalesce(sp.preferred_categories, '{}'::text[]))
       and coalesce(sp.preferred_categories, '{}'::text[]) && v_youth_categories
        then 'entrambi'
      when 'Prima Squadra' = any(coalesce(sp.preferred_categories, '{}'::text[]))
        then 'prima_squadra'
      when coalesce(sp.preferred_categories, '{}'::text[]) && v_youth_categories
        then 'settore_giovanile'
      else null
    end as value
  ) staff_scope on true
  -- agent years_experience proxy: current year minus the earliest known
  -- start year across the agent_profiles row and agent_career_entries.
  left join lateral (
    select least(
      ap.period_start_year,
      (
        select min(ace.period_start_year)
        from public.agent_career_entries ace
        where ace.agent_profile_id = pwa.id
      )
    ) as min_start_year
  ) agent_start on true
  where pwa.role in ('player', 'coach', 'staff', 'agent')
    and (p_role is null or pwa.role = p_role)
    and (v_term = '' or pwa.full_name ilike '%' || v_term || '%')

    -- shared
    and (v_region is null or pwa.region = v_region)
    and (v_is_available is null or pwa.is_available = v_is_available)

    -- player
    and (
      p_role is distinct from 'player' or v_p_positions is null
      or pp.primary_position = any(v_p_positions)
      or pp.secondary_positions && v_p_positions
    )
    and (
      p_role is distinct from 'player'
      or (v_p_classe_min is null and v_p_classe_max is null)
      or (
        extract(year from pwa.birth_date)::int >= coalesce(v_p_classe_min, 1940)
        and extract(year from pwa.birth_date)::int <= coalesce(v_p_classe_max, v_current_year)
      )
    )
    and (
      p_role is distinct from 'player' or v_p_situation is null
      or (v_p_situation = 'svincolato'  and cm.club_id is null)
      or (v_p_situation = 'tesserato'   and cm.club_id is not null)
      or (v_p_situation = 'disponibile' and (pwa.is_open_to_transfer or pp.willing_to_change_club))
      or (
        v_p_situation = 'in_scadenza'
        and pp.contract_expiry is not null
        and pp.contract_expiry <= (current_date + interval '6 months')::date
      )
    )
    and (
      p_role is distinct from 'player' or v_p_categories is null
      or coalesce(cm_team.category, cm_club.category) = any(v_p_categories)
    )
    and (
      p_role is distinct from 'player' or v_p_provinces is null
      or pp.transfer_provinces && v_p_provinces
    )
    and (
      p_role is distinct from 'player' or v_p_transfer_areas is null
      or pp.availability_type = 'ITALY'
      or pp.transfer_regions && v_p_transfer_areas
    )
    and (
      p_role is distinct from 'player' or v_p_is_open_to_transfer is null
      or pwa.is_open_to_transfer = v_p_is_open_to_transfer
    )
    and (
      p_role is distinct from 'player' or v_p_preferred_foot is null
      or pp.preferred_foot = v_p_preferred_foot
    )
    and (
      p_role is distinct from 'player'
      or (v_p_height_min is null and v_p_height_max is null)
      or (
        pp.height_cm is not null
        and pp.height_cm >= coalesce(v_p_height_min, 100)
        and pp.height_cm <= coalesce(v_p_height_max, 230)
      )
    )
    and (
      p_role is distinct from 'player' or coalesce(v_p_has_video, false) = false
      or (
        nullif(pp.highlight_video_url, '') is not null
        or coalesce(array_length(pp.media_urls, 1), 0) > 0
        or coalesce(jsonb_array_length(pp.media_items), 0) > 0
      )
    )

    -- coach
    and (
      p_role is distinct from 'coach' or v_c_role is null
      or cp.primary_role = v_c_role
    )
    and (
      p_role is distinct from 'coach' or v_c_licenses is null
      or cp.licenses && v_c_licenses
    )
    and (
      p_role is distinct from 'coach' or v_c_context is null
      or coach_ctx.value = v_c_context
    )
    and (
      p_role is distinct from 'coach' or v_c_min_seasons is null
      or coalesce(coach_seasons.season_count, 0) >= v_c_min_seasons
    )
    and (
      p_role is distinct from 'coach' or v_c_coached_categories is null
      or cp.coached_categories && v_c_coached_categories
    )
    and (
      p_role is distinct from 'coach' or v_c_provinces is null
      or cp.preferred_provinces && v_c_provinces
    )
    and (
      p_role is distinct from 'coach' or v_c_open_to_new_role is null
      or cp.open_to_new_role = v_c_open_to_new_role
    )
    and (
      p_role is distinct from 'coach' or v_c_backgrounds is null
      or (
        (
          not ('ex_calciatore' = any(v_c_backgrounds))
          or exists (
            select 1 from public.coach_player_career_entries cpce
            where cpce.coach_profile_id = pwa.id
          )
        )
        and (
          not ('preparatore_atletico' = any(v_c_backgrounds))
          or exists (
            select 1 from public.coach_career_entries cce
            where cce.coach_profile_id = pwa.id and cce.role ilike '%preparatore atletico%'
            union all
            select 1 from public.coach_director_career_entries cde
            where cde.coach_profile_id = pwa.id and cde.role ilike '%preparatore atletico%'
          )
        )
        and (
          not ('collaboratore_tecnico' = any(v_c_backgrounds))
          or exists (
            select 1 from public.coach_career_entries cce
            where cce.coach_profile_id = pwa.id and cce.role ilike '%collaboratore tecnico%'
            union all
            select 1 from public.coach_director_career_entries cde
            where cde.coach_profile_id = pwa.id and cde.role ilike '%collaboratore tecnico%'
          )
        )
        and (
          not ('osservatore' = any(v_c_backgrounds))
          or exists (
            select 1 from public.coach_career_entries cce
            where cce.coach_profile_id = pwa.id and cce.role ilike '%osservatore%'
            union all
            select 1 from public.coach_director_career_entries cde
            where cde.coach_profile_id = pwa.id and cde.role ilike '%osservatore%'
          )
        )
      )
    )

    -- staff
    and (
      p_role is distinct from 'staff' or v_s_roles is null
      or sp.primary_staff_role = any(v_s_roles)
      or sp.staff_roles && v_s_roles
    )
    and (
      p_role is distinct from 'staff' or v_s_has_certifications is null
      or (coalesce(array_length(sp.certifications, 1), 0) > 0) = v_s_has_certifications
    )
    and (
      p_role is distinct from 'staff' or v_s_certifications is null
      or sp.certifications && v_s_certifications
    )
    and (
      p_role is distinct from 'staff' or v_s_categories is null
      or sp.preferred_categories && v_s_categories
    )
    and (
      p_role is distinct from 'staff' or v_s_scope is null
      or staff_scope.value = v_s_scope
    )
    and (
      p_role is distinct from 'staff' or v_s_provinces is null
      or sp.preferred_provinces && v_s_provinces
    )
    and (
      p_role is distinct from 'staff' or v_s_open_to_work is null
      or sp.open_to_work = v_s_open_to_work
    )

    -- agent
    and (
      p_role is distinct from 'agent' or v_a_operating_areas is null
      or ap.operating_regions && v_a_operating_areas
      or ap.operating_macro_areas && v_a_operating_areas
    )
    and (
      p_role is distinct from 'agent' or v_a_player_types is null
      or ap.player_types && v_a_player_types
      or 'Entrambi' = any(ap.player_types)
    )
    and (
      p_role is distinct from 'agent' or v_a_managed_bands is null
      or ap.managed_players_count = any(v_a_managed_bands)
    )
    and (
      p_role is distinct from 'agent' or v_a_min_years is null
      or (
        agent_start.min_start_year is not null
        and (v_current_year - agent_start.min_start_year) >= v_a_min_years
      )
    )
    and (
      p_role is distinct from 'agent' or v_a_is_federation_licensed is null
      or ap.is_federation_licensed = v_a_is_federation_licensed
    )
    and (
      p_role is distinct from 'agent' or v_a_open_to_players is null
      or ap.open_to_players = v_a_open_to_players
    )
  order by
    (case when v_sort = 'vicini' and v_viewer_region is not null and pwa.region = v_viewer_region then 0 else 1 end) asc,
    (case when v_sort in ('relevance', 'vicini') and v_term <> '' then similarity(lower(pwa.full_name), lower(v_term)) else 0 end) desc,
    (case when v_sort = 'recent' then pwa.updated_at end) desc nulls last,
    (case when v_sort = 'classe_asc' then pwa.birth_date end) asc nulls last,
    (case when v_sort = 'classe_desc' then pwa.birth_date end) desc nulls last,
    pwa.full_name asc,
    pwa.id asc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.search_profiles_page(text, public.app_role, int, int, jsonb, text) from public;
grant execute on function public.search_profiles_page(text, public.app_role, int, int, jsonb, text) to authenticated;
