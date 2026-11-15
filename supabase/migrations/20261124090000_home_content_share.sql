-- ============================================================
-- HOM-09 — Condivisione contenuti: lato database
--
-- COSA MANCAVA
--
-- «Condividi» (HOM-09 §4) è oggi uno stub «in arrivo» e dietro non c'è nulla:
--
--   1. Nessun modo di mandare un contenuto in una conversazione. `messages`
--      conosce solo text / contact_card / image / video / document /
--      system_event: non esiste un messaggio che PUNTI a un contenuto
--      canonico (§2, §3, §95–§99), con il testo facoltativo dell'utente nella
--      stessa unità (§96–§97) e uno snapshot minimo per il primo rendering
--      (§100–§102). Il client scrive in `messages` con INSERT diretto: né il
--      batch (§127), né l'identità di consegna (§128), né l'esito per
--      destinazione (§140) hanno un posto dove vivere.
--   2. Nessuna ricerca di destinatari. Cerca→Profili / Cerca→Società sono
--      motori di scoperta con filtri propri; la lista «Invia a» (§43–§76) è
--      un'altra cosa: DIRECT esistenti + persone contattabili senza DIRECT +
--      Società/Media + GROUP, in UNA lista (§46), senza duplicare la persona
--      che ha già una DIRECT (§49–§51), con cursore (§74).
--   3. Nessun conteggio di Condivisioni. `fetch_content_insights` espone
--      `'shares', null` (HOM-05 §40: «non esiste ancora, riga nascosta»);
--      §193–§208 chiedono che il BACKEND decida quali eventi compongono la
--      metrica e che il client non sommi nulla.
--   4. La chat non sa mostrare un contenuto che nel frattempo è sparito o non
--      è più visibile a chi legge (§114–§122): `get_conversation_messages`
--      restituisce solo colonne del messaggio.
--
-- DECISIONI DI LUIGI (2026-11-14) CHE QUESTA MIGRAZIONE REALIZZA
--
--   * D1  Società e Media come destinatari = «ponte titolare». Una riga
--         Società (`kind = 'club'`, con `profile_id` = `clubs.owner_profile_id`,
--         risolto dalla ricerca invoker) si invia come destinazione `profile`
--         verso il titolare (lo stesso ponte di `app/club/[id].tsx`): il server
--         di invio NON legge `clubs` (vedi «DEVIAZIONI»);
--         un Media è un profilo: la sua riga (`kind = 'media'`, o `direct` se
--         la DIRECT esiste) ha logo ed entity_name. Senza titolare, o se il
--         titolare sono io, la riga è `available = false`.
--   * D3  Contattabilità = solo blocchi. Bloccato DA me → `available = false`
--         («Non disponibile per i messaggi»). Chi ha bloccato ME resta
--         selezionabile, perché la ricerca non deve rivelare il blocco
--         (MES-02): la sua consegna fallisce con `retryable = false`.
--   * D4  Metrica Condivisioni (HOM-05) = batch interni con almeno una
--         consegna riuscita (UNO per batch: il retry dello stesso batch non
--         ricalcola, §200) + Copia link riusciti (§201). L'apertura dello
--         share sheet esterno si registra ma NON compone la metrica e non è
--         mai «completata» (§202–§203, §206).
--         (D2, il link canonico, è tutta lato app: nessun effetto qui.)
--
-- PERCHÉ QUESTA SOLUZIONE (una regola in un posto solo)
--
--   * UN message object, non due messaggi (§95–§97): `messages` guadagna il
--     kind `content_reference` e cinque colonne (`content_ref_type`,
--     `content_ref_id`, `content_snapshot`, `share_batch_id`,
--     `share_delivery_key`). Nessun secondo store «share inbox» (§189): la
--     consegna È un messaggio e passa per gli stessi trigger di tutti gli
--     altri (gate dei gruppi, ordine `seq`, riapertura dall'archivio
--     personale, notifiche dei Messaggi → §190–§192: nessun produttore nuovo,
--     nessuna notifica «ti ha condiviso un Post»).
--   * Il client NON può scrivere un `content_reference` (§119–§121). RLS filtra
--     righe, non colonne: la policy di INSERT non basta contro un client che
--     manda uno snapshot inventato. Lo stesso schema della finestra di
--     comando del SYSTEM_EVENT: il trigger `messages_society_group_gate`
--     accetta il kind solo se la transazione ha aperto la finestra
--     (`content_share.command` = id della conversazione, GUC locale alla
--     transazione, non impostabile via PostgREST) e, dopo l'inserimento, i
--     campi del riferimento sono immutabili anche per un UPDATE del client
--     (la policy di UPDATE dei messaggi per il read receipt esiste ancora).
--   * Lo snapshot lo costruisce il SERVER da `feed_content_index`, mai il
--     client (§100–§101): item_kind (stessa classificazione del Feed,
--     `footme_feed_item_type`), titolo, excerpt <= 160, thumbnail, durata,
--     autore con verifica e meta. Forma PIATTA (chiavi `author_*`), concordata
--     con il client: item_kind, title, excerpt, thumbnail_url, media_type,
--     duration_seconds, author_identity_type, author_id, author_name,
--     author_avatar_url, author_is_verified, author_meta. NON è fonte di verità: la chat lo mostra
--     solo se la rilettura per il lettore (`footme_content_readable`) riesce;
--     altrimenti `get_conversation_messages` NON lo restituisce e la card è
--     «Contenuto non disponibile» (§114–§118, §122). Il testo dell'utente
--     resta nel body. Nessun purge dello snapshot (default concordato).
--   * `send_content_share` è UNA RPC con esito per destinazione (§125, §140,
--     §224–§226): ogni destinazione vive in un proprio blocco
--     `begin … exception`, quindi la DIRECT creata per una persona e il
--     messaggio sono atomici e un fallimento non tocca le altre. Idempotenza
--     su `(sender, share_delivery_key)` (indice unico parziale): lo stesso
--     retry non crea un secondo messaggio (§128–§129, §141–§142) e restituisce
--     lo stesso `message_id`. Le regole di invio che la policy RLS applicherebbe
--     a un client (partecipante, `conversation_can_send`, blocco) si applicano
--     QUI esplicitamente, perché la funzione è definer e RLS non c'è: sono le
--     stesse funzioni che la policy chiama, non una copia.
--   * `content_share_actions` (tabella chiusa, nessuna policy, nessun grant) è
--     UNA riga per batch (id = share_batch_id) con delivery_count e
--     deliveries_ok ricalcolati: il retry parziale non crea una seconda azione
--     (§143, §199–§200). Copia link e apertura share sheet sono righe con lo
--     stesso formato (id = event id del client → idempotenti).
--   * La ricerca destinatari NON è un motore nuovo (§47). Le conversazioni
--     vengono da `fetch_inbox_conversations` (stessa visibilità dell'Inbox:
--     niente gruppi eliminati, confini di periodo; qui in più solo
--     direct/group — mai Comunicazioni, §29/§186 — e solo gruppi ACTIVE);
--     persone e Società dalle stesse tabelle e regole di Cerca (profili
--     leggibili agli autenticati, `clubs.name` ilike, Media = media_profiles).
--     È SECURITY INVOKER perché legge `clubs` (trappola nota: una definer
--     eseguita dal proprio owner può leggere zero club); il suo unico accesso
--     privilegiato è l'Inbox, che è definer di suo.
--
-- DEVIAZIONI E LIMITI DICHIARATI
--
--   * Limite testo: 500 caratteri (contratto). Oggi i messaggi non hanno un
--     limite lato DB né lato client; si applica solo alla condivisione.
--   * `interactions` di fetch_content_insights NON include le condivisioni: il
--     totale e l'andamento (`footme_content_interaction_rows`) restano come in
--     HOM-05/HOM-07/HOM-08. Si riempie solo la riga `shares`, null per i tipi
--     che non hanno «Condividi» (fan_tribuna, media_tribuna).
--   * Tipi condivisibili: profile_post, club_media, media_profile, fan_media
--     (§1: Post, Articolo, Video). I due «tribuna» restano fuori come oggi.
--   * `send_content_share` accetta solo destinazioni `conversation` e `profile`;
--     `kind = 'club'` è `invalid_destination`. Una Società non si risolve nel
--     server di invio: una definer eseguita dal proprio owner può leggere zero
--     club (la policy SELECT di `clubs` è `TO authenticated`; bug già pagato in
--     20260724120000 e REV-PROF-17). `search_share_recipients` è invoker e
--     restituisce nella riga `club` il titolare in `profile_id`: il client invia
--     `profile`. Due righe che portano alla stessa persona (la persona P e la
--     Società di cui P è titolare) vanno deduplicate dal client per `profile_id`;
--     se non lo fa, producono due messaggi.
--   * Dipendenza residua da `clubs` dentro le definer, NON eliminabile qui:
--     `footme_content_readable` e `footme_share_snapshot` leggono
--     `feed_content_index`, che per i `club_media` fa join con `clubs` (vista del
--     Feed HOM-01, letta da tutte le RPC definer del Feed, di Mi piace, Commenti e
--     Insights con lo stesso proprietario). Se sul remoto quel join desse zero
--     righe, un contenuto Società risulterebbe non leggibile ovunque (anche qui:
--     `content_unavailable`), non solo nello snapshot: sarebbe un difetto
--     sistemico del Feed, non di questa migrazione. Degradazione limitata a
--     questa migrazione: `author_meta` (club_name, club_category) letto da
--     `footme_comment_author_meta` può uscire con quei campi null. author_name e
--     avatar dei contenuti Società vengono da `feed_content_index`
--     (`publisher_name`, `publisher_avatar_url`), non da una lettura diretta.
--     Su PGlite l'utente è superuser e la RLS non si applica: non dimostrabile
--     qui, verificare sul remoto prima del rilascio.
--   * Anti-gonfiaggio della metrica: `record_content_share_event` registra al più
--     UNA riga `copy_link` e UNA `external_sheet_open` per (utente, contenuto,
--     giorno civile Europe/Rome), con un indice unico parziale
--     (`content_share_actions_event_day_key`, colonna `event_day`). Una chiamata
--     duplicata risponde `{"status":"ok"}` senza una nuova riga. Il giorno dopo
--     la stessa azione conta di nuovo. Un batch interno resta una azione per
--     `share_batch_id` (nessun tetto: sono messaggi veri, già limitati a 20
--     destinazioni per chiamata).
--   * D3 nel JSON: un destinatario che mi ha bloccato e un destinatario non
--     disponibile restituiscono lo STESSO `reason` (`recipient_unavailable`,
--     non ritentabile): la risposta non distingue il blocco subito. In ricerca
--     «bloccato DA me» resta `available = false`.
--   * RISCHIO ACCETTATO — `content_snapshot` e RLS: la policy SELECT di `messages`
--     filtra righe, non colonne, quindi un partecipante che legge la tabella
--     direttamente vede lo snapshot anche quando la card, via
--     `get_conversation_messages`, è «Contenuto non disponibile». Lo snapshot è
--     il minimo che il destinatario aveva già ricevuto al momento dell'invio
--     (autore, titolo, excerpt <= 160, thumbnail) e il contratto esclude il
--     purge. Il client non legge `messages` con select (solo insert e realtime),
--     ma chiudere la colonna richiederebbe di togliere il grant di colonna e di
--     rendere definer `get_conversation_messages`: non fatto.
--   * Costo non misurato: `get_conversation_messages` chiama
--     `content_share_message_available` (quindi `footme_content_readable`, una
--     lettura di `feed_content_index`) UNA volta per ogni messaggio
--     `content_reference` della conversazione. Su chat con molte condivisioni
--     è una scansione per riga; non misurato né ottimizzato.
--   * Ricerca: `person_rows` include tutti i ruoli tranne club_admin e media
--     (anche i tifosi), mentre Cerca→Profili filtra player/coach/staff/agent.
--     Voluto: §48 ammette «persone contattabili senza DIRECT» e MES-02 ha reso i
--     messaggi aperti a tutti (stop solo sui blocchi, D3), quindi il filtro per
--     ruolo di Cerca non è la regola di contattabilità.
--   * Concorrenza vera non riproducibile in PGlite (una sola connessione): si
--     verificano le conseguenze (indice unico, retry sequenziale).
--
-- FUNZIONI RIEMESSE (ciascuna dalla sua ULTIMA definizione effettiva)
--
--   * messages_society_group_gate  ← 20261113090000 (+ finestra
--                                    content_reference, + immutabilità)
--   * get_conversation_messages    ← 20261113090000 (+4 colonne in coda)
--   * fetch_content_insights       ← 20261119090000 (solo `shares`; il resto è
--                                    identico, verificato per differenza)
--   fetch_inbox_conversations NON è riemessa: espone già `last_message_kind`
--   e `last_message_body` (vuoto per una condivisione senza testo); la helper
--   Inbox del client userà «Contenuto condiviso» per kind = content_reference.
--
-- ============================================================


-- ============================================================
-- SEZIONE 1 — messages: kind, colonne del riferimento, forma
-- ============================================================

alter table public.messages
  add column if not exists content_ref_type     text,
  add column if not exists content_ref_id       uuid,
  add column if not exists content_snapshot     jsonb,
  add column if not exists share_batch_id       uuid,
  add column if not exists share_delivery_key   text;

/* Riemesso da 20261113090000 (ultima definizione del check): sei kind più il nuovo. */
alter table public.messages
  drop constraint if exists messages_message_kind_check;

alter table public.messages
  add constraint messages_message_kind_check
  check (message_kind in (
    'text', 'contact_card', 'image', 'video', 'document', 'system_event', 'content_reference'
  ));

/* Forma (§98): un content_reference ha tipo, id, batch e chiave di consegna;
   nessun altro kind porta alcun campo del riferimento. `body` resta NOT NULL e
   senza check di non-vuoto: una condivisione senza testo ha body = ''. */
alter table public.messages
  drop constraint if exists messages_content_reference_shape;

alter table public.messages
  add constraint messages_content_reference_shape
  check (
    (
      message_kind = 'content_reference'
      and content_ref_type in ('profile_post', 'club_media', 'media_profile', 'fan_media')
      and content_ref_id is not null
      and share_batch_id is not null
      and share_delivery_key is not null
      and (content_snapshot is null or jsonb_typeof(content_snapshot) = 'object')
    )
    or (
      message_kind <> 'content_reference'
      and content_ref_type is null
      and content_ref_id is null
      and content_snapshot is null
      and share_batch_id is null
      and share_delivery_key is null
    )
  );

/* Idempotenza di consegna (§128–§129): stessa chiave dello stesso mittente = un
   solo messaggio. */
create unique index if not exists messages_share_delivery_key_idx
  on public.messages (sender_profile_id, share_delivery_key)
  where share_delivery_key is not null;

create index if not exists messages_share_batch_idx
  on public.messages (share_batch_id)
  where share_batch_id is not null;

comment on column public.messages.content_ref_id is
  'HOM-09 §2, §99: contenuto canonico puntato da un messaggio content_reference. '
  'Si scrive solo da send_content_share (finestra content_share.command).';
comment on column public.messages.content_snapshot is
  'HOM-09 §100–§102: snapshot minimo costruito dal server. Non è fonte di verità: '
  'get_conversation_messages lo restituisce solo se il contenuto è leggibile dal lettore.';


-- ============================================================
-- SEZIONE 2 — gate di scrittura: il riferimento si scrive solo dalla RPC
-- ============================================================

/**
 * Riemessa da 20261113090000 (ultima definizione). Cambia SOLO:
 *   · INSERT: un `content_reference` è ammesso solo con la finestra di comando
 *     aperta sulla stessa conversazione (`content_share.command`); poi segue il
 *     normale gate dei gruppi (lock `for share`, ACTIVE, non eliminato, membro)
 *     e `seq` assegnato dopo il lock, come per ogni messaggio;
 *   · UPDATE: i campi del riferimento non si modificano mai (§101: lo snapshot
 *     non è riscrivibile dal client; §119: la condivisione non concede accesso).
 * Tutto il resto — SYSTEM_EVENT, allegati, immutabilità di body/media nei
 * gruppi, `read_at` libero — è identico.
 */
create or replace function public.messages_society_group_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status  text;
  v_deleted timestamptz;
  v_found   boolean;
begin
  if tg_op = 'UPDATE' then
    new.seq := old.seq;

    if new.message_kind is distinct from old.message_kind
       or new.system_event_type is distinct from old.system_event_type
       or new.system_payload is distinct from old.system_payload
       or new.system_dedup_key is distinct from old.system_dedup_key then
      raise exception 'SYSTEM_EVENT_COMMAND_REQUIRED';
    end if;

    if new.content_ref_type is distinct from old.content_ref_type
       or new.content_ref_id is distinct from old.content_ref_id
       or new.content_snapshot is distinct from old.content_snapshot
       or new.share_batch_id is distinct from old.share_batch_id
       or new.share_delivery_key is distinct from old.share_delivery_key then
      raise exception 'CONTENT_REFERENCE_IMMUTABLE';
    end if;

    if new.conversation_id is distinct from old.conversation_id
       or new.sender_profile_id is distinct from old.sender_profile_id then
      raise exception 'MESSAGE_IMMUTABLE';
    end if;

    if (new.body is distinct from old.body or new.media_url is distinct from old.media_url)
       and public.conversation_is_group(old.conversation_id) then
      raise exception 'SOCIETY_GROUP_MESSAGE_IMMUTABLE';
    end if;

    return new;
  end if;

  if new.message_kind = 'system_event' then
    new.seq := nextval('public.messages_seq_seq');

    if not public.society_group_window_is_open(new.conversation_id)
       or not exists (
         select 1 from public.society_groups g where g.conversation_id = new.conversation_id
       ) then
      raise exception 'SYSTEM_EVENT_COMMAND_REQUIRED';
    end if;

    return new;
  end if;

  if new.message_kind = 'content_reference'
     and coalesce(current_setting('content_share.command', true), '') <> new.conversation_id::text then
    raise exception 'CONTENT_SHARE_COMMAND_REQUIRED';
  end if;

  if new.media_url is not null then
    if coalesce((storage.foldername(new.media_url))[1], '') <> new.conversation_id::text then
      raise exception 'MESSAGE_MEDIA_FOLDER_MISMATCH';
    end if;

    if exists (select 1 from public.messages m where m.media_url = new.media_url) then
      raise exception 'MESSAGE_MEDIA_ALREADY_REFERENCED';
    end if;
  end if;

  select g.status, g.deleted_at, true
  into v_status, v_deleted, v_found
  from public.society_groups g
  where g.conversation_id = new.conversation_id
  for share;

  if coalesce(v_found, false) then
    if v_deleted is not null then
      raise exception 'SOCIETY_GROUP_DELETED';
    end if;

    if v_status <> 'active' then
      raise exception 'SOCIETY_GROUP_ARCHIVED';
    end if;

    if not exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = new.conversation_id
        and cp.profile_id = new.sender_profile_id
    ) then
      raise exception 'SOCIETY_GROUP_NOT_MEMBER';
    end if;
  end if;

  /* Dopo il lock: un invio che ha aspettato un archivio/eliminazione non
     precede nell'ordine l'evento che il comando ha già scritto. */
  new.seq := nextval('public.messages_seq_seq');

  return new;
end;
$$;

revoke all on function public.messages_society_group_gate() from public;
revoke all on function public.messages_society_group_gate() from anon, authenticated;


-- ============================================================
-- SEZIONE 3 — content_share_actions: una riga per azione di condivisione
-- ============================================================

create table if not exists public.content_share_actions (
  id                 uuid        primary key,
  sharer_profile_id  uuid        not null references public.profiles(id) on delete cascade,
  content_type       text        not null
                                 check (content_type in ('profile_post', 'club_media', 'media_profile', 'fan_media')),
  content_id         uuid        not null,
  action_kind        text        not null
                                 check (action_kind in ('internal', 'copy_link', 'external_sheet_open')),
  delivery_count     integer     not null default 0 check (delivery_count >= 0),
  deliveries_ok      integer     not null default 0 check (deliveries_ok >= 0),
  created_at         timestamptz not null default timezone('utc', now()),
  completed_at       timestamptz,
  /* Giorno civile (Europe/Rome) degli eventi Copia link / share sheet: chiave
     di deduplica. Null per le azioni interne (un batch è una sola azione). */
  event_day          date,
  constraint content_share_actions_ok_le_count check (deliveries_ok <= delivery_count),
  constraint content_share_actions_kind_shape check (
    action_kind = 'internal' or (delivery_count = 0 and deliveries_ok = 0)
  ),
  constraint content_share_actions_event_day_shape check (
    (action_kind = 'internal') = (event_day is null)
  )
);

/* Anti-gonfiaggio (review): al più UNA riga copy_link e UNA external_sheet_open
   per (utente, contenuto, giorno civile). È un vincolo, non una select: due
   chiamate concorrenti con event_id diversi non possono entrambe inserire. */
create unique index if not exists content_share_actions_event_day_key
  on public.content_share_actions (sharer_profile_id, content_type, content_id, action_kind, event_day)
  where action_kind <> 'internal';

/* Conteggio della metrica (D4): solo azioni completate. */
create index if not exists content_share_actions_content_idx
  on public.content_share_actions (content_type, content_id)
  where completed_at is not null;

alter table public.content_share_actions enable row level security;
revoke all on table public.content_share_actions from public, anon, authenticated;

comment on table public.content_share_actions is
  'HOM-09 §193–§208: una riga per azione di condivisione (batch interno, Copia link, '
  'apertura share sheet). Chiusa ai client: escono solo aggregati (fetch_content_insights).';


-- ============================================================
-- SEZIONE 4 — snapshot e disponibilità (helper)
-- ============================================================

/**
 * Snapshot minimo di un contenuto (§100): lo costruisce il server, mai il
 * client. Interna: nessun grant ai client. Stessa classificazione del Feed
 * (`footme_feed_item_type`) e stesso mapping autore di Salvati/Commenti
 * (person | society | media, meta da `footme_comment_author_meta`). Mai il
 * corpo intero: excerpt <= 160, spazi collassati. Un Post non ha titolo.
 */
create or replace function public.footme_share_snapshot(p_content_type text, p_content_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'item_kind', k.item_kind,
    'title', case when k.item_kind = 'post' then null
                  else left(nullif(btrim(fci.title), ''), 160) end,
    'excerpt', nullif(left(regexp_replace(
                 btrim(coalesce(case when k.item_kind = 'post'
                                     then coalesce(nullif(btrim(fci.body), ''), nullif(btrim(fci.excerpt), ''))
                                     else nullif(btrim(fci.excerpt), '') end, '')),
                 '\s+', ' ', 'g'), 160), ''),
    'thumbnail_url', fci.thumbnail_url,
    'media_type', fci.media_type,
    'duration_seconds', case when fci.media_type = 'video' then fci.duration_seconds end,
    'author_identity_type', a.author_type,
    'author_id', fci.publisher_id,
    'author_name', fci.publisher_name,
    'author_avatar_url', fci.publisher_avatar_url,
    'author_is_verified', coalesce(fci.publisher_is_verified, false),
    'author_meta', public.footme_comment_author_meta(a.author_type, fci.publisher_id))
  from public.feed_content_index fci
  cross join lateral (
    select case public.footme_feed_item_type(fci.content_type, fci.content_format)
             when 'article' then 'article'
             when 'video'   then 'video'
             else 'post'
           end as item_kind
  ) k
  cross join lateral (
    select case
             when fci.publisher_type = 'club' then 'society'
             when fci.content_type in ('media_profile', 'media_tribuna') then 'media'
             else 'person'
           end as author_type
  ) a
  where fci.content_type = p_content_type
    and fci.post_id = p_content_id;
$$;

revoke all on function public.footme_share_snapshot(text, uuid) from public;
revoke execute on function public.footme_share_snapshot(text, uuid) from anon, authenticated;

/**
 * Per get_conversation_messages (SECURITY INVOKER): il contenuto puntato da un
 * messaggio che il chiamante può leggere è leggibile DA LUI adesso? (§122).
 * Prende l'id del messaggio, non una coppia (tipo, id): non è un oracolo di
 * leggibilità per contenuti arbitrari, e risponde null a chi non vede il
 * messaggio (non partecipante, fuori dal confine del periodo).
 */
create or replace function public.content_share_message_available(p_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.footme_content_readable(auth.uid(), m.content_ref_type, m.content_ref_id)
  from public.messages m
  where m.id = p_message_id
    and m.message_kind = 'content_reference'
    and auth.uid() is not null
    and m.seq >= coalesce(public.conversation_access_from_seq(m.conversation_id), 9223372036854775807);
$$;

revoke all on function public.content_share_message_available(uuid) from public;
revoke execute on function public.content_share_message_available(uuid) from anon;
grant execute on function public.content_share_message_available(uuid) to authenticated;


-- ============================================================
-- SEZIONE 5 — send_content_share: invio con esito per destinazione
--
-- p_destinations: array (1..20) di
--   { "delivery_key": text, "kind": "conversation"|"profile",
--     "conversation_id"?: uuid, "profile_id"?: uuid }   (`club` = invalid_destination)
-- Ritorno:
--   { "status": "ok"|"partial"|"failed"|"content_unavailable",
--     "outcomes": [ { "delivery_key", "ok", "retryable", "conversation_id",
--                     "message_id", "reason"? } ] }
-- `reason` è un codice interno: il client non lo mostra (§217). Un input
-- malformato (batch/tipo/testo/destinazioni) è un errore 22023: è un bug del
-- chiamante, non un esito di flusso.
-- ============================================================

create or replace function public.send_content_share(
  p_batch_id      uuid,
  p_content_type  text,
  p_content_id    uuid,
  p_text          text,
  p_destinations  jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_text      text;
  v_action    record;
  v_snapshot  jsonb;
  v_dest      jsonb;
  v_key       text;
  v_kind      text;
  v_seen      text[] := array[]::text[];
  v_outcomes  jsonb := '[]'::jsonb;
  v_ok        boolean;
  v_retry     boolean;
  v_reason    text;
  v_conv      uuid;
  v_msg       uuid;
  v_target    uuid;
  v_n_ok      integer := 0;
  v_n_fail    integer := 0;
  v_ok_total  integer;
  v_known     integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_batch_id is null or p_content_id is null then
    raise exception 'invalid_share_request' using errcode = '22023';
  end if;

  if p_content_type is null
     or p_content_type not in ('profile_post', 'club_media', 'media_profile', 'fan_media') then
    raise exception 'invalid_content_type' using errcode = '22023';
  end if;

  v_text := btrim(coalesce(p_text, ''));
  if char_length(v_text) > 500 then
    raise exception 'share_text_too_long' using errcode = '22023';
  end if;

  if p_destinations is null
     or jsonb_typeof(p_destinations) <> 'array'
     or jsonb_array_length(p_destinations) = 0
     or jsonb_array_length(p_destinations) > 20 then
    raise exception 'invalid_destinations' using errcode = '22023';
  end if;

  for v_dest in select e.value from jsonb_array_elements(p_destinations) e loop
    if jsonb_typeof(v_dest) <> 'object'
       or nullif(btrim(v_dest ->> 'delivery_key'), '') is null
       or char_length(v_dest ->> 'delivery_key') > 200 then
      raise exception 'invalid_destinations' using errcode = '22023';
    end if;
  end loop;

  /* §212–§213: contenuto eliminato/non leggibile prima dell'invio → nessun invio. */
  if not public.footme_content_readable(v_uid, p_content_type, p_content_id) then
    return jsonb_build_object('status', 'content_unavailable', 'outcomes', '[]'::jsonb);
  end if;

  v_snapshot := public.footme_share_snapshot(p_content_type, p_content_id);
  if v_snapshot is null then
    return jsonb_build_object('status', 'content_unavailable', 'outcomes', '[]'::jsonb);
  end if;

  /* Un batch appartiene a chi l'ha aperto, a quel contenuto, ed è interno. */
  select a.sharer_profile_id, a.content_type, a.content_id, a.action_kind
  into v_action
  from public.content_share_actions a
  where a.id = p_batch_id;

  if found and (
       v_action.sharer_profile_id <> v_uid
       or v_action.action_kind <> 'internal'
       or v_action.content_type <> p_content_type
       or v_action.content_id <> p_content_id
     ) then
    return jsonb_build_object('status', 'failed', 'outcomes', '[]'::jsonb, 'reason', 'batch_conflict');
  end if;

  for v_dest in select e.value from jsonb_array_elements(p_destinations) e loop
    v_key := btrim(v_dest ->> 'delivery_key');

    if v_key = any (v_seen) then
      continue;
    end if;
    v_seen := v_seen || v_key;

    v_ok := false;
    v_retry := false;
    v_reason := null;
    v_conv := null;
    v_msg := null;
    v_target := null;

    /* Atomicità per destinazione (§226): la DIRECT creata e il messaggio sono
       una sola sotto-transazione; un fallimento non tocca le altre. */
    begin
      /* Idempotenza (§128–§129): la chiave è già stata consegnata. */
      select m.id, m.conversation_id
      into v_msg, v_conv
      from public.messages m
      where m.sender_profile_id = v_uid
        and m.share_delivery_key = v_key;

      if found then
        v_ok := true;
      else
        v_kind := v_dest ->> 'kind';

        if v_kind = 'conversation' then
          v_conv := (v_dest ->> 'conversation_id')::uuid;
          if v_conv is null
             or not public.is_conversation_participant(v_conv)
             or not exists (
               select 1 from public.conversations c
               where c.id = v_conv and c.conversation_type in ('direct', 'group')
             ) then
            v_reason := 'conversation_unavailable';
          end if;

        elsif v_kind = 'profile' then
          v_target := (v_dest ->> 'profile_id')::uuid;

        else
          v_reason := 'invalid_destination';
        end if;

        if v_reason is null and v_kind = 'profile' then
          if v_target is null
             or not exists (select 1 from public.profiles p where p.id = v_target) then
            v_reason := 'recipient_unavailable';
          elsif v_target = v_uid then
            v_reason := 'invalid_recipient';
          elsif public.footme_profiles_blocked(v_uid, v_target) then
            /* Chi ha bloccato me resta selezionabile (D3): fallisce qui, con lo
               stesso codice di un destinatario non disponibile (nessuna
               differenza nel JSON che riveli il blocco subito). */
            v_reason := 'recipient_unavailable';
          else
            /* Get-or-create della DIRECT canonica (§51–§55, §125). */
            v_conv := public.open_direct_conversation(v_target);
          end if;
        end if;

        if v_reason is null then
          if not public.conversation_can_send(v_conv) then
            v_reason := 'conversation_closed';
          elsif public.is_direct_conversation_blocked(v_conv) then
            v_reason := 'recipient_unavailable';
          end if;
        end if;

        if v_reason is null then
          perform set_config('content_share.command', v_conv::text, true);

          insert into public.messages
            (conversation_id, sender_profile_id, body, message_kind,
             content_ref_type, content_ref_id, content_snapshot,
             share_batch_id, share_delivery_key)
          values
            (v_conv, v_uid, v_text, 'content_reference',
             p_content_type, p_content_id, v_snapshot,
             p_batch_id, v_key)
          returning id into v_msg;

          perform set_config('content_share.command', '', true);
          v_ok := true;
        end if;
      end if;
    exception
      when unique_violation then
        /* Un retry concorrente ha già consegnato la stessa chiave. */
        perform set_config('content_share.command', '', true);
        select m.id, m.conversation_id
        into v_msg, v_conv
        from public.messages m
        where m.sender_profile_id = v_uid
          and m.share_delivery_key = v_key;

        if found then
          v_ok := true;
          v_reason := null;
        else
          v_ok := false;
          v_msg := null;
          v_reason := 'transient';
          v_retry := true;
        end if;
      when others then
        perform set_config('content_share.command', '', true);
        v_ok := false;
        v_msg := null;

        if sqlstate in ('40001', '40P01', '55P03', '57014', '53300') then
          v_reason := 'transient';
          v_retry := true;
        elsif sqlerrm like 'SOCIETY_GROUP_%' then
          v_reason := 'conversation_closed';
          v_retry := false;
        elsif sqlstate like '22%' or sqlstate like '23%' or sqlstate like '42%' then
          v_reason := 'invalid_destination';
          v_retry := false;
        else
          v_reason := 'transient';
          v_retry := true;
        end if;
    end;

    if v_ok then
      v_n_ok := v_n_ok + 1;
      v_retry := false;
    else
      v_n_fail := v_n_fail + 1;
      /* Le ragioni di dominio non cambiano al secondo tentativo (§216). */
      v_retry := coalesce(v_retry, false) and v_reason = 'transient';
    end if;

    v_outcomes := v_outcomes || jsonb_build_array(
      jsonb_build_object(
        'delivery_key', v_key,
        'ok', v_ok,
        'retryable', v_retry,
        'conversation_id', v_conv,
        'message_id', v_msg)
      || case when v_reason is not null then jsonb_build_object('reason', v_reason) else '{}'::jsonb end);
  end loop;

  /* Una azione per batch (§143, §199–§200): le consegne riuscite si ricontano
     sui messaggi del batch, le destinazioni distinte sono quelle con un
     messaggio più quelle fallite in questa chiamata. Il retry delle sole
     fallite non crea una seconda azione e non la «ricompleta». */
  select count(*)::integer
  into v_ok_total
  from public.messages m
  where m.share_batch_id = p_batch_id
    and m.sender_profile_id = v_uid;

  v_known := v_ok_total + v_n_fail;

  insert into public.content_share_actions
    (id, sharer_profile_id, content_type, content_id, action_kind,
     delivery_count, deliveries_ok, completed_at)
  values
    (p_batch_id, v_uid, p_content_type, p_content_id, 'internal',
     v_known, v_ok_total,
     case when v_ok_total > 0 then timezone('utc', now()) end)
  on conflict (id) do update
  set delivery_count = greatest(content_share_actions.delivery_count, excluded.delivery_count),
      deliveries_ok  = excluded.deliveries_ok,
      completed_at   = coalesce(content_share_actions.completed_at, excluded.completed_at);

  return jsonb_build_object(
    'status', case
                when v_n_fail = 0 then 'ok'
                when v_n_ok = 0   then 'failed'
                else 'partial'
              end,
    'outcomes', v_outcomes);
end;
$$;

revoke all on function public.send_content_share(uuid, text, uuid, text, jsonb) from public;
revoke execute on function public.send_content_share(uuid, text, uuid, text, jsonb) from anon;
grant execute on function public.send_content_share(uuid, text, uuid, text, jsonb) to authenticated;

comment on function public.send_content_share(uuid, text, uuid, text, jsonb) is
  'HOM-09 §125–§142: invio di un contenuto in una o più conversazioni. Esito per destinazione, '
  'idempotente su (mittente, delivery_key), una content_share_actions per batch.';


-- ============================================================
-- SEZIONE 6 — record_content_share_event: Copia link / share sheet esterno
-- ============================================================

create or replace function public.record_content_share_event(
  p_event_id      uuid,
  p_content_type  text,
  p_content_id    uuid,
  p_kind          text
)
returns jsonb
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

  if p_event_id is null or p_content_id is null then
    raise exception 'invalid_share_event' using errcode = '22023';
  end if;

  if p_kind is null or p_kind not in ('copy_link', 'external_sheet_open') then
    raise exception 'invalid_share_event_kind' using errcode = '22023';
  end if;

  if p_content_type is null
     or p_content_type not in ('profile_post', 'club_media', 'media_profile', 'fan_media') then
    raise exception 'invalid_content_type' using errcode = '22023';
  end if;

  if not public.footme_content_readable(v_uid, p_content_type, p_content_id) then
    return jsonb_build_object('status', 'content_unavailable');
  end if;

  /* Idempotente su p_event_id (retry sicuro) E deduplicato per giorno civile
     Europe/Rome: una seconda chiamata dello stesso utente sullo stesso
     contenuto e tipo nello stesso giorno non crea una riga (indice unico
     content_share_actions_event_day_key; `on conflict do nothing` copre sia
     l'id sia la chiave giornaliera, anche in concorrenza). Solo Copia link
     «completa» (§201); l'apertura dello share sheet non è mai una condivisione
     completata (§202–§203). Un id già usato da altri non rivela nulla. */
  insert into public.content_share_actions
    (id, sharer_profile_id, content_type, content_id, action_kind,
     delivery_count, deliveries_ok, completed_at, event_day)
  values
    (p_event_id, v_uid, p_content_type, p_content_id, p_kind, 0, 0,
     case when p_kind = 'copy_link' then timezone('utc', now()) end,
     (timezone('Europe/Rome', now()))::date)
  on conflict do nothing;

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.record_content_share_event(uuid, text, uuid, text) from public;
revoke execute on function public.record_content_share_event(uuid, text, uuid, text) from anon;
grant execute on function public.record_content_share_event(uuid, text, uuid, text) to authenticated;

comment on function public.record_content_share_event(uuid, text, uuid, text) is
  'HOM-09 §201–§203: evento Copia link (conta come Condivisione) o apertura share sheet esterno (non conta).';


-- ============================================================
-- SEZIONE 7 — search_share_recipients: la lista unica «Invia a»
--
-- Ritorno: { "items": [...], "next_cursor": text|null }. Ordine stabile
-- (tier, punteggio desc, nome, chiave): conversazioni prima (DIRECT e GROUP),
-- poi persone, Media e Società. Con query vuota solo le conversazioni
-- scrivibili, per ultimo messaggio (§24, §77). Con query: almeno 2 caratteri
-- per persone/Media/Società (le conversazioni da 1). Cursore keyset opaco
-- (esadecimale di [tier, punteggio, nome, chiave]).
-- SECURITY INVOKER (legge `clubs`); `fetch_inbox_conversations` è definer di suo.
-- ============================================================

create or replace function public.search_share_recipients(
  p_query   text default null,
  p_cursor  text default null,
  p_limit   integer default 20
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_term    text := btrim(coalesce(p_query, ''));
  v_like    text;
  v_prefix  text;
  v_limit   integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_cur     jsonb;
  c_tier    integer;
  c_sort    numeric;
  c_name    text;
  c_key     text;
  v_items   jsonb;
  v_rows    integer;
  v_lastcur jsonb;
  v_next    text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_like := '%' || replace(replace(replace(lower(v_term), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_prefix := replace(replace(replace(lower(v_term), '\', '\\'), '%', '\%'), '_', '\_') || '%';

  if p_cursor is not null then
    begin
      v_cur := convert_from(decode(p_cursor, 'hex'), 'UTF8')::jsonb;
      c_tier := (v_cur ->> 0)::integer;
      c_sort := (v_cur ->> 1)::numeric;
      c_name := v_cur ->> 2;
      c_key  := v_cur ->> 3;
    exception when others then
      raise exception 'invalid_cursor' using errcode = '22023';
    end;
    if c_tier is null or c_sort is null or c_name is null or c_key is null then
      raise exception 'invalid_cursor' using errcode = '22023';
    end if;
  end if;

  with
  convs as (
    select i.*
    from public.fetch_inbox_conversations(1000, 0, true) i
    where i.conversation_type in ('direct', 'group')
      and (v_term <> '' or not i.archived)
      and (
        (i.conversation_type = 'direct' and i.other_profile_id is not null)
        or (i.conversation_type = 'group' and coalesce(i.group_status, 'active') = 'active')
      )
  ),
  conv_rows as (
    select
      'conv:' || c.conversation_id::text                          as recipient_key,
      case when c.conversation_type = 'group' then 'group' else 'direct' end as kind,
      c.conversation_id                                           as conversation_id,
      c.other_profile_id                                          as profile_id,
      null::uuid                                                  as club_id,
      case when p.role::text = 'media'
           then coalesce(nullif(btrim(mp.entity_name), ''), c.display_title)
           else c.display_title end                               as display_name,
      case when p.role::text = 'media'
           then coalesce(mp.logo_url, c.avatar_url)
           else c.avatar_url end                                  as avatar_url,
      c.group_avatar_path                                         as group_avatar_path,
      coalesce(mp.verification_status = 'verified', false)        as is_verified,
      p.role::text                                                as role,
      case when c.conversation_type = 'group' then c.participant_count end as participant_count,
      case when c.conversation_type = 'group' then true
           else not c.blocked_by_me end                           as available,
      c.last_message_sent_at                                      as last_at
    from convs c
    left join public.profiles p on p.id = c.other_profile_id and c.conversation_type = 'direct'
    left join public.media_profiles mp on mp.profile_id = p.id and p.role::text = 'media'
  ),
  person_rows as (
    select
      'profile:' || p.id::text                                    as recipient_key,
      'person'::text                                              as kind,
      null::uuid                                                  as conversation_id,
      p.id                                                        as profile_id,
      null::uuid                                                  as club_id,
      p.full_name                                                 as display_name,
      p.avatar_url                                                as avatar_url,
      null::text                                                  as group_avatar_path,
      false                                                       as is_verified,
      p.role::text                                                as role,
      null::integer                                               as participant_count,
      not exists (select 1 from public.user_blocks b
                  where b.blocker_profile_id = v_uid and b.blocked_profile_id = p.id) as available,
      null::timestamptz                                           as last_at
    from public.profiles p
    where char_length(v_term) >= 2
      and p.id <> v_uid
      and p.role::text not in ('club_admin', 'media')
      and lower(p.full_name) like v_like
      and not exists (select 1 from conv_rows cr where cr.kind = 'direct' and cr.profile_id = p.id)
  ),
  media_rows as (
    select
      'profile:' || p.id::text                                    as recipient_key,
      'media'::text                                               as kind,
      null::uuid                                                  as conversation_id,
      p.id                                                        as profile_id,
      null::uuid                                                  as club_id,
      coalesce(nullif(btrim(mp.entity_name), ''), p.full_name)    as display_name,
      coalesce(mp.logo_url, p.avatar_url)                         as avatar_url,
      null::text                                                  as group_avatar_path,
      coalesce(mp.verification_status = 'verified', false)        as is_verified,
      p.role::text                                                as role,
      null::integer                                               as participant_count,
      not exists (select 1 from public.user_blocks b
                  where b.blocker_profile_id = v_uid and b.blocked_profile_id = p.id) as available,
      null::timestamptz                                           as last_at
    from public.media_profiles mp
    join public.profiles p on p.id = mp.profile_id
    where char_length(v_term) >= 2
      and p.id <> v_uid
      and (lower(coalesce(mp.entity_name, '')) like v_like or lower(p.full_name) like v_like)
      and not exists (select 1 from conv_rows cr where cr.kind = 'direct' and cr.profile_id = p.id)
  ),
  club_rows as (
    select
      'club:' || c.id::text                                       as recipient_key,
      'club'::text                                                as kind,
      null::uuid                                                  as conversation_id,
      c.owner_profile_id                                          as profile_id,
      c.id                                                        as club_id,
      c.name                                                      as display_name,
      c.logo_url                                                  as avatar_url,
      null::text                                                  as group_avatar_path,
      (c.verification_status = 'verified')                        as is_verified,
      null::text                                                  as role,
      null::integer                                               as participant_count,
      (c.owner_profile_id <> v_uid
        and not exists (select 1 from public.user_blocks b
                        where b.blocker_profile_id = v_uid and b.blocked_profile_id = c.owner_profile_id)) as available,
      null::timestamptz                                           as last_at
    from public.clubs c
    where char_length(v_term) >= 2
      and lower(c.name) like v_like
  ),
  unioned as (
    select 0 as tier, cr.* from conv_rows cr
    where v_term = '' or lower(cr.display_name) like v_like
    union all
    select 1, pr.* from person_rows pr
    union all
    select 1, mr.* from media_rows mr
    union all
    select 1, kr.* from club_rows kr
  ),
  scored as (
    select u.*,
           (lower(u.display_name) collate "C") as lname,
           case
             when v_term = '' then round(coalesce(extract(epoch from u.last_at), 0)::numeric, 3)
             else round(similarity(lower(u.display_name), lower(v_term))::numeric, 4)
                  + case when lower(u.display_name) like v_prefix then 1 else 0 end
           end as sort_num
    from unioned u
  ),
  paged as (
    select s.*, (s.recipient_key collate "C") as rkey
    from scored s
    where p_cursor is null
       or s.tier > c_tier
       or (s.tier = c_tier and (
            s.sort_num < c_sort
            or (s.sort_num = c_sort and (
                 s.lname > (c_name collate "C")
                 or (s.lname = (c_name collate "C") and (s.recipient_key collate "C") > (c_key collate "C"))))))
    order by s.tier, s.sort_num desc, s.lname, (s.recipient_key collate "C")
    limit v_limit + 1
  ),
  numbered as (
    select
      row_number() over (order by pg.tier, pg.sort_num desc, pg.lname, pg.rkey) as rn,
      pg.tier, pg.sort_num, pg.lname, pg.recipient_key,
      jsonb_build_object(
        'recipient_key', pg.recipient_key,
        'kind', pg.kind,
        'conversation_id', pg.conversation_id,
        'profile_id', pg.profile_id,
        'club_id', pg.club_id,
        'display_name', pg.display_name,
        'avatar_url', pg.avatar_url,
        'group_avatar_path', pg.group_avatar_path,
        'is_verified', pg.is_verified,
        'role', pg.role,
        'context_label', case
                           when pg.kind = 'media' or pg.role = 'media' then 'Media'
                           when pg.kind = 'club' then (select c.category from public.clubs c where c.id = pg.club_id)
                           when pg.kind in ('direct', 'person') then (
                             select cl.name
                             from public.club_members cm
                             join public.clubs cl on cl.id = cm.club_id
                             where cm.profile_id = pg.profile_id
                               and cm.status = 'active'
                               and cm.is_current = true
                             order by cm.created_at desc
                             limit 1)
                         end,
        'participant_count', pg.participant_count,
        'available', pg.available) as item
    from paged pg
  )
  select
    coalesce(jsonb_agg(n.item order by n.rn) filter (where n.rn <= v_limit), '[]'::jsonb),
    count(*)::integer,
    (select jsonb_build_array(l.tier, l.sort_num, l.lname, l.recipient_key)
       from numbered l where l.rn = v_limit)
  into v_items, v_rows, v_lastcur
  from numbered n;

  if v_rows > v_limit then
    v_next := encode(convert_to(v_lastcur::text, 'UTF8'), 'hex');
  end if;

  return jsonb_build_object('items', v_items, 'next_cursor', v_next);
end;
$$;

revoke all on function public.search_share_recipients(text, text, integer) from public;
revoke execute on function public.search_share_recipients(text, text, integer) from anon;
grant execute on function public.search_share_recipients(text, text, integer) to authenticated;

comment on function public.search_share_recipients(text, text, integer) is
  'HOM-09 §43–§76: lista unica destinatari (DIRECT, GROUP, persone, Media, Società), dedup persona/DIRECT, cursore.';


-- ============================================================
-- SEZIONE 8 — get_conversation_messages: riferimento al contenuto
-- ============================================================

/**
 * Riemessa da 20261113090000 (ultima definizione). Cambia SOLO: quattro colonne
 * in coda (signature di ritorno cambiata: drop + create).
 *   · content_ref_type, content_ref_id: sempre per un content_reference (la card
 *     apre il contenuto canonico per id, §103);
 *   · content_available: rivalidato PER IL LETTORE ADESSO (§122);
 *   · content_snapshot: null se il contenuto non è leggibile dal lettore
 *     (§114–§118): lo snapshot non è fonte di verità.
 * Resta SECURITY INVOKER: la RLS dei messaggi si applica comunque.
 */
drop function if exists public.get_conversation_messages(uuid);

create or replace function public.get_conversation_messages(target_conversation_id uuid)
returns table (
  message_id uuid,
  body text,
  sent_at timestamptz,
  read_at timestamptz,
  sender_profile_id uuid,
  sender_full_name text,
  message_kind text,
  shared_contact_name text,
  shared_contact_phone text,
  media_url text,
  system_event_type text,
  system_payload jsonb,
  seq bigint,
  content_ref_type text,
  content_ref_id uuid,
  content_snapshot jsonb,
  content_available boolean
)
language sql
stable
as $$
  select
    message.id as message_id,
    message.body,
    message.sent_at,
    message.read_at,
    message.sender_profile_id,
    sender_profile.full_name as sender_full_name,
    message.message_kind,
    message.shared_contact_name,
    message.shared_contact_phone,
    message.media_url,
    message.system_event_type,
    message.system_payload,
    message.seq,
    message.content_ref_type,
    message.content_ref_id,
    case when coalesce(availability.is_available, false) then message.content_snapshot end as content_snapshot,
    case when message.message_kind = 'content_reference'
         then coalesce(availability.is_available, false) end as content_available
  from public.messages message
  left join public.profiles sender_profile on sender_profile.id = message.sender_profile_id
  left join lateral (
    select public.content_share_message_available(message.id) as is_available
    where message.message_kind = 'content_reference'
  ) availability on true
  where message.conversation_id = target_conversation_id
    and message.seq >= (select public.conversation_access_from_seq(target_conversation_id))
  order by message.seq asc;
$$;

revoke all on function public.get_conversation_messages(uuid) from public, anon;
grant execute on function public.get_conversation_messages(uuid) to authenticated;


-- ============================================================
-- SEZIONE 9 — fetch_content_insights: la riga Condivisioni (D4)
--
-- Riemessa da 20261119090000 (ultima definizione, verificata per differenza):
-- cambiano SOLO la dichiarazione di `v_shares`, il suo calcolo e la riga
-- `'shares'` del payload (era null). Condizione di visibilità identica alle
-- altre metriche: passa dallo stesso `footme_content_insights_gate`.
-- Conteggio = azioni interne con almeno una consegna riuscita + Copia link
-- riusciti; mai l'apertura dello share sheet. null per i tipi senza
-- «Condividi» (fan_tribuna, media_tribuna).
-- ============================================================

create or replace function public.fetch_content_insights(
  p_content_type text,
  p_post_id      uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_now       timestamptz := timezone('utc', now());
  v_gate      text;
  v_f         record;
  v_track     timestamptz;
  v_start     timestamptz;

  v_has_video   boolean;
  v_n_images    integer;
  v_video_dur   integer;
  v_has_links   boolean;
  v_item_type   text;
  v_kind        text;
  v_format      text;
  v_identity    text;
  v_excerpt     text;

  v_views       bigint;
  v_reach       bigint;

  v_kinds       text[];
  v_likes       bigint;
  v_comments    bigint;
  v_saves       bigint;
  v_shares      bigint;
  v_interact    bigint;

  v_has_targets boolean;
  v_has_society boolean;
  v_ev_author   bigint;
  v_ev_society  bigint;
  v_ev_tagged   bigint;
  v_ev_linked   bigint;
  v_vw_author   bigint;
  v_vw_society  bigint;
  v_followers   bigint;
  v_follow_win  interval;

  v_profile_visits bigint;
  v_society_visits bigint;
  v_tagged_opens   bigint;
  v_linked_opens   bigint;
  v_actions        bigint;
  v_min_reach      numeric;
  v_insight        jsonb;
  v_prof           jsonb;

  v_sources     jsonb;

  v_plays       bigint;
  v_watch_sum   numeric;
  v_completions bigint;
  v_threshold   numeric;
  v_video       jsonb;

  v_opens       bigint;
  v_reads       bigint;
  v_read_avg    numeric;
  v_clicks      bigint;
  v_min_reads   numeric;
  v_min_read_secs numeric;
  v_article     jsonb;

  v_age         interval;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_gate := public.footme_content_insights_gate(p_content_type, p_post_id);
  if v_gate <> 'ok' then
    return jsonb_build_object('status', v_gate);
  end if;

  select * into v_f
  from public.feed_content_index fci
  where fci.content_type = p_content_type and fci.post_id = p_post_id;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  v_track := public.footme_insights_tracking_start();
  v_start := greatest(v_f.published_at, v_track);
  v_age   := v_now - v_start;

  -- ── Preview e classificazione ─────────────────────────────────
  select
    coalesce(bool_or(m.media_type = 'video'), false),
    count(*) filter (where m.media_type = 'image'),
    (array_agg(m.duration_seconds order by m.position)
       filter (where m.media_type = 'video'))[1]
  into v_has_video, v_n_images, v_video_dur
  from public.content_post_media m
  where m.content_type = p_content_type and m.post_id = p_post_id;

  v_has_video := v_has_video or coalesce(v_f.media_type = 'video', false);
  v_video_dur := coalesce(v_video_dur, v_f.duration_seconds);

  v_item_type := public.footme_feed_item_type(p_content_type, v_f.content_format);
  v_kind := case
    when v_has_video            then 'video'
    when v_item_type = 'article' then 'article'
    else 'post'
  end;

  v_format := case
    when v_has_video and p_content_type = 'media_profile' then 'editorial_video'
    when v_has_video                                      then 'video'
    when v_item_type = 'article'                          then 'article'
    when v_n_images >= 2                                  then 'gallery'
    when v_n_images = 1 or v_f.thumbnail_url is not null  then 'photo'
    else 'text'
  end;

  v_identity := case
    when v_f.publisher_type = 'club'                              then 'society'
    when p_content_type in ('media_profile', 'media_tribuna')      then 'media'
    else 'person'
  end;

  -- Mai il corpo intero (§173): testo breve, spazi collassati, max 140.
  v_excerpt := nullif(left(regexp_replace(
    btrim(coalesce(nullif(btrim(v_f.excerpt), ''), nullif(btrim(v_f.body), ''), '')),
    '\s+', ' ', 'g'), 140), '');

  -- ── Panoramica: Visualizzazioni e Profili raggiunti (§28–§35) ──
  select count(*), count(distinct d.e_viewer)
  into v_views, v_reach
  from public.footme_content_deduped_events(p_content_type, p_post_id, v_start, array['impression']) d;

  -- ── Interazioni (§36–§44) ─────────────────────────────────────
  v_kinds := public.footme_content_interaction_kinds(p_content_type);

  select
    count(*) filter (where r.i_kind = 'like'),
    count(*) filter (where r.i_kind = 'comment'),
    count(*) filter (where r.i_kind = 'save')
  into v_likes, v_comments, v_saves
  from public.footme_content_interaction_rows(p_content_type, p_post_id) r;

  v_interact := case
    when cardinality(v_kinds) = 0 then null
    else (case when 'like'    = any (v_kinds) then v_likes    else 0 end)
       + (case when 'comment' = any (v_kinds) then v_comments else 0 end)
       + (case when 'save'    = any (v_kinds) then v_saves    else 0 end)
  end;

  -- ── Condivisioni (HOM-09 §193–§208, D4) ───────────────────────
  -- Azioni interne con almeno una consegna riuscita (una per batch) + Copia
  -- link riusciti; mai l'apertura dello share sheet. null = tipo senza
  -- «Condividi» (riga nascosta, §40). Fuori da `interactions`: vedi header.
  v_shares := case
    when p_content_type in ('profile_post', 'club_media', 'media_profile', 'fan_media') then (
      select count(*)
      from public.content_share_actions sa
      where sa.content_type = p_content_type
        and sa.content_id = p_post_id
        and sa.completed_at is not null
        and sa.action_kind in ('internal', 'copy_link'))
  end;

  -- ── Azioni generate (§45–§58) ─────────────────────────────────
  select t.t_has_targets, t.t_has_society
  into v_has_targets, v_has_society
  from public.footme_content_target_flags(p_content_type, p_post_id) t;

  select
    count(*) filter (where d.e_type = 'author_profile_open'),
    count(*) filter (where d.e_type = 'society_open'),
    count(*) filter (where d.e_type = 'tagged_open'),
    count(*) filter (where d.e_type = 'linked_content_open'),
    count(distinct d.e_viewer) filter (where d.e_type = 'author_profile_open'),
    count(distinct d.e_viewer) filter (where d.e_type in ('author_profile_open', 'society_open'))
  into v_ev_author, v_ev_society, v_ev_tagged, v_ev_linked, v_vw_author, v_vw_society
  from public.footme_content_deduped_events(
    p_content_type, p_post_id, v_start,
    array['author_profile_open', 'society_open', 'tagged_open', 'linked_content_open']) d;

  -- Follow attribuiti (§52–§53): follow corrente verso il publisher, creato
  -- entro la finestra dopo una impression; se il viewer ha visto più contenuti
  -- dello stesso publisher conta solo il più recente prima del follow.
  v_follow_win := make_interval(
    hours => greatest(public.footme_insights_setting('attribution_window_hours', 24)::int, 0));

  select count(*)
  into v_followers
  from (
    select pf.follower_profile_id as viewer_id, pf.created_at as followed_at
    from public.profile_follows pf
    where v_f.publisher_type = 'profile' and pf.followed_profile_id = v_f.publisher_id
      -- Un follow precedente all'inizio dei dati non può avere un'impression
      -- prima di sé: escluderlo qui evita una sonda per ogni follower storico.
      and pf.created_at >= v_start
    union all
    select cf.profile_id, cf.created_at
    from public.club_follows cf
    where v_f.publisher_type = 'club' and cf.club_id = v_f.publisher_id
      and cf.created_at >= v_start
  ) f
  cross join lateral (
    select ce.content_type, ce.post_id
    from public.content_events ce
    where ce.event_type = 'impression'
      and ce.publisher_type = v_f.publisher_type
      and ce.publisher_id = v_f.publisher_id
      and ce.viewer_profile_id = f.viewer_id
      and ce.occurred_at <= f.followed_at
      and f.followed_at - ce.occurred_at <= v_follow_win
    order by ce.occurred_at desc, ce.id desc
    limit 1
  ) last_imp
  where last_imp.content_type = p_content_type and last_imp.post_id = p_post_id;

  -- Applicabilità (§48–§49): null = riga da nascondere.
  if v_f.publisher_type = 'club' then
    v_profile_visits := null;
    v_society_visits := v_ev_author + v_ev_society;
  else
    v_profile_visits := v_ev_author;
    v_society_visits := case when v_has_society then v_ev_society end;
  end if;
  v_tagged_opens := case when v_has_targets then v_ev_tagged end;
  v_linked_opens := null;  -- nessun collegamento tra contenuti esiste ancora

  v_actions := coalesce(v_profile_visits, 0) + coalesce(v_society_visits, 0)
             + coalesce(v_tagged_opens, 0) + coalesce(v_linked_opens, 0)
             + v_followers;

  -- Insight sintetico (§58): solo con dati sufficienti e numeratore reale.
  v_min_reach := public.footme_insights_setting('min_reach_for_insight', 50);
  v_insight := null;
  if v_reach >= v_min_reach and v_reach > 0 then
    if v_f.publisher_type = 'profile' and v_vw_author > 0 then
      v_insight := jsonb_build_object(
        'kind', 'profile_visit_rate',
        'percent', least(100, round(v_vw_author * 100.0 / v_reach, 1)));
    elsif v_society_visits is not null and v_vw_society > 0 then
      v_insight := jsonb_build_object(
        'kind', 'society_visit_rate',
        'percent', least(100, round(v_vw_society * 100.0 / v_reach, 1)));
    end if;
  end if;

  if v_profile_visits is null and v_society_visits is null and v_tagged_opens is null
     and v_linked_opens is null and v_followers is null then
    v_prof := null;
  else
    v_prof := jsonb_build_object(
      'profile_visits',       v_profile_visits,
      'society_visits',       v_society_visits,
      'new_followers',        v_followers,
      'tagged_opens',         v_tagged_opens,
      'linked_content_opens', v_linked_opens,
      'insight',              v_insight);
  end if;

  -- ── Origine delle visualizzazioni (§76–§84) ───────────────────
  -- Percentuali intere con somma 100 (largest remainder); sorgenti sotto
  -- soglia accorpate in OTHER; ordine decrescente, OTHER ultima.
  with imp as (
    select d.e_source as src, count(*)::numeric as n
    from public.footme_content_deduped_events(
      p_content_type, p_post_id, v_start, array['impression']) d
    group by d.e_source
  ),
  tot as (select sum(n) as t from imp),
  merged as (
    select case when i.n * 100.0 / tot.t < public.footme_insights_setting('source_other_threshold_percent', 2)
                then 'OTHER' else i.src end as src,
           sum(i.n) as n
    from imp i cross join tot
    group by 1
  ),
  raw as (
    select m.src, m.n,
           m.n * 100.0 / tot.t as pct,
           floor(m.n * 100.0 / tot.t) as fl
    from merged m cross join tot
  ),
  ranked as (
    select r.*,
           row_number() over (order by (r.pct - r.fl) desc, r.n desc, r.src) as rn,
           100 - sum(r.fl) over () as leftover
    from raw r
  ),
  final as (
    select k.src, (k.fl + case when k.rn <= k.leftover then 1 else 0 end)::int as p
    from ranked k
  )
  select coalesce(
           jsonb_agg(jsonb_build_object('source', f.src, 'percent', f.p)
                     order by (f.src = 'OTHER'), f.p desc, f.src),
           '[]'::jsonb)
  into v_sources
  from final f;

  -- ── Prestazioni video (§90–§100) ──────────────────────────────
  v_video := null;
  if v_kind = 'video' then
    v_threshold := public.footme_insights_setting('video_completion_percent', 90);

    -- §94: una riproduzione per viewer, sessione app e video. Un client che
    -- ripete `video_play` con event_id nuovi non gonfia il denominatore del
    -- completamento né del tempo medio.
    select
      count(distinct (ce.viewer_profile_id, coalesce(ce.session_id, ''), coalesce(ce.media_ref, '')))
        filter (where ce.event_type = 'video_play'),
      coalesce(sum(ce.num_value) filter (where ce.event_type = 'video_watch'), 0)
    into v_plays, v_watch_sum
    from public.content_events ce
    where ce.content_type = p_content_type and ce.post_id = p_post_id
      and ce.occurred_at >= v_start
      and ce.event_type in ('video_play', 'video_watch');

    select count(*)
    into v_completions
    from (
      select distinct ce.viewer_profile_id, coalesce(ce.session_id, ''), coalesce(ce.media_ref, '')
      from public.content_events ce
      where ce.content_type = p_content_type and ce.post_id = p_post_id
        and ce.occurred_at >= v_start
        and ce.event_type = 'video_progress'
        and ce.num_value >= v_threshold
    ) c;

    v_video := jsonb_build_object(
      'plays', v_plays,
      'avg_watch_seconds', case when v_plays > 0 then round(v_watch_sum / v_plays)::int end,
      'completion_percent', case when v_plays > 0
                                 then least(100, round(v_completions * 100.0 / v_plays))::int end);
  end if;

  -- ── Prestazioni articolo (§101–§113) ──────────────────────────
  v_article := null;
  if v_kind = 'article' then
    v_min_reads := public.footme_insights_setting('min_reads_for_read_time', 5);


    select count(*) into v_opens
    from public.footme_content_deduped_events(
      p_content_type, p_post_id, v_start, array['article_open']) d;

    -- §107: una lettura sotto `min_read_seconds` è un rimbalzo, non lettura
    -- attiva; resterebbe nella media e la abbasserebbe.
    v_min_read_secs := public.footme_insights_setting('min_read_seconds', 3);

    select
      count(*) filter (where ce.event_type = 'article_read' and ce.num_value >= v_min_read_secs),
      avg(ce.num_value) filter (where ce.event_type = 'article_read' and ce.num_value >= v_min_read_secs),
      count(*) filter (where ce.event_type = 'article_link_click')
    into v_reads, v_read_avg, v_clicks
    from public.content_events ce
    where ce.content_type = p_content_type and ce.post_id = p_post_id
      and ce.occurred_at >= v_start
      and ce.event_type in ('article_read', 'article_link_click');

    -- «L'articolo contiene link» (§109–§110): anteprima link o URL nel testo.
    v_has_links := exists (
        select 1 from public.content_post_extras ex
        where ex.content_type = p_content_type and ex.post_id = p_post_id
          and ex.link_preview is not null)
      or coalesce(v_f.body, '') ~* 'https?://';

    v_article := jsonb_build_object(
      'opens', v_opens,
      'open_rate_percent', case when v_views > 0
                                then least(100, round(v_opens * 100.0 / v_views, 1)) end,
      'avg_read_seconds', case when v_reads >= v_min_reads then round(v_read_avg)::int end,
      'link_clicks', case when v_has_links then v_clicks end);
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'updated_at', to_jsonb(v_now),
    'tracking_started_at', to_jsonb(v_track),
    'insights_kind', v_kind,
    'has_data', v_views > 0,
    'content_preview', jsonb_build_object(
      'content_type', p_content_type,
      'post_id', p_post_id,
      'item_type', v_item_type,
      'format', v_format,
      'title', nullif(btrim(v_f.title), ''),
      'excerpt', v_excerpt,
      'thumbnail_url', v_f.thumbnail_url,
      'duration_seconds', case when v_has_video then v_video_dur end,
      'published_at', to_jsonb(v_f.published_at),
      'author', jsonb_build_object(
        'identity_type', v_identity,
        'id', v_f.publisher_id,
        'name', v_f.publisher_name,
        'avatar_url', v_f.publisher_avatar_url,
        'is_verified', coalesce(v_f.publisher_is_verified, false))),
    'overview', jsonb_build_object(
      'views', v_views,
      'reach', v_reach,
      'interactions', v_interact,
      'generated_actions', v_actions),
    'engagement', jsonb_build_object(
      'likes',    case when 'like'    = any (v_kinds) then v_likes end,
      'comments', case when 'comment' = any (v_kinds) then v_comments end,
      'shares',   v_shares,
      'reposts',  null,
      'saves',    case when 'save'    = any (v_kinds) then v_saves end),
    'professional_actions', v_prof,
    'traffic_sources', v_sources,
    'video_insights', v_video,
    'article_insights', v_article,
    'periods', jsonb_build_array(
      jsonb_build_object('period', '24h',               'available', true),
      jsonb_build_object('period', '7d',                'available', v_age >= interval '7 days'),
      jsonb_build_object('period', '30d',               'available', v_age >= interval '30 days'),
      jsonb_build_object('period', 'since_publication', 'available', true)),
    'default_period', 'since_publication');
end;
$$;

revoke all on function public.fetch_content_insights(text, uuid) from public;
revoke execute on function public.fetch_content_insights(text, uuid) from anon;
grant execute on function public.fetch_content_insights(text, uuid) to authenticated;

comment on function public.fetch_content_insights(text, uuid) is
  'HOM-05 §152: statistiche aggregate di un contenuto. {status: ok|unavailable, ...}; 42501 content_permission_denied se il contenuto è leggibile ma la capability manca. null = non disponibile, 0 = zero reale. HOM-09: engagement.shares = batch interni completati + Copia link (null per fan_tribuna e media_tribuna).';
