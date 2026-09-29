-- REV-PROF-04 — Gestione carriera Allenatore: ruolo e categoria per stagione.
--
-- `coach_career_entries` salvava un'esperienza per riga: `seasons text[]` più
-- un `season_details` jsonb che portava ruolo e categoria di ogni stagione. Il
-- risultato è che le tre stagioni al Torino non erano tre assegnazioni, ma tre
-- chiavi dentro un record il cui ruolo e la cui categoria vivevano comunque
-- nelle colonne del padre. Modificare una sola stagione significava riscrivere
-- l'intero blocco, e il client normalizzava via i dettagli ogni volta che due
-- stagioni condividevano ruolo e categoria.
--
-- Qui la riga diventa l'assegnazione: **una stagione (o un periodo), un ruolo,
-- una categoria**. Le assegnazioni nate da un'unica operazione restano unite da
-- `experience_group_id`, che è un livello di raggruppamento e non un vincolo:
-- ogni riga resta modificabile ed eliminabile da sola.
--
-- Stesso impianto già adottato per il Calciatore in 20260927120000: l'id di
-- gruppo è `text` e non `uuid` perché nasce nel client (`coach-<ts>-<n>`) e non
-- deve far fallire l'RPC al primo salvataggio di una bozza di onboarding.
--
-- Migrazione additiva e rieseguibile:
--   * nessuna colonna rimossa, `season_details` resta per la lettura;
--   * il backfill del gruppo tocca solo le righe che non ce l'hanno;
--   * l'espansione tocca solo le righe con più di una stagione, quindi alla
--     seconda esecuzione non trova più nulla da espandere.

-- ---------------------------------------------------------------------------
-- 1. Identità dell'assegnazione
-- ---------------------------------------------------------------------------

alter table public.coach_career_entries
  add column if not exists experience_group_id text;

-- Ogni riga storica È già un'esperienza: diventa il gruppo di se stessa, e le
-- stagioni che ne verranno estratte erediteranno questo id.
update public.coach_career_entries
set experience_group_id = gen_random_uuid()::text
where experience_group_id is null;

-- ---------------------------------------------------------------------------
-- 2. Espansione delle esperienze multi-stagione
-- ---------------------------------------------------------------------------
-- Una riga con N stagioni diventa N righe. Ruolo e categoria di ciascuna
-- vengono da `season_details`, che finora era l'unico posto in cui la
-- variazione stagionale esisteva; dove il dettaglio manca si eredita il valore
-- del padre, che era appunto quello applicato a tutte le stagioni.

with expandable as (
  select
    entry.*,
    season.label as season_label,
    season.ordinal as season_ordinal
  from public.coach_career_entries entry
  cross join lateral unnest(entry.seasons)
    with ordinality as season(label, ordinal)
  -- Un periodo personalizzato non si espande: le sue stagioni sono derivate
  -- dalle date, non assegnazioni distinte, e duplicarle creerebbe N copie
  -- dello stesso incarico.
  where coalesce(array_length(entry.seasons, 1), 0) > 1
    and coalesce(entry.experience_type, '') <> 'CUSTOM_PERIOD'
)
insert into public.coach_career_entries (
  id,
  coach_profile_id,
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
  sort_order,
  experience_group_id
)
select
  gen_random_uuid(),
  expandable.coach_profile_id,
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
  expandable.sort_order,
  expandable.experience_group_id
from expandable
where expandable.season_ordinal > 1;

-- La riga originale conserva la prima stagione dell'array e prende il ruolo e
-- la categoria che le spettano.
update public.coach_career_entries entry
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

create index if not exists idx_coach_career_entries_experience
  on public.coach_career_entries (coach_profile_id, experience_group_id);

-- ---------------------------------------------------------------------------
-- 3. Carriera da ex calciatore dell'Allenatore
-- ---------------------------------------------------------------------------
-- La task impone di riusare il modello già approvato per il Calciatore invece
-- di piegare quello dell'Allenatore. `coach_player_career_entries` è già una
-- riga per stagione, ma non sa rappresentare un periodo personalizzato né i
-- minuti e i riconoscimenti: le colonne mancanti vengono allineate a quelle di
-- `player_career_entries`.

alter table public.coach_player_career_entries
  add column if not exists experience_group_id text,
  add column if not exists career_type text,
  add column if not exists season_period text not null default 'full',
  add column if not exists period_start_month smallint,
  add column if not exists period_end_month smallint,
  add column if not exists minutes_played integer,
  add column if not exists awards text;

-- Come per il Calciatore: NULL = statistica non disponibile, 0 = zero
-- dichiarato. Finora i due casi erano indistinguibili.
alter table public.coach_player_career_entries
  alter column appearances drop not null,
  alter column appearances drop default,
  alter column goals drop not null,
  alter column goals drop default,
  alter column assists drop not null,
  alter column assists drop default;

alter table public.coach_player_career_entries
  drop constraint if exists coach_player_career_entries_career_type_check;

alter table public.coach_player_career_entries
  add constraint coach_player_career_entries_career_type_check
  check (
    career_type is null
    or career_type in ('MULTI_SEASON', 'SINGLE_SEASON', 'CUSTOM_PERIOD')
  );

alter table public.coach_player_career_entries
  drop constraint if exists coach_player_career_entries_season_period_check;

alter table public.coach_player_career_entries
  add constraint coach_player_career_entries_season_period_check
  check (season_period in ('full', 'partial'));

-- Le righe storiche non portano il gruppo. Stagioni consecutive nella stessa
-- squadra e categoria sono la stessa esperienza; un buco di uno o più anni ne
-- apre una nuova. È la stessa ricostruzione applicata al Calciatore.
with ordered as (
  select
    entry.id,
    entry.coach_profile_id,
    lower(trim(entry.team_name)) as club_key,
    lower(trim(coalesce(entry.category, ''))) as category_key,
    nullif(substring(entry.season from '^\d{4}'), '')::int as start_year
  from public.coach_player_career_entries entry
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
    partition by coach_profile_id, club_key, category_key
    order by start_year nulls first, id
  )
),
islands as (
  select
    gapped.*,
    sum(is_new_run) over (
      partition by coach_profile_id, club_key, category_key
      order by start_year nulls first, id
      rows between unbounded preceding and current row
    ) as run_index
  from gapped
),
groups as (
  select
    coach_profile_id,
    club_key,
    category_key,
    run_index,
    gen_random_uuid()::text as group_id
  from islands
  group by coach_profile_id, club_key, category_key, run_index
)
update public.coach_player_career_entries entry
set experience_group_id = groups.group_id
from islands
join groups
  on groups.coach_profile_id = islands.coach_profile_id
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
  from public.coach_player_career_entries
  where experience_group_id is not null
  group by experience_group_id
)
update public.coach_player_career_entries entry
set career_type = typed.resolved_type
from typed
where entry.experience_group_id = typed.experience_group_id
  and entry.career_type is null;

create index if not exists idx_coach_player_career_entries_experience
  on public.coach_player_career_entries (coach_profile_id, experience_group_id);

-- ---------------------------------------------------------------------------
-- 4. RPC di salvataggio
-- ---------------------------------------------------------------------------
-- Ricostruita a partire dalla definizione corrente (20260411160000): ripartire
-- da una versione più vecchia farebbe sparire in silenzio le colonne aggiunte
-- nel frattempo. Rispetto a quella cambiano solo le colonne nuove.
--
-- Il salvataggio resta una sostituzione completa dentro una sola transazione:
-- è questo che rende atomico il salvataggio di un gruppo multi-stagione — o
-- entrano tutte le assegnazioni, o non ne entra nessuna.

create or replace function public.save_coach_career_details(
  p_profile_id uuid,
  p_coach_profile jsonb default '{}'::jsonb,
  p_career_entries jsonb default '[]'::jsonb,
  p_player_career_entries jsonb default '[]'::jsonb,
  p_director_entries jsonb default '[]'::jsonb
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

  insert into public.coach_profiles (
    profile_id,
    licenses,
    coached_clubs,
    coached_categories,
    game_philosophy,
    technical_video_url,
    preferred_regions,
    preferred_provinces,
    availability_type,
    open_to_new_role,
    primary_role,
    available_from,
    preferred_formation,
    secondary_formations,
    play_styles,
    current_club,
    contract_end,
    preferred_categories
  )
  select
    p_profile_id,
    coalesce(payload.licenses, '{}'::text[]),
    coalesce(payload.coached_clubs, '{}'::text[]),
    coalesce(payload.coached_categories, '{}'::text[]),
    payload.game_philosophy,
    payload.technical_video_url,
    coalesce(payload.preferred_regions, '{}'::text[]),
    coalesce(payload.preferred_provinces, '{}'::text[]),
    payload.availability_type,
    coalesce(payload.open_to_new_role, false),
    payload.primary_role,
    payload.available_from,
    payload.preferred_formation,
    coalesce(payload.secondary_formations, '{}'::text[]),
    coalesce(payload.play_styles, '{}'::text[]),
    payload.current_club,
    payload.contract_end,
    coalesce(payload.preferred_categories, '{}'::text[])
  from jsonb_to_record(coalesce(p_coach_profile, '{}'::jsonb)) as payload(
    licenses text[],
    coached_clubs text[],
    coached_categories text[],
    game_philosophy text,
    technical_video_url text,
    preferred_regions text[],
    preferred_provinces text[],
    availability_type text,
    open_to_new_role boolean,
    primary_role text,
    available_from text,
    preferred_formation text,
    secondary_formations text[],
    play_styles text[],
    current_club text,
    contract_end text,
    preferred_categories text[]
  )
  on conflict (profile_id) do update
  set
    licenses = excluded.licenses,
    coached_clubs = excluded.coached_clubs,
    coached_categories = excluded.coached_categories,
    game_philosophy = excluded.game_philosophy,
    technical_video_url = excluded.technical_video_url,
    preferred_regions = excluded.preferred_regions,
    preferred_provinces = excluded.preferred_provinces,
    availability_type = excluded.availability_type,
    open_to_new_role = excluded.open_to_new_role,
    primary_role = excluded.primary_role,
    available_from = excluded.available_from,
    preferred_formation = excluded.preferred_formation,
    secondary_formations = excluded.secondary_formations,
    play_styles = excluded.play_styles,
    current_club = excluded.current_club,
    contract_end = excluded.contract_end,
    preferred_categories = excluded.preferred_categories,
    updated_at = timezone('utc', now());

  delete from public.coach_career_entries
  where coach_profile_id = p_profile_id;

  insert into public.coach_career_entries (
    id,
    coach_profile_id,
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
    sort_order integer,
    experience_group_id text
  );

  delete from public.coach_player_career_entries
  where coach_profile_id = p_profile_id;

  insert into public.coach_player_career_entries (
    id,
    coach_profile_id,
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

  delete from public.coach_director_career_entries
  where coach_profile_id = p_profile_id;

  insert into public.coach_director_career_entries (
    id,
    coach_profile_id,
    team_name,
    team_logo_url,
    role,
    seasons,
    category,
    description,
    sort_order
  )
  select
    coalesce(entry.id, gen_random_uuid()),
    p_profile_id,
    coalesce(entry.team_name, ''),
    entry.team_logo_url,
    coalesce(entry.role, ''),
    coalesce(entry.seasons, '{}'::text[]),
    entry.category,
    entry.description,
    coalesce(entry.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_director_entries, '[]'::jsonb)) as entry(
    id uuid,
    team_name text,
    team_logo_url text,
    role text,
    seasons text[],
    category text,
    description text,
    sort_order integer
  );
end;
$$;

revoke all on function public.save_coach_career_details(uuid, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.save_coach_career_details(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
