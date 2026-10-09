-- ============================================================
-- DAS-REV-06 — Widget profilo e disponibilità
--
-- Due cose, e nient'altro.
--
-- 1. **Una configurazione geografica diventa riconoscibile.** Oggi non lo è:
--    `player_profiles.availability_type` è `not null default 'ITALY'` e
--    l'onboarding parte da "ITALY" senza che nessuno lo scelga, quindi un
--    profilo che non ha mai aperto la schermata è indistinguibile da uno che
--    ha scelto davvero tutta Italia. §15 e §16 chiedono esattamente questa
--    distinzione — «Dato realmente assente: nessuna modalità selezionata
--    automaticamente» — e senza di essa il suggerimento della Dashboard non
--    può né comparire quando serve né sparire quando è risolto.
--    Da qui `availability_configured_at`: una configurazione vale solo se
--    qualcuno l'ha confermata.
--
-- 2. **Un solo punto di scrittura per le aree, atomico e limitato.** §18:
--    «Inviare una patch limitata ai dati geografici. Non sovrascrivere ruolo,
--    carriera, categorie, contatti, toggle opportunità o visibilità.» Le RPC
--    esistenti non lo permettono: `save_player_profile_details` riporta
--    `availability_type` a 'ITALY' quando il payload lo omette e azzera
--    `show_transfer_badge` / `show_regions_badge` con un `coalesce(..., false)`,
--    e `save_coach_career_details` / `save_staff_career_details` cancellano le
--    esperienze di carriera assenti dal payload. Una patch geografica non può
--    passare di lì.
--
-- Non crea: `dashboard_availability`, una seconda tassonomia, un endpoint di
-- salvataggio parallelo della Dashboard, una tabella di completezza, un
-- punteggio (§11, §22, §30).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tassonomia canonica provincia → regione
-- ------------------------------------------------------------
--
-- Non è una seconda tassonomia: è `public.italian_comuni` deduplicata per
-- provincia, cioè la stessa fonte già in uso da CER-04. Serve perché §17
-- chiede di validare server-side «identificativi validi e del tipo geografico
-- corretto», e `italian_comuni` ha 7904 righe per 107 province: una lookup per
-- area su quella tabella è uno scan che qui non ha ragione di esistere.
--
-- Le etichette di regione vengono riportate alla forma canonica dell'app
-- (`REGION_OPTIONS` del client): la fonte ISTAT usa i due nomi bilingui
-- "Trentino-Alto Adige/Südtirol" e "Valle d'Aosta/Vallée d'Aoste", che nessun
-- profilo ha mai salvato.

create table if not exists public.italian_provinces (
  province text primary key,
  region   text not null
);

create index if not exists italian_provinces_region_idx
  on public.italian_provinces (region);

alter table public.italian_provinces enable row level security;

drop policy if exists "italian_provinces_read" on public.italian_provinces;
create policy "italian_provinces_read"
  on public.italian_provinces
  for select
  to authenticated
  using (true);

do $$
begin
  if not exists (select 1 from public.italian_comuni limit 1) then
    raise exception
      'italian_comuni is empty: run 20260725100000_comuni_geo.sql first';
  end if;
end;
$$;

-- Idempotente: riseminabile senza perdere righe esistenti.
insert into public.italian_provinces (province, region)
select
  c.province,
  case c.region
    when 'Trentino-Alto Adige/Südtirol'   then 'Trentino-Alto Adige'
    when 'Valle d''Aosta/Vallée d''Aoste' then 'Valle d''Aosta'
    else c.region
  end
from (
  -- `distinct on` e non `distinct`: se un comune disallineato associasse una
  -- provincia a due regioni, un `distinct` produrrebbe due righe e la
  -- chiave primaria farebbe fallire la migrazione. Qui la prima vince, in
  -- modo deterministico.
  select distinct on (province) province, region
  from public.italian_comuni
  order by province, region
) c
on conflict (province) do update set region = excluded.region;

comment on table public.italian_provinces is
  'DAS-REV-06 §17: tassonomia canonica provincia → regione, derivata da '
  'italian_comuni. Usata per validare la disponibilità geografica e per '
  'disambiguare una provincia nel selector condiviso.';

-- ------------------------------------------------------------
-- 2. Conferma e revisione della disponibilità, per ruolo
-- ------------------------------------------------------------
--
-- `availability_revision` è una revisione **della sola disponibilità**, non
-- della riga: §18 chiede di riusare il controllo di concorrenza del profilo
-- senza che un salvataggio di carriera o di contatti faccia fallire un
-- salvataggio di aree che non è in conflitto con nulla.

alter table public.player_profiles
  add column if not exists availability_configured_at timestamptz,
  add column if not exists availability_revision integer not null default 0;

alter table public.coach_profiles
  add column if not exists availability_configured_at timestamptz,
  add column if not exists availability_revision integer not null default 0;

alter table public.staff_profiles
  add column if not exists availability_configured_at timestamptz,
  add column if not exists availability_revision integer not null default 0;

comment on column public.player_profiles.availability_configured_at is
  'DAS-REV-06 §16: istante in cui la disponibilità geografica è stata '
  'confermata. Null = mai configurata; availability_type da solo non lo dice, '
  'perché è not null default ''ITALY''.';

-- Backfill (§24).
--
-- Regola unica per i tre ruoli: una configurazione è riconosciuta quando
-- esiste almeno un territorio salvato. È l'unico segnale **derivato dai dati**
-- che non inventa nulla.
--
-- Il caso ambiguo è dichiarato e lasciato tale: modalità 'ITALY' (o nulla) con
-- entrambe le liste vuote resta "non configurata". Non viene convertita, non
-- viene cancellata, `availability_type` non viene toccato — §24 vieta le
-- conversioni distruttive e §15 vieta di preselezionare l'ambito nazionale per
-- completare d'ufficio un profilo. La conseguenza, accettata: a chi aveva
-- davvero scelto "Tutta Italia" senza province il suggerimento ricompare una
-- volta, e sparisce appena riconferma. Costa un tap; l'alternativa sarebbe
-- dichiarare configurato un profilo che non lo è.
--
-- `updated_at` e non `now()`: §24 vieta di inventare date durante una
-- migrazione, e la data della riga è l'unico istante reale disponibile.

update public.player_profiles
   set availability_configured_at = coalesce(updated_at, created_at)
 where availability_configured_at is null
   and (
     coalesce(cardinality(transfer_provinces), 0) > 0
     or coalesce(cardinality(transfer_regions), 0) > 0
   );

update public.coach_profiles
   set availability_configured_at = coalesce(updated_at, created_at)
 where availability_configured_at is null
   and (
     coalesce(cardinality(preferred_provinces), 0) > 0
     or coalesce(cardinality(preferred_regions), 0) > 0
   );

update public.staff_profiles
   set availability_configured_at = coalesce(updated_at, created_at)
 where availability_configured_at is null
   and (
     coalesce(cardinality(preferred_provinces), 0) > 0
     or coalesce(cardinality(preferred_regions), 0) > 0
   );

-- ------------------------------------------------------------
-- 2b. L'invariante vive sul database, non sui chiamanti
-- ------------------------------------------------------------
--
-- Le aree si scrivono da più punti: la patch di §18, le RPC per ruolo dei
-- moduli Modifica profilo (`save_player_profile_details`,
-- `save_coach_career_details`, `save_staff_career_details`), l'onboarding e
-- tre upsert diretti del salvataggio media. §20 chiede che «un dato
-- validamente salvato risolva il relativo segnale» **da qualunque origine**:
-- una regola replicata in sei punti è una regola che il settimo dimenticherà.
--
-- Quindi: conferma e revisione le stampa un trigger, una volta sola.
--
--   · INSERT  → confermata solo se porta davvero dei territori o un ambito
--               specifico. Un insert con il default 'ITALY' e liste vuote
--               **non** è una scelta: è esattamente l'ambiguità che questa
--               migrazione esiste per sciogliere (§15, §16).
--   · UPDATE  → se il chiamante ha dichiarato lui la conferma (è il caso di
--               `save_profile_availability_areas`, che deve poter confermare
--               "Tutta Italia" anche quando nessun valore cambia) quella
--               vince; altrimenti si stampa quando le aree cambiano davvero.
--
-- Un upsert che riscrive i valori identici — il salvataggio media — non
-- cambia nulla e non stampa nulla.

create or replace function public.stamp_availability_configuration()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_provinces_column text := tg_argv[0];
  v_regions_column   text := tg_argv[1];
  v_new jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  v_changed boolean;
begin
  if tg_op = 'INSERT' then
    if new.availability_type in ('REGIONS', 'PROVINCES')
       or jsonb_array_length(coalesce(v_new -> v_provinces_column, '[]'::jsonb)) > 0
       or jsonb_array_length(coalesce(v_new -> v_regions_column, '[]'::jsonb)) > 0
    then
      new.availability_configured_at :=
        coalesce(new.availability_configured_at, timezone('utc', now()));
    end if;

    return new;
  end if;

  if new.availability_configured_at is distinct from old.availability_configured_at then
    new.availability_revision := coalesce(old.availability_revision, 0) + 1;
    return new;
  end if;

  v_changed :=
    new.availability_type is distinct from old.availability_type
    or (v_new -> v_provinces_column) is distinct from (v_old -> v_provinces_column)
    or (v_new -> v_regions_column) is distinct from (v_old -> v_regions_column);

  if v_changed then
    new.availability_configured_at := timezone('utc', now());
    new.availability_revision := coalesce(old.availability_revision, 0) + 1;
  end if;

  return new;
end;
$$;

drop trigger if exists player_profiles_availability_stamp on public.player_profiles;
create trigger player_profiles_availability_stamp
  before insert or update on public.player_profiles
  for each row
  execute function public.stamp_availability_configuration(
    'transfer_provinces', 'transfer_regions'
  );

drop trigger if exists coach_profiles_availability_stamp on public.coach_profiles;
create trigger coach_profiles_availability_stamp
  before insert or update on public.coach_profiles
  for each row
  execute function public.stamp_availability_configuration(
    'preferred_provinces', 'preferred_regions'
  );

drop trigger if exists staff_profiles_availability_stamp on public.staff_profiles;
create trigger staff_profiles_availability_stamp
  before insert or update on public.staff_profiles
  for each row
  execute function public.stamp_availability_configuration(
    'preferred_provinces', 'preferred_regions'
  );

-- ------------------------------------------------------------
-- 3. Proiezione canonica della disponibilità
-- ------------------------------------------------------------
--
-- Una sola definizione di "dove sei disponibile", letta da tutti: la RPC
-- dell'editor, la RPC di salvataggio e i segnali della Dashboard. §11: «un
-- solo modello e un componente condiviso».
--
-- Le colonne hanno nomi diversi per ruolo — `transfer_*` sul Calciatore,
-- `preferred_*` su Allenatore e Staff — e questa funzione è il punto in cui
-- quella differenza smette di propagarsi.

create or replace function public.profile_availability_areas(p_profile_id uuid)
returns table (
  availability_mode text,
  configured_at     timestamptz,
  provinces         text[],
  regions           text[],
  revision          integer,
  profile_role      public.app_role,
  row_exists        boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    case p.role
      when 'player' then pp.availability_type
      when 'coach'  then cp.availability_type
      when 'staff'  then sp.availability_type
    end,
    case p.role
      when 'player' then pp.availability_configured_at
      when 'coach'  then cp.availability_configured_at
      when 'staff'  then sp.availability_configured_at
    end,
    coalesce(
      case p.role
        when 'player' then pp.transfer_provinces
        when 'coach'  then cp.preferred_provinces
        when 'staff'  then sp.preferred_provinces
      end,
      '{}'::text[]
    ),
    coalesce(
      case p.role
        when 'player' then pp.transfer_regions
        when 'coach'  then cp.preferred_regions
        when 'staff'  then sp.preferred_regions
      end,
      '{}'::text[]
    ),
    coalesce(
      case p.role
        when 'player' then pp.availability_revision
        when 'coach'  then cp.availability_revision
        when 'staff'  then sp.availability_revision
      end,
      0
    ),
    p.role,
    case p.role
      when 'player' then pp.profile_id is not null
      when 'coach'  then cp.profile_id is not null
      when 'staff'  then sp.profile_id is not null
      else false
    end
  from public.profiles p
  left join public.player_profiles pp on pp.profile_id = p.id
  left join public.coach_profiles  cp on cp.profile_id = p.id
  left join public.staff_profiles  sp on sp.profile_id = p.id
  where p.id = p_profile_id;
$$;

-- Chiamata solo dalle RPC qui sotto, che passano `auth.uid()`. Esporla a
-- `authenticated` significherebbe permettere di leggere la disponibilità di
-- un'altra PERSON passando il suo id (§25).
revoke all on function public.profile_availability_areas(uuid) from public;
revoke all on function public.profile_availability_areas(uuid) from authenticated;

-- Aree persistite che non appartengono più alla tassonomia canonica (§17).
-- Non vengono rimosse: §24 vieta le conversioni distruttive. Vengono
-- *dichiarate*, così il client può chiedere all'utente di controllarle.
create or replace function public.availability_unknown_areas(
  p_mode text,
  p_provinces text[],
  p_regions text[]
)
returns text[]
language sql
stable
set search_path = public
as $$
  select coalesce(array_agg(area order by area), '{}'::text[])
  from (
    select area
    from unnest(coalesce(p_provinces, '{}'::text[])) as area
    where p_mode = 'PROVINCES'
      and not exists (
        select 1 from public.italian_provinces ip where ip.province = area
      )
    union all
    select area
    from unnest(coalesce(p_regions, '{}'::text[])) as area
    where p_mode = 'REGIONS'
      and not exists (
        select 1 from public.italian_provinces ip where ip.region = area
      )
  ) missing;
$$;

-- ------------------------------------------------------------
-- 4. Lettura della configurazione per l'editor
-- ------------------------------------------------------------
--
-- Nessun parametro identità: opera solo su `auth.uid()`, così una richiesta
-- con l'id di un'altra PERSON non è esprimibile (§25). Il payload contiene la
-- sola configurazione geografica: nessuna licenza, nessun recapito, nessun
-- indirizzo (§25).

create or replace function public.fetch_profile_availability_areas()
returns table (
  availability_mode text,
  can_edit          boolean,
  configured_at     timestamptz,
  provinces         text[],
  regions           text[],
  revision          integer,
  unknown_areas     text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row record;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_row from public.profile_availability_areas(v_uid);

  if not found then
    raise exception 'Profile not accessible';
  end if;

  return query
  select
    v_row.availability_mode,
    -- §5: la funzionalità appartiene ai tre ruoli personali. Un contesto
    -- Società o Media non espone le mancanze del profilo dell'operatore, e
    -- un ruolo che non ha disponibilità geografica non apre l'editor.
    (
      v_row.profile_role in (
        'player'::public.app_role,
        'coach'::public.app_role,
        'staff'::public.app_role
      )
      and v_row.row_exists
    ),
    v_row.configured_at,
    v_row.provinces,
    v_row.regions,
    v_row.revision,
    public.availability_unknown_areas(
      v_row.availability_mode, v_row.provinces, v_row.regions
    );
end;
$$;

revoke all on function public.fetch_profile_availability_areas() from public;
grant execute on function public.fetch_profile_availability_areas() to authenticated;

-- ------------------------------------------------------------
-- 5. Salvataggio atomico della sola disponibilità
-- ------------------------------------------------------------
--
-- §18, passo per passo: valida il payload, rivalida identity e capability,
-- scrive **solo** modalità e selezioni attive, restituisce configurazione e
-- revisione confermate.
--
-- Cosa non tocca, deliberatamente: `willing_to_change_club`,
-- `open_to_new_role`, `open_to_work`, `profiles.is_open_to_transfer`,
-- `show_transfer_badge`, `show_regions_badge`, `available_from`,
-- `preferred_categories`, carriera, contatti. «Salvare le aree non deve
-- attivare automaticamente Disponibile al trasferimento, Disponibile per
-- provini o altri toggle» (§10) e «Non modificare implicitamente le preferenze
-- di privacy» (§10).
--
-- Gli errori sono codici stabili, non messaggi: il client li mappa sulla copy
-- di §17 e un cambio di copy non diventa un cambio di contratto.

create or replace function public.save_profile_availability_areas(
  p_mode              text,
  p_provinces         text[] default '{}'::text[],
  p_regions           text[] default '{}'::text[],
  p_expected_revision integer default null
)
returns table (
  availability_mode text,
  can_edit          boolean,
  configured_at     timestamptz,
  provinces         text[],
  regions           text[],
  revision          integer,
  unknown_areas     text[]
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_now       timestamptz := timezone('utc', now());
  v_role      public.app_role;
  v_mode      text;
  v_provinces text[] := '{}'::text[];
  v_regions   text[] := '{}'::text[];
  v_rows      integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select p.role into v_role from public.profiles p where p.id = v_uid;

  if v_role is null
     or v_role not in (
       'player'::public.app_role,
       'coach'::public.app_role,
       'staff'::public.app_role
     )
  then
    raise exception 'availability_areas_not_applicable';
  end if;

  -- Modalità riconosciuta (§17). 'ALL_ITALY' è il valore legacy di 'ITALY'.
  v_mode := case
    when p_mode in ('ITALY', 'REGIONS', 'PROVINCES') then p_mode
    when p_mode = 'ALL_ITALY' then 'ITALY'
    else null
  end;

  if v_mode is null then
    raise exception 'availability_areas_invalid_mode';
  end if;

  -- Deduplicazione e normalizzazione (§17: «assenza di duplicati»). Una
  -- selezione ripetuta non è un errore da mostrare: è una riga sola.
  select coalesce(array_agg(distinct area order by area), '{}'::text[])
    into v_provinces
  from unnest(coalesce(p_provinces, '{}'::text[])) as area
  where nullif(btrim(area), '') is not null;

  select coalesce(array_agg(distinct area order by area), '{}'::text[])
    into v_regions
  from unnest(coalesce(p_regions, '{}'::text[])) as area
  where nullif(btrim(area), '') is not null;

  -- Nessuna combinazione ibrida (§17). L'ambito nazionale non porta liste,
  -- e i due ambiti specifici non coesistono.
  if v_mode = 'ITALY'
     and (cardinality(v_provinces) > 0 or cardinality(v_regions) > 0)
  then
    raise exception 'availability_areas_hybrid_scope';
  end if;

  if v_mode = 'PROVINCES' then
    if cardinality(v_regions) > 0 then
      raise exception 'availability_areas_hybrid_scope';
    end if;

    if cardinality(v_provinces) = 0 then
      raise exception 'availability_areas_empty_scope';
    end if;

    -- Identificativi validi e **del tipo geografico corretto** (§17): una
    -- regione passata come provincia viene rifiutata, non silenziosamente
    -- accettata.
    if exists (
      select 1
      from unnest(v_provinces) as area
      where not exists (
        select 1 from public.italian_provinces ip where ip.province = area
      )
    ) then
      raise exception 'availability_areas_unknown_area';
    end if;
  end if;

  if v_mode = 'REGIONS' then
    if cardinality(v_provinces) > 0 then
      raise exception 'availability_areas_hybrid_scope';
    end if;

    if cardinality(v_regions) = 0 then
      raise exception 'availability_areas_empty_scope';
    end if;

    if exists (
      select 1
      from unnest(v_regions) as area
      where not exists (
        select 1 from public.italian_provinces ip where ip.region = area
      )
    ) then
      raise exception 'availability_areas_unknown_area';
    end if;
  end if;

  -- Scrittura atomica sulla sola riga del ruolo. La guardia sulla revisione
  -- sta **dentro** la `where`: è l'update stesso a non applicarsi quando un
  -- altro dispositivo ha già scritto, senza finestra fra lettura e scrittura
  -- (§18: «evitare overwrite silenziosi»).
  if v_role = 'player'::public.app_role then
    update public.player_profiles
       set availability_type           = v_mode,
           transfer_provinces          = v_provinces,
           transfer_regions            = v_regions,
           -- La revisione la bumpa il trigger (§2b): farlo anche qui
           -- produrrebbe due incrementi per un solo salvataggio.
           availability_configured_at  = v_now,
           updated_at                  = v_now
     where profile_id = v_uid
       and (p_expected_revision is null
            or availability_revision = p_expected_revision);

    get diagnostics v_rows = row_count;

    if v_rows = 0 then
      if exists (select 1 from public.player_profiles where profile_id = v_uid) then
        raise exception 'availability_areas_conflict';
      end if;

      raise exception 'availability_areas_profile_missing';
    end if;

  elsif v_role = 'coach'::public.app_role then
    update public.coach_profiles
       set availability_type           = v_mode,
           preferred_provinces         = v_provinces,
           preferred_regions           = v_regions,
           -- La revisione la bumpa il trigger (§2b): farlo anche qui
           -- produrrebbe due incrementi per un solo salvataggio.
           availability_configured_at  = v_now,
           updated_at                  = v_now
     where profile_id = v_uid
       and (p_expected_revision is null
            or availability_revision = p_expected_revision);

    get diagnostics v_rows = row_count;

    if v_rows = 0 then
      if exists (select 1 from public.coach_profiles where profile_id = v_uid) then
        raise exception 'availability_areas_conflict';
      end if;

      raise exception 'availability_areas_profile_missing';
    end if;

  else
    update public.staff_profiles
       set availability_type           = v_mode,
           preferred_provinces         = v_provinces,
           preferred_regions           = v_regions,
           -- La revisione la bumpa il trigger (§2b): farlo anche qui
           -- produrrebbe due incrementi per un solo salvataggio.
           availability_configured_at  = v_now,
           updated_at                  = v_now
     where profile_id = v_uid
       and (p_expected_revision is null
            or availability_revision = p_expected_revision);

    get diagnostics v_rows = row_count;

    if v_rows = 0 then
      if exists (select 1 from public.staff_profiles where profile_id = v_uid) then
        raise exception 'availability_areas_conflict';
      end if;

      raise exception 'availability_areas_profile_missing';
    end if;
  end if;

  -- La configurazione confermata torna dalla stessa proiezione che l'editor
  -- ha letto all'apertura: il client non ricostruisce lo stato dal payload
  -- che ha inviato (§18, punto 5).
  return query select * from public.fetch_profile_availability_areas();
end;
$$;

revoke all on function public.save_profile_availability_areas(text, text[], text[], integer) from public;
grant execute on function public.save_profile_availability_areas(text, text[], text[], integer) to authenticated;

comment on function public.save_profile_availability_areas(text, text[], text[], integer) is
  'DAS-REV-06 §18: patch atomica della sola disponibilità geografica. Non '
  'tocca toggle di disponibilità, badge di visibilità, categorie, carriera o '
  'contatti. Codici di errore: availability_areas_invalid_mode, '
  '_empty_scope, _hybrid_scope, _unknown_area, _conflict, _profile_missing, '
  '_not_applicable.';

-- ------------------------------------------------------------
-- 6. Segnali della Dashboard personale
-- ------------------------------------------------------------
--
-- La funzione è riscritta per intero perché le migrazioni sono append-only:
-- rispetto a 20261016090000 cambia **solo** il blocco del suggerimento
-- facoltativo, commentato sotto. Il resto del corpo è identico, riga per riga.

create or replace function public.fetch_dashboard_personal_overview()
returns table (
  active_applications_count integer,
  saved_positions_count     integer,
  priority_signals          jsonb,
  priority_total_count      integer,
  deadlines_total_count     integer,
  profile_requirements      jsonb,
  optional_suggestion       jsonb,
  policy                    jsonb,
  access_verified_at        timestamptz,
  data_revision             bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_now           timestamptz := timezone('utc', now());
  v_role          public.app_role;
  v_window_days   integer := public.dashboard_policy_days('deadline_promotion_window_days', 7);
  v_recency_days  integer := public.dashboard_policy_days('application_update_recency_days', 7);
  v_deadlines     jsonb := '[]'::jsonb;
  v_deadline_tot  integer := 0;
  v_requirements  jsonb := '[]'::jsonb;
  v_signals       jsonb := '[]'::jsonb;
  v_suggestion    jsonb := null;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select role into v_role from public.profiles where id = v_uid;

  -- ── Segnali di scadenza (§15) ─────────────────────────────────────────
  --
  -- Le otto condizioni di §15 stanno tutte qui dentro, nell'ordine in cui
  -- sono scritte: risorsa visibile e pubblicata, esplicitamente salvata,
  -- scadenza interpretabile (solo `application_deadline_at`, mai `deadline`),
  -- cutoff non ancora superato, dentro la finestra configurata, azione ancora
  -- accettata, PERSON autorizzata, nessuna candidatura già inviata.
  --
  -- Il confronto usa `v_now` del database, non l'orologio del dispositivo.
  with eligible as (
    select
      ra.id                                  as ad_id,
      ra.role_required::text                 as role,
      ra.title                               as ad_title,
      ra.application_deadline_at             as deadline_at,
      ra.application_deadline_timezone       as deadline_timezone,
      c.name                                 as club_name,
      ct.name                                as team_name,
      sa.created_at                          as saved_at
    from public.saved_ads sa
    join public.recruiting_ads ra on ra.id = sa.ad_id
    join public.clubs c on c.id = ra.club_id
    left join public.club_teams ct on ct.id = ra.team_id
    where sa.profile_id = v_uid
      and ra.status = 'published'
      and ra.application_deadline_at is not null
      and ra.application_deadline_at > v_now
      and ra.application_deadline_at <= v_now + make_interval(days => v_window_days)
      and (public.dashboard_position_action_state(ra.id) ->> 'can_apply')::boolean
  )
  select
    coalesce(
      (
        select jsonb_agg(signal order by (signal->>'deadline_at')::timestamptz, signal->>'target_id')
        from (
          select jsonb_build_object(
            'type_id',          'saved_deadline',
            'aggregation_key',  'saved_deadline:' || v_uid::text || ':' || eligible.ad_id::text,
            'target_kind',      'position',
            'target_id',        eligible.ad_id,
            'count',            1,
            'role',             eligible.role,
            'ad_title',         eligible.ad_title,
            'club_name',        eligible.club_name,
            'team_name',        eligible.team_name,
            'deadline_at',      eligible.deadline_at,
            'deadline_timezone', eligible.deadline_timezone,
            -- §15: ordinamento per cutoff più vicino. `occurred_at` resta
            -- l'istante del salvataggio: è l'unico evento reale associato,
            -- e serve solo come spareggio di recency.
            'occurred_at',      eligible.saved_at
          ) as signal
          from eligible
          order by eligible.deadline_at asc, eligible.ad_id asc
          -- §15: «Mostrare al massimo due scadenze.» Il cap è qui, nella
          -- fonte autorevole, non nel client.
          limit 2
        ) capped
      ),
      '[]'::jsonb
    ),
    (select count(*)::integer from eligible)
  into v_deadlines, v_deadline_tot;

  -- ── Requisiti obbligatori del profilo (§13) ───────────────────────────
  --
  -- «Le regole dipendono da ruolo, requisiti canonici e capability, non dal
  -- contenuto statico del mockup.» Il solo requisito canonico oggi
  -- realmente obbligatorio e realmente mancabile è il **ruolo principale**:
  --
  --   · Calciatore  `player_profiles.primary_position` è NOT NULL, quindi
  --                 manca solo se manca l'intera riga (profilo legacy);
  --   · Allenatore  `coach_profiles.primary_role` è nullable;
  --   · Staff       `staff_profiles.primary_staff_role` è nullable.
  --
  -- Nessun altro campo viene dichiarato obbligatorio: §13 vieta di inventare
  -- requisiti per riprodurre il mockup.
  if v_role = 'player'::public.app_role then
    if not exists (select 1 from public.player_profiles pp where pp.profile_id = v_uid) then
      v_requirements := jsonb_build_array(jsonb_build_object(
        'key',         'player_sport_profile',
        'description', 'Completa il tuo profilo sportivo.',
        'href',        '/profile/edit/technical'
      ));
    end if;

  elsif v_role = 'coach'::public.app_role then
    if not exists (
      select 1 from public.coach_profiles cp
      where cp.profile_id = v_uid and nullif(trim(coalesce(cp.primary_role, '')), '') is not null
    ) then
      v_requirements := jsonb_build_array(jsonb_build_object(
        'key',         'coach_primary_role',
        'description', 'Indica il tuo ruolo principale.',
        'href',        '/profile/coach-edit/technical'
      ));
    end if;

  elsif v_role = 'staff'::public.app_role then
    if not exists (
      select 1 from public.staff_profiles sp
      where sp.profile_id = v_uid and nullif(trim(coalesce(sp.primary_staff_role, '')), '') is not null
    ) then
      v_requirements := jsonb_build_array(jsonb_build_object(
        'key',         'staff_primary_role',
        'description', 'Indica il tuo ruolo principale.',
        'href',        '/profile/staff-edit/professional'
      ));
    end if;
  end if;

  if jsonb_array_length(v_requirements) > 0 then
    v_signals := v_deadlines || jsonb_build_array(jsonb_build_object(
      'type_id',         'profile_requirements_missing',
      'aggregation_key', 'profile_requirements_missing:' || v_uid::text,
      'target_kind',     'profile_section',
      'target_id',       v_uid,
      'count',           jsonb_array_length(v_requirements),
      -- Condizione di stato, non evento: non esiste un istante da usare come
      -- recency e inventarne uno (per esempio `now()`) la porterebbe sempre
      -- in cima. Resta l'epoch, cioè l'ultimo posto a parità di tutto il
      -- resto — il livello del tipo la fa comunque precedere gli informativi.
      'occurred_at',     '1970-01-01T00:00:00Z',
      'requirements',    v_requirements,
      -- Destinazione quando i requisiti sono più di uno: l'hub di modifica
      -- del ruolo li contiene tutti (§13: «Più informazioni obbligatorie
      -- confluiscono in un solo elemento con una destinazione coerente»).
      'hub_href',        case v_role
                           when 'coach'::public.app_role then '/profile/coach-edit'
                           when 'staff'::public.app_role then '/profile/staff-edit'
                           else '/profile/edit'
                         end
    ));
  else
    v_signals := v_deadlines;
  end if;

  -- ── Suggerimento facoltativo: aree geografiche (DAS-REV-06 §8) ───────
  --
  -- Due cambi rispetto a DAS-REV-03, entrambi richiesti dal testo di
  -- DAS-REV-06.
  --
  -- 1. **La pertinenza non si legge più dalla modalità persistita.** La
  --    regola precedente trattava `availability_type = 'ITALY'` come una
  --    configurazione valida, ma quella colonna è
  --    `not null default 'ITALY'` sul Calciatore e l'onboarding parte da
  --    "ITALY" senza che nessuno lo scelga: un profilo che non ha mai visto
  --    la schermata era indistinguibile da uno che ha scelto tutta Italia.
  --    §15 vieta esattamente questo ("Non preselezionare Tutta Italia per
  --    completare automaticamente un profilo privo di aree"), e §16 chiede
  --    di distinguere "dato realmente assente" da "dato valido". La
  --    distinzione ora è `availability_configured_at`: una configurazione
  --    esiste solo se qualcuno l'ha confermata.
  --
  -- 2. **Un solo suggerimento per profilo, e mai insieme ai requisiti.**
  --    §8: «Quando viene mostrato il gruppo Informazioni richieste, non
  --    aggiungere contemporaneamente una seconda card di suggerimenti sullo
  --    stesso profilo.» È anche la differenza fra lo screen 01 e lo screen
  --    02 del master. La raccomandazione non è risolta — resta accessibile
  --    dai moduli di modifica — soltanto non promossa.
  --
  -- La destinazione è l'editor focalizzato condiviso, non il modulo
  -- Opportunità del ruolo: §19 gli assegna il proprio punto di conferma e
  -- §12 la forma. Il componente e le API restano comunque condivisi con
  -- Profilo e onboarding (§11).
  if jsonb_array_length(v_requirements) = 0
     and v_role in ('player'::public.app_role,
                    'coach'::public.app_role,
                    'staff'::public.app_role)
  then
    select case
      when a.configured_at is null
        then jsonb_build_object(
          'key',  'availability_areas',
          'href', '/profile/availability-areas'
        )
      else null
    end
    into v_suggestion
    from public.profile_availability_areas(v_uid) a;
  end if;


  return query
  select
    -- §8: il conteggio viene dal dominio, non dalla lunghezza delle preview,
    -- e ha lo stesso perimetro della destinazione Attive che la metrica apre.
    -- DAS-REV-04 §6: una selezione conclusa toglie la candidatura dalle
    -- attive anche quando il suo stato resta "In valutazione"; la chiusura
    -- dell'annuncio alle nuove candidature, invece, non la tocca.
    (
      select count(*)::integer
      from public.recruiting_applications app
      join public.recruiting_ads ra on ra.id = app.ad_id
      where app.applicant_profile_id = v_uid
        and public.application_group(app.status, ra.selection_completed_at) = 'active'
    ) as active_applications_count,

    -- DAS-REV-05 §8: la metrica è "Salvate disponibili" e conta le sole
    -- posizioni salvate ancora classificate disponibili. Stesso perimetro
    -- della destinazione che apre (CER → Salvate → Disponibili).
    --
    -- Le non più disponibili restano consultabili nell'altro filtro: §8
    -- vieta un terzo KPI storico, non la loro esistenza. Il conteggio non
    -- cambia perché l'utente si è già candidato (§7) né perché una row è
    -- nascosta dal ranking.
    (
      select count(*)::integer
      from public.saved_positions_base(v_uid) sp
      where sp.availability_group = 'available'
    ) as saved_positions_count,

    v_signals as priority_signals,
    (
      v_deadline_tot
      + case when jsonb_array_length(v_requirements) > 0 then 1 else 0 end
    )::integer as priority_total_count,
    v_deadline_tot as deadlines_total_count,
    v_requirements as profile_requirements,
    v_suggestion as optional_suggestion,

    jsonb_build_object(
      'deadline_promotion_window_days', v_window_days,
      'application_update_recency_days', v_recency_days
    ) as policy,

    v_now as access_verified_at,
    (extract(epoch from v_now) * 1000)::bigint as data_revision;
end;
$$;

revoke all on function public.fetch_dashboard_personal_overview() from public;
grant execute on function public.fetch_dashboard_personal_overview() to authenticated;

comment on function public.fetch_dashboard_personal_overview() is
  'DAS-REV-06 §8: il suggerimento geografico nasce da '
  'availability_configured_at, non dalla modalità persistita, e non viene '
  'promosso quando esistono informazioni richieste. Apre l''editor '
  'focalizzato condiviso /profile/availability-areas.';
