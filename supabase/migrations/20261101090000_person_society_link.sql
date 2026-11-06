-- ============================================================
-- DAS-REV-21 — Collegamento Persona–Società
--
-- Due percorsi dello stesso dominio (§1):
--
--   A. una persona registrata dichiara un ruolo che ricopre già nella
--      realtà e chiede alla Società di confermarlo. Prima della decisione
--      non nasce alcun incarico;
--   B. con il rapporto attivo, persona e Società consultano, modificano,
--      aggiungono e terminano i singoli incarichi, oppure chiudono
--      l'intero rapporto sportivo.
--
-- Nessun oggetto nuovo dove ne esiste già uno canonico (§3):
--
--   · SocietyMembership sportiva   → `club_members`          (DAS-REV-19)
--   · MembershipAssignment         → `club_member_assignments`
--   · Invitation                   → `club_member_invites`
--   · JoinLink / Redemption        → `club_team_join_*`      (DAS-REV-20)
--   · Capability e scope           → `club_member_permissions` (DAS-REV-14)
--
-- Tre cose mancavano e nascono qui:
--
--   1. **ConnectionRequest** (`club_role_requests`). Oggi la tab «Richieste
--      ricevute» legge righe `club_members` con `added_by='self_request'`:
--      un modello legacy senza ruolo strutturato, senza ambito e senza
--      lifecycle proprio. §7 vuole una proposta che «non è ancora un
--      rapporto attivo» e §42 ne elenca i campi. La vecchia lettura resta —
--      §48 vieta di riscrivere record terminali validi — e le due sorgenti
--      convivono nella stessa tab.
--
--   2. **La linea dell'incarico** (§10). Un incarico modificato non è un
--      UPDATE: termina un segmento con causa ROLE_CHANGED e ne apre un
--      successore nella stessa linea. `lineage_id` + `predecessor_id` +
--      `revision` danno continuità, storico e concorrenza controllata.
--
--   3. **L'origine dell'ultima modifica**, separata dall'origine iniziale
--      (§39). `source_*` continua a dire da dove la persona è **entrata**
--      — ed è ciò che i lettori di DAS-REV-20 contano — mentre
--      `change_source` dice chi ha prodotto il segmento corrente. Senza la
--      separazione un cambio di ruolo farebbe sparire la persona dalle
--      «Persone collegate» del link, che §39 vieta esplicitamente.
--
-- Invariante trasversale: nessuna policy di scrittura su queste tabelle.
-- Scrivono solo funzioni SECURITY DEFINER che rivalidano actor, capability,
-- scope, versione e stato (§8, §47).
-- ============================================================


-- ============================================================
-- SEZIONE 1 — Capability nuove (§8, DAS-REV-14)
--
-- Quattro verbi che §8 chiede di distinguere e che oggi non esistono:
--
--   · `member_requests_resolve`  approvare/rifiutare una richiesta;
--   · `assignments_manage`       modificare, aggiungere, rimuovere **un**
--                                incarico nel proprio ambito;
--   · `members_remove`           terminare l'**intera** relazione sportiva.
--
-- «Visualizza non implica Gestisci»: `member_requests_view` resta separata
-- da `member_requests_resolve`, e `roster_view` da `assignments_manage`.
--
-- `members_remove` vive nell'area `roster_invites` (è organico) ma la sua
-- RPC esige un permesso **senza** restrizione di squadra: §8 — «Aver
-- selezionato tutte le squadre non equivale automaticamente a possedere una
-- capability societaria globale». È la stessa regola che
-- `member_invite_allows` applica a `p_scope_type='society'`, e il motivo è
-- che un perimetro di squadre non contiene la squadra che nascerà domani.
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
    'members_remove'
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
    'members_remove'
  ));

insert into public.club_permission_controls
  (id, area_id, label, helper, bundle, requires, sort_order, is_available) values
  ('roster_requests_resolve', 'roster_invites', 'Approva e rifiuta richieste',
     'Necessario per visualizzare le richieste ricevute',
     'manage', array['roster_read', 'roster_requests_read'], 5, true),
  ('roster_assignments_manage', 'roster_invites', 'Gestisci i ruoli delle persone',
     'Necessario per visualizzare l''organico',
     'manage', array['roster_read'], 6, true),
  ('roster_member_remove', 'roster_invites', 'Rimuovi una persona dalla società',
     'Richiede un permesso su tutta la società, non su una singola squadra',
     'manage', array['roster_read', 'roster_assignments_manage'], 7, true)
on conflict (id) do update
  set area_id      = excluded.area_id,
      label        = excluded.label,
      helper       = excluded.helper,
      bundle       = excluded.bundle,
      requires     = excluded.requires,
      sort_order   = excluded.sort_order,
      is_available = excluded.is_available;

insert into public.club_permission_control_keys (control_id, permission_key) values
  ('roster_requests_resolve',   'member_requests_resolve'),
  ('roster_assignments_manage', 'assignments_manage'),
  ('roster_member_remove',      'members_remove')
on conflict do nothing;

/*
 * Backfill (§48: non distruttivo e dimostrabile).
 *
 * Chi poteva già **creare** un incarico invitando una persona poteva già
 * produrre lo stesso effetto di un'approvazione o di un'aggiunta: le due
 * chiavi gestionali seguono `invites_create` con lo stesso scope.
 *
 * `members_remove` no: è l'unica che agisce sull'intera relazione, e §8 la
 * vuole esplicita. La riceve soltanto chi ha `invites_create` **senza**
 * restrizione di squadra, cioè chi aveva già autorità sull'intera Società.
 */
insert into public.club_member_permissions (club_id, profile_id, permission_key, team_id)
select p.club_id, p.profile_id, k.key, p.team_id
from public.club_member_permissions p
cross join (values ('member_requests_resolve'), ('assignments_manage')) as k(key)
where p.permission_key = 'invites_create'
  and not exists (
    select 1 from public.club_member_permissions q
    where q.club_id = p.club_id
      and q.profile_id = p.profile_id
      and q.permission_key = k.key
      and q.team_id is not distinct from p.team_id
  );

insert into public.club_member_permissions (club_id, profile_id, permission_key, team_id)
select p.club_id, p.profile_id, 'members_remove', null
from public.club_member_permissions p
where p.permission_key = 'invites_create'
  and p.team_id is null
  and not exists (
    select 1 from public.club_member_permissions q
    where q.club_id = p.club_id
      and q.profile_id = p.profile_id
      and q.permission_key = 'members_remove'
  );

insert into public.club_admin_role_permissions (role_id, permission_key)
select distinct r.role_id, k.key
from public.club_admin_role_permissions r
cross join (values ('member_requests_resolve'), ('assignments_manage')) as k(key)
where r.permission_key = 'invites_create'
  and not exists (
    select 1 from public.club_admin_role_permissions q
    where q.role_id = r.role_id and q.permission_key = k.key
  );


-- ============================================================
-- SEZIONE 2 — dashboard_club_capabilities (§8)
--
-- Riscritta da 20261030090000_society_member_invites.sql per includere le
-- tre chiavi nuove. Nessun'altra differenza: corpo, filtro di scope per area
-- e `club_access_is_active` restano quelli.
--
-- La whitelist è duplicata (Owner e non-Owner) nella funzione originale e
-- resta tale: cambiarne la forma qui renderebbe illeggibile il diff proprio
-- dove conta leggerlo.
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
      'members_remove'
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
            'members_remove'
          )
      ),
      array[]::text[]
    )
  end;
$$;


revoke all on function public.dashboard_club_capabilities(uuid) from public;
grant execute on function public.dashboard_club_capabilities(uuid) to authenticated;


-- ============================================================
-- SEZIONE 3 — La linea dell'incarico (§10, §30, §39)
--
-- «Mantieni una linea canonica dell'incarico attraverso i cambiamenti … Una
-- modifica termina il segmento precedente con causa ROLE_CHANGED e crea il
-- successore attivo nella stessa operazione logica; una nuova aggiunta apre
-- una linea distinta.»
--
-- Quattro colonne e un indice:
--
--   `lineage_id`     identità stabile dell'incarico attraverso le versioni.
--                    Per le righe esistenti è il loro stesso id: ciascuna è
--                    una linea di un segmento solo, che è esattamente ciò
--                    che erano.
--   `predecessor_id` il segmento che questo sostituisce. Serve a §34
--                    («Ripristina ruolo precedente») e rende la catena
--                    leggibile senza ordinare per data.
--   `revision`       versione del **segmento corrente**, per il conflitto
--                    controllato di §30 — «Versioni obsolete producono un
--                    conflitto controllato, non last-write-wins silenzioso».
--   `change_source`  chi ha prodotto questo segmento.
--
-- L'ultima è la colonna che §39 rende necessaria: «conserva separatamente
-- origine iniziale … e origine dell'ultima modifica. ROLE_CHANGED o
-- DIRECT_SOCIETY_EDIT non cancellano il fatto che l'ingresso iniziale
-- proviene dal link». I campi `source_*` restano quindi l'**ingresso** e
-- vengono copiati sul successore: è ciò che
-- `fetch_team_join_link_people_page` conta, e senza la copia un cambio di
-- ruolo farebbe sparire e ricomparire la persona come nuovo ingresso.
--
-- L'unicità per linea attiva è il corrispettivo di §30 «Non lasciare uno
-- stato intermedio persistente senza ruolo»: due segmenti attivi della
-- stessa linea sarebbero il bug opposto, un ruolo duplicato.
-- ============================================================

alter table public.club_member_assignments
  add column if not exists lineage_id     uuid,
  add column if not exists predecessor_id uuid
    references public.club_member_assignments(id) on delete set null,
  add column if not exists revision       integer not null default 1,
  add column if not exists change_source  text,
  add column if not exists changed_by     uuid references public.profiles(id) on delete set null,
  add column if not exists source_request_id uuid;

/* Backfill dimostrabile (§48): ogni riga esistente è una linea di sé stessa. */
update public.club_member_assignments
set lineage_id = id
where lineage_id is null;

alter table public.club_member_assignments
  alter column lineage_id set not null;

alter table public.club_member_assignments
  alter column lineage_id set default gen_random_uuid();

alter table public.club_member_assignments
  drop constraint if exists club_member_assignments_change_source_check;

alter table public.club_member_assignments
  add constraint club_member_assignments_change_source_check check (
    change_source is null
    or change_source in ('initial', 'person_edit', 'society_edit', 'society_restore')
  );

/*
 * §30 e §34 aggiungono due cause al lifecycle esistente:
 *
 *   ROLE_CHANGED      il segmento è stato sostituito da un successore
 *                     (modifica o ripristino): la linea continua;
 *   REMOVED_BY_USER   la persona ha rimosso **quel** incarico (§35), che
 *                     non è lo stesso di LEFT_BY_USER — «Le cause personali
 *                     e societarie rimangono distinte» (DoD §47) e «termine
 *                     personale: conserva REMOVED_BY_USER/LEFT_BY_USER,
 *                     senza trasformarlo in rimozione societaria» (§39).
 */
alter table public.club_member_assignments
  drop constraint if exists club_member_assignments_ended_cause_check;

alter table public.club_member_assignments
  add constraint club_member_assignments_ended_cause_check check (
    ended_cause is null
    or ended_cause in (
      'REMOVED_BY_SOCIETY', 'LEFT_BY_USER', 'TEAM_ARCHIVED', 'OTHER',
      'ROLE_CHANGED', 'REMOVED_BY_USER'
    )
  );

/* Due percorsi nuovi che possono **aprire** una linea (§31, §22). */
alter table public.club_member_assignments
  drop constraint if exists club_member_assignments_source_check;

alter table public.club_member_assignments
  add constraint club_member_assignments_source_check check (
    source_type is null
    or source_type in (
      'invitation', 'join_link', 'self_request', 'manual',
      'role_confirmation_request', 'person_add', 'society_add'
    )
  );

create unique index if not exists club_member_assignments_lineage_active_unique
  on public.club_member_assignments (lineage_id)
  where status = 'active';

create index if not exists club_member_assignments_lineage_idx
  on public.club_member_assignments (lineage_id, created_at);

create index if not exists club_member_assignments_predecessor_idx
  on public.club_member_assignments (predecessor_id)
  where predecessor_id is not null;


-- ============================================================
-- SEZIONE 4 — Versione aggregata della relazione (§36, §37)
--
-- «Usa una versione aggregata della relazione o un meccanismo equivalente.
-- Se tra apertura dello sheet e conferma cambia l'insieme dei ruoli,
-- aggiorna il riepilogo e richiedi la conferma sullo stato corrente.»
--
-- Il contatore vive sulla membership e lo muove un trigger, non i chiamanti:
-- un incarico terminato dall'archiviazione di una squadra o da un link deve
-- invalidare una conferma di scollegamento preparata un istante prima
-- esattamente come lo fa un'aggiunta esplicita.
-- ============================================================

alter table public.club_members
  add column if not exists assignments_revision integer not null default 1;

create or replace function public.club_membership_bump_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership uuid := coalesce(new.membership_id, old.membership_id);
begin
  if v_membership is null then
    return null;
  end if;

  update public.club_members
  set assignments_revision = assignments_revision + 1,
      updated_at           = timezone('utc', now())
  where id = v_membership;

  return null;
end;
$$;

drop trigger if exists club_member_assignments_bump_membership
  on public.club_member_assignments;

create trigger club_member_assignments_bump_membership
  after insert or delete on public.club_member_assignments
  for each row execute function public.club_membership_bump_revision();

drop trigger if exists club_member_assignments_bump_membership_status
  on public.club_member_assignments;

create trigger club_member_assignments_bump_membership_status
  after update of status on public.club_member_assignments
  for each row
  when (old.status is distinct from new.status)
  execute function public.club_membership_bump_revision();


-- ============================================================
-- SEZIONE 5 — ConnectionRequest (§7, §15, §42)
--
-- «Proposta strutturata della persona al club; non è ancora un rapporto
-- attivo.» I campi sono quelli elencati da §42, con due scelte da motivare:
--
--   · `revision` e non solo `updated_at`: §30 e §46 chiedono un conflitto
--     controllato, e due amministratori che decidono insieme devono
--     convergere su **una** decisione (§23);
--   · `resolved_assignment_id` + `resolved_lineage_id` anche per l'esito
--     neutro di §16 — «con assignment/lineage di destinazione e
--     resolved_at»: una proposta soddisfatta altrove deve poter dire
--     **dove**, altrimenti «Collegamento completato tramite un altro
--     percorso» è una frase senza referente.
--
-- Nessun campo per messaggio, motivazione o nota: §12 e §21 li vietano in
-- entrambe le direzioni.
-- ============================================================

create table if not exists public.club_role_requests (
  id                     uuid primary key default gen_random_uuid(),
  club_id                uuid not null references public.clubs(id) on delete cascade,
  profile_id             uuid not null references public.profiles(id) on delete cascade,
  /* Identità professionale canonica dichiarata, verificata al commit (§10). */
  profile_type           text not null check (profile_type in ('player', 'coach', 'staff', 'director')),
  structured_role_id     text not null references public.club_assignment_roles(id) on delete restrict,
  custom_role_name       text,
  scope_type             text not null check (scope_type in ('team', 'society')),
  team_id                uuid references public.club_teams(id) on delete cascade,
  status                 text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'cancelled', 'superseded')),
  revision               integer not null default 1,
  created_at             timestamptz not null default timezone('utc', now()),
  resolved_at            timestamptz,
  /* Reale: nullo quando nessuna persona ha deciso (annullamento, altrove). */
  resolved_by            uuid references public.profiles(id) on delete set null,
  cancelled_at           timestamptz,
  resolved_assignment_id uuid references public.club_member_assignments(id) on delete set null,
  resolved_lineage_id    uuid,
  membership_id          uuid references public.club_members(id) on delete set null,
  schema_version         integer not null default 1,
  updated_at             timestamptz not null default timezone('utc', now()),
  constraint club_role_requests_scope_shape check (
    (scope_type = 'team' and team_id is not null)
    or (scope_type = 'society' and team_id is null)
  ),
  constraint club_role_requests_resolution_shape check (
    (status = 'pending' and resolved_at is null)
    or (status <> 'pending' and resolved_at is not null)
  ),
  constraint club_role_requests_cancel_shape check (
    (status = 'cancelled') = (cancelled_at is not null)
  )
);

alter table public.club_member_assignments
  drop constraint if exists club_member_assignments_source_request_fkey;

alter table public.club_member_assignments
  add constraint club_member_assignments_source_request_fkey
  foreign key (source_request_id) references public.club_role_requests(id) on delete set null;

create index if not exists club_role_requests_club_status_idx
  on public.club_role_requests (club_id, status, created_at desc);

create index if not exists club_role_requests_profile_idx
  on public.club_role_requests (profile_id, status);

create index if not exists club_role_requests_team_idx
  on public.club_role_requests (team_id)
  where team_id is not null;

/*
 * §16: «L'equivalenza riguarda l'incarico proposto: persona, società,
 * categoria strutturale pertinente, ruolo canonico/custom normalizzato,
 * scope e Team quando TEAM. Non usare soltanto person_id + society_id, né
 * label localizzate.»
 *
 * La forma è **identica** a quella degli indici di `club_member_invites` e
 * `club_member_assignments`: §16 chiede che inviti, richieste, join e
 * aggiunte «condividano lo stesso controllo di equivalenza», e tre
 * definizioni diverse dello stesso concetto sono tre comportamenti diversi.
 */
create unique index if not exists club_role_requests_pending_unique
  on public.club_role_requests (
    club_id,
    profile_id,
    profile_type,
    structured_role_id,
    coalesce(lower(custom_role_name), ''),
    scope_type,
    coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'pending';

alter table public.club_role_requests enable row level security;

/*
 * §11: «Gli stati privati del richiedente non entrano nel payload pubblico
 * cacheabile della società. Un visitor non vede le richieste di altri
 * utenti.» La policy è la rete di sicurezza; il perimetro per capability e
 * scope lo applicano le RPC, unico ingresso del client.
 */
drop policy if exists "role requests readable" on public.club_role_requests;
create policy "role requests readable"
  on public.club_role_requests for select to authenticated
  using (
    profile_id = auth.uid()
    or public.owns_club(club_id)
    or public.club_access_is_active(club_id, auth.uid())
  );

create or replace function public.club_role_request_normalize()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_custom    boolean;
  v_profile_type text;
begin
  select r.is_custom, r.profile_type
  into v_is_custom, v_profile_type
  from public.club_assignment_roles r
  where r.id = new.structured_role_id;

  if v_is_custom is null then
    raise exception 'ASSIGNMENT_ROLE_UNKNOWN';
  end if;

  if v_profile_type is distinct from new.profile_type then
    raise exception 'ASSIGNMENT_ROLE_PROFILE_MISMATCH';
  end if;

  new.custom_role_name := public.normalize_assignment_custom_role(new.custom_role_name);

  if v_is_custom then
    if new.custom_role_name is null then
      raise exception 'ASSIGNMENT_CUSTOM_ROLE_REQUIRED';
    end if;

    if length(new.custom_role_name) > public.club_assignment_custom_role_max() then
      raise exception 'ASSIGNMENT_CUSTOM_ROLE_TOO_LONG';
    end if;
  else
    new.custom_role_name := null;
  end if;

  new.updated_at := timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists club_role_requests_normalize on public.club_role_requests;
create trigger club_role_requests_normalize
  before insert or update on public.club_role_requests
  for each row execute function public.club_role_request_normalize();


-- ============================================================
-- SEZIONE 6 — Read state per actor (§17)
--
-- «Nuova riguarda la lettura del singolo amministratore. Usa request_id +
-- actor_user_id + society_id + read_at … Una lettura non marca il record
-- come letto per tutti e non risolve la richiesta.»
--
-- Tabella separata da `club_member_request_reads` perché quella ha una FK a
-- `club_members`: §48 vieta di riscrivere il dato legacy per far entrare il
-- nuovo, e una FK polimorfa non è una FK.
-- ============================================================

create table if not exists public.club_role_request_reads (
  request_id       uuid not null references public.club_role_requests(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  club_id          uuid not null references public.clubs(id) on delete cascade,
  read_at          timestamptz not null default timezone('utc', now()),
  primary key (request_id, actor_profile_id)
);

create index if not exists club_role_request_reads_actor_idx
  on public.club_role_request_reads (actor_profile_id, club_id);

alter table public.club_role_request_reads enable row level security;

drop policy if exists "role request reads readable by actor" on public.club_role_request_reads;
create policy "role request reads readable by actor"
  on public.club_role_request_reads for select to authenticated
  using (actor_profile_id = auth.uid());


-- ============================================================
-- SEZIONE 7 — Audit del rapporto sportivo (§50)
--
-- «L'audit transazionale privato conserva i riferimenti strettamente
-- necessari ad attribuire la decisione e proteggere la concorrenza; ha
-- accessi e retention diversi dall'analytics.»
--
-- Separato da `club_member_invite_audit` per la stessa ragione della
-- SEZIONE 6: quella tabella ha una FK all'invito.
-- ============================================================

create table if not exists public.club_role_link_audit (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  profile_id     uuid references public.profiles(id) on delete set null,
  request_id     uuid references public.club_role_requests(id) on delete set null,
  assignment_id  uuid references public.club_member_assignments(id) on delete set null,
  lineage_id     uuid,
  actor_id       uuid references public.profiles(id) on delete set null,
  actor_side     text not null check (actor_side in ('person', 'society')),
  operation      text not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state     jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default timezone('utc', now())
);

create index if not exists club_role_link_audit_club_idx
  on public.club_role_link_audit (club_id, created_at desc);

create index if not exists club_role_link_audit_lineage_idx
  on public.club_role_link_audit (lineage_id, created_at desc)
  where lineage_id is not null;

alter table public.club_role_link_audit enable row level security;

drop policy if exists "role link audit readable by owner" on public.club_role_link_audit;
create policy "role link audit readable by owner"
  on public.club_role_link_audit for select to authenticated
  using (public.owns_club(club_id));


-- ============================================================
-- SEZIONE 8 — Identità professionali reali e compatibili (§10, §12)
--
-- «Nella richiesta iniziale la riga Profilo usa le identità professionali
-- realmente presenti e compatibili. Se ne esiste una sola è read-only; non
-- permette a un Calciatore di inventarsi una nuova identità tramite il
-- form.»
--
-- "Realmente presenti" ha una definizione nel modello: il ruolo canonico su
-- `profiles.role`, più ogni tabella di profilo professionale che contenga
-- davvero una riga per quella persona. Chi ha completato l'onboarding
-- Calciatore e in seguito quello Allenatore ha due identità reali; chi ha
-- solo `role='player'` ne ha una, e il form la mostra read-only.
--
-- Tifoso, Media/Creator e Procuratore non compaiono: §9 fissa quattro
-- categorie strutturali, e §11 vieta «un form con PERSON inventata».
-- ============================================================

create or replace function public.person_professional_identities(p_profile_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct t.kind order by t.kind), array[]::text[])
  from (
    select p.role::text as kind
    from public.profiles p
    where p.id = p_profile_id
      and p.role::text in ('player', 'coach', 'staff', 'director')
    union
    select 'player' from public.player_profiles   where profile_id = p_profile_id
    union
    select 'coach'  from public.coach_profiles    where profile_id = p_profile_id
    union
    select 'staff'  from public.staff_profiles    where profile_id = p_profile_id
    union
    select 'director' from public.director_profiles where profile_id = p_profile_id
  ) t;
$$;

revoke all on function public.person_professional_identities(uuid) from public;

comment on function public.person_professional_identities(uuid) is
  'DAS-REV-21 §10: le identità professionali realmente presenti di una '
  'PERSON. Non inventa un tipo per far passare un form.';


-- ============================================================
-- SEZIONE 9 — Equivalenza condivisa (§16)
--
-- Tre letture sulla stessa definizione, una per dominio. Non sono tre
-- regole: sono tre query sulla **stessa** tupla di equivalenza, quella
-- incisa negli indici unici. §16 — «Inviti, richieste, join, aggiunte e
-- modifiche concorrenti devono condividere lo stesso controllo di
-- equivalenza e le guard necessarie».
--
-- Il custom entra normalizzato e in minuscolo: "Data analyst" e
-- "data  analyst" sono lo stesso incarico.
-- ============================================================

create or replace function public.club_equivalent_active_assignment(
  p_club_id      uuid,
  p_profile_id   uuid,
  p_profile_type text,
  p_role_id      text,
  p_custom       text,
  p_scope_type   text,
  p_team_id      uuid,
  p_exclude_lineage uuid default null
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.id
  from public.club_member_assignments a
  where a.club_id = p_club_id
    and a.profile_id = p_profile_id
    and a.status = 'active'
    and a.profile_type = p_profile_type
    and a.structured_role_id = p_role_id
    and coalesce(lower(a.custom_role_name), '')
        = coalesce(lower(public.normalize_assignment_custom_role(p_custom)), '')
    and a.scope_type = p_scope_type
    and a.team_id is not distinct from p_team_id
    and (p_exclude_lineage is null or a.lineage_id <> p_exclude_lineage)
  limit 1;
$$;

revoke all on function public.club_equivalent_active_assignment(uuid, uuid, text, text, text, text, uuid, uuid) from public;

create or replace function public.club_equivalent_pending_request(
  p_club_id      uuid,
  p_profile_id   uuid,
  p_profile_type text,
  p_role_id      text,
  p_custom       text,
  p_scope_type   text,
  p_team_id      uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.id
  from public.club_role_requests r
  where r.club_id = p_club_id
    and r.profile_id = p_profile_id
    and r.status = 'pending'
    and r.profile_type = p_profile_type
    and r.structured_role_id = p_role_id
    and coalesce(lower(r.custom_role_name), '')
        = coalesce(lower(public.normalize_assignment_custom_role(p_custom)), '')
    and r.scope_type = p_scope_type
    and r.team_id is not distinct from p_team_id
  limit 1;
$$;

revoke all on function public.club_equivalent_pending_request(uuid, uuid, text, text, text, text, uuid) from public;

create or replace function public.club_equivalent_pending_invite(
  p_club_id      uuid,
  p_profile_id   uuid,
  p_profile_type text,
  p_role_id      text,
  p_custom       text,
  p_scope_type   text,
  p_team_id      uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select i.id
  from public.club_member_invites i
  where i.club_id = p_club_id
    and i.invitee_profile_id = p_profile_id
    and i.status = 'pending'
    and i.profile_type = p_profile_type
    and i.structured_role_id = p_role_id
    and coalesce(lower(i.custom_role_name), '')
        = coalesce(lower(public.normalize_assignment_custom_role(p_custom)), '')
    and i.scope_type = p_scope_type
    and i.team_id is not distinct from p_team_id
  limit 1;
$$;

revoke all on function public.club_equivalent_pending_invite(uuid, uuid, text, text, text, text, uuid) from public;

/**
 * §25: «Una squadra non attiva/non assegnabile non può ricevere nuove
 * richieste operative, approvazioni, aggiunte o incarichi spostati verso di
 * essa. Valida al caricamento e al commit; non fidarti della disponibilità
 * quando si è aperto il picker.»
 *
 * Una sola definizione, usata dal picker e da ogni mutation.
 */
create or replace function public.club_team_is_assignable(
  p_club_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_teams t
    where t.id = p_team_id
      and t.club_id = p_club_id
      and coalesce(t.is_archived, false) = false
  );
$$;

revoke all on function public.club_team_is_assignable(uuid, uuid) from public;

/**
 * §16, ultima riga della tabella: «Link completato o altro percorso che crea
 * l'incarico equivalente → riusa il risultato reale e risolvi le proposte
 * equivalenti pendenti come soddisfatte altrove.»
 *
 * Un posto solo, chiamato da ogni percorso che crea un incarico. §16 vieta
 * che «la risoluzione sia un booleano locale del widget», e §31 che
 * un'aggiunta immediata «si trasformi in una nuova approvazione»: lo stato
 * è `superseded`, `resolved_by` resta nullo perché nessuno ha deciso.
 */
create or replace function public.club_resolve_superseded_requests(
  p_club_id       uuid,
  p_profile_id    uuid,
  p_profile_type  text,
  p_role_id       text,
  p_custom        text,
  p_scope_type    text,
  p_team_id       uuid,
  p_assignment_id uuid,
  p_lineage_id    uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with resolved as (
    update public.club_role_requests r
    set status                 = 'superseded',
        resolved_at            = timezone('utc', now()),
        resolved_assignment_id = p_assignment_id,
        resolved_lineage_id    = p_lineage_id,
        revision               = r.revision + 1
    where r.club_id = p_club_id
      and r.profile_id = p_profile_id
      and r.status = 'pending'
      and r.profile_type = p_profile_type
      and r.structured_role_id = p_role_id
      and coalesce(lower(r.custom_role_name), '')
          = coalesce(lower(public.normalize_assignment_custom_role(p_custom)), '')
      and r.scope_type = p_scope_type
      and r.team_id is not distinct from p_team_id
    returning r.id
  )
  select count(*)::integer into v_count from resolved;

  return v_count;
end;
$$;

revoke all on function public.club_resolve_superseded_requests(uuid, uuid, text, text, text, text, uuid, uuid, uuid) from public;

comment on function public.club_resolve_superseded_requests(uuid, uuid, text, text, text, text, uuid, uuid, uuid) is
  'DAS-REV-21 §16: esito terminale neutro delle proposte soddisfatte '
  'altrove. Non è un APPROVED senza decisione: resolved_by resta nullo.';


-- ============================================================
-- SEZIONE 10 — Servizio centrale della relazione sportiva (§22, §30, §40)
--
-- Sei mutazioni creano o chiudono incarichi: approvazione, aggiunta,
-- modifica, ripristino, rimozione singola, termine completo. Scrivere sei
-- volte la stessa sequenza (riusa la membership → apri il segmento →
-- riallinea le colonne legacy) significa avere sei comportamenti. Le due
-- funzioni qui sotto sono quella sequenza, una volta sola.
--
-- `club_membership_sync_projection` è la risposta a §40: «Dopo il commit
-- aggiorna le proiezioni canoniche di Società e ruoli, dettaglio societario,
-- organico dei Team interessati e riepiloghi pertinenti.» Le colonne
-- `member_role`/`team_id`/`staff_title` di `club_members` sono proiezione
-- dell'incarico corrente dal DAS-REV-19; qui vengono ricalcolate dai dati e
-- non riscritte a mano da ogni chiamante.
--
-- La scelta dell'incarico "principale" quando ce ne sono più d'uno è
-- deterministica — il più vecchio ancora attivo — e non casuale: §26 vieta
-- che «il riepilogo dipenda dall'ordine casuale delle risposte API», e la
-- stessa esigenza vale per una colonna che l'Organico legge.
-- ============================================================

create or replace function public.club_membership_ensure(
  p_club_id      uuid,
  p_profile_id   uuid,
  p_profile_type text,
  p_added_by     text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership uuid;
begin
  /* `club_members_unique_profile` rende questa l'unica strada: una sola
     relazione per persona e club, riusata per ogni incarico (§7). */
  select cm.id into v_membership
  from public.club_members cm
  where cm.club_id = p_club_id
    and cm.profile_id = p_profile_id
  for update;

  if v_membership is null then
    insert into public.club_members
      (club_id, profile_id, member_role, staff_title, status, added_by, team_id)
    values (p_club_id, p_profile_id, p_profile_type, null, 'active', p_added_by, null)
    returning id into v_membership;
  else
    update public.club_members
    set status     = 'active',
        updated_at = timezone('utc', now())
    where id = v_membership;
  end if;

  return v_membership;
end;
$$;

revoke all on function public.club_membership_ensure(uuid, uuid, text, text) from public;

create or replace function public.club_membership_sync_projection(p_membership_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active integer;
  v_primary public.club_member_assignments%rowtype;
begin
  select count(*)::integer into v_active
  from public.club_member_assignments a
  where a.membership_id = p_membership_id
    and a.status = 'active';

  if v_active = 0 then
    /*
     * §35: «Se non ne rimane nessuno aggiorna la membership aggregata a
     * inattiva secondo il dominio, senza hard delete.»
     *
     * Solo le relazioni governate dagli incarichi: una riga inserita a mano
     * nell'Organico non deve sparire perché un incarico separato è finito
     * (stessa regola di `end_team_join_link_assignment`).
     */
    update public.club_members
    set status     = 'removed',
        updated_at = timezone('utc', now())
    where id = p_membership_id
      and added_by in ('invitation', 'join_link', 'self_request');

    return 0;
  end if;

  select * into v_primary
  from public.club_member_assignments a
  where a.membership_id = p_membership_id
    and a.status = 'active'
  order by a.created_at, a.id
  limit 1;

  update public.club_members
  set member_role = v_primary.profile_type,
      team_id     = case when v_primary.scope_type = 'team' then v_primary.team_id end,
      staff_title = case
        when v_primary.profile_type in ('staff', 'director')
        then public.club_assignment_role_label(
               v_primary.structured_role_id, v_primary.custom_role_name)
      end,
      status      = 'active',
      updated_at  = timezone('utc', now())
  where id = p_membership_id;

  return v_active;
end;
$$;

revoke all on function public.club_membership_sync_projection(uuid) from public;

/**
 * Apre un segmento attivo (§10, §30, §31, §39).
 *
 * Con `p_predecessor_id` il segmento **continua una linea**: eredita
 * `lineage_id` e l'intera origine dell'ingresso. §39 — «ROLE_CHANGED o
 * DIRECT_SOCIETY_EDIT non cancellano il fatto che l'ingresso iniziale
 * proviene dal link» — e senza l'eredità la persona sparirebbe dalle
 * «Persone collegate» di DAS-REV-20 per poi ricomparire come ingresso nuovo.
 *
 * Senza predecessore apre una linea nuova: §31 — «Crea una nuova linea con
 * un solo segmento attivo, source coerente con aggiunta personale o
 * societaria … L'origine di una precedente Invitation o JoinLinkRedemption
 * non va copiata sul nuovo incarico soltanto perché appartiene allo stesso
 * club.»
 */
create or replace function public.club_assignment_open_segment(
  p_club_id           uuid,
  p_membership_id     uuid,
  p_profile_id        uuid,
  p_profile_type      text,
  p_role_id           text,
  p_custom            text,
  p_scope_type        text,
  p_team_id           uuid,
  p_change_source     text,
  p_actor_id          uuid,
  p_predecessor_id    uuid default null,
  p_source_type       text default null,
  p_source_request_id uuid default null,
  p_source_invite_id  uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev public.club_member_assignments%rowtype;
  v_id   uuid;
begin
  if p_predecessor_id is not null then
    select * into v_prev
    from public.club_member_assignments
    where id = p_predecessor_id;

    if v_prev.id is null then
      raise exception 'ASSIGNMENT_PREDECESSOR_NOT_FOUND';
    end if;
  end if;

  insert into public.club_member_assignments (
    club_id, membership_id, profile_id, profile_type, structured_role_id,
    custom_role_name, scope_type, team_id,
    lineage_id, predecessor_id, revision, change_source, changed_by,
    source_type, source_invite_id, source_request_id,
    source_join_link_id, source_redemption_id
  )
  values (
    p_club_id, p_membership_id, p_profile_id, p_profile_type, p_role_id,
    p_custom, p_scope_type, p_team_id,
    coalesce(v_prev.lineage_id, gen_random_uuid()),
    p_predecessor_id,
    coalesce(v_prev.revision, 0) + 1,
    p_change_source,
    p_actor_id,
    coalesce(v_prev.source_type, p_source_type),
    coalesce(v_prev.source_invite_id, p_source_invite_id),
    coalesce(v_prev.source_request_id, p_source_request_id),
    v_prev.source_join_link_id,
    v_prev.source_redemption_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.club_assignment_open_segment(
  uuid, uuid, uuid, text, text, text, text, uuid, text, uuid, uuid, text, uuid, uuid
) from public;

/**
 * Chiude un segmento (§30, §35, §36, §37).
 *
 * La causa è un parametro perché §35 e §39 chiedono che resti distinta:
 * `ROLE_CHANGED` (la linea continua), `REMOVED_BY_USER`, `LEFT_BY_USER`,
 * `REMOVED_BY_SOCIETY`. «Una seconda rimozione già applicata restituisce
 * l'esito coerente senza … cambio della causa originale»: la UPDATE filtra
 * su `status = 'active'`, quindi un retry non riscrive nulla.
 */
create or replace function public.club_assignment_close_segment(
  p_assignment_id uuid,
  p_cause         text,
  p_actor_id      uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.club_member_assignments
  set status      = 'ended',
      ended_at    = timezone('utc', now()),
      ended_cause = p_cause,
      ended_by    = p_actor_id,
      updated_at  = timezone('utc', now())
  where id = p_assignment_id
    and status = 'active';

  get diagnostics v_updated = row_count;

  return v_updated > 0;
end;
$$;

revoke all on function public.club_assignment_close_segment(uuid, text, uuid) from public;


-- ============================================================
-- SEZIONE 11 — Blocco contestuale sul profilo Società (§11, screen 01)
--
-- «Lo stato deriva da dati autorizzati della PERSON.» Una sola lettura, e
-- **fuori** dal payload del Master Profile: §11 — «Gli stati privati del
-- richiedente non entrano nel payload pubblico cacheabile della società».
-- `fetch_society_master_profile` resta quindi intatto e cacheabile per
-- tutti; questo blocco è una query privata dell'utente autenticato.
--
-- Cinque stati, nessuno dedotto dall'assenza di un altro:
--
--   ineligible   l'actor non ha un'identità professionale fra le quattro
--                categorie (§11: «I profili non compatibili o un actor
--                organizzativo non ricevono un form con PERSON inventata»);
--   active       almeno un incarico attivo → Gestisci i tuoi ruoli;
--   pending      esattamente una richiesta in attesa → il suo dettaglio;
--   pending_many più richieste lecite per incarichi distinti → l'elenco;
--   none         nessun rapporto e nessuna proposta pertinente.
--
-- `active` precede `pending`: una persona già collegata che ha una seconda
-- richiesta aperta per un incarico diverso deve poter gestire ciò che ha,
-- e il conteggio `pending_count` le dice che c'è anche dell'altro.
-- ============================================================

create or replace function public.fetch_society_role_link_state(p_club_id uuid)
returns table (
  /*
   * L'identità del club viaggia con lo stato perché le schermate del flusso
   * — form, riepilogo, esito — la mostrano tutte e §12 chiede «il nome reale
   * parametrico». Passarla per route sarebbe una copia del dato
   * visualizzato, che §6 vieta; rileggerla con una seconda RPC sarebbe una
   * richiesta in più per un dato che questa query ha già in mano.
   */
  club_name          text,
  club_logo_url      text,
  club_is_verified   boolean,
  club_city          text,
  club_region        text,
  state              text,
  can_request        boolean,
  active_count       integer,
  active_summary     text,
  pending_count      integer,
  request_id         uuid,
  request_role_label text,
  request_context    text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_identities text[];
  v_active     integer;
  v_pending    integer;
  v_summary    text;
  v_req        public.club_role_requests%rowtype;
  v_state      text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not exists (select 1 from public.clubs c where c.id = p_club_id) then
    raise exception 'ROLE_LINK_CLUB_NOT_FOUND';
  end if;

  v_identities := public.person_professional_identities(v_uid);

  select count(*)::integer into v_active
  from public.club_member_assignments a
  where a.club_id = p_club_id
    and a.profile_id = v_uid
    and a.status = 'active';

  select count(*)::integer into v_pending
  from public.club_role_requests r
  where r.club_id = p_club_id
    and r.profile_id = v_uid
    and r.status = 'pending';

  if v_active > 0 then
    /* Riepilogo deterministico, come la proiezione: il più vecchio attivo.
       §11 chiede «riepilogo corrente», non una riga a caso. */
    select
      public.club_assignment_role_label(a.structured_role_id, a.custom_role_name)
      || ' · '
      || case when a.scope_type = 'society' then 'Intera società' else ct.name end
    into v_summary
    from public.club_member_assignments a
    left join public.club_teams ct on ct.id = a.team_id
    where a.club_id = p_club_id
      and a.profile_id = v_uid
      and a.status = 'active'
    order by a.created_at, a.id
    limit 1;
  end if;

  if v_pending = 1 then
    select * into v_req
    from public.club_role_requests r
    where r.club_id = p_club_id
      and r.profile_id = v_uid
      and r.status = 'pending';
  end if;

  v_state := case
    when array_length(v_identities, 1) is null then 'ineligible'
    when v_active > 0                          then 'active'
    when v_pending = 1                         then 'pending'
    when v_pending > 1                         then 'pending_many'
    else 'none'
  end;

  return query
  select
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    c.city,
    c.region,
    v_state,
    /* §11: con un rapporto attivo la gestione passa da Società e ruoli,
       non da una seconda richiesta. Con una proposta aperta §11 vieta «una
       seconda CTA per duplicarla». */
    v_state = 'none',
    v_active,
    v_summary,
    v_pending,
    v_req.id,
    case when v_req.id is not null
      then public.club_assignment_role_label(v_req.structured_role_id, v_req.custom_role_name)
    end,
    case
      when v_req.id is null then null
      when v_req.scope_type = 'society' then 'Intera società'
      else (select ct.name from public.club_teams ct where ct.id = v_req.team_id)
    end
  from public.clubs c
  where c.id = p_club_id;
end;
$$;

revoke all on function public.fetch_society_role_link_state(uuid) from public;
grant execute on function public.fetch_society_role_link_state(uuid) to authenticated;

comment on function public.fetch_society_role_link_state(uuid) is
  'DAS-REV-21 §11: stato del blocco «Fai parte di questa società?». '
  'Privato dell''actor: non entra nel payload pubblico della Società.';


-- ============================================================
-- SEZIONE 12 — Materiali del form (§12, §13)
--
-- Due liste, nessuna delle quali il client può inventare:
--
--   · le identità professionali **realmente** presenti (§12: la riga
--     Profilo read-only quando ce n'è una sola);
--   · le squadre interne assegnabili (§13: «Restituisci soltanto Team
--     interni validi e utilizzabili per l'operazione … Escludi affiliate,
--     Team di altre società e risorse non consultabili»).
--
-- Il catalogo dei ruoli non è qui: esiste già
-- `fetch_club_assignment_roles()` e §9 vieta «un secondo elenco di ruoli
-- per la gestione».
-- ============================================================

create or replace function public.fetch_role_request_identities()
returns table (
  profile_type text,
  label        text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.kind,
    case t.kind
      when 'player'   then 'Calciatore'
      when 'coach'    then 'Allenatore'
      when 'staff'    then 'Staff'
      when 'director' then 'Dirigente'
    end
  from unnest(public.person_professional_identities(auth.uid())) as t(kind)
  order by case t.kind
    when 'player' then 1 when 'coach' then 2 when 'staff' then 3 else 4
  end;
$$;

revoke all on function public.fetch_role_request_identities() from public;
grant execute on function public.fetch_role_request_identities() to authenticated;

/**
 * §13: le squadre fra cui la PERSON può scegliere.
 *
 * Non è `fetch_member_invite_assignable_teams`: quella è gated su
 * `invites_create` e serve a un amministratore. Qui l'actor è la persona, e
 * il perimetro è quello pubblico/operativo del club — squadre interne non
 * archiviate, con nomi e ID canonici. §13: «senza ricevere dati
 * amministrativi riservati».
 */
create or replace function public.fetch_role_request_teams(p_club_id uuid)
returns table (
  team_id  uuid,
  label    text,
  category text
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, t.category
  from public.club_teams t
  where t.club_id = p_club_id
    and coalesce(t.is_archived, false) = false
    and auth.uid() is not null
  order by t.sort_order, t.name;
$$;

revoke all on function public.fetch_role_request_teams(uuid) from public;
grant execute on function public.fetch_role_request_teams(uuid) to authenticated;


-- ============================================================
-- SEZIONE 13 — Creazione della richiesta (§15, §16)
--
-- «Crea un solo ConnectionRequest con ID stabile, versione e timestamp
-- server. Stato PENDING. Non creare ancora SocietyMembership o
-- MembershipAssignment.»
--
-- L'ordine dei controlli non è arbitrario: prima ciò che rende la richiesta
-- impossibile (identità, club, Team), poi ciò che la rende **inutile**
-- (incarico già attivo, invito equivalente, richiesta equivalente). §16
-- vuole che il secondo gruppo non diventi un errore generico: ciascun caso
-- ha il proprio esito, perché la UI ci costruisce sopra una destinazione
-- diversa.
--
-- L'idempotenza usa il servizio condiviso di DAS-REV-11: «Stessa chiave e
-- stesso payload riprendono lo stesso risultato; stessa chiave con payload
-- diverso fallisce in modo controllato» (§15) è esattamente il contratto di
-- `club_relationship_operation_replay`.
-- ============================================================

create or replace function public.create_role_confirmation_request(
  p_club_id         uuid,
  p_profile_type    text,
  p_role_id         text,
  p_custom_role     text default null,
  p_scope_type      text default 'team',
  p_team_id         uuid default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_identities  text[];
  v_role        public.club_assignment_roles%rowtype;
  v_custom      text;
  v_team        uuid;
  v_fingerprint text;
  v_replay      jsonb;
  v_existing    uuid;
  v_request     public.club_role_requests%rowtype;
  v_result      jsonb;
  v_club_owner  uuid;
  v_club_name   text;
  v_person      text;
  v_label       text;
  v_context     text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select c.owner_profile_id, c.name into v_club_owner, v_club_name
  from public.clubs c where c.id = p_club_id;

  if v_club_owner is null then
    raise exception 'ROLE_LINK_CLUB_NOT_FOUND';
  end if;

  /* §15: «I campi mostrati read-only restano soggetti a validazione.» Il
     profilo arriva dal payload e viene verificato contro le identità reali:
     QA-014 manipola proprio questo campo. */
  v_identities := public.person_professional_identities(v_uid);

  if p_profile_type is null or not (p_profile_type = any (v_identities)) then
    raise exception 'ROLE_REQUEST_PROFILE_INVALID';
  end if;

  select * into v_role
  from public.club_assignment_roles
  where id = p_role_id and is_available;

  if v_role.id is null or v_role.profile_type <> p_profile_type then
    raise exception 'ROLE_REQUEST_ROLE_INVALID';
  end if;

  v_custom := public.normalize_assignment_custom_role(p_custom_role);

  if v_role.is_custom then
    if v_custom is null then
      raise exception 'ASSIGNMENT_CUSTOM_ROLE_REQUIRED';
    end if;

    if length(v_custom) > public.club_assignment_custom_role_max() then
      raise exception 'ASSIGNMENT_CUSTOM_ROLE_TOO_LONG';
    end if;
  else
    v_custom := null;
  end if;

  /* §9: SOCIETY è riservato al Dirigente; le altre tre categorie vivono
     sempre su una squadra interna. §12: con Intera società il Team non va
     «né mostrato né inviato». */
  if p_scope_type not in ('team', 'society') then
    raise exception 'ROLE_REQUEST_SCOPE_INVALID';
  end if;

  if p_scope_type = 'society' and p_profile_type <> 'director' then
    raise exception 'ROLE_REQUEST_SCOPE_INVALID';
  end if;

  v_team := case when p_scope_type = 'team' then p_team_id end;

  if p_scope_type = 'team' then
    if v_team is null then
      raise exception 'ROLE_REQUEST_TEAM_REQUIRED';
    end if;

    /* §25: «Valida al caricamento e al commit; non fidarti della
       disponibilità quando si è aperto il picker.» Copre anche QA-024:
       il Team di un'affiliata non appartiene a questo club. */
    if not public.club_team_is_assignable(p_club_id, v_team) then
      raise exception 'ROLE_REQUEST_TEAM_UNAVAILABLE';
    end if;
  end if;

  v_fingerprint := md5(
    'create_role_confirmation_request|' || p_club_id::text || '|' || v_uid::text
    || '|' || p_profile_type || '|' || p_role_id || '|' || coalesce(lower(v_custom), '')
    || '|' || p_scope_type || '|' || coalesce(v_team::text, '')
  );

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, p_club_id, 'create_role_confirmation_request', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  /* §16, riga 2: un incarico equivalente attivo rende la richiesta priva di
     oggetto. Non è un errore della persona: la UI la porta alla gestione. */
  v_existing := public.club_equivalent_active_assignment(
    p_club_id, v_uid, p_profile_type, p_role_id, v_custom, p_scope_type, v_team
  );

  if v_existing is not null then
    raise exception 'ROLE_REQUEST_ALREADY_ASSIGNED';
  end if;

  /* §16, riga 3: un invito equivalente già ricevuto ha il proprio percorso
     (DAS-REV-19). Creare una richiesta parallela produrrebbe due proposte
     opposte per lo stesso incarico. */
  v_existing := public.club_equivalent_pending_invite(
    p_club_id, v_uid, p_profile_type, p_role_id, v_custom, p_scope_type, v_team
  );

  if v_existing is not null then
    raise exception 'ROLE_REQUEST_INVITE_EXISTS:%', v_existing;
  end if;

  /* §16, riga 1: la richiesta equivalente esistente si **apre**, non si
     duplica. L'indice unico parziale è comunque l'ultima parola fra due
     submit concorrenti (QA-071). */
  v_existing := public.club_equivalent_pending_request(
    p_club_id, v_uid, p_profile_type, p_role_id, v_custom, p_scope_type, v_team
  );

  if v_existing is not null then
    raise exception 'ROLE_REQUEST_DUPLICATE:%', v_existing;
  end if;

  insert into public.club_role_requests (
    club_id, profile_id, profile_type, structured_role_id, custom_role_name,
    scope_type, team_id
  )
  values (
    p_club_id, v_uid, p_profile_type, p_role_id, v_custom, p_scope_type, v_team
  )
  returning * into v_request;

  v_label := public.club_assignment_role_label(p_role_id, v_custom);
  v_context := case
    when p_scope_type = 'society' then 'Intera società'
    else (select ct.name from public.club_teams ct where ct.id = v_team)
  end;

  select p.full_name into v_person from public.profiles p where p.id = v_uid;

  insert into public.club_role_link_audit
    (club_id, profile_id, request_id, actor_id, actor_side, operation,
     previous_state, next_state)
  values (
    p_club_id, v_uid, v_request.id, v_uid, 'person', 'request_create',
    '{}'::jsonb,
    jsonb_build_object(
      'status', 'pending', 'profile_type', p_profile_type,
      'role_id', p_role_id, 'scope_type', p_scope_type, 'team_id', v_team
    )
  );

  /*
   * §15: «Crea l'evento/notifica societaria dopo commit.» In una funzione
   * plpgsql l'insert avviene nella stessa transazione del record: è questo
   * il "dopo commit" che il dominio può garantire — la notifica non esiste
   * se la richiesta non esiste, e viceversa. Il destinatario è l'Owner; gli
   * amministratori con capability leggono il Centro, che non ha bisogno di
   * una riga di notifica per ciascuno (§41: «deduplicazione per operazione
   * e destinatario»).
   */
  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    v_club_owner,
    'role_request_created',
    coalesce(v_person, 'Una persona'),
    'Nuova richiesta di conferma del ruolo' || chr(10) || v_label || ' · ' || coalesce(v_context, ''),
    jsonb_build_object(
      'club_id', p_club_id,
      'request_id', v_request.id,
      'profile_id', v_uid,
      'role_label', v_label,
      'context_label', v_context
    )
  );

  v_result := jsonb_build_object(
    'request_id', v_request.id,
    'status', 'pending',
    'revision', v_request.revision,
    'created_at', v_request.created_at
  );

  perform public.club_relationship_operation_record(
    p_idempotency_key, p_club_id, 'create_role_confirmation_request',
    v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.create_role_confirmation_request(uuid, text, text, text, text, uuid, text) from public;
grant execute on function public.create_role_confirmation_request(uuid, text, text, text, text, uuid, text) to authenticated;


-- ============================================================
-- SEZIONE 14 — Dettaglio e annullamento lato persona (§18, §19)
--
-- `fetch_my_role_request` è la destinazione di screen 07 e dei deep link
-- personali. Restituisce lo stato reale e **perché** un'azione non è
-- disponibile: §18 — «Se la richiesta non è più approvabile, esplicita il
-- motivo controllato e permetti l'annullamento quando ancora lecito».
--
-- `team_unavailable` è separato da `status`: §17 — «Disponibilità e
-- lifecycle sono distinti. Una richiesta PENDING su Team non più
-- utilizzabile è non più approvabile, non falsamente rifiutata o annullata
-- dalla persona».
-- ============================================================

create or replace function public.fetch_my_role_request(p_request_id uuid)
returns table (
  request_id         uuid,
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  club_is_verified   boolean,
  club_city          text,
  club_region        text,
  profile_type       text,
  role_label         text,
  scope_type         text,
  team_id            uuid,
  context_label      text,
  status             text,
  revision           integer,
  created_at         timestamptz,
  resolved_at        timestamptz,
  team_unavailable   boolean,
  can_cancel         boolean,
  resolved_lineage_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.club_role_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_req
  from public.club_role_requests r
  where r.id = p_request_id;

  /* §47: IDOR. Il proprietario della richiesta è l'unico lettore di questa
     superficie — la Società ha la propria, con la propria autorizzazione. */
  if v_req.id is null or v_req.profile_id <> v_uid then
    raise exception 'ROLE_REQUEST_NOT_FOUND';
  end if;

  return query
  select
    v_req.id,
    v_req.club_id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    c.city,
    c.region,
    v_req.profile_type,
    public.club_assignment_role_label(v_req.structured_role_id, v_req.custom_role_name),
    v_req.scope_type,
    v_req.team_id,
    case when v_req.scope_type = 'society' then 'Intera società' else ct.name end,
    v_req.status,
    v_req.revision,
    v_req.created_at,
    v_req.resolved_at,
    v_req.scope_type = 'team'
      and not public.club_team_is_assignable(v_req.club_id, v_req.team_id),
    v_req.status = 'pending',
    v_req.resolved_lineage_id
  from public.clubs c
  left join public.club_teams ct on ct.id = v_req.team_id
  where c.id = v_req.club_id;
end;
$$;

revoke all on function public.fetch_my_role_request(uuid) from public;
grant execute on function public.fetch_my_role_request(uuid) to authenticated;

/**
 * §11, terzo caso: «più richieste lecite per incarichi distinti: riepilogo
 * localizzato e accesso ai propri record reali con ruolo/ambito, senza
 * sceglierne arbitrariamente una».
 */
create or replace function public.fetch_my_club_role_requests(p_club_id uuid)
returns table (
  request_id    uuid,
  role_label    text,
  context_label text,
  status        text,
  created_at    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    public.club_assignment_role_label(r.structured_role_id, r.custom_role_name),
    case when r.scope_type = 'society' then 'Intera società' else ct.name end,
    r.status,
    r.created_at
  from public.club_role_requests r
  left join public.club_teams ct on ct.id = r.team_id
  where r.club_id = p_club_id
    and r.profile_id = auth.uid()
    and r.status = 'pending'
  order by r.created_at desc, r.id;
$$;

revoke all on function public.fetch_my_club_role_requests(uuid) from public;
grant execute on function public.fetch_my_club_role_requests(uuid) to authenticated;

/**
 * Annullamento personale (§19).
 *
 * «La conferma rivalida ownership, request_id, versione e PENDING.
 * Transizione atomica a CANCELLED_BY_USER; conserva cancelled_at,
 * resolved_at quando previsto e storia. Nessun hard delete e nessun termine
 * di un incarico eventualmente già esistente per altro motivo.»
 *
 * Il `for update` è la sezione critica fra annullamento, approvazione e
 * rifiuto: §19 — «Se un'approvazione ha vinto la race, non cancellare la
 * membership per simulare l'annullamento». Chi perde rilegge, non applica.
 */
create or replace function public.cancel_my_role_request(
  p_request_id        uuid,
  p_expected_revision integer default null,
  p_idempotency_key   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_req         public.club_role_requests%rowtype;
  v_fingerprint text;
  v_replay      jsonb;
  v_result      jsonb;
  v_now         timestamptz;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_req
  from public.club_role_requests
  where id = p_request_id;

  if v_req.id is null or v_req.profile_id <> v_uid then
    raise exception 'ROLE_REQUEST_NOT_FOUND';
  end if;

  v_fingerprint := md5('cancel_my_role_request|' || p_request_id::text);

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, v_req.club_id, 'cancel_my_role_request', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_req
  from public.club_role_requests
  where id = p_request_id
  for update;

  if v_req.status <> 'pending' then
    /* Un retry su un record già terminale restituisce l'esito reale, non un
       errore e non un secondo annullamento (§19, QA-065). */
    return jsonb_build_object(
      'request_id', p_request_id,
      'status', v_req.status,
      'revision', v_req.revision,
      'already_applied', true
    );
  end if;

  if p_expected_revision is not null and p_expected_revision <> v_req.revision then
    raise exception 'ROLE_REQUEST_REVISION_CONFLICT';
  end if;

  v_now := timezone('utc', now());

  update public.club_role_requests
  set status       = 'cancelled',
      cancelled_at = v_now,
      resolved_at  = v_now,
      revision     = revision + 1
  where id = p_request_id;

  insert into public.club_role_link_audit
    (club_id, profile_id, request_id, actor_id, actor_side, operation,
     previous_state, next_state)
  values (
    v_req.club_id, v_uid, p_request_id, v_uid, 'person', 'request_cancel',
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'cancelled')
  );

  v_result := jsonb_build_object(
    'request_id', p_request_id,
    'status', 'cancelled',
    'revision', v_req.revision + 1,
    'already_applied', false
  );

  perform public.club_relationship_operation_record(
    p_idempotency_key, v_req.club_id, 'cancel_my_role_request',
    v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.cancel_my_role_request(uuid, integer, text) from public;
grant execute on function public.cancel_my_role_request(uuid, integer, text) to authenticated;

comment on function public.cancel_my_role_request(uuid, integer, text) is
  'DAS-REV-21 §19: annullamento personale. Nessun hard delete, nessun '
  'effetto su incarichi esistenti per altro motivo.';


-- ============================================================
-- SEZIONE 15 — Il Centro esistente ospita le richieste reali (§20)
--
-- «Riutilizza Inviti e richieste con tab Inviti inviati | Richieste
-- ricevute … Stessa route, composizione, filtri, paginazione e contesto
-- Society di DAS-REV-19. Aggiungi le azioni di risoluzione nel dettaglio già
-- predisposto.» Nessun secondo Centro, nessuna inbox parallela (§3).
--
-- Le due funzioni del Centro vengono riscritte per unire alle righe
-- `self_request` legacy le `club_role_requests` canoniche. Le prime restano
-- dove sono: §48 vieta di «reinterpretare record terminali validi», e una
-- richiesta storica senza ruolo strutturato non può essere promossa a
-- proposta canonica inventandone uno.
--
-- `record_kind` le distingue — `request` (legacy, sola lettura) e
-- `role_request` (canonica, risolvibile) — perché la destinazione è diversa
-- e §20 vieta «CTA non funzionanti».
--
-- Il perimetro è quello di `member_requests_view`, applicato riga per riga:
-- §8 — «API, count, filtri, cursori, picker e notifiche rispettano la
-- stessa restrizione; non restituire dati per poi nasconderli nel client».
-- ============================================================

create or replace function public.fetch_society_invites_center(p_club_id uuid)
returns table (
  club_id                uuid,
  club_name              text,
  club_logo_url          text,
  club_is_verified       boolean,
  can_view_sent          boolean,
  can_view_requests      boolean,
  can_invite             boolean,
  can_cancel             boolean,
  sent_pending_count     integer,
  requests_pending_count integer,
  scope_label            text,
  access_verified_at     timestamptz,
  data_revision          integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_view       boolean;
  v_requests   boolean;
  v_scope      uuid[];
  v_req_scope  uuid[];
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.owns_club(p_club_id)
     and not public.club_access_is_active(p_club_id, v_uid) then
    raise exception 'INVITES_CENTER_NOT_AUTHORIZED';
  end if;

  v_view     := public.member_invite_allows(p_club_id, 'invites_view');
  v_requests := public.member_invite_allows(p_club_id, 'member_requests_view');

  if not v_view and not v_requests then
    raise exception 'INVITES_CENTER_NOT_AUTHORIZED';
  end if;

  v_scope := case when not public.owns_club(p_club_id)
    then public.dashboard_club_capability_scope(p_club_id, 'invites_view') end;
  v_req_scope := case when not public.owns_club(p_club_id)
    then public.dashboard_club_capability_scope(p_club_id, 'member_requests_view') end;

  return query
  select
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    v_view,
    v_requests,
    public.member_invite_allows(p_club_id, 'invites_create'),
    public.member_invite_allows(p_club_id, 'invites_cancel'),

    case when v_view then (
      select count(*)::integer
      from public.club_member_invites inv
      where inv.club_id = p_club_id
        and inv.status = 'pending'
        and (
          v_scope is null
          or (inv.scope_type = 'team' and inv.team_id = any (v_scope))
        )
    ) end,

    /*
     * §45: «I conteggi operativi devono dichiarare un significato unico.»
     * Questo è "pending consultabili nel Centro", e comprende entrambe le
     * sorgenti perché entrambe compaiono nella stessa tab.
     */
    case when v_requests then (
      (
        select count(*)::integer
        from public.club_members cm
        where cm.club_id = p_club_id
          and cm.status = 'pending'
          and cm.added_by = 'self_request'
          and cm.profile_id is not null
          and (
            v_req_scope is null
            or (cm.team_id is not null and cm.team_id = any (v_req_scope))
          )
      )
      +
      (
        select count(*)::integer
        from public.club_role_requests rr
        where rr.club_id = p_club_id
          and rr.status = 'pending'
          and (
            v_req_scope is null
            or (rr.scope_type = 'team' and rr.team_id = any (v_req_scope))
          )
      )
    ) end,

    public.member_invite_scope_label(
      p_club_id,
      case when v_view then 'invites_view' else 'member_requests_view' end
    ),
    timezone('utc', now()),
    1
  from public.clubs c
  where c.id = p_club_id;
end;
$$;

revoke all on function public.fetch_society_invites_center(uuid) from public;
grant execute on function public.fetch_society_invites_center(uuid) to authenticated;

comment on function public.fetch_society_invites_center(uuid) is
  'DAS-REV-19 §12 + DAS-REV-21 §20: il conteggio delle richieste comprende '
  'le proposte canoniche e le righe self_request storiche.';

create or replace function public.fetch_society_invites_page(
  p_club_id    uuid,
  p_tab        text default 'sent',
  p_section    text default 'pending',
  p_scope_mode text default 'all',
  p_team_ids   uuid[] default null,
  p_cursor     text default null,
  p_limit      integer default 20
)
returns table (
  record_id         uuid,
  record_kind       text,
  person_profile_id uuid,
  person_name       text,
  person_avatar_url text,
  role_label        text,
  context_label     text,
  scope_type        text,
  team_id           uuid,
  team_is_inactive  boolean,
  state             text,
  state_at          timestamptz,
  is_unread         boolean,
  sort_key          text,
  next_cursor       text,
  as_of             timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_tab     text := coalesce(p_tab, 'sent');
  v_section text := coalesce(p_section, 'pending');
  v_mode    text := coalesce(p_scope_mode, 'all');
  v_key     text;
  v_limit   integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_scope   uuid[];
  v_filter  uuid[];
  v_as_of   timestamptz;
  v_after   text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_tab not in ('sent', 'received') or v_section not in ('pending', 'recent') then
    raise exception 'INVITES_SECTION_INVALID';
  end if;

  v_key := case when v_tab = 'sent' then 'invites_view' else 'member_requests_view' end;

  if not public.member_invite_allows(p_club_id, v_key) then
    raise exception 'INVITES_CENTER_NOT_AUTHORIZED';
  end if;

  v_scope := case when not public.owns_club(p_club_id)
    then public.dashboard_club_capability_scope(p_club_id, v_key) end;

  v_filter := public.member_invite_filter_teams(p_club_id, v_key, v_mode, p_team_ids);

  if p_cursor is null then
    v_as_of := timezone('utc', now());
    v_after := null;
  else
    select d.as_of, d.sort_key
      into v_as_of, v_after
    from public.member_invites_cursor_decode(
      p_cursor, p_club_id, v_tab, v_section, v_mode, v_filter
    ) d;
  end if;

  return query
  with sent as (
    select
      inv.id                                     as rec_id,
      'invite'::text                             as rec_kind,
      inv.invitee_profile_id                     as person_id,
      inv.scope_type                             as sc_type,
      inv.team_id                                as tm_id,
      inv.status                                 as st,
      case when inv.status = 'pending' then inv.created_at else inv.resolved_at end as st_at,
      coalesce(
        public.club_assignment_role_label(inv.structured_role_id, inv.custom_role_name),
        inv.legacy_role_label
      )                                          as rl_label,
      false                                      as unread
    from public.club_member_invites inv
    where v_tab = 'sent'
      and inv.club_id = p_club_id
      and (
        (v_section = 'pending' and inv.status = 'pending')
        or (v_section = 'recent' and inv.status in ('accepted', 'declined', 'cancelled'))
      )
      and (
        v_scope is null
        or (inv.scope_type = 'team' and inv.team_id = any (v_scope))
      )
      and (
        v_filter is null
        or (inv.scope_type = 'team' and inv.team_id = any (v_filter))
      )
      and case when v_section = 'pending'
               then inv.created_at <= v_as_of
               else inv.resolved_at is not null and inv.resolved_at <= v_as_of
          end
  ),
  /* Richieste canoniche (DAS-REV-21). */
  role_requests as (
    select
      rr.id                                      as rec_id,
      'role_request'::text                       as rec_kind,
      rr.profile_id                              as person_id,
      rr.scope_type                              as sc_type,
      rr.team_id                                 as tm_id,
      case rr.status
        when 'superseded' then 'superseded'
        else rr.status
      end                                        as st,
      case when rr.status = 'pending' then rr.created_at else rr.resolved_at end as st_at,
      public.club_assignment_role_label(rr.structured_role_id, rr.custom_role_name) as rl_label,
      (
        rr.status = 'pending'
        and not exists (
          select 1
          from public.club_role_request_reads rd
          where rd.request_id = rr.id and rd.actor_profile_id = v_uid
        )
      )                                          as unread
    from public.club_role_requests rr
    where v_tab = 'received'
      and rr.club_id = p_club_id
      and (
        (v_section = 'pending' and rr.status = 'pending')
        or (v_section = 'recent' and rr.status <> 'pending')
      )
      and (
        v_scope is null
        or (rr.scope_type = 'team' and rr.team_id = any (v_scope))
      )
      and (
        v_filter is null
        or (rr.scope_type = 'team' and rr.team_id = any (v_filter))
      )
      and case when v_section = 'pending'
               then rr.created_at <= v_as_of
               else rr.resolved_at is not null and rr.resolved_at <= v_as_of
          end
  ),
  /* Richieste storiche `club_members.self_request`, immutate (DAS-REV-19). */
  received as (
    select
      cm.id                                      as rec_id,
      'request'::text                            as rec_kind,
      cm.profile_id                              as person_id,
      case when cm.team_id is null then 'society' else 'team' end as sc_type,
      cm.team_id                                 as tm_id,
      case cm.status
        when 'pending'  then 'pending'
        when 'active'   then 'approved'
        when 'rejected' then 'declined'
        else cm.status
      end                                        as st,
      case when cm.status = 'pending' then cm.created_at else cm.updated_at end as st_at,
      public.club_member_role_label(cm.member_role, cm.staff_title) as rl_label,
      (
        cm.status = 'pending'
        and not exists (
          select 1
          from public.club_member_request_reads rr
          where rr.request_id = cm.id and rr.actor_profile_id = v_uid
        )
      )                                          as unread
    from public.club_members cm
    where v_tab = 'received'
      and cm.club_id = p_club_id
      and cm.added_by = 'self_request'
      and cm.profile_id is not null
      and (
        (v_section = 'pending' and cm.status = 'pending')
        or (v_section = 'recent' and cm.status in ('active', 'rejected'))
      )
      and (
        v_scope is null
        or (cm.team_id is not null and cm.team_id = any (v_scope))
      )
      and (
        v_filter is null
        or (cm.team_id is not null and cm.team_id = any (v_filter))
      )
      and case when v_section = 'pending'
               then cm.created_at <= v_as_of
               else cm.updated_at <= v_as_of
          end
  ),
  unioned as (
    select * from sent
    union all
    select * from role_requests
    union all
    select * from received
  ),
  keyed as (
    select
      u.*,
      /* §20: pending non lette per l'actor prima, poi recency; tie-breaker
         ID stabile. Identico a DAS-REV-19 §13 — le richieste canoniche
         entrano nello stesso ordinamento, non in una lista a parte. */
      (case when u.rec_kind in ('request', 'role_request') and u.unread then '0' else '1' end)
      || '|' || lpad(
           (9999999999999
            - coalesce((extract(epoch from u.st_at) * 1000)::bigint, 0))::text,
           13, '0')
      || '|' || u.rec_id::text
        as k
    from unioned u
  )
  select
    k.rec_id,
    k.rec_kind,
    k.person_id,
    p.full_name,
    p.avatar_url,
    k.rl_label,
    case when k.sc_type = 'society' then 'Intera società' else ct.name end,
    k.sc_type,
    k.tm_id,
    coalesce(ct.is_archived, false),
    k.st,
    k.st_at,
    k.unread,
    k.k,
    public.member_invites_cursor_encode(
      p_club_id, v_tab, v_section, v_mode, v_filter, v_as_of, k.k
    ),
    v_as_of
  from keyed k
  join public.profiles p on p.id = k.person_id
  left join public.club_teams ct on ct.id = k.tm_id
  where v_after is null or k.k > v_after
  order by k.k
  limit v_limit;
end;
$$;

revoke all on function public.fetch_society_invites_page(uuid, text, text, text, uuid[], text, integer) from public;
grant execute on function public.fetch_society_invites_page(uuid, text, text, text, uuid[], text, integer) to authenticated;

comment on function public.fetch_society_invites_page(uuid, text, text, text, uuid[], text, integer) is
  'DAS-REV-19 §13-§14 + DAS-REV-21 §20: la tab Richieste ricevute unisce le '
  'proposte canoniche e le righe self_request storiche, stesso ordinamento.';


-- ============================================================
-- SEZIONE 16 — Dettaglio societario della richiesta (§21, §24)
--
-- «Mostra contesto AC Como, titolo Richiesta di conferma del ruolo,
-- avatar/nome della persona e azione Visualizza profilo. La sezione Ruolo da
-- confermare presenta esattamente categoria, ruolo specifico quando previsto
-- e Team/ambito della proposta.»
--
-- `can_resolve` e `unavailable_reason` arrivano dal server, non da un
-- generico "sono admin": §21 — «CTA Approva primaria e Rifiuta secondaria,
-- soltanto per richiesta ancora risolvibile e actor autorizzato».
--
-- §24 distingue tre indisponibilità che la UI deve saper dire a parole
-- diverse: la proposta è terminale, la squadra non è più assegnabile,
-- l'esito è arrivato da un altro percorso.
-- ============================================================

create or replace function public.fetch_society_role_request(p_request_id uuid)
returns table (
  request_id         uuid,
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  club_is_verified   boolean,
  person_profile_id  uuid,
  person_name        text,
  person_avatar_url  text,
  profile_type       text,
  role_label         text,
  scope_type         text,
  team_id            uuid,
  context_label      text,
  status             text,
  revision           integer,
  created_at         timestamptz,
  resolved_at        timestamptz,
  is_unread          boolean,
  can_resolve        boolean,
  team_unavailable   boolean,
  can_view_person    boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.club_role_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_req
  from public.club_role_requests r
  where r.id = p_request_id;

  if v_req.id is null then
    raise exception 'ROLE_REQUEST_NOT_FOUND';
  end if;

  /* §47: l'accesso per ID arbitrario è bloccato prima di qualsiasi dato.
     La lettura richiede capability **e** scope sull'ambito della proposta. */
  if not public.member_invite_allows(
       p_club_id => v_req.club_id,
       p_key     => 'member_requests_view',
       p_scope_type => v_req.scope_type,
       p_team_id => v_req.team_id
     )
  then
    raise exception 'ROLE_REQUEST_NOT_FOUND';
  end if;

  return query
  select
    v_req.id,
    v_req.club_id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    v_req.profile_id,
    p.full_name,
    p.avatar_url,
    v_req.profile_type,
    public.club_assignment_role_label(v_req.structured_role_id, v_req.custom_role_name),
    v_req.scope_type,
    v_req.team_id,
    case when v_req.scope_type = 'society' then 'Intera società' else ct.name end,
    v_req.status,
    v_req.revision,
    v_req.created_at,
    v_req.resolved_at,
    v_req.status = 'pending'
      and not exists (
        select 1 from public.club_role_request_reads rd
        where rd.request_id = v_req.id and rd.actor_profile_id = v_uid
      ),
    v_req.status = 'pending'
      and public.member_invite_allows(
            v_req.club_id, 'member_requests_resolve', v_req.scope_type, v_req.team_id
          ),
    v_req.scope_type = 'team'
      and not public.club_team_is_assignable(v_req.club_id, v_req.team_id),
    /* §21: il profilo live segue le regole globali di disponibilità. Il
       link gestionale non è una scorciatoia per aprirne uno bloccato. */
    not exists (
      select 1 from public.user_blocks b
      where (b.blocker_profile_id = v_uid and b.blocked_profile_id = v_req.profile_id)
         or (b.blocker_profile_id = v_req.profile_id and b.blocked_profile_id = v_uid)
    )
  from public.clubs c
  join public.profiles p on p.id = v_req.profile_id
  left join public.club_teams ct on ct.id = v_req.team_id
  where c.id = v_req.club_id;
end;
$$;

revoke all on function public.fetch_society_role_request(uuid) from public;
grant execute on function public.fetch_society_role_request(uuid) to authenticated;

/**
 * §17: «Marca la lettura mediante comando idempotente dopo l'apertura
 * riuscita del dettaglio, non con GET del Centro, prefetch o scroll.»
 * Per actor, e senza toccare il lifecycle.
 */
create or replace function public.mark_society_role_request_read(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.club_role_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_req
  from public.club_role_requests r
  where r.id = p_request_id;

  if v_req.id is null then
    raise exception 'ROLE_REQUEST_NOT_FOUND';
  end if;

  if not public.member_invite_allows(
       v_req.club_id, 'member_requests_view', v_req.scope_type, v_req.team_id
     )
  then
    raise exception 'ROLE_REQUEST_NOT_FOUND';
  end if;

  insert into public.club_role_request_reads (request_id, actor_profile_id, club_id)
  values (p_request_id, v_uid, v_req.club_id)
  on conflict (request_id, actor_profile_id) do nothing;
end;
$$;

revoke all on function public.mark_society_role_request_read(uuid) from public;
grant execute on function public.mark_society_role_request_read(uuid) to authenticated;


-- ============================================================
-- SEZIONE 17 — Approvazione atomica (§22, screen 12)
--
-- «Approva è one tap.» Gli otto passi di §22 in una transazione:
--
--   1-2 actor, guard e rivalidazione di PENDING, versione, capability,
--       scope, identità professionale, ruolo, ambito e Team;
--   3   se l'incarico equivalente esiste già, risoluzione **neutra**: §22
--       — «applica in tal caso la risoluzione neutra, senza fingere una
--       nuova approvazione»;
--   4   membership riusata, mai duplicata;
--   5   incarico nuovo con source ROLE_CONFIRMATION_REQUEST e request_id;
--   6-7 richiesta APPROVED con resolved_at e actor, proiezioni e notifica;
--   8   commit atomico ed esito canonico.
--
-- Il `for update` sulla richiesta è la sezione critica fra approvazione,
-- rifiuto e annullamento (§23: «Approva/Rifiuta da due amministratori devono
-- convergere su una sola decisione»).
-- ============================================================

create or replace function public.approve_role_request(
  p_request_id        uuid,
  p_expected_revision integer default null,
  p_idempotency_key   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_req         public.club_role_requests%rowtype;
  v_fingerprint text;
  v_replay      jsonb;
  v_membership  uuid;
  v_assignment  uuid;
  v_lineage     uuid;
  v_existing    uuid;
  v_now         timestamptz;
  v_result      jsonb;
  v_label       text;
  v_context     text;
  v_club_name   text;
  v_person      text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_req from public.club_role_requests where id = p_request_id;

  if v_req.id is null then
    raise exception 'ROLE_REQUEST_NOT_FOUND';
  end if;

  if not public.member_invite_allows(
       v_req.club_id, 'member_requests_resolve', v_req.scope_type, v_req.team_id
     )
  then
    raise exception 'ROLE_REQUEST_NOT_AUTHORIZED';
  end if;

  v_fingerprint := md5('approve_role_request|' || p_request_id::text);

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, v_req.club_id, 'approve_role_request', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_req
  from public.club_role_requests
  where id = p_request_id
  for update;

  if v_req.status <> 'pending' then
    /* §22: «Retry già applicato restituisce lo stesso risultato storico e
       stato corrente del rapporto. Non ricrea il ruolo se nel frattempo è
       stato rimosso.» */
    return jsonb_build_object(
      'request_id', p_request_id,
      'status', v_req.status,
      'revision', v_req.revision,
      'assignment_id', v_req.resolved_assignment_id,
      'already_applied', true
    );
  end if;

  if p_expected_revision is not null and p_expected_revision <> v_req.revision then
    raise exception 'ROLE_REQUEST_REVISION_CONFLICT';
  end if;

  /* §22.2: i dati professionali devono esistere ancora al commit. */
  if not (v_req.profile_type = any (public.person_professional_identities(v_req.profile_id))) then
    raise exception 'ROLE_REQUEST_PROFILE_INVALID';
  end if;

  /* §25: una squadra disattivata non riceve approvazioni (QA-163). */
  if v_req.scope_type = 'team'
     and not public.club_team_is_assignable(v_req.club_id, v_req.team_id)
  then
    raise exception 'ROLE_REQUEST_TEAM_UNAVAILABLE';
  end if;

  v_now := timezone('utc', now());

  /* §22.3: l'incarico equivalente creato altrove vince e la proposta si
     chiude neutra. `resolved_by` resta nullo: nessuno ha approvato. */
  v_existing := public.club_equivalent_active_assignment(
    v_req.club_id, v_req.profile_id, v_req.profile_type,
    v_req.structured_role_id, v_req.custom_role_name,
    v_req.scope_type, v_req.team_id
  );

  if v_existing is not null then
    select a.lineage_id, a.membership_id into v_lineage, v_membership
    from public.club_member_assignments a where a.id = v_existing;

    update public.club_role_requests
    set status                 = 'superseded',
        resolved_at            = v_now,
        resolved_assignment_id = v_existing,
        resolved_lineage_id    = v_lineage,
        membership_id          = v_membership,
        revision               = revision + 1
    where id = p_request_id;

    v_result := jsonb_build_object(
      'request_id', p_request_id,
      'status', 'superseded',
      'revision', v_req.revision + 1,
      'assignment_id', v_existing,
      'already_applied', false
    );

    perform public.club_relationship_operation_record(
      p_idempotency_key, v_req.club_id, 'approve_role_request',
      v_fingerprint, v_result
    );

    return v_result;
  end if;

  /* §22.4-5 */
  v_membership := public.club_membership_ensure(
    v_req.club_id, v_req.profile_id, v_req.profile_type, 'self_request'
  );

  v_assignment := public.club_assignment_open_segment(
    p_club_id           => v_req.club_id,
    p_membership_id     => v_membership,
    p_profile_id        => v_req.profile_id,
    p_profile_type      => v_req.profile_type,
    p_role_id           => v_req.structured_role_id,
    p_custom            => v_req.custom_role_name,
    p_scope_type        => v_req.scope_type,
    p_team_id           => v_req.team_id,
    p_change_source     => 'initial',
    p_actor_id          => v_uid,
    p_source_type       => 'role_confirmation_request',
    p_source_request_id => p_request_id
  );

  select a.lineage_id into v_lineage
  from public.club_member_assignments a where a.id = v_assignment;

  /* §22.6 */
  update public.club_role_requests
  set status                 = 'approved',
      resolved_at            = v_now,
      resolved_by            = v_uid,
      resolved_assignment_id = v_assignment,
      resolved_lineage_id    = v_lineage,
      membership_id          = v_membership,
      revision               = revision + 1
  where id = p_request_id;

  /* §22.7 e §40: proiezioni canoniche nella stessa transazione. */
  perform public.club_membership_sync_projection(v_membership);

  v_label := public.club_assignment_role_label(
    v_req.structured_role_id, v_req.custom_role_name
  );
  v_context := case
    when v_req.scope_type = 'society' then 'Intera società'
    else (select ct.name from public.club_teams ct where ct.id = v_req.team_id)
  end;

  select c.name into v_club_name from public.clubs c where c.id = v_req.club_id;
  select p.full_name into v_person from public.profiles p where p.id = v_req.profile_id;

  insert into public.club_role_link_audit
    (club_id, profile_id, request_id, assignment_id, lineage_id, actor_id,
     actor_side, operation, previous_state, next_state)
  values (
    v_req.club_id, v_req.profile_id, p_request_id, v_assignment, v_lineage, v_uid,
    'society', 'request_approve',
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'approved', 'assignment_id', v_assignment)
  );

  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    v_req.profile_id,
    'role_request_approved',
    coalesce(v_club_name, 'La società'),
    'Ha confermato il tuo ruolo' || chr(10) || v_label || ' · ' || coalesce(v_context, ''),
    jsonb_build_object(
      'club_id', v_req.club_id,
      'request_id', p_request_id,
      'assignment_id', v_assignment,
      'role_label', v_label,
      'context_label', v_context
    )
  );

  v_result := jsonb_build_object(
    'request_id', p_request_id,
    'status', 'approved',
    'revision', v_req.revision + 1,
    'assignment_id', v_assignment,
    'person_name', v_person,
    'role_label', v_label,
    'context_label', v_context,
    'already_applied', false
  );

  perform public.club_relationship_operation_record(
    p_idempotency_key, v_req.club_id, 'approve_role_request',
    v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.approve_role_request(uuid, integer, text) from public;
grant execute on function public.approve_role_request(uuid, integer, text) to authenticated;

comment on function public.approve_role_request(uuid, integer, text) is
  'DAS-REV-21 §22: approvazione atomica. Mai APPROVED senza incarico, mai '
  'incarico nuovo con richiesta ancora PENDING.';


-- ============================================================
-- SEZIONE 18 — Rifiuto (§23, screen 11)
--
-- «La mutation verifica permission ∩ scope, versione e PENDING. Transizione
-- a DECLINED con resolved_at/actor, nessun nuovo incarico, nessun hard
-- delete.» Nessun motivo richiesto, nessuna seconda conferma: lo sheet è
-- l'unica.
-- ============================================================

create or replace function public.decline_role_request(
  p_request_id        uuid,
  p_expected_revision integer default null,
  p_idempotency_key   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_req         public.club_role_requests%rowtype;
  v_fingerprint text;
  v_replay      jsonb;
  v_result      jsonb;
  v_now         timestamptz;
  v_label       text;
  v_context     text;
  v_club_name   text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_req from public.club_role_requests where id = p_request_id;

  if v_req.id is null then
    raise exception 'ROLE_REQUEST_NOT_FOUND';
  end if;

  if not public.member_invite_allows(
       v_req.club_id, 'member_requests_resolve', v_req.scope_type, v_req.team_id
     )
  then
    raise exception 'ROLE_REQUEST_NOT_AUTHORIZED';
  end if;

  v_fingerprint := md5('decline_role_request|' || p_request_id::text);

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, v_req.club_id, 'decline_role_request', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_req
  from public.club_role_requests
  where id = p_request_id
  for update;

  if v_req.status <> 'pending' then
    return jsonb_build_object(
      'request_id', p_request_id,
      'status', v_req.status,
      'revision', v_req.revision,
      'already_applied', true
    );
  end if;

  if p_expected_revision is not null and p_expected_revision <> v_req.revision then
    raise exception 'ROLE_REQUEST_REVISION_CONFLICT';
  end if;

  v_now := timezone('utc', now());

  update public.club_role_requests
  set status      = 'declined',
      resolved_at = v_now,
      resolved_by = v_uid,
      revision    = revision + 1
  where id = p_request_id;

  v_label := public.club_assignment_role_label(
    v_req.structured_role_id, v_req.custom_role_name
  );
  v_context := case
    when v_req.scope_type = 'society' then 'Intera società'
    else (select ct.name from public.club_teams ct where ct.id = v_req.team_id)
  end;

  select c.name into v_club_name from public.clubs c where c.id = v_req.club_id;

  insert into public.club_role_link_audit
    (club_id, profile_id, request_id, actor_id, actor_side, operation,
     previous_state, next_state)
  values (
    v_req.club_id, v_req.profile_id, p_request_id, v_uid, 'society',
    'request_decline',
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'declined')
  );

  /* §23: «La persona riceve una notifica coerente; non esporre un errore
     tecnico né suggerire un blocco permanente.» */
  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    v_req.profile_id,
    'role_request_declined',
    coalesce(v_club_name, 'La società'),
    'Ha rifiutato la tua richiesta di conferma del ruolo' || chr(10)
      || v_label || ' · ' || coalesce(v_context, ''),
    jsonb_build_object(
      'club_id', v_req.club_id,
      'request_id', p_request_id,
      'role_label', v_label,
      'context_label', v_context
    )
  );

  v_result := jsonb_build_object(
    'request_id', p_request_id,
    'status', 'declined',
    'revision', v_req.revision + 1,
    'already_applied', false
  );

  perform public.club_relationship_operation_record(
    p_idempotency_key, v_req.club_id, 'decline_role_request',
    v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.decline_role_request(uuid, integer, text) from public;
grant execute on function public.decline_role_request(uuid, integer, text) to authenticated;


-- ============================================================
-- SEZIONE 19 — Società e ruoli lato persona (§26, §27, §28)
--
-- Tre letture per tre livelli, e i livelli non si confondono: la lista delle
-- società, il rapporto con una società, il singolo incarico. §27 — «Non
-- inserire un generico Modifica ruolo senza identificare quale incarico
-- sarebbe modificato».
--
-- `fetch_my_societies` raggruppa per società, non per incarico: §26 — «Non
-- ripetere AC Como per ogni assignment». Il conteggio «riguarda incarichi
-- correnti distinti, non candidature, richieste, vecchi segmenti o più
-- consegne dello stesso invito»: il filtro è `status = 'active'`, e un
-- segmento sostituito è `ended`.
--
-- Nessuna delle tre espone source, date amministrative, audit o stati
-- tecnici (§27, §40).
-- ============================================================

create or replace function public.fetch_my_societies()
returns table (
  club_id          uuid,
  club_name        text,
  club_logo_url    text,
  club_is_verified boolean,
  club_city        text,
  active_count     integer,
  role_lines       text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select
      a.club_id,
      a.created_at,
      a.id,
      public.club_assignment_role_label(a.structured_role_id, a.custom_role_name)
      || ' · '
      || case when a.scope_type = 'society' then 'Intera società' else ct.name end
        as line
    from public.club_member_assignments a
    left join public.club_teams ct on ct.id = a.team_id
    where a.profile_id = auth.uid()
      and a.status = 'active'
  )
  select
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    c.city,
    count(*)::integer,
    /* Ordinamento stabile (§26): per data di creazione, poi ID. */
    array_agg(m.line order by m.created_at, m.id)
  from mine m
  join public.clubs c on c.id = m.club_id
  group by c.id, c.name, c.logo_url, c.verification_status, c.city
  order by c.name, c.id;
$$;

revoke all on function public.fetch_my_societies() from public;
grant execute on function public.fetch_my_societies() to authenticated;

create or replace function public.fetch_my_society_roles(p_club_id uuid)
returns table (
  club_id          uuid,
  club_name        text,
  club_logo_url    text,
  club_is_verified boolean,
  club_city        text,
  membership_id    uuid,
  aggregate_revision integer,
  assignment_id    uuid,
  lineage_id       uuid,
  profile_type     text,
  role_label       text,
  scope_type       text,
  team_id          uuid,
  context_label    text,
  team_is_inactive boolean,
  revision         integer,
  active_count     integer
)
language plpgsql
stable
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

  select count(*)::integer into v_count
  from public.club_member_assignments a
  where a.club_id = p_club_id
    and a.profile_id = v_uid
    and a.status = 'active';

  return query
  select
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    c.city,
    cm.id,
    cm.assignments_revision,
    a.id,
    a.lineage_id,
    a.profile_type,
    public.club_assignment_role_label(a.structured_role_id, a.custom_role_name),
    a.scope_type,
    a.team_id,
    case when a.scope_type = 'society' then 'Intera società' else ct.name end,
    coalesce(ct.is_archived, false),
    a.revision,
    v_count
  from public.club_member_assignments a
  join public.clubs c on c.id = a.club_id
  left join public.club_members cm on cm.id = a.membership_id
  left join public.club_teams ct on ct.id = a.team_id
  where a.club_id = p_club_id
    and a.profile_id = v_uid
    and a.status = 'active'
  order by a.created_at, a.id;
end;
$$;

revoke all on function public.fetch_my_society_roles(uuid) from public;
grant execute on function public.fetch_my_society_roles(uuid) to authenticated;

/**
 * Dettaglio del singolo incarico, lato persona (§28).
 *
 * «Se un link profondo punta a un segmento superato da una modifica,
 * risolvi il successore autorizzato o mostra il contesto storico corretto;
 * non inviare mutate a un record ENDED fingendo che sia ancora attivo.»
 *
 * La risoluzione è per linea: dall'ID ricevuto si risale a `lineage_id` e si
 * restituisce il segmento **attivo** di quella linea quando esiste. Se non
 * esiste, il record storico viene restituito con `can_manage` falso — §28:
 * «Se la linea è terminata senza successore, mostra l'esito corrente senza
 * Modifica/Rimuovi attivi».
 */
create or replace function public.fetch_my_assignment(p_assignment_id uuid)
returns table (
  assignment_id    uuid,
  requested_id     uuid,
  lineage_id       uuid,
  club_id          uuid,
  club_name        text,
  club_logo_url    text,
  club_is_verified boolean,
  profile_type     text,
  profile_type_label text,
  role_id          text,
  custom_role_name text,
  role_label       text,
  scope_type       text,
  team_id          uuid,
  context_label    text,
  team_is_inactive boolean,
  status           text,
  revision         integer,
  can_manage       boolean,
  other_active_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_seed    public.club_member_assignments%rowtype;
  v_current public.club_member_assignments%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_seed
  from public.club_member_assignments a
  where a.id = p_assignment_id;

  if v_seed.id is null or v_seed.profile_id <> v_uid then
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;

  select * into v_current
  from public.club_member_assignments a
  where a.lineage_id = v_seed.lineage_id
    and a.status = 'active';

  if v_current.id is null then
    v_current := v_seed;
  end if;

  return query
  select
    v_current.id,
    p_assignment_id,
    v_current.lineage_id,
    v_current.club_id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    v_current.profile_type,
    case v_current.profile_type
      when 'player' then 'Calciatore' when 'coach' then 'Allenatore'
      when 'staff' then 'Staff' else 'Dirigente' end,
    v_current.structured_role_id,
    v_current.custom_role_name,
    public.club_assignment_role_label(
      v_current.structured_role_id, v_current.custom_role_name
    ),
    v_current.scope_type,
    v_current.team_id,
    case when v_current.scope_type = 'society' then 'Intera società' else ct.name end,
    coalesce(ct.is_archived, false),
    v_current.status,
    v_current.revision,
    v_current.status = 'active',
    (
      select count(*)::integer
      from public.club_member_assignments o
      where o.club_id = v_current.club_id
        and o.profile_id = v_uid
        and o.status = 'active'
        and o.lineage_id <> v_current.lineage_id
    )
  from public.clubs c
  left join public.club_teams ct on ct.id = v_current.team_id
  where c.id = v_current.club_id;
end;
$$;

revoke all on function public.fetch_my_assignment(uuid) from public;
grant execute on function public.fetch_my_assignment(uuid) to authenticated;


-- ============================================================
-- SEZIONE 20 — Mutazioni condivise persona/società (§29, §30, §31)
--
-- «Utilizza un unico modello di configurazione, con modalità e permessi
-- espliciti, condiviso fra persona e società. Non creare quattro form per
-- categoria moltiplicati per due actor.» Il principio vale anche sotto: una
-- mutation per verbo, non due.
--
-- Il lato dell'actor **non arriva dal payload**: lo decide il server
-- confrontando `auth.uid()` con il proprietario dell'incarico. §8 — «Il
-- person_id delle azioni personali deriva dalla sessione; non fidarti di un
-- person_id arbitrario nel payload». Ed è anche la regola di §6: chi
-- amministra AC Como e vi gioca resta PERSON quando tocca il proprio ruolo.
--
-- Lato Società l'autorizzazione è doppia quando l'incarico si sposta: §8 —
-- «Per cambiare Team o passare da TEAM a SOCIETY occorre autorità sia
-- sull'incarico precedente sia sulla destinazione completa».
--
-- Una differenza importante dalla richiesta iniziale: qui **non** si
-- verifica l'identità professionale della PERSON. §10 lo chiede
-- esplicitamente — «Nella gestione di un rapporto già attivo il campo Tipo
-- di ruolo può invece evolvere l'incarico tra le quattro categorie … Non
-- impedire la modifica prevista solo per riutilizzare un enum sbagliato, né
-- mutare in silenzio dati personali/professionali per farla passare».
-- L'incarico nella società e il profilo professionale sono due cose.
-- ============================================================

/**
 * Validazione della forma di un incarico (§9).
 *
 * Una funzione sola, usata da modifica, aggiunta e ripristino: tre copie
 * della matrice categoria/ruolo/ambito sono tre matrici.
 */
create or replace function public.club_assignment_validate_shape(
  p_club_id      uuid,
  p_profile_type text,
  p_role_id      text,
  p_custom       text,
  p_scope_type   text,
  p_team_id      uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role   public.club_assignment_roles%rowtype;
  v_custom text;
begin
  if p_profile_type not in ('player', 'coach', 'staff', 'director') then
    raise exception 'ASSIGNMENT_PROFILE_INVALID';
  end if;

  select * into v_role
  from public.club_assignment_roles
  where id = p_role_id and is_available;

  if v_role.id is null or v_role.profile_type <> p_profile_type then
    raise exception 'ASSIGNMENT_ROLE_INVALID';
  end if;

  v_custom := public.normalize_assignment_custom_role(p_custom);

  if v_role.is_custom then
    if v_custom is null then
      raise exception 'ASSIGNMENT_CUSTOM_ROLE_REQUIRED';
    end if;

    if length(v_custom) > public.club_assignment_custom_role_max() then
      raise exception 'ASSIGNMENT_CUSTOM_ROLE_TOO_LONG';
    end if;
  else
    /* §9: «Se cambia categoria, elimina soltanto i campi incompatibili del
       draft, senza riutilizzare inconsapevolmente un ruolo Staff come ruolo
       Dirigente.» Lo stesso vale al commit. */
    v_custom := null;
  end if;

  if p_scope_type not in ('team', 'society') then
    raise exception 'ASSIGNMENT_SCOPE_INVALID';
  end if;

  /* §9: l'ambito societario appartiene al Dirigente. */
  if p_scope_type = 'society' and p_profile_type <> 'director' then
    raise exception 'ASSIGNMENT_SCOPE_INVALID';
  end if;

  if p_scope_type = 'team' then
    if p_team_id is null then
      raise exception 'ASSIGNMENT_TEAM_REQUIRED';
    end if;

    if not public.club_team_is_assignable(p_club_id, p_team_id) then
      raise exception 'ASSIGNMENT_TEAM_UNAVAILABLE';
    end if;
  end if;

  return v_custom;
end;
$$;

revoke all on function public.club_assignment_validate_shape(uuid, text, text, text, text, uuid) from public;

/**
 * §8: autorità societaria su un ambito. Separata perché modifica e
 * ripristino la chiedono **due volte** — origine e destinazione.
 */
create or replace function public.club_assignment_society_allows(
  p_club_id    uuid,
  p_scope_type text,
  p_team_id    uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.member_invite_allows(
    p_club_id, 'assignments_manage', p_scope_type, p_team_id
  );
$$;

revoke all on function public.club_assignment_society_allows(uuid, text, uuid) from public;

/**
 * Notifica dell'altra parte (§41).
 *
 * Destinatario unico e deduplicato: la persona quando decide la Società,
 * l'Owner quando decide la persona. §41 vieta «il diff completo a un admin
 * che può vedere solo il Team precedente o quello nuovo»; l'Owner ha
 * sempre il perimetro completo, e gli amministratori con capability
 * leggono le superfici gestionali, che il perimetro lo applicano riga per
 * riga. Un fan-out per amministratore richiederebbe un contesto diverso per
 * ciascuno, ed è proprio ciò che §41 non vuole improvvisato qui.
 */
create or replace function public.club_role_link_notify(
  p_club_id    uuid,
  p_profile_id uuid,
  p_actor_side text,
  p_type       text,
  p_headline   text,
  p_detail     text,
  p_data       jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
  v_title     text;
begin
  if p_actor_side = 'society' then
    v_recipient := p_profile_id;
    select c.name into v_title from public.clubs c where c.id = p_club_id;
  else
    select c.owner_profile_id into v_recipient from public.clubs c where c.id = p_club_id;
    select p.full_name into v_title from public.profiles p where p.id = p_profile_id;
  end if;

  if v_recipient is null then
    return;
  end if;

  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    v_recipient,
    p_type,
    coalesce(v_title, 'PROLINK'),
    p_headline || case when p_detail is null then '' else chr(10) || p_detail end,
    p_data || jsonb_build_object('club_id', p_club_id, 'profile_id', p_profile_id)
  );
end;
$$;

revoke all on function public.club_role_link_notify(uuid, uuid, text, text, text, text, jsonb) from public;

/**
 * Modifica di un incarico (§29, §30, screen 16 e 22).
 *
 * «Termina il segmento precedente con ended_at e causa ROLE_CHANGED; crea il
 * successore attivo nella stessa linea, con valori nuovi e riferimenti di
 * origine; registra actor, prima/dopo, timestamp e versione; aggiorna
 * proiezioni, aggregati e outbox nella stessa transazione logica.»
 *
 * «Salvataggio senza modifiche semantiche: restituisci lo stato corrente
 * senza creare un segmento, notifiche o audit di cambiamento fittizi.»
 */
create or replace function public.update_member_assignment(
  p_assignment_id     uuid,
  p_profile_type      text,
  p_role_id           text,
  p_custom_role       text default null,
  p_scope_type        text default 'team',
  p_team_id           uuid default null,
  p_expected_revision integer default null,
  p_idempotency_key   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_cur         public.club_member_assignments%rowtype;
  v_side        text;
  v_custom      text;
  v_team        uuid;
  v_fingerprint text;
  v_replay      jsonb;
  v_new         uuid;
  v_conflict    uuid;
  v_result      jsonb;
  v_old_label   text;
  v_new_label   text;
  v_new_context text;
  v_closed      boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_cur
  from public.club_member_assignments a
  where a.id = p_assignment_id;

  if v_cur.id is null then
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;

  v_side := case when v_cur.profile_id = v_uid then 'person' else 'society' end;

  if v_side = 'society' then
    /* §8: autorità sull'incarico **precedente**… */
    if not public.club_assignment_society_allows(
         v_cur.club_id, v_cur.scope_type, v_cur.team_id
       )
    then
      raise exception 'ASSIGNMENT_NOT_AUTHORIZED';
    end if;
  end if;

  v_custom := public.club_assignment_validate_shape(
    v_cur.club_id, p_profile_type, p_role_id, p_custom_role, p_scope_type, p_team_id
  );

  v_team := case when p_scope_type = 'team' then p_team_id end;

  /* …e sulla **destinazione completa**. Un admin della Primavera non sposta
     un incarico sulla Prima squadra né lo promuove a societario (QA-117,
     QA-118). */
  if v_side = 'society'
     and not public.club_assignment_society_allows(v_cur.club_id, p_scope_type, v_team)
  then
    raise exception 'ASSIGNMENT_NOT_AUTHORIZED';
  end if;

  v_fingerprint := md5(
    'update_member_assignment|' || p_assignment_id::text || '|' || p_profile_type
    || '|' || p_role_id || '|' || coalesce(lower(v_custom), '')
    || '|' || p_scope_type || '|' || coalesce(v_team::text, '')
  );

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, v_cur.club_id, 'update_member_assignment', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  /* Sezione critica: la riga della membership ordina modifica, aggiunta,
     rimozione e termine completo sullo stesso rapporto (§30, §36). */
  perform 1 from public.club_members where id = v_cur.membership_id for update;

  select * into v_cur
  from public.club_member_assignments a
  where a.id = p_assignment_id
  for update;

  if v_cur.status <> 'active' then
    raise exception 'ASSIGNMENT_NOT_ACTIVE';
  end if;

  if p_expected_revision is not null and p_expected_revision <> v_cur.revision then
    raise exception 'ASSIGNMENT_REVISION_CONFLICT';
  end if;

  /* §30: nessuna differenza semantica, nessun segmento. La normalizzazione
     di sola forma non simula un nuovo ruolo. */
  if v_cur.profile_type = p_profile_type
     and v_cur.structured_role_id = p_role_id
     and coalesce(lower(v_cur.custom_role_name), '') = coalesce(lower(v_custom), '')
     and v_cur.scope_type = p_scope_type
     and v_cur.team_id is not distinct from v_team
  then
    return jsonb_build_object(
      'assignment_id', v_cur.id,
      'lineage_id', v_cur.lineage_id,
      'revision', v_cur.revision,
      'changed', false
    );
  end if;

  /* §30: «Se il ruolo di destinazione è già attivo in un'altra linea
     equivalente, blocca … Non fondere, eliminare o terminare uno dei due
     incarichi automaticamente.» */
  v_conflict := public.club_equivalent_active_assignment(
    v_cur.club_id, v_cur.profile_id, p_profile_type, p_role_id, v_custom,
    p_scope_type, v_team, v_cur.lineage_id
  );

  if v_conflict is not null then
    raise exception 'ASSIGNMENT_ALREADY_PRESENT';
  end if;

  v_closed := public.club_assignment_close_segment(p_assignment_id, 'ROLE_CHANGED', v_uid);

  if not v_closed then
    raise exception 'ASSIGNMENT_NOT_ACTIVE';
  end if;

  v_new := public.club_assignment_open_segment(
    p_club_id       => v_cur.club_id,
    p_membership_id => v_cur.membership_id,
    p_profile_id    => v_cur.profile_id,
    p_profile_type  => p_profile_type,
    p_role_id       => p_role_id,
    p_custom        => v_custom,
    p_scope_type    => p_scope_type,
    p_team_id       => v_team,
    p_change_source => case when v_side = 'person' then 'person_edit' else 'society_edit' end,
    p_actor_id      => v_uid,
    p_predecessor_id => p_assignment_id
  );

  perform public.club_membership_sync_projection(v_cur.membership_id);

  /* §16: se la modifica soddisfa una proposta pendente equivalente, quella
     proposta si chiude neutra — non diventa un'approvazione. */
  perform public.club_resolve_superseded_requests(
    v_cur.club_id, v_cur.profile_id, p_profile_type, p_role_id, v_custom,
    p_scope_type, v_team, v_new, v_cur.lineage_id
  );

  v_old_label := public.club_assignment_role_label(
    v_cur.structured_role_id, v_cur.custom_role_name
  );
  v_new_label := public.club_assignment_role_label(p_role_id, v_custom);
  v_new_context := case
    when p_scope_type = 'society' then 'Intera società'
    else (select ct.name from public.club_teams ct where ct.id = v_team)
  end;

  insert into public.club_role_link_audit
    (club_id, profile_id, assignment_id, lineage_id, actor_id, actor_side,
     operation, previous_state, next_state)
  values (
    v_cur.club_id, v_cur.profile_id, v_new, v_cur.lineage_id, v_uid, v_side,
    'assignment_update',
    jsonb_build_object(
      'assignment_id', p_assignment_id, 'profile_type', v_cur.profile_type,
      'role_id', v_cur.structured_role_id, 'scope_type', v_cur.scope_type,
      'team_id', v_cur.team_id
    ),
    jsonb_build_object(
      'assignment_id', v_new, 'profile_type', p_profile_type,
      'role_id', p_role_id, 'scope_type', p_scope_type, 'team_id', v_team
    )
  );

  perform public.club_role_link_notify(
    v_cur.club_id, v_cur.profile_id, v_side,
    case when v_side = 'person' then 'role_assignment_changed_by_person'
         else 'role_assignment_changed_by_society' end,
    case when v_side = 'person' then 'Ha aggiornato il suo ruolo'
         else 'Ha aggiornato il tuo ruolo' end,
    v_old_label || ' → ' || v_new_label || ' · ' || coalesce(v_new_context, ''),
    jsonb_build_object(
      'assignment_id', v_new,
      'lineage_id', v_cur.lineage_id,
      'role_label', v_new_label,
      'context_label', v_new_context
    )
  );

  v_result := jsonb_build_object(
    'assignment_id', v_new,
    'lineage_id', v_cur.lineage_id,
    'revision', v_cur.revision + 1,
    'role_label', v_new_label,
    'context_label', v_new_context,
    'changed', true
  );

  perform public.club_relationship_operation_record(
    p_idempotency_key, v_cur.club_id, 'update_member_assignment',
    v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.update_member_assignment(uuid, text, text, text, text, uuid, integer, text) from public;
grant execute on function public.update_member_assignment(uuid, text, text, text, text, uuid, integer, text) to authenticated;

/**
 * Aggiunta di un incarico (§31, screen 17).
 *
 * «L'aggiunta richiede un rapporto ancora attivo al commit e la validità
 * completa del nuovo incarico. Non usa una vecchia membership inattiva come
 * autorizzazione e non sostituisce gli incarichi già presenti.»
 *
 * `p_profile_id` è nullo per l'aggiunta personale: la persona è la sessione
 * (§8). Valorizzato, identifica la persona e impone il lato Società.
 */
create or replace function public.add_member_assignment(
  p_club_id         uuid,
  p_profile_type    text,
  p_role_id         text,
  p_custom_role     text default null,
  p_scope_type      text default 'team',
  p_team_id         uuid default null,
  p_profile_id      uuid default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_person      uuid;
  v_side        text;
  v_custom      text;
  v_team        uuid;
  v_membership  uuid;
  v_active      integer;
  v_fingerprint text;
  v_replay      jsonb;
  v_conflict    uuid;
  v_new         uuid;
  v_lineage     uuid;
  v_label       text;
  v_context     text;
  v_result      jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_person := coalesce(p_profile_id, v_uid);
  v_side   := case when v_person = v_uid then 'person' else 'society' end;

  v_custom := public.club_assignment_validate_shape(
    p_club_id, p_profile_type, p_role_id, p_custom_role, p_scope_type, p_team_id
  );

  v_team := case when p_scope_type = 'team' then p_team_id end;

  if v_side = 'society'
     and not public.club_assignment_society_allows(p_club_id, p_scope_type, v_team)
  then
    raise exception 'ASSIGNMENT_NOT_AUTHORIZED';
  end if;

  v_fingerprint := md5(
    'add_member_assignment|' || p_club_id::text || '|' || v_person::text
    || '|' || p_profile_type || '|' || p_role_id || '|' || coalesce(lower(v_custom), '')
    || '|' || p_scope_type || '|' || coalesce(v_team::text, '')
  );

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, p_club_id, 'add_member_assignment', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  select cm.id into v_membership
  from public.club_members cm
  where cm.club_id = p_club_id
    and cm.profile_id = v_person
  for update;

  if v_membership is null then
    raise exception 'ROLE_LINK_NOT_ACTIVE';
  end if;

  /*
   * §31 e §7: «Le modifiche post-collegamento descritte qui richiedono una
   * relazione sportiva ancora attiva e almeno un incarico attivo
   * utilizzabile come base della gestione. La sola esistenza di una
   * membership storica inattiva non concede auto-riattivazione.»
   */
  select count(*)::integer into v_active
  from public.club_member_assignments a
  where a.membership_id = v_membership
    and a.status = 'active';

  if v_active = 0 then
    raise exception 'ROLE_LINK_NOT_ACTIVE';
  end if;

  /* §31: «Stesso ruolo/Team/ambito già attivo: errore controllato, nessun
     duplicato.» L'indice unico parziale copre le concorrenti (QA-105). */
  v_conflict := public.club_equivalent_active_assignment(
    p_club_id, v_person, p_profile_type, p_role_id, v_custom, p_scope_type, v_team
  );

  if v_conflict is not null then
    raise exception 'ASSIGNMENT_ALREADY_PRESENT';
  end if;

  /* §31: «L'origine di una precedente Invitation o JoinLinkRedemption non
     va copiata sul nuovo incarico soltanto perché appartiene allo stesso
     club.» Nessun predecessore: la linea nasce qui. */
  v_new := public.club_assignment_open_segment(
    p_club_id       => p_club_id,
    p_membership_id => v_membership,
    p_profile_id    => v_person,
    p_profile_type  => p_profile_type,
    p_role_id       => p_role_id,
    p_custom        => v_custom,
    p_scope_type    => p_scope_type,
    p_team_id       => v_team,
    p_change_source => 'initial',
    p_actor_id      => v_uid,
    p_source_type   => case when v_side = 'person' then 'person_add' else 'society_add' end
  );

  select a.lineage_id into v_lineage
  from public.club_member_assignments a where a.id = v_new;

  perform public.club_membership_sync_projection(v_membership);

  perform public.club_resolve_superseded_requests(
    p_club_id, v_person, p_profile_type, p_role_id, v_custom,
    p_scope_type, v_team, v_new, v_lineage
  );

  v_label := public.club_assignment_role_label(p_role_id, v_custom);
  v_context := case
    when p_scope_type = 'society' then 'Intera società'
    else (select ct.name from public.club_teams ct where ct.id = v_team)
  end;

  insert into public.club_role_link_audit
    (club_id, profile_id, assignment_id, lineage_id, actor_id, actor_side,
     operation, previous_state, next_state)
  values (
    p_club_id, v_person, v_new, v_lineage, v_uid, v_side, 'assignment_add',
    '{}'::jsonb,
    jsonb_build_object(
      'assignment_id', v_new, 'profile_type', p_profile_type,
      'role_id', p_role_id, 'scope_type', p_scope_type, 'team_id', v_team
    )
  );

  perform public.club_role_link_notify(
    p_club_id, v_person, v_side,
    case when v_side = 'person' then 'role_assignment_added_by_person'
         else 'role_assignment_added_by_society' end,
    case when v_side = 'person' then 'Ha aggiunto un ruolo'
         else 'Ha aggiunto un tuo ruolo' end,
    v_label || ' · ' || coalesce(v_context, ''),
    jsonb_build_object(
      'assignment_id', v_new, 'lineage_id', v_lineage,
      'role_label', v_label, 'context_label', v_context
    )
  );

  v_result := jsonb_build_object(
    'assignment_id', v_new,
    'lineage_id', v_lineage,
    'revision', 1,
    'role_label', v_label,
    'context_label', v_context,
    'active_count', v_active + 1
  );

  perform public.club_relationship_operation_record(
    p_idempotency_key, p_club_id, 'add_member_assignment',
    v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.add_member_assignment(uuid, text, text, text, text, uuid, uuid, text) from public;
grant execute on function public.add_member_assignment(uuid, text, text, text, text, uuid, uuid, text) to authenticated;

/**
 * Rimozione di un solo incarico (§35, screen 19).
 *
 * «Termina soltanto quell'incarico con ended_at e REMOVED_BY_USER o
 * REMOVED_BY_SOCIETY secondo chi decide. Conserva gli altri incarichi, fonte
 * e storico.»
 *
 * «Una modifica concorrente rende necessario rivedere il nuovo ruolo prima
 * di terminarlo: non applicare silenziosamente la conferma preparata per
 * Match analyst a un successore diverso.» È il motivo per cui la revisione
 * attesa non è opzionale nei fatti: con un successore, l'ID ricevuto non è
 * più attivo e la mutation si ferma.
 */
create or replace function public.end_member_assignment(
  p_assignment_id     uuid,
  p_expected_revision integer default null,
  p_idempotency_key   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_cur         public.club_member_assignments%rowtype;
  v_side        text;
  v_cause       text;
  v_fingerprint text;
  v_replay      jsonb;
  v_remaining   integer;
  v_label       text;
  v_context     text;
  v_result      jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_cur
  from public.club_member_assignments a
  where a.id = p_assignment_id;

  if v_cur.id is null then
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;

  v_side  := case when v_cur.profile_id = v_uid then 'person' else 'society' end;
  v_cause := case when v_side = 'person' then 'REMOVED_BY_USER' else 'REMOVED_BY_SOCIETY' end;

  /*
   * §8 chiede di distinguere «modificare un incarico, aggiungerne uno,
   * rimuoverne uno»: la rimozione ha una chiave propria, ed esiste già —
   * `assignments_remove` di DAS-REV-20 §8, dove nasce con la stessa
   * identica semantica («Il diritto di gestione link non implica da solo il
   * diritto di rimuovere persone»).
   *
   * Usarla qui, invece di assorbirla in `assignments_manage`, evita anche
   * di stringere il contratto esistente: `end_team_join_link_assignment`
   * delega a questa funzione, e un delegato che aveva solo
   * `assignments_remove` continua a poter rimuovere.
   */
  if v_side = 'society'
     and not public.member_invite_allows(
           v_cur.club_id, 'assignments_remove', v_cur.scope_type, v_cur.team_id
         )
  then
    raise exception 'ASSIGNMENT_NOT_AUTHORIZED';
  end if;

  v_fingerprint := md5('end_member_assignment|' || p_assignment_id::text);

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, v_cur.club_id, 'end_member_assignment', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  perform 1 from public.club_members where id = v_cur.membership_id for update;

  select * into v_cur
  from public.club_member_assignments a
  where a.id = p_assignment_id
  for update;

  if v_cur.status <> 'active' then
    /* §35: «Una seconda rimozione già applicata restituisce l'esito
       coerente senza nuove notifiche o cambio della causa originale.» */
    select count(*)::integer into v_remaining
    from public.club_member_assignments a
    where a.membership_id = v_cur.membership_id and a.status = 'active';

    return jsonb_build_object(
      'assignment_id', p_assignment_id,
      'ended_cause', v_cur.ended_cause,
      'remaining_active', v_remaining,
      'already_applied', true
    );
  end if;

  if p_expected_revision is not null and p_expected_revision <> v_cur.revision then
    raise exception 'ASSIGNMENT_REVISION_CONFLICT';
  end if;

  perform public.club_assignment_close_segment(p_assignment_id, v_cause, v_uid);

  select count(*)::integer into v_remaining
  from public.club_member_assignments a
  where a.membership_id = v_cur.membership_id and a.status = 'active';

  perform public.club_membership_sync_projection(v_cur.membership_id);

  v_label := public.club_assignment_role_label(
    v_cur.structured_role_id, v_cur.custom_role_name
  );
  v_context := case
    when v_cur.scope_type = 'society' then 'Intera società'
    else (select ct.name from public.club_teams ct where ct.id = v_cur.team_id)
  end;

  insert into public.club_role_link_audit
    (club_id, profile_id, assignment_id, lineage_id, actor_id, actor_side,
     operation, previous_state, next_state)
  values (
    v_cur.club_id, v_cur.profile_id, p_assignment_id, v_cur.lineage_id, v_uid,
    v_side, 'assignment_end',
    jsonb_build_object('status', 'active'),
    jsonb_build_object('status', 'ended', 'ended_cause', v_cause,
                       'remaining_active', v_remaining)
  );

  perform public.club_role_link_notify(
    v_cur.club_id, v_cur.profile_id, v_side,
    case when v_side = 'person' then 'role_assignment_removed_by_person'
         else 'role_assignment_removed_by_society' end,
    case when v_side = 'person' then 'Ha rimosso un ruolo'
         else 'Ha rimosso il tuo ruolo' end,
    v_label || ' · ' || coalesce(v_context, ''),
    jsonb_build_object(
      'assignment_id', p_assignment_id, 'lineage_id', v_cur.lineage_id,
      'role_label', v_label, 'context_label', v_context
    )
  );

  v_result := jsonb_build_object(
    'assignment_id', p_assignment_id,
    'ended_cause', v_cause,
    'remaining_active', v_remaining,
    'role_label', v_label,
    'context_label', v_context,
    'already_applied', false
  );

  perform public.club_relationship_operation_record(
    p_idempotency_key, v_cur.club_id, 'end_member_assignment',
    v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.end_member_assignment(uuid, integer, text) from public;
grant execute on function public.end_member_assignment(uuid, integer, text) to authenticated;


-- ============================================================
-- SEZIONE 21 — Termine completo del rapporto (§36, §37)
--
-- Due comandi distinti e non uno con un flag, perché distinte sono
-- l'autorità richiesta, la causa registrata e la notifica:
--
--   `leave_society`              la persona, su di sé, LEFT_BY_USER;
--   `remove_person_from_society` la Società, con autorità sull'**intera**
--                                relazione, REMOVED_BY_SOCIETY.
--
-- §37: «Un actor con il solo scope Team non può chiamare questo endpoint,
-- anche manipolando gli ID. Non terminare soltanto i ruoli visibili
-- restituendo un falso esito di rimozione completa.» Per questo
-- `members_remove` è richiesta con ambito societario — cioè senza
-- restrizione di squadra — e non riga per riga.
--
-- La versione aggregata della membership è la guard di §36: «Se tra
-- apertura dello sheet e conferma cambia l'insieme dei ruoli, aggiorna il
-- riepilogo e richiedi la conferma sullo stato corrente; non eliminare di
-- nascosto un nuovo incarico non considerato nella conferma.»
-- ============================================================

create or replace function public.club_terminate_relationship(
  p_club_id           uuid,
  p_profile_id        uuid,
  p_side              text,
  p_cause             text,
  p_expected_revision integer,
  p_actor_id          uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership uuid;
  v_revision   integer;
  v_ids        uuid[];
  v_count      integer;
  v_id         uuid;
begin
  select cm.id, cm.assignments_revision
  into v_membership, v_revision
  from public.club_members cm
  where cm.club_id = p_club_id
    and cm.profile_id = p_profile_id
  for update;

  if v_membership is null then
    raise exception 'ROLE_LINK_NOT_ACTIVE';
  end if;

  select array_agg(a.id order by a.created_at, a.id), count(*)::integer
  into v_ids, v_count
  from public.club_member_assignments a
  where a.membership_id = v_membership
    and a.status = 'active';

  if coalesce(v_count, 0) = 0 then
    /* Già terminato: esito coerente, nessuna seconda causa (§37, QA-138). */
    return jsonb_build_object(
      'club_id', p_club_id,
      'profile_id', p_profile_id,
      'ended_count', 0,
      'already_applied', true
    );
  end if;

  if p_expected_revision is not null and p_expected_revision <> v_revision then
    raise exception 'ROLE_LINK_COMPOSITION_CHANGED';
  end if;

  foreach v_id in array v_ids loop
    perform public.club_assignment_close_segment(v_id, p_cause, p_actor_id);
  end loop;

  perform public.club_membership_sync_projection(v_membership);

  insert into public.club_role_link_audit
    (club_id, profile_id, actor_id, actor_side, operation,
     previous_state, next_state)
  values (
    p_club_id, p_profile_id, p_actor_id, p_side, 'relationship_terminate',
    jsonb_build_object('active_count', v_count, 'revision', v_revision),
    jsonb_build_object('ended_cause', p_cause, 'assignment_ids', to_jsonb(v_ids))
  );

  return jsonb_build_object(
    'club_id', p_club_id,
    'profile_id', p_profile_id,
    'ended_count', v_count,
    'already_applied', false
  );
end;
$$;

revoke all on function public.club_terminate_relationship(uuid, uuid, text, text, integer, uuid) from public;

create or replace function public.leave_society(
  p_club_id           uuid,
  p_expected_revision integer default null,
  p_idempotency_key   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_fingerprint text;
  v_replay      jsonb;
  v_result      jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_fingerprint := md5('leave_society|' || p_club_id::text || '|' || v_uid::text);

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, p_club_id, 'leave_society', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  /*
   * §36: «Il server identifica la PERSON dalla sessione e agisce su tutti
   * gli incarichi attivi della sua relazione sportiva con quella società.
   * Non limita il comando alla squadra dalla quale l'utente era arrivato.»
   */
  v_result := public.club_terminate_relationship(
    p_club_id, v_uid, 'person', 'LEFT_BY_USER', p_expected_revision, v_uid
  );

  if (v_result ->> 'already_applied')::boolean is not true then
    perform public.club_role_link_notify(
      p_club_id, v_uid, 'person', 'role_link_left',
      'Si è scollegato dalla società', null,
      jsonb_build_object('ended_count', v_result -> 'ended_count')
    );
  end if;

  perform public.club_relationship_operation_record(
    p_idempotency_key, p_club_id, 'leave_society', v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.leave_society(uuid, integer, text) from public;
grant execute on function public.leave_society(uuid, integer, text) to authenticated;

comment on function public.leave_society(uuid, integer, text) is
  'DAS-REV-21 §36: termina tutti gli incarichi attivi della persona con '
  'quella società. Non tocca account, carriera, contenuti o altri club.';

create or replace function public.remove_person_from_society(
  p_club_id           uuid,
  p_profile_id        uuid,
  p_expected_revision integer default null,
  p_idempotency_key   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_fingerprint text;
  v_replay      jsonb;
  v_result      jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_profile_id = v_uid then
    /* Il proprio rapporto si chiude da `leave_society`: la causa sarebbe
       altrimenti REMOVED_BY_SOCIETY su una decisione personale (§39). */
    raise exception 'ROLE_LINK_USE_LEAVE';
  end if;

  /*
   * §37: «Richiedi la capability globale specifica per la relazione
   * completa.» `p_scope_type => 'society'` impone a `member_invite_allows`
   * il ramo che esige un perimetro senza restrizione di squadra.
   */
  if not public.member_invite_allows(p_club_id, 'members_remove', 'society', null) then
    raise exception 'ROLE_LINK_REMOVE_NOT_AUTHORIZED';
  end if;

  v_fingerprint := md5(
    'remove_person_from_society|' || p_club_id::text || '|' || p_profile_id::text
  );

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, p_club_id, 'remove_person_from_society', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  v_result := public.club_terminate_relationship(
    p_club_id, p_profile_id, 'society', 'REMOVED_BY_SOCIETY',
    p_expected_revision, v_uid
  );

  if (v_result ->> 'already_applied')::boolean is not true then
    perform public.club_role_link_notify(
      p_club_id, p_profile_id, 'society', 'role_link_removed',
      'Ti ha rimosso dalla società',
      'Non hai più ruoli attivi con questa società.',
      jsonb_build_object('ended_count', v_result -> 'ended_count')
    );
  end if;

  perform public.club_relationship_operation_record(
    p_idempotency_key, p_club_id, 'remove_person_from_society',
    v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.remove_person_from_society(uuid, uuid, integer, text) from public;
grant execute on function public.remove_person_from_society(uuid, uuid, integer, text) to authenticated;

comment on function public.remove_person_from_society(uuid, uuid, integer, text) is
  'DAS-REV-21 §37: rimozione completa, con autorità societaria. Non revoca '
  'l''accesso amministrativo di DAS-REV-14, che è un rapporto distinto.';


-- ============================================================
-- SEZIONE 22 — Ripristina ruolo precedente (§34, screen 22)
--
-- «Offri il ripristino come correzione societaria soltanto se esiste un
-- precedente pertinente della stessa linea, la modifica personale è ancora
-- quella corrente e l'actor può consultare/gestire sia lo stato corrente sia
-- quello da ripristinare.»
--
-- Il precedente non è "il penultimo segmento in ordine di data": è
-- `predecessor_id` del segmento corrente, cioè un riferimento esistente nei
-- dati. §48 — «Se mancano lineage/versioni, ricostruisci soltanto ciò che è
-- dimostrabile dai riferimenti esistenti … Un precedente non ricostruibile
-- non rende obbligatorio mostrare Ripristina ruolo precedente».
--
-- «Il ripristino crea un nuovo segmento corrente con valori corrispondenti
-- al precedente valido, conservando sia il segmento iniziale sia quello
-- corretto nello storico. Non cambiare ENDED → ACTIVE sul vecchio record né
-- spostare indietro timestamp, origine o audit.»
-- ============================================================

create or replace function public.restore_member_assignment(
  p_assignment_id     uuid,
  p_expected_revision integer default null,
  p_idempotency_key   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_cur         public.club_member_assignments%rowtype;
  v_prev        public.club_member_assignments%rowtype;
  v_fingerprint text;
  v_replay      jsonb;
  v_conflict    uuid;
  v_new         uuid;
  v_label       text;
  v_context     text;
  v_result      jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_cur
  from public.club_member_assignments a
  where a.id = p_assignment_id;

  if v_cur.id is null then
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;

  /* §34: è una **correzione societaria**. La persona che volesse tornare al
     ruolo precedente usa la normale modifica. */
  if v_cur.profile_id = v_uid then
    raise exception 'ASSIGNMENT_RESTORE_NOT_AVAILABLE';
  end if;

  if v_cur.predecessor_id is null then
    raise exception 'ASSIGNMENT_RESTORE_NOT_AVAILABLE';
  end if;

  select * into v_prev
  from public.club_member_assignments a
  where a.id = v_cur.predecessor_id;

  if v_prev.id is null then
    raise exception 'ASSIGNMENT_RESTORE_NOT_AVAILABLE';
  end if;

  /* §34: autorità su **entrambi** gli stati, corrente e da ripristinare. */
  if not public.club_assignment_society_allows(v_cur.club_id, v_cur.scope_type, v_cur.team_id)
     or not public.club_assignment_society_allows(v_cur.club_id, v_prev.scope_type, v_prev.team_id)
  then
    raise exception 'ASSIGNMENT_NOT_AUTHORIZED';
  end if;

  /* §34: «Non ripristinare su Team non più assegnabile.» */
  if v_prev.scope_type = 'team'
     and not public.club_team_is_assignable(v_prev.club_id, v_prev.team_id)
  then
    raise exception 'ASSIGNMENT_RESTORE_TEAM_UNAVAILABLE';
  end if;

  v_fingerprint := md5('restore_member_assignment|' || p_assignment_id::text);

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, v_cur.club_id, 'restore_member_assignment', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  perform 1 from public.club_members where id = v_cur.membership_id for update;

  select * into v_cur
  from public.club_member_assignments a
  where a.id = p_assignment_id
  for update;

  if v_cur.status <> 'active' then
    raise exception 'ASSIGNMENT_NOT_ACTIVE';
  end if;

  if p_expected_revision is not null and p_expected_revision <> v_cur.revision then
    raise exception 'ASSIGNMENT_REVISION_CONFLICT';
  end if;

  v_conflict := public.club_equivalent_active_assignment(
    v_cur.club_id, v_cur.profile_id, v_prev.profile_type, v_prev.structured_role_id,
    v_prev.custom_role_name, v_prev.scope_type, v_prev.team_id, v_cur.lineage_id
  );

  if v_conflict is not null then
    raise exception 'ASSIGNMENT_ALREADY_PRESENT';
  end if;

  perform public.club_assignment_close_segment(p_assignment_id, 'ROLE_CHANGED', v_uid);

  v_new := public.club_assignment_open_segment(
    p_club_id        => v_cur.club_id,
    p_membership_id  => v_cur.membership_id,
    p_profile_id     => v_cur.profile_id,
    p_profile_type   => v_prev.profile_type,
    p_role_id        => v_prev.structured_role_id,
    p_custom         => v_prev.custom_role_name,
    p_scope_type     => v_prev.scope_type,
    p_team_id        => v_prev.team_id,
    p_change_source  => 'society_restore',
    p_actor_id       => v_uid,
    p_predecessor_id => p_assignment_id
  );

  perform public.club_membership_sync_projection(v_cur.membership_id);

  v_label := public.club_assignment_role_label(
    v_prev.structured_role_id, v_prev.custom_role_name
  );
  v_context := case
    when v_prev.scope_type = 'society' then 'Intera società'
    else (select ct.name from public.club_teams ct where ct.id = v_prev.team_id)
  end;

  insert into public.club_role_link_audit
    (club_id, profile_id, assignment_id, lineage_id, actor_id, actor_side,
     operation, previous_state, next_state)
  values (
    v_cur.club_id, v_cur.profile_id, v_new, v_cur.lineage_id, v_uid, 'society',
    'assignment_restore',
    jsonb_build_object('assignment_id', p_assignment_id,
                       'role_id', v_cur.structured_role_id),
    jsonb_build_object('assignment_id', v_new,
                       'role_id', v_prev.structured_role_id,
                       'restored_from', v_prev.id)
  );

  perform public.club_role_link_notify(
    v_cur.club_id, v_cur.profile_id, 'society', 'role_assignment_changed_by_society',
    'Ha ripristinato il tuo ruolo precedente',
    v_label || ' · ' || coalesce(v_context, ''),
    jsonb_build_object(
      'assignment_id', v_new, 'lineage_id', v_cur.lineage_id,
      'role_label', v_label, 'context_label', v_context
    )
  );

  v_result := jsonb_build_object(
    'assignment_id', v_new,
    'lineage_id', v_cur.lineage_id,
    'revision', v_cur.revision + 1,
    'role_label', v_label,
    'context_label', v_context,
    'restored', true
  );

  perform public.club_relationship_operation_record(
    p_idempotency_key, v_cur.club_id, 'restore_member_assignment',
    v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.restore_member_assignment(uuid, integer, text) from public;
grant execute on function public.restore_member_assignment(uuid, integer, text) to authenticated;


-- ============================================================
-- SEZIONE 23 — La persona vista dalla Società (§32, §33, screen 21 e 22)
--
-- «Il dettaglio può mostrare tutti gli incarichi autorizzati della persona,
-- non soltanto quello della squadra di provenienza. Un admin limitato vede
-- esclusivamente i propri ambiti; non mostrare count totali nascosti o nomi
-- di ruoli che non può consultare.»
--
-- Il filtro è per riga e usa `roster_view` sull'ambito di **quell'**
-- incarico: un amministratore della Primavera non riceve la riga della Prima
-- squadra né quella societaria (QA-114). Il conteggio restituito è quello
-- delle righe consultabili, non un totale nascosto.
--
-- `can_remove_all` è separato da `can_manage`: §8 — «Rimuovi dalla società
-- richiede la specifica autorità sulla relazione completa … Se non
-- disponibile, nascondi l'azione globale e mantieni le azioni consentite sui
-- singoli incarichi».
-- ============================================================

create or replace function public.fetch_society_person_link(
  p_club_id    uuid,
  p_profile_id uuid
)
returns table (
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  club_is_verified   boolean,
  person_profile_id  uuid,
  person_name        text,
  person_avatar_url  text,
  membership_id      uuid,
  aggregate_revision integer,
  is_active          boolean,
  visible_count      integer,
  can_add            boolean,
  can_remove_all     boolean,
  can_view_person    boolean,
  assignment_id      uuid,
  lineage_id         uuid,
  profile_type       text,
  role_label         text,
  scope_type         text,
  team_id            uuid,
  context_label      text,
  team_is_inactive   boolean,
  revision           integer,
  can_manage_row     boolean,
  can_remove_row     boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_membership uuid;
  v_revision   integer;
  v_visible    integer;
  v_active     integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.member_invite_allows(p_club_id, 'roster_view') then
    raise exception 'ROLE_LINK_NOT_AUTHORIZED';
  end if;

  select cm.id, cm.assignments_revision
  into v_membership, v_revision
  from public.club_members cm
  where cm.club_id = p_club_id and cm.profile_id = p_profile_id;

  if v_membership is null then
    raise exception 'ROLE_LINK_NOT_FOUND';
  end if;

  select count(*)::integer into v_active
  from public.club_member_assignments a
  where a.membership_id = v_membership and a.status = 'active';

  select count(*)::integer into v_visible
  from public.club_member_assignments a
  where a.membership_id = v_membership
    and a.status = 'active'
    and public.member_invite_allows(p_club_id, 'roster_view', a.scope_type, a.team_id);

  return query
  select
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    p.id,
    p.full_name,
    p.avatar_url,
    v_membership,
    v_revision,
    v_active > 0,
    v_visible,
    public.member_invite_allows(p_club_id, 'assignments_manage'),
    public.member_invite_allows(p_club_id, 'members_remove', 'society', null),
    not exists (
      select 1 from public.user_blocks b
      where (b.blocker_profile_id = v_uid and b.blocked_profile_id = p.id)
         or (b.blocker_profile_id = p.id and b.blocked_profile_id = v_uid)
    ),
    a.id,
    a.lineage_id,
    a.profile_type,
    public.club_assignment_role_label(a.structured_role_id, a.custom_role_name),
    a.scope_type,
    a.team_id,
    case when a.scope_type = 'society' then 'Intera società' else ct.name end,
    coalesce(ct.is_archived, false),
    a.revision,
    public.club_assignment_society_allows(p_club_id, a.scope_type, a.team_id),
    public.member_invite_allows(
      p_club_id, 'assignments_remove', a.scope_type, a.team_id
    )
  from public.clubs c
  join public.profiles p on p.id = p_profile_id
  left join public.club_member_assignments a
    on a.membership_id = v_membership
   and a.status = 'active'
   and public.member_invite_allows(p_club_id, 'roster_view', a.scope_type, a.team_id)
  left join public.club_teams ct on ct.id = a.team_id
  where c.id = p_club_id
  order by a.created_at, a.id;
end;
$$;

revoke all on function public.fetch_society_person_link(uuid, uuid) from public;
grant execute on function public.fetch_society_person_link(uuid, uuid) to authenticated;

/**
 * Dettaglio del singolo incarico lato Società (§33, §34, screen 22).
 *
 * `previous_*` e `can_restore` sono risolti qui e non nel client: §34 chiede
 * di «mostrare prima del tap il ruolo/ambito che verrà ripristinato», e
 * ciascuna delle condizioni (predecessore esistente, modifica personale
 * ancora corrente, autorità su entrambi gli stati, Team ancora assegnabile)
 * è una verifica che solo il server può fare.
 *
 * `changed_by_person` alimenta l'helper «Mario ha aggiornato questo ruolo.»
 * — §33: «soltanto quando deriva da un cambiamento reale ancora
 * pertinente».
 */
create or replace function public.fetch_society_assignment(p_assignment_id uuid)
returns table (
  assignment_id       uuid,
  requested_id        uuid,
  lineage_id          uuid,
  club_id             uuid,
  club_name           text,
  club_logo_url       text,
  club_is_verified    boolean,
  person_profile_id   uuid,
  person_name         text,
  person_avatar_url   text,
  profile_type        text,
  role_id             text,
  custom_role_name    text,
  role_label          text,
  scope_type          text,
  team_id             uuid,
  context_label       text,
  team_is_inactive    boolean,
  status              text,
  revision            integer,
  changed_by_person   boolean,
  can_manage          boolean,
  /* §8: rimuovere è un verbo distinto da modificare, e qui ha il suo flag. */
  can_remove          boolean,
  can_restore         boolean,
  previous_role_label text,
  previous_context    text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_seed    public.club_member_assignments%rowtype;
  v_current public.club_member_assignments%rowtype;
  v_prev    public.club_member_assignments%rowtype;
  v_manage  boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_seed
  from public.club_member_assignments a
  where a.id = p_assignment_id;

  if v_seed.id is null then
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;

  /* §28/§33: il deep link a un segmento superato risolve il successore. */
  select * into v_current
  from public.club_member_assignments a
  where a.lineage_id = v_seed.lineage_id
    and a.status = 'active';

  if v_current.id is null then
    v_current := v_seed;
  end if;

  if not public.member_invite_allows(
       v_current.club_id, 'roster_view', v_current.scope_type, v_current.team_id
     )
  then
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;

  v_manage := v_current.status = 'active'
    and public.club_assignment_society_allows(
          v_current.club_id, v_current.scope_type, v_current.team_id
        );

  if v_current.predecessor_id is not null then
    select * into v_prev
    from public.club_member_assignments a
    where a.id = v_current.predecessor_id;
  end if;

  return query
  select
    v_current.id,
    p_assignment_id,
    v_current.lineage_id,
    v_current.club_id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    v_current.profile_id,
    p.full_name,
    p.avatar_url,
    v_current.profile_type,
    v_current.structured_role_id,
    v_current.custom_role_name,
    public.club_assignment_role_label(
      v_current.structured_role_id, v_current.custom_role_name
    ),
    v_current.scope_type,
    v_current.team_id,
    case when v_current.scope_type = 'society' then 'Intera società' else ct.name end,
    coalesce(ct.is_archived, false),
    v_current.status,
    v_current.revision,
    v_current.change_source = 'person_edit',
    v_manage,
    v_current.status = 'active'
      and public.member_invite_allows(
            v_current.club_id, 'assignments_remove',
            v_current.scope_type, v_current.team_id
          ),
    /* §34, tutte le condizioni insieme. */
    v_manage
      and v_prev.id is not null
      and v_current.change_source = 'person_edit'
      and public.club_assignment_society_allows(
            v_current.club_id, v_prev.scope_type, v_prev.team_id
          )
      and (
        v_prev.scope_type = 'society'
        or public.club_team_is_assignable(v_prev.club_id, v_prev.team_id)
      )
      and public.club_equivalent_active_assignment(
            v_current.club_id, v_current.profile_id, v_prev.profile_type,
            v_prev.structured_role_id, v_prev.custom_role_name,
            v_prev.scope_type, v_prev.team_id, v_current.lineage_id
          ) is null,
    case when v_prev.id is not null
      then public.club_assignment_role_label(
             v_prev.structured_role_id, v_prev.custom_role_name
           )
    end,
    case
      when v_prev.id is null then null
      when v_prev.scope_type = 'society' then 'Intera società'
      else (select t.name from public.club_teams t where t.id = v_prev.team_id)
    end
  from public.clubs c
  join public.profiles p on p.id = v_current.profile_id
  left join public.club_teams ct on ct.id = v_current.team_id
  where c.id = v_current.club_id;
end;
$$;

revoke all on function public.fetch_society_assignment(uuid) from public;
grant execute on function public.fetch_society_assignment(uuid) to authenticated;

/**
 * §32: «Gli incarichi Dirigente Intera società si raggiungono dall'area
 * societaria appropriata, senza Team fittizio. Se manca l'integrazione
 * minima per raggiungere tali persone, completa la destinazione usando gli
 * stessi componenti e lo stesso dominio.»
 *
 * L'Organico esistente è per squadra: gli incarichi SOCIETY non vi
 * comparirebbero mai. Questa lettura è quella destinazione minima — le
 * persone con almeno un incarico societario attivo, nel perimetro
 * dell'actor.
 */
create or replace function public.fetch_society_wide_members(p_club_id uuid)
returns table (
  profile_id    uuid,
  person_name   text,
  avatar_url    text,
  role_lines    text[],
  active_count  integer
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

  if not public.member_invite_allows(p_club_id, 'roster_view', 'society', null) then
    raise exception 'ROLE_LINK_NOT_AUTHORIZED';
  end if;

  return query
  select
    a.profile_id,
    p.full_name,
    p.avatar_url,
    array_agg(
      public.club_assignment_role_label(a.structured_role_id, a.custom_role_name)
      order by a.created_at, a.id
    ),
    count(*)::integer
  from public.club_member_assignments a
  join public.profiles p on p.id = a.profile_id
  where a.club_id = p_club_id
    and a.status = 'active'
    and a.scope_type = 'society'
  group by a.profile_id, p.full_name, p.avatar_url
  order by p.full_name, a.profile_id;
end;
$$;

revoke all on function public.fetch_society_wide_members(uuid) from public;
grant execute on function public.fetch_society_wide_members(uuid) to authenticated;


-- ============================================================
-- SEZIONE 24 — Adattamento dei lettori di DAS-REV-20 (§39)
--
-- «Per i lettori di DAS-REV-20 risolvi il segmento corrente della stessa
-- linea. Un cambio Calciatore → Allenatore non deve far sparire e
-- ricomparire la persona come nuovo ingresso, né creare una nuova
-- redemption.»
--
-- Tre punti del modulo link presumevano che una persona avesse **un**
-- incarico per sempre. Con le linee non è più vero, e tutti e tre
-- produrrebbero il bug opposto a quello che §39 descrive.
--
--   1. Il contatore `active_connected_people_count`. Il trigger decrementa
--      a ogni `active → ended`: su una modifica di ruolo il predecessore si
--      chiude e il successore nasce con un INSERT, che il trigger non vede.
--      30/27 diventerebbe 30/26 per un semplice cambio di ruolo — QA-152
--      dice 30/27.
--
--   2. `resolve_team_join_context`. Legge lo stato di
--      `redemption.assignment_id`, cioè del segmento **originale**. Dopo una
--      modifica quel segmento è `ended` con causa ROLE_CHANGED, e il
--      resolver direbbe `blocked_ended`: un rientro negato per una modifica
--      di ruolo. §39 — «Non applicare tale protezione a ROLE_CHANGED».
--
--   3. `fetch_team_join_link_people_page` e `fetch_team_join_link_person`.
--      Un successore può essere su un'altra squadra o essere diventato
--      societario; l'actor limitato alla squadra del link non deve
--      riceverlo (§39: «Un admin limitato al vecchio Team non riceve dati
--      del nuovo Team o di un incarico SOCIETY fuori scope; anche il
--      conteggio corrente segue il perimetro delle righe consultabili»).
-- ============================================================

create or replace function public.club_team_join_link_sync_active_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source_join_link_id is null then
    return new;
  end if;

  if old.status = 'active' and new.status = 'ended' then
    /*
     * DAS-REV-21 §39: la linea continua. Il segmento si chiude solo perché
     * un successore lo sostituisce nella stessa transazione, e la persona
     * resta un ingresso corrente del link.
     */
    if new.ended_cause = 'ROLE_CHANGED' then
      return new;
    end if;

    update public.club_team_join_links
    set active_connected_people_count = greatest(0, active_connected_people_count - 1),
        updated_at = timezone('utc', now())
    where id = new.source_join_link_id;
  elsif old.status = 'ended' and new.status = 'active' then
    update public.club_team_join_links
    set active_connected_people_count = least(
          completed_redemptions_count,
          active_connected_people_count + 1
        ),
        updated_at = timezone('utc', now())
    where id = new.source_join_link_id;
  end if;

  return new;
end;
$$;

/**
 * Segmento corrente di una linea (§39).
 *
 * Restituisce l'attivo se esiste, altrimenti l'ultimo chiuso: è la
 * domanda «che fine ha fatto questo incarico», e la risposta non è mai il
 * segmento di partenza quando la linea è andata avanti.
 */
create or replace function public.club_assignment_current_segment(p_assignment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.id
  from public.club_member_assignments a
  where a.lineage_id = (
      select s.lineage_id from public.club_member_assignments s where s.id = p_assignment_id
    )
  order by (a.status = 'active') desc, a.created_at desc, a.id desc
  limit 1;
$$;

revoke all on function public.club_assignment_current_segment(uuid) from public;

/*
 * Riscritta da 20261031090000_team_join_links.sql. Unica differenza: la
 * risoluzione dell'esito storico passa per `club_assignment_current_segment`.
 */
create or replace function public.resolve_team_join_context(p_token text)
returns table (
  state                      text,
  link_id                    uuid,
  club_id                    uuid,
  club_name                  text,
  club_logo_url              text,
  club_is_verified           boolean,
  team_id                    uuid,
  team_name                  text,
  allowed_profile_types      text[],
  eligible_profile_types     text[],
  allowed_executive_roles    text[],
  executive_custom_role_name text,
  person_name                text,
  person_avatar_url          text,
  current_role_label         text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_hash       text;
  v_link       public.club_team_join_links%rowtype;
  v_archived   boolean;
  v_avail      text;
  v_role       text;
  v_eligible   text[];
  v_state      text;
  v_prior      public.club_team_join_redemptions%rowtype;
  v_prior_status text;
  v_prior_cause  text;
  v_role_label text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_hash := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');

  select l.* into v_link
  from public.club_team_join_link_handles h
  join public.club_team_join_links l on l.id = h.link_id
  where h.token_hash = v_hash;

  if v_link.id is null then
    return query select 'unavailable'::text, null::uuid, null::uuid, null::text,
      null::text, null::boolean, null::uuid, null::text, null::text[], null::text[],
      null::text[], null::text, null::text, null::text, null::text;
    return;
  end if;

  select ct.is_archived into v_archived
  from public.club_teams ct where ct.id = v_link.team_id;

  v_avail := public.team_join_link_availability(
    v_link.status, v_archived, v_link.expires_at,
    v_link.max_redemptions, v_link.completed_redemptions_count
  );

  select p.role into v_role from public.profiles p where p.id = v_uid;

  select array_agg(t order by t) into v_eligible
  from unnest(v_link.allowed_profile_types) as t
  where t = v_role;

  /* Esito storico della stessa persona sullo stesso link (§36). */
  select * into v_prior
  from public.club_team_join_redemptions r
  where r.link_id = v_link.id and r.profile_id = v_uid;

  if v_prior.id is not null then
    select a.status, a.ended_cause,
           public.club_assignment_role_label(a.structured_role_id, a.custom_role_name)
    into v_prior_status, v_prior_cause, v_role_label
    from public.club_member_assignments a
    /* DAS-REV-21 §39: il segmento corrente della linea, non quello
       originale. Dopo una modifica di ruolo il primo è `ended` con causa
       ROLE_CHANGED, e leggerlo direbbe `blocked_ended` a una persona che
       è invece ancora collegata. */
    where a.id = public.club_assignment_current_segment(v_prior.assignment_id);
  end if;

  v_state := case
    when v_prior.id is not null and v_prior_status = 'active'  then 'already_connected'
    when v_prior.id is not null and v_prior_cause = 'REMOVED_BY_SOCIETY' then 'blocked_removed'
    when v_prior.id is not null                                then 'blocked_ended'
    when v_avail <> 'available'                                then 'unavailable'
    when v_eligible is null or array_length(v_eligible, 1) = 0 then 'incompatible_profile'
    else 'valid'
  end;

  return query
  select
    v_state,
    v_link.id,
    v_link.club_id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    v_link.team_id,
    ct.name,
    v_link.allowed_profile_types,
    coalesce(v_eligible, array[]::text[]),
    v_link.allowed_executive_roles,
    v_link.executive_custom_role_name,
    p.full_name,
    p.avatar_url,
    v_role_label
  from public.clubs c
  join public.club_teams ct on ct.id = v_link.team_id
  cross join public.profiles p
  where c.id = v_link.club_id
    and p.id = v_uid;
end;
$$;

revoke all on function public.resolve_team_join_context(text) from public;
grant execute on function public.resolve_team_join_context(text) to authenticated;


/*
 * Le due letture delle persone collegate cambiano forma (una colonna in
 * più) e perimetro (per riga). `create or replace` non può cambiare la riga
 * definita dai parametri OUT — Postgres risponde 42P13 — quindi vengono
 * ricreate. Stesso nome e stessa firma: nessun chiamante cambia indirizzo.
 */
drop function if exists public.fetch_team_join_link_people_page(uuid, text, integer);

create function public.fetch_team_join_link_people_page(
  p_link_id uuid,
  p_cursor  text default null,
  p_limit   integer default 20
)
returns table (
  assignment_id uuid,
  profile_id    uuid,
  person_name   text,
  avatar_url    text,
  role_label    text,
  context_label text,
  connected_at  timestamptz,
  sort_key      text,
  next_cursor   text,
  as_of         timestamptz,
  total_count   integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club   uuid;
  v_team   uuid;
  v_limit  integer;
  v_as_of  timestamptz;
  v_after  text;
  v_total  integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select l.club_id, l.team_id into v_club, v_team
  from public.club_team_join_links l
  where l.id = p_link_id;

  if v_club is null
     or not public.team_join_link_allows(v_club, 'join_links_view', v_team)
  then
    raise exception 'JOIN_LINK_NOT_FOUND';
  end if;

  if not public.team_join_link_allows(v_club, 'roster_view', v_team) then
    raise exception 'JOIN_LINK_PEOPLE_NOT_AUTHORIZED';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 20), 1), 50);

  if p_cursor is null then
    v_as_of := timezone('utc', now());
    v_after := null;
  else
    select d.as_of, d.sort_key into v_as_of, v_after
    from public.team_join_people_cursor_decode(p_cursor, p_link_id) d;
  end if;

  /*
   * DAS-REV-21 §39: «anche il conteggio corrente segue il perimetro delle
   * righe consultabili». Il totale è quindi calcolato con lo stesso filtro
   * delle righe, non sull'insieme completo.
   */
  select count(*)::integer into v_total
  from public.club_member_assignments a
  where a.source_join_link_id = p_link_id
    and a.status = 'active'
    and a.created_at <= v_as_of
    and public.member_invite_allows(v_club, 'roster_view', a.scope_type, a.team_id);

  return query
  with keyed as (
    select
      a.id as rec_id,
      a.profile_id as pr_id,
      p.full_name as pr_name,
      p.avatar_url as pr_avatar,
      public.club_assignment_role_label(a.structured_role_id, a.custom_role_name) as rl_label,
      /* §39: il contesto **attuale**, che può differire dall'origine. */
      case when a.scope_type = 'society' then 'Intera società' else ct.name end as ctx_label,
      coalesce(r.completed_at, a.created_at) as joined_at,
      lpad((extract(epoch from coalesce(r.completed_at, a.created_at)) * 1000)::bigint::text, 13, '0')
        || '|' || a.id::text as k
    from public.club_member_assignments a
    join public.profiles p on p.id = a.profile_id
    left join public.club_teams ct on ct.id = a.team_id
    left join public.club_team_join_redemptions r on r.id = a.source_redemption_id
    where a.source_join_link_id = p_link_id
      and a.status = 'active'
      and a.created_at <= v_as_of
      and public.member_invite_allows(v_club, 'roster_view', a.scope_type, a.team_id)
  )
  select
    k.rec_id,
    k.pr_id,
    k.pr_name,
    k.pr_avatar,
    k.rl_label,
    k.ctx_label,
    k.joined_at,
    k.k,
    public.team_join_people_cursor_encode(p_link_id, v_as_of, k.k),
    v_as_of,
    v_total
  from keyed k
  where v_after is null or k.k > v_after
  order by k.k
  limit v_limit;
end;
$$;

revoke all on function public.fetch_team_join_link_people_page(uuid, text, integer) from public;
grant execute on function public.fetch_team_join_link_people_page(uuid, text, integer) to authenticated;

drop function if exists public.fetch_team_join_link_person(uuid, uuid);

create function public.fetch_team_join_link_person(
  p_link_id       uuid,
  p_assignment_id uuid
)
returns table (
  assignment_id    uuid,
  profile_id       uuid,
  person_name      text,
  avatar_url       text,
  role_label       text,
  team_id          uuid,
  team_name        text,
  context_label    text,
  club_name        text,
  club_logo_url    text,
  club_is_verified boolean,
  source_team_name text,
  source_allowed_profile_types text[],
  connected_at     timestamptz,
  status           text,
  can_remove_role  boolean,
  access_verified_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club    uuid;
  v_team    uuid;
  v_current uuid;
  v_scope   text;
  v_scope_team uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select l.club_id, l.team_id into v_club, v_team
  from public.club_team_join_links l
  where l.id = p_link_id;

  if v_club is null
     or not public.team_join_link_allows(v_club, 'join_links_view', v_team)
     or not public.team_join_link_allows(v_club, 'roster_view', v_team)
  then
    raise exception 'JOIN_LINK_NOT_FOUND';
  end if;

  /* §39: dal contesto link si legge il **successore** della stessa linea. */
  select public.club_assignment_current_segment(p_assignment_id) into v_current;

  select a.scope_type, a.team_id into v_scope, v_scope_team
  from public.club_member_assignments a
  where a.id = v_current
    and a.source_join_link_id = p_link_id;

  if v_scope is null then
    raise exception 'JOIN_LINK_ASSIGNMENT_NOT_FOUND';
  end if;

  /* §39: «Per leggere/terminare il successore dal contesto link occorre
     accesso sia al link sia all'incarico corrente.» */
  if not public.member_invite_allows(v_club, 'roster_view', v_scope, v_scope_team) then
    raise exception 'JOIN_LINK_ASSIGNMENT_NOT_FOUND';
  end if;

  return query
  select
    a.id,
    a.profile_id,
    p.full_name,
    p.avatar_url,
    public.club_assignment_role_label(a.structured_role_id, a.custom_role_name),
    a.team_id,
    ct.name,
    case when a.scope_type = 'society' then 'Intera società' else ct.name end,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    srct.name,
    l.allowed_profile_types,
    coalesce(r.completed_at, a.created_at),
    a.status,
    /* §39: «Per leggere/terminare il successore dal contesto link occorre
       accesso sia al link sia all'incarico corrente.» La chiave è la
       stessa di DAS-REV-20, applicata all'ambito **corrente**. */
    a.status = 'active'
      and public.team_join_link_allows(v_club, 'assignments_remove', v_team)
      and public.member_invite_allows(
            v_club, 'assignments_remove', a.scope_type, a.team_id
          ),
    timezone('utc', now())
  from public.club_member_assignments a
  join public.club_team_join_links l on l.id = a.source_join_link_id
  join public.profiles p on p.id = a.profile_id
  join public.clubs c on c.id = a.club_id
  join public.club_teams srct on srct.id = l.team_id
  left join public.club_teams ct on ct.id = a.team_id
  left join public.club_team_join_redemptions r on r.id = a.source_redemption_id
  where a.id = v_current
    and a.source_join_link_id = p_link_id;
end;
$$;

revoke all on function public.fetch_team_join_link_person(uuid, uuid) from public;
grant execute on function public.fetch_team_join_link_person(uuid, uuid) to authenticated;

/*
 * §39: «Una vera rimozione societaria della linea derivata dal link applica
 * attraverso il servizio centrale la protezione di riutilizzo … Questo vale
 * anche se l'ultimo segmento era stato modificato o la rimozione avviene da
 * questi flussi di gestione.»
 *
 * La protezione di DAS-REV-20 è derivata, non memorizzata: nasce dal fatto
 * che il segmento corrente della linea sia `ended` con causa
 * REMOVED_BY_SOCIETY. Con `club_assignment_current_segment` nel resolver,
 * una rimozione fatta da `end_member_assignment` o da
 * `remove_person_from_society` la produce già, senza che il modulo link
 * debba saperne nulla. Qui si rende la stessa cosa vera nell'altra
 * direzione: la rimozione dal contesto link accetta il **successore**.
 */
create or replace function public.end_team_join_link_assignment(
  p_link_id         uuid,
  p_assignment_id   uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link    public.club_team_join_links%rowtype;
  v_current uuid;
  v_target  public.club_member_assignments%rowtype;
begin
  select * into v_link
  from public.club_team_join_links
  where id = p_link_id;

  if v_link.id is null then
    raise exception 'JOIN_LINK_NOT_FOUND';
  end if;

  if not public.team_join_link_allows(v_link.club_id, 'assignments_remove', v_link.team_id) then
    raise exception 'JOIN_LINK_REMOVE_NOT_AUTHORIZED';
  end if;

  select public.club_assignment_current_segment(p_assignment_id) into v_current;

  select * into v_target
  from public.club_member_assignments
  where id = v_current
    and source_join_link_id = p_link_id;

  if v_target.id is null then
    raise exception 'JOIN_LINK_ASSIGNMENT_NOT_FOUND';
  end if;

  /* La terminazione passa dal servizio condiviso: causa, proiezione,
     audit e notifica sono gli stessi di ogni altra rimozione societaria. */
  return public.end_member_assignment(v_target.id, null, p_idempotency_key);
end;
$$;

revoke all on function public.end_team_join_link_assignment(uuid, uuid, text) from public;
grant execute on function public.end_team_join_link_assignment(uuid, uuid, text) to authenticated;


-- ============================================================
-- SEZIONE 25 — Lifecycle delle squadre (§25)
--
-- «Le richieste ancora approvabili sul Team partecipano agli impedimenti
-- alla disattivazione già gestiti dal lifecycle squadre … Creazione
-- richiesta, approvazione, aggiunta/cambio ruolo, join e disattivazione
-- condividono guard compatibili.»
--
-- Due punti, entrambi preesistenti e qui soltanto estesi:
--
--   · il trigger `guard_team_is_active`, che è la metà scrivente della
--     sezione critica — il `for share` sulla squadra fa sì che una
--     disattivazione concorrente non possa commitare sotto una richiesta
--     appena creata (DAS-REV-10);
--   · `check_team_deactivation`, che è la metà consultabile.
--
-- Riscritte da 20261031090000_team_join_links.sql, con il solo ramo nuovo.
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
  elsif tg_table_name = 'club_role_requests' then
    /* DAS-REV-21 §25: una richiesta ancora approvabile è attività che una
       squadra archiviata non può ricevere. */
    v_team_id  := new.team_id;
    v_relevant := new.status = 'pending';
  elsif tg_table_name = 'club_member_invites' then
    v_team_id  := new.team_id;
    v_relevant := new.status = 'pending';
  elsif tg_table_name = 'club_member_assignments' then
    v_team_id  := new.team_id;
    v_relevant := new.status = 'active';
  elsif tg_table_name = 'club_team_join_links' then
    v_team_id := new.team_id;

    if new.status = 'active' then
      if tg_op = 'INSERT' then
        v_relevant := true;
      else
        v_relevant := old.expires_at is distinct from new.expires_at
          or old.max_redemptions is distinct from new.max_redemptions;
      end if;
    end if;
  end if;

  if v_team_id is null or not v_relevant then
    return new;
  end if;

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

    if tg_table_name = 'club_role_requests' and old.status = 'pending' then
      return new;
    end if;

    if tg_table_name = 'club_member_invites' and old.status = 'pending' then
      return new;
    end if;

    if tg_table_name = 'club_member_assignments' and old.status = 'active' then
      return new;
    end if;

    /*
     * Nessuna scorciatoia per `club_team_join_links`: il ramo sopra ha già
     * ristretto la rilevanza alle due modifiche che possono restituire
     * disponibilità, ed è esattamente ciò che su una squadra archiviata non
     * deve riuscire.
     */
  end if;

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

drop trigger if exists club_team_join_links_guard_team_active
  on public.club_team_join_links;

create trigger club_team_join_links_guard_team_active
  before insert or update on public.club_team_join_links
  for each row
  execute function public.guard_team_is_active();

drop trigger if exists club_role_requests_guard_team_active
  on public.club_role_requests;

create trigger club_role_requests_guard_team_active
  before insert or update on public.club_role_requests
  for each row
  execute function public.guard_team_is_active();

create or replace function public.check_team_deactivation(p_team_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club       uuid;
  v_archived   boolean;
  v_positions  integer;
  v_invites    integer;
  v_join_links integer;
  v_pos_view   boolean;
  v_inv_view   boolean;
  v_link_view  boolean;
  v_blockers   jsonb := '[]'::jsonb;
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

  v_pos_view  := public.team_capability_allows(v_club, p_team_id, 'positions_view');
  v_inv_view  := public.team_capability_allows(v_club, p_team_id, 'invites_view');
  v_link_view := public.team_capability_allows(v_club, p_team_id, 'join_links_view');

  select count(*)::integer into v_positions
  from public.recruiting_ads ad
  where ad.team_id = p_team_id
    and public.recruiting_ad_is_available(ad.status, ad.application_deadline_at);

  /* §34: tutto ciò che può ancora produrre un incarico su questa squadra. */
  select
    (
      select count(*)::integer
      from public.club_member_invites inv
      where inv.team_id = p_team_id and inv.status = 'pending'
    )
    + (
      select count(*)::integer
      from public.club_members cm
      where cm.team_id = p_team_id
        and cm.status = 'pending'
        and cm.added_by = 'self_request'
        and cm.profile_id is not null
    )
    /* DAS-REV-21 §25: le richieste di conferma del ruolo ancora
       approvabili possono produrre un incarico su questa squadra. */
    + (
      select count(*)::integer
      from public.club_role_requests rr
      where rr.team_id = p_team_id and rr.status = 'pending'
    )
  into v_invites;

  /*
   * DAS-REV-20 §37: solo i link **realmente utilizzabili**. La squadra qui
   * è ancora attiva — il ramo `v_archived` è già uscito — quindi
   * l'indisponibilità strutturale non va simulata.
   */
  select count(*)::integer into v_join_links
  from public.club_team_join_links l
  where l.team_id = p_team_id
    and public.team_join_link_availability(
          l.status, false, l.expires_at,
          l.max_redemptions, l.completed_redemptions_count
        ) = 'available';

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

  if v_join_links > 0 then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'kind',  'join_links',
      'count', case when v_link_view then v_join_links end,
      'can_open', v_link_view
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
-- SEZIONE 26 — Notifiche (§41)
--
-- «Riutilizza il Centro Notifiche e l'outbox/event bus esistenti.» Gli undici
-- tipi nuovi vanno aggiunti a **entrambe** le scale: senza la seconda
-- cadrebbero in `sistema` e sfuggirebbero alle preferenze dell'utente.
--
-- Tutti in categoria `richieste`: §41 — «Il badge Messaggi non aumenta per
-- questi eventi; il Centro Notifiche usa il proprio stato».
--
-- Riscritta da 20261031090000_team_join_links.sql, con i soli rami nuovi.
-- ============================================================

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
-- SEZIONE 27 — Dati esistenti (§48)
--
-- «La migrazione deve essere non distruttiva, versionata, idempotente o
-- protetta da esecuzioni multiple, verificabile in ambiente di test e
-- reversibile quando lo stack lo consente.»
--
-- Tre backfill, tutti dimostrabili dai riferimenti esistenti:
--
--   · `lineage_id` = `id` (SEZIONE 3): ogni incarico preesistente è una
--     linea di un segmento solo, che è ciò che era. §48 — «Se mancano
--     lineage/versioni, ricostruisci soltanto ciò che è dimostrabile dai
--     riferimenti esistenti. Non dedurre una catena storica dai soli nomi o
--     da date simili»: nessun `predecessor_id` viene inventato, e di
--     conseguenza «Ripristina ruolo precedente» resta nascosto sulle linee
--     storiche, come §48 prevede;
--
--   · `change_source = 'initial'` sugli incarichi esistenti: nessuno di
--     essi è il risultato di una modifica, perché le modifiche non
--     esistevano;
--
--   · `assignments_revision`: parte da 1 per tutti. Non è una ricostruzione
--     storica ma un contatore di concorrenza, e un valore iniziale comune
--     non afferma nulla sul passato.
--
-- Nessuna lettura viene attribuita a un amministratore senza prova (§48:
-- «Per is_read globale non inventare letture individuali»): la tabella delle
-- letture nasce vuota, e «Nuova» su una richiesta canonica è vera per tutti
-- finché qualcuno non la apre — il che è corretto, perché nessuno l'ha
-- aperta: le richieste canoniche nascono con questa migrazione.
-- ============================================================

update public.club_member_assignments
set change_source = 'initial'
where change_source is null;

/*
 * Verifica di integrità post-migrazione (§48: «verificabile in ambiente di
 * test»). Fallisce la migrazione invece di lasciare dati incoerenti.
 */
do $$
declare
  v_orphan_lineage integer;
  v_double_active  integer;
begin
  select count(*)::integer into v_orphan_lineage
  from public.club_member_assignments
  where lineage_id is null;

  if v_orphan_lineage > 0 then
    raise exception 'DAS-REV-21: % incarichi senza lineage_id', v_orphan_lineage;
  end if;

  select count(*)::integer into v_double_active
  from (
    select lineage_id
    from public.club_member_assignments
    where status = 'active'
    group by lineage_id
    having count(*) > 1
  ) d;

  if v_double_active > 0 then
    raise exception 'DAS-REV-21: % linee con più segmenti attivi', v_double_active;
  end if;
end;
$$;


-- ============================================================
-- SEZIONE 28 — Superficie esposta
--
-- Le funzioni di supporto delle sezioni 8-10, 20-21 e 24 non hanno `grant`:
-- girano dentro le definer che le chiamano, con i privilegi del proprietario.
-- Esporle darebbe al client un modo per leggere l'esistenza di un incarico
-- fuori dal proprio perimetro (§47: «Le risposte sui duplicati non devono
-- rivelare proposte o incarichi fuori dal perimetro dell'actor») o per
-- marcare una proposta come soddisfatta altrove senza che nulla la soddisfi.
--
-- Esposte sono soltanto le ventitré RPC che le schermate chiamano davvero.
-- ============================================================

do $$
declare
  v_missing text;
begin
  /* Guardia di consegna: un `grant` dimenticato è un 403 a runtime su una
     schermata, e non lo vede nessun typecheck. */
  select string_agg(f.name, ', ')
  into v_missing
  from (values
    ('fetch_society_role_link_state'),
    ('fetch_role_request_identities'),
    ('fetch_role_request_teams'),
    ('create_role_confirmation_request'),
    ('fetch_my_role_request'),
    ('fetch_my_club_role_requests'),
    ('cancel_my_role_request'),
    ('fetch_society_role_request'),
    ('mark_society_role_request_read'),
    ('approve_role_request'),
    ('decline_role_request'),
    ('fetch_my_societies'),
    ('fetch_my_society_roles'),
    ('fetch_my_assignment'),
    ('update_member_assignment'),
    ('add_member_assignment'),
    ('end_member_assignment'),
    ('leave_society'),
    ('remove_person_from_society'),
    ('restore_member_assignment'),
    ('fetch_society_person_link'),
    ('fetch_society_assignment'),
    ('fetch_society_wide_members')
  ) as f(name)
  where not exists (
    select 1
    from pg_proc pr
    join pg_namespace n on n.oid = pr.pronamespace
    where n.nspname = 'public'
      and pr.proname = f.name
      and has_function_privilege('authenticated', pr.oid, 'execute')
  );

  if v_missing is not null then
    raise exception 'DAS-REV-21: RPC senza grant per authenticated: %', v_missing;
  end if;
end;
$$;


-- ============================================================
-- SEZIONE 29 — Ingresso agli incarichi societari (§32)
--
-- L'Organico esistente è per squadra: un Dirigente con ambito Intera società
-- non vi compare, perché non ha un Team. §32 chiede di completare la
-- destinazione «usando gli stessi componenti e lo stesso dominio»; la
-- lettura è `fetch_society_wide_members` della SEZIONE 23, e qui nasce la
-- riga che la raggiunge dall'hub Struttura societaria.
--
-- La funzione viene **ricreata** e non sostituita: cambia la riga definita
-- dai parametri OUT, e `create or replace` risponderebbe 42P13. Il corpo è
-- quello di 20261024090000_society_admin_center.sql, con la sola colonna
-- nuova in coda — l'ordine posizionale delle altre resta identico.
-- ============================================================

drop function if exists public.fetch_society_structure(uuid);

create function public.fetch_society_structure(p_club_id uuid)
returns table (
  club_id                     uuid,
  club_name                   text,
  club_logo_url               text,
  club_city                   text,
  club_is_verified            boolean,
  scope_label                 text,
  can_view_teams              boolean,
  can_view_seasons            boolean,
  can_view_network            boolean,
  can_view_requests           boolean,
  can_view_admins             boolean,
  can_view_admin_invites      boolean,
  can_open_admin_center       boolean,
  can_view_company_data       boolean,
  can_edit_company_data       boolean,
  admins_count                integer,
  admin_invites_pending_count integer,
  signals                     jsonb,
  access_verified_at          timestamptz,
  data_revision               bigint,
  /*
   * DAS-REV-21 §32: «Gli incarichi Dirigente Intera società si raggiungono
   * dall'area societaria appropriata, senza Team fittizio.» La riga esiste
   * solo per chi può davvero leggere quell'organico — §32 vieta di
   * «dichiarare completo il percorso con una CTA non funzionante», e un
   * perimetro di sole squadre non copre un incarico societario.
   */
  can_view_society_roles      boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_caps       text[];
  v_net        text[];
  v_owner      boolean;
  v_manage     boolean;
  v_teams      boolean;
  v_network    boolean;
  v_requests   boolean;
  v_company    boolean;
  v_admins     boolean;
  v_invites    boolean;
  v_invite     boolean;
  v_scope      uuid[];
  v_season     text := public.current_season_id();
  v_next       text := public.next_season_id();
  v_now        timestamptz := timezone('utc', now());
  v_signals    jsonb := '[]'::jsonb;
  v_req_count  integer;
  v_req_row    record;
  v_team_row   record;
  v_cur_count  integer;
  v_next_count integer;
begin
  if v_uid is null then
    raise exception 'STRUCTURE_NOT_AUTHORIZED';
  end if;

  if p_club_id is null then
    raise exception 'STRUCTURE_NOT_AUTHORIZED';
  end if;

  v_caps   := public.dashboard_club_capabilities(p_club_id);
  v_net    := public.society_network_capabilities(p_club_id);
  v_owner  := public.owns_club(p_club_id);
  v_manage := public.can_manage_society(p_club_id);

  v_teams    := 'teams_view' = any (v_caps);
  v_network  := 'network_view' = any (v_net);
  v_requests := 'network_requests_view' = any (v_net);

  -- DAS-REV-13 §23: tre controlli distinti, non piu l'ownership come proxy.
  v_admins   := public.society_admin_allows(p_club_id, 'admins_view');
  v_invites  := public.society_admin_allows(p_club_id, 'admin_invites_view');
  v_invite   := public.society_admin_allows(p_club_id, 'admins_invite');

  -- §7, riga «Dati societari nell'hub»: «Lettura dei dati master **nel
  -- contesto gestionale autorizzato**.» Il contesto gestionale della Società
  -- è quello di chi la amministra per intero — Owner o delega senza
  -- restrizione di squadra. Una delega limitata a un Team opera dentro quel
  -- Team: §7 vuole che veda «la Society corrente» e l'ambito, non il blocco
  -- dei dati societari (master 05, dove è presente il solo dominio Squadre).
  /*
   * ATTENZIONE: questa riga non è quella di 20261024090000.
   *
   * 20261025090000_society_roles_permissions.sql §11 **riscrive a runtime**
   * `fetch_society_structure` sostituendo proprio questo predicato con
   * `society_can_read_company_data`, invece di duplicarne 370 righe. Chi
   * ricrea la funzione partendo dal file del 24 ottobre ripristina senza
   * accorgersene il predicato pre-DAS-REV-14, e la lettura dei dati master
   * torna a ignorare la chiave `society_profile_view`.
   *
   * La sostituzione è quindi applicata qui, alla fonte.
   */
  v_company := public.society_can_read_company_data(p_club_id);

  -- §7: «Aprire l'hub richiede accesso organizzativo valido alla Society e
  -- almeno un dominio autorizzato.» Il dominio "Dati della società" non
  -- conta: da solo non è una struttura da gestire.
  if not (v_teams or v_network or v_requests or v_owner
          or v_admins or v_invites or v_invite) then
    raise exception 'STRUCTURE_NOT_AUTHORIZED';
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, 'teams_view');

  -- ── Segnale 1: richieste ricevute da valutare (§13, master 03) ────────
  --
  -- Il conteggio è quello delle richieste **ricevute**, pending e gestibili
  -- dalla Society destinataria: il summary della rete può mostrarne due
  -- perché somma anche quella inviata, che non è un'attività di questo actor.
  if v_requests and 'network_request_manage' = any (v_net) then
    select count(*)::integer into v_req_count
    from public.club_relationships r
    where r.status = 'pending'
      and r.recipient_club_id = p_club_id;

    if v_req_count = 1 then
      select
        r.id            as relationship_id,
        t.label         as type_label,
        other.name      as counterpart_name
      into v_req_row
      from public.club_relationships r
      join public.club_relationship_types t on t.id = r.type_id
      join public.clubs other
        on other.id = case
             when r.club_a_id = p_club_id then r.club_b_id
             else r.club_a_id
           end
      where r.status = 'pending'
        and r.recipient_club_id = p_club_id
      limit 1;

      -- La riga può essere sparita fra il conteggio e la lettura: senza
      -- riferimento canonico il segnale non si disegna (§14: «Ogni azione
      -- deve risolvere un target noto»).
      if found then
        v_signals := v_signals || jsonb_build_array(jsonb_build_object(
          'id',              'network_request:' || v_req_row.relationship_id::text,
          'kind',            'network_request',
          'title',           '1 richiesta da valutare',
          'context',         v_req_row.counterpart_name || ' · ' || v_req_row.type_label,
          'action_label',    'Valuta richiesta',
          'count',           1,
          'club_id',         p_club_id,
          'relationship_id', v_req_row.relationship_id,
          'team_id',         null,
          'season_target',   null,
          'sort',            1
        ));
      end if;
    elsif v_req_count > 1 then
      -- §13: «Se il segnale aggrega più richieste, usa titolo e destinazione
      -- coerenti con il gruppo … Non mostrare il nome di una sola controparte
      -- come se rappresentasse l'intero gruppo.»
      v_signals := v_signals || jsonb_build_array(jsonb_build_object(
        'id',              'network_requests',
        'kind',            'network_requests',
        'title',           v_req_count::text || ' richieste da valutare',
        'context',         null,
        'action_label',    'Vedi richieste',
        'count',           v_req_count,
        'club_id',         p_club_id,
        'relationship_id', null,
        'team_id',         null,
        'season_target',   null,
        'sort',            1
      ));
    end if;
  end if;

  -- ── Segnali stagionali (§13) ──────────────────────────────────────────
  --
  -- Due condizioni distinte e realmente azionabili, entrambe già esposte dal
  -- Centro Stagioni: la stagione **corrente** non configurata per una
  -- squadra attiva, e la stagione **successiva** preparabile secondo il
  -- catalogo centrale.
  --
  -- Il catalogo è server-side (`current_season_id` confronta `current_date`
  -- con le date della stagione): §13 vieta di «generare un'urgenza universale
  -- al cambio dell'anno del dispositivo», e qui l'orologio del dispositivo
  -- non entra mai nella decisione.
  if v_teams and 'seasons_prepare' = any (v_caps) and v_season is not null then
    select count(*)::integer into v_cur_count
    from public.club_teams ct
    where ct.club_id = p_club_id
      and not ct.is_archived
      and (v_scope is null or ct.id = any (v_scope))
      and not exists (
        select 1 from public.club_team_seasons cts
        where cts.team_id = ct.id and cts.season_id = v_season
      );

    if v_cur_count = 1 then
      select ct.id as team_id, ct.name as name into v_team_row
      from public.club_teams ct
      where ct.club_id = p_club_id
        and not ct.is_archived
        and (v_scope is null or ct.id = any (v_scope))
        and not exists (
          select 1 from public.club_team_seasons cts
          where cts.team_id = ct.id and cts.season_id = v_season
        )
      limit 1;

      if found then
        v_signals := v_signals || jsonb_build_array(jsonb_build_object(
          'id',              'season_configure:' || v_team_row.team_id::text,
          'kind',            'team_season',
          'title',           v_team_row.name || ' — stagione '
                               || (select s.label from public.seasons s where s.id = v_season)
                               || ' da configurare',
          'context',         null,
          'action_label',    'Configura stagione',
          'count',           1,
          'club_id',         p_club_id,
          'relationship_id', null,
          'team_id',         v_team_row.team_id,
          'season_target',   'current',
          'sort',            2
        ));
      end if;
    elsif v_cur_count > 1 then
      v_signals := v_signals || jsonb_build_array(jsonb_build_object(
        'id',              'season_configure',
        'kind',            'seasons_center',
        'title',           v_cur_count::text || ' squadre da configurare',
        'context',         'Stagione '
                             || (select s.label from public.seasons s where s.id = v_season),
        'action_label',    'Apri stagioni',
        'count',           v_cur_count,
        'club_id',         p_club_id,
        'relationship_id', null,
        'team_id',         null,
        'season_target',   'current',
        'sort',            2
      ));
    end if;

    -- La stagione successiva esiste nel catalogo soltanto quando è stata
    -- censita: `next_season_id()` restituisce null altrimenti, e §13 vieta di
    -- fabbricarne una («Non generare … il numero di stagione è un esempio:
    -- usa il catalogo centrale»).
    if v_next is not null then
      select count(*)::integer into v_next_count
      from public.club_teams ct
      where ct.club_id = p_club_id
        and not ct.is_archived
        and (v_scope is null or ct.id = any (v_scope))
        and not exists (
          select 1 from public.club_team_seasons cts
          where cts.team_id = ct.id and cts.season_id = v_next
        );

      if v_next_count = 1 then
        select ct.id as team_id, ct.name as name into v_team_row
        from public.club_teams ct
        where ct.club_id = p_club_id
          and not ct.is_archived
          and (v_scope is null or ct.id = any (v_scope))
          and not exists (
            select 1 from public.club_team_seasons cts
            where cts.team_id = ct.id and cts.season_id = v_next
          )
        limit 1;

        if found then
          v_signals := v_signals || jsonb_build_array(jsonb_build_object(
            'id',              'season_prepare:' || v_team_row.team_id::text,
            'kind',            'team_season',
            'title',           v_team_row.name || ' — stagione '
                                 || (select s.label from public.seasons s where s.id = v_next)
                                 || ' da preparare',
            'context',         null,
            'action_label',    'Prepara stagione',
            'count',           1,
            'club_id',         p_club_id,
            'relationship_id', null,
            'team_id',         v_team_row.team_id,
            'season_target',   'next',
            'sort',            3
          ));
        end if;
      elsif v_next_count > 1 then
        v_signals := v_signals || jsonb_build_array(jsonb_build_object(
          'id',              'season_prepare',
          'kind',            'seasons_center',
          'title',           v_next_count::text || ' squadre da preparare',
          'context',         'Stagione '
                               || (select s.label from public.seasons s where s.id = v_next),
          'action_label',    'Apri stagioni',
          'count',           v_next_count,
          'club_id',         p_club_id,
          'relationship_id', null,
          'team_id',         null,
          'season_target',   'next',
          'sort',            3
        ));
      end if;
    end if;
  end if;

  return query
  select
    c.id,
    c.name,
    c.logo_url,
    c.city,
    coalesce(c.verification_status, 'unverified') = 'verified',
    public.dashboard_club_scope_label(p_club_id),
    v_teams,
    -- §9: «Rivalida ogni accesso in modo indipendente.» Oggi il Centro
    -- Stagioni è gated sulla stessa chiave del Centro Squadre
    -- (`fetch_seasons_center` ritorna can_view = false senza `teams_view`):
    -- le due colonne restano separate nel contratto perché DAS-REV-14 può
    -- separarle davvero, e l'hub non deve cambiare forma quando accadrà.
    v_teams,
    v_network,
    v_requests,
    -- DAS-REV-13 §23: ora le tre letture hanno chiavi proprie e vanno
    -- valutate separatamente. «La possibilità di leggere gli attivi, leggere
    -- gli inviti, invitare e aprire Ruoli e permessi può essere distinta.»
    v_admins,
    v_invites,
    (v_admins or v_invites or v_invite),
    -- §12 separa lettura e modifica: la sintesi resta visibile a chi non
    -- può modificarla, e l'azione sparisce — non un pulsante disabled.
    v_company,
    v_company and v_manage,
    case when v_admins then (
      select count(*)::integer from public.society_structure_admin_ids(p_club_id)
    ) end,
    case when v_invites then (
      -- DAS-REV-13 §7.2: inviti amministrativi ancora **validi**, dal
      -- dominio che li possiede. Prima si contavano righe `club_members`
      -- pending con grant: una combinazione che la RLS di
      -- `club_member_permissions` non permette di creare, quindi il numero
      -- valeva sempre zero. La scadenza è valutata sull'orologio server e
      -- non attende un job di pulizia.
      select count(*)::integer
      from public.club_admin_invites inv
      where inv.club_id = p_club_id
        and public.club_admin_invite_state(inv.status, inv.expires_at) = 'pending'
    ) end,
    -- §13: massimo tre, ordine stabile. Il limite è applicato **dopo** il
    -- filtro per identity, scope e capability, non prima.
    (
      select coalesce(jsonb_agg(entry order by (entry->>'sort')::int), '[]'::jsonb)
      from (
        select entry
        from jsonb_array_elements(v_signals) as t(entry)
        order by (entry->>'sort')::int
        limit 3
      ) limited
    ),
    v_now,
    -- Revisione monotona: copre le sorgenti che l'hub possiede davvero —
    -- membership/grant e dati master. Squadre, stagioni e rete hanno la
    -- propria revisione dentro i rispettivi provider.
    greatest(
      (extract(epoch from c.updated_at)::bigint),
      (
        select coalesce(extract(epoch from max(cm.updated_at))::bigint, 0)
        from public.club_members cm
        where cm.club_id = p_club_id
      ),
      (
        select coalesce(extract(epoch from max(inv.updated_at))::bigint, 0)
        from public.club_admin_invites inv
        where inv.club_id = p_club_id
      ),
      (
        select coalesce(extract(epoch from max(m.updated_at))::bigint, 0)
        from public.club_admin_memberships m
        where m.club_id = p_club_id
      )
    ),
    public.member_invite_allows(p_club_id, 'roster_view', 'society', null)
  from public.clubs c
  where c.id = p_club_id;
end;
$$;

revoke all on function public.fetch_society_structure(uuid) from public;
grant execute on function public.fetch_society_structure(uuid) to authenticated;


-- ============================================================
-- SEZIONE 30 — Revisione del catalogo dei permessi (DAS-REV-14 §7)
--
-- «Va incrementata da ogni migrazione che cambia il catalogo.» Questa ne
-- aggiunge tre controlli, quindi la porta da 2 a 3. Il valore è
-- **assegnato** e non incrementato: una migrazione deve poter essere
-- rieseguita senza cambiare risultato.
-- ============================================================

insert into public.app_policy_settings (key, value, description)
values (
  'admin_permission_catalog_revision',
  to_jsonb(3),
  'DAS-REV-14 §7 — revisione della tassonomia aree/controlli/chiavi. Va '
  'incrementata da ogni migrazione che cambia il catalogo.'
)
on conflict (key) do update set value = to_jsonb(3);
