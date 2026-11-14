-- ============================================================
-- HOM-06.2 — Editoriale, bozze e programmazione: dati
--
-- COSA MANCAVA
--
-- HOM-06.1 sa creare e modificare un Post, ma il sistema editoriale di ProLink
-- non esiste ancora. Il task HOM-06.2 (§1–§7, §7A–§7Z, §95–§132, §137–§202,
-- §230, §259–§260, §273, §292–§293) chiede, sopra lo stesso modello di
-- identità e permessi, quattro cose che oggi mancano:
--
--   1. L'ARTICOLO. Un Articolo è un solo formato con tre modalità di creazione
--      (nativa, da link, da testo incollato), pubblicabile da una Società o da un
--      Media. Oggi non c'è dove scriverlo: club_media_posts ha un `kind` chiuso
--      (highlights, interview, ...) e media_profile_posts ha un modello legacy
--      (source_type / display_mode / source_name / external_url) pensato per un
--      composer che sparisce. Mancano il documento strutturato, la fonte con il
--      suo snapshot, la provenienza di un testo importato e la conferma dei
--      diritti (§7Q).
--   2. LE BOZZE. Il server non ha uno stato «bozza» per i Post delle persone
--      (profile_posts ammette published/hidden/removed) e nessuna RPC che salvi
--      una bozza con concorrenza ottimistica, idempotenza della creazione e
--      ownership dell'identità, non del creator (§132).
--   3. LA PROGRAMMAZIONE. Non esiste un istante di pubblicazione futura, un
--      lifecycle scheduled → publishing → published | failed (§181–§184), un
--      worker che non dipenda da un client (§185), né la rivalidazione dei
--      permessi di chi ha programmato al momento della pubblicazione (§189–§190).
--   4. I PERMESSI. Chi può pubblicare un Articolo e chi può programmare non è
--      espresso: `content_create` copre il Post (HOM-06.1) e basta.
--
-- DECISIONI DI LUIGI (2026-11-13) CHE QUESTA MIGRAZIONE REALIZZA
--
--   1. Stesse righe, più stati. Bozze e programmati vivono nelle tabelle già
--      usate dai contenuti — profile_posts, club_media_posts,
--      media_profile_posts — con gli stati draft (profile_posts non lo aveva),
--      scheduled, publishing, failed. Una riga dalla bozza al pubblicato, ID
--      stabile (§188). Nessuna tabella di bozze parallela.
--   2. Articolo = Società + Media in V1. Società: club_media_posts con `kind =
--      'article'`. Media: media_profile_posts `kind = 'article'` (già esistente).
--      Le persone NON pubblicano Articoli in V1 (can_publish_article = false):
--      restano Post, bozze e programmazione.
--   3. Due chiavi nuove del catalogo DAS-REV-14, area `published_content`
--      (revisione 9), non concesse a nessun ruolo esistente, owner implicito:
--      `content_article_publish` (= can_publish_article) e `content_schedule`
--      (= can_schedule_content). `content_create` resta can_publish_post. Le tre
--      modalità dell'Articolo ereditano can_publish_article (§7B lo consente):
--      nessuna chiave per modalità.
--   4. Il composer legacy dei Media è assorbito e ritirato. Le colonne legacy
--      source_type / display_mode / source_name / external_url restano scritte
--      in specchio (lettori legacy: Feed, ricerca, salvati) e i vecchi articoli
--      si leggono mappando source_type platform → native, link → external_link,
--      pasted → imported_text, senza backfill.
--
-- PERCHÉ QUESTA SOLUZIONE
--
--   * UNA regola per ciascuna cosa.
--       - Chi può pubblicare e con quale capability: footme_publishing_identities
--         (attore esplicito, perché il worker non ha una sessione). Il contesto
--         del Post, quello dell'Articolo, il lancio del «+», l'accesso a una
--         bozza, l'elenco e il worker leggono tutti da lì.
--         footme_composer_identities (HOM-06.1) ne diventa una vista: stesso
--         risultato, verificato con la suite PGlite di HOM-06.1.
--       - Cosa manca a un contenuto per essere pubblicato: footme_content_blocker,
--         che giudica lo STATO SALVATO. Lo usano submit_content, schedule_content,
--         publish_content_now, il worker e l'elenco (schedulable /
--         unschedulable_reason). Il motivo diventa un codice errore in un posto
--         solo (footme_content_raise_blocker).
--       - Dove si scrive: footme_content_apply → persist_post / persist_article.
--         save_content_draft e submit_content PERSISTONO con le stesse funzioni
--         e poi la regola unica giudica quanto è stato salvato, nella stessa
--         transazione: se manca qualcosa l'eccezione annulla anche la scrittura.
--         Nessuna bozza fantasma e nessuna validazione scritta due volte.
--       - Dove cambia lo stato: footme_content_set_state, un UPDATE condizionato
--         allo stato atteso (compare-and-set) che incrementa la versione.
--   * La validazione dei media di publish_post (~100 righe) è estratta in
--     footme_post_normalize_media e publish_post la chiama: stesse regole, stessi
--     errori, una sola implementazione per Post pubblicati, bozze e programmati.
--     Lo stesso per l'idoneità dell'URL (footme_safe_https_url), prima scritta in
--     linea in footme_post_resolve_link e ora usata anche dai link del documento
--     Articolo e dalla fonte.
--   * Concorrenza: colonna `content_version`, incrementata SOLO dalle RPC di
--     questa migrazione (un trigger la farebbe salire anche per scritture di
--     contatori). update_post (HOM-06.1) continua a usare updated_at per i Post
--     pubblicati.
--   * Il worker è una funzione SQL idempotente (run_scheduled_content_sweep),
--     chiamata da pg_cron ogni minuto: `for update skip locked` e transizione
--     condizionata allo stato atteso. Una riga già pubblicata, riportata in bozza
--     o eliminata non è `scheduled`: il «vecchio job» non può ripubblicarla
--     (§174, §179). Il passaggio per `publishing` avviene DENTRO la transazione
--     dello sweep e non è mai osservabile da fuori: se la transazione cade la riga
--     resta `scheduled` e il prossimo sweep la riprende. Per questo NON esiste una
--     «ripresa dei publishing scaduti» (non potrebbe mai scattare) e non c'è la
--     policy relativa. Un errore imprevisto su una riga la porta a failed senza
--     fermare le altre.
--   * Operazione ripetuta dopo una risposta persa: ogni scrittura salva
--     un'impronta (formato, identità, payload, publication) sulla riga
--     (`last_save_hash`). Se la versione attesa non coincide ma l'impronta in
--     arrivo è quella dell'ultima scrittura, è la stessa operazione già applicata:
--     risposta di successo con lo stato corrente, non un falso conflitto. Per la
--     creazione, la stessa chiave con un payload cambiato (il client ha continuato
--     a scrivere) aggiorna la bozza della ricevuta se è ancora draft/failed e
--     accessibile; content_operation_conflict solo se la riga non c'è più.
--   * La modifica di un Articolo PUBBLICATO (submit_content con mode 'keep') è
--     governata solo dalla capability di modifica di HOM-04 (content_edit,
--     footme_content_rights.r_can_edit), come l'editor e il menu: non serve
--     content_article_publish. Le regole del contenuto valgono comunque. Chi
--     conferma una programmazione (keep o cambio data) ne diventa
--     scheduled_by_profile_id: il worker rivaluta la capability di chi l'ha
--     confermata per ultimo.
--   * Chiave di duplicazione: un canonico che è la sola origine mentre la pagina
--     ha un percorso non si usa (siti che dichiarano la home come canonico di
--     ogni articolo); vale l'URL finale.
--   * Snapshot dei link (§7H, §7W): la fonte di un Articolo da link salva una
--     COPIA dello snapshot (source_snapshot) dentro content_articles. Il job
--     all'ora prevista e il dettaglio leggono quella, mai un nuovo fetch: la riga
--     di link_preview_snapshots può sparire senza far perdere il contenuto.
--   * Il documento è validato e NORMALIZZATO dal server (§48–§71): chiavi
--     sconosciute scartate, preview dei rich_link ricostruita SEMPRE dallo
--     snapshot (mai dal client), URL solo https (http promosso se la policy
--     `article.upgrade_http_links` lo consente, javascript:/data:/IP/porte
--     rifiutati), il testo è testo.
--   * Diritti (§7Q): la conferma è una riga PRIVATA con la versione della
--     dichiarazione, identità, attore, modalità e un'impronta della provenienza
--     (identità, fonte, autore e URL originali). Se la provenienza cambia la
--     conferma cade, anche se il client rimanda `rights_confirmed: true` insieme
--     alla modifica: il server non può sapere se l'utente ha rimesso la spunta
--     dopo. La rimette il client, a provenienza invariata. Mai in un payload
--     pubblico né nelle analytics.
--   * Cambio identità in bozza (§24–§27): tra tabelle diverse la bozza si SPOSTA
--     (riga nuova, figli copiati, vecchia riga eliminata fisicamente: non è mai
--     stata pubblicata) e la RPC restituisce il nuovo riferimento; le ricevute di
--     creazione vengono ripuntate, così un retry non crea un duplicato. Su un
--     programmato il cambio di tabella è rifiutato
--     (content_identity_change_requires_draft): il job ha una sua riga e un suo
--     orario.
--   * Duplicati external_link (§7M): per la STESSA identità editoriale, un altro
--     Articolo published, scheduled o publishing con la stessa fonte canonica
--     (coalesce di canonico, finale e normalizzato, ri-normalizzato) →
--     article_duplicate con detail {content_type, content_id}. Bozze e falliti non
--     contano e non si rivelano; tra identità diverse non si blocca.
--
-- COSA NON FA (dichiarato, non dimenticato)
--
--   * Nessun cron nel database di PGlite: pg_cron è condizionale (pattern
--     DAS-REV-31). Se l'estensione non è abilitata sul remoto la migrazione lo
--     dice con un NOTICE e i contenuti programmati restano `scheduled` finché
--     qualcuno non chiama run_scheduled_content_sweep. È un GATE DI RILASCIO.
--   * Nessuna tabella di edit-draft per un Articolo pubblicato: la modifica resta
--     in staging locale sul client finché si tocca «Salva» (§224–§227), poi
--     submit_content con mode 'keep' aggiorna la riga in place.
--   * Nessuna notifica di tag al pubblicarsi di un contenuto programmato: come
--     publish_post, che non ne produce (la produce il client in alcuni flussi
--     legacy).
--   * notifications_before_insert NON è riemessa: i due tipi nuovi
--     (scheduled_content_published, scheduled_content_failed) cadono nel ramo
--     «sistema» senza interruttore, perché raccontano l'esito di un'azione
--     dell'utente stesso. Una riemissione non cambierebbe nulla.
--   * `scheduled_count` della Dashboard Società resta null (contratto invariato):
--     il contatore dei programmati è nel lancio del «+» (fetch_content_launcher).
--   * Una concorrenza reale non è riproducibile in PGlite (una connessione): le
--     conseguenze dei meccanismi (lock di riga, CAS sulla versione, transizione
--     condizionata, skip locked) sono verificate forzando i due ordini di commit
--     in sequenza.
--   * `published_at` resta NOT NULL col default: per bozze e programmati è un
--     segnaposto che nessun lettore guarda (tutti filtrano status = 'published');
--     le RPC lo riscrivono all'istante REALE di pubblicazione, non all'orario
--     previsto.
--   * I media pubblicati con publish_post (HOM-06.1) non hanno storage_path: serve
--     solo ai media che passano da una bozza.
--   * Verificato che nessun flusso del client crea o legge `draft` su
--     club_media_posts / media_profile_posts: le letture filtrano
--     status = 'published' e gli insert non scrivono stati. Eventuali righe
--     `draft` legacy (create fuori dal client) smettono di essere leggibili via
--     PostgREST insieme alle nuove: restano visibili alle RPC e ai conteggi della
--     Dashboard Società.
--
-- PRIVACY / PERMESSI
--
--   * Ogni RPC client: SECURITY DEFINER con search_path fisso, `revoke from
--     public` + `revoke execute from anon`, grant ad authenticated, controllo
--     auth.uid() nel corpo. Le funzioni interne e il worker non hanno execute per
--     i client.
--   * Trappola «le RPC su clubs devono essere security invoker»: queste sono
--     definer perché devono leggere righe che il client non vede (bozze, ricevute,
--     capability di un altro attore nel worker), ma non elencano mai società a un
--     chiamante. Leggono `clubs` solo per id già autorizzati (owner o permessi
--     dell'attore, footme_publishing_identities), per la scheda dell'identità di un
--     contenuto a cui il chiamante ha già accesso, e per i nomi dei tag che sta
--     modificando (come fetch_post_for_edit di HOM-06.1). Ogni filtro di accesso è
--     nel corpo, non nelle policy di clubs.
--   * Le righe draft/scheduled/publishing/failed NON sono leggibili dai client
--     via PostgREST (policy RESTRICTIVE di select sulle tre tabelle, come HOM-04
--     per 'deleted'): né dal proprietario, né da altri. I figli (media, extras,
--     tag) le seguono perché le loro policy leggono la riga padre sotto RLS.
--     RLS filtra righe, non colonne: un trigger (content_lifecycle_guard) impedisce
--     a un client di entrare o uscire da quegli stati e di scrivere scheduled_at,
--     schedule_timezone, scheduled_by_profile_id, content_version,
--     publish_failure_code, publish_attempts, last_publish_attempt_at.
--   * Accesso a una bozza (§131–§132, §259): persona → il proprio profilo;
--     Società → Post: content_create, Articolo: content_article_publish (§273: chi
--     ha solo content_create non vede né crea bozze di Articolo, non programma e
--     non pubblica); Media → il proprietario. La bozza appartiene all'identità,
--     non a chi l'ha creata. Chi non ha accesso riceve content_not_found (P0002),
--     identico a «non esiste»: nessun IDOR.
--   * Programmare, Cambia data e Pubblica ora richiedono anche can_schedule
--     (content_schedule) dell'identità. Il worker rivalida la capability di CHI HA
--     PROGRAMMATO (scheduled_by_profile_id) al momento della pubblicazione: se è
--     stata revocata la riga passa a failed e non si pubblica (§190).
--   * content_articles, article_rights_confirmations, content_operation_receipts:
--     RLS attiva, nessuna policy, nessun grant ai client. fetch_article_detail non
--     restituisce mai diritti, attore o created_by_profile_id.
--   * content_management_audit scrive l'attore reale (create, edit, schedule,
--     unschedule, publish, publish_failed, delete), mai esposto.
--   * Le notifiche vanno al Centro Notifiche, mai ai Messaggi (§202); il payload
--     porta solo {content_type, content_id}.
--
-- CODICI ERRORE (nel message, come composer-types.ts; `detail` solo per i log)
--   content_permission_denied 42501 · content_not_found P0002 ·
--   content_version_conflict 40001 (detail = versione corrente) ·
--   content_operation_conflict 40001 · content_invalid_state 55000 ·
--   content_empty 22023 · content_identity_change_requires_draft 22023 ·
--   schedule_in_past / schedule_too_soon / schedule_too_far 22023 ·
--   schedule_media_not_ready 22023 · schedule_not_allowed 42501 ·
--   article_missing_title / article_title_too_long / article_invalid_document /
--   article_body_too_long / article_invalid_source / article_source_required /
--   article_rights_required / article_cover_not_allowed 22023 ·
--   article_duplicate 23505 (detail = JSON {content_type, content_id}) ·
--   article_mode_not_allowed 42501 · più i post_* di HOM-06.1 per le parti Post.
--   Aggiunta rispetto al contratto: publication_invalid 22023 (forma, istante
--   senza fuso o fuso non IANA di una programmazione). article_invalid_source con
--   detail 'confirm_source_change' = cambio di fonte su un Articolo pubblicato da
--   confermare (§219). Un Post vuoto all'invio risponde content_empty (la regola
--   è unica con le bozze), non più post_invalid_content come in publish_post.
--
-- ROLLOUT
--
--   * Additiva sul modello, con tre effetti da sapere:
--       - le righe 'draft' legacy di club_media_posts / media_profile_posts non
--         sono più leggibili via PostgREST (vedi sopra);
--       - un client che portava una riga pubblicata a 'draft' (o a un altro stato
--         del lifecycle) con UPDATE diretto ora riceve content_status_forbidden;
--       - un tag inserito direttamente su una bozza non passa più (RLS via riga
--         padre): le bozze si scrivono solo dalle RPC.
--   * Riemesse dalla definizione più recente (20261120090000), con la sola
--     modifica dichiarata a ogni voce della SEZIONE 16: footme_normalize_url
--     (altri parametri di tracciamento), footme_post_resolve_link, publish_post,
--     feed_content_index e media_content_index (kind 'article' → articolo),
--     fetch_dashboard_society_overview (bozze accessibili), footme_content_kind_label.
--     Ri-emesse additivamente: footme_composer_identities,
--     fetch_post_composer_context (can_schedule_content, schedule),
--     content_post_cleanup_children (anche l'Articolo).
--   * Catalogo permessi: revisione 9. Nessun backfill: un delegato oggi non pubblica
--     Articoli e non programma, e continua a non poterlo fare finché la chiave non
--     gli viene assegnata dall'editor ruoli.
--   * Fuori dal database: deploy della Edge Function `link-preview` aggiornata
--     (purpose, canonico, autore, data) e abilitazione di pg_cron sul remoto.
--   * Schema drift: nessuna colonna di recruiting_ads toccata.
--   * Non applicata al remoto: verificare con `npm run supabase:migration:list`.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — lifecycle sulle tre tabelle di Post
--
-- Stessa riga dalla bozza al pubblicato (§188): nessuna tabella di bozze
-- parallela. Stati nuovi: draft (profile_posts non lo aveva), scheduled,
-- publishing, failed. I CHECK vecchi si cercano per definizione (contengono
-- `status` e 'published'), non per nome: schema drift. Il CHECK di coerenza
-- deleted_at (HOM-04) non contiene 'published' e non si tocca.
-- ============================================================

do $$
declare
  t record;
  c record;
begin
  for t in
    select * from (values
      ('profile_posts',
        array['published', 'hidden', 'removed', 'deleted', 'draft', 'scheduled', 'publishing', 'failed']),
      ('club_media_posts',
        array['draft', 'published', 'archived', 'deleted', 'scheduled', 'publishing', 'failed']),
      ('media_profile_posts',
        array['draft', 'published', 'archived', 'deleted', 'scheduled', 'publishing', 'failed'])
    ) as v(tbl, states)
  loop
    for c in
      select con.conname
      from pg_constraint con
      where con.conrelid = format('public.%I', t.tbl)::regclass
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) ~ '\mstatus\M'
        and pg_get_constraintdef(con.oid) ~ 'published'
        and pg_get_constraintdef(con.oid) !~ 'deleted_at'
    loop
      execute format('alter table public.%I drop constraint %I', t.tbl, c.conname);
    end loop;

    execute format(
      'alter table public.%I add constraint %I check (status = any (%L::text[]))',
      t.tbl, t.tbl || '_status_check', t.states);

    -- Colonne del lifecycle (last_save_hash: impronta dell'ultima scrittura delle RPC,
    -- serve a riconoscere un'operazione ripetuta dopo una risposta persa). `content_version` sale SOLO dalle RPC di questa
    -- migrazione (un trigger la farebbe salire anche per scritture che non
    -- cambiano il contenuto). `published_at` resta NOT NULL col suo default:
    -- per bozze e programmati è un segnaposto che nessun lettore guarda (tutti
    -- filtrano status = 'published'); la RPC lo riscrive all'istante reale di
    -- pubblicazione.
    execute format(
      'alter table public.%I
         add column if not exists scheduled_at timestamptz,
         add column if not exists schedule_timezone text,
         add column if not exists scheduled_by_profile_id uuid references public.profiles(id) on delete set null,
         add column if not exists content_version integer not null default 1,
         add column if not exists publish_failure_code text,
         add column if not exists publish_attempts integer not null default 0,
         add column if not exists last_publish_attempt_at timestamptz,
         add column if not exists last_save_hash text',
      t.tbl);

    execute format('alter table public.%I drop constraint if exists %I', t.tbl, t.tbl || '_scheduled_check');
    execute format(
      'alter table public.%I add constraint %I check (status <> ''scheduled'' or scheduled_at is not null)',
      t.tbl, t.tbl || '_scheduled_check');

    execute format('alter table public.%I drop constraint if exists %I', t.tbl, t.tbl || '_lifecycle_values_check');
    execute format(
      'alter table public.%I add constraint %I check (
         content_version >= 1 and publish_attempts >= 0
         and (schedule_timezone is null or char_length(schedule_timezone) <= 64)
         and (publish_failure_code is null or char_length(publish_failure_code) <= 64))',
      t.tbl, t.tbl || '_lifecycle_values_check');

    -- Indice del worker: solo le righe che aspettano di essere pubblicate.
    execute format(
      'create index if not exists %I on public.%I (scheduled_at) where status in (''scheduled'', ''publishing'')',
      t.tbl || '_due_idx', t.tbl);
  end loop;
end
$$;

-- 1b. club_media_posts.kind accetta 'article' (decisione 2: Articolo della
-- Società). Il CHECK di HOM-06.1 si ricostruisce con un valore in più.
alter table public.club_media_posts drop constraint if exists club_media_posts_kind_check;
alter table public.club_media_posts
  add constraint club_media_posts_kind_check
  check (kind in ('highlights', 'interview', 'market', 'statement', 'training', 'event', 'post', 'article'));

-- 1c. Titolo e categoria dei Media: una BOZZA può non avere ancora il titolo
-- (§143 «Articolo senza titolo»); la categoria non esiste per Post e Articolo
-- (la fonte di un Articolo Media è la sua provenienza, non una categoria).
alter table public.media_profile_posts drop constraint if exists media_profile_posts_title_check;
alter table public.media_profile_posts
  add constraint media_profile_posts_title_check
  check (kind = 'post' or status in ('draft', 'deleted') or length(trim(title)) > 0);

alter table public.media_profile_posts drop constraint if exists media_profile_posts_category_check;
alter table public.media_profile_posts
  add constraint media_profile_posts_category_check
  check (kind in ('post', 'article') or length(trim(category)) > 0);

-- 1d. content_post_media: il path di storage serve a RISALVARE una bozza con
-- media già allegati, anche caricati da un altro amministratore della stessa
-- Società (§260): il path non sta nella cartella dell'attore corrente. Lo
-- stesso vale per la miniatura di un video.
alter table public.content_post_media
  add column if not exists storage_path text,
  add column if not exists thumbnail_storage_path text;

alter table public.content_post_media drop constraint if exists content_post_media_storage_path_check;
alter table public.content_post_media
  add constraint content_post_media_storage_path_check check (
    (storage_path is null or char_length(storage_path) <= 300)
    and (thumbnail_storage_path is null or char_length(thumbnail_storage_path) <= 300));

-- 1e. Cleanup: l'eliminazione fisica di una bozza (cambio identità tra tabelle)
-- porta via anche l'Articolo. Riemessa dalla definizione più recente
-- (20260619110000 / verificata sul database): UNA riga in più.
create or replace function public.content_post_cleanup_children()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ct text := case tg_table_name
    when 'club_media_posts'    then 'club_media'
    when 'media_profile_posts' then 'media_profile'
    when 'media_tribuna_posts' then 'media_tribuna'
    when 'fan_tribuna_posts'   then 'fan_tribuna'
    when 'fan_media_posts'     then 'fan_media'
    when 'profile_posts'       then 'profile_post'
  end;
begin
  delete from public.content_post_media m
  where m.content_type = v_ct and m.post_id = old.id;
  delete from public.content_post_extras x
  where x.content_type = v_ct and x.post_id = old.id;
  -- HOM-06.2: l'Articolo (modello, fonte, snapshot) segue la riga.
  delete from public.content_articles a
  where a.content_type = v_ct and a.post_id = old.id;
  return old;
end;
$$;

revoke all on function public.content_post_cleanup_children() from public;
revoke execute on function public.content_post_cleanup_children() from anon, authenticated;


-- ============================================================
-- SEZIONE 2 — tabelle: Articolo, conferma dei diritti, ricevute
--
-- Tutte con RLS attiva, nessuna policy e nessun grant ai client: le scrivono e
-- leggono solo le RPC (definer). I diritti non escono mai in un payload
-- pubblico né nelle analytics (§7Q).
-- ============================================================

-- 2a. Conferme dei diritti (§7Q). `source_reference` porta l'impronta della
-- provenienza (identità, modalità, fonte, autore e URL originali): se cambia,
-- la conferma non vale più e va richiesta di nuovo.
create table if not exists public.article_rights_confirmations (
  id                  uuid        primary key default gen_random_uuid(),
  content_type        text        not null check (content_type in ('club_media', 'media_profile')),
  post_id             uuid        not null,
  declaration_version text        not null,
  identity_type       text        not null check (identity_type in ('society', 'media')),
  identity_id         uuid        not null,
  actor_id            uuid        not null,
  creation_mode       text        not null check (creation_mode in ('native', 'external_link', 'imported_text')),
  source_reference    jsonb       not null default '{}'::jsonb,
  confirmed_at        timestamptz not null default timezone('utc', now())
);

create index if not exists article_rights_confirmations_post_idx
  on public.article_rights_confirmations (content_type, post_id, confirmed_at desc);

alter table public.article_rights_confirmations enable row level security;
revoke all on table public.article_rights_confirmations from anon, authenticated;

-- 2b. Articolo: UN modello per le tre modalità (§7C). La riga principale
-- (club_media_posts / media_profile_posts, kind 'article') resta la sorgente
-- delle letture legacy (Feed, ricerca, salvati) tramite colonne in specchio;
-- qui sta tutto ciò che quelle colonne non sanno dire.
create table if not exists public.content_articles (
  content_type           text        not null check (content_type in ('club_media', 'media_profile')),
  post_id                uuid        not null,
  creation_mode          text        not null check (creation_mode in ('native', 'external_link', 'imported_text')),
  -- Documento strutturato v1 (native / imported_text), già normalizzato.
  document               jsonb       check (document is null or jsonb_typeof(document) = 'object'),
  -- {storage_path, url, width, height, alt_text} | null
  cover                  jsonb       check (cover is null or jsonb_typeof(cover) = 'object'),
  -- external_link (§7H, §7I): URL ricevuto, normalizzato, redirect finale
  -- validato, canonico, dominio, snapshot persistito e chiave di duplicazione.
  source_url             text,
  source_normalized_url  text,
  source_final_url       text,
  source_canonical_url   text,
  source_domain          text,
  source_site_name       text,
  source_snapshot_id     uuid        references public.link_preview_snapshots(id) on delete set null,
  source_snapshot        jsonb,
  source_fetched_at      timestamptz,
  source_key             text,
  manual_title           boolean     not null default false,
  -- imported_text (§7P)
  published_elsewhere    boolean,
  original_source_name   text,
  original_author        text,
  original_url           text,
  no_original_link       boolean     not null default false,
  rights_confirmation_id uuid        references public.article_rights_confirmations(id) on delete set null,
  created_at             timestamptz not null default timezone('utc', now()),
  updated_at             timestamptz not null default timezone('utc', now()),
  primary key (content_type, post_id),
  constraint content_articles_urls_https_check check (
    (source_url is null or source_url ~ '^https://')
    and (source_final_url is null or source_final_url ~ '^https://')
    and (source_canonical_url is null or source_canonical_url ~ '^https://')
    and (original_url is null or original_url ~ '^https://')),
  constraint content_articles_lengths_check check (
    (source_url is null or char_length(source_url) <= 2048)
    and (original_source_name is null or char_length(original_source_name) <= 120)
    and (original_author is null or char_length(original_author) <= 120))
);

-- Duplicati external_link (§7M): per chiave di fonte, solo tra gli articoli.
create index if not exists content_articles_source_key_idx
  on public.content_articles (content_type, source_key)
  where source_key is not null;

alter table public.content_articles enable row level security;
revoke all on table public.content_articles from anon, authenticated;

-- 2c. Ricevute di creazione bozza e di invio (§118, §176). Una sola tabella per
-- le due operazioni: la chiave è unica per attore; la stessa chiave con
-- un'altra operazione o un'altra impronta non è un retry.
create table if not exists public.content_operation_receipts (
  id            uuid        primary key default gen_random_uuid(),
  actor_id      uuid        not null,
  operation_key text        not null,
  op            text        not null check (op in ('draft_create', 'submit')),
  content_type  text        not null check (content_type in ('profile_post', 'club_media', 'media_profile')),
  content_id    uuid        not null,
  payload_hash  text        not null,
  created_at    timestamptz not null default timezone('utc', now()),
  constraint content_operation_receipts_actor_key_uniq unique (actor_id, operation_key)
);

create index if not exists content_operation_receipts_content_idx
  on public.content_operation_receipts (content_type, content_id);

alter table public.content_operation_receipts enable row level security;
revoke all on table public.content_operation_receipts from anon, authenticated;

-- 2d. Snapshot dei link (§7H–§7I): canonico, autore e data di pubblicazione
-- della fonte. Colonne nuove nullable: gli snapshot di HOM-06.1 restano validi.
alter table public.link_preview_snapshots
  add column if not exists canonical_url  text,
  add column if not exists author         text,
  add column if not exists published_time timestamptz;

alter table public.link_preview_snapshots drop constraint if exists link_preview_snapshots_canonical_check;
alter table public.link_preview_snapshots
  add constraint link_preview_snapshots_canonical_check check (
    (canonical_url is null or (canonical_url ~ '^https://' and char_length(canonical_url) <= 2048))
    and (author is null or char_length(author) <= 200));

-- 2e. Audit: azioni e risultati nuovi accanto a quelli di HOM-04/06.1. Le due
-- CHECK si ricostruiscono per nome (create da HOM-06.1) e per definizione.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.content_management_audit'::regclass
      and con.contype = 'c'
      and (pg_get_constraintdef(con.oid) ~ '\maction\M'
           or pg_get_constraintdef(con.oid) ~ '\mresult\M')
  loop
    execute format('alter table public.content_management_audit drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.content_management_audit
  add constraint content_management_audit_action_check
  check (action in ('delete', 'create', 'edit', 'schedule', 'unschedule', 'publish', 'publish_failed'));

alter table public.content_management_audit
  add constraint content_management_audit_result_check
  check (result in ('deleted', 'already_deleted', 'created', 'edited',
                    'scheduled', 'unscheduled', 'published', 'failed'));


-- ============================================================
-- SEZIONE 3 — policy di sistema (app_policy_settings)
-- ============================================================

insert into public.app_policy_settings (key, value, description)
values
  ('article.max_title_length', to_jsonb(160),
   'HOM-06.2 §34 — lunghezza massima del titolo di un Articolo.'),
  ('article.max_body_length', to_jsonb(60000),
   'HOM-06.2 §7R — caratteri di testo piano del corpo di un Articolo.'),
  ('article.max_blocks', to_jsonb(400),
   'HOM-06.2 §48 — blocchi (e elementi di lista) massimi in un documento Articolo.'),
  ('article.max_block_text', to_jsonb(8000),
   'HOM-06.2 §48 — caratteri massimi di testo in un singolo blocco.'),
  ('article.max_clipboard_chars', to_jsonb(120000),
   'HOM-06.2 §7R — caratteri massimi accettati dal campo «Incolla un articolo» (limite letto dal client).'),
  ('article.parse_timeout_ms', to_jsonb(1500),
   'HOM-06.2 §7R — tempo massimo del parsing del testo incollato lato client.'),
  ('article.excerpt_length', to_jsonb(240),
   'HOM-06.2 — lunghezza dell estratto dell Articolo (colonna excerpt in specchio).'),
  ('article.max_tags', to_jsonb(20),
   'HOM-06.2 — persone e Società taggabili in un Articolo.'),
  ('article.upgrade_http_links', to_jsonb(true),
   'HOM-06.2 §67 — i link http nel documento si promuovono a https; false li rifiuta.'),
  ('article.rights_declaration_version', to_jsonb('v1'::text),
   'HOM-06.2 §7Q — versione della dichiarazione dei diritti salvata con la conferma.'),
  ('content_schedule.min_lead_minutes', to_jsonb(5),
   'HOM-06.2 §96 — anticipo minimo di una programmazione, in minuti.'),
  ('content_schedule.max_horizon_days', to_jsonb(365),
   'HOM-06.2 §95 — orizzonte massimo di una programmazione, in giorni.')
on conflict (key) do nothing;


-- ============================================================
-- SEZIONE 4 — catalogo permessi DAS-REV-14, revisione 9 (decisione 3)
--
-- Riemesse le due whitelist di chiavi dalla definizione più recente
-- (20261118090000 §1, verificata sul database) con DUE chiavi in più:
-- content_article_publish (= can_publish_article) e content_schedule
-- (= can_schedule_content). Nessuna è concessa a un ruolo esistente: un
-- delegato oggi non pubblica Articoli né programma nulla, e continua a non
-- poterlo fare finché la chiave non gli viene assegnata dall'editor ruoli.
-- L'area è `published_content` (scope 'society'): i contenuti non hanno una
-- Squadra, e in un'area 'team' un Ambito selettivo valrebbe per tutta la
-- Società (vedi HOM-04).
-- ============================================================

do $$
declare
  v_keys text[] := array[
    'shortlist_view', 'shortlist_create_lists', 'shortlist_add_profiles',
    'shortlist_add_notes', 'shortlist_edit_status', 'shortlist_remove_profiles',
    'notif_new_applications', 'notif_shortlist_updates', 'notif_connection_requests',
    'notif_store_orders', 'notif_content_tags', 'notif_affiliations',
    'notif_profile_verifications', 'society_manage_profile', 'society_manage_positions',
    'society_publish_media', 'dashboard_view', 'positions_view', 'positions_create',
    'positions_publish', 'applications_view', 'teams_view', 'content_view',
    'content_create', 'invites_create', 'invites_view', 'teams_create', 'teams_edit',
    'roster_view', 'seasons_prepare', 'seasons_history_view', 'seasons_history_edit',
    'seasons_history_add', 'teams_lifecycle', 'network_view', 'network_requests_view',
    'network_request_send', 'network_request_manage', 'network_request_cancel',
    'network_invite_create', 'network_terminate', 'network_history_view',
    'admins_view', 'admin_invites_view', 'admins_invite', 'admin_roles_view',
    'admin_roles_manage', 'admins_assign_role', 'admins_manage_scope', 'admins_revoke',
    'admin_invites_cancel', 'society_profile_view', 'invites_cancel',
    'member_requests_view', 'join_links_view', 'join_links_create', 'join_links_manage',
    'join_links_revoke', 'assignments_remove', 'member_requests_resolve',
    'assignments_manage', 'members_remove', 'selection_events_view',
    'selection_events_create', 'selection_events_manage',
    'selection_events_participants_view', 'selection_events_invite', 'groups_view',
    'groups_create', 'groups_manage', 'groups_delete', 'content_edit', 'content_delete',
    'content_insights',
    -- HOM-06.2
    'content_article_publish', 'content_schedule'];
begin
  execute 'alter table public.club_member_permissions drop constraint if exists club_member_permissions_key_check';
  execute format(
    'alter table public.club_member_permissions add constraint club_member_permissions_key_check check (permission_key = any (%L::text[]))',
    v_keys);
  execute 'alter table public.club_admin_role_permissions drop constraint if exists club_admin_role_permissions_key_check';
  execute format(
    'alter table public.club_admin_role_permissions add constraint club_admin_role_permissions_key_check check (permission_key = any (%L::text[]))',
    v_keys);
end
$$;

insert into public.club_permission_areas
  (id, label, description, sort_order, scope_kind, is_available) values
  ('published_content', 'Contenuti pubblicati',
     'Pubblicazione di Articoli, programmazione, modifica, eliminazione e statistiche dei contenuti della società.',
     11, 'society', true)
on conflict (id) do update
  set label        = excluded.label,
      description  = excluded.description,
      sort_order   = excluded.sort_order,
      scope_kind   = excluded.scope_kind,
      is_available = excluded.is_available;

insert into public.club_permission_controls
  (id, area_id, label, helper, bundle, requires, sort_order, is_available) values
  ('content_article_publish', 'published_content', 'Pubblica Articoli', null,
     'manage', array[]::text[], 4, true),
  ('content_schedule', 'published_content', 'Programma contenuti', null,
     'manage', array[]::text[], 5, true)
on conflict (id) do update
  set area_id      = excluded.area_id,
      label        = excluded.label,
      helper       = excluded.helper,
      bundle       = excluded.bundle,
      requires     = excluded.requires,
      sort_order   = excluded.sort_order,
      is_available = excluded.is_available;

insert into public.club_permission_control_keys (control_id, permission_key) values
  ('content_article_publish', 'content_article_publish'),
  ('content_schedule',        'content_schedule')
on conflict do nothing;

insert into public.app_policy_settings (key, value, description)
values (
  'admin_permission_catalog_revision',
  to_jsonb(9),
  'DAS-REV-14 §7 — revisione della tassonomia aree/controlli/chiavi. Va '
  'incrementata da ogni migrazione che cambia il catalogo.'
)
on conflict (key) do update set value = to_jsonb(9);


-- ============================================================
-- SEZIONE 5 — visibilità e scritture dei client
--
-- RLS filtra righe, non colonne: due difese distinte.
--
-- 5a. Le righe draft/scheduled/publishing/failed NON sono leggibili dai client
--     via PostgREST (come HOM-04 fa per 'deleted'): si leggono solo dalle RPC,
--     che applicano l'accesso della bozza. I figli (media, extras, tag) la
--     seguono perché le loro policy leggono la riga padre sotto RLS.
-- 5b. Un trigger impedisce a un client (anon/authenticated) di entrare o
--     uscire da quegli stati e di scrivere le colonne del lifecycle: lo stato
--     lo muovono solo le RPC (definer: current_user è il proprietario).
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array['profile_posts', 'club_media_posts', 'media_profile_posts']
  loop
    execute format('drop policy if exists "unpublished content hidden from clients" on public.%I', t);
    execute format(
      'create policy "unpublished content hidden from clients" on public.%I
         as restrictive for select to public
         using (status not in (''draft'', ''scheduled'', ''publishing'', ''failed''))', t);
  end loop;
end
$$;

create or replace function public.content_lifecycle_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status in ('draft', 'scheduled', 'publishing', 'failed')
       or new.scheduled_at is not null
       or new.schedule_timezone is not null
       or new.scheduled_by_profile_id is not null
       or new.publish_failure_code is not null
       or new.publish_attempts <> 0
       or new.last_publish_attempt_at is not null
       or new.last_save_hash is not null
       or new.content_version <> 1 then
      raise exception 'content_status_forbidden' using errcode = '42501';
    end if;
    return new;
  end if;

  if old.status in ('draft', 'scheduled', 'publishing', 'failed')
     or new.status in ('draft', 'scheduled', 'publishing', 'failed')
     or new.scheduled_at is distinct from old.scheduled_at
     or new.schedule_timezone is distinct from old.schedule_timezone
     or new.scheduled_by_profile_id is distinct from old.scheduled_by_profile_id
     or new.publish_failure_code is distinct from old.publish_failure_code
     or new.publish_attempts is distinct from old.publish_attempts
     or new.last_publish_attempt_at is distinct from old.last_publish_attempt_at
     or new.last_save_hash is distinct from old.last_save_hash
     or new.content_version is distinct from old.content_version then
    raise exception 'content_status_forbidden' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.content_lifecycle_guard() from public;
revoke execute on function public.content_lifecycle_guard() from anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['profile_posts', 'club_media_posts', 'media_profile_posts']
  loop
    execute format('drop trigger if exists content_lifecycle_guard on public.%I', t);
    execute format(
      'create trigger content_lifecycle_guard before insert or update on public.%I
         for each row execute function public.content_lifecycle_guard()', t);
  end loop;
end
$$;


-- ============================================================
-- SEZIONE 6 — funzioni interne (nessun execute ai client)
-- ============================================================

-- 6a. Policy numeriche: una sola lettura di app_policy_settings.
create or replace function public.footme_policy_int(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (s.value #>> '{}')::integer from public.app_policy_settings s where s.key = p_key),
    p_default);
$$;

revoke all on function public.footme_policy_int(text, integer) from public;
revoke execute on function public.footme_policy_int(text, integer) from anon, authenticated;

create or replace function public.footme_article_limits()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'max_title_length',   public.footme_policy_int('article.max_title_length', 160),
    'max_body_length',    public.footme_policy_int('article.max_body_length', 60000),
    'max_blocks',         public.footme_policy_int('article.max_blocks', 400),
    'max_block_text',     public.footme_policy_int('article.max_block_text', 8000),
    'max_clipboard_chars', public.footme_policy_int('article.max_clipboard_chars', 120000),
    'parse_timeout_ms',   public.footme_policy_int('article.parse_timeout_ms', 1500),
    'excerpt_length',     public.footme_policy_int('article.excerpt_length', 240),
    'max_tags',           public.footme_policy_int('article.max_tags', 20));
$$;

revoke all on function public.footme_article_limits() from public;
revoke execute on function public.footme_article_limits() from anon, authenticated;

create or replace function public.footme_schedule_policy()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'min_lead_minutes', public.footme_policy_int('content_schedule.min_lead_minutes', 5),
    'max_horizon_days',         public.footme_policy_int('content_schedule.max_horizon_days', 365));
$$;

revoke all on function public.footme_schedule_policy() from public;
revoke execute on function public.footme_schedule_policy() from anon, authenticated;

-- 6b. URL https sicuro (§78, §67). L'idoneità che footme_post_resolve_link
-- applicava in linea, ora UNA funzione sola: l'usano il link di un Post, i link
-- del documento Articolo e la fonte dell'Articolo. https, host con un punto,
-- niente userinfo/porta diversa da 443/IP/host interni/spazi/controlli, <= 2048.
-- Con p_upgrade_http un http:// si promuove a https. Restituisce l'URL con lo
-- schema minuscolo, o null se non idoneo.
create or replace function public.footme_safe_https_url(p_url text, p_upgrade_http boolean)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_url  text := btrim(coalesce(p_url, ''));
  v_host text;
begin
  if p_upgrade_http and v_url ~* '^http://' then
    v_url := 'https://' || substr(v_url, 8);
  end if;

  -- L'host si legge fino al primo / ? # : un fragment o una query non possono
  -- nascondere un IP (https://10.0.0.1#a).
  v_host := lower(coalesce(substring(v_url from '^[hH][tT][tT][pP][sS]://([^/?#]*)'), ''));
  v_host := regexp_replace(v_host, ':443$', '');

  if char_length(v_url) > 2048
     or v_url ~ '[[:cntrl:]]'
     or v_url ~ '[[:space:]]'
     or v_host = ''
     or v_host !~ '^[^:@]+\.[^:@]+$'
     or v_host ~ '\.$'
     or v_host ~ '\.(local|internal)$'
     or v_host ~ '^[0-9.]+$'
     or (length(v_url) > length(v_host) + 8
         and substr(v_url, length(v_host) + 9, 1) not in ('/', '?', '#', ':')) then
    return null;
  end if;

  return 'https://' || substr(v_url, 9);
end;
$$;

revoke all on function public.footme_safe_https_url(text, boolean) from public;
revoke execute on function public.footme_safe_https_url(text, boolean) from anon, authenticated;

-- 6c. Permesso su una Società per un ATTORE esplicito. has_club_permission
-- legge auth.uid(): il worker che pubblica un contenuto programmato non ha una
-- sessione e deve rivalidare i permessi di chi ha programmato (§189–§190).
-- Stessa regola di has_club_permission: owner implicito, oppure chiave concessa
-- con accesso amministrativo attivo.
create or replace function public.footme_actor_club_permission(
  p_actor uuid,
  p_club  uuid,
  p_key   text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_actor is not null and (
    exists (select 1 from public.clubs c where c.id = p_club and c.owner_profile_id = p_actor)
    or exists (
      select 1
      from public.club_member_permissions perm
      where perm.club_id = p_club
        and perm.profile_id = p_actor
        and perm.permission_key = p_key
        and public.club_access_is_active(p_club, p_actor)));
$$;

revoke all on function public.footme_actor_club_permission(uuid, uuid, text) from public;
revoke execute on function public.footme_actor_club_permission(uuid, uuid, text) from anon, authenticated;

-- 6d. Identità da cui l'ATTORE può pubblicare, con le tre capability (decisione 3).
-- UNA regola: il contesto del Post, quello dell'Articolo, il lancio, l'accesso a
-- una bozza e il worker leggono tutti da qui.
--   person  = i ruoli di HOM-06.1: Post sì, Articolo no (decisione 2), schedule sì.
--   society = owner (tutto implicito) o chi ha content_create / content_article_publish
--             su una Società non sospesa/rifiutata/segnalata. can_schedule = content_schedule.
--   media   = ruolo media con profilo media: tutto.
create or replace function public.footme_publishing_identities(p_actor uuid)
returns table (
  c_type       text,
  c_id         uuid,
  c_rank       integer,
  can_post     boolean,
  can_article  boolean,
  can_schedule boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select 'person'::text, p.id, 0, true, false, true
  from public.profiles p
  where p.id = p_actor
    and p.role::text in ('player', 'coach', 'staff', 'agent', 'director', 'fan')

  union all

  select 'society'::text, c.id, 1, k.can_post, k.can_article, k.can_schedule
  from (
    select cl.id
    from public.clubs cl
    where cl.owner_profile_id = p_actor
    union
    select perm.club_id
    from public.club_member_permissions perm
    where perm.profile_id = p_actor
      and perm.permission_key in ('content_create', 'content_article_publish', 'content_schedule')
  ) cand
  join public.clubs c on c.id = cand.id
  cross join lateral (
    select
      public.footme_actor_club_permission(p_actor, c.id, 'content_create')          as can_post,
      public.footme_actor_club_permission(p_actor, c.id, 'content_article_publish') as can_article,
      public.footme_actor_club_permission(p_actor, c.id, 'content_schedule')        as can_schedule
  ) k
  where c.verification_status not in ('suspended', 'rejected', 'flagged')
    and (k.can_post or k.can_article)

  union all

  select 'media'::text, p.id, 2, true, true, true
  from public.profiles p
  join public.media_profiles mp on mp.profile_id = p.id
  where p.id = p_actor
    and p.role::text = 'media';
$$;

revoke all on function public.footme_publishing_identities(uuid) from public;
revoke execute on function public.footme_publishing_identities(uuid) from anon, authenticated;

-- footme_composer_identities (HOM-06.1) diventa una vista della regola sopra:
-- le identità che possono pubblicare un Post. Stessa firma, stesso risultato
-- (verificato con la suite di HOM-06.1): publish_post e il contesto non cambiano.
create or replace function public.footme_composer_identities()
returns table (c_type text, c_id uuid, c_rank integer)
language sql
stable
security definer
set search_path = public
as $$
  select i.c_type, i.c_id, i.c_rank
  from public.footme_publishing_identities(auth.uid()) i
  where i.can_post;
$$;

revoke all on function public.footme_composer_identities() from public;
revoke execute on function public.footme_composer_identities() from anon, authenticated;

-- 6e. Un contenuto per (tipo, id), con il lock di riga se richiesto. Nessun
-- controllo di accesso: lo fa il chiamante. Zero righe = non esiste. l_format è
-- 'post' | 'article' | null (kind legacy: highlights, interview, ...: fuori
-- dal dominio dei Post/Articoli, mai gestibili da queste RPC).
create or replace function public.footme_content_load(
  p_content_type text,
  p_id           uuid,
  p_lock         boolean
)
returns table (
  l_status        text,
  l_version       integer,
  l_kind          text,
  l_format        text,
  l_identity_type text,
  l_identity_id   uuid,
  l_scheduled_at  timestamptz,
  l_timezone      text,
  l_scheduled_by  uuid,
  l_updated_at    timestamptz,
  l_created_by    uuid,
  l_failure       text,
  l_published_at  timestamptz,
  l_save_hash     text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_lock text := case when p_lock then ' for update' else '' end;
begin
  if p_id is null then
    return;
  end if;

  if p_content_type = 'profile_post' then
    return query execute
      'select x.status, x.content_version, ''post''::text, ''post''::text, ''person''::text, x.profile_id,
              x.scheduled_at, x.schedule_timezone, x.scheduled_by_profile_id, x.updated_at,
              x.profile_id, x.publish_failure_code, x.published_at, x.last_save_hash
       from public.profile_posts x where x.id = $1' || v_lock
    using p_id;
  elsif p_content_type = 'club_media' then
    return query execute
      'select x.status, x.content_version, x.kind,
              case x.kind when ''post'' then ''post'' when ''article'' then ''article'' end,
              ''society''::text, x.club_id,
              x.scheduled_at, x.schedule_timezone, x.scheduled_by_profile_id, x.updated_at,
              x.created_by_profile_id, x.publish_failure_code, x.published_at, x.last_save_hash
       from public.club_media_posts x where x.id = $1' || v_lock
    using p_id;
  elsif p_content_type = 'media_profile' then
    return query execute
      'select x.status, x.content_version, x.kind,
              case x.kind when ''post'' then ''post'' when ''article'' then ''article'' end,
              ''media''::text, x.media_profile_id,
              x.scheduled_at, x.schedule_timezone, x.scheduled_by_profile_id, x.updated_at,
              x.created_by_profile_id, x.publish_failure_code, x.published_at, x.last_save_hash
       from public.media_profile_posts x where x.id = $1' || v_lock
    using p_id;
  end if;
end;
$$;

revoke all on function public.footme_content_load(text, uuid, boolean) from public;
revoke execute on function public.footme_content_load(text, uuid, boolean) from anon, authenticated;

-- 6f. Accesso a una bozza / programmato / fallito (§131–§132, §259). La bozza
-- appartiene all'IDENTITÀ, non a chi l'ha creata: persona → il proprio profilo;
-- Società → Post: content_create, Articolo: content_article_publish (§273: chi ha
-- solo content_create non vede né crea bozze di Articolo); Media → il proprietario.
-- Falso anche per righe eliminate, di altri o di un kind fuori dominio.
create or replace function public.footme_content_draft_access(
  p_content_type text,
  p_id           uuid,
  p_actor        uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select exists (
      select 1
      from public.footme_publishing_identities(p_actor) i
      where i.c_type = l.l_identity_type
        and i.c_id = l.l_identity_id
        and case l.l_format when 'post' then i.can_post when 'article' then i.can_article else false end)
    from public.footme_content_load(p_content_type, p_id, false) l
    where l.l_status <> 'deleted'
  ), false);
$$;

revoke all on function public.footme_content_draft_access(text, uuid, uuid) from public;
revoke execute on function public.footme_content_draft_access(text, uuid, uuid) from anon, authenticated;

-- 6g. Media del Post, validati e normalizzati (§42–§44, §61, §207). Estratto da
-- publish_post (HOM-06.1), che ora lo chiama: stesse regole, stessi errori,
-- UNA sola implementazione per publish_post, bozze e programmati.
--   p_prefix  = cartella dei post dell'attore ('<uid>/posts/'): un path fuori
--               dalla cartella è rifiutato (non si referenzia il file di un altro)...
--   p_known   = ...salvo i path già allegati alla stessa bozza (anche caricati da
--               un altro amministratore della Società, §260).
-- Restituisce gli elementi puliti, con `thumbnail_path` oltre alle chiavi di
-- HOM-06.1 (serve a risalvare una bozza con la miniatura del video).
create or replace function public.footme_post_normalize_media(
  p_media  jsonb,
  p_limits jsonb,
  p_prefix text,
  p_known  text[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_clean  jsonb := '[]'::jsonb;
  v_item   jsonb;
  v_ord    integer;
  v_path   text;
  v_thumb  text;
  v_mtype  text;
  v_mime   text;
  v_url    text;
  v_turl   text;
  v_w      integer;
  v_h      integer;
  v_dur    integer;
  v_alt    text;
  v_known  text[] := coalesce(p_known, array[]::text[]);
begin
  if p_media is null or p_media = 'null'::jsonb then
    return '[]'::jsonb;
  end if;

  if jsonb_typeof(p_media) <> 'array' then
    raise exception 'post_invalid_media' using errcode = '22023', detail = 'not_array';
  end if;

  if jsonb_array_length(p_media) > (p_limits ->> 'max_media')::int then
    raise exception 'post_media_limit' using errcode = '22023';
  end if;

  begin
    for v_item, v_ord in
      select e, (o - 1)::int from jsonb_array_elements(p_media) with ordinality as t(e, o)
    loop
      if jsonb_typeof(v_item) <> 'object'
         or coalesce(jsonb_typeof(v_item -> 'storage_path'), '') <> 'string'
         or coalesce(jsonb_typeof(v_item -> 'media_type'), '') <> 'string' then
        raise exception 'post_invalid_media' using errcode = '22023', detail = 'shape';
      end if;

      v_path  := v_item ->> 'storage_path';
      v_mtype := v_item ->> 'media_type';

      if v_mtype not in ('image', 'video')
         or char_length(v_path) > 300
         or not (left(v_path, char_length(p_prefix)) = p_prefix and char_length(v_path) > char_length(p_prefix)
                 or v_path = any (v_known))
         or v_path ~ '(^|/)\.\.(/|$)' or v_path ~ '//' or v_path ~ '[[:cntrl:]]' then
        raise exception 'post_invalid_media' using errcode = '22023', detail = 'path';
      end if;

      if exists (select 1 from jsonb_array_elements(v_clean) c where c ->> 'storage_path' = v_path) then
        raise exception 'post_invalid_media' using errcode = '22023', detail = 'duplicate';
      end if;

      select o.metadata ->> 'mimetype' into v_mime
      from storage.objects o
      where o.bucket_id = 'profile-media' and o.name = v_path;
      if not found
         or (v_mime is not null and v_mime not like v_mtype || '/%') then
        raise exception 'post_invalid_media' using errcode = '22023', detail = 'object';
      end if;

      v_thumb := nullif(v_item ->> 'thumbnail_path', '');
      if v_thumb is not null then
        if char_length(v_thumb) > 300
           or not (left(v_thumb, char_length(p_prefix)) = p_prefix and char_length(v_thumb) > char_length(p_prefix)
                   or v_thumb = any (v_known))
           or v_thumb ~ '(^|/)\.\.(/|$)' or v_thumb ~ '//' or v_thumb ~ '[[:cntrl:]]'
           or not exists (
             select 1 from storage.objects o
             where o.bucket_id = 'profile-media' and o.name = v_thumb) then
          raise exception 'post_invalid_media' using errcode = '22023', detail = 'thumbnail';
        end if;
      end if;

      v_w := nullif(v_item ->> 'width', '')::integer;
      v_h := nullif(v_item ->> 'height', '')::integer;
      v_dur := case when v_mtype = 'video' then nullif(v_item ->> 'duration_seconds', '')::integer end;
      if (v_w is not null and (v_w <= 0 or v_w > 20000))
         or (v_h is not null and (v_h <= 0 or v_h > 20000))
         or (v_dur is not null and v_dur < 0) then
        raise exception 'post_invalid_media' using errcode = '22023', detail = 'size';
      end if;
      if v_dur is not null and v_dur > (p_limits ->> 'max_video_seconds')::int then
        raise exception 'post_invalid_media' using errcode = '22023', detail = 'video_too_long';
      end if;

      v_alt := left(nullif(btrim(coalesce(v_item ->> 'alt_text', '')), ''), 300);

      v_url := public.footme_profile_media_url(v_path);
      v_turl := case when v_thumb is not null then public.footme_profile_media_url(v_thumb) end;
      if v_url is null then
        raise exception 'post_invalid_media' using errcode = '22023', detail = 'storage_base_url_unknown';
      end if;

      v_clean := v_clean || jsonb_build_array(jsonb_build_object(
        'position', v_ord, 'storage_path', v_path, 'media_type', v_mtype,
        'url', v_url, 'thumbnail_url', v_turl, 'thumbnail_path', v_thumb,
        'width', v_w, 'height', v_h,
        'duration_seconds', v_dur, 'alt_text', v_alt));
    end loop;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'post_invalid_media' using errcode = '22023', detail = 'cast';
  end;

  return v_clean;
end;
$$;

revoke all on function public.footme_post_normalize_media(jsonb, jsonb, text, text[]) from public;
revoke execute on function public.footme_post_normalize_media(jsonb, jsonb, text, text[]) from anon, authenticated;


-- ============================================================
-- SEZIONE 7 — documento Articolo strutturato v1 (§48–§71)
--
-- jsonb: {v:1, blocks:[...]}. Il server VALIDA (article_invalid_document + detail)
-- e NORMALIZZA: scarta le chiavi sconosciute, ricostruisce la preview di un
-- rich_link SEMPRE dallo snapshot (mai dal client), accetta solo URL https
-- (http promosso se la policy lo consente), tratta il testo come testo (niente
-- HTML da interpretare). Tre funzioni pure: normalize, testo piano, estratto.
-- ============================================================

-- 7a. Un elemento inline: testo (con marks) o link inline (con testo dentro).
-- Restituisce {node, chars}: il nodo normalizzato (null se da scartare) e i
-- caratteri di testo che porta.
create or replace function public.footme_article_normalize_inline(
  p_inline  jsonb,
  p_allow_link boolean,
  p_upgrade boolean
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_type  text;
  v_text  text;
  v_marks jsonb := '[]'::jsonb;
  v_url   text;
  v_child jsonb;
  v_inner jsonb := '[]'::jsonb;
  v_chars integer := 0;
  v_res   jsonb;
  v_e     jsonb;
begin
  if jsonb_typeof(p_inline) <> 'object' or coalesce(jsonb_typeof(p_inline -> 'type'), '') <> 'string' then
    raise exception 'article_invalid_document' using errcode = '22023', detail = 'inline_shape';
  end if;

  v_type := p_inline ->> 'type';

  if v_type = 'text' then
    if coalesce(jsonb_typeof(p_inline -> 'text'), '') <> 'string' then
      raise exception 'article_invalid_document' using errcode = '22023', detail = 'text';
    end if;
    v_text := p_inline ->> 'text';
    if v_text ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]' then
      raise exception 'article_invalid_document' using errcode = '22023', detail = 'control_chars';
    end if;
    if v_text = '' then
      return jsonb_build_object('node', null, 'chars', 0);
    end if;
    if coalesce(jsonb_typeof(p_inline -> 'marks'), 'null') = 'array' then
      if (p_inline -> 'marks') @> '["bold"]'::jsonb then v_marks := v_marks || '"bold"'::jsonb; end if;
      if (p_inline -> 'marks') @> '["italic"]'::jsonb then v_marks := v_marks || '"italic"'::jsonb; end if;
    end if;
    return jsonb_build_object(
      'node', case when jsonb_array_length(v_marks) > 0
                   then jsonb_build_object('type', 'text', 'text', v_text, 'marks', v_marks)
                   else jsonb_build_object('type', 'text', 'text', v_text) end,
      'chars', char_length(v_text));
  end if;

  if v_type = 'inline_link' then
    if not p_allow_link then
      raise exception 'article_invalid_document' using errcode = '22023', detail = 'nested_link';
    end if;
    if coalesce(jsonb_typeof(p_inline -> 'url'), '') <> 'string'
       or coalesce(jsonb_typeof(p_inline -> 'content'), '') <> 'array' then
      raise exception 'article_invalid_document' using errcode = '22023', detail = 'link_shape';
    end if;
    v_url := public.footme_safe_https_url(p_inline ->> 'url', p_upgrade);
    if v_url is null then
      raise exception 'article_invalid_document' using errcode = '22023', detail = 'link_url';
    end if;
    for v_child in select e from jsonb_array_elements(p_inline -> 'content') e loop
      v_res := public.footme_article_normalize_inline(v_child, false, p_upgrade);
      if jsonb_typeof(v_res -> 'node') = 'object' then
        v_inner := v_inner || jsonb_build_array(v_res -> 'node');
        v_chars := v_chars + (v_res ->> 'chars')::int;
      end if;
    end loop;
    -- Un link senza testo non ha niente da mostrare: scartato.
    if jsonb_array_length(v_inner) = 0 then
      return jsonb_build_object('node', null, 'chars', 0);
    end if;
    return jsonb_build_object(
      'node', jsonb_build_object('type', 'inline_link', 'url', v_url, 'content', v_inner),
      'chars', v_chars);
  end if;

  raise exception 'article_invalid_document' using errcode = '22023', detail = 'inline_type';
end;
$$;

revoke all on function public.footme_article_normalize_inline(jsonb, boolean, boolean) from public;
revoke execute on function public.footme_article_normalize_inline(jsonb, boolean, boolean) from anon, authenticated;

-- 7b. Contenuto inline di un blocco o di un elemento di lista.
create or replace function public.footme_article_normalize_content(
  p_content   jsonb,
  p_max_chars integer,
  p_upgrade   boolean
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_out   jsonb := '[]'::jsonb;
  v_chars integer := 0;
  v_e     jsonb;
  v_res   jsonb;
begin
  if p_content is null or p_content = 'null'::jsonb then
    return '[]'::jsonb;
  end if;
  if jsonb_typeof(p_content) <> 'array' then
    raise exception 'article_invalid_document' using errcode = '22023', detail = 'content_shape';
  end if;
  if jsonb_array_length(p_content) > 2000 then
    raise exception 'article_invalid_document' using errcode = '22023', detail = 'too_many_inlines';
  end if;

  for v_e in select e from jsonb_array_elements(p_content) e loop
    v_res := public.footme_article_normalize_inline(v_e, true, p_upgrade);
    if jsonb_typeof(v_res -> 'node') = 'object' then
      v_out := v_out || jsonb_build_array(v_res -> 'node');
      v_chars := v_chars + (v_res ->> 'chars')::int;
    end if;
  end loop;

  if v_chars > p_max_chars then
    raise exception 'article_invalid_document' using errcode = '22023', detail = 'block_text_too_long';
  end if;

  return v_out;
end;
$$;

revoke all on function public.footme_article_normalize_content(jsonb, integer, boolean) from public;
revoke execute on function public.footme_article_normalize_content(jsonb, integer, boolean) from anon, authenticated;

-- 7c. Testo piano di una lista di inline (link compresi, solo il loro testo).
create or replace function public.footme_article_inline_text(p_content jsonb)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_out text := '';
  v_e   jsonb;
begin
  for v_e in select e from jsonb_array_elements(coalesce(p_content, '[]'::jsonb)) e loop
    if v_e ->> 'type' = 'text' then
      v_out := v_out || coalesce(v_e ->> 'text', '');
    elsif v_e ->> 'type' = 'inline_link' then
      v_out := v_out || public.footme_article_inline_text(v_e -> 'content');
    end if;
  end loop;
  return v_out;
end;
$$;

revoke all on function public.footme_article_inline_text(jsonb) from public;
revoke execute on function public.footme_article_inline_text(jsonb) from anon, authenticated;

-- 7d. Documento → documento normalizzato. p_limits = footme_article_limits().
-- Nessun accesso a tabelle tranne lo snapshot dei rich_link (letto per id, per
-- ricostruire la preview). Solleva article_invalid_document / article_body_too_long.
create or replace function public.footme_article_normalize_document(
  p_doc    jsonb,
  p_limits jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_upgrade   boolean := coalesce((select (s.value #>> '{}')::boolean from public.app_policy_settings s
                                   where s.key = 'article.upgrade_http_links'), true);
  v_max_blocks integer := (p_limits ->> 'max_blocks')::int;
  v_max_text  integer := (p_limits ->> 'max_block_text')::int;
  v_max_body  integer := (p_limits ->> 'max_body_length')::int;
  v_blocks    jsonb := '[]'::jsonb;
  v_ids       text[] := array[]::text[];
  v_nodes     integer := 0;
  v_b         jsonb;
  v_it        jsonb;
  v_items     jsonb;
  v_btype     text;
  v_id        text;
  v_content   jsonb;
  v_url       text;
  v_sid       uuid;
  v_snap      public.link_preview_snapshots;
  v_preview   jsonb;
  v_doc       jsonb;
begin
  if p_doc is null or p_doc = 'null'::jsonb then
    return jsonb_build_object('v', 1, 'blocks', '[]'::jsonb);
  end if;

  if jsonb_typeof(p_doc) <> 'object'
     or coalesce(p_doc ->> 'v', '') <> '1'
     or coalesce(jsonb_typeof(p_doc -> 'blocks'), '') <> 'array' then
    raise exception 'article_invalid_document' using errcode = '22023', detail = 'shape';
  end if;

  if jsonb_array_length(p_doc -> 'blocks') > v_max_blocks then
    raise exception 'article_invalid_document' using errcode = '22023', detail = 'too_many_blocks';
  end if;

  for v_b in select e from jsonb_array_elements(p_doc -> 'blocks') e loop
    v_nodes := v_nodes + 1;
    if jsonb_typeof(v_b) <> 'object'
       or coalesce(jsonb_typeof(v_b -> 'type'), '') <> 'string'
       or coalesce(jsonb_typeof(v_b -> 'id'), '') <> 'string' then
      raise exception 'article_invalid_document' using errcode = '22023', detail = 'block_shape';
    end if;

    v_btype := v_b ->> 'type';
    v_id := v_b ->> 'id';
    if v_id !~ '^[A-Za-z0-9_-]{1,40}$' or v_id = any (v_ids) then
      raise exception 'article_invalid_document' using errcode = '22023', detail = 'block_id';
    end if;
    v_ids := v_ids || v_id;

    if v_btype in ('paragraph', 'heading') then
      v_content := public.footme_article_normalize_content(v_b -> 'content', v_max_text, v_upgrade);
      v_blocks := v_blocks || jsonb_build_array(jsonb_build_object(
        'id', v_id, 'type', v_btype, 'content', v_content));

    elsif v_btype in ('unordered_list', 'ordered_list') then
      if coalesce(jsonb_typeof(v_b -> 'items'), '') <> 'array' then
        raise exception 'article_invalid_document' using errcode = '22023', detail = 'list_items';
      end if;
      v_nodes := v_nodes + jsonb_array_length(v_b -> 'items');
      if v_nodes > v_max_blocks then
        raise exception 'article_invalid_document' using errcode = '22023', detail = 'too_many_blocks';
      end if;
      v_items := '[]'::jsonb;
      for v_it in select e from jsonb_array_elements(v_b -> 'items') e loop
        if jsonb_typeof(v_it) <> 'object' or coalesce(jsonb_typeof(v_it -> 'id'), '') <> 'string' then
          raise exception 'article_invalid_document' using errcode = '22023', detail = 'item_shape';
        end if;
        v_id := v_it ->> 'id';
        if v_id !~ '^[A-Za-z0-9_-]{1,40}$' or v_id = any (v_ids) then
          raise exception 'article_invalid_document' using errcode = '22023', detail = 'item_id';
        end if;
        v_ids := v_ids || v_id;
        v_items := v_items || jsonb_build_array(jsonb_build_object(
          'id', v_id,
          'content', public.footme_article_normalize_content(v_it -> 'content', v_max_text, v_upgrade)));
      end loop;
      v_blocks := v_blocks || jsonb_build_array(jsonb_build_object(
        'id', v_b ->> 'id', 'type', v_btype, 'items', v_items));

    elsif v_btype = 'rich_link' then
      if coalesce(jsonb_typeof(v_b -> 'url'), '') <> 'string' then
        raise exception 'article_invalid_document' using errcode = '22023', detail = 'rich_link_url';
      end if;
      v_url := public.footme_safe_https_url(v_b ->> 'url', v_upgrade);
      if v_url is null then
        raise exception 'article_invalid_document' using errcode = '22023', detail = 'rich_link_url';
      end if;

      -- La preview si ricostruisce SEMPRE dallo snapshot che corrisponde
      -- all'URL: quella inviata dal client non si legge. Snapshot assente o di
      -- un altro URL = nessuna preview (il client ripiega sul dominio).
      v_sid := null;
      v_preview := null;
      if coalesce(jsonb_typeof(v_b -> 'snapshot_id'), 'null') = 'string' then
        begin
          v_sid := (v_b ->> 'snapshot_id')::uuid;
        exception when invalid_text_representation then
          v_sid := null;
        end;
      end if;
      if v_sid is not null then
        select * into v_snap from public.link_preview_snapshots s where s.id = v_sid;
        if found and (v_snap.original_url = v_url
                      or v_snap.final_url = v_url
                      or v_snap.normalized_url = public.footme_normalize_url(v_url)) then
          v_preview := jsonb_strip_nulls(jsonb_build_object(
            'final_url',   v_snap.final_url,
            'title',       v_snap.title,
            'description', v_snap.description,
            'image_url',   v_snap.image_url,
            'favicon_url', v_snap.favicon_url,
            'domain',      v_snap.domain,
            'site_name',   v_snap.site_name));
        else
          v_sid := null;
        end if;
      end if;

      v_blocks := v_blocks || jsonb_build_array(jsonb_build_object(
        'id', v_id, 'type', 'rich_link', 'url', v_url,
        'snapshot_id', v_sid, 'preview', v_preview));
    else
      raise exception 'article_invalid_document' using errcode = '22023', detail = 'block_type';
    end if;
  end loop;

  v_doc := jsonb_build_object('v', 1, 'blocks', v_blocks);

  if char_length(public.footme_article_document_text(v_doc)) > v_max_body then
    raise exception 'article_body_too_long' using errcode = '22023';
  end if;

  return v_doc;
end;
$$;

revoke all on function public.footme_article_normalize_document(jsonb, jsonb) from public;
revoke execute on function public.footme_article_normalize_document(jsonb, jsonb) from anon, authenticated;

-- 7e. Testo piano: blocchi separati da riga vuota, un elemento di lista per riga.
-- I rich_link non portano testo (il loro URL non è prosa).
create or replace function public.footme_article_document_text(p_doc jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(string_agg(t.txt, E'\n\n' order by t.o), '')
  from (
    select b.o,
           case b.e ->> 'type'
             when 'paragraph' then public.footme_article_inline_text(b.e -> 'content')
             when 'heading'   then public.footme_article_inline_text(b.e -> 'content')
             when 'unordered_list' then (
               select string_agg(public.footme_article_inline_text(i.e -> 'content'), E'\n' order by i.o)
               from jsonb_array_elements(coalesce(b.e -> 'items', '[]'::jsonb)) with ordinality as i(e, o))
             when 'ordered_list' then (
               select string_agg(public.footme_article_inline_text(i.e -> 'content'), E'\n' order by i.o)
               from jsonb_array_elements(coalesce(b.e -> 'items', '[]'::jsonb)) with ordinality as i(e, o))
             else ''
           end as txt
    from jsonb_array_elements(coalesce(p_doc -> 'blocks', '[]'::jsonb)) with ordinality as b(e, o)
  ) t
  where btrim(coalesce(t.txt, '')) <> '';
$$;

revoke all on function public.footme_article_document_text(jsonb) from public;
revoke execute on function public.footme_article_document_text(jsonb) from anon, authenticated;

-- 7f. Estratto: il primo paragrafo o titolo con testo, senza URL (un URL lungo
-- non è un estratto), spazi compattati, troncato a p_len con «…».
create or replace function public.footme_article_excerpt(p_doc jsonb, p_len integer)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_b   jsonb;
  v_txt text;
begin
  for v_b in select e from jsonb_array_elements(coalesce(p_doc -> 'blocks', '[]'::jsonb)) e loop
    if v_b ->> 'type' in ('paragraph', 'heading') then
      v_txt := regexp_replace(public.footme_article_inline_text(v_b -> 'content'), 'https?://\S+', ' ', 'gi');
      v_txt := btrim(regexp_replace(v_txt, '\s+', ' ', 'g'));
      if v_txt <> '' then
        if char_length(v_txt) > p_len then
          return btrim(left(v_txt, greatest(p_len - 1, 1))) || '…';
        end if;
        return v_txt;
      end if;
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.footme_article_excerpt(jsonb, integer) from public;
revoke execute on function public.footme_article_excerpt(jsonb, integer) from anon, authenticated;

-- 7g. Il documento ha contenuto? Testo non bianco, o almeno un rich_link.
create or replace function public.footme_article_document_is_meaningful(p_doc jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select regexp_replace(public.footme_article_document_text(p_doc), '\s', '', 'g') <> ''
      or exists (
        select 1 from jsonb_array_elements(coalesce(p_doc -> 'blocks', '[]'::jsonb)) b
        where b ->> 'type' = 'rich_link');
$$;

revoke all on function public.footme_article_document_is_meaningful(jsonb) from public;
revoke execute on function public.footme_article_document_is_meaningful(jsonb) from anon, authenticated;


-- ============================================================
-- SEZIONE 8 — regole del lifecycle: UNA sola per ciascuna cosa
--
--   * footme_publication_parse / footme_schedule_check: forma e limiti di una
--     programmazione (§95–§102).
--   * footme_content_blocker: «questo contenuto, così com'è salvato, si può
--     pubblicare / programmare?». Lavora sullo STATO SALVATO, non su un payload:
--     lo usano submit_content, schedule_content, publish_content_now, il worker
--     (§7W: nessun nuovo scraping, si pubblica lo snapshot salvato) e l'elenco
--     (schedulable / unschedulable_reason). Un solo posto che dice cosa manca.
--   * footme_content_raise_blocker: il motivo → il codice errore del contratto.
-- ============================================================

-- 8a. Forma di una programmazione. {mode:'now'} | {mode:'keep'} (solo se
-- consentito) | {mode:'scheduled', scheduled_at, timezone}. Restituisce
-- {mode, scheduled_at, timezone} con scheduled_at in ISO-8601 UTC.
create or replace function public.footme_publication_parse(
  p_publication jsonb,
  p_allow_keep  boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_at   timestamptz;
  v_tz   text;
  v_raw  text;
begin
  if p_publication is null or p_publication = 'null'::jsonb then
    return jsonb_build_object('mode', 'now', 'scheduled_at', null, 'timezone', null);
  end if;

  if jsonb_typeof(p_publication) <> 'object'
     or coalesce(jsonb_typeof(p_publication -> 'mode'), '') <> 'string' then
    raise exception 'publication_invalid' using errcode = '22023', detail = 'shape';
  end if;

  v_mode := p_publication ->> 'mode';

  if v_mode = 'now' then
    return jsonb_build_object('mode', 'now', 'scheduled_at', null, 'timezone', null);
  end if;

  if v_mode = 'keep' and p_allow_keep then
    return jsonb_build_object('mode', 'keep', 'scheduled_at', null, 'timezone', null);
  end if;

  if v_mode = 'scheduled' then
    if coalesce(jsonb_typeof(p_publication -> 'scheduled_at'), '') <> 'string'
       or coalesce(jsonb_typeof(p_publication -> 'timezone'), '') <> 'string' then
      raise exception 'publication_invalid' using errcode = '22023', detail = 'fields';
    end if;

    v_raw := btrim(p_publication ->> 'scheduled_at');
    -- Solo un istante con fuso esplicito: «20:00» senza offset non è un istante.
    if v_raw !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}(:?\d{2})?)$' then
      raise exception 'publication_invalid' using errcode = '22023', detail = 'scheduled_at';
    end if;
    begin
      v_at := v_raw::timestamptz;
    exception when others then
      raise exception 'publication_invalid' using errcode = '22023', detail = 'scheduled_at';
    end;

    v_tz := btrim(p_publication ->> 'timezone');
    if v_tz = '' or char_length(v_tz) > 64
       or not exists (select 1 from pg_timezone_names z where z.name = v_tz) then
      raise exception 'publication_invalid' using errcode = '22023', detail = 'timezone';
    end if;

    return jsonb_build_object(
      'mode', 'scheduled',
      'scheduled_at', to_char(v_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'timezone', v_tz);
  end if;

  raise exception 'publication_invalid' using errcode = '22023', detail = 'mode';
end;
$$;

revoke all on function public.footme_publication_parse(jsonb, boolean) from public;
revoke execute on function public.footme_publication_parse(jsonb, boolean) from anon, authenticated;

-- 8b. Limiti dell'istante (§95–§98, §189): futuro, con l'anticipo minimo e
-- dentro l'orizzonte. Un istante già passato è schedule_in_past (anche se l'ora
-- è «passata mentre il composer era aperto»: si rivalida alla conferma, §98).
-- p_check_lead = false per una modifica che lascia la data com'è: basta che sia
-- ancora nel futuro.
create or replace function public.footme_schedule_check(
  p_at         timestamptz,
  p_check_lead boolean
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pol jsonb := public.footme_schedule_policy();
  v_now timestamptz := clock_timestamp();
begin
  if p_at is null or p_at <= v_now then
    raise exception 'schedule_in_past' using errcode = '22023';
  end if;
  if p_check_lead
     and p_at < v_now + make_interval(mins => (v_pol ->> 'min_lead_minutes')::int) then
    raise exception 'schedule_too_soon' using errcode = '22023';
  end if;
  if p_at > v_now + make_interval(days => (v_pol ->> 'max_horizon_days')::int) then
    raise exception 'schedule_too_far' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.footme_schedule_check(timestamptz, boolean) from public;
revoke execute on function public.footme_schedule_check(timestamptz, boolean) from anon, authenticated;

-- 8c. Impronta della provenienza di un testo importato (§7Q): se cambia, la
-- conferma dei diritti non vale più. Dentro: identità, modalità, dichiarazione
-- «già pubblicato altrove», fonte, autore e URL originali.
create or replace function public.footme_article_rights_fingerprint(
  p_identity_type       text,
  p_identity_id         uuid,
  p_mode                text,
  p_published_elsewhere boolean,
  p_source_name         text,
  p_original_author     text,
  p_original_url        text,
  p_no_original_link    boolean
)
returns text
language sql
immutable
set search_path = public
as $$
  select md5(jsonb_build_object(
    'identity_type', p_identity_type,
    'identity_id',   p_identity_id,
    'mode',          p_mode,
    'published_elsewhere', p_published_elsewhere,
    'source_name',   coalesce(p_source_name, ''),
    'original_author', coalesce(p_original_author, ''),
    'original_url',  coalesce(p_original_url, ''),
    'no_original_link', coalesce(p_no_original_link, false))::text);
$$;

revoke all on function public.footme_article_rights_fingerprint(text, uuid, text, boolean, text, text, text, boolean) from public;
revoke execute on function public.footme_article_rights_fingerprint(text, uuid, text, boolean, text, text, text, boolean) from anon, authenticated;

-- 8d. La conferma dei diritti salvata vale ancora per la provenienza attuale?
create or replace function public.footme_article_rights_valid(
  p_content_type text,
  p_post_id      uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select rc.source_reference ->> 'fingerprint'
           = public.footme_article_rights_fingerprint(
               rc.identity_type, rc.identity_id, a.creation_mode, a.published_elsewhere,
               a.original_source_name, a.original_author, a.original_url, a.no_original_link)
           and rc.identity_id = l.l_identity_id
           and rc.identity_type = l.l_identity_type
    from public.content_articles a
    join public.article_rights_confirmations rc on rc.id = a.rights_confirmation_id
    cross join public.footme_content_load(p_content_type, p_post_id, false) l
    where a.content_type = p_content_type and a.post_id = p_post_id
  ), false);
$$;

revoke all on function public.footme_article_rights_valid(text, uuid) from public;
revoke execute on function public.footme_article_rights_valid(text, uuid) from anon, authenticated;

-- 8e. Duplicati external_link (§7M, §219): per la STESSA identità editoriale, un
-- altro Articolo `published`, `scheduled` o `publishing` con la stessa fonte
-- canonica. Le bozze e i falliti non contano (non sono «attivi», e non si
-- rivelano). Restituisce {content_type, content_id} dell'altro Articolo.
create or replace function public.footme_article_duplicate_of(
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
  v_key text;
  v_out jsonb;
begin
  select a.source_key into v_key
  from public.content_articles a
  where a.content_type = p_content_type and a.post_id = p_post_id
    and a.creation_mode = 'external_link';

  if v_key is null then
    return null;
  end if;

  if p_content_type = 'club_media' then
    select jsonb_build_object('content_type', 'club_media', 'content_id', o.post_id) into v_out
    from public.content_articles o
    join public.club_media_posts mo on mo.id = o.post_id
    join public.club_media_posts me on me.id = p_post_id
    where o.content_type = 'club_media'
      and o.source_key = v_key
      and o.post_id <> p_post_id
      and mo.club_id = me.club_id
      and mo.status in ('published', 'scheduled', 'publishing')
    order by (mo.status = 'published') desc, mo.created_at
    limit 1;
  elsif p_content_type = 'media_profile' then
    select jsonb_build_object('content_type', 'media_profile', 'content_id', o.post_id) into v_out
    from public.content_articles o
    join public.media_profile_posts mo on mo.id = o.post_id
    join public.media_profile_posts me on me.id = p_post_id
    where o.content_type = 'media_profile'
      and o.source_key = v_key
      and o.post_id <> p_post_id
      and mo.media_profile_id = me.media_profile_id
      and mo.status in ('published', 'scheduled', 'publishing')
    order by (mo.status = 'published') desc, mo.created_at
    limit 1;
  end if;

  return v_out;
end;
$$;

revoke all on function public.footme_article_duplicate_of(text, uuid) from public;
revoke execute on function public.footme_article_duplicate_of(text, uuid) from anon, authenticated;

-- 8f. Il contenuto SALVATO si può pubblicare? null = sì; altrimenti il motivo.
--   p_mode 'now'      = pubblicazione immediata (§110: un video in processing non
--                       blocca; uno fallito sì);
--   p_mode 'schedule' = programmazione (§107: media pronti e già nello storage);
--   p_mode 'worker'   = pubblicazione all'ora prevista e retry (come 'schedule');
--   p_mode 'edit'     = modifica di un Articolo GIÀ pubblicato: come 'now' ma senza
--                       il controllo di capability di pubblicazione (decide
--                       footme_content_rights.r_can_edit, verificato da chi chiama).
-- Motivi: not_found, capability, schedule_capability, empty, missing_title,
-- title_too_long, media_not_ready, rights, source_required, source_invalid,
-- duplicate.
create or replace function public.footme_content_blocker(
  p_content_type text,
  p_id           uuid,
  p_actor        uuid,
  p_mode         text
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l       record;
  v_cap   record;
  v_body  text;
  v_title text;
  v_ex    public.content_post_extras;
  v_art   public.content_articles;
  v_lim   jsonb;
  v_n     integer;
begin
  select * into l from public.footme_content_load(p_content_type, p_id, false);
  if not found or l.l_status = 'deleted' or l.l_format is null then
    return 'not_found';
  end if;

  if p_mode <> 'edit' then
    select * into v_cap
    from public.footme_publishing_identities(p_actor) i
    where i.c_type = l.l_identity_type and i.c_id = l.l_identity_id;

    if not found
       or not (case l.l_format when 'post' then v_cap.can_post else v_cap.can_article end) then
      return 'capability';
    end if;
    if p_mode in ('schedule', 'worker') and not v_cap.can_schedule then
      return 'schedule_capability';
    end if;
  end if;

  if l.l_format = 'post' then
    v_body := case p_content_type
      when 'profile_post'  then (select x.body from public.profile_posts x where x.id = p_id)
      when 'club_media'    then (select x.body from public.club_media_posts x where x.id = p_id)
      else                      (select x.body from public.media_profile_posts x where x.id = p_id)
    end;

    select * into v_ex from public.content_post_extras x
    where x.content_type = p_content_type and x.post_id = p_id;

    select count(*)::int into v_n from public.content_post_media m
    where m.content_type = p_content_type and m.post_id = p_id;

    if not (public.footme_post_text_is_meaningful(coalesce(v_body, ''), coalesce(v_ex.mentions, '[]'::jsonb))
            or v_n > 0
            or v_ex.link_target is not null) then
      return 'empty';
    end if;

    if p_mode in ('now', 'edit') then
      if exists (select 1 from public.content_post_media m
                 where m.content_type = p_content_type and m.post_id = p_id
                   and m.processing_state = 'failed') then
        return 'media_not_ready';
      end if;
    elsif exists (
      select 1 from public.content_post_media m
      where m.content_type = p_content_type and m.post_id = p_id
        and (m.processing_state <> 'ready'
             or (m.storage_path is not null and not exists (
                   select 1 from storage.objects o
                   where o.bucket_id = 'profile-media' and o.name = m.storage_path))
             or (m.thumbnail_storage_path is not null and not exists (
                   select 1 from storage.objects o
                   where o.bucket_id = 'profile-media' and o.name = m.thumbnail_storage_path)))) then
      return 'media_not_ready';
    end if;

    return null;
  end if;

  -- Articolo
  v_lim := public.footme_article_limits();
  select * into v_art from public.content_articles a
  where a.content_type = p_content_type and a.post_id = p_id;
  if not found then
    return 'empty';
  end if;

  v_title := btrim(case p_content_type
    when 'club_media' then (select x.title from public.club_media_posts x where x.id = p_id)
    else                   (select x.title from public.media_profile_posts x where x.id = p_id)
  end);

  if coalesce(v_title, '') = '' then
    return 'missing_title';
  end if;
  if char_length(v_title) > (v_lim ->> 'max_title_length')::int then
    return 'title_too_long';
  end if;

  if v_art.creation_mode = 'external_link' then
    if v_art.source_url is null then
      return 'source_required';
    end if;
    -- §7L: la destinazione deve essere stata validata. Vale la COPIA persistita
    -- dello snapshot (source_snapshot): la riga di link_preview_snapshots può
    -- sparire (pulizia) senza far perdere il contenuto (§7W). Senza copia,
    -- Pubblica/Programma restano bloccati e il client offre Riprova.
    if v_art.source_snapshot is null then
      return 'source_invalid';
    end if;
    if public.footme_article_duplicate_of(p_content_type, p_id) is not null then
      return 'duplicate';
    end if;
    return null;
  end if;

  if not public.footme_article_document_is_meaningful(v_art.document) then
    return 'empty';
  end if;

  if v_art.creation_mode = 'imported_text' then
    if v_art.published_elsewhere is null then
      return 'source_required';
    end if;
    if v_art.published_elsewhere
       and (coalesce(btrim(v_art.original_source_name), '') = ''
            or (v_art.original_url is null and not v_art.no_original_link)) then
      return 'source_required';
    end if;
    if not public.footme_article_rights_valid(p_content_type, p_id) then
      return 'rights';
    end if;
  end if;

  return null;
end;
$$;

revoke all on function public.footme_content_blocker(text, uuid, uuid, text) from public;
revoke execute on function public.footme_content_blocker(text, uuid, uuid, text) from anon, authenticated;

-- 8g. Motivo → codice errore del contratto (A8). null = niente da sollevare.
create or replace function public.footme_content_raise_blocker(
  p_code         text,
  p_content_type text,
  p_id           uuid
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_code is null then
    return;
  end if;

  case p_code
    when 'not_found' then
      raise exception 'content_not_found' using errcode = 'P0002';
    when 'capability' then
      raise exception 'content_permission_denied' using errcode = '42501';
    when 'schedule_capability' then
      raise exception 'schedule_not_allowed' using errcode = '42501';
    when 'empty' then
      raise exception 'content_empty' using errcode = '22023';
    when 'missing_title' then
      raise exception 'article_missing_title' using errcode = '22023';
    when 'title_too_long' then
      raise exception 'article_title_too_long' using errcode = '22023';
    when 'media_not_ready' then
      raise exception 'schedule_media_not_ready' using errcode = '22023';
    when 'rights' then
      raise exception 'article_rights_required' using errcode = '22023';
    when 'source_required' then
      raise exception 'article_source_required' using errcode = '22023';
    when 'source_invalid' then
      raise exception 'article_invalid_source' using errcode = '22023', detail = 'snapshot';
    when 'duplicate' then
      raise exception 'article_duplicate' using errcode = '23505',
        detail = coalesce(public.footme_article_duplicate_of(p_content_type, p_id)::text, '{}');
    else
      raise exception 'content_invalid_state' using errcode = '55000', detail = p_code;
  end case;
end;
$$;

revoke all on function public.footme_content_raise_blocker(text, text, uuid) from public;
revoke execute on function public.footme_content_raise_blocker(text, text, uuid) from anon, authenticated;

-- 8h. Il motivo come lo vede l'elenco (§151, §156): sei valori chiusi.
create or replace function public.footme_content_blocker_reason(p_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_code is null then null
    when p_code = 'missing_title'   then 'missing_title'
    when p_code = 'title_too_long' then 'missing_title'
    when p_code = 'empty' then 'empty'
    when p_code = 'media_not_ready' then 'media_not_ready'
    when p_code = 'rights' then 'rights'
    when p_code = 'source_required' then 'source'
    when p_code = 'source_invalid' then 'source'
    when p_code = 'duplicate' then 'source'
    else 'capability'
  end;
$$;

revoke all on function public.footme_content_blocker_reason(text) from public;
revoke execute on function public.footme_content_blocker_reason(text) from anon, authenticated;

-- 8i. Il contenuto salvato è «significativo» (§118)? Una bozza vuota non si
-- crea né si salva (content_empty): nessun draft server fantasma.
--   Post     = testo (senza mention), media o link.
--   Articolo = titolo, corpo, cover, fonte, tag.
create or replace function public.footme_content_is_significant(
  p_content_type text,
  p_id           uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l       record;
  v_body  text;
  v_ex    public.content_post_extras;
  v_art   public.content_articles;
  v_title text;
  v_tags  integer;
begin
  select * into l from public.footme_content_load(p_content_type, p_id, false);
  if not found or l.l_format is null then
    return false;
  end if;

  if l.l_format = 'post' then
    v_body := case p_content_type
      when 'profile_post'  then (select x.body from public.profile_posts x where x.id = p_id)
      when 'club_media'    then (select x.body from public.club_media_posts x where x.id = p_id)
      else                      (select x.body from public.media_profile_posts x where x.id = p_id)
    end;
    select * into v_ex from public.content_post_extras x
    where x.content_type = p_content_type and x.post_id = p_id;

    return public.footme_post_text_is_meaningful(coalesce(v_body, ''), coalesce(v_ex.mentions, '[]'::jsonb))
        or exists (select 1 from public.content_post_media m
                   where m.content_type = p_content_type and m.post_id = p_id)
        or v_ex.link_target is not null;
  end if;

  select * into v_art from public.content_articles a
  where a.content_type = p_content_type and a.post_id = p_id;
  if not found then
    return false;
  end if;

  v_title := btrim(case p_content_type
    when 'club_media' then (select x.title from public.club_media_posts x where x.id = p_id)
    else                   (select x.title from public.media_profile_posts x where x.id = p_id)
  end);

  v_tags := case p_content_type
    when 'club_media' then (select count(*) from public.club_media_tagged_profiles t where t.post_id = p_id)
    else                   (select count(*) from public.media_profile_post_tagged_targets t where t.post_id = p_id)
  end;

  return coalesce(v_title, '') <> ''
      or public.footme_article_document_is_meaningful(v_art.document)
      or v_art.cover is not null
      or v_art.source_url is not null
      or v_tags > 0;
end;
$$;

revoke all on function public.footme_content_is_significant(text, uuid) from public;
revoke execute on function public.footme_content_is_significant(text, uuid) from anon, authenticated;

-- 8j. Audit con l'attore reale (§25 di HOM-04), mai nel payload.
create or replace function public.footme_content_audit(
  p_content_type text,
  p_post_id      uuid,
  p_actor        uuid,
  p_identity_type text,
  p_identity_id  uuid,
  p_action       text,
  p_result       text
)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.content_management_audit
    (content_type, post_id, actor_user_id, acting_identity_type, acting_identity_id, action, result)
  values
    (p_content_type, p_post_id, p_actor, p_identity_type, p_identity_id, p_action, p_result);
$$;

revoke all on function public.footme_content_audit(text, uuid, uuid, text, uuid, text, text) from public;
revoke execute on function public.footme_content_audit(text, uuid, uuid, text, uuid, text, text) from anon, authenticated;

-- 8k. Cambio di stato: l'UNICO punto che muove status, lifecycle e versione.
-- L'UPDATE condizionato allo stato atteso (compare-and-set) è ciò che rende
-- una sola transizione vincente anche se due chiamate arrivassero insieme
-- (le RPC prendono già `for update`: questa è la seconda difesa).
-- Restituisce la nuova versione, o null se lo stato non era quello atteso.
create or replace function public.footme_content_set_state(
  p_content_type  text,
  p_id            uuid,
  p_from          text[],
  p_to            text,
  p_scheduled_at  timestamptz,
  p_timezone      text,
  p_scheduled_by  uuid,
  p_failure       text,
  p_publish       boolean,
  p_attempt       boolean
)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_table text := public.footme_content_table(p_content_type);
  v_ver   integer;
begin
  if v_table is null or v_table not in ('profile_posts', 'club_media_posts', 'media_profile_posts') then
    return null;
  end if;

  execute format(
    'update public.%I set
        status = $3,
        scheduled_at = $4,
        schedule_timezone = $5,
        scheduled_by_profile_id = $6,
        publish_failure_code = $7,
        published_at = case when $8 then clock_timestamp() else published_at end,
        publish_attempts = publish_attempts + case when $9 then 1 else 0 end,
        last_publish_attempt_at = case when $9 then clock_timestamp() else last_publish_attempt_at end,
        content_version = content_version + 1,
        updated_at = clock_timestamp()
      where id = $1 and status = any ($2)
      returning content_version', v_table)
    into v_ver
    using p_id, p_from, p_to, p_scheduled_at, p_timezone, p_scheduled_by, p_failure, p_publish, p_attempt;

  return v_ver;
end;
$$;

revoke all on function public.footme_content_set_state(text, uuid, text[], text, timestamptz, text, uuid, text, boolean, boolean) from public;
revoke execute on function public.footme_content_set_state(text, uuid, text[], text, timestamptz, text, uuid, text, boolean, boolean) from anon, authenticated;


-- ============================================================
-- SEZIONE 9 — scrittura del contenuto (bozza, programmato, articolo pubblicato)
--
-- Tutto passa da qui: save_content_draft e submit_content PERSISTONO con le
-- stesse funzioni e poi la regola unica (footme_content_blocker) giudica lo
-- stato salvato. Validazione lasca qui (forme, limiti, ownership degli asset);
-- completezza dopo, sullo stato salvato, nella stessa transazione: se manca
-- qualcosa l'eccezione annulla anche la scrittura.
-- ============================================================

-- 9a. Tag di un contenuto non ancora pubblicato: sostituzione completa (nessuno
-- può averli moderati, la riga non è visibile). Per un Articolo pubblicato che
-- si modifica (p_keep_moderated) si tolgono solo gli attivi non più richiesti:
-- un tag nascosto o segnalato dalla persona taggata non viene riattivato.
create or replace function public.footme_content_replace_tags(
  p_content_type   text,
  p_id             uuid,
  p_tags           jsonb,
  p_keep_moderated boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_t jsonb;
begin
  if p_content_type = 'profile_post' then
    delete from public.profile_post_tagged_targets tt
    where tt.post_id = p_id
      and (not p_keep_moderated or tt.status = 'active')
      and not exists (
        select 1 from jsonb_array_elements(p_tags) e
        where e ->> 'target_type' = tt.target_type and (e ->> 'target_id')::uuid = tt.target_id);
  elsif p_content_type = 'club_media' then
    delete from public.club_media_tagged_profiles tt
    where tt.post_id = p_id
      and (not p_keep_moderated or tt.status = 'active')
      and not exists (
        select 1 from jsonb_array_elements(p_tags) e
        where e ->> 'target_type' = tt.target_type
          and (e ->> 'target_id')::uuid = coalesce(tt.target_id, tt.profile_id));
  else
    delete from public.media_profile_post_tagged_targets tt
    where tt.post_id = p_id
      and (not p_keep_moderated or tt.status = 'active')
      and not exists (
        select 1 from jsonb_array_elements(p_tags) e
        where e ->> 'target_type' = tt.target_type and (e ->> 'target_id')::uuid = tt.target_id);
  end if;

  for v_t in select e from jsonb_array_elements(p_tags) e loop
    if p_content_type = 'profile_post' then
      insert into public.profile_post_tagged_targets (post_id, target_type, target_id)
      values (p_id, v_t ->> 'target_type', (v_t ->> 'target_id')::uuid)
      on conflict do nothing;
    elsif p_content_type = 'club_media' then
      insert into public.club_media_tagged_profiles (post_id, target_type, target_id, profile_id)
      select p_id, v_t ->> 'target_type', (v_t ->> 'target_id')::uuid,
             case when v_t ->> 'target_type' = 'profile' then (v_t ->> 'target_id')::uuid end
      where not exists (
        select 1 from public.club_media_tagged_profiles x
        where x.post_id = p_id and x.target_type = v_t ->> 'target_type'
          and coalesce(x.target_id, x.profile_id) = (v_t ->> 'target_id')::uuid);
    else
      insert into public.media_profile_post_tagged_targets (post_id, target_type, target_id)
      values (p_id, v_t ->> 'target_type', (v_t ->> 'target_id')::uuid)
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

revoke all on function public.footme_content_replace_tags(text, uuid, jsonb, boolean) from public;
revoke execute on function public.footme_content_replace_tags(text, uuid, jsonb, boolean) from anon, authenticated;

-- 9b. Riga nuova in stato draft nella tabella dell'identità. Il kind è 'post'
-- o 'article'. Per un Media l'autore editoriale è il nome del Media (colonna
-- NOT NULL, come in publish_post).
create or replace function public.footme_content_create_row(
  p_actor         uuid,
  p_identity_type text,
  p_identity_id   uuid,
  p_format        text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_card jsonb;
begin
  if p_identity_type = 'person' then
    insert into public.profile_posts (profile_id, body, status)
    values (p_identity_id, '', 'draft')
    returning id into v_id;
    return jsonb_build_object('content_type', 'profile_post', 'content_id', v_id);

  elsif p_identity_type = 'society' then
    insert into public.club_media_posts (club_id, created_by_profile_id, kind, title, status)
    values (p_identity_id, p_actor, p_format, '', 'draft')
    returning id into v_id;
    return jsonb_build_object('content_type', 'club_media', 'content_id', v_id);

  else
    v_card := public.footme_composer_identity_card('media', p_identity_id);
    insert into public.media_profile_posts
      (media_profile_id, created_by_profile_id, kind, category, title, author_name, status)
    values
      (p_identity_id, p_actor, p_format, '', '', coalesce(v_card ->> 'name', 'Media'), 'draft')
    returning id into v_id;
    return jsonb_build_object('content_type', 'media_profile', 'content_id', v_id);
  end if;
end;
$$;

revoke all on function public.footme_content_create_row(uuid, text, uuid, text) from public;
revoke execute on function public.footme_content_create_row(uuid, text, uuid, text) from anon, authenticated;

-- 9c. Persistenza di un POST (§124): testo, media, mention, tag, link. Riusa le
-- funzioni interne di HOM-06.1 (mention, tag, link) e la normalizzazione dei
-- media estratta qui sopra: creare, modificare e programmare non divergono.
create or replace function public.footme_content_persist_post(
  p_actor          uuid,
  p_content_type   text,
  p_id             uuid,
  p_payload        jsonb,
  p_bump           integer
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_limits   jsonb := public.footme_post_limits();
  v_body     text;
  v_prefix   text := p_actor::text || '/posts/';
  v_known    text[];
  v_media    jsonb;
  v_mentions jsonb;
  v_tags     jsonb;
  v_link     jsonb;
  v_target   jsonb;
  v_preview  jsonb;
  v_state    text;
  v_prev     jsonb;
  v_item     jsonb;
  v_now      timestamptz := clock_timestamp();
begin
  if coalesce(jsonb_typeof(p_payload -> 'body'), 'null') not in ('string', 'null') then
    raise exception 'post_invalid_content' using errcode = '22023', detail = 'body';
  end if;
  v_body := coalesce(p_payload ->> 'body', '');

  if char_length(v_body) > (v_limits ->> 'max_body_length')::int then
    raise exception 'post_invalid_content' using errcode = '22023', detail = 'body_length';
  end if;

  select coalesce(array_agg(s.pth), array[]::text[]) into v_known
  from (
    select m.storage_path as pth from public.content_post_media m
    where m.content_type = p_content_type and m.post_id = p_id and m.storage_path is not null
    union
    select m.thumbnail_storage_path from public.content_post_media m
    where m.content_type = p_content_type and m.post_id = p_id and m.thumbnail_storage_path is not null
  ) s;

  v_media    := public.footme_post_normalize_media(p_payload -> 'media', v_limits, v_prefix, v_known);
  v_mentions := public.footme_post_normalize_mentions(v_body, p_payload -> 'mentions', (v_limits ->> 'max_mentions')::int);
  v_tags     := public.footme_post_normalize_tags(p_payload -> 'tagged', (v_limits ->> 'max_tags')::int);
  v_link     := public.footme_post_resolve_link(p_payload -> 'link', jsonb_array_length(v_media) > 0);
  v_target   := v_link -> 'target';
  v_preview  := v_link -> 'preview';

  v_state := coalesce(
    (select s.value #>> '{}' from public.app_policy_settings s
     where s.key = 'post_composer.video_initial_state'), 'ready');
  if v_state not in ('ready', 'uploaded', 'processing') then
    v_state := 'ready';
  end if;

  -- Lo stato di elaborazione di un file già allegato si conserva: un video che
  -- il worker ha portato a 'ready' non torna 'processing' a ogni autosave.
  select coalesce(jsonb_object_agg(m.storage_path, m.processing_state), '{}'::jsonb) into v_prev
  from public.content_post_media m
  where m.content_type = p_content_type and m.post_id = p_id and m.storage_path is not null;

  if p_content_type = 'profile_post' then
    update public.profile_posts
       set body = v_body, updated_at = v_now, content_version = content_version + p_bump
     where id = p_id;
  elsif p_content_type = 'club_media' then
    update public.club_media_posts
       set body = nullif(v_body, ''), updated_at = v_now, content_version = content_version + p_bump
     where id = p_id;
  else
    update public.media_profile_posts
       set body = nullif(v_body, ''), updated_at = v_now, content_version = content_version + p_bump
     where id = p_id;
  end if;

  delete from public.content_post_media m
  where m.content_type = p_content_type and m.post_id = p_id;

  for v_item in select e from jsonb_array_elements(v_media) e loop
    insert into public.content_post_media
      (content_type, post_id, position, media_type, url, thumbnail_url,
       width, height, duration_seconds, alt_text, processing_state,
       storage_path, thumbnail_storage_path)
    values
      (p_content_type, p_id, (v_item ->> 'position')::smallint, v_item ->> 'media_type',
       v_item ->> 'url', v_item ->> 'thumbnail_url',
       (v_item ->> 'width')::integer, (v_item ->> 'height')::integer,
       (v_item ->> 'duration_seconds')::integer, v_item ->> 'alt_text',
       coalesce(v_prev ->> (v_item ->> 'storage_path'),
                case when v_item ->> 'media_type' = 'video' then v_state else 'ready' end),
       v_item ->> 'storage_path', v_item ->> 'thumbnail_path');
  end loop;

  if jsonb_array_length(v_mentions) > 0 or jsonb_typeof(v_target) = 'object' then
    insert into public.content_post_extras as x
      (content_type, post_id, mentions, link_preview, link_target)
    values
      (p_content_type, p_id, v_mentions,
       case when jsonb_typeof(v_preview) = 'object' then v_preview end,
       case when jsonb_typeof(v_target) = 'object' then v_target end)
    on conflict (content_type, post_id) do update
      set mentions     = excluded.mentions,
          link_preview = excluded.link_preview,
          link_target  = excluded.link_target;
  else
    delete from public.content_post_extras x
    where x.content_type = p_content_type and x.post_id = p_id;
  end if;

  perform public.footme_content_replace_tags(p_content_type, p_id, v_tags, false);
end;
$$;

revoke all on function public.footme_content_persist_post(uuid, text, uuid, jsonb, integer) from public;
revoke execute on function public.footme_content_persist_post(uuid, text, uuid, jsonb, integer) from anon, authenticated;

-- 9d. Persistenza di un ARTICOLO (§7C, §123): UN modello per le tre modalità.
--   native        = documento strutturato + cover;
--   external_link = solo la fonte (URL + snapshot), titolo dai metadata o a mano,
--                   nessuna cover arbitraria (§7J);
--   imported_text = documento + provenienza (§7P) + conferma dei diritti (§7Q).
-- Scrive content_articles e lo SPECCHIO nelle colonne legacy della riga (titolo,
-- testo piano, estratto, immagine, fonte) da cui leggono Feed, ricerca e salvati.
--   p_status = stato attuale della riga ('draft' tollera il titolo vuoto).
--   confirm_source_change (§219) si legge dal payload.
create or replace function public.footme_content_persist_article(
  p_actor           uuid,
  p_content_type    text,
  p_id              uuid,
  p_identity_type   text,
  p_identity_id     uuid,
  p_payload         jsonb,
  p_status          text,
  p_bump            integer
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_lim       jsonb := public.footme_article_limits();
  v_old       public.content_articles;
  v_mode      text;
  v_title     text;
  v_manual    boolean := false;
  v_doc       jsonb := null;
  v_cover     jsonb := null;
  v_tags      jsonb;
  v_src       jsonb;
  v_sid       uuid;
  v_snap      public.link_preview_snapshots;
  v_url       text;
  v_norm      text;
  v_final     text;
  v_canon     text;
  v_domain    text;
  v_site      text;
  v_snapshot  jsonb := null;
  v_fetched   timestamptz;
  v_key       text;
  v_pe        boolean;
  v_pname     text;
  v_pauthor   text;
  v_purl      text;
  v_nolink    boolean := false;
  v_prov      jsonb;
  v_rights_id uuid;
  v_fp        text;
  v_text      text;
  v_excerpt   text;
  v_visual    text;
  v_ext       text;
  v_card      jsonb;
  v_cp        jsonb;
  v_known     text[];
  v_now       timestamptz := clock_timestamp();
  v_ver       text := coalesce((select s.value #>> '{}' from public.app_policy_settings s
                                where s.key = 'article.rights_declaration_version'), 'v1');
begin
  select * into v_old from public.content_articles a
  where a.content_type = p_content_type and a.post_id = p_id;

  v_mode := p_payload ->> 'creation_mode';
  if v_mode is null or v_mode not in ('native', 'external_link', 'imported_text') then
    raise exception 'article_invalid_document' using errcode = '22023', detail = 'creation_mode';
  end if;
  -- La modalità non cambia dopo la pubblicazione (§7X: nessuna conversione
  -- silenziosa; prima della pubblicazione il client chiede conferma e rimanda).
  if p_status = 'published' and v_old.creation_mode is not null and v_old.creation_mode <> v_mode then
    raise exception 'content_invalid_state' using errcode = '55000', detail = 'creation_mode';
  end if;

  if coalesce(jsonb_typeof(p_payload -> 'title'), 'null') not in ('string', 'null') then
    raise exception 'article_invalid_document' using errcode = '22023', detail = 'title';
  end if;
  v_title := btrim(coalesce(p_payload ->> 'title', ''));
  if char_length(v_title) > (v_lim ->> 'max_title_length')::int then
    raise exception 'article_title_too_long' using errcode = '22023';
  end if;

  v_tags := public.footme_post_normalize_tags(p_payload -> 'tagged', (v_lim ->> 'max_tags')::int);

  if v_mode = 'external_link' then
    -- §7J: in V1 nessuna cover arbitraria al posto dell'immagine della fonte.
    if coalesce(jsonb_typeof(p_payload -> 'cover'), 'null') <> 'null' then
      raise exception 'article_cover_not_allowed' using errcode = '22023';
    end if;

    v_src := p_payload -> 'source';
    if coalesce(jsonb_typeof(v_src), 'null') = 'object' then
      if coalesce(jsonb_typeof(v_src -> 'url'), '') <> 'string' then
        raise exception 'article_invalid_source' using errcode = '22023', detail = 'url';
      end if;
      v_url := public.footme_safe_https_url(v_src ->> 'url', false);
      if v_url is null then
        raise exception 'article_invalid_source' using errcode = '22023', detail = 'url';
      end if;

      if coalesce(jsonb_typeof(v_src -> 'snapshot_id'), 'null') = 'string' then
        begin
          v_sid := (v_src ->> 'snapshot_id')::uuid;
        exception when invalid_text_representation then
          raise exception 'article_invalid_source' using errcode = '22023', detail = 'snapshot_id';
        end;
      end if;

      if v_sid is not null then
        select * into v_snap from public.link_preview_snapshots s where s.id = v_sid;
        if not found
           or not (v_snap.original_url = v_url
                   or v_snap.final_url = v_url
                   or v_snap.normalized_url = public.footme_normalize_url(v_url)) then
          raise exception 'article_invalid_source' using errcode = '22023', detail = 'snapshot';
        end if;
        v_norm    := v_snap.normalized_url;
        v_final   := v_snap.final_url;
        v_canon   := v_snap.canonical_url;
        v_domain  := v_snap.domain;
        v_site    := v_snap.site_name;
        v_fetched := v_snap.fetched_at;
        -- Copia PERSISTITA dello snapshot (§7H, §7W): il job all'ora prevista e
        -- il dettaglio leggono questa, mai un nuovo fetch.
        v_snapshot := jsonb_strip_nulls(jsonb_build_object(
          'title',          v_snap.title,
          'description',    v_snap.description,
          'image_url',      v_snap.image_url,
          'favicon_url',    v_snap.favicon_url,
          'site_name',      v_snap.site_name,
          'author',         v_snap.author,
          'published_time', v_snap.published_time,
          'canonical_url',  v_snap.canonical_url,
          'final_url',      v_snap.final_url,
          'fetched_at',     v_snap.fetched_at));
      else
        v_norm   := public.footme_normalize_url(v_url);
        v_domain := regexp_replace(lower(split_part(substr(v_url, 9), '/', 1)), '^www\.', '');
      end if;

      -- Chiave di duplicazione (§7M): il canonico conta solo se non è la sola
      -- origine (https://sito/) quando la pagina vera ha un percorso: un sito che
      -- dichiara la home come canonico di ogni articolo non deve renderli tutti
      -- duplicati. In quel caso vale l'URL finale.
      v_key := public.footme_normalize_url(coalesce(
        case when public.footme_normalize_url(v_canon) ~ '^https://[^/]+/$'
                  and public.footme_normalize_url(coalesce(v_final, v_norm, v_url)) !~ '^https://[^/]+/$'
             then null else v_canon end,
        v_final, v_norm, v_url));

      -- §219: cambiare la fonte di un Articolo pubblicato è una decisione da
      -- confermare (cambia ciò che i lettori vedono dietro lo stesso id).
      if p_status = 'published' and v_old.source_key is distinct from v_key
         and coalesce(p_payload ->> 'confirm_source_change', 'false') <> 'true' then
        raise exception 'article_invalid_source' using errcode = '22023', detail = 'confirm_source_change';
      end if;

      -- §7J: il titolo viene prioritariamente dai metadata validati; solo in
      -- loro assenza vale il titolo inserito a mano.
      if coalesce(btrim(v_snap.title), '') <> '' then
        v_title  := left(btrim(v_snap.title), (v_lim ->> 'max_title_length')::int);
        v_manual := false;
      else
        v_manual := v_title <> '';
      end if;
      v_excerpt := nullif(btrim(coalesce(v_snap.description, '')), '');
      v_visual  := v_snap.image_url;
      v_ext     := coalesce(v_final, v_url);
    else
      v_url := null;
      v_manual := v_title <> '';
    end if;

  else
    -- native / imported_text
    v_doc := public.footme_article_normalize_document(p_payload -> 'document', v_lim);

    if coalesce(jsonb_typeof(p_payload -> 'cover'), 'null') = 'object' then
      v_cp := p_payload -> 'cover';
      v_known := case when v_old.cover ->> 'storage_path' is not null
                      then array[v_old.cover ->> 'storage_path'] else array[]::text[] end;
      if coalesce(jsonb_typeof(v_cp -> 'storage_path'), '') <> 'string' then
        raise exception 'article_cover_not_allowed' using errcode = '22023', detail = 'shape';
      end if;
      begin
        v_cover := (public.footme_post_normalize_media(
          jsonb_build_array(jsonb_build_object(
            'storage_path', v_cp ->> 'storage_path', 'media_type', 'image',
            'width', v_cp -> 'width', 'height', v_cp -> 'height', 'alt_text', v_cp -> 'alt_text')),
          public.footme_post_limits(), p_actor::text || '/posts/', v_known)) -> 0;
      exception when sqlstate '22023' then
        raise exception 'article_cover_not_allowed' using errcode = '22023', detail = sqlerrm;
      end;
      v_cover := jsonb_strip_nulls(jsonb_build_object(
        'storage_path', v_cover ->> 'storage_path', 'url', v_cover ->> 'url',
        'width', v_cover -> 'width', 'height', v_cover -> 'height',
        'alt_text', v_cover ->> 'alt_text'));
      v_visual := v_cover ->> 'url';
    elsif coalesce(jsonb_typeof(p_payload -> 'cover'), 'null') <> 'null' then
      raise exception 'article_cover_not_allowed' using errcode = '22023', detail = 'shape';
    end if;

    v_text := public.footme_article_document_text(v_doc);
    v_excerpt := public.footme_article_excerpt(v_doc, (v_lim ->> 'excerpt_length')::int);

    if v_mode = 'imported_text' then
      v_prov := p_payload -> 'provenance';
      if coalesce(jsonb_typeof(v_prov), 'null') = 'object' then
        if coalesce(jsonb_typeof(v_prov -> 'published_elsewhere'), 'null') = 'boolean' then
          v_pe := (v_prov ->> 'published_elsewhere')::boolean;
        elsif coalesce(jsonb_typeof(v_prov -> 'published_elsewhere'), 'null') <> 'null' then
          raise exception 'article_invalid_source' using errcode = '22023', detail = 'published_elsewhere';
        end if;

        if v_pe is true then
          v_pname   := left(nullif(btrim(coalesce(v_prov ->> 'source_name', '')), ''), 120);
          v_pauthor := left(nullif(btrim(coalesce(v_prov ->> 'original_author', '')), ''), 120);
          v_nolink  := coalesce(v_prov ->> 'no_original_link', 'false') = 'true';
          if not v_nolink and nullif(btrim(coalesce(v_prov ->> 'original_url', '')), '') is not null then
            v_purl := public.footme_safe_https_url(v_prov ->> 'original_url', false);
            if v_purl is null then
              raise exception 'article_invalid_source' using errcode = '22023', detail = 'original_url';
            end if;
          end if;
        end if;
      end if;
      -- Mai una finta fonte (§7P): senza «già pubblicato altrove» non resta
      -- nulla di fonte, autore o link.
      v_ext := case when v_pe is true then v_purl end;
    end if;
  end if;

  -- ── riga principale: specchio legacy ───────────────────────────
  if p_content_type = 'club_media' then
    update public.club_media_posts
       set kind = 'article',
           title = v_title,
           body = nullif(coalesce(v_text, ''), ''),
           excerpt = v_excerpt,
           visual_url = v_visual,
           visual_type = case when v_visual is null then null else 'image' end,
           thumbnail_url = v_visual,
           external_url = v_ext,
           updated_at = v_now,
           content_version = content_version + p_bump
     where id = p_id;
  else
    v_card := public.footme_composer_identity_card('media', p_identity_id);
    update public.media_profile_posts
       set kind = 'article',
           category = '',
           title = v_title,
           body = nullif(coalesce(v_text, ''), ''),
           excerpt = v_excerpt,
           cover_url = v_visual,
           cover_type = case when v_visual is null then null else 'image' end,
           external_url = v_ext,
           author_name = coalesce(v_card ->> 'name', author_name),
           source_type = case v_mode
                           when 'native' then 'platform'
                           when 'external_link' then 'link'
                           else 'pasted' end,
           display_mode = case when v_mode = 'external_link' then 'preview' else 'full' end,
           -- §7P: una fonte solo se esiste davvero (link: sito o dominio;
           -- importato già pubblicato altrove: la fonte dichiarata).
           source_name = case v_mode
                           when 'external_link' then coalesce(nullif(btrim(v_site), ''), v_domain)
                           when 'imported_text' then case when v_pe is true then v_pname end
                           else null end,
           updated_at = v_now,
           content_version = content_version + p_bump
     where id = p_id;
  end if;

  -- ── conferma dei diritti (§7Q) ─────────────────────────────────
  -- Vale solo finché la provenienza è quella confermata. Se cambia (identità,
  -- fonte, autore, URL originale) la conferma cade e va richiesta di nuovo,
  -- anche se il client rimanda `rights_confirmed: true` insieme alla modifica:
  -- il server non può sapere se l'utente ha rimesso la spunta dopo la modifica.
  v_rights_id := null;
  if v_mode = 'imported_text' then
    v_fp := public.footme_article_rights_fingerprint(
      p_identity_type, p_identity_id, v_mode, v_pe, v_pname, v_pauthor, v_purl, v_nolink);

    if coalesce(p_payload ->> 'rights_confirmed', 'false') = 'true' then
      select rc.id into v_rights_id
      from public.article_rights_confirmations rc
      where rc.id = v_old.rights_confirmation_id
        and rc.source_reference ->> 'fingerprint' = v_fp
        and rc.identity_id = p_identity_id;

      if v_rights_id is null and v_old.rights_confirmation_id is null then
        insert into public.article_rights_confirmations
          (content_type, post_id, declaration_version, identity_type, identity_id,
           actor_id, creation_mode, source_reference)
        values
          (p_content_type, p_id, v_ver, p_identity_type, p_identity_id, p_actor, v_mode,
           jsonb_build_object('fingerprint', v_fp, 'source_name', v_pname,
                              'original_url', v_purl, 'published_elsewhere', v_pe))
        returning id into v_rights_id;
      end if;
    end if;
  end if;

  insert into public.content_articles as a (
    content_type, post_id, creation_mode, document, cover,
    source_url, source_normalized_url, source_final_url, source_canonical_url,
    source_domain, source_site_name, source_snapshot_id, source_snapshot, source_fetched_at,
    source_key, manual_title, published_elsewhere, original_source_name, original_author,
    original_url, no_original_link, rights_confirmation_id, updated_at)
  values (
    p_content_type, p_id, v_mode, v_doc, v_cover,
    v_url, v_norm, v_final, v_canon,
    v_domain, v_site, v_sid, v_snapshot, v_fetched,
    v_key, v_manual, v_pe, v_pname, v_pauthor,
    v_purl, v_nolink, v_rights_id, v_now)
  on conflict (content_type, post_id) do update
    set creation_mode = excluded.creation_mode,
        document = excluded.document,
        cover = excluded.cover,
        source_url = excluded.source_url,
        source_normalized_url = excluded.source_normalized_url,
        source_final_url = excluded.source_final_url,
        source_canonical_url = excluded.source_canonical_url,
        source_domain = excluded.source_domain,
        source_site_name = excluded.source_site_name,
        source_snapshot_id = excluded.source_snapshot_id,
        source_snapshot = excluded.source_snapshot,
        source_fetched_at = excluded.source_fetched_at,
        source_key = excluded.source_key,
        manual_title = excluded.manual_title,
        published_elsewhere = excluded.published_elsewhere,
        original_source_name = excluded.original_source_name,
        original_author = excluded.original_author,
        original_url = excluded.original_url,
        no_original_link = excluded.no_original_link,
        rights_confirmation_id = excluded.rights_confirmation_id,
        updated_at = excluded.updated_at;

  perform public.footme_content_replace_tags(p_content_type, p_id, v_tags, p_status = 'published');

  -- Un titolo vuoto è ammesso solo in una bozza (§143): dopo, il CHECK della
  -- tabella e la regola unica lo pretendono.
  if p_status <> 'draft' and v_title = '' then
    raise exception 'article_missing_title' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.footme_content_persist_article(uuid, text, uuid, text, uuid, jsonb, text, integer) from public;
revoke execute on function public.footme_content_persist_article(uuid, text, uuid, text, uuid, jsonb, text, integer) from anon, authenticated;

-- 9e. Copia i figli di una riga in un'altra (cambio identità tra tabelle: la
-- bozza si SPOSTA, la riga vecchia sparisce). Media, extras e Articolo; i tag
-- li riscrive la persist dal payload.
create or replace function public.footme_content_clone_children(
  p_from_type text,
  p_from_id   uuid,
  p_to_type   text,
  p_to_id     uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  insert into public.content_post_media
    (content_type, post_id, position, media_type, url, thumbnail_url, width, height,
     duration_seconds, alt_text, processing_state, variants, captions,
     storage_path, thumbnail_storage_path)
  select p_to_type, p_to_id, m.position, m.media_type, m.url, m.thumbnail_url, m.width, m.height,
         m.duration_seconds, m.alt_text, m.processing_state, m.variants, m.captions,
         m.storage_path, m.thumbnail_storage_path
  from public.content_post_media m
  where m.content_type = p_from_type and m.post_id = p_from_id;

  insert into public.content_post_extras (content_type, post_id, mentions, link_preview, link_target)
  select p_to_type, p_to_id, x.mentions, x.link_preview, x.link_target
  from public.content_post_extras x
  where x.content_type = p_from_type and x.post_id = p_from_id;

  if p_to_type in ('club_media', 'media_profile') then
    insert into public.content_articles
      (content_type, post_id, creation_mode, document, cover, source_url, source_normalized_url,
       source_final_url, source_canonical_url, source_domain, source_site_name, source_snapshot_id,
       source_snapshot, source_fetched_at, source_key, manual_title, published_elsewhere,
       original_source_name, original_author, original_url, no_original_link,
       rights_confirmation_id)
    select p_to_type, p_to_id, a.creation_mode, a.document, a.cover, a.source_url, a.source_normalized_url,
           a.source_final_url, a.source_canonical_url, a.source_domain, a.source_site_name, a.source_snapshot_id,
           a.source_snapshot, a.source_fetched_at, a.source_key, a.manual_title, a.published_elsewhere,
           a.original_source_name, a.original_author, a.original_url, a.no_original_link,
           a.rights_confirmation_id
    from public.content_articles a
    where a.content_type = p_from_type and a.post_id = p_from_id;
  end if;
end;
$$;

revoke all on function public.footme_content_clone_children(text, uuid, text, uuid) from public;
revoke execute on function public.footme_content_clone_children(text, uuid, text, uuid) from anon, authenticated;

-- 9f. Il punto unico di scrittura: crea o aggiorna, con CAS sulla versione,
-- accesso, stato ammesso e cambio identità (§128, §131–§132, §24–§27).
-- Restituisce {content_type, content_id, status, version, moved, replayed}.
--   p_id null            = riga nuova (versione 1);
--   p_allowed_status     = stati in cui la riga può essere scritta da questa
--                          chiamata (save: draft+failed; submit: anche
--                          scheduled e published);
--   p_extra              = ciò che, oltre al payload, definisce l'operazione
--                          (la publication di un submit): entra nell'impronta.
-- Ogni scrittura salva l'impronta di (formato, identità, payload, extra) sulla
-- riga (`last_save_hash`). Se la versione attesa non coincide MA l'impronta in
-- arrivo è quella dell'ultima scrittura, la risposta di quella scrittura è andata
-- persa e questa è la stessa operazione che si ripete: ritorna `replayed: true`
-- senza riscrivere, invece di un falso conflitto di versione.
-- Un Articolo PUBBLICATO si modifica con la sola capability di modifica (HOM-04,
-- footme_content_rights.r_can_edit), come fetch_content_for_editor e il menu: non
-- serve content_article_publish. Le regole del contenuto valgono comunque.
create or replace function public.footme_content_apply(
  p_actor            uuid,
  p_content_type     text,
  p_id               uuid,
  p_expected_version integer,
  p_format           text,
  p_identity_type    text,
  p_identity_id      uuid,
  p_payload          jsonb,
  p_allowed_status   text[],
  p_extra            jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_cap      record;
  l          record;
  v_found    boolean := false;
  v_ref      jsonb;
  v_ctype    text := p_content_type;
  v_id       uuid := p_id;
  v_target   text;
  v_moved    boolean := false;
  v_bump     integer := 1;
  v_status   text := 'draft';
  v_old_type text;
  v_old_id   uuid;
  v_ver      integer;
  v_rights   record;
  v_hash     text;
  v_pub_edit boolean := false;
  v_it       text := p_identity_type;
  v_ii       uuid := p_identity_id;
begin
  if p_format is null or p_format not in ('post', 'article') then
    raise exception 'post_invalid_content' using errcode = '22023', detail = 'format';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'post_invalid_content' using errcode = '22023', detail = 'payload';
  end if;

  v_hash := md5(jsonb_build_object(
    'format', p_format, 'identity_type', p_identity_type, 'identity_id', p_identity_id,
    'payload', p_payload, 'extra', coalesce(p_extra, 'null'::jsonb))::text);

  if p_id is not null then
    select * into l from public.footme_content_load(p_content_type, p_id, true);
    v_found := found and l.l_status <> 'deleted' and l.l_format is not null;
    v_pub_edit := v_found and l.l_status = 'published';
    if v_pub_edit then
      v_it := l.l_identity_type;
      v_ii := l.l_identity_id;
    end if;
  end if;

  -- Identità e capability, SEMPRE rivalidate (§30, §189): un Articolo richiede
  -- can_publish_article (§273) — un'identità che può solo pubblicare Post riceve
  -- article_mode_not_allowed. Fa eccezione la modifica di un Articolo già
  -- pubblicato: lì decide r_can_edit (vedi sopra).
  if not v_pub_edit then
    select * into v_cap
    from public.footme_publishing_identities(p_actor) i
    where i.c_type = p_identity_type and i.c_id = p_identity_id;
    if not found or not (v_cap.can_post or v_cap.can_article) then
      raise exception 'content_permission_denied' using errcode = '42501';
    end if;
    if p_format = 'article' and not v_cap.can_article then
      raise exception 'article_mode_not_allowed' using errcode = '42501';
    end if;
    if p_format = 'post' and not v_cap.can_post then
      raise exception 'content_permission_denied' using errcode = '42501';
    end if;
  end if;

  v_target := case p_identity_type
                when 'person'  then 'profile_post'
                when 'society' then 'club_media'
                else 'media_profile' end;

  if p_id is null then
    v_ref := public.footme_content_create_row(p_actor, p_identity_type, p_identity_id, p_format);
    v_ctype := v_ref ->> 'content_type';
    v_id := (v_ref ->> 'content_id')::uuid;
    v_bump := 0;
  else
    if not v_found then
      raise exception 'content_not_found' using errcode = 'P0002';
    end if;

    if v_pub_edit then
      -- Solo un Articolo pubblicato, e solo con la capability di modifica (HOM-04).
      if l.l_format <> 'article' or not ('published' = any (p_allowed_status)) then
        raise exception 'content_invalid_state' using errcode = '55000';
      end if;
      select * into v_rights from public.footme_content_rights(p_content_type, p_id) r;
      if v_rights.r_can_edit is not true then
        raise exception 'content_permission_denied' using errcode = '42501';
      end if;
      -- L'identità di un contenuto pubblicato non cambia.
      if l.l_identity_type <> p_identity_type or l.l_identity_id <> p_identity_id then
        raise exception 'content_invalid_state' using errcode = '55000', detail = 'identity';
      end if;
    elsif not public.footme_content_draft_access(p_content_type, p_id, p_actor) then
      -- IDOR (§259): chi non ha accesso riceve lo stesso errore di «non esiste».
      raise exception 'content_not_found' using errcode = 'P0002';
    end if;

    -- Risposta persa: stessa operazione già applicata → successo, non conflitto.
    if p_expected_version is not null and l.l_version <> p_expected_version
       and l.l_save_hash is not null and l.l_save_hash = v_hash then
      return jsonb_build_object(
        'content_type', p_content_type, 'content_id', p_id, 'status', l.l_status,
        'version', l.l_version, 'moved', false, 'replayed', true);
    end if;

    if not (l.l_status = any (p_allowed_status)) then
      raise exception 'content_invalid_state' using errcode = '55000', detail = l.l_status;
    end if;
    if l.l_format <> p_format then
      raise exception 'content_invalid_state' using errcode = '55000', detail = 'format';
    end if;

    if p_expected_version is null or l.l_version <> p_expected_version then
      raise exception 'content_version_conflict' using errcode = '40001', detail = l.l_version::text;
    end if;

    v_status := l.l_status;

    if l.l_identity_type <> p_identity_type or l.l_identity_id <> p_identity_id then
      if v_target <> p_content_type then
        -- Cambio di TABELLA (persona → Società, Società → Media): la bozza si
        -- sposta in una riga nuova e la vecchia, mai pubblicata, si elimina.
        -- Su un programmato no: il job ha una sua riga e un suo orario (§188).
        if l.l_status <> 'draft' then
          raise exception 'content_identity_change_requires_draft' using errcode = '22023';
        end if;

        v_old_type := p_content_type;
        v_old_id := p_id;
        v_ref := public.footme_content_create_row(p_actor, p_identity_type, p_identity_id, p_format);
        v_ctype := v_ref ->> 'content_type';
        v_id := (v_ref ->> 'content_id')::uuid;
        perform public.footme_content_clone_children(v_old_type, v_old_id, v_ctype, v_id);

        execute format(
          'update public.%I set scheduled_at = $2, schedule_timezone = $3 where id = $1',
          public.footme_content_table(v_ctype))
          using v_id, l.l_scheduled_at, l.l_timezone;

        v_bump := 0;
        v_moved := true;
      else
        -- Stessa tabella, altra identità (Società A → Società B): la riga resta.
        if p_content_type = 'club_media' then
          update public.club_media_posts set club_id = p_identity_id where id = p_id;
        elsif p_content_type = 'media_profile' then
          update public.media_profile_posts set media_profile_id = p_identity_id where id = p_id;
        end if;
        if l.l_status = 'scheduled' then
          execute format('update public.%I set scheduled_by_profile_id = $2 where id = $1',
                         public.footme_content_table(p_content_type))
            using p_id, p_actor;
        end if;
      end if;
    end if;
  end if;

  if p_format = 'post' then
    perform public.footme_content_persist_post(p_actor, v_ctype, v_id, p_payload, v_bump);
  else
    perform public.footme_content_persist_article(
      p_actor, v_ctype, v_id, v_it, v_ii, p_payload, v_status, v_bump);
  end if;

  execute format('update public.%I set last_save_hash = $2 where id = $1',
                 public.footme_content_table(v_ctype))
    using v_id, v_hash;

  if v_moved then
    update public.content_operation_receipts r
       set content_type = v_ctype, content_id = v_id
     where r.content_type = v_old_type and r.content_id = v_old_id;
    -- Bozza mai pubblicata: eliminazione fisica (i figli seguono il trigger).
    execute format('delete from public.%I where id = $1 and status = ''draft''',
                   public.footme_content_table(v_old_type))
      using v_old_id;
  end if;

  select l2.l_version into v_ver from public.footme_content_load(v_ctype, v_id, false) l2;

  return jsonb_build_object(
    'content_type', v_ctype,
    'content_id',   v_id,
    'status',       v_status,
    'version',      v_ver,
    'moved',        v_moved,
    'replayed',     false);
end;
$$;

revoke all on function public.footme_content_apply(uuid, text, uuid, integer, text, text, uuid, jsonb, text[], jsonb) from public;
revoke execute on function public.footme_content_apply(uuid, text, uuid, integer, text, text, uuid, jsonb, text[], jsonb) from anon, authenticated;


-- ============================================================
-- SEZIONE 10 — letture comuni (interne)
-- ============================================================

-- 10a. Le righe a cui l'ATTORE ha accesso, negli stati richiesti. Set-based:
-- parte dalle identità dell'attore e dalla capability per formato (Post →
-- can_post, Articolo → can_article). Stessa regola di footme_content_draft_access
-- (che lavora su una riga sola): una bozza di Articolo non compare a chi ha solo
-- content_create (§273, §230).
create or replace function public.footme_content_actor_rows(
  p_actor    uuid,
  p_statuses text[]
)
returns table (
  r_type          text,
  r_id            uuid,
  r_format        text,
  r_status        text,
  r_identity_type text,
  r_identity_id   uuid,
  r_updated_at    timestamptz,
  r_scheduled_at  timestamptz,
  r_timezone      text,
  r_version       integer,
  r_failure       text
)
language sql
stable
security definer
set search_path = public
as $$
  with ids as (
    select * from public.footme_publishing_identities(p_actor)
  )
  select 'profile_post'::text, pp.id, 'post'::text, pp.status, 'person'::text, pp.profile_id,
         pp.updated_at, pp.scheduled_at, pp.schedule_timezone, pp.content_version,
         pp.publish_failure_code
  from public.profile_posts pp
  join ids i on i.c_type = 'person' and i.c_id = pp.profile_id and i.can_post
  where pp.status = any (p_statuses)

  union all

  select 'club_media'::text, cm.id, cm.kind, cm.status, 'society'::text, cm.club_id,
         cm.updated_at, cm.scheduled_at, cm.schedule_timezone, cm.content_version,
         cm.publish_failure_code
  from public.club_media_posts cm
  join ids i on i.c_type = 'society' and i.c_id = cm.club_id
            and ((cm.kind = 'post' and i.can_post) or (cm.kind = 'article' and i.can_article))
  where cm.status = any (p_statuses)

  union all

  select 'media_profile'::text, mp.id, mp.kind, mp.status, 'media'::text, mp.media_profile_id,
         mp.updated_at, mp.scheduled_at, mp.schedule_timezone, mp.content_version,
         mp.publish_failure_code
  from public.media_profile_posts mp
  join ids i on i.c_type = 'media' and i.c_id = mp.media_profile_id
            and ((mp.kind = 'post' and i.can_post) or (mp.kind = 'article' and i.can_article))
  where mp.status = any (p_statuses);
$$;

revoke all on function public.footme_content_actor_rows(uuid, text[]) from public;
revoke execute on function public.footme_content_actor_rows(uuid, text[]) from anon, authenticated;

-- 10b. ISO-8601 UTC con microsecondi: il formato che il client rimanda come
-- versione/cursore senza perdere precisione.
create or replace function public.footme_iso(p_ts timestamptz)
returns text
language sql
immutable
set search_path = public
as $$
  select case when p_ts is null then null
              else to_char(p_ts at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end;
$$;

revoke all on function public.footme_iso(timestamptz) from public;
revoke execute on function public.footme_iso(timestamptz) from anon, authenticated;

-- 10c. Riferimento {content_type, content_id} del client → (tipo, uuid) o
-- content_not_found: un riferimento malformato non si distingue da uno
-- inesistente (§259).
create or replace function public.footme_content_ref_parse(p_ref jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_type text;
  v_id   uuid;
begin
  if p_ref is null or jsonb_typeof(p_ref) <> 'object'
     or coalesce(jsonb_typeof(p_ref -> 'content_type'), '') <> 'string'
     or coalesce(jsonb_typeof(p_ref -> 'content_id'), '') <> 'string' then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;

  v_type := p_ref ->> 'content_type';
  if v_type not in ('profile_post', 'club_media', 'media_profile') then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;

  begin
    v_id := (p_ref ->> 'content_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'content_not_found' using errcode = 'P0002';
  end;

  return jsonb_build_object('content_type', v_type, 'content_id', v_id);
end;
$$;

revoke all on function public.footme_content_ref_parse(jsonb) from public;
revoke execute on function public.footme_content_ref_parse(jsonb) from anon, authenticated;

-- 10d. Prologo dei comandi sul lifecycle (programma, pubblica ora, sposta nelle
-- bozze, elimina): lock di riga, accesso (IDOR → content_not_found), CAS sulla
-- versione e stato ammesso. Due richieste concorrenti si serializzano sul lock:
-- la seconda rilegge versione e stato già cambiati.
create or replace function public.footme_content_action_guard(
  p_actor            uuid,
  p_ref              jsonb,
  p_expected_version integer,
  p_allowed_status   text[]
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ref jsonb := public.footme_content_ref_parse(p_ref);
  v_type text := v_ref ->> 'content_type';
  v_id   uuid := (v_ref ->> 'content_id')::uuid;
  l      record;
begin
  select * into l from public.footme_content_load(v_type, v_id, true);
  if not found or l.l_status = 'deleted' or l.l_format is null
     or not public.footme_content_draft_access(v_type, v_id, p_actor) then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;

  if p_expected_version is null or l.l_version <> p_expected_version then
    raise exception 'content_version_conflict' using errcode = '40001', detail = l.l_version::text;
  end if;

  if not (l.l_status = any (p_allowed_status)) then
    raise exception 'content_invalid_state' using errcode = '55000', detail = l.l_status;
  end if;

  return jsonb_build_object(
    'content_type', v_type, 'content_id', v_id, 'status', l.l_status,
    'version', l.l_version, 'format', l.l_format,
    'identity_type', l.l_identity_type, 'identity_id', l.l_identity_id,
    'scheduled_at', l.l_scheduled_at, 'timezone', l.l_timezone);
end;
$$;

revoke all on function public.footme_content_action_guard(uuid, jsonb, integer, text[]) from public;
revoke execute on function public.footme_content_action_guard(uuid, jsonb, integer, text[]) from anon, authenticated;

-- 10e. Stato corrente di una riga come lo restituiscono save/submit.
create or replace function public.footme_content_state_json(
  p_content_type text,
  p_id           uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'content_type',     p_content_type,
    'content_id',       p_id,
    'status',           l.l_status,
    'version',          l.l_version,
    'updated_at',       public.footme_iso(l.l_updated_at),
    'rights_confirmed', public.footme_article_rights_valid(p_content_type, p_id))
  from public.footme_content_load(p_content_type, p_id, false) l;
$$;

revoke all on function public.footme_content_state_json(text, uuid) from public;
revoke execute on function public.footme_content_state_json(text, uuid) from anon, authenticated;

-- 10f. Tag di un contenuto per l'editor (stesso payload di fetch_post_for_edit).
create or replace function public.footme_content_tags_json(
  p_content_type text,
  p_id           uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'target_type', t.target_type,
               'target_id',   t.target_id,
               'display_name', case t.target_type when 'profile' then pr.full_name else cl.name end,
               'avatar_url',  case t.target_type when 'profile' then pr.avatar_url else cl.logo_url end,
               'is_verified', case t.target_type
                                when 'profile' then exists (
                                  select 1 from public.media_profile_verifications mv
                                  where mv.media_profile_id = pr.id
                                    and mv.verification_type = 'profile_verified'
                                    and mv.status = 'verified')
                                else coalesce(cl.verification_status = 'verified', false) end,
               'subtitle',    case t.target_type when 'profile' then null else cl.category end)
             order by t.created_at, t.target_id)
    from (
      select x.target_type, x.target_id, x.created_at
      from (
        select tt.target_type, tt.target_id, tt.created_at
        from public.profile_post_tagged_targets tt
        where p_content_type = 'profile_post' and tt.post_id = p_id and tt.status = 'active'
        union all
        select tt.target_type, coalesce(tt.target_id, tt.profile_id), tt.created_at
        from public.club_media_tagged_profiles tt
        where p_content_type = 'club_media' and tt.post_id = p_id and tt.status = 'active'
        union all
        select tt.target_type, tt.target_id, tt.created_at
        from public.media_profile_post_tagged_targets tt
        where p_content_type = 'media_profile' and tt.post_id = p_id and tt.status = 'active'
      ) x
      where x.target_type in ('profile', 'club')
    ) t
    left join public.profiles pr on t.target_type = 'profile' and pr.id = t.target_id
    left join public.clubs cl    on t.target_type = 'club'    and cl.id = t.target_id
    where coalesce(case t.target_type when 'profile' then pr.full_name else cl.name end, '') <> ''
  ), '[]'::jsonb);
$$;

revoke all on function public.footme_content_tags_json(text, uuid) from public;
revoke execute on function public.footme_content_tags_json(text, uuid) from anon, authenticated;

-- 10g. Documento di un vecchio Articolo (solo `body`): un paragrafo per blocco
-- di testo separato da riga vuota. I vecchi articoli Media si leggono così
-- (decisione 4): nessun backfill, nessuna riga in content_articles.
create or replace function public.footme_article_document_from_text(p_text text)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object('v', 1, 'blocks', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', 'p' || x.o, 'type', 'paragraph',
             'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', x.txt)))
           order by x.o)
    from (
      select o, btrim(txt) as txt
      from regexp_split_to_table(coalesce(p_text, ''), E'\n\\s*\n') with ordinality as s(txt, o)
    ) x
    where x.txt <> ''
  ), '[]'::jsonb));
$$;

revoke all on function public.footme_article_document_from_text(text) from public;
revoke execute on function public.footme_article_document_from_text(text) from anon, authenticated;

-- 10h. Un elemento dell'elenco Bozze/Programmati (§140–§162).
create or replace function public.footme_content_list_item(
  p_content_type text,
  p_id           uuid,
  p_viewer       uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l        record;
  v_body   text;
  v_title  text;
  v_exc    text;
  v_thumb  text;
  v_mode   text;
  v_card   jsonb;
  v_block  text;
  v_can_sched boolean;
begin
  select * into l from public.footme_content_load(p_content_type, p_id, false);
  if not found then
    return null;
  end if;

  v_card := public.footme_composer_identity_card(l.l_identity_type, l.l_identity_id);

  if l.l_format = 'post' then
    v_body := case p_content_type
      when 'profile_post' then (select x.body from public.profile_posts x where x.id = p_id)
      when 'club_media'   then (select x.body from public.club_media_posts x where x.id = p_id)
      else                     (select x.body from public.media_profile_posts x where x.id = p_id)
    end;
    v_exc := nullif(left(btrim(regexp_replace(coalesce(v_body, ''), '\s+', ' ', 'g')), 140), '');
    v_title := null;
    select coalesce(m.thumbnail_url, m.url) into v_thumb
    from public.content_post_media m
    where m.content_type = p_content_type and m.post_id = p_id
    order by m.position limit 1;
    v_mode := null;
  else
    if p_content_type = 'club_media' then
      select nullif(btrim(x.title), ''), x.excerpt, x.thumbnail_url
        into v_title, v_exc, v_thumb
      from public.club_media_posts x where x.id = p_id;
    else
      select nullif(btrim(x.title), ''), x.excerpt, x.cover_url
        into v_title, v_exc, v_thumb
      from public.media_profile_posts x where x.id = p_id;
    end if;
    select a.creation_mode into v_mode
    from public.content_articles a where a.content_type = p_content_type and a.post_id = p_id;
  end if;

  v_block := public.footme_content_blocker(p_content_type, p_id, p_viewer, 'schedule');
  v_can_sched := coalesce((
    select i.can_schedule from public.footme_publishing_identities(p_viewer) i
    where i.c_type = l.l_identity_type and i.c_id = l.l_identity_id), false);

  return jsonb_build_object(
    'content_type',   p_content_type,
    'content_id',     p_id,
    'format',         l.l_format,
    'creation_mode',  v_mode,
    'status',         l.l_status,
    'title',          v_title,
    'preview_text',   v_exc,
    'thumbnail_url',  v_thumb,
    'identity',       v_card,
    'updated_at',     public.footme_iso(l.l_updated_at),
    'scheduled_at',   public.footme_iso(l.l_scheduled_at),
    'schedule_timezone', l.l_timezone,
    'failure_code',   l.l_failure,
    'version',        l.l_version,
    'can_edit',       l.l_status <> 'publishing',
    'can_schedule',   v_can_sched and l.l_status <> 'publishing',
    'can_delete',     l.l_status <> 'publishing',
    'schedulable',    v_block is null,
    'unschedulable_reason', public.footme_content_blocker_reason(v_block));
end;
$$;

revoke all on function public.footme_content_list_item(text, uuid, uuid) from public;
revoke execute on function public.footme_content_list_item(text, uuid, uuid) from anon, authenticated;


-- ============================================================
-- SEZIONE 11 — RPC client: contesti e lancio (§4–§7, §14–§20, §84)
-- ============================================================

-- 11a. fetch_post_composer_context: riemessa dalla definizione più recente
-- (20261120090000 §6) in modo ADDITIVO: ogni identità guadagna
-- `can_schedule_content`, la risposta guadagna `schedule`. Le identità vengono
-- da footme_publishing_identities (can_post), la stessa regola di publish_post.
create or replace function public.fetch_post_composer_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pol jsonb := public.footme_schedule_policy();
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return jsonb_build_object(
    'identities', coalesce(
      (select jsonb_agg(
                x.card || jsonb_build_object('can_schedule_content', x.can_schedule)
                order by x.c_rank, x.card ->> 'name', x.card ->> 'identity_id')
       from (
         select i.c_rank, i.can_schedule,
                public.footme_composer_identity_card(i.c_type, i.c_id) as card
         from public.footme_publishing_identities(auth.uid()) i
         where i.can_post
       ) x
       where x.card is not null),
      '[]'::jsonb),
    'limits', public.footme_post_limits(),
    'schedule', jsonb_build_object(
      'min_lead_minutes', (v_pol ->> 'min_lead_minutes')::int,
      'max_horizon_days', (v_pol ->> 'max_horizon_days')::int));
end;
$$;

revoke all on function public.fetch_post_composer_context() from public;
revoke execute on function public.fetch_post_composer_context() from anon;
grant execute on function public.fetch_post_composer_context() to authenticated;

comment on function public.fetch_post_composer_context() is
  'HOM-06.1 §14–§20, §61 + HOM-06.2 §84: identità con can_publish_post (e can_schedule_content) e limiti del composer.';

-- 11b. Contesto dell'editor Articolo: solo le identità con can_publish_article.
create or replace function public.fetch_article_composer_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pol jsonb := public.footme_schedule_policy();
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return jsonb_build_object(
    'identities', coalesce(
      (select jsonb_agg(
                x.card || jsonb_build_object(
                  'can_schedule_content', x.can_schedule,
                  'article_modes', jsonb_build_array('native', 'external_link', 'imported_text'))
                order by x.c_rank, x.card ->> 'name', x.card ->> 'identity_id')
       from (
         select i.c_rank, i.can_schedule,
                public.footme_composer_identity_card(i.c_type, i.c_id) as card
         from public.footme_publishing_identities(auth.uid()) i
         where i.can_article
       ) x
       where x.card is not null),
      '[]'::jsonb),
    'limits', public.footme_article_limits(),
    'schedule', jsonb_build_object(
      'min_lead_minutes', (v_pol ->> 'min_lead_minutes')::int,
      'max_horizon_days', (v_pol ->> 'max_horizon_days')::int),
    'rights_declaration_version', coalesce(
      (select s.value #>> '{}' from public.app_policy_settings s
       where s.key = 'article.rights_declaration_version'), 'v1'));
end;
$$;

revoke all on function public.fetch_article_composer_context() from public;
revoke execute on function public.fetch_article_composer_context() from anon;
grant execute on function public.fetch_article_composer_context() to authenticated;

comment on function public.fetch_article_composer_context() is
  'HOM-06.2 §7B, §15–§20: identità con can_publish_article, modalità disponibili, limiti, schedulazione.';

-- 11c. Lancio del «+» (§4–§6, §9): cosa si può fare davvero.
create or replace function public.fetch_content_launcher()
returns jsonb
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

  return jsonb_build_object(
    'can_publish_post',    exists (select 1 from public.footme_publishing_identities(v_uid) i where i.can_post),
    'can_publish_article', exists (select 1 from public.footme_publishing_identities(v_uid) i where i.can_article),
    'can_view_drafts',     exists (select 1 from public.footme_publishing_identities(v_uid) i),
    'drafts_count',    (select count(*)::int from public.footme_content_actor_rows(v_uid, array['draft'])),
    'scheduled_count', (select count(*)::int from public.footme_content_actor_rows(v_uid, array['scheduled', 'publishing'])),
    'failed_count',    (select count(*)::int from public.footme_content_actor_rows(v_uid, array['failed'])));
end;
$$;

revoke all on function public.fetch_content_launcher() from public;
revoke execute on function public.fetch_content_launcher() from anon;
grant execute on function public.fetch_content_launcher() to authenticated;

comment on function public.fetch_content_launcher() is
  'HOM-06.2 §4–§6, §9: azioni disponibili nel + e conteggi di bozze, programmati e falliti accessibili al chiamante.';


-- ============================================================
-- SEZIONE 12 — RPC client: salvataggio, invio, lettura per l'editor
-- ============================================================

-- 12a. save_content_draft (§116–§132). Crea (p_ref null, idempotente per
-- (attore, chiave)) o aggiorna una bozza con CAS sulla versione. Validazione
-- lasca: forme, limiti, permessi, ownership degli asset. Rifiuta una bozza
-- vuota (content_empty). Una riga `failed` resta `failed`; un `scheduled` non si
-- salva da qui (si modifica con submit_content, §167).
create or replace function public.save_content_draft(
  p_operation_key    text,
  p_ref              jsonb,
  p_expected_version integer,
  p_format           text,
  p_identity_type    text,
  p_identity_id      uuid,
  p_payload          jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_creating boolean := (p_ref is null or p_ref = 'null'::jsonb);
  v_new     boolean := false;
  v_receipt public.content_operation_receipts;
  v_hash    text;
  v_ref     jsonb;
  v_res     jsonb;
  v_ctype   text;
  v_id      uuid;
  v_pub     jsonb;
  l         record;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_creating then
    if p_operation_key is null or length(btrim(p_operation_key)) < 8 or length(p_operation_key) > 120 then
      raise exception 'post_invalid_content' using errcode = '22023', detail = 'operation_key';
    end if;

    perform pg_advisory_xact_lock(hashtext('content_op:' || v_uid::text || ':' || p_operation_key));

    v_hash := md5(jsonb_build_object(
      'op', 'draft_create', 'format', p_format,
      'identity_type', p_identity_type, 'identity_id', p_identity_id,
      'payload', coalesce(p_payload, 'null'::jsonb))::text);

    select * into v_receipt from public.content_operation_receipts r
    where r.actor_id = v_uid and r.operation_key = p_operation_key;

    if found then
      -- La stessa chiave per un'altra operazione non è un retry.
      if v_receipt.op <> 'draft_create' then
        raise exception 'content_operation_conflict' using errcode = '40001', detail = 'payload';
      end if;
      -- Retry: stesso riferimento. Se la bozza non esiste più (eliminata, già
      -- pubblicata o programmata) non si presenta come successo.
      select * into l from public.footme_content_load(v_receipt.content_type, v_receipt.content_id, false);
      if not found or l.l_status not in ('draft', 'failed') then
        raise exception 'content_operation_conflict' using errcode = '40001', detail = 'gone';
      end if;
      if not public.footme_content_draft_access(v_receipt.content_type, v_receipt.content_id, v_uid) then
        raise exception 'content_not_found' using errcode = 'P0002';
      end if;
      if v_receipt.payload_hash = v_hash then
        return public.footme_content_state_json(v_receipt.content_type, v_receipt.content_id);
      end if;

      -- Stessa chiave ma contenuto cambiato: il client ha perso la risposta della
      -- creazione e ha continuato a scrivere. È un aggiornamento della stessa
      -- bozza (versione corrente), non un conflitto.
      v_res := public.footme_content_apply(
        v_uid, v_receipt.content_type, v_receipt.content_id, l.l_version, p_format,
        p_identity_type, p_identity_id, p_payload, array['draft', 'failed'], null);
      update public.content_operation_receipts r set payload_hash = v_hash where r.id = v_receipt.id;
    else
      v_new := true;
      v_res := public.footme_content_apply(
        v_uid, null, null, null, p_format, p_identity_type, p_identity_id, p_payload, array['draft'], null);
    end if;
  else
    v_ref := public.footme_content_ref_parse(p_ref);
    v_res := public.footme_content_apply(
      v_uid, v_ref ->> 'content_type', (v_ref ->> 'content_id')::uuid, p_expected_version,
      p_format, p_identity_type, p_identity_id, p_payload, array['draft', 'failed'], null);
  end if;

  -- Risposta persa e stessa operazione ripetuta: già applicata, stato corrente.
  if v_res ->> 'replayed' = 'true' then
    return public.footme_content_state_json(v_res ->> 'content_type', (v_res ->> 'content_id')::uuid);
  end if;

  v_ctype := v_res ->> 'content_type';
  v_id := (v_res ->> 'content_id')::uuid;

  -- Nessun draft fantasma (§118): se il contenuto salvato è vuoto l'eccezione
  -- annulla anche la riga appena creata.
  if not public.footme_content_is_significant(v_ctype, v_id) then
    raise exception 'content_empty' using errcode = '22023';
  end if;

  -- Impostazione di pubblicazione desiderata (§81): in bozza si salva senza
  -- cambiare stato. Nessun controllo sull'orario qui: lo fa la programmazione.
  if p_payload ? 'publication' and v_res ->> 'status' = 'draft' then
    v_pub := public.footme_publication_parse(p_payload -> 'publication', false);
    execute format('update public.%I set scheduled_at = $2, schedule_timezone = $3 where id = $1',
                   public.footme_content_table(v_ctype))
      using v_id,
            case when v_pub ->> 'mode' = 'scheduled' then (v_pub ->> 'scheduled_at')::timestamptz end,
            case when v_pub ->> 'mode' = 'scheduled' then v_pub ->> 'timezone' end;
  end if;

  if v_new then
    insert into public.content_operation_receipts
      (actor_id, operation_key, op, content_type, content_id, payload_hash)
    values (v_uid, p_operation_key, 'draft_create', v_ctype, v_id, v_hash);

    perform public.footme_content_audit(v_ctype, v_id, v_uid, p_identity_type, p_identity_id, 'create', 'created');
  end if;

  return public.footme_content_state_json(v_ctype, v_id);
end;
$$;

revoke all on function public.save_content_draft(text, jsonb, integer, text, text, uuid, jsonb) from public;
revoke execute on function public.save_content_draft(text, jsonb, integer, text, text, uuid, jsonb) from anon;
grant execute on function public.save_content_draft(text, jsonb, integer, text, text, uuid, jsonb) to authenticated;

comment on function public.save_content_draft(text, jsonb, integer, text, text, uuid, jsonb) is
  'HOM-06.2 §116–§132: crea (idempotente) o aggiorna una bozza di Post o Articolo, CAS su content_version (content_version_conflict 40001, detail = versione corrente). Cambio identità tra tabelle = sposta la bozza e restituisce il nuovo riferimento.';

-- 12b. submit_content (§77–§79, §150, §167–§168, §203–§227). Salva e porta
-- allo stato richiesto in UNA transazione: la persistenza è la stessa di
-- save_content_draft, poi la regola unica (footme_content_blocker) giudica lo
-- stato salvato. Una validazione che fallisce annulla anche il salvataggio.
--   publication.mode 'now'       → published
--                    'scheduled' → scheduled (data, fuso, can_schedule, lead time)
--                    'keep'      → scheduled che resta com'è (§167), oppure
--                                  Articolo pubblicato modificato in place (§227)
create or replace function public.submit_content(
  p_operation_key    text,
  p_ref              jsonb,
  p_expected_version integer,
  p_format           text,
  p_identity_type    text,
  p_identity_id      uuid,
  p_payload          jsonb,
  p_publication      jsonb,
  p_origin           text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_creating boolean := (p_ref is null or p_ref = 'null'::jsonb);
  v_receipt public.content_operation_receipts;
  v_hash    text;
  v_ref     jsonb;
  v_res     jsonb;
  v_ctype   text;
  v_id      uuid;
  v_pub     jsonb;
  v_mode    text;
  v_at      timestamptz;
  v_tz      text;
  v_blk     text;
  v_ver     integer;
  v_status  text;
  l         record;
  v_ident   jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_operation_key is null or length(btrim(p_operation_key)) < 8 or length(p_operation_key) > 120 then
    raise exception 'post_invalid_content' using errcode = '22023', detail = 'operation_key';
  end if;

  perform pg_advisory_xact_lock(hashtext('content_op:' || v_uid::text || ':' || p_operation_key));

  -- L'origin non entra nell'impronta: è navigazione, non contenuto.
  v_hash := md5(jsonb_build_object(
    'op', 'submit', 'ref', coalesce(p_ref, 'null'::jsonb), 'format', p_format,
    'identity_type', p_identity_type, 'identity_id', p_identity_id,
    'payload', coalesce(p_payload, 'null'::jsonb),
    'publication', coalesce(p_publication, 'null'::jsonb))::text);

  select * into v_receipt from public.content_operation_receipts r
  where r.actor_id = v_uid and r.operation_key = p_operation_key;

  if found then
    if v_receipt.op <> 'submit' or v_receipt.payload_hash <> v_hash then
      raise exception 'content_operation_conflict' using errcode = '40001', detail = 'payload';
    end if;
    select * into l from public.footme_content_load(v_receipt.content_type, v_receipt.content_id, false);
    if not found or l.l_status not in ('published', 'scheduled', 'publishing') then
      raise exception 'content_operation_conflict' using errcode = '40001', detail = 'gone';
    end if;
    return jsonb_build_object(
      'content_type', v_receipt.content_type, 'content_id', v_receipt.content_id,
      'status', l.l_status, 'scheduled_at', public.footme_iso(l.l_scheduled_at),
      'version', l.l_version, 'replayed', true);
  end if;

  if p_origin is null or p_origin not in (
       'HOME_PER_TE', 'HOME_SEGUITI', 'PERSONAL_PROFILE', 'SOCIETY_PROFILE',
       'MEDIA_PROFILE', 'CONTENT_DETAIL', 'DRAFTS', 'SCHEDULED', 'NOTIFICATION') then
    raise exception 'post_invalid_content' using errcode = '22023', detail = 'origin';
  end if;

  v_pub := public.footme_publication_parse(p_publication, true);
  v_mode := v_pub ->> 'mode';

  if v_creating then
    if v_mode = 'keep' then
      raise exception 'content_invalid_state' using errcode = '55000', detail = 'publication';
    end if;
    v_res := public.footme_content_apply(
      v_uid, null, null, null, p_format, p_identity_type, p_identity_id, p_payload, array['draft'],
      jsonb_build_object('submit', coalesce(p_publication, 'null'::jsonb)));
  else
    v_ref := public.footme_content_ref_parse(p_ref);
    v_res := public.footme_content_apply(
      v_uid, v_ref ->> 'content_type', (v_ref ->> 'content_id')::uuid, p_expected_version,
      p_format, p_identity_type, p_identity_id, p_payload,
      array['draft', 'scheduled', 'failed', 'published'],
      jsonb_build_object('submit', coalesce(p_publication, 'null'::jsonb)));
  end if;

  v_ctype := v_res ->> 'content_type';
  v_id := (v_res ->> 'content_id')::uuid;
  v_status := v_res ->> 'status';

  -- Risposta persa: lo stesso invio (payload e publication) era già stato
  -- applicato dall'ultima scrittura. Si restituisce l'esito corrente come replay
  -- e si registra la chiave, senza riscrivere né ripetere la transizione.
  if v_res ->> 'replayed' = 'true' then
    select * into l from public.footme_content_load(v_ctype, v_id, false);
    insert into public.content_operation_receipts
      (actor_id, operation_key, op, content_type, content_id, payload_hash)
    values (v_uid, p_operation_key, 'submit', v_ctype, v_id, v_hash);
    return jsonb_build_object(
      'content_type', v_ctype, 'content_id', v_id, 'status', l.l_status,
      'scheduled_at', case when l.l_status = 'scheduled' then public.footme_iso(l.l_scheduled_at) end,
      'version', l.l_version, 'replayed', true);
  end if;

  select * into l from public.footme_content_load(v_ctype, v_id, true);

  if v_status = 'published' then
    -- Articolo pubblicato modificato in place (§227): stesso id, stessa riga.
    if v_mode <> 'keep' then
      raise exception 'content_invalid_state' using errcode = '55000', detail = 'publication';
    end if;
    -- Modifica con la sola capability di modifica (verificata in apply): il
    -- controllo di pubblicazione non si applica, restano le regole del contenuto.
    perform public.footme_content_raise_blocker(
      public.footme_content_blocker(v_ctype, v_id, v_uid, 'edit'), v_ctype, v_id);
    execute format('update public.%I set edited_at = clock_timestamp() where id = $1',
                   public.footme_content_table(v_ctype)) using v_id;
    perform public.footme_content_audit(v_ctype, v_id, v_uid, p_identity_type, p_identity_id, 'edit', 'edited');

  elsif v_mode = 'keep' then
    if v_status <> 'scheduled' then
      raise exception 'content_invalid_state' using errcode = '55000', detail = 'publication';
    end if;
    -- La data resta, ma deve essere ancora nel futuro (§98): rivalidare.
    perform public.footme_schedule_check(l.l_scheduled_at, false);
    perform public.footme_content_raise_blocker(
      public.footme_content_blocker(v_ctype, v_id, v_uid, 'schedule'), v_ctype, v_id);
    -- Il worker rivaluta la capability di chi ha CONFERMATO per ultimo la
    -- programmazione: se la conferma la dà un altro amministratore, è lui.
    execute format('update public.%I set scheduled_by_profile_id = $2 where id = $1',
                   public.footme_content_table(v_ctype)) using v_id, v_uid;

  elsif v_mode = 'scheduled' then
    v_at := (v_pub ->> 'scheduled_at')::timestamptz;
    v_tz := v_pub ->> 'timezone';
    perform public.footme_schedule_check(v_at, true);
    perform public.footme_content_raise_blocker(
      public.footme_content_blocker(v_ctype, v_id, v_uid, 'schedule'), v_ctype, v_id);
    v_ver := public.footme_content_set_state(
      v_ctype, v_id, array['draft', 'scheduled', 'failed'], 'scheduled', v_at, v_tz, v_uid, null, false, false);
    if v_ver is null then
      raise exception 'content_invalid_state' using errcode = '55000';
    end if;
    perform public.footme_content_audit(v_ctype, v_id, v_uid, p_identity_type, p_identity_id, 'schedule', 'scheduled');

  else
    -- now. Da scheduled/failed richiede anche can_schedule e gli asset pronti
    -- (stessa regola del worker); da una bozza vale §110 (video in processing ok).
    perform public.footme_content_raise_blocker(
      public.footme_content_blocker(
        v_ctype, v_id, v_uid, case when v_status = 'draft' then 'now' else 'schedule' end),
      v_ctype, v_id);
    v_ver := public.footme_content_set_state(
      v_ctype, v_id, array['draft', 'scheduled', 'failed'], 'published',
      case when v_status = 'draft' then null else l.l_scheduled_at end,
      case when v_status = 'draft' then null else l.l_timezone end,
      case when v_status = 'draft' then null else l.l_scheduled_by end,
      null, true, false);
    if v_ver is null then
      raise exception 'content_invalid_state' using errcode = '55000';
    end if;
    perform public.footme_content_audit(v_ctype, v_id, v_uid, p_identity_type, p_identity_id, 'publish', 'published');
  end if;

  insert into public.content_operation_receipts
    (actor_id, operation_key, op, content_type, content_id, payload_hash)
  values (v_uid, p_operation_key, 'submit', v_ctype, v_id, v_hash);

  if v_creating then
    perform public.footme_content_audit(v_ctype, v_id, v_uid, p_identity_type, p_identity_id, 'create', 'created');
  end if;

  select * into l from public.footme_content_load(v_ctype, v_id, false);
  return jsonb_build_object(
    'content_type', v_ctype, 'content_id', v_id,
    'status', l.l_status,
    'scheduled_at', case when l.l_status = 'scheduled' then public.footme_iso(l.l_scheduled_at) end,
    'version', l.l_version, 'replayed', false);
end;
$$;

revoke all on function public.submit_content(text, jsonb, integer, text, text, uuid, jsonb, jsonb, text) from public;
revoke execute on function public.submit_content(text, jsonb, integer, text, text, uuid, jsonb, jsonb, text) from anon;
grant execute on function public.submit_content(text, jsonb, integer, text, text, uuid, jsonb, jsonb, text) to authenticated;

comment on function public.submit_content(text, jsonb, integer, text, text, uuid, jsonb, jsonb, text) is
  'HOM-06.2: pubblica, programma o conferma (keep) un Post o un Articolo. Salva e valida lo stato salvato nella stessa transazione, idempotente per (attore, operation_key). Errori: content_*, schedule_*, article_*, post_*.';

-- 12c. fetch_content_for_editor (§146–§148): tutto ciò che serve a riaprire
-- l'editor. Vale per draft/scheduled/publishing/failed (accesso bozza) e per un
-- Articolo pubblicato (capability di modifica HOM-04). Chi non ha accesso riceve
-- content_not_found, identico a «non esiste» (§259).
create or replace function public.fetch_content_for_editor(
  p_content_type text,
  p_content_id   uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_ref     jsonb;
  l         record;
  v_rights  record;
  v_card    jsonb;
  v_cap     record;
  v_body    text;
  v_ex      public.content_post_extras;
  v_art     public.content_articles;
  v_post    jsonb := null;
  v_article jsonb := null;
  v_title   text;
  v_legacy  record;
  v_can_del boolean;
  v_can_sch boolean := false;
  v_pub     jsonb;
  v_src     jsonb := null;
  v_prov    jsonb := null;
  v_doc     jsonb;
  v_cover   jsonb;
  v_mode    text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_ref := public.footme_content_ref_parse(
    jsonb_build_object('content_type', p_content_type, 'content_id', p_content_id::text));

  select * into l from public.footme_content_load(p_content_type, p_content_id, false);
  if not found or l.l_status = 'deleted' or l.l_format is null then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;

  if l.l_status = 'published' then
    select * into v_rights from public.footme_content_rights(p_content_type, p_content_id) r;
    if l.l_format <> 'article' or v_rights.r_can_edit is not true then
      raise exception 'content_not_found' using errcode = 'P0002';
    end if;
    v_can_del := coalesce(v_rights.r_can_delete, false);
    v_can_sch := false;
  else
    if not public.footme_content_draft_access(p_content_type, p_content_id, v_uid) then
      raise exception 'content_not_found' using errcode = 'P0002';
    end if;
    v_can_del := l.l_status in ('draft', 'scheduled', 'failed');
    v_can_sch := coalesce((
      select i.can_schedule from public.footme_publishing_identities(v_uid) i
      where i.c_type = l.l_identity_type and i.c_id = l.l_identity_id), false);
  end if;

  v_card := public.footme_composer_identity_card(l.l_identity_type, l.l_identity_id);

  v_pub := case when l.l_scheduled_at is not null
                then jsonb_build_object('mode', 'scheduled',
                                        'scheduled_at', public.footme_iso(l.l_scheduled_at),
                                        'timezone', l.l_timezone)
                else jsonb_build_object('mode', 'now', 'scheduled_at', null, 'timezone', null) end;
  if l.l_status = 'published' then
    v_pub := jsonb_build_object('mode', 'now', 'scheduled_at', null, 'timezone', null);
  end if;

  if l.l_format = 'post' then
    v_body := case p_content_type
      when 'profile_post' then (select x.body from public.profile_posts x where x.id = p_content_id)
      when 'club_media'   then (select x.body from public.club_media_posts x where x.id = p_content_id)
      else                     (select x.body from public.media_profile_posts x where x.id = p_content_id)
    end;
    select * into v_ex from public.content_post_extras x
    where x.content_type = p_content_type and x.post_id = p_content_id;

    v_post := jsonb_build_object(
      'body',     coalesce(v_body, ''),
      'mentions', coalesce(v_ex.mentions, '[]'::jsonb),
      'tagged',   public.footme_content_tags_json(p_content_type, p_content_id),
      'media', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'position', m.position, 'storage_path', m.storage_path,
                 'thumbnail_path', m.thumbnail_storage_path,
                 'media_type', m.media_type, 'url', m.url, 'thumbnail_url', m.thumbnail_url,
                 'width', m.width, 'height', m.height, 'duration_seconds', m.duration_seconds,
                 'alt_text', m.alt_text, 'processing_state', m.processing_state)
               order by m.position)
        from public.content_post_media m
        where m.content_type = p_content_type and m.post_id = p_content_id), '[]'::jsonb),
      'link', case when v_ex.link_target is not null then jsonb_build_object(
                 'url', v_ex.link_target ->> 'url',
                 'snapshot_id', v_ex.link_target -> 'snapshot_id',
                 'preview', v_ex.link_preview) end);
  else
    select * into v_art from public.content_articles a
    where a.content_type = p_content_type and a.post_id = p_content_id;

    if p_content_type = 'club_media' then
      select x.title, x.body, x.external_url, x.visual_url as cover_url
        into v_legacy from public.club_media_posts x where x.id = p_content_id;
    else
      select x.title, x.body, x.external_url, x.cover_url
        into v_legacy from public.media_profile_posts x where x.id = p_content_id;
    end if;
    v_title := v_legacy.title;

    if v_art.post_id is not null then
      v_mode := v_art.creation_mode;
      v_doc := v_art.document;
      v_cover := v_art.cover;
      if v_mode = 'external_link' and v_art.source_url is not null then
        v_src := jsonb_build_object(
          'url', v_art.source_url, 'normalized_url', v_art.source_normalized_url,
          'final_url', v_art.source_final_url, 'canonical_url', v_art.source_canonical_url,
          'domain', v_art.source_domain, 'site_name', v_art.source_site_name,
          'snapshot', v_art.source_snapshot, 'snapshot_id', v_art.source_snapshot_id,
          'manual_title', v_art.manual_title);
      end if;
      if v_mode = 'imported_text' then
        v_prov := jsonb_build_object(
          'published_elsewhere', v_art.published_elsewhere,
          'source_name', v_art.original_source_name,
          'original_author', v_art.original_author,
          'original_url', v_art.original_url,
          'no_original_link', v_art.no_original_link);
      end if;
    else
      -- Vecchio Articolo Media (decisione 4): documento dal testo, modalità da source_type.
      v_mode := case when p_content_type = 'media_profile' then
                  (select case x.source_type when 'link' then 'external_link'
                                             when 'pasted' then 'imported_text'
                                             else 'native' end
                   from public.media_profile_posts x where x.id = p_content_id)
                else 'native' end;
      v_doc := public.footme_article_document_from_text(v_legacy.body);
      v_cover := case when v_legacy.cover_url is not null
                      then jsonb_build_object('url', v_legacy.cover_url) end;
      if v_mode = 'external_link' and v_legacy.external_url ~ '^https://' then
        v_src := jsonb_build_object('url', v_legacy.external_url, 'final_url', v_legacy.external_url,
                                    'manual_title', false);
      end if;
    end if;

    v_article := jsonb_build_object(
      'creation_mode', v_mode,
      'title',   coalesce(v_title, ''),
      'cover',   v_cover,
      'document', v_doc,
      'tagged',  public.footme_content_tags_json(p_content_type, p_content_id),
      'source',  v_src,
      'provenance', v_prov,
      'rights_confirmed', public.footme_article_rights_valid(p_content_type, p_content_id));
  end if;

  return jsonb_build_object(
    'content_type', p_content_type,
    'content_id',   p_content_id,
    'format',       l.l_format,
    'status',       l.l_status,
    'version',      l.l_version,
    'updated_at',   public.footme_iso(l.l_updated_at),
    'identity',     v_card,
    'publication',  v_pub,
    'capabilities', jsonb_build_object(
                      'can_edit', true, 'can_schedule', v_can_sch, 'can_delete', v_can_del),
    'post',         v_post,
    'article',      v_article,
    'failure_code', l.l_failure);
end;
$$;

revoke all on function public.fetch_content_for_editor(text, uuid) from public;
revoke execute on function public.fetch_content_for_editor(text, uuid) from anon;
grant execute on function public.fetch_content_for_editor(text, uuid) to authenticated;

comment on function public.fetch_content_for_editor(text, uuid) is
  'HOM-06.2 §146–§148: payload completo per riaprire l editor di una bozza, un programmato, un fallito o un Articolo pubblicato modificabile. content_not_found se non esiste o non è accessibile.';

-- 12d. list_content_drafts (§137–§162, §230, §292–§293): Post e Articoli
-- insieme. `drafts` per updated_at desc; `scheduled` (scheduled, publishing,
-- failed) per scheduled_at asc. Solo righe a cui il chiamante ha accesso.
create or replace function public.list_content_drafts(
  p_tab    text,
  p_cursor jsonb,
  p_limit  integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_limit  integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_items  jsonb := '[]'::jsonb;
  v_n      integer := 0;
  v_next   jsonb := null;
  v_cur_ts timestamptz;
  v_cur_id uuid;
  r        record;
  v_last   record;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_tab is null or p_tab not in ('drafts', 'scheduled') then
    raise exception 'post_invalid_content' using errcode = '22023', detail = 'tab';
  end if;

  if coalesce(jsonb_typeof(p_cursor), 'null') = 'object' then
    begin
      v_cur_ts := (p_cursor ->> 'ts')::timestamptz;
      v_cur_id := (p_cursor ->> 'id')::uuid;
    exception when others then
      raise exception 'post_invalid_content' using errcode = '22023', detail = 'cursor';
    end;
  end if;

  for r in
    select x.r_type, x.r_id,
           case when p_tab = 'drafts' then x.r_updated_at else x.r_scheduled_at end as sort_ts
    from public.footme_content_actor_rows(
           v_uid,
           case when p_tab = 'drafts' then array['draft'] else array['scheduled', 'publishing', 'failed'] end) x
    where v_cur_ts is null
       or (p_tab = 'drafts'
           and (x.r_updated_at < v_cur_ts or (x.r_updated_at = v_cur_ts and x.r_id > v_cur_id)))
       or (p_tab = 'scheduled'
           and (x.r_scheduled_at > v_cur_ts or (x.r_scheduled_at = v_cur_ts and x.r_id > v_cur_id)))
    order by case when p_tab = 'drafts' then x.r_updated_at end desc nulls last,
             case when p_tab = 'scheduled' then x.r_scheduled_at end asc nulls last,
             x.r_id
    limit v_limit + 1
  loop
    v_n := v_n + 1;
    if v_n > v_limit then
      v_next := jsonb_build_object('ts', public.footme_iso(v_last.sort_ts), 'id', v_last.r_id);
      exit;
    end if;
    v_items := v_items || jsonb_build_array(public.footme_content_list_item(r.r_type, r.r_id, v_uid));
    v_last := r;
  end loop;

  return jsonb_build_object('items', v_items, 'next_cursor', v_next);
end;
$$;

revoke all on function public.list_content_drafts(text, jsonb, integer) from public;
revoke execute on function public.list_content_drafts(text, jsonb, integer) from anon;
grant execute on function public.list_content_drafts(text, jsonb, integer) to authenticated;

comment on function public.list_content_drafts(text, jsonb, integer) is
  'HOM-06.2 §137–§162: bozze (updated_at desc) o programmati/in pubblicazione/falliti (scheduled_at asc) accessibili al chiamante, Post e Articoli insieme. Cursore keyset {ts, id}.';


-- ============================================================
-- SEZIONE 13 — RPC client: comandi sul lifecycle (§150, §168–§179, §195–§198)
--
-- Ognuno: lock di riga + accesso + CAS (prologo comune), poi rivalidazione
-- dello STATO SALVATO con la regola unica, poi UNA transizione condizionata
-- allo stato atteso. Il vecchio job non può ripubblicare: il worker guarda solo
-- status = 'scheduled', e una riga già published/draft/deleted non lo è.
-- ============================================================

-- 13a. Programma (da bozza, §150) o cambia data e ora (§168).
create or replace function public.schedule_content(
  p_ref              jsonb,
  p_expected_version integer,
  p_scheduled_at     timestamptz,
  p_timezone         text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  g      jsonb;
  v_pub  jsonb;
  v_at   timestamptz;
  v_ver  integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  g := public.footme_content_action_guard(v_uid, p_ref, p_expected_version, array['draft', 'scheduled']);

  v_pub := public.footme_publication_parse(
    jsonb_build_object(
      'mode', 'scheduled',
      'scheduled_at', public.footme_iso(p_scheduled_at),
      'timezone', p_timezone),
    false);
  v_at := (v_pub ->> 'scheduled_at')::timestamptz;

  perform public.footme_schedule_check(v_at, true);
  perform public.footme_content_raise_blocker(
    public.footme_content_blocker(g ->> 'content_type', (g ->> 'content_id')::uuid, v_uid, 'schedule'),
    g ->> 'content_type', (g ->> 'content_id')::uuid);

  v_ver := public.footme_content_set_state(
    g ->> 'content_type', (g ->> 'content_id')::uuid, array['draft', 'scheduled'], 'scheduled',
    v_at, v_pub ->> 'timezone', v_uid, null, false, false);
  if v_ver is null then
    raise exception 'content_invalid_state' using errcode = '55000';
  end if;

  perform public.footme_content_audit(
    g ->> 'content_type', (g ->> 'content_id')::uuid, v_uid,
    g ->> 'identity_type', (g ->> 'identity_id')::uuid, 'schedule', 'scheduled');

  return jsonb_build_object('status', 'scheduled', 'scheduled_at', public.footme_iso(v_at), 'version', v_ver);
end;
$$;

revoke all on function public.schedule_content(jsonb, integer, timestamptz, text) from public;
revoke execute on function public.schedule_content(jsonb, integer, timestamptz, text) from anon;
grant execute on function public.schedule_content(jsonb, integer, timestamptz, text) to authenticated;

comment on function public.schedule_content(jsonb, integer, timestamptz, text) is
  'HOM-06.2 §150, §168: programma una bozza o cambia data e ora di un programmato. Rivalida lo stato salvato, can_schedule, lead time e orizzonte.';

-- 13b. Pubblica ora (§171–§174) da scheduled, o Riprova (§196) da failed. Una
-- sola transizione vince; la riga diventa published e il vecchio job non la
-- vede più.
create or replace function public.publish_content_now(
  p_ref              jsonb,
  p_expected_version integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  g     jsonb;
  l     record;
  v_ver integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  g := public.footme_content_action_guard(v_uid, p_ref, p_expected_version, array['scheduled', 'failed']);

  -- Identità, capability (anche can_schedule), asset e stato salvato: gli
  -- stessi controlli del worker (§196).
  perform public.footme_content_raise_blocker(
    public.footme_content_blocker(g ->> 'content_type', (g ->> 'content_id')::uuid, v_uid, 'schedule'),
    g ->> 'content_type', (g ->> 'content_id')::uuid);

  select * into l from public.footme_content_load(g ->> 'content_type', (g ->> 'content_id')::uuid, false);

  v_ver := public.footme_content_set_state(
    g ->> 'content_type', (g ->> 'content_id')::uuid, array['scheduled', 'failed'], 'published',
    l.l_scheduled_at, l.l_timezone, l.l_scheduled_by, null, true, false);
  if v_ver is null then
    raise exception 'content_invalid_state' using errcode = '55000';
  end if;

  perform public.footme_content_audit(
    g ->> 'content_type', (g ->> 'content_id')::uuid, v_uid,
    g ->> 'identity_type', (g ->> 'identity_id')::uuid, 'publish', 'published');

  return jsonb_build_object('status', 'published', 'version', v_ver);
end;
$$;

revoke all on function public.publish_content_now(jsonb, integer) from public;
revoke execute on function public.publish_content_now(jsonb, integer) from anon;
grant execute on function public.publish_content_now(jsonb, integer) to authenticated;

comment on function public.publish_content_now(jsonb, integer) is
  'HOM-06.2 §171–§174, §196: pubblica subito un programmato o riprova un fallito. Una sola transizione vincente.';

-- 13c. Sposta nelle bozze (§175–§177): scheduled|failed → draft. Dati e asset
-- si conservano; scheduled_at si azzera, così nessun job può più prenderla.
create or replace function public.move_content_to_draft(
  p_ref              jsonb,
  p_expected_version integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  g     jsonb;
  v_ver integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  g := public.footme_content_action_guard(v_uid, p_ref, p_expected_version, array['scheduled', 'failed']);

  v_ver := public.footme_content_set_state(
    g ->> 'content_type', (g ->> 'content_id')::uuid, array['scheduled', 'failed'], 'draft',
    null, null, null, null, false, false);
  if v_ver is null then
    raise exception 'content_invalid_state' using errcode = '55000';
  end if;

  perform public.footme_content_audit(
    g ->> 'content_type', (g ->> 'content_id')::uuid, v_uid,
    g ->> 'identity_type', (g ->> 'identity_id')::uuid, 'unschedule', 'unscheduled');

  return jsonb_build_object('status', 'draft', 'version', v_ver);
end;
$$;

revoke all on function public.move_content_to_draft(jsonb, integer) from public;
revoke execute on function public.move_content_to_draft(jsonb, integer) from anon;
grant execute on function public.move_content_to_draft(jsonb, integer) to authenticated;

comment on function public.move_content_to_draft(jsonb, integer) is
  'HOM-06.2 §175–§177: riporta un programmato o fallito in bozza, azzerando la data. Il job futuro non può più pubblicarlo.';

-- 13d. Elimina bozza / programmato / fallito (§153, §178–§179). Soft delete col
-- meccanismo di HOM-04 (flag locale + ruolo non client): il worker non la vede
-- più. Un contenuto già pubblicato si elimina con delete_content (HOM-04).
create or replace function public.delete_content_draft(
  p_ref              jsonb,
  p_expected_version integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  g       jsonb;
  v_table text;
  v_now   timestamptz := clock_timestamp();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  g := public.footme_content_action_guard(v_uid, p_ref, p_expected_version, array['draft', 'scheduled', 'failed']);
  v_table := public.footme_content_table(g ->> 'content_type');

  perform set_config('prolink.content_delete', 'on', true);
  execute format(
    'update public.%I
        set status = ''deleted'', deleted_at = $2, deleted_by_profile_id = $3, updated_at = $2,
            content_version = content_version + 1
      where id = $1 and status = any (array[''draft'', ''scheduled'', ''failed''])', v_table)
    using (g ->> 'content_id')::uuid, v_now, v_uid;
  perform set_config('prolink.content_delete', 'off', true);

  perform public.footme_content_audit(
    g ->> 'content_type', (g ->> 'content_id')::uuid, v_uid,
    g ->> 'identity_type', (g ->> 'identity_id')::uuid, 'delete', 'deleted');

  return jsonb_build_object('status', 'deleted');
end;
$$;

revoke all on function public.delete_content_draft(jsonb, integer) from public;
revoke execute on function public.delete_content_draft(jsonb, integer) from anon;
grant execute on function public.delete_content_draft(jsonb, integer) to authenticated;

comment on function public.delete_content_draft(jsonb, integer) is
  'HOM-06.2 §153, §178–§179: elimina (soft delete) una bozza, un programmato o un fallito. Il worker non lo vede più.';


-- ============================================================
-- SEZIONE 14 — dettaglio pubblico dell'Articolo (§74, §7K, §7U)
-- ============================================================

-- Solo per righe `published` visibili al chiamante (le regole del Feed: non
-- bloccato, già pubblicato) o gestibili da lui. Mai diritti, mai actor, mai
-- created_by: solo ciò che il lettore deve vedere. Un vecchio Articolo Media
-- (senza riga in content_articles) si legge dal body e da source_type.
create or replace function public.fetch_article_detail(
  p_content_type text,
  p_content_id   uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  l        record;
  v_art    public.content_articles;
  v_rights record;
  v_leg    record;
  v_mode   text;
  v_doc    jsonb;
  v_cover  jsonb;
  v_source jsonb := null;
  v_attr   jsonb := null;
  v_snap   jsonb;
  v_open   text;
  v_domain text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_content_type not in ('club_media', 'media_profile') or p_content_id is null then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;

  select * into l from public.footme_content_load(p_content_type, p_content_id, false);
  if not found or l.l_status <> 'published' or l.l_kind is distinct from 'article' then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;

  select * into v_rights from public.footme_content_rights(p_content_type, p_content_id) r;
  if not (v_rights.r_can_edit is true
          or exists (select 1 from public.footme_feed_readable_items(
                       v_uid, array[p_content_type], array[p_content_id]))) then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;

  select * into v_art from public.content_articles a
  where a.content_type = p_content_type and a.post_id = p_content_id;

  if v_art.post_id is not null then
    v_mode := v_art.creation_mode;
    v_doc := v_art.document;
    v_cover := case when v_art.cover is not null
                    then jsonb_strip_nulls(jsonb_build_object(
                      'url', v_art.cover ->> 'url', 'width', v_art.cover -> 'width',
                      'height', v_art.cover -> 'height', 'alt_text', v_art.cover ->> 'alt_text')) end;

    if v_mode = 'external_link' then
      v_snap := coalesce(v_art.source_snapshot, '{}'::jsonb);
      v_source := jsonb_strip_nulls(jsonb_build_object(
        'open_url',    coalesce(v_art.source_final_url, v_art.source_url),
        'domain',      v_art.source_domain,
        'site_name',   v_art.source_site_name,
        'title',       v_snap ->> 'title',
        'description', v_snap ->> 'description',
        'image_url',   v_snap ->> 'image_url',
        'favicon_url', v_snap ->> 'favicon_url'));
    elsif v_mode = 'imported_text' and v_art.published_elsewhere is true then
      -- §7U: la fonte resta visibile finché il contenuto è pubblico; «nessun
      -- link» è dichiarato, non un link vuoto.
      v_attr := jsonb_strip_nulls(jsonb_build_object(
        'published_elsewhere', true,
        'source_name',     v_art.original_source_name,
        'original_author', v_art.original_author,
        'original_url',    v_art.original_url));
    end if;
  else
    -- Articolo precedente a HOM-06.2.
    if p_content_type = 'club_media' then
      select x.body, x.external_url, x.visual_url as cover_url, 'native'::text as src
        into v_leg from public.club_media_posts x where x.id = p_content_id;
    else
      select x.body, x.external_url, x.cover_url,
             case x.source_type when 'link' then 'external_link'
                                when 'pasted' then 'imported_text'
                                else 'native' end as src
        into v_leg from public.media_profile_posts x where x.id = p_content_id;
    end if;
    v_mode := v_leg.src;
    v_doc := public.footme_article_document_from_text(v_leg.body);
    v_cover := case when v_leg.cover_url is not null then jsonb_build_object('url', v_leg.cover_url) end;
    if v_mode = 'external_link' and v_leg.external_url ~ '^https://' then
      v_domain := regexp_replace(lower(split_part(substr(v_leg.external_url, 9), '/', 1)), '^www\.', '');
      v_source := jsonb_build_object('open_url', v_leg.external_url, 'domain', v_domain);
    end if;
  end if;

  return jsonb_build_object(
    'creation_mode', v_mode,
    'document',      v_doc,
    'cover',         v_cover,
    'source',        v_source,
    'attribution',   v_attr);
end;
$$;

revoke all on function public.fetch_article_detail(text, uuid) from public;
revoke execute on function public.fetch_article_detail(text, uuid) from anon;
grant execute on function public.fetch_article_detail(text, uuid) to authenticated;

comment on function public.fetch_article_detail(text, uuid) is
  'HOM-06.2 §74, §7K, §7U: documento, cover, fonte e attribuzione di un Articolo pubblicato visibile al chiamante. Mai diritti né autore tecnico.';


-- ============================================================
-- SEZIONE 15 — worker della pubblicazione programmata (§184–§190, §199–§201)
--
-- Una funzione SQL idempotente, chiamata da pg_cron ogni minuto: non dipende
-- da nessun client (§185). Per ogni riga `scheduled` con `scheduled_at <= now()`
-- (`for update skip locked`, in ordine di scheduled_at): → `publishing`
-- (tentativi + 1) → rivalida identità, capability di CHI HA PROGRAMMATO e stato
-- salvato con la regola unica (snapshot persistito: nessun nuovo scraping, §7W)
-- → `published` (published_at = istante reale) oppure `failed` (codice del
-- motivo). Idempotente: due sweep concorrenti non pubblicano due volte (skip
-- locked + transizione condizionata allo stato atteso); una riga già pubblicata,
-- riportata in bozza o eliminata non è `scheduled` e il job non la vede (§174,
-- §179). Il passaggio per `publishing` avviene DENTRO la transazione dello
-- sweep: non è mai osservabile da fuori, e se la transazione cade (crash) la riga
-- resta `scheduled` e il prossimo sweep la riprende. Per questo non esiste una
-- «ripresa dei publishing scaduti»: non potrebbe mai scattare.
-- ============================================================

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
begin
  if p_recipient is null then
    return;
  end if;

  -- Centro Notifiche, mai Messaggi (§202). Categoria e preferenze le decide
  -- notifications_before_insert: un tipo senza voce è 'sistema' e non ha un
  -- interruttore, perché racconta l'esito di un'azione dell'utente stesso.
  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    p_recipient,
    case when p_published then 'scheduled_content_published' else 'scheduled_content_failed' end,
    case when p_published then 'Il contenuto programmato è stato pubblicato.'
         else 'Non è stato possibile pubblicare un contenuto programmato.' end,
    null,
    jsonb_build_object('content_type', p_content_type, 'content_id', p_id));
end;
$$;

revoke all on function public.footme_notify_scheduled_content(uuid, text, uuid, boolean) from public;
revoke execute on function public.footme_notify_scheduled_content(uuid, text, uuid, boolean) from anon, authenticated;

create or replace function public.run_scheduled_content_sweep(p_limit integer default 50)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_now   timestamptz := clock_timestamp();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 500);
  v_cands jsonb := '[]'::jsonb;
  v_done  integer := 0;
  x       record;
  c       record;
  l       record;
  v_actor uuid;
  v_notify uuid;
  v_ver   integer;
  v_block text;
begin
  -- Candidati: si bloccano per tabella (skip locked) e si ordinano insieme.
  for x in
    select pp.id, pp.scheduled_at from public.profile_posts pp
    where pp.status = 'scheduled' and pp.scheduled_at <= v_now
    order by pp.scheduled_at, pp.id limit v_limit for update skip locked
  loop
    v_cands := v_cands || jsonb_build_array(jsonb_build_object('ct', 'profile_post', 'cid', x.id, 'sc', x.scheduled_at));
  end loop;

  for x in
    select cm.id, cm.scheduled_at from public.club_media_posts cm
    where cm.status = 'scheduled' and cm.scheduled_at <= v_now
    order by cm.scheduled_at, cm.id limit v_limit for update skip locked
  loop
    v_cands := v_cands || jsonb_build_array(jsonb_build_object('ct', 'club_media', 'cid', x.id, 'sc', x.scheduled_at));
  end loop;

  for x in
    select mp.id, mp.scheduled_at from public.media_profile_posts mp
    where mp.status = 'scheduled' and mp.scheduled_at <= v_now
    order by mp.scheduled_at, mp.id limit v_limit for update skip locked
  loop
    v_cands := v_cands || jsonb_build_array(jsonb_build_object('ct', 'media_profile', 'cid', x.id, 'sc', x.scheduled_at));
  end loop;

  for c in
    select t.ct as c_type, t.cid as c_id
    from jsonb_to_recordset(v_cands) as t(ct text, cid uuid, sc timestamptz)
    order by t.sc, t.cid
    limit v_limit
  loop
    begin
      select * into l from public.footme_content_load(c.c_type, c.c_id, false);
      if not found then
        continue;
      end if;

      v_actor := l.l_scheduled_by;
      v_notify := coalesce(l.l_scheduled_by, l.l_created_by);

      -- Reclamo: scheduled → publishing, un tentativo in più.
      v_ver := public.footme_content_set_state(
        c.c_type, c.c_id, array['scheduled'], 'publishing',
        l.l_scheduled_at, l.l_timezone, l.l_scheduled_by, null, false, true);
      if v_ver is null then
        continue;
      end if;

      v_block := case when v_actor is null then 'capability'
                      else public.footme_content_blocker(c.c_type, c.c_id, v_actor, 'worker') end;

      if v_block is null then
        v_ver := public.footme_content_set_state(
          c.c_type, c.c_id, array['publishing'], 'published',
          l.l_scheduled_at, l.l_timezone, l.l_scheduled_by, null, true, false);
        perform public.footme_content_audit(
          c.c_type, c.c_id, v_notify, l.l_identity_type, l.l_identity_id, 'publish', 'published');
        perform public.footme_notify_scheduled_content(v_notify, c.c_type, c.c_id, true);
      else
        v_ver := public.footme_content_set_state(
          c.c_type, c.c_id, array['publishing'], 'failed',
          l.l_scheduled_at, l.l_timezone, l.l_scheduled_by, v_block, false, false);
        perform public.footme_content_audit(
          c.c_type, c.c_id, v_notify, l.l_identity_type, l.l_identity_id, 'publish_failed', 'failed');
        perform public.footme_notify_scheduled_content(v_notify, c.c_type, c.c_id, false);
      end if;

      v_done := v_done + 1;
    exception when others then
      -- Un errore imprevisto su UNA riga non ferma le altre né la lascia
      -- bloccata: il sotto-blocco è annullato, la riga passa a failed.
      select * into l from public.footme_content_load(c.c_type, c.c_id, false);
      perform public.footme_content_set_state(
        c.c_type, c.c_id, array['scheduled', 'publishing'], 'failed',
        l.l_scheduled_at, l.l_timezone, l.l_scheduled_by, 'internal_error', false, true);
      perform public.footme_notify_scheduled_content(
        coalesce(l.l_scheduled_by, l.l_created_by), c.c_type, c.c_id, false);
      v_done := v_done + 1;
    end;
  end loop;

  return v_done;
end;
$$;

revoke all on function public.run_scheduled_content_sweep(integer) from public;
revoke execute on function public.run_scheduled_content_sweep(integer) from anon, authenticated;

comment on function public.run_scheduled_content_sweep(integer) is
  'HOM-06.2 §184–§190: pubblica i contenuti programmati scaduti, rivalidando chi li ha programmati. Idempotente; nessun execute ai client (pg_cron / service role).';

-- Scheduler (§185), come DAS-REV-31: pg_cron se l'ambiente lo offre. La
-- programmazione è idempotente (unschedule + schedule con lo stesso nome). In un
-- ambiente senza l'estensione (PGlite dei test, sviluppo locale) la migrazione
-- prosegue e lo dichiara: il worker resta invocabile a mano. Sul progetto
-- remoto pg_cron DEVE essere abilitato prima che questa funzione serva a
-- qualcosa: senza, i contenuti programmati restano `scheduled` per sempre.
do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
   begin
    create extension if not exists pg_cron;

    if exists (select 1 from cron.job where jobname = 'scheduled-content-publish') then
      perform cron.unschedule('scheduled-content-publish');
    end if;

    perform cron.schedule(
      'scheduled-content-publish',
      '* * * * *',
      'select public.run_scheduled_content_sweep(50)');
   exception when others then
    raise warning 'HOM-06.2: pg_cron non attivabile (%); pubblicazione programmata non schedulata.', sqlerrm;
   end;
  else
    raise notice 'HOM-06.2: pg_cron non disponibile; pubblicazione programmata non schedulata in questo ambiente. Abilitare pg_cron prima del rilascio.';
  end if;
end;
$do$;


-- ============================================================
-- SEZIONE 16 — riemissioni dalla definizione più recente
--
-- Ogni funzione/vista sotto è ripresa da 20261120090000 (HOM-06.1), verificata
-- sul database dopo tutte le migrazioni, con la sola modifica dichiarata.
-- ============================================================

-- 16-0. footme_normalize_url (§7H): oltre a utm_* si tolgono i parametri di
--       tracciamento noti (fbclid, gclid, dclid, msclkid, mc_cid, mc_eid, igshid,
--       _hsenc, _hsmi, ref_src), MAI quelli funzionali. Specchio di normalizeUrl in
--       supabase/functions/link-preview/url-normalize.ts. Nient'altro cambia.
create or replace function public.footme_normalize_url(p_url text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  m     text[];
  v_q   text;
  v_auth text;
begin
  m := regexp_match(btrim(coalesce(p_url, '')), '^(https?)://([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$', 'i');
  if m is null then
    return null;
  end if;

  v_auth := lower(m[2]);
  if lower(m[1]) = 'https' then
    v_auth := regexp_replace(v_auth, ':443$', '');
  else
    v_auth := regexp_replace(v_auth, ':80$', '');
  end if;

  if m[4] is not null and length(m[4]) > 1 then
    select string_agg(q, '&' order by ord)
    into v_q
    from unnest(string_to_array(substr(m[4], 2), '&')) with ordinality as x(q, ord)
    where q <> ''
      and q !~* '^(utm_[^=]*|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|_hsenc|_hsmi|ref_src)(=|$)';
  end if;

  return lower(m[1]) || '://' || v_auth
         || case when coalesce(m[3], '') = '' then '/' else m[3] end
         || case when v_q is not null then '?' || v_q else '' end;
end;
$$;

revoke all on function public.footme_normalize_url(text) from public;
revoke execute on function public.footme_normalize_url(text) from anon, authenticated;

-- 16a. footme_post_resolve_link: il blocco di idoneità dell'URL è sostituito dalla
--      chiamata a footme_safe_https_url (identica regola). Nient'altro cambia.
create or replace function public.footme_post_resolve_link(
  p_link      jsonb,
  p_has_media boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_url  text;
  v_host text;
  v_sid  uuid;
  v_snap public.link_preview_snapshots;
  v_prev jsonb := null;
begin
  if p_link is null or p_link = 'null'::jsonb then
    return jsonb_build_object('target', null, 'preview', null);
  end if;

  if jsonb_typeof(p_link) <> 'object' or coalesce(jsonb_typeof(p_link -> 'url'), '') <> 'string' then
    raise exception 'post_invalid_link' using errcode = '22023', detail = 'shape';
  end if;

  if coalesce(jsonb_typeof(p_link -> 'snapshot_id'), 'null') <> 'null' then
    begin
      v_sid := (p_link ->> 'snapshot_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'post_invalid_link' using errcode = '22023', detail = 'snapshot_id';
    end;
  end if;

  -- HOM-06.2: l'idoneità (§78) vive in footme_safe_https_url, usata anche dai link
  -- del documento Articolo e dalla fonte. Stessa regola di HOM-06.1: un URL non
  -- idoneo equivale a nessun link, mai a un errore (§89).
  v_url := public.footme_safe_https_url(p_link ->> 'url', false);
  if v_url is null then
    return jsonb_build_object('target', null, 'preview', null);
  end if;

  if v_sid is not null then
    select * into v_snap from public.link_preview_snapshots s where s.id = v_sid;
    if not found
       or not (v_snap.original_url = v_url
               or v_snap.final_url = v_url
               or v_snap.normalized_url = public.footme_normalize_url(v_url)) then
      raise exception 'post_invalid_link' using errcode = '22023', detail = 'snapshot';
    end if;

    if not p_has_media then
      v_prev := jsonb_strip_nulls(jsonb_build_object(
        'url',           v_snap.final_url,
        'original_url',  v_snap.original_url,
        'title',         v_snap.title,
        'description',   v_snap.description,
        'domain',        v_snap.domain,
        'thumbnail_url', v_snap.image_url,
        'favicon_url',   v_snap.favicon_url,
        'site_name',     v_snap.site_name,
        'snapshot_id',   v_snap.id));
    end if;
  end if;

  return jsonb_build_object(
    'target',  jsonb_strip_nulls(jsonb_build_object('url', v_url, 'snapshot_id', v_sid)),
    'preview', v_prev);
end;
$$;

revoke all on function public.footme_post_resolve_link(jsonb, boolean) from public;
revoke execute on function public.footme_post_resolve_link(jsonb, boolean) from anon, authenticated;

-- 16b. publish_post: il blocco media (ex §7, ~100 righe) è sostituito dalla chiamata a
--      footme_post_normalize_media. Comportamento invariato (verificato con la suite
--      PGlite di HOM-06.1).
create or replace function public.publish_post(
  p_operation_key text,
  p_identity_type text,
  p_identity_id   uuid,
  p_body          text,
  p_mentions      jsonb,
  p_tagged        jsonb,
  p_media         jsonb,
  p_link          jsonb,
  p_origin        text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_limits    jsonb := public.footme_post_limits();
  v_receipt   public.post_publish_receipts;
  v_body      text := coalesce(p_body, '');
  v_mentions  jsonb;
  v_tags      jsonb;
  v_link      jsonb;
  v_card      jsonb;
  v_clean     jsonb := '[]'::jsonb;
  v_item      jsonb;
  v_ord       integer;
  v_path      text;
  v_thumb     text;
  v_mtype     text;
  v_mime      text;
  v_url       text;
  v_turl      text;
  v_w         integer;
  v_h         integer;
  v_dur       integer;
  v_alt       text;
  v_prefix    text := coalesce(v_uid::text, '') || '/posts/';
  v_state     text;
  v_ctype     text;
  v_post_id   uuid;
  v_target    jsonb;
  v_preview   jsonb;
  v_t         jsonb;
  v_hash      text;
  v_status    text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_operation_key is null or length(btrim(p_operation_key)) < 8 or length(p_operation_key) > 120 then
    raise exception 'post_invalid_content' using errcode = '22023', detail = 'operation_key';
  end if;

  -- Una sola esecuzione per (attore, chiave) alla volta: il secondo tap aspetta
  -- il primo e legge la sua ricevuta (§118, §176).
  perform pg_advisory_xact_lock(hashtext('post_publish:' || v_uid::text || ':' || p_operation_key));

  select * into v_receipt
  from public.post_publish_receipts r
  where r.actor_id = v_uid and r.operation_key = p_operation_key;

  -- Impronta degli argomenti come arrivano (jsonb ha un testo canonico: ordine
  -- delle chiavi fisso). L'origin non entra: è navigazione, non contenuto.
  v_hash := md5(jsonb_build_object(
    'identity_type', p_identity_type,
    'identity_id',   p_identity_id,
    'body',          coalesce(p_body, ''),
    'mentions',      coalesce(p_mentions, 'null'::jsonb),
    'tagged',        coalesce(p_tagged, 'null'::jsonb),
    'media',         coalesce(p_media, 'null'::jsonb),
    'link',          coalesce(p_link, 'null'::jsonb))::text);

  if found then
    -- Stessa chiave, altro contenuto: non è un retry. Il client ruota la chiave.
    if v_receipt.payload_hash <> v_hash then
      raise exception 'post_operation_conflict' using errcode = '40001', detail = 'payload';
    end if;

    -- Un replay restituisce un Post che esiste ancora, pubblicato. Eliminato o
    -- non più pubblicato: non si presenta come successo (il client creerebbe un
    -- link a un contenuto che non c'è).
    select r.r_status into v_status
    from public.footme_content_rights(v_receipt.content_type, v_receipt.content_id) r;
    if v_status is distinct from 'published' then
      raise exception 'post_operation_conflict' using errcode = '40001', detail = 'gone';
    end if;

    return jsonb_build_object(
      'content_type', v_receipt.content_type,
      'content_id',   v_receipt.content_id,
      'replayed',     true);
  end if;

  -- §30: utente, identità, capability e stato dell'identità si rivalidano qui,
  -- sempre, qualunque cosa il client abbia visto nel contesto.
  if p_identity_type is null or p_identity_id is null
     or not exists (
       select 1 from public.footme_composer_identities() i
       where i.c_type = p_identity_type and i.c_id = p_identity_id) then
    raise exception 'post_permission_denied' using errcode = '42501';
  end if;

  v_card := public.footme_composer_identity_card(p_identity_type, p_identity_id);
  if v_card is null then
    raise exception 'post_permission_denied' using errcode = '42501';
  end if;

  if p_origin is null or p_origin not in (
       'HOME_PER_TE', 'HOME_SEGUITI', 'PERSONAL_PROFILE', 'SOCIETY_PROFILE',
       'MEDIA_PROFILE', 'CONTENT_DETAIL') then
    raise exception 'post_invalid_content' using errcode = '22023', detail = 'origin';
  end if;

  if char_length(v_body) > (v_limits ->> 'max_body_length')::int then
    raise exception 'post_invalid_content' using errcode = '22023', detail = 'body_length';
  end if;

  -- ── media (§42–§44, §61, §207) ────────────────────────────────
  -- HOM-06.2: la validazione dei media è footme_post_normalize_media (estratta
  -- da qui, stesse regole e stessi errori): la usano anche bozze e programmati.
  v_clean := public.footme_post_normalize_media(p_media, v_limits, v_prefix, array[]::text[]);

  v_state := coalesce(
    (select s.value #>> '{}' from public.app_policy_settings s
     where s.key = 'post_composer.video_initial_state'), 'ready');
  if v_state not in ('ready', 'uploaded', 'processing') then
    v_state := 'ready';
  end if;

  -- ── mention, tag, link ────────────────────────────────────────
  v_mentions := public.footme_post_normalize_mentions(
    v_body, p_mentions, (v_limits ->> 'max_mentions')::int);
  v_tags := public.footme_post_normalize_tags(p_tagged, (v_limits ->> 'max_tags')::int);
  v_link := public.footme_post_resolve_link(p_link, jsonb_array_length(v_clean) > 0);
  v_target := v_link -> 'target';
  v_preview := v_link -> 'preview';

  -- §12–§13: testo significativo (senza le mention), un media o un URL valido.
  -- Tag e mention da soli non bastano; un video dal path valido sì.
  if not (
       public.footme_post_text_is_meaningful(v_body, v_mentions)
       or jsonb_array_length(v_clean) > 0
       or jsonb_typeof(v_target) = 'object') then
    raise exception 'post_invalid_content' using errcode = '22023', detail = 'empty';
  end if;

  -- ── scrittura ─────────────────────────────────────────────────
  if p_identity_type = 'person' then
    v_ctype := 'profile_post';
    insert into public.profile_posts (profile_id, body)
    values (v_uid, v_body)
    returning id into v_post_id;

  elsif p_identity_type = 'society' then
    v_ctype := 'club_media';
    insert into public.club_media_posts (club_id, created_by_profile_id, kind, title, body)
    values (p_identity_id, v_uid, 'post', '', nullif(v_body, ''))
    returning id into v_post_id;

  else
    v_ctype := 'media_profile';
    insert into public.media_profile_posts
      (media_profile_id, created_by_profile_id, kind, category, title, author_name, body)
    values
      (p_identity_id, v_uid, 'post', '', '', v_card ->> 'name', nullif(v_body, ''))
    returning id into v_post_id;
  end if;

  for v_item in select e from jsonb_array_elements(v_clean) e loop
    insert into public.content_post_media
      (content_type, post_id, position, media_type, url, thumbnail_url,
       width, height, duration_seconds, alt_text, processing_state)
    values
      (v_ctype, v_post_id, (v_item ->> 'position')::smallint, v_item ->> 'media_type',
       v_item ->> 'url', v_item ->> 'thumbnail_url',
       (v_item ->> 'width')::integer, (v_item ->> 'height')::integer,
       (v_item ->> 'duration_seconds')::integer, v_item ->> 'alt_text',
       case when v_item ->> 'media_type' = 'video' then v_state else 'ready' end);
  end loop;

  if jsonb_array_length(v_mentions) > 0 or jsonb_typeof(v_target) = 'object' then
    insert into public.content_post_extras (content_type, post_id, mentions, link_preview, link_target)
    values (v_ctype, v_post_id, v_mentions,
            case when jsonb_typeof(v_preview) = 'object' then v_preview end,
            case when jsonb_typeof(v_target) = 'object' then v_target end);
  end if;

  for v_t in select e from jsonb_array_elements(v_tags) e loop
    if v_ctype = 'profile_post' then
      insert into public.profile_post_tagged_targets (post_id, target_type, target_id)
      values (v_post_id, v_t ->> 'target_type', (v_t ->> 'target_id')::uuid);
    elsif v_ctype = 'club_media' then
      insert into public.club_media_tagged_profiles (post_id, target_type, target_id, profile_id)
      values (v_post_id, v_t ->> 'target_type', (v_t ->> 'target_id')::uuid,
              case when v_t ->> 'target_type' = 'profile' then (v_t ->> 'target_id')::uuid end);
    else
      insert into public.media_profile_post_tagged_targets (post_id, target_type, target_id)
      values (v_post_id, v_t ->> 'target_type', (v_t ->> 'target_id')::uuid);
    end if;
  end loop;

  insert into public.post_publish_receipts
    (actor_id, operation_key, content_type, content_id, identity_type, identity_id, origin, payload_hash)
  values
    (v_uid, p_operation_key, v_ctype, v_post_id, p_identity_type, p_identity_id, p_origin, v_hash);

  insert into public.content_management_audit
    (content_type, post_id, actor_user_id, acting_identity_type, acting_identity_id, action, result)
  values
    (v_ctype, v_post_id, v_uid, p_identity_type, p_identity_id, 'create', 'created');

  return jsonb_build_object(
    'content_type', v_ctype,
    'content_id',   v_post_id,
    'replayed',     false);
end;
$$;

revoke all on function public.publish_post(text, text, uuid, text, jsonb, jsonb, jsonb, jsonb, text) from public;
revoke execute on function public.publish_post(text, text, uuid, text, jsonb, jsonb, jsonb, jsonb, text) from anon;
grant execute on function public.publish_post(text, text, uuid, text, jsonb, jsonb, jsonb, jsonb, text) to authenticated;

-- 16c. feed_content_index: un club_media kind 'article' è SEMPRE un Articolo, anche con
--      il corpo breve (decisione 2: la classificazione non dipende dalla lunghezza).
--      Una riga in più nel CASE di classificazione; colonne e ordine invariati.
create or replace view public.feed_content_index as

  -- ── club_media_posts (contenuto ufficiale di una società) ──────
  select
    'club_media'::text                                      as content_type,
    cmp.id                                                  as post_id,
    case
      when cmp.kind = 'post'                                    then 'post'
      when cmp.kind = 'article'                                 then 'articolo'
      when cmp.visual_type = 'video'                            then 'video'
      when cmp.visual_type = 'image' and cmp.body is null       then 'foto'
      when length(coalesce(cmp.body, '')) >= 400                then 'articolo'
      else 'post'
    end                                                     as content_format,
    cmp.kind                                                as kind,
    cmp.title                                               as title,
    coalesce(cmp.excerpt, cmp.body)                         as excerpt,
    case when cmp.kind = 'post'
         then coalesce(pm.thumbnail_url, pm.url)
         else coalesce(cmp.thumbnail_url, cmp.visual_url) end   as thumbnail_url,
    case when cmp.kind = 'post' then pm.media_type
         else cmp.visual_type end                           as media_type,
    case when cmp.kind = 'post' then pm.duration_seconds
         else cmp.video_duration_seconds end                as duration_seconds,
    'club'::text                                            as publisher_type,
    cmp.club_id                                             as publisher_id,
    c.name                                                  as publisher_name,
    c.logo_url                                              as publisher_avatar_url,
    'ufficiale'::text                                       as source_kind,
    cmp.interviewee_name                                    as author_name,
    cmp.published_at                                        as published_at,
    c.region                                                as publisher_region,
    (c.verification_status = 'verified')                    as publisher_is_verified,
    coalesce(cmp.body, cmp.excerpt)                         as body
  from public.club_media_posts cmp
  join public.clubs c on c.id = cmp.club_id
  -- HOM-06.1: per il kind 'post' il media di copertina è la posizione 0 di
  -- content_post_media (le colonne visual legacy restano null).
  left join lateral (
    select cpm.thumbnail_url, cpm.url, cpm.media_type, cpm.duration_seconds
    from public.content_post_media cpm
    where cpm.content_type = 'club_media' and cpm.post_id = cmp.id and cmp.kind = 'post'
    order by cpm.position
    limit 1
  ) pm on true
  where cmp.status = 'published'
    and cmp.published_at is not null

  union all

  -- ── media_profile_posts (contenuto editoriale) ──────────────────
  select
    'media_profile'::text,
    mpp.id,
    (case
      when mpp.kind = 'post'                             then 'post'
      when mpp.kind = 'media' and mpp.cover_type = 'video' then 'video'
      when mpp.kind = 'media'                            then 'foto'
      else 'articolo'
    end)::text,
    mpp.kind,
    mpp.title,
    coalesce(mpp.excerpt, mpp.subtitle),
    case when mpp.kind = 'post' then coalesce(pm.thumbnail_url, pm.url) else mpp.cover_url end,
    case when mpp.kind = 'post' then pm.media_type else mpp.cover_type end,
    case when mpp.kind = 'post' then pm.duration_seconds else null::int end,
    'profile'::text,
    mpp.media_profile_id,
    coalesce(mp.entity_name, p.full_name),
    coalesce(mp.logo_url, p.avatar_url),
    coalesce(mp.media_kind, 'pagina'),
    mpp.author_name,
    mpp.published_at,
    p.region,
    (mp.verification_status = 'verified'),
    coalesce(mpp.body, mpp.excerpt, mpp.subtitle)
  from public.media_profile_posts mpp
  join public.media_profiles mp on mp.profile_id = mpp.media_profile_id
  join public.profiles p        on p.id = mpp.media_profile_id
  left join lateral (
    select cpm.thumbnail_url, cpm.url, cpm.media_type, cpm.duration_seconds
    from public.content_post_media cpm
    where cpm.content_type = 'media_profile' and cpm.post_id = mpp.id and mpp.kind = 'post'
    order by cpm.position
    limit 1
  ) pm on true
  where mpp.status = 'published'
    and mpp.published_at is not null

  union all

  -- ── media_tribuna_posts (dibattiti / sondaggi editoriali) ───────
  -- `excerpt` è il body intero: vedi delta 3 nell'header.
  select
    'media_tribuna'::text,
    mtp.id,
    'post'::text,
    mtp.kind,
    mtp.title,
    mtp.body,
    null::text,
    null::text,
    null::int,
    'profile'::text,
    mtp.media_profile_id,
    coalesce(mp.entity_name, p.full_name),
    coalesce(mp.logo_url, p.avatar_url),
    coalesce(mp.media_kind, 'pagina'),
    null::text,
    mtp.published_at,
    p.region,
    (mp.verification_status = 'verified'),
    mtp.body
  from public.media_tribuna_posts mtp
  join public.media_profiles mp on mp.profile_id = mtp.media_profile_id
  join public.profiles p        on p.id = mtp.media_profile_id
  where mtp.status = 'published'
    and mtp.published_at is not null

  union all

  -- ── fan_tribuna_posts (contenuto tifoso: opinioni, foto, sondaggi) ──
  select
    'fan_tribuna'::text,
    ftp.id,
    case
      when ftp.kind = 'photo' and ftp.media_type = 'video' then 'video'
      when ftp.kind = 'photo'                              then 'foto'
      else 'post'
    end,
    ftp.kind,
    ftp.title,
    ftp.body,
    coalesce(ftp.thumbnail_url, ftp.media_url),
    ftp.media_type,
    null::int,
    'profile'::text,
    ftp.profile_id,
    p.full_name,
    p.avatar_url,
    'tifoso'::text,
    null::text,
    ftp.published_at,
    p.region,
    false,
    ftp.body
  from public.fan_tribuna_posts ftp
  join public.profiles p on p.id = ftp.profile_id
  where ftp.status = 'published'
    and ftp.published_at is not null

  union all

  -- ── fan_media_posts (bacheca tifoso: foto e video) ──────────────
  -- title/excerpt invertiti rispetto a media_content_index: vedi delta 2.
  select
    'fan_media'::text,
    fmp.id,
    case when fmp.visual_type = 'video' then 'video' else 'foto' end,
    fmp.tag,
    null::text,
    fmp.description,
    coalesce(fmp.thumbnail_url, fmp.visual_url),
    fmp.visual_type,
    null::int,
    'profile'::text,
    fmp.profile_id,
    p.full_name,
    p.avatar_url,
    'tifoso'::text,
    null::text,
    fmp.published_at,
    p.region,
    false,
    fmp.description
  from public.fan_media_posts fmp
  join public.profiles p on p.id = fmp.profile_id
  where fmp.status = 'published'
    and fmp.published_at is not null

  union all

  -- ── profile_posts (post delle persone: HOM-02) ──────────────────
  -- `kind` e `title` assenti: il Post persona è testo + media, senza
  -- tipologia editoriale. Thumbnail, tipo e durata vengono dalla prima riga
  -- di content_post_media (posizione 0). source_kind 'persona' non coincide
  -- con nessun valore che il Feed usa per le preferenze (testata, giornalista,
  -- creator, pagina). Nessuna verifica esiste per le persone: false.
  select
    'profile_post'::text,
    pp.id,
    'post'::text,
    null::text,
    null::text,
    nullif(pp.body, ''),
    coalesce(m.thumbnail_url, m.url),
    m.media_type,
    m.duration_seconds,
    'profile'::text,
    pp.profile_id,
    p.full_name,
    p.avatar_url,
    'persona'::text,
    null::text,
    pp.published_at,
    p.region,
    false,
    pp.body
  from public.profile_posts pp
  join public.profiles p on p.id = pp.profile_id
  left join lateral (
    select cpm.thumbnail_url, cpm.url, cpm.media_type, cpm.duration_seconds
    from public.content_post_media cpm
    where cpm.content_type = 'profile_post' and cpm.post_id = pp.id
    order by cpm.position
    limit 1
  ) m on true
  where pp.status = 'published'
    and pp.published_at <= timezone('utc', now());

revoke all on table public.feed_content_index from anon, authenticated;

-- 16d. media_content_index (ricerca): stessa correzione di 16c.
create or replace view public.media_content_index as
with base as (

  -- ── club_media_posts (contenuto ufficiale di una società) ───────
  select
    'club_media'::text                                      as content_type,
    cmp.id                                                  as post_id,
    case
      when cmp.kind = 'post'                                    then 'post'
      when cmp.kind = 'article'                                 then 'articolo'
      when cmp.visual_type = 'video'                            then 'video'
      when cmp.visual_type = 'image' and cmp.body is null       then 'foto'
      when length(coalesce(cmp.body, '')) >= 400                then 'articolo'
      else 'post'
    end                                                     as content_format,
    cmp.kind                                                as kind,
    cmp.title                                               as title,
    case when cmp.kind = 'post' then left(cmp.body, 280)
         else cmp.excerpt end                               as excerpt,
    cmp.body                                                as body,
    case when cmp.kind = 'post'
         then coalesce(pm.thumbnail_url, pm.url)
         else coalesce(cmp.thumbnail_url, cmp.visual_url) end   as thumbnail_url,
    case when cmp.kind = 'post' then pm.media_type
         else cmp.visual_type end                           as media_type,
    case when cmp.kind = 'post' then pm.duration_seconds
         else cmp.video_duration_seconds end                as duration_seconds,
    'club'::text                                            as publisher_type,
    cmp.club_id                                             as publisher_id,
    c.name                                                  as publisher_name,
    c.logo_url                                              as publisher_avatar_url,
    'ufficiale'::text                                       as source_kind,
    cmp.interviewee_name                                    as author_name,
    cmp.published_at                                        as published_at,
    array[c.category]                                       as own_categories,
    array[c.region]                                         as own_regions,
    array[c.province]                                       as own_provinces,
    array[c.city]                                           as own_cities,
    array[
      public.footme_content_kind_label('club_media', cmp.kind),
      cmp.player_name,
      cmp.player_previous_club
    ]                                                       as own_topics
  from public.club_media_posts cmp
  join public.clubs c on c.id = cmp.club_id
  -- HOM-06.1: per il kind 'post' il media di copertina è la posizione 0 di
  -- content_post_media (le colonne visual legacy restano null).
  left join lateral (
    select cpm.thumbnail_url, cpm.url, cpm.media_type, cpm.duration_seconds
    from public.content_post_media cpm
    where cpm.content_type = 'club_media' and cpm.post_id = cmp.id and cmp.kind = 'post'
    order by cpm.position
    limit 1
  ) pm on true
  where cmp.status = 'published'

  union all

  -- ── media_profile_posts (contenuto editoriale) ──────────────────
  select
    'media_profile'::text,
    mpp.id,
    (case
      when mpp.kind = 'post'                             then 'post'
      when mpp.kind = 'media' and mpp.cover_type = 'video' then 'video'
      when mpp.kind = 'media'                            then 'foto'
      else 'articolo'
    end)::text,
    mpp.kind,
    mpp.title,
    coalesce(mpp.excerpt, mpp.subtitle, case when mpp.kind = 'post' then left(mpp.body, 280) end),
    mpp.body,
    case when mpp.kind = 'post' then coalesce(pm.thumbnail_url, pm.url) else mpp.cover_url end,
    case when mpp.kind = 'post' then pm.media_type else mpp.cover_type end,
    case when mpp.kind = 'post' then pm.duration_seconds else null::int end,
    'profile'::text,
    mpp.media_profile_id,
    coalesce(mp.entity_name, p.full_name),
    coalesce(mp.logo_url, p.avatar_url),
    coalesce(mp.media_kind, 'pagina'),
    mpp.author_name,
    mpp.published_at,
    public.footme_text_array_clean(array[mpp.category] || mp.covered_competitions),
    public.footme_text_array_clean(array[p.region] || mp.covered_territories),
    array[]::text[],
    array[p.city],
    public.footme_text_array_clean(
      array[public.footme_content_kind_label('media_profile', mpp.kind), mpp.source_name]
      || mp.covered_topics
      || mp.covered_teams
    )
  from public.media_profile_posts mpp
  join public.media_profiles mp on mp.profile_id = mpp.media_profile_id
  join public.profiles p        on p.id = mpp.media_profile_id
  left join lateral (
    select cpm.thumbnail_url, cpm.url, cpm.media_type, cpm.duration_seconds
    from public.content_post_media cpm
    where cpm.content_type = 'media_profile' and cpm.post_id = mpp.id and mpp.kind = 'post'
    order by cpm.position
    limit 1
  ) pm on true
  where mpp.status = 'published'

  union all

  -- ── media_tribuna_posts (dibattiti/sondaggi editoriali) ─────────
  select
    'media_tribuna'::text,
    mtp.id,
    'post'::text,
    mtp.kind,
    mtp.title,
    mtp.body,
    mtp.body,
    null::text,
    null::text,
    null::int,
    'profile'::text,
    mtp.media_profile_id,
    coalesce(mp.entity_name, p.full_name),
    coalesce(mp.logo_url, p.avatar_url),
    coalesce(mp.media_kind, 'pagina'),
    null::text,
    mtp.published_at,
    public.footme_text_array_clean(mp.covered_competitions),
    public.footme_text_array_clean(array[p.region] || mp.covered_territories),
    array[]::text[],
    array[p.city],
    public.footme_text_array_clean(
      array[public.footme_content_kind_label('media_tribuna', mtp.kind)]
      || mp.covered_topics
      || mp.covered_teams
    )
  from public.media_tribuna_posts mtp
  join public.media_profiles mp on mp.profile_id = mtp.media_profile_id
  join public.profiles p        on p.id = mtp.media_profile_id
  where mtp.status = 'published'

  union all

  -- ── fan_tribuna_posts (contenuto tifoso: opinioni, foto, sondaggi) ──
  select
    'fan_tribuna'::text,
    ftp.id,
    case
      when ftp.kind = 'photo' and ftp.media_type = 'video' then 'video'
      when ftp.kind = 'photo'                              then 'foto'
      else 'post'
    end,
    ftp.kind,
    ftp.title,
    ftp.body,
    ftp.body,
    coalesce(ftp.thumbnail_url, ftp.media_url),
    ftp.media_type,
    null::int,
    'profile'::text,
    ftp.profile_id,
    p.full_name,
    p.avatar_url,
    'tifoso'::text,
    null::text,
    ftp.published_at,
    array[ftp.reference_category, rc.category],
    array[p.region, rc.region],
    array[rc.province],
    array[p.city, rc.city],
    array[
      public.footme_content_kind_label('fan_tribuna', ftp.kind),
      ftp.reference_team_name,
      rc.name
    ]
  from public.fan_tribuna_posts ftp
  join public.profiles p     on p.id = ftp.profile_id
  left join public.clubs rc  on rc.id = ftp.reference_club_id
  where ftp.status = 'published'

  union all

  -- ── fan_media_posts (bacheca tifoso: foto e video) ──────────────
  -- Nessun `title` in tabella: l'anteprima usa `description`, già vincolata
  -- a 280 caratteri, troncata a due righe lato client.
  select
    'fan_media'::text,
    fmp.id,
    case when fmp.visual_type = 'video' then 'video' else 'foto' end,
    fmp.tag,
    fmp.description,
    null::text,
    null::text,
    coalesce(fmp.thumbnail_url, fmp.visual_url),
    fmp.visual_type,
    null::int,
    'profile'::text,
    fmp.profile_id,
    p.full_name,
    p.avatar_url,
    'tifoso'::text,
    null::text,
    fmp.published_at,
    array[fmp.tag],
    array[p.region],
    array[]::text[],
    array[p.city],
    array[fmp.tag]
  from public.fan_media_posts fmp
  join public.profiles p on p.id = fmp.profile_id
  where fmp.status = 'published'

)
select
  b.content_type,
  b.post_id,
  b.content_format,
  b.kind,
  b.title,
  b.excerpt,
  b.thumbnail_url,
  b.media_type,
  b.duration_seconds,
  b.publisher_type,
  b.publisher_id,
  b.publisher_name,
  b.publisher_avatar_url,
  b.source_kind,
  b.author_name,
  b.published_at,
  coalesce(eng.engagement_count, 0)                     as engagement_count,
  coalesce(tag.tagged_club_ids, '{}'::uuid[])           as tagged_club_ids,
  coalesce(tag.tagged_team_ids, '{}'::uuid[])           as tagged_team_ids,
  coalesce(tag.tagged_profile_ids, '{}'::uuid[])        as tagged_profile_ids,
  public.footme_text_array_clean(
    b.own_categories || coalesce(tag.tag_categories, '{}'::text[])
  )                                                     as categories,
  public.footme_text_array_clean(
    b.own_regions || coalesce(tag.tag_regions, '{}'::text[])
  )                                                     as regions,
  public.footme_text_array_clean(
    b.own_provinces || coalesce(tag.tag_provinces, '{}'::text[])
  )                                                     as provinces,
  public.footme_text_array_clean(
    b.own_cities || coalesce(tag.tag_cities, '{}'::text[])
  )                                                     as cities,
  public.footme_text_array_clean(b.own_topics)          as topics,
  public.footme_normalize_lookup(b.title)               as title_norm,
  public.footme_normalize_lookup(b.publisher_name)      as publisher_norm,
  public.footme_normalize_lookup(
    array_to_string(coalesce(tag.tagged_names, '{}'::text[]), ' ')
  )                                                     as tagged_norm,
  public.footme_normalize_lookup(
    array_to_string(
      public.footme_text_array_clean(
        b.own_categories || coalesce(tag.tag_categories, '{}'::text[])
      ),
      ' '
    )
  )                                                     as categories_norm,
  public.footme_normalize_lookup(
    array_to_string(
      public.footme_text_array_clean(
        b.own_regions || coalesce(tag.tag_regions, '{}'::text[])
        || b.own_provinces || coalesce(tag.tag_provinces, '{}'::text[])
        || b.own_cities || coalesce(tag.tag_cities, '{}'::text[])
      ),
      ' '
    )
  )                                                     as territory_norm,
  -- Blob unico su cui gira il matching a token. Include titolo, testo,
  -- fonte, autore, nomi delle entità taggate, categorie, territori e
  -- argomenti: è ciò che permette a "AC Como" di trovare un contenuto in cui
  -- la società è taggata ma non citata nel titolo (CER-05 §5).
  public.footme_normalize_lookup(
    concat_ws(' ',
      b.title,
      b.excerpt,
      left(coalesce(b.body, ''), 2000),
      b.publisher_name,
      b.author_name,
      array_to_string(coalesce(tag.tagged_names, '{}'::text[]), ' '),
      array_to_string(
        public.footme_text_array_clean(
          b.own_categories || coalesce(tag.tag_categories, '{}'::text[])
          || b.own_regions || coalesce(tag.tag_regions, '{}'::text[])
          || b.own_provinces || coalesce(tag.tag_provinces, '{}'::text[])
          || b.own_cities || coalesce(tag.tag_cities, '{}'::text[])
          || b.own_topics
        ),
        ' '
      )
    )
  )                                                     as search_blob
from base b
left join public.media_content_tag_agg tag
  on tag.content_type = b.content_type and tag.post_id = b.post_id
left join public.media_content_engagement eng
  on eng.content_type = b.content_type and eng.post_id = b.post_id;

revoke all on table public.media_content_index from anon, authenticated;

-- 16e. fetch_dashboard_society_overview: drafts_count e drafts_preview contavano ogni
--      club_media 'draft' a chi ha content_view. Ora le bozze di Post e Articolo di una
--      Società entrano solo se il chiamante può accedervi (§230, §273); i kind legacy
--      restano come prima. scheduled_count resta null (contratto invariato).
create or replace function public.fetch_dashboard_society_overview(p_club_id uuid)
returns table (
  -- ── Riepilogo e conteggi ────────────────────────────────────────────
  positions_open_count          integer,
  applications_count            integer,
  teams_count                   integer,
  drafts_count                  integer,
  scheduled_count               integer,

  -- ── Inviti e richieste (§14) ────────────────────────────────────────
  invites_incoming_count        integer,
  invites_pending_count         integer,

  -- ── Conteggio canonico "da gestire" (§10) ───────────────────────────
  applications_to_handle_count  integer,

  -- ── Segnali operativi normalizzati ──────────────────────────────────
  priority_signals              jsonb,
  priority_total_count          integer,

  -- ── Preview ─────────────────────────────────────────────────────────
  applications_preview          jsonb,
  teams_preview                 jsonb,
  drafts_preview                jsonb,
  recent_content_preview        jsonb,

  -- ── Metadata di cache e accesso ─────────────────────────────────────
  access_verified_at            timestamptz,
  data_revision                 bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid   := auth.uid();
  v_caps    text[];
  -- Un perimetro **per capability** (§19). Le coppie `_all` esistono perché
  -- «scope null = illimitato» è la regola più facile da invertire per
  -- sbaglio: scritta una volta, riusata in ogni predicato.
  v_pos_scope  uuid[];
  v_pos_all    boolean;
  v_app_scope  uuid[];
  v_app_all    boolean;
  v_team_scope uuid[];
  v_team_all   boolean;
  v_inv_scope  uuid[];
  v_inv_all    boolean;
  v_req_scope  uuid[];
  v_req_all    boolean;
  -- I contenuti non hanno squadra: `club_media_posts` appartiene alla
  -- Società. Le metriche editoriali esistono quindi solo per chi ha
  -- `content_view` senza restrizione di squadra.
  v_content_all boolean;
  v_now     timestamptz := timezone('utc', now());
  v_signals jsonb  := '[]'::jsonb;
  v_total   integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  v_pos_scope  := public.dashboard_club_capability_scope(p_club_id, 'positions_view');
  v_pos_all    := v_pos_scope is null;
  v_app_scope  := public.dashboard_club_capability_scope(p_club_id, 'applications_view');
  v_app_all    := v_app_scope is null;
  v_team_scope := public.dashboard_club_capability_scope(p_club_id, 'teams_view');
  v_team_all   := v_team_scope is null;
  v_inv_scope  := public.dashboard_club_capability_scope(p_club_id, 'invites_view');
  v_inv_all    := v_inv_scope is null;
  v_req_scope  := public.dashboard_club_capability_scope(p_club_id, 'member_requests_view');
  v_req_all    := v_req_scope is null;
  v_content_all := public.dashboard_club_capability_scope(p_club_id, 'content_view') is null;

  if not ('dashboard_view' = any (v_caps)) then
    return query select
      null::integer, null::integer, null::integer, null::integer, null::integer,
      null::integer, null::integer,
      null::integer,
      null::jsonb, null::integer,
      null::jsonb, null::jsonb, null::jsonb, null::jsonb,
      null::timestamptz, null::bigint;
    return;
  end if;

  -- ── Segnali `new_applications` ────────────────────────────────────────
  if 'applications_view' = any (v_caps) then
    select coalesce(jsonb_agg(signal order by signal->>'occurred_at' desc), '[]'::jsonb)
      into v_signals
    from (
      select jsonb_build_object(
        'type_id',         'new_applications',
        'aggregation_key', 'new_applications:' || p_club_id::text || ':' || ra.id::text,
        'target_kind',     'position',
        'target_id',       ra.id,
        'count',           count(app.id)::integer,
        'role',            ra.role_required::text,
        'team_name',       ct.name,
        'deadline_at',     ra.deadline,
        'occurred_at',     max(app.latest_submitted_at)
      ) as signal
      from public.recruiting_ads ra
      join public.recruiting_applications app
        on app.ad_id = ra.id
       and public.society_application_is_new(
             app.id, app.submission_revision, app.status, ra.status, v_uid
           )
      left join public.club_teams ct on ct.id = ra.team_id
      where ra.club_id = p_club_id
        and ra.status = 'published'
        and (v_app_all or ra.team_id = any (v_app_scope))
      group by ra.id, ra.role_required, ra.deadline, ct.name
      order by max(app.latest_submitted_at) desc
      limit 10
    ) signals;

    select count(*)::integer into v_total
    from (
      select ra.id
      from public.recruiting_ads ra
      join public.recruiting_applications app
        on app.ad_id = ra.id
       and public.society_application_is_new(
             app.id, app.submission_revision, app.status, ra.status, v_uid
           )
      where ra.club_id = p_club_id
        and ra.status = 'published'
        and (v_app_all or ra.team_id = any (v_app_scope))
      group by ra.id
    ) totals;
  end if;

  return query
  select
    case when 'positions_view' = any (v_caps) then (
      select count(*)::integer
      from public.recruiting_ads ra
      where ra.club_id = p_club_id
        and ra.status = 'published'
        and (v_pos_all or ra.team_id = any (v_pos_scope))
    ) end as positions_open_count,

    case when 'applications_view' = any (v_caps) then (
      select count(*)::integer
      from public.recruiting_applications app
      join public.recruiting_ads ra on ra.id = app.ad_id
      where ra.club_id = p_club_id
        and app.status <> 'withdrawn'
        and (v_app_all or ra.team_id = any (v_app_scope))
    ) end as applications_count,

    -- §15: archiviate escluse. Le affiliate non compaiono perché la fonte è
    -- `club_teams`, non `club_affiliations`: una Società collegata non è una
    -- squadra di questa Società.
    case when 'teams_view' = any (v_caps) then (
      select count(*)::integer
      from public.club_teams ct
      where ct.club_id = p_club_id
        and not ct.is_archived
        and (v_team_all or ct.id = any (v_team_scope))
    ) end as teams_count,

    case when 'content_view' = any (v_caps) and v_content_all then (
      select count(*)::integer
      from public.club_media_posts cmp
      where cmp.club_id = p_club_id
        and cmp.status = 'draft'
        -- HOM-06.2 §230: la bozza di un Post o di un Articolo si vede e si conta solo se
        -- il chiamante ha l'accesso di quella bozza (Articolo: content_article_publish).
        and (cmp.kind not in ('post', 'article')
             or public.footme_content_draft_access('club_media', cmp.id, v_uid))
    ) end as drafts_count,

    -- Contratto predisposto, dominio non ancora capace di programmare:
    -- `club_media_posts.status` ammette draft/published/archived.
    null::integer as scheduled_count,

    /* DAS-REV-19 §15: le richieste in ingresso **esistono** — sono il
       modello canonico delle richieste avviate dalla persona, che il Centro
       legge nella seconda tab. Finché nessuno le leggeva, DAS-REV-07 §14
       imponeva `null` invece di uno zero inventato; ora il numero è reale,
       e resta `null` per chi non ha la chiave di lettura. */
    case when 'member_requests_view' = any (v_caps) then (
      select count(*)::integer
      from public.club_members cm
      where cm.club_id = p_club_id
        and cm.status = 'pending'
        and cm.added_by = 'self_request'
        and cm.profile_id is not null
        and (v_req_all or (cm.team_id is not null and cm.team_id = any (v_req_scope)))
    ) end as invites_incoming_count,

    case when 'invites_view' = any (v_caps) then (
      /* DAS-REV-19 §35: il pending canonico è ora l'Invitation, non una riga
         di organico in stato `pending`. Le proposte storiche sono state
         rispecchiate, quindi il numero non cambia per i dati esistenti e
         comincia a contare quelle nuove, che `club_members` non ha mai. */
      select count(*)::integer
      from public.club_member_invites inv
      where inv.club_id = p_club_id
        and inv.status = 'pending'
        and (
          v_inv_all
          or (inv.scope_type = 'team' and inv.team_id = any (v_inv_scope))
        )
    ) end as invites_pending_count,

    case when 'applications_view' = any (v_caps) then (
      select count(*)::integer
      from public.recruiting_applications app
      join public.recruiting_ads ra on ra.id = app.ad_id
      where ra.club_id = p_club_id
        and public.society_application_is_new(
          app.id, app.submission_revision, app.status, ra.status, v_uid
        )
        and (v_app_all or ra.team_id = any (v_app_scope))
    ) end as applications_to_handle_count,

    case when 'applications_view' = any (v_caps) then v_signals end
      as priority_signals,
    case when 'applications_view' = any (v_caps) then v_total end
      as priority_total_count,

    case when 'applications_view' = any (v_caps) then (
      select coalesce(jsonb_agg(item order by item->>'created_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',         app.id,
          'created_at', app.created_at,
          'status',     app.status,
          'ad_id',      ra.id,
          'ad_title',   ra.title,
          'role',       ra.role_required,
          'team_name',  ct.name,
          'name',       coalesce(nullif(trim(p.full_name), ''), 'Candidato'),
          'avatar_url', p.avatar_url
        ) as item
        from public.recruiting_applications app
        join public.recruiting_ads ra on ra.id = app.ad_id
        join public.profiles p on p.id = app.applicant_profile_id
        left join public.club_teams ct on ct.id = ra.team_id
        where ra.club_id = p_club_id
          and app.status <> 'withdrawn'
          and (v_app_all or ra.team_id = any (v_app_scope))
        order by app.created_at desc
        limit 3
      ) preview
    ) end as applications_preview,

    -- §15: ordinamento sportivo stabile — prima squadra, poi settore
    -- giovanile secondo `sort_order`. Nessun conteggio di giocatori o staff
    -- nel payload: un campo restituito è un campo che prima o poi qualcuno
    -- disegna, e §15 lo vieta.
    case when 'teams_view' = any (v_caps) then (
      select coalesce(jsonb_agg(item order by item->>'rank', item->>'name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',       ct.id,
          'name',     ct.name,
          'category', ct.category,
          'logo_url', ct.logo_url,
          'rank',     lpad((
            case when ct.team_type = 'senior' then 0 else 1 end * 100000
            + greatest(0, least(ct.sort_order, 99999))
          )::text, 6, '0')
        ) as item
        from public.club_teams ct
        where ct.club_id = p_club_id
          and not ct.is_archived
          and (v_team_all or ct.id = any (v_team_scope))
        order by
          case when ct.team_type = 'senior' then 0 else 1 end,
          ct.sort_order,
          ct.name
        limit 3
      ) preview
    ) end as teams_preview,

    case when 'content_view' = any (v_caps) and v_content_all then (
      select coalesce(jsonb_agg(item order by item->>'updated_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',            cmp.id,
          'title',         case when cmp.kind = 'post' then coalesce(nullif(left(btrim(cmp.body), 80), ''), 'Post') else cmp.title end,
          'kind',          cmp.kind,
          'status',        cmp.status,
          'thumbnail_url', coalesce(cmp.thumbnail_url, cmp.visual_url, (select coalesce(m.thumbnail_url, m.url) from public.content_post_media m where m.content_type = 'club_media' and m.post_id = cmp.id and m.position = 0)),
          'updated_at',    cmp.updated_at
        ) as item
        from public.club_media_posts cmp
        where cmp.club_id = p_club_id
          and cmp.status = 'draft'
        -- HOM-06.2 §230: la bozza di un Post o di un Articolo si vede e si conta solo se
        -- il chiamante ha l'accesso di quella bozza (Articolo: content_article_publish).
        and (cmp.kind not in ('post', 'article')
             or public.footme_content_draft_access('club_media', cmp.id, v_uid))
        order by cmp.updated_at desc
        limit 3
      ) preview
    ) end as drafts_preview,

    case when 'content_view' = any (v_caps) and v_content_all then (
      select coalesce(jsonb_agg(item order by item->>'published_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',            cmp.id,
          'title',         case when cmp.kind = 'post' then coalesce(nullif(left(btrim(cmp.body), 80), ''), 'Post') else cmp.title end,
          'kind',          cmp.kind,
          'status',        cmp.status,
          'thumbnail_url', coalesce(cmp.thumbnail_url, cmp.visual_url, (select coalesce(m.thumbnail_url, m.url) from public.content_post_media m where m.content_type = 'club_media' and m.post_id = cmp.id and m.position = 0)),
          'published_at',  cmp.published_at
        ) as item
        from public.club_media_posts cmp
        where cmp.club_id = p_club_id
          and cmp.status = 'published'
          and cmp.published_at <= v_now
        order by cmp.published_at desc
        limit 3
      ) preview
    ) end as recent_content_preview,

    v_now as access_verified_at,
    (extract(epoch from v_now) * 1000)::bigint as data_revision;
end;
$$;

-- 16f. footme_content_kind_label: club_media 'article' → 'Articolo' (come media_profile).
--      Ripresa dalla definizione sul database; una riga in più.
create or replace function public.footme_content_kind_label(p_content_type text, p_kind text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_content_type
    when 'club_media' then case p_kind
      when 'highlights' then 'Highlights'
      when 'interview'  then 'Intervista'
      when 'market'     then 'Mercato'
      when 'statement'  then 'Comunicato'
      when 'training'   then 'Allenamento'
      when 'event'      then 'Evento'
      when 'article'    then 'Articolo'
      else null end
    when 'media_profile' then case p_kind
      when 'article' then 'Articolo'
      when 'news'    then 'News'
      -- REV-PROF-21: contenuto visivo della redazione.
      when 'media'   then 'Foto / Video'
      else null end
    when 'fan_tribuna' then case p_kind
      when 'poll'      then 'Sondaggio'
      when 'proposal'  then 'Proposta'
      when 'formation' then 'Formazione'
      when 'opinion'   then 'Opinione'
      when 'photo'     then 'Foto'
      else null end
    when 'media_tribuna' then case p_kind
      when 'editorial_poll' then 'Sondaggio editoriale'
      when 'article_debate' then 'Dibattito'
      when 'player_vote'    then 'Votazione'
      when 'community_qa'   then 'Domande e risposte'
      else null end
    else null
  end;
$$;
