-- ============================================================
-- DAS-REV-05 — Widget Posizioni salvate
--
-- Quattro concetti restano separati (§6): esistenza del bookmark,
-- disponibilità della Position, lifecycle della candidatura e lifecycle del
-- processo di selezione. Questa migrazione tocca **solo il secondo**: nessuna
-- riga di `saved_ads` e nessuna `recruiting_application` viene scritta,
-- spostata o cancellata da qui.
--
-- Che cosa introduce:
--
--   1. la classificazione canonica di disponibilità, in un posto solo
--      (`recruiting_ad_is_available` / `recruiting_ad_unavailable_reason`);
--   2. gli eventi di transizione, perché §14 chiede un riferimento stabile
--      per deduplicare gli aggiornamenti e §17 una data reale di chiusura;
--   3. `saved_positions_base`, la proiezione condivisa da widget e lista —
--      una sola fonte di verità, non due query che divergono (§22);
--   4. il provider del widget, con conteggi separati dalle preview (§8);
--   5. `fetch_saved_positions_page`, la lista CER con i due gruppi (§15);
--   6. il riallineamento di `saved_positions_count` alla nuova metrica
--      "Salvate disponibili" (§8).
--
-- Nessun backfill (§14, §25): gli eventi nascono da qui in avanti. Le
-- posizioni chiuse prima di questa migrazione restano nei Salvati, nel gruppo
-- corretto, ma senza data di chiusura — §17 vieta di inventarla.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — disponibilità canonica (§7)
--
-- «La classificazione deve provenire dal dominio Position o da una sua
-- proiezione condivisa.» Le condizioni canoniche che il dominio conosce oggi
-- sono due: l'annuncio è pubblicato e il cutoff degli invii non è passato.
--
-- `can_apply` **non** entra qui: §7 lo vieta esplicitamente, perché è falso
-- anche per una candidatura già inviata o per un requisito personale
-- mancante, e nessuna delle due chiude la posizione.
--
-- `recruiting_ads.deadline` (date, senza istante né fuso) resta fuori: non è
-- un cutoff interpretabile e DAS-REV-03 §14 ha già deciso di non promuoverla.
-- Dedurne una scadenza qui significherebbe inventare una chiusura.
-- ============================================================

create or replace function public.recruiting_ad_is_available(
  p_status      public.ad_status,
  p_deadline_at timestamptz
)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_status = 'published'
     and (p_deadline_at is null or timezone('utc', now()) < p_deadline_at);
$$;

comment on function public.recruiting_ad_is_available(public.ad_status, timestamptz) is
  'DAS-REV-05 §7: una Position è disponibile quando è pubblicata e accetta '
  'ancora candidature. Non dipende dall''utente: autorizzazione alla lettura '
  'e possibilità della singola azione sono altre tre cose.';

create or replace function public.recruiting_ad_unavailable_reason(
  p_status      public.ad_status,
  p_deadline_at timestamptz
)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when public.recruiting_ad_is_available(p_status, p_deadline_at) then null
    when p_status = 'closed'  then 'closed'
    when p_status = 'draft'   then 'withdrawn'
    else 'deadline_passed'
  end;
$$;

comment on function public.recruiting_ad_unavailable_reason(public.ad_status, timestamptz) is
  'DAS-REV-05 §7: motivazione strutturata e autorizzata. Enumerata, mai '
  'testo libero: §7 vieta di rivelare blocchi o informazioni riservate '
  'attraverso label troppo specifiche.';


-- ============================================================
-- SEZIONE 2 — eventi di disponibilità (§14)
--
-- «Ogni aggiornamento deve poter essere riconosciuto stabilmente attraverso
-- risorsa/bookmark e transizione o revisione.»
--
-- Il dominio non aveva una storia della disponibilità: `recruiting_ads.
-- updated_at` si muove per qualunque scrittura e §17 vieta di usarlo come
-- data di chiusura. Questa tabella registra le sole transizioni reali.
--
-- Il passaggio per scadenza **non** produce una riga: non c'è un UPDATE da
-- intercettare quando il tempo passa. Non serve: in quel caso la data
-- affidabile esiste già ed è `application_deadline_at` (§17).
-- ============================================================

create table if not exists public.recruiting_ad_availability_events (
  id          uuid primary key default gen_random_uuid(),
  ad_id       uuid not null references public.recruiting_ads(id) on delete cascade,
  transition  text not null check (transition in ('became_unavailable', 'became_available')),
  reason      text,
  occurred_at timestamptz not null default timezone('utc', now())
);

create index if not exists recruiting_ad_availability_events_ad_idx
  on public.recruiting_ad_availability_events (ad_id, occurred_at desc);

alter table public.recruiting_ad_availability_events enable row level security;

-- Legge gli eventi chi ha salvato quella posizione: l'aggiornamento riguarda
-- il suo bookmark. Nessuna policy di scrittura — le righe nascono solo dal
-- trigger, che gira come owner.
drop policy if exists "savers read availability events" on public.recruiting_ad_availability_events;
create policy "savers read availability events"
  on public.recruiting_ad_availability_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.saved_ads sa
      where sa.ad_id = recruiting_ad_availability_events.ad_id
        and sa.profile_id = auth.uid()
    )
  );

comment on table public.recruiting_ad_availability_events is
  'DAS-REV-05 §14: transizioni di disponibilità di un annuncio. Riferimento '
  'stabile per deduplicare gli aggiornamenti, riconciliare una riapertura e '
  'datare una chiusura. Nessun backfill: le righe esistono da 20261016 in '
  'avanti.';

create or replace function public.log_ad_availability_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was        boolean;
  v_is         boolean;
  v_transition text;
  v_last       text;
begin
  v_was := public.recruiting_ad_is_available(old.status, old.application_deadline_at);
  v_is  := public.recruiting_ad_is_available(new.status, new.application_deadline_at);

  -- Nessun cambio di classificazione: nessun evento. Un UPDATE che riscrive
  -- `status = 'closed'` su una posizione già chiusa è lo stesso fatto, e §12
  -- vieta il doppio decremento quando lo stesso evento arriva più volte.
  if v_was is not distinct from v_is then
    return new;
  end if;

  v_transition := case when v_is then 'became_available' else 'became_unavailable' end;

  select e.transition into v_last
  from public.recruiting_ad_availability_events e
  where e.ad_id = new.id
  order by e.occurred_at desc, e.id desc
  limit 1;

  -- Seconda rete di sicurezza: due transizioni identiche di fila sarebbero
  -- la stessa transizione consegnata due volte (§14).
  if v_last is not null and v_last = v_transition then
    return new;
  end if;

  insert into public.recruiting_ad_availability_events (ad_id, transition, reason)
  values (
    new.id,
    v_transition,
    public.recruiting_ad_unavailable_reason(new.status, new.application_deadline_at)
  );

  return new;
end;
$$;

drop trigger if exists recruiting_ads_availability_events on public.recruiting_ads;
create trigger recruiting_ads_availability_events
after update of status, application_deadline_at on public.recruiting_ads
for each row
execute function public.log_ad_availability_events();


-- ============================================================
-- SEZIONE 3 — proiezione condivisa dei Salvati (§22)
--
-- «Classificazione derivata o proiezione persistita sono entrambe possibili
-- se autorevoli, aggiornabili e condivise. Non mantenere una seconda fonte di
-- verità.»
--
-- Derivata, e in un posto solo: widget e lista CER leggono entrambi da qui,
-- quindi un conteggio e una riga non possono raccontare cose diverse.
--
-- `p_uid` non è esposto: la funzione non è eseguibile da `authenticated` e i
-- soli chiamanti sono le RPC sotto, che passano `auth.uid()`. §26 chiede che
-- una PERSON non possa leggere i bookmark di un'altra cambiando un parametro.
-- ============================================================

create or replace function public.saved_positions_base(p_uid uuid)
returns table (
  ad_id              uuid,
  role               text,
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  team_name          text,
  category           text,
  location           text,
  availability_group text,
  unavailable_reason text,
  unavailable_at     timestamptz,
  has_applied        boolean,
  is_navigable       boolean,
  saved_at           timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ra.id                                      as ad_id,
    ra.role_required::text                     as role,
    c.id                                       as club_id,
    c.name                                     as club_name,
    c.logo_url                                 as club_logo_url,
    ct.name                                    as team_name,
    coalesce(ct.category, ra.category)         as category,
    -- Località pubblica della Società: città e regione, mai l'indirizzo
    -- (§22). In produzione è la località canonica della posizione: §3 vieta
    -- di ricavarla dal nome del club o di correggerla con una regola ad hoc.
    nullif(
      concat_ws(
        ' · ',
        nullif(trim(coalesce(ct.city, c.city)), ''),
        nullif(trim(coalesce(ct.region, c.region)), '')
      ),
      ''
    )                                          as location,
    case
      when public.recruiting_ad_is_available(ra.status, ra.application_deadline_at)
      then 'available'
      else 'unavailable'
    end                                        as availability_group,
    public.recruiting_ad_unavailable_reason(ra.status, ra.application_deadline_at)
                                               as unavailable_reason,
    -- §17: «Preferire la data affidabile in cui la posizione è diventata
    -- indisponibile.» Per una scadenza superata quella data è il cutoff
    -- stesso; per una chiusura è l'evento. Senza nessuna delle due resta
    -- null, e il client mostra la data di salvataggio etichettata — mai una
    -- data inventata.
    case
      when public.recruiting_ad_is_available(ra.status, ra.application_deadline_at)
        then null
      when ra.status = 'published' and ra.application_deadline_at is not null
        then ra.application_deadline_at
      else ev.occurred_at
    end                                        as unavailable_at,
    -- §26: riguarda **solo** la candidatura dell'utente autorizzato.
    exists (
      select 1
      from public.recruiting_applications app
      where app.ad_id = ra.id
        and app.applicant_profile_id = p_uid
        and app.status <> 'withdrawn'
    )                                          as has_applied,
    -- §16: la row è un link solo se il dettaglio esiste ed è accessibile.
    -- Una posizione ritirata dalla pubblicazione non è leggibile nel
    -- dettaglio, quindi la sua row storica non è navigabile e non mostra il
    -- chevron. «Non mostrare una navigazione che sappiamo già condurre a un
    -- errore.»
    (ra.status <> 'draft')                     as is_navigable,
    sa.created_at                              as saved_at
  from public.saved_ads sa
  join public.recruiting_ads ra on ra.id = sa.ad_id
  join public.clubs c on c.id = ra.club_id
  left join public.club_teams ct on ct.id = ra.team_id
  left join lateral (
    select e.occurred_at
    from public.recruiting_ad_availability_events e
    where e.ad_id = ra.id
      and e.transition = 'became_unavailable'
    order by e.occurred_at desc, e.id desc
    limit 1
  ) ev on true
  where sa.profile_id = p_uid;
$$;

revoke all on function public.saved_positions_base(uuid) from public;
revoke all on function public.saved_positions_base(uuid) from authenticated;

comment on function public.saved_positions_base(uuid) is
  'DAS-REV-05 §22: proiezione condivisa dei Salvati Position — gruppo di '
  'disponibilità, reason, data affidabile, candidatura dell''utente e '
  'navigabilità. Interna: non eseguibile da authenticated.';


-- ============================================================
-- SEZIONE 4 — provider del widget (§8, §9, §13)
--
-- Tre cose in una richiesta perché condividono la stessa fonte: conteggi,
-- preview limitate e aggiornamenti informativi. Resta un provider **separato**
-- da `fetch_dashboard_personal_overview`, così il suo errore è locale al
-- modulo (screen 06) e il riepilogo già caricato non sparisce con lui.
--
-- Il tipo di ritorno cambia rispetto a DAS-REV-03 (che restituiva le sole
-- righe): serve un drop esplicito, `create or replace` non può modificare le
-- colonne OUT di una funzione esistente.
-- ============================================================

drop function if exists public.fetch_dashboard_personal_saved_positions();

create or replace function public.fetch_dashboard_personal_saved_positions()
returns table (
  available_count   integer,
  unavailable_count integer,
  saved_preview     jsonb,
  recent_updates    jsonb,
  data_revision     bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_now          timestamptz := timezone('utc', now());
  v_recency_days integer := public.dashboard_policy_days('saved_availability_recency_days', 7);
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  return query
  -- Ogni riferimento è qualificato: i nomi delle colonne OUT di una
  -- `returns table` restano in scope come variabili, e una colonna omonima
  -- non qualificata diventa un errore di ambiguità a runtime.
  with base as (
    select sp.* from public.saved_positions_base(v_uid) sp
  )
  select
    -- §8: «cinque disponibili e quattro non più disponibili producono 5
    -- Salvate disponibili». Il conteggio non deriva dalle preview, non
    -- cambia perché l'utente si è già candidato e non include altri tipi di
    -- Saved: questa query vede solo `saved_ads`.
    (select count(*)::integer from base where base.availability_group = 'available'),

    -- Non è un terzo KPI (§8): serve all'empty del widget per sapere che lo
    -- storico esiste, senza scaricarlo.
    (select count(*)::integer from base where base.availability_group = 'unavailable'),

    -- §9: normalmente due preview, massimo tre. La terza esiste perché la
    -- deduplicazione di DAS-REV-03 §12 può toglierne una già promossa come
    -- scadenza, e §11 vieta che il modulo collassi per quel motivo.
    coalesce((
      select jsonb_agg(item order by item->>'rank', item->>'saved_at' desc, item->>'ad_id')
      from (
        select jsonb_build_object(
          'ad_id',         base.ad_id,
          'role',          base.role,
          'club_id',       base.club_id,
          'club_name',     base.club_name,
          'club_logo_url', base.club_logo_url,
          'team_name',     base.team_name,
          'category',      base.category,
          'location',      base.location,
          'has_applied',   base.has_applied,
          'is_navigable',  base.is_navigable,
          'saved_at',      base.saved_at,
          -- §11: prima le disponibili senza candidatura già inviata, poi le
          -- disponibili già candidate. Non è un punteggio e non è visibile:
          -- è l'ordine canonico, con `saved_at` e `ad_id` a spareggiare in
          -- modo stabile.
          'rank',          case when base.has_applied then 1 else 0 end
        ) as item
        from base
        where base.availability_group = 'available'
        order by
          case when base.has_applied then 1 else 0 end,
          base.saved_at desc,
          base.ad_id asc
        limit 3
      ) preview
    ), '[]'::jsonb),

    -- §13/§14: aggiornamenti informativi di indisponibilità.
    --
    -- Quattro condizioni, tutte necessarie:
    --   · l'evento è l'**ultimo** della posizione — una riapertura
    --     successiva lo rende non più attuale (§14, §18);
    --   · la posizione è ancora classificata non disponibile, altrimenti
    --     l'aggiornamento contraddirebbe la lista;
    --   · l'evento è successivo al salvataggio: salvare una risorsa già
    --     indisponibile non è una perdita di disponibilità (§14);
    --   · l'evento è dentro la finestra di recency.
    --
    -- Il bookmark rimosso sparisce da `base`, quindi un evento vecchio non
    -- può far ricomparire la row (§14, §19).
    coalesce((
      select jsonb_agg(item order by item->>'occurred_at' desc)
      from (
        select jsonb_build_object(
          'event_id',      ev.id,
          'ad_id',         base.ad_id,
          'role',          base.role,
          'club_name',     base.club_name,
          'club_logo_url', base.club_logo_url,
          'team_name',     base.team_name,
          'category',      base.category,
          'reason',        base.unavailable_reason,
          'occurred_at',   ev.occurred_at
        ) as item
        from base
        join lateral (
          select e.id, e.transition, e.occurred_at
          from public.recruiting_ad_availability_events e
          where e.ad_id = base.ad_id
          order by e.occurred_at desc, e.id desc
          limit 1
        ) ev on true
        where base.availability_group = 'unavailable'
          and ev.transition = 'became_unavailable'
          and ev.occurred_at >= base.saved_at
          and ev.occurred_at >= v_now - make_interval(days => v_recency_days)
        order by ev.occurred_at desc
        -- §13: il budget delle row informative è quello di DAS-REV-03. Il
        -- client aggrega quando sono più di una, quindi qui basta il
        -- materiale per decidere: il cap è generoso ma finito.
        limit 10
      ) updates
    ), '[]'::jsonb),

    (extract(epoch from v_now) * 1000)::bigint;
end;
$$;

revoke all on function public.fetch_dashboard_personal_saved_positions() from public;
grant execute on function public.fetch_dashboard_personal_saved_positions() to authenticated;

comment on function public.fetch_dashboard_personal_saved_positions() is
  'DAS-REV-05 §8/§9/§13: conteggi separati dalle preview, preview delle sole '
  'posizioni disponibili e aggiornamenti di indisponibilità pertinenti, per '
  'l''utente autenticato. Nessun parametro di identità: il perimetro è '
  'auth.uid().';


-- ============================================================
-- SEZIONE 5 — lista completa dentro Cerca (§15, §16)
--
-- «La gestione completa resta in Cerca → Posizioni aperte → Salvate» con i
-- filtri interni Disponibili / Non più disponibili.
--
-- RPC dedicata e non un parametro in più su `search_positions_page`: quella
-- filtra `status = 'published'` ed è condivisa con Per te ed Esplora, che §15
-- vieta di modificare. Un gruppo "non più disponibili" lì dentro vorrebbe
-- dire allentare il predicato di pubblicazione per tutte e tre le tab.
--
-- `total_count` viene dal gruppo corrente lato server, non dalle righe
-- scaricate (§15).
-- ============================================================

create or replace function public.fetch_saved_positions_page(
  p_group  text default 'available',
  p_limit  int  default 20,
  p_offset int  default 0
)
returns table (
  ad_id              uuid,
  role               text,
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  team_name          text,
  category           text,
  location           text,
  availability_group text,
  unavailable_reason text,
  unavailable_at     timestamptz,
  has_applied        boolean,
  is_navigable       boolean,
  saved_at           timestamptz,
  total_count        bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_limit  int  := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset int  := greatest(coalesce(p_offset, 0), 0);
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(p_group, 'available') not in ('available', 'unavailable') then
    raise exception 'Gruppo di disponibilità non supportato';
  end if;

  return query
  -- Qualificato per la stessa ragione: `availability_group` è anche una
  -- colonna OUT di questa funzione.
  with base as (
    select sp.*
    from public.saved_positions_base(v_uid) sp
    where sp.availability_group = coalesce(p_group, 'available')
  )
  select
    base.ad_id,
    base.role,
    base.club_id,
    base.club_name,
    base.club_logo_url,
    base.team_name,
    base.category,
    base.location,
    base.availability_group,
    base.unavailable_reason,
    base.unavailable_at,
    base.has_applied,
    base.is_navigable,
    base.saved_at,
    count(*) over () as total_count
  from base
  order by
    -- Disponibili: stesso ranking della preview, così la lista non riordina
    -- ciò che il widget ha appena mostrato (§11).
    case when base.availability_group = 'available' and base.has_applied then 1 else 0 end,
    -- Non più disponibili: prima le transizioni recenti, quando la data
    -- esiste. Senza data si ricade sul salvataggio (§17).
    case when base.availability_group = 'unavailable' then base.unavailable_at end desc nulls last,
    base.saved_at desc,
    base.ad_id asc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.fetch_saved_positions_page(text, int, int) from public;
grant execute on function public.fetch_saved_positions_page(text, int, int) to authenticated;

comment on function public.fetch_saved_positions_page(text, int, int) is
  'DAS-REV-05 §15: pagina della lista Salvate per gruppo di disponibilità, '
  'con ordinamento deterministico e total_count del gruppo. Il perimetro è '
  'auth.uid(): nessun parametro di proprietario.';


-- ============================================================
-- SEZIONE 6 — riepilogo personale: "Salvate disponibili" (§8)
--
-- Unico cambio rispetto a DAS-REV-04: `saved_positions_count` smette di
-- contare tutti i bookmark e conta quelli ancora disponibili, cioè
-- esattamente ciò che la nuova label dichiara e ciò che la destinazione
-- mostra.
--
-- La funzione è riscritta per intero perché le migrazioni sono append-only:
-- il resto del corpo è identico a 20261015090000, riga per riga.
-- ============================================================

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
  'DAS-REV-03/04/05: composizione personale della Dashboard per l''utente '
  'autenticato — riepilogo (candidature attive e Salvate disponibili), '
  'segnali prioritari e suggerimento facoltativo. Preview candidature e '
  'posizioni salvate stanno nei rispettivi provider.';
