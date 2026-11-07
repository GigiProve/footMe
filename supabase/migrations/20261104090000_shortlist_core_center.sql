-- Migration: DAS-REV-24 — Shortlist core unificato e centro della Dashboard
-- Società.
--
-- Il problema che questa migrazione risolve è un **secondo core**. Dal
-- 20260717090100 esistono `club_shortlists` / `club_shortlist_entries`: le
-- liste manuali di scouting, con priorità, stato di valutazione e note.
-- DAS-REV-22 (20261102090000) ha poi aggiunto `position_shortlist_entries`,
-- una seconda tabella per «la shortlist della Position», motivandola così:
-- «le due non vanno fuse: una entry di lista sopravvive alla Position,
-- questa no».
--
-- DAS-REV-24 §26 rovescia quella decisione, ed è il motivo di questo file:
-- «La dicitura concettuale PositionShortlistEntry nei contratti candidature
-- non autorizza a mantenere un secondo ecosistema: preserva gli ID o
-- fornisci una mappatura compatibile e documentata per i riferimenti
-- esistenti.» §37.1 lo mette fra i criteri di completamento: «Il sistema
-- Shortlist esistente è evoluto senza creare core paralleli.»
--
-- Quindi: `club_shortlists` acquista un `list_type` e un `position_id`, le
-- entry di Position diventano `club_shortlist_entries` con lo **stesso id**
-- che avevano, e `position_shortlist_entries` resta come **vista** di
-- compatibilità per i consumatori già scritti (§26: «Non fare fallire un
-- lettore precedente»).
--
-- Le altre tre cose che cambiano nel modello:
--
--   · `priority` diventa **nullable** (§17: «Rendi nullable la priorità se
--     lo schema precedente la richiedeva»). Il default 'media' violava §17 —
--     «non forzare Media alle nuove entry» — e QA028;
--   · lo scope delle CUSTOM acquista un `team_id` reale, perché lo screen 06
--     chiede che un amministratore con ambito Primavera veda **solo** le
--     liste del suo perimetro, e i cinque token testuali di `scope` non sono
--     squadre (QA079, QA081);
--   · `last_activity_at` sul contenitore, perché §24 chiede un ordinamento
--     per attività reale e vieta che «un GET, uno scroll, un retry senza
--     effetti o la sola riconciliazione tecnica» la producano (QA018).
--
-- Riusa senza riscriverli: `society_position_in_scope` (20261026090000),
-- `dashboard_club_capabilities` (20261101090000), `has_club_permission` e
-- `club_access_is_active` (20261025090000), `application_operations` e le
-- sue due funzioni di ricevuta (20261103090000), `set_updated_at`.
--
-- Nessun insert in `public.notifications` in tutto il file: §29 — «Non
-- inviare notifiche o messaggi alla persona per creazione del contenitore,
-- aggiunta, collegamento Application, modifica valutazione, nota, priorità,
-- rimozione, apertura del centro o riordino.»


-- ============================================================
-- SEZIONE 1 — il contenitore diventa tipizzato (§16)
--
-- «type, equivalente a CUSTOM o POSITION; position_id quando pertinente.»
-- Il default 'custom' è ciò che rende la migrazione non distruttiva: ogni
-- riga preesistente di `club_shortlists` è, per costruzione, una lista
-- manuale — l'unico scrittore era `createShortlist` dal form. §26 lo chiede
-- esplicitamente e QA126 lo verifica: «Una lista manuale con nome uguale a
-- una Position resta CUSTOM».
-- ============================================================

alter table public.club_shortlists
  add column if not exists list_type text not null default 'custom';

alter table public.club_shortlists
  drop constraint if exists club_shortlists_list_type_check;

alter table public.club_shortlists
  add constraint club_shortlists_list_type_check
  check (list_type in ('custom', 'position'));

alter table public.club_shortlists
  add column if not exists position_id uuid
    references public.recruiting_ads(id) on delete cascade;

/* §16: «Per CUSTOM, position_id è nullo … Per POSITION, position_id è
   obbligatorio». Un solo CHECK per entrambe le direzioni: un contenitore
   POSITION senza Position e una CUSTOM che ne porta una sono lo stesso
   errore di modello. */
alter table public.club_shortlists
  drop constraint if exists club_shortlists_position_type_check;

alter table public.club_shortlists
  add constraint club_shortlists_position_type_check
  check ((list_type = 'position') = (position_id is not null));

/* §16: «Garantisci al massimo una shortlist POSITION per position_id con un
   vincolo backend/database, non soltanto con un controllo client.»
   (DoD 5, QA022, QA058.) Parziale, perché le CUSTOM hanno position_id nullo
   e `null` non entra in un unique totale in modo utile. */
create unique index if not exists club_shortlists_position_uk
  on public.club_shortlists (position_id)
  where position_id is not null;

/**
 * Perimetro reale di una lista CUSTOM.
 *
 * §22: «Per CUSTOM usa lo scope esistente della lista e il catalogo
 * condiviso.» Il catalogo condiviso è `club_permission_areas.scope_kind`, e
 * il perimetro che ne discende è un insieme di **squadre** — non uno dei
 * cinque token di `club_shortlists.scope`, che sono etichette del 2026-07 e
 * non identificano nessuna riga di `club_teams`.
 *
 * `null` = lista dell'intera Società. Una lista preesistente resta a `null`
 * e quindi Society-wide: è la lettura conservativa, l'unica che non rischia
 * di mostrare a un amministratore di squadra una lista che non gli
 * appartiene (§22: «Non restituire nomi, count, scope … di liste fuori
 * perimetro»). L'etichetta leggibile delle righe storiche continua a venire
 * da `scope`, che non viene toccato (§26, QA125).
 */
alter table public.club_shortlists
  add column if not exists team_id uuid
    references public.club_teams(id) on delete set null;

alter table public.club_shortlists
  drop constraint if exists club_shortlists_custom_team_check;

/* Una POSITION non porta un team proprio: il suo perimetro è quello della
   Position, che può cambiare con lo storico di quella. Duplicarlo qui
   creerebbe la «seconda fonte editabile di nome, ambito o Society» che §16
   vieta. */
alter table public.club_shortlists
  add constraint club_shortlists_custom_team_check
  check (list_type = 'custom' or team_id is null);

/**
 * Attività reale del contenitore (§24).
 *
 * «Definisci quale timestamp conta, per esempio ultima modifica reale di
 * entry o lista.» Qui conta: ingresso o uscita di una membership, e modifica
 * di valutazione, priorità o nota. Non contano: letture, riconciliazioni
 * tecniche, retry idempotenti — vedi il trigger della sezione 7.
 *
 * Esiste come colonna e non come `max(updated_at)` calcolato perché §24
 * chiede uno spareggio stabile e una paginazione per cursore: un aggregato
 * ricalcolato a ogni pagina non è un ordine, è un suggerimento.
 */
alter table public.club_shortlists
  add column if not exists last_activity_at timestamptz;

update public.club_shortlists cs
set last_activity_at = greatest(
  cs.updated_at,
  coalesce(
    (select max(e.updated_at)
       from public.club_shortlist_entries e
      where e.shortlist_id = cs.id),
    cs.updated_at
  )
)
where cs.last_activity_at is null;

alter table public.club_shortlists
  alter column last_activity_at set default timezone('utc', now());

alter table public.club_shortlists
  alter column last_activity_at set not null;

create index if not exists club_shortlists_center_idx
  on public.club_shortlists (club_id, list_type, last_activity_at desc, id);

comment on column public.club_shortlists.list_type is
  'DAS-REV-24 §16: CUSTOM (lista manuale) o POSITION (shortlist della '
  'singola Position). Un solo core per entrambe.';

comment on column public.club_shortlists.team_id is
  'DAS-REV-24 §22: perimetro reale di una lista CUSTOM; null = intera '
  'Società. Le righe anteriori alla 24 restano null e sono trattate come '
  'Society-wide. La colonna `scope` resta per i lettori precedenti e per '
  'l''etichetta storica, e non viene riscritta (§26).';


-- ============================================================
-- SEZIONE 2 — la entry acquista candidatura, origine e revisione (§17)
--
-- «id e shortlist_id stabili; person_id canonico; application_id
-- facoltativo; priority facoltativa; evaluation_status; internal_note
-- facoltativa; added_by; created_at e updated_at; eventuale origine di
-- creazione e revisione.»
--
-- `player_profile_id` resta il nome della colonna: è il `person_id` di §16,
-- e rinominarlo romperebbe ogni consumatore per un guadagno nominale. La
-- mappatura è documentata qui e nel modulo client.
-- ============================================================

/* §17, QA028: «La priorità nulla è accettata per nuove entry; non viene
   trasformata automaticamente in Media.» Il default 'media' del 2026-07
   faceva esattamente questo. I valori esistenti non vengono toccati —
   §17: «Conserva integralmente i valori esistenti». */
alter table public.club_shortlist_entries
  alter column priority drop default;

alter table public.club_shortlist_entries
  alter column priority drop not null;

/* §17: «Il riferimento Application, quando presente, deve identificare la
   stessa persona, la stessa Society destinataria e la stessa Position della
   shortlist POSITION.» Il vincolo non è esprimibile in un CHECK (richiede
   due join): lo impone il trigger della sezione 6. `on delete set null`
   perché §17 e §21 vogliono che la entry sopravviva alla candidatura. */
alter table public.club_shortlist_entries
  add column if not exists application_id uuid
    references public.recruiting_applications(id) on delete set null;

/**
 * Origine storica della entry (§19).
 *
 * «Mantieni distinta l'origine di creazione, ad esempio PROFILE/APPLICATION,
 * dalla relazione Application corrente. Non cambiare l'origine storica per
 * far sembrare che l'entry sia nata in seguito.»
 *
 * `unknown` non è un ripiego: §26 lo richiede — «Non inventare origine
 * PROFILE/APPLICATION o added_by mancanti quando la provenienza non è
 * dimostrabile. Il nuovo campo può usare una rappresentazione di origine
 * storica non determinata prevista dallo schema.» Le righe già presenti in
 * `club_shortlist_entries` restano `unknown`; quelle migrate da
 * `position_shortlist_entries` diventano `application`, perché quella
 * tabella aveva un solo scrittore ed era il comando dalla candidatura.
 */
alter table public.club_shortlist_entries
  add column if not exists created_source text not null default 'unknown';

alter table public.club_shortlist_entries
  drop constraint if exists club_shortlist_entries_source_check;

alter table public.club_shortlist_entries
  add constraint club_shortlist_entries_source_check
  check (created_source in ('profile', 'application', 'unknown'));

/**
 * Revisione della membership (§20).
 *
 * Due usi distinti, entrambi richiesti:
 *
 *   · compare-and-set sulle modifiche di valutazione e nota — §20: «Per gli
 *     aggiornamenti multi-admin non usare last-write-wins silenzioso»;
 *   · **generazione** della membership, per la protezione causale di §20 —
 *     «dopo una cancellazione, la sola unique key non impedirebbe a una
 *     vecchia richiesta di ricrearlo». La generazione vive in
 *     `club_shortlist_membership_log`, qui sotto.
 */
alter table public.club_shortlist_entries
  add column if not exists revision integer not null default 1;

create index if not exists club_shortlist_entries_application_idx
  on public.club_shortlist_entries (application_id)
  where application_id is not null;

comment on column public.club_shortlist_entries.created_source is
  'DAS-REV-24 §19: origine di **nascita** della entry, distinta dalla '
  'relazione Application corrente. `unknown` per le righe anteriori alla '
  '24, la cui provenienza non è dimostrabile (§26).';


-- ============================================================
-- SEZIONE 3 — generazioni della membership (§20)
--
-- «Definisci una protezione causale per rimozione e retry, utilizzando per
-- esempio revisioni della membership, idempotency record o tombstone
-- esistenti. Non affidarti soltanto all'unicità del record attuale: dopo una
-- cancellazione, la sola unique key non impedirebbe a una vecchia richiesta
-- di ricrearlo.»
--
-- Il log è un contatore per coppia (lista, persona) che **non torna
-- indietro**. Ogni aggiunta lo incrementa; ogni rimozione lo lascia dov'è e
-- marca la generazione come chiusa. Una ricevuta di operazione registra la
-- generazione alla quale si riferiva: un retry che la trova chiusa
-- restituisce il proprio esito storico e non ricrea niente (QA064, QA065,
-- QA067).
-- ============================================================

create table if not exists public.club_shortlist_membership_log (
  shortlist_id   uuid not null
    references public.club_shortlists(id) on delete cascade,
  person_profile_id uuid not null
    references public.profiles(id) on delete cascade,
  generation     integer not null default 1,
  /* true finché la membership di questa generazione esiste. */
  is_active      boolean not null default true,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now()),
  primary key (shortlist_id, person_profile_id)
);

alter table public.club_shortlist_membership_log enable row level security;
-- Nessuna policy: tabella interna alle funzioni `security definer`.
-- §29: non è uno storico consultabile, è una protezione causale.

comment on table public.club_shortlist_membership_log is
  'DAS-REV-24 §20: generazione corrente della membership (lista, persona). '
  'Monotona: distingue un retry di una vecchia aggiunta da una nuova '
  'aggiunta esplicita dopo una rimozione.';


-- ============================================================
-- SEZIONE 4 — predicati di perimetro (§22)
--
-- «L'autorizzazione è capability ∩ scope ∩ accesso corrente alla Society.»
-- Tutto passa da `society_position_in_scope`, che quella intersezione la
-- calcola già per le Position: possiede `owns_club`, `club_access_is_active`,
-- `dashboard_club_capabilities` e `dashboard_club_capability_scope`.
-- Riscriverne una variante significherebbe farla divergere alla prima
-- modifica del catalogo.
-- ============================================================

/**
 * Perimetro di una lista, qualunque sia il tipo.
 *
 * POSITION → la squadra della Position (§22: «Per POSITION deriva il
 * perimetro dalla Position associata»). CUSTOM → il proprio `team_id`.
 *
 * Il `team_id` corrente della Position e non quello pubblicato: §22 è
 * esplicito — «Una seconda squadra informativa o uno snapshot testuale non
 * amplia lo scope … l'autorizzazione usa sempre identificativi e permessi
 * effettivi» (§16).
 */
create or replace function public.shortlist_scope_team(p_shortlist_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when cs.list_type = 'position' then ad.team_id
    else cs.team_id
  end
  from public.club_shortlists cs
  left join public.recruiting_ads ad on ad.id = cs.position_id
  where cs.id = p_shortlist_id;
$$;

revoke all on function public.shortlist_scope_team(uuid) from public;
grant execute on function public.shortlist_scope_team(uuid) to authenticated;

create or replace function public.shortlist_in_scope(
  p_shortlist_id uuid,
  p_key          text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_team uuid;
  v_type text;
begin
  if p_shortlist_id is null then
    return false;
  end if;

  select cs.club_id, cs.list_type,
         case when cs.list_type = 'position' then ad.team_id else cs.team_id end
    into v_club, v_type, v_team
  from public.club_shortlists cs
  left join public.recruiting_ads ad on ad.id = cs.position_id
  where cs.id = p_shortlist_id;

  if v_club is null then
    return false;
  end if;

  return public.society_position_in_scope(v_club, v_team, p_key);
end;
$$;

revoke all on function public.shortlist_in_scope(uuid, text) from public;
grant execute on function public.shortlist_in_scope(uuid, text) to authenticated;

comment on function public.shortlist_in_scope(uuid, text) is
  'DAS-REV-24 §22: capability ∩ scope ∩ accesso corrente, per una lista di '
  'entrambi i tipi. Una POSITION eredita il perimetro dalla sua Position.';


-- ============================================================
-- SEZIONE 5 — RLS riallineata al perimetro (§22)
--
-- Le policy del 20260717090100 usavano `has_club_permission(club_id, …)`,
-- che è Society-wide: un amministratore con ambito Primavera leggeva **tutte**
-- le liste del club. §22 lo vieta e QA079/QA083/QA084 lo verificano. La
-- sostituzione con `shortlist_in_scope` chiude la falla per ogni lettore
-- diretto in una volta sola — comprese le due query PostgREST della stella
-- sul profilo, che oggi leggono `club_shortlist_entries` con un join.
--
-- La scrittura diretta sul contenitore POSITION non esiste: §16 — «Non
-- permettere di rinominare manualmente, cambiare tipo o eliminare dalla UI
-- il contenitore POSITION.» La materializzazione passa dal comando della
-- sezione 9.
-- ============================================================

drop policy if exists "authorized members read club shortlists" on public.club_shortlists;
create policy "authorized members read club shortlists"
on public.club_shortlists
for select
to authenticated
using (
  public.society_position_in_scope(
    club_id,
    case
      when list_type = 'position' then (
        select ad.team_id from public.recruiting_ads ad where ad.id = position_id
      )
      else team_id
    end,
    'shortlist_view'
  )
);

drop policy if exists "authorized members create club shortlists" on public.club_shortlists;
create policy "authorized members create club shortlists"
on public.club_shortlists
for insert
to authenticated
with check (
  /* §18: «Creare liste personalizzate e aggiungere a una Position Shortlist
     sono poteri distinti.» Dalla UI si crea **solo** una CUSTOM: il
     contenitore POSITION lo materializza il comando definer, che richiede
     `shortlist_add_profiles` e non questa chiave (QA041). */
  list_type = 'custom'
  and position_id is null
  and public.society_position_in_scope(club_id, team_id, 'shortlist_create_lists')
  and public.is_current_user(created_by_profile_id)
);

drop policy if exists "authorized members update club shortlists" on public.club_shortlists;
create policy "authorized members update club shortlists"
on public.club_shortlists
for update
to authenticated
using (
  list_type = 'custom'
  and public.society_position_in_scope(club_id, team_id, 'shortlist_create_lists')
)
with check (
  list_type = 'custom'
  and position_id is null
  and public.society_position_in_scope(club_id, team_id, 'shortlist_create_lists')
);

drop policy if exists "authorized members delete club shortlists" on public.club_shortlists;
create policy "authorized members delete club shortlists"
on public.club_shortlists
for delete
to authenticated
using (
  /* QA032: «Il comando di eliminazione manuale di una lista POSITION è
     rifiutato.» Qui non è nemmeno visibile come riga cancellabile. */
  list_type = 'custom'
  and public.society_position_in_scope(club_id, team_id, 'shortlist_create_lists')
);

drop policy if exists "authorized members read shortlist entries" on public.club_shortlist_entries;
create policy "authorized members read shortlist entries"
on public.club_shortlist_entries
for select
to authenticated
using (public.shortlist_in_scope(shortlist_id, 'shortlist_view'));

drop policy if exists "authorized members add shortlist entries" on public.club_shortlist_entries;
create policy "authorized members add shortlist entries"
on public.club_shortlist_entries
for insert
to authenticated
with check (
  public.is_current_user(added_by_profile_id)
  and public.shortlist_in_scope(shortlist_id, 'shortlist_add_profiles')
  and (
    internal_note is null
    or public.shortlist_in_scope(shortlist_id, 'shortlist_add_notes')
  )
  /* §23: «Il client non può aggiungere in payload campi protetti come
     added_by, data originaria, Society altrui o tipo POSITION in una
     creazione CUSTOM.» `application_id` è dello stesso genere: il legame con
     una candidatura lo stabiliscono il comando e la riconciliazione, non un
     insert diretto (QA026, QA040). */
  and application_id is null
  and created_source in ('profile', 'unknown')
);

drop policy if exists "authorized members remove shortlist entries" on public.club_shortlist_entries;
create policy "authorized members remove shortlist entries"
on public.club_shortlist_entries
for delete
to authenticated
using (public.shortlist_in_scope(shortlist_id, 'shortlist_remove_profiles'));


-- ============================================================
-- SEZIONE 6 — invarianti del contenitore e della entry (§16, §17)
--
-- Un CHECK non basta per nessuna delle tre: tutte richiedono di leggere
-- un'altra tabella.
--
--   · la Society di un contenitore POSITION deve essere quella della
--     Position (QA020: «payload con collegamento cross-Society rifiutato»);
--   · nome, tipo e Position di un contenitore POSITION non si modificano
--     (§16, QA031);
--   · una `application_id` deve puntare alla stessa persona e alla stessa
--     Position della lista (§17, QA026).
-- ============================================================

create or replace function public.guard_club_shortlist_container()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad public.recruiting_ads%rowtype;
begin
  if tg_op = 'DELETE' then
    /* La cancellazione a cascata dalla Position è legittima: arriva dal
       trigger RI interno, quindi con `pg_trigger_depth() > 1`. Il divieto di
       §16 riguarda la cancellazione **manuale** del contenitore. */
    if old.list_type = 'position' and pg_trigger_depth() <= 1 then
      raise exception 'SHORTLIST_POSITION_CONTAINER_IMMUTABLE';
    end if;

    return old;
  end if;

  if new.list_type = 'position' then
    select * into v_ad from public.recruiting_ads where id = new.position_id;

    if not found then
      raise exception 'SHORTLIST_POSITION_NOT_FOUND';
    end if;

    if v_ad.club_id is distinct from new.club_id then
      raise exception 'SHORTLIST_POSITION_CLUB_MISMATCH';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.list_type = 'position' then
    /* §16: «Non permettere di rinominare manualmente, cambiare tipo o
       eliminare dalla UI il contenitore POSITION.» `last_activity_at` e
       `updated_at` restano aggiornabili: sono proiezioni, non contenuto. */
    if new.name is distinct from old.name
       or new.description is distinct from old.description
       or new.scope is distinct from old.scope
       or new.team_id is distinct from old.team_id
       or new.list_type is distinct from old.list_type
       or new.position_id is distinct from old.position_id
       or new.club_id is distinct from old.club_id then
      raise exception 'SHORTLIST_POSITION_CONTAINER_IMMUTABLE';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.list_type = 'custom' and new.list_type <> 'custom' then
    /* QA021: «un nome simile a una Position non comporta conversione». */
    raise exception 'SHORTLIST_TYPE_IMMUTABLE';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_club_shortlist_container on public.club_shortlists;
create trigger guard_club_shortlist_container
  before insert or update or delete on public.club_shortlists
  for each row execute function public.guard_club_shortlist_container();

comment on function public.guard_club_shortlist_container() is
  'DAS-REV-24 §16: il contenitore POSITION è derivato, non editabile. La '
  'Society deve coincidere con quella della Position (QA020) e il '
  'contenitore non si rinomina, non cambia tipo e non si cancella a mano '
  '(QA031, QA032).';

create or replace function public.guard_club_shortlist_entry_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list public.club_shortlists%rowtype;
  v_app  public.recruiting_applications%rowtype;
begin
  if new.application_id is null then
    return new;
  end if;

  select * into v_list from public.club_shortlists where id = new.shortlist_id;
  select * into v_app  from public.recruiting_applications where id = new.application_id;

  if not found or v_list.id is null then
    raise exception 'SHORTLIST_APPLICATION_INVALID';
  end if;

  /* §17: «deve identificare la stessa persona, la stessa Society
     destinataria e la stessa Position della shortlist POSITION. Nessuna
     associazione soltanto per nome, ruolo o coincidenza di Team.» */
  if v_app.applicant_profile_id is distinct from new.player_profile_id then
    raise exception 'SHORTLIST_APPLICATION_PERSON_MISMATCH';
  end if;

  /* §17: «Le CUSTOM non acquisiscono automaticamente la candidatura di una
     persona per effetto di questa riconciliazione.» Una CUSTOM non porta
     mai un application_id. */
  if v_list.list_type <> 'position'
     or v_app.ad_id is distinct from v_list.position_id then
    raise exception 'SHORTLIST_APPLICATION_POSITION_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_club_shortlist_entry_application on public.club_shortlist_entries;
create trigger guard_club_shortlist_entry_application
  before insert or update of application_id, shortlist_id, player_profile_id
  on public.club_shortlist_entries
  for each row execute function public.guard_club_shortlist_entry_application();


-- ============================================================
-- SEZIONE 7 — attività reale del contenitore (§24)
--
-- «Un GET, uno scroll, un retry senza effetti o la sola riconciliazione
-- tecnica non devono generare falsa attività» (QA018).
--
-- Perciò il bump **non** scatta quando l'unica differenza è
-- `application_id`: quella è la riconciliazione di §19, che per definizione
-- non è una scelta della Società. Scatta su ingresso e uscita di una
-- membership e sulle modifiche di valutazione, priorità e nota.
-- ============================================================

create or replace function public.touch_club_shortlist_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list uuid := case when tg_op = 'DELETE' then old.shortlist_id else new.shortlist_id end;
begin
  if tg_op = 'UPDATE'
     and new.priority          is not distinct from old.priority
     and new.evaluation_status is not distinct from old.evaluation_status
     and new.internal_note     is not distinct from old.internal_note
     and new.shortlist_id      is not distinct from old.shortlist_id then
    return coalesce(new, old);
  end if;

  update public.club_shortlists
  set last_activity_at = timezone('utc', now())
  where id = v_list;

  return coalesce(new, old);
end;
$$;

drop trigger if exists touch_club_shortlist_activity on public.club_shortlist_entries;
create trigger touch_club_shortlist_activity
  after insert or update or delete on public.club_shortlist_entries
  for each row execute function public.touch_club_shortlist_activity();

/**
 * Revisione della entry.
 *
 * §20: «Per gli aggiornamenti multi-admin non usare last-write-wins
 * silenzioso sulle note o sugli stati.» Il contatore è stampato qui e non
 * dal chiamante, così nessun percorso di scrittura può dimenticarlo.
 */
create or replace function public.bump_club_shortlist_entry_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.priority          is distinct from old.priority
     or new.evaluation_status is distinct from old.evaluation_status
     or new.internal_note     is distinct from old.internal_note then
    new.revision := old.revision + 1;
  end if;

  return new;
end;
$$;

drop trigger if exists bump_club_shortlist_entry_revision on public.club_shortlist_entries;
create trigger bump_club_shortlist_entry_revision
  before update on public.club_shortlist_entries
  for each row execute function public.bump_club_shortlist_entry_revision();

/**
 * Generazione della membership (§20).
 *
 * Una riga per coppia (lista, persona), con un contatore che non torna
 * indietro. L'aggiunta apre una generazione, la rimozione la chiude. La
 * ricevuta di un'aggiunta porta il numero della generazione a cui si
 * riferisce: un retry che la trova chiusa non ricrea niente.
 */
create or replace function public.track_club_shortlist_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.club_shortlist_membership_log
      (shortlist_id, person_profile_id, generation, is_active)
    values (new.shortlist_id, new.player_profile_id, 1, true)
    on conflict (shortlist_id, person_profile_id) do update
      set generation = public.club_shortlist_membership_log.generation + 1,
          is_active  = true,
          updated_at = timezone('utc', now());

    return new;
  end if;

  update public.club_shortlist_membership_log
  set is_active  = false,
      updated_at = timezone('utc', now())
  where shortlist_id = old.shortlist_id
    and person_profile_id = old.player_profile_id;

  return old;
end;
$$;

drop trigger if exists track_club_shortlist_membership on public.club_shortlist_entries;
create trigger track_club_shortlist_membership
  after insert or delete on public.club_shortlist_entries
  for each row execute function public.track_club_shortlist_membership();

/* Le entry già presenti hanno una generazione aperta. */
insert into public.club_shortlist_membership_log
  (shortlist_id, person_profile_id, generation, is_active, created_at, updated_at)
select e.shortlist_id, e.player_profile_id, 1, true, e.created_at, e.updated_at
from public.club_shortlist_entries e
on conflict (shortlist_id, person_profile_id) do nothing;


-- ============================================================
-- SEZIONE 8 — fusione del secondo core (§26)
--
-- `position_shortlist_entries` diventa `club_shortlist_entries` dentro un
-- contenitore POSITION. §26: «preserva gli ID o fornisci una mappatura
-- compatibile e documentata per i riferimenti esistenti» — qui gli id sono
-- **preservati**: la entry migrata conserva la propria chiave primaria,
-- quindi ogni riferimento già emesso continua a risolvere.
--
-- §26: «Non clonare liste, rigenerare ID, trasformare le date in oggi.» Per
-- questo `created_at` viene copiato e non ricalcolato, e il contenitore nasce
-- con la data della sua prima entry.
--
-- §26: «Rieseguire la migrazione non clona record» (QA127). Entrambi gli
-- insert hanno un `on conflict do nothing` su un vincolo reale, e la
-- sostituzione della tabella con la vista è condizionata al `relkind`.
-- ============================================================

do $$
declare
  v_is_table boolean;
begin
  select c.relkind = 'r' into v_is_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'position_shortlist_entries';

  if v_is_table is not true then
    -- Già fusa da un'esecuzione precedente: niente da migrare.
    return;
  end if;

  /* Un contenitore per ogni Position che ha davvero delle entry. §16: «La
     lettura del centro non crea contenitori per tutte le posizioni» — e
     nemmeno la migrazione. */
  insert into public.club_shortlists
    (club_id, name, description, scope, list_type, position_id,
     created_by_profile_id, created_at, updated_at, last_activity_at)
  select
    ad.club_id,
    /* Etichetta materializzata per comodità dei log: i lettori derivano
       titolo e ambito dalla Position (§16). La colonna non è editabile — il
       trigger della sezione 6 lo impedisce. */
    coalesce(
      nullif(btrim(ad.custom_role_name), ''),
      pr.label,
      nullif(btrim(ad.title), ''),
      'Posizione'
    ),
    null,
    'tutta_la_societa',
    'position',
    ad.id,
    first_entry.added_by_profile_id,
    first_entry.first_at,
    first_entry.last_at,
    first_entry.last_at
  from public.recruiting_ads ad
  join lateral (
    select
      min(pse.created_at) as first_at,
      max(pse.created_at) as last_at,
      (array_agg(pse.added_by_profile_id order by pse.created_at))[1]
        as added_by_profile_id
    from public.position_shortlist_entries pse
    where pse.ad_id = ad.id
    having count(*) > 0
  ) first_entry on true
  left join public.position_roles pr on pr.id = ad.structured_role_id
  on conflict (position_id) where position_id is not null do nothing;

  /* Le entry, con il loro id. `created_source = 'application'` è
     dimostrabile: l'unico scrittore di quella tabella era
     `add_position_shortlist_entry`, che parte dalla candidatura (§26 vieta
     di inventare un'origine, non di registrarne una provata). */
  insert into public.club_shortlist_entries
    (id, shortlist_id, player_profile_id, priority, evaluation_status,
     internal_note, added_by_profile_id, application_id, created_source,
     created_at, updated_at)
  select
    pse.id,
    cs.id,
    pse.person_profile_id,
    null,
    'da_valutare',
    null,
    pse.added_by_profile_id,
    pse.source_application_id,
    'application',
    pse.created_at,
    pse.created_at
  from public.position_shortlist_entries pse
  join public.club_shortlists cs on cs.position_id = pse.ad_id
  on conflict (shortlist_id, player_profile_id) do nothing;

  drop table public.position_shortlist_entries;
end;
$$;

/**
 * Vista di compatibilità (§26).
 *
 * «Mantieni compatibilità con API, route e client supportati durante il
 * rollout. Non fare fallire un lettore precedente perché riceve un nuovo
 * tipo non gestito: usa versionamento o adattatori coerenti.»
 *
 * `security_invoker` perché un lettore diretto deve continuare a passare
 * dalla RLS del core — la vista non è una scorciatoia al perimetro (§22).
 * È in sola lettura: la scrittura passava già solo dal comando definer.
 */
create or replace view public.position_shortlist_entries
with (security_invoker = true)
as
select
  e.id,
  cs.position_id              as ad_id,
  e.player_profile_id         as person_profile_id,
  e.application_id            as source_application_id,
  e.added_by_profile_id,
  e.created_at
from public.club_shortlist_entries e
join public.club_shortlists cs on cs.id = e.shortlist_id
where cs.list_type = 'position';

comment on view public.position_shortlist_entries is
  'DAS-REV-24 §26: proiezione di compatibilità del core unico. La tabella '
  'omonima di DAS-REV-22 è stata fusa in club_shortlist_entries '
  'preservando gli id. Sola lettura.';


-- ============================================================
-- SEZIONE 9 — materializzazione e aggiunta atomica (§18)
--
-- «La creazione del contenitore e della prima entry deve essere una sola
-- operazione logica sicura.» In plpgsql lo è per costruzione: la funzione
-- è una transazione.
--
-- L'ordine dei controlli è quello di §18.1-9, e nessun parametro di
-- destinazione viene accettato dal client: §18 — «Non fidarti di
-- shortlist_id, person_id, Society destinataria o Team arbitrari inviati nel
-- flusso Application. Derivali dai record canonici» (QA040).
-- ============================================================

/**
 * Contenitore POSITION della Position indicata, creandolo se manca.
 *
 * Interna: §16 — «Un semplice GET deve restare privo di effetti di
 * creazione; la materializzazione necessaria a un'operazione si esegue nel
 * comando autorizzato.» Nessun grant, quindi nessuna route può chiamarla.
 *
 * La race di QA022/QA058 si risolve sull'unique parziale, non su un
 * `if not exists`: due transazioni concorrenti lo supererebbero entrambe.
 */
create or replace function public.get_or_create_position_shortlist(p_ad_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad   public.recruiting_ads%rowtype;
  v_id   uuid;
begin
  select cs.id into v_id
  from public.club_shortlists cs
  where cs.position_id = p_ad_id;

  if found then
    return v_id;
  end if;

  select * into v_ad from public.recruiting_ads where id = p_ad_id;

  if not found then
    raise exception 'SHORTLIST_POSITION_NOT_FOUND';
  end if;

  insert into public.club_shortlists
    (club_id, name, description, scope, list_type, position_id,
     created_by_profile_id)
  values (
    v_ad.club_id,
    coalesce(
      nullif(btrim(v_ad.custom_role_name), ''),
      (select pr.label from public.position_roles pr where pr.id = v_ad.structured_role_id),
      nullif(btrim(v_ad.title), ''),
      'Posizione'
    ),
    null,
    'tutta_la_societa',
    'position',
    v_ad.id,
    auth.uid()
  )
  on conflict (position_id) where position_id is not null do nothing
  returning club_shortlists.id into v_id;

  if v_id is null then
    /* Un'altra transazione ha vinto la corsa: il contenitore unico è il
       suo. §18: «Due amministratori che aggiungono due persone alla stessa
       Position senza contenitore producono una lista e due entry.» */
    select cs.id into v_id
    from public.club_shortlists cs
    where cs.position_id = p_ad_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.get_or_create_position_shortlist(uuid) from public;

comment on function public.get_or_create_position_shortlist(uuid) is
  'DAS-REV-24 §16, §18: contenitore POSITION unico, materializzato solo '
  'dentro un comando autorizzato. Nessun grant: una lettura non crea mai un '
  'contenitore (QA033).';


/**
 * Aggiunta one-tap dalla candidatura (§13, §18).
 *
 * L'unico parametro di destinazione è la candidatura: persona, Position e
 * Society si derivano da lei. La chiave di idempotenza è facoltativa e serve
 * a §20 — «retry dopo timeout quando il commit potrebbe essere già
 * avvenuto».
 *
 * Il fingerprint porta la **generazione** osservata della membership, non
 * solo l'id della candidatura: è ciò che distingue «retry della stessa
 * aggiunta» da «nuova aggiunta dopo una rimozione» (§20, QA065, QA066).
 * Il replay restituisce la ricevuta storica e non ricrea niente: se un altro
 * actor ha rimosso la persona nel frattempo, la rimozione resta (QA064).
 */
create or replace function public.add_application_to_shortlist(
  p_application_id  uuid,
  p_idempotency_key text default null
)
returns table (
  entry_id      uuid,
  shortlist_ref uuid,
  position_ref  uuid,
  person_ref    uuid,
  added_at      timestamptz,
  already       boolean,
  profiles_total bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_ctx         record;
  v_app         public.recruiting_applications%rowtype;
  v_ad          public.recruiting_ads%rowtype;
  v_list        uuid;
  v_row         public.club_shortlist_entries%rowtype;
  v_generation  integer;
  v_fingerprint text;
  v_receipt     jsonb;
  v_count       bigint;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_ctx from public.society_application_context(p_application_id);

  if v_ctx.ad_id is null or not v_ctx.authorized then
    raise exception 'APPLICATION_NOT_AVAILABLE';
  end if;

  /* §5, §18.3: capability **e** perimetro. `shortlist_add_profiles` nello
     scope della Position, non una capability Society-wide dedotta dal
     ruolo visualizzato (QA042, QA090). */
  if not public.society_position_in_scope(
       v_ctx.club_id, v_ctx.team_id, 'shortlist_add_profiles'
     ) then
    raise exception 'SHORTLIST_NOT_AUTHORIZED';
  end if;

  /* §18.4 e §21: lo stato si rivaluta **al commit**, sotto lock. La race
     ritiro/aggiunta si decide qui e non sulla schermata (QA062, QA063). */
  select * into v_app
  from public.recruiting_applications
  where id = p_application_id
  for share;

  select * into v_ad from public.recruiting_ads where id = v_ctx.ad_id;

  if v_ad.status = 'draft' then
    raise exception 'APPLICATION_NOT_AVAILABLE';
  end if;

  v_list := public.get_or_create_position_shortlist(v_ad.id);

  /* Il fingerprint è **costante**: la chiave identifica l'intenzione, e
     l'intenzione di questo comando è una sola — «aggiungi la persona di
     questa candidatura». Metterci dentro lo stato corrente della
     membership farebbe fallire il retry più ovvio di tutti (stessa chiave
     subito dopo il commit) con un conflitto di contenuto.

     §20 vuole distinguere «retry di una vecchia aggiunta» da «nuova
     aggiunta dopo una rimozione»: la distinzione è la **chiave**, che il
     client genera una per intenzione, come già fa `operation-key.ts`. Una
     chiave vecchia replica la ricevuta e non ricrea niente (QA065); una
     chiave nuova è un'intenzione nuova e rispetta la policy (QA066). */
  v_fingerprint := 'shortlist_add|v1';

  v_receipt := public.application_operation_replay(
    p_idempotency_key, p_application_id, 'shortlist_add', v_fingerprint
  );

  if v_receipt is not null then
    /* §20: «Distingui ricevuta dell'operazione e proiezione corrente: il
       retry di un add già committato non deve ricreare una membership che
       un altro actor ha rimosso dopo.» */
    select count(*) into v_count
    from public.club_shortlist_entries e
    where e.shortlist_id = v_list;

    entry_id       := (v_receipt ->> 'entry_id')::uuid;
    shortlist_ref  := v_list;
    position_ref   := v_ad.id;
    person_ref     := v_app.applicant_profile_id;
    added_at       := (v_receipt ->> 'added_at')::timestamptz;
    already        := true;
    profiles_total := v_count;
    return next;

    return;
  end if;

  /* §21: «WITHDRAWN · Assente · Nuova aggiunta dal dettaglio candidatura non
     consentita.» CLOSED e deadline superata **non** la bloccano: la riga
     successiva della stessa tabella lo dice esplicitamente. */
  if v_app.status = 'withdrawn'
     and not exists (
       select 1 from public.club_shortlist_entries e
       where e.shortlist_id = v_list
         and e.player_profile_id = v_app.applicant_profile_id
     ) then
    raise exception 'APPLICATION_WITHDRAWN';
  end if;

  /* §17: «La nuova aggiunta one-tap da candidatura imposta Da valutare,
     priority nulla, nota nulla, application_id canonico, added_by actor
     effettivo e data server. Questi default si applicano soltanto alla
     nuova entry.» */
  insert into public.club_shortlist_entries
    (shortlist_id, player_profile_id, priority, evaluation_status,
     internal_note, added_by_profile_id, application_id, created_source)
  values
    (v_list, v_app.applicant_profile_id, null, 'da_valutare',
     null, v_uid, v_app.id, 'application')
  on conflict (shortlist_id, player_profile_id) do nothing
  returning club_shortlist_entries.* into v_row;

  if v_row.id is null then
    /* §19: «Prima profilo, poi candidatura.» La entry esiste già — da un
       altro percorso o da un altro actor. §20: «L'add idempotente
       restituisce l'entry esistente e può collegare un riferimento mancante,
       ma non sostituisce il documento con un nuovo oggetto pieno di
       default» (QA045, QA060). */
    select * into v_row
    from public.club_shortlist_entries e
    where e.shortlist_id = v_list
      and e.player_profile_id = v_app.applicant_profile_id
    for update;

    if v_row.application_id is null then
      update public.club_shortlist_entries e
      set application_id = v_app.id
      where e.id = v_row.id
      returning e.* into v_row;
    end if;

    already := true;
  else
    already := false;
  end if;

  select coalesce(log.generation, 1) into v_generation
  from public.club_shortlist_membership_log log
  where log.shortlist_id = v_list
    and log.person_profile_id = v_app.applicant_profile_id;

  perform public.application_operation_record(
    p_idempotency_key, p_application_id, 'shortlist_add', v_fingerprint,
    jsonb_build_object(
      'entry_id',   v_row.id,
      'added_at',   v_row.created_at,
      'generation', v_generation
    )
  );

  select count(*) into v_count
  from public.club_shortlist_entries e
  where e.shortlist_id = v_list;

  entry_id       := v_row.id;
  shortlist_ref  := v_list;
  position_ref   := v_ad.id;
  person_ref     := v_row.player_profile_id;
  added_at       := v_row.created_at;
  profiles_total := v_count;
  return next;
end;
$$;

revoke all on function public.add_application_to_shortlist(uuid, text) from public;
grant execute on function public.add_application_to_shortlist(uuid, text) to authenticated;

comment on function public.add_application_to_shortlist(uuid, text) is
  'DAS-REV-24 §13, §18: aggiunta one-tap alla shortlist della Position '
  'della candidatura, atomica e idempotente. Non cambia lo stato della '
  'Application, non azzera valutazioni esistenti, non notifica il candidato.';

/**
 * Compatibilità con DAS-REV-22 (§26).
 *
 * `add_position_shortlist_entry` conserva nome, firma e colonne OUT, e
 * delega al comando unico. Un client non aggiornato continua a funzionare.
 */
create or replace function public.add_position_shortlist_entry(p_application_id uuid)
returns table (
  entry_id     uuid,
  position_id  uuid,
  person_id    uuid,
  added_at     timestamptz,
  already      boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  select * into v_row
  from public.add_application_to_shortlist(p_application_id, null);

  entry_id    := v_row.entry_id;
  position_id := v_row.position_ref;
  person_id   := v_row.person_ref;
  added_at    := v_row.added_at;
  already     := v_row.already;
  return next;
end;
$$;

revoke all on function public.add_position_shortlist_entry(uuid) from public;
grant execute on function public.add_position_shortlist_entry(uuid) to authenticated;

comment on function public.add_position_shortlist_entry(uuid) is
  'DAS-REV-22 §20, adattato da DAS-REV-24 §26: wrapper di compatibilità su '
  'add_application_to_shortlist. Il core è uno solo.';


-- ============================================================
-- SEZIONE 10 — riconciliazione candidatura -> membership (§19)
--
-- «Prima profilo, poi candidatura. L'aggiunta esistente dal profilo può
-- creare una entry senza Application. Alla submission o al reapply cerca una
-- membership già esistente per person_id + Position. Se presente, collega la
-- Application mantenendo id entry, added_by, created_at, priority,
-- evaluation_status e nota.»
--
-- Un trigger e non una modifica di `apply_to_position`: §19 — «Un handler di
-- submission deve verificare la relazione esistente, non materializzarne una
-- nuova» — e riemettere quella funzione dal file del 2026-11-03 è il modo
-- più sicuro di perdere una correzione successiva.
--
-- §19: «Candidatura senza precedente membership. Non creare automaticamente
-- una shortlist o inserire la persona» (QA050). Il trigger fa un UPDATE
-- condizionato, mai un INSERT.
-- ============================================================

create or replace function public.reconcile_shortlist_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  /* Solo una candidatura corrente si collega. Un ritiro non scollega: §21 —
     «WITHDRAWN e membership consultabile · Conserva entry e In shortlist». */
  if new.status = 'withdrawn' then
    return new;
  end if;

  update public.club_shortlist_entries e
  set application_id = new.id
  from public.club_shortlists cs
  where cs.id = e.shortlist_id
    and cs.list_type = 'position'
    and cs.position_id = new.ad_id
    and e.player_profile_id = new.applicant_profile_id
    /* §19: «Una riconciliazione ritardata collega soltanto una membership
       ancora esistente e valida. Non ripristina entry rimosse.» L'UPDATE su
       zero righe è esattamente questo. */
    and e.application_id is distinct from new.id;

  return new;
end;
$$;

drop trigger if exists reconcile_shortlist_application on public.recruiting_applications;
create trigger reconcile_shortlist_application
  after insert or update of status, ad_id, applicant_profile_id
  on public.recruiting_applications
  for each row execute function public.reconcile_shortlist_application();

comment on function public.reconcile_shortlist_application() is
  'DAS-REV-24 §19: collega una candidatura a una membership **già '
  'esistente** della stessa persona e della stessa Position. Non crea '
  'contenitori, non crea entry, non tocca valutazione, priorità, nota, '
  'autore o data (QA047, QA048, QA049, QA050).';

/**
 * L'altro verso della stessa riconciliazione (§19, QA052).
 *
 * «Se il flusso esistente dal profilo aggiunge una persona che possiede già
 * una Application pertinente, riutilizza quella relazione canonica quando
 * applicabile: non lasciare application_id nullo soltanto perché l'ingresso
 * era il profilo e non attendere una nuova submission che potrebbe non
 * arrivare.»
 *
 * Vive in un trigger e non nel comando perché la RLS della sezione 5 vieta
 * al client di scrivere `application_id` (§23): il legame lo stabilisce
 * sempre il server, da qualunque percorso arrivi la entry. `created_source`
 * non viene toccato — §19: «Non cambiare l'origine storica.»
 */
create or replace function public.link_shortlist_entry_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list public.club_shortlists%rowtype;
  v_app  uuid;
begin
  if new.application_id is not null then
    return new;
  end if;

  select * into v_list from public.club_shortlists where id = new.shortlist_id;

  if not found or v_list.list_type <> 'position' then
    return new;
  end if;

  select a.id into v_app
  from public.recruiting_applications a
  where a.ad_id = v_list.position_id
    and a.applicant_profile_id = new.player_profile_id
    and a.status <> 'withdrawn';

  if v_app is null then
    return new;
  end if;

  update public.club_shortlist_entries e
  set application_id = v_app
  where e.id = new.id;

  return new;
end;
$$;

drop trigger if exists link_shortlist_entry_application on public.club_shortlist_entries;
create trigger link_shortlist_entry_application
  after insert on public.club_shortlist_entries
  for each row execute function public.link_shortlist_entry_application();

/* Backfill una tantum delle membership già esistenti: §26 chiede di
   «Validare conteggi prima/dopo, integrità referenziale, membership …». Non
   crea né rimuove niente, collega soltanto ciò che era già vero. */
update public.club_shortlist_entries e
set application_id = a.id
from public.club_shortlists cs
join public.recruiting_applications a
  on a.ad_id = cs.position_id and a.status <> 'withdrawn'
where cs.id = e.shortlist_id
  and cs.list_type = 'position'
  and a.applicant_profile_id = e.player_profile_id
  and e.application_id is null;


-- ============================================================
-- SEZIONE 11 — read model del centro (§23, §24)
--
-- Tre funzioni e non una: §12 — «Se un solo gruppo fallisce e l'altro è
-- utilizzabile, gestisci un errore locale nel gruppo, non un vuoto» (QA016,
-- QA103). Un'unica risposta renderebbe quel requisito indimostrabile, come
-- DAS-REV-02 aveva già imparato separando il provider delle Posizioni.
--
-- §24: «La query deve filtrare i record non autorizzati prima di conteggiare
-- e paginare. Nessun count nascosto o next cursor che riveli quantità fuori
-- scope» (QA083).
-- ============================================================

/**
 * Testata e capacità del centro.
 *
 * §5: «Il backend distingue utente autenticato, Society operativa e relativo
 * scope autorizzato.» Le capacità esposte sono quelle che la UI deve poter
 * nascondere — §22: «Il read model espone le azioni effettivamente
 * disponibili.»
 */
create or replace function public.fetch_shortlist_center_header(p_club_id uuid)
returns table (
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  club_is_verified   boolean,
  scope_label        text,
  can_view           boolean,
  can_create_lists   boolean,
  can_add_profiles   boolean,
  can_add_notes      boolean,
  can_edit_status    boolean,
  can_remove_profiles boolean,
  access_verified_at timestamptz,
  data_revision      bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_caps  text[];
  v_scope uuid[];
  v_club  public.clubs%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.society_position_in_scope(p_club_id, null, 'shortlist_view')
     and not exists (
       select 1
       from unnest(public.dashboard_club_capability_scope(p_club_id, 'shortlist_view')) t(id)
     ) then
    /* Né Society-wide né su alcuna squadra: §22 — «Non rivelare che altre
       liste esistono fuori scope.» Un solo codice, nessun dettaglio. */
    raise exception 'SHORTLIST_NOT_AUTHORIZED';
  end if;

  select * into v_club from public.clubs where id = p_club_id;

  if not found then
    raise exception 'SHORTLIST_NOT_AUTHORIZED';
  end if;

  v_caps  := public.dashboard_club_capabilities(p_club_id);
  v_scope := public.dashboard_club_capability_scope(p_club_id, 'shortlist_view');

  club_id          := v_club.id;
  club_name        := v_club.name;
  club_logo_url    := v_club.logo_url;
  /* `clubs` non ha un booleano: la verifica è `verification_status`
     (20260319000000), come la legge il resto della Dashboard. */
  club_is_verified := v_club.verification_status = 'verified';
  /* §7 della Foundation: l'ambito è informazione, non un controllo. Più
     squadre nel perimetro producono il loro elenco, non un conteggio. */
  scope_label      := case
    when v_scope is null then null
    else (
      select string_agg(ct.name, ' · ' order by ct.sort_order, ct.name)
      from public.club_teams ct
      where ct.id = any (v_scope)
    )
  end;
  can_view            := 'shortlist_view' = any (v_caps);
  can_create_lists    := 'shortlist_create_lists' = any (v_caps);
  can_add_profiles    := 'shortlist_add_profiles' = any (v_caps);
  can_add_notes       := 'shortlist_add_notes' = any (v_caps);
  can_edit_status     := 'shortlist_edit_status' = any (v_caps);
  can_remove_profiles := 'shortlist_remove_profiles' = any (v_caps);
  access_verified_at  := timezone('utc', now());
  data_revision       := (extract(epoch from timezone('utc', now())) * 1000)::bigint;
  return next;
end;
$$;

revoke all on function public.fetch_shortlist_center_header(uuid) from public;
grant execute on function public.fetch_shortlist_center_header(uuid) to authenticated;

/**
 * Gruppo «Per posizione» (§9, §24).
 *
 * §24: «POSITION: includi soltanto liste esistenti, accessibili e con
 * profiles_count > 0» (QA006). Il contenitore non viene cancellato quando
 * si svuota: semplicemente non compare qui (QA106).
 *
 * Ordine: PUBLISHED prima, CLOSED dopo; dentro ogni gruppo attività reale
 * decrescente con l'id come spareggio stabile (§10, QA008, QA017).
 */
create or replace function public.fetch_shortlist_position_lists(
  p_club_id uuid,
  p_limit   integer default 20,
  p_cursor  text    default null
)
returns table (
  shortlist_id   uuid,
  position_id    uuid,
  title          text,
  scope_label    text,
  profiles_count bigint,
  is_closed      boolean,
  last_activity_at timestamptz,
  next_cursor    text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_limit     integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_sort      integer;
  v_activity  timestamptz;
  v_id        uuid;
  v_rows      integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_cursor is not null and btrim(p_cursor) <> '' then
    v_sort     := split_part(p_cursor, '|', 1)::integer;
    v_activity := split_part(p_cursor, '|', 2)::timestamptz;
    v_id       := split_part(p_cursor, '|', 3)::uuid;
  end if;

  return query
  with visible as (
    select
      cs.id,
      cs.position_id,
      ad.status,
      ad.team_id,
      ad.position_scope_type,
      ad.published_team_name,
      ad.custom_role_name,
      ad.title,
      ad.structured_role_id,
      ct.name as team_name,
      cs.last_activity_at,
      (
        select count(*)
        from public.club_shortlist_entries e
        where e.shortlist_id = cs.id
      ) as entries,
      case when ad.status = 'closed' then 1 else 0 end as sort_group
    from public.club_shortlists cs
    join public.recruiting_ads ad on ad.id = cs.position_id
    left join public.club_teams ct on ct.id = ad.team_id
    where cs.club_id = p_club_id
      and cs.list_type = 'position'
      and ad.status <> 'draft'
      /* §24: filtro autorizzativo **prima** di contare e paginare. */
      and public.society_position_in_scope(cs.club_id, ad.team_id, 'shortlist_view')
  ),
  page as (
    select *
    from visible v
    where v.entries > 0
      /* Il keyset non puo essere una row-comparison: `sort_group` sale e
         `last_activity_at` scende, e `(a,b) < (x,y)` pretende la stessa
         direzione su entrambe. Esplicito e corretto, invece che compatto e
         sbagliato in silenzio sulla seconda pagina. */
      and (
        v_sort is null
        or v.sort_group > v_sort
        or (
          v.sort_group = v_sort
          and (
            v.last_activity_at < v_activity
            or (v.last_activity_at = v_activity and v.id < v_id)
          )
        )
      )
    order by v.sort_group asc, v.last_activity_at desc, v.id desc
    limit v_limit + 1
  ),
  trimmed as (
    select p.*, row_number() over (
      order by p.sort_group asc, p.last_activity_at desc, p.id desc
    ) as rn
    from page p
  )
  select
    t.id,
    t.position_id,
    coalesce(
      nullif(btrim(t.custom_role_name), ''),
      pr.label,
      nullif(btrim(t.title), ''),
      'Posizione'
    ),
    /* §16: «Le etichette storiche devono seguire lo snapshot e le regole del
       dominio Position», come già fa il dettaglio candidature. */
    case
      when t.position_scope_type = 'society' then 'Intera società'
      when t.status = 'closed' then coalesce(t.published_team_name, t.team_name)
      else t.team_name
    end,
    t.entries,
    t.status = 'closed',
    t.last_activity_at,
    case
      when (select count(*) from trimmed) > v_limit and t.rn = v_limit
        then t.sort_group::text || '|' || t.last_activity_at::text || '|' || t.id::text
    end
  from trimmed t
  left join public.position_roles pr on pr.id = t.structured_role_id
  where t.rn <= v_limit
  order by t.rn;
end;
$$;

revoke all on function public.fetch_shortlist_position_lists(uuid, integer, text) from public;
grant execute on function public.fetch_shortlist_position_lists(uuid, integer, text) to authenticated;

/**
 * Gruppo «Liste personalizzate» (§9, §24).
 *
 * §24: «CUSTOM: includi liste accessibili non eliminate, anche con
 * profiles_count = 0» (QA007). Una lista vuota è una scelta della Società e
 * la sua presenza impedisce il falso empty globale.
 */
create or replace function public.fetch_shortlist_custom_lists(
  p_club_id uuid,
  p_limit   integer default 20,
  p_cursor  text    default null
)
returns table (
  shortlist_id   uuid,
  name           text,
  scope_label    text,
  profiles_count bigint,
  last_activity_at timestamptz,
  next_cursor    text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_limit    integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_activity timestamptz;
  v_id       uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_cursor is not null and btrim(p_cursor) <> '' then
    v_activity := split_part(p_cursor, '|', 1)::timestamptz;
    v_id       := split_part(p_cursor, '|', 2)::uuid;
  end if;

  return query
  with visible as (
    select
      cs.id,
      cs.name,
      cs.scope,
      cs.team_id,
      ct.name as team_name,
      cs.last_activity_at,
      (
        select count(*)
        from public.club_shortlist_entries e
        where e.shortlist_id = cs.id
      ) as entries
    from public.club_shortlists cs
    left join public.club_teams ct on ct.id = cs.team_id
    where cs.club_id = p_club_id
      and cs.list_type = 'custom'
      and public.society_position_in_scope(cs.club_id, cs.team_id, 'shortlist_view')
  ),
  page as (
    select v.*, row_number() over (
      order by v.last_activity_at desc, v.id desc
    ) as rn
    from visible v
    where v_activity is null
       or (v.last_activity_at, v.id) < (v_activity, v_id)
    order by v.last_activity_at desc, v.id desc
    limit v_limit + 1
  )
  select
    p.id,
    p.name,
    /* Una lista nata prima della 24 non ha `team_id`: la sua etichetta resta
       quella storica di `scope` (§26, QA125), e il suo perimetro è
       Society-wide. */
    case
      when p.team_id is not null then p.team_name
      when p.scope = 'prima_squadra'   then 'Prima squadra'
      when p.scope = 'juniores'        then 'Juniores'
      when p.scope = 'under_17'        then 'Under 17'
      when p.scope = 'under_15'        then 'Under 15'
      else 'Intera società'
    end,
    p.entries,
    p.last_activity_at,
    case
      when (select count(*) from page) > v_limit and p.rn = v_limit
        then p.last_activity_at::text || '|' || p.id::text
    end
  from page p
  where p.rn <= v_limit
  order by p.rn;
end;
$$;

revoke all on function public.fetch_shortlist_custom_lists(uuid, integer, text) from public;
grant execute on function public.fetch_shortlist_custom_lists(uuid, integer, text) to authenticated;


-- ============================================================
-- SEZIONE 12 — lettura di una lista (§14, §23)
--
-- «Output: contesto autorizzato, numero reale di profili accessibili, entry
-- della pagina, azioni consentite, versione. La mancanza del contenitore
-- Position può essere rappresentata come lista vuota nel suo contesto, senza
-- forzare una creazione» (QA006, QA033).
-- ============================================================

/**
 * Contesto di una lista, indicata per id oppure per Position.
 *
 * Due parametri alternativi e non due funzioni: l'ingresso dal centro porta
 * l'id della lista, quello dal dominio Position porta l'id della Position, e
 * §25 chiede che «Un accesso dalla Position può raggiungere la medesima
 * lista anche vuota». Con `p_position_id` e nessun contenitore la funzione
 * restituisce una riga a zero — non ne crea uno.
 */
create or replace function public.fetch_shortlist_context(
  p_shortlist_id uuid default null,
  p_position_id  uuid default null
)
returns table (
  shortlist_id   uuid,
  club_id        uuid,
  list_type      text,
  position_id    uuid,
  title          text,
  scope_label    text,
  profiles_count bigint,
  is_closed      boolean,
  can_add_profiles    boolean,
  can_add_notes       boolean,
  can_edit_status     boolean,
  can_remove_profiles boolean,
  access_verified_at  timestamptz,
  data_revision       bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_list  public.club_shortlists%rowtype;
  v_ad    public.recruiting_ads%rowtype;
  v_team  uuid;
  v_club  uuid;
  v_caps  text[];
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  /* Alias obbligatorio: `position_id` è anche una colonna OUT di questa
     `returns table`, e in plpgsql una referenza non qualificata diventa
     «column reference is ambiguous» a runtime — l'errore che il repository
     ha già incontrato in `fetch_my_notification_preferences` e in
     `add_position_shortlist_entry`. */
  if p_shortlist_id is not null then
    select * into v_list from public.club_shortlists cs0 where cs0.id = p_shortlist_id;
  elsif p_position_id is not null then
    select * into v_list from public.club_shortlists cs0 where cs0.position_id = p_position_id;
  else
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  if v_list.id is null then
    /* Nessun contenitore: può ancora essere una Position legittima senza
       profili. §22 — «Contenuto non disponibile … senza divulgare il motivo
       preciso» per tutto il resto. */
    if p_position_id is null then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    select * into v_ad from public.recruiting_ads where id = p_position_id;

    if not found or v_ad.status = 'draft'
       or not public.society_position_in_scope(v_ad.club_id, v_ad.team_id, 'shortlist_view') then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    v_caps := public.dashboard_club_capabilities(v_ad.club_id);

    shortlist_id   := null;
    club_id        := v_ad.club_id;
    list_type      := 'position';
    position_id    := v_ad.id;
    title          := coalesce(
      nullif(btrim(v_ad.custom_role_name), ''),
      (select pr.label from public.position_roles pr where pr.id = v_ad.structured_role_id),
      nullif(btrim(v_ad.title), ''),
      'Posizione'
    );
    scope_label    := case
      when v_ad.position_scope_type = 'society' then 'Intera società'
      when v_ad.status = 'closed' then coalesce(
        v_ad.published_team_name,
        (select ct.name from public.club_teams ct where ct.id = v_ad.team_id)
      )
      else (select ct.name from public.club_teams ct where ct.id = v_ad.team_id)
    end;
    profiles_count := 0;
    is_closed      := v_ad.status = 'closed';
    can_add_profiles    := 'shortlist_add_profiles' = any (v_caps);
    can_add_notes       := 'shortlist_add_notes' = any (v_caps);
    can_edit_status     := 'shortlist_edit_status' = any (v_caps);
    can_remove_profiles := 'shortlist_remove_profiles' = any (v_caps);
    access_verified_at  := timezone('utc', now());
    data_revision       := 0;
    return next;

    return;
  end if;

  v_club := v_list.club_id;

  if v_list.list_type = 'position' then
    select * into v_ad from public.recruiting_ads where id = v_list.position_id;
    v_team := v_ad.team_id;
  else
    v_team := v_list.team_id;
  end if;

  if not public.society_position_in_scope(v_club, v_team, 'shortlist_view') then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  v_caps := public.dashboard_club_capabilities(v_club);

  shortlist_id := v_list.id;
  club_id      := v_club;
  list_type    := v_list.list_type;
  position_id  := v_list.position_id;
  title        := case
    when v_list.list_type = 'position' then coalesce(
      nullif(btrim(v_ad.custom_role_name), ''),
      (select pr.label from public.position_roles pr where pr.id = v_ad.structured_role_id),
      nullif(btrim(v_ad.title), ''),
      'Posizione'
    )
    else v_list.name
  end;
  scope_label := case
    when v_list.list_type = 'position' then case
      when v_ad.position_scope_type = 'society' then 'Intera società'
      when v_ad.status = 'closed' then coalesce(
        v_ad.published_team_name,
        (select ct.name from public.club_teams ct where ct.id = v_ad.team_id)
      )
      else (select ct.name from public.club_teams ct where ct.id = v_ad.team_id)
    end
    when v_list.team_id is not null then
      (select ct.name from public.club_teams ct where ct.id = v_list.team_id)
    when v_list.scope = 'prima_squadra' then 'Prima squadra'
    when v_list.scope = 'juniores'      then 'Juniores'
    when v_list.scope = 'under_17'      then 'Under 17'
    when v_list.scope = 'under_15'      then 'Under 15'
    else 'Intera società'
  end;
  profiles_count := (
    select count(*) from public.club_shortlist_entries e where e.shortlist_id = v_list.id
  );
  is_closed := v_list.list_type = 'position' and v_ad.status = 'closed';
  can_add_profiles    := 'shortlist_add_profiles' = any (v_caps);
  can_add_notes       := 'shortlist_add_notes' = any (v_caps);
  can_edit_status     := 'shortlist_edit_status' = any (v_caps);
  can_remove_profiles := 'shortlist_remove_profiles' = any (v_caps);
  access_verified_at  := timezone('utc', now());
  data_revision := (extract(epoch from v_list.last_activity_at) * 1000)::bigint;
  return next;
end;
$$;

revoke all on function public.fetch_shortlist_context(uuid, uuid) from public;
grant execute on function public.fetch_shortlist_context(uuid, uuid) to authenticated;

/**
 * Entry di una lista, riemessa con candidatura e origine (§14).
 *
 * Aggiunge `application_id`, `has_application`, `created_source` e
 * `revision` alle colonne del 20260717090200, e sposta l'autorizzazione dal
 * club-wide `has_club_permission` al perimetro reale.
 *
 * §22: «il riferimento application_id non concede automaticamente accesso al
 * dettaglio candidatura: verifica separatamente quel permesso. In tal caso
 * ometti metadata e link della candidatura non autorizzata; non inventare
 * l'affermazione "non si è candidato"» — da cui due campi distinti:
 * `has_application` (tri-stato tramite null) e `application_id`, che resta
 * nullo quando il metadata non è consultabile (QA057).
 */
drop function if exists public.fetch_shortlist_entries(uuid, int, int);

create or replace function public.fetch_shortlist_entries(
  p_shortlist_id uuid,
  p_limit        int default 100,
  p_offset       int default 0
)
returns table (
  id                    uuid,
  shortlist_id          uuid,
  player_profile_id     uuid,
  full_name             text,
  avatar_url            text,
  role                  text,
  primary_position      public.player_position,
  current_team          text,
  birth_year            integer,
  priority              text,
  evaluation_status     text,
  internal_note         text,
  added_by_profile_id   uuid,
  added_by_full_name    text,
  application_id        uuid,
  has_application       boolean,
  created_source        text,
  revision              integer,
  created_at            timestamptz,
  updated_at            timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_list      public.club_shortlists%rowtype;
  v_team      uuid;
  v_ad_team   uuid;
  v_can_apps  boolean;
  v_can_notes boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_list from public.club_shortlists cs0 where cs0.id = p_shortlist_id;

  if not found then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  if v_list.list_type = 'position' then
    select ad.team_id into v_ad_team from public.recruiting_ads ad where ad.id = v_list.position_id;
    v_team := v_ad_team;
  else
    v_team := v_list.team_id;
  end if;

  if not public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_view') then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  /* §22: due permessi distinti. Il metadata della candidatura richiede
     `applications_view` nel suo perimetro; la nota richiede
     `shortlist_add_notes` — §14: «Non caricare o mostrare note complete
     nella riga», e chi non può scriverle non le riceve nemmeno. */
  v_can_apps := public.society_position_in_scope(
    v_list.club_id, v_team, 'applications_view'
  );
  v_can_notes := public.society_position_in_scope(
    v_list.club_id, v_team, 'shortlist_add_notes'
  );

  return query
  select
    e.id,
    e.shortlist_id,
    e.player_profile_id,
    p.full_name,
    p.avatar_url,
    p.role::text,
    pp.primary_position,
    cl.name,
    case
      when p.birth_date is not null then extract(year from p.birth_date)::integer
    end,
    e.priority,
    e.evaluation_status,
    case when v_can_notes then e.internal_note end,
    e.added_by_profile_id,
    adder.full_name,
    case when v_can_apps then e.application_id end,
    /* §14: «eventuale informazione discreta sulla candidatura collegata» —
       il fatto, non il link, e solo a chi può vederlo. */
    case when v_can_apps then e.application_id is not null end,
    e.created_source,
    e.revision,
    e.created_at,
    e.updated_at
  from public.club_shortlist_entries e
  join public.profiles p on p.id = e.player_profile_id
  left join public.player_profiles pp on pp.profile_id = e.player_profile_id
  left join lateral (
    select c.name
    from public.club_members cm
    join public.clubs c on c.id = cm.club_id
    where cm.profile_id = e.player_profile_id
      and cm.is_current = true
      and cm.status = 'active'
    limit 1
  ) cl on true
  left join public.profiles adder on adder.id = e.added_by_profile_id
  where e.shortlist_id = p_shortlist_id
  order by e.created_at desc, e.id desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.fetch_shortlist_entries(uuid, int, int) from public;
grant execute on function public.fetch_shortlist_entries(uuid, int, int) to authenticated;


-- ============================================================
-- SEZIONE 13 — membership e stella (§15, §23)
--
-- «Restituisce separatamente l'appartenenza alla specifica Position e quella
-- ad almeno una lista accessibile della Society.» Sono due cose diverse e
-- §15 lo rende un requisito esplicito: «essere in una CUSTOM o nella lista
-- di un'altra posizione non deve trasformare erroneamente il suo pulsante in
-- In shortlist» (QA091, QA092).
--
-- «Supporta caricamenti efficienti per più profili quando la superficie lo
-- richiede; non effettuare una query pesante per ogni stella.»
-- ============================================================

create or replace function public.fetch_shortlist_membership(
  p_club_id     uuid,
  p_person_ids  uuid[],
  p_position_id uuid default null
)
returns table (
  person_id        uuid,
  in_any_list      boolean,
  in_position_list boolean
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

  if p_person_ids is null or array_length(p_person_ids, 1) is null then
    return;
  end if;

  return query
  select
    pid.id,
    exists (
      select 1
      from public.club_shortlist_entries e
      join public.club_shortlists cs on cs.id = e.shortlist_id
      left join public.recruiting_ads ad on ad.id = cs.position_id
      where cs.club_id = p_club_id
        and e.player_profile_id = pid.id
        /* §22: «La stella considera soltanto le appartenenze ammesse»
           (QA094). Il filtro è nella stessa query del conteggio, non un
           passaggio successivo nel client. */
        and public.society_position_in_scope(
          cs.club_id,
          case when cs.list_type = 'position' then ad.team_id else cs.team_id end,
          'shortlist_view'
        )
    ),
    case
      when p_position_id is null then false
      else exists (
        select 1
        from public.club_shortlist_entries e
        join public.club_shortlists cs on cs.id = e.shortlist_id
        join public.recruiting_ads ad on ad.id = cs.position_id
        where cs.club_id = p_club_id
          and cs.list_type = 'position'
          and cs.position_id = p_position_id
          and e.player_profile_id = pid.id
          and public.society_position_in_scope(cs.club_id, ad.team_id, 'shortlist_view')
      )
    end
  from unnest(p_person_ids) as pid(id);
end;
$$;

revoke all on function public.fetch_shortlist_membership(uuid, uuid[], uuid) from public;
grant execute on function public.fetch_shortlist_membership(uuid, uuid[], uuid) to authenticated;

comment on function public.fetch_shortlist_membership(uuid, uuid[], uuid) is
  'DAS-REV-24 §15, §23: stella (appartenenza a una qualsiasi lista '
  'accessibile della Society) e appartenenza alla lista di **quella** '
  'Position, separate. Batch, per non interrogare una stella alla volta.';


-- ============================================================
-- SEZIONE 14 — i consumatori esistenti sul core unico (§3, §26)
--
-- «I flussi di creazione CUSTOM, aggiunta da profilo, valutazione o
-- rimozione già esistenti devono continuare a funzionare usando il core
-- unico.»
-- ============================================================

/**
 * `fetch_club_shortlists` riemessa (§25, QA117).
 *
 * Due differenze rispetto al 20260717090200, entrambe richieste:
 *
 *   · restituisce **solo** le CUSTOM. È la funzione che alimenta il selector
 *     di aggiunta dal profilo, e §25 vieta di «presentare Position come
 *     destinazione»; il contenitore POSITION non è una lista che si sceglie;
 *   · filtra per perimetro, non per club (§22, QA085).
 *
 * `high_priority_count` resta nelle colonne OUT per compatibilità ma ora
 * conta soltanto le priorità realmente impostate: la priorità è nullable.
 */
drop function if exists public.fetch_club_shortlists(uuid, int, int);

create or replace function public.fetch_club_shortlists(
  p_club_id uuid,
  p_limit   int default 50,
  p_offset  int default 0
)
returns table (
  id                     uuid,
  club_id                uuid,
  name                   text,
  description            text,
  scope                  text,
  team_id                uuid,
  scope_label            text,
  entry_count            bigint,
  high_priority_count    bigint,
  created_by_profile_id  uuid,
  created_by_full_name   text,
  created_at             timestamptz,
  updated_at             timestamptz
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
    cs.id,
    cs.club_id,
    cs.name,
    cs.description,
    cs.scope,
    cs.team_id,
    case
      when cs.team_id is not null then ct.name
      when cs.scope = 'prima_squadra' then 'Prima squadra'
      when cs.scope = 'juniores'      then 'Juniores'
      when cs.scope = 'under_17'      then 'Under 17'
      when cs.scope = 'under_15'      then 'Under 15'
      else 'Intera società'
    end,
    count(e.id),
    count(e.id) filter (where e.priority = 'alta'),
    cs.created_by_profile_id,
    creator.full_name,
    cs.created_at,
    cs.updated_at
  from public.club_shortlists cs
  left join public.club_shortlist_entries e on e.shortlist_id = cs.id
  left join public.profiles creator on creator.id = cs.created_by_profile_id
  left join public.club_teams ct on ct.id = cs.team_id
  where cs.club_id = p_club_id
    and cs.list_type = 'custom'
    and public.society_position_in_scope(cs.club_id, cs.team_id, 'shortlist_view')
  group by cs.id, cs.club_id, cs.name, cs.description, cs.scope, cs.team_id,
           ct.name, cs.created_by_profile_id, creator.full_name,
           cs.created_at, cs.updated_at, cs.last_activity_at
  order by cs.last_activity_at desc, cs.id desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.fetch_club_shortlists(uuid, int, int) from public;
grant execute on function public.fetch_club_shortlists(uuid, int, int) to authenticated;

/**
 * `update_shortlist_entry` riemessa (§20).
 *
 * Due aggiunte alla versione del 20260717090200:
 *
 *   · il perimetro sostituisce il controllo club-wide;
 *   · `p_expected_revision` abilita il compare-and-set di §20 — «Una patch di
 *     nota concorrente non sovrascrive silenziosamente una revisione più
 *     recente» (QA061). Resta facoltativo: un chiamante che non lo manda ha
 *     il comportamento precedente, e nessun consumatore si rompe.
 *
 * `p_priority` accetta ora anche la cancellazione della priorità, con lo
 * stesso schema `p_set_*` già usato per la nota: §17 — «Dove il dato non è
 * utile, ometti la priorità assente invece di mostrare un warning.»
 */
drop function if exists public.update_shortlist_entry(uuid, text, text, boolean, text);

create or replace function public.update_shortlist_entry(
  p_entry_id           uuid,
  p_priority           text    default null,
  p_evaluation_status  text    default null,
  p_set_note           boolean default false,
  p_internal_note      text    default null,
  p_set_priority       boolean default false,
  p_expected_revision  integer default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid              uuid := auth.uid();
  v_entry            public.club_shortlist_entries%rowtype;
  v_status_changing  boolean;
  v_note_changing    boolean;
  v_next_priority    text;
  v_revision         integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_entry
  from public.club_shortlist_entries
  where id = p_entry_id
  for update;

  if not found then
    raise exception 'SHORTLIST_ENTRY_NOT_FOUND';
  end if;

  if not public.shortlist_in_scope(v_entry.shortlist_id, 'shortlist_view') then
    raise exception 'SHORTLIST_NOT_AUTHORIZED';
  end if;

  if p_expected_revision is not null
     and p_expected_revision is distinct from v_entry.revision then
    /* §30: «I dati sono cambiati. Aggiorna e riprova.» Il valore digitato
       non viene perso: il client lo conserva e decide (§20). */
    raise exception 'SHORTLIST_ENTRY_REVISION_STALE';
  end if;

  v_next_priority := case when p_set_priority then p_priority else v_entry.priority end;

  v_status_changing :=
    (v_next_priority is distinct from v_entry.priority)
    or (p_evaluation_status is not null
        and p_evaluation_status <> v_entry.evaluation_status);

  if v_status_changing
     and not public.shortlist_in_scope(v_entry.shortlist_id, 'shortlist_edit_status') then
    raise exception 'SHORTLIST_NOT_AUTHORIZED';
  end if;

  v_note_changing := p_set_note and (p_internal_note is distinct from v_entry.internal_note);

  if v_note_changing
     and not public.shortlist_in_scope(v_entry.shortlist_id, 'shortlist_add_notes') then
    raise exception 'SHORTLIST_NOT_AUTHORIZED';
  end if;

  if v_next_priority is not null and v_next_priority not in ('alta', 'media', 'bassa') then
    raise exception 'SHORTLIST_VALUE_INVALID';
  end if;

  if p_evaluation_status is not null and p_evaluation_status not in (
    'da_valutare', 'interessante', 'da_contattare', 'contattato',
    'non_prioritario', 'scartato'
  ) then
    raise exception 'SHORTLIST_VALUE_INVALID';
  end if;

  update public.club_shortlist_entries
  set
    priority          = v_next_priority,
    evaluation_status = coalesce(p_evaluation_status, evaluation_status),
    internal_note     = case when p_set_note then p_internal_note else internal_note end
  where id = p_entry_id
  returning revision into v_revision;

  return v_revision;
end;
$$;

revoke all on function public.update_shortlist_entry(uuid, text, text, boolean, text, boolean, integer) from public;
grant execute on function public.update_shortlist_entry(uuid, text, text, boolean, text, boolean, integer) to authenticated;


-- ============================================================
-- SEZIONE 15 — il dettaglio candidatura sul core unico (§13, §15)
--
-- `fetch_society_application_detail` viene riemessa dalla sua unica
-- definizione (20261102090000, mai ridefinita altrove — verificato prima di
-- toccarla) con due sole differenze, entrambe marcate nel corpo:
--
--   · `in_shortlist` legge il core invece della tabella fusa;
--   · `can_add_shortlist` usa il perimetro di `shortlist_add_profiles` e non
--     quello di `applications_view`.
--
-- Tutto il resto — contesto storico, snapshot di stagione, deadline,
-- messaggistica — resta parola per parola quello che era.
-- ============================================================

create or replace function public.fetch_society_application_detail(p_application_id uuid)
returns table (
  application_id       uuid,
  submission_revision  integer,
  status               text,
  latest_submitted_at  timestamptz,
  withdrawn_at         timestamptz,
  is_new               boolean,
  created_at           timestamptz,
  person_id            uuid,
  person_name          text,
  person_avatar_url    text,
  person_role          text,
  person_situation     text,
  club_id              uuid,
  club_name            text,
  club_logo_url        text,
  club_is_verified     boolean,
  ad_id                uuid,
  ad_status            text,
  ad_group             text,
  position_scope       text,
  team_id              uuid,
  team_label           text,
  role_label           text,
  target_role          text,
  season_label         text,
  receiving_closed     boolean,
  in_shortlist         boolean,
  can_add_shortlist    boolean,
  can_message          boolean,
  access_verified_at   timestamptz,
  data_revision        bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_ctx       record;
  v_caps      text[];
  v_app       public.recruiting_applications%rowtype;
  v_ad        public.recruiting_ads%rowtype;
  v_shortlist boolean;
  v_message   boolean;
  v_now       timestamptz := timezone('utc', now());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_ctx from public.society_application_context(p_application_id);

  if v_ctx.ad_id is null or not v_ctx.authorized then
    /* §25: lo stato generico non rivela se l'ID appartenga a un'altra
       Society né quale permesso manchi. Un codice solo per entrambi i casi. */
    raise exception 'APPLICATION_NOT_AVAILABLE';
  end if;

  select * into v_app from public.recruiting_applications where id = p_application_id;
  select * into v_ad  from public.recruiting_ads where id = v_ctx.ad_id;

  if v_ad.status = 'draft' then
    raise exception 'APPLICATION_NOT_AVAILABLE';
  end if;

  v_caps := public.dashboard_club_capabilities(v_ctx.club_id);

  /* §20: l'aggiunta richiede una capacità distinta dalla consultazione, e la
     candidatura ritirata non ne consente di nuove — «No da quella
     candidatura» (§24). CLOSED e deadline, da sole, non la bloccano. */
  /* DAS-REV-24 §5, §22: il perimetro e la capability dell'aggiunta, non
     quelli della lettura candidature. Prima era applications_view, e un
     actor con lettura ma senza shortlist_add_profiles nel proprio ambito
     vedeva un pulsante che il comando avrebbe rifiutato (QA042, QA080). */
  v_shortlist := public.society_position_in_scope(
      v_ctx.club_id, v_ctx.team_id, 'shortlist_add_profiles'
    )
    and v_app.status <> 'withdrawn';

  /*
   * §22: «Messaggio apre la DIRECT canonica fra la Society corrente e la
   * PERSON candidata, quando la capacità e le regole del sistema Messaggi lo
   * consentono», e «Non usare automaticamente la conversazione personale
   * dell'amministratore».
   *
   * Nel dominio Messaggi di questo repository una conversazione ha due
   * `profile_id` e non esiste una MessagingIdentity di Società: l'identità
   * della Società **è** il profilo proprietario del club. Un amministratore
   * che non sia quel profilo non ha, oggi, un modo di scrivere come Società —
   * e §22 vieta esplicitamente il fallback «scrivi come persona». L'azione
   * resta quindi nascosta per lui, invece di aprire la chat sbagliata.
   */
  v_message := exists (
    select 1
    from public.clubs cl
    where cl.id = v_ctx.club_id
      and cl.owner_profile_id = v_uid
  )
  and v_uid <> v_app.applicant_profile_id
  and not exists (
    select 1
    from public.user_blocks b
    where (b.blocker_profile_id = v_uid and b.blocked_profile_id = v_app.applicant_profile_id)
       or (b.blocker_profile_id = v_app.applicant_profile_id and b.blocked_profile_id = v_uid)
  );

  return query
  select
    v_app.id,
    v_app.submission_revision,
    v_app.status::text,
    v_app.latest_submitted_at,
    v_app.withdrawn_at,
    public.society_application_is_new(
      v_app.id, v_app.submission_revision, v_app.status, v_ad.status, v_uid
    ),
    v_app.created_at,
    prof.id,
    prof.full_name,
    prof.avatar_url,
    prof.role::text,
    public.profile_current_situation(prof.id),
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    v_ad.id,
    v_ad.status::text,
    public.society_position_group(v_ad.status),
    v_ad.position_scope_type,
    v_ad.team_id,
    /* §19: «Usa versioni/snapshot autorevoli già fissati alla pubblicazione
       della Position. Una rinomina della squadra non riscrive
       retroattivamente la ricerca.» */
    case
      when v_ad.position_scope_type = 'society' then 'Intera società'
      when v_ad.status = 'closed' then coalesce(v_ad.published_team_name, ct.name)
      else ct.name
    end,
    coalesce(
      nullif(btrim(v_ad.custom_role_name), ''),
      pr.label,
      nullif(btrim(v_ad.title), ''),
      'Posizione senza titolo'
    ),
    v_ad.target_role::text,
    case when v_ad.status = 'closed' then snap_season.label end,
    (v_ad.status = 'published'
      and v_ad.application_deadline_at is not null
      and v_now >= v_ad.application_deadline_at),
    /* DAS-REV-24 §15: soltanto la lista di **questa** Position. Essere in
       una CUSTOM o nella lista di un'altra posizione non rende In shortlist
       questo pulsante (QA091, QA092). Letto dal core unico; la vista
       position_shortlist_entries resta per i consumatori esterni. */
    exists (
      select 1
      from public.club_shortlist_entries e
      join public.club_shortlists cs on cs.id = e.shortlist_id
      where cs.list_type = 'position'
        and cs.position_id = v_ad.id
        and e.player_profile_id = v_app.applicant_profile_id
    ),
    v_shortlist,
    v_message,
    v_now,
    (extract(epoch from greatest(v_app.updated_at, v_ad.updated_at)) * 1000)::bigint
  from public.profiles prof
  join public.clubs c on c.id = v_ctx.club_id
  left join public.club_teams ct on ct.id = v_ad.team_id
  left join public.position_roles pr on pr.id = v_ad.structured_role_id
  left join public.seasons snap_season on snap_season.id = v_ad.published_season_id
  where prof.id = v_app.applicant_profile_id;
end;
$$;
revoke all on function public.fetch_society_application_detail(uuid) from public;
grant execute on function public.fetch_society_application_detail(uuid) to authenticated;

comment on function public.fetch_society_application_detail(uuid) is
  'DAS-REV-22 §15, §19, §26 + DAS-REV-24 §13, §15: contesto storico '
  'dell''invio, identità corrente e capacità reali. `in_shortlist` legge il '
  'core unico e riguarda soltanto la lista di questa Position.';
