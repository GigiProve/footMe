-- ============================================================
-- DAS-REV-31 — Eventi: profili, Shortlist, lifecycle e QA
--
-- La 28 ha creato il modello con i quattro stati persistenti ma senza chi li
-- muove oltre PUBLISHED; la 29 e la 30 hanno costruito partecipazioni e
-- inviti; la 26/27 il comando unico di aggiunta in Shortlist. Mancavano:
--
--   1. la **provenienza EVENT** di una membership (§10–§12). `created_source`
--      conosceva solo profile/application/unknown. Nascono riferimento e
--      snapshot minimi (titolo, data locale, fuso) sulla entry, scritti dal
--      server nello stesso insert che crea la membership e mai dopo: un add
--      già soddisfatto restituisce la entry com'è (§11, QA-013/014/015);
--   2. il **completamento** dell'evento (§13, §16, §17): scadenza calcolata
--      dal trigger (fine, oppure mezzanotte locale successiva nel fuso IANA
--      dell'evento, già persistito dalla 28), revisione del programma che
--      rende no-op i job vecchi, worker idempotente con orologio iniettabile
--      per i test, scansione periodica di recupero e conclusione manuale;
--   3. l'**annullamento** con messaggio facoltativo e l'**eliminazione della
--      bozza** (§17, §18), con un guard di tabella sulle transizioni: nessuna
--      patch o funzione futura può riaprire un terminale o cancellare un
--      evento pubblicato (QA-053, QA-054);
--   4. il blocco dell'edit **dopo l'inizio** (§15, QA-069): `update_selection_
--      event` della 29 lo permetteva;
--   5. le **notifiche** della matrice §21 che non esistevano: alla persona
--      per annullamento e modifica importante, alla Società per accettazione,
--      rifiuto e ritiro di un confermato, queste ultime **raggruppate** per
--      destinatario, evento, tipo e finestra (§23, §24) con revisione per il
--      letto/non letto (QA-123).
--
-- Corrispondenza nomi concettuali → nomi reali (§4):
--   SelectionEvent        → selection_events
--   EventParticipation    → selection_event_participations (+ _history)
--   ShortlistEntry        → club_shortlist_entries (+ club_shortlist_membership_log)
--   created_source EVENT  → club_shortlist_entries.created_source = 'event'
--   completion job        → selection_event_complete_if_due(event, revision)
--                           + run_selection_event_completion_sweep (pg_cron)
--   outbox                → la riga `notifications` nella transazione del
--                           comando, come in 29/30: il progetto non ha un
--                           provider push né un outbox separato
--   aggregate             → riga `notifications` con `aggregate_key` +
--                           selection_event_response_sources (dedup)
--   audit                 → selection_event_audit (actor nullo = SYSTEM)
--   receipt               → selection_event_operations / application_operations
--
-- Scelte dichiarate:
--   · **scheduler**: il repository non ha nessuna infrastruttura di job.
--     Supabase offre pg_cron: la sezione 5 lo abilita e programma la
--     scansione ogni minuto **solo se l'estensione è disponibile**. Senza,
--     la migrazione non fallisce e lo segnala; il completamento resta
--     comunque garantito al primo comando di lifecycle (annulla/concludi
--     riconciliano la scadenza prima di agire, §16). Abilitare pg_cron sul
--     progetto remoto è un gate di rilascio, non un effetto implicito;
--   · **timezone**: ogni evento ha già `timezone not null` dalla 28
--     (`society_position_timezone()` alla creazione). Non c'è nulla da
--     inventare: un nome IANA non risolvibile lascia la scadenza nulla e
--     l'evento in `selection_event_completion_exceptions` (§14, QA-066);
--   · **SEARCH**: il dominio non ha un'origine SEARCH distinta; la Cerca
--     aggiunge con il comando del profilo (origine `profile`). QA-013 vale
--     per `profile`/`unknown`;
--   · **finestra di aggregazione**: 30 minuti dal primo evento del gruppo,
--     in `selection_event_response_window()` — configurazione backend, non
--     UI (§23).
--
-- Nessun grant ai ruoli, nessun backfill di permessi (§26, QA-048).
-- Nessuna riscrittura delle partecipazioni (§18). Nessuna entry Shortlist
-- creata, rimossa o riclassificata da questa migrazione (§29).
-- ============================================================


-- ============================================================
-- SEZIONE 1 — provenienza EVENT della membership (§10, §11, §12)
-- ============================================================

alter table public.club_shortlist_entries
  add column if not exists source_event_id uuid
    references public.selection_events(id) on delete set null,
  add column if not exists source_event_title_snapshot text,
  add column if not exists source_event_date_snapshot  date,
  add column if not exists source_event_timezone       text;

alter table public.club_shortlist_entries
  drop constraint if exists club_shortlist_entries_source_check;

alter table public.club_shortlist_entries
  add constraint club_shortlist_entries_source_check
  check (created_source in ('profile', 'application', 'event', 'unknown'));

/* §10: snapshot minimi presenti per EVENT, assenti per ogni altra origine.
   Il riferimento può diventare nullo (on delete set null): §12 vuole la
   entry viva e lo snapshot leggibile anche se l'evento non è più
   risolvibile (QA-030). */
alter table public.club_shortlist_entries
  drop constraint if exists club_shortlist_entries_event_source_shape;

alter table public.club_shortlist_entries
  add constraint club_shortlist_entries_event_source_shape
  check (
    case when created_source = 'event'
      then source_event_title_snapshot is not null
       and source_event_date_snapshot is not null
       and source_event_timezone is not null
      else source_event_id is null
       and source_event_title_snapshot is null
       and source_event_date_snapshot is null
       and source_event_timezone is null
    end
  );

create index if not exists club_shortlist_entries_source_event_idx
  on public.club_shortlist_entries (source_event_id)
  where source_event_id is not null;

comment on column public.club_shortlist_entries.source_event_id is
  'DAS-REV-31 §10: evento da cui è nata la entry (solo created_source = event). '
  'Riferimento interno: non concede accesso all''evento.';
comment on column public.club_shortlist_entries.source_event_title_snapshot is
  'DAS-REV-31 §10: titolo dell''evento alla creazione della entry; mai riscritto.';
comment on column public.club_shortlist_entries.source_event_date_snapshot is
  'DAS-REV-31 §10: data locale dell''evento alla creazione della entry; mai riscritta.';

/**
 * §10: «La prima creazione valida determina i campi iniziali.» Origine e
 * snapshot sono proprietà della nascita: nessun update li cambia, neanche
 * il collegamento successivo di una candidatura (§10). Il riferimento può
 * solo diventare nullo, per l'`on delete set null`.
 */
create or replace function public.guard_shortlist_entry_source()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (old.created_source = 'event') <> (new.created_source = 'event')
     or new.source_event_title_snapshot is distinct from old.source_event_title_snapshot
     or new.source_event_date_snapshot  is distinct from old.source_event_date_snapshot
     or new.source_event_timezone       is distinct from old.source_event_timezone
     or (new.source_event_id is not null
         and new.source_event_id is distinct from old.source_event_id) then
    raise exception 'SHORTLIST_SOURCE_IMMUTABLE';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_shortlist_entry_source on public.club_shortlist_entries;
create trigger guard_shortlist_entry_source
  before update on public.club_shortlist_entries
  for each row execute function public.guard_shortlist_entry_source();

/**
 * La sorgente EVENT dichiarata dal client è legittima (§11, punti 4–8)?
 *
 *   · l'evento esiste, è della **stessa** Società della destinazione e non
 *     è una bozza (QA-021);
 *   · l'actor può leggere la superficie partecipanti di quell'evento oggi
 *     (QA-042) — il catalogo 30: manage implica lettura;
 *   · la persona ha una **reale** partecipazione, in qualunque stato
 *     (§11: «Non richiedere CONFIRMED», QA-022/023/024).
 *
 * Un solo booleano: chi chiama non distingue «altra Società» da «nessuna
 * relazione», così il rifiuto non rivela il contesto estraneo (QA-021).
 */
create or replace function public.shortlist_event_source_ok(
  p_club_id   uuid,
  p_event_id  uuid,
  p_person_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.selection_events e
    join public.selection_event_participations p
      on p.event_id = e.id and p.person_id = p_person_id
    where e.id = p_event_id
      and e.club_id = p_club_id
      and e.status in ('published', 'completed', 'cancelled')
      and public.selection_event_can_operate(e.club_id, e.team_id, 'participants')
  );
$$;

revoke all on function public.shortlist_event_source_ok(uuid, uuid, uuid) from public;
revoke execute on function public.shortlist_event_source_ok(uuid, uuid, uuid) from anon, authenticated;

/**
 * Inserimento con provenienza (§11): stessi default della 26 per la entry
 * nuova (Da valutare, priorità e nota nulle), snapshot letti dall'evento
 * canonico — mai dal client (QA-012). Con l'unique (lista, persona) e
 * `on conflict do nothing` due add concorrenti EVENT/PROFILE producono una
 * riga, e chi arriva secondo legge la prima senza toccarla (QA-016/017).
 * Senza sorgente delega alla funzione della 26, che resta l'unico
 * inserimento PROFILE.
 */
create or replace function public.shortlist_insert_entry_sourced(
  p_shortlist_id    uuid,
  p_person_id       uuid,
  p_source_event_id uuid
)
returns table (entry_ref uuid, already boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.selection_events;
  v_row   public.club_shortlist_entries%rowtype;
begin
  if p_source_event_id is null then
    return query select r.entry_ref, r.already
      from public.shortlist_profile_insert_entry(p_shortlist_id, p_person_id) r;
    return;
  end if;

  select * into v_event from public.selection_events e where e.id = p_source_event_id;

  insert into public.club_shortlist_entries
    (shortlist_id, player_profile_id, priority, evaluation_status,
     internal_note, added_by_profile_id, application_id, created_source,
     source_event_id, source_event_title_snapshot, source_event_date_snapshot,
     source_event_timezone)
  values
    (p_shortlist_id, p_person_id, null, 'da_valutare',
     null, auth.uid(), null, 'event',
     v_event.id, coalesce(nullif(btrim(v_event.title), ''), 'Evento'),
     v_event.start_date, v_event.timezone)
  on conflict (shortlist_id, player_profile_id) do nothing
  returning club_shortlist_entries.* into v_row;

  if v_row.id is not null then
    entry_ref := v_row.id;
    already   := false;
    return next;
    return;
  end if;

  select * into v_row
  from public.club_shortlist_entries e0
  where e0.shortlist_id = p_shortlist_id
    and e0.player_profile_id = p_person_id;

  entry_ref := v_row.id;
  already   := true;
  return next;
end;
$$;

revoke all on function public.shortlist_insert_entry_sourced(uuid, uuid, uuid) from public;
revoke execute on function public.shortlist_insert_entry_sourced(uuid, uuid, uuid) from anon, authenticated;


-- ============================================================
-- SEZIONE 2 — lifecycle: colonne, scadenza, guard di transizione (§13, §14)
-- ============================================================

alter table public.selection_events
  add column if not exists completion_due_at    timestamptz,
  add column if not exists completion_revision  integer not null default 0,
  add column if not exists completed_at         timestamptz,
  add column if not exists completed_by         uuid references public.profiles(id) on delete set null,
  add column if not exists completion_source    text,
  add column if not exists cancelled_at         timestamptz,
  add column if not exists cancelled_by         uuid references public.profiles(id) on delete set null,
  add column if not exists cancellation_message text;

alter table public.selection_events
  drop constraint if exists selection_events_completion_source_check;
alter table public.selection_events
  add constraint selection_events_completion_source_check
  check (completion_source is null or completion_source in ('system', 'manual'));

/* §13: i campi del terminale esistono esattamente quando lo stato lo è. */
alter table public.selection_events
  drop constraint if exists selection_events_terminal_fields;
alter table public.selection_events
  add constraint selection_events_terminal_fields
  check (
    (status = 'completed') = (completed_at is not null and completion_source is not null)
    and (status = 'cancelled') = (cancelled_at is not null)
    and (status = 'cancelled' or cancellation_message is null)
  ) not valid; /* nessun produttore di terminali prima della 31: il vincolo
                  vale da qui in avanti senza bloccare dati imprevisti */

create index if not exists selection_events_completion_due_idx
  on public.selection_events (completion_due_at, id)
  where status = 'published';

comment on column public.selection_events.completion_due_at is
  'DAS-REV-31 §14: istante canonico di completamento automatico. ends_at se '
  'presente, altrimenti la mezzanotte locale successiva al giorno dell''evento '
  'nel suo fuso IANA. Scritto solo dal trigger selection_events_schedule.';
comment on column public.selection_events.completion_revision is
  'DAS-REV-31 §16: revisione del programma di completamento. Cambia con la '
  'scadenza; un job con revisione diversa è un no-op.';

/* L'audit della 28 aveva un actor obbligatorio: il completamento automatico
   è di SYSTEM (§16: «Audit con source SYSTEM»). */
alter table public.selection_event_audit
  alter column actor_id drop not null;
alter table public.selection_event_audit
  add column if not exists actor_kind text not null default 'user',
  add column if not exists details    jsonb;
alter table public.selection_event_audit
  drop constraint if exists selection_event_audit_actor_kind_check;
alter table public.selection_event_audit
  add constraint selection_event_audit_actor_kind_check
  check (actor_kind in ('user', 'system')
         and ((actor_kind = 'system') = (actor_id is null)));

/**
 * §14: «Se ends_at esiste, la scadenza è ends_at. Se manca … è l'inizio del
 * giorno locale successivo: mezzanotte nella timezone IANA, convertita in
 * UTC. Non usare starts_at+24ore o 23:59:59; gestisci i cambi di ora
 * legale.» `(data + 1)::timestamp at time zone fuso` è esattamente quella
 * mezzanotte, qualunque sia la durata del giorno (QA-063, QA-064). Un fuso
 * non risolvibile non produce un istante inventato: null.
 */
create or replace function public.selection_event_completion_deadline(
  p_ends_at    timestamptz,
  p_start_date date,
  p_timezone   text
)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
begin
  if p_ends_at is not null then
    return p_ends_at;
  end if;

  if p_start_date is null or p_timezone is null then
    return null;
  end if;

  return ((p_start_date + 1)::timestamp at time zone p_timezone);
exception when others then
  return null;
end;
$$;

revoke all on function public.selection_event_completion_deadline(timestamptz, date, text) from public;
revoke execute on function public.selection_event_completion_deadline(timestamptz, date, text) from anon, authenticated;

/**
 * Programma di completamento, ricalcolato a ogni scrittura (§16: «Ogni
 * pubblicazione/edit temporale aggiorna atomicamente la revisione del
 * programma di completamento e l'evento»). Gira dopo `selection_events_
 * derive` (ordine alfabetico dei trigger), quindi legge gli istanti già
 * proiettati. Un terminale conserva la scadenza che aveva: serve all'audit
 * per distinguere ritardo del worker e istante previsto.
 */
create or replace function public.selection_events_schedule()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_due timestamptz;
begin
  if new.status = 'published' then
    v_due := public.selection_event_completion_deadline(new.ends_at, new.start_date, new.timezone);
  elsif tg_op = 'UPDATE' and new.status in ('completed', 'cancelled') then
    v_due := old.completion_due_at;
  else
    v_due := null;
  end if;

  if tg_op = 'INSERT' then
    new.completion_due_at   := v_due;
    new.completion_revision := case when v_due is null then 0 else 1 end;
  elsif v_due is distinct from old.completion_due_at then
    new.completion_due_at   := v_due;
    new.completion_revision := old.completion_revision + 1;
  else
    new.completion_due_at   := old.completion_due_at;
    new.completion_revision := old.completion_revision;
  end if;

  return new;
end;
$$;

revoke execute on function public.selection_events_schedule() from anon, authenticated;

drop trigger if exists selection_events_schedule on public.selection_events;
create trigger selection_events_schedule
  before insert or update on public.selection_events
  for each row execute function public.selection_events_schedule();

/**
 * Guard di tabella sulle transizioni (§13, QA-053, QA-054). Vale per ogni
 * scrittore, presente o futuro:
 *
 *   draft → published · published → completed · published → cancelled;
 *   un terminale non cambia più contenuto né stato;
 *   solo una bozza si elimina. La cancellazione a cascata della Società
 *   (trigger annidato, `pg_trigger_depth() > 1`) resta possibile: non è
 *   un'azione di dominio sull'evento.
 */
create or replace function public.selection_events_lifecycle_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    /* Solo la cascata della Società (trigger referenziale annidato) può
       cancellare un evento non in bozza. */
    if old.status <> 'draft' and pg_trigger_depth() <= 1 then
      raise exception 'SELECTION_EVENT_LIFECYCLE_CONFLICT';
    end if;
    return old;
  end if;

  /* Su un terminale l'unica scrittura ammessa è l'azione referenziale
     `on delete set null` di completed_by/cancelled_by quando un account
     viene eliminato: nient'altro, da nessun livello di trigger. */
  if old.status in ('completed', 'cancelled') then
    if (to_jsonb(new) - 'updated_at' - 'version' - 'completed_by' - 'cancelled_by')
         is distinct from (to_jsonb(old) - 'updated_at' - 'version' - 'completed_by' - 'cancelled_by')
       or (new.completed_by is distinct from old.completed_by and new.completed_by is not null)
       or (new.cancelled_by is distinct from old.cancelled_by and new.cancelled_by is not null) then
      raise exception 'SELECTION_EVENT_LIFECYCLE_CONFLICT';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status
     and not ((old.status = 'draft' and new.status = 'published')
              or (old.status = 'published' and new.status in ('completed', 'cancelled'))) then
    raise exception 'SELECTION_EVENT_LIFECYCLE_CONFLICT';
  end if;

  return new;
end;
$$;

revoke execute on function public.selection_events_lifecycle_guard() from anon, authenticated;

drop trigger if exists selection_events_lifecycle_guard on public.selection_events;
create trigger selection_events_lifecycle_guard
  before update or delete on public.selection_events
  for each row execute function public.selection_events_lifecycle_guard();

/* Programma per gli eventi già pubblicati (§29). Fuori dai trigger di
   dominio perché non è un'azione: versione e `updated_at` restano. Gli
   eventi già terminati non ricevono nulla, e nessun evento viene concluso
   qui: gli arretrati li conclude il primo passaggio del worker, una volta
   sola, senza notifiche (§29: «attivazione del job sugli arretrati …
   deduplicata, senza push»). */
alter table public.selection_events disable trigger selection_events_derive;
alter table public.selection_events disable trigger selection_events_lifecycle_guard;

update public.selection_events e
set completion_due_at   = public.selection_event_completion_deadline(e.ends_at, e.start_date, e.timezone),
    completion_revision = 1
where e.status = 'published'
  and e.completion_due_at is null;

alter table public.selection_events enable trigger selection_events_lifecycle_guard;
alter table public.selection_events enable trigger selection_events_derive;

/**
 * §14, §29, QA-066/QA-137: eventi pubblicati senza una scadenza
 * determinabile. Non vengono conclusi con valori ambigui: restano da
 * riconciliare, e questa vista li elenca per chi gestisce il progetto.
 */
create or replace view public.selection_event_completion_exceptions as
  select e.id, e.club_id, e.status, e.start_date, e.timezone, e.ends_at
  from public.selection_events e
  where e.status = 'published'
    and e.completion_due_at is null;

revoke all on public.selection_event_completion_exceptions from public, anon, authenticated;


-- ============================================================
-- SEZIONE 3 — transizione terminale, worker e recupero (§16)
-- ============================================================

/**
 * Unico punto che scrive un terminale. Lo chiamano il worker, la
 * conclusione manuale e l'annullamento, sempre con la riga già bloccata
 * `for update`: lo stato atteso è ricontrollato qui, nella stessa
 * istruzione (CAS), così un secondo esecutore trova 0 righe e non scrive
 * né audit né notifiche (QA-072, QA-075, QA-076).
 *
 * `final_confirmed_count` è il conteggio dei confermati **al commit** (28
 * §11): lo storico non viene riscritto né azzerato (§7, §18).
 */
create or replace function public.selection_event_finalize(
  p_event_id uuid,
  p_status   text,
  p_actor    uuid,
  p_message  text
)
returns public.selection_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row       public.selection_events;
  v_confirmed integer;
begin
  select c.confirmed_count into v_confirmed
  from public.selection_event_participation_counts(p_event_id) c;

  update public.selection_events e
  set status                = p_status,
      completed_at          = case when p_status = 'completed' then timezone('utc', now()) end,
      completed_by          = case when p_status = 'completed' then p_actor end,
      completion_source     = case when p_status = 'completed'
                                   then case when p_actor is null then 'system' else 'manual' end end,
      cancelled_at          = case when p_status = 'cancelled' then timezone('utc', now()) end,
      cancelled_by          = case when p_status = 'cancelled' then p_actor end,
      cancellation_message  = case when p_status = 'cancelled' then p_message end,
      final_confirmed_count = coalesce(v_confirmed, 0)
  where e.id = p_event_id
    and e.status = 'published'
  returning * into v_row;

  if v_row.id is null then
    return null;
  end if;

  insert into public.selection_event_audit
    (event_id, club_id, actor_id, actor_kind, operation, version, changed_fields, details)
  values
    (v_row.id, v_row.club_id, p_actor,
     case when p_actor is null then 'system' else 'user' end,
     case when p_status = 'completed' then 'complete' else 'cancel' end,
     v_row.version, array['status'],
     jsonb_build_object(
       'deadline',     v_row.completion_due_at,
       'revision',     v_row.completion_revision,
       'has_message',  p_message is not null));

  return v_row;
end;
$$;

revoke all on function public.selection_event_finalize(uuid, text, uuid, text) from public;
revoke execute on function public.selection_event_finalize(uuid, text, uuid, text) from anon, authenticated;

/**
 * Il job (§16): «Il job contiene event_id e versione pertinente; al
 * risveglio rilegge stato, revisione e deadline correnti.» Esiti:
 *
 *   completed — transizione eseguita adesso (unica volta);
 *   noop      — l'evento non è più PUBLISHED (concluso, annullato, sparito);
 *   stale     — la revisione è cambiata: posticipo, anticipo o nuova fine
 *               (QA-071). Il job della revisione corrente farà il suo lavoro;
 *   not_due   — la scadenza non è ancora raggiunta.
 *
 * `p_now` esiste per i test con orologio controllato (§31). Nessun ruolo
 * API può chiamarla: un client non può anticipare il completamento.
 * Nessuna notifica (§16: «Il completamento normale non genera push»).
 */
create or replace function public.selection_event_complete_if_due(
  p_event_id          uuid,
  p_expected_revision integer default null,
  p_now               timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_row public.selection_events;
begin
  select * into v_row from public.selection_events e where e.id = p_event_id for update;

  if v_row.id is null or v_row.status <> 'published' then
    return 'noop';
  end if;

  if p_expected_revision is not null and p_expected_revision <> v_row.completion_revision then
    return 'stale';
  end if;

  if v_row.completion_due_at is null or v_now < v_row.completion_due_at then
    return 'not_due';
  end if;

  perform public.selection_event_finalize(v_row.id, 'completed', null, null);
  return 'completed';
end;
$$;

revoke all on function public.selection_event_complete_if_due(uuid, integer, timestamptz) from public;
revoke execute on function public.selection_event_complete_if_due(uuid, integer, timestamptz) from anon, authenticated;

/**
 * Scansione di recupero (§16: «Prevedi recupero dei job dovuti persi o
 * ritardati … senza loop non limitati»). Un lotto limitato per chiamata;
 * `skip locked` lascia a un altro worker concorrente le righe che sta già
 * trattando, e il CAS di `selection_event_finalize` garantisce comunque un
 * solo completamento (QA-072, QA-073). Restituisce quanti eventi ha concluso.
 */
create or replace function public.run_selection_event_completion_sweep(
  p_limit integer default 100,
  p_now   timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now  timestamptz := coalesce(p_now, now());
  v_done integer := 0;
  v_row  record;
begin
  for v_row in
    select e.id, e.completion_revision
    from public.selection_events e
    where e.status = 'published'
      and e.completion_due_at is not null
      and e.completion_due_at <= v_now
    order by e.completion_due_at, e.id
    limit greatest(1, least(coalesce(p_limit, 100), 1000))
    for update skip locked
  loop
    if public.selection_event_complete_if_due(v_row.id, v_row.completion_revision, v_now) = 'completed' then
      v_done := v_done + 1;
    end if;
  end loop;

  return v_done;
end;
$$;

revoke all on function public.run_selection_event_completion_sweep(integer, timestamptz) from public;
revoke execute on function public.run_selection_event_completion_sweep(integer, timestamptz) from anon, authenticated;


-- ============================================================
-- SEZIONE 4 — comandi: concludi, annulla, elimina bozza (§17, §18, §27)
-- ============================================================

/**
 * Conclusione manuale (§17). Solo dopo l'inizio (QA-058), con `manage`
 * sulla squadra dell'evento. Esiti:
 *
 *   completed         — conclusa ora da questo actor;
 *   already_completed — già conclusa (worker o altro gestore): stato
 *                       coerente, nessun nuovo audit (§17);
 *   completed + completion_source 'system' — la scadenza era già passata e
 *                       il worker non era ancora arrivato: il comando
 *                       applica la transizione canonica di SYSTEM (§16).
 *
 * Annullamento vincitore: `SELECTION_EVENT_CANCELLED`, mai sovrascritto.
 */
create or replace function public.complete_selection_event(
  p_event_id        uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_finger  text := md5('complete|v1|' || coalesce(p_event_id::text, ''));
  v_receipt jsonb;
  v_event   public.selection_events;
  v_done    public.selection_events;
  v_outcome text;
  v_result  jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('selection_event_op:' || p_idempotency_key));
  end if;

  v_receipt := public.selection_event_operation_replay(p_idempotency_key, p_event_id, 'complete', v_finger);

  if v_receipt is not null then
    if not exists (
      select 1 from public.selection_events e
      where e.id = p_event_id
        and public.selection_event_can_operate(e.club_id, e.team_id, 'view')
    ) then
      raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
    end if;

    return v_receipt || jsonb_build_object('replayed', true);
  end if;

  select * into v_event from public.selection_events e where e.id = p_event_id for update;

  if v_event.id is null
     or not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'view') then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  if not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'manage') then
    raise exception 'SELECTION_EVENT_NOT_AUTHORIZED';
  end if;

  if v_event.status = 'cancelled' then
    raise exception 'SELECTION_EVENT_CANCELLED';
  end if;

  if v_event.status = 'completed' then
    v_outcome := 'already_completed';
    v_done    := v_event;
  elsif v_event.status <> 'published' then
    raise exception 'SELECTION_EVENT_LIFECYCLE_CONFLICT';
  elsif v_event.starts_at is null or now() < v_event.starts_at then
    raise exception 'SELECTION_EVENT_NOT_STARTED';
  elsif v_event.completion_due_at is not null and now() >= v_event.completion_due_at then
    v_done    := public.selection_event_finalize(v_event.id, 'completed', null, null);
    v_outcome := 'completed';
  else
    v_done    := public.selection_event_finalize(v_event.id, 'completed', v_uid, null);
    v_outcome := 'completed';
  end if;

  v_result := jsonb_build_object(
    'event_id',          v_done.id,
    'status',            v_done.status,
    'version',           v_done.version,
    'outcome',           v_outcome,
    'completion_source', v_done.completion_source);

  perform public.selection_event_operation_record(
    p_idempotency_key, v_done.club_id, v_done.id, 'complete', v_finger, v_result);

  return v_result || jsonb_build_object('replayed', false);
end;
$$;

revoke all on function public.complete_selection_event(uuid, text) from public, anon;
grant execute on function public.complete_selection_event(uuid, text) to authenticated;

/**
 * Annullamento (§18). Prima o dopo l'inizio, mai dopo la conclusione
 * canonica: se la scadenza è già passata, il comando applica il
 * completamento di SYSTEM e lo restituisce come esito `completed` — §16:
 * «Non consentire annullamento tardivo … solo perché la coda è lenta».
 *
 * Il messaggio è testo semplice normalizzato (§18), limite centrale della
 * 30 (`invitationMessage`, 500): nessun markup interpretato da nessuna
 * superficie, e mai nel payload pubblico né nel corpo della notifica.
 *
 * **Le partecipazioni non vengono toccate** (§18): CONFIRMED, PENDING e
 * INVITED restano tali, e l'evento annullato le rende non operative. Il
 * lock della riga evento serializza l'annullamento con iscrizioni,
 * accettazioni e conferme, che bloccano la stessa riga (QA-077).
 */
create or replace function public.cancel_selection_event(
  p_event_id        uuid,
  p_message         text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_message text := public.selection_event_clean_text(p_message, true);
  v_limit   integer := coalesce((public.selection_event_limits() ->> 'invitationMessage')::integer, 500);
  v_finger  text;
  v_receipt jsonb;
  v_event   public.selection_events;
  v_done    public.selection_events;
  v_outcome text;
  v_result  jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_message is not null and char_length(v_message) > v_limit then
    raise exception 'SELECTION_EVENT_MESSAGE_TOO_LONG';
  end if;

  v_finger := md5('cancel|v1|' || coalesce(p_event_id::text, '') || '|' || coalesce(v_message, ''));

  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('selection_event_op:' || p_idempotency_key));
  end if;

  v_receipt := public.selection_event_operation_replay(p_idempotency_key, p_event_id, 'cancel', v_finger);

  if v_receipt is not null then
    if not exists (
      select 1 from public.selection_events e
      where e.id = p_event_id
        and public.selection_event_can_operate(e.club_id, e.team_id, 'view')
    ) then
      raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
    end if;

    return v_receipt || jsonb_build_object('replayed', true);
  end if;

  select * into v_event from public.selection_events e where e.id = p_event_id for update;

  if v_event.id is null
     or not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'view') then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  if not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'manage') then
    raise exception 'SELECTION_EVENT_NOT_AUTHORIZED';
  end if;

  if v_event.status = 'completed' then
    raise exception 'SELECTION_EVENT_COMPLETED';
  end if;

  if v_event.status = 'cancelled' then
    v_outcome := 'already_cancelled';
    v_done    := v_event;
  elsif v_event.status <> 'published' then
    raise exception 'SELECTION_EVENT_LIFECYCLE_CONFLICT';
  elsif v_event.completion_due_at is not null and now() >= v_event.completion_due_at then
    /* La conclusione canonica precede l'azione tardiva e viene committata. */
    v_done    := public.selection_event_finalize(v_event.id, 'completed', null, null);
    v_outcome := 'completed';
  else
    v_done    := public.selection_event_finalize(v_event.id, 'cancelled', v_uid, v_message);
    v_outcome := 'cancelled';
    /* §28: «Un errore notifica non annulla business commit.» */
    begin
      perform public.notify_selection_event_cancelled(v_done);
    exception when others then
      raise warning 'DAS-REV-31: notifiche di annullamento non prodotte per %: %', v_done.id, sqlerrm;
    end;
  end if;

  v_result := jsonb_build_object(
    'event_id', v_done.id,
    'status',   v_done.status,
    'version',  v_done.version,
    'outcome',  v_outcome);

  perform public.selection_event_operation_record(
    p_idempotency_key, v_done.club_id, v_done.id, 'cancel', v_finger, v_result);

  return v_result || jsonb_build_object('replayed', false);
end;
$$;

revoke all on function public.cancel_selection_event(uuid, text, text) from public, anon;
grant execute on function public.cancel_selection_event(uuid, text, text) to authenticated;

/**
 * Elimina bozza (§17). Solo DRAFT, con la facoltà di modificarla (crea o
 * gestisci, come il salvataggio della 28). Una pubblicazione concorrente
 * blocca la stessa riga: chi arriva secondo trova PUBLISHED e riceve
 * LIFECYCLE_CONFLICT; nessun evento pubblicato viene cancellato (QA-053).
 * Un retry con la stessa chiave trova la ricevuta e non produce altro
 * (QA-052). La locandina resta un asset della Società, gestito dalla sua
 * policy: nessuna eliminazione condivisa.
 */
create or replace function public.delete_selection_event_draft(
  p_event_id        uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_finger  text := md5('delete_draft|v1|' || coalesce(p_event_id::text, ''));
  v_receipt jsonb;
  v_event   public.selection_events;
  v_result  jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('selection_event_op:' || p_idempotency_key));
  end if;

  v_receipt := public.selection_event_operation_replay(p_idempotency_key, p_event_id, 'delete_draft', v_finger);

  if v_receipt is not null then
    return v_receipt || jsonb_build_object('replayed', true);
  end if;

  select * into v_event from public.selection_events e where e.id = p_event_id for update;

  if v_event.id is null
     or not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'view') then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  if not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'edit') then
    raise exception 'SELECTION_EVENT_NOT_AUTHORIZED';
  end if;

  if v_event.status <> 'draft' then
    raise exception 'SELECTION_EVENT_LIFECYCLE_CONFLICT';
  end if;

  delete from public.selection_events e where e.id = v_event.id;

  insert into public.selection_event_audit
    (event_id, club_id, actor_id, actor_kind, operation, version, changed_fields)
  values
    (v_event.id, v_event.club_id, v_uid, 'user', 'delete_draft', v_event.version, array[]::text[]);

  v_result := jsonb_build_object('event_id', v_event.id, 'outcome', 'deleted');

  perform public.selection_event_operation_record(
    p_idempotency_key, v_event.club_id, v_event.id, 'delete_draft', v_finger, v_result);

  return v_result || jsonb_build_object('replayed', false);
end;
$$;

revoke all on function public.delete_selection_event_draft(uuid, text) from public, anon;
grant execute on function public.delete_selection_event_draft(uuid, text) to authenticated;


-- ============================================================
-- SEZIONE 5 — scheduler (§16)
--
-- pg_cron, se l'ambiente lo offre: Supabase lo include. La programmazione è
-- idempotente (unschedule + schedule con lo stesso nome). In un ambiente
-- senza l'estensione (PGlite dei test, sviluppo locale senza cron) la
-- migrazione prosegue e lo dichiara: il completamento resta raggiungibile
-- con `run_selection_event_completion_sweep()` e dai comandi di lifecycle.
-- ============================================================

do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
   begin
    create extension if not exists pg_cron;

    if exists (select 1 from cron.job where jobname = 'selection-events-completion') then
      perform cron.unschedule('selection-events-completion');
    end if;

    perform cron.schedule(
      'selection-events-completion',
      '* * * * *',
      'select public.run_selection_event_completion_sweep(100)');
   exception when others then
    /* Privilegi insufficienti o estensione non attivabile: la migrazione
       prosegue e lo dichiara, come quando pg_cron manca. */
    raise warning 'DAS-REV-31: pg_cron non attivabile (%); completamento automatico non programmato.', sqlerrm;
   end;
  else
    raise notice 'DAS-REV-31: pg_cron non disponibile; completamento automatico non programmato in questo ambiente.';
  end if;
end;
$do$;


-- ============================================================
-- SEZIONE 6 — notifiche: revisione, aggregato, letto per revisione (§24)
-- ============================================================

/* `updated_at` è l'ultima volta che la riga ha detto qualcosa di nuovo:
   per una riga semplice coincide con la creazione, per un aggregato con
   l'ultima azione aggiunta. Il Centro ordina per questo campo. Il backfill
   copia `created_at`, non `now()`: lo storico non cambia ordine. */
alter table public.notifications
  add column if not exists revision      integer not null default 1,
  add column if not exists read_revision integer,
  add column if not exists aggregate_key text,
  add column if not exists updated_at    timestamptz;

update public.notifications n
set updated_at = n.created_at
where n.updated_at is null;

alter table public.notifications
  alter column updated_at set default timezone('utc', now()),
  alter column updated_at set not null;

/* Un aggregato per destinatario e chiave (§23: «Non mischiare Società,
   eventi, tipi o destinatari»): la chiave contiene tipo, evento e finestra,
   la riga il destinatario. */
create unique index if not exists notifications_aggregate_uniq
  on public.notifications (recipient_profile_id, aggregate_key)
  where aggregate_key is not null;

create index if not exists notifications_recipient_updated_idx
  on public.notifications (recipient_profile_id, updated_at desc);

/* Dedup delle notifiche alla persona (§21): una per annullamento, una per
   versione salvata dell'evento — un retry non ne crea un'altra. */
create unique index if not exists notifications_selection_event_cancelled_uniq
  on public.notifications (recipient_profile_id, (data ->> 'event_id'))
  where type = 'selection_event_cancelled';

create unique index if not exists notifications_selection_event_updated_uniq
  on public.notifications (recipient_profile_id, (data ->> 'event_id'), (data ->> 'event_version'))
  where type = 'selection_event_updated';

create or replace function public.notifications_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.revision      := 1;
  new.read_revision := case when new.is_read then 1 end;
  new.updated_at    := coalesce(new.created_at, timezone('utc', now()));
  return new;
end;
$$;

revoke execute on function public.notifications_stamp() from anon, authenticated;

drop trigger if exists notifications_stamp on public.notifications;
create trigger notifications_stamp
  before insert on public.notifications
  for each row execute function public.notifications_stamp();

/**
 * Letto riferito alla revisione vista (§24, QA-123): se nel frattempo una
 * nuova risposta ha aggiornato il gruppo, la revisione non coincide e la
 * riga resta non letta. Senza revisione (client precedente) vale quella
 * corrente. Solo il destinatario; idempotente.
 */
create or replace function public.mark_notification_read(
  p_notification_id uuid,
  p_revision        integer default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.notifications n
  set is_read       = true,
      read_revision = n.revision
  where n.id = p_notification_id
    and n.recipient_profile_id = auth.uid()
    and (p_revision is null or n.revision = p_revision)
  returning n.id into v_id;

  if v_id is not null then
    return true;
  end if;

  return exists (
    select 1 from public.notifications n
    where n.id = p_notification_id
      and n.recipient_profile_id = auth.uid()
      and n.is_read);
end;
$$;

revoke all on function public.mark_notification_read(uuid, integer) from public, anon;
grant execute on function public.mark_notification_read(uuid, integer) to authenticated;


-- ============================================================
-- SEZIONE 7 — notifiche alla persona: annullamento e modifica (§20, §22)
-- ============================================================

/**
 * Pubblico attivo al commit (§22): CONFIRMED, PENDING, INVITED. Non
 * REJECTED, DECLINED, WITHDRAWN, REVOKED, REMOVED (QA-085). Mai l'actor
 * (nessuna self-notifica). Il profilo deve esistere ancora: la consegna
 * non va a un account sparito.
 */
create or replace function public.selection_event_active_people(
  p_event_id uuid,
  p_actor    uuid
)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.person_id
  from public.selection_event_participations p
  join public.profiles pr on pr.id = p.person_id
  join public.selection_events e on e.id = p.event_id
  join public.clubs c on c.id = e.club_id
  where p.event_id = p_event_id
    and p.status in ('confirmed', 'pending', 'invited')
    and p.person_id is distinct from p_actor
    /* §22: la consegna rilegge i blocchi; la coppia del dominio eventi è
       persona ↔ owner della Società (29, 30). */
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_profile_id = p.person_id and b.blocked_profile_id = c.owner_profile_id)
         or (b.blocker_profile_id = c.owner_profile_id and b.blocked_profile_id = p.person_id));
$$;

revoke all on function public.selection_event_active_people(uuid, uuid) from public;
revoke execute on function public.selection_event_active_people(uuid, uuid) from anon, authenticated;

/**
 * §18, §21: «AC Como ha annullato Open day Primavera.» Il messaggio della
 * Società non entra nel corpo (lock screen, §22): si legge nel dettaglio.
 */
create or replace function public.notify_selection_event_cancelled(
  p_event public.selection_events
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club  text;
  v_title text := coalesce(nullif(btrim(p_event.title), ''), 'un evento');
begin
  select c.name into v_club from public.clubs c where c.id = p_event.club_id;
  v_club := coalesce(nullif(btrim(v_club), ''), 'La Società');

  insert into public.notifications (recipient_profile_id, type, title, body, data)
  select person, 'selection_event_cancelled', 'Evento annullato',
         v_club || ' ha annullato ' || v_title || '.',
         jsonb_build_object('event_id', p_event.id)
  from public.selection_event_active_people(p_event.id, auth.uid()) as person
  on conflict do nothing;
end;
$$;

revoke all on function public.notify_selection_event_cancelled(public.selection_events) from public;
revoke execute on function public.notify_selection_event_cancelled(public.selection_events) from anon, authenticated;

/**
 * Modifica importante (§20): data, inizio, fine, struttura, indirizzo.
 * Confronto sui valori **salvati** (già normalizzati da apply_patch e dal
 * trigger), quindi una patch senza differenza semantica non notifica
 * (QA-094); locandina, capienza, anni, descrizione e termine iscrizioni
 * non sono importanti (QA-095/096/097). Più campi nello stesso Salva = una
 * notifica per destinatario, deduplicata sulla versione (QA-093).
 */
create or replace function public.notify_selection_event_updated(
  p_old public.selection_events,
  p_new public.selection_events
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club  text;
  v_title text := coalesce(nullif(btrim(p_new.title), ''), 'un evento');
begin
  if p_new.status <> 'published' or p_new.version = p_old.version then
    return;
  end if;

  if (p_old.start_date, p_old.starts_at, p_old.ends_at, p_old.venue_name, p_old.venue_address)
     is not distinct from
     (p_new.start_date, p_new.starts_at, p_new.ends_at, p_new.venue_name, p_new.venue_address) then
    return;
  end if;

  select c.name into v_club from public.clubs c where c.id = p_new.club_id;
  v_club := coalesce(nullif(btrim(v_club), ''), 'La Società');

  insert into public.notifications (recipient_profile_id, type, title, body, data)
  select person, 'selection_event_updated',
         v_club || ' ha aggiornato ' || v_title || '.',
         'Controlla le nuove informazioni sull''evento.',
         jsonb_build_object('event_id', p_new.id, 'event_version', p_new.version)
  from public.selection_event_active_people(p_new.id, auth.uid()) as person
  on conflict do nothing;
end;
$$;

revoke all on function public.notify_selection_event_updated(public.selection_events, public.selection_events) from public;
revoke execute on function public.notify_selection_event_updated(public.selection_events, public.selection_events) from anon, authenticated;


-- ============================================================
-- SEZIONE 8 — risposte alla Società, raggruppate (§21–§25)
-- ============================================================

/** §23: finestra breve e configurabile, fissa dal primo evento del gruppo. */
create or replace function public.selection_event_response_window()
returns interval
language sql
immutable
as $$ select interval '30 minutes' $$;

/**
 * Gestori eleggibili (§22): Owner della Società, oppure accesso attivo con
 * `selection_events_manage` sull'intera Società o sulla squadra
 * dell'evento. È la stessa regola di `selection_event_can_operate(…,
 * 'manage')`, riscritta per un destinatario che non è l'utente corrente.
 * `manage` implica la lettura partecipanti (30). Non tutti i membri, non il
 * solo creator (QA-108, QA-049). La capability, non l'azione eseguibile:
 * l'inizio dell'evento non toglie il destinatario (QA-109).
 */
create or replace function public.selection_event_manager_recipients(
  p_event public.selection_events
)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.owner_profile_id
  from public.clubs c
  where c.id = p_event.club_id
    and c.owner_profile_id is not null
  union
  select perm.profile_id
  from public.club_member_permissions perm
  where perm.club_id = p_event.club_id
    and perm.permission_key = 'selection_events_manage'
    and (perm.team_id is null or perm.team_id = p_event.team_id)
    and public.club_access_is_active(p_event.club_id, perm.profile_id);
$$;

revoke all on function public.selection_event_manager_recipients(public.selection_events) from public;
revoke execute on function public.selection_event_manager_recipients(public.selection_events) from anon, authenticated;

/**
 * Riferimenti deduplicati di ogni gruppo (§24). Una riga per destinatario e
 * azione originale (la riga dello storico partecipazioni, append-only): la
 * chiave primaria rende innocuo un secondo passaggio dello stesso evento
 * (QA-117). Le persone distinte si contano qui, non dalla notifica.
 */
create table if not exists public.selection_event_response_sources (
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  source_id            uuid not null,
  aggregate_key        text not null,
  notification_type    text not null,
  club_id              uuid not null,
  event_id             uuid not null,
  person_id            uuid not null,
  occurred_at          timestamptz not null,
  window_start         timestamptz not null,
  primary key (recipient_profile_id, source_id)
);

create index if not exists selection_event_response_sources_group_idx
  on public.selection_event_response_sources (recipient_profile_id, aggregate_key, occurred_at desc);

alter table public.selection_event_response_sources enable row level security;
revoke all on public.selection_event_response_sources from anon, authenticated;

/**
 * Riscrive titolo, corpo e dati del gruppo dalla proiezione **mostrabile**
 * al destinatario (§23): persone con profilo esistente e nessun blocco con
 * lui. Il numero conta persone distinte (QA-118); l'anteprima prende al
 * massimo due nomi, le più recenti; il resto è «altri N». Restituisce il
 * numero di persone mostrabili: zero significa che il gruppo non ha niente
 * da dire senza rivelare qualcuno (QA-128).
 */
create or replace function public.selection_event_response_payload(
  p_recipient uuid,
  p_key       text,
  p_type      text,
  p_event     public.selection_events,
  out o_title text,
  out o_body  text,
  out o_data  jsonb,
  out o_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_title   text := coalesce(nullif(btrim(p_event.title), ''), 'un evento');
  v_names   text[];
  v_sources integer;
  v_first   timestamptz;
  v_last    timestamptz;
  v_window  timestamptz;
  v_filter  text;
  v_others  integer;
begin
  with visible as (
    select s.person_id, s.occurred_at, s.window_start, pr.full_name
    from public.selection_event_response_sources s
    join public.profiles pr on pr.id = s.person_id
    where s.recipient_profile_id = p_recipient
      and s.aggregate_key = p_key
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_profile_id = p_recipient and b.blocked_profile_id = s.person_id)
           or (b.blocker_profile_id = s.person_id and b.blocked_profile_id = p_recipient))
  ),
  people as (
    select v.person_id, max(v.occurred_at) as last_at,
           coalesce(nullif(btrim(max(v.full_name)), ''), 'Un profilo') as name
    from visible v
    group by v.person_id
  )
  select count(*)::int,
         (select array_agg(p2.name order by p2.last_at desc, p2.person_id)
            from (select * from people order by last_at desc, person_id limit 2) p2),
         (select count(*)::int from visible),
         (select min(occurred_at) from visible),
         (select max(occurred_at) from visible),
         (select min(window_start) from visible)
    into o_count, v_names, v_sources, v_first, v_last, v_window
  from people;

  if coalesce(o_count, 0) = 0 then
    o_count := 0;
    return;
  end if;

  v_filter := case p_type
    when 'selection_event_invitation_accepted' then 'confirmed'
    when 'selection_event_invitation_declined' then 'declined'
    else 'withdrawn'
  end;

  o_title := case
    when o_count = 1 then v_names[1] || case p_type
      when 'selection_event_invitation_accepted' then ' ha accettato l''invito a '
      when 'selection_event_invitation_declined' then ' ha rifiutato l''invito a '
      else ' ha annullato la partecipazione a '
    end
    else o_count::text || case p_type
      when 'selection_event_invitation_accepted' then ' profili hanno accettato l''invito a '
      when 'selection_event_invitation_declined' then ' profili hanno rifiutato l''invito a '
      else ' partecipanti hanno annullato la partecipazione a '
    end
  end || v_title || '.';

  v_others := greatest(o_count - coalesce(array_length(v_names, 1), 0), 0);

  o_body := case
    when o_count = 1 then null
    when v_others = 0 then array_to_string(v_names, ' e ')
    else array_to_string(v_names, ', ') || ' e ' || case when v_others = 1 then 'un altro' else 'altri ' || v_others end
  end;

  o_data := jsonb_build_object(
    'event_id',              p_event.id,
    'club_id',               p_event.club_id,
    'event_title',           v_title,
    'participants_filter',   v_filter,
    'distinct_person_count', o_count,
    'source_event_count',    v_sources,
    'preview_names',         to_jsonb(v_names),
    'others_count',          v_others,
    'first_event_at',        v_first,
    'last_event_at',         v_last,
    'window_start',          v_window);
end;
$$;

revoke all on function public.selection_event_response_payload(uuid, text, text, public.selection_events) from public;
revoke execute on function public.selection_event_response_payload(uuid, text, text, public.selection_events) from anon, authenticated;

/**
 * Aggiunge un'azione al gruppo giusto di ogni gestore eleggibile (§23).
 *
 * Finestra: si cerca un gruppo dello stesso destinatario, tipo ed evento
 * aperto da meno di `response_window` rispetto all'istante **dell'azione**;
 * se non c'è, l'azione apre un gruppo nuovo che inizia da lei (QA-119). Un
 * gruppo non scorre e non si riapre: un'azione tarda fuori finestra apre il
 * proprio gruppo, senza fondersi con risposte lontane (QA-120). Le azioni
 * nascono nella transazione del comando, con il tempo del server, quindi
 * l'ordine è quello di commit sulla riga evento.
 *
 * Append a un gruppo già letto: nuova revisione e di nuovo non letto, una
 * sola unità di badge (QA-121/122/124). Un'azione già registrata non
 * incrementa nulla (QA-117).
 */
create or replace function public.selection_event_record_response(
  p_source_id   uuid,
  p_type        text,
  p_event_id    uuid,
  p_person_id   uuid,
  p_occurred_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event     public.selection_events;
  v_recipient uuid;
  v_window    timestamptz;
  v_key       text;
  v_notif     public.notifications;
  v_payload   record;
begin
  select * into v_event from public.selection_events e where e.id = p_event_id;

  if v_event.id is null then
    return;
  end if;

  for v_recipient in
    select r from public.selection_event_manager_recipients(v_event) as r
    where r is distinct from p_person_id
  loop
    perform pg_advisory_xact_lock(
      hashtext('sel_evt_resp:' || v_recipient::text || ':' || p_type || ':' || p_event_id::text));

    if exists (
      select 1 from public.selection_event_response_sources s
      where s.recipient_profile_id = v_recipient and s.source_id = p_source_id
    ) then
      continue;
    end if;

    select s.window_start into v_window
    from public.selection_event_response_sources s
    where s.recipient_profile_id = v_recipient
      and s.notification_type = p_type
      and s.event_id = p_event_id
      and s.window_start <= p_occurred_at
      and p_occurred_at < s.window_start + public.selection_event_response_window()
    order by s.window_start desc
    limit 1;

    v_window := coalesce(v_window, p_occurred_at);
    v_key := p_type || ':' || p_event_id::text || ':'
             || to_char(v_window at time zone 'UTC', 'YYYYMMDD"T"HH24MISS.US');

    insert into public.selection_event_response_sources
      (recipient_profile_id, source_id, aggregate_key, notification_type,
       club_id, event_id, person_id, occurred_at, window_start)
    values
      (v_recipient, p_source_id, v_key, p_type,
       v_event.club_id, p_event_id, p_person_id, p_occurred_at, v_window)
    on conflict do nothing;

    select * into v_payload
    from public.selection_event_response_payload(v_recipient, v_key, p_type, v_event);

    if coalesce(v_payload.o_count, 0) = 0 then
      continue;
    end if;

    select * into v_notif
    from public.notifications n
    where n.recipient_profile_id = v_recipient and n.aggregate_key = v_key
    for update;

    if v_notif.id is null then
      /* Il trigger delle preferenze può scartare l'insert: il gruppo resta
         nei riferimenti, senza riga da mostrare. */
      insert into public.notifications
        (recipient_profile_id, type, title, body, data, aggregate_key, created_at)
      values
        (v_recipient, p_type, v_payload.o_title, v_payload.o_body, v_payload.o_data, v_key, p_occurred_at)
      on conflict do nothing;
    else
      update public.notifications n
      set title         = v_payload.o_title,
          body          = v_payload.o_body,
          data          = v_payload.o_data,
          revision      = n.revision + 1,
          is_read       = false,
          updated_at    = greatest(n.updated_at, p_occurred_at)
      where n.id = v_notif.id;
    end if;
  end loop;
end;
$$;

revoke all on function public.selection_event_record_response(uuid, text, uuid, uuid, timestamptz) from public;
revoke execute on function public.selection_event_record_response(uuid, text, uuid, uuid, timestamptz) from anon, authenticated;

/**
 * Produttore (§21, §27): lo storico partecipazioni è append-only e scritto
 * nella stessa transazione di ogni comando 29/30, quindi è l'evento di
 * dominio individuale. Tre transizioni, solo quando le esegue la persona:
 *
 *   INVITATION_ACCEPTED            → invito accettato
 *   INVITATION_DECLINED            → invito rifiutato
 *   WITHDRAWN da CONFIRMED         → ritiro di un confermato
 *
 * Il ritiro di una PENDING non notifica la Società (§21, QA-104). Nessun
 * comando della 29/30 viene riemesso.
 */
create or replace function public.selection_event_history_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  if new.actor_id is distinct from new.person_id then
    return null;
  end if;

  v_type := case
    when new.transition = 'INVITATION_ACCEPTED' then 'selection_event_invitation_accepted'
    when new.transition = 'INVITATION_DECLINED' then 'selection_event_invitation_declined'
    when new.transition = 'WITHDRAWN' and new.from_status = 'confirmed'
      then 'selection_event_participation_withdrawn'
  end;

  if v_type is not null then
    /* §28: l'accettazione, il rifiuto o il ritiro della persona non
       vengono annullati da un errore della notifica alla Società. */
    begin
      perform public.selection_event_record_response(
        new.id, v_type, new.event_id, new.person_id, new.created_at);
    exception when others then
      raise warning 'DAS-REV-31: risposta non aggregata per %: %', new.id, sqlerrm;
    end;
  end if;

  return null;
end;
$$;

revoke execute on function public.selection_event_history_notify() from anon, authenticated;

drop trigger if exists selection_event_history_notify on public.selection_event_participation_history;
create trigger selection_event_history_notify
  after insert on public.selection_event_participation_history
  for each row execute function public.selection_event_history_notify();

/**
 * §22, §25, QA-127: «Revoca reale del grant/scope/membership rimuove
 * l'eleggibilità.» Le righe di risposta portano nomi: un gestore che non è
 * più destinatario eleggibile di quell'evento non le legge più, né nel
 * Centro né nel badge (stessa tabella, stessa policy). Policy **restrittiva**:
 * si somma a quella del destinatario, non la sostituisce. Le altre righe
 * non cambiano. Se l'accesso torna, tornano anche le righe.
 */
create or replace function public.notification_still_visible(
  p_type text,
  p_data jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event public.selection_events;
begin
  if p_type not in ('selection_event_invitation_accepted',
                    'selection_event_invitation_declined',
                    'selection_event_participation_withdrawn') then
    return true;
  end if;

  if coalesce(p_data ->> 'event_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  select * into v_event
  from public.selection_events e
  where e.id = (p_data ->> 'event_id')::uuid;

  if v_event.id is null then
    return false;
  end if;

  return exists (
    select 1 from public.selection_event_manager_recipients(v_event) r
    where r = auth.uid());
end;
$$;

revoke all on function public.notification_still_visible(text, jsonb) from public;
revoke execute on function public.notification_still_visible(text, jsonb) from anon;
grant execute on function public.notification_still_visible(text, jsonb) to authenticated;

drop policy if exists "selection event responses follow current access" on public.notifications;
create policy "selection event responses follow current access"
  on public.notifications
  as restrictive
  for select to authenticated
  using (public.notification_still_visible(type, data));

/**
 * Da 20260719090200_notification_followers_and_actions.sql (unica
 * definizione) con il letto per revisione di §24 (QA-123 sul percorso
 * massivo): `p_as_of` è l'ultimo aggiornamento che il Centro ha mostrato;
 * un gruppo aggiornato dopo resta non letto. Senza parametro vale il
 * comportamento precedente. `read_revision` registra la revisione letta.
 */
drop function if exists public.mark_all_notifications_read();

create or replace function public.mark_all_notifications_read(
  p_as_of timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  update public.notifications n
  set is_read       = true,
      read_revision = n.revision
  where n.recipient_profile_id = v_uid
    and n.is_read = false
    and (p_as_of is null or n.updated_at <= p_as_of);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_all_notifications_read(timestamptz) from public, anon;
grant execute on function public.mark_all_notifications_read(timestamptz) to authenticated;


-- ============================================================
-- SEZIONE 9 — funzioni riemesse dalla definizione più recente
--
-- Copiate per intero; le sole righe nuove sono marcate «DAS-REV-31».
-- ============================================================

/* fetch_shortlist_entry: da 20261107090000 (definizione più recente); unica
   differenza la provenienza EVENT, marcata «DAS-REV-31». */
create or replace function public.fetch_shortlist_entry(
  p_entry_id       uuid default null,
  p_application_id uuid default null,
  p_with_note      boolean default true
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_entry      public.club_shortlist_entries%rowtype;
  v_list       public.club_shortlists%rowtype;
  v_ad         public.recruiting_ads%rowtype;
  v_app        public.recruiting_applications%rowtype;
  v_team       uuid;
  v_can_notes  boolean;
  v_can_apps   boolean;
  v_can_edit   boolean;
  v_can_remove boolean;
  v_person     public.profiles%rowtype;
  v_adder      text;
  v_position   text;
  v_scope      text;
  v_current    text;
  v_role_pos   text;
  v_src        jsonb; /* DAS-REV-31 */
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_entry_id is not null then
    select * into v_entry from public.club_shortlist_entries e0 where e0.id = p_entry_id;
  elsif p_application_id is not null then
    /* La catena parte dalla candidatura: Position della candidatura →
       contenitore POSITION di quella Position → membership della persona
       che si è candidata. Nessun riferimento arriva dal client. */
    select e0.* into v_entry
    from public.recruiting_applications a0
    join public.club_shortlists cs0
      on cs0.position_id = a0.ad_id and cs0.list_type = 'position'
    join public.club_shortlist_entries e0
      on e0.shortlist_id = cs0.id and e0.player_profile_id = a0.applicant_profile_id
    where a0.id = p_application_id;
  else
    raise exception 'SHORTLIST_ENTRY_NOT_FOUND';
  end if;

  if v_entry.id is null then
    raise exception 'SHORTLIST_ENTRY_NOT_FOUND';
  end if;

  select * into v_list from public.club_shortlists cs0 where cs0.id = v_entry.shortlist_id;

  if not found then
    raise exception 'SHORTLIST_ENTRY_NOT_FOUND';
  end if;

  v_team := public.shortlist_scope_team(v_list.id);

  if not public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_view')
     or not public.shortlist_list_access_ok(v_list.id) /* DAS-REV-27 §8 */ then
    /* §28: «Contenuto non disponibile … senza rivelare risorse altrui.»
       Negata e inesistente producono lo stesso errore. */
    raise exception 'SHORTLIST_ENTRY_NOT_FOUND';
  end if;

  v_can_notes  := public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_add_notes');
  v_can_apps   := public.society_position_in_scope(v_list.club_id, v_team, 'applications_view');
  v_can_edit   := public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_edit_status');
  v_can_remove := public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_remove_profiles');

  if v_list.list_type = 'position' then
    select * into v_ad from public.recruiting_ads where id = v_list.position_id;

    v_position := coalesce(
      nullif(btrim(v_ad.custom_role_name), ''),
      (select pr.label from public.position_roles pr where pr.id = v_ad.structured_role_id),
      nullif(btrim(v_ad.title), ''),
      'Posizione'
    );
    v_scope := case
      when v_ad.position_scope_type = 'society' then 'Intera società'
      when v_ad.status = 'closed' then coalesce(
        v_ad.published_team_name,
        (select ct.name from public.club_teams ct where ct.id = v_ad.team_id)
      )
      else (select ct.name from public.club_teams ct where ct.id = v_ad.team_id)
    end;
  else
    v_position := v_list.name;
    v_scope := case
      when v_list.team_id is not null then
        (select ct.name from public.club_teams ct where ct.id = v_list.team_id)
      else 'Intera società'
    end;
  end if;

  select * into v_person from public.profiles where id = v_entry.player_profile_id;

  select pp.primary_position::text into v_role_pos
  from public.player_profiles pp where pp.profile_id = v_entry.player_profile_id;

  v_current := public.profile_current_situation(v_entry.player_profile_id);

  select pr2.full_name into v_adder
  from public.profiles pr2 where pr2.id = v_entry.added_by_profile_id;

  if v_entry.application_id is not null then
    select * into v_app from public.recruiting_applications where id = v_entry.application_id;
  end if;

  /* DAS-REV-31 §12: lo snapshot appartiene alla entry e si legge con lei;
     il link all'evento esiste solo se oggi l'actor può aprirne il dettaglio.
     Nessun dato live dell'evento entra nel payload. */
  if v_entry.created_source = 'event' and v_entry.source_event_title_snapshot is not null then
    v_src := jsonb_build_object(
      'title',    v_entry.source_event_title_snapshot,
      'date',     v_entry.source_event_date_snapshot,
      'timezone', v_entry.source_event_timezone,
      'event_id', (select e.id from public.selection_events e
                    where e.id = v_entry.source_event_id
                      and e.club_id = v_list.club_id
                      and e.status <> 'draft'
                      and public.selection_event_can_operate(e.club_id, e.team_id, 'view')));
  end if;

  return jsonb_build_object(
    'entry_id',     v_entry.id,
    'shortlist_id', v_list.id,
    'club_id',      v_list.club_id,
    'position_id',  v_list.position_id,
    'person_id',    v_entry.player_profile_id,
    'name',         coalesce(v_person.full_name, 'Profilo'),
    'avatar_url',   v_person.avatar_url,
    'role',         v_person.role::text,
    'primary_position', v_role_pos,
    'situation',    v_current,
    'position_title', v_position,
    'scope_label',  v_scope,
    'is_closed',    v_list.list_type = 'position' and v_ad.status = 'closed',
    'is_draft',     v_list.list_type = 'position' and v_ad.status = 'draft',
    'priority',     v_entry.priority,
    'evaluation_status', v_entry.evaluation_status,
    'revision',     v_entry.revision,
    /* §15: il testo integrale **solo** a chi lo può leggere, e solo quando
       la superficie lo richiede (§11 per lo sheet). `note_available` dice
       al client se l'assenza è un permesso o una nota vuota: §12 vieta di
       usare «Nessuna nota aggiunta.» per una nota nascosta dai permessi. */
    'note',           case when v_can_notes and p_with_note then v_entry.internal_note end,
    'note_available', v_can_notes,
    'created_source', case
      when v_entry.created_source = 'application' and not v_can_apps then 'unknown'
      else v_entry.created_source
    end,
    'added_by_name', v_adder,
    'source_event',  v_src, /* DAS-REV-31 */
    'created_at',    v_entry.created_at,
    'application_id', case when v_can_apps then v_entry.application_id end,
    'application_state', case
      when not v_can_apps then null
      when v_entry.application_id is null then 'none'
      when v_app.status = 'withdrawn' then 'withdrawn'
      else 'active'
    end,
    'can_edit_status', v_can_edit,
    'can_edit_note',   v_can_notes,
    'can_view_notes',  v_can_notes,
    'can_remove',      v_can_remove,
    'can_view_applications', v_can_apps,
    'access_verified_at', timezone('utc', now())
  );
end;
$$;


/* add_profile_to_shortlist: da 20261107090000 (definizione più recente); la
   firma cresce di `p_source_event_id`, quindi la vecchia va eliminata. */
drop function if exists public.add_profile_to_shortlist(uuid, uuid, uuid, uuid, text);

create or replace function public.add_profile_to_shortlist(
  p_club_id         uuid,
  p_person_id       uuid,
  p_position_id     uuid default null,
  p_shortlist_id    uuid default null,
  p_idempotency_key text default null,
  p_source_event_id uuid default null  /* DAS-REV-31 §11 */
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_kind        text;
  v_list        uuid;
  v_type        text;
  v_position    uuid;
  v_fingerprint text;
  v_receipt     jsonb;
  v_log         public.club_shortlist_membership_log%rowtype;
  v_entry       public.club_shortlist_entries%rowtype;
  v_entry_id    uuid;
  v_already     boolean;
  v_result      jsonb;
  v_source      uuid; /* DAS-REV-31 */
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if (p_position_id is null) = (p_shortlist_id is null) then
    /* Una sola destinazione per comando: §11 — «il tap avvia
       immediatamente un solo add». */
    raise exception 'SHORTLIST_VALUE_INVALID';
  end if;

  v_fingerprint := md5(
    'shortlist_profile_add|v1|' || p_club_id::text || '|' || p_person_id::text || '|'
    || coalesce('p:' || p_position_id::text, 'c:' || p_shortlist_id::text)
    /* DAS-REV-31: senza sorgente l'impronta resta quella della 26, così le
       ricevute già emesse continuano a riconoscere il proprio retry. */
    || coalesce('|e:' || p_source_event_id::text, '')
  );

  v_receipt := public.application_operation_replay(
    p_idempotency_key, p_person_id, 'shortlist_profile_add', v_fingerprint
  );

  if v_receipt is not null then
    /* DAS-REV-27 §22: «Receipt e risultati non devono rivelare dati ad actor
       che hanno perso l’accesso.» Lista eliminata o revocata: nessun replay. */
    if not public.shortlist_in_scope((v_receipt ->> 'shortlist_id')::uuid, 'shortlist_view') then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    /* §25: «Distingui ricevuta storica del comando e proiezione corrente.»
       La ricevuta dice quale generazione aveva creato o trovato; se quella
       generazione è chiusa, la persona è stata rimossa dopo e il retry non
       la riporta indietro. */
    select * into v_log
    from public.club_shortlist_membership_log l
    where l.shortlist_id = (v_receipt ->> 'shortlist_id')::uuid
      and l.person_profile_id = p_person_id;

    select * into v_entry
    from public.club_shortlist_entries e0
    where e0.id = (v_receipt ->> 'entry_id')::uuid;

    return v_receipt || jsonb_build_object(
      'replayed',      true,
      'removed_since', v_entry.id is null
                       or not coalesce(v_log.is_active, false)
                       or v_log.generation is distinct from (v_receipt ->> 'generation')::integer,
      'revision',      v_entry.revision,
      'in_any_list',   public.shortlist_person_in_any_list(p_club_id, p_person_id)
    );
  end if;

  /* §13.2: accesso al profilo e contesto professionale, dal server. */
  v_kind := public.shortlist_person_kind(p_person_id);

  if v_kind is null or p_person_id = v_uid then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  if p_position_id is not null then
    /* §13.3-4: stessa Society, capability, scope, lifecycle, compatibilità.
       Il lock condiviso serializza l'add con una modifica concorrente del
       lifecycle o del perimetro della Position: §27 — «PUBLISHED→CLOSED
       … l'add può proseguire», ma una cancellazione o uno spostamento di
       scope si decidono qui, non sulla schermata. */
    perform 1 from public.recruiting_ads ad where ad.id = p_position_id for share;

    if not public.shortlist_position_destination_ok(p_club_id, p_position_id, v_kind) then
      /* §27: «Questa lista non è più disponibile» — senza rivelare se
         appartiene a un'altra Society o è stata resa riservata. */
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    /* §13.5: contenitore canonico unico, anche sotto concorrenza (24). */
    v_list     := public.get_or_create_position_shortlist(p_position_id);
    v_type     := 'position';
    v_position := p_position_id;
  else
    perform 1 from public.club_shortlists cs0 where cs0.id = p_shortlist_id for share;

    if not public.shortlist_custom_destination_ok(p_club_id, p_shortlist_id) then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    v_list     := p_shortlist_id;
    v_type     := 'custom';
    v_position := null;
  end if;

  /* DAS-REV-31 §9, §11: un add già soddisfatto restituisce la entry com'è,
     senza giudicare la sorgente — che non verrebbe comunque scritta. La
     sorgente si verifica solo quando nascerebbe una entry nuova: non valida
     ⇒ errore controllato, mai ricaduta su PROFILE. */
  v_source := p_source_event_id;

  if v_source is not null and exists (
    select 1 from public.club_shortlist_entries e0
    where e0.shortlist_id = v_list and e0.player_profile_id = p_person_id
  ) then
    v_source := null;
  elsif v_source is not null
     and not public.shortlist_event_source_ok(p_club_id, v_source, p_person_id) then
    raise exception 'SHORTLIST_EVENT_SOURCE_UNAVAILABLE';
  end if;

  select r.entry_ref, r.already into v_entry_id, v_already
  from public.shortlist_insert_entry_sourced(v_list, p_person_id, v_source) r;

  /* Rilettura dopo l'insert: `link_shortlist_entry_application` (24) può
     aver già collegato una candidatura pertinente nello stesso statement,
     origine PROFILE invariata (§13.8). */
  select * into v_entry from public.club_shortlist_entries e0 where e0.id = v_entry_id;

  select * into v_log
  from public.club_shortlist_membership_log l
  where l.shortlist_id = v_list and l.person_profile_id = p_person_id;

  v_result := jsonb_build_object(
    'entry_id',     v_entry.id,
    'shortlist_id', v_list,
    'position_id',  v_position,
    'list_type',    v_type,
    'person_id',    p_person_id,
    'club_id',      p_club_id,
    'already',      v_already,
    'created_source', v_entry.created_source, /* DAS-REV-31 */
    'generation',   coalesce(v_log.generation, 1),
    'created_at',   v_entry.created_at
  );

  perform public.application_operation_record(
    p_idempotency_key, p_person_id, 'shortlist_profile_add', v_fingerprint, v_result
  );

  return v_result || jsonb_build_object(
    'replayed',      false,
    'removed_since', false,
    'revision',      v_entry.revision,
    'in_any_list',   true
  );
end;
$$;

revoke all on function public.add_profile_to_shortlist(uuid, uuid, uuid, uuid, text, uuid) from public;
revoke execute on function public.add_profile_to_shortlist(uuid, uuid, uuid, uuid, text, uuid) from anon;
grant execute on function public.add_profile_to_shortlist(uuid, uuid, uuid, uuid, text, uuid) to authenticated;


/* create_custom_shortlist: da 20261107090000 (definizione più recente); la
   firma cresce di `p_source_event_id` in coda, con default. */
drop function if exists public.create_custom_shortlist(uuid, text, text, uuid, uuid, text, text, uuid[]);

create or replace function public.create_custom_shortlist(
  p_club_id         uuid,
  p_name            text,
  p_description     text    default null,
  p_team_id         uuid    default null,
  p_person_id       uuid    default null,
  p_idempotency_key text    default null,
  p_access_mode     text    default 'owner_only',
  p_share_ids       uuid[]  default null,
  p_source_event_id uuid    default null  /* DAS-REV-31 §9 */
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_name        text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_mode        text := coalesce(p_access_mode, 'owner_only');
  v_shares      uuid[];
  v_ineligible  uuid[];
  v_fingerprint text;
  v_receipt     jsonb;
  v_list        public.club_shortlists%rowtype;
  v_entry       public.club_shortlist_entries%rowtype;
  v_entry_id    uuid;
  v_already     boolean;
  v_log         public.club_shortlist_membership_log%rowtype;
  v_result      jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_mode not in ('owner_only', 'shared') then
    raise exception 'SHORTLIST_VALUE_INVALID';
  end if;

  /* §11: il set è di utenti, deduplicato; l'actor sarà owner, non
     condivisione (Q27-24). */
  select coalesce(array_agg(distinct s order by s), array[]::uuid[])
    into v_shares
  from unnest(coalesce(p_share_ids, array[]::uuid[])) as s
  where s is not null and s <> v_uid;

  if v_mode = 'owner_only' then
    v_shares := array[]::uuid[];
  end if;

  v_fingerprint := md5(
    'shortlist_create|v2|' || p_club_id::text || '|'
    || coalesce(p_person_id::text, '-') || '|'
    || coalesce(p_team_id::text, 'society') || '|'
    || v_name || '|' || coalesce(v_description, '') || '|'
    || v_mode || '|' || array_to_string(v_shares, ',')
    || coalesce('|e:' || p_source_event_id::text, '') /* DAS-REV-31 */
  );

  v_receipt := public.application_operation_replay(
    p_idempotency_key, p_club_id, 'shortlist_create', v_fingerprint
  );

  if v_receipt is not null then
    /* §12: «Se nel frattempo la lista è stata eliminata o l'accesso
       revocato, non ricrearla e non reinserire la membership.» */
    if not public.shortlist_in_scope((v_receipt ->> 'shortlist_id')::uuid, 'shortlist_view') then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    select * into v_entry
    from public.club_shortlist_entries e0
    where e0.id = (v_receipt ->> 'entry_id')::uuid;

    return v_receipt || jsonb_build_object(
      'replayed',     true,
      'entry_active', v_entry.id is not null,
      'access_mode',  (select cs.access_mode from public.club_shortlists cs
                        where cs.id = (v_receipt ->> 'shortlist_id')::uuid)
    );
  end if;

  if char_length(v_name) = 0 then
    raise exception 'SHORTLIST_LIST_NAME_REQUIRED';
  end if;

  if char_length(v_name) > public.shortlist_list_name_max_length() then
    raise exception 'SHORTLIST_LIST_NAME_TOO_LONG';
  end if;

  if v_description is not null
     and char_length(v_description) > public.shortlist_list_description_max_length() then
    raise exception 'SHORTLIST_LIST_DESCRIPTION_TOO_LONG';
  end if;

  if p_team_id is not null and not exists (
    select 1 from public.club_teams ct
    where ct.id = p_team_id
      and ct.club_id = p_club_id
      and not coalesce(ct.is_archived, false)
  ) then
    raise exception 'SHORTLIST_SCOPE_INVALID';
  end if;

  if not public.society_position_in_scope(p_club_id, p_team_id, 'shortlist_create_lists') then
    raise exception 'SHORTLIST_SCOPE_INVALID';
  end if;

  /* §11: «SHARED scelto esplicitamente con zero persone è invalido … Non
     convertire silenziosamente la scelta dell'utente» (Q27-07). */
  if v_mode = 'shared' and coalesce(array_length(v_shares, 1), 0) = 0 then
    raise exception 'SHORTLIST_SHARE_EMPTY';
  end if;

  /* §11: ogni destinatario rivalidato al commit; nessun sottoinsieme
     salvato come se fosse la selezione confermata (Q27-09). */
  select array_agg(s) into v_ineligible
  from unnest(v_shares) as s
  where not public.shortlist_person_eligible(p_club_id, p_team_id, s);

  if v_ineligible is not null then
    raise exception 'SHORTLIST_SHARE_INELIGIBLE';
  end if;

  if p_person_id is not null then
    if public.shortlist_person_kind(p_person_id) is null or p_person_id = v_uid then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    if not public.society_position_in_scope(p_club_id, p_team_id, 'shortlist_add_profiles')
       or not public.society_position_in_scope(p_club_id, p_team_id, 'shortlist_view') then
      raise exception 'SHORTLIST_SCOPE_INVALID';
    end if;

    /* DAS-REV-31 §9, §11: sorgente verificata prima di creare qualunque
       cosa — una sorgente non più valida non lascia una lista orfana. */
    if p_source_event_id is not null
       and not public.shortlist_event_source_ok(p_club_id, p_source_event_id, p_person_id) then
      raise exception 'SHORTLIST_EVENT_SOURCE_UNAVAILABLE';
    end if;
  elsif p_source_event_id is not null then
    /* Una provenienza senza persona non ha significato. */
    raise exception 'SHORTLIST_VALUE_INVALID';
  end if;

  insert into public.club_shortlists
    (club_id, name, description, scope, list_type, team_id, created_by_profile_id)
  values
    (p_club_id, v_name, v_description, 'tutta_la_societa', 'custom', p_team_id, v_uid)
  returning club_shortlists.* into v_list;

  if v_mode = 'shared' then
    perform public.shortlist_governance_begin();

    insert into public.club_shortlist_shares (shortlist_id, profile_id, created_by_profile_id)
    select v_list.id, s, v_uid from unnest(v_shares) as s
    on conflict do nothing;

    update public.club_shortlists cs set access_mode = 'shared'
    where cs.id = v_list.id
    returning cs.* into v_list;
  end if;

  if p_person_id is not null then
    select r.entry_ref, r.already into v_entry_id, v_already
    from public.shortlist_insert_entry_sourced(v_list.id, p_person_id, p_source_event_id) r; /* DAS-REV-31 */

    select * into v_entry from public.club_shortlist_entries e0 where e0.id = v_entry_id;

    select * into v_log
    from public.club_shortlist_membership_log l
    where l.shortlist_id = v_list.id and l.person_profile_id = p_person_id;
  end if;

  perform public.shortlist_governance_audit(
    v_list.id, 'created', v_list.version,
    jsonb_build_object('access', v_list.access_mode,
                       'shares', coalesce(array_length(v_shares, 1), 0),
                       'with_person', p_person_id is not null)
  );

  v_result := jsonb_build_object(
    'status',       case when p_person_id is null then 'created' else 'completed' end,
    'shortlist_id', v_list.id,
    'club_id',      p_club_id,
    'name',         v_list.name,
    'scope_label',  public.shortlist_scope_label(v_list.id, null),
    'access_mode',  v_list.access_mode,
    'shared_count', coalesce(array_length(v_shares, 1), 0),
    'person_id',    p_person_id,
    'entry_id',     v_entry.id,
    'generation',   v_log.generation
  );

  perform public.application_operation_record(
    p_idempotency_key, p_club_id, 'shortlist_create', v_fingerprint, v_result
  );

  return v_result || jsonb_build_object(
    'replayed',     false,
    'entry_active', v_entry.id is not null
  );
end;
$$;

revoke all on function public.create_custom_shortlist(uuid, text, text, uuid, uuid, text, text, uuid[], uuid) from public;
revoke execute on function public.create_custom_shortlist(uuid, text, text, uuid, uuid, text, text, uuid[], uuid) from anon;
grant execute on function public.create_custom_shortlist(uuid, text, text, uuid, uuid, text, text, uuid[], uuid) to authenticated;


/* update_selection_event: da 20261109090000 (definizione più recente); due
   aggiunte marcate «DAS-REV-31»: guard di inizio e notifica di modifica. */
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

  /* DAS-REV-31 §15, §20, QA-069: dopo l'inizio niente edit, e il confronto
     usa lo starts_at **corrente**, prima della patch: spostare nel futuro un
     evento già iniziato non lo riapre. La scadenza di completamento è
     sempre ≥ inizio, quindi questo guard copre anche un evento già dovuto
     che il worker non ha ancora concluso. */
  if v_old.starts_at is not null and now() >= v_old.starts_at then
    raise exception 'SELECTION_EVENT_STARTED';
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

    /* DAS-REV-31 §20: una notifica per destinatario attivo solo se è
       cambiato un campo importante; stessa transazione del salvataggio. */
    begin
      perform public.notify_selection_event_updated(v_old, v_new);
    exception when others then
      /* §28: un errore notifica non annulla il salvataggio. */
      raise warning 'DAS-REV-31: notifiche di modifica non prodotte per %: %', v_new.id, sqlerrm;
    end;
  end if;

  perform public.selection_event_operation_record(
    p_idempotency_key, v_new.club_id, v_new.id, 'update', v_finger,
    jsonb_build_object('event_id', v_new.id, 'version', v_new.version));

  return query select v_new.id, v_new.version, v_new.status, false;
end;
$$;


/* selection_event_personal_state: da 20261110090000; aggiunte marcate «DAS-REV-31». */
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
  /* DAS-REV-30 */
  v_operational boolean;
  v_accept   boolean := false;
  v_decline  boolean := false;
  v_accept_blocked text;
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

  v_operational := p_event.status = 'published'
    and p_event.starts_at is not null
    and p_now < p_event.starts_at;

  if v_part.id is null then
    v_register := v_can_new;
  elsif v_part.status in ('pending', 'confirmed') then
    /* §19: ritiro fino all'inizio, anche dopo il termine delle iscrizioni. */
    v_withdraw := v_operational;
  elsif v_part.status = 'withdrawn' and v_part.withdrawn_by_kind = 'person' then
    v_again := v_can_new;
  /* DAS-REV-30 §18, §19 */
  elsif v_part.status = 'invited' then
    /* §11: il rifiuto resta disponibile finché l'evento è operativo, anche
       a capienza piena o dopo un blocco sopravvenuto. */
    v_decline := v_operational;
    /* L'invito segue la regola degli inviti, non quella dell'iscrizione. */
    if v_operational and public.selection_event_invitee_ineligibility(p_event, p_uid) is null then
      if coalesce((v_avail ->> 'is_full')::boolean, false) then
        v_accept_blocked := 'full';
      else
        v_accept := true;
      end if;
    end if;
  elsif v_part.status in ('declined', 'revoked') then
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
      'version',        v_part.version,
      /* DAS-REV-30 */
      'confirmation_source', v_part.confirmation_source,
      'invitation_generation', v_part.invitation_generation,
      'invited_at',     case when v_part.status = 'invited' then v_part.invited_at end,
      'invitation_message', case when v_part.status = 'invited' then v_part.invitation_message end,
      'declined_at',    v_part.declined_at,
      'revoked_at',     v_part.revoked_at,
      'removed_at',     v_part.removed_at,
      'removal_message', case when v_part.status = 'removed' then v_part.removal_message end) end,
    'capabilities', jsonb_build_object(
      'register',       v_register,
      'withdraw',       v_withdraw,
      'register_again', v_again,
      /* DAS-REV-30 */
      'accept',         v_accept,
      'decline',        v_decline,
      'accept_blocked_reason', v_accept_blocked),
    'ineligible_reason', v_reason,
    'birth_year',        v_year,
    'birth_year_mismatch', v_mismatch,
    /* DAS-REV-31 §19: lo stato dell'evento prevale; il messaggio della
       Società solo a chi era attivo quando è stato annullato. */
    'event_status',        p_event.status,
    'cancellation_message', case
      when p_event.status = 'cancelled'
       and v_part.status in ('confirmed', 'pending', 'invited')
      then p_event.cancellation_message end
  );
end;
$$;


/* fetch_selection_event_detail: da 20261110090000; aggiunte marcate «DAS-REV-31». */
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
  /* DAS-REV-30 */
  v_read      boolean;
  v_manage    boolean;
  v_invite    boolean;
  v_operational boolean;
  v_full      boolean;
  /* DAS-REV-31 */
  v_started   boolean;
  v_due       boolean;
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

  /* DAS-REV-31 §13: condizioni derivate accanto al lifecycle persistente. */
  v_started := v_event.starts_at is not null and v_now >= v_event.starts_at;
  v_due := v_event.status = 'published'
    and v_event.completion_due_at is not null
    and v_now >= v_event.completion_due_at;

  v_result := v_result || jsonb_build_object('lifecycle', jsonb_build_object(
    'status',            v_event.status,
    'is_started',        v_started,
    'completion_due_at', v_event.completion_due_at,
    'completed_at',      v_event.completed_at,
    'cancelled_at',      v_event.cancelled_at));

  /* Il payload pubblico omette il count senza limite; il dettaglio della
     Società lo mostra comunque come numero di confermati. */
  if v_society then
    select c.confirmed_count, c.pending_requests_count into v_counts
    from public.selection_event_participation_counts(v_event.id) c;

    /* DAS-REV-30 §8, §11, §12 */
    v_read   := public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'participants');
    v_manage := public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'manage');
    v_invite := public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'invite');
    v_operational := v_event.status = 'published'
      and v_event.starts_at is not null
      and v_now < v_event.starts_at;
    v_full := v_event.max_participants is not null
      and coalesce(v_counts.confirmed_count, 0) >= v_event.max_participants;

    v_result := v_result || jsonb_build_object(
      'management', jsonb_build_object(
        'confirmed_count',        v_counts.confirmed_count,
        'pending_requests_count', case when v_event.status = 'published' and v_read
                                       then v_counts.pending_requests_count end,
        'can_edit',   v_event.status = 'published' and v_manage and not v_started, /* DAS-REV-31 */
        'can_decide', v_event.status = 'published' and v_manage and not v_started, /* DAS-REV-31 */
        /* §9: condivisione solo se l'evento ha una landing. Lo storico
           pubblico si condivide con wording neutro (QA-039). */
        'can_share',  v_public,
        /* DAS-REV-30 */
        'participants', case when v_read then jsonb_build_object(
                          'confirmed_count', v_counts.confirmed_count,
                          'pending_count',   v_counts.pending_requests_count,
                          'invited_count',   public.selection_event_invited_count(v_event.id))
                        end,
        'can_read_participants',   v_read,
        'can_manage_participants', v_manage and v_operational,
        'can_invite',              v_invite and v_operational and not v_full,
        'invite_blocked_reason',   case when v_invite and v_operational and v_full then 'full' end));

    /* DAS-REV-31 §15, §17, §18: azioni del lifecycle risolte dal server. */
    v_result := jsonb_set(v_result, '{management}', (v_result -> 'management') || jsonb_build_object(
      'can_complete',     v_manage and v_event.status = 'published' and v_started,
      'can_cancel',       v_manage and v_event.status = 'published' and not v_due,
      'can_delete_draft', v_event.status = 'draft'
                          and public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'edit'),
      'cancellation_message', case when v_event.status = 'cancelled' then v_event.cancellation_message end,
      'final_confirmed_count', v_event.final_confirmed_count));
  else
    v_result := v_result || jsonb_build_object('management', null);
  end if;

  v_result := v_result || jsonb_build_object(
    'personal', public.selection_event_personal_state(v_event, v_uid, v_now));

  return v_result;
end;
$$;


/* notifications_before_insert: da 20261110090000 con i cinque tipi della 31. */
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
    when 'selection_event_invitation_received'      then 'candidature'
    when 'selection_event_invitation_revoked'       then 'candidature'
    when 'selection_event_participation_removed'    then 'candidature'
    /* DAS-REV-31 */
    when 'selection_event_cancelled'               then 'candidature'
    when 'selection_event_updated'                 then 'candidature'
    when 'selection_event_invitation_accepted'     then 'candidature'
    when 'selection_event_invitation_declined'     then 'candidature'
    when 'selection_event_participation_withdrawn' then 'candidature'
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
    when 'selection_event_invitation_received'      then 'applications'
    when 'selection_event_invitation_revoked'       then 'applications'
    when 'selection_event_participation_removed'    then 'applications'
    /* DAS-REV-31 */
    when 'selection_event_cancelled'               then 'applications'
    when 'selection_event_updated'                 then 'applications'
    when 'selection_event_invitation_accepted'     then 'applications'
    when 'selection_event_invitation_declined'     then 'applications'
    when 'selection_event_participation_withdrawn' then 'applications'
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
