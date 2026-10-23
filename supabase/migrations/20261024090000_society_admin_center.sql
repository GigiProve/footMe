-- ============================================================
-- DAS-REV-13 — Centro Amministratori e inviti
--
-- Il dominio amministrativo della Società esisteva già, ma incompleto:
--
--   · l'accesso era «membro `club_members` attivo con almeno un grant in
--     `club_member_permissions`» (DAS-REV-12 §11). Nessun **ruolo** nominato,
--     nessun lifecycle, nessun invito;
--   · `fetch_society_structure` contava come «invito amministrativo pending»
--     una riga `club_members` pending con grant — combinazione che la RLS di
--     `club_member_permissions` rende **impossibile** da creare (l'INSERT
--     richiede `status = 'active'`). Quel contatore non poteva che valere 0;
--   · la lettura degli amministratori non aveva una capability propria:
--     `can_view_admins = can_open_admin_center = owns_club()`.
--
-- Questa migrazione completa il dominio **senza** crearne un secondo:
--
--   1. quattro capability nuove, nello stesso CHECK di tutte le altre;
--   2. un catalogo ruoli per Società — nomi che raggruppano chiavi di
--      permesso **reali**, mai nuove;
--   3. `club_admin_memberships`: la membership amministrativa come record
--      esplicito, distinta dall'organico (§5 vieta che accettare un invito
--      crei «un record pubblico nella rosa, nello staff o nella dirigenza»);
--   4. `club_admin_invites`: proposta con revisione, scadenza server, token
--      hashato, binding verificato del destinatario esterno;
--   5. accettazione atomica: invito → accepted **e** grant effettivi nello
--      stesso commit.
--
-- L'autorizzazione resta dove è sempre stata: `club_member_permissions`.
-- Il ruolo dà un nome a un insieme di quelle chiavi e non ne inventa
-- nessuna (§28: «Non inventare permessi in assenza di un catalogo reale»).
--
-- Riferimenti riusati:
--   20261018090000  team_id sullo scope dei grant, dashboard_club_*
--   20261022090000  app_policy_settings, token sha256, operations/idempotenza,
--                   assert_agent_rate_limit, stato derivato di un invito
--   20261023090000  society_structure_admin_ids, fetch_society_structure
--   20260719090100  notifications_before_insert (categoria + gating)
-- ============================================================


-- ============================================================
-- SEZIONE 1 — Capability (§23)
--
-- §23 chiede controlli server **distinti** per leggere gli attivi, leggere
-- gli inviti, invitare e aprire ruoli e permessi. Quattro chiavi, non una.
--
-- Non si riusano `invites_view` / `invites_create`: quelle sono gli inviti
-- all'**organico** (DAS-REV-09 le usa per collegare una persona a una
-- squadra) e §7.2 vieta esplicitamente di mescolare i due domini.
--
-- Sono chiavi Society-level: §23 dice che «uno scope Primavera non autorizza
-- automaticamente ad amministrare gli accessi dell'intera Society», e il
-- modo di garantirlo è che un grant con `team_id` non le conceda mai —
-- vedi `society_admin_allows()` più avanti.
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
    -- gruppo Squadre (DAS-REV-08)
    'teams_create',
    'teams_edit',
    'roster_view',
    -- gruppo Stagioni (DAS-REV-10)
    'seasons_prepare',
    'seasons_history_view',
    'seasons_history_edit',
    'seasons_history_add',
    'teams_lifecycle',
    -- gruppo Rete (DAS-REV-11)
    'network_view',
    'network_requests_view',
    'network_request_send',
    'network_request_manage',
    'network_request_cancel',
    'network_invite_create',
    'network_terminate',
    'network_history_view',
    -- gruppo Amministratori (DAS-REV-13 §23) — nuove
    'admins_view',
    'admin_invites_view',
    'admins_invite',
    'admin_roles_view'
  ));


-- ============================================================
-- SEZIONE 2 — Catalogo dei ruoli (§9)
--
-- «Il selector Ruolo legge ruoli realmente configurati per la Society» e
-- «salva un riferimento canonico, non la stringa visualizzata».
--
-- Un ruolo è un **nome della Società** su un insieme di chiavi di permesso
-- esistenti. §5 lo dice senza ambiguità: «Il nome Direttore sportivo non
-- assegna automaticamente capability. Due Society possono usare lo stesso
-- nome con permessi diversi.» Perciò il ruolo è per-Società e non globale.
--
-- `config_version` è la revisione della configurazione autorizzativa
-- (§16, §20): cambiare le chiavi di un ruolo la incrementa, e una proposta
-- che portava la versione precedente non può più essere accettata in
-- silenzio con la configurazione nuova.
--
-- `is_owner_reserved` non è un ruolo assegnabile: è il modo di rappresentare
-- l'Owner nel catalogo senza renderlo proponibile. §18: «L'Owner non è
-- assegnabile con nessun normale invito, neppure chiamando direttamente
-- l'API». Qui non esiste nemmeno una riga che un invito possa referenziare.
-- ============================================================

create table if not exists public.club_admin_roles (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  name           text not null,
  /* Identificatore stabile dei ruoli seminati: serve al seed idempotente e
     al backfill, non alla UI, che mostra sempre `name`. */
  system_key     text,
  is_active      boolean not null default true,
  /* Seminato dal prodotto. DAS-REV-14 consentirà di crearne altri. */
  is_system      boolean not null default false,
  config_version integer not null default 1,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now()),
  constraint club_admin_roles_name_not_blank check (length(btrim(name)) > 0)
);

create unique index if not exists club_admin_roles_name_idx
  on public.club_admin_roles (club_id, lower(btrim(name)));

create unique index if not exists club_admin_roles_system_idx
  on public.club_admin_roles (club_id, system_key)
  where system_key is not null;

create index if not exists club_admin_roles_club_idx
  on public.club_admin_roles (club_id, is_active, name);

/**
 * Chiavi di permesso di un ruolo.
 *
 * La FK è sul CHECK di `club_member_permissions`: non esiste un catalogo
 * separato di capability, e non deve esistere (§2: «non creare un permission
 * engine parallelo»). Il vincolo è lo stesso, replicato qui perché una riga
 * di questa tabella diventerà una riga di quella.
 */
create table if not exists public.club_admin_role_permissions (
  role_id        uuid not null references public.club_admin_roles(id) on delete cascade,
  permission_key text not null,
  primary key (role_id, permission_key)
);

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
    'dashboard_view', 'positions_view', 'positions_create', 'applications_view',
    'teams_view', 'content_view', 'content_create', 'invites_create', 'invites_view',
    'teams_create', 'teams_edit', 'roster_view',
    'seasons_prepare', 'seasons_history_view', 'seasons_history_edit',
    'seasons_history_add', 'teams_lifecycle',
    'network_view', 'network_requests_view', 'network_request_send',
    'network_request_manage', 'network_request_cancel', 'network_invite_create',
    'network_terminate', 'network_history_view',
    'admins_view', 'admin_invites_view', 'admins_invite', 'admin_roles_view'
  ));

/**
 * Ogni modifica al contenuto autorizzativo incrementa `config_version`.
 *
 * §16: «La configurazione permessi del ruolo deve essere versionata o
 * confrontabile. Se cambia dopo la proposta o mentre la schermata è aperta,
 * non concedere una configurazione diversa in modo invisibile.» Il trigger è
 * sulla tabella delle chiavi perché è lì che il contenuto cambia davvero:
 * rinominare un ruolo non altera ciò che concede.
 */
create or replace function public.club_admin_role_bump_version()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role uuid := coalesce(new.role_id, old.role_id);
begin
  update public.club_admin_roles
  set config_version = config_version + 1,
      updated_at     = timezone('utc', now())
  where id = v_role;

  return coalesce(new, old);
end;
$$;

revoke all on function public.club_admin_role_bump_version() from public;

drop trigger if exists club_admin_role_permissions_bump on public.club_admin_role_permissions;
create trigger club_admin_role_permissions_bump
  after insert or update or delete on public.club_admin_role_permissions
  for each row execute function public.club_admin_role_bump_version();


-- ============================================================
-- SEZIONE 3 — Ruoli seminati (§9, §28)
--
-- §28: «Il normale selector Ruolo/Ambito appartiene alla consegna funzionale
-- di questo invito, usando dati e servizi condivisi. Non inventare permessi
-- in assenza di un catalogo reale.»
--
-- Qui non si inventa nessun permesso: ogni chiave sotto esiste già nel CHECK
-- di `club_member_permissions` ed è già letta da un modulo del prodotto. Si
-- inventa un **nome**, che è esattamente ciò che un ruolo è — e che
-- DAS-REV-14 permetterà alla Società di cambiare.
--
-- Nessun ruolo seminato contiene le chiavi `admins_*`: amministrare gli
-- accessi resta dell'Owner finché la Società non configura un ruolo che lo
-- preveda. Un default che distribuisse quel potere sarebbe una concessione
-- che nessuno ha chiesto.
-- ============================================================

insert into public.club_admin_roles (club_id, name, system_key, is_system)
select c.id, r.name, r.system_key, true
from public.clubs c
cross join (values
  ('Direttore sportivo',      'sporting_director'),
  ('Responsabile recruiting', 'recruiting_manager'),
  ('Team manager',            'team_manager'),
  ('Responsabile comunicazione', 'communication_manager')
) as r(name, system_key)
on conflict do nothing;

insert into public.club_admin_role_permissions (role_id, permission_key)
select role.id, perm.permission_key
from public.club_admin_roles role
join (values
  ('sporting_director',     'dashboard_view'),
  ('sporting_director',     'positions_view'),
  ('sporting_director',     'positions_create'),
  ('sporting_director',     'applications_view'),
  ('sporting_director',     'teams_view'),
  ('sporting_director',     'roster_view'),
  ('sporting_director',     'shortlist_view'),
  ('sporting_director',     'shortlist_add_profiles'),
  ('sporting_director',     'shortlist_add_notes'),
  ('sporting_director',     'shortlist_edit_status'),
  ('sporting_director',     'invites_view'),
  ('sporting_director',     'invites_create'),
  ('recruiting_manager',    'dashboard_view'),
  ('recruiting_manager',    'positions_view'),
  ('recruiting_manager',    'applications_view'),
  ('recruiting_manager',    'shortlist_view'),
  ('recruiting_manager',    'shortlist_create_lists'),
  ('recruiting_manager',    'shortlist_add_profiles'),
  ('recruiting_manager',    'shortlist_add_notes'),
  ('recruiting_manager',    'shortlist_edit_status'),
  ('recruiting_manager',    'shortlist_remove_profiles'),
  ('recruiting_manager',    'notif_new_applications'),
  ('recruiting_manager',    'notif_shortlist_updates'),
  ('team_manager',          'dashboard_view'),
  ('team_manager',          'teams_view'),
  ('team_manager',          'roster_view'),
  ('team_manager',          'applications_view'),
  ('team_manager',          'invites_view'),
  ('team_manager',          'invites_create'),
  ('communication_manager', 'dashboard_view'),
  ('communication_manager', 'content_view'),
  ('communication_manager', 'content_create'),
  ('communication_manager', 'society_publish_media')
) as perm(system_key, permission_key)
  on perm.system_key = role.system_key
where role.is_system
on conflict do nothing;

/**
 * Una Società creata dopo questa migrazione riceve lo stesso catalogo.
 *
 * Senza il trigger, il selector Ruolo di un club nuovo sarebbe vuoto e §9
 * imporrebbe «Non ci sono ruoli disponibili per questo invito» a una Società
 * che non ha ancora avuto modo di configurarne uno.
 */
create or replace function public.club_seed_admin_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.club_admin_roles (club_id, name, system_key, is_system)
  values
    (new.id, 'Direttore sportivo',         'sporting_director',     true),
    (new.id, 'Responsabile recruiting',    'recruiting_manager',    true),
    (new.id, 'Team manager',               'team_manager',          true),
    (new.id, 'Responsabile comunicazione', 'communication_manager', true)
  on conflict do nothing;

  insert into public.club_admin_role_permissions (role_id, permission_key)
  select role.id, perm.permission_key
  from public.club_admin_roles role
  join (values
    ('sporting_director',     'dashboard_view'),
    ('sporting_director',     'positions_view'),
    ('sporting_director',     'positions_create'),
    ('sporting_director',     'applications_view'),
    ('sporting_director',     'teams_view'),
    ('sporting_director',     'roster_view'),
    ('sporting_director',     'shortlist_view'),
    ('sporting_director',     'shortlist_add_profiles'),
    ('sporting_director',     'shortlist_add_notes'),
    ('sporting_director',     'shortlist_edit_status'),
    ('sporting_director',     'invites_view'),
    ('sporting_director',     'invites_create'),
    ('recruiting_manager',    'dashboard_view'),
    ('recruiting_manager',    'positions_view'),
    ('recruiting_manager',    'applications_view'),
    ('recruiting_manager',    'shortlist_view'),
    ('recruiting_manager',    'shortlist_create_lists'),
    ('recruiting_manager',    'shortlist_add_profiles'),
    ('recruiting_manager',    'shortlist_add_notes'),
    ('recruiting_manager',    'shortlist_edit_status'),
    ('recruiting_manager',    'shortlist_remove_profiles'),
    ('recruiting_manager',    'notif_new_applications'),
    ('recruiting_manager',    'notif_shortlist_updates'),
    ('team_manager',          'dashboard_view'),
    ('team_manager',          'teams_view'),
    ('team_manager',          'roster_view'),
    ('team_manager',          'applications_view'),
    ('team_manager',          'invites_view'),
    ('team_manager',          'invites_create'),
    ('communication_manager', 'dashboard_view'),
    ('communication_manager', 'content_view'),
    ('communication_manager', 'content_create'),
    ('communication_manager', 'society_publish_media')
  ) as perm(system_key, permission_key)
    on perm.system_key = role.system_key
  where role.club_id = new.id
    and role.is_system
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.club_seed_admin_roles() from public;

drop trigger if exists clubs_seed_admin_roles on public.clubs;
create trigger clubs_seed_admin_roles
  after insert on public.clubs
  for each row execute function public.club_seed_admin_roles();


-- ============================================================
-- SEZIONE 4 — Membership amministrativa (§5, §20)
--
-- «L'accettazione non crea automaticamente un record pubblico nella rosa,
-- nello staff o nella dirigenza, né modifica il profilo professionale» (§5).
--
-- Finora l'unico modo di avere un accesso amministrativo era essere una riga
-- `club_members` attiva — cioè comparire nell'organico. Un Direttore sportivo
-- invitato ad amministrare sarebbe finito nella rosa dirigenziale pubblica.
-- Da qui l'accesso ha un record proprio.
--
-- Non è «un secondo sistema amministratori» (§20): le **capability** restano
-- righe di `club_member_permissions`, con la stessa semantica di `team_id`.
-- Questa tabella aggiunge ciò che mancava — ruolo, origine, revisione,
-- lifecycle — e nulla che il permission domain già sapesse fare.
--
-- `role_id` è nullable per gli accessi **preesistenti**: chi ha dei grant
-- oggi non ha un ruolo nominato, e inventargliene uno attribuirebbe alla
-- Società una decisione che non ha preso. La presentazione li descrive per
-- quello che sono (§30 vieta di sostituire un nome mancante con null o un
-- id tecnico).
--
-- L'Owner non ha una riga qui: l'ownership è una relazione protetta della
-- Società (`clubs.owner_profile_id`), non un ruolo assegnabile (§5, §20).
-- ============================================================

create table if not exists public.club_admin_memberships (
  id                  uuid primary key default gen_random_uuid(),
  club_id             uuid not null references public.clubs(id) on delete cascade,
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  role_id             uuid references public.club_admin_roles(id) on delete restrict,
  /* Revisione della configurazione del ruolo effettivamente concessa (§20). */
  role_config_version integer,
  scope_mode          text not null default 'society'
    check (scope_mode in ('society', 'teams')),
  status              text not null default 'active'
    check (status in ('active', 'revoked')),
  /* Origine dell'attivazione (§20). Null per gli accessi anteriori al pack. */
  invite_id           uuid,
  granted_by          uuid references public.profiles(id) on delete set null,
  activated_at        timestamptz not null default timezone('utc', now()),
  revoked_at          timestamptz,
  revoked_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now()),
  /* §19: «una sola membership amministrativa effettiva per persona–Society». */
  constraint club_admin_memberships_unique unique (club_id, profile_id)
);

create index if not exists club_admin_memberships_club_idx
  on public.club_admin_memberships (club_id, status);

create index if not exists club_admin_memberships_profile_idx
  on public.club_admin_memberships (profile_id, status);

/**
 * Squadre dello scope selettivo (§10).
 *
 * «Seleziona squadre conserva uno o più ID di Team interni esplicitamente
 * scelti … Non usare categoria, nome, campionato o TeamSeason come
 * identificatore di accesso.» Il riferimento è al **Team stabile**: lo scope
 * sopravvive al cambio di stagione perché `club_teams` sopravvive.
 */
create table if not exists public.club_admin_membership_teams (
  membership_id uuid not null references public.club_admin_memberships(id) on delete cascade,
  team_id       uuid not null references public.club_teams(id) on delete cascade,
  primary key (membership_id, team_id)
);

create or replace function public.club_admin_membership_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.club_admin_membership_touch() from public;

drop trigger if exists club_admin_memberships_touch on public.club_admin_memberships;
create trigger club_admin_memberships_touch
  before insert or update on public.club_admin_memberships
  for each row execute function public.club_admin_membership_touch();

alter table public.club_admin_roles enable row level security;
alter table public.club_admin_role_permissions enable row level security;
alter table public.club_admin_memberships enable row level security;
alter table public.club_admin_membership_teams enable row level security;

-- Tutte le scritture passano dalle RPC definer di questo file: §23 chiede
-- controlli server distinti per ogni operazione, e una policy di INSERT
-- aperta al client li aggirerebbe. Qui esistono solo policy di lettura.

drop policy if exists "club readers read admin roles" on public.club_admin_roles;
create policy "club readers read admin roles"
  on public.club_admin_roles for select to authenticated
  using (public.owns_club(club_id));

drop policy if exists "member reads own admin membership" on public.club_admin_memberships;
create policy "member reads own admin membership"
  on public.club_admin_memberships for select to authenticated
  using (profile_id = auth.uid() or public.owns_club(club_id));


-- ============================================================
-- SEZIONE 5 — Backfill degli accessi esistenti (§28)
--
-- «Gli accessi già legittimamente attivi devono continuare a funzionare. Non
-- obbligare tutti gli amministratori a un nuovo invito per una sola modifica
-- UI.»
--
-- Ogni persona che oggi ha almeno un grant su una Società, con membership
-- attiva, riceve una membership amministrativa che **descrive** quell'accesso.
-- Non ne concede di nuovi: nessun grant viene scritto qui, e lo scope si
-- legge dai grant che esistono. Un grant Society-wide (`team_id is null`)
-- vince sugli altri, come già fa `dashboard_club_capability_scope`.
--
-- L'Owner è escluso: non è una membership.
-- ============================================================

insert into public.club_admin_memberships
  (club_id, profile_id, role_id, scope_mode, status, activated_at)
select
  perm.club_id,
  perm.profile_id,
  null,
  case when bool_or(perm.team_id is null) then 'society' else 'teams' end,
  'active',
  min(perm.created_at)
from public.club_member_permissions perm
join public.clubs c on c.id = perm.club_id
join public.club_members cm
  on cm.club_id = perm.club_id
  and cm.profile_id = perm.profile_id
  and cm.status = 'active'
where perm.profile_id is distinct from c.owner_profile_id
group by perm.club_id, perm.profile_id
on conflict (club_id, profile_id) do nothing;

insert into public.club_admin_membership_teams (membership_id, team_id)
select distinct m.id, perm.team_id
from public.club_admin_memberships m
join public.club_member_permissions perm
  on perm.club_id = m.club_id
  and perm.profile_id = m.profile_id
where m.scope_mode = 'teams'
  and perm.team_id is not null
on conflict do nothing;


-- ============================================================
-- SEZIONE 6 — L'accesso non dipende più dall'organico
--
-- `dashboard_club_capabilities` e `society_structure_admin_ids` leggevano i
-- grant solo attraverso una riga `club_members` attiva. Un amministratore che
-- non è organico — il caso che §5 impone di supportare — ne resterebbe fuori.
--
-- Un solo predicato condiviso, perché le due funzioni non possano divergere:
-- l'accesso è attivo se la persona è nell'organico attivo **oppure** ha una
-- membership amministrativa attiva. Per tutti gli accessi esistenti il
-- risultato non cambia: il backfill ha appena creato la seconda condizione
-- esattamente dove valeva già la prima.
-- ============================================================

create or replace function public.club_access_is_active(
  p_club_id    uuid,
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_members cm
    where cm.club_id = p_club_id
      and cm.profile_id = p_profile_id
      and cm.status = 'active'
  ) or exists (
    select 1
    from public.club_admin_memberships m
    where m.club_id = p_club_id
      and m.profile_id = p_profile_id
      and m.status = 'active'
  );
$$;

revoke all on function public.club_access_is_active(uuid, uuid) from public;
grant execute on function public.club_access_is_active(uuid, uuid) to authenticated;

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
      'network_history_view',
      'admins_view',
      'admin_invites_view',
      'admins_invite',
      'admin_roles_view'
    ]::text[]
    else coalesce(
      (
        select array_agg(distinct perm.permission_key order by perm.permission_key)
        from public.club_member_permissions perm
        where perm.club_id = p_club_id
          and perm.profile_id = auth.uid()
          and public.club_access_is_active(p_club_id, auth.uid())
          /* Rete e Amministratori sono domini Society-level: un grant
             limitato a una squadra non li concede (DAS-REV-11 §5,
             DAS-REV-13 §23). */
          and (
            perm.team_id is null
            or (
              perm.permission_key not like 'network\_%'
              and perm.permission_key not like 'admin%'
            )
          )
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
            'network_history_view',
            'admins_view',
            'admin_invites_view',
            'admins_invite',
            'admin_roles_view'
          )
      ),
      array[]::text[]
    )
  end;
$$;

revoke all on function public.dashboard_club_capabilities(uuid) from public;
grant execute on function public.dashboard_club_capabilities(uuid) to authenticated;

create or replace function public.society_structure_admin_ids(p_club_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.owner_profile_id
  from public.clubs c
  where c.id = p_club_id
    and c.owner_profile_id is not null

  union

  /* §7.1: «Il conteggio rappresenta persone con accesso amministrativo
     attivo … deduplicate secondo il modello.» L'union lo garantisce: più
     ruoli o scope sovrapposti non moltiplicano la persona, e l'Owner che
     è anche membro resta uno. */
  select m.profile_id
  from public.club_admin_memberships m
  where m.club_id = p_club_id
    and m.status = 'active'

  union

  /* Accessi che vivono ancora solo sull'organico: nessuno dopo il backfill,
     ma la lettura non deve dipendere dall'essere stata eseguita. */
  select cm.profile_id
  from public.club_members cm
  where cm.club_id = p_club_id
    and cm.status = 'active'
    and cm.profile_id is not null
    and exists (
      select 1
      from public.club_member_permissions perm
      where perm.club_id = cm.club_id
        and perm.profile_id = cm.profile_id
    );
$$;

revoke all on function public.society_structure_admin_ids(uuid) from public;
grant execute on function public.society_structure_admin_ids(uuid) to authenticated;


-- ============================================================
-- SEZIONE 7 — Policy, email e stato di un invito
--
-- La durata è centrale e server-side (§18): «Nessun countdown permanente o
-- scadenza arbitraria calcolata soltanto dal client.» Chiave propria e non
-- `society_invite_ttl_days`: §2 tiene separati gli inviti amministrativi dai
-- collegamenti fra Società, e una Società potrebbe volerli diversi.
-- ============================================================

insert into public.app_policy_settings (key, value, description)
values (
  'admin_invite_ttl_days',
  to_jsonb(7),
  'DAS-REV-13 §18 — durata di un invito amministrativo. Default V1: 7 giorni.'
)
on conflict (key) do nothing;

create or replace function public.club_admin_invite_ttl()
returns interval
language sql
stable
security definer
set search_path = public
as $$
  select make_interval(days => coalesce(
    (select (value #>> '{}')::int from public.app_policy_settings
      where key = 'admin_invite_ttl_days'),
    7
  ));
$$;

revoke all on function public.club_admin_invite_ttl() from public;
grant execute on function public.club_admin_invite_ttl() to authenticated;

/**
 * Normalizzazione dell'indirizzo (§12).
 *
 * «Rimuovi spazi accidentali e applica la normalizzazione di dominio
 * prevista; non inventare equivalenze tra alias, punti o suffissi del
 * local-part.»
 *
 * Quindi: trim, lowercase del dominio, lowercase del local-part. Nient'altro.
 * Niente rimozione dei punti, niente taglio dopo il `+`: due indirizzi che
 * differiscono lì sono due indirizzi, e trattarli come uno solo manderebbe
 * un accesso amministrativo alla persona sbagliata.
 *
 * `auth.users.email` di Supabase è già minuscolo per intero: la chiave di
 * confronto prodotta qui coincide quindi con quella dell'account.
 */
create or replace function public.normalize_account_email(p_email text)
returns text
language sql
immutable
as $$
  select case
    when p_email is null then null
    when btrim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then null
    else lower(btrim(p_email))
  end;
$$;

comment on function public.normalize_account_email(text) is
  'DAS-REV-13 §12: chiave di confronto di un indirizzo email. Trim e '
  'lowercase; nessuna equivalenza inventata su punti, alias o suffissi. '
  'Restituisce null per una forma non valida.';

/**
 * Stato canonico di un invito amministrativo (§18).
 *
 * Una funzione sola, così UI, RPC, count e audit non derivano cinque verità
 * diverse. La scadenza è calcolata sull'orologio del server e **non** dipende
 * da un job di pulizia (§18): un invito scaduto è `expired` nell'istante in
 * cui lo si legge, anche se nessuno ha ancora riscritto la colonna `status`.
 */
create or replace function public.club_admin_invite_state(
  p_status      text,
  p_expires_at  timestamptz
)
returns text
language sql
stable
as $$
  select case
    when p_status in ('accepted', 'rejected', 'revoked') then p_status
    when p_expires_at is not null and p_expires_at <= timezone('utc', now()) then 'expired'
    else coalesce(p_status, 'pending')
  end;
$$;

comment on function public.club_admin_invite_state(text, timestamptz) is
  'DAS-REV-13 §18: stato effettivo di un invito. La scadenza è valutata '
  'sull''orologio server a ogni lettura, senza attendere un job di pulizia.';

/**
 * Autorizzazione amministrativa su una Società.
 *
 * Owner sempre. Per chiunque altro serve la chiave, e deve essere un grant
 * **Society-level** — `dashboard_club_capabilities` già esclude le chiavi
 * `admin*` concesse su una singola squadra (§23).
 */
create or replace function public.society_admin_allows(
  p_club_id uuid,
  p_key     text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_club_id is not null and (
    public.owns_club(p_club_id)
    or p_key = any (public.dashboard_club_capabilities(p_club_id))
  );
$$;

revoke all on function public.society_admin_allows(uuid, text) from public;
grant execute on function public.society_admin_allows(uuid, text) to authenticated;


-- ============================================================
-- SEZIONE 8 — Inviti amministrativi (§11, §12, §15, §20)
--
-- Un record per proposta. Conserva ciò che §20 elenca: Società, destinatario
-- (interno o email), ruolo con la **revisione** della sua configurazione,
-- scope, actor invitante, stato e tutti i timestamp, binding del destinatario
-- esterno, revisione per conflitti, riferimento al risultato amministrativo.
--
-- Il token segue il modello già hardenizzato del progetto (REV-PROF-14,
-- DAS-REV-11): 32 byte casuali, restituiti in chiaro una volta sola, in
-- tabella solo lo sha256. Un dump del database non contiene link utilizzabili.
--
-- `recipient_email_display` esiste accanto alla chiave normalizzata perché
-- §12 chiede di «conservare la forma utile alla visualizzazione separatamente
-- dalla chiave di confronto».
-- ============================================================

create table if not exists public.club_admin_invites (
  id                      uuid primary key default gen_random_uuid(),
  club_id                 uuid not null references public.clubs(id) on delete cascade,
  /* `member`: destinatario PERSON fissato dal server alla creazione (§15).
     `email`:  percorso esterno, destinatario ancora da associare. */
  recipient_kind          text not null check (recipient_kind in ('member', 'email')),
  recipient_profile_id    uuid references public.profiles(id) on delete cascade,
  recipient_email         text,
  recipient_email_display text,
  role_id                 uuid not null references public.club_admin_roles(id) on delete restrict,
  /* Revisione della configurazione del ruolo al momento della proposta. */
  role_config_version     integer not null,
  scope_mode              text not null check (scope_mode in ('society', 'teams')),
  /* §16, §19: incrementata da ogni modifica autorizzata della proposta. Un
     client con una revisione precedente deve ricaricare prima di accettare. */
  revision                integer not null default 1,
  status                  text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'revoked')),
  created_by              uuid references public.profiles(id) on delete set null,
  created_at              timestamptz not null default timezone('utc', now()),
  expires_at              timestamptz not null,
  accepted_at             timestamptz,
  rejected_at             timestamptz,
  revoked_at              timestamptz,
  revoked_by              uuid references public.profiles(id) on delete set null,
  /* §15: quando e come il destinatario esterno è stato associato. */
  bound_at                timestamptz,
  bound_method            text check (bound_method in ('internal', 'verified_email')),
  /* Riferimento al risultato amministrativo (§20). */
  membership_id           uuid references public.club_admin_memberships(id) on delete set null,
  updated_at              timestamptz not null default timezone('utc', now()),
  /* Un destinatario, non due: o la PERSON o l'email. */
  constraint club_admin_invites_recipient_shape check (
    (recipient_kind = 'member' and recipient_profile_id is not null)
    or (recipient_kind = 'email' and recipient_email is not null)
  )
);

alter table public.club_admin_memberships
  drop constraint if exists club_admin_memberships_invite_fkey;

alter table public.club_admin_memberships
  add constraint club_admin_memberships_invite_fkey
  foreign key (invite_id) references public.club_admin_invites(id) on delete set null;

/**
 * §19: «una sola proposta pending valida per lo stesso destinatario nella
 * stessa Society», garantita «nel backend, non da una ricerca preliminare
 * client».
 *
 * Due indici parziali, uno per percorso. Non comprendono la scadenza: un
 * invito scaduto resta `status = 'pending'` finché qualcuno non lo conclude,
 * e il vincolo deve impedire comunque una seconda riga con lo stesso
 * destinatario — la riconciliazione avviene nella RPC, che conclude il
 * vecchio prima di creare il nuovo.
 */
create unique index if not exists club_admin_invites_pending_member_idx
  on public.club_admin_invites (club_id, recipient_profile_id)
  where status = 'pending' and recipient_profile_id is not null;

create unique index if not exists club_admin_invites_pending_email_idx
  on public.club_admin_invites (club_id, recipient_email)
  where status = 'pending' and recipient_kind = 'email' and recipient_email is not null;

create index if not exists club_admin_invites_club_idx
  on public.club_admin_invites (club_id, created_at desc);

create index if not exists club_admin_invites_recipient_idx
  on public.club_admin_invites (recipient_profile_id, status);

/**
 * Handle del link (§19, §20).
 *
 * «Se occorre emettere un nuovo handle, questo resta legato allo stesso
 * invite_id e alla stessa scadenza; i link già validi non devono rompersi per
 * una normale ricondivisione.»
 *
 * Per questo gli handle sono una tabella e non una colonna: il token in
 * chiaro non è recuperabile — in tabella c'è solo lo sha256 — quindi
 * ricondividere richiede di emetterne uno nuovo, e con una colonna unica il
 * link già mandato su WhatsApp smetterebbe di funzionare.
 *
 * Nessuno di questi handle è una credenziale di amministratore (§20): è un
 * riferimento al contesto dell'invito. Scadenza, stato e destinatario li
 * decide sempre l'invito, mai l'handle.
 */
create table if not exists public.club_admin_invite_handles (
  id         uuid primary key default gen_random_uuid(),
  invite_id  uuid not null references public.club_admin_invites(id) on delete cascade,
  /* sha256 esadecimale del token. Il token in chiaro non viene mai scritto. */
  token_hash text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz
);

create index if not exists club_admin_invite_handles_invite_idx
  on public.club_admin_invite_handles (invite_id, created_at desc);

alter table public.club_admin_invite_handles enable row level security;
-- Nessuna policy: gli handle si leggono solo dalle funzioni definer. Un
-- client che potesse elencarli otterrebbe gli hash di tutti i link emessi.

create table if not exists public.club_admin_invite_teams (
  invite_id uuid not null references public.club_admin_invites(id) on delete cascade,
  team_id   uuid not null references public.club_teams(id) on delete cascade,
  primary key (invite_id, team_id)
);

create or replace function public.club_admin_invite_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.club_admin_invite_touch() from public;

drop trigger if exists club_admin_invites_touch on public.club_admin_invites;
create trigger club_admin_invites_touch
  before insert or update on public.club_admin_invites
  for each row execute function public.club_admin_invite_touch();

alter table public.club_admin_invites enable row level security;
alter table public.club_admin_invite_teams enable row level security;

-- Il destinatario non legge mai questa tabella direttamente: ci arriva
-- attraverso le RPC, che gli restituiscono il contesto del **proprio**
-- consenso (§6: «Un deep link al proprio invito richiede l'autorizzazione
-- specifica del destinatario»; §23 separa i due guard).
drop policy if exists "society readers read admin invites" on public.club_admin_invites;
create policy "society readers read admin invites"
  on public.club_admin_invites for select to authenticated
  using (public.society_admin_allows(club_id, 'admin_invites_view'));


-- ============================================================
-- SEZIONE 9 — Audit (§32)
--
-- «L'audit amministrativo protetto è distinto dalle analytics prodotto. Deve
-- poter ricostruire actor, Society, destinatario/riferimento, invito,
-- versione di ruolo/scope, azione, esito e tempi.»
--
-- `details` non contiene email in chiaro né token: §27 vieta di stamparli
-- anche nei log tecnici.
-- ============================================================

create table if not exists public.club_admin_audit (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  actor_id      uuid references public.profiles(id) on delete set null,
  invite_id     uuid references public.club_admin_invites(id) on delete set null,
  membership_id uuid references public.club_admin_memberships(id) on delete set null,
  subject_id    uuid references public.profiles(id) on delete set null,
  operation     text not null check (operation in (
    'invite_created',
    'invite_reshared',
    'invite_revoked',
    'invite_superseded',
    'invite_bound',
    'invite_accepted',
    'invite_rejected',
    'invite_expired',
    'membership_activated'
  )),
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default timezone('utc', now())
);

create index if not exists club_admin_audit_club_idx
  on public.club_admin_audit (club_id, created_at desc);

create index if not exists club_admin_audit_invite_idx
  on public.club_admin_audit (invite_id, created_at desc);

alter table public.club_admin_audit enable row level security;

drop policy if exists "club owners read admin audit" on public.club_admin_audit;
create policy "club owners read admin audit"
  on public.club_admin_audit for select to authenticated
  using (public.owns_club(club_id));


-- ============================================================
-- SEZIONE 10 — Presentazione condivisa
--
-- Etichette di ambito e ruolo in un posto solo: §7.1 chiede «ambito
-- sintetico» nelle righe, §9 lo stesso riepilogo nel composer e §16 lo stesso
-- dato in sola lettura sulla ricezione. Tre schermate, una funzione.
--
-- §10: «Il riepilogo può mostrare un nome per un Team, pochi nomi se
-- leggibili, oppure "3 squadre" con accesso alla selezione.»
-- ============================================================

create or replace function public.club_admin_scope_label(
  p_scope_mode text,
  p_team_ids   uuid[]
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_names text[];
begin
  if p_scope_mode = 'society' then
    return 'Intera società';
  end if;

  select array_agg(ct.name order by ct.sort_order, ct.name)
  into v_names
  from public.club_teams ct
  where ct.id = any (coalesce(p_team_ids, array[]::uuid[]));

  if v_names is null or array_length(v_names, 1) is null then
    return null;
  end if;

  if array_length(v_names, 1) <= 2 then
    return array_to_string(v_names, ' · ');
  end if;

  return array_length(v_names, 1)::text || ' squadre';
end;
$$;

revoke all on function public.club_admin_scope_label(text, uuid[]) from public;
grant execute on function public.club_admin_scope_label(text, uuid[]) to authenticated;


-- ============================================================
-- SEZIONE 11 — Composizione del Centro (§7, §21)
--
-- «La possibilità di leggere gli attivi, leggere gli inviti, invitare e
-- aprire Ruoli e permessi può essere distinta. Filtra i dati sul server e
-- mostra soltanto sezioni/azioni autorizzate. Non sostituire dati non
-- leggibili con zero.»
--
-- Da cui: i conteggi sono `null` — non 0 — quando la sezione non è leggibile,
-- e la funzione solleva `ADMIN_CENTER_NOT_AUTHORIZED` quando **nessuna** parte
-- è accessibile (§25: «Se nessuna parte del centro è accessibile, torna al
-- contesto autorizzato con feedback»). Una pagina vuota direbbe «questa
-- Società non ha amministratori».
-- ============================================================

create or replace function public.fetch_society_admin_center(p_club_id uuid)
returns table (
  club_id                uuid,
  club_name              text,
  club_logo_url          text,
  club_is_verified       boolean,
  scope_label            text,
  can_view_admins        boolean,
  can_view_invites       boolean,
  can_invite             boolean,
  can_open_roles         boolean,
  admins_count           integer,
  invites_pending_count  integer,
  access_verified_at     timestamptz,
  data_revision          bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_admins  boolean;
  v_invites boolean;
  v_invite  boolean;
  v_roles   boolean;
  v_now     timestamptz := timezone('utc', now());
begin
  if v_uid is null then
    raise exception 'ADMIN_CENTER_NOT_AUTHORIZED';
  end if;

  if not exists (select 1 from public.clubs c where c.id = p_club_id) then
    raise exception 'ADMIN_CENTER_NOT_AUTHORIZED';
  end if;

  v_admins  := public.society_admin_allows(p_club_id, 'admins_view');
  v_invites := public.society_admin_allows(p_club_id, 'admin_invites_view');
  v_invite  := public.society_admin_allows(p_club_id, 'admins_invite');
  /* §7: la riga Ruoli e permessi «compare soltanto quando accessibile e
     disponibile». Oggi la destinazione reale `/club-admin/permissions` è
     gated sul ruolo `club_admin`, cioè sull'Owner: dichiararla accessibile a
     un delegato produrrebbe il «chevron morto» che §7 vieta. DAS-REV-14
     separerà la chiave dalla destinazione. */
  v_roles   := public.owns_club(p_club_id)
               and public.society_admin_allows(p_club_id, 'admin_roles_view');

  if not (v_admins or v_invites or v_invite or v_roles) then
    raise exception 'ADMIN_CENTER_NOT_AUTHORIZED';
  end if;

  return query
  select
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    public.dashboard_club_scope_label(p_club_id),
    v_admins,
    v_invites,
    v_invite,
    v_roles,
    case when v_admins then (
      select count(*)::integer from public.society_structure_admin_ids(p_club_id)
    ) end,
    case when v_invites then (
      /* §7.2: soltanto i pending **ancora validi** per destinatario, Society
         e tempo server. «Uno stato scaduto resta escluso anche se il job di
         pulizia non ha aggiornato la proiezione.» */
      select count(*)::integer
      from public.club_admin_invites inv
      where inv.club_id = p_club_id
        and public.club_admin_invite_state(inv.status, inv.expires_at) = 'pending'
    ) end,
    v_now,
    greatest(
      (select coalesce(extract(epoch from max(m.updated_at))::bigint, 0)
       from public.club_admin_memberships m where m.club_id = p_club_id),
      (select coalesce(extract(epoch from max(inv.updated_at))::bigint, 0)
       from public.club_admin_invites inv where inv.club_id = p_club_id),
      (extract(epoch from c.updated_at)::bigint)
    )
  from public.clubs c
  where c.id = p_club_id;
end;
$$;

revoke all on function public.fetch_society_admin_center(uuid) from public;
grant execute on function public.fetch_society_admin_center(uuid) to authenticated;


-- ============================================================
-- SEZIONE 12 — Amministratori attivi (§7.1)
--
-- Ordine V1: «Owner, se leggibile, poi nome con ordinamento locale stabile e
-- identificativo come spareggio.»
--
-- `total_count` è il totale **server**, non la lunghezza della pagina: §7.1
-- vieta di «calcolare il totale contando una pagina parziale restituita al
-- client».
-- ============================================================

create or replace function public.fetch_society_admins_page(
  p_club_id uuid,
  p_limit   int default 20,
  p_offset  int default 0
)
returns table (
  profile_id   uuid,
  full_name    text,
  avatar_url   text,
  is_owner     boolean,
  role_label   text,
  scope_label  text,
  total_count  bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit  int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_owner  uuid;
begin
  if not public.society_admin_allows(p_club_id, 'admins_view') then
    raise exception 'ADMIN_CENTER_NOT_AUTHORIZED';
  end if;

  select c.owner_profile_id into v_owner from public.clubs c where c.id = p_club_id;

  return query
  with people as (
    select ids.profile_id as pid
    from public.society_structure_admin_ids(p_club_id) as ids(profile_id)
  ),
  admin_rows as (
    select
      p.id                                   as profile_id,
      p.full_name                            as full_name,
      p.avatar_url                           as avatar_url,
      (p.id = v_owner)                       as is_owner,
      case
        when p.id = v_owner then 'Owner'
        when role.name is not null then role.name
        /* §30 vieta null, id tecnici o "Untitled". Un accesso concesso prima
           del catalogo ruoli non ha un nome scelto dalla Società: lo si dice,
           invece di inventarne uno. */
        else 'Accesso personalizzato'
      end                                    as role_label,
      case
        when p.id = v_owner then 'Accesso completo'
        when m.id is null then null
        else public.club_admin_scope_label(
          m.scope_mode,
          (select array_agg(t.team_id) from public.club_admin_membership_teams t
            where t.membership_id = m.id)
        )
      end                                    as scope_label
    from people
    join public.profiles p on p.id = people.pid
    left join public.club_admin_memberships m
      on m.club_id = p_club_id and m.profile_id = p.id and m.status = 'active'
    left join public.club_admin_roles role on role.id = m.role_id
  )
  select
    admin_rows.profile_id,
    admin_rows.full_name,
    admin_rows.avatar_url,
    admin_rows.is_owner,
    admin_rows.role_label,
    admin_rows.scope_label,
    (select count(*) from admin_rows) as total_count
  from admin_rows
  order by admin_rows.is_owner desc, lower(admin_rows.full_name), admin_rows.profile_id
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.fetch_society_admins_page(uuid, int, int) from public;
grant execute on function public.fetch_society_admins_page(uuid, int, int) to authenticated;


-- ============================================================
-- SEZIONE 13 — Inviti in attesa (§7.2)
--
-- «Mostra destinatario, ruolo e ambito; ordine per creazione più recente, con
-- spareggio stabile. Un destinatario risolto usa la PERSON canonica quando la
-- visualizzazione è autorizzata; un destinatario non risolto mostra l'email,
-- senza account o avatar inventati.»
--
-- `channel` distingue il feedback del canale dallo stato dell'invito (§7.2):
-- `member` → "Invito inviato", `email` → "Link pronto". Aprire o chiudere il
-- native share non dimostra una consegna, quindi il canale non cambia mai
-- il lifecycle.
-- ============================================================

create or replace function public.fetch_society_admin_invites_page(
  p_club_id uuid,
  p_limit   int default 20,
  p_offset  int default 0
)
returns table (
  invite_id       uuid,
  recipient_kind  text,
  profile_id      uuid,
  full_name       text,
  avatar_url      text,
  email_display   text,
  role_label      text,
  scope_label     text,
  revision        integer,
  expires_at      timestamptz,
  created_at      timestamptz,
  total_count     bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit  int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.society_admin_allows(p_club_id, 'admin_invites_view') then
    raise exception 'ADMIN_CENTER_NOT_AUTHORIZED';
  end if;

  return query
  with valid as (
    select inv.*
    from public.club_admin_invites inv
    where inv.club_id = p_club_id
      and public.club_admin_invite_state(inv.status, inv.expires_at) = 'pending'
  )
  select
    valid.id,
    valid.recipient_kind,
    valid.recipient_profile_id,
    p.full_name,
    p.avatar_url,
    valid.recipient_email_display,
    role.name,
    public.club_admin_scope_label(
      valid.scope_mode,
      (select array_agg(t.team_id) from public.club_admin_invite_teams t
        where t.invite_id = valid.id)
    ),
    valid.revision,
    valid.expires_at,
    valid.created_at,
    (select count(*) from valid) as total_count
  from valid
  left join public.profiles p on p.id = valid.recipient_profile_id
  join public.club_admin_roles role on role.id = valid.role_id
  order by valid.created_at desc, valid.id
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.fetch_society_admin_invites_page(uuid, int, int) from public;
grant execute on function public.fetch_society_admin_invites_page(uuid, int, int) to authenticated;


-- ============================================================
-- SEZIONE 14 — Ricerca dei destinatari (§8)
--
-- «Riutilizza la ricerca canonica delle PERSON, rispettando visibility e
-- blocking del dominio. Escludi Society, Team e pagine MEDIA; non escludere
-- una PERSON perché possiede anche un progetto editoriale.»
--
-- In questo modello `profiles` **è** l'insieme delle PERSON: le Società
-- vivono in `clubs`, le squadre in `club_teams`, e `role = 'media'` descrive
-- una persona che cura un progetto editoriale, non una pagina. Quindi non si
-- filtra per ruolo: filtrarlo escluderebbe esattamente le persone che §8
-- impone di non escludere.
--
-- Il ruolo esce grezzo (`app_role`): l'etichetta italiana la produce
-- `formatRole` lato client, che è già l'unica fonte di quelle stringhe.
--
-- `admin_status` è «lo stato amministrativo minimo necessario relativo alla
-- Society richiesta, solo a un actor autorizzato»: nessun nome di ruolo
-- altrui, nessuna email, nessun dato privato.
-- ============================================================

create or replace function public.search_society_admin_candidates(
  p_club_id uuid,
  p_query   text default null,
  p_limit   int default 20,
  p_offset  int default 0
)
returns table (
  profile_id   uuid,
  full_name    text,
  avatar_url   text,
  role         public.app_role,
  admin_role   text,
  admin_status text,
  total_count  bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_term   text := btrim(coalesce(p_query, ''));
  v_limit  int  := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset int  := greatest(coalesce(p_offset, 0), 0);
  v_owner  uuid;
begin
  /* §8: lo stato amministrativo è dato «solo a un actor autorizzato». Senza
     il permesso di invitare non c'è motivo di eseguire questa ricerca. */
  if not public.society_admin_allows(p_club_id, 'admins_invite') then
    raise exception 'ADMIN_CENTER_NOT_AUTHORIZED';
  end if;

  if v_term = '' then
    return;
  end if;

  select c.owner_profile_id into v_owner from public.clubs c where c.id = p_club_id;

  return query
  with matches as (
    select p.id, p.full_name, p.avatar_url, p.role
    from public.profiles p
    where p.full_name ilike '%' || v_term || '%'
      and not exists (
        select 1
        from public.user_blocks b
        where (b.blocker_profile_id = v_uid and b.blocked_profile_id = p.id)
           or (b.blocker_profile_id = p.id and b.blocked_profile_id = v_uid)
      )
  ),
  decorated as (
    select
      matches.id          as profile_id,
      matches.full_name   as full_name,
      matches.avatar_url  as avatar_url,
      matches.role        as role,
      role_def.name       as admin_role,
      case
        when matches.id = v_owner then 'already_admin'
        when m.id is not null then 'already_admin'
        when pending_invite.id is not null then 'already_invited'
        else 'eligible'
      end                 as admin_status
    from matches
    left join public.club_admin_memberships m
      on m.club_id = p_club_id and m.profile_id = matches.id and m.status = 'active'
    left join public.club_admin_roles role_def on role_def.id = m.role_id
    left join lateral (
      select inv.id
      from public.club_admin_invites inv
      where inv.club_id = p_club_id
        and inv.recipient_profile_id = matches.id
        and public.club_admin_invite_state(inv.status, inv.expires_at) = 'pending'
      limit 1
    ) pending_invite on true
  )
  select
    decorated.profile_id,
    decorated.full_name,
    decorated.avatar_url,
    decorated.role,
    decorated.admin_role,
    decorated.admin_status,
    (select count(*) from decorated) as total_count
  from decorated
  order by
    case decorated.admin_status when 'eligible' then 0 else 1 end,
    lower(decorated.full_name),
    decorated.profile_id
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.search_society_admin_candidates(uuid, text, int, int) from public;
grant execute on function public.search_society_admin_candidates(uuid, text, int, int) to authenticated;


-- ============================================================
-- SEZIONE 15 — Ruoli e squadre proponibili (§9, §10)
--
-- «Mostra solo quelli attivi e assegnabili dall'actor secondo il backend …
-- esclude Owner e prerogative non assegnabili.»
--
-- Non esiste un ruolo Owner nel catalogo: non c'è nulla da escludere qui,
-- perché non c'è nulla da referenziare. §18 lo chiede proprio così —
-- «L'Owner non è assegnabile con nessun normale invito, neppure chiamando
-- direttamente l'API».
--
-- «Leggere un ruolo non significa poterlo assegnare»: un actor non-Owner può
-- proporre solo ruoli il cui contenuto autorizzativo **possiede già**. È la
-- regola che impedisce a un delegato di creare un amministratore più potente
-- di sé.
-- ============================================================

create or replace function public.fetch_society_assignable_roles(p_club_id uuid)
returns table (
  role_id        uuid,
  name           text,
  config_version integer,
  permissions    text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner boolean;
  v_caps  text[];
begin
  if not public.society_admin_allows(p_club_id, 'admins_invite') then
    raise exception 'ADMIN_CENTER_NOT_AUTHORIZED';
  end if;

  v_owner := public.owns_club(p_club_id);
  v_caps  := public.dashboard_club_capabilities(p_club_id);

  return query
  select
    role.id,
    role.name,
    role.config_version,
    coalesce(
      (select array_agg(rp.permission_key order by rp.permission_key)
       from public.club_admin_role_permissions rp where rp.role_id = role.id),
      array[]::text[]
    )
  from public.club_admin_roles role
  where role.club_id = p_club_id
    and role.is_active
    and (
      v_owner
      or not exists (
        select 1
        from public.club_admin_role_permissions rp
        where rp.role_id = role.id
          and not (rp.permission_key = any (v_caps))
      )
    )
  order by lower(role.name), role.id;
end;
$$;

revoke all on function public.fetch_society_assignable_roles(uuid) from public;
grant execute on function public.fetch_society_assignable_roles(uuid) to authenticated;

/**
 * Squadre selezionabili come ambito (§10).
 *
 * Solo Team **interni** alla Società: «Affiliate e Team di altre Society non
 * sono selezionabili.» E solo quelli dentro il perimetro dell'actor: chi
 * amministra la Primavera non può proporre un accesso all'Under 18.
 */
create or replace function public.fetch_society_assignable_teams(p_club_id uuid)
returns table (
  team_id   uuid,
  name      text,
  category  text,
  team_type text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope uuid[];
begin
  if not public.society_admin_allows(p_club_id, 'admins_invite') then
    raise exception 'ADMIN_CENTER_NOT_AUTHORIZED';
  end if;

  /* `null` = nessuna restrizione (Owner o grant Society-wide). Un actor con
     la chiave `admins_invite` la possiede per forza Society-level — il
     filtro di `dashboard_club_capabilities` lo garantisce — ma il perimetro
     delle **squadre** può comunque essere ristretto da `teams_view`. */
  v_scope := public.dashboard_club_capability_scope(p_club_id, 'teams_view');

  return query
  select ct.id, ct.name, ct.category, ct.team_type
  from public.club_teams ct
  where ct.club_id = p_club_id
    and coalesce(ct.is_archived, false) = false
    and (public.owns_club(p_club_id) or v_scope is null or ct.id = any (v_scope))
  order by
    case ct.team_type when 'senior' then 0 else 1 end,
    ct.sort_order,
    lower(ct.name);
end;
$$;

revoke all on function public.fetch_society_assignable_teams(uuid) from public;
grant execute on function public.fetch_society_assignable_teams(uuid) to authenticated;


-- ============================================================
-- SEZIONE 16 — Risoluzione di un'email verso un account (§15)
--
-- «Se il servizio account può risolverla con certezza verso un account
-- attraverso un indirizzo verificato, associa internamente quel destinatario
-- senza rivelarne informazioni private al mittente.»
--
-- La verifica è quella del provider di autenticazione del prodotto
-- (`auth.users.email_confirmed_at`): §15 vieta di «creare un sistema OTP
-- parallelo» e di «dichiarare verificato un indirizzo soltanto perché
-- digitato».
--
-- Nessun `grant`: la funzione non è raggiungibile dal client. §15 vieta di
-- usare il percorso esterno «come endpoint di enumerazione delle email
-- registrate», e il modo di garantirlo è che solo le RPC di questo file
-- possano interrogarla.
-- ============================================================

create or replace function public.account_profile_for_verified_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.email_confirmed_at is not null
    and public.normalize_account_email(u.email) = public.normalize_account_email(p_email)
  limit 1;
$$;

revoke all on function public.account_profile_for_verified_email(text) from public;

comment on function public.account_profile_for_verified_email(text) is
  'DAS-REV-13 §15: account con indirizzo verificato corrispondente. Non '
  'esposta al client: il percorso esterno non deve poter enumerare le email '
  'registrate.';


-- ============================================================
-- SEZIONE 17 — Creazione di un invito (§11, §12, §19)
--
-- Una sola funzione per i due percorsi. §16 chiede che «gli stessi componenti
-- rendano un invito interno e uno arrivato tramite link esterno», e la
-- simmetria comincia qui: stesso lifecycle, stessi controlli, stesso record.
--
-- Il client manda **riferimenti e versione**; l'autorizzazione la ricalcola
-- il backend (§11: «Non accettare capability arbitrarie nel payload per
-- concedere accesso»). Nel payload non esiste nessuna lista di permessi.
--
-- Idempotenza (§19): la chiave è vincolata ad actor, Società, operazione e
-- fingerprint del payload. La stessa chiave con un payload diverso produce
-- `OPERATION_CONTENT_CHANGED`, non un secondo invito.
-- ============================================================

create or replace function public.create_society_admin_invite(
  p_club_id         uuid,
  p_role_id         uuid,
  p_scope_mode      text,
  p_profile_id      uuid default null,
  p_email           text default null,
  p_team_ids        uuid[] default null,
  p_idempotency_key text default null
)
returns table (
  invite_id      uuid,
  recipient_kind text,
  revision       integer,
  expires_at     timestamptz,
  token          text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_owner       uuid;
  v_role        public.club_admin_roles%rowtype;
  v_caps        text[];
  v_is_owner    boolean;
  v_scope       text := lower(coalesce(p_scope_mode, ''));
  v_teams       uuid[] := coalesce(p_team_ids, array[]::uuid[]);
  v_email_key   text;
  v_email_show  text;
  v_recipient   uuid := p_profile_id;
  v_kind        text;
  v_token       text;
  v_invite      public.club_admin_invites%rowtype;
  v_replay      jsonb;
  v_fingerprint text;
  v_team_scope  uuid[];
begin
  if v_uid is null then
    raise exception 'ADMIN_CENTER_NOT_AUTHORIZED';
  end if;

  if not public.society_admin_allows(p_club_id, 'admins_invite') then
    raise exception 'ADMIN_INVITE_NOT_AUTHORIZED';
  end if;

  if v_scope not in ('society', 'teams') then
    raise exception 'ADMIN_INVITE_SCOPE_INVALID';
  end if;

  /* Un destinatario e uno solo. Due significherebbero due proposte. */
  if (p_profile_id is null) = (btrim(coalesce(p_email, '')) = '') then
    raise exception 'ADMIN_INVITE_RECIPIENT_INVALID';
  end if;

  v_fingerprint := md5(
    coalesce(p_role_id::text, '') || '|' || v_scope || '|' ||
    coalesce(array_to_string((select array_agg(t order by t) from unnest(v_teams) t), ','), '') || '|' ||
    coalesce(p_profile_id::text, '') || '|' ||
    coalesce(public.normalize_account_email(p_email), '')
  );

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, p_club_id, 'admin_invite_create', v_fingerprint
  );

  if v_replay is not null then
    /* §11: «Se la risposta si perde dopo il commit, non dichiarare un
       fallimento certo e non creare un secondo invito.» Il retry con la
       stessa chiave rilegge l'esito, token compreso: il link già condiviso
       resta quello. */
    return query
    select
      (v_replay->>'invite_id')::uuid,
      v_replay->>'recipient_kind',
      (v_replay->>'revision')::integer,
      (v_replay->>'expires_at')::timestamptz,
      v_replay->>'token';
    return;
  end if;

  select c.owner_profile_id into v_owner from public.clubs c where c.id = p_club_id;
  v_is_owner := public.owns_club(p_club_id);
  v_caps     := public.dashboard_club_capabilities(p_club_id);

  -- ── Ruolo ───────────────────────────────────────────────────────────────
  select * into v_role
  from public.club_admin_roles
  where id = p_role_id and club_id = p_club_id;

  /* §21: «Non aggiornare una riga di un'altra Society perché ha lo stesso
     nome.» Un `role_id` di un'altra organizzazione non esiste per questa. */
  if not found or not v_role.is_active then
    raise exception 'ADMIN_INVITE_ROLE_UNAVAILABLE';
  end if;

  if not v_is_owner and exists (
    select 1 from public.club_admin_role_permissions rp
    where rp.role_id = v_role.id and not (rp.permission_key = any (v_caps))
  ) then
    /* §9: «Leggere un ruolo non significa poterlo assegnare.» */
    raise exception 'ADMIN_INVITE_ROLE_UNAVAILABLE';
  end if;

  -- ── Ambito ──────────────────────────────────────────────────────────────
  if v_scope = 'teams' then
    if array_length(v_teams, 1) is null then
      raise exception 'ADMIN_INVITE_SCOPE_INVALID';
    end if;

    v_team_scope := public.dashboard_club_capability_scope(p_club_id, 'teams_view');

    if exists (
      select 1
      from unnest(v_teams) as requested(team_id)
      where not exists (
        select 1 from public.club_teams ct
        where ct.id = requested.team_id
          and ct.club_id = p_club_id
          and coalesce(ct.is_archived, false) = false
          and (v_is_owner or v_team_scope is null or ct.id = any (v_team_scope))
      )
    ) then
      /* §10: «Affiliate e Team di altre Society non sono selezionabili» e
         «Rivalida appartenenza, stato del Team e assegnabilità sul server
         all'invio». Nessun silenzioso scarto dell'elemento non valido. */
      raise exception 'ADMIN_INVITE_TEAM_UNAVAILABLE';
    end if;
  else
    v_teams := array[]::uuid[];
  end if;

  -- ── Destinatario ────────────────────────────────────────────────────────
  if p_profile_id is not null then
    v_kind := 'member';
  else
    v_email_key  := public.normalize_account_email(p_email);
    v_email_show := btrim(p_email);

    if v_email_key is null then
      raise exception 'ADMIN_INVITE_EMAIL_INVALID';
    end if;

    v_kind := 'email';

    /* §19: «Deduplica i percorsi interno ed esterno quando il destinatario è
       risolto in modo autorevole. Una email verificata riferita a una PERSON
       non deve consentire un secondo accesso aggirando l'invito interno.»
       La risoluzione resta privata: al mittente non si dice nulla. */
    v_recipient := public.account_profile_for_verified_email(v_email_key);
  end if;

  if v_recipient is not null then
    if v_recipient = v_owner then
      raise exception 'ADMIN_INVITE_ALREADY_ADMIN';
    end if;

    if exists (
      select 1 from public.club_admin_memberships m
      where m.club_id = p_club_id and m.profile_id = v_recipient and m.status = 'active'
    ) then
      raise exception 'ADMIN_INVITE_ALREADY_ADMIN';
    end if;

    if exists (
      select 1 from public.club_admin_invites inv
      where inv.club_id = p_club_id
        and inv.recipient_profile_id = v_recipient
        and public.club_admin_invite_state(inv.status, inv.expires_at) = 'pending'
    ) then
      /* §19: «Pending equivalente → riusa/esponi l'invito autorizzato
         esistente; non creare un duplicato.» Il chiamante riceve il conflitto
         e apre la proposta già esistente: sovrascriverla qui cambierebbe
         ruolo o scope senza che nessuno l'abbia deciso. */
      raise exception 'ADMIN_INVITE_ALREADY_PENDING';
    end if;
  end if;

  if v_kind = 'email' and exists (
    select 1 from public.club_admin_invites inv
    where inv.club_id = p_club_id
      and inv.recipient_email = v_email_key
      and public.club_admin_invite_state(inv.status, inv.expires_at) = 'pending'
  ) then
    raise exception 'ADMIN_INVITE_ALREADY_PENDING';
  end if;

  /* Anti-abuso: la stessa policy del resto del progetto (§27). */
  perform public.assert_agent_rate_limit(
    'admin_invite_create', p_club_id::text, 30, interval '1 hour'
  );

  -- ── Creazione ───────────────────────────────────────────────────────────
  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.club_admin_invites (
    club_id, recipient_kind, recipient_profile_id,
    recipient_email, recipient_email_display,
    role_id, role_config_version, scope_mode,
    created_by, expires_at,
    bound_at, bound_method
  )
  values (
    p_club_id, v_kind, v_recipient,
    case when v_kind = 'email' then v_email_key end,
    case when v_kind = 'email' then v_email_show end,
    v_role.id, v_role.config_version, v_scope,
    v_uid,
    timezone('utc', now()) + public.club_admin_invite_ttl(),
    case when v_kind = 'member' then timezone('utc', now()) end,
    case when v_kind = 'member' then 'internal' end
  )
  returning * into v_invite;

  /* Un handle anche per l'invito interno: §14 prevede che lo stesso invito
     sia raggiungibile da un link quando serve, e il destinatario interno
     resta comunque vincolato al proprio `recipient_profile_id`. */
  insert into public.club_admin_invite_handles (invite_id, token_hash, created_by)
  values (v_invite.id, encode(digest(v_token, 'sha256'), 'hex'), v_uid);

  if array_length(v_teams, 1) is not null then
    insert into public.club_admin_invite_teams (invite_id, team_id)
    select v_invite.id, t from unnest(v_teams) t
    on conflict do nothing;
  end if;

  insert into public.club_admin_audit
    (club_id, actor_id, invite_id, subject_id, operation, details)
  values (
    p_club_id, v_uid, v_invite.id, v_recipient, 'invite_created',
    jsonb_build_object(
      'recipient_kind', v_kind,
      'role_id', v_role.id,
      'role_config_version', v_role.config_version,
      'scope_mode', v_scope,
      'team_count', coalesce(array_length(v_teams, 1), 0)
    )
  );

  /* §22: notifica strutturale soltanto a un destinatario **registrato**, e
     dallo stesso sistema campanella di tutto il prodotto. Nessuna chat,
     nessun badge Messaggi, nessuna seconda inbox. */
  if v_recipient is not null then
    insert into public.notifications (recipient_profile_id, type, title, body, data)
    select
      v_recipient,
      'club_admin_invite',
      c.name || ' ti ha invitato ad amministrare la società.',
      null,
      jsonb_build_object('invite_id', v_invite.id, 'club_id', p_club_id)
    from public.clubs c
    where c.id = p_club_id;
  end if;

  perform public.club_relationship_operation_record(
    p_idempotency_key, p_club_id, 'admin_invite_create', v_fingerprint,
    jsonb_build_object(
      'invite_id', v_invite.id,
      'recipient_kind', v_kind,
      'revision', v_invite.revision,
      'expires_at', v_invite.expires_at,
      'token', case when v_kind = 'email' then v_token end
    )
  );

  return query
  select
    v_invite.id,
    v_kind,
    v_invite.revision,
    v_invite.expires_at,
    /* Il token in chiaro esiste solo qui e solo per il percorso esterno:
       l'invito interno non ha un link da condividere. */
    case when v_kind = 'email' then v_token end;
end;
$$;

revoke all on function public.create_society_admin_invite(uuid, uuid, text, uuid, text, uuid[], text) from public;
grant execute on function public.create_society_admin_invite(uuid, uuid, text, uuid, text, uuid[], text) to authenticated;


-- ============================================================
-- SEZIONE 18 — Ricondivisione (§12, §19)
--
-- «L'invito esterno pending deve poter essere riaperto dal centro per
-- ricondividere il link autorizzato, riutilizzando questo flusso. Ciò non
-- introduce un editor avanzato degli inviti o delle membership.»
--
-- Quindi: destinatario, ruolo e ambito escono in **sola lettura**, la
-- scadenza non si muove e la revisione non cambia. §19: «Stesso invite_id,
-- stessa proposta e stessa scadenza.»
-- ============================================================

create or replace function public.reshare_society_admin_invite(
  p_club_id   uuid,
  p_invite_id uuid
)
returns table (
  invite_id     uuid,
  email_display text,
  role_label    text,
  scope_label   text,
  expires_at    timestamptz,
  token         text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_invite public.club_admin_invites%rowtype;
  v_token  text;
begin
  if not public.society_admin_allows(p_club_id, 'admins_invite') then
    raise exception 'ADMIN_INVITE_NOT_AUTHORIZED';
  end if;

  select * into v_invite
  from public.club_admin_invites
  where id = p_invite_id and club_id = p_club_id;

  if not found then
    raise exception 'ADMIN_INVITE_UNAVAILABLE';
  end if;

  if public.club_admin_invite_state(v_invite.status, v_invite.expires_at) <> 'pending' then
    raise exception 'ADMIN_INVITE_UNAVAILABLE';
  end if;

  perform public.assert_agent_rate_limit(
    'admin_invite_reshare', p_invite_id::text, 20, interval '1 hour'
  );

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.club_admin_invite_handles (invite_id, token_hash, created_by)
  values (v_invite.id, encode(digest(v_token, 'sha256'), 'hex'), v_uid);

  insert into public.club_admin_audit
    (club_id, actor_id, invite_id, subject_id, operation, details)
  values (
    p_club_id, v_uid, v_invite.id, v_invite.recipient_profile_id,
    'invite_reshared', '{}'::jsonb
  );

  return query
  select
    v_invite.id,
    v_invite.recipient_email_display,
    role.name,
    public.club_admin_scope_label(
      v_invite.scope_mode,
      (select array_agg(t.team_id) from public.club_admin_invite_teams t
        where t.invite_id = v_invite.id)
    ),
    v_invite.expires_at,
    v_token
  from public.club_admin_roles role
  where role.id = v_invite.role_id;
end;
$$;

revoke all on function public.reshare_society_admin_invite(uuid, uuid) from public;
grant execute on function public.reshare_society_admin_invite(uuid, uuid) to authenticated;


-- ============================================================
-- SEZIONE 19 — Landing pubblica (§13)
--
-- «La pagina mostra soltanto il contesto minimo esplicitamente condiviso:
-- Society, ruolo e ambito leggibili. Non espone email del destinatario,
-- invitante tecnico, lista amministratori, matrice permessi, ID interni o
-- token in testo.»
--
-- È l'unica funzione di questo file eseguibile da `anon`: la landing deve
-- aprirsi senza sessione. Non restituisce l'`invite_id` — §13 vieta gli ID
-- interni e §27 vieta che un GET conceda qualcosa: il proseguimento passa
-- sempre per il token e per `resolve_admin_invite_binding`.
--
-- «L'apertura del link, la sua anteprima in una chat, il prefetch di un
-- browser e il tap Apri invito non attivano accessi, non accettano l'invito e
-- non consumano irreversibilmente la possibilità di utilizzarlo»: questa
-- funzione è `stable` e non scrive nulla, nemmeno un contatore.
-- ============================================================

create or replace function public.fetch_admin_invite_public(p_token text)
returns table (
  state            text,
  club_name        text,
  club_logo_url    text,
  club_is_verified boolean,
  role_label       text,
  scope_label      text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hash   text;
  v_invite public.club_admin_invites%rowtype;
  v_state  text;
begin
  v_hash := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');

  select inv.* into v_invite
  from public.club_admin_invite_handles h
  join public.club_admin_invites inv on inv.id = h.invite_id
  where h.token_hash = v_hash
    and h.revoked_at is null;

  if not found then
    return query select 'unavailable'::text, null::text, null::text, null::boolean, null::text, null::text;
    return;
  end if;

  v_state := public.club_admin_invite_state(v_invite.status, v_invite.expires_at);

  if v_state <> 'pending' then
    /* §25: «Sulla landing non autenticata usa uno stato minimo "Invito non
       disponibile" quando mostrare dettagli sullo stato o sul destinatario
       sarebbe improprio.» Chi ha in mano un link inoltrato non deve sapere
       se quell'invito è stato accettato, rifiutato o revocato. */
    return query select 'unavailable'::text, null::text, null::text, null::boolean, null::text, null::text;
    return;
  end if;

  return query
  select
    'valid'::text,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    role.name,
    public.club_admin_scope_label(
      v_invite.scope_mode,
      (select array_agg(t.team_id) from public.club_admin_invite_teams t
        where t.invite_id = v_invite.id)
    )
  from public.clubs c
  join public.club_admin_roles role on role.id = v_invite.role_id
  where c.id = v_invite.club_id;
end;
$$;

revoke all on function public.fetch_admin_invite_public(text) from public;
grant execute on function public.fetch_admin_invite_public(text) to anon, authenticated;


-- ============================================================
-- SEZIONE 20 — Binding del destinatario dopo l'autenticazione (§15)
--
-- La policy V1 deve impedire che chiunque possieda un link inoltrato diventi
-- amministratore.
--
--   · invito interno → il destinatario è il `recipient_profile_id` fissato
--     alla creazione. Solo quell'account prosegue;
--   · invito esterno → l'account deve possedere un indirizzo **verificato**
--     corrispondente, secondo il sistema account canonico. Il binding avviene
--     una sola volta, sul server, con `for update` a fare da controllo
--     concorrente (§15.4).
--
-- «Una stringa email inviata dal client, un contatto pubblico nel profilo, il
-- display name o il semplice possesso del token non costituiscono prova.»
-- ============================================================

create or replace function public.resolve_admin_invite_binding(p_token text)
returns table (
  state     text,
  invite_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_hash    text;
  v_invite  public.club_admin_invites%rowtype;
  v_state   text;
  v_matched uuid;
begin
  if v_uid is null then
    raise exception 'ADMIN_INVITE_NOT_AUTHENTICATED';
  end if;

  perform public.assert_agent_rate_limit(
    'admin_invite_resolve', null, 20, interval '1 hour'
  );

  v_hash := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');

  select inv.* into v_invite
  from public.club_admin_invite_handles h
  join public.club_admin_invites inv on inv.id = h.invite_id
  where h.token_hash = v_hash
    and h.revoked_at is null
  for update of inv;

  if not found then
    return query select 'unavailable'::text, null::uuid;
    return;
  end if;

  v_state := public.club_admin_invite_state(v_invite.status, v_invite.expires_at);

  if v_state <> 'pending' then
    /* §25 distingue i casi che il **destinatario** ha diritto di leggere da
       quelli che non lo riguardano: se l'invito è già suo, lo stato esatto
       glielo dirà `fetch_my_admin_invite`. */
    if v_invite.recipient_profile_id = v_uid then
      return query select v_state, v_invite.id;
    else
      return query select 'unavailable'::text, null::uuid;
    end if;
    return;
  end if;

  if v_invite.recipient_profile_id is not null then
    if v_invite.recipient_profile_id = v_uid then
      return query select 'valid'::text, v_invite.id;
    else
      /* §15: «Con account errato mostra "Questo invito è destinato a un altro
         account"» — senza pubblicare l'email di destinazione. */
      return query select 'wrong_account'::text, null::uuid;
    end if;
    return;
  end if;

  -- Percorso esterno non ancora associato.
  v_matched := public.account_profile_for_verified_email(v_invite.recipient_email);

  if v_matched is null or v_matched <> v_uid then
    /* L'indirizzo dell'account non è verificato, oppure non corrisponde. In
       entrambi i casi il possesso del token non basta (§15). */
    return query select
      case when v_matched is null then 'needs_verified_email' else 'wrong_account' end,
      null::uuid;
    return;
  end if;

  /* §19: «Deduplica i percorsi interno ed esterno quando il destinatario è
     risolto in modo autorevole.» Se nel frattempo esiste già un accesso o una
     proposta interna per la stessa persona, quella vince e questa decade. */
  if exists (
    select 1 from public.club_admin_memberships m
    where m.club_id = v_invite.club_id and m.profile_id = v_uid and m.status = 'active'
  ) then
    update public.club_admin_invites
    set status = 'revoked', revoked_at = timezone('utc', now())
    where id = v_invite.id and status = 'pending';

    insert into public.club_admin_audit
      (club_id, actor_id, invite_id, subject_id, operation, details)
    values (v_invite.club_id, v_uid, v_invite.id, v_uid, 'invite_superseded',
            jsonb_build_object('reason', 'membership_exists'));

    return query select 'already_admin'::text, null::uuid;
    return;
  end if;

  update public.club_admin_invites
  set recipient_profile_id = v_uid,
      bound_at             = timezone('utc', now()),
      bound_method         = 'verified_email'
  where id = v_invite.id
    and recipient_profile_id is null;

  insert into public.club_admin_audit
    (club_id, actor_id, invite_id, subject_id, operation, details)
  values (v_invite.club_id, v_uid, v_invite.id, v_uid, 'invite_bound',
          jsonb_build_object('method', 'verified_email'));

  return query select 'valid'::text, v_invite.id;
end;
$$;

revoke all on function public.resolve_admin_invite_binding(text) from public;
grant execute on function public.resolve_admin_invite_binding(text) to authenticated;


-- ============================================================
-- SEZIONE 21 — Lettura del proprio invito (§16)
--
-- «Il destinatario può leggere il proprio invito senza avere già accesso al
-- Centro Amministratori» (§6) e «quel permesso di ricezione non gli consente
-- di elencare altri amministratori» (§23). Due guard distinti: questo è il
-- guard PERSON, e l'unico controllo è `recipient_profile_id = auth.uid()`.
--
-- «Carica la proposta corrente dal server, con versione. Non presentare dati
-- provenienti solo dal testo del link» (§16): esce tutto da qui, compresa la
-- revisione che l'accettazione dovrà riconfermare.
-- ============================================================

create or replace function public.fetch_my_admin_invite(p_invite_id uuid)
returns table (
  invite_id        uuid,
  state            text,
  club_id          uuid,
  club_name        text,
  club_logo_url    text,
  club_is_verified boolean,
  role_label       text,
  scope_label      text,
  revision         integer,
  expires_at       timestamptz,
  membership_active boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_invite public.club_admin_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'ADMIN_INVITE_NOT_AUTHENTICATED';
  end if;

  select * into v_invite
  from public.club_admin_invites
  where id = p_invite_id and recipient_profile_id = v_uid;

  if not found then
    /* Non «non esiste»: §27 chiede di proteggere le API «da accessi tramite
       ID arbitrari». Un invito di qualcun altro e un id inventato devono
       essere indistinguibili. */
    raise exception 'ADMIN_INVITE_UNAVAILABLE';
  end if;

  return query
  select
    v_invite.id,
    public.club_admin_invite_state(v_invite.status, v_invite.expires_at),
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    role.name,
    public.club_admin_scope_label(
      v_invite.scope_mode,
      (select array_agg(t.team_id) from public.club_admin_invite_teams t
        where t.invite_id = v_invite.id)
    ),
    v_invite.revision,
    v_invite.expires_at,
    /* §25: «Hai già accettato questo invito. Accesso attuale verificato
       prima di offrire Dashboard.» Un invito accepted non prova che la
       membership sia ancora attiva: può essere stata revocata dopo. */
    exists (
      select 1 from public.club_admin_memberships m
      where m.club_id = v_invite.club_id
        and m.profile_id = v_uid
        and m.status = 'active'
    )
  from public.clubs c
  join public.club_admin_roles role on role.id = v_invite.role_id
  where c.id = v_invite.club_id;
end;
$$;

revoke all on function public.fetch_my_admin_invite(uuid) from public;
grant execute on function public.fetch_my_admin_invite(uuid) to authenticated;


-- ============================================================
-- SEZIONE 22 — Accettazione atomica e rifiuto (§17)
--
-- «Esegui in un'unica transazione o con garanzia atomica equivalente … Non
-- deve risultare un accepted nuovo senza la membership corrispondente per un
-- errore parziale, né una membership attivata con invito ancora pending per
-- lo stesso commit.»
--
-- Una funzione plpgsql **è** una transazione: o tutto ciò che segue viene
-- committato, o niente. Il punto delicato non è l'atomicità ma la
-- concorrenza, e la risolve il `for update` sull'invito: doppio tap, due
-- dispositivi e retry si serializzano sulla stessa riga, e il secondo trova
-- uno stato non più pending.
--
-- Controlli richiesti da §17, nell'ordine:
--   · destinatario corrispondente e stato pending effettivo;
--   · Society disponibile, ruolo della stessa Society, scope ancora valido;
--   · **revisione attesa** — un client con dati stale non concede;
--   · autorizzazione dell'invitante ancora valida al momento dell'attivazione.
-- ============================================================

create or replace function public.respond_to_admin_invite(
  p_invite_id       uuid,
  p_accept          boolean,
  p_revision        integer,
  p_idempotency_key text default null
)
returns table (
  invite_id     uuid,
  state         text,
  club_id       uuid,
  membership_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_invite      public.club_admin_invites%rowtype;
  v_state       text;
  v_role        public.club_admin_roles%rowtype;
  v_membership  uuid;
  v_teams       uuid[];
  v_replay      jsonb;
  v_fingerprint text;
  v_grantor_ok  boolean;
begin
  if v_uid is null then
    raise exception 'ADMIN_INVITE_NOT_AUTHENTICATED';
  end if;

  v_fingerprint := md5(
    p_invite_id::text || '|' || coalesce(p_accept::text, '') || '|' ||
    coalesce(p_revision::text, '')
  );

  select * into v_invite
  from public.club_admin_invites
  where id = p_invite_id and recipient_profile_id = v_uid
  for update;

  if not found then
    raise exception 'ADMIN_INVITE_UNAVAILABLE';
  end if;

  /* La chiave di idempotenza è vincolata alla Società dell'invito, non a una
     passata dal client (§21: «Filtri di destinatario e actor derivano
     dall'autenticazione e dal contesto validato»). */
  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, v_invite.club_id, 'admin_invite_respond', v_fingerprint
  );

  if v_replay is not null then
    return query
    select
      (v_replay->>'invite_id')::uuid,
      v_replay->>'state',
      (v_replay->>'club_id')::uuid,
      nullif(v_replay->>'membership_id', '')::uuid;
    return;
  end if;

  v_state := public.club_admin_invite_state(v_invite.status, v_invite.expires_at);

  if v_state <> 'pending' then
    /* §17: «Se lo stesso invito è già accepted, restituisci il risultato
       storico corrente senza ricreare permessi.» Non è un errore: è lo stato
       reale, e la UI lo rilegge. */
    return query
    select v_invite.id, v_state, v_invite.club_id,
           (select m.id from public.club_admin_memberships m
             where m.club_id = v_invite.club_id and m.profile_id = v_uid);
    return;
  end if;

  /* §16: «Le modifiche autorizzate dell'invito incrementano la revisione e
     rendono necessario ricaricare la proposta prima di accettare.» */
  if p_revision is not null and p_revision <> v_invite.revision then
    raise exception 'ADMIN_INVITE_REVISION_CONFLICT';
  end if;

  -- ── Rifiuto ─────────────────────────────────────────────────────────────
  if not coalesce(p_accept, false) then
    update public.club_admin_invites
    set status = 'rejected', rejected_at = timezone('utc', now())
    where id = v_invite.id;

    insert into public.club_admin_audit
      (club_id, actor_id, invite_id, subject_id, operation, details)
    values (v_invite.club_id, v_uid, v_invite.id, v_uid, 'invite_rejected', '{}'::jsonb);

    perform public.club_relationship_operation_record(
      p_idempotency_key, v_invite.club_id, 'admin_invite_respond', v_fingerprint,
      jsonb_build_object('invite_id', v_invite.id, 'state', 'rejected',
                         'club_id', v_invite.club_id, 'membership_id', null)
    );

    return query select v_invite.id, 'rejected'::text, v_invite.club_id, null::uuid;
    return;
  end if;

  -- ── Accettazione ────────────────────────────────────────────────────────
  select * into v_role
  from public.club_admin_roles r
  where r.id = v_invite.role_id and r.club_id = v_invite.club_id;

  if not found or not v_role.is_active or v_role.config_version <> v_invite.role_config_version then
    /* §17: «Se il ruolo, il suo contenuto autorizzativo o lo scope non
       corrispondono più a una proposta valida e autorizzata, impedisci
       l'accettazione.» Mai allargare i permessi per far passare la
       richiesta. */
    raise exception 'ADMIN_INVITE_PROPOSAL_CHANGED';
  end if;

  select array_agg(t.team_id) into v_teams
  from public.club_admin_invite_teams t
  where t.invite_id = v_invite.id;

  if v_invite.scope_mode = 'teams' then
    if v_teams is null or exists (
      select 1 from unnest(v_teams) as requested(team_id)
      where not exists (
        select 1 from public.club_teams ct
        where ct.id = requested.team_id
          and ct.club_id = v_invite.club_id
          and coalesce(ct.is_archived, false) = false
      )
    ) then
      raise exception 'ADMIN_INVITE_PROPOSAL_CHANGED';
    end if;
  end if;

  /* §17: «La policy predefinita richiede che l'invitante conservi
     l'autorizzazione a proporre quel ruolo/scope al momento
     dell'attivazione.» La valutazione è esplicita e non deriva dal semplice
     fatto che l'invito esista. */
  select
    c.owner_profile_id = v_invite.created_by
    or exists (
      select 1
      from public.club_member_permissions perm
      where perm.club_id = v_invite.club_id
        and perm.profile_id = v_invite.created_by
        and perm.permission_key = 'admins_invite'
        and perm.team_id is null
        and public.club_access_is_active(v_invite.club_id, v_invite.created_by)
    )
  into v_grantor_ok
  from public.clubs c
  where c.id = v_invite.club_id;

  if not coalesce(v_grantor_ok, false) then
    raise exception 'ADMIN_INVITE_GRANTOR_UNAUTHORIZED';
  end if;

  /* §17: «assenza di membership concorrente che renderebbe la proposta
     duplicata» e §19: «L'accettazione di una seconda proposta quando esiste
     già una membership attiva non amplia quella membership.» */
  if exists (
    select 1 from public.club_admin_memberships m
    where m.club_id = v_invite.club_id and m.profile_id = v_uid and m.status = 'active'
  ) then
    update public.club_admin_invites
    set status = 'revoked', revoked_at = timezone('utc', now())
    where id = v_invite.id;

    insert into public.club_admin_audit
      (club_id, actor_id, invite_id, subject_id, operation, details)
    values (v_invite.club_id, v_uid, v_invite.id, v_uid, 'invite_superseded',
            jsonb_build_object('reason', 'membership_exists'));

    raise exception 'ADMIN_INVITE_ALREADY_ADMIN';
  end if;

  -- Membership: creazione o riattivazione **con la proposta corrente**.
  -- §17 vieta di «recuperare silenziosamente ruoli o scope precedenti».
  insert into public.club_admin_memberships (
    club_id, profile_id, role_id, role_config_version, scope_mode,
    status, invite_id, granted_by, activated_at, revoked_at, revoked_by
  )
  values (
    v_invite.club_id, v_uid, v_role.id, v_role.config_version, v_invite.scope_mode,
    'active', v_invite.id, v_invite.created_by, timezone('utc', now()), null, null
  )
  on conflict on constraint club_admin_memberships_unique do update
  set role_id             = excluded.role_id,
      role_config_version = excluded.role_config_version,
      scope_mode          = excluded.scope_mode,
      status              = 'active',
      invite_id           = excluded.invite_id,
      granted_by          = excluded.granted_by,
      activated_at        = excluded.activated_at,
      revoked_at          = null,
      revoked_by          = null
  returning id into v_membership;

  delete from public.club_admin_membership_teams as mt where mt.membership_id = v_membership;

  if v_invite.scope_mode = 'teams' then
    insert into public.club_admin_membership_teams (membership_id, team_id)
    select v_membership, t from unnest(v_teams) t;
  end if;

  -- Capability effettive: righe di `club_member_permissions`, con lo scope
  -- canonico su `team_id`. Il permission domain resta uno solo (§20).
  /* Si arriva qui solo senza membership amministrativa attiva (il controllo
     sopra l'ha escluso). Gli eventuali grant residui appartengono quindi a un
     accesso già inerte — `club_access_is_active` è falso — e sostituirli con
     quelli del ruolo appena accettato è ciò che §17 chiede: «non recuperare
     silenziosamente ruoli o scope precedenti». */
  delete from public.club_member_permissions as perm
  where perm.club_id = v_invite.club_id and perm.profile_id = v_uid;

  if v_invite.scope_mode = 'society' then
    insert into public.club_member_permissions
      (club_id, profile_id, permission_key, team_id, granted_by_profile_id)
    select v_invite.club_id, v_uid, rp.permission_key, null, v_invite.created_by
    from public.club_admin_role_permissions rp
    where rp.role_id = v_role.id
    on conflict do nothing;
  else
    insert into public.club_member_permissions
      (club_id, profile_id, permission_key, team_id, granted_by_profile_id)
    select v_invite.club_id, v_uid, rp.permission_key, t, v_invite.created_by
    from public.club_admin_role_permissions rp
    cross join unnest(v_teams) t
    on conflict do nothing;
  end if;

  update public.club_admin_invites
  set status        = 'accepted',
      accepted_at   = timezone('utc', now()),
      membership_id = v_membership
  where id = v_invite.id;

  /* §19: «Dopo l'accettazione valida di una proposta, le altre pending ormai
     incompatibili vengono invalidate con audit.» */
  update public.club_admin_invites as other
  set status = 'revoked', revoked_at = timezone('utc', now())
  where other.club_id = v_invite.club_id
    and other.id <> v_invite.id
    and other.status = 'pending'
    and (other.recipient_profile_id = v_uid
         or other.recipient_email = (select public.normalize_account_email(u.email)
                               from auth.users u where u.id = v_uid));

  insert into public.club_admin_audit
    (club_id, actor_id, invite_id, membership_id, subject_id, operation, details)
  values
    (v_invite.club_id, v_uid, v_invite.id, v_membership, v_uid, 'invite_accepted',
     jsonb_build_object('role_id', v_role.id,
                        'role_config_version', v_role.config_version,
                        'scope_mode', v_invite.scope_mode)),
    (v_invite.club_id, v_uid, v_invite.id, v_membership, v_uid, 'membership_activated',
     jsonb_build_object('team_count', coalesce(array_length(v_teams, 1), 0)));

  perform public.club_relationship_operation_record(
    p_idempotency_key, v_invite.club_id, 'admin_invite_respond', v_fingerprint,
    jsonb_build_object('invite_id', v_invite.id, 'state', 'accepted',
                       'club_id', v_invite.club_id, 'membership_id', v_membership)
  );

  return query select v_invite.id, 'accepted'::text, v_invite.club_id, v_membership;
end;
$$;

revoke all on function public.respond_to_admin_invite(uuid, boolean, integer, text) from public;
grant execute on function public.respond_to_admin_invite(uuid, boolean, integer, text) to authenticated;


-- ============================================================
-- SEZIONE 23 — Notifica strutturale (§22)
--
-- «L'invito a una persona registrata genera una notifica strutturale nel
-- Centro Notifiche. L'evento si riferisce allo stesso invite_id e apre la
-- ricezione canonica.»
--
-- Il tipo entra nella mappa canonica del trigger: categoria `richieste`,
-- gated dalla preferenza `requests` come ogni altra richiesta. Senza questa
-- riga ricadrebbe in `sistema` e sfuggirebbe alle preferenze dell'utente.
--
-- Nessun secondo canale: §22 vieta conversazione DIRECT, messaggio automatico
-- in chat, badge Messaggi e una seconda inbox degli inviti amministrativi.
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
-- SEZIONE 24 — Riconciliazione dell'hub (§7.2, §22)
--
-- «I count degli inviti e degli attivi devono usare gli stessi criteri
-- dell'hub Struttura societaria.»
--
-- L'hub contava come pending una riga `club_members` pending con grant: una
-- combinazione che la RLS di `club_member_permissions` rende impossibile da
-- creare, quindi quel numero valeva sempre 0. Ora legge il dominio reale.
--
-- Cambiano anche i tre flag amministrativi: erano `owns_club()` perché «la
-- lettura degli accessi amministrativi non ha una capability propria». Ora ce
-- l'ha, e §23 chiede di valutarli separatamente.
-- ============================================================

create or replace function public.fetch_society_structure(p_club_id uuid)
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
  data_revision               bigint
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
  v_company := v_owner or public.dashboard_club_scope(p_club_id) is null;

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
    )
  from public.clubs c
  where c.id = p_club_id;
end;
$$;

revoke all on function public.fetch_society_structure(uuid) from public;
grant execute on function public.fetch_society_structure(uuid) to authenticated;

comment on function public.fetch_society_structure(uuid) is
  'DAS-REV-12 + DAS-REV-13: composizione dell''hub Struttura societaria. '
  'Le tre letture amministrative hanno ora chiavi proprie e i conteggi '
  'vengono dal dominio inviti/membership, con gli stessi criteri del Centro '
  'Amministratori.';
