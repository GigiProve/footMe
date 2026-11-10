-- ============================================================
-- DAS-REV-33 — Gruppi: periodi di appartenenza, finestra di accesso,
-- stato terminale, SYSTEM_EVENT e audit (fase DB-1: schema e accesso)
--
-- Cosa mancava, verificato sul repository dopo la 20261112090000 (M32):
--
--   · `conversation_participants` è una membership **corrente**: una riga
--     c'è o non c'è. Un reingresso non si distingue dal primo ingresso, la
--     storia degli ingressi e delle uscite non esiste, e §4 vieta di
--     cancellare la prova dei periodi (§16). Nessun «al massimo un periodo
--     attivo» è dichiarabile su una tabella che non ha periodi.
--   · Le policy di lettura dei messaggi (`is_conversation_participant`)
--     rispondono solo «sei partecipante?». Chi rientra in un gruppo leggerebbe
--     tutta la storia, anche quella di un periodo precedente (§17). Manca un
--     ordine server affidabile su cui fissare un confine: `sent_at` è l'ora di
--     inizio transazione e due righe della stessa transazione sono pari.
--   · I `messages` non possono rappresentare un evento di sistema: il mittente
--     è NOT NULL e `message_kind` non ha il valore. Il client non deve poter
--     scrivere testo impersonando il sistema (§24).
--   · `society_groups` ha `status` active/archived ma nessun momento, nessun
--     autore e nessuno stato terminale: §23 chiede un tombstone che nessun
--     comando possa riportare indietro.
--   · Nessun audit dei gruppi, e `society_group_operations` registra solo
--     «chiave → conversazione»: i comandi nuovi hanno bisogno dell'esito per
--     rispondere a un retry con lo stesso risultato (§25).
--   · La policy MES-01 «users can add themselves as participants» resta
--     aperta sui gruppi legacy e sulle dirette; la lettura delle righe
--     partecipante mostra ai co-membri ruolo, boundary e `last_read_at` di
--     tutti. Con i periodi, `access_from_seq` e `period_id` non devono
--     diventare un secondo canale per leggere la storia amministrativa (§16).
--   · La policy di UPDATE sui messaggi (20260309000001) lascia a un membro
--     modificare `body`/`media_url` o spostare un proprio messaggio in un'altra
--     conversazione; e un nuovo messaggio può citare il path di un allegato
--     precedente al reingresso: l'oggetto diventerebbe leggibile «dalla
--     finestra» pur appartenendo a un messaggio fuori finestra (§17).
--   · Il catalogo permessi non ha le chiavi per archiviare/riattivare/cambiare
--     Squadra (`groups_manage`) né per eliminare (`groups_delete`) (§5, §21,
--     §23). L'ADMIN interno non le acquisisce mai da solo (§5).
--
-- Scelte (§ = paragrafo della task):
--
--   1. **Periodi = tabella storia** (`society_group_membership_periods`).
--      `conversation_participants` resta la membership CORRENTE e porta
--      `period_id` + `access_from_seq`: riga presente = periodo attivo. Fine
--      periodo = riga periodo chiusa + DELETE della riga participant nella
--      stessa transazione; il reingresso crea un periodo nuovo e una riga
--      nuova (§16). L'invariante non è chiesta ai chiamanti: un trigger
--      BEFORE INSERT crea il periodo per ogni nuova riga di un gruppo, un
--      trigger BEFORE DELETE chiude quello attivo. «Un solo periodo attivo»
--      è un indice unico parziale. Un periodo chiuso è immutabile.
--   2. **Boundary = `messages.seq`**, sequenza dedicata assegnata
--      dall'INSERT (il trigger la riscrive sempre: il client non sceglie la
--      propria posizione). Backfill per `sent_at, id`. Un messaggio è
--      leggibile se `seq >= conversation_participants.access_from_seq`. La
--      sequence è assegnata all'insert, non al commit: l'unico errore
--      possibile è conservativo (un messaggio concorrente all'ingresso resta
--      nascosto), mai l'esposizione di storia. Ogni INSERT consuma due valori
--      (default + trigger): i buchi sono innocui, l'ordine è monotono.
--      Il confine è definito **una volta** in `conversation_access_from_seq`
--      (null = nessun accesso, 0 = nessun limite) ed è usato da RLS messaggi,
--      `get_conversation_messages`, Storage `chat-media`; Inbox lo legge dalla
--      stessa colonna perché ha già la riga participant in join.
--   3. **SYSTEM_EVENT** = `message_kind = 'system_event'`, mittente NULL
--      (consentito solo per questo tipo, vincolo CHECK), tipo/payload/chiave
--      di dedup in colonne proprie. Si inserisce solo dentro una finestra di
--      comando (GUC `society_groups.command`, stesso pattern di
--      `society_groups.creating`): un INSERT dal client è rifiutato dal
--      trigger, dalla RLS e dal CHECK. Gli eventi non contano negli unread e
--      non toccano l'archivio personale (§24, DoD-47).
--   4. **Stato**: `archived_at/by`, `deleted_at/by` su `society_groups`.
--      `deleted_at` non si azzera mai e lo stato cambia solo nella finestra
--      di comando. Ogni UPDATE incrementa `version` nel trigger: la versione
--      non dipende dalla disciplina dei comandi.
--   5. **Serializzazione dell'invio**: il trigger di INSERT su `messages`
--      prende `for share` sulla riga `society_groups` e verifica ACTIVE, non
--      eliminato e membership attiva del mittente; `seq` si assegna **dopo**
--      l'attesa del lock, così un invio che aspetta un archivio non riceve un
--      numero più basso dell'evento che lo segue. Archivia/elimina
--      (`for update` sulla stessa riga) e invio si serializzano al commit
--      (§23). Il gate vieta inoltre: un allegato la cui cartella non è la
--      conversazione o il cui path è già citato da un altro messaggio (una
--      rientrante non può «riagganciare» un file precedente alla propria
--      finestra; limite dichiarato: due invii concorrenti dello stesso path
--      non sono serializzati, il caso è un doppio tap dello stesso autore);
--      e, in UPDATE, il cambio di conversazione o mittente (ovunque) e di
--      `body`/`media_url`/tipo nei gruppi. Il percorso legittimo di UPDATE è
--      `read_at` (mark read, direct), che resta consentito. Gli errori sono `SOCIETY_GROUP_ARCHIVED`, `…_DELETED`,
--      `…_NOT_MEMBER`: il trigger scatta prima del controllo RLS, quindi il
--      client vede il codice e non un generico «violates row-level security».
--   6. **Chiusura dei bypass client**: la policy di auto-iscrizione è
--      **rimossa**: nessun client la usa (le direct nascono da RPC SECURITY
--      DEFINER: `open_direct_conversation`, `start_direct_conversation`) e
--      tenerla per le sole direct avrebbe richiesto un predicate eseguibile
--      dal client che rivela se un UUID è un gruppo. Le righe partecipante di
--      un gruppo operativo sono leggibili solo dal proprietario (la lista
--      persone passa dalla RPC dedicata, DB-2), con un predicate che risponde
--      false a chi non è partecipante (nessun oracolo di esistenza).
--      `is_conversation_participant` diventa falso per un gruppo eliminato.
--      `society_group_exists` e `conversation_is_group` non sono eseguibili dal
--      client.
--   7. **Catalogo revisione 7**: `groups_manage` e `groups_delete`, area
--      `groups`, scope team come `groups_create`. Backfill (decisione di
--      Luigi, 2026-11-10): `groups_manage` a chi ha già `groups_create`, con
--      lo stesso team_id, su righe effettive e ruoli; `groups_delete` NON è
--      backfillata. L'Owner le ha entrambe per costruzione, perché
--      `dashboard_club_capabilities` gli restituisce l'elenco intero.
--   8. **Dati dei 32 gruppi esistenti** (§29): in M32 l'unico ingresso era la
--      creazione, quindi ogni participant riceve un periodo con `joined_at` =
--      suo `joined_at`, `access_from_seq = 0` (c'era dalla creazione: nessun
--      accesso retroattivo inventato), `added_by` = creator del gruppo, ruolo
--      = `member_role`. I gruppi ACTIVE senza alcun ADMIN passano ad ARCHIVED
--      con audit `MIGRATION_RECONCILE`, senza promuovere nessuno e senza
--      SYSTEM_EVENT retroattivi. Rieseguibile: tutto è `if not exists` /
--      guard `where … is null`, il backfill dei permessi è condizionato alla
--      revisione del catalogo.
--   9. Realtime: il client **non legge** `society_group_membership_periods`
--      (porta attore di aggiunta/cessazione e motivo tecnico, §16/§28). Legge
--      `society_group_member_access`, proiezione grossolana mantenuta da un
--      trigger: `id` (= periodo), `conversation_id`, `profile_id`, `ended_at`,
--      `revoked_kind` ('ended' | 'deleted'; 'deleted' = gruppo eliminato,
--      qualunque altra fine = 'ended'). Si è scelta una tabella sorella e non i
--      grant per colonna perché Realtime consegna la riga intera della tabella
--      pubblicata: con una tabella che contiene solo colonne ammesse la
--      consegna non dipende dal supporto ai column privileges (non
--      verificabile in locale). La tabella entra nella publication
--      `supabase_realtime` solo se la publication esiste. Nessuna migrazione
--      precedente la gestisce (le tabelle vi sono state aggiunte dal
--      pannello Supabase): il do-block non può rompere un ambiente senza.
--
-- Funzioni riemesse, ciascuna dalla sua **ultima** definizione:
--   · is_conversation_participant        ← 20260718091000 (+ gruppo eliminato)
--   · messages_unarchive_after_insert    ← 20260718090600 (salta system_event)
--   · get_conversation_messages          ← 20260718090900 (left join mittente,
--                                          confine, +3 colonne: drop+create)
--   · fetch_inbox_conversations          ← 20261112090000 (confine, unread,
--                                          eliminati, +group_status: drop+create)
--   · fetch_group_conversation_meta      ← 20261112090000 (+stato, periodo)
--   · society_groups_guard               ← 20261112090000 (+terminale, versione)
--   · society_group_participant_guard    ← 20261112090000 (+periodi)
--   · dashboard_club_capabilities        ← 20261112090000 (+2 chiavi)
-- Policy riemesse: messages select/insert (ultima: 20260718090400 e
-- 20260309000001), conversation_participants select/insert (20260309000001),
-- storage.objects chat-media select/insert (20260718090900).
--
-- Rollback / compatibilità: le colonne nuove sono additive con default; il
-- client precedente continua a leggere `get_conversation_messages` e
-- `fetch_inbox_conversations` (colonne in coda). Un client che non conosce
-- `system_event` mostrerebbe una bolla con body vuoto: i SYSTEM_EVENT nascono
-- solo dai comandi di DB-2, quindi il rollout del client precede l'uso dei
-- comandi. Il rollback del solo schema richiede di rimuovere i comandi DB-2
-- prima di eliminare le colonne.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — finestra di comando e helper di stato
--
-- La finestra è un flag locale alla transazione sul conversation_id, come
-- `society_groups.creating` di M32 (che resta valido). I comandi di DB-2/DB-3
-- la aprono con society_group_window_open e la chiudono a fine corpo. Le
-- funzioni non sono eseguibili dal client: sono raggiungibili solo da altre
-- funzioni SECURITY DEFINER. `set_config` non è chiamabile via PostgREST.
-- ============================================================

create or replace function public.society_group_window_is_open(p_conversation_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_conversation_id is not null
     and p_conversation_id::text in (
       coalesce(current_setting('society_groups.creating', true), ''),
       coalesce(current_setting('society_groups.command',  true), '')
     );
$$;

create or replace function public.society_group_window_open(
  p_conversation_id uuid,
  p_end_reason      text default null
)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform set_config('society_groups.command', p_conversation_id::text, true);
  perform set_config('society_groups.end_reason', coalesce(p_end_reason, ''), true);
end;
$$;

create or replace function public.society_group_window_close()
returns void
language plpgsql
set search_path = public
as $$
begin
  perform set_config('society_groups.command', '', true);
  perform set_config('society_groups.end_reason', '', true);
end;
$$;

/** Per le policy: invoker non può leggere `society_groups` (RLS chiusa). */
create or replace function public.society_group_exists(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.society_groups g where g.conversation_id = p_conversation_id
  );
$$;

create or replace function public.conversation_is_group(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and c.conversation_type = 'group'
  );
$$;


-- ============================================================
-- SEZIONE 2 — stato e tombstone del gruppo (§21, §23)
-- ============================================================

alter table public.society_groups
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_at  timestamptz,
  add column if not exists deleted_by  uuid references public.profiles(id) on delete set null;

create index if not exists society_groups_deleted_idx
  on public.society_groups (deleted_at)
  where deleted_at is not null;

/* Prima del CHECK: un eventuale gruppo già archiviato a mano riceve il
   momento da `updated_at`, non una data inventata di oggi. Il guard lascia
   passare l'UPDATE perché lo stato non cambia. */
update public.society_groups
set archived_at = updated_at
where status = 'archived' and archived_at is null;

alter table public.society_groups
  drop constraint if exists society_groups_archived_consistent;

alter table public.society_groups
  add constraint society_groups_archived_consistent
  check ((status = 'archived') = (archived_at is not null));

/**
 * Riemessa da 20261112090000 (ultima definizione): stesse invarianti di
 * integrità, più
 *   · `deleted_at` non si azzera e lo stato di un gruppo eliminato non cambia
 *     (§23: nessun comando successivo ripristina l'accesso);
 *   · cambio di `status` e impostazione di `deleted_at` solo nella finestra di
 *     comando;
 *   · `archived_at` segue `status` (la riattivazione lo azzera);
 *   · `version` aumenta a ogni UPDATE, qualunque cosa abbia scritto il
 *     comando: l'optimistic concurrency non dipende da chi lo chiama.
 */
create or replace function public.society_groups_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window boolean := public.society_group_window_is_open(new.conversation_id);
begin
  if not exists (
    select 1 from public.conversations c
    where c.id = new.conversation_id and c.conversation_type = 'group'
  ) then
    raise exception 'SOCIETY_GROUP_INVALID:conversation_type';
  end if;

  if new.team_id is not null
     and (tg_op = 'INSERT' or new.team_id is distinct from old.team_id)
     and not exists (
       select 1 from public.club_teams t
       where t.id = new.team_id and t.club_id = new.club_id
     ) then
    raise exception 'SOCIETY_GROUP_INVALID:team_club';
  end if;

  if tg_op = 'UPDATE' then
    if new.club_id <> old.club_id then
      raise exception 'SOCIETY_GROUP_INVALID:club_immutable';
    end if;

    if old.deleted_at is not null
       and (new.deleted_at is distinct from old.deleted_at
            or new.status is distinct from old.status) then
      raise exception 'SOCIETY_GROUP_DELETED';
    end if;

    if (new.status is distinct from old.status
        or new.deleted_at is distinct from old.deleted_at)
       and not v_window then
      raise exception 'SOCIETY_GROUP_COMMAND_REQUIRED';
    end if;

    if new.status is distinct from old.status then
      if new.status = 'archived' then
        new.archived_at := coalesce(new.archived_at, timezone('utc', now()));
      else
        new.archived_at := null;
        new.archived_by := null;
      end if;
    end if;

    if new.deleted_at is not null and old.deleted_at is null then
      new.deleted_at := coalesce(new.deleted_at, timezone('utc', now()));
    end if;

    new.version := old.version + 1;
  end if;

  new.name_norm  := public.footme_normalize_lookup(new.name);
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.society_groups_guard() from public;


-- ============================================================
-- SEZIONE 3 — periodi di appartenenza (§4, §16)
-- ============================================================

create table if not exists public.society_group_membership_periods (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references public.conversations(id) on delete cascade,
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  /* Ruolo corrente del periodo; la storia dei ruoli è nell'audit. */
  member_role         text not null default 'member' check (member_role in ('admin', 'member')),
  joined_at           timestamptz not null default timezone('utc', now()),
  /* Confine server-side (§17): 0 = dalla creazione del gruppo. */
  access_from_seq     bigint not null default 0,
  ended_at            timestamptz,
  /* Motivi tecnici (§16): mai mostrati come codici nell'interfaccia. */
  end_reason          text check (end_reason in ('LEFT', 'REMOVED', 'SOCIETY_RELATION_ENDED', 'GROUP_DELETED')),
  added_by_profile_id uuid references public.profiles(id) on delete set null,
  ended_by_profile_id uuid references public.profiles(id) on delete set null,
  version             integer not null default 1,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now()),
  constraint society_group_periods_end_consistent
    check ((ended_at is null) = (end_reason is null)),
  constraint society_group_periods_end_after_join
    check (ended_at is null or ended_at >= joined_at)
);

/* §16: al massimo un periodo attivo per conversation_id + profile_id. */
create unique index if not exists society_group_periods_one_active_idx
  on public.society_group_membership_periods (conversation_id, profile_id)
  where ended_at is null;

create index if not exists society_group_periods_profile_idx
  on public.society_group_membership_periods (profile_id, conversation_id);

create index if not exists society_group_periods_conversation_idx
  on public.society_group_membership_periods (conversation_id, ended_at);

alter table public.society_group_membership_periods enable row level security;
revoke all on public.society_group_membership_periods from anon, authenticated;
/* Nessun accesso del client alla tabella dei periodi: contiene attore di
   aggiunta/cessazione e motivo tecnico. Il client legge la proiezione
   `society_group_member_access` (sotto). */
drop policy if exists "members read own membership periods" on public.society_group_membership_periods;

/**
 * Proiezione di accesso leggibile dal proprietario: alimenta il canale
 * realtime che revoca l'accesso (§26) senza esporre chi ha aggiunto o rimosso
 * né il motivo tecnico (§16, §28).
 */
create table if not exists public.society_group_member_access (
  id              uuid primary key references public.society_group_membership_periods(id) on delete cascade,
  conversation_id uuid not null,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  ended_at        timestamptz,
  revoked_kind    text check (revoked_kind in ('ended', 'deleted')),
  constraint society_group_member_access_consistent
    check ((ended_at is null) = (revoked_kind is null))
);

create index if not exists society_group_member_access_profile_idx
  on public.society_group_member_access (profile_id, conversation_id);

alter table public.society_group_member_access enable row level security;
revoke all on public.society_group_member_access from anon, authenticated;
grant select on public.society_group_member_access to authenticated;

drop policy if exists "members read own access state" on public.society_group_member_access;
create policy "members read own access state"
on public.society_group_member_access
for select
to authenticated
using (profile_id = auth.uid());

comment on table public.society_group_member_access is
  'DAS-REV-33 §16, §26: proiezione grossolana dei periodi (solo colonne '
  'ammesse). Scritta solo dal trigger dei periodi; il client la legge e vi si '
  'abbona via realtime.';

create or replace function public.society_group_member_access_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.society_group_member_access (id, conversation_id, profile_id, ended_at, revoked_kind)
    values (new.id, new.conversation_id, new.profile_id, new.ended_at,
            case when new.ended_at is null then null
                 when new.end_reason = 'GROUP_DELETED' then 'deleted' else 'ended' end)
    on conflict (id) do nothing;
  elsif new.ended_at is not null and old.ended_at is null then
    update public.society_group_member_access a
    set ended_at     = new.ended_at,
        revoked_kind = case when new.end_reason = 'GROUP_DELETED' then 'deleted' else 'ended' end
    where a.id = new.id;
  end if;

  return null;
end;
$$;

revoke all on function public.society_group_member_access_sync() from public, anon, authenticated;

drop trigger if exists society_group_member_access_sync on public.society_group_membership_periods;
create trigger society_group_member_access_sync
after insert or update on public.society_group_membership_periods
for each row execute function public.society_group_member_access_sync();

/* Rieseguibilità: periodi già presenti senza la proiezione. */
insert into public.society_group_member_access (id, conversation_id, profile_id, ended_at, revoked_kind)
select p.id, p.conversation_id, p.profile_id, p.ended_at,
       case when p.ended_at is null then null
            when p.end_reason = 'GROUP_DELETED' then 'deleted' else 'ended' end
from public.society_group_membership_periods p
on conflict (id) do nothing;

comment on table public.society_group_membership_periods is
  'DAS-REV-33 §16: storia delle membership dei gruppi operativi. Un periodo '
  'chiuso non si riapre; il reingresso ne crea uno nuovo. Un solo periodo '
  'attivo per conversazione e persona. Scritto solo dai trigger di '
  'conversation_participants e dai comandi del gruppo. Chiusa al client: '
  'si legge society_group_member_access.';

create or replace function public.society_group_periods_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.ended_at is not null then
    raise exception 'SOCIETY_GROUP_PERIOD_CLOSED';
  end if;

  if new.conversation_id <> old.conversation_id
     or new.profile_id <> old.profile_id
     or new.joined_at <> old.joined_at
     or new.access_from_seq <> old.access_from_seq then
    raise exception 'SOCIETY_GROUP_PERIOD_IMMUTABLE';
  end if;

  new.version    := old.version + 1;
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.society_group_periods_guard() from public;

drop trigger if exists society_group_periods_guard on public.society_group_membership_periods;
create trigger society_group_periods_guard
before update on public.society_group_membership_periods
for each row execute function public.society_group_periods_guard();

alter table public.conversation_participants
  add column if not exists period_id uuid references public.society_group_membership_periods(id),
  add column if not exists access_from_seq bigint not null default 0;

create unique index if not exists conversation_participants_period_idx
  on public.conversation_participants (period_id)
  where period_id is not null;

comment on column public.conversation_participants.access_from_seq is
  'DAS-REV-33 §17: confine di lettura. Un messaggio è visibile se '
  'messages.seq >= access_from_seq. 0 = nessun limite (dirette, gruppi legacy, '
  'membri dalla creazione). Immutabile fuori dai comandi del gruppo.';


-- ============================================================
-- SEZIONE 4 — audit e ricevute (§24, §25)
-- ============================================================

/**
 * Audit tecnico dei gruppi. Nessuna FK: sopravvive al tombstone e al cleanup
 * (§23: «audit e domain event restano separati»). `diff` porta solo dati
 * tecnici (ruoli, stati, conteggi, motivi): mai testo di messaggi, recapiti o
 * dati di profilo.
 */
create table if not exists public.society_group_audit (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null,
  club_id           uuid,
  /* null = azione di sistema (cessazione automatica, riconciliazione). */
  actor_profile_id  uuid,
  operation         text not null,
  target_profile_id uuid,
  period_id         uuid,
  version           integer,
  diff              jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default timezone('utc', now())
);

create index if not exists society_group_audit_conversation_idx
  on public.society_group_audit (conversation_id, created_at desc);

create index if not exists society_group_audit_target_idx
  on public.society_group_audit (target_profile_id, created_at desc)
  where target_profile_id is not null;

alter table public.society_group_audit enable row level security;
revoke all on public.society_group_audit from anon, authenticated;

comment on table public.society_group_audit is
  'DAS-REV-33 §24, §28: storia tecnica dei comandi sui gruppi. Chiusa al '
  'client; si consulta solo da strumenti di supporto con ruolo di servizio.';

create or replace function public.society_group_audit_record(
  p_conversation_id uuid,
  p_club_id         uuid,
  p_actor_id        uuid,
  p_operation       text,
  p_target_id       uuid,
  p_period_id       uuid,
  p_version         integer,
  p_diff            jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.society_group_audit
    (conversation_id, club_id, actor_profile_id, operation, target_profile_id,
     period_id, version, diff)
  values
    (p_conversation_id, p_club_id, p_actor_id, p_operation, p_target_id,
     p_period_id, p_version, coalesce(p_diff, '{}'::jsonb));
end;
$$;

/* Le ricevute di M32 registravano solo la create: l'esito dei comandi nuovi
   (§25) vive in `result`. Nullable: le ricevute esistenti restano valide. */
alter table public.society_group_operations
  add column if not exists result jsonb;

/**
 * Modellate su selection_event_operation_replay/record (20261108090000).
 * Stessa chiave + stessa intenzione = stesso esito registrato; stessa chiave
 * con attore, conversazione, operazione o contenuto diversi = conflitto.
 * Il chiamante **rivalida l'accesso corrente** prima di restituire (§25) e
 * apre il comando con `for update` sulla riga del gruppo, che serializza i
 * retry concorrenti sulla stessa risorsa.
 * Per le ricevute di create (result null) restituisce l'esito minimo.
 */
create or replace function public.society_group_operation_replay(
  p_key             text,
  p_conversation_id uuid,
  p_operation       text,
  p_fingerprint     text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.society_group_operations%rowtype;
begin
  if p_key is null or length(btrim(p_key)) = 0 then
    return null;
  end if;

  select * into v_row
  from public.society_group_operations o
  where o.idempotency_key = p_key;

  if not found then
    return null;
  end if;

  if v_row.actor_id is distinct from auth.uid()
     or v_row.conversation_id is distinct from p_conversation_id
     or v_row.operation is distinct from p_operation
     or v_row.fingerprint is distinct from p_fingerprint then
    raise exception 'OPERATION_CONTENT_CHANGED';
  end if;

  return coalesce(
    v_row.result,
    jsonb_build_object('conversation_id', v_row.conversation_id, 'replayed', true)
  );
end;
$$;

create or replace function public.society_group_operation_record(
  p_key             text,
  p_club_id         uuid,
  p_conversation_id uuid,
  p_operation       text,
  p_fingerprint     text,
  p_result          jsonb
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

  insert into public.society_group_operations
    (idempotency_key, actor_id, club_id, operation, fingerprint, conversation_id, result)
  values
    (p_key, auth.uid(), p_club_id, p_operation, p_fingerprint, p_conversation_id, p_result)
  on conflict (idempotency_key) do nothing;
end;
$$;


-- ============================================================
-- SEZIONE 5 — messaggi: ordine server, SYSTEM_EVENT, gate di invio (§17, §24)
-- ============================================================

create sequence if not exists public.messages_seq_seq;

alter table public.messages
  add column if not exists seq bigint,
  add column if not exists system_event_type text,
  add column if not exists system_payload jsonb,
  add column if not exists system_dedup_key text;

alter sequence public.messages_seq_seq owned by public.messages.seq;

/* La sequence è nel default della colonna: il ruolo che inserisce ha bisogno
   dell'USAGE. Sui progetti Supabase i default privileges lo darebbero già;
   qui è esplicito perché il confine di accesso dipende da questo valore. */
revoke all on sequence public.messages_seq_seq from public, anon;
grant usage, select on sequence public.messages_seq_seq to authenticated, service_role;

/* Backfill: ordine storico `sent_at, id`, dopo i valori eventualmente già
   assegnati (rieseguibile). */
do $$
declare
  v_base bigint;
  v_max  bigint;
  v_last bigint;
  v_called boolean;
begin
  select coalesce(max(seq), 0) into v_base from public.messages;

  with ordered as (
    select m.id, row_number() over (order by m.sent_at, m.id) as rn
    from public.messages m
    where m.seq is null
  )
  update public.messages m
  set seq = v_base + o.rn
  from ordered o
  where m.id = o.id;

  select coalesce(max(seq), 0) into v_max from public.messages;
  select s.last_value, s.is_called into v_last, v_called from public.messages_seq_seq s;

  /* La sequence non deve mai tornare indietro. */
  if v_max > 0 and (v_max > v_last or (v_max = v_last and not v_called)) then
    perform setval('public.messages_seq_seq', v_max, true);
  end if;
end
$$;

alter table public.messages
  alter column seq set default nextval('public.messages_seq_seq'),
  alter column seq set not null;

create unique index if not exists messages_seq_key
  on public.messages (seq);

create index if not exists messages_conversation_seq_idx
  on public.messages (conversation_id, seq);

/* Per la regola «un path allegato appartiene a un solo messaggio» del gate. */
create index if not exists messages_media_url_idx
  on public.messages (media_url)
  where media_url is not null;

/* §24: un evento di sistema non ha un autore PERSON. */
alter table public.messages
  alter column sender_profile_id drop not null;

alter table public.messages
  drop constraint if exists messages_message_kind_check;

alter table public.messages
  add constraint messages_message_kind_check
  check (message_kind in ('text', 'contact_card', 'image', 'video', 'document', 'system_event'));

alter table public.messages
  drop constraint if exists messages_system_event_shape;

alter table public.messages
  add constraint messages_system_event_shape
  check (
    (
      message_kind = 'system_event'
      and sender_profile_id is null
      and system_event_type in (
        'GROUP_MEMBER_ADDED', 'GROUP_MEMBERS_ADDED', 'GROUP_MEMBER_LEFT',
        'GROUP_MEMBER_REMOVED', 'GROUP_RENAMED', 'GROUP_ARCHIVED', 'GROUP_REACTIVATED'
      )
    )
    or (
      message_kind <> 'system_event'
      and sender_profile_id is not null
      and system_event_type is null
      and system_payload is null
      and system_dedup_key is null
    )
  );

/* Dedup (§24): lo stesso evento non si pubblica due volte, nemmeno dopo un
   retry o una redelivery. */
create unique index if not exists messages_system_dedup_key_idx
  on public.messages (conversation_id, system_dedup_key)
  where system_dedup_key is not null;

comment on column public.messages.seq is
  'DAS-REV-33 §17: ordine server affidabile, assegnato dal trigger di INSERT '
  '(mai dal client). Confine di accesso dei gruppi e ordine della timeline.';

/**
 * Gate di scrittura sui messaggi.
 *
 * INSERT
 *   · SYSTEM_EVENT: solo dentro la finestra di comando e solo in un gruppo
 *     operativo.
 *   · allegato: la cartella del path deve essere la conversazione e il path
 *     non può essere già citato da un altro messaggio (§17: un file di un
 *     periodo precedente non si «riaggancia»).
 *   · messaggio in un gruppo operativo: `for share` sulla riga del gruppo
 *     (serializza con archivia/elimina, che la prendono `for update`), poi
 *     ACTIVE, non eliminato, mittente con membership attiva.
 *   · `seq` è sempre riscritto, **dopo** l'eventuale attesa del lock.
 *   · direct e gruppi legacy: nessuna regola di stato nuova.
 * UPDATE
 *   · `seq` e i campi di sistema non si modificano; nessun messaggio diventa o
 *     smette di essere un evento.
 *   · conversazione e mittente non cambiano mai.
 *   · in un gruppo (operativo o legacy) `body` e `media_url` non si modificano.
 *   · `read_at` (mark read) resta libero.
 */
create or replace function public.messages_society_group_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status  text;
  v_deleted timestamptz;
  v_found   boolean;
begin
  if tg_op = 'UPDATE' then
    new.seq := old.seq;

    if new.message_kind is distinct from old.message_kind
       or new.system_event_type is distinct from old.system_event_type
       or new.system_payload is distinct from old.system_payload
       or new.system_dedup_key is distinct from old.system_dedup_key then
      raise exception 'SYSTEM_EVENT_COMMAND_REQUIRED';
    end if;

    if new.conversation_id is distinct from old.conversation_id
       or new.sender_profile_id is distinct from old.sender_profile_id then
      raise exception 'MESSAGE_IMMUTABLE';
    end if;

    if (new.body is distinct from old.body or new.media_url is distinct from old.media_url)
       and public.conversation_is_group(old.conversation_id) then
      raise exception 'SOCIETY_GROUP_MESSAGE_IMMUTABLE';
    end if;

    return new;
  end if;

  if new.message_kind = 'system_event' then
    new.seq := nextval('public.messages_seq_seq');

    if not public.society_group_window_is_open(new.conversation_id)
       or not exists (
         select 1 from public.society_groups g where g.conversation_id = new.conversation_id
       ) then
      raise exception 'SYSTEM_EVENT_COMMAND_REQUIRED';
    end if;

    return new;
  end if;

  if new.media_url is not null then
    if coalesce((storage.foldername(new.media_url))[1], '') <> new.conversation_id::text then
      raise exception 'MESSAGE_MEDIA_FOLDER_MISMATCH';
    end if;

    if exists (select 1 from public.messages m where m.media_url = new.media_url) then
      raise exception 'MESSAGE_MEDIA_ALREADY_REFERENCED';
    end if;
  end if;

  select g.status, g.deleted_at, true
  into v_status, v_deleted, v_found
  from public.society_groups g
  where g.conversation_id = new.conversation_id
  for share;

  if coalesce(v_found, false) then
    if v_deleted is not null then
      raise exception 'SOCIETY_GROUP_DELETED';
    end if;

    if v_status <> 'active' then
      raise exception 'SOCIETY_GROUP_ARCHIVED';
    end if;

    if not exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = new.conversation_id
        and cp.profile_id = new.sender_profile_id
    ) then
      raise exception 'SOCIETY_GROUP_NOT_MEMBER';
    end if;
  end if;

  /* Dopo il lock: un invio che ha aspettato un archivio/eliminazione non
     precede nell'ordine l'evento che il comando ha già scritto. */
  new.seq := nextval('public.messages_seq_seq');

  return new;
end;
$$;

revoke all on function public.messages_society_group_gate() from public;

drop trigger if exists messages_society_group_gate on public.messages;
create trigger messages_society_group_gate
before insert or update on public.messages
for each row execute function public.messages_society_group_gate();

/**
 * Riemessa da 20260718090600 (ultima definizione). Un messaggio nuovo riporta
 * in Inbox le conversazioni archiviate dal singolo utente; un SYSTEM_EVENT no:
 * l'archivio personale e quello globale sono distinti (§21, DoD-47) e un
 * evento non è «un messaggio nuovo».
 */
create or replace function public.messages_unarchive_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.message_kind = 'system_event' then
    return new;
  end if;

  update public.conversation_participants participant
  set archived_at = null
  where participant.conversation_id = new.conversation_id
    and participant.archived_at is not null;

  return new;
end;
$$;


-- ============================================================
-- SEZIONE 6 — membership: guard, periodo, chiusura (§16)
-- ============================================================

/**
 * Riemessa da 20261112090000 (ultima definizione).
 *
 * Conversazioni senza metadata di gruppo operativo (dirette, gruppi legacy):
 * comportamento di M32 invariato (nessun ADMIN autoassegnato); `period_id` e
 * `access_from_seq` restano neutri.
 *
 * Gruppo operativo:
 *   · insert, cambio di ruolo e cambio di periodo/boundary solo nella finestra
 *     di comando del gruppo;
 *   · INSERT: nasce il periodo attivo (o si adotta quello indicato, se valido)
 *     e la riga partecipante ne eredita il confine: nessun chiamante può
 *     dimenticare il periodo;
 *   · UPDATE del ruolo: il ruolo del periodo attivo lo segue;
 *   · nessuna identità MEDIA (invariato).
 * Gli aggiornamenti che non toccano identità/ruolo/periodo (`last_read_at`,
 * `archived_at`) passano, come in M32.
 */
create or replace function public.society_group_participant_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window boolean := public.society_group_window_is_open(new.conversation_id);
  v_is_sg  boolean := exists (
    select 1 from public.society_groups g where g.conversation_id = new.conversation_id
  );
  v_period public.society_group_membership_periods;
begin
  if not v_is_sg then
    if new.member_role = 'admin'
       and not v_window
       and (tg_op = 'INSERT' or new.member_role is distinct from old.member_role) then
      raise exception 'SOCIETY_GROUP_MEMBERSHIP_COMMAND_REQUIRED';
    end if;

    new.period_id       := null;
    new.access_from_seq := 0;
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.member_role is not distinct from old.member_role
     and new.conversation_id = old.conversation_id
     and new.profile_id = old.profile_id
     and new.period_id is not distinct from old.period_id
     and new.access_from_seq is not distinct from old.access_from_seq
     and new.joined_at is not distinct from old.joined_at then
    return new;
  end if;

  if not v_window then
    raise exception 'SOCIETY_GROUP_MEMBERSHIP_COMMAND_REQUIRED';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = new.profile_id and p.role::text = 'media'
  ) then
    raise exception 'SOCIETY_GROUP_INVALID:participant_kind';
  end if;

  if tg_op = 'INSERT' then
    if new.period_id is null then
      insert into public.society_group_membership_periods
        (conversation_id, profile_id, member_role, joined_at, access_from_seq, added_by_profile_id)
      values
        (new.conversation_id, new.profile_id, new.member_role, new.joined_at,
         coalesce(new.access_from_seq, 0), auth.uid())
      returning id into new.period_id;
    else
      select * into v_period
      from public.society_group_membership_periods p
      where p.id = new.period_id;

      if not found
         or v_period.conversation_id <> new.conversation_id
         or v_period.profile_id <> new.profile_id
         or v_period.ended_at is not null then
        raise exception 'SOCIETY_GROUP_INVALID:period';
      end if;

      new.access_from_seq := v_period.access_from_seq;
    end if;
  else
    if new.conversation_id <> old.conversation_id or new.profile_id <> old.profile_id then
      raise exception 'SOCIETY_GROUP_INVALID:participant_identity';
    end if;

    if new.member_role is distinct from old.member_role
       and new.period_id is not distinct from old.period_id
       and new.period_id is not null then
      update public.society_group_membership_periods p
      set member_role = new.member_role
      where p.id = new.period_id and p.ended_at is null;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.society_group_participant_guard() from public;

/**
 * Fine del periodo: ogni DELETE della riga partecipante di un gruppo chiude
 * il periodo attivo, con il motivo indicato dalla finestra di comando (default
 * REMOVED). Nessun raise: una cascata (account o conversazione eliminati) non
 * deve essere bloccata da un trigger di dominio.
 */
create or replace function public.society_group_participant_end()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.period_id is not null then
    update public.society_group_membership_periods p
    set ended_at            = timezone('utc', now()),
        end_reason          = coalesce(nullif(current_setting('society_groups.end_reason', true), ''), 'REMOVED'),
        ended_by_profile_id = auth.uid()
    where p.id = old.period_id and p.ended_at is null;
  end if;

  return old;
end;
$$;

revoke all on function public.society_group_participant_end() from public;

drop trigger if exists society_group_participant_end on public.conversation_participants;
create trigger society_group_participant_end
before delete on public.conversation_participants
for each row execute function public.society_group_participant_end();


-- ============================================================
-- SEZIONE 7 — accesso centrale (§17)
-- ============================================================

/**
 * Riemessa da 20260718091000 (ultima definizione): stessa semantica, e un
 * gruppo eliminato non ha più partecipanti agli occhi di nessuna policy
 * (§23), anche prima che il cleanup tolga le righe.
 */
create or replace function public.is_conversation_participant(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = target_conversation_id
      and participant.profile_id = auth.uid()
  )
  and not exists (
    select 1
    from public.society_groups g
    where g.conversation_id = target_conversation_id
      and g.deleted_at is not null
  );
$$;

/**
 * **Una sola regola** del confine di lettura (§17). Per l'utente corrente:
 *   · null → nessun accesso (non partecipante, gruppo eliminato);
 *   · 0    → nessun limite (diretta, gruppo legacy, membro dalla creazione);
 *   · n    → si leggono i messaggi con `seq >= n`.
 */
create or replace function public.conversation_access_from_seq(p_conversation_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select case when g.deleted_at is not null then null else cp.access_from_seq end
  from public.conversation_participants cp
  left join public.society_groups g on g.conversation_id = cp.conversation_id
  where cp.conversation_id = p_conversation_id
    and cp.profile_id = auth.uid();
$$;

/**
 * Per la policy delle righe partecipante: partecipante e conversazione senza
 * metadata di gruppo operativo. Risponde false a chi non è partecipante, quindi
 * non rivela se un UUID è un gruppo.
 */
create or replace function public.conversation_peers_visible(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_conversation_participant(p_conversation_id)
     and not exists (
       select 1 from public.society_groups g where g.conversation_id = p_conversation_id
     );
$$;

/** Invio consentito: partecipante, e se è un gruppo operativo ACTIVE e non eliminato. */
create or replace function public.conversation_can_send(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
           select 1 from public.conversation_participants cp
           where cp.conversation_id = p_conversation_id and cp.profile_id = auth.uid()
         )
     and coalesce((
           select g.deleted_at is null and g.status = 'active'
           from public.society_groups g
           where g.conversation_id = p_conversation_id
         ), true);
$$;

/**
 * Lettura di un oggetto `chat-media` (§17). Nei gruppi operativi l'oggetto è
 * leggibile se un messaggio **nella finestra del periodo corrente** lo
 * referenzia, oppure se è un upload dell'utente non ancora collegato a nessun
 * messaggio (anteprima prima dell'invio). Un oggetto allegato a un messaggio
 * precedente al reingresso non si legge nemmeno conoscendone il path. Dirette e
 * gruppi legacy: comportamento invariato (partecipante della cartella).
 */
create or replace function public.chat_media_readable(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_conv uuid;
  v_from bigint;
begin
  begin
    v_conv := (storage.foldername(p_name))[1]::uuid;
  exception when others then
    return false;
  end;

  v_from := public.conversation_access_from_seq(v_conv);

  if v_from is null then
    return false;
  end if;

  if not public.society_group_exists(v_conv) then
    return true;
  end if;

  if exists (
    select 1 from public.messages m
    where m.conversation_id = v_conv
      and m.media_url = p_name
      and m.seq >= v_from
  ) then
    return true;
  end if;

  return exists (
           select 1 from storage.objects o
           where o.bucket_id = 'chat-media'
             and o.name = p_name
             and o.owner_id = auth.uid()::text
         )
     and not exists (
           select 1 from public.messages m
           where m.conversation_id = v_conv and m.media_url = p_name
         );
end;
$$;

/* Policy: le funzioni devono essere eseguibili dal ruolo che le valuta. */
revoke all on function public.conversation_access_from_seq(uuid) from public, anon;
revoke all on function public.conversation_can_send(uuid) from public, anon;
revoke all on function public.chat_media_readable(text) from public, anon;
revoke all on function public.society_group_exists(uuid) from public, anon, authenticated;
revoke all on function public.conversation_is_group(uuid) from public, anon, authenticated;
revoke all on function public.conversation_peers_visible(uuid) from public, anon;
grant execute on function public.conversation_access_from_seq(uuid) to authenticated;
grant execute on function public.conversation_can_send(uuid) to authenticated;
grant execute on function public.chat_media_readable(text) to authenticated;
grant execute on function public.conversation_peers_visible(uuid) to authenticated;

/* Funzioni interne: solo per altre funzioni SECURITY DEFINER e trigger. `revoke
   from public` non chiude `anon` né `authenticated` (default privileges di
   Supabase): vanno revocati per nome. */
revoke all on function public.society_group_window_is_open(uuid) from public, anon, authenticated;
revoke all on function public.society_group_window_open(uuid, text) from public, anon, authenticated;
revoke all on function public.society_group_window_close() from public, anon, authenticated;
revoke all on function public.society_group_audit_record(uuid, uuid, uuid, text, uuid, uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.society_group_operation_replay(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.society_group_operation_record(text, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.society_group_periods_guard() from anon, authenticated;
revoke all on function public.messages_society_group_gate() from anon, authenticated;
revoke all on function public.society_group_participant_guard() from anon, authenticated;
revoke all on function public.society_group_participant_end() from anon, authenticated;
revoke all on function public.society_groups_guard() from anon, authenticated;
/* Helper di M32 che il solo `revoke from public` lasciava eseguibili. */
revoke all on function public.society_group_person_eligible(uuid, uuid) from anon, authenticated;
revoke all on function public.society_group_person_visible(uuid, uuid, uuid[]) from anon, authenticated;
revoke all on function public.society_group_person_in_team(uuid, uuid, uuid) from anon, authenticated;
revoke all on function public.society_group_admin_visible(uuid) from anon, authenticated;
revoke all on function public.society_group_cursor_encode(jsonb) from anon, authenticated;
revoke all on function public.society_group_cursor_decode(text) from anon, authenticated;
revoke all on function public.messages_no_contact_card_in_group() from anon, authenticated;

-- RLS messaggi ---------------------------------------------------------

/* Riemessa da 20260309000001: oltre alla membership, il confine del periodo. */
drop policy if exists "messages visible to conversation participants" on public.messages;
create policy "messages visible to conversation participants"
on public.messages
for select
to authenticated
using (
  public.is_conversation_participant(conversation_id)
  and seq >= public.conversation_access_from_seq(conversation_id)
);

/* Riemessa da 20260718090400 (ultima definizione, con il blocco utenti):
   invio solo dove il gruppo è ACTIVE e mai un SYSTEM_EVENT dal client. */
drop policy if exists "participants can send messages" on public.messages;
create policy "participants can send messages"
on public.messages
for insert
to authenticated
with check (
  public.is_conversation_participant(conversation_id)
  and public.is_current_user(sender_profile_id)
  and message_kind <> 'system_event'
  and public.conversation_can_send(conversation_id)
  and not public.is_direct_conversation_blocked(conversation_id)
);

-- RLS partecipanti -----------------------------------------------------

/* Riemessa da 20260309000001. In un gruppo operativo ognuno legge solo la
   propria riga: boundary, ruolo e `last_read_at` degli altri non sono un
   canale (§16); la lista persone passerà dalla RPC dedicata. */
drop policy if exists "participant rows visible to conversation members" on public.conversation_participants;
create policy "participant rows visible to conversation members"
on public.conversation_participants
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.conversation_peers_visible(conversation_id)
);

/* Policy di auto-iscrizione (20260309000001) rimossa: nessun client la usa (le
   direct nascono da RPC SECURITY DEFINER) e un ID non è un token di accesso
   (§26). Nessuna policy di INSERT/UPDATE/DELETE: i client non iscrivono, non
   cambiano ruoli, non tolgono righe. Chiude anche l'auto-iscrizione alle
   direct (limite preesistente). */
drop policy if exists "users can add themselves as participants" on public.conversation_participants;

-- Storage chat-media ---------------------------------------------------

/* Riemessa da 20260718090900. */
drop policy if exists "chat media readable by participants" on storage.objects;
create policy "chat media readable by participants"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-media'
  and public.chat_media_readable(name)
);

/* Riemessa da 20260718090900: in un gruppo archiviato o eliminato non si
   carica nulla (§21: «impedisce nuovi messaggi»). */
drop policy if exists "chat media upload by participants" on storage.objects;
create policy "chat media upload by participants"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-media'
  and public.is_conversation_participant(((storage.foldername(name))[1])::uuid)
  and public.conversation_can_send(((storage.foldername(name))[1])::uuid)
  and not public.is_direct_conversation_blocked(((storage.foldername(name))[1])::uuid)
);


-- ============================================================
-- SEZIONE 8 — letture conversazionali (§17, §24)
-- ============================================================

/**
 * Riemessa da 20260718090900 (ultima definizione). Cambia:
 *   · il mittente è LEFT JOIN: un SYSTEM_EVENT non ha PERSON;
 *   · il confine del periodo (`conversation_access_from_seq`, null = nessun
 *     accesso → nessuna riga);
 *   · ordine per `seq`, coerente con il confine;
 *   · tre colonne in coda: tipo e payload dell'evento, `seq`.
 * Resta SECURITY INVOKER: la RLS dei messaggi si applica comunque.
 */
drop function if exists public.get_conversation_messages(uuid);

create or replace function public.get_conversation_messages(target_conversation_id uuid)
returns table (
  message_id uuid,
  body text,
  sent_at timestamptz,
  read_at timestamptz,
  sender_profile_id uuid,
  sender_full_name text,
  message_kind text,
  shared_contact_name text,
  shared_contact_phone text,
  media_url text,
  system_event_type text,
  system_payload jsonb,
  seq bigint
)
language sql
stable
as $$
  select
    message.id as message_id,
    message.body,
    message.sent_at,
    message.read_at,
    message.sender_profile_id,
    sender_profile.full_name as sender_full_name,
    message.message_kind,
    message.shared_contact_name,
    message.shared_contact_phone,
    message.media_url,
    message.system_event_type,
    message.system_payload,
    message.seq
  from public.messages message
  left join public.profiles sender_profile on sender_profile.id = message.sender_profile_id
  where message.conversation_id = target_conversation_id
    and message.seq >= (select public.conversation_access_from_seq(target_conversation_id))
  order by message.seq asc;
$$;

revoke all on function public.get_conversation_messages(uuid) from public, anon;
grant execute on function public.get_conversation_messages(uuid) to authenticated;

/**
 * Riemessa da 20261112090000 (ultima definizione). Cambia:
 *   · anteprima e unread nel confine del periodo (`access_from_seq` della riga
 *     partecipante, la stessa che legge `conversation_access_from_seq`);
 *   · i SYSTEM_EVENT non contano negli unread (§24); l'anteprima può
 *     mostrarli, il client la formatta dal payload;
 *   · i gruppi eliminati non compaiono;
 *   · una colonna in coda, `group_status` ('active' | 'archived', null per le
 *     non-gruppo e i gruppi legacy): signature di ritorno cambiata.
 * Ordine, archivio personale e unread restano quelli del core.
 */
drop function if exists public.fetch_inbox_conversations(int, int, boolean);

create or replace function public.fetch_inbox_conversations(
  p_limit             int default 50,
  p_offset            int default 0,
  p_include_archived  boolean default false
)
returns table (
  conversation_id                uuid,
  conversation_type              text,
  display_title                  text,
  avatar_url                     text,
  other_profile_id               uuid,
  participant_count              integer,
  last_message_body              text,
  last_message_kind              text,
  last_message_sent_at           timestamptz,
  last_message_sender_profile_id uuid,
  last_message_sender_name       text,
  unread_count                   bigint,
  archived                       boolean,
  blocked_by_me                  boolean,
  group_avatar_path              text,
  group_status                   text
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
    c.id                                                            as conversation_id,
    c.conversation_type,
    coalesce(c.title, other_profile.full_name, 'Conversazione')      as display_title,
    coalesce(c.avatar_url, other_profile.avatar_url)                 as avatar_url,
    other_profile.id                                                 as other_profile_id,
    participant_summary.participant_count,
    last_message.body                                                as last_message_body,
    last_message.message_kind                                        as last_message_kind,
    last_message.sent_at                                             as last_message_sent_at,
    last_message.sender_profile_id                                   as last_message_sender_profile_id,
    last_message_sender.full_name                                    as last_message_sender_name,
    coalesce(unread_summary.unread_count, 0)                         as unread_count,
    (my_participant.archived_at is not null)                         as archived,
    exists (
      select 1
      from public.user_blocks block_row
      where block_row.blocker_profile_id = v_uid
        and block_row.blocked_profile_id = other_profile.id
    )                                                                 as blocked_by_me,
    group_info.storage_path                                          as group_avatar_path,
    group_info.status                                                as group_status
  from public.conversation_participants my_participant
  join public.conversations c
    on c.id = my_participant.conversation_id
  left join lateral (
    select p2.id, p2.full_name, p2.avatar_url
    from public.conversation_participants other_participant
    join public.profiles p2 on p2.id = other_participant.profile_id
    where other_participant.conversation_id = c.id
      and other_participant.profile_id <> v_uid
    limit 1
  ) other_profile on c.conversation_type = 'direct'
  left join lateral (
    select count(*)::integer as participant_count
    from public.conversation_participants cp2
    where cp2.conversation_id = c.id
  ) participant_summary on true
  left join lateral (
    select m.body, m.message_kind, m.sent_at, m.sender_profile_id
    from public.messages m
    where m.conversation_id = c.id
      and m.seq >= my_participant.access_from_seq
    order by m.seq desc
    limit 1
  ) last_message on true
  left join public.profiles last_message_sender
    on last_message_sender.id = last_message.sender_profile_id
  left join lateral (
    select count(*)::bigint as unread_count
    from public.messages m
    where m.conversation_id = c.id
      and m.message_kind <> 'system_event'
      and m.sender_profile_id <> v_uid
      and m.seq >= my_participant.access_from_seq
      and m.sent_at > coalesce(my_participant.last_read_at, '-infinity'::timestamptz)
  ) unread_summary on true
  left join lateral (
    select a.storage_path, g.status
    from public.society_groups g
    left join public.society_group_avatar_assets a on a.id = g.avatar_asset_id
    where g.conversation_id = c.id
  ) group_info on c.conversation_type = 'group'
  where my_participant.profile_id = v_uid
    and (p_include_archived or my_participant.archived_at is null)
    and not exists (
      select 1 from public.society_groups gd
      where gd.conversation_id = c.id and gd.deleted_at is not null
    )
  order by coalesce(last_message.sent_at, c.created_at) desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.fetch_inbox_conversations(int, int, boolean) from public, anon;
grant execute on function public.fetch_inbox_conversations(int, int, boolean) to authenticated;

/**
 * Riemessa da 20261112090000 (ultima definizione). Aggiunge stato del gruppo,
 * periodo corrente e confine; distingue, solo per chi ha avuto un periodo, un
 * gruppo eliminato (`SOCIETY_GROUP_DELETED`) da una membership terminata
 * (`SOCIETY_GROUP_NOT_MEMBER`). Per gli altri resta l'errore anonimo: un ID
 * non rivela l'esistenza del gruppo (§26).
 */
create or replace function public.fetch_group_conversation_meta(p_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_role    text;
  v_period  uuid;
  v_from    bigint;
  v_pver    integer;
  v_deleted boolean;
  v_row     record;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1 from public.society_groups g
    where g.conversation_id = p_conversation_id and g.deleted_at is not null
  ) into v_deleted;

  if not v_deleted then
    select cp.member_role, cp.period_id, cp.access_from_seq, per.version
    into v_role, v_period, v_from, v_pver
    from public.conversation_participants cp
    join public.conversations c on c.id = cp.conversation_id
    left join public.society_group_membership_periods per on per.id = cp.period_id
    where cp.conversation_id = p_conversation_id
      and cp.profile_id = v_uid
      and c.conversation_type = 'group';
  end if;

  if v_role is null then
    if exists (
      select 1 from public.society_group_membership_periods per
      where per.conversation_id = p_conversation_id and per.profile_id = v_uid
    ) then
      raise exception '%', case when v_deleted then 'SOCIETY_GROUP_DELETED' else 'SOCIETY_GROUP_NOT_MEMBER' end;
    end if;

    raise exception 'Conversazione non trovata';
  end if;

  select c.title, c.avatar_url, g.name, g.club_id, g.status, g.version as group_version,
         cl.name as club_name, a.storage_path as avatar_path
  into v_row
  from public.conversations c
  left join public.society_groups g on g.conversation_id = c.id
  left join public.clubs cl on cl.id = g.club_id
  left join public.society_group_avatar_assets a on a.id = g.avatar_asset_id
  where c.id = p_conversation_id;

  return jsonb_build_object(
    'conversation_id', p_conversation_id,
    'title',           coalesce(v_row.name, v_row.title, 'Gruppo'),
    'avatar_url',      v_row.avatar_url,
    'avatar_path',     v_row.avatar_path,
    'club_name',       v_row.club_name,
    'people_count',    (select count(*) from public.conversation_participants cp
                         where cp.conversation_id = p_conversation_id),
    'my_role',         v_role,
    /* Gruppo legacy senza metadata: sempre attivo, senza periodo. */
    'status',          coalesce(v_row.status, 'active'),
    'can_send',        coalesce(v_row.status, 'active') = 'active',
    'group_version',   v_row.group_version,
    'period_id',       v_period,
    'period_version',  v_pver,
    'access_from_seq', v_from
  );
end;
$$;

revoke all on function public.fetch_group_conversation_meta(uuid) from public, anon;
grant execute on function public.fetch_group_conversation_meta(uuid) to authenticated;


-- ============================================================
-- SEZIONE 9 — catalogo permessi, revisione 7 (§5, §21, §23)
--
-- `groups_manage`: archivia, riattiva, recupera, cambia Squadra, gestione
-- amministrativa fuori dalla membership. `groups_delete`: elimina. Entrambe
-- nello scope team di `groups_create` (stessa area). Nessuna delle due è
-- implicata da un ruolo interno ADMIN (§5).
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
    'selection_events_manage',
    'selection_events_participants_view',
    'selection_events_invite',
    'groups_view',
    'groups_create',
    'groups_manage',
    'groups_delete'
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
    'selection_events_manage',
    'selection_events_participants_view',
    'selection_events_invite',
    'groups_view',
    'groups_create',
    'groups_manage',
    'groups_delete'
  ));

insert into public.club_permission_controls
  (id, area_id, label, helper, bundle, requires, sort_order, is_available) values
  ('groups_manage', 'groups', 'Gestisci gruppi',
     'Necessario per visualizzare i gruppi',
     'manage', array['groups_read'], 3, true),
  ('groups_delete', 'groups', 'Elimina gruppi',
     'Necessario per visualizzare i gruppi',
     'manage', array['groups_read'], 4, true)
on conflict (id) do update
  set area_id      = excluded.area_id,
      label        = excluded.label,
      helper       = excluded.helper,
      bundle       = excluded.bundle,
      requires     = excluded.requires,
      sort_order   = excluded.sort_order,
      is_available = excluded.is_available;

insert into public.club_permission_control_keys (control_id, permission_key) values
  ('groups_manage', 'groups_manage'),
  ('groups_delete', 'groups_delete')
on conflict do nothing;

/* Backfill condizionato alla revisione: rieseguire la migrazione non
   restituisce `groups_manage` a chi se l'è visto togliere dopo. `groups_delete`
   non si backfilla mai (decisione di Luigi, 2026-11-10): solo grant esplicito
   dall'editor ruoli. Stessa forma di M32: ruoli e righe effettive, stesso
   team_id. */
do $$
begin
  if coalesce((select (value #>> '{}')::int from public.app_policy_settings
               where key = 'admin_permission_catalog_revision'), 0) < 7 then
    insert into public.club_admin_role_permissions (role_id, permission_key)
    select rp.role_id, 'groups_manage'
    from public.club_admin_role_permissions rp
    where rp.permission_key = 'groups_create'
    on conflict do nothing;

    insert into public.club_member_permissions
      (club_id, profile_id, permission_key, team_id, granted_by_profile_id)
    select perm.club_id, perm.profile_id, 'groups_manage', perm.team_id, perm.granted_by_profile_id
    from public.club_member_permissions perm
    where perm.permission_key = 'groups_create'
    on conflict do nothing;
  end if;
end
$$;

insert into public.app_policy_settings (key, value, description)
values (
  'admin_permission_catalog_revision',
  to_jsonb(7),
  'DAS-REV-14 §7 — revisione della tassonomia aree/controlli/chiavi. Va '
  'incrementata da ogni migrazione che cambia il catalogo.'
)
on conflict (key) do update set value = to_jsonb(7);

/* Riscritta da 20261112090000 (ultima definizione) con `groups_manage` e
   `groups_delete` in entrambe le whitelist. Nessun'altra differenza. */
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
      'selection_events_manage',
      'selection_events_participants_view',
      'selection_events_invite',
      'groups_view',
      'groups_create',
      'groups_manage',
      'groups_delete'
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
            'selection_events_manage',
            'selection_events_participants_view',
            'selection_events_invite',
            'groups_view',
            'groups_create',
            'groups_manage',
            'groups_delete'
          )
      ),
      array[]::text[]
    )
  end;
$$;

revoke all on function public.dashboard_club_capabilities(uuid) from public;
grant execute on function public.dashboard_club_capabilities(uuid) to authenticated;


-- ============================================================
-- SEZIONE 10 — dati dei gruppi esistenti (§29)
--
-- 1. Un periodo per ogni partecipante attuale, senza accesso retroattivo
--    inventato (`access_from_seq = 0`: erano presenti dalla creazione) e senza
--    date inventate (`joined_at` della riga).
-- 2. I gruppi ACTIVE senza alcun ADMIN passano ad ARCHIVED con audit; nessuna
--    promozione, nessun SYSTEM_EVENT retroattivo.
-- ============================================================

do $$
declare
  r         record;
  v_version integer;
begin
  for r in
    select distinct cp.conversation_id
    from public.conversation_participants cp
    join public.society_groups g on g.conversation_id = cp.conversation_id
    where cp.period_id is null
  loop
    perform public.society_group_window_open(r.conversation_id);

    insert into public.society_group_membership_periods
      (conversation_id, profile_id, member_role, joined_at, access_from_seq, added_by_profile_id)
    select cp.conversation_id, cp.profile_id, cp.member_role, cp.joined_at, 0, g.created_by
    from public.conversation_participants cp
    join public.society_groups g on g.conversation_id = cp.conversation_id
    where cp.conversation_id = r.conversation_id
      and cp.period_id is null
      and not exists (
        select 1 from public.society_group_membership_periods p
        where p.conversation_id = cp.conversation_id
          and p.profile_id = cp.profile_id
          and p.ended_at is null
      );

    update public.conversation_participants cp
    set period_id = p.id
    from public.society_group_membership_periods p
    where cp.conversation_id = r.conversation_id
      and cp.period_id is null
      and p.conversation_id = cp.conversation_id
      and p.profile_id = cp.profile_id
      and p.ended_at is null;
  end loop;

  for r in
    select g.conversation_id, g.club_id
    from public.society_groups g
    where g.status = 'active'
      and g.deleted_at is null
      and not exists (
        select 1 from public.conversation_participants cp
        where cp.conversation_id = g.conversation_id and cp.member_role = 'admin'
      )
  loop
    perform public.society_group_window_open(r.conversation_id);

    update public.society_groups g
    set status = 'archived'
    where g.conversation_id = r.conversation_id
    returning g.version into v_version;

    perform public.society_group_audit_record(
      r.conversation_id, r.club_id, null, 'MIGRATION_RECONCILE', null, null, v_version,
      jsonb_build_object('from', 'active', 'to', 'archived', 'reason', 'NO_ADMIN'));
  end loop;

  perform public.society_group_window_close();
end
$$;


-- ============================================================
-- SEZIONE 11 — realtime (§26)
--
-- Nessuna migrazione del repository gestisce `supabase_realtime`: l'elenco
-- delle tabelle pubblicate vive nel progetto. Si aggiunge la sola proiezione di
-- accesso (non i periodi: sono chiusi al client), e solo se la publication esiste.
-- ============================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'society_group_member_access'
     ) then
    alter publication supabase_realtime add table public.society_group_member_access;
  end if;
end
$$;
