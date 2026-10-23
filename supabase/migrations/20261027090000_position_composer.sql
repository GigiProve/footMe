-- ============================================================
-- DAS-REV-16 — Composer Position schema-driven
--
-- Un solo composer, quattro configurazioni. Questa migrazione **non** crea
-- un secondo sistema di recruiting: `recruiting_ads` resta l'unica Position,
-- `recruiting_applications` resta l'unica candidatura e `public.ad_status`
-- resta l'unico lifecycle (draft | published | closed). §6 è esplicito: «I
-- nomi tecnici descrivono il contratto, non impongono nuove tabelle».
--
-- Sette lacune reali impediscono però di esprimere il contratto leggendo
-- soltanto ciò che esiste oggi:
--
--   1. **`role_required` è un `player_position`.** Il dominio sa cercare solo
--      calciatori. Serve un catalogo di ruoli per i quattro profili, con id
--      canonici ed eleggibilità propria del recruiting (§8). Sezione 1.
--   2. **L'ambito non esiste.** DAS-REV-15 deduce SOCIETY da `team_id is
--      null`; §6 e §35 lo vietano — «potrebbe essere una bozza incompleta o
--      un'anomalia». Sezione 3 introduce `position_scope_type` esplicito e
--      la sezione 11 riallinea le letture del Centro.
--   3. **La fascia d'età è ambigua.** Due null significano oggi sia «non
--      configurato» sia «nessun limite». §13 chiede tre stati distinti.
--   4. **Non esistono i dettagli tipizzati** dei quattro schemi
--      (disponibilità, esperienze, patentino, qualifica, responsabilità,
--      requisiti). Sezione 3, colonna `details`.
--   5. **Non esistono le squadre dello stesso incarico** (§15, §16), che
--      sono relazioni secondarie di **una sola** Position e non altre
--      ricerche. Sezione 4.
--   6. **Non esiste controllo di concorrenza né idempotenza** su creazione e
--      pubblicazione (§10, §25). Sezioni 3 e 6.
--   7. **Creazione e pubblicazione non sono separabili**: il dominio ha una
--      sola capability di scrittura, e §5 chiede un creator che prepara
--      bozze senza pubblicare. Sezione 2.
--
-- Rollback: droppare le funzioni `position_*` / `fetch_position_*` /
-- `publish_positions`, i trigger `recruiting_ads_composer_*`, le tabelle
-- `recruiting_ad_teams`, `position_compose_operations`, `position_roles`,
-- `position_qualifications`, `position_experience_options`; ripristinare le
-- tre funzioni del Centro dalla 20261026 e rimettere `not null` su
-- `recruiting_ads.description`. Le colonne aggiunte sono additive e
-- nullable o con default, quindi lasciarle non rompe nessuna lettura.
--
-- Idempotenza: `create table if not exists`, `add column if not exists`,
-- `create or replace function`, upsert dei cataloghi con `on conflict do
-- update`, backfill con `where ... is null`. Rieseguire non duplica dati e
-- non riscrive una scelta già fatta dall'utente.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — i cataloghi canonici del recruiting
--
-- §8: «l'eligibility viene dal catalogo centrale» e «Non usare
-- indiscriminatamente tutti i ruoli di carriera se non sono selezionabili
-- come Posizioni». Le tassonomie di carriera (STAFF_ROLE_OPTIONS,
-- DIRECTOR_ROLE_OPTIONS, i profili Allenatore) restano quelle che sono:
-- questa è una lista **diversa**, con regole diverse, e la stessa §8
-- protegge l'altra — «questa regola non elimina ruoli legittimi dalla
-- carriera o dall'amministrazione della società».
--
-- Un solo catalogo per tutti e quattro i profili, non quattro tabelle: il
-- client interroga sempre la stessa relazione con un `profile_type`, e la
-- regola «un solo ruolo ⇒ nessun selector» (§8) nasce da un `count(*)`
-- invece che da un `if` hardcodato per Allenatore.
--
-- `is_custom` marca OTHER_STAFF e OTHER_EXECUTIVE: sono **scelte canoniche
-- esplicite**, non un fallback a un errore API, e il nome libero che
-- richiedono vive in `recruiting_ads.custom_role_name`, distinto dall'id.
-- ============================================================

create table if not exists public.position_roles (
  id           text primary key,
  profile_type text not null check (profile_type in ('player', 'coach', 'staff', 'director')),
  label        text not null,
  is_custom    boolean not null default false,
  is_active    boolean not null default true,
  sort_order   integer not null default 0
);

comment on table public.position_roles is
  'DAS-REV-16 §8: ruoli selezionabili quando si crea una Posizione. '
  'Distinto dalle tassonomie di carriera: Presidente e Vicepresidente sono '
  'ruoli legittimi di carriera ma non sono opzioni di recruiting in V1, e '
  'Team manager appartiene a Dirigente, non a Staff.';

alter table public.position_roles enable row level security;

drop policy if exists "position roles are readable" on public.position_roles;
create policy "position roles are readable"
  on public.position_roles for select to authenticated using (true);

-- Calciatore: la tassonomia sportiva condivisa (§8). Gli id coincidono con i
-- valori di `public.player_position`, così `role_required` resta scrivibile
-- e Cerca, Home e il dettaglio pubblico continuano a leggerlo.
insert into public.position_roles (id, profile_type, label, sort_order) values
  ('goalkeeper',            'player', 'Portiere',                 10),
  ('defender',              'player', 'Difensore',                20),
  ('center_back',           'player', 'Difensore centrale',       30),
  ('right_back',            'player', 'Terzino destro',           40),
  ('left_back',             'player', 'Terzino sinistro',         50),
  ('midfielder',            'player', 'Centrocampista',           60),
  ('defensive_midfielder',  'player', 'Mediano',                  70),
  ('central_midfielder',    'player', 'Centrocampista centrale',  80),
  ('attacking_midfielder',  'player', 'Trequartista',             90),
  ('right_winger',          'player', 'Esterno destro',          100),
  ('left_winger',           'player', 'Esterno sinistro',        110),
  ('forward',               'player', 'Attaccante',              120),
  ('striker',               'player', 'Punta centrale',          130)
on conflict (id) do update
  set label = excluded.label,
      profile_type = excluded.profile_type,
      sort_order = excluded.sort_order;

-- Allenatore: oggi il dominio conosce un solo incarico selezionabile.
-- §8 vieta di hardcodare «Allenatore nasconde sempre Ruolo»: il campo
-- sparisce perché il catalogo ha una riga, e ricomparirà da solo il giorno
-- in cui ne avrà due.
insert into public.position_roles (id, profile_type, label, sort_order) values
  ('head_coach', 'coach', 'Allenatore', 10)
on conflict (id) do update
  set label = excluded.label,
      profile_type = excluded.profile_type,
      sort_order = excluded.sort_order;

-- Staff: figure tecniche, sanitarie e di performance (§8).
insert into public.position_roles (id, profile_type, label, is_custom, sort_order) values
  ('fitness_coach',       'staff', 'Preparatore atletico',      false,  10),
  ('goalkeeper_coach',    'staff', 'Preparatore dei portieri',  false,  20),
  ('assistant_coach',     'staff', 'Collaboratore tecnico',     false,  30),
  ('match_analyst',       'staff', 'Match analyst',             false,  40),
  ('video_analyst',       'staff', 'Video analyst',             false,  50),
  ('physiotherapist',     'staff', 'Fisioterapista',            false,  60),
  ('doctor',              'staff', 'Medico',                    false,  70),
  ('masseur',             'staff', 'Massofisioterapista',       false,  80),
  ('nutritionist',        'staff', 'Nutrizionista',             false,  90),
  ('sport_psychologist',  'staff', 'Psicologo dello sport',     false, 100),
  ('other_staff',         'staff', 'Altro ruolo staff',         true,  110)
on conflict (id) do update
  set label = excluded.label,
      profile_type = excluded.profile_type,
      is_custom = excluded.is_custom,
      sort_order = excluded.sort_order;

-- Dirigente: §8 — «Team manager non appartiene a Staff. Presidente e
-- Vicepresidente non sono opzioni predefinite di recruiting in questa
-- versione.»
insert into public.position_roles (id, profile_type, label, is_custom, sort_order) values
  ('sporting_director',  'director', 'Direttore sportivo',            false, 10),
  ('general_manager',    'director', 'Direttore generale',            false, 20),
  ('team_manager',       'director', 'Team manager',                  false, 30),
  ('secretary',          'director', 'Segretario',                    false, 40),
  ('youth_head',         'director', 'Responsabile settore giovanile', false, 50),
  ('technical_head',     'director', 'Responsabile area tecnica',     false, 60),
  ('other_executive',    'director', 'Altro ruolo dirigente',         true,  70)
on conflict (id) do update
  set label = excluded.label,
      profile_type = excluded.profile_type,
      is_custom = excluded.is_custom,
      sort_order = excluded.sort_order;


-- Patentini Allenatore (§15). «Salva qualification ID, non testo libero.»
-- Nessuna regola di compatibilità normativa vive qui: §15 la vieta
-- espressamente — «Il patentino è la preferenza dichiarata dal club».
create table if not exists public.position_qualifications (
  id         text primary key,
  label      text not null,
  is_active  boolean not null default true,
  sort_order integer not null default 0
);

alter table public.position_qualifications enable row level security;

drop policy if exists "position qualifications are readable" on public.position_qualifications;
create policy "position qualifications are readable"
  on public.position_qualifications for select to authenticated using (true);

insert into public.position_qualifications (id, label, sort_order) values
  ('uefa_pro',       'UEFA Pro',          10),
  ('uefa_a',         'UEFA A',            20),
  ('uefa_b',         'UEFA B',            30),
  ('uefa_c',         'UEFA C',            40),
  ('uefa_goalkeeper','UEFA Goalkeeper A', 50),
  ('uefa_youth_b',   'UEFA Youth B',      60)
on conflict (id) do update
  set label = excluded.label, sort_order = excluded.sort_order;


-- Esperienze richieste (§14, §15, §16, §17).
--
-- Tre liste diverse che il testo tiene **esplicitamente** separate: Coach ha
-- «gestione di più squadre», Staff ha «calcio professionistico», Dirigente
-- ha «gestione societaria». §16 vieta di sostituire una lista con l'altra.
--
-- `requires_team_context` marca i criteri relativi («nella categoria»,
-- «categorie superiori»): §17 chiede che un incarico SOCIETY non li proponga
-- quando manca un riferimento univoco — «non usare di nascosto la Prima
-- squadra». La dipendenza vive nella configurazione, non nel client.
create table if not exists public.position_experience_options (
  id                   text not null,
  profile_type         text not null check (profile_type in ('coach', 'staff', 'director')),
  label                text not null,
  requires_team_context boolean not null default false,
  sort_order           integer not null default 0,
  primary key (profile_type, id)
);

alter table public.position_experience_options enable row level security;

drop policy if exists "position experience options are readable" on public.position_experience_options;
create policy "position experience options are readable"
  on public.position_experience_options for select to authenticated using (true);

insert into public.position_experience_options
  (id, profile_type, label, requires_team_context, sort_order) values
  ('first_team',        'coach',    'Esperienza in prima squadra',        false, 10),
  ('youth_sector',      'coach',    'Esperienza nel settore giovanile',   false, 20),
  ('in_category',       'coach',    'Esperienza nella categoria',         true,  30),
  ('higher_categories', 'coach',    'Esperienza in categorie superiori',  true,  40),
  ('multi_team',        'coach',    'Gestione di più squadre',            false, 50),

  ('first_team',        'staff',    'Esperienza in prima squadra',        false, 10),
  ('youth_sector',      'staff',    'Esperienza nel settore giovanile',   false, 20),
  ('in_category',       'staff',    'Esperienza nella categoria',         true,  30),
  ('higher_categories', 'staff',    'Esperienza in categorie superiori',  true,  40),
  ('professional',      'staff',    'Calcio professionistico',            false, 50),

  ('first_team',        'director', 'Esperienza in prima squadra',        false, 10),
  ('youth_sector',      'director', 'Esperienza nel settore giovanile',   false, 20),
  ('in_category',       'director', 'Esperienza nella categoria',         true,  30),
  ('higher_categories', 'director', 'Esperienza in categorie superiori',  true,  40),
  ('club_management',   'director', 'Esperienza nella gestione societaria', false, 50)
on conflict (profile_type, id) do update
  set label = excluded.label,
      requires_team_context = excluded.requires_team_context,
      sort_order = excluded.sort_order;


-- ============================================================
-- SEZIONE 2 — pubblicare è una capability distinta dal creare
--
-- §5: «Create, edit draft, read draft e publish possono essere capability
-- distinte quando il dominio le distingue. Un creator senza publish può
-- conservare bozze, con azioni coerenti, senza ottenere una pubblicazione
-- indiretta.»
--
-- Il dominio oggi non le distingue: `positions_write` concede tutto. La
-- fixture §36 chiede esplicitamente «un creator senza publish», quindi il
-- controllo esiste da qui — come riga del catalogo DAS-REV-14, non come
-- eccezione cablata nelle RPC.
--
-- Backfill non regressivo: chi oggi può scrivere può anche pubblicare,
-- perché finora poteva. Il nuovo controllo serve a **togliere** il diritto
-- a qualcuno, non a toglierlo a tutti con un deploy.
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
    'society_profile_view'
  ));

insert into public.club_permission_controls
  (id, area_id, label, helper, bundle, requires, sort_order, is_available) values
  ('positions_publish', 'positions', 'Pubblica posizioni',
     'Necessario per creare e gestire le posizioni',
     'manage', array['positions_read', 'positions_write'], 3, true)
on conflict (id) do update
  set area_id = excluded.area_id,
      label = excluded.label,
      helper = excluded.helper,
      bundle = excluded.bundle,
      requires = excluded.requires,
      sort_order = excluded.sort_order,
      is_available = excluded.is_available;

insert into public.club_permission_control_keys (control_id, permission_key) values
  ('positions_publish', 'positions_publish')
on conflict do nothing;

-- Chi poteva scrivere poteva pubblicare: nessun diritto viene revocato da
-- questa migrazione. `where not exists` la rende rieseguibile.
insert into public.club_member_permissions (club_id, profile_id, permission_key, team_id)
select p.club_id, p.profile_id, 'positions_publish', p.team_id
from public.club_member_permissions p
where p.permission_key in ('positions_create', 'society_manage_positions')
  and not exists (
    select 1 from public.club_member_permissions q
    where q.club_id = p.club_id
      and q.profile_id = p.profile_id
      and q.permission_key = 'positions_publish'
      and q.team_id is not distinct from p.team_id
  );

insert into public.club_admin_role_permissions (role_id, permission_key)
select distinct r.role_id, 'positions_publish'
from public.club_admin_role_permissions r
where r.permission_key in ('positions_create', 'society_manage_positions')
  and not exists (
    select 1 from public.club_admin_role_permissions q
    where q.role_id = r.role_id and q.permission_key = 'positions_publish'
  );


-- ============================================================
-- SEZIONE 3 — il modello Position del contratto §6
--
-- Tutte le colonne sono additive. Nessun PositionV2: §6 chiede di
-- «riutilizzare gli identificativi e i nomi effettivi del dominio».
--
-- `target_role` esiste già (20260722100000) e **è** `profile_type`: aveva
-- tre valori, gliene manca uno. Lo schema remoto ha derivato — la colonna è
-- `public.app_role` in produzione e `text` nei file — quindi l'estensione
-- interroga `information_schema` invece di assumere una forma.
-- ============================================================

do $$
declare
  v_type text;
begin
  select c.udt_name into v_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'recruiting_ads'
    and c.column_name = 'target_role';

  if v_type = 'app_role' then
    -- `director` è già un valore di `app_role` (20260411100000): nulla da
    -- fare se non rimuovere un eventuale check che lo escludesse.
    execute 'alter table public.recruiting_ads drop constraint if exists recruiting_ads_target_role_check';
  else
    execute 'alter table public.recruiting_ads drop constraint if exists recruiting_ads_target_role_check';
    execute $c$
      alter table public.recruiting_ads
        add constraint recruiting_ads_target_role_check
        check (target_role in ('player', 'coach', 'staff', 'director'))
    $c$;
  end if;
end;
$$;

-- Ambito esplicito. §6: «Imponi la coerenza TEAM→Team richiesto e
-- SOCIETY→Team nullo. Non usare un Team chiamato "Intera società", un ID
-- speciale fittizio o un array di Team principali per evitare questa
-- distinzione.»
--
-- Default `team` e non `society`: §35 — «Non interpretare ogni Team null
-- come SOCIETY: potrebbe essere una bozza incompleta o un'anomalia.» Le
-- righe storiche con `team_id` nullo restano quindi bozze TEAM incomplete,
-- che DAS-REV-15 §30 mostra come «Squadra da definire».
alter table public.recruiting_ads
  add column if not exists position_scope_type text not null default 'team';

alter table public.recruiting_ads
  drop constraint if exists recruiting_ads_scope_check;

alter table public.recruiting_ads
  add constraint recruiting_ads_scope_check
  check (position_scope_type in ('team', 'society'));

comment on column public.recruiting_ads.position_scope_type is
  'DAS-REV-16 §6: TEAM oppure SOCIETY. Un team_id nullo non significa '
  'SOCIETY: solo questo valore lo stabilisce.';

alter table public.recruiting_ads
  add column if not exists structured_role_id text references public.position_roles(id);

alter table public.recruiting_ads
  add column if not exists custom_role_name text;

comment on column public.recruiting_ads.custom_role_name is
  'DAS-REV-16 §6, §8: solo per i ruoli is_custom (Altro ruolo staff / Altro '
  'ruolo dirigente). Distinto dall''ID: "Data analyst" è il titolo '
  'dell''annuncio, other_staff no.';

alter table public.recruiting_ads
  add column if not exists creation_batch_id uuid;

comment on column public.recruiting_ads.creation_batch_id is
  'DAS-REV-16 §6: correlazione fra Position indipendenti nate dalla stessa '
  'sessione di creazione. Non è ownership aggregata: ogni riga ha lifecycle, '
  'dettagli e candidature propri.';

-- Fascia d'età a tre stati (§13). «Due valori null non devono significare
-- contemporaneamente "non configurato" e "nessun limite".»
alter table public.recruiting_ads
  add column if not exists age_mode text not null default 'unset';

alter table public.recruiting_ads
  drop constraint if exists recruiting_ads_age_mode_check;

alter table public.recruiting_ads
  add constraint recruiting_ads_age_mode_check
  check (age_mode in ('unset', 'range', 'unrestricted'));

alter table public.recruiting_ads
  add column if not exists details jsonb not null default '{}'::jsonb;

comment on column public.recruiting_ads.details is
  'DAS-REV-16 §7: campi tipizzati dello schema del profilo — disponibilità, '
  'esperienze, patentino, qualifica testuale, responsabilità, requisiti. '
  'Una patch parziale non tocca le chiavi che non nomina (§21).';

alter table public.recruiting_ads
  add column if not exists schema_version integer not null default 1;

alter table public.recruiting_ads
  add column if not exists resource_version integer not null default 1;

-- §7 e §20: la descrizione è **facoltativa**. Era `not null` dal 2026-03-09,
-- quando l'unico form la imponeva.
alter table public.recruiting_ads
  alter column description drop not null;

-- §8: «Il titolo è derivato dal ruolo/nome custom; non input ridondante
-- dello step 1.» La colonna resta `not null` perché mezzo prodotto la legge:
-- la riempie il trigger della sezione 5, non il client.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recruiting_ads'
      and column_name = 'role_required' and is_nullable = 'NO'
  ) then
    execute 'alter table public.recruiting_ads alter column role_required drop not null';
  end if;
end;
$$;

comment on column public.recruiting_ads.role_required is
  'DAS-REV-16 §35: proiezione di structured_role_id per i soli profili '
  'PLAYER, conservata perché Cerca, Home e il dettaglio pubblico la leggono. '
  'Null sugli altri profili: un Allenatore non è un player_position.';

-- Backfill. Nessun valore inventato (§35).
update public.recruiting_ads
   set structured_role_id = role_required::text
 where structured_role_id is null
   and role_required is not null
   and exists (
     select 1 from public.position_roles pr
     where pr.id = role_required::text and pr.profile_type = 'player'
   );

update public.recruiting_ads
   set age_mode = 'range'
 where age_mode = 'unset'
   and (age_min is not null or age_max is not null);

create index if not exists recruiting_ads_batch_idx
  on public.recruiting_ads (creation_batch_id)
  where creation_batch_id is not null;

create index if not exists recruiting_ads_scope_idx
  on public.recruiting_ads (club_id, position_scope_type, status);


-- ============================================================
-- SEZIONE 4 — squadre dello stesso incarico
--
-- §15: «Altre squadre coinvolte nello stesso incarico è diverso da Cerca
-- questo profilo anche per un'altra squadra.» La prima è una relazione
-- secondaria su **una sola** Position; la seconda crea Position distinte.
-- Confonderle significa duplicare candidature, e §6 lo vieta: «Ogni
-- Application si riferisce a un solo Position ID.»
--
-- Unicità sulla coppia, e il Team principale è escluso da un trigger: non
-- da un `check`, perché il vincolo dipende da un'altra tabella.
-- ============================================================

create table if not exists public.recruiting_ad_teams (
  ad_id      uuid not null references public.recruiting_ads(id) on delete cascade,
  team_id    uuid not null references public.club_teams(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (ad_id, team_id)
);

create index if not exists recruiting_ad_teams_team_idx
  on public.recruiting_ad_teams (team_id);

comment on table public.recruiting_ad_teams is
  'DAS-REV-16 §15, §16: squadre secondarie dello stesso incarico '
  'Allenatore/Staff. Non duplicano la Position, non duplicano le '
  'candidature e non sono una seconda ricerca.';

create or replace function public.recruiting_ad_teams_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad record;
begin
  select ra.club_id, ra.team_id, ra.position_scope_type, ra.target_role::text as target_role
    into v_ad
  from public.recruiting_ads ra
  where ra.id = new.ad_id;

  if not found then
    raise exception 'POSITION_NOT_FOUND';
  end if;

  -- §17: «Non mostrare … Altre squadre dello stesso incarico» per Dirigente,
  -- e §15/§16 le riservano a Coach/Staff. Il vincolo vive qui perché una
  -- chiamata API diretta non passa dalla UI.
  if v_ad.target_role not in ('coach', 'staff') then
    raise exception 'POSITION_SECONDARY_TEAMS_NOT_ALLOWED';
  end if;

  if v_ad.position_scope_type <> 'team' or v_ad.team_id is null then
    raise exception 'POSITION_SECONDARY_TEAMS_NOT_ALLOWED';
  end if;

  if new.team_id = v_ad.team_id then
    raise exception 'POSITION_SECONDARY_TEAM_IS_PRIMARY';
  end if;

  if not exists (
    select 1 from public.club_teams ct
    where ct.id = new.team_id and ct.club_id = v_ad.club_id
  ) then
    raise exception 'POSITION_TEAM_NOT_ELIGIBLE';
  end if;

  return new;
end;
$$;

drop trigger if exists recruiting_ad_teams_guard on public.recruiting_ad_teams;
create trigger recruiting_ad_teams_guard
  before insert or update on public.recruiting_ad_teams
  for each row execute function public.recruiting_ad_teams_guard();

alter table public.recruiting_ad_teams enable row level security;

-- La visibilità segue la Position: §5 — «La lettura delle bozze rispetta le
-- ACL dell'intero oggetto: non restituire relazioni fuori scope.»
drop policy if exists "ad teams follow the position" on public.recruiting_ad_teams;
create policy "ad teams follow the position"
  on public.recruiting_ad_teams for select to authenticated
  using (
    exists (
      select 1 from public.recruiting_ads ra
      where ra.id = ad_id
        and (
          ra.status <> 'draft'
          or public.owns_club(ra.club_id)
          or public.is_current_user(ra.created_by_profile_id)
          or public.society_position_in_scope(ra.club_id, ra.team_id, 'positions_view')
        )
    )
  );


-- ============================================================
-- SEZIONE 5 — invarianti del modello, in un posto solo
--
-- Un trigger `before` e non un insieme di `check`: tre delle quattro regole
-- guardano un'altra tabella (il catalogo ruoli) o lo stato precedente della
-- riga, e nessun `check` può farlo.
--
-- §25: «Dal primo publish i dati identificativi non sono più modificabili
-- dalle API di bozza: profilo, ruolo/nome custom identificativo, Team
-- principale e ambito TEAM/SOCIETY. Questo guard vale anche con zero
-- candidature.» Vive qui e non nella RPC di patch perché una chiamata
-- diretta alla tabella non passa dalla RPC.
-- ============================================================

create or replace function public.recruiting_ads_composer_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role record;
begin
  -- ── Coerenza ambito ↔ Team (§6) ──────────────────────────────────────
  if new.position_scope_type = 'society' and new.team_id is not null then
    raise exception 'POSITION_SCOPE_TEAM_CONFLICT';
  end if;

  -- Solo Dirigente può essere Society-level (§9, §17).
  if new.position_scope_type = 'society' and new.target_role::text <> 'director' then
    raise exception 'POSITION_SCOPE_NOT_ALLOWED';
  end if;

  -- ── Ruolo e titolo derivato (§8) ─────────────────────────────────────
  if new.structured_role_id is not null then
    select pr.id, pr.profile_type, pr.label, pr.is_custom
      into v_role
    from public.position_roles pr
    where pr.id = new.structured_role_id;

    if not found then
      raise exception 'POSITION_ROLE_INVALID';
    end if;

    if v_role.profile_type <> new.target_role::text then
      raise exception 'POSITION_ROLE_PROFILE_MISMATCH';
    end if;

    -- «La selezione di un ruolo noto azzera il vecchio nome custom nella
    -- stessa modifica coerente» (§8).
    if not v_role.is_custom then
      new.custom_role_name := null;
    else
      new.custom_role_name := nullif(btrim(coalesce(new.custom_role_name, '')), '');

      if new.custom_role_name is not null and char_length(new.custom_role_name) > 80 then
        raise exception 'POSITION_CUSTOM_ROLE_TOO_LONG';
      end if;
    end if;

    -- §8: «Per ruolo noto il titolo è la label localizzata; per OTHER è il
    -- nome specificato.» Il titolo non è un campo del form.
    new.title := coalesce(
      case when v_role.is_custom then new.custom_role_name else v_role.label end,
      v_role.label
    );

    -- Proiezione legacy, solo per i calciatori (§35).
    if v_role.profile_type = 'player' then
      new.role_required := v_role.id::public.player_position;
    else
      new.role_required := null;
    end if;
  end if;

  -- ── Fascia d'età (§13) ───────────────────────────────────────────────
  if new.age_mode <> 'range' then
    new.age_min := null;
    new.age_max := null;
  end if;

  if new.age_mode = 'range'
     and new.age_min is not null and new.age_max is not null
     and new.age_min > new.age_max then
    raise exception 'POSITION_AGE_RANGE_INVALID';
  end if;

  -- L'età non appartiene agli altri tre schemi (§17).
  if new.target_role::text <> 'player' and new.age_mode <> 'unset' then
    new.age_mode := 'unset';
    new.age_min := null;
    new.age_max := null;
  end if;

  -- ── Un cambio di profilo porta via i dettagli che non gli appartengono
  --    (§22) ──────────────────────────────────────────────────────────────
  --
  -- «PLAYER→altro rimuove età/situazione non applicabili soltanto dopo la
  -- scelta confermata.» La conferma la raccoglie il client; la rimozione
  -- avviene qui, perché una chiamata API diretta non passa dal dialogo e
  -- lascerebbe una bozza con criteri di un altro schema — che
  -- `position_publish_blockers` rifiuterebbe senza che nessun campo
  -- visibile li mostri.
  --
  -- Nessuna conversione: §22 vieta che Coach→Staff trasformi un
  -- qualification ID in qualifica testuale, e il contrario. Le chiavi si
  -- rimuovono, non si traducono.
  if tg_op = 'UPDATE' and new.target_role is distinct from old.target_role then
    -- Le esperienze hanno id propri di ciascun profilo, quindi nessuna di
    -- esse sopravvive al cambio; le altre quattro chiavi appartengono a un
    -- solo schema e restano se è ancora il loro.
    new.details := coalesce(new.details, '{}'::jsonb) - (
      array['experience']
      || case when new.target_role::text = 'player'
           then array[]::text[] else array['playerExperience', 'playerSituation'] end
      || case when new.target_role::text = 'coach'
           then array[]::text[] else array['coachQualificationId'] end
      || case when new.target_role::text = 'staff'
           then array[]::text[] else array['staffQualification'] end
      || case when new.target_role::text = 'director'
           then array[]::text[] else array['responsibilities'] end
    );
  end if;

  -- ── Guard post-publish (§25) ─────────────────────────────────────────
  if tg_op = 'UPDATE' and old.published_at is not null then
    if new.target_role is distinct from old.target_role
       or new.structured_role_id is distinct from old.structured_role_id
       or new.custom_role_name is distinct from old.custom_role_name
       or new.team_id is distinct from old.team_id
       or new.position_scope_type is distinct from old.position_scope_type then
      raise exception 'POSITION_IDENTITY_LOCKED';
    end if;
  end if;

  -- ── published_at una volta sola (§25) ────────────────────────────────
  if new.status = 'published' and new.published_at is null then
    new.published_at := coalesce(
      case when tg_op = 'UPDATE' then old.published_at else null end,
      timezone('utc', now())
    );
  end if;

  if tg_op = 'UPDATE' then
    new.resource_version := coalesce(old.resource_version, 1) + 1;
  end if;

  return new;
end;
$$;

-- `before` e prima dello stamp di lifecycle della 20261026, che assume la
-- riga già coerente.
drop trigger if exists recruiting_ads_composer_guard on public.recruiting_ads;
create trigger recruiting_ads_composer_guard
  before insert or update on public.recruiting_ads
  for each row execute function public.recruiting_ads_composer_guard();


-- ============================================================
-- SEZIONE 6 — idempotenza di creazione e pubblicazione
--
-- §10: «Proteggi la prima creazione con una chiave idempotente della
-- sessione … Il retry con payload identico recupera gli stessi ID; payload
-- diverso con la stessa chiave produce conflitto, non altri oggetti.»
-- §25 ripete la stessa garanzia per il publish.
--
-- Una tabella sola per entrambe le operazioni: il protocollo è lo stesso, e
-- l'impronta del payload distingue un retry da un comando diverso. Il
-- risultato è conservato perché §10 chiede che «un timeout non dimostra che
-- la creazione sia fallita»: il client rigioca la chiave e riceve gli ID
-- già creati.
-- ============================================================

create table if not exists public.position_compose_operations (
  operation_key text primary key,
  actor_id      uuid not null references public.profiles(id) on delete cascade,
  club_id       uuid not null references public.clubs(id) on delete cascade,
  kind          text not null check (kind in ('create', 'publish')),
  fingerprint   text not null,
  result        jsonb not null,
  created_at    timestamptz not null default timezone('utc', now())
);

create index if not exists position_compose_operations_actor_idx
  on public.position_compose_operations (actor_id, created_at desc);

alter table public.position_compose_operations enable row level security;

-- Nessuna policy di SELECT: il protocollo si consuma dentro le RPC
-- `security definer`. Un client non legge le chiavi di un altro, e §33
-- esclude esplicitamente «chiavi idempotenti» dai payload pubblici.


-- ============================================================
-- SEZIONE 7 — il fuso della Società e il cutoff della deadline
--
-- §23: «Il giorno scelto è incluso interamente nella timezone della
-- società.» Il dominio non ha ancora un fuso per club; la funzione esiste
-- perché il giorno in cui lo avrà sia una riga sola da cambiare, invece di
-- una stringa ripetuta in cinque RPC.
-- ============================================================

create or replace function public.society_position_timezone(p_club_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select 'Europe/Rome'::text where p_club_id is not null;
$$;

revoke all on function public.society_position_timezone(uuid) from public;
grant execute on function public.society_position_timezone(uuid) to authenticated;

comment on function public.society_position_timezone(uuid) is
  'DAS-REV-16 §23: fuso in cui il cutoff della deadline è espresso. Un '
  'unico valore finché il dominio non conserva il fuso per Società.';


-- ============================================================
-- SEZIONE 8 — pubblicabilità: una derivazione, non un lifecycle
--
-- §6: «Readiness e presenza di dettagli aggiuntivi sono derivazioni dei
-- dati, non lifecycle persistenti. Non aggiungere stati READY, DRAFT_READY,
-- DRAFT_GUIDANCE o ENRICHED.»
--
-- §12 chiede inoltre di tenere distinti i motivi: un dato obbligatorio
-- mancante non è un Team diventato inutilizzabile, e nessuno dei due è un
-- errore di rete. La funzione restituisce quindi un array di codici, non un
-- booleano e non una frase.
--
-- I limiti di §20 sono applicati qui e soltanto qui, così client e server
-- non possono divergere: il client li riceve dalla configurazione.
-- ============================================================

create or replace function public.position_publish_blockers(p_ad_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ad      record;
  v_role    record;
  v_out     text[] := array[]::text[];
  v_details jsonb;
  v_avail   jsonb;
  v_exp     jsonb;
  v_item    text;
begin
  select ra.*, ra.target_role::text as profile_type
    into v_ad
  from public.recruiting_ads ra
  where ra.id = p_ad_id;

  if not found then
    return array['POSITION_NOT_FOUND'];
  end if;

  v_details := coalesce(v_ad.details, '{}'::jsonb);

  -- ── Ruolo ────────────────────────────────────────────────────────────
  if v_ad.structured_role_id is null then
    v_out := v_out || 'ROLE_MISSING';
  else
    select pr.* into v_role
    from public.position_roles pr
    where pr.id = v_ad.structured_role_id;

    if not found or not v_role.is_active or v_role.profile_type <> v_ad.profile_type then
      v_out := v_out || 'ROLE_INVALID';
    elsif v_role.is_custom
      and nullif(btrim(coalesce(v_ad.custom_role_name, '')), '') is null then
      v_out := v_out || 'CUSTOM_ROLE_MISSING';
    end if;
  end if;

  -- ── Ambito e Team (§6, §29) ──────────────────────────────────────────
  if v_ad.position_scope_type = 'team' then
    if v_ad.team_id is null then
      v_out := v_out || 'TEAM_MISSING';
    elsif not exists (
      select 1 from public.club_teams ct
      where ct.id = v_ad.team_id
        and ct.club_id = v_ad.club_id
        and not ct.is_archived
    ) then
      -- §29: «Team non attivo, eliminato o non più autorizzato dopo la
      -- creazione della DRAFT richiede revisione prima del publish.»
      v_out := v_out || 'TEAM_UNAVAILABLE';
    end if;
  elsif v_ad.position_scope_type = 'society' then
    if v_ad.team_id is not null then
      v_out := v_out || 'SCOPE_CONFLICT';
    end if;

    if v_ad.profile_type <> 'director' then
      v_out := v_out || 'SCOPE_NOT_ALLOWED';
    end if;
  end if;

  -- Squadre secondarie ancora valide (§29).
  if exists (
    select 1
    from public.recruiting_ad_teams rat
    join public.club_teams ct on ct.id = rat.team_id
    where rat.ad_id = p_ad_id
      and (ct.club_id <> v_ad.club_id or ct.is_archived)
  ) then
    v_out := v_out || 'SECONDARY_TEAM_UNAVAILABLE';
  end if;

  -- ── Fascia d'età, solo Calciatore (§13) ──────────────────────────────
  if v_ad.profile_type = 'player' then
    if v_ad.age_mode = 'unset' then
      v_out := v_out || 'AGE_UNSET';
    elsif v_ad.age_mode = 'range' then
      if v_ad.age_min is null or v_ad.age_max is null then
        v_out := v_out || 'AGE_RANGE_INCOMPLETE';
      elsif v_ad.age_min > v_ad.age_max then
        v_out := v_out || 'AGE_RANGE_INVALID';
      elsif v_ad.age_min < 5 or v_ad.age_max > 70 then
        -- §13: «centralizza un intervallo rappresentabile documentato; non
        -- presentarlo come regola federale.»
        v_out := v_out || 'AGE_OUT_OF_BOUNDS';
      end if;
    end if;
  end if;

  -- ── Formalità degli optional presenti (§7, §20) ──────────────────────
  if char_length(coalesce(v_ad.description, '')) > 2000 then
    v_out := v_out || 'DESCRIPTION_TOO_LONG';
  end if;

  if char_length(coalesce(v_details ->> 'requirements', '')) > 1000 then
    v_out := v_out || 'REQUIREMENTS_TOO_LONG';
  end if;

  if char_length(coalesce(v_details ->> 'staffQualification', '')) > 300 then
    v_out := v_out || 'STAFF_QUALIFICATION_TOO_LONG';
  end if;

  if char_length(coalesce(v_details ->> 'responsibilities', '')) > 1500 then
    v_out := v_out || 'RESPONSIBILITIES_TOO_LONG';
  end if;

  if v_details ? 'coachQualificationId'
     and jsonb_typeof(v_details -> 'coachQualificationId') <> 'null'
     and not exists (
       select 1 from public.position_qualifications q
       where q.id = v_details ->> 'coachQualificationId' and q.is_active
     ) then
    v_out := v_out || 'QUALIFICATION_INVALID';
  end if;

  -- Disponibilità: modalità e parametro devono essere coerenti (§19).
  v_avail := v_details -> 'availability';

  if v_avail is not null and jsonb_typeof(v_avail) = 'object' then
    if (v_avail ->> 'mode') not in ('immediate', 'from_date', 'next_season') then
      v_out := v_out || 'AVAILABILITY_INVALID';
    elsif v_avail ->> 'mode' = 'from_date' then
      begin
        perform (v_avail ->> 'date')::date;
      exception when others then
        v_out := v_out || 'AVAILABILITY_DATE_INVALID';
      end;

      if (v_avail ->> 'date') is null then
        v_out := v_out || 'AVAILABILITY_DATE_INVALID';
      end if;
    elsif v_avail ->> 'mode' = 'next_season'
      and (v_avail ->> 'seasonId') is not null
      and not exists (
        select 1 from public.seasons s where s.id = v_avail ->> 'seasonId'
      ) then
      v_out := v_out || 'AVAILABILITY_SEASON_INVALID';
    end if;
  end if;

  -- Esperienze: id del catalogo del proprio profilo, senza duplicati (§19).
  v_exp := v_details -> 'experience';

  if v_exp is not null and jsonb_typeof(v_exp) = 'array' then
    for v_item in select jsonb_array_elements_text(v_exp) loop
      if not exists (
        select 1 from public.position_experience_options o
        where o.id = v_item and o.profile_type = v_ad.profile_type
      ) then
        v_out := v_out || 'EXPERIENCE_INVALID';
        exit;
      end if;

      -- §17: un criterio relativo su una bozza SOCIETY senza riferimento
      -- resta recuperabile ma richiede revisione prima di pubblicare.
      if v_ad.position_scope_type = 'society'
         and exists (
           select 1 from public.position_experience_options o
           where o.id = v_item and o.profile_type = v_ad.profile_type
             and o.requires_team_context
         ) then
        v_out := v_out || 'EXPERIENCE_NEEDS_TEAM_CONTEXT';
        exit;
      end if;
    end loop;
  end if;

  -- Esperienza Calciatore: scelta singola, con categoria quando serve (§14).
  if v_ad.profile_type = 'player'
     and v_details ? 'playerExperience'
     and jsonb_typeof(v_details -> 'playerExperience') = 'object' then
    if (v_details -> 'playerExperience' ->> 'mode')
         not in ('in_category', 'higher_categories', 'from_category') then
      v_out := v_out || 'EXPERIENCE_INVALID';
    elsif (v_details -> 'playerExperience' ->> 'mode') = 'from_category'
      and not exists (
        select 1 from public.team_levels l
        where l.id = v_details -> 'playerExperience' ->> 'levelId'
      ) then
      v_out := v_out || 'EXPERIENCE_CATEGORY_INVALID';
    end if;
  end if;

  if v_ad.profile_type = 'player'
     and v_details ? 'playerSituation'
     and jsonb_typeof(v_details -> 'playerSituation') <> 'null'
     and (v_details ->> 'playerSituation') not in ('free_agent', 'open_to_transfer') then
    v_out := v_out || 'SITUATION_INVALID';
  end if;

  -- ── Deadline (§23, DAS-REV-18) ───────────────────────────────────────
  if v_ad.application_deadline_at is not null
     and v_ad.application_deadline_at <= timezone('utc', now()) then
    v_out := v_out || 'DEADLINE_PASSED';
  end if;

  return v_out;
end;
$$;

revoke all on function public.position_publish_blockers(uuid) from public;
grant execute on function public.position_publish_blockers(uuid) to authenticated;

comment on function public.position_publish_blockers(uuid) is
  'DAS-REV-16 §12: motivi per cui una DRAFT non è pubblicabile. Array '
  'vuoto = pubblicabile. Nessuno di questi stati viene persistito: §6 '
  'vieta READY, DRAFT_READY e simili.';


-- §12: «Per Staff, dettagli presenti significa almeno uno fra squadre
-- secondarie, qualifica testuale, esperienza, disponibilità, descrizione o
-- requisiti. Spazi vuoti non contano come dettagli.»
create or replace function public.position_has_details(p_ad_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ad      record;
  v_details jsonb;
begin
  select ra.*, ra.target_role::text as profile_type into v_ad
  from public.recruiting_ads ra where ra.id = p_ad_id;

  if not found then
    return false;
  end if;

  v_details := coalesce(v_ad.details, '{}'::jsonb);

  if nullif(btrim(coalesce(v_ad.description, '')), '') is not null then
    return true;
  end if;

  if nullif(btrim(coalesce(v_details ->> 'requirements', '')), '') is not null
     or nullif(btrim(coalesce(v_details ->> 'responsibilities', '')), '') is not null
     or nullif(btrim(coalesce(v_details ->> 'staffQualification', '')), '') is not null
     or nullif(coalesce(v_details ->> 'coachQualificationId', ''), '') is not null
     or nullif(coalesce(v_details ->> 'playerSituation', ''), '') is not null then
    return true;
  end if;

  if jsonb_typeof(v_details -> 'availability') = 'object' then
    return true;
  end if;

  if jsonb_typeof(v_details -> 'playerExperience') = 'object' then
    return true;
  end if;

  if jsonb_typeof(v_details -> 'experience') = 'array'
     and jsonb_array_length(v_details -> 'experience') > 0 then
    return true;
  end if;

  if v_ad.age_mode <> 'unset' and v_ad.profile_type = 'player' then
    return true;
  end if;

  return exists (select 1 from public.recruiting_ad_teams t where t.ad_id = p_ad_id);
end;
$$;

revoke all on function public.position_has_details(uuid) from public;
grant execute on function public.position_has_details(uuid) to authenticated;


-- ============================================================
-- SEZIONE 9 — autorizzazione del composer
--
-- §5: «Per ogni lettura e comando verifica sessione, Society, membership
-- attiva o ownership valida, capability dell'azione e scope effettivo.»
-- Quattro operazioni distinte, una funzione sola, così nessuna RPC può
-- dimenticarne un pezzo.
--
-- §5 di nuovo, per l'ambito SOCIETY: «serve autorizzazione effettiva
-- Society-wide all'operazione Position. La capability generale di gestione
-- Posizioni con scope limitato a Primavera non basta.» `p_team_id` nullo con
-- `p_scope = 'society'` richiede quindi scope null, non "nessun vincolo".
-- ============================================================

create or replace function public.position_can_operate(
  p_club_id uuid,
  p_scope   text,
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
  v_keys  text[];
  v_caps  text[];
  v_scope uuid[];
  v_key   text;
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

  v_keys := case p_action
    when 'view'    then array['positions_view']
    when 'create'  then array['positions_create', 'society_manage_positions']
    when 'edit'    then array['positions_create', 'society_manage_positions']
    when 'publish' then array['positions_publish']
    else array[]::text[]
  end;

  if array_length(v_keys, 1) is null then
    return false;
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  foreach v_key in array v_keys loop
    if v_key = any (v_caps) then
      v_scope := public.dashboard_club_capability_scope(p_club_id, v_key);

      if p_scope = 'society' then
        -- Un perimetro di squadre non copre un incarico del club.
        if v_scope is null then
          return true;
        end if;
      elsif v_scope is null then
        return true;
      elsif p_team_id is not null and p_team_id = any (v_scope) then
        return true;
      end if;
    end if;
  end loop;

  return false;
end;
$$;

revoke all on function public.position_can_operate(uuid, text, uuid, text) from public;
grant execute on function public.position_can_operate(uuid, text, uuid, text) to authenticated;

comment on function public.position_can_operate(uuid, text, uuid, text) is
  'DAS-REV-16 §5: capability + scope per view/create/edit/publish. Lo scope '
  'Society-wide (null) è l''unico che copre un incarico SOCIETY.';


/**
 * Scope su **tutte** le squadre dell'incarico, principale e secondarie.
 *
 * §5: «per modificare o pubblicare un incarico Allenatore/Staff, su tutte le
 * squadre secondarie incluse». §28: «Se viene perso scope su un Team
 * secondaria, il server non pubblica un incarico ridotto silenziosamente.»
 */
create or replace function public.position_can_operate_on_ad(
  p_ad_id  uuid,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ad  record;
  v_tid uuid;
begin
  select ra.club_id, ra.team_id, ra.position_scope_type into v_ad
  from public.recruiting_ads ra where ra.id = p_ad_id;

  if not found then
    return false;
  end if;

  if not public.position_can_operate(v_ad.club_id, v_ad.position_scope_type, v_ad.team_id, p_action) then
    return false;
  end if;

  for v_tid in
    select rat.team_id from public.recruiting_ad_teams rat where rat.ad_id = p_ad_id
  loop
    if not public.position_can_operate(v_ad.club_id, 'team', v_tid, p_action) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.position_can_operate_on_ad(uuid, text) from public;
grant execute on function public.position_can_operate_on_ad(uuid, text) to authenticated;


-- ============================================================
-- SEZIONE 10 — configurazione e cataloghi del composer (§7, §31)
--
-- Una lettura sola per contesto, capability e limiti; una per i cataloghi
-- dipendenti dal profilo. §32 chiede che un catalogo lento non blocchi i
-- campi già pronti, e due chiamate separate sono ciò che lo rende
-- possibile.
-- ============================================================

create or replace function public.fetch_position_composer_context(p_club_id uuid)
returns table (
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  club_is_verified   boolean,
  club_region        text,
  club_city          text,
  can_create         boolean,
  can_publish        boolean,
  can_create_society boolean,
  schema_version     integer,
  timezone_name      text,
  access_verified_at timestamptz,
  limits             jsonb
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

  if p_club_id is null
     or not exists (select 1 from public.clubs c where c.id = p_club_id) then
    raise exception 'POSITION_COMPOSER_NOT_AUTHORIZED';
  end if;

  /* Un actor con perimetro limitato a una squadra **deve** poter aprire il
     composer per quella squadra: §5 restringe l'ambito SOCIETY al perimetro
     Society-wide, non l'accesso al flusso. Il probe con Team nullo da solo
     fallirebbe proprio per chi ha uno scope di squadre, quindi la porta si
     apre anche con una sola squadra nel perimetro. */
  if not public.position_can_operate(p_club_id, 'society', null, 'view')
     and not exists (
       select 1 from public.club_teams ct
       where ct.club_id = p_club_id
         and public.position_can_operate(p_club_id, 'team', ct.id, 'view')
     ) then
    raise exception 'POSITION_COMPOSER_NOT_AUTHORIZED';
  end if;

  return query
  select
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    c.region,
    c.city,
    /* «Nascondi azioni non autorizzate»: `can_create` è vero se esiste
       almeno un ambito in cui l'actor può creare. */
    public.position_can_operate(p_club_id, 'society', null, 'create')
      or exists (
        select 1 from public.club_teams ct
        where ct.club_id = p_club_id and not ct.is_archived
          and public.position_can_operate(p_club_id, 'team', ct.id, 'create')
      ),
    public.position_can_operate(p_club_id, 'society', null, 'publish')
      or exists (
        select 1 from public.club_teams ct
        where ct.club_id = p_club_id and not ct.is_archived
          and public.position_can_operate(p_club_id, 'team', ct.id, 'publish')
      ),
    public.position_can_operate(p_club_id, 'society', null, 'create'),
    1,
    public.society_position_timezone(p_club_id),
    timezone('utc', now()),
    /* §20: «una sola configurazione iniziale, condivisa client/server». Il
       client non ha una seconda copia di questi numeri. */
    jsonb_build_object(
      'customRoleName',    80,
      'staffQualification', 300,
      'responsibilities',  1500,
      'description',       2000,
      'requirements',      1000,
      'ageMin',            5,
      'ageMax',            70
    )
  from public.clubs c
  where c.id = p_club_id;
end;
$$;

revoke all on function public.fetch_position_composer_context(uuid) from public;
grant execute on function public.fetch_position_composer_context(uuid) to authenticated;


/** Squadre eleggibili come principale o come secondaria (§9, §15). */
create or replace function public.fetch_position_eligible_teams(p_club_id uuid)
returns table (
  team_id       uuid,
  team_name     text,
  context_label text,
  can_create    boolean,
  can_publish   boolean,
  sort_order    integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_season text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
       select 1 from public.club_teams ct
       where ct.club_id = p_club_id
         and public.position_can_operate(p_club_id, 'team', ct.id, 'view')
     ) then
    return;
  end if;

  select s.id into v_season
  from public.seasons s
  where current_date between s.starts_on and s.ends_on
  order by s.sort_order desc
  limit 1;

  return query
  select
    ct.id,
    ct.name,
    /* §9: «nome più livello/tipo quando disponibile». Dalla TeamSeason
       pertinente, mai dal nome della squadra (§13). */
    coalesce(
      (select tl.label
         from public.club_team_seasons cts
         join public.team_levels tl on tl.id = cts.level_id
        where cts.team_id = ct.id and cts.season_id = v_season),
      (select tt.label
         from public.club_team_seasons cts
         join public.team_types tt on tt.id = cts.team_type_id
        where cts.team_id = ct.id and cts.season_id = v_season),
      nullif(ct.category, '')
    ),
    public.position_can_operate(p_club_id, 'team', ct.id, 'create'),
    public.position_can_operate(p_club_id, 'team', ct.id, 'publish'),
    ct.sort_order
  from public.club_teams ct
  where ct.club_id = p_club_id
    /* §9: «Sono eleggibili soltanto Team interni, attivi, della Society
       corrente e autorizzati. Le società affiliate e i loro Team non
       appartengono al selector.» */
    and not ct.is_archived
    and public.position_can_operate(p_club_id, 'team', ct.id, 'view')
  order by ct.sort_order, ct.name;
end;
$$;

revoke all on function public.fetch_position_eligible_teams(uuid) from public;
grant execute on function public.fetch_position_eligible_teams(uuid) to authenticated;


/** Cataloghi dipendenti dal profilo (§8, §15, §16, §19). */
create or replace function public.fetch_position_catalogs(p_profile_type text)
returns table (
  catalog     text,
  item_id     text,
  label       text,
  is_custom   boolean,
  needs_context boolean,
  sort_order  integer
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

  if p_profile_type not in ('player', 'coach', 'staff', 'director') then
    raise exception 'POSITION_PROFILE_INVALID';
  end if;

  return query
  select 'role'::text, pr.id, pr.label, pr.is_custom, false, pr.sort_order
  from public.position_roles pr
  where pr.profile_type = p_profile_type and pr.is_active

  union all
  select 'experience'::text, o.id, o.label, false, o.requires_team_context, o.sort_order
  from public.position_experience_options o
  where o.profile_type = p_profile_type

  union all
  select 'qualification'::text, q.id, q.label, false, false, q.sort_order
  from public.position_qualifications q
  where q.is_active and p_profile_type = 'coach'

  union all
  select 'category'::text, l.id, l.label, false, false, l.sort_order
  from public.team_levels l
  where l.is_active and p_profile_type = 'player'

  union all
  select 'season'::text, s.id, s.label, false, false, s.sort_order
  from public.seasons s
  where s.ends_on >= current_date - interval '1 year'
    and s.starts_on <= current_date + interval '2 years'

  order by 1, 6, 3;
end;
$$;

revoke all on function public.fetch_position_catalogs(text) from public;
grant execute on function public.fetch_position_catalogs(text) to authenticated;


-- ============================================================
-- SEZIONE 11 — creazione del set DRAFT (§10)
--
-- «Continua crea una DRAFT per ciascun Team principale selezionato, con lo
-- stesso profilo/ruolo ma Position ID indipendenti. … Il comando iniziale
-- deve essere atomico sul set richiesto: un Team non valido non genera
-- silenziosamente soltanto parte delle bozze.»
--
-- Una funzione plpgsql è già una transazione: o esce con gli ID, o solleva
-- e non lascia nulla. L'atomicità non va costruita, va soltanto non rotta —
-- quindi nessun `exception when others` che inghiotta un errore parziale.
--
-- Per SOCIETY `p_team_ids` è vuoto e nasce **una** Position: §10 — «non
-- replicarla sulle squadre del club».
-- ============================================================

create or replace function public.create_position_drafts(
  p_club_id          uuid,
  p_profile_type     text,
  p_role_id          text,
  p_custom_role_name text,
  p_scope            text,
  p_team_ids         uuid[],
  p_operation_key    text
)
returns table (position_id uuid, team_id uuid, sort_order integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_role        record;
  v_fingerprint text;
  v_existing    record;
  v_batch       uuid;
  v_team        uuid;
  v_teams       uuid[];
  v_idx         integer := 0;
  v_new         uuid;
  v_result      jsonb := '[]'::jsonb;
  v_name        text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_operation_key is null or char_length(p_operation_key) < 8 then
    raise exception 'POSITION_OPERATION_KEY_REQUIRED';
  end if;

  if p_scope not in ('team', 'society') then
    raise exception 'POSITION_SCOPE_INVALID';
  end if;

  if p_profile_type not in ('player', 'coach', 'staff', 'director') then
    raise exception 'POSITION_PROFILE_INVALID';
  end if;

  select pr.* into v_role
  from public.position_roles pr
  where pr.id = p_role_id and pr.is_active;

  if not found or v_role.profile_type <> p_profile_type then
    raise exception 'POSITION_ROLE_INVALID';
  end if;

  v_name := nullif(btrim(coalesce(p_custom_role_name, '')), '');

  if v_role.is_custom then
    if v_name is null then
      raise exception 'POSITION_CUSTOM_ROLE_REQUIRED';
    end if;

    if char_length(v_name) > 80 then
      raise exception 'POSITION_CUSTOM_ROLE_TOO_LONG';
    end if;
  else
    v_name := null;
  end if;

  -- Deduplica e ordina: la mappa degli elementi richiesti deve essere
  -- **stabile** perché l'impronta di un retry coincida (§10).
  if p_scope = 'society' then
    if p_profile_type <> 'director' then
      raise exception 'POSITION_SCOPE_NOT_ALLOWED';
    end if;

    v_teams := array[]::uuid[];
  else
    select coalesce(array_agg(distinct t order by t), array[]::uuid[])
      into v_teams
    from unnest(coalesce(p_team_ids, array[]::uuid[])) as t
    where t is not null;

    if array_length(v_teams, 1) is null then
      raise exception 'POSITION_TEAM_REQUIRED';
    end if;
  end if;

  v_fingerprint := md5(
    coalesce(p_club_id::text, '') || '|' || p_profile_type || '|' || p_role_id
    || '|' || coalesce(v_name, '') || '|' || p_scope || '|'
    || coalesce(array_to_string(v_teams, ','), '')
  );

  -- ── Protocollo idempotente (§10) ─────────────────────────────────────
  select o.* into v_existing
  from public.position_compose_operations o
  where o.operation_key = p_operation_key;

  if found then
    if v_existing.fingerprint <> v_fingerprint
       or v_existing.actor_id <> v_uid
       or v_existing.kind <> 'create' then
      raise exception 'POSITION_OPERATION_CONFLICT';
    end if;

    return query
    select (e ->> 'id')::uuid,
           nullif(e ->> 'teamId', '')::uuid,
           (e ->> 'order')::integer
    from jsonb_array_elements(v_existing.result) as e
    order by (e ->> 'order')::integer;

    return;
  end if;

  -- ── Autorizzazione, su ogni elemento del set ─────────────────────────
  if p_scope = 'society' then
    if not public.position_can_operate(p_club_id, 'society', null, 'create') then
      raise exception 'POSITION_NOT_AUTHORIZED';
    end if;
  else
    foreach v_team in array v_teams loop
      if not exists (
        select 1 from public.club_teams ct
        where ct.id = v_team and ct.club_id = p_club_id and not ct.is_archived
      ) then
        -- §9: «Un Team non attivo non viene riattivato da questo flow.»
        raise exception 'POSITION_TEAM_NOT_ELIGIBLE';
      end if;

      if not public.position_can_operate(p_club_id, 'team', v_team, 'create') then
        raise exception 'POSITION_NOT_AUTHORIZED';
      end if;
    end loop;
  end if;

  v_batch := gen_random_uuid();

  if p_scope = 'society' then
    insert into public.recruiting_ads (
      club_id, created_by_profile_id, title, target_role, structured_role_id,
      custom_role_name, position_scope_type, team_id, creation_batch_id,
      status, age_mode, details
    ) values (
      p_club_id, v_uid, v_role.label, p_profile_type::public.app_role, v_role.id,
      v_name, 'society', null, v_batch,
      'draft', 'unset', '{}'::jsonb
    )
    returning id into v_new;

    v_result := v_result || jsonb_build_object('id', v_new, 'teamId', null, 'order', 0);
    position_id := v_new;
    team_id := null;
    sort_order := 0;
    return next;
  else
    foreach v_team in array v_teams loop
      insert into public.recruiting_ads (
        club_id, created_by_profile_id, title, target_role, structured_role_id,
        custom_role_name, position_scope_type, team_id, creation_batch_id,
        status, age_mode, details
      ) values (
        p_club_id, v_uid, v_role.label, p_profile_type::public.app_role, v_role.id,
        v_name, 'team', v_team, v_batch,
        'draft', 'unset', '{}'::jsonb
      )
      returning id into v_new;

      v_result := v_result || jsonb_build_object(
        'id', v_new, 'teamId', v_team, 'order', v_idx
      );

      position_id := v_new;
      team_id := v_team;
      sort_order := v_idx;
      return next;

      v_idx := v_idx + 1;
    end loop;
  end if;

  insert into public.position_compose_operations
    (operation_key, actor_id, club_id, kind, fingerprint, result)
  values
    (p_operation_key, v_uid, p_club_id, 'create', v_fingerprint, v_result);
end;
$$;

revoke all on function public.create_position_drafts(uuid, text, text, text, text, uuid[], text) from public;
grant execute on function public.create_position_drafts(uuid, text, text, text, text, uuid[], text) to authenticated;

comment on function public.create_position_drafts(uuid, text, text, text, text, uuid[], text) is
  'DAS-REV-16 §10: una DRAFT per Team principale, ID indipendenti, commit '
  'atomico sul set richiesto. Lo stesso operation_key con payload diverso '
  'è un conflitto, non altri oggetti.';


-- ============================================================
-- SEZIONE 12 — lettura delle bozze della sessione (§11, §21, §23)
--
-- Una sola funzione per l'hub, il dettaglio, l'anteprima singola e il
-- riepilogo multiplo: sono quattro viste degli stessi dati, e §23 chiede
-- che la preview usi «lo stesso renderer del dettaglio pubblico» — due
-- letture diverse avrebbero garantito la divergenza.
--
-- §5: «La lettura delle bozze rispetta le ACL dell'intero oggetto: non
-- restituire relazioni fuori scope. Se non esiste una proiezione parziale
-- sicura nel dominio, non aprire la bozza indivisibile priva delle
-- autorizzazioni necessarie.» Un ID non autorizzato viene **omesso**, non
-- restituito monco.
-- ============================================================

create or replace function public.fetch_position_drafts(p_ids uuid[])
returns table (
  position_id         uuid,
  club_id             uuid,
  club_name           text,
  club_logo_url       text,
  club_is_verified    boolean,
  club_region         text,
  club_city           text,
  profile_type        text,
  role_id             text,
  role_label          text,
  role_is_custom      boolean,
  custom_role_name    text,
  title               text,
  position_scope      text,
  team_id             uuid,
  team_name           text,
  context_label       text,
  secondary_teams     jsonb,
  age_mode            text,
  age_min             integer,
  age_max             integer,
  description         text,
  details             jsonb,
  deadline_at         timestamptz,
  deadline_date       date,
  deadline_timezone   text,
  status              text,
  published_at        timestamptz,
  resource_version    integer,
  schema_version      integer,
  creation_batch_id   uuid,
  can_edit            boolean,
  can_publish         boolean,
  has_details         boolean,
  blockers            text[],
  updated_at          timestamptz,
  access_verified_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_season text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select s.id into v_season
  from public.seasons s
  where current_date between s.starts_on and s.ends_on
  order by s.sort_order desc
  limit 1;

  return query
  select
    ra.id,
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    c.region,
    c.city,
    ra.target_role::text,
    ra.structured_role_id,
    pr.label,
    coalesce(pr.is_custom, false),
    ra.custom_role_name,
    ra.title,
    ra.position_scope_type,
    ra.team_id,
    ct.name,
    /* §17: un incarico SOCIETY non mostra categoria Team. */
    case
      when ra.position_scope_type = 'society' then null
      else coalesce(
        (select tl.label
           from public.club_team_seasons cts
           join public.team_levels tl on tl.id = cts.level_id
          where cts.team_id = ct.id and cts.season_id = v_season),
        (select tt.label
           from public.club_team_seasons cts
           join public.team_types tt on tt.id = cts.team_type_id
          where cts.team_id = ct.id and cts.season_id = v_season),
        nullif(ct.category, '')
      )
    end,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
                'teamId', t.id,
                'name',   t.name,
                'isInactive', t.is_archived
              ) order by t.sort_order, t.name)
         from public.recruiting_ad_teams rat
         join public.club_teams t on t.id = rat.team_id
        where rat.ad_id = ra.id),
      '[]'::jsonb
    ),
    ra.age_mode,
    ra.age_min,
    ra.age_max,
    ra.description,
    coalesce(ra.details, '{}'::jsonb),
    ra.application_deadline_at,
    /* Il giorno civile nel fuso della Società: il client non riconverte un
       istante UTC e non sposta il giorno (§23). */
    case
      when ra.application_deadline_at is null then null
      else (ra.application_deadline_at
              at time zone public.society_position_timezone(ra.club_id))::date
    end,
    ra.application_deadline_timezone,
    ra.status::text,
    ra.published_at,
    ra.resource_version,
    ra.schema_version,
    ra.creation_batch_id,
    public.position_can_operate_on_ad(ra.id, 'edit'),
    public.position_can_operate_on_ad(ra.id, 'publish'),
    public.position_has_details(ra.id),
    public.position_publish_blockers(ra.id),
    ra.updated_at,
    timezone('utc', now())
  from public.recruiting_ads ra
  join public.clubs c on c.id = ra.club_id
  left join public.club_teams ct on ct.id = ra.team_id
  left join public.position_roles pr on pr.id = ra.structured_role_id
  where ra.id = any (coalesce(p_ids, array[]::uuid[]))
    and public.position_can_operate_on_ad(ra.id, 'view')
  order by ra.created_at, ra.id;
end;
$$;

revoke all on function public.fetch_position_drafts(uuid[]) from public;
grant execute on function public.fetch_position_drafts(uuid[]) to authenticated;


-- ============================================================
-- SEZIONE 13 — patch parziale di una bozza (§21, §22, §28)
--
-- «Assenza nella patch significa "non modificare"; null esplicito significa
-- "rimuovere", quando consentito.» Questo è il motivo per cui la patch è un
-- `jsonb` e non venti parametri: venti parametri non sanno distinguere
-- "assente" da "null".
--
-- «Non sovrascrivere optional di altre Position, campi sconosciuti alla
-- versione client»: `details` viene **fuso**, non sostituito, e le chiavi
-- che il client non nomina sopravvivono.
-- ============================================================

create or replace function public.update_position_draft(
  p_ad_id            uuid,
  p_expected_version integer,
  p_patch            jsonb
)
returns table (position_id uuid, resource_version integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad       record;
  v_patch    jsonb := coalesce(p_patch, '{}'::jsonb);
  v_details  jsonb;
  v_key      text;
  v_value    jsonb;
  v_teams    uuid[];
  v_team     uuid;
  v_role     record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select ra.*, ra.target_role::text as profile_type into v_ad
  from public.recruiting_ads ra
  where ra.id = p_ad_id
  for update;

  if not found then
    raise exception 'POSITION_NOT_FOUND';
  end if;

  if not public.position_can_operate_on_ad(p_ad_id, 'edit') then
    raise exception 'POSITION_NOT_AUTHORIZED';
  end if;

  -- §28: «Una Position pubblicata da altro actor mentre è aperta in edit
  -- DRAFT non accetta patch bozza.»
  if v_ad.status <> 'draft' then
    raise exception 'POSITION_LIFECYCLE_CONFLICT';
  end if;

  if p_expected_version is not null
     and p_expected_version <> v_ad.resource_version then
    raise exception 'POSITION_VERSION_CONFLICT';
  end if;

  v_details := coalesce(v_ad.details, '{}'::jsonb);

  -- ── Dati comuni, modificabili finché DRAFT (§22) ─────────────────────
  if v_patch ? 'profileType' or v_patch ? 'roleId' then
    declare
      v_profile text := coalesce(v_patch ->> 'profileType', v_ad.profile_type);
      v_role_id text := coalesce(v_patch ->> 'roleId', v_ad.structured_role_id);
    begin
      select pr.* into v_role
      from public.position_roles pr
      where pr.id = v_role_id and pr.is_active;

      if not found or v_role.profile_type <> v_profile then
        raise exception 'POSITION_ROLE_INVALID';
      end if;

      update public.recruiting_ads
         set target_role = v_profile::public.app_role,
             structured_role_id = v_role.id
       where id = p_ad_id;

      -- Il guard rilegge il ruolo e deriva titolo e proiezione legacy.
      select ra.*, ra.target_role::text as profile_type into v_ad
      from public.recruiting_ads ra where ra.id = p_ad_id;
    end;
  end if;

  if v_patch ? 'customRoleName' then
    update public.recruiting_ads
       set custom_role_name = nullif(btrim(coalesce(v_patch ->> 'customRoleName', '')), '')
     where id = p_ad_id;
  end if;

  if v_patch ? 'scope' or v_patch ? 'teamId' then
    declare
      v_scope text := coalesce(v_patch ->> 'scope', v_ad.position_scope_type);
      v_new_team uuid := case
        when v_patch ? 'teamId' then nullif(v_patch ->> 'teamId', '')::uuid
        else v_ad.team_id
      end;
    begin
      if v_scope = 'society' then
        v_new_team := null;
      elsif v_new_team is null then
        raise exception 'POSITION_TEAM_REQUIRED';
      elsif not exists (
        select 1 from public.club_teams ct
        where ct.id = v_new_team and ct.club_id = v_ad.club_id and not ct.is_archived
      ) then
        raise exception 'POSITION_TEAM_NOT_ELIGIBLE';
      end if;

      if not public.position_can_operate(v_ad.club_id, v_scope, v_new_team, 'edit') then
        raise exception 'POSITION_NOT_AUTHORIZED';
      end if;

      -- Cambiando ambito o squadra principale le secondarie non hanno più
      -- un riferimento valido (§22): si rimuovono con la stessa modifica.
      if v_scope <> v_ad.position_scope_type or v_new_team is distinct from v_ad.team_id then
        delete from public.recruiting_ad_teams where ad_id = p_ad_id;
      end if;

      update public.recruiting_ads
         set position_scope_type = v_scope,
             team_id = v_new_team
       where id = p_ad_id;
    end;
  end if;

  -- ── Fascia d'età (§13) ───────────────────────────────────────────────
  if v_patch ? 'ageMode' then
    update public.recruiting_ads
       set age_mode = coalesce(v_patch ->> 'ageMode', 'unset'),
           age_min = case
             when (v_patch ->> 'ageMode') = 'range'
               then nullif(v_patch ->> 'ageMin', '')::integer
             else null end,
           age_max = case
             when (v_patch ->> 'ageMode') = 'range'
               then nullif(v_patch ->> 'ageMax', '')::integer
             else null end
     where id = p_ad_id;
  end if;

  -- ── Descrizione: colonna esistente, non una chiave di `details` ──────
  if v_patch ? 'description' then
    update public.recruiting_ads
       set description = nullif(btrim(coalesce(v_patch ->> 'description', '')), '')
     where id = p_ad_id;
  end if;

  -- ── Squadre dello stesso incarico (§15, §16) ─────────────────────────
  if v_patch ? 'secondaryTeamIds' then
    if jsonb_typeof(v_patch -> 'secondaryTeamIds') <> 'array' then
      raise exception 'POSITION_SECONDARY_TEAMS_INVALID';
    end if;

    select coalesce(array_agg(distinct t::uuid), array[]::uuid[])
      into v_teams
    from jsonb_array_elements_text(v_patch -> 'secondaryTeamIds') as t
    where nullif(t, '') is not null;

    foreach v_team in array v_teams loop
      -- §5: scope su tutte le squadre coinvolte, prima di scriverle.
      if not public.position_can_operate(v_ad.club_id, 'team', v_team, 'edit') then
        raise exception 'POSITION_NOT_AUTHORIZED';
      end if;
    end loop;

    delete from public.recruiting_ad_teams
     where ad_id = p_ad_id
       and team_id <> all (v_teams);

    insert into public.recruiting_ad_teams (ad_id, team_id)
    select p_ad_id, t from unnest(v_teams) as t
    on conflict do nothing;
  end if;

  -- ── Dettagli tipizzati: fusione, non sostituzione (§21) ──────────────
  if v_patch ? 'details' and jsonb_typeof(v_patch -> 'details') = 'object' then
    for v_key, v_value in select * from jsonb_each(v_patch -> 'details') loop
      if jsonb_typeof(v_value) = 'null' then
        v_details := v_details - v_key;
      elsif jsonb_typeof(v_value) = 'string'
        and nullif(btrim(v_value #>> '{}'), '') is null then
        -- §20: «Spazi soltanto equivalgono a null.»
        v_details := v_details - v_key;
      elsif jsonb_typeof(v_value) = 'string' then
        v_details := jsonb_set(v_details, array[v_key], to_jsonb(btrim(v_value #>> '{}')));
      elsif jsonb_typeof(v_value) = 'array'
        and jsonb_array_length(v_value) = 0 then
        v_details := v_details - v_key;
      else
        v_details := jsonb_set(v_details, array[v_key], v_value);
      end if;
    end loop;

    update public.recruiting_ads set details = v_details where id = p_ad_id;
  end if;

  update public.recruiting_ads
     set updated_at = timezone('utc', now())
   where id = p_ad_id;

  return query
  select ra.id, ra.resource_version
  from public.recruiting_ads ra where ra.id = p_ad_id;
end;
$$;

revoke all on function public.update_position_draft(uuid, integer, jsonb) from public;
grant execute on function public.update_position_draft(uuid, integer, jsonb) to authenticated;


-- ============================================================
-- SEZIONE 14 — scadenza candidature facoltativa (§23, DAS-REV-18)
--
-- «Il giorno scelto è incluso interamente nella timezone della società; il
-- backend conserva data/fuso/istante coerenti e rivalida il cutoff al
-- publish. Oggi è ammesso finché non termina quel giorno locale.»
--
-- Il client manda una **data civile**, mai un istante: §23 vieta la
-- conversione che sposta il giorno. L'istante lo calcola qui il server, a
-- fine giornata locale.
--
-- La scelta «persiste sulla stessa DRAFT con patch parziale/versione; non
-- pubblica e non crea una copia della bozza».
-- ============================================================

create or replace function public.set_position_deadline(
  p_ad_id            uuid,
  p_expected_version integer,
  p_deadline_date    date
)
returns table (position_id uuid, resource_version integer, deadline_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad  record;
  v_tz  text;
  v_at  timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select ra.* into v_ad
  from public.recruiting_ads ra where ra.id = p_ad_id for update;

  if not found then
    raise exception 'POSITION_NOT_FOUND';
  end if;

  if not public.position_can_operate_on_ad(p_ad_id, 'edit') then
    raise exception 'POSITION_NOT_AUTHORIZED';
  end if;

  if p_expected_version is not null
     and p_expected_version <> v_ad.resource_version then
    raise exception 'POSITION_VERSION_CONFLICT';
  end if;

  v_tz := public.society_position_timezone(v_ad.club_id);

  if p_deadline_date is null then
    v_at := null;
  else
    -- Fine del giorno locale: l'ultimo istante del giorno scelto, non la
    -- sua mezzanotte iniziale.
    v_at := ((p_deadline_date + 1)::timestamp at time zone v_tz) - interval '1 microsecond';
  end if;

  update public.recruiting_ads
     set application_deadline_at = v_at,
         application_deadline_timezone = case when v_at is null then null else v_tz end,
         updated_at = timezone('utc', now())
   where id = p_ad_id;

  return query
  select ra.id, ra.resource_version, ra.application_deadline_at
  from public.recruiting_ads ra where ra.id = p_ad_id;
end;
$$;

revoke all on function public.set_position_deadline(uuid, integer, date) from public;
grant execute on function public.set_position_deadline(uuid, integer, date) to authenticated;


-- ============================================================
-- SEZIONE 15 — pubblicazione del set selezionato (§25)
--
-- «Per il batch, pubblicazione parziale significa scegliere un
-- sottoinsieme. Il set scelto viene validato e applicato come unità logica:
-- se una Position del set non è più pubblicabile, non pubblicare
-- silenziosamente le altre.»
--
-- Quindi: prima si valida **tutto** il set, poi si scrive. Un solo errore e
-- la funzione solleva, la transazione torna indietro e nessuna Position è
-- stata pubblicata. L'esito per elemento viaggia nel messaggio, così il
-- client sa quale riga rivedere senza una seconda chiamata.
--
-- L'idempotenza usa lo stesso protocollo della creazione: retry identico →
-- stesso risultato; stessa chiave con un set diverso → conflitto. Doppi
-- tap, consegne duplicate e richieste concorrenti non producono due
-- `published_at` perché il guard della sezione 5 lo assegna una volta sola
-- e perché `for update` serializza i commit concorrenti sulla stessa riga.
-- ============================================================

create or replace function public.publish_positions(
  p_ad_ids           uuid[],
  p_expected_versions integer[],
  p_operation_key    text
)
returns table (position_id uuid, published_at timestamptz, resource_version integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_ids         uuid[];
  v_id          uuid;
  v_idx         integer;
  v_ad          record;
  v_blockers    text[];
  v_fingerprint text;
  v_existing    record;
  v_club        uuid;
  v_result      jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_operation_key is null or char_length(p_operation_key) < 8 then
    raise exception 'POSITION_OPERATION_KEY_REQUIRED';
  end if;

  select coalesce(array_agg(distinct t order by t), array[]::uuid[])
    into v_ids
  from unnest(coalesce(p_ad_ids, array[]::uuid[])) as t
  where t is not null;

  if array_length(v_ids, 1) is null then
    raise exception 'POSITION_SELECTION_EMPTY';
  end if;

  v_fingerprint := md5(
    array_to_string(v_ids, ',') || '|' ||
    coalesce(array_to_string(coalesce(p_expected_versions, array[]::integer[]), ','), '')
  );

  select o.* into v_existing
  from public.position_compose_operations o
  where o.operation_key = p_operation_key;

  if found then
    if v_existing.kind <> 'publish'
       or v_existing.actor_id <> v_uid
       or v_existing.fingerprint <> v_fingerprint then
      raise exception 'POSITION_OPERATION_CONFLICT';
    end if;

    return query
    select (e ->> 'id')::uuid,
           (e ->> 'publishedAt')::timestamptz,
           (e ->> 'version')::integer
    from jsonb_array_elements(v_existing.result) as e;

    return;
  end if;

  -- ── Fase 1: lock e validazione dell'intero set ───────────────────────
  foreach v_id in array v_ids loop
    select ra.* into v_ad
    from public.recruiting_ads ra where ra.id = v_id for update;

    if not found then
      raise exception 'POSITION_NOT_FOUND:%', v_id;
    end if;

    if v_club is null then
      v_club := v_ad.club_id;
    elsif v_club <> v_ad.club_id then
      -- §33: il client non assegna un'altra Society modificando il payload.
      raise exception 'POSITION_SELECTION_INVALID';
    end if;

    if not public.position_can_operate_on_ad(v_id, 'publish') then
      raise exception 'POSITION_PUBLISH_NOT_AUTHORIZED:%', v_id;
    end if;

    /* Una DRAFT pubblicata nel frattempo da un altro actor non viene
       ripubblicata e non torna indietro (§25): il retry riconcilia. */
    if v_ad.status <> 'draft' then
      raise exception 'POSITION_LIFECYCLE_CONFLICT:%', v_id;
    end if;

    if p_expected_versions is not null then
      v_idx := array_position(v_ids, v_id);

      if v_idx is not null
         and array_length(p_expected_versions, 1) >= v_idx
         and p_expected_versions[v_idx] is not null
         and p_expected_versions[v_idx] <> v_ad.resource_version then
        raise exception 'POSITION_VERSION_CONFLICT:%', v_id;
      end if;
    end if;

    v_blockers := public.position_publish_blockers(v_id);

    if array_length(v_blockers, 1) is not null then
      raise exception 'POSITION_NOT_PUBLISHABLE:%:%', v_id, array_to_string(v_blockers, ',');
    end if;
  end loop;

  -- ── Fase 2: commit del set, dopo che tutto il set è valido ───────────
  foreach v_id in array v_ids loop
    update public.recruiting_ads
       set status = 'published',
           updated_at = timezone('utc', now())
     where id = v_id;

    select ra.id, ra.published_at, ra.resource_version into v_ad
    from public.recruiting_ads ra where ra.id = v_id;

    v_result := v_result || jsonb_build_object(
      'id', v_ad.id,
      'publishedAt', v_ad.published_at,
      'version', v_ad.resource_version
    );

    position_id := v_ad.id;
    published_at := v_ad.published_at;
    resource_version := v_ad.resource_version;
    return next;
  end loop;

  insert into public.position_compose_operations
    (operation_key, actor_id, club_id, kind, fingerprint, result)
  values
    (p_operation_key, v_uid, v_club, 'publish', v_fingerprint, v_result);
end;
$$;

revoke all on function public.publish_positions(uuid[], integer[], text) from public;
grant execute on function public.publish_positions(uuid[], integer[], text) to authenticated;

comment on function public.publish_positions(uuid[], integer[], text) is
  'DAS-REV-16 §25: il set selezionato è un''unità logica. Un elemento non '
  'più pubblicabile fa fallire il comando; nessuna Position viene '
  'pubblicata a metà.';


/** Cancellazione esplicita di una bozza (§22): non coincide con Annulla. */
create or replace function public.delete_position_draft(p_ad_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select ra.* into v_ad from public.recruiting_ads ra where ra.id = p_ad_id;

  if not found then
    return;
  end if;

  if not public.position_can_operate_on_ad(p_ad_id, 'edit') then
    raise exception 'POSITION_NOT_AUTHORIZED';
  end if;

  if v_ad.status <> 'draft' or v_ad.published_at is not null then
    raise exception 'POSITION_LIFECYCLE_CONFLICT';
  end if;

  delete from public.recruiting_ads where id = p_ad_id;
end;
$$;

revoke all on function public.delete_position_draft(uuid) from public;
grant execute on function public.delete_position_draft(uuid) to authenticated;


-- ============================================================
-- SEZIONE 16 — DAS-REV-15 legge l'ambito, non l'assenza del Team
--
-- Le due letture del Centro deducevano SOCIETY da `team_id is null`, perché
-- quando sono state scritte non esisteva altro. §6 e §35 vietano quella
-- deduzione: «potrebbe essere una bozza incompleta o un'anomalia. Solo un
-- ambito esplicito valido autorizza questa semantica.»
--
-- Le funzioni sono riemesse per intero, come la 20260727150000 ha fatto con
-- `fetch_home_feed_page`: `create or replace` non sa sostituire una sola
-- espressione. Rispetto alla 20261026 cambiano soltanto:
--
--   * la proiezione `position_scope`, che ora è la colonna;
--   * il filtro `society`, che seleziona `position_scope_type = 'society'`;
--   * le guardie di Team e contesto, che ora chiedono l'ambito.
--
-- Conseguenza voluta (DAS-REV-15 §30): una bozza TEAM senza squadra resta
-- TEAM e continua a mostrarsi come «Squadra da definire», invece di
-- presentarsi come un valido incarico Society-level.
-- ============================================================

create or replace function public.fetch_society_positions_page(
  p_club_id uuid,
  p_group   text default 'active',
  p_scope   text default 'all',
  p_team_id uuid default null,
  p_cursor  text default null,
  p_limit   integer default 20
)
returns table (
  position_id        uuid,
  title              text,
  role_required      text,
  target_role        text,
  status             text,
  position_scope     text,
  team_id            uuid,
  team_name          text,
  team_is_inactive   boolean,
  context_label      text,
  season_label       text,
  published_at       timestamptz,
  updated_at         timestamptz,
  closed_at          timestamptz,
  receiving_closed   boolean,
  counts_available   boolean,
  applications_total integer,
  applications_new   integer,
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
  v_uid       uuid := auth.uid();
  v_caps      text[];
  v_scope     uuid[];
  v_app_scope uuid[];
  v_app_view  boolean;
  v_group     text := coalesce(p_group, 'active');
  v_filter    text := coalesce(p_scope, 'all');
  v_limit     integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_season    text := public.current_season_id();
  v_as_of     timestamptz;
  v_after     text;
  v_now       timestamptz := timezone('utc', now());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_group not in ('active', 'drafts', 'closed') then
    raise exception 'POSITIONS_GROUP_INVALID';
  end if;

  if v_filter not in ('all', 'society', 'team') then
    raise exception 'POSITIONS_FILTER_INVALID';
  end if;

  -- §22: «Non usare un Team ID null ambiguo per significare sia Tutte sia
  -- Intera società.» Il tipo di filtro è esplicito e il Team ID vale solo
  -- per TEAM.
  if v_filter = 'team' and p_team_id is null then
    raise exception 'POSITIONS_FILTER_INVALID';
  end if;

  if v_filter <> 'team' and p_team_id is not null then
    raise exception 'POSITIONS_FILTER_INVALID';
  end if;

  if not public.owns_club(p_club_id)
     and not public.club_access_is_active(p_club_id, v_uid) then
    raise exception 'POSITIONS_CENTER_NOT_AUTHORIZED';
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  if not ('positions_view' = any (v_caps)) then
    raise exception 'POSITIONS_CENTER_NOT_AUTHORIZED';
  end if;

  v_scope     := public.dashboard_club_capability_scope(p_club_id, 'positions_view');
  v_app_view  := 'applications_view' = any (v_caps);
  v_app_scope := case when v_app_view
    then public.dashboard_club_capability_scope(p_club_id, 'applications_view')
  end;

  -- §15: «Una selezione arbitraria passata tramite query/deep link non va
  -- accettata o convertita silenziosamente in un accesso più ampio.» Un
  -- filtro fuori perimetro non diventa "tutte": diventa un errore.
  if v_filter = 'society' and v_scope is not null then
    raise exception 'POSITIONS_FILTER_NOT_AUTHORIZED';
  end if;

  if v_filter = 'team'
     and not (
       v_scope is null
       or p_team_id = any (v_scope)
     ) then
    raise exception 'POSITIONS_FILTER_NOT_AUTHORIZED';
  end if;

  if v_filter = 'team'
     and not exists (
       select 1 from public.club_teams ct
       where ct.id = p_team_id and ct.club_id = p_club_id
     ) then
    raise exception 'POSITIONS_FILTER_NOT_AUTHORIZED';
  end if;

  if p_cursor is null then
    v_as_of := v_now;
    v_after := null;
  else
    select d.as_of, d.sort_key
      into v_as_of, v_after
    from public.society_positions_cursor_decode(
      p_cursor, p_club_id, v_group, v_filter, p_team_id
    ) d;
  end if;

  return query
  with rows_in_scope as (
    select
      ra.id,
      nullif(btrim(ra.title), '')        as title,
      ra.role_required::text             as role_required,
      ra.target_role::text               as target_role,
      ra.status,
      ra.team_id,
      ra.position_scope_type,
      ra.published_at,
      ra.updated_at,
      ra.closed_at,
      ra.application_deadline_at,
      ct.name                            as team_name,
      coalesce(ct.is_archived, false)    as team_is_inactive,
      /* Contesto corrente: tipo e livello della stagione in corso. */
      cur_lvl.label                      as current_level_label,
      coalesce(cur_type.tier, ct.team_type) as current_tier,
      /* Contesto storico: la fotografia della prima pubblicazione. */
      snap_lvl.label                     as snapshot_level_label,
      snap_type.tier                     as snapshot_tier,
      ra.published_team_name             as snapshot_team_name,
      snap_season.label                  as snapshot_season_label,
      /* §9: l'aggregato è leggibile solo con `applications_view` nel
         perimetro di **questa** riga. Nessuna eccezione permissiva nel
         serializer del Centro. */
      (
        v_app_view
        and (
          v_app_scope is null
          or (ra.team_id is not null and ra.team_id = any (v_app_scope))
        )
      ) as counts_available
    from public.recruiting_ads ra
    left join public.club_teams ct
      on ct.id = ra.team_id
    left join public.club_team_seasons cur_cfg
      on cur_cfg.team_id = ct.id
     and cur_cfg.season_id = v_season
    left join public.team_levels cur_lvl on cur_lvl.id = cur_cfg.level_id
    left join public.team_types  cur_type on cur_type.id = cur_cfg.team_type_id
    left join public.team_levels snap_lvl on snap_lvl.id = ra.published_level_id
    left join public.team_types  snap_type on snap_type.id = ra.published_team_type_id
    left join public.seasons     snap_season on snap_season.id = ra.published_season_id
    where ra.club_id = p_club_id
      and public.society_position_group(ra.status) = v_group
      /* Istante congelato: l'appartenenza di una riga alla consultazione non
         cambia mentre si scorre. */
      and ra.created_at <= v_as_of
      /* Scope della capability, applicato **prima** di aggregare, ordinare e
         paginare (§9). */
      and (v_scope is null or (ra.team_id is not null and ra.team_id = any (v_scope)))
      /* Filtro di consultazione, che restringe e non amplia. */
      and (
        v_filter = 'all'
        or (v_filter = 'society' and ra.position_scope_type = 'society')
        or (v_filter = 'team'    and ra.team_id = p_team_id)
      )
  ),
  with_counts as (
    select
      r.*,
      case when r.counts_available then (
        select count(*)::integer
        from public.recruiting_applications app
        where app.ad_id = r.id
          and app.status <> 'withdrawn'
          and app.created_at <= v_as_of
      ) end as applications_total,
      case when r.counts_available then (
        select count(*)::integer
        from public.recruiting_applications app
        where app.ad_id = r.id
          and app.status = 'submitted'
          and app.created_at <= v_as_of
      ) end as applications_new
    from rows_in_scope r
  ),
  keyed as (
    select
      w.*,
      case v_group
        when 'active' then
          (case when coalesce(w.applications_new, 0) > 0 then '0' else '1' end)
          || '|' || lpad((9999999999999
               - coalesce((extract(epoch from w.published_at) * 1000)::bigint, 0))::text, 13, '0')
          || '|' || w.id::text
        when 'drafts' then
          lpad((9999999999999
               - (extract(epoch from w.updated_at) * 1000)::bigint)::text, 13, '0')
          || '|' || w.id::text
        else
          (case when w.closed_at is null then '1' else '0' end)
          || '|' || lpad((9999999999999
               - coalesce((extract(epoch from w.closed_at) * 1000)::bigint, 0))::text, 13, '0')
          || '|' || w.id::text
      end as sort_key
    from with_counts w
  )
  select
    k.id,
    k.title,
    k.role_required,
    k.target_role,
    k.status::text,
    k.position_scope_type,
    k.team_id,
    /* §13: sulle righe storiche il nome è quello conservato, quando esiste.
       Una rinomina corrente non riscrive il significato storico. */
    case
      when k.position_scope_type = 'society' then null
      when v_group = 'closed' then coalesce(k.snapshot_team_name, k.team_name)
      else k.team_name
    end,
    k.team_is_inactive,
    case
      when k.position_scope_type = 'society' then null
      when v_group = 'closed' then
        coalesce(
          k.snapshot_level_label,
          case when k.snapshot_tier = 'youth' then 'Settore giovanile' end
        )
      else
        coalesce(
          k.current_level_label,
          case when k.current_tier = 'youth' then 'Settore giovanile' end
        )
    end,
    /* La stagione compare solo dove è un dato storico reale. */
    case when v_group = 'closed' then k.snapshot_season_label end,
    k.published_at,
    k.updated_at,
    k.closed_at,
    /* §17: ricezione, non lifecycle. Una PUBLISHED scaduta resta Attiva. */
    (k.status = 'published'
      and k.application_deadline_at is not null
      and v_now >= k.application_deadline_at),
    k.counts_available,
    k.applications_total,
    k.applications_new,
    k.sort_key,
    public.society_positions_cursor_encode(
      p_club_id, v_group, v_filter, p_team_id, v_as_of, k.sort_key
    ),
    v_as_of
  from keyed k
  where v_after is null or k.sort_key > v_after
  order by k.sort_key
  limit v_limit;
end;
$$;

create or replace function public.fetch_society_position_detail(p_ad_id uuid)
returns table (
  position_id        uuid,
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  club_is_verified   boolean,
  title              text,
  description        text,
  role_required      text,
  target_role        text,
  status             text,
  group_key          text,
  position_scope     text,
  team_id            uuid,
  team_name          text,
  team_is_inactive   boolean,
  context_label      text,
  season_label       text,
  region             text,
  age_min            integer,
  age_max            integer,
  compensation_summary text,
  published_at       timestamptz,
  updated_at         timestamptz,
  closed_at          timestamptz,
  deadline_at        timestamptz,
  deadline_timezone  text,
  receiving_closed   boolean,
  counts_available   boolean,
  applications_total integer,
  applications_new   integer,
  can_edit           boolean,
  can_publish        boolean,
  can_close          boolean,
  access_verified_at timestamptz,
  data_revision      bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_club    uuid;
  v_team    uuid;
  v_status  public.ad_status;
  v_caps    text[];
  v_manage  boolean;
  v_group   text;
  v_season  text := public.current_season_id();
  v_now     timestamptz := timezone('utc', now());
  v_app_ok  boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select ra.club_id, ra.team_id, ra.status
    into v_club, v_team, v_status
  from public.recruiting_ads ra
  where ra.id = p_ad_id;

  -- §18: «Non rivelare l'esistenza di una Position di altra Society tramite
  -- messaggi diversi non necessari.» Inesistente e non autorizzata producono
  -- lo stesso esito.
  if v_club is null then
    raise exception 'POSITION_NOT_AVAILABLE';
  end if;

  if not public.owns_club(v_club)
     and not public.club_access_is_active(v_club, v_uid) then
    raise exception 'POSITION_NOT_AVAILABLE';
  end if;

  v_caps := public.dashboard_club_capabilities(v_club);

  if not ('positions_view' = any (v_caps))
     or not public.society_position_in_scope(v_club, v_team, 'positions_view') then
    raise exception 'POSITION_NOT_AVAILABLE';
  end if;

  v_group  := public.society_position_group(v_status);
  v_manage := public.society_position_in_scope(v_club, v_team, 'positions_create')
           or public.society_position_in_scope(v_club, v_team, 'society_manage_positions');
  v_app_ok := ('applications_view' = any (v_caps))
           and public.society_position_in_scope(v_club, v_team, 'applications_view');

  return query
  select
    ra.id,
    ra.club_id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    nullif(btrim(ra.title), ''),
    nullif(btrim(ra.description), ''),
    ra.role_required::text,
    ra.target_role::text,
    ra.status::text,
    v_group,
    ra.position_scope_type,
    ra.team_id,
    case
      when ra.position_scope_type = 'society' then null
      when v_group = 'closed' then coalesce(ra.published_team_name, ct.name)
      else ct.name
    end,
    coalesce(ct.is_archived, false),
    case
      when ra.position_scope_type = 'society' then null
      when v_group = 'closed' then
        coalesce(snap_lvl.label,
          case when snap_type.tier = 'youth' then 'Settore giovanile' end)
      else
        coalesce(cur_lvl.label,
          case when coalesce(cur_type.tier, ct.team_type) = 'youth'
            then 'Settore giovanile' end)
    end,
    case when v_group = 'closed' then snap_season.label end,
    ra.region,
    ra.age_min,
    ra.age_max,
    nullif(btrim(ra.compensation_summary), ''),
    ra.published_at,
    ra.updated_at,
    ra.closed_at,
    ra.application_deadline_at,
    ra.application_deadline_timezone,
    (ra.status = 'published'
      and ra.application_deadline_at is not null
      and v_now >= ra.application_deadline_at),
    v_app_ok,
    case when v_app_ok then (
      select count(*)::integer
      from public.recruiting_applications app
      where app.ad_id = ra.id and app.status <> 'withdrawn'
    ) end,
    case when v_app_ok then (
      select count(*)::integer
      from public.recruiting_applications app
      where app.ad_id = ra.id and app.status = 'submitted'
    ) end,
    /* §13: «Una Position CLOSED non espone modifica, riapertura,
       duplicazione o eliminazione in V1.» */
    v_manage and v_status <> 'closed',
    /* §12: Pubblica compare soltanto se la bozza è valida e la deadline
       salvata non è già passata. La validità di contenuto resta del
       composer; qui si risolvono permesso, stato e scadenza. */
    v_manage
      and v_status = 'draft'
      and nullif(btrim(ra.title), '') is not null
      and (ra.application_deadline_at is null or v_now < ra.application_deadline_at),
    v_manage and v_status = 'published',
    v_now,
    (extract(epoch from ra.updated_at) * 1000)::bigint
  from public.recruiting_ads ra
  join public.clubs c on c.id = ra.club_id
  left join public.club_teams ct on ct.id = ra.team_id
  left join public.club_team_seasons cur_cfg
    on cur_cfg.team_id = ct.id and cur_cfg.season_id = v_season
  left join public.team_levels cur_lvl  on cur_lvl.id = cur_cfg.level_id
  left join public.team_types  cur_type on cur_type.id = cur_cfg.team_type_id
  left join public.team_levels snap_lvl  on snap_lvl.id = ra.published_level_id
  left join public.team_types  snap_type on snap_type.id = ra.published_team_type_id
  left join public.seasons     snap_season on snap_season.id = ra.published_season_id
  where ra.id = p_ad_id;
end;
$$;


revoke all on function public.fetch_society_positions_page(uuid, text, text, uuid, text, integer) from public;
grant execute on function public.fetch_society_positions_page(uuid, text, text, uuid, text, integer) to authenticated;

revoke all on function public.fetch_society_position_detail(uuid) from public;
grant execute on function public.fetch_society_position_detail(uuid) to authenticated;
