-- ============================================================
-- DAS-REV-14 — Ruoli, permessi, scope e ownership
--
-- DAS-REV-13 ha introdotto il **nome** di un ruolo su chiavi che esistevano
-- già. Qui quel nome diventa configurabile: la Società sceglie quali aree il
-- ruolo abilita, con quale livello, e con quale granularità. Restano fuori
-- dal ruolo l'**ambito** (che appartiene alla membership) e l'**ownership**
-- (che è una relazione protetta della Società).
--
-- Quattro domini distinti, come impone §5 della specifica:
--
--   Ruolo      → `club_admin_roles`            (nome + configurazione)
--   Permessi   → `club_admin_role_permissions` (chiavi reali, nessun enum nuovo)
--   Ambito     → `club_admin_memberships(.scope_mode)` + `_membership_teams`
--   Ownership  → `clubs.owner_profile_id`      (relazione protetta, non un ruolo)
--
-- Nessun permission engine parallelo (§3): l'autorizzazione effettiva resta
-- righe di `club_member_permissions`, con la stessa semantica di `team_id`
-- che ogni modulo già interroga. Questa migrazione aggiunge il **catalogo**
-- che descrive quelle chiavi in termini umani, i comandi che le riscrivono in
-- modo atomico, e le protezioni dell'Owner.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — Chiavi nuove (§6)
--
-- §6: «Distinguere almeno lettura ruoli, creazione/modifica ruoli, lettura
-- amministratori, cambio ruolo, modifica scope, revoca amministratore,
-- lettura/annullamento inviti e trasferimento ownership. Riutilizza i nomi
-- tecnici già canonici. Non dedurre tutte queste facoltà da un generico
-- booleano admin.»
--
-- DAS-REV-13 aveva già `admins_view`, `admin_invites_view`, `admins_invite`,
-- `admin_roles_view`. Mancavano cinque facoltà che §6 vuole separate, più la
-- **lettura** dei dati societari: oggi è derivata («Owner oppure scope
-- societario»), e senza una chiave propria un ruolo non potrebbe concedere
-- «Dati della società → Visualizza» che il mockup mostra nello screen 03.
--
-- Il trasferimento di ownership **non** è una chiave e non lo diventerà:
-- §18 lo riserva all'Owner corrente, e una chiave sarebbe esattamente il
-- modo di farlo finire dentro un bundle Gestisci.
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
    -- gruppo Amministratori (DAS-REV-13 §23)
    'admins_view',
    'admin_invites_view',
    'admins_invite',
    'admin_roles_view',
    -- gruppo Amministratori (DAS-REV-14 §6) — nuove
    'admin_roles_manage',
    'admins_assign_role',
    'admins_manage_scope',
    'admins_revoke',
    'admin_invites_cancel',
    -- lettura dei dati societari (DAS-REV-14 §7) — nuova
    'society_profile_view'
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
    'dashboard_view', 'positions_view', 'positions_create', 'applications_view',
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
    'society_profile_view'
  ));


-- ============================================================
-- SEZIONE 2 — Catalogo centrale delle aree (§7)
--
-- «Le aree provengono da un catalogo server/configurazione centrale, con ID
-- stabili, label localizzate, ordine, disponibilità, bundle, capability,
-- dipendenze e revisione. Non duplicare enum fra i client.»
--
-- Tre livelli, non due, perché il mockup ne mostra tre:
--
--   area     → la riga dell'editor ("Candidature e Shortlist")
--   controllo→ la checkbox del livello granulare ("Aggiorna stato candidatura")
--   chiave   → la capability reale letta dai moduli (`shortlist_edit_status`)
--
-- Il controllo esiste perché una singola azione umana può richiedere più
-- chiavi tecniche: "Aggiungi candidati a Shortlist" ne vuole due. §12 vieta
-- di «separare/accorpare arbitrariamente poteri tecnici per far coincidere un
-- esempio con un'API differente»: qui la mappatura è dichiarata, centrale e
-- verificabile, non inventata dalla UI.
--
-- Il catalogo è **globale**, non per Società: le capability che i moduli
-- leggono sono le stesse ovunque. Ciò che è per Società è la
-- *configurazione* (quali controlli un ruolo abilita), e quella vive in
-- `club_admin_role_permissions`.
-- ============================================================

create table if not exists public.club_permission_areas (
  id          text primary key,
  label       text not null,
  description text,
  sort_order  integer not null default 0,
  /* §17: «Le funzioni esclusivamente societarie mantengono la propria
     semantica. Se un ruolo concede Gestisci dati della società, quel potere
     riguarda AC Como anche quando l'amministratore ha uno scope sportivo
     Primavera.»

     `society` → le chiavi dell'area si materializzano sempre con
                 `team_id is null`, anche con Ambito selettivo.
     `team`    → le chiavi seguono l'ambito: una riga per squadra.

     Non è un allargamento mascherato: un'area societaria **è** societaria, e
     fingere un filtro per squadra su «Dati della società» sarebbe esattamente
     il «finto limite al Team» che QA-61 vieta. */
  scope_kind  text not null default 'team'
    check (scope_kind in ('team', 'society')),
  /* §7: «Non mostrare funzioni non disponibili né campi Store placeholder.»
     Un'area non disponibile non viene offerta, ma le configurazioni che la
     referenziano restano intatte. */
  is_available boolean not null default true
);

create table if not exists public.club_permission_controls (
  id          text primary key,
  area_id     text not null references public.club_permission_areas(id) on delete cascade,
  label       text not null,
  /* Helper breve del livello granulare: §12 chiede «helper breve come
     "Necessario per aggiornare lo stato"» su una dipendenza bloccata. */
  helper      text,
  /* `view`  → entra nel bundle Visualizza **e** in Gestisci (§7: «Gestisci =
                normali azioni gestionali **e letture necessarie**»).
     `manage`→ entra solo in Gestisci. */
  bundle      text not null check (bundle in ('view', 'manage')),
  /* Dipendenze obbligatorie, come id di altri controlli della stessa area.
     §12: «Attivare una capability seleziona anche le dipendenze
     obbligatorie … Non consentire edit senza read.» */
  requires    text[] not null default array[]::text[],
  sort_order  integer not null default 0,
  is_available boolean not null default true
);

create index if not exists club_permission_controls_area_idx
  on public.club_permission_controls (area_id, sort_order, id);

create table if not exists public.club_permission_control_keys (
  control_id     text not null references public.club_permission_controls(id) on delete cascade,
  permission_key text not null,
  primary key (control_id, permission_key)
);

create index if not exists club_permission_control_keys_key_idx
  on public.club_permission_control_keys (permission_key);

alter table public.club_permission_areas enable row level security;
alter table public.club_permission_controls enable row level security;
alter table public.club_permission_control_keys enable row level security;

/* Il catalogo è descrittivo e identico per tutti: leggerlo non rivela nulla
   di una Società. Le **configurazioni**, che sono il dato sensibile, restano
   dietro le RPC definer. */
drop policy if exists "authenticated read permission areas" on public.club_permission_areas;
create policy "authenticated read permission areas"
  on public.club_permission_areas for select to authenticated using (true);

drop policy if exists "authenticated read permission controls" on public.club_permission_controls;
create policy "authenticated read permission controls"
  on public.club_permission_controls for select to authenticated using (true);

drop policy if exists "authenticated read permission control keys" on public.club_permission_control_keys;
create policy "authenticated read permission control keys"
  on public.club_permission_control_keys for select to authenticated using (true);


-- ── Contenuto del catalogo ──────────────────────────────────────────────────
--
-- Ogni chiave sotto **esiste già** nel CHECK ed è già letta da un modulo
-- reale del prodotto, tranne le sei introdotte nella sezione 1, che sono
-- cablate nelle RPC di questo file e nei predicati della sezione 5. §2 vieta
-- di «esporre una finta area utilizzabile»: nessuna riga qui descrive una
-- funzione che non esiste.
--
-- Lo Store resta sospeso (§2) e non ha un'area. `notif_store_orders` resta
-- una chiave valida e una configurazione che la contenesse non verrebbe
-- cancellata, ma non è offerta da nessun controllo.

insert into public.club_permission_areas
  (id, label, description, sort_order, scope_kind, is_available) values
  ('teams_seasons',  'Squadre e stagioni',      'Squadre interne, rose e stagioni.',               1, 'team',    true),
  ('positions',      'Posizioni aperte',        'Ricerche pubblicate dalla società.',              2, 'team',    true),
  ('applications',   'Candidature e Shortlist', 'Candidature ricevute e liste di scouting.',       3, 'team',    true),
  ('roster_invites', 'Inviti e organico',       'Inviti all''organico e composizione delle rose.', 4, 'team',    true),
  ('content',        'Gruppi e comunicazioni',  'Contenuti e comunicazioni della società.',        5, 'team',    true),
  ('society_data',   'Dati della società',      'Anagrafica, identità e profilo pubblico.',        6, 'society', true),
  ('network',        'Società collegate',       'Collegamenti e richieste fra società.',           7, 'society', true),
  ('admins',         'Amministratori e permessi', 'Accessi amministrativi, inviti e ruoli.',       8, 'society', true)
on conflict (id) do update
  set label        = excluded.label,
      description  = excluded.description,
      sort_order   = excluded.sort_order,
      scope_kind   = excluded.scope_kind,
      is_available = excluded.is_available;

insert into public.club_permission_controls
  (id, area_id, label, helper, bundle, requires, sort_order, is_available) values
  -- Squadre e stagioni
  ('teams_read',      'teams_seasons', 'Visualizza squadre e stagioni', null,
     'view',   array[]::text[],              1, true),
  ('teams_write',     'teams_seasons', 'Crea e modifica squadre', 'Necessario per visualizzare le squadre',
     'manage', array['teams_read'],          2, true),
  ('seasons_write',   'teams_seasons', 'Gestisci stagioni e storico', 'Necessario per visualizzare le squadre',
     'manage', array['teams_read'],          3, true),
  ('teams_lifecycle', 'teams_seasons', 'Disattiva e riattiva squadre', 'Necessario per visualizzare le squadre',
     'manage', array['teams_read'],          4, true),
  -- Posizioni aperte
  ('positions_read',  'positions', 'Visualizza posizioni aperte', null,
     'view',   array[]::text[],              1, true),
  ('positions_write', 'positions', 'Crea e gestisci posizioni', 'Necessario per visualizzare le posizioni',
     'manage', array['positions_read'],      2, true),
  -- Candidature e Shortlist (livello granulare del mockup, screen 05)
  ('applications_read',     'applications', 'Visualizza candidature', null,
     'view',   array[]::text[],              1, true),
  ('applications_status',   'applications', 'Aggiorna stato candidatura', 'Necessario per aggiornare lo stato',
     'manage', array['applications_read'],   2, true),
  ('shortlist_add',         'applications', 'Aggiungi candidati a Shortlist', 'Necessario per aggiungere candidati',
     'manage', array['applications_read'],   3, true),
  ('shortlist_remove',      'applications', 'Rimuovi candidati da Shortlist', 'Necessario per rimuovere candidati',
     'manage', array['applications_read'],   4, true),
  ('shortlist_lists',       'applications', 'Crea e gestisci Shortlist', 'Necessario per gestire le liste',
     'manage', array['applications_read'],   5, true),
  -- Inviti e organico
  ('roster_read',     'roster_invites', 'Visualizza organico e inviti', null,
     'view',   array[]::text[],              1, true),
  ('roster_invite',   'roster_invites', 'Invita persone nell''organico', 'Necessario per visualizzare l''organico',
     'manage', array['roster_read'],         2, true),
  -- Gruppi e comunicazioni
  ('content_read',    'content', 'Visualizza contenuti e comunicazioni', null,
     'view',   array[]::text[],              1, true),
  ('content_write',   'content', 'Crea e pubblica contenuti', 'Necessario per visualizzare i contenuti',
     'manage', array['content_read'],        2, true),
  -- Dati della società
  ('society_read',    'society_data', 'Visualizza i dati della società', null,
     'view',   array[]::text[],              1, true),
  ('society_write',   'society_data', 'Modifica i dati della società', 'Necessario per visualizzare i dati',
     'manage', array['society_read'],        2, true),
  -- Società collegate
  ('network_read',    'network', 'Visualizza collegamenti e richieste', null,
     'view',   array[]::text[],              1, true),
  ('network_write',   'network', 'Gestisci collegamenti e richieste', 'Necessario per visualizzare i collegamenti',
     'manage', array['network_read'],        2, true),
  -- Amministratori e permessi
  ('admins_read',     'admins', 'Visualizza amministratori, inviti e ruoli', null,
     'view',   array[]::text[],              1, true),
  ('admins_invite',   'admins', 'Invita amministratori e annulla inviti', 'Necessario per visualizzare gli amministratori',
     'manage', array['admins_read'],         2, true),
  ('admins_access',   'admins', 'Cambia ruolo e ambito degli amministratori', 'Necessario per visualizzare gli amministratori',
     'manage', array['admins_read'],         3, true),
  ('admins_revoke',   'admins', 'Revoca l''accesso di un amministratore', 'Necessario per visualizzare gli amministratori',
     'manage', array['admins_read'],         4, true),
  ('admins_roles',    'admins', 'Crea e modifica i ruoli', 'Necessario per visualizzare i ruoli',
     'manage', array['admins_read'],         5, true)
on conflict (id) do update
  set area_id      = excluded.area_id,
      label        = excluded.label,
      helper       = excluded.helper,
      bundle       = excluded.bundle,
      requires     = excluded.requires,
      sort_order   = excluded.sort_order,
      is_available = excluded.is_available;

insert into public.club_permission_control_keys (control_id, permission_key) values
  ('teams_read',          'teams_view'),
  ('teams_read',          'seasons_history_view'),
  ('teams_write',         'teams_create'),
  ('teams_write',         'teams_edit'),
  ('seasons_write',       'seasons_prepare'),
  ('seasons_write',       'seasons_history_add'),
  ('seasons_write',       'seasons_history_edit'),
  ('teams_lifecycle',     'teams_lifecycle'),
  ('positions_read',      'positions_view'),
  ('positions_write',     'positions_create'),
  ('positions_write',     'society_manage_positions'),
  ('applications_read',   'applications_view'),
  ('applications_read',   'shortlist_view'),
  ('applications_status', 'shortlist_edit_status'),
  ('shortlist_add',       'shortlist_add_profiles'),
  ('shortlist_add',       'shortlist_add_notes'),
  ('shortlist_remove',    'shortlist_remove_profiles'),
  ('shortlist_lists',     'shortlist_create_lists'),
  ('roster_read',         'roster_view'),
  ('roster_read',         'invites_view'),
  ('roster_invite',       'invites_create'),
  ('content_read',        'content_view'),
  ('content_write',       'content_create'),
  ('content_write',       'society_publish_media'),
  ('society_read',        'society_profile_view'),
  ('society_write',       'society_manage_profile'),
  ('network_read',        'network_view'),
  ('network_read',        'network_requests_view'),
  ('network_read',        'network_history_view'),
  ('network_write',       'network_request_send'),
  ('network_write',       'network_request_manage'),
  ('network_write',       'network_request_cancel'),
  ('network_write',       'network_invite_create'),
  ('network_write',       'network_terminate'),
  ('admins_read',         'admins_view'),
  ('admins_read',         'admin_invites_view'),
  ('admins_read',         'admin_roles_view'),
  ('admins_invite',       'admins_invite'),
  ('admins_invite',       'admin_invites_cancel'),
  ('admins_access',       'admins_assign_role'),
  ('admins_access',       'admins_manage_scope'),
  ('admins_revoke',       'admins_revoke'),
  ('admins_roles',        'admin_roles_manage')
on conflict do nothing;

/**
 * Revisione del catalogo (§7, §32).
 *
 * «Capability sconosciute, dipendenze mancanti o configurazioni incoerenti
 * impediscono il salvataggio» e «Il livello rapido rimane riconoscibile
 * rispetto alla propria revisione». Un editor aperto prima di un cambio di
 * tassonomia porta la revisione con cui è stato costruito; il comando la
 * confronta e rifiuta di salvare una configurazione decisa su un catalogo
 * diverso.
 */
insert into public.app_policy_settings (key, value, description)
values (
  'admin_permission_catalog_revision',
  to_jsonb(1),
  'DAS-REV-14 §7 — revisione della tassonomia aree/controlli/chiavi. Va '
  'incrementata da ogni migrazione che cambia il catalogo.'
)
on conflict (key) do update set value = to_jsonb(1);

create or replace function public.club_permission_catalog_revision()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (value #>> '{}')::int from public.app_policy_settings
      where key = 'admin_permission_catalog_revision'),
    1
  );
$$;

revoke all on function public.club_permission_catalog_revision() from public;
grant execute on function public.club_permission_catalog_revision() to authenticated;


-- ============================================================
-- SEZIONE 3 — Risoluzione e classificazione (§7, §12)
--
-- «Personalizzato non è una quarta scelta rapida. I tre livelli rapidi sono
-- esclusivi. La classificazione dipende dal set risolto e dalla revisione
-- della tassonomia, non dalla sola stringa salvata dal client.»
--
-- Da cui: non esiste nessuna colonna "livello" da nessuna parte. Il livello
-- di un'area si **calcola** dal set di chiavi, ogni volta, con queste
-- funzioni — che sono le stesse usate dalla lettura, dal salvataggio e dal
-- riepilogo d'impatto, perché tre implementazioni divergerebbero.
-- ============================================================

/** Chiavi che il catalogo governa. Ciò che non è qui non è configurabile. */
create or replace function public.club_permission_catalog_keys()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct ck.permission_key), array[]::text[])
  from public.club_permission_control_keys ck
  join public.club_permission_controls c on c.id = ck.control_id;
$$;

revoke all on function public.club_permission_catalog_keys() from public;
grant execute on function public.club_permission_catalog_keys() to authenticated;

/**
 * Controlli **interamente** soddisfatti da un set di chiavi.
 *
 * Interamente, non parzialmente: un controllo che mappa due chiavi e ne ha
 * una sola non è attivo. §12 vieta «combinazioni impossibili», e metà di un
 * potere non è un potere concesso.
 */
create or replace function public.club_permission_active_controls(p_keys text[])
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(c.id order by c.area_id, c.sort_order, c.id), array[]::text[])
  from public.club_permission_controls c
  where not exists (
    select 1
    from public.club_permission_control_keys ck
    where ck.control_id = c.id
      and not (ck.permission_key = any (coalesce(p_keys, array[]::text[])))
  );
$$;

revoke all on function public.club_permission_active_controls(text[]) from public;
grant execute on function public.club_permission_active_controls(text[]) to authenticated;

/** Chiavi di un insieme di controlli. */
create or replace function public.club_permission_keys_of(p_controls text[])
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct ck.permission_key), array[]::text[])
  from public.club_permission_control_keys ck
  where ck.control_id = any (coalesce(p_controls, array[]::text[]));
$$;

revoke all on function public.club_permission_keys_of(text[]) from public;
grant execute on function public.club_permission_keys_of(text[]) to authenticated;

/**
 * Chiusura transitiva delle dipendenze (§12).
 *
 * «Attivare una capability seleziona anche le dipendenze obbligatorie.»
 * Il calcolo è server-side perché §12 vieta che una dipendenza possa essere
 * elusa dal client, e perché lo stesso insieme deve risultare dalla UI, dal
 * bundle e dal comando.
 *
 * Il `where` sul livello di ricorsione spezza un eventuale ciclo nel
 * catalogo invece di esaurire lo stack: §12 chiede di non permettere cicli,
 * e questa è la rete di sicurezza se una migrazione futura ne introducesse
 * uno.
 */
create or replace function public.club_permission_expand_controls(p_controls text[])
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  with recursive seed as (
    select unnest(coalesce(p_controls, array[]::text[])) as id, 0 as depth
  ),
  closure as (
    select s.id, s.depth from seed s
    union
    select r.require_id, cl.depth + 1
    from closure cl
    join public.club_permission_controls c on c.id = cl.id
    cross join lateral unnest(c.requires) as r(require_id)
    where cl.depth < 16
  )
  select coalesce(array_agg(distinct c.id), array[]::text[])
  from closure
  join public.club_permission_controls c on c.id = closure.id;
$$;

revoke all on function public.club_permission_expand_controls(text[]) from public;
grant execute on function public.club_permission_expand_controls(text[]) to authenticated;

/** Controlli del bundle rapido di un'area. */
create or replace function public.club_permission_bundle_controls(
  p_area_id text,
  p_level   text
)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(c.id order by c.sort_order, c.id), array[]::text[])
  from public.club_permission_controls c
  where c.area_id = p_area_id
    and c.is_available
    /* §7: Gestisci è «normali azioni gestionali **e letture necessarie**»:
       contiene quindi anche i controlli di lettura dell'area. */
    and (p_level = 'manage' or c.bundle = 'view')
    and p_level in ('view', 'manage');
$$;

revoke all on function public.club_permission_bundle_controls(text, text) from public;
grant execute on function public.club_permission_bundle_controls(text, text) to authenticated;

/**
 * Livello effettivo di un'area (§7).
 *
 *   nessuna chiave dell'area      → `none`
 *   esattamente il bundle view    → `view`
 *   esattamente il bundle manage  → `manage`
 *   qualunque altro set           → `custom`
 *
 * `custom` è **derivato**: non è una scelta che il client può salvare, ed è
 * l'unico valore che non corrisponde a un bundle della revisione corrente.
 */
create or replace function public.club_permission_area_level(
  p_area_id text,
  p_keys    text[]
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_active text[];
  v_view   text[];
  v_manage text[];
begin
  select coalesce(array_agg(c.id order by c.id), array[]::text[])
  into v_active
  from public.club_permission_controls c
  where c.area_id = p_area_id
    and c.id = any (public.club_permission_active_controls(p_keys));

  if array_length(v_active, 1) is null then
    return 'none';
  end if;

  select coalesce(array_agg(x order by x), array[]::text[]) into v_view
  from unnest(public.club_permission_bundle_controls(p_area_id, 'view')) x;

  select coalesce(array_agg(x order by x), array[]::text[]) into v_manage
  from unnest(public.club_permission_bundle_controls(p_area_id, 'manage')) x;

  if v_active = v_manage then
    return 'manage';
  end if;

  if v_active = v_view then
    return 'view';
  end if;

  return 'custom';
end;
$$;

revoke all on function public.club_permission_area_level(text, text[]) from public;
grant execute on function public.club_permission_area_level(text, text[]) to authenticated;

/**
 * Numero di aree abilitate (§8).
 *
 * «Un'area è abilitata se il set effettivo contiene almeno una capability
 * disponibile; un'area Personalizzata vuota corrisponde a Nessun accesso.»
 */
create or replace function public.club_permission_areas_enabled(p_keys text[])
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct c.area_id)::integer
  from public.club_permission_controls c
  join public.club_permission_areas a on a.id = c.area_id
  where c.is_available
    and a.is_available
    and c.id = any (public.club_permission_active_controls(p_keys));
$$;

revoke all on function public.club_permission_areas_enabled(text[]) from public;
grant execute on function public.club_permission_areas_enabled(text[]) to authenticated;

/**
 * Normalizzazione del nome di un ruolo (§9).
 *
 * «trim, whitespace coerente e Unicode secondo lo standard del progetto …
 * Non applicare una validazione limitata all'ASCII.» `btrim` più collasso
 * degli spazi interni: nessuna rimozione di accenti, nessun filtro su
 * alfabeto.
 */
create or replace function public.club_admin_role_normalize_name(p_name text)
returns text
language sql
immutable
as $$
  select nullif(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
$$;

revoke all on function public.club_admin_role_normalize_name(text) from public;
grant execute on function public.club_admin_role_normalize_name(text) to authenticated;

/**
 * Nomi riservati (§9).
 *
 * «Riserva Owner e le sue eventuali label protette localizzate; il nome
 * Super Admin non attribuisce alcun privilegio.» Super Admin quindi **non**
 * è riservato: è solo un nome che non concede nulla. Owner sì, perché
 * nominare un ruolo come la relazione protetta renderebbe illeggibile
 * l'unica distinzione che §18 impone di mantenere.
 */
create or replace function public.club_admin_role_name_reserved(p_name text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(public.club_admin_role_normalize_name(p_name), ''))
    in ('owner', 'proprietario', 'owner della società', 'accesso personalizzato');
$$;

revoke all on function public.club_admin_role_name_reserved(text) from public;
grant execute on function public.club_admin_role_name_reserved(text) to authenticated;


-- ============================================================
-- SEZIONE 4 — Revisioni, ownership e audit (§13, §21, §27, §31)
--
-- §27 chiede che ogni comando porti «versioni attese e idempotenza» e §13
-- che «due editor concorrenti non si sovrascrivano». Servono tre revisioni
-- distinte, perché tre cose diverse cambiano in momenti diversi:
--
--   `club_admin_roles.config_version` — già esistente, cambia **solo** quando
--      cambia ciò che il ruolo concede. Gli inviti pending vi si appoggiano
--      (DAS-REV-13 §16) e rinominare un ruolo non deve invalidarli.
--   `club_admin_roles.version`        — l'intero oggetto, nome incluso: è la
--      versione attesa dal role editor.
--   `club_admin_memberships.version`  — ruolo e ambito di una persona.
--   `clubs.ownership_version`         — la relazione protetta.
-- ============================================================

alter table public.club_admin_roles
  add column if not exists version integer not null default 1;

alter table public.club_admin_memberships
  add column if not exists version integer not null default 1;

alter table public.clubs
  add column if not exists ownership_version integer not null default 1;

/**
 * `version` sale a ogni modifica della riga ruolo **e** del suo contenuto.
 *
 * Il trigger di DAS-REV-13 bumpava solo `config_version` dalla tabella delle
 * chiavi. Qui `config_version` resta ciò che era — la revisione autorizzativa
 * su cui si fondano gli inviti — e `version` diventa la revisione
 * dell'oggetto, che include il nome.
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
      version        = version + 1,
      updated_at     = timezone('utc', now())
  where id = v_role;

  return coalesce(new, old);
end;
$$;

revoke all on function public.club_admin_role_bump_version() from public;

create or replace function public.club_admin_role_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  /* Il bump da `club_admin_role_bump_version` arriva come UPDATE su questa
     tabella: se lo si ribumpasse qui, una sola modifica di chiave farebbe
     salire `version` di due. La condizione riconosce quel caso perché è
     l'unico in cui `version` è già cambiata. */
  if tg_op = 'UPDATE' and new.version is distinct from old.version then
    new.updated_at := timezone('utc', now());
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
  end if;

  new.updated_at := timezone('utc', now());

  return new;
end;
$$;

revoke all on function public.club_admin_role_touch() from public;

drop trigger if exists club_admin_roles_touch on public.club_admin_roles;
create trigger club_admin_roles_touch
  before update on public.club_admin_roles
  for each row execute function public.club_admin_role_touch();

/** La membership porta la propria revisione: ruolo e ambito la condividono. */
create or replace function public.club_admin_membership_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());

  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
  end if;

  return new;
end;
$$;

revoke all on function public.club_admin_membership_touch() from public;

/**
 * Storico dei trasferimenti di ownership (§27, §31).
 *
 * «Ownership | Society, Owner attivo, revisione, assegnazione e storico dei
 * trasferimenti.» Una tabella e non un audit generico, perché questo storico
 * deve restare interrogabile come relazione — chi era Owner e quando — anche
 * se la retention dell'audit tecnico fosse più breve.
 */
create table if not exists public.club_ownership_transfers (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs(id) on delete cascade,
  previous_owner  uuid references public.profiles(id) on delete set null,
  new_owner       uuid references public.profiles(id) on delete set null,
  performed_by    uuid references public.profiles(id) on delete set null,
  ownership_version integer not null,
  created_at      timestamptz not null default timezone('utc', now())
);

create index if not exists club_ownership_transfers_club_idx
  on public.club_ownership_transfers (club_id, created_at desc);

alter table public.club_ownership_transfers enable row level security;

drop policy if exists "club owners read ownership transfers" on public.club_ownership_transfers;
create policy "club owners read ownership transfers"
  on public.club_ownership_transfers for select to authenticated
  using (public.owns_club(club_id));

/** Operazioni amministrative che questa task aggiunge all'audit (§31). */
alter table public.club_admin_audit
  drop constraint if exists club_admin_audit_operation_check;

alter table public.club_admin_audit
  add constraint club_admin_audit_operation_check
  check (operation in (
    'invite_created',
    'invite_reshared',
    'invite_revoked',
    'invite_superseded',
    'invite_bound',
    'invite_accepted',
    'invite_rejected',
    'invite_expired',
    'membership_activated',
    -- DAS-REV-14
    'role_created',
    'role_updated',
    'role_archived',
    'invite_cancelled',
    'membership_role_assigned',
    'membership_scope_updated',
    'membership_revoked',
    'ownership_transferred'
  ));


-- ============================================================
-- SEZIONE 5 — Predicati allineati alla membership amministrativa
--
-- DAS-REV-13 ha scollegato l'accesso amministrativo dall'organico
-- introducendo `club_access_is_active`, ma lo ha applicato soltanto a
-- `dashboard_club_capabilities` e `society_structure_admin_ids`. Tre
-- predicati più vecchi continuano a richiedere una riga `club_members`
-- attiva: un amministratore che non è organico — il caso che DAS-REV-13 §5
-- impone di supportare — oggi supera `dashboard_club_capabilities` e fallisce
-- `has_club_permission`, `can_manage_society` e, soprattutto,
-- `dashboard_club_capability_scope`.
--
-- Quest'ultima è la più grave per questa task: §17 vuole che «l'accesso
-- richieda insieme capability e scope», e con lo scope sempre vuoto un
-- amministratore con Ambito Primavera non vedrebbe **nessuna** squadra.
-- Non è un allargamento: le righe lette sono sempre e solo i grant che la
-- persona possiede davvero.
-- ============================================================

create or replace function public.has_club_permission(
  p_club_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.owns_club(p_club_id)
    or exists (
      select 1
      from public.club_member_permissions perm
      where perm.club_id = p_club_id
        and perm.profile_id = auth.uid()
        and perm.permission_key = p_permission
        and public.club_access_is_active(p_club_id, auth.uid())
    );
$$;

revoke all on function public.has_club_permission(uuid, text) from public;
grant execute on function public.has_club_permission(uuid, text) to authenticated;

create or replace function public.can_manage_society(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_club_id is not null
    and (
      public.owns_club(target_club_id)
      or exists (
        select 1
        from public.club_member_permissions perm
        where perm.club_id = target_club_id
          and perm.profile_id = auth.uid()
          and perm.permission_key = 'society_manage_profile'
          and public.club_access_is_active(target_club_id, auth.uid())
      )
    );
$$;

revoke all on function public.can_manage_society(uuid) from public;
grant execute on function public.can_manage_society(uuid) to authenticated, anon;

create or replace function public.dashboard_club_capability_scope(
  p_club_id uuid,
  p_key text
)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_teams uuid[];
begin
  if public.owns_club(p_club_id) then
    return null;
  end if;

  if not public.club_access_is_active(p_club_id, auth.uid()) then
    return array[]::uuid[];
  end if;

  if exists (
    select 1
    from public.club_member_permissions perm
    where perm.club_id = p_club_id
      and perm.profile_id = auth.uid()
      and perm.team_id is null
      and perm.permission_key = p_key
  ) then
    return null;
  end if;

  select array_agg(distinct perm.team_id)
    into v_teams
  from public.club_member_permissions perm
  join public.club_teams ct
    on ct.id = perm.team_id
    and ct.club_id = perm.club_id
  where perm.club_id = p_club_id
    and perm.profile_id = auth.uid()
    and perm.team_id is not null
    and perm.permission_key = p_key;

  return coalesce(v_teams, array[]::uuid[]);
end;
$$;

revoke all on function public.dashboard_club_capability_scope(uuid, text) from public;
grant execute on function public.dashboard_club_capability_scope(uuid, text) to authenticated;


-- ============================================================
-- SEZIONE 6 — Materializzazione delle capability (§13, §17)
--
-- «Gli amministratori attivi che lo utilizzano ricevono i nuovi poteri nei
-- propri scope, senza login/logout. Non copiare permanentemente il set di
-- permessi in ogni profilo personale creando una seconda fonte di verità.»
--
-- Il set **non** viene copiato in un profilo: viene proiettato in
-- `club_member_permissions`, che è e resta l'unica tabella che i moduli
-- leggono. La proiezione è sempre ricalcolabile da ruolo + ambito, e questa
-- funzione è l'unico posto che la scrive — da `respond_to_admin_invite`
-- in poi ogni comando passa di qui.
--
-- `dashboard_view` è la chiave di apertura della Dashboard. Non è un'area:
-- concederla separatamente non significa nulla, e metterla in un'area
-- significherebbe che togliere quell'area chiude la Dashboard. Viene
-- aggiunta quando il ruolo abilita almeno un controllo, e tolta quando non
-- ne abilita nessuno — coerente con §9: «Questo ruolo non concede accesso
-- alle aree di gestione.»
-- ============================================================

create or replace function public.club_admin_apply_membership_permissions(
  p_membership_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m       public.club_admin_memberships%rowtype;
  v_keys    text[];
  v_teams   uuid[];
begin
  select * into v_m
  from public.club_admin_memberships
  where id = p_membership_id;

  if not found then
    return;
  end if;

  /* Un accesso anteriore al catalogo ruoli (`role_id is null`, backfill di
     DAS-REV-13) non è governato da un ruolo: riscriverne i grant li
     cancellerebbe. §32: «Preserva membership legittime, ruoli, scope,
     inviti e audit». */
  if v_m.role_id is null then
    return;
  end if;

  if v_m.status <> 'active' then
    delete from public.club_member_permissions as perm
    where perm.club_id = v_m.club_id and perm.profile_id = v_m.profile_id;
    return;
  end if;

  select coalesce(array_agg(rp.permission_key), array[]::text[])
  into v_keys
  from public.club_admin_role_permissions rp
  where rp.role_id = v_m.role_id;

  select array_agg(mt.team_id) into v_teams
  from public.club_admin_membership_teams mt
  where mt.membership_id = v_m.id;

  delete from public.club_member_permissions as perm
  where perm.club_id = v_m.club_id and perm.profile_id = v_m.profile_id;

  if array_length(v_keys, 1) is null then
    return;
  end if;

  -- Chiave di apertura della Dashboard: una sola riga societaria.
  insert into public.club_member_permissions
    (club_id, profile_id, permission_key, team_id, granted_by_profile_id)
  values (v_m.club_id, v_m.profile_id, 'dashboard_view', null, v_m.granted_by)
  on conflict do nothing;

  -- Chiavi di aree **societarie**: sempre `team_id is null`, anche con
  -- ambito selettivo (§17).
  insert into public.club_member_permissions
    (club_id, profile_id, permission_key, team_id, granted_by_profile_id)
  select distinct v_m.club_id, v_m.profile_id, k.key, null, v_m.granted_by
  from unnest(v_keys) as k(key)
  where k.key <> 'dashboard_view'
    and (
      exists (
        select 1
        from public.club_permission_control_keys ck
        join public.club_permission_controls c on c.id = ck.control_id
        join public.club_permission_areas a on a.id = c.area_id
        where ck.permission_key = k.key and a.scope_kind = 'society'
      )
      /* Chiavi che il catalogo non governa — per esempio le preferenze di
         notifica operative — restano societarie: non hanno una semantica
         per squadra da rispettare. §7 chiede di conservarle, non di
         reinterpretarle. */
      or not exists (
        select 1 from public.club_permission_control_keys ck2
        where ck2.permission_key = k.key
      )
      or v_m.scope_mode = 'society'
    )
  on conflict do nothing;

  -- Chiavi di aree **di squadra** con ambito selettivo: una riga per Team.
  if v_m.scope_mode = 'teams' and array_length(v_teams, 1) is not null then
    insert into public.club_member_permissions
      (club_id, profile_id, permission_key, team_id, granted_by_profile_id)
    select distinct v_m.club_id, v_m.profile_id, k.key, t, v_m.granted_by
    from unnest(v_keys) as k(key)
    cross join unnest(v_teams) as t
    where k.key <> 'dashboard_view'
      and exists (
        select 1
        from public.club_permission_control_keys ck
        join public.club_permission_controls c on c.id = ck.control_id
        join public.club_permission_areas a on a.id = c.area_id
        where ck.permission_key = k.key and a.scope_kind = 'team'
      )
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function public.club_admin_apply_membership_permissions(uuid) from public;

/**
 * Riproiezione di tutte le membership attive che usano un ruolo (§13).
 *
 * «Applica il cambiamento in un'unica operazione logica. La configurazione
 * pubblicata non può essere metà vecchia e metà nuova.» La funzione gira
 * dentro la transazione del comando che l'ha chiamata: o tutte le
 * membership vedono la nuova configurazione, o nessuna.
 */
create or replace function public.club_admin_reproject_role(p_role_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   record;
  v_count integer := 0;
begin
  for v_row in
    select m.id
    from public.club_admin_memberships m
    where m.role_id = p_role_id and m.status = 'active'
    order by m.id
    for update
  loop
    perform public.club_admin_apply_membership_permissions(v_row.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.club_admin_reproject_role(uuid) from public;

/**
 * Utilizzatori attivi di un ruolo (§8, §10).
 *
 * «I pending non entrano nel conteggio degli amministratori. Deduplica la
 * stessa persona che usa quel ruolo attraverso più record equivalenti.»
 * `club_admin_memberships` ha già un vincolo unico per (club, profilo), ma
 * il `distinct` resta: §5 chiede un conteggio di **persone**, non di righe,
 * e il vincolo è un dettaglio di oggi.
 */
create or replace function public.club_admin_role_user_count(p_role_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct m.profile_id)::integer
  from public.club_admin_memberships m
  where m.role_id = p_role_id and m.status = 'active';
$$;

revoke all on function public.club_admin_role_user_count(uuid) from public;
grant execute on function public.club_admin_role_user_count(uuid) to authenticated;

/**
 * Capability che l'actor può **concedere** (§6).
 *
 * «Poter utilizzare una capability non significa poterla concedere.»
 * L'Owner può concedere tutto il catalogo; chiunque altro soltanto ciò che
 * possiede a livello societario — `dashboard_club_capabilities` esclude già
 * le chiavi `admin*` e `network_*` ottenute su una singola squadra.
 *
 * Il trasferimento di ownership non compare, perché non è una chiave.
 */
create or replace function public.club_admin_grantable_keys(p_club_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.owns_club(p_club_id) then public.club_permission_catalog_keys()
    else coalesce(
      (select array_agg(k)
       from unnest(public.dashboard_club_capabilities(p_club_id)) as k
       where k = any (public.club_permission_catalog_keys())),
      array[]::text[]
    )
  end;
$$;

revoke all on function public.club_admin_grantable_keys(uuid) from public;
grant execute on function public.club_admin_grantable_keys(uuid) to authenticated;


-- ============================================================
-- SEZIONE 6b — Le nuove chiavi entrano nel risolutore
--
-- `dashboard_club_capabilities` filtra su una whitelist esplicita: una
-- chiave assente da quella lista non viene mai restituita, anche se il grant
-- esiste. Senza questo passaggio le sei chiavi della sezione 1 sarebbero
-- scrivibili e inerti — esattamente il «pulsante nascosto» che §1 vieta di
-- scambiare per una protezione.
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
          /* Un grant limitato a una squadra concede soltanto chiavi di
             un'area **di squadra**. Rete, Amministratori e Dati della
             società restano Society-level (DAS-REV-11 §5, DAS-REV-13 §23,
             DAS-REV-14 §17), e lo dice il catalogo invece di un pattern sul
             nome: aggiungere una chiave non deve richiedere di ricordarsi di
             aggiornare una regexp. */
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
-- SEZIONE 7 — Autorità sull'oggetto condiviso (§6)
--
-- «Per creare/modificare un ruolo verifica l'intera configurazione
-- risultante e l'autorità sull'oggetto condiviso. Un actor limitato alla
-- Primavera non deve ampliare indirettamente i poteri di amministratori di
-- altre squadre modificando un ruolo comune senza autorizzazione adeguata.»
--
-- Un ruolo non ha ambito: è usato da persone con ambiti diversi. Modificarlo
-- è quindi sempre un'azione societaria, e chi opera dentro un perimetro
-- ristretto non ha l'autorità per compierla — anche possedendo la chiave.
-- ============================================================

create or replace function public.society_role_editor_allows(
  p_club_id uuid,
  p_key     text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.owns_club(p_club_id)
    or (
      public.society_admin_allows(p_club_id, p_key)
      and public.dashboard_club_scope(p_club_id) is null
    );
$$;

revoke all on function public.society_role_editor_allows(uuid, text) from public;
grant execute on function public.society_role_editor_allows(uuid, text) to authenticated;


-- ============================================================
-- SEZIONE 8 — Letture (§8, §10, §14, §18, §19, §23, §27)
-- ============================================================

/** Composizione del Centro Ruoli e permessi (screen 01). */
create or replace function public.fetch_society_roles_center(p_club_id uuid)
returns table (
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  club_is_verified   boolean,
  can_create_role    boolean,
  can_edit_roles     boolean,
  roles_count        integer,
  catalog_revision   integer,
  access_verified_at timestamptz,
  data_revision      bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_manage boolean;
begin
  if auth.uid() is null then
    raise exception 'ROLES_NOT_AUTHORIZED';
  end if;

  if not public.society_admin_allows(p_club_id, 'admin_roles_view') then
    raise exception 'ROLES_NOT_AUTHORIZED';
  end if;

  v_manage := public.society_role_editor_allows(p_club_id, 'admin_roles_manage');

  return query
  select
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    v_manage,
    v_manage,
    (select count(*)::integer from public.club_admin_roles r
      where r.club_id = p_club_id and r.is_active),
    public.club_permission_catalog_revision(),
    timezone('utc', now()),
    greatest(
      (select coalesce(extract(epoch from max(r.updated_at))::bigint, 0)
        from public.club_admin_roles r where r.club_id = p_club_id),
      (select coalesce(extract(epoch from max(m.updated_at))::bigint, 0)
        from public.club_admin_memberships m where m.club_id = p_club_id)
    )
  from public.clubs c
  where c.id = p_club_id;
end;
$$;

revoke all on function public.fetch_society_roles_center(uuid) from public;
grant execute on function public.fetch_society_roles_center(uuid) to authenticated;

/**
 * Elenco dei ruoli configurabili (screen 01).
 *
 * §8: «Conteggi da backend, non dalla pagina parziale scaricata» e «Owner è
 * escluso da questa lista di ruoli modificabili» — l'Owner non ha una riga
 * in `club_admin_roles`, quindi l'esclusione è strutturale e non un filtro.
 */
create or replace function public.fetch_society_roles_page(
  p_club_id uuid,
  p_limit   int default 20,
  p_offset  int default 0
)
returns table (
  role_id        uuid,
  name           text,
  areas_enabled  integer,
  admins_count   integer,
  is_system      boolean,
  config_version integer,
  version        integer,
  total_count    bigint
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
  if not public.society_admin_allows(p_club_id, 'admin_roles_view') then
    raise exception 'ROLES_NOT_AUTHORIZED';
  end if;

  return query
  with role_rows as (
    select
      r.id,
      r.name,
      public.club_permission_areas_enabled(
        coalesce(
          (select array_agg(rp.permission_key)
            from public.club_admin_role_permissions rp where rp.role_id = r.id),
          array[]::text[]
        )
      )                                         as areas_enabled,
      public.club_admin_role_user_count(r.id)   as admins_count,
      r.is_system,
      r.config_version,
      r.version
    from public.club_admin_roles r
    where r.club_id = p_club_id
      and r.is_active
  )
  select
    role_rows.id,
    role_rows.name,
    role_rows.areas_enabled,
    role_rows.admins_count,
    role_rows.is_system,
    role_rows.config_version,
    role_rows.version,
    (select count(*) from role_rows) as total_count
  from role_rows
  order by lower(role_rows.name), role_rows.id
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.fetch_society_roles_page(uuid, int, int) from public;
grant execute on function public.fetch_society_roles_page(uuid, int, int) to authenticated;

/**
 * Catalogo delle aree con la concedibilità dell'actor (§7, §11, §12).
 *
 * Una riga per controllo, con la propria area ripetuta: il client ricompone
 * l'albero una volta sola. `is_grantable` è calcolato **qui** perché §6
 * vieta di «offrire come opzione valida» un bundle che l'actor non può
 * concedere, e il client non può saperlo da solo.
 */
create or replace function public.fetch_permission_catalog(p_club_id uuid)
returns table (
  area_id           text,
  area_label        text,
  area_description  text,
  area_sort_order   integer,
  area_scope_kind   text,
  control_id        text,
  control_label     text,
  control_helper    text,
  control_bundle    text,
  control_requires  text[],
  control_sort_order integer,
  permission_keys   text[],
  is_grantable      boolean,
  catalog_revision  integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_grantable text[];
begin
  if not public.society_admin_allows(p_club_id, 'admin_roles_view') then
    raise exception 'ROLES_NOT_AUTHORIZED';
  end if;

  v_grantable := public.club_admin_grantable_keys(p_club_id);

  return query
  select
    a.id,
    a.label,
    a.description,
    a.sort_order,
    a.scope_kind,
    c.id,
    c.label,
    c.helper,
    c.bundle,
    c.requires,
    c.sort_order,
    coalesce(
      (select array_agg(ck.permission_key order by ck.permission_key)
        from public.club_permission_control_keys ck where ck.control_id = c.id),
      array[]::text[]
    ),
    not exists (
      select 1
      from public.club_permission_control_keys ck
      where ck.control_id = c.id
        and not (ck.permission_key = any (v_grantable))
    ),
    public.club_permission_catalog_revision()
  from public.club_permission_controls c
  join public.club_permission_areas a on a.id = c.area_id
  where a.is_available
    and c.is_available
  order by a.sort_order, a.id, c.sort_order, c.id;
end;
$$;

revoke all on function public.fetch_permission_catalog(uuid) from public;
grant execute on function public.fetch_permission_catalog(uuid) to authenticated;

/** Configurazione corrente di un ruolo (screen 03). */
create or replace function public.fetch_society_role_detail(
  p_club_id uuid,
  p_role_id uuid
)
returns table (
  role_id          uuid,
  name             text,
  permission_keys  text[],
  areas_enabled    integer,
  admins_count     integer,
  pending_invites  integer,
  is_system        boolean,
  is_active        boolean,
  config_version   integer,
  version          integer,
  can_edit         boolean,
  can_archive      boolean,
  catalog_revision integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role    public.club_admin_roles%rowtype;
  v_keys    text[];
  v_users   integer;
  v_pending integer;
  v_edit    boolean;
begin
  if not public.society_admin_allows(p_club_id, 'admin_roles_view') then
    raise exception 'ROLES_NOT_AUTHORIZED';
  end if;

  select * into v_role
  from public.club_admin_roles r
  where r.id = p_role_id and r.club_id = p_club_id;

  if not found then
    raise exception 'ROLE_NOT_FOUND';
  end if;

  select coalesce(array_agg(rp.permission_key order by rp.permission_key), array[]::text[])
  into v_keys
  from public.club_admin_role_permissions rp
  where rp.role_id = v_role.id;

  v_users := public.club_admin_role_user_count(v_role.id);

  select count(*)::integer into v_pending
  from public.club_admin_invites inv
  where inv.club_id = p_club_id
    and inv.role_id = v_role.id
    and public.club_admin_invite_state(inv.status, inv.expires_at) = 'pending';

  v_edit := public.society_role_editor_allows(p_club_id, 'admin_roles_manage');

  return query
  select
    v_role.id,
    v_role.name,
    v_keys,
    public.club_permission_areas_enabled(v_keys),
    v_users,
    v_pending,
    v_role.is_system,
    v_role.is_active,
    v_role.config_version,
    v_role.version,
    v_edit,
    /* §24: «L'archiviazione è consentita solo senza utilizzi attivi o
       pending azionabili incompatibili.» Il pulsante non è la protezione —
       il comando ricontrolla — ma mostrarlo quando è certo che fallirà
       sarebbe il chevron morto che §8 vieta. */
    v_edit and v_users = 0 and v_pending = 0,
    public.club_permission_catalog_revision();
end;
$$;

revoke all on function public.fetch_society_role_detail(uuid, uuid) from public;
grant execute on function public.fetch_society_role_detail(uuid, uuid) to authenticated;


/**
 * Dettaglio di un accesso amministrativo (screen 06, 11).
 *
 * Una sola funzione per l'amministratore normale e per l'Owner: §18 dice che
 * «il tap sull'Owner apre lo stesso contesto di dettaglio amministrativo con
 * variante protetta». Due controller avrebbero prodotto due verità su chi
 * può fare cosa.
 *
 * `can_transfer_owner` è vero soltanto per l'Owner corrente su se stesso:
 * §18 vieta che «un amministratore delegato, anche con Gestisci
 * amministratori e permessi» possa trasferire l'ownership.
 */
create or replace function public.fetch_society_admin_detail(
  p_club_id    uuid,
  p_profile_id uuid
)
returns table (
  membership_id      uuid,
  profile_id         uuid,
  full_name          text,
  avatar_url         text,
  is_owner           boolean,
  is_self            boolean,
  status             text,
  role_id            uuid,
  role_label         text,
  role_is_named      boolean,
  scope_mode         text,
  scope_label        text,
  team_ids           uuid[],
  team_names         text[],
  version            integer,
  activated_at       timestamptz,
  can_change_role    boolean,
  can_change_scope   boolean,
  can_revoke         boolean,
  can_transfer_owner boolean,
  can_view_permissions boolean,
  access_verified_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_owner   uuid;
  v_m       public.club_admin_memberships%rowtype;
  v_role    public.club_admin_roles%rowtype;
  v_teams   uuid[];
  v_names   text[];
  v_is_own  boolean;
begin
  if v_uid is null or not public.society_admin_allows(p_club_id, 'admins_view') then
    raise exception 'ADMIN_DETAIL_NOT_AUTHORIZED';
  end if;

  select c.owner_profile_id into v_owner from public.clubs c where c.id = p_club_id;

  if v_owner is null then
    raise exception 'ADMIN_DETAIL_NOT_AUTHORIZED';
  end if;

  v_is_own := p_profile_id = v_owner;

  select * into v_m
  from public.club_admin_memberships m
  where m.club_id = p_club_id and m.profile_id = p_profile_id;

  /* Una persona senza membership e senza ownership non è un amministratore
     di questa Società: §31 vieta di restituire dati di persone che l'actor
     non ha diritto di leggere in questo contesto. */
  if not v_is_own and (v_m.id is null or v_m.status <> 'active') then
    raise exception 'ADMIN_MEMBERSHIP_NOT_FOUND';
  end if;

  if v_m.role_id is not null then
    select * into v_role from public.club_admin_roles r where r.id = v_m.role_id;
  end if;

  select array_agg(mt.team_id order by ct.sort_order, ct.name),
         array_agg(ct.name order by ct.sort_order, ct.name)
  into v_teams, v_names
  from public.club_admin_membership_teams mt
  join public.club_teams ct on ct.id = mt.team_id
  where mt.membership_id = v_m.id;

  return query
  select
    v_m.id,
    p_profile_id,
    p.full_name,
    p.avatar_url,
    v_is_own,
    p_profile_id = v_uid,
    case when v_is_own then 'owner' else coalesce(v_m.status, 'active') end,
    v_m.role_id,
    case
      when v_is_own and v_role.id is null then 'Owner'
      when v_role.id is not null then v_role.name
      /* DAS-REV-13 §30: un accesso anteriore al catalogo non ha un nome
         scelto dalla Società. Lo si dice, invece di inventarne uno. */
      else 'Accesso personalizzato'
    end,
    v_role.id is not null,
    case when v_is_own and v_m.id is null then 'society' else coalesce(v_m.scope_mode, 'society') end,
    case
      when v_is_own and v_m.id is null then 'Accesso completo'
      else public.club_admin_scope_label(coalesce(v_m.scope_mode, 'society'), v_teams)
    end,
    coalesce(v_teams, array[]::uuid[]),
    coalesce(v_names, array[]::text[]),
    coalesce(v_m.version, 0),
    v_m.activated_at,
    /* L'Owner non cambia ruolo e ambito da questa schermata: le sue
       prerogative derivano dalla relazione protetta (§18). */
    (not v_is_own) and v_m.id is not null
      and public.society_admin_allows(p_club_id, 'admins_assign_role'),
    (not v_is_own) and v_m.id is not null
      and public.society_admin_allows(p_club_id, 'admins_manage_scope'),
    (not v_is_own) and v_m.id is not null
      and public.society_admin_allows(p_club_id, 'admins_revoke'),
    v_is_own and v_uid = v_owner,
    /* La riga «Visualizza permessi» legge le capability **di questa
       persona** e la sua destinazione è gated sulla stessa chiave di questa
       funzione: chi è arrivato fin qui può aprirla. Richiedere in più
       `admin_roles_view` nasconderebbe la riga a un delegato che §14 vuole
       possa vederla. */
    true,
    timezone('utc', now())
  from public.profiles p
  where p.id = p_profile_id;
end;
$$;

revoke all on function public.fetch_society_admin_detail(uuid, uuid) from public;
grant execute on function public.fetch_society_admin_detail(uuid, uuid) to authenticated;

/**
 * Permessi effettivi di una persona (§14, §17 — "Visualizza permessi").
 *
 * «Visualizza permessi apre una vista consultabile delle capacità effettive
 * e dell'ambito, riutilizzando il renderer del catalogo. Non deve aprire
 * automaticamente l'editor condiviso del ruolo.»
 *
 * Una riga per area, con il livello risolto e i controlli attivi. L'Owner
 * non ha un set: ha la relazione protetta, e la funzione lo dichiara invece
 * di simulare un ruolo pieno.
 */
create or replace function public.fetch_society_admin_permissions(
  p_club_id    uuid,
  p_profile_id uuid
)
returns table (
  area_id          text,
  area_label       text,
  area_scope_kind  text,
  area_sort_order  integer,
  level            text,
  control_labels   text[],
  is_owner         boolean,
  scope_mode       text,
  scope_label      text,
  catalog_revision integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner  uuid;
  v_m      public.club_admin_memberships%rowtype;
  v_keys   text[];
  v_teams  uuid[];
  v_is_own boolean;
  v_scope  text;
  v_label  text;
begin
  if not public.society_admin_allows(p_club_id, 'admins_view') then
    raise exception 'ADMIN_DETAIL_NOT_AUTHORIZED';
  end if;

  select c.owner_profile_id into v_owner from public.clubs c where c.id = p_club_id;
  v_is_own := p_profile_id = v_owner;

  select * into v_m
  from public.club_admin_memberships m
  where m.club_id = p_club_id and m.profile_id = p_profile_id and m.status = 'active';

  if not v_is_own and v_m.id is null then
    raise exception 'ADMIN_MEMBERSHIP_NOT_FOUND';
  end if;

  if v_is_own and v_m.id is null then
    /* §18: «Per l'Owner, le capacità amministrative complete derivano dalla
       relazione protetta e non richiedono un ruolo operativo fittizio.» */
    v_keys  := public.club_permission_catalog_keys();
    v_scope := 'society';
    v_label := 'Accesso completo';
  else
    select coalesce(array_agg(rp.permission_key), array[]::text[])
    into v_keys
    from public.club_admin_role_permissions rp
    where rp.role_id = v_m.role_id;

    /* Accesso senza ruolo nominato: i poteri reali sono i grant che
       possiede, non quelli di un ruolo che non ha. */
    if v_m.role_id is null then
      select coalesce(array_agg(distinct perm.permission_key), array[]::text[])
      into v_keys
      from public.club_member_permissions perm
      where perm.club_id = p_club_id and perm.profile_id = p_profile_id;
    end if;

    select array_agg(mt.team_id) into v_teams
    from public.club_admin_membership_teams mt
    where mt.membership_id = v_m.id;

    v_scope := v_m.scope_mode;
    v_label := public.club_admin_scope_label(v_m.scope_mode, v_teams);
  end if;

  return query
  select
    a.id,
    a.label,
    a.scope_kind,
    a.sort_order,
    public.club_permission_area_level(a.id, v_keys),
    coalesce(
      (select array_agg(c.label order by c.sort_order, c.id)
        from public.club_permission_controls c
        where c.area_id = a.id
          and c.id = any (public.club_permission_active_controls(v_keys))),
      array[]::text[]
    ),
    v_is_own,
    v_scope,
    v_label,
    public.club_permission_catalog_revision()
  from public.club_permission_areas a
  where a.is_available
  order by a.sort_order, a.id;
end;
$$;

revoke all on function public.fetch_society_admin_permissions(uuid, uuid) from public;
grant execute on function public.fetch_society_admin_permissions(uuid, uuid) to authenticated;

/** Dettaglio di un invito ancora aperto (screen 10). */
create or replace function public.fetch_society_admin_invite_detail(
  p_club_id   uuid,
  p_invite_id uuid
)
returns table (
  invite_id      uuid,
  recipient_kind text,
  profile_id     uuid,
  full_name      text,
  avatar_url     text,
  email_display  text,
  role_label     text,
  scope_label    text,
  state          text,
  revision       integer,
  expires_at     timestamptz,
  created_at     timestamptz,
  membership_profile_id uuid,
  can_cancel     boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inv   public.club_admin_invites%rowtype;
  v_state text;
begin
  if not public.society_admin_allows(p_club_id, 'admin_invites_view') then
    raise exception 'ADMIN_INVITE_NOT_AUTHORIZED';
  end if;

  select * into v_inv
  from public.club_admin_invites inv
  where inv.id = p_invite_id and inv.club_id = p_club_id;

  if not found then
    raise exception 'ADMIN_INVITE_UNAVAILABLE';
  end if;

  v_state := public.club_admin_invite_state(v_inv.status, v_inv.expires_at);

  return query
  select
    v_inv.id,
    v_inv.recipient_kind,
    v_inv.recipient_profile_id,
    p.full_name,
    p.avatar_url,
    v_inv.recipient_email_display,
    role.name,
    public.club_admin_scope_label(
      v_inv.scope_mode,
      (select array_agg(t.team_id) from public.club_admin_invite_teams t
        where t.invite_id = v_inv.id)
    ),
    v_state,
    v_inv.revision,
    v_inv.expires_at,
    v_inv.created_at,
    /* §23: nella race con l'accept, «consenti l'apertura dell'amministratore
       se autorizzata». Serve l'identità della persona ormai attiva. */
    case when v_state = 'accepted' then v_inv.recipient_profile_id end,
    v_state = 'pending'
      and public.society_admin_allows(p_club_id, 'admin_invites_cancel')
  from public.club_admin_roles role
  left join public.profiles p on p.id = v_inv.recipient_profile_id
  where role.id = v_inv.role_id;
end;
$$;

revoke all on function public.fetch_society_admin_invite_detail(uuid, uuid) from public;
grant execute on function public.fetch_society_admin_invite_detail(uuid, uuid) to authenticated;

/**
 * Candidati al trasferimento di ownership (screen 11).
 *
 * §19: «Escludi Owner corrente, pending, membri revocati/sospesi, persone
 * senza accesso amministrativo e amministratori di Society collegate.»
 * Il filtro è `club_admin_memberships` attiva della **stessa** Società: un
 * pending non ha una riga qui, e un'affiliata ha un `club_id` diverso.
 *
 * Solo l'Owner corrente può leggere questa lista: §18 riserva a lui
 * l'operazione, e una lista di candidati è già un dato della stessa natura.
 */
create or replace function public.fetch_society_owner_candidates(
  p_club_id uuid,
  p_limit   int default 20,
  p_offset  int default 0
)
returns table (
  profile_id  uuid,
  full_name   text,
  avatar_url  text,
  role_label  text,
  scope_label text,
  total_count bigint
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
  select c.owner_profile_id into v_owner from public.clubs c where c.id = p_club_id;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'OWNER_TRANSFER_NOT_AUTHORIZED';
  end if;

  return query
  with candidates as (
    select
      p.id          as profile_id,
      p.full_name   as full_name,
      p.avatar_url  as avatar_url,
      case when role.id is not null then role.name else 'Accesso personalizzato' end as role_label,
      public.club_admin_scope_label(
        m.scope_mode,
        (select array_agg(mt.team_id) from public.club_admin_membership_teams mt
          where mt.membership_id = m.id)
      )             as scope_label
    from public.club_admin_memberships m
    join public.profiles p on p.id = m.profile_id
    left join public.club_admin_roles role on role.id = m.role_id
    where m.club_id = p_club_id
      and m.status = 'active'
      and m.profile_id <> v_owner
  )
  select
    candidates.profile_id,
    candidates.full_name,
    candidates.avatar_url,
    candidates.role_label,
    candidates.scope_label,
    (select count(*) from candidates) as total_count
  from candidates
  /* §19: «Non ordinare per una presunta potenza del ruolo; usa l'ordine
     canonico stabile o nome e ID.» */
  order by lower(candidates.full_name), candidates.profile_id
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.fetch_society_owner_candidates(uuid, int, int) from public;
grant execute on function public.fetch_society_owner_candidates(uuid, int, int) to authenticated;


/**
 * Ruoli assegnabili (DAS-REV-13 §9, riallineata).
 *
 * La versione di DAS-REV-13 era gated su `admins_invite`, l'unica
 * operazione che allora li consumava. Il cambio di ruolo di una membership
 * attiva (§14) è un'altra, e non deve richiedere il diritto di invitare.
 */
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
  if not (
    public.society_admin_allows(p_club_id, 'admins_invite')
    or public.society_admin_allows(p_club_id, 'admins_assign_role')
  ) then
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
 * Squadre selezionabili come ambito (DAS-REV-13 §10, riallineata).
 *
 * `logo_url` è una colonna nuova nel tipo di ritorno, e
 * `create or replace` non può cambiare la riga definita dai parametri OUT
 * (42P13): va rimossa prima. Il `drop` toglie anche i privilegi, che il
 * `grant` dopo la definizione ripristina — ed è il motivo per cui questa è
 * l'unica funzione della migrazione a essere ricreata da zero.
 */
drop function if exists public.fetch_society_assignable_teams(uuid);

create or replace function public.fetch_society_assignable_teams(p_club_id uuid)
returns table (
  team_id   uuid,
  name      text,
  category  text,
  team_type text,
  logo_url  text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope uuid[];
begin
  if not (
    public.society_admin_allows(p_club_id, 'admins_invite')
    or public.society_admin_allows(p_club_id, 'admins_manage_scope')
  ) then
    raise exception 'ADMIN_CENTER_NOT_AUTHORIZED';
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, 'teams_view');

  return query
  /* §16: «Se il Team eredita lo stemma della Society, usa quell'asset.
     Nessuno scudo inventato in assenza di un asset.» */
  select ct.id, ct.name, ct.category, ct.team_type,
         coalesce(ct.logo_url, c.logo_url)
  from public.club_teams ct
  join public.clubs c on c.id = ct.club_id
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

/**
 * L'actor può amministrare **questo** target? (§6, §25)
 *
 * «Una delega di gestione limitata deve specificare server-side quali
 * oggetti/target e configurazioni sono modificabili.» Un actor con perimetro
 * ristretto non amministra un collega con accesso all'intera Società, né uno
 * con squadre fuori dal proprio perimetro: amministrarlo significherebbe
 * poterne cambiare ruolo e ambito, cioè decidere su squadre che non gli
 * appartengono.
 */
create or replace function public.club_admin_can_manage_target(
  p_club_id       uuid,
  p_membership_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope uuid[];
  v_m     public.club_admin_memberships%rowtype;
begin
  if public.owns_club(p_club_id) then
    return true;
  end if;

  select * into v_m from public.club_admin_memberships where id = p_membership_id;

  if not found or v_m.club_id <> p_club_id then
    return false;
  end if;

  v_scope := public.dashboard_club_scope(p_club_id);

  -- Perimetro illimitato: nessuna restrizione sul target.
  if v_scope is null then
    return true;
  end if;

  if v_m.scope_mode = 'society' then
    return false;
  end if;

  return not exists (
    select 1
    from public.club_admin_membership_teams mt
    where mt.membership_id = v_m.id
      and not (mt.team_id = any (v_scope))
  );
end;
$$;

revoke all on function public.club_admin_can_manage_target(uuid, uuid) from public;
grant execute on function public.club_admin_can_manage_target(uuid, uuid) to authenticated;


-- ============================================================
-- SEZIONE 9 — Comandi (§13, §14, §15, §21, §22, §23, §24)
--
-- Ogni comando: deriva l'actor dalla sessione, rilegge lo stato canonico,
-- confronta la versione attesa, applica in una sola transazione, registra
-- audit e risultato idempotente. Nessuno si fida di un flag passato dal
-- client — §27: «Il backend deriva l'actor dalla sessione e verifica
-- l'ownership della risorsa; non si fida di changed_by o di una capability
-- passata dal client.»
--
-- Il draft arriva come **id di controllo**, non come chiavi. §13 vieta
-- «l'iniezione di Team ID nel ruolo o di ownership nei bundle»: il modo di
-- garantirlo è che le chiavi non transitino affatto dal client, ma vengano
-- derivate qui dal catalogo.
-- ============================================================

/** Crea o aggiorna un ruolo (screen 02, 03). */
create or replace function public.save_society_admin_role(
  p_club_id          uuid,
  p_role_id          uuid,
  p_name             text,
  p_control_ids      text[],
  p_expected_version integer default null,
  p_catalog_revision integer default null,
  p_expected_impact  integer default null,
  p_idempotency_key  text default null
)
returns table (
  role_id        uuid,
  name           text,
  version        integer,
  config_version integer,
  admins_count   integer,
  changed        boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_name        text;
  v_role        public.club_admin_roles%rowtype;
  v_expanded    text[];
  v_target      text[];
  v_current     text[];
  v_catalog     text[];
  v_grantable   text[];
  v_users       integer;
  v_changed     boolean := false;
  v_created     boolean := false;
  v_fingerprint text;
  v_replay      jsonb;
begin
  if v_uid is null then
    raise exception 'ROLES_NOT_AUTHENTICATED';
  end if;

  if not public.society_role_editor_allows(p_club_id, 'admin_roles_manage') then
    raise exception 'ROLES_NOT_AUTHORIZED';
  end if;

  -- §13, §32: una configurazione decisa su una tassonomia diversa non è la
  -- configurazione che l'utente ha approvato.
  if p_catalog_revision is not null
     and p_catalog_revision <> public.club_permission_catalog_revision() then
    raise exception 'ROLE_CATALOG_CHANGED';
  end if;

  v_name := public.club_admin_role_normalize_name(p_name);

  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception 'ROLE_NAME_INVALID';
  end if;

  /* §9: «Impedisci nomi vuoti, markup e duplicati normalizzati.» Il markup
     non si sanifica silenziosamente: un nome che lo contiene è rifiutato,
     perché "ripulirlo" salverebbe un nome diverso da quello approvato. */
  if v_name ~ '[<>]' then
    raise exception 'ROLE_NAME_INVALID';
  end if;

  if public.club_admin_role_name_reserved(v_name) then
    raise exception 'ROLE_NAME_RESERVED';
  end if;

  v_fingerprint := md5(
    coalesce(p_role_id::text, 'new') || '|' || v_name || '|' ||
    coalesce(array_to_string(
      (select array_agg(x order by x) from unnest(coalesce(p_control_ids, array[]::text[])) x),
      ','), '')
  );

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, p_club_id, 'admin_role_save', v_fingerprint
  );

  if v_replay is not null then
    return query
    select (v_replay->>'role_id')::uuid, v_replay->>'name',
           (v_replay->>'version')::integer, (v_replay->>'config_version')::integer,
           (v_replay->>'admins_count')::integer, (v_replay->>'changed')::boolean;
    return;
  end if;

  -- ── Dipendenze e concedibilità ─────────────────────────────────────────
  v_expanded := public.club_permission_expand_controls(p_control_ids);

  if exists (
    select 1
    from unnest(coalesce(p_control_ids, array[]::text[])) as req(id)
    where not exists (
      select 1 from public.club_permission_controls c
      join public.club_permission_areas a on a.id = c.area_id
      where c.id = req.id and c.is_available and a.is_available
    )
  ) then
    raise exception 'ROLE_CATALOG_CHANGED';
  end if;

  v_target    := public.club_permission_keys_of(v_expanded);
  v_catalog   := public.club_permission_catalog_keys();
  v_grantable := public.club_admin_grantable_keys(p_club_id);

  /* §6: «Non ritagliare silenziosamente un bundle richiesto ai soli poteri
     concedibili.» Si rifiuta, non si riduce. */
  if exists (
    select 1 from unnest(v_target) as k(key)
    where not (k.key = any (v_grantable))
  ) then
    raise exception 'ROLE_PERMISSION_NOT_GRANTABLE';
  end if;

  -- ── Creazione ──────────────────────────────────────────────────────────
  if p_role_id is null then
    begin
      insert into public.club_admin_roles (club_id, name, is_system, created_by)
      values (p_club_id, v_name, false, v_uid)
      returning * into v_role;
    exception when unique_violation then
      raise exception 'ROLE_NAME_DUPLICATE';
    end;

    v_created := true;
    v_changed := true;
  else
    select * into v_role
    from public.club_admin_roles r
    where r.id = p_role_id and r.club_id = p_club_id
    for update;

    if not found then
      raise exception 'ROLE_NOT_FOUND';
    end if;

    if not v_role.is_active then
      raise exception 'ROLE_ARCHIVED';
    end if;

    if p_expected_version is not null and p_expected_version <> v_role.version then
      raise exception 'ROLE_VERSION_CONFLICT';
    end if;

    /* §10: «Prima del commit mostra il numero corrente degli amministratori
       interessati» e §10: «Se il ruolo o la platea rilevante cambia dopo il
       riepilogo, rivalida il contesto d'impatto.» */
    if p_expected_impact is not null
       and p_expected_impact <> public.club_admin_role_user_count(v_role.id) then
      raise exception 'ROLE_IMPACT_CHANGED';
    end if;

    if v_role.name <> v_name then
      begin
        update public.club_admin_roles set name = v_name where id = v_role.id;
      exception when unique_violation then
        raise exception 'ROLE_NAME_DUPLICATE';
      end;

      v_changed := true;
    end if;
  end if;

  -- ── Differenza sulle sole chiavi governate dal catalogo ────────────────
  --
  -- §7: «Conserva senza cancellazioni le configurazioni di moduli
  -- temporaneamente nascosti da feature flag.» Le chiavi fuori catalogo —
  -- per esempio le preferenze di notifica operative, che appartengono al
  -- dominio Notifiche e non a questa tassonomia — restano dove sono.
  select coalesce(array_agg(rp.permission_key), array[]::text[])
  into v_current
  from public.club_admin_role_permissions rp
  where rp.role_id = v_role.id and rp.permission_key = any (v_catalog);

  if exists (
    select 1 from unnest(v_current) as k(key) where not (k.key = any (v_target))
  ) or exists (
    select 1 from unnest(v_target) as k(key) where not (k.key = any (v_current))
  ) then
    v_changed := true;
  end if;

  delete from public.club_admin_role_permissions as rp
  where rp.role_id = v_role.id
    and rp.permission_key = any (v_catalog)
    and not (rp.permission_key = any (v_target));

  insert into public.club_admin_role_permissions (role_id, permission_key)
  select v_role.id, k.key from unnest(v_target) as k(key)
  on conflict do nothing;

  /* `dashboard_view` non è un'area: accompagna qualunque configurazione non
     vuota e sparisce con essa (§9). */
  if array_length(v_target, 1) is null then
    delete from public.club_admin_role_permissions as rp
    where rp.role_id = v_role.id and rp.permission_key = 'dashboard_view';
  else
    insert into public.club_admin_role_permissions (role_id, permission_key)
    values (v_role.id, 'dashboard_view')
    on conflict do nothing;
  end if;

  select * into v_role from public.club_admin_roles where id = v_role.id;

  -- §13: i poteri degli utilizzatori attivi cambiano **nella stessa
  -- transazione**, mantenendo i loro ambiti individuali.
  if v_changed then
    perform public.club_admin_reproject_role(v_role.id);
  end if;

  v_users := public.club_admin_role_user_count(v_role.id);

  if v_changed then
    insert into public.club_admin_audit
      (club_id, actor_id, operation, details)
    values (
      p_club_id, v_uid,
      case when v_created then 'role_created' else 'role_updated' end,
      jsonb_build_object(
        'role_id', v_role.id,
        'version', v_role.version,
        'config_version', v_role.config_version,
        'controls', v_expanded,
        'affected_admins', v_users
      )
    );
  end if;

  perform public.club_relationship_operation_record(
    p_idempotency_key, p_club_id, 'admin_role_save', v_fingerprint,
    jsonb_build_object(
      'role_id', v_role.id, 'name', v_role.name, 'version', v_role.version,
      'config_version', v_role.config_version, 'admins_count', v_users,
      'changed', v_changed
    )
  );

  return query
  select v_role.id, v_role.name, v_role.version, v_role.config_version,
         v_users, v_changed;
end;
$$;

revoke all on function public.save_society_admin_role(uuid, uuid, text, text[], integer, integer, integer, text) from public;
grant execute on function public.save_society_admin_role(uuid, uuid, text, text[], integer, integer, integer, text) to authenticated;

/**
 * Archivia un ruolo (§24).
 *
 * «Un ruolo con amministratori attivi che lo utilizzano non può essere
 * eliminato o reso inutilizzabile implicitamente» e «Prima di archiviare
 * verifica anche inviti pending ancora validi che referenziano il ruolo.»
 *
 * Nessun hard delete: il ruolo esce dai selector e resta interpretabile
 * nell'audit e nei riferimenti storici.
 */
create or replace function public.archive_society_admin_role(
  p_club_id          uuid,
  p_role_id          uuid,
  p_expected_version integer default null,
  p_idempotency_key  text default null
)
returns table (role_id uuid, is_active boolean, version integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_role    public.club_admin_roles%rowtype;
  v_users   integer;
  v_pending integer;
  v_fp      text;
  v_replay  jsonb;
begin
  if v_uid is null then
    raise exception 'ROLES_NOT_AUTHENTICATED';
  end if;

  if not public.society_role_editor_allows(p_club_id, 'admin_roles_manage') then
    raise exception 'ROLES_NOT_AUTHORIZED';
  end if;

  v_fp := md5(p_role_id::text || '|archive');

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, p_club_id, 'admin_role_archive', v_fp
  );

  if v_replay is not null then
    return query select (v_replay->>'role_id')::uuid,
                        (v_replay->>'is_active')::boolean,
                        (v_replay->>'version')::integer;
    return;
  end if;

  select * into v_role
  from public.club_admin_roles r
  where r.id = p_role_id and r.club_id = p_club_id
  for update;

  if not found then
    raise exception 'ROLE_NOT_FOUND';
  end if;

  if p_expected_version is not null and p_expected_version <> v_role.version then
    raise exception 'ROLE_VERSION_CONFLICT';
  end if;

  if not v_role.is_active then
    return query select v_role.id, v_role.is_active, v_role.version;
    return;
  end if;

  /* Il `for update` sopra più questi due conteggi formano la sezione
     critica di §24: «verifica atomica contro nuove assegnazioni/inviti».
     Un'assegnazione concorrente blocca sulla stessa riga ruolo. */
  v_users := public.club_admin_role_user_count(v_role.id);

  select count(*)::integer into v_pending
  from public.club_admin_invites inv
  where inv.club_id = p_club_id
    and inv.role_id = v_role.id
    and public.club_admin_invite_state(inv.status, inv.expires_at) = 'pending';

  if v_users > 0 or v_pending > 0 then
    raise exception 'ROLE_STILL_IN_USE';
  end if;

  update public.club_admin_roles set is_active = false where id = v_role.id;

  select * into v_role from public.club_admin_roles where id = v_role.id;

  insert into public.club_admin_audit (club_id, actor_id, operation, details)
  values (p_club_id, v_uid, 'role_archived',
          jsonb_build_object('role_id', v_role.id, 'version', v_role.version));

  perform public.club_relationship_operation_record(
    p_idempotency_key, p_club_id, 'admin_role_archive', v_fp,
    jsonb_build_object('role_id', v_role.id, 'is_active', false,
                       'version', v_role.version)
  );

  return query select v_role.id, v_role.is_active, v_role.version;
end;
$$;

revoke all on function public.archive_society_admin_role(uuid, uuid, integer, text) from public;
grant execute on function public.archive_society_admin_role(uuid, uuid, integer, text) to authenticated;


/** Cambio di ruolo di una membership attiva (screen 06). */
create or replace function public.assign_society_admin_role(
  p_club_id          uuid,
  p_profile_id       uuid,
  p_role_id          uuid,
  p_expected_version integer default null,
  p_idempotency_key  text default null
)
returns table (
  membership_id uuid,
  role_id       uuid,
  role_label    text,
  version       integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_owner  uuid;
  v_m      public.club_admin_memberships%rowtype;
  v_role   public.club_admin_roles%rowtype;
  v_caps   text[];
  v_fp     text;
  v_replay jsonb;
begin
  if v_uid is null then
    raise exception 'ADMIN_ACCESS_NOT_AUTHENTICATED';
  end if;

  if not public.society_admin_allows(p_club_id, 'admins_assign_role') then
    raise exception 'ADMIN_ACCESS_NOT_AUTHORIZED';
  end if;

  v_fp := md5(p_profile_id::text || '|role|' || coalesce(p_role_id::text, ''));

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, p_club_id, 'admin_role_assign', v_fp
  );

  if v_replay is not null then
    return query select (v_replay->>'membership_id')::uuid,
                        (v_replay->>'role_id')::uuid,
                        v_replay->>'role_label',
                        (v_replay->>'version')::integer;
    return;
  end if;

  /* §21: la protezione dell'Owner e il transfer condividono lo stesso
     confine atomico. Il lock sulla riga Società fa sì che un transfer
     concorrente non possa rendere Owner il target fra questa lettura e il
     commit. */
  select c.owner_profile_id into v_owner
  from public.clubs c where c.id = p_club_id for share;

  if p_profile_id = v_owner then
    raise exception 'ADMIN_OWNER_PROTECTED';
  end if;

  select * into v_m
  from public.club_admin_memberships m
  where m.club_id = p_club_id and m.profile_id = p_profile_id
  for update;

  if not found or v_m.status <> 'active' then
    raise exception 'ADMIN_MEMBERSHIP_NOT_FOUND';
  end if;

  if p_expected_version is not null and p_expected_version <> v_m.version then
    raise exception 'ADMIN_VERSION_CONFLICT';
  end if;

  if not public.club_admin_can_manage_target(p_club_id, v_m.id) then
    raise exception 'ADMIN_ACCESS_NOT_AUTHORIZED';
  end if;

  select * into v_role
  from public.club_admin_roles r
  where r.id = p_role_id and r.club_id = p_club_id
  for share;

  if not found or not v_role.is_active then
    raise exception 'ADMIN_ROLE_UNAVAILABLE';
  end if;

  -- §6: assegnare un ruolo è concedere il suo contenuto.
  if not public.owns_club(p_club_id) then
    v_caps := public.dashboard_club_capabilities(p_club_id);

    if exists (
      select 1 from public.club_admin_role_permissions rp
      where rp.role_id = v_role.id and not (rp.permission_key = any (v_caps))
    ) then
      raise exception 'ADMIN_ROLE_NOT_GRANTABLE';
    end if;
  end if;

  /* §14: «Non allargare automaticamente l'ambito per rendere valida la
     scelta.» `scope_mode` e le squadre non vengono toccati. */
  update public.club_admin_memberships
  set role_id             = v_role.id,
      role_config_version = v_role.config_version
  where id = v_m.id;

  perform public.club_admin_apply_membership_permissions(v_m.id);

  select * into v_m from public.club_admin_memberships where id = v_m.id;

  insert into public.club_admin_audit
    (club_id, actor_id, membership_id, subject_id, operation, details)
  values (p_club_id, v_uid, v_m.id, p_profile_id, 'membership_role_assigned',
          jsonb_build_object('role_id', v_role.id,
                             'role_config_version', v_role.config_version,
                             'version', v_m.version));

  perform public.club_relationship_operation_record(
    p_idempotency_key, p_club_id, 'admin_role_assign', v_fp,
    jsonb_build_object('membership_id', v_m.id, 'role_id', v_role.id,
                       'role_label', v_role.name, 'version', v_m.version)
  );

  return query select v_m.id, v_role.id, v_role.name, v_m.version;
end;
$$;

revoke all on function public.assign_society_admin_role(uuid, uuid, uuid, integer, text) from public;
grant execute on function public.assign_society_admin_role(uuid, uuid, uuid, integer, text) to authenticated;

/**
 * Modifica dell'ambito (screen 07, 08).
 *
 * §15: «Passaggio fra le modalità e sostituzione della lista avvengono
 * atomicamente. Non deve esserci una fase con due scope effettivi attivi
 * contemporaneamente.» Delete, insert e riproiezione stanno nella stessa
 * transazione: nessun lettore vede mai il perimetro vuoto intermedio.
 */
create or replace function public.update_society_admin_scope(
  p_club_id          uuid,
  p_profile_id       uuid,
  p_scope_mode       text,
  p_team_ids         uuid[] default null,
  p_expected_version integer default null,
  p_idempotency_key  text default null
)
returns table (
  membership_id uuid,
  scope_mode    text,
  scope_label   text,
  team_ids      uuid[],
  version       integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_owner  uuid;
  v_m      public.club_admin_memberships%rowtype;
  v_teams  uuid[];
  v_scope  uuid[];
  v_label  text;
  v_fp     text;
  v_replay jsonb;
begin
  if v_uid is null then
    raise exception 'ADMIN_ACCESS_NOT_AUTHENTICATED';
  end if;

  if not public.society_admin_allows(p_club_id, 'admins_manage_scope') then
    raise exception 'ADMIN_ACCESS_NOT_AUTHORIZED';
  end if;

  if p_scope_mode not in ('society', 'teams') then
    raise exception 'ADMIN_SCOPE_INVALID';
  end if;

  -- §16, QA-49: ID duplicati non producono doppio accesso né doppio count.
  select coalesce(array_agg(distinct t), array[]::uuid[])
  into v_teams
  from unnest(coalesce(p_team_ids, array[]::uuid[])) t;

  if p_scope_mode = 'teams' and array_length(v_teams, 1) is null then
    /* §15: «Zero Team non significa revoca, Nessun accesso o Intera
       società.» È una selezione incompleta, e si rifiuta. */
    raise exception 'ADMIN_SCOPE_EMPTY';
  end if;

  if p_scope_mode = 'society' then
    v_teams := array[]::uuid[];
  end if;

  v_fp := md5(
    p_profile_id::text || '|scope|' || p_scope_mode || '|' ||
    coalesce(array_to_string(
      (select array_agg(x::text order by x::text) from unnest(v_teams) x), ','), '')
  );

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, p_club_id, 'admin_scope_update', v_fp
  );

  if v_replay is not null then
    return query select (v_replay->>'membership_id')::uuid,
                        v_replay->>'scope_mode',
                        v_replay->>'scope_label',
                        (select coalesce(array_agg((x #>> '{}')::uuid), array[]::uuid[])
                           from jsonb_array_elements(v_replay->'team_ids') x),
                        (v_replay->>'version')::integer;
    return;
  end if;

  select c.owner_profile_id into v_owner
  from public.clubs c where c.id = p_club_id for share;

  if p_profile_id = v_owner then
    raise exception 'ADMIN_OWNER_PROTECTED';
  end if;

  select * into v_m
  from public.club_admin_memberships m
  where m.club_id = p_club_id and m.profile_id = p_profile_id
  for update;

  if not found or v_m.status <> 'active' then
    raise exception 'ADMIN_MEMBERSHIP_NOT_FOUND';
  end if;

  if p_expected_version is not null and p_expected_version <> v_m.version then
    raise exception 'ADMIN_VERSION_CONFLICT';
  end if;

  if not public.club_admin_can_manage_target(p_club_id, v_m.id) then
    raise exception 'ADMIN_ACCESS_NOT_AUTHORIZED';
  end if;

  -- §6: un actor non può concedere un perimetro che non possiede.
  if not public.owns_club(p_club_id) then
    v_scope := public.dashboard_club_scope(p_club_id);

    if p_scope_mode = 'society' and v_scope is not null then
      raise exception 'ADMIN_SCOPE_NOT_GRANTABLE';
    end if;

    if v_scope is not null and exists (
      select 1 from unnest(v_teams) t where not (t = any (v_scope))
    ) then
      raise exception 'ADMIN_SCOPE_NOT_GRANTABLE';
    end if;
  end if;

  /* §16: «Un Team uscito dall'insieme assegnabile prima del commit richiede
     correzione esplicita; non rimuoverlo silenziosamente.» */
  if exists (
    select 1 from unnest(v_teams) t
    where not exists (
      select 1 from public.club_teams ct
      where ct.id = t and ct.club_id = p_club_id
        and coalesce(ct.is_archived, false) = false
    )
  ) then
    raise exception 'ADMIN_TEAM_UNAVAILABLE';
  end if;

  update public.club_admin_memberships
  set scope_mode = p_scope_mode
  where id = v_m.id;

  delete from public.club_admin_membership_teams as mt where mt.membership_id = v_m.id;

  if p_scope_mode = 'teams' then
    insert into public.club_admin_membership_teams (membership_id, team_id)
    select v_m.id, t from unnest(v_teams) t;
  end if;

  perform public.club_admin_apply_membership_permissions(v_m.id);

  select * into v_m from public.club_admin_memberships where id = v_m.id;

  v_label := public.club_admin_scope_label(p_scope_mode, v_teams);

  insert into public.club_admin_audit
    (club_id, actor_id, membership_id, subject_id, operation, details)
  values (p_club_id, v_uid, v_m.id, p_profile_id, 'membership_scope_updated',
          jsonb_build_object('scope_mode', p_scope_mode,
                             'team_count', coalesce(array_length(v_teams, 1), 0),
                             'version', v_m.version));

  perform public.club_relationship_operation_record(
    p_idempotency_key, p_club_id, 'admin_scope_update', v_fp,
    jsonb_build_object('membership_id', v_m.id, 'scope_mode', p_scope_mode,
                       'scope_label', v_label, 'team_ids', to_jsonb(v_teams),
                       'version', v_m.version)
  );

  return query select v_m.id, p_scope_mode, v_label, v_teams, v_m.version;
end;
$$;

revoke all on function public.update_society_admin_scope(uuid, uuid, text, uuid[], integer, text) from public;
grant execute on function public.update_society_admin_scope(uuid, uuid, text, uuid[], integer, text) to authenticated;


/**
 * Revoca dell'accesso amministrativo (screen 09).
 *
 * §22: «Applica active → revoked/inactive secondo il dominio, preservando
 * riferimenti storici, ruolo/scope precedenti, timestamp e actor. Non
 * hard-delete della membership.» Le righe di `club_admin_membership_teams`
 * restano: sono lo scope che la persona aveva, e cancellarle renderebbe
 * illeggibile l'audit.
 *
 * Ciò che sparisce sono le **capability**: `club_member_permissions` viene
 * svuotata per quella persona su quella Società, ed è ciò che rende la
 * revoca effettiva su ogni modulo, non soltanto sulla Dashboard.
 */
create or replace function public.revoke_society_admin(
  p_club_id          uuid,
  p_profile_id       uuid,
  p_expected_version integer default null,
  p_idempotency_key  text default null
)
returns table (
  membership_id uuid,
  status        text,
  version       integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_owner  uuid;
  v_m      public.club_admin_memberships%rowtype;
  v_self   boolean;
  v_fp     text;
  v_replay jsonb;
begin
  if v_uid is null then
    raise exception 'ADMIN_ACCESS_NOT_AUTHENTICATED';
  end if;

  v_self := p_profile_id = v_uid;

  /* §22: «Per l'eventuale self-leave già supportato, riutilizza la revoca
     della propria membership.» Lasciare il proprio accesso non richiede il
     diritto di revocare quello altrui — ma l'Owner deve prima trasferire, e
     la protezione sotto glielo impedisce. */
  if not v_self and not public.society_admin_allows(p_club_id, 'admins_revoke') then
    raise exception 'ADMIN_ACCESS_NOT_AUTHORIZED';
  end if;

  v_fp := md5(p_profile_id::text || '|revoke');

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, p_club_id, 'admin_revoke', v_fp
  );

  if v_replay is not null then
    return query select (v_replay->>'membership_id')::uuid,
                        v_replay->>'status',
                        (v_replay->>'version')::integer;
    return;
  end if;

  /* §21: «Una revoca che vede un normale amministratore prima di un transfer
     non può revocarlo dopo che è diventato Owner. Entrambe le operazioni
     devono validare la protezione nello stesso confine atomico.»
     `for share` attende un transfer in corso e rilegge l'Owner committato. */
  select c.owner_profile_id into v_owner
  from public.clubs c where c.id = p_club_id for share;

  if p_profile_id = v_owner then
    raise exception 'ADMIN_OWNER_PROTECTED';
  end if;

  select * into v_m
  from public.club_admin_memberships m
  where m.club_id = p_club_id and m.profile_id = p_profile_id
  for update;

  if not found then
    raise exception 'ADMIN_MEMBERSHIP_NOT_FOUND';
  end if;

  if v_m.status <> 'active' then
    -- §22: «Retry già applicato produce stato coerente senza ulteriori
    -- effetti.» Non è un errore: è lo stato reale.
    return query select v_m.id, v_m.status, v_m.version;
    return;
  end if;

  if p_expected_version is not null and p_expected_version <> v_m.version then
    raise exception 'ADMIN_VERSION_CONFLICT';
  end if;

  if not v_self and not public.club_admin_can_manage_target(p_club_id, v_m.id) then
    raise exception 'ADMIN_ACCESS_NOT_AUTHORIZED';
  end if;

  update public.club_admin_memberships
  set status     = 'revoked',
      revoked_at = timezone('utc', now()),
      revoked_by = v_uid
  where id = v_m.id;

  perform public.club_admin_apply_membership_permissions(v_m.id);

  /* Una membership anteriore al catalogo ruoli non passa dalla
     riproiezione (non ha ruolo): i suoi grant vanno rimossi comunque,
     altrimenti la revoca sarebbe soltanto un'etichetta. */
  if v_m.role_id is null then
    delete from public.club_member_permissions as perm
    where perm.club_id = p_club_id and perm.profile_id = p_profile_id;
  end if;

  select * into v_m from public.club_admin_memberships where id = v_m.id;

  insert into public.club_admin_audit
    (club_id, actor_id, membership_id, subject_id, operation, details)
  values (p_club_id, v_uid, v_m.id, p_profile_id, 'membership_revoked',
          jsonb_build_object('role_id', v_m.role_id,
                             'scope_mode', v_m.scope_mode,
                             'self', v_self,
                             'version', v_m.version));

  perform public.club_relationship_operation_record(
    p_idempotency_key, p_club_id, 'admin_revoke', v_fp,
    jsonb_build_object('membership_id', v_m.id, 'status', v_m.status,
                       'version', v_m.version)
  );

  return query select v_m.id, v_m.status, v_m.version;
end;
$$;

revoke all on function public.revoke_society_admin(uuid, uuid, integer, text) from public;
grant execute on function public.revoke_society_admin(uuid, uuid, integer, text) to authenticated;

/**
 * Annullamento di un invito pending (screen 10).
 *
 * §23: «Cancel contro accept ha una sola transizione vincente. Se accept ha
 * già creato l'accesso, annullare il vecchio pending non deve revocare
 * implicitamente la membership.» Il `for update` sull'invito è il confine:
 * chi arriva secondo legge lo stato già scritto dal primo e non esegue
 * nulla.
 *
 * «Invalida tutti i token/handle collegati alla stessa proposta. Il
 * controllo deve impedire l'accept anche se un job di pulizia o una cache
 * link non è ancora aggiornato»: gli handle vengono revocati qui, nella
 * stessa transizione, non da un job.
 */
create or replace function public.cancel_society_admin_invite(
  p_club_id           uuid,
  p_invite_id         uuid,
  p_expected_revision integer default null,
  p_idempotency_key   text default null
)
returns table (
  invite_id uuid,
  state     text,
  membership_profile_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_inv    public.club_admin_invites%rowtype;
  v_state  text;
  v_fp     text;
  v_replay jsonb;
begin
  if v_uid is null then
    raise exception 'ADMIN_INVITE_NOT_AUTHENTICATED';
  end if;

  if not public.society_admin_allows(p_club_id, 'admin_invites_cancel') then
    raise exception 'ADMIN_INVITE_NOT_AUTHORIZED';
  end if;

  v_fp := md5(p_invite_id::text || '|cancel');

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, p_club_id, 'admin_invite_cancel', v_fp
  );

  if v_replay is not null then
    return query select (v_replay->>'invite_id')::uuid, v_replay->>'state',
                        nullif(v_replay->>'membership_profile_id', '')::uuid;
    return;
  end if;

  select * into v_inv
  from public.club_admin_invites inv
  where inv.id = p_invite_id and inv.club_id = p_club_id
  for update;

  if not found then
    raise exception 'ADMIN_INVITE_UNAVAILABLE';
  end if;

  v_state := public.club_admin_invite_state(v_inv.status, v_inv.expires_at);

  if v_state <> 'pending' then
    return query select v_inv.id, v_state,
      case when v_state = 'accepted' then v_inv.recipient_profile_id end;
    return;
  end if;

  if p_expected_revision is not null and p_expected_revision <> v_inv.revision then
    raise exception 'ADMIN_INVITE_REVISION_CONFLICT';
  end if;

  update public.club_admin_invites
  set status = 'revoked', revoked_at = timezone('utc', now())
  where id = v_inv.id;

  update public.club_admin_invite_handles
  set revoked_at = timezone('utc', now())
  where invite_id = v_inv.id and revoked_at is null;

  insert into public.club_admin_audit
    (club_id, actor_id, invite_id, subject_id, operation, details)
  values (p_club_id, v_uid, v_inv.id, v_inv.recipient_profile_id,
          'invite_cancelled', jsonb_build_object('revision', v_inv.revision));

  perform public.club_relationship_operation_record(
    p_idempotency_key, p_club_id, 'admin_invite_cancel', v_fp,
    jsonb_build_object('invite_id', v_inv.id, 'state', 'revoked',
                       'membership_profile_id', null)
  );

  return query select v_inv.id, 'revoked'::text, null::uuid;
end;
$$;

revoke all on function public.cancel_society_admin_invite(uuid, uuid, integer, text) from public;
grant execute on function public.cancel_society_admin_invite(uuid, uuid, integer, text) to authenticated;


/**
 * Trasferimento dell'ownership (screen 11, 12).
 *
 * §21 elenca sette passaggi in una sola transazione. L'ordine qui è quello,
 * e il `for update` sulla riga Società è ciò che li rende una sezione
 * critica: due transfer concorrenti si serializzano, e il secondo trova un
 * Owner diverso da quello atteso.
 *
 * «Non usare due richieste indipendenti per prima rimuovere Marco e poi
 * promuovere Luca. Non è valido un commit senza Owner, con due Owner o con
 * precedente Owner lasciato in un accesso incoerente.» `clubs` ha un solo
 * `owner_profile_id`: due Owner non sono rappresentabili, e zero neppure —
 * la colonna è `not null`.
 *
 * La configurazione operativa del vecchio Owner è parte **dello stesso
 * comando** (§21 punto 4): o viene applicata con il trasferimento, o il
 * trasferimento non avviene.
 */
create or replace function public.transfer_society_ownership(
  p_club_id           uuid,
  p_new_owner_id      uuid,
  p_expected_version  integer default null,
  p_legacy_role_id    uuid default null,
  p_legacy_scope_mode text default null,
  p_legacy_team_ids   uuid[] default null,
  p_idempotency_key   text default null
)
returns table (
  club_id            uuid,
  new_owner_id       uuid,
  previous_owner_id  uuid,
  ownership_version  integer,
  legacy_membership_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_club    public.clubs%rowtype;
  v_target  public.club_admin_memberships%rowtype;
  v_legacy  public.club_admin_memberships%rowtype;
  v_role    public.club_admin_roles%rowtype;
  v_mode    text;
  v_teams   uuid[];
  v_mid     uuid;
  v_version integer;
  v_fp      text;
  v_replay  jsonb;
begin
  if v_uid is null then
    raise exception 'OWNER_TRANSFER_NOT_AUTHENTICATED';
  end if;

  v_fp := md5(p_club_id::text || '|owner|' || p_new_owner_id::text);

  v_replay := public.club_relationship_operation_replay(
    p_idempotency_key, p_club_id, 'owner_transfer', v_fp
  );

  /* §21: «Doppio tap e retry della stessa operazione restituiscono il
     risultato canonico senza un nuovo trasferimento.» */
  if v_replay is not null then
    return query select (v_replay->>'club_id')::uuid,
                        (v_replay->>'new_owner_id')::uuid,
                        (v_replay->>'previous_owner_id')::uuid,
                        (v_replay->>'ownership_version')::integer,
                        nullif(v_replay->>'legacy_membership_id', '')::uuid;
    return;
  end if;

  -- 1. sessione e Owner corrente
  select * into v_club from public.clubs c where c.id = p_club_id for update;

  if not found then
    raise exception 'OWNER_TRANSFER_NOT_AUTHORIZED';
  end if;

  if v_club.owner_profile_id is distinct from v_uid then
    /* §21: «Se un altro trasferimento ha già cambiato l'Owner, il vecchio
       actor non può completare una richiesta rimasta aperta.» */
    raise exception 'OWNER_CHANGED';
  end if;

  if p_expected_version is not null
     and p_expected_version <> v_club.ownership_version then
    raise exception 'OWNER_CHANGED';
  end if;

  -- 2. destinatario distinto, valido e attivo nella stessa Società
  if p_new_owner_id is null or p_new_owner_id = v_uid then
    raise exception 'OWNER_CANDIDATE_INVALID';
  end if;

  select * into v_target
  from public.club_admin_memberships m
  where m.club_id = p_club_id and m.profile_id = p_new_owner_id
  for update;

  if not found or v_target.status <> 'active' then
    raise exception 'OWNER_CANDIDATE_INVALID';
  end if;

  -- 3. configurazione post-transfer del vecchio Owner
  select * into v_legacy
  from public.club_admin_memberships m
  where m.club_id = p_club_id and m.profile_id = v_uid
  for update;

  if found and v_legacy.status = 'active' and v_legacy.role_id is not null then
    /* §20: «Se il precedente Owner ha già un ruolo operativo e un ambito
       validi, preservali e mostrali come riepilogo. Non obbligare a
       riconfigurarli soltanto per aprire questa schermata.» */
    v_mid := v_legacy.id;
  else
    if p_legacy_role_id is null
       or coalesce(p_legacy_scope_mode, '') not in ('society', 'teams') then
      raise exception 'OWNER_LEGACY_CONFIG_REQUIRED';
    end if;

    select * into v_role
    from public.club_admin_roles r
    where r.id = p_legacy_role_id and r.club_id = p_club_id and r.is_active;

    if not found then
      raise exception 'ADMIN_ROLE_UNAVAILABLE';
    end if;

    v_mode := p_legacy_scope_mode;

    select coalesce(array_agg(distinct t), array[]::uuid[])
    into v_teams
    from unnest(coalesce(p_legacy_team_ids, array[]::uuid[])) t;

    if v_mode = 'teams' then
      if array_length(v_teams, 1) is null then
        raise exception 'ADMIN_SCOPE_EMPTY';
      end if;

      if exists (
        select 1 from unnest(v_teams) t
        where not exists (
          select 1 from public.club_teams ct
          where ct.id = t and ct.club_id = p_club_id
            and coalesce(ct.is_archived, false) = false
        )
      ) then
        raise exception 'ADMIN_TEAM_UNAVAILABLE';
      end if;
    else
      v_teams := array[]::uuid[];
    end if;

    -- 4. la configurazione è parte **dello stesso comando**
    insert into public.club_admin_memberships (
      club_id, profile_id, role_id, role_config_version, scope_mode,
      status, granted_by, activated_at, revoked_at, revoked_by
    )
    values (
      p_club_id, v_uid, v_role.id, v_role.config_version, v_mode,
      'active', v_uid, timezone('utc', now()), null, null
    )
    on conflict on constraint club_admin_memberships_unique do update
    set role_id             = excluded.role_id,
        role_config_version = excluded.role_config_version,
        scope_mode          = excluded.scope_mode,
        status              = 'active',
        granted_by          = excluded.granted_by,
        activated_at        = excluded.activated_at,
        revoked_at          = null,
        revoked_by          = null
    returning id into v_mid;

    delete from public.club_admin_membership_teams as mt where mt.membership_id = v_mid;

    if v_mode = 'teams' then
      insert into public.club_admin_membership_teams (membership_id, team_id)
      select v_mid, t from unnest(v_teams) t;
    end if;
  end if;

  -- 5. la relazione protetta si sposta
  update public.clubs
  set owner_profile_id  = p_new_owner_id,
      ownership_version = ownership_version + 1
  where id = p_club_id;

  select ownership_version into v_version from public.clubs where id = p_club_id;

  /* Il vecchio Owner diventa un amministratore ordinario: i suoi poteri ora
     derivano dal ruolo, non più da `owns_club`. La proiezione va fatta
     **dopo** il cambio di proprietà, altrimenti
     `club_admin_grantable_keys` e i predicati che chiama leggerebbero
     ancora l'ownership. */
  perform public.club_admin_apply_membership_permissions(v_mid);

  /* Il nuovo Owner conserva la propria membership: §20 vuole che la sua
     «configurazione operativa resti separata», e l'accesso completo gli
     arriva dalla relazione protetta, non da essa. I grant residui non
     allargano nulla — `owns_club` li sovrasta — e tornano a determinare
     l'accesso ordinario se l'ownership verrà trasferita di nuovo. */

  -- 6. revisioni, storico e audit
  insert into public.club_ownership_transfers
    (club_id, previous_owner, new_owner, performed_by, ownership_version)
  values (p_club_id, v_uid, p_new_owner_id, v_uid, v_version);

  insert into public.club_admin_audit
    (club_id, actor_id, membership_id, subject_id, operation, details)
  values (p_club_id, v_uid, v_mid, p_new_owner_id, 'ownership_transferred',
          jsonb_build_object('previous_owner', v_uid,
                             'new_owner', p_new_owner_id,
                             'ownership_version', v_version));

  perform public.club_relationship_operation_record(
    p_idempotency_key, p_club_id, 'owner_transfer', v_fp,
    jsonb_build_object('club_id', p_club_id, 'new_owner_id', p_new_owner_id,
                       'previous_owner_id', v_uid,
                       'ownership_version', v_version,
                       'legacy_membership_id', v_mid)
  );

  -- 7. esattamente un Owner attivo
  return query select p_club_id, p_new_owner_id, v_uid, v_version, v_mid;
end;
$$;

revoke all on function public.transfer_society_ownership(uuid, uuid, integer, uuid, text, uuid[], text) from public;
grant execute on function public.transfer_society_ownership(uuid, uuid, integer, uuid, text, uuid[], text) to authenticated;


-- ============================================================
-- SEZIONE 10 — Ingressi riallineati (§2, §8)
--
-- «Parti dal Centro Amministratori della DAS-REV-13. Completa le
-- destinazioni che quel centro e l'hub Struttura societaria aprono.»
--
-- `can_open_roles` era `owns_club and admin_roles_view`: la destinazione
-- reale era la vecchia schermata gated sul ruolo `club_admin`, e dichiararla
-- accessibile a un delegato avrebbe prodotto un chevron morto. Adesso la
-- destinazione esiste e legge la stessa chiave, quindi il doppio gate
-- diventa la restrizione arbitraria che §6 vieta.
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
  v_roles   := public.society_admin_allows(p_club_id, 'admin_roles_view');

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
      (select coalesce(extract(epoch from max(r.updated_at))::bigint, 0)
       from public.club_admin_roles r where r.club_id = p_club_id),
      (extract(epoch from c.updated_at)::bigint)
    )
  from public.clubs c
  where c.id = p_club_id;
end;
$$;

revoke all on function public.fetch_society_admin_center(uuid) from public;
grant execute on function public.fetch_society_admin_center(uuid) to authenticated;


-- ============================================================
-- SEZIONE 11 — «Dati della società» diventa una capability reale (§7, §17)
--
-- Finora la lettura dei dati master nell'hub era derivata: Owner oppure
-- perimetro societario. Un ruolo che concede «Dati della società →
-- Visualizza» — che lo screen 03 del mockup mostra — non avrebbe avuto
-- effetto.
--
-- La condizione resta additiva: nessuno perde l'accesso che aveva, e la
-- chiave ne apre uno nuovo. §32: «Preserva membership legittime, ruoli,
-- scope, inviti e audit; non inventare consenso.»
-- ============================================================

create or replace function public.society_can_read_company_data(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.owns_club(p_club_id)
    or public.society_admin_allows(p_club_id, 'society_profile_view')
    or public.dashboard_club_scope(p_club_id) is null;
$$;

revoke all on function public.society_can_read_company_data(uuid) from public;
grant execute on function public.society_can_read_company_data(uuid) to authenticated;

comment on function public.society_can_read_company_data(uuid) is
  'DAS-REV-14 §7: lettura dei dati master della Società. Owner, chiave '
  'society_profile_view, oppure perimetro societario — la terza condizione '
  'conserva l''accesso di chi lo aveva prima che la chiave esistesse.';

do $$
declare
  v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'fetch_society_structure'
  limit 1;

  if v_src is null then
    return;
  end if;

  /* L'hub è di DAS-REV-12 e la sua riga `v_company` è una sola espressione.
     Riscrivere l'intera funzione qui significherebbe duplicarne 370 righe e
     farle divergere alla prossima modifica; si sostituisce il predicato. */
  if position('public.society_can_read_company_data(p_club_id)' in v_src) = 0 then
    v_src := replace(
      v_src,
      'v_company := v_owner or public.dashboard_club_scope(p_club_id) is null;',
      'v_company := public.society_can_read_company_data(p_club_id);'
    );

    execute v_src;
  end if;
end;
$$;


-- ============================================================
-- SEZIONE 12 — Riproiezione degli accessi esistenti
--
-- Le membership create da DAS-REV-13 portano già le chiavi del ruolo in
-- `club_member_permissions`, ma senza la regola societaria/di squadra di
-- §17: con ambito selettivo anche `admins_view` o `network_view` erano
-- scritte con un `team_id`, e `dashboard_club_capabilities` le scartava.
-- Erano quindi grant inerti.
--
-- La riproiezione li riallinea senza concedere nulla di nuovo: le chiavi
-- restano quelle del ruolo già accettato, cambia soltanto il `team_id` con
-- cui vengono scritte. Le membership senza ruolo nominato non vengono
-- toccate (la funzione esce subito).
-- ============================================================

do $$
declare
  v_row record;
begin
  for v_row in
    select m.id
    from public.club_admin_memberships m
    where m.status = 'active' and m.role_id is not null
  loop
    perform public.club_admin_apply_membership_permissions(v_row.id);
  end loop;
end;
$$;
