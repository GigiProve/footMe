-- ============================================================
-- DAS-REV-11 — Rete societaria e collegamenti
--
-- Il principio della task in una riga: **il collegamento è un rapporto
-- consensuale fra due Society autonome**. Il modello attuale non sa dirlo.
-- `club_affiliations` (20260411100000) è una lista **unilaterale**:
--
--   club_id → affiliate_club_id, `relationship_label` testo libero,
--   nessun richiedente, nessun consenso, nessuna data di accettazione,
--   nessuna direzione dichiarata, nessun modo di esprimere una partnership
--   simmetrica, nessuno stato oltre a `status` (aggiunto dalla 20261008090000
--   con default `confirmed`, cioè confermato per decreto).
--
-- Un club poteva quindi dichiararsi affiliate società che non lo sapevano, e
-- quella dichiarazione finiva sul profilo pubblico e in Cerca.
--
-- Cosa introduce
--   §7   `club_relationship_types`: tassonomia centrale con direzionalità,
--        ruoli dei due lati, sezione dal punto di vista di ciascuna parte,
--        ordine, selezionabilità e template di frase. Non liste nel frontend
--        né testo libero.
--   §6   `club_relationships`: **un solo dominio** per richiesta, relazione
--        attiva e storico. `pending → active | rejected | cancelled`,
--        `active → ended`. Nessun hard delete per ottenere uno stato.
--   §12  `exclusivity_key` + indice unico parziale: due richieste
--        pending/active incompatibili sulla stessa coppia non possono
--        coesistere, nemmeno inverse e nemmeno concorrenti.
--   §16/17/20 `club_relationship_invites`: invito esterno con token opaco
--        hashato, scadenza centrale, revoca, rigenerazione e convergenza
--        sulla richiesta canonica.
--   §5   otto capability distinte, tutte a scope Society: un amministratore
--        limitato a un Team non le ottiene.
--   §26  idempotenza (chiave + fingerprint) e audit protetto, sul modello di
--        `club_team_operations` / `club_team_audit`.
--   §24  `club_affiliations` diventa una **proiezione**: un trigger la
--        mantiene allineata alle relazioni attive e pubblicabili, così
--        profilo pubblico Società e Cerca continuano a leggere la riga che
--        leggono oggi senza conoscere il nuovo dominio.
--
-- Cosa **non** fa
--   Non cancella le righe `club_affiliations` preesistenti e non inventa per
--   loro un consenso (§31: «Non dedurre il consenso da un semplice elenco
--   testuale di nomi e non inventare accepted_at»). Restano dove sono, con
--   `relationship_id is null` a dirlo in modo esplicito: è quella colonna la
--   «segnalazione» che §31 chiede, e la riconciliazione è una richiesta vera
--   inviata dal nuovo flusso. Un trigger impedisce però al client di
--   cancellare o riscrivere le righe nate da un consenso.
--   Non tocca Team, membership, recruiting, Follow, Store o notifiche.
--   Non concede permessi amministrativi sull'altra Società: lo stato della
--   relazione non è una permission grant (§22).
--
-- Due conseguenze deliberate, da non scoprire in produzione:
--
--   · la policy preesistente «club owners can manage affiliations»
--     (20260411100000) resta in piedi, ma una scrittura diretta del
--     proprietario su una riga nata da un consenso ora **fallisce** con
--     `AFFILIATION_CONSENT_BACKED` invece di essere filtrata. È il punto di
--     §2: il secondo sistema di scrittura non deve esistere, e il guard lo
--     rende impossibile anche da fuori dall'app.
--
--   · `society_relationship_view` è chiamata una volta per riga di elenco.
--     Non è un N+1 sul filo — la pagina resta una sola risposta — ma lo è
--     dentro il database. Con il `limit 50` massimo sono ~250 query pianificate
--     per pagina. Resta così finché non si misura un problema: estrarre i
--     join di club e tipo nella query esterna duplicherebbe la logica di
--     prospettiva, che §7 vuole in un posto solo.
--
-- Rollback: droppare le funzioni e le tabelle di questa migrazione, la
-- colonna `club_affiliations.relationship_id`, i trigger aggiunti e
-- ripristinare il CHECK delle permission di 20261021090000.
--
-- Convenzioni riusate:
--   20261021090000_team_seasons_lifecycle.sql   (idempotenza, audit, CHECK)
--   20261018090000_dashboard_society_overview.sql (capability, scope)
--   20261008090000_society_master_profile.sql   (can_manage_society, is_public)
--   20261002160000_agent_assistiti_management.sql (token hashato, rate limit)
-- ============================================================


-- ============================================================
-- SEZIONE 1 — Capability (§5)
--
-- «Distinguere almeno le operazioni di consultazione rete, consultazione
-- richieste, invio richiesta, gestione richieste ricevute, annullamento
-- richiesta inviata, invito esterno, terminazione e consultazione storico.»
--
-- Otto operazioni, otto chiavi. Consultare non è gestire, e gestire una
-- richiesta ricevuta non è annullarne una inviata: sono i due lati opposti
-- del consenso e §15 vieta espressamente di confonderli.
--
-- Tutte sono **Society-level**: §5 dice che «le azioni strutturali richiedono
-- uno scope Society adeguato; un amministratore limitato a un Team non le
-- ottiene automaticamente». `club_member_permissions.team_id` (DAS-REV-07)
-- rende lo scope esprimibile, quindi qui basta pretendere `team_id is null`
-- al momento della lettura — niente nuova colonna.
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
    -- gruppo Stagioni e lifecycle (DAS-REV-10 §8)
    'seasons_prepare',
    'seasons_history_view',
    'seasons_history_edit',
    'seasons_history_add',
    'teams_lifecycle',
    -- gruppo Rete societaria (DAS-REV-11 §5) — nuove
    'network_view',
    'network_requests_view',
    'network_request_send',
    'network_request_manage',
    'network_request_cancel',
    'network_invite_create',
    'network_terminate',
    'network_history_view'
  ));


-- ============================================================
-- SEZIONE 2 — Tassonomia dei collegamenti (§7)
--
-- «Usare una tassonomia centrale, con identificativi e label localizzate …
-- Non creare tipi attraverso testo libero o liste frontend separate.»
--
-- Gli id sono slug stabili in inglese: §25 vieta «stringhe italiane come
-- chiavi di dominio». Le label, le sezioni e i template di frase sono invece
-- italiani perché sono **presentazione** servita dal contratto canonico — è
-- la via che §7 indica («label, descrizione e sezione dal punto di vista di
-- ciascuna parte») e che evita al renderer di indovinare la semantica da
-- source/target.
--
-- I template usano `{a}` e `{b}`, cioè i due lati canonici, non "mittente" e
-- "destinatario": chi ha inviato la richiesta non è automaticamente il club
-- di riferimento (§7). Un tipo nuovo si aggiunge con una riga, non con un
-- componente.
--
-- `exclusivity_group` risponde a §6 («Il modello non impone una sola
-- relazione assoluta per coppia di club. Applicare la policy canonica per
-- eventuali tipi distinti compatibili»): due tipi dello stesso gruppo si
-- escludono sulla stessa coppia, due di gruppi diversi convivono.
-- ============================================================

create table if not exists public.club_relationship_types (
  id                 text primary key,
  label              text not null,
  description        text,
  is_directional     boolean not null,
  /* Lato A — per i tipi direzionali è il ruolo "forte" (riferimento). */
  role_a_id          text,
  role_a_label       text,
  /* Sezione dell'elenco dal punto di vista di chi ha il ruolo A. */
  role_a_section     text,
  role_b_id          text,
  role_b_label       text,
  role_b_section     text,
  /* Sezione unica dei tipi simmetrici. */
  symmetric_section  text,
  /* "{b} sarà affiliata a {a}." — frase della proposta, prima dell'invio. */
  draft_template     text not null,
  /* "{b} è affiliata a {a}." — frase della relazione attiva o storica. */
  active_template    text not null,
  /* "{a} propone un'affiliazione a {b}." — frase della richiesta ricevuta. */
  proposal_template  text not null,
  /* Riga di elenco, vista da chi ha il ruolo A: "Affiliata a {a}". */
  row_template_a     text,
  /* Riga di elenco, vista da chi ha il ruolo B: "Società di riferimento". */
  row_template_b     text,
  /* Riga di elenco dei tipi simmetrici: "Partnership". */
  row_template_symmetric text,
  /* Collegamenti dello stesso gruppo non possono coesistere sulla coppia. */
  exclusivity_group  text,
  sort_order         integer not null default 0,
  /* §7: validità per nuove richieste. Un tipo dismesso resta leggibile. */
  is_selectable      boolean not null default true,
  created_at         timestamptz not null default timezone('utc', now())
);

alter table public.club_relationship_types
  drop constraint if exists club_relationship_types_roles_check;

alter table public.club_relationship_types
  add constraint club_relationship_types_roles_check
  check (
    case
      when is_directional then
        role_a_id is not null and role_b_id is not null
        and role_a_label is not null and role_b_label is not null
        and role_a_section is not null and role_b_section is not null
      else symmetric_section is not null
    end
  );

alter table public.club_relationship_types enable row level security;

-- Catalogo di presentazione: leggibile da chiunque possa aprire l'app, mai
-- scrivibile dal client.
drop policy if exists "anyone reads relationship types" on public.club_relationship_types;
create policy "anyone reads relationship types"
  on public.club_relationship_types for select to authenticated, anon
  using (true);

insert into public.club_relationship_types (
  id, label, description, is_directional,
  role_a_id, role_a_label, role_a_section,
  role_b_id, role_b_label, role_b_section,
  symmetric_section,
  draft_template, active_template, proposal_template,
  row_template_a, row_template_b, row_template_symmetric,
  exclusivity_group, sort_order, is_selectable
) values
  (
    'affiliation', 'Affiliazione',
    'Una società di riferimento e una società affiliata. Ogni società mantiene i propri amministratori e dati.',
    true,
    'reference', 'Società di riferimento', 'Società affiliate',
    'affiliate', 'Società affiliata', 'Società di riferimento',
    null,
    '{b} sarà affiliata {to_a}.',
    '{b} è affiliata {to_a}.',
    '{a} propone un''affiliazione {to_b}.',
    'Affiliata {to_a}', 'Società di riferimento', null,
    'structural', 10, true
  ),
  (
    'partnership', 'Partnership',
    'Collaborazione fra due società sullo stesso piano.',
    false,
    null, null, null,
    null, null, null,
    'Partnership',
    'Partnership tra {a} e {b}.',
    'Partnership tra {a} e {b}.',
    '{a} propone una partnership con {b}.',
    null, null, 'Partnership',
    null, 20, true
  ),
  (
    'academy_project', 'Academy / progetto territoriale',
    'Progetto territoriale fra una società titolare e una società che lo ospita.',
    true,
    'reference', 'Società titolare del progetto', 'Progetti territoriali',
    'academy', 'Società del progetto', 'Progetto territoriale di',
    null,
    '{b} ospiterà il progetto territoriale di {a}.',
    '{b} ospita il progetto territoriale di {a}.',
    '{a} propone un progetto territoriale {to_b}.',
    'Progetto territoriale di {a}', 'Società titolare del progetto', null,
    'structural', 30, true
  ),
  (
    'other_collaboration', 'Altra collaborazione',
    'Collaborazione non strutturale fra due società.',
    false,
    null, null, null,
    null, null, null,
    'Altre collaborazioni',
    'Collaborazione tra {a} e {b}.',
    'Collaborazione tra {a} e {b}.',
    '{a} propone una collaborazione {to_b}.',
    null, null, 'Collaborazione',
    null, 40, true
  )
on conflict (id) do nothing;


-- ============================================================
-- SEZIONE 3 — Il dominio canonico della relazione (§6)
--
-- «Riutilizzare un unico dominio di relazione … Richiesta, rete e storico non
-- devono avere copie indipendenti con ID incoerenti.»
--
-- Una sola tabella, quindi: la richiesta pendente, il collegamento attivo e
-- la riga dello storico sono **la stessa riga** in tre momenti diversi, con
-- lo stesso `id`. Lo storico non è una copia e non può divergere.
--
-- `club_a_id` / `club_b_id` sono i due **lati canonici**, non mittente e
-- destinatario: per un tipo direzionale A è il ruolo `role_a` del catalogo
-- (il riferimento) e B il `role_b` (l'affiliata); per un tipo simmetrico la
-- coppia è normalizzata per uuid crescente, così due proposte inverse
-- producono la stessa riga. Chi ha inviato sta in `requester_club_id`, ed è
-- un dato diverso — §7: «L'actor che invia la richiesta non è
-- automaticamente il club di riferimento».
-- ============================================================

create table if not exists public.club_relationships (
  id                 uuid primary key default gen_random_uuid(),
  type_id            text not null references public.club_relationship_types(id),
  club_a_id          uuid not null references public.clubs(id) on delete cascade,
  club_b_id          uuid not null references public.clubs(id) on delete cascade,
  requester_club_id  uuid not null references public.clubs(id) on delete cascade,
  recipient_club_id  uuid not null references public.clubs(id) on delete cascade,
  status             text not null default 'pending'
                       check (status in ('pending', 'active', 'rejected', 'cancelled', 'ended')),
  /* §14: la review conferma i termini letti. Se la versione cambia, serve
     una nuova review — il consenso non scivola su termini diversi. */
  version            integer not null default 1,
  /* Derivate dal trigger: §12 ne ha bisogno come vincolo persistente. */
  pair_key           text not null default '',
  exclusivity_key    text not null default '',
  /* §24: solo le relazioni attive e pubblicabili raggiungono le superfici
     pubbliche. Pending, rifiutate e inviti non diventano mai pubblici. */
  is_public          boolean not null default true,
  requested_at       timestamptz not null default timezone('utc', now()),
  requested_by       uuid references public.profiles(id) on delete set null,
  accepted_at        timestamptz,
  accepted_by        uuid references public.profiles(id) on delete set null,
  rejected_at        timestamptz,
  rejected_by        uuid references public.profiles(id) on delete set null,
  cancelled_at       timestamptz,
  cancelled_by       uuid references public.profiles(id) on delete set null,
  ended_at           timestamptz,
  ended_by           uuid references public.profiles(id) on delete set null,
  /* Quale delle due Società ha terminato: §22 chiede di registrarlo e §21 di
     non cambiarlo a un retry. */
  ended_by_club_id   uuid references public.clubs(id) on delete set null,
  created_at         timestamptz not null default timezone('utc', now()),
  updated_at         timestamptz not null default timezone('utc', now())
);

alter table public.club_relationships
  drop constraint if exists club_relationships_not_self;

alter table public.club_relationships
  add constraint club_relationships_not_self
  check (club_a_id <> club_b_id);

alter table public.club_relationships
  drop constraint if exists club_relationships_parties_check;

-- §12: «Impedire self-link, target non Society e metadata direzionali non
-- ammessi.» Mittente e destinatario devono essere i due lati della relazione
-- e non una terza Società qualsiasi.
alter table public.club_relationships
  add constraint club_relationships_parties_check
  check (
    requester_club_id <> recipient_club_id
    and requester_club_id in (club_a_id, club_b_id)
    and recipient_club_id in (club_a_id, club_b_id)
  );

alter table public.club_relationships
  drop constraint if exists club_relationships_status_timestamps_check;

-- §6: «Non usare ended per una richiesta mai accettata.» Il vincolo lo rende
-- impossibile invece di affidarlo alla disciplina del chiamante.
alter table public.club_relationships
  add constraint club_relationships_status_timestamps_check
  check (
    case status
      when 'pending'   then accepted_at is null and rejected_at is null
                            and cancelled_at is null and ended_at is null
      when 'active'    then accepted_at is not null and ended_at is null
      when 'rejected'  then rejected_at is not null and accepted_at is null
      when 'cancelled' then cancelled_at is not null and accepted_at is null
      when 'ended'     then accepted_at is not null and ended_at is not null
    end
  );

/**
 * Chiavi derivate (§12).
 *
 * `pair_key` normalizza la coppia: due proposte inverse hanno la stessa
 * chiave, quindi l'indice unico le vede come la stessa cosa anche quando i
 * mittenti differiscono. `exclusivity_key` porta il gruppo del catalogo nella
 * riga, perché un indice unico non può leggere un'altra tabella.
 */
create or replace function public.club_relationship_derive_keys()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_group text;
begin
  new.pair_key :=
    least(new.club_a_id, new.club_b_id)::text
    || '|' ||
    greatest(new.club_a_id, new.club_b_id)::text;

  select coalesce(t.exclusivity_group, 'type:' || t.id)
    into v_group
  from public.club_relationship_types t
  where t.id = new.type_id;

  new.exclusivity_key := coalesce(v_group, 'type:' || new.type_id);
  new.updated_at := timezone('utc', now());

  return new;
end;
$$;

revoke all on function public.club_relationship_derive_keys() from public;

drop trigger if exists club_relationships_derive_keys on public.club_relationships;
create trigger club_relationships_derive_keys
  before insert or update on public.club_relationships
  for each row execute function public.club_relationship_derive_keys();

-- §12: «Vincoli persistenti o garanzie transazionali equivalenti impediscono
-- due richieste pending/active incompatibili concorrenti. Una verifica GET
-- prima del submit non è sufficiente.»
create unique index if not exists club_relationships_open_unique
  on public.club_relationships (pair_key, exclusivity_key)
  where status in ('pending', 'active');

create index if not exists club_relationships_a_idx
  on public.club_relationships (club_a_id, status);

create index if not exists club_relationships_b_idx
  on public.club_relationships (club_b_id, status);

create index if not exists club_relationships_recipient_idx
  on public.club_relationships (recipient_club_id, status, requested_at desc);

create index if not exists club_relationships_requester_idx
  on public.club_relationships (requester_club_id, status, requested_at desc);

create index if not exists club_relationships_history_idx
  on public.club_relationships (club_a_id, club_b_id, ended_at desc)
  where status = 'ended';

alter table public.club_relationships enable row level security;
-- Nessuna policy di INSERT/UPDATE/DELETE: le scritture nascono solo dalle
-- funzioni `security definer` di questa migrazione. Un client non può
-- scrivere la propria versione del consenso.


-- ============================================================
-- SEZIONE 4 — Capability e scope (§5)
--
-- «Ogni read e mutation verifica actor autenticato, Società corrente,
-- membership/capability valide, scope e stato dell'oggetto. Le azioni
-- strutturali richiedono uno scope Society adeguato; un amministratore
-- limitato a un Team non le ottiene automaticamente.»
--
-- Il filtro `perm.team_id is null` è esattamente questa frase: DAS-REV-07 ha
-- reso lo scope esprimibile su `club_member_permissions`, e una delega
-- limitata a una squadra non vale per la rete della Società. Il proprietario
-- le ha tutte, come in `dashboard_club_capabilities`.
-- ============================================================

create or replace function public.society_network_capabilities(p_club_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_club_id is null or auth.uid() is null then array[]::text[]
    when public.owns_club(p_club_id) then array[
      'network_view',
      'network_requests_view',
      'network_request_send',
      'network_request_manage',
      'network_request_cancel',
      'network_invite_create',
      'network_terminate',
      'network_history_view'
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
          -- §5: scope Society. Una delega di squadra non sale.
          and perm.team_id is null
          and perm.permission_key in (
            'network_view',
            'network_requests_view',
            'network_request_send',
            'network_request_manage',
            'network_request_cancel',
            'network_invite_create',
            'network_terminate',
            'network_history_view'
          )
      ),
      array[]::text[]
    )
  end;
$$;

revoke all on function public.society_network_capabilities(uuid) from public;
grant execute on function public.society_network_capabilities(uuid) to authenticated;

create or replace function public.society_network_allows(p_club_id uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_key = any (public.society_network_capabilities(p_club_id));
$$;

revoke all on function public.society_network_allows(uuid, text) from public;
grant execute on function public.society_network_allows(uuid, text) to authenticated;

/**
 * Un qualunque accesso in lettura alla rete di questa Società.
 *
 * Serve alla policy RLS, che è una rete a maglie larghe: il filtro fine per
 * singola capability lo applicano le RPC, perché §5 chiede di distinguere
 * rete, richieste e storico e una policy sola non può saperlo dalla riga.
 */
create or replace function public.society_network_readable(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from unnest(public.society_network_capabilities(p_club_id)) as cap
    where cap in ('network_view', 'network_requests_view', 'network_history_view')
  );
$$;

revoke all on function public.society_network_readable(uuid) from public;
grant execute on function public.society_network_readable(uuid) to authenticated;

drop policy if exists "network parties read relationships" on public.club_relationships;
create policy "network parties read relationships"
  on public.club_relationships for select to authenticated
  using (
    public.society_network_readable(club_a_id)
    or public.society_network_readable(club_b_id)
  );


-- ============================================================
-- SEZIONE 5 — Audit protetto e idempotenza (§26, §30)
--
-- «Audit protetto per richiesta, consenso, rifiuto, annullamento,
-- risoluzione/revoca invito e terminazione: oggetto, parti canoniche, actor
-- autorizzato, azione, stato precedente/successivo, timestamp e correlation
-- ID. Conservare la storia anche dopo un nuovo episodio di collegamento.»
--
-- Nessuna policy di INSERT: le righe nascono dalle sole funzioni definer.
-- La SELECT è del proprietario di una delle due Società — l'audit non è una
-- superficie di prodotto e non ha una schermata.
-- ============================================================

create table if not exists public.club_relationship_audit (
  id               uuid primary key default gen_random_uuid(),
  relationship_id  uuid references public.club_relationships(id) on delete set null,
  invite_id        uuid,
  club_id          uuid references public.clubs(id) on delete set null,
  counterpart_club_id uuid references public.clubs(id) on delete set null,
  operation        text not null check (operation in (
                     'request_created',
                     'request_accepted',
                     'request_rejected',
                     'request_cancelled',
                     'relationship_ended',
                     'invite_created',
                     'invite_regenerated',
                     'invite_revoked',
                     'invite_resolved'
                   )),
  previous_status  text,
  next_status      text,
  actor_id         uuid references public.profiles(id) on delete set null,
  actor_club_id    uuid references public.clubs(id) on delete set null,
  correlation_id   text,
  details          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default timezone('utc', now())
);

create index if not exists club_relationship_audit_rel_idx
  on public.club_relationship_audit (relationship_id, created_at desc);

create index if not exists club_relationship_audit_club_idx
  on public.club_relationship_audit (club_id, created_at desc);

alter table public.club_relationship_audit enable row level security;

drop policy if exists "club owners read network audit" on public.club_relationship_audit;
create policy "club owners read network audit"
  on public.club_relationship_audit for select to authenticated
  using (
    (club_id is not null and public.owns_club(club_id))
    or (counterpart_club_id is not null and public.owns_club(counterpart_club_id))
  );

-- §26: «La stessa chiave identifica la stessa operazione e gli stessi
-- parametri; non generare una nuova chiave a ogni retry dopo timeout. Se
-- cambiano termini o destinatario, è una nuova operazione da confermare.»
-- Due colonne distinte: la chiave riconosce il tentativo, il fingerprint il
-- contenuto. Stesso modello di `club_team_operations` (20261021090000 §6).
create table if not exists public.club_relationship_operations (
  idempotency_key text primary key,
  actor_id        uuid not null references public.profiles(id) on delete cascade,
  club_id         uuid not null references public.clubs(id) on delete cascade,
  operation       text not null,
  fingerprint     text not null,
  result          jsonb not null,
  created_at      timestamptz not null default timezone('utc', now())
);

alter table public.club_relationship_operations enable row level security;
-- Nessuna policy: tabella interna alle funzioni definer.

create or replace function public.club_relationship_operation_replay(
  p_key         text,
  p_club_id     uuid,
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
  v_row public.club_relationship_operations%rowtype;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    return null;
  end if;

  select * into v_row
  from public.club_relationship_operations
  where idempotency_key = p_key;

  if not found then
    return null;
  end if;

  if v_row.actor_id is distinct from auth.uid()
     or v_row.club_id is distinct from p_club_id
     or v_row.operation is distinct from p_operation
     or v_row.fingerprint is distinct from p_fingerprint
  then
    raise exception 'OPERATION_CONTENT_CHANGED';
  end if;

  return v_row.result;
end;
$$;

revoke all on function public.club_relationship_operation_replay(text, uuid, text, text) from public;
grant execute on function public.club_relationship_operation_replay(text, uuid, text, text) to authenticated;

create or replace function public.club_relationship_operation_record(
  p_key         text,
  p_club_id     uuid,
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

  insert into public.club_relationship_operations
    (idempotency_key, actor_id, club_id, operation, fingerprint, result)
  values
    (p_key, auth.uid(), p_club_id, p_operation, p_fingerprint, p_result)
  on conflict (idempotency_key) do nothing;
end;
$$;

revoke all on function public.club_relationship_operation_record(text, uuid, text, text, jsonb) from public;
grant execute on function public.club_relationship_operation_record(text, uuid, text, text, jsonb) to authenticated;


-- ============================================================
-- SEZIONE 6 — Invito esterno (§16, §17, §20)
--
-- «Un'invitation esterna può avere un record distinto perché il destinatario
-- canonico non è ancora noto, ma deve convergere nello stesso lifecycle di
-- relazione» (§6).
--
-- Il token segue il modello già hardenizzato del progetto
-- (20261002160000, inviti procuratore→assistito): 32 byte casuali, in chiaro
-- restituiti **una volta sola**, in tabella solo lo sha256. Un dump del
-- database non contiene link utilizzabili.
--
-- `descriptive_name` è un promemoria del mittente, non un'identità: §16 vieta
-- che diventi una Society, erediti uno stemma o entri in Cerca. Per questo
-- non c'è nessuna FK e nessuna colonna `logo_url`.
--
-- La scadenza non la calcola il client (§20): esce da
-- `society_invite_ttl()`, che legge una policy centrale con default 7 giorni.
-- ============================================================

create table if not exists public.app_policy_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default timezone('utc', now())
);

alter table public.app_policy_settings enable row level security;
-- Nessuna policy: la policy centrale si legge dalle funzioni definer, non
-- dal client. §20 vieta espressamente di calcolare la scadenza nel client.

insert into public.app_policy_settings (key, value, description)
values (
  'society_invite_ttl_days',
  to_jsonb(7),
  'DAS-REV-11 §20 — durata di un invito di collegamento societario. Default V1: 7 giorni.'
)
on conflict (key) do nothing;

create or replace function public.society_invite_ttl()
returns interval
language sql
stable
security definer
set search_path = public
as $$
  select make_interval(days => coalesce(
    (select (value #>> '{}')::int from public.app_policy_settings
      where key = 'society_invite_ttl_days'),
    7
  ));
$$;

revoke all on function public.society_invite_ttl() from public;
grant execute on function public.society_invite_ttl() to authenticated;

create table if not exists public.club_relationship_invites (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references public.clubs(id) on delete cascade,
  type_id            text not null references public.club_relationship_types(id),
  /* Ruolo della Società invitante nel tipo direzionale; null se simmetrico. */
  inviter_role_id    text,
  /* Riferimento descrittivo del mittente. Mai un'identità (§16). */
  descriptive_name   text,
  /* sha256 esadecimale del token. Il token in chiaro non viene mai scritto. */
  token_hash         text not null unique,
  version            integer not null default 1,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default timezone('utc', now()),
  expires_at         timestamptz not null,
  revoked_at         timestamptz,
  revoked_by         uuid references public.profiles(id) on delete set null,
  resolved_at        timestamptz,
  resolved_club_id   uuid references public.clubs(id) on delete set null,
  resolved_by        uuid references public.profiles(id) on delete set null,
  /* Convergenza sul dominio canonico (§6, §19). */
  relationship_id    uuid references public.club_relationships(id) on delete set null,
  /* Alimenta `data_revision` del Centro insieme alle relazioni (§27). */
  updated_at         timestamptz not null default timezone('utc', now())
);

create or replace function public.club_relationship_invite_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.club_relationship_invite_touch() from public;

drop trigger if exists club_relationship_invites_touch on public.club_relationship_invites;
create trigger club_relationship_invites_touch
  before insert or update on public.club_relationship_invites
  for each row execute function public.club_relationship_invite_touch();

-- §30: l'audit di un invito deve puntare a un invito reale. Il vincolo si
-- aggiunge qui e non nella definizione di `club_relationship_audit`, che è
-- dichiarata prima di questa tabella.
alter table public.club_relationship_audit
  drop constraint if exists club_relationship_audit_invite_fkey;

alter table public.club_relationship_audit
  add constraint club_relationship_audit_invite_fkey
  foreign key (invite_id) references public.club_relationship_invites(id)
  on delete set null;

create index if not exists club_relationship_invites_club_idx
  on public.club_relationship_invites (club_id, created_at desc);

create index if not exists club_relationship_invites_open_idx
  on public.club_relationship_invites (club_id, type_id)
  where revoked_at is null and resolved_at is null;

alter table public.club_relationship_invites enable row level security;

-- Il destinatario non legge mai questa tabella: ci arriva solo attraverso le
-- RPC, che gli restituiscono il contesto pubblico minimo (§18).
drop policy if exists "inviter reads own network invites" on public.club_relationship_invites;
create policy "inviter reads own network invites"
  on public.club_relationship_invites for select to authenticated
  using (public.society_network_readable(club_id));

/**
 * Stato leggibile di un invito (§20).
 *
 * «Distinguere invito valido non risolto, risolto, scaduto e revocato.»
 * Una funzione sola, così UI, RPC e audit non derivano tre verità diverse.
 */
create or replace function public.society_invite_state(
  p_revoked_at  timestamptz,
  p_resolved_at timestamptz,
  p_expires_at  timestamptz
)
returns text
language sql
stable
as $$
  /* Nessun `set search_path`: la funzione non è definer, non tocca tabelle e
     usa solo operatori built-in. Fissarlo la renderebbe non inlineabile, e
     questa funzione sta nel WHERE di due elenchi paginati. */
  select case
    when p_revoked_at is not null then 'revoked'
    when p_resolved_at is not null then 'resolved'
    when p_expires_at <= timezone('utc', now()) then 'expired'
    else 'valid'
  end;
$$;

-- Pura derivazione da tre timestamp, senza accesso a tabelle: resta la stessa
-- verità per UI, RPC e audit, ma passa dallo stesso revoke/grant esplicito
-- delle altre funzioni di questo file.
revoke all on function public.society_invite_state(timestamptz, timestamptz, timestamptz) from public;
grant execute on function public.society_invite_state(timestamptz, timestamptz, timestamptz) to authenticated, anon;


-- ============================================================
-- SEZIONE 7 — `club_affiliations` diventa una proiezione (§24, §31)
--
-- «Riusare la relazione canonica anche dove già consumata dal profilo
-- pubblico Società e dalla Search. Non creare un elenco manuale separato di
-- affiliate nella Dashboard.»
--
-- `club_affiliations` è letta oggi da `fetch_society_master_profile`
-- (sezione "Società affiliate") e da `search_clubs_page` (`is_affiliate`,
-- `affiliate_count`). Riscrivere quelle due superfici sarebbe fuori
-- perimetro — §2 esclude «ricostruzione di … Search o profili pubblici». La
-- stessa tecnica di DAS-REV-08 risolve il problema: **una sola fonte
-- scrivibile, la vecchia tabella tenuta a proiezione**. Da qui in avanti le
-- righe con consenso nascono e muoiono da un trigger, non da un client.
--
-- Proietta solo i tipi dichiarati `projects_as_affiliation`. §24 vieta che
-- «una Partnership sia serializzata come Affiliazione solo per riempire una
-- sezione del profilo», e quella sezione si intitola letteralmente "Società
-- affiliate": una partnership o un progetto territoriale non ci appartengono
-- e restano nel solo dominio canonico.
--
-- §31 — righe legacy: non vengono toccate, non vengono promosse e non
-- ricevono un `accepted_at` inventato. `relationship_id is null` le marca
-- come prive di evidenza di consenso; la riconciliazione è una richiesta
-- vera inviata dal nuovo flusso.
-- ============================================================

alter table public.club_relationship_types
  add column if not exists projects_as_affiliation boolean not null default false;

update public.club_relationship_types
   set projects_as_affiliation = true
 where id = 'affiliation';

alter table public.club_affiliations
  add column if not exists relationship_id uuid
    references public.club_relationships(id) on delete cascade;

create unique index if not exists club_affiliations_relationship_idx
  on public.club_affiliations (relationship_id)
  where relationship_id is not null;

/**
 * Mantiene la proiezione allineata al dominio canonico.
 *
 * Una relazione entra quando è `active`, pubblicabile e di un tipo che si
 * proietta; esce appena smette di esserlo — §24: «Dopo terminazione, una
 * relazione non deve continuare a risultare attiva nelle superfici
 * pubbliche o negli indici.»
 */
create or replace function public.club_relationship_project_affiliation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_projects boolean;
  v_label    text;
begin
  select t.projects_as_affiliation, t.label
    into v_projects, v_label
  from public.club_relationship_types t
  where t.id = new.type_id;

  if coalesce(v_projects, false)
     and new.status = 'active'
     and new.is_public
  then
    insert into public.club_affiliations
      (club_id, affiliate_club_id, relationship_label, status, is_public,
       sort_order, relationship_id)
    values
      (new.club_a_id, new.club_b_id, v_label, 'confirmed', true, 0, new.id)
    on conflict (club_id, affiliate_club_id) do update
      set relationship_label = excluded.relationship_label,
          status             = 'confirmed',
          is_public          = true,
          relationship_id    = excluded.relationship_id;
  else
    delete from public.club_affiliations
     where relationship_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function public.club_relationship_project_affiliation() from public;

drop trigger if exists club_relationships_project_affiliation on public.club_relationships;
create trigger club_relationships_project_affiliation
  after insert or update on public.club_relationships
  for each row execute function public.club_relationship_project_affiliation();

/**
 * Nessun secondo sistema di scrittura (§2).
 *
 * L'editor manuale delle affiliate scriveva qui con un delete-all seguito da
 * un insert: su una riga nata da un consenso quella cancellazione sarebbe
 * una terminazione silenziosa, senza audit, senza `ended_at` e senza che
 * l'altra società lo sappia. Il guard la rende impossibile, e un client non
 * può nemmeno fabbricare un `relationship_id`.
 */
create or replace function public.club_affiliations_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- `pg_trigger_depth() = 1` isola esattamente la scrittura **diretta** di un
  -- client: il trigger di proiezione e le cascate referenziali di `clubs` e
  -- `club_relationships` arrivano qui a profondità ≥ 2 e passano.
  --
  -- Una GUC di transazione sembrava più esplicita, ma aveva due difetti: una
  -- volta accesa restava accesa fino al commit (disarmando il guard per il
  -- resto della transazione), e non copriva le cascate — se l'eliminazione di
  -- un club avesse propagato prima su `club_affiliations` e poi su
  -- `club_relationships`, il guard avrebbe fatto fallire il delete.
  --
  -- Due rami espliciti e non un `case tg_op`: in un trigger di riga `OLD` non
  -- esiste su INSERT e `NEW` non esiste su DELETE, e una sola espressione che
  -- li nomina entrambi dipenderebbe dal momento in cui il record viene
  -- espanso. Un `if` non lascia la cosa al caso.
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.relationship_id is not null
       and exists (select 1 from public.club_relationships r where r.id = old.relationship_id)
    then
      raise exception 'AFFILIATION_CONSENT_BACKED';
    end if;
    return old;
  end if;

  -- Un client non può nemmeno **fabbricare** un `relationship_id`: sarebbe
  -- una riga che dichiara un consenso mai avvenuto.
  if new.relationship_id is not null then
    raise exception 'AFFILIATION_CONSENT_BACKED';
  end if;

  if tg_op = 'UPDATE' and old.relationship_id is not null then
    raise exception 'AFFILIATION_CONSENT_BACKED';
  end if;

  return new;
end;
$$;

revoke all on function public.club_affiliations_guard() from public;

drop trigger if exists club_affiliations_guard_trigger on public.club_affiliations;
create trigger club_affiliations_guard_trigger
  before insert or update or delete on public.club_affiliations
  for each row execute function public.club_affiliations_guard();


-- ============================================================
-- SEZIONE 8 — Frasi del dominio (§7, §21)
--
-- «Il renderer riceve metadata sufficienti dal backend; non indovina la
-- semantica da source/target» e «Nessun componente hardcoded distinto per
-- ogni tipo». Le frasi nascono quindi da un template del catalogo e dai due
-- nomi canonici, non da un `if` per tipo nel client.
--
-- `{to_a}` / `{to_b}` producono "a Como" o "ad AC Como": l'elisione italiana
-- davanti a vocale è una regola della lingua, non del dominio, e lasciarla
-- al client significherebbe riscriverla in ogni superficie.
-- ============================================================

create or replace function public.it_prep_a(p_name text)
returns text
language sql
immutable
as $$
  select case
    when p_name is null or length(p_name) = 0 then ''
    when lower(left(p_name, 1)) in ('a', 'e', 'i', 'o', 'u') then 'ad ' || p_name
    else 'a ' || p_name
  end;
$$;

create or replace function public.society_relationship_sentence(
  p_template text,
  p_a        text,
  p_b        text
)
returns text
language sql
immutable
as $$
  select case
    when p_template is null then null
    else replace(
           replace(
             replace(
               replace(p_template, '{to_a}', public.it_prep_a(p_a)),
               '{to_b}', public.it_prep_a(p_b)),
             '{a}', coalesce(p_a, '')),
           '{b}', coalesce(p_b, ''))
  end;
$$;

revoke all on function public.it_prep_a(text) from public;
grant execute on function public.it_prep_a(text) to authenticated, anon;

revoke all on function public.society_relationship_sentence(text, text, text) from public;
grant execute on function public.society_relationship_sentence(text, text, text) to authenticated, anon;


-- ============================================================
-- SEZIONE 9 — Vista della relazione dal punto di vista di una Società
--
-- §7: «Dal lato del club di riferimento, usare Società affiliate. Dal lato
-- dell'affiliata, usare Società di riferimento. La stessa relazione non deve
-- assumere un significato opposto cambiando Dashboard.»
--
-- Una sola funzione produce la prospettiva, così le cinque superfici —
-- elenco, richieste, dettaglio, storico e risoluzione invito — non possono
-- divergere. Non applica permessi: li applica il chiamante, che sa quale
-- capability sta servendo.
-- ============================================================

create or replace function public.society_relationship_view(
  p_relationship_id uuid,
  p_club_id         uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rel  public.club_relationships%rowtype;
  v_type public.club_relationship_types%rowtype;
  v_a    record;
  v_b    record;
  v_is_a boolean;
  v_counterpart jsonb;
  v_row_label text;
begin
  select * into v_rel from public.club_relationships where id = p_relationship_id;
  if not found then
    return null;
  end if;

  if p_club_id is distinct from v_rel.club_a_id
     and p_club_id is distinct from v_rel.club_b_id then
    return null;
  end if;

  select * into v_type from public.club_relationship_types where id = v_rel.type_id;

  select c.id, c.name, c.logo_url, c.city, c.region, c.province,
         coalesce(c.verification_status, 'unverified') = 'verified' as is_verified
    into v_a
  from public.clubs c where c.id = v_rel.club_a_id;

  select c.id, c.name, c.logo_url, c.city, c.region, c.province,
         coalesce(c.verification_status, 'unverified') = 'verified' as is_verified
    into v_b
  from public.clubs c where c.id = v_rel.club_b_id;

  v_is_a := p_club_id = v_rel.club_a_id;

  -- La controparte è l'altro lato, qualunque esso sia. Un `case` fra due
  -- variabili `record` non è assegnabile in plpgsql: si costruisce qui il
  -- jsonb una volta sola e lo si riusa.
  v_counterpart := case
    when v_is_a then
      jsonb_build_object(
        'club_id', v_b.id, 'name', v_b.name, 'logo_url', v_b.logo_url,
        'city', v_b.city, 'region', v_b.region, 'province', v_b.province,
        'is_verified', v_b.is_verified)
    else
      jsonb_build_object(
        'club_id', v_a.id, 'name', v_a.name, 'logo_url', v_a.logo_url,
        'city', v_a.city, 'region', v_a.region, 'province', v_a.province,
        'is_verified', v_a.is_verified)
  end;

  v_row_label := case
    when not v_type.is_directional then v_type.row_template_symmetric
    when v_is_a then v_type.row_template_a
    else v_type.row_template_b
  end;

  return jsonb_build_object(
    'relationship_id',  v_rel.id,
    'status',           v_rel.status,
    'version',          v_rel.version,
    'type_id',          v_type.id,
    'type_label',       v_type.label,
    'type_description', v_type.description,
    'is_directional',   v_type.is_directional,
    'is_public',        v_rel.is_public,
    'viewer_club_id',   p_club_id,
    'viewer_side',      case when v_is_a then 'a' else 'b' end,
    'viewer_role_id',   case when not v_type.is_directional then null
                             when v_is_a then v_type.role_a_id else v_type.role_b_id end,
    'viewer_role_label', case when not v_type.is_directional then null
                              when v_is_a then v_type.role_a_label else v_type.role_b_label end,
    'counterpart_role_id', case when not v_type.is_directional then null
                                when v_is_a then v_type.role_b_id else v_type.role_a_id end,
    'counterpart_role_label', case when not v_type.is_directional then null
                                   when v_is_a then v_type.role_b_label else v_type.role_a_label end,
    'group_label',      case when not v_type.is_directional then v_type.symmetric_section
                             when v_is_a then v_type.role_a_section else v_type.role_b_section end,
    'group_sort',       v_type.sort_order,
    'counterpart',      v_counterpart,
    'club_a',           jsonb_build_object(
                          'club_id', v_a.id, 'name', v_a.name,
                          'logo_url', v_a.logo_url, 'city', v_a.city,
                          'region', v_a.region, 'province', v_a.province,
                          'is_verified', v_a.is_verified
                        ),
    'club_b',           jsonb_build_object(
                          'club_id', v_b.id, 'name', v_b.name,
                          'logo_url', v_b.logo_url, 'city', v_b.city,
                          'region', v_b.region, 'province', v_b.province,
                          'is_verified', v_b.is_verified
                        ),
    'row_label',        public.society_relationship_sentence(v_row_label, v_a.name, v_b.name),
    'draft_sentence',   public.society_relationship_sentence(v_type.draft_template, v_a.name, v_b.name),
    'active_sentence',  public.society_relationship_sentence(v_type.active_template, v_a.name, v_b.name),
    'proposal_sentence', public.society_relationship_sentence(
                           v_type.proposal_template,
                           (select c.name from public.clubs c where c.id = v_rel.requester_club_id),
                           (select c.name from public.clubs c where c.id = v_rel.recipient_club_id)
                         ),
    'requester_club_id', v_rel.requester_club_id,
    'recipient_club_id', v_rel.recipient_club_id,
    'is_requester',      v_rel.requester_club_id = p_club_id,
    'requested_at',      v_rel.requested_at,
    'accepted_at',       v_rel.accepted_at,
    'rejected_at',       v_rel.rejected_at,
    'cancelled_at',      v_rel.cancelled_at,
    'ended_at',          v_rel.ended_at,
    'ended_by_club_id',  v_rel.ended_by_club_id
  );
end;
$$;

revoke all on function public.society_relationship_view(uuid, uuid) from public;
grant execute on function public.society_relationship_view(uuid, uuid) to authenticated;


-- ============================================================
-- SEZIONE 10 — Letture del Centro (§8, §9, §23, §25)
--
-- «Il backend filtra prima della serializzazione. Non inviare dati delle
-- altre società o richieste riservate per nasconderli con il frontend» (§5).
--
-- Ogni conteggio è `null` quando la capability manca — mai zero. §8: «Un
-- valore non consultabile viene omesso», e uno zero inventato direbbe al
-- client una cosa falsa invece di dirgli che non può saperla.
-- ============================================================

create or replace function public.fetch_society_network(p_club_id uuid)
returns table (
  club_id                  uuid,
  club_name                text,
  club_logo_url            text,
  club_city                text,
  club_region              text,
  club_province            text,
  club_is_verified         boolean,
  capabilities             text[],
  active_relationship_count integer,
  distinct_society_count   integer,
  requests_received_count  integer,
  requests_sent_count      integer,
  open_invites_count       integer,
  history_count            integer,
  access_verified_at       timestamptz,
  data_revision            bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caps text[];
begin
  if auth.uid() is null then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  v_caps := public.society_network_capabilities(p_club_id);

  if array_length(v_caps, 1) is null then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  return query
  select
    c.id,
    c.name,
    c.logo_url,
    c.city,
    c.region,
    c.province,
    coalesce(c.verification_status, 'unverified') = 'verified',
    v_caps,
    case when 'network_view' = any (v_caps) then (
      select count(*)::int from public.club_relationships r
      where r.status = 'active' and p_club_id in (r.club_a_id, r.club_b_id)
    ) end,
    -- §8: «collegamenti attivi conta i record attivi; un eventuale riepilogo
    -- Dashboard denominato società collegate conta Society distinte».
    case when 'network_view' = any (v_caps) then (
      select count(distinct case when r.club_a_id = p_club_id then r.club_b_id else r.club_a_id end)::int
      from public.club_relationships r
      where r.status = 'active' and p_club_id in (r.club_a_id, r.club_b_id)
    ) end,
    case when 'network_requests_view' = any (v_caps) then (
      select count(*)::int from public.club_relationships r
      where r.status = 'pending' and r.recipient_club_id = p_club_id
    ) end,
    case when 'network_requests_view' = any (v_caps) then (
      select count(*)::int from public.club_relationships r
      where r.status = 'pending' and r.requester_club_id = p_club_id
    ) end,
    case when 'network_requests_view' = any (v_caps) then (
      -- Gli stessi stati che `fetch_society_network_requests` elenca: un badge
      -- che conta meno righe di quelle visibili è un badge sbagliato.
      select count(*)::int from public.club_relationship_invites i
      where i.club_id = p_club_id
        and i.relationship_id is null
        and public.society_invite_state(i.revoked_at, i.resolved_at, i.expires_at)
            in ('valid', 'expired')
    ) end,
    case when 'network_history_view' = any (v_caps) then (
      select count(*)::int from public.club_relationships r
      where r.status = 'ended' and p_club_id in (r.club_a_id, r.club_b_id)
    ) end,
    timezone('utc', now()),
    -- La revisione copre **entrambe** le sorgenti della pagina. Con le sole
    -- relazioni, creare o revocare un invito non avrebbe cambiato il valore e
    -- una cache che si invalida per revisione avrebbe servito una tab
    -- Richieste vecchia.
    greatest(
      (
        select coalesce(extract(epoch from max(r.updated_at))::bigint, 0)
        from public.club_relationships r
        where p_club_id in (r.club_a_id, r.club_b_id)
      ),
      (
        select coalesce(extract(epoch from max(i.updated_at))::bigint, 0)
        from public.club_relationship_invites i
        where i.club_id = p_club_id
      )
    )
  from public.clubs c
  where c.id = p_club_id;
end;
$$;

revoke all on function public.fetch_society_network(uuid) from public;
grant execute on function public.fetch_society_network(uuid) to authenticated;

/**
 * Elenco dei collegamenti attivi (§8).
 *
 * «Ordinare i gruppi con i metadata della tassonomia e le righe
 * alfabeticamente, con tie-breaker stabile. Non usare follower, prestigio,
 * campionato o attività come ranking.» Il cursore è quindi la stessa chiave
 * dell'ordinamento — gruppo, nome, id — e non un offset, che su una lista
 * che cambia salterebbe o ripeterebbe righe.
 */
create or replace function public.fetch_society_network_page(
  p_club_id uuid,
  p_cursor  text default null,
  p_limit   int default 20
)
returns table (
  relationship_id uuid,
  sort_key        text,
  payload         jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if not public.society_network_allows(p_club_id, 'network_view') then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  return query
  select rows.relationship_id, rows.sort_key, rows.payload
  from (
    select
      r.id as relationship_id,
      lpad(t.sort_order::text, 6, '0')
        || '|' || lower(coalesce(cp.name, ''))
        || '|' || r.id::text as sort_key,
      public.society_relationship_view(r.id, p_club_id) as payload
    from public.club_relationships r
    join public.club_relationship_types t on t.id = r.type_id
    join public.clubs cp
      on cp.id = case when r.club_a_id = p_club_id then r.club_b_id else r.club_a_id end
    where r.status = 'active'
      and p_club_id in (r.club_a_id, r.club_b_id)
  ) rows
  where p_cursor is null or rows.sort_key > p_cursor
  order by rows.sort_key
  limit v_limit;
end;
$$;

revoke all on function public.fetch_society_network_page(uuid, text, int) from public;
grant execute on function public.fetch_society_network_page(uuid, text, int) to authenticated;

/**
 * Richieste ricevute e inviate, più gli inviti esterni non risolti (§9).
 *
 * «Non sommare un invito esterno e la richiesta interna generata da
 * quell'invito come due elementi pendenti»: l'invito compare solo finché
 * `relationship_id is null`, cioè finché non è diventato una richiesta vera.
 */
create or replace function public.fetch_society_network_requests(
  p_club_id uuid,
  p_cursor  text default null,
  p_limit   int default 20
)
returns table (
  item_kind  text,
  item_id    uuid,
  sort_key   text,
  payload    jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if not public.society_network_allows(p_club_id, 'network_requests_view') then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  return query
  select rows.item_kind, rows.item_id, rows.sort_key, rows.payload
  from (
    -- Ricevute: gruppo 1, data richiesta decrescente (§9).
    select
      'received'::text as item_kind,
      r.id as item_id,
      '1|' || lpad((9999999999 - extract(epoch from r.requested_at)::bigint)::text, 12, '0')
            || '|' || r.id::text as sort_key,
      public.society_relationship_view(r.id, p_club_id) as payload
    from public.club_relationships r
    where r.status = 'pending' and r.recipient_club_id = p_club_id

    union all

    -- Inviate: gruppo 2.
    select
      'sent'::text,
      r.id,
      '2|' || lpad((9999999999 - extract(epoch from r.requested_at)::bigint)::text, 12, '0')
            || '|' || r.id::text,
      public.society_relationship_view(r.id, p_club_id)
    from public.club_relationships r
    where r.status = 'pending' and r.requester_club_id = p_club_id

    union all

    -- Inviti esterni non ancora convergiti su una richiesta (§17).
    select
      'invite'::text,
      i.id,
      '2|' || lpad((9999999999 - extract(epoch from i.created_at)::bigint)::text, 12, '0')
            || '|' || i.id::text,
      jsonb_build_object(
        'invite_id',        i.id,
        'type_id',          t.id,
        'type_label',       t.label,
        'is_directional',   t.is_directional,
        'inviter_role_id',  i.inviter_role_id,
        'descriptive_name', i.descriptive_name,
        'state',            public.society_invite_state(i.revoked_at, i.resolved_at, i.expires_at),
        'expires_at',       i.expires_at,
        'created_at',       i.created_at,
        'version',          i.version
      )
    from public.club_relationship_invites i
    join public.club_relationship_types t on t.id = i.type_id
    where i.club_id = p_club_id
      and i.relationship_id is null
      and public.society_invite_state(i.revoked_at, i.resolved_at, i.expires_at) in ('valid', 'expired')
  ) rows
  where p_cursor is null or rows.sort_key > p_cursor
  order by rows.sort_key
  limit v_limit;
end;
$$;

revoke all on function public.fetch_society_network_requests(uuid, text, int) from public;
grant execute on function public.fetch_society_network_requests(uuid, text, int) to authenticated;

/**
 * Storico (§23).
 *
 * «Solo relazioni dirette realmente attivate e successivamente terminate.»
 * Le richieste rifiutate o annullate non sono mai state un collegamento e
 * non entrano: la clausola `status = 'ended'` più il CHECK di §3
 * (`ended` implica `accepted_at is not null`) lo garantiscono insieme.
 */
create or replace function public.fetch_society_network_history_page(
  p_club_id uuid,
  p_cursor  text default null,
  p_limit   int default 20
)
returns table (
  relationship_id uuid,
  sort_key        text,
  payload         jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if not public.society_network_allows(p_club_id, 'network_history_view') then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  return query
  select rows.relationship_id, rows.sort_key, rows.payload
  from (
    select
      r.id as relationship_id,
      lpad((9999999999 - extract(epoch from r.ended_at)::bigint)::text, 12, '0')
        || '|' || r.id::text as sort_key,
      public.society_relationship_view(r.id, p_club_id) as payload
    from public.club_relationships r
    where r.status = 'ended'
      and p_club_id in (r.club_a_id, r.club_b_id)
  ) rows
  where p_cursor is null or rows.sort_key > p_cursor
  order by rows.sort_key
  limit v_limit;
end;
$$;

revoke all on function public.fetch_society_network_history_page(uuid, text, int) from public;
grant execute on function public.fetch_society_network_history_page(uuid, text, int) to authenticated;

/**
 * Dettaglio di una relazione, con le azioni effettivamente consentite (§21).
 *
 * Le azioni le decide il server: §5 chiede di «omettere le azioni non
 * autorizzate» e §26 di «applicare controlli server-side a ogni operazione,
 * anche se il client nasconde il pulsante». Qui l'elenco è la stessa verità
 * che le mutation rivalidano al submit.
 */
create or replace function public.fetch_society_relationship(
  p_relationship_id uuid,
  p_club_id         uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rel     public.club_relationships%rowtype;
  v_payload jsonb;
  v_actions text[] := array[]::text[];
begin
  select * into v_rel from public.club_relationships where id = p_relationship_id;

  if not found or (p_club_id is distinct from v_rel.club_a_id
                   and p_club_id is distinct from v_rel.club_b_id) then
    raise exception 'RELATIONSHIP_NOT_FOUND';
  end if;

  if v_rel.status in ('pending') then
    if not public.society_network_allows(p_club_id, 'network_requests_view') then
      raise exception 'NETWORK_NOT_AUTHORIZED';
    end if;
  elsif v_rel.status = 'ended' then
    if not public.society_network_allows(p_club_id, 'network_history_view') then
      raise exception 'NETWORK_NOT_AUTHORIZED';
    end if;
  elsif v_rel.status = 'active' then
    if not public.society_network_allows(p_club_id, 'network_view') then
      raise exception 'NETWORK_NOT_AUTHORIZED';
    end if;
  else
    if not public.society_network_allows(p_club_id, 'network_requests_view') then
      raise exception 'NETWORK_NOT_AUTHORIZED';
    end if;
  end if;

  v_payload := public.society_relationship_view(p_relationship_id, p_club_id);

  if v_rel.status = 'pending'
     and v_rel.recipient_club_id = p_club_id
     and public.society_network_allows(p_club_id, 'network_request_manage') then
    v_actions := v_actions || array['accept', 'reject'];
  end if;

  if v_rel.status = 'pending'
     and v_rel.requester_club_id = p_club_id
     and public.society_network_allows(p_club_id, 'network_request_cancel') then
    v_actions := v_actions || array['cancel'];
  end if;

  if v_rel.status = 'active'
     and public.society_network_allows(p_club_id, 'network_terminate') then
    v_actions := v_actions || array['end'];
  end if;

  return v_payload || jsonb_build_object(
    'allowed_actions',   to_jsonb(v_actions),
    'access_verified_at', timezone('utc', now())
  );
end;
$$;

revoke all on function public.fetch_society_relationship(uuid, uuid) from public;
grant execute on function public.fetch_society_relationship(uuid, uuid) to authenticated;


-- ============================================================
-- SEZIONE 11 — Catalogo ed eligibility per la ricerca (§10)
--
-- «Riutilizzare Search con un filtro contestuale di entità e visibilità. Non
-- creare un secondo motore.»
--
-- Il motore resta `search_clubs_page` (20260724110000) con `p_kind = 'club'`:
-- quello esclude già Team e persone e applica la visibilità. Qui si aggiunge
-- la sola cosa che gli manca — lo stato del collegamento rispetto alla
-- Società corrente — e lo si fa in **una chiamata per pagina**, non una per
-- riga: §25 vieta l'N+1 e chiede «query aggregate/batch».
--
-- §10: «Non usare una label generica Già collegata per vietare
-- arbitrariamente tutte le relazioni distinte. Il backend deve fornire
-- eligibility coerente con la policy.» Per questo la risposta non è un
-- booleano ma l'elenco dei tipi ancora proponibili.
-- ============================================================

create or replace function public.fetch_society_relationship_types()
returns table (
  id                     text,
  label                  text,
  description            text,
  is_directional         boolean,
  role_a_id              text,
  role_a_label           text,
  role_a_section         text,
  role_b_id              text,
  role_b_label           text,
  role_b_section         text,
  symmetric_section      text,
  draft_template         text,
  active_template        text,
  proposal_template      text,
  row_template_a         text,
  row_template_b         text,
  row_template_symmetric text,
  exclusivity_group      text,
  sort_order             integer,
  is_selectable          boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select t.id, t.label, t.description, t.is_directional,
         t.role_a_id, t.role_a_label, t.role_a_section,
         t.role_b_id, t.role_b_label, t.role_b_section,
         t.symmetric_section,
         t.draft_template, t.active_template, t.proposal_template,
         t.row_template_a, t.row_template_b, t.row_template_symmetric,
         t.exclusivity_group, t.sort_order, t.is_selectable
  from public.club_relationship_types t
  order by t.sort_order, t.id;
$$;

revoke all on function public.fetch_society_relationship_types() from public;
grant execute on function public.fetch_society_relationship_types() to authenticated, anon;

create or replace function public.fetch_society_link_eligibility(
  p_club_id    uuid,
  p_target_ids uuid[]
)
returns table (
  target_club_id     uuid,
  state              text,
  relationship_id    uuid,
  blocking_type_ids  text[],
  available_type_ids text[],
  /*
   * Dati di presentazione della Society, nella stessa forma delle altre
   * superfici della rete. `search_clubs_page` resta il motore — §10 vieta
   * «un secondo motore» — ma non espone provincia né verifica, e leggere
   * metà riga da una fonte e metà dall'altra le farebbe divergere. Qui la
   * riga ha una sola fonte di visualizzazione e una sola di eligibility.
   */
  society            jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.society_network_allows(p_club_id, 'network_request_send')
     and not public.society_network_allows(p_club_id, 'network_view') then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  return query
  with targets as (
    select distinct unnest(coalesce(p_target_ids, array[]::uuid[])) as club_id
  ),
  open_rel as (
    select
      t.club_id as target_club_id,
      r.id,
      r.status,
      r.type_id,
      r.exclusivity_key
    from targets t
    join public.club_relationships r
      on r.status in ('pending', 'active')
     and ((r.club_a_id = p_club_id and r.club_b_id = t.club_id)
       or (r.club_b_id = p_club_id and r.club_a_id = t.club_id))
  )
  select
    t.club_id,
    case
      when t.club_id = p_club_id then 'self'
      when exists (select 1 from open_rel o where o.target_club_id = t.club_id and o.status = 'active')
        then 'linked'
      when exists (select 1 from open_rel o where o.target_club_id = t.club_id and o.status = 'pending')
        then 'pending'
      else 'eligible'
    end,
    (
      select o.id from open_rel o
      where o.target_club_id = t.club_id
      order by case o.status when 'active' then 0 else 1 end
      limit 1
    ),
    coalesce(
      (select array_agg(distinct o.type_id) from open_rel o where o.target_club_id = t.club_id),
      array[]::text[]
    ),
    case
      when t.club_id = p_club_id then array[]::text[]
      else coalesce(
        (
          select array_agg(ty.id order by ty.sort_order)
          from public.club_relationship_types ty
          where ty.is_selectable
            and not exists (
              select 1 from open_rel o
              where o.target_club_id = t.club_id
                and o.exclusivity_key = coalesce(ty.exclusivity_group, 'type:' || ty.id)
            )
        ),
        array[]::text[]
      )
    end,
    (
      select jsonb_build_object(
               'club_id',     c.id,
               'name',        c.name,
               'logo_url',    c.logo_url,
               'city',        c.city,
               'region',      c.region,
               'province',    c.province,
               'is_verified', coalesce(c.verification_status, 'unverified') = 'verified'
             )
      from public.clubs c
      where c.id = t.club_id
    )
  from targets t;
end;
$$;

revoke all on function public.fetch_society_link_eligibility(uuid, uuid[]) from public;
grant execute on function public.fetch_society_link_eligibility(uuid, uuid[]) to authenticated;


-- ============================================================
-- SEZIONE 12 — Invio della richiesta (§11, §12)
--
-- «Il server deriva/verifica la Society richiedente dal contesto autorizzato
-- e valida destinatario reale, tipo, ruoli, scope, visibilità e regole
-- globali applicabili … Non fidarsi di society_id, count o label inviati dal
-- client.»
--
-- Il lock advisory sulla coppia chiude la finestra fra il controllo e
-- l'insert: §12 dice esplicitamente che «una verifica GET prima del submit
-- non è sufficiente». L'indice unico parziale della §3 è la seconda rete,
-- quella che regge anche se due transazioni entrano da nodi diversi.
-- ============================================================

create or replace function public.create_society_relationship_request(
  p_club_id         uuid,
  p_target_club_id  uuid,
  p_type_id         text,
  p_role_id         text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_type        public.club_relationship_types%rowtype;
  v_a           uuid;
  v_b           uuid;
  v_pair        text;
  v_excl        text;
  v_fingerprint text;
  v_replay      jsonb;
  v_id          uuid;
  v_existing    public.club_relationships%rowtype;
begin
  if auth.uid() is null then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  if not public.society_network_allows(p_club_id, 'network_request_send') then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  if p_target_club_id is null or p_target_club_id = p_club_id then
    raise exception 'RELATIONSHIP_SELF_LINK';
  end if;

  -- §12: «destinatario reale». Una Society che non esiste, o un uuid di
  -- Team passato al posto di un club, si ferma qui.
  if not exists (select 1 from public.clubs c where c.id = p_target_club_id) then
    raise exception 'RELATIONSHIP_TARGET_INVALID';
  end if;

  select * into v_type
  from public.club_relationship_types
  where id = p_type_id;

  if not found or not v_type.is_selectable then
    raise exception 'RELATIONSHIP_TYPE_INVALID';
  end if;

  if v_type.is_directional then
    if p_role_id is null or p_role_id not in (v_type.role_a_id, v_type.role_b_id) then
      raise exception 'RELATIONSHIP_ROLE_REQUIRED';
    end if;

    -- §7: il ruolo scelto decide i lati canonici, non chi ha premuto invia.
    if p_role_id = v_type.role_a_id then
      v_a := p_club_id;
      v_b := p_target_club_id;
    else
      v_a := p_target_club_id;
      v_b := p_club_id;
    end if;
  else
    -- §12: «per un tipo simmetrico normalizzare la coppia».
    if p_role_id is not null then
      raise exception 'RELATIONSHIP_ROLE_NOT_APPLICABLE';
    end if;

    v_a := least(p_club_id, p_target_club_id);
    v_b := greatest(p_club_id, p_target_club_id);
  end if;

  v_pair := least(v_a, v_b)::text || '|' || greatest(v_a, v_b)::text;
  v_excl := coalesce(v_type.exclusivity_group, 'type:' || v_type.id);
  v_fingerprint := v_pair || '|' || v_type.id || '|' || coalesce(p_role_id, '');

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, p_club_id, 'request_created', v_fingerprint);

  if v_replay is not null then
    return v_replay;
  end if;

  -- Anti-abuso condiviso (§26). Stessa infrastruttura degli inviti
  -- procuratore→assistito: non un secondo sistema di rate limit.
  perform public.assert_agent_rate_limit(
    'society_link_request', p_club_id::text, 30, interval '24 hours');

  perform pg_advisory_xact_lock(hashtext(v_pair || '|' || v_excl));

  select * into v_existing
  from public.club_relationships
  where pair_key = v_pair
    and exclusivity_key = v_excl
    and status in ('pending', 'active')
  limit 1;

  if found then
    if v_existing.status = 'active' then
      raise exception 'RELATIONSHIP_ALREADY_ACTIVE';
    end if;
    -- §12: «Non auto-accettare una richiesta inversa per il solo tentativo
    -- di crearne un'altra. Riaprire la richiesta esistente nel ruolo
    -- corretto.» Il client riapre il dettaglio con questo id.
    raise exception 'REQUEST_ALREADY_PENDING:%', v_existing.id;
  end if;

  insert into public.club_relationships
    (type_id, club_a_id, club_b_id, requester_club_id, recipient_club_id,
     status, requested_by)
  values
    (v_type.id, v_a, v_b, p_club_id, p_target_club_id, 'pending', auth.uid())
  returning id into v_id;

  insert into public.club_relationship_audit
    (relationship_id, club_id, counterpart_club_id, operation,
     previous_status, next_status, actor_id, actor_club_id, correlation_id, details)
  values
    (v_id, p_club_id, p_target_club_id, 'request_created',
     null, 'pending', auth.uid(), p_club_id, p_idempotency_key,
     jsonb_build_object('type_id', v_type.id, 'role_id', p_role_id));

  v_replay := public.society_relationship_view(v_id, p_club_id);

  perform public.club_relationship_operation_record(
    p_idempotency_key, p_club_id, 'request_created', v_fingerprint, v_replay);

  return v_replay;
end;
$$;

revoke all on function public.create_society_relationship_request(uuid, uuid, text, text, text) from public;
grant execute on function public.create_society_relationship_request(uuid, uuid, text, text, text) to authenticated;


-- ============================================================
-- SEZIONE 13 — Decisioni sul consenso (§14, §15, §22)
--
-- «Le decisioni sono atomiche e idempotenti. Se due amministratori accettano,
-- accettano/rifiutano o annullano contemporaneamente, una sola transizione
-- vince. La risposta successiva restituisce lo stato aggiornato; non riesegue
-- effetti collaterali.»
--
-- Il `select … for update` sulla riga è la sezione critica: chi arriva
-- secondo trova lo stato già cambiato e **non** rilancia un errore tecnico,
-- restituisce lo stato reale. Un errore si solleva solo quando l'actor sta
-- chiedendo una transizione che non gli compete.
--
-- `p_version` è il consenso informato di §14: «Se la proposta visualizzata è
-- cambiata rispetto alla versione confermata, richiedere una nuova review.
-- Non accettare termini diversi da quelli letti dall'utente.»
-- ============================================================

create or replace function public.decide_society_relationship(
  p_relationship_id uuid,
  p_club_id         uuid,
  p_decision        text,
  p_version         integer default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_rel         public.club_relationships%rowtype;
  v_fingerprint text;
  v_replay      jsonb;
  v_capability  text;
  v_next        text;
  v_operation   text;
  v_counterpart uuid;
begin
  if auth.uid() is null then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  if p_decision not in ('accept', 'reject', 'cancel', 'end') then
    raise exception 'RELATIONSHIP_DECISION_INVALID';
  end if;

  v_capability := case p_decision
    when 'accept' then 'network_request_manage'
    when 'reject' then 'network_request_manage'
    when 'cancel' then 'network_request_cancel'
    when 'end'    then 'network_terminate'
  end;

  -- §5: «Rivalidare i permessi al submit, anche se il pulsante era
  -- disponibile all'apertura.»
  if not public.society_network_allows(p_club_id, v_capability) then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  v_fingerprint := p_relationship_id::text || '|' || p_decision
                   || '|' || coalesce(p_version::text, '');

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, p_club_id, 'decision', v_fingerprint);

  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_rel
  from public.club_relationships
  where id = p_relationship_id
  for update;

  if not found then
    raise exception 'RELATIONSHIP_NOT_FOUND';
  end if;

  if p_club_id is distinct from v_rel.club_a_id
     and p_club_id is distinct from v_rel.club_b_id then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  v_counterpart := case when v_rel.club_a_id = p_club_id
                        then v_rel.club_b_id else v_rel.club_a_id end;

  -- §15: «Non permettere al destinatario di usare l'annullamento al posto
  -- del rifiuto, né al mittente di annullare una relazione già accettata.»
  if p_decision in ('accept', 'reject') and v_rel.recipient_club_id <> p_club_id then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  if p_decision = 'cancel' and v_rel.requester_club_id <> p_club_id then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  v_next := case p_decision
    when 'accept' then 'active'
    when 'reject' then 'rejected'
    when 'cancel' then 'cancelled'
    when 'end'    then 'ended'
  end;

  -- La transizione è già avvenuta: restituire lo stato, non un errore e non
  -- un secondo effetto collaterale (§14).
  if v_rel.status = v_next then
    return public.society_relationship_view(p_relationship_id, p_club_id)
           || jsonb_build_object('already_applied', true);
  end if;

  if p_decision in ('accept', 'reject', 'cancel') and v_rel.status <> 'pending' then
    raise exception 'REQUEST_ALREADY_HANDLED';
  end if;

  if p_decision = 'end' and v_rel.status <> 'active' then
    raise exception 'RELATIONSHIP_NOT_ACTIVE';
  end if;

  if p_version is not null and p_version <> v_rel.version then
    raise exception 'PROPOSAL_CHANGED';
  end if;

  v_operation := case p_decision
    when 'accept' then 'request_accepted'
    when 'reject' then 'request_rejected'
    when 'cancel' then 'request_cancelled'
    when 'end'    then 'relationship_ended'
  end;

  update public.club_relationships
     set status      = v_next,
         version     = version + 1,
         accepted_at = case when p_decision = 'accept' then timezone('utc', now()) else accepted_at end,
         accepted_by = case when p_decision = 'accept' then auth.uid() else accepted_by end,
         rejected_at = case when p_decision = 'reject' then timezone('utc', now()) else rejected_at end,
         rejected_by = case when p_decision = 'reject' then auth.uid() else rejected_by end,
         cancelled_at = case when p_decision = 'cancel' then timezone('utc', now()) else cancelled_at end,
         cancelled_by = case when p_decision = 'cancel' then auth.uid() else cancelled_by end,
         ended_at    = case when p_decision = 'end' then timezone('utc', now()) else ended_at end,
         ended_by    = case when p_decision = 'end' then auth.uid() else ended_by end,
         ended_by_club_id = case when p_decision = 'end' then p_club_id else ended_by_club_id end
   where id = p_relationship_id;

  insert into public.club_relationship_audit
    (relationship_id, club_id, counterpart_club_id, operation,
     previous_status, next_status, actor_id, actor_club_id, correlation_id, details)
  values
    (p_relationship_id, p_club_id, v_counterpart, v_operation,
     v_rel.status, v_next, auth.uid(), p_club_id, p_idempotency_key,
     jsonb_build_object('type_id', v_rel.type_id));

  v_replay := public.society_relationship_view(p_relationship_id, p_club_id);

  perform public.club_relationship_operation_record(
    p_idempotency_key, p_club_id, 'decision', v_fingerprint, v_replay);

  return v_replay;
end;
$$;

revoke all on function public.decide_society_relationship(uuid, uuid, text, integer, text) from public;
grant execute on function public.decide_society_relationship(uuid, uuid, text, integer, text) to authenticated;


-- ============================================================
-- SEZIONE 14 — Inviti esterni (§16, §17, §20)
--
-- «Al tap, il backend verifica actor, Society mittente, capability,
-- tipo/direzione e crea o riutilizza un invito valido. Solo dopo aver
-- ottenuto il link reale aprire lo share sheet nativo.»
--
-- Il token in chiaro esce **una volta**: alla creazione e a ogni rigenerazione
-- esplicita. Ri-condividere nella stessa sessione riusa quello in memoria e
-- non passa di qui; ri-condividere dopo un riavvio ruota il token **sulla
-- stessa riga** (§17: «Non creare un nuovo token/record a ogni apertura
-- dello share» — il record resta, e con lui l'audit e il riferimento alla
-- richiesta eventualmente già risolta).
-- ============================================================

create or replace function public.issue_society_relationship_invite(
  p_club_id         uuid,
  p_type_id         text,
  p_role_id         text default null,
  p_name            text default null,
  p_rotate          boolean default false,
  p_idempotency_key text default null
)
returns table (
  invite_id         uuid,
  invite_token      text,
  invite_state      text,
  invite_expires_at timestamptz,
  invite_version    integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_type        public.club_relationship_types%rowtype;
  v_name        text;
  v_row         public.club_relationship_invites%rowtype;
  v_token       text;
  v_hash        text;
  v_ttl         interval;
  v_fingerprint text;
  v_replay      jsonb;
begin
  if auth.uid() is null then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  if not public.society_network_allows(p_club_id, 'network_invite_create') then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  select * into v_type from public.club_relationship_types where id = p_type_id;

  if not found or not v_type.is_selectable then
    raise exception 'RELATIONSHIP_TYPE_INVALID';
  end if;

  if v_type.is_directional then
    if p_role_id is null or p_role_id not in (v_type.role_a_id, v_type.role_b_id) then
      raise exception 'RELATIONSHIP_ROLE_REQUIRED';
    end if;
  elsif p_role_id is not null then
    raise exception 'RELATIONSHIP_ROLE_NOT_APPLICABLE';
  end if;

  -- §26: sanitizzazione del nome descrittivo. Non è un'identità e non deve
  -- poter trasportare markup o un URL verso la landing.
  v_name := nullif(btrim(regexp_replace(coalesce(p_name, ''), '[<>\r\n\t]', ' ', 'g')), '');

  if v_name is not null and length(v_name) > 120 then
    v_name := left(v_name, 120);
  end if;

  /*
   * §26, §17 — una rotazione non è idempotente da sola.
   *
   * Un retry dopo un timeout rigenererebbe il token e invaliderebbe il link
   * appena condiviso, che è esattamente ciò che §17 vieta. La chiave
   * riconosce il tentativo e restituisce lo stesso token; il fingerprint
   * riconosce il contenuto, così cambiare tipo, ruolo o nome è una nuova
   * operazione e non un replay.
   *
   * Il token in chiaro finisce quindi anche nel risultato memorizzato: la
   * tabella `club_relationship_operations` è interna alle funzioni definer e
   * non ha policy, quindi non è leggibile da nessun client.
   */
  v_fingerprint := p_type_id || '|' || coalesce(p_role_id, '')
                   || '|' || coalesce(v_name, '') || '|' || coalesce(p_rotate, false)::text;

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, p_club_id, 'invite_issued', v_fingerprint);

  if v_replay is not null then
    return query
    select (v_replay ->> 'invite_id')::uuid,
           v_replay ->> 'invite_token',
           v_replay ->> 'invite_state',
           (v_replay ->> 'invite_expires_at')::timestamptz,
           (v_replay ->> 'invite_version')::integer;
    return;
  end if;

  perform public.assert_agent_rate_limit(
    'society_invite_issue', p_club_id::text, 20, interval '1 hour');

  select * into v_row
  from public.club_relationship_invites i
  where i.club_id = p_club_id
    and i.type_id = p_type_id
    and i.inviter_role_id is not distinct from p_role_id
    and i.descriptive_name is not distinct from v_name
    and i.relationship_id is null
    and public.society_invite_state(i.revoked_at, i.resolved_at, i.expires_at) = 'valid'
  order by i.created_at desc
  limit 1
  for update;

  if found and not p_rotate then
    -- Invito valido già esistente: si riusa quello e non si tocca il token,
    -- che resta quello già condiviso (§17).
    v_replay := jsonb_build_object(
      'invite_id',         v_row.id,
      'invite_token',      null,
      'invite_state',      public.society_invite_state(v_row.revoked_at, v_row.resolved_at, v_row.expires_at),
      'invite_expires_at', v_row.expires_at,
      'invite_version',    v_row.version
    );

    perform public.club_relationship_operation_record(
      p_idempotency_key, p_club_id, 'invite_issued', v_fingerprint, v_replay);

    return query
    select v_row.id, null::text,
           public.society_invite_state(v_row.revoked_at, v_row.resolved_at, v_row.expires_at),
           v_row.expires_at, v_row.version;
    return;
  end if;

  v_ttl := public.society_invite_ttl();
  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  if found then
    update public.club_relationship_invites
       set token_hash = v_hash,
           expires_at = timezone('utc', now()) + v_ttl,
           version    = club_relationship_invites.version + 1
     where club_relationship_invites.id = v_row.id
    returning * into v_row;

    insert into public.club_relationship_audit
      (invite_id, club_id, operation, actor_id, actor_club_id, correlation_id, details)
    values
      (v_row.id, p_club_id, 'invite_regenerated', auth.uid(), p_club_id,
       p_idempotency_key, jsonb_build_object('type_id', p_type_id));
  else
    insert into public.club_relationship_invites
      (club_id, type_id, inviter_role_id, descriptive_name, token_hash,
       created_by, expires_at)
    values
      (p_club_id, p_type_id, p_role_id, v_name, v_hash,
       auth.uid(), timezone('utc', now()) + v_ttl)
    returning * into v_row;

    insert into public.club_relationship_audit
      (invite_id, club_id, operation, actor_id, actor_club_id, correlation_id, details)
    values
      (v_row.id, p_club_id, 'invite_created', auth.uid(), p_club_id,
       p_idempotency_key, jsonb_build_object('type_id', p_type_id));
  end if;

  v_replay := jsonb_build_object(
    'invite_id',         v_row.id,
    'invite_token',      v_token,
    'invite_state',      public.society_invite_state(v_row.revoked_at, v_row.resolved_at, v_row.expires_at),
    'invite_expires_at', v_row.expires_at,
    'invite_version',    v_row.version
  );

  perform public.club_relationship_operation_record(
    p_idempotency_key, p_club_id, 'invite_issued', v_fingerprint, v_replay);

  return query
  select v_row.id, v_token,
         public.society_invite_state(v_row.revoked_at, v_row.resolved_at, v_row.expires_at),
         v_row.expires_at, v_row.version;
end;
$$;

revoke all on function public.issue_society_relationship_invite(uuid, text, text, text, boolean, text) from public;
grant execute on function public.issue_society_relationship_invite(uuid, text, text, text, boolean, text) to authenticated;

/**
 * Revoca (§20).
 *
 * «Ri-condivisione di un link revocato non lo rende valido.» Il token_hash
 * viene sostituito con un valore che nessun sha256 può produrre, come negli
 * inviti procuratore→assistito: anche un hash intercettato smette di
 * risolvere.
 */
create or replace function public.revoke_society_relationship_invite(
  p_invite_id       uuid,
  p_idempotency_key text default null
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.club_relationship_invites%rowtype;
begin
  select * into v_row
  from public.club_relationship_invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'INVITE_INVALID';
  end if;

  if not public.society_network_allows(v_row.club_id, 'network_invite_create') then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  if v_row.resolved_at is not null then
    -- §20: «Se l'invito è già risolto in una richiesta pending, mostrare la
    -- richiesta reale e le sue azioni.» Revocare l'URL non annulla nulla.
    raise exception 'INVITE_ALREADY_RESOLVED';
  end if;

  if v_row.revoked_at is not null then
    return 'revoked';
  end if;

  update public.club_relationship_invites
     set revoked_at = timezone('utc', now()),
         revoked_by = auth.uid(),
         token_hash = 'revoked:' || p_invite_id::text,
         version    = version + 1
   where id = p_invite_id;

  insert into public.club_relationship_audit
    (invite_id, club_id, operation, actor_id, actor_club_id, correlation_id)
  values
    (p_invite_id, v_row.club_id, 'invite_revoked', auth.uid(), v_row.club_id,
     p_idempotency_key);

  return 'revoked';
end;
$$;

revoke all on function public.revoke_society_relationship_invite(uuid, text) from public;
grant execute on function public.revoke_society_relationship_invite(uuid, text) to authenticated;


-- ============================================================
-- SEZIONE 15 — Landing pubblica (§18)
--
-- «Il server recupera dall'invito valido solo il contesto pubblico minimo.»
--
-- È l'unica funzione di questa migrazione eseguibile da `anon`, e lo è per
-- una ragione precisa: §18 chiede una pagina **pre-auth** che mostri chi
-- invita. Richiedere l'autenticazione — come fa `resolve_agent_assistito_invite`
-- — renderebbe la schermata impossibile.
--
-- Il rischio di enumerazione resta chiuso dal token: 256 bit opachi, mai
-- derivabili da un id. La risposta non contiene amministratori, richieste,
-- contatti, il `relationship_id` né l'`invite_id`: niente che permetta di
-- agire, solo ciò che la landing disegna. Un token non valido restituisce lo
-- stato e nient'altro (§20: «Non esporre dati riservati di un token
-- invalido»).
-- ============================================================

create or replace function public.fetch_society_invite_public(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_row   public.club_relationship_invites%rowtype;
  v_type  public.club_relationship_types%rowtype;
  v_club  record;
  v_state text;
begin
  if p_token is null or length(p_token) < 32 then
    return jsonb_build_object('state', 'invalid');
  end if;

  select * into v_row
  from public.club_relationship_invites
  where token_hash = encode(digest(p_token, 'sha256'), 'hex');

  if not found then
    return jsonb_build_object('state', 'invalid');
  end if;

  v_state := public.society_invite_state(v_row.revoked_at, v_row.resolved_at, v_row.expires_at);

  if v_state in ('revoked', 'expired') then
    return jsonb_build_object('state', v_state);
  end if;

  select c.id, c.name, c.logo_url, c.city, c.region, c.province,
         coalesce(c.verification_status, 'unverified') = 'verified' as is_verified
    into v_club
  from public.clubs c
  where c.id = v_row.club_id;

  select * into v_type from public.club_relationship_types where id = v_row.type_id;

  return jsonb_build_object(
    'state',      v_state,
    'type_id',    v_type.id,
    'type_label', v_type.label,
    'inviter',    jsonb_build_object(
                    'name',        v_club.name,
                    'logo_url',    v_club.logo_url,
                    'city',        v_club.city,
                    'region',      v_club.region,
                    'province',    v_club.province,
                    'is_verified', v_club.is_verified
                  )
  );
end;
$$;

revoke all on function public.fetch_society_invite_public(text) from public;
grant execute on function public.fetch_society_invite_public(text) to authenticated, anon;


-- ============================================================
-- SEZIONE 16 — Handoff autenticato e risoluzione (§19)
--
-- «Possibili casi: una Society eleggibile … più Society eleggibili:
-- richiedere una scelta esplicita, senza usare la prima della lista; nessuna
-- Society gestibile …; Society presente ma capability insufficienti.»
--
-- Il contesto lo ricostruisce il server dal token a ogni passo: §19 vieta di
-- «affidarsi soltanto a variabili in memoria o local storage» e chiede di
-- «risolvere nuovamente token, invito e autorizzazioni» dopo
-- l'autenticazione.
-- ============================================================

create or replace function public.fetch_society_invite_context(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_row       public.club_relationship_invites%rowtype;
  v_type      public.club_relationship_types%rowtype;
  v_state     text;
  v_club      record;
  v_societies jsonb;
begin
  if auth.uid() is null then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  if p_token is null or length(p_token) < 32 then
    return jsonb_build_object('state', 'invalid');
  end if;

  select * into v_row
  from public.club_relationship_invites
  where token_hash = encode(digest(p_token, 'sha256'), 'hex');

  if not found then
    return jsonb_build_object('state', 'invalid');
  end if;

  v_state := public.society_invite_state(v_row.revoked_at, v_row.resolved_at, v_row.expires_at);

  -- §19: «Un token già risolto non può essere associato nuovamente a un'altra
  -- Society. Chi è autorizzato al target reale può raggiungere lo stato
  -- corrente; gli altri vedono un messaggio di indisponibilità.»
  if v_state = 'resolved' then
    if v_row.resolved_club_id is not null
       and public.society_network_allows(v_row.resolved_club_id, 'network_requests_view') then
      return jsonb_build_object(
        'state',           'resolved',
        'club_id',         v_row.resolved_club_id,
        'relationship_id', v_row.relationship_id
      );
    end if;

    return jsonb_build_object('state', 'unavailable');
  end if;

  if v_state in ('revoked', 'expired') then
    return jsonb_build_object('state', v_state);
  end if;

  select c.id, c.name, c.logo_url, c.city, c.region, c.province,
         coalesce(c.verification_status, 'unverified') = 'verified' as is_verified
    into v_club
  from public.clubs c where c.id = v_row.club_id;

  select * into v_type from public.club_relationship_types where id = v_row.type_id;

  -- Società che questo actor può davvero impegnare. Il link non rende owner
  -- e non assegna amministratori: l'elenco nasce dalle capability reali.
  select coalesce(jsonb_agg(entry order by entry ->> 'name'), '[]'::jsonb)
    into v_societies
  from (
    select jsonb_build_object(
             'club_id',     c.id,
             'name',        c.name,
             'logo_url',    c.logo_url,
             'city',        c.city,
             'region',      c.region,
             'province',    c.province,
             'is_verified', coalesce(c.verification_status, 'unverified') = 'verified',
             'is_self',     c.id = v_row.club_id,
             'blocked',     exists (
                              select 1 from public.club_relationships r
                              where r.status in ('pending', 'active')
                                and r.exclusivity_key = coalesce(v_type.exclusivity_group, 'type:' || v_type.id)
                                and ((r.club_a_id = c.id and r.club_b_id = v_row.club_id)
                                  or (r.club_b_id = c.id and r.club_a_id = v_row.club_id))
                            )
           ) as entry
    from public.clubs c
    -- Il perimetro parte dalle sole Società in cui l'actor è proprietario o
    -- membro attivo: valutare la capability su tutta la tabella `clubs`
    -- sarebbe una scansione completa a ogni apertura del link (§25).
    where (
      c.owner_profile_id = auth.uid()
      or exists (
        select 1 from public.club_members cm
        where cm.club_id = c.id and cm.profile_id = auth.uid() and cm.status = 'active'
      )
    )
      and public.society_network_allows(c.id, 'network_request_manage')
  ) eligible;

  return jsonb_build_object(
    'state',      'valid',
    'type_id',    v_type.id,
    'type_label', v_type.label,
    'is_directional', v_type.is_directional,
    'inviter',    jsonb_build_object(
                    'club_id',     v_club.id,
                    'name',        v_club.name,
                    'logo_url',    v_club.logo_url,
                    'city',        v_club.city,
                    'region',      v_club.region,
                    'province',    v_club.province,
                    'is_verified', v_club.is_verified
                  ),
    'descriptive_name', v_row.descriptive_name,
    'eligible_societies', v_societies
  );
end;
$$;

revoke all on function public.fetch_society_invite_context(text) from public;
grant execute on function public.fetch_society_invite_context(text) to authenticated;

/**
 * Associa l'invito a una Society reale e crea la richiesta canonica (§19).
 *
 * «L'associazione deve essere atomica e mantenere una sola destinazione per
 * quell'invito. Due aperture concorrenti non devono vincolare lo stesso
 * token a due Society diverse.»
 *
 * Risolvere **non** attiva nulla: la riga nasce `pending` e il consenso
 * resta l'Accetta dello screen 05. «La sola scelta della Society non vale
 * come consenso.»
 */
create or replace function public.resolve_society_relationship_invite(
  p_token           text,
  p_club_id         uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row      public.club_relationship_invites%rowtype;
  v_type     public.club_relationship_types%rowtype;
  v_state    text;
  v_a        uuid;
  v_b        uuid;
  v_pair     text;
  v_excl     text;
  v_existing public.club_relationships%rowtype;
  v_id       uuid;
begin
  if auth.uid() is null then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  if not public.society_network_allows(p_club_id, 'network_request_manage') then
    raise exception 'NETWORK_NOT_AUTHORIZED';
  end if;

  perform public.assert_agent_rate_limit(
    'society_invite_resolve', p_club_id::text, 20, interval '1 hour');

  select * into v_row
  from public.club_relationship_invites
  where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'INVITE_INVALID';
  end if;

  v_state := public.society_invite_state(v_row.revoked_at, v_row.resolved_at, v_row.expires_at);

  if v_state = 'resolved' then
    -- Una seconda apertura concorrente trova il token già vincolato.
    if v_row.resolved_club_id = p_club_id and v_row.relationship_id is not null then
      return public.society_relationship_view(v_row.relationship_id, p_club_id);
    end if;
    raise exception 'INVITE_ALREADY_RESOLVED';
  end if;

  if v_state = 'revoked' then
    raise exception 'INVITE_REVOKED';
  end if;

  if v_state = 'expired' then
    raise exception 'INVITE_EXPIRED';
  end if;

  if p_club_id = v_row.club_id then
    raise exception 'RELATIONSHIP_SELF_LINK';
  end if;

  select * into v_type from public.club_relationship_types where id = v_row.type_id;

  if not found then
    raise exception 'RELATIONSHIP_TYPE_INVALID';
  end if;

  -- §7: un tipo dismesso resta leggibile sui record storici, ma non può
  -- generare una richiesta nuova. `create_society_relationship_request` e
  -- `issue_…_invite` lo verificano già; senza questo controllo un invito
  -- emesso prima della dismissione la aggirerebbe.
  if not v_type.is_selectable then
    raise exception 'RELATIONSHIP_TYPE_INVALID';
  end if;

  if v_type.is_directional then
    if v_row.inviter_role_id = v_type.role_a_id then
      v_a := v_row.club_id;
      v_b := p_club_id;
    else
      v_a := p_club_id;
      v_b := v_row.club_id;
    end if;
  else
    v_a := least(v_row.club_id, p_club_id);
    v_b := greatest(v_row.club_id, p_club_id);
  end if;

  v_pair := least(v_a, v_b)::text || '|' || greatest(v_a, v_b)::text;
  v_excl := coalesce(v_type.exclusivity_group, 'type:' || v_type.id);

  perform pg_advisory_xact_lock(hashtext(v_pair || '|' || v_excl));

  -- §19: «Se esiste una richiesta equivalente, convergere su quella secondo
  -- il dominio; non creare un secondo pending.»
  select * into v_existing
  from public.club_relationships
  where pair_key = v_pair
    and exclusivity_key = v_excl
    and status in ('pending', 'active')
  limit 1;

  if found then
    /*
     * «Equivalente» significa stesso tipo, non stesso gruppo di esclusività.
     * `affiliation` e `academy_project` condividono il gruppo `structural`:
     * convergere sul solo gruppo avrebbe legato chi apre un invito di
     * Affiliazione a una richiesta di progetto territoriale, cioè a termini
     * diversi da quelli letti — che §14 vieta.
     *
     * Il collegamento esiste comunque ed è incompatibile: si restituisce un
     * codice proprio, non un secondo pending.
     */
    if v_existing.type_id is distinct from v_type.id then
      raise exception 'RELATIONSHIP_EXCLUSIVITY_CONFLICT';
    end if;

    v_id := v_existing.id;
  else
    insert into public.club_relationships
      (type_id, club_a_id, club_b_id, requester_club_id, recipient_club_id,
       status, requested_by, requested_at)
    values
      (v_type.id, v_a, v_b, v_row.club_id, p_club_id, 'pending',
       v_row.created_by, v_row.created_at)
    returning id into v_id;
  end if;

  update public.club_relationship_invites
     set resolved_at      = timezone('utc', now()),
         resolved_club_id = p_club_id,
         resolved_by      = auth.uid(),
         relationship_id  = v_id,
         version          = version + 1
   where id = v_row.id;

  insert into public.club_relationship_audit
    (relationship_id, invite_id, club_id, counterpart_club_id, operation,
     previous_status, next_status, actor_id, actor_club_id, correlation_id, details)
  values
    (v_id, v_row.id, p_club_id, v_row.club_id, 'invite_resolved',
     -- §30 chiede lo stato **reale** prima e dopo. Convergendo su una
     -- relazione già attiva, "pending → pending" sarebbe una riga falsa.
     v_existing.status,
     coalesce(v_existing.status, 'pending'),
     auth.uid(), p_club_id, p_idempotency_key,
     jsonb_build_object('type_id', v_type.id, 'converged', v_existing.id is not null));

  return public.society_relationship_view(v_id, p_club_id);
end;
$$;

revoke all on function public.resolve_society_relationship_invite(text, uuid, text) from public;
grant execute on function public.resolve_society_relationship_invite(text, uuid, text) to authenticated;


-- ============================================================
-- SEZIONE 17 — La riga "Società collegate" della Dashboard (§4)
--
-- «Società collegate è la voce di ingresso; Rete societaria è la pagina
-- raggiunta, non un ulteriore passaggio dopo un altro centro.»
--
-- Oggi quella riga è gated su `isOwner`, perché `/club-admin/affiliates` è
-- protetta dal ruolo e non da una capability. Con il nuovo dominio la riga ha
-- una chiave propria, quindi entra in `dashboard_club_capabilities` come
-- hanno fatto Squadre e Stagioni prima di lei.
--
-- Il filtro `perm.team_id is null` compare solo per le chiavi di rete: §5
-- chiede che «un amministratore limitato a un Team non le ottenga
-- automaticamente», mentre per le chiavi di squadra lo scope di Team è
-- esattamente il punto.
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
      'teams_lifecycle',
      'network_view',
      'network_requests_view',
      'network_request_send',
      'network_request_manage',
      'network_request_cancel',
      'network_invite_create',
      'network_terminate',
      'network_history_view'
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
            'teams_lifecycle',
            'network_view',
            'network_requests_view',
            'network_request_send',
            'network_request_manage',
            'network_request_cancel',
            'network_invite_create',
            'network_terminate',
            'network_history_view'
          )
          and (
            perm.team_id is null
            or perm.permission_key not like 'network\_%'
          )
      ),
      array[]::text[]
    )
  end;
$$;

revoke all on function public.dashboard_club_capabilities(uuid) from public;
grant execute on function public.dashboard_club_capabilities(uuid) to authenticated;
