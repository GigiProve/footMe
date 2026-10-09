-- ============================================================
-- DAS-REV-04 — Widget Candidature personale
--
-- Il dominio Application conosceva un solo asse: `application_status`.
-- DAS-REV-04 ne richiede tre, tenuti separati (§6):
--
--   1. stato della candidatura        → `recruiting_applications.status`
--   2. la posizione accetta nuove candidature → `recruiting_ads.status` +
--      `application_deadline_at`
--   3. il processo di selezione è concluso    → **non esisteva**
--
-- Il terzo è il gap dichiarato da §20: «Se il backend non distingue ancora
-- chiusura dell'annuncio e conclusione della selezione, segnalare il gap e
-- introdurre il minimo adeguamento nel dominio proprietario quando
-- semanticamente determinabile.» Qui è determinabile: una selezione conclusa
-- è un fatto che la Società dichiara, non si deduce da `status = 'closed'`
-- né dalla scadenza. Da qui `recruiting_ads.selection_completed_at`.
--
-- Nessuna nuova tabella autorevole delle candidature, nessun nuovo enum di
-- stato: Attive/Concluse resta una **classificazione derivata** (§6).
--
-- Contenuto, in ordine:
--
--   1. `recruiting_ads.selection_completed_at`  — conclusione della selezione.
--   2. `recruiting_application_events.event_kind` — l'evento "selezione
--      conclusa" non è una transizione di stato della candidatura.
--   3. trigger che materializza quell'evento sulle candidature ancora aperte.
--   4. `recruiting_application_event_acks` + RPC — consultazione persistente,
--      idempotente e cross-device (§12).
--   5. `application_group()`                    — classificazione canonica.
--   6. `fetch_dashboard_personal_applications()` — preview + aggiornamenti,
--      provider separato perché l'errore dello screen 06 sia reale (§17).
--   7. `fetch_my_applications_page()`           — lista Attive/Concluse con
--      cursore (§18).
--   8. `fetch_dashboard_personal_overview()`    — ricreata senza preview e
--      aggiornamenti, con il conteggio attivo corretto.
--
-- Nessun backfill di esiti, date o eventi (§20): i record storici non
-- ricevono una conclusione che il dominio non ha mai registrato.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — conclusione della selezione (§7)
--
-- Distinta da `status = 'closed'`, che significa soltanto "non accetta nuove
-- candidature". §6: «Chiudere una posizione alle nuove candidature non
-- conclude automaticamente le candidature già ricevute.»
-- ============================================================

alter table public.recruiting_ads
  add column if not exists selection_completed_at timestamptz;

comment on column public.recruiting_ads.selection_completed_at is
  'DAS-REV-04 §7: istante in cui il processo di selezione è realmente '
  'concluso. Distinto da status = ''closed'' (la posizione non accetta nuove '
  'candidature) e da application_deadline_at (il cutoff degli invii): '
  'nessuno dei due conclude le candidature già ricevute.';

create index if not exists recruiting_ads_selection_completed_idx
  on public.recruiting_ads (selection_completed_at)
  where selection_completed_at is not null;


-- ============================================================
-- SEZIONE 2 — eventi non riconducibili a una transizione di stato
--
-- `recruiting_application_events` nasceva in DAS-REV-03 per le sole
-- transizioni di `status`. La conclusione della selezione è un evento
-- professionale reale che **non** cambia lo stato della candidatura — resta
-- "In valutazione" — quindi `to_status` smette di essere obbligatorio e
-- compare `event_kind`.
--
-- Retrocompatibile: le righe esistenti sono tutte `status_change` per
-- default, e il vincolo impone `to_status` solo a quelle.
-- ============================================================

alter table public.recruiting_application_events
  add column if not exists event_kind text not null default 'status_change';

alter table public.recruiting_application_events
  alter column to_status drop not null;

alter table public.recruiting_application_events
  drop constraint if exists recruiting_application_events_kind_check;

alter table public.recruiting_application_events
  add constraint recruiting_application_events_kind_check
  check (
    event_kind in ('status_change', 'selection_completed')
    and (event_kind <> 'status_change' or to_status is not null)
  );

-- §11: «Consegne duplicate dello stesso evento non producono duplicati.»
-- Una selezione può essere conclusa una volta sola per candidatura.
create unique index if not exists recruiting_application_events_selection_uniq
  on public.recruiting_application_events (application_id)
  where event_kind = 'selection_completed';

comment on column public.recruiting_application_events.event_kind is
  'DAS-REV-04 §11: natura dell''evento. ''status_change'' è la transizione di '
  'stato di DAS-REV-03; ''selection_completed'' è la conclusione della '
  'selezione, che non cambia lo stato della candidatura.';


-- ============================================================
-- SEZIONE 3 — materializzazione dell'evento di conclusione (§7)
--
-- «Produrre o riutilizzare l'aggiornamento significativo previsto dal
-- dominio.» L'evento nasce solo per le candidature ancora operative: una già
-- rifiutata o ritirata ha già il proprio esito terminale, e §7 vieta di
-- sovrascriverlo con una conclusione generica.
--
-- Solo null → not null: riaprire una selezione non cancella la storia, e
-- §7 vieta che una riapertura riattivi candidature terminali.
-- ============================================================

create or replace function public.log_selection_completed_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.selection_completed_at is null and new.selection_completed_at is not null then
    insert into public.recruiting_application_events (
      application_id, event_kind, from_status, to_status, occurred_at
    )
    select app.id, 'selection_completed', app.status, null, new.selection_completed_at
    from public.recruiting_applications app
    where app.ad_id = new.id
      and app.status in ('submitted', 'reviewing', 'shortlisted')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists recruiting_ads_log_selection_completed on public.recruiting_ads;
create trigger recruiting_ads_log_selection_completed
  after update of selection_completed_at on public.recruiting_ads
  for each row
  execute function public.log_selection_completed_events();


-- ============================================================
-- SEZIONE 4 — consultazione persistente dell'aggiornamento (§12)
--
-- «Se l'acknowledgement manca, completare il minimo contratto nel dominio
-- Application: consultazione della PERSON riferita all'evento o alla
-- revisione, persistita server-side e aggiornata in modo idempotente.»
--
-- Riferita all'**evento**, non alla candidatura: §12 vieta che un ack segni
-- come letto un evento successivo arrivato nel frattempo. La chiave primaria
-- composta rende l'operazione idempotente per costruzione.
-- ============================================================

create table if not exists public.recruiting_application_event_acks (
  event_id        uuid not null references public.recruiting_application_events(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  acknowledged_at timestamptz not null default timezone('utc', now()),
  primary key (event_id, profile_id)
);

alter table public.recruiting_application_event_acks enable row level security;

drop policy if exists "users read own application event acks"
  on public.recruiting_application_event_acks;
create policy "users read own application event acks"
  on public.recruiting_application_event_acks
  for select
  to authenticated
  using (profile_id = auth.uid());

comment on table public.recruiting_application_event_acks is
  'DAS-REV-04 §12: consultazione persistente di un aggiornamento, riferita '
  'all''evento effettivamente visto e non alla candidatura. Scritta solo da '
  'acknowledge_application_event(): l''impression nella Dashboard non la '
  'produce, e il solo tap non basta se la destinazione non si carica.';

create or replace function public.acknowledge_application_event(p_event_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  -- §21: autorizzare prima di scrivere. Un id di evento altrui non produce
  -- un ack e non rivela se l'evento esista.
  if not exists (
    select 1
    from public.recruiting_application_events e
    join public.recruiting_applications app on app.id = e.application_id
    where e.id = p_event_id
      and app.applicant_profile_id = v_uid
  ) then
    return false;
  end if;

  insert into public.recruiting_application_event_acks (event_id, profile_id)
  values (p_event_id, v_uid)
  on conflict (event_id, profile_id) do nothing;

  return true;
end;
$$;

revoke all on function public.acknowledge_application_event(uuid) from public;
grant execute on function public.acknowledge_application_event(uuid) to authenticated;

comment on function public.acknowledge_application_event(uuid) is
  'DAS-REV-04 §12: marca come consultato un singolo evento della propria '
  'candidatura. Idempotente, server-side, condiviso fra dispositivi.';


-- ============================================================
-- SEZIONE 5 — classificazione canonica Attive / Concluse (§6)
--
-- Una sola definizione, usata da conteggio, preview, aggiornamenti e lista.
-- Due definizioni divergerebbero, ed è esattamente il modo in cui un
-- conteggio smette di spiegare la lista che apre.
--
-- Non classifica come conclusa una candidatura perché l'annuncio è chiuso,
-- scaduto, non più visibile o vecchio (§6).
-- ============================================================

create or replace function public.application_group(
  p_status                 public.application_status,
  p_selection_completed_at timestamptz
)
returns text
language sql
immutable
as $$
  select case
    -- Esito terminale esplicito del dominio: vale su tutto.
    when p_status in ('accepted', 'rejected', 'withdrawn') then 'completed'
    -- Selezione realmente conclusa: la candidatura esce dalle attive pur
    -- conservando il proprio stato reale (§7).
    when p_selection_completed_at is not null then 'completed'
    else 'active'
  end;
$$;

comment on function public.application_group(public.application_status, timestamptz) is
  'DAS-REV-04 §6: classificazione operativa Attive/Concluse. Non è un nuovo '
  'enum di stato e non deriva da position.closed, dalla scadenza '
  'dell''annuncio o dal tempo trascorso.';


-- ============================================================
-- SEZIONE 6 — provider delle candidature della Dashboard (§17, §18)
--
-- Separato da `fetch_dashboard_personal_overview` di proposito: lo screen 06
-- mostra il riepilogo caricato e le sole preview in errore. Con un provider
-- solo quello stato sarebbe una finzione — il conteggio sparirebbe insieme
-- alle righe. È la stessa ragione per cui DAS-REV-02 ha separato le
-- Posizioni salvate.
--
-- `has_completed` evita di scaricare lo storico per sapere se esiste (§16).
-- ============================================================

create or replace function public.fetch_dashboard_personal_applications()
returns table (
  applications_preview jsonb,
  recent_updates       jsonb,
  has_completed        boolean,
  data_revision        bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_now          timestamptz := timezone('utc', now());
  v_recency_days integer := public.dashboard_policy_days('application_update_recency_days', 7);
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  return query
  with scoped as (
    select
      app.id,
      app.status,
      app.created_at,
      ra.id                                   as ad_id,
      ra.role_required::text                  as role,
      ra.status                               as ad_status,
      ra.application_deadline_at,
      ra.selection_completed_at,
      ra.category                             as ad_category,
      c.name                                  as club_name,
      c.logo_url                              as club_logo_url,
      ct.name                                 as team_name,
      ct.category                             as team_category,
      public.application_group(app.status, ra.selection_completed_at) as grp,
      -- §7: la posizione accetta ancora candidature? Metadato secondario,
      -- mai uno stato terminale.
      (
        ra.status = 'published'
        and (ra.application_deadline_at is null or ra.application_deadline_at > v_now)
      ) as position_accepting
    from public.recruiting_applications app
    join public.recruiting_ads ra on ra.id = app.ad_id
    join public.clubs c on c.id = ra.club_id
    left join public.club_teams ct on ct.id = ra.team_id
    where app.applicant_profile_id = v_uid
  ),
  last_event as (
    select distinct on (e.application_id)
      e.application_id, e.id as event_id, e.event_kind, e.to_status, e.occurred_at
    from public.recruiting_application_events e
    join public.recruiting_applications a on a.id = e.application_id
    where a.applicant_profile_id = v_uid
    order by e.application_id, e.occurred_at desc, e.id desc
  )
  select
    -- §8: tre righe al massimo. Il client ne mostra normalmente due e usa la
    -- terza quando la deduplicazione ne toglie una già promossa in alto.
    coalesce((
      select jsonb_agg(item order by item->>'sort_at' desc)
      from (
        select jsonb_build_object(
          'id',                s.id,
          'ad_id',             s.ad_id,
          'role',              s.role,
          'club_name',         s.club_name,
          'club_logo_url',     s.club_logo_url,
          'team_name',         s.team_name,
          'category',          coalesce(s.team_category, s.ad_category),
          'status',            s.status,
          'created_at',        s.created_at,
          'position_accepting', s.position_accepting,
          'last_event_id',     ev.event_id,
          'last_event_at',     ev.occurred_at,
          'last_event_to',     ev.to_status,
          'last_event_kind',   ev.event_kind,
          'has_unread_update', (
            ev.event_id is not null
            and ev.occurred_at > s.created_at
            and not exists (
              select 1 from public.recruiting_application_event_acks ack
              where ack.event_id = ev.event_id and ack.profile_id = v_uid
            )
          ),
          'sort_at',           greatest(s.created_at, coalesce(ev.occurred_at, s.created_at))
        ) as item
        from scoped s
        left join last_event ev on ev.application_id = s.id
        where s.grp = 'active'
        order by greatest(s.created_at, coalesce(ev.occurred_at, s.created_at)) desc, s.id desc
        limit 3
      ) preview
    ), '[]'::jsonb) as applications_preview,

    -- §11/§13: aggiornamenti professionali reali dentro la finestra di
    -- recency. `is_completed` dice alla presentazione se la row porta alla
    -- lista Concluse invece che al dettaglio (§15).
    coalesce((
      select jsonb_agg(item order by item->>'occurred_at' desc)
      from (
        select jsonb_build_object(
          'application_id', s.id,
          'ad_id',          s.ad_id,
          'event_id',       ev.event_id,
          'event_kind',     ev.event_kind,
          'event_status',   ev.to_status,
          'occurred_at',    ev.occurred_at,
          'role',           s.role,
          'club_name',      s.club_name,
          'club_logo_url',  s.club_logo_url,
          'team_name',      s.team_name,
          'status',         s.status,
          'is_completed',   s.grp = 'completed',
          'acknowledged',   exists (
            select 1 from public.recruiting_application_event_acks ack
            where ack.event_id = ev.event_id and ack.profile_id = v_uid
          )
        ) as item
        from scoped s
        join last_event ev on ev.application_id = s.id
        where ev.occurred_at >= v_now - make_interval(days => v_recency_days)
          and ev.occurred_at > s.created_at
        order by ev.occurred_at desc, s.id desc
        limit 2
      ) updates
    ), '[]'::jsonb) as recent_updates,

    -- §16: l'esistenza dello storico senza scaricarlo.
    exists (select 1 from scoped s where s.grp = 'completed') as has_completed,

    (extract(epoch from v_now) * 1000)::bigint as data_revision;
end;
$$;

revoke all on function public.fetch_dashboard_personal_applications() from public;
grant execute on function public.fetch_dashboard_personal_applications() to authenticated;

comment on function public.fetch_dashboard_personal_applications() is
  'DAS-REV-04: preview delle candidature attive, aggiornamenti recenti ed '
  'esistenza dello storico per l''utente autenticato. Provider separato dal '
  'riepilogo (§17): il fallimento delle preview non deve portarsi via il '
  'conteggio.';


-- ============================================================
-- SEZIONE 7 — lista "Le mie candidature" (§14, §18)
--
-- Il client non può ordinare per una data derivata (conclusione della
-- selezione o ultimo evento terminale), e PostgREST non può filtrare su
-- `application_group()`. Da qui la RPC, con cursore keyset: §18 vieta di
-- scaricare l'intero dataset per filtrarlo nel client.
--
-- Chiave di ordinamento documentata (§14): data di conclusione quando nota,
-- altrimenti data di invio. Mai nulla, così il keyset è stabile; spareggio
-- sull'id.
-- ============================================================

create or replace function public.fetch_my_applications_page(
  p_group  text default 'active',
  p_limit  integer default 20,
  p_cursor text default null
)
returns table (
  items       jsonb,
  next_cursor text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_now         timestamptz := timezone('utc', now());
  v_group       text := case when p_group = 'completed' then 'completed' else 'active' end;
  v_limit       integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_cursor_at   timestamptz := null;
  v_cursor_id   uuid := null;
  v_rows        jsonb;
  v_last        jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_cursor is not null and p_cursor <> '' then
    -- Cursore opaco "<timestamp>|<uuid>". Un cursore malformato non è un
    -- permesso in più: vale come prima pagina.
    begin
      v_cursor_at := split_part(p_cursor, '|', 1)::timestamptz;
      v_cursor_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      v_cursor_at := null;
      v_cursor_id := null;
    end;
  end if;

  with scoped as (
    select
      app.id,
      app.status,
      app.created_at,
      ra.id                   as ad_id,
      ra.role_required::text  as role,
      ra.status               as ad_status,
      ra.application_deadline_at,
      ra.selection_completed_at,
      ra.category             as ad_category,
      c.name                  as club_name,
      c.logo_url              as club_logo_url,
      ct.name                 as team_name,
      ct.category             as team_category,
      public.application_group(app.status, ra.selection_completed_at) as grp,
      (
        ra.status = 'published'
        and (ra.application_deadline_at is null or ra.application_deadline_at > v_now)
      ) as position_accepting,
      -- Data reale della conclusione: l'evento terminale quando esiste,
      -- altrimenti l'istante dichiarato sulla posizione. §14 vieta di
      -- ricavarla dalla chiusura dell'annuncio.
      coalesce(
        (
          select e.occurred_at
          from public.recruiting_application_events e
          where e.application_id = app.id
            and (
              e.event_kind = 'selection_completed'
              or e.to_status in ('accepted', 'rejected', 'withdrawn')
            )
          order by e.occurred_at desc
          limit 1
        ),
        ra.selection_completed_at
      ) as concluded_at,
      -- §13: l'ack si riferisce all'evento effettivamente consultato, quindi
      -- la row deve sapere quale sia.
      (
        select e.id
        from public.recruiting_application_events e
        where e.application_id = app.id
        order by e.occurred_at desc, e.id desc
        limit 1
      ) as last_event_id
    from public.recruiting_applications app
    join public.recruiting_ads ra on ra.id = app.ad_id
    join public.clubs c on c.id = ra.club_id
    left join public.club_teams ct on ct.id = ra.team_id
    where app.applicant_profile_id = v_uid
  ),
  ranked as (
    select
      s.*,
      case
        when v_group = 'completed' then coalesce(s.concluded_at, s.created_at)
        else s.created_at
      end as sort_at
    from scoped s
    where s.grp = v_group
  ),
  page as (
    select *
    from ranked r
    where v_cursor_at is null
       or (r.sort_at, r.id) < (v_cursor_at, v_cursor_id)
    order by r.sort_at desc, r.id desc
    limit v_limit
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id',                 p.id,
      'ad_id',              p.ad_id,
      'role',               p.role,
      'club_name',          p.club_name,
      'club_logo_url',      p.club_logo_url,
      'team_name',          p.team_name,
      'category',           coalesce(p.team_category, p.ad_category),
      'status',             p.status,
      'created_at',         p.created_at,
      'group',              p.grp,
      'position_accepting', p.position_accepting,
      'concluded_at',       p.concluded_at,
      'last_event_id',      p.last_event_id,
      -- §7/§14: l'esito generico vale solo quando il dominio non ne conosce
      -- uno più specifico. Il client lo localizza; qui non si inventa testo.
      'outcome',            case
                              when p.grp <> 'completed' then null
                              when p.status in ('accepted', 'rejected', 'withdrawn') then 'status'
                              else 'selection_completed'
                            end,
      'sort_at',            p.sort_at
    ) order by p.sort_at desc, p.id desc), '[]'::jsonb)
  into v_rows
  from page p;

  v_last := case
    when jsonb_array_length(v_rows) < v_limit then null
    else v_rows -> (jsonb_array_length(v_rows) - 1)
  end;

  return query
  select
    v_rows,
    case
      when v_last is null then null
      else (v_last->>'sort_at') || '|' || (v_last->>'id')
    end;
end;
$$;

revoke all on function public.fetch_my_applications_page(text, integer, text) from public;
grant execute on function public.fetch_my_applications_page(text, integer, text) to authenticated;

comment on function public.fetch_my_applications_page(text, integer, text) is
  'DAS-REV-04 §14/§18: pagina della lista "Le mie candidature" per il gruppo '
  'richiesto (active|completed), con cursore keyset. Opera solo su '
  'auth.uid(): nessun parametro di identità, nessun accesso allo storico '
  'altrui modificando un id.';


-- ============================================================
-- SEZIONE 8 — riepilogo personale, senza preview candidature
--
-- Due cambi:
--
--   1. `active_applications_count` passa per `application_group()`. Prima
--      contava `status in ('submitted','reviewing','shortlisted')`: una
--      selezione conclusa lasciava la candidatura nel conteggio pur non
--      essendo più operativa, e §8 vieta che candidature concluse restino
--      attive.
--   2. `applications_preview` e `recent_updates` escono dalla firma: vivono
--      in `fetch_dashboard_personal_applications()`, così il loro errore è
--      locale al modulo (§17, screen 06).
--
-- Il tipo di ritorno cambia, quindi serve un drop esplicito: `create or
-- replace` non può modificare le colonne OUT di una funzione esistente.
-- ============================================================

drop function if exists public.fetch_dashboard_personal_overview();

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

    -- Stesso perimetro della destinazione che la metrica apre
    -- (/saved?filter=position): tutte le posizioni salvate, non solo quelle
    -- ancora pubblicate (§7).
    (
      select count(*)::integer
      from public.saved_ads sa
      where sa.profile_id = v_uid
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
  'DAS-REV-03/04: composizione personale della Dashboard per l''utente '
  'autenticato — riepilogo, segnali prioritari (scadenze reali e requisiti '
  'obbligatori) e suggerimento facoltativo. Preview candidature e '
  'aggiornamenti recenti stanno in fetch_dashboard_personal_applications().';
