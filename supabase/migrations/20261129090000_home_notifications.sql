-- STATO: blocchi completati §1..§7 + correzioni da review (guardia INSERT/UPDATE, account_allowed, backoff push, cutoff con margine). 79 test PGlite + backfill ok. Da applicare sul remoto.
-- ============================================================
-- HOM-14 — Notifiche social e preferenze: lato database
--
-- COSA MANCAVA
--
-- Il task HOM-14 (§1–§338) chiede un Centro Notifiche unico per account, con
-- eventi social generati dal backend, aggregati e consegnati anche come push.
-- Oggi (verificato sul codice, non sul remoto) mancano sette cose:
--
--   1. DUE STATI, NON UNO (§10–§19, §116–§122, §213–§220). `notifications` ha
--      `is_read` + `revision` + `read_revision` (DAS-REV-31): sa dire "letta"
--      ma non "vista nel Centro". Il badge della campanella (nuove dall'ultima
--      apertura) e l'azzurrino (non ancora aperte una per una) sono due
--      grandezze diverse: serve `seen_revision` accanto a `read_revision`.
--   2. IL MODELLO SOCIAL (§113). La riga non sa chi ha agito (identità
--      attore), per quale identità è stata ricevuta (la Società gestita, non
--      la persona), né verso quale target aprire (§146–§156); non ha
--      priorità (§137), conteggio dell'aggregato, anteprima minimizzata
--      (§262), chiave di idempotenza dell'evento (§114–§115, §223) né stato
--      push (§113).
--   3. UNA POLICY CENTRALE (§168–§172). Gli unici produttori sono i due
--      trigger di follow (che notificano il solo profilo/titolare, senza
--      identità, senza blocchi, senza aggregazione) e la notifica dei
--      contenuti programmati. Like, commenti, risposte, mention e repost
--      scrivono in outbox (HOM-08, HOM-10) che nessuno consuma; i Like non
--      scrivono nulla (HOM-07 §76/§192: «sorgente di eventi futuri»).
--   4. LE PREFERENZE. `notification_preferences` ha sei interruttori MES-03
--      che SOPPRIMONO la riga in-app; HOM-14 §181–§182 vuole interruttori
--      push che NON tolgono mai l'evento dal Centro. In più
--      `fetch_my_notification_preferences` è rotta a runtime (la colonna OUT
--      `profile_id` è ambigua con `on conflict (profile_id)`).
--   5. I DESTINATARI SOCIETÀ (§103–§112). Non esiste una capability "riceve le
--      notifiche della Società": una riga per account, non per Società.
--   6. LA CONSEGNA PUSH (§173–§179, §203–§212, §267–§269). Nessun token di
--      dispositivo, nessuna coda, nessun rate limit, nessuna Edge Function.
--   7. LA RETENTION (§232–§233). Le notifiche non scadono mai.
--
-- DECISIONI DI LUIGI (2026-11-16) CHE QUESTA MIGRAZIONE REALIZZA
--
--   D1  Timeline unica per tutti i tipi (social e operativi esistenti): niente
--       filtri, niente «Segna tutte come lette» (§18, §21). `mark_all_
--       notifications_read` è RIMOSSA (drop) e non sostituita: tenerla
--       revocata lascerebbe un comando che il prodotto vieta (§284). Resta
--       «Elimina notifiche lette», ri-semanticizzata su OPENED.
--   D2  I sei interruttori nuovi sono PUSH (push_comments_replies,
--       push_mentions, push_reposts, push_new_followers, push_likes,
--       push_scheduled_content) e non sopprimono mai l'in-app (§182). I
--       vecchi interruttori MES-03 restano («Altre attività») e sopprimono
--       l'in-app solo per i tipi OPERATIVI (requests, applications,
--       content_tags, store, promotions). `new_followers` smette di
--       sopprimere `new_follower` in-app (§182): il valore storico viene
--       copiato in `push_new_followers`, poi la colonna resta senza effetto.
--   D3  Pipeline push completa (token per account, coda per notifica,
--       eligibility all'insert/aggiornamento, rate limit, Edge Function
--       `send-push`), anche se non verificabile qui (nessun Expo, nessun
--       pg_net locale).
--   D4  Destinatari Società = titolare implicito ∪ membri attivi con la chiave
--       `can_receive_society_notifications` (catalogo DAS-REV-14, revisione
--       11, backfill a chi ha `content_create`). Una riga PER ACCOUNT
--       destinatario: seen/opened/push sono indipendenti (§107–§108).
--
-- PERCHÉ QUESTA SOLUZIONE
--
--   * Un solo punto che decide (§170): `footme_notify_event(...)` riceve un
--     evento di dominio e risolve destinatari, self-suppression per account E
--     identità (§109–§112), blocchi (§162–§163), aggregazione con finestra
--     configurabile (§125), versione (§116–§122), priorità (§137) ed
--     eligibility push. I produttori (trigger sulle tabelle sorgente) non
--     decidono nulla: traducono la riga in un evento.
--   * Idempotenza (§114–§115): `notification_sources` ha chiave
--     (destinatario, source_event_key). Un retry dello stesso evento trova la
--     chiave e non incrementa nulla. La tabella NON ha FK verso
--     `notifications`: cancellare una notifica (retention, «elimina lette»)
--     non deve far rinascere l'evento se la sorgente viene rielaborata (es.
--     modifica di un Post con mention). La retention pulisce le sorgenti con
--     la stessa soglia.
--   * Stati per versione (§118): revision = current_version, seen_revision =
--     seen_version, read_revision = opened_version. NEW ⇔ seen_revision <
--     revision; azzurrina ⇔ read_revision < revision (o null). `is_read`
--     resta come colonna DERIVATA (read_revision >= revision), mantenuta da
--     un trigger BEFORE: il codice DAS-REV-31 che scrive `is_read = false`
--     insieme a `revision + 1` e il client già distribuito che scrive
--     `is_read = true` restano coerenti senza essere toccati.
--   * Le notifiche esistenti: backfill `seen_revision = revision`. Marcarle
--     tutte come non viste farebbe esplodere il badge al primo avvio del
--     client nuovo con centinaia di unità storiche; vedute sì, aperte solo
--     se `is_read` (azzurrino invariato).
--   * L'outbox di HOM-08/HOM-10 si consuma con un trigger AFTER INSERT dentro
--     la stessa transazione del comando, in un sotto-blocco con handler: un
--     errore nelle notifiche NON deve far fallire un commento. L'evento resta
--     con consumed_at nullo e un drain periodico lo rielabora (idempotente).
--
--   * Una sola regola di visibilità (footme_notification_account_allowed) per
--     Centro, badge e push (enqueue e claim): una riga Società si vede e si
--     spinge solo a chi è ancora destinatario; le righe con destinatario
--     esplicito (pubblicazioni programmate) passano sempre.
--   * Push: tetto tentativi e backoff esponenziale configurabili, tetto orario
--     serializzato con advisory lock per (account, priorità), soppressione se
--     follow o Mi piace non esistono più alla consegna (§268). Il cutoff di
--     «visto» ha un margine configurabile (default 2 s) contro le transazioni
--     committate in ritardo (§16–§17); chi apre il Centro nei 2 s successivi a
--     un arrivo lo vede ancora NEW.
--
-- COSA NON FA (volutamente)
--
--   * Nessuna notifica per Saved, Share, Copy link, Profile view, Not
--     interested, Report, Block, Unblock, Unfollow, pubblicazioni dei seguiti,
--     Mi piace ai commenti (§68–§83, §284).
--   * Non chiude la policy INSERT `with check (true)` su `notifications`
--     (esistente da 20260323000002, usata dal client per i tipi operativi).
--     La protezione è un trigger (notifications_client_guard, SEZIONE 1): un
--     client non scrive i nove tipi HOM-14 né le colonne del modello social, e
--     in UPDATE cambia solo is_read/read_revision/seen_revision, mai oltre la
--     revisione corrente né all'indietro. Chiudere la policy resta una
--     decisione separata (servirebbe migrare i produttori client-side).
--
-- ROLLOUT
--
--   Il client già distribuito legge `notifications` direttamente e chiama
--   `mark_all_notifications_read(p_as_of)`: dopo questa migrazione quella RPC
--   non esiste più (è voluto, §18). `mark_notification_read` resta come alias
--   di `mark_notification_opened`. Dati: backfill di sole due colonne
--   (`seen_revision`, `priority` di default), nessuna riga cancellata.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — colonne, sorgenti, backfill
-- ============================================================

alter table public.notifications
  add column if not exists seen_revision           integer not null default 0,
  add column if not exists recipient_identity_type text,
  add column if not exists recipient_identity_id   uuid,
  add column if not exists actor_identity_type     text,
  add column if not exists actor_identity_id       uuid,
  add column if not exists target_type             text,
  add column if not exists target_id               uuid,
  add column if not exists target_params           jsonb   not null default '{}'::jsonb,
  add column if not exists event_count             integer not null default 1,
  add column if not exists priority                text    not null default 'medium',
  add column if not exists source_event_key        text,
  add column if not exists preview_snapshot        text,
  add column if not exists push_state              text;

alter table public.notifications
  drop constraint if exists notifications_identity_types_check,
  drop constraint if exists notifications_target_type_check,
  drop constraint if exists notifications_priority_check,
  drop constraint if exists notifications_preview_check,
  drop constraint if exists notifications_push_state_check,
  drop constraint if exists notifications_event_count_check;

alter table public.notifications
  add constraint notifications_identity_types_check check (
    (recipient_identity_type is null or recipient_identity_type in ('person', 'society', 'media'))
    and (actor_identity_type is null or actor_identity_type in ('person', 'society', 'media'))),
  add constraint notifications_target_type_check check (
    target_type is null or target_type in ('profile', 'content', 'comment', 'scheduled_content')),
  add constraint notifications_priority_check check (priority in ('high', 'medium', 'low')),
  /* §262: anteprima breve, mai il testo intero. */
  add constraint notifications_preview_check check (
    preview_snapshot is null or char_length(preview_snapshot) <= 120),
  add constraint notifications_push_state_check check (
    push_state is null or push_state in ('pending', 'sent', 'suppressed', 'failed')),
  add constraint notifications_event_count_check check (event_count >= 1);

/* Backfill: vedute = tutte quelle esistenti (vedi «PERCHÉ»); aperte solo se
   is_read (read_revision già valorizzata da DAS-REV-31; se mancasse, 1). */
update public.notifications n
set seen_revision = n.revision,
    read_revision = case when n.is_read then coalesce(n.read_revision, n.revision) else n.read_revision end
where n.seen_revision < n.revision
   or (n.is_read and n.read_revision is null);

/* Idempotenza per destinatario sulle righe individuali (§115, §223). Per gli
   aggregati la chiave di aggregazione (notifications_aggregate_uniq, già
   esistente) è l'unicità; qui source_event_key resta nullo. */
create unique index if not exists notifications_source_event_uniq
  on public.notifications (recipient_profile_id, source_event_key)
  where source_event_key is not null;

/* Badge: solo le unità nuove (§119). Indice parziale sullo stato, non sul
   destinatario intero. */
create index if not exists notifications_new_units_idx
  on public.notifications (recipient_profile_id)
  where seen_revision < revision;

create index if not exists notifications_timeline_idx
  on public.notifications (recipient_profile_id, updated_at desc, id desc);

create index if not exists notifications_target_idx
  on public.notifications (target_type, target_id)
  where target_id is not null;

/* Riferimenti deduplicati di ogni notifica (§113 representative_actor_ids,
   §115 retry). Una riga per destinatario e evento sorgente: la PK è
   l'idempotenza. NIENTE foreign key verso notifications (vedi «PERCHÉ»). */
create table if not exists public.notification_sources (
  recipient_profile_id uuid        not null references public.profiles(id) on delete cascade,
  source_event_key     text        not null,
  notification_id      uuid,
  actor_identity_type  text        check (actor_identity_type in ('person', 'society', 'media')),
  actor_identity_id    uuid,
  occurred_at          timestamptz not null default timezone('utc', now()),
  primary key (recipient_profile_id, source_event_key)
);

create index if not exists notification_sources_notification_idx
  on public.notification_sources (notification_id, occurred_at desc)
  where notification_id is not null;
create index if not exists notification_sources_occurred_idx
  on public.notification_sources (occurred_at);

alter table public.notification_sources enable row level security;
revoke all on public.notification_sources from public, anon, authenticated;

/* Da 20261111090000 §6 (unica definizione), con seen_revision. Su INSERT la
   riga nasce alla revisione 1: vista e aperta solo se arriva già letta
   (percorso legacy dei client che scrivono is_read = true). */
create or replace function public.notifications_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.revision      := 1;
  new.read_revision := case when new.is_read then 1 end;
  new.seen_revision := case when new.is_read then 1 else 0 end;
  new.updated_at    := coalesce(new.created_at, timezone('utc', now()));
  return new;
end;
$$;

revoke execute on function public.notifications_stamp() from anon, authenticated;

/* is_read è DERIVATO da read_revision >= revision (vedi «PERCHÉ»).
   - Un client legacy che scrive is_read = true senza toccare read_revision
     apre la revisione corrente.
   - Aprire implica vedere (§121): seen_revision non resta mai sotto
     read_revision. */
create or replace function public.notifications_sync_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_read and not old.is_read
     and new.read_revision is not distinct from old.read_revision then
    new.read_revision := new.revision;
  end if;

  if new.read_revision is not null then
    new.seen_revision := greatest(new.seen_revision, new.read_revision);
  end if;

  new.is_read := coalesce(new.read_revision, 0) >= new.revision;
  return new;
end;
$$;

revoke execute on function public.notifications_sync_state() from anon, authenticated;

drop trigger if exists notifications_sync_state on public.notifications;
create trigger notifications_sync_state
  before update on public.notifications
  for each row execute function public.notifications_sync_state();

/* Guardia sulle scritture DIRETTE dei client (la policy INSERT `with check
   (true)` resta: i produttori client-side dei tipi OPERATIVI la usano). RLS
   filtra righe, non colonne, quindi la protezione è un trigger:
   - INSERT: un client non può scrivere i nove tipi HOM-14 né alcuna colonna
     del modello social (identità, target, priorità, chiave, anteprima, stato
     push, aggregato): sarebbe una notifica falsa verso un altro account.
   - UPDATE: il proprietario cambia solo is_read / read_revision /
     seen_revision, mai oltre la revisione corrente e mai all'indietro.
   Interno = il comando gira in una funzione definer (current_user non è
   anon/authenticated: produttori, RPC mark_*, sweep, trigger sorgente) oppure
   il flag di transazione footme.notify_internal è acceso (lo imposta
   footme_notify_event). I produttori operativi esistenti sono funzioni
   definer o trigger e passano da qui senza modifiche. */
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
                    'scheduled_content_published', 'scheduled_content_failed')
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

revoke execute on function public.notifications_client_guard() from anon, authenticated;

drop trigger if exists notifications_client_guard on public.notifications;
create trigger notifications_client_guard
  before insert or update on public.notifications
  for each row execute function public.notifications_client_guard();


-- ============================================================
-- SEZIONE 2 — preferenze: sei interruttori push + fetch/set riparate
--
-- Colonna NULL = «usa il default del backend» (§195): il default vive in
-- app_policy_settings e cambia senza migrazione né release mobile. Una riga
-- assente equivale a tutti NULL. L'utente che tocca un interruttore scrive un
-- valore esplicito.
-- ============================================================

alter table public.notification_preferences
  add column if not exists push_comments_replies  boolean,
  add column if not exists push_mentions          boolean,
  add column if not exists push_reposts           boolean,
  add column if not exists push_new_followers     boolean,
  add column if not exists push_likes             boolean,
  add column if not exists push_scheduled_content boolean;

/* Il vecchio interruttore «Nuovi follower» (MES-03) non sopprime più l'in-app
   (§182): un opt-out esplicito diventa l'opt-out push equivalente. */
update public.notification_preferences p
set push_new_followers = false
where p.new_followers is false
  and p.push_new_followers is null;

insert into public.app_policy_settings (key, value, description)
values
  ('notification_push_default.comments_replies',  to_jsonb(true),
   'HOM-14 §189 — default push «Commenti e risposte» (ON).'),
  ('notification_push_default.mentions',          to_jsonb(true),
   'HOM-14 §190 — default push «Mention» (ON).'),
  ('notification_push_default.reposts',           to_jsonb(true),
   'HOM-14 §191 — default push «Repost» (ON).'),
  ('notification_push_default.new_followers',     to_jsonb(true),
   'HOM-14 §192 — default push «Nuovi follower» (ON).'),
  ('notification_push_default.likes',             to_jsonb(false),
   'HOM-14 §193 — default push «Mi piace» (OFF: priorità bassa, nessuna tempesta).'),
  ('notification_push_default.scheduled_content', to_jsonb(true),
   'HOM-14 §194 — default push «Contenuti programmati» (ON).')
on conflict (key) do nothing;

/* Default effettivo di una categoria push (§195). Un valore non booleano in
   app_policy_settings è ignorato: vale il default scritto qui. */
create or replace function public.footme_notification_push_default(p_category text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (s.value #>> '{}')::boolean
     from public.app_policy_settings s
     where s.key = 'notification_push_default.' || p_category
       and jsonb_typeof(s.value) = 'boolean'),
    p_category <> 'likes');
$$;

revoke all on function public.footme_notification_push_default(text) from public;
revoke execute on function public.footme_notification_push_default(text) from anon, authenticated;

/* Categoria push di un tipo di notifica (§187–§188). NULL = il tipo non ha
   push (operativi: oggi non producono push in HOM-14). */
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
    else null
  end;
$$;

revoke all on function public.footme_notification_push_category(text) from public;
revoke execute on function public.footme_notification_push_category(text) from anon, authenticated;

/* Preferenza push EFFETTIVA di un account per una categoria. */
create or replace function public.footme_notification_push_enabled(
  p_profile  uuid,
  p_category text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case p_category
        when 'comments_replies'  then np.push_comments_replies
        when 'mentions'          then np.push_mentions
        when 'reposts'           then np.push_reposts
        when 'new_followers'     then np.push_new_followers
        when 'likes'             then np.push_likes
        when 'scheduled_content' then np.push_scheduled_content
      end
     from public.notification_preferences np
     where np.profile_id = p_profile),
    public.footme_notification_push_default(p_category));
$$;

revoke all on function public.footme_notification_push_enabled(uuid, text) from public;
revoke execute on function public.footme_notification_push_enabled(uuid, text) from anon, authenticated;

/* fetch_my_notification_preferences era rotta a runtime (colonna OUT
   profile_id ambigua con `on conflict (profile_id)`). Nuova forma: un jsonb,
   quindi nessuna colonna OUT che possa collidere, e nessuna scrittura (la
   lettura non crea più la riga: i NULL si risolvono qui). I toggle operativi
   MES-03 mantengono la semantica «assente = true». `new_followers` non è più
   esposto: non ha effetto (§182). */
drop function if exists public.fetch_my_notification_preferences();

create or replace function public.fetch_my_notification_preferences()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_np  public.notification_preferences%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_np from public.notification_preferences np where np.profile_id = v_uid;

  return jsonb_build_object(
    'push', jsonb_build_object(
      'comments_replies',  coalesce(v_np.push_comments_replies,  public.footme_notification_push_default('comments_replies')),
      'mentions',          coalesce(v_np.push_mentions,          public.footme_notification_push_default('mentions')),
      'reposts',           coalesce(v_np.push_reposts,           public.footme_notification_push_default('reposts')),
      'new_followers',     coalesce(v_np.push_new_followers,     public.footme_notification_push_default('new_followers')),
      'likes',             coalesce(v_np.push_likes,             public.footme_notification_push_default('likes')),
      'scheduled_content', coalesce(v_np.push_scheduled_content, public.footme_notification_push_default('scheduled_content'))),
    'other', jsonb_build_object(
      'requests',     coalesce(v_np.requests, true),
      'applications', coalesce(v_np.applications, true),
      'content_tags', coalesce(v_np.content_tags, true),
      'store',        coalesce(v_np.store, true),
      'promotions',   coalesce(v_np.promotions, true)));
end;
$$;

revoke all on function public.fetch_my_notification_preferences() from public;
revoke execute on function public.fetch_my_notification_preferences() from anon;
grant execute on function public.fetch_my_notification_preferences() to authenticated;

/* Whitelist estesa. `new_followers` (client già distribuito) è un alias di
   push_new_followers. La colonna è scelta da un CASE, mai interpolata dal
   testo del chiamante. */
create or replace function public.set_notification_preference(
  p_key   text,
  p_value boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_col text;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_value is null then
    raise exception 'Valore preferenza non valido' using errcode = '22023';
  end if;

  v_col := case p_key
    when 'requests'          then 'requests'
    when 'applications'      then 'applications'
    when 'content_tags'      then 'content_tags'
    when 'store'             then 'store'
    when 'promotions'        then 'promotions'
    when 'comments_replies'  then 'push_comments_replies'
    when 'mentions'          then 'push_mentions'
    when 'reposts'           then 'push_reposts'
    when 'new_followers'     then 'push_new_followers'
    when 'likes'             then 'push_likes'
    when 'scheduled_content' then 'push_scheduled_content'
    when 'push_comments_replies'  then 'push_comments_replies'
    when 'push_mentions'          then 'push_mentions'
    when 'push_reposts'           then 'push_reposts'
    when 'push_new_followers'     then 'push_new_followers'
    when 'push_likes'             then 'push_likes'
    when 'push_scheduled_content' then 'push_scheduled_content'
  end;

  if v_col is null then
    raise exception 'Chiave preferenza non valida: %', p_key using errcode = '22023';
  end if;

  insert into public.notification_preferences as np (profile_id)
  values (v_uid)
  on conflict (profile_id) do nothing;

  execute format(
    'update public.notification_preferences set %I = $1 where profile_id = $2', v_col)
  using p_value, v_uid;
end;
$$;

revoke all on function public.set_notification_preference(text, boolean) from public;
revoke execute on function public.set_notification_preference(text, boolean) from anon;
grant execute on function public.set_notification_preference(text, boolean) to authenticated;


-- ============================================================
-- SEZIONE 3 — destinatari Società: capability, catalogo (rev. 11), backfill
--
-- Chiave `can_receive_society_notifications` (§105–§106), controllo omonimo
-- nell'area ESISTENTE `published_content` (scope society, «Contenuti
-- pubblicati»): nessuna schermata nuova, l'editor ruoli la mostra e la
-- concede. Bundle 'manage': un ruolo di sola lettura non la riceve da solo.
-- Le due whitelist si ricostruiscono da quelle VIVE (stesso metodo di
-- 20261127090000 §3): nessuna lista copiata da un file vecchio.
-- ============================================================

do $$
declare
  v_tbl  text;
  v_con  text;
  v_def  text;
  v_keys text[];
begin
  foreach v_tbl in array array['club_member_permissions', 'club_admin_role_permissions'] loop
    v_con := v_tbl || '_key_check';
    select pg_get_constraintdef(c.oid) into v_def
      from pg_constraint c
     where c.conname = v_con and c.conrelid = ('public.' || v_tbl)::regclass;
    v_keys := string_to_array(substring(v_def from '\{([^}]*)\}'), ',');
    if v_keys is null or array_length(v_keys, 1) < 50 then
      raise exception 'whitelist % non riconosciuta: %', v_con, v_def;
    end if;
    if not ('can_receive_society_notifications' = any (v_keys)) then
      v_keys := v_keys || 'can_receive_society_notifications'::text;
    end if;
    execute format('alter table public.%I drop constraint %I', v_tbl, v_con);
    execute format('alter table public.%I add constraint %I check (permission_key = any (%L::text[]))',
                   v_tbl, v_con, v_keys);
  end loop;
end
$$;

insert into public.club_permission_controls
  (id, area_id, label, helper, bundle, requires, sort_order, is_available) values
  ('can_receive_society_notifications', 'published_content',
     'Ricevere le notifiche della società',
     'Mi piace, commenti, risposte, menzioni e repost sui contenuti della società',
     'manage', array[]::text[], 6, true)
on conflict (id) do update
  set area_id = excluded.area_id, label = excluded.label, helper = excluded.helper,
      bundle = excluded.bundle, requires = excluded.requires,
      sort_order = excluded.sort_order, is_available = excluded.is_available;

insert into public.club_permission_control_keys (control_id, permission_key) values
  ('can_receive_society_notifications', 'can_receive_society_notifications')
on conflict do nothing;

insert into public.app_policy_settings (key, value, description)
values ('admin_permission_catalog_revision', to_jsonb(11),
  'DAS-REV-14 §7 — revisione della tassonomia aree/controlli/chiavi. Va incrementata da ogni migrazione che cambia il catalogo.')
on conflict (key) do update set value = to_jsonb(11);

/* Backfill: chi oggi ha content_create SU TUTTA la società (team_id nullo)
   continua a ricevere ciò che riguarda i contenuti che pubblica. Le grant
   limitate a una squadra non si promuovono (l'area è di scope society):
   restano senza la chiave finché un titolare non la concede. I ruoli che
   contengono content_create ricevono la chiave, così un membro assegnato a
   quel ruolo e il ruolo non divergono. */
insert into public.club_member_permissions (club_id, profile_id, permission_key, granted_by_profile_id)
select perm.club_id, perm.profile_id, 'can_receive_society_notifications', null
from public.club_member_permissions perm
where perm.permission_key = 'content_create'
  and perm.team_id is null
on conflict do nothing;

insert into public.club_admin_role_permissions (role_id, permission_key)
select rp.role_id, 'can_receive_society_notifications'
from public.club_admin_role_permissions rp
where rp.permission_key = 'content_create'
on conflict do nothing;

/* Account che ricevono ciò che riguarda un'identità (§104): persona/media = il
   profilo stesso, se esiste; Società = titolare implicito ∪ accessi attivi con
   la chiave (§105). Chi ha revocato l'accesso (club_access_is_active falso)
   non riceve. */
create or replace function public.footme_notification_recipients(
  p_identity_type text,
  p_identity_id   uuid
)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select pr.id
  from public.profiles pr
  where p_identity_type in ('person', 'media') and pr.id = p_identity_id
  union
  select c.owner_profile_id
  from public.clubs c
  where p_identity_type = 'society' and c.id = p_identity_id and c.owner_profile_id is not null
  union
  select perm.profile_id
  from public.club_member_permissions perm
  where p_identity_type = 'society'
    and perm.club_id = p_identity_id
    and perm.permission_key = 'can_receive_society_notifications'
    and public.club_access_is_active(perm.club_id, perm.profile_id);
$$;

revoke all on function public.footme_notification_recipients(text, uuid) from public;
revoke execute on function public.footme_notification_recipients(text, uuid) from anon, authenticated;

/* La notifica è mostrabile a QUESTO account (§105): per una Società, solo
   finché è ancora destinatario (titolare o chiave attiva). Le righe con
   destinatario esplicito (pubblicazioni programmate: l'account è chi ha
   programmato, §85) passano sempre. Una sola regola per Centro, badge, push
   (enqueue e claim). */
create or replace function public.footme_notification_account_allowed(
  p_account uuid,
  p_type    text,
  p_rec_type text,
  p_rec_id   uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_type in ('scheduled_content_published', 'scheduled_content_failed')
         or p_rec_type is distinct from 'society'
         or p_rec_id is null
         or exists (
           select 1 from public.footme_notification_recipients('society', p_rec_id) r
           where r = p_account);
$$;

revoke all on function public.footme_notification_account_allowed(uuid, text, text, uuid) from public;
revoke execute on function public.footme_notification_account_allowed(uuid, text, text, uuid) from anon, authenticated;

/* Blocco fra due IDENTITÀ (§162–§163): attivo in una qualunque direzione. Per
   una Società destinataria vale il blocco fatto come Società (o a lei). person
   e media sono entrambi profili. */
create or replace function public.footme_notification_identities_blocked(
  p_a_type text, p_a_id uuid,
  p_b_type text, p_b_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.identity_blocks b
    where b.status = 'active'
      and (
        ((b.blocker_identity_type = 'society') = (p_a_type = 'society') and b.blocker_identity_id = p_a_id
          and (b.blocked_identity_type = 'society') = (p_b_type = 'society') and b.blocked_identity_id = p_b_id)
        or
        ((b.blocker_identity_type = 'society') = (p_b_type = 'society') and b.blocker_identity_id = p_b_id
          and (b.blocked_identity_type = 'society') = (p_a_type = 'society') and b.blocked_identity_id = p_a_id)));
$$;

revoke all on function public.footme_notification_identities_blocked(text, uuid, text, uuid) from public;
revoke execute on function public.footme_notification_identities_blocked(text, uuid, text, uuid) from anon, authenticated;


-- ============================================================
-- SEZIONE 4 — la policy centrale: footme_notify_event (§168–§172)
--
-- Un solo punto che decide. I produttori (SEZIONE 5) traducono una riga
-- sorgente in una chiamata; qui si risolvono destinatari, self-suppression,
-- blocchi, idempotenza, aggregazione, versione, priorità e push.
-- ============================================================

insert into public.app_policy_settings (key, value, description)
values
  ('notification.aggregate_window_minutes.like', to_jsonb(1440),
   'HOM-14 §125–§126 — finestra di aggregazione dei Mi piace sullo stesso contenuto (forte).'),
  ('notification.aggregate_window_minutes.simple_repost', to_jsonb(720),
   'HOM-14 §127 — finestra di aggregazione dei Simple Repost dello stesso originale.'),
  ('notification.aggregate_window_minutes.follow', to_jsonb(30),
   'HOM-14 §128–§130 — finestra del burst di nuovi follower sulla stessa identità (0 = mai).'),
  ('notification.aggregate_window_minutes.comment', to_jsonb(0),
   'HOM-14 §131–§133 — burst di commenti sullo stesso contenuto. 0 = notifiche individuali (default); Reply, Mention e programmati non si aggregano mai (§134–§136).'),
  ('notification.push.max_per_hour.low', to_jsonb(3),
   'HOM-14 §203 — push massimi per ora e account, priorità LOW.'),
  ('notification.push.max_per_hour.medium', to_jsonb(10),
   'HOM-14 §203 — push massimi per ora e account, priorità MEDIUM.'),
  ('notification.push.max_per_hour.high', to_jsonb(30),
   'HOM-14 §207–§210 — push massimi per ora e account, priorità HIGH (contatore separato: non è sommersa da LOW/MEDIUM).'),
  ('notification.push.min_interval_minutes.low', to_jsonb(60),
   'HOM-14 §206 — distanza minima fra due push della STESSA notifica aggregata, LOW.'),
  ('notification.push.min_interval_minutes.medium', to_jsonb(5),
   'HOM-14 §206 — distanza minima fra due push della STESSA notifica aggregata, MEDIUM.'),
  ('notification.push.min_interval_minutes.high', to_jsonb(0),
   'HOM-14 §208–§209 — distanza minima fra due push della stessa notifica, HIGH.'),
  ('notification.retention_days.default', to_jsonb(180),
   'HOM-14 §232–§233 — giorni di conservazione delle notifiche.'),
  ('notification.retention_days.like', to_jsonb(30),
   'HOM-14 §232 — giorni di conservazione dei Mi piace aggregati (più corti).'),
  ('notification.push.max_attempts', to_jsonb(3),
   'HOM-14 §267 — tentativi massimi di invio di una delivery push.'),
  ('notification.push.retry_backoff_seconds', to_jsonb(60),
   'HOM-14 — attesa base del retry di una delivery push (raddoppia a ogni tentativo).'),
  ('notification.seen_cutoff_margin_ms', to_jsonb(2000),
   'HOM-14 §16–§17 — margine all''indietro del cutoff di mark_notification_center_seen: una transazione committata in ritardo resta NEW.')
on conflict (key) do nothing;

/* §137–§140. Mai esposta al client. */
create or replace function public.footme_notification_priority(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'identity_mentioned'          then 'high'
    when 'comment_replied'             then 'high'
    when 'scheduled_content_failed'    then 'high'
    when 'content_liked'               then 'low'
    else 'medium'
  end;
$$;

revoke all on function public.footme_notification_priority(text) from public;
revoke execute on function public.footme_notification_priority(text) from anon, authenticated;

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
    else 'Notifica'
  end;
$$;

revoke all on function public.footme_notification_default_title(text) from public;
revoke execute on function public.footme_notification_default_title(text) from anon, authenticated;

/* Finestra di aggregazione del tipo (§125). Zero = notifica individuale.
   Reply, Mention, repost con testo e programmati non hanno chiave: mai. */
create or replace function public.footme_notification_window(p_type text)
returns interval
language sql
stable
security definer
set search_path = public
as $$
  select make_interval(mins => greatest(case p_type
    when 'content_liked'     then public.footme_policy_int('notification.aggregate_window_minutes.like', 1440)
    when 'simple_reposted'   then public.footme_policy_int('notification.aggregate_window_minutes.simple_repost', 720)
    when 'new_follower'      then public.footme_policy_int('notification.aggregate_window_minutes.follow', 30)
    when 'content_commented' then public.footme_policy_int('notification.aggregate_window_minutes.comment', 0)
    else 0
  end, 0));
$$;

revoke all on function public.footme_notification_window(text) from public;
revoke execute on function public.footme_notification_window(text) from anon, authenticated;

/* Anteprima minimizzata (§262): spazi compressi, al più 120 caratteri. */
create or replace function public.footme_notification_preview(p_text text)
returns text
language sql
immutable
as $$
  select case
    when nullif(btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g')), '') is null then null
    when char_length(btrim(regexp_replace(p_text, '\s+', ' ', 'g'))) <= 120
      then btrim(regexp_replace(p_text, '\s+', ' ', 'g'))
    else left(btrim(regexp_replace(p_text, '\s+', ' ', 'g')), 119) || '…'
  end;
$$;

revoke all on function public.footme_notification_preview(text) from public;
revoke execute on function public.footme_notification_preview(text) from anon, authenticated;

/**
 * Applica la policy a UN evento di dominio e scrive una riga per account
 * destinatario autorizzato. Restituisce il numero di account che hanno una
 * notifica nuova o aggiornata da questo evento (0 = soppresso, duplicato o
 * senza destinatari).
 *
 *   p_type          tipo notifica (vedi footme_notification_push_category)
 *   p_source_key    chiave STABILE dell'evento sorgente (§114): un retry con la
 *                   stessa chiave non incrementa nulla (§115, §223)
 *   p_actor_*       identità che ha agito (§94); nulla per gli eventi di sistema
 *   p_acting_account l'account che ha premuto il pulsante: non riceve mai (§109)
 *   p_rec_*         identità destinataria (§96); gli account si risolvono qui
 *   p_target_*      dove apre il tap (§146–§156), mai dedotto dal copy
 *   p_aggregate_scope  frammento di chiave (es. 'profile_post:<id>'); nullo =
 *                   individuale. Aggrega solo se footme_notification_window > 0
 *   p_only_account  destinatario fisso (eventi per chi ha agito, come la
 *                   pubblicazione programmata): niente risoluzione Società
 *   p_priority      sostituisce la priorità del tipo (un commento che menziona
 *                   il destinatario è HIGH come una menzione, §58, §208)
 *
 * Qualifica ogni colonna (n.<col>): questa è una funzione scalare senza OUT,
 * ma le tabelle toccate hanno colonne omonime dei parametri.
 */
create or replace function public.footme_notify_event(
  p_type            text,
  p_source_key      text,
  p_actor_type      text,
  p_actor_id        uuid,
  p_acting_account  uuid,
  p_rec_type        text,
  p_rec_id          uuid,
  p_target_type     text,
  p_target_id       uuid,
  p_target_params   jsonb default '{}'::jsonb,
  p_preview         text  default null,
  p_aggregate_scope text  default null,
  p_data            jsonb default '{}'::jsonb,
  p_only_account    uuid  default null,
  p_priority        text  default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_acct     uuid;
  v_count    integer := 0;
  v_priority text := coalesce(p_priority, public.footme_notification_priority(p_type));
  v_window   interval := public.footme_notification_window(p_type);
  v_preview  text := public.footme_notification_preview(p_preview);
  v_base     text;
  v_now      timestamptz;
  v_agg      public.notifications%rowtype;
  v_id       uuid;
  v_rows     integer;
  v_actors   integer;
  v_prev     text;
begin
  if p_type is null or p_source_key is null or p_rec_id is null
     or p_rec_type is null or p_rec_type not in ('person', 'media', 'society') then
    return 0;
  end if;

  if p_actor_type is not null then
    if p_actor_type not in ('person', 'media', 'society') or p_actor_id is null then
      return 0;
    end if;
    /* §110: la stessa identità che agisce su sé stessa non è una notifica. */
    if (p_actor_type = 'society') = (p_rec_type = 'society') and p_actor_id = p_rec_id then
      return 0;
    end if;
    /* Attore non più esistente: nessuna riga che non si saprebbe mostrare. */
    if p_actor_type = 'society' then
      if not exists (select 1 from public.clubs c where c.id = p_actor_id) then return 0; end if;
    elsif not exists (select 1 from public.profiles pr where pr.id = p_actor_id) then
      return 0;
    end if;
    /* §162–§163: blocco fra l'identità che agisce e quella destinataria. */
    if public.footme_notification_identities_blocked(p_actor_type, p_actor_id, p_rec_type, p_rec_id) then
      return 0;
    end if;
  end if;

  /* Flag di transazione per notifications_client_guard (vedi SEZIONE 1),
     ripristinato in uscita: non resta acceso per il resto della transazione. */
  v_prev := current_setting('footme.notify_internal', true);
  perform set_config('footme.notify_internal', 'on', true);

  for v_acct in
    select r from public.footme_notification_recipients(p_rec_type, p_rec_id) as r
    where p_only_account is null
    union
    select pr.id from public.profiles pr where pr.id = p_only_account
  loop
    /* §109–§112: l'account che ha agito non riceve, gli altri sì. */
    if v_acct is not distinct from p_acting_account then
      continue;
    end if;

    /* Blocco personale dell'account destinatario con chi ha agito. */
    if p_actor_type is not null
       and public.footme_identity_blocked(v_acct, p_actor_type, p_actor_id) then
      continue;
    end if;

    /* Una menzione nello stesso commento che ha già prodotto «risposta» o
       «commento» per quell'account non è una seconda notifica. */
    if p_type = 'identity_mentioned' and p_target_type in ('comment', 'content') and exists (
         select 1 from public.notifications n
         where n.recipient_profile_id = v_acct
           and n.type in ('comment_replied', 'content_commented', 'post_reposted_with_text')
           and n.target_id = p_target_id) then
      continue;
    end if;

    v_base := p_type || ':' || v_acct::text || ':' || p_rec_type || ':' || p_rec_id::text
              || ':' || coalesce(p_aggregate_scope, '');

    perform pg_advisory_xact_lock(hashtextextended('notify:' || v_base, 14));

    /* Idempotenza (§115): chiave già vista per questo account = retry. */
    insert into public.notification_sources
      (recipient_profile_id, source_event_key, actor_identity_type, actor_identity_id, occurred_at)
    values (v_acct, p_source_key, p_actor_type, p_actor_id, timezone('utc', now()))
    on conflict do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      continue;
    end if;

    v_now := clock_timestamp();
    v_id  := null;

    if p_aggregate_scope is not null and v_window > interval '0' then
      select n.* into v_agg
      from public.notifications n
      where n.recipient_profile_id = v_acct
        and starts_with(n.aggregate_key, v_base || ':')
        and n.created_at > v_now - v_window
      order by n.created_at desc
      limit 1
      for update;

      if v_agg.id is not null then
        update public.notification_sources s
        set notification_id = v_agg.id
        where s.recipient_profile_id = v_acct and s.source_event_key = p_source_key;

        select count(*)::integer into v_actors
        from (select distinct (s.actor_identity_type = 'society'), s.actor_identity_id
              from public.notification_sources s
              where s.notification_id = v_agg.id and s.actor_identity_id is not null) d;

        /* §116–§122: nuova attività = nuova versione. L'aggregato già aperto
           torna NEW e azzurrino; is_read lo riallinea il trigger. */
        update public.notifications n
        set revision            = n.revision + 1,
            updated_at          = v_now,
            event_count         = greatest(v_actors, 1),
            actor_identity_type = p_actor_type,
            actor_identity_id   = p_actor_id,
            preview_snapshot    = coalesce(v_preview, n.preview_snapshot),
            /* Il tap apre l'attore PIÙ RECENTE mostrato (follow: il suo profilo;
               commento: l'ultimo commento): target e dati seguono l'attore. */
            target_type         = coalesce(p_target_type, n.target_type),
            target_id           = coalesce(p_target_id, n.target_id),
            target_params       = case when p_target_id is not null
                                       then coalesce(p_target_params, '{}'::jsonb) else n.target_params end,
            data                = case when p_data is not null and p_data <> '{}'::jsonb
                                       then p_data else n.data end
        where n.id = v_agg.id;

        v_id := v_agg.id;
      end if;
    end if;

    if v_id is null then
      insert into public.notifications
        (recipient_profile_id, type, title, body, data,
         recipient_identity_type, recipient_identity_id, actor_identity_type, actor_identity_id,
         target_type, target_id, target_params, event_count, priority,
         source_event_key, aggregate_key, preview_snapshot, created_at)
      values
        (v_acct, p_type, public.footme_notification_default_title(p_type), null,
         coalesce(p_data, '{}'::jsonb),
         p_rec_type, p_rec_id, p_actor_type, p_actor_id,
         p_target_type, p_target_id, coalesce(p_target_params, '{}'::jsonb), 1, v_priority,
         case when p_aggregate_scope is null or v_window <= interval '0' then p_source_key end,
         case when p_aggregate_scope is not null and v_window > interval '0'
              then v_base || ':' || to_char(v_now at time zone 'UTC', 'YYYYMMDD"T"HH24MISS.US') end,
         v_preview, v_now)
      on conflict do nothing
      returning id into v_id;

      if v_id is null then
        continue;
      end if;

      update public.notification_sources s
      set notification_id = v_id
      where s.recipient_profile_id = v_acct and s.source_event_key = p_source_key;
    end if;

    v_count := v_count + 1;
    perform public.footme_notification_enqueue_push(v_id);
  end loop;

  perform set_config('footme.notify_internal', coalesce(v_prev, ''), true);
  return v_count;
end;
$$;

revoke all on function public.footme_notify_event(text, text, text, uuid, uuid, text, uuid, text, uuid, jsonb, text, text, jsonb, uuid, text) from public;
revoke execute on function public.footme_notify_event(text, text, text, uuid, uuid, text, uuid, text, uuid, jsonb, text, text, jsonb, uuid, text) from anon, authenticated;


-- ============================================================
-- SEZIONE 5 — produttori: dalle righe sorgente a footme_notify_event
--
-- Ogni produttore è un trigger AFTER INSERT/UPDATE sulla tabella sorgente.
-- Nessuno decide destinatari, aggregazione o push: traducono la riga in un
-- evento (§168–§169). Ognuno gira in un sotto-blocco con handler: un errore
-- nelle notifiche non deve mai far fallire il comando di dominio (un commento,
-- un Mi piace, una pubblicazione). L'evento resta nell'outbox non consumato e
-- footme_notify_drain_outbox lo rielabora (idempotente).
--
-- Niente notifiche per: Saved, Share, Copy link, Profile view, Not interested,
-- Report, Block, Unblock, Unfollow, nuove pubblicazioni dei seguiti, Mi piace
-- ai commenti (COMMENT_LIKED è marcato consumato e ignorato) e rimozione di un
-- Simple Repost (§68–§83, §284).
-- ============================================================

/* ---- 5a. Mi piace ai contenuti (§38–§44) ------------------------------ */

create or replace function public.notifications_on_content_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pb_type text;
  v_pb_id   uuid;
begin
  /* Mi piace a un commento: nessuna notifica (§70 HOM-08, fuori da HOM-14). */
  if new.content_type = 'comment' then
    return new;
  end if;

  begin
    select pb.pb_type, pb.pb_id into v_pb_type, v_pb_id
    from public.footme_content_publisher(new.content_type, new.post_id) pb;

    if v_pb_id is not null then
      perform public.footme_notify_event(
        'content_liked',
        /* Per contenuto e identità, senza data: attivare e togliere il Mi piace
           non rinotifica (anti-spam); la retention libera la chiave. */
        'LIKE:' || new.content_type || ':' || new.post_id::text || ':' || new.actor_type || ':' || new.actor_id::text,
        new.actor_type, new.actor_id, new.acted_by,
        v_pb_type, v_pb_id,
        'content', new.post_id, jsonb_build_object('content_type', new.content_type),
        null,
        new.content_type || ':' || new.post_id::text);
    end if;
  exception when others then
    raise warning 'HOM-14: notifica Mi piace non prodotta: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.notifications_on_content_like() from public;
revoke execute on function public.notifications_on_content_like() from anon, authenticated;

drop trigger if exists notifications_content_like on public.content_likes;
create trigger notifications_content_like
  after insert on public.content_likes
  for each row execute function public.notifications_on_content_like();


/* ---- 5b. Outbox commenti (§45–§59) ------------------------------------ */

create or replace function public.footme_notify_consume_comment_event(p_event_id bigint)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_e    public.content_comment_events%rowtype;
  v_c    public.content_comments%rowtype;
  v_type text;
  v_key  text;
begin
  select e.* into v_e
  from public.content_comment_events e
  where e.id = p_event_id and e.consumed_at is null
  for update;

  if v_e.id is null then
    return;
  end if;

  if v_e.event_type in ('COMMENT_CREATED', 'REPLY_CREATED', 'COMMENT_MENTION_CREATED')
     and v_e.comment_id is not null
     and v_e.target_identity_id is not null
     and v_e.actor_identity_id is not null then

    select c.* into v_c
    from public.content_comments c
    where c.id = v_e.comment_id and c.status = 'active';

    /* Commento già eliminato: nessuna riga, la sorgente non esiste più. */
    if v_c.id is not null then
      v_type := case v_e.event_type
        when 'COMMENT_CREATED' then 'content_commented'
        when 'REPLY_CREATED'   then 'comment_replied'
        else 'identity_mentioned'
      end;
      v_key := case v_e.event_type
        when 'COMMENT_CREATED' then 'COMMENT_CREATED:' || v_e.comment_id::text
        when 'REPLY_CREATED'   then 'REPLY_CREATED:' || v_e.comment_id::text
        else 'COMMENT_MENTION:' || v_e.comment_id::text || ':' || v_e.target_identity_id::text
      end;

      perform public.footme_notify_event(
        v_type, v_key,
        v_e.actor_identity_type, v_e.actor_identity_id, v_e.acted_by,
        v_e.target_identity_type, v_e.target_identity_id,
        'comment', v_e.comment_id,
        jsonb_build_object(
          'content_type',    v_e.content_type,
          'content_id',      v_e.content_id,
          'root_comment_id', coalesce(v_e.root_comment_id, v_e.comment_id),
          'comment_id',      v_e.comment_id,
          'reply_to_comment_id', v_e.target_comment_id),
        v_c.body,
        case when v_e.event_type = 'COMMENT_CREATED'
             then 'comment:' || v_e.content_type || ':' || v_e.content_id::text end,
        '{}'::jsonb, null,
        /* Il commento che menziona anche il destinatario vale una menzione:
           la menzione in sé viene assorbita (footme_notify_event), quindi la
           priorità alta deve stare qui, o il rate limit la sommergerebbe. */
        case when exists (
               select 1 from jsonb_array_elements(v_c.mentions) mm
               where mm ->> 'identity_id' = v_e.target_identity_id::text)
             then 'high' end);
    end if;
  end if;

  /* COMMENT_LIKED e ogni altro evento: consumati senza notifica. */
  update public.content_comment_events e
  set consumed_at = clock_timestamp()
  where e.id = p_event_id;
end;
$$;

revoke all on function public.footme_notify_consume_comment_event(bigint) from public;
revoke execute on function public.footme_notify_consume_comment_event(bigint) from anon, authenticated;

create or replace function public.notifications_on_comment_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.footme_notify_consume_comment_event(new.id);
  exception when others then
    raise warning 'HOM-14: evento commento % non consumato: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.notifications_on_comment_event() from public;
revoke execute on function public.notifications_on_comment_event() from anon, authenticated;

drop trigger if exists notifications_comment_event on public.content_comment_events;
create trigger notifications_comment_event
  after insert on public.content_comment_events
  for each row execute function public.notifications_on_comment_event();

/* Un commento eliminato non lascia il suo testo nell'anteprima (HOM-08,
   decisione 3: cancellazione vera). La riga resta, il target non è più
   disponibile (§265). */
create or replace function public.notifications_on_comment_gone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications n
  set preview_snapshot = null
  where n.target_type = 'comment'
    and n.target_id = old.id
    and n.preview_snapshot is not null;
  return null;
end;
$$;

revoke all on function public.notifications_on_comment_gone() from public;
revoke execute on function public.notifications_on_comment_gone() from anon, authenticated;

drop trigger if exists notifications_comment_deleted on public.content_comments;
create trigger notifications_comment_deleted
  after update of status on public.content_comments
  for each row when (new.status = 'deleted' and old.status is distinct from 'deleted')
  execute function public.notifications_on_comment_gone();

drop trigger if exists notifications_comment_removed on public.content_comments;
create trigger notifications_comment_removed
  after delete on public.content_comments
  for each row execute function public.notifications_on_comment_gone();


/* ---- 5c. Outbox repost (§60–§67) -------------------------------------- */

create or replace function public.footme_notify_consume_repost_event(p_event_id bigint)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_e public.content_repost_events%rowtype;
begin
  select e.* into v_e
  from public.content_repost_events e
  where e.id = p_event_id and e.consumed_at is null
  for update;

  if v_e.id is null then
    return;
  end if;

  if v_e.target_author_id is not null and v_e.actor_identity_id is not null then
    if v_e.event_type = 'SIMPLE_REPOST_CREATED' then
      perform public.footme_notify_event(
        'simple_reposted',
        'SIMPLE_REPOST:' || coalesce(v_e.repost_id::text, 'e' || v_e.id::text),
        v_e.actor_identity_type, v_e.actor_identity_id, v_e.actor_profile_id,
        v_e.target_author_type, v_e.target_author_id,
        'content', v_e.target_content_id,
        jsonb_build_object('content_type', v_e.target_content_type, 'repost_id', v_e.repost_id),
        null,
        v_e.target_content_type || ':' || v_e.target_content_id::text);
    elsif v_e.event_type = 'REFERENCED_POST_CREATED' and v_e.post_id is not null then
      perform public.footme_notify_event(
        'post_reposted_with_text',
        'REFERENCED_POST:' || v_e.post_content_type || ':' || v_e.post_id::text,
        v_e.actor_identity_type, v_e.actor_identity_id, v_e.actor_profile_id,
        v_e.target_author_type, v_e.target_author_id,
        'content', v_e.post_id,
        jsonb_build_object('content_type', v_e.post_content_type,
                           'referenced_content_type', v_e.target_content_type,
                           'referenced_content_id', v_e.target_content_id),
        null, null);
    end if;
  end if;

  /* SIMPLE_REPOST_REMOVED: consumato senza notifica. */
  update public.content_repost_events e
  set consumed_at = clock_timestamp()
  where e.id = p_event_id;
end;
$$;

revoke all on function public.footme_notify_consume_repost_event(bigint) from public;
revoke execute on function public.footme_notify_consume_repost_event(bigint) from anon, authenticated;

create or replace function public.notifications_on_repost_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.footme_notify_consume_repost_event(new.id);
  exception when others then
    raise warning 'HOM-14: evento repost % non consumato: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.notifications_on_repost_event() from public;
revoke execute on function public.notifications_on_repost_event() from anon, authenticated;

drop trigger if exists notifications_repost_event on public.content_repost_events;
create trigger notifications_repost_event
  after insert on public.content_repost_events
  for each row execute function public.notifications_on_repost_event();

/* Rielabora gli eventi di outbox rimasti non consumati (handler scattato,
   trigger assente al momento dell'evento). Idempotente: le chiavi sorgente
   impediscono i duplicati. Chiamata dal cron (SEZIONE 7), mai dai client. */
create or replace function public.footme_notify_drain_outbox(p_limit integer default 200)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 2000);
  v_done  integer := 0;
  r       record;
begin
  for r in
    select e.id from public.content_comment_events e
    where e.consumed_at is null order by e.id limit v_limit
  loop
    begin
      perform public.footme_notify_consume_comment_event(r.id);
      v_done := v_done + 1;
    exception when others then
      raise warning 'HOM-14: drain evento commento % fallito: %', r.id, sqlerrm;
    end;
  end loop;

  for r in
    select e.id from public.content_repost_events e
    where e.consumed_at is null order by e.id limit v_limit
  loop
    begin
      perform public.footme_notify_consume_repost_event(r.id);
      v_done := v_done + 1;
    exception when others then
      raise warning 'HOM-14: drain evento repost % fallito: %', r.id, sqlerrm;
    end;
  end loop;

  return v_done;
end;
$$;

revoke all on function public.footme_notify_drain_outbox(integer) from public;
revoke execute on function public.footme_notify_drain_outbox(integer) from anon, authenticated;


/* ---- 5d. Mention nei Post (§54–§59) ----------------------------------- */

/* Le mention di un Post sono in content_post_extras.mentions (HOM-06.1).
   Si notificano quando il Post è PUBBLICATO: alla pubblicazione, e in modifica
   solo quelle nuove (la chiave per identità lo garantisce, anche se la
   mention viene tolta e rimessa). Articoli: usano i tag (notifica content_tag
   esistente), non le mention, quindi restano fuori. Il repost con testo è un
   Post e passa da qui. */
create or replace function public.footme_notify_post_mentions(
  p_content_type text,
  p_post_id      uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_actor_type text;
  v_actor_id   uuid;
  v_acting     uuid;
  v_status     text;
  v_kind       text;
  v_mentions   jsonb;
  m            record;
  v_count      integer := 0;
begin
  if p_content_type = 'profile_post' then
    select 'person', pp.profile_id, pp.profile_id, pp.status, 'post'
      into v_actor_type, v_actor_id, v_acting, v_status, v_kind
    from public.profile_posts pp where pp.id = p_post_id;
  elsif p_content_type = 'club_media' then
    select 'society', cm.club_id, cm.created_by_profile_id, cm.status, cm.kind
      into v_actor_type, v_actor_id, v_acting, v_status, v_kind
    from public.club_media_posts cm where cm.id = p_post_id;
  elsif p_content_type = 'media_profile' then
    select 'media', mp.media_profile_id, mp.created_by_profile_id, mp.status, mp.kind
      into v_actor_type, v_actor_id, v_acting, v_status, v_kind
    from public.media_profile_posts mp where mp.id = p_post_id;
  else
    return 0;
  end if;

  if v_actor_id is null or v_status is distinct from 'published' or v_kind is distinct from 'post' then
    return 0;
  end if;

  select x.mentions into v_mentions
  from public.content_post_extras x
  where x.content_type = p_content_type and x.post_id = p_post_id;

  if v_mentions is null or jsonb_typeof(v_mentions) <> 'array' then
    return 0;
  end if;

  for m in
    select distinct
           public.footme_comment_mention_identity(e ->> 'identity_type', (e ->> 'identity_id')::uuid) as r_type,
           (e ->> 'identity_id')::uuid as r_id
    from jsonb_array_elements(v_mentions) e
  loop
    v_count := v_count + public.footme_notify_event(
      'identity_mentioned',
      'MENTION_POST:' || p_content_type || ':' || p_post_id::text || ':' || m.r_id::text,
      v_actor_type, v_actor_id, v_acting,
      m.r_type, m.r_id,
      'content', p_post_id, jsonb_build_object('content_type', p_content_type),
      null, null);
  end loop;

  return v_count;
end;
$$;

revoke all on function public.footme_notify_post_mentions(text, uuid) from public;
revoke execute on function public.footme_notify_post_mentions(text, uuid) from anon, authenticated;

create or replace function public.notifications_on_post_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if tg_table_name = 'content_post_extras' then
      perform public.footme_notify_post_mentions(new.content_type, new.post_id);
    else
      perform public.footme_notify_post_mentions(tg_argv[0], new.id);
    end if;
  exception when others then
    raise warning 'HOM-14: mention del Post non notificate: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.notifications_on_post_mentions() from public;
revoke execute on function public.notifications_on_post_mentions() from anon, authenticated;

/* Nome dopo `content_repost_referenced_event` (ordine alfabetico dei trigger):
   per un repost con testo la notifica «ha ripostato» precede la menzione, che
   viene quindi assorbita (footme_notify_event). */
drop trigger if exists notifications_post_mentions on public.content_post_extras;
create trigger notifications_post_mentions
  after insert or update of mentions on public.content_post_extras
  for each row when (jsonb_array_length(new.mentions) > 0)
  execute function public.notifications_on_post_mentions();

drop trigger if exists notifications_post_mentions_published on public.profile_posts;
create trigger notifications_post_mentions_published
  after update of status on public.profile_posts
  for each row when (new.status = 'published' and old.status is distinct from 'published')
  execute function public.notifications_on_post_mentions('profile_post');

drop trigger if exists notifications_post_mentions_published on public.club_media_posts;
create trigger notifications_post_mentions_published
  after update of status on public.club_media_posts
  for each row when (new.status = 'published' and old.status is distinct from 'published')
  execute function public.notifications_on_post_mentions('club_media');

drop trigger if exists notifications_post_mentions_published on public.media_profile_posts;
create trigger notifications_post_mentions_published
  after update of status on public.media_profile_posts
  for each row when (new.status = 'published' and old.status is distinct from 'published')
  execute function public.notifications_on_post_mentions('media_profile');


/* ---- 5e. Follow (§33–§37, §128–§130) ---------------------------------- */

/* Da 20260719090200 (unica definizione): stessi nomi di trigger, stessa
   semantica di «solo inserimenti nuovi»; ora passa dalla policy centrale
   (identità, blocchi, burst, self-suppression per account). `data` conserva la
   forma storica letta dal client già distribuito. */
create or replace function public.profile_follows_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.footme_notify_event(
      'new_follower',
      'FOLLOW:' || new.follower_profile_id::text || ':' || new.followed_profile_id::text,
      public.footme_comment_mention_identity('profile', new.follower_profile_id),
      new.follower_profile_id, new.follower_profile_id,
      public.footme_comment_mention_identity('profile', new.followed_profile_id),
      new.followed_profile_id,
      'profile', new.follower_profile_id, '{}'::jsonb,
      null, 'follow',
      jsonb_build_object('follower_profile_id', new.follower_profile_id::text, 'target_type', 'profile'));
  exception when others then
    raise warning 'HOM-14: notifica follow non prodotta: %', sqlerrm;
  end;
  return new;
end;
$$;

create or replace function public.club_follows_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.footme_notify_event(
      'new_follower',
      'FOLLOW:' || new.profile_id::text || ':' || new.club_id::text,
      public.footme_comment_mention_identity('profile', new.profile_id),
      new.profile_id, new.profile_id,
      'society', new.club_id,
      'profile', new.profile_id, '{}'::jsonb,
      null, 'follow',
      jsonb_build_object('follower_profile_id', new.profile_id::text, 'target_type', 'club',
                         'club_id', new.club_id::text));
  exception when others then
    raise warning 'HOM-14: notifica follow società non prodotta: %', sqlerrm;
  end;
  return new;
end;
$$;


/* ---- 5f. Pubblicazioni programmate (§85–§92) -------------------------- */

/* Da 20261121090000 §15 (unica definizione), stessa firma. Il destinatario
   resta CHI HA PROGRAMMATO (p_only_account); in più la riga sa per quale
   identità (la Società o il Media del contenuto), la priorità (fallimento =
   HIGH), il target (successo → contenuto; fallimento → gestione) e l'idempotenza
   (una chiave per transizione nella stessa transazione dello sweep). */
create or replace function public.footme_notify_scheduled_content(
  p_recipient    uuid,
  p_content_type text,
  p_id           uuid,
  p_published    boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_type text;
  v_id   uuid;
begin
  if p_recipient is null then
    return;
  end if;

  if p_content_type = 'profile_post' then
    v_type := 'person';
    select pp.profile_id into v_id from public.profile_posts pp where pp.id = p_id;
  elsif p_content_type = 'club_media' then
    v_type := 'society';
    select cm.club_id into v_id from public.club_media_posts cm where cm.id = p_id;
  elsif p_content_type = 'media_profile' then
    v_type := 'media';
    select mp.media_profile_id into v_id from public.media_profile_posts mp where mp.id = p_id;
  end if;

  /* Contenuto non risolvibile: l'identità del destinatario è la sua persona. */
  if v_id is null then
    v_type := public.footme_comment_mention_identity('profile', p_recipient);
    v_id := p_recipient;
  end if;

  perform public.footme_notify_event(
    case when p_published then 'scheduled_content_published' else 'scheduled_content_failed' end,
    case when p_published then 'SCHEDULED_PUBLISHED:' else 'SCHEDULED_FAILED:' end
      || p_content_type || ':' || p_id::text
      || case when p_published then '' else ':' || to_char(now() at time zone 'UTC', 'YYYYMMDD"T"HH24MISS.US') end,
    null, null, null,
    v_type, v_id,
    case when p_published then 'content' else 'scheduled_content' end, p_id,
    jsonb_build_object('content_type', p_content_type),
    null, null,
    jsonb_build_object('content_type', p_content_type, 'content_id', p_id),
    p_recipient);
end;
$$;

revoke all on function public.footme_notify_scheduled_content(uuid, text, uuid, boolean) from public;
revoke execute on function public.footme_notify_scheduled_content(uuid, text, uuid, boolean) from anon, authenticated;


/* notifications_before_insert: da 20261111090000 §9 (definizione più recente,
   estratta dal file e patchata per sostituzione esatta) con DUE differenze:
   (1) i nove tipi social/programmati HOM-14 sono categoria 'attivita';
   (2) 'new_follower' NON è più gated da notification_preferences.new_followers
       (§182: la preferenza è push e non toglie l'evento dal Centro). Nessuno
       dei tipi HOM-14 ha una voce di gating in-app: le preferenze sociali sono
       solo push. Restano gated i soli tipi operativi (requests, applications,
       content_tags, store, promotions). */
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


-- ============================================================
-- SEZIONE 6 — RPC client del Centro Notifiche
--
-- Lettura (timeline, badge): SECURITY INVOKER. La tabella `notifications` ha
-- RLS (proprietario + policy restrittiva sulle risposte agli eventi) e le
-- schede attore leggono `clubs`/`profiles`/`media_profiles` sotto le loro
-- policy: una definer le scavalcherebbe (trappola «RPC su clubs»). Un attore
-- che le policy non lasciano leggere esce come «non disponibile», senza crash
-- (§266). Scrittura (seen, opened, delete): SECURITY DEFINER con
-- `recipient_profile_id = auth.uid()` nel WHERE: la riga è sempre dell'account
-- chiamante, mai di un altro admin della stessa Società (§107).
-- ============================================================

/* Una notifica verso una Società si legge solo finché l'account è ancora un
   destinatario (titolare o chiave attiva): una revoca toglie anche lo
   storico (§105). Restituisce solo un booleano: non espone dati della
   Società, quindi può essere chiamata da una funzione invoker. */
create or replace function public.footme_notification_row_allowed(
  p_recipient_identity_type text,
  p_recipient_identity_id   uuid,
  p_type                    text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.footme_notification_account_allowed(
    auth.uid(), p_type, p_recipient_identity_type, p_recipient_identity_id);
$$;

revoke all on function public.footme_notification_row_allowed(text, uuid, text) from public;
revoke execute on function public.footme_notification_row_allowed(text, uuid, text) from anon;
grant execute on function public.footme_notification_row_allowed(text, uuid, text) to authenticated;

/**
 * Timeline unica dell'account (§20–§25, §101, §143, §222).
 *
 * Ordine display_at DESC (= updated_at) e id DESC; cursore keyset
 * (p_before_at, p_before_id) = display_at e id dell'ULTIMA riga ricevuta.
 * Gli stati sono tecnici, non un boolean: n_is_new = seen_revision <
 * revision (contribuisce al badge); n_is_opened = read_revision >= revision
 * (bianca). NEW e SEEN_NOT_OPENED sono entrambe «non aperte» (§29).
 * Colonne OUT con prefisso n_: nessuna ambiguità con le colonne di
 * `notifications`. n_as_of è l'ora del server: è il cutoff da passare a
 * mark_notification_center_seen, mai l'orologio del device (§15–§16).
 * n_has_more è uguale su tutte le righe della pagina.
 */
create or replace function public.fetch_notification_timeline(
  p_before_at timestamptz default null,
  p_before_id uuid        default null,
  p_limit     integer     default 30
)
returns table (
  n_id                 uuid,
  n_type               text,
  n_category           text,
  n_title              text,
  n_body               text,
  n_data               jsonb,
  n_revision           integer,
  n_is_new             boolean,
  n_is_opened          boolean,
  n_display_at         timestamptz,
  n_created_at         timestamptz,
  n_event_count        integer,
  n_actor_type         text,
  n_actor_id           uuid,
  n_actor_name         text,
  n_actor_avatar_url   text,
  n_actor_verified     boolean,
  n_actor_available    boolean,
  n_recipient_type     text,
  n_recipient_id       uuid,
  n_recipient_name     text,
  n_recipient_managed  boolean,
  n_target_type        text,
  n_target_id          uuid,
  n_target_params      jsonb,
  n_preview            text,
  n_has_more           boolean,
  n_as_of              timestamptz
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 50);
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  return query
  select q.*
  from (
    select
      n.id,
      n.type,
      n.category,
      n.title,
      n.body,
      n.data,
      n.revision,
      (n.seen_revision < n.revision),
      (coalesce(n.read_revision, 0) >= n.revision),
      n.updated_at,
      n.created_at,
      n.event_count,
      n.actor_identity_type,
      n.actor_identity_id,
      case n.actor_identity_type
        when 'society' then ac.name
        when 'media'   then coalesce(nullif(btrim(amp.entity_name), ''), nullif(btrim(ap.full_name), ''))
        when 'person'  then nullif(btrim(ap.full_name), '')
      end,
      case n.actor_identity_type
        when 'society' then ac.logo_url
        when 'media'   then coalesce(amp.logo_url, ap.avatar_url)
        when 'person'  then ap.avatar_url
      end,
      case n.actor_identity_type
        when 'society' then coalesce(ac.verification_status = 'verified', false)
        when 'media'   then coalesce(amp.verification_status = 'verified', false)
        else false
      end,
      case n.actor_identity_type
        when 'society' then ac.id is not null
        when 'media'   then ap.id is not null
        when 'person'  then ap.id is not null
        else false
      end,
      n.recipient_identity_type,
      n.recipient_identity_id,
      case n.recipient_identity_type
        when 'society' then rc.name
        when 'media'   then coalesce(nullif(btrim(rmp.entity_name), ''), nullif(btrim(rp.full_name), ''))
        when 'person'  then nullif(btrim(rp.full_name), '')
      end,
      /* §98, §102: l'identità destinataria non è la persona dell'account. */
      (n.recipient_identity_type = 'society'
       or (n.recipient_identity_id is not null and n.recipient_identity_id <> v_uid)),
      n.target_type,
      n.target_id,
      n.target_params,
      n.preview_snapshot,
      (count(*) over () > v_limit),
      clock_timestamp()
    from public.notifications n
    left join public.profiles ap
      on n.actor_identity_type in ('person', 'media') and ap.id = n.actor_identity_id
    left join public.media_profiles amp
      on n.actor_identity_type = 'media' and amp.profile_id = n.actor_identity_id
    left join public.clubs ac
      on n.actor_identity_type = 'society' and ac.id = n.actor_identity_id
    left join public.profiles rp
      on n.recipient_identity_type in ('person', 'media') and rp.id = n.recipient_identity_id
    left join public.media_profiles rmp
      on n.recipient_identity_type = 'media' and rmp.profile_id = n.recipient_identity_id
    left join public.clubs rc
      on n.recipient_identity_type = 'society' and rc.id = n.recipient_identity_id
    where n.recipient_profile_id = v_uid
      and (p_before_at is null
           or (n.updated_at, n.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
      and public.footme_notification_row_allowed(n.recipient_identity_type, n.recipient_identity_id, n.type)
    order by n.updated_at desc, n.id desc
    limit v_limit + 1
  ) q
  order by q.updated_at desc, q.id desc
  limit v_limit;
end;
$$;

revoke all on function public.fetch_notification_timeline(timestamptz, uuid, integer) from public;
revoke execute on function public.fetch_notification_timeline(timestamptz, uuid, integer) from anon;
grant execute on function public.fetch_notification_timeline(timestamptz, uuid, integer) to authenticated;

/* Badge della campanella (§5–§7, §12, §213–§214): unità di inbox NUOVE
   (seen_revision < revision), non eventi grezzi: un aggregato con 12 Mi piace
   vale 1. Stessa tabella e stessa RLS della timeline. */
create or replace function public.fetch_notification_badge_count()
returns integer
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n   integer;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select count(*)::integer into v_n
  from public.notifications n
  where n.recipient_profile_id = v_uid
    and n.seen_revision < n.revision
    and public.footme_notification_row_allowed(n.recipient_identity_type, n.recipient_identity_id, n.type);

  return coalesce(v_n, 0);
end;
$$;

revoke all on function public.fetch_notification_badge_count() from public;
revoke execute on function public.fetch_notification_badge_count() from anon;
grant execute on function public.fetch_notification_badge_count() to authenticated;

/* Apertura del Centro (§14–§16, §216): marca VISTE le notifiche fino al
   cutoff. updated_at <= cutoff: un'attività arrivata dopo (anche su un
   aggregato già visto: updated_at si sposta) non viene vista di straforo.
   Non tocca read_revision: l'azzurrino resta (§217). Idempotente. */
create or replace function public.mark_notification_center_seen(p_cutoff timestamptz default null)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  update public.notifications n
  set seen_revision = n.revision
  where n.recipient_profile_id = v_uid
    and n.seen_revision < n.revision
    /* Margine di sicurezza all'indietro (§16–§17): una scrittura committata
       dopo la lettura della pagina, ma con updated_at appena prima del cutoff,
       non viene vista di straforo. */
    and n.updated_at <= coalesce(p_cutoff, clock_timestamp())
        - make_interval(secs => public.footme_policy_int('notification.seen_cutoff_margin_ms', 2000)::double precision / 1000.0);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_notification_center_seen(timestamptz) from public;
revoke execute on function public.mark_notification_center_seen(timestamptz) from anon;
grant execute on function public.mark_notification_center_seen(timestamptz) to authenticated;

/* Apertura di UNA notifica (§9, §121, §161, §177): opened = revisione
   corrente e, di conseguenza, vista (trigger). Anche per il tap su una push.
   Con p_revision, compare-and-set: se nel frattempo l'aggregato ha ricevuto
   nuova attività la riga NON si apre e risponde false (resta NEW/azzurra);
   senza, apre la revisione corrente (tap da push). Vero anche se la riga era
   già aperta. Un target non più disponibile non cambia nulla: la riga si apre
   comunque (§161). Solo il destinatario. */
create or replace function public.mark_notification_opened(
  p_id       uuid,
  p_revision integer default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  update public.notifications n
  set read_revision = n.revision
  where n.id = p_id
    and n.recipient_profile_id = auth.uid()
    and (p_revision is null or n.revision = p_revision)
  returning n.id into v_id;

  if v_id is not null then
    return true;
  end if;

  return exists (
    select 1 from public.notifications n
    where n.id = p_id
      and n.recipient_profile_id = auth.uid()
      and coalesce(n.read_revision, 0) >= n.revision);
end;
$$;

revoke all on function public.mark_notification_opened(uuid, integer) from public;
revoke execute on function public.mark_notification_opened(uuid, integer) from anon;
grant execute on function public.mark_notification_opened(uuid, integer) to authenticated;

/* Da 20261111090000 §6 (unica definizione), stessa firma: alias del nuovo
   comando per il client già distribuito. */
create or replace function public.mark_notification_read(
  p_notification_id uuid,
  p_revision        integer default null
)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select public.mark_notification_opened(p_notification_id, p_revision);
$$;

revoke all on function public.mark_notification_read(uuid, integer) from public;
revoke execute on function public.mark_notification_read(uuid, integer) from anon;
grant execute on function public.mark_notification_read(uuid, integer) to authenticated;

/* «Segna tutte come lette» non esiste (§18, §284): la RPC è rimossa. Lasciarla
   revocata avrebbe lasciato un comando vietato nel catalogo del database. */
drop function if exists public.mark_all_notifications_read(timestamptz);
drop function if exists public.mark_all_notifications_read();

/* Da 20260719090200 (unica definizione), stessa firma: «lette» = APERTE
   (read_revision >= revision), non viste. Una notifica aggregata tornata
   non aperta per nuova attività non si cancella. Le sorgenti restano (non
   rinasce un evento rielaborato). */
create or replace function public.delete_read_notifications()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  delete from public.notifications n
  where n.recipient_profile_id = v_uid
    and coalesce(n.read_revision, 0) >= n.revision;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.delete_read_notifications() from public;
revoke execute on function public.delete_read_notifications() from anon;
grant execute on function public.delete_read_notifications() to authenticated;


-- ============================================================
-- SEZIONE 7 — push: dispositivi, coda, eligibility, drain; retention
--
-- Il push è un CANALE della notifica (§176), non un evento a parte (§175): una
-- riga di coda per (notifica, revisione). Eligibility all'insert/aggiornamento
-- (preferenza, dispositivo, rate limit); rivalidazione al momento dell'invio
-- (§267–§269) dentro claim_push_deliveries. L'invio vero lo fa la Edge
-- Function `send-push` (Deno), che parla con l'API Expo: qui non c'è rete.
-- ============================================================

/* Token Expo per account (§179). Chiusa ai client: si scrive con
   register_push_device. Un token appartiene a UN account alla volta (un
   dispositivo condiviso dopo logout/login passa all'ultimo che lo registra). */
create table if not exists public.notification_push_devices (
  id               uuid        primary key default gen_random_uuid(),
  profile_id       uuid        not null references public.profiles(id) on delete cascade,
  expo_push_token  text        not null unique,
  platform         text        not null check (platform in ('ios', 'android', 'web')),
  app_version      text,
  enabled          boolean     not null default true,
  last_seen_at     timestamptz not null default timezone('utc', now()),
  created_at       timestamptz not null default timezone('utc', now()),
  constraint notification_push_devices_token_check
    check (expo_push_token ~ '^(Expo|Exponent)PushToken\[[^\]]+\]$')
);

create index if not exists notification_push_devices_profile_idx
  on public.notification_push_devices (profile_id) where enabled;

alter table public.notification_push_devices enable row level security;
revoke all on public.notification_push_devices from public, anon, authenticated;

/* Coda delivery. Senza grant ai client. FK con cascade: eliminare la notifica
   toglie la sua coda. */
create table if not exists public.notification_push_deliveries (
  id                   bigserial   primary key,
  notification_id      uuid        not null references public.notifications(id) on delete cascade,
  recipient_profile_id uuid        not null references public.profiles(id) on delete cascade,
  revision             integer     not null,
  priority             text        not null check (priority in ('high', 'medium', 'low')),
  category             text        not null,
  status               text        not null default 'pending'
                                   check (status in ('pending', 'sent', 'suppressed', 'failed')),
  reason               text,
  attempts             integer     not null default 0,
  claimed_at           timestamptz,
  next_attempt_at      timestamptz,
  created_at           timestamptz not null default timezone('utc', now()),
  processed_at         timestamptz,
  unique (notification_id, revision)
);

create index if not exists notification_push_deliveries_pending_idx
  on public.notification_push_deliveries (id) where status = 'pending';
create index if not exists notification_push_deliveries_rate_idx
  on public.notification_push_deliveries (recipient_profile_id, priority, created_at desc);

alter table public.notification_push_deliveries enable row level security;
revoke all on public.notification_push_deliveries from public, anon, authenticated;
revoke all on sequence public.notification_push_deliveries_id_seq from public, anon, authenticated;

create or replace function public.register_push_device(
  p_token       text,
  p_platform    text,
  p_app_version text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_token is null or p_token !~ '^(Expo|Exponent)PushToken\[[^\]]+\]$'
     or p_platform is null or p_platform not in ('ios', 'android', 'web') then
    raise exception 'push_device_invalid' using errcode = '22023';
  end if;

  insert into public.notification_push_devices as d
    (profile_id, expo_push_token, platform, app_version, enabled, last_seen_at)
  values (v_uid, p_token, p_platform, left(p_app_version, 40), true, timezone('utc', now()))
  on conflict (expo_push_token) do update
    set profile_id   = excluded.profile_id,
        platform     = excluded.platform,
        app_version  = excluded.app_version,
        enabled      = true,
        last_seen_at = excluded.last_seen_at;

  /* Al più 10 dispositivi attivi per account: i più vecchi escono. */
  delete from public.notification_push_devices d
  where d.profile_id = v_uid
    and d.id in (
      select x.id from public.notification_push_devices x
      where x.profile_id = v_uid
      order by x.last_seen_at desc, x.id
      offset 10);

  return true;
end;
$$;

revoke all on function public.register_push_device(text, text, text) from public;
revoke execute on function public.register_push_device(text, text, text) from anon;
grant execute on function public.register_push_device(text, text, text) to authenticated;

/* Logout o permesso OS tolto (§179, §274). Solo il token dell'account
   chiamante. Idempotente. */
create or replace function public.unregister_push_device(p_token text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n   integer;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  delete from public.notification_push_devices d
  where d.expo_push_token = p_token and d.profile_id = v_uid;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

revoke all on function public.unregister_push_device(text) from public;
revoke execute on function public.unregister_push_device(text) from anon;
grant execute on function public.unregister_push_device(text) to authenticated;

/* Eligibility push di una notifica appena scritta o aggiornata (§203–§210).
   Chiamata da footme_notify_event. push_state descrive l'ULTIMA revisione.
   - preferenza spenta → suppressed (l'in-app resta: §182);
   - nessun dispositivo attivo → niente coda;
   - stessa notifica già consegnata/in coda da meno di min_interval della sua
     priorità → suppressed (aggiornamento silenzioso dell'aggregato, §206);
   - tetto orario per account e PRIORITÀ → suppressed (contatori separati: un
     burst di LOW non toglie posto a una Mention HIGH, §207–§210). */
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

/* Testo del push (§211): titolo fisso e corpo breve «attore + azione», mai il
   testo di un commento o di un Post. Per una Società gestita il nome della
   Società chiude il corpo (§98). */
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

  if v_n.type in ('scheduled_content_published', 'scheduled_content_failed') then
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

/**
 * Prende dalla coda le delivery da inviare, RIVALIDANDO ciascuna adesso
 * (§167, §267–§269). Solo service_role (la Edge Function). Una delivery
 * riprende da `claimed_at` più vecchio di 5 minuti (worker caduto dopo la
 * claim). Colonne OUT con prefisso d_.
 *
 * Soppressa, con motivo, se: preferenza spenta nel frattempo; notifica già
 * aperta; superata da una revisione più nuova con delivery propria; blocco
 * fra attore e destinatario comparso dopo l'evento; contenuto/commento non più
 * leggibile dal destinatario (eliminato prima della consegna); nessun
 * dispositivo attivo.
 */
create or replace function public.claim_push_deliveries(p_limit integer default 50)
returns table (
  d_id              bigint,
  d_notification_id uuid,
  d_recipient       uuid,
  d_priority        text,
  d_title           text,
  d_body            text,
  d_data            jsonb,
  d_tokens          jsonb
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_limit  integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_max    integer := greatest(public.footme_policy_int('notification.push.max_attempts', 3), 1);
  r        record;
  v_n      public.notifications%rowtype;
  v_reason text;
  v_tokens jsonb;
  v_copy   record;
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
    select d.id, d.notification_id, d.revision, d.recipient_profile_id, d.priority, d.category
    from public.notification_push_deliveries d
    where d.status = 'pending'
      and d.attempts < v_max
      and (d.next_attempt_at is null or d.next_attempt_at <= clock_timestamp())
      and (d.claimed_at is null or d.claimed_at < clock_timestamp() - interval '5 minutes')
    order by case d.priority when 'high' then 0 when 'medium' then 1 else 2 end, d.id
    limit v_limit
    for update skip locked
  loop
    select n.* into v_n from public.notifications n where n.id = r.notification_id;
    v_reason := null;

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

    select * into v_copy from public.footme_notification_push_copy(r.notification_id);

    d_id              := r.id;
    d_notification_id := r.notification_id;
    d_recipient       := r.recipient_profile_id;
    d_priority        := r.priority;
    d_title           := v_copy.o_title;
    d_body            := v_copy.o_body;
    d_data            := jsonb_build_object('notification_id', r.notification_id);
    d_tokens          := v_tokens;
    return next;
  end loop;
end;
$$;

revoke all on function public.claim_push_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_push_deliveries(integer) to service_role;

/* Esito dell'invio. 'retry' rimette in coda fino a 3 tentativi. I token che
   Expo dichiara non più registrati vengono disattivati. */
create or replace function public.complete_push_delivery(
  p_id             bigint,
  p_status         text,
  p_reason         text   default null,
  p_invalid_tokens text[] default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_d      public.notification_push_deliveries%rowtype;
  v_status text;
begin
  if p_status not in ('sent', 'failed', 'retry') then
    raise exception 'push_status_invalid' using errcode = '22023';
  end if;

  select d.* into v_d from public.notification_push_deliveries d where d.id = p_id for update;
  if v_d.id is null then
    return;
  end if;

  v_status := case
    when p_status = 'retry'
         and v_d.attempts < greatest(public.footme_policy_int('notification.push.max_attempts', 3), 1) then 'pending'
    when p_status = 'retry' then 'failed'
    else p_status
  end;

  update public.notification_push_deliveries d
  set status = v_status,
      reason = left(p_reason, 200),
      claimed_at = case when v_status = 'pending' then null else d.claimed_at end,
      /* Backoff esponenziale: il retry non riparte subito. */
      next_attempt_at = case when v_status = 'pending'
        then clock_timestamp() + make_interval(secs =>
               greatest(public.footme_policy_int('notification.push.retry_backoff_seconds', 60), 1)::double precision
               * power(2, greatest(v_d.attempts - 1, 0)))
        else d.next_attempt_at end,
      processed_at = case when v_status = 'pending' then null else clock_timestamp() end
  where d.id = p_id;

  if v_status <> 'pending' then
    update public.notifications n set push_state = v_status where n.id = v_d.notification_id;
  end if;

  if p_invalid_tokens is not null then
    update public.notification_push_devices dv
    set enabled = false
    where dv.expo_push_token = any (p_invalid_tokens) and dv.profile_id = v_d.recipient_profile_id;
  end if;
end;
$$;

revoke all on function public.complete_push_delivery(bigint, text, text, text[]) from public, anon, authenticated;
grant execute on function public.complete_push_delivery(bigint, text, text, text[]) to service_role;

/* Retention (§232–§233): giorni da app_policy_settings, Mi piace più corti.
   Cancella a lotti; le sorgenti e le delivery vecchie seguono. Chiamata dal
   cron, mai dai client. */
create or replace function public.run_notification_retention_sweep(p_limit integer default 5000)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 5000), 1), 100000);
  v_def   integer := greatest(public.footme_policy_int('notification.retention_days.default', 180), 1);
  v_like  integer := greatest(public.footme_policy_int('notification.retention_days.like', 30), 1);
  v_n     integer;
begin
  with doomed as (
    select n.id from public.notifications n
    where n.updated_at < clock_timestamp() - make_interval(days => case when n.type = 'content_liked' then v_like else v_def end)
    order by n.updated_at
    limit v_limit
  )
  delete from public.notifications n using doomed where n.id = doomed.id;
  get diagnostics v_n = row_count;

  delete from public.notification_sources s
  where s.occurred_at < clock_timestamp() - make_interval(days => v_def)
     or (s.source_event_key like 'LIKE:%'
         and s.occurred_at < clock_timestamp() - make_interval(days => v_like));

  delete from public.notification_push_deliveries d
  where d.created_at < clock_timestamp() - interval '30 days' and d.status <> 'pending';

  return v_n;
end;
$$;

revoke all on function public.run_notification_retention_sweep(integer) from public;
revoke execute on function public.run_notification_retention_sweep(integer) from anon, authenticated;

/* Sveglia la Edge Function (pg_net) solo se ci sono delivery in coda e
   l'operatore ha configurato url e segreto in app_policy_settings
   ('notification.push.function_url', 'notification.push.webhook_secret'). Senza
   pg_net o senza configurazione è un no-op: la Edge Function resta invocabile
   da uno scheduler esterno. Nessun segreto vive in questa migrazione. */
create or replace function public.footme_push_wake()
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  if not exists (select 1 from public.notification_push_deliveries d where d.status = 'pending') then
    return false;
  end if;

  select s.value #>> '{}' into v_url from public.app_policy_settings s
  where s.key = 'notification.push.function_url';
  select s.value #>> '{}' into v_secret from public.app_policy_settings s
  where s.key = 'notification.push.webhook_secret';

  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    return false;
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'net' and p.proname = 'http_post') then
    return false;
  end if;

  execute format(
    'select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',
    v_url,
    jsonb_build_object('content-type', 'application/json', 'x-push-secret', v_secret)::text,
    '{}');
  return true;
end;
$$;

revoke all on function public.footme_push_wake() from public;
revoke execute on function public.footme_push_wake() from anon, authenticated;

/* Scheduler: pg_cron condizionale, come DAS-REV-31 §5. Idempotente
   (unschedule + schedule). Senza pg_cron (PGlite, sviluppo locale) la
   migrazione prosegue e lo dichiara: drain e retention restano chiamabili a
   mano. */
do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
   begin
    create extension if not exists pg_cron;

    if exists (select 1 from cron.job where jobname = 'notification-push-wake') then
      perform cron.unschedule('notification-push-wake');
    end if;
    perform cron.schedule('notification-push-wake', '* * * * *', 'select public.footme_push_wake()');

    if exists (select 1 from cron.job where jobname = 'notification-outbox-drain') then
      perform cron.unschedule('notification-outbox-drain');
    end if;
    perform cron.schedule('notification-outbox-drain', '*/5 * * * *', 'select public.footme_notify_drain_outbox(200)');

    if exists (select 1 from cron.job where jobname = 'notification-retention') then
      perform cron.unschedule('notification-retention');
    end if;
    perform cron.schedule('notification-retention', '17 3 * * *', 'select public.run_notification_retention_sweep(5000)');
   exception when others then
    raise warning 'HOM-14: pg_cron non attivabile (%); drain, push e retention non programmati.', sqlerrm;
   end;
  else
    raise notice 'HOM-14: pg_cron non disponibile; drain outbox, wake push e retention non programmati in questo ambiente.';
  end if;
end;
$do$;
