-- REV-PROF-07 — Gestione carriera Staff tecnico: ruolo e categoria per stagione.
--
-- Stesso problema già risolto per l'Allenatore in 20260929170000, sulle tabelle
-- dello Staff: `staff_career_entries` salvava un'esperienza per riga, con
-- `seasons text[]` e un `season_details` jsonb che portava ruolo e categoria di
-- ogni stagione. Le tre stagioni al Milan non erano tre assegnazioni ma tre
-- chiavi dentro un record il cui ruolo viveva comunque nelle colonne del padre.
--
-- Qui la riga diventa l'assegnazione: **una stagione (o un periodo), un ruolo,
-- una categoria**. Le assegnazioni nate da un'unica operazione restano unite da
-- `experience_group_id`, che raggruppa e non vincola: ogni riga resta
-- modificabile ed eliminabile da sola.
--
-- L'id di gruppo è `text` e non `uuid` perché nasce nel client
-- (`staff-<ts>-<n>`) e non deve far fallire l'RPC al primo salvataggio di una
-- bozza di onboarding.
--
-- Le tre tabelle toccate sono:
--   * `staff_career_entries`        — carriera nello staff tecnico;
--   * `staff_coach_career_entries`  — percorso aggiuntivo da allenatore;
--   * `staff_player_career_entries` — percorso aggiuntivo da calciatore, che
--     viene allineato al modello del Calciatore perché la task impone di
--     riusare quel flusso invece di piegare quello dello Staff.
--
-- Migrazione additiva e rieseguibile: nessuna colonna rimossa,
-- `season_details` resta per la lettura, il backfill tocca solo le righe che
-- non hanno ancora il gruppo e l'espansione solo quelle con più di una
-- stagione — alla seconda esecuzione non trova più nulla da fare.

-- ---------------------------------------------------------------------------
-- 1. Identità dell'assegnazione nello staff tecnico
-- ---------------------------------------------------------------------------

alter table public.staff_career_entries
  add column if not exists experience_group_id text;

alter table public.staff_coach_career_entries
  add column if not exists experience_group_id text;

-- Ogni riga storica È già un'esperienza: diventa il gruppo di se stessa, e le
-- stagioni che ne verranno estratte erediteranno questo id.
update public.staff_career_entries
set experience_group_id = gen_random_uuid()::text
where experience_group_id is null;

update public.staff_coach_career_entries
set experience_group_id = gen_random_uuid()::text
where experience_group_id is null;

-- ---------------------------------------------------------------------------
-- 2. Espansione delle esperienze multi-stagione
-- ---------------------------------------------------------------------------
-- Una riga con N stagioni diventa N righe. Ruolo e categoria di ciascuna
-- vengono da `season_details`, finora l'unico posto in cui la variazione
-- stagionale esisteva; dove il dettaglio manca si eredita il valore del padre,
-- che era appunto quello applicato a tutte le stagioni.
--
-- Un periodo personalizzato non si espande: le sue stagioni sono derivate dalle
-- date, non assegnazioni distinte, e duplicarle creerebbe N copie dello stesso
-- incarico.

with expandable as (
  select
    entry.*,
    season.label as season_label,
    season.ordinal as season_ordinal
  from public.staff_career_entries entry
  cross join lateral unnest(entry.seasons)
    with ordinality as season(label, ordinal)
  where coalesce(array_length(entry.seasons, 1), 0) > 1
    and coalesce(entry.experience_type, '') <> 'CUSTOM_PERIOD'
)
insert into public.staff_career_entries (
  id,
  staff_profile_id,
  team_name,
  team_logo_url,
  club_id,
  category,
  role,
  experience_type,
  seasons,
  period_start_month,
  period_start_year,
  period_end_month,
  period_end_year,
  season_details,
  results,
  description,
  head_coach_name,
  sort_order,
  experience_group_id
)
select
  gen_random_uuid(),
  expandable.staff_profile_id,
  expandable.team_name,
  expandable.team_logo_url,
  expandable.club_id,
  coalesce(
    nullif(trim(expandable.season_details -> expandable.season_label ->> 'category'), ''),
    expandable.category
  ),
  coalesce(
    nullif(trim(expandable.season_details -> expandable.season_label ->> 'role'), ''),
    expandable.role
  ),
  expandable.experience_type,
  array[expandable.season_label],
  expandable.period_start_month,
  expandable.period_start_year,
  expandable.period_end_month,
  expandable.period_end_year,
  '{}'::jsonb,
  -- I risultati agganciati a una stagione seguono la loro; quelli senza
  -- stagione restano sulla riga capofila, per non duplicarli N volte.
  coalesce(
    (
      select jsonb_agg(result)
      from jsonb_array_elements(coalesce(expandable.results, '[]'::jsonb)) as result
      where result ->> 'seasonLabel' = expandable.season_label
    ),
    '[]'::jsonb
  ),
  expandable.description,
  expandable.head_coach_name,
  expandable.sort_order,
  expandable.experience_group_id
from expandable
where expandable.season_ordinal > 1;

update public.staff_career_entries entry
set
  category = coalesce(
    nullif(trim(entry.season_details -> entry.seasons[1] ->> 'category'), ''),
    entry.category
  ),
  role = coalesce(
    nullif(trim(entry.season_details -> entry.seasons[1] ->> 'role'), ''),
    entry.role
  ),
  results = coalesce(
    (
      select jsonb_agg(result)
      from jsonb_array_elements(coalesce(entry.results, '[]'::jsonb)) as result
      where result ->> 'seasonLabel' is null
         or result ->> 'seasonLabel' = entry.seasons[1]
    ),
    '[]'::jsonb
  ),
  seasons = array[entry.seasons[1]],
  season_details = '{}'::jsonb
where coalesce(array_length(entry.seasons, 1), 0) > 1
  and coalesce(entry.experience_type, '') <> 'CUSTOM_PERIOD';

-- Stessa espansione sul percorso aggiuntivo da allenatore.
with expandable as (
  select
    entry.*,
    season.label as season_label,
    season.ordinal as season_ordinal
  from public.staff_coach_career_entries entry
  cross join lateral unnest(entry.seasons)
    with ordinality as season(label, ordinal)
  where coalesce(array_length(entry.seasons, 1), 0) > 1
    and coalesce(entry.experience_type, '') <> 'CUSTOM_PERIOD'
)
insert into public.staff_coach_career_entries (
  id,
  staff_profile_id,
  team_name,
  team_logo_url,
  club_id,
  category,
  role,
  experience_type,
  seasons,
  period_start_month,
  period_start_year,
  period_end_month,
  period_end_year,
  season_details,
  results,
  description,
  head_coach_name,
  sort_order,
  experience_group_id
)
select
  gen_random_uuid(),
  expandable.staff_profile_id,
  expandable.team_name,
  expandable.team_logo_url,
  expandable.club_id,
  coalesce(
    nullif(trim(expandable.season_details -> expandable.season_label ->> 'category'), ''),
    expandable.category
  ),
  coalesce(
    nullif(trim(expandable.season_details -> expandable.season_label ->> 'role'), ''),
    expandable.role
  ),
  expandable.experience_type,
  array[expandable.season_label],
  expandable.period_start_month,
  expandable.period_start_year,
  expandable.period_end_month,
  expandable.period_end_year,
  '{}'::jsonb,
  coalesce(
    (
      select jsonb_agg(result)
      from jsonb_array_elements(coalesce(expandable.results, '[]'::jsonb)) as result
      where result ->> 'seasonLabel' = expandable.season_label
    ),
    '[]'::jsonb
  ),
  expandable.description,
  expandable.head_coach_name,
  expandable.sort_order,
  expandable.experience_group_id
from expandable
where expandable.season_ordinal > 1;

update public.staff_coach_career_entries entry
set
  category = coalesce(
    nullif(trim(entry.season_details -> entry.seasons[1] ->> 'category'), ''),
    entry.category
  ),
  role = coalesce(
    nullif(trim(entry.season_details -> entry.seasons[1] ->> 'role'), ''),
    entry.role
  ),
  results = coalesce(
    (
      select jsonb_agg(result)
      from jsonb_array_elements(coalesce(entry.results, '[]'::jsonb)) as result
      where result ->> 'seasonLabel' is null
         or result ->> 'seasonLabel' = entry.seasons[1]
    ),
    '[]'::jsonb
  ),
  seasons = array[entry.seasons[1]],
  season_details = '{}'::jsonb
where coalesce(array_length(entry.seasons, 1), 0) > 1
  and coalesce(entry.experience_type, '') <> 'CUSTOM_PERIOD';

create index if not exists idx_staff_career_entries_experience
  on public.staff_career_entries (staff_profile_id, experience_group_id);

create index if not exists idx_staff_coach_career_entries_experience
  on public.staff_coach_career_entries (staff_profile_id, experience_group_id);

-- ---------------------------------------------------------------------------
-- 3. Percorso aggiuntivo da calciatore
-- ---------------------------------------------------------------------------
-- La task impone di riusare il flusso già approvato per il Calciatore.
-- `staff_player_career_entries` è già una riga per stagione, ma non sa
-- rappresentare un periodo personalizzato né i minuti e i riconoscimenti: le
-- colonne mancanti vengono allineate a `player_career_entries` e a
-- `coach_player_career_entries`.

alter table public.staff_player_career_entries
  add column if not exists experience_group_id text,
  add column if not exists career_type text,
  add column if not exists season_period text not null default 'full',
  add column if not exists period_start_month smallint,
  add column if not exists period_end_month smallint,
  add column if not exists minutes_played integer,
  add column if not exists awards text;

-- NULL = statistica non disponibile, 0 = zero dichiarato. Finora i due casi
-- erano indistinguibili.
alter table public.staff_player_career_entries
  alter column appearances drop not null,
  alter column appearances drop default,
  alter column goals drop not null,
  alter column goals drop default,
  alter column assists drop not null,
  alter column assists drop default;

alter table public.staff_player_career_entries
  drop constraint if exists staff_player_career_entries_career_type_check;

alter table public.staff_player_career_entries
  add constraint staff_player_career_entries_career_type_check
  check (
    career_type is null
    or career_type in ('MULTI_SEASON', 'SINGLE_SEASON', 'CUSTOM_PERIOD')
  );

alter table public.staff_player_career_entries
  drop constraint if exists staff_player_career_entries_season_period_check;

alter table public.staff_player_career_entries
  add constraint staff_player_career_entries_season_period_check
  check (season_period in ('full', 'partial'));

-- Le righe storiche non portano il gruppo. Stagioni consecutive nella stessa
-- squadra e categoria sono la stessa esperienza; un buco di uno o più anni ne
-- apre una nuova. È la stessa ricostruzione applicata a Calciatore e Allenatore.
with ordered as (
  select
    entry.id,
    entry.staff_profile_id,
    lower(trim(entry.team_name)) as club_key,
    lower(trim(coalesce(entry.category, ''))) as category_key,
    nullif(substring(entry.season from '^\d{4}'), '')::int as start_year
  from public.staff_player_career_entries entry
  where entry.experience_group_id is null
),
gapped as (
  select
    ordered.*,
    case
      when start_year is null then 1
      when lag(start_year) over w is null then 1
      when start_year - lag(start_year) over w <= 1 then 0
      else 1
    end as is_new_run
  from ordered
  window w as (
    partition by staff_profile_id, club_key, category_key
    order by start_year nulls first, id
  )
),
islands as (
  select
    gapped.*,
    sum(is_new_run) over (
      partition by staff_profile_id, club_key, category_key
      order by start_year nulls first, id
      rows between unbounded preceding and current row
    ) as run_index
  from gapped
),
groups as (
  select
    staff_profile_id,
    club_key,
    category_key,
    run_index,
    gen_random_uuid()::text as group_id
  from islands
  group by staff_profile_id, club_key, category_key, run_index
)
update public.staff_player_career_entries entry
set experience_group_id = groups.group_id
from islands
join groups
  on groups.staff_profile_id = islands.staff_profile_id
  and groups.club_key = islands.club_key
  and groups.category_key = islands.category_key
  and groups.run_index = islands.run_index
where entry.id = islands.id
  and entry.experience_group_id is null;

with typed as (
  select
    experience_group_id,
    case
      when bool_or(season_period = 'partial') then 'CUSTOM_PERIOD'
      when count(*) = 1 then 'SINGLE_SEASON'
      else 'MULTI_SEASON'
    end as resolved_type
  from public.staff_player_career_entries
  where experience_group_id is not null
  group by experience_group_id
)
update public.staff_player_career_entries entry
set career_type = typed.resolved_type
from typed
where entry.experience_group_id = typed.experience_group_id
  and entry.career_type is null;

create index if not exists idx_staff_player_career_entries_experience
  on public.staff_player_career_entries (staff_profile_id, experience_group_id);

-- ---------------------------------------------------------------------------
-- 4. RPC di salvataggio
-- ---------------------------------------------------------------------------
-- Ricostruita a partire dalla definizione corrente (20260408210500, che
-- introduce il cast di `specialization`): ripartire da una versione più vecchia
-- farebbe sparire in silenzio quel cast. Rispetto a quella cambiano solo le
-- colonne nuove.
--
-- Il salvataggio resta una sostituzione completa dentro una sola transazione:
-- è questo che rende atomico il salvataggio di un gruppo multi-stagione — o
-- entrano tutte le assegnazioni, o non ne entra nessuna.

create or replace function public.save_staff_career_details(
  p_profile_id uuid,
  p_staff_profile jsonb default '{}'::jsonb,
  p_career_entries jsonb default '[]'::jsonb,
  p_coach_career_entries jsonb default '[]'::jsonb,
  p_player_career_entries jsonb default '[]'::jsonb
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

  insert into public.staff_profiles (
    profile_id,
    specialization,
    experience_summary,
    certifications,
    preferred_regions,
    preferred_provinces,
    availability_type,
    open_to_work,
    preferred_categories,
    staff_roles,
    primary_staff_role,
    available_from
  )
  select
    p_profile_id,
    case
      when payload.specialization in (
        'fitness_coach',
        'goalkeeper_coach',
        'physiotherapist',
        'match_analyst',
        'team_manager',
        'other'
      )
        then payload.specialization::public.staff_specialization
      else 'other'::public.staff_specialization
    end,
    payload.experience_summary,
    coalesce(payload.certifications, '{}'::text[]),
    coalesce(payload.preferred_regions, '{}'::text[]),
    coalesce(payload.preferred_provinces, '{}'::text[]),
    payload.availability_type,
    coalesce(payload.open_to_work, false),
    coalesce(payload.preferred_categories, '{}'::text[]),
    coalesce(payload.staff_roles, '{}'::text[]),
    payload.primary_staff_role,
    payload.available_from
  from jsonb_to_record(coalesce(p_staff_profile, '{}'::jsonb)) as payload(
    specialization text,
    experience_summary text,
    certifications text[],
    preferred_regions text[],
    preferred_provinces text[],
    availability_type text,
    open_to_work boolean,
    preferred_categories text[],
    staff_roles text[],
    primary_staff_role text,
    available_from text
  )
  on conflict (profile_id) do update
  set
    specialization = excluded.specialization,
    experience_summary = excluded.experience_summary,
    certifications = excluded.certifications,
    preferred_regions = excluded.preferred_regions,
    preferred_provinces = excluded.preferred_provinces,
    availability_type = excluded.availability_type,
    open_to_work = excluded.open_to_work,
    preferred_categories = excluded.preferred_categories,
    staff_roles = excluded.staff_roles,
    primary_staff_role = excluded.primary_staff_role,
    available_from = excluded.available_from,
    updated_at = timezone('utc', now());

  delete from public.staff_career_entries
  where staff_profile_id = p_profile_id;

  insert into public.staff_career_entries (
    id,
    staff_profile_id,
    team_name,
    team_logo_url,
    club_id,
    category,
    role,
    experience_type,
    seasons,
    period_start_month,
    period_start_year,
    period_end_month,
    period_end_year,
    season_details,
    results,
    description,
    head_coach_name,
    sort_order,
    experience_group_id
  )
  select
    coalesce(entry.id, gen_random_uuid()),
    p_profile_id,
    coalesce(entry.team_name, ''),
    entry.team_logo_url,
    entry.club_id,
    entry.category,
    coalesce(entry.role, ''),
    coalesce(entry.experience_type, 'SINGLE_SEASON'),
    coalesce(entry.seasons, '{}'::text[]),
    entry.period_start_month,
    entry.period_start_year,
    entry.period_end_month,
    entry.period_end_year,
    coalesce(entry.season_details, '{}'::jsonb),
    coalesce(entry.results, '[]'::jsonb),
    entry.description,
    entry.head_coach_name,
    coalesce(entry.sort_order, 0),
    entry.experience_group_id
  from jsonb_to_recordset(coalesce(p_career_entries, '[]'::jsonb)) as entry(
    id uuid,
    team_name text,
    team_logo_url text,
    club_id uuid,
    category text,
    role text,
    experience_type text,
    seasons text[],
    period_start_month text,
    period_start_year integer,
    period_end_month text,
    period_end_year integer,
    season_details jsonb,
    results jsonb,
    description text,
    head_coach_name text,
    sort_order integer,
    experience_group_id text
  );

  delete from public.staff_coach_career_entries
  where staff_profile_id = p_profile_id;

  insert into public.staff_coach_career_entries (
    id,
    staff_profile_id,
    team_name,
    team_logo_url,
    club_id,
    category,
    role,
    experience_type,
    seasons,
    period_start_month,
    period_start_year,
    period_end_month,
    period_end_year,
    season_details,
    results,
    description,
    head_coach_name,
    sort_order,
    experience_group_id
  )
  select
    coalesce(entry.id, gen_random_uuid()),
    p_profile_id,
    coalesce(entry.team_name, ''),
    entry.team_logo_url,
    entry.club_id,
    entry.category,
    coalesce(entry.role, ''),
    coalesce(entry.experience_type, 'SINGLE_SEASON'),
    coalesce(entry.seasons, '{}'::text[]),
    entry.period_start_month,
    entry.period_start_year,
    entry.period_end_month,
    entry.period_end_year,
    coalesce(entry.season_details, '{}'::jsonb),
    coalesce(entry.results, '[]'::jsonb),
    entry.description,
    entry.head_coach_name,
    coalesce(entry.sort_order, 0),
    entry.experience_group_id
  from jsonb_to_recordset(coalesce(p_coach_career_entries, '[]'::jsonb)) as entry(
    id uuid,
    team_name text,
    team_logo_url text,
    club_id uuid,
    category text,
    role text,
    experience_type text,
    seasons text[],
    period_start_month text,
    period_start_year integer,
    period_end_month text,
    period_end_year integer,
    season_details jsonb,
    results jsonb,
    description text,
    head_coach_name text,
    sort_order integer,
    experience_group_id text
  );

  delete from public.staff_player_career_entries
  where staff_profile_id = p_profile_id;

  insert into public.staff_player_career_entries (
    id,
    staff_profile_id,
    team_name,
    team_logo_url,
    season,
    category,
    position,
    appearances,
    goals,
    assists,
    minutes_played,
    awards,
    season_period,
    period_start_month,
    period_end_month,
    experience_group_id,
    career_type,
    sort_order
  )
  select
    coalesce(entry.id, gen_random_uuid()),
    p_profile_id,
    coalesce(entry.team_name, ''),
    entry.team_logo_url,
    coalesce(entry.season, ''),
    entry.category,
    entry.position,
    entry.appearances,
    entry.goals,
    entry.assists,
    entry.minutes_played,
    entry.awards,
    coalesce(entry.season_period, 'full'),
    entry.period_start_month,
    entry.period_end_month,
    entry.experience_group_id,
    entry.career_type,
    coalesce(entry.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_player_career_entries, '[]'::jsonb)) as entry(
    id uuid,
    team_name text,
    team_logo_url text,
    season text,
    category text,
    position text,
    appearances integer,
    goals integer,
    assists integer,
    minutes_played integer,
    awards text,
    season_period text,
    period_start_month smallint,
    period_end_month smallint,
    experience_group_id text,
    career_type text,
    sort_order integer
  );
end;
$$;

revoke all on function public.save_staff_career_details(uuid, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.save_staff_career_details(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
