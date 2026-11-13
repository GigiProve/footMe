-- ============================================================
-- HOM-05 — Dettagli e statistiche del singolo contenuto: dati
--
-- COSA MANCAVA
--
-- HOM-04 ha reso vera la capability `can_view_insights` (§4, §5) ma dietro non
-- c'è nulla da leggere: il server non registra una sola impression, un play o
-- un'apertura, quindi non esiste né il dato né un endpoint che lo aggreghi
-- (§32–§34, §144–§149). Il task HOM-05 chiede:
--
--   1. una pipeline di eventi con definizioni CENTRALI (§33, §50, §94, §96,
--      §104): impression valida, profili raggiunti, azioni attribuite, play,
--      completamento, apertura Articolo, tutte decise dal server e non dal
--      client (§43, §54, §151);
--   2. un endpoint aggregato che rivalida la capability lato server (§5, §175,
--      §176), per ogni identità (§2, §6, §7) e per i sei tipi di contenuto, e
--      che restituisce numero reale (0 incluso) oppure `null` = «non
--      disponibile, riga da nascondere» (§40, §118–§120);
--   3. un endpoint lazy per l'andamento (§73, §157) che non invia mai eventi
--      grezzi (§74) e non inventa serie prima della pubblicazione (§70, §75).
--
-- DECISIONI DI LUIGI (2026-11-13) CHE QUESTA MIGRAZIONE REALIZZA
--
--   * D2  `content_events` conserva `viewer_profile_id` e non ha retention. La
--         tabella è chiusa (RLS attiva, nessuna policy, nessun grant ai
--         client): all'esterno escono solo aggregati (§57, §89, §150).
--   * D3  fan_tribuna e media_tribuna sono supportati con metriche parziali: le
--         righe che non hanno dato (like per le due tribune, commenti e
--         salvataggi per profile_post) sono `null`, non zero (§49, §117).
--
-- DECISIONI TECNICHE DEL LEAD (citate qui perché sono la regola, non un
-- dettaglio d'implementazione)
--
--   * Chiave del contenuto = (content_type, post_id), i sei tipi di
--     `footme_content_table`. Il client invia solo tipo e id: autore e
--     publisher si rileggono SEMPRE dal server (`footme_content_rights`,
--     feed_content_index) e non si fidano mai di un author_identity_id del
--     client (§7). Le statistiche appartengono al contenuto e al suo publisher
--     (la Società), non all'utente che le apre (§6).
--   * `insights_kind` derivato dal server: `video` se il contenuto ha almeno un
--     media video (Post con video o video editoriale), `article` se
--     `footme_feed_item_type` = 'article', altrimenti `post`. Con più video le
--     metriche video aggregano tutti.
--   * Parametri centrali in `app_policy_settings` (letti solo in SQL, mai dal
--     client): content_insights.{tracking_started_at, impression_dedupe_minutes
--     = 30, attribution_window_hours = 24, video_completion_percent = 90,
--     min_reach_for_insight = 50, source_other_threshold_percent = 2,
--     min_reads_for_read_time = 5, min_read_seconds = 3}.
--   * Riproduzioni = una per viewer, sessione app e video (§94); il tempo di
--     lettura ignora le sessioni sotto min_read_seconds (rimbalzi, §107).
--   * Auto-visualizzazioni escluse (§6, §57): non si registrano eventi di chi
--     può gestire il contenuto. Vedi «DEVIAZIONI» per la regola esatta.
--   * Contenuti pubblicati prima di `tracking_started_at`: ogni periodo parte
--     da greatest(published_at, tracking_started_at) (§70, nessun dato
--     inventato). `tracking_started_at` esce nel payload.
--   * Interazioni = somma SOLO delle componenti disponibili (§42): like
--     correnti + commenti + salvataggi; condivisioni e repost non esistono
--     ancora (HOM-09, HOM-10) e valgono `null` (§40). Like = stato corrente
--     (togliere il like lo toglie dal totale).
--   * Azioni generate = visite al profilo + visite alla Società + aperture dei
--     tag + aperture dei contenuti collegati + follower attribuiti (§50). Si
--     sommano solo le righe che il payload espone (non null): una metrica non
--     applicabile non entra nel KPI (§49).
--   * Follow attribuito (§52–§53): riga di profile_follows / club_follows verso
--     il publisher, dello stesso viewer, creata entro la finestra dopo una
--     impression del contenuto. Se il viewer ha visto più contenuti dello
--     stesso publisher, il follow va al contenuto più recente prima del follow:
--     mai doppio conteggio.
--   * Contenuto Società (§48): «Visite al profilo» non esiste (null); l'apertura
--     dell'autore conta come `society_visits`.
--
-- PERCHÉ QUESTA SOLUZIONE
--
--   * UNA definizione per ogni metrica. L'impression valida vive in
--     `footme_content_deduped_events` (finestra anchored: la prima impression
--     di un viewer apre una finestra di N minuti, le altre al suo interno non
--     contano, la prima dopo la finestra ne apre una nuova) e la usano Panoramica,
--     Profili raggiunti, Origine, Aperture Articolo, azioni e Andamento: i
--     numeri non possono divergere tra sezione e grafico (§33, §44). La validità
--     di un evento dipende solo dagli eventi PRECEDENTI, quindi la serie
--     cumulativa del grafico e il totale non si contraddicono mai.
--   * La leggibilità è la regola del Feed (`footme_feed_readable_items`) e la
--     capability è `footme_content_rights` (HOM-04): l'ingestion, l'accesso alle
--     statistiche e il menu non possono divergere.
--   * `record_content_events` è definer perché `content_events` è chiusa ai
--     client; applica TUTTI i controlli in SQL: whitelist di tipi e source
--     (gli elementi invalidi si scartano, non fanno fallire il batch), dedupe
--     su event_id (retry sicuri), contenuto leggibile e pubblicato,
--     auto-visualizzazione scartata, `occurred_at` clampato a [now()-24h,
--     now()] (un orologio sbagliato non sposta i dati fuori periodo).
--   * Gli accessi negati seguono `delete_content` (HOM-04): se il contenuto è
--     leggibile dal chiamante ma non gestibile → 42501 content_permission_denied
--     (permesso revocato, §137); in ogni altro caso (inesistente, bozza,
--     eliminato, non leggibile) risposta generica `unavailable`, che non rivela
--     l'esistenza (§65 di HOM-04, §140).
--   * Il trend è una RPC separata (lazy, §157): serie CUMULATIVA, bucket orari
--     o giornalieri nel fuso richiesto, nessun bucket prima dell'inizio dei
--     dati; con meno di tre bucket o valore finale 0 `sufficient` è false e
--     `points` è vuoto: il client non ha niente da disegnare (§75).
--
-- DEVIAZIONI DICHIARATE DAL CONTRATTO
--
--   * Auto-visualizzazione: il contratto dice «r_can_edit». Qui si scartano gli
--     eventi di chi ha QUALUNQUE tra edit / delete / insights sul contenuto: un
--     delegato Società con la sola chiave `content_insights` che sfoglia i
--     contenuti della sua Società gonfierebbe le statistiche allo stesso modo
--     di un autore. Per le persone le tre capability coincidono, quindi per i
--     profili la regola è identica; è un sovrainsieme per le Società.
--   * Batch oltre 50 elementi: i primi 50 si elaborano, il resto si scarta in
--     silenzio (coerente con «invalido = scartato, non errore»).
--   * `video_watch.props.seconds` è un INCREMENTO di secondi attivi (ogni
--     evento si somma); tempo medio = somma / riproduzioni. `article_read` è UN
--     evento per sessione di lettura col totale dei secondi attivi; tempo medio
--     = media degli eventi. Il client deve spedirli così.
--   * Il tetto di un singolo evento è 3600 s; i secondi <= 0 si scartano.
--   * Aperture Articolo: dedupe con la stessa finestra delle impression, e il
--     tasso è limitato a 100 (un'apertura da link condiviso non ha una
--     impression di anteprima).
--   * `new_followers` conta i follow CORRENTI attribuiti: chi smette di seguire
--     esce dal conto (il follow non esiste più).
--   * Trend «Interazioni»: conta le righe di like/commenti/salvataggi per data
--     di creazione. Per `since_publication` le righe precedenti all'inizio dei
--     dati entrano nel primo punto, così il valore finale coincide con il KPI
--     della Panoramica; negli altri periodi la serie parte da zero.
--   * `viewer_profile_id` ha `on delete cascade`: cancellare un account cancella
--     i suoi eventi (i profili raggiunti scendono di conseguenza).
--
-- COSA NON FA (dichiarato, non dimenticato)
--
--   * Nessuna audience segmentation, benchmark, retention curve, spettatori
--     unici (§85–§88, §97–§100): il dato (viewer, source, tempo) è conservato e
--     potrà alimentarle, ma nulla lo espone.
--   * Condivisioni, repost, contenuti collegati: `null` finché HOM-09/HOM-10
--     e il collegamento non esistono. `REPOST` e `SHARE` sono già source valide
--     (§78): nessuna migrazione servirà per attribuirle.
--   * Nessun rate limit per utente sull'ingestion (il batch è limitato a 50 e
--     l'evento ha un id unico). Da valutare se il volume lo richiede.
--   * Gli eventi di un contenuto poi eliminato restano (retention D2) ma le RPC
--     rispondono `unavailable` (HOM-04 §100); nessun purge.
--   * Una concorrenza reale non è riproducibile in PGlite (una connessione):
--     la garanzia contro i doppioni è il vincolo unique su event_id e si
--     verifica nelle conseguenze (secondo invio dello stesso id = 0 righe).
--
-- PRIVACY / PERMESSI
--
--   * `content_events`: RLS attiva, nessuna policy, nessun grant a anon e
--     authenticated. Scrive solo `record_content_events`, legge solo il codice
--     delle due RPC. Nessuna risposta contiene viewer, né elenchi, né il corpo
--     del contenuto (excerpt troncato a 140) (§57, §89, §150, §173).
--   * Ogni funzione revoca `execute` a public E ad anon (le default privileges
--     di Supabase concedono ad anon direttamente) e verifica `auth.uid()`
--     nel corpo. Gli helper non sono eseguibili da nessun ruolo client.
--   * `anon` non può eseguire le tre RPC.
--
-- ROLLOUT
--
--   * Additiva: una tabella nuova, sette righe di policy, funzioni nuove. Non
--     tocca nessuna tabella o funzione esistente. Nessun backfill: i contenuti
--     esistenti partono da `tracking_started_at` con zero eventi e mostrano lo
--     stato iniziale (§121) finché non vengono visti.
--   * `tracking_started_at` vale il momento di applicazione della migrazione e
--     `on conflict do nothing` lo rende stabile se la migrazione viene rieseguita.
--   * Il client non deve chiamare `record_content_events` prima del deploy: la
--     RPC non esiste su un remoto senza questa migrazione.
--   * Schema drift: nessuna colonna di recruiting_ads toccata. Non verificato
--     sul remoto: la migrazione non è stata applicata.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — policy centrali (§52, §96, §104, §58, §83–§84, §106)
--
-- Lette solo dal SQL. Il client riceve i risultati, mai le soglie.
-- ============================================================

insert into public.app_policy_settings (key, value, description)
values
  ('content_insights.tracking_started_at',
   to_jsonb(to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
   'HOM-05 §70 — da quando esistono eventi. I periodi di un contenuto partono da greatest(published_at, questo valore).'),
  ('content_insights.impression_dedupe_minutes', to_jsonb(30),
   'HOM-05 §32–§33 — finestra di dedupe: stesso viewer e stesso contenuto = una sola impression valida per finestra.'),
  ('content_insights.attribution_window_hours', to_jsonb(24),
   'HOM-05 §52 — finestra entro cui un follow dopo una impression è attribuito al contenuto.'),
  ('content_insights.video_completion_percent', to_jsonb(90),
   'HOM-05 §96 — percentuale di avanzamento oltre la quale una riproduzione è completata.'),
  ('content_insights.min_reach_for_insight', to_jsonb(50),
   'HOM-05 §58 — profili raggiunti minimi per mostrare la frase di insight sintetico.'),
  ('content_insights.source_other_threshold_percent', to_jsonb(2),
   'HOM-05 §84 — le sorgenti sotto questa percentuale si accorpano in OTHER.'),
  ('content_insights.min_reads_for_read_time', to_jsonb(5),
   'HOM-05 §106–§108 — letture minime perché il tempo medio di lettura sia affidabile.'),
  ('content_insights.min_read_seconds', to_jsonb(3),
   'HOM-05 §107 — secondi attivi minimi perché una sessione conti come lettura (sotto è un rimbalzo).')
on conflict (key) do nothing;


-- ============================================================
-- SEZIONE 2 — content_events: la tabella chiusa degli eventi
--
-- publisher_type/publisher_id sono derivati DAL SERVER all'ingestion (§7,
-- §149): servono all'attribuzione dei follow (tutte le impression dello stesso
-- publisher) senza ricostruire ogni volta l'autore dalle sei tabelle.
-- num_value = percentuale (video_progress) o secondi (video_watch,
-- article_read); media_ref identifica il media quando il contenuto ne ha più
-- d'uno; target_type solo per tagged_open. Nessun testo del contenuto (§173).
-- ============================================================

create table if not exists public.content_events (
  id                bigint      generated always as identity primary key,
  event_id          uuid        not null,
  event_type        text        not null,
  content_type      text        not null,
  post_id           uuid        not null,
  viewer_profile_id uuid        not null references public.profiles(id) on delete cascade,
  publisher_type    text        not null,
  publisher_id      uuid        not null,
  source            text        not null default 'OTHER',
  session_id        text,
  occurred_at       timestamptz not null,
  received_at       timestamptz not null default timezone('utc', now()),
  num_value         numeric,
  media_ref         text,
  target_type       text,
  constraint content_events_event_id_key unique (event_id),
  constraint content_events_event_type_check check (event_type in (
    'impression', 'article_open', 'article_link_click', 'article_read',
    'video_play', 'video_progress', 'video_watch',
    'author_profile_open', 'society_open', 'tagged_open', 'linked_content_open'
  )),
  constraint content_events_content_type_check check (content_type in (
    'club_media', 'media_profile', 'media_tribuna', 'fan_tribuna', 'fan_media', 'profile_post'
  )),
  constraint content_events_publisher_type_check check (publisher_type in ('profile', 'club')),
  constraint content_events_source_check check (source in (
    'HOME_FOR_YOU', 'HOME_FOLLOWING', 'PROFILE', 'SEARCH', 'SHARE', 'MESSAGE', 'REPOST', 'OTHER'
  )),
  constraint content_events_target_type_check check (
    target_type is null or target_type in ('profile', 'club', 'team')
  ),
  constraint content_events_num_value_check check (num_value is null or num_value >= 0),
  constraint content_events_session_length_check check (session_id is null or char_length(session_id) <= 64)
);

-- Tutta l'aggregazione di un contenuto parte da qui.
create index if not exists content_events_content_idx
  on public.content_events (content_type, post_id, occurred_at);

-- Attribuzione dei follow: ultima impression di un viewer su qualunque
-- contenuto dello stesso publisher prima del follow.
create index if not exists content_events_attribution_idx
  on public.content_events (publisher_type, publisher_id, viewer_profile_id, occurred_at)
  where event_type = 'impression';

-- Deduplica (footme_content_deduped_events): la passata ordina per tipo,
-- viewer e tempo dentro un contenuto; senza questo indice l'ordinamento è un
-- sort completo a ogni apertura di HOM-05.
create index if not exists content_events_dedupe_idx
  on public.content_events (content_type, post_id, event_type, viewer_profile_id, occurred_at, id);

-- `viewer_profile_id ... on delete cascade` senza retention (decisione D2):
-- senza indice ogni cancellazione account scansionerebbe tutta la tabella.
create index if not exists content_events_viewer_idx
  on public.content_events (viewer_profile_id);

-- RLS attiva, nessuna policy e nessun grant: nessuna lettura né scrittura dei
-- client (§57, §150). Scrive solo record_content_events (definer).
alter table public.content_events enable row level security;
revoke all on table public.content_events from anon, authenticated;

comment on table public.content_events is
  'HOM-05 §144–§149: eventi grezzi per contenuto. Chiusa ai client; solo aggregati escono dalle RPC di insights.';


-- ============================================================
-- SEZIONE 3 — helper interni
-- Nessuno è eseguibile dai client.
-- ============================================================

-- Cast tolleranti: il payload degli eventi arriva dal client e un valore
-- malformato scarta l'elemento, non fa fallire il batch.
create or replace function public.footme_try_uuid(p_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.footme_try_timestamptz(p_value text)
returns timestamptz
language plpgsql
immutable
as $$
begin
  return p_value::timestamptz;
exception when others then
  return null;
end;
$$;

create or replace function public.footme_try_numeric(p_value text)
returns numeric
language plpgsql
immutable
as $$
begin
  return p_value::numeric;
exception when others then
  return null;
end;
$$;

revoke all on function public.footme_try_uuid(text) from public;
revoke execute on function public.footme_try_uuid(text) from anon, authenticated;
revoke all on function public.footme_try_timestamptz(text) from public;
revoke execute on function public.footme_try_timestamptz(text) from anon, authenticated;
revoke all on function public.footme_try_numeric(text) from public;
revoke execute on function public.footme_try_numeric(text) from anon, authenticated;

-- Parametro numerico della policy centrale (con default se la riga manca).
create or replace function public.footme_insights_setting(p_key text, p_default numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public.footme_try_numeric(s.value #>> '{}')
       from public.app_policy_settings s
      where s.key = 'content_insights.' || p_key),
    p_default
  );
$$;

revoke all on function public.footme_insights_setting(text, numeric) from public;
revoke execute on function public.footme_insights_setting(text, numeric) from anon, authenticated;

-- Quando sono iniziati gli eventi (§70). Senza riga: epoca (nessun limite).
create or replace function public.footme_insights_tracking_start()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public.footme_try_timestamptz(s.value #>> '{}')
       from public.app_policy_settings s
      where s.key = 'content_insights.tracking_started_at'),
    'epoch'::timestamptz
  );
$$;

revoke all on function public.footme_insights_tracking_start() from public;
revoke execute on function public.footme_insights_tracking_start() from anon, authenticated;

-- Inizio dei dati di un contenuto: greatest(published_at, tracking_started_at).
-- Null se il contenuto non è nella vista (non pubblicato / eliminato).
create or replace function public.footme_content_insights_start(
  p_content_type text,
  p_post_id      uuid
)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select greatest(fci.published_at, public.footme_insights_tracking_start())
  from public.feed_content_index fci
  where fci.content_type = p_content_type and fci.post_id = p_post_id;
$$;

revoke all on function public.footme_content_insights_start(text, uuid) from public;
revoke execute on function public.footme_content_insights_start(text, uuid) from anon, authenticated;

-- L'accesso alle statistiche, UNA regola per le due RPC di lettura (§5, §176).
-- 'ok'          → il chiamante può leggere
-- 'unavailable' → inesistente, non pubblicato, eliminato, non leggibile
-- 42501         → il contenuto è leggibile dal chiamante ma non ha la
--                 capability (permesso revocato, §137)
create or replace function public.footme_content_insights_gate(
  p_content_type text,
  p_post_id      uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_r        record;
  v_readable boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if public.footme_content_table(p_content_type) is null or p_post_id is null then
    return 'unavailable';
  end if;

  select * into v_r from public.footme_content_rights(p_content_type, p_post_id) r;

  if not found or v_r.r_status is distinct from 'published' then
    return 'unavailable';
  end if;

  v_readable := exists (
    select 1 from public.footme_feed_readable_items(
      v_uid, array[p_content_type], array[p_post_id])
  );

  if not v_readable then
    return 'unavailable';
  end if;

  if v_r.r_can_view_insights is not true then
    raise exception 'content_permission_denied' using errcode = '42501';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.footme_content_insights_gate(text, uuid) from public;
revoke execute on function public.footme_content_insights_gate(text, uuid) from anon, authenticated;

-- Eventi validi con finestra di dedupe ANCHORED (§32–§33). Per ogni
-- (tipo, viewer) in ordine di tempo: il primo evento apre una finestra di N
-- minuti e conta; quelli dentro la finestra non contano; il primo che arriva a
-- N minuti o più dall'ultimo CONTATO ne apre una nuova. È la definizione unica
-- di impression valida e di aperture/azioni deduplicate; una sola passata.
-- p_start: inizio dei dati del contenuto (sempre quello di
-- footme_content_insights_start, così la catena non cambia tra periodi).
create or replace function public.footme_content_deduped_events(
  p_content_type text,
  p_post_id      uuid,
  p_start        timestamptz,
  p_types        text[]
)
returns table (
  e_type   text,
  e_viewer uuid,
  e_at     timestamptz,
  e_source text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r        record;
  v_w      interval := make_interval(
    mins => greatest(public.footme_insights_setting('impression_dedupe_minutes', 30)::int, 0));
  v_type   text;
  v_viewer uuid;
  v_anchor timestamptz;
begin
  for r in
    select ce.event_type, ce.viewer_profile_id, ce.occurred_at, ce.source
    from public.content_events ce
    where ce.content_type = p_content_type
      and ce.post_id = p_post_id
      and ce.event_type = any (p_types)
      and ce.occurred_at >= p_start
    order by ce.event_type, ce.viewer_profile_id, ce.occurred_at, ce.id
  loop
    if r.event_type is distinct from v_type
       or r.viewer_profile_id is distinct from v_viewer
       or r.occurred_at - v_anchor >= v_w then
      v_type   := r.event_type;
      v_viewer := r.viewer_profile_id;
      v_anchor := r.occurred_at;
      e_type   := r.event_type;
      e_viewer := r.viewer_profile_id;
      e_at     := r.occurred_at;
      e_source := r.source;
      return next;
    end if;
  end loop;
end;
$$;

revoke all on function public.footme_content_deduped_events(text, uuid, timestamptz, text[]) from public;
revoke execute on function public.footme_content_deduped_events(text, uuid, timestamptz, text[]) from anon, authenticated;

-- Quali componenti di interazione esistono per un tipo (§36, §40, D3).
-- Una componente senza tabella è null (non applicabile), mai 0.
create or replace function public.footme_content_interaction_kinds(p_content_type text)
returns text[]
language sql
immutable
as $$
  select case p_content_type
    when 'club_media'     then array['like', 'comment', 'save']
    when 'media_profile'  then array['like', 'comment', 'save']
    when 'fan_media'      then array['like', 'comment', 'save']
    when 'media_tribuna'  then array['comment', 'save']
    when 'fan_tribuna'    then array['comment', 'save']
    when 'profile_post'   then array['like']
    else array[]::text[]
  end;
$$;

revoke all on function public.footme_content_interaction_kinds(text) from public;
revoke execute on function public.footme_content_interaction_kinds(text) from anon, authenticated;

-- Righe di like / commento / salvataggio con la data di creazione. Come il
-- payload del Feed, conta le righe correnti. Fonte unica di Interazioni
-- (totale e andamento).
create or replace function public.footme_content_interaction_rows(
  p_content_type text,
  p_post_id      uuid
)
returns table (
  i_kind text,
  i_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select 'like'::text, x.created_at from public.club_media_likes x
    where p_content_type = 'club_media' and x.post_id = p_post_id
  union all
  select 'like', x.created_at from public.fan_media_likes x
    where p_content_type = 'fan_media' and x.post_id = p_post_id
  union all
  select 'like', x.created_at from public.profile_post_likes x
    where p_content_type = 'profile_post' and x.post_id = p_post_id
  union all
  select 'like', x.created_at from public.media_profile_post_likes x
    where p_content_type = 'media_profile' and x.post_id = p_post_id
  union all
  select 'comment', x.created_at from public.club_media_comments x
    where p_content_type = 'club_media' and x.post_id = p_post_id
  union all
  select 'comment', x.created_at from public.media_profile_post_comments x
    where p_content_type = 'media_profile' and x.post_id = p_post_id
  union all
  select 'comment', x.created_at from public.media_tribuna_comments x
    where p_content_type = 'media_tribuna' and x.post_id = p_post_id
  union all
  select 'comment', x.created_at from public.fan_tribuna_comments x
    where p_content_type = 'fan_tribuna' and x.post_id = p_post_id
  union all
  select 'comment', x.created_at from public.fan_media_comments x
    where p_content_type = 'fan_media' and x.post_id = p_post_id
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
    where p_content_type = 'fan_media' and x.post_id = p_post_id;
$$;

revoke all on function public.footme_content_interaction_rows(text, uuid) from public;
revoke execute on function public.footme_content_interaction_rows(text, uuid) from anon, authenticated;

-- Applicabilità delle azioni sui tag (§47, §49): il contenuto ha tag o
-- mention strutturati? Ne ha verso una Società (club o team)? Stesse fonti e
-- stesso filtro (status = 'active') del payload del Feed.
create or replace function public.footme_content_target_flags(
  p_content_type text,
  p_post_id      uuid
)
returns table (
  t_has_targets boolean,
  t_has_society boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with tags as (
    select t.target_type
    from public.club_media_tagged_profiles t
    where p_content_type = 'club_media' and t.post_id = p_post_id and t.status = 'active'
    union all
    select t.target_type
    from public.fan_tribuna_tagged_players t
    where p_content_type = 'fan_tribuna' and t.post_id = p_post_id and t.status = 'active'
    union all
    select t.target_type
    from public.media_profile_post_tagged_targets t
    where p_content_type = 'media_profile' and t.post_id = p_post_id and t.status = 'active'
    union all
    select t.target_type
    from public.profile_post_tagged_targets t
    where p_content_type = 'profile_post' and t.post_id = p_post_id and t.status = 'active'
  ),
  ments as (
    select m.mention
    from public.content_post_extras ex
    cross join lateral jsonb_array_elements(ex.mentions) as m(mention)
    where ex.content_type = p_content_type and ex.post_id = p_post_id
  )
  select
    exists (select 1 from tags) or exists (select 1 from ments),
    exists (select 1 from tags where tags.target_type in ('club', 'team'))
      or exists (select 1 from ments where ments.mention ->> 'identity_type' = 'club');
$$;

revoke all on function public.footme_content_target_flags(text, uuid) from public;
revoke execute on function public.footme_content_target_flags(text, uuid) from anon, authenticated;


-- ============================================================
-- SEZIONE 4 — record_content_events: l'ingestion
--
-- Un batch di eventi del client → righe di content_events. Ogni elemento è
-- validato qui (§33, §80, §149); i non validi si scartano senza errore. Il
-- client non decide nulla di ciò che conta: tipo e source sono whitelist,
-- autore e publisher vengono dal server, l'auto-visualizzazione non entra.
-- Ritorna {accepted: n} = righe realmente inserite (i doppioni per event_id
-- non contano: un retry è sicuro).
-- ============================================================

create or replace function public.record_content_events(p_events jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_now      timestamptz := timezone('utc', now());
  v_accepted integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    return jsonb_build_object('accepted', 0);
  end if;

  if not exists (select 1 from public.profiles pr where pr.id = v_uid) then
    return jsonb_build_object('accepted', 0);
  end if;

  with raw as (
    -- Batch massimo 50: il resto si scarta.
    select t.ord, t.e
    from jsonb_array_elements(p_events) with ordinality as t(e, ord)
    where t.ord <= 50 and jsonb_typeof(t.e) = 'object'
  ),
  parsed as (
    select
      r.ord,
      public.footme_try_uuid(r.e ->> 'event_id')                              as event_id,
      r.e ->> 'event_type'                                                    as event_type,
      r.e ->> 'content_type'                                                  as content_type,
      public.footme_try_uuid(r.e ->> 'post_id')                               as post_id,
      coalesce(nullif(btrim(r.e ->> 'source'), ''), 'OTHER')                  as source,
      left(nullif(btrim(r.e ->> 'session_id'), ''), 64)                       as session_id,
      -- occurred_at mancante o illeggibile = ora; fuori da [now-24h, now] si
      -- riporta al bordo (un orologio sbagliato non sposta i dati di periodo).
      least(
        greatest(
          coalesce(public.footme_try_timestamptz(r.e ->> 'occurred_at'), v_now),
          v_now - interval '24 hours'),
        v_now)                                                                as occurred_at,
      public.footme_try_numeric(r.e #>> '{props,percent}')                    as percent,
      public.footme_try_numeric(r.e #>> '{props,seconds}')                    as seconds,
      left(nullif(btrim(r.e #>> '{props,media_id}'), ''), 128)                as media_ref,
      case when r.e #>> '{props,target_type}' in ('profile', 'club', 'team')
           then r.e #>> '{props,target_type}' end                             as target_type
    from raw r
  ),
  valid as (
    select
      p.event_id, p.event_type, p.content_type, p.post_id, p.source,
      p.session_id, p.occurred_at, p.media_ref, p.target_type,
      case p.event_type
        when 'video_progress' then
          case when p.percent between 0 and 100 then round(p.percent) end
        when 'video_watch' then
          case when p.seconds > 0 then least(p.seconds, 3600) end
        when 'article_read' then
          case when p.seconds > 0 then least(p.seconds, 3600) end
      end as num_value
    from parsed p
    where p.event_id is not null
      and p.post_id is not null
      and p.event_type in (
        'impression', 'article_open', 'article_link_click', 'article_read',
        'video_play', 'video_progress', 'video_watch',
        'author_profile_open', 'society_open', 'tagged_open', 'linked_content_open')
      and public.footme_content_table(p.content_type) is not null
      and p.source in (
        'HOME_FOR_YOU', 'HOME_FOLLOWING', 'PROFILE', 'SEARCH', 'SHARE', 'MESSAGE', 'REPOST', 'OTHER')
  ),
  valid_typed as (
    select v.*
    from valid v
    where v.event_type not in ('video_progress', 'video_watch', 'article_read')
       or v.num_value is not null
  ),
  keys as (
    select distinct vt.content_type, vt.post_id from valid_typed vt
  ),
  -- Leggibile e pubblicato: la regola del Feed, lo stesso insieme che il
  -- viewer potrebbe vedere. Contenuto non leggibile = evento scartato.
  readable as (
    select ri.r_content_type, ri.r_post_id, ri.r_publisher_type, ri.r_publisher_id
    from public.footme_feed_readable_items(
      v_uid,
      (select array_agg(k.content_type) from keys k),
      (select array_agg(k.post_id) from keys k)) ri
  ),
  eligible as (
    select rd.r_content_type, rd.r_post_id, rd.r_publisher_type, rd.r_publisher_id
    from readable rd
    cross join lateral public.footme_content_rights(rd.r_content_type, rd.r_post_id) cr
    where cr.r_status = 'published'
      -- Auto-visualizzazione (§6, §57): chi gestisce il contenuto non produce
      -- statistiche su di esso.
      and not (cr.r_can_edit or cr.r_can_delete or cr.r_can_view_insights)
  )
  insert into public.content_events (
    event_id, event_type, content_type, post_id, viewer_profile_id,
    publisher_type, publisher_id, source, session_id, occurred_at,
    num_value, media_ref, target_type)
  select
    vt.event_id, vt.event_type, vt.content_type, vt.post_id, v_uid,
    el.r_publisher_type, el.r_publisher_id, vt.source, vt.session_id, vt.occurred_at,
    vt.num_value, vt.media_ref, vt.target_type
  from valid_typed vt
  join eligible el on el.r_content_type = vt.content_type and el.r_post_id = vt.post_id
  on conflict (event_id) do nothing;

  get diagnostics v_accepted = row_count;

  return jsonb_build_object('accepted', v_accepted);
end;
$$;

revoke all on function public.record_content_events(jsonb) from public;
revoke execute on function public.record_content_events(jsonb) from anon;
grant execute on function public.record_content_events(jsonb) to authenticated;

comment on function public.record_content_events(jsonb) is
  'HOM-05 §144–§149: ingestion eventi (batch <= 50, dedupe su event_id, whitelist, auto-view scartata). {accepted}.';


-- ============================================================
-- SEZIONE 5 — fetch_content_insights: l'endpoint aggregato
--
-- Un solo round trip (§156, §158). Convenzione: numero = dato reale (0
-- incluso); null = non disponibile, riga da nascondere (§118–§120).
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
      'shares',   null,
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
  'HOM-05 §152: statistiche aggregate di un contenuto. {status: ok|unavailable, ...}; 42501 content_permission_denied se il contenuto è leggibile ma la capability manca. null = non disponibile, 0 = zero reale.';


-- ============================================================
-- SEZIONE 6 — fetch_content_insights_trend: l'andamento (lazy)
--
-- Serie CUMULATIVA dall'inizio del periodo (§64–§75). `ts` = inizio del
-- bucket (il primo, ritagliato all'inizio dei dati: nessun punto prima della
-- pubblicazione o del tracking, §70); il valore è cumulato fino alla fine del
-- bucket. Bucket: 24h → ora; 7d, 30d → giorno; since_publication → ora se
-- l'età è < 48 ore, altrimenti giorno. Reach = viewer distinti cumulati
-- (contati alla prima impression nel periodo).
-- ============================================================

create or replace function public.fetch_content_insights_trend(
  p_content_type text,
  p_post_id      uuid,
  p_metric       text,
  p_period       text,
  p_timezone     text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_now     timestamptz := timezone('utc', now());
  v_gate    text;
  v_tz      text;
  v_start   timestamptz;
  v_pstart  timestamptz;
  v_since   timestamptz;
  v_unit    text;
  v_points  jsonb;
  v_n       integer;
  v_last    numeric;
  v_ok      boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_metric is null or p_metric not in ('views', 'reach', 'interactions') then
    raise exception 'invalid_metric' using errcode = '22023';
  end if;
  if p_period is null or p_period not in ('24h', '7d', '30d', 'since_publication') then
    raise exception 'invalid_period' using errcode = '22023';
  end if;

  v_gate := public.footme_content_insights_gate(p_content_type, p_post_id);
  if v_gate <> 'ok' then
    return jsonb_build_object('status', v_gate);
  end if;

  -- Fuso normalizzato (§73): un nome IANA conosciuto, altrimenti UTC.
  v_tz := case
    when p_timezone is not null
         and exists (select 1 from pg_timezone_names z where z.name = p_timezone)
      then p_timezone
    else 'UTC'
  end;

  v_start := public.footme_content_insights_start(p_content_type, p_post_id);
  if v_start is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  v_since := case p_period
    when '24h' then v_now - interval '24 hours'
    when '7d'  then v_now - interval '7 days'
    when '30d' then v_now - interval '30 days'
    else v_start
  end;
  v_pstart := greatest(v_since, v_start);

  v_unit := case
    when p_period = '24h'                          then 'hour'
    when p_period in ('7d', '30d')                 then 'day'
    when v_now - v_start < interval '48 hours'     then 'hour'
    else 'day'
  end;

  with pts as (
    -- Visualizzazioni: impression valide nel periodo (la validità è calcolata
    -- su tutta la storia, poi si filtra il periodo).
    select d.e_at as t
    from public.footme_content_deduped_events(
           p_content_type, p_post_id, v_start, array['impression']) d
    where p_metric = 'views' and d.e_at >= v_pstart
    union all
    -- Profili raggiunti: un punto per viewer, alla prima impression nel periodo.
    select min(d.e_at)
    from public.footme_content_deduped_events(
           p_content_type, p_post_id, v_start, array['impression']) d
    where p_metric = 'reach' and d.e_at >= v_pstart
    group by d.e_viewer
    union all
    -- Interazioni: righe per data di creazione. In since_publication anche
    -- quelle precedenti all'inizio dei dati (il totale coincide col KPI).
    select r.i_at
    from public.footme_content_interaction_rows(p_content_type, p_post_id) r
    where p_metric = 'interactions'
      and (p_period = 'since_publication' or r.i_at >= v_pstart)
  ),
  series as (
    select g.bs
    from generate_series(
           date_trunc('hour', v_pstart, v_tz),
           date_trunc('hour', v_now, v_tz),
           interval '1 hour') as g(bs)
    where v_unit = 'hour'
    union all
    select (g.ls at time zone v_tz)
    from generate_series(
           date_trunc('day', v_pstart at time zone v_tz),
           date_trunc('day', v_now at time zone v_tz),
           interval '1 day') as g(ls)
    where v_unit = 'day'
  ),
  -- Una sola passata: ogni punto va nel suo bucket (stesso troncamento della
  -- serie), poi somma cumulativa. I punti precedenti al primo bucket
  -- (Interazioni in since_publication) entrano come base del primo valore.
  binned as (
    select
      case when v_unit = 'hour' then date_trunc('hour', p.t, v_tz)
           else (date_trunc('day', p.t at time zone v_tz) at time zone v_tz)
      end as bs,
      count(*) as n
    from pts p
    group by 1
  ),
  base as (
    select count(*) as n
    from pts p
    where p.t < (select min(s.bs) from series s)
  ),
  valued as (
    select s.bs,
           (select b.n from base b)
             + sum(coalesce(bn.n, 0)) over (order by s.bs) as v
    from series s
    left join binned bn on bn.bs = s.bs
  )
  select
    coalesce(jsonb_agg(jsonb_build_object('ts', to_jsonb(greatest(x.bs, v_pstart)), 'value', x.v)
                       order by x.bs), '[]'::jsonb),
    count(*),
    (array_agg(x.v order by x.bs desc))[1]
  into v_points, v_n, v_last
  from valued x;

  -- Meno di tre bucket o valore finale 0: niente grafico (§75).
  v_ok := v_n >= 3 and coalesce(v_last, 0) > 0;

  return jsonb_build_object(
    'status', 'ok',
    'metric', p_metric,
    'period', p_period,
    'timezone', v_tz,
    'interval', v_unit,
    'cumulative', true,
    'sufficient', v_ok,
    'points', case when v_ok then v_points else '[]'::jsonb end);
end;
$$;

revoke all on function public.fetch_content_insights_trend(text, uuid, text, text, text) from public;
revoke execute on function public.fetch_content_insights_trend(text, uuid, text, text, text) from anon;
grant execute on function public.fetch_content_insights_trend(text, uuid, text, text, text) to authenticated;

comment on function public.fetch_content_insights_trend(text, uuid, text, text, text) is
  'HOM-05 §64–§75, §157: serie cumulativa (views | reach | interactions) per periodo, bucket nel fuso richiesto. sufficient=false e points=[] se i dati non bastano.';
