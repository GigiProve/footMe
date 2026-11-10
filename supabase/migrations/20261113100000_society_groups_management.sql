-- ============================================================
-- DAS-REV-33 — Gruppi: gestione (fase DB-2: letture e comandi)
--
-- Cosa mancava dopo la 20261113090000 (DB-1) e la 20261112090000 (M32):
--
--   · Nessun comando sul gruppo dopo la creazione: né rinomina, immagine,
--     Squadra, persone, ruoli, uscita, archivio, riattivazione, eliminazione
--     (§10–§23). Tutto ciò che DB-1 ha reso impossibile da rompere (periodi,
--     finestra di accesso, SYSTEM_EVENT, tombstone) non aveva ancora un
--     chiamante legittimo.
--   · `society_group_can` conosce solo `view` e `create`: `groups_manage` e
--     `groups_delete` (catalogo rev. 7) non avevano un punto di valutazione.
--   · Le capability per gruppo (§5) non erano calcolate da nessuna parte: il
--     client avrebbe dovuto derivarle da una stringa di ruolo, che §5 vieta.
--   · Il dettaglio amministrativo 32 diceva `can_manage = false` per costruzione
--     (§11, QA-010) e mostrava solo i gruppi ACTIVE: la lista Archiviati (§21)
--     non aveva né sorgente né destinazione. Le due letture del Centro non
--     escludevano i gruppi eliminati (§23).
--   · L'immagine era caricabile solo da chi ha `groups_create` sulla Società:
--     un ADMIN interno (§10) non può esserlo (§5: non acquisisce poteri
--     Society).
--   · Nessun predicate di **mantenimento** (§20): quello di M32 è di
--     *aggiunta* (`society_group_person_eligible`, solo PERSON con incarico
--     sportivo/dirigenziale). Per riattivare (§22) e per la successione (§19)
--     serve sapere se una persona ha ancora un titolo valido, e il creator
--     amministrativo (§20, raccordo con la 32) non ha una rosa.
--
-- Scelte (§ = paragrafo della task):
--
--   1. **Un solo resolver di capability** (`society_group_caps`): restituisce
--      lo stato e i 13 booleani del contratto per l'utente corrente, ed è
--      usato da ogni query e da ogni comando. Il client non li ricalcola.
--      MEMBER, ADMIN interno e responsabile Society restano distinti: un
--      ruolo non attribuisce i poteri degli altri (§5). `groups_manage` e
--      `groups_delete` sono valutate nello scope della Squadra del gruppo;
--      un gruppo senza Squadra richiede lo scope societario.
--   2. **Ogni comando** prima verifica con un'autorizzazione economica (senza
--      lock) che l'actor abbia una relazione con il gruppo — un UUID arbitrario
--      non si può usare per accodarsi sul lock né per sondare l'esistenza — poi
--      apre con `for update` sulla riga del gruppo
--      (`society_group_cmd_open`): invio, archivio, eliminazione e comandi
--      si serializzano con il trigger di invio di DB-1 (`for share`). Poi
--      replay della ricevuta (stessa chiave + stesso payload = stesso esito;
--      payload diverso = `OPERATION_CONTENT_CHANGED`), poi capability
--      calcolate **dopo** il lock, quindi mai su dati stantii. Il replay
--      rivalida l'accesso corrente, tranne per i comandi che per definizione
--      lo tolgono (leave, handover, delete): un retry dell'uscita riuscita
--      deve restituire l'esito, non «non trovato».
--   3. **Versioning**: rename/avatar/Squadra/archivia/riattiva/elimina vogliono
--      `p_expected_version` (→ `SOCIETY_GROUP_VERSION_CONFLICT`). I comandi
--      sulle persone sono legati al `period_id` osservato (+ versione del
--      periodo per i ruoli): un comando stale su un periodo chiuso non tocca
--      mai il periodo nuovo della stessa persona. La versione del gruppo
--      aumenta nel trigger a ogni UPDATE (DB-1): un no-op non la tocca.
--   4. **Eventi** (§24) solo per: aggiunta (uno, o un aggregato col conteggio
--      realmente aggiunto), uscita, rimozione, rinomina effettiva, archivio,
--      riattivazione. Mai per creazione, avatar, Squadra, ruoli, eliminazione.
--      Dedup key = operazione + chiave idempotente. L'evento di un'aggiunta
--      precede le righe participant: `access_from_seq` = suo `seq`, così il
--      nuovo membro vede il proprio ingresso e nulla prima (§17).
--   5. **ARCHIVED** (§21): blocca server-side ogni modifica ordinaria
--      (nome, immagine, Squadra, persone, ruoli). Restano uscita, eliminazione,
--      riattivazione e il recupero (§22): un manager Society su un archiviato
--      con zero ADMIN può **solo** aggiungere persone e promuovere.
--   6. **Eleggibilità all'aggiunta**: il predicate di M32
--      (`society_group_person_eligible`) e la visibilità di scope
--      (`society_group_person_visible`), non una copia. Per un ADMIN interno
--      senza capability Society il perimetro è la Squadra del gruppo (o tutta
--      la Società se il gruppo non ha Squadra); per un manager, il suo scope
--      `groups_manage`; se è entrambe le cose, l'unione. **Scelta da
--      riportare a Luigi.**
--   7. **Mantenimento** (§20): `society_group_person_maintains` = incarico
--      attivo con membership attiva, OPPURE membership amministrativa attiva,
--      OPPURE proprietario della Società. Riattivare richiede almeno un ADMIN
--      con periodo attivo che mantiene il titolo; la successione ammette solo
--      sostituti che lo mantengono. Lo riusa DB-3 per la cessazione.
--   8. **Immagine** (§10): l'asset deve essere dell'actor e della stessa
--      Società, già registrato (la registrazione legge l'oggetto reale in
--      Storage). Upload e registrazione sono estesi a chi è ADMIN di un gruppo
--      ACTIVE della Società o ha `groups_manage`: il percorso `<club>/<asset>`
--      non sa a quale gruppo servirà, quindi il controllo è a livello Società.
--   9. Il dettaglio 32 ora serve anche i gruppi ARCHIVED (destinazione della
--      lista Archiviati) ed espone `can_manage` reale.
--
-- Nomi: `fetch_society_group_members_page` (persone attuali) e non
-- `fetch_society_group_people_page`, che è già la lista di creazione della 32
-- (overload ambiguo in PostgREST).
--
-- Funzioni riemesse dalla loro **ultima** definizione:
--   · society_group_can                 ← 20261112090000 (+manage/delete)
--   · fetch_society_groups_page         ← 20261112090000 (+deleted_at is null)
--   · fetch_society_group_detail        ← 20261112090000 (+archiviati, can_manage)
--   · society_group_avatar_can_upload   ← 20261112090000
--   · register_society_group_avatar     ← 20261112090000
--
-- Errori (stringhe, stile M32): SOCIETY_GROUP_NOT_FOUND, _DELETED, _ARCHIVED,
-- _FORBIDDEN, _VERSION_CONFLICT, _LAST_ADMIN, _LEAVE_REQUIRES_HANDOVER,
-- _LEAVE_ONLY_PERSON, _HANDOVER_NOT_REQUIRED, _REACTIVATE_REQUIRES_ADMIN,
-- _TARGETS_UNAVAILABLE:<ids non validi> (DETAIL = ids ancora validi),
-- _TEAM_UNAVAILABLE, _PERIOD_ENDED, _PEOPLE_REQUIRED, _TOO_MANY_PEOPLE,
-- _INVALID:<motivo>, OPERATION_CONTENT_CHANGED.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — autorizzazione e predicate (§5, §19, §20, §22)
-- ============================================================

/** Riemessa da 20261112090000: +`manage` (groups_manage) e `delete` (groups_delete). */
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
  v_key text := case p_action
    when 'create' then 'groups_create'
    when 'manage' then 'groups_manage'
    when 'delete' then 'groups_delete'
    else 'groups_view'
  end;
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
 * §20 — mantenimento del titolo. Fonti reali (nessun flag parallelo):
 *   · incarico `club_member_assignments` attivo sulla `club_members` attiva;
 *   · membership amministrativa `club_admin_memberships` attiva (il creator
 *     amministrativo della 32 non ha una rosa);
 *   · proprietario della Società.
 * Non basta l'appartenenza al gruppo, né un ruolo interno ADMIN: non
 * auto-legittimano una relazione cessata. L'**aggiunta** resta il predicate di
 * M32 (`society_group_person_eligible`): più stretto, solo PERSON.
 */
create or replace function public.society_group_person_maintains(
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
           where a.club_id = p_club_id
             and a.profile_id = p_profile_id
             and a.status = 'active'
         )
      or exists (
           select 1 from public.club_admin_memberships am
           where am.club_id = p_club_id
             and am.profile_id = p_profile_id
             and am.status = 'active'
         )
      or exists (
           select 1 from public.clubs c
           where c.id = p_club_id and c.owner_profile_id = p_profile_id
         );
$$;

/**
 * Perimetro delle persone aggiungibili da un actor (§13): null = tutta la
 * Società, array = solo chi ha un incarico attivo in quelle squadre. Manager
 * → scope di `groups_manage`; ADMIN interno → Squadra del gruppo (o tutta la
 * Società se il gruppo non ne ha); entrambi → unione.
 */
create or replace function public.society_group_add_scope(
  p_club_id  uuid,
  p_team_id  uuid,
  p_manager  boolean,
  p_admin    boolean
)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope uuid[] := array[]::uuid[];
begin
  if p_manager then
    v_scope := public.dashboard_club_capability_scope(p_club_id, 'groups_manage');

    if v_scope is null then
      return null;
    end if;
  end if;

  if p_admin then
    if p_team_id is null then
      return null;
    end if;

    v_scope := array_append(v_scope, p_team_id);
  end if;

  return v_scope;
end;
$$;

/** Etichetta professionale canonica, preferendo la Squadra data. */
create or replace function public.society_group_role_label(
  p_club_id    uuid,
  p_profile_id uuid,
  p_team_id    uuid,
  p_scope      uuid[]
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.club_assignment_role_label(a.structured_role_id, a.custom_role_name)
  from public.club_member_assignments a
  where a.club_id = p_club_id
    and a.profile_id = p_profile_id
    and a.status = 'active'
    and (p_scope is null or a.team_id = any (p_scope))
  order by (a.team_id is not distinct from p_team_id) desc, a.created_at, a.id
  limit 1;
$$;

/**
 * **Il** resolver delle capability di gruppo (§5) per l'utente corrente.
 * Restituisce null se il gruppo non esiste; per un gruppo eliminato
 * `{deleted, known}` (`known` = l'utente ha avuto un periodo o vede il gruppo
 * dalla Società: solo a lui si può dire «eliminato», agli altri «non trovato»).
 *
 * MEMBER / ADMIN / manager / deleter sono dimensioni indipendenti:
 *   can_view_info        membro, o groups_manage, o groups_delete
 *   can_access_conversation  membro (mai derivata dai permessi Society, §5)
 *   can_edit_name/avatar ACTIVE e (ADMIN interno o manager)
 *   can_edit_team        ACTIVE e manager sullo scope di origine
 *   can_view_people      membro o manager
 *   can_manage_people / can_manage_admins
 *                        ACTIVE e (ADMIN o manager), oppure recupero
 *   can_leave            membro
 *   can_archive          ACTIVE e (ADMIN o manager)
 *   can_reactivate       ARCHIVED con almeno un ADMIN, e (ADMIN o manager)
 *   can_delete           groups_delete nello scope, ACTIVE o ARCHIVED
 *   can_recover          manager su ARCHIVED con zero ADMIN
 */
create or replace function public.society_group_caps(p_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_g       public.society_groups%rowtype;
  v_role    text;
  v_period  uuid;
  v_member  boolean;
  v_admin   boolean;
  v_manager boolean;
  v_deleter boolean;
  v_admins  integer;
  v_people  integer;
  v_active  boolean;
  v_arch    boolean;
  v_recover boolean;
begin
  if v_uid is null then
    return null;
  end if;

  select * into v_g from public.society_groups g where g.conversation_id = p_conversation_id;

  if not found then
    return null;
  end if;

  v_manager := public.society_group_can(v_g.club_id, v_g.team_id, 'manage');
  v_deleter := public.society_group_can(v_g.club_id, v_g.team_id, 'delete');

  if v_g.deleted_at is not null then
    return jsonb_build_object(
      'deleted', true,
      'known', exists (
          select 1 from public.society_group_membership_periods per
          where per.conversation_id = p_conversation_id and per.profile_id = v_uid)
        or public.society_group_can(v_g.club_id, v_g.team_id, 'view'));
  end if;

  select cp.member_role, cp.period_id into v_role, v_period
  from public.conversation_participants cp
  where cp.conversation_id = p_conversation_id and cp.profile_id = v_uid;

  v_member  := v_role is not null;
  v_admin   := v_role = 'admin';
  v_active  := v_g.status = 'active';
  v_arch    := v_g.status = 'archived';

  select count(*) filter (where cp.member_role = 'admin')::int, count(*)::int
  into v_admins, v_people
  from public.conversation_participants cp
  where cp.conversation_id = p_conversation_id;

  v_recover := v_arch and v_admins = 0 and v_manager;

  return jsonb_build_object(
    'deleted',          false,
    'conversation_id',  p_conversation_id,
    'club_id',          v_g.club_id,
    'team_id',          v_g.team_id,
    'status',           v_g.status,
    'version',          v_g.version,
    'is_member',        v_member,
    'is_admin_member',  v_admin,
    'is_manager',       v_manager,
    'is_deleter',       v_deleter,
    'my_role',          v_role,
    'my_period_id',     v_period,
    'had_period',       exists (
      select 1 from public.society_group_membership_periods per
      where per.conversation_id = p_conversation_id and per.profile_id = v_uid),
    'admin_count',      v_admins,
    'people_count',     v_people,
    'caps', jsonb_build_object(
      'can_view_info',           v_member or v_manager or v_deleter,
      'can_access_conversation', v_member,
      'can_edit_name',           v_active and (v_admin or v_manager),
      'can_edit_avatar',         v_active and (v_admin or v_manager),
      'can_edit_team',           v_active and v_manager,
      'can_view_people',         v_member or v_manager,
      'can_manage_people',       (v_active and (v_admin or v_manager)) or v_recover,
      'can_manage_admins',       (v_active and (v_admin or v_manager)) or v_recover,
      'can_leave',               v_member,
      'can_archive',             v_active and (v_admin or v_manager),
      'can_reactivate',          v_arch and v_admins >= 1 and (v_admin or v_manager),
      'can_delete',              v_deleter,
      'can_recover',             v_recover
    )
  );
end;
$$;

/** Rifiuto di un comando non autorizzato: ARCHIVED se l'actor avrebbe potuto, altrimenti FORBIDDEN. */
create or replace function public.society_group_deny(
  p_caps            jsonb,
  p_archived_aware  boolean default true
)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if p_archived_aware
     and p_caps ->> 'status' = 'archived'
     and ((p_caps ->> 'is_admin_member')::boolean or (p_caps ->> 'is_manager')::boolean) then
    raise exception 'SOCIETY_GROUP_ARCHIVED';
  end if;

  raise exception 'SOCIETY_GROUP_FORBIDDEN';
end;
$$;

/**
 * Apertura di ogni comando: lock `for update` sulla riga del gruppo, replay
 * della ricevuta, capability calcolate dopo il lock. `o_replay` non nullo =
 * rispondere con quello. Non trovato, eliminato (a chi non lo conosceva) e
 * non autorizzato a vedere sono la stessa risposta (§25, QA-029).
 */
create or replace function public.society_group_cmd_open(
  p_conversation_id uuid,
  p_operation       text,
  p_key             text,
  p_fingerprint     text,
  out o_replay      jsonb,
  out o_caps        jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pre jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_key is null or length(btrim(p_key)) < 8 then
    raise exception 'SOCIETY_GROUP_INVALID:operation_key';
  end if;

  /* Autorizzazione economica **prima** del lock: chi non ha alcuna relazione
     con il gruppo (non membro, nessun periodo, nessuna capability) non può
     accodarsi sulla riga di un UUID arbitrario né sondarne l'esistenza. Dopo
     il lock tutto viene ricalcolato (la riga può essere cambiata nell'attesa). */
  v_pre := public.society_group_caps(p_conversation_id);

  if v_pre is null
     or ((v_pre ->> 'deleted')::boolean and not (v_pre ->> 'known')::boolean)
     or (not (v_pre ->> 'deleted')::boolean
         and not coalesce((v_pre -> 'caps' ->> 'can_view_info')::boolean, false)
         and not coalesce((v_pre ->> 'is_member')::boolean, false)
         and not coalesce((v_pre ->> 'had_period')::boolean, false)) then
    raise exception 'SOCIETY_GROUP_NOT_FOUND';
  end if;

  perform 1 from public.society_groups g
  where g.conversation_id = p_conversation_id
  for update;

  if not found then
    raise exception 'SOCIETY_GROUP_NOT_FOUND';
  end if;

  o_replay := public.society_group_operation_replay(p_key, p_conversation_id, p_operation, p_fingerprint);
  o_caps   := public.society_group_caps(p_conversation_id);

  /* Comandi che per definizione tolgono l'accesso all'actor: il retry
     restituisce l'esito registrato (la ricevuta è comunque legata all'actor). */
  if o_replay is not null and p_operation in ('delete', 'leave', 'leave_with_handover') then
    return;
  end if;

  if (o_caps ->> 'deleted')::boolean then
    raise exception '%', case when (o_caps ->> 'known')::boolean
                              then 'SOCIETY_GROUP_DELETED' else 'SOCIETY_GROUP_NOT_FOUND' end;
  end if;

  if p_operation not in ('leave', 'leave_with_handover')
     and not coalesce((o_caps -> 'caps' ->> 'can_view_info')::boolean, false)
     and not coalesce((o_caps ->> 'is_member')::boolean, false) then
    raise exception 'SOCIETY_GROUP_NOT_FOUND';
  end if;
end;
$$;

/** Evento di sistema (§24), dentro la finestra di comando; null se già pubblicato. */
create or replace function public.society_group_emit_event(
  p_conversation_id uuid,
  p_type            text,
  p_payload         jsonb,
  p_dedup_key       text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq bigint;
begin
  insert into public.messages
    (conversation_id, sender_profile_id, body, message_kind,
     system_event_type, system_payload, system_dedup_key)
  values
    (p_conversation_id, null, '', 'system_event', p_type, p_payload, p_dedup_key)
  on conflict (conversation_id, system_dedup_key) where system_dedup_key is not null
  do nothing
  returning seq into v_seq;

  return v_seq;
end;
$$;

revoke all on function public.society_group_person_maintains(uuid, uuid) from public, anon, authenticated;
revoke all on function public.society_group_add_scope(uuid, uuid, boolean, boolean) from public, anon, authenticated;
revoke all on function public.society_group_role_label(uuid, uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.society_group_caps(uuid) from public, anon, authenticated;
revoke all on function public.society_group_deny(jsonb, boolean) from public, anon, authenticated;
revoke all on function public.society_group_cmd_open(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.society_group_emit_event(uuid, text, jsonb, text) from public, anon, authenticated;


-- ============================================================
-- SEZIONE 2 — avatar: upload e registrazione per ADMIN interni (§10)
-- ============================================================

/**
 * Chi può caricare/registrare un'immagine per la Società: chi crea gruppi, chi
 * li gestisce, o chi è ADMIN di un gruppo ACTIVE della Società. Il percorso
 * non identifica il gruppo: il controllo di legame (stessa Società, autore) è
 * in `society_group_set_avatar`.
 */
create or replace function public.society_group_avatar_authorized(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and p_club_id is not null and (
    'groups_create' = any (public.dashboard_club_capabilities(p_club_id))
    or 'groups_manage' = any (public.dashboard_club_capabilities(p_club_id))
    or exists (
      select 1
      from public.society_groups g
      join public.conversation_participants cp
        on cp.conversation_id = g.conversation_id
       and cp.profile_id = auth.uid()
       and cp.member_role = 'admin'
      where g.club_id = p_club_id
        and g.status = 'active'
        and g.deleted_at is null
    )
  );
$$;

revoke all on function public.society_group_avatar_authorized(uuid) from public, anon;
grant execute on function public.society_group_avatar_authorized(uuid) to authenticated;

/** Riemessa da 20261112090000: stessa lettura del percorso, nuova autorizzazione. */
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

  return public.society_group_avatar_authorized(v_club);
end;
$$;

revoke all on function public.society_group_avatar_can_upload(text) from public;
revoke execute on function public.society_group_avatar_can_upload(text) from anon;
grant execute on function public.society_group_avatar_can_upload(text) to authenticated;

/* Riemessa da 20261112090000: la stessa registrazione, con l'autorizzazione estesa
   agli ADMIN interni e a chi ha groups_manage. */
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
     or not public.society_group_avatar_authorized(p_club_id) then
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


/* Riemessa da 20261112090000 (ultima definizione): un gruppo eliminato non
   serve più la sua immagine (§23). */
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

  /* §23: un gruppo con tombstone non serve più la sua immagine, anche prima
     che il cleanup la scolleghi. */
  if v_group.deleted_at is not null then
    return false;
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

-- ============================================================
-- SEZIONE 3 — letture del Centro (§10, §11, §21)
-- ============================================================

/* Riemessa da 20261112090000 con `deleted_at is null`: un gruppo eliminato
   sparisce subito dal Centro (§23). */
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
      and g.deleted_at is null
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
 * Riemessa da 20261112090000. Cambia: serve anche i gruppi ARCHIVED (la lista
 * Archiviati lo apre), esclude gli eliminati, `can_manage` è reale (chi ha una
 * capability di gestione sul gruppo, §11) e restituisce `status`, `version`,
 * `archived_at`, `created_at`. Non trovato e non autorizzato restano la stessa
 * risposta.
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
  v_uid  uuid := auth.uid();
  v_row  record;
  v_caps jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select g.conversation_id, g.club_id, g.team_id, g.name, g.status, g.version,
         g.archived_at, g.created_at,
         t.name as team_name, c.name as club_name, a.storage_path as avatar_path
  into v_row
  from public.society_groups g
  join public.clubs c on c.id = g.club_id
  left join public.club_teams t on t.id = g.team_id
  left join public.society_group_avatar_assets a on a.id = g.avatar_asset_id
  where g.conversation_id = p_conversation_id
    and g.club_id = p_club_id
    and g.deleted_at is null;

  if v_row.conversation_id is null
     or not public.society_group_can(v_row.club_id, v_row.team_id, 'view') then
    raise exception 'SOCIETY_GROUP_NOT_FOUND';
  end if;

  v_caps := public.society_group_caps(p_conversation_id);

  return jsonb_build_object(
    'conversation_id', v_row.conversation_id,
    'club_id',         v_row.club_id,
    'club_name',       v_row.club_name,
    'name',            v_row.name,
    'team_id',         v_row.team_id,
    'team_name',       v_row.team_name,
    'avatar_path',     v_row.avatar_path,
    'status',          v_row.status,
    'version',         v_row.version,
    'archived_at',     v_row.archived_at,
    'created_at',      v_row.created_at,
    'people_count',    (select count(*) from public.conversation_participants cp
                         where cp.conversation_id = v_row.conversation_id),
    'admin_count',     (select count(*) from public.conversation_participants cp
                         where cp.conversation_id = v_row.conversation_id
                           and cp.member_role = 'admin'),
    'can_open_conversation', exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = v_row.conversation_id and cp.profile_id = v_uid),
    'can_manage', coalesce((v_caps ->> 'is_manager')::boolean, false)
               or coalesce((v_caps ->> 'is_deleter')::boolean, false)
               or coalesce((v_caps ->> 'is_admin_member')::boolean, false)
  );
end;
$$;

revoke all on function public.fetch_society_group_detail(uuid, uuid) from public;
revoke execute on function public.fetch_society_group_detail(uuid, uuid) from anon;
grant execute on function public.fetch_society_group_detail(uuid, uuid) to authenticated;


-- ============================================================
-- SEZIONE 4 — letture di gestione (§9, §12, §13, §19, §21)
--
-- Proiezioni amministrative: nessun body, mittente, anteprima, unread,
-- allegato o preferenza chat (DoD-05). Nemmeno per chi è anche membro.
-- ============================================================

create or replace function public.fetch_society_group_management(p_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caps jsonb;
  v_c    jsonb;
  v_row  record;
  v_path text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_caps := public.society_group_caps(p_conversation_id);

  if v_caps is null then
    raise exception 'SOCIETY_GROUP_NOT_FOUND';
  end if;

  if (v_caps ->> 'deleted')::boolean then
    raise exception '%', case when (v_caps ->> 'known')::boolean
                              then 'SOCIETY_GROUP_DELETED' else 'SOCIETY_GROUP_NOT_FOUND' end;
  end if;

  v_c := v_caps -> 'caps';

  if not (v_c ->> 'can_view_info')::boolean then
    raise exception 'SOCIETY_GROUP_NOT_FOUND';
  end if;

  select g.club_id, g.team_id, g.name, g.status, g.version, g.created_at, g.archived_at,
         cl.name as club_name, t.name as team_name, a.storage_path as avatar_path
  into v_row
  from public.society_groups g
  join public.clubs cl on cl.id = g.club_id
  left join public.club_teams t on t.id = g.team_id
  left join public.society_group_avatar_assets a on a.id = g.avatar_asset_id
  where g.conversation_id = p_conversation_id;

  /* Percorso di uscita (§18, §19) già calcolato dal server. */
  v_path := case
    when not (v_caps ->> 'is_member')::boolean then null
    when v_caps ->> 'status' = 'archived' then 'ordinary'
    when v_caps ->> 'my_role' = 'member' then 'ordinary'
    when (v_caps ->> 'admin_count')::int >= 2 then 'ordinary'
    when (v_caps ->> 'people_count')::int = 1 then 'add_people_first'
    else 'handover'
  end;

  return jsonb_build_object(
    'conversation_id',  p_conversation_id,
    'club_id',          v_row.club_id,
    'club_name',        v_row.club_name,
    'name',             v_row.name,
    'avatar_path',      v_row.avatar_path,
    'team_id',          v_row.team_id,
    'team_name',        v_row.team_name,
    'status',           v_row.status,
    'version',          v_row.version,
    'created_at',       v_row.created_at,
    'archived_at',      v_row.archived_at,
    'people_count',     (v_caps ->> 'people_count')::int,
    'admin_count',      (v_caps ->> 'admin_count')::int,
    'my_role',          v_caps ->> 'my_role',
    'my_period_id',     v_caps ->> 'my_period_id',
    'my_period_version', (select per.version from public.society_group_membership_periods per
                          where per.id = (v_caps ->> 'my_period_id')::uuid),
    'leave_path',       v_path,
    'capabilities',     v_c,
    'limits',           public.society_group_limits()
  );
end;
$$;

/**
 * Persone attuali (§12): solo membership attive, admin prima, poi le altre;
 * ricerca normalizzata sul nome, cursore stabile, conteggi dal server. Ogni
 * riga dice anche quali azioni l'actor può fare su di lei.
 */
create or replace function public.fetch_society_group_members_page(
  p_conversation_id uuid,
  p_query           text default null,
  p_cursor          text default null,
  p_limit           integer default 40
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_caps   jsonb;
  v_c      jsonb;
  v_query  text := nullif(public.footme_normalize_lookup(p_query), '');
  v_limit  integer := least(greatest(coalesce(p_limit, 40), 1), 100);
  v_cursor jsonb := public.society_group_cursor_decode(p_cursor);
  v_team   uuid;
  v_active boolean;
  v_rows   jsonb;
  v_more   boolean;
  v_last   jsonb;
  v_club   uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_caps := public.society_group_caps(p_conversation_id);

  if v_caps is null then
    raise exception 'SOCIETY_GROUP_NOT_FOUND';
  end if;

  if (v_caps ->> 'deleted')::boolean then
    raise exception '%', case when (v_caps ->> 'known')::boolean
                              then 'SOCIETY_GROUP_DELETED' else 'SOCIETY_GROUP_NOT_FOUND' end;
  end if;

  v_c := v_caps -> 'caps';

  if not (v_c ->> 'can_view_info')::boolean then
    raise exception 'SOCIETY_GROUP_NOT_FOUND';
  end if;

  if not (v_c ->> 'can_view_people')::boolean then
    raise exception 'SOCIETY_GROUP_FORBIDDEN';
  end if;

  v_club   := (v_caps ->> 'club_id')::uuid;
  v_team   := (v_caps ->> 'team_id')::uuid;
  v_active := v_caps ->> 'status' = 'active';

  with m as (
    select
      cp.profile_id,
      cp.period_id,
      per.version                                   as period_version,
      cp.member_role,
      case when cp.member_role = 'admin' then 0 else 1 end as sort_rank,
      p.full_name,
      p.avatar_url,
      public.footme_normalize_lookup(p.full_name)   as name_norm
    from public.conversation_participants cp
    join public.profiles p on p.id = cp.profile_id
    left join public.society_group_membership_periods per on per.id = cp.period_id
    where cp.conversation_id = p_conversation_id
  ),
  filtered as (
    select * from m
    where v_query is null or m.name_norm like '%' || v_query || '%'
  ),
  paged as (
    select f.*
    from filtered f
    where v_cursor is null
       or (f.sort_rank, f.name_norm, f.profile_id::text)
          > ((v_cursor ->> 'r')::int, v_cursor ->> 'n', v_cursor ->> 'id')
    order by f.sort_rank, f.name_norm, f.profile_id::text
    limit v_limit + 1
  )
  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_rank, x.name_norm, x.profile_id::text), '[]'::jsonb)
  into v_rows
  from paged x;

  v_more := jsonb_array_length(v_rows) > v_limit;

  if v_more then
    v_rows := v_rows - v_limit;
  end if;

  v_last := v_rows -> (jsonb_array_length(v_rows) - 1);

  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'profile_id',     r ->> 'profile_id',
        'period_id',      r ->> 'period_id',
        'period_version', r -> 'period_version',
        'full_name',      r ->> 'full_name',
        'avatar_url',     r ->> 'avatar_url',
        'role_label',     public.society_group_role_label(v_club, (r ->> 'profile_id')::uuid, v_team, null),
        'member_role',    r ->> 'member_role',
        'is_me',          (r ->> 'profile_id')::uuid = v_uid,
        'can_promote',    (v_c ->> 'can_manage_admins')::boolean and r ->> 'member_role' = 'member',
        'can_demote',     (v_c ->> 'can_manage_admins')::boolean and v_active and r ->> 'member_role' = 'admin',
        'can_remove',     (v_c ->> 'can_manage_people')::boolean and v_active
                          and (r ->> 'profile_id')::uuid <> v_uid
      ) order by ord)
      from jsonb_array_elements(v_rows) with ordinality as e(r, ord)
    ), '[]'::jsonb),
    'next_cursor', case when v_more and v_last is not null then
      public.society_group_cursor_encode(jsonb_build_object(
        'r',  (v_last ->> 'sort_rank')::int,
        'n',  v_last ->> 'name_norm',
        'id', v_last ->> 'profile_id'))
      else null end,
    'admin_count',  (v_caps ->> 'admin_count')::int,
    'other_count',  (v_caps ->> 'people_count')::int - (v_caps ->> 'admin_count')::int,
    'people_count', (v_caps ->> 'people_count')::int,
    'status',       v_caps ->> 'status',
    'capabilities', v_c
  );
end;
$$;

/**
 * Persone aggiungibili (§13): predicate di M32, perimetro dell'actor, già
 * attivi esclusi. In recovery (§22) è la stessa lista. Con una Squadra, prima
 * le sue persone; `team_total` serve a «Seleziona tutti».
 */
create or replace function public.fetch_society_group_eligible_page(
  p_conversation_id uuid,
  p_query           text default null,
  p_cursor          text default null,
  p_limit           integer default 40
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_caps   jsonb;
  v_club   uuid;
  v_team   uuid;
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

  v_caps := public.society_group_caps(p_conversation_id);

  if v_caps is null then
    raise exception 'SOCIETY_GROUP_NOT_FOUND';
  end if;

  if (v_caps ->> 'deleted')::boolean then
    raise exception '%', case when (v_caps ->> 'known')::boolean
                              then 'SOCIETY_GROUP_DELETED' else 'SOCIETY_GROUP_NOT_FOUND' end;
  end if;

  if not (v_caps -> 'caps' ->> 'can_view_info')::boolean then
    raise exception 'SOCIETY_GROUP_NOT_FOUND';
  end if;

  if not (v_caps -> 'caps' ->> 'can_manage_people')::boolean then
    perform public.society_group_deny(v_caps);
  end if;

  v_club  := (v_caps ->> 'club_id')::uuid;
  v_team  := (v_caps ->> 'team_id')::uuid;
  v_scope := public.society_group_add_scope(v_club, v_team,
               (v_caps ->> 'is_manager')::boolean, (v_caps ->> 'is_admin_member')::boolean);

  with people as (
    select distinct a.profile_id
    from public.club_member_assignments a
    where a.club_id = v_club
      and a.status = 'active'
      and not exists (
        select 1 from public.conversation_participants cp
        where cp.conversation_id = p_conversation_id and cp.profile_id = a.profile_id
      )
  ),
  eligible as (
    select
      p.id                                                  as profile_id,
      p.full_name,
      p.avatar_url,
      public.footme_normalize_lookup(p.full_name)           as name_norm,
      public.society_group_person_in_team(v_club, p.id, v_team)::int as in_team,
      public.society_group_role_label(v_club, p.id, v_team, v_scope) as role_label
    from people x
    join public.profiles p on p.id = x.profile_id
    where public.society_group_person_eligible(v_club, p.id)
      and public.society_group_person_visible(v_club, p.id, v_scope)
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
  select coalesce(jsonb_agg(to_jsonb(p) order by 1 - p.in_team, p.name_norm, p.profile_id::text), '[]'::jsonb)
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
    'team_total', case when v_team is null then 0 else (
      select count(distinct a.profile_id)::int
      from public.club_member_assignments a
      where a.club_id = v_club
        and a.team_id = v_team
        and a.status = 'active'
        and not exists (
          select 1 from public.conversation_participants cp
          where cp.conversation_id = p_conversation_id and cp.profile_id = a.profile_id)
        and public.society_group_person_eligible(v_club, a.profile_id)
        and public.society_group_person_visible(v_club, a.profile_id, v_scope)
    ) end,
    'active_count', (v_caps ->> 'people_count')::int,
    'limits', public.society_group_limits()
  );
end;
$$;

/** «Seleziona tutti» (§13): ids della Squadra del gruppo, oltre la pagina; rifiuta se supera il massimo. */
create or replace function public.fetch_society_group_eligible_team_ids(p_conversation_id uuid)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caps  jsonb;
  v_club  uuid;
  v_team  uuid;
  v_scope uuid[];
  v_ids   uuid[];
  v_room  integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_caps := public.society_group_caps(p_conversation_id);

  if v_caps is null or (v_caps ->> 'deleted')::boolean
     or not (v_caps -> 'caps' ->> 'can_view_info')::boolean then
    raise exception 'SOCIETY_GROUP_NOT_FOUND';
  end if;

  if not (v_caps -> 'caps' ->> 'can_manage_people')::boolean then
    perform public.society_group_deny(v_caps);
  end if;

  v_club := (v_caps ->> 'club_id')::uuid;
  v_team := (v_caps ->> 'team_id')::uuid;

  if v_team is null then
    return array[]::uuid[];
  end if;

  v_scope := public.society_group_add_scope(v_club, v_team,
               (v_caps ->> 'is_manager')::boolean, (v_caps ->> 'is_admin_member')::boolean);
  v_room  := (public.society_group_limits() ->> 'maxPeople')::int - (v_caps ->> 'people_count')::int;

  select coalesce(array_agg(x.profile_id order by x.profile_id), array[]::uuid[])
  into v_ids
  from (
    select distinct a.profile_id
    from public.club_member_assignments a
    where a.club_id = v_club
      and a.team_id = v_team
      and a.status = 'active'
      and not exists (
        select 1 from public.conversation_participants cp
        where cp.conversation_id = p_conversation_id and cp.profile_id = a.profile_id)
      and public.society_group_person_eligible(v_club, a.profile_id)
      and public.society_group_person_visible(v_club, a.profile_id, v_scope)
  ) x;

  if coalesce(array_length(v_ids, 1), 0) > v_room then
    raise exception 'SOCIETY_GROUP_TOO_MANY_PEOPLE';
  end if;

  return v_ids;
end;
$$;

/** Squadre di destinazione (§11): reali, attive, della Società, nello scope `groups_manage`. */
create or replace function public.fetch_society_group_team_options(p_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caps jsonb;
  v_club uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_caps := public.society_group_caps(p_conversation_id);

  if v_caps is null or (v_caps ->> 'deleted')::boolean
     or not (v_caps -> 'caps' ->> 'can_view_info')::boolean then
    raise exception 'SOCIETY_GROUP_NOT_FOUND';
  end if;

  if not (v_caps -> 'caps' ->> 'can_edit_team')::boolean then
    perform public.society_group_deny(v_caps);
  end if;

  v_club := (v_caps ->> 'club_id')::uuid;

  return jsonb_build_object(
    'current_team_id',  v_caps ->> 'team_id',
    'can_clear',        public.society_group_can(v_club, null, 'manage'),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object('team_id', t.id, 'team_name', t.name)
                       order by t.sort_order, t.name, t.id)
      from public.club_teams t
      where t.club_id = v_club
        and public.club_team_is_assignable(v_club, t.id)
        and public.society_group_can(v_club, t.id, 'manage')
    ), '[]'::jsonb)
  );
end;
$$;

/**
 * Gruppi archiviati della Società (§21): amministrativa, senza anteprime né
 * attività chat, ordinata dal più recente. Ogni riga dice se serve il
 * recupero (zero ADMIN) e quali azioni di gestione l'actor ha.
 */
create or replace function public.fetch_society_groups_archived_page(
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
      g.team_id,
      t.name                                   as team_name,
      a.storage_path                           as avatar_path,
      g.archived_at,
      (select count(*)::int from public.conversation_participants cp
        where cp.conversation_id = g.conversation_id) as people_count,
      (select count(*)::int from public.conversation_participants cp
        where cp.conversation_id = g.conversation_id and cp.member_role = 'admin') as admin_count,
      public.society_group_can(g.club_id, g.team_id, 'manage') as can_manage,
      public.society_group_can(g.club_id, g.team_id, 'delete') as can_delete
    from public.society_groups g
    left join public.club_teams t on t.id = g.team_id
    left join public.society_group_avatar_assets a on a.id = g.avatar_asset_id
    where g.club_id = p_club_id
      and g.status = 'archived'
      and g.deleted_at is null
      and public.society_group_can(g.club_id, g.team_id, 'view')
      and (v_query is null or g.name_norm like '%' || v_query || '%')
  ),
  paged as (
    select *
    from visible v
    where v_cursor is null
       or (v.archived_at, v.conversation_id::text)
          < ((v_cursor ->> 'a')::timestamptz, v_cursor ->> 'id')
    order by v.archived_at desc, v.conversation_id::text desc
    limit v_limit + 1
  )
  select coalesce(jsonb_agg(to_jsonb(p) order by p.archived_at desc, p.conversation_id::text desc), '[]'::jsonb)
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
        'archived_at',     r -> 'archived_at',
        'people_count',    r -> 'people_count',
        'admin_count',     r -> 'admin_count',
        'needs_recovery',  (r ->> 'admin_count')::int = 0,
        'can_manage',      (r ->> 'can_manage')::boolean,
        'can_delete',      (r ->> 'can_delete')::boolean) order by ord)
      from jsonb_array_elements(v_rows) with ordinality as e(r, ord)
    ), '[]'::jsonb),
    'next_cursor', case when v_more and v_last is not null then
      public.society_group_cursor_encode(jsonb_build_object(
        'a',  v_last ->> 'archived_at',
        'id', v_last ->> 'conversation_id'))
      else null end
  );
end;
$$;

/**
 * Candidati alla successione (§19): MEMBER attivi diversi dall'actor che
 * mantengono ancora un titolo valido. Solo per l'ADMIN di un gruppo ACTIVE.
 */
create or replace function public.fetch_society_group_handover_candidates(
  p_conversation_id uuid,
  p_query           text default null,
  p_cursor          text default null,
  p_limit           integer default 40
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_caps   jsonb;
  v_club   uuid;
  v_team   uuid;
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

  v_caps := public.society_group_caps(p_conversation_id);

  if v_caps is null or (v_caps ->> 'deleted')::boolean
     or not (v_caps ->> 'is_member')::boolean then
    raise exception 'SOCIETY_GROUP_NOT_FOUND';
  end if;

  if v_caps ->> 'status' <> 'active' or v_caps ->> 'my_role' <> 'admin' then
    raise exception 'SOCIETY_GROUP_HANDOVER_NOT_REQUIRED';
  end if;

  v_club := (v_caps ->> 'club_id')::uuid;
  v_team := (v_caps ->> 'team_id')::uuid;

  with c as (
    select
      cp.profile_id,
      cp.period_id,
      p.full_name,
      p.avatar_url,
      public.footme_normalize_lookup(p.full_name) as name_norm
    from public.conversation_participants cp
    join public.profiles p on p.id = cp.profile_id
    where cp.conversation_id = p_conversation_id
      and cp.profile_id <> v_uid
      and cp.member_role = 'member'
      and public.society_group_person_maintains(v_club, cp.profile_id)
      and (v_query is null or public.footme_normalize_lookup(p.full_name) like '%' || v_query || '%')
  ),
  paged as (
    select * from c
    where v_cursor is null
       or (c.name_norm, c.profile_id::text) > (v_cursor ->> 'n', v_cursor ->> 'id')
    order by c.name_norm, c.profile_id::text
    limit v_limit + 1
  )
  select coalesce(jsonb_agg(to_jsonb(p) order by p.name_norm, p.profile_id::text), '[]'::jsonb)
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
        'period_id',  r -> 'period_id',
        'full_name',  r -> 'full_name',
        'avatar_url', r -> 'avatar_url',
        'role_label', public.society_group_role_label(v_club, (r ->> 'profile_id')::uuid, v_team, null)
      ) order by ord)
      from jsonb_array_elements(v_rows) with ordinality as e(r, ord)
    ), '[]'::jsonb),
    'next_cursor', case when v_more and v_last is not null then
      public.society_group_cursor_encode(jsonb_build_object(
        'n',  v_last ->> 'name_norm',
        'id', v_last ->> 'profile_id'))
      else null end
  );
end;
$$;


-- ============================================================
-- SEZIONE 5 — comandi sui metadata (§10, §11, §21, §22, §23)
-- ============================================================

/** Rinomina (§10): patch del solo nome, evento solo se il valore normalizzato cambia. */
create or replace function public.society_group_rename(
  p_conversation_id  uuid,
  p_name             text,
  p_expected_version integer,
  p_operation_key    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_name    text := public.society_group_clean_name(p_name);
  v_fp      text := md5(jsonb_build_object('name', v_name, 'v', p_expected_version)::text);
  v_limits  jsonb := public.society_group_limits();
  v_open    record;
  v_caps    jsonb;
  v_g       public.society_groups%rowtype;
  v_version integer;
  v_res     jsonb;
begin
  select * into v_open from public.society_group_cmd_open(p_conversation_id, 'rename', p_operation_key, v_fp);

  if v_open.o_replay is not null then
    return v_open.o_replay || jsonb_build_object('replayed', true);
  end if;

  v_caps := v_open.o_caps;

  if not (v_caps -> 'caps' ->> 'can_edit_name')::boolean then
    perform public.society_group_deny(v_caps);
  end if;

  if v_name is null then
    raise exception 'SOCIETY_GROUP_INVALID:name_required';
  end if;

  if char_length(v_name) > (v_limits ->> 'nameMax')::int then
    raise exception 'SOCIETY_GROUP_INVALID:name_too_long';
  end if;

  if v_name ~ '[[:cntrl:]]' then
    raise exception 'SOCIETY_GROUP_INVALID:name_invalid';
  end if;

  select * into v_g from public.society_groups g where g.conversation_id = p_conversation_id;

  if p_expected_version is distinct from v_g.version then
    raise exception 'SOCIETY_GROUP_VERSION_CONFLICT';
  end if;

  if v_name = v_g.name then
    v_res := jsonb_build_object('conversation_id', p_conversation_id, 'version', v_g.version,
                                'name', v_g.name, 'changed', false);
  else
    perform public.society_group_window_open(p_conversation_id);

    update public.society_groups g set name = v_name
    where g.conversation_id = p_conversation_id
    returning g.version into v_version;

    update public.conversations c set title = v_name where c.id = p_conversation_id;

    perform public.society_group_emit_event(p_conversation_id, 'GROUP_RENAMED',
      jsonb_build_object('name', v_name), 'rename:' || p_operation_key);

    perform public.society_group_audit_record(p_conversation_id, v_g.club_id, v_uid, 'RENAME',
      null, null, v_version, jsonb_build_object('fields', jsonb_build_array('name')));

    perform public.society_group_window_close();

    v_res := jsonb_build_object('conversation_id', p_conversation_id, 'version', v_version,
                                'name', v_name, 'changed', true);
  end if;

  perform public.society_group_operation_record(p_operation_key, v_g.club_id, p_conversation_id,
    'rename', v_fp, v_res);

  return v_res;
end;
$$;

/** Immagine (§10): asset dell'actor e della stessa Società; null = fallback del gruppo. Nessun evento. */
create or replace function public.society_group_set_avatar(
  p_conversation_id  uuid,
  p_asset_id         uuid,
  p_expected_version integer,
  p_operation_key    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_fp      text := md5(jsonb_build_object('asset', p_asset_id, 'v', p_expected_version)::text);
  v_open    record;
  v_caps    jsonb;
  v_g       public.society_groups%rowtype;
  v_asset   public.society_group_avatar_assets;
  v_version integer;
  v_res     jsonb;
begin
  select * into v_open from public.society_group_cmd_open(p_conversation_id, 'set_avatar', p_operation_key, v_fp);

  if v_open.o_replay is not null then
    return v_open.o_replay || jsonb_build_object('replayed', true);
  end if;

  v_caps := v_open.o_caps;

  if not (v_caps -> 'caps' ->> 'can_edit_avatar')::boolean then
    perform public.society_group_deny(v_caps);
  end if;

  select * into v_g from public.society_groups g where g.conversation_id = p_conversation_id;

  if p_expected_version is distinct from v_g.version then
    raise exception 'SOCIETY_GROUP_VERSION_CONFLICT';
  end if;

  if p_asset_id is not null then
    select * into v_asset
    from public.society_group_avatar_assets a
    where a.id = p_asset_id
    for update;

    if v_asset.id is null
       or v_asset.club_id <> v_g.club_id
       or v_asset.created_by <> v_uid
       or exists (
         select 1 from public.society_groups o
         where o.avatar_asset_id = v_asset.id and o.conversation_id <> p_conversation_id
       ) then
      raise exception 'SOCIETY_GROUP_INVALID:avatar_invalid';
    end if;
  end if;

  if v_g.avatar_asset_id is not distinct from p_asset_id then
    v_res := jsonb_build_object('conversation_id', p_conversation_id, 'version', v_g.version,
                                'changed', false);
  else
    update public.society_groups g set avatar_asset_id = p_asset_id
    where g.conversation_id = p_conversation_id
    returning g.version into v_version;

    perform public.society_group_audit_record(p_conversation_id, v_g.club_id, v_uid, 'SET_AVATAR',
      null, null, v_version, jsonb_build_object('fields', jsonb_build_array('avatar'),
                                                'removed', p_asset_id is null));

    v_res := jsonb_build_object('conversation_id', p_conversation_id, 'version', v_version,
                                'changed', true);
  end if;

  perform public.society_group_operation_record(p_operation_key, v_g.club_id, p_conversation_id,
    'set_avatar', v_fp, v_res);

  return v_res;
end;
$$;

/**
 * Squadra (§11): `groups_manage` sullo scope di origine (già nel resolver) E di
 * destinazione; null solo con scope societario. Una destinazione non più
 * valida lascia il riferimento precedente (errore controllato, nessuna
 * conversione silenziosa in null). Non tocca persone, periodi, messaggi.
 */
create or replace function public.society_group_set_team(
  p_conversation_id  uuid,
  p_team_id          uuid,
  p_expected_version integer,
  p_operation_key    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_fp      text := md5(jsonb_build_object('team', p_team_id, 'v', p_expected_version)::text);
  v_open    record;
  v_caps    jsonb;
  v_g       public.society_groups%rowtype;
  v_version integer;
  v_res     jsonb;
begin
  select * into v_open from public.society_group_cmd_open(p_conversation_id, 'set_team', p_operation_key, v_fp);

  if v_open.o_replay is not null then
    return v_open.o_replay || jsonb_build_object('replayed', true);
  end if;

  v_caps := v_open.o_caps;

  if not (v_caps -> 'caps' ->> 'can_edit_team')::boolean then
    perform public.society_group_deny(v_caps);
  end if;

  select * into v_g from public.society_groups g where g.conversation_id = p_conversation_id;

  if p_expected_version is distinct from v_g.version then
    raise exception 'SOCIETY_GROUP_VERSION_CONFLICT';
  end if;

  if v_g.team_id is not distinct from p_team_id then
    v_res := jsonb_build_object('conversation_id', p_conversation_id, 'version', v_g.version,
                                'changed', false);
  else
    if p_team_id is not null then
      perform 1 from public.club_teams t
      where t.id = p_team_id and t.club_id = v_g.club_id
      for share;

      if not found or not public.club_team_is_assignable(v_g.club_id, p_team_id) then
        raise exception 'SOCIETY_GROUP_TEAM_UNAVAILABLE';
      end if;
    end if;

    if not public.society_group_can(v_g.club_id, p_team_id, 'manage') then
      raise exception 'SOCIETY_GROUP_FORBIDDEN';
    end if;

    update public.society_groups g set team_id = p_team_id
    where g.conversation_id = p_conversation_id
    returning g.version into v_version;

    perform public.society_group_audit_record(p_conversation_id, v_g.club_id, v_uid, 'SET_TEAM',
      null, null, v_version,
      jsonb_build_object('from_team', v_g.team_id, 'to_team', p_team_id));

    v_res := jsonb_build_object('conversation_id', p_conversation_id, 'version', v_version,
                                'changed', true);
  end if;

  perform public.society_group_operation_record(p_operation_key, v_g.club_id, p_conversation_id,
    'set_team', v_fp, v_res);

  return v_res;
end;
$$;

/** Archivia (§21): ACTIVE → ARCHIVED, stesso ID e membership; evento GROUP_ARCHIVED. */
create or replace function public.society_group_archive(
  p_conversation_id  uuid,
  p_expected_version integer,
  p_operation_key    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_fp      text := md5(jsonb_build_object('v', p_expected_version)::text);
  v_open    record;
  v_caps    jsonb;
  v_g       public.society_groups%rowtype;
  v_version integer;
  v_res     jsonb;
begin
  select * into v_open from public.society_group_cmd_open(p_conversation_id, 'archive', p_operation_key, v_fp);

  if v_open.o_replay is not null then
    return v_open.o_replay || jsonb_build_object('replayed', true);
  end if;

  v_caps := v_open.o_caps;

  if not (v_caps -> 'caps' ->> 'can_archive')::boolean then
    perform public.society_group_deny(v_caps);
  end if;

  select * into v_g from public.society_groups g where g.conversation_id = p_conversation_id;

  if p_expected_version is distinct from v_g.version then
    raise exception 'SOCIETY_GROUP_VERSION_CONFLICT';
  end if;

  perform public.society_group_window_open(p_conversation_id);

  update public.society_groups g
  set status = 'archived', archived_by = v_uid
  where g.conversation_id = p_conversation_id
  returning g.version into v_version;

  perform public.society_group_emit_event(p_conversation_id, 'GROUP_ARCHIVED',
    '{}'::jsonb, 'archive:' || p_operation_key);

  perform public.society_group_audit_record(p_conversation_id, v_g.club_id, v_uid, 'ARCHIVE',
    null, null, v_version, jsonb_build_object('from', 'active', 'to', 'archived'));

  perform public.society_group_window_close();

  v_res := jsonb_build_object('conversation_id', p_conversation_id, 'version', v_version,
                              'status', 'archived');

  perform public.society_group_operation_record(p_operation_key, v_g.club_id, p_conversation_id,
    'archive', v_fp, v_res);

  return v_res;
end;
$$;

/**
 * Riattiva (§22): ARCHIVED → ACTIVE. Richiede ADMIN interno o manager e,
 * **al commit**, almeno un ADMIN con periodo attivo che mantiene un titolo
 * valido; mai promozioni automatiche.
 */
create or replace function public.society_group_reactivate(
  p_conversation_id  uuid,
  p_expected_version integer,
  p_operation_key    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_fp      text := md5(jsonb_build_object('v', p_expected_version)::text);
  v_open    record;
  v_caps    jsonb;
  v_g       public.society_groups%rowtype;
  v_valid   integer;
  v_version integer;
  v_res     jsonb;
begin
  select * into v_open from public.society_group_cmd_open(p_conversation_id, 'reactivate', p_operation_key, v_fp);

  if v_open.o_replay is not null then
    return v_open.o_replay || jsonb_build_object('replayed', true);
  end if;

  v_caps := v_open.o_caps;

  if not ((v_caps ->> 'is_admin_member')::boolean or (v_caps ->> 'is_manager')::boolean) then
    perform public.society_group_deny(v_caps, false);
  end if;

  select * into v_g from public.society_groups g where g.conversation_id = p_conversation_id;

  if p_expected_version is distinct from v_g.version then
    raise exception 'SOCIETY_GROUP_VERSION_CONFLICT';
  end if;

  if v_g.status <> 'archived' then
    raise exception 'SOCIETY_GROUP_INVALID:not_archived';
  end if;

  select count(*)::int into v_valid
  from public.conversation_participants cp
  where cp.conversation_id = p_conversation_id
    and cp.member_role = 'admin'
    and public.society_group_person_maintains(v_g.club_id, cp.profile_id);

  if v_valid = 0 then
    raise exception 'SOCIETY_GROUP_REACTIVATE_REQUIRES_ADMIN';
  end if;

  perform public.society_group_window_open(p_conversation_id);

  update public.society_groups g set status = 'active'
  where g.conversation_id = p_conversation_id
  returning g.version into v_version;

  perform public.society_group_emit_event(p_conversation_id, 'GROUP_REACTIVATED',
    '{}'::jsonb, 'reactivate:' || p_operation_key);

  perform public.society_group_audit_record(p_conversation_id, v_g.club_id, v_uid, 'REACTIVATE',
    null, null, v_version, jsonb_build_object('from', 'archived', 'to', 'active', 'valid_admins', v_valid));

  perform public.society_group_window_close();

  v_res := jsonb_build_object('conversation_id', p_conversation_id, 'version', v_version,
                              'status', 'active');

  perform public.society_group_operation_record(p_operation_key, v_g.club_id, p_conversation_id,
    'reactivate', v_fp, v_res);

  return v_res;
end;
$$;

/**
 * Elimina (§23): tombstone atomico. Chiude tutti i periodi attivi con motivo
 * GROUP_DELETED e toglie le righe participant nella stessa transazione:
 * l'accesso è revocato subito, per tutti. Nessun evento visibile. Messaggi,
 * eventi e file si ripuliscono dopo (DB-3). Il retry restituisce l'esito.
 */
create or replace function public.society_group_delete(
  p_conversation_id  uuid,
  p_expected_version integer,
  p_operation_key    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_fp      text := md5(jsonb_build_object('v', p_expected_version)::text);
  v_open    record;
  v_caps    jsonb;
  v_g       public.society_groups%rowtype;
  v_closed  integer;
  v_version integer;
  v_res     jsonb;
begin
  select * into v_open from public.society_group_cmd_open(p_conversation_id, 'delete', p_operation_key, v_fp);

  if v_open.o_replay is not null then
    return v_open.o_replay || jsonb_build_object('replayed', true);
  end if;

  v_caps := v_open.o_caps;

  if not (v_caps -> 'caps' ->> 'can_delete')::boolean then
    perform public.society_group_deny(v_caps, false);
  end if;

  select * into v_g from public.society_groups g where g.conversation_id = p_conversation_id;

  if p_expected_version is distinct from v_g.version then
    raise exception 'SOCIETY_GROUP_VERSION_CONFLICT';
  end if;

  perform public.society_group_window_open(p_conversation_id, 'GROUP_DELETED');

  update public.society_groups g
  set deleted_at = timezone('utc', now()), deleted_by = v_uid
  where g.conversation_id = p_conversation_id
  returning g.version into v_version;

  delete from public.conversation_participants cp where cp.conversation_id = p_conversation_id;
  get diagnostics v_closed = row_count;

  perform public.society_group_audit_record(p_conversation_id, v_g.club_id, v_uid, 'DELETE',
    null, null, v_version, jsonb_build_object('status', v_g.status, 'periods_closed', v_closed));

  perform public.society_group_window_close();

  v_res := jsonb_build_object('conversation_id', p_conversation_id, 'deleted', true);

  perform public.society_group_operation_record(p_operation_key, v_g.club_id, p_conversation_id,
    'delete', v_fp, v_res);

  return v_res;
end;
$$;


-- ============================================================
-- SEZIONE 6 — comandi sulle persone (§13–§19, §22)
-- ============================================================

/**
 * Aggiunta batch (§13): atomica, un solo evento aggregato col conteggio reale,
 * nuovi periodi con boundary = seq dell'evento, ruolo MEMBER. I già attivi
 * sono un no-op lecito e dichiarato nel risultato; un target non più
 * aggiungibile fa fallire **tutto**: `SOCIETY_GROUP_TARGETS_UNAVAILABLE:<ids
 * non validi>`, con gli ids ancora validi nel DETAIL.
 */
create or replace function public.society_group_add_people(
  p_conversation_id uuid,
  p_person_ids      uuid[],
  p_operation_key   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_ids     uuid[];
  v_fp      text;
  v_open    record;
  v_caps    jsonb;
  v_club    uuid;
  v_team    uuid;
  v_scope   uuid[];
  v_active  uuid[];
  v_new     uuid[];
  v_invalid uuid[];
  v_valid   uuid[];
  v_max     integer := (public.society_group_limits() ->> 'maxPeople')::int;
  v_seq     bigint;
  v_version integer;
  v_res     jsonb;
  v_x       uuid;
begin
  select coalesce(array_agg(distinct x order by x), array[]::uuid[])
  into v_ids
  from unnest(coalesce(p_person_ids, array[]::uuid[])) as x
  where x is not null;

  v_fp := md5(jsonb_build_object('people', to_jsonb(v_ids))::text);

  select * into v_open from public.society_group_cmd_open(p_conversation_id, 'add_people', p_operation_key, v_fp);

  if v_open.o_replay is not null then
    return v_open.o_replay || jsonb_build_object('replayed', true);
  end if;

  v_caps := v_open.o_caps;

  if not (v_caps -> 'caps' ->> 'can_manage_people')::boolean then
    perform public.society_group_deny(v_caps);
  end if;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'SOCIETY_GROUP_PEOPLE_REQUIRED';
  end if;

  v_club := (v_caps ->> 'club_id')::uuid;
  v_team := (v_caps ->> 'team_id')::uuid;

  select coalesce(array_agg(cp.profile_id order by cp.profile_id), array[]::uuid[])
  into v_active
  from public.conversation_participants cp
  where cp.conversation_id = p_conversation_id and cp.profile_id = any (v_ids);

  select coalesce(array_agg(x order by x), array[]::uuid[])
  into v_new
  from unnest(v_ids) as x
  where not (x = any (v_active));

  if (v_caps ->> 'people_count')::int + coalesce(array_length(v_new, 1), 0) > v_max then
    raise exception 'SOCIETY_GROUP_TOO_MANY_PEOPLE';
  end if;

  /* Nessun lock sugli incarichi: il lock del gruppo è già preso (ordine
     gruppo → incarichi, come la passata di commit della cessazione, che blocca i
     gruppi per primi). L'eleggibilità è letta dopo il lock del gruppo; se un
     titolo termina fra la lettura e il commit, la rivalutazione al commit
     toglie quella persona (DB-3). */
  v_scope := public.society_group_add_scope(v_club, v_team,
               (v_caps ->> 'is_manager')::boolean, (v_caps ->> 'is_admin_member')::boolean);

  select coalesce(array_agg(x order by x), array[]::uuid[])
  into v_invalid
  from unnest(v_new) as x
  where not public.society_group_person_eligible(v_club, x)
     or not public.society_group_person_visible(v_club, x, v_scope);

  if coalesce(array_length(v_invalid, 1), 0) > 0 then
    select coalesce(array_agg(x order by x), array[]::uuid[])
    into v_valid
    from unnest(v_ids) as x
    where not (x = any (v_invalid));

    raise exception 'SOCIETY_GROUP_TARGETS_UNAVAILABLE:%', array_to_string(v_invalid, ',')
      using detail = array_to_string(v_valid, ',');
  end if;

  if coalesce(array_length(v_new, 1), 0) = 0 then
    v_res := jsonb_build_object('conversation_id', p_conversation_id,
      'version', (v_caps ->> 'version')::int, 'added', 0, 'added_ids', '[]'::jsonb,
      'already_active_ids', to_jsonb(v_active), 'changed', false);
  else
    perform public.society_group_window_open(p_conversation_id);

    v_seq := public.society_group_emit_event(
      p_conversation_id,
      case when array_length(v_new, 1) = 1 then 'GROUP_MEMBER_ADDED' else 'GROUP_MEMBERS_ADDED' end,
      case when array_length(v_new, 1) = 1
           then jsonb_build_object('name', (select p.full_name from public.profiles p where p.id = v_new[1]))
           else jsonb_build_object('count', array_length(v_new, 1)) end,
      'add:' || p_operation_key);

    insert into public.conversation_participants (conversation_id, profile_id, member_role, access_from_seq)
    select p_conversation_id, x, 'member', v_seq
    from unnest(v_new) as x;

    update public.society_groups g set updated_at = timezone('utc', now())
    where g.conversation_id = p_conversation_id
    returning g.version into v_version;

    foreach v_x in array v_new loop
      perform public.society_group_audit_record(p_conversation_id, v_club, v_uid, 'ADD_MEMBER',
        v_x,
        (select cp.period_id from public.conversation_participants cp
          where cp.conversation_id = p_conversation_id and cp.profile_id = v_x),
        v_version, jsonb_build_object('role', 'member', 'access_from_seq', v_seq));
    end loop;

    perform public.society_group_window_close();

    v_res := jsonb_build_object('conversation_id', p_conversation_id, 'version', v_version,
      'added', array_length(v_new, 1), 'added_ids', to_jsonb(v_new),
      'already_active_ids', to_jsonb(v_active), 'changed', true);
  end if;

  perform public.society_group_operation_record(p_operation_key, v_club, p_conversation_id,
    'add_people', v_fp, v_res);

  return v_res;
end;
$$;

/**
 * Promozione/demozione (§14) sulla **stessa** membership, legata al periodo e
 * alla sua versione osservati. L'ultimo ADMIN di un ACTIVE non si demota. Su
 * ARCHIVED solo la promozione del recupero (§22). Nessun evento.
 */
create or replace function public.society_group_set_member_role(
  p_conversation_id        uuid,
  p_period_id              uuid,
  p_expected_period_version integer,
  p_role                   text,
  p_operation_key          text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_fp      text := md5(jsonb_build_object('period', p_period_id, 'pv', p_expected_period_version, 'role', p_role)::text);
  v_open    record;
  v_caps    jsonb;
  v_p       public.society_group_membership_periods;
  v_club    uuid;
  v_version integer;
  v_pver    integer;
  v_res     jsonb;
begin
  select * into v_open from public.society_group_cmd_open(p_conversation_id, 'set_member_role', p_operation_key, v_fp);

  if v_open.o_replay is not null then
    return v_open.o_replay || jsonb_build_object('replayed', true);
  end if;

  v_caps := v_open.o_caps;
  v_club := (v_caps ->> 'club_id')::uuid;

  if p_role is null or p_role not in ('admin', 'member') then
    raise exception 'SOCIETY_GROUP_INVALID:role';
  end if;

  if not (v_caps -> 'caps' ->> 'can_manage_admins')::boolean then
    perform public.society_group_deny(v_caps);
  end if;

  /* Recupero: solo promozioni. */
  if v_caps ->> 'status' = 'archived' and p_role <> 'admin' then
    raise exception 'SOCIETY_GROUP_ARCHIVED';
  end if;

  select * into v_p
  from public.society_group_membership_periods per
  where per.id = p_period_id and per.conversation_id = p_conversation_id
  for update;

  if not found or v_p.ended_at is not null then
    raise exception 'SOCIETY_GROUP_PERIOD_ENDED';
  end if;

  if v_p.member_role = p_role then
    v_res := jsonb_build_object('conversation_id', p_conversation_id, 'version', (v_caps ->> 'version')::int,
      'period_id', v_p.id, 'period_version', v_p.version, 'member_role', v_p.member_role, 'changed', false);
  else
    if p_expected_period_version is distinct from v_p.version then
      raise exception 'SOCIETY_GROUP_VERSION_CONFLICT';
    end if;

    if p_role = 'member'
       and v_caps ->> 'status' = 'active'
       and (v_caps ->> 'admin_count')::int <= 1 then
      raise exception 'SOCIETY_GROUP_LAST_ADMIN';
    end if;

    perform public.society_group_window_open(p_conversation_id);

    update public.conversation_participants cp set member_role = p_role
    where cp.conversation_id = p_conversation_id
      and cp.profile_id = v_p.profile_id
      and cp.period_id = v_p.id;

    update public.society_groups g set updated_at = timezone('utc', now())
    where g.conversation_id = p_conversation_id
    returning g.version into v_version;

    select per.version into v_pver from public.society_group_membership_periods per where per.id = v_p.id;

    perform public.society_group_audit_record(p_conversation_id, v_club, v_uid,
      case when p_role = 'admin' then 'PROMOTE' else 'DEMOTE' end,
      v_p.profile_id, v_p.id, v_version,
      jsonb_build_object('from', v_p.member_role, 'to', p_role, 'recovery', v_caps ->> 'status' = 'archived'));

    perform public.society_group_window_close();

    v_res := jsonb_build_object('conversation_id', p_conversation_id, 'version', v_version,
      'period_id', v_p.id, 'period_version', v_pver, 'member_role', p_role, 'changed', true);
  end if;

  perform public.society_group_operation_record(p_operation_key, v_club, p_conversation_id,
    'set_member_role', v_fp, v_res);

  return v_res;
end;
$$;

/**
 * Rimozione (§15) di un periodo preciso: motivo REMOVED, storia conservata,
 * evento GROUP_MEMBER_REMOVED. Mai se stessi (si usa Leave), mai l'ultimo ADMIN
 * di un ACTIVE, mai su ARCHIVED. Se il periodo osservato è già chiuso il
 * risultato è un no-op che non tocca un eventuale nuovo ingresso.
 */
create or replace function public.society_group_remove_member(
  p_conversation_id uuid,
  p_period_id       uuid,
  p_operation_key   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_fp      text := md5(jsonb_build_object('period', p_period_id)::text);
  v_open    record;
  v_caps    jsonb;
  v_p       public.society_group_membership_periods;
  v_club    uuid;
  v_version integer;
  v_res     jsonb;
begin
  select * into v_open from public.society_group_cmd_open(p_conversation_id, 'remove_member', p_operation_key, v_fp);

  if v_open.o_replay is not null then
    return v_open.o_replay || jsonb_build_object('replayed', true);
  end if;

  v_caps := v_open.o_caps;
  v_club := (v_caps ->> 'club_id')::uuid;

  if not (v_caps -> 'caps' ->> 'can_manage_people')::boolean then
    perform public.society_group_deny(v_caps);
  end if;

  select * into v_p
  from public.society_group_membership_periods per
  where per.id = p_period_id and per.conversation_id = p_conversation_id
  for update;

  if not found then
    raise exception 'SOCIETY_GROUP_PERIOD_ENDED';
  end if;

  if v_p.ended_at is not null then
    v_res := jsonb_build_object('conversation_id', p_conversation_id, 'version', (v_caps ->> 'version')::int,
      'changed', false, 'period_ended', true);
  else
    if v_p.profile_id = v_uid then
      raise exception 'SOCIETY_GROUP_INVALID:self_removal';
    end if;

    if v_caps ->> 'status' <> 'active' then
      raise exception 'SOCIETY_GROUP_ARCHIVED';
    end if;

    if v_p.member_role = 'admin' and (v_caps ->> 'admin_count')::int <= 1 then
      raise exception 'SOCIETY_GROUP_LAST_ADMIN';
    end if;

    perform public.society_group_window_open(p_conversation_id, 'REMOVED');

    perform public.society_group_emit_event(p_conversation_id, 'GROUP_MEMBER_REMOVED',
      jsonb_build_object('name', (select p.full_name from public.profiles p where p.id = v_p.profile_id)),
      'remove:' || p_operation_key);

    delete from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id and cp.period_id = v_p.id;

    update public.society_groups g set updated_at = timezone('utc', now())
    where g.conversation_id = p_conversation_id
    returning g.version into v_version;

    perform public.society_group_audit_record(p_conversation_id, v_club, v_uid, 'REMOVE_MEMBER',
      v_p.profile_id, v_p.id, v_version, jsonb_build_object('role', v_p.member_role));

    perform public.society_group_window_close();

    v_res := jsonb_build_object('conversation_id', p_conversation_id, 'version', v_version,
      'changed', true, 'period_ended', false);
  end if;

  perform public.society_group_operation_record(p_operation_key, v_club, p_conversation_id,
    'remove_member', v_fp, v_res);

  return v_res;
end;
$$;

/**
 * Uscita ordinaria (§18) dal periodo osservato. MEMBER, o ADMIN con un altro
 * ADMIN, o chiunque su ARCHIVED. L'unico ADMIN di un ACTIVE riceve
 * LEAVE_REQUIRES_HANDOVER (altre persone) o LEAVE_ONLY_PERSON (da solo). Un
 * periodo già chiuso o diverso da quello osservato = no-op che non tocca la
 * membership corrente.
 */
create or replace function public.society_group_leave(
  p_conversation_id uuid,
  p_period_id       uuid,
  p_operation_key   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_fp      text := md5(jsonb_build_object('period', p_period_id)::text);
  v_open    record;
  v_caps    jsonb;
  v_club    uuid;
  v_version integer;
  v_res     jsonb;
begin
  select * into v_open from public.society_group_cmd_open(p_conversation_id, 'leave', p_operation_key, v_fp);

  if v_open.o_replay is not null then
    return v_open.o_replay || jsonb_build_object('replayed', true);
  end if;

  v_caps := v_open.o_caps;
  v_club := (v_caps ->> 'club_id')::uuid;

  if not (v_caps ->> 'is_member')::boolean then
    if exists (
      select 1 from public.society_group_membership_periods per
      where per.id = p_period_id and per.conversation_id = p_conversation_id
        and per.profile_id = v_uid and per.ended_at is not null
    ) then
      v_res := jsonb_build_object('conversation_id', p_conversation_id, 'changed', false, 'period_ended', true);
      perform public.society_group_operation_record(p_operation_key, v_club, p_conversation_id, 'leave', v_fp, v_res);
      return v_res;
    end if;

    if not (v_caps -> 'caps' ->> 'can_view_info')::boolean then
      raise exception 'SOCIETY_GROUP_NOT_FOUND';
    end if;

    perform public.society_group_deny(v_caps, false);
  end if;

  if (v_caps ->> 'my_period_id')::uuid is distinct from p_period_id then
    v_res := jsonb_build_object('conversation_id', p_conversation_id, 'changed', false, 'period_changed', true);
    perform public.society_group_operation_record(p_operation_key, v_club, p_conversation_id, 'leave', v_fp, v_res);
    return v_res;
  end if;

  if v_caps ->> 'status' = 'active'
     and v_caps ->> 'my_role' = 'admin'
     and (v_caps ->> 'admin_count')::int <= 1 then
    if (v_caps ->> 'people_count')::int <= 1 then
      raise exception 'SOCIETY_GROUP_LEAVE_ONLY_PERSON';
    end if;

    raise exception 'SOCIETY_GROUP_LEAVE_REQUIRES_HANDOVER';
  end if;

  perform public.society_group_window_open(p_conversation_id, 'LEFT');

  perform public.society_group_emit_event(p_conversation_id, 'GROUP_MEMBER_LEFT',
    jsonb_build_object('name', (select p.full_name from public.profiles p where p.id = v_uid)),
    'leave:' || p_operation_key);

  delete from public.conversation_participants cp
  where cp.conversation_id = p_conversation_id and cp.period_id = p_period_id;

  update public.society_groups g set updated_at = timezone('utc', now())
  where g.conversation_id = p_conversation_id
  returning g.version into v_version;

  perform public.society_group_audit_record(p_conversation_id, v_club, v_uid, 'LEAVE',
    v_uid, p_period_id, v_version, jsonb_build_object('role', v_caps ->> 'my_role'));

  perform public.society_group_window_close();

  v_res := jsonb_build_object('conversation_id', p_conversation_id, 'version', v_version,
    'changed', true, 'period_ended', false);

  perform public.society_group_operation_record(p_operation_key, v_club, p_conversation_id,
    'leave', v_fp, v_res);

  return v_res;
end;
$$;

/**
 * Successione atomica (§19): l'unico ADMIN di un ACTIVE nomina uno o più
 * sostituti (MEMBER attivi che mantengono un titolo) ed esce, in un solo
 * comando. Tutto o niente: un sostituto non più valido → rollback completo,
 * `TARGETS_UNAVAILABLE:<ids non validi>` con gli ids ancora validi nel DETAIL.
 * Se nel frattempo c'è un altro ADMIN, o il gruppo è archiviato, o l'actor non
 * è ADMIN: `HANDOVER_NOT_REQUIRED` (DETAIL = motivo) e nulla viene promosso.
 */
create or replace function public.society_group_leave_with_handover(
  p_conversation_id uuid,
  p_period_id       uuid,
  p_successor_ids   uuid[],
  p_operation_key   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_ids     uuid[];
  v_fp      text;
  v_open    record;
  v_caps    jsonb;
  v_club    uuid;
  v_invalid uuid[];
  v_valid   uuid[];
  v_version integer;
  v_res     jsonb;
  v_x       uuid;
begin
  select coalesce(array_agg(distinct x order by x), array[]::uuid[])
  into v_ids
  from unnest(coalesce(p_successor_ids, array[]::uuid[])) as x
  where x is not null and x <> v_uid;

  v_fp := md5(jsonb_build_object('period', p_period_id, 'successors', to_jsonb(v_ids))::text);

  select * into v_open from public.society_group_cmd_open(p_conversation_id, 'leave_with_handover', p_operation_key, v_fp);

  if v_open.o_replay is not null then
    return v_open.o_replay || jsonb_build_object('replayed', true);
  end if;

  v_caps := v_open.o_caps;
  v_club := (v_caps ->> 'club_id')::uuid;

  if not (v_caps ->> 'is_member')::boolean then
    if exists (
      select 1 from public.society_group_membership_periods per
      where per.id = p_period_id and per.conversation_id = p_conversation_id
        and per.profile_id = v_uid and per.ended_at is not null
    ) then
      v_res := jsonb_build_object('conversation_id', p_conversation_id, 'changed', false, 'period_ended', true);
      perform public.society_group_operation_record(p_operation_key, v_club, p_conversation_id, 'leave_with_handover', v_fp, v_res);
      return v_res;
    end if;

    if not (v_caps -> 'caps' ->> 'can_view_info')::boolean then
      raise exception 'SOCIETY_GROUP_NOT_FOUND';
    end if;

    perform public.society_group_deny(v_caps, false);
  end if;

  if (v_caps ->> 'my_period_id')::uuid is distinct from p_period_id then
    v_res := jsonb_build_object('conversation_id', p_conversation_id, 'changed', false, 'period_changed', true);
    perform public.society_group_operation_record(p_operation_key, v_club, p_conversation_id, 'leave_with_handover', v_fp, v_res);
    return v_res;
  end if;

  if v_caps ->> 'status' <> 'active' then
    raise exception 'SOCIETY_GROUP_HANDOVER_NOT_REQUIRED' using detail = 'ARCHIVED';
  end if;

  if v_caps ->> 'my_role' <> 'admin' or (v_caps ->> 'admin_count')::int >= 2 then
    raise exception 'SOCIETY_GROUP_HANDOVER_NOT_REQUIRED'
      using detail = case when v_caps ->> 'my_role' <> 'admin' then 'NOT_ADMIN' else 'OTHER_ADMIN' end;
  end if;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'SOCIETY_GROUP_PEOPLE_REQUIRED';
  end if;

  select coalesce(array_agg(x order by x), array[]::uuid[])
  into v_invalid
  from unnest(v_ids) as x
  where not exists (
          select 1 from public.conversation_participants cp
          where cp.conversation_id = p_conversation_id
            and cp.profile_id = x and cp.member_role = 'member')
     or not public.society_group_person_maintains(v_club, x);

  if coalesce(array_length(v_invalid, 1), 0) > 0 then
    select coalesce(array_agg(x order by x), array[]::uuid[])
    into v_valid
    from unnest(v_ids) as x
    where not (x = any (v_invalid));

    raise exception 'SOCIETY_GROUP_TARGETS_UNAVAILABLE:%', array_to_string(v_invalid, ',')
      using detail = array_to_string(v_valid, ',');
  end if;

  perform public.society_group_window_open(p_conversation_id, 'LEFT');

  update public.conversation_participants cp set member_role = 'admin'
  where cp.conversation_id = p_conversation_id and cp.profile_id = any (v_ids);

  perform public.society_group_emit_event(p_conversation_id, 'GROUP_MEMBER_LEFT',
    jsonb_build_object('name', (select p.full_name from public.profiles p where p.id = v_uid)),
    'leave:' || p_operation_key);

  delete from public.conversation_participants cp
  where cp.conversation_id = p_conversation_id and cp.period_id = p_period_id;

  if not exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id and cp.member_role = 'admin'
  ) then
    raise exception 'SOCIETY_GROUP_LAST_ADMIN';
  end if;

  update public.society_groups g set updated_at = timezone('utc', now())
  where g.conversation_id = p_conversation_id
  returning g.version into v_version;

  foreach v_x in array v_ids loop
    perform public.society_group_audit_record(p_conversation_id, v_club, v_uid, 'PROMOTE',
      v_x,
      (select cp.period_id from public.conversation_participants cp
        where cp.conversation_id = p_conversation_id and cp.profile_id = v_x),
      v_version, jsonb_build_object('from', 'member', 'to', 'admin', 'handover', true));
  end loop;

  perform public.society_group_audit_record(p_conversation_id, v_club, v_uid, 'LEAVE',
    v_uid, p_period_id, v_version, jsonb_build_object('role', 'admin', 'handover', true));

  perform public.society_group_window_close();

  v_res := jsonb_build_object('conversation_id', p_conversation_id, 'version', v_version,
    'changed', true, 'period_ended', false, 'promoted_ids', to_jsonb(v_ids));

  perform public.society_group_operation_record(p_operation_key, v_club, p_conversation_id,
    'leave_with_handover', v_fp, v_res);

  return v_res;
end;
$$;


-- ============================================================
-- SEZIONE 7 — grant
-- ============================================================

revoke all on function public.society_group_avatar_authorized(uuid) from public, anon;

do $$
declare
  v_sig text;
begin
  foreach v_sig in array array[
    'public.fetch_society_group_management(uuid)',
    'public.fetch_society_group_members_page(uuid, text, text, integer)',
    'public.fetch_society_group_eligible_page(uuid, text, text, integer)',
    'public.fetch_society_group_eligible_team_ids(uuid)',
    'public.fetch_society_group_team_options(uuid)',
    'public.fetch_society_groups_archived_page(uuid, text, text, integer)',
    'public.fetch_society_group_handover_candidates(uuid, text, text, integer)',
    'public.society_group_rename(uuid, text, integer, text)',
    'public.society_group_set_avatar(uuid, uuid, integer, text)',
    'public.society_group_set_team(uuid, uuid, integer, text)',
    'public.society_group_archive(uuid, integer, text)',
    'public.society_group_reactivate(uuid, integer, text)',
    'public.society_group_delete(uuid, integer, text)',
    'public.society_group_add_people(uuid, uuid[], text)',
    'public.society_group_set_member_role(uuid, uuid, integer, text, text)',
    'public.society_group_remove_member(uuid, uuid, text)',
    'public.society_group_leave(uuid, uuid, text)',
    'public.society_group_leave_with_handover(uuid, uuid, uuid[], text)'
  ] loop
    execute format('revoke all on function %s from public', v_sig);
    execute format('revoke execute on function %s from anon', v_sig);
    execute format('grant execute on function %s to authenticated', v_sig);
  end loop;
end
$$;
