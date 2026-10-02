-- Migration: REV-PROF-15 — Gestione carriera Procuratore.
--
-- La carriera del Procuratore non è una sequenza di stagioni: ogni riga è un
-- incarico professionale con un periodo mese/anno, un'organizzazione (canonica
-- o inserita a mano) oppure nessuna organizzazione affatto. `agent_career_entries`
-- esiste dalla 20260410090000 e la 20261002120000 le ha già dato `is_current`,
-- `is_primary` e `organization_mode`: qui arrivano i campi che mancavano per
-- gestirla davvero — l'organizzazione canonica, il riferimento manuale, la
-- località, la descrizione e la precisione temporale dei dati legacy.
--
-- Quattro interventi, tutti non distruttivi e idempotenti:
--
--  1. le colonne dell'incarico professionale, con il backfill della precisione
--     temporale e degli identificativi di raggruppamento;
--  2. `agent_profiles` acquisisce le tre corsie `jsonb` dei percorsi aggiuntivi
--     (il percorso da calciatore ha già la sua) e la data di migrazione della
--     carriera, che spegne il fallback sulle colonne legacy;
--  3. le RPC di scrittura: salvataggio, conclusione ed eliminazione di un
--     incarico, con l'unicità dell'esperienza principale garantita dal
--     database e non dall'ordine delle richieste;
--  4. `save_agent_profile_details` smette di cancellare e riscrivere l'intera
--     carriera: riconcilia per id e, quando il chiamante non la possiede,
--     non la tocca affatto.
--
-- Convenzioni riprese da:
--   20260410090000_agent_career_portfolio.sql      (tabella, RLS, RPC)
--   20260926120000_agent_procurator_onboarding.sql (corpo corrente della RPC)
--   20261002120000_agent_master_profile.sql        (colonne canoniche, trigger)


-- ============================================================
-- SECTION 1: l'incarico professionale
-- ============================================================

alter table public.agent_career_entries
  -- L'organizzazione canonica già presente su PROLINK. `on delete set null`
  -- perché la cancellazione di una pagina non deve portarsi via la carriera di
  -- chi ci ha lavorato: resta lo snapshot del nome.
  add column if not exists organization_club_id uuid
    references public.clubs(id) on delete set null,
  -- Riferimento privato a un'organizzazione non presente su PROLINK. Non è una
  -- pagina, non è un account, non dà permessi: serve solo a raggruppare gli
  -- incarichi svolti nello stesso posto.
  add column if not exists manual_organization_id uuid,
  add column if not exists organization_city text,
  add column if not exists organization_country text,
  add column if not exists description text,
  -- 'month' oppure 'year': i dati legacy dell'onboarding hanno solo l'anno e
  -- un mese non si inventa. Finché l'utente non modifica quel periodo, a
  -- schermo compare soltanto l'anno.
  add column if not exists period_start_precision text not null default 'month',
  add column if not exists period_end_precision text not null default 'month';

alter table public.agent_career_entries
  drop constraint if exists agent_career_entries_start_precision_check;

alter table public.agent_career_entries
  add constraint agent_career_entries_start_precision_check
  check (period_start_precision in ('month', 'year'));

alter table public.agent_career_entries
  drop constraint if exists agent_career_entries_end_precision_check;

alter table public.agent_career_entries
  add constraint agent_career_entries_end_precision_check
  check (period_end_precision in ('month', 'year'));


-- ------------------------------------------------------------
-- 1a. Precisione temporale dei dati già presenti.
-- ------------------------------------------------------------
-- Il default 'month' vale per quanto verrà scritto da qui in avanti; le righe
-- che hanno solo l'anno vengono dichiarate per quello che sono. Nessun mese
-- viene inventato, in nessuna direzione.
update public.agent_career_entries
set period_start_precision = 'year'
where period_start_month is null
  and period_start_year is not null
  and period_start_precision <> 'year';

update public.agent_career_entries
set period_end_precision = 'year'
where period_end_month is null
  and period_end_year is not null
  and period_end_precision <> 'year';


-- ------------------------------------------------------------
-- 1b. Identificativo stabile delle organizzazioni inserite a mano.
-- ------------------------------------------------------------
-- Il raggruppamento avviene per id, mai per somiglianza di nome. Le righe
-- storiche non hanno un id, quindi se ne deriva uno deterministico dal profilo
-- e dal nome normalizzato: due incarichi scritti con lo stesso nome dallo
-- stesso procuratore finiscono nello stesso gruppo, e rieseguire la migrazione
-- produce esattamente lo stesso id. Due agenzie omonime di procuratori diversi
-- restano separate, perché il profilo entra nella chiave.
update public.agent_career_entries
set manual_organization_id =
  (md5(agent_profile_id::text || '|' || lower(btrim(agency_name))))::uuid
where manual_organization_id is null
  and organization_club_id is null
  and organization_mode = 'agency'
  and nullif(btrim(coalesce(agency_name, '')), '') is not null;


-- ------------------------------------------------------------
-- 1c. Una sola esperienza principale, garantita dal database.
-- ------------------------------------------------------------
-- La RPC toglie il flag alla precedente prima di assegnarlo, ma due richieste
-- concorrenti potrebbero incrociarsi: l'indice parziale fa fallire la seconda
-- invece di lasciare due header possibili. Prima si sana l'eventuale residuo
-- storico, tenendo l'incarico più vecchio — quello già scelto dal backfill
-- della 20261002120000.
with ranked as (
  select
    id,
    row_number() over (
      partition by agent_profile_id
      order by created_at asc, id asc
    ) as position
  from public.agent_career_entries
  where is_primary = true
)
update public.agent_career_entries entry
set is_primary = false
from ranked
where ranked.id = entry.id
  and ranked.position > 1;

create unique index if not exists idx_agent_career_entries_single_primary
  on public.agent_career_entries(agent_profile_id)
  where is_primary;

create index if not exists idx_agent_career_entries_organization
  on public.agent_career_entries(agent_profile_id, organization_club_id, manual_organization_id);


-- ============================================================
-- SECTION 2: percorsi aggiuntivi e fine del fallback legacy
-- ============================================================

alter table public.agent_profiles
  -- Le corsie dei percorsi aggiuntivi, nello stesso formato del Dirigente
  -- (20261001*): esperienze separate, mai convertite in incarichi da
  -- procuratore. `player_career_entries` esiste già dalla 20260330123000.
  add column if not exists coach_career_entries jsonb not null default '[]'::jsonb,
  add column if not exists staff_career_entries jsonb not null default '[]'::jsonb,
  add column if not exists director_career_entries jsonb not null default '[]'::jsonb,
  -- Da qui in poi la carriera è la sola fonte dell'incarico attuale.
  --
  -- Finora il Master Profile, davanti a una carriera vuota, ricostruiva
  -- l'agenzia dalle colonne legacy di `agent_profiles`: era la rete di
  -- sicurezza dei profili non ancora migrati. Con la gestione carriera quella
  -- rete diventa un difetto — chi cancella l'ultimo incarico si vedrebbe
  -- ricomparire la vecchia agenzia — quindi il profilo dichiara di essere
  -- passato al modello canonico e il fallback si spegne. Le colonne legacy non
  -- vengono cancellate: restano leggibili per i client della versione
  -- precedente per tutto il rilascio.
  add column if not exists career_migrated_at timestamptz;

update public.agent_profiles
set career_migrated_at = timezone('utc', now())
where career_migrated_at is null;


-- ============================================================
-- SECTION 3: scritture della gestione carriera
-- ============================================================

-- ------------------------------------------------------------
-- 3a. Salvataggio di un incarico (creazione e modifica).
-- ------------------------------------------------------------
-- Una sola funzione per entrambi: è lo stesso record, con o senza id. Qui
-- vivono le tre invarianti che non possono dipendere dal client:
--   * un incarico concluso non è mai l'esperienza principale;
--   * assegnare l'esperienza principale la toglie alla precedente, nella
--     stessa transazione;
--   * un duplicato esatto non entra, mentre una sovrapposizione sì — quella è
--     un avviso dell'interfaccia, non un errore del dato.
create or replace function public.save_agent_career_entry(
  p_profile_id uuid,
  p_entry jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_mode text;
  v_is_current boolean;
  v_is_primary boolean;
  v_club_id uuid;
  v_manual_id uuid;
  v_agency_name text;
  v_role text;
  v_start_month text;
  v_start_year integer;
  v_end_month text;
  v_end_year integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_user(p_profile_id) then
    raise exception 'Profile not accessible';
  end if;

  v_entry_id := nullif(p_entry ->> 'id', '')::uuid;
  v_mode := coalesce(nullif(p_entry ->> 'organization_mode', ''), 'agency');

  if v_mode not in ('agency', 'independent') then
    raise exception 'AGENT_CAREER_INVALID_MODE';
  end if;

  v_role := nullif(btrim(coalesce(p_entry ->> 'role', '')), '');

  if v_role is null then
    raise exception 'AGENT_CAREER_MISSING_ROLE';
  end if;

  v_start_year := nullif(p_entry ->> 'period_start_year', '')::integer;

  if v_start_year is null then
    raise exception 'AGENT_CAREER_MISSING_START';
  end if;

  v_start_month := nullif(p_entry ->> 'period_start_month', '');
  v_is_current := coalesce((p_entry ->> 'is_current')::boolean, false);
  v_end_year := nullif(p_entry ->> 'period_end_year', '')::integer;
  v_end_month := nullif(p_entry ->> 'period_end_month', '');

  -- Un incarico in corso non porta una data di fine, nemmeno rimasta da una
  -- modifica precedente.
  if v_is_current then
    v_end_year := null;
    v_end_month := null;
  elsif v_end_year is null then
    raise exception 'AGENT_CAREER_MISSING_END';
  end if;

  -- Solo un incarico in corso può essere l'esperienza principale.
  v_is_primary := v_is_current
    and coalesce((p_entry ->> 'is_primary')::boolean, false);

  if v_mode = 'independent' then
    -- Un professionista indipendente non ha un'organizzazione: nessun nome
    -- fittizio, nessun logo, nessun riferimento manuale.
    v_club_id := null;
    v_manual_id := null;
    v_agency_name := null;
  else
    v_club_id := nullif(p_entry ->> 'organization_club_id', '')::uuid;
    v_manual_id := nullif(p_entry ->> 'manual_organization_id', '')::uuid;
    v_agency_name := nullif(btrim(coalesce(p_entry ->> 'agency_name', '')), '');

    if v_club_id is null and v_manual_id is null then
      raise exception 'AGENT_CAREER_MISSING_ORGANIZATION';
    end if;

    if v_agency_name is null then
      raise exception 'AGENT_CAREER_MISSING_ORGANIZATION_NAME';
    end if;
  end if;

  -- Duplicato esatto: stesso profilo, stessa modalità, stessa organizzazione,
  -- stesso ruolo, stesso periodo. Per l'attività indipendente il confronto
  -- ignora l'organizzazione, che non c'è.
  if exists (
    select 1
    from public.agent_career_entries e
    where e.agent_profile_id = p_profile_id
      and (v_entry_id is null or e.id <> v_entry_id)
      and e.organization_mode = v_mode
      and e.organization_club_id is not distinct from v_club_id
      and e.manual_organization_id is not distinct from v_manual_id
      and lower(btrim(e.role)) = lower(v_role)
      and e.period_start_year is not distinct from v_start_year
      and e.period_start_month is not distinct from v_start_month
      and e.is_current = v_is_current
      and e.period_end_year is not distinct from v_end_year
      and e.period_end_month is not distinct from v_end_month
  ) then
    raise exception 'AGENT_CAREER_DUPLICATE';
  end if;

  -- Il flag viene tolto alla precedente PRIMA di essere assegnato: l'indice
  -- parziale `idx_agent_career_entries_single_primary` rifiuterebbe comunque
  -- un secondo principale, ma così la transazione normale non ci arriva mai.
  if v_is_primary then
    update public.agent_career_entries
    set is_primary = false,
        updated_at = timezone('utc', now())
    where agent_profile_id = p_profile_id
      and is_primary = true
      and (v_entry_id is null or id <> v_entry_id);
  end if;

  insert into public.agent_career_entries as target (
    id,
    agent_profile_id,
    organization_mode,
    organization_club_id,
    manual_organization_id,
    agency_name,
    agency_logo_url,
    organization_city,
    organization_country,
    role,
    description,
    period_start_month,
    period_start_year,
    period_start_precision,
    period_end_month,
    period_end_year,
    period_end_precision,
    is_current,
    is_primary,
    visibility,
    sort_order
  )
  values (
    coalesce(v_entry_id, gen_random_uuid()),
    p_profile_id,
    v_mode,
    v_club_id,
    v_manual_id,
    v_agency_name,
    nullif(btrim(coalesce(p_entry ->> 'agency_logo_url', '')), ''),
    nullif(btrim(coalesce(p_entry ->> 'organization_city', '')), ''),
    nullif(btrim(coalesce(p_entry ->> 'organization_country', '')), ''),
    v_role,
    nullif(btrim(coalesce(p_entry ->> 'description', '')), ''),
    v_start_month,
    v_start_year,
    case when v_start_month is null then 'year' else 'month' end,
    v_end_month,
    v_end_year,
    case when v_end_month is null then 'year' else 'month' end,
    v_is_current,
    v_is_primary,
    coalesce(nullif(p_entry ->> 'visibility', ''), 'public'),
    coalesce(nullif(p_entry ->> 'sort_order', '')::integer, 0)
  )
  on conflict (id) do update
  set
    organization_mode = excluded.organization_mode,
    organization_club_id = excluded.organization_club_id,
    manual_organization_id = excluded.manual_organization_id,
    agency_name = excluded.agency_name,
    agency_logo_url = excluded.agency_logo_url,
    organization_city = excluded.organization_city,
    organization_country = excluded.organization_country,
    role = excluded.role,
    description = excluded.description,
    period_start_month = excluded.period_start_month,
    period_start_year = excluded.period_start_year,
    period_start_precision = excluded.period_start_precision,
    period_end_month = excluded.period_end_month,
    period_end_year = excluded.period_end_year,
    period_end_precision = excluded.period_end_precision,
    is_current = excluded.is_current,
    is_primary = excluded.is_primary,
    visibility = excluded.visibility,
    updated_at = timezone('utc', now())
  -- Il record appartiene a chi lo modifica: senza questa condizione un id
  -- altrui farebbe passare la riga per `on conflict`.
  where target.agent_profile_id = p_profile_id
  returning id into v_entry_id;

  if v_entry_id is null then
    raise exception 'Profile not accessible';
  end if;

  return v_entry_id;
end;
$$;

revoke all on function public.save_agent_career_entry(uuid, jsonb) from public;
grant execute on function public.save_agent_career_entry(uuid, jsonb) to authenticated;


-- ------------------------------------------------------------
-- 3b. Conclusione di un incarico.
-- ------------------------------------------------------------
-- Non è una modifica qualunque: chiude il periodo, spegne lo stato in corso e
-- toglie l'esperienza principale, perché un incarico concluso non può restare
-- la situazione attuale. Chi diventa principale al suo posto lo decide la
-- regola di fallback, non una colonna indovinata qui.
create or replace function public.end_agent_career_entry(
  p_profile_id uuid,
  p_entry_id uuid,
  p_end_month text,
  p_end_year integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_user(p_profile_id) then
    raise exception 'Profile not accessible';
  end if;

  if p_end_year is null then
    raise exception 'AGENT_CAREER_MISSING_END';
  end if;

  update public.agent_career_entries
  set period_end_month = nullif(btrim(coalesce(p_end_month, '')), ''),
      period_end_year = p_end_year,
      period_end_precision =
        case
          when nullif(btrim(coalesce(p_end_month, '')), '') is null then 'year'
          else 'month'
        end,
      is_current = false,
      is_primary = false,
      updated_at = timezone('utc', now())
  where id = p_entry_id
    and agent_profile_id = p_profile_id;

  if not found then
    raise exception 'AGENT_CAREER_ENTRY_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.end_agent_career_entry(uuid, uuid, text, integer) from public;
grant execute on function public.end_agent_career_entry(uuid, uuid, text, integer) to authenticated;


-- ------------------------------------------------------------
-- 3c. Eliminazione di un incarico.
-- ------------------------------------------------------------
-- La RLS basterebbe; la funzione esiste per avere un errore esplicito quando
-- la riga non c'è più — un retry non deve passare per un successo silenzioso.
create or replace function public.delete_agent_career_entry(
  p_profile_id uuid,
  p_entry_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_user(p_profile_id) then
    raise exception 'Profile not accessible';
  end if;

  delete from public.agent_career_entries
  where id = p_entry_id
    and agent_profile_id = p_profile_id;

  if not found then
    raise exception 'AGENT_CAREER_ENTRY_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.delete_agent_career_entry(uuid, uuid) from public;
grant execute on function public.delete_agent_career_entry(uuid, uuid) to authenticated;


-- ============================================================
-- SECTION 4: `save_agent_profile_details` non possiede più la carriera
-- ============================================================
-- Il corpo è quello della 20260926120000, con due sole differenze, entrambe
-- nel blocco della carriera:
--
--   * `p_career_entries` null significa "non è affar mio": la carriera resta
--     dov'è. È il caso dell'editor di profilo, che da REV-PROF-15 non gestisce
--     più le esperienze — prima avrebbe cancellato tutto quello che la
--     gestione carriera aveva scritto;
--   * quando le esperienze arrivano davvero — l'onboarding — vengono
--     riconciliate per id invece di essere cancellate e reinserite, e il
--     payload porta anche le colonne canoniche. Un delete+insert avrebbe
--     cambiato gli id a ogni salvataggio, rompendo i riferimenti e facendo
--     ripartire da zero `created_at`.
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

  if p_career_entries is not null then
    -- L'indice parziale ammette una sola riga principale per procuratore e
    -- viene verificato riga per riga durante l'insert: se il payload sposta il
    -- flag da un incarico a un altro, l'ordine di inserimento deciderebbe se
    -- la scrittura passa o fallisce. Azzerarlo prima toglie di mezzo la
    -- questione — la riga giusta lo riprende qualche istruzione più sotto.
    update public.agent_career_entries
    set is_primary = false
    where agent_profile_id = p_profile_id
      and is_primary = true;

    delete from public.agent_career_entries e
    where e.agent_profile_id = p_profile_id
      and not exists (
        select 1
        from jsonb_to_recordset(p_career_entries) as payload(id uuid)
        where payload.id = e.id
      );

    insert into public.agent_career_entries as target (
      id,
      agent_profile_id,
      organization_mode,
      organization_club_id,
      manual_organization_id,
      agency_name,
      agency_logo_url,
      organization_city,
      organization_country,
      role,
      description,
      period_start_month,
      period_start_year,
      period_start_precision,
      period_end_month,
      period_end_year,
      period_end_precision,
      is_current,
      is_primary,
      sort_order
    )
    select
      coalesce(entry.id, gen_random_uuid()),
      p_profile_id,
      coalesce(nullif(entry.organization_mode, ''), 'agency'),
      entry.organization_club_id,
      entry.manual_organization_id,
      nullif(btrim(coalesce(entry.agency_name, '')), ''),
      entry.agency_logo_url,
      nullif(btrim(coalesce(entry.organization_city, '')), ''),
      nullif(btrim(coalesce(entry.organization_country, '')), ''),
      coalesce(nullif(btrim(coalesce(entry.role, '')), ''), 'Procuratore'),
      nullif(btrim(coalesce(entry.description, '')), ''),
      entry.period_start_month,
      entry.period_start_year,
      -- Un client che non dichiara la precisione non sta nascondendo un mese:
      -- se il mese non c'è, il dato è annuale.
      coalesce(
        nullif(entry.period_start_precision, ''),
        case when entry.period_start_month is null then 'year' else 'month' end
      ),
      entry.period_end_month,
      entry.period_end_year,
      coalesce(
        nullif(entry.period_end_precision, ''),
        case when entry.period_end_month is null then 'year' else 'month' end
      ),
      coalesce(
        entry.is_current,
        entry.period_end_year is null and entry.period_end_month is null
      ),
      coalesce(entry.is_primary, false),
      coalesce(entry.sort_order, 0)
    from jsonb_to_recordset(p_career_entries) as entry(
      id uuid,
      organization_mode text,
      organization_club_id uuid,
      manual_organization_id uuid,
      agency_name text,
      agency_logo_url text,
      organization_city text,
      organization_country text,
      role text,
      description text,
      period_start_month text,
      period_start_year integer,
      period_start_precision text,
      period_end_month text,
      period_end_year integer,
      period_end_precision text,
      is_current boolean,
      is_primary boolean,
      sort_order integer
    )
    on conflict (id) do update
    set
      organization_mode = excluded.organization_mode,
      organization_club_id = excluded.organization_club_id,
      manual_organization_id = excluded.manual_organization_id,
      agency_name = excluded.agency_name,
      agency_logo_url = excluded.agency_logo_url,
      organization_city = excluded.organization_city,
      organization_country = excluded.organization_country,
      role = excluded.role,
      description = excluded.description,
      period_start_month = excluded.period_start_month,
      period_start_year = excluded.period_start_year,
      period_start_precision = excluded.period_start_precision,
      period_end_month = excluded.period_end_month,
      period_end_year = excluded.period_end_year,
      period_end_precision = excluded.period_end_precision,
      is_current = excluded.is_current,
      is_primary = excluded.is_primary,
      sort_order = excluded.sort_order,
      updated_at = timezone('utc', now())
    where target.agent_profile_id = p_profile_id;
  end if;

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
