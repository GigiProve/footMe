-- DAS-REV-30 — Eventi: inviti e partecipanti
--
-- DAS-REV-29 ha creato la partecipazione canonica (una riga per persona ed
-- evento, storico append-only) con i soli stati della richiesta spontanea.
-- Lo spec della 30 chiede di **estenderla**, non di affiancarle un dominio
-- inviti (§4: «Non creare InvitationParticipation separata da
-- EventParticipation»). Corrispondenza dei nomi: EventParticipation dello
-- spec = `selection_event_participations`; person_id = `person_id`.
--
-- Cosa mancava, e cosa introduce:
--
--   1. **quattro stati nuovi** (§9): INVITED, DECLINED, REVOKED, REMOVED, con
--      i campi correnti dell'ultimo intento (invited_at/by, messaggio,
--      generazione, declined_at, revoked_at/by, removed_at/by, messaggio di
--      rimozione) e la provenienza della conferma (automatica, manuale,
--      invito). La provenienza la deriva un trigger dalla transizione, così
--      i comandi della 29 non vanno riemessi: pending→confirmed è solo la
--      conferma manuale, invited→confirmed solo l'accettazione, ogni altro
--      ingresso in confirmed l'iscrizione automatica;
--   2. la **generazione dell'invito** (§20): ogni invito o reinvito la
--      incrementa sulla stessa riga. Accetta, rifiuta e revoca la ricevono
--      insieme alla versione vista, quindi un comando partito da una vecchia
--      schermata non tocca la generazione successiva (QA-077, QA-078);
--   3. lo **storico** guadagna generazione, snapshot protetto del messaggio
--      e batch: i messaggi precedenti restano lì, i campi correnti
--      rappresentano solo l'ultimo intento (§9);
--   4. **tre capability separate** (§12): leggere partecipanti
--      (`selection_events_participants_view`, nuova), invitare profili
--      (`selection_events_invite`, nuova), gestire partecipanti
--      (`selection_events_manage`, la stessa che la 29 usa per decidere sulle
--      richieste). Nessun backfill: §12 — «un aggiornamento del catalogo non
--      concede nuove permission automaticamente ai ruoli esistenti». Gestire
--      implica leggere (non si gestisce ciò che non si vede); invitare non
--      implica leggere (§8, QA-003);
--   5. i comandi `send / accept / decline / revoke / remove` con lo stesso
--      confine di concorrenza della 29: lock sulla riga dell'evento, poi
--      sulla partecipazione. Accettazione, iscrizione automatica, conferma
--      manuale e modifica del limite passano tutte da
--      `selection_event_capacity_allows_confirmation` sotto quel lock (§11:
--      «Mai 51/50»);
--   6. le letture: centro partecipanti filtrato e paginato, sorgenti
--      Shortlist autorizzate, ricerca candidati, eventi invitabili per una
--      persona, stato della micro-CTA sul profilo;
--   7. tre notifiche private (invito ricevuto, invito ritirato, partecipazione
--      annullata) scritte nella transazione del comando e deduplicate per
--      partecipazione + versione.
--
-- Scelte che lo spec lascia aperte, dichiarate qui:
--
--   · **eleggibilità del destinatario** (§13): «profili professionali reali
--     ed eleggibili». Decisione di prodotto del 2026-11-08: gli inviti valgono
--     per Calciatori, Allenatori e Staff tecnico con il rispettivo profilo
--     sportivo (`selection_event_invitee_ineligibility`). L'iscrizione
--     spontanea resta quella della 29 (solo Calciatori): un Allenatore
--     invitato accetta o rifiuta, ma non si iscrive da solo né dopo un
--     rifiuto o una revoca. Ruolo e anni dell'evento **non** bloccano
--     l'invito (§13);
--   · **revoca e rimozione** sono gestione partecipanti → `manage`;
--   · **push**: il progetto non ha provider push né outbox separato. La riga
--     di `notifications` è l'outbox: nasce nella transazione del comando, un
--     rollback la annulla, un retry con la stessa chiave non arriva al punto
--     di scrittura, e l'indice univoco la protegge comunque (§28);
--   · **rate limit** (§27): riuso `assert_agent_rate_limit` (20261002160000),
--     l'unico limitatore del progetto, con azioni proprie. Errore generico
--     `RATE_LIMIT`, distinto da «posti esauriti»;
--   · **batch**: tetto tecnico centralizzato in `selection_event_limits()`
--     (`invitationBatch` = 50). Non è una regola di posti: un batch può
--     superare i posti liberi (§11, QA-019).
--
-- Funzioni riemesse, ciascuna dalla **definizione più recente** (playbook:
-- «funzioni ricreate dal file sbagliato»):
--   selection_event_limits, selection_event_participation_log,
--   selection_event_personal_state, fetch_selection_event_detail,
--   register_for_selection_event, notifications_before_insert
--                                            ← 20261109090000_selection_event_participation.sql
--   dashboard_club_capabilities, selection_event_can_operate
--                                            ← 20261108090000_selection_events.sql
--
-- Idempotenza: `if not exists`, `create or replace`, `drop ... if exists`,
-- `on conflict`.


-- ============================================================
-- SEZIONE 1 — stati e campi nuovi sulla partecipazione (§9)
-- ============================================================

alter table public.selection_event_participations
  drop constraint if exists selection_event_participations_status_check;

alter table public.selection_event_participations
  add constraint selection_event_participations_status_check
  check (status in ('pending', 'confirmed', 'rejected', 'withdrawn',
                    'invited', 'declined', 'revoked', 'removed'));

alter table public.selection_event_participations
  add column if not exists invited_at            timestamptz,
  add column if not exists invited_by            uuid references public.profiles(id),
  add column if not exists invitation_message    text,
  add column if not exists invitation_generation integer not null default 0,
  add column if not exists declined_at           timestamptz,
  add column if not exists revoked_at            timestamptz,
  add column if not exists revoked_by            uuid references public.profiles(id),
  add column if not exists removed_at            timestamptz,
  add column if not exists removed_by            uuid references public.profiles(id),
  add column if not exists removal_message       text,
  add column if not exists confirmation_source   text;

alter table public.selection_event_participations
  drop constraint if exists selection_event_participations_invitation_message_len,
  drop constraint if exists selection_event_participations_removal_message_len,
  drop constraint if exists selection_event_participations_generation_nonneg,
  drop constraint if exists selection_event_participations_confirmation_source_check,
  drop constraint if exists selection_event_participations_invited_fields,
  drop constraint if exists selection_event_participations_declined_fields,
  drop constraint if exists selection_event_participations_revoked_fields,
  drop constraint if exists selection_event_participations_removed_fields;

alter table public.selection_event_participations
  add constraint selection_event_participations_invitation_message_len
    check (invitation_message is null or char_length(invitation_message) <= 500),
  add constraint selection_event_participations_removal_message_len
    check (removal_message is null or char_length(removal_message) <= 500),
  add constraint selection_event_participations_generation_nonneg
    check (invitation_generation >= 0),
  add constraint selection_event_participations_confirmation_source_check
    check (confirmation_source is null
           or confirmation_source in ('automatic', 'manual', 'invitation')),
  add constraint selection_event_participations_invited_fields
    check (status <> 'invited'
           or (invited_at is not null and invited_by is not null and invitation_generation >= 1)),
  add constraint selection_event_participations_declined_fields
    check (status <> 'declined' or declined_at is not null),
  add constraint selection_event_participations_revoked_fields
    check (status <> 'revoked' or (revoked_at is not null and revoked_by is not null)),
  add constraint selection_event_participations_removed_fields
    check (status <> 'removed' or (removed_at is not null and removed_by is not null));

/* §21: ordini per filtro. INVITED invited_at DESC, Tutti updated_at DESC. */
create index if not exists selection_event_participations_event_invited_idx
  on public.selection_event_participations (event_id, status, invited_at desc, id);
create index if not exists selection_event_participations_event_updated_idx
  on public.selection_event_participations (event_id, updated_at desc, id);

/**
 * Provenienza della conferma (§9: «automatica, approvazione manuale, invito
 * diretto accettato; non creare lifecycle separati»), derivata dalla
 * transizione e non dichiarata dai comandi:
 *
 *   pending  → confirmed  = conferma manuale della 29 (unico comando);
 *   invited  → confirmed  = accettazione dell'invito (unico comando);
 *   altro    → confirmed  = iscrizione con conferma automatica.
 *
 * Fuori da CONFIRMED il campo è vuoto: è un campo **corrente** (§9), la
 * storia sta nello storico. Gira prima di `_touch` (ordine alfabetico dei
 * trigger BEFORE), così la versione avanza una volta sola.
 */
create or replace function public.selection_event_participations_derive()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'confirmed' then
    if tg_op = 'INSERT' or old.status is distinct from 'confirmed' then
      new.confirmation_source := case
        when tg_op = 'UPDATE' and old.status = 'pending' then 'manual'
        when tg_op = 'UPDATE' and old.status = 'invited' then 'invitation'
        else 'automatic'
      end;
    end if;
  else
    new.confirmation_source := null;
  end if;

  /* §20: la generazione è monotona. Nessun comando la fa tornare indietro. */
  if tg_op = 'UPDATE' and new.invitation_generation < old.invitation_generation then
    raise exception 'SELECTION_EVENT_PARTICIPATION_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke execute on function public.selection_event_participations_derive() from public, anon, authenticated;

drop trigger if exists selection_event_participations_derive on public.selection_event_participations;
create trigger selection_event_participations_derive
  before insert or update on public.selection_event_participations
  for each row execute function public.selection_event_participations_derive();

/* Backfill della provenienza per le conferme esistenti, dallo storico. Le
   righe senza traccia nello storico restano «automatic» solo se lo storico
   ha AUTO_CONFIRMED; altrimenti «manual» se ha MANUALLY_CONFIRMED. Una riga
   confermata senza nessuna delle due non può esistere con i comandi della
   29: se esistesse, resterebbe null e verrebbe segnalata dal CHECK sotto,
   che per questo nasce `not valid` (§30: «documenta gli ambigui»). La
   versione non avanza: è una correzione di schema, non un'azione. */
alter table public.selection_event_participations disable trigger selection_event_participations_touch;

update public.selection_event_participations p
set confirmation_source = (
  select case h.transition when 'MANUALLY_CONFIRMED' then 'manual' else 'automatic' end
  from public.selection_event_participation_history h
  where h.participation_id = p.id
    and h.transition in ('AUTO_CONFIRMED', 'MANUALLY_CONFIRMED')
  order by h.created_at desc, h.id desc
  limit 1
)
where p.status = 'confirmed' and p.confirmation_source is null;

alter table public.selection_event_participations enable trigger selection_event_participations_touch;

alter table public.selection_event_participations
  drop constraint if exists selection_event_participations_confirmed_source;
alter table public.selection_event_participations
  add constraint selection_event_participations_confirmed_source
  check (status <> 'confirmed' or confirmation_source is not null) not valid;

-- Storico: transizioni nuove, generazione, snapshot del messaggio, batch.

alter table public.selection_event_participation_history
  drop constraint if exists selection_event_participation_history_transition_check;

alter table public.selection_event_participation_history
  add constraint selection_event_participation_history_transition_check
  check (transition in (
    'SUBMITTED', 'AUTO_CONFIRMED', 'MANUALLY_CONFIRMED',
    'REJECTED', 'WITHDRAWN', 'RESUBMITTED',
    'INVITATION_SENT', 'INVITATION_RE_SENT', 'INVITATION_ACCEPTED',
    'INVITATION_DECLINED', 'INVITATION_REVOKED', 'PARTICIPANT_REMOVED'));

alter table public.selection_event_participation_history
  add column if not exists generation       integer,
  add column if not exists message_snapshot text,
  add column if not exists batch_id         uuid;

/* Riemessa da 20261109090000: ora registra anche la generazione corrente. */
create or replace function public.selection_event_participation_log(
  p_row        public.selection_event_participations,
  p_transition text,
  p_from       text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.selection_event_participation_history
    (participation_id, event_id, person_id, transition, from_status, to_status,
     actor_id, version, generation)
  values
    (p_row.id, p_row.event_id, p_row.person_id, p_transition, p_from, p_row.status,
     auth.uid(), p_row.version, p_row.invitation_generation);
$$;

revoke all on function public.selection_event_participation_log(public.selection_event_participations, text, text) from public;
revoke execute on function public.selection_event_participation_log(public.selection_event_participations, text, text) from anon, authenticated;

/** Variante con snapshot protetto del messaggio e batch (§9, §20, §28). */
create or replace function public.selection_event_participation_log_message(
  p_row        public.selection_event_participations,
  p_transition text,
  p_from       text,
  p_message    text,
  p_batch_id   uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.selection_event_participation_history
    (participation_id, event_id, person_id, transition, from_status, to_status,
     actor_id, version, generation, message_snapshot, batch_id)
  values
    (p_row.id, p_row.event_id, p_row.person_id, p_transition, p_from, p_row.status,
     auth.uid(), p_row.version, p_row.invitation_generation, p_message, p_batch_id);
$$;

revoke all on function public.selection_event_participation_log_message(public.selection_event_participations, text, text, text, uuid) from public;
revoke execute on function public.selection_event_participation_log_message(public.selection_event_participations, text, text, text, uuid) from anon, authenticated;

/**
 * Inviti pendenti (§8). Funzione a parte e non una colonna OUT in più di
 * `selection_event_participation_counts`: cambiare le OUT costringerebbe a
 * droppare la funzione su cui Centro, editor e capienza si appoggiano. Gli
 * inviti **non** entrano nei pending del Centro della 28 (QA-127).
 */
create or replace function public.selection_event_invited_count(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.selection_event_participations p
  where p.event_id = p_event_id and p.status = 'invited';
$$;

revoke all on function public.selection_event_invited_count(uuid) from public;
revoke execute on function public.selection_event_invited_count(uuid) from anon, authenticated;


-- ============================================================
-- SEZIONE 2 — limiti condivisi (§15)
-- ============================================================

/* Da 20261109090000 con due chiavi nuove in coda: messaggio dell'invito
   (stesso limite della non accettazione, §15: «limite breve centralizzato
   della 29») e tetto tecnico del batch (§11). */
create or replace function public.selection_event_limits()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'title',          120,
    'venueName',      120,
    'venueAddress',   200,
    'description',    2000,
    'requirements',   1000,
    'birthYearMin',   1900,
    /* §16: «non date future». L'anno corrente è l'ultimo ammesso. */
    'birthYearMax',   extract(year from timezone('utc', now()))::int,
    'maxParticipants', 10000,
    /* DAS-REV-29 §8 — stesso valore di `storage.buckets.file_size_limit`. */
    'flyerMaxBytes',  8388608,
    'flyerMimeTypes', jsonb_build_array('image/jpeg', 'image/png', 'image/webp'),
    /* DAS-REV-29 §18 — messaggio facoltativo della non accettazione. */
    'decisionMessage', 500,
    /* DAS-REV-30 §15, §25 — messaggio dell'invito e della rimozione. */
    'invitationMessage', 500,
    /* DAS-REV-30 §11 — tetto tecnico del batch, non una regola di posti. */
    'invitationBatch', 50
  );
$$;

revoke all on function public.selection_event_limits() from public;
revoke execute on function public.selection_event_limits() from anon;
grant execute on function public.selection_event_limits() to authenticated;


-- ============================================================
-- SEZIONE 3 — catalogo permessi (§12)
--
-- Due chiavi nuove nell'area `selection_events` (scope team). Nessun
-- backfill: i controlli nascono non concessi; l'Owner li ha per costruzione.
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
    'selection_events_invite'
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
    'selection_events_invite'
  ));

insert into public.club_permission_controls
  (id, area_id, label, helper, bundle, requires, sort_order, is_available) values
  ('selection_events_participants', 'selection_events', 'Visualizza partecipanti agli eventi',
     'Necessario per visualizzare gli eventi',
     'view',   array['selection_events_read'], 4, true),
  ('selection_events_invite_profiles', 'selection_events', 'Invita profili agli eventi',
     'Necessario per visualizzare gli eventi',
     'manage', array['selection_events_read'], 5, true)
on conflict (id) do update
  set area_id      = excluded.area_id,
      label        = excluded.label,
      helper       = excluded.helper,
      bundle       = excluded.bundle,
      requires     = excluded.requires,
      sort_order   = excluded.sort_order,
      is_available = excluded.is_available;

insert into public.club_permission_control_keys (control_id, permission_key) values
  ('selection_events_participants',    'selection_events_participants_view'),
  ('selection_events_invite_profiles', 'selection_events_invite')
on conflict do nothing;

insert into public.app_policy_settings (key, value, description)
values (
  'admin_permission_catalog_revision',
  to_jsonb(5),
  'DAS-REV-14 §7 — revisione della tassonomia aree/controlli/chiavi. Va '
  'incrementata da ogni migrazione che cambia il catalogo.'
)
on conflict (key) do update set value = to_jsonb(5);

/* Riscritta da 20261108090000_selection_events.sql (ultima definizione) con
   le due chiavi nuove in entrambe le whitelist. Nessun'altra differenza. */
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
      'selection_events_invite'
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
            'selection_events_invite'
          )
      ),
      array[]::text[]
    )
  end;
$$;

revoke all on function public.dashboard_club_capabilities(uuid) from public;
grant execute on function public.dashboard_club_capabilities(uuid) to authenticated;

/**
 * Riscritta da 20261108090000_selection_events.sql (ultima definizione) con
 * due azioni nuove, in coda alla mappa e marcate DAS-REV-30:
 *
 *   participants → selection_events_participants_view o selection_events_manage
 *                  (gestire implica leggere; invitare no — §8, QA-003)
 *   invite       → selection_events_invite
 */
create or replace function public.selection_event_can_operate(
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
  v_keys  text[];
  v_caps  text[];
  v_scope uuid[];
  v_key   text;
begin
  if p_club_id is null or p_team_id is null or auth.uid() is null then
    return false;
  end if;

  if not exists (
    select 1 from public.club_teams ct
    where ct.id = p_team_id and ct.club_id = p_club_id
  ) then
    return false;
  end if;

  if public.owns_club(p_club_id) then
    return true;
  end if;

  if not public.club_access_is_active(p_club_id, auth.uid()) then
    return false;
  end if;

  v_keys := case p_action
    when 'view'    then array['selection_events_view']
    when 'create'  then array['selection_events_create']
    when 'publish' then array['selection_events_create']
    when 'edit'    then array['selection_events_create', 'selection_events_manage']
    when 'manage'  then array['selection_events_manage']
    /* DAS-REV-30 §12 */
    when 'participants' then array['selection_events_participants_view', 'selection_events_manage']
    when 'invite'       then array['selection_events_invite']
    else array[]::text[]
  end;

  if array_length(v_keys, 1) is null then
    return false;
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  foreach v_key in array v_keys loop
    if v_key = any (v_caps) then
      v_scope := public.dashboard_club_capability_scope(p_club_id, v_key);

      if v_scope is null or p_team_id = any (v_scope) then
        return true;
      end if;
    end if;
  end loop;

  return false;
end;
$$;

revoke all on function public.selection_event_can_operate(uuid, uuid, text) from public;
grant execute on function public.selection_event_can_operate(uuid, uuid, text) to authenticated;

/**
 * L'actor ha la chiave su **almeno** una squadra della Società (§17: la
 * micro-CTA sul profilo). Non autorizza nessun comando: ogni comando
 * verifica la squadra dell'evento concreto.
 */
create or replace function public.selection_event_key_in_any_scope(
  p_club_id uuid,
  p_key     text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_club_id is not null and auth.uid() is not null and (
    public.owns_club(p_club_id)
    or (
      public.club_access_is_active(p_club_id, auth.uid())
      and p_key = any (public.dashboard_club_capabilities(p_club_id))
    )
  );
$$;

revoke all on function public.selection_event_key_in_any_scope(uuid, text) from public;
revoke execute on function public.selection_event_key_in_any_scope(uuid, text) from anon, authenticated;


-- ============================================================
-- SEZIONE 4 — notifiche private (§18, §24, §25, §28)
-- ============================================================

create unique index if not exists notifications_selection_event_invitation_uniq
  on public.notifications (
    recipient_profile_id,
    (data ->> 'participation_id'),
    (data ->> 'participation_version')
  )
  where type in ('selection_event_invitation_received',
                 'selection_event_invitation_revoked',
                 'selection_event_participation_removed');

/**
 * Testo standard: nessun messaggio facoltativo nel corpo, che finirebbe in
 * lock screen (§18, §25). Il tap apre il dettaglio dell'evento, che rilegge
 * lo stato corrente: una notifica vecchia non esegue nulla (§20).
 */
create or replace function public.notify_selection_event_invitation(
  p_participation public.selection_event_participations
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.selection_events;
  v_club  text;
  v_title text;
begin
  if p_participation.status not in ('invited', 'revoked', 'removed') then
    return;
  end if;

  select * into v_event from public.selection_events e where e.id = p_participation.event_id;
  select c.name into v_club from public.clubs c where c.id = v_event.club_id;
  v_club  := coalesce(nullif(btrim(v_club), ''), 'La Società');
  v_title := coalesce(nullif(btrim(v_event.title), ''), 'un evento');

  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    p_participation.person_id,
    case p_participation.status
      when 'invited' then 'selection_event_invitation_received'
      when 'revoked' then 'selection_event_invitation_revoked'
      else 'selection_event_participation_removed'
    end,
    case p_participation.status
      when 'invited' then 'Invito a un evento'
      when 'revoked' then 'Invito ritirato'
      else 'Partecipazione annullata'
    end,
    case p_participation.status
      when 'invited' then v_club || ' ti ha invitato a ' || v_title || '.'
      when 'revoked' then v_club || ' ha ritirato l''invito a ' || v_title || '.'
      else v_club || ' ha annullato la tua partecipazione a ' || v_title || '.'
    end,
    jsonb_build_object(
      'event_id',              v_event.id,
      'participation_id',      p_participation.id,
      'participation_version', p_participation.version)
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.notify_selection_event_invitation(public.selection_event_participations) from public;
revoke execute on function public.notify_selection_event_invitation(public.selection_event_participations) from anon, authenticated;

/* Da 20261109090000_selection_event_participation.sql con i tre tipi nuovi
   in entrambe le scale, accanto a quelli della 29: categoria `candidature`,
   preferenza `applications`. */
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
    when 'selection_event_participation_confirmed'  then 'candidature'
    when 'selection_event_participation_rejected'   then 'candidature'
    when 'selection_event_invitation_received'      then 'candidature'
    when 'selection_event_invitation_revoked'       then 'candidature'
    when 'selection_event_participation_removed'    then 'candidature'
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
    when 'selection_event_participation_confirmed'  then 'applications'
    when 'selection_event_participation_rejected'   then 'applications'
    when 'selection_event_invitation_received'      then 'applications'
    when 'selection_event_invitation_revoked'       then 'applications'
    when 'selection_event_participation_removed'    then 'applications'
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
-- SEZIONE 5 — stato personale e dettaglio (§18, §19, §21)
-- ============================================================

/**
 * Motivo per cui la persona **non** può ricevere o accettare un invito, o
 * null (§13). Gemella di `selection_event_person_ineligibility` della 29,
 * che resta la regola dell'iscrizione spontanea: stessi esclusi (owner,
 * blocco con l'owner), ruoli più larghi. Ogni ruolo vale solo con il suo
 * profilo sportivo: un account senza onboarding non è un professionista.
 */
create or replace function public.selection_event_invitee_ineligibility(
  p_event public.selection_events,
  p_uid   uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role  text;
  v_owner uuid;
begin
  select pr.role::text into v_role from public.profiles pr where pr.id = p_uid;

  if v_role is null then
    return 'no_profile';
  end if;

  if not (
    (v_role = 'player' and exists (select 1 from public.player_profiles pp where pp.profile_id = p_uid))
    or (v_role = 'coach' and exists (select 1 from public.coach_profiles cp where cp.profile_id = p_uid))
    or (v_role = 'staff' and exists (select 1 from public.staff_profiles sp where sp.profile_id = p_uid))
  ) then
    return 'not_sports_profile';
  end if;

  select c.owner_profile_id into v_owner from public.clubs c where c.id = p_event.club_id;

  if v_owner = p_uid then
    return 'not_sports_profile';
  end if;

  if v_owner is not null and exists (
    select 1 from public.user_blocks b
    where (b.blocker_profile_id = p_uid and b.blocked_profile_id = v_owner)
       or (b.blocker_profile_id = v_owner and b.blocked_profile_id = p_uid)
  ) then
    return 'blocked';
  end if;

  return null;
end;
$$;

revoke all on function public.selection_event_invitee_ineligibility(public.selection_events, uuid) from public;
revoke execute on function public.selection_event_invitee_ineligibility(public.selection_events, uuid) from anon, authenticated;

/**
 * Da 20261109090000 con il ramo inviti (DAS-REV-30, marcato):
 *
 *   · INVITED: `accept` se l'evento è operativo e c'è posto al momento
 *     della lettura (rivalidato al commit), `decline` finché l'evento è
 *     operativo anche a capienza piena (§18, QA-065); `accept_blocked_reason`
 *     = 'full' quando manca solo il posto;
 *   · DECLINED / REVOKED: su OPEN possono reiscriversi con le regole della
 *     29 (§19); su INVITE_ONLY no, perché la landing non esiste;
 *   · REMOVED e REJECTED: nessuna reiscrizione autonoma (§10);
 *   · il messaggio dell'invito compare solo mentre l'invito è corrente
 *     (§9: un vecchio messaggio non appare come quello dell'invito
 *     corrente); quello di rimozione solo su REMOVED.
 */
create or replace function public.selection_event_personal_state(
  p_event public.selection_events,
  p_uid   uuid,
  p_now   timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_part     public.selection_event_participations;
  v_avail    jsonb := public.selection_event_availability(p_event, p_now);
  v_reason   text := public.selection_event_person_ineligibility(p_event, p_uid);
  v_birth    date;
  v_year     integer;
  v_mismatch boolean := false;
  v_public   boolean := public.selection_event_landing_visible(p_event);
  v_can_new  boolean;
  v_withdraw boolean := false;
  v_again    boolean := false;
  v_register boolean := false;
  /* DAS-REV-30 */
  v_operational boolean;
  v_accept   boolean := false;
  v_decline  boolean := false;
  v_accept_blocked text;
begin
  select * into v_part
  from public.selection_event_participations p
  where p.event_id = p_event.id and p.person_id = p_uid;

  select pr.birth_date into v_birth from public.profiles pr where pr.id = p_uid;
  v_year := extract(year from v_birth)::int;

  /* §14: senza intervallo non c'è confronto; senza anno nel profilo non si
     inventa nulla. Lo scostamento è solo un avviso. */
  if p_event.birth_year_from is not null and v_year is not null then
    v_mismatch := v_year < p_event.birth_year_from or v_year > p_event.birth_year_to;
  end if;

  v_can_new := v_public
    and v_reason is null
    and coalesce((v_avail ->> 'can_submit_request')::boolean, false);

  v_operational := p_event.status = 'published'
    and p_event.starts_at is not null
    and p_now < p_event.starts_at;

  if v_part.id is null then
    v_register := v_can_new;
  elsif v_part.status in ('pending', 'confirmed') then
    /* §19: ritiro fino all'inizio, anche dopo il termine delle iscrizioni. */
    v_withdraw := v_operational;
  elsif v_part.status = 'withdrawn' and v_part.withdrawn_by_kind = 'person' then
    v_again := v_can_new;
  /* DAS-REV-30 §18, §19 */
  elsif v_part.status = 'invited' then
    /* §11: il rifiuto resta disponibile finché l'evento è operativo, anche
       a capienza piena o dopo un blocco sopravvenuto. */
    v_decline := v_operational;
    /* L'invito segue la regola degli inviti, non quella dell'iscrizione. */
    if v_operational and public.selection_event_invitee_ineligibility(p_event, p_uid) is null then
      if coalesce((v_avail ->> 'is_full')::boolean, false) then
        v_accept_blocked := 'full';
      else
        v_accept := true;
      end if;
    end if;
  elsif v_part.status in ('declined', 'revoked') then
    v_again := v_can_new;
  end if;

  return jsonb_build_object(
    'participation', case when v_part.id is null then null else jsonb_build_object(
      'id',             v_part.id,
      'status',         v_part.status,
      'source',         v_part.source,
      'submitted_at',   v_part.submitted_at,
      'confirmed_at',   v_part.confirmed_at,
      'rejected_at',    v_part.rejected_at,
      'withdrawn_at',   v_part.withdrawn_at,
      'withdrawn_from', v_part.withdrawn_from,
      'decision_message', case when v_part.status = 'rejected' then v_part.decision_message end,
      'version',        v_part.version,
      /* DAS-REV-30 */
      'confirmation_source', v_part.confirmation_source,
      'invitation_generation', v_part.invitation_generation,
      'invited_at',     case when v_part.status = 'invited' then v_part.invited_at end,
      'invitation_message', case when v_part.status = 'invited' then v_part.invitation_message end,
      'declined_at',    v_part.declined_at,
      'revoked_at',     v_part.revoked_at,
      'removed_at',     v_part.removed_at,
      'removal_message', case when v_part.status = 'removed' then v_part.removal_message end) end,
    'capabilities', jsonb_build_object(
      'register',       v_register,
      'withdraw',       v_withdraw,
      'register_again', v_again,
      /* DAS-REV-30 */
      'accept',         v_accept,
      'decline',        v_decline,
      'accept_blocked_reason', v_accept_blocked),
    'ineligible_reason', v_reason,
    'birth_year',        v_year,
    'birth_year_mismatch', v_mismatch
  );
end;
$$;

revoke all on function public.selection_event_personal_state(public.selection_events, uuid, timestamptz) from public;
revoke execute on function public.selection_event_personal_state(public.selection_events, uuid, timestamptz) from anon, authenticated;

/**
 * Da 20261109090000 con il riepilogo partecipanti (§8, DAS-REV-30, marcato):
 * i tre count privati esistono solo con la lettura partecipanti; invitare,
 * gestire e decidere arrivano come capability del server. `pending_requests_count`
 * della 29 segue la stessa regola di lettura (§8: «Questi count sono privati»).
 */
create or replace function public.fetch_selection_event_detail(
  p_event_id  uuid default null,
  p_public_id text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_now       timestamptz := now();
  v_event     public.selection_events;
  v_society   boolean;
  v_public    boolean;
  v_personal  boolean;
  v_result    jsonb;
  v_counts    record;
  /* DAS-REV-30 */
  v_read      boolean;
  v_manage    boolean;
  v_invite    boolean;
  v_operational boolean;
  v_full      boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_event_id is not null then
    select * into v_event from public.selection_events e where e.id = p_event_id;
  elsif p_public_id is not null and p_public_id ~ '^[A-Za-z0-9_-]{8,64}$' then
    select * into v_event from public.selection_events e where e.public_id = p_public_id;
  end if;

  if v_event.id is null then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  v_society  := public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'view');
  v_public   := public.selection_event_landing_visible(v_event);
  v_personal := exists (
    select 1 from public.selection_event_participations p
    where p.event_id = v_event.id and p.person_id = v_uid);

  if not (v_society or v_public or v_personal) then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  /* Una bozza resta della Società anche se la persona ne conosce l'ID. */
  if v_event.status = 'draft' and not v_society then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  v_result := public.selection_event_public_payload(v_event, v_now)
    || jsonb_build_object(
         'status',             v_event.status,
         'participation_mode', v_event.participation_mode,
         'club_id',            v_event.club_id,
         'team_id',            v_event.team_id,
         'landing_visible',    v_public);

  /* Il payload pubblico omette il count senza limite; il dettaglio della
     Società lo mostra comunque come numero di confermati. */
  if v_society then
    select c.confirmed_count, c.pending_requests_count into v_counts
    from public.selection_event_participation_counts(v_event.id) c;

    /* DAS-REV-30 §8, §11, §12 */
    v_read   := public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'participants');
    v_manage := public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'manage');
    v_invite := public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'invite');
    v_operational := v_event.status = 'published'
      and v_event.starts_at is not null
      and v_now < v_event.starts_at;
    v_full := v_event.max_participants is not null
      and coalesce(v_counts.confirmed_count, 0) >= v_event.max_participants;

    v_result := v_result || jsonb_build_object(
      'management', jsonb_build_object(
        'confirmed_count',        v_counts.confirmed_count,
        'pending_requests_count', case when v_event.status = 'published' and v_read
                                       then v_counts.pending_requests_count end,
        'can_edit',   v_event.status = 'published' and v_manage,
        'can_decide', v_event.status = 'published' and v_manage,
        /* §9: condivisione solo se l'evento ha una landing. Lo storico
           pubblico si condivide con wording neutro (QA-039). */
        'can_share',  v_public,
        /* DAS-REV-30 */
        'participants', case when v_read then jsonb_build_object(
                          'confirmed_count', v_counts.confirmed_count,
                          'pending_count',   v_counts.pending_requests_count,
                          'invited_count',   public.selection_event_invited_count(v_event.id))
                        end,
        'can_read_participants',   v_read,
        'can_manage_participants', v_manage and v_operational,
        'can_invite',              v_invite and v_operational and not v_full,
        'invite_blocked_reason',   case when v_invite and v_operational and v_full then 'full' end));
  else
    v_result := v_result || jsonb_build_object('management', null);
  end if;

  v_result := v_result || jsonb_build_object(
    'personal', public.selection_event_personal_state(v_event, v_uid, v_now));

  return v_result;
end;
$$;

revoke all on function public.fetch_selection_event_detail(uuid, text) from public, anon;
grant execute on function public.fetch_selection_event_detail(uuid, text) to authenticated;


-- ============================================================
-- SEZIONE 6 — iscrizione spontanea dopo un invito (§10, §19)
-- ============================================================

/**
 * Da 20261109090000 con il raccordo agli inviti (DAS-REV-30, marcato):
 *
 *   · INVITED: nessuna richiesta spontanea parallela (§18: «Non mostrare
 *     simultaneamente Iscriviti»): esito `already_invited`, non errore;
 *   · DECLINED / REVOKED: nuova richiesta spontanea con le regole della 29
 *     (QA-111, QA-112); non riattiva l'invito;
 *   · REMOVED: come REJECTED, nessuna reiscrizione autonoma (QA-114).
 *
 * In reiscrizione i campi correnti dell'invito si svuotano (§10: «source e
 * messaggi correnti vengono aggiornati secondo il nuovo intento»); la
 * generazione resta, lo storico conserva tutto.
 */
create or replace function public.register_for_selection_event(
  p_event_id        uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_now     timestamptz := now();
  v_finger  constant text := md5('register');
  v_receipt jsonb;
  v_event   public.selection_events;
  v_avail   jsonb;
  v_reason  text;
  v_part    public.selection_event_participations;
  v_from    text;
  v_target  text;
  v_resub   boolean := false;
  v_result  jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('selection_event_op:' || p_idempotency_key));
  end if;

  v_receipt := public.selection_event_operation_replay(p_idempotency_key, p_event_id, 'register', v_finger);

  if v_receipt is not null then
    /* QA-074: la ricevuta prova che il comando è già riuscito. Si restituisce
       lo stato **corrente**, che può essere cambiato nel frattempo. */
    select * into v_part
    from public.selection_event_participations p
    where p.event_id = p_event_id and p.person_id = v_uid;

    return jsonb_build_object(
      'participation_id', v_part.id,
      'status',           v_part.status,
      'version',          v_part.version,
      'outcome',          'replayed',
      'replayed',         true);
  end if;

  select * into v_event
  from public.selection_events e
  where e.id = p_event_id
  for update;

  if not found or not public.selection_event_landing_visible(v_event) then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  if v_event.status <> 'published' then
    raise exception 'SELECTION_EVENT_NOT_OPERATIONAL';
  end if;

  select * into v_part
  from public.selection_event_participations p
  where p.event_id = v_event.id and p.person_id = v_uid
  for update;

  if v_part.id is not null and v_part.status in ('pending', 'confirmed') then
    return jsonb_build_object(
      'participation_id', v_part.id,
      'status',           v_part.status,
      'version',          v_part.version,
      'outcome',          'already_registered',
      'replayed',         false);
  end if;

  /* DAS-REV-30 §18: l'invito corrente si accetta o si rifiuta. */
  if v_part.id is not null and v_part.status = 'invited' then
    return jsonb_build_object(
      'participation_id', v_part.id,
      'status',           v_part.status,
      'version',          v_part.version,
      'outcome',          'already_invited',
      'replayed',         false);
  end if;

  /* §18: REJECTED non si reiscrive con questa V1, qualunque sia il client. */
  if v_part.id is not null and v_part.status = 'rejected' then
    raise exception 'SELECTION_EVENT_REGISTRATION_REJECTED';
  end if;

  /* DAS-REV-30 §25: REMOVED non rientra autonomamente. */
  if v_part.id is not null and v_part.status = 'removed' then
    raise exception 'SELECTION_EVENT_NOT_ELIGIBLE';
  end if;

  /* §19: un ritiro non volontario non apre la reiscrizione. */
  if v_part.id is not null
     and v_part.status = 'withdrawn'
     and v_part.withdrawn_by_kind is distinct from 'person' then
    raise exception 'SELECTION_EVENT_NOT_ELIGIBLE';
  end if;

  v_avail := public.selection_event_availability(v_event, v_now);

  if not coalesce((v_avail ->> 'registration_open')::boolean, false) then
    raise exception 'SELECTION_EVENT_REGISTRATION_CLOSED';
  end if;

  v_reason := public.selection_event_person_ineligibility(v_event, v_uid);

  if v_reason is not null then
    raise exception 'SELECTION_EVENT_NOT_ELIGIBLE:%', v_reason;
  end if;

  /* La modalità è quella canonica dell'evento (QA-077): il client non la
     invia. */
  if v_event.registration_confirmation_mode = 'automatic' then
    /* Lock già preso sopra; la funzione lo riprende senza attese. */
    if not public.selection_event_capacity_allows_confirmation(v_event.id) then
      raise exception 'SELECTION_EVENT_FULL';
    end if;

    v_target := 'confirmed';
  else
    v_target := 'pending';
  end if;

  if v_part.id is null then
    insert into public.selection_event_participations
      (event_id, person_id, status, source, submitted_at, confirmed_at)
    values
      (v_event.id, v_uid, v_target, 'registration', v_now,
       case when v_target = 'confirmed' then v_now end)
    returning * into v_part;

    perform public.selection_event_participation_log(v_part, 'SUBMITTED', null);
  else
    v_from  := v_part.status;
    v_resub := true;

    /* §19: stessa relazione, nuovo intento. Nessun messaggio o decisione
       precedente torna come corrente. */
    update public.selection_event_participations p
    set status            = v_target,
        source            = 'registration',
        submitted_at      = v_now,
        confirmed_at      = case when v_target = 'confirmed' then v_now end,
        rejected_at       = null,
        withdrawn_at      = null,
        withdrawn_from    = null,
        withdrawn_by_kind = null,
        decision_by       = null,
        decision_message  = null,
        /* DAS-REV-30 §10: i campi correnti dell'invito non sopravvivono al
           nuovo intento; restano nello storico. */
        invited_at         = null,
        invited_by         = null,
        invitation_message = null,
        declined_at        = null,
        revoked_at         = null,
        revoked_by         = null
    where p.id = v_part.id
    returning * into v_part;

    perform public.selection_event_participation_log(v_part, 'RESUBMITTED', v_from);
  end if;

  if v_target = 'confirmed' then
    perform public.selection_event_participation_log(
      v_part, 'AUTO_CONFIRMED', case when v_resub then v_from else null end);
  end if;

  v_result := jsonb_build_object(
    'participation_id', v_part.id,
    'status',           v_part.status,
    'version',          v_part.version,
    'outcome',          case when v_resub then 'resubmitted' else 'submitted' end,
    'replayed',         false);

  perform public.selection_event_operation_record(
    p_idempotency_key, v_event.club_id, v_event.id, 'register', v_finger, v_result);

  /* §22: nessuna notifica per la propria submission o per la conferma
     automatica vista in diretta; nessuna alla Società per ogni iscrizione. */
  return v_result;
end;
$$;

revoke all on function public.register_for_selection_event(uuid, text) from public, anon;
grant execute on function public.register_for_selection_event(uuid, text) to authenticated;


-- ============================================================
-- SEZIONE 7 — invio degli inviti (§13, §15, §16)
-- ============================================================

/**
 * `sendEventInvitations(event_id, person_ids, message, idempotency_key,
 * expected context)` dello spec (§16). Il contesto atteso è la Società
 * operativa del client: un invio partito prima di un cambio d'identità non
 * si applica a un'altra Società (§12, QA-005).
 *
 * Confine transazionale unico: i problemi dell'evento o dell'autorizzazione
 * (pieno, iniziato, non pubblicato, scope revocato) **annullano tutto il
 * comando** prima di scrivere; le variazioni dei singoli destinatari
 * producono esiti individuali (§16). Le notifiche nascono nella stessa
 * transazione, quindi nessuna parte ne esce se il comando fallisce.
 *
 * Esiti per destinatario:
 *   sent              → INVITED nuovo (o reinvito di uno stato storico);
 *   already_invited   → invito corrente già presente, nessun duplicato;
 *   already_confirmed → già CONFIRMED;
 *   pending_request   → richiesta spontanea in attesa, non convertita (QA-024);
 *   unavailable       → profilo non più visibile o non idoneo. L'identità
 *                       non viene restituita (§16: «sostituisci identità non
 *                       più visibile con indicazione generica»).
 */
create or replace function public.send_selection_event_invitations(
  p_event_id        uuid,
  p_club_id         uuid,
  p_person_ids      uuid[],
  p_message         text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_now      timestamptz := now();
  v_limits   jsonb := public.selection_event_limits();
  v_message  text := public.selection_event_clean_text(p_message, true);
  v_ids      uuid[];
  v_finger   text;
  v_receipt  jsonb;
  v_event    public.selection_events;
  v_batch    uuid := gen_random_uuid();
  v_pid      uuid;
  v_part     public.selection_event_participations;
  v_profile  record;
  v_from     text;
  v_outcome  text;
  v_items    jsonb := '[]'::jsonb;
  v_sent     integer := 0;
  v_skipped  integer := 0;
  v_counts   record;
  v_result   jsonb;
  v_read     boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  /* §16: «Deduplica ID». L'ordine non cambia l'intento. */
  select coalesce(array_agg(distinct x order by x), array[]::uuid[]) into v_ids
  from unnest(coalesce(p_person_ids, array[]::uuid[])) as x
  where x is not null;

  if cardinality(v_ids) = 0 then
    raise exception 'SELECTION_EVENT_INVALID:no_recipients';
  end if;

  if cardinality(v_ids) > (v_limits ->> 'invitationBatch')::int then
    raise exception 'SELECTION_EVENT_INVALID:batch_too_large';
  end if;

  if v_message is not null
     and char_length(v_message) > (v_limits ->> 'invitationMessage')::int then
    raise exception 'SELECTION_EVENT_INVALID:message_too_long';
  end if;

  v_finger := md5('invite|' || array_to_string(v_ids, ',') || '|' || coalesce(v_message, ''));

  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('selection_event_op:' || p_idempotency_key));
  end if;

  /* §16: «Retry della stessa key restituisce lo stesso esito/receipt.» Non
     ricrea inviti se nel frattempo uno è stato accettato o rifiutato
     (QA-076): la ricevuta vince sullo stato corrente. */
  v_receipt := public.selection_event_operation_replay(p_idempotency_key, p_event_id, 'invite', v_finger);

  if v_receipt is not null then
    return v_receipt || jsonb_build_object('replayed', true);
  end if;

  select * into v_event
  from public.selection_events e
  where e.id = p_event_id
  for update;

  if v_event.id is null
     or not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'view') then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  /* QA-005: contesto Società cambiato dopo l'apertura del selector. */
  if p_club_id is null or p_club_id <> v_event.club_id then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  if not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'invite') then
    raise exception 'SELECTION_EVENT_NOT_AUTHORIZED';
  end if;

  /* §11: PUBLISHED, prima dell'inizio, squadra attiva. La deadline delle
     iscrizioni spontanee non conta (QA-016). */
  if v_event.status <> 'published'
     or v_event.starts_at is null
     or v_now >= v_event.starts_at
     or exists (select 1 from public.club_teams ct
                where ct.id = v_event.team_id and coalesce(ct.is_archived, false)) then
    raise exception 'SELECTION_EVENT_NOT_OPERATIONAL';
  end if;

  /* §11: pieno → nessun nuovo invito. Gli inviti esistenti restano. */
  if not public.selection_event_capacity_allows_confirmation(v_event.id) then
    raise exception 'SELECTION_EVENT_FULL';
  end if;

  /* §8, §16: «stati per target quando mostrabili». Senza lettura
     partecipanti l'esito non rivela stato né count dell'evento. */
  v_read := public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'participants');

  /* §27: anti-abuso tecnico, non un limite di posti. */
  perform public.assert_agent_rate_limit('selection_event_invite', v_event.club_id::text, 30, interval '10 minutes');

  foreach v_pid in array v_ids loop
    v_outcome := null;

    select pr.id, pr.full_name into v_profile
    from public.profiles pr where pr.id = v_pid;

    /* Identità non più visibile o non idonea (blocco sopravvenuto, ruolo
       cambiato): rivalidata qui, non dal client (QA-009). */
    if v_profile.id is null
       or v_pid = v_uid
       or public.selection_event_invitee_ineligibility(v_event, v_pid) is not null
       or exists (
         select 1 from public.user_blocks b
         where (b.blocker_profile_id = v_uid and b.blocked_profile_id = v_pid)
            or (b.blocker_profile_id = v_pid and b.blocked_profile_id = v_uid)) then
      v_outcome := 'unavailable';
    end if;

    select * into v_part
    from public.selection_event_participations p
    where p.event_id = v_event.id and p.person_id = v_pid
    for update;

    if v_outcome is null and v_part.id is not null then
      v_outcome := case v_part.status
        when 'invited'   then 'already_invited'
        when 'confirmed' then 'already_confirmed'
        when 'pending'   then 'pending_request'
        else null
      end;
    end if;

    if v_outcome is null then
      if v_part.id is null then
        insert into public.selection_event_participations
          (event_id, person_id, status, source, invited_at, invited_by,
           invitation_message, invitation_generation)
        values
          (v_event.id, v_pid, 'invited', 'invitation', v_now, v_uid, v_message, 1)
        returning * into v_part;

        perform public.selection_event_participation_log_message(
          v_part, 'INVITATION_SENT', null, v_message, v_batch);
      else
        /* §10: REJECTED, WITHDRAWN, DECLINED, REVOKED, REMOVED → nuovo
           invito esplicito. Stessa riga, nuova generazione; le decisioni e
           i messaggi precedenti non restano correnti (§9). */
        v_from := v_part.status;

        update public.selection_event_participations p
        set status                = 'invited',
            source                = 'invitation',
            invited_at            = v_now,
            invited_by            = v_uid,
            invitation_message    = v_message,
            invitation_generation = p.invitation_generation + 1,
            submitted_at          = null,
            confirmed_at          = null,
            rejected_at           = null,
            withdrawn_at          = null,
            withdrawn_from        = null,
            withdrawn_by_kind     = null,
            decision_by           = null,
            decision_message      = null,
            declined_at           = null,
            revoked_at            = null,
            revoked_by            = null,
            removed_at            = null,
            removed_by            = null,
            removal_message       = null
        where p.id = v_part.id
        returning * into v_part;

        perform public.selection_event_participation_log_message(
          v_part, 'INVITATION_RE_SENT', v_from, v_message, v_batch);
      end if;

      perform public.notify_selection_event_invitation(v_part);
      v_outcome := 'sent';
      v_sent := v_sent + 1;
    else
      v_skipped := v_skipped + 1;
    end if;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'person_id', case when v_outcome = 'unavailable' then null else v_pid end,
      'full_name', case when v_outcome = 'unavailable' then null else v_profile.full_name end,
      'outcome',   case when v_read or v_outcome = 'sent' then v_outcome else 'unavailable' end));
  end loop;

  insert into public.selection_event_audit (event_id, club_id, actor_id, operation, version, changed_fields)
  values (v_event.id, v_event.club_id, v_uid, 'invitations_sent', v_event.version, array[]::text[]);

  select c.confirmed_count, c.pending_requests_count into v_counts
  from public.selection_event_participation_counts(v_event.id) c;

  v_result := jsonb_build_object(
    'batch_id',        v_batch,
    'sent_count',      v_sent,
    'skipped_count',   v_skipped,
    'items',           v_items,
    'confirmed_count', case when v_read then v_counts.confirmed_count end,
    'pending_count',   case when v_read then v_counts.pending_requests_count end,
    'invited_count',   case when v_read then public.selection_event_invited_count(v_event.id) end,
    'replayed',        false);

  perform public.selection_event_operation_record(
    p_idempotency_key, v_event.club_id, v_event.id, 'invite', v_finger, v_result - 'replayed');

  return v_result;
end;
$$;

revoke all on function public.send_selection_event_invitations(uuid, uuid, uuid[], text, text) from public, anon;
grant execute on function public.send_selection_event_invitations(uuid, uuid, uuid[], text, text) to authenticated;


-- ============================================================
-- SEZIONE 8 — risposta del destinatario (§18, §19, §20)
-- ============================================================

/**
 * Guard comune di Accetta e Rifiuta: solo il destinatario (QA-070),
 * evento operativo, invito corrente alla **generazione e versione viste**
 * (§20). Ordine dei lock: evento, poi partecipazione — lo stesso di ogni
 * comando del dominio.
 */
create or replace function public.selection_event_lock_invitation(
  p_participation_id    uuid,
  p_expected_version    integer,
  p_expected_generation integer,
  out o_event public.selection_events,
  out o_part  public.selection_event_participations
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.selection_event_participations;
begin
  select * into v_ref from public.selection_event_participations p where p.id = p_participation_id;

  if v_ref.id is null or v_ref.person_id <> auth.uid() then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  select * into o_event from public.selection_events e where e.id = v_ref.event_id for update;

  select * into o_part
  from public.selection_event_participations p
  where p.id = p_participation_id
  for update;

  if o_event.status <> 'published'
     or o_event.starts_at is null
     or now() >= o_event.starts_at then
    raise exception 'SELECTION_EVENT_NOT_OPERATIONAL';
  end if;

  if o_part.status <> 'invited'
     or p_expected_generation is null
     or p_expected_generation <> o_part.invitation_generation
     or p_expected_version is null
     or p_expected_version <> o_part.version then
    raise exception 'SELECTION_EVENT_PARTICIPATION_CHANGED';
  end if;
end;
$$;

revoke all on function public.selection_event_lock_invitation(uuid, integer, integer) from public;
revoke execute on function public.selection_event_lock_invitation(uuid, integer, integer) from anon, authenticated;

/**
 * Accetta (§18): INVITED → CONFIRMED direttamente, anche con conferma
 * manuale o Solo su invito; nessuna seconda approvazione (QA-063). Il posto
 * si verifica al commit sotto il lock dell'evento (QA-141); a capienza piena
 * l'invito resta INVITED (QA-065).
 */
create or replace function public.accept_selection_event_invitation(
  p_participation_id    uuid,
  p_expected_version    integer,
  p_expected_generation integer,
  p_idempotency_key     text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_finger  text := md5('accept|' || coalesce(p_expected_generation::text, '-'));
  v_receipt jsonb;
  v_ref     public.selection_event_participations;
  v_lock    record;
  v_event   public.selection_events;
  v_part    public.selection_event_participations;
  v_result  jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('selection_event_op:' || p_idempotency_key));
  end if;

  select * into v_ref from public.selection_event_participations p where p.id = p_participation_id;

  if v_ref.id is null or v_ref.person_id <> auth.uid() then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  v_receipt := public.selection_event_operation_replay(p_idempotency_key, p_participation_id, 'accept', v_finger);

  if v_receipt is not null then
    return jsonb_build_object('participation_id', v_ref.id, 'status', v_ref.status,
                              'version', v_ref.version, 'outcome', 'replayed', 'replayed', true);
  end if;

  select * into v_lock
  from public.selection_event_lock_invitation(p_participation_id, p_expected_version, p_expected_generation);
  v_event := v_lock.o_event;
  v_part  := v_lock.o_part;

  /* §11: «Società/Team operativi» anche al commit dell'accettazione. */
  if exists (select 1 from public.club_teams ct
             where ct.id = v_event.team_id and coalesce(ct.is_archived, false)) then
    raise exception 'SELECTION_EVENT_NOT_OPERATIONAL';
  end if;

  /* Il blocco sopravvenuto con la Società vale anche per un invito già
     ricevuto (QA-009). */
  if public.selection_event_invitee_ineligibility(v_event, auth.uid()) is not null then
    raise exception 'SELECTION_EVENT_NOT_ELIGIBLE';
  end if;

  if not public.selection_event_capacity_allows_confirmation(v_event.id) then
    raise exception 'SELECTION_EVENT_FULL';
  end if;

  update public.selection_event_participations p
  set status       = 'confirmed',
      confirmed_at = now()
  where p.id = v_part.id
  returning * into v_part;

  perform public.selection_event_participation_log(v_part, 'INVITATION_ACCEPTED', 'invited');

  v_result := jsonb_build_object('participation_id', v_part.id, 'status', v_part.status,
                                 'version', v_part.version, 'outcome', 'invitation_accepted',
                                 'replayed', false);

  perform public.selection_event_operation_record(
    p_idempotency_key, v_event.club_id, v_part.id, 'accept', v_finger, v_result);

  /* §28: nessuna push obbligatoria alla Società per l'accettazione. */
  return v_result;
end;
$$;

revoke all on function public.accept_selection_event_invitation(uuid, integer, integer, text) from public, anon;
grant execute on function public.accept_selection_event_invitation(uuid, integer, integer, text) to authenticated;

/** Rifiuta (§19): nessun motivo; disponibile anche a capienza piena (QA-065). */
create or replace function public.decline_selection_event_invitation(
  p_participation_id    uuid,
  p_expected_version    integer,
  p_expected_generation integer,
  p_idempotency_key     text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_finger  text := md5('decline|' || coalesce(p_expected_generation::text, '-'));
  v_receipt jsonb;
  v_ref     public.selection_event_participations;
  v_lock    record;
  v_event   public.selection_events;
  v_part    public.selection_event_participations;
  v_result  jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('selection_event_op:' || p_idempotency_key));
  end if;

  select * into v_ref from public.selection_event_participations p where p.id = p_participation_id;

  if v_ref.id is null or v_ref.person_id <> auth.uid() then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  v_receipt := public.selection_event_operation_replay(p_idempotency_key, p_participation_id, 'decline', v_finger);

  if v_receipt is not null then
    return jsonb_build_object('participation_id', v_ref.id, 'status', v_ref.status,
                              'version', v_ref.version, 'outcome', 'replayed', 'replayed', true);
  end if;

  select * into v_lock
  from public.selection_event_lock_invitation(p_participation_id, p_expected_version, p_expected_generation);
  v_event := v_lock.o_event;
  v_part  := v_lock.o_part;

  update public.selection_event_participations p
  set status      = 'declined',
      declined_at = now()
  where p.id = v_part.id
  returning * into v_part;

  perform public.selection_event_participation_log(v_part, 'INVITATION_DECLINED', 'invited');

  v_result := jsonb_build_object('participation_id', v_part.id, 'status', v_part.status,
                                 'version', v_part.version, 'outcome', 'invitation_declined',
                                 'replayed', false);

  perform public.selection_event_operation_record(
    p_idempotency_key, v_event.club_id, v_part.id, 'decline', v_finger, v_result);

  /* §19: «Nessuna push a tutti gli admin.» */
  return v_result;
end;
$$;

revoke all on function public.decline_selection_event_invitation(uuid, integer, integer, text) from public, anon;
grant execute on function public.decline_selection_event_invitation(uuid, integer, integer, text) to authenticated;


-- ============================================================
-- SEZIONE 9 — revoca e rimozione della Società (§24, §25)
-- ============================================================

/**
 * Guard comune: visibilità (altrimenti NOT_AVAILABLE, senza distinguere
 * inesistente da privato), `manage` sulla squadra **al commit**, evento
 * operativo, stato e versione attesi. È il gemello di
 * `selection_event_lock_decision` della 29, che resta per le richieste.
 */
create or replace function public.selection_event_lock_participant(
  p_participation_id uuid,
  p_expected_version integer,
  p_expected_status  text,
  out o_event public.selection_events,
  out o_part  public.selection_event_participations
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.selection_event_participations;
begin
  select * into v_ref from public.selection_event_participations p where p.id = p_participation_id;

  if v_ref.id is null then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  select * into o_event from public.selection_events e where e.id = v_ref.event_id for update;

  if not public.selection_event_can_operate(o_event.club_id, o_event.team_id, 'view') then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  if not public.selection_event_can_operate(o_event.club_id, o_event.team_id, 'manage') then
    raise exception 'SELECTION_EVENT_NOT_AUTHORIZED';
  end if;

  select * into o_part
  from public.selection_event_participations p
  where p.id = p_participation_id
  for update;

  if o_event.status <> 'published'
     or o_event.starts_at is null
     or now() >= o_event.starts_at then
    raise exception 'SELECTION_EVENT_NOT_OPERATIONAL';
  end if;

  /* QA-103, QA-104: se l'accettazione ha già vinto, la revoca non rimuove
     il confermato; l'esito è un conflitto e il client rilegge. */
  if o_part.status <> p_expected_status
     or p_expected_version is null
     or p_expected_version <> o_part.version then
    raise exception 'SELECTION_EVENT_PARTICIPATION_CHANGED';
  end if;
end;
$$;

revoke all on function public.selection_event_lock_participant(uuid, integer, text) from public;
revoke execute on function public.selection_event_lock_participant(uuid, integer, text) from anon, authenticated;

create or replace function public.revoke_selection_event_invitation(
  p_participation_id uuid,
  p_expected_version integer,
  p_idempotency_key  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_finger  text := md5('revoke|' || coalesce(p_expected_version::text, '-'));
  v_receipt jsonb;
  v_lock    record;
  v_event   public.selection_events;
  v_part    public.selection_event_participations;
  v_result  jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('selection_event_op:' || p_idempotency_key));
  end if;

  v_receipt := public.selection_event_operation_replay(p_idempotency_key, p_participation_id, 'revoke', v_finger);

  if v_receipt is not null then
    select * into v_part from public.selection_event_participations p where p.id = p_participation_id;
    select * into v_event from public.selection_events e where e.id = v_part.event_id;

    if v_part.id is null
       or not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'view') then
      raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
    end if;

    return jsonb_build_object('participation_id', v_part.id, 'status', v_part.status,
                              'version', v_part.version, 'outcome', 'replayed', 'replayed', true);
  end if;

  select * into v_lock
  from public.selection_event_lock_participant(p_participation_id, p_expected_version, 'invited');
  v_event := v_lock.o_event;
  v_part  := v_lock.o_part;

  update public.selection_event_participations p
  set status     = 'revoked',
      revoked_at = now(),
      revoked_by = auth.uid()
  where p.id = v_part.id
  returning * into v_part;

  perform public.selection_event_participation_log(v_part, 'INVITATION_REVOKED', 'invited');
  perform public.notify_selection_event_invitation(v_part);

  v_result := jsonb_build_object('participation_id', v_part.id, 'status', v_part.status,
                                 'version', v_part.version, 'outcome', 'invitation_revoked',
                                 'replayed', false);

  perform public.selection_event_operation_record(
    p_idempotency_key, v_event.club_id, v_part.id, 'revoke', v_finger, v_result);

  return v_result;
end;
$$;

revoke all on function public.revoke_selection_event_invitation(uuid, integer, text) from public, anon;
grant execute on function public.revoke_selection_event_invitation(uuid, integer, text) to authenticated;

/**
 * Rimozione di un confermato (§25): REMOVED, mai WITHDRAWN/DECLINED/REJECTED.
 * Il posto si libera una volta sola: rimozione e ritiro concorrenti passano
 * dallo stesso lock e dalla stessa versione (QA-108). Nessuna promozione di
 * pending o invitati (QA-110), nessuna modifica alle Shortlist (QA-124).
 */
create or replace function public.remove_selection_event_participant(
  p_participation_id uuid,
  p_expected_version integer,
  p_message          text,
  p_idempotency_key  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text := public.selection_event_clean_text(p_message, true);
  v_finger  text;
  v_receipt jsonb;
  v_lock    record;
  v_event   public.selection_events;
  v_part    public.selection_event_participations;
  v_result  jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_message is not null
     and char_length(v_message) > (public.selection_event_limits() ->> 'invitationMessage')::int then
    raise exception 'SELECTION_EVENT_INVALID:message_too_long';
  end if;

  v_finger := md5('remove|' || coalesce(p_expected_version::text, '-') || '|' || coalesce(v_message, ''));

  if p_idempotency_key is not null and length(btrim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('selection_event_op:' || p_idempotency_key));
  end if;

  v_receipt := public.selection_event_operation_replay(p_idempotency_key, p_participation_id, 'remove', v_finger);

  if v_receipt is not null then
    select * into v_part from public.selection_event_participations p where p.id = p_participation_id;
    select * into v_event from public.selection_events e where e.id = v_part.event_id;

    if v_part.id is null
       or not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'view') then
      raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
    end if;

    return jsonb_build_object('participation_id', v_part.id, 'status', v_part.status,
                              'version', v_part.version, 'outcome', 'replayed', 'replayed', true);
  end if;

  select * into v_lock
  from public.selection_event_lock_participant(p_participation_id, p_expected_version, 'confirmed');
  v_event := v_lock.o_event;
  v_part  := v_lock.o_part;

  update public.selection_event_participations p
  set status          = 'removed',
      removed_at      = now(),
      removed_by      = auth.uid(),
      removal_message = v_message,
      confirmed_at    = null,
      decision_by     = null
  where p.id = v_part.id
  returning * into v_part;

  perform public.selection_event_participation_log_message(
    v_part, 'PARTICIPANT_REMOVED', 'confirmed', v_message, null);
  perform public.notify_selection_event_invitation(v_part);

  v_result := jsonb_build_object('participation_id', v_part.id, 'status', v_part.status,
                                 'version', v_part.version, 'outcome', 'participant_removed',
                                 'replayed', false);

  perform public.selection_event_operation_record(
    p_idempotency_key, v_event.club_id, v_part.id, 'remove', v_finger, v_result);

  return v_result;
end;
$$;

revoke all on function public.remove_selection_event_participant(uuid, integer, text, text) from public, anon;
grant execute on function public.remove_selection_event_participant(uuid, integer, text, text) to authenticated;


-- ============================================================
-- SEZIONE 10 — centro partecipanti (§21, §22, §23)
-- ============================================================

/**
 * Stato della stella Shortlist per una persona, nel contesto dell'actor e
 * della Società (§26). Stessa regola di `fetch_profile_shortlist_state`
 * della 26, in forma compatta per le righe: 'hidden' | 'empty' | 'filled'.
 * Nessun nome o count di lista.
 */
create or replace function public.selection_event_star_state(
  p_club_id   uuid,
  p_person_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null
      or p_person_id = auth.uid()
      or public.shortlist_person_kind(p_person_id) is null
      or not public.shortlist_key_in_any_scope(p_club_id, 'shortlist_view') then 'hidden'
    when public.shortlist_person_in_any_list(p_club_id, p_person_id) then 'filled'
    when public.shortlist_key_in_any_scope(p_club_id, 'shortlist_add_profiles') then 'empty'
    else 'hidden'
  end;
$$;

revoke all on function public.selection_event_star_state(uuid, uuid) from public;
revoke execute on function public.selection_event_star_state(uuid, uuid) from anon, authenticated;

/** Ruolo di campo mostrabile («Attaccante»): posizione principale del Calciatore. */
create or replace function public.selection_event_person_position(p_person_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select pp.primary_position::text from public.player_profiles pp where pp.profile_id = p_person_id;
$$;

revoke all on function public.selection_event_person_position(uuid) from public;
revoke execute on function public.selection_event_person_position(uuid) from anon, authenticated;

/** Cursore opaco: base64 di un jsonb. Un cursore malformato è un errore di input. */
create or replace function public.selection_event_cursor_decode(p_cursor text)
returns jsonb
language plpgsql
immutable
as $$
begin
  if p_cursor is null or btrim(p_cursor) = '' then
    return null;
  end if;

  return convert_from(decode(p_cursor, 'base64'), 'UTF8')::jsonb;
exception when others then
  raise exception 'SELECTION_EVENT_INVALID:cursor';
end;
$$;

create or replace function public.selection_event_cursor_encode(p_value jsonb)
returns text
language sql
immutable
as $$
  select replace(encode(convert_to(p_value::text, 'UTF8'), 'base64'), E'\n', '');
$$;

revoke all on function public.selection_event_cursor_decode(text) from public;
revoke all on function public.selection_event_cursor_encode(jsonb) from public;
revoke execute on function public.selection_event_cursor_decode(text) from anon, authenticated;
revoke execute on function public.selection_event_cursor_encode(jsonb) from anon, authenticated;

/**
 * Lista dei partecipanti di un evento (§21), un filtro alla volta:
 *
 *   confirmed  → nome normalizzato ASC (normalizzazione condivisa
 *                `footme_normalize_lookup`, la stessa di Cerca);
 *   pending    → submitted_at ASC;
 *   invited    → invited_at DESC;
 *   rejected   → rejected_at DESC;  declined → declined_at DESC;
 *   withdrawn  → withdrawn_at DESC; all      → updated_at DESC.
 *
 * Tie-breaker sempre l'ID. `total` è il count del filtro e della query
 * sull'insieme autorizzato, non sulla pagina (§21). Il cursore lega filtro,
 * query, actor e perimetro: non si riusa cross-Società (§29).
 *
 * Per riga: azioni permesse (rivalidate dai comandi al commit, §27) e
 * stato della stella (§26).
 */
create or replace function public.fetch_selection_event_participants(
  p_event_id uuid,
  p_filter   text    default 'confirmed',
  p_query    text    default null,
  p_cursor   text    default null,
  p_limit    integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_now     timestamptz := now();
  v_event   public.selection_events;
  v_filter  text := coalesce(nullif(btrim(p_filter), ''), 'confirmed');
  v_term    text := public.footme_normalize_lookup(p_query);
  v_limit   integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_scope   text;
  v_cursor  jsonb;
  v_c_name  text;
  v_c_ts    timestamptz;
  v_c_id    uuid;
  v_manage  boolean;
  v_operational boolean;
  v_full    boolean;
  v_counts  record;
  v_total   integer;
  v_rows    jsonb;
  v_items   jsonb;
  v_next    text;
  v_last    jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_filter not in ('confirmed', 'pending', 'invited', 'rejected', 'declined', 'withdrawn', 'all') then
    raise exception 'SELECTION_EVENT_INVALID:filter';
  end if;

  select * into v_event from public.selection_events e where e.id = p_event_id;

  if v_event.id is null
     or not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'view') then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  if not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'participants') then
    raise exception 'SELECTION_EVENT_NOT_AUTHORIZED';
  end if;

  v_scope := md5(v_uid::text || '|' || v_event.id::text || '|' || v_filter || '|' || v_term || '|'
                 || public.selection_events_scope_fingerprint(v_event.club_id));

  v_cursor := public.selection_event_cursor_decode(p_cursor);

  if v_cursor is not null then
    if v_cursor ->> 's' is distinct from v_scope then
      raise exception 'SELECTION_EVENT_INVALID:cursor';
    end if;

    v_c_name := v_cursor ->> 'n';
    v_c_ts   := (v_cursor ->> 't')::timestamptz;
    v_c_id   := (v_cursor ->> 'i')::uuid;
  end if;

  v_manage := public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'manage');
  v_operational := v_event.status = 'published'
    and v_event.starts_at is not null
    and v_now < v_event.starts_at;

  select c.confirmed_count, c.pending_requests_count into v_counts
  from public.selection_event_participation_counts(v_event.id) c;

  v_full := v_event.max_participants is not null
    and coalesce(v_counts.confirmed_count, 0) >= v_event.max_participants;

  with base as (
    select
      p.id, p.person_id, p.status, p.source, p.version, p.invitation_generation,
      p.invited_at, p.invitation_message, p.submitted_at, p.confirmed_at, p.rejected_at,
      p.declined_at, p.withdrawn_at, p.withdrawn_from, p.revoked_at, p.removed_at, p.updated_at,
      pr.full_name, pr.avatar_url, pr.role::text as role,
      public.footme_normalize_lookup(pr.full_name) as norm_name,
      coalesce(case v_filter
        when 'pending'   then p.submitted_at
        when 'invited'   then p.invited_at
        when 'rejected'  then p.rejected_at
        when 'declined'  then p.declined_at
        when 'withdrawn' then p.withdrawn_at
        else p.updated_at
      end, p.updated_at) as sort_ts
    from public.selection_event_participations p
    join public.profiles pr on pr.id = p.person_id
    where p.event_id = v_event.id
      and (v_filter = 'all' or p.status = v_filter)
      and (v_term = '' or public.footme_normalize_lookup(pr.full_name) like '%' || v_term || '%')
  ),
  counted as (
    select count(*)::integer as total from base
  ),
  page as (
    select b.*
    from base b
    where v_c_id is null
       or (v_filter = 'confirmed' and (b.norm_name, b.id) > (v_c_name, v_c_id))
       or (v_filter = 'pending'   and (b.sort_ts, b.id) > (v_c_ts, v_c_id))
       or (v_filter not in ('confirmed', 'pending') and (b.sort_ts, b.id) < (v_c_ts, v_c_id))
    order by
      case when v_filter = 'confirmed' then b.norm_name end asc,
      case when v_filter = 'pending'   then b.sort_ts end asc,
      case when v_filter not in ('confirmed', 'pending') then b.sort_ts end desc,
      case when v_filter in ('confirmed', 'pending') then b.id end asc,
      case when v_filter not in ('confirmed', 'pending') then b.id end desc
    limit v_limit + 1
  )
  select
    (select total from counted),
    coalesce(jsonb_agg(jsonb_build_object(
      'participation_id', pg.id,
      'person_id',        pg.person_id,
      'full_name',        pg.full_name,
      'avatar_url',       pg.avatar_url,
      'role',             pg.role,
      'primary_position', public.selection_event_person_position(pg.person_id),
      'status',           pg.status,
      'source',           pg.source,
      'withdrawn_from',   pg.withdrawn_from,
      'status_at',        case pg.status
                            when 'pending'   then pg.submitted_at
                            when 'confirmed' then pg.confirmed_at
                            when 'invited'   then pg.invited_at
                            when 'rejected'  then pg.rejected_at
                            when 'declined'  then pg.declined_at
                            when 'withdrawn' then pg.withdrawn_at
                            when 'revoked'   then pg.revoked_at
                            when 'removed'   then pg.removed_at
                          end,
      'invited_at',       pg.invited_at,
      /* §23: snapshot del messaggio solo sull'invito corrente. */
      'invitation_message', case when pg.status = 'invited' then pg.invitation_message end,
      'version',          pg.version,
      'invitation_generation', pg.invitation_generation,
      'actions', to_jsonb(array_remove(array[
        case when v_manage and v_operational and pg.status = 'pending' and not v_full then 'confirm' end,
        case when v_manage and v_operational and pg.status = 'pending' then 'reject' end,
        case when v_manage and v_operational and pg.status = 'invited' then 'revoke' end,
        case when v_manage and v_operational and pg.status = 'confirmed' then 'remove' end
      ], null)),
      'confirm_blocked_reason', case when v_manage and v_operational and pg.status = 'pending' and v_full
                                     then 'full' end,
      'star', public.selection_event_star_state(v_event.club_id, pg.person_id),
      '_n', pg.norm_name,
      '_t', pg.sort_ts
    ) order by
      case when v_filter = 'confirmed' then pg.norm_name end asc,
      case when v_filter = 'pending'   then pg.sort_ts end asc,
      case when v_filter not in ('confirmed', 'pending') then pg.sort_ts end desc,
      case when v_filter in ('confirmed', 'pending') then pg.id end asc,
      case when v_filter not in ('confirmed', 'pending') then pg.id end desc
    ), '[]'::jsonb)
  into v_total, v_rows
  from page pg;

  if jsonb_array_length(v_rows) > v_limit then
    v_last := v_rows -> (v_limit - 1);
    v_next := public.selection_event_cursor_encode(jsonb_build_object(
      's', v_scope,
      'n', v_last ->> '_n',
      't', v_last ->> '_t',
      'i', v_last ->> 'participation_id'));
  end if;

  select coalesce(jsonb_agg(x.value - '_n' - '_t' order by x.ordinality), '[]'::jsonb)
    into v_items
  from jsonb_array_elements(v_rows) with ordinality x
  where x.ordinality <= v_limit;

  return jsonb_build_object(
    'filter',      v_filter,
    'total',       coalesce(v_total, 0),
    'items',       v_items,
    'next_cursor', v_next,
    'counts', jsonb_build_object(
      'confirmed_count', v_counts.confirmed_count,
      'pending_count',   v_counts.pending_requests_count,
      'invited_count',   public.selection_event_invited_count(v_event.id)),
    'capabilities', jsonb_build_object(
      'manage',      v_manage and v_operational,
      'operational', v_operational,
      'is_full',     v_full),
    'access_verified_at', v_now);
end;
$$;

revoke all on function public.fetch_selection_event_participants(uuid, text, text, text, integer) from public, anon;
grant execute on function public.fetch_selection_event_participants(uuid, text, text, text, integer) to authenticated;


-- ============================================================
-- SEZIONE 11 — selezione dei destinatari (§13, §14)
-- ============================================================

/**
 * Una Shortlist è una sorgente leggibile dall'actor per l'evento? (§14)
 * Stessa Società dell'evento, accesso della singola lista (owner,
 * condivisione, policy storica — 27 §8) e `shortlist_view` nel perimetro
 * della lista: è la regola della policy di select su `club_shortlists`.
 * Il perimetro della lista **non** deve coincidere con la squadra
 * dell'evento (§14: «Lo scope della lista controlla l'accesso, non impone
 * che la persona appartenga al Team dell'evento»).
 */
create or replace function public.selection_event_invite_source_ok(
  p_club_id      uuid,
  p_shortlist_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_shortlists cs
    where cs.id = p_shortlist_id
      and cs.club_id = p_club_id
      and (cs.list_type = 'position' or cs.deleted_at is null)
      and public.shortlist_list_access_ok(cs.id)
      and public.society_position_in_scope(cs.club_id, public.shortlist_list_team(cs.id), 'shortlist_view')
  );
$$;

revoke all on function public.selection_event_invite_source_ok(uuid, uuid) from public;
revoke execute on function public.selection_event_invite_source_ok(uuid, uuid) from anon, authenticated;

/**
 * Sorgenti del selector (§14, screen 03): Per posizione (POSITION) e Liste
 * personalizzate (CUSTOM) accessibili. Nessun nome, ID o count di liste non
 * accessibili. Richiede la capability di invito sull'evento: chi non può
 * invitare non ha un selector.
 */
create or replace function public.fetch_selection_event_invite_sources(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event public.selection_events;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_event from public.selection_events e where e.id = p_event_id;

  if v_event.id is null
     or not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'view') then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  if not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'invite') then
    raise exception 'SELECTION_EVENT_NOT_AUTHORIZED';
  end if;

  return jsonb_build_object(
    'position_lists', coalesce((
      select jsonb_agg(x.item order by x.sort_key, x.id)
      from (
        select cs.id,
               lower(public.shortlist_position_title(cs.position_id)) as sort_key,
               jsonb_build_object(
                 'shortlist_id', cs.id,
                 'name',         public.shortlist_position_title(cs.position_id),
                 'scope_label',  public.shortlist_scope_label(cs.id, cs.position_id)) as item
        from public.club_shortlists cs
        where cs.club_id = v_event.club_id
          and cs.list_type = 'position'
          and public.selection_event_invite_source_ok(v_event.club_id, cs.id)
        order by 2, cs.id
        limit 50
      ) x
    ), '[]'::jsonb),
    'custom_lists', coalesce((
      select jsonb_agg(x.item order by x.sort_key, x.id)
      from (
        select cs.id,
               lower(coalesce(cs.name, '')) as sort_key,
               jsonb_build_object(
                 'shortlist_id', cs.id,
                 'name',         cs.name,
                 'scope_label',  public.shortlist_scope_label(cs.id, null)) as item
        from public.club_shortlists cs
        where cs.club_id = v_event.club_id
          and cs.list_type = 'custom'
          and public.selection_event_invite_source_ok(v_event.club_id, cs.id)
        order by 2, cs.id
        limit 50
      ) x
    ), '[]'::jsonb),
    'access_verified_at', now());
end;
$$;

revoke all on function public.fetch_selection_event_invite_sources(uuid) from public, anon;
grant execute on function public.fetch_selection_event_invite_sources(uuid) to authenticated;

/**
 * Ricerca candidati (§13, §14, screen 02). Profili reali e idonei secondo la
 * regola del dominio (vedi testata), mai l'actor, mai un blocco fra actor e
 * persona. Con una sorgente Shortlist cerca **solo** fra i suoi membri,
 * rivalidando l'accesso alla lista a ogni lettura (§14, QA-036): una lista
 * non più accessibile è `SHORTLIST_SOURCE_NOT_AVAILABLE`, non un elenco
 * globale di ripiego.
 *
 * Per riga: stato della relazione con l'evento e motivo di non
 * selezionabilità (§13). Ogni persona compare una volta (chiave persona).
 * Ordine: nome normalizzato, ID. Paginazione a cursore.
 *
 * `volatile` perché applica il rate limit (§27).
 */
create or replace function public.search_selection_event_candidates(
  p_event_id     uuid,
  p_shortlist_id uuid    default null,
  p_query        text    default null,
  p_cursor       text    default null,
  p_limit        integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_event  public.selection_events;
  v_owner  uuid;
  v_term   text := public.footme_normalize_lookup(p_query);
  v_limit  integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_scope  text;
  v_cursor jsonb;
  v_c_name text;
  v_c_id   uuid;
  v_rows   jsonb;
  v_items  jsonb;
  v_next   text;
  v_last   jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_event from public.selection_events e where e.id = p_event_id;

  if v_event.id is null
     or not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'view') then
    raise exception 'SELECTION_EVENT_NOT_AVAILABLE';
  end if;

  if not public.selection_event_can_operate(v_event.club_id, v_event.team_id, 'invite') then
    raise exception 'SELECTION_EVENT_NOT_AUTHORIZED';
  end if;

  if p_shortlist_id is not null
     and not public.selection_event_invite_source_ok(v_event.club_id, p_shortlist_id) then
    raise exception 'SHORTLIST_SOURCE_NOT_AVAILABLE';
  end if;

  perform public.assert_agent_rate_limit('selection_event_candidate_search', null, 120, interval '1 minute');

  select c.owner_profile_id into v_owner from public.clubs c where c.id = v_event.club_id;

  v_scope := md5(v_uid::text || '|' || v_event.id::text || '|' || coalesce(p_shortlist_id::text, 'all')
                 || '|' || v_term);

  v_cursor := public.selection_event_cursor_decode(p_cursor);

  if v_cursor is not null then
    if v_cursor ->> 's' is distinct from v_scope then
      raise exception 'SELECTION_EVENT_INVALID:cursor';
    end if;

    v_c_name := v_cursor ->> 'n';
    v_c_id   := (v_cursor ->> 'i')::uuid;
  end if;

  with base as (
    select pr.id, pr.full_name, pr.avatar_url, pr.role::text as role,
           public.footme_normalize_lookup(pr.full_name) as norm_name
    from public.profiles pr
    where pr.role in ('player', 'coach', 'staff')
      /* Stessa regola di selection_event_invitee_ineligibility: ruolo con
         il suo profilo sportivo. Owner e blocchi sono filtrati sotto. */
      and (
        (pr.role = 'player' and exists (select 1 from public.player_profiles pp where pp.profile_id = pr.id))
        or (pr.role = 'coach' and exists (select 1 from public.coach_profiles cp where cp.profile_id = pr.id))
        or (pr.role = 'staff' and exists (select 1 from public.staff_profiles sp where sp.profile_id = pr.id))
      )
      and pr.id <> v_uid
      and v_owner is distinct from pr.id
      and nullif(btrim(pr.full_name), '') is not null
      and (p_shortlist_id is null or exists (
        select 1 from public.club_shortlist_entries en
        where en.shortlist_id = p_shortlist_id and en.player_profile_id = pr.id))
      and (v_term = '' or public.footme_normalize_lookup(pr.full_name) like '%' || v_term || '%')
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_profile_id = v_uid and b.blocked_profile_id = pr.id)
           or (b.blocker_profile_id = pr.id and b.blocked_profile_id = v_uid)
           or (v_owner is not null and b.blocker_profile_id = pr.id and b.blocked_profile_id = v_owner)
           or (v_owner is not null and b.blocker_profile_id = v_owner and b.blocked_profile_id = pr.id))
  ),
  page as (
    select b.*
    from base b
    where v_c_id is null or (b.norm_name, b.id) > (v_c_name, v_c_id)
    order by b.norm_name, b.id
    limit v_limit + 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'person_id',        pg.id,
    'full_name',        pg.full_name,
    'avatar_url',       pg.avatar_url,
    'role',             pg.role,
    'primary_position', public.selection_event_person_position(pg.id),
    'relation_status',  part.status,
    'selectable',       part.status is null or part.status not in ('invited', 'confirmed', 'pending'),
    'reason',           case part.status
                          when 'invited'   then 'already_invited'
                          when 'confirmed' then 'already_confirmed'
                          when 'pending'   then 'pending_request'
                        end,
    '_n', pg.norm_name
  ) order by pg.norm_name, pg.id), '[]'::jsonb)
  into v_rows
  from page pg
  left join public.selection_event_participations part
    on part.event_id = v_event.id and part.person_id = pg.id;

  if jsonb_array_length(v_rows) > v_limit then
    v_last := v_rows -> (v_limit - 1);
    v_next := public.selection_event_cursor_encode(jsonb_build_object(
      's', v_scope, 'n', v_last ->> '_n', 'i', v_last ->> 'person_id'));
  end if;

  select coalesce(jsonb_agg(x.value - '_n' order by x.ordinality), '[]'::jsonb)
    into v_items
  from jsonb_array_elements(v_rows) with ordinality x
  where x.ordinality <= v_limit;

  return jsonb_build_object(
    'items',       v_items,
    'next_cursor', v_next,
    'access_verified_at', now());
end;
$$;

revoke all on function public.search_selection_event_candidates(uuid, uuid, text, text, integer) from public, anon;
grant execute on function public.search_selection_event_candidates(uuid, uuid, text, text, integer) to authenticated;


-- ============================================================
-- SEZIONE 12 — profilo → Invita a evento (§17)
-- ============================================================

/**
 * La micro-CTA esiste? (§17) Società operativa con la chiave di invito su
 * almeno una squadra, persona idonea secondo il dominio, non l'actor, nessun
 * blocco. Non garantisce un evento invitabile: il selector può finire nello
 * stato vuoto (screen 24).
 */
create or replace function public.fetch_profile_event_invite_state(
  p_club_id   uuid,
  p_person_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
  v_ok    boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select c.owner_profile_id into v_owner from public.clubs c where c.id = p_club_id;

  v_ok := p_club_id is not null
    and p_person_id is not null
    and p_person_id <> v_uid
    and v_owner is distinct from p_person_id
    and public.selection_event_key_in_any_scope(p_club_id, 'selection_events_invite')
    and exists (
      select 1 from public.profiles pr
      where pr.id = p_person_id
        and ((pr.role = 'player' and exists (select 1 from public.player_profiles pp where pp.profile_id = pr.id))
          or (pr.role = 'coach' and exists (select 1 from public.coach_profiles cp where cp.profile_id = pr.id))
          or (pr.role = 'staff' and exists (select 1 from public.staff_profiles sp where sp.profile_id = pr.id))))
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_profile_id = v_uid and b.blocked_profile_id = p_person_id)
         or (b.blocker_profile_id = p_person_id and b.blocked_profile_id = v_uid)
         or (v_owner is not null and b.blocker_profile_id = p_person_id and b.blocked_profile_id = v_owner)
         or (v_owner is not null and b.blocker_profile_id = v_owner and b.blocked_profile_id = p_person_id));

  return jsonb_build_object('available', coalesce(v_ok, false), 'access_verified_at', now());
end;
$$;

revoke all on function public.fetch_profile_event_invite_state(uuid, uuid) from public, anon;
grant execute on function public.fetch_profile_event_invite_state(uuid, uuid) to authenticated;

/**
 * Eventi a cui l'actor può invitare questa persona (§17, screen 06): Società
 * corrente, squadra nello scope di invito, PUBLISHED, non iniziati, non
 * pieni, persona idonea e senza invito/conferma/richiesta in corso. OPEN e
 * INVITE_ONLY, anche oltre la deadline spontanea. DRAFT e terminali esclusi.
 */
create or replace function public.fetch_invitable_selection_events(
  p_club_id   uuid,
  p_person_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_club_id is null
     or not public.selection_event_key_in_any_scope(p_club_id, 'selection_events_invite') then
    raise exception 'SELECTION_EVENT_NOT_AUTHORIZED';
  end if;

  if p_person_id is null or p_person_id = v_uid
     or exists (
       select 1 from public.user_blocks b
       where (b.blocker_profile_id = v_uid and b.blocked_profile_id = p_person_id)
          or (b.blocker_profile_id = p_person_id and b.blocked_profile_id = v_uid)) then
    return jsonb_build_object('items', '[]'::jsonb, 'access_verified_at', v_now);
  end if;

  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'event_id',   e.id,
               'title',      e.title,
               'event_type', e.event_type,
               'team_name',  ct.name,
               'timezone',   e.timezone,
               'start_date', e.start_date,
               'start_time', e.start_time,
               'end_time',   e.end_time,
               'participation_mode', e.participation_mode,
               'version',    e.version)
             order by e.starts_at, e.id)
      from public.selection_events e
      join public.club_teams ct on ct.id = e.team_id
      where e.club_id = p_club_id
        and e.status = 'published'
        and e.starts_at is not null
        and e.starts_at > v_now
        and not coalesce(ct.is_archived, false)
        and public.selection_event_can_operate(e.club_id, e.team_id, 'view')
        and public.selection_event_can_operate(e.club_id, e.team_id, 'invite')
        and (e.max_participants is null
             or (select c.confirmed_count from public.selection_event_participation_counts(e.id) c)
                < e.max_participants)
        and public.selection_event_invitee_ineligibility(e, p_person_id) is null
        and not exists (
          select 1 from public.selection_event_participations p
          where p.event_id = e.id and p.person_id = p_person_id
            and p.status in ('invited', 'confirmed', 'pending'))
    ), '[]'::jsonb),
    'access_verified_at', v_now);
end;
$$;

revoke all on function public.fetch_invitable_selection_events(uuid, uuid) from public, anon;
grant execute on function public.fetch_invitable_selection_events(uuid, uuid) to authenticated;
