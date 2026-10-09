-- ============================================================
-- DAS-REV-03 — Dashboard personale: overview e priorità
--
-- DAS-REV-01/02 hanno lasciato la Dashboard personale su tre select dirette
-- del client (`personal-adapter.ts`). Reggevano due contatori e due preview;
-- non reggono i requisiti di DAS-REV-03:
--
--   · §14 richiede una scadenza **non ambigua** dell'opportunità. Il dominio
--     ha oggi `recruiting_ads.deadline date`: una data locale senza istante
--     né fuso, che §14 vieta esplicitamente di interpretare assumendo
--     mezzanotte o fine giornata.
--   · §15 richiede che eligibility, autorizzazione e confronto temporale
--     siano **server-side**: «Il client non deve essere source of truth per
--     eligibility o autorizzazione» e «Non autorizzare azioni in base al solo
--     orologio del dispositivo».
--   · §11 richiede eventi professionali reali e vieta di usare `updated_at`
--     del record come data di un aggiornamento.
--   · §15/§11 richiedono finestre (promozione, recency) **configurate
--     centralmente e modificabili senza release frontend**.
--   · §17 richiede che il backend rivalidi il cutoff alla finalizzazione.
--
-- Questa migrazione aggiunge, in ordine:
--
--   1. `dashboard_policies`          — finestre configurabili senza release.
--   2. `recruiting_ads.application_deadline_at` (+ fuso) — istante canonico,
--      nullable e retrocompatibile. `deadline` resta dov'è e resta ambigua:
--      non viene promossa e non viene convertita d'ufficio (§27).
--   3. `recruiting_application_events` + trigger — gli eventi professionali
--      che "Aggiornamenti recenti" mostra.
--   4. trigger di rivalidazione del cutoff all'invio candidatura (§17).
--   5. `dashboard_position_action_state` — action type ed eligibility di una
--      opportunità per l'utente corrente, usata sia dalla Dashboard sia dal
--      dettaglio.
--   6. `fetch_dashboard_personal_overview` — riepilogo, segnali, requisiti,
--      preview candidature e aggiornamenti recenti.
--   7. `fetch_dashboard_personal_saved_positions` — provider indipendente
--      delle Posizioni salvate, così il suo fallimento resta locale (§22).
--
-- Nessun permesso nuovo, nessuna visibilità allargata: le due RPC leggono
-- esclusivamente risorse dell'utente autenticato (`auth.uid()`), che la RLS
-- gli consente già di leggere una per una.
--
-- Rollback: droppare le due RPC, la funzione di action state, i due trigger,
-- la tabella eventi e la tabella policy; droppare le due colonne di
-- `recruiting_ads`. Nessun dato preesistente viene modificato o migrato, e
-- la Dashboard torna alle select dirette del client.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — public.dashboard_policies
--
-- §15: «La finestra è configurata centralmente e modificabile senza release
-- frontend.» §11: «Se manca una finestra di recency, prevedere un default V1
-- centralizzato di sette giorni […]; non hardcodarlo nei client e
-- documentarlo.»
--
-- Tabella minima chiave → giorni. Leggibile da chiunque sia autenticato
-- (non è un dato sensibile e il client ne mostra l'effetto), scrivibile solo
-- da migrazione o service role: nessuna policy di insert/update/delete.
-- ============================================================

create table if not exists public.dashboard_policies (
  policy_key  text primary key,
  int_value   integer not null,
  description text,
  updated_at  timestamptz not null default timezone('utc', now())
);

alter table public.dashboard_policies enable row level security;

drop policy if exists "dashboard policies readable by authenticated" on public.dashboard_policies;
create policy "dashboard policies readable by authenticated"
  on public.dashboard_policies
  for select
  to authenticated
  using (true);

insert into public.dashboard_policies (policy_key, int_value, description)
values
  (
    'deadline_promotion_window_days',
    7,
    'DAS-REV-03 §15: finestra entro cui una scadenza reale di una risorsa '
    'salvata può essere promossa in "Da gestire". Default V1 = 7 giorni.'
  ),
  (
    'application_update_recency_days',
    7,
    'DAS-REV-03 §11: finestra di recency degli aggiornamenti professionali '
    'mostrati in "Aggiornamenti recenti". Default V1 = 7 giorni dall''ultimo '
    'evento significativo.'
  )
on conflict (policy_key) do nothing;

comment on table public.dashboard_policies is
  'DAS-REV-03: finestre temporali della Dashboard, modificabili senza una '
  'release del frontend (§11, §15). Sola lettura per gli utenti autenticati.';

create or replace function public.dashboard_policy_days(
  p_key     text,
  p_default integer
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select int_value from public.dashboard_policies where policy_key = p_key),
    p_default
  );
$$;

revoke all on function public.dashboard_policy_days(text, integer) from public;
grant execute on function public.dashboard_policy_days(text, integer) to authenticated;


-- ============================================================
-- SEZIONE 2 — scadenza canonica dell'opportunità
--
-- §14: «Riutilizzare un campo canonico equivalente a registration_deadline_at
-- o application_deadline_at. Se manca soltanto il campo in un dominio già
-- compatibile, introdurre un'estensione nullable e retrocompatibile nel
-- dominio proprietario. Non creare dashboard_deadline come seconda fonte di
-- verità.»
--
-- `recruiting_ads.deadline date` **resta**: è usata da Cerca (CER-01/CER-04)
-- ed è parte del contratto di quelle superfici. Non viene convertita: una
-- data locale non contiene l'istante, e §14 vieta di inventarlo («Per un
-- valore ambiguo, non inventare l'istante né promuovere il reminder come
-- affidabile»). Un'opportunità con la sola `deadline` è quindi visibile nei
-- Salvati ma **non promuovibile**.
--
-- `application_deadline_timezone` serve al dettaglio (§14: «Nel dettaglio
-- aggiungere anno e, quando rilevante per comprendere il cutoff, ora e
-- fuso»): senza di esso il client mostrerebbe l'ora nel fuso del telefono,
-- che è un'altra cosa.
-- ============================================================

alter table public.recruiting_ads
  add column if not exists application_deadline_at timestamptz;

alter table public.recruiting_ads
  add column if not exists application_deadline_timezone text;

comment on column public.recruiting_ads.application_deadline_at is
  'DAS-REV-03 §14: istante non ambiguo oltre il quale la candidatura non è '
  'più accettata. Nullable: la scadenza resta facoltativa e le normali '
  'posizioni non ne hanno una. Distinta da `deadline`, che è una data locale '
  'senza cutoff definito e non viene promossa.';

comment on column public.recruiting_ads.application_deadline_timezone is
  'DAS-REV-03 §14: fuso in cui il cutoff è stato espresso, per mostrare ora '
  'e fuso nel dettaglio quando sono rilevanti.';

create index if not exists recruiting_ads_application_deadline_idx
  on public.recruiting_ads (application_deadline_at)
  where application_deadline_at is not null;


-- ============================================================
-- SEZIONE 3 — eventi professionali della candidatura
--
-- §11: «Non usare indiscriminatamente updated_at del record come data di un
-- aggiornamento professionale» e «Separare: stato corrente; evento
-- significativo; data dell'evento».
--
-- Il dominio non aveva una storia: `recruiting_applications.updated_at` si
-- muove per qualunque scrittura. Questa tabella registra solo le transizioni
-- di stato, che sono gli unici eventi professionali che il dominio conosce
-- oggi.
--
-- Nessun backfill: §27 vieta di inventare dati durante una migrazione. Le
-- candidature già cambiate di stato prima di questa migrazione non hanno
-- eventi, quindi non compaiono in "Aggiornamenti recenti" — il che è
-- corretto, perché la loro data di transizione non è recuperabile.
-- ============================================================

create table if not exists public.recruiting_application_events (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruiting_applications(id) on delete cascade,
  from_status    public.application_status,
  to_status      public.application_status not null,
  occurred_at    timestamptz not null default timezone('utc', now())
);

create index if not exists recruiting_application_events_app_idx
  on public.recruiting_application_events (application_id, occurred_at desc);

alter table public.recruiting_application_events enable row level security;

-- Il candidato legge la storia della propria candidatura. Nessuna policy di
-- scrittura: le righe nascono solo dal trigger, che gira come owner.
drop policy if exists "applicants read own application events" on public.recruiting_application_events;
create policy "applicants read own application events"
  on public.recruiting_application_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.recruiting_applications app
      where app.id = recruiting_application_events.application_id
        and app.applicant_profile_id = auth.uid()
    )
  );

comment on table public.recruiting_application_events is
  'DAS-REV-03 §11: transizioni di stato di una candidatura, con l''istante '
  'reale dell''evento. È la fonte di "Aggiornamenti recenti": updated_at del '
  'record non lo è, perché si muove per qualunque scrittura.';

create or replace function public.log_recruiting_application_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `is distinct from` e non `<>`: una scrittura che non cambia lo stato non
  -- è un evento, e §11 vieta che consegne duplicate producano righe doppie.
  if old.status is distinct from new.status then
    insert into public.recruiting_application_events (
      application_id, from_status, to_status, occurred_at
    )
    values (new.id, old.status, new.status, timezone('utc', now()));
  end if;

  return new;
end;
$$;

drop trigger if exists recruiting_applications_log_event on public.recruiting_applications;
create trigger recruiting_applications_log_event
  after update of status on public.recruiting_applications
  for each row
  execute function public.log_recruiting_application_event();


-- ============================================================
-- SEZIONE 4 — rivalidazione del cutoff all'invio (§17)
--
-- «Gestire il caso di dettaglio aperto prima della scadenza e invio
-- successivo. Restituire il feedback di dominio, senza falsa conferma.»
--
-- Il client inserisce direttamente in `recruiting_applications`: senza questo
-- trigger un dettaglio aperto prima del cutoff accetterebbe l'invio dopo. La
-- visibilità e il "già candidato" sono già coperti dalla RLS e dal vincolo
-- unique (ad_id, applicant_profile_id).
-- ============================================================

create or replace function public.enforce_application_submission_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad public.recruiting_ads%rowtype;
begin
  select * into v_ad
  from public.recruiting_ads
  where id = new.ad_id;

  if not found then
    raise exception 'Questa posizione non è più disponibile.';
  end if;

  if v_ad.status <> 'published' then
    raise exception 'Questa posizione non accetta più candidature.';
  end if;

  if v_ad.application_deadline_at is not null
     and timezone('utc', now()) >= v_ad.application_deadline_at then
    raise exception 'Il termine per candidarsi è scaduto.';
  end if;

  return new;
end;
$$;

drop trigger if exists recruiting_applications_submission_window on public.recruiting_applications;
create trigger recruiting_applications_submission_window
  before insert on public.recruiting_applications
  for each row
  execute function public.enforce_application_submission_window();


-- ============================================================
-- SEZIONE 5 — public.dashboard_position_action_state
--
-- Eligibility e action type di una singola opportunità per l'utente corrente
-- (§15, §17). Una sola definizione, usata dalla Dashboard (per decidere se
-- promuovere il reminder) e dal dettaglio (per decidere la CTA): due
-- definizioni divergerebbero al primo cambiamento.
--
-- `action_type` è `apply` o `none`. `register` esiste nel vocabolario di
-- §17 ma non nel progetto: il dominio Eventi/provini è dei pack DAS-REV-28–31
-- e §16 vieta di implementarlo in anticipo. Finché non esiste, nessuna
-- risorsa restituisce `register` e nessuna CTA "Iscriviti" viene disegnata.
--
-- `can_apply` è vero solo se **tutte** le condizioni di §15 reggono, inclusa
-- quella che il dominio oggi non supera per Allenatori e Staff:
-- `recruiting_applications.player_profile_id` è NOT NULL e referenzia
-- `player_profiles`, quindi solo un Calciatore con profilo sportivo può
-- candidarsi. Questa funzione lo dichiara invece di nasconderlo.
-- ============================================================

create or replace function public.dashboard_position_action_state(p_ad_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_ad        public.recruiting_ads%rowtype;
  v_role      public.app_role;
  v_applied   boolean;
  v_is_player boolean;
  v_can_apply boolean;
  v_reason    text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_ad from public.recruiting_ads where id = p_ad_id;

  if not found or v_ad.status <> 'published' then
    return jsonb_build_object(
      'action_type',      'none',
      'can_apply',        false,
      'already_applied',  false,
      'is_open',          false,
      'deadline_at',      null,
      'deadline_timezone', null,
      'reason',           'not_available'
    );
  end if;

  select role into v_role from public.profiles where id = v_uid;

  v_applied := exists (
    select 1
    from public.recruiting_applications app
    where app.ad_id = p_ad_id
      and app.applicant_profile_id = v_uid
      and app.status <> 'withdrawn'
  );

  v_is_player := exists (
    select 1 from public.player_profiles pp where pp.profile_id = v_uid
  );

  v_can_apply :=
    not v_applied
    and v_is_player
    and v_role = 'player'::public.app_role
    and coalesce(v_ad.target_role, 'player') = 'player'
    and (
      v_ad.application_deadline_at is null
      or timezone('utc', now()) < v_ad.application_deadline_at
    );

  v_reason := case
    when v_applied then 'already_applied'
    when v_ad.application_deadline_at is not null
         and timezone('utc', now()) >= v_ad.application_deadline_at then 'deadline_passed'
    when not v_is_player or v_role <> 'player'::public.app_role then 'role_not_supported'
    else null
  end;

  return jsonb_build_object(
    'action_type',       case when v_can_apply then 'apply' else 'none' end,
    'can_apply',         v_can_apply,
    'already_applied',   v_applied,
    'is_open',           true,
    'deadline_at',       v_ad.application_deadline_at,
    'deadline_timezone', v_ad.application_deadline_timezone,
    'reason',            v_reason
  );
end;
$$;

revoke all on function public.dashboard_position_action_state(uuid) from public;
grant execute on function public.dashboard_position_action_state(uuid) to authenticated;

comment on function public.dashboard_position_action_state(uuid) is
  'DAS-REV-03 §15/§17: action type ed eligibility di un''opportunità per '
  'l''utente autenticato. `action_type` = apply | none; `register` non è '
  'emesso perché il dominio Eventi/provini non esiste (pack DAS-REV-28–31).';


-- ============================================================
-- SEZIONE 6 — public.fetch_dashboard_personal_overview
--
-- Provider primario della composizione personale: riepilogo, segnali
-- prioritari, requisiti di profilo, suggerimento facoltativo, preview
-- candidature e aggiornamenti recenti.
--
-- Una sola richiesta per queste sei cose perché condividono la stessa fonte
-- (§21: «Non duplicare richieste quando summary, segnali e preview
-- condividono la stessa fonte»). Le Posizioni salvate restano fuori: hanno
-- un provider proprio, così il loro errore è locale (§22).
--
-- Ogni colonna è calcolata sulle sole risorse di `auth.uid()`. Non esiste un
-- parametro di identità: §22 chiede di impedire richieste con person_id
-- altrui, e il modo più solido è non accettarlo affatto.
-- ============================================================

create or replace function public.fetch_dashboard_personal_overview()
returns table (
  active_applications_count integer,
  saved_positions_count     integer,
  applications_preview      jsonb,
  recent_updates            jsonb,
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

  -- ── Suggerimento facoltativo: aree geografiche (§19) ──────────────────
  --
  -- Facoltativo per costruzione: nessuna di queste colonne è obbligatoria.
  -- Per il Calciatore l'ambito ITALY è già una configurazione valida, quindi
  -- non produce suggerimento; per Allenatore e Staff `availability_type` è
  -- nullable e un valore assente significa "aree non configurate".
  if v_role = 'player'::public.app_role then
    select case
      when pp.availability_type = 'REGIONS' and coalesce(array_length(pp.transfer_regions, 1), 0) = 0
        then jsonb_build_object('key', 'availability_areas', 'href', '/profile/edit/opportunities')
      when pp.availability_type = 'PROVINCES' and coalesce(array_length(pp.transfer_provinces, 1), 0) = 0
        then jsonb_build_object('key', 'availability_areas', 'href', '/profile/edit/opportunities')
      else null
    end
    into v_suggestion
    from public.player_profiles pp
    where pp.profile_id = v_uid;

  elsif v_role = 'coach'::public.app_role then
    select case
      when coalesce(array_length(cp.preferred_regions, 1), 0) = 0
       and coalesce(array_length(cp.preferred_provinces, 1), 0) = 0
       and coalesce(cp.availability_type, '') <> 'ITALY'
        then jsonb_build_object('key', 'availability_areas', 'href', '/profile/coach-edit/opportunities')
      else null
    end
    into v_suggestion
    from public.coach_profiles cp
    where cp.profile_id = v_uid;

  elsif v_role = 'staff'::public.app_role then
    select case
      when coalesce(array_length(sp.preferred_regions, 1), 0) = 0
       and coalesce(array_length(sp.preferred_provinces, 1), 0) = 0
       and coalesce(sp.availability_type, '') <> 'ITALY'
        then jsonb_build_object('key', 'availability_areas', 'href', '/profile/staff-edit/opportunities')
      else null
    end
    into v_suggestion
    from public.staff_profiles sp
    where sp.profile_id = v_uid;
  end if;

  return query
  select
    -- §7: i conteggi vengono dal dominio, non dalla lunghezza delle preview.
    (
      select count(*)::integer
      from public.recruiting_applications app
      where app.applicant_profile_id = v_uid
        and app.status in ('submitted', 'reviewing', 'shortlisted')
    ) as active_applications_count,

    -- Stesso perimetro della destinazione che la metrica apre
    -- (/saved?filter=position): tutte le posizioni salvate, non solo quelle
    -- ancora pubblicate (§7).
    (
      select count(*)::integer
      from public.saved_ads sa
      where sa.profile_id = v_uid
    ) as saved_positions_count,

    -- §9: la row privilegia il ruolo della posizione, poi società e squadra.
    -- `last_event_*` è il metadato di aggiornamento significativo: separato
    -- dallo stato corrente, come §11 richiede.
    coalesce((
      select jsonb_agg(item order by item->>'sort_at' desc)
      from (
        select jsonb_build_object(
          'id',               app.id,
          'ad_id',            ra.id,
          'role',             ra.role_required::text,
          'club_name',        c.name,
          'club_logo_url',    c.logo_url,
          'team_name',        ct.name,
          'category',         coalesce(ct.category, ra.category),
          'status',           app.status,
          'created_at',       app.created_at,
          'last_event_at',    ev.occurred_at,
          'last_event_to',    ev.to_status,
          -- Ordinamento server-driven (§9): un aggiornamento significativo
          -- può rendere rilevante una candidatura meno recente.
          'sort_at',          greatest(app.created_at, coalesce(ev.occurred_at, app.created_at))
        ) as item
        from public.recruiting_applications app
        join public.recruiting_ads ra on ra.id = app.ad_id
        join public.clubs c on c.id = ra.club_id
        left join public.club_teams ct on ct.id = ra.team_id
        left join lateral (
          select e.occurred_at, e.to_status
          from public.recruiting_application_events e
          where e.application_id = app.id
          order by e.occurred_at desc
          limit 1
        ) ev on true
        where app.applicant_profile_id = v_uid
          and app.status <> 'withdrawn'
        order by greatest(app.created_at, coalesce(ev.occurred_at, app.created_at)) desc
        -- §6: preview candidature normalmente due, massimo tre.
        limit 3
      ) preview
    ), '[]'::jsonb) as applications_preview,

    -- §11: eventi professionali già avvenuti, dentro la finestra di recency.
    -- `distinct on` tiene un solo evento per candidatura: più eventi della
    -- stessa candidatura si aggregano nell'ultimo, e consegne duplicate non
    -- producono righe doppie.
    coalesce((
      select jsonb_agg(item order by item->>'occurred_at' desc)
      from (
        select jsonb_build_object(
          'application_id', app.id,
          'ad_id',          ra.id,
          'role',           ra.role_required::text,
          'club_name',      c.name,
          'club_logo_url',  c.logo_url,
          'team_name',      ct.name,
          'status',         app.status,
          'event_status',   ev.to_status,
          'occurred_at',    ev.occurred_at
        ) as item
        from (
          select distinct on (e.application_id)
            e.application_id, e.to_status, e.occurred_at
          from public.recruiting_application_events e
          join public.recruiting_applications a on a.id = e.application_id
          where a.applicant_profile_id = v_uid
            and e.occurred_at >= v_now - make_interval(days => v_recency_days)
          order by e.application_id, e.occurred_at desc
        ) ev
        join public.recruiting_applications app on app.id = ev.application_id
        join public.recruiting_ads ra on ra.id = app.ad_id
        join public.clubs c on c.id = ra.club_id
        left join public.club_teams ct on ct.id = ra.team_id
        order by ev.occurred_at desc
        -- §6: Aggiornamenti recenti, massimo due row.
        limit 2
      ) updates
    ), '[]'::jsonb) as recent_updates,

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
  'DAS-REV-03: composizione personale della Dashboard per l''utente '
  'autenticato — riepilogo, segnali prioritari (scadenze reali e requisiti '
  'obbligatori), suggerimento facoltativo, preview candidature e '
  'aggiornamenti recenti. Nessun parametro di identità: opera solo su '
  'auth.uid() (§22).';


-- ============================================================
-- SEZIONE 7 — public.fetch_dashboard_personal_saved_positions
--
-- Provider indipendente del modulo "Posizioni salvate" (§22): il suo
-- fallimento deve restare locale al modulo mentre riepilogo, candidature e
-- aggiornamenti restano utilizzabili.
--
-- §10 vieta nella preview scadenza, descrizione, requisiti, numero di
-- candidati e punteggio: non sono nel payload. Un campo restituito è un
-- campo che prima o poi qualcuno disegna.
-- ============================================================

create or replace function public.fetch_dashboard_personal_saved_positions()
returns table (
  ad_id         uuid,
  role          text,
  club_id       uuid,
  club_name     text,
  club_logo_url text,
  team_name     text,
  category      text,
  location      text,
  is_available  boolean,
  saved_at      timestamptz
)
language plpgsql
stable
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
    ra.id                              as ad_id,
    ra.role_required::text             as role,
    c.id                               as club_id,
    c.name                             as club_name,
    c.logo_url                         as club_logo_url,
    ct.name                            as team_name,
    coalesce(ct.category, ra.category) as category,
    -- Località pubblica: città e regione della Società. §22 vieta indirizzi
    -- completi nei DTO Dashboard.
    nullif(
      concat_ws(', ', nullif(trim(c.city), ''), nullif(trim(c.region), '')),
      ''
    )                                  as location,
    (ra.status = 'published')          as is_available,
    sa.created_at                      as saved_at
  from public.saved_ads sa
  join public.recruiting_ads ra on ra.id = sa.ad_id
  join public.clubs c on c.id = ra.club_id
  left join public.club_teams ct on ct.id = ra.team_id
  where sa.profile_id = v_uid
  order by sa.created_at desc
  -- §6: preview Salvate normalmente due, massimo tre.
  limit 3;
end;
$$;

revoke all on function public.fetch_dashboard_personal_saved_positions() from public;
grant execute on function public.fetch_dashboard_personal_saved_positions() to authenticated;

comment on function public.fetch_dashboard_personal_saved_positions() is
  'DAS-REV-03 §10/§22: preview delle Posizioni salvate dall''utente '
  'autenticato. Provider separato dal riepilogo perché il suo fallimento '
  'deve restare locale al modulo. Nessuna scadenza nel payload: §10 la '
  'esclude dalla preview ordinaria.';
