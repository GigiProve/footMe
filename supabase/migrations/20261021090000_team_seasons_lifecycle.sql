-- ============================================================
-- DAS-REV-10 — Stagioni: lifecycle e storico
--
-- Il principio della task in una riga: **la squadra conserva la stessa
-- identità nel tempo; ogni stagione conserva la propria classificazione**.
-- DAS-REV-08 ha già costruito il modello che lo rende dicibile
-- (`seasons`, `club_team_seasons` con unicità Team+Season, le due
-- tassonomie). Mancava tutto ciò che quel modello *fa* nel tempo:
--
--   · la stagione **prossima** non esisteva come concetto risolvibile;
--   · nessuna operazione sapeva distinguere "prepara il futuro" da
--     "configura la corrente mancante" da "correggi un anno passato";
--   · lo storico si poteva solo leggere, una stagione alla volta;
--   · disattivare una squadra non era un'operazione: `is_archived` era una
--     colonna che nessuno scriveva con controlli.
--
-- Cosa introduce
--   §6/§7  `next_season_id()` e `team_season_phase()`: corrente, prossima e
--          storico derivano dal catalogo centrale, non dall'anno del
--          dispositivo né da un confronto lessicografico sulle label.
--   §8     cinque chiavi di permesso nuove. §8 è esplicito: «Consultazione,
--          inserimento, correzione storica e lifecycle devono restare
--          autorizzazioni esplicite; non dedurle tutte da teams.edit».
--   §15/§23 `club_team_operations`: idempotenza reale per preparazione,
--          batch storico, disattivazione e riattivazione. Un doppio tap o
--          una risposta persa non producono due effetti.
--   §17/§34 `club_team_audit`: audit protetto, leggibile dal solo
--          proprietario, scritto esclusivamente dalle funzioni.
--   §20    `preview_team_season_history` / `commit_team_season_history`:
--          espansione dei periodi, esclusione delle stagioni già persistite,
--          deduplicazione, conflitti e conteggio **calcolati dal server**.
--   §27    `deactivate_club_team` con sezione critica reale (lock di riga) e
--          due trigger che impediscono a una Posizione o a un invito di
--          nascere su una squadra non attiva.
--   §29    `reactivate_club_team`: stesso Team ID, configurazione corrente
--          riusata o creata **nella stessa transazione**.
--
-- Cosa **non** fa
--   Non crea un modello SeasonV2, una seconda identity Team, un calendario
--   parallelo o un centro Posizioni/Inviti proprio. Non copia organico, non
--   riapre posizioni, non tocca carriere personali. Non cancella nulla:
--   non esiste un `delete_team_season`.
--
-- Rollback: droppare le funzioni e le due tabelle di questa migrazione, i
-- due trigger di guardia, e ripristinare il CHECK dei permessi e
-- `dashboard_club_capabilities` della 20261019090000.
--
-- Convenzioni riusate:
--   20261018090000_dashboard_society_overview.sql (capability, scope)
--   20261019090000_teams_center.sql               (seasons, club_team_seasons)
--   20261020090000_team_operational_detail.sql    (team_capability_allows)
-- ============================================================


-- ============================================================
-- SEZIONE 1 — Chiavi di permesso (§8)
--
-- §8 elenca sette facoltà. Qui diventano cinque chiavi, perché due coppie
-- sono la stessa decisione amministrativa:
--
--   `seasons_prepare`       preparare la futura, configurare la corrente
--                           mancante, modificare l'una o l'altra. È sempre
--                           «scrivere la classificazione di una stagione non
--                           conclusa»;
--   `seasons_history_view`  consultare lo storico;
--   `seasons_history_edit`  correggere una stagione conclusa;
--   `seasons_history_add`   aggiungere stagioni passate in blocco;
--   `teams_lifecycle`       disattivare e riattivare.
--
-- Correzione e inserimento restano **separati** perché §16 lo chiede
-- espressamente: «Il diritto di vedere lo storico o modificare il Team non
-- implica automaticamente il diritto di correggere lo storico».
--
-- La consultazione di Team e stagioni resta `teams_view`: è la stessa
-- domanda del Centro Squadre, e una chiave in più avrebbe significato
-- riconcedere a mano un accesso già concesso.
-- ============================================================

alter table public.club_member_permissions
  drop constraint if exists club_member_permissions_key_check;

alter table public.club_member_permissions
  add constraint club_member_permissions_key_check
  check (permission_key in (
    -- gruppo Shortlist (20260717090000)
    'shortlist_view',
    'shortlist_create_lists',
    'shortlist_add_profiles',
    'shortlist_add_notes',
    'shortlist_edit_status',
    'shortlist_remove_profiles',
    -- gruppo notifiche club (20260719090300)
    'notif_new_applications',
    'notif_shortlist_updates',
    'notif_connection_requests',
    'notif_store_orders',
    'notif_content_tags',
    'notif_affiliations',
    'notif_profile_verifications',
    -- gruppo profilo Società (20261008090000)
    'society_manage_profile',
    'society_manage_positions',
    'society_publish_media',
    -- gruppo Dashboard (DAS-REV-01 / DAS-REV-07)
    'dashboard_view',
    'positions_view',
    'positions_create',
    'applications_view',
    'teams_view',
    'content_view',
    'content_create',
    'invites_create',
    'invites_view',
    -- gruppo Squadre (DAS-REV-08 §5)
    'teams_create',
    'teams_edit',
    'roster_view',
    -- gruppo Stagioni e lifecycle (DAS-REV-10 §8) — nuove
    'seasons_prepare',
    'seasons_history_view',
    'seasons_history_edit',
    'seasons_history_add',
    'teams_lifecycle'
  ));


-- ============================================================
-- SEZIONE 2 — Catalogo: prossima stagione e fase (§6, §7)
--
-- «Usare identificativi e ordinamento strutturati, non confronti
-- lessicografici sulle label.» `seasons.sort_order` è quell'ordinamento;
-- "2009/10" > "2010/11" sarebbe stato vero per `text` e falso nel dominio.
--
-- `next_season_id()` restituisce `null` quando la corrente non è risolvibile
-- **o** quando la successiva non esiste in catalogo. §6: «Se la prossima
-- stagione non è ancora disponibile, non fabbricarne la label». Il `null`
-- è il modo in cui il backend lo dice.
-- ============================================================

create or replace function public.next_season_id()
returns text
language sql
stable
set search_path = public
as $$
  select nxt.id
  from public.seasons cur
  join public.seasons nxt on nxt.sort_order = cur.sort_order + 1
  where cur.id = public.current_season_id()
  limit 1;
$$;

grant execute on function public.next_season_id() to authenticated;

comment on function public.next_season_id() is
  'DAS-REV-10 §6: stagione successiva alla corrente secondo l''ordinamento '
  'del catalogo. null quando la corrente non è risolvibile o la successiva '
  'non esiste: non viene mai fabbricata una label.';

/**
 * Fase di una stagione rispetto al riferimento centrale (§7).
 *
 * 'current' | 'next' | 'past' | 'future' — 'future' è una stagione oltre la
 * prossima: esiste nel catalogo ma nessun flusso di questa task la tocca.
 * Derivata, non persistita: §7 ammette entrambe le forme e la derivazione
 * non può andare fuori sincrono con il catalogo.
 */
create or replace function public.team_season_phase(p_season_id text)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when cur.sort_order is null or s.sort_order is null then null
    when s.sort_order = cur.sort_order then 'current'
    when s.sort_order = cur.sort_order + 1 then 'next'
    when s.sort_order < cur.sort_order then 'past'
    else 'future'
  end
  from public.seasons s
  left join public.seasons cur on cur.id = public.current_season_id()
  where s.id = p_season_id;
$$;

grant execute on function public.team_season_phase(text) to authenticated;


-- ============================================================
-- SEZIONE 3 — Capability su una squadra (§8)
--
-- `team_capability_allows` di DAS-REV-09 vuole il club in input. Qui il club
-- si ricava dal Team, perché ogni flusso di questa task parte da un Team ID
-- e non dalla Società.
--
-- Il filtro è server-side anche per i riepiloghi e i conteggi (§8): «Non
-- restituire dati fuori scope per nasconderli nel client».
-- ============================================================

create or replace function public.club_team_allows(p_team_id uuid, p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club uuid;
begin
  select ct.club_id into v_club from public.club_teams ct where ct.id = p_team_id;

  if v_club is null then
    return false;
  end if;

  return public.team_capability_allows(v_club, p_team_id, p_key);
end;
$$;

revoke all on function public.club_team_allows(uuid, text) from public;
grant execute on function public.club_team_allows(uuid, text) to authenticated;


-- ============================================================
-- SEZIONE 4 — dashboard_club_capabilities (rimpiazzo, §8)
--
-- Solo l'elenco delle chiavi cambia. `team_capability_allows` verifica che
-- la chiave sia **fra quelle dell'actor** prima di guardarne il perimetro:
-- senza aggiungerle qui, le cinque nuove sarebbero concedibili in tabella e
-- invisibili a ogni controllo.
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
      'applications_view',
      'teams_view',
      'teams_create',
      'teams_edit',
      'roster_view',
      'content_view',
      'content_create',
      'invites_create',
      'invites_view',
      'shortlist_view',
      'seasons_prepare',
      'seasons_history_view',
      'seasons_history_edit',
      'seasons_history_add',
      'teams_lifecycle'
    ]::text[]
    else coalesce(
      (
        select array_agg(distinct perm.permission_key order by perm.permission_key)
        from public.club_member_permissions perm
        join public.club_members cm
          on cm.club_id = perm.club_id
          and cm.profile_id = perm.profile_id
        where perm.club_id = p_club_id
          and perm.profile_id = auth.uid()
          and cm.status = 'active'
          and perm.permission_key in (
            'dashboard_view',
            'positions_view',
            'positions_create',
            'applications_view',
            'teams_view',
            'teams_create',
            'teams_edit',
            'roster_view',
            'content_view',
            'content_create',
            'invites_create',
            'invites_view',
            'shortlist_view',
            'seasons_prepare',
            'seasons_history_view',
            'seasons_history_edit',
            'seasons_history_add',
            'teams_lifecycle'
          )
      ),
      array[]::text[]
    )
  end;
$$;

revoke all on function public.dashboard_club_capabilities(uuid) from public;
grant execute on function public.dashboard_club_capabilities(uuid) to authenticated;


-- ============================================================
-- SEZIONE 5 — Audit protetto (§17, §34)
--
-- «L'audit non è un evento analytics pubblico e non richiede una nuova
-- schermata … Limitare l'accesso all'audit e non stamparlo nei log
-- generici.»
--
-- Nessuna policy di INSERT: le righe nascono solo dalle funzioni
-- `security definer` di questa migrazione, che è il modo di impedire a un
-- client di scrivere la propria versione della storia. La SELECT è del solo
-- proprietario della Società.
-- ============================================================

create table if not exists public.club_team_audit (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  team_id        uuid not null references public.club_teams(id) on delete cascade,
  team_season_id uuid,
  operation      text not null check (operation in (
                   'season_prepare',
                   'season_configure',
                   'season_update',
                   'history_correct',
                   'history_commit',
                   'team_deactivate',
                   'team_reactivate'
                 )),
  details        jsonb not null default '{}'::jsonb,
  actor_id       uuid not null references public.profiles(id) on delete cascade,
  correlation_id text,
  created_at     timestamptz not null default timezone('utc', now())
);

create index if not exists club_team_audit_team_idx
  on public.club_team_audit (team_id, created_at desc);

alter table public.club_team_audit enable row level security;

drop policy if exists "club owners read team audit" on public.club_team_audit;
create policy "club owners read team audit"
  on public.club_team_audit for select to authenticated
  using (public.owns_club(club_id));


-- ============================================================
-- SEZIONE 6 — Idempotenza delle mutazioni (§15, §23)
--
-- «La chiave idempotente identifica la stessa operazione e lo stesso
-- contenuto. Un doppio tap o retry non crea nuovi record o un secondo batch.
-- Cambiare il contenuto dopo un conflitto richiede una nuova conferma e
-- un'identità di operazione coerente.»
--
-- Due colonne distinte fanno esattamente questo: la **chiave** riconosce il
-- tentativo, il **fingerprint** riconosce il contenuto. Stessa chiave e
-- stesso contenuto restituiscono il risultato già prodotto (§23: «Se il
-- server ha salvato ma la risposta si perde, recuperare l'esito della
-- medesima operazione»); stessa chiave e contenuto diverso è un errore, non
-- una seconda scrittura silenziosa.
-- ============================================================

create table if not exists public.club_team_operations (
  idempotency_key text primary key,
  actor_id        uuid not null references public.profiles(id) on delete cascade,
  team_id         uuid not null references public.club_teams(id) on delete cascade,
  operation       text not null,
  fingerprint     text not null,
  result          jsonb not null,
  created_at      timestamptz not null default timezone('utc', now())
);

alter table public.club_team_operations enable row level security;
-- Nessuna policy: la tabella è interna alle funzioni `security definer`.

/**
 * Esito già prodotto per questa chiave, se il contenuto coincide.
 *
 * `null` significa «mai eseguita»: il chiamante prosegue. Un contenuto
 * diverso sulla stessa chiave solleva, perché la chiave non identifica più
 * la stessa operazione.
 */
create or replace function public.club_team_operation_replay(
  p_key         text,
  p_team_id     uuid,
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
  v_row public.club_team_operations%rowtype;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    return null;
  end if;

  select * into v_row
  from public.club_team_operations
  where idempotency_key = p_key;

  if not found then
    return null;
  end if;

  if v_row.actor_id is distinct from auth.uid()
     or v_row.team_id is distinct from p_team_id
     or v_row.operation is distinct from p_operation
     or v_row.fingerprint is distinct from p_fingerprint
  then
    raise exception 'OPERATION_CONTENT_CHANGED';
  end if;

  return v_row.result;
end;
$$;

revoke all on function public.club_team_operation_replay(text, uuid, text, text) from public;
grant execute on function public.club_team_operation_replay(text, uuid, text, text) to authenticated;

create or replace function public.club_team_operation_record(
  p_key         text,
  p_team_id     uuid,
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
  if p_key is null or length(trim(p_key)) = 0 then
    return;
  end if;

  insert into public.club_team_operations
    (idempotency_key, actor_id, team_id, operation, fingerprint, result)
  values
    (p_key, auth.uid(), p_team_id, p_operation, p_fingerprint, p_result)
  on conflict (idempotency_key) do nothing;
end;
$$;

revoke all on function public.club_team_operation_record(text, uuid, text, text, jsonb) from public;
grant execute on function public.club_team_operation_record(text, uuid, text, text, jsonb) to authenticated;


-- ============================================================
-- SEZIONE 7 — Attività su una squadra non attiva (§27)
--
-- «Anche i writer concorrenti rilevanti dei domini Posizioni/Inviti/
-- collegamenti devono rispettare lo stato e il guard Team. Impedire che una
-- nuova posizione o un invito ancora accettabile compaiano tra il controllo
-- e la disattivazione.»
--
-- Il controllo non può vivere solo in `deactivate_club_team`: fra il check e
-- la scrittura c'è una finestra, e un'altra transazione la usa. Due trigger
-- chiudono il lato opposto — una Posizione pubblicata e un invito ancora
-- accettabile non possono **nascere** su un Team archiviato. Insieme al lock
-- di riga della §13 formano la sezione critica che §27 chiede.
--
-- I trigger non chiudono né cancellano nulla di esistente: §27 vieta
-- «hard delete, chiusura automatica di posizioni o cancellazione di
-- inviti/gruppi». Impediscono solo attività **nuova**.
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
begin
  if tg_table_name = 'recruiting_ads' then
    v_team_id  := new.team_id;
    v_relevant := public.recruiting_ad_is_available(new.status, new.application_deadline_at);
  elsif tg_table_name = 'club_members' then
    v_team_id  := new.team_id;
    v_relevant := new.status = 'pending' and new.profile_id is not null;
  end if;

  if v_team_id is null or not v_relevant then
    return new;
  end if;

  -- Una riga già rilevante che resta rilevante non viene bloccata: la
  -- disattivazione non può avvenire mentre esistono, quindi questo caso non
  -- si presenta se non per modifiche interne al dominio proprietario.
  if tg_op = 'UPDATE' and old.team_id is not distinct from v_team_id then
    if tg_table_name = 'recruiting_ads'
       and public.recruiting_ad_is_available(old.status, old.application_deadline_at)
    then
      return new;
    end if;

    if tg_table_name = 'club_members'
       and old.status = 'pending' and old.profile_id is not null
    then
      return new;
    end if;
  end if;

  -- `for share` e non una lettura semplice: è questa riga a rendere reale la
  -- sezione critica di §27. Se `deactivate_club_team` tiene già il `for
  -- update` sulla squadra, questa transazione **attende** e poi rilegge la
  -- riga aggiornata, trovandola archiviata. Senza il lock le due operazioni
  -- si incrociano e la Posizione nasce su un Team appena disattivato.
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

drop trigger if exists recruiting_ads_guard_team_active on public.recruiting_ads;
create trigger recruiting_ads_guard_team_active
  before insert or update on public.recruiting_ads
  for each row execute function public.guard_team_is_active();

drop trigger if exists club_members_guard_team_active on public.club_members;
create trigger club_members_guard_team_active
  before insert or update on public.club_members
  for each row execute function public.guard_team_is_active();


-- ============================================================
-- SEZIONE 8 — public.fetch_seasons_center (§10)
--
-- Intestazione dello screen 01: identità Società, stagione corrente
-- read-only, prossima stagione e **quantità reali** di squadre da preparare
-- e già preparate.
--
-- «Il totale riguarda il medesimo insieme autorizzato delle squadre attive
-- del Centro, non l'intera Società fuori scope»: i due conteggi usano lo
-- stesso filtro dell'elenco — perimetro di `teams_view`, `is_archived`
-- falso — e non una count globale.
--
-- `next_season_id` nullo non diventa zero: è la prossima stagione non
-- disponibile in catalogo, e il client mostra un messaggio discreto invece
-- di una CTA che prometterebbe un anno inventato (§6).
-- ============================================================

create or replace function public.fetch_seasons_center(p_club_id uuid)
returns table (
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  club_is_verified   boolean,
  season_id          text,
  season_label       text,
  next_season_id     text,
  next_season_label  text,
  scope_label        text,
  can_view           boolean,
  can_view_inactive  boolean,
  to_prepare_count   integer,
  prepared_count     integer,
  inactive_count     integer,
  total_count        integer,
  access_verified_at timestamptz,
  data_revision      bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_caps   text[];
  v_scope  uuid[];
  v_season text := public.current_season_id();
  v_next   text := public.next_season_id();
  v_now    timestamptz := timezone('utc', now());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  if not ('teams_view' = any (v_caps)) then
    return query select
      p_club_id, null::text, null::text, null::boolean,
      v_season, (select s.label from public.seasons s where s.id = v_season),
      v_next,   (select s.label from public.seasons s where s.id = v_next),
      null::text,
      false, false,
      null::integer, null::integer, null::integer, null::integer,
      v_now,
      (extract(epoch from v_now) * 1000)::bigint;
    return;
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, 'teams_view');

  return query
  select
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    v_season,
    (select s.label from public.seasons s where s.id = v_season),
    v_next,
    (select s.label from public.seasons s where s.id = v_next),
    public.dashboard_club_scope_label(p_club_id),
    true,
    -- Le squadre non attive sono una destinazione reale solo se ce n'è
    -- almeno una consultabile: §28 non vuole una riga verso un elenco vuoto
    -- quando l'actor non potrebbe vederne nessuna.
    true,
    case when v_next is null then null else (
      select count(*)::integer
      from public.club_teams ct
      where ct.club_id = p_club_id
        and not ct.is_archived
        and (v_scope is null or ct.id = any (v_scope))
        and not exists (
          select 1 from public.club_team_seasons cts
          where cts.team_id = ct.id and cts.season_id = v_next
        )
    ) end,
    case when v_next is null then null else (
      select count(*)::integer
      from public.club_teams ct
      where ct.club_id = p_club_id
        and not ct.is_archived
        and (v_scope is null or ct.id = any (v_scope))
        and exists (
          select 1 from public.club_team_seasons cts
          where cts.team_id = ct.id and cts.season_id = v_next
        )
    ) end,
    (
      select count(*)::integer
      from public.club_teams ct
      where ct.club_id = p_club_id
        and ct.is_archived
        and (v_scope is null or ct.id = any (v_scope))
    ),
    (
      select count(*)::integer
      from public.club_teams ct
      where ct.club_id = p_club_id
        and not ct.is_archived
        and (v_scope is null or ct.id = any (v_scope))
    ),
    v_now,
    (extract(epoch from v_now) * 1000)::bigint
  from public.clubs c
  where c.id = p_club_id;
end;
$$;

revoke all on function public.fetch_seasons_center(uuid) from public;
grant execute on function public.fetch_seasons_center(uuid) to authenticated;

comment on function public.fetch_seasons_center(uuid) is
  'DAS-REV-10 §10: intestazione del Centro Stagioni — Società, stagione '
  'corrente, prossima e riepilogo da preparare/preparate sullo stesso '
  'insieme autorizzato dell''elenco.';


-- ============================================================
-- SEZIONE 9 — public.fetch_seasons_center_page (§10)
--
-- Le stesse squadre del Centro Squadre, nello stesso ordine canonico
-- (§10: «Conservare l'ordine canonico del Centro Squadre con tie-break
-- stabile»), senza i conteggi dell'organico: §10 li esclude espressamente
-- («Nessun ranking basato su recruiting e nessun conteggio di persone,
-- candidature o posizioni»).
--
-- `next_has_config` serve alla sola riga, non al riepilogo: entrare in una
-- squadra già preparata non deve proporre una seconda creazione (§11).
-- ============================================================

create or replace function public.fetch_seasons_center_page(
  p_club_id uuid,
  p_cursor  text default null,
  p_limit   integer default 20
)
returns table (
  team_id           uuid,
  name              text,
  crest_url         text,
  type_id           text,
  type_label        text,
  level_id          text,
  level_label       text,
  has_season_config boolean,
  next_has_config   boolean,
  sort_key          text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_scope  uuid[];
  v_season text := public.current_season_id();
  v_next   text := public.next_season_id();
  v_limit  integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not ('teams_view' = any (public.dashboard_club_capabilities(p_club_id))) then
    return;
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, 'teams_view');

  return query
  with team_rows as (
    select
      ct.id,
      ct.name,
      ct.logo_url,
      cts.team_type_id,
      tt.label as type_label,
      cts.level_id,
      tl.label as level_label,
      (cts.id is not null) as has_config,
      exists (
        select 1 from public.club_team_seasons n
        where n.team_id = ct.id and v_next is not null and n.season_id = v_next
      ) as next_has_config,
      lpad(
        (case when coalesce(tt.tier, ct.team_type) = 'senior' then 0 else 1 end)::text, 1, '0'
      )
      || '-' || lpad(coalesce(tt.sort_order, 999)::text, 4, '0')
      || '-' || lpad(greatest(0, least(ct.sort_order, 9999))::text, 4, '0')
      || '-' || public.footme_normalize_lookup(ct.name)
      || '-' || ct.id::text as sort_key
    from public.club_teams ct
    left join public.club_team_seasons cts
      on cts.team_id = ct.id
     and cts.season_id = v_season
    left join public.team_types tt on tt.id = cts.team_type_id
    left join public.team_levels tl on tl.id = cts.level_id
    where ct.club_id = p_club_id
      and not ct.is_archived
      and (v_scope is null or ct.id = any (v_scope))
  )
  select
    r.id, r.name, r.logo_url,
    r.team_type_id, r.type_label,
    r.level_id, r.level_label,
    r.has_config, r.next_has_config,
    r.sort_key
  from team_rows r
  where p_cursor is null or r.sort_key > p_cursor
  order by r.sort_key
  limit v_limit;
end;
$$;

revoke all on function public.fetch_seasons_center_page(uuid, text, integer) from public;
grant execute on function public.fetch_seasons_center_page(uuid, text, integer) to authenticated;


-- ============================================================
-- SEZIONE 10 — public.fetch_inactive_teams (§28)
--
-- «Mostrare soltanto Team non attivi consultabili … Non riempire lo spazio
-- con dati dimostrativi o metriche zero.»
--
-- `has_history` è l'unico metadato della riga, ed è un booleano reale: la
-- squadra ha almeno una configurazione stagionale persistita. Non è un
-- conteggio, perché §28 non ne chiede e §10 vieta i numeri decorativi.
-- ============================================================

create or replace function public.fetch_inactive_teams(
  p_club_id uuid,
  p_cursor  text default null,
  p_limit   integer default 20
)
returns table (
  team_id     uuid,
  name        text,
  crest_url   text,
  has_history boolean,
  sort_key    text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_scope uuid[];
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not ('teams_view' = any (public.dashboard_club_capabilities(p_club_id))) then
    return;
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, 'teams_view');

  return query
  with team_rows as (
    select
      ct.id,
      ct.name,
      ct.logo_url,
      exists (
        select 1 from public.club_team_seasons cts where cts.team_id = ct.id
      ) as has_history,
      public.footme_normalize_lookup(ct.name) || '-' || ct.id::text as sort_key
    from public.club_teams ct
    where ct.club_id = p_club_id
      and ct.is_archived
      and (v_scope is null or ct.id = any (v_scope))
  )
  select r.id, r.name, r.logo_url, r.has_history, r.sort_key
  from team_rows r
  where p_cursor is null or r.sort_key > p_cursor
  order by r.sort_key
  limit v_limit;
end;
$$;

revoke all on function public.fetch_inactive_teams(uuid, text, integer) from public;
grant execute on function public.fetch_inactive_teams(uuid, text, integer) to authenticated;


-- ============================================================
-- SEZIONE 11 — public.fetch_team_seasons_context (§11, §31)
--
-- Il payload dello screen 02, e la fonte di verità delle schermate
-- focalizzate che ne discendono. §31 chiede che distingua **esplicitamente**
-- identità, stato, corrente presente/assente, prossima disponibile/preparata,
-- capability e versioni: tre blocchi separati invece di un elenco di
-- stagioni da interpretare nel client.
--
-- `current_config_id is null` è lo stato "da configurare" di §7. Non viene
-- riempito con la classificazione dell'ultima stagione: §10 lo vieta
-- («senza usare dati storici come correnti»).
--
-- Il Team non attivo **non** diventa tutto concluso (§28): la sua
-- configurazione corrente resta un riferimento temporale e viene restituita
-- com'è, con `is_archived` a dire il resto.
-- ============================================================

create or replace function public.fetch_team_seasons_context(p_team_id uuid)
returns table (
  team_id              uuid,
  club_id              uuid,
  club_name            text,
  club_logo_url        text,
  club_is_verified     boolean,
  name                 text,
  crest_url            text,
  is_archived          boolean,
  team_version         integer,
  season_id            text,
  season_label         text,
  current_config_id    uuid,
  current_type_id      text,
  current_type_label   text,
  current_level_id     text,
  current_level_label  text,
  current_version      integer,
  next_season_id       text,
  next_season_label    text,
  next_config_id       uuid,
  next_type_id         text,
  next_type_label      text,
  next_level_id        text,
  next_level_label     text,
  next_version         integer,
  history_count        integer,
  can_view_history     boolean,
  can_prepare          boolean,
  can_edit_history     boolean,
  can_add_history      boolean,
  can_manage_lifecycle boolean,
  access_verified_at   timestamptz,
  data_revision        bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_club    uuid;
  v_season  text := public.current_season_id();
  v_next    text := public.next_season_id();
  v_now     timestamptz := timezone('utc', now());
  v_history boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select ct.club_id into v_club from public.club_teams ct where ct.id = p_team_id;

  -- Inesistente, non consultabile o fuori perimetro: un solo esito, come in
  -- `fetch_team_detail`. §8 vieta di distinguerli, perché la differenza
  -- rivelerebbe l'esistenza di una squadra fuori scope.
  if v_club is null
     or not public.team_capability_allows(v_club, p_team_id, 'teams_view')
  then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  v_history := public.club_team_allows(p_team_id, 'seasons_history_view');

  return query
  select
    ct.id,
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    ct.name,
    ct.logo_url,
    ct.is_archived,
    ct.version,

    v_season,
    (select s.label from public.seasons s where s.id = v_season),
    cur.id, cur.team_type_id, curt.label, cur.level_id, curl.label, cur.version,

    v_next,
    (select s.label from public.seasons s where s.id = v_next),
    nxt.id, nxt.team_type_id, nxtt.label, nxt.level_id, nxtl.label, nxt.version,

    -- `null` = storico non consultabile; `0` = nessuna stagione passata.
    -- §33 non ammette che il secondo si travesta da primo.
    case when v_history then (
      select count(*)::integer
      from public.club_team_seasons h
      join public.seasons hs on hs.id = h.season_id
      join public.seasons cs on cs.id = v_season
      where h.team_id = ct.id and hs.sort_order < cs.sort_order
    ) end,

    v_history,
    public.club_team_allows(ct.id, 'seasons_prepare'),
    public.club_team_allows(ct.id, 'seasons_history_edit'),
    public.club_team_allows(ct.id, 'seasons_history_add'),
    public.club_team_allows(ct.id, 'teams_lifecycle'),

    v_now,
    (extract(epoch from v_now) * 1000)::bigint
  from public.club_teams ct
  join public.clubs c on c.id = ct.club_id
  left join public.club_team_seasons cur
    on cur.team_id = ct.id and cur.season_id = v_season
  left join public.team_types  curt on curt.id = cur.team_type_id
  left join public.team_levels curl on curl.id = cur.level_id
  left join public.club_team_seasons nxt
    on nxt.team_id = ct.id and v_next is not null and nxt.season_id = v_next
  left join public.team_types  nxtt on nxtt.id = nxt.team_type_id
  left join public.team_levels nxtl on nxtl.id = nxt.level_id
  where ct.id = p_team_id;
end;
$$;

revoke all on function public.fetch_team_seasons_context(uuid) from public;
grant execute on function public.fetch_team_seasons_context(uuid) to authenticated;

comment on function public.fetch_team_seasons_context(uuid) is
  'DAS-REV-10 §11/§31: contesto stagionale di una squadra — identità, stato, '
  'corrente (presente o assente), prossima (disponibile o preparata), '
  'capability e versioni per la riconciliazione.';


-- ============================================================
-- SEZIONE 12 — Storico: elenco, dettaglio e catalogo selezionabile
--
-- Tre letture distinte perché sono tre domande distinte: che cosa c'è
-- (§11), che cosa dice una riga (§16), che cosa si può ancora aggiungere
-- (§19).
--
-- L'elenco è ordinato dal più recente al più vecchio con un cursore
-- discendente: §11 fissa l'ordine e §31 chiede paginazione stabile, quindi
-- la chiave di pagina è `sort_order` zero-padded e non la label.
-- ============================================================

create or replace function public.fetch_team_season_history_page(
  p_team_id uuid,
  p_cursor  text default null,
  p_limit   integer default 20
)
returns table (
  team_season_id uuid,
  season_id      text,
  season_label   text,
  type_id        text,
  type_label     text,
  level_id       text,
  level_label    text,
  version        integer,
  sort_key       text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.club_team_allows(p_team_id, 'seasons_history_view') then
    return;
  end if;

  -- §33: «Empty deriva da una response valida, mai da un errore convertito
  -- in lista vuota.» Un catalogo non risolvibile non è uno storico vuoto.
  if public.current_season_id() is null then
    raise exception 'SEASON_CATALOG_UNAVAILABLE';
  end if;

  return query
  select
    cts.id,
    cts.season_id,
    s.label,
    cts.team_type_id,
    tt.label,
    cts.level_id,
    tl.label,
    cts.version,
    lpad(s.sort_order::text, 6, '0') as sort_key
  from public.club_team_seasons cts
  join public.seasons s on s.id = cts.season_id
  join public.seasons cur on cur.id = public.current_season_id()
  left join public.team_types  tt on tt.id = cts.team_type_id
  left join public.team_levels tl on tl.id = cts.level_id
  where cts.team_id = p_team_id
    and s.sort_order < cur.sort_order
    and (p_cursor is null or lpad(s.sort_order::text, 6, '0') < p_cursor)
  order by s.sort_order desc
  limit v_limit;
end;
$$;

revoke all on function public.fetch_team_season_history_page(uuid, text, integer) from public;
grant execute on function public.fetch_team_season_history_page(uuid, text, integer) to authenticated;


create or replace function public.fetch_team_season_detail(p_team_season_id uuid)
returns table (
  team_season_id   uuid,
  team_id          uuid,
  team_name        text,
  crest_url        text,
  club_id          uuid,
  club_name        text,
  club_is_verified boolean,
  is_archived      boolean,
  season_id        text,
  season_label     text,
  phase            text,
  type_id          text,
  type_label       text,
  level_id         text,
  level_label      text,
  version          integer,
  can_edit         boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_team  uuid;
  v_phase text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select cts.team_id, public.team_season_phase(cts.season_id)
    into v_team, v_phase
  from public.club_team_seasons cts
  where cts.id = p_team_season_id;

  if v_team is null or not public.club_team_allows(v_team, 'seasons_history_view') then
    raise exception 'TEAM_SEASON_NOT_FOUND';
  end if;

  return query
  select
    cts.id,
    ct.id,
    ct.name,
    ct.logo_url,
    c.id,
    c.name,
    coalesce(c.verification_status, 'unverified') = 'verified',
    ct.is_archived,
    cts.season_id,
    s.label,
    v_phase,
    cts.team_type_id,
    tt.label,
    cts.level_id,
    tl.label,
    cts.version,
    -- §16: «Mostrare "Modifica dati stagione" soltanto con autorizzazione
    -- esplicita.» Una stagione non conclusa si modifica dal percorso di
    -- preparazione, con la sua chiave: non da qui.
    case
      when v_phase = 'past' then public.club_team_allows(ct.id, 'seasons_history_edit')
      else public.club_team_allows(ct.id, 'seasons_prepare')
    end
  from public.club_team_seasons cts
  join public.club_teams ct on ct.id = cts.team_id
  join public.clubs c on c.id = ct.club_id
  join public.seasons s on s.id = cts.season_id
  left join public.team_types  tt on tt.id = cts.team_type_id
  left join public.team_levels tl on tl.id = cts.level_id
  where cts.id = p_team_season_id;
end;
$$;

revoke all on function public.fetch_team_season_detail(uuid) from public;
grant execute on function public.fetch_team_season_detail(uuid) to authenticated;


/**
 * Stagioni storiche selezionabili per i campi Da/A (§19).
 *
 * «Da e A elencano soltanto stagioni storiche centrali. Una stagione già
 * presente può essere indicata come tale, ma non impedisce di selezionare un
 * intervallo che la contiene: sarà esclusa dalla creazione.»
 *
 * `already_present` è quindi un'etichetta, non un filtro — la riga resta
 * selezionabile.
 */
create or replace function public.fetch_team_history_season_options(p_team_id uuid)
returns table (
  season_id       text,
  label           text,
  sort_order      integer,
  already_present boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.club_team_allows(p_team_id, 'seasons_history_view') then
    return;
  end if;

  if public.current_season_id() is null then
    raise exception 'SEASON_CATALOG_UNAVAILABLE';
  end if;

  return query
  select
    s.id,
    s.label,
    s.sort_order,
    exists (
      select 1 from public.club_team_seasons cts
      where cts.team_id = p_team_id and cts.season_id = s.id
    )
  from public.seasons s
  join public.seasons cur on cur.id = public.current_season_id()
  where s.sort_order < cur.sort_order
  order by s.sort_order desc;
end;
$$;

revoke all on function public.fetch_team_history_season_options(uuid) from public;
grant execute on function public.fetch_team_history_season_options(uuid) to authenticated;


-- ============================================================
-- SEZIONE 13 — Validazione della classificazione (§14, §19)
--
-- Tipo obbligatorio, Livello facoltativo e compatibile. La compatibilità è
-- dichiarata in `team_type_levels` e non dedotta dai nomi (DAS-REV-08 §15).
--
-- `is_active` **non** entra nel controllo: §19 è esplicito — «Una categoria
-- storica legittima non deve scomparire perché oggi non viene più proposta
-- per nuove squadre». Il filtro sulle voci attive appartiene ai selector,
-- che propongono; non alla validazione, che accetta ciò che è coerente.
-- ============================================================

create or replace function public.assert_team_classification(
  p_type_id  text,
  p_level_id text
)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if p_type_id is null or length(trim(p_type_id)) = 0 then
    raise exception 'TEAM_TYPE_REQUIRED';
  end if;

  if not exists (select 1 from public.team_types t where t.id = p_type_id) then
    raise exception 'TEAM_TYPE_UNKNOWN';
  end if;

  if p_level_id is not null and not exists (
    select 1 from public.team_type_levels ttl
    where ttl.team_type_id = p_type_id and ttl.level_id = p_level_id
  ) then
    raise exception 'TEAM_LEVEL_INCOMPATIBLE';
  end if;
end;
$$;

grant execute on function public.assert_team_classification(text, text) to authenticated;


-- ============================================================
-- SEZIONE 14 — public.save_team_season_config (§12, §13, §15)
--
-- Una sola funzione per tre azioni che il prodotto presenta separate:
-- preparare la prossima, configurare la corrente mancante, modificare l'una
-- o l'altra. Sono la stessa scrittura — la classificazione di una stagione
-- non conclusa — e separarle avrebbe moltiplicato per tre le stesse
-- validazioni.
--
-- `p_target` dice **quale** stagione, e il server la risolve: §6 vieta di
-- accettare «un season_id arbitrario dal client come prova di validità». Il
-- `p_season_id` che il client ha visto serve solo a riconoscere che il
-- calendario è cambiato sotto il form (§15):
--
--   «Se la stagione centrale cambia mentre il form è aperto, non
--    reinterpretare silenziosamente Prepara futura come Configura corrente.»
--
-- `p_expected_version` nullo significa "sto creando". Una riga già esistente
-- in quel caso **non** viene sovrascritta: §15 vuole che il tentativo di
-- creazione di un secondo actor restituisca il contesto aggiornato, non
-- l'ultima scrittura.
-- ============================================================

create or replace function public.save_team_season_config(
  p_team_id          uuid,
  p_target           text,
  p_season_id        text,
  p_type_id          text,
  p_level_id         text default null,
  p_expected_version integer default null,
  p_idempotency_key  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club        uuid;
  v_archived    boolean;
  v_target      text;
  v_existing    public.club_team_seasons%rowtype;
  v_row         public.club_team_seasons%rowtype;
  v_level       text := nullif(p_level_id, '');
  v_fingerprint text;
  v_replay      jsonb;
  v_result      jsonb;
  /*
    Due nomi, non uno. `v_operation` identifica **il tentativo** e vale per
    l'idempotenza: deve essere lo stesso al primo invio e al retry, quindi
    dipende solo dal target. `v_audit_operation` racconta che cosa è
    successo — creazione o aggiornamento — e lo sa solo dopo il lock.

    Confonderli faceva fallire il retry di un aggiornamento riuscito:
    la chiave veniva cercata come "prepare" e trovata registrata come
    "update", cioè come contenuto cambiato.
  */
  v_operation       text;
  v_audit_operation text;
  v_created         boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_target not in ('current', 'next') then
    raise exception 'SEASON_TARGET_INVALID';
  end if;

  select ct.club_id, ct.is_archived into v_club, v_archived
  from public.club_teams ct where ct.id = p_team_id;

  if v_club is null
     or not public.team_capability_allows(v_club, p_team_id, 'teams_view')
  then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  if not public.club_team_allows(p_team_id, 'seasons_prepare') then
    raise exception 'TEAM_NOT_AUTHORIZED';
  end if;

  -- §13: «La configurazione di un Team non attivo viene combinata con la
  -- riattivazione soltanto nel flusso esplicito della sezione 29.»
  if v_archived then
    raise exception 'TEAM_NOT_ACTIVE';
  end if;

  v_target := case when p_target = 'current'
                then public.current_season_id()
                else public.next_season_id()
              end;

  if v_target is null then
    raise exception 'SEASON_CATALOG_UNAVAILABLE';
  end if;

  if p_season_id is distinct from v_target then
    raise exception 'SEASON_CONTEXT_CHANGED';
  end if;

  perform public.assert_team_classification(p_type_id, v_level);

  v_fingerprint := md5(
    coalesce(p_target, '') || '|' || coalesce(v_target, '') || '|' ||
    coalesce(p_type_id, '') || '|' || coalesce(v_level, '') || '|' ||
    coalesce(p_expected_version::text, '')
  );
  v_operation := case when p_target = 'current' then 'season_configure' else 'season_prepare' end;
  v_audit_operation := v_operation;

  v_replay := public.club_team_operation_replay(
    p_idempotency_key, p_team_id, v_operation, v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_existing
  from public.club_team_seasons
  where team_id = p_team_id and season_id = v_target
  for update;

  if found then
    if p_expected_version is null then
      -- Creazione contro una riga già creata da un altro actor: non la si
      -- sovrascrive. Il client ricarica e, se vuole, modifica con la propria
      -- capability (§15).
      raise exception 'SEASON_ALREADY_EXISTS';
    end if;

    if v_existing.version is distinct from p_expected_version then
      raise exception 'SEASON_VERSION_CONFLICT';
    end if;

    update public.club_team_seasons
       set team_type_id = p_type_id,
           level_id     = v_level
     where id = v_existing.id
    returning * into v_row;

    v_audit_operation := 'season_update';
  else
    insert into public.club_team_seasons (team_id, season_id, team_type_id, level_id)
    values (p_team_id, v_target, p_type_id, v_level)
    returning * into v_row;

    v_created := true;
  end if;

  v_result := jsonb_build_object(
    'team_season_id', v_row.id,
    'team_id',        v_row.team_id,
    'season_id',      v_row.season_id,
    'type_id',        v_row.team_type_id,
    'level_id',       v_row.level_id,
    'version',        v_row.version,
    'created',        v_created
  );

  insert into public.club_team_audit
    (club_id, team_id, team_season_id, operation, details, actor_id, correlation_id)
  values (
    v_club, p_team_id, v_row.id, v_audit_operation,
    jsonb_build_object(
      'season_id', v_row.season_id,
      'target',    p_target,
      'previous',  case when v_created then null else jsonb_build_object(
                     'type_id',  v_existing.team_type_id,
                     'level_id', v_existing.level_id,
                     'version',  v_existing.version
                   ) end,
      'next',      jsonb_build_object(
                     'type_id',  v_row.team_type_id,
                     'level_id', v_row.level_id,
                     'version',  v_row.version
                   )
    ),
    auth.uid(), p_idempotency_key
  );

  perform public.club_team_operation_record(
    p_idempotency_key, p_team_id, v_operation, v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.save_team_season_config(uuid, text, text, text, text, integer, text) from public;
grant execute on function public.save_team_season_config(uuid, text, text, text, text, integer, text) to authenticated;

comment on function public.save_team_season_config(uuid, text, text, text, text, integer, text) is
  'DAS-REV-10 §12/§13/§15: scrive la classificazione della stagione corrente '
  'o della prossima. Il target è risolto dal server; il season_id del client '
  'serve solo a rilevare un cambio di calendario.';


-- ============================================================
-- SEZIONE 15 — public.update_team_season_history (§16, §17)
--
-- «Aggiornare la Team Season esistente con ID stabile e controllo della
-- versione. Non modificare il suo Season ID o creare un duplicato per
-- simulare una correzione.»
--
-- La funzione tocca quindi due sole colonne. Lo stato resta Conclusa perché
-- non è persistito: deriva dalla stagione, che qui non cambia mai (§17
-- vieta di «renderla corrente»). Non esiste una controparte `delete`: §17
-- proibisce Elimina stagione fra le azioni ordinarie.
-- ============================================================

create or replace function public.update_team_season_history(
  p_team_season_id   uuid,
  p_type_id          text,
  p_level_id         text default null,
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.club_team_seasons%rowtype;
  v_row      public.club_team_seasons%rowtype;
  v_club     uuid;
  v_level    text := nullif(p_level_id, '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_existing
  from public.club_team_seasons
  where id = p_team_season_id
  for update;

  if not found then
    raise exception 'TEAM_SEASON_NOT_FOUND';
  end if;

  select ct.club_id into v_club from public.club_teams ct where ct.id = v_existing.team_id;

  if not public.club_team_allows(v_existing.team_id, 'seasons_history_view') then
    raise exception 'TEAM_SEASON_NOT_FOUND';
  end if;

  if public.team_season_phase(v_existing.season_id) is distinct from 'past' then
    raise exception 'SEASON_NOT_HISTORICAL';
  end if;

  if not public.club_team_allows(v_existing.team_id, 'seasons_history_edit') then
    raise exception 'TEAM_NOT_AUTHORIZED';
  end if;

  if v_existing.version is distinct from p_expected_version then
    raise exception 'SEASON_VERSION_CONFLICT';
  end if;

  perform public.assert_team_classification(p_type_id, v_level);

  update public.club_team_seasons
     set team_type_id = p_type_id,
         level_id     = v_level
   where id = v_existing.id
  returning * into v_row;

  insert into public.club_team_audit
    (club_id, team_id, team_season_id, operation, details, actor_id)
  values (
    v_club, v_row.team_id, v_row.id, 'history_correct',
    jsonb_build_object(
      'season_id', v_row.season_id,
      'previous',  jsonb_build_object(
                     'type_id',  v_existing.team_type_id,
                     'level_id', v_existing.level_id,
                     'version',  v_existing.version
                   ),
      'next',      jsonb_build_object(
                     'type_id',  v_row.team_type_id,
                     'level_id', v_row.level_id,
                     'version',  v_row.version
                   )
    ),
    auth.uid()
  );

  return jsonb_build_object(
    'team_season_id', v_row.id,
    'team_id',        v_row.team_id,
    'season_id',      v_row.season_id,
    'type_id',        v_row.team_type_id,
    'level_id',       v_row.level_id,
    'version',        v_row.version
  );
end;
$$;

revoke all on function public.update_team_season_history(uuid, text, text, integer) from public;
grant execute on function public.update_team_season_history(uuid, text, text, integer) to authenticated;


-- ============================================================
-- SEZIONE 16 — public.preview_team_season_history (§18, §20, §31)
--
-- Il calcolo di §20, interamente server-side:
--
--   «espandere ogni periodo nelle stagioni canoniche selezionate; escludere
--    quelle già persistite per il Team; controllare le sovrapposizioni delle
--    stagioni ancora da creare; contare gli identificativi nuovi unici del
--    batch.»
--
-- Tre regole che il client non può applicare da solo e che §31 affida
-- esplicitamente al server («Il numero nella CTA deriva da questa stessa
-- risoluzione»):
--
--   · una stagione già persistita è **esclusa** e non modificata, anche se
--     il periodo proporrebbe un'altra classificazione;
--   · due periodi che si sovrappongono con la **stessa** classificazione
--     deduplicano: la stagione è contata una volta sola, e appartiene al
--     primo periodo in ordine di inserimento (§20);
--   · due periodi che si sovrappongono con classificazioni **diverse** sono
--     un conflitto da correggere, non una scelta da fare per l'utente.
--
-- `context_version` è l'impronta dello storico già presente. È ciò che
-- rende rilevabile lo scenario di §23 — un altro amministratore crea una
-- delle sei stagioni mentre il riepilogo è aperto — senza confrontare liste
-- nel client.
-- ============================================================

create or replace function public.preview_team_season_history(
  p_team_id uuid,
  p_periods jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cur_order integer;
  v_cur_id    text := public.current_season_id();
  v_limit     constant integer := 100;
  v_periods   jsonb := coalesce(p_periods, '[]'::jsonb);
  v_result    jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.club_team_allows(p_team_id, 'seasons_history_add') then
    raise exception 'TEAM_NOT_AUTHORIZED';
  end if;

  select s.sort_order into v_cur_order from public.seasons s where s.id = v_cur_id;

  -- §6: un catalogo non risolvibile è un errore con retry, non un catalogo
  -- vuoto che produrrebbe "zero stagioni da aggiungere".
  if v_cur_order is null then
    raise exception 'SEASON_CATALOG_UNAVAILABLE';
  end if;

  with input as (
    select
      (ord - 1)::integer            as idx,
      elem->>'from_season'          as from_season,
      elem->>'to_season'            as to_season,
      nullif(elem->>'type_id', '')  as type_id,
      nullif(elem->>'level_id', '') as level_id
    from jsonb_array_elements(v_periods) with ordinality as t(elem, ord)
  ),
  resolved as (
    select
      i.idx, i.from_season, i.to_season, i.type_id, i.level_id,
      f.sort_order as from_order,
      t.sort_order as to_order,
      case
        when f.id is null or t.id is null              then 'PERIOD_SEASON_UNKNOWN'
        when f.sort_order >= v_cur_order
          or t.sort_order >= v_cur_order               then 'PERIOD_NOT_HISTORICAL'
        when f.sort_order > t.sort_order               then 'PERIOD_RANGE_INVERTED'
        when i.type_id is null                         then 'PERIOD_TYPE_REQUIRED'
        when not exists (
          select 1 from public.team_types tt where tt.id = i.type_id
        )                                              then 'PERIOD_TYPE_UNKNOWN'
        when i.level_id is not null and not exists (
          select 1 from public.team_type_levels ttl
          where ttl.team_type_id = i.type_id and ttl.level_id = i.level_id
        )                                              then 'PERIOD_LEVEL_INCOMPATIBLE'
        else null
      end as error_code
    from input i
    left join public.seasons f on f.id = i.from_season
    left join public.seasons t on t.id = i.to_season
  ),
  expanded as (
    select r.idx, r.type_id, r.level_id, s.id as season_id, s.sort_order
    from resolved r
    join public.seasons s
      on r.error_code is null
     and s.sort_order between r.from_order and r.to_order
  ),
  persisted as (
    select cts.season_id
    from public.club_team_seasons cts
    where cts.team_id = p_team_id
  ),
  candidate as (
    select e.*
    from expanded e
    where not exists (select 1 from persisted p where p.season_id = e.season_id)
  ),
  -- Prima occorrenza secondo l'ordine stabile di inserimento dei periodi
  -- (§20). `distinct on` ordinato per idx è esattamente quella regola.
  claimed as (
    select distinct on (c.season_id)
      c.season_id, c.idx, c.type_id, c.level_id, c.sort_order
    from candidate c
    order by c.season_id, c.idx
  ),
  conflicts as (
    select c.season_id, array_agg(distinct c.idx order by c.idx) as period_indexes
    from candidate c
    group by c.season_id
    having count(distinct (c.type_id, coalesce(c.level_id, ''))) > 1
  ),
  per_period as (
    select
      r.idx,
      r.from_season, r.to_season, r.type_id, r.level_id, r.error_code,
      (select count(*)::integer from claimed k where k.idx = r.idx) as new_count,
      (
        select count(*)::integer
        from expanded e
        join persisted p on p.season_id = e.season_id
        where e.idx = r.idx
      ) as existing_count,
      (
        select count(*)::integer
        from candidate c
        where c.idx = r.idx
          and not exists (select 1 from claimed k where k.season_id = c.season_id and k.idx = r.idx)
      ) as draft_covered_count
    from resolved r
  )
  select jsonb_build_object(
    'context_version', md5(
      p_team_id::text || '|' || coalesce(v_cur_id, '') || '|' ||
      coalesce((select string_agg(p.season_id, ',' order by p.season_id) from persisted p), '')
    ),
    'current_season_id', v_cur_id,
    'total_new',      coalesce((select count(*)::integer from claimed), 0),
    'total_existing', coalesce((
      select count(distinct e.season_id)::integer
      from expanded e join persisted p on p.season_id = e.season_id
    ), 0),
    'limit',      v_limit,
    'over_limit', coalesce((select count(*) from claimed), 0) > v_limit,
    'periods', coalesce((
      select jsonb_agg(jsonb_build_object(
        'index',               pp.idx,
        'from_season',         pp.from_season,
        'to_season',           pp.to_season,
        'type_id',             pp.type_id,
        'level_id',            pp.level_id,
        'new_count',           coalesce(pp.new_count, 0),
        'existing_count',      coalesce(pp.existing_count, 0),
        'draft_covered_count', coalesce(pp.draft_covered_count, 0),
        'error_code',          pp.error_code
      ) order by pp.idx) from per_period pp
    ), '[]'::jsonb),
    'conflicts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'season_id',      cf.season_id,
        'period_indexes', to_jsonb(cf.period_indexes)
      ) order by cf.season_id) from conflicts cf
    ), '[]'::jsonb),
    'new_rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'season_id',    k.season_id,
        'type_id',      k.type_id,
        'level_id',     k.level_id,
        'period_index', k.idx
      ) order by k.sort_order) from claimed k
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.preview_team_season_history(uuid, jsonb) from public;
grant execute on function public.preview_team_season_history(uuid, jsonb) to authenticated;

comment on function public.preview_team_season_history(uuid, jsonb) is
  'DAS-REV-10 §20: espansione dei periodi, esclusione delle stagioni già '
  'persistite, deduplicazione per prima occorrenza, conflitti e conteggi. '
  'Il numero della CTA deriva da qui, non dal client.';


-- ============================================================
-- SEZIONE 17 — public.commit_team_season_history (§23)
--
-- La strategia univoca che §23 impone, e non una delle tante possibili:
--
--   «se il contenuto effettivamente creabile cambia rispetto al riepilogo
--    confermato, non effettuare un commit parziale silenzioso. Restituire il
--    riepilogo aggiornato e richiedere una nuova conferma.»
--
-- Quindi il commit **ricalcola** la preview e confronta due cose: l'impronta
-- dello storico e il numero confermato. Se una delle due è cambiata,
-- solleva: il client rilegge la preview e la ripropone. Nessuna delle sei
-- stagioni viene salvata sotto una CTA che ne prometteva sei.
--
-- L'atomicità è quella della funzione: un solo `insert ... select`, una sola
-- transazione. Un errore non lascia metà batch inserito.
-- ============================================================

create or replace function public.commit_team_season_history(
  p_team_id            uuid,
  p_periods            jsonb,
  p_context_version    text,
  p_expected_new_count integer,
  p_idempotency_key    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club        uuid;
  v_archived    boolean;
  v_preview     jsonb;
  v_total       integer;
  v_inserted    integer;
  v_fingerprint text;
  v_replay      jsonb;
  v_result      jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select ct.club_id, ct.is_archived into v_club, v_archived
  from public.club_teams ct where ct.id = p_team_id;

  if v_club is null
     or not public.team_capability_allows(v_club, p_team_id, 'teams_view')
  then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  if not public.club_team_allows(p_team_id, 'seasons_history_add') then
    raise exception 'TEAM_NOT_AUTHORIZED';
  end if;

  v_fingerprint := md5(
    coalesce(p_periods::text, '') || '|' ||
    coalesce(p_context_version, '') || '|' ||
    coalesce(p_expected_new_count::text, '')
  );

  v_replay := public.club_team_operation_replay(
    p_idempotency_key, p_team_id, 'history_commit', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  v_preview := public.preview_team_season_history(p_team_id, p_periods);
  v_total   := (v_preview->>'total_new')::integer;

  if jsonb_array_length(v_preview->'conflicts') > 0 then
    raise exception 'HISTORY_PERIOD_CONFLICT';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_preview->'periods') pe
    where pe->>'error_code' is not null
  ) then
    raise exception 'HISTORY_PERIOD_INVALID';
  end if;

  if v_preview->>'context_version' is distinct from p_context_version
     or v_total is distinct from p_expected_new_count
  then
    raise exception 'HISTORY_CONTEXT_CHANGED';
  end if;

  if v_total = 0 then
    raise exception 'HISTORY_NOTHING_TO_ADD';
  end if;

  if (v_preview->>'over_limit')::boolean then
    raise exception 'HISTORY_BATCH_TOO_LARGE';
  end if;

  insert into public.club_team_seasons (team_id, season_id, team_type_id, level_id)
  select
    p_team_id,
    row_data->>'season_id',
    row_data->>'type_id',
    nullif(row_data->>'level_id', '')
  from jsonb_array_elements(v_preview->'new_rows') as row_data
  on conflict (team_id, season_id) do nothing;

  get diagnostics v_inserted = row_count;

  -- Una riga scartata dalla `on conflict` significa che qualcuno l'ha creata
  -- fra la preview e l'insert. §23 vieta il commit parziale: la transazione
  -- viene annullata per intero e il client riconferma.
  if v_inserted is distinct from v_total then
    raise exception 'HISTORY_CONTEXT_CHANGED';
  end if;

  v_result := jsonb_build_object(
    'created_count', v_inserted,
    'season_ids', (
      select coalesce(jsonb_agg(row_data->>'season_id'), '[]'::jsonb)
      from jsonb_array_elements(v_preview->'new_rows') as row_data
    )
  );

  insert into public.club_team_audit
    (club_id, team_id, operation, details, actor_id, correlation_id)
  values (
    v_club, p_team_id, 'history_commit',
    jsonb_build_object(
      'created_count', v_inserted,
      'origin',        'history_batch',
      'rows',          v_preview->'new_rows'
    ),
    auth.uid(), p_idempotency_key
  );

  perform public.club_team_operation_record(
    p_idempotency_key, p_team_id, 'history_commit', v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.commit_team_season_history(uuid, jsonb, text, integer, text) from public;
grant execute on function public.commit_team_season_history(uuid, jsonb, text, integer, text) to authenticated;


-- ============================================================
-- SEZIONE 18 — public.check_team_deactivation (§25, §26, §31)
--
-- Controllo read-only e server-driven: «Non modifica la squadra, non chiude
-- posizioni e non revoca inviti.»
--
-- Due impedimenti, entrambi negli stati canonici dei domini proprietari:
--
--   · Posizioni — `recruiting_ad_is_available` di DAS-REV-05, cioè
--     pubblicata e ancora entro il termine. Non «qualunque record esista»;
--   · Inviti — `club_members` in stato `pending` verso un profilo reale,
--     lo stesso perimetro di `fetch_team_detail`. I `club_invite_links` non
--     entrano: non hanno `team_id` e non possono produrre un collegamento a
--     questa squadra.
--
-- Le candidature non compaiono: §25 è esplicito — «Le candidature a
-- posizioni già chiuse non bloccano la disattivazione. Se la causa è una
-- posizione aperta, non duplicarla come un ulteriore blocker Candidature.»
-- Nemmeno il Gruppo squadra, che oltre a non essere un blocker non esiste
-- come dominio (DAS-REV-09 §17).
--
-- §26: chi può disattivare ma non consultare il dominio bloccante riceve il
-- blocco **senza** numero e senza destinazione. `count` nullo è quello, e
-- non zero.
-- ============================================================

create or replace function public.check_team_deactivation(p_team_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club      uuid;
  v_archived  boolean;
  v_positions integer;
  v_invites   integer;
  v_pos_view  boolean;
  v_inv_view  boolean;
  v_blockers  jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select ct.club_id, ct.is_archived into v_club, v_archived
  from public.club_teams ct where ct.id = p_team_id;

  if v_club is null
     or not public.team_capability_allows(v_club, p_team_id, 'teams_view')
  then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  if not public.club_team_allows(p_team_id, 'teams_lifecycle') then
    return jsonb_build_object(
      'authorized', false, 'allowed', false, 'blockers', '[]'::jsonb
    );
  end if;

  if v_archived then
    return jsonb_build_object(
      'authorized', true, 'allowed', false, 'already_inactive', true,
      'blockers', '[]'::jsonb
    );
  end if;

  v_pos_view := public.team_capability_allows(v_club, p_team_id, 'positions_view');
  v_inv_view := public.team_capability_allows(v_club, p_team_id, 'invites_view');

  select count(*)::integer into v_positions
  from public.recruiting_ads ad
  where ad.team_id = p_team_id
    and public.recruiting_ad_is_available(ad.status, ad.application_deadline_at);

  select count(*)::integer into v_invites
  from public.club_members cm
  where cm.team_id = p_team_id
    and cm.status = 'pending'
    and cm.profile_id is not null;

  if v_positions > 0 then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'kind',  'positions',
      'count', case when v_pos_view then v_positions end,
      'can_open', v_pos_view
    ));
  end if;

  if v_invites > 0 then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'kind',  'invites',
      'count', case when v_inv_view then v_invites end,
      'can_open', v_inv_view
    ));
  end if;

  return jsonb_build_object(
    'authorized', true,
    'allowed',    jsonb_array_length(v_blockers) = 0,
    'blockers',   v_blockers
  );
end;
$$;

revoke all on function public.check_team_deactivation(uuid) from public;
grant execute on function public.check_team_deactivation(uuid) to authenticated;


-- ============================================================
-- SEZIONE 19 — public.deactivate_club_team (§27)
--
-- «Validazione finale e transizione devono condividere una sezione critica,
-- transazione, lock o guard di versione equivalente. Non basta eseguire una
-- seconda GET e poi una scrittura non protetta.»
--
-- Il `select ... for update` sulla riga del Team è quella sezione critica, e
-- i due trigger della SEZIONE 7 ne sono l'altra metà: una Posizione o un
-- invito che nascano **dopo** il lock devono prima leggere `is_archived`, e
-- la loro transazione attende questa. Chi vince decide l'esito; nessuno dei
-- due esiti è incoerente.
--
-- La transizione non distrugge niente: ID, configurazioni, classificazioni,
-- membership e riferimenti restano. §27 vieta hard delete e chiusure
-- automatiche, e qui non c'è nessuna seconda scrittura.
-- ============================================================

create or replace function public.deactivate_club_team(
  p_team_id          uuid,
  p_expected_version integer default null,
  p_idempotency_key  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team        public.club_teams%rowtype;
  v_check       jsonb;
  v_fingerprint text;
  v_replay      jsonb;
  v_result      jsonb;
  v_version     integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.club_team_allows(p_team_id, 'teams_lifecycle') then
    raise exception 'TEAM_NOT_AUTHORIZED';
  end if;

  v_fingerprint := md5('deactivate|' || coalesce(p_expected_version::text, ''));

  v_replay := public.club_team_operation_replay(
    p_idempotency_key, p_team_id, 'team_deactivate', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_team from public.club_teams where id = p_team_id for update;

  if not found then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  -- Già non attiva: l'operazione ha già avuto il suo effetto. Un retry la
  -- ritrova così e non produce un secondo audit (§27).
  if v_team.is_archived then
    return jsonb_build_object(
      'team_id', v_team.id, 'is_archived', true, 'version', v_team.version,
      'already_applied', true
    );
  end if;

  if p_expected_version is not null and v_team.version is distinct from p_expected_version then
    raise exception 'TEAM_VERSION_CONFLICT';
  end if;

  v_check := public.check_team_deactivation(p_team_id);

  if not (v_check->>'allowed')::boolean then
    raise exception 'TEAM_HAS_OPEN_ACTIVITY';
  end if;

  update public.club_teams set is_archived = true where id = p_team_id
  returning version into v_version;

  v_result := jsonb_build_object(
    'team_id', p_team_id, 'is_archived', true, 'version', v_version,
    'already_applied', false
  );

  insert into public.club_team_audit
    (club_id, team_id, operation, details, actor_id, correlation_id)
  values (
    v_team.club_id, p_team_id, 'team_deactivate',
    jsonb_build_object('previous_version', v_team.version, 'version', v_version),
    auth.uid(), p_idempotency_key
  );

  perform public.club_team_operation_record(
    p_idempotency_key, p_team_id, 'team_deactivate', v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.deactivate_club_team(uuid, integer, text) from public;
grant execute on function public.deactivate_club_team(uuid, integer, text) to authenticated;


-- ============================================================
-- SEZIONE 20 — public.reactivate_club_team (§29)
--
-- «Riattivare significa rendere nuovamente attivo **lo stesso Team ID**.»
-- Due rami, una sola transazione:
--
--   Caso A — la configurazione corrente esiste ed è valida: viene riusata.
--            Tipo e Livello inviati dal client sono ignorati, perché §29
--            vieta di «richiedere di reinserire Tipo/Livello o creare una
--            nuova Team Season».
--   Caso B — manca o è incompleta: viene creata o **completata** sullo
--            stesso record, e serve anche `seasons_prepare`. «Riattiva non
--            concede automaticamente permessi di modifica stagionale.»
--
-- «Creazione/completamento della corrente e transizione Team devono riuscire
-- insieme»: sono due statement nella stessa funzione, quindi nella stessa
-- transazione. Un errore non lascia un Team riattivato senza classificazione.
-- ============================================================

create or replace function public.reactivate_club_team(
  p_team_id          uuid,
  p_season_id        text default null,
  p_type_id          text default null,
  p_level_id         text default null,
  p_expected_version integer default null,
  p_idempotency_key  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team        public.club_teams%rowtype;
  v_current     text := public.current_season_id();
  v_config      public.club_team_seasons%rowtype;
  v_level       text := nullif(p_level_id, '');
  v_fingerprint text;
  v_replay      jsonb;
  v_result      jsonb;
  v_version     integer;
  v_branch      text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.club_team_allows(p_team_id, 'teams_lifecycle') then
    raise exception 'TEAM_NOT_AUTHORIZED';
  end if;

  if v_current is null then
    raise exception 'SEASON_CATALOG_UNAVAILABLE';
  end if;

  v_fingerprint := md5(
    'reactivate|' || coalesce(v_current, '') || '|' ||
    coalesce(p_type_id, '') || '|' || coalesce(v_level, '') || '|' ||
    coalesce(p_expected_version::text, '')
  );

  v_replay := public.club_team_operation_replay(
    p_idempotency_key, p_team_id, 'team_reactivate', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_team from public.club_teams where id = p_team_id for update;

  if not found then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  -- §29: «Se il Team è già stato riattivato, riconciliare il risultato reale
  -- senza ripetere la creazione.»
  if not v_team.is_archived then
    return jsonb_build_object(
      'team_id', v_team.id, 'is_archived', false, 'version', v_team.version,
      'already_applied', true
    );
  end if;

  if p_expected_version is not null and v_team.version is distinct from p_expected_version then
    raise exception 'TEAM_VERSION_CONFLICT';
  end if;

  -- Il client dichiara quale corrente ha visto; se nel frattempo è cambiata,
  -- la schermata non sta più configurando quella stagione (§30).
  if p_season_id is not null and p_season_id is distinct from v_current then
    raise exception 'SEASON_CONTEXT_CHANGED';
  end if;

  select * into v_config
  from public.club_team_seasons
  where team_id = p_team_id and season_id = v_current
  for update;

  if found and v_config.team_type_id is not null then
    v_branch := 'reuse';
  else
    v_branch := case when found then 'complete' else 'create' end;

    if not public.club_team_allows(p_team_id, 'seasons_prepare') then
      raise exception 'SEASON_CONFIG_NOT_AUTHORIZED';
    end if;

    perform public.assert_team_classification(p_type_id, v_level);

    if found then
      update public.club_team_seasons
         set team_type_id = p_type_id, level_id = v_level
       where id = v_config.id
      returning * into v_config;
    else
      insert into public.club_team_seasons (team_id, season_id, team_type_id, level_id)
      values (p_team_id, v_current, p_type_id, v_level)
      returning * into v_config;
    end if;
  end if;

  update public.club_teams set is_archived = false where id = p_team_id
  returning version into v_version;

  v_result := jsonb_build_object(
    'team_id',         p_team_id,
    'is_archived',     false,
    'version',         v_version,
    'branch',          v_branch,
    'team_season_id',  v_config.id,
    'season_id',       v_config.season_id,
    'type_id',         v_config.team_type_id,
    'level_id',        v_config.level_id,
    'already_applied', false
  );

  insert into public.club_team_audit
    (club_id, team_id, team_season_id, operation, details, actor_id, correlation_id)
  values (
    v_team.club_id, p_team_id, v_config.id, 'team_reactivate',
    jsonb_build_object(
      'branch', v_branch,
      'season_id', v_config.season_id,
      'previous_version', v_team.version,
      'version', v_version
    ),
    auth.uid(), p_idempotency_key
  );

  perform public.club_team_operation_record(
    p_idempotency_key, p_team_id, 'team_reactivate', v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.reactivate_club_team(uuid, text, text, text, integer, text) from public;
grant execute on function public.reactivate_club_team(uuid, text, text, text, integer, text) to authenticated;

comment on function public.reactivate_club_team(uuid, text, text, text, integer, text) is
  'DAS-REV-10 §29: riattiva lo stesso Team ID. Riusa la configurazione '
  'corrente quando esiste ed è valida; altrimenti la crea o la completa '
  'nella stessa transazione, con la capability stagionale richiesta.';
