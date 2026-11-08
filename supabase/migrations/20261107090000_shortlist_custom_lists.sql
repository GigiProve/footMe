-- ============================================================
-- DAS-REV-27 — Liste personalizzate e QA Shortlist
-- La 24 ha consegnato il core unico, la 25 entry/valutazione/filtri, la 26
-- la stella e il default Solo io con `owner_profile_id` + `access_mode`.
-- Mancava tutto il governo della singola CUSTOM (§1, §3):
--   1. **condivisione selettiva** (§11, §13): `access_mode` acquista
--      'shared' e nasce `club_shortlist_shares` (lista, utente, autore,
--      data; unicità lista/utente). L'owner è autorizzato implicitamente e
--      non compare mai fra le condivisioni (§7, Q27-24).
--   2. **versione, eliminazione, audit** (§7, §16, §22, §26): `version`
--      per il compare-and-swap di modifica, accessi e recupero;
--      `deleted_at` per un'eliminazione che conserva l'audit senza Cestino
--      nella UI; `club_shortlist_governance_log` come audit tecnico
--      ristretto, senza nomi di liste, descrizioni, note o persone.
--   3. **un solo predicato di accesso per lista**, `shortlist_list_access_ok
--      (lista)`. La 26 passava (tipo, modo, owner): con le condivisioni
--      serve l'id. Tutti i chiamanti della 26 sono riemessi dalla loro
--      definizione più recente con quella sola riga cambiata, e la firma a
--      tre argomenti viene eliminata, così un chiamante dimenticato fallisce
--      invece di concedere (§17).
--   4. **owner valido derivato** (§18): l'owner è valido finché è attivo
--      nella Società con `shortlist_view` nell'ambito della lista. Non è un
--      flag scritto: torna valido da solo se riottiene l'accesso prima del
--      recupero (§19, Q27-20). Le **condivisioni**, invece, si revocano
--      davvero quando l'eligibility cade (§14: «non si riattiva
--      silenziosamente quando i permessi tornano»): un trigger differito a
--      fine transazione sulle tabelle di accesso organizzativo le
--      riconcilia, dopo che `club_admin_apply_membership_permissions` ha
--      finito di riproiettare (cancella e reinserisce).
--   5. **comandi**: creazione con accesso esplicito (stesso servizio della
--      26, stessa firma estesa), modifica con cambio ambito e
--      riconciliazione, gestione accessi owner-only, eliminazione,
--      recupero amministrativo con read model minimo, tutti idempotenti
--      con le ricevute di `application_operations`.
--   6. **migrazione delle liste storiche** (§25): il creatore storico è
--      affidabile — la policy di insert RET-07 imponeva
--      `is_current_user(created_by_profile_id)` — e diventa owner solo se
--      oggi è ancora idoneo. L'audience storica resta 'scope' (capability
--      ∩ perimetro), cioè esattamente quella dimostrabile: nessuna lista
--      viene privatizzata o allargata in massa. Le liste senza creatore
--      idoneo restano integre e compaiono nel recupero.
-- Capability (§8). Il catalogo DAS-REV-14 ha **un** controllo «Crea e
-- gestisci Shortlist» → `shortlist_create_lists`. Non esiste una chiave
-- «Gestire liste» separata, e introdurne una toccherebbe il catalogo
-- permessi, la proiezione e i ruoli di tutte le Società: decisione di
-- prodotto da confermare. Il backend distingue comunque i due intenti in
-- un punto solo, `shortlist_manage_key()`: oggi coincide con la creazione,
-- domani si cambia lì. Il recupero usa `admins_manage_scope` («Cambia ruolo
-- e ambito degli amministratori», §19: «capability amministrativa
-- organizzativa appropriata già presente»), mai il nome del ruolo.
-- Nessun insert in `public.notifications`, nessuna Application, nessun
-- evento pubblico o analytics in tutto il file (§26).
-- ============================================================


-- ============================================================
-- SEZIONE 1 — schema (§7, §22, §26)
-- ============================================================

alter table public.club_shortlists
  drop constraint if exists club_shortlists_access_mode_check;

alter table public.club_shortlists
  add constraint club_shortlists_access_mode_check
  check (access_mode in ('scope', 'owner_only', 'shared'));

alter table public.club_shortlists
  add column if not exists version integer not null default 1;

alter table public.club_shortlists
  add column if not exists deleted_at timestamptz;

alter table public.club_shortlists
  add column if not exists deleted_by_profile_id uuid
    references public.profiles(id) on delete set null;

/* §7: POSITION non ha owner, Solo io, ACL né eliminazione manuale. */
alter table public.club_shortlists
  drop constraint if exists club_shortlists_position_lifecycle_check;

alter table public.club_shortlists
  add constraint club_shortlists_position_lifecycle_check
  check (list_type = 'custom' or deleted_at is null);

create index if not exists club_shortlists_live_custom_idx
  on public.club_shortlists (club_id, last_activity_at desc, id desc)
  where list_type = 'custom' and deleted_at is null;

comment on column public.club_shortlists.version is
  'DAS-REV-27 §22: versione per compare-and-swap di modifica lista, accessi '
  'e recupero. Avanza solo con un comando di governo, mai con le entry.';

comment on column public.club_shortlists.deleted_at is
  'DAS-REV-27 §16: eliminazione CUSTOM. La riga, le entry e l''audit restano '
  'per integrità; nessun lettore e nessun comando la considera più.';

create table if not exists public.club_shortlist_shares (
  shortlist_id          uuid not null references public.club_shortlists(id) on delete cascade,
  profile_id            uuid not null references public.profiles(id) on delete cascade,
  created_at            timestamptz not null default timezone('utc', now()),
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  /* §7: «Imporre unicità delle condivisioni per lista/utente». */
  primary key (shortlist_id, profile_id)
);

create index if not exists club_shortlist_shares_profile_idx
  on public.club_shortlist_shares (profile_id);

alter table public.club_shortlist_shares enable row level security;
-- Nessuna policy: la tabella si legge e si scrive soltanto dai comandi e dai
-- lettori `security definer` (§13: «Gestisci accesso ha un read model
-- distinto autorizzato»; §9: il collaboratore non vede l'elenco degli altri).

comment on table public.club_shortlist_shares is
  'DAS-REV-27 §7, §13: condivisioni attive di una CUSTOM. Una riga non '
  'concede nulla da sola: l''accesso resta capability ∩ scope ∩ lista. Le '
  'righe cadute per perdita di eligibility vengono eliminate, non sospese.';

create table if not exists public.club_shortlist_governance_log (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubs(id) on delete cascade,
  shortlist_id     uuid not null references public.club_shortlists(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action           text not null check (action in (
    'created',
    'access_updated',
    'updated',
    'deleted',
    'owner_reassigned',
    'owner_migrated',
    'shares_reconciled'
  )),
  version          integer,
  /* §26: solo conteggi e identificatori tecnici, mai nomi o testi. */
  details          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default timezone('utc', now())
);

create index if not exists club_shortlist_governance_log_list_idx
  on public.club_shortlist_governance_log (shortlist_id, created_at desc);

alter table public.club_shortlist_governance_log enable row level security;

/* §26: «accesso ristretto e retention comune». Stesso perimetro
   dell'audit amministrativo (20261024090000): il solo Owner della Società. */
drop policy if exists "club owners read shortlist governance log"
  on public.club_shortlist_governance_log;
create policy "club owners read shortlist governance log"
  on public.club_shortlist_governance_log for select to authenticated
  using (public.owns_club(club_id));


-- ============================================================
-- SEZIONE 2 — predicati (§8, §11, §18, §19)
-- ============================================================

/**
 * Capability e perimetro di una persona **qualunque**, non dell'actor.
 *
 * `society_position_in_scope` legge `auth.uid()`; eligibility dei
 * collaboratori (§11), validità dell'owner (§18) e candidati al recupero
 * (§19) riguardano altre persone. Stessa semantica, riga per riga: Owner
 * della Società → sì; accesso organizzativo non attivo → no; chiave
 * societaria → ogni ambito; chiave di squadra → solo quella squadra, e mai
 * Intera società. Il QA confronta i due predicati sugli stessi actor.
 */
create or replace function public.shortlist_user_in_scope(
  p_club_id    uuid,
  p_team_id    uuid,
  p_profile_id uuid,
  p_key        text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_club_id is null or p_profile_id is null then
    return false;
  end if;

  if exists (
    select 1 from public.clubs c
    where c.id = p_club_id and c.owner_profile_id = p_profile_id
  ) then
    return true;
  end if;

  if not public.club_access_is_active(p_club_id, p_profile_id) then
    return false;
  end if;

  if exists (
    select 1 from public.club_member_permissions perm
    where perm.club_id = p_club_id
      and perm.profile_id = p_profile_id
      and perm.permission_key = p_key
      and perm.team_id is null
  ) then
    return true;
  end if;

  return p_team_id is not null and exists (
    select 1
    from public.club_member_permissions perm
    join public.club_teams ct on ct.id = perm.team_id and ct.club_id = perm.club_id
    where perm.club_id = p_club_id
      and perm.profile_id = p_profile_id
      and perm.permission_key = p_key
      and perm.team_id = p_team_id
  );
end;
$$;

revoke all on function public.shortlist_user_in_scope(uuid, uuid, uuid, text) from public;
/* Nessun grant: interno ai comandi. Esporlo permetterebbe di sondare i
   permessi altrui (§11: nessuna enumerazione di utenti non autorizzati). */

/** §8: «Gestire liste» in un punto solo. Vedi testata del file. */
create or replace function public.shortlist_manage_key()
returns text
language sql
immutable
as $$ select 'shortlist_create_lists'; $$;

/** §19: capability amministrativa di recupero, già presente nel catalogo. */
create or replace function public.shortlist_recovery_key()
returns text
language sql
immutable
as $$ select 'admins_manage_scope'; $$;

revoke all on function public.shortlist_manage_key() from public;
revoke all on function public.shortlist_recovery_key() from public;
grant execute on function public.shortlist_manage_key() to authenticated;
grant execute on function public.shortlist_recovery_key() to authenticated;

/**
 * Accesso della singola lista per l'actor corrente (§8, §17).
 *
 * Restringe capability ∩ perimetro, non lo sostituisce: ogni chiamante lo
 * combina con `society_position_in_scope`. Una POSITION non aggiunge
 * vincoli. Una CUSTOM eliminata non è accessibile a nessuno; una 'scope'
 * (storica) segue il perimetro; una Solo io solo al suo owner; una
 * condivisa all'owner e alle condivisioni attive.
 */
create or replace function public.shortlist_list_access_ok(p_shortlist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when cs.list_type = 'position' then true
      when cs.deleted_at is not null then false
      when cs.access_mode = 'scope' then true
      when cs.owner_profile_id is not null and cs.owner_profile_id = auth.uid() then true
      when cs.access_mode = 'shared' then exists (
        select 1 from public.club_shortlist_shares sh
        where sh.shortlist_id = cs.id and sh.profile_id = auth.uid()
      )
      else false
    end
    from public.club_shortlists cs
    where cs.id = p_shortlist_id
  ), false);
$$;

revoke all on function public.shortlist_list_access_ok(uuid) from public;
revoke execute on function public.shortlist_list_access_ok(uuid) from anon;
grant execute on function public.shortlist_list_access_ok(uuid) to authenticated;

comment on function public.shortlist_list_access_ok(uuid) is
  'DAS-REV-27 §8: accesso della singola lista (owner, condivisione attiva, '
  'policy storica di scope). Si combina sempre con capability ∩ perimetro.';

/** Perimetro di squadra effettivo di una lista (POSITION: quello della sua Position). */
create or replace function public.shortlist_list_team(p_shortlist_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when cs.list_type = 'position' then ad.team_id else cs.team_id end
  from public.club_shortlists cs
  left join public.recruiting_ads ad on ad.id = cs.position_id
  where cs.id = p_shortlist_id;
$$;

revoke all on function public.shortlist_list_team(uuid) from public;
revoke execute on function public.shortlist_list_team(uuid) from anon;
/* Letta dalla policy di select del contenitore, che gira come actor. */
grant execute on function public.shortlist_list_team(uuid) to authenticated;

/**
 * Owner ancora valido (§18): attivo nella Società, con `shortlist_view`
 * nell'ambito della lista. Derivato, mai scritto: §19 — «Se l'owner
 * originario torna valido prima del commit, il recupero non deve
 * sottrargli la lista».
 */
create or replace function public.shortlist_owner_valid(p_shortlist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select cs.owner_profile_id is not null
       and public.shortlist_user_in_scope(cs.club_id, cs.team_id, cs.owner_profile_id, 'shortlist_view')
    from public.club_shortlists cs
    where cs.id = p_shortlist_id and cs.list_type = 'custom'
  ), false);
$$;

revoke all on function public.shortlist_owner_valid(uuid) from public;

/**
 * Persona idonea a essere condivisa o a diventare owner (§11, §19): attiva
 * nella Società, `shortlist_view` nell'ambito dato. Una sola regola per
 * entrambi, così un nuovo owner non nasce già «da recuperare».
 */
create or replace function public.shortlist_person_eligible(
  p_club_id    uuid,
  p_team_id    uuid,
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.shortlist_user_in_scope(p_club_id, p_team_id, p_profile_id, 'shortlist_view');
$$;

revoke all on function public.shortlist_person_eligible(uuid, uuid, uuid) from public;

/** Etichetta organizzativa «Ruolo · Ambito» (§11: «ruolo organizzativo»), come il Centro amministratori. */
create or replace function public.shortlist_member_role_label(
  p_club_id    uuid,
  p_profile_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.clubs c
      where c.id = p_club_id and c.owner_profile_id = p_profile_id
    ) then 'Owner · Accesso completo'
    else (
      select concat_ws(' · ',
        coalesce(r.name, 'Accesso personalizzato'),
        public.club_admin_scope_label(
          m.scope_mode,
          (select array_agg(t.team_id) from public.club_admin_membership_teams t
            where t.membership_id = m.id)
        )
      )
      from public.club_admin_memberships m
      left join public.club_admin_roles r on r.id = m.role_id
      where m.club_id = p_club_id and m.profile_id = p_profile_id and m.status = 'active'
      limit 1
    )
  end;
$$;

revoke all on function public.shortlist_member_role_label(uuid, uuid) from public;

/** Etichetta d'ambito di un Team o di Intera società, senza una lista. */
create or replace function public.shortlist_team_label(p_team_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_team_id is null then 'Intera società'
    else (select ct.name from public.club_teams ct where ct.id = p_team_id)
  end;
$$;

revoke all on function public.shortlist_team_label(uuid) from public;

/** Audit tecnico minimo (§26). */
create or replace function public.shortlist_governance_audit(
  p_shortlist_id uuid,
  p_action       text,
  p_version      integer,
  p_details      jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.club_shortlist_governance_log
    (club_id, shortlist_id, actor_profile_id, action, version, details)
  select cs.club_id, cs.id, auth.uid(), p_action, p_version, coalesce(p_details, '{}'::jsonb)
  from public.club_shortlists cs
  where cs.id = p_shortlist_id;
$$;

revoke all on function public.shortlist_governance_audit(uuid, text, integer, jsonb) from public;

/** Abilita, nella sola transazione corrente, le scritture di governo (owner, accesso, eliminazione). */
create or replace function public.shortlist_governance_begin()
returns void
language sql
security definer
set search_path = public
as $$
  select set_config('prolink.shortlist_governance', 'on', true);
$$;

revoke all on function public.shortlist_governance_begin() from public;


-- ============================================================
-- SEZIONE 3 — guard di riga (§16, §22)
-- ============================================================

/**
 * Riemissione del trigger della 26: owner, accesso, versione ed
 * eliminazione cambiano soltanto dentro un comando di governo.
 *
 * La 26 bloccava ogni cambio di owner/accesso. Ora i comandi li cambiano,
 * e lo dicono alzando il flag di transazione con
 * `shortlist_governance_begin()` — funzione senza grant, quindi non
 * raggiungibile da PostgREST. Un update diretto (policy di update rimossa
 * qui sotto, ma anche un vecchio client o un'altra funzione) resta
 * respinto. Una lista eliminata non torna indietro: §16 — «Update
 * entry/ACL/rinomina concorrente su lista eliminata deve fallire senza
 * resurrezione».
 */
create or replace function public.stamp_club_shortlist_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_governance boolean := coalesce(current_setting('prolink.shortlist_governance', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if new.list_type = 'custom' then
      new.owner_profile_id := coalesce(auth.uid(), new.created_by_profile_id);
      new.access_mode      := 'owner_only';
    else
      new.owner_profile_id := null;
      new.access_mode      := 'scope';
    end if;
    new.version    := 1;
    new.deleted_at := null;
    new.deleted_by_profile_id := null;
  else
    if old.deleted_at is not null and pg_trigger_depth() <= 1 then
      raise exception 'SHORTLIST_NOT_AVAILABLE';
    end if;

    if (new.owner_profile_id is distinct from old.owner_profile_id
        or new.access_mode is distinct from old.access_mode
        or new.version is distinct from old.version
        or new.deleted_at is distinct from old.deleted_at
        or new.deleted_by_profile_id is distinct from old.deleted_by_profile_id)
       and not v_governance
       /* `on delete set null` dell'owner arriva dal trigger RI interno, con
          profondità > 1: è la cancellazione dell'account (26). */
       and pg_trigger_depth() <= 1 then
      raise exception 'SHORTLIST_ACCESS_IMMUTABLE';
    end if;
  end if;

  if new.list_type = 'custom'
     and (tg_op = 'INSERT'
          or new.name is distinct from old.name
          or new.description is distinct from old.description) then
    new.name        := btrim(coalesce(new.name, ''));
    new.description := nullif(btrim(coalesce(new.description, '')), '');

    if char_length(new.name) = 0 then
      raise exception 'SHORTLIST_LIST_NAME_REQUIRED';
    end if;

    if char_length(new.name) > public.shortlist_list_name_max_length() then
      raise exception 'SHORTLIST_LIST_NAME_TOO_LONG';
    end if;

    if new.description is not null
       and char_length(new.description) > public.shortlist_list_description_max_length() then
      raise exception 'SHORTLIST_LIST_DESCRIPTION_TOO_LONG';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.stamp_club_shortlist_access() is
  'DAS-REV-26 §18 + DAS-REV-27 §13, §16: ogni nuova CUSTOM nasce Solo io con '
  'owner = actor. Owner, accesso, versione ed eliminazione cambiano solo nei '
  'comandi di governo; una lista eliminata non si modifica più.';

/**
 * Le entry di una lista eliminata o non più accessibile non si scrivono
 * (§16, §22, CON-07, CON-10, Q27-34).
 *
 * Il lock condiviso sulla lista serializza la scrittura con i comandi di
 * governo, che la bloccano in esclusiva: eliminazione, accessi, ambito e
 * recupero. Dopo l'attesa, in READ COMMITTED, la riga riletta è quella
 * appena committata: un update partito prima della revoca o
 * dell'eliminazione fallisce al commit invece di passare con uno stato
 * vecchio («Rivalida autorizzazione al punto di commit»).
 *
 * L'accesso si ricontrolla solo dove scrive un actor della Società:
 * insert e campi di valutazione. Il collegamento automatico della
 * candidatura (`link_shortlist_entry_application`, 24) lo esegue il
 * candidato e tocca solo `application_id`; le cancellazioni a cascata
 * (account, Società) arrivano con profondità > 1.
 */
create or replace function public.guard_shortlist_entry_live()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list_id uuid := case when tg_op = 'DELETE' then old.shortlist_id else new.shortlist_id end;
  v_deleted timestamptz;
begin
  if pg_trigger_depth() > 1 and tg_op = 'DELETE' then
    return old;
  end if;

  select cs.deleted_at into v_deleted
  from public.club_shortlists cs
  where cs.id = v_list_id
  for share;

  if v_deleted is not null then
    raise exception 'SHORTLIST_NOT_AVAILABLE';
  end if;

  if auth.uid() is not null
     and (tg_op = 'INSERT'
          or tg_op = 'DELETE'
          or new.priority is distinct from old.priority
          or new.evaluation_status is distinct from old.evaluation_status
          or new.internal_note is distinct from old.internal_note)
     and not public.shortlist_list_access_ok(v_list_id) then
    raise exception 'SHORTLIST_NOT_AVAILABLE';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists guard_shortlist_entry_live on public.club_shortlist_entries;
create trigger guard_shortlist_entry_live
  before insert or update or delete on public.club_shortlist_entries
  for each row execute function public.guard_shortlist_entry_live();


-- ============================================================
-- SEZIONE 4 — il perimetro di una lista include il suo accesso (§8)
--
-- Stessa porta della 26 (RLS delle entry, update/remove della 25), ora con
-- il predicato per id. Le policy di scrittura dirette sul contenitore
-- vengono rimosse: creazione, modifica ed eliminazione passano soltanto dai
-- comandi della sezione 8 (§3: «Non lasciare una variante del form che
-- salva le liste con regole di accesso differenti»).
-- ============================================================

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
begin
  if p_shortlist_id is null then
    return false;
  end if;

  select cs.club_id into v_club
  from public.club_shortlists cs
  where cs.id = p_shortlist_id;

  if v_club is null then
    return false;
  end if;

  /* DAS-REV-27 §8: accesso della singola lista (owner, condivisione, storico). */
  if not public.shortlist_list_access_ok(p_shortlist_id) then
    return false;
  end if;

  return public.society_position_in_scope(v_club, public.shortlist_list_team(p_shortlist_id), p_key);
end;
$$;

comment on function public.shortlist_in_scope(uuid, text) is
  'DAS-REV-24 §22 + DAS-REV-27 §8: capability ∩ scope ∩ accesso corrente ∩ '
  'accesso della singola lista (owner valido o condivisione attiva).';

drop policy if exists "authorized members read club shortlists" on public.club_shortlists;
create policy "authorized members read club shortlists"
on public.club_shortlists
for select
to authenticated
using (
  public.shortlist_list_access_ok(id)
  and public.society_position_in_scope(club_id, public.shortlist_list_team(id), 'shortlist_view')
);

drop policy if exists "authorized members create club shortlists" on public.club_shortlists;
drop policy if exists "authorized members insert club shortlists" on public.club_shortlists;
drop policy if exists "authorized members update club shortlists" on public.club_shortlists;
drop policy if exists "authorized members delete club shortlists" on public.club_shortlists;


-- ============================================================
-- SEZIONE 5 — revoca delle condivisioni non più eleggibili (§14, §18)
--
-- «Una condivisione invalidata per perdita di eligibility non si riattiva
-- silenziosamente quando i permessi tornano: serve una nuova concessione
-- esplicita.» La lettura è già cumulativa (condivisione ∧ capability ∧
-- scope), quindi l'accesso cade subito; qui la riga viene anche eliminata,
-- perché tornare idonei non deve ridarla.
--
-- Trigger **differiti**: `club_admin_apply_membership_permissions`
-- cancella e reinserisce tutte le righe di una persona. Un trigger
-- immediato vedrebbe il buco intermedio e revocherebbe condivisioni ancora
-- valide. A fine transazione la proiezione è completa.
-- ============================================================

create or replace function public.shortlist_reconcile_profile_shares(
  p_club_id    uuid,
  p_profile_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_removed integer := 0;
  r record;
begin
  if p_club_id is null or p_profile_id is null then
    return 0;
  end if;

  perform public.shortlist_governance_begin();

  for r in
    delete from public.club_shortlist_shares sh
    using public.club_shortlists cs
    where cs.id = sh.shortlist_id
      and cs.club_id = p_club_id
      and sh.profile_id = p_profile_id
      and not public.shortlist_person_eligible(cs.club_id, cs.team_id, p_profile_id)
    returning sh.shortlist_id
  loop
    v_removed := v_removed + 1;

    /* §13: «Se non resta alcuna condivisione attiva, normalizza lo stato
       effettivo a Solo io». */
    update public.club_shortlists cs
       set access_mode = case
             when cs.access_mode = 'shared' and not exists (
               select 1 from public.club_shortlist_shares sh2 where sh2.shortlist_id = cs.id
             ) then 'owner_only'
             else cs.access_mode
           end,
           version = cs.version + 1
     where cs.id = r.shortlist_id and cs.deleted_at is null;

    perform public.shortlist_governance_audit(
      r.shortlist_id, 'shares_reconciled',
      (select cs.version from public.club_shortlists cs where cs.id = r.shortlist_id),
      jsonb_build_object('removed', 1, 'reason', 'eligibility')
    );
  end loop;

  return v_removed;
end;
$$;

revoke all on function public.shortlist_reconcile_profile_shares(uuid, uuid) from public;

create or replace function public.shortlist_shares_on_access_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'clubs' then
    if old.owner_profile_id is distinct from new.owner_profile_id then
      perform public.shortlist_reconcile_profile_shares(old.id, old.owner_profile_id);
    end if;
    return null;
  end if;

  perform public.shortlist_reconcile_profile_shares(old.club_id, old.profile_id);
  return null;
end;
$$;

revoke all on function public.shortlist_shares_on_access_change() from public;

drop trigger if exists shortlist_shares_on_permission_change on public.club_member_permissions;
create constraint trigger shortlist_shares_on_permission_change
  after update or delete on public.club_member_permissions
  deferrable initially deferred
  for each row execute function public.shortlist_shares_on_access_change();

drop trigger if exists shortlist_shares_on_member_change on public.club_members;
create constraint trigger shortlist_shares_on_member_change
  after update or delete on public.club_members
  deferrable initially deferred
  for each row execute function public.shortlist_shares_on_access_change();

drop trigger if exists shortlist_shares_on_admin_change on public.club_admin_memberships;
create constraint trigger shortlist_shares_on_admin_change
  after update or delete on public.club_admin_memberships
  deferrable initially deferred
  for each row execute function public.shortlist_shares_on_access_change();

drop trigger if exists shortlist_shares_on_club_owner_change on public.clubs;
create constraint trigger shortlist_shares_on_club_owner_change
  after update on public.clubs
  deferrable initially deferred
  for each row execute function public.shortlist_shares_on_access_change();


-- ============================================================
-- SEZIONE 6 — migrazione delle liste storiche (§25, OWN-13, OWN-14)
--
-- Prima: tutte le CUSTOM anteriori alla 26 hanno `access_mode = 'scope'` e
-- owner nullo (scelta conservativa della 26). Dopo: il creatore diventa
-- owner **solo** se oggi è ancora idoneo nell'ambito della lista; l'accesso
-- resta 'scope', l'unico contratto storico dimostrabile. Nessun nome,
-- descrizione, entry, nota, data o autore viene toccato. Le liste senza
-- creatore idoneo restano integre, owner nullo, e compaiono nel recupero
-- amministrativo. Idempotente: una seconda esecuzione non trova righe.
-- Le condivisioni non esistono prima di questo file: nessun duplicato
-- lista/utente da risolvere. Le entry hanno già l'unicità della 24.
-- ============================================================

do $$
declare
  v_assigned integer;
  v_pending  integer;
begin
  perform set_config('prolink.shortlist_governance', 'on', true);

  with assigned as (
    update public.club_shortlists cs
       set owner_profile_id = cs.created_by_profile_id
     where cs.list_type = 'custom'
       and cs.access_mode = 'scope'
       and cs.owner_profile_id is null
       and cs.deleted_at is null
       and cs.created_by_profile_id is not null
       and public.shortlist_person_eligible(cs.club_id, cs.team_id, cs.created_by_profile_id)
    returning cs.id, cs.club_id, cs.version
  )
  insert into public.club_shortlist_governance_log
    (club_id, shortlist_id, actor_profile_id, action, version, details)
  select a.club_id, a.id, null, 'owner_migrated', a.version,
         jsonb_build_object('source', 'created_by', 'access', 'scope')
  from assigned a;

  get diagnostics v_assigned = row_count;

  select count(*) into v_pending
  from public.club_shortlists cs
  where cs.list_type = 'custom' and cs.deleted_at is null and cs.owner_profile_id is null;

  /* §25: «Documenta i record da risolvere senza dati personali». */
  raise notice 'DAS-REV-27: % CUSTOM storiche con owner dal creatore, % da recuperare',
    v_assigned, v_pending;
end;
$$;


-- ============================================================
-- SEZIONE 7 — lettori riemessi con il predicato per lista (§8, §17)
--
-- Ogni funzione è copiata dalla sua definizione più recente
-- (20261106090000) e differisce soltanto nella chiamata marcata
-- «DAS-REV-27»: la firma a tre argomenti non conosce le condivisioni.
-- `add_profile_to_shortlist` cambia anche nel ramo di replay: una ricevuta
-- non restituisce più dati a chi ha perso la lista (§22).
-- ============================================================

/* shortlist_custom_destination_ok: copiata da 20261106090000 (definizione più recente); unica
   differenza: 1 chiamata all'accesso per lista, marcata «DAS-REV-27». */
create or replace function public.shortlist_custom_destination_ok(
  p_club_id      uuid,
  p_shortlist_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_shortlists cs
    where cs.id = p_shortlist_id
      and cs.club_id = p_club_id
      and cs.list_type = 'custom'
      and public.shortlist_list_access_ok(cs.id) /* DAS-REV-27 §8 */
      and public.society_position_in_scope(cs.club_id, cs.team_id, 'shortlist_add_profiles')
      and public.society_position_in_scope(cs.club_id, cs.team_id, 'shortlist_view')
  );
$$;

/* shortlist_person_in_any_list: copiata da 20261106090000 (definizione più recente); unica
   differenza: 1 chiamata all'accesso per lista, marcata «DAS-REV-27». */
create or replace function public.shortlist_person_in_any_list(
  p_club_id   uuid,
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
    from public.club_shortlist_entries e
    join public.club_shortlists cs on cs.id = e.shortlist_id
    left join public.recruiting_ads ad on ad.id = cs.position_id
    where cs.club_id = p_club_id
      and e.player_profile_id = p_person_id
      and public.shortlist_list_access_ok(cs.id) /* DAS-REV-27 §8 */
      and public.society_position_in_scope(
        cs.club_id,
        case when cs.list_type = 'position' then ad.team_id else cs.team_id end,
        'shortlist_view'
      )
  );
$$;

/* fetch_profile_shortlist_memberships: copiata da 20261106090000 (definizione più recente); unica
   differenza: 1 chiamata all'accesso per lista, marcata «DAS-REV-27». */
create or replace function public.fetch_profile_shortlist_memberships(
  p_club_id   uuid,
  p_person_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_items jsonb;
  v_total integer;
  v_can_add boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.shortlist_key_in_any_scope(p_club_id, 'shortlist_view') then
    raise exception 'SHORTLIST_NOT_AUTHORIZED';
  end if;

  with visible as (
    select
      e.id               as entry_id,
      e.revision,
      e.priority,
      e.evaluation_status,
      cs.id              as shortlist_id,
      cs.list_type,
      cs.position_id,
      cs.last_activity_at,
      ad.status::text    as ad_status,
      coalesce(log.generation, 1) as generation,
      case when cs.list_type = 'position' then ad.team_id else cs.team_id end as team_ref,
      case cs.list_type
        when 'position' then case ad.status::text
          when 'published' then 0 when 'draft' then 1 else 2 end
        else 3
      end as group_rank,
      case cs.list_type
        when 'position' then case ad.status::text
          when 'published' then coalesce(ad.published_at, ad.created_at)
          when 'draft'     then ad.updated_at
          else coalesce(ad.closed_at, ad.updated_at)
        end
        else cs.last_activity_at
      end as sort_at
    from public.club_shortlist_entries e
    join public.club_shortlists cs on cs.id = e.shortlist_id
    left join public.recruiting_ads ad on ad.id = cs.position_id
    left join public.club_shortlist_membership_log log
      on log.shortlist_id = cs.id and log.person_profile_id = e.player_profile_id
    where cs.club_id = p_club_id
      and e.player_profile_id = p_person_id
      and public.shortlist_list_access_ok(cs.id) /* DAS-REV-27 §8 */
      and public.society_position_in_scope(
        cs.club_id,
        case when cs.list_type = 'position' then ad.team_id else cs.team_id end,
        'shortlist_view'
      )
  ),
  ordered as (
    select v.*, row_number() over (
      order by v.group_rank, v.sort_at desc nulls last, v.shortlist_id desc
    ) as rn
    from visible v
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'entry_id',     o.entry_id,
      'shortlist_id', o.shortlist_id,
      'list_type',    o.list_type,
      'position_id',  o.position_id,
      'title', case
        when o.list_type = 'position' then public.shortlist_position_title(o.position_id)
        else (select cs2.name from public.club_shortlists cs2 where cs2.id = o.shortlist_id)
      end,
      'scope_label',  public.shortlist_scope_label(o.shortlist_id, o.position_id),
      'is_draft',     o.ad_status = 'draft',
      'is_closed',    o.ad_status = 'closed',
      'priority',     o.priority,
      'evaluation_status', o.evaluation_status,
      'revision',     o.revision,
      'generation',   o.generation,
      'can_edit_status', public.society_position_in_scope(p_club_id, o.team_ref, 'shortlist_edit_status'),
      'can_edit_note',   public.society_position_in_scope(p_club_id, o.team_ref, 'shortlist_add_notes'),
      'can_remove',      public.society_position_in_scope(p_club_id, o.team_ref, 'shortlist_remove_profiles')
    ) order by o.rn) filter (where o.rn <= 100), '[]'::jsonb),
    count(*)::integer
  into v_items, v_total
  from ordered o;

  v_can_add := public.shortlist_key_in_any_scope(p_club_id, 'shortlist_add_profiles')
               and public.shortlist_person_kind(p_person_id) is not null;

  return jsonb_build_object(
    'items',       v_items,
    'truncated',   v_total > 100,
    'can_add_more', v_can_add,
    'can_create',  v_can_add
                   and public.shortlist_key_in_any_scope(p_club_id, 'shortlist_create_lists'),
    'access_verified_at', timezone('utc', now())
  );
end;
$$;

/* fetch_shortlist_custom_lists: copiata da 20261106090000 (definizione più recente); unica
   differenza: 1 chiamata all'accesso per lista, marcata «DAS-REV-27». */
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
      /* DAS-REV-26 §18: una CUSTOM «Solo io» è del suo owner. */
      and public.shortlist_list_access_ok(cs.id) /* DAS-REV-27 §8 */
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

/* fetch_club_shortlists: copiata da 20261106090000 (definizione più recente); unica
   differenza: 1 chiamata all'accesso per lista, marcata «DAS-REV-27». */
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
    /* DAS-REV-26 §18 */
    and public.shortlist_list_access_ok(cs.id) /* DAS-REV-27 §8 */
  group by cs.id, cs.club_id, cs.name, cs.description, cs.scope, cs.team_id,
           ct.name, cs.created_by_profile_id, creator.full_name,
           cs.created_at, cs.updated_at, cs.last_activity_at
  order by cs.last_activity_at desc, cs.id desc
  limit p_limit
  offset p_offset;
end;
$$;

/* fetch_shortlist_membership: copiata da 20261106090000 (definizione più recente); unica
   differenza: 1 chiamata all'accesso per lista, marcata «DAS-REV-27». */
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
        /* DAS-REV-26 §9: una membership nella «Solo io» di un altro actor
           non riempie la stella (QA006). */
        and public.shortlist_list_access_ok(cs.id) /* DAS-REV-27 §8 */
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

/* fetch_shortlist_entries: copiata da 20261106090000 (definizione più recente); unica
   differenza: 1 chiamata all'accesso per lista, marcata «DAS-REV-27». */
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

  if not public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_view')
     or not public.shortlist_list_access_ok(v_list.id) /* DAS-REV-27 §8 */ then
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

/* fetch_shortlist_context: copiata da 20261106090000 (definizione più recente); unica
   differenza: 1 chiamata all'accesso per lista, marcata «DAS-REV-27». */
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
  is_draft       boolean,
  can_add_profiles    boolean,
  can_add_notes       boolean,
  can_view_notes      boolean,
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
     «column reference is ambiguous» a runtime. */
  if p_shortlist_id is not null then
    select * into v_list from public.club_shortlists cs0 where cs0.id = p_shortlist_id;
  elsif p_position_id is not null then
    select * into v_list from public.club_shortlists cs0 where cs0.position_id = p_position_id;
  else
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  if v_list.id is null then
    /* Nessun contenitore: può ancora essere una Position legittima senza
       profili. §9 — «Una route per position_id può leggere il contesto
       autorizzato e una lista vuota senza creare un record.» */
    if p_position_id is null then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    select * into v_ad from public.recruiting_ads where id = p_position_id;

    if not found then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    /* §9: una bozza senza perimetro persistito non è autorizzabile, e
       l'errore è distinto da «non esiste» perché il rimedio è diverso —
       completare il contesto nel flusso Position, non cercare altrove. */
    if v_ad.status = 'draft'
       and v_ad.position_scope_type is distinct from 'society'
       and v_ad.team_id is null then
      raise exception 'SHORTLIST_SCOPE_UNDEFINED';
    end if;

    if not public.society_position_in_scope(v_ad.club_id, v_ad.team_id, 'shortlist_view') then
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
    is_draft       := v_ad.status = 'draft';
    can_add_profiles    := 'shortlist_add_profiles' = any (v_caps);
    can_add_notes       := 'shortlist_add_notes' = any (v_caps);
    can_view_notes      := 'shortlist_add_notes' = any (v_caps);
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

  if not public.society_position_in_scope(v_club, v_team, 'shortlist_view')
     or not public.shortlist_list_access_ok(v_list.id) /* DAS-REV-27 §8 */ then
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
  is_draft  := v_list.list_type = 'position' and v_ad.status = 'draft';
  can_add_profiles    := 'shortlist_add_profiles' = any (v_caps);
  can_add_notes       := 'shortlist_add_notes' = any (v_caps);
  can_view_notes      := 'shortlist_add_notes' = any (v_caps);
  can_edit_status     := 'shortlist_edit_status' = any (v_caps);
  can_remove_profiles := 'shortlist_remove_profiles' = any (v_caps);
  access_verified_at  := timezone('utc', now());
  data_revision := (extract(epoch from v_list.last_activity_at) * 1000)::bigint;
  return next;
end;
$$;

/* fetch_shortlist_pool_page: copiata da 20261106090000 (definizione più recente); unica
   differenza: 1 chiamata all'accesso per lista, marcata «DAS-REV-27». */
create or replace function public.fetch_shortlist_pool_page(
  p_shortlist_id uuid,
  p_priorities   text[] default null,
  p_statuses     text[] default null,
  p_cursor       text   default null,
  p_limit        integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_list       public.club_shortlists%rowtype;
  v_team       uuid;
  v_limit      integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_priorities text[];
  v_statuses   text[];
  v_fingerprint text;
  v_cursor_at  timestamptz;
  v_cursor_id  uuid;
  v_total      bigint;
  v_filtered   bigint;
  v_can_notes  boolean;
  v_can_apps   boolean;
  v_can_edit   boolean;
  v_can_remove boolean;
  v_items      jsonb;
  v_next       text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_list from public.club_shortlists cs0 where cs0.id = p_shortlist_id;

  if not found then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  v_team := public.shortlist_scope_team(v_list.id);

  if not public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_view')
     or not public.shortlist_list_access_ok(v_list.id) /* DAS-REV-27 §8 */ then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  /* §8: «Un filtro non può diventare un modo per dedurre un campo che
     l'actor non può leggere … il backend rifiuta filtri su campi non
     autorizzati anche se il client nasconde il controllo.» Priorità e stato
     appartengono alla capacità «Visualizzare la shortlist nel relativo
     scope» del catalogo §8, già verificata sopra: chi è arrivato qui li
     legge, e quindi li può filtrare. La nota non è una dimensione di
     filtro, e infatti non compare fra i parametri. */
  v_priorities := public.shortlist_filter_normalize(
    p_priorities, array['alta', 'media', 'bassa', 'none']
  );
  v_statuses := public.shortlist_filter_normalize(
    p_statuses,
    array['da_valutare', 'interessante', 'da_contattare', 'contattato',
          'non_prioritario', 'scartato']
  );

  v_fingerprint := md5(
    coalesce(array_to_string(v_priorities, ','), '*') || '#' ||
    coalesce(array_to_string(v_statuses, ','), '*')
  );

  if p_cursor is not null and btrim(p_cursor) <> '' then
    /* §14: il cursore è validato contro lista e filtri. Un cursore di
       un'altra query non «degrada»: viene rifiutato, così il client ne
       chiede uno nuovo coerente invece di mescolare pagine incompatibili. */
    if split_part(p_cursor, '|', 1) is distinct from p_shortlist_id::text
       or split_part(p_cursor, '|', 2) is distinct from v_fingerprint then
      raise exception 'SHORTLIST_CURSOR_INVALID';
    end if;

    v_cursor_at := split_part(p_cursor, '|', 3)::timestamptz;
    v_cursor_id := split_part(p_cursor, '|', 4)::uuid;
  end if;

  v_can_notes  := public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_add_notes');
  v_can_apps   := public.society_position_in_scope(v_list.club_id, v_team, 'applications_view');
  v_can_edit   := public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_edit_status');
  v_can_remove := public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_remove_profiles');

  /* §14: «Il backend applica: autorizzazione e visibilità → filtri →
     ordinamento stabile → pagina. Restituisce il numero totale accessibile
     della lista e, con filtri, il totale delle corrispondenze.» I due
     conteggi usano lo stesso perimetro delle righe, non una query a parte
     con condizioni proprie. */
  select
    count(*),
    count(*) filter (
      where (v_priorities is null
             or coalesce(e.priority, 'none') = any (v_priorities))
        and (v_statuses is null
             or e.evaluation_status = any (v_statuses))
    )
  into v_total, v_filtered
  from public.club_shortlist_entries e
  where e.shortlist_id = p_shortlist_id;

  with page as (
    select e.*
    from public.club_shortlist_entries e
    where e.shortlist_id = p_shortlist_id
      and (v_priorities is null
           or coalesce(e.priority, 'none') = any (v_priorities))
      and (v_statuses is null
           or e.evaluation_status = any (v_statuses))
      and (
        v_cursor_at is null
        or e.created_at < v_cursor_at
        or (e.created_at = v_cursor_at and e.id < v_cursor_id)
      )
    order by e.created_at desc, e.id desc
    limit v_limit + 1
  ),
  trimmed as (
    select p.*, row_number() over (order by p.created_at desc, p.id desc) as rn
    from page p
  ),
  rows as (
    select
      t.rn,
      jsonb_build_object(
        'entry_id',  t.id,
        'person_id', t.player_profile_id,
        'name',      prof.full_name,
        'avatar_url', prof.avatar_url,
        'role',      prof.role::text,
        'primary_position', pp.primary_position::text,
        /* §12: «contesto corrente essenziale». Deriva dalla funzione
           canonica del pack Candidature, che distingue «Svincolato»
           dichiarato da «non determinabile» e restituisce null nel secondo
           caso — §12 vieta di sostituire un dato assente con un valore
           demo, e questa è la stessa regola già applicata alle righe
           candidatura. */
        'situation', public.profile_current_situation(t.player_profile_id),
        'priority',  t.priority,
        'evaluation_status', t.evaluation_status,
        'revision',  t.revision,
        /* §12: «eventuale anteprima della nota in una sola riga» e «Non
           scaricare note complete in un endpoint che serve solo una lista
           con preview». Il troncamento è server-side: la riga non riceve
           mai il testo integrale. */
        'note_preview', case
          when v_can_notes and nullif(btrim(t.internal_note), '') is not null
            then left(regexp_replace(btrim(t.internal_note), '\s+', ' ', 'g'), 120)
        end,
        /* §16: l'origine è audit storico; «se la dicitura storica Da
           candidatura rivelerebbe una relazione Application non
           autorizzata, ometti quella dicitura dalla proiezione di quell
           actor». `profile` non rivela nulla e resta. */
        'created_source', case
          when t.created_source = 'application' and not v_can_apps then 'unknown'
          else t.created_source
        end,
        /* §16: la relazione **corrente**, distinta dall'origine. `null`
           significa «non autorizzato a saperlo» e §16 vieta di tradurlo in
           «non si è candidato». */
        'application_state', case
          when not v_can_apps then null
          when t.application_id is null then 'none'
          when app.status = 'withdrawn' then 'withdrawn'
          else 'active'
        end
      ) as item
    from trimmed t
    join public.profiles prof on prof.id = t.player_profile_id
    left join public.player_profiles pp on pp.profile_id = t.player_profile_id
    left join public.recruiting_applications app on app.id = t.application_id
    where t.rn <= v_limit
  )
  select
    coalesce(jsonb_agg(r.item order by r.rn), '[]'::jsonb),
    (
      select p_shortlist_id::text || '|' || v_fingerprint || '|'
             || t2.created_at::text || '|' || t2.id::text
      from trimmed t2
      where t2.rn = v_limit
        and (select count(*) from trimmed) > v_limit
    )
  into v_items, v_next
  from rows r;

  return jsonb_build_object(
    'shortlist_id', p_shortlist_id,
    'total',        v_total,
    'filtered',     v_filtered,
    'filters_applied', (v_priorities is not null or v_statuses is not null),
    'priorities',   to_jsonb(v_priorities),
    'statuses',     to_jsonb(v_statuses),
    'next_cursor',  v_next,
    'can_view_notes',   v_can_notes,
    'can_view_applications', v_can_apps,
    'can_edit_status',  v_can_edit,
    'can_remove',       v_can_remove,
    'access_verified_at', timezone('utc', now()),
    'items',        coalesce(v_items, '[]'::jsonb)
  );
end;
$$;

/* fetch_shortlist_entry: copiata da 20261106090000 (definizione più recente); unica
   differenza: 1 chiamata all'accesso per lista, marcata «DAS-REV-27». */
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

/* add_profile_to_shortlist: copiata da 20261106090000 (definizione più recente); unica
   differenza: il controllo d’accesso nel ramo di replay, marcato «DAS-REV-27». */
create or replace function public.add_profile_to_shortlist(
  p_club_id         uuid,
  p_person_id       uuid,
  p_position_id     uuid default null,
  p_shortlist_id    uuid default null,
  p_idempotency_key text default null
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

  select r.entry_ref, r.already into v_entry_id, v_already
  from public.shortlist_profile_insert_entry(v_list, p_person_id) r;

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


/* La firma (tipo, modo, owner) non ha più chiamanti: eliminarla fa fallire
   un eventuale chiamante dimenticato invece di lasciarlo concedere. */
drop function if exists public.shortlist_list_access_ok(text, text, uuid);


-- ============================================================
-- SEZIONE 8 — creazione con accesso esplicito (§10, §11, §12)
--
-- Stesso servizio della 26, unico per Centro e profilo (§3). La firma si
-- estende con `p_access_mode` e `p_share_ids`, entrambi con default: un
-- client precedente che chiama per nome i sei parametri di prima ottiene
-- ancora una Solo io. Nessun owner dal client: lo stampa il trigger.
-- ============================================================

drop function if exists public.create_custom_shortlist(uuid, text, text, uuid, uuid, text);

create or replace function public.create_custom_shortlist(
  p_club_id         uuid,
  p_name            text,
  p_description     text    default null,
  p_team_id         uuid    default null,
  p_person_id       uuid    default null,
  p_idempotency_key text    default null,
  p_access_mode     text    default 'owner_only',
  p_share_ids       uuid[]  default null
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
    from public.shortlist_profile_insert_entry(v_list.id, p_person_id) r;

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

revoke all on function public.create_custom_shortlist(uuid, text, text, uuid, uuid, text, text, uuid[]) from public;
revoke execute on function public.create_custom_shortlist(uuid, text, text, uuid, uuid, text, text, uuid[]) from anon;
grant execute on function public.create_custom_shortlist(uuid, text, text, uuid, uuid, text, text, uuid[]) to authenticated;

comment on function public.create_custom_shortlist(uuid, text, text, uuid, uuid, text, text, uuid[]) is
  'DAS-REV-26 §16-§19 + DAS-REV-27 §10-§12: servizio unico di creazione CUSTOM '
  '(Centro e profilo). Solo io di default; condivisione esplicita con '
  'destinatari rivalidati; persona iniziale nella stessa transazione.';


-- ============================================================
-- SEZIONE 9 — persone eleggibili (§11)
--
-- Riservata a chi gestisce gli accessi della lista (owner valido) o crea
-- quel draft nel suo ambito. Solo persone interne attive con
-- `shortlist_view` nell'ambito: nessuna riga disabled per chi è fuori.
-- Riferimenti organizzativi canonici (profilo di un accesso attivo), non
-- email. Paginazione per nome e id, con cursore = id dell'ultima riga.
-- ============================================================

create or replace function public.fetch_shortlist_share_candidates(
  p_club_id      uuid,
  p_shortlist_id uuid    default null,
  p_team_id      uuid    default null,
  p_limit        integer default 30,
  p_cursor       text    default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_limit  integer := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_team   uuid := p_team_id;
  v_owner  uuid := v_uid;
  v_list   public.club_shortlists%rowtype;
  v_cname  text;
  v_cid    uuid;
  v_items  jsonb;
  v_next   text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_shortlist_id is not null then
    select * into v_list from public.club_shortlists cs where cs.id = p_shortlist_id;

    /* §13: «Gestisci accesso è riservato al proprietario valido». */
    if v_list.id is null
       or v_list.club_id is distinct from p_club_id
       or v_list.list_type <> 'custom'
       or v_list.owner_profile_id is distinct from v_uid
       or not public.shortlist_list_access_ok(v_list.id)
       or not public.society_position_in_scope(v_list.club_id, v_list.team_id, 'shortlist_view') then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    v_team  := v_list.team_id;
    v_owner := v_list.owner_profile_id;
  else
    if p_team_id is not null and not exists (
      select 1 from public.club_teams ct
      where ct.id = p_team_id and ct.club_id = p_club_id and not coalesce(ct.is_archived, false)
    ) then
      raise exception 'SHORTLIST_SCOPE_INVALID';
    end if;

    if not public.society_position_in_scope(p_club_id, p_team_id, 'shortlist_create_lists') then
      raise exception 'SHORTLIST_SCOPE_INVALID';
    end if;
  end if;

  if p_cursor is not null and btrim(p_cursor) <> '' then
    v_cid := p_cursor::uuid;
    select lower(coalesce(p.full_name, '')) into v_cname from public.profiles p where p.id = v_cid;
  end if;

  with people as (
    select c.owner_profile_id as pid from public.clubs c where c.id = p_club_id
    union
    select m.profile_id from public.club_admin_memberships m
    where m.club_id = p_club_id and m.status = 'active'
    union
    select perm.profile_id from public.club_member_permissions perm
    where perm.club_id = p_club_id and perm.permission_key = 'shortlist_view'
  ),
  eligible as (
    select p.id, p.full_name, p.avatar_url, lower(coalesce(p.full_name, '')) as sort_name
    from people
    join public.profiles p on p.id = people.pid
    where people.pid is not null
      and people.pid <> v_uid
      and people.pid is distinct from v_owner
      and public.shortlist_person_eligible(p_club_id, v_team, people.pid)
  ),
  page as (
    select e.*
    from eligible e
    where v_cid is null or (e.sort_name, e.id) > (coalesce(v_cname, ''), v_cid)
    order by e.sort_name, e.id
    limit v_limit + 1
  ),
  numbered as (
    select pg.*, row_number() over (order by pg.sort_name, pg.id) as rn from page pg
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'profile_id', n.id,
      'full_name',  n.full_name,
      'avatar_url', n.avatar_url,
      'role_label', public.shortlist_member_role_label(p_club_id, n.id)
    ) order by n.rn) filter (where n.rn <= v_limit), '[]'::jsonb),
    max(case when n.rn = v_limit and (select count(*) from page) > v_limit then n.id::text end)
  into v_items, v_next
  from numbered n;

  return jsonb_build_object(
    'items',       v_items,
    'next_cursor', v_next,
    'scope_label', public.shortlist_team_label(v_team),
    'access_verified_at', timezone('utc', now())
  );
end;
$$;

revoke all on function public.fetch_shortlist_share_candidates(uuid, uuid, uuid, integer, text) from public;
revoke execute on function public.fetch_shortlist_share_candidates(uuid, uuid, uuid, integer, text) from anon;
grant execute on function public.fetch_shortlist_share_candidates(uuid, uuid, uuid, integer, text) to authenticated;


-- ============================================================
-- SEZIONE 10 — dettaglio CUSTOM e read model degli accessi (§9, §13)
-- ============================================================

/**
 * Testata del dettaglio CUSTOM (screen 04, 07, 14, 15).
 *
 * §9: «Per owner: Solo tu oppure Condivisa con N persone, escludendo
 * l'owner. Per collaboratore: Condivisa, senza esposizione automatica
 * dell'elenco degli altri utenti o del loro numero.» Il conteggio esiste
 * nel payload soltanto per l'owner (§17: niente nascosto lato client).
 * Le capability di gestione sono quelle effettive (§8): Gestisci accesso
 * all'owner; Modifica ed Elimina con `shortlist_manage_key()` nell'ambito.
 * Profili, filtri e count restano quelli di contesto e pool della 25.
 */
create or replace function public.fetch_custom_shortlist_detail(p_shortlist_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_list  public.club_shortlists%rowtype;
  v_owner boolean;
  v_manage boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_list from public.club_shortlists cs where cs.id = p_shortlist_id;

  if v_list.id is null
     or v_list.list_type <> 'custom'
     or not public.shortlist_list_access_ok(v_list.id)
     or not public.society_position_in_scope(v_list.club_id, v_list.team_id, 'shortlist_view') then
    /* §17: stessa superficie per inesistente, eliminata, privata o fuori
       scope. */
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  v_owner  := v_list.owner_profile_id = v_uid;
  v_manage := public.society_position_in_scope(v_list.club_id, v_list.team_id, public.shortlist_manage_key());

  return jsonb_build_object(
    'shortlist_id', v_list.id,
    'club_id',      v_list.club_id,
    'name',         v_list.name,
    'description',  v_list.description,
    'team_id',      v_list.team_id,
    'scope_label',  public.shortlist_scope_label(v_list.id, null),
    'version',      v_list.version,
    'is_owner',     v_owner,
    'access_mode',  v_list.access_mode,
    'shared_count', case when v_owner then (
                      select count(*) from public.club_shortlist_shares sh
                      where sh.shortlist_id = v_list.id
                    ) end,
    'can_manage_access', v_owner,
    'can_edit',     v_manage,
    'can_delete',   v_manage,
    'access_verified_at', timezone('utc', now())
  );
end;
$$;

revoke all on function public.fetch_custom_shortlist_detail(uuid) from public;
revoke execute on function public.fetch_custom_shortlist_detail(uuid) from anon;
grant execute on function public.fetch_custom_shortlist_detail(uuid) to authenticated;

/**
 * Read model di Gestisci accesso (screen 06, 16): owner-only.
 *
 * Restituisce il set **completo** delle condivisioni attive, non una
 * pagina: §11 — «selezioni mantenute per ID anche fuori pagina. Il set
 * salvato comprende tutte le scelte».
 */
create or replace function public.fetch_custom_shortlist_access(p_shortlist_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_list public.club_shortlists%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_list from public.club_shortlists cs where cs.id = p_shortlist_id;

  if v_list.id is null
     or v_list.list_type <> 'custom'
     or v_list.owner_profile_id is distinct from v_uid
     or not public.shortlist_list_access_ok(v_list.id)
     or not public.society_position_in_scope(v_list.club_id, v_list.team_id, 'shortlist_view') then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'shortlist_id', v_list.id,
    'club_id',      v_list.club_id,
    'name',         v_list.name,
    'team_id',      v_list.team_id,
    'scope_label',  public.shortlist_scope_label(v_list.id, null),
    'version',      v_list.version,
    'access_mode',  v_list.access_mode,
    'owner', (
      select jsonb_build_object(
        'profile_id', p.id,
        'full_name',  p.full_name,
        'avatar_url', p.avatar_url,
        'role_label', public.shortlist_member_role_label(v_list.club_id, p.id)
      )
      from public.profiles p where p.id = v_list.owner_profile_id
    ),
    'shared', coalesce((
      select jsonb_agg(jsonb_build_object(
        'profile_id', p.id,
        'full_name',  p.full_name,
        'avatar_url', p.avatar_url,
        'role_label', public.shortlist_member_role_label(v_list.club_id, p.id)
      ) order by lower(coalesce(p.full_name, '')), p.id)
      from public.club_shortlist_shares sh
      join public.profiles p on p.id = sh.profile_id
      where sh.shortlist_id = v_list.id
    ), '[]'::jsonb),
    'access_verified_at', timezone('utc', now())
  );
end;
$$;

revoke all on function public.fetch_custom_shortlist_access(uuid) from public;
revoke execute on function public.fetch_custom_shortlist_access(uuid) from anon;
grant execute on function public.fetch_custom_shortlist_access(uuid) to authenticated;


-- ============================================================
-- SEZIONE 11 — Salva accesso (§13, Q27-08..13)
-- ============================================================

create or replace function public.update_custom_shortlist_access(
  p_shortlist_id     uuid,
  p_access_mode      text,
  p_profile_ids      uuid[],
  p_expected_version integer,
  p_idempotency_key  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_list        public.club_shortlists%rowtype;
  v_ids         uuid[];
  v_fingerprint text;
  v_receipt     jsonb;
  v_added       integer := 0;
  v_removed     integer := 0;
  v_result      jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(p_access_mode, '') not in ('owner_only', 'shared') then
    raise exception 'SHORTLIST_VALUE_INVALID';
  end if;

  select coalesce(array_agg(distinct s order by s), array[]::uuid[]) into v_ids
  from unnest(coalesce(p_profile_ids, array[]::uuid[])) as s
  where s is not null;

  if p_access_mode = 'owner_only' then
    v_ids := array[]::uuid[];
  end if;

  v_fingerprint := md5(
    'shortlist_access|v1|' || coalesce(p_shortlist_id::text, '-') || '|'
    || coalesce(p_expected_version::text, '-') || '|' || p_access_mode || '|'
    || array_to_string(v_ids, ',')
  );

  v_receipt := public.application_operation_replay(
    p_idempotency_key, p_shortlist_id, 'shortlist_access_update', v_fingerprint
  );

  if v_receipt is not null then
    if not public.shortlist_in_scope(p_shortlist_id, 'shortlist_view') then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    return v_receipt || jsonb_build_object('replayed', true);
  end if;

  /* Esclusivo: serializza con eliminazione, ambito, recupero e con le
     scritture delle entry (che prendono il lock condiviso). */
  select * into v_list from public.club_shortlists cs where cs.id = p_shortlist_id for update;

  if v_list.id is null
     or v_list.list_type <> 'custom'
     or v_list.owner_profile_id is distinct from v_uid
     or not public.shortlist_list_access_ok(v_list.id)
     or not public.society_position_in_scope(v_list.club_id, v_list.team_id, 'shortlist_view') then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  /* §22: «Non ritentare automaticamente un vecchio set ACL su una versione
     nuova» (Q27-13). */
  if p_expected_version is distinct from v_list.version then
    raise exception 'SHORTLIST_VERSION_CONFLICT';
  end if;

  /* L'owner non è mai una condivisione di sé stesso (§13). */
  v_ids := array(select s from unnest(v_ids) as s where s <> v_list.owner_profile_id order by s);

  if p_access_mode = 'shared' and coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'SHORTLIST_SHARE_EMPTY';
  end if;

  if exists (
    select 1 from unnest(v_ids) as s
    where not public.shortlist_person_eligible(v_list.club_id, v_list.team_id, s)
  ) then
    raise exception 'SHORTLIST_SHARE_INELIGIBLE';
  end if;

  perform public.shortlist_governance_begin();

  delete from public.club_shortlist_shares sh
  where sh.shortlist_id = v_list.id and not (sh.profile_id = any (v_ids));
  get diagnostics v_removed = row_count;

  insert into public.club_shortlist_shares (shortlist_id, profile_id, created_by_profile_id)
  select v_list.id, s, v_uid from unnest(v_ids) as s
  on conflict do nothing;
  get diagnostics v_added = row_count;

  update public.club_shortlists cs
     set access_mode = p_access_mode,
         version     = cs.version + 1
   where cs.id = v_list.id
  returning cs.* into v_list;

  perform public.shortlist_governance_audit(
    v_list.id, 'access_updated', v_list.version,
    jsonb_build_object('access', v_list.access_mode, 'added', v_added, 'removed', v_removed)
  );

  v_result := jsonb_build_object(
    'shortlist_id', v_list.id,
    'access_mode',  v_list.access_mode,
    'shared_count', coalesce(array_length(v_ids, 1), 0),
    'version',      v_list.version
  );

  perform public.application_operation_record(
    p_idempotency_key, p_shortlist_id, 'shortlist_access_update', v_fingerprint, v_result
  );

  return v_result || jsonb_build_object('replayed', false);
end;
$$;

revoke all on function public.update_custom_shortlist_access(uuid, text, uuid[], integer, text) from public;
revoke execute on function public.update_custom_shortlist_access(uuid, text, uuid[], integer, text) from anon;
grant execute on function public.update_custom_shortlist_access(uuid, text, uuid[], integer, text) to authenticated;


-- ============================================================
-- SEZIONE 12 — Modifica lista e cambio ambito (§14, Q27-16..19)
-- ============================================================

/**
 * Anteprima d'impatto del cambio ambito (screen 08), prima del commit.
 *
 * Owner: nomi di chi perderebbe l'accesso. Gestore che non legge le ACL:
 * solo l'avviso generico, mai nomi o conteggi (Q27-19). Dice anche se
 * l'owner resterebbe valido, così il form blocca prima di Salva; il comando
 * ricontrolla comunque tutto.
 */
create or replace function public.preview_custom_shortlist_scope(
  p_shortlist_id uuid,
  p_team_id      uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_list public.club_shortlists%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_list from public.club_shortlists cs where cs.id = p_shortlist_id;

  if v_list.id is null
     or v_list.list_type <> 'custom'
     or not public.shortlist_list_access_ok(v_list.id)
     or not public.society_position_in_scope(v_list.club_id, v_list.team_id, 'shortlist_view') then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  if not public.society_position_in_scope(v_list.club_id, v_list.team_id, public.shortlist_manage_key())
     or not public.society_position_in_scope(v_list.club_id, p_team_id, public.shortlist_manage_key()) then
    raise exception 'SHORTLIST_SCOPE_INVALID';
  end if;

  return jsonb_build_object(
    'owner_valid', v_list.owner_profile_id is not null
                   and public.shortlist_person_eligible(v_list.club_id, p_team_id, v_list.owner_profile_id),
    'kind',        case
                     when v_list.owner_profile_id = v_uid then 'named'
                     when v_list.access_mode = 'owner_only' then 'none'
                     else 'generic'
                   end,
    'losing',      case when v_list.owner_profile_id = v_uid then coalesce((
                     select jsonb_agg(jsonb_build_object('profile_id', p.id, 'full_name', p.full_name)
                                      order by lower(coalesce(p.full_name, '')), p.id)
                     from public.club_shortlist_shares sh
                     join public.profiles p on p.id = sh.profile_id
                     where sh.shortlist_id = v_list.id
                       and not public.shortlist_person_eligible(v_list.club_id, p_team_id, sh.profile_id)
                   ), '[]'::jsonb) end
  );
end;
$$;

revoke all on function public.preview_custom_shortlist_scope(uuid, uuid) from public;
revoke execute on function public.preview_custom_shortlist_scope(uuid, uuid) from anon;
grant execute on function public.preview_custom_shortlist_scope(uuid, uuid) to authenticated;

/**
 * Salva modifiche (§14): patch dei soli campi presenti in `p_patch`
 * (`name`, `description`, `team_id`), con versione osservata.
 *
 * Il cambio ambito e la riconciliazione degli accessi sono lo stesso
 * commit: nessuna finestra in cui il vecchio ambito o una ACL stale
 * concedano accesso. Profili, valutazioni e note non vengono toccati.
 */
create or replace function public.update_custom_shortlist(
  p_shortlist_id     uuid,
  p_expected_version integer,
  p_patch            jsonb,
  p_idempotency_key  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_patch       jsonb := coalesce(p_patch, '{}'::jsonb);
  v_list        public.club_shortlists%rowtype;
  v_team        uuid;
  v_team_change boolean;
  v_fingerprint text;
  v_receipt     jsonb;
  v_removed     integer := 0;
  v_result      jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(v_patch) <> 'object'
     or exists (select 1 from jsonb_object_keys(v_patch) k where k not in ('name', 'description', 'team_id')) then
    raise exception 'SHORTLIST_VALUE_INVALID';
  end if;

  v_fingerprint := md5(
    'shortlist_update|v1|' || coalesce(p_shortlist_id::text, '-') || '|'
    || coalesce(p_expected_version::text, '-') || '|' || v_patch::text
  );

  v_receipt := public.application_operation_replay(
    p_idempotency_key, p_shortlist_id, 'shortlist_update', v_fingerprint
  );

  if v_receipt is not null then
    if not public.shortlist_in_scope(p_shortlist_id, 'shortlist_view') then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    return v_receipt || jsonb_build_object('replayed', true);
  end if;

  select * into v_list from public.club_shortlists cs where cs.id = p_shortlist_id for update;

  if v_list.id is null
     or v_list.list_type <> 'custom'
     or not public.shortlist_list_access_ok(v_list.id)
     or not public.society_position_in_scope(v_list.club_id, v_list.team_id, 'shortlist_view') then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  /* §8: la proprietà da sola non concede Gestire liste (Q27-15). */
  if not public.society_position_in_scope(v_list.club_id, v_list.team_id, public.shortlist_manage_key()) then
    raise exception 'SHORTLIST_NOT_AUTHORIZED';
  end if;

  if p_expected_version is distinct from v_list.version then
    raise exception 'SHORTLIST_VERSION_CONFLICT';
  end if;

  v_team_change := v_patch ? 'team_id'
                   and (v_patch ->> 'team_id')::uuid is distinct from v_list.team_id;
  v_team := case when v_team_change then (v_patch ->> 'team_id')::uuid else v_list.team_id end;

  if v_team_change then
    if v_team is not null and not exists (
      select 1 from public.club_teams ct
      where ct.id = v_team and ct.club_id = v_list.club_id and not coalesce(ct.is_archived, false)
    ) then
      raise exception 'SHORTLIST_SCOPE_INVALID';
    end if;

    if not public.society_position_in_scope(v_list.club_id, v_team, public.shortlist_manage_key()) then
      raise exception 'SHORTLIST_SCOPE_INVALID';
    end if;

    /* §14: «Backend richiede anche che l'owner rimanga valido nel nuovo
       scope; se non lo è blocca il cambio, senza trasferire la proprietà o
       ampliare i suoi permessi» (SCP-05, Q27-17). */
    if v_list.owner_profile_id is null
       or not public.shortlist_person_eligible(v_list.club_id, v_team, v_list.owner_profile_id) then
      raise exception 'SHORTLIST_OWNER_SCOPE_INVALID';
    end if;
  end if;

  perform public.shortlist_governance_begin();

  update public.club_shortlists cs
     set name        = case when v_patch ? 'name' then v_patch ->> 'name' else cs.name end,
         description = case when v_patch ? 'description' then v_patch ->> 'description' else cs.description end,
         team_id     = v_team,
         version     = cs.version + 1
   where cs.id = v_list.id
  returning cs.* into v_list;

  if v_team_change then
    delete from public.club_shortlist_shares sh
    where sh.shortlist_id = v_list.id
      and not public.shortlist_person_eligible(v_list.club_id, v_team, sh.profile_id);
    get diagnostics v_removed = row_count;

    if v_list.access_mode = 'shared' and not exists (
      select 1 from public.club_shortlist_shares sh where sh.shortlist_id = v_list.id
    ) then
      update public.club_shortlists cs set access_mode = 'owner_only'
      where cs.id = v_list.id
      returning cs.* into v_list;
    end if;
  end if;

  perform public.shortlist_governance_audit(
    v_list.id, 'updated', v_list.version,
    jsonb_build_object(
      'fields', (select jsonb_agg(k order by k) from jsonb_object_keys(v_patch) k),
      'shares_removed', v_removed,
      'access', v_list.access_mode
    )
  );

  v_result := jsonb_build_object(
    'shortlist_id', v_list.id,
    'version',      v_list.version,
    'name',         v_list.name,
    'description',  v_list.description,
    'team_id',      v_list.team_id,
    'scope_label',  public.shortlist_scope_label(v_list.id, null),
    'access_mode',  v_list.access_mode
  );

  perform public.application_operation_record(
    p_idempotency_key, p_shortlist_id, 'shortlist_update', v_fingerprint, v_result
  );

  return v_result || jsonb_build_object('replayed', false);
end;
$$;

revoke all on function public.update_custom_shortlist(uuid, integer, jsonb, text) from public;
revoke execute on function public.update_custom_shortlist(uuid, integer, jsonb, text) from anon;
grant execute on function public.update_custom_shortlist(uuid, integer, jsonb, text) to authenticated;


-- ============================================================
-- SEZIONE 13 — Elimina lista (§16, DEL-01..12)
-- ============================================================

create or replace function public.delete_custom_shortlist(
  p_shortlist_id    uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_list        public.club_shortlists%rowtype;
  v_fingerprint text := md5('shortlist_delete|v1|' || coalesce(p_shortlist_id::text, '-'));
  v_receipt     jsonb;
  v_entries     bigint;
  v_shares      integer;
  v_result      jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  /* §16: «Retry eliminazione non produce effetti aggiuntivi». La ricevuta
     contiene solo l'id: niente da rivelare a chi non vede più la lista. */
  v_receipt := public.application_operation_replay(
    p_idempotency_key, p_shortlist_id, 'shortlist_delete', v_fingerprint
  );

  if v_receipt is not null then
    return v_receipt || jsonb_build_object('replayed', true);
  end if;

  select * into v_list from public.club_shortlists cs where cs.id = p_shortlist_id for update;

  /* DEL-02: una POSITION non si elimina, e lo si dice come per qualunque
     lista non disponibile. */
  if v_list.id is null
     or v_list.list_type <> 'custom'
     or not public.shortlist_list_access_ok(v_list.id)
     or not public.society_position_in_scope(v_list.club_id, v_list.team_id, 'shortlist_view') then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  if not public.society_position_in_scope(v_list.club_id, v_list.team_id, public.shortlist_manage_key()) then
    raise exception 'SHORTLIST_NOT_AUTHORIZED';
  end if;

  select count(*) into v_entries from public.club_shortlist_entries e where e.shortlist_id = v_list.id;

  perform public.shortlist_governance_begin();

  /* DEL-07: le relazioni di accesso spariscono con la lista. */
  delete from public.club_shortlist_shares sh where sh.shortlist_id = v_list.id;
  get diagnostics v_shares = row_count;

  update public.club_shortlists cs
     set deleted_at            = timezone('utc', now()),
         deleted_by_profile_id = v_uid,
         version               = cs.version + 1
   where cs.id = v_list.id
  returning cs.* into v_list;

  perform public.shortlist_governance_audit(
    v_list.id, 'deleted', v_list.version,
    jsonb_build_object('entries', v_entries, 'shares', v_shares)
  );

  v_result := jsonb_build_object('shortlist_id', v_list.id, 'deleted', true);

  perform public.application_operation_record(
    p_idempotency_key, p_shortlist_id, 'shortlist_delete', v_fingerprint, v_result
  );

  return v_result || jsonb_build_object('replayed', false);
end;
$$;

revoke all on function public.delete_custom_shortlist(uuid, text) from public;
revoke execute on function public.delete_custom_shortlist(uuid, text) from anon;
grant execute on function public.delete_custom_shortlist(uuid, text) to authenticated;


-- ============================================================
-- SEZIONE 14 — recupero amministrativo (§19, OWN-03..12, Q27-20..26)
--
-- Superficie separata dalla lettura ordinaria: nessuna di queste funzioni
-- passa da `shortlist_list_access_ok`, e nessuna restituisce entry, count,
-- note, valutazioni o ACL. Le condizioni sono due e cumulative: capability
-- di recupero nell'ambito della lista, e owner **non** valido. Una Solo io
-- con owner valido è invisibile qui come altrove (Q27-21).
-- ============================================================

create or replace function public.shortlist_recovery_allowed(p_shortlist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select cs.list_type = 'custom'
       and cs.deleted_at is null
       and not public.shortlist_owner_valid(cs.id)
       and public.society_position_in_scope(cs.club_id, cs.team_id, public.shortlist_recovery_key())
    from public.club_shortlists cs
    where cs.id = p_shortlist_id
  ), false);
$$;

revoke all on function public.shortlist_recovery_allowed(uuid) from public;

/** Menu del Centro: «Recupera liste» solo con la capability (§19). */
create or replace function public.fetch_shortlist_governance_caps(p_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return jsonb_build_object(
    'can_recover', public.shortlist_recovery_key() = any (public.dashboard_club_capabilities(p_club_id)),
    'access_verified_at', timezone('utc', now())
  );
end;
$$;

revoke all on function public.fetch_shortlist_governance_caps(uuid) from public;
revoke execute on function public.fetch_shortlist_governance_caps(uuid) from anon;
grant execute on function public.fetch_shortlist_governance_caps(uuid) to authenticated;

create or replace function public.fetch_recoverable_custom_shortlists(
  p_club_id uuid,
  p_limit   integer default 30,
  p_cursor  text    default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_ts    timestamptz;
  v_id    uuid;
  v_items jsonb;
  v_next  text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (public.shortlist_recovery_key() = any (public.dashboard_club_capabilities(p_club_id))) then
    raise exception 'SHORTLIST_NOT_AUTHORIZED';
  end if;

  if p_cursor is not null and btrim(p_cursor) <> '' then
    v_ts := split_part(p_cursor, '|', 1)::timestamptz;
    v_id := split_part(p_cursor, '|', 2)::uuid;
  end if;

  with candidates as (
    select cs.id, cs.name, cs.created_at
    from public.club_shortlists cs
    where cs.club_id = p_club_id
      and cs.list_type = 'custom'
      and cs.deleted_at is null
      and public.shortlist_recovery_allowed(cs.id)
      and (v_id is null or (cs.created_at, cs.id) < (v_ts, v_id))
    order by cs.created_at desc, cs.id desc
    limit v_limit + 1
  ),
  numbered as (
    select c.*, row_number() over (order by c.created_at desc, c.id desc) as rn from candidates c
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'shortlist_id', n.id,
      'name',         n.name,
      'scope_label',  public.shortlist_scope_label(n.id, null)
    ) order by n.rn) filter (where n.rn <= v_limit), '[]'::jsonb),
    max(case when n.rn = v_limit and (select count(*) from candidates) > v_limit
             then n.created_at::text || '|' || n.id::text end)
  into v_items, v_next
  from numbered n;

  return jsonb_build_object('items', v_items, 'next_cursor', v_next,
                            'access_verified_at', timezone('utc', now()));
end;
$$;

revoke all on function public.fetch_recoverable_custom_shortlists(uuid, integer, text) from public;
revoke execute on function public.fetch_recoverable_custom_shortlists(uuid, integer, text) from anon;
grant execute on function public.fetch_recoverable_custom_shortlists(uuid, integer, text) to authenticated;

/** Screen 12: soli metadati minimi (§19, Q27-22). */
create or replace function public.fetch_custom_shortlist_recovery(p_shortlist_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_list public.club_shortlists%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.shortlist_recovery_allowed(p_shortlist_id) then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  select * into v_list from public.club_shortlists cs where cs.id = p_shortlist_id;

  return jsonb_build_object(
    'shortlist_id', v_list.id,
    'club_id',      v_list.club_id,
    'name',         v_list.name,
    'scope_label',  public.shortlist_scope_label(v_list.id, null),
    'version',      v_list.version,
    'access_verified_at', timezone('utc', now())
  );
end;
$$;

revoke all on function public.fetch_custom_shortlist_recovery(uuid) from public;
revoke execute on function public.fetch_custom_shortlist_recovery(uuid) from anon;
grant execute on function public.fetch_custom_shortlist_recovery(uuid) to authenticated;

/** Screen 13: persone idonee alla proprietà, una radio ciascuna (§19). */
create or replace function public.fetch_shortlist_owner_candidates(
  p_shortlist_id uuid,
  p_limit        integer default 30,
  p_cursor       text    default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_list  public.club_shortlists%rowtype;
  v_cid   uuid;
  v_cname text;
  v_items jsonb;
  v_next  text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.shortlist_recovery_allowed(p_shortlist_id) then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  select * into v_list from public.club_shortlists cs where cs.id = p_shortlist_id;

  if p_cursor is not null and btrim(p_cursor) <> '' then
    v_cid := p_cursor::uuid;
    select lower(coalesce(p.full_name, '')) into v_cname from public.profiles p where p.id = v_cid;
  end if;

  with people as (
    select c.owner_profile_id as pid from public.clubs c where c.id = v_list.club_id
    union
    select m.profile_id from public.club_admin_memberships m
    where m.club_id = v_list.club_id and m.status = 'active'
    union
    select perm.profile_id from public.club_member_permissions perm
    where perm.club_id = v_list.club_id and perm.permission_key = 'shortlist_view'
  ),
  eligible as (
    select p.id, p.full_name, p.avatar_url, lower(coalesce(p.full_name, '')) as sort_name
    from people
    join public.profiles p on p.id = people.pid
    where people.pid is not null
      and people.pid is distinct from v_list.owner_profile_id
      and public.shortlist_person_eligible(v_list.club_id, v_list.team_id, people.pid)
  ),
  page as (
    select e.* from eligible e
    where v_cid is null or (e.sort_name, e.id) > (coalesce(v_cname, ''), v_cid)
    order by e.sort_name, e.id
    limit v_limit + 1
  ),
  numbered as (
    select pg.*, row_number() over (order by pg.sort_name, pg.id) as rn from page pg
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'profile_id', n.id,
      'full_name',  n.full_name,
      'avatar_url', n.avatar_url,
      'role_label', public.shortlist_member_role_label(v_list.club_id, n.id)
    ) order by n.rn) filter (where n.rn <= v_limit), '[]'::jsonb),
    max(case when n.rn = v_limit and (select count(*) from page) > v_limit then n.id::text end)
  into v_items, v_next
  from numbered n;

  return jsonb_build_object('items', v_items, 'next_cursor', v_next,
                            'access_verified_at', timezone('utc', now()));
end;
$$;

revoke all on function public.fetch_shortlist_owner_candidates(uuid, integer, text) from public;
revoke execute on function public.fetch_shortlist_owner_candidates(uuid, integer, text) from anon;
grant execute on function public.fetch_shortlist_owner_candidates(uuid, integer, text) to authenticated;

/**
 * Assegna proprietario (§19).
 *
 * Rivalida al commit: capability, owner **ancora** non valido (Q27-20),
 * versione (OWN-12, Q27-26), candidato idoneo e diverso dall'owner
 * corrente. Cambia un solo owner; nome, descrizione, ambito, entry,
 * valutazioni e note restano. Toglie l'eventuale condivisione del nuovo
 * owner con sé stesso e quelle non più eleggibili; senza condivisioni
 * restituisce Solo io. L'esecutore non acquisisce accesso ordinario se non
 * è il nuovo owner o già condiviso (Q27-23).
 */
create or replace function public.reassign_custom_shortlist_owner(
  p_shortlist_id     uuid,
  p_new_owner_id     uuid,
  p_expected_version integer,
  p_idempotency_key  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_list        public.club_shortlists%rowtype;
  v_fingerprint text;
  v_receipt     jsonb;
  v_removed     integer := 0;
  v_result      jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_fingerprint := md5(
    'shortlist_owner|v1|' || coalesce(p_shortlist_id::text, '-') || '|'
    || coalesce(p_new_owner_id::text, '-') || '|' || coalesce(p_expected_version::text, '-')
  );

  /* CON-14: lo stesso intento ritentato restituisce lo stesso esito e non
     riassegna di nuovo. La ricevuta porta solo governance, nessun dato di
     scouting. */
  v_receipt := public.application_operation_replay(
    p_idempotency_key, p_shortlist_id, 'shortlist_owner_reassign', v_fingerprint
  );

  if v_receipt is not null then
    return v_receipt || jsonb_build_object('replayed', true);
  end if;

  select * into v_list from public.club_shortlists cs where cs.id = p_shortlist_id for update;

  if v_list.id is null
     or v_list.list_type <> 'custom'
     or v_list.deleted_at is not null
     or not public.society_position_in_scope(v_list.club_id, v_list.team_id, public.shortlist_recovery_key()) then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  /* Q27-20: l'owner è tornato valido — il recupero non gli sottrae la lista. */
  if public.shortlist_owner_valid(v_list.id) then
    raise exception 'SHORTLIST_OWNER_VALID';
  end if;

  if p_expected_version is distinct from v_list.version then
    raise exception 'SHORTLIST_VERSION_CONFLICT';
  end if;

  if p_new_owner_id is null
     or p_new_owner_id is not distinct from v_list.owner_profile_id
     or not public.shortlist_person_eligible(v_list.club_id, v_list.team_id, p_new_owner_id) then
    raise exception 'SHORTLIST_OWNER_INELIGIBLE';
  end if;

  perform public.shortlist_governance_begin();

  delete from public.club_shortlist_shares sh
  where sh.shortlist_id = v_list.id
    and (sh.profile_id = p_new_owner_id
         or not public.shortlist_person_eligible(v_list.club_id, v_list.team_id, sh.profile_id));
  get diagnostics v_removed = row_count;

  update public.club_shortlists cs
     set owner_profile_id = p_new_owner_id,
         access_mode = case
           when cs.access_mode = 'shared' and not exists (
             select 1 from public.club_shortlist_shares sh where sh.shortlist_id = cs.id
           ) then 'owner_only'
           else cs.access_mode
         end,
         version = cs.version + 1
   where cs.id = v_list.id
  returning cs.* into v_list;

  perform public.shortlist_governance_audit(
    v_list.id, 'owner_reassigned', v_list.version,
    jsonb_build_object('access', v_list.access_mode, 'shares_removed', v_removed)
  );

  v_result := jsonb_build_object(
    'shortlist_id',   v_list.id,
    'version',        v_list.version,
    'access_mode',    v_list.access_mode,
    'owner_name',     (select p.full_name from public.profiles p where p.id = p_new_owner_id),
    'actor_is_owner', p_new_owner_id = v_uid
  );

  perform public.application_operation_record(
    p_idempotency_key, p_shortlist_id, 'shortlist_owner_reassign', v_fingerprint, v_result
  );

  return v_result || jsonb_build_object('replayed', false);
end;
$$;

revoke all on function public.reassign_custom_shortlist_owner(uuid, uuid, integer, text) from public;
revoke execute on function public.reassign_custom_shortlist_owner(uuid, uuid, integer, text) from anon;
grant execute on function public.reassign_custom_shortlist_owner(uuid, uuid, integer, text) to authenticated;
