-- DAS-REV-23 — Lifecycle e permessi Candidature
--
-- DAS-REV-22 ha costruito la submission corrente (`latest_submitted_at`,
-- `submission_revision`, `withdrawn_at`), la lettura per actor e revisione, la
-- shortlist della Position e la ricandidatura dentro `apply_to_position`.
-- Mancava però il **comando** che chiude il ciclo, e con lui quattro garanzie
-- che §13 chiede esplicitamente:
--
--   1. il **ritiro** non esisteva come comando. Era una `update` PostgREST
--      sulla riga, aperta dalla policy «applicant and club owners can update
--      applications»: la Società poteva quindi ritirare la candidatura al
--      posto della persona (§6 lo vieta), non c'era modo di esprimere «ritira
--      *questa* revisione» (§13 — «vecchio ritiro ritardato dopo una nuova
--      submission: non ritirare la nuova revisione») e un retry dopo timeout
--      non era distinguibile da una seconda intenzione;
--   2. non esisteva **nessuna chiave idempotente** sui comandi della
--      candidatura: il `replayed` di `apply_to_position` deduceva il retry
--      dall'esistenza della riga, e dopo un ritiro quella stessa deduzione
--      trasformava il retry di un vecchio invio in una ricandidatura nuova
--      (§13 — «vecchio reinvio ritardato dopo un successivo ritiro: non
--      riattivare una partecipazione senza intenzione corrente»);
--   3. il **dettaglio personale** non era una lettura autorevole. Il client
--      leggeva `recruiting_applications` via PostgREST e calcolava
--      `positionAccepting` con `Date.now()`: §14 — «Non fidarti del timestamp
--      del tap, del clock del dispositivo o di can_apply cached»;
--   4. la **data personale** dell'invio era `created_at`. §19 — «La data
--      Ricevuta il deriva sempre da latest_submitted_at della submission
--      pertinente, non da Application.created_at dopo un reinvio»: dopo una
--      ricandidatura la lista personale mostrava ancora il primo invio.
--
-- In più due fatti che il modello non registrava:
--
--   · il **primo invio** non produceva nessun evento. `log_recruiting_
--     application_event` è `after update of status`, quindi lo storico
--     cominciava dalla prima risposta della Società e §5 chiede invece
--     «SUBMITTED e WITHDRAWN»;
--   · gli eventi **dell'interessato** alimentavano i suoi stessi
--     «Aggiornamenti recenti». §16 — «Un'operazione compiuta dalla persona
--     non genera una nuova urgenza fittizia Da gestire sulla sua Dashboard»:
--     oggi un ritiro comparirebbe lì come novità non consultata, e con
--     l'evento del primo invio ci finirebbe anche la candidatura appena
--     inviata.
--
-- Cosa NON introduce, perché §4 e §39 lo vietano: nessuno stato nuovo
-- (ARCHIVED/EXPIRED/REJECTED/HIRED), nessuna seconda tabella di candidature,
-- nessun comando di esito, nessuna riapertura di una Position CLOSED e nessun
-- reinvio automatico dopo una proroga.
--
-- Idempotenza della migrazione: `create table if not exists`, `create or
-- replace function`, `drop trigger if exists` prima di ogni `create trigger`,
-- `create index if not exists`. I due `drop function` sono necessari perché
-- cambia la lista delle colonne OUT, e sono preceduti da `if exists`.
--
-- Convenzioni riprese da:
--   20261021090000_team_seasons_lifecycle.sql   (chiave + fingerprint
--     dell'operazione, replay/record come coppia di funzioni)
--   20261102090000_society_applications_center.sql (submission corrente,
--     lock `for share` sulla Position come punto di linearizzazione)
--   20261029090000_position_deadline_close.sql  (cutoff esclusivo)


-- ============================================================
-- SEZIONE 1 — identità delle operazioni (§13)
--
-- «L'operazione deve poter essere identificata in modo stabile nel contesto
-- di actor/PERSON, risorsa e tipo di comando. Riutilizza l'idempotency key
-- anche dopo timeout o retry della stessa intenzione. Una nuova intenzione
-- dopo un successivo cambio di stato deve avere una nuova operazione e una
-- precondizione aggiornata.»
--
-- Due colonne distinte, come in `club_team_operations`: la **chiave**
-- riconosce il tentativo, il **fingerprint** riconosce il contenuto e la
-- precondizione. Stessa chiave e stesso contenuto restituiscono la ricevuta;
-- stessa chiave e contenuto diverso è un conflitto, non una seconda
-- scrittura silenziosa.
--
-- `actor_id` nel confronto è ciò che impedisce §13 — «non riutilizzare
-- ricevute tra account, Society o Position»: la stessa stringa usata da un
-- altro utente non è la stessa operazione.
-- ============================================================

create table if not exists public.application_operations (
  idempotency_key text primary key,
  actor_id        uuid not null references public.profiles(id) on delete cascade,
  /* ad_id per un invio, application_id per un ritiro: la risorsa su cui
     l'intenzione è stata espressa. Nessuna FK, perché punta a due tabelle
     diverse e una ricevuta deve sopravvivere alla risorsa. */
  resource_id     uuid not null,
  operation       text not null,
  fingerprint     text not null,
  result          jsonb not null,
  created_at      timestamptz not null default timezone('utc', now())
);

create index if not exists application_operations_actor_idx
  on public.application_operations (actor_id, created_at desc);

alter table public.application_operations enable row level security;
-- Nessuna policy: la tabella è interna alle funzioni `security definer`.
-- §33: una ricevuta non concede accesso a dati che l'actor non può leggere.

comment on table public.application_operations is
  'DAS-REV-23 §13: ricevute delle operazioni di candidatura (invio, ritiro). '
  'Riconosce il retry della stessa intenzione senza ripeterne gli effetti; '
  'non è uno storico del dominio — quello vive in '
  'recruiting_application_events.';

/**
 * Ricevuta già prodotta per questa chiave, se contenuto e contesto coincidono.
 *
 * `null` significa «mai eseguita»: il chiamante prosegue. Contenuto diverso o
 * actor diverso sollevano, perché la chiave non identifica più la stessa
 * operazione.
 */
create or replace function public.application_operation_replay(
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
  v_row public.application_operations%rowtype;
begin
  if p_key is null or length(btrim(p_key)) = 0 then
    return null;
  end if;

  select * into v_row
  from public.application_operations
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

revoke all on function public.application_operation_replay(text, uuid, text, text) from public;
/* Nessun grant: interna ai comandi, non un endpoint. */

create or replace function public.application_operation_record(
  p_key         text,
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

  insert into public.application_operations
    (idempotency_key, actor_id, resource_id, operation, fingerprint, result)
  values
    (p_key, auth.uid(), p_resource_id, p_operation, p_fingerprint, p_result)
  on conflict (idempotency_key) do nothing;
end;
$$;

revoke all on function public.application_operation_record(text, uuid, text, text, jsonb) from public;


-- ============================================================
-- SEZIONE 2 — l'evento del primo invio (§5)
--
-- «Conserva internamente gli eventi significativi SUBMITTED e WITHDRAWN, con
-- ID stabile, Application, actor autorizzato, revisione, istante server e
-- metadati minimi.»
--
-- Il trigger esistente è `after update of status`: il primo invio non lasciava
-- traccia e lo storico cominciava dalla prima risposta della Società. Qui
-- nasce anche quella prima riga, con `from_status` null a dire «non veniva da
-- nessuno stato».
--
-- `submission_revision` sull'evento è l'altra metà di §13 — «La
-- deduplicazione deve includere submission/event ID: usare soltanto
-- Application ID sopprimerebbe reinvii legittimi.»
-- ============================================================

alter table public.recruiting_application_events
  add column if not exists submission_revision integer;

comment on column public.recruiting_application_events.submission_revision is
  'DAS-REV-23 §5, §25: revisione della submission a cui l''evento si '
  'riferisce. Permette di deduplicare le notifiche per submission invece che '
  'per candidatura, senza sopprimere un reinvio legittimo.';

create or replace function public.log_recruiting_application_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.recruiting_application_events (
    application_id, from_status, to_status, occurred_at, submission_revision
  )
  values (
    new.id, null, new.status, coalesce(new.latest_submitted_at, new.created_at),
    new.submission_revision
  );

  return new;
end;
$$;

drop trigger if exists recruiting_applications_log_submitted
  on public.recruiting_applications;

create trigger recruiting_applications_log_submitted
  after insert on public.recruiting_applications
  for each row
  execute function public.log_recruiting_application_submitted();

comment on function public.log_recruiting_application_submitted() is
  'DAS-REV-23 §5: il primo invio è un evento come gli altri. Senza, lo '
  'storico della candidatura cominciava dalla prima risposta della Società.';

/**
 * Il log delle transizioni porta ora anche la revisione.
 *
 * Stessa condizione di prima — `is distinct from` e non `<>`, perché una
 * scrittura che non cambia lo stato non è un evento — con in più la revisione
 * corrente, che per una ricandidatura è quella **nuova**.
 */
create or replace function public.log_recruiting_application_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.recruiting_application_events (
      application_id, from_status, to_status, occurred_at, submission_revision
    )
    values (
      new.id, old.status, new.status, timezone('utc', now()),
      new.submission_revision
    );
  end if;

  return new;
end;
$$;


-- ============================================================
-- SEZIONE 3 — chi può ritirare (§6)
--
-- «L'invio, il ritiro e il nuovo invio sono azioni della PERSON autenticata,
-- per la propria candidatura. Una Society, una Media identity o un
-- amministratore non possono candidarsi o ritirare la candidatura al posto
-- della persona attraverso questi comandi.»
--
-- La policy di UPDATE esistente consente al proprietario del club di scrivere
-- la riga — serve per gli stati della selezione (`reviewing`, `shortlisted`,
-- …) e non va tolta. Ma `withdrawn` non è uno stato della selezione: è la
-- partecipazione della persona. Il guard sta quindi sulla **transizione**, non
-- sulla tabella.
--
-- Vale su ogni percorso di scrittura, RPC comprese: `auth.uid()` legge il
-- claim della richiesta e non cambia dentro una SECURITY DEFINER. Quando il
-- claim è assente — service role, migrazioni, job — il guard si fa da parte:
-- lì l'autorizzazione non è più una questione di questa tabella.
-- ============================================================

create or replace function public.enforce_application_withdrawal_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return new;
  end if;

  /* Entrare **o** uscire da `withdrawn` è la stessa decisione: §17 — «La
     società non può annullare un ritiro. Non introdurre Riattiva.» */
  if (old.status = 'withdrawn') is distinct from (new.status = 'withdrawn')
     and v_uid is distinct from old.applicant_profile_id then
    raise exception 'APPLICATION_WITHDRAW_NOT_OWNER';
  end if;

  return new;
end;
$$;

drop trigger if exists recruiting_applications_withdrawal_actor
  on public.recruiting_applications;

create trigger recruiting_applications_withdrawal_actor
  before update of status on public.recruiting_applications
  for each row
  execute function public.enforce_application_withdrawal_actor();

comment on function public.enforce_application_withdrawal_actor() is
  'DAS-REV-23 §6, §17: solo la PERSON titolare entra o esce da withdrawn. '
  'Gli altri stati della selezione restano scrivibili dalla Società secondo '
  'la policy esistente.';


-- ============================================================
-- SEZIONE 4 — il comando di ritiro (§11, §13)
--
-- «Il server verifica ownership PERSON, Application attuale, revisione della
-- submission, versione e autorizzazione.»
--
-- Punto di decisione atomico: il `for update` sulla riga della candidatura.
-- Tutto ciò che decide — stato corrente, revisione attesa, ritiro già
-- avvenuto — viene riletto **dopo** il lock, non dalla schermata del
-- chiamante.
--
-- Il ritiro non è negato da deadline o chiusura: §8 — «Il ritiro resta libero
-- anche dopo deadline o chiusura per una propria candidatura attiva
-- accessibile.» Per questo qui la Position non viene nemmeno letta.
--
-- Su un ritiro già avvenuto non si solleva: §11 — «Se lo stato è già
-- WITHDRAWN, riconcilia senza produrre un altro ritiro logico.» Il client
-- riceve la proiezione corrente e `replayed = true`.
-- ============================================================

drop function if exists public.withdraw_application(uuid, integer, text);

create function public.withdraw_application(
  p_application_id    uuid,
  p_expected_revision integer default null,
  p_idempotency_key   text default null
)
returns table (
  application_id      uuid,
  status              text,
  submission_revision integer,
  latest_submitted_at timestamptz,
  withdrawn_at        timestamptz,
  replayed            boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_app         public.recruiting_applications%rowtype;
  v_fingerprint text;
  v_receipt     jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  /* La precondizione entra nel fingerprint: §13 — «Una nuova intenzione dopo
     un successivo cambio di stato deve avere una nuova operazione e una
     precondizione aggiornata.» Stessa chiave con una revisione attesa diversa
     è un conflitto, non un replay. */
  v_fingerprint := 'withdraw|' || coalesce(p_expected_revision::text, '*');

  v_receipt := public.application_operation_replay(
    p_idempotency_key, p_application_id, 'application_withdraw', v_fingerprint
  );

  /* Punto di linearizzazione. Un add shortlist concorrente prende `for share`
     sulla stessa riga: uno dei due aspetta l'altro, e l'esito è coerente con
     l'ordine di commit (§13). */
  select * into v_app
  from public.recruiting_applications
  where id = p_application_id
  for update;

  /* §23: lo stato generico non rivela se l'id esista o appartenga ad altri. */
  if not found or v_app.applicant_profile_id is distinct from v_uid then
    raise exception 'APPLICATION_NOT_AVAILABLE';
  end if;

  if v_receipt is not null then
    /* §13: «Per i retry già committati, distinguere ricevuta dell'operazione
       originale e proiezione corrente della risorsa. Una ricevuta storica di
       successo non deve riportare la UI a uno stato ormai superato.» La
       ricevuta dimostra che l'operazione è già avvenuta; i valori sono quelli
       di adesso. */
    application_id      := v_app.id;
    status              := v_app.status::text;
    submission_revision := v_app.submission_revision;
    latest_submitted_at := v_app.latest_submitted_at;
    withdrawn_at        := v_app.withdrawn_at;
    replayed            := true;
    return next;

    return;
  end if;

  if v_app.status = 'withdrawn' then
    /* Già ritirata: nessun secondo evento, nessuna seconda data. */
    perform public.application_operation_record(
      p_idempotency_key, p_application_id, 'application_withdraw',
      v_fingerprint, jsonb_build_object('reconciled', true)
    );

    application_id      := v_app.id;
    status              := v_app.status::text;
    submission_revision := v_app.submission_revision;
    latest_submitted_at := v_app.latest_submitted_at;
    withdrawn_at        := v_app.withdrawn_at;
    replayed            := true;
    return next;

    return;
  end if;

  if v_app.status in ('accepted', 'rejected') then
    /* §4: l'esito canonico della selezione non viene sovrascritto da questa
       task, che «non introduce i comandi per scegliere, rifiutare o assumere
       un candidato» — né per disfarli. */
    raise exception 'APPLICATION_NOT_ACTIVE';
  end if;

  /* §13: «vecchio ritiro ritardato dopo una nuova submission: non ritirare la
     nuova revisione». La revisione attesa è facoltativa — un ritiro deciso
     sulla schermata corrente la porta sempre — ma quando c'è è vincolante. */
  if p_expected_revision is not null
     and p_expected_revision is distinct from v_app.submission_revision then
    raise exception 'APPLICATION_REVISION_STALE';
  end if;

  update public.recruiting_applications a
  set status     = 'withdrawn',
      updated_at = timezone('utc', now())
  where a.id = p_application_id
  returning a.* into v_app;

  perform public.application_operation_record(
    p_idempotency_key, p_application_id, 'application_withdraw',
    v_fingerprint, jsonb_build_object('withdrawn_at', v_app.withdrawn_at)
  );

  application_id      := v_app.id;
  status              := v_app.status::text;
  submission_revision := v_app.submission_revision;
  latest_submitted_at := v_app.latest_submitted_at;
  withdrawn_at        := v_app.withdrawn_at;
  replayed            := false;
  return next;
end;
$$;

revoke all on function public.withdraw_application(uuid, integer, text) from public;
grant execute on function public.withdraw_application(uuid, integer, text) to authenticated;

comment on function public.withdraw_application(uuid, integer, text) is
  'DAS-REV-23 §11: ritiro della propria candidatura. Conserva Application ID, '
  'ultimo invio, letture e shortlist; non è negato da deadline o chiusura; un '
  'retry della stessa intenzione riconcilia invece di produrre un secondo '
  'evento.';


-- ============================================================
-- SEZIONE 4bis — la notifica della nuova candidatura, dentro la transazione
--
-- §25: «Riutilizza il sistema di notifiche delle nuove candidature. Una
-- ricandidatura valida è una nuova submission operativa e può alimentare lo
-- stesso evento/tipo, senza una categoria o inbox Ricandidature separata.»
--
-- Oggi quella notifica la scriveva il **client**, subito dopo la RPC:
--
--     if (row?.replayed === true) return;
--     await supabase.from("notifications").insert({ … });
--
-- Tre conseguenze, tutte contrarie a §25:
--
--   1. una ricandidatura non notificava niente, perché passava dal servizio
--      del lifecycle e non da quel percorso;
--   2. l'inserimento non era legato al commit della candidatura — rete persa
--      fra RPC e insert, e la Società non sapeva di aver ricevuto una
--      candidatura che esiste;
--   3. la deduplicazione non esisteva: §25 — «La deduplicazione deve
--      includere submission/event ID: usare soltanto Application ID
--      sopprimerebbe reinvii legittimi; usare un ID casuale a ogni retry
--      creerebbe duplicati.»
--
-- Qui la notifica nasce nella stessa transazione della submission e la
-- chiave di deduplicazione è **candidatura + revisione**: un retry non la
-- duplica, un reinvio legittimo ne produce una nuova.
-- ============================================================

create unique index if not exists notifications_application_submission_uniq
  on public.notifications (
    recipient_profile_id,
    (data ->> 'application_id'),
    (data ->> 'submission_revision')
  )
  where type = 'application_received';

comment on index public.notifications_application_submission_uniq is
  'DAS-REV-23 §25: una notifica per destinatario e per submission. Un retry '
  'del comando non la duplica; una ricandidatura valida, che ha una '
  'revisione nuova, non viene soppressa.';

create or replace function public.notify_application_received(
  p_application_id uuid,
  p_revision       integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app   public.recruiting_applications%rowtype;
  v_ad    public.recruiting_ads%rowtype;
  v_owner uuid;
  v_name  text;
begin
  select * into v_app from public.recruiting_applications where id = p_application_id;
  select * into v_ad  from public.recruiting_ads where id = v_app.ad_id;

  select c.owner_profile_id into v_owner
  from public.clubs c
  where c.id = v_ad.club_id;

  /* §25: «Rivalida destinatari e capability quando si prepara … una notifica
     riservata.» Il destinatario è il profilo proprietario del club, che per
     costruzione vede ogni candidatura della Società. */
  if v_owner is null or v_owner = v_app.applicant_profile_id then
    return;
  end if;

  select pr.full_name into v_name
  from public.profiles pr
  where pr.id = v_app.applicant_profile_id;

  /* §33: nel payload solo identificatori, niente carriera, contatti o testo
     del profilo. Il titolo resta quello già in uso dal Centro Notifiche. */
  insert into public.notifications
    (recipient_profile_id, type, title, body, data)
  values (
    v_owner,
    'application_received',
    'Hai ricevuto una nuova candidatura',
    coalesce(v_name, 'Un candidato') || ' si è candidato per "' ||
      coalesce(
        nullif(btrim(v_ad.custom_role_name), ''),
        nullif(btrim(v_ad.title), ''),
        'una posizione'
      ) || '"',
    jsonb_build_object(
      'ad_id', v_ad.id,
      'application_id', v_app.id,
      'applicant_profile_id', v_app.applicant_profile_id,
      'submission_revision', p_revision
    )
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.notify_application_received(uuid, integer) from public;
/* Nessun grant: la chiama il comando, non il client. */

comment on function public.notify_application_received(uuid, integer) is
  'DAS-REV-23 §25: notifica della nuova submission, emessa dentro la '
  'transazione del comando e deduplicata per candidatura + revisione.';


-- ============================================================
-- SEZIONE 5 — invio e ricandidatura con identità dell'operazione (§9, §12, §13)
--
-- DAS-REV-22 aveva già esteso `apply_to_position` alla ricandidatura dopo un
-- ritiro. Mancava l'identità dell'operazione, e senza di quella due casi di
-- §13 non erano distinguibili:
--
--   · «retry di una ACTIVE: nessun nuovo timestamp, unread o notifica» —
--     funzionava, perché il retry trovava la riga attiva e la restituiva;
--   · «vecchio reinvio ritardato dopo un successivo ritiro: non riattivare
--     una partecipazione senza intenzione corrente» — **non** funzionava: il
--     retry trovava la riga ritirata e la riattivava, indistinguibile da una
--     nuova ricandidatura.
--
-- La chiave risolve il secondo senza toccare il primo. Il fingerprint porta
-- la revisione osservata, così «ricandidati dalla revisione 1» e «ricandidati
-- dalla revisione 3» sono due intenzioni diverse anche con la stessa chiave.
--
-- Il punto di linearizzazione resta il `for share` sulla Position: §14 — «Una
-- richiesta iniziata prima della scadenza ma decisa atomicamente dopo il
-- cutoff non è accettata.»
-- ============================================================

drop function if exists public.apply_to_position(uuid, text);
drop function if exists public.apply_to_position(uuid, text, integer, text);

create function public.apply_to_position(
  p_ad_id             uuid,
  p_cover_message     text,
  p_expected_revision integer default null,
  p_idempotency_key   text default null
)
returns table (
  application_id      uuid,
  status              text,
  created_at          timestamptz,
  replayed            boolean,
  submission_revision integer,
  latest_submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_ad          public.recruiting_ads%rowtype;
  v_app         public.recruiting_applications%rowtype;
  v_role        text;
  v_target      text;
  v_player      boolean;
  v_now         timestamptz := timezone('utc', now());
  v_fingerprint text;
  v_receipt     jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_fingerprint := 'apply|' || coalesce(p_expected_revision::text, '*');

  v_receipt := public.application_operation_replay(
    p_idempotency_key, p_ad_id, 'application_apply', v_fingerprint
  );

  if v_receipt is not null then
    /* §13: la ricevuta prova che l'invio è già avvenuto; lo stato è quello
       corrente. Se nel frattempo la persona ha ritirato, il retry **non**
       riattiva niente e restituisce la candidatura ritirata. */
    select * into v_app
    from public.recruiting_applications a
    where a.ad_id = p_ad_id and a.applicant_profile_id = v_uid;

    if found then
      application_id      := v_app.id;
      status              := v_app.status::text;
      created_at          := v_app.created_at;
      replayed            := true;
      submission_revision := v_app.submission_revision;
      latest_submitted_at := v_app.latest_submitted_at;
      return next;

      return;
    end if;
  end if;

  select pr.role::text into v_role
  from public.profiles pr
  where pr.id = v_uid;

  if v_role is null then
    raise exception 'POSITION_APPLICANT_NOT_ELIGIBLE';
  end if;

  v_player := exists (
    select 1 from public.player_profiles pp where pp.profile_id = v_uid
  );

  select * into v_ad
  from public.recruiting_ads
  where id = p_ad_id
  for share;

  if not found or v_ad.status = 'draft' then
    raise exception 'POSITION_NOT_AVAILABLE';
  end if;

  if v_ad.status = 'closed' then
    raise exception 'POSITION_CLOSED';
  end if;

  if v_ad.application_deadline_at is not null
     and v_now >= v_ad.application_deadline_at then
    raise exception 'POSITION_DEADLINE_PASSED';
  end if;

  v_target := coalesce(v_ad.target_role::text, 'player');

  if v_role <> v_target then
    raise exception 'POSITION_ROLE_NOT_SUPPORTED';
  end if;

  if v_target = 'player' and not v_player then
    raise exception 'POSITION_APPLICANT_NOT_ELIGIBLE';
  end if;

  begin
    insert into public.recruiting_applications
      (ad_id, applicant_profile_id, player_profile_id, cover_message, status,
       latest_submitted_at, submission_revision)
    values (
      p_ad_id,
      v_uid,
      case when v_target = 'player' then v_uid end,
      nullif(btrim(coalesce(p_cover_message, '')), ''),
      'submitted',
      v_now,
      1
    )
    /* Qualificato: `status` e `created_at` sono anche nomi di colonna OUT, e
       in un RETURNING non qualificato plpgsql non sa quale dei due intendi.
       La riga intera, non cinque colonne: v_app è un %rowtype e una lista
       parziale ci finirebbe dentro per posizione, non per nome. */
    returning recruiting_applications.* into v_app;

    perform public.application_operation_record(
      p_idempotency_key, p_ad_id, 'application_apply', v_fingerprint,
      jsonb_build_object('application_id', v_app.id, 'revision', 1)
    );

    perform public.notify_application_received(v_app.id, v_app.submission_revision);

    application_id      := v_app.id;
    status              := v_app.status::text;
    created_at          := v_app.created_at;
    replayed            := false;
    submission_revision := v_app.submission_revision;
    latest_submitted_at := v_app.latest_submitted_at;
    return next;
  exception when unique_violation then
    /* Riga già presente per questa persona e questa Position: o è un retry
       senza chiave di un invio già committato, o è una ricandidatura dopo un
       ritiro. §5: «Per la stessa combinazione persona + Position deve
       esistere una sola candidatura corrente» — in nessuno dei due casi se ne
       crea una seconda. */
    select * into v_app
    from public.recruiting_applications a
    where a.ad_id = p_ad_id and a.applicant_profile_id = v_uid
    for update;

    if v_app.status = 'withdrawn' then
      if p_expected_revision is not null
         and p_expected_revision is distinct from v_app.submission_revision then
        raise exception 'APPLICATION_REVISION_STALE';
      end if;

      update public.recruiting_applications a
      set status              = 'submitted',
          latest_submitted_at = v_now,
          submission_revision = a.submission_revision + 1,
          cover_message       = coalesce(
            nullif(btrim(coalesce(p_cover_message, '')), ''), a.cover_message
          ),
          updated_at          = v_now
      where a.id = v_app.id
      returning a.* into v_app;

      perform public.application_operation_record(
        p_idempotency_key, p_ad_id, 'application_apply', v_fingerprint,
        jsonb_build_object(
          'application_id', v_app.id, 'revision', v_app.submission_revision
        )
      );

      /* §25: «Una ricandidatura valida è una nuova submission operativa e può
         alimentare lo stesso evento/tipo.» La revisione nuova la distingue
         dalla precedente e la fa passare dalla deduplicazione. */
      perform public.notify_application_received(v_app.id, v_app.submission_revision);

      application_id      := v_app.id;
      status              := v_app.status::text;
      created_at          := v_app.created_at;
      /* Non è un replay: è un invio nuovo che i lettori devono vedere come
         non letto e in cima all'ordinamento (§12). */
      replayed            := false;
      submission_revision := v_app.submission_revision;
      latest_submitted_at := v_app.latest_submitted_at;
      return next;

      return;
    end if;

    /* §9: «Una seconda richiesta per una Application già ACTIVE non è un modo
       per riportarsi in cima: non aggiorna latest_submitted_at, non genera un
       nuovo evento o una notifica, non azzera la lettura.» */
    application_id      := v_app.id;
    status              := v_app.status::text;
    created_at          := v_app.created_at;
    replayed            := true;
    submission_revision := v_app.submission_revision;
    latest_submitted_at := v_app.latest_submitted_at;
    return next;
  end;
end;
$$;

revoke all on function public.apply_to_position(uuid, text, integer, text) from public;
grant execute on function public.apply_to_position(uuid, text, integer, text) to authenticated;

comment on function public.apply_to_position(uuid, text, integer, text) is
  'DAS-REV-18 §17 + DAS-REV-22 §24 + DAS-REV-23 §12, §13: invio e '
  'ricandidatura atomici, rivalidati sotto lock sulla Position, con identità '
  'dell''operazione. Il retry della stessa intenzione restituisce la '
  'proiezione corrente e non riattiva una partecipazione ritirata dopo.';


-- ============================================================
-- SEZIONE 6 — il dettaglio personale, letto dal server (§10, §11, §14, §24)
--
-- Il dettaglio personale era una `select` PostgREST più un calcolo nel
-- client:
--
--     positionAccepting:
--       ad.status === 'published' &&
--       (!ad.application_deadline_at ||
--        Date.parse(ad.application_deadline_at) > Date.now())
--
-- §14 lo vieta due volte: «Non fidarti del timestamp del tap, del clock del
-- dispositivo o di can_apply cached» e «La ricezione è aperta se server_now <
-- cutoff». Un orologio avanti di un giorno mostrava «Candidati di nuovo» su
-- una ricerca chiusa, e il tap finiva in un errore di dominio evitabile.
--
-- §24 fissa anche il contenuto minimo: «stato corrente, submission
-- ID/revisione, latest_submitted_at, data del ritiro corrente se presente,
-- versione, riferimenti Position, lifecycle, condizione della deadline, dati
-- professionali consentiti, stato shortlist e capacità effettive.» Lo stato
-- shortlist **non** compare: §30 — «Il candidato non vede Nuova, unread
-- amministrativo o In shortlist come nuovi stati pubblici.»
--
-- `can_withdraw` e `can_apply` sono capacità, non suggerimenti: §6 — «Non
-- rendere il client fonte di verità delle capacità» e §10 — «Non mostrare un
-- form di candidatura se il server la nega». Il motivo accompagna il
-- diniego perché §30 chiede copy diverse per scadenza e chiusura.
-- ============================================================

create or replace function public.fetch_my_application_detail(p_application_id uuid)
returns table (
  application_id      uuid,
  state               text,
  status              text,
  submission_revision integer,
  created_at          timestamptz,
  latest_submitted_at timestamptz,
  withdrawn_at        timestamptz,
  application_group   text,
  outcome             text,
  concluded_at        timestamptz,
  ad_id               uuid,
  ad_status           text,
  role_required       text,
  role_label          text,
  position_scope      text,
  team_label          text,
  category_label      text,
  deadline_at         timestamptz,
  receiving_open      boolean,
  club_id             uuid,
  club_name           text,
  club_logo_url       text,
  club_is_verified    boolean,
  person_id           uuid,
  person_name         text,
  person_avatar_url   text,
  person_role         text,
  person_position     text,
  person_situation    text,
  can_withdraw        boolean,
  can_apply           boolean,
  blocked_reason      text,
  server_now          timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_app       public.recruiting_applications%rowtype;
  v_ad        public.recruiting_ads%rowtype;
  v_now       timestamptz := timezone('utc', now());
  v_open      boolean;
  v_eligible  boolean;
  v_role      text;
  v_target    text;
  v_reason    text;
  v_concluded timestamptz;
  v_group     text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_app
  from public.recruiting_applications a
  where a.id = p_application_id
    and a.applicant_profile_id = v_uid;

  /* §23: stato generico. Non distingue «non esiste» da «non è tua». */
  if not found then
    raise exception 'APPLICATION_NOT_AVAILABLE';
  end if;

  select * into v_ad from public.recruiting_ads where id = v_app.ad_id;

  /* §8: «Una Application legacy associata a DRAFT è un'anomalia da trattare
     senza cancellazioni o falsa pubblicazione. Conserva l'integrità … e non
     esporre bozze riservate.» La relazione personale resta leggibile; la
     ricezione no. */
  v_open := v_ad.status = 'published'
    and (v_ad.application_deadline_at is null
         or v_now < v_ad.application_deadline_at);

  select pr.role::text into v_role from public.profiles pr where pr.id = v_uid;
  v_target := coalesce(v_ad.target_role::text, 'player');

  v_eligible := v_role is not null
    and v_role = v_target
    and (
      v_target <> 'player'
      or exists (select 1 from public.player_profiles pp where pp.profile_id = v_uid)
    );

  /* §30: la copy del diniego dice il motivo vero. Ordine deliberato — la
     chiusura vince sulla scadenza, perché §15 la rende terminale e §14 vieta
     di confonderle. */
  v_reason := case
    when v_ad.status = 'draft'     then 'not_available'
    when v_ad.status = 'closed'    then 'closed'
    when v_ad.application_deadline_at is not null
         and v_now >= v_ad.application_deadline_at then 'deadline'
    when not v_eligible            then 'not_eligible'
  end;

  v_group := public.application_group(v_app.status, v_ad.selection_completed_at);

  /* §16: «La data di una riga Ritirata è la data reale del ritiro.» Il
     ritiro corrente ha la sua colonna; per gli altri esiti vale l'evento
     reale, e in sua assenza la conclusione dichiarata sulla Position. Mai
     `closed_at`. */
  v_concluded := case
    when v_group <> 'completed' then null
    when v_app.status = 'withdrawn' then v_app.withdrawn_at
    else coalesce(
      (
        select e.occurred_at
        from public.recruiting_application_events e
        where e.application_id = v_app.id
          and (
            e.event_kind = 'selection_completed'
            or e.to_status in ('accepted', 'rejected', 'withdrawn')
          )
        order by e.occurred_at desc
        limit 1
      ),
      v_ad.selection_completed_at
    )
  end;

  return query
  select
    v_app.id,
    /* §4: due soli valori nel vocabolario del lifecycle. Gli stati della
       selezione restano in `status`, che non viene riscritto. */
    case when v_app.status = 'withdrawn' then 'withdrawn' else 'active' end,
    v_app.status::text,
    v_app.submission_revision,
    v_app.created_at,
    coalesce(v_app.latest_submitted_at, v_app.created_at),
    v_app.withdrawn_at,
    v_group,
    case
      when v_group <> 'completed' then null
      when v_app.status in ('accepted', 'rejected', 'withdrawn') then 'status'
      else 'selection_completed'
    end,
    v_concluded,
    v_ad.id,
    v_ad.status::text,
    v_ad.role_required::text,
    coalesce(
      nullif(btrim(v_ad.custom_role_name), ''),
      pr.label,
      nullif(btrim(v_ad.title), ''),
      'Posizione senza titolo'
    ),
    v_ad.position_scope_type,
    /* §19: «Cambiare categoria o archiviare un Team non riscrive il contesto
       passato.» Su una ricerca chiusa vale lo snapshot della pubblicazione. */
    case
      when v_ad.position_scope_type = 'society' then 'Intera società'
      when v_ad.status = 'closed' then coalesce(v_ad.published_team_name, ct.name)
      else ct.name
    end,
    coalesce(ct.category, v_ad.category),
    v_ad.application_deadline_at,
    v_open,
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    prof.id,
    prof.full_name,
    prof.avatar_url,
    prof.role::text,
    /* §19: la riga della persona descrive **lei**, non la ricerca a cui si è
       candidata. Un centrocampista che si candida come esterno resta un
       centrocampista, e il mockup 01 mostra il suo ruolo. */
    pp.primary_position::text,
    public.profile_current_situation(prof.id),
    /* §8: il ritiro resta disponibile per una propria ACTIVE anche dopo
       deadline o chiusura. Un esito canonico della selezione lo esclude:
       questa task non disfa gli esiti. */
    v_app.status not in ('withdrawn', 'accepted', 'rejected'),
    v_app.status = 'withdrawn' and v_open and v_eligible,
    case when v_app.status = 'withdrawn' then v_reason end,
    v_now
  from public.profiles prof
  join public.clubs c on c.id = v_ad.club_id
  left join public.club_teams ct on ct.id = v_ad.team_id
  left join public.position_roles pr on pr.id = v_ad.structured_role_id
  left join public.player_profiles pp on pp.profile_id = v_app.applicant_profile_id
  where prof.id = v_app.applicant_profile_id;
end;
$$;

revoke all on function public.fetch_my_application_detail(uuid) from public;
grant execute on function public.fetch_my_application_detail(uuid) to authenticated;

comment on function public.fetch_my_application_detail(uuid) is
  'DAS-REV-23 §10, §11, §14, §24: dettaglio della **propria** candidatura, '
  'con ricezione e capacità decise sull''orologio del server. Non espone '
  'shortlist, letture amministrative o motivi interni di chiusura.';


-- ============================================================
-- SEZIONE 7 — predicato condiviso degli aggiornamenti della Società (§16)
--
-- «Un'operazione compiuta dalla persona non genera una nuova urgenza fittizia
-- Da gestire sulla sua Dashboard.»
--
-- `recruiting_application_events` registra ora anche gli atti
-- dell'interessato — l'invio dalla Sezione 2 e il ritiro, che prima nasceva
-- da una `update` qualsiasi. Entrambi sono storia utile e nessuno dei due è
-- un aggiornamento *ricevuto*: senza questo predicato il proprio ritiro
-- comparirebbe in «Aggiornamenti recenti» come novità non consultata.
--
-- Un solo posto, usato dalle due proiezioni personali: due copie
-- divergerebbero, ed è il modo in cui il widget finisce per dire una cosa e
-- la lista un'altra sulla stessa candidatura.
-- ============================================================

create or replace function public.application_event_is_from_society(
  p_event_kind text,
  p_to_status  public.application_status
)
returns boolean
language sql
immutable
as $$
  select p_event_kind = 'selection_completed'
      or p_to_status not in ('submitted', 'withdrawn');
$$;

comment on function public.application_event_is_from_society(text, public.application_status) is
  'DAS-REV-23 §16: l''evento descrive una risposta della Società, non un atto '
  'dell''interessato. submitted e withdrawn sono i due atti della PERSON e '
  'restano nello storico senza alimentare i suoi "Aggiornamenti recenti".';


-- ============================================================
-- SEZIONE 8 — lista personale Attive / Concluse (§16, §19)
--
-- Tre correzioni sulla stessa funzione, tutte sulla data:
--
--   1. «Inviata il» usa `latest_submitted_at` (§19). Dopo una ricandidatura
--      `created_at` è il **primo** invio storico, e mostrarlo come data
--      dell'invio corrente è falso;
--   2. l'ordinamento di Attive segue la stessa data, perché §21 chiede che
--      «Lo stesso istante alimenta tempo relativo in lista e data nel
--      dettaglio» e una ricandidatura deve risalire;
--   3. la conclusione di una candidatura ritirata è `withdrawn_at` (§16 — «La
--      data di una riga Ritirata è la data reale del ritiro se identificata
--      come tale»), non l'ultimo evento terminale qualsiasi.
--
-- In più il gruppo resta quello canonico: una ACTIVE su Position CLOSED **non**
-- diventa conclusa (§16 — «una partecipazione ancora ACTIVE e non conclusa
-- resta in Attive anche se la Position è CLOSED o ha superato la deadline»).
-- `application_group()` lo garantisce già e non viene toccata.
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
      app.withdrawn_at,
      -- §19: la data dell'invio corrente. Il fallback su created_at vale per
      -- i record anteriori a DAS-REV-22, dove la colonna non esisteva.
      coalesce(app.latest_submitted_at, app.created_at) as submitted_at,
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
      -- §16: il ritiro ha la propria data; gli altri esiti l'evento reale, e
      -- in sua assenza la conclusione dichiarata sulla posizione. Mai la
      -- chiusura dell'annuncio.
      case
        when app.status = 'withdrawn' then app.withdrawn_at
        else coalesce(
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
        )
      end as concluded_at,
      -- §13 di DAS-REV-04: l'ack si riferisce all'evento consultato. §16 di
      -- questa task esclude però gli atti dell'interessato: il proprio
      -- ritiro non è un aggiornamento da consultare.
      (
        select e.id
        from public.recruiting_application_events e
        where e.application_id = app.id
          and public.application_event_is_from_society(e.event_kind, e.to_status)
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
        when v_group = 'completed' then coalesce(s.concluded_at, s.submitted_at)
        else s.submitted_at
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
      'latest_submitted_at', p.submitted_at,
      'withdrawn_at',       p.withdrawn_at,
      'group',              p.grp,
      'position_accepting', p.position_accepting,
      'concluded_at',       p.concluded_at,
      'last_event_id',      p.last_event_id,
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

comment on function public.fetch_my_applications_page(text, integer, text) is
  'DAS-REV-04 §14/§18 + DAS-REV-23 §16, §19: pagina della lista "Le mie '
  'candidature". La data e l''ordinamento usano l''ultima submission, non il '
  'primo invio storico; la conclusione di una ritirata è la data del ritiro.';


-- ============================================================
-- SEZIONE 9 — widget personale: nessuna urgenza fittizia (§16)
--
-- Unica modifica: `last_event` considera soltanto gli eventi della Società.
-- Il resto della funzione è invariato, riemesso perché plpgsql non consente
-- di sostituire una CTE.
--
-- Senza questa modifica, dopo la Sezione 2 ogni candidatura appena inviata
-- avrebbe un evento proprio e il ritiro ne produrrebbe un altro: entrambi
-- comparirebbero in «Aggiornamenti recenti» dell'interessato, che li ha
-- appena compiuti.
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
      coalesce(app.latest_submitted_at, app.created_at) as submitted_at,
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
      -- §7 di DAS-REV-04: la posizione accetta ancora candidature? Metadato
      -- secondario, mai uno stato terminale.
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
      -- §16: gli atti dell'interessato restano nello storico e non diventano
      -- un aggiornamento da consultare sulla sua Dashboard.
      and public.application_event_is_from_society(e.event_kind, e.to_status)
    order by e.application_id, e.occurred_at desc, e.id desc
  )
  select
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
          'latest_submitted_at', s.submitted_at,
          'position_accepting', s.position_accepting,
          'last_event_id',     ev.event_id,
          'last_event_at',     ev.occurred_at,
          'last_event_to',     ev.to_status,
          'last_event_kind',   ev.event_kind,
          'has_unread_update', (
            ev.event_id is not null
            and ev.occurred_at > s.submitted_at
            and not exists (
              select 1 from public.recruiting_application_event_acks ack
              where ack.event_id = ev.event_id and ack.profile_id = v_uid
            )
          ),
          'sort_at',           greatest(s.submitted_at, coalesce(ev.occurred_at, s.submitted_at))
        ) as item
        from scoped s
        left join last_event ev on ev.application_id = s.id
        where s.grp = 'active'
        order by greatest(s.submitted_at, coalesce(ev.occurred_at, s.submitted_at)) desc, s.id desc
        limit 3
      ) preview
    ), '[]'::jsonb) as applications_preview,

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
          and ev.occurred_at > s.submitted_at
        order by ev.occurred_at desc, s.id desc
        limit 2
      ) updates
    ), '[]'::jsonb) as recent_updates,

    exists (select 1 from scoped s where s.grp = 'completed') as has_completed,

    (extract(epoch from v_now) * 1000)::bigint as data_revision;
end;
$$;

comment on function public.fetch_dashboard_personal_applications() is
  'DAS-REV-04 + DAS-REV-23 §16: preview, aggiornamenti recenti ed esistenza '
  'dello storico. Gli aggiornamenti sono quelli ricevuti dalla Società: il '
  'proprio invio e il proprio ritiro non diventano un''urgenza da gestire.';


-- ============================================================
-- SEZIONE 10 — backfill dello storico esistente (§32)
--
-- «Non inventare una nuova submission a ogni prima lettura della nuova app.
-- Ricostruisci latest_submitted_at dagli eventi affidabili disponibili. Se
-- non esiste prova di un reinvio, la data originaria può restare la sola data
-- reale; non sostituirla con now.»
--
-- L'evento del primo invio nasce dalla Sezione 2 e vale da qui in avanti. Per
-- le candidature già esistenti la prova dell'invio c'è ed è affidabile:
-- `latest_submitted_at`, che DAS-REV-22 ha popolato da `created_at` dopo aver
-- dimostrato che fino ad allora ogni riga aveva esattamente una submission.
-- L'evento viene quindi creato con **quella** data, non con l'istante della
-- migrazione.
--
-- Idempotente: il `not exists` impedisce una seconda riga su una candidatura
-- che l'evento ce l'ha già, sia da questo backfill sia dal trigger.
-- ============================================================

insert into public.recruiting_application_events (
  application_id, from_status, to_status, occurred_at, submission_revision
)
select
  a.id,
  null,
  'submitted'::public.application_status,
  coalesce(a.latest_submitted_at, a.created_at),
  1
from public.recruiting_applications a
where not exists (
  select 1
  from public.recruiting_application_events e
  where e.application_id = a.id
    and e.from_status is null
    and e.to_status = 'submitted'
);

-- Le transizioni già registrate non conoscono la revisione a cui si
-- riferivano. §32 — «Ambiguità o conflitti legacy richiedono un adapter
-- deterministico documentato … non una scelta casuale nascosta»: prima di
-- DAS-REV-22 la ricandidatura non esisteva, quindi ogni evento storico
-- riguarda la revisione 1. Solo le righe senza valore vengono toccate.
update public.recruiting_application_events
set submission_revision = 1
where submission_revision is null;


-- ============================================================
-- SEZIONE 11 — correzione di `guard_team_is_active` (§14, QA070)
--
-- Bug preesistente, trovato eseguendo QA070 — «Proroga/rimozione valida su
-- PUBLISHED può riabilitare apply senza cambiare Position ID» — su un
-- database reale.
--
-- La funzione serve due tabelle con lo stesso corpo. Nel ramo `tg_op =
-- 'UPDATE'` il secondo controllo era scritto così:
--
--     if tg_table_name = 'club_members'
--        and old.status = 'pending' and old.profile_id is not null
--
-- `and` in SQL **non** garantisce la valutazione da sinistra a destra, e
-- `'pending'` viene risolto contro il tipo di `old.status` quando
-- l'espressione è preparata: su `recruiting_ads` quel tipo è `ad_status`, che
-- non ha il valore `pending`. Il risultato è un errore a runtime —
-- «invalid input value for enum ad_status: "pending"» — su ogni UPDATE di una
-- Position **di squadra** che diventa disponibile partendo da uno stato in
-- cui non lo era:
--
--   · pubblicazione di una bozza (draft → published);
--   · riapertura della ricezione con una proroga oltre un cutoff già passato;
--   · qualunque UPDATE che renda di nuovo disponibile una ricerca chiusa.
--
-- Il ramo `recruiting_ads` non viene mai raggiunto per le Position SOCIETY —
-- `team_id` nullo esce prima — il che spiega perché il problema non sia
-- emerso: le prove senza database non eseguono plpgsql.
--
-- La correzione è strutturale e minima: il controllo della riga vecchia
-- scende dentro il ramo della sua tabella, così l'espressione di una tabella
-- non viene mai preparata nel contesto dell'altra. Nessun cambio di
-- comportamento voluto.
-- ============================================================

create or replace function public.guard_team_is_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id   uuid;
  v_archived  boolean;
  v_relevant  boolean := false;
  v_was       boolean := false;
begin
  if tg_table_name = 'recruiting_ads' then
    v_team_id  := new.team_id;
    v_relevant := public.recruiting_ad_is_available(new.status, new.application_deadline_at);

    if tg_op = 'UPDATE' then
      v_was := public.recruiting_ad_is_available(old.status, old.application_deadline_at);
    end if;
  elsif tg_table_name = 'club_members' then
    v_team_id  := new.team_id;
    v_relevant := new.status = 'pending' and new.profile_id is not null;

    if tg_op = 'UPDATE' then
      v_was := old.status = 'pending' and old.profile_id is not null;
    end if;
  end if;

  if v_team_id is null or not v_relevant then
    return new;
  end if;

  -- Una riga già rilevante che resta rilevante non viene bloccata: la
  -- disattivazione non può avvenire mentre esistono, quindi questo caso non
  -- si presenta se non per modifiche interne al dominio proprietario.
  if tg_op = 'UPDATE' and old.team_id is not distinct from v_team_id and v_was then
    return new;
  end if;

  -- `for share` e non una lettura semplice: è questa riga a rendere reale la
  -- sezione critica di DAS-REV-10 §27. Se `deactivate_club_team` tiene già il
  -- `for update` sulla squadra, questa transazione **attende** e poi rilegge
  -- la riga aggiornata, trovandola archiviata.
  select ct.is_archived into v_archived
  from public.club_teams ct
  where ct.id = v_team_id
  for share;

  if coalesce(v_archived, false) then
    raise exception 'TEAM_NOT_ACTIVE';
  end if;

  return new;
end;
$$;

comment on function public.guard_team_is_active() is
  'DAS-REV-10 §27 + DAS-REV-23 §14: una Position o un invito non diventano '
  'disponibili su una squadra archiviata. Il controllo della riga vecchia sta '
  'dentro il ramo della propria tabella: un confronto con un letterale di '
  'enum preparato nel contesto dell''altra tabella falliva a runtime.';
