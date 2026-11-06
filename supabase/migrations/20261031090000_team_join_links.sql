-- ============================================================================
-- DAS-REV-20 — Inviti multipli tramite link
--
-- Una Società emette un **link riutilizzabile** per una sua squadra. Più
-- persone lo aprono, scelgono fra le categorie autorizzate e confermano: il
-- server crea l'incarico senza una seconda approvazione e senza generare una
-- Invitation individuale per ciascuna di loro (§7).
--
-- Oggetti introdotti
--   club_team_join_links          l'autorizzazione riutilizzabile
--   club_team_join_link_handles   il materiale del token, separato dal link
--   club_team_join_redemptions    l'esito dell'uso da parte di una persona
--   club_team_join_link_audit     traccia tecnica delle mutazioni
--
-- Oggetti **estesi** (non duplicati)
--   club_member_assignments       origine, causa di termine e attore
--   club_members                  added_by 'join_link'
--   dashboard_club_capabilities   cinque chiavi nuove
--   club_permission_controls      quattro controlli nuovi nell'area roster
--   guard_team_is_active          un link utilizzabile non nasce su un Team archiviato
--   check_team_deactivation       i link utilizzabili sono un impedimento
--   notifications_before_insert   il tipo di rimozione del ruolo
--
-- Omissioni deliberate
--   • nessun lifecycle oltre ACTIVE → REVOKED: §9 vieta «Riattiva link»;
--   • nessun job di scadenza: la validità si legge dall'orologio server al
--     momento dell'azione (§9);
--   • nessuna Invitation generata dal link (§7): trenta ingressi reali
--     producono trenta redemption, non trenta righe nel Centro Inviti;
--   • nessun `expires_at` di default: §15 fissa Nessuna scadenza e Nessun
--     limite come default reali di prodotto. Il 40 del mockup è una scelta
--     della fixture, non un default.
--
-- Rollback: la migrazione è additiva. Le funzioni ridefinite qui
-- (`dashboard_club_capabilities`, `guard_team_is_active`,
-- `check_team_deactivation`, `notifications_before_insert`) conservano
-- integralmente il comportamento precedente e aggiungono un ramo.
--
-- Convenzioni riusate
--   20261022090000  token sha256, club_relationship_operation_replay/record
--   20261024090000  handle del link in tabella separata, stato derivato
--   20261025090000  catalogo area → controllo → chiave, revisione
--   20261029090000  cutoff esclusivo di scadenza
--   20261030090000  cursore keyset con as_of congelato, accettazione atomica
-- ============================================================================


-- ============================================================
-- SEZIONE 1 — Chiavi di permesso (§8)
--
-- §8 chiede di «distinguere almeno capacità di consultare link, creare link,
-- modificarne scadenza/limite, disattivarli, consultare le persone e
-- rimuovere un incarico», e che «il diritto di gestione link non implichi da
-- solo il diritto di rimuovere persone».
--
-- Le persone collegate si consultano con `roster_view`, che già significa
-- «vedere l'organico»: una sesta chiave per la stessa domanda sarebbe la
-- duplicazione nominale che §8 vieta. Restano cinque chiavi nuove.
--
-- La rimozione dell'incarico è `assignments_remove` e **non** vive nel
-- dominio del link: lo stesso potere serve a terminare un incarico nato da
-- un invito individuale.
-- ============================================================

alter table public.club_member_permissions
  drop constraint if exists club_member_permissions_key_check;

alter table public.club_member_permissions
  add constraint club_member_permissions_key_check check (
    permission_key in (
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
      'assignments_remove'
    )
  );

alter table public.club_admin_role_permissions
  drop constraint if exists club_admin_role_permissions_key_check;

alter table public.club_admin_role_permissions
  add constraint club_admin_role_permissions_key_check check (
    permission_key in (
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
      'assignments_remove'
    )
  );


-- ============================================================
-- SEZIONE 2 — Catalogo dei controlli (§8)
--
-- Le chiavi entrano nell'area `roster_invites`, che è già di ambito TEAM:
-- §8 vuole che «un amministratore limitato alla Primavera riceva dal backend
-- soltanto Team, link, persone, count e azioni autorizzati per la Primavera».
--
-- La revisione del catalogo va incrementata, altrimenti i client che la
-- usano per invalidare la cache dei permessi non vedono i nuovi controlli.
-- ============================================================

insert into public.club_permission_controls
  (id, area_id, label, helper, bundle, requires, sort_order, is_available)
values
  (
    'roster_join_links_read',
    'roster_invites',
    'Vedere i link di invito',
    'Consultare i link della squadra e le persone collegate.',
    'view',
    array['roster_read']::text[],
    40,
    true
  ),
  (
    'roster_join_links_create',
    'roster_invites',
    'Creare link di invito',
    'Generare un link riutilizzabile per la squadra.',
    'manage',
    array['roster_join_links_read']::text[],
    41,
    true
  ),
  (
    'roster_join_links_manage',
    'roster_invites',
    'Gestire i link di invito',
    'Modificare scadenza e limite, oppure disattivare un link.',
    'manage',
    array['roster_join_links_read']::text[],
    42,
    true
  ),
  (
    'roster_assignment_remove',
    'roster_invites',
    'Rimuovere un incarico',
    'Terminare il singolo ruolo di una persona nella squadra.',
    'manage',
    array['roster_read']::text[],
    43,
    true
  )
on conflict (id) do update set
  area_id      = excluded.area_id,
  label        = excluded.label,
  helper       = excluded.helper,
  bundle       = excluded.bundle,
  requires     = excluded.requires,
  sort_order   = excluded.sort_order,
  is_available = excluded.is_available;

insert into public.club_permission_control_keys (control_id, permission_key)
values
  ('roster_join_links_read',   'join_links_view'),
  ('roster_join_links_create', 'join_links_create'),
  ('roster_join_links_manage', 'join_links_manage'),
  ('roster_join_links_manage', 'join_links_revoke'),
  ('roster_assignment_remove', 'assignments_remove')
on conflict do nothing;

/*
 * Revisione del catalogo.
 *
 * Il valore è **assegnato**, non incrementato: una migrazione deve poter
 * essere rieseguita senza cambiare risultato, e `revision + 1` non lo è.
 *
 * Passa da 1 a 2. Il salto copre anche i due controlli aggiunti da
 * DAS-REV-19 (`roster_invite_cancel`, `roster_requests_read`), che erano
 * entrati nel catalogo senza toccare la revisione.
 */
insert into public.app_policy_settings (key, value, description)
values (
  'admin_permission_catalog_revision',
  to_jsonb(2),
  'DAS-REV-14 §7 — revisione della tassonomia aree/controlli/chiavi. Va '
  'incrementata da ogni migrazione che cambia il catalogo.'
)
on conflict (key) do update set value = to_jsonb(2);


-- ============================================================
-- SEZIONE 3 — Capability risolte (§8)
--
-- Le chiavi nuove vanno aggiunte in **tre** punti di questa funzione:
-- l'array dell'Owner, la whitelist del delegato e — implicitamente —
-- l'area del catalogo, che decide se una concessione per singolo Team è
-- ammessa. Fermarsi al CHECK della SEZIONE 1 renderebbe le chiavi
-- concedibili e invisibili a ogni guard: è il difetto che DAS-REV-19 ha
-- dovuto correggere su `positions_publish`.
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
-- SEZIONE 4 — Il link, il token e gli esiti (§7, §17, §39)
--
-- Tre tabelle con tre responsabilità distinte:
--
--   • **link**        l'autorizzazione della Società. Dopo il commit,
--                     Society, Team, categorie, ruoli e custom sono
--                     immutabili (§17): cambiarli cambierebbe il significato
--                     del consenso di chi ha già ricevuto l'URL.
--   • **handle**      il materiale del token, in tabella separata e senza
--                     policy. §17 chiede che l'amministratore autorizzato
--                     possa ricondividere **lo stesso URL**: il solo hash
--                     non basta, quindi accanto al lookup hash resta il
--                     token, leggibile unicamente dalle funzioni definer
--                     che verificano la capability.
--   • **redemption**  l'esito dell'uso da parte di una persona. Esiste
--                     solo per gli ingressi realmente completati: §39
--                     ammette che «un tentativo può non diventare un record
--                     persistente», e un esito già-collegato non consuma
--                     nulla, quindi non ha bisogno di una riga propria.
--
-- Due contatori distinti (§27): `completed_redemptions_count` è storico e
-- non diminuisce mai; `active_connected_people_count` segue gli incarichi
-- correnti. Rimuovere un ruolo abbassa il secondo e lascia il primo.
-- ============================================================

create table if not exists public.club_team_join_links (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  team_id uuid not null references public.club_teams(id) on delete cascade,

  /* Categorie ammesse: sottoinsieme non vuoto dei quattro tipi canonici. */
  allowed_profile_types text[] not null,
  /* Ruoli dirigenziali autorizzati, obbligatori con 'director'. */
  allowed_executive_roles text[] not null default array[]::text[],
  /* Il custom dirigenziale lo definisce la Società, non il destinatario. */
  executive_custom_role_name text,

  status text not null default 'active' check (status in ('active', 'revoked')),

  /*
   * Scadenza (§15).
   *
   * `expires_at` è il cutoff **esclusivo**: l'inizio del giorno locale
   * successivo convertito in UTC. `expires_on` e `expires_timezone`
   * conservano la data concordata e il fuso usato, perché §15 chiede di
   * poterla ripresentare e vieta che un cambio di fuso sposti una scadenza
   * già confermata.
   */
  expires_at timestamptz,
  expires_on date,
  expires_timezone text,

  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  completed_redemptions_count integer not null default 0,
  active_connected_people_count integer not null default 0,

  revision integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,

  constraint club_team_join_links_types_shape check (
    array_length(allowed_profile_types, 1) between 1 and 4
    and allowed_profile_types <@ array['player', 'coach', 'staff', 'director']::text[]
  ),
  constraint club_team_join_links_executive_shape check (
    case
      when 'director' = any (allowed_profile_types)
        then array_length(allowed_executive_roles, 1) >= 1
      else coalesce(array_length(allowed_executive_roles, 1), 0) = 0
           and executive_custom_role_name is null
    end
  ),
  constraint club_team_join_links_expiry_shape check (
    (expires_at is null and expires_on is null and expires_timezone is null)
    or (expires_at is not null and expires_on is not null and expires_timezone is not null)
  ),
  constraint club_team_join_links_revocation_shape check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  ),
  constraint club_team_join_links_counts_shape check (
    completed_redemptions_count >= 0
    and active_connected_people_count >= 0
    and active_connected_people_count <= completed_redemptions_count
  )
);

create index if not exists club_team_join_links_club_idx
  on public.club_team_join_links (club_id, status, created_at desc);
create index if not exists club_team_join_links_revoked_idx
  on public.club_team_join_links (club_id, revoked_at desc)
  where status = 'revoked';
create index if not exists club_team_join_links_team_idx
  on public.club_team_join_links (team_id, status);

alter table public.club_team_join_links enable row level security;

/*
 * §32 chiede che il dettaglio storico resti consultabile e §8 che l'ambito
 * sia deciso dal backend. La lettura passa quindi dalle funzioni definer:
 * una policy di SELECT qui esporrebbe i link di ogni squadra a chiunque
 * abbia accesso alla Società, scavalcando lo scope per Team.
 */
-- Nessuna policy: tabella interna alle funzioni definer.

create table if not exists public.club_team_join_link_handles (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.club_team_join_links(id) on delete cascade,
  /* sha256 esadecimale: è il lookup del resolver pubblico. */
  token_hash text not null unique,
  /*
   * Il token in chiaro. §17: «Il solo hash irreversibile, senza alcun
   * meccanismo sicuro per ricostruire il link, non soddisfa il requisito di
   * ricondivisione.» La tabella non ha policy e nessuna funzione che non
   * verifichi `join_links_view` lo legge; il resolver pubblico interroga
   * esclusivamente `token_hash`.
   */
  token text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists club_team_join_link_handles_link_idx
  on public.club_team_join_link_handles (link_id, created_at desc);

alter table public.club_team_join_link_handles enable row level security;
-- Nessuna policy: gli handle si leggono solo dalle funzioni definer.

create table if not exists public.club_team_join_redemptions (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.club_team_join_links(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  profile_type text not null check (profile_type in ('player', 'coach', 'staff', 'director')),
  structured_role_id text not null references public.club_assignment_roles(id) on delete restrict,
  custom_role_name text,
  membership_id uuid references public.club_members(id) on delete set null,
  assignment_id uuid references public.club_member_assignments(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz not null default timezone('utc', now())
);

/*
 * §21 e §36: «V1 ha una sola redemption completata per persona/link.» È un
 * indice, non un controllo applicativo: due device della stessa persona che
 * confermano insieme devono perdere uno dei due inserimenti, non accordarsi.
 */
create unique index if not exists club_team_join_redemptions_person_unique
  on public.club_team_join_redemptions (link_id, profile_id);
create index if not exists club_team_join_redemptions_link_idx
  on public.club_team_join_redemptions (link_id, completed_at desc, id);
create index if not exists club_team_join_redemptions_assignment_idx
  on public.club_team_join_redemptions (assignment_id)
  where assignment_id is not null;

alter table public.club_team_join_redemptions enable row level security;

create policy "join redemptions readable by the person"
  on public.club_team_join_redemptions for select to authenticated
  using (profile_id = auth.uid());

create table if not exists public.club_team_join_link_audit (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  link_id uuid references public.club_team_join_links(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  operation text not null,
  previous_state text,
  next_state text,
  details jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists club_team_join_link_audit_link_idx
  on public.club_team_join_link_audit (link_id, created_at desc);

alter table public.club_team_join_link_audit enable row level security;

create policy "join link audit readable by owner"
  on public.club_team_join_link_audit for select to authenticated
  using (public.owns_club(club_id));


-- ============================================================
-- SEZIONE 5 — Origine e termine dell'incarico (§35, §36, §39)
--
-- L'incarico sapeva già da quale **invito** nasceva (`source_invite_id`), ma
-- non da quale percorso, né perché è finito. §34 vuole «Entrato tramite»
-- derivato «dalla redemption e dai riferimenti dell'assignment, non
-- ricostruito confrontando il Team»; §36 vuole che la causa societaria resti
-- distinta da quella volontaria.
--
-- `source_type` è nullable: le righe preesistenti nate da un invito vengono
-- qualificate dal backfill, quelle di altra origine restano senza una
-- provenienza inventata (§44: «Se manca la source di un incarico, non
-- inventarla per popolare Persone collegate»).
-- ============================================================

alter table public.club_member_assignments
  add column if not exists source_type text,
  add column if not exists source_join_link_id uuid
    references public.club_team_join_links(id) on delete set null,
  add column if not exists source_redemption_id uuid
    references public.club_team_join_redemptions(id) on delete set null,
  add column if not exists ended_cause text,
  add column if not exists ended_by uuid references public.profiles(id) on delete set null;

alter table public.club_member_assignments
  drop constraint if exists club_member_assignments_source_check;

alter table public.club_member_assignments
  add constraint club_member_assignments_source_check check (
    source_type is null
    or source_type in ('invitation', 'join_link', 'self_request', 'manual')
  );

alter table public.club_member_assignments
  drop constraint if exists club_member_assignments_source_shape;

alter table public.club_member_assignments
  add constraint club_member_assignments_source_shape check (
    case
      when source_type = 'join_link' then source_join_link_id is not null
      else true
    end
  );

alter table public.club_member_assignments
  drop constraint if exists club_member_assignments_ended_cause_check;

alter table public.club_member_assignments
  add constraint club_member_assignments_ended_cause_check check (
    ended_cause is null
    or ended_cause in ('REMOVED_BY_SOCIETY', 'LEFT_BY_USER', 'TEAM_ARCHIVED', 'OTHER')
  );

create index if not exists club_member_assignments_join_link_idx
  on public.club_member_assignments (source_join_link_id, status)
  where source_join_link_id is not null;

/* Backfill: solo ciò che è documentato dalla colonna già esistente. */
update public.club_member_assignments
set source_type = 'invitation'
where source_type is null
  and source_invite_id is not null;

/*
 * §25: una persona che entra da un link deve poter essere distinta, nel
 * modello legacy, da chi è stato inserito a mano o ha fatto richiesta.
 */
alter table public.club_members
  drop constraint if exists club_members_added_by_check;

alter table public.club_members
  add constraint club_members_added_by_check check (
    added_by in ('admin_manual', 'self_request', 'invite_link', 'invitation', 'join_link')
  );


-- ============================================================
-- SEZIONE 6 — Contatori come conseguenza, non come scrittura (§27, §36)
--
-- «La rimozione o cessazione futura dell'incarico diminuisce le persone
-- attive, non gli utilizzi storici.» Il decremento sta in un trigger e non
-- nei chiamanti perché §36 chiede che «se un ruolo originato dal link viene
-- terminato da un altro percorso della Società, il servizio centrale di
-- terminazione applichi la stessa protezione»: un ruolo che finisce per
-- archiviazione della squadra o per scollegamento volontario deve aggiornare
-- il link allo stesso modo della schermata 20.
--
-- L'incremento resta invece nella transazione di redemption: §24 lo vuole
-- «una sola volta» dentro lo stesso commit che crea l'incarico, e un trigger
-- su INSERT non saprebbe distinguere un ingresso nuovo da un incarico
-- equivalente già esistente.
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
    update public.club_team_join_links
    set active_connected_people_count = greatest(0, active_connected_people_count - 1),
        updated_at = timezone('utc', now())
    where id = new.source_join_link_id;
  elsif old.status = 'ended' and new.status = 'active' then
    /*
     * Non previsto dal dominio V1 — un incarico terminato non si riapre —
     * ma se un percorso futuro lo facesse, il contatore non deve restare
     * indietro rispetto alla realtà.
     */
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

drop trigger if exists club_member_assignments_join_link_count
  on public.club_member_assignments;

create trigger club_member_assignments_join_link_count
  after update of status on public.club_member_assignments
  for each row
  when (old.status is distinct from new.status)
  execute function public.club_team_join_link_sync_active_count();

create or replace function public.club_team_join_links_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists club_team_join_links_touch on public.club_team_join_links;

create trigger club_team_join_links_touch
  before update on public.club_team_join_links
  for each row
  execute function public.club_team_join_links_touch();


-- ============================================================
-- SEZIONE 7 — Autorizzazione, tempo e disponibilità (§8, §9, §15)
-- ============================================================

/*
 * Capability ∩ scope per un link (§8).
 *
 * Variante di `member_invite_allows` senza il ramo SOCIETY: §7 fissa che
 * «tutti gli incarichi creati dal link hanno ambito TEAM, anche quelli
 * dirigenziali», quindi la domanda è sempre «questo actor può fare X su
 * questa squadra».
 *
 * Con `p_team_id` nullo la risposta dice soltanto che la chiave è nel
 * perimetro: serve a decidere se mostrare l'ingresso al centro, non ad
 * autorizzare un'operazione su una squadra precisa.
 */
create or replace function public.team_join_link_allows(
  p_club_id uuid,
  p_key     text,
  p_team_id uuid default null
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

  if p_team_id is null then
    return true;
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, p_key);

  return v_scope is null or p_team_id = any (v_scope);
end;
$$;

revoke all on function public.team_join_link_allows(uuid, text, uuid) from public;
grant execute on function public.team_join_link_allows(uuid, text, uuid) to authenticated;

comment on function public.team_join_link_allows(uuid, text, uuid) is
  'DAS-REV-20 §8: capability e scope per un link di squadra. Ambito sempre TEAM.';

/*
 * Etichetta dello scope autorizzato (§10). `null` = nessun limite di
 * squadra; altrimenti il nome quando è una sola, il conteggio quando sono
 * più di una.
 */
create or replace function public.team_join_link_scope_label(
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
  v_name  text;
begin
  if public.owns_club(p_club_id) then
    return null;
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, p_key);

  if v_scope is null then
    return null;
  end if;

  if array_length(v_scope, 1) = 1 then
    select ct.name into v_name
    from public.club_teams ct
    where ct.id = v_scope[1];

    return v_name;
  end if;

  return coalesce(array_length(v_scope, 1), 0)::text || ' squadre';
end;
$$;

revoke all on function public.team_join_link_scope_label(uuid, text) from public;
grant execute on function public.team_join_link_scope_label(uuid, text) to authenticated;

/*
 * Fuso della Società (§15).
 *
 * «Se impostata, il link è valido fino alla fine del giorno scelto nel fuso
 * della Società.» Il modello non porta ancora un fuso per Società: il valore
 * è una policy centrale, non una costante sparsa nel client, e viene
 * **memorizzato sul link** al momento della scelta, così che cambiarlo in
 * seguito non sposti una scadenza già confermata.
 */
insert into public.app_policy_settings (key, value, description)
values (
  'society_default_timezone',
  to_jsonb('Europe/Rome'::text),
  'DAS-REV-20 §15 — fuso usato per calcolare la fine del giorno di scadenza '
  'di un link di invito, quando la Società non ne dichiara uno proprio.'
)
on conflict (key) do nothing;

create or replace function public.society_default_timezone()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select value #>> '{}' from public.app_policy_settings
      where key = 'society_default_timezone'),
    'Europe/Rome'
  );
$$;

revoke all on function public.society_default_timezone() from public;
grant execute on function public.society_default_timezone() to authenticated;

/*
 * Cutoff esclusivo di scadenza (§15).
 *
 * «Una rappresentazione corretta è il limite esclusivo all'inizio del giorno
 * locale successivo convertito in UTC. Gestisci mesi, anni, ora legale e
 * fusi; non calcolare fine giornata aggiungendo sempre 24 ore.»
 *
 * `(data + 1)::timestamp at time zone fuso` fa esattamente questo: il 30
 * settembre scade all'istante che nel fuso indicato è la mezzanotte del
 * 1° ottobre, qualunque sia la durata reale di quel giorno.
 */
create or replace function public.team_join_link_expires_at(
  p_date     date,
  p_timezone text
)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select case
    when p_date is null or p_timezone is null then null
    else ((p_date + 1)::timestamp at time zone p_timezone)
  end;
$$;

revoke all on function public.team_join_link_expires_at(date, text) from public;
grant execute on function public.team_join_link_expires_at(date, text) to authenticated;

/*
 * Disponibilità derivata e precedenza dei motivi (§9).
 *
 * «Precedenza display: REVOKED prima di tutto; poi indisponibilità
 * strutturale di Society/Team; poi scadenza; poi limite.»
 *
 * Il valore restituito è il motivo **da mostrare**, non l'elenco dei
 * vincoli: il dettaglio li espone comunque tutti, perché §9 avverte che
 * «se scadenza e limite sono entrambi invalidi, modificarne uno solo non
 * rende il link disponibile».
 */
create or replace function public.team_join_link_availability(
  p_status         text,
  p_team_archived  boolean,
  p_expires_at     timestamptz,
  p_max            integer,
  p_completed      integer
)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_status = 'revoked' then 'revoked'
    when coalesce(p_team_archived, true) then 'structure'
    when p_expires_at is not null
         and p_expires_at <= timezone('utc', now()) then 'expired'
    when p_max is not null
         and coalesce(p_completed, 0) >= p_max then 'limit_reached'
    else 'available'
  end;
$$;

revoke all on function public.team_join_link_availability(text, boolean, timestamptz, integer, integer) from public;
grant execute on function public.team_join_link_availability(text, boolean, timestamptz, integer, integer) to authenticated, anon;

comment on function public.team_join_link_availability(text, boolean, timestamptz, integer, integer) is
  'DAS-REV-20 §9: motivo di indisponibilita prevalente. Scadenza e limite non sono revoche.';


-- ============================================================
-- SEZIONE 8 — Cursore keyset del centro (§10, §40)
--
-- Stessa forma dei pack precedenti: `as_of` congelato nel cursore e
-- applicato come `created_at <= as_of`, così un link creato mentre si
-- scorre non sposta le pagine. La chiave di ordinamento è testo
-- lessicografico, costruito perché il DESC desiderato sia un ASC reale.
-- ============================================================

create or replace function public.team_join_links_cursor_encode(
  p_club_id  uuid,
  p_tab      text,
  p_team_id  uuid,
  p_as_of    timestamptz,
  p_sort_key text
)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(convert_to(
    'v1|' || p_club_id::text
          || '|' || p_tab
          || '|' || coalesce(p_team_id::text, '-')
          || '|' || (extract(epoch from p_as_of) * 1000)::bigint::text
          || '|' || p_sort_key,
    'utf8'), 'base64');
$$;

create or replace function public.team_join_links_cursor_decode(
  p_cursor     text,
  p_club_id    uuid,
  p_tab        text,
  p_team_id    uuid,
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

    if array_length(v_parts, 1) <> 6
       or v_parts[1] <> 'v1'
       or v_parts[2] <> p_club_id::text
       or v_parts[3] <> p_tab
       or v_parts[4] <> coalesce(p_team_id::text, '-') then
      raise exception 'JOIN_LINKS_CURSOR_INVALID';
    end if;

    as_of    := to_timestamp(v_parts[5]::bigint / 1000.0);
    sort_key := v_parts[6];
  exception
    when others then
      raise exception 'JOIN_LINKS_CURSOR_INVALID';
  end;
end;
$$;

revoke all on function public.team_join_links_cursor_encode(uuid, text, uuid, timestamptz, text) from public;
grant execute on function public.team_join_links_cursor_encode(uuid, text, uuid, timestamptz, text) to authenticated;
revoke all on function public.team_join_links_cursor_decode(text, uuid, text, uuid) from public;
grant execute on function public.team_join_links_cursor_decode(text, uuid, text, uuid) to authenticated;


-- ============================================================
-- SEZIONE 9 — Letture gestionali (§10, §28, §33, §34)
-- ============================================================

/*
 * Composizione del centro (§10).
 *
 * Restituisce **zero righe** quando l'actor non può consultare i link: §41
 * distingue «nessun link» da «non autorizzato», e una lista vuota non deve
 * poter nascere da un rifiuto.
 *
 * Le capability tornano come booleani risolti dal server: §8 vieta di
 * dedurle da un flag admin o dalla presenza del pulsante, e §32 chiede che
 * la rimozione dipenda dalla propria capability e non dal fatto che il link
 * sia ancora attivo.
 */
create or replace function public.fetch_team_join_links_center(p_club_id uuid)
returns table (
  club_id          uuid,
  club_name        text,
  club_logo_url    text,
  club_is_verified boolean,
  can_create       boolean,
  can_manage       boolean,
  can_revoke       boolean,
  can_view_people  boolean,
  can_remove_role  boolean,
  scope_label      text,
  active_count     integer,
  revoked_count    integer,
  access_verified_at timestamptz
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

  if not public.owns_club(p_club_id)
     and not public.club_access_is_active(p_club_id, auth.uid()) then
    raise exception 'JOIN_LINKS_CENTER_NOT_AUTHORIZED';
  end if;

  /* §8 vieta di presentare un rifiuto come elenco vuoto. */
  if not public.team_join_link_allows(p_club_id, 'join_links_view') then
    raise exception 'JOIN_LINKS_CENTER_NOT_AUTHORIZED';
  end if;

  v_scope := case
    when public.owns_club(p_club_id) then null
    else public.dashboard_club_capability_scope(p_club_id, 'join_links_view')
  end;

  return query
  select
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    public.team_join_link_allows(p_club_id, 'join_links_create'),
    public.team_join_link_allows(p_club_id, 'join_links_manage'),
    public.team_join_link_allows(p_club_id, 'join_links_revoke'),
    public.team_join_link_allows(p_club_id, 'roster_view'),
    public.team_join_link_allows(p_club_id, 'assignments_remove'),
    public.team_join_link_scope_label(p_club_id, 'join_links_view'),
    (
      select count(*)::integer
      from public.club_team_join_links l
      where l.club_id = p_club_id
        and l.status = 'active'
        and (v_scope is null or l.team_id = any (v_scope))
    ),
    (
      select count(*)::integer
      from public.club_team_join_links l
      where l.club_id = p_club_id
        and l.status = 'revoked'
        and (v_scope is null or l.team_id = any (v_scope))
    ),
    timezone('utc', now())
  from public.clubs c
  where c.id = p_club_id;
end;
$$;

revoke all on function public.fetch_team_join_links_center(uuid) from public;
grant execute on function public.fetch_team_join_links_center(uuid) to authenticated;

/*
 * Pagina di una tab (§10).
 *
 * «Attivi ordinati per created_at decrescente; Disattivati per revoked_at
 * decrescente. Usa ID stabile come tie-breaker e pagination server-side.»
 *
 * La riga porta **entrambi** i contatori: §27 chiede di non confondere gli
 * utilizzi storici con le persone attualmente collegate, e la riga del
 * centro mostra le seconde.
 */
create or replace function public.fetch_team_join_links_page(
  p_club_id uuid,
  p_tab     text,
  p_cursor  text default null,
  p_limit   integer default 20,
  p_team_id uuid default null
)
returns table (
  link_id            uuid,
  team_id            uuid,
  team_name          text,
  allowed_profile_types text[],
  status             text,
  availability       text,
  active_people      integer,
  completed_uses     integer,
  max_redemptions    integer,
  expires_at         timestamptz,
  created_at         timestamptz,
  revoked_at         timestamptz,
  sort_key           text,
  next_cursor        text,
  as_of              timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tab    text;
  v_limit  integer;
  v_scope  uuid[];
  v_as_of  timestamptz;
  v_after  text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.team_join_link_allows(p_club_id, 'join_links_view') then
    raise exception 'JOIN_LINKS_NOT_AUTHORIZED';
  end if;

  v_tab := case when p_tab = 'revoked' then 'revoked' else 'active' end;
  v_limit := least(greatest(coalesce(p_limit, 20), 1), 50);

  v_scope := case
    when public.owns_club(p_club_id) then null
    else public.dashboard_club_capability_scope(p_club_id, 'join_links_view')
  end;

  if p_cursor is null then
    v_as_of := timezone('utc', now());
    v_after := null;
  else
    select d.as_of, d.sort_key into v_as_of, v_after
    from public.team_join_links_cursor_decode(p_cursor, p_club_id, v_tab, p_team_id) d;
  end if;

  return query
  with keyed as (
    select
      l.id as rec_id,
      l.team_id as tm_id,
      ct.name as tm_name,
      l.allowed_profile_types as apt,
      l.status as st,
      public.team_join_link_availability(
        l.status, ct.is_archived, l.expires_at, l.max_redemptions,
        l.completed_redemptions_count
      ) as av,
      l.active_connected_people_count as act_people,
      l.completed_redemptions_count as done_uses,
      l.max_redemptions as max_uses,
      l.expires_at as exp_at,
      l.created_at as made_at,
      l.revoked_at as rev_at,
      lpad(
        (9999999999999 - (extract(epoch from case
          when v_tab = 'revoked'
            then coalesce(l.revoked_at, l.updated_at, l.created_at)
          else l.created_at
        end) * 1000)::bigint)::text, 13, '0'
      ) || '|' || l.id::text as k
    from public.club_team_join_links l
    join public.club_teams ct on ct.id = l.team_id
    where l.club_id = p_club_id
      and l.status = v_tab
      and l.created_at <= v_as_of
      and (p_team_id is null or l.team_id = p_team_id)
      and (v_scope is null or l.team_id = any (v_scope))
  )
  select
    k.rec_id,
    k.tm_id,
    k.tm_name,
    k.apt,
    k.st,
    k.av,
    k.act_people,
    k.done_uses,
    k.max_uses,
    k.exp_at,
    k.made_at,
    k.rev_at,
    k.k,
    public.team_join_links_cursor_encode(p_club_id, v_tab, p_team_id, v_as_of, k.k),
    v_as_of
  from keyed k
  where v_after is null or k.k > v_after
  order by k.k
  limit v_limit;
end;
$$;

revoke all on function public.fetch_team_join_links_page(uuid, text, text, integer, uuid) from public;
grant execute on function public.fetch_team_join_links_page(uuid, text, text, integer, uuid) to authenticated;

/*
 * Squadre su cui l'actor può creare un link (§11).
 *
 * Nome nuovo, non una `create or replace` di
 * `fetch_member_invite_assignable_teams`: la domanda è diversa — lì «su
 * quale squadra posso assegnare un incarico», qui «su quale posso emettere
 * un link» — e DAS-REV-19 documenta che sostituire la OUT list di una
 * `returns table` esistente fallisce con 42P13.
 *
 * Le affiliate non compaiono: §8 ricorda che «sono Società autonome e non
 * acquisiscono autorità per affiliazione».
 */
create or replace function public.fetch_team_join_link_teams(p_club_id uuid)
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

  if not public.team_join_link_allows(p_club_id, 'join_links_create') then
    raise exception 'JOIN_LINKS_NOT_AUTHORIZED';
  end if;

  v_scope := case
    when public.owns_club(p_club_id) then null
    else public.dashboard_club_capability_scope(p_club_id, 'join_links_create')
  end;

  return query
  select
    ct.id,
    ct.name,
    coalesce(lvl.label, ct.category),
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

revoke all on function public.fetch_team_join_link_teams(uuid) from public;
grant execute on function public.fetch_team_join_link_teams(uuid) to authenticated;

/*
 * Dettaglio del link, disponibile o disattivato (§28, §32).
 *
 * Una sola funzione per i due screen: revocare «non azzera conteggi o
 * impostazioni storiche», quindi il contenuto è lo stesso e cambiano solo le
 * azioni concesse.
 *
 * `can_share` non deriva dallo stato manuale: §39 è esplicito — «Can_share
 * non deve essere dedotto dal solo ACTIVE». Un link scaduto o esaurito è
 * ancora ACTIVE e non va condiviso.
 */
create or replace function public.fetch_team_join_link(p_link_id uuid)
returns table (
  link_id                    uuid,
  club_id                    uuid,
  club_name                  text,
  club_logo_url              text,
  club_is_verified           boolean,
  team_id                    uuid,
  team_name                  text,
  team_category              text,
  allowed_profile_types      text[],
  allowed_executive_roles    text[],
  executive_custom_role_name text,
  status                     text,
  availability               text,
  expires_at                 timestamptz,
  expires_on                 date,
  expires_timezone           text,
  max_redemptions            integer,
  completed_uses             integer,
  active_people              integer,
  created_at                 timestamptz,
  revoked_at                 timestamptz,
  revision                   integer,
  can_share                  boolean,
  can_manage                 boolean,
  can_revoke                 boolean,
  can_view_people            boolean,
  can_remove_role            boolean,
  access_verified_at         timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club  uuid;
  v_team  uuid;
  v_avail text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select l.club_id, l.team_id,
         public.team_join_link_availability(
           l.status, ct.is_archived, l.expires_at,
           l.max_redemptions, l.completed_redemptions_count
         )
  into v_club, v_team, v_avail
  from public.club_team_join_links l
  join public.club_teams ct on ct.id = l.team_id
  where l.id = p_link_id;

  if v_club is null
     or not public.team_join_link_allows(v_club, 'join_links_view', v_team)
  then
    raise exception 'JOIN_LINK_NOT_FOUND';
  end if;

  return query
  select
    l.id,
    l.club_id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    l.team_id,
    ct.name,
    coalesce(lvl.label, ct.category),
    l.allowed_profile_types,
    l.allowed_executive_roles,
    l.executive_custom_role_name,
    l.status,
    v_avail,
    l.expires_at,
    l.expires_on,
    l.expires_timezone,
    l.max_redemptions,
    l.completed_redemptions_count,
    l.active_connected_people_count,
    l.created_at,
    l.revoked_at,
    l.revision,
    v_avail = 'available'
      and public.team_join_link_allows(v_club, 'join_links_create', v_team),
    l.status = 'active'
      and public.team_join_link_allows(v_club, 'join_links_manage', v_team),
    l.status = 'active'
      and public.team_join_link_allows(v_club, 'join_links_revoke', v_team),
    public.team_join_link_allows(v_club, 'roster_view', v_team),
    public.team_join_link_allows(v_club, 'assignments_remove', v_team),
    timezone('utc', now())
  from public.club_team_join_links l
  join public.clubs c on c.id = l.club_id
  join public.club_teams ct on ct.id = l.team_id
  left join public.club_team_seasons cfg
    on cfg.team_id = ct.id and cfg.season_id = public.current_season_id()
  left join public.team_levels lvl on lvl.id = cfg.level_id
  where l.id = p_link_id;
end;
$$;

revoke all on function public.fetch_team_join_link(uuid) from public;
grant execute on function public.fetch_team_join_link(uuid) to authenticated;

/*
 * Materiale di condivisione (§17, §18).
 *
 * «Prevedi una conservazione sicura che consenta agli amministratori
 * autorizzati di ricondividere lo stesso URL» e «Lo share e il copy
 * recuperano il link soltanto con capability valida e disponibilità
 * aggiornata. Non generare nuovo token a ogni tap.»
 *
 * È l'unica funzione che legge il token in chiaro, e lo fa dopo aver
 * verificato capability, scope e disponibilità corrente.
 */
create or replace function public.fetch_team_join_link_share(p_link_id uuid)
returns table (
  link_id       uuid,
  token         text,
  club_name     text,
  team_name     text,
  allowed_profile_types text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club  uuid;
  v_team  uuid;
  v_avail text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select l.club_id, l.team_id,
         public.team_join_link_availability(
           l.status, ct.is_archived, l.expires_at,
           l.max_redemptions, l.completed_redemptions_count
         )
  into v_club, v_team, v_avail
  from public.club_team_join_links l
  join public.club_teams ct on ct.id = l.team_id
  where l.id = p_link_id;

  if v_club is null
     or not public.team_join_link_allows(v_club, 'join_links_view', v_team)
  then
    raise exception 'JOIN_LINK_NOT_FOUND';
  end if;

  /* §8: consultare un link non è poterlo distribuire. Il token vivo è il
     potere di creare incarichi, e appartiene a chi i link li emette. */
  if not public.team_join_link_allows(v_club, 'join_links_create', v_team) then
    raise exception 'JOIN_LINK_SHARE_NOT_AUTHORIZED';
  end if;

  if v_avail <> 'available' then
    raise exception 'JOIN_LINK_NOT_SHAREABLE';
  end if;

  return query
  select
    l.id,
    h.token,
    c.name,
    ct.name,
    l.allowed_profile_types
  from public.club_team_join_links l
  join public.clubs c on c.id = l.club_id
  join public.club_teams ct on ct.id = l.team_id
  join public.club_team_join_link_handles h on h.link_id = l.id
  where l.id = p_link_id
  order by h.created_at desc
  limit 1;
end;
$$;

revoke all on function public.fetch_team_join_link_share(uuid) from public;
grant execute on function public.fetch_team_join_link_share(uuid) to authenticated;


-- ============================================================
-- SEZIONE 10 — Persone collegate e singolo incarico (§33, §34)
--
-- «Carica soltanto persone con incarico attivo derivato da quel link, non
-- chi ha aperto la landing, iniziato signup o ricevuto un invito
-- individuale.» La lista nasce quindi dagli **assignment** correnti e non
-- dalle redemption storiche: §27 avverte che le due misure divergono appena
-- un ruolo viene rimosso.
-- ============================================================

create or replace function public.team_join_people_cursor_encode(
  p_link_id  uuid,
  p_as_of    timestamptz,
  p_sort_key text
)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(convert_to(
    'v1|' || p_link_id::text
          || '|' || (extract(epoch from p_as_of) * 1000)::bigint::text
          || '|' || p_sort_key,
    'utf8'), 'base64');
$$;

create or replace function public.team_join_people_cursor_decode(
  p_cursor     text,
  p_link_id    uuid,
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

    if array_length(v_parts, 1) <> 4
       or v_parts[1] <> 'v1'
       or v_parts[2] <> p_link_id::text then
      raise exception 'JOIN_LINKS_CURSOR_INVALID';
    end if;

    as_of    := to_timestamp(v_parts[3]::bigint / 1000.0);
    sort_key := v_parts[4];
  exception
    when others then
      raise exception 'JOIN_LINKS_CURSOR_INVALID';
  end;
end;
$$;

revoke all on function public.team_join_people_cursor_encode(uuid, timestamptz, text) from public;
grant execute on function public.team_join_people_cursor_encode(uuid, timestamptz, text) to authenticated;
revoke all on function public.team_join_people_cursor_decode(text, uuid) from public;
grant execute on function public.team_join_people_cursor_decode(text, uuid) to authenticated;

create or replace function public.fetch_team_join_link_people_page(
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

  /* §33: la lista è autorizzata separatamente dal link. */
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

  /* §33: «non ricalcolare il count sulla pagina corrente». */
  select count(*)::integer into v_total
  from public.club_member_assignments a
  where a.source_join_link_id = p_link_id
    and a.status = 'active'
    and a.created_at <= v_as_of;

  return query
  with keyed as (
    select
      a.id as rec_id,
      a.profile_id as pr_id,
      p.full_name as pr_name,
      p.avatar_url as pr_avatar,
      public.club_assignment_role_label(a.structured_role_id, a.custom_role_name) as rl_label,
      coalesce(r.completed_at, a.created_at) as joined_at,
      lpad((extract(epoch from coalesce(r.completed_at, a.created_at)) * 1000)::bigint::text, 13, '0')
        || '|' || a.id::text as k
    from public.club_member_assignments a
    join public.profiles p on p.id = a.profile_id
    left join public.club_team_join_redemptions r on r.id = a.source_redemption_id
    where a.source_join_link_id = p_link_id
      and a.status = 'active'
      and a.created_at <= v_as_of
  )
  select
    k.rec_id,
    k.pr_id,
    k.pr_name,
    k.pr_avatar,
    k.rl_label,
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

/*
 * Dettaglio contestuale della persona (§34).
 *
 * «Entrato tramite» viene dalla redemption e dai riferimenti
 * dell'assignment, non dal confronto fra nomi di squadra: l'origine è un
 * dato, non un'inferenza.
 */
create or replace function public.fetch_team_join_link_person(
  p_link_id       uuid,
  p_assignment_id uuid
)
returns table (
  assignment_id   uuid,
  profile_id      uuid,
  person_name     text,
  avatar_url      text,
  role_label      text,
  team_id         uuid,
  team_name       text,
  club_name       text,
  club_logo_url   text,
  club_is_verified boolean,
  source_team_name text,
  source_allowed_profile_types text[],
  connected_at    timestamptz,
  status          text,
  can_remove_role boolean,
  access_verified_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_team uuid;
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

  return query
  select
    a.id,
    a.profile_id,
    p.full_name,
    p.avatar_url,
    public.club_assignment_role_label(a.structured_role_id, a.custom_role_name),
    a.team_id,
    ct.name,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    ct.name,
    l.allowed_profile_types,
    coalesce(r.completed_at, a.created_at),
    a.status,
    a.status = 'active'
      and public.team_join_link_allows(v_club, 'assignments_remove', v_team),
    timezone('utc', now())
  from public.club_member_assignments a
  join public.club_team_join_links l on l.id = a.source_join_link_id
  join public.profiles p on p.id = a.profile_id
  join public.clubs c on c.id = a.club_id
  join public.club_teams ct on ct.id = a.team_id
  left join public.club_team_join_redemptions r on r.id = a.source_redemption_id
  where a.id = p_assignment_id
    and a.source_join_link_id = p_link_id;
end;
$$;

revoke all on function public.fetch_team_join_link_person(uuid, uuid) from public;
grant execute on function public.fetch_team_join_link_person(uuid, uuid) to authenticated;


-- ============================================================
-- SEZIONE 11 — Esito neutro delle proposte soddisfatte altrove (§25)
--
-- «Una proposta individuale o richiesta equivalente già PENDING non deve
-- trasformare un join autorizzato in una nuova coda di approvazione. Se il
-- join la soddisfa, il dominio proprietario deve risolverla come soddisfatta
-- tramite altro percorso … Non fingere ACCEPTED dall'invito originale o
-- APPROVED da un amministratore che non ha compiuto quell'azione.»
--
-- Lo stato non esisteva: si estende il lifecycle del dominio proprietario,
-- non si crea un secondo stato locale dentro il modulo link. I lettori che
-- non lo riconoscono devono trattarlo come terminale e non azionabile — mai
-- come `pending`.
-- ============================================================

alter table public.club_member_invites
  drop constraint if exists club_member_invites_status_check;

alter table public.club_member_invites
  add constraint club_member_invites_status_check check (
    status in ('pending', 'accepted', 'declined', 'cancelled', 'superseded')
  );


-- ============================================================
-- SEZIONE 12 — Generazione del link (§16, §17)
--
-- «Il server genera un ID stabile, stato ACTIVE, timestamp di creazione e
-- riferimento all'actor. La richiesta deve essere idempotente: stesso submit
-- e stesso payload restituiscono lo stesso link; stesso idempotency key con
-- payload differente è rifiutato.»
--
-- Il token in chiaro entra nel risultato memorizzato dalla replay: un retry
-- dopo una risposta persa deve restituire **lo stesso URL**, non coniarne un
-- secondo per lo stesso link.
-- ============================================================

create or replace function public.create_team_join_link(
  p_club_id         uuid,
  p_team_id         uuid,
  p_profile_types   text[],
  p_executive_roles text[] default array[]::text[],
  p_custom_role     text default null,
  p_expires_on      date default null,
  p_max_redemptions integer default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_types       text[];
  v_roles       text[];
  v_custom      text;
  v_tz          text;
  v_expires_at  timestamptz;
  v_archived    boolean;
  v_team_club   uuid;
  v_fingerprint text;
  v_replay      jsonb;
  v_link        uuid;
  v_token       text;
  v_result      jsonb;
  v_unknown     integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.team_join_link_allows(p_club_id, 'join_links_create', p_team_id) then
    raise exception 'JOIN_LINKS_NOT_AUTHORIZED';
  end if;

  /* ---- Normalizzazione del payload ---------------------------------- */

  select array_agg(distinct t order by t) into v_types
  from unnest(coalesce(p_profile_types, array[]::text[])) as t
  where t in ('player', 'coach', 'staff', 'director');

  if v_types is null or array_length(v_types, 1) = 0 then
    raise exception 'JOIN_LINK_CATEGORIES_REQUIRED';
  end if;

  if 'director' = any (v_types) then
    select array_agg(distinct r order by r) into v_roles
    from unnest(coalesce(p_executive_roles, array[]::text[])) as r
    where length(btrim(r)) > 0;

    if v_roles is null or array_length(v_roles, 1) = 0 then
      raise exception 'JOIN_LINK_EXECUTIVE_ROLES_REQUIRED';
    end if;

    /* §13: il catalogo è la tabella condivisa, non una lista del client. */
    select count(*)::integer into v_unknown
    from unnest(v_roles) as r
    where not exists (
      select 1 from public.club_assignment_roles cr
      where cr.id = r and cr.profile_type = 'director' and cr.is_available
    );

    if v_unknown > 0 then
      raise exception 'JOIN_LINK_ROLE_UNAVAILABLE';
    end if;

    if exists (
      select 1 from public.club_assignment_roles cr
      where cr.id = any (v_roles) and cr.is_custom
    ) then
      v_custom := public.normalize_assignment_custom_role(p_custom_role);

      if v_custom is null then
        raise exception 'JOIN_LINK_CUSTOM_ROLE_REQUIRED';
      end if;

      if length(v_custom) > public.club_assignment_custom_role_max() then
        raise exception 'JOIN_LINK_CUSTOM_ROLE_TOO_LONG';
      end if;
    end if;
  else
    /* §13: «Se Dirigenti viene rimosso prima della generazione, escludi
       ruoli e custom dirigenziali dal payload.» */
    v_roles  := array[]::text[];
    v_custom := null;
  end if;

  if p_max_redemptions is not null and p_max_redemptions <= 0 then
    raise exception 'JOIN_LINK_LIMIT_INVALID';
  end if;

  if p_expires_on is not null then
    v_tz := public.society_default_timezone();
    v_expires_at := public.team_join_link_expires_at(p_expires_on, v_tz);

    /* §15: «il giorno corrente è ammesso se non concluso». */
    if v_expires_at <= timezone('utc', now()) then
      raise exception 'JOIN_LINK_EXPIRY_INVALID';
    end if;
  end if;

  /* ---- Idempotenza, prima di qualunque scrittura --------------------- */

  v_fingerprint := md5(
    'create_team_join_link|'
    || p_club_id::text || '|' || p_team_id::text
    || '|' || array_to_string(v_types, ',')
    || '|' || array_to_string(v_roles, ',')
    || '|' || coalesce(lower(v_custom), '')
    || '|' || coalesce(p_expires_on::text, '')
    || '|' || coalesce(p_max_redemptions::text, '')
  );

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, p_club_id, 'create_team_join_link', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  perform public.assert_agent_rate_limit(
    'team_join_link_create', p_club_id::text, 30, interval '1 hour'
  );

  /* ---- Rivalidazione del Team sotto guard ---------------------------- */

  select ct.club_id, ct.is_archived into v_team_club, v_archived
  from public.club_teams ct
  where ct.id = p_team_id
  for share;

  if v_team_club is null or v_team_club <> p_club_id then
    raise exception 'JOIN_LINK_TEAM_INVALID';
  end if;

  if coalesce(v_archived, false) then
    raise exception 'TEAM_NOT_ACTIVE';
  end if;

  /* ---- Creazione ----------------------------------------------------- */

  insert into public.club_team_join_links (
    club_id, team_id, allowed_profile_types, allowed_executive_roles,
    executive_custom_role_name, expires_at, expires_on, expires_timezone,
    max_redemptions, created_by
  )
  values (
    p_club_id, p_team_id, v_types, v_roles,
    v_custom, v_expires_at, p_expires_on, case when v_expires_at is null then null else v_tz end,
    p_max_redemptions, v_uid
  )
  returning id into v_link;

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.club_team_join_link_handles (link_id, token_hash, token, created_by)
  values (v_link, encode(digest(v_token, 'sha256'), 'hex'), v_token, v_uid);

  insert into public.club_team_join_link_audit
    (club_id, link_id, actor_id, operation, previous_state, next_state, details)
  values (
    p_club_id, v_link, v_uid, 'create', null, 'active',
    jsonb_build_object(
      'team_id', p_team_id,
      'profile_types', to_jsonb(v_types),
      'executive_roles', to_jsonb(v_roles),
      'has_custom_role', v_custom is not null,
      'expires_on', p_expires_on,
      'max_redemptions', p_max_redemptions
    )
  );

  v_result := jsonb_build_object(
    'link_id', v_link,
    'token', v_token,
    'revision', 1,
    'already_applied', false
  );

  perform public.club_relationship_operation_record(
    p_idempotency_key, p_club_id, 'create_team_join_link', v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.create_team_join_link(uuid, uuid, text[], text[], text, date, integer, text) from public;
grant execute on function public.create_team_join_link(uuid, uuid, text[], text[], text, date, integer, text) to authenticated;


-- ============================================================
-- SEZIONE 13 — Modifica dei vincoli e disattivazione (§29, §30, §31)
--
-- Scadenza e limite sono **patch indipendenti**: §30 chiede che «patch solo
-- scadenza non sovrascriva limite, categorie o ruoli», e §17 che la
-- configurazione strutturale resti immutabile. Non esiste quindi un update
-- generico del link.
--
-- Nessuna delle due ruota il token, crea un nuovo record o resetta la
-- storia: è lo stesso URL che torna utilizzabile.
-- ============================================================

create or replace function public.update_team_join_link_expiry(
  p_link_id          uuid,
  p_expires_on       date,
  p_expected_revision integer default null,
  p_idempotency_key  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_link       public.club_team_join_links%rowtype;
  v_tz         text;
  v_expires_at timestamptz;
  v_fingerprint text;
  v_replay     jsonb;
  v_result     jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_link
  from public.club_team_join_links
  where id = p_link_id;

  if v_link.id is null
     or not public.team_join_link_allows(v_link.club_id, 'join_links_manage', v_link.team_id)
  then
    raise exception 'JOIN_LINK_NOT_FOUND';
  end if;

  if p_expires_on is not null then
    v_tz := public.society_default_timezone();
    v_expires_at := public.team_join_link_expires_at(p_expires_on, v_tz);

    if v_expires_at <= timezone('utc', now()) then
      raise exception 'JOIN_LINK_EXPIRY_INVALID';
    end if;
  end if;

  v_fingerprint := md5(
    'update_team_join_link_expiry|' || p_link_id::text
    || '|' || coalesce(p_expires_on::text, '')
  );

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, v_link.club_id, 'update_team_join_link_expiry', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  /* Rilettura sotto lock: §30 vuole il vincolo valido **al commit**. */
  select * into v_link
  from public.club_team_join_links
  where id = p_link_id
  for update;

  if v_link.status <> 'active' then
    raise exception 'JOIN_LINK_REVOKED';
  end if;

  if p_expected_revision is not null
     and p_expected_revision is distinct from v_link.revision then
    raise exception 'JOIN_LINK_REVISION_CONFLICT';
  end if;

  if p_expires_on is not null
     and public.team_join_link_expires_at(p_expires_on, public.society_default_timezone())
         <= timezone('utc', now()) then
    raise exception 'JOIN_LINK_EXPIRY_INVALID';
  end if;

  update public.club_team_join_links
  set expires_at       = v_expires_at,
      expires_on       = p_expires_on,
      expires_timezone = case when p_expires_on is null then null else v_tz end,
      revision         = revision + 1
  where id = p_link_id;

  insert into public.club_team_join_link_audit
    (club_id, link_id, actor_id, operation, previous_state, next_state, details)
  values (
    v_link.club_id, p_link_id, v_uid, 'update_expiry',
    coalesce(v_link.expires_on::text, 'none'),
    coalesce(p_expires_on::text, 'none'),
    jsonb_build_object('timezone', v_tz)
  );

  v_result := jsonb_build_object(
    'link_id', p_link_id,
    'revision', v_link.revision + 1,
    'already_applied', false
  );

  perform public.club_relationship_operation_record(
    p_idempotency_key, v_link.club_id, 'update_team_join_link_expiry',
    v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.update_team_join_link_expiry(uuid, date, integer, text) from public;
grant execute on function public.update_team_join_link_expiry(uuid, date, integer, text) to authenticated;

/*
 * Limite utilizzi (§29).
 *
 * «Il nuovo limite numerico deve essere positivo e non inferiore agli
 * utilizzi completati storicamente, riletti sul server al commit … Se nuove
 * redemption portano il consumo da 30 a 31 mentre lo sheet è aperto, un
 * tentativo di salvare 30 viene rifiutato con il nuovo minimo.»
 *
 * Il minimo viaggia nel `detail` dell'eccezione: il client deve poter dire
 * «30 persone hanno già utilizzato questo link» con il numero vero, non con
 * quello che aveva in pagina.
 */
create or replace function public.update_team_join_link_limit(
  p_link_id           uuid,
  p_max_redemptions   integer,
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
  v_link        public.club_team_join_links%rowtype;
  v_fingerprint text;
  v_replay      jsonb;
  v_result      jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_link
  from public.club_team_join_links
  where id = p_link_id;

  if v_link.id is null
     or not public.team_join_link_allows(v_link.club_id, 'join_links_manage', v_link.team_id)
  then
    raise exception 'JOIN_LINK_NOT_FOUND';
  end if;

  if p_max_redemptions is not null and p_max_redemptions <= 0 then
    raise exception 'JOIN_LINK_LIMIT_INVALID';
  end if;

  v_fingerprint := md5(
    'update_team_join_link_limit|' || p_link_id::text
    || '|' || coalesce(p_max_redemptions::text, '')
  );

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, v_link.club_id, 'update_team_join_link_limit', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_link
  from public.club_team_join_links
  where id = p_link_id
  for update;

  if v_link.status <> 'active' then
    raise exception 'JOIN_LINK_REVOKED';
  end if;

  if p_expected_revision is not null
     and p_expected_revision is distinct from v_link.revision then
    raise exception 'JOIN_LINK_REVISION_CONFLICT';
  end if;

  if p_max_redemptions is not null
     and p_max_redemptions < v_link.completed_redemptions_count then
    raise exception 'JOIN_LINK_LIMIT_BELOW_USAGE'
      using detail = v_link.completed_redemptions_count::text;
  end if;

  update public.club_team_join_links
  set max_redemptions = p_max_redemptions,
      revision        = revision + 1
  where id = p_link_id;

  insert into public.club_team_join_link_audit
    (club_id, link_id, actor_id, operation, previous_state, next_state, details)
  values (
    v_link.club_id, p_link_id, v_uid, 'update_limit',
    coalesce(v_link.max_redemptions::text, 'none'),
    coalesce(p_max_redemptions::text, 'none'),
    jsonb_build_object('completed', v_link.completed_redemptions_count)
  );

  v_result := jsonb_build_object(
    'link_id', p_link_id,
    'revision', v_link.revision + 1,
    'already_applied', false
  );

  perform public.club_relationship_operation_record(
    p_idempotency_key, v_link.club_id, 'update_team_join_link_limit',
    v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.update_team_join_link_limit(uuid, integer, integer, text) from public;
grant execute on function public.update_team_join_link_limit(uuid, integer, integer, text) to authenticated;

/*
 * Disattivazione definitiva (§31).
 *
 * «REVOKED non torna ACTIVE. Doppio tap o due amministratori che revocano
 * contemporaneamente convergono sul medesimo esito, senza duplicare
 * eventi.» La seconda revoca non è un errore: restituisce lo stato già
 * confermato con `already_applied`.
 *
 * «Non hard-delete di token, link, redemption o incarichi»: la revoca
 * scrive uno stato, non cancella nulla, e le persone collegate restano.
 */
create or replace function public.revoke_team_join_link(
  p_link_id           uuid,
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
  v_link        public.club_team_join_links%rowtype;
  v_fingerprint text;
  v_replay      jsonb;
  v_result      jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_link
  from public.club_team_join_links
  where id = p_link_id;

  if v_link.id is null
     or not public.team_join_link_allows(v_link.club_id, 'join_links_revoke', v_link.team_id)
  then
    raise exception 'JOIN_LINK_NOT_FOUND';
  end if;

  v_fingerprint := md5('revoke_team_join_link|' || p_link_id::text);

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, v_link.club_id, 'revoke_team_join_link', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_link
  from public.club_team_join_links
  where id = p_link_id
  for update;

  if v_link.status = 'revoked' then
    return jsonb_build_object(
      'link_id', p_link_id,
      'revision', v_link.revision,
      'already_applied', true
    );
  end if;

  if p_expected_revision is not null
     and p_expected_revision is distinct from v_link.revision then
    raise exception 'JOIN_LINK_REVISION_CONFLICT';
  end if;

  update public.club_team_join_links
  set status     = 'revoked',
      revoked_at = timezone('utc', now()),
      revoked_by = v_uid,
      revision   = revision + 1
  where id = p_link_id;

  insert into public.club_team_join_link_audit
    (club_id, link_id, actor_id, operation, previous_state, next_state, details)
  values (
    v_link.club_id, p_link_id, v_uid, 'revoke', 'active', 'revoked',
    jsonb_build_object(
      'completed', v_link.completed_redemptions_count,
      'active_people', v_link.active_connected_people_count
    )
  );

  v_result := jsonb_build_object(
    'link_id', p_link_id,
    'revision', v_link.revision + 1,
    'already_applied', false
  );

  perform public.club_relationship_operation_record(
    p_idempotency_key, v_link.club_id, 'revoke_team_join_link', v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.revoke_team_join_link(uuid, integer, text) from public;
grant execute on function public.revoke_team_join_link(uuid, integer, text) to authenticated;


-- ============================================================
-- SEZIONE 14 — Rimozione del singolo ruolo (§35)
--
-- «Al successo termina esclusivamente l'assignment pertinente con stato
-- equivalente a ENDED, ended_at server-side, causa REMOVED_BY_SOCIETY e
-- actor quando previsto. La causa identifica la decisione societaria sul
-- ruolo, non la cancellazione di tutti i rapporti.»
--
-- Il contatore delle persone attive scende per effetto del trigger della
-- SEZIONE 6, non di una `update` scritta qui: la stessa diminuzione deve
-- valere quando il ruolo finisce per un'altra strada.
-- ============================================================

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
  v_uid         uuid := auth.uid();
  v_link        public.club_team_join_links%rowtype;
  v_assignment  public.club_member_assignments%rowtype;
  v_fingerprint text;
  v_replay      jsonb;
  v_result      jsonb;
  v_other       integer;
  v_role_label  text;
  v_team_name   text;
  v_club_name   text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_link
  from public.club_team_join_links
  where id = p_link_id;

  if v_link.id is null then
    raise exception 'JOIN_LINK_NOT_FOUND';
  end if;

  /*
   * §8: «Il diritto di gestione link non implica da solo il diritto di
   * rimuovere persone.» La capability è la propria, sullo scope del Team.
   */
  if not public.team_join_link_allows(v_link.club_id, 'assignments_remove', v_link.team_id) then
    raise exception 'JOIN_LINK_REMOVE_NOT_AUTHORIZED';
  end if;

  v_fingerprint := md5(
    'end_team_join_link_assignment|' || p_link_id::text || '|' || p_assignment_id::text
  );

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, v_link.club_id, 'end_team_join_link_assignment', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  /*
   * §35: «Non accetta un assignment_id arbitrario fuori dal link o dalla
   * competenza dell'actor. Non fidarsi dell'oggetto caricato all'apertura
   * dello sheet.»
   */
  select * into v_assignment
  from public.club_member_assignments
  where id = p_assignment_id
    and source_join_link_id = p_link_id
  for update;

  if v_assignment.id is null then
    raise exception 'JOIN_LINK_ASSIGNMENT_NOT_FOUND';
  end if;

  if v_assignment.status <> 'active' then
    /* §35: «Se la persona si era già scollegata, non sovrascrivere la causa
       con REMOVED_BY_SOCIETY: rileggi lo stato e informa.» */
    return jsonb_build_object(
      'assignment_id', p_assignment_id,
      'ended_cause', v_assignment.ended_cause,
      'already_applied', true
    );
  end if;

  update public.club_member_assignments
  set status      = 'ended',
      ended_at    = timezone('utc', now()),
      ended_cause = 'REMOVED_BY_SOCIETY',
      ended_by    = v_uid,
      updated_at  = timezone('utc', now())
  where id = p_assignment_id;

  /*
   * §35: «Se altri incarichi sono attivi, la SocietyMembership resta valida.
   * Se non ne rimane nessuno, aggiorna lo stato aggregato della relazione
   * secondo il modello canonico, conservando record e storico.»
   *
   * L'aggiornamento tocca solo le membership nate da un percorso che le
   * governa con gli incarichi: una riga inserita a mano nell'Organico non
   * deve sparire perché un incarico separato è finito.
   */
  select count(*)::integer into v_other
  from public.club_member_assignments a
  where a.membership_id = v_assignment.membership_id
    and a.status = 'active'
    and a.id <> p_assignment_id;

  if v_other = 0 then
    update public.club_members
    set status     = 'removed',
        updated_at = timezone('utc', now())
    where id = v_assignment.membership_id
      and added_by in ('invitation', 'join_link');
  end if;

  select public.club_assignment_role_label(
           v_assignment.structured_role_id, v_assignment.custom_role_name
         ),
         ct.name, c.name
  into v_role_label, v_team_name, v_club_name
  from public.club_teams ct
  join public.clubs c on c.id = ct.club_id
  where ct.id = v_link.team_id;

  /*
   * §38: «Una sola notifica per la mutation confermata; non dichiarare che
   * la persona sia stata rimossa da tutti i ruoli.»
   */
  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    v_assignment.profile_id,
    'roster_assignment_removed',
    v_club_name,
    'Ha rimosso il tuo ruolo' || chr(10) || v_role_label || ' · ' || v_team_name,
    jsonb_build_object(
      'club_id', v_link.club_id,
      'team_id', v_link.team_id,
      'assignment_id', p_assignment_id,
      'role_label', v_role_label,
      'context_label', v_team_name
    )
  );

  insert into public.club_team_join_link_audit
    (club_id, link_id, actor_id, operation, previous_state, next_state, details)
  values (
    v_link.club_id, p_link_id, v_uid, 'end_assignment', 'active', 'ended',
    jsonb_build_object(
      'assignment_id', p_assignment_id,
      'profile_type', v_assignment.profile_type,
      'remaining_active', v_other
    )
  );

  v_result := jsonb_build_object(
    'assignment_id', p_assignment_id,
    'ended_cause', 'REMOVED_BY_SOCIETY',
    'already_applied', false
  );

  perform public.club_relationship_operation_record(
    p_idempotency_key, v_link.club_id, 'end_team_join_link_assignment',
    v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.end_team_join_link_assignment(uuid, uuid, text) from public;
grant execute on function public.end_team_join_link_assignment(uuid, uuid, text) to authenticated;


-- ============================================================
-- SEZIONE 15 — Percorso del destinatario (§19, §21, §23, §24)
--
-- Tre funzioni con tre livelli di fiducia crescenti:
--
--   • `fetch_team_join_link_public`  anonima, pura lettura, contesto
--     minimo. «L'apertura della landing, il prefetch, un crawler, la
--     preview in una chat e il tap Apri invito non consumano utilizzi»
--     (§19): la funzione è `stable` e non può scrivere nemmeno per errore.
--
--   • `resolve_team_join_context`    autenticata. Interseca le categorie
--     del link con l'identità professionale reale e dice che cosa la
--     persona può ancora fare. Non scrive.
--
--   • `redeem_team_join_link`        l'unico consenso che crea il
--     collegamento (§23), in una sola transazione (§24).
--
-- Il resolver pubblico non rivela **perché** un token non è utilizzabile:
-- §26 vieta di esporre revoca, quota o validità del token, e una risposta
-- unica rende l'endpoint non enumerabile.
-- ============================================================

create or replace function public.fetch_team_join_link_public(p_token text)
returns table (
  state                 text,
  club_name             text,
  club_logo_url         text,
  club_is_verified      boolean,
  team_name             text,
  allowed_profile_types text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  v_hash := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');

  return query
  select
    case
      when public.team_join_link_availability(
             l.status, ct.is_archived, l.expires_at,
             l.max_redemptions, l.completed_redemptions_count
           ) = 'available'
        then 'valid'
      else 'unavailable'
    end,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    ct.name,
    l.allowed_profile_types
  from public.club_team_join_link_handles h
  join public.club_team_join_links l on l.id = h.link_id
  join public.clubs c on c.id = l.club_id
  join public.club_teams ct on ct.id = l.team_id
  where h.token_hash = v_hash;

  /*
   * Token sconosciuto: nessuna riga. Il client mostra lo stesso stato di un
   * link revocato, come §26 richiede, e il backend conserva il motivo vero
   * senza divulgarlo.
   */
end;
$$;

revoke all on function public.fetch_team_join_link_public(text) from public;
grant execute on function public.fetch_team_join_link_public(text) to anon, authenticated;

comment on function public.fetch_team_join_link_public(text) is
  'DAS-REV-20 §19: contesto pubblico minimo di un token. Non consuma utilizzi e non rivela il motivo di indisponibilita.';

/*
 * Contesto della PERSON autenticata (§21, §23).
 *
 * «Interseca le categorie autorizzate dal link con quelle realmente
 * disponibili nel profilo secondo il dominio. Non offrire una conversione
 * arbitraria Calciatore→Staff.»
 *
 * Gli stati bloccanti sono distinti perché §36 chiede copy diversi per la
 * rimozione societaria e per il termine volontario, e §26 vuole che
 * «successo, già collegato, storico e indisponibilità» non si confondano.
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
    where a.id = v_prior.assignment_id;
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
 * Consenso e creazione del rapporto (§23, §24, §25).
 *
 * Una sola transazione logica, nell'ordine che §24 impone. Il lock sul link
 * è la sezione critica della quota: «Se due persone tentano l'ultimo
 * ingresso, una sola può consumarlo.» Un contatore client o una GET seguita
 * da scritture separate non proteggerebbe l'ultimo utilizzo.
 *
 * Il client non è fonte di verità per Società, squadra, persona, quota o
 * capability (§39): dal payload arrivano soltanto il token, la categoria e
 * il ruolo scelti, e vengono entrambi riverificati contro il link.
 */
create or replace function public.redeem_team_join_link(
  p_token           text,
  p_profile_type    text,
  p_role_id         text,
  p_custom_role     text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_hash         text;
  v_link_id      uuid;
  v_club_id      uuid;
  v_link         public.club_team_join_links%rowtype;
  v_archived     boolean;
  v_avail        text;
  v_role         text;
  v_catalog      public.club_assignment_roles%rowtype;
  v_custom       text;
  v_prior        public.club_team_join_redemptions%rowtype;
  v_prior_status text;
  v_prior_cause  text;
  v_member       public.club_members%rowtype;
  v_assignment   uuid;
  v_redemption   uuid;
  v_other        integer;
  v_fingerprint  text;
  v_replay       jsonb;
  v_result       jsonb;
  v_owner        uuid;
  v_role_label   text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_hash := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');

  select l.id, l.club_id into v_link_id, v_club_id
  from public.club_team_join_link_handles h
  join public.club_team_join_links l on l.id = h.link_id
  where h.token_hash = v_hash;

  if v_link_id is null then
    raise exception 'JOIN_LINK_UNAVAILABLE';
  end if;

  v_fingerprint := md5(
    'redeem_team_join_link|' || v_link_id::text || '|' || v_uid::text
    || '|' || coalesce(p_profile_type, '')
    || '|' || coalesce(p_role_id, '')
    || '|' || coalesce(lower(public.normalize_assignment_custom_role(p_custom_role)), '')
  );

  /* §25: «Tutti i retry devono essere idempotenti.» */
  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, v_club_id, 'redeem_team_join_link', v_fingerprint
  );

  if v_replay is not null then
    return v_replay;
  end if;

  perform public.assert_agent_rate_limit(
    'team_join_link_redeem', null, 20, interval '1 hour'
  );

  /* ---- Sezione critica: il link è la risorsa contesa ----------------- */

  select * into v_link
  from public.club_team_join_links
  where id = v_link_id
  for update;

  select ct.is_archived into v_archived
  from public.club_teams ct
  where ct.id = v_link.team_id
  for share;

  /*
   * §25: il controllo degli esiti storici precede la quota, «per non
   * mostrare un falso Limite raggiunto causato proprio dall'ultimo uso
   * riuscito dello stesso utente».
   */
  select * into v_prior
  from public.club_team_join_redemptions r
  where r.link_id = v_link.id and r.profile_id = v_uid;

  if v_prior.id is not null then
    select a.status, a.ended_cause,
           public.club_assignment_role_label(a.structured_role_id, a.custom_role_name)
    into v_prior_status, v_prior_cause, v_role_label
    from public.club_member_assignments a
    where a.id = v_prior.assignment_id;

    if v_prior_status = 'active' then
      return jsonb_build_object(
        'outcome', 'already_connected',
        'link_id', v_link.id,
        'assignment_id', v_prior.assignment_id,
        'role_label', v_role_label,
        'already_applied', true
      );
    end if;

    /* §36: un retry storico non riattiva un incarico concluso. */
    raise exception '%', case
      when v_prior_cause = 'REMOVED_BY_SOCIETY' then 'JOIN_LINK_REENTRY_BLOCKED'
      else 'JOIN_LINK_CONNECTION_ENDED'
    end;
  end if;

  v_avail := public.team_join_link_availability(
    v_link.status, v_archived, v_link.expires_at,
    v_link.max_redemptions, v_link.completed_redemptions_count
  );

  if v_avail <> 'available' then
    raise exception 'JOIN_LINK_UNAVAILABLE';
  end if;

  /* ---- Categoria e ruolo, riverificati contro il link ---------------- */

  if p_profile_type is null or not (p_profile_type = any (v_link.allowed_profile_types)) then
    raise exception 'JOIN_LINK_CATEGORY_NOT_ALLOWED';
  end if;

  select p.role into v_role from public.profiles p where p.id = v_uid;

  /* §21: nessuna conversione arbitraria dell'identità professionale. */
  if v_role is distinct from p_profile_type then
    raise exception 'JOIN_LINK_PROFILE_INCOMPATIBLE';
  end if;

  select * into v_catalog
  from public.club_assignment_roles cr
  where cr.id = p_role_id and cr.is_available;

  if v_catalog.id is null or v_catalog.profile_type <> p_profile_type then
    raise exception 'JOIN_LINK_ROLE_UNAVAILABLE';
  end if;

  if p_profile_type = 'director' then
    /* §22: «Le opzioni vengono filtrate dal backend, non soltanto nascoste
       dal client.» */
    if not (p_role_id = any (v_link.allowed_executive_roles)) then
      raise exception 'JOIN_LINK_ROLE_NOT_ALLOWED';
    end if;

    /* §22: «Il destinatario sceglie un solo ruolo e non può modificare il
       custom del link.» */
    v_custom := case when v_catalog.is_custom then v_link.executive_custom_role_name end;
  elsif v_catalog.is_custom then
    v_custom := public.normalize_assignment_custom_role(p_custom_role);

    if v_custom is null then
      raise exception 'JOIN_LINK_CUSTOM_ROLE_REQUIRED';
    end if;

    if length(v_custom) > public.club_assignment_custom_role_max() then
      raise exception 'JOIN_LINK_CUSTOM_ROLE_TOO_LONG';
    end if;
  else
    v_custom := null;
  end if;

  /* ---- Relazione Persona↔Società: riusata, mai duplicata ------------- */

  select * into v_member
  from public.club_members
  where club_id = v_link.club_id and profile_id = v_uid
  for update;

  if v_member.id is null then
    /*
     * `club_members_unique_profile` resta la verità: due link diversi
     * riscattati insieme dalla stessa persona nella stessa Società
     * arrivano entrambi qui senza trovare la riga. Il perdente non
     * fallisce — rilegge quella appena creata e la riusa (§25: «La
     * relazione Persona–Società può essere riusata»).
     */
    begin
      insert into public.club_members
        (club_id, profile_id, member_role, status, added_by, team_id, is_current)
      values
        (v_link.club_id, v_uid, p_profile_type, 'active', 'join_link', v_link.team_id, true)
      returning * into v_member;
    exception
      when unique_violation then
        select * into v_member
        from public.club_members
        where club_id = v_link.club_id and profile_id = v_uid
        for update;
    end;
  end if;

  if v_member.status <> 'active' then
    update public.club_members
    set status = 'active', updated_at = timezone('utc', now())
    where id = v_member.id;

    v_member.status := 'active';
  end if;

  /* ---- L'incarico, con l'equivalenza decisa dall'indice -------------- */

  insert into public.club_member_assignments (
    club_id, membership_id, profile_id, profile_type, structured_role_id,
    custom_role_name, scope_type, team_id, status, source_type, source_join_link_id
  )
  values (
    v_link.club_id, v_member.id, v_uid, p_profile_type, p_role_id,
    v_custom, 'team', v_link.team_id, 'active', 'join_link', v_link.id
  )
  on conflict do nothing
  returning id into v_assignment;

  if v_assignment is null then
    /*
     * §25: «Incarico equivalente attivo, creato prima da altro
     * percorso/link → Collegamento già completato; riusa il risultato senza
     * attribuire l'ingresso a questo link.» Nessun contatore, nessuna
     * redemption, nessuna sovrascrittura della source originaria.
     */
    select a.id,
           public.club_assignment_role_label(a.structured_role_id, a.custom_role_name)
    into v_assignment, v_role_label
    from public.club_member_assignments a
    where a.club_id = v_link.club_id
      and a.profile_id = v_uid
      and a.profile_type = p_profile_type
      and a.structured_role_id = p_role_id
      and coalesce(lower(a.custom_role_name), '') = coalesce(lower(v_custom), '')
      and a.scope_type = 'team'
      and a.team_id = v_link.team_id
      and a.status = 'active';

    v_result := jsonb_build_object(
      'outcome', 'already_connected',
      'link_id', v_link.id,
      'assignment_id', v_assignment,
      'role_label', v_role_label,
      'already_applied', false
    );

    insert into public.club_team_join_link_audit
      (club_id, link_id, actor_id, operation, previous_state, next_state, details)
    values (
      v_link.club_id, v_link.id, v_uid, 'redeem', null, 'already_connected',
      jsonb_build_object('profile_type', p_profile_type)
    );

    perform public.club_relationship_operation_record(
      p_idempotency_key, v_link.club_id, 'redeem_team_join_link', v_fingerprint, v_result
    );

    return v_result;
  end if;

  insert into public.club_team_join_redemptions (
    link_id, club_id, profile_id, profile_type, structured_role_id,
    custom_role_name, membership_id, assignment_id
  )
  values (
    v_link.id, v_link.club_id, v_uid, p_profile_type, p_role_id,
    v_custom, v_member.id, v_assignment
  )
  returning id into v_redemption;

  update public.club_member_assignments
  set source_redemption_id = v_redemption
  where id = v_assignment;

  /* §24: la quota si incrementa una sola volta, nello stesso commit. */
  update public.club_team_join_links
  set completed_redemptions_count   = completed_redemptions_count + 1,
      active_connected_people_count = active_connected_people_count + 1
  where id = v_link.id;

  /* §21/§25: l'incarico è l'unico attivo? allora la proiezione legacy. */
  select count(*)::integer into v_other
  from public.club_member_assignments a
  where a.membership_id = v_member.id
    and a.status = 'active'
    and a.id <> v_assignment;

  v_role_label := public.club_assignment_role_label(p_role_id, v_custom);

  if v_other = 0 then
    update public.club_members
    set member_role = p_profile_type,
        team_id     = v_link.team_id,
        staff_title = case
          when p_profile_type in ('staff', 'director') then v_role_label
        end,
        updated_at  = timezone('utc', now())
    where id = v_member.id;
  end if;

  /*
   * §25: una proposta equivalente ancora pending è **soddisfatta altrove**,
   * non accettata da qualcuno. Lo stato è terminale e neutro, con il
   * riferimento all'incarico e il timestamp.
   */
  update public.club_member_invites
  set status        = 'superseded',
      resolved_at   = timezone('utc', now()),
      assignment_id = v_assignment,
      membership_id = v_member.id,
      revision      = revision + 1
  where club_id = v_link.club_id
    and invitee_profile_id = v_uid
    and status = 'pending'
    and profile_type = p_profile_type
    and coalesce(structured_role_id, '') = p_role_id
    and coalesce(lower(custom_role_name), '') = coalesce(lower(v_custom), '')
    and scope_type = 'team'
    and team_id = v_link.team_id;

  select c.owner_profile_id into v_owner
  from public.clubs c where c.id = v_link.club_id;

  if v_owner is not null and v_owner <> v_uid then
    insert into public.notifications (recipient_profile_id, type, title, body, data)
    select
      v_owner,
      'member_joined',
      p.full_name,
      'Si è collegato tramite un link di invito' || chr(10)
        || v_role_label || ' · ' || ct.name,
      jsonb_build_object(
        'club_id', v_link.club_id,
        'team_id', v_link.team_id,
        'join_link_id', v_link.id,
        'assignment_id', v_assignment
      )
    from public.profiles p
    cross join public.club_teams ct
    where p.id = v_uid and ct.id = v_link.team_id;
  end if;

  insert into public.club_team_join_link_audit
    (club_id, link_id, actor_id, operation, previous_state, next_state, details)
  values (
    v_link.club_id, v_link.id, v_uid, 'redeem', null, 'completed',
    jsonb_build_object(
      'profile_type', p_profile_type,
      'has_custom_role', v_custom is not null,
      'completed', v_link.completed_redemptions_count + 1
    )
  );

  v_result := jsonb_build_object(
    'outcome', 'completed',
    'link_id', v_link.id,
    'assignment_id', v_assignment,
    'redemption_id', v_redemption,
    'role_label', v_role_label,
    'already_applied', false
  );

  perform public.club_relationship_operation_record(
    p_idempotency_key, v_link.club_id, 'redeem_team_join_link', v_fingerprint, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.redeem_team_join_link(text, text, text, text, text) from public;
grant execute on function public.redeem_team_join_link(text, text, text, text, text) to authenticated;


-- ============================================================
-- SEZIONE 16 — Integrazione con il lifecycle del Team (§37)
--
-- «Integra i link realmente utilizzabili per creare nuovi incarichi fra le
-- attività da gestire prima della disattivazione Team. Non contare tutti i
-- link esistenti come blocker: REVOKED, esauriti o scaduti non sono inviti
-- attualmente utilizzabili.»
--
-- Il guard è deliberatamente stretto: vieta di **creare** un link su una
-- squadra archiviata e di **ripristinarne la disponibilità** cambiando
-- scadenza o limite. Non tocca la revoca né l'aggiornamento dei contatori,
-- che devono continuare a funzionare su una squadra ormai inattiva.
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
-- SEZIONE 17 — Notifiche (§38)
--
-- «Per la rimozione del ruolo utilizza il normale evento di fine incarico e
-- la notifica personale pertinente del dominio, con tono neutro.»
--
-- Il tipo va aggiunto a **entrambe** le scale della funzione: senza la
-- seconda la notifica cadrebbe in `sistema` e sfuggirebbe alle preferenze.
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
