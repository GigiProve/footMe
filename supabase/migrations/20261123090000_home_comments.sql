-- ============================================================
-- HOM-08 — Commenti e Risposte: dati
--
-- COSA MANCAVA
--
-- Il task HOM-08 (§1–§320) chiede un sistema di commenti unico per tutti i
-- contenuti della Home, con risposte a un livello, Mi piace ai commenti,
-- modifica ed eliminazione. Oggi mancano sei cose:
--
--   1. UN SOLO DOMINIO COMMENTI. I commenti stavano in cinque tabelle quasi
--      identiche (club_media_comments, media_profile_post_comments,
--      media_tribuna_comments, fan_tribuna_comments, fan_media_comments), una
--      per tipo di contenuto, piatte (nessuna risposta, nessuno stato, nessuna
--      versione, nessuna mention), di proprietà del PROFILO, scritte e lette
--      DIRETTAMENTE dal client con la sola RLS a proteggerle. Il Post persona
--      (profile_post) non aveva commenti. §1 e §3 («non creare sistemi
--      paralleli») e §10–§12 (il commento appartiene a un'identità) non sono
--      esprimibili così.
--   2. RISPOSTE E THREAD (§46–§51, §121–§136). Nessun legame padre/figlio, nessun
--      ordinamento «Più rilevanti» (§121–§124) né paginazione senza duplicati
--      (§222), nessun placeholder per un commento eliminato che ha risposte
--      (§160–§170) né per un commento il cui autore il viewer non vede (§195).
--   3. LA REGOLA DI VISIBILITÀ E DI CONTEGGIO. comments_count contava TUTTE le
--      righe, senza stato e senza blocchi. §89–§91 chiedono root attivi +
--      risposte attive, mai i tombstone, uguale per Feed, dettaglio, Insights e
--      contesto, con una lista che non diverge dal numero.
--   4. L'AUTORIZZAZIONE (§42–§44, §146–§152). Nessuna RPC dice con quale
--      identità si può commentare né rivalida il permesso al momento del
--      submit. La scrittura diretta sulla tabella non controllava blocchi,
--      programmazione, contenuto eliminato oltre allo stato, né l'identità.
--   5. IDEMPOTENZA E CONCORRENZA (§92–§101, §153–§159, §223). Nessuna chiave di
--      operazione per pubblicare, nessun controllo di versione per modificare.
--   6. GLI EVENTI DI DOMINIO (§200–§208). Nessun evento per commento, risposta,
--      mention o Mi piace a un commento: il layer Notifiche non ha cosa
--      consumare. HOM-08 non produce notifiche (§208): scrive l'outbox.
--
-- DECISIONI DI LUIGI (2026-11-14) CHE QUESTA MIGRAZIONE REALIZZA
--
--   1. Niente moderazione del titolare. Solo l'autore (identità) modifica o
--      elimina il proprio commento. Il titolare del contenuto PERDE il potere
--      che aveva con la vecchia RLS (la policy DELETE delle cinque tabelle
--      lasciava a lui di cancellare commenti altrui): la moderazione arriva
--      con HOM-11.
--   2. Il commento appartiene all'IDENTITÀ. Un commento scritto come Società,
--      Media o persona lo modifica ed elimina chiunque OGGI abbia quell'identità
--      tra le identità di interazione (footme_interaction_identities = identità
--      con cui si può pubblicare: Società con content_create o titolare). acted_by
--      è solo audit e non esce mai da una RPC.
--   3. Eliminazione = cancellazione vera. Testo, mention, link, autore e acted_by
--      sono azzerati; resta solo lo scheletro (un root eliminato che ha risposte
--      attive) che tiene insieme le risposte. I Mi piace del commento e i suoi
--      eventi di dominio non ancora consumati sono cancellati.
--   4. L'identità del composer parte dalla persona (client). Il Mi piace ai
--      commenti usa l'identità di interazione di HOM-07, come i Mi piace dei
--      contenuti.
--
-- PERCHÉ QUESTA SOLUZIONE
--
--   * content_comments è chiusa ai client (RLS attiva, nessuna policy, revoke
--     da anon e authenticated): si legge e si scrive solo dalle RPC (security
--     definer, auth.uid() controllato nel corpo, revoke da public e da anon).
--     I filtri e le autorizzazioni non si aggirano con una select.
--   * footme_comment_row_visible / footme_visible_comments sono l'UNICA
--     definizione di «commento visibile al viewer»: autore visibile
--     (footme_like_actor_visible, la regola dei Mi piace di HOM-07) e commenti
--     non nascosti dalle impostazioni. Conteggio del payload, stato interazioni,
--     contesto, lista, risposte, mutation e Insights leggono tutti da lì, come
--     footme_visible_likes per i Mi piace.
--   * footme_comment_cards costruisce la scheda del commento in UN punto: tutte
--     le RPC restituiscono la stessa forma (status active | deleted |
--     unavailable; capability del viewer calcolate adesso).
--   * I Mi piace dei commenti riusano content_likes (§77: un solo sistema) con
--     content_type 'comment': `post_id` contiene l'id del commento. La lettura
--     del commento passa dal ramo 'comment' di footme_content_readable.
--   * Le impostazioni dei commenti stanno in una tabella interna
--     (content_comment_settings, riga assente = abilitati) e non in una colonna
--     sulle sei tabelle contenuto: la RLS filtra le righe, non le colonne, e il
--     proprietario le scriverebbe con la sua policy di UPDATE. HOM-08 non ha
--     alcun comando che le scriva (§181).
--   * content_comment_events è un'outbox append-only senza grant: la scrive la
--     stessa transazione del comando e non decide categoria, preferenze, push
--     né self-notification (§204, §208).
--
-- RICOSTRUZIONI DA DEFINIZIONI EFFETTIVE (differenza dichiarata sopra ogni funzione)
--
--   footme_content_readable, footme_post_payloads, footme_content_interaction_rows,
--   media_content_engagement, set_content_like, list_content_likers
--   (20261122090000, HOM-07) e footme_content_interaction_kinds (20261119090000,
--   HOM-05) sono riprese da pg_get_functiondef dopo TUTTE le migrazioni, non da
--   una migrazione vecchia; la differenza con il testo di partenza è
--   esattamente quella dichiarata sopra ognuna (verificata con diff).
--   NON toccate: notifications_before_insert, fetch_profile_post_detail (resta
--   per compatibilità), fetch_content_interaction_state (legge il payload),
--   fetch_home_feed_page.
--
-- DEVIAZIONI DAL CONTRATTO DI COORDINAMENTO
--
--   * create_comment: in Postgres un parametro con default non può precedere uno
--     senza, quindi dopo p_reply_to_comment_id tutti i parametri hanno un
--     default (il client chiama con argomenti con nome). p_operation_key è
--     comunque obbligatorio (comment_invalid_operation_key) e p_identity_* nulli
--     danno comment_identity_forbidden.
--   * list_content_comments / list_comment_replies: `next_cursor` è valorizzato
--     SOLO sull'ultima riga della pagina e solo se esistono altre righe (come
--     list_content_likers); una pagina senza altre righe ha next_cursor null
--     dappertutto.
--   * content_comment_events ha una colonna in più, consumed_at, che imposta il
--     consumatore futuro: serve a sapere quali eventi sono «non ancora consumati»
--     (decisione 3). Gli eventi di un commento eliminato spariscono se non
--     consumati; ciò include i REPLY_CREATED che puntano al commento eliminato
--     (target_comment_id) e i COMMENT_LIKED.
--   * fetch_comment_counts(p_content_type, p_content_ids[]) è una RPC aggiunta dopo il
--     contratto (conteggi in blocco per le card dei profili): una riga per id
--     distinto, max 100 (comment_counts_too_many), contenuto non leggibile = 0.
--   * as_of (ora del server, now()) in fetch_comment_context (campo json) e come ultima
--     colonna OUT di list_content_comments, list_comment_replies e fetch_comment_updates:
--     è il watermark dei «Nuovi commenti», mai l'orologio del device.
--   * footme_visible_comments ha un quarto parametro opzionale p_root_ids (solo
--     le risposte di quei root): le chiamate a tre argomenti del contratto
--     funzionano.
--   * update_comment: testo, mention e link identici = nessuna modifica (niente
--     salto di versione né «Modificato»); la versione attesa è comunque
--     controllata. acted_by non cambia: è chi ha creato il commento e la sua
--     operation_key resta sua.
--   * Eliminare un commento (tombstone o rimozione) azzera anche reply_to_identity_*
--     di tutte le risposte che lo puntavano: nessuna scheda può più rivelare chi era
--     l'autore eliminato (decisione 3). Il testo delle risposte, mention incluse,
--     resta: è loro contenuto.
--   * create_comment: l'idempotenza passa dal registro content_comment_operations
--     (acted_by, chiave): la chiave di un commento poi eliminato risponde
--     comment_unavailable e non lo resuscita. update_comment: se testo, mention e
--     link richiesti coincidono già con lo stato corrente restituisce la scheda
--     corrente PRIMA del controllo di versione (ritentativo dopo timeout), e in
--     modifica rivalida contro l'identità solo le mention nuove.
--   * Un evento MENTION per identità menzionata (due range sulla stessa identità =
--     uno); root_comment_id degli eventi di un root è il root stesso.
--   * Il payload can_comment richiede anche almeno un'identità di interazione.
--   * delete_comment su un commento inesistente o già eliminato solleva
--     comment_unavailable (P0002): il client lo tratta come già rimosso.
--   * fetch_post_detail: `item_type` è al primo livello e l'oggetto `author` ha un
--     campo in più, source_kind (testata/pagina per il Media, come nel Feed).
--     Restituisce NULL anche per un content_type sconosciuto.
--   * Codici di errore aggiunti oltre a quelli del contratto, tutti 22023:
--     comment_content_type_unsupported, comment_invalid_sort,
--     comment_invalid_cursor, comment_invalid_operation_key, comment_invalid_since.
--     comments_disabled è 55000, comment_forbidden e comment_identity_forbidden
--     42501, content_unavailable / comment_unavailable /
--     comment_target_unavailable P0002, comment_version_conflict e
--     comment_operation_conflict 40001.
--   * 'Più rilevanti': (1 + Mi piace + 2 × risposte) / (ore + 2)^1.5, con Mi piace
--     e risposte contati fino a as_of (congelato nel cursore); cursore keyset
--     (punteggio, created_at, id). I numeri non erano definiti dal task.
--   * I commenti nascosti da impostazioni (existing_visibility = 'hidden') non
--     entrano né nel conteggio visibile né in Insights (passano da
--     footme_visible_comments), ma media_content_engagement, che non ha un
--     viewer, conta tutti i commenti attivi.
--   * Il Post persona NON entra in media_content_engagement (come prima: la vista
--     è dei media).
--   * Nessuna vista di compatibilità per le cinque tabelle legacy: i lettori
--     client legacy (`.from("..._comments")` nei service di Società, Media e
--     Tifoso) sono rimossi dal client di HOM-08 (verificato con grep). Le app
--     già distribuite che leggono o scrivono quei commenti falliranno, come per
--     i Mi piace di HOM-07: è voluto (un solo dominio, nessun dual-write).
--   * Il backfill NON conserva l'identità di un tempo ma quella con cui oggi lo
--     stesso profilo potrebbe commentare (footme_publishing_identities, la regola
--     di HOM-07): persona per player/coach/staff/agent/director/fan, Media solo con
--     la sua riga media_profiles, per un club_admin la sua Società più vecchia
--     fra quelle che possiede o in cui ha content_create e che oggi è valida. I
--     commenti che non si mappano su nessuna identità (ruolo admin, Media senza
--     profilo, club_admin senza Società valida) sono SCARTATI; il numero esce come
--     NOTICE del backfill. Le tabelle legacy erano piatte: nessuna risposta si
--     perde. Il backfill NON applica i limiti dei commenti nuovi (un commento
--     legacy più lungo di 1000 caratteri resta com'è).
--
-- LIMITI DICHIARATI
--
--   * Nessun rate limit per utente su create_comment e nessuna scadenza del registro
--     content_comment_operations (una riga da pochi byte per commento creato).
--   * list_content_comments materializza TUTTI i commenti visibili del contenuto a
--     ogni pagina (O(N) per pagina, con chiamate per riga a footme_like_actor_visible):
--     va bene per i volumi attesi; per thread molto lunghi servirà una proiezione.
--   * ECCEZIONE alla regola «RPC su clubs = security invoker»: footme_comment_cards e
--     fetch_comment_context sono security definer e leggono clubs (nome, logo,
--     categoria, verifica di una Società autrice o delle identità del viewer), come
--     list_content_likers di HOM-07. Motivo: content_comments è chiusa ai client e la
--     scheda deve combinare quelle righe con i dati dell'identità, che una funzione
--     invoker non potrebbe leggere insieme. L'output resta limitato: una Società
--     autrice compare solo se footme_like_actor_visible la ammette (non sospesa,
--     rifiutata, segnalata; titolare non bloccato) e le identità del contesto sono
--     solo quelle del viewer; ogni RPC rifiuta anon e controlla auth.uid().
--   * La concorrenza reale (due sessioni) non è riproducibile col runner PGlite
--     (una sola connessione): l'idempotenza usa pg_advisory_xact_lock su (utente,
--     chiave) e la risposta prende il root in share mentre l'eliminazione lo
--     prende in update, ma l'effetto è verificato sulle conseguenze, non sul
--     lock.
--   * 'Più rilevanti': l'unico caso in cui una riga può ricomparire fra due
--     pagine è un punteggio che CALA fra una pagina e l'altra (Mi piace tolto,
--     utente bloccato): il client deduplica per id.
--   * Le RPC sono security definer e leggono clubs/profiles per le schede
--     autore, come list_content_likers di HOM-07: espongono solo nome, logo,
--     categoria e verifica di identità già visibili dal viewer
--     (footme_like_actor_visible).
--
-- ROLLOUT
--
--   Richiede HOM-07 (20261122090000). Le app già distribuite che leggono o
--   scrivono le cinque tabelle legacy falliscono dopo questa migrazione: il
--   client nuovo va distribuito insieme o subito dopo. La migrazione è
--   transazionale: se resta una dipendenza non prevista dalle tabelle legacy
--   (schema remoto non allineato) il DROP fallisce e non si applica nulla.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — il dominio Commenti: tre tabelle chiuse ai client
--
-- content_comments è l'unico posto dove vive un commento, per tutti e sei i
-- tipi di contenuto (§1, §3). Nessuna policy e nessun grant: si legge e si
-- scrive SOLO dalle RPC di questa migrazione (security definer), così le
-- regole di visibilità (§89–§91, §195) e di autorizzazione (§42–§43, §146)
-- non si aggirano con una select o una insert dirette.
--
--   * Un ROOT ha root_comment_id NULL. Una RISPOSTA punta al root del thread
--     (un solo livello di annidamento, §50–§51) e, con reply_to_comment_id, al
--     commento preciso a cui risponde. reply_to_identity_* è lo snapshot
--     dell'identità destinataria; quando QUEL commento viene eliminato
--     (tombstone o rimozione) lo snapshot di tutte le risposte che lo puntano è
--     azzerato: l'identità dell'autore eliminato non deve restare leggibile
--     (decisione 3).
--   * L'autore è un'IDENTITÀ (author_type/author_id), non un profilo: un
--     commento scritto come Società o Media appartiene alla Società o al Media
--     (decisione 2). acted_by è solo audit e non esce mai da una RPC.
--   * L'eliminazione è una cancellazione vera (decisione 3): lo scheletro di
--     un root con risposte attive resta come status 'deleted' con testo,
--     mention, link, autore e acted_by azzerati; tutto il resto sparisce.
-- ============================================================

create table if not exists public.content_comments (
  id                     uuid        primary key default gen_random_uuid(),
  content_type           text        not null
                                     check (content_type in ('club_media', 'media_profile', 'profile_post',
                                                             'fan_tribuna', 'media_tribuna', 'fan_media')),
  content_id             uuid        not null,
  root_comment_id        uuid        references public.content_comments(id) on delete cascade,
  reply_to_comment_id    uuid        references public.content_comments(id) on delete set null,
  reply_to_identity_type text        check (reply_to_identity_type in ('person', 'society', 'media')),
  reply_to_identity_id   uuid,
  author_type            text        check (author_type in ('person', 'society', 'media')),
  author_id              uuid,
  acted_by               uuid        references public.profiles(id) on delete set null,
  body                   text        not null default '',
  mentions               jsonb       not null default '[]'::jsonb check (jsonb_typeof(mentions) = 'array'),
  links                  jsonb       not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  status                 text        not null default 'active' check (status in ('active', 'deleted')),
  version                integer     not null default 1,
  edited_at              timestamptz,
  deleted_at             timestamptz,
  operation_key          text,
  payload_hash           text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (status = 'deleted' or (author_type is not null and author_id is not null)),
  check (root_comment_id is null or root_comment_id <> id),
  -- Un root non risponde a nessuno: l'unico reply_to ammesso è quello di una risposta.
  check (root_comment_id is not null
         or (reply_to_comment_id is null and reply_to_identity_type is null and reply_to_identity_id is null))
);

-- Un solo commento per (chi ha agito, chiave di operazione): è l'idempotenza
-- di create_comment (§92–§95). Con acted_by NULL (commento eliminato) non vincola.
create unique index if not exists content_comments_operation_key_uniq
  on public.content_comments (acted_by, operation_key)
  where operation_key is not null;

-- Pagina dei commenti principali: per contenuto, dal più recente.
create index if not exists content_comments_root_page_idx
  on public.content_comments (content_type, content_id, created_at desc, id)
  where status = 'active' and root_comment_id is null;
-- Tutti i commenti attivi di un contenuto (conteggio, aggiornamenti).
create index if not exists content_comments_content_active_idx
  on public.content_comments (content_type, content_id, created_at, id)
  where status = 'active';
-- Le risposte di un thread, dalla più vecchia (§126).
create index if not exists content_comments_thread_idx
  on public.content_comments (root_comment_id, created_at, id);
-- Dall'identità ai suoi commenti (pulizia all'eliminazione di account/Società).
create index if not exists content_comments_author_idx
  on public.content_comments (author_type, author_id);

alter table public.content_comments enable row level security;
revoke all on table public.content_comments from anon, authenticated;

-- Impostazioni per contenuto (§177–§181). Riga assente = commenti abilitati,
-- commenti esistenti visibili. HOM-08 non ha alcun comando che la scriva: la
-- valorizzano le task che governano il contenuto. Una tabella a parte e non
-- una colonna sulle sei tabelle contenuto: la RLS filtra le righe, non le
-- colonne, e una colonna sulle tabelle contenuto sarebbe scrivibile dal
-- proprietario con la sua policy di UPDATE.
create table if not exists public.content_comment_settings (
  content_type        text        not null
                                  check (content_type in ('club_media', 'media_profile', 'profile_post',
                                                          'fan_tribuna', 'media_tribuna', 'fan_media')),
  content_id          uuid        not null,
  comments_enabled    boolean     not null default true,
  existing_visibility text        not null default 'visible' check (existing_visibility in ('visible', 'hidden')),
  updated_at          timestamptz not null default now(),
  primary key (content_type, content_id)
);

alter table public.content_comment_settings enable row level security;
revoke all on table public.content_comment_settings from anon, authenticated;

-- Eventi di dominio (§200–§208). Outbox append-only: la scrive la stessa
-- transazione del comando, la consumerà il layer Notifiche (una task futura),
-- che decide categoria, preferenze, push, quiet hours e self-notification
-- (§204, §208). Non porta MAI testo del commento. consumed_at lo imposta il
-- consumatore; serve a sapere quali eventi non sono ancora stati letti, perché
-- eliminare un commento cancella i suoi eventi non ancora consumati (decisione 3).
create table if not exists public.content_comment_events (
  id                   bigserial   primary key,
  event_type           text        not null
                                   check (event_type in ('COMMENT_CREATED', 'REPLY_CREATED',
                                                         'COMMENT_MENTION_CREATED', 'COMMENT_LIKED')),
  content_type         text        not null,
  content_id           uuid        not null,
  root_comment_id      uuid,
  comment_id           uuid,
  target_comment_id    uuid,
  actor_identity_type  text        check (actor_identity_type in ('person', 'society', 'media')),
  actor_identity_id    uuid,
  acted_by             uuid        references public.profiles(id) on delete set null,
  target_identity_type text        check (target_identity_type in ('person', 'society', 'media')),
  target_identity_id   uuid,
  occurred_at          timestamptz not null default now(),
  consumed_at          timestamptz
);

create index if not exists content_comment_events_pending_idx
  on public.content_comment_events (id) where consumed_at is null;
create index if not exists content_comment_events_comment_idx
  on public.content_comment_events (comment_id) where consumed_at is null;
create index if not exists content_comment_events_target_comment_idx
  on public.content_comment_events (target_comment_id) where consumed_at is null;

alter table public.content_comment_events enable row level security;
revoke all on table public.content_comment_events from anon, authenticated;
revoke all on sequence public.content_comment_events_id_seq from anon, authenticated;

-- Registro delle chiavi di operazione di create_comment (§92–§95). Senza
-- contenuto: serve a far sì che il tentativo ritardato di una chiave il cui
-- commento è stato poi eliminato NON resusciti il commento ma risponda
-- comment_unavailable. Alla cancellazione del commento (footme_comment_purge_side_data)
-- comment_id e payload_hash vanno a NULL: resta solo «questa chiave è stata
-- usata». Sparisce con l'account (cascade). Cresce di una riga per commento
-- creato (nessuna scadenza: righe da pochi byte, nessun dato personale).
create table if not exists public.content_comment_operations (
  acted_by      uuid        not null references public.profiles(id) on delete cascade,
  operation_key text        not null,
  payload_hash  text,
  comment_id    uuid,
  created_at    timestamptz not null default now(),
  primary key (acted_by, operation_key)
);

create index if not exists content_comment_operations_comment_idx
  on public.content_comment_operations (comment_id) where comment_id is not null;

alter table public.content_comment_operations enable row level security;
revoke all on table public.content_comment_operations from anon, authenticated;

-- ============================================================
-- SEZIONE 2 — Mi piace ai commenti: content_likes accetta 'comment' (§70–§78)
--
-- Nessuna tabella nuova (§77: un solo sistema Mi piace). Per content_type =
-- 'comment' la colonna `post_id` contiene l'id del COMMENTO (nome storico).
-- Il vincolo si cerca per DEFINIZIONE e non per nome: lo schema remoto non
-- sempre coincide con le migrazioni.
-- ============================================================

do $$
declare
  v_con record;
begin
  for v_con in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.content_likes'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%content_type%'
  loop
    execute format('alter table public.content_likes drop constraint %I', v_con.conname);
  end loop;

  alter table public.content_likes
    add constraint content_likes_content_type_check
    check (content_type in ('club_media', 'fan_media', 'profile_post', 'media_profile', 'comment'));
end
$$;

-- ============================================================
-- SEZIONE 3 — backfill dalle cinque tabelle legacy (§3)
--
-- Gli id e le date di creazione restano quelli di prima; sono tutti commenti
-- principali (le tabelle legacy sono piatte: nessuna risposta si perde).
-- L'identità autrice è quella con cui OGGI lo stesso profilo potrebbe
-- commentare (footme_publishing_identities, la regola di HOM-07): persona per
-- player/coach/staff/agent/director/fan, Media per un profilo media con la sua
-- riga media_profiles, per un club_admin la sua Società più vecchia fra quelle
-- che possiede o in cui ha content_create e che oggi è valida. Un commento
-- legacy che non si mappa su nessuna identità (ruolo admin, Media senza
-- profilo, club_admin senza Società valida) è SCARTATO: nessuna RPC potrebbe
-- mai mostrarlo né permetterne la modifica. Il numero di commenti migrati e di
-- scartati esce come NOTICE nel log della migrazione.
-- ============================================================

do $$
declare
  v_legacy   integer;
  v_migrated integer;
  v_lost     uuid[];
begin
  -- Nessuna scrittura (di un'app vecchia ancora in giro) fra la lettura e il DROP:
  -- il lock dura fino alla fine della migrazione, che è transazionale.
  lock table public.club_media_comments, public.media_profile_post_comments,
             public.media_tribuna_comments, public.fan_tribuna_comments,
             public.fan_media_comments in share mode;

  select (select count(*) from public.club_media_comments)
       + (select count(*) from public.media_profile_post_comments)
       + (select count(*) from public.media_tribuna_comments)
       + (select count(*) from public.fan_tribuna_comments)
       + (select count(*) from public.fan_media_comments)
  into v_legacy;

  with legacy as (
    select 'club_media'::text as content_type, x.id, x.post_id, x.profile_id, x.body, x.created_at, x.updated_at
      from public.club_media_comments x
    union all
    select 'media_profile', x.id, x.post_id, x.profile_id, x.body, x.created_at, x.updated_at
      from public.media_profile_post_comments x
    union all
    select 'media_tribuna', x.id, x.post_id, x.profile_id, x.body, x.created_at, x.updated_at
      from public.media_tribuna_comments x
    union all
    select 'fan_tribuna',   x.id, x.post_id, x.profile_id, x.body, x.created_at, x.updated_at
      from public.fan_tribuna_comments x
    union all
    select 'fan_media',     x.id, x.post_id, x.profile_id, x.body, x.created_at, x.updated_at
      from public.fan_media_comments x
  ),
  who as (
    select pr.profile_id, i.c_type, i.c_id
    from (select distinct l.profile_id from legacy l) pr
    cross join lateral (
      select fi.c_type, fi.c_id
      from public.footme_publishing_identities(pr.profile_id) fi
      left join public.clubs c on fi.c_type = 'society' and c.id = fi.c_id
      where fi.can_post
      order by (fi.c_type = 'society'), fi.c_rank, c.created_at, fi.c_id
      limit 1
    ) i
  )
  insert into public.content_comments
    (id, content_type, content_id, author_type, author_id, acted_by, body, created_at, updated_at)
  select l.id, l.content_type, l.post_id, w.c_type, w.c_id, l.profile_id, l.body, l.created_at, l.updated_at
  from legacy l
  join who w on w.profile_id = l.profile_id
  on conflict (id) do nothing;

  get diagnostics v_migrated = row_count;
  select array_agg(x.id order by x.id) into v_lost
  from (
    select id from public.club_media_comments
    union all select id from public.media_profile_post_comments
    union all select id from public.media_tribuna_comments
    union all select id from public.fan_tribuna_comments
    union all select id from public.fan_media_comments
  ) x
  where not exists (select 1 from public.content_comments c where c.id = x.id);

  raise notice 'HOM-08 backfill commenti: legacy=%, migrati=%, scartati (autore non mappabile)=%, id scartati=%',
    v_legacy, v_migrated, v_legacy - v_migrated, coalesce(v_lost, '{}'::uuid[]);
end
$$;


-- ============================================================
-- SEZIONE 4 — regole interne (security definer, nessun execute ai client)
--
-- Ogni regola vive in UNA funzione: la lista, il conteggio del payload, lo
-- stato interazioni, il contesto, Insights e la risposta delle mutation
-- leggono tutti da qui, quindi non possono divergere (§89–§91, §195).
-- ============================================================

-- 4-1. Limiti (§12–§15, §24). Chiavi proprie di app_policy_settings: il Post
--      ne ha di sue (post_composer.*) e un commento non è un Post.
create or replace function public.footme_comment_limits()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'max_body_length',
      coalesce((select (s.value #>> '{}')::int from public.app_policy_settings s
                where s.key = 'comment.max_body_length'), 1000),
    'max_mentions',
      coalesce((select (s.value #>> '{}')::int from public.app_policy_settings s
                where s.key = 'comment.max_mentions'), 20),
    'max_links',
      coalesce((select (s.value #>> '{}')::int from public.app_policy_settings s
                where s.key = 'comment.max_links'), 10)
  );
$$;

-- 4-2. Impostazioni del contenuto. Riga assente = abilitati, esistenti visibili.
create or replace function public.footme_comment_settings(p_content_type text, p_content_id uuid)
returns table (s_enabled boolean, s_visibility text)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(s.comments_enabled, true), coalesce(s.existing_visibility, 'visible')
  from (select 1) one
  left join public.content_comment_settings s
    on s.content_type = p_content_type and s.content_id = p_content_id;
$$;

-- 4-3. Predicato di riga: «questo commento è visibile al viewer». Attivo,
--      autore visibile (esistente, non sospeso, non bloccato con il viewer in
--      nessuna direzione: footme_like_actor_visible, la stessa regola dei Mi
--      piace) e commenti esistenti non nascosti dalle impostazioni (§180).
--      Con p_viewer null non c'è blocco da applicare (Insights dell'autore).
create or replace function public.footme_comment_row_visible(
  p_viewer       uuid,
  p_status       text,
  p_author_type  text,
  p_author_id    uuid,
  p_content_type text,
  p_content_id   uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_status = 'active'
     and public.footme_like_actor_visible(p_viewer, p_author_type, p_author_id)
     and not exists (
       select 1 from public.content_comment_settings s
       where s.content_type = p_content_type
         and s.content_id = p_content_id
         and not s.comments_enabled
         and s.existing_visibility = 'hidden');
$$;

-- 4-4. I commenti ATTIVI che il viewer vede, per un insieme di contenuti: la
--      definizione unica (§89–§91). p_root_ids, se presente, restringe alle
--      risposte di quei root (serve a non scandire l'intero contenuto per i
--      contatori di thread). Tombstone e placeholder non sono mai righe di
--      questa funzione: non si contano.
create or replace function public.footme_visible_comments(
  p_viewer        uuid,
  p_content_types text[],
  p_content_ids   uuid[],
  p_root_ids      uuid[] default null
)
returns setof public.content_comments
language sql
stable
security definer
set search_path = public
as $$
  with keys as (
    select distinct k.content_type, k.content_id
    from unnest(p_content_types, p_content_ids) as k(content_type, content_id)
  )
  select cc.*
  from keys k
  join public.content_comments cc
    on cc.content_type = k.content_type and cc.content_id = k.content_id
  where cc.status = 'active'
    and (p_root_ids is null or cc.root_comment_id = any (p_root_ids))
    and public.footme_comment_row_visible(
          p_viewer, cc.status, cc.author_type, cc.author_id, cc.content_type, cc.content_id);
$$;

-- 4-5. Conteggio del contenuto = root attivi visibili + risposte attive
--      visibili (§89–§91). Una riga di footme_visible_comments, una unità.
create or replace function public.footme_comments_count(p_viewer uuid, p_content_type text, p_content_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.footme_visible_comments(p_viewer, array[p_content_type], array[p_content_id]);
$$;

-- Risposte visibili di un thread.
create or replace function public.footme_comment_replies_count(p_viewer uuid, p_root_comment_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.content_comments r
  cross join lateral public.footme_visible_comments(
    p_viewer, array[r.content_type], array[r.content_id], array[r.id]) v
  where r.id = p_root_comment_id;
$$;

-- 4-6. Il commento è leggibile dal viewer ADESSO: attivo, visibile, contenuto
--      leggibile (footme_content_readable) e commenti non nascosti.
create or replace function public.footme_comment_readable(p_viewer uuid, p_comment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.content_comments cc
    where cc.id = p_comment_id
      and public.footme_comment_row_visible(
            p_viewer, cc.status, cc.author_type, cc.author_id, cc.content_type, cc.content_id)
      and public.footme_content_readable(p_viewer, cc.content_type, cc.content_id)
  );
$$;

-- 4-7. Chi pubblica il contenuto, come identità (§64 «Autore»). Società →
--      society; contenuti Media → media; ogni altro → person (stessa
--      derivazione di footme_post_payloads).
create or replace function public.footme_content_publisher(p_content_type text, p_content_id uuid)
returns table (pb_type text, pb_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when fci.publisher_type = 'club'                              then 'society'
      when fci.content_type in ('media_profile', 'media_tribuna')   then 'media'
      else 'person'
    end,
    fci.publisher_id
  from public.feed_content_index fci
  where fci.content_type = p_content_type
    and fci.post_id = p_content_id;
$$;

-- 4-8. Tipo di identità di una mention ('profile' | 'club' → person | media |
--      society). Un profilo con ruolo media e la sua riga media_profiles è Media.
create or replace function public.footme_comment_mention_identity(p_type text, p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_type = 'club' then 'society'
    when exists (select 1 from public.profiles p
                 join public.media_profiles mp on mp.profile_id = p.id
                 where p.id = p_id and p.role::text = 'media') then 'media'
    else 'person'
  end;
$$;

-- 4-9. Scrittura di un evento di dominio (§200–§208). Mai testo.
create or replace function public.footme_comment_event(
  p_event_type   text,
  p_content_type text,
  p_content_id   uuid,
  p_root         uuid,
  p_comment      uuid,
  p_target       uuid,
  p_actor_type   text,
  p_actor_id     uuid,
  p_acted_by     uuid,
  p_target_type  text,
  p_target_id    uuid
)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.content_comment_events
    (event_type, content_type, content_id, root_comment_id, comment_id, target_comment_id,
     actor_identity_type, actor_identity_id, acted_by, target_identity_type, target_identity_id)
  values
    (p_event_type, p_content_type, p_content_id, p_root, p_comment, p_target,
     p_actor_type, p_actor_id, p_acted_by, p_target_type, p_target_id);
$$;

-- 4-10. Pulizia di ciò che appartiene a un commento che sparisce: i suoi Mi
--       piace e gli eventi di dominio non ancora consumati che lo riguardano
--       (decisione 3). Quelli già consumati non si toccano: non portano testo.
create or replace function public.footme_comment_purge_side_data(p_comment_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  delete from public.content_likes cl
  where cl.content_type = 'comment' and cl.post_id = p_comment_id;

  delete from public.content_comment_events e
  where e.consumed_at is null
    and (e.comment_id = p_comment_id or e.target_comment_id = p_comment_id);

  -- La chiave di operazione resta «consumata» ma senza contenuto né riferimento.
  update public.content_comment_operations o
  set comment_id = null, payload_hash = null
  where o.comment_id = p_comment_id;
end;
$$;

-- Qualunque cancellazione fisica di un commento (comando, cascata da un
-- contenuto o da un root, account eliminato) ripulisce i suoi Mi piace e i
-- suoi eventi: l'invariante non dipende da chi cancella.
create or replace function public.content_comments_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.footme_comment_purge_side_data(old.id);
  return old;
end;
$$;

drop trigger if exists content_comments_purge on public.content_comments;
create trigger content_comments_purge after delete on public.content_comments
  for each row execute function public.content_comments_after_delete();

-- 4-11. Eliminazione di UN commento (decisione 3). Interna: la usano
--       delete_comment e la pulizia di account/Società. Restituisce l'esito
--       ('removed' | 'tombstoned') o NULL se il commento non c'è più o è già
--       un tombstone.
--         * root con risposte attive → tombstone: stato 'deleted', testo,
--           mention, link, autore, acted_by, operation_key e hash azzerati,
--           Mi piace ed eventi non consumati cancellati;
--         * root senza risposte attive → cancellato fisicamente;
--         * risposta → cancellata fisicamente (le altre risposte che la
--           puntavano perdono il riferimento); se il root è un tombstone e
--           quella era l'ultima risposta attiva, sparisce anche il root.
--       In entrambi i casi (tombstone o rimozione) le risposte che puntavano al
--       commento perdono anche reply_to_identity_*: l'identità dell'autore
--       eliminato non deve restare leggibile da nessuna scheda (decisione 3).
create or replace function public.footme_comment_remove(p_comment_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_root_id uuid;
  v_c       public.content_comments%rowtype;
  v_root    public.content_comments%rowtype;
begin
  -- Ordine dei lock: prima il root, poi il commento (create_comment prende il
  -- root in share prima di inserire una risposta).
  select cc.root_comment_id into v_root_id from public.content_comments cc where cc.id = p_comment_id;
  if v_root_id is not null then
    select * into v_root from public.content_comments r where r.id = v_root_id for update;
  end if;

  select * into v_c from public.content_comments cc where cc.id = p_comment_id for update;
  if not found or v_c.status <> 'active' then
    return null;
  end if;

  update public.content_comments d
  set reply_to_identity_type = null, reply_to_identity_id = null
  where d.reply_to_comment_id = v_c.id;

  if v_c.root_comment_id is null then
    if exists (select 1 from public.content_comments r
               where r.root_comment_id = v_c.id and r.status = 'active') then
      perform public.footme_comment_purge_side_data(v_c.id);
      update public.content_comments cc
      set status = 'deleted',
          body = '', mentions = '[]'::jsonb, links = '[]'::jsonb,
          author_type = null, author_id = null, acted_by = null,
          operation_key = null, payload_hash = null,
          edited_at = null, deleted_at = now(), updated_at = now(),
          version = cc.version + 1
      where cc.id = v_c.id;
      return 'tombstoned';
    end if;

    delete from public.content_comments cc where cc.id = v_c.id;
    return 'removed';
  end if;

  delete from public.content_comments cc where cc.id = v_c.id;

  if v_root.id is not null and v_root.status = 'deleted'
     and not exists (select 1 from public.content_comments r
                     where r.root_comment_id = v_root.id and r.status = 'active') then
    delete from public.content_comments cc where cc.id = v_root.id;
  end if;

  return 'removed';
end;
$$;

-- 4-12. Quando sparisce un'identità (account o Società eliminati) sparisce
--       anche ciò che ha scritto, con la stessa regola dell'eliminazione: un
--       root con risposte di altri resta come tombstone anonimo, il resto si
--       cancella (§164, §168). Prima le risposte, poi i root: un root con sole
--       risposte della stessa identità sparisce del tutto.
create or replace function public.content_comments_cleanup_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  for v_id in
    select cc.id
    from public.content_comments cc
    where cc.status = 'active'
      and ((tg_argv[0] = 'society' and cc.author_type = 'society' and cc.author_id = old.id)
        or (tg_argv[0] = 'profile' and cc.author_type in ('person', 'media') and cc.author_id = old.id))
    order by (cc.root_comment_id is null), cc.created_at
  loop
    perform public.footme_comment_remove(v_id);
  end loop;
  return old;
end;
$$;

drop trigger if exists content_comments_cleanup_author on public.profiles;
create trigger content_comments_cleanup_author after delete on public.profiles
  for each row execute function public.content_comments_cleanup_author('profile');
drop trigger if exists content_comments_cleanup_author on public.clubs;
create trigger content_comments_cleanup_author after delete on public.clubs
  for each row execute function public.content_comments_cleanup_author('society');

-- 4-13. Un contenuto cancellato fisicamente porta via i suoi commenti (come
--       content_likes_cleanup_content per i Mi piace). Un contenuto soft-deleted
--       (HOM-04) li lascia in tabella ma nessuno li legge: footme_content_readable
--       è falsa.
create or replace function public.content_comments_cleanup_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.content_comments cc
  where cc.content_type = tg_argv[0] and cc.content_id = old.id;
  delete from public.content_comment_settings s
  where s.content_type = tg_argv[0] and s.content_id = old.id;
  return old;
end;
$$;

drop trigger if exists content_comments_cleanup on public.club_media_posts;
create trigger content_comments_cleanup after delete on public.club_media_posts
  for each row execute function public.content_comments_cleanup_content('club_media');
drop trigger if exists content_comments_cleanup on public.media_profile_posts;
create trigger content_comments_cleanup after delete on public.media_profile_posts
  for each row execute function public.content_comments_cleanup_content('media_profile');
drop trigger if exists content_comments_cleanup on public.media_tribuna_posts;
create trigger content_comments_cleanup after delete on public.media_tribuna_posts
  for each row execute function public.content_comments_cleanup_content('media_tribuna');
drop trigger if exists content_comments_cleanup on public.fan_tribuna_posts;
create trigger content_comments_cleanup after delete on public.fan_tribuna_posts
  for each row execute function public.content_comments_cleanup_content('fan_tribuna');
drop trigger if exists content_comments_cleanup on public.fan_media_posts;
create trigger content_comments_cleanup after delete on public.fan_media_posts
  for each row execute function public.content_comments_cleanup_content('fan_media');
drop trigger if exists content_comments_cleanup on public.profile_posts;
create trigger content_comments_cleanup after delete on public.profile_posts
  for each row execute function public.content_comments_cleanup_content('profile_post');

-- 4-14a. Mention di una MODIFICA quando l'identità di una mention già salvata non
--        passa più la verifica (es. quel profilo ha nel frattempo bloccato chi
--        modifica): le mention già presenti (stessa identità e stesso nome) non si
--        rivalidano contro l'identità, ma range, testo '@nome', sovrapposizioni e
--        massimo valgono per tutte. Le nuove passano da footme_post_normalize_mentions.
create or replace function public.footme_comment_mentions_partial(
  p_body     text,
  p_mentions jsonb,
  p_existing jsonb,
  p_max      integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_off    integer[] := public.footme_utf16_offsets(p_body);
  v_fresh  jsonb := '[]'::jsonb;
  v_all    jsonb;
  v_sorted jsonb;
  v_out    jsonb := '[]'::jsonb;
  v_e      jsonb;
  v_id     uuid;
  v_type   text;
  v_name   text;
  v_s      integer;
  v_en     integer;
  v_cs     integer;
  v_ce     integer;
  v_prev_end integer := -1;
  v_prev   jsonb;
  v_msg    text;
  v_detail text;
begin
  for v_e in select e from jsonb_array_elements(p_mentions) e loop
    if jsonb_typeof(v_e) = 'object' and exists (
         select 1 from jsonb_array_elements(p_existing) o
         where o ->> 'identity_type' = v_e ->> 'identity_type'
           and o ->> 'identity_id' = v_e ->> 'identity_id'
           and o ->> 'display_name' = v_e ->> 'display_name') then
      continue;
    end if;
    v_fresh := v_fresh || jsonb_build_array(v_e);
  end loop;

  begin
    v_fresh := public.footme_post_normalize_mentions(p_body, v_fresh, p_max);
  exception when others then
    get stacked diagnostics v_msg = message_text, v_detail = pg_exception_detail;
    if v_msg = 'post_invalid_mention' then
      raise exception 'comment_invalid_mention' using errcode = '22023', detail = v_detail;
    end if;
    raise;
  end;

  v_all := v_fresh;
  for v_e in select e from jsonb_array_elements(p_mentions) e loop
    -- Solo le mention già salvate (le nuove sono già in v_fresh).
    continue when not exists (
         select 1 from jsonb_array_elements(p_existing) o
         where o ->> 'identity_type' = v_e ->> 'identity_type'
           and o ->> 'identity_id' = v_e ->> 'identity_id'
           and o ->> 'display_name' = v_e ->> 'display_name');
    begin
      v_id := (v_e ->> 'identity_id')::uuid;
      v_type := v_e ->> 'identity_type';
      v_name := v_e ->> 'display_name';
      v_s := (v_e ->> 'start')::integer;
      v_en := (v_e ->> 'end')::integer;
    exception when others then
      raise exception 'comment_invalid_mention' using errcode = '22023', detail = 'cast';
    end;
    if v_s < 0 or v_en <= v_s then
      raise exception 'comment_invalid_mention' using errcode = '22023', detail = 'fields';
    end if;
    v_cs := array_position(v_off, v_s) - 1;
    v_ce := array_position(v_off, v_en) - 1;
    if v_cs is null or v_ce is null then
      raise exception 'comment_invalid_mention' using errcode = '22023', detail = 'range';
    end if;
    if substr(coalesce(p_body, ''), v_cs + 1, v_ce - v_cs) <> '@' || v_name then
      raise exception 'comment_invalid_mention' using errcode = '22023', detail = 'token';
    end if;
    v_all := v_all || jsonb_build_array(jsonb_build_object(
      'identity_id', v_id, 'identity_type', v_type, 'display_name', v_name,
      'start', v_s, 'end', v_en));
  end loop;

  select coalesce(jsonb_agg(e order by (e ->> 'start')::integer, (e ->> 'end')::integer, e ->> 'identity_id'), '[]'::jsonb)
  into v_sorted
  from jsonb_array_elements(v_all) e;

  for v_e in select e from jsonb_array_elements(v_sorted) e loop
    if v_prev is not null and v_prev = v_e then
      continue;
    end if;
    if (v_e ->> 'start')::integer < v_prev_end then
      raise exception 'comment_invalid_mention' using errcode = '22023', detail = 'overlap';
    end if;
    v_out := v_out || jsonb_build_array(v_e);
    v_prev := v_e;
    v_prev_end := (v_e ->> 'end')::integer;
  end loop;

  if jsonb_array_length(v_out) > p_max then
    raise exception 'comment_invalid_mention' using errcode = '22023', detail = 'too_many';
  end if;

  return v_out;
end;
$$;

-- 4-14. Validazione del testo (§12–§15, §24, §104–§116). Restituisce
--       {mentions, links} normalizzati o solleva:
--         comment_invalid_body    22023  vuoto o fatto di sole mention
--         comment_too_long        22023  oltre max_body_length
--         comment_invalid_mention 22023  mention non valida (detail = motivo)
--       Le mention riusano footme_post_normalize_mentions (HOM-06.1: ordine,
--       sovrapposizioni, token '@nome', identità esistente e non bloccata);
--       il suo errore post_invalid_mention diventa comment_invalid_mention.
--       Un LINK non idoneo è SCARTATO, mai un errore (come HOM-06.1 §89):
--       sopravvive solo chi ha range UTF-16 che coincide con l'url, passa
--       footme_safe_https_url, non si sovrappone a una mention o a un altro
--       link, entro max_links.
create or replace function public.footme_comment_normalize(
  p_body     text,
  p_mentions jsonb,
  p_links    jsonb,
  p_existing jsonb default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limits    jsonb := public.footme_comment_limits();
  v_max_len   integer := (v_limits ->> 'max_body_length')::integer;
  v_max_ment  integer := (v_limits ->> 'max_mentions')::integer;
  v_max_links integer := (v_limits ->> 'max_links')::integer;
  v_mentions  jsonb;
  v_off       integer[];
  v_acc       jsonb := '[]'::jsonb;
  v_e         jsonb;
  v_s         integer;
  v_en        integer;
  v_cs        integer;
  v_ce        integer;
  v_slice     text;
  v_ok        boolean;
  v_msg       text;
  v_detail    text;
begin
  if p_body is null or btrim(p_body) = '' then
    raise exception 'comment_invalid_body' using errcode = '22023';
  end if;

  if char_length(p_body) > v_max_len then
    raise exception 'comment_too_long' using errcode = '22023';
  end if;

  begin
    v_mentions := public.footme_post_normalize_mentions(p_body, p_mentions, v_max_ment);
  exception when others then
    get stacked diagnostics v_msg = message_text, v_detail = pg_exception_detail;
    if v_msg = 'post_invalid_mention' and v_detail = 'identity'
       and p_existing is not null and jsonb_typeof(p_existing) = 'array'
       and jsonb_typeof(p_mentions) = 'array' then
      -- Modifica: solo le mention NUOVE si rivalidano contro l'identità (esiste,
      -- non bloccata con chi scrive); quelle già salvate no, ma range e testo
      -- si controllano per tutte.
      v_mentions := public.footme_comment_mentions_partial(p_body, p_mentions, p_existing, v_max_ment);
    elsif v_msg = 'post_invalid_mention' then
      raise exception 'comment_invalid_mention' using errcode = '22023', detail = v_detail;
    else
      raise;
    end if;
  end;

  if not public.footme_post_text_is_meaningful(p_body, v_mentions) then
    raise exception 'comment_invalid_body' using errcode = '22023';
  end if;

  if p_links is not null and jsonb_typeof(p_links) = 'array' then
    v_off := public.footme_utf16_offsets(p_body);

    for v_e in select e from jsonb_array_elements(p_links) e loop
      continue when jsonb_typeof(v_e) <> 'object'
                 or coalesce(jsonb_typeof(v_e -> 'url'), '') <> 'string'
                 or coalesce(jsonb_typeof(v_e -> 'start'), '') <> 'number'
                 or coalesce(jsonb_typeof(v_e -> 'end'), '') <> 'number';

      v_ok := true;
      begin
        v_s  := (v_e ->> 'start')::integer;
        v_en := (v_e ->> 'end')::integer;
      exception when others then
        v_ok := false;
      end;
      continue when not v_ok or v_s < 0 or v_en <= v_s;

      v_cs := array_position(v_off, v_s) - 1;
      v_ce := array_position(v_off, v_en) - 1;
      continue when v_cs is null or v_ce is null;

      v_slice := substr(p_body, v_cs + 1, v_ce - v_cs);
      continue when v_slice <> (v_e ->> 'url')
                 or public.footme_safe_https_url(v_slice, false) is null;

      continue when exists (
        select 1 from jsonb_array_elements(v_mentions) m
        where (m ->> 'start')::integer < v_en and (m ->> 'end')::integer > v_s);
      continue when exists (
        select 1 from jsonb_array_elements(v_acc) a
        where (a ->> 'start')::integer < v_en and (a ->> 'end')::integer > v_s);
      continue when jsonb_array_length(v_acc) >= v_max_links;

      v_acc := v_acc || jsonb_build_array(
        jsonb_build_object('url', v_slice, 'start', v_s, 'end', v_en));
    end loop;
  end if;

  return jsonb_build_object(
    'mentions', v_mentions,
    'links', coalesce((select jsonb_agg(a order by (a ->> 'start')::integer)
                       from jsonb_array_elements(v_acc) a), '[]'::jsonb));
end;
$$;

-- 4-14b. Meta dell'identità che commenta: role, club_name, team_label, club_category,
--        media_kind, primary_position. UNA definizione: la usano la scheda autore
--        di footme_comment_cards e le identità di fetch_comment_context, così la
--        riga meta di un commento ottimistico coincide con quella riconciliata.
--        Stesse espressioni di list_content_likers (persona: ruolo, tesseramento
--        corrente, posizione del calciatore; Società: categoria; Media: tipo).
create or replace function public.footme_comment_author_meta(p_type text, p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'role',             case when p_type = 'society' then null else p.role::text end,
    'club_name',        case when p_type = 'person' then cur.club_name end,
    'team_label',       case when p_type = 'person' then cur.team_label end,
    'club_category',    case when p_type = 'society' then c.category end,
    'media_kind',       case when p_type = 'media' then coalesce(mp.media_kind, 'pagina') end,
    'primary_position', case when p_type = 'person' and p.role::text = 'player'
                          then pl.primary_position::text end)
  from (select 1) one
  left join public.clubs c on p_type = 'society' and c.id = p_id
  left join public.profiles p on p_type in ('person', 'media') and p.id = p_id
  left join public.media_profiles mp on p_type = 'media' and mp.profile_id = p_id
  left join public.player_profiles pl on p_type = 'person' and pl.profile_id = p_id
  left join lateral (
    select cl.name as club_name, ct.name as team_label
    from public.club_members cm
    join public.clubs cl on cl.id = cm.club_id
    left join public.club_teams ct on ct.id = cm.team_id
    where p_type = 'person'
      and cm.profile_id = p_id
      and cm.status = 'active'
      and cm.is_current = true
    order by cm.created_at desc
    limit 1
  ) cur on true;
$$;

-- 4-15. La scheda di un commento: UNA forma per tutte le RPC (§A5). Per ogni id
--       calcola lo stato per il viewer:
--         'active'       attivo e visibile (footme_comment_row_visible);
--         'deleted'      tombstone (autore, testo, Mi piace: niente);
--         'unavailable'  attivo ma NON visibile al viewer (autore bloccato,
--                        sospeso, eliminato; commenti nascosti): placeholder
--                        «Commento non disponibile», non interattivo, non contato.
--       Mi piace e liked_as da footme_visible_likes (la stessa definizione dei
--       Mi piace dei contenuti); risposte da footme_visible_comments. Le
--       capability sono del viewer: can_edit / can_delete se l'AUTORE è una delle
--       sue identità di interazione ADESSO (decisioni 1 e 2); can_reply / can_like
--       se il contenuto è leggibile, i commenti abilitati e ha almeno
--       un'identità con cui commentare. operation_key solo sui commenti che ha
--       scritto lui (riconciliazione §94, §223).
create or replace function public.footme_comment_cards(p_viewer uuid, p_comment_ids uuid[])
returns table (k_id uuid, k_comment jsonb)
language sql
stable
security definer
set search_path = public
as $$
  with src as (
    select cc.*
    from public.content_comments cc
    where cc.id = any (coalesce(p_comment_ids, '{}'::uuid[]))
  ),
  contents as (
    select distinct s.content_type, s.content_id from src s
  ),
  content_keys as (
    select array_agg(c.content_type order by c.content_type, c.content_id) as ts,
           array_agg(c.content_id   order by c.content_type, c.content_id) as ids
    from contents c
  ),
  ctx as (
    select
      c.content_type, c.content_id,
      public.footme_content_readable(p_viewer, c.content_type, c.content_id) as readable,
      st.s_enabled,
      pb.pb_type, pb.pb_id
    from contents c
    cross join lateral public.footme_comment_settings(c.content_type, c.content_id) st
    left join lateral public.footme_content_publisher(c.content_type, c.content_id) pb on true
  ),
  mine as (
    select i.c_type, i.c_id from public.footme_interaction_identities(p_viewer) i
  ),
  has_identity as (
    select exists (select 1 from mine) as yes
  ),
  vis as (
    select s.id,
           public.footme_comment_row_visible(
             p_viewer, s.status, s.author_type, s.author_id, s.content_type, s.content_id) as is_visible
    from src s
  ),
  likes as (
    select
      vl.v_post_id as id,
      count(*)::integer as n,
      coalesce(
        jsonb_agg(jsonb_build_object('type', vl.v_actor_type, 'id', vl.v_actor_id)
                  order by vl.v_created_at, vl.v_actor_type, vl.v_actor_id)
          filter (where mi.c_id is not null),
        '[]'::jsonb) as liked_as
    from public.footme_visible_likes(
           p_viewer,
           array_fill('comment'::text, array[coalesce(cardinality(p_comment_ids), 0)]),
           coalesce(p_comment_ids, '{}'::uuid[])) vl
    left join mine mi on mi.c_type = vl.v_actor_type and mi.c_id = vl.v_actor_id
    group by vl.v_post_id
  ),
  replies as (
    select r.root_comment_id as id, count(*)::integer as n
    from public.footme_visible_comments(
           p_viewer,
           (select coalesce(k.ts, '{}'::text[]) from content_keys k),
           (select coalesce(k.ids, '{}'::uuid[]) from content_keys k),
           coalesce(p_comment_ids, '{}'::uuid[])) r
    group by r.root_comment_id
  )
  select
    s.id,
    case
      when s.status = 'deleted' or not v.is_visible then
        jsonb_build_object(
          'id',                  s.id,
          'content_type',        s.content_type,
          'content_id',          s.content_id,
          'root_comment_id',     coalesce(s.root_comment_id, s.id),
          'reply_to_comment_id', s.reply_to_comment_id,
          'reply_to',            null,
          'status',              case when s.status = 'deleted' then 'deleted' else 'unavailable' end,
          'author',              null,
          'is_content_author',   false,
          'body',                null,
          'mentions',            '[]'::jsonb,
          'links',               '[]'::jsonb,
          'likes_count',         0,
          'liked_as',            '[]'::jsonb,
          'replies_count',       case when s.root_comment_id is null then coalesce(rp.n, 0) else 0 end,
          'created_at',          s.created_at,
          'updated_at',          s.updated_at,
          'edited_at',           null,
          'version',             s.version,
          'capabilities',        jsonb_build_object(
                                   'can_edit', false, 'can_delete', false, 'can_reply', false,
                                   'can_like', false, 'can_open_author', false),
          'operation_key',       null
        )
      else
        jsonb_build_object(
          'id',                  s.id,
          'content_type',        s.content_type,
          'content_id',          s.content_id,
          'root_comment_id',     coalesce(s.root_comment_id, s.id),
          'reply_to_comment_id', s.reply_to_comment_id,
          'reply_to',            case
                                   when s.reply_to_identity_type is not null
                                    and rtn.nm is not null
                                    and public.footme_like_actor_visible(
                                          p_viewer, s.reply_to_identity_type, s.reply_to_identity_id)
                                   then jsonb_build_object(
                                          'identity_type', s.reply_to_identity_type,
                                          'identity_id',   s.reply_to_identity_id,
                                          'name',          rtn.nm)
                                 end,
          'status',              'active',
          'author',              jsonb_build_object(
                                   'identity_type', s.author_type,
                                   'identity_id',   s.author_id,
                                   'name',          case s.author_type
                                                      when 'society' then c.name
                                                      when 'media'   then coalesce(nullif(btrim(mp.entity_name), ''),
                                                                                   nullif(btrim(p.full_name), ''), 'Media')
                                                      else coalesce(nullif(btrim(p.full_name), ''), 'Profilo')
                                                    end,
                                   'avatar_url',    case s.author_type
                                                      when 'society' then c.logo_url
                                                      when 'media'   then coalesce(mp.logo_url, p.avatar_url)
                                                      else p.avatar_url
                                                    end,
                                   'is_verified',   case s.author_type
                                                      when 'society' then c.verification_status = 'verified'
                                                      when 'media'   then coalesce(mp.verification_status = 'verified', false)
                                                      else false
                                                    end) || am.meta,
          'is_content_author',   (x.pb_type is not distinct from s.author_type
                                  and x.pb_id is not distinct from s.author_id),
          'body',                s.body,
          'mentions',            s.mentions,
          'links',               s.links,
          'likes_count',         coalesce(lk.n, 0),
          'liked_as',            coalesce(lk.liked_as, '[]'::jsonb),
          'replies_count',       case when s.root_comment_id is null then coalesce(rp.n, 0) else 0 end,
          'created_at',          s.created_at,
          'updated_at',          s.updated_at,
          'edited_at',           s.edited_at,
          'version',             s.version,
          'capabilities',        jsonb_build_object(
                                   'can_edit',   coalesce(x.readable and x.s_enabled, false)
                                                 and exists (select 1 from mine m
                                                             where m.c_type = s.author_type and m.c_id = s.author_id),
                                   'can_delete', exists (select 1 from mine m
                                                         where m.c_type = s.author_type and m.c_id = s.author_id),
                                   'can_reply',  coalesce(x.readable and x.s_enabled, false) and hi.yes,
                                   'can_like',   coalesce(x.readable and x.s_enabled, false) and hi.yes,
                                   'can_open_author', true),
          'operation_key',       case when s.acted_by is not distinct from p_viewer then s.operation_key end
        )
    end
  from src s
  join vis v on v.id = s.id
  cross join has_identity hi
  left join ctx x on x.content_type = s.content_type and x.content_id = s.content_id
  left join likes lk on lk.id = s.id
  left join replies rp on rp.id = s.id
  left join public.clubs c on s.author_type = 'society' and c.id = s.author_id
  left join public.profiles p on s.author_type in ('person', 'media') and p.id = s.author_id
  left join public.media_profiles mp on s.author_type = 'media' and mp.profile_id = s.author_id
  left join lateral (
    select public.footme_comment_author_meta(s.author_type, s.author_id) as meta
  ) am on true
  left join lateral (
    select case s.reply_to_identity_type
      when 'society' then (select rc.name from public.clubs rc where rc.id = s.reply_to_identity_id)
      when 'media'   then (select coalesce(nullif(btrim(rmp.entity_name), ''), nullif(btrim(rp2.full_name), ''), 'Media')
                           from public.profiles rp2
                           join public.media_profiles rmp on rmp.profile_id = rp2.id
                           where rp2.id = s.reply_to_identity_id)
      when 'person'  then (select coalesce(nullif(btrim(rp3.full_name), ''), 'Profilo')
                           from public.profiles rp3 where rp3.id = s.reply_to_identity_id)
    end as nm
  ) rtn on true;
$$;


-- ============================================================
-- SEZIONE 5 — Mi piace ai commenti e lettori server riemessi
--
-- Ogni funzione riemessa sotto parte dalla definizione EFFETTIVA nel database
-- dopo tutte le migrazioni (pg_get_functiondef: HOM-07 per footme_post_payloads,
-- footme_content_interaction_rows, media_content_engagement, footme_content_readable,
-- set_content_like, list_content_likers; HOM-05 per footme_content_interaction_kinds),
-- non da una migrazione vecchia, con le sole modifiche dichiarate nel commento
-- che la precede.
-- ============================================================

-- 5-0. Un commento è «interattivo» (Mi piace, Rispondi) per il viewer se è
--      leggibile E i commenti del contenuto sono abilitati (§178–§180). È il
--      ramo 'comment' di footme_content_readable.
create or replace function public.footme_comment_interactive(p_viewer uuid, p_comment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.footme_comment_readable(p_viewer, p_comment_id)
     and exists (
       select 1
       from public.content_comments cc
       cross join lateral public.footme_comment_settings(cc.content_type, cc.content_id) st
       where cc.id = p_comment_id and st.s_enabled);
$$;

-- Evento COMMENT_LIKED, scritto da set_content_like solo all'inserimento reale
-- (non su conflict). comment_id e target_comment_id sono il commento che ha
-- ricevuto il Mi piace; il destinatario è la sua identità autrice.
create or replace function public.footme_comment_like_event(
  p_comment_id uuid,
  p_actor_type text,
  p_actor_id   uuid,
  p_acted_by   uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_c public.content_comments%rowtype;
begin
  select * into v_c from public.content_comments cc where cc.id = p_comment_id and cc.status = 'active';
  if not found then
    return;
  end if;

  perform public.footme_comment_event(
    'COMMENT_LIKED', v_c.content_type, v_c.content_id,
    coalesce(v_c.root_comment_id, v_c.id), v_c.id, v_c.id,
    p_actor_type, p_actor_id, p_acted_by, v_c.author_type, v_c.author_id);
end;
$$;

-- Le funzioni interne di questa migrazione non sono eseguibili dai client:
-- le chiamano le RPC (security definer) e basta.
do $$
declare
  v_fn record;
begin
  for v_fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in (
        'footme_comment_limits', 'footme_comment_settings', 'footme_comment_row_visible',
        'footme_visible_comments', 'footme_comments_count', 'footme_comment_replies_count',
        'footme_comment_readable', 'footme_content_publisher', 'footme_comment_mention_identity',
        'footme_comment_event', 'footme_comment_purge_side_data', 'content_comments_after_delete',
        'footme_comment_remove', 'content_comments_cleanup_author', 'content_comments_cleanup_content',
        'footme_comment_normalize', 'footme_comment_mentions_partial', 'footme_comment_author_meta', 'footme_comment_cards', 'footme_comment_interactive',
        'footme_comment_like_event')
  loop
    execute format('revoke all on function %s from public', v_fn.sig);
    execute format('revoke execute on function %s from anon, authenticated', v_fn.sig);
  end loop;
end
$$;

-- 5-1. footme_content_readable: nuovo ramo 'comment' (§70–§78, §221). Per un
--      commento «leggibile» significa interattivo: leggibile E commenti
--      abilitati. Il resto è identico alla definizione di HOM-07.
CREATE OR REPLACE FUNCTION public.footme_content_readable(p_viewer uuid, p_content_type text, p_post_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when p_content_type = 'comment' then public.footme_comment_interactive(p_viewer, p_post_id)
    else exists (
    select 1
    from public.footme_readable_content rc
    where rc.content_type = p_content_type
      and rc.post_id = p_post_id
      and not public.footme_publisher_blocked(p_viewer, rc.publisher_type, rc.publisher_id)
  ) end;
$function$;

revoke all on function public.footme_content_readable(uuid, text, uuid) from public;
revoke execute on function public.footme_content_readable(uuid, text, uuid) from anon, authenticated;

-- 5-2. footme_post_payloads (sorgente: HOM-07, 20261122090000).
--      * comments_count: da footme_visible_comments, non più dalle cinque
--        tabelle legacy (root + risposte attivi e visibili);
--      * can_comment: contenuto leggibile E commenti abilitati E almeno un'identità
--        con cui commentare (prima: ogni tipo tranne profile_post) — ora vero anche
--        per il Post persona;
--      * nuovo campo comments_enabled.
--      Nient'altro cambia (verificato per differenza con la definizione di partenza).
CREATE OR REPLACE FUNCTION public.footme_post_payloads(p_viewer uuid, p_content_types text[], p_post_ids uuid[])
 RETURNS TABLE(r_content_type text, r_post_id uuid, payload jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- HOM-07: i Mi piace da footme_visible_likes (definizione unica di «chi ha
  -- messo Mi piace»: attori esistenti, non sospesi, non bloccati con il viewer)
  -- e, per il viewer, le sole sue identità di interazione che hanno messo Mi
  -- piace. Nessuna identità altrui esce dal payload.
  likes_agg as (
    select
      vl.v_content_type as content_type,
      vl.v_post_id      as post_id,
      count(*)::int     as n,
      coalesce(
        jsonb_agg(
          jsonb_build_object('type', vl.v_actor_type, 'id', vl.v_actor_id)
          order by vl.v_created_at, vl.v_actor_type, vl.v_actor_id
        ) filter (where mi.c_id is not null),
        '[]'::jsonb
      ) as liked_as
    from (
      select
        array_agg(b.content_type order by b.content_type, b.post_id) as cts,
        array_agg(b.post_id      order by b.content_type, b.post_id) as pids
      from base b
    ) k
    cross join lateral public.footme_visible_likes(p_viewer, k.cts, k.pids) vl
    left join public.footme_interaction_identities(p_viewer) mi
      on mi.c_type = vl.v_actor_type and mi.c_id = vl.v_actor_id
    group by vl.v_content_type, vl.v_post_id
  ),

  -- HOM-07 §133: lo stato Salvato del viewer sui sei contenuti salvabili.
  saved_agg as (
    select sv.content_type, sv.post_id
    from (
      select 'club_media'::text as content_type, x.post_id
      from public.saved_club_media x
      join base b on b.content_type = 'club_media' and b.post_id = x.post_id
      where x.profile_id = p_viewer
      union all
      select 'media_profile', x.post_id
      from public.saved_media_profile_posts x
      join base b on b.content_type = 'media_profile' and b.post_id = x.post_id
      where x.profile_id = p_viewer
      union all
      select 'media_tribuna', x.post_id
      from public.saved_media_tribuna x
      join base b on b.content_type = 'media_tribuna' and b.post_id = x.post_id
      where x.profile_id = p_viewer
      union all
      select 'fan_tribuna', x.post_id
      from public.saved_fan_tribuna x
      join base b on b.content_type = 'fan_tribuna' and b.post_id = x.post_id
      where x.profile_id = p_viewer
      union all
      select 'fan_media', x.post_id
      from public.saved_fan_media x
      join base b on b.content_type = 'fan_media' and b.post_id = x.post_id
      where x.profile_id = p_viewer
      union all
      select 'profile_post', x.post_id
      from public.saved_profile_posts x
      join base b on b.content_type = 'profile_post' and b.post_id = x.post_id
      where x.profile_id = p_viewer
    ) sv
  ),

  -- HOM-08: i commenti da footme_visible_comments (definizione unica di «commento
  -- visibile al viewer»: root + risposte attivi, autore visibile, tombstone e
  -- placeholder mai contati; commenti nascosti = 0).
  comments_agg as (
    select vc.content_type, vc.content_id as post_id, count(*)::int as n
    from (
      select
        array_agg(b.content_type order by b.content_type, b.post_id) as cts,
        array_agg(b.post_id      order by b.content_type, b.post_id) as pids
      from base b
    ) k
    cross join lateral public.footme_visible_comments(p_viewer, k.cts, k.pids) vc
    group by vc.content_type, vc.content_id
  ),

  -- HOM-08: can_comment richiede almeno un'identità con cui commentare (§42–§43).
  has_identity as (
    select exists (select 1 from public.footme_interaction_identities(p_viewer)) as yes
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
      'comments_enabled', coalesce(cs.comments_enabled, true),
      'is_liked',       jsonb_array_length(coalesce(la.liked_as, '[]'::jsonb)) > 0,
      'liked_as',       coalesce(la.liked_as, '[]'::jsonb),
      'is_saved',       sa.post_id is not null,
      'capabilities', jsonb_build_object(
        'can_like',          a.content_type in ('club_media', 'fan_media', 'profile_post', 'media_profile'),
        'can_comment',       public.footme_content_readable(p_viewer, a.content_type, a.post_id)
                             and coalesce(cs.comments_enabled, true) and hid.yes,
        'can_share',         true,
        'can_save',          true,
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
  cross join has_identity hid
  -- HOM-04: capability e versione dalla regola unica footme_content_rights,
  -- una sola chiamata per elemento. Non passa da content_manage_capabilities,
  -- che solleva senza sessione: il Feed resta leggibile anche senza utente.
  -- Lo stato 'published' è già garantito da base, quindi i r_can_* bastano.
  -- footme_content_rights usa auth.uid(); i chiamanti passano p_viewer = auth.uid().
  left join lateral public.footme_content_rights(a.content_type, a.post_id) cr on true
  left join media_agg ma    on ma.content_type = a.content_type and ma.post_id = a.post_id
  left join likes_agg la    on la.content_type = a.content_type and la.post_id = a.post_id
  left join saved_agg sa    on sa.content_type = a.content_type and sa.post_id = a.post_id
  left join comments_agg ca on ca.content_type = a.content_type and ca.post_id = a.post_id
  left join public.content_comment_settings cs
    on cs.content_type = a.content_type and cs.content_id = a.post_id
  left join tags_agg ta     on ta.content_type = a.content_type and ta.post_id = a.post_id
  left join public.content_post_extras ex
    on ex.content_type = a.content_type and ex.post_id = a.post_id;
$function$;

-- 5-3. footme_content_interaction_kinds (sorgente: HOM-05, 20261119090000): il
--      Post persona ora ha commenti (§216) — solo questa riga cambia.
CREATE OR REPLACE FUNCTION public.footme_content_interaction_kinds(p_content_type text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p_content_type
    when 'club_media'     then array['like', 'comment', 'save']
    when 'media_profile'  then array['like', 'comment', 'save']
    when 'fan_media'      then array['like', 'comment', 'save']
    when 'media_tribuna'  then array['comment', 'save']
    when 'fan_tribuna'    then array['comment', 'save']
    when 'profile_post'   then array['like', 'comment']
    else array[]::text[]
  end;
$function$;

-- 5-4. footme_content_interaction_rows (sorgente: HOM-07): le cinque union
--      sui commenti legacy diventano UNA riga dal dominio unico, con viewer null
--      (Insights è dell'autore: nessun blocco, ma autori eliminati/sospesi fuori).
--      Solo aggregati: nessuna identità esce da qui.
CREATE OR REPLACE FUNCTION public.footme_content_interaction_rows(p_content_type text, p_post_id uuid)
 RETURNS TABLE(i_kind text, i_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select 'like'::text, v.v_created_at
    from public.footme_visible_likes(null, array[p_content_type], array[p_post_id]) v
  union all
  select 'comment', v.created_at
    from public.footme_visible_comments(null, array[p_content_type], array[p_post_id]) v
  union all
  select 'save', x.created_at from public.saved_club_media x
    where p_content_type = 'club_media' and x.post_id = p_post_id
  union all
  select 'save', x.created_at from public.saved_media_profile_posts x
    where p_content_type = 'media_profile' and x.post_id = p_post_id
  union all
  select 'save', x.created_at from public.saved_media_tribuna x
    where p_content_type = 'media_tribuna' and x.post_id = p_post_id
  union all
  select 'save', x.created_at from public.saved_fan_tribuna x
    where p_content_type = 'fan_tribuna' and x.post_id = p_post_id
  union all
  select 'save', x.created_at from public.saved_fan_media x
    where p_content_type = 'fan_media' and x.post_id = p_post_id
  union all
  select 'save', x.created_at from public.saved_profile_posts x
    where p_content_type = 'profile_post' and x.post_id = p_post_id;
$function$;

-- 5-5. media_content_engagement (sorgente: HOM-07; alimenta il ranking del Feed e
--      media_content_index): stessa forma e stessa semantica, ma i commenti
--      arrivano dal dominio unico (solo attivi: un tombstone non è engagement)
--      per gli stessi cinque tipi di prima. Il Post persona non entra in questa
--      vista, come prima. Deve precedere il drop delle tabelle legacy.
create or replace view public.media_content_engagement as
select e.content_type, e.post_id, sum(e.n)::integer as engagement_count
from (
  select 'club_media'::text as content_type, cl.post_id, count(*) as n
    from public.content_likes cl where cl.content_type = 'club_media' group by cl.post_id
  union all
  select cc.content_type, cc.content_id, count(*) from public.content_comments cc
    where cc.status = 'active'
      and cc.content_type in ('club_media', 'media_profile', 'fan_tribuna', 'media_tribuna', 'fan_media')
    group by cc.content_type, cc.content_id
  union all
  select 'fan_tribuna', v.post_id, count(*) from public.fan_tribuna_poll_votes v group by v.post_id
  union all
  select 'fan_tribuna', v.post_id, count(*) from public.fan_tribuna_support_votes v group by v.post_id
  union all
  select 'media_tribuna', v.post_id, count(*) from public.media_tribuna_option_votes v group by v.post_id
  union all
  select 'fan_media', cl.post_id, count(*) from public.content_likes cl where cl.content_type = 'fan_media' group by cl.post_id

) e
group by e.content_type, e.post_id;

-- 5-6. set_content_like (sorgente: HOM-07): la whitelist accetta 'comment'; per
--      un commento scrive l'evento COMMENT_LIKED all'inserimento reale. Errori
--      invariati: content_unavailable copre il commento eliminato (§221).
CREATE OR REPLACE FUNCTION public.set_content_like(p_content_type text, p_post_id uuid, p_liked boolean, p_identity_type text, p_identity_id uuid)
 RETURNS TABLE(likes_count bigint, is_liked boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid   uuid := auth.uid();
  v_count bigint;
  v_liked boolean;
  v_readable boolean;
  v_inserted integer;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_liked is null then
    raise exception 'Stato del Mi piace mancante' using errcode = '22023';
  end if;

  if p_content_type is null
     or p_content_type not in ('club_media', 'fan_media', 'profile_post', 'media_profile', 'comment') then
    raise exception 'like_content_type_unsupported' using errcode = '22023';
  end if;

  if p_identity_type is null or p_identity_id is null or not exists (
    select 1 from public.footme_interaction_identities(v_uid) i
    where i.c_type = p_identity_type and i.c_id = p_identity_id
  ) then
    raise exception 'like_identity_forbidden' using errcode = '42501';
  end if;

  v_readable := public.footme_content_readable(v_uid, p_content_type, p_post_id);

  if p_liked and not v_readable then
    raise exception 'content_unavailable' using errcode = 'P0002';
  end if;

  if p_liked then
    insert into public.content_likes as cl (content_type, post_id, actor_type, actor_id, acted_by)
    values (p_content_type, p_post_id, p_identity_type, p_identity_id, v_uid)
    on conflict do nothing;
    get diagnostics v_inserted = row_count;
    -- HOM-08 §200–§208: COMMENT_LIKED solo all'inserimento reale, mai su conflict.
    if v_inserted > 0 and p_content_type = 'comment' then
      perform public.footme_comment_like_event(p_post_id, p_identity_type, p_identity_id, v_uid);
    end if;
  else
    delete from public.content_likes cl
    where cl.content_type = p_content_type
      and cl.post_id = p_post_id
      and cl.actor_type = p_identity_type
      and cl.actor_id = p_identity_id;
  end if;

  if v_readable then
    select count(*) into v_count
    from public.footme_visible_likes(v_uid, array[p_content_type], array[p_post_id]);
  else
    v_count := 0;
  end if;

  select exists (
    select 1 from public.content_likes cl
    where cl.content_type = p_content_type
      and cl.post_id = p_post_id
      and cl.actor_type = p_identity_type
      and cl.actor_id = p_identity_id
  ) into v_liked;

  return query select v_count, v_liked;
end;
$function$;

revoke all on function public.set_content_like(text, uuid, boolean, text, uuid) from public;
revoke execute on function public.set_content_like(text, uuid, boolean, text, uuid) from anon;
grant execute on function public.set_content_like(text, uuid, boolean, text, uuid) to authenticated;

-- 5-7. list_content_likers (sorgente: HOM-07): la whitelist accetta 'comment'
--      (la lista dei Mi piace di un commento, §75–§76). Nient'altro cambia.
CREATE OR REPLACE FUNCTION public.list_content_likers(p_content_type text, p_post_id uuid, p_cursor jsonb DEFAULT NULL::jsonb, p_limit integer DEFAULT 30)
 RETURNS TABLE(actor_type text, actor_id uuid, name text, avatar_url text, is_verified boolean, role text, club_name text, team_label text, club_category text, media_kind text, primary_position text, is_self boolean, is_following boolean, next_cursor jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_uid    uuid := auth.uid();
  v_limit  integer := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_cb     integer;
  v_cts    timestamptz;
  v_ct     text;
  v_cid    uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_content_type is null
     or p_content_type not in ('club_media', 'fan_media', 'profile_post', 'media_profile', 'comment') then
    raise exception 'like_content_type_unsupported' using errcode = '22023';
  end if;

  if not public.footme_content_readable(v_uid, p_content_type, p_post_id) then
    raise exception 'content_unavailable' using errcode = 'P0002';
  end if;

  if p_cursor is not null then
    begin
      v_cb  := (p_cursor ->> 'b')::integer;
      v_cts := (p_cursor ->> 'ts')::timestamptz;
      v_ct  := p_cursor ->> 't';
      v_cid := (p_cursor ->> 'id')::uuid;
    exception when others then
      raise exception 'likes_invalid_cursor' using errcode = '22023';
    end;
    if v_cb is null or v_cts is null or v_ct is null or v_cid is null then
      raise exception 'likes_invalid_cursor' using errcode = '22023';
    end if;
  end if;

  return query
  with mine as (
    select i.c_type, i.c_id from public.footme_interaction_identities(v_uid) i
  ),
  likers as (
    select
      vl.v_actor_type as a_type,
      vl.v_actor_id   as a_id,
      vl.v_created_at as a_ts,
      case
        when vl.v_actor_type = 'society' then exists (
          select 1 from public.club_follows f
          where f.profile_id = v_uid and f.club_id = vl.v_actor_id)
        else exists (
          select 1 from public.profile_follows f
          where f.follower_profile_id = v_uid and f.followed_profile_id = vl.v_actor_id)
      end as a_following
    from public.footme_visible_likes(v_uid, array[p_content_type], array[p_post_id]) vl
  ),
  ranked as (
    select l.a_type, l.a_id, l.a_ts, l.a_following,
           case when l.a_following then 0 else 1 end as a_bucket
    from likers l
  ),
  page as (
    select r.*
    from ranked r
    where p_cursor is null
       or r.a_bucket > v_cb
       or (r.a_bucket = v_cb and r.a_ts < v_cts)
       or (r.a_bucket = v_cb and r.a_ts = v_cts and r.a_type > v_ct)
       or (r.a_bucket = v_cb and r.a_ts = v_cts and r.a_type = v_ct and r.a_id > v_cid)
    order by r.a_bucket, r.a_ts desc, r.a_type, r.a_id
    limit v_limit + 1
  ),
  numbered as (
    select pg.*, row_number() over (order by pg.a_bucket, pg.a_ts desc, pg.a_type, pg.a_id) as rn
    from page pg
  ),
  shown as (
    select n.* from numbered n where n.rn <= v_limit
  )
  select
    s.a_type,
    s.a_id,
    case s.a_type
      when 'society' then c.name
      when 'media'   then coalesce(nullif(btrim(mp.entity_name), ''), nullif(btrim(p.full_name), ''), 'Media')
      else coalesce(nullif(btrim(p.full_name), ''), 'Profilo')
    end,
    case s.a_type
      when 'society' then c.logo_url
      when 'media'   then coalesce(mp.logo_url, p.avatar_url)
      else p.avatar_url
    end,
    case s.a_type
      when 'society' then c.verification_status = 'verified'
      when 'media'   then coalesce(mp.verification_status = 'verified', false)
      else false
    end,
    case when s.a_type = 'society' then null else p.role::text end,
    case when s.a_type = 'person' then cur.club_name end,
    case when s.a_type = 'person' then cur.team_label end,
    case when s.a_type = 'society' then c.category end,
    case when s.a_type = 'media' then coalesce(mp.media_kind, 'pagina') end,
    case when s.a_type = 'person' and p.role::text = 'player' then pl.primary_position::text end,
    exists (select 1 from mine m where m.c_type = s.a_type and m.c_id = s.a_id),
    s.a_following,
    case
      when s.rn = v_limit and (select count(*) from numbered) > v_limit
        then jsonb_build_object('b', s.a_bucket, 'ts', s.a_ts, 't', s.a_type, 'id', s.a_id)
    end
  from shown s
  left join public.clubs c           on s.a_type = 'society' and c.id = s.a_id
  left join public.profiles p        on s.a_type in ('person', 'media') and p.id = s.a_id
  left join public.media_profiles mp on s.a_type = 'media' and mp.profile_id = s.a_id
  left join public.player_profiles pl on s.a_type = 'person' and pl.profile_id = s.a_id
  left join lateral (
    select cl.name as club_name, ct.name as team_label
    from public.club_members cm
    join public.clubs cl on cl.id = cm.club_id
    left join public.club_teams ct on ct.id = cm.team_id
    where s.a_type = 'person'
      and cm.profile_id = s.a_id
      and cm.status = 'active'
      and cm.is_current = true
    order by cm.created_at desc
    limit 1
  ) cur on true
  order by s.rn;
end;
$function$;

revoke all on function public.list_content_likers(text, uuid, jsonb, integer) from public;
revoke execute on function public.list_content_likers(text, uuid, jsonb, integer) from anon;
grant execute on function public.list_content_likers(text, uuid, jsonb, integer) to authenticated;


-- ============================================================
-- SEZIONE 6 — RPC per il client (§A5). Tutte security definer, revoke da
-- public e da anon, execute a authenticated, auth.uid() controllato nel corpo.
--
-- CODICI ERRORE (nel message, come composer-types.ts; `detail` solo dove
-- indicato):
--   content_unavailable          P0002  contenuto non leggibile ORA
--   comment_unavailable          P0002  commento inesistente / eliminato / non leggibile
--   comment_target_unavailable   P0002  la risposta punta a un commento non più disponibile
--   comment_identity_forbidden   42501  identità non tra quelle di interazione dell'utente
--   comment_forbidden            42501  non è l'autore (identità) del commento
--   comments_disabled            55000  commenti disattivati per il contenuto
--   comment_invalid_body         22023  vuoto o di sole mention
--   comment_too_long             22023  oltre il limite
--   comment_invalid_mention      22023  detail = motivo
--   comment_version_conflict     40001  detail = versione corrente (§155)
--   comment_operation_conflict   40001  stessa chiave, payload diverso
--   comment_content_type_unsupported / comment_invalid_sort /
--   comment_invalid_cursor / comment_invalid_operation_key /
--   comment_invalid_since        22023
-- ============================================================

-- 6-1. Contesto del contenuto (§34, §178–§180).
create or replace function public.fetch_comment_context(p_content_type text, p_content_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_enabled    boolean;
  v_visibility text;
  v_pb_type    text;
  v_pb_id      uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_content_type is null
     or p_content_type not in ('club_media', 'media_profile', 'profile_post',
                               'fan_tribuna', 'media_tribuna', 'fan_media') then
    raise exception 'comment_content_type_unsupported' using errcode = '22023';
  end if;

  if not public.footme_content_readable(v_uid, p_content_type, p_content_id) then
    raise exception 'content_unavailable' using errcode = 'P0002';
  end if;

  select st.s_enabled, st.s_visibility into v_enabled, v_visibility
  from public.footme_comment_settings(p_content_type, p_content_id) st;

  select pb.pb_type, pb.pb_id into v_pb_type, v_pb_id
  from public.footme_content_publisher(p_content_type, p_content_id) pb;

  return jsonb_build_object(
    'comments_count',   public.footme_comments_count(v_uid, p_content_type, p_content_id),
    'comments_enabled', v_enabled,
    'comments_visible', v_enabled or v_visibility = 'visible',
    'as_of',            now(),
    'content_author',   jsonb_build_object('identity_type', v_pb_type, 'identity_id', v_pb_id),
    'limits',           public.footme_comment_limits(),
    'identities', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'identity_type',  c.card ->> 'identity_type',
                 'identity_id',    c.card ->> 'identity_id',
                 'name',           c.card ->> 'name',
                 'avatar_url',     c.card ->> 'avatar_url',
                 'is_verified',    coalesce((c.card ->> 'is_verified')::boolean, false),
                 'rank',           i.c_rank,
                 'can_comment',    v_enabled)
               -- role, club_name, team_label, club_category, media_kind, primary_position:
               -- la stessa definizione della scheda autore dei commenti.
               || public.footme_comment_author_meta(i.c_type, i.c_id)
               order by i.c_rank, i.c_id)
      from public.footme_interaction_identities(v_uid) i
      cross join lateral (
        select public.footme_composer_identity_card(i.c_type, i.c_id) as card
      ) c
      where c.card is not null
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.fetch_comment_context(text, uuid) from public;
revoke execute on function public.fetch_comment_context(text, uuid) from anon;
grant execute on function public.fetch_comment_context(text, uuid) to authenticated;

-- 6-2. Commenti principali (§89–§91, §121–§125, §130, §222).
--   'recent'   created_at desc, id desc; cursore {k, ts, id}.
--   'relevant' punteggio (1 + Mi piace + 2 × risposte) / (ore + 2)^1.5, con
--              Mi piace e risposte contati fino a `as_of`, che il cursore
--              congela alla prima pagina: nuovi Mi piace, nuove risposte e nuovi
--              commenti non spostano le pagine successive. Il decadimento fa sì
--              che un vecchio commento non resti in cima per sempre. Cursore
--              {k, as_of, s, ts, id}, keyset (s desc, ts desc, id desc). L'unico
--              modo di vedere una riga due volte è che il suo punteggio
--              CALI tra una pagina e l'altra (Mi piace tolto, utente
--              bloccato): il client deduplica per id.
--   Righe: i root attivi visibili e i root che il viewer non vede come
--   commento (tombstone, autore non visibile) ma che hanno risposte visibili:
--   per questi la scheda è il placeholder (status deleted / unavailable).
--   `as_of` (colonna in coda, uguale su ogni riga) è l'ora del SERVER della chiamata:
--   il client la usa come watermark di fetch_comment_updates, mai l'orologio del device.
--   `next_cursor` è valorizzato SOLO sull'ultima riga della pagina, e solo se
--   esistono altre righe (come list_content_likers).
create or replace function public.list_content_comments(
  p_content_type text,
  p_content_id   uuid,
  p_sort         text default 'relevant',
  p_cursor       jsonb default null,
  p_limit        integer default 20
)
returns table (comment jsonb, next_cursor jsonb, as_of timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid    uuid := auth.uid();
  v_limit  integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_sort   text := coalesce(p_sort, 'relevant');
  v_as_of  timestamptz;
  v_cs     numeric;
  v_cts    timestamptz;
  v_cid    uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_content_type is null
     or p_content_type not in ('club_media', 'media_profile', 'profile_post',
                               'fan_tribuna', 'media_tribuna', 'fan_media') then
    raise exception 'comment_content_type_unsupported' using errcode = '22023';
  end if;

  if v_sort not in ('relevant', 'recent') then
    raise exception 'comment_invalid_sort' using errcode = '22023';
  end if;

  if not public.footme_content_readable(v_uid, p_content_type, p_content_id) then
    raise exception 'content_unavailable' using errcode = 'P0002';
  end if;

  if p_cursor is not null then
    begin
      if p_cursor ->> 'k' is distinct from v_sort then
        raise exception 'mismatch';
      end if;
      v_cts := (p_cursor ->> 'ts')::timestamptz;
      v_cid := (p_cursor ->> 'id')::uuid;
      if v_sort = 'relevant' then
        v_as_of := (p_cursor ->> 'as_of')::timestamptz;
        v_cs    := (p_cursor ->> 's')::numeric;
      end if;
    exception when others then
      raise exception 'comment_invalid_cursor' using errcode = '22023';
    end;
    if v_cts is null or v_cid is null or not isfinite(v_cts)
       or (v_sort = 'relevant' and (v_as_of is null or v_cs is null or not isfinite(v_as_of) or v_cs = 'NaN'::numeric)) then
      raise exception 'comment_invalid_cursor' using errcode = '22023';
    end if;
  end if;

  if v_sort = 'relevant' and v_as_of is null then
    v_as_of := clock_timestamp();
  end if;

  return query
  with vis as materialized (
    select v.id as c_id, v.root_comment_id as c_root, v.created_at as c_ts
    from public.footme_visible_comments(v_uid, array[p_content_type], array[p_content_id]) v
  ),
  rep as (
    select vis.c_root as r_id,
           count(*)::integer as r_n,
           (count(*) filter (where v_as_of is null or vis.c_ts <= v_as_of))::integer as r_n_asof
    from vis
    where vis.c_root is not null
    group by vis.c_root
  ),
  vroots as (
    select vis.c_id from vis where vis.c_root is null
  ),
  lk as (
    select vl.v_post_id as l_id,
           (count(*) filter (where v_as_of is null or vl.v_created_at <= v_as_of))::integer as l_n
    from public.footme_visible_likes(
           v_uid,
           (select coalesce(array_agg('comment'::text), '{}'::text[]) from vroots),
           (select coalesce(array_agg(r.c_id), '{}'::uuid[]) from vroots r)) vl
    group by vl.v_post_id
  ),
  cand as (
    select
      cc.id as k_id,
      cc.created_at as k_ts,
      case when v_sort = 'relevant' then
        round(
          (1 + coalesce(lk.l_n, 0) + 2 * coalesce(rep.r_n_asof, 0))::numeric
          / power(
              (greatest(0, extract(epoch from (v_as_of - cc.created_at))) / 3600.0 + 2)::numeric,
              1.5::numeric),
          9)
      else 0::numeric end as k_score
    from public.content_comments cc
    left join rep on rep.r_id = cc.id
    left join lk on lk.l_id = cc.id
    where cc.content_type = p_content_type
      and cc.content_id = p_content_id
      and cc.root_comment_id is null
      and (cc.id in (select r.c_id from vroots r) or coalesce(rep.r_n, 0) > 0)
      and (v_sort <> 'relevant' or cc.created_at <= v_as_of)
  ),
  page as (
    select k.*
    from cand k
    where p_cursor is null
       or (v_sort = 'relevant' and k.k_score < v_cs)
       or (v_sort = 'relevant' and k.k_score = v_cs and k.k_ts < v_cts)
       or (v_sort = 'relevant' and k.k_score = v_cs and k.k_ts = v_cts and k.k_id < v_cid)
       or (v_sort = 'recent' and k.k_ts < v_cts)
       or (v_sort = 'recent' and k.k_ts = v_cts and k.k_id < v_cid)
    order by k.k_score desc, k.k_ts desc, k.k_id desc
    limit v_limit + 1
  ),
  numbered as (
    select pg.*, row_number() over (order by pg.k_score desc, pg.k_ts desc, pg.k_id desc) as rn
    from page pg
  ),
  shown as (
    select n.* from numbered n where n.rn <= v_limit
  )
  select
    cards.k_comment,
    case
      when s.rn = v_limit and (select count(*) from numbered) > v_limit then
        case v_sort
          when 'relevant' then jsonb_build_object('k', 'relevant', 'as_of', v_as_of,
                                                  's', s.k_score, 'ts', s.k_ts, 'id', s.k_id)
          else jsonb_build_object('k', 'recent', 'ts', s.k_ts, 'id', s.k_id)
        end
    end,
    now()
  from shown s
  join public.footme_comment_cards(
         v_uid, (select coalesce(array_agg(sh.k_id), '{}'::uuid[]) from shown sh)) cards
    on cards.k_id = s.k_id
  order by s.rn;
end;
$$;

revoke all on function public.list_content_comments(text, uuid, text, jsonb, integer) from public;
revoke execute on function public.list_content_comments(text, uuid, text, jsonb, integer) from anon;
grant execute on function public.list_content_comments(text, uuid, text, jsonb, integer) to authenticated;

-- 6-3. Risposte di un thread, dalla più vecchia (§126, §133–§135). Cursore
--      {ts, id}; `next_cursor` solo sull'ultima riga e solo se ce ne sono altre.
--      Il root deve esistere ed essere un root, il contenuto leggibile e i
--      commenti non nascosti, altrimenti comment_unavailable.
create or replace function public.list_comment_replies(
  p_root_comment_id uuid,
  p_cursor          jsonb default null,
  p_limit           integer default 10
)
returns table (comment jsonb, next_cursor jsonb, as_of timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid   uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_root  public.content_comments%rowtype;
  v_cts   timestamptz;
  v_cid   uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_root from public.content_comments cc
  where cc.id = p_root_comment_id and cc.root_comment_id is null;

  if not found
     or not public.footme_content_readable(v_uid, v_root.content_type, v_root.content_id)
     or exists (select 1 from public.content_comment_settings s
                where s.content_type = v_root.content_type and s.content_id = v_root.content_id
                  and not s.comments_enabled and s.existing_visibility = 'hidden') then
    raise exception 'comment_unavailable' using errcode = 'P0002';
  end if;

  if p_cursor is not null then
    begin
      v_cts := (p_cursor ->> 'ts')::timestamptz;
      v_cid := (p_cursor ->> 'id')::uuid;
    exception when others then
      raise exception 'comment_invalid_cursor' using errcode = '22023';
    end;
    if v_cts is null or v_cid is null or not isfinite(v_cts) then
      raise exception 'comment_invalid_cursor' using errcode = '22023';
    end if;
  end if;

  return query
  with page as (
    select r.id as k_id, r.created_at as k_ts
    from public.footme_visible_comments(
           v_uid, array[v_root.content_type], array[v_root.content_id], array[v_root.id]) r
    where p_cursor is null
       or r.created_at > v_cts
       or (r.created_at = v_cts and r.id > v_cid)
    order by r.created_at, r.id
    limit v_limit + 1
  ),
  numbered as (
    select pg.*, row_number() over (order by pg.k_ts, pg.k_id) as rn from page pg
  ),
  shown as (
    select n.* from numbered n where n.rn <= v_limit
  )
  select
    cards.k_comment,
    case
      when s.rn = v_limit and (select count(*) from numbered) > v_limit
        then jsonb_build_object('ts', s.k_ts, 'id', s.k_id)
    end,
    now()
  from shown s
  join public.footme_comment_cards(
         v_uid, (select coalesce(array_agg(sh.k_id), '{}'::uuid[]) from shown sh)) cards
    on cards.k_id = s.k_id
  order by s.rn;
end;
$$;

revoke all on function public.list_comment_replies(uuid, jsonb, integer) from public;
revoke execute on function public.list_comment_replies(uuid, jsonb, integer) from anon;
grant execute on function public.list_comment_replies(uuid, jsonb, integer) to authenticated;

-- 6-4. Crea un commento o una risposta (§12–§24, §42–§44, §86–§101, §192–§194).
--      Il parametro con default non può precedere uno senza: dopo
--      p_reply_to_comment_id ogni parametro ha un default (il client chiama
--      con argomenti con nome). p_operation_key è comunque obbligatorio.
--      Ordine dei controlli: sessione; chiave; (replay idempotente); identità
--      di interazione dell'utente ADESSO; contenuto leggibile; commenti
--      abilitati; target della risposta; testo. Una risposta a una risposta ha
--      come root il root del thread e reply_to il commento preciso (un solo
--      livello, §50–§51).
create or replace function public.create_comment(
  p_content_type        text,
  p_content_id          uuid,
  p_reply_to_comment_id uuid  default null,
  p_body                text  default null,
  p_mentions            jsonb default '[]'::jsonb,
  p_links               jsonb default '[]'::jsonb,
  p_identity_type       text  default null,
  p_identity_id         uuid  default null,
  p_operation_key       text  default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_hash     text;
  v_prev     public.content_comments%rowtype;
  v_op       public.content_comment_operations%rowtype;
  v_target   public.content_comments%rowtype;
  v_root     uuid;
  v_enabled  boolean;
  v_norm     jsonb;
  v_id       uuid := gen_random_uuid();
  v_pb_type  text;
  v_pb_id    uuid;
  v_t_type   text;
  v_t_id     uuid;
  v_m        jsonb;
  v_comment  public.content_comments%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_operation_key is null or btrim(p_operation_key) = '' or char_length(p_operation_key) > 128 then
    raise exception 'comment_invalid_operation_key' using errcode = '22023';
  end if;

  if p_content_type is null
     or p_content_type not in ('club_media', 'media_profile', 'profile_post',
                               'fan_tribuna', 'media_tribuna', 'fan_media') then
    raise exception 'comment_content_type_unsupported' using errcode = '22023';
  end if;

  -- Idempotenza (§92–§95): un solo inserimento alla volta per (utente, chiave).
  perform pg_advisory_xact_lock(hashtext('create_comment:' || v_uid::text || ':' || p_operation_key));

  v_hash := md5(jsonb_build_array(
    p_content_type, p_content_id, p_reply_to_comment_id, p_body,
    coalesce(p_mentions, '[]'::jsonb), coalesce(p_links, '[]'::jsonb),
    p_identity_type, p_identity_id)::text);

  -- Il registro delle chiavi sopravvive al commento: la chiave di un commento poi
  -- eliminato non lo resuscita, risponde comment_unavailable.
  select * into v_op from public.content_comment_operations o
  where o.acted_by = v_uid and o.operation_key = p_operation_key;

  if found then
    if v_op.comment_id is null then
      raise exception 'comment_unavailable' using errcode = 'P0002';
    end if;
    select * into v_prev from public.content_comments cc
    where cc.id = v_op.comment_id and cc.status = 'active';
    if not found then
      raise exception 'comment_unavailable' using errcode = 'P0002';
    end if;
    if v_op.payload_hash is distinct from v_hash then
      raise exception 'comment_operation_conflict' using errcode = '40001';
    end if;
    return jsonb_build_object(
      'comment', (select k.k_comment from public.footme_comment_cards(v_uid, array[v_prev.id]) k),
      'comments_count', public.footme_comments_count(v_uid, v_prev.content_type, v_prev.content_id),
      'root_replies_count',
        public.footme_comment_replies_count(v_uid, coalesce(v_prev.root_comment_id, v_prev.id)));
  end if;

  if p_identity_type is null or p_identity_id is null or not exists (
    select 1 from public.footme_interaction_identities(v_uid) i
    where i.c_type = p_identity_type and i.c_id = p_identity_id
  ) then
    raise exception 'comment_identity_forbidden' using errcode = '42501';
  end if;

  if not public.footme_content_readable(v_uid, p_content_type, p_content_id) then
    raise exception 'content_unavailable' using errcode = 'P0002';
  end if;

  select st.s_enabled into v_enabled
  from public.footme_comment_settings(p_content_type, p_content_id) st;
  if not v_enabled then
    raise exception 'comments_disabled' using errcode = '55000';
  end if;

  if p_reply_to_comment_id is not null then
    select * into v_target from public.content_comments cc
    where cc.id = p_reply_to_comment_id
      and cc.content_type = p_content_type
      and cc.content_id = p_content_id
      and cc.status = 'active'
      and public.footme_comment_row_visible(
            v_uid, cc.status, cc.author_type, cc.author_id, cc.content_type, cc.content_id);
    if not found then
      raise exception 'comment_target_unavailable' using errcode = 'P0002';
    end if;

    v_root := coalesce(v_target.root_comment_id, v_target.id);

    -- Il root non sparisce sotto una risposta in arrivo (footme_comment_remove
    -- lo prende in update).
    perform 1 from public.content_comments r where r.id = v_root for share;
    if not found then
      raise exception 'comment_target_unavailable' using errcode = 'P0002';
    end if;
    -- E il target non è stato eliminato nel frattempo.
    perform 1 from public.content_comments r where r.id = v_target.id and r.status = 'active';
    if not found then
      raise exception 'comment_target_unavailable' using errcode = 'P0002';
    end if;
  end if;

  v_norm := public.footme_comment_normalize(p_body, p_mentions, p_links);

  insert into public.content_comments
    (id, content_type, content_id, root_comment_id, reply_to_comment_id,
     reply_to_identity_type, reply_to_identity_id, author_type, author_id, acted_by,
     body, mentions, links, operation_key, payload_hash)
  values
    (v_id, p_content_type, p_content_id, v_root, v_target.id,
     v_target.author_type, v_target.author_id, p_identity_type, p_identity_id, v_uid,
     p_body, v_norm -> 'mentions', v_norm -> 'links', p_operation_key, v_hash)
  returning * into v_comment;

  insert into public.content_comment_operations (acted_by, operation_key, payload_hash, comment_id)
  values (v_uid, p_operation_key, v_hash, v_id);

  -- Eventi di dominio (§200–§208): niente testo, nessuna notifica qui.
  if v_target.id is null then
    select pb.pb_type, pb.pb_id into v_pb_type, v_pb_id
    from public.footme_content_publisher(p_content_type, p_content_id) pb;
    perform public.footme_comment_event(
      'COMMENT_CREATED', p_content_type, p_content_id, v_id, v_id, null,
      p_identity_type, p_identity_id, v_uid, v_pb_type, v_pb_id);
  else
    perform public.footme_comment_event(
      'REPLY_CREATED', p_content_type, p_content_id, v_root, v_id, v_target.id,
      p_identity_type, p_identity_id, v_uid, v_target.author_type, v_target.author_id);
  end if;

  -- Un evento per identità menzionata (due range sulla stessa identità = uno).
  for v_m in
    select distinct on (m ->> 'identity_type', m ->> 'identity_id') m
    from jsonb_array_elements(v_comment.mentions) m
    order by m ->> 'identity_type', m ->> 'identity_id', (m ->> 'start')::integer
  loop
    v_t_type := public.footme_comment_mention_identity(v_m ->> 'identity_type', (v_m ->> 'identity_id')::uuid);
    v_t_id   := (v_m ->> 'identity_id')::uuid;
    perform public.footme_comment_event(
      'COMMENT_MENTION_CREATED', p_content_type, p_content_id, coalesce(v_root, v_id), v_id, null,
      p_identity_type, p_identity_id, v_uid, v_t_type, v_t_id);
  end loop;

  return jsonb_build_object(
    'comment', (select k.k_comment from public.footme_comment_cards(v_uid, array[v_id]) k),
    'comments_count', public.footme_comments_count(v_uid, p_content_type, p_content_id),
    'root_replies_count', public.footme_comment_replies_count(v_uid, coalesce(v_root, v_id)));
end;
$$;

revoke all on function public.create_comment(text, uuid, uuid, text, jsonb, jsonb, text, uuid, text) from public;
revoke execute on function public.create_comment(text, uuid, uuid, text, jsonb, jsonb, text, uuid, text) from anon;
grant execute on function public.create_comment(text, uuid, uuid, text, jsonb, jsonb, text, uuid, text) to authenticated;

-- 6-5. Modifica (§146–§159). Solo l'autore (identità) la modifica (decisioni 1
--      e 2), con commento attivo, contenuto leggibile e commenti abilitati.
--      CAS sulla versione: diversa → comment_version_conflict con la versione
--      corrente nel detail (§155). Testo, mention e link identici = nessuna
--      modifica (niente salto di versione, niente «Modificato»). Un evento
--      MENTION solo per le mention NUOVE. acted_by non cambia: è chi ha creato
--      il commento, e la sua operation_key resta sua.
create or replace function public.update_comment(
  p_comment_id       uuid,
  p_expected_version integer,
  p_body             text,
  p_mentions         jsonb default '[]'::jsonb,
  p_links            jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_c       public.content_comments%rowtype;
  v_enabled boolean;
  v_norm    jsonb;
  v_m       jsonb;
  v_t_id    uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_c from public.content_comments cc where cc.id = p_comment_id for update;

  if not found
     or v_c.status <> 'active'
     or not public.footme_content_readable(v_uid, v_c.content_type, v_c.content_id) then
    raise exception 'comment_unavailable' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.footme_interaction_identities(v_uid) i
    where i.c_type = v_c.author_type and i.c_id = v_c.author_id
  ) then
    raise exception 'comment_forbidden' using errcode = '42501';
  end if;

  select st.s_enabled into v_enabled
  from public.footme_comment_settings(v_c.content_type, v_c.content_id) st;
  if not v_enabled then
    raise exception 'comments_disabled' using errcode = '55000';
  end if;

  -- Mention già salvate: non si rivalidano contro l'identità (v_c.mentions).
  v_norm := public.footme_comment_normalize(p_body, p_mentions, p_links, v_c.mentions);

  -- Ritentativo dopo un timeout: se ciò che si chiede coincide già con lo stato
  -- corrente, la risposta è la scheda corrente PRIMA del controllo di versione
  -- (nessun falso conflitto, nessun salto di versione).
  if p_body is not distinct from v_c.body
     and (v_norm -> 'mentions') is not distinct from v_c.mentions
     and (v_norm -> 'links') is not distinct from v_c.links then
    return jsonb_build_object(
      'comment', (select k.k_comment from public.footme_comment_cards(v_uid, array[v_c.id]) k));
  end if;

  if p_expected_version is null or v_c.version <> p_expected_version then
    raise exception 'comment_version_conflict' using errcode = '40001', detail = v_c.version::text;
  end if;

  begin
    update public.content_comments cc
    set body = p_body,
        mentions = v_norm -> 'mentions',
        links = v_norm -> 'links',
        version = cc.version + 1,
        edited_at = now(),
        updated_at = now()
    where cc.id = v_c.id;

    for v_m in
      select distinct on (m ->> 'identity_type', m ->> 'identity_id') m
      from jsonb_array_elements(v_norm -> 'mentions') m
      where not exists (
        select 1 from jsonb_array_elements(v_c.mentions) o
        where o ->> 'identity_type' = m ->> 'identity_type'
          and o ->> 'identity_id' = m ->> 'identity_id')
      order by m ->> 'identity_type', m ->> 'identity_id', (m ->> 'start')::integer
    loop
      v_t_id := (v_m ->> 'identity_id')::uuid;
      perform public.footme_comment_event(
        'COMMENT_MENTION_CREATED', v_c.content_type, v_c.content_id,
        coalesce(v_c.root_comment_id, v_c.id), v_c.id, null,
        v_c.author_type, v_c.author_id, v_uid,
        public.footme_comment_mention_identity(v_m ->> 'identity_type', v_t_id), v_t_id);
    end loop;
  end;

  return jsonb_build_object(
    'comment', (select k.k_comment from public.footme_comment_cards(v_uid, array[v_c.id]) k));
end;
$$;

revoke all on function public.update_comment(uuid, integer, text, jsonb, jsonb) from public;
revoke execute on function public.update_comment(uuid, integer, text, jsonb, jsonb) from anon;
grant execute on function public.update_comment(uuid, integer, text, jsonb, jsonb) to authenticated;

-- 6-6. Eliminazione (§160–§170, decisioni 1–3). Solo l'autore (identità), anche
--      se il contenuto non è più leggibile: il proprio commento si può sempre
--      togliere. Il TITOLARE del contenuto non può eliminare i commenti altrui
--      (la moderazione arriva con HOM-11). Esito: 'removed' | 'tombstoned';
--      vedi footme_comment_remove. Un commento già eliminato o inesistente
--      solleva comment_unavailable (il client lo tratta come già rimosso).
create or replace function public.delete_comment(p_comment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_c       public.content_comments%rowtype;
  v_outcome text;
  v_root    uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_c from public.content_comments cc where cc.id = p_comment_id;

  if not found or v_c.status <> 'active' then
    raise exception 'comment_unavailable' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.footme_interaction_identities(v_uid) i
    where i.c_type = v_c.author_type and i.c_id = v_c.author_id
  ) then
    raise exception 'comment_forbidden' using errcode = '42501';
  end if;

  v_outcome := public.footme_comment_remove(v_c.id);
  if v_outcome is null then
    raise exception 'comment_unavailable' using errcode = 'P0002';
  end if;

  v_root := coalesce(v_c.root_comment_id, v_c.id);

  return jsonb_build_object(
    'outcome',            v_outcome,
    'comment_id',         v_c.id,
    'root_comment_id',    v_root,
    'comments_count',     public.footme_comments_count(v_uid, v_c.content_type, v_c.content_id),
    'root_replies_count', public.footme_comment_replies_count(v_uid, v_root));
end;
$$;

revoke all on function public.delete_comment(uuid) from public;
revoke execute on function public.delete_comment(uuid) from anon;
grant execute on function public.delete_comment(uuid) to authenticated;

-- 6-7. «Nuovi commenti» (§141–§145). Il Realtime non consegna righe di una
--      tabella chiusa ai client: il client interroga questa RPC (polling, come
--      HOM-01.1). Conta root e risposte attivi e visibili creati DOPO p_since
--      da identità che NON sono dell'utente; comments_count è il totale del
--      contenuto (stessa definizione del resto).
create or replace function public.fetch_comment_updates(
  p_content_type text,
  p_content_id   uuid,
  p_since        timestamptz
)
returns table (new_count integer, comments_count integer, as_of timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_content_type is null
     or p_content_type not in ('club_media', 'media_profile', 'profile_post',
                               'fan_tribuna', 'media_tribuna', 'fan_media') then
    raise exception 'comment_content_type_unsupported' using errcode = '22023';
  end if;

  if p_since is null then
    raise exception 'comment_invalid_since' using errcode = '22023';
  end if;

  if not public.footme_content_readable(v_uid, p_content_type, p_content_id) then
    raise exception 'content_unavailable' using errcode = 'P0002';
  end if;

  return query
  select
    (count(*) filter (
       where v.created_at > p_since
         and not exists (select 1 from public.footme_interaction_identities(v_uid) i
                         where i.c_type = v.author_type and i.c_id = v.author_id)))::integer,
    count(*)::integer,
    now()
  from public.footme_visible_comments(v_uid, array[p_content_type], array[p_content_id]) v;
end;
$$;

revoke all on function public.fetch_comment_updates(text, uuid, timestamptz) from public;
revoke execute on function public.fetch_comment_updates(text, uuid, timestamptz) from anon;
grant execute on function public.fetch_comment_updates(text, uuid, timestamptz) to authenticated;

-- 6-8. Dettaglio di un Post per qualunque contenuto il cui footme_feed_item_type
--      sia 'post' (persona, Società, Media; §8–§13). Stessa forma di
--      fetch_profile_post_detail (che resta, per compatibilità) più item_type e,
--      nell'autore, source_kind (Media: testata/pagina, come nel Feed).
--      NULL se il contenuto non è leggibile o non è un Post: il chiamante
--      ripiega sul dettaglio editoriale.
create or replace function public.fetch_post_detail(p_content_type text, p_post_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_content_type is null
     or p_content_type not in ('club_media', 'media_profile', 'profile_post',
                               'fan_tribuna', 'media_tribuna', 'fan_media') then
    return null;
  end if;

  select jsonb_build_object(
    'item_type',    'post',
    'post_id',      fci.post_id,
    'published_at', fci.published_at,
    'author', jsonb_build_object(
      'id',          fci.publisher_id,
      'name',        fci.publisher_name,
      'avatar_url',  fci.publisher_avatar_url,
      'is_verified', coalesce(fci.publisher_is_verified, false),
      'source_kind', fci.source_kind
    ),
    'data', jsonb_build_object(
      'content_type',     fci.content_type,
      'post_id',          fci.post_id,
      'kind',             fci.kind,
      'kind_label',       public.footme_content_kind_label(fci.content_type, fci.kind),
      'content_format',   fci.content_format,
      'media_type',       fci.media_type,
      'duration_seconds', fci.duration_seconds,
      'is_truncated',     false
    ) || pl.payload
  )
  into v_result
  from public.feed_content_index fci
  join lateral public.footme_post_payloads(
    v_uid, array[p_content_type], array[p_post_id]
  ) pl on pl.r_post_id = fci.post_id
  where fci.content_type = p_content_type
    and fci.post_id = p_post_id
    and public.footme_feed_item_type(fci.content_type, fci.content_format) = 'post'
    and public.footme_content_readable(v_uid, fci.content_type, fci.post_id);

  return v_result;
end;
$$;

revoke all on function public.fetch_post_detail(text, uuid) from public;
revoke execute on function public.fetch_post_detail(text, uuid) from anon;
grant execute on function public.fetch_post_detail(text, uuid) to authenticated;

-- 6-9. Conteggi in blocco (§89–§91). Per le card dei profili (tribuna, articoli
--      Media) che mostrano il numero senza aprire il thread. Stessa definizione
--      del payload: footme_visible_comments per auth.uid() (autori non visibili
--      fuori, tombstone mai contati, commenti nascosti = 0). Restituisce UNA riga
--      per ogni id distinto richiesto, nell'ordine degli id; un contenuto non
--      leggibile (bozza, eliminato, bloccato, inesistente) vale 0, senza errore
--      e senza rivelare se esiste. Massimo 100 id (comment_counts_too_many, 22023).
create or replace function public.fetch_comment_counts(p_content_type text, p_content_ids uuid[])
returns table (content_id uuid, comments_count integer)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_content_type is null
     or p_content_type not in ('club_media', 'media_profile', 'profile_post',
                               'fan_tribuna', 'media_tribuna', 'fan_media') then
    raise exception 'comment_content_type_unsupported' using errcode = '22023';
  end if;

  if cardinality(p_content_ids) > 100 then
    raise exception 'comment_counts_too_many' using errcode = '22023';
  end if;

  return query
  with ids as (
    select distinct x.k as k_id from unnest(coalesce(p_content_ids, '{}'::uuid[])) as x(k) where x.k is not null
  ),
  readable as (
    select i.k_id from ids i where public.footme_content_readable(v_uid, p_content_type, i.k_id)
  ),
  cnt as (
    select v.content_id as k_id, count(*)::integer as k_n
    from public.footme_visible_comments(
           v_uid,
           array_fill(p_content_type, array[(select count(*)::integer from readable)]),
           (select coalesce(array_agg(r.k_id), '{}'::uuid[]) from readable r)) v
    group by v.content_id
  )
  select i.k_id, coalesce(c.k_n, 0)
  from ids i
  left join cnt c on c.k_id = i.k_id
  order by i.k_id;
end;
$$;

revoke all on function public.fetch_comment_counts(text, uuid[]) from public;
revoke execute on function public.fetch_comment_counts(text, uuid[]) from anon;
grant execute on function public.fetch_comment_counts(text, uuid[]) to authenticated;


-- ============================================================
-- SEZIONE 7 — le cinque tabelle legacy escono (§1, §3)
--
-- Tutti i lettori server sono già passati al dominio unico (sezione 5): il
-- DROP senza CASCADE fallirebbe, annullando l'intera migrazione, se restasse
-- una vista o una colonna che le usa. Con le tabelle spariscono le loro policy
-- (compreso il potere del titolare del contenuto di cancellare commenti altrui,
-- decisione 1) e il trigger content_interaction_guard che le proteggeva.
-- Nessuna vista di compatibilità: i lettori client legacy (le cinque
-- `.from("..._comments")` dei service di Società, Media e Tifoso) sono rimossi
-- dal client di HOM-08. Le app già distribuite che leggono o scrivono questi
-- commenti falliranno: è voluto, come per i Mi piace di HOM-07.
-- ============================================================

drop table public.club_media_comments;
drop table public.media_profile_post_comments;
drop table public.media_tribuna_comments;
drop table public.fan_tribuna_comments;
drop table public.fan_media_comments;
