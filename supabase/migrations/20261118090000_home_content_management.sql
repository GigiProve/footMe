-- ============================================================
-- HOM-04 — Gestione contenuto e stati: dati
--
-- COSA MANCAVA
--
-- Il Feed (HOM-01/02/03) mostra il menu ••• ma il server non sa cosa un utente
-- può fare di un contenuto già pubblicato. Il task HOM-04 (§21–§25, §33, §45–§55,
-- §63–§66, §70–§81, §88–§103) chiede capability gestionali vere, un
-- eliminare che si propaga a tutte le superfici e interazioni che non
-- sopravvivono alla cancellazione. Oggi:
--
--   1. `footme_post_payloads` dichiarava can_edit = can_delete = is_own e
--      can_view_insights = false (§21, §24). is_own per una Società è
--      `clubs.owner_profile_id`: un amministratore delegato non poteva mai
--      gestire un contenuto della Società, e nessuna regola era riusabile da
--      un endpoint (§33: «nascondere un'azione nel client non è sicurezza»).
--   2. Non esiste un eliminare. Le tabelle contenuto ammettono un DELETE fisico
--      diretto per il proprietario (per club_media_posts: `owns_club`, `for all`),
--      che per cascata porta via like, commenti, salvataggi e tag senza traccia,
--      senza audit (§99) e senza un esito che il client possa leggere (§101).
--      Due richieste concorrenti dello stesso delete non hanno una semantica
--      (§75–§76).
--   3. I Salvati (`fetch_saved_items` / `fetch_saved_counts`, definer) uniscono
--      le tabelle contenuto senza filtrare lo stato: un contenuto non più
--      pubblicato resta elencato e apribile (§51).
--   4. Commenti, salvataggi e tag si possono inserire su un contenuto non
--      pubblicato: il Like già rifiuta (`set_content_like`), gli altri no
--      (§78–§80).
--   5. Il payload non porta una versione per il futuro editor (§73–§74).
--
-- DECISIONI DI LUIGI (2026-11-13) CHE QUESTA MIGRAZIONE REALIZZA
--
--   * Società: chiavi nuove nel catalogo DAS-REV-14, nessun ruolo parallelo
--     (§97): `content_edit`, `content_delete`, `content_insights`. Owner
--     implicito come ovunque (`has_club_permission`).
--   * Soft delete: stato `deleted` + `deleted_at` + `deleted_by_profile_id`; una
--     RPC unica; DELETE diretto chiuso.
--
-- PERCHÉ QUESTA SOLUZIONE
--
--   * UNA regola per le capability. `footme_content_rights` (interna) dice cosa
--     l'utente corrente può fare di un contenuto INDIPENDENTEMENTE dal suo stato;
--     `content_manage_capabilities` (RPC) la combina con «è pubblicato» (§92);
--     `footme_post_payloads` (Feed e dettaglio) chiama quella RPC; `delete_content`
--     rilegge la stessa regola sotto lock (§33, §70). Il Feed, il menu e il
--     comando non possono quindi divergere.
--   * Il catalogo ha un'AREA nuova `published_content` con scope_kind 'society':
--     i contenuti pubblicati non hanno una Squadra (club_media_posts non ha
--     team_id) e `has_club_permission` accetta qualunque riga della chiave, quindi
--     in un'area 'team' un amministratore con Ambito selettivo (una sola Squadra)
--     eliminerebbe i comunicati dell'intera Società. In un'area 'society' le
--     chiavi si materializzano sempre con team_id null (§17 di DAS-REV-14).
--   * Soft delete invece di DELETE fisico: l'esito è definitivo per l'utente
--     (§100) ma conserva audit, retention e la possibilità di una futura policy
--     di purge. Le viste di lettura (feed_content_index, media_content_index,
--     tag/profilo) filtrano già status = 'published': il contenuto sparisce da
--     Feed, Cerca e Profilo per costruzione (§50–§53). Una policy RESTRICTIVE di
--     select nasconde inoltre le righe 'deleted' a ogni lettura client (dettaglio,
--     griglie, join invoker) e una RESTRICTIVE di delete chiude il DELETE (§54).
--   * RLS filtra righe, non colonne: la transizione verso 'deleted' è protetta da
--     un trigger. Passa solo se la RPC ha impostato un flag locale alla
--     transazione E il ruolo corrente non è anon/authenticated (dentro la RPC
--     definer current_user è il proprietario della funzione). Da 'deleted' non si
--     esce mai, nemmeno con service role (§92).
--   * Idempotenza (§75–§76): la RPC prende `for update` sulla riga, poi rilegge
--     stato e capability. Il secondo delete trova 'deleted' e risponde
--     already_deleted senza scrivere un secondo cambio di stato.
--   * Commenti, salvataggi e tag: trigger BEFORE INSERT che leggono lo stato del
--     padre (definer: RLS non deve nascondere la riga al guard). Commenti e
--     salvataggi richiedono 'published'. I tag NO: bozze e archiviati
--     (draft/archived) li portano legittimamente dal composer; sono rifiutati solo
--     quando il padre è 'deleted' o 'removed'.
--   * Salvati: `fetch_saved_items` / `fetch_saved_counts` riemesse dalla
--     definizione più recente (20260726120000) con `status = 'published'` su ogni
--     join contenuto; elenco e contatore restano allineati.
--
-- COSA NON FA (dichiarato, non dimenticato)
--
--   * Audit dei rifiuti: `delete_content` solleva 42501 e l'eccezione annulla la
--     transazione, quindi la riga di audit di un rifiuto non può sopravvivere nello
--     stesso DB. Si registrano `deleted` e `already_deleted`.
--   * Nessun backfill dei ruoli: le tre chiavi non sono concesse a nessun ruolo
--     esistente (oggi un delegato non può gestire nulla: nessun allargamento
--     implicito). Si assegnano dall'editor ruoli.
--   * `dashboard_club_capabilities` NON è riemessa: le tre chiavi non sono lette
--     dalla Dashboard ma solo da `has_club_permission`. Quindi non compaiono nelle
--     capability del Dashboard dell'Owner.
--   * Modifica e statistiche (HOM-05, HOM-06.x) non esistono: qui solo la
--     capability. Le policy di scrittura di club_media_posts restano `owns_club`:
--     quando HOM-06 userà can_edit per un delegato servirà un comando definer.
--   * Commenti e Like del contenuto eliminato restano nel DB (retention §89) ma
--     non sono raggiungibili: il padre non è leggibile e il Feed non lo emette.
--   * Reference chat, Repost e Share (§79, §81–§87) non hanno tabelle oggi.
--   * Una concorrenza reale non è riproducibile in PGlite (una connessione):
--     `for update` + rilettura sono verificati nelle conseguenze.
--
-- PRIVACY / PERMESSI
--
--   * anon: `revoke execute ... from anon` su ogni funzione; revoke dei DELETE
--     da anon e authenticated sulle sei tabelle.
--   * `content_manage_capabilities` e `delete_content` verificano auth.uid().
--     Le funzioni interne (rights, table, guard) non sono eseguibili dai client.
--   * `content_management_audit`: RLS attiva, nessuna policy, nessun grant ai
--     client. `acting` = chi ha eseguito materialmente (§25), mai nel payload.
--   * `delete_content` non rivela l'esistenza: id inesistente, non leggibile o di
--     altri non pubblicato rispondono tutti `unavailable` (§65).
--
-- ROLLOUT
--
--   * Additiva. I CHECK di stato vengono ricostruiti con 'deleted' in più (i
--     vecchi vengono cercati per definizione, non per nome: schema drift). Le
--     tabelle sono piccole, il lock è breve.
--   * Il payload guadagna `version` e le tre capability cambiano valore per gli
--     amministratori delegati (true solo se concesse). Un client precedente
--     continua a funzionare.
--   * `deleteClubMediaPost` e `deleteFanMediaPost` (client) usavano DELETE diretto e
--     non hanno chiamanti: dopo questa migrazione fallirebbero. Vanno puntati su
--     `delete_content` se mai riusati.
--   * Schema drift: nessuna colonna di recruiting_ads toccata.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — catalogo permessi DAS-REV-14, revisione 8 (§97)
--
-- Riemesse le due whitelist di chiavi dalla definizione più recente
-- (20261113090000 §9) con tre chiavi in più; nessun'altra differenza.
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
    'groups_create',
    'groups_manage',
    'groups_delete',
    'content_edit',
    'content_delete',
    'content_insights'
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
    'groups_create',
    'groups_manage',
    'groups_delete',
    'content_edit',
    'content_delete',
    'content_insights'
  ));

/* Area nuova, in coda (groups = 10): nessun sort_order spostato. Scope
   'society': i contenuti pubblicati non hanno una Squadra, vedi header. */
insert into public.club_permission_areas
  (id, label, description, sort_order, scope_kind, is_available) values
  ('published_content', 'Contenuti pubblicati',
     'Modifica, eliminazione e statistiche dei contenuti pubblicati dalla società.',
     11, 'society', true)
on conflict (id) do update
  set label        = excluded.label,
      description  = excluded.description,
      sort_order   = excluded.sort_order,
      scope_kind   = excluded.scope_kind,
      is_available = excluded.is_available;

/* Nessun `requires`: le dipendenze sono per definizione della stessa area e
   questi tre poteri non dipendono dalla lettura della Dashboard. Le statistiche
   sono una lettura (bundle 'view'); modifica ed eliminazione sono gestionali. */
insert into public.club_permission_controls
  (id, area_id, label, helper, bundle, requires, sort_order, is_available) values
  ('content_edit', 'published_content', 'Modifica contenuti pubblicati', null,
     'manage', array[]::text[], 1, true),
  ('content_delete', 'published_content', 'Elimina contenuti pubblicati', null,
     'manage', array[]::text[], 2, true),
  ('content_insights', 'published_content', 'Visualizza dettagli e statistiche dei contenuti', null,
     'view',   array[]::text[], 3, true)
on conflict (id) do update
  set area_id      = excluded.area_id,
      label        = excluded.label,
      helper       = excluded.helper,
      bundle       = excluded.bundle,
      requires     = excluded.requires,
      sort_order   = excluded.sort_order,
      is_available = excluded.is_available;

insert into public.club_permission_control_keys (control_id, permission_key) values
  ('content_edit',     'content_edit'),
  ('content_delete',   'content_delete'),
  ('content_insights', 'content_insights')
on conflict do nothing;

/* Revisione 8. Nessun backfill: un delegato oggi non può gestire nulla, le
   chiavi si concedono solo dall'editor ruoli. */
insert into public.app_policy_settings (key, value, description)
values (
  'admin_permission_catalog_revision',
  to_jsonb(8),
  'DAS-REV-14 §7 — revisione della tassonomia aree/controlli/chiavi. Va '
  'incrementata da ogni migrazione che cambia il catalogo.'
)
on conflict (key) do update set value = to_jsonb(8);


-- ============================================================
-- SEZIONE 2 — stato 'deleted' sulle sei tabelle contenuto
--
-- Il CHECK di stato vecchio si cerca per definizione (contiene `status` e
-- 'published'), non per nome: lo schema remoto può avere nomi diversi. Un
-- secondo CHECK garantisce che `deleted_at` e lo stato 'deleted' coincidano.
-- ============================================================

do $$
declare
  t record;
  c record;
begin
  for t in
    select * from (values
      ('profile_posts',       array['published', 'hidden', 'removed']),
      ('club_media_posts',    array['draft', 'published', 'archived']),
      ('fan_media_posts',     array['draft', 'published', 'archived']),
      ('fan_tribuna_posts',   array['draft', 'published', 'archived']),
      ('media_profile_posts', array['draft', 'published', 'archived']),
      ('media_tribuna_posts', array['draft', 'published', 'archived'])
    ) as v(tbl, states)
  loop
    execute format(
      'alter table public.%I
         add column if not exists deleted_at timestamptz,
         add column if not exists deleted_by_profile_id uuid references public.profiles(id) on delete set null',
      t.tbl);

    for c in
      select con.conname
      from pg_constraint con
      where con.conrelid = format('public.%I', t.tbl)::regclass
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) ~ '\mstatus\M'
        and pg_get_constraintdef(con.oid) ~ 'published'
    loop
      execute format('alter table public.%I drop constraint %I', t.tbl, c.conname);
    end loop;

    execute format(
      'alter table public.%I add constraint %I check (status = any (%L::text[]))',
      t.tbl, t.tbl || '_status_check', array_append(t.states, 'deleted'));

    execute format('alter table public.%I drop constraint if exists %I', t.tbl, t.tbl || '_deleted_consistency_check');
    execute format(
      'alter table public.%I add constraint %I check ((status = ''deleted'') = (deleted_at is not null))',
      t.tbl, t.tbl || '_deleted_consistency_check');
  end loop;
end
$$;


-- ============================================================
-- SEZIONE 3 — guard della transizione di stato
--
-- Verso 'deleted' solo dalla RPC: flag locale alla transazione impostato da
-- `delete_content` E ruolo corrente diverso da anon/authenticated (dentro la
-- RPC definer current_user è il proprietario della funzione; un client che
-- esegue UPDATE diretto è `authenticated`). Da 'deleted' non si esce, per
-- nessun ruolo. Un INSERT non può creare righe già eliminate.
-- ============================================================

create or replace function public.content_status_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'deleted' or new.deleted_at is not null or new.deleted_by_profile_id is not null then
      raise exception 'content_status_forbidden' using errcode = '42501';
    end if;
    return new;
  end if;

  if old.status = 'deleted' and new.status is distinct from old.status then
    raise exception 'content_status_forbidden' using errcode = '42501';
  end if;

  if new.status = 'deleted' and old.status is distinct from 'deleted' then
    if coalesce(current_setting('prolink.content_delete', true), '') <> 'on'
       or current_user in ('anon', 'authenticated') then
      raise exception 'content_status_forbidden' using errcode = '42501';
    end if;
  elsif new.deleted_at is distinct from old.deleted_at
     or new.deleted_by_profile_id is distinct from old.deleted_by_profile_id then
    raise exception 'content_status_forbidden' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.content_status_guard() from public;
revoke execute on function public.content_status_guard() from anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profile_posts', 'club_media_posts', 'fan_media_posts',
    'fan_tribuna_posts', 'media_profile_posts', 'media_tribuna_posts'
  ]
  loop
    execute format('drop trigger if exists content_status_guard on public.%I', t);
    execute format(
      'create trigger content_status_guard before insert or update on public.%I
         for each row execute function public.content_status_guard()', t);

    -- Le righe eliminate sono invisibili ai client; il DELETE fisico è chiuso
    -- (privilegi + policy, perché una grant futura non lo riapra).
    execute format('revoke delete on table public.%I from anon, authenticated', t);

    execute format('drop policy if exists "deleted content hidden from clients" on public.%I', t);
    execute format(
      'create policy "deleted content hidden from clients" on public.%I
         as restrictive for select to public using (status <> ''deleted'')', t);

    execute format('drop policy if exists "content hard delete closed" on public.%I', t);
    execute format(
      'create policy "content hard delete closed" on public.%I
         as restrictive for delete to public using (false)', t);
  end loop;
end
$$;


-- ============================================================
-- SEZIONE 4 — regola delle capability (una sola)
-- ============================================================

-- Tabella di un content_type (whitelist chiusa: l'unica fonte dei nomi
-- tabella che la RPC usa in SQL dinamico). Interna.
create or replace function public.footme_content_table(p_content_type text)
returns text
language sql
immutable
as $$
  select case p_content_type
    when 'profile_post'   then 'profile_posts'
    when 'club_media'     then 'club_media_posts'
    when 'fan_media'      then 'fan_media_posts'
    when 'fan_tribuna'    then 'fan_tribuna_posts'
    when 'media_profile'  then 'media_profile_posts'
    when 'media_tribuna'  then 'media_tribuna_posts'
  end;
$$;

revoke all on function public.footme_content_table(text) from public;
revoke execute on function public.footme_content_table(text) from anon, authenticated;

-- Cosa l'utente corrente può fare di un contenuto, INDIPENDENTEMENTE dallo
-- stato. Persona/Tifoso/Media: l'autore è il profilo corrente. Società: owner
-- implicito o chiave del catalogo (has_club_permission). Interna.
create or replace function public.footme_content_rights(
  p_content_type text,
  p_post_id      uuid
)
returns table (
  r_status            text,
  r_updated_at        timestamptz,
  r_publisher_type    text,
  r_publisher_id      uuid,
  r_can_edit          boolean,
  r_can_delete        boolean,
  r_can_view_insights boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with ref as (
    select s.status, s.updated_at, s.ptype, s.pid
    from (
      select pp.status, pp.updated_at, 'profile'::text as ptype, pp.profile_id as pid
      from public.profile_posts pp
      where p_content_type = 'profile_post' and pp.id = p_post_id
      union all
      select cm.status, cm.updated_at, 'club', cm.club_id
      from public.club_media_posts cm
      where p_content_type = 'club_media' and cm.id = p_post_id
      union all
      select fm.status, fm.updated_at, 'profile', fm.profile_id
      from public.fan_media_posts fm
      where p_content_type = 'fan_media' and fm.id = p_post_id
      union all
      select ft.status, ft.updated_at, 'profile', ft.profile_id
      from public.fan_tribuna_posts ft
      where p_content_type = 'fan_tribuna' and ft.id = p_post_id
      union all
      select mp.status, mp.updated_at, 'profile', mp.media_profile_id
      from public.media_profile_posts mp
      where p_content_type = 'media_profile' and mp.id = p_post_id
      union all
      select mt.status, mt.updated_at, 'profile', mt.media_profile_id
      from public.media_tribuna_posts mt
      where p_content_type = 'media_tribuna' and mt.id = p_post_id
    ) s
  )
  select
    ref.status, ref.updated_at, ref.ptype, ref.pid,
    coalesce(case when ref.ptype = 'club'
                  then public.has_club_permission(ref.pid, 'content_edit')
                  else ref.pid = auth.uid() end, false),
    coalesce(case when ref.ptype = 'club'
                  then public.has_club_permission(ref.pid, 'content_delete')
                  else ref.pid = auth.uid() end, false),
    coalesce(case when ref.ptype = 'club'
                  then public.has_club_permission(ref.pid, 'content_insights')
                  else ref.pid = auth.uid() end, false)
  from ref;
$$;

revoke all on function public.footme_content_rights(text, uuid) from public;
revoke execute on function public.footme_content_rights(text, uuid) from anon, authenticated;

-- La RPC del menu (§21, §95): sempre UNA riga, mai null. Contenuto inesistente,
-- non pubblicato o non gestibile → tutto false (non rivela nulla, §65).
create or replace function public.content_manage_capabilities(
  p_content_type text,
  p_post_id      uuid
)
returns table (
  can_edit          boolean,
  can_delete        boolean,
  can_view_insights boolean
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

  return query
  select
    coalesce(r.r_status = 'published' and r.r_can_edit, false),
    coalesce(r.r_status = 'published' and r.r_can_delete, false),
    coalesce(r.r_status = 'published' and r.r_can_view_insights, false)
  from (select 1) one
  left join lateral public.footme_content_rights(p_content_type, p_post_id) r on true;
end;
$$;

revoke all on function public.content_manage_capabilities(text, uuid) from public;
revoke execute on function public.content_manage_capabilities(text, uuid) from anon;
grant execute on function public.content_manage_capabilities(text, uuid) to authenticated;

comment on function public.content_manage_capabilities(text, uuid) is
  'HOM-04 §21/§95: can_edit, can_delete, can_view_insights del chiamante su un contenuto pubblicato. Sempre una riga, mai null.';


-- ============================================================
-- SEZIONE 5 — audit e delete_content
-- ============================================================

create table if not exists public.content_management_audit (
  id                   uuid        primary key default gen_random_uuid(),
  content_type         text        not null,
  post_id              uuid        not null,
  actor_user_id        uuid        not null,
  acting_identity_type text        not null check (acting_identity_type in ('person', 'society', 'media')),
  acting_identity_id   uuid        not null,
  action               text        not null check (action in ('delete')),
  result               text        not null check (result in ('deleted', 'already_deleted')),
  created_at           timestamptz not null default timezone('utc', now())
);

create index if not exists content_management_audit_post_idx
  on public.content_management_audit (content_type, post_id, created_at desc);

-- RLS attiva, nessuna policy e nessun grant: nessuna lettura né scrittura dei
-- client; scrive solo delete_content (definer).
alter table public.content_management_audit enable row level security;
revoke all on table public.content_management_audit from anon, authenticated;

create or replace function public.delete_content(
  p_content_type text,
  p_post_id      uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_table     text;
  v_locked    text;
  v_r         record;
  v_now       timestamptz := timezone('utc', now());
  v_id_type   text;
  v_result    text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_table := public.footme_content_table(p_content_type);
  if v_table is null or p_post_id is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  -- Lock di riga: due delete concorrenti si serializzano; il secondo rilegge
  -- lo stato già 'deleted' (READ COMMITTED) e risponde already_deleted.
  execute format('select status from public.%I where id = $1 for update', v_table)
    into v_locked using p_post_id;

  if v_locked is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  -- Capability rivalidata qui, dopo il lock (§33, §70): permesso revocato tra
  -- apertura del menu e tap → 42501.
  select * into v_r from public.footme_content_rights(p_content_type, p_post_id) r;

  if v_r.r_can_delete is not true then
    -- Visibile al chiamante ma non suo da eliminare → rifiuto esplicito. In ogni
    -- altro caso la risposta è generica (§65).
    if v_r.r_status = 'published'
       and exists (
         select 1 from public.footme_feed_readable_items(
           v_uid, array[p_content_type], array[p_post_id])
       ) then
      raise exception 'content_permission_denied' using errcode = '42501';
    end if;
    return jsonb_build_object('status', 'unavailable');
  end if;

  v_id_type := case
    when v_r.r_publisher_type = 'club'                           then 'society'
    when p_content_type in ('media_profile', 'media_tribuna')    then 'media'
    else 'person'
  end;

  if v_r.r_status = 'published' then
    perform set_config('prolink.content_delete', 'on', true);
    execute format(
      'update public.%I
          set status = ''deleted'', deleted_at = $2, deleted_by_profile_id = $3, updated_at = $2
        where id = $1 and status = ''published''', v_table)
      using p_post_id, v_now, v_uid;
    perform set_config('prolink.content_delete', 'off', true);
    v_result := 'deleted';
  elsif v_r.r_status = 'deleted' then
    -- Già eliminato (da un altro admin o da una richiesta precedente): stato
    -- coerente, nessuna scrittura (§75–§76).
    v_result := 'already_deleted';
  else
    -- Bozza, archiviato, hidden/removed: non è un contenuto pubblicato e non
    -- viene toccato. Risposta generica, senza audit: il client non deve
    -- concludere "eliminato" su un contenuto che esiste ancora (§65, §101).
    return jsonb_build_object('status', 'unavailable');
  end if;

  insert into public.content_management_audit
    (content_type, post_id, actor_user_id, acting_identity_type, acting_identity_id, action, result)
  values
    (p_content_type, p_post_id, v_uid, v_id_type, v_r.r_publisher_id, 'delete', v_result);

  return jsonb_build_object('status', v_result);
end;
$$;

revoke all on function public.delete_content(text, uuid) from public;
revoke execute on function public.delete_content(text, uuid) from anon;
grant execute on function public.delete_content(text, uuid) to authenticated;

comment on function public.delete_content(text, uuid) is
  'HOM-04 §45–§49, §75–§76, §99–§101: soft delete. {status: deleted | already_deleted | unavailable}; 42501 content_permission_denied se la capability è falsa.';


-- ============================================================
-- SEZIONE 6 — guard sulle interazioni (§77–§80)
--
-- BEFORE INSERT. Definer: la policy RESTRICTIVE nasconde le righe eliminate ai
-- client e il guard deve poterle leggere. Argomenti: tabella padre e modalità.
--   'published' → il padre deve essere pubblicato (commenti, salvataggi)
--   'alive'     → il padre non deve essere eliminato né rimosso (tag: le bozze
--                 li portano legittimamente dal composer)
-- ============================================================

create or replace function public.content_interaction_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  execute format('select status from public.%I where id = $1', tg_argv[0])
    into v_status using new.post_id;

  if tg_argv[1] = 'published' and v_status is distinct from 'published' then
    raise exception 'Contenuto non disponibile';
  end if;
  if tg_argv[1] = 'alive' and v_status in ('deleted', 'removed') then
    raise exception 'Contenuto non disponibile';
  end if;

  return new;
end;
$$;

revoke all on function public.content_interaction_guard() from public;
revoke execute on function public.content_interaction_guard() from anon, authenticated;

do $$
declare
  g record;
begin
  for g in
    select * from (values
      ('club_media_comments',              'club_media_posts',    'published'),
      ('media_profile_post_comments',      'media_profile_posts', 'published'),
      ('media_tribuna_comments',           'media_tribuna_posts', 'published'),
      ('fan_tribuna_comments',             'fan_tribuna_posts',   'published'),
      ('fan_media_comments',               'fan_media_posts',     'published'),
      ('saved_club_media',                 'club_media_posts',    'published'),
      ('saved_media_profile_posts',        'media_profile_posts', 'published'),
      ('saved_media_tribuna',              'media_tribuna_posts', 'published'),
      ('saved_fan_tribuna',                'fan_tribuna_posts',   'published'),
      ('saved_fan_media',                  'fan_media_posts',     'published'),
      ('club_media_tagged_profiles',       'club_media_posts',    'alive'),
      ('fan_tribuna_tagged_players',       'fan_tribuna_posts',   'alive'),
      ('media_profile_post_tagged_targets','media_profile_posts', 'alive'),
      ('profile_post_tagged_targets',      'profile_posts',       'alive')
    ) as v(child, parent, mode)
  loop
    execute format('drop trigger if exists content_interaction_guard on public.%I', g.child);
    execute format(
      'create trigger content_interaction_guard before insert on public.%I
         for each row execute function public.content_interaction_guard(%L, %L)',
      g.child, g.parent, g.mode);
  end loop;
end
$$;



-- ============================================================
-- SEZIONE 7 — footme_post_payloads: capability dalla regola unica + version
--
-- Riemessa dalla definizione più recente (20261116090000 §7; nessuna migrazione
-- successiva la tocca: verificato). Cambia SOLO:
--   * can_edit / can_delete / can_view_insights vengono da
--     footme_content_rights (stessa regola di content_manage_capabilities,
--     senza il raise per sessione assente), non più da is_own (§21, §24);
--   * nuovo `version` (updated_at ISO) per il futuro editor (§73);
--   * `can_report` resta `not is_own` e `can_save` / `can_like` /
--     `can_comment` / `can_share` sono invariati.
-- ============================================================

create or replace function public.footme_post_payloads(
  p_viewer        uuid,
  p_content_types text[],
  p_post_ids      uuid[]
)
returns table (
  r_content_type text,
  r_post_id      uuid,
  payload        jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with blocked as (
    select ub.blocked_profile_id as profile_id
    from public.user_blocks ub
    where ub.blocker_profile_id = p_viewer
    union
    select ub.blocker_profile_id
    from public.user_blocks ub
    where ub.blocked_profile_id = p_viewer
  ),

  -- Solo ciò che il Feed mostrerebbe: la regola vive in
  -- footme_feed_readable_items (pubblicato, non programmato, autore profilo non
  -- bloccato in nessuna direzione), la stessa che usano il poll dei media e lo
  -- stato interazioni.
  base as (
    select
      ri.r_content_type as content_type, ri.r_post_id as post_id,
      ri.r_content_format as content_format, ri.r_excerpt as excerpt,
      ri.r_body as body, ri.r_publisher_type as publisher_type,
      ri.r_publisher_id as publisher_id, ri.r_source_kind as source_kind
    from public.footme_feed_readable_items(p_viewer, p_content_types, p_post_ids) ri
  ),

  media_agg as (
    select
      m.content_type, m.post_id,
      jsonb_agg(public.footme_media_json(m) order by m.position) as media
    from public.content_post_media m
    join base b on b.content_type = m.content_type and b.post_id = m.post_id
    group by m.content_type, m.post_id
  ),

  likes_agg as (
    select
      l.content_type, l.post_id,
      count(*)::int as n,
      coalesce(bool_or(l.profile_id = p_viewer), false) as liked
    from (
      select 'club_media'::text as content_type, x.post_id, x.profile_id
      from public.club_media_likes x
      join base b on b.content_type = 'club_media' and b.post_id = x.post_id
      union all
      select 'fan_media', x.post_id, x.profile_id
      from public.fan_media_likes x
      join base b on b.content_type = 'fan_media' and b.post_id = x.post_id
      union all
      select 'profile_post', x.post_id, x.profile_id
      from public.profile_post_likes x
      join base b on b.content_type = 'profile_post' and b.post_id = x.post_id
      union all
      select 'media_profile', x.post_id, x.profile_id
      from public.media_profile_post_likes x
      join base b on b.content_type = 'media_profile' and b.post_id = x.post_id
    ) l
    group by l.content_type, l.post_id
  ),

  comments_agg as (
    select c.content_type, c.post_id, count(*)::int as n
    from (
      select 'club_media'::text as content_type, x.post_id
      from public.club_media_comments x
      join base b on b.content_type = 'club_media' and b.post_id = x.post_id
      union all
      select 'media_profile', x.post_id
      from public.media_profile_post_comments x
      join base b on b.content_type = 'media_profile' and b.post_id = x.post_id
      union all
      select 'media_tribuna', x.post_id
      from public.media_tribuna_comments x
      join base b on b.content_type = 'media_tribuna' and b.post_id = x.post_id
      union all
      select 'fan_tribuna', x.post_id
      from public.fan_tribuna_comments x
      join base b on b.content_type = 'fan_tribuna' and b.post_id = x.post_id
      union all
      select 'fan_media', x.post_id
      from public.fan_media_comments x
      join base b on b.content_type = 'fan_media' and b.post_id = x.post_id
    ) c
    group by c.content_type, c.post_id
  ),

  -- Solo tag attivi (§20). fan_tribuna conserva un display_name proprio, usato
  -- come ripiego se l'identità non si risolve più.
  tags_raw as (
    select 'club_media'::text as content_type, t.post_id,
           t.target_type, coalesce(t.target_id, t.profile_id) as target_id,
           null::text as fallback_name, t.created_at
    from public.club_media_tagged_profiles t
    join base b on b.content_type = 'club_media' and b.post_id = t.post_id
    where t.status = 'active'
    union all
    select 'fan_tribuna', t.post_id,
           t.target_type, coalesce(t.target_id, t.player_profile_id),
           t.display_name, t.created_at
    from public.fan_tribuna_tagged_players t
    join base b on b.content_type = 'fan_tribuna' and b.post_id = t.post_id
    where t.status = 'active'
    union all
    select 'media_profile', t.post_id, t.target_type, t.target_id, null::text, t.created_at
    from public.media_profile_post_tagged_targets t
    join base b on b.content_type = 'media_profile' and b.post_id = t.post_id
    where t.status = 'active'
    union all
    select 'profile_post', t.post_id, t.target_type, t.target_id, null::text, t.created_at
    from public.profile_post_tagged_targets t
    join base b on b.content_type = 'profile_post' and b.post_id = t.post_id
    where t.status = 'active'
  ),
  tags_resolved as (
    select
      tr.content_type, tr.post_id, tr.created_at, tr.target_id,
      jsonb_build_object(
        'identity_id',   tr.target_id,
        'identity_type', tr.target_type,
        'display_name',  coalesce(
                           case tr.target_type
                             when 'profile' then pr.full_name
                             when 'club'    then cl.name
                             when 'team'    then ct.name
                           end,
                           tr.fallback_name
                         ),
        'avatar_url',    case tr.target_type
                           when 'profile' then pr.avatar_url
                           when 'club'    then cl.logo_url
                           when 'team'    then coalesce(ct.logo_url, tcl.logo_url)
                         end
      ) as tag,
      coalesce(
        case tr.target_type
          when 'profile' then pr.full_name
          when 'club'    then cl.name
          when 'team'    then ct.name
        end,
        tr.fallback_name
      ) as resolved_name
    from tags_raw tr
    left join public.profiles pr   on tr.target_type = 'profile' and pr.id = tr.target_id
    left join public.clubs cl      on tr.target_type = 'club'    and cl.id = tr.target_id
    left join public.club_teams ct on tr.target_type = 'team'    and ct.id = tr.target_id
    left join public.clubs tcl     on tr.target_type = 'team'    and tcl.id = ct.club_id
    where not (
      tr.target_type = 'profile'
      and exists (select 1 from blocked bl where bl.profile_id = tr.target_id)
    )
  ),
  tags_agg as (
    select
      t.content_type, t.post_id,
      jsonb_agg(t.tag order by t.created_at, t.target_id) as tagged
    from tags_resolved t
    where t.resolved_name is not null
    group by t.content_type, t.post_id
  ),

  -- Identità che pubblica (§80) e dati grezzi per la seconda riga (§9).
  -- Società → 'society'; contenuti di un profilo Media → 'media'; ogni altro
  -- caso (persone, tifosi) → 'person'. La corrente appartenenza di una persona
  -- usa la stessa derivazione di fetch_home_suggested_profiles.
  authored as (
    select
      b.content_type, b.post_id, b.body, b.excerpt, b.source_kind,
      public.footme_feed_item_type(b.content_type, b.content_format) as item_type,
      case
        when b.publisher_type = 'club'                                then 'society'
        when b.content_type in ('media_profile', 'media_tribuna')     then 'media'
        else 'person'
      end as identity_type,
      pr.role::text                as person_role,
      pl.primary_position::text    as person_position,
      cur.club_name,
      cur.team_label,
      cl.category                  as club_category,
      coalesce(
        case when b.publisher_type = 'club' then cl.owner_profile_id = p_viewer end,
        case when b.publisher_type = 'profile' then b.publisher_id = p_viewer end,
        false
      ) as is_own
    from base b
    left join public.clubs cl
      on b.publisher_type = 'club' and cl.id = b.publisher_id
    left join public.profiles pr
      on b.publisher_type = 'profile' and pr.id = b.publisher_id
    left join public.player_profiles pl
      on pl.profile_id = pr.id and pr.role::text = 'player'
    left join lateral (
      select c.name as club_name, ct.name as team_label
      from public.club_members cm
      join public.clubs c on c.id = cm.club_id
      left join public.club_teams ct on ct.id = cm.team_id
      where cm.profile_id = pr.id
        and cm.status = 'active'
        and cm.is_current = true
      order by cm.created_at desc
      limit 1
    ) cur on true
  )

  select
    a.content_type as r_content_type,
    a.post_id      as r_post_id,
    jsonb_build_object(
      'author_identity_type', a.identity_type,
      'author_meta', jsonb_build_object(
        'role',             case when a.identity_type = 'person'  then a.person_role end,
        'primary_position', case when a.identity_type = 'person'  then a.person_position end,
        'club_name',        case when a.identity_type = 'person'  then a.club_name end,
        'team_label',       case when a.identity_type = 'person'  then a.team_label end,
        'club_category',    case when a.identity_type = 'society' then a.club_category end,
        'media_kind',       case when a.identity_type = 'media'   then a.source_kind end
      ),
      'media',        coalesce(ma.media, '[]'::jsonb),
      'mentions',     coalesce(ex.mentions, '[]'::jsonb),
      'tagged',       coalesce(ta.tagged, '[]'::jsonb),
      'link_preview', ex.link_preview,
      'likes_count',    coalesce(la.n, 0),
      'comments_count', coalesce(ca.n, 0),
      'is_liked',       coalesce(la.liked, false),
      'capabilities', jsonb_build_object(
        'can_like',          a.content_type in ('club_media', 'fan_media', 'profile_post', 'media_profile'),
        'can_comment',       a.content_type <> 'profile_post',
        'can_share',         true,
        'can_save',          a.content_type <> 'profile_post',
        'can_report',        not a.is_own,
        'can_edit',          coalesce(cr.r_can_edit, false),
        'can_delete',        coalesce(cr.r_can_delete, false),
        'can_view_insights', coalesce(cr.r_can_view_insights, false)
      ),
      'status', 'published',
      -- HOM-04 §73: versione minima per l'editor (updated_at, ISO UTC).
      'version', to_char(cr.r_updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    )
    -- HOM-03: il Post porta il testo intero; Articolo e video editoriale no
    -- (un articolo può pesare migliaia di caratteri e la preview non lo usa) e
    -- portano invece summary: l'excerpt della vista, al massimo 280 caratteri.
    || case
         when a.item_type = 'post'
           then jsonb_build_object('body', coalesce(a.body, ''))
         else jsonb_build_object('summary', left(nullif(trim(a.excerpt), ''), 280))
       end
    as payload
  from authored a
  -- HOM-04: capability e versione dalla regola unica footme_content_rights,
  -- una sola chiamata per elemento. Non passa da content_manage_capabilities,
  -- che solleva senza sessione: il Feed resta leggibile anche senza utente.
  -- Lo stato 'published' è già garantito da base, quindi i r_can_* bastano.
  -- footme_content_rights usa auth.uid(); i chiamanti passano p_viewer = auth.uid().
  left join lateral public.footme_content_rights(a.content_type, a.post_id) cr on true
  left join media_agg ma    on ma.content_type = a.content_type and ma.post_id = a.post_id
  left join likes_agg la    on la.content_type = a.content_type and la.post_id = a.post_id
  left join comments_agg ca on ca.content_type = a.content_type and ca.post_id = a.post_id
  left join tags_agg ta     on ta.content_type = a.content_type and ta.post_id = a.post_id
  left join public.content_post_extras ex
    on ex.content_type = a.content_type and ex.post_id = a.post_id;
$$;

-- Funzione interna: la chiamano solo le RPC definer del Feed. Nessun ruolo
-- client la esegue direttamente (accetta un viewer arbitrario).
revoke all on function public.footme_post_payloads(uuid, text[], uuid[]) from public;
revoke execute on function public.footme_post_payloads(uuid, text[], uuid[]) from anon, authenticated;

-- ============================================================
-- SEZIONE 8 — Salvati: solo contenuti pubblicati (§51)
--
-- Riemesse dalla definizione più recente (20260726120000; verificato che
-- 20260724110000 e 20260627090100 sono precedenti). Cambia SOLO `status =
-- 'published'` su ogni join contenuto di fetch_saved_items e sui cinque conteggi
-- di fetch_saved_counts (elenco e contatore restano allineati). Firme,
-- colonne e grant invariati: `create or replace` senza drop. Il salvataggio
-- di un contenuto eliminato (o archiviato/bozza) non compare più né è
-- apribile; la riga saved_* resta (si può ancora rimuovere).
-- ============================================================

create or replace function public.fetch_saved_items(
  p_filter    text    default 'all',
  p_limit     int     default 20,
  p_offset    int     default 0
)
returns table (
  kind          text,
  source_table  text,
  entity_id     uuid,
  content_type  text,
  title         text,
  subtitle      text,
  thumbnail_url text,
  saved_at      timestamptz
)
language plpgsql
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
  select *
  from (

    -- ── saved_profiles ──────────────────────────────────────────
    select
      'profile'::text                     as kind,
      'saved_profiles'::text              as source_table,
      sp.target_profile_id                as entity_id,
      null::text                          as content_type,
      p.full_name                         as title,
      p.role::text                        as subtitle,
      p.avatar_url                        as thumbnail_url,
      sp.created_at                       as saved_at
    from public.saved_profiles sp
    join public.profiles p on p.id = sp.target_profile_id
    where sp.owner_profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'profile')

    union all

    -- ── saved_clubs ──────────────────────────────────────────────
    select
      'club'::text                        as kind,
      'saved_clubs'::text                 as source_table,
      sc.club_id                          as entity_id,
      null::text                          as content_type,
      c.name                              as title,
      coalesce(c.category, c.region)      as subtitle,
      c.logo_url                          as thumbnail_url,
      sc.created_at                       as saved_at
    from public.saved_clubs sc
    join public.clubs c on c.id = sc.club_id
    where sc.owner_profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'club')

    union all

    -- ── saved_teams (squadre interne) ────────────────────────────
    select
      'team'::text                        as kind,
      'saved_teams'::text                 as source_table,
      st.team_id                          as entity_id,
      null::text                          as content_type,
      ct.name                             as title,
      coalesce(parent_club.name, ct.category) as subtitle,
      ct.logo_url                         as thumbnail_url,
      st.created_at                       as saved_at
    from public.saved_teams st
    join public.club_teams ct on ct.id = st.team_id
    join public.clubs parent_club on parent_club.id = ct.club_id
    where st.owner_profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'club')

    union all

    -- ── saved_ads (positions) ────────────────────────────────────
    select
      'position'::text                    as kind,
      'saved_ads'::text                   as source_table,
      sa.ad_id                            as entity_id,
      null::text                          as content_type,
      ra.title                            as title,
      coalesce(ra.region, ra.role_required::text) as subtitle,
      null::text                          as thumbnail_url,
      sa.created_at                       as saved_at
    from public.saved_ads sa
    join public.recruiting_ads ra on ra.id = sa.ad_id
    where sa.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'position')

    union all

    -- ── saved_media_tribuna (content) ───────────────────────────
    select
      'content'::text                     as kind,
      'saved_media_tribuna'::text         as source_table,
      smt.post_id                         as entity_id,
      'media_tribuna'::text               as content_type,
      mtp.title                           as title,
      mtp.kind                            as subtitle,
      null::text                          as thumbnail_url,
      smt.created_at                      as saved_at
    from public.saved_media_tribuna smt
    join public.media_tribuna_posts mtp on mtp.id = smt.post_id
      and mtp.status = 'published'
    where smt.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'content')

    union all

    -- ── saved_club_media (content) ──────────────────────────────
    select
      'content'::text                     as kind,
      'saved_club_media'::text            as source_table,
      scm.post_id                         as entity_id,
      'club_media'::text                  as content_type,
      cmp.title                           as title,
      cmp.kind                            as subtitle,
      coalesce(cmp.thumbnail_url, cmp.visual_url) as thumbnail_url,
      scm.created_at                      as saved_at
    from public.saved_club_media scm
    join public.club_media_posts cmp on cmp.id = scm.post_id
      and cmp.status = 'published'
    where scm.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'content')

    union all

    -- ── saved_fan_tribuna (content) ─────────────────────────────
    select
      'content'::text                     as kind,
      'saved_fan_tribuna'::text           as source_table,
      sft.post_id                         as entity_id,
      'fan_tribuna'::text                 as content_type,
      ftp.title                           as title,
      ftp.kind                            as subtitle,
      coalesce(ftp.thumbnail_url, ftp.media_url) as thumbnail_url,
      sft.created_at                      as saved_at
    from public.saved_fan_tribuna sft
    join public.fan_tribuna_posts ftp on ftp.id = sft.post_id
      and ftp.status = 'published'
    where sft.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'content')

    union all

    -- ── saved_media_profile_posts (content) — nuovo in CER-05 ────
    select
      'content'::text                     as kind,
      'saved_media_profile_posts'::text   as source_table,
      smp.post_id                         as entity_id,
      'media_profile'::text               as content_type,
      mpp.title                           as title,
      mpp.kind                            as subtitle,
      mpp.cover_url                       as thumbnail_url,
      smp.created_at                      as saved_at
    from public.saved_media_profile_posts smp
    join public.media_profile_posts mpp on mpp.id = smp.post_id
      and mpp.status = 'published'
    where smp.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'content')

    union all

    -- ── saved_fan_media (content) — nuovo in CER-05 ──────────────
    select
      'content'::text                     as kind,
      'saved_fan_media'::text             as source_table,
      sfm.post_id                         as entity_id,
      'fan_media'::text                   as content_type,
      fmp.description                     as title,
      fmp.tag                             as subtitle,
      coalesce(fmp.thumbnail_url, fmp.visual_url) as thumbnail_url,
      sfm.created_at                      as saved_at
    from public.saved_fan_media sfm
    join public.fan_media_posts fmp on fmp.id = sfm.post_id
      and fmp.status = 'published'
    where sfm.profile_id = v_uid
      and (p_filter = 'all' or p_filter = 'content')

  ) rows
  order by rows.saved_at desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.fetch_saved_items(text, int, int) from public;
grant execute on function public.fetch_saved_items(text, int, int) to authenticated;


create or replace function public.fetch_saved_counts()
returns table (
  profiles_count  bigint,
  clubs_count     bigint,
  positions_count bigint,
  contents_count  bigint
)
language plpgsql
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
    (select count(*) from public.saved_profiles   where owner_profile_id = v_uid)::bigint,
    (
      (select count(*) from public.saved_clubs where owner_profile_id = v_uid)
      + (select count(*) from public.saved_teams where owner_profile_id = v_uid)
    )::bigint,
    (select count(*) from public.saved_ads         where profile_id       = v_uid)::bigint,
    (
      (select count(*) from public.saved_media_tribuna x join public.media_tribuna_posts p on p.id = x.post_id and p.status = 'published' where x.profile_id = v_uid)
      + (select count(*) from public.saved_club_media x join public.club_media_posts p on p.id = x.post_id and p.status = 'published' where x.profile_id = v_uid)
      + (select count(*) from public.saved_fan_tribuna x join public.fan_tribuna_posts p on p.id = x.post_id and p.status = 'published' where x.profile_id = v_uid)
      + (select count(*) from public.saved_media_profile_posts x join public.media_profile_posts p on p.id = x.post_id and p.status = 'published' where x.profile_id = v_uid)
      + (select count(*) from public.saved_fan_media x join public.fan_media_posts p on p.id = x.post_id and p.status = 'published' where x.profile_id = v_uid)
    )::bigint;
end;
$$;

revoke all on function public.fetch_saved_counts() from public;
grant execute on function public.fetch_saved_counts() to authenticated;
