-- ============================================================
-- DAS-REV-18 — Scadenza candidature, chiusura esplicita, storico Position
--
-- Nessuna Position nuova, nessun lifecycle nuovo. `recruiting_ads` resta
-- l'unica Position e `public.ad_status` (draft | published | closed) resta
-- l'unico lifecycle. `publish_positions` e `position_publish_blockers`
-- restano le uniche autorità su bozza e pubblicazione (DAS-REV-16, non
-- toccate). Due lacune reali impediscono però di esprimere il contratto §8-
-- §28 con ciò che esiste oggi:
--
--   1. **Il cutoff di `set_position_deadline` è inclusivo** (ultimo
--      microsecondo del giorno). §8 chiede un cutoff **esclusivo**: inizio
--      del giorno successivo, perché la forma "23:59:59" perde frazioni di
--      secondo. Sezione 1.
--   2. **Non esiste un motivo di chiusura**, e `recruiting_ads` non è il
--      posto giusto per ospitarlo: è leggibile da ogni utente autenticato
--      (§21). Sezione 2.
--   3. **Una Position CLOSED non è immutabile**: la policy owner `for all`
--      del 2026-03-09 permette un UPDATE o DELETE diretto via REST anche a
--      chiusura avvenuta (§25). Sezione 3.
--   4. **Non esiste un comando di chiusura esplicita**, né una rivalidazione
--      a livello di riga del cutoff candidature al momento dell'invio (§17,
--      §19, §20, §22, §23). Sezioni 4, 5, 8.
--
-- Rollback: droppare `close_position`, `apply_to_position`,
-- `position_deadline_cutoff`, `position_deadline_date`,
-- `position_close_reason_max_length`, il trigger
-- `recruiting_ads_closed_immutable` e la tabella `recruiting_ad_closures`;
-- ripristinare `set_position_deadline`, `fetch_society_position_detail`,
-- `fetch_society_positions_page`, `dashboard_position_action_state` e
-- `enforce_application_submission_window` dalla 20261028090000 /
-- 20261027090000 / 20261014090000. Nessuna colonna viene rimossa da
-- `recruiting_ads`: il solo cambiamento di dati è lo spostamento di 1
-- microsecondo sulle deadline storiche già al cutoff inclusivo, che un
-- rollback non ha motivo di invertire (è la stessa semantica, non una nuova).
--
-- Idempotenza: `create or replace function` ovunque tranne dove PostgreSQL
-- non può cambiare le colonne OUT di una `returns table` (drop esplicito,
-- segnalato in ogni sezione). `create table if not exists`, `drop
-- constraint if exists` + `add constraint`, `drop trigger if exists` +
-- `create trigger`, backfill con una condizione che non matcha più dopo la
-- prima esecuzione.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — cutoff esclusivo della deadline candidature (§8, §38)
--
-- Oggi `set_position_deadline` scrive l'ultimo istante incluso del giorno
-- scelto. §8 chiede invece: «cutoff = inizio del giorno successivo alla data
-- scelta, nella timezone fissata», con ricezione aperta quando
-- `server_now < cutoff`. Da qui in avanti ogni confronto di ricezione aperta
-- è `now() < application_deadline_at` e ogni "superata" è
-- `now() >= application_deadline_at`.
--
-- `position_deadline_date` è l'**adapter** che legge sia la vecchia
-- rappresentazione (ultimo microsecondo del giorno) sia la nuova (mezzanotte
-- del giorno dopo): sottrarre 1 microsecondo prima di troncare dà lo stesso
-- giorno civile in entrambi i casi, quindi una lettura non deve sapere quale
-- delle due forme la riga porta.
-- ============================================================

create or replace function public.position_deadline_cutoff(p_date date, p_tz text)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select (p_date + 1)::timestamp at time zone p_tz;
$$;

revoke all on function public.position_deadline_cutoff(date, text) from public;
grant execute on function public.position_deadline_cutoff(date, text) to authenticated;

comment on function public.position_deadline_cutoff(date, text) is
  'DAS-REV-18 §8: cutoff esclusivo della scadenza candidature — inizio del '
  'giorno successivo alla data scelta, nella timezone della Società. La '
  'ricezione è aperta quando now() < cutoff, chiusa quando now() >= cutoff.';

create or replace function public.position_deadline_date(p_at timestamptz, p_tz text)
returns date
language sql
immutable
set search_path = public
as $$
  -- Adapter: sottrarre 1 microsecondo prima di troncare dà lo stesso giorno
  -- civile sia che `p_at` sia la vecchia rappresentazione (ultimo
  -- microsecondo del giorno scelto) sia la nuova (mezzanotte del giorno
  -- dopo). Una proiezione non deve sapere quale delle due forme la riga
  -- porta: con la vecchia, -1µs resta nello stesso giorno; con la nuova,
  -- -1µs riporta dalla mezzanotte del giorno dopo all'ultimo istante del
  -- giorno scelto, cioè allo stesso giorno civile.
  select ((p_at at time zone p_tz) - interval '1 microsecond')::date;
$$;

revoke all on function public.position_deadline_date(timestamptz, text) from public;
grant execute on function public.position_deadline_date(timestamptz, text) to authenticated;

comment on function public.position_deadline_date(timestamptz, text) is
  'DAS-REV-18 §8: proiezione del giorno civile da un cutoff, compatibile sia '
  'con la vecchia rappresentazione inclusiva (23:59:59.999999 locale) sia '
  'con la nuova esclusiva (mezzanotte del giorno dopo). Ogni lettura del '
  'giorno scelto deve passare da qui, mai da un cast diretto: con il cutoff '
  'esclusivo un cast diretto mostrerebbe il giorno successivo.';


-- Normalizzazione una tantum delle righe esistenti: sposta di 1 microsecondo
-- l'istante già salvato (dall'ultimo microsecondo del giorno alla mezzanotte
-- del giorno dopo), senza estendere né accorciare la finestra di ricezione
-- alla risoluzione del timestamptz. Dopo questo update la condizione non
-- matcha più alcuna riga: rieseguire la migrazione non fa nulla.
do $$
declare
  v_count integer;
begin
  update public.recruiting_ads
     set application_deadline_at = application_deadline_at + interval '1 microsecond'
   where application_deadline_at is not null
     and application_deadline_timezone is not null
     and (application_deadline_at at time zone application_deadline_timezone)::time
         = '23:59:59.999999'::time;

  get diagnostics v_count = row_count;

  -- Conteggio di riconciliazione (§39): quante deadline inclusive sono state
  -- spostate al cutoff esclusivo da questa esecuzione.
  raise notice 'DAS-REV-18 §8: % deadline normalizzate al cutoff esclusivo', v_count;
end;
$$;


-- ============================================================
-- SEZIONE 2 — motivo di chiusura, in una tabella separata (§20, §21)
--
-- `recruiting_ads` è leggibile da ogni utente autenticato per le righe
-- `status <> 'draft'` (policy 20261026090000). Un motivo di chiusura lì
-- sarebbe quindi pubblico, e §21 lo vieta esplicitamente: «Non compaiono nel
-- payload pubblico, nel dettaglio candidato, in Cerca». Il motivo vive
-- quindi in una tabella propria, con RLS che segue il perimetro gestionale
-- della Position e non la sua visibilità pubblica.
--
-- Nessuna policy di insert/update/delete: le righe nascono solo da
-- `close_position`, `security definer`. Un CHECK non può chiamare una
-- funzione non immutable in modo portabile fra le versioni supportate, quindi
-- il limite resta letterale nel CHECK; `position_close_reason_max_length()`
-- esiste perché la RPC e il client (300) condividano un solo numero
-- dichiarato — i due valori letterali (qui e nella funzione) devono restare
-- allineati a mano.
-- ============================================================

do $$
begin
  create type public.position_close_reason as enum (
    'filled', 'no_longer_needed', 'cancelled', 'other'
  );
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.recruiting_ad_closures (
  ad_id         uuid primary key references public.recruiting_ads(id) on delete cascade,
  club_id       uuid not null references public.clubs(id) on delete cascade,
  reason        public.position_close_reason,
  reason_text   text,
  closed_by     uuid references public.profiles(id) on delete set null,
  closed_at     timestamptz not null default timezone('utc', now()),
  operation_key text,
  constraint recruiting_ad_closures_text_requires_other
    check (reason_text is null or reason = 'other'),
  -- Il limite è letterale: tienilo allineato a
  -- `position_close_reason_max_length()` e alla costante 300 del client.
  constraint recruiting_ad_closures_text_length
    check (reason_text is null or char_length(reason_text) <= 300)
);

comment on table public.recruiting_ad_closures is
  'DAS-REV-18 §20, §21: motivo della chiusura esplicita PUBLISHED -> CLOSED. '
  'Tabella separata da recruiting_ads perché quella è leggibile da ogni '
  'utente autenticato sulle righe non-draft: il motivo non compare nel '
  'payload pubblico, nel dettaglio candidato o in Cerca. Righe scritte solo '
  'da close_position.';

create index if not exists recruiting_ad_closures_club_closed_idx
  on public.recruiting_ad_closures (club_id, closed_at desc);

alter table public.recruiting_ad_closures enable row level security;

drop policy if exists "closures follow position management scope" on public.recruiting_ad_closures;
create policy "closures follow position management scope"
  on public.recruiting_ad_closures
  for select
  to authenticated
  using (
    public.owns_club(club_id)
    or public.society_position_in_scope(
         club_id,
         (select ra.team_id from public.recruiting_ads ra where ra.id = recruiting_ad_closures.ad_id),
         'positions_view'
       )
  );

create or replace function public.position_close_reason_max_length()
returns integer
language sql
immutable
set search_path = public
as $$
  select 300;
$$;

revoke all on function public.position_close_reason_max_length() from public;
grant execute on function public.position_close_reason_max_length() to authenticated;

comment on function public.position_close_reason_max_length() is
  'DAS-REV-18 §20: limite del testo "Altro" esteso. Deve restare uguale al '
  'CHECK letterale di recruiting_ad_closures e alla costante 300 del client: '
  'un CHECK non può chiamare questa funzione, quindi l''allineamento è '
  'manuale.';


-- ============================================================
-- SEZIONE 3 — immutabilità di una Position chiusa (§25)
--
-- La policy "club owners can manage ads" (2026-03-09) è `for all`: un owner
-- può oggi fare UPDATE o DELETE diretti via REST anche su una riga già
-- CLOSED. Il trigger chiude il buco a livello di dominio, indipendentemente
-- da chi tenta la scrittura.
--
-- Confronto per differenza (`to_jsonb(...) - 'updated_at'`) invece che per
-- elenco di colonne: la transizione legittima PUBLISHED -> CLOSED (che
-- `close_position` esegue) ha `old.status = 'published'`, quindi non entra
-- mai in questo guard — la condizione è sempre `old.status = 'closed'`.
-- ============================================================

create or replace function public.recruiting_ads_closed_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'closed' then
      raise exception 'POSITION_CLOSED_IMMUTABLE';
    end if;
    return old;
  end if;

  -- UPDATE: solo `updated_at` può muoversi su una riga già CLOSED. Qualunque
  -- altra differenza — inclusa una riscrittura dei soli campi "innocui" come
  -- il titolo — è rifiutata per intero.
  if old.status = 'closed'
     and (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
    raise exception 'POSITION_CLOSED_IMMUTABLE';
  end if;

  return new;
end;
$$;

drop trigger if exists recruiting_ads_closed_immutable on public.recruiting_ads;
create trigger recruiting_ads_closed_immutable
before update or delete on public.recruiting_ads
for each row execute function public.recruiting_ads_closed_immutable();

comment on function public.recruiting_ads_closed_immutable() is
  'DAS-REV-18 §25: una Position CLOSED non è più scrivibile, nemmeno via '
  'UPDATE/DELETE diretto della policy owner `for all`. La transizione '
  'PUBLISHED -> CLOSED di close_position non è mai old.status = ''closed'', '
  'quindi la attraversa senza essere bloccata.';


-- ============================================================
-- SEZIONE 4 — `set_position_deadline` riemessa (§9, §13, §16, §38)
--
-- Le colonne OUT cambiano: `create or replace` non può farlo, serve il drop
-- esplicito della vecchia firma a 3 colonne.
--
-- Guard aggiunti rispetto alla versione DAS-REV-16: `status = 'closed'` è
-- ora un conflitto di lifecycle esplicito (§16 — «Il percorso è vietato su
-- CLOSED»), e una data già trascorsa nel momento del salvataggio è un errore
-- di dominio dedicato (§38), non un `POSITION_VERSION_CONFLICT` o un
-- successo silenzioso. "Oggi" resta ammesso finché il giorno locale non è
-- finito, perché il cutoff di oggi è la mezzanotte di domani.
-- ============================================================

drop function if exists public.set_position_deadline(uuid, integer, date);

create or replace function public.set_position_deadline(
  p_ad_id            uuid,
  p_expected_version integer,
  p_deadline_date    date
)
returns table (
  position_id      uuid,
  resource_version integer,
  status           text,
  deadline_at      timestamptz,
  deadline_date    date,
  deadline_timezone text,
  receiving_closed boolean,
  server_now       timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad   record;
  v_tz   text;
  v_at   timestamptz;
  v_now  timestamptz := timezone('utc', now());
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select ra.* into v_ad
  from public.recruiting_ads ra
  where ra.id = p_ad_id
  for update;

  if not found then
    raise exception 'POSITION_NOT_FOUND';
  end if;

  if not public.position_can_operate_on_ad(p_ad_id, 'edit') then
    raise exception 'POSITION_NOT_AUTHORIZED';
  end if;

  -- §16: «Il percorso è vietato su CLOSED.» Non esiste oggi: senza questo
  -- guard si poteva impostare una scadenza su una Position già chiusa.
  --
  -- Il lifecycle si controlla **prima** della versione, non dopo: una
  -- chiusura concorrente bumpa anche `resource_version`, quindi l'ordine
  -- inverso riporterebbe «La posizione è stata aggiornata» a chi invece
  -- deve leggere «La posizione è stata chiusa e non può più essere
  -- modificata» (§38).
  if v_ad.status = 'closed' then
    raise exception 'POSITION_LIFECYCLE_CONFLICT';
  end if;

  if p_expected_version is not null
     and p_expected_version <> v_ad.resource_version then
    raise exception 'POSITION_VERSION_CONFLICT';
  end if;

  v_tz := public.society_position_timezone(v_ad.club_id);

  if p_deadline_date is null then
    v_at := null;
  else
    v_at := public.position_deadline_cutoff(p_deadline_date, v_tz);

    -- §38: «La data scelta è trascorsa.» "Oggi" è sempre ammesso: il cutoff
    -- di oggi è la mezzanotte di domani, quindi è nel futuro finché non è
    -- davvero finito il giorno locale.
    if v_at <= v_now then
      raise exception 'POSITION_DEADLINE_PAST';
    end if;
  end if;

  update public.recruiting_ads
     set application_deadline_at = v_at,
         application_deadline_timezone = case when v_at is null then null else v_tz end,
         updated_at = timezone('utc', now())
   where id = p_ad_id;

  return query
  select
    ra.id,
    ra.resource_version,
    ra.status::text,
    ra.application_deadline_at,
    case
      when ra.application_deadline_at is null then null
      else public.position_deadline_date(
             ra.application_deadline_at,
             coalesce(ra.application_deadline_timezone, v_tz)
           )
    end,
    ra.application_deadline_timezone,
    (ra.status = 'published'
      and ra.application_deadline_at is not null
      and v_now >= ra.application_deadline_at),
    v_now
  from public.recruiting_ads ra
  where ra.id = p_ad_id;
end;
$$;

revoke all on function public.set_position_deadline(uuid, integer, date) from public;
grant execute on function public.set_position_deadline(uuid, integer, date) to authenticated;

comment on function public.set_position_deadline(uuid, integer, date) is
  'DAS-REV-18 §8, §16, §38: cutoff esclusivo, vietato su CLOSED, rifiuta una '
  'data già trascorsa con POSITION_DEADLINE_PAST invece di un successo '
  'silenzioso o di un falso conflitto di versione.';


-- ============================================================
-- SEZIONE 5 — `close_position` (§19, §20, §22, §23)
--
-- Riusa il protocollo idempotente di `position_compose_operations`
-- (DAS-REV-16 §10): stessa chiave + stesso actor + stesso fingerprint ->
-- replay del risultato salvato; stessa chiave con fingerprint diverso ->
-- conflitto. Il CHECK di `kind` viene esteso con 'close' con lo stesso
-- pattern `drop constraint` + `add constraint` della 20261025090000.
--
-- Il nome **non** viene indovinato. Il CHECK originale (20261027090000:781)
-- è inline e senza nome esplicito, quindi si chiama quasi certamente
-- `position_compose_operations_kind_check`; ma «quasi certamente» qui non
-- basta, perché un `drop constraint if exists` sul nome sbagliato è un
-- no-op silenzioso e la vecchia regola continuerebbe a rifiutare
-- `kind = 'close'` con un errore di CHECK invece del flusso previsto. Il
-- blocco cerca quindi in `pg_constraint` tutti i CHECK della tabella che
-- menzionano `kind` e li rimuove per nome reale, qualunque esso sia.
--
-- Il reason viene normalizzato **prima** di ogni validazione, così «Altro
-- senza testo» passa: un `reason_text` fatto di soli spazi equivale ad
-- assente, non a un valore che richieda `reason = 'other'`.
-- ============================================================

do $$
declare
  v_name text;
begin
  for v_name in
    select con.conname
    from pg_constraint con
    join pg_class cls on cls.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relname = 'position_compose_operations'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%kind%'
  loop
    execute format(
      'alter table public.position_compose_operations drop constraint %I',
      v_name
    );
  end loop;
end;
$$;

alter table public.position_compose_operations
  add constraint position_compose_operations_kind_check
  check (kind in ('create', 'publish', 'close'));

create or replace function public.close_position(
  p_ad_id            uuid,
  p_expected_version integer,
  p_reason           text,
  p_reason_text      text,
  p_operation_key    text
)
returns table (
  position_id       uuid,
  status            text,
  closed_at         timestamptz,
  resource_version  integer,
  close_reason      text,
  close_reason_text text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_reason       public.position_close_reason;
  v_reason_text  text;
  v_fingerprint  text;
  v_existing     record;
  v_ad           record;
  v_closure      record;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_operation_key is null or char_length(p_operation_key) < 8 then
    raise exception 'POSITION_OPERATION_KEY_REQUIRED';
  end if;

  -- ── Normalizzazione e validazione del motivo, prima del protocollo
  --    idempotente (§20) ───────────────────────────────────────────────
  v_reason_text := nullif(btrim(coalesce(p_reason_text, '')), '');

  if p_reason is not null then
    begin
      v_reason := p_reason::public.position_close_reason;
    exception when invalid_text_representation then
      raise exception 'POSITION_CLOSE_REASON_INVALID';
    end;
  else
    v_reason := null;
  end if;

  if v_reason_text is not null and v_reason is distinct from 'other' then
    raise exception 'POSITION_CLOSE_REASON_TEXT_NOT_ALLOWED';
  end if;

  if v_reason_text is not null
     and char_length(v_reason_text) > public.position_close_reason_max_length() then
    raise exception 'POSITION_CLOSE_REASON_TEXT_TOO_LONG';
  end if;

  -- Fingerprint sui parametri grezzi: un retry byte-per-byte identico
  -- rigioca lo stesso esito; un payload diverso con la stessa chiave è un
  -- conflitto, non una seconda chiusura.
  v_fingerprint := md5(
    p_ad_id::text || '|' || coalesce(p_reason, '') || '|' || coalesce(p_reason_text, '')
  );

  select o.* into v_existing
  from public.position_compose_operations o
  where o.operation_key = p_operation_key;

  if found then
    if v_existing.kind <> 'close'
       or v_existing.actor_id <> v_uid
       or v_existing.fingerprint <> v_fingerprint then
      raise exception 'POSITION_OPERATION_CONFLICT';
    end if;

    return query
    select
      (v_existing.result ->> 'id')::uuid,
      v_existing.result ->> 'status',
      (v_existing.result ->> 'closedAt')::timestamptz,
      (v_existing.result ->> 'version')::integer,
      v_existing.result ->> 'closeReason',
      v_existing.result ->> 'closeReasonText';

    return;
  end if;

  -- ── Lock e guard sulla riga, nell'ordine della spec ───────────────────
  select ra.* into v_ad
  from public.recruiting_ads ra
  where ra.id = p_ad_id
  for update;

  if not found then
    raise exception 'POSITION_NOT_FOUND';
  end if;

  if not public.position_can_operate_on_ad(p_ad_id, 'edit') then
    raise exception 'POSITION_NOT_AUTHORIZED';
  end if;

  -- Vale sia per una DRAFT mai pubblicata sia per una CLOSED già chiusa: in
  -- nessuno dei due casi c'è una seconda chiusura da eseguire.
  if v_ad.status <> 'published' then
    raise exception 'POSITION_LIFECYCLE_CONFLICT';
  end if;

  if p_expected_version is not null
     and p_expected_version <> v_ad.resource_version then
    raise exception 'POSITION_VERSION_CONFLICT';
  end if;

  -- ── Scrittura atomica ─────────────────────────────────────────────────
  --
  -- `recruiting_ads_stamp_lifecycle` (20261026090000) stampa `closed_at` una
  -- sola volta all'ingresso in CLOSED: non viene ridatata qui.
  update public.recruiting_ads
     set status = 'closed'
   where id = p_ad_id;

  -- `on conflict do nothing`: se la riga di chiusura esiste già (una corsa
  -- fra due retry con chiavi diverse ma stesso ad_id, ad esempio), motivo,
  -- autore e data del primo commit non vengono sovrascritti (§22).
  insert into public.recruiting_ad_closures
    (ad_id, club_id, reason, reason_text, closed_by, operation_key)
  values
    (p_ad_id, v_ad.club_id, v_reason, v_reason_text, v_uid, p_operation_key)
  on conflict (ad_id) do nothing;

  select c.* into v_closure
  from public.recruiting_ad_closures c
  where c.ad_id = p_ad_id;

  select ra.* into v_ad
  from public.recruiting_ads ra
  where ra.id = p_ad_id;

  insert into public.position_compose_operations
    (operation_key, actor_id, club_id, kind, fingerprint, result)
  values (
    p_operation_key, v_uid, v_ad.club_id, 'close', v_fingerprint,
    jsonb_build_object(
      'id', v_ad.id,
      'status', v_ad.status::text,
      'closedAt', v_ad.closed_at,
      'version', v_ad.resource_version,
      'closeReason', v_closure.reason::text,
      'closeReasonText', v_closure.reason_text
    )
  );

  position_id       := v_ad.id;
  status            := v_ad.status::text;
  closed_at         := v_ad.closed_at;
  resource_version  := v_ad.resource_version;
  close_reason      := v_closure.reason::text;
  close_reason_text := v_closure.reason_text;
  return next;
end;
$$;

revoke all on function public.close_position(uuid, integer, text, text, text) from public;
grant execute on function public.close_position(uuid, integer, text, text, text) to authenticated;

comment on function public.close_position(uuid, integer, text, text, text) is
  'DAS-REV-18 §19, §22: chiusura esplicita PUBLISHED -> CLOSED, con motivo '
  'facoltativo. Idempotente sullo stesso protocollo di create/publish: retry '
  'identico rigioca l''esito, payload diverso con la stessa chiave è un '
  'conflitto. published_at e l''ID non vengono mai toccati.';


-- ============================================================
-- SEZIONE 6 — `fetch_society_position_detail` riemessa (§28)
--
-- Copia integrale della versione 20261028090000 (l'ultima, quella con lo
-- schema del composer e `blockers`), con tre aggiunte in coda e una
-- correzione:
--
--   * `close_reason` / `close_reason_text`: da `recruiting_ad_closures`, in
--     left join. Chi arriva a questo punto ha già superato il guard
--     `positions_view` in scope dell'inizio funzione, quindi non serve un
--     secondo controllo per restituirli — è l'applicazione pratica di §21:
--     «I permessi sullo storico continuano a controllarne la lettura», e qui
--     il permesso è già verificato.
--   * `deadline_history_visible`: vero su una CLOSED con una deadline
--     salvata, per lo storico (§28 — «mostra anche Scadenza candidature se
--     era presente alla chiusura, con il valore storico conservato»).
--   * **Correzione**: `deadline_date` passa da un cast diretto a
--     `position_deadline_date(...)`. Con il cutoff esclusivo della sezione 1,
--     il cast diretto mostrerebbe il giorno **successivo** a quello scelto.
--
-- Il drop è obbligato: le colonne OUT cambiano e `create or replace` non può
-- modificarle.
-- ============================================================

drop function if exists public.fetch_society_position_detail(uuid);

create or replace function public.fetch_society_position_detail(p_ad_id uuid)
returns table (
  position_id        uuid,
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  club_is_verified   boolean,
  club_region        text,
  club_city          text,
  title              text,
  description        text,
  role_required      text,
  target_role        text,
  profile_type       text,
  role_id            text,
  role_label         text,
  role_is_custom     boolean,
  custom_role_name   text,
  status             text,
  group_key          text,
  position_scope     text,
  team_id            uuid,
  team_name          text,
  team_is_inactive   boolean,
  context_label      text,
  season_label       text,
  region             text,
  age_mode           text,
  age_min            integer,
  age_max            integer,
  details            jsonb,
  secondary_teams    jsonb,
  compensation_summary text,
  published_at       timestamptz,
  updated_at         timestamptz,
  closed_at          timestamptz,
  deadline_at        timestamptz,
  deadline_date      date,
  deadline_timezone  text,
  receiving_closed   boolean,
  counts_available   boolean,
  applications_total integer,
  applications_new   integer,
  can_edit           boolean,
  can_publish        boolean,
  can_close          boolean,
  has_details        boolean,
  blockers           text[],
  resource_version   integer,
  schema_version     integer,
  creation_batch_id  uuid,
  access_verified_at timestamptz,
  data_revision      bigint,
  close_reason       text,
  close_reason_text  text,
  deadline_history_visible boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_club    uuid;
  v_team    uuid;
  v_status  public.ad_status;
  v_caps    text[];
  v_group   text;
  v_season  text := public.current_season_id();
  v_now     timestamptz := timezone('utc', now());
  v_app_ok  boolean;
  v_edit    boolean;
  v_publish boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select ra.club_id, ra.team_id, ra.status
    into v_club, v_team, v_status
  from public.recruiting_ads ra
  where ra.id = p_ad_id;

  -- §23: «Un errore di autorizzazione non deve rivelare i dati della
  -- risorsa negata.» Inesistente e non autorizzata producono lo stesso
  -- esito, e lo stesso vale per la readiness: §23 vieta che «Readiness e
  -- numero di campi mancanti siano utilizzabili per sondare bozze private
  -- tramite ID arbitrari».
  if v_club is null then
    raise exception 'POSITION_NOT_AVAILABLE';
  end if;

  if not public.owns_club(v_club)
     and not public.club_access_is_active(v_club, v_uid) then
    raise exception 'POSITION_NOT_AVAILABLE';
  end if;

  v_caps := public.dashboard_club_capabilities(v_club);

  if not ('positions_view' = any (v_caps))
     or not public.society_position_in_scope(v_club, v_team, 'positions_view') then
    raise exception 'POSITION_NOT_AVAILABLE';
  end if;

  v_group := public.society_position_group(v_status);

  -- §5: «La sola capacità di leggere una Position non concede
  -- automaticamente accesso a nomi, conteggi, nuove candidature o dettagli
  -- dei candidati. Non mostrare conteggi protetti nemmeno come zero.»
  v_app_ok := ('applications_view' = any (v_caps))
           and public.society_position_in_scope(v_club, v_team, 'applications_view');

  -- Perimetro su **tutte** le squadre dell'incarico, principale e
  -- secondarie, non sulla sola principale.
  v_edit    := public.position_can_operate_on_ad(p_ad_id, 'edit');
  v_publish := public.position_can_operate_on_ad(p_ad_id, 'publish');

  return query
  select
    ra.id,
    ra.club_id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    c.region,
    c.city,
    nullif(btrim(ra.title), ''),
    nullif(btrim(ra.description), ''),
    ra.role_required::text,
    ra.target_role::text,
    ra.target_role::text,
    ra.structured_role_id,
    pr.label,
    coalesce(pr.is_custom, false),
    ra.custom_role_name,
    ra.status::text,
    v_group,
    ra.position_scope_type,
    ra.team_id,
    case
      when ra.position_scope_type = 'society' then null
      when v_group = 'closed' then coalesce(ra.published_team_name, ct.name)
      else ct.name
    end,
    coalesce(ct.is_archived, false),
    case
      when ra.position_scope_type = 'society' then null
      when v_group = 'closed' then
        coalesce(snap_lvl.label,
          case when snap_type.tier = 'youth' then 'Settore giovanile' end)
      else
        coalesce(cur_lvl.label,
          case when coalesce(cur_type.tier, ct.team_type) = 'youth'
            then 'Settore giovanile' end)
    end,
    case when v_group = 'closed' then snap_season.label end,
    ra.region,
    ra.age_mode,
    ra.age_min,
    ra.age_max,
    coalesce(ra.details, '{}'::jsonb),
    coalesce(
      (select jsonb_agg(jsonb_build_object(
                'teamId', t.id,
                'name',   t.name,
                'isInactive', t.is_archived
              ) order by t.sort_order, t.name)
         from public.recruiting_ad_teams rat
         join public.club_teams t on t.id = rat.team_id
        where rat.ad_id = ra.id),
      '[]'::jsonb
    ),
    nullif(btrim(ra.compensation_summary), ''),
    ra.published_at,
    ra.updated_at,
    ra.closed_at,
    ra.application_deadline_at,
    -- §8: proiezione del giorno civile via l'adapter, mai un cast diretto —
    -- con il cutoff esclusivo un cast diretto mostrerebbe il giorno dopo.
    case
      when ra.application_deadline_at is null then null
      else public.position_deadline_date(
             ra.application_deadline_at,
             coalesce(ra.application_deadline_timezone, public.society_position_timezone(ra.club_id))
           )
    end,
    ra.application_deadline_timezone,
    (ra.status = 'published'
      and ra.application_deadline_at is not null
      and v_now >= ra.application_deadline_at),
    v_app_ok,
    case when v_app_ok then (
      select count(*)::integer
      from public.recruiting_applications app
      where app.ad_id = ra.id and app.status <> 'withdrawn'
    ) end,
    /* §18: «aprire la posizione non deve segnare automaticamente tutte le
       candidature come lette». La lettura resta una lettura. */
    case when v_app_ok then (
      select count(*)::integer
      from public.recruiting_applications app
      where app.ad_id = ra.id and app.status = 'submitted'
    ) end,
    /* DAS-REV-15 §13: «Una Position CLOSED non espone modifica,
       riapertura, duplicazione o eliminazione in V1.» */
    v_edit and v_status <> 'closed',
    /* §7: «Un utente con modifica ma senza pubblicazione può completare e
       salvare la bozza; non vede Pubblica posizione.» Il permesso è qui, la
       validità del contenuto in `blockers`. */
    v_publish and v_status = 'draft',
    /* §19: Chiudi compare soltanto su una PUBLISHED e con permesso di
       modifica sull'intero incarico, squadre secondarie incluse. */
    v_edit and v_status = 'published',
    public.position_has_details(ra.id),
    public.position_publish_blockers(ra.id),
    ra.resource_version,
    ra.schema_version,
    ra.creation_batch_id,
    v_now,
    (extract(epoch from ra.updated_at) * 1000)::bigint,
    rac.reason::text,
    rac.reason_text,
    (ra.status = 'closed' and ra.application_deadline_at is not null)
  from public.recruiting_ads ra
  join public.clubs c on c.id = ra.club_id
  left join public.club_teams ct on ct.id = ra.team_id
  left join public.position_roles pr on pr.id = ra.structured_role_id
  left join public.club_team_seasons cur_cfg
    on cur_cfg.team_id = ct.id and cur_cfg.season_id = v_season
  left join public.team_levels cur_lvl  on cur_lvl.id = cur_cfg.level_id
  left join public.team_types  cur_type on cur_type.id = cur_cfg.team_type_id
  left join public.team_levels snap_lvl  on snap_lvl.id = ra.published_level_id
  left join public.team_types  snap_type on snap_type.id = ra.published_team_type_id
  left join public.seasons     snap_season on snap_season.id = ra.published_season_id
  left join public.recruiting_ad_closures rac on rac.ad_id = ra.id
  where ra.id = p_ad_id;
end;
$$;

revoke all on function public.fetch_society_position_detail(uuid) from public;
grant execute on function public.fetch_society_position_detail(uuid) to authenticated;

comment on function public.fetch_society_position_detail(uuid) is
  'DAS-REV-18 §28: estende la lettura gestionale unica di DAS-REV-17 con '
  'motivo di chiusura e visibilità dello storico deadline. Il guard '
  'positions_view dell''inizio funzione è l''unico controllo necessario: chi '
  'arriva fin qui può già leggere lo storico.';


-- ============================================================
-- SEZIONE 7 — `fetch_society_positions_page` riemessa (§26)
--
-- Copia integrale della versione più recente (20261027090000:2360, l'unica
-- che legge `position_scope_type` invece di dedurre SOCIETY da `team_id is
-- null`), con una sola aggiunta: `close_reason`, valorizzata soltanto nel
-- gruppo `closed` via left join su `recruiting_ad_closures`. Nessun
-- `close_reason_text`: §26 lo riserva al dettaglio.
--
-- Cursore opaco, logica di scope e ordinamento invariati: la sola modifica
-- tocca la colonna aggiunta in coda.
-- ============================================================

drop function if exists public.fetch_society_positions_page(uuid, text, text, uuid, text, integer);

create or replace function public.fetch_society_positions_page(
  p_club_id uuid,
  p_group   text default 'active',
  p_scope   text default 'all',
  p_team_id uuid default null,
  p_cursor  text default null,
  p_limit   integer default 20
)
returns table (
  position_id        uuid,
  title              text,
  role_required      text,
  target_role        text,
  status             text,
  position_scope     text,
  team_id            uuid,
  team_name          text,
  team_is_inactive   boolean,
  context_label      text,
  season_label       text,
  published_at       timestamptz,
  updated_at         timestamptz,
  closed_at          timestamptz,
  receiving_closed   boolean,
  counts_available   boolean,
  applications_total integer,
  applications_new   integer,
  sort_key           text,
  next_cursor        text,
  as_of              timestamptz,
  close_reason       text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_caps      text[];
  v_scope     uuid[];
  v_app_scope uuid[];
  v_app_view  boolean;
  v_group     text := coalesce(p_group, 'active');
  v_filter    text := coalesce(p_scope, 'all');
  v_limit     integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_season    text := public.current_season_id();
  v_as_of     timestamptz;
  v_after     text;
  v_now       timestamptz := timezone('utc', now());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_group not in ('active', 'drafts', 'closed') then
    raise exception 'POSITIONS_GROUP_INVALID';
  end if;

  if v_filter not in ('all', 'society', 'team') then
    raise exception 'POSITIONS_FILTER_INVALID';
  end if;

  -- §22: «Non usare un Team ID null ambiguo per significare sia Tutte sia
  -- Intera società.» Il tipo di filtro è esplicito e il Team ID vale solo
  -- per TEAM.
  if v_filter = 'team' and p_team_id is null then
    raise exception 'POSITIONS_FILTER_INVALID';
  end if;

  if v_filter <> 'team' and p_team_id is not null then
    raise exception 'POSITIONS_FILTER_INVALID';
  end if;

  if not public.owns_club(p_club_id)
     and not public.club_access_is_active(p_club_id, v_uid) then
    raise exception 'POSITIONS_CENTER_NOT_AUTHORIZED';
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  if not ('positions_view' = any (v_caps)) then
    raise exception 'POSITIONS_CENTER_NOT_AUTHORIZED';
  end if;

  v_scope     := public.dashboard_club_capability_scope(p_club_id, 'positions_view');
  v_app_view  := 'applications_view' = any (v_caps);
  v_app_scope := case when v_app_view
    then public.dashboard_club_capability_scope(p_club_id, 'applications_view')
  end;

  -- §15: «Una selezione arbitraria passata tramite query/deep link non va
  -- accettata o convertita silenziosamente in un accesso più ampio.» Un
  -- filtro fuori perimetro non diventa "tutte": diventa un errore.
  if v_filter = 'society' and v_scope is not null then
    raise exception 'POSITIONS_FILTER_NOT_AUTHORIZED';
  end if;

  if v_filter = 'team'
     and not (
       v_scope is null
       or p_team_id = any (v_scope)
     ) then
    raise exception 'POSITIONS_FILTER_NOT_AUTHORIZED';
  end if;

  if v_filter = 'team'
     and not exists (
       select 1 from public.club_teams ct
       where ct.id = p_team_id and ct.club_id = p_club_id
     ) then
    raise exception 'POSITIONS_FILTER_NOT_AUTHORIZED';
  end if;

  if p_cursor is null then
    v_as_of := v_now;
    v_after := null;
  else
    select d.as_of, d.sort_key
      into v_as_of, v_after
    from public.society_positions_cursor_decode(
      p_cursor, p_club_id, v_group, v_filter, p_team_id
    ) d;
  end if;

  return query
  with rows_in_scope as (
    select
      ra.id,
      nullif(btrim(ra.title), '')        as title,
      ra.role_required::text             as role_required,
      ra.target_role::text               as target_role,
      ra.status,
      ra.team_id,
      ra.position_scope_type,
      ra.published_at,
      ra.updated_at,
      ra.closed_at,
      ra.application_deadline_at,
      ct.name                            as team_name,
      coalesce(ct.is_archived, false)    as team_is_inactive,
      /* Contesto corrente: tipo e livello della stagione in corso. */
      cur_lvl.label                      as current_level_label,
      coalesce(cur_type.tier, ct.team_type) as current_tier,
      /* Contesto storico: la fotografia della prima pubblicazione. */
      snap_lvl.label                     as snapshot_level_label,
      snap_type.tier                     as snapshot_tier,
      ra.published_team_name             as snapshot_team_name,
      snap_season.label                  as snapshot_season_label,
      /* DAS-REV-18 §26: motivo di chiusura, solo per lo storico. */
      rac.reason::text                   as closure_reason,
      /* §9: l'aggregato è leggibile solo con `applications_view` nel
         perimetro di **questa** riga. Nessuna eccezione permissiva nel
         serializer del Centro. */
      (
        v_app_view
        and (
          v_app_scope is null
          or (ra.team_id is not null and ra.team_id = any (v_app_scope))
        )
      ) as counts_available
    from public.recruiting_ads ra
    left join public.club_teams ct
      on ct.id = ra.team_id
    left join public.club_team_seasons cur_cfg
      on cur_cfg.team_id = ct.id
     and cur_cfg.season_id = v_season
    left join public.team_levels cur_lvl on cur_lvl.id = cur_cfg.level_id
    left join public.team_types  cur_type on cur_type.id = cur_cfg.team_type_id
    left join public.team_levels snap_lvl on snap_lvl.id = ra.published_level_id
    left join public.team_types  snap_type on snap_type.id = ra.published_team_type_id
    left join public.seasons     snap_season on snap_season.id = ra.published_season_id
    left join public.recruiting_ad_closures rac on rac.ad_id = ra.id
    where ra.club_id = p_club_id
      and public.society_position_group(ra.status) = v_group
      /* Istante congelato: l'appartenenza di una riga alla consultazione non
         cambia mentre si scorre. */
      and ra.created_at <= v_as_of
      /* Scope della capability, applicato **prima** di aggregare, ordinare e
         paginare (§9). */
      and (v_scope is null or (ra.team_id is not null and ra.team_id = any (v_scope)))
      /* Filtro di consultazione, che restringe e non amplia. */
      and (
        v_filter = 'all'
        or (v_filter = 'society' and ra.position_scope_type = 'society')
        or (v_filter = 'team'    and ra.team_id = p_team_id)
      )
  ),
  with_counts as (
    select
      r.*,
      case when r.counts_available then (
        select count(*)::integer
        from public.recruiting_applications app
        where app.ad_id = r.id
          and app.status <> 'withdrawn'
          and app.created_at <= v_as_of
      ) end as applications_total,
      case when r.counts_available then (
        select count(*)::integer
        from public.recruiting_applications app
        where app.ad_id = r.id
          and app.status = 'submitted'
          and app.created_at <= v_as_of
      ) end as applications_new
    from rows_in_scope r
  ),
  keyed as (
    select
      w.*,
      case v_group
        when 'active' then
          (case when coalesce(w.applications_new, 0) > 0 then '0' else '1' end)
          || '|' || lpad((9999999999999
               - coalesce((extract(epoch from w.published_at) * 1000)::bigint, 0))::text, 13, '0')
          || '|' || w.id::text
        when 'drafts' then
          lpad((9999999999999
               - (extract(epoch from w.updated_at) * 1000)::bigint)::text, 13, '0')
          || '|' || w.id::text
        else
          (case when w.closed_at is null then '1' else '0' end)
          || '|' || lpad((9999999999999
               - coalesce((extract(epoch from w.closed_at) * 1000)::bigint, 0))::text, 13, '0')
          || '|' || w.id::text
      end as sort_key
    from with_counts w
  )
  select
    k.id,
    k.title,
    k.role_required,
    k.target_role,
    k.status::text,
    k.position_scope_type,
    k.team_id,
    /* §13: sulle righe storiche il nome è quello conservato, quando esiste.
       Una rinomina corrente non riscrive il significato storico. */
    case
      when k.position_scope_type = 'society' then null
      when v_group = 'closed' then coalesce(k.snapshot_team_name, k.team_name)
      else k.team_name
    end,
    k.team_is_inactive,
    case
      when k.position_scope_type = 'society' then null
      when v_group = 'closed' then
        coalesce(
          k.snapshot_level_label,
          case when k.snapshot_tier = 'youth' then 'Settore giovanile' end
        )
      else
        coalesce(
          k.current_level_label,
          case when k.current_tier = 'youth' then 'Settore giovanile' end
        )
    end,
    /* La stagione compare solo dove è un dato storico reale. */
    case when v_group = 'closed' then k.snapshot_season_label end,
    k.published_at,
    k.updated_at,
    k.closed_at,
    /* §17: ricezione, non lifecycle. Una PUBLISHED scaduta resta Attiva. */
    (k.status = 'published'
      and k.application_deadline_at is not null
      and v_now >= k.application_deadline_at),
    k.counts_available,
    k.applications_total,
    k.applications_new,
    k.sort_key,
    public.society_positions_cursor_encode(
      p_club_id, v_group, v_filter, p_team_id, v_as_of, k.sort_key
    ),
    v_as_of,
    /* §26: il testo "Altro" esteso resta nel dettaglio; qui solo il codice. */
    case when v_group = 'closed' then k.closure_reason else null end
  from keyed k
  where v_after is null or k.sort_key > v_after
  order by k.sort_key
  limit v_limit;
end;
$$;

revoke all on function public.fetch_society_positions_page(uuid, text, text, uuid, text, integer) from public;
grant execute on function public.fetch_society_positions_page(uuid, text, text, uuid, text, integer) to authenticated;

comment on function public.fetch_society_positions_page(uuid, text, text, uuid, text, integer) is
  'DAS-REV-18 §26: estende la pagina del Centro con il codice del motivo di '
  'chiusura, valorizzato soltanto nel gruppo Chiuse. Il testo "Altro" esteso '
  'resta riservato al dettaglio.';


-- ============================================================
-- SEZIONE 8 — guard transazionale della candidatura (§17, §23)
--
-- a) `enforce_application_submission_window` riemessa con un lock di riga.
--    Senza `for share`, una chiusura concorrente che fa `for update` fra la
--    lettura del trigger e il commit dell'insert produce una candidatura
--    accettata su una Position appena chiusa: il lock serializza l'insert
--    dietro il `for update` di `close_position`, e la rilettura successiva
--    al lock vede lo stato definitivo.
--
-- b) `apply_to_position`: la RPC che il client dovrebbe usare al posto
--    dell'insert diretto in `recruiting_applications` (vedi nota di
--    rollout). Rivalida lo stato dell'ad sotto lo stesso lock `for share`,
--    distingue `POSITION_CLOSED` da `POSITION_DEADLINE_PASSED`, e un retry
--    dopo un insert già committato restituisce la candidatura esistente con
--    `replayed = true` invece di un errore o di un duplicato.
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
  -- Punto di linearizzazione: l'insert attende qui il `for update` di una
  -- chiusura concorrente e rilegge lo stato definitivo prima di procedere.
  select * into v_ad
  from public.recruiting_ads
  where id = new.ad_id
  for share;

  if not found then
    raise exception 'Questa posizione non è più disponibile.';
  end if;

  if v_ad.status <> 'published' then
    raise exception 'Questa posizione non accetta più candidature.';
  end if;

  -- Il valore è ora esclusivo (sezione 1): il confronto resta `>=`, ma
  -- significa "il cutoff è già iniziato", non più "l'ultimo microsecondo è
  -- già passato".
  if v_ad.application_deadline_at is not null
     and timezone('utc', now()) >= v_ad.application_deadline_at then
    raise exception 'Il termine per candidarsi è scaduto.';
  end if;

  return new;
end;
$$;

comment on function public.enforce_application_submission_window() is
  'DAS-REV-18 §17: rivalidazione del cutoff al momento dell''insert, sotto '
  'un lock FOR SHARE sulla riga della Position. Senza il lock, una chiusura '
  'committata fra la lettura del trigger e il commit dell''insert poteva '
  'produrre una candidatura accettata su una Position già chiusa.';


create or replace function public.apply_to_position(
  p_ad_id          uuid,
  p_cover_message  text
)
returns table (
  application_id uuid,
  status         text,
  created_at     timestamptz,
  replayed       boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_ad   public.recruiting_ads%rowtype;
  v_app  record;
  v_now  timestamptz := timezone('utc', now());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.player_profiles pp where pp.profile_id = v_uid
  ) then
    raise exception 'POSITION_APPLICANT_NOT_ELIGIBLE';
  end if;

  -- Stesso punto di linearizzazione del trigger: la candidatura rivaluta lo
  -- stato corrente sotto lock, non quello letto da una pagina aperta prima
  -- del cutoff o prima della chiusura.
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

  if v_ad.target_role::text <> 'player' then
    raise exception 'POSITION_ROLE_NOT_SUPPORTED';
  end if;

  -- Il controllo del duplicato va dopo i guard di stato: un invio mai
  -- committato rivalida lo stato corrente invece di essere scambiato per un
  -- retry.
  begin
    insert into public.recruiting_applications
      (ad_id, applicant_profile_id, player_profile_id, cover_message, status)
    values (
      p_ad_id, v_uid, v_uid,
      nullif(btrim(coalesce(p_cover_message, '')), ''),
      'submitted'
    )
    /* Qualificato: `status` e `created_at` sono anche nomi di colonna OUT di
       questa funzione, e in un RETURNING non qualificato plpgsql non sa
       quale dei due intendi — l'errore è «column reference is ambiguous», a
       runtime e non alla creazione. */
    returning
      recruiting_applications.id,
      recruiting_applications.status::text,
      recruiting_applications.created_at
      into v_app;

    application_id := v_app.id;
    status         := v_app.status;
    created_at     := v_app.created_at;
    replayed       := false;
    return next;
  exception when unique_violation then
    -- §43.78: un retry dopo un invio già committato recupera l'esito anche
    -- dopo il cutoff, senza duplicare e senza sollevare un errore di dominio.
    select a.id, a.status::text, a.created_at into v_app
    from public.recruiting_applications a
    where a.ad_id = p_ad_id and a.applicant_profile_id = v_uid;

    application_id := v_app.id;
    status         := v_app.status;
    created_at     := v_app.created_at;
    replayed       := true;
    return next;
  end;
end;
$$;

revoke all on function public.apply_to_position(uuid, text) from public;
grant execute on function public.apply_to_position(uuid, text) to authenticated;

comment on function public.apply_to_position(uuid, text) is
  'DAS-REV-18 §17, §23: candidatura atomica e rivalidata sotto lock. '
  'POSITION_CLOSED e POSITION_DEADLINE_PASSED sono motivi di dominio '
  'distinti; un retry su unique_violation restituisce l''esistente con '
  'replayed = true invece di fallire o duplicare. Le notifiche restano nel '
  'client, come oggi.';


-- ============================================================
-- SEZIONE 9 — `dashboard_position_action_state` riemessa (§32)
--
-- Stesso contratto di ritorno (`jsonb`, nessun cambio di colonne OUT: niente
-- drop) con quattro differenze:
--
--   * `status` (il lifecycle dell'ad) nel payload;
--   * `deadline_date`, via l'adapter: con il cutoff esclusivo un client che
--     formattasse `deadline_at` direttamente nel fuso mostrerebbe il giorno
--     successivo;
--   * `reason = 'position_closed'` quando lo stato è CLOSED, distinto da
--     `reason = 'deadline_passed'` quando è PUBLISHED con cutoff superato —
--     prima erano entrambi schiacciati su `not_available`;
--   * il confronto di apertura era già `now() < application_deadline_at`:
--     nessun cambiamento necessario, era già compatibile col cutoff
--     esclusivo.
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

  if not found or v_ad.status = 'draft' then
    return jsonb_build_object(
      'action_type',       'none',
      'can_apply',         false,
      'already_applied',   false,
      'is_open',           false,
      'status',            case when found then v_ad.status::text else null end,
      'deadline_at',       null,
      'deadline_date',     null,
      'deadline_timezone', null,
      'reason',            'not_available'
    );
  end if;

  if v_ad.status = 'closed' then
    return jsonb_build_object(
      'action_type',       'none',
      'can_apply',         false,
      'already_applied',   false,
      'is_open',           false,
      'status',            v_ad.status::text,
      'deadline_at',       v_ad.application_deadline_at,
      'deadline_date',
        case
          when v_ad.application_deadline_at is null then null
          else public.position_deadline_date(
                 v_ad.application_deadline_at,
                 coalesce(v_ad.application_deadline_timezone,
                          public.society_position_timezone(v_ad.club_id))
               )
        end,
      'deadline_timezone', v_ad.application_deadline_timezone,
      -- §32: distinto da `deadline_passed`. Una CLOSED è chiusa per
      -- decisione esplicita, non perché il cutoff sia scaduto.
      'reason',            'position_closed'
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
    'status',            v_ad.status::text,
    'deadline_at',       v_ad.application_deadline_at,
    'deadline_date',
      case
        when v_ad.application_deadline_at is null then null
        else public.position_deadline_date(
               v_ad.application_deadline_at,
               coalesce(v_ad.application_deadline_timezone,
                        public.society_position_timezone(v_ad.club_id))
             )
      end,
    'deadline_timezone', v_ad.application_deadline_timezone,
    'reason',            v_reason
  );
end;
$$;

revoke all on function public.dashboard_position_action_state(uuid) from public;
grant execute on function public.dashboard_position_action_state(uuid) to authenticated;

comment on function public.dashboard_position_action_state(uuid) is
  'DAS-REV-18 §32: aggiunge status e deadline_date (via l''adapter del '
  'cutoff esclusivo) e distingue position_closed da deadline_passed. '
  'action_type resta apply | none; already_applied e role_not_supported '
  'restano invariati.';


-- ============================================================
-- SEZIONE 10 — `fetch_position_drafts` riemessa (§8)
--
-- Non cambia nessuna colonna OUT, quindi basta un `create or replace`: cambia
-- una sola espressione, la proiezione del giorno civile della scadenza.
--
-- È la terza e ultima lettura che riproiettava il cutoff con un cast diretto
-- (le altre due sono il dettaglio gestionale e lo stato azione). Dimenticarla
-- avrebbe prodotto il bug più silenzioso di tutta la migrazione: il composer
-- avrebbe continuato a funzionare, ma l'anteprima e lo sheet della bozza
-- avrebbero mostrato il **giorno successivo** a quello salvato, e il gestore
-- avrebbe corretto una data che era già giusta.
-- ============================================================

create or replace function public.fetch_position_drafts(p_ids uuid[])
returns table (
  position_id         uuid,
  club_id             uuid,
  club_name           text,
  club_logo_url       text,
  club_is_verified    boolean,
  club_region         text,
  club_city           text,
  profile_type        text,
  role_id             text,
  role_label          text,
  role_is_custom      boolean,
  custom_role_name    text,
  title               text,
  position_scope      text,
  team_id             uuid,
  team_name           text,
  context_label       text,
  secondary_teams     jsonb,
  age_mode            text,
  age_min             integer,
  age_max             integer,
  description         text,
  details             jsonb,
  deadline_at         timestamptz,
  deadline_date       date,
  deadline_timezone   text,
  status              text,
  published_at        timestamptz,
  resource_version    integer,
  schema_version      integer,
  creation_batch_id   uuid,
  can_edit            boolean,
  can_publish         boolean,
  has_details         boolean,
  blockers            text[],
  updated_at          timestamptz,
  access_verified_at  timestamptz
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

  select s.id into v_season
  from public.seasons s
  where current_date between s.starts_on and s.ends_on
  order by s.sort_order desc
  limit 1;

  return query
  select
    ra.id,
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    c.region,
    c.city,
    ra.target_role::text,
    ra.structured_role_id,
    pr.label,
    coalesce(pr.is_custom, false),
    ra.custom_role_name,
    ra.title,
    ra.position_scope_type,
    ra.team_id,
    ct.name,
    /* §17: un incarico SOCIETY non mostra categoria Team. */
    case
      when ra.position_scope_type = 'society' then null
      else coalesce(
        (select tl.label
           from public.club_team_seasons cts
           join public.team_levels tl on tl.id = cts.level_id
          where cts.team_id = ct.id and cts.season_id = v_season),
        (select tt.label
           from public.club_team_seasons cts
           join public.team_types tt on tt.id = cts.team_type_id
          where cts.team_id = ct.id and cts.season_id = v_season),
        nullif(ct.category, '')
      )
    end,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
                'teamId', t.id,
                'name',   t.name,
                'isInactive', t.is_archived
              ) order by t.sort_order, t.name)
         from public.recruiting_ad_teams rat
         join public.club_teams t on t.id = rat.team_id
        where rat.ad_id = ra.id),
      '[]'::jsonb
    ),
    ra.age_mode,
    ra.age_min,
    ra.age_max,
    ra.description,
    coalesce(ra.details, '{}'::jsonb),
    ra.application_deadline_at,
    /* Il giorno civile nel fuso della Società: il client non riconverte un
       istante UTC e non sposta il giorno (§23). */
    -- §8: l'adapter, non un cast diretto. Con il cutoff esclusivo della
    -- sezione 1 un cast diretto mostrerebbe il giorno successivo a quello
    -- scelto, e l'anteprima della bozza direbbe una data sbagliata.
    case
      when ra.application_deadline_at is null then null
      else public.position_deadline_date(
             ra.application_deadline_at,
             coalesce(ra.application_deadline_timezone,
                      public.society_position_timezone(ra.club_id))
           )
    end,
    ra.application_deadline_timezone,
    ra.status::text,
    ra.published_at,
    ra.resource_version,
    ra.schema_version,
    ra.creation_batch_id,
    public.position_can_operate_on_ad(ra.id, 'edit'),
    public.position_can_operate_on_ad(ra.id, 'publish'),
    public.position_has_details(ra.id),
    public.position_publish_blockers(ra.id),
    ra.updated_at,
    timezone('utc', now())
  from public.recruiting_ads ra
  join public.clubs c on c.id = ra.club_id
  left join public.club_teams ct on ct.id = ra.team_id
  left join public.position_roles pr on pr.id = ra.structured_role_id
  where ra.id = any (coalesce(p_ids, array[]::uuid[]))
    and public.position_can_operate_on_ad(ra.id, 'view')
  order by ra.created_at, ra.id;
end;
$$;
revoke all on function public.fetch_position_drafts(uuid[]) from public;
grant execute on function public.fetch_position_drafts(uuid[]) to authenticated;

comment on function public.fetch_position_drafts(uuid[]) is
  'DAS-REV-18 §8: la proiezione del giorno civile passa dall''adapter del '
  'cutoff esclusivo. Nessun''altra differenza dalla versione DAS-REV-16.';
