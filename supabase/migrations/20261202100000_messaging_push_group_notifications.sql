-- ============================================================
-- DAS-REV-34 — Gruppi: integrazione Messaging/Push (filone S2)
-- Coda push generalizzata, push dei messaggi DIRECT e GROUP, push di
-- Archive/Reactivate e le cinque notifiche strutturali dei gruppi.
--
-- Cosa mancava, verificato sul repository dopo la 20261201090000:
--
--   · La coda `notification_push_deliveries` (HOM-14) ha `notification_id NOT
--     NULL` e `unique (notification_id, revision)`: sa consegnare solo una
--     riga della campanella. Un messaggio ordinario non è e non deve essere una
--     notifica (§15, DOD-027): non ha riga in `notifications`, non entra nel
--     badge della campanella. Non esiste alcun produttore push per i
--     messaggi, né per Archive/Reactivate (§17).
--   · `claim_push_deliveries` rivalida solo cose da campanella (già aperta,
--     superata, contenuto leggibile). Per un messaggio la validità è un'altra:
--     destinatario ancora partecipante dello STESSO periodo, gruppo non
--     eliminato, messaggio esistente e non già letto, mute, preferenza
--     globale, TTL (§15, §16, QA-088, QA-122). Il copy di un messaggio non può
--     stare in una riga: si ricava al claim, dal messaggio, rispettando la
--     preferenza «Mostra anteprima» corrente (§15).
--   · Gli eventi strutturali dei gruppi (aggiunta, rimozione, promozione,
--     demozione, eliminazione) non producono nulla per la persona
--     interessata (§17, §18, §19). I comandi della 33 scrivono periodi e
--     audit, ma nessuno li traduce in notifiche; e `notifications` non ha né i
--     cinque tipi né un target `conversation`.
--
-- Scelte (§ = paragrafo della task):
--
--   1. UNA coda. Si estende la tabella esistente invece di crearne una
--      parallela (§1, DOD-001): `notification_id` diventa nullable, nascono
--      `kind` ('notification' | 'chat_message' | 'group_lifecycle'),
--      `conversation_id`, `message_id`, `period_id`, `event_key`. Un CHECK
--      lega la forma al tipo: una delivery di campanella ha la notifica e
--      nessun messaggio; una chat ha messaggio e conversazione e nessuna
--      notifica. Il motivo di soppressione resta nella colonna `reason`
--      esistente (il contratto prevedeva una colonna `suppress_reason`: una
--      seconda colonna con lo stesso significato sarebbe due verità).
--      `message_id` e `conversation_id` hanno FK con cascade: la pulizia del
--      gruppo eliminato (cleanup_sweep cancella i messaggi) toglie anche le
--      delivery, senza produttori da ricordare.
--      `unique (recipient_profile_id, event_key)` è l'idempotenza della chat:
--      l'event_key è 'msg:<id>' o 'life:<id>'. Una delivery di chat non
--      conta mai nel tetto orario HOM-14 (§15: «le chat sono esenti dal rate
--      limit social»); il conteggio esistente in footme_notification_
--      enqueue_push ora filtra `kind = 'notification'`, altrimenti le chat in
--      priorità HIGH sommergerebbero Mention e risposte.
--   2. DECISIONE STORICA all'enqueue (§16, QA-039). Il trigger AFTER INSERT su
--      `messages` valuta mute e preferenza «Messaggi» AL MOMENTO
--      dell'invio e scrive la delivery già `suppressed` ('muted' |
--      'preference_off') quando serve. Una push soppressa per mute non
--      diventa mai pending: quando il mute scade non riparte nessuna raffica
--      arretrata e un retry non la resuscita. Il claim ricontrolla comunque
--      mute e preferenza «adesso»: un mute attivato fra enqueue e invio
--      sopprime, una scadenza non rende consegnabile ciò che era stato
--      soppresso. Il trigger gira in un sotto-blocco con handler: l'INSERT di
--      un messaggio non fallisce mai per colpa della push. Non scrive righe
--      per chi non ha alcun dispositivo attivo (come footme_notification_
--      enqueue_push: in un gruppo grande sarebbe amplificazione di scrittura
--      senza informazione).
--   3. `claim_push_deliveries` riemessa dall'ULTIMA definizione
--      (20261129090000) con un ramo per `kind`. Il tipo di ritorno cambia
--      (tre colonne in coda: d_kind, d_thread_id, d_ttl_seconds): serve DROP +
--      CREATE e un nuovo grant al solo service_role. Nuovi motivi di
--      soppressione: message_gone, group_deleted, not_participant, expired,
--      already_read, muted, stale. TTL da `notification.push.message_ttl_minutes`
--      (default 360); il TTL consegnato a Expo è il RESIDUO, così un invio
--      ritardato non sopravvive oltre la finestra.
--   4. COPY al claim (§15, DOD-026). GROUP con anteprima: titolo = nome
--      gruppo, corpo «{Mittente}: {testo}» (testo compresso, senza
--      caratteri di controllo, al più 120 caratteri); allegati «{Mittente} ha
--      inviato una foto./un video./un documento.»; mai filename, URL,
--      recapiti. Senza anteprima: «Nuovo messaggio», niente mittente, niente
--      testo; GROUP mantiene il nome gruppo, DIRECT non ha titolo (il client
--      di sistema mostra il nome dell'app). Lifecycle: nome gruppo + «Il
--      gruppo è stato archiviato./riattivato.». Il payload `data` porta solo
--      {conversation_id, period_id, kind}: il body non viaggia nei dati.
--   5. Cinque tipi strutturali in `notifications` (categoria 'attivita',
--      target_type 'conversation', target_id = conversation_id,
--      target_params = {period_id, intent, group_name, society_name,
--      group_avatar_path}: snapshot minimo al momento dell'evento, §17-§18).
--      Controllo globale push = «Messaggi» (nessun nuovo toggle, §18); il
--      mute della conversazione NON li sopprime (§18), la preferenza globale
--      sì. Il titolo della riga porta il nome del gruppo (copy normativo §17);
--      il push li rende con quel titolo e nessun corpo. Priorità HIGH
--      (cambiano accesso o ruolo): hanno un contatore orario separato da
--      LOW/MEDIUM.
--   6. PRODUTTORI = trigger sui periodi (`society_group_membership_periods`),
--      non riemissione delle RPC dei comandi della 33: ogni comando passa da
--      lì, il confine transazionale è lo stesso, l'idempotenza è la source key
--      con `period_id` (+ versione del periodo per promozione/demozione).
--      - INSERT periodo        → Added, salvo added_by = profile_id (il
--        creator che si auto-inserisce come primo ADMIN);
--      - fine REMOVED / SOCIETY_RELATION_ENDED → Removed (LEFT: niente, §17);
--      - fine GROUP_DELETED    → Deleted, salvo chi ha eliminato (§QA-105);
--      - member_role cambia su periodo attivo → Promoted / Demoted, salvo
--        self-change. La promozione già presente è un no-op già a monte
--        (la guard dei partecipanti non tocca il periodo se il ruolo è
--        uguale): nessuna notifica.
--      Dati verificati sul codice: `added_by_profile_id` e
--      `ended_by_profile_id` valgono auth.uid() del comando; la cessazione
--      automatica apre la finestra `society_groups.end_system` e scrive
--      ended_by NULL (20261113110000): nessun attore da escludere, il
--      destinatario riceve Removed. Per Archive/Reactivate il SYSTEM_EVENT
--      ha payload vuoto: l'attore è auth.uid() del comando, o nessuno se la
--      finestra end_system è accesa (auto-archiviazione). Nessuna delle due
--      cose richiede di riemettere le RPC.
--      Un errore nella notifica non blocca mai il comando di dominio (sotto-
--      blocco con handler), ma NON si perde senza traccia: vedi la scelta 9.
--   7. REVALIDAZIONE al dispatch (§18, QA-088). Added / Promoted / Demoted
--      sono sospesi come 'stale' se il periodo indicato non è più quello
--      corrente del destinatario (o il ruolo non è più quello promesso); la
--      riga di campanella storica resta. Alla fine di un periodo (rimozione,
--      eliminazione) le chat pending di quel destinatario in quella
--      conversazione sono sospese subito (trigger), non soltanto al claim.
--   8. Wake: il cron `notification-push-wake` gira ogni minuto, troppo per
--      una chat. Si tenta la cadenza a 10 secondi (pg_cron >= 1.5), con
--      ripiego silenzioso sulla cadenza esistente. NON verificabile in locale
--      (PGlite non ha pg_cron): da controllare sul remoto.
--   9. DEAD-LETTER e REPLAY (§23: «Notification Center e Push hanno retry/stato
--      separati, dead-letter/recupero osservabile»). Se il sotto-blocco di un
--      produttore (notifica strutturale) o dell'enqueue di una chat fallisce,
--      l'handler scrive una riga in `messaging_effect_dead_letters` (tabella
--      chiusa al client): solo identificativi tecnici (tipo, conversation_id,
--      period_id, destinatario, attore, message_id, source/event key), mai
--      testo né nomi. `messaging_effects_replay` rigioca le righe dovute con
--      le STESSE source key / event_key: il replay non duplica (footme_notify_
--      event e l'unique su event_key sono già idempotenti). Backoff
--      esponenziale, al più 5 tentativi poi la riga resta non risolta e
--      visibile (attempts >= 5, resolved_at nullo). Agganciata a un nuovo job
--      pg_cron ogni 5 minuti, stesso schema e stessa guardia di
--      notification-outbox-drain. Se la dead-letter non è scrivibile (stesso
--      errore a monte, ad esempio tabella o disco), resta il solo warning. La
--      delivery rigiocata nasce con created_at = invio del messaggio: il TTL
--      conta dall'invio, non dal replay, quindi una chat vecchia scade invece
--      di arrivare in ritardo.
--
-- Funzioni riemesse, ciascuna dalla sua ULTIMA definizione (tutte in
-- 20261129090000_home_notifications.sql; 20261130 e 20261201 non le toccano):
--   · notifications_client_guard          (+5 tipi vietati ai client)
--   · notifications_before_insert         (+5 tipi, categoria 'attivita')
--   · footme_notification_default_title   (+5 titoli di ripiego)
--   · footme_notification_push_category   (+5 tipi → 'messages')
--   · footme_notification_priority        (+5 tipi → 'high')
--   · footme_notification_enqueue_push    (conteggio orario solo kind=notification)
--   · footme_notification_push_copy       (+5 tipi: titolo della riga, nessun corpo)
--   · claim_push_deliveries               (ramo per kind; DROP + CREATE)
-- NON riemesse: complete_push_delivery (aggiorna `notifications` per
-- notification_id: con NULL non tocca nulla), footme_notify_event (i
-- produttori passano il titolo con un UPDATE dopo l'evento), le RPC dei
-- comandi della 33.
--
-- Dipende dalla migrazione 20261202090000_messaging_personal_state.sql, di cui
-- RIUSA (non duplica) le regole: `footme_conversation_is_muted` (mute effettivo,
-- scadenza lazy, solo periodo corrente), `footme_notification_push_enabled`
-- con le categorie 'messages' e 'message_preview' (già riemessa lì, da
-- 20261129090000), `conversation_participants.last_read_seq` (già letto).
-- Non riemette quella funzione: una seconda copia cancellerebbe il ramo
-- 'message_preview'. Le funzioni SQL che leggono quelle colonne si validano
-- alla creazione: senza quella migrazione questa fallisce subito, non a
-- runtime.
--
-- Rollout: pubblicare la Edge Function `send-push` PRIMA di questa migrazione.
-- La nuova funzione accetta anche le righe nel vecchio formato; la vecchia
-- funzione non saprebbe consegnare una chat (nessun `notification_id`).
-- Dati: nessun backfill, nessuna riga cancellata; le delivery esistenti
-- restano kind='notification'. Nulla è eseguito sul remoto da questo file.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — coda push generalizzata (§1, §15)
-- ============================================================

alter table public.notification_push_deliveries
  alter column notification_id drop not null,
  alter column revision set default 0;

alter table public.notification_push_deliveries
  add column if not exists kind            text not null default 'notification',
  add column if not exists conversation_id uuid references public.conversations(id) on delete cascade,
  add column if not exists message_id      uuid references public.messages(id) on delete cascade,
  add column if not exists period_id       uuid,
  add column if not exists event_key       text;

alter table public.notification_push_deliveries
  drop constraint if exists notification_push_deliveries_kind_check,
  drop constraint if exists notification_push_deliveries_shape_check;

alter table public.notification_push_deliveries
  add constraint notification_push_deliveries_kind_check
    check (kind in ('notification', 'chat_message', 'group_lifecycle')),
  /* La forma dipende dal tipo: la campanella ha la notifica e nessun
     messaggio, la chat ha messaggio, conversazione e chiave evento e nessuna
     notifica. Impedisce una delivery «a metà» che il claim non saprebbe
     rivalidare. */
  add constraint notification_push_deliveries_shape_check check (
    (kind = 'notification'
       and notification_id is not null and message_id is null)
    or (kind in ('chat_message', 'group_lifecycle')
       and notification_id is null and message_id is not null
       and conversation_id is not null and event_key is not null));

/* Idempotenza della chat: un messaggio (o evento di ciclo di vita) produce al
   più una delivery per destinatario, anche se il trigger rigira. */
create unique index if not exists notification_push_deliveries_event_uniq
  on public.notification_push_deliveries (recipient_profile_id, event_key)
  where event_key is not null;

/* Servono alla soppressione eager (fine periodo) e al cascade da conversazione
   e da messaggio. */
create index if not exists notification_push_deliveries_conversation_idx
  on public.notification_push_deliveries (conversation_id, recipient_profile_id)
  where conversation_id is not null;

create index if not exists notification_push_deliveries_message_idx
  on public.notification_push_deliveries (message_id)
  where message_id is not null;

insert into public.app_policy_settings (key, value, description)
values
  ('notification.push.message_ttl_minutes', to_jsonb(360),
   'DAS-REV-34 §16 — TTL di una push di messaggio o di ciclo di vita: oltre non si invia e il TTL verso Expo è il residuo.'),
  ('notification.push.structural_ttl_minutes', to_jsonb(1440),
   'DAS-REV-34 §18 — TTL verso Expo delle push strutturali dei gruppi (aggiunto, rimosso, ruolo, eliminato).')
on conflict (key) do nothing;


-- ============================================================
-- SEZIONE 2 — cinque tipi strutturali in `notifications` (§17, §18)
-- ============================================================

alter table public.notifications
  drop constraint if exists notifications_target_type_check;

alter table public.notifications
  add constraint notifications_target_type_check check (
    target_type is null
    or target_type in ('profile', 'content', 'comment', 'scheduled_content', 'conversation'));

/* Guardia dei client (QA-132): i cinque tipi derivano solo da mutation
   server-side. Anche senza questa voce un client non potrebbe scrivere il
   target 'conversation' (target_type is not null è già vietato), ma il tipo
   resta vietato esplicitamente: la regola non dipende da un effetto
   collaterale. */
create or replace function public.notifications_client_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated')
     or coalesce(current_setting('footme.notify_internal', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.type in ('content_liked', 'content_commented', 'comment_replied', 'identity_mentioned',
                    'simple_reposted', 'post_reposted_with_text', 'new_follower',
                    'scheduled_content_published', 'scheduled_content_failed',
                    'group_member_added', 'group_member_removed', 'group_admin_promoted', 'group_admin_demoted', 'group_deleted')
       or new.actor_identity_type is not null or new.actor_identity_id is not null
       or new.recipient_identity_type is not null or new.recipient_identity_id is not null
       or new.target_type is not null or new.target_id is not null
       or new.target_params is distinct from '{}'::jsonb
       or new.event_count is distinct from 1
       or new.priority is distinct from 'medium'
       or new.source_event_key is not null
       or new.aggregate_key is not null
       or new.preview_snapshot is not null
       or new.push_state is not null then
      raise exception 'notification_internal_only' using errcode = '42501';
    end if;
    return new;
  end if;

  if (to_jsonb(new) - 'is_read' - 'read_revision' - 'seen_revision')
     is distinct from (to_jsonb(old) - 'is_read' - 'read_revision' - 'seen_revision') then
    raise exception 'notification_update_forbidden' using errcode = '42501';
  end if;

  if (new.read_revision is distinct from old.read_revision
      and (new.read_revision is null or new.read_revision > old.revision
           or new.read_revision < coalesce(old.read_revision, 0)))
     or (new.seen_revision is distinct from old.seen_revision
         and (new.seen_revision is null or new.seen_revision > old.revision
              or new.seen_revision < old.seen_revision)) then
    raise exception 'notification_update_forbidden' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.notifications_client_guard() from public;
revoke execute on function public.notifications_client_guard() from anon, authenticated;

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
    /* DAS-REV-31 */
    when 'selection_event_cancelled'               then 'candidature'
    when 'selection_event_updated'                 then 'candidature'
    when 'selection_event_invitation_accepted'     then 'candidature'
    when 'selection_event_invitation_declined'     then 'candidature'
    when 'selection_event_participation_withdrawn' then 'candidature'
    when 'content_tag'                              then 'attivita'
    when 'new_follower'                             then 'attivita'
    /* HOM-14 */
    when 'content_liked'                            then 'attivita'
    when 'content_commented'                        then 'attivita'
    when 'comment_replied'                          then 'attivita'
    when 'identity_mentioned'                       then 'attivita'
    when 'simple_reposted'                          then 'attivita'
    when 'post_reposted_with_text'                  then 'attivita'
    when 'scheduled_content_published'              then 'attivita'
    when 'scheduled_content_failed'                 then 'attivita'
    /* DAS-REV-34: notifiche strutturali dei gruppi (§17) */
    when 'group_member_added'                           then 'attivita'
    when 'group_member_removed'                         then 'attivita'
    when 'group_admin_promoted'                         then 'attivita'
    when 'group_admin_demoted'                          then 'attivita'
    when 'group_deleted'                                then 'attivita'
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
    /* DAS-REV-31 */
    when 'selection_event_cancelled'               then 'applications'
    when 'selection_event_updated'                 then 'applications'
    when 'selection_event_invitation_accepted'     then 'applications'
    when 'selection_event_invitation_declined'     then 'applications'
    when 'selection_event_participation_withdrawn' then 'applications'
    when 'content_tag'                              then 'content_tags'
    when 'promo'                                    then 'promotions'
    else null
  end;

  if v_pref_key is not null then
    select case v_pref_key
      when 'requests'      then prefs.requests
      when 'applications'  then prefs.applications
      when 'content_tags'  then prefs.content_tags
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
revoke execute on function public.notifications_before_insert() from anon, authenticated;

create or replace function public.footme_notification_default_title(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'content_liked'               then 'Nuovo Mi piace'
    when 'content_commented'           then 'Nuovo commento'
    when 'comment_replied'             then 'Nuova risposta'
    when 'identity_mentioned'          then 'Nuova menzione'
    when 'simple_reposted'             then 'Nuovo repost'
    when 'post_reposted_with_text'     then 'Nuovo repost con testo'
    when 'new_follower'                then 'Nuovo follower'
    when 'scheduled_content_published' then 'Il contenuto programmato è stato pubblicato'
    when 'scheduled_content_failed'    then 'Non è stato possibile pubblicare un contenuto programmato'
    /* DAS-REV-34: ripiego; il produttore scrive il titolo col nome del gruppo */
    when 'group_member_added'          then 'Sei stato aggiunto a un gruppo'
    when 'group_member_removed'        then 'Non fai più parte di un gruppo'
    when 'group_admin_promoted'        then 'Ora sei amministratore di un gruppo'
    when 'group_admin_demoted'         then 'Non sei più amministratore di un gruppo'
    when 'group_deleted'               then 'Un gruppo è stato eliminato'
    else 'Notifica'
  end;
$$;

revoke all on function public.footme_notification_default_title(text) from public;
revoke execute on function public.footme_notification_default_title(text) from anon, authenticated;

create or replace function public.footme_notification_push_category(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'content_commented'            then 'comments_replies'
    when 'comment_replied'              then 'comments_replies'
    when 'identity_mentioned'           then 'mentions'
    when 'simple_reposted'              then 'reposts'
    when 'post_reposted_with_text'      then 'reposts'
    when 'new_follower'                 then 'new_followers'
    when 'content_liked'                then 'likes'
    when 'scheduled_content_published'  then 'scheduled_content'
    when 'scheduled_content_failed'     then 'scheduled_content'
    /* DAS-REV-34 §18: controllo globale = «Messaggi» */
    when 'group_member_added'             then 'messages'
    when 'group_member_removed'           then 'messages'
    when 'group_admin_promoted'           then 'messages'
    when 'group_admin_demoted'            then 'messages'
    when 'group_deleted'                  then 'messages'
    else null
  end;
$$;

revoke all on function public.footme_notification_push_category(text) from public;
revoke execute on function public.footme_notification_push_category(text) from anon, authenticated;

create or replace function public.footme_notification_priority(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'identity_mentioned'          then 'high'
    when 'comment_replied'             then 'high'
    when 'scheduled_content_failed'    then 'high'
    /* DAS-REV-34: cambiano accesso o ruolo, contatore orario HIGH separato */
    when 'group_member_added'             then 'high'
    when 'group_member_removed'           then 'high'
    when 'group_admin_promoted'           then 'high'
    when 'group_admin_demoted'            then 'high'
    when 'group_deleted'                  then 'high'
    when 'content_liked'               then 'low'
    else 'medium'
  end;
$$;

revoke all on function public.footme_notification_priority(text) from public;
revoke execute on function public.footme_notification_priority(text) from anon, authenticated;

create or replace function public.footme_notification_enqueue_push(p_notification_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_n        public.notifications%rowtype;
  v_cat      text;
  v_max      integer;
  v_interval integer;
  v_recent   integer;
begin
  select n.* into v_n from public.notifications n where n.id = p_notification_id;
  if v_n.id is null then
    return;
  end if;

  v_cat := public.footme_notification_push_category(v_n.type);
  if v_cat is null then
    return;
  end if;

  /* Nessuna push per una riga che il Centro non mostrerebbe a questo account. */
  if not public.footme_notification_account_allowed(
           v_n.recipient_profile_id, v_n.type, v_n.recipient_identity_type, v_n.recipient_identity_id) then
    update public.notifications n set push_state = 'suppressed' where n.id = v_n.id;
    return;
  end if;

  if not public.footme_notification_push_enabled(v_n.recipient_profile_id, v_cat) then
    update public.notifications n set push_state = 'suppressed' where n.id = v_n.id;
    return;
  end if;

  if not exists (
    select 1 from public.notification_push_devices d
    where d.profile_id = v_n.recipient_profile_id and d.enabled) then
    return;
  end if;

  v_interval := public.footme_policy_int('notification.push.min_interval_minutes.' || v_n.priority,
                                         case v_n.priority when 'low' then 60 when 'medium' then 5 else 0 end);
  v_max := public.footme_policy_int('notification.push.max_per_hour.' || v_n.priority,
                                    case v_n.priority when 'low' then 3 when 'medium' then 10 else 30 end);

  /* Conteggio e inserimento del tetto orario sono atomici per (account,
     priorità): due transazioni concorrenti non superano il tetto insieme. */
  perform pg_advisory_xact_lock(
    hashtextextended('push:' || v_n.recipient_profile_id::text || ':' || v_n.priority, 15));

  if v_interval > 0 and exists (
       select 1 from public.notification_push_deliveries d
       where d.notification_id = v_n.id
         and d.status in ('pending', 'sent')
         and d.created_at > clock_timestamp() - make_interval(mins => v_interval)) then
    update public.notifications n set push_state = 'suppressed' where n.id = v_n.id;
    return;
  end if;

  select count(*)::integer into v_recent
  from public.notification_push_deliveries d
  where d.recipient_profile_id = v_n.recipient_profile_id
    and d.kind = 'notification'
    and d.priority = v_n.priority
    and d.status in ('pending', 'sent')
    and d.created_at > clock_timestamp() - interval '1 hour';

  if v_recent >= v_max then
    update public.notifications n set push_state = 'suppressed' where n.id = v_n.id;
    return;
  end if;

  insert into public.notification_push_deliveries
    (notification_id, recipient_profile_id, revision, priority, category, created_at)
  values
    (v_n.id, v_n.recipient_profile_id, v_n.revision, v_n.priority, v_cat, clock_timestamp())
  on conflict (notification_id, revision) do nothing;

  update public.notifications n set push_state = 'pending' where n.id = v_n.id;
end;
$$;

revoke all on function public.footme_notification_enqueue_push(uuid) from public;
revoke execute on function public.footme_notification_enqueue_push(uuid) from anon, authenticated;

create or replace function public.footme_notification_push_copy(
  p_notification_id uuid,
  out o_title text,
  out o_body  text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_n    public.notifications%rowtype;
  v_who  text;
  v_verb text;
  v_rec  text;
begin
  select n.* into v_n from public.notifications n where n.id = p_notification_id;
  if v_n.id is null then
    return;
  end if;

  o_title := v_n.title;

  /* DAS-REV-34: i cinque tipi dei gruppi hanno il copy nel titolo della riga
     (nome del gruppo incluso) e nessun corpo. */
  if v_n.type in ('scheduled_content_published', 'scheduled_content_failed',
                  'group_member_added', 'group_member_removed', 'group_admin_promoted', 'group_admin_demoted', 'group_deleted') then
    o_body := null;
    return;
  end if;

  select case v_n.actor_identity_type
           when 'society' then (select c.name from public.clubs c where c.id = v_n.actor_identity_id)
           when 'media'   then (select coalesce(nullif(btrim(m.entity_name), ''), nullif(btrim(p.full_name), ''))
                                from public.profiles p left join public.media_profiles m on m.profile_id = p.id
                                where p.id = v_n.actor_identity_id)
           else (select nullif(btrim(p.full_name), '') from public.profiles p where p.id = v_n.actor_identity_id)
         end into v_who;
  v_who := coalesce(v_who, 'Un profilo');

  if v_n.event_count > 1 then
    v_who := v_who || ' e altre ' || (v_n.event_count - 1)::text
             || case when v_n.event_count - 1 = 1 then ' persona' else ' persone' end;
  end if;

  v_verb := case v_n.type
    when 'content_liked'           then 'ha messo Mi piace al tuo contenuto'
    when 'content_commented'       then 'ha commentato il tuo contenuto'
    when 'comment_replied'         then 'ha risposto al tuo commento'
    when 'identity_mentioned'      then 'ti ha menzionato'
    when 'simple_reposted'         then 'ha ripostato il tuo contenuto'
    when 'post_reposted_with_text' then 'ha ripostato il tuo contenuto aggiungendo un testo'
    when 'new_follower'            then 'ha iniziato a seguirti'
    else 'ha una nuova attività'
  end;
  if v_n.event_count > 1 and left(v_verb, 3) = 'ha ' then
    v_verb := 'hanno ' || substr(v_verb, 4);
  end if;

  v_rec := case when v_n.recipient_identity_type = 'society'
                then (select c.name from public.clubs c where c.id = v_n.recipient_identity_id) end;

  o_body := v_who || ' ' || v_verb || case when v_rec is not null then ' (' || v_rec || ')' else '' end;
end;
$$;

revoke all on function public.footme_notification_push_copy(uuid) from public;
revoke execute on function public.footme_notification_push_copy(uuid) from anon, authenticated;


-- ============================================================
-- SEZIONE 3 — push dei messaggi e del ciclo di vita (§15, §16, §17)
-- ============================================================

/**
 * Copy minimo di una push di conversazione (§15, DOD-026). Chiamata dal claim,
 * mai dal client. Ricava tutto dal messaggio e dalla preferenza «Mostra
 * anteprima» DEL MOMENTO: una anteprima disattivata dopo l'enqueue non viene
 * mai consegnata.
 *
 * Mai: filename (il `body` di un allegato non si usa), URL firmati, recapiti,
 * contenuto di un CONTACT_SHARE, riferimento di un contenuto condiviso.
 * Il testo è compresso, senza caratteri di controllo, al più 120 caratteri
 * (footme_notification_preview, lo stesso servizio della campanella).
 */
create or replace function public.footme_push_chat_copy(
  p_kind       text,
  p_message_id uuid,
  p_recipient  uuid,
  out o_title  text,
  out o_body   text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_m      public.messages%rowtype;
  v_type   text;
  v_group  text;
  v_who    text;
  v_text   text;
  v_action text;
begin
  select m.* into v_m from public.messages m where m.id = p_message_id;
  if v_m.id is null then
    return;
  end if;

  select c.conversation_type into v_type from public.conversations c where c.id = v_m.conversation_id;

  if v_type = 'group' then
    select coalesce(nullif(btrim(g.name), ''), nullif(btrim(c.title), ''), 'Gruppo') into v_group
    from public.conversations c
    left join public.society_groups g on g.conversation_id = c.id
    where c.id = v_m.conversation_id;
  end if;

  if p_kind = 'group_lifecycle' then
    o_title := v_group;
    o_body := case v_m.system_event_type
      when 'GROUP_ARCHIVED'    then 'Il gruppo è stato archiviato.'
      when 'GROUP_REACTIVATED' then 'Il gruppo è stato riattivato.'
    end;
    return;
  end if;

  /* Senza anteprima: né mittente né testo né tipo di allegato. */
  if not public.footme_notification_push_enabled(p_recipient, 'message_preview') then
    o_title := v_group;
    o_body := 'Nuovo messaggio';
    return;
  end if;

  select coalesce(nullif(btrim(mp.entity_name), ''), nullif(btrim(p.full_name), '')) into v_who
  from public.profiles p
  left join public.media_profiles mp on mp.profile_id = p.id
  where p.id = v_m.sender_profile_id;

  v_action := case v_m.message_kind
    when 'image'             then 'ha inviato una foto.'
    when 'video'             then 'ha inviato un video.'
    when 'document'          then 'ha inviato un documento.'
    when 'contact_card'      then 'ha condiviso un contatto.'
    when 'content_reference' then 'ha condiviso un contenuto.'
    else 'ha inviato un messaggio.'
  end;

  /* Il testo si usa solo dove è davvero testo scritto dal mittente: per gli
     allegati il body può contenere il nome del file. */
  if v_m.message_kind in ('text', 'content_reference') then
    v_text := public.footme_notification_preview(regexp_replace(coalesce(v_m.body, ''), '[[:cntrl:]]+', ' ', 'g'));
  end if;

  if v_type = 'group' then
    o_title := v_group;
    o_body := coalesce(v_who, 'Un profilo')
              || case when v_text is not null then ': ' || v_text else ' ' || v_action end;
  else
    o_title := v_who;
    o_body := coalesce(v_text, upper(left(v_action, 1)) || substr(v_action, 2));
  end if;
end;
$$;

revoke all on function public.footme_push_chat_copy(text, uuid, uuid) from public;
revoke execute on function public.footme_push_chat_copy(text, uuid, uuid) from anon, authenticated;

/* Dead-letter degli effetti di messaging (§23). Chiusa al client. Un effetto
   che non si è potuto scrivere nella transazione del comando di dominio resta
   qui, osservabile e rigiocabile; il comando non fallisce. `dedup_key` è la
   source key (notifica) o l'event_key (push): un secondo fallimento dello
   stesso effetto non crea una seconda riga. */
create table if not exists public.messaging_effect_dead_letters (
  id              bigserial   primary key,
  effect          text        not null check (effect in ('group_notification', 'chat_push')),
  dedup_key       text        not null,
  payload         jsonb       not null,
  sqlstate        text,
  attempts        integer     not null default 0,
  next_attempt_at timestamptz not null default timezone('utc', now()),
  resolved_at     timestamptz,
  created_at      timestamptz not null default timezone('utc', now()),
  unique (effect, dedup_key)
);

create index if not exists messaging_effect_dead_letters_due_idx
  on public.messaging_effect_dead_letters (next_attempt_at)
  where resolved_at is null;

alter table public.messaging_effect_dead_letters enable row level security;
revoke all on public.messaging_effect_dead_letters from public, anon, authenticated;
revoke all on sequence public.messaging_effect_dead_letters_id_seq from public, anon, authenticated;

comment on table public.messaging_effect_dead_letters is
  'DAS-REV-34 §23: effetti di notifica/push non scritti (errore nel sotto-blocco). Solo id tecnici, nessun testo né nome. Rigiocati da messaging_effects_replay.';

create or replace function public.footme_effect_dead_letter(
  p_effect   text,
  p_dedup    text,
  p_payload  jsonb,
  p_sqlstate text
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  begin
    insert into public.messaging_effect_dead_letters (effect, dedup_key, payload, sqlstate)
    values (p_effect, p_dedup, p_payload, p_sqlstate)
    on conflict (effect, dedup_key) do nothing;
  exception when others then
    raise warning 'DAS-REV-34: dead-letter non scrivibile (%)', sqlstate;
  end;
end;
$$;

revoke all on function public.footme_effect_dead_letter(text, text, jsonb, text) from public;
revoke execute on function public.footme_effect_dead_letter(text, text, jsonb, text) from anon, authenticated;

/**
 * Cuore dell'enqueue di chat/lifecycle per UN messaggio (§15, §17). Chiamata
 * dal trigger e dal replay della dead-letter: una sola implementazione,
 * idempotente (unique su recipient+event_key, on conflict do nothing).
 * Un messaggio normale produce una delivery `chat_message` per ogni
 * partecipante diverso dal mittente con accesso al messaggio (seq >=
 * access_from_seq: nessuna push per ciò che il periodo non può leggere);
 * GROUP_ARCHIVED / GROUP_REACTIVATED producono una `group_lifecycle` per i
 * membri attuali escluso p_actor (NULL = azione automatica, nessuno escluso).
 * Nessuna riga in `notifications`.
 *
 * Decisione storica (§16, QA-039): mute attivo ADESSO → delivery già
 * `suppressed` 'muted'; preferenza «Messaggi» spenta → 'preference_off'. Non
 * diventano mai pending. created_at = invio del messaggio (non l'ora
 * dell'enqueue): in un replay il TTL conta dall'invio.
 */
create or replace function public.footme_message_push_enqueue(
  p_message_id uuid,
  p_actor      uuid default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_m     public.messages%rowtype;
  v_kind  text;
  v_actor uuid;
  v_key   text;
  v_rows  integer;
begin
  select m.* into v_m from public.messages m where m.id = p_message_id;
  if v_m.id is null then
    return 0;
  end if;

  if v_m.message_kind = 'system_event' then
    if v_m.system_event_type not in ('GROUP_ARCHIVED', 'GROUP_REACTIVATED') then
      return 0;
    end if;
    v_kind  := 'group_lifecycle';
    v_actor := p_actor;
    v_key   := 'life:' || v_m.id::text;
  else
    if v_m.sender_profile_id is null then
      return 0;
    end if;
    v_kind  := 'chat_message';
    v_actor := v_m.sender_profile_id;
    v_key   := 'msg:' || v_m.id::text;
  end if;

  insert into public.notification_push_deliveries
    (kind, notification_id, recipient_profile_id, revision, priority, category,
     status, reason, processed_at, conversation_id, message_id, period_id, event_key, created_at)
  select v_kind, null, cp.profile_id, 0,
         case when v_kind = 'chat_message' then 'high' else 'medium' end,
         'messages',
         case when s.reason is null then 'pending' else 'suppressed' end,
         s.reason,
         case when s.reason is null then null else clock_timestamp() end,
         v_m.conversation_id, v_m.id, cp.period_id, v_key,
         least(clock_timestamp(), coalesce(v_m.sent_at, clock_timestamp()))
  from public.conversation_participants cp
  cross join lateral (
    select case
             when public.footme_conversation_is_muted(cp.conversation_id, cp.profile_id) then 'muted'
             when not public.footme_notification_push_enabled(cp.profile_id, 'messages') then 'preference_off'
           end as reason) s
  where cp.conversation_id = v_m.conversation_id
    and cp.profile_id is distinct from v_actor
    and v_m.seq >= cp.access_from_seq
    and exists (
      select 1 from public.notification_push_devices d
      where d.profile_id = cp.profile_id and d.enabled)
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.footme_message_push_enqueue(uuid, uuid) from public;
revoke execute on function public.footme_message_push_enqueue(uuid, uuid) from anon, authenticated;

/**
 * AFTER INSERT su `messages` (§15, §17). Delega a footme_message_push_enqueue.
 * L'attore di Archive/Reactivate non è nel payload del SYSTEM_EVENT (vuoto): è
 * l'utente del comando, o nessuno se la finestra di sistema è accesa
 * (auto-archiviazione per fine del titolo).
 *
 * Mai far fallire l'INSERT del messaggio: tutto in un sotto-blocco con
 * handler. L'errore non si perde: finisce in messaging_effect_dead_letters e
 * il replay lo rigioca. Il warning non riporta testo né nomi.
 */
create or replace function public.messages_enqueue_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_state text;
begin
  v_actor := case when new.message_kind <> 'system_event' then null
                  when coalesce(current_setting('society_groups.end_system', true), '') = 'on' then null
                  else auth.uid() end;
  begin
    perform public.footme_message_push_enqueue(new.id, v_actor);
  exception when others then
    v_state := sqlstate;
    raise warning 'DAS-REV-34: push di messaggio non accodata (%)', v_state;
    perform public.footme_effect_dead_letter(
      'chat_push',
      case when new.message_kind = 'system_event' then 'life:' else 'msg:' end || new.id::text,
      jsonb_build_object('message_id', new.id, 'conversation_id', new.conversation_id, 'actor', v_actor),
      v_state);
  end;

  return new;
end;
$$;

revoke all on function public.messages_enqueue_push() from public;
revoke execute on function public.messages_enqueue_push() from anon, authenticated;

drop trigger if exists messages_enqueue_push on public.messages;
create trigger messages_enqueue_push
  after insert on public.messages
  for each row execute function public.messages_enqueue_push();


-- ============================================================
-- SEZIONE 4 — claim con ramo per kind (§15, §16, §18)
-- ============================================================

/**
 * Riemessa da 20261129090000 (ultima definizione). Il ramo 'notification' è
 * quello di HOM-14, invariato, più la rivalidazione 'stale' dei tre eventi di
 * ruolo/ingresso (§18). Il ramo di chat/lifecycle rivalida ADESSO il
 * destinatario: messaggio esistente, gruppo non eliminato, ancora partecipante
 * dello stesso periodo con accesso al messaggio, TTL, già letto (solo chat),
 * mute, preferenza «Messaggi», stato del gruppo coerente con l'evento
 * (lifecycle), blocco (solo DIRECT), dispositivo.
 *
 * Colonne OUT in coda (d_kind, d_thread_id, d_ttl_seconds): per questo
 * DROP + CREATE. `d_thread_id` = conversation_id quando la push riguarda una
 * conversazione (chat, lifecycle e le notifiche con target 'conversation').
 * `d_ttl_seconds` è il residuo per Expo; NULL per le notifiche non
 * strutturali (comportamento invariato).
 */
drop function if exists public.claim_push_deliveries(integer);

create or replace function public.claim_push_deliveries(p_limit integer default 50)
returns table (
  d_id              bigint,
  d_notification_id uuid,
  d_recipient       uuid,
  d_priority        text,
  d_title           text,
  d_body            text,
  d_data            jsonb,
  d_tokens          jsonb,
  d_kind            text,
  d_thread_id       text,
  d_ttl_seconds     integer
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_limit      integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_max        integer := greatest(public.footme_policy_int('notification.push.max_attempts', 3), 1);
  v_msg_ttl    integer := greatest(public.footme_policy_int('notification.push.message_ttl_minutes', 360), 1) * 60;
  v_struct_ttl integer := greatest(public.footme_policy_int('notification.push.structural_ttl_minutes', 1440), 1) * 60;
  r            record;
  v_n          public.notifications%rowtype;
  v_m          public.messages%rowtype;
  v_cp         public.conversation_participants%rowtype;
  v_sg         public.society_groups%rowtype;
  v_ctype      text;
  v_age        integer;
  v_reason     text;
  v_tokens     jsonb;
  v_copy       record;
  v_title      text;
  v_body       text;
  v_data       jsonb;
  v_thread     text;
  v_ttl        integer;
begin
  /* Tetto tentativi: una delivery rimasta pending oltre il massimo (worker
     caduto dopo la claim) non riparte più. */
  with dead as (
    update public.notification_push_deliveries d
    set status = 'failed', reason = 'max_attempts', processed_at = clock_timestamp()
    where d.status = 'pending' and d.attempts >= v_max
      and (d.claimed_at is null or d.claimed_at < clock_timestamp() - interval '5 minutes')
    returning d.notification_id
  )
  update public.notifications n set push_state = 'failed'
  from dead where n.id = dead.notification_id;

  for r in
    select d.id, d.kind, d.notification_id, d.revision, d.recipient_profile_id, d.priority, d.category,
           d.conversation_id, d.message_id, d.period_id, d.created_at
    from public.notification_push_deliveries d
    where d.status = 'pending'
      and d.attempts < v_max
      and (d.next_attempt_at is null or d.next_attempt_at <= clock_timestamp())
      and (d.claimed_at is null or d.claimed_at < clock_timestamp() - interval '5 minutes')
    order by case d.priority when 'high' then 0 when 'medium' then 1 else 2 end, d.id
    limit v_limit
    for update skip locked
  loop
    v_reason := null;

    if r.kind = 'notification' then
      select n.* into v_n from public.notifications n where n.id = r.notification_id;

      if v_n.id is null then
        v_reason := 'notification_gone';
      elsif not public.footme_notification_push_enabled(r.recipient_profile_id, r.category) then
        v_reason := 'preference_off';
      elsif not public.footme_notification_account_allowed(
              r.recipient_profile_id, v_n.type, v_n.recipient_identity_type, v_n.recipient_identity_id) then
        v_reason := 'not_recipient';
      elsif coalesce(v_n.read_revision, 0) >= v_n.revision then
        v_reason := 'already_opened';
      elsif r.revision < v_n.revision and exists (
              select 1 from public.notification_push_deliveries x
              where x.notification_id = r.notification_id and x.revision > r.revision) then
        v_reason := 'superseded';
      /* §18, QA-088: Added / Promoted / Demoted non si recapitano in ritardo
         come se fossero attuali. Vale il periodo (e il ruolo) della notifica:
         se il destinatario non è più in quel periodo, o ha un altro ruolo, la
         push è stale. La riga di campanella storica resta. Removed e Deleted
         non hanno controllo: comunicano proprio la fine dell'accesso. */
      elsif v_n.type in ('group_member_added', 'group_admin_promoted', 'group_admin_demoted')
            and not exists (
              select 1 from public.conversation_participants cp
              where cp.conversation_id = v_n.target_id
                and cp.profile_id = r.recipient_profile_id
                and cp.period_id is not distinct from nullif(v_n.target_params ->> 'period_id', '')::uuid
                and (v_n.type <> 'group_admin_promoted' or cp.member_role = 'admin')
                and (v_n.type <> 'group_admin_demoted' or cp.member_role = 'member')) then
        v_reason := 'stale';
      elsif v_n.actor_identity_id is not null and (
              public.footme_notification_identities_blocked(
                v_n.actor_identity_type, v_n.actor_identity_id,
                v_n.recipient_identity_type, v_n.recipient_identity_id)
              or public.footme_identity_blocked(
                r.recipient_profile_id, v_n.actor_identity_type, v_n.actor_identity_id)) then
        v_reason := 'blocked';
      /* §268: follow tolto prima della consegna, Mi piace tolto (dell'ultimo
         attore mostrato): niente push per un evento che non esiste più. */
      elsif v_n.type = 'new_follower' and v_n.actor_identity_id is not null and not (
              case when v_n.recipient_identity_type = 'society'
                   then exists (select 1 from public.club_follows f
                                where f.profile_id = v_n.actor_identity_id and f.club_id = v_n.recipient_identity_id)
                   else exists (select 1 from public.profile_follows f
                                where f.follower_profile_id = v_n.actor_identity_id
                                  and f.followed_profile_id = v_n.recipient_identity_id)
              end) then
        v_reason := 'source_removed';
      elsif v_n.type = 'content_liked' and v_n.actor_identity_id is not null and not exists (
              select 1 from public.content_likes cl
              where cl.content_type = v_n.target_params ->> 'content_type'
                and cl.post_id = v_n.target_id
                and cl.actor_type = v_n.actor_identity_type
                and cl.actor_id = v_n.actor_identity_id) then
        v_reason := 'source_removed';
      elsif v_n.target_type = 'content' and not public.footme_content_readable(
              r.recipient_profile_id, v_n.target_params ->> 'content_type', v_n.target_id) then
        v_reason := 'content_unavailable';
      elsif v_n.target_type = 'comment' and not public.footme_comment_readable(
              r.recipient_profile_id, v_n.target_id) then
        v_reason := 'content_unavailable';
      end if;
    else
      /* chat_message | group_lifecycle */
      select m.* into v_m from public.messages m where m.id = r.message_id;
      select c.conversation_type into v_ctype from public.conversations c where c.id = r.conversation_id;
      select cp.* into v_cp from public.conversation_participants cp
      where cp.conversation_id = r.conversation_id and cp.profile_id = r.recipient_profile_id;
      select g.* into v_sg from public.society_groups g where g.conversation_id = r.conversation_id;
      v_age := floor(extract(epoch from clock_timestamp() - r.created_at))::integer;

      if v_m.id is null or v_ctype is null then
        v_reason := 'message_gone';
      elsif v_sg.deleted_at is not null then
        v_reason := 'group_deleted';
      /* Periodo finito, reingresso (period_id diverso) o messaggio fuori dalla
         finestra del periodo: la vecchia anteprima non torna consegnabile. */
      elsif v_cp.profile_id is null
            or v_cp.period_id is distinct from r.period_id
            or v_m.seq < v_cp.access_from_seq then
        v_reason := 'not_participant';
      elsif v_age > v_msg_ttl then
        v_reason := 'expired';
      elsif r.kind = 'chat_message' and v_cp.last_read_seq >= v_m.seq then
        v_reason := 'already_read';
      elsif public.footme_conversation_is_muted(r.conversation_id, r.recipient_profile_id) then
        v_reason := 'muted';
      elsif not public.footme_notification_push_enabled(r.recipient_profile_id, r.category) then
        v_reason := 'preference_off';
      /* Archive seguito da Reactivate (o il contrario) prima del dispatch:
         non si annuncia uno stato che non è più quello corrente. */
      elsif r.kind = 'group_lifecycle'
            and ((v_m.system_event_type = 'GROUP_ARCHIVED' and v_sg.status is distinct from 'archived')
              or (v_m.system_event_type = 'GROUP_REACTIVATED' and v_sg.status is distinct from 'active')) then
        v_reason := 'stale';
      elsif r.kind = 'chat_message' and v_ctype = 'direct' and v_m.sender_profile_id is not null
            and public.footme_identity_blocked(r.recipient_profile_id, 'person', v_m.sender_profile_id) then
        v_reason := 'blocked';
      end if;
    end if;

    if v_reason is null then
      select coalesce(jsonb_agg(jsonb_build_object('device_id', dv.id, 'token', dv.expo_push_token)), '[]'::jsonb)
        into v_tokens
      from public.notification_push_devices dv
      where dv.profile_id = r.recipient_profile_id and dv.enabled;

      if jsonb_array_length(v_tokens) = 0 then
        v_reason := 'no_device';
      end if;
    end if;

    if v_reason is not null then
      update public.notification_push_deliveries d
      set status = 'suppressed', reason = v_reason, processed_at = clock_timestamp()
      where d.id = r.id;
      update public.notifications n set push_state = 'suppressed' where n.id = r.notification_id;
      continue;
    end if;

    update public.notification_push_deliveries d
    set claimed_at = clock_timestamp(), attempts = d.attempts + 1
    where d.id = r.id;

    if r.kind = 'notification' then
      select * into v_copy from public.footme_notification_push_copy(r.notification_id);
      v_title  := v_copy.o_title;
      v_body   := v_copy.o_body;
      v_data   := jsonb_build_object('notification_id', r.notification_id);
      v_thread := case when v_n.target_type = 'conversation' then v_n.target_id::text end;
      v_ttl    := case when v_n.type in ('group_member_added', 'group_member_removed', 'group_admin_promoted',
                                         'group_admin_demoted', 'group_deleted')
                       then v_struct_ttl end;
    else
      select * into v_copy from public.footme_push_chat_copy(r.kind, r.message_id, r.recipient_profile_id);
      v_title  := v_copy.o_title;
      v_body   := v_copy.o_body;
      /* Solo identificativi tecnici: il testo non viaggia nei dati (§15). */
      v_data   := jsonb_build_object(
                    'conversation_id', r.conversation_id,
                    'period_id', r.period_id,
                    'kind', case r.kind when 'chat_message' then 'message' else 'lifecycle' end);
      v_thread := r.conversation_id::text;
      v_ttl    := greatest(v_msg_ttl - v_age, 1);
    end if;

    d_id              := r.id;
    d_notification_id := r.notification_id;
    d_recipient       := r.recipient_profile_id;
    d_priority        := r.priority;
    d_title           := v_title;
    d_body            := v_body;
    d_data            := v_data;
    d_tokens          := v_tokens;
    d_kind            := r.kind;
    d_thread_id       := v_thread;
    d_ttl_seconds     := v_ttl;
    return next;
  end loop;
end;
$$;

revoke all on function public.claim_push_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_push_deliveries(integer) to service_role;


-- ============================================================
-- SEZIONE 5 — produttori delle notifiche strutturali (§17, §18, §19)
--
-- Trigger sui periodi di appartenenza: ogni comando della 33 (create, add,
-- remove, leave, handover, set role, delete, cessazione automatica) scrive o
-- chiude un periodo nella propria transazione, quindi il confine
-- transazionale è lo stesso del comando e un comando che fallisce non lascia
-- notifiche. Nessuna RPC dei gruppi viene riemessa.
-- ============================================================

/**
 * Scrive UNA notifica strutturale per UN destinatario (via footme_notify_event:
 * idempotenza per source key, blocco, push eligibility, tutto nel motore
 * HOM-14) e ne imposta il titolo normativo (§17: «Sei stato aggiunto al gruppo
 * {nome}», …). Snapshot minimo del gruppo al momento dell'evento: una notifica
 * storica non cambia se il gruppo viene rinominato o eliminato (§18).
 *
 * p_actor è l'account che ha eseguito il comando: non riceve mai l'avviso
 * della propria azione (§17). NULL = azione di sistema, nessuno escluso.
 * Il titolo si scrive solo se footme_notify_event ha creato la riga (un retry
 * con la stessa source key restituisce 0 e non tocca nulla).
 */
create or replace function public.footme_group_notify(
  p_type            text,
  p_intent          text,
  p_source_key      text,
  p_period_id       uuid,
  p_conversation_id uuid,
  p_profile_id      uuid,
  p_actor           uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_name    text;
  v_society text;
  v_avatar  text;
  v_n       integer;
begin
  select g.name, c.name, a.storage_path
    into v_name, v_society, v_avatar
  from public.society_groups g
  left join public.clubs c on c.id = g.club_id
  left join public.society_group_avatar_assets a on a.id = g.avatar_asset_id
  where g.conversation_id = p_conversation_id;

  if v_name is null then
    return;
  end if;

  v_n := public.footme_notify_event(
    p_type, p_source_key,
    null, null, p_actor,
    'person', p_profile_id,
    'conversation', p_conversation_id,
    jsonb_build_object(
      'period_id', p_period_id,
      'intent', p_intent,
      'group_name', v_name,
      'society_name', v_society,
      'group_avatar_path', v_avatar));

  if v_n > 0 then
    update public.notifications n
    set title = case p_type
      when 'group_member_added'   then 'Sei stato aggiunto al gruppo ' || v_name
      when 'group_member_removed' then 'Non fai più parte del gruppo ' || v_name
      when 'group_admin_promoted' then 'Ora sei amministratore del gruppo ' || v_name
      when 'group_admin_demoted'  then 'Non sei più amministratore del gruppo ' || v_name
      when 'group_deleted'        then 'Il gruppo ' || v_name || ' è stato eliminato'
      else n.title
    end
    where n.recipient_profile_id = p_profile_id
      and n.source_event_key = p_source_key;
  end if;
end;
$$;

revoke all on function public.footme_group_notify(text, text, text, uuid, uuid, uuid, uuid) from public;
revoke execute on function public.footme_group_notify(text, text, text, uuid, uuid, uuid, uuid) from anon, authenticated;

/* Esegue footme_group_notify; se fallisce NON propaga: scrive la dead-letter
   (stessa source key del replay) e lascia un warning senza dati personali.
   Restituisce true se l'effetto è stato scritto. */
create or replace function public.footme_group_notify_safe(
  p_type            text,
  p_intent          text,
  p_source_key      text,
  p_period_id       uuid,
  p_conversation_id uuid,
  p_profile_id      uuid,
  p_actor           uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_state text;
begin
  begin
    perform public.footme_group_notify(p_type, p_intent, p_source_key, p_period_id,
                                       p_conversation_id, p_profile_id, p_actor);
    return true;
  exception when others then
    v_state := sqlstate;
    raise warning 'DAS-REV-34: notifica % non prodotta (%)', p_intent, v_state;
    perform public.footme_effect_dead_letter(
      'group_notification', p_source_key,
      jsonb_build_object('type', p_type, 'intent', p_intent, 'source_key', p_source_key,
                         'period_id', p_period_id, 'conversation_id', p_conversation_id,
                         'profile_id', p_profile_id, 'actor', p_actor),
      v_state);
    return false;
  end;
end;
$$;

revoke all on function public.footme_group_notify_safe(text, text, text, uuid, uuid, uuid, uuid) from public;
revoke execute on function public.footme_group_notify_safe(text, text, text, uuid, uuid, uuid, uuid) from anon, authenticated;

/* INSERT periodo → Added (§19). Il creator è inserito dal comando di create
   con added_by = sé stesso: nessun self Added né self Promotion. Un
   reingresso è un periodo nuovo e una chiave nuova: notifica di nuovo. */
create or replace function public.society_group_periods_notify_start()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.added_by_profile_id is distinct from new.profile_id then
    perform public.footme_group_notify_safe(
      'group_member_added', 'added', 'GROUP_ADDED:' || new.id::text,
      new.id, new.conversation_id, new.profile_id, new.added_by_profile_id);
  end if;

  return null;
end;
$$;

revoke all on function public.society_group_periods_notify_start() from public;
revoke execute on function public.society_group_periods_notify_start() from anon, authenticated;

drop trigger if exists society_group_periods_notify_start on public.society_group_membership_periods;
create trigger society_group_periods_notify_start
  after insert on public.society_group_membership_periods
  for each row execute function public.society_group_periods_notify_start();

/* Fine periodo (§17, §19, QA-105).
   · REMOVED e SOCIETY_RELATION_ENDED → Removed al target (la cessazione
     automatica non è un Leave volontario e ha ended_by NULL);
   · GROUP_DELETED → Deleted ai membri del momento, salvo chi ha eliminato;
   · LEFT → nessuna notifica (uscita volontaria).
   In ogni caso le push di chat/lifecycle ancora pending di quel destinatario
   in quella conversazione sono sospese subito: da qui in poi non è più
   partecipante di quel periodo. Un account in cancellazione (profilo già
   assente) non riceve nulla. */
create or replace function public.society_group_periods_notify_end()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    update public.notification_push_deliveries d
    set status = 'suppressed',
        reason = case when new.end_reason = 'GROUP_DELETED' then 'group_deleted' else 'not_participant' end,
        processed_at = clock_timestamp()
    where d.conversation_id = new.conversation_id
      and d.recipient_profile_id = new.profile_id
      and d.kind in ('chat_message', 'group_lifecycle')
      and d.status = 'pending';

  exception when others then
    raise warning 'DAS-REV-34: push pending non sospese a fine periodo (%)', sqlstate;
  end;

  if new.end_reason in ('REMOVED', 'SOCIETY_RELATION_ENDED', 'GROUP_DELETED')
     and exists (select 1 from public.profiles p where p.id = new.profile_id) then
    if new.end_reason = 'GROUP_DELETED' then
      perform public.footme_group_notify_safe(
        'group_deleted', 'deleted', 'GROUP_DELETED:' || new.id::text,
        new.id, new.conversation_id, new.profile_id, new.ended_by_profile_id);
    else
      perform public.footme_group_notify_safe(
        'group_member_removed', 'removed', 'GROUP_REMOVED:' || new.id::text,
        new.id, new.conversation_id, new.profile_id, new.ended_by_profile_id);
    end if;
  end if;

  return null;
end;
$$;

revoke all on function public.society_group_periods_notify_end() from public;
revoke execute on function public.society_group_periods_notify_end() from anon, authenticated;

drop trigger if exists society_group_periods_notify_end on public.society_group_membership_periods;
create trigger society_group_periods_notify_end
  after update on public.society_group_membership_periods
  for each row
  when (old.ended_at is null and new.ended_at is not null)
  execute function public.society_group_periods_notify_end();

/* Cambio di ruolo reale su un periodo attivo → Promoted / Demoted al target
   (§17), salvo self-change. La versione del periodo entra nella chiave: due
   cambi nello stesso periodo sono due eventi distinti, un retry no. */
create or replace function public.society_group_periods_notify_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.footme_group_notify_safe(
    case new.member_role when 'admin' then 'group_admin_promoted' else 'group_admin_demoted' end,
    'role',
    case new.member_role when 'admin' then 'GROUP_PROMOTED:' else 'GROUP_DEMOTED:' end
      || new.id::text || ':' || new.version::text,
    new.id, new.conversation_id, new.profile_id, auth.uid());

  return null;
end;
$$;

revoke all on function public.society_group_periods_notify_role() from public;
revoke execute on function public.society_group_periods_notify_role() from anon, authenticated;

drop trigger if exists society_group_periods_notify_role on public.society_group_membership_periods;
create trigger society_group_periods_notify_role
  after update on public.society_group_membership_periods
  for each row
  when (old.member_role is distinct from new.member_role and new.ended_at is null)
  execute function public.society_group_periods_notify_role();


-- ============================================================
-- SEZIONE 6 — replay della dead-letter e cron (§16, §23)
-- ============================================================

/**
 * Rigioca gli effetti in dead-letter dovuti (next_attempt_at <= now, non
 * risolti, al più 5 tentativi). Idempotente: usa le stesse source key / event_key
 * dell'effetto originale, quindi un replay dopo un successo parziale non
 * duplica e un secondo replay della stessa riga è un no-op (resolved_at).
 * Ogni riga ha il suo sotto-blocco: una che fallisce ancora aumenta
 * attempts e il backoff (1, 2, 4, 8, 16 minuti) e non ferma le altre. Chiamata
 * dal cron, mai dai client. Restituisce quante righe ha risolto.
 */
create or replace function public.messaging_effects_replay(p_limit integer default 100)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 1000);
  v_done  integer := 0;
  v_state text;
  r       record;
begin
  for r in
    select dl.id, dl.effect, dl.payload, dl.attempts
    from public.messaging_effect_dead_letters dl
    where dl.resolved_at is null
      and dl.attempts < 5
      and dl.next_attempt_at <= clock_timestamp()
    order by dl.id
    limit v_limit
    for update skip locked
  loop
    begin
      if r.effect = 'group_notification' then
        perform public.footme_group_notify(
          r.payload ->> 'type', r.payload ->> 'intent', r.payload ->> 'source_key',
          (r.payload ->> 'period_id')::uuid, (r.payload ->> 'conversation_id')::uuid,
          (r.payload ->> 'profile_id')::uuid, nullif(r.payload ->> 'actor', '')::uuid);
      else
        perform public.footme_message_push_enqueue(
          (r.payload ->> 'message_id')::uuid, nullif(r.payload ->> 'actor', '')::uuid);
      end if;

      update public.messaging_effect_dead_letters dl
      set resolved_at = clock_timestamp(), attempts = dl.attempts + 1
      where dl.id = r.id;
      v_done := v_done + 1;
    exception when others then
      v_state := sqlstate;
      update public.messaging_effect_dead_letters dl
      set attempts = dl.attempts + 1,
          sqlstate = v_state,
          next_attempt_at = clock_timestamp() + make_interval(mins => power(2, dl.attempts)::integer)
      where dl.id = r.id;
    end;
  end loop;

  /* Le righe risolte non servono oltre 30 giorni. */
  delete from public.messaging_effect_dead_letters dl
  where dl.resolved_at < clock_timestamp() - interval '30 days';

  return v_done;
end;
$$;

revoke all on function public.messaging_effects_replay(integer) from public;
revoke execute on function public.messaging_effects_replay(integer) from anon, authenticated;


-- ============================================================
-- SEZIONE 7 — wake della coda più frequente (§16)
--
-- La chat non può aspettare un minuto. pg_cron >= 1.5 accetta '10 seconds'.
-- Idempotente (unschedule + schedule). Se la versione non lo accetta resta la
-- cadenza esistente. Senza pg_cron (PGlite, sviluppo locale) è un no-op.
-- ============================================================

do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
   begin
    create extension if not exists pg_cron;

    if exists (select 1 from cron.job where jobname = 'messaging-effects-replay') then
      perform cron.unschedule('messaging-effects-replay');
    end if;
    perform cron.schedule('messaging-effects-replay', '*/5 * * * *', 'select public.messaging_effects_replay(100)');

    if exists (select 1 from cron.job where jobname = 'notification-push-wake') then
      perform cron.unschedule('notification-push-wake');
    end if;
    begin
      perform cron.schedule('notification-push-wake', '10 seconds', 'select public.footme_push_wake()');
    exception when others then
      perform cron.schedule('notification-push-wake', '* * * * *', 'select public.footme_push_wake()');
      raise warning 'DAS-REV-34: pg_cron non accetta la cadenza a secondi; wake push resta a 1 minuto.';
    end;
   exception when others then
    raise warning 'DAS-REV-34: pg_cron non attivabile (%); wake push invariato.', sqlerrm;
   end;
  end if;
end;
$do$;
