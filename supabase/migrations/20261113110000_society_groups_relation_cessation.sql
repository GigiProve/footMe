-- ============================================================
-- DAS-REV-33 — Gruppi: cessazione della relazione, cleanup dell'eliminazione,
-- anteprima Inbox degli eventi (fase DB-3)
--
-- Cosa mancava dopo la 20261113100000 (DB-2):
--
--   · Nessuno toglie una persona da un gruppo quando perde il titolo che la
--     legittima (§20). Oggi la membership sopravvive alla fine dell'incarico:
--     chi non lavora più per la Società continuerebbe a leggere la chat.
--   · Nessun cleanup dopo il tombstone (§23): DB-2 chiude l'accesso ma
--     messaggi, eventi, riferimenti all'immagine e file restano. L'accesso è
--     già revocato, quindi non è un buco di sicurezza, ma la promessa «il
--     gruppo, i messaggi e i file verranno eliminati» non sarebbe mantenuta.
--   · L'Inbox non dice quale evento di sistema è l'ultimo messaggio: il
--     client non può formattarne l'anteprima con la copy della chat.
--
-- Scelte (§ = paragrafo della task):
--
--   1. **Fonti reali del predicate di mantenimento** (nessun flag parallelo,
--      già in `society_group_person_maintains`, DB-2): (a) un incarico
--      `club_member_assignments` attivo sulla `club_members` attiva della
--      persona — tutti i tipi di incarico (sportivi, dirigenziali, staff),
--      perché la fine di un solo incarico non basta se ne resta un altro;
--      (b) una membership amministrativa `club_admin_memberships` attiva (il
--      creator amministrativo della 32 non ha una rosa, §20 raccordo con la
--      32); (c) la proprietà della Società (`clubs.owner_profile_id`). Non
--      bastano: l'appartenenza al gruppo, il ruolo interno ADMIN, una
--      capability di Dashboard, una carriera dichiarata, Shortlist, eventi.
--   2. **Cessazione sincrona al commit.** Trigger immediati su
--      `club_member_assignments`, `club_members`, `club_admin_memberships`
--      (UPDATE di `status`/`profile_id`/`club_id`, e DELETE) e su
--      `clubs.owner_profile_id` accodano la coppia (Società, persona) in un
--      elenco locale alla transazione (GUC) e armano **un solo** constraint
--      trigger DEFERRABLE INITIALLY DEFERRED (su `society_group_relation_ticks`):
--      a fine transazione una sola passata rivaluta il predicate sullo stato
--      **finale** di tutte le coppie toccate. I gruppi coinvolti sono bloccati
--      `for update` **in un'unica istruzione ordinata per conversation_id**:
--      ordine globale, non dipendente dall'ordine delle righe modificate (nessun
--      lock-inversion fra transazioni che toccano coppie diverse); i comandi di
--      DB-2 prendono lo stesso lock prima di qualsiasi altro (e `add_people`
--      non blocca più gli incarichi: la rivalutazione al commit toglie chi non
--      ha più titolo). Se il predicate è falso si chiudono i periodi attivi
--      della persona nei gruppi di **quella** Società (motivo SOCIETY_RELATION_ENDED), con l'evento generico
--      GROUP_MEMBER_REMOVED (nessuna ragione amministrativa rivelata) e
--      audit di sistema. Un gruppo ACTIVE che resta senza ADMIN o senza
--      persone passa ad ARCHIVED nella stessa transazione, con
--      GROUP_ARCHIVED e audit: mai promozioni automatiche, mai Delete (§20).
--   3. **Perché i casi «evento stale» (§20 ultimo paragrafo, QA-108) non si
--      presentano.** Non c'è un evento in coda né un worker: la cessazione è
--      una conseguenza dello stesso commit che cambia il titolo, valutata sul
--      suo stato finale. (i) Lo scambio di segmento per ROLE_CHANGED (un
--      incarico chiuso e uno nuovo nella stessa transazione) vede il nuovo
--      incarico al commit: nessuna uscita. (ii) Se la persona esce e
--      **dopo** torna, l'uscita è già committata e il periodo chiuso è
--      immutabile (DB-1): il ritorno non lo riapre né restituisce la
--      history; serve una nuova aggiunta esplicita (nuovo periodo, nuovo
--      boundary). (iii) Un nuovo periodo creato dopo il ritorno non può essere
--      chiuso da una consegna tardiva, perché la valutazione legge lo stato
--      corrente, non un payload. (iv) Non esiste una finestra in cui il titolo
--      sia perso e il periodo ancora attivo oltre il commit, quindi le guard
--      di lettura/invio non devono compensare un ritardo. Limite dichiarato:
--      una scrittura con i trigger disabilitati (`session_replication_role`,
--      `disable trigger all`, restore) non produce cessazione.
--   4. La perdita di una singola capability (`groups_*`), il cambio di
--      Squadra o di professione, la revoca di un'altra membership non
--      toccano nulla: nessun trigger sulle permission, e il predicate non le
--      guarda (§20, DoD-41).
--   5. **Cleanup** (§23): `society_group_cleanup_sweep` lavora sui gruppi con
--      tombstone non ancora ripuliti: toglie messaggi ed eventi, righe
--      participant residue, scollega e cancella l'asset dell'immagine.
--      Conserva: la riga `society_groups` (tombstone), `conversations`, i
--      periodi e l'audit («audit e domain event restano separati»). Idempotente
--      (`cleanup_done_at`), `for update skip locked`, a lotti.
--   6. **File.** Supabase blocca il DELETE diretto su `storage.objects`
--      (`storage.protect_delete`); anche aggirandolo con
--      `storage.allow_delete_query` si cancellerebbe solo la riga di metadata
--      e il blob resterebbe orfano nell'object store. Perciò lo sweep non
--      tocca `storage.objects`: accoda i nomi in `society_group_storage_cleanup`
--      (bucket, name, enqueued_at, done_at). **Un Edge Function / worker con
--      ruolo di servizio deve svuotare la coda con la Storage API
--      (`remove`) e valorizzare `done_at`**: finché non esiste, i blob restano
--      (limite dichiarato, non verificabile in locale: PGlite non ha la
--      Storage API). Non si accoda un file referenziato da un messaggio di
--      un'altra conversazione.
--   6b. Scheduling: pg_cron se disponibile (come DAS-REV-31). **Senza pg_cron
--      lo sweep non è schedulato**: va eseguito da uno scheduler esterno
--      (`select society_group_cleanup_sweep(20)` con ruolo di servizio) o a
--      mano. Non è un buco di accesso: il tombstone chiude subito lettura,
--      invio, Storage (`society_group_avatar_readable` lo nega), Inbox e
--      Centro; resta solo la persistenza di messaggi, riferimenti e file.
--   6c. **Errori in cessazione = fallimento rumoroso.** Un errore inatteso
--      durante la passata di commit annulla la transazione che ha cambiato il
--      titolo. Ingoiarlo (`exception when others`) lascerebbe attivo l'accesso
--      di chi non ha più titolo: è fail-open, quindi volutamente non fatto. I
--      trigger scattano solo sulle colonne rilevanti (status, profile_id,
--      club_id, owner_profile_id), non su ogni UPDATE (contatori, touch).
--   7. **Anteprima Inbox**: `fetch_inbox_conversations` riemessa dalla
--      definizione DB-1 con due colonne in coda, tipo e payload dell'ultimo
--      messaggio se è un evento (null altrimenti). `body` degli eventi resta ''.
--
-- Funzioni riemesse, ciascuna dalla sua **ultima** definizione:
--   · society_group_participant_end  ← 20261113090000 (+ attore di sistema)
--   · fetch_inbox_conversations      ← 20261113090000 (+2 colonne: drop+create)
--   · fetch_society_group_management ← 20261113100000 (+club_is_verified, §6)
-- ============================================================


-- ============================================================
-- SEZIONE 1 — Inbox: anteprima degli eventi
-- ============================================================

/* Riemessa da 20261113090000 (ultima definizione): due colonne in coda, tipo e
   payload dell'ultimo messaggio se è un evento di sistema (null altrimenti).
   Il confine del periodo, gli unread e l'esclusione degli eliminati restano
   quelli di DB-1. Signature di ritorno cambiata: drop + create. */
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
  group_avatar_path              text,
  group_status                   text,
  last_message_system_event_type text,
  last_message_system_payload    jsonb
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
    group_info.storage_path                                          as group_avatar_path,
    group_info.status                                                as group_status,
    last_message.system_event_type                                   as last_message_system_event_type,
    last_message.system_payload                                      as last_message_system_payload
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
    select m.body, m.message_kind, m.sent_at, m.sender_profile_id,
           m.system_event_type, m.system_payload
    from public.messages m
    where m.conversation_id = c.id
      and m.seq >= my_participant.access_from_seq
    order by m.seq desc
    limit 1
  ) last_message on true
  left join public.profiles last_message_sender
    on last_message_sender.id = last_message.sender_profile_id
  left join lateral (
    select count(*)::bigint as unread_count
    from public.messages m
    where m.conversation_id = c.id
      and m.message_kind <> 'system_event'
      and m.sender_profile_id <> v_uid
      and m.seq >= my_participant.access_from_seq
      and m.sent_at > coalesce(my_participant.last_read_at, '-infinity'::timestamptz)
  ) unread_summary on true
  left join lateral (
    select a.storage_path, g.status
    from public.society_groups g
    left join public.society_group_avatar_assets a on a.id = g.avatar_asset_id
    where g.conversation_id = c.id
  ) group_info on c.conversation_type = 'group'
  where my_participant.profile_id = v_uid
    and (p_include_archived or my_participant.archived_at is null)
    and not exists (
      select 1 from public.society_groups gd
      where gd.conversation_id = c.id and gd.deleted_at is not null
    )
  order by coalesce(last_message.sent_at, c.created_at) desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.fetch_inbox_conversations(int, int, boolean) from public, anon;
grant execute on function public.fetch_inbox_conversations(int, int, boolean) to authenticated;


-- ============================================================
-- SEZIONE 2 — cessazione della relazione (§20)
-- ============================================================

/**
 * Riemessa da 20261113090000 (ultima definizione). Nuovo: con la finestra di
 * sistema (`society_groups.end_system = 'on'`) l'autore della chiusura è
 * null, non l'utente che ha cambiato il titolo (la cessazione non è una sua
 * rimozione).
 */
create or replace function public.society_group_participant_end()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.period_id is not null then
    update public.society_group_membership_periods p
    set ended_at            = timezone('utc', now()),
        end_reason          = coalesce(nullif(current_setting('society_groups.end_reason', true), ''), 'REMOVED'),
        ended_by_profile_id = case
          when coalesce(current_setting('society_groups.end_system', true), '') = 'on' then null
          else auth.uid() end
    where p.id = old.period_id and p.ended_at is null;
  end if;

  return old;
end;
$$;

revoke all on function public.society_group_participant_end() from public, anon, authenticated;

/**
 * Cuore della cessazione. Per le coppie (Società, persona) indicate, chiude i
 * periodi attivi di chi non mantiene più alcun titolo, nei gruppi di quella
 * Società, con evento GROUP_MEMBER_REMOVED e audit; poi archivia i gruppi
 * ACTIVE rimasti senza ADMIN o senza persone (valutato **dopo** tutte le
 * rimozioni del gruppo: un gruppo che perde tutti riceve NO_PEOPLE).
 * Idempotente. Lock: tutti i gruppi coinvolti in UN'istruzione `for update`
 * ordinata per id, poi il lavoro.
 */
create or replace function public.society_group_relation_process(
  p_clubs    uuid[],
  p_profiles uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convs   uuid[];
  v_conv    uuid;
  v_g       public.society_groups%rowtype;
  v_m       record;
  v_version integer;
  v_admins  integer;
  v_people  integer;
  v_removed integer;
  v_closed  integer := 0;
begin
  if coalesce(array_length(p_clubs, 1), 0) = 0 then
    return 0;
  end if;

  select coalesce(array_agg(distinct cp.conversation_id order by cp.conversation_id), array[]::uuid[])
  into v_convs
  from unnest(p_clubs, p_profiles) as pr(club_id, profile_id)
  join public.society_groups g on g.club_id = pr.club_id and g.deleted_at is null
  join public.conversation_participants cp
    on cp.conversation_id = g.conversation_id and cp.profile_id = pr.profile_id
  where not public.society_group_person_maintains(pr.club_id, pr.profile_id);

  if coalesce(array_length(v_convs, 1), 0) = 0 then
    return 0;
  end if;

  perform 1
  from public.society_groups g
  where g.conversation_id = any (v_convs)
  order by g.conversation_id
  for update;

  foreach v_conv in array v_convs loop
    select * into v_g from public.society_groups g where g.conversation_id = v_conv;

    if v_g.deleted_at is not null then
      continue;
    end if;

    perform public.society_group_window_open(v_conv, 'SOCIETY_RELATION_ENDED');
    perform set_config('society_groups.end_system', 'on', true);
    v_removed := 0;

    for v_m in
      select cp.profile_id, cp.period_id, pr.club_id, p.full_name
      from unnest(p_clubs, p_profiles) as pr(club_id, profile_id)
      join public.conversation_participants cp
        on cp.conversation_id = v_conv and cp.profile_id = pr.profile_id
      join public.profiles p on p.id = cp.profile_id
      where pr.club_id = v_g.club_id
        and not public.society_group_person_maintains(pr.club_id, pr.profile_id)
      order by cp.profile_id
    loop
      perform public.society_group_emit_event(v_conv, 'GROUP_MEMBER_REMOVED',
        jsonb_build_object('name', v_m.full_name),
        'relend:' || coalesce(v_m.period_id::text, v_m.profile_id::text));

      delete from public.conversation_participants cp
      where cp.conversation_id = v_conv and cp.profile_id = v_m.profile_id;

      update public.society_groups g set updated_at = timezone('utc', now())
      where g.conversation_id = v_conv
      returning g.version into v_version;

      perform public.society_group_audit_record(v_conv, v_g.club_id, null,
        'AUTO_REMOVE', v_m.profile_id, v_m.period_id, v_version,
        jsonb_build_object('reason', 'SOCIETY_RELATION_ENDED'));

      v_removed := v_removed + 1;
      v_closed  := v_closed + 1;
    end loop;

    if v_removed > 0 and v_g.status = 'active' then
      select count(*) filter (where cp.member_role = 'admin')::int, count(*)::int
      into v_admins, v_people
      from public.conversation_participants cp
      where cp.conversation_id = v_conv;

      if v_admins = 0 or v_people = 0 then
        update public.society_groups g
        set status = 'archived', archived_by = null
        where g.conversation_id = v_conv
        returning g.version into v_version;

        perform public.society_group_emit_event(v_conv, 'GROUP_ARCHIVED',
          '{}'::jsonb, 'autoarchive:' || v_version::text);

        perform public.society_group_audit_record(v_conv, v_g.club_id, null,
          'AUTO_ARCHIVE', null, null, v_version,
          jsonb_build_object('reason', case when v_people = 0 then 'NO_PEOPLE' else 'NO_ADMIN' end));
      end if;
    end if;

    perform public.society_group_window_close();
    perform set_config('society_groups.end_system', '', true);
  end loop;

  return v_closed;
end;
$$;

/** Singola coppia: stessa logica, utile ai test e agli strumenti di supporto. */
create or replace function public.society_group_relation_reconcile(
  p_club_id    uuid,
  p_profile_id uuid
)
returns integer
language sql
security definer
set search_path = public
as $$
  select case when p_club_id is null or p_profile_id is null then 0
              else public.society_group_relation_process(array[p_club_id], array[p_profile_id]) end;
$$;

revoke all on function public.society_group_relation_process(uuid[], uuid[]) from public, anon, authenticated;
revoke all on function public.society_group_relation_reconcile(uuid, uuid) from public, anon, authenticated;

/**
 * Elenco delle coppie da rivalutare e `tick` che arma la passata di commit.
 * Il GUC è locale alla transazione (e al savepoint): se la modifica che ha
 * accodato la coppia viene annullata, spariscono insieme la coppia e il tick.
 * Un valore iniettato a mano può solo far **rivalutare** una coppia (idempotente).
 */
create table if not exists public.society_group_relation_ticks (
  id bigint generated always as identity primary key
);

alter table public.society_group_relation_ticks enable row level security;
revoke all on public.society_group_relation_ticks from anon, authenticated;

create or replace function public.society_group_relation_push(p_club_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := p_club_id::text || ':' || p_profile_id::text || ';';
  v_cur text := coalesce(current_setting('society_groups.relation_pending', true), '');
begin
  if p_club_id is null or p_profile_id is null then
    return;
  end if;

  if position(v_key in v_cur) = 0 then
    perform set_config('society_groups.relation_pending', v_cur || v_key, true);
  end if;

  if coalesce(current_setting('society_groups.relation_armed', true), '') <> 'on' then
    perform set_config('society_groups.relation_armed', 'on', true);
    insert into public.society_group_relation_ticks default values;
  end if;
end;
$$;

/** Trigger immediato: raccoglie le coppie toccate dalla riga, solo se una colonna rilevante cambia. */
create or replace function public.society_group_relation_enqueue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := to_jsonb(old);
  v_new jsonb := case when tg_op = 'UPDATE' then to_jsonb(new) end;
begin
  if tg_table_name = 'clubs' then
    if v_old ->> 'owner_profile_id' is not null
       and v_old ->> 'owner_profile_id' is distinct from v_new ->> 'owner_profile_id' then
      perform public.society_group_relation_push((v_old ->> 'id')::uuid, (v_old ->> 'owner_profile_id')::uuid);
    end if;

    return null;
  end if;

  if tg_op = 'UPDATE'
     and v_old ->> 'status'     is not distinct from v_new ->> 'status'
     and v_old ->> 'profile_id' is not distinct from v_new ->> 'profile_id'
     and v_old ->> 'club_id'    is not distinct from v_new ->> 'club_id' then
    return null;
  end if;

  perform public.society_group_relation_push((v_old ->> 'club_id')::uuid, (v_old ->> 'profile_id')::uuid);

  if v_new is not null and v_new ->> 'profile_id' is distinct from v_old ->> 'profile_id' then
    perform public.society_group_relation_push((v_new ->> 'club_id')::uuid, (v_new ->> 'profile_id')::uuid);
  end if;

  return null;
end;
$$;

/** Passata di commit: una sola per transazione, su tutte le coppie raccolte. */
create or replace function public.society_group_relation_flush()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cur      text := coalesce(current_setting('society_groups.relation_pending', true), '');
  v_clubs    uuid[];
  v_profiles uuid[];
begin
  perform set_config('society_groups.relation_pending', '', true);
  perform set_config('society_groups.relation_armed', '', true);
  delete from public.society_group_relation_ticks;

  select array_agg(split_part(x, ':', 1)::uuid order by x), array_agg(split_part(x, ':', 2)::uuid order by x)
  into v_clubs, v_profiles
  from (select distinct x from unnest(string_to_array(v_cur, ';')) as x where x <> '') q;

  perform public.society_group_relation_process(v_clubs, v_profiles);

  return null;
end;
$$;

revoke all on function public.society_group_relation_push(uuid, uuid) from public, anon, authenticated;
revoke all on function public.society_group_relation_enqueue() from public, anon, authenticated;
revoke all on function public.society_group_relation_flush() from public, anon, authenticated;

drop trigger if exists society_group_relation_enqueue on public.club_member_assignments;
create trigger society_group_relation_enqueue
after update of status, profile_id, club_id or delete on public.club_member_assignments
for each row execute function public.society_group_relation_enqueue();

drop trigger if exists society_group_relation_enqueue on public.club_members;
create trigger society_group_relation_enqueue
after update of status, profile_id, club_id or delete on public.club_members
for each row execute function public.society_group_relation_enqueue();

drop trigger if exists society_group_relation_enqueue on public.club_admin_memberships;
create trigger society_group_relation_enqueue
after update of status, profile_id, club_id or delete on public.club_admin_memberships
for each row execute function public.society_group_relation_enqueue();

drop trigger if exists society_group_relation_enqueue on public.clubs;
create trigger society_group_relation_enqueue
after update of owner_profile_id on public.clubs
for each row execute function public.society_group_relation_enqueue();

drop trigger if exists society_group_relation_flush on public.society_group_relation_ticks;
create constraint trigger society_group_relation_flush
after insert on public.society_group_relation_ticks
deferrable initially deferred
for each row execute function public.society_group_relation_flush();


-- ============================================================
-- SEZIONE 3 — cleanup dell'eliminazione (§23)
-- ============================================================

alter table public.society_groups
  add column if not exists cleanup_done_at timestamptz;

create index if not exists society_groups_cleanup_pending_idx
  on public.society_groups (deleted_at)
  where deleted_at is not null and cleanup_done_at is null;

/**
 * Coda dei file da cancellare con la Storage API (§23). Lo SQL non cancella
 * `storage.objects` (vedi head comment): un worker con ruolo di servizio la
 * svuota e valorizza `done_at`.
 */
create table if not exists public.society_group_storage_cleanup (
  id              uuid primary key default gen_random_uuid(),
  bucket          text not null,
  name            text not null,
  conversation_id uuid,
  enqueued_at     timestamptz not null default timezone('utc', now()),
  done_at         timestamptz,
  constraint society_group_storage_cleanup_unique unique (bucket, name)
);

create index if not exists society_group_storage_cleanup_pending_idx
  on public.society_group_storage_cleanup (enqueued_at)
  where done_at is null;

alter table public.society_group_storage_cleanup enable row level security;
revoke all on public.society_group_storage_cleanup from anon, authenticated;
grant select, update on public.society_group_storage_cleanup to service_role;

comment on table public.society_group_storage_cleanup is
  'DAS-REV-33 §23: file dei gruppi eliminati da cancellare con la Storage API. '
  'Chiusa al client; la svuota un worker con ruolo di servizio (done_at).';

/**
 * Sweep dei gruppi con tombstone. Per ogni gruppo (lotto, `skip locked`):
 * righe participant residue, accodamento dei file (messaggi + oggetti nella
 * cartella della conversazione, esclusi quelli referenziati da un'altra
 * conversazione) e dell'immagine, scollegamento e cancellazione dell'asset,
 * cancellazione dei messaggi e degli eventi. Conserva tombstone, periodi e
 * audit. Idempotente.
 */
create or replace function public.society_group_cleanup_sweep(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_g        record;
  v_asset    public.society_group_avatar_assets;
  v_groups   integer := 0;
  v_msgs     integer := 0;
  v_blobs    integer := 0;
  v_n        integer;
begin
  for v_g in
    select g.conversation_id, g.avatar_asset_id
    from public.society_groups g
    where g.deleted_at is not null and g.cleanup_done_at is null
    order by g.deleted_at
    limit greatest(coalesce(p_limit, 20), 1)
    for update skip locked
  loop
    perform public.society_group_window_open(v_g.conversation_id, 'GROUP_DELETED');
    perform set_config('society_groups.end_system', 'on', true);

    delete from public.conversation_participants cp where cp.conversation_id = v_g.conversation_id;

    insert into public.society_group_storage_cleanup (bucket, name, conversation_id)
    select 'chat-media', x.n, v_g.conversation_id
    from (
      select o.name as n
      from storage.objects o
      where o.bucket_id = 'chat-media'
        and o.name like v_g.conversation_id::text || '/%'
      union
      select m.media_url
      from public.messages m
      where m.conversation_id = v_g.conversation_id and m.media_url is not null
    ) x
    where not exists (
      select 1 from public.messages m2
      where m2.media_url = x.n and m2.conversation_id <> v_g.conversation_id
    )
    on conflict (bucket, name) do nothing;

    get diagnostics v_n = row_count;
    v_blobs := v_blobs + v_n;

    delete from public.messages m where m.conversation_id = v_g.conversation_id;
    get diagnostics v_n = row_count;
    v_msgs := v_msgs + v_n;

    if v_g.avatar_asset_id is not null then
      select * into v_asset from public.society_group_avatar_assets a where a.id = v_g.avatar_asset_id;

      update public.society_groups g set avatar_asset_id = null
      where g.conversation_id = v_g.conversation_id;

      if v_asset.id is not null then
        insert into public.society_group_storage_cleanup (bucket, name, conversation_id)
        values ('society-group-avatars', v_asset.storage_path, v_g.conversation_id)
        on conflict (bucket, name) do nothing;

        delete from public.society_group_avatar_assets a where a.id = v_asset.id;
        v_blobs := v_blobs + 1;
      end if;
    end if;

    update public.society_groups g set cleanup_done_at = timezone('utc', now())
    where g.conversation_id = v_g.conversation_id;

    perform public.society_group_window_close();
    perform set_config('society_groups.end_system', '', true);

    v_groups := v_groups + 1;
  end loop;

  return jsonb_build_object('groups', v_groups, 'messages_deleted', v_msgs, 'blobs_queued', v_blobs);
end;
$$;

revoke all on function public.society_group_cleanup_sweep(integer) from public, anon, authenticated;
grant execute on function public.society_group_cleanup_sweep(integer) to service_role;

do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
   begin
    create extension if not exists pg_cron;

    if exists (select 1 from cron.job where jobname = 'society-group-cleanup') then
      perform cron.unschedule('society-group-cleanup');
    end if;

    perform cron.schedule(
      'society-group-cleanup',
      '*/5 * * * *',
      'select public.society_group_cleanup_sweep(20)');
   exception when others then
    raise warning 'DAS-REV-33: pg_cron non attivabile (%); cleanup dei gruppi non programmato.', sqlerrm;
   end;
  else
    raise notice 'DAS-REV-33: pg_cron non disponibile; cleanup dei gruppi non programmato (eseguibile con society_group_cleanup_sweep).';
  end if;
end;
$do$;


-- ============================================================
-- SEZIONE 4 — verifica della Società nell'Info gruppo (§6)
--
-- Il check di verifica appartiene alla Società, mai al gruppo: stessa fonte di
-- fetch_society_group_create_contexts (clubs.verification_status = 'verified').
-- Riemessa da 20261113100000 (ultima definizione) con una sola chiave in più.
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
         cl.name as club_name, (cl.verification_status = 'verified') as club_is_verified, t.name as team_name, a.storage_path as avatar_path
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
    'club_is_verified', v_row.club_is_verified,
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

revoke all on function public.fetch_society_group_management(uuid) from public, anon;
grant execute on function public.fetch_society_group_management(uuid) to authenticated;
