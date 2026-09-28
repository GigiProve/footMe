-- REV-PROF-01 §12, §17, §19 — identità dell'esperienza e statistiche sconosciute.
--
-- `player_career_entries` salva una riga per stagione: né l'id dell'esperienza
-- né la tipologia dichiarata in onboarding (REV-ONB-02) sopravvivono al
-- salvataggio. Al ricaricamento le righe vengono riaggregate per squadra +
-- categoria, quindi due periodi realmente distinti presso la stessa società
-- collassano in un'unica esperienza e il logo/ordinamento seguono il club e
-- non l'esperienza. Qui le due informazioni diventano colonne.
--
-- Seconda correzione: `appearances`, `goals`, `assists` e `minutes_played`
-- erano `not null default 0`, quindi una statistica mai inserita era
-- indistinguibile da uno zero reale. Diventano nullable: NULL = dato non
-- disponibile, 0 = zero dichiarato.
--
-- Migrazione additiva: nessuna colonna rimossa, nessun dato sovrascritto.

-- `experience_group_id` è `text`, non `uuid`: l'id di esperienza nasce nel
-- client (`player-<timestamp>-<n>`, REV-ONB-02) e resta lo stesso valore una
-- volta salvato. Un tipo uuid farebbe fallire l'RPC sul primo salvataggio di
-- un'esperienza creata in onboarding.
alter table public.player_career_entries
  add column if not exists experience_group_id text,
  add column if not exists career_type text;

alter table public.player_career_entries
  alter column appearances drop not null,
  alter column appearances drop default,
  alter column goals drop not null,
  alter column goals drop default,
  alter column assists drop not null,
  alter column assists drop default,
  alter column minutes_played drop not null,
  alter column minutes_played drop default;

alter table public.player_career_entries
  drop constraint if exists player_career_entries_career_type_check;

alter table public.player_career_entries
  add constraint player_career_entries_career_type_check
  check (
    career_type is null
    or career_type in ('MULTI_SEASON', 'SINGLE_SEASON', 'CUSTOM_PERIOD')
  );

-- ---------------------------------------------------------------------------
-- Backfill dell'id esperienza
-- ---------------------------------------------------------------------------
-- Le righe storiche non portano il gruppo: va ricostruito. Squadra + categoria
-- da sole unirebbero due passaggi distinti nello stesso club (§12), quindi le
-- stagioni vengono spezzate anche sui salti temporali: stagioni consecutive
-- appartengono alla stessa esperienza, un buco di uno o più anni ne apre una
-- nuova. Il periodo personalizzato resta riconoscibile da `season_period`.

with ordered as (
  select
    entry.id,
    entry.player_profile_id,
    coalesce(entry.club_id::text, lower(trim(entry.club_name))) as club_key,
    lower(trim(coalesce(entry.competition_name, ''))) as category_key,
    nullif(substring(entry.season_label from '^\d{4}'), '')::int as start_year
  from public.player_career_entries entry
  where entry.experience_group_id is null
),
gapped as (
  select
    ordered.*,
    case
      -- Anno illeggibile: la riga sta per conto suo, e nemmeno la riga
      -- successiva deve finirci dentro (`lag` nullo apre comunque un run).
      when start_year is null then 1
      when lag(start_year) over w is null then 1
      when start_year - lag(start_year) over w <= 1 then 0
      else 1
    end as is_new_run
  from ordered
  window w as (
    partition by player_profile_id, club_key, category_key
    order by start_year nulls first, id
  )
),
islands as (
  select
    gapped.*,
    sum(is_new_run) over (
      partition by player_profile_id, club_key, category_key
      order by start_year nulls first, id
      rows between unbounded preceding and current row
    ) as run_index
  from gapped
),
groups as (
  select
    player_profile_id,
    club_key,
    category_key,
    run_index,
    gen_random_uuid()::text as group_id
  from islands
  group by player_profile_id, club_key, category_key, run_index
)
update public.player_career_entries entry
set experience_group_id = groups.group_id
from islands
join groups
  on groups.player_profile_id = islands.player_profile_id
  and groups.club_key = islands.club_key
  and groups.category_key = islands.category_key
  and groups.run_index = islands.run_index
where entry.id = islands.id
  and entry.experience_group_id is null;

-- ---------------------------------------------------------------------------
-- Backfill della tipologia
-- ---------------------------------------------------------------------------
-- Un gruppo con almeno una stagione parziale è un periodo personalizzato; gli
-- altri si distinguono per numero di stagioni. È la stessa deduzione che il
-- client applicava in memoria, ora persistita una volta sola.

with typed as (
  select
    experience_group_id,
    case
      when bool_or(season_period = 'partial') then 'CUSTOM_PERIOD'
      when count(*) = 1 then 'SINGLE_SEASON'
      else 'MULTI_SEASON'
    end as resolved_type
  from public.player_career_entries
  where experience_group_id is not null
  group by experience_group_id
)
update public.player_career_entries entry
set career_type = typed.resolved_type
from typed
where entry.experience_group_id = typed.experience_group_id
  and entry.career_type is null;

create index if not exists idx_player_career_entries_experience
  on public.player_career_entries (player_profile_id, experience_group_id);

-- ---------------------------------------------------------------------------
-- RPC di salvataggio
-- ---------------------------------------------------------------------------
-- Ricostruita a partire dalla definizione corrente (20260407000000), non da
-- una più vecchia: ripartire da una versione superata farebbe sparire in
-- silenzio le colonne aggiunte nel frattempo a `player_profiles`.
-- Rispetto a quella cambiano solo le due colonne nuove e le statistiche, che
-- ora viaggiano nullable invece di essere schiacciate a zero.

create or replace function public.save_player_profile_details(
  p_profile_id uuid,
  p_player_profile jsonb,
  p_career_entries jsonb default '[]'::jsonb
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

  insert into public.player_profiles (
    profile_id,
    preferred_foot,
    height_cm,
    weight_kg,
    primary_position,
    secondary_positions,
    willing_to_change_club,
    availability_type,
    transfer_regions,
    transfer_provinces,
    preferred_categories,
    highlight_video_url,
    open_to_trials,
    player_objectives,
    contract_status,
    contract_expiry,
    current_condition,
    show_transfer_badge,
    show_regions_badge
  )
  select
    p_profile_id,
    payload.preferred_foot,
    payload.height_cm,
    payload.weight_kg,
    coalesce(payload.primary_position, 'central_midfielder'::public.player_position),
    coalesce(payload.secondary_positions, '{}'::public.player_position[]),
    coalesce(payload.willing_to_change_club, false),
    coalesce(payload.availability_type, 'ITALY'),
    coalesce(payload.transfer_regions, '{}'::text[]),
    coalesce(payload.transfer_provinces, '{}'::text[]),
    coalesce(payload.preferred_categories, '{}'::text[]),
    payload.highlight_video_url,
    coalesce(payload.open_to_trials, false),
    coalesce(payload.player_objectives, '{}'::text[]),
    payload.contract_status,
    payload.contract_expiry,
    payload.current_condition,
    coalesce(payload.show_transfer_badge, false),
    coalesce(payload.show_regions_badge, false)
  from jsonb_to_record(coalesce(p_player_profile, '{}'::jsonb)) as payload(
    preferred_foot public.preferred_foot,
    height_cm integer,
    weight_kg integer,
    primary_position public.player_position,
    secondary_positions public.player_position[],
    willing_to_change_club boolean,
    availability_type text,
    transfer_regions text[],
    transfer_provinces text[],
    preferred_categories text[],
    highlight_video_url text,
    open_to_trials boolean,
    player_objectives text[],
    contract_status text,
    contract_expiry date,
    current_condition text,
    show_transfer_badge boolean,
    show_regions_badge boolean
  )
  on conflict (profile_id) do update
  set
    preferred_foot = excluded.preferred_foot,
    height_cm = excluded.height_cm,
    weight_kg = excluded.weight_kg,
    primary_position = excluded.primary_position,
    secondary_positions = excluded.secondary_positions,
    willing_to_change_club = excluded.willing_to_change_club,
    availability_type = excluded.availability_type,
    transfer_regions = excluded.transfer_regions,
    transfer_provinces = excluded.transfer_provinces,
    preferred_categories = excluded.preferred_categories,
    highlight_video_url = excluded.highlight_video_url,
    open_to_trials = excluded.open_to_trials,
    player_objectives = excluded.player_objectives,
    contract_status = excluded.contract_status,
    contract_expiry = excluded.contract_expiry,
    current_condition = excluded.current_condition,
    show_transfer_badge = excluded.show_transfer_badge,
    show_regions_badge = excluded.show_regions_badge,
    updated_at = timezone('utc', now());

  with provided_entries as (
    select *
    from jsonb_to_recordset(coalesce(p_career_entries, '[]'::jsonb)) as entry(
      id uuid,
      appearances integer,
      assists integer,
      awards text,
      club_id uuid,
      club_name text,
      competition_name text,
      goals integer,
      minutes_played integer,
      season_label text,
      sort_order integer,
      team_logo_url text,
      season_period text,
      period_start_month smallint,
      period_end_month smallint,
      experience_group_id text,
      career_type text
    )
  )
  delete from public.player_career_entries career
  where career.player_profile_id = p_profile_id
    and not exists (
      select 1
      from provided_entries entry
      where entry.id is not null
        and entry.id = career.id
    );

  with provided_entries as (
    select *
    from jsonb_to_recordset(coalesce(p_career_entries, '[]'::jsonb)) as entry(
      id uuid,
      appearances integer,
      assists integer,
      awards text,
      club_id uuid,
      club_name text,
      competition_name text,
      goals integer,
      minutes_played integer,
      season_label text,
      sort_order integer,
      team_logo_url text,
      season_period text,
      period_start_month smallint,
      period_end_month smallint,
      experience_group_id text,
      career_type text
    )
  )
  insert into public.player_career_entries (
    id,
    player_profile_id,
    season_label,
    club_name,
    competition_name,
    appearances,
    goals,
    assists,
    minutes_played,
    awards,
    sort_order,
    team_logo_url,
    club_id,
    season_period,
    period_start_month,
    period_end_month,
    experience_group_id,
    career_type
  )
  select
    coalesce(entry.id, gen_random_uuid()),
    p_profile_id,
    entry.season_label,
    entry.club_name,
    entry.competition_name,
    entry.appearances,
    entry.goals,
    entry.assists,
    entry.minutes_played,
    entry.awards,
    coalesce(entry.sort_order, 0),
    entry.team_logo_url,
    entry.club_id,
    coalesce(entry.season_period, 'full'),
    entry.period_start_month,
    entry.period_end_month,
    entry.experience_group_id,
    entry.career_type
  from provided_entries entry
  on conflict (id) do update
  set
    season_label = excluded.season_label,
    club_name = excluded.club_name,
    competition_name = excluded.competition_name,
    appearances = excluded.appearances,
    goals = excluded.goals,
    assists = excluded.assists,
    minutes_played = excluded.minutes_played,
    awards = excluded.awards,
    sort_order = excluded.sort_order,
    club_id = excluded.club_id,
    team_logo_url = excluded.team_logo_url,
    season_period = excluded.season_period,
    period_start_month = excluded.period_start_month,
    period_end_month = excluded.period_end_month,
    experience_group_id = excluded.experience_group_id,
    career_type = excluded.career_type;
end;
$$;

revoke all on function public.save_player_profile_details(uuid, jsonb, jsonb) from public;
grant execute on function public.save_player_profile_details(uuid, jsonb, jsonb) to authenticated;
