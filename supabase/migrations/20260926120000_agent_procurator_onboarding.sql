-- REV-ONB-06 — Onboarding Procuratore.
--
-- Il profilo prima chiamato "Agente" diventa "Procuratore" in superficie:
-- l'enum `app_role` resta `agent` e nessuna identity viene duplicata (§B).
-- Qui si aggiungono soltanto i dati che il nuovo flusso raccoglie, senza
-- toccare né svuotare le colonne del vecchio onboarding (§BQ, §BR).

alter table public.agent_profiles
  -- §H: "independent" | "agency". Null per i profili legacy non ancora rivisti.
  add column if not exists professional_mode text,
  -- §P: numero di licenza, facoltativo anche quando l'abilitazione è attiva.
  add column if not exists license_number text,
  -- §S: fascia dichiarata del portfolio, distinta dai calciatori collegati (§U).
  add column if not exists portfolio_range text,
  -- §Y: ambiti operativi come tassonomia chiusa, non frasi libere.
  add column if not exists activity_scopes text[] not null default '{}'::text[],
  -- §AA: "ITALY" | "REGIONS" | "PROVINCES", una modalità alla volta.
  add column if not exists operating_area_type text,
  add column if not exists operating_provinces text[] not null default '{}'::text[],
  -- §AF: operatività estera e paesi, indipendenti dalle aree italiane.
  add column if not exists works_abroad boolean not null default false,
  add column if not exists operating_countries text[] not null default '{}'::text[],
  -- §AJ: ruoli precedenti nel calcio come token, non come etichette libere.
  add column if not exists previous_roles text[] not null default '{}'::text[],
  add column if not exists has_no_previous_experience boolean not null default false;

alter table public.agent_profiles
  drop constraint if exists agent_profiles_professional_mode_check;
alter table public.agent_profiles
  add constraint agent_profiles_professional_mode_check
  check (professional_mode is null or professional_mode in ('independent', 'agency'));

alter table public.agent_profiles
  drop constraint if exists agent_profiles_portfolio_range_check;
alter table public.agent_profiles
  add constraint agent_profiles_portfolio_range_check
  check (
    portfolio_range is null
    or portfolio_range in ('none', '1_5', '6_15', '16_30', '30_plus')
  );

alter table public.agent_profiles
  drop constraint if exists agent_profiles_operating_area_type_check;
alter table public.agent_profiles
  add constraint agent_profiles_operating_area_type_check
  check (
    operating_area_type is null
    or operating_area_type in ('ITALY', 'REGIONS', 'PROVINCES')
  );

-- §BQ: i profili già salvati non ripartono da zero. Chi aveva un'agenzia
-- resta "agency", chi non ne aveva mai indicata una è indipendente; i ruoli
-- precedenti si ricavano dal flag legacy "ho giocato a calcio".
update public.agent_profiles
set professional_mode = case
  when nullif(trim(coalesce(agency_name, '')), '') is not null then 'agency'
  else 'independent'
end
where professional_mode is null;

update public.agent_profiles
set previous_roles = array['player']
where has_played_football
  and previous_roles = '{}'::text[];

-- §AE: le macro aree non sono più un modo di scegliere, ma i dati restano
-- dove sono. Le regioni già salvate come entity continuano a valere: se ce
-- ne sono, la modalità operativa è "una o più regioni".
update public.agent_profiles
set operating_area_type = case
  when array_length(operating_regions, 1) > 0 then 'REGIONS'
  else null
end
where operating_area_type is null;

create or replace function public.save_agent_profile_details(
  p_profile_id uuid,
  p_agent_profile jsonb default '{}'::jsonb,
  p_career_entries jsonb default '[]'::jsonb,
  p_managed_player_entries jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
begin
  if current_profile_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_user(p_profile_id) then
    raise exception 'Profile not accessible';
  end if;

  insert into public.agent_profiles (
    profile_id,
    agency_name,
    agency_logo_url,
    agency_role,
    managed_players_count,
    has_other_football_experience,
    other_football_roles,
    has_played_football,
    player_career_entries,
    player_types,
    main_player_roles,
    open_to_clubs,
    open_to_players,
    is_federation_licensed,
    federation,
    license_number,
    period_start_month,
    period_start_year,
    period_end_month,
    period_end_year,
    operational_focuses,
    operational_note,
    operating_macro_areas,
    operating_regions,
    operating_provinces,
    operating_area_type,
    operating_countries,
    works_abroad,
    activity_scopes,
    portfolio_range,
    professional_mode,
    previous_roles,
    has_no_previous_experience
  )
  select
    p_profile_id,
    payload.agency_name,
    payload.agency_logo_url,
    payload.agency_role,
    payload.managed_players_count,
    coalesce(payload.has_other_football_experience, false),
    coalesce(payload.other_football_roles, '{}'::text[]),
    coalesce(payload.has_played_football, false),
    coalesce(payload.player_career_entries, '[]'::jsonb),
    coalesce(payload.player_types, '{}'::text[]),
    coalesce(payload.main_player_roles, '{}'::public.player_position[]),
    coalesce(payload.open_to_clubs, true),
    coalesce(payload.open_to_players, true),
    coalesce(payload.is_federation_licensed, false),
    payload.federation,
    payload.license_number,
    payload.period_start_month,
    payload.period_start_year,
    payload.period_end_month,
    payload.period_end_year,
    coalesce(payload.operational_focuses, '{}'::text[]),
    payload.operational_note,
    coalesce(payload.operating_macro_areas, '{}'::text[]),
    coalesce(payload.operating_regions, '{}'::text[]),
    coalesce(payload.operating_provinces, '{}'::text[]),
    payload.operating_area_type,
    coalesce(payload.operating_countries, '{}'::text[]),
    coalesce(payload.works_abroad, false),
    coalesce(payload.activity_scopes, '{}'::text[]),
    payload.portfolio_range,
    payload.professional_mode,
    coalesce(payload.previous_roles, '{}'::text[]),
    coalesce(payload.has_no_previous_experience, false)
  from jsonb_to_record(coalesce(p_agent_profile, '{}'::jsonb)) as payload(
    agency_name text,
    agency_logo_url text,
    agency_role text,
    managed_players_count text,
    has_other_football_experience boolean,
    other_football_roles text[],
    has_played_football boolean,
    player_career_entries jsonb,
    player_types text[],
    main_player_roles public.player_position[],
    open_to_clubs boolean,
    open_to_players boolean,
    is_federation_licensed boolean,
    federation text,
    license_number text,
    period_start_month text,
    period_start_year integer,
    period_end_month text,
    period_end_year integer,
    operational_focuses text[],
    operational_note text,
    operating_macro_areas text[],
    operating_regions text[],
    operating_provinces text[],
    operating_area_type text,
    operating_countries text[],
    works_abroad boolean,
    activity_scopes text[],
    portfolio_range text,
    professional_mode text,
    previous_roles text[],
    has_no_previous_experience boolean
  )
  on conflict (profile_id) do update
  set
    agency_name = excluded.agency_name,
    agency_logo_url = excluded.agency_logo_url,
    agency_role = excluded.agency_role,
    managed_players_count = excluded.managed_players_count,
    has_other_football_experience = excluded.has_other_football_experience,
    other_football_roles = excluded.other_football_roles,
    has_played_football = excluded.has_played_football,
    player_career_entries = excluded.player_career_entries,
    player_types = excluded.player_types,
    main_player_roles = excluded.main_player_roles,
    open_to_clubs = excluded.open_to_clubs,
    open_to_players = excluded.open_to_players,
    is_federation_licensed = excluded.is_federation_licensed,
    federation = excluded.federation,
    license_number = excluded.license_number,
    period_start_month = excluded.period_start_month,
    period_start_year = excluded.period_start_year,
    period_end_month = excluded.period_end_month,
    period_end_year = excluded.period_end_year,
    -- §Z, §AE, §AH: focus, macro aree e nota operativa non sono più chiesti
    -- dall'onboarding. Si conserva quanto c'è già invece di sovrascriverlo
    -- con il vuoto che arriva dal client.
    operational_focuses = coalesce(
      nullif(excluded.operational_focuses, '{}'::text[]),
      agent_profiles.operational_focuses
    ),
    operational_note = coalesce(
      excluded.operational_note,
      agent_profiles.operational_note
    ),
    operating_macro_areas = coalesce(
      nullif(excluded.operating_macro_areas, '{}'::text[]),
      agent_profiles.operating_macro_areas
    ),
    operating_regions = excluded.operating_regions,
    operating_provinces = excluded.operating_provinces,
    operating_area_type = excluded.operating_area_type,
    operating_countries = excluded.operating_countries,
    works_abroad = excluded.works_abroad,
    activity_scopes = excluded.activity_scopes,
    portfolio_range = excluded.portfolio_range,
    professional_mode = excluded.professional_mode,
    previous_roles = excluded.previous_roles,
    has_no_previous_experience = excluded.has_no_previous_experience,
    updated_at = timezone('utc', now());

  delete from public.agent_career_entries
  where agent_profile_id = p_profile_id;

  insert into public.agent_career_entries (
    id,
    agent_profile_id,
    agency_name,
    agency_logo_url,
    role,
    period_start_month,
    period_start_year,
    period_end_month,
    period_end_year,
    sort_order
  )
  select
    coalesce(entry.id, gen_random_uuid()),
    p_profile_id,
    coalesce(entry.agency_name, ''),
    entry.agency_logo_url,
    coalesce(entry.role, ''),
    entry.period_start_month,
    entry.period_start_year,
    entry.period_end_month,
    entry.period_end_year,
    coalesce(entry.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_career_entries, '[]'::jsonb)) as entry(
    id uuid,
    agency_name text,
    agency_logo_url text,
    role text,
    period_start_month text,
    period_start_year integer,
    period_end_month text,
    period_end_year integer,
    sort_order integer
  );

  /**
   * §BR: il portfolio viene riscritto per intero, comprese le voci manuali
   * del vecchio onboarding. Il client le rilegge dalla bozza e le rimanda
   * indietro, quindi non si perdono; qui non si filtra, altrimenti dal
   * profilo non si potrebbe più cancellare una voce inserita a mano.
   */
  delete from public.agent_managed_player_entries
  where agent_profile_id = p_profile_id;

  insert into public.agent_managed_player_entries (
    id,
    agent_profile_id,
    linked_profile_id,
    display_name,
    avatar_url,
    primary_position,
    birth_year,
    category_label,
    is_free_agent,
    sort_order
  )
  select
    coalesce(entry.id, gen_random_uuid()),
    p_profile_id,
    entry.linked_profile_id,
    coalesce(entry.display_name, ''),
    entry.avatar_url,
    entry.primary_position,
    entry.birth_year,
    entry.category_label,
    coalesce(entry.is_free_agent, false),
    coalesce(entry.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_managed_player_entries, '[]'::jsonb)) as entry(
    id uuid,
    linked_profile_id uuid,
    display_name text,
    avatar_url text,
    primary_position public.player_position,
    birth_year integer,
    category_label text,
    is_free_agent boolean,
    sort_order integer
  );
end;
$$;

revoke all on function public.save_agent_profile_details(uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.save_agent_profile_details(uuid, jsonb, jsonb, jsonb) to authenticated;
