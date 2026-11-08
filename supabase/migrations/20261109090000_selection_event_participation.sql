-- DAS-REV-29 — Eventi: landing e iscrizione
--
-- DAS-REV-28 ha creato l'evento canonico e ha lasciato tre funzioni di
-- contratto (`selection_event_participation_counts`, `_has_activity`,
-- `_capacity_allows_confirmation`) che restituivano zeri dichiarati perché il
-- dominio partecipazioni non esisteva. Questa migrazione lo crea e
-- **ridefinisce quelle tre funzioni** invece di affiancarne altre: Centro,
-- editor e guard di modifica le chiamano già.
--
-- Cosa mancava, e cosa introduce:
--
--   1. **identificatore pubblico stabile** (§9). L'evento aveva solo l'UUID
--      interno. `public_id` è casuale, indipendente dal titolo, assegnato
--      **solo** quando l'evento diventa promuovibile (PUBLISHED +
--      OPEN_REGISTRATION) e poi immutabile. `public_exposed_at` registra la
--      prima esposizione pubblica: è la policy esplicita di «precedente
--      esposizione» che §9 chiede per CANCELLED/COMPLETED, invece di dedurla
--      dal lifecycle corrente. Nessun URL pubblico è mai stato distribuito
--      prima di questa migrazione, quindi non ci sono alias da migrare;
--   2. **locandina opzionale** (§8). Il progetto non ha una tabella media
--      canonica: i media sono oggetti Storage referenziati per URL. Per avere
--      un riferimento con controllo di ownership serve una riga: nasce
--      `selection_event_flyer_assets`, popolata solo da un comando che legge
--      l'oggetto reale in `storage.objects` (MIME dichiarato, peso, autore)
--      e lo lega alla Società. Il bucket è **privato**: la locandina di una
--      bozza o di un evento solo su invito non ha un URL permanente pubblico;
--      la lettura passa da una policy che riusa la stessa regola di
--      visibilità della landing;
--   3. **partecipazione canonica** (§13): una riga per `(event_id,
--      person_id)` con vincolo univoco, riusata dopo il ritiro, e lo storico
--      delle transizioni in una tabella append-only separata (§22). La
--      tabella è nuova, quindi non esistono duplicati da riconciliare prima
--      del vincolo (§26, QA-128);
--   4. la **matrice di disponibilità** (§10) calcolata una volta sola, con il
--      tempo del server, e usata da landing pubblica, dettaglio personale e
--      comandi: `selection_event_availability`;
--   5. letture separate per proiezione (§7, §11): pubblica anonima in
--      allowlist, dettaglio autenticato con stato personale, preview e
--      dettaglio della richiesta per la Società;
--   6. i comandi `register / withdraw / confirm / reject` con lock sulla riga
--      dell'evento — lo stesso confine di concorrenza di `update_selection_event`
--      (modifica del limite) — ricevute idempotenti e storico (§15–§21);
--   7. le notifiche di conferma e non accettazione, scritte nella stessa
--      transazione della decisione e deduplicate per transizione (§22).
--
-- Scelte che lo spec lascia aperte, dichiarate qui:
--
--   · **profilo sportivo autorizzato** (§13). Il dominio ha una sola regola
--     di iscrizione personale già canonica: quella delle candidature, che per
--     il calciatore richiede `profiles.role = 'player'` **e** una riga in
--     `player_profiles`. Gli eventi non hanno un ruolo destinatario, e anni di
--     nascita di riferimento e copy («Calciatore · Classe 2008») descrivono
--     calciatori: si riusa quella regola. Allenatori e staff restano esclusi
--     finché una specifica non li include;
--   · **blocking** (§13): un blocco in `user_blocks` fra la persona e il
--     profilo proprietario della Società, in qualunque direzione, rende la
--     persona non eleggibile. È la stessa coppia che la messaggistica usa;
--   · **capability di gestione partecipanti** (§17): il catalogo della 28 non
--     ne ha una dedicata. Conferma e non accettazione richiedono
--     `selection_events_manage` sulla squadra dell'evento (azione `manage` di
--     `selection_event_can_operate`), cioè lo stesso controllo che governa la
--     modifica di un evento pubblicato. Nessuna chiave nuova, nessun backfill;
--   · **push**: il progetto non ha un provider push né un outbox. La riga di
--     `notifications` nasce nella transazione della decisione — il commit
--     non dipende da un servizio esterno (§22) — e un retry del comando non
--     la duplica (indice univoco per partecipazione + versione).
--
-- Funzioni riemesse, ciascuna dalla **definizione più recente** (playbook:
-- «funzioni ricreate dal file sbagliato»):
--   selection_events_derive, selection_event_limits, selection_event_apply_patch,
--   save_selection_event_draft, update_selection_event,
--   fetch_selection_event_editor            ← 20261108090000_selection_events.sql
--   notifications_before_insert             ← 20261101090000_person_society_link.sql
--
-- Idempotenza: `if not exists`, `create or replace`, `drop ... if exists`,
-- bucket con `on conflict`.


-- ============================================================
-- SEZIONE 1 — colonne nuove sull'evento (§8, §9)
-- ============================================================

alter table public.selection_events
  add column if not exists public_id         text,
  add column if not exists public_exposed_at timestamptz,
  add column if not exists flyer_media_id    uuid;

create unique index if not exists selection_events_public_id_uniq
  on public.selection_events (public_id)
  where public_id is not null;

comment on column public.selection_events.public_id is
  'DAS-REV-29 §9: identificatore pubblico stabile del link. Assegnato alla '
  'prima esposizione promozionale, indipendente da titolo/data/luogo, '
  'immutabile. Conoscerlo non dà accesso a un evento non pubblico.';

comment on column public.selection_events.public_exposed_at is
  'DAS-REV-29 §9: prima volta in cui l''evento è stato PUBLISHED + '
  'OPEN_REGISTRATION. Policy esplicita di precedente esposizione pubblica '
  'per mostrare annullamento/conclusione sul vecchio link.';

/** 16 caratteri url-safe da 12 byte casuali: non enumerabile, non derivato. */
create or replace function public.selection_event_new_public_id()
returns text
language sql
volatile
set search_path = public
as $$
  select translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=', '-_');
$$;

revoke all on function public.selection_event_new_public_id() from public;
revoke execute on function public.selection_event_new_public_id() from anon, authenticated;


-- ============================================================
-- SEZIONE 2 — locandina: asset e Storage (§8)
-- ============================================================

/* §8: «Valida file, MIME effettivo, formato immagine supportato,
   dimensioni/peso centralizzati». Il limite vive nel bucket (che Storage
   applica al caricamento) e in `selection_event_limits()` (che il client
   legge): un solo valore, due letture. */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'selection-event-flyers',
  'selection-event-flyers',
  false,
  8388608, -- 8 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.selection_event_flyer_assets (
  id           uuid primary key,
  club_id      uuid not null references public.clubs(id) on delete cascade,
  storage_path text not null unique,
  mime_type    text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size    integer not null check (byte_size > 0),
  width        integer check (width is null or width between 1 and 20000),
  height       integer check (height is null or height between 1 and 20000),
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default timezone('utc', now())
);

create index if not exists selection_event_flyer_assets_club_idx
  on public.selection_event_flyer_assets (club_id, created_at desc);

alter table public.selection_event_flyer_assets enable row level security;
revoke all on public.selection_event_flyer_assets from anon, authenticated;

comment on table public.selection_event_flyer_assets is
  'DAS-REV-29 §8: locandine caricate per gli eventi di una Società. Una riga '
  'nasce solo dal comando register_selection_event_flyer, che legge l''oggetto '
  'reale in Storage; l''evento la referenzia con flyer_media_id.';

/**
 * L'actor può caricare/gestire locandine per questa Società: chi crea o
 * gestisce eventi in almeno una squadra. La squadra precisa viene
 * rivalutata dal comando sull'evento.
 */
create or replace function public.selection_event_flyer_can_manage(p_club_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caps text[];
begin
  if p_club_id is null or auth.uid() is null then
    return false;
  end if;

  if public.owns_club(p_club_id) then
    return true;
  end if;

  if not public.club_access_is_active(p_club_id, auth.uid()) then
    return false;
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  return 'selection_events_create' = any (v_caps)
      or 'selection_events_manage' = any (v_caps);
end;
$$;

revoke all on function public.selection_event_flyer_can_manage(uuid) from public;
revoke execute on function public.selection_event_flyer_can_manage(uuid) from anon;
grant execute on function public.selection_event_flyer_can_manage(uuid) to authenticated;

/** Percorso Storage `<club_id>/<file>`: cartella valida e actor autorizzato. */
create or replace function public.selection_event_flyer_can_upload(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club uuid;
begin
  begin
    v_club := (storage.foldername(p_name))[1]::uuid;
  exception when others then
    return false;
  end;

  return public.selection_event_flyer_can_manage(v_club);
end;
$$;

revoke all on function public.selection_event_flyer_can_upload(text) from public;
revoke execute on function public.selection_event_flyer_can_upload(text) from anon;
grant execute on function public.selection_event_flyer_can_upload(text) to authenticated;


-- ============================================================
-- SEZIONE 3 — partecipazione canonica e storico (§13, §22)
-- ============================================================

create table if not exists public.selection_event_participations (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.selection_events(id) on delete cascade,
  person_id  uuid not null references public.profiles(id) on delete cascade,
  status     text not null
             check (status in ('pending', 'confirmed', 'rejected', 'withdrawn')),
  /* §13: REGISTRATION è operativa qui; INVITATION è il futuro flusso della 30
     e non viene simulata come iscrizione. */
  source     text not null default 'registration'
             check (source in ('registration', 'invitation')),

  submitted_at timestamptz,
  /* Date **correnti**: valorizzate solo mentre lo stato le giustifica. Una
     conferma annullata non lascia un `confirmed_at` che sembri attivo (§22);
     la data storica sta nello storico. */
  confirmed_at timestamptz,
  rejected_at  timestamptz,
  withdrawn_at timestamptz,
  /* §19: «Richiesta ritirata» o «Partecipazione annullata» si ricavano dalla
     transizione, non dal solo stato WITHDRAWN. */
  withdrawn_from text check (withdrawn_from in ('pending', 'confirmed')),
  /* §19: «Se una rimozione futura da parte della Società usa uno stato
     equivalente a WITHDRAWN, distinguine causa/actor.» Qui esiste solo il
     ritiro volontario; la reiscrizione lo richiede esplicitamente. */
  withdrawn_by_kind text check (withdrawn_by_kind in ('person', 'society')),

  decision_by      uuid references public.profiles(id),
  decision_message text check (decision_message is null or char_length(decision_message) <= 500),

  version    integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint selection_event_participations_unique unique (event_id, person_id),
  constraint selection_event_participations_withdrawn_fields
    check (status <> 'withdrawn' or (withdrawn_at is not null and withdrawn_from is not null
                                     and withdrawn_by_kind is not null)),
  constraint selection_event_participations_confirmed_fields
    check (status <> 'confirmed' or confirmed_at is not null),
  constraint selection_event_participations_rejected_fields
    check (status <> 'rejected' or rejected_at is not null)
);

create index if not exists selection_event_participations_event_status_idx
  on public.selection_event_participations (event_id, status, submitted_at, id);

create index if not exists selection_event_participations_person_idx
  on public.selection_event_participations (person_id, updated_at desc);

alter table public.selection_event_participations enable row level security;
revoke all on public.selection_event_participations from anon, authenticated;

comment on table public.selection_event_participations is
  'DAS-REV-29 §13: una partecipazione per persona ed evento, riusata dopo il '
  'ritiro. Stato corrente qui, transizioni in selection_event_participation_history.';

create table if not exists public.selection_event_participation_history (
  id               uuid primary key default gen_random_uuid(),
  participation_id uuid not null references public.selection_event_participations(id) on delete cascade,
  event_id         uuid not null,
  person_id        uuid not null,
  transition       text not null check (transition in (
    'SUBMITTED', 'AUTO_CONFIRMED', 'MANUALLY_CONFIRMED',
    'REJECTED', 'WITHDRAWN', 'RESUBMITTED')),
  from_status      text,
  to_status        text not null,
  actor_id         uuid not null,
  version          integer not null,
  created_at       timestamptz not null default timezone('utc', now())
);

create index if not exists selection_event_participation_history_idx
  on public.selection_event_participation_history (participation_id, created_at);

alter table public.selection_event_participation_history enable row level security;
revoke all on public.selection_event_participation_history from anon, authenticated;

/** Versione e `updated_at` avanzano a ogni scrittura reale (CAS dei comandi). */
create or replace function public.selection_event_participations_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.version    := 1;
    new.updated_at := now();
  elsif (to_jsonb(new) - 'version' - 'updated_at')
        is distinct from (to_jsonb(old) - 'version' - 'updated_at') then
    if new.event_id is distinct from old.event_id or new.person_id is distinct from old.person_id then
      raise exception 'SELECTION_EVENT_PARTICIPATION_IMMUTABLE';
    end if;

    new.version    := old.version + 1;
    new.updated_at := now();
  else
    new.version    := old.version;
    new.updated_at := old.updated_at;
  end if;

  return new;
end;
$$;

drop trigger if exists selection_event_participations_touch on public.selection_event_participations;
create trigger selection_event_participations_touch
  before insert or update on public.selection_event_participations
  for each row execute function public.selection_event_participations_touch();

revoke execute on function public.selection_event_participations_touch() from anon, authenticated;

/** Storico append-only: una riga per transizione, mai riscritta (§22). */
create or replace function public.selection_event_participation_log(
  p_row        public.selection_event_participations,
  p_transition text,
  p_from       text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.selection_event_participation_history
    (participation_id, event_id, person_id, transition, from_status, to_status, actor_id, version)
  values
    (p_row.id, p_row.event_id, p_row.person_id, p_transition, p_from, p_row.status, auth.uid(), p_row.version);
$$;

revoke all on function public.selection_event_participation_log(public.selection_event_participations, text, text) from public;
revoke execute on function public.selection_event_participation_log(public.selection_event_participations, text, text) from anon, authenticated;


-- ============================================================
-- SEZIONE 4 — i contratti della 28, ora reali (§15, §16)
--
-- Stesse firme, stesso significato dichiarato in 20261108090000: chi li
-- chiamava (Centro, editor, update_selection_event) non cambia.
-- ============================================================

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
  select
    count(*) filter (where p.status = 'confirmed')::integer,
    /* §11 della 28: solo richieste spontanee; un invito pendente non conta. */
    count(*) filter (where p.status = 'pending' and p.source = 'registration')::integer
  from public.selection_event_participations p
  where p.event_id = p_event_id;
$$;

create or replace function public.selection_event_has_activity(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.selection_event_participations p where p.event_id = p_event_id
  );
$$;

/* `selection_event_capacity_allows_confirmation` resta quella della 28: il
   corpo legge `selection_event_participation_counts`, che ora conta davvero.
   Il `for update` sulla riga dell'evento è il confine che serializza
   iscrizione automatica, conferma manuale e modifica del limite (§21). */

revoke all on function public.selection_event_participation_counts(uuid) from public;
revoke all on function public.selection_event_has_activity(uuid) from public;
revoke execute on function public.selection_event_participation_counts(uuid) from anon, authenticated;
revoke execute on function public.selection_event_has_activity(uuid) from anon, authenticated;


-- ============================================================
-- SEZIONE 5 — visibilità pubblica e matrice di disponibilità (§9, §10)
-- ============================================================

/**
 * La landing esiste per questo evento (§9):
 *   · PUBLISHED + OPEN_REGISTRATION;
 *   · CANCELLED/COMPLETED **precedentemente pubblici** — esposti almeno una
 *     volta e ancora a iscrizioni aperte come modalità. Un evento solo su
 *     invito non diventa pubblico perché è terminato (QA-027).
 * DRAFT, INVITE_ONLY ed eventi mai esposti: no.
 */
create or replace function public.selection_event_landing_visible(p_event public.selection_events)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_event.id is not null
    and p_event.public_id is not null
    and p_event.participation_mode = 'open_registration'
    and (
      p_event.status = 'published'
      or (p_event.status in ('cancelled', 'completed') and p_event.public_exposed_at is not null)
    );
$$;

revoke all on function public.selection_event_landing_visible(public.selection_events) from public;
revoke execute on function public.selection_event_landing_visible(public.selection_events) from anon, authenticated;

/**
 * La matrice unica di §10, con il tempo del server.
 *
 *   effective_deadline = termine esplicito, mai oltre l'inizio; senza
 *                        termine, l'inizio stesso (QA-057);
 *   registration_open  = PUBLISHED + OPEN_REGISTRATION + now < effective_deadline;
 *   is_full            = limite non nullo e confermati >= limite. **Non**
 *                        significa «niente richieste manuali» (§10);
 *   can_submit_request = possibilità generica, senza eleggibilità personale:
 *                        finestra aperta e (manuale oppure posto libero);
 *   public_state       = la riga della tabella di §10 che la landing mostra;
 *   next_transition_at = il prossimo confine temporale che cambia la matrice
 *                        (§23: nessuna landing eternamente iscrivibile).
 */
create or replace function public.selection_event_availability(
  p_event public.selection_events,
  p_now   timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_counts    record;
  v_deadline  timestamptz;
  v_open      boolean;
  v_full      boolean;
  v_submit    boolean;
  v_state     text;
  v_next      timestamptz;
begin
  select c.confirmed_count, c.pending_requests_count into v_counts
  from public.selection_event_participation_counts(p_event.id) c;

  v_deadline := case
    when p_event.starts_at is null then p_event.registration_deadline
    when p_event.registration_deadline is null then p_event.starts_at
    else least(p_event.registration_deadline, p_event.starts_at)
  end;

  v_open := p_event.status = 'published'
    and p_event.participation_mode = 'open_registration'
    and v_deadline is not null
    and p_now < v_deadline;

  v_full := p_event.max_participants is not null
    and coalesce(v_counts.confirmed_count, 0) >= p_event.max_participants;

  v_submit := v_open
    and (p_event.registration_confirmation_mode = 'manual' or not v_full);

  v_state := case
    when p_event.status = 'cancelled' then 'cancelled'
    when p_event.status = 'completed' then 'completed'
    when not v_open then 'closed'
    when v_full and p_event.registration_confirmation_mode = 'manual' then 'open_full_manual'
    when v_full then 'full'
    else 'open'
  end;

  v_next := case
    when p_event.status <> 'published' then null
    when v_deadline is not null and p_now < v_deadline then v_deadline
    when p_event.starts_at is not null and p_now < p_event.starts_at then p_event.starts_at
    else null
  end;

  return jsonb_build_object(
    'lifecycle',             p_event.status,
    'registration_open',     v_open,
    'effective_deadline',    v_deadline,
    'has_explicit_deadline', p_event.registration_deadline is not null,
    'started',               p_event.starts_at is not null and p_now >= p_event.starts_at,
    'confirmation_mode',     p_event.registration_confirmation_mode,
    'max_participants',      p_event.max_participants,
    'confirmed_count',       coalesce(v_counts.confirmed_count, 0),
    'is_full',               v_full,
    'can_submit_request',    v_submit,
    'public_state',          v_state,
    'next_transition_at',    v_next
  );
end;
$$;

revoke all on function public.selection_event_availability(public.selection_events, timestamptz) from public;
revoke execute on function public.selection_event_availability(public.selection_events, timestamptz) from anon, authenticated;

/**
 * Il serializer pubblico (§11): **allowlist**, non una proiezione completa
 * filtrata dopo. Nessun partecipante, pendente, nota, creator, admin,
 * permesso, messaggio o account. Il count pubblico è solo dei confermati e
 * compare solo con un limite configurato (QA-030).
 */
create or replace function public.selection_event_public_payload(
  p_event public.selection_events,
  p_now   timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club   record;
  v_team   text;
  v_flyer  record;
  v_avail  jsonb := public.selection_event_availability(p_event, p_now);
begin
  select c.name, c.logo_url,
         coalesce(c.verification_status, 'unverified') = 'verified' as is_verified
    into v_club
  from public.clubs c
  where c.id = p_event.club_id;

  select ct.name into v_team from public.club_teams ct where ct.id = p_event.team_id;

  select a.storage_path, a.width, a.height into v_flyer
  from public.selection_event_flyer_assets a
  where a.id = p_event.flyer_media_id
    and a.club_id = p_event.club_id;

  return jsonb_build_object(
    'state',            'available',
    'public_id',        p_event.public_id,
    'event_id',         p_event.id,
    'version',          p_event.version,
    'club',             jsonb_build_object(
                          'name',        v_club.name,
                          'logo_url',    v_club.logo_url,
                          'is_verified', coalesce(v_club.is_verified, false)),
    'event_type',       p_event.event_type,
    'title',            p_event.title,
    'team_name',        v_team,
    'flyer',            case when v_flyer.storage_path is null then null
                             else jsonb_build_object(
                               'path',   v_flyer.storage_path,
                               'width',  v_flyer.width,
                               'height', v_flyer.height) end,
    'timezone',         p_event.timezone,
    'start_date',       p_event.start_date,
    'start_time',       p_event.start_time,
    'end_time',         p_event.end_time,
    'starts_at',        p_event.starts_at,
    'venue_name',       p_event.venue_name,
    'venue_address',    p_event.venue_address,
    'description',      p_event.description,
    'requirements_info', p_event.requirements_info,
    'birth_year_from',  p_event.birth_year_from,
    'birth_year_to',    p_event.birth_year_to,
    'registration_deadline_date', p_event.registration_deadline_date,
    'registration_deadline_time', p_event.registration_deadline_time,
    'confirmation_mode', p_event.registration_confirmation_mode,
    'max_participants', p_event.max_participants,
    'confirmed_count',  case when p_event.max_participants is null then null
                             else (v_avail ->> 'confirmed_count')::int end,
    'availability',     v_avail - 'confirmed_count',
    'server_now',       p_now
  );
end;
$$;

revoke all on function public.selection_event_public_payload(public.selection_events, timestamptz) from public;
revoke execute on function public.selection_event_public_payload(public.selection_events, timestamptz) from anon, authenticated;

/**
 * Lettura **anonima** della landing (§11). Intenzionalmente concessa ad
 * `anon` solo per la proiezione ammessa. Un id sconosciuto, una bozza, un
 * evento solo su invito o mai esposto producono la stessa risposta generica
 * (screen 20): `{"state":"unavailable"}`, senza titolo né Società.
 */
create or replace function public.fetch_public_selection_event(p_public_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event public.selection_events;
begin
  if p_public_id is null or p_public_id !~ '^[A-Za-z0-9_-]{8,64}$' then
    return jsonb_build_object('state', 'unavailable');
  end if;

  select * into v_event from public.selection_events e where e.public_id = p_public_id;

  if not found or not public.selection_event_landing_visible(v_event) then
    return jsonb_build_object('state', 'unavailable');
  end if;

  /* §11: la lettura anonima porta l'identificatore pubblico, non l'UUID
     interno né la versione; il dettaglio autenticato li riceve. */
  return public.selection_event_public_payload(v_event, now()) - 'event_id' - 'version';
end;
$$;

revoke all on function public.fetch_public_selection_event(text) from public;
grant execute on function public.fetch_public_selection_event(text) to anon, authenticated;

/**
 * Lettura della locandina da Storage (§11: «Anche … asset devono rispettare
 * la stessa visibilità»). Leggibile se l'evento che la usa è visibile a chi
 * chiede — landing pubblica, actor della Società nello scope, persona con una
 * partecipazione — oppure da chi gestisce le locandine della Società (anteprima
 * prima del salvataggio).
 */
create or replace function public.selection_event_flyer_readable(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_asset public.selection_event_flyer_assets;
begin
  select * into v_asset from public.selection_event_flyer_assets a where a.storage_path = p_name;

  if not found then
    return false;
  end if;

  /* Anteprima prima del salvataggio: solo l'autore di un asset non ancora
     legato a un evento. Un asset legato segue la visibilità dell'evento,
     squadra compresa: nessuna lettura club-wide delle locandine di bozza. */
  if auth.uid() is not null
     and v_asset.created_by = auth.uid()
     and not exists (select 1 from public.selection_events e where e.flyer_media_id = v_asset.id) then
    return true;
  end if;

  return exists (
    select 1
    from public.selection_events e
    where e.flyer_media_id = v_asset.id
      and (
        public.selection_event_landing_visible(e)
        or (auth.uid() is not null
            and (public.selection_event_can_operate(e.club_id, e.team_id, 'view')
                 or exists (
                   select 1 from public.selection_event_participations p
                   where p.event_id = e.id and p.person_id = auth.uid())))
      )
  );
end;
$$;

revoke all on function public.selection_event_flyer_readable(text) from public;
grant execute on function public.selection_event_flyer_readable(text) to anon, authenticated;

drop policy if exists "selection event flyers readable when event visible" on storage.objects;
create policy "selection event flyers readable when event visible"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'selection-event-flyers'
  and public.selection_event_flyer_readable(name)
);

drop policy if exists "selection event flyers upload by event managers" on storage.objects;
create policy "selection event flyers upload by event managers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'selection-event-flyers'
  and public.selection_event_flyer_can_upload(name)
);

/* Nessuna policy di update o delete: un file caricato non si sovrascrive
   (§8: «Durante upload conserva la versione salvata»), e la rimozione dal
   form scollega l'asset senza cancellare file referenziati. Il cleanup degli
   upload abbandonati è un job di manutenzione, non un comando del client. */


-- ============================================================
-- SEZIONE 6 — registrazione dell'asset caricato (§8)
-- ============================================================

/**
 * Lega alla Società un file già caricato in Storage. Il client invia solo
 * l'ID che ha usato nel percorso e le dimensioni lette dal picker; MIME e
 * peso vengono dall'oggetto reale (QA-018: un asset di un'altra Società o di
 * un altro autore non si lega).
 *
 * Limite dichiarato: Storage registra il content-type dichiarato al
 * caricamento e lo confronta con `allowed_mime_types`; l'ispezione dei byte
 * (magic number) richiederebbe un servizio fuori dal database.
 */
create or replace function public.register_selection_event_flyer(
  p_club_id  uuid,
  p_asset_id uuid,
  p_width    integer,
  p_height   integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_object record;
  v_mime   text;
  v_size   bigint;
  v_asset  public.selection_event_flyer_assets;
  v_limit  bigint := (public.selection_event_limits() ->> 'flyerMaxBytes')::bigint;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_club_id is null or p_asset_id is null
     or not public.selection_event_flyer_can_manage(p_club_id) then
    raise exception 'SELECTION_EVENT_NOT_AUTHORIZED';
  end if;

  select * into v_asset from public.selection_event_flyer_assets a where a.id = p_asset_id;

  if found then
    /* Retry dello stesso comando: stessa risposta, nessuna seconda riga. */
    if v_asset.club_id <> p_club_id or v_asset.created_by <> v_uid then
      raise exception 'SELECTION_EVENT_INVALID:flyer_invalid';
    end if;
  else
    select o.name, o.metadata into v_object
    from storage.objects o
    where o.bucket_id = 'selection-event-flyers'
      and o.name in (
        p_club_id::text || '/' || p_asset_id::text || '.jpg',
        p_club_id::text || '/' || p_asset_id::text || '.png',
        p_club_id::text || '/' || p_asset_id::text || '.webp')
      and o.owner_id = v_uid::text
    limit 1;

    if v_object.name is null then
      raise exception 'SELECTION_EVENT_INVALID:flyer_missing';
    end if;

    v_mime := lower(coalesce(v_object.metadata ->> 'mimetype', ''));
    v_size := coalesce((v_object.metadata ->> 'size')::bigint, 0);

    if v_mime not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'SELECTION_EVENT_INVALID:flyer_format';
    end if;

    if v_size <= 0 or v_size > v_limit then
      raise exception 'SELECTION_EVENT_INVALID:flyer_too_large';
    end if;

    if (p_width is not null and (p_width < 1 or p_width > 20000))
       or (p_height is not null and (p_height < 1 or p_height > 20000)) then
      raise exception 'SELECTION_EVENT_INVALID:flyer_invalid';
    end if;

    insert into public.selection_event_flyer_assets
      (id, club_id, storage_path, mime_type, byte_size, width, height, created_by)
    values
      (p_asset_id, p_club_id, v_object.name, v_mime, v_size::int, p_width, p_height, v_uid)
    on conflict (id) do nothing
    returning * into v_asset;

    if v_asset.id is null then
      select * into v_asset from public.selection_event_flyer_assets a where a.id = p_asset_id;
    end if;
  end if;

  return jsonb_build_object(
    'asset_id', v_asset.id,
    'path',     v_asset.storage_path,
    'width',    v_asset.width,
    'height',   v_asset.height);
end;
$$;

revoke all on function public.register_selection_event_flyer(uuid, uuid, integer, integer) from public, anon;
grant execute on function public.register_selection_event_flyer(uuid, uuid, integer, integer) to authenticated;


-- ============================================================
-- SEZIONE 7 — riemissione dalla 28: limiti, trigger, patch (§8, §9)
-- ============================================================

/* Da 20261108090000 con due chiavi nuove per la locandina: il client non
   tiene una seconda copia del limite (§8: «Non introdurre limiti client
   diversi da quelli server»). */
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
    'maxParticipants', 10000,
    /* DAS-REV-29 §8 — stesso valore di `storage.buckets.file_size_limit`. */
    'flyerMaxBytes',  8388608,
    'flyerMimeTypes', jsonb_build_array('image/jpeg', 'image/png', 'image/webp'),
    /* DAS-REV-29 §18 — messaggio facoltativo della non accettazione. */
    'decisionMessage', 500
  );
$$;

revoke all on function public.selection_event_limits() from public;
revoke execute on function public.selection_event_limits() from anon;
grant execute on function public.selection_event_limits() to authenticated;

/* Da 20261108090000 con tre aggiunte DAS-REV-29, in coda e marcate:
   assegnazione e immutabilità del `public_id`, data di prima esposizione,
   ownership della locandina. Il resto è invariato. */
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

  -- ── DAS-REV-29 ─────────────────────────────────────────────────────────
  /* §9: link stabile. Una volta assegnato non cambia, né torna null. */
  if tg_op = 'UPDATE' and old.public_id is not null
     and new.public_id is distinct from old.public_id then
    raise exception 'SELECTION_EVENT_PUBLIC_ID_IMMUTABLE';
  end if;

  /* La prima esposizione è un fatto storico: non si sposta né si cancella. */
  if tg_op = 'UPDATE' and old.public_exposed_at is not null then
    new.public_exposed_at := old.public_exposed_at;
  end if;

  /* §9: «PUBLISHED + OPEN_REGISTRATION rende possibile la landing.» Il link
     nasce lì, non prima: una bozza o un evento solo su invito non hanno un
     identificatore pubblico da indovinare (QA-129). */
  if new.status = 'published' and new.participation_mode = 'open_registration' then
    new.public_id         := coalesce(new.public_id, public.selection_event_new_public_id());
    new.public_exposed_at := coalesce(new.public_exposed_at, now());
  end if;

  /* §8: la locandina è un asset della **stessa** Società (QA-018). */
  if new.flyer_media_id is not null
     and (tg_op = 'INSERT' or new.flyer_media_id is distinct from old.flyer_media_id)
     and not exists (
       select 1 from public.selection_event_flyer_assets a
       where a.id = new.flyer_media_id and a.club_id = new.club_id) then
    raise exception 'SELECTION_EVENT_INVALID:flyer_invalid';
  end if;
  -- ── fine DAS-REV-29 ────────────────────────────────────────────────────

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

revoke execute on function public.selection_events_derive() from anon, authenticated;

/* Eventi già pubblicati con iscrizioni aperte: ricevono il link ora, che è
   quando la landing comincia a esistere. Fuori dal trigger perché non è
   un'azione di dominio: non deve avanzare versione né `updated_at`. Nessun
   evento terminato riceve un link (non è mai stato esposto, QA-129). */
alter table public.selection_events disable trigger selection_events_derive;

update public.selection_events e
set public_id         = public.selection_event_new_public_id(),
    public_exposed_at = timezone('utc', now())
where e.status = 'published'
  and e.participation_mode = 'open_registration'
  and e.public_id is null;

alter table public.selection_events enable trigger selection_events_derive;

/* Da 20261108090000 con `flyer_media_id` in whitelist (§8: la locandina è
   «una proprietà facoltativa dell'evento», nella stessa patch del form). */
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
    'registration_deadline_date', 'registration_deadline_time',
    'flyer_media_id'
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
revoke execute on function public.selection_event_apply_patch(public.selection_events, jsonb) from anon, authenticated;

/* `public_id` e `public_exposed_at` non sono contenuto modificato dall'utente:
   fuori dall'elenco dei campi cambiati dell'audit. */
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
  where n.key not in ('version', 'updated_at', 'starts_at', 'ends_at', 'registration_deadline',
                      'public_id', 'public_exposed_at')
    and (to_jsonb(p_old) -> n.key) is distinct from n.value;
$$;

revoke all on function public.selection_event_changed_fields(public.selection_events, public.selection_events) from public;
revoke execute on function public.selection_event_changed_fields(public.selection_events, public.selection_events) from anon, authenticated;


-- ============================================================
-- SEZIONE 8 — riemissione dei comandi di scrittura della 28 (§8)
--
-- Da 20261108090000, con la sola colonna `flyer_media_id` aggiunta a insert
-- e update. La validazione dell'ownership sta nel trigger, che copre ogni
-- scrittura.
-- ============================================================

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
      registration_deadline_date, registration_deadline_time, flyer_media_id, created_by
    ) values (
      v_new.club_id, v_new.team_id, v_new.event_type, v_new.title, 'draft', v_new.timezone,
      v_new.start_date, v_new.start_time, v_new.end_time, v_new.venue_name, v_new.venue_address,
      v_new.description, v_new.requirements_info, v_new.birth_year_from, v_new.birth_year_to,
      v_new.max_participants, v_new.participation_mode, v_new.registration_confirmation_mode,
      v_new.registration_deadline_date, v_new.registration_deadline_time, v_new.flyer_media_id, v_uid
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
        registration_deadline_time     = v_new.registration_deadline_time,
        flyer_media_id                 = v_new.flyer_media_id
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
      registration_deadline_time     = v_new.registration_deadline_time,
      flyer_media_id                 = v_new.flyer_media_id
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


/* Da 20261108090000 con la locandina e il link pubblico nel read model del
   form. Il tipo di ritorno cambia, quindi va ricreata. */
drop function if exists public.fetch_selection_event_editor(uuid);

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
  has_activity                   boolean,
  flyer_media_id                 uuid,
  flyer_path                     text,
  flyer_width                    integer,
  flyer_height                   integer,
  confirmed_count                integer
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
    public.selection_event_has_activity(v_event.id),
    v_event.flyer_media_id,
    fa.storage_path,
    fa.width,
    fa.height,
    (select c.confirmed_count from public.selection_event_participation_counts(v_event.id) c)
  from public.club_teams ct
  left join public.selection_event_flyer_assets fa on fa.id = v_event.flyer_media_id
  where ct.id = v_event.team_id;
end;
$$;

revoke all on function public.fetch_selection_event_editor(uuid) from public, anon;
grant execute on function public.fetch_selection_event_editor(uuid) to authenticated;


-- ============================================================
-- SEZIONE 9 — persona: eleggibilità, anni, stato personale (§13, §14, §20)
-- ============================================================

/**
 * Motivo per cui la persona **non** può iscriversi con il proprio profilo,
 * o null. Mai derivato da stringhe di ruolo del client (§13).
 */
create or replace function public.selection_event_person_ineligibility(
  p_event public.selection_events,
  p_uid   uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role  text;
  v_owner uuid;
begin
  select pr.role::text into v_role from public.profiles pr where pr.id = p_uid;

  if v_role is null then
    return 'no_profile';
  end if;

  if v_role <> 'player'
     or not exists (select 1 from public.player_profiles pp where pp.profile_id = p_uid) then
    return 'not_sports_profile';
  end if;

  select c.owner_profile_id into v_owner from public.clubs c where c.id = p_event.club_id;

  if v_owner = p_uid then
    return 'not_sports_profile';
  end if;

  if v_owner is not null and exists (
    select 1 from public.user_blocks b
    where (b.blocker_profile_id = p_uid and b.blocked_profile_id = v_owner)
       or (b.blocker_profile_id = v_owner and b.blocked_profile_id = p_uid)
  ) then
    return 'blocked';
  end if;

  return null;
end;
$$;

revoke all on function public.selection_event_person_ineligibility(public.selection_events, uuid) from public;
revoke execute on function public.selection_event_person_ineligibility(public.selection_events, uuid) from anon, authenticated;

/**
 * La partecipazione corrente dell'actor e le **capability effettive** (§20):
 * register, withdraw, register_again. Il client non le deduce da etichette o
 * colori.
 *
 * Il messaggio della Società compare solo su REJECTED (§18): una reiscrizione
 * successiva non lo ripropone, perché il comando lo azzera.
 */
create or replace function public.selection_event_personal_state(
  p_event public.selection_events,
  p_uid   uuid,
  p_now   timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_part     public.selection_event_participations;
  v_avail    jsonb := public.selection_event_availability(p_event, p_now);
  v_reason   text := public.selection_event_person_ineligibility(p_event, p_uid);
  v_birth    date;
  v_year     integer;
  v_mismatch boolean := false;
  v_public   boolean := public.selection_event_landing_visible(p_event);
  v_can_new  boolean;
  v_withdraw boolean := false;
  v_again    boolean := false;
  v_register boolean := false;
begin
  select * into v_part
  from public.selection_event_participations p
  where p.event_id = p_event.id and p.person_id = p_uid;

  select pr.birth_date into v_birth from public.profiles pr where pr.id = p_uid;
  v_year := extract(year from v_birth)::int;

  /* §14: senza intervallo non c'è confronto; senza anno nel profilo non si
     inventa nulla. Lo scostamento è solo un avviso. */
  if p_event.birth_year_from is not null and v_year is not null then
    v_mismatch := v_year < p_event.birth_year_from or v_year > p_event.birth_year_to;
  end if;

  v_can_new := v_public
    and v_reason is null
    and coalesce((v_avail ->> 'can_submit_request')::boolean, false);

  if v_part.id is null then
    v_register := v_can_new;
  elsif v_part.status in ('pending', 'confirmed') then
    /* §19: ritiro fino all'inizio, anche dopo il termine delle iscrizioni. */
    v_withdraw := p_event.status = 'published'
      and p_event.starts_at is not null
      and p_now < p_event.starts_at;
  elsif v_part.status = 'withdrawn' and v_part.withdrawn_by_kind = 'person' then
    v_again := v_can_new;
  end if;

  return jsonb_build_object(
    'participation', case when v_part.id is null then null else jsonb_build_object(
      'id',             v_part.id,
      'status',         v_part.status,
      'source',         v_part.source,
      'submitted_at',   v_part.submitted_at,
      'confirmed_at',   v_part.confirmed_at,
      'rejected_at',    v_part.rejected_at,
      'withdrawn_at',   v_part.withdrawn_at,
      'withdrawn_from', v_part.withdrawn_from,
      'decision_message', case when v_part.status = 'rejected' then v_part.decision_message end,
      'version',        v_part.version) end,
    'capabilities', jsonb_build_object(
      'register',       v_register,
      'withdraw',       v_withdraw,
      'register_again', v_again),
    'ineligible_reason', v_reason,
    'birth_year',        v_year,
    'birth_year_mismatch', v_mismatch
  );
end;
$$;

revoke all on function public.selection_event_personal_state(public.selection_events, uuid, timestamptz) from public;
revoke execute on function public.selection_event_personal_state(public.selection_events, uuid, timestamptz) from anon, authenticated;


-- ============================================================
-- SEZIONE 10 — dettaglio canonico autenticato (§7, §20)
-- ============================================================

/**
 * Una lettura, tre proiezioni (§7): pubblica (sempre, se l'actor può
 * vedere l'evento), personale (solo la propria partecipazione e le proprie
 * capability) e gestionale (solo per chi ha `selection_events_view` sulla
 * squadra). Il server decide quali blocchi esistono.
 *
 * Accesso: actor della Società nello scope, landing pubblica, oppure una
 * partecipazione propria (lo storico personale resta leggibile anche se
 * l'evento non è più promuovibile, §20). Tutto il resto è
 * `SELECTION_EVENT_NOT_AVAILABLE`, senza distinguere inesistente da privato.
 *
 * Accetta `p_event_id` (Centro, notifiche) o `p_public_id` (link): lo stesso
 * resolver per ogni origine.
 */
create or replace function public.fetch_selection_event_detail(
  p_event_id  uuid default null,
  p_public_id text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_now       timestamptz := now();
  v_event     public.selection_events;
  v_society   boolean;
  v_public    boolean;
  v_personal  boolean;
  v_result    jsonb;
  v_counts    record;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_event_id is not null then
    select * into v_event from public.selection_events e where e.id = p_event_id;
  elsif p_public_id is not null and p_public_id ~ '^[A-Za-z0-9_-]{8,64}$' then
    select * into v_event from public.selection_events e where e.public_id = p_public_id;
  end if;

  if v_event.id is null then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  v_society  := public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'view');
  v_public   := public.selection_event_landing_visible(v_event);
  v_personal := exists (
    select 1 from public.selection_event_participations p
    where p.event_id = v_event.id and p.person_id = v_uid);

  if not (v_society or v_public or v_personal) then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  /* Una bozza resta della Società anche se la persona ne conosce l'ID. */
  if v_event.status = 'draft' and not v_society then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  v_result := public.selection_event_public_payload(v_event, v_now)
    || jsonb_build_object(
         'status',             v_event.status,
         'participation_mode', v_event.participation_mode,
         'club_id',            v_event.club_id,
         'team_id',            v_event.team_id,
         'landing_visible',    v_public);

  /* Il payload pubblico omette il count senza limite; il dettaglio della
     Società lo mostra comunque come numero di confermati. */
  if v_society then
    select c.confirmed_count, c.pending_requests_count into v_counts
    from public.selection_event_participation_counts(v_event.id) c;

    v_result := v_result || jsonb_build_object(
      'management', jsonb_build_object(
        'confirmed_count',        v_counts.confirmed_count,
        'pending_requests_count', case when v_event.status = 'published'
                                       then v_counts.pending_requests_count end,
        'can_edit',   v_event.status = 'published'
                      and public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'manage'),
        'can_decide', v_event.status = 'published'
                      and public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'manage'),
        /* §9: condivisione solo se l'evento ha una landing. Lo storico
           pubblico si condivide con wording neutro (QA-039). */
        'can_share',  v_public));
  else
    v_result := v_result || jsonb_build_object('management', null);
  end if;

  v_result := v_result || jsonb_build_object(
    'personal', public.selection_event_personal_state(v_event, v_uid, v_now));

  return v_result;
end;
$$;

revoke all on function public.fetch_selection_event_detail(uuid, text) from public, anon;
grant execute on function public.fetch_selection_event_detail(uuid, text) to authenticated;


-- ============================================================
-- SEZIONE 11 — comandi della persona (§15, §16, §19, §21)
-- ============================================================

/**
 * Iscrizione con il **proprio** profilo (§13): nessun `person_id` nei
 * parametri, quindi nessuno spoofing possibile (QA-065).
 *
 * Ordine dei lock: riga dell'evento, poi partecipazione. È lo stesso ordine
 * di conferma, non accettazione e ritiro, e lo stesso confine di
 * `update_selection_event` (modifica del limite): nessun 51/50 (§15).
 *
 * Esiti, non errori, quando la persona è già dentro (§21: «ALREADY_REGISTERED
 * non è un errore tecnico per l'utente»): si restituisce lo stato corrente.
 */
create or replace function public.register_for_selection_event(
  p_event_id        uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_now     timestamptz := now();
  v_finger  constant text := md5('register');
  v_receipt jsonb;
  v_event   public.selection_events;
  v_avail   jsonb;
  v_reason  text;
  v_part    public.selection_event_participations;
  v_from    text;
  v_target  text;
  v_resub   boolean := false;
  v_result  jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('selection_event_op:' || p_idempotency_key));
  end if;

  v_receipt := public.selection_event_operation_replay(p_idempotency_key, p_event_id, 'register', v_finger);

  if v_receipt is not null then
    /* QA-074: la ricevuta prova che il comando è già riuscito. Si restituisce
       lo stato **corrente**, che può essere cambiato nel frattempo. */
    select * into v_part
    from public.selection_event_participations p
    where p.event_id = p_event_id and p.person_id = v_uid;

    return jsonb_build_object(
      'participation_id', v_part.id,
      'status',           v_part.status,
      'version',          v_part.version,
      'outcome',          'replayed',
      'replayed',         true);
  end if;

  select * into v_event
  from public.selection_events e
  where e.id = p_event_id
  for update;

  if not found or not public.selection_event_landing_visible(v_event) then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  if v_event.status <> 'published' then
    raise exception 'SELECTION_EVENT_NOT_OPERATIONAL';
  end if;

  select * into v_part
  from public.selection_event_participations p
  where p.event_id = v_event.id and p.person_id = v_uid
  for update;

  if v_part.id is not null and v_part.status in ('pending', 'confirmed') then
    return jsonb_build_object(
      'participation_id', v_part.id,
      'status',           v_part.status,
      'version',          v_part.version,
      'outcome',          'already_registered',
      'replayed',         false);
  end if;

  /* §18: REJECTED non si reiscrive con questa V1, qualunque sia il client. */
  if v_part.id is not null and v_part.status = 'rejected' then
    raise exception 'SELECTION_EVENT_REGISTRATION_REJECTED';
  end if;

  /* §19: un ritiro non volontario non apre la reiscrizione. */
  if v_part.id is not null and v_part.withdrawn_by_kind is distinct from 'person' then
    raise exception 'SELECTION_EVENT_NOT_ELIGIBLE';
  end if;

  v_avail := public.selection_event_availability(v_event, v_now);

  if not coalesce((v_avail ->> 'registration_open')::boolean, false) then
    raise exception 'SELECTION_EVENT_REGISTRATION_CLOSED';
  end if;

  v_reason := public.selection_event_person_ineligibility(v_event, v_uid);

  if v_reason is not null then
    raise exception 'SELECTION_EVENT_NOT_ELIGIBLE:%', v_reason;
  end if;

  /* La modalità è quella canonica dell'evento (QA-077): il client non la
     invia. */
  if v_event.registration_confirmation_mode = 'automatic' then
    /* Lock già preso sopra; la funzione lo riprende senza attese. */
    if not public.selection_event_capacity_allows_confirmation(v_event.id) then
      raise exception 'SELECTION_EVENT_FULL';
    end if;

    v_target := 'confirmed';
  else
    v_target := 'pending';
  end if;

  if v_part.id is null then
    insert into public.selection_event_participations
      (event_id, person_id, status, source, submitted_at, confirmed_at)
    values
      (v_event.id, v_uid, v_target, 'registration', v_now,
       case when v_target = 'confirmed' then v_now end)
    returning * into v_part;

    perform public.selection_event_participation_log(v_part, 'SUBMITTED', null);
  else
    v_from  := v_part.status;
    v_resub := true;

    /* §19: stessa relazione, nuovo intento. Nessun messaggio o decisione
       precedente torna come corrente. */
    update public.selection_event_participations p
    set status            = v_target,
        source            = 'registration',
        submitted_at      = v_now,
        confirmed_at      = case when v_target = 'confirmed' then v_now end,
        rejected_at       = null,
        withdrawn_at      = null,
        withdrawn_from    = null,
        withdrawn_by_kind = null,
        decision_by       = null,
        decision_message  = null
    where p.id = v_part.id
    returning * into v_part;

    perform public.selection_event_participation_log(v_part, 'RESUBMITTED', v_from);
  end if;

  if v_target = 'confirmed' then
    perform public.selection_event_participation_log(
      v_part, 'AUTO_CONFIRMED', case when v_resub then v_from else null end);
  end if;

  v_result := jsonb_build_object(
    'participation_id', v_part.id,
    'status',           v_part.status,
    'version',          v_part.version,
    'outcome',          case when v_resub then 'resubmitted' else 'submitted' end,
    'replayed',         false);

  perform public.selection_event_operation_record(
    p_idempotency_key, v_event.club_id, v_event.id, 'register', v_finger, v_result);

  /* §22: nessuna notifica per la propria submission o per la conferma
     automatica vista in diretta; nessuna alla Società per ogni iscrizione. */
  return v_result;
end;
$$;

revoke all on function public.register_for_selection_event(uuid, text) from public, anon;
grant execute on function public.register_for_selection_event(uuid, text) to authenticated;


/**
 * Ritiro di una richiesta PENDING o annullamento di una partecipazione
 * CONFIRMED (§19). Solo della persona proprietaria: non è un comando di
 * rimozione della Società. Ammesso fino all'inizio dell'evento, anche dopo
 * il termine delle iscrizioni.
 */
create or replace function public.withdraw_selection_event_participation(
  p_participation_id uuid,
  p_expected_version integer,
  p_idempotency_key  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_now     timestamptz := now();
  /* Impronta costante: la chiave identifica l'intenzione di ritirarsi. Un
     retry dopo un esito perso arriva con la versione già avanzata, e non
     deve diventare OPERATION_CONTENT_CHANGED. */
  v_finger  constant text := md5('withdraw');
  v_receipt jsonb;
  v_ref     public.selection_event_participations;
  v_event   public.selection_events;
  v_part    public.selection_event_participations;
  v_from    text;
  v_result  jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('selection_event_op:' || p_idempotency_key));
  end if;

  select * into v_ref from public.selection_event_participations p where p.id = p_participation_id;

  /* QA-120: la partecipazione di un altro è indistinguibile da una inesistente. */
  if v_ref.id is null or v_ref.person_id <> v_uid then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  v_receipt := public.selection_event_operation_replay(p_idempotency_key, p_participation_id, 'withdraw', v_finger);

  if v_receipt is not null then
    return jsonb_build_object(
      'participation_id', v_ref.id,
      'status',           v_ref.status,
      'version',          v_ref.version,
      'outcome',          'replayed',
      'replayed',         true);
  end if;

  select * into v_event from public.selection_events e where e.id = v_ref.event_id for update;

  select * into v_part
  from public.selection_event_participations p
  where p.id = p_participation_id
  for update;

  if v_event.status <> 'published'
     or v_event.starts_at is null
     or v_now >= v_event.starts_at then
    raise exception 'SELECTION_EVENT_NOT_OPERATIONAL';
  end if;

  if v_part.status not in ('pending', 'confirmed')
     or p_expected_version is null
     or p_expected_version <> v_part.version then
    raise exception 'SELECTION_EVENT_PARTICIPATION_CHANGED';
  end if;

  v_from := v_part.status;

  update public.selection_event_participations p
  set status            = 'withdrawn',
      withdrawn_at      = v_now,
      withdrawn_from    = v_from,
      withdrawn_by_kind = 'person',
      confirmed_at      = null,
      /* §22: nessun autore di decisione resta «corrente» dopo il ritiro. */
      decision_by       = null
  where p.id = v_part.id
  returning * into v_part;

  perform public.selection_event_participation_log(v_part, 'WITHDRAWN', v_from);

  v_result := jsonb_build_object(
    'participation_id', v_part.id,
    'status',           v_part.status,
    'version',          v_part.version,
    'outcome',          case when v_from = 'confirmed' then 'participation_cancelled' else 'request_withdrawn' end,
    'replayed',         false);

  perform public.selection_event_operation_record(
    p_idempotency_key, v_event.club_id, v_part.id, 'withdraw', v_finger, v_result);

  /* §22: la Società non riceve una notifica per ogni ritiro. Il posto
     liberato non promuove nessuno e non avvisa i pending (QA-094). */
  return v_result;
end;
$$;

revoke all on function public.withdraw_selection_event_participation(uuid, integer, text) from public, anon;
grant execute on function public.withdraw_selection_event_participation(uuid, integer, text) to authenticated;


-- ============================================================
-- SEZIONE 12 — notifiche della decisione (§22)
-- ============================================================

/* Una notifica per destinatario e transizione: il retry del comando, che
   trova la ricevuta, non arriva qui; un retry interno o un doppio invio non
   la duplicano comunque. */
create unique index if not exists notifications_selection_event_decision_uniq
  on public.notifications (
    recipient_profile_id,
    (data ->> 'participation_id'),
    (data ->> 'participation_version')
  )
  where type in ('selection_event_participation_confirmed', 'selection_event_participation_rejected');

/**
 * §22: testo standard, nessun messaggio facoltativo nel corpo (non deve
 * finire in lock screen). Il tap apre l'evento: `event_id` nel payload.
 */
create or replace function public.notify_selection_event_decision(
  p_participation public.selection_event_participations
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.selection_events;
  v_club  text;
  v_title text;
begin
  select * into v_event from public.selection_events e where e.id = p_participation.event_id;
  select c.name into v_club from public.clubs c where c.id = v_event.club_id;
  v_title := coalesce(nullif(btrim(v_event.title), ''), 'l''evento');

  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    p_participation.person_id,
    case p_participation.status
      when 'confirmed' then 'selection_event_participation_confirmed'
      else 'selection_event_participation_rejected'
    end,
    case p_participation.status
      when 'confirmed' then 'Partecipazione confermata'
      else 'Richiesta non accettata'
    end,
    case p_participation.status
      when 'confirmed' then coalesce(v_club, 'La Società') || ' ha confermato la tua partecipazione a ' || v_title || '.'
      else 'La tua richiesta per ' || v_title || ' non è stata accettata.'
    end,
    jsonb_build_object(
      'event_id',              v_event.id,
      'participation_id',      p_participation.id,
      'participation_version', p_participation.version)
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.notify_selection_event_decision(public.selection_event_participations) from public;
revoke execute on function public.notify_selection_event_decision(public.selection_event_participations) from anon, authenticated;

/* Da 20261101090000_person_society_link.sql con i due tipi nuovi in
   entrambe le scale: categoria `candidature` (una richiesta di partecipazione
   è una candidatura a un evento) e preferenza `applications`. */
create or replace function public.notifications_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pref_key text;
  v_enabled  boolean;
begin
  new.category := case new.type
    when 'agent_representation_request'             then 'richieste'
    when 'agent_representation_responded'           then 'richieste'
    when 'agent_representation_removed'             then 'richieste'
    when 'agent_representation_visibility_proposed' then 'richieste'
    when 'agent_invite_reconciled'                  then 'richieste'
    when 'member_joined'                            then 'richieste'
    when 'roster_assignment_responded'              then 'richieste'
    when 'roster_assignment_removed'                then 'richieste'
    when 'club_admin_invite'                        then 'richieste'
    when 'society_invitation_created'               then 'richieste'
    when 'role_request_created'                       then 'richieste'
    when 'role_request_approved'                      then 'richieste'
    when 'role_request_declined'                      then 'richieste'
    when 'role_assignment_changed_by_person'          then 'richieste'
    when 'role_assignment_changed_by_society'         then 'richieste'
    when 'role_assignment_added_by_person'            then 'richieste'
    when 'role_assignment_added_by_society'           then 'richieste'
    when 'role_assignment_removed_by_person'          then 'richieste'
    when 'role_assignment_removed_by_society'         then 'richieste'
    when 'role_link_left'                             then 'richieste'
    when 'role_link_removed'                          then 'richieste'
    when 'application_received'                     then 'candidature'
    when 'application_status'                       then 'candidature'
    when 'selection_event_participation_confirmed'  then 'candidature'
    when 'selection_event_participation_rejected'   then 'candidature'
    when 'content_tag'                              then 'attivita'
    when 'new_follower'                             then 'attivita'
    else 'sistema'
  end;

  v_pref_key := case new.type
    when 'agent_representation_request'             then 'requests'
    when 'agent_representation_responded'           then 'requests'
    when 'agent_representation_removed'             then 'requests'
    when 'agent_representation_visibility_proposed' then 'requests'
    when 'agent_invite_reconciled'                  then 'requests'
    when 'member_joined'                            then 'requests'
    when 'roster_assignment_responded'              then 'requests'
    when 'roster_assignment_removed'                then 'requests'
    when 'club_admin_invite'                        then 'requests'
    when 'society_invitation_created'               then 'requests'
    when 'role_request_created'                       then 'requests'
    when 'role_request_approved'                      then 'requests'
    when 'role_request_declined'                      then 'requests'
    when 'role_assignment_changed_by_person'          then 'requests'
    when 'role_assignment_changed_by_society'         then 'requests'
    when 'role_assignment_added_by_person'            then 'requests'
    when 'role_assignment_added_by_society'           then 'requests'
    when 'role_assignment_removed_by_person'          then 'requests'
    when 'role_assignment_removed_by_society'         then 'requests'
    when 'role_link_left'                             then 'requests'
    when 'role_link_removed'                          then 'requests'
    when 'application_received'                     then 'applications'
    when 'application_status'                       then 'applications'
    when 'selection_event_participation_confirmed'  then 'applications'
    when 'selection_event_participation_rejected'   then 'applications'
    when 'content_tag'                              then 'content_tags'
    when 'new_follower'                             then 'new_followers'
    when 'promo'                                    then 'promotions'
    else null
  end;

  if v_pref_key is not null then
    select case v_pref_key
      when 'requests'      then prefs.requests
      when 'applications'  then prefs.applications
      when 'content_tags'  then prefs.content_tags
      when 'new_followers' then prefs.new_followers
      when 'store'         then prefs.store
      when 'promotions'    then prefs.promotions
    end
    into v_enabled
    from public.notification_preferences prefs
    where prefs.profile_id = new.recipient_profile_id;

    if v_enabled is false then
      return null;
    end if;
  end if;

  return new;
end;
$$;


-- ============================================================
-- SEZIONE 13 — decisione manuale della Società (§17, §18)
-- ============================================================

/**
 * Guard comune a conferma e non accettazione, in un punto solo:
 * evento operativo (PUBLISHED, prima dell'inizio — §16: dopo il termine sì,
 * dopo l'inizio no), capability `manage` sulla squadra **al commit**,
 * richiesta PENDING spontanea alla versione vista.
 */
create or replace function public.selection_event_lock_decision(
  p_participation_id uuid,
  p_expected_version integer,
  out o_event public.selection_events,
  out o_part  public.selection_event_participations
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.selection_event_participations;
begin
  select * into v_ref from public.selection_event_participations p where p.id = p_participation_id;

  if v_ref.id is null then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  select * into o_event from public.selection_events e where e.id = v_ref.event_id for update;

  if not public.selection_event_can_operate(o_event.club_id, o_event.team_id, 'view') then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  if not public.selection_event_can_operate(o_event.club_id, o_event.team_id, 'manage') then
    raise exception 'SELECTION_EVENT_NOT_AUTHORIZED';
  end if;

  select * into o_part
  from public.selection_event_participations p
  where p.id = p_participation_id
  for update;

  if o_event.status <> 'published'
     or o_event.starts_at is null
     or now() >= o_event.starts_at then
    raise exception 'SELECTION_EVENT_NOT_OPERATIONAL';
  end if;

  if o_part.status <> 'pending'
     or o_part.source <> 'registration'
     or p_expected_version is null
     or p_expected_version <> o_part.version then
    raise exception 'SELECTION_EVENT_PARTICIPATION_CHANGED';
  end if;
end;
$$;

revoke all on function public.selection_event_lock_decision(uuid, integer) from public;
revoke execute on function public.selection_event_lock_decision(uuid, integer) from anon, authenticated;

create or replace function public.confirm_selection_event_participation(
  p_participation_id uuid,
  p_expected_version integer,
  p_idempotency_key  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_finger  text := md5('confirm|' || coalesce(p_expected_version::text, '-'));
  v_receipt jsonb;
  v_lock    record;
  v_event   public.selection_events;
  v_part    public.selection_event_participations;
  v_result  jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('selection_event_op:' || p_idempotency_key));
  end if;

  v_receipt := public.selection_event_operation_replay(p_idempotency_key, p_participation_id, 'confirm', v_finger);

  if v_receipt is not null then
    select * into v_part from public.selection_event_participations p where p.id = p_participation_id;
    select * into v_event from public.selection_events e where e.id = v_part.event_id;

    if v_part.id is null
       or not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'view') then
      raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
    end if;

    return jsonb_build_object('participation_id', v_part.id, 'status', v_part.status,
                              'version', v_part.version, 'replayed', true);
  end if;

  select * into v_lock from public.selection_event_lock_decision(p_participation_id, p_expected_version);
  v_event := v_lock.o_event;
  v_part  := v_lock.o_part;

  /* §17: «A capienza piena la conferma è disabilitata»; la richiesta resta
     PENDING (QA-085). Il lock sulla riga dell'evento è già nostro. */
  if not public.selection_event_capacity_allows_confirmation(v_event.id) then
    raise exception 'SELECTION_EVENT_FULL';
  end if;

  update public.selection_event_participations p
  set status       = 'confirmed',
      confirmed_at = now(),
      decision_by  = auth.uid()
  where p.id = v_part.id
  returning * into v_part;

  perform public.selection_event_participation_log(v_part, 'MANUALLY_CONFIRMED', 'pending');
  perform public.notify_selection_event_decision(v_part);

  v_result := jsonb_build_object('participation_id', v_part.id, 'status', v_part.status,
                                 'version', v_part.version, 'replayed', false);

  perform public.selection_event_operation_record(
    p_idempotency_key, v_event.club_id, v_part.id, 'confirm', v_finger, v_result);

  return v_result;
end;
$$;

revoke all on function public.confirm_selection_event_participation(uuid, integer, text) from public, anon;
grant execute on function public.confirm_selection_event_participation(uuid, integer, text) to authenticated;

/**
 * Non accettare (§18). Messaggio facoltativo in testo semplice: ripulito come
 * ogni testo del dominio, solo spazi → null, oltre il limite → errore che il
 * client mostra **conservando** il testo (QA-088). Nessuna conversazione
 * nasce da qui.
 */
create or replace function public.reject_selection_event_participation(
  p_participation_id uuid,
  p_expected_version integer,
  p_message          text,
  p_idempotency_key  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text := public.selection_event_clean_text(p_message, true);
  v_finger  text;
  v_receipt jsonb;
  v_lock    record;
  v_event   public.selection_events;
  v_part    public.selection_event_participations;
  v_result  jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_message is not null
     and char_length(v_message) > (public.selection_event_limits() ->> 'decisionMessage')::int then
    raise exception 'SELECTION_EVENT_INVALID:message_too_long';
  end if;

  v_finger := md5('reject|' || coalesce(p_expected_version::text, '-') || '|' || coalesce(v_message, ''));

  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('selection_event_op:' || p_idempotency_key));
  end if;

  v_receipt := public.selection_event_operation_replay(p_idempotency_key, p_participation_id, 'reject', v_finger);

  if v_receipt is not null then
    select * into v_part from public.selection_event_participations p where p.id = p_participation_id;
    select * into v_event from public.selection_events e where e.id = v_part.event_id;

    if v_part.id is null
       or not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'view') then
      raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
    end if;

    return jsonb_build_object('participation_id', v_part.id, 'status', v_part.status,
                              'version', v_part.version, 'replayed', true);
  end if;

  select * into v_lock from public.selection_event_lock_decision(p_participation_id, p_expected_version);
  v_event := v_lock.o_event;
  v_part  := v_lock.o_part;

  update public.selection_event_participations p
  set status           = 'rejected',
      rejected_at      = now(),
      decision_by      = auth.uid(),
      decision_message = v_message
  where p.id = v_part.id
  returning * into v_part;

  perform public.selection_event_participation_log(v_part, 'REJECTED', 'pending');
  perform public.notify_selection_event_decision(v_part);

  v_result := jsonb_build_object('participation_id', v_part.id, 'status', v_part.status,
                                 'version', v_part.version, 'replayed', false);

  perform public.selection_event_operation_record(
    p_idempotency_key, v_event.club_id, v_part.id, 'reject', v_finger, v_result);

  return v_result;
end;
$$;

revoke all on function public.reject_selection_event_participation(uuid, integer, text, text) from public, anon;
grant execute on function public.reject_selection_event_participation(uuid, integer, text, text) to authenticated;


-- ============================================================
-- SEZIONE 14 — letture della Società sulle richieste (§17)
-- ============================================================

/**
 * Preview «Richieste da valutare» nel dettaglio Società (§17): le richieste
 * PENDING spontanee più vecchie, `submitted_at, id`, massimo tre. Dopo una
 * decisione la successiva sale da sola: tutte restano raggiungibili senza
 * un secondo centro. Riservata a chi può decidere.
 */
create or replace function public.fetch_selection_event_pending_requests(
  p_event_id uuid,
  p_limit    integer default 3
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event public.selection_events;
  v_limit integer := least(greatest(coalesce(p_limit, 3), 1), 3);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_event from public.selection_events e where e.id = p_event_id;

  if v_event.id is null
     or not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'view') then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  if not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'manage') then
    return jsonb_build_object('total', null, 'items', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'total', (select c.pending_requests_count
              from public.selection_event_participation_counts(v_event.id) c),
    'items', coalesce((
      select jsonb_agg(x.item order by x.submitted_at, x.id)
      from (
        select p.submitted_at, p.id,
               jsonb_build_object(
                 'participation_id', p.id,
                 'person_id',        p.person_id,
                 'full_name',        pr.full_name,
                 'avatar_url',       pr.avatar_url,
                 'role',             pr.role::text,
                 'birth_year',       extract(year from pr.birth_date)::int,
                 'submitted_at',     p.submitted_at,
                 'version',          p.version) as item
        from public.selection_event_participations p
        join public.profiles pr on pr.id = p.person_id
        where p.event_id = v_event.id
          and p.status = 'pending'
          and p.source = 'registration'
        order by p.submitted_at, p.id
        limit v_limit
      ) x
    ), '[]'::jsonb));
end;
$$;

revoke all on function public.fetch_selection_event_pending_requests(uuid, integer) from public, anon;
grant execute on function public.fetch_selection_event_pending_requests(uuid, integer) to authenticated;

/**
 * Dettaglio della singola richiesta (§17, screen 16): una sola route
 * canonica, riusabile dalla gestione partecipanti della 30. Identità
 * pubblicabile, contesto evento, stato, capienza; nessuna valutazione,
 * stella Shortlist o contatto privato.
 */
create or replace function public.fetch_selection_event_request(p_participation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_part   public.selection_event_participations;
  v_event  public.selection_events;
  v_team   text;
  v_person record;
  v_avail  jsonb;
  v_manage boolean;
  v_open   boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_part from public.selection_event_participations p where p.id = p_participation_id;
  select * into v_event from public.selection_events e where e.id = v_part.event_id;

  if v_part.id is null
     or not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'view') then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  /* §17: il dettaglio della richiesta è della gestione partecipanti, come la
     preview. Chi ha solo `view` non riceve identità e messaggi delle persone. */
  if not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'manage') then
    raise exception 'SELECTION_EVENT_NOT_AUTHORIZED';
  end if;

  select ct.name into v_team from public.club_teams ct where ct.id = v_event.team_id;
  select pr.id, pr.full_name, pr.avatar_url, pr.role::text as role,
         extract(year from pr.birth_date)::int as birth_year
    into v_person
  from public.profiles pr where pr.id = v_part.person_id;

  v_avail  := public.selection_event_availability(v_event, now());
  v_manage := public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'manage');
  v_open   := v_event.status = 'published'
    and v_event.starts_at is not null
    and now() < v_event.starts_at
    and v_part.status = 'pending'
    and v_part.source = 'registration';

  return jsonb_build_object(
    'participation_id', v_part.id,
    'status',           v_part.status,
    'source',           v_part.source,
    'submitted_at',     v_part.submitted_at,
    'confirmed_at',     v_part.confirmed_at,
    'rejected_at',      v_part.rejected_at,
    'withdrawn_at',     v_part.withdrawn_at,
    'withdrawn_from',   v_part.withdrawn_from,
    'decision_message', v_part.decision_message,
    'version',          v_part.version,
    'person', jsonb_build_object(
      'id',         v_person.id,
      'full_name',  v_person.full_name,
      'avatar_url', v_person.avatar_url,
      'role',       v_person.role,
      'birth_year', v_person.birth_year),
    'event', jsonb_build_object(
      'id',               v_event.id,
      'title',            v_event.title,
      'event_type',       v_event.event_type,
      'team_name',        v_team,
      'timezone',         v_event.timezone,
      'start_date',       v_event.start_date,
      'start_time',       v_event.start_time,
      'end_time',         v_event.end_time,
      'status',           v_event.status,
      'max_participants', v_event.max_participants,
      'confirmed_count',  (v_avail ->> 'confirmed_count')::int,
      'is_full',          (v_avail ->> 'is_full')::boolean),
    'capabilities', jsonb_build_object(
      'confirm', v_manage and v_open and not coalesce((v_avail ->> 'is_full')::boolean, false),
      'reject',  v_manage and v_open,
      'confirm_blocked_reason', case
        when v_manage and v_open and coalesce((v_avail ->> 'is_full')::boolean, false) then 'full'
        else null end)
  );
end;
$$;

revoke all on function public.fetch_selection_event_request(uuid) from public, anon;
grant execute on function public.fetch_selection_event_request(uuid) to authenticated;
