-- DAS-REV-28 — Eventi: centro, modello e creazione
--
-- Il dominio degli eventi di selezione **non esisteva**: nessuna tabella,
-- nessun enum, nessuna RPC. Le sole tracce erano il flag client
-- `personal_event_registrations` (bloccato «finché il dominio Eventi/provini
-- non esiste») e `club_media_posts.kind = 'event'`, che è un tipo di post
-- editoriale e non un evento con partecipazione. Questa migrazione crea il
-- modello canonico e i comandi del perimetro 28; landing e iscrizione (29),
-- inviti e partecipanti (30), lifecycle e integrazione profili (31) si
-- collegano agli stessi ID e alle stesse funzioni di contratto.
--
-- Cosa introduce:
--
--   1. `selection_events`: **un'unica entità** per Provino, Stage e Open day
--      (§1, §8). Il tipo è un attributo, non tre tabelle;
--   2. il **tempo** dell'evento (§15). La sorgente modificabile è il giorno
--      civile più gli orari locali più il fuso IANA dell'evento; `starts_at`,
--      `ends_at` e `registration_deadline` sono **proiezioni** calcolate dal
--      trigger, mai scritte dal client. §8 vieta «event_date e starts_at come
--      fonti indipendenti»: qui la fonte è una, e gli istanti ne derivano.
--      Un cambio di fuso del dispositivo non tocca nulla, perché il client
--      non converte mai un orario in istante;
--   3. un **catalogo permessi** per l'area «Provini, stage e open day»
--      (§7), con tre controlli. Nessun backfill: i ruoli storici non
--      ricevono poteri nuovi per il solo aggiornamento del catalogo;
--   4. i **comandi**: salvataggio bozza (create + patch con CAS sulla
--      versione) e pubblicazione esplicita, entrambi idempotenti con
--      ricevuta (§21), più un aggiornamento per gli eventi pubblicati con i
--      guard di §20, pronto per il dettaglio futuro;
--   5. le **letture**: contesto del Centro, pagina per sezione con cursore
--      legato a società, actor, sezione e perimetro (§12), editor, squadre
--      utilizzabili;
--   6. i **contratti per i consumatori** 29–30 (§11, §18): conteggi,
--      attività e capienza. Il dominio partecipazioni non esiste ancora, quindi
--      le funzioni restituiscono zeri e «nessuna attività» **dichiarati**,
--      senza contatori persistiti. Chi costruirà le partecipazioni
--      ridefinisce queste tre funzioni, e Centro, editor e guard le usano già.
--
-- Cosa NON introduce, perché §3 lo vieta: tabelle per tipo, stati
-- SOLD_OUT/REGISTRATION_CLOSED, worker di auto-conclusione, pagina
-- pubblica, inviti, iscrizioni, notifiche, analytics, waitlist.
--
-- Scelte che lo spec lascia aperte, dichiarate qui:
--
--   · **fuso**: il dominio non ha un fuso per Società. Si riusa
--     `society_position_timezone()` (DAS-REV-16), che è il punto unico di
--     configurazione del progetto, e il valore viene **salvato sull'evento**
--     alla creazione. Il giorno in cui la Società avrà un fuso proprio basterà
--     cambiare quella funzione: gli eventi esistenti conservano il loro;
--   · **pubblicazione**: non esiste una capability di pubblicazione separata
--     per gli eventi, quindi §7 chiede una mappatura esplicita. Il comando
--     richiede `selection_events_create` sulla squadra dell'evento;
--   · **indirizzo**: il repository non ha un normalizzatore di indirizzi da
--     riusare (le sedi della Società sono testo libero). Nome struttura e
--     indirizzo sono testo con trim e limiti centralizzati;
--   · **eventi legacy**: non ce ne sono, quindi non c'è nulla da migrare e
--     nessuna squadra da ricostruire (§26).
--
-- Idempotenza: `create table if not exists`, `create or replace function`,
-- `drop trigger if exists`, catalogo con `on conflict`, revisione del
-- catalogo **assegnata** e non incrementata.
--
-- Convenzioni riprese da:
--   20261103090000_application_lifecycle.sql   (ricevute di operazione)
--   20261027090000_position_composer.sql       (scope per azione, squadre
--     utilizzabili, fuso del progetto)
--   20261026090000_*                           (cursore opaco verificato)
--   20261101090000_person_society_link.sql     (ultima definizione delle
--     CHECK sulle chiavi e di dashboard_club_capabilities)


-- ============================================================
-- SEZIONE 1 — tabella canonica (§8, §9)
-- ============================================================

create table if not exists public.selection_events (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  /* §9: «Ogni evento è legato a una sola squadra interna della società.»
     Non nullo già nella bozza: §13 — «Prima del primo salvataggio richiede
     Team valido perché determina società/scope dell'oggetto persistente.»
     `restrict` e non `cascade`: una squadra con eventi non sparisce
     portandosi via lo storico. */
  team_id     uuid not null references public.club_teams(id) on delete restrict,

  /* Campi che una bozza può ancora non avere (§8): nullable, mai inventati. */
  event_type  text check (event_type in ('tryout', 'stage', 'open_day')),
  title       text,
  status      text not null default 'draft'
              check (status in ('draft', 'published', 'completed', 'cancelled')),

  /* §15 — sorgente temporale: giorno civile + orari locali + fuso IANA. */
  timezone    text not null,
  start_date  date,
  start_time  time,
  end_time    time,
  /* Proiezioni del trigger `selection_events_derive`. */
  starts_at   timestamptz,
  ends_at     timestamptz,

  venue_name     text,
  venue_address  text,
  description        text,
  requirements_info  text,

  birth_year_from  smallint,
  birth_year_to    smallint,
  max_participants integer check (max_participants is null or max_participants >= 1),

  participation_mode             text
    check (participation_mode in ('open_registration', 'invite_only')),
  registration_confirmation_mode text
    check (registration_confirmation_mode in ('automatic', 'manual')),
  registration_deadline_date date,
  registration_deadline_time time,
  registration_deadline      timestamptz,

  /* Conteggio finale canonico dello storico (§11). Lo scrive il lifecycle
     della 31; finché è null lo storico usa la proiezione corrente, che oggi
     è zero perché le partecipazioni non esistono. Mai un valore inventato. */
  final_confirmed_count integer check (final_confirmed_count is null or final_confirmed_count >= 0),

  version      integer not null default 1,
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now()),
  published_at timestamptz,
  published_by uuid references public.profiles(id),

  /* §16: «Un anno singolo equivale from=to; nessun riferimento equivale
     entrambi null.» Un solo estremo valorizzato non deve diventare un
     intervallo senza limite. */
  constraint selection_events_years_pair
    check ((birth_year_from is null) = (birth_year_to is null)),
  constraint selection_events_years_order
    check (birth_year_from is null or birth_year_from <= birth_year_to),
  /* §17: «Con Solo su invito … salva entrambi i campi null.» */
  constraint selection_events_invite_only_fields
    check (
      participation_mode is distinct from 'invite_only'
      or (registration_confirmation_mode is null
          and registration_deadline_date is null
          and registration_deadline_time is null)
    ),
  constraint selection_events_deadline_pair
    check ((registration_deadline_date is null) = (registration_deadline_time is null)),
  /* §19: un evento uscito dalla bozza ha i campi di pubblicazione. Non
     `starts_at` futuro, che vale solo al momento del comando (§15). */
  constraint selection_events_published_complete
    check (
      status = 'draft'
      or (event_type is not null
          and title is not null
          and starts_at is not null
          and venue_name is not null
          and venue_address is not null
          and participation_mode is not null
          and (participation_mode = 'invite_only'
               or registration_confirmation_mode is not null))
    )
);

create index if not exists selection_events_club_status_start_idx
  on public.selection_events (club_id, status, starts_at, id);

create index if not exists selection_events_club_status_updated_idx
  on public.selection_events (club_id, status, updated_at desc, id desc);

create index if not exists selection_events_team_idx
  on public.selection_events (team_id);

/* §21: «DRAFT non è pubblico.» Tutto passa dalle funzioni `security
   definer`; nessuna policy, e nessun privilegio diretto per i ruoli API —
   `revoke from public` non chiude `anon` su Supabase (playbook). */
alter table public.selection_events enable row level security;
revoke all on public.selection_events from anon, authenticated;

comment on table public.selection_events is
  'DAS-REV-28: evento di selezione della Società (Provino, Stage, Open day). '
  'Una sola entità; la squadra è singola e reale. Gli istanti sono '
  'proiezioni del giorno civile e degli orari locali nel fuso dell''evento.';


-- ============================================================
-- SEZIONE 2 — limiti condivisi e tempo locale (§14, §15, §16)
--
-- §14: «Riusa limiti centrali; se non esistono definiscili una sola volta in
-- configurazione backend/client.» Il client li riceve dalle letture, non ne
-- tiene una seconda copia.
-- ============================================================

create or replace function public.selection_event_limits()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'title',          120,
    'venueName',      120,
    'venueAddress',   200,
    'description',    2000,
    'requirements',   1000,
    'birthYearMin',   1900,
    /* §16: «non date future». L'anno corrente è l'ultimo ammesso. */
    'birthYearMax',   extract(year from timezone('utc', now()))::int,
    'maxParticipants', 10000
  );
$$;

revoke all on function public.selection_event_limits() from public;
grant execute on function public.selection_event_limits() to authenticated;

/**
 * L'istante di un orario civile nel fuso dell'evento.
 *
 * `timestamp at time zone` normalizza in silenzio un orario inesistente
 * (02:30 nel giorno dell'ora legale diventa 03:30) e sceglie da solo fra
 * le due occorrenze di un orario ambiguo. §15 vieta entrambe le cose:
 * `selection_event_local_time_issue` le riconosce, e i comandi le
 * rifiutano prima che il trigger calcoli la proiezione.
 */
create or replace function public.selection_event_local_instant(
  p_date date,
  p_time time,
  p_tz   text
)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select case
    when p_date is null or p_time is null or p_tz is null then null
    else (p_date + p_time) at time zone p_tz
  end;
$$;

/** `null`, `'nonexistent'` o `'ambiguous'`. Vale per salti di un'ora. */
create or replace function public.selection_event_local_time_issue(
  p_date date,
  p_time time,
  p_tz   text
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_local   timestamp;
  v_instant timestamptz;
begin
  if p_date is null or p_time is null or p_tz is null then
    return null;
  end if;

  v_local   := p_date + p_time;
  v_instant := v_local at time zone p_tz;

  if (v_instant at time zone p_tz) <> v_local then
    return 'nonexistent';
  end if;

  if ((v_instant - interval '1 hour') at time zone p_tz) = v_local
     or ((v_instant + interval '1 hour') at time zone p_tz) = v_local then
    return 'ambiguous';
  end if;

  return null;
end;
$$;

revoke all on function public.selection_event_local_instant(date, time, text) from public;
revoke all on function public.selection_event_local_time_issue(date, time, text) from public;


-- ============================================================
-- SEZIONE 3 — trigger: proiezioni, versione, integrità (§8, §9, §21)
-- ============================================================

create or replace function public.selection_events_derive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_club   uuid;
  v_archived    boolean;
  v_destination boolean;
begin
  /* §21: «Non trasferire l'evento a una Society diversa.» */
  if tg_op = 'UPDATE' then
    if new.club_id is distinct from old.club_id then
      raise exception 'SELECTION_EVENT_CLUB_IMMUTABLE';
    end if;

    if new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'SELECTION_EVENT_AUTHOR_IMMUTABLE';
    end if;
  end if;

  -- Proiezioni: sempre ricalcolate, mai accettate dal chiamante.
  new.starts_at := public.selection_event_local_instant(new.start_date, new.start_time, new.timezone);
  new.ends_at   := public.selection_event_local_instant(new.start_date, new.end_time,   new.timezone);
  new.registration_deadline := public.selection_event_local_instant(
    new.registration_deadline_date, new.registration_deadline_time, new.timezone);

  /* §9: squadra della stessa Società. Le affiliate sono altri `clubs`, quindi
     restano fuori da sole. */
  select ct.club_id into v_team_club
  from public.club_teams ct
  where ct.id = new.team_id;

  if v_team_club is distinct from new.club_id then
    raise exception 'SELECTION_EVENT_TEAM_INVALID';
  end if;

  /* §9: «Team archiviato/inattivo … può restare riferimento storico, non
     diventa automaticamente una destinazione nuova.» Il controllo scatta
     quando la squadra **diventa** destinazione: creazione, cambio squadra,
     pubblicazione. `for share` come in `guard_team_is_active`: se una
     disattivazione tiene già la riga, si attende e si rilegge.

     Due rami e non un `or`: SQL non garantisce l'ordine di valutazione, e
     `old` non va mai letto in un INSERT (è la trappola che ha rotto
     `guard_team_is_active`, DAS-REV-23). */
  if tg_op = 'INSERT' then
    v_destination := true;
  else
    v_destination := new.team_id is distinct from old.team_id
      or (old.status = 'draft' and new.status = 'published');
  end if;

  if v_destination then
    select ct.is_archived into v_archived
    from public.club_teams ct
    where ct.id = new.team_id
    for share;

    if coalesce(v_archived, false) then
      raise exception 'TEAM_NOT_ACTIVE';
    end if;
  end if;

  /* §12: «Un GET o retry idempotente senza effetti non aggiorna updated_at.»
     Versione e data avanzano solo quando il contenuto cambia davvero. */
  if tg_op = 'INSERT' then
    new.version    := 1;
    new.updated_at := now();
  elsif (to_jsonb(new) - 'version' - 'updated_at')
        is distinct from (to_jsonb(old) - 'version' - 'updated_at') then
    new.version    := old.version + 1;
    new.updated_at := now();
  else
    new.version    := old.version;
    new.updated_at := old.updated_at;
  end if;

  return new;
end;
$$;

drop trigger if exists selection_events_derive on public.selection_events;
create trigger selection_events_derive
  before insert or update on public.selection_events
  for each row execute function public.selection_events_derive();


-- ============================================================
-- SEZIONE 4 — contratti per i consumatori 29–30 (§11, §18, §20)
--
-- Il dominio partecipazioni non esiste. Queste tre funzioni sono il punto
-- in cui esisterà: Centro, editor e guard le chiamano già, e il pack che
-- introduce iscrizioni e inviti le ridefinisce senza toccare i chiamanti.
--
-- Oggi restituiscono **zeri contrattuali** (§11: «il contratto può
-- restituire zero coerenti; non persistere contatori demo scollegati»).
-- L'integrazione end-to-end delle transizioni verso CONFIRMED è una
-- dipendenza dei pack 29–30 e qui non viene dichiarata testata.
-- ============================================================

/**
 * `confirmed_count`: solo partecipazioni CONFIRMED. `pending_requests_count`:
 * solo richieste spontanee in attesa di decisione — gli inviti pendenti non
 * contano (§11).
 */
create or replace function public.selection_event_participation_counts(
  p_event_id uuid,
  out confirmed_count        integer,
  out pending_requests_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select 0, 0 where p_event_id is not null;
$$;

/**
 * Esiste attività operativa: iscrizioni, richieste, inviti o partecipazioni
 * di qualunque stato (§20). Non si deduce dal solo `confirmed_count`: un
 * invito pendente con zero confermati è già attività (QA-095).
 */
create or replace function public.selection_event_has_activity(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select false where p_event_id is not null;
$$;

/**
 * Il controllo di capienza che ogni transizione verso CONFIRMED deve
 * chiamare **dentro la propria transazione** (§18): iscrizione automatica,
 * conferma manuale, accettazione di un invito.
 *
 * Prende il `for update` sulla riga dell'evento, cioè lo stesso confine di
 * concorrenza della modifica del limite (`update_selection_event`): due
 * conferme sull'ultimo posto, o una conferma e una riduzione del limite, si
 * serializzano su questa riga invece di leggere entrambe uno stato vecchio.
 * Il chiamante, dopo `true`, inserisce la conferma prima del commit.
 *
 * Nessun grant: è interna ai comandi, non un endpoint.
 */
create or replace function public.selection_event_capacity_allows_confirmation(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max       integer;
  v_status    text;
  v_confirmed integer;
begin
  select e.max_participants, e.status into v_max, v_status
  from public.selection_events e
  where e.id = p_event_id
  for update;

  if not found or v_status <> 'published' then
    return false;
  end if;

  select c.confirmed_count into v_confirmed
  from public.selection_event_participation_counts(p_event_id) c;

  return v_max is null or coalesce(v_confirmed, 0) < v_max;
end;
$$;

revoke all on function public.selection_event_participation_counts(uuid) from public;
revoke all on function public.selection_event_has_activity(uuid) from public;
revoke all on function public.selection_event_capacity_allows_confirmation(uuid) from public;


-- ============================================================
-- SEZIONE 5 — ricevute di operazione e audit (§21, §26)
-- ============================================================

create table if not exists public.selection_event_operations (
  idempotency_key text primary key,
  actor_id        uuid not null references public.profiles(id) on delete cascade,
  club_id         uuid not null,
  /* La risorsa su cui l'intenzione è stata espressa: l'evento, o la Società
     per una creazione. Nessuna FK: una ricevuta sopravvive alla risorsa. */
  resource_id     uuid not null,
  operation       text not null,
  fingerprint     text not null,
  result          jsonb not null,
  created_at      timestamptz not null default timezone('utc', now())
);

create index if not exists selection_event_operations_actor_idx
  on public.selection_event_operations (actor_id, created_at desc);

alter table public.selection_event_operations enable row level security;
revoke all on public.selection_event_operations from anon, authenticated;

comment on table public.selection_event_operations is
  'DAS-REV-28 §21: ricevute dei comandi evento (creazione, salvataggio, '
  'pubblicazione, modifica). Riconosce il retry della stessa intenzione; '
  'stessa chiave con contenuto diverso è rifiutata.';

/**
 * Audit tecnico minimo (§26): actor, risorsa, operazione, versione, esito
 * e **nomi** dei campi cambiati. Mai i valori: §26 vieta log in chiaro di
 * descrizioni, requisiti e indirizzi.
 */
create table if not exists public.selection_event_audit (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null,
  club_id        uuid not null,
  actor_id       uuid not null,
  operation      text not null,
  version        integer not null,
  changed_fields text[] not null default array[]::text[],
  created_at     timestamptz not null default timezone('utc', now())
);

create index if not exists selection_event_audit_event_idx
  on public.selection_event_audit (event_id, created_at desc);

alter table public.selection_event_audit enable row level security;
revoke all on public.selection_event_audit from anon, authenticated;

create or replace function public.selection_event_operation_replay(
  p_key         text,
  p_resource_id uuid,
  p_operation   text,
  p_fingerprint text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.selection_event_operations%rowtype;
begin
  if p_key is null or length(btrim(p_key)) = 0 then
    return null;
  end if;

  select * into v_row
  from public.selection_event_operations
  where idempotency_key = p_key;

  if not found then
    return null;
  end if;

  if v_row.actor_id    is distinct from auth.uid()
     or v_row.resource_id is distinct from p_resource_id
     or v_row.operation   is distinct from p_operation
     or v_row.fingerprint is distinct from p_fingerprint
  then
    raise exception 'OPERATION_CONTENT_CHANGED';
  end if;

  return v_row.result;
end;
$$;

create or replace function public.selection_event_operation_record(
  p_key         text,
  p_club_id     uuid,
  p_resource_id uuid,
  p_operation   text,
  p_fingerprint text,
  p_result      jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key is null or length(btrim(p_key)) = 0 then
    return;
  end if;

  insert into public.selection_event_operations
    (idempotency_key, actor_id, club_id, resource_id, operation, fingerprint, result)
  values
    (p_key, auth.uid(), p_club_id, p_resource_id, p_operation, p_fingerprint, p_result)
  on conflict (idempotency_key) do nothing;
end;
$$;

revoke all on function public.selection_event_operation_replay(text, uuid, text, text) from public;
revoke all on function public.selection_event_operation_record(text, uuid, uuid, text, text, jsonb) from public;


-- ============================================================
-- SEZIONE 6 — catalogo permessi (§7)
--
-- Area con `scope_kind = 'team'`: gli eventi hanno una squadra singola, e lo
-- screen 16 è proprio un actor con ambito Primavera. Tre controlli:
-- Visualizza (bundle `view`), Crea e pubblica, Gestisci (bundle `manage`).
--
-- **Nessun backfill.** §7: «non concedere nuovi poteri automaticamente a
-- ruoli storici per semplice aggiornamento del catalogo». I controlli
-- nascono non concessi; l'Owner li ha per costruzione in
-- `dashboard_club_capabilities`.
-- ============================================================

alter table public.club_member_permissions
  drop constraint if exists club_member_permissions_key_check;

alter table public.club_member_permissions
  add constraint club_member_permissions_key_check
  check (permission_key in (
    'shortlist_view',
    'shortlist_create_lists',
    'shortlist_add_profiles',
    'shortlist_add_notes',
    'shortlist_edit_status',
    'shortlist_remove_profiles',
    'notif_new_applications',
    'notif_shortlist_updates',
    'notif_connection_requests',
    'notif_store_orders',
    'notif_content_tags',
    'notif_affiliations',
    'notif_profile_verifications',
    'society_manage_profile',
    'society_manage_positions',
    'society_publish_media',
    'dashboard_view',
    'positions_view',
    'positions_create',
    'positions_publish',
    'applications_view',
    'teams_view',
    'content_view',
    'content_create',
    'invites_create',
    'invites_view',
    'teams_create',
    'teams_edit',
    'roster_view',
    'seasons_prepare',
    'seasons_history_view',
    'seasons_history_edit',
    'seasons_history_add',
    'teams_lifecycle',
    'network_view',
    'network_requests_view',
    'network_request_send',
    'network_request_manage',
    'network_request_cancel',
    'network_invite_create',
    'network_terminate',
    'network_history_view',
    'admins_view',
    'admin_invites_view',
    'admins_invite',
    'admin_roles_view',
    'admin_roles_manage',
    'admins_assign_role',
    'admins_manage_scope',
    'admins_revoke',
    'admin_invites_cancel',
    'society_profile_view',
    'invites_cancel',
    'member_requests_view',
    'join_links_view',
    'join_links_create',
    'join_links_manage',
    'join_links_revoke',
    'assignments_remove',
    'member_requests_resolve',
    'assignments_manage',
    'members_remove',
    'selection_events_view',
    'selection_events_create',
    'selection_events_manage'
  ));

alter table public.club_admin_role_permissions
  drop constraint if exists club_admin_role_permissions_key_check;

alter table public.club_admin_role_permissions
  add constraint club_admin_role_permissions_key_check
  check (permission_key in (
    'shortlist_view',
    'shortlist_create_lists',
    'shortlist_add_profiles',
    'shortlist_add_notes',
    'shortlist_edit_status',
    'shortlist_remove_profiles',
    'notif_new_applications',
    'notif_shortlist_updates',
    'notif_connection_requests',
    'notif_store_orders',
    'notif_content_tags',
    'notif_affiliations',
    'notif_profile_verifications',
    'society_manage_profile',
    'society_manage_positions',
    'society_publish_media',
    'dashboard_view',
    'positions_view',
    'positions_create',
    'positions_publish',
    'applications_view',
    'teams_view',
    'content_view',
    'content_create',
    'invites_create',
    'invites_view',
    'teams_create',
    'teams_edit',
    'roster_view',
    'seasons_prepare',
    'seasons_history_view',
    'seasons_history_edit',
    'seasons_history_add',
    'teams_lifecycle',
    'network_view',
    'network_requests_view',
    'network_request_send',
    'network_request_manage',
    'network_request_cancel',
    'network_invite_create',
    'network_terminate',
    'network_history_view',
    'admins_view',
    'admin_invites_view',
    'admins_invite',
    'admin_roles_view',
    'admin_roles_manage',
    'admins_assign_role',
    'admins_manage_scope',
    'admins_revoke',
    'admin_invites_cancel',
    'society_profile_view',
    'invites_cancel',
    'member_requests_view',
    'join_links_view',
    'join_links_create',
    'join_links_manage',
    'join_links_revoke',
    'assignments_remove',
    'member_requests_resolve',
    'assignments_manage',
    'members_remove',
    'selection_events_view',
    'selection_events_create',
    'selection_events_manage'
  ));

/* L'area sta accanto a Candidature e Shortlist, cioè nel blocco operativo
   di recruiting e scouting (§7). Gli ordini sono **assegnati**, non
   incrementati: la migrazione può essere rieseguita senza spostare nulla. */
insert into public.club_permission_areas
  (id, label, description, sort_order, scope_kind, is_available) values
  ('selection_events', 'Provini, stage e open day',
     'Eventi di selezione della società.', 4, 'team', true)
on conflict (id) do update
  set label        = excluded.label,
      description  = excluded.description,
      sort_order   = excluded.sort_order,
      scope_kind   = excluded.scope_kind,
      is_available = excluded.is_available;

update public.club_permission_areas a
set sort_order = v.sort_order
from (values
  ('roster_invites', 5),
  ('content',        6),
  ('society_data',   7),
  ('network',        8),
  ('admins',         9)
) as v(id, sort_order)
where a.id = v.id;

insert into public.club_permission_controls
  (id, area_id, label, helper, bundle, requires, sort_order, is_available) values
  ('selection_events_read', 'selection_events', 'Visualizza eventi di selezione', null,
     'view',   array[]::text[], 1, true),
  ('selection_events_write', 'selection_events', 'Crea e pubblica eventi di selezione',
     'Necessario per visualizzare gli eventi',
     'manage', array['selection_events_read'], 2, true),
  ('selection_events_admin', 'selection_events', 'Gestisci eventi di selezione',
     'Necessario per visualizzare gli eventi',
     'manage', array['selection_events_read'], 3, true)
on conflict (id) do update
  set area_id      = excluded.area_id,
      label        = excluded.label,
      helper       = excluded.helper,
      bundle       = excluded.bundle,
      requires     = excluded.requires,
      sort_order   = excluded.sort_order,
      is_available = excluded.is_available;

insert into public.club_permission_control_keys (control_id, permission_key) values
  ('selection_events_read',  'selection_events_view'),
  ('selection_events_write', 'selection_events_create'),
  ('selection_events_admin', 'selection_events_manage')
on conflict do nothing;

insert into public.app_policy_settings (key, value, description)
values (
  'admin_permission_catalog_revision',
  to_jsonb(4),
  'DAS-REV-14 §7 — revisione della tassonomia aree/controlli/chiavi. Va '
  'incrementata da ogni migrazione che cambia il catalogo.'
)
on conflict (key) do update set value = to_jsonb(4);


-- ============================================================
-- SEZIONE 7 — dashboard_club_capabilities
--
-- Riscritta da 20261101090000_person_society_link.sql (ultima definizione)
-- per includere le tre chiavi nuove in entrambe le whitelist. Nessun'altra
-- differenza.
-- ============================================================

create or replace function public.dashboard_club_capabilities(p_club_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.owns_club(p_club_id) then array[
      'dashboard_view',
      'positions_view',
      'positions_create',
      'positions_publish',
      'society_manage_positions',
      'applications_view',
      'shortlist_view',
      'shortlist_create_lists',
      'shortlist_add_profiles',
      'shortlist_add_notes',
      'shortlist_edit_status',
      'shortlist_remove_profiles',
      'teams_view',
      'teams_create',
      'teams_edit',
      'roster_view',
      'content_view',
      'content_create',
      'society_publish_media',
      'society_profile_view',
      'society_manage_profile',
      'invites_create',
      'invites_view',
      'invites_cancel',
      'member_requests_view',
      'join_links_view',
      'join_links_create',
      'join_links_manage',
      'join_links_revoke',
      'assignments_remove',
      'seasons_prepare',
      'seasons_history_view',
      'seasons_history_edit',
      'seasons_history_add',
      'teams_lifecycle',
      'network_view',
      'network_requests_view',
      'network_request_send',
      'network_request_manage',
      'network_request_cancel',
      'network_invite_create',
      'network_terminate',
      'network_history_view',
      'admins_view',
      'admin_invites_view',
      'admins_invite',
      'admin_roles_view',
      'admin_roles_manage',
      'admins_assign_role',
      'admins_manage_scope',
      'admins_revoke',
      'admin_invites_cancel',
      'member_requests_resolve',
      'assignments_manage',
      'members_remove',
      'selection_events_view',
      'selection_events_create',
      'selection_events_manage'
    ]::text[]
    else coalesce(
      (
        select array_agg(distinct perm.permission_key order by perm.permission_key)
        from public.club_member_permissions perm
        where perm.club_id = p_club_id
          and perm.profile_id = auth.uid()
          and public.club_access_is_active(p_club_id, auth.uid())
          and (
            perm.team_id is null
            or exists (
              select 1
              from public.club_permission_control_keys ck
              join public.club_permission_controls c on c.id = ck.control_id
              join public.club_permission_areas a on a.id = c.area_id
              where ck.permission_key = perm.permission_key
                and a.scope_kind = 'team'
            )
          )
          and perm.permission_key in (
            'dashboard_view',
            'positions_view',
            'positions_create',
            'positions_publish',
            'society_manage_positions',
            'applications_view',
            'shortlist_view',
            'shortlist_create_lists',
            'shortlist_add_profiles',
            'shortlist_add_notes',
            'shortlist_edit_status',
            'shortlist_remove_profiles',
            'teams_view',
            'teams_create',
            'teams_edit',
            'roster_view',
            'content_view',
            'content_create',
            'society_publish_media',
            'society_profile_view',
            'society_manage_profile',
            'invites_create',
            'invites_view',
            'invites_cancel',
            'member_requests_view',
            'join_links_view',
            'join_links_create',
            'join_links_manage',
            'join_links_revoke',
            'assignments_remove',
            'seasons_prepare',
            'seasons_history_view',
            'seasons_history_edit',
            'seasons_history_add',
            'teams_lifecycle',
            'network_view',
            'network_requests_view',
            'network_request_send',
            'network_request_manage',
            'network_request_cancel',
            'network_invite_create',
            'network_terminate',
            'network_history_view',
            'admins_view',
            'admin_invites_view',
            'admins_invite',
            'admin_roles_view',
            'admin_roles_manage',
            'admins_assign_role',
            'admins_manage_scope',
            'admins_revoke',
            'admin_invites_cancel',
            'member_requests_resolve',
            'assignments_manage',
            'members_remove',
            'selection_events_view',
            'selection_events_create',
            'selection_events_manage'
          )
      ),
      array[]::text[]
    )
  end;
$$;

revoke all on function public.dashboard_club_capabilities(uuid) from public;
grant execute on function public.dashboard_club_capabilities(uuid) to authenticated;


-- ============================================================
-- SEZIONE 8 — autorizzazione per azione e squadra (§7, §9, §21)
--
-- Azioni:
--   view     → selection_events_view
--   create   → selection_events_create
--   publish  → selection_events_create   (§7: mappatura esplicita, non
--                                          esiste una publish separata)
--   edit     → selection_events_create o selection_events_manage, su bozza
--   manage   → selection_events_manage, su un evento uscito dalla bozza
--
-- Nessuna inferenza da `role == admin` (§7): Owner o capability effettive
-- con lo scope della squadra, come `position_can_operate`.
-- ============================================================

create or replace function public.selection_event_can_operate(
  p_club_id uuid,
  p_team_id uuid,
  p_action  text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_keys  text[];
  v_caps  text[];
  v_scope uuid[];
  v_key   text;
begin
  if p_club_id is null or p_team_id is null or auth.uid() is null then
    return false;
  end if;

  if not exists (
    select 1 from public.club_teams ct
    where ct.id = p_team_id and ct.club_id = p_club_id
  ) then
    return false;
  end if;

  if public.owns_club(p_club_id) then
    return true;
  end if;

  if not public.club_access_is_active(p_club_id, auth.uid()) then
    return false;
  end if;

  v_keys := case p_action
    when 'view'    then array['selection_events_view']
    when 'create'  then array['selection_events_create']
    when 'publish' then array['selection_events_create']
    when 'edit'    then array['selection_events_create', 'selection_events_manage']
    when 'manage'  then array['selection_events_manage']
    else array[]::text[]
  end;

  if array_length(v_keys, 1) is null then
    return false;
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  foreach v_key in array v_keys loop
    if v_key = any (v_caps) then
      v_scope := public.dashboard_club_capability_scope(p_club_id, v_key);

      if v_scope is null or p_team_id = any (v_scope) then
        return true;
      end if;
    end if;
  end loop;

  return false;
end;
$$;

revoke all on function public.selection_event_can_operate(uuid, uuid, text) from public;
grant execute on function public.selection_event_can_operate(uuid, uuid, text) to authenticated;

/**
 * Impronta del perimetro di lettura dell'actor (§12): «Cursor legato a
 * società, actor/access revision, gruppo e ordinamento.» Il dominio non ha
 * una revisione d'accesso numerica; l'impronta delle squadre visibili ne fa
 * le veci — se lo scope cambia, il cursore smette di valere.
 */
create or replace function public.selection_events_scope_fingerprint(p_club_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope uuid[];
begin
  if public.owns_club(p_club_id) then
    return 'all';
  end if;

  if not ('selection_events_view' = any (public.dashboard_club_capabilities(p_club_id))) then
    return 'none';
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, 'selection_events_view');

  if v_scope is null then
    return 'all';
  end if;

  return md5(coalesce(
    (select string_agg(t::text, ',' order by t::text) from unnest(v_scope) as t),
    ''));
end;
$$;

revoke all on function public.selection_events_scope_fingerprint(uuid) from public;


-- ============================================================
-- SEZIONE 9 — validazione strutturale e requisiti di pubblicazione
--
-- Due insiemi distinti (§13, §19): le regole **strutturali** valgono anche
-- per la bozza (un intervallo d'anni invertito non è mai salvabile), quelle
-- di **pubblicazione** solo al comando Pubblica. Un solo punto per ciascuno,
-- come `position_publish_blockers`: client e test leggono codici stabili.
-- ============================================================

create or replace function public.selection_event_structural_issues(
  p_event public.selection_events
)
returns text[]
language plpgsql
stable
set search_path = public
as $$
declare
  v_limits  jsonb := public.selection_event_limits();
  v_issues  text[] := array[]::text[];
  v_issue   text;
begin
  if p_event.title is not null
     and char_length(p_event.title) > (v_limits ->> 'title')::int then
    v_issues := v_issues || 'title_too_long'::text;
  end if;

  if p_event.venue_name is not null
     and char_length(p_event.venue_name) > (v_limits ->> 'venueName')::int then
    v_issues := v_issues || 'venue_too_long'::text;
  end if;

  if p_event.venue_address is not null
     and char_length(p_event.venue_address) > (v_limits ->> 'venueAddress')::int then
    v_issues := v_issues || 'address_too_long'::text;
  end if;

  if p_event.description is not null
     and char_length(p_event.description) > (v_limits ->> 'description')::int then
    v_issues := v_issues || 'description_too_long'::text;
  end if;

  if p_event.requirements_info is not null
     and char_length(p_event.requirements_info) > (v_limits ->> 'requirements')::int then
    v_issues := v_issues || 'requirements_too_long'::text;
  end if;

  -- §14: fine opzionale, successiva all'inizio, nello stesso giorno.
  if p_event.end_time is not null and p_event.start_time is null then
    v_issues := v_issues || 'end_without_start'::text;
  elsif p_event.end_time is not null and p_event.end_time <= p_event.start_time then
    v_issues := v_issues || 'end_before_start'::text;
  end if;

  v_issue := public.selection_event_local_time_issue(p_event.start_date, p_event.start_time, p_event.timezone);
  if v_issue is not null then
    v_issues := v_issues || ('start_time_' || v_issue);
  end if;

  v_issue := public.selection_event_local_time_issue(p_event.start_date, p_event.end_time, p_event.timezone);
  if v_issue is not null then
    v_issues := v_issues || ('end_time_' || v_issue);
  end if;

  /* §14: «V1 non ammette più giornate». Con un solo giorno civile la fine
     cade per costruzione nella stessa giornata locale; il controllo resta
     sull'istante proiettato per non dipendere da quella costruzione. */
  if p_event.start_date is not null and p_event.start_time is not null
     and p_event.end_time is not null
     and (public.selection_event_local_instant(p_event.start_date, p_event.end_time, p_event.timezone)
            at time zone p_event.timezone)::date <> p_event.start_date then
    v_issues := v_issues || 'multi_day'::text;
  end if;

  -- §16: anni a quattro cifre, plausibili, non futuri; mai invertiti.
  if (p_event.birth_year_from is null) <> (p_event.birth_year_to is null) then
    v_issues := v_issues || 'years_incomplete'::text;
  elsif p_event.birth_year_from is not null then
    if p_event.birth_year_from < (v_limits ->> 'birthYearMin')::int
       or p_event.birth_year_to < (v_limits ->> 'birthYearMin')::int
       or p_event.birth_year_from > (v_limits ->> 'birthYearMax')::int
       or p_event.birth_year_to > (v_limits ->> 'birthYearMax')::int then
      v_issues := v_issues || 'years_invalid'::text;
    elsif p_event.birth_year_from > p_event.birth_year_to then
      v_issues := v_issues || 'years_inverted'::text;
    end if;
  end if;

  if p_event.max_participants is not null
     and (p_event.max_participants < 1
          or p_event.max_participants > (v_limits ->> 'maxParticipants')::int) then
    v_issues := v_issues || 'capacity_invalid'::text;
  end if;

  -- §15: il termine non supera l'inizio.
  if (p_event.registration_deadline_date is null) <> (p_event.registration_deadline_time is null) then
    v_issues := v_issues || 'deadline_incomplete'::text;
  elsif p_event.registration_deadline_date is not null then
    v_issue := public.selection_event_local_time_issue(
      p_event.registration_deadline_date, p_event.registration_deadline_time, p_event.timezone);

    if v_issue is not null then
      v_issues := v_issues || ('deadline_time_' || v_issue);
    end if;

    if p_event.start_date is not null and p_event.start_time is not null
       and public.selection_event_local_instant(
             p_event.registration_deadline_date, p_event.registration_deadline_time, p_event.timezone)
           > public.selection_event_local_instant(p_event.start_date, p_event.start_time, p_event.timezone) then
      v_issues := v_issues || 'deadline_after_start'::text;
    end if;
  end if;

  return v_issues;
end;
$$;

/**
 * Motivi per cui l'evento non è pubblicabile adesso. Vuoto = pubblicabile.
 *
 * §19 — obbligatori: tipo, titolo, squadra valida, inizio futuro, struttura,
 * indirizzo, modalità; con iscrizioni aperte anche la conferma. Un termine
 * già trascorso **non** blocca: §15 chiede un avviso, non un rifiuto.
 */
create or replace function public.selection_event_publish_blockers(
  p_event public.selection_events
)
returns text[]
language plpgsql
stable
set search_path = public
as $$
declare
  v_issues text[] := public.selection_event_structural_issues(p_event);
begin
  if p_event.event_type is null then
    v_issues := v_issues || 'type_missing'::text;
  end if;

  if p_event.title is null or length(btrim(p_event.title)) = 0 then
    v_issues := v_issues || 'title_missing'::text;
  end if;

  if p_event.start_date is null or p_event.start_time is null then
    v_issues := v_issues || 'start_missing'::text;
  elsif public.selection_event_local_instant(p_event.start_date, p_event.start_time, p_event.timezone)
        <= now() then
    v_issues := v_issues || 'start_past'::text;
  end if;

  if p_event.venue_name is null or length(btrim(p_event.venue_name)) = 0 then
    v_issues := v_issues || 'venue_missing'::text;
  end if;

  if p_event.venue_address is null or length(btrim(p_event.venue_address)) = 0 then
    v_issues := v_issues || 'address_missing'::text;
  end if;

  if p_event.participation_mode is null then
    v_issues := v_issues || 'mode_missing'::text;
  elsif p_event.participation_mode = 'open_registration'
        and p_event.registration_confirmation_mode is null then
    v_issues := v_issues || 'confirmation_missing'::text;
  end if;

  if exists (
    select 1 from public.club_teams ct
    where ct.id = p_event.team_id and ct.is_archived
  ) then
    v_issues := v_issues || 'team_inactive'::text;
  end if;

  return v_issues;
end;
$$;

revoke all on function public.selection_event_structural_issues(public.selection_events) from public;
revoke all on function public.selection_event_publish_blockers(public.selection_events) from public;


/**
 * Testo libero ripulito (§21): trim, caratteri di controllo rimossi tranne
 * a capo e tabulazione, stringa vuota → null. Nessuna trasformazione di
 * `<` e `>`: il testo resta testo, e chi lo mostra lo rende come testo —
 * l'app non interpreta HTML, e il serializer pubblico della 29 farà
 * l'escaping del proprio canale.
 */
create or replace function public.selection_event_clean_text(p_value text, p_multiline boolean)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(btrim(
    case
      when p_multiline then regexp_replace(
        replace(coalesce(p_value, ''), E'\r\n', E'\n'),
        E'[\\x01-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', '', 'g')
      else regexp_replace(coalesce(p_value, ''), E'[\\x01-\\x1F\\x7F]', ' ', 'g')
    end
  ), '');
$$;

revoke all on function public.selection_event_clean_text(text, boolean) from public;


/**
 * Applica una patch parziale a una riga (§20: «Patch parziali non
 * cancellano dati non caricati o non modificati»).
 *
 * Solo le chiavi presenti cambiano; una chiave presente a `null` svuota il
 * campo. Le chiavi fuori whitelist sono un payload malformato, non campi da
 * ignorare in silenzio: `status`, `club_id`, `starts_at` non si scrivono da
 * qui (§19: «non una patch arbitraria status=PUBLISHED»).
 *
 * Con Solo su invito conferma e termine vengono **normalizzati** a null
 * (§17), invece di rifiutare un draft che li conserva da una scelta
 * precedente.
 */
create or replace function public.selection_event_apply_patch(
  p_event public.selection_events,
  p_patch jsonb
)
returns public.selection_events
language plpgsql
stable
set search_path = public
as $$
declare
  v_allowed constant text[] := array[
    'team_id', 'event_type', 'title',
    'start_date', 'start_time', 'end_time',
    'venue_name', 'venue_address', 'description', 'requirements_info',
    'birth_year_from', 'birth_year_to', 'max_participants',
    'participation_mode', 'registration_confirmation_mode',
    'registration_deadline_date', 'registration_deadline_time'
  ];
  v_key    text;
  v_result public.selection_events;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'SELECTION_EVENT_INVALID:malformed';
  end if;

  for v_key in select jsonb_object_keys(p_patch) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'SELECTION_EVENT_INVALID:malformed';
    end if;
  end loop;

  begin
    v_result := jsonb_populate_record(p_event, p_patch);
  exception when others then
    raise exception 'SELECTION_EVENT_INVALID:malformed';
  end;

  /* Un valore fuori dominio è un payload malformato, non un errore grezzo di
     CHECK che la UI non saprebbe tradurre. */
  if (v_result.event_type is not null and v_result.event_type not in ('tryout', 'stage', 'open_day'))
     or (v_result.participation_mode is not null
         and v_result.participation_mode not in ('open_registration', 'invite_only'))
     or (v_result.registration_confirmation_mode is not null
         and v_result.registration_confirmation_mode not in ('automatic', 'manual')) then
    raise exception 'SELECTION_EVENT_INVALID:malformed';
  end if;

  v_result.title             := public.selection_event_clean_text(v_result.title, false);
  v_result.venue_name        := public.selection_event_clean_text(v_result.venue_name, false);
  v_result.venue_address     := public.selection_event_clean_text(v_result.venue_address, false);
  v_result.description       := public.selection_event_clean_text(v_result.description, true);
  v_result.requirements_info := public.selection_event_clean_text(v_result.requirements_info, true);

  if v_result.participation_mode = 'invite_only' then
    v_result.registration_confirmation_mode := null;
    v_result.registration_deadline_date     := null;
    v_result.registration_deadline_time     := null;
  end if;

  return v_result;
end;
$$;

revoke all on function public.selection_event_apply_patch(public.selection_events, jsonb) from public;

/** Nomi delle colonne di contenuto cambiate: l'audit non registra valori. */
create or replace function public.selection_event_changed_fields(
  p_old public.selection_events,
  p_new public.selection_events
)
returns text[]
language sql
stable
set search_path = public
as $$
  select coalesce(array_agg(n.key order by n.key), array[]::text[])
  from jsonb_each(to_jsonb(p_new)) n
  where n.key not in ('version', 'updated_at', 'starts_at', 'ends_at', 'registration_deadline')
    and (to_jsonb(p_old) -> n.key) is distinct from n.value;
$$;

revoke all on function public.selection_event_changed_fields(public.selection_events, public.selection_events) from public;


-- ============================================================
-- SEZIONE 10 — letture (§10, §11, §12, §21)
-- ============================================================

/** Contesto del Centro e del wizard: identità, capability, fuso, limiti. */
create or replace function public.fetch_selection_events_center(p_club_id uuid)
returns table (
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  club_is_verified   boolean,
  can_create         boolean,
  scope_label        text,
  timezone_name      text,
  access_verified_at timestamptz,
  limits             jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope uuid[];
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_club_id is null
     or not exists (select 1 from public.clubs c where c.id = p_club_id)
     or not ('selection_events_view' = any (public.dashboard_club_capabilities(p_club_id))) then
    raise exception 'SELECTION_EVENTS_NOT_AUTHORIZED';
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, 'selection_events_view');

  return query
  select
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    /* §7: «Non dedurre can_create da una pagina incompleta di Team caricati
       dal client.» Vero solo se esiste almeno una squadra attiva in cui
       l'actor può creare. */
    exists (
      select 1 from public.club_teams ct
      where ct.club_id = p_club_id
        and not ct.is_archived
        and public.selection_event_can_operate(p_club_id, ct.id, 'create')
    ),
    /* Screen 16: l'ambito limitato si legge sotto il titolo. Solo i nomi
       delle squadre già nel perimetro, mai un conteggio di ciò che è fuori. */
    case
      when v_scope is null then null
      else (
        select string_agg(ct.name, ', ' order by ct.sort_order, ct.name)
        from public.club_teams ct
        where ct.id = any (v_scope) and ct.club_id = p_club_id
      )
    end,
    public.society_position_timezone(p_club_id),
    now(),
    public.selection_event_limits()
  from public.clubs c
  where c.id = p_club_id;
end;
$$;

revoke all on function public.fetch_selection_events_center(uuid) from public, anon;
grant execute on function public.fetch_selection_events_center(uuid) to authenticated;


create or replace function public.selection_events_cursor_encode(
  p_club_id uuid,
  p_section text,
  p_scope   text,
  p_k1      text,
  p_k2      text,
  p_id      uuid
)
returns text
language sql
stable
set search_path = public
as $$
  select encode(convert_to(
    'v1|' || p_club_id::text
          || '|' || p_section
          || '|' || auth.uid()::text
          || '|' || p_scope
          || '|' || coalesce(p_k1, '-')
          || '|' || coalesce(p_k2, '-')
          || '|' || p_id::text,
    'utf8'), 'base64');
$$;

/**
 * Decodifica e verifica (§12). Un token di un'altra Società, sezione, actor o
 * perimetro solleva: il client ricarica la sezione invece di unire snapshot
 * diversi (QA-030).
 */
create or replace function public.selection_events_cursor_decode(
  p_cursor  text,
  p_club_id uuid,
  p_section text,
  p_scope   text,
  out k1 text,
  out k2 text,
  out cursor_id uuid
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_parts text[];
begin
  begin
    v_parts := string_to_array(
      convert_from(decode(replace(p_cursor, E'\n', ''), 'base64'), 'utf8'), '|');

    if array_length(v_parts, 1) <> 8
       or v_parts[1] <> 'v1'
       or v_parts[2] <> p_club_id::text
       or v_parts[3] <> p_section
       or v_parts[4] <> auth.uid()::text
       or v_parts[5] <> p_scope then
      raise exception 'SELECTION_EVENTS_CURSOR_INVALID';
    end if;

    k1        := nullif(v_parts[6], '-');
    k2        := nullif(v_parts[7], '-');
    cursor_id := v_parts[8]::uuid;
  exception when others then
    raise exception 'SELECTION_EVENTS_CURSOR_INVALID';
  end;
end;
$$;

revoke all on function public.selection_events_cursor_encode(uuid, text, text, text, text, uuid) from public;
revoke all on function public.selection_events_cursor_decode(text, uuid, text, text) from public;


/**
 * Una pagina di una sezione del Centro (§10, §11, §12).
 *
 *   upcoming → PUBLISHED, starts_at ASC, id ASC; un PUBLISHED senza data
 *              (solo legacy: il CHECK lo impedisce ai nuovi) va in fondo;
 *   drafts   → DRAFT, updated_at DESC, id DESC;
 *   history  → COMPLETED/CANCELLED, coalesce(starts_at, updated_at) DESC,
 *              id DESC. Il fallback su updated_at copre i record storici
 *              senza data (§12, criterio documentato).
 *
 * Accesso e scope sono applicati **prima** del keyset e del limite (§12):
 * un actor Primavera non riceve righe né conteggi di altre squadre.
 *
 * Il read model è quello di §21: nessun testo esteso, nessun indirizzo,
 * nessun partecipante.
 */
create or replace function public.fetch_selection_events_page(
  p_club_id uuid,
  p_section text,
  p_cursor  text default null,
  p_limit   integer default 10
)
returns table (
  event_id               uuid,
  title                  text,
  event_type             text,
  status                 text,
  team_id                uuid,
  team_name              text,
  start_date             date,
  start_time             time,
  starts_at              timestamptz,
  timezone_name          text,
  max_participants       integer,
  confirmed_count        integer,
  pending_requests_count integer,
  counts_available       boolean,
  is_full                boolean,
  updated_at             timestamptz,
  can_edit               boolean,
  has_more               boolean,
  next_cursor            text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope       uuid[];
  v_fingerprint text;
  v_limit       integer := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_k1          text;
  v_k2          text;
  v_cid         uuid;
  v_statuses    text[];
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_section not in ('upcoming', 'drafts', 'history') then
    raise exception 'SELECTION_EVENTS_SECTION_INVALID';
  end if;

  if p_club_id is null
     or not ('selection_events_view' = any (public.dashboard_club_capabilities(p_club_id))) then
    raise exception 'SELECTION_EVENTS_NOT_AUTHORIZED';
  end if;

  v_scope       := public.dashboard_club_capability_scope(p_club_id, 'selection_events_view');
  v_fingerprint := public.selection_events_scope_fingerprint(p_club_id);

  if p_cursor is not null and length(p_cursor) > 0 then
    select d.k1, d.k2, d.cursor_id into v_k1, v_k2, v_cid
    from public.selection_events_cursor_decode(p_cursor, p_club_id, p_section, v_fingerprint) d;
  end if;

  v_statuses := case p_section
    when 'upcoming' then array['published']
    when 'drafts'   then array['draft']
    else array['completed', 'cancelled']
  end;

  return query
  with visible as (
    select
      e.*,
      ct.name as t_name,
      /* Chiavi di ordinamento esplicite e testuali, così il cursore le porta
         senza perdere precisione: microsecondi dall'epoca, a larghezza fissa
         perché il confronto fra stringhe coincida con quello numerico. */
      case p_section
        when 'upcoming' then case when e.starts_at is null then '1' else '0' end
        when 'drafts'   then null
        else null
      end as sk1,
      lpad(((extract(epoch from case p_section
          when 'upcoming' then coalesce(e.starts_at, e.updated_at)
          when 'drafts'   then e.updated_at
          else coalesce(e.starts_at, e.updated_at)
        end) * 1000000)::bigint)::text, 20, '0') as sk2
    from public.selection_events e
    join public.club_teams ct on ct.id = e.team_id
    where e.club_id = p_club_id
      and e.status = any (v_statuses)
      and (v_scope is null or e.team_id = any (v_scope))
  ),
  page as (
    select v.*
    from visible v
    where v_cid is null
       or (p_section = 'upcoming'
           and (v.sk1, v.sk2, v.id) > (v_k1, v_k2, v_cid))
       or (p_section <> 'upcoming'
           and (v.sk2, v.id) < (v_k2, v_cid))
    order by
      case when p_section = 'upcoming' then v.sk1 end asc,
      case when p_section = 'upcoming' then v.sk2 end asc,
      case when p_section = 'upcoming' then v.id  end asc,
      case when p_section <> 'upcoming' then v.sk2 end desc,
      case when p_section <> 'upcoming' then v.id  end desc
    limit v_limit + 1
  ),
  numbered as (
    select
      p.*,
      row_number() over (
        order by
          case when p_section = 'upcoming' then p.sk1 end asc,
          case when p_section = 'upcoming' then p.sk2 end asc,
          case when p_section = 'upcoming' then p.id  end asc,
          case when p_section <> 'upcoming' then p.sk2 end desc,
          case when p_section <> 'upcoming' then p.id  end desc
      ) as rn,
      count(*) over () as total
    from page p
  )
  select
    n.id,
    n.title,
    n.event_type,
    n.status,
    n.team_id,
    n.t_name,
    n.start_date,
    n.start_time,
    n.starts_at,
    n.timezone,
    n.max_participants,
    /* §11: conteggi solo fuori dalle bozze. Una bozza non ha partecipazione
       (QA-017), lo storico mostra il finale canonico se esiste. */
    case
      when n.status = 'draft' then null
      when n.status in ('completed', 'cancelled') and n.final_confirmed_count is not null
        then n.final_confirmed_count
      else c.confirmed_count
    end,
    case when n.status = 'published' then c.pending_requests_count else null end,
    n.status <> 'draft',
    n.status = 'published'
      and n.max_participants is not null
      and coalesce(c.confirmed_count, 0) >= n.max_participants,
    n.updated_at,
    case
      when n.status = 'draft' then public.selection_event_can_operate(p_club_id, n.team_id, 'edit')
      else public.selection_event_can_operate(p_club_id, n.team_id, 'manage')
    end,
    n.total > v_limit,
    public.selection_events_cursor_encode(p_club_id, p_section, v_fingerprint, n.sk1, n.sk2, n.id)
  from numbered n
  left join lateral public.selection_event_participation_counts(n.id) c on true
  where n.rn <= v_limit
  order by n.rn;
end;
$$;

revoke all on function public.fetch_selection_events_page(uuid, text, text, integer) from public, anon;
grant execute on function public.fetch_selection_events_page(uuid, text, text, integer) to authenticated;


/** Squadre utilizzabili come destinazione nel wizard (§9). */
create or replace function public.fetch_selection_event_teams(p_club_id uuid)
returns table (
  team_id       uuid,
  team_name     text,
  context_label text,
  can_create    boolean,
  can_edit      boolean,
  sort_order    integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_season text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_club_id is null
     or not ('selection_events_view' = any (public.dashboard_club_capabilities(p_club_id))) then
    raise exception 'SELECTION_EVENTS_NOT_AUTHORIZED';
  end if;

  select s.id into v_season
  from public.seasons s
  where current_date between s.starts_on and s.ends_on
  order by s.sort_order desc
  limit 1;

  return query
  select
    ct.id,
    ct.name,
    /* Livello o tipo dalla stagione corrente (DAS-REV-08), mai dal nome.
       Una stagione mancante non viene creata da qui (§9). */
    coalesce(
      (select tl.label
         from public.club_team_seasons cts
         join public.team_levels tl on tl.id = cts.level_id
        where cts.team_id = ct.id and cts.season_id = v_season),
      (select tt.label
         from public.club_team_seasons cts
         join public.team_types tt on tt.id = cts.team_type_id
        where cts.team_id = ct.id and cts.season_id = v_season),
      nullif(ct.category, '')
    ),
    public.selection_event_can_operate(p_club_id, ct.id, 'create'),
    public.selection_event_can_operate(p_club_id, ct.id, 'edit'),
    ct.sort_order
  from public.club_teams ct
  where ct.club_id = p_club_id
    and not ct.is_archived
    and public.selection_event_can_operate(p_club_id, ct.id, 'edit')
  order by ct.sort_order, ct.name;
end;
$$;

revoke all on function public.fetch_selection_event_teams(uuid) from public, anon;
grant execute on function public.fetch_selection_event_teams(uuid) to authenticated;


/**
 * Configurazione completa per il wizard (§21: «Form/detail autorizzato può
 * leggere la configurazione completa»). Un evento inesistente, di un'altra
 * Società o fuori scope producono lo stesso errore (QA-007).
 */
create or replace function public.fetch_selection_event_editor(p_event_id uuid)
returns table (
  event_id                       uuid,
  club_id                        uuid,
  team_id                        uuid,
  team_name                      text,
  team_is_archived               boolean,
  event_type                     text,
  title                          text,
  status                         text,
  timezone_name                  text,
  start_date                     date,
  start_time                     time,
  end_time                       time,
  venue_name                     text,
  venue_address                  text,
  description                    text,
  requirements_info              text,
  birth_year_from                smallint,
  birth_year_to                  smallint,
  max_participants               integer,
  participation_mode             text,
  registration_confirmation_mode text,
  registration_deadline_date     date,
  registration_deadline_time     time,
  version                        integer,
  can_edit                       boolean,
  can_publish                    boolean,
  has_activity                   boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event public.selection_events;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_event from public.selection_events e where e.id = p_event_id;

  if not found
     or not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'view') then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  return query
  select
    v_event.id,
    v_event.club_id,
    v_event.team_id,
    ct.name,
    ct.is_archived,
    v_event.event_type,
    v_event.title,
    v_event.status,
    v_event.timezone,
    v_event.start_date,
    v_event.start_time,
    v_event.end_time,
    v_event.venue_name,
    v_event.venue_address,
    v_event.description,
    v_event.requirements_info,
    v_event.birth_year_from,
    v_event.birth_year_to,
    v_event.max_participants,
    v_event.participation_mode,
    v_event.registration_confirmation_mode,
    v_event.registration_deadline_date,
    v_event.registration_deadline_time,
    v_event.version,
    case
      when v_event.status = 'draft' then public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'edit')
      when v_event.status = 'published' then public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'manage')
      else false
    end,
    v_event.status = 'draft'
      and public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'publish'),
    public.selection_event_has_activity(v_event.id)
  from public.club_teams ct
  where ct.id = v_event.team_id;
end;
$$;

revoke all on function public.fetch_selection_event_editor(uuid) from public, anon;
grant execute on function public.fetch_selection_event_editor(uuid) to authenticated;


-- ============================================================
-- SEZIONE 11 — comandi (§13, §19, §20, §21)
-- ============================================================

/**
 * Salva bozza: crea (`p_event_id` null) o aggiorna una DRAFT.
 *
 * §13: validazione permissiva — nessun campo di pubblicazione richiesto —
 * ma **squadra obbligatoria** alla creazione, e regole strutturali sempre.
 * §21: idempotente (chiave + impronta del contenuto) e versionato
 * (`p_expected_version` deve coincidere; null solo per la creazione).
 */
create or replace function public.save_selection_event_draft(
  p_club_id          uuid,
  p_event_id         uuid,
  p_expected_version integer,
  p_patch            jsonb,
  p_idempotency_key  text
)
returns table (
  event_id uuid,
  version  integer,
  status   text,
  replayed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_op         text := case when p_event_id is null then 'create' else 'save' end;
  v_resource   uuid := coalesce(p_event_id, p_club_id);
  /* La creazione ha un'impronta **costante** (come DAS-REV-24): la sua
     chiave identifica «la bozza di questa sessione», non un contenuto. Un
     retry dopo un esito perso, anche con campi cambiati nel frattempo,
     ritrova lo stesso evento invece di crearne un secondo (§13); il client
     applica poi le modifiche rimaste come aggiornamento versionato. */
  v_finger     text := case
    when p_event_id is null then md5('create')
    else md5(coalesce(p_patch::text, '') || '|' || coalesce(p_expected_version::text, '-'))
  end;
  v_receipt    jsonb;
  v_old        public.selection_events;
  v_new        public.selection_events;
  v_issues     text[];
  v_team       uuid;
  v_result     jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  /* Due chiamate concorrenti con la stessa chiave si serializzano qui: la
     seconda trova la ricevuta della prima invece di eseguire di nuovo, o di
     cadere in un conflitto di versione per un comando riuscito (§21). */
  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('selection_event_op:' || p_idempotency_key));
  end if;

  v_receipt := public.selection_event_operation_replay(p_idempotency_key, v_resource, v_op, v_finger);

  if v_receipt is not null then
    /* DAS-REV-23: sul replay si restituisce la proiezione corrente, non la
       ricevuta storica — una versione superata non deve tornare nella UI. */
    /* Una ricevuta non sopravvive a una revoca (§21: «Rivalida permission e
       scope al commit»): il replay restituisce la proiezione solo a chi può
       ancora vederla. */
    if not exists (
      select 1 from public.selection_events e
      where e.id = (v_receipt ->> 'event_id')::uuid
        and public.selection_event_can_operate(e.club_id, e.team_id, 'view')
    ) then
      raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
    end if;

    return query
    select e.id, e.version, e.status, true
    from public.selection_events e
    where e.id = (v_receipt ->> 'event_id')::uuid;
    return;
  end if;

  if p_event_id is null then
    -- ── Creazione ────────────────────────────────────────────────────────
    /* §9: una squadra sola. Un array, un oggetto o un testo non-uuid sono un
       payload malformato, non un errore di cast da mostrare grezzo. */
    if p_patch is not null and jsonb_typeof(p_patch) = 'object'
       and p_patch ? 'team_id'
       and jsonb_typeof(p_patch -> 'team_id') not in ('string', 'null') then
      raise exception 'SELECTION_EVENT_INVALID:malformed';
    end if;

    begin
      v_team := nullif(p_patch ->> 'team_id', '')::uuid;
    exception when others then
      raise exception 'SELECTION_EVENT_INVALID:malformed';
    end;

    if v_team is null then
      raise exception 'SELECTION_EVENT_INVALID:team_missing';
    end if;

    if p_club_id is null
       or not public.selection_event_can_operate(p_club_id, v_team, 'create') then
      raise exception 'SELECTION_EVENT_NOT_AUTHORIZED';
    end if;

    v_old.club_id    := p_club_id;
    v_old.team_id    := v_team;
    v_old.status     := 'draft';
    v_old.timezone   := public.society_position_timezone(p_club_id);
    v_old.created_by := v_uid;

    v_new := public.selection_event_apply_patch(v_old, p_patch);
  else
    -- ── Aggiornamento ────────────────────────────────────────────────────
    select * into v_old
    from public.selection_events e
    where e.id = p_event_id
    for update;

    if not found
       or v_old.club_id is distinct from p_club_id
       or not public.selection_event_can_operate(v_old.club_id, v_old.team_id, 'view') then
      raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
    end if;

    if v_old.status <> 'draft' then
      raise exception 'SELECTION_EVENT_LIFECYCLE_CONFLICT';
    end if;

    if not public.selection_event_can_operate(v_old.club_id, v_old.team_id, 'edit') then
      raise exception 'SELECTION_EVENT_NOT_AUTHORIZED';
    end if;

    if p_expected_version is null or p_expected_version <> v_old.version then
      raise exception 'SELECTION_EVENT_VERSION_CONFLICT';
    end if;

    v_new := public.selection_event_apply_patch(v_old, p_patch);

    if v_new.team_id is null then
      raise exception 'SELECTION_EVENT_INVALID:team_missing';
    end if;

    /* §20: cambio di squadra con accesso su vecchia **e** nuova. */
    if v_new.team_id is distinct from v_old.team_id
       and not public.selection_event_can_operate(v_old.club_id, v_new.team_id, 'edit') then
      raise exception 'SELECTION_EVENT_NOT_AUTHORIZED';
    end if;
  end if;

  v_issues := public.selection_event_structural_issues(v_new);

  if array_length(v_issues, 1) is not null then
    raise exception 'SELECTION_EVENT_INVALID:%', array_to_string(v_issues, ',');
  end if;

  if p_event_id is null then
    insert into public.selection_events (
      club_id, team_id, event_type, title, status, timezone,
      start_date, start_time, end_time, venue_name, venue_address,
      description, requirements_info, birth_year_from, birth_year_to,
      max_participants, participation_mode, registration_confirmation_mode,
      registration_deadline_date, registration_deadline_time, created_by
    ) values (
      v_new.club_id, v_new.team_id, v_new.event_type, v_new.title, 'draft', v_new.timezone,
      v_new.start_date, v_new.start_time, v_new.end_time, v_new.venue_name, v_new.venue_address,
      v_new.description, v_new.requirements_info, v_new.birth_year_from, v_new.birth_year_to,
      v_new.max_participants, v_new.participation_mode, v_new.registration_confirmation_mode,
      v_new.registration_deadline_date, v_new.registration_deadline_time, v_uid
    )
    returning * into v_new;

    insert into public.selection_event_audit (event_id, club_id, actor_id, operation, version, changed_fields)
    values (v_new.id, v_new.club_id, v_uid, 'create', v_new.version,
            public.selection_event_changed_fields(v_old, v_new));
  else
    update public.selection_events e
    set team_id                        = v_new.team_id,
        event_type                     = v_new.event_type,
        title                          = v_new.title,
        start_date                     = v_new.start_date,
        start_time                     = v_new.start_time,
        end_time                       = v_new.end_time,
        venue_name                     = v_new.venue_name,
        venue_address                  = v_new.venue_address,
        description                    = v_new.description,
        requirements_info              = v_new.requirements_info,
        birth_year_from                = v_new.birth_year_from,
        birth_year_to                  = v_new.birth_year_to,
        max_participants               = v_new.max_participants,
        participation_mode             = v_new.participation_mode,
        registration_confirmation_mode = v_new.registration_confirmation_mode,
        registration_deadline_date     = v_new.registration_deadline_date,
        registration_deadline_time     = v_new.registration_deadline_time
    where e.id = v_old.id
    returning * into v_new;

    if v_new.version <> v_old.version then
      insert into public.selection_event_audit (event_id, club_id, actor_id, operation, version, changed_fields)
      values (v_new.id, v_new.club_id, v_uid, 'save_draft', v_new.version,
              public.selection_event_changed_fields(v_old, v_new));
    end if;
  end if;

  v_result := jsonb_build_object('event_id', v_new.id, 'version', v_new.version);
  perform public.selection_event_operation_record(
    p_idempotency_key, v_new.club_id, v_resource, v_op, v_finger, v_result);

  return query select v_new.id, v_new.version, v_new.status, false;
end;
$$;

revoke all on function public.save_selection_event_draft(uuid, uuid, integer, jsonb, text) from public, anon;
grant execute on function public.save_selection_event_draft(uuid, uuid, integer, jsonb, text) to authenticated;


/**
 * Pubblica evento (§19): comando esplicito su una DRAFT alla versione che
 * l'utente ha confermato. Stesso ID, nessuna copia.
 *
 * Nessuna iscrizione, invito, notifica o Follow nasce da qui (§23).
 */
create or replace function public.publish_selection_event(
  p_event_id         uuid,
  p_expected_version integer,
  p_idempotency_key  text
)
returns table (
  event_id uuid,
  version  integer,
  status   text,
  replayed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_finger   text := md5(coalesce(p_expected_version::text, '-'));
  v_receipt  jsonb;
  v_event    public.selection_events;
  v_issues   text[];
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  /* Due chiamate concorrenti con la stessa chiave si serializzano qui: la
     seconda trova la ricevuta della prima invece di eseguire di nuovo, o di
     cadere in un conflitto di versione per un comando riuscito (§21). */
  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('selection_event_op:' || p_idempotency_key));
  end if;

  v_receipt := public.selection_event_operation_replay(p_idempotency_key, p_event_id, 'publish', v_finger);

  if v_receipt is not null then
    /* §19: «Retry publish sullo stesso intento già riuscito restituisce
       risultato consistente, senza una seconda pubblicazione/audit.» Lo
       stato restituito è quello **attuale**: un evento nel frattempo
       annullato non torna PUBLISHED per effetto di un retry (QA-090). */
    /* Una ricevuta non sopravvive a una revoca (§21: «Rivalida permission e
       scope al commit»): il replay restituisce la proiezione solo a chi può
       ancora vederla. */
    if not exists (
      select 1 from public.selection_events e
      where e.id = p_event_id
        and public.selection_event_can_operate(e.club_id, e.team_id, 'view')
    ) then
      raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
    end if;

    return query
    select e.id, e.version, e.status, true
    from public.selection_events e
    where e.id = p_event_id;
    return;
  end if;

  select * into v_event
  from public.selection_events e
  where e.id = p_event_id
  for update;

  if not found
     or not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'view') then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  if not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'publish') then
    raise exception 'SELECTION_EVENT_NOT_AUTHORIZED';
  end if;

  if v_event.status <> 'draft' then
    raise exception 'SELECTION_EVENT_LIFECYCLE_CONFLICT';
  end if;

  /* §19: «Se la versione è cambiata, preserva draft e mostra conflitto; non
     pubblicare le modifiche di un altro dispositivo senza riesame.» */
  if p_expected_version is null or p_expected_version <> v_event.version then
    raise exception 'SELECTION_EVENT_VERSION_CONFLICT';
  end if;

  v_issues := public.selection_event_publish_blockers(v_event);

  if array_length(v_issues, 1) is not null then
    raise exception 'SELECTION_EVENT_NOT_PUBLISHABLE:%', array_to_string(v_issues, ',');
  end if;

  update public.selection_events e
  set status       = 'published',
      published_at = now(),
      published_by = v_uid
  where e.id = v_event.id
  returning * into v_event;

  insert into public.selection_event_audit (event_id, club_id, actor_id, operation, version, changed_fields)
  values (v_event.id, v_event.club_id, v_uid, 'publish', v_event.version, array['status']);

  perform public.selection_event_operation_record(
    p_idempotency_key, v_event.club_id, v_event.id, 'publish', v_finger,
    jsonb_build_object('event_id', v_event.id, 'version', v_event.version));

  return query select v_event.id, v_event.version, v_event.status, false;
end;
$$;

revoke all on function public.publish_selection_event(uuid, integer, text) from public, anon;
grant execute on function public.publish_selection_event(uuid, integer, text) to authenticated;


/**
 * Modifica di un evento PUBLISHED (§20), nello **stesso servizio** che il
 * dettaglio gestionale userà: la 28 non crea un secondo editor, ma le regole
 * vivono qui e sono provate a livello di servizio.
 *
 *   · i campi pubblicati restano validi dopo la patch (§19);
 *   · un nuovo inizio deve essere futuro; un inizio invariato già passato
 *     non blocca altre modifiche (§15: non distruggere un evento in corso);
 *   · Team, tipo, modalità e conferma non cambiano dopo **qualsiasi**
 *     attività operativa (§20), indipendentemente dai confermati;
 *   · il limite non scende sotto i confermati, letti nello stesso confine
 *     di concorrenza delle conferme (`for update` sulla riga, §18);
 *   · anni e termine cambiano senza effetti sulle partecipazioni esistenti.
 */
create or replace function public.update_selection_event(
  p_event_id         uuid,
  p_expected_version integer,
  p_patch            jsonb,
  p_idempotency_key  text
)
returns table (
  event_id uuid,
  version  integer,
  status   text,
  replayed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_finger    text := md5(coalesce(p_patch::text, '') || '|' || coalesce(p_expected_version::text, '-'));
  v_receipt   jsonb;
  v_old       public.selection_events;
  v_new       public.selection_events;
  v_issues    text[];
  v_confirmed integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  /* Due chiamate concorrenti con la stessa chiave si serializzano qui: la
     seconda trova la ricevuta della prima invece di eseguire di nuovo, o di
     cadere in un conflitto di versione per un comando riuscito (§21). */
  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('selection_event_op:' || p_idempotency_key));
  end if;

  v_receipt := public.selection_event_operation_replay(p_idempotency_key, p_event_id, 'update', v_finger);

  if v_receipt is not null then
    /* Una ricevuta non sopravvive a una revoca (§21: «Rivalida permission e
       scope al commit»): il replay restituisce la proiezione solo a chi può
       ancora vederla. */
    if not exists (
      select 1 from public.selection_events e
      where e.id = p_event_id
        and public.selection_event_can_operate(e.club_id, e.team_id, 'view')
    ) then
      raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
    end if;

    return query
    select e.id, e.version, e.status, true
    from public.selection_events e
    where e.id = p_event_id;
    return;
  end if;

  select * into v_old
  from public.selection_events e
  where e.id = p_event_id
  for update;

  if not found
     or not public.selection_event_can_operate(v_old.club_id, v_old.team_id, 'view') then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  if v_old.status <> 'published' then
    raise exception 'SELECTION_EVENT_LIFECYCLE_CONFLICT';
  end if;

  if not public.selection_event_can_operate(v_old.club_id, v_old.team_id, 'manage') then
    raise exception 'SELECTION_EVENT_NOT_AUTHORIZED';
  end if;

  if p_expected_version is null or p_expected_version <> v_old.version then
    raise exception 'SELECTION_EVENT_VERSION_CONFLICT';
  end if;

  v_new := public.selection_event_apply_patch(v_old, p_patch);

  if v_new.team_id is null then
    raise exception 'SELECTION_EVENT_INVALID:team_missing';
  end if;

  if v_new.team_id is distinct from v_old.team_id
     and not public.selection_event_can_operate(v_old.club_id, v_new.team_id, 'manage') then
    raise exception 'SELECTION_EVENT_NOT_AUTHORIZED';
  end if;

  if public.selection_event_has_activity(v_old.id)
     and (v_new.team_id is distinct from v_old.team_id
          or v_new.event_type is distinct from v_old.event_type
          or v_new.participation_mode is distinct from v_old.participation_mode
          or v_new.registration_confirmation_mode is distinct from v_old.registration_confirmation_mode) then
    raise exception 'SELECTION_EVENT_STRUCTURE_LOCKED';
  end if;

  select c.confirmed_count into v_confirmed
  from public.selection_event_participation_counts(v_old.id) c;

  if v_new.max_participants is not null
     and v_new.max_participants is distinct from v_old.max_participants
     and v_new.max_participants < coalesce(v_confirmed, 0) then
    raise exception 'SELECTION_EVENT_INVALID:capacity_below_confirmed';
  end if;

  v_issues := public.selection_event_publish_blockers(v_new);

  /* L'inizio passato blocca solo se l'inizio è stato toccato. */
  if v_new.start_date is not distinct from v_old.start_date
     and v_new.start_time is not distinct from v_old.start_time then
    v_issues := array_remove(v_issues, 'start_past');
  end if;

  /* Una squadra archiviata resta un riferimento storico valido finché non
     la si cambia (§9). */
  if v_new.team_id is not distinct from v_old.team_id then
    v_issues := array_remove(v_issues, 'team_inactive');
  end if;

  if array_length(v_issues, 1) is not null then
    raise exception 'SELECTION_EVENT_INVALID:%', array_to_string(v_issues, ',');
  end if;

  update public.selection_events e
  set team_id                        = v_new.team_id,
      event_type                     = v_new.event_type,
      title                          = v_new.title,
      start_date                     = v_new.start_date,
      start_time                     = v_new.start_time,
      end_time                       = v_new.end_time,
      venue_name                     = v_new.venue_name,
      venue_address                  = v_new.venue_address,
      description                    = v_new.description,
      requirements_info              = v_new.requirements_info,
      birth_year_from                = v_new.birth_year_from,
      birth_year_to                  = v_new.birth_year_to,
      max_participants               = v_new.max_participants,
      participation_mode             = v_new.participation_mode,
      registration_confirmation_mode = v_new.registration_confirmation_mode,
      registration_deadline_date     = v_new.registration_deadline_date,
      registration_deadline_time     = v_new.registration_deadline_time
  where e.id = v_old.id
  returning * into v_new;

  if v_new.version <> v_old.version then
    insert into public.selection_event_audit (event_id, club_id, actor_id, operation, version, changed_fields)
    values (v_new.id, v_new.club_id, v_uid, 'update', v_new.version,
            public.selection_event_changed_fields(v_old, v_new));
  end if;

  perform public.selection_event_operation_record(
    p_idempotency_key, v_new.club_id, v_new.id, 'update', v_finger,
    jsonb_build_object('event_id', v_new.id, 'version', v_new.version));

  return query select v_new.id, v_new.version, v_new.status, false;
end;
$$;

revoke all on function public.update_selection_event(uuid, integer, jsonb, text) from public, anon;
grant execute on function public.update_selection_event(uuid, integer, jsonb, text) to authenticated;


-- ============================================================
-- SEZIONE 12 — chiusura delle funzioni interne
--
-- Playbook: «`revoke ... from public` non chiude `anon`» — le default
-- privileges di Supabase concedono l'execute direttamente ai ruoli API. Le
-- funzioni qui sotto sono interne ai comandi `security definer` (che le
-- eseguono come owner) e non sono endpoint.
-- ============================================================

revoke execute on function public.selection_event_local_instant(date, time, text) from anon, authenticated;
revoke execute on function public.selection_event_local_time_issue(date, time, text) from anon, authenticated;
revoke execute on function public.selection_event_participation_counts(uuid) from anon, authenticated;
revoke execute on function public.selection_event_has_activity(uuid) from anon, authenticated;
revoke execute on function public.selection_event_capacity_allows_confirmation(uuid) from anon, authenticated;
revoke execute on function public.selection_event_operation_replay(text, uuid, text, text) from anon, authenticated;
revoke execute on function public.selection_event_operation_record(text, uuid, uuid, text, text, jsonb) from anon, authenticated;
revoke execute on function public.selection_events_scope_fingerprint(uuid) from anon, authenticated;
revoke execute on function public.selection_event_structural_issues(public.selection_events) from anon, authenticated;
revoke execute on function public.selection_event_publish_blockers(public.selection_events) from anon, authenticated;
revoke execute on function public.selection_event_clean_text(text, boolean) from anon, authenticated;
revoke execute on function public.selection_event_apply_patch(public.selection_events, jsonb) from anon, authenticated;
revoke execute on function public.selection_event_changed_fields(public.selection_events, public.selection_events) from anon, authenticated;
revoke execute on function public.selection_events_cursor_encode(uuid, text, text, text, text, uuid) from anon, authenticated;
revoke execute on function public.selection_events_cursor_decode(text, uuid, text, text) from anon, authenticated;
revoke execute on function public.selection_event_can_operate(uuid, uuid, text) from anon;
revoke execute on function public.selection_event_limits() from anon;
revoke execute on function public.selection_events_derive() from anon, authenticated;
