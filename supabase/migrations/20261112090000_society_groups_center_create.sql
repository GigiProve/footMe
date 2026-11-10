-- ============================================================
-- DAS-REV-32 — Gruppi: centro e creazione
--
-- Cosa mancava, verificato sul repository prima di scrivere questa
-- migrazione (la mappa completa è nel report di consegna):
--
--   · `conversations` sa già essere `group` (20260718090000) ma non ha
--     nessun contesto organizzativo: niente Società, niente Squadra, niente
--     stato. Il Centro Gruppi non avrebbe avuto niente da elencare.
--   · `conversation_participants` non ha un ruolo interno: ADMIN/MEMBER
--     (§4) non erano rappresentabili.
--   · Le policy consentono a un utente di iscrivere **solo sé stesso**
--     (20260309000001 «users can add themselves»): una create con altri
--     partecipanti richiede un comando SECURITY DEFINER, e deve esserlo,
--     perché le regole di §21 non sono esprimibili in una policy.
--   · Nessuna chiave di permesso per i gruppi nel catalogo DAS-REV-14.
--   · Nessun lookup di «persone ufficialmente collegate» pensato per una
--     selezione: quelli esistenti cercano estranei da invitare
--     (search_society_member_candidates) o leggono Shortlist e profili
--     (eventi), cioè proprio le fonti che §17 esclude.
--   · `fetch_direct_conversation_meta` rifiuta le conversazioni non dirette:
--     la chat di un gruppo non aveva header né conteggio persone.
--
-- Scelte (§ = paragrafo della task):
--
--   1. Un gruppo è **una** riga di `conversations` (type `group`); i
--      metadata organizzativi stanno in `society_groups`, uno-a-uno con PK =
--      `conversation_id` (§4). Nessun ID funzionale proprio, nessuna
--      membership propria: la membership è `conversation_participants`.
--   2. Il ruolo interno è una colonna di `conversation_participants`
--      (`member_role` admin/member). Le dirette sono tutte `member`: il
--      ruolo non vi ha semantica e nessuna lettura delle dirette lo usa.
--   3. Permessi: area `groups` (scope team) con `groups_view` e
--      `groups_create`. «Nessuna squadra» richiede lo scope societario della
--      chiave (`member_invite_allows(..., 'society')`), così uno scope di
--      squadra non si aggira con team_id nullo (§15, QA-032).
--      **Backfill** deciso da Luigi il 2026-11-10: chi ha già
--      `assignments_manage` (chi gestisce l'organico) riceve entrambe le
--      chiavi con lo stesso `team_id`, nelle righe effettive e nei ruoli.
--   4. Eleggibilità (§17) = un incarico `club_member_assignments` attivo,
--      sulla membership `club_members` attiva della stessa persona, con un
--      profilo di tipo persona sportiva/dirigenziale. Record manuali (senza
--      profilo), inviti, richieste, candidature, Shortlist, eventi e
--      affiliate non soddisfano il predicate per costruzione. Il repository
--      non ha uno stato di sospensione del profilo: «profilo disponibile» è
--      l'esistenza della riga `profiles` (limite dichiarato).
--   5. Visibilità delle persone = scope di `groups_create` dell'actor: scope
--      societario vede tutta la Società, scope di squadra vede solo chi ha
--      un incarico attivo in quelle squadre.
--   6. Create atomica in una sola funzione, con ricevuta idempotente
--      (modello DAS-REV-28) e lock: advisory sulla chiave, `for share` sulla
--      squadra e sugli incarichi delle persone selezionate, così un archivio
--      o una cessazione concorrenti aspettano il commit o lo fanno fallire.
--   7. Nessuna outbox: il repository non ne ha (vedi 20261111090000). Il
--      gruppo appare nelle superfici per lettura diretta della membership
--      (Inbox e Centro rileggono al focus). Nessun Message di sistema (§22).
--   8. Avatar = asset registrato dal server in un bucket privato, sul
--      modello della locandina di DAS-REV-29. `conversations.avatar_url`
--      resta per i gruppi legacy e non viene scritto: il percorso privato
--      non è un URL.
--   9. CONTACT_SHARE nei gruppi è vietato anche dal server (trigger), non
--      solo nascosto nel composer (§25).
--
-- Funzioni riemesse, ciascuna dalla sua **ultima** definizione:
--   · dashboard_club_capabilities  ← 20261110090000 (+2 chiavi)
--   · fetch_inbox_conversations    ← 20260718090600 (+ group_avatar_path,
--                                    signature di ritorno cambiata: drop+create)
-- ============================================================


-- ============================================================
-- SEZIONE 1 — ruolo interno del partecipante (§4)
-- ============================================================

alter table public.conversation_participants
  add column if not exists member_role text not null default 'member';

alter table public.conversation_participants
  drop constraint if exists conversation_participants_member_role_check;

alter table public.conversation_participants
  add constraint conversation_participants_member_role_check
  check (member_role in ('admin', 'member'));

/* I gruppi legacy (seed demo MES-01) hanno un creatore ma nessun ADMIN: il
   creatore che è ancora partecipante diventa ADMIN. Nessun ruolo Society
   viene trasformato in ADMIN (§28). */
update public.conversation_participants cp
set member_role = 'admin'
from public.conversations c
where c.id = cp.conversation_id
  and c.conversation_type = 'group'
  and c.created_by_profile_id = cp.profile_id
  and cp.member_role <> 'admin';


-- ============================================================
-- SEZIONE 2 — limiti centrali (§14, §16, §19)
--
-- Una sola fonte: il client li riceve dalle letture.
-- ============================================================

create or replace function public.society_group_limits()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'nameMax',         80,
    /* §18: creator + almeno un'altra PERSON. */
    'minPeople',       2,
    /* Il core Messaggi non aveva un massimo: lo introduciamo qui, una volta. */
    'maxPeople',       256,
    'avatarMaxBytes',  5242880,
    'avatarMimeTypes', jsonb_build_array('image/jpeg', 'image/png', 'image/webp')
  );
$$;

revoke all on function public.society_group_limits() from public;
revoke execute on function public.society_group_limits() from anon;
grant execute on function public.society_group_limits() to authenticated;

/**
 * Nome normalizzato (§14): trim, spazi interni compressi, Unicode
 * conservato. `null` se vuoto o solo whitespace; rifiuta i caratteri di
 * controllo. Il limite si controlla sul risultato.
 */
create or replace function public.society_group_clean_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
$$;

revoke all on function public.society_group_clean_name(text) from public;
grant execute on function public.society_group_clean_name(text) to authenticated;


-- ============================================================
-- SEZIONE 3 — avatar: bucket e asset (§16)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'society-group-avatars',
  'society-group-avatars',
  false,
  5242880, -- 5 MB, lo stesso valore di society_group_limits()
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.society_group_avatar_assets (
  id           uuid primary key,
  club_id      uuid not null references public.clubs(id) on delete cascade,
  storage_path text not null unique,
  mime_type    text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size    integer not null check (byte_size > 0),
  width        integer check (width is null or width between 1 and 20000),
  height       integer check (height is null or height between 1 and 20000),
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default timezone('utc', now())
);

create index if not exists society_group_avatar_assets_club_idx
  on public.society_group_avatar_assets (club_id, created_at desc);

alter table public.society_group_avatar_assets enable row level security;
revoke all on public.society_group_avatar_assets from anon, authenticated;

comment on table public.society_group_avatar_assets is
  'DAS-REV-32 §16: immagini dei gruppi operativi. Una riga nasce solo da '
  'register_society_group_avatar, che legge l''oggetto reale in Storage; il '
  'gruppo la referenzia con society_groups.avatar_asset_id.';


-- ============================================================
-- SEZIONE 4 — metadata organizzativi del gruppo (§4)
-- ============================================================

create table if not exists public.society_groups (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  club_id         uuid not null references public.clubs(id) on delete cascade,
  /* NO ACTION, non set null: §4 vieta di convertire in silenzio un gruppo
     di squadra in un gruppo societario. Una squadra con gruppi non si
     cancella; si archivia, e il riferimento storico resta. */
  team_id         uuid references public.club_teams(id),
  name            text not null,
  name_norm       text not null,
  avatar_asset_id uuid unique references public.society_group_avatar_assets(id),
  status          text not null default 'active' check (status in ('active', 'archived')),
  version         integer not null default 1,
  /* Riferimento tecnico all'actor, distinto dall'identità mittente (§4). */
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now()),
  constraint society_groups_name_not_blank check (length(btrim(name)) > 0)
);

/* Nessun UNIQUE su nome o squadra (§4, QA-007, QA-008). */
create index if not exists society_groups_center_idx
  on public.society_groups (club_id, status, team_id, name_norm, conversation_id);

create index if not exists society_groups_team_idx
  on public.society_groups (team_id)
  where team_id is not null;

alter table public.society_groups enable row level security;
revoke all on public.society_groups from anon, authenticated;

comment on table public.society_groups is
  'DAS-REV-32 §4: contesto organizzativo di una Conversation GROUP. Uno-a-uno '
  'con conversations; nessuna membership né lifecycle autonomi. Si legge solo '
  'dalle RPC amministrative.';

/**
 * Invarianti di integrità che le FK non esprimono (§22): la conversazione è
 * un GROUP, la squadra appartiene alla Società. Vale per ogni scrittura,
 * anche fuori dai comandi.
 */
create or replace function public.society_groups_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  if tg_op = 'UPDATE' and new.club_id <> old.club_id then
    raise exception 'SOCIETY_GROUP_INVALID:club_immutable';
  end if;

  new.name_norm  := public.footme_normalize_lookup(new.name);
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.society_groups_guard() from public;

drop trigger if exists society_groups_guard on public.society_groups;
create trigger society_groups_guard
before insert or update on public.society_groups
for each row execute function public.society_groups_guard();

/**
 * Membership dei gruppi operativi: solo dal comando (§8, §22, §26).
 *
 * La policy MES-01 «users can add themselves as participants»
 * (20260309000001) lascia a chiunque inserire sé stesso in **qualunque**
 * conversazione di cui conosce l'ID. Finché gli ID dei gruppi non uscivano
 * dall'Inbox dei membri il buco non era sfruttabile; il Centro Gruppi li
 * mostra ai manager non membri, e un insert diretto via PostgREST li
 * avrebbe resi partecipanti — e lettori della timeline — senza passare da
 * nessuna regola (§26: «Un ID ottenuto tramite Dashboard non è un token per
 * leggere messaggi»). Trovato dalla review del 2026-11-10.
 *
 * Per un gruppo con metadata `society_groups`, insert e cambi di ruolo sono
 * ammessi solo dentro `create_society_group`, che apre la finestra con un
 * flag **locale alla transazione** (`set_config(..., true)`) sul proprio
 * conversation_id. In ogni conversazione, `member_role = 'admin'` nasce solo
 * da quel comando: nessun ADMIN autoassegnato.
 *
 * In più: nessuna identità MEDIA tra i partecipanti di un gruppo operativo.
 * L'account `club_admin` non è escluso qui: oggi è anche la persona
 * dell'Owner, che può essere il creator (limite MES-04, nel report).
 * La selezione degli altri partecipanti lo esclude già dal predicate.
 *
 * Fuori perimetro e preesistente: la stessa policy permette ancora di
 * iscriversi a una conversazione diretta o a un gruppo legacy di cui si
 * conosce l'ID. Va chiusa in MES-04 insieme ai comandi di membership.
 */
create or replace function public.society_group_participant_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window boolean := coalesce(current_setting('society_groups.creating', true), '') = new.conversation_id::text;
begin
  if tg_op = 'UPDATE'
     and new.member_role is not distinct from old.member_role
     and new.conversation_id = old.conversation_id
     and new.profile_id = old.profile_id then
    return new;
  end if;

  if not v_window then
    if exists (select 1 from public.society_groups g where g.conversation_id = new.conversation_id) then
      raise exception 'SOCIETY_GROUP_MEMBERSHIP_COMMAND_REQUIRED';
    end if;

    if new.member_role = 'admin' and (tg_op = 'INSERT' or old.member_role <> 'admin') then
      raise exception 'SOCIETY_GROUP_MEMBERSHIP_COMMAND_REQUIRED';
    end if;
  end if;

  if exists (select 1 from public.society_groups g where g.conversation_id = new.conversation_id)
     and exists (
       select 1 from public.profiles p
       where p.id = new.profile_id and p.role::text = 'media'
     ) then
    raise exception 'SOCIETY_GROUP_INVALID:participant_kind';
  end if;

  return new;
end;
$$;

revoke all on function public.society_group_participant_guard() from public;

drop trigger if exists society_group_participant_guard on public.conversation_participants;
create trigger society_group_participant_guard
before insert or update on public.conversation_participants
for each row execute function public.society_group_participant_guard();

/** §25: CONTACT_SHARE è assente nei GROUP, anche via API diretta. */
create or replace function public.messages_no_contact_card_in_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.message_kind = 'contact_card'
     and exists (
       select 1 from public.conversations c
       where c.id = new.conversation_id and c.conversation_type = 'group'
     ) then
    raise exception 'GROUP_CONTACT_SHARE_NOT_ALLOWED';
  end if;

  return new;
end;
$$;

revoke all on function public.messages_no_contact_card_in_group() from public;

drop trigger if exists messages_no_contact_card_in_group on public.messages;
create trigger messages_no_contact_card_in_group
before insert on public.messages
for each row execute function public.messages_no_contact_card_in_group();


-- ============================================================
-- SEZIONE 5 — catalogo permessi (§8)
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
    'groups_create'
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
    'groups_create'
  ));

/* In coda alle aree esistenti: nessun sort_order spostato. */
insert into public.club_permission_areas
  (id, label, description, sort_order, scope_kind, is_available) values
  ('groups', 'Gruppi', 'Conversazioni operative della società.', 10, 'team', true)
on conflict (id) do update
  set label        = excluded.label,
      description  = excluded.description,
      sort_order   = excluded.sort_order,
      scope_kind   = excluded.scope_kind,
      is_available = excluded.is_available;

insert into public.club_permission_controls
  (id, area_id, label, helper, bundle, requires, sort_order, is_available) values
  ('groups_read', 'groups', 'Visualizza gruppi', null,
     'view',   array[]::text[], 1, true),
  ('groups_write', 'groups', 'Crea gruppi',
     'Necessario per visualizzare i gruppi',
     'manage', array['groups_read'], 2, true)
on conflict (id) do update
  set area_id      = excluded.area_id,
      label        = excluded.label,
      helper       = excluded.helper,
      bundle       = excluded.bundle,
      requires     = excluded.requires,
      sort_order   = excluded.sort_order,
      is_available = excluded.is_available;

insert into public.club_permission_control_keys (control_id, permission_key) values
  ('groups_read',  'groups_view'),
  ('groups_write', 'groups_create')
on conflict do nothing;

insert into public.app_policy_settings (key, value, description)
values (
  'admin_permission_catalog_revision',
  to_jsonb(6),
  'DAS-REV-14 §7 — revisione della tassonomia aree/controlli/chiavi. Va '
  'incrementata da ogni migrazione che cambia il catalogo.'
)
on conflict (key) do update set value = to_jsonb(6);

/* Backfill (decisione di Luigi, 2026-11-10): chi gestisce l'organico
   (`assignments_manage`) riceve le due chiavi dei gruppi nello **stesso**
   perimetro. Ruoli: la configurazione; righe effettive: la proiezione già
   materializzata (stessa forma che produrrebbe
   club_admin_apply_membership_permissions, perché entrambe le aree sono di
   scope team). */
insert into public.club_admin_role_permissions (role_id, permission_key)
select rp.role_id, k.key
from public.club_admin_role_permissions rp
cross join (values ('groups_view'), ('groups_create')) as k(key)
where rp.permission_key = 'assignments_manage'
on conflict do nothing;

insert into public.club_member_permissions
  (club_id, profile_id, permission_key, team_id, granted_by_profile_id)
select perm.club_id, perm.profile_id, k.key, perm.team_id, perm.granted_by_profile_id
from public.club_member_permissions perm
cross join (values ('groups_view'), ('groups_create')) as k(key)
where perm.permission_key = 'assignments_manage'
on conflict do nothing;

/* Riscritta da 20261110090000_selection_event_invitations.sql (ultima
   definizione) con `groups_view` e `groups_create` in entrambe le
   whitelist. Nessun'altra differenza. */
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
      'groups_create'
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
            'groups_create'
          )
      ),
      array[]::text[]
    )
  end;
$$;

revoke all on function public.dashboard_club_capabilities(uuid) from public;
grant execute on function public.dashboard_club_capabilities(uuid) to authenticated;


-- ============================================================
-- SEZIONE 6 — autorizzazione e eleggibilità (§8, §15, §17)
-- ============================================================

/**
 * L'actor può `view` o `create` un gruppo nel contesto (Società, Squadra).
 * team_id nullo = contesto societario = richiede lo scope societario della
 * chiave (§15). Una squadra di un'altra Società non passa mai.
 */
create or replace function public.society_group_can(
  p_club_id uuid,
  p_team_id uuid,
  p_action  text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text := case p_action when 'create' then 'groups_create' else 'groups_view' end;
begin
  if p_club_id is null or auth.uid() is null then
    return false;
  end if;

  if p_team_id is not null and not exists (
    select 1 from public.club_teams t where t.id = p_team_id and t.club_id = p_club_id
  ) then
    return false;
  end if;

  return public.member_invite_allows(
    p_club_id,
    v_key,
    case when p_team_id is null then 'society' else 'team' end,
    p_team_id
  );
end;
$$;

revoke all on function public.society_group_can(uuid, uuid, text) from public;
revoke execute on function public.society_group_can(uuid, uuid, text) from anon;
grant execute on function public.society_group_can(uuid, uuid, text) to authenticated;

/**
 * §17 — predicate unico di eleggibilità: PERSON con un incarico ufficiale
 * attivo nella Società, sulla propria relazione attiva. Usato da lista,
 * conteggi, «Seleziona tutti» e commit.
 */
create or replace function public.society_group_person_eligible(
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
    from public.club_member_assignments a
    join public.club_members m
      on m.id = a.membership_id
     and m.club_id = a.club_id
     and m.profile_id = a.profile_id
     and m.status = 'active'
    join public.profiles p on p.id = a.profile_id
    where a.club_id = p_club_id
      and a.profile_id = p_profile_id
      and a.status = 'active'
      /* Solo PERSON (§17): l'account della Società (club_admin) e le identità
         MEDIA non sono partecipanti selezionabili. Il criterio è il tipo di
         identità, non una lista di professioni. */
      and p.role::text not in ('club_admin', 'media')
  );
$$;

revoke all on function public.society_group_person_eligible(uuid, uuid) from public;

/**
 * La persona è consultabile dall'actor nello scope di `groups_create`
 * (§15: «Nessuna squadra» non autorizza a consultare tutta la Società).
 * `p_scope` è `dashboard_club_capability_scope(club, 'groups_create')`:
 * null = societario.
 */
create or replace function public.society_group_person_visible(
  p_club_id    uuid,
  p_profile_id uuid,
  p_scope      uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_scope is null
      or exists (
        select 1
        from public.club_member_assignments a
        where a.club_id = p_club_id
          and a.profile_id = p_profile_id
          and a.status = 'active'
          and a.team_id = any (p_scope)
      );
$$;

revoke all on function public.society_group_person_visible(uuid, uuid, uuid[]) from public;

/** La persona ha un incarico attivo in quella squadra. */
create or replace function public.society_group_person_in_team(
  p_club_id    uuid,
  p_profile_id uuid,
  p_team_id    uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_team_id is not null and exists (
    select 1
    from public.club_member_assignments a
    where a.club_id = p_club_id
      and a.profile_id = p_profile_id
      and a.status = 'active'
      and a.team_id = p_team_id
  );
$$;

revoke all on function public.society_group_person_in_team(uuid, uuid, uuid) from public;

/** Il gruppo è leggibile in amministrazione dall'actor corrente. */
create or replace function public.society_group_admin_visible(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.society_groups g
    where g.conversation_id = p_conversation_id
      and public.society_group_can(g.club_id, g.team_id, 'view')
  );
$$;

revoke all on function public.society_group_admin_visible(uuid) from public;


-- ============================================================
-- SEZIONE 7 — cursori opachi (§10, §18)
--
-- Il cursore porta solo la tupla di ordinamento dell'ultima riga. Non è un
-- token di accesso: ogni pagina rifiltra per autorizzazione.
-- ============================================================

create or replace function public.society_group_cursor_encode(p jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select replace(replace(encode(convert_to(p::text, 'utf8'), 'base64'), E'\n', ''), '=', '');
$$;

create or replace function public.society_group_cursor_decode(p text)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_padded text;
begin
  if p is null or length(p) = 0 then
    return null;
  end if;

  v_padded := p || repeat('=', (4 - length(p) % 4) % 4);
  return convert_from(decode(v_padded, 'base64'), 'utf8')::jsonb;
exception when others then
  raise exception 'SOCIETY_GROUP_INVALID:cursor';
end;
$$;

revoke all on function public.society_group_cursor_encode(jsonb) from public;
revoke all on function public.society_group_cursor_decode(text) from public;


-- ============================================================
-- SEZIONE 8 — letture amministrative (§10, §11, §26)
--
-- Proiezione amministrativa: nessun body, mittente, unread, mute o
-- attività conversazionale (DoD-08). Nemmeno per il manager che è membro.
-- ============================================================

/**
 * Centro Gruppi: gruppi attivi visibili nello scope, con ricerca sul solo
 * nome e ordinamento amministrativo stabile (§10): prima i gruppi di
 * squadra nell'ordine canonico delle Squadre, poi quelli di contesto
 * societario; dentro, nome normalizzato e ID.
 */
create or replace function public.fetch_society_groups_page(
  p_club_id uuid,
  p_query   text default null,
  p_cursor  text default null,
  p_limit   integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_query  text := nullif(public.footme_normalize_lookup(p_query), '');
  v_limit  integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_cursor jsonb := public.society_group_cursor_decode(p_cursor);
  v_rows   jsonb;
  v_more   boolean;
  v_last   jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_club_id is null
     or not ('groups_view' = any (public.dashboard_club_capabilities(p_club_id))) then
    raise exception 'SOCIETY_GROUPS_NOT_AUTHORIZED';
  end if;

  with visible as (
    select
      g.conversation_id,
      g.name,
      g.name_norm,
      g.team_id,
      t.name                                    as team_name,
      (g.team_id is null)::int                  as society_rank,
      coalesce(t.sort_order, 0)                 as team_sort,
      coalesce(public.footme_normalize_lookup(t.name), '') as team_norm,
      a.storage_path                            as avatar_path,
      (select count(*)::int from public.conversation_participants cp
        where cp.conversation_id = g.conversation_id) as people_count
    from public.society_groups g
    left join public.club_teams t on t.id = g.team_id
    left join public.society_group_avatar_assets a on a.id = g.avatar_asset_id
    where g.club_id = p_club_id
      and g.status = 'active'
      and public.society_group_can(g.club_id, g.team_id, 'view')
      and (v_query is null or g.name_norm like '%' || v_query || '%')
  ),
  paged as (
    select *
    from visible v
    where v_cursor is null
       or (v.society_rank, v.team_sort, v.team_norm, v.name_norm, v.conversation_id::text)
          > ((v_cursor ->> 's')::int, (v_cursor ->> 't')::int, v_cursor ->> 'tn',
             v_cursor ->> 'n', v_cursor ->> 'id')
    order by v.society_rank, v.team_sort, v.team_norm, v.name_norm, v.conversation_id::text
    limit v_limit + 1
  )
  select coalesce(jsonb_agg(to_jsonb(p) order by p.society_rank, p.team_sort, p.team_norm,
                                                p.name_norm, p.conversation_id::text), '[]'::jsonb)
  into v_rows
  from paged p;

  v_more := jsonb_array_length(v_rows) > v_limit;

  if v_more then
    v_rows := v_rows - v_limit;
  end if;

  v_last := v_rows -> (jsonb_array_length(v_rows) - 1);

  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'conversation_id', r -> 'conversation_id',
        'name',            r -> 'name',
        'team_id',         r -> 'team_id',
        'team_name',       r -> 'team_name',
        'avatar_path',     r -> 'avatar_path',
        'people_count',    r -> 'people_count') order by ord)
      from jsonb_array_elements(v_rows) with ordinality as e(r, ord)
    ), '[]'::jsonb),
    'next_cursor', case when v_more and v_last is not null then
      public.society_group_cursor_encode(jsonb_build_object(
        's',  v_last -> 'society_rank',
        't',  v_last -> 'team_sort',
        'tn', v_last ->> 'team_norm',
        'n',  v_last ->> 'name_norm',
        'id', v_last ->> 'conversation_id'))
      else null end,
    'can_create', 'groups_create' = any (public.dashboard_club_capabilities(p_club_id)),
    'limits', public.society_group_limits()
  );
end;
$$;

revoke all on function public.fetch_society_groups_page(uuid, text, text, integer) from public;
revoke execute on function public.fetch_society_groups_page(uuid, text, text, integer) from anon;
grant execute on function public.fetch_society_groups_page(uuid, text, text, integer) to authenticated;

/**
 * Dettaglio amministrativo (§11). Non trovato e non autorizzato sono la
 * stessa risposta (anti-enumerazione, QA-029). `can_open_conversation` è la
 * membership corrente del viewer, non un derivato dei permessi Society
 * (§8: can_manage_group ≠ can_access_conversation).
 */
create or replace function public.fetch_society_group_detail(
  p_club_id         uuid,
  p_conversation_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row record;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select g.conversation_id, g.club_id, g.team_id, g.name, g.status,
         t.name as team_name, c.name as club_name, a.storage_path as avatar_path
  into v_row
  from public.society_groups g
  join public.clubs c on c.id = g.club_id
  left join public.club_teams t on t.id = g.team_id
  left join public.society_group_avatar_assets a on a.id = g.avatar_asset_id
  where g.conversation_id = p_conversation_id
    and g.club_id = p_club_id
    and g.status = 'active';

  if v_row.conversation_id is null
     or not public.society_group_can(v_row.club_id, v_row.team_id, 'view') then
    raise exception 'SOCIETY_GROUP_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'conversation_id', v_row.conversation_id,
    'club_id',         v_row.club_id,
    'club_name',       v_row.club_name,
    'name',            v_row.name,
    'team_id',         v_row.team_id,
    'team_name',       v_row.team_name,
    'avatar_path',     v_row.avatar_path,
    'status',          v_row.status,
    'people_count',    (select count(*) from public.conversation_participants cp
                         where cp.conversation_id = v_row.conversation_id),
    'admin_count',     (select count(*) from public.conversation_participants cp
                         where cp.conversation_id = v_row.conversation_id
                           and cp.member_role = 'admin'),
    'can_open_conversation', exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = v_row.conversation_id and cp.profile_id = v_uid),
    /* DAS-REV-33 non è nella release: nessuna CTA Gestisci (§11, QA-010). */
    'can_manage', false
  );
end;
$$;

revoke all on function public.fetch_society_group_detail(uuid, uuid) from public;
revoke execute on function public.fetch_society_group_detail(uuid, uuid) from anon;
grant execute on function public.fetch_society_group_detail(uuid, uuid) to authenticated;

/**
 * Società in cui l'actor può creare un gruppo in almeno un contesto (§12).
 * Alimenta il launcher di Messaggi e il selector preliminare. Le Società di
 * cui l'actor vede solo la Dashboard senza scope di creazione non compaiono.
 */
create or replace function public.fetch_society_group_create_contexts()
returns table (
  club_id     uuid,
  club_name   text,
  logo_url    text,
  is_verified boolean
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
  select c.id, c.name, c.logo_url, (c.verification_status = 'verified')
  from public.clubs c
  where (
      c.owner_profile_id = v_uid
      or exists (
        select 1 from public.club_member_permissions perm
        where perm.club_id = c.id
          and perm.profile_id = v_uid
          and perm.permission_key = 'groups_create'
      )
    )
    and 'groups_create' = any (public.dashboard_club_capabilities(c.id))
  order by public.footme_normalize_lookup(c.name), c.id;
end;
$$;

revoke all on function public.fetch_society_group_create_contexts() from public;
revoke execute on function public.fetch_society_group_create_contexts() from anon;
grant execute on function public.fetch_society_group_create_contexts() to authenticated;

/**
 * Squadre selezionabili per un nuovo gruppo (§15): reali, non archiviate,
 * della Società, nello scope di creazione, in ordine canonico. Dice anche se
 * «Nessuna squadra» è ammessa.
 */
create or replace function public.fetch_society_group_teams(p_club_id uuid)
returns jsonb
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

  if p_club_id is null
     or not ('groups_create' = any (public.dashboard_club_capabilities(p_club_id))) then
    raise exception 'SOCIETY_GROUPS_NOT_AUTHORIZED';
  end if;

  return jsonb_build_object(
    'can_create_without_team', public.society_group_can(p_club_id, null, 'create'),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object('team_id', t.id, 'team_name', t.name)
                       order by t.sort_order, t.name, t.id)
      from public.club_teams t
      where t.club_id = p_club_id
        and public.club_team_is_assignable(p_club_id, t.id)
        and public.society_group_can(p_club_id, t.id, 'create')
    ), '[]'::jsonb),
    'limits', public.society_group_limits()
  );
end;
$$;

revoke all on function public.fetch_society_group_teams(uuid) from public;
revoke execute on function public.fetch_society_group_teams(uuid) from anon;
grant execute on function public.fetch_society_group_teams(uuid) to authenticated;


-- ============================================================
-- SEZIONE 9 — persone eleggibili (§17, §18, §19)
-- ============================================================

/**
 * Pagina di persone eleggibili e consultabili, creator escluso. Con una
 * squadra di contesto, le persone di quella squadra vengono prima
 * (`in_team`), poi le altre della Società; una persona compare una volta.
 * Solo dati nominativi e di contesto: mai recapiti (§26, QA-079).
 */
create or replace function public.fetch_society_group_people_page(
  p_club_id uuid,
  p_team_id uuid default null,
  p_query   text default null,
  p_cursor  text default null,
  p_limit   integer default 40
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_scope  uuid[];
  v_query  text := nullif(public.footme_normalize_lookup(p_query), '');
  v_limit  integer := least(greatest(coalesce(p_limit, 40), 1), 100);
  v_cursor jsonb := public.society_group_cursor_decode(p_cursor);
  v_rows   jsonb;
  v_more   boolean;
  v_last   jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_club_id is null
     or not ('groups_create' = any (public.dashboard_club_capabilities(p_club_id))) then
    raise exception 'SOCIETY_GROUPS_NOT_AUTHORIZED';
  end if;

  if p_team_id is not null
     and not (public.club_team_is_assignable(p_club_id, p_team_id)
              and public.society_group_can(p_club_id, p_team_id, 'create')) then
    raise exception 'SOCIETY_GROUP_TEAM_UNAVAILABLE';
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, 'groups_create');

  with people as (
    select distinct a.profile_id
    from public.club_member_assignments a
    where a.club_id = p_club_id
      and a.status = 'active'
      and a.profile_id <> v_uid
  ),
  eligible as (
    select
      p.id                                                  as profile_id,
      p.full_name,
      p.avatar_url,
      public.footme_normalize_lookup(p.full_name)           as name_norm,
      public.society_group_person_in_team(p_club_id, p.id, p_team_id)::int as in_team,
      (
        /* Solo un incarico che l'actor può vedere: con scope di squadra
           un ruolo societario o di un'altra squadra non deve trapelare (§18). */
        select public.club_assignment_role_label(a.structured_role_id, a.custom_role_name)
        from public.club_member_assignments a
        where a.club_id = p_club_id and a.profile_id = p.id and a.status = 'active'
          and (v_scope is null or a.team_id = any (v_scope))
        order by (a.team_id is not distinct from p_team_id) desc, a.created_at, a.id
        limit 1
      )                                                     as role_label
    from people x
    join public.profiles p on p.id = x.profile_id
    where public.society_group_person_eligible(p_club_id, p.id)
      and public.society_group_person_visible(p_club_id, p.id, v_scope)
  ),
  filtered as (
    select * from eligible e
    where v_query is null or e.name_norm like '%' || v_query || '%'
  ),
  paged as (
    select *
    from filtered f
    where v_cursor is null
       or (1 - f.in_team, f.name_norm, f.profile_id::text)
          > ((v_cursor ->> 'r')::int, v_cursor ->> 'n', v_cursor ->> 'id')
    order by 1 - f.in_team, f.name_norm, f.profile_id::text
    limit v_limit + 1
  )
  select coalesce(jsonb_agg(to_jsonb(p) order by 1 - p.in_team, p.name_norm, p.profile_id::text),
                  '[]'::jsonb)
  into v_rows
  from paged p;

  v_more := jsonb_array_length(v_rows) > v_limit;

  if v_more then
    v_rows := v_rows - v_limit;
  end if;

  v_last := v_rows -> (jsonb_array_length(v_rows) - 1);

  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'profile_id', r -> 'profile_id',
        'full_name',  r -> 'full_name',
        'avatar_url', r -> 'avatar_url',
        'role_label', r -> 'role_label',
        'in_team',    (r ->> 'in_team')::int = 1) order by ord)
      from jsonb_array_elements(v_rows) with ordinality as e(r, ord)
    ), '[]'::jsonb),
    'next_cursor', case when v_more and v_last is not null then
      public.society_group_cursor_encode(jsonb_build_object(
        'r',  1 - (v_last ->> 'in_team')::int,
        'n',  v_last ->> 'name_norm',
        'id', v_last ->> 'profile_id'))
      else null end,
    /* Totale della squadra, per «Seleziona tutti» (§19). Calcolato sullo
       stesso predicate, senza query: è il perimetro dichiarato. */
    'team_total', case when p_team_id is null then 0 else (
      select count(distinct a.profile_id)::int
      from public.club_member_assignments a
      where a.club_id = p_club_id
        and a.team_id = p_team_id
        and a.status = 'active'
        and a.profile_id <> v_uid
        and public.society_group_person_eligible(p_club_id, a.profile_id)
        and public.society_group_person_visible(p_club_id, a.profile_id, v_scope)
    ) end
  );
end;
$$;

revoke all on function public.fetch_society_group_people_page(uuid, uuid, text, text, integer) from public;
revoke execute on function public.fetch_society_group_people_page(uuid, uuid, text, text, integer) from anon;
grant execute on function public.fetch_society_group_people_page(uuid, uuid, text, text, integer) to authenticated;

/**
 * «Seleziona tutti» (§19): tutti gli ID della squadra, oltre la pagina
 * caricata, con lo stesso predicate. Se il set supera il massimo, rifiuta
 * invece di troncare (§19: «non selezionare arbitrariamente i primi N»).
 * Restituisce una lista definita: chi entra dopo non viene aggiunto.
 */
create or replace function public.fetch_society_group_team_people_ids(
  p_club_id uuid,
  p_team_id uuid
)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_scope uuid[];
  v_ids   uuid[];
  v_max   integer := (public.society_group_limits() ->> 'maxPeople')::int;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_club_id is null or p_team_id is null
     or not ('groups_create' = any (public.dashboard_club_capabilities(p_club_id))) then
    raise exception 'SOCIETY_GROUPS_NOT_AUTHORIZED';
  end if;

  if not (public.club_team_is_assignable(p_club_id, p_team_id)
          and public.society_group_can(p_club_id, p_team_id, 'create')) then
    raise exception 'SOCIETY_GROUP_TEAM_UNAVAILABLE';
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, 'groups_create');

  select coalesce(array_agg(x.profile_id order by x.profile_id), array[]::uuid[])
  into v_ids
  from (
    select distinct a.profile_id
    from public.club_member_assignments a
    where a.club_id = p_club_id
      and a.team_id = p_team_id
      and a.status = 'active'
      and a.profile_id <> v_uid
      and public.society_group_person_eligible(p_club_id, a.profile_id)
      and public.society_group_person_visible(p_club_id, a.profile_id, v_scope)
  ) x;

  if coalesce(array_length(v_ids, 1), 0) > v_max - 1 then
    raise exception 'SOCIETY_GROUP_TOO_MANY_PEOPLE';
  end if;

  return v_ids;
end;
$$;

revoke all on function public.fetch_society_group_team_people_ids(uuid, uuid) from public;
revoke execute on function public.fetch_society_group_team_people_ids(uuid, uuid) from anon;
grant execute on function public.fetch_society_group_team_people_ids(uuid, uuid) to authenticated;


-- ============================================================
-- SEZIONE 10 — Storage dell'avatar (§16)
-- ============================================================

/** Percorso `<club_id>/<asset_id>.<ext>`: cartella valida e actor creatore. */
create or replace function public.society_group_avatar_can_upload(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club uuid;
begin
  begin
    v_club := (storage.foldername(p_name))[1]::uuid;
  exception when others then
    return false;
  end;

  return 'groups_create' = any (public.dashboard_club_capabilities(v_club));
end;
$$;

revoke all on function public.society_group_avatar_can_upload(text) from public;
revoke execute on function public.society_group_avatar_can_upload(text) from anon;
grant execute on function public.society_group_avatar_can_upload(text) to authenticated;

/**
 * Lettura dell'avatar: l'autore di un asset non ancora collegato
 * (anteprima nel wizard), un partecipante del gruppo, o chi vede il gruppo
 * in amministrazione. Nessun accesso club-wide agli asset di bozza.
 */
create or replace function public.society_group_avatar_readable(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_asset public.society_group_avatar_assets;
  v_group public.society_groups;
begin
  if auth.uid() is null then
    return false;
  end if;

  select * into v_asset from public.society_group_avatar_assets a where a.storage_path = p_name;

  if not found then
    return false;
  end if;

  select * into v_group from public.society_groups g where g.avatar_asset_id = v_asset.id;

  if v_group.conversation_id is null then
    return v_asset.created_by = auth.uid();
  end if;

  return exists (
           select 1 from public.conversation_participants cp
           where cp.conversation_id = v_group.conversation_id and cp.profile_id = auth.uid())
      or public.society_group_can(v_group.club_id, v_group.team_id, 'view');
end;
$$;

revoke all on function public.society_group_avatar_readable(text) from public;
revoke execute on function public.society_group_avatar_readable(text) from anon;
grant execute on function public.society_group_avatar_readable(text) to authenticated;

drop policy if exists "society group avatars readable by members and managers" on storage.objects;
create policy "society group avatars readable by members and managers"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'society-group-avatars'
  and public.society_group_avatar_readable(name)
);

drop policy if exists "society group avatars upload by group creators" on storage.objects;
create policy "society group avatars upload by group creators"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'society-group-avatars'
  and public.society_group_avatar_can_upload(name)
);

/* Nessuna policy di update/delete: un file caricato non si sovrascrive, e
   rimuovere l'immagine dal wizard scollega l'asset senza cancellare file. Il
   cleanup degli asset mai collegati è manutenzione (limite dichiarato: non
   esiste ancora un job nel repository). */

/**
 * Lega alla Società un file già caricato. MIME e peso vengono dall'oggetto
 * reale in Storage, non dal client (§16, QA-065, QA-068). Limite dichiarato,
 * come per la locandina: Storage confronta il content-type dichiarato con
 * `allowed_mime_types`; l'ispezione dei byte richiede un servizio esterno.
 */
create or replace function public.register_society_group_avatar(
  p_club_id  uuid,
  p_asset_id uuid,
  p_width    integer,
  p_height   integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_object record;
  v_mime   text;
  v_size   bigint;
  v_asset  public.society_group_avatar_assets;
  v_limit  bigint := (public.society_group_limits() ->> 'avatarMaxBytes')::bigint;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_club_id is null or p_asset_id is null
     or not ('groups_create' = any (public.dashboard_club_capabilities(p_club_id))) then
    raise exception 'SOCIETY_GROUPS_NOT_AUTHORIZED';
  end if;

  select * into v_asset from public.society_group_avatar_assets a where a.id = p_asset_id;

  if found then
    if v_asset.club_id <> p_club_id or v_asset.created_by <> v_uid then
      raise exception 'SOCIETY_GROUP_INVALID:avatar_invalid';
    end if;
  else
    select o.name, o.metadata into v_object
    from storage.objects o
    where o.bucket_id = 'society-group-avatars'
      and o.name in (
        p_club_id::text || '/' || p_asset_id::text || '.jpg',
        p_club_id::text || '/' || p_asset_id::text || '.png',
        p_club_id::text || '/' || p_asset_id::text || '.webp')
      and o.owner_id = v_uid::text
    limit 1;

    if v_object.name is null then
      raise exception 'SOCIETY_GROUP_INVALID:avatar_missing';
    end if;

    v_mime := lower(coalesce(v_object.metadata ->> 'mimetype', ''));
    v_size := coalesce((v_object.metadata ->> 'size')::bigint, 0);

    if v_mime not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'SOCIETY_GROUP_INVALID:avatar_format';
    end if;

    if v_size <= 0 or v_size > v_limit then
      raise exception 'SOCIETY_GROUP_INVALID:avatar_too_large';
    end if;

    if (p_width is not null and (p_width < 1 or p_width > 20000))
       or (p_height is not null and (p_height < 1 or p_height > 20000)) then
      raise exception 'SOCIETY_GROUP_INVALID:avatar_invalid';
    end if;

    insert into public.society_group_avatar_assets
      (id, club_id, storage_path, mime_type, byte_size, width, height, created_by)
    values
      (p_asset_id, p_club_id, v_object.name, v_mime, v_size::int, p_width, p_height, v_uid)
    on conflict (id) do nothing
    returning * into v_asset;

    if v_asset.id is null then
      select * into v_asset from public.society_group_avatar_assets a where a.id = p_asset_id;
    end if;
  end if;

  return jsonb_build_object(
    'asset_id', v_asset.id,
    'path',     v_asset.storage_path);
end;
$$;

revoke all on function public.register_society_group_avatar(uuid, uuid, integer, integer) from public, anon;
grant execute on function public.register_society_group_avatar(uuid, uuid, integer, integer) to authenticated;


-- ============================================================
-- SEZIONE 11 — ricevute di operazione (§23)
-- ============================================================

create table if not exists public.society_group_operations (
  idempotency_key text primary key,
  actor_id        uuid not null references public.profiles(id) on delete cascade,
  club_id         uuid not null,
  operation       text not null,
  fingerprint     text not null,
  /* Nessuna FK: una ricevuta sopravvive alla risorsa. */
  conversation_id uuid not null,
  created_at      timestamptz not null default timezone('utc', now())
);

create index if not exists society_group_operations_actor_idx
  on public.society_group_operations (actor_id, created_at desc);

alter table public.society_group_operations enable row level security;
revoke all on public.society_group_operations from anon, authenticated;

comment on table public.society_group_operations is
  'DAS-REV-32 §23: ricevute della create GROUP. Stessa chiave + stesso payload '
  '= stesso gruppo; stessa chiave + payload diverso = conflitto.';


-- ============================================================
-- SEZIONE 12 — create atomica (§21, §22, §23)
-- ============================================================

/**
 * Crea il gruppo e le membership iniziali in una transazione.
 *
 * Il client manda solo: Società, nome, squadra (nullable), asset opzionale,
 * persone selezionate, chiave. Creator, tipo, stato e ruoli sono derivati
 * qui (§21, QA-093): il creator è `auth.uid()` (la sua PERSON) e diventa
 * ADMIN; gli altri sono MEMBER.
 *
 * Errori controllati (il client li mappa allo step pertinente):
 *   SOCIETY_GROUPS_NOT_AUTHORIZED           → capability o scope assenti
 *   SOCIETY_GROUP_INVALID:name_required     → nome vuoto
 *   SOCIETY_GROUP_INVALID:name_too_long     → oltre nameMax
 *   SOCIETY_GROUP_TEAM_UNAVAILABLE          → squadra non più assegnabile
 *   SOCIETY_GROUP_PEOPLE_REQUIRED           → meno di un'altra PERSON
 *   SOCIETY_GROUP_TOO_MANY_PEOPLE           → oltre maxPeople
 *   SOCIETY_GROUP_PEOPLE_UNAVAILABLE:<ids>  → persone non più eleggibili;
 *                                             gli ID sono già noti al client
 *   SOCIETY_GROUP_INVALID:avatar_invalid    → asset non utilizzabile
 *   OPERATION_CONTENT_CHANGED               → chiave riusata, payload diverso
 */
create or replace function public.create_society_group(
  p_club_id         uuid,
  p_name            text,
  p_team_id         uuid,
  p_avatar_asset_id uuid,
  p_person_ids      uuid[],
  p_operation_key   text,
  p_source          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_limits      jsonb := public.society_group_limits();
  v_name        text;
  v_people      uuid[];
  v_invalid     uuid[];
  v_scope       uuid[];
  v_fingerprint text;
  v_receipt     public.society_group_operations;
  v_asset       public.society_group_avatar_assets;
  v_conv_id     uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_operation_key is null or length(btrim(p_operation_key)) < 8 then
    raise exception 'SOCIETY_GROUP_INVALID:operation_key';
  end if;

  if p_source is not null and p_source not in ('dashboard', 'messages') then
    raise exception 'SOCIETY_GROUP_INVALID:source';
  end if;

  v_name := public.society_group_clean_name(p_name);

  /* Payload canonico: ID deduplicati e ordinati, creator escluso (QA-094).
     L'origine non entra: è navigazione, non contenuto (§12, QA-048). */
  select coalesce(array_agg(distinct x order by x), array[]::uuid[])
  into v_people
  from unnest(coalesce(p_person_ids, array[]::uuid[])) as x
  where x is not null and x <> v_uid;

  v_fingerprint := md5(jsonb_build_object(
    'club',   p_club_id,
    'name',   v_name,
    'team',   p_team_id,
    'avatar', p_avatar_asset_id,
    'people', to_jsonb(v_people)
  )::text);

  /* Una sola esecuzione per chiave alla volta: il secondo tap aspetta il
     primo e poi legge la sua ricevuta. */
  perform pg_advisory_xact_lock(hashtext('society_group_create:' || p_operation_key));

  select * into v_receipt
  from public.society_group_operations
  where idempotency_key = p_operation_key;

  if found then
    if v_receipt.actor_id <> v_uid
       or v_receipt.club_id is distinct from p_club_id
       or v_receipt.fingerprint <> v_fingerprint then
      raise exception 'OPERATION_CONTENT_CHANGED';
    end if;

    /* §23: il recupero rivalida l'accesso corrente. */
    if not exists (
         select 1 from public.conversation_participants cp
         where cp.conversation_id = v_receipt.conversation_id and cp.profile_id = v_uid)
       and not public.society_group_admin_visible(v_receipt.conversation_id) then
      raise exception 'SOCIETY_GROUPS_NOT_AUTHORIZED';
    end if;

    return jsonb_build_object('conversation_id', v_receipt.conversation_id, 'replayed', true);
  end if;

  -- 2-3. Capability e scope, inclusa l'autorizzazione a team_id nullo.
  if p_club_id is null
     or not ('groups_create' = any (public.dashboard_club_capabilities(p_club_id)))
     or not public.society_group_can(p_club_id, p_team_id, 'create') then
    raise exception 'SOCIETY_GROUPS_NOT_AUTHORIZED';
  end if;

  -- 4. Nome.
  if v_name is null then
    raise exception 'SOCIETY_GROUP_INVALID:name_required';
  end if;

  if char_length(v_name) > (v_limits ->> 'nameMax')::int then
    raise exception 'SOCIETY_GROUP_INVALID:name_too_long';
  end if;

  if v_name ~ '[[:cntrl:]]' then
    raise exception 'SOCIETY_GROUP_INVALID:name_invalid';
  end if;

  -- 5. Squadra: bloccata in lettura fino al commit (un archivio concorrente
  --    aspetta, o ha già vinto e la squadra non è più assegnabile).
  if p_team_id is not null then
    perform 1 from public.club_teams t
    where t.id = p_team_id and t.club_id = p_club_id
    for share;

    if not public.club_team_is_assignable(p_club_id, p_team_id) then
      raise exception 'SOCIETY_GROUP_TEAM_UNAVAILABLE';
    end if;
  end if;

  -- 8-9. Minimo e massimo.
  if coalesce(array_length(v_people, 1), 0) < (v_limits ->> 'minPeople')::int - 1 then
    raise exception 'SOCIETY_GROUP_PEOPLE_REQUIRED';
  end if;

  if coalesce(array_length(v_people, 1), 0) + 1 > (v_limits ->> 'maxPeople')::int then
    raise exception 'SOCIETY_GROUP_TOO_MANY_PEOPLE';
  end if;

  -- 7. Eleggibilità attuale di ogni persona, con gli incarichi bloccati in
  --    lettura: una cessazione concorrente non passa a metà del commit.
  perform 1 from public.club_member_assignments a
  where a.club_id = p_club_id
    and a.profile_id = any (v_people)
    and a.status = 'active'
  for share;

  v_scope := public.dashboard_club_capability_scope(p_club_id, 'groups_create');

  select coalesce(array_agg(x order by x), array[]::uuid[])
  into v_invalid
  from unnest(v_people) as x
  where not public.society_group_person_eligible(p_club_id, x)
     or not public.society_group_person_visible(p_club_id, x, v_scope);

  if array_length(v_invalid, 1) is not null then
    raise exception 'SOCIETY_GROUP_PEOPLE_UNAVAILABLE:%', array_to_string(v_invalid, ',');
  end if;

  -- 10. Asset: pronto, della Società, dell'actor, non già collegato.
  if p_avatar_asset_id is not null then
    select * into v_asset
    from public.society_group_avatar_assets a
    where a.id = p_avatar_asset_id
    for update;

    if v_asset.id is null
       or v_asset.club_id <> p_club_id
       or v_asset.created_by <> v_uid
       or exists (select 1 from public.society_groups g where g.avatar_asset_id = v_asset.id) then
      raise exception 'SOCIETY_GROUP_INVALID:avatar_invalid';
    end if;
  end if;

  -- Commit atomico: conversazione, metadata, membership (§22).
  insert into public.conversations (created_by_profile_id, conversation_type, title)
  values (v_uid, 'group', v_name)
  returning id into v_conv_id;

  insert into public.society_groups
    (conversation_id, club_id, team_id, name, name_norm, avatar_asset_id, created_by)
  values
    (v_conv_id, p_club_id, p_team_id, v_name, public.footme_normalize_lookup(v_name),
     p_avatar_asset_id, v_uid);

  /* Finestra della membership (society_group_participant_guard): aperta
     solo su questo conversation_id e solo per gli insert qui sotto. */
  perform set_config('society_groups.creating', v_conv_id::text, true);

  insert into public.conversation_participants (conversation_id, profile_id, member_role)
  values (v_conv_id, v_uid, 'admin');

  insert into public.conversation_participants (conversation_id, profile_id, member_role)
  select v_conv_id, x, 'member'
  from unnest(v_people) as x;

  perform set_config('society_groups.creating', '', true);

  insert into public.society_group_operations
    (idempotency_key, actor_id, club_id, operation, fingerprint, conversation_id)
  values
    (p_operation_key, v_uid, p_club_id, 'create', v_fingerprint, v_conv_id);

  return jsonb_build_object('conversation_id', v_conv_id, 'replayed', false);
end;
$$;

revoke all on function public.create_society_group(uuid, text, uuid, uuid, uuid[], text, text) from public, anon;
grant execute on function public.create_society_group(uuid, text, uuid, uuid, uuid[], text, text) to authenticated;


-- ============================================================
-- SEZIONE 13 — proiezione conversazionale del gruppo (§25)
--
-- Per l'header della chat: richiede la membership, non i permessi Society.
-- ============================================================

create or replace function public.fetch_group_conversation_meta(p_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
  v_row  record;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select cp.member_role into v_role
  from public.conversation_participants cp
  join public.conversations c on c.id = cp.conversation_id
  where cp.conversation_id = p_conversation_id
    and cp.profile_id = v_uid
    and c.conversation_type = 'group';

  if v_role is null then
    raise exception 'Conversazione non trovata';
  end if;

  select c.title, c.avatar_url, g.name, g.club_id, cl.name as club_name,
         a.storage_path as avatar_path
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
    'my_role',         v_role
  );
end;
$$;

revoke all on function public.fetch_group_conversation_meta(uuid) from public, anon;
grant execute on function public.fetch_group_conversation_meta(uuid) to authenticated;


-- ============================================================
-- SEZIONE 14 — Inbox: avatar privato dei gruppi (§12)
--
-- Riscritta da 20260718090600_conversation_archive.sql (ultima definizione)
-- con una sola colonna in più in coda, `group_avatar_path`. Il tipo di
-- ritorno cambia, quindi drop + create. Nessun'altra differenza: ordine,
-- unread e preview restano quelli del core (§12, QA-122).
-- ============================================================

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
  group_avatar_path              text
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
    group_avatar.storage_path                                        as group_avatar_path
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
    order by m.sent_at desc
    limit 1
  ) last_message on true
  left join public.profiles last_message_sender
    on last_message_sender.id = last_message.sender_profile_id
  left join lateral (
    select count(*)::bigint as unread_count
    from public.messages m
    where m.conversation_id = c.id
      and m.sender_profile_id <> v_uid
      and m.sent_at > coalesce(my_participant.last_read_at, '-infinity'::timestamptz)
  ) unread_summary on true
  left join lateral (
    select a.storage_path
    from public.society_groups g
    join public.society_group_avatar_assets a on a.id = g.avatar_asset_id
    where g.conversation_id = c.id
  ) group_avatar on c.conversation_type = 'group'
  where my_participant.profile_id = v_uid
    and (p_include_archived or my_participant.archived_at is null)
  order by coalesce(last_message.sent_at, c.created_at) desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.fetch_inbox_conversations(int, int, boolean) from public;
grant execute on function public.fetch_inbox_conversations(int, int, boolean) to authenticated;
