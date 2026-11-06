-- ============================================================
-- DAS-REV-19 — Centro Inviti e scambio con utenti registrati
--
-- La Società propone a una persona già registrata un **incarico sportivo
-- preciso**; la persona lo legge e risponde. Solo un'accettazione valida crea
-- il rapporto. Niente link, niente destinatari esterni, niente scadenza:
-- §11 vieta esplicitamente un lifecycle a tempo per questo invito V1, e
-- DAS-REV-20 possiede il percorso via link.
--
-- Cinque oggetti distinti, come impone §7 — e la distinzione è l'intero punto
-- della task, perché oggi il progetto li tiene tutti dentro una riga sola:
--
--   Invitation           → `club_member_invites`        (la proposta)
--   ConnectionRequest    → `club_members` self_request  (canonico, DAS-REV-21)
--   SocietyMembership    → `club_members`               (relazione Persona↔Società)
--   MembershipAssignment → `club_member_assignments`    (incarico: ruolo + ambito)
--   Accesso amministrativo → `club_admin_memberships`   (invariato, altro dominio)
--
-- Perché un **nuovo** oggetto Invitation e non la riga `club_members`
-- pending usata finora: quella riga è contemporaneamente la proposta e la
-- relazione, e §24 vieta che creare un invito tocchi l'organico. Soprattutto,
-- `club_members_unique_profile (club_id, profile_id)` è tuttora attivo — una
-- persona ha **una** riga per club — mentre §7 chiede che possa avere più
-- incarichi reali nella stessa Società. Senza una tabella di incarichi,
-- «Calciatore della Prima squadra» e «Collaboratore tecnico della Primavera»
-- non possono coesistere.
--
-- Perché `club_member_assignments` e non più colonne su `club_members`:
-- le colonne `member_role`/`team_id`/`staff_title` restano dove sono e
-- diventano la **proiezione** dell'incarico principale, con lo stesso
-- criterio che DAS-REV-08 ha usato per `club_team_seasons` (fonte scrivibile
-- nuova, colonne vecchie a proiezione). Nessuna lettura esistente si rompe.
--
-- Le righe pending storiche **non** vengono distrutte: la SEZIONE 11 le
-- rispecchia in `club_member_invites` con `legacy_member_id`, e accettarle
-- riusa quella stessa riga invece di inserirne una seconda — che l'indice
-- unico rifiuterebbe comunque.
--
-- Rollback: le tabelle nuove sono isolate; le funzioni ridefinite tornano
-- alla versione della migrazione citata accanto a ciascuna.
--
-- Convenzioni riusate:
--   20261024090000_society_admin_center.sql  (invito come record, revision,
--                                             audit, notifica strutturale)
--   20261025090000_society_roles_permissions.sql (catalogo area→controllo→chiave)
--   20261026090000_society_positions_center.sql  (cursore firmato, scope
--                                             applicato prima di paginare)
--   20261021090000_team_seasons_lifecycle.sql    (guard trigger + for update)
--   20261022090000_society_network.sql           (idempotenza a chiave+fingerprint)
-- ============================================================


-- ============================================================
-- SEZIONE 1 — Capability (§8)
--
-- §8 chiede di distinguere «consultare inviti, creare inviti, annullare
-- inviti, consultare richieste ricevute, leggere gli incarichi, consultare i
-- Team». Quattro esistono già (`invites_view`, `invites_create`,
-- `roster_view`, `teams_view`); ne mancano due, ed è esattamente la coppia
-- che §8 vieta di dedurre da un generico Gestisci:
--
--   `invites_cancel`        — annullare un pending altrui;
--   `member_requests_view`  — leggere le richieste ricevute dalle persone.
--
-- Backfill non regressivo, con lo stesso criterio di DAS-REV-16: chi oggi
-- può invitare poteva già annullare (la riga pending era sua da cancellare),
-- e chi vede gli inviti vedeva già le richieste nello stesso schermo legacy.
-- La chiave serve a **togliere** il diritto a qualcuno, non a toglierlo a
-- tutti con un deploy.
--
-- Nello stesso punto si corregge un difetto di DAS-REV-16: `positions_publish`
-- è stato aggiunto al CHECK e al catalogo dei controlli, ma **non** alla
-- whitelist di `dashboard_club_capabilities`. Un delegato con "Pubblica
-- posizioni" non riceveva mai la chiave e non poteva pubblicare; funzionava
-- il solo Owner, che la funzione serve prima della whitelist. È un difetto
-- della chiave, non una regola: va corretto dove la whitelist viene comunque
-- riscritta.
-- ============================================================

alter table public.club_member_permissions
  drop constraint if exists club_member_permissions_key_check;

alter table public.club_member_permissions
  add constraint club_member_permissions_key_check
  check (permission_key in (
    'shortlist_view', 'shortlist_create_lists', 'shortlist_add_profiles',
    'shortlist_add_notes', 'shortlist_edit_status', 'shortlist_remove_profiles',
    'notif_new_applications', 'notif_shortlist_updates', 'notif_connection_requests',
    'notif_store_orders', 'notif_content_tags', 'notif_affiliations',
    'notif_profile_verifications',
    'society_manage_profile', 'society_manage_positions', 'society_publish_media',
    'dashboard_view', 'positions_view', 'positions_create', 'positions_publish',
    'applications_view',
    'teams_view', 'content_view', 'content_create', 'invites_create', 'invites_view',
    'teams_create', 'teams_edit', 'roster_view',
    'seasons_prepare', 'seasons_history_view', 'seasons_history_edit',
    'seasons_history_add', 'teams_lifecycle',
    'network_view', 'network_requests_view', 'network_request_send',
    'network_request_manage', 'network_request_cancel', 'network_invite_create',
    'network_terminate', 'network_history_view',
    'admins_view', 'admin_invites_view', 'admins_invite', 'admin_roles_view',
    'admin_roles_manage', 'admins_assign_role', 'admins_manage_scope',
    'admins_revoke', 'admin_invites_cancel',
    'society_profile_view',
    -- DAS-REV-19 §8 — nuove
    'invites_cancel', 'member_requests_view'
  ));

alter table public.club_admin_role_permissions
  drop constraint if exists club_admin_role_permissions_key_check;

alter table public.club_admin_role_permissions
  add constraint club_admin_role_permissions_key_check
  check (permission_key in (
    'shortlist_view', 'shortlist_create_lists', 'shortlist_add_profiles',
    'shortlist_add_notes', 'shortlist_edit_status', 'shortlist_remove_profiles',
    'notif_new_applications', 'notif_shortlist_updates', 'notif_connection_requests',
    'notif_store_orders', 'notif_content_tags', 'notif_affiliations',
    'notif_profile_verifications',
    'society_manage_profile', 'society_manage_positions', 'society_publish_media',
    'dashboard_view', 'positions_view', 'positions_create', 'positions_publish',
    'applications_view',
    'teams_view', 'content_view', 'content_create', 'invites_create', 'invites_view',
    'teams_create', 'teams_edit', 'roster_view',
    'seasons_prepare', 'seasons_history_view', 'seasons_history_edit',
    'seasons_history_add', 'teams_lifecycle',
    'network_view', 'network_requests_view', 'network_request_send',
    'network_request_manage', 'network_request_cancel', 'network_invite_create',
    'network_terminate', 'network_history_view',
    'admins_view', 'admin_invites_view', 'admins_invite', 'admin_roles_view',
    'admin_roles_manage', 'admins_assign_role', 'admins_manage_scope',
    'admins_revoke', 'admin_invites_cancel',
    'society_profile_view',
    'invites_cancel', 'member_requests_view'
  ));

insert into public.club_permission_controls
  (id, area_id, label, helper, bundle, requires, sort_order, is_available) values
  ('roster_invite_cancel', 'roster_invites', 'Annulla inviti in attesa',
     'Necessario per visualizzare l''organico',
     'manage', array['roster_read'], 3, true),
  ('roster_requests_read', 'roster_invites', 'Visualizza richieste ricevute',
     'Necessario per visualizzare l''organico',
     'view', array['roster_read'], 4, true)
on conflict (id) do update
  set area_id      = excluded.area_id,
      label        = excluded.label,
      helper       = excluded.helper,
      bundle       = excluded.bundle,
      requires     = excluded.requires,
      sort_order   = excluded.sort_order,
      is_available = excluded.is_available;

insert into public.club_permission_control_keys (control_id, permission_key) values
  ('roster_invite_cancel', 'invites_cancel'),
  ('roster_requests_read', 'member_requests_view')
on conflict do nothing;

-- Chi poteva invitare poteva già annullare la propria riga pending.
insert into public.club_member_permissions (club_id, profile_id, permission_key, team_id)
select p.club_id, p.profile_id, 'invites_cancel', p.team_id
from public.club_member_permissions p
where p.permission_key = 'invites_create'
  and not exists (
    select 1 from public.club_member_permissions q
    where q.club_id = p.club_id
      and q.profile_id = p.profile_id
      and q.permission_key = 'invites_cancel'
      and q.team_id is not distinct from p.team_id
  );

-- Chi vedeva gli inviti vedeva già le richieste: erano lo stesso schermo.
insert into public.club_member_permissions (club_id, profile_id, permission_key, team_id)
select p.club_id, p.profile_id, 'member_requests_view', p.team_id
from public.club_member_permissions p
where p.permission_key = 'invites_view'
  and not exists (
    select 1 from public.club_member_permissions q
    where q.club_id = p.club_id
      and q.profile_id = p.profile_id
      and q.permission_key = 'member_requests_view'
      and q.team_id is not distinct from p.team_id
  );

insert into public.club_admin_role_permissions (role_id, permission_key)
select distinct r.role_id, 'invites_cancel'
from public.club_admin_role_permissions r
where r.permission_key = 'invites_create'
  and not exists (
    select 1 from public.club_admin_role_permissions q
    where q.role_id = r.role_id and q.permission_key = 'invites_cancel'
  );

insert into public.club_admin_role_permissions (role_id, permission_key)
select distinct r.role_id, 'member_requests_view'
from public.club_admin_role_permissions r
where r.permission_key = 'invites_view'
  and not exists (
    select 1 from public.club_admin_role_permissions q
    where q.role_id = r.role_id and q.permission_key = 'member_requests_view'
  );


-- ============================================================
-- SEZIONE 2 — dashboard_club_capabilities (§8)
--
-- Riscritta da 20261025090000_society_roles_permissions.sql per includere le
-- due chiavi nuove e `positions_publish`. Nessun'altra differenza: il corpo,
-- il filtro di scope per area e `club_access_is_active` restano quelli.
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
      'admin_invites_cancel'
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
            'admin_invites_cancel'
          )
      ),
      array[]::text[]
    )
  end;
$$;

revoke all on function public.dashboard_club_capabilities(uuid) from public;
grant execute on function public.dashboard_club_capabilities(uuid) to authenticated;


-- ============================================================
-- SEZIONE 3 — Catalogo dei ruoli nell'incarico (§19, §20, §21)
--
-- §20 e §21 chiedono un «catalogo condiviso, con ID stabili e label
-- localizzate», e §21 del DoD che cataloghi e limiti siano «centralizzati e
-- coerenti fra client e server». Una tabella, non una costante duplicata in
-- TypeScript: il client la legge, il server la valida.
--
-- Non sostituisce le tassonomie di profilo (`STAFF_ROLE_OPTIONS`,
-- `DIRECTOR_ROLE_OPTIONS` dell'onboarding): quelle descrivono **chi è** una
-- persona nella sua carriera, questa descrive **quale incarico** una Società
-- le propone. Gli elenchi infatti differiscono — §21 esclude Presidente e
-- Vicepresidente dall'invito V1 senza toglierli dai profili.
--
-- Calciatore e Allenatore hanno una voce sola e statica: §19 vieta un
-- selector dove la scelta non esiste.
-- ============================================================

create table if not exists public.club_assignment_roles (
  id           text primary key,
  profile_type text not null check (profile_type in ('player', 'coach', 'staff', 'director')),
  label        text not null,
  /* La voce "Altro ruolo…": richiede un testo libero e non crea voci globali. */
  is_custom    boolean not null default false,
  sort_order   integer not null,
  is_available boolean not null default true
);

alter table public.club_assignment_roles enable row level security;

drop policy if exists "assignment roles readable" on public.club_assignment_roles;
create policy "assignment roles readable"
  on public.club_assignment_roles for select to authenticated using (true);

insert into public.club_assignment_roles (id, profile_type, label, is_custom, sort_order) values
  ('player',                   'player',   'Calciatore',              false,  1),
  ('coach',                    'coach',    'Allenatore',              false,  1),
  ('staff_fitness_coach',      'staff',    'Preparatore atletico',    false,  1),
  ('staff_goalkeeper_coach',   'staff',    'Preparatore dei portieri', false, 2),
  ('staff_assistant',          'staff',    'Collaboratore tecnico',   false,  3),
  ('staff_match_analyst',      'staff',    'Match analyst',           false,  4),
  ('staff_video_analyst',      'staff',    'Video analyst',           false,  5),
  ('staff_physiotherapist',    'staff',    'Fisioterapista',          false,  6),
  ('staff_doctor',             'staff',    'Medico',                  false,  7),
  ('staff_masseur',            'staff',    'Massofisioterapista',     false,  8),
  ('staff_nutritionist',       'staff',    'Nutrizionista',           false,  9),
  ('staff_sport_psychologist', 'staff',    'Psicologo dello sport',   false, 10),
  ('staff_other',              'staff',    'Altro ruolo staff',       true,  11),
  ('director_sporting',        'director', 'Direttore sportivo',      false,  1),
  ('director_general',         'director', 'Direttore generale',      false,  2),
  ('director_team_manager',    'director', 'Team manager',            false,  3),
  ('director_secretary',       'director', 'Segretario',              false,  4),
  ('director_youth_head',      'director', 'Responsabile settore giovanile', false, 5),
  ('director_technical_head',  'director', 'Responsabile area tecnica', false, 6),
  ('director_other',           'director', 'Altro ruolo dirigente',   true,   7)
on conflict (id) do update
  set profile_type = excluded.profile_type,
      label        = excluded.label,
      is_custom    = excluded.is_custom,
      sort_order   = excluded.sort_order,
      is_available = excluded.is_available;

/**
 * Limite del ruolo custom, in un posto solo (§20, DoD §21).
 *
 * Il client lo legge dal catalogo e non lo ricopia: due numeri diversi fra
 * client e server producono un form che accetta ciò che la RPC rifiuta.
 */
create or replace function public.club_assignment_custom_role_max()
returns integer
language sql
immutable
as $$ select 60 $$;

grant execute on function public.club_assignment_custom_role_max() to authenticated;

/**
 * Normalizzazione del ruolo custom (§20).
 *
 * «Trim, normalizzazione degli spazi, limite centralizzato, validazione e
 * sanitizzazione sono applicati client e server. Niente script, markup o
 * stringhe vuote composte da spazi.»
 *
 * I caratteri di controllo cadono, `<` e `>` cadono (non si "escapa" un
 * input che non deve contenere markup: lo si rifiuta), gli spazi multipli
 * diventano uno. Una stringa che si riduce a vuoto torna `null`, e il
 * chiamante la tratta come assente — non come stringa vuota valida.
 */
create or replace function public.normalize_assignment_custom_role(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    btrim(regexp_replace(
      regexp_replace(coalesce(p_value, ''), '[[:cntrl:]<>]', ' ', 'g'),
      '\s+', ' ', 'g'
    )),
    ''
  );
$$;

grant execute on function public.normalize_assignment_custom_role(text) to authenticated;

/**
 * Etichetta leggibile di un incarico: la label del catalogo, oppure il testo
 * custom quando la voce è "Altro…" (§20: «La label custom deve restare
 * leggibile in riepilogo, notifica, dettaglio e incarico creato»).
 */
create or replace function public.club_assignment_role_label(
  p_role_id text,
  p_custom  text
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case when r.is_custom then coalesce(public.normalize_assignment_custom_role(p_custom), r.label)
                  else r.label end
      from public.club_assignment_roles r
      where r.id = p_role_id
    ),
    public.normalize_assignment_custom_role(p_custom)
  );
$$;

revoke all on function public.club_assignment_role_label(text, text) from public;
grant execute on function public.club_assignment_role_label(text, text) to authenticated;

create or replace function public.fetch_club_assignment_roles()
returns table (
  role_id         text,
  profile_type    text,
  label           text,
  is_custom       boolean,
  sort_order      integer,
  custom_role_max integer
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.profile_type, r.label, r.is_custom, r.sort_order,
         public.club_assignment_custom_role_max()
  from public.club_assignment_roles r
  where r.is_available
    and auth.uid() is not null
  order by r.profile_type, r.sort_order;
$$;

revoke all on function public.fetch_club_assignment_roles() from public;
grant execute on function public.fetch_club_assignment_roles() to authenticated;

comment on function public.fetch_club_assignment_roles() is
  'DAS-REV-19 §20-§21: catalogo condiviso dei ruoli proponibili in un invito, '
  'con il limite centralizzato del ruolo custom.';


-- ============================================================
-- SEZIONE 4 — MembershipAssignment (§7, §30)
--
-- L'incarico: «ruolo e ambito Team oppure Società». Separato dalla relazione
-- perché §7 chiede che «più incarichi riutilizzino una sola relazione
-- Persona–Società» — e perché `club_members_unique_profile` rende comunque
-- impossibile rappresentarne due su quella tabella.
--
-- `club_members` resta la relazione e la **proiezione**: SEZIONE 10 allinea
-- `member_role`, `team_id` e `staff_title` all'incarico principale, così che
-- Organico, Centro Squadre e profilo continuino a leggere ciò che leggevano.
--
-- L'equivalenza di §25 e §30 non è una regola scritta nelle RPC: è l'indice
-- unico qui sotto. Due processi concorrenti non possono creare due incarichi
-- identici nemmeno se entrambi hanno superato una pre-verifica.
-- ============================================================

create table if not exists public.club_member_assignments (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references public.clubs(id) on delete cascade,
  membership_id      uuid not null references public.club_members(id) on delete cascade,
  /* Denormalizzato: ogni lettura filtra per persona prima che per membership. */
  profile_id         uuid not null references public.profiles(id) on delete cascade,
  profile_type       text not null check (profile_type in ('player', 'coach', 'staff', 'director')),
  structured_role_id text not null references public.club_assignment_roles(id) on delete restrict,
  /* Valorizzato **solo** per le voci "Altro…", e sempre normalizzato (§20). */
  custom_role_name   text,
  scope_type         text not null check (scope_type in ('team', 'society')),
  team_id            uuid references public.club_teams(id) on delete cascade,
  status             text not null default 'active' check (status in ('active', 'ended')),
  /* Origine: l'invito che lo ha prodotto, quando esiste (FK in SEZIONE 5). */
  source_invite_id   uuid,
  created_at         timestamptz not null default timezone('utc', now()),
  ended_at           timestamptz,
  updated_at         timestamptz not null default timezone('utc', now()),
  /* §21: SOCIETY non inventa una squadra, TEAM non può restare senza. */
  constraint club_member_assignments_scope_shape check (
    (scope_type = 'team' and team_id is not null)
    or (scope_type = 'society' and team_id is null)
  )
);

create index if not exists club_member_assignments_club_idx
  on public.club_member_assignments (club_id, status);

create index if not exists club_member_assignments_profile_idx
  on public.club_member_assignments (profile_id, status);

create index if not exists club_member_assignments_team_idx
  on public.club_member_assignments (team_id)
  where team_id is not null;

create index if not exists club_member_assignments_membership_idx
  on public.club_member_assignments (membership_id);

/**
 * §25, §30: l'equivalenza considera Society, persona, tipo professionale,
 * ruolo, custom normalizzato, ambito e Team. Un incarico SOCIETY **non** è
 * equivalente a quello sulla singola squadra, e il `coalesce` sul Team lo
 * rende vero anche nell'indice: lo zero-uuid non è un Team esistente.
 *
 * Parziale su `active`: un incarico concluso non impedisce per sempre di
 * ricrearlo (§25, ultima riga della tabella).
 */
create unique index if not exists club_member_assignments_active_unique
  on public.club_member_assignments (
    club_id,
    profile_id,
    profile_type,
    structured_role_id,
    coalesce(lower(custom_role_name), ''),
    scope_type,
    coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'active';

alter table public.club_member_assignments enable row level security;

/**
 * Lettura: l'interessato e chi ha accesso attivo alla Società. La granularità
 * per capability e scope vive nelle RPC, che sono l'unico ingresso usato dal
 * client; la policy è la rete di sicurezza, non il filtro di prodotto.
 */
drop policy if exists "assignments readable by owner or member" on public.club_member_assignments;
create policy "assignments readable by owner or member"
  on public.club_member_assignments for select to authenticated
  using (
    profile_id = auth.uid()
    or public.owns_club(club_id)
    or public.club_access_is_active(club_id, auth.uid())
  );

-- Nessuna policy di scrittura: solo le funzioni SECURITY DEFINER scrivono
-- qui. §41 vieta che un client possa fabbricarsi un incarico.

/**
 * Normalizzazione e coerenza del ruolo, applicate dove non possono essere
 * aggirate. Un CHECK non basta: `is_custom` vive in un'altra tabella.
 */
create or replace function public.club_member_assignment_normalize()
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
    -- §20: «Non conservare valori contraddittori quando si cambia scelta.»
    new.custom_role_name := null;
  end if;

  new.updated_at := timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists club_member_assignments_normalize on public.club_member_assignments;
create trigger club_member_assignments_normalize
  before insert or update on public.club_member_assignments
  for each row execute function public.club_member_assignment_normalize();


-- ============================================================
-- SEZIONE 5 — Invitation (§10, §11)
--
-- Un record persistente per proposta, con i campi che §10 elenca. Tre
-- assenze sono deliberate e documentate:
--
--   · nessun `expires_at` — §11: «L'invito individuale registrato non scade
--     automaticamente in questa V1. Non aggiungere picker, countdown o job»;
--   · nessun token — il percorso via link è DAS-REV-20;
--   · nessun `message` o motivo del rifiuto — §10 li vieta come campi del
--     flusso.
--
-- `structured_role_id` è **nullable** solo per le righe rispecchiate dalla
-- SEZIONE 11: una riga `club_members` pending storica non porta con sé un
-- ruolo del catalogo, e §43 vieta di inventarne uno per riempire il campo.
-- Il CHECK impedisce che una riga nuova nasca senza.
-- ============================================================

create table if not exists public.club_member_invites (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references public.clubs(id) on delete cascade,
  invitee_profile_id uuid not null references public.profiles(id) on delete cascade,
  profile_type       text not null check (profile_type in ('player', 'coach', 'staff', 'director')),
  structured_role_id text references public.club_assignment_roles(id) on delete restrict,
  custom_role_name   text,
  /* Etichetta storica delle sole righe legacy (SEZIONE 11). */
  legacy_role_label  text,
  scope_type         text not null check (scope_type in ('team', 'society')),
  team_id            uuid references public.club_teams(id) on delete cascade,
  status             text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  /* §10, §29: una proposta già mostrata non cambia sotto il destinatario. */
  revision           integer not null default 1,
  /* §10: audit dell'actor, distinto dalla Società proponente. */
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default timezone('utc', now()),
  resolved_at        timestamptz,
  resolved_by        uuid references public.profiles(id) on delete set null,
  assignment_id      uuid references public.club_member_assignments(id) on delete set null,
  membership_id      uuid references public.club_members(id) on delete set null,
  /* Riga `club_members` pending preesistente rispecchiata da questo record. */
  legacy_member_id   uuid references public.club_members(id) on delete cascade,
  updated_at         timestamptz not null default timezone('utc', now()),
  constraint club_member_invites_scope_shape check (
    (scope_type = 'team' and team_id is not null)
    or (scope_type = 'society' and team_id is null)
  ),
  constraint club_member_invites_role_shape check (
    structured_role_id is not null or legacy_member_id is not null
  ),
  constraint club_member_invites_resolution_shape check (
    (status = 'pending' and resolved_at is null)
    or (status <> 'pending' and resolved_at is not null)
  )
);

alter table public.club_member_assignments
  drop constraint if exists club_member_assignments_source_invite_fkey;

alter table public.club_member_assignments
  add constraint club_member_assignments_source_invite_fkey
  foreign key (source_invite_id) references public.club_member_invites(id) on delete set null;

create index if not exists club_member_invites_club_status_idx
  on public.club_member_invites (club_id, status, created_at desc);

create index if not exists club_member_invites_invitee_idx
  on public.club_member_invites (invitee_profile_id, status);

create index if not exists club_member_invites_team_idx
  on public.club_member_invites (team_id)
  where team_id is not null;

create unique index if not exists club_member_invites_legacy_unique
  on public.club_member_invites (legacy_member_id)
  where legacy_member_id is not null;

/**
 * §25: «Invito equivalente ancora PENDING → nessun duplicato», garantito nel
 * backend e non da una ricerca preliminare del client. Stessa forma
 * dell'indice sugli incarichi: l'equivalenza deve essere **una** definizione,
 * altrimenti un invito può nascere per un incarico che poi risulta duplicato.
 *
 * Il custom entra normalizzato in minuscolo: "Data analyst" e "data  analyst"
 * sono lo stesso incarico, e §25 chiede l'equivalenza sul custom normalizzato.
 */
create unique index if not exists club_member_invites_pending_unique
  on public.club_member_invites (
    club_id,
    invitee_profile_id,
    profile_type,
    coalesce(structured_role_id, ''),
    coalesce(lower(custom_role_name), ''),
    scope_type,
    coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'pending';

alter table public.club_member_invites enable row level security;

/**
 * Il destinatario legge il **proprio** invito; chi ha accesso attivo alla
 * Società legge quelli della Società. Il perimetro per capability e scope lo
 * applicano le RPC: §41 chiede che l'accesso per ID arbitrario sia bloccato,
 * e questa policy è il livello che lo impedisce anche a una query diretta.
 */
drop policy if exists "member invites readable" on public.club_member_invites;
create policy "member invites readable"
  on public.club_member_invites for select to authenticated
  using (
    invitee_profile_id = auth.uid()
    or public.owns_club(club_id)
    or public.club_access_is_active(club_id, auth.uid())
  );

-- Nessuna policy di scrittura: solo le funzioni SECURITY DEFINER.

create or replace function public.club_member_invite_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists club_member_invites_touch on public.club_member_invites;
create trigger club_member_invites_touch
  before update on public.club_member_invites
  for each row execute function public.club_member_invite_touch();

/**
 * Audit applicativo (§42), separato da notifiche e analytics e **senza**
 * policy di INSERT: ci scrivono solo le funzioni definer.
 */
create table if not exists public.club_member_invite_audit (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  invite_id      uuid references public.club_member_invites(id) on delete set null,
  actor_id       uuid references public.profiles(id) on delete set null,
  operation      text not null,
  previous_state text,
  next_state     text,
  details        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default timezone('utc', now())
);

create index if not exists club_member_invite_audit_club_idx
  on public.club_member_invite_audit (club_id, created_at desc);

alter table public.club_member_invite_audit enable row level security;

drop policy if exists "member invite audit readable by owner" on public.club_member_invite_audit;
create policy "member invite audit readable by owner"
  on public.club_member_invite_audit for select to authenticated
  using (public.owns_club(club_id));


-- ============================================================
-- SEZIONE 6 — Read state delle richieste ricevute (§15)
--
-- «La lettura è personale per l'actor che consulta il record nel contesto
-- Society … Non far sparire Nuova a tutti gli amministratori soltanto perché
-- uno di loro ha aperto la richiesta.»
--
-- L'infrastruttura di read state esistente è `notifications.is_read`, che è
-- per destinatario e non per actor su un record di Società: non è
-- riutilizzabile. §15 prevede esattamente questo caso e detta la chiave.
-- ============================================================

create table if not exists public.club_member_request_reads (
  request_id       uuid not null references public.club_members(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  club_id          uuid not null references public.clubs(id) on delete cascade,
  read_at          timestamptz not null default timezone('utc', now()),
  primary key (request_id, actor_profile_id)
);

create index if not exists club_member_request_reads_actor_idx
  on public.club_member_request_reads (actor_profile_id, club_id);

alter table public.club_member_request_reads enable row level security;

drop policy if exists "request reads readable by actor" on public.club_member_request_reads;
create policy "request reads readable by actor"
  on public.club_member_request_reads for select to authenticated
  using (actor_profile_id = auth.uid());


-- ============================================================
-- SEZIONE 7 — Autorizzazione: capability, scope e ambito (§8, §9)
--
-- «Visualizza non implica Gestisci. La presenza di un Team nello scope non
-- attribuisce da sola la capacità di invitare. Gli incarichi SOCIETY
-- richiedono una capacità societaria adeguata: l'accesso a tutti i Team
-- elencati non costituisce da solo prova di questa capacità.»
--
-- Quest'ultima frase è il motivo per cui `p_scope_type = 'society'` esige
-- `v_scope is null`: un perimetro di squadre, anche se contiene tutte le
-- squadre esistenti oggi, non è un perimetro societario — domani ne nasce
-- una nuova e il perimetro non la contiene.
-- ============================================================

create or replace function public.member_invite_allows(
  p_club_id    uuid,
  p_key        text,
  p_scope_type text default null,
  p_team_id    uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope uuid[];
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

  if not (p_key = any (public.dashboard_club_capabilities(p_club_id))) then
    return false;
  end if;

  -- Nessun oggetto: la domanda è solo se la chiave esiste nel perimetro.
  if p_scope_type is null then
    return true;
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, p_key);

  if p_scope_type = 'society' then
    return v_scope is null;
  end if;

  return v_scope is null
      or (p_team_id is not null and p_team_id = any (v_scope));
end;
$$;

revoke all on function public.member_invite_allows(uuid, text, text, uuid) from public;
grant execute on function public.member_invite_allows(uuid, text, text, uuid) to authenticated;

comment on function public.member_invite_allows(uuid, text, text, uuid) is
  'DAS-REV-19 §8-§9: capability e scope per un ambito TEAM o SOCIETY. '
  'Un perimetro di squadre non copre mai un incarico societario.';

/**
 * Etichetta del perimetro, per la riga di contesto del Centro (§12).
 *
 * `null` = nessuna restrizione. Non è un nome di fantasia: i nomi arrivano
 * dai Team realmente nel perimetro.
 */
create or replace function public.member_invite_scope_label(
  p_club_id uuid,
  p_key     text
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope uuid[];
  v_names text[];
begin
  if public.owns_club(p_club_id) then
    return null;
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, p_key);

  if v_scope is null then
    return null;
  end if;

  select array_agg(ct.name order by ct.sort_order, ct.name)
  into v_names
  from public.club_teams ct
  where ct.id = any (v_scope);

  if v_names is null or array_length(v_names, 1) = 0 then
    return null;
  end if;

  if array_length(v_names, 1) = 1 then
    return v_names[1];
  end if;

  return array_length(v_names, 1)::text || ' squadre';
end;
$$;

revoke all on function public.member_invite_scope_label(uuid, text) from public;
grant execute on function public.member_invite_scope_label(uuid, text) to authenticated;


-- ============================================================
-- SEZIONE 8 — Normalizzazione del filtro multiselezione (§14)
--
-- Il modello è quello di §40: modalità `all` oppure `teams` con una lista di
-- Team ID deduplicati. «Un insieme specifico non comprende SOCIETY» e «Tutti
-- gli ambiti non si traduce in una lista statica di tutti i Team esistenti».
--
-- La normalizzazione vive qui e non in ogni lettura: §14 chiede che la
-- deselezione totale ricada sulla scelta generale **prima** di applicare, e
-- averlo in un posto solo è il modo di non avere due comportamenti fra la
-- pagina e il conteggio.
-- ============================================================

create or replace function public.member_invite_filter_teams(
  p_club_id    uuid,
  p_key        text,
  p_scope_mode text,
  p_team_ids   uuid[]
)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope    uuid[];
  v_selected uuid[];
begin
  if coalesce(p_scope_mode, 'all') not in ('all', 'teams') then
    raise exception 'INVITES_FILTER_INVALID';
  end if;

  if coalesce(p_scope_mode, 'all') = 'all' then
    return null;
  end if;

  select array_agg(distinct t)
  into v_selected
  from unnest(coalesce(p_team_ids, array[]::uuid[])) as t;

  -- §14: «Se vengono deselezionate tutte le squadre, normalizza alla scelta
  -- generale prima di applicare.» Un insieme vuoto non è zero risultati.
  if v_selected is null or array_length(v_selected, 1) = 0 then
    return null;
  end if;

  -- Squadre di un'altra Società o inesistenti: respinte, non ignorate (§14,
  -- QA-038). Un filtro manipolato non deve poter allargare né far trapelare.
  if exists (
    select 1
    from unnest(v_selected) as t
    where not exists (
      select 1 from public.club_teams ct
      where ct.id = t and ct.club_id = p_club_id
    )
  ) then
    raise exception 'INVITES_FILTER_NOT_AUTHORIZED';
  end if;

  if not public.owns_club(p_club_id) then
    v_scope := public.dashboard_club_capability_scope(p_club_id, p_key);

    if v_scope is not null and exists (
      select 1 from unnest(v_selected) as t where not (t = any (v_scope))
    ) then
      raise exception 'INVITES_FILTER_NOT_AUTHORIZED';
    end if;
  end if;

  return v_selected;
end;
$$;

revoke all on function public.member_invite_filter_teams(uuid, text, text, uuid[]) from public;
grant execute on function public.member_invite_filter_teams(uuid, text, text, uuid[]) to authenticated;


-- ============================================================
-- SEZIONE 9 — Cursore firmato (§13, §36)
--
-- Stesso modello di DAS-REV-15: l'istante è congelato nel token, il token
-- appartiene a una sola query, e un token di un'altra tab, sezione o filtro
-- viene rifiutato invece di reinterpretato. §13 chiede sezioni con
-- paginazione indipendente, e §36 che una risposta vecchia non sovrascriva
-- il contesto corrente: il contesto è dentro il cursore.
-- ============================================================

create or replace function public.member_invites_cursor_encode(
  p_club_id    uuid,
  p_tab        text,
  p_section    text,
  p_scope_mode text,
  p_team_ids   uuid[],
  p_as_of      timestamptz,
  p_sort_key   text
)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(convert_to(
    'v1|' || p_club_id::text
          || '|' || p_tab
          || '|' || p_section
          || '|' || p_scope_mode
          || '|' || coalesce(array_to_string(p_team_ids, ','), '-')
          || '|' || (extract(epoch from p_as_of) * 1000)::bigint::text
          || '|' || p_sort_key,
    'utf8'), 'base64');
$$;

grant execute on function public.member_invites_cursor_encode(uuid, text, text, text, uuid[], timestamptz, text) to authenticated;

create or replace function public.member_invites_cursor_decode(
  p_cursor     text,
  p_club_id    uuid,
  p_tab        text,
  p_section    text,
  p_scope_mode text,
  p_team_ids   uuid[],
  out as_of    timestamptz,
  out sort_key text
)
language plpgsql
immutable
set search_path = public
as $$
declare
  v_parts text[];
begin
  begin
    v_parts := string_to_array(convert_from(decode(p_cursor, 'base64'), 'utf8'), '|');

    if array_length(v_parts, 1) <> 8
       or v_parts[1] <> 'v1'
       or v_parts[2] <> p_club_id::text
       or v_parts[3] <> p_tab
       or v_parts[4] <> p_section
       or v_parts[5] <> p_scope_mode
       or v_parts[6] <> coalesce(array_to_string(p_team_ids, ','), '-') then
      raise exception 'INVITES_CURSOR_INVALID';
    end if;

    as_of    := to_timestamp(v_parts[7]::bigint / 1000.0);
    sort_key := v_parts[8];
  exception
    when others then
      raise exception 'INVITES_CURSOR_INVALID';
  end;
end;
$$;

grant execute on function public.member_invites_cursor_decode(text, uuid, text, text, text, uuid[]) to authenticated;


-- ============================================================
-- SEZIONE 10 — Etichetta dei record canonici preesistenti (§15, §43)
--
-- Le richieste ricevute e gli inviti rispecchiati vivono su `club_members`,
-- che descrive il ruolo con `member_role` + `staff_title`. §43 vieta di
-- inventare il ruolo mancante: qui si legge ciò che c'è, e quando non c'è si
-- usa l'etichetta generica del tipo professionale — non una voce di catalogo
-- scelta a caso.
-- ============================================================

create or replace function public.club_member_role_label(
  p_member_role text,
  p_staff_title text
)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_member_role
    when 'player'   then 'Calciatore'
    when 'coach'    then 'Allenatore'
    when 'staff'    then coalesce(nullif(btrim(coalesce(p_staff_title, '')), ''), 'Staff')
    when 'director' then coalesce(nullif(btrim(coalesce(p_staff_title, '')), ''), 'Dirigente')
    else coalesce(nullif(btrim(coalesce(p_staff_title, '')), ''), 'Incarico')
  end;
$$;

grant execute on function public.club_member_role_label(text, text) to authenticated;


-- ============================================================
-- SEZIONE 11 — Composizione del Centro (§12)
--
-- Una sola lettura per l'intestazione: identità Società, che cosa l'actor
-- può fare, i due conteggi pending e il perimetro. `null` non è `0`: un
-- conteggio che l'actor non può leggere resta nullo (convenzione
-- 20261018090000).
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

  /* §12: il Centro è una sola destinazione con due tab. Senza nessuna delle
     due letture non c'è niente da aprire, e §8 vieta di presentare un 403
     come elenco vuoto. */
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
        /* §9, QA-007: un record societario resta fuori anche da "Tutti gli
           ambiti" quando l'actor non ha un perimetro societario. */
        and (
          v_scope is null
          or (inv.scope_type = 'team' and inv.team_id = any (v_scope))
        )
    ) end,

    case when v_requests then (
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
  'DAS-REV-19 §12: intestazione del Centro Inviti e richieste. I conteggi '
  'sono null, non zero, quando l''actor non può leggere la sezione.';


-- ============================================================
-- SEZIONE 12 — Opzioni del filtro (§14)
--
-- Le squadre consultabili nel contesto. §14: nello storico «possono comparire
-- Team non più operativi soltanto quando hanno record consultabili e sono
-- autorizzati» — `is_inactive` le distingue senza escluderle, e il selector
-- di assegnazione (SEZIONE 17) usa invece una lista diversa.
-- ============================================================

create or replace function public.fetch_society_invite_filter_teams(p_club_id uuid)
returns table (
  team_id     uuid,
  label       text,
  is_inactive boolean,
  sort_order  integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_key   text;
  v_scope uuid[];
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if public.member_invite_allows(p_club_id, 'invites_view') then
    v_key := 'invites_view';
  elsif public.member_invite_allows(p_club_id, 'member_requests_view') then
    v_key := 'member_requests_view';
  else
    raise exception 'INVITES_CENTER_NOT_AUTHORIZED';
  end if;

  v_scope := case when not public.owns_club(p_club_id)
    then public.dashboard_club_capability_scope(p_club_id, v_key) end;

  return query
  select
    ct.id,
    ct.name,
    coalesce(ct.is_archived, false),
    coalesce(ct.sort_order, 0)
  from public.club_teams ct
  where ct.club_id = p_club_id
    and (v_scope is null or ct.id = any (v_scope))
    /* Una squadra disattivata compare solo se ha davvero record da
       consultare: §14 non vuole un elenco di squadre morte senza contenuto. */
    and (
      not coalesce(ct.is_archived, false)
      or exists (
        select 1 from public.club_member_invites inv where inv.team_id = ct.id
      )
      or exists (
        select 1 from public.club_members cm
        where cm.team_id = ct.id and cm.added_by = 'self_request'
      )
    )
  order by coalesce(ct.is_archived, false), coalesce(ct.sort_order, 0), ct.name;
end;
$$;

revoke all on function public.fetch_society_invite_filter_teams(uuid) from public;
grant execute on function public.fetch_society_invite_filter_teams(uuid) to authenticated;


-- ============================================================
-- SEZIONE 13 — Una pagina del Centro (§13, §14)
--
-- Quattro consultazioni con la stessa forma: tab × sezione. Tenerle in una
-- funzione sola e non in quattro evita che l'ordinamento, lo scope e il
-- congelamento dell'istante divergano fra una sezione e l'altra — che è
-- esattamente ciò che §13 vieta quando chiede che un record non compaia in
-- entrambe.
--
-- Scope e filtro sono applicati **prima** di ordinare e paginare (§13).
-- L'ordinamento secondario per ID rende stabile il keyset quando due
-- timestamp coincidono.
-- ============================================================

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
      /* Perimetro della capability: un incarico societario richiede un
         perimetro societario (§9). */
      and (
        v_scope is null
        or (inv.scope_type = 'team' and inv.team_id = any (v_scope))
      )
      /* Filtro di consultazione: restringe, non amplia. Un insieme di Team
         **non** comprende gli incarichi societari (§14, §40). */
      and (
        v_filter is null
        or (inv.scope_type = 'team' and inv.team_id = any (v_filter))
      )
      and case when v_section = 'pending'
               then inv.created_at <= v_as_of
               else inv.resolved_at is not null and inv.resolved_at <= v_as_of
          end
  ),
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
    select * from received
  ),
  keyed as (
    select
      u.*,
      /* §13: pending per created_at DESC; recenti per resolved_at DESC; le
         richieste non lette prima. Il complemento a 9999999999999 rende il
         DESC un ORDER BY crescente su testo, che è ciò che il keyset sa
         confrontare; l'ID chiude il pareggio. */
      (case when u.rec_kind = 'request' and u.unread then '0' else '1' end)
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
    /* §12: squadra oppure Intera società. Mai una riga vuota. */
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
  'DAS-REV-19 §13-§14: una pagina di una sezione del Centro. Il filtro per '
  'squadre è un OR e non comprende mai gli incarichi societari.';


-- ============================================================
-- SEZIONE 14 — Dettaglio dell'invito inviato (§26)
--
-- «Society, destinatario, ruolo, Team/ambito, stato e date reali.» Il
-- dettaglio resta consultabile anche dopo la risoluzione, e `can_cancel` è
-- risolto qui perché la sua disponibilità appartiene al permission domain:
-- il client non la ricostruisce da un generico ruolo admin (§40).
-- ============================================================

create or replace function public.fetch_society_member_invite(p_invite_id uuid)
returns table (
  invite_id         uuid,
  club_id           uuid,
  club_name         text,
  club_logo_url     text,
  club_is_verified  boolean,
  person_profile_id uuid,
  person_name       text,
  person_avatar_url text,
  profile_type      text,
  role_label        text,
  scope_type        text,
  team_id           uuid,
  team_name         text,
  team_is_inactive  boolean,
  context_label     text,
  state             text,
  revision          integer,
  created_at        timestamptz,
  resolved_at       timestamptz,
  can_cancel        boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.club_member_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_inv from public.club_member_invites where id = p_invite_id;

  /* §40: non autorizzato e non trovato hanno una presentazione uniforme
     verso l'esterno. Distinguerli qui farebbe da oracolo sugli ID. */
  if not found
     or not public.member_invite_allows(
          v_inv.club_id, 'invites_view', v_inv.scope_type, v_inv.team_id)
  then
    raise exception 'INVITE_NOT_AVAILABLE';
  end if;

  return query
  select
    v_inv.id,
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    p.id,
    p.full_name,
    p.avatar_url,
    v_inv.profile_type,
    coalesce(
      public.club_assignment_role_label(v_inv.structured_role_id, v_inv.custom_role_name),
      v_inv.legacy_role_label
    ),
    v_inv.scope_type,
    v_inv.team_id,
    ct.name,
    coalesce(ct.is_archived, false),
    case when v_inv.scope_type = 'society' then 'Intera società' else ct.name end,
    v_inv.status,
    v_inv.revision,
    v_inv.created_at,
    v_inv.resolved_at,
    /* §26: Annulla compare solo su un pending e solo con la capacità sul
       relativo ambito. */
    v_inv.status = 'pending'
      and public.member_invite_allows(
            v_inv.club_id, 'invites_cancel', v_inv.scope_type, v_inv.team_id)
  from public.clubs c
  join public.profiles p on p.id = v_inv.invitee_profile_id
  left join public.club_teams ct on ct.id = v_inv.team_id
  where c.id = v_inv.club_id;
end;
$$;

revoke all on function public.fetch_society_member_invite(uuid) from public;
grant execute on function public.fetch_society_member_invite(uuid) to authenticated;


-- ============================================================
-- SEZIONE 15 — Dettaglio della richiesta ricevuta (§15)
--
-- Lettura reale del record canonico. Nessuna azione: la conferma del ruolo è
-- di DAS-REV-21, e §15 vieta «Approva/Rifiuta non funzionanti o finte
-- conferme». Quando quel pack arriverà, aggiungerà le sue azioni su questa
-- stessa destinazione.
-- ============================================================

create or replace function public.fetch_society_member_request(p_request_id uuid)
returns table (
  request_id        uuid,
  club_id           uuid,
  club_name         text,
  club_logo_url     text,
  club_is_verified  boolean,
  person_profile_id uuid,
  person_name       text,
  person_avatar_url text,
  role_label        text,
  scope_type        text,
  team_id           uuid,
  context_label     text,
  state             text,
  created_at        timestamptz,
  resolved_at       timestamptz,
  is_unread         boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.club_members%rowtype;
  v_sc  text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_req from public.club_members where id = p_request_id;

  if not found or v_req.added_by <> 'self_request' or v_req.profile_id is null then
    raise exception 'REQUEST_NOT_AVAILABLE';
  end if;

  v_sc := case when v_req.team_id is null then 'society' else 'team' end;

  if not public.member_invite_allows(
       v_req.club_id, 'member_requests_view', v_sc, v_req.team_id) then
    raise exception 'REQUEST_NOT_AVAILABLE';
  end if;

  return query
  select
    v_req.id,
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    p.id,
    p.full_name,
    p.avatar_url,
    public.club_member_role_label(v_req.member_role, v_req.staff_title),
    v_sc,
    v_req.team_id,
    case when v_sc = 'society' then 'Intera società' else ct.name end,
    case v_req.status
      when 'pending'  then 'pending'
      when 'active'   then 'approved'
      when 'rejected' then 'declined'
      else v_req.status
    end,
    v_req.created_at,
    case when v_req.status <> 'pending' then v_req.updated_at end,
    v_req.status = 'pending'
      and not exists (
        select 1 from public.club_member_request_reads rr
        where rr.request_id = v_req.id and rr.actor_profile_id = v_uid
      )
  from public.clubs c
  join public.profiles p on p.id = v_req.profile_id
  left join public.club_teams ct on ct.id = v_req.team_id
  where c.id = v_req.club_id;
end;
$$;

revoke all on function public.fetch_society_member_request(uuid) from public;
grant execute on function public.fetch_society_member_request(uuid) to authenticated;

/**
 * §15: «Marca la lettura mediante operazione esplicita e idempotente dopo
 * l'apertura riuscita del dettaglio, non con una GET dell'hub o una
 * prefetch.» La lettura non tocca lo stato operativo della richiesta.
 */
create or replace function public.mark_society_member_request_read(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.club_members%rowtype;
  v_sc  text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_req from public.club_members where id = p_request_id;

  if not found or v_req.added_by <> 'self_request' or v_req.profile_id is null then
    raise exception 'REQUEST_NOT_AVAILABLE';
  end if;

  v_sc := case when v_req.team_id is null then 'society' else 'team' end;

  if not public.member_invite_allows(
       v_req.club_id, 'member_requests_view', v_sc, v_req.team_id) then
    raise exception 'REQUEST_NOT_AVAILABLE';
  end if;

  insert into public.club_member_request_reads (request_id, actor_profile_id, club_id)
  values (p_request_id, v_uid, v_req.club_id)
  on conflict (request_id, actor_profile_id) do nothing;
end;
$$;

revoke all on function public.mark_society_member_request_read(uuid) from public;
grant execute on function public.mark_society_member_request_read(uuid) to authenticated;


-- ============================================================
-- SEZIONE 16 — Dettaglio dell'invito ricevuto (§28, §33)
--
-- Protetto sul destinatario: «Il lato persona può rispondere soltanto quando
-- l'actor autenticato corrisponde al destinatario canonico» (§8). Il server
-- deriva la persona dal contesto autenticato e non si fida dell'ID.
--
-- `membership_active` esiste perché §33 distingue «ACCEPTED, assignment
-- ancora corrente» da «ACCEPTED, incarico successivamente terminato»: senza
-- questo booleano la schermata affermerebbe che un vecchio incarico è ancora
-- attivo.
-- ============================================================

create or replace function public.fetch_my_member_invite(p_invite_id uuid)
returns table (
  invite_id          uuid,
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  club_is_verified   boolean,
  club_city          text,
  profile_type       text,
  role_label         text,
  scope_type         text,
  team_id            uuid,
  team_name          text,
  context_label      text,
  state              text,
  revision           integer,
  created_at         timestamptz,
  resolved_at        timestamptz,
  can_respond        boolean,
  assignment_active  boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.club_member_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_inv from public.club_member_invites where id = p_invite_id;

  if not found or v_inv.invitee_profile_id <> v_uid then
    raise exception 'INVITE_NOT_AVAILABLE';
  end if;

  return query
  select
    v_inv.id,
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    c.city,
    v_inv.profile_type,
    coalesce(
      public.club_assignment_role_label(v_inv.structured_role_id, v_inv.custom_role_name),
      v_inv.legacy_role_label
    ),
    v_inv.scope_type,
    v_inv.team_id,
    ct.name,
    case when v_inv.scope_type = 'society' then 'Intera società' else ct.name end,
    v_inv.status,
    v_inv.revision,
    v_inv.created_at,
    v_inv.resolved_at,
    /* §33: azionabile solo se ancora PENDING **e** il contesto regge. Una
       squadra non più assegnabile rende la proposta non accettabile, e la
       UI lo distingue da un annullamento della Società. */
    v_inv.status = 'pending'
      and (v_inv.scope_type = 'society' or not coalesce(ct.is_archived, false)),
    exists (
      select 1 from public.club_member_assignments a
      where a.id = v_inv.assignment_id and a.status = 'active'
    )
  from public.clubs c
  left join public.club_teams ct on ct.id = v_inv.team_id
  where c.id = v_inv.club_id;
end;
$$;

revoke all on function public.fetch_my_member_invite(uuid) from public;
grant execute on function public.fetch_my_member_invite(uuid) to authenticated;

comment on function public.fetch_my_member_invite(uuid) is
  'DAS-REV-19 §28, §33: la proposta come la vede il destinatario. Il server '
  'deriva la persona dal contesto autenticato, non dall''ID ricevuto.';


-- ============================================================
-- SEZIONE 17 — Ricerca della persona e Team assegnabili (§17, §22)
--
-- §17: «Tipologie eleggibili per questo invito: Calciatore, Allenatore,
-- Staff, Dirigente. Un utente con sola qualifica Tifoso o Media/Creator non
-- diventa automaticamente eleggibile.» L'eleggibilità è quindi un filtro
-- sulla query, non una decorazione: i non eleggibili non compaiono affatto.
--
-- Il payload è minimo (§17, §41): nome, avatar, tipo professionale, un
-- contesto pubblico per distinguere gli omonimi. Nessun recapito, nessun
-- profilo completo.
-- ============================================================

create or replace function public.search_society_member_candidates(
  p_club_id uuid,
  p_query   text default null,
  p_limit   integer default 20,
  p_offset  integer default 0
)
returns table (
  profile_id     uuid,
  full_name      text,
  avatar_url     text,
  profile_type   text,
  specialty      text,
  city           text,
  total_count    bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_term   text := btrim(coalesce(p_query, ''));
  v_limit  integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.member_invite_allows(p_club_id, 'invites_create') then
    raise exception 'INVITES_NOT_AUTHORIZED';
  end if;

  /* La lunghezza minima è una scelta del servizio, non del client: una
     ricerca vuota non deve restituire l'anagrafica della piattaforma. */
  if length(v_term) < 2 then
    return;
  end if;

  return query
  with matches as (
    select
      p.id, p.full_name, p.avatar_url, p.role, p.city
    from public.profiles p
    where p.role in ('player', 'coach', 'staff', 'director')
      and p.full_name ilike '%' || v_term || '%'
      /* §41: blocking canonico, in entrambe le direzioni. */
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_profile_id = v_uid and b.blocked_profile_id = p.id)
           or (b.blocker_profile_id = p.id and b.blocked_profile_id = v_uid)
      )
  ),
  decorated as (
    select
      m.id        as profile_id,
      m.full_name as full_name,
      m.avatar_url as avatar_url,
      m.role::text as profile_type,
      /* Un solo dato professionale, e solo dove esiste davvero. */
      case
        when m.role = 'staff' then
          coalesce(
            nullif(btrim(coalesce(sp.primary_staff_role, '')), ''),
            nullif(replace(sp.specialization::text, '_', ' '), 'other')
          )
        when m.role = 'director' then
          nullif(btrim(coalesce(dp.director_roles[1], '')), '')
      end         as specialty,
      m.city      as city
    from matches m
    left join public.staff_profiles sp on sp.profile_id = m.id
    left join public.director_profiles dp on dp.profile_id = m.id
  )
  select
    d.profile_id,
    d.full_name,
    d.avatar_url,
    d.profile_type,
    d.specialty,
    d.city,
    (select count(*) from decorated) as total_count
  from decorated d
  order by lower(d.full_name), d.profile_id
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.search_society_member_candidates(uuid, text, integer, integer) from public;
grant execute on function public.search_society_member_candidates(uuid, text, integer, integer) to authenticated;

comment on function public.search_society_member_candidates(uuid, text, integer, integer) is
  'DAS-REV-19 §17: persone registrate eleggibili a un incarico sportivo. '
  'Tifoso e Media/Creator non compaiono, e nessun recapito privato esce.';

/**
 * §22: «Team disponibili: interni alla Society, autorizzati, utilizzabili e
 * coerenti con il lifecycle. Escludere affiliate e Team non più
 * assegnabili.»
 *
 * Tre funzioni diverse per tre domande diverse, e i nomi devono dirlo:
 *
 *   · `fetch_society_invite_filter_teams` — che cosa **consulto** nel Centro,
 *     storico compreso;
 *   · `fetch_member_invite_assignable_teams` — a che cosa **assegno** un
 *     incarico sportivo nuovo (`invites_create`);
 *   · `fetch_society_assignable_teams` — DAS-REV-13/14, il perimetro di un
 *     accesso **amministrativo** (`admins_invite` / `admins_manage_scope`),
 *     che restituisce anche `team_type` e `logo_url` per il suo picker.
 *
 * La terza esiste dal 20261024090000 e il nome era già suo. Una prima
 * stesura di questa migrazione gliel'ha chiesto in prestito con un
 * `create or replace`: Postgres l'ha respinta con 42P13 — la riga definita
 * dai parametri OUT non si può cambiare — e ha fatto bene. Risolverla con un
 * `drop function` avrebbe funzionato e sarebbe stato il bug peggiore:
 * `AdminScopeScreen` e `AdminInviteComposerScreen` leggono quella funzione,
 * e si sarebbero ritrovati senza `logo_url` e, soprattutto, con
 * l'autorizzazione cambiata sotto — esattamente la confusione fra invito
 * amministrativo e invito all'organico che DAS-REV-13 §7.2 vieta.
 */
create or replace function public.fetch_member_invite_assignable_teams(p_club_id uuid)
returns table (
  team_id    uuid,
  label      text,
  category   text,
  sort_order integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope uuid[];
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.member_invite_allows(p_club_id, 'invites_create') then
    raise exception 'INVITES_NOT_AUTHORIZED';
  end if;

  v_scope := case when not public.owns_club(p_club_id)
    then public.dashboard_club_capability_scope(p_club_id, 'invites_create') end;

  return query
  select
    ct.id,
    ct.name,
    lvl.label,
    coalesce(ct.sort_order, 0)
  from public.club_teams ct
  left join public.club_team_seasons cfg
    on cfg.team_id = ct.id and cfg.season_id = public.current_season_id()
  left join public.team_levels lvl on lvl.id = cfg.level_id
  where ct.club_id = p_club_id
    and not coalesce(ct.is_archived, false)
    and (v_scope is null or ct.id = any (v_scope))
  order by coalesce(ct.sort_order, 0), ct.name;
end;
$$;

revoke all on function public.fetch_member_invite_assignable_teams(uuid) from public;
grant execute on function public.fetch_member_invite_assignable_teams(uuid) to authenticated;


-- ============================================================
-- SEZIONE 18 — Creazione della proposta (§24, §25)
--
-- «Una creazione riuscita produce esattamente un Invitation PENDING, con ID
-- stabile, created_at del server e resolved_at nullo.»
--
-- L'ordine dei controlli non è casuale: autorizzazione prima di tutto,
-- idempotenza subito dopo (un retry non deve nemmeno consumare il rate
-- limit), validità del dominio, e solo alla fine i duplicati — che vengono
-- comunque riverificati dall'indice unico al momento del commit. §25:
-- «Una pre-verifica client non sostituisce il controllo al commit», e lo
-- stesso vale per una pre-verifica server fatta fuori dalla transazione.
-- ============================================================

create or replace function public.create_society_member_invite(
  p_club_id         uuid,
  p_profile_id      uuid,
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
  v_custom      text;
  v_scope       text := coalesce(p_scope_type, 'team');
  v_role        public.club_assignment_roles%rowtype;
  v_person_role text;
  v_fingerprint text;
  v_replay      jsonb;
  v_archived    boolean;
  v_invite_id   uuid;
  v_created     timestamptz;
  v_result      jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_scope not in ('team', 'society') then
    raise exception 'INVITE_SCOPE_INVALID';
  end if;

  if (v_scope = 'team') <> (p_team_id is not null) then
    raise exception 'INVITE_SCOPE_INVALID';
  end if;

  if not public.member_invite_allows(p_club_id, 'invites_create', v_scope, p_team_id) then
    raise exception 'INVITES_NOT_AUTHORIZED';
  end if;

  v_custom := public.normalize_assignment_custom_role(p_custom_role);

  /* La chiave di idempotenza è legata al **contenuto**: stessa chiave e
     payload diverso va respinta (§25). */
  v_fingerprint := md5(
    'member_invite_create|' || coalesce(p_profile_id::text, '')
      || '|' || coalesce(p_role_id, '')
      || '|' || coalesce(lower(v_custom), '')
      || '|' || v_scope
      || '|' || coalesce(p_team_id::text, '')
  );

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, p_club_id, 'member_invite_create', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  perform public.assert_agent_rate_limit(
    'member_invite_create', p_club_id::text, 30, interval '1 hour'
  );

  select * into v_role from public.club_assignment_roles where id = p_role_id;

  if not found or not v_role.is_available then
    raise exception 'INVITE_ROLE_UNAVAILABLE';
  end if;

  if v_role.is_custom then
    if v_custom is null then
      raise exception 'INVITE_CUSTOM_ROLE_REQUIRED';
    end if;

    if length(v_custom) > public.club_assignment_custom_role_max() then
      raise exception 'INVITE_CUSTOM_ROLE_TOO_LONG';
    end if;
  else
    v_custom := null;
  end if;

  /* §19, §21: Calciatore e Allenatore non hanno ambito societario. Non è una
     regola di interfaccia: è il dominio, e il server la applica. */
  if v_role.profile_type in ('player', 'coach') and v_scope <> 'team' then
    raise exception 'INVITE_SCOPE_INVALID';
  end if;

  /* §17, §24: eleggibilità riverificata dalle entità canoniche, non dalle
     label del client. */
  select p.role::text into v_person_role
  from public.profiles p
  where p.id = p_profile_id;

  if v_person_role is null then
    raise exception 'INVITE_RECIPIENT_INVALID';
  end if;

  if v_person_role not in ('player', 'coach', 'staff', 'director')
     or v_person_role <> v_role.profile_type then
    raise exception 'INVITE_RECIPIENT_INELIGIBLE';
  end if;

  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_profile_id = v_uid and b.blocked_profile_id = p_profile_id)
       or (b.blocker_profile_id = p_profile_id and b.blocked_profile_id = v_uid)
  ) then
    raise exception 'INVITE_RECIPIENT_INVALID';
  end if;

  if v_scope = 'team' then
    /* `for share` come nel guard di DAS-REV-10: se una disattivazione tiene
       il `for update` su questa squadra, qui si attende e si rilegge. */
    select ct.is_archived into v_archived
    from public.club_teams ct
    where ct.id = p_team_id and ct.club_id = p_club_id
    for share;

    if v_archived is null then
      raise exception 'INVITE_TEAM_UNAVAILABLE';
    end if;

    if v_archived then
      raise exception 'INVITE_TEAM_UNAVAILABLE';
    end if;
  end if;

  -- §25: incarico equivalente già attivo.
  if exists (
    select 1
    from public.club_member_assignments a
    where a.club_id = p_club_id
      and a.profile_id = p_profile_id
      and a.status = 'active'
      and a.profile_type = v_role.profile_type
      and a.structured_role_id = v_role.id
      and coalesce(lower(a.custom_role_name), '') = coalesce(lower(v_custom), '')
      and a.scope_type = v_scope
      and a.team_id is not distinct from p_team_id
  ) then
    raise exception 'INVITE_ALREADY_LINKED';
  end if;

  -- §25: richiesta inversa equivalente ancora in attesa.
  if exists (
    select 1
    from public.club_members cm
    where cm.club_id = p_club_id
      and cm.profile_id = p_profile_id
      and cm.status = 'pending'
      and cm.added_by = 'self_request'
      and cm.member_role = v_role.profile_type
      and cm.team_id is not distinct from p_team_id
  ) then
    raise exception 'INVITE_REQUEST_PENDING';
  end if;

  begin
    insert into public.club_member_invites (
      club_id, invitee_profile_id, profile_type, structured_role_id,
      custom_role_name, scope_type, team_id, created_by
    ) values (
      p_club_id, p_profile_id, v_role.profile_type, v_role.id,
      v_custom, v_scope, p_team_id, v_uid
    )
    returning id, created_at into v_invite_id, v_created;
  exception
    when unique_violation then
      -- §25: l'indice unico è il controllo vero. Due amministratori
      -- concorrenti arrivano qui, e il secondo riceve il messaggio giusto.
      raise exception 'INVITE_ALREADY_PENDING';
  end;

  /* §27: una entry nel Centro Notifiche della persona invitata, con il
     dispatcher esistente. Il trigger `notifications_before_insert` deriva
     categoria e preferenza: qui non si decide nulla di tutto ciò. */
  /* §27: la riga mostra «società, copy standard, contesto Calciatore ·
     Prima squadra». Il contesto sta nel **body** e non solo nei dati: la
     riga condivisa del Centro Notifiche rende titolo e corpo, e un dato che
     nessuno disegna non è un'informazione per chi legge. */
  insert into public.notifications (recipient_profile_id, type, title, body, data)
  select
    p_profile_id,
    'society_invitation_created',
    c.name,
    'Ti ha invitato a collegarti alla società' || chr(10)
      || public.club_assignment_role_label(v_role.id, v_custom)
      || ' · '
      || case when v_scope = 'society' then 'Intera società'
              else coalesce(
                (select ct.name from public.club_teams ct where ct.id = p_team_id),
                'Squadra'
              ) end,
    jsonb_build_object(
      'invite_id',     v_invite_id::text,
      'club_id',       p_club_id::text,
      'role_label',    public.club_assignment_role_label(v_role.id, v_custom),
      'context_label', case when v_scope = 'society' then 'Intera società'
                            else (select ct.name from public.club_teams ct where ct.id = p_team_id) end
    )
  from public.clubs c
  where c.id = p_club_id;

  insert into public.club_member_invite_audit
    (club_id, invite_id, actor_id, operation, previous_state, next_state, details)
  values (
    p_club_id, v_invite_id, v_uid, 'create', null, 'pending',
    jsonb_build_object(
      'profile_type', v_role.profile_type,
      'role_id',      v_role.id,
      'scope_type',   v_scope,
      'team_id',      p_team_id
    )
  );

  v_result := jsonb_build_object(
    'invite_id',  v_invite_id,
    'status',     'pending',
    'revision',   1,
    'created_at', v_created,
    'scope_type', v_scope,
    'team_id',    p_team_id
  );

  perform public.club_relationship_operation_record(
    p_idempotency_key, p_club_id, 'member_invite_create', v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.create_society_member_invite(uuid, uuid, text, text, text, uuid, text) from public;
grant execute on function public.create_society_member_invite(uuid, uuid, text, text, text, uuid, text) to authenticated;

comment on function public.create_society_member_invite(uuid, uuid, text, text, text, uuid, text) is
  'DAS-REV-19 §24-§25: crea un solo Invitation PENDING. L''unicità del '
  'pending equivalente è garantita dall''indice, non da una pre-verifica.';


-- ============================================================
-- SEZIONE 19 — Annullamento del pending (§26)
--
-- «Cancel e accept concorrenti ammettono un solo vincitore. Se accept ha già
-- completato l'incarico, non annullare retroattivamente la membership.»
--
-- Il `select … for update` sulla riga dell'invito è la sezione critica: il
-- secondo comando attende, rilegge lo stato già deciso e lo riporta, invece
-- di sovrascriverlo.
-- ============================================================

create or replace function public.cancel_society_member_invite(
  p_invite_id        uuid,
  p_expected_revision integer default null,
  p_idempotency_key  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_inv         public.club_member_invites%rowtype;
  v_fingerprint text;
  v_replay      jsonb;
  v_result      jsonb;
  v_resolved    timestamptz;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_inv from public.club_member_invites where id = p_invite_id;

  if not found then
    raise exception 'INVITE_NOT_AVAILABLE';
  end if;

  if not public.member_invite_allows(
       v_inv.club_id, 'invites_cancel', v_inv.scope_type, v_inv.team_id) then
    raise exception 'INVITES_NOT_AUTHORIZED';
  end if;

  v_fingerprint := md5('member_invite_cancel|' || p_invite_id::text
    || '|' || coalesce(p_expected_revision::text, ''));

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, v_inv.club_id, 'member_invite_cancel', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_inv from public.club_member_invites
  where id = p_invite_id
  for update;

  if v_inv.status = 'cancelled' then
    -- Già annullato: l'operazione ha avuto il suo effetto, e un retry non
    -- produce un secondo audit.
    return jsonb_build_object(
      'invite_id', v_inv.id, 'status', 'cancelled',
      'revision', v_inv.revision, 'already_applied', true
    );
  end if;

  if v_inv.status = 'accepted' then
    raise exception 'INVITE_ALREADY_ACCEPTED';
  end if;

  if v_inv.status <> 'pending' then
    raise exception 'INVITE_ALREADY_RESOLVED';
  end if;

  if p_expected_revision is not null and v_inv.revision is distinct from p_expected_revision then
    raise exception 'INVITE_REVISION_CONFLICT';
  end if;

  v_resolved := timezone('utc', now());

  update public.club_member_invites
  set status      = 'cancelled',
      resolved_at = v_resolved,
      resolved_by = v_uid,
      revision    = revision + 1
  where id = p_invite_id;

  insert into public.club_member_invite_audit
    (club_id, invite_id, actor_id, operation, previous_state, next_state, details)
  values (v_inv.club_id, p_invite_id, v_uid, 'cancel', 'pending', 'cancelled', '{}'::jsonb);

  v_result := jsonb_build_object(
    'invite_id',       p_invite_id,
    'status',          'cancelled',
    'revision',        v_inv.revision + 1,
    'resolved_at',     v_resolved,
    'already_applied', false
  );

  perform public.club_relationship_operation_record(
    p_idempotency_key, v_inv.club_id, 'member_invite_cancel', v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.cancel_society_member_invite(uuid, integer, text) from public;
grant execute on function public.cancel_society_member_invite(uuid, integer, text) to authenticated;


-- ============================================================
-- SEZIONE 20 — Risposta del destinatario (§29, §30, §32)
--
-- «L'accettazione costituisce una sola operazione logica consistente.»
-- Non può risultare ACCEPTED senza un rapporto valido, né un incarico creato
-- con l'invito ancora pending: entrambe le scritture stanno nella stessa
-- transazione, e il `for update` sull'invito decide l'unico vincitore fra
-- accept, decline e cancel concorrenti.
--
-- Il client manda l'ID dell'invito, l'azione e i soli metadata tecnici. Il
-- server usa la proposta persistita: §29 vieta che la risposta possa
-- alterare destinatario, Società, ruolo, custom, ambito o Team.
-- ============================================================

-- Un quarto canale di provenienza: l'invito sportivo. Gli altri tre restano.
alter table public.club_members
  drop constraint if exists club_members_added_by_check;

alter table public.club_members
  add constraint club_members_added_by_check
  check (added_by in ('admin_manual', 'self_request', 'invite_link', 'invitation'));

create or replace function public.respond_to_member_invite(
  p_invite_id         uuid,
  p_accept            boolean,
  p_expected_revision integer default null,
  p_idempotency_key   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_inv          public.club_member_invites%rowtype;
  v_role         public.club_assignment_roles%rowtype;
  v_fingerprint  text;
  v_replay       jsonb;
  v_archived     boolean;
  v_membership   uuid;
  v_assignment   uuid;
  v_resolved     timestamptz;
  v_other_active integer;
  v_result       jsonb;
  v_club_owner   uuid;
  v_club_name    text;
  v_person_name  text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_inv from public.club_member_invites where id = p_invite_id;

  /* §8: il destinatario è derivato dal contesto autenticato. Un
     amministratore non può rispondere al posto della persona. */
  if not found or v_inv.invitee_profile_id <> v_uid then
    raise exception 'INVITE_NOT_AVAILABLE';
  end if;

  v_fingerprint := md5('member_invite_respond|' || p_invite_id::text
    || '|' || case when p_accept then 'accept' else 'decline' end
    || '|' || coalesce(p_expected_revision::text, ''));

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, v_inv.club_id, 'member_invite_respond', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  perform public.assert_agent_rate_limit(
    'member_invite_respond', null, 60, interval '1 hour'
  );

  select * into v_inv from public.club_member_invites
  where id = p_invite_id
  for update;

  /* §33: «Un retry idempotente di un vecchio accept restituisce il risultato
     storico dell'operazione.» Non si ricrea niente e non si solleva un
     errore tecnico: si riporta la decisione già presa. */
  if v_inv.status <> 'pending' then
    return jsonb_build_object(
      'invite_id',       v_inv.id,
      'status',          v_inv.status,
      'revision',        v_inv.revision,
      'resolved_at',     v_inv.resolved_at,
      'assignment_id',   v_inv.assignment_id,
      'membership_id',   v_inv.membership_id,
      'already_applied', true
    );
  end if;

  if p_expected_revision is not null and v_inv.revision is distinct from p_expected_revision then
    raise exception 'INVITE_REVISION_CONFLICT';
  end if;

  v_resolved := timezone('utc', now());

  -- ── Rifiuto (§32) ───────────────────────────────────────────────────────
  -- «Non crea SocietyMembership o MembershipAssignment e non modifica altri
  -- incarichi già esistenti fra persona e società.»
  if not p_accept then
    update public.club_member_invites
    set status      = 'declined',
        resolved_at = v_resolved,
        resolved_by = v_uid,
        revision    = revision + 1
    where id = p_invite_id;

    insert into public.club_member_invite_audit
      (club_id, invite_id, actor_id, operation, previous_state, next_state, details)
    values (v_inv.club_id, p_invite_id, v_uid, 'decline', 'pending', 'declined', '{}'::jsonb);

    v_result := jsonb_build_object(
      'invite_id',       p_invite_id,
      'status',          'declined',
      'revision',        v_inv.revision + 1,
      'resolved_at',     v_resolved,
      'already_applied', false
    );
  else
    -- ── Accettazione (§30) ────────────────────────────────────────────────
    if v_inv.structured_role_id is not null then
      select * into v_role from public.club_assignment_roles
      where id = v_inv.structured_role_id;

      if not found or not v_role.is_available then
        raise exception 'INVITE_NOT_ACCEPTABLE';
      end if;
    end if;

    if v_inv.scope_type = 'team' then
      select ct.is_archived into v_archived
      from public.club_teams ct
      where ct.id = v_inv.team_id and ct.club_id = v_inv.club_id
      for share;

      if v_archived is null or v_archived then
        raise exception 'INVITE_NOT_ACCEPTABLE';
      end if;
    end if;

    /* §30.4-5: cerca una relazione riutilizzabile prima di crearne una.
       `club_members_unique_profile` rende questa la sola strada possibile, e
       §7 la vuole comunque: più incarichi, una sola relazione. */
    select cm.id into v_membership
    from public.club_members cm
    where cm.club_id = v_inv.club_id
      and cm.profile_id = v_uid
    for update;

    if v_membership is null then
      insert into public.club_members
        (club_id, profile_id, member_role, staff_title, status, added_by, team_id)
      values (
        v_inv.club_id,
        v_uid,
        v_inv.profile_type,
        /* La proiezione del titolo la scrive il blocco più sotto, che sa se
           questo è davvero l'incarico principale. */
        null,
        'active',
        'invitation',
        case when v_inv.scope_type = 'team' then v_inv.team_id end
      )
      returning id into v_membership;
    else
      /* Una relazione già presente viene **riusata**, non duplicata, e
         diventa attiva: la proposta storica rispecchiata dalla SEZIONE 22,
         una richiesta della persona o un rapporto concluso tornano allo
         stesso rapporto, non a un secondo.
         §30 vieta di «riattivare una relazione conclusa senza le condizioni
         previste dal dominio»: la condizione è esattamente questa —
         un'accettazione valida di una proposta della Società. */
      update public.club_members
      set status     = 'active',
          updated_at = timezone('utc', now())
      where id = v_membership;
    end if;

    /* §30.6: creare **oppure riusare** l'assegnazione. Se un altro percorso
       l'ha già creata mentre l'invito era pending, non è un errore: è una
       condizione già soddisfatta. */
    insert into public.club_member_assignments (
      club_id, membership_id, profile_id, profile_type, structured_role_id,
      custom_role_name, scope_type, team_id, source_invite_id
    )
    select
      v_inv.club_id, v_membership, v_uid, v_inv.profile_type,
      v_inv.structured_role_id, v_inv.custom_role_name,
      v_inv.scope_type, v_inv.team_id, v_inv.id
    where v_inv.structured_role_id is not null
    on conflict do nothing
    returning id into v_assignment;

    if v_assignment is null and v_inv.structured_role_id is not null then
      select a.id into v_assignment
      from public.club_member_assignments a
      where a.club_id = v_inv.club_id
        and a.profile_id = v_uid
        and a.status = 'active'
        and a.profile_type = v_inv.profile_type
        and a.structured_role_id = v_inv.structured_role_id
        and coalesce(lower(a.custom_role_name), '')
            = coalesce(lower(public.normalize_assignment_custom_role(v_inv.custom_role_name)), '')
        and a.scope_type = v_inv.scope_type
        and a.team_id is not distinct from v_inv.team_id;
    end if;

    /* §30: non può risultare ACCEPTED senza un rapporto valido. Un invito
       rispecchiato dal legacy non ha incarico strutturato, e in quel caso la
       relazione riusata **è** il risultato. */
    if v_assignment is null and v_inv.structured_role_id is not null then
      raise exception 'INVITE_NOT_ACCEPTABLE';
    end if;

    /* Proiezione sulle colonne storiche di `club_members` (SEZIONE 21): solo
       quando questo è l'unico incarico attivo. Un secondo incarico non
       riscrive il ruolo già mostrato dall'Organico. */
    select count(*)::integer into v_other_active
    from public.club_member_assignments a
    where a.membership_id = v_membership
      and a.status = 'active'
      and (v_assignment is null or a.id <> v_assignment);

    if v_other_active = 0 then
      update public.club_members
      set member_role = v_inv.profile_type,
          team_id     = case when v_inv.scope_type = 'team' then v_inv.team_id end,
          staff_title = case
            when v_inv.profile_type in ('staff', 'director')
            then public.club_assignment_role_label(
                   v_inv.structured_role_id, v_inv.custom_role_name)
          end,
          updated_at  = timezone('utc', now())
      where id = v_membership;
    end if;

    update public.club_member_invites
    set status        = 'accepted',
        resolved_at   = v_resolved,
        resolved_by   = v_uid,
        assignment_id = v_assignment,
        membership_id = v_membership,
        revision      = revision + 1
    where id = p_invite_id;

    insert into public.club_member_invite_audit
      (club_id, invite_id, actor_id, operation, previous_state, next_state, details)
    values (
      v_inv.club_id, p_invite_id, v_uid, 'accept', 'pending', 'accepted',
      jsonb_build_object(
        'membership_id', v_membership,
        'assignment_id', v_assignment,
        'reused',        v_assignment is not null and v_other_active > 0
      )
    );

    v_result := jsonb_build_object(
      'invite_id',       p_invite_id,
      'status',          'accepted',
      'revision',        v_inv.revision + 1,
      'resolved_at',     v_resolved,
      'assignment_id',   v_assignment,
      'membership_id',   v_membership,
      'already_applied', false
    );
  end if;

  /* §27: la risposta è comunicata agli actor autorizzati secondo le regole
     centrali del progetto, che per la Società significa il proprietario —
     non tutti gli amministratori, e non il creatore ormai revocato. Il tipo
     è quello canonico già esistente. */
  select c.owner_profile_id, c.name into v_club_owner, v_club_name
  from public.clubs c where c.id = v_inv.club_id;

  select p.full_name into v_person_name from public.profiles p where p.id = v_uid;

  if v_club_owner is not null then
    insert into public.notifications (recipient_profile_id, type, title, body, data)
    values (
      v_club_owner,
      'roster_assignment_responded',
      coalesce(v_club_name, 'La società'),
      coalesce(v_person_name, 'Un utente')
        || case when p_accept then ' ha accettato l''invito' else ' ha rifiutato l''invito' end,
      jsonb_build_object(
        'invite_id', p_invite_id::text,
        'club_id',   v_inv.club_id::text,
        'accepted',  p_accept
      )
    );
  end if;

  perform public.club_relationship_operation_record(
    p_idempotency_key, v_inv.club_id, 'member_invite_respond', v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.respond_to_member_invite(uuid, boolean, integer, text) from public;
grant execute on function public.respond_to_member_invite(uuid, boolean, integer, text) to authenticated;

comment on function public.respond_to_member_invite(uuid, boolean, integer, text) is
  'DAS-REV-19 §29-§32: accettazione o rifiuto del destinatario. L''accept '
  'risolve l''invito e crea o riusa relazione e incarico nello stesso commit.';


-- ============================================================
-- SEZIONE 21 — Proiezione sulle colonne storiche di club_members
--
-- `member_role`, `team_id` e `staff_title` restano quello che sono sempre
-- stati per Organico, Centro Squadre, ricerca e profilo. Dopo questa
-- migrazione sono però la **proiezione** dell'incarico principale, non la
-- sua unica rappresentazione — lo stesso passaggio che DAS-REV-08 ha fatto
-- con `club_team_seasons`.
--
-- La proiezione viene scritta solo quando l'incarico accettato è l'unico
-- attivo della persona in quella Società. Un secondo incarico non riscrive
-- il ruolo già mostrato: §35 vieta che un accept «incrementi due volte i
-- conteggi», e riscrivere la riga equivarrebbe a spostare la persona da una
-- squadra all'altra senza che nessuno lo abbia chiesto.
--
-- Nessun trigger: gli altri percorsi che scrivono `club_members` (inserimento
-- manuale dall'Organico, link di invito) continuano a farlo come prima, e un
-- trigger che li inseguisse creerebbe incarichi che nessuno ha proposto.
-- ============================================================


-- ============================================================
-- SEZIONE 22 — Rispecchiamento delle proposte pending storiche (§43)
--
-- Prima di oggi «invito in uscita» significava una riga `club_members` in
-- stato `pending`, creata dal client. Quelle righe esistono, il destinatario
-- può ancora rispondere, e `check_team_deactivation` le conta già come
-- impedimenti. §43 vieta di fonderle con altri processi e di inventare i
-- campi che non hanno.
--
-- Ogni riga riceve quindi un Invitation **specchio**, con:
--   · `legacy_member_id` che la lega alla riga originale;
--   · `created_at` reale, non la data della migrazione;
--   · `legacy_role_label` al posto di un ruolo di catalogo che non esiste —
--     `structured_role_id` resta nullo, e il CHECK lo consente solo qui.
--
-- Accettare uno di questi inviti riusa la riga originale (SEZIONE 20 trova
-- la membership e la porta ad `active`) invece di crearne una seconda, che
-- `club_members_unique_profile` rifiuterebbe.
--
-- Rieseguibile: `where not exists` più l'indice unico su `legacy_member_id`.
-- ============================================================

insert into public.club_member_invites (
  club_id, invitee_profile_id, profile_type, structured_role_id,
  legacy_role_label, scope_type, team_id, status, created_at,
  legacy_member_id, created_by
)
select
  cm.club_id,
  cm.profile_id,
  cm.member_role,
  null,
  public.club_member_role_label(cm.member_role, cm.staff_title),
  case when cm.team_id is null then 'society' else 'team' end,
  cm.team_id,
  'pending',
  cm.created_at,
  cm.id,
  null
from public.club_members cm
where cm.status = 'pending'
  and cm.added_by = 'admin_manual'
  and cm.profile_id is not null
  and cm.member_role in ('player', 'coach', 'staff', 'director')
  and not exists (
    select 1 from public.club_member_invites inv where inv.legacy_member_id = cm.id
  );

/**
 * La RPC legacy resta il percorso dei client non ancora aggiornati, ma non
 * può più lasciare lo specchio indietro: risolve anche l'Invitation legato.
 *
 * Ricreata da 20260615120000_club_members_team_and_approval.sql con la sola
 * aggiunta finale; il resto del corpo è invariato.
 */
create or replace function public.respond_to_club_membership(
  p_member_id uuid,
  p_accept    boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current    uuid := auth.uid();
  v_member     public.club_members%rowtype;
  v_club_owner uuid;
  v_club_name  text;
  v_full_name  text;
  v_action     text;
  v_new_status text;
begin
  if v_current is null then
    raise exception 'Authentication required';
  end if;

  select * into v_member
  from public.club_members
  where id = p_member_id;

  if not found then
    raise exception 'Richiesta non trovata';
  end if;

  if v_member.profile_id <> v_current then
    raise exception 'Non autorizzato';
  end if;

  if v_member.status <> 'pending' then
    raise exception 'Richiesta già gestita';
  end if;

  v_new_status := case when p_accept then 'active' else 'rejected' end;
  v_action     := case when p_accept then 'accettato' else 'rifiutato' end;

  update public.club_members
  set
    status     = v_new_status,
    updated_at = timezone('utc', now())
  where id = p_member_id;

  select c.owner_profile_id, c.name
  into v_club_owner, v_club_name
  from public.clubs c
  where c.id = v_member.club_id;

  select p.full_name into v_full_name
  from public.profiles p
  where p.id = v_current;

  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    v_club_owner,
    'roster_assignment_responded',
    'Risposta alla richiesta di rosa',
    coalesce(v_full_name, 'Un utente') || ' ha ' || v_action || ' di unirsi a ' || coalesce(v_club_name, 'il club'),
    jsonb_build_object(
      'club_id',        v_member.club_id::text,
      'club_member_id', p_member_id::text,
      'team_id',        v_member.team_id::text,
      'accepted',       p_accept
    )
  );

  /* DAS-REV-19 §22: lo specchio non resta pending dietro una risposta già
     data. Senza questo, il Centro mostrerebbe in attesa un invito concluso. */
  update public.club_member_invites
  set status        = case when p_accept then 'accepted' else 'declined' end,
      resolved_at   = timezone('utc', now()),
      resolved_by   = v_current,
      membership_id = case when p_accept then p_member_id end,
      revision      = revision + 1
  where legacy_member_id = p_member_id
    and status = 'pending';
end;
$$;

revoke all on function public.respond_to_club_membership(uuid, boolean) from public;
grant execute on function public.respond_to_club_membership(uuid, boolean) to authenticated;


-- ============================================================
-- SEZIONE 23 — Conteggi che devono cambiare fonte (§35)
--
-- Due proiezioni contavano «invito in uscita» come riga `club_members`
-- pending. Dopo la SEZIONE 22 quelle righe hanno uno specchio, e le proposte
-- nuove non ne producono affatto: lasciarle così le avrebbe fatte scendere a
-- zero mentre il Centro ne mostrava dieci.
--
-- Le funzioni sono ridefinite integralmente dalle migrazioni che le hanno
-- introdotte (20261018090000 e 20261020090000) con la sola sostituzione del
-- sotto-conteggio. Nessun'altra differenza.
-- ============================================================

drop function if exists public.fetch_dashboard_society_overview(uuid);

create function public.fetch_dashboard_society_overview(p_club_id uuid)
returns table (
  -- ── Riepilogo e conteggi ────────────────────────────────────────────
  positions_open_count          integer,
  applications_count            integer,
  teams_count                   integer,
  drafts_count                  integer,
  scheduled_count               integer,

  -- ── Inviti e richieste (§14) ────────────────────────────────────────
  invites_incoming_count        integer,
  invites_pending_count         integer,

  -- ── Conteggio canonico "da gestire" (§10) ───────────────────────────
  applications_to_handle_count  integer,

  -- ── Segnali operativi normalizzati ──────────────────────────────────
  priority_signals              jsonb,
  priority_total_count          integer,

  -- ── Preview ─────────────────────────────────────────────────────────
  applications_preview          jsonb,
  teams_preview                 jsonb,
  drafts_preview                jsonb,
  recent_content_preview        jsonb,

  -- ── Metadata di cache e accesso ─────────────────────────────────────
  access_verified_at            timestamptz,
  data_revision                 bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid   := auth.uid();
  v_caps    text[];
  -- Un perimetro **per capability** (§19). Le coppie `_all` esistono perché
  -- «scope null = illimitato» è la regola più facile da invertire per
  -- sbaglio: scritta una volta, riusata in ogni predicato.
  v_pos_scope  uuid[];
  v_pos_all    boolean;
  v_app_scope  uuid[];
  v_app_all    boolean;
  v_team_scope uuid[];
  v_team_all   boolean;
  v_inv_scope  uuid[];
  v_inv_all    boolean;
  v_req_scope  uuid[];
  v_req_all    boolean;
  -- I contenuti non hanno squadra: `club_media_posts` appartiene alla
  -- Società. Le metriche editoriali esistono quindi solo per chi ha
  -- `content_view` senza restrizione di squadra.
  v_content_all boolean;
  v_now     timestamptz := timezone('utc', now());
  v_signals jsonb  := '[]'::jsonb;
  v_total   integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  v_pos_scope  := public.dashboard_club_capability_scope(p_club_id, 'positions_view');
  v_pos_all    := v_pos_scope is null;
  v_app_scope  := public.dashboard_club_capability_scope(p_club_id, 'applications_view');
  v_app_all    := v_app_scope is null;
  v_team_scope := public.dashboard_club_capability_scope(p_club_id, 'teams_view');
  v_team_all   := v_team_scope is null;
  v_inv_scope  := public.dashboard_club_capability_scope(p_club_id, 'invites_view');
  v_inv_all    := v_inv_scope is null;
  v_req_scope  := public.dashboard_club_capability_scope(p_club_id, 'member_requests_view');
  v_req_all    := v_req_scope is null;
  v_content_all := public.dashboard_club_capability_scope(p_club_id, 'content_view') is null;

  if not ('dashboard_view' = any (v_caps)) then
    return query select
      null::integer, null::integer, null::integer, null::integer, null::integer,
      null::integer, null::integer,
      null::integer,
      null::jsonb, null::integer,
      null::jsonb, null::jsonb, null::jsonb, null::jsonb,
      null::timestamptz, null::bigint;
    return;
  end if;

  -- ── Segnali `new_applications` ────────────────────────────────────────
  if 'applications_view' = any (v_caps) then
    select coalesce(jsonb_agg(signal order by signal->>'occurred_at' desc), '[]'::jsonb)
      into v_signals
    from (
      select jsonb_build_object(
        'type_id',         'new_applications',
        'aggregation_key', 'new_applications:' || p_club_id::text || ':' || ra.id::text,
        'target_kind',     'position',
        'target_id',       ra.id,
        'count',           count(app.id)::integer,
        'role',            ra.role_required::text,
        'team_name',       ct.name,
        'deadline_at',     ra.deadline,
        'occurred_at',     max(app.created_at)
      ) as signal
      from public.recruiting_ads ra
      join public.recruiting_applications app
        on app.ad_id = ra.id
       and app.status = 'submitted'
      left join public.club_teams ct on ct.id = ra.team_id
      where ra.club_id = p_club_id
        and ra.status = 'published'
        and (v_app_all or ra.team_id = any (v_app_scope))
      group by ra.id, ra.role_required, ra.deadline, ct.name
      order by max(app.created_at) desc
      limit 10
    ) signals;

    select count(*)::integer into v_total
    from (
      select ra.id
      from public.recruiting_ads ra
      join public.recruiting_applications app
        on app.ad_id = ra.id
       and app.status = 'submitted'
      where ra.club_id = p_club_id
        and ra.status = 'published'
        and (v_app_all or ra.team_id = any (v_app_scope))
      group by ra.id
    ) totals;
  end if;

  return query
  select
    case when 'positions_view' = any (v_caps) then (
      select count(*)::integer
      from public.recruiting_ads ra
      where ra.club_id = p_club_id
        and ra.status = 'published'
        and (v_pos_all or ra.team_id = any (v_pos_scope))
    ) end as positions_open_count,

    case when 'applications_view' = any (v_caps) then (
      select count(*)::integer
      from public.recruiting_applications app
      join public.recruiting_ads ra on ra.id = app.ad_id
      where ra.club_id = p_club_id
        and app.status <> 'withdrawn'
        and (v_app_all or ra.team_id = any (v_app_scope))
    ) end as applications_count,

    -- §15: archiviate escluse. Le affiliate non compaiono perché la fonte è
    -- `club_teams`, non `club_affiliations`: una Società collegata non è una
    -- squadra di questa Società.
    case when 'teams_view' = any (v_caps) then (
      select count(*)::integer
      from public.club_teams ct
      where ct.club_id = p_club_id
        and not ct.is_archived
        and (v_team_all or ct.id = any (v_team_scope))
    ) end as teams_count,

    case when 'content_view' = any (v_caps) and v_content_all then (
      select count(*)::integer
      from public.club_media_posts cmp
      where cmp.club_id = p_club_id
        and cmp.status = 'draft'
    ) end as drafts_count,

    -- Contratto predisposto, dominio non ancora capace di programmare:
    -- `club_media_posts.status` ammette draft/published/archived.
    null::integer as scheduled_count,

    /* DAS-REV-19 §15: le richieste in ingresso **esistono** — sono il
       modello canonico delle richieste avviate dalla persona, che il Centro
       legge nella seconda tab. Finché nessuno le leggeva, DAS-REV-07 §14
       imponeva `null` invece di uno zero inventato; ora il numero è reale,
       e resta `null` per chi non ha la chiave di lettura. */
    case when 'member_requests_view' = any (v_caps) then (
      select count(*)::integer
      from public.club_members cm
      where cm.club_id = p_club_id
        and cm.status = 'pending'
        and cm.added_by = 'self_request'
        and cm.profile_id is not null
        and (v_req_all or (cm.team_id is not null and cm.team_id = any (v_req_scope)))
    ) end as invites_incoming_count,

    case when 'invites_view' = any (v_caps) then (
      /* DAS-REV-19 §35: il pending canonico è ora l'Invitation, non una riga
         di organico in stato `pending`. Le proposte storiche sono state
         rispecchiate, quindi il numero non cambia per i dati esistenti e
         comincia a contare quelle nuove, che `club_members` non ha mai. */
      select count(*)::integer
      from public.club_member_invites inv
      where inv.club_id = p_club_id
        and inv.status = 'pending'
        and (
          v_inv_all
          or (inv.scope_type = 'team' and inv.team_id = any (v_inv_scope))
        )
    ) end as invites_pending_count,

    case when 'applications_view' = any (v_caps) then (
      select count(*)::integer
      from public.recruiting_applications app
      join public.recruiting_ads ra on ra.id = app.ad_id
      where ra.club_id = p_club_id
        and app.status = 'submitted'
        and (v_app_all or ra.team_id = any (v_app_scope))
    ) end as applications_to_handle_count,

    case when 'applications_view' = any (v_caps) then v_signals end
      as priority_signals,
    case when 'applications_view' = any (v_caps) then v_total end
      as priority_total_count,

    case when 'applications_view' = any (v_caps) then (
      select coalesce(jsonb_agg(item order by item->>'created_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',         app.id,
          'created_at', app.created_at,
          'status',     app.status,
          'ad_id',      ra.id,
          'ad_title',   ra.title,
          'role',       ra.role_required,
          'team_name',  ct.name,
          'name',       coalesce(nullif(trim(p.full_name), ''), 'Candidato'),
          'avatar_url', p.avatar_url
        ) as item
        from public.recruiting_applications app
        join public.recruiting_ads ra on ra.id = app.ad_id
        join public.profiles p on p.id = app.applicant_profile_id
        left join public.club_teams ct on ct.id = ra.team_id
        where ra.club_id = p_club_id
          and app.status <> 'withdrawn'
          and (v_app_all or ra.team_id = any (v_app_scope))
        order by app.created_at desc
        limit 3
      ) preview
    ) end as applications_preview,

    -- §15: ordinamento sportivo stabile — prima squadra, poi settore
    -- giovanile secondo `sort_order`. Nessun conteggio di giocatori o staff
    -- nel payload: un campo restituito è un campo che prima o poi qualcuno
    -- disegna, e §15 lo vieta.
    case when 'teams_view' = any (v_caps) then (
      select coalesce(jsonb_agg(item order by item->>'rank', item->>'name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',       ct.id,
          'name',     ct.name,
          'category', ct.category,
          'logo_url', ct.logo_url,
          'rank',     lpad((
            case when ct.team_type = 'senior' then 0 else 1 end * 100000
            + greatest(0, least(ct.sort_order, 99999))
          )::text, 6, '0')
        ) as item
        from public.club_teams ct
        where ct.club_id = p_club_id
          and not ct.is_archived
          and (v_team_all or ct.id = any (v_team_scope))
        order by
          case when ct.team_type = 'senior' then 0 else 1 end,
          ct.sort_order,
          ct.name
        limit 3
      ) preview
    ) end as teams_preview,

    case when 'content_view' = any (v_caps) and v_content_all then (
      select coalesce(jsonb_agg(item order by item->>'updated_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',            cmp.id,
          'title',         cmp.title,
          'kind',          cmp.kind,
          'status',        cmp.status,
          'thumbnail_url', coalesce(cmp.thumbnail_url, cmp.visual_url),
          'updated_at',    cmp.updated_at
        ) as item
        from public.club_media_posts cmp
        where cmp.club_id = p_club_id
          and cmp.status = 'draft'
        order by cmp.updated_at desc
        limit 3
      ) preview
    ) end as drafts_preview,

    case when 'content_view' = any (v_caps) and v_content_all then (
      select coalesce(jsonb_agg(item order by item->>'published_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',            cmp.id,
          'title',         cmp.title,
          'kind',          cmp.kind,
          'status',        cmp.status,
          'thumbnail_url', coalesce(cmp.thumbnail_url, cmp.visual_url),
          'published_at',  cmp.published_at
        ) as item
        from public.club_media_posts cmp
        where cmp.club_id = p_club_id
          and cmp.status = 'published'
          and cmp.published_at <= v_now
        order by cmp.published_at desc
        limit 3
      ) preview
    ) end as recent_content_preview,

    v_now as access_verified_at,
    (extract(epoch from v_now) * 1000)::bigint as data_revision;
end;
$$;

revoke all on function public.fetch_dashboard_society_overview(uuid) from public;
grant execute on function public.fetch_dashboard_society_overview(uuid) to authenticated;

/**
 * Il `drop` prima del `create` non è pignoleria: `create or replace` non può
 * cambiare la riga definita dai parametri OUT (42P13), e una funzione
 * `returns table` è esattamente il caso in cui quel vincolo scatta. Qui le
 * colonne non cambiano — è la stessa firma di 20261020090000, con il solo
 * sotto-conteggio degli inviti riscritto — ma il remoto di questo progetto ha
 * già deviato dai file una volta, e in quel caso la migrazione fallirebbe a
 * metà invece di applicarsi.
 *
 * Il `drop` toglie anche i privilegi, che il `grant` sotto ripristina.
 */
drop function if exists public.fetch_team_detail(uuid);

create or replace function public.fetch_team_detail(p_team_id uuid)
returns table (
  team_id                uuid,
  club_id                uuid,
  club_name              text,
  club_logo_url          text,
  club_is_verified       boolean,
  name                   text,
  crest_url              text,
  crest_inherited        boolean,
  city                   text,
  city_inherited         boolean,
  season_id              text,
  season_label           text,
  has_season_config      boolean,
  type_id                text,
  type_label             text,
  level_id               text,
  level_label            text,
  is_archived            boolean,
  -- capability risolte sul contesto Team–Società
  is_owner               boolean,
  can_edit               boolean,
  can_view_roster        boolean,
  can_manage_roster      boolean,
  can_view_applications  boolean,
  can_view_invites       boolean,
  can_manage_invites     boolean,
  can_view_positions     boolean,
  can_create_positions   boolean,
  -- Organico
  roster_players_count   integer,
  roster_staff_count     integer,
  roster_avatars         jsonb,
  -- Candidature
  applications_count     integer,
  applications_new_count integer,
  -- Inviti e richieste
  invites_pending_count  integer,
  -- Gruppo squadra (vedi SEZIONE 5: dominio assente)
  group_supported        boolean,
  group_conversation_id  uuid,
  group_title            text,
  group_member_count     integer,
  access_verified_at     timestamptz,
  data_revision          bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_club        uuid;
  v_season      text := public.current_season_id();
  v_now         timestamptz := timezone('utc', now());
  v_owner       boolean;
  v_roster      boolean;
  v_apps        boolean;
  v_inv_view    boolean;
  v_inv_manage  boolean;
  v_pos_view    boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select ct.club_id into v_club from public.club_teams ct where ct.id = p_team_id;

  -- Inesistente, non consultabile o fuori perimetro: un solo esito (§27).
  if v_club is null
     or not public.team_capability_allows(v_club, p_team_id, 'teams_view')
  then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  v_owner      := public.owns_club(v_club);
  v_roster     := public.team_capability_allows(v_club, p_team_id, 'roster_view');
  v_apps       := public.team_capability_allows(v_club, p_team_id, 'applications_view');
  v_inv_view   := public.team_capability_allows(v_club, p_team_id, 'invites_view');
  v_inv_manage := public.team_capability_allows(v_club, p_team_id, 'invites_create');
  v_pos_view   := public.team_capability_allows(v_club, p_team_id, 'positions_view');

  return query
  select
    ct.id,
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    ct.name,
    -- `logo_url` e `city` sono già il valore **risolto** dal trigger di
    -- DAS-REV-08: la modalità dice soltanto da dove proviene. Il client non
    -- ricalcola l'ereditarietà e un errore di caricamento dell'immagine non
    -- la cambia (§8).
    ct.logo_url,
    ct.crest_mode = 'inherited',
    ct.city,
    ct.city_mode = 'inherited',
    v_season,
    (select s.label from public.seasons s where s.id = v_season),
    (cts.id is not null),
    cts.team_type_id,
    tt.label,
    cts.level_id,
    tl.label,
    ct.is_archived,

    v_owner,
    public.can_edit_club_team(ct.id),
    v_roster,
    -- "roster.manage" nel vocabolario di §9 è, in questo dominio, la facoltà
    -- di **collegare una persona**: la chiave è `invites_create`, perché il
    -- solo percorso esistente passa dagli inviti.
    v_inv_manage,
    v_apps,
    v_inv_view,
    v_inv_manage,
    v_pos_view,
    public.team_capability_allows(v_club, ct.id, 'positions_create'),

    -- ── Organico (§11) ────────────────────────────────────────────────
    -- Stessa deduplicazione di `fetch_teams_center_page`: una persona con
    -- più record tecnici non va moltiplicata nello stesso aggregato.
    case when v_roster then (
      select count(distinct coalesce(
               cm.profile_id::text,
               'manual:' || public.footme_normalize_lookup(cm.manual_name)
             ))::integer
      from public.club_members cm
      where cm.team_id = ct.id
        and cm.status = 'active'
        and cm.is_current
        and cm.member_role = 'player'
    ) end,
    case when v_roster then (
      select count(distinct coalesce(
               cm.profile_id::text,
               'manual:' || public.footme_normalize_lookup(cm.manual_name)
             ))::integer
      from public.club_members cm
      where cm.team_id = ct.id
        and cm.status = 'active'
        and cm.is_current
        and cm.member_role in ('coach', 'staff', 'director')
    ) end,
    case when v_roster then coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', a.id,
                 'avatar_url', a.avatar_url,
                 'initials', a.initials
               )
               order by a.ord
             )
      from (
        select
          cm.id,
          p.avatar_url,
          public.team_roster_initials(p.full_name) as initials,
          row_number() over (order by cm.created_at, cm.id) as ord
        from public.club_members cm
        join public.profiles p on p.id = cm.profile_id
        where cm.team_id = ct.id
          and cm.status = 'active'
          and cm.is_current
          and cm.profile_id is not null
        order by cm.created_at, cm.id
        limit 4
      ) a
    ), '[]'::jsonb) end,

    -- ── Candidature (§15) ─────────────────────────────────────────────
    -- Stesso perimetro del centro proprietario: tutto ciò che non è
    -- `withdrawn`, comprese le candidature di posizioni ormai chiuse ma
    -- ancora consultabili. Non è ristretto alle due posizioni in anteprima.
    case when v_apps then (
      select count(*)::integer
      from public.recruiting_applications ra
      join public.recruiting_ads ad on ad.id = ra.ad_id
      where ad.team_id = ct.id
        and ra.status <> 'withdrawn'
    ) end,
    -- "Nuove" è lo stato canonico `submitted` letto dal lato Società, non un
    -- contatore letto/non letto locale a questa pagina (§15). Nessuna GET lo
    -- consuma: solo il dominio proprietario fa avanzare lo stato.
    case when v_apps then (
      select count(*)::integer
      from public.recruiting_applications ra
      join public.recruiting_ads ad on ad.id = ra.ad_id
      where ad.team_id = ct.id
        and ra.status = 'submitted'
    ) end,

    -- ── Inviti e richieste (§16) ──────────────────────────────────────
    -- Inviti in **uscita** verso un profilo PROLINK, come nella Dashboard
    -- Società. I `club_invite_links` non si contano: sono token, non inviti
    -- a una persona. Pending non è membro dell'Organico, ed è il motivo per
    -- cui l'aggregato è separato dai conteggi del roster.
    case when v_inv_view then (
      /* DAS-REV-19 §35: stessa fonte del Centro Inviti. */
      select count(*)::integer
      from public.club_member_invites inv
      where inv.team_id = ct.id
        and inv.status = 'pending'
    ) end,

    -- ── Gruppo squadra: dominio assente (SEZIONE 5) ───────────────────
    false,
    null::uuid,
    null::text,
    null::integer,

    v_now,
    (extract(epoch from v_now) * 1000)::bigint
  from public.club_teams ct
  join public.clubs c on c.id = ct.club_id
  left join public.club_team_seasons cts
    on cts.team_id = ct.id and cts.season_id = v_season
  left join public.team_types tt on tt.id = cts.team_type_id
  left join public.team_levels tl on tl.id = cts.level_id
  where ct.id = p_team_id;
end;
$$;

revoke all on function public.fetch_team_detail(uuid) from public;
grant execute on function public.fetch_team_detail(uuid) to authenticated;


-- ============================================================
-- SEZIONE 24 — Guard di squadra e impedimenti alla disattivazione (§34)
--
-- «Gli inviti e le richieste ancora accettabili che possono produrre un
-- incarico sul Team sono impedimenti rilevanti per la disattivazione.»
--
-- Due metà, come in DAS-REV-10: il trigger impedisce che un invito o un
-- incarico **nascano** su una squadra archiviata (e il `for share` lo mette
-- in attesa della disattivazione in corso); `check_team_deactivation` vede
-- quelli che esistono già. Senza entrambe, fra la verifica e la scrittura
-- resta una finestra.
--
-- `guard_team_is_active` è ridefinita da 20261021090000 con due rami in più.
-- I rami esistenti sono invariati.
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
  elsif tg_table_name = 'club_member_invites' then
    v_team_id  := new.team_id;
    v_relevant := new.status = 'pending';
  elsif tg_table_name = 'club_member_assignments' then
    v_team_id  := new.team_id;
    v_relevant := new.status = 'active';
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

    if tg_table_name = 'club_member_invites' and old.status = 'pending' then
      return new;
    end if;

    if tg_table_name = 'club_member_assignments' and old.status = 'active' then
      return new;
    end if;
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

drop trigger if exists club_member_invites_guard_team_active on public.club_member_invites;
create trigger club_member_invites_guard_team_active
  before insert or update on public.club_member_invites
  for each row execute function public.guard_team_is_active();

drop trigger if exists club_member_assignments_guard_team_active on public.club_member_assignments;
create trigger club_member_assignments_guard_team_active
  before insert or update on public.club_member_assignments
  for each row execute function public.guard_team_is_active();

/**
 * Ridefinita da 20261021090000. Cambia un solo impedimento: gli "inviti" non
 * sono più righe di organico pending ma Invitation e richieste ancora
 * accettabili — le due cose che §34 nomina. Il resto è invariato, compresa
 * la regola per cui un conteggio non consultabile resta `null`.
 */
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
  into v_invites;

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
-- SEZIONE 25 — Dispatcher delle notifiche (§27)
--
-- «Riutilizza dispatcher, destinatari, preferenze, deduplicazione, unread ed
-- eventuale push esistenti.» Un solo tipo nuovo, che entra nella categoria
-- Richieste e sotto la preferenza `requests` come tutti gli altri inviti.
--
-- Ridefinita da 20261024090000 con due righe in più: il resto è invariato.
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
    when 'club_admin_invite'                        then 'richieste'
    when 'society_invitation_created'               then 'richieste'
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
    when 'club_admin_invite'                        then 'requests'
    when 'society_invitation_created'               then 'requests'
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

revoke all on function public.notifications_before_insert() from public;

drop trigger if exists notifications_before_insert on public.notifications;
create trigger notifications_before_insert
  before insert on public.notifications
  for each row execute function public.notifications_before_insert();


-- ============================================================
-- SEZIONE 26 — Collegamenti correnti sul profilo personale (§31)
--
-- «Se i collegamenti correnti sono già esposti nel profilo, aggiorna la
-- relativa query; non attendere l'implementazione della gestione completa
-- dei rapporti per creare la relazione o aprire il profilo.»
--
-- Non serve nessuna lettura nuova. Il profilo personale e le superfici di
-- ricerca leggono il rapporto Persona–Società da `club_members` — nome del
-- club corrente, squadra, ruolo — e la SEZIONE 20 scrive esattamente quelle
-- colonne nello stesso commit dell'accettazione. Il collegamento è quindi
-- già visibile dove lo era prima, senza una query parallela.
--
-- Una RPC `fetch_my_society_assignments` esisteva in una stesura
-- precedente di questa migrazione ed è stata tolta: nessuna schermata la
-- chiamava, e un contratto che nessuno usa è debito, non predisposizione.
-- Quando un pack mostrerà **più** incarichi per la stessa Società — cosa che
-- la proiezione non può rappresentare — la leggerà da
-- `club_member_assignments`, che quel pack avrà motivo di interrogare.
-- ============================================================
