-- ============================================================
-- HOM-10 — Repost: lato database
--
-- COSA MANCAVA
--
-- Il Repost (HOM-10 §1–§3) oggi non esiste e dietro «Condividi» (HOM-09) non
-- c'è alcuna distribuzione PUBBLICA di un contenuto. Mancano due oggetti
-- tecnicamente diversi, che l'utente vede come UNA funzione (§1–§4, §61–§65):
--
--   1. Il Simple Repost (§63, §66–§69): ridistribuisce l'originale senza testo.
--      Non è un Post (§67: nessun post_id social, nessun body, nessun layer di
--      interazione). Serve una tabella propria con stato, unicità per
--      (identità, originale) (§68) e idempotenza (§69, §234).
--   2. Il Post con riferimento (§64, §86–§89): un Post normale (profile_posts,
--      club_media_posts kind 'post', media_profile_posts kind 'post') che porta
--      anche una reference STRUTTURATA all'originale (§88), non una copia di
--      body/media (§89). Il Post non ha dove tenerla.
--
--   Mancano inoltre: la capability `can_repost` (§32, §44), la rivalidazione
--   della reference allo scheduling e al job (§153–§155), la lettura della
--   reference col suo snapshot a un livello solo (§56–§60, §184), l'aggregazione
--   dei Simple Repost nel Feed Seguiti (§73, §185–§187), la metrica Repost di
--   HOM-05 con il suo breakdown (§207–§214: `engagement.reposts` è oggi `null`)
--   e gli eventi di dominio per il futuro Centro Notifiche (§217–§224).
--
-- DECISIONI DI LUIGI (contratto HOM-10) CHE QUESTA MIGRAZIONE REALIZZA
--
--   * D1  `can_repost` è DERIVATA da `content_create` (la stessa regola di
--         `can_publish_post` per identità: persona su se stessa, Società
--         titolare + delegati con content_create, Media titolare). Vive in UNA
--         funzione, `footme_can_repost(actor, identity_type, identity_id)`:
--         una chiave di catalogo futura la separa qui, senza toccare il
--         client e senza toccare il catalogo oggi.
--   * D2  Nel Feed il Simple Repost compare SOLO in Seguiti, con il reposter
--         seguito dal viewer. Per te è invariato (§195–§196: segnali al
--         ranking, nessun algoritmo qui).
--
-- PERCHÉ QUESTA SOLUZIONE (una regola in un posto solo)
--
--   * Simple Repost = tabella `content_reposts` (chiusa ai client: nessuna
--     policy, nessun grant; si legge e si scrive solo da RPC). Unico parziale
--     su (identità, contenuto) dove status = 'active' (§68): è il vincolo, non
--     una select, a impedire il duplicato anche con due device (§236). Il
--     tipo di identità usa il vocabolario di tutto Home (`person|society|media`,
--     come `content_likes.actor_type`), non `profile|club|media`: una mappatura
--     in meno fra la tabella e le schede identità di footme_composer_identity_card.
--   * Post con riferimento = due colonne su `content_post_extras`
--     (`referenced_content_type`, `referenced_content_id`), la stessa riga che
--     già porta mention e link del Post (§139: «referenced_content_id /
--     referenced_content_type» fra i campi della bozza). Nessuna tabella
--     parallela. IMMUTABILE dopo il primo salvataggio con reference (§47, §160,
--     §163): lo garantisce un TRIGGER (cambiare reference cambierebbe il
--     significato del Post mantenendone l'engagement), non la cortesia del
--     client. Un secondo trigger chiude ai client la scrittura diretta delle
--     due colonne: RLS filtra righe, non colonne.
--   * La reference NON è «contenuto significativo» (§62–§64): body vuoto +
--     reference NON è un Post. `footme_content_is_significant` e il controllo
--     `empty` del blocker non cambiano proprio per questo: l'unica via di un
--     body vuoto è il Simple Repost.
--   * Un solo punto di rivalidazione della reference (§153–§155, §225–§227, §231,
--     §287): `footme_content_blocker` guadagna il motivo `reference_unavailable`
--     (modalità now/schedule/worker, NON edit: un Post già pubblicato resta
--     modificabile anche se l'originale è sparito, §172). Lo usano
--     submit_content (ora e programma), l'elenco bozze (unschedulable_reason) e
--     il worker `run_scheduled_content_sweep`, che NON cambia: il Post
--     programmato con originale eliminato va in `failed` col testo intatto
--     (ciclo di vita HOM-06.2, §156–§157).
--   * Normalizzazione §178–§181: i target sono SEMPRE contenuti canonici (4
--     tipi: profile_post, club_media, media_profile, fan_media). Un Simple
--     Repost non ha un id di contenuto, quindi non può essere un target: il
--     client porta già type/id dell'originale e il server non ha altro da
--     risolvere. Un Post con riferimento È un contenuto canonico e può essere
--     target a sua volta (§107, §183) → la reference punta al suo id.
--   * Un solo livello (§57–§60, §184): `footme_repost_reference_json` restituisce
--     la reference col snapshot di HOM-09 (`footme_share_snapshot`) e al più un
--     booleano `has_reference`: mai la reference annidata.
--   * Metriche separate (§211–§212): `fetch_content_insights.reposts` conta i
--     Simple Repost attivi + i Post pubblicati che referenziano DIRETTAMENTE il
--     contenuto (§214); `shares` non cambia, e un Repost non scrive mai in
--     content_share_actions. Come le Condivisioni di HOM-09, i Repost restano
--     FUORI dal totale `interactions` (la definizione esistente conta like +
--     commenti + salvataggi): vedi «DEVIAZIONI».
--   * Eventi di dominio (§217–§224): tabella chiusa `content_repost_events`,
--     outbox append-only senza consumatore (stesso modello di
--     `content_comment_events`). Nessuna notifica utente, nessuna chat (§222).
--     Nessun evento per un'azione su un proprio contenuto (§221).
--
-- RIEMISSIONI (ognuna dalla DEFINIZIONE PIÙ RECENTE, estratta dal file e
-- patchata per sostituzione esatta, con la sola modifica dichiarata)
--
--   footme_post_text_is_meaningful       20261120090000 §4h  (invisibili = vuoto, §62: ATTENZIONE, vale per tutti i Post e i commenti)
--   footme_content_persist_post          20261121090000 §9c  (reference: validata, immutabile, mai persa)
--   footme_content_clone_children        20261121090000 §9e  (copia le due colonne nel cambio identità)
--   footme_content_blocker               20261121090000 §8f  (motivo reference_unavailable)
--   footme_content_raise_blocker         20261121090000 §8g  (codice errore dedicato)
--   footme_content_blocker_reason        20261121090000 §8h  (valore 'reference' per l'elenco)
--   footme_post_payloads                 20261123090000 §5-2 (capabilities.can_repost, reference)
--   fetch_home_feed_page                 20261122090000 §4-5 (wrapper Simple Repost in Seguiti)
--   fetch_home_feed_updates              20260727120000 §2   (stesso conteggio dei wrapper)
--   fetch_content_insights               20261124090000 §9   (reposts + reposts_breakdown)
--   fetch_content_for_editor             20261121090000 §12c (post.reference per riaprire la bozza)
--   fetch_post_for_edit                  20261120090000 §8   (reference, sola lettura, in Modifica)
--
--   NON riemesse, e perché: update_post (HOM-06.1) non riceve la reference, quindi non
--   può cambiarla: il suo upsert su content_post_extras imposta solo mention e link,
--   le due colonne restano; submit_content / save_content_draft / footme_content_apply
--   passano il payload così com'è a footme_content_persist_post;
--   footme_content_is_significant non conta la reference (voluto); fetch_post_detail,
--   fetch_profile_post_detail e fetch_article_detail leggono il payload da
--   footme_post_payloads (o non hanno reference), quindi la reference arriva senza toccarle.
--
-- PRIVACY / PERMESSI
--
--   * RPC client (fetch_repost_state, repost_content, remove_repost): SECURITY
--     DEFINER con search_path fisso, `revoke from public` + `revoke execute from
--     anon`, grant ad authenticated, controllo auth.uid() nel corpo. Le funzioni
--     interne non hanno execute per i client.
--   * Trappola «le RPC su clubs devono essere security invoker»: queste definer
--     non elencano mai Società a un chiamante; leggono `clubs` solo tramite
--     helper già in uso (footme_publishing_identities, footme_composer_identity_card,
--     footme_like_actor_visible, feed_content_index) per identità già autorizzate
--     o contenuti già leggibili. NESSUNA lettura diretta NUOVA di `clubs` in questa
--     migrazione: il nuovo codice non nomina mai la tabella. Le sole occorrenze nel file
--     sono il testo delle funzioni riemesse (footme_post_payloads, fetch_home_feed_page:
--     identiche alla definizione di partenza). Il nuovo codice chiama però gli helper
--     esistenti che la leggono (footme_publishing_identities, footme_composer_identity_card
--     per la scheda del reposter Società nel Feed e in fetch_repost_state,
--     footme_like_actor_visible, feed_content_index, footme_content_readable).
--     Il destinatario degli eventi per un target Società è `recipient_profile_id` NULL:
--     il titolare NON si risolve qui (target_author_type = 'society' e target_author_id
--     identificano la Società; il futuro consumatore lo risolve come invoker).
--     Su PGlite l'utente è superuser e RLS non si applica: non dimostrabile qui.
--   * `content_reposts`, `content_repost_events`: RLS attiva, nessuna policy,
--     `revoke all` ad anon e authenticated.
--   * Una riga `content_reposts` NON esce mai verso un client se non come
--     stato dell'identità del chiamante (fetch_repost_state) o come reposter
--     seguito dal viewer nel Feed (footme_feed_repost_groups: reposter visibile,
--     non bloccato, non il viewer, originale leggibile).
--
-- DEVIAZIONI E LIMITI DICHIARATI
--
--   * `reposts` e `reposts_breakdown` restano fuori da `interactions` (come le
--     Condivisioni, HOM-09): il totale e l'andamento di HOM-05 non cambiano.
--   * `fetch_repost_state.identities[].context_label` è l'etichetta della scheda
--     identità (`Profilo personale` / `Società` / `Media`), la stessa del composer;
--     non compone il ruolo («Allenatore · AC Como»): il client può derivarlo dal
--     profilo con i presentatori esistenti.
--   * §62 «caratteri invisibili non significativi»: `footme_post_text_is_meaningful`
--     (HOM-06.1, usata da publish/bozze/programmati e dai commenti di HOM-08) usava
--     `\s`, che nel motore regex NON copre NBSP né i caratteri di larghezza zero: un
--     Post «\u200b» era pubblicabile e, con una reference, avrebbe aggirato la regola
--     «body vuoto = Simple Repost». Ora quei caratteri contano come vuoto ovunque (UNA
--     regola). Cambia quindi anche il comportamento di Post e commenti composti solo
--     da caratteri invisibili: restano rifiutati come lo erano gli spazi.
--   * Il Simple Repost NON compare nel Profilo in V1 (§198 dice «può»; §200 vieta
--     una tab): nessuna superficie di profilo lo legge. La riga è comunque in
--     `content_reposts` per quando serviranno.
--   * «Altre N persone» (§187, §190) conta solo i reposter SEGUITI dal viewer, non
--     tutti i reposter: Seguiti non deve rivelare chi il viewer non segue.
--   * Anti-spam (§136, §294) e ranking (§293): non implementati qui. I segnali
--     esistono (content_reposts, content_repost_events, la reference sulle
--     extras) e nessun consumatore li usa ancora.
--   * Un payload con `reference` per un ARTICOLO è ignorato: persist_article non
--     legge la chiave (§17: il composer Repost è solo Post).
--   * I Post con riferimento NON sono aggregati (§192–§193): sono Post normali.
--   * Concorrenza: PGlite ha una sola connessione. L'unicità (indice unico parziale
--     su (identità, contenuto) e su (attore, operation_key)) e l'advisory lock su
--     (attore, chiave) sono i meccanismi; se ne verificano le conseguenze, non la
--     corsa vera.
--   * Remoto: la migrazione NON è stata applicata a nessun database remoto.
-- ============================================================

-- ============================================================
-- SEZIONE 1 — schema: Simple Repost, reference sul Post, eventi
-- ============================================================

-- 1a. Simple Repost (§66–§69). Una riga per atto di repost; lo stato decide se
-- «esiste» (active), se l'utente l'ha tolto (removed, §128) o se è caduto perché
-- l'originale è stato eliminato (invalidated, §169). `target_author_*` e
-- `target_owner_profile_id` sono fatti immutabili dell'originale (l'autore non
-- cambia mai) congelati alla creazione: l'evento SIMPLE_REPOST_REMOVED può così
-- identificare il destinatario anche se l'originale non è più leggibile.
create table if not exists public.content_reposts (
  id                      uuid        primary key default gen_random_uuid(),
  reposter_identity_type  text        not null,
  reposter_identity_id    uuid        not null,
  actor_profile_id        uuid        not null references public.profiles(id) on delete cascade,
  content_type            text        not null,
  content_id              uuid        not null,
  status                  text        not null default 'active',
  operation_key           uuid        not null,
  target_author_type      text,
  target_author_id        uuid,
  target_owner_profile_id uuid,
  created_at              timestamptz not null default now(),
  removed_at              timestamptz,
  constraint content_reposts_identity_type_check
    check (reposter_identity_type in ('person', 'society', 'media')),
  constraint content_reposts_content_type_check
    check (content_type in ('profile_post', 'club_media', 'media_profile', 'fan_media')),
  constraint content_reposts_status_check
    check (status in ('active', 'removed', 'invalidated')),
  constraint content_reposts_removed_at_check
    check ((status = 'active') = (removed_at is null))
);

-- §68: al più UN Simple Repost attivo per (identità, originale).
create unique index if not exists content_reposts_active_key
  on public.content_reposts (reposter_identity_type, reposter_identity_id, content_type, content_id)
  where status = 'active';

-- §69, §234: la chiave di operazione è dell'attore.
create unique index if not exists content_reposts_operation_key
  on public.content_reposts (actor_profile_id, operation_key);

-- Dall'originale ai suoi reposter attivi (insights, invalidazione).
create index if not exists content_reposts_content_idx
  on public.content_reposts (content_type, content_id)
  where status = 'active';

-- Dal reposter ai suoi repost attivi più recenti (Feed Seguiti).
create index if not exists content_reposts_reposter_idx
  on public.content_reposts (reposter_identity_type, reposter_identity_id, created_at desc)
  where status = 'active';

alter table public.content_reposts enable row level security;
revoke all on table public.content_reposts from anon, authenticated;

comment on table public.content_reposts is
  'HOM-10 §66–§69: Simple Repost (redistribuzione pubblica senza testo). Non è un Post: nessun body, nessun post_id, nessun engagement. Chiusa ai client: si legge e si scrive solo da RPC.';

-- 1b. Eventi di dominio (§217–§224). Outbox append-only, nessun consumatore:
-- il futuro Centro Notifiche decide categoria, preferenze, push e aggregazione
-- (§218, §224). Non porta MAI testo. `recipient_profile_id` è l'autore del contenuto
-- target (§219–§220) quando è una persona o un Media; è NULL quando il target è una
-- Società: il titolare non si legge qui (nessuna lettura di `clubs` da una definer),
-- `target_author_type = 'society'` e `target_author_id` identificano il destinatario e
-- il consumatore futuro lo risolve come invoker.
create table if not exists public.content_repost_events (
  id                   bigserial   primary key,
  event_type           text        not null,
  recipient_profile_id uuid        references public.profiles(id) on delete cascade,
  actor_profile_id     uuid        references public.profiles(id) on delete set null,
  actor_identity_type  text,
  actor_identity_id    uuid,
  target_content_type  text        not null,
  target_content_id    uuid        not null,
  target_author_type   text,
  target_author_id     uuid,
  repost_id            uuid,
  post_content_type    text,
  post_id              uuid,
  occurred_at          timestamptz not null default now(),
  consumed_at          timestamptz,
  constraint content_repost_events_type_check
    check (event_type in ('SIMPLE_REPOST_CREATED', 'REFERENCED_POST_CREATED', 'SIMPLE_REPOST_REMOVED')),
  constraint content_repost_events_actor_identity_check
    check (actor_identity_type is null or actor_identity_type in ('person', 'society', 'media')),
  constraint content_repost_events_shape_check
    check ((event_type = 'REFERENCED_POST_CREATED') = (post_id is not null))
);

create index if not exists content_repost_events_pending_idx
  on public.content_repost_events (id) where consumed_at is null;
create index if not exists content_repost_events_recipient_idx
  on public.content_repost_events (recipient_profile_id, id) where consumed_at is null;

alter table public.content_repost_events enable row level security;
revoke all on table public.content_repost_events from anon, authenticated;
revoke all on sequence public.content_repost_events_id_seq from anon, authenticated;

comment on table public.content_repost_events is
  'HOM-10 §217–§224: eventi di dominio SIMPLE_REPOST_CREATED, REFERENCED_POST_CREATED, SIMPLE_REPOST_REMOVED. Outbox senza consumatore; nessuna notifica utente.';

-- 1c. La reference sul Post (§88): due colonne sulla riga che già porta mention
-- e link. Entrambe null o entrambe valorizzate; solo tipi che hanno Post; solo
-- contenuti canonici ripostabili.
alter table public.content_post_extras
  add column if not exists referenced_content_type text,
  add column if not exists referenced_content_id   uuid;

alter table public.content_post_extras
  drop constraint if exists content_post_extras_reference_check;
alter table public.content_post_extras
  add constraint content_post_extras_reference_check check (
    (referenced_content_type is null) = (referenced_content_id is null)
    and (
      referenced_content_type is null
      or (referenced_content_type in ('profile_post', 'club_media', 'media_profile', 'fan_media')
          and content_type in ('profile_post', 'club_media', 'media_profile'))
    )
  );

-- Dal contenuto ai Post che lo referenziano (metrica Repost, HOM-05 §214).
create index if not exists content_post_extras_reference_idx
  on public.content_post_extras (referenced_content_type, referenced_content_id)
  where referenced_content_id is not null;

-- 1d. Scrittura diretta delle due colonne CHIUSA ai client (§47, §160). Come
-- content_post_children_client_guard (HOM-06.1): funzione INVOKER di proposito,
-- dentro una definer current_user sarebbe il proprietario. Le RPC girano come
-- owner e passano; un client (anon/authenticated) riceve 42501 se tenta di
-- inserire o cambiare la reference, anche su un tipo non-Post dove le policy HOM-02
-- gli lascerebbero scrivere le extras.
create or replace function public.content_post_extras_reference_client_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if (tg_op = 'INSERT' and new.referenced_content_id is not null)
     or (tg_op = 'UPDATE'
         and (new.referenced_content_type is distinct from old.referenced_content_type
              or new.referenced_content_id is distinct from old.referenced_content_id)) then
    raise exception 'repost_reference_direct_write_closed' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.content_post_extras_reference_client_guard() from public;
revoke execute on function public.content_post_extras_reference_client_guard() from anon, authenticated;

drop trigger if exists content_post_extras_reference_client_guard on public.content_post_extras;
create trigger content_post_extras_reference_client_guard
before insert or update on public.content_post_extras
for each row execute function public.content_post_extras_reference_client_guard();

-- 1e. Immutabilità (§47, §160–§163), per QUALUNQUE ruolo, RPC comprese:
--   * una reference già scritta non cambia e non si toglie;
--   * una reference nuova si imposta solo finché il Post non è pubblicato (una
--     bozza, un programmato, un fallito): un Post pubblicato non ne acquista una.
-- La delete della riga extras NON è bloccata: la sposta la bozza che cambia
-- tabella (la vecchia riga sparisce con il padre) e la cancellazione fisica del
-- contenuto la porta via con sé. Definer: legge il padre con footme_content_load.
create or replace function public.content_post_extras_reference_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  l record;
begin
  if tg_op = 'UPDATE' and old.referenced_content_id is not null then
    if new.referenced_content_type is distinct from old.referenced_content_type
       or new.referenced_content_id is distinct from old.referenced_content_id then
      raise exception 'repost_reference_immutable' using errcode = '22023';
    end if;
    return new;
  end if;

  if new.referenced_content_id is not null then
    select * into l from public.footme_content_load(new.content_type, new.post_id, false);
    if found and l.l_status in ('published', 'deleted') then
      raise exception 'repost_reference_immutable' using errcode = '22023', detail = 'published';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.content_post_extras_reference_immutable() from public;
revoke execute on function public.content_post_extras_reference_immutable() from anon, authenticated;

drop trigger if exists content_post_extras_reference_immutable on public.content_post_extras;
create trigger content_post_extras_reference_immutable
before insert or update of referenced_content_type, referenced_content_id on public.content_post_extras
for each row execute function public.content_post_extras_reference_immutable();


-- ============================================================
-- SEZIONE 2 — regole (una volta sola)
-- ============================================================

-- 2a. can_repost (§32, §225, D1): l'attore può ripostare COME questa identità?
-- Derivata da content_create = can_post di footme_publishing_identities (persona
-- su se stessa, Società titolare + delegati con content_create, Media titolare).
-- UNICA funzione: fetch_repost_state, repost_content, remove_repost, il blocker e
-- il payload leggono tutti da qui. Una chiave di catalogo futura si cambia SOLO qui.
create or replace function public.footme_can_repost(p_actor uuid, p_identity_type text, p_identity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_actor is not null
     and p_identity_type is not null
     and p_identity_id is not null
     and exists (
       select 1
       from public.footme_publishing_identities(p_actor) i
       where i.c_type = p_identity_type
         and i.c_id = p_identity_id
         and i.can_post);
$$;

revoke all on function public.footme_can_repost(uuid, text, uuid) from public;
revoke execute on function public.footme_can_repost(uuid, text, uuid) from anon, authenticated;

-- 2b. Il contenuto è un bersaglio valido per l'attore ADESSO (§42–§43, §153,
-- §228)? Tipo canonico ammesso (mai i «tribuna») E leggibile: pubblicato, non
-- programmato, non eliminato, non bloccato col publisher. Nessun flag «non
-- redistribuibile» esiste nel dominio (§43): in V1 un contenuto leggibile è
-- ripostabile.
create or replace function public.footme_repost_target_ok(p_actor uuid, p_content_type text, p_content_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_actor is not null
     and p_content_id is not null
     and p_content_type in ('profile_post', 'club_media', 'media_profile', 'fan_media')
     and public.footme_content_readable(p_actor, p_content_type, p_content_id);
$$;

revoke all on function public.footme_repost_target_ok(uuid, text, uuid) from public;
revoke execute on function public.footme_repost_target_ok(uuid, text, uuid) from anon, authenticated;

-- 2c. Autore e owner di un contenuto (per l'evento e per congelarli sul repost).
-- Autore = identità che pubblica (society | media | person); owner = il profilo
-- autore per persona e Media, NULL per una Società (il titolare non si legge qui:
-- nessuna lettura di `clubs` da una definer). Zero righe = non leggibile.
create or replace function public.footme_repost_target_author(p_content_type text, p_content_id uuid)
returns table (a_type text, a_id uuid, a_owner uuid)
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when fci.publisher_type = 'club' then 'society'
      when fci.content_type in ('media_profile', 'media_tribuna') then 'media'
      else 'person'
    end,
    fci.publisher_id,
    case when fci.publisher_type = 'club' then null::uuid else fci.publisher_id end
  from public.feed_content_index fci
  where fci.content_type = p_content_type
    and fci.post_id = p_content_id;
$$;

revoke all on function public.footme_repost_target_author(text, uuid) from public;
revoke execute on function public.footme_repost_target_author(text, uuid) from anon, authenticated;

-- 2d. La reference di un Post come la vede il VIEWER (§45–§46, §56–§60, §173–§175):
-- null se il Post non ne ha; altrimenti {content_type, content_id, available,
-- snapshot}. `snapshot` è lo snapshot di HOM-09 (`footme_share_snapshot`) più il
-- booleano `has_reference`, e SOLO se il viewer legge l'originale ADESSO; altrimenti
-- null (eliminato, non pubblicato, bloccato: §174, nessuna informazione tecnica).
-- UN livello: la reference dell'originale non entra mai (§57–§60, §184).
create or replace function public.footme_repost_reference_json(
  p_viewer       uuid,
  p_content_type text,
  p_content_id   uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_content_id is null or p_content_type is null then null
    else jsonb_build_object(
      'content_type', p_content_type,
      'content_id',   p_content_id,
      'available',    ok.v,
      'snapshot',     case when ok.v then
        public.footme_share_snapshot(p_content_type, p_content_id)
        || jsonb_build_object('has_reference', exists (
             select 1 from public.content_post_extras e
             where e.content_type = p_content_type
               and e.post_id = p_content_id
               and e.referenced_content_id is not null))
      end)
  end
  from (
    select (p_content_type in ('profile_post', 'club_media', 'media_profile', 'fan_media')
            and public.footme_content_readable(p_viewer, p_content_type, p_content_id)) as v
  ) ok;
$$;

revoke all on function public.footme_repost_reference_json(uuid, text, uuid) from public;
revoke execute on function public.footme_repost_reference_json(uuid, text, uuid) from anon, authenticated;

-- 2e. Scrive un evento di dominio, salvo azione su un proprio contenuto (§221):
-- stesso profilo destinatario/attore, oppure stessa identità autore/attrice.
create or replace function public.footme_repost_emit_event(
  p_kind          text,
  p_actor         uuid,
  p_actor_type    text,
  p_actor_id      uuid,
  p_target_type   text,
  p_target_id     uuid,
  p_author_type   text,
  p_author_id     uuid,
  p_owner         uuid,
  p_repost_id     uuid,
  p_post_type     text,
  p_post_id       uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_owner is not distinct from p_actor
     or (p_author_type is not null and p_author_type = p_actor_type and p_author_id = p_actor_id) then
    return;
  end if;

  insert into public.content_repost_events
    (event_type, recipient_profile_id, actor_profile_id, actor_identity_type, actor_identity_id,
     target_content_type, target_content_id, target_author_type, target_author_id,
     repost_id, post_content_type, post_id)
  values
    (p_kind, p_owner, p_actor, p_actor_type, p_actor_id,
     p_target_type, p_target_id, p_author_type, p_author_id,
     p_repost_id, p_post_type, p_post_id);
end;
$$;

revoke all on function public.footme_repost_emit_event(text, uuid, text, uuid, text, uuid, text, uuid, uuid, uuid, text, uuid) from public;
revoke execute on function public.footme_repost_emit_event(text, uuid, text, uuid, text, uuid, text, uuid, uuid, uuid, text, uuid) from anon, authenticated;

-- 2f. L'originale non c'è più (§169, §171, §350): i Simple Repost attivi cadono
-- (`invalidated`) quando la riga passa a `deleted` (HOM-04 non ha ripristino) o
-- viene cancellata fisicamente. Stesso schema di saved_cleanup_on_content_delete.
-- Il Post con riferimento NON cambia (§172, §351): la sua reference resta e la
-- lettura la mostra come non disponibile.
create or replace function public.content_repost_invalidate_on_original_gone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := case when tg_op = 'DELETE' then old.id else new.id end;
begin
  update public.content_reposts r
     set status = 'invalidated', removed_at = now()
   where r.content_type = tg_argv[0]
     and r.content_id = v_id
     and r.status = 'active';
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.content_repost_invalidate_on_original_gone() from public;
revoke execute on function public.content_repost_invalidate_on_original_gone() from anon, authenticated;

drop trigger if exists content_repost_invalidate on public.club_media_posts;
create trigger content_repost_invalidate after update of status on public.club_media_posts
  for each row when (new.status = 'deleted' and old.status is distinct from 'deleted')
  execute function public.content_repost_invalidate_on_original_gone('club_media');
drop trigger if exists content_repost_invalidate_del on public.club_media_posts;
create trigger content_repost_invalidate_del after delete on public.club_media_posts
  for each row execute function public.content_repost_invalidate_on_original_gone('club_media');

drop trigger if exists content_repost_invalidate on public.media_profile_posts;
create trigger content_repost_invalidate after update of status on public.media_profile_posts
  for each row when (new.status = 'deleted' and old.status is distinct from 'deleted')
  execute function public.content_repost_invalidate_on_original_gone('media_profile');
drop trigger if exists content_repost_invalidate_del on public.media_profile_posts;
create trigger content_repost_invalidate_del after delete on public.media_profile_posts
  for each row execute function public.content_repost_invalidate_on_original_gone('media_profile');

drop trigger if exists content_repost_invalidate on public.fan_media_posts;
create trigger content_repost_invalidate after update of status on public.fan_media_posts
  for each row when (new.status = 'deleted' and old.status is distinct from 'deleted')
  execute function public.content_repost_invalidate_on_original_gone('fan_media');
drop trigger if exists content_repost_invalidate_del on public.fan_media_posts;
create trigger content_repost_invalidate_del after delete on public.fan_media_posts
  for each row execute function public.content_repost_invalidate_on_original_gone('fan_media');

drop trigger if exists content_repost_invalidate on public.profile_posts;
create trigger content_repost_invalidate after update of status on public.profile_posts
  for each row when (new.status = 'deleted' and old.status is distinct from 'deleted')
  execute function public.content_repost_invalidate_on_original_gone('profile_post');
drop trigger if exists content_repost_invalidate_del on public.profile_posts;
create trigger content_repost_invalidate_del after delete on public.profile_posts
  for each row execute function public.content_repost_invalidate_on_original_gone('profile_post');

-- 2g. REFERENCED_POST_CREATED (§217, §220, §223): quando un Post con reference
-- diventa `published` (submit_content «ora» e job programmato passano entrambi da
-- un UPDATE di status). Destinatario: l'autore/owner del target, salvo self.
create or replace function public.content_repost_referenced_post_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ex     public.content_post_extras;
  v_atype  text;
  v_aid    uuid;
  v_owner  uuid;
  v_actor  uuid;
  v_it     text;
  v_ii     uuid;
begin
  select * into v_ex from public.content_post_extras x
  where x.content_type = tg_argv[0] and x.post_id = new.id;

  if v_ex.referenced_content_id is null then
    return new;
  end if;

  select a.a_type, a.a_id, a.a_owner into v_atype, v_aid, v_owner
  from public.footme_repost_target_author(v_ex.referenced_content_type, v_ex.referenced_content_id) a;

  if tg_argv[0] = 'profile_post' then
    v_it := 'person'; v_ii := new.profile_id; v_actor := new.profile_id;
  elsif tg_argv[0] = 'club_media' then
    v_it := 'society'; v_ii := new.club_id; v_actor := new.created_by_profile_id;
  else
    v_it := 'media'; v_ii := new.media_profile_id; v_actor := new.created_by_profile_id;
  end if;

  perform public.footme_repost_emit_event(
    'REFERENCED_POST_CREATED', coalesce(auth.uid(), v_actor), v_it, v_ii,
    v_ex.referenced_content_type, v_ex.referenced_content_id, v_atype, v_aid, v_owner,
    null, tg_argv[0], new.id);

  return new;
end;
$$;

revoke all on function public.content_repost_referenced_post_published() from public;
revoke execute on function public.content_repost_referenced_post_published() from anon, authenticated;

drop trigger if exists content_repost_referenced_event on public.profile_posts;
create trigger content_repost_referenced_event after update of status on public.profile_posts
  for each row when (new.status = 'published' and old.status is distinct from 'published')
  execute function public.content_repost_referenced_post_published('profile_post');
drop trigger if exists content_repost_referenced_event on public.club_media_posts;
create trigger content_repost_referenced_event after update of status on public.club_media_posts
  for each row when (new.status = 'published' and old.status is distinct from 'published')
  execute function public.content_repost_referenced_post_published('club_media');
drop trigger if exists content_repost_referenced_event on public.media_profile_posts;
create trigger content_repost_referenced_event after update of status on public.media_profile_posts
  for each row when (new.status = 'published' and old.status is distinct from 'published')
  execute function public.content_repost_referenced_post_published('media_profile');

-- ============================================================
-- SEZIONE 3 — RPC client
-- ============================================================

-- 3a. fetch_repost_state (§2, §26–§41, §122, §333): per il pannello Condividi e il
-- composer Repost. {repostable, identities[]}.
--   repostable = tipo canonico ammesso + leggibile dal viewer ADESSO (§42–§43).
--   identities = le identità di footme_publishing_identities (stesso ordine del
--     contesto del composer: rank, nome, id), ciascuna con le tre capability
--     rivalidate qui (§35) e `has_simple_repost` (§122: un Simple Repost ATTIVO di
--     quella identità su questo contenuto → «Repost ✓»).
-- Un'identità senza can_repost resta in elenco con can_repost=false: il client
-- non la offre in «Reposta come» (§30) ma sa spiegare la perdita (§38–§41).
create or replace function public.fetch_repost_state(
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
  v_uid uuid := auth.uid();
  v_ok  boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_ok := p_content_id is not null
          and p_content_type in ('profile_post', 'club_media', 'media_profile', 'fan_media')
          and public.footme_content_readable(v_uid, p_content_type, p_content_id);

  return jsonb_build_object(
    'repostable', v_ok,
    -- Lo snapshot dell'originale per la card incorporata del composer (§45–§46): lo stesso
    -- di footme_repost_reference_json (HOM-09 + has_reference), null se non ripostabile.
    'snapshot', case when v_ok then
      public.footme_share_snapshot(p_content_type, p_content_id)
      || jsonb_build_object('has_reference', exists (
           select 1 from public.content_post_extras e
           where e.content_type = p_content_type
             and e.post_id = p_content_id
             and e.referenced_content_id is not null))
    end,
    'identities', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'identity_type',        x.card ->> 'identity_type',
                 'identity_id',          x.card -> 'identity_id',
                 'display_name',         x.card -> 'name',
                 'avatar_url',           x.card -> 'avatar_url',
                 'is_verified',          x.card -> 'is_verified',
                 'context_label',        x.card -> 'context_label',
                 'can_repost',           x.can_repost,
                 'can_publish_post',     x.can_post,
                 'can_schedule_content', x.can_schedule,
                 'has_simple_repost',    x.has_rp)
               order by x.c_rank, x.card ->> 'name', x.card ->> 'identity_id')
      from (
        select
          i.c_rank, i.can_post, i.can_schedule,
          public.footme_can_repost(v_uid, i.c_type, i.c_id) as can_repost,
          public.footme_composer_identity_card(i.c_type, i.c_id) as card,
          (v_ok and exists (
             select 1 from public.content_reposts r
             where r.status = 'active'
               and r.reposter_identity_type = i.c_type
               and r.reposter_identity_id = i.c_id
               and r.content_type = p_content_type
               and r.content_id = p_content_id)) as has_rp
        from public.footme_publishing_identities(v_uid) i
      ) x
      where x.card is not null),
      '[]'::jsonb));
end;
$$;

revoke all on function public.fetch_repost_state(text, uuid) from public;
revoke execute on function public.fetch_repost_state(text, uuid) from anon;
grant execute on function public.fetch_repost_state(text, uuid) to authenticated;

comment on function public.fetch_repost_state(text, uuid) is
  'HOM-10 §2, §26–§41, §122: {repostable, snapshot, identities[{identity_type, identity_id, display_name, avatar_url, is_verified, context_label, can_repost, can_publish_post, can_schedule_content, has_simple_repost}]} per il pannello Condividi e il composer Repost.';

-- 3b. repost_content (§61–§63, §69–§72, §225, §228–§229, §234, §236): Simple Repost.
-- Esito {status, repost_id}:
--   created             creato ORA (o replay della stessa operation_key, §234);
--   already_reposted    l'identità ha già un Simple Repost attivo: restituisce
--                       l'id canonico (multi-device, §236–§237), mai un secondo;
--   content_unavailable originale non leggibile ora: bozza, programmato, eliminato,
--                       bloccato, tribuna (§43, §228–§229);
--   forbidden           l'attore non può ripostare come questa identità (§225).
-- Un input malformato (chiave, tipo identità, tipo contenuto sconosciuto) è un
-- errore 22023: è un bug del chiamante, non un esito di flusso. Ripostare un
-- proprio contenuto è consentito (nessun evento, §221). Nessun Draft (§137).
create or replace function public.repost_content(
  p_operation_key uuid,
  p_identity_type text,
  p_identity_id   uuid,
  p_content_type  text,
  p_content_id    uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_row  public.content_reposts;
  v_id   uuid;
  v_atype text;
  v_aid   uuid;
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_operation_key is null
     or p_identity_type is null or p_identity_type not in ('person', 'society', 'media')
     or p_identity_id is null
     or p_content_type is null
     or p_content_type not in ('profile_post', 'club_media', 'media_profile', 'fan_media',
                               'fan_tribuna', 'media_tribuna')
     or p_content_id is null then
    raise exception 'repost_invalid_request' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('repost_op:' || v_uid::text || ':' || p_operation_key::text));

  -- Retry della stessa operazione: stesso esito, nessuna rivalidazione (se nel
  -- frattempo il repost è stato tolto, un tentativo ritardato non lo resuscita).
  select * into v_row from public.content_reposts r
  where r.actor_profile_id = v_uid and r.operation_key = p_operation_key;
  if found then
    if v_row.reposter_identity_type <> p_identity_type
       or v_row.reposter_identity_id <> p_identity_id
       or v_row.content_type <> p_content_type
       or v_row.content_id <> p_content_id then
      raise exception 'repost_operation_conflict' using errcode = '40001';
    end if;
    return jsonb_build_object('status', 'created', 'repost_id', v_row.id);
  end if;

  if not public.footme_can_repost(v_uid, p_identity_type, p_identity_id) then
    return jsonb_build_object('status', 'forbidden', 'repost_id', null);
  end if;

  if not public.footme_repost_target_ok(v_uid, p_content_type, p_content_id) then
    return jsonb_build_object('status', 'content_unavailable', 'repost_id', null);
  end if;

  select r.id into v_id from public.content_reposts r
  where r.status = 'active'
    and r.reposter_identity_type = p_identity_type
    and r.reposter_identity_id = p_identity_id
    and r.content_type = p_content_type
    and r.content_id = p_content_id;
  if found then
    return jsonb_build_object('status', 'already_reposted', 'repost_id', v_id);
  end if;

  select a.a_type, a.a_id, a.a_owner into v_atype, v_aid, v_owner
  from public.footme_repost_target_author(p_content_type, p_content_id) a;

  v_id := null;
  insert into public.content_reposts
    (reposter_identity_type, reposter_identity_id, actor_profile_id, content_type, content_id,
     operation_key, target_author_type, target_author_id, target_owner_profile_id)
  values
    (p_identity_type, p_identity_id, v_uid, p_content_type, p_content_id,
     p_operation_key, v_atype, v_aid, v_owner)
  on conflict do nothing
  returning id into v_id;

  -- Un'altra transazione ha vinto l'unico parziale fra la select e l'insert.
  if v_id is null then
    select r.id into v_id from public.content_reposts r
    where r.status = 'active'
      and r.reposter_identity_type = p_identity_type
      and r.reposter_identity_id = p_identity_id
      and r.content_type = p_content_type
      and r.content_id = p_content_id;
    return jsonb_build_object('status', 'already_reposted', 'repost_id', v_id);
  end if;

  perform public.footme_repost_emit_event(
    'SIMPLE_REPOST_CREATED', v_uid, p_identity_type, p_identity_id,
    p_content_type, p_content_id, v_atype, v_aid, v_owner, v_id, null, null);

  return jsonb_build_object('status', 'created', 'repost_id', v_id);
end;
$$;

revoke all on function public.repost_content(uuid, text, uuid, text, uuid) from public;
revoke execute on function public.repost_content(uuid, text, uuid, text, uuid) from anon;
grant execute on function public.repost_content(uuid, text, uuid, text, uuid) to authenticated;

comment on function public.repost_content(uuid, text, uuid, text, uuid) is
  'HOM-10 §61–§72, §225–§236: Simple Repost. {status: created | already_reposted | content_unavailable | forbidden, repost_id}. Idempotente per operation_key e per (identità, contenuto) attivo. 22023 repost_invalid_request per input malformato.';

-- 3b-bis. remove_repost (§128–§131, §238): «Rimuovi repost». Idempotente: la
-- seconda chiamata risponde not_found e il client la tratta come successo (§238).
-- Non tocca mai l'originale (§131): Like, Commenti, Salvati, Condivisioni e
-- contenuto non vengono letti né scritti.
create or replace function public.remove_repost(
  p_identity_type text,
  p_identity_id   uuid,
  p_content_type  text,
  p_content_id    uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.content_reposts;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_identity_type is null or p_identity_type not in ('person', 'society', 'media')
     or p_identity_id is null
     or p_content_type is null
     or p_content_type not in ('profile_post', 'club_media', 'media_profile', 'fan_media')
     or p_content_id is null then
    raise exception 'repost_invalid_request' using errcode = '22023';
  end if;

  if not public.footme_can_repost(v_uid, p_identity_type, p_identity_id) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  update public.content_reposts r
     set status = 'removed', removed_at = now()
   where r.status = 'active'
     and r.reposter_identity_type = p_identity_type
     and r.reposter_identity_id = p_identity_id
     and r.content_type = p_content_type
     and r.content_id = p_content_id
  returning * into v_row;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  perform public.footme_repost_emit_event(
    'SIMPLE_REPOST_REMOVED', v_uid, p_identity_type, p_identity_id,
    p_content_type, p_content_id, v_row.target_author_type, v_row.target_author_id,
    v_row.target_owner_profile_id, v_row.id, null, null);

  return jsonb_build_object('status', 'removed');
end;
$$;

revoke all on function public.remove_repost(text, uuid, text, uuid) from public;
revoke execute on function public.remove_repost(text, uuid, text, uuid) from anon;
grant execute on function public.remove_repost(text, uuid, text, uuid) to authenticated;

comment on function public.remove_repost(text, uuid, text, uuid) is
  'HOM-10 §128–§131, §238: rimuove il Simple Repost attivo di un identità. {status: removed | not_found | forbidden}; idempotente (not_found = già rimosso).';


-- ============================================================
-- SEZIONE 4 — letture comuni: Feed Seguiti e Insights
-- ============================================================

-- 4a. I Simple Repost che il Feed Seguiti mostra al viewer, aggregati per
-- ORIGINALE (§73, §185–§187, §189): UNA riga per originale con il reposter
-- rappresentativo (il più recente fra quelli seguiti) e quanti altri ce ne sono.
-- Definizione UNICA: la usano fetch_home_feed_page e fetch_home_feed_updates, quindi
-- pagina e banner «Nuovi contenuti» non possono divergere.
--   * reposter SEGUITO dal viewer (profile_follows / club_follows) — D2;
--   * non il viewer né una sua identità (un wrapper i cui reposter sono solo il
--     viewer non esiste) e non un repost fatto dal viewer per conto di altri;
--   * reposter visibile (esistente, Società non sospesa/rifiutata/segnalata, non
--     bloccato in nessuna direzione: footme_like_actor_visible);
--   * originale leggibile dal viewer ADESSO (§170: mai un wrapper vuoto);
--   * created_at <= p_as_of: lo snapshot della pagina è congelato (cursore).
-- `g_additional` = gli ALTRI reposter seguiti e visibili (non tutti: §187 ha solo
-- il testo, mai un avatar stack, §188).
create or replace function public.footme_feed_repost_groups(p_viewer uuid, p_as_of timestamptz)
returns table (
  g_content_type  text,
  g_post_id       uuid,
  g_published_at  timestamptz,
  g_reposter_type text,
  g_reposter_id   uuid,
  g_additional    integer
)
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select r.id, r.content_type, r.content_id, r.reposter_identity_type, r.reposter_identity_id, r.created_at
    from public.content_reposts r
    where p_viewer is not null
      and r.status = 'active'
      and r.created_at <= p_as_of
      and r.actor_profile_id <> p_viewer
      and case
            when r.reposter_identity_type = 'society'
              then exists (select 1 from public.club_follows f
                           where f.profile_id = p_viewer and f.club_id = r.reposter_identity_id)
            else exists (select 1 from public.profile_follows f
                         where f.follower_profile_id = p_viewer
                           and f.followed_profile_id = r.reposter_identity_id)
          end
      and not exists (
        select 1 from public.footme_interaction_identities(p_viewer) i
        where i.c_type = r.reposter_identity_type and i.c_id = r.reposter_identity_id)
      and public.footme_like_actor_visible(p_viewer, r.reposter_identity_type, r.reposter_identity_id)
      and public.footme_content_readable(p_viewer, r.content_type, r.content_id)
  ),
  ranked as (
    select
      e.*,
      row_number() over (partition by e.content_type, e.content_id order by e.created_at desc, e.id desc) as rn,
      count(*)     over (partition by e.content_type, e.content_id) as n
    from eligible e
  )
  select k.content_type, k.content_id, k.created_at, k.reposter_identity_type, k.reposter_identity_id, (k.n - 1)::integer
  from ranked k
  where k.rn = 1;
$$;

revoke all on function public.footme_feed_repost_groups(uuid, timestamptz) from public;
revoke execute on function public.footme_feed_repost_groups(uuid, timestamptz) from anon, authenticated;

-- 4b. Conteggi della metrica Repost di HOM-05 (§207–§214), per un contenuto:
--   simple     = Simple Repost attivi (di reposter ancora esistenti: stessa regola
--                dei Mi piace per Insights, viewer null);
--   referenced = Post PUBBLICATI (non eliminati) che referenziano DIRETTAMENTE il
--                contenuto (§214: un Repost di un Post con reference alimenta il
--                target immediato, non l'originale più profondo).
-- null/null per i tipi non ripostabili (fan_tribuna, media_tribuna): riga nascosta.
create or replace function public.footme_content_repost_counts(p_content_type text, p_content_id uuid)
returns table (c_simple bigint, c_referenced bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)
       from public.content_reposts r
      where r.status = 'active'
        and r.content_type = p_content_type
        and r.content_id = p_content_id
        and public.footme_like_actor_visible(null, r.reposter_identity_type, r.reposter_identity_id)),
    (select count(*)
       from public.content_post_extras e
      where e.referenced_content_type = p_content_type
        and e.referenced_content_id = p_content_id
        and (
          (e.content_type = 'profile_post'  and exists (select 1 from public.profile_posts x where x.id = e.post_id and x.status = 'published'))
          or (e.content_type = 'club_media' and exists (select 1 from public.club_media_posts x where x.id = e.post_id and x.status = 'published'))
          or (e.content_type = 'media_profile' and exists (select 1 from public.media_profile_posts x where x.id = e.post_id and x.status = 'published'))))
  where p_content_type in ('profile_post', 'club_media', 'media_profile', 'fan_media');
$$;

revoke all on function public.footme_content_repost_counts(text, uuid) from public;
revoke execute on function public.footme_content_repost_counts(text, uuid) from anon, authenticated;


-- ============================================================
-- SEZIONE 5 — riemissioni dalla definizione più recente
--
-- Ogni funzione sotto è estratta dal file indicato (l'ultima definizione nel
-- repository, verificata con grep su tutte le migrazioni) e modificata per
-- sostituzione esatta: ogni ancora compare UNA volta nel testo di partenza.
-- La sola modifica è quella dichiarata nel commento HOM-10 dentro la funzione.
-- ============================================================

-- 5. footme_post_text_is_meaningful (sorgente: 20261120090000_home_post_composer.sql)
create or replace function public.footme_post_text_is_meaningful(
  p_body     text,
  p_mentions jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_off    integer[] := public.footme_utf16_offsets(p_body);
  v_rest   text := '';
  v_from   integer := 0;
  v_e      jsonb;
  v_cs     integer;
  v_ce     integer;
begin
  for v_e in
    select e from jsonb_array_elements(coalesce(p_mentions, '[]'::jsonb)) e
    order by (e ->> 'start')::int
  loop
    v_cs := array_position(v_off, (v_e ->> 'start')::int) - 1;
    v_ce := array_position(v_off, (v_e ->> 'end')::int) - 1;
    if v_cs is null or v_ce is null or v_cs < v_from then
      continue;
    end if;
    v_rest := v_rest || substr(coalesce(p_body, ''), v_from + 1, v_cs - v_from);
    v_from := v_ce;
  end loop;

  v_rest := v_rest || substr(coalesce(p_body, ''), v_from + 1);
  -- HOM-10 §62: «caratteri invisibili non significativi». Oltre agli spazi (\s: che nel
  -- motore regex non comprende NBSP né i caratteri di larghezza zero), si tolgono i
  -- caratteri di formattazione invisibili: NBSP, soft hyphen, ALM, mongolian vowel
  -- separator, zero-width (U+200B–U+200F), separatori di riga/paragrafo e controlli
  -- bidi (U+2028–U+202F), word joiner e controlli invisibili (U+205F–U+206F),
  -- ideographic space, hangul filler, variation selector (U+FE00–U+FE0F), BOM.
  -- Un testo che contiene anche un solo carattere visibile (un emoji incluso) resta
  -- significativo. Vale per Post, bozze, programmati, commenti: UNA regola.
  return regexp_replace(
           v_rest,
           '[\s\u00a0\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202f\u205f-\u206f\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0]',
           '', 'g') <> '';
end;
$$;

revoke all on function public.footme_post_text_is_meaningful(text, jsonb) from public;
revoke execute on function public.footme_post_text_is_meaningful(text, jsonb) from anon, authenticated;

-- 5. footme_content_persist_post (sorgente: 20261121090000_home_editorial_drafts_scheduling.sql)
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
  v_ref      jsonb;
  v_rt       text;
  v_rid      uuid;
  v_keep_t   text;
  v_keep_id  uuid;
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

  -- HOM-10 §88, §139, §160–§163: la reference all'originale.
  --   * chiave assente o null = «non toccarla»: l'autosave e update_post non la
  --     perdono mai (non è un allegato rimovibile, §162);
  --   * una reference già salvata non cambia: un valore diverso è
  --     repost_reference_immutable (il trigger content_post_extras_reference_immutable
  --     è la rete di sicurezza per chi scrive senza passare di qui);
  --   * la PRIMA volta (bozza) l'originale dev'essere un target valido per l'attore
  --     ora (§153, §287): repost_reference_unavailable. Dopo, un originale sparito
  --     non impedisce di salvare il testo (§157, §230): lo giudica il blocker alla
  --     pubblicazione.
  v_ref := p_payload -> 'reference';
  select x.referenced_content_type, x.referenced_content_id into v_keep_t, v_keep_id
  from public.content_post_extras x
  where x.content_type = p_content_type and x.post_id = p_id;

  if v_ref is not null and jsonb_typeof(v_ref) <> 'null' then
    if jsonb_typeof(v_ref) <> 'object'
       or coalesce(v_ref ->> 'content_type', '') not in ('profile_post', 'club_media', 'media_profile', 'fan_media') then
      raise exception 'post_invalid_content' using errcode = '22023', detail = 'reference';
    end if;
    begin
      v_rid := (v_ref ->> 'content_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'post_invalid_content' using errcode = '22023', detail = 'reference';
    end;
    v_rt := v_ref ->> 'content_type';

    if v_keep_id is not null then
      if v_keep_t is distinct from v_rt or v_keep_id is distinct from v_rid then
        raise exception 'repost_reference_immutable' using errcode = '22023';
      end if;
    else
      if not public.footme_repost_target_ok(p_actor, v_rt, v_rid) then
        raise exception 'repost_reference_unavailable' using errcode = '22023';
      end if;
      v_keep_t := v_rt;
      v_keep_id := v_rid;
    end if;
  end if;

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

  if jsonb_array_length(v_mentions) > 0 or jsonb_typeof(v_target) = 'object' or v_keep_id is not null then
    insert into public.content_post_extras as x
      (content_type, post_id, mentions, link_preview, link_target,
       referenced_content_type, referenced_content_id)
    values
      (p_content_type, p_id, v_mentions,
       case when jsonb_typeof(v_preview) = 'object' then v_preview end,
       case when jsonb_typeof(v_target) = 'object' then v_target end,
       v_keep_t, v_keep_id)
    on conflict (content_type, post_id) do update
      set mentions     = excluded.mentions,
          link_preview = excluded.link_preview,
          link_target  = excluded.link_target,
          referenced_content_type = excluded.referenced_content_type,
          referenced_content_id   = excluded.referenced_content_id;
  else
    delete from public.content_post_extras x
    where x.content_type = p_content_type and x.post_id = p_id;
  end if;

  perform public.footme_content_replace_tags(p_content_type, p_id, v_tags, false);
end;
$$;

revoke all on function public.footme_content_persist_post(uuid, text, uuid, jsonb, integer) from public;
revoke execute on function public.footme_content_persist_post(uuid, text, uuid, jsonb, integer) from anon, authenticated;

-- 5. footme_content_clone_children (sorgente: 20261121090000_home_editorial_drafts_scheduling.sql)
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

  insert into public.content_post_extras
    (content_type, post_id, mentions, link_preview, link_target,
     referenced_content_type, referenced_content_id)
  select p_to_type, p_to_id, x.mentions, x.link_preview, x.link_target,
         x.referenced_content_type, x.referenced_content_id
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

-- 5. footme_content_blocker (sorgente: 20261121090000_home_editorial_drafts_scheduling.sql)
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

    -- HOM-10 §153–§155, §225–§227, §231, §287: la reference dev'essere ancora un
    -- target valido per l'ATTORE (esiste, è pubblicata, la legge, è ripostabile) e
    -- l'identità deve poter ripostare (can_repost). Vale per ora, programmazione e
    -- job; NON per la modifica di un Post già pubblicato (§172: sopravvive
    -- all'originale). Una reference non è mai contenuto significativo: il controllo
    -- 'empty' qui sopra non la conta.
    if p_mode <> 'edit' and v_ex.referenced_content_id is not null
       and not (public.footme_can_repost(p_actor, l.l_identity_type, l.l_identity_id)
                and public.footme_repost_target_ok(p_actor, v_ex.referenced_content_type, v_ex.referenced_content_id)) then
      return 'reference_unavailable';
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

-- 5. footme_content_raise_blocker (sorgente: 20261121090000_home_editorial_drafts_scheduling.sql)
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
    when 'reference_unavailable' then
      raise exception 'repost_reference_unavailable' using errcode = '22023';
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

-- 5. footme_content_blocker_reason (sorgente: 20261121090000_home_editorial_drafts_scheduling.sql)
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
    when p_code = 'reference_unavailable' then 'reference'
    when p_code = 'rights' then 'rights'
    when p_code = 'source_required' then 'source'
    when p_code = 'source_invalid' then 'source'
    when p_code = 'duplicate' then 'source'
    else 'capability'
  end;
$$;

revoke all on function public.footme_content_blocker_reason(text) from public;
revoke execute on function public.footme_content_blocker_reason(text) from anon, authenticated;

-- 5. footme_post_payloads (sorgente: 20261123090000_home_comments.sql)
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

  -- HOM-10 §32, §44: can_repost richiede almeno un'identità che può ripostare
  -- (footme_can_repost, D1) oltre a un contenuto ripostabile e leggibile.
  repost_identity as (
    select exists (
      select 1
      from public.footme_publishing_identities(p_viewer) i
      where public.footme_can_repost(p_viewer, i.c_type, i.c_id)) as yes
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
        'can_repost',        a.content_type in ('club_media', 'fan_media', 'profile_post', 'media_profile')
                             and rid.yes
                             and public.footme_content_readable(p_viewer, a.content_type, a.post_id),
        'can_save',          true,
        'can_report',        not a.is_own,
        'can_edit',          coalesce(cr.r_can_edit, false),
        'can_delete',        coalesce(cr.r_can_delete, false),
        'can_view_insights', coalesce(cr.r_can_view_insights, false)
      ),
      -- HOM-10 §45–§46, §88: la reference del Post (null se non ne ha), un livello solo.
      'reference', public.footme_repost_reference_json(p_viewer, ex.referenced_content_type, ex.referenced_content_id),
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
  cross join repost_identity rid
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

-- 5. fetch_home_feed_page (sorgente: 20261122090000_home_likes_saved.sql)
CREATE OR REPLACE FUNCTION public.fetch_home_feed_page(p_tab text DEFAULT 'per_te'::text, p_as_of timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_bucket smallint DEFAULT NULL::smallint, p_cursor_published_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_uid text DEFAULT NULL::text, p_page_index integer DEFAULT 0, p_limit integer DEFAULT 10)
 RETURNS TABLE(item_uid text, item_type text, rank_position integer, rank_bucket smallint, layout_hint text, component_version smallint, title text, excerpt text, thumbnail_url text, published_at timestamp with time zone, author_kind text, author_id uuid, author_name text, author_avatar_url text, author_source_kind text, author_is_verified boolean, is_seen boolean, is_saved boolean, is_following_author boolean, suggestion_reason_key text, suggestion_reason_label text, nav_kind text, nav_params jsonb, data jsonb, as_of timestamp with time zone, next_cursor_bucket smallint, next_cursor_published_at timestamp with time zone, next_cursor_uid text, is_last_page boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid                 uuid := auth.uid();
  v_as_of               timestamptz;
  v_limit               int := least(greatest(coalesce(p_limit, 10), 1), 30);
  v_page                int := greatest(coalesce(p_page_index, 0), 0);
  v_region              text;
  v_role                text;
  v_pref_active         boolean := false;
  v_wants_clubs         boolean := false;
  v_wants_positions     boolean := false;
  v_wants_local_media   boolean := false;
  v_include_positions   boolean;
  v_target_role         text;
  v_primary_position    public.player_position;
  v_secondary_positions public.player_position[] := '{}';
  v_preferred_regions   text[] := '{}';
  v_popular_threshold   int := public.footme_feed_popularity_threshold();
  v_recent_count        int := 0;
  v_use_floor           boolean := true;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_tab is null or p_tab not in ('per_te', 'seguiti') then
    raise exception 'Tab del Feed non supportata: %', coalesce(p_tab, 'null');
  end if;

  if (p_cursor_uid is null) <> (p_cursor_published_at is null)
     or (p_cursor_uid is null) <> (p_cursor_bucket is null) then
    raise exception
      'Cursore del Feed incompleto: bucket, published_at e uid vanno forniti insieme';
  end if;

  if p_cursor_uid is not null and p_as_of is null then
    raise exception
      'Il cursore del Feed richiede p_as_of: passare l''as_of restituito dalla prima pagina';
  end if;

  v_as_of := coalesce(p_as_of, timezone('utc', now()));

  select p.region, p.role::text into v_region, v_role
  from public.profiles p
  where p.id = v_uid;

  select
    fp.applies_until is not null and fp.applies_until > v_as_of,
    fp.wants_clubs,
    fp.wants_positions,
    fp.wants_local_media
  into v_pref_active, v_wants_clubs, v_wants_positions, v_wants_local_media
  from public.feed_preferences fp
  where fp.profile_id = v_uid;

  v_pref_active := coalesce(v_pref_active, false);

  v_target_role := case
    when v_role = 'player' then 'player'
    when v_role = 'coach'  then 'coach'
    when v_role = 'staff'  then 'staff'
    else null
  end;

  select pp.primary_position, coalesce(pp.secondary_positions, '{}')
  into v_primary_position, v_secondary_positions
  from public.player_profiles pp
  where pp.profile_id = v_uid;

  select coalesce(
    (select pp.transfer_regions from public.player_profiles pp where pp.profile_id = v_uid),
    (select cp.preferred_regions from public.coach_profiles cp where cp.profile_id = v_uid),
    (select sp.preferred_regions from public.staff_profiles sp where sp.profile_id = v_uid),
    '{}'::text[]
  ) into v_preferred_regions;

  v_include_positions :=
    coalesce(v_role, '') in ('player', 'coach', 'staff', 'agent', 'director', 'club_admin')
    or (v_pref_active and coalesce(v_wants_positions, false));

  -- PUNTO A: il floor a 180 giorni si applica solo se c'è abbastanza materiale
  -- recente da riempire una pagina. Su un archivio poco recente cade, così la
  -- Home mostra contenuti vecchi invece di niente. Sonda limitata: costa una
  -- pagina. Deterministica per un dato as_of, quindi il cursore resta valido.
  if p_tab = 'per_te' then
    select count(*) into v_recent_count
    from (
      select 1
      from public.feed_content_index fci
      where fci.published_at <= v_as_of
        and fci.published_at >= v_as_of - interval '180 days'
      limit v_limit
    ) probe;

    v_use_floor := v_recent_count >= v_limit;
  end if;

  return query
  with followed_clubs as (
    select f.club_id from public.club_follows f where f.profile_id = v_uid
  ),
  followed_profiles as (
    select f.followed_profile_id as profile_id
    from public.profile_follows f
    where f.follower_profile_id = v_uid
  ),
  blocked_profiles as (
    select ub.blocked_profile_id as profile_id
    from public.user_blocks ub
    where ub.blocker_profile_id = v_uid
    union
    select ub.blocker_profile_id
    from public.user_blocks ub
    where ub.blocked_profile_id = v_uid
  ),
  saved_content as (
    select 'club_media'::text as content_type, s.post_id
      from public.saved_club_media s           where s.profile_id = v_uid
    union all
    select 'media_profile', s.post_id
      from public.saved_media_profile_posts s  where s.profile_id = v_uid
    union all
    select 'media_tribuna', s.post_id
      from public.saved_media_tribuna s        where s.profile_id = v_uid
    union all
    select 'fan_tribuna', s.post_id
      from public.saved_fan_tribuna s          where s.profile_id = v_uid
    union all
    select 'fan_media', s.post_id
      from public.saved_fan_media s            where s.profile_id = v_uid
    union all
    select 'profile_post', s.post_id
      from public.saved_profile_posts s        where s.profile_id = v_uid
  ),
  saved_positions as (
    select sa.ad_id from public.saved_ads sa where sa.profile_id = v_uid
  ),

  -- HOM-10 §73, §185–§187, D2: i Simple Repost dei reposter seguiti, UNA riga per
  -- originale. Solo Seguiti: in Per te l'insieme è vuoto (nessun cambiamento).
  repost_groups as (
    select g.*
    from public.footme_feed_repost_groups(v_uid, v_as_of) g
    where p_tab = 'seguiti'
  ),

  -- ── candidati: contenuti ────────────────────────────────────────
  content_candidates as (
    select
      fci.content_type || ':' || fci.post_id::text        as item_uid,
      public.footme_feed_item_type(fci.content_type, fci.content_format) as item_type,
      case
        when p_tab = 'seguiti' then 0::smallint
        else public.footme_feed_rank_bucket(
          aff.affinity,
          coalesce(eng.engagement_count, 0) >= v_popular_threshold,
          fci.published_at,
          v_as_of
        )
      end                                                as rank_bucket,
      fci.published_at                                   as published_at,
      fci.publisher_id                                   as author_key,
      fci.title                                          as title,
      fci.excerpt                                        as excerpt,
      fci.thumbnail_url                                  as thumbnail_url,
      fci.publisher_type                                 as author_kind,
      fci.publisher_id                                   as author_id,
      fci.publisher_name                                 as author_name,
      fci.publisher_avatar_url                           as author_avatar_url,
      fci.source_kind                                    as author_source_kind,
      coalesce(fci.publisher_is_verified, false)         as author_is_verified,
      (sv.post_id is not null)                           as is_saved,
      aff.is_following                                   as is_following_author,
      -- Un contenuto senza altri segnali ma molto commentato ha comunque un
      -- motivo da mostrare: è il "popolare" richiesto.
      coalesce(
        aff.reason_key,
        case
          when coalesce(eng.engagement_count, 0) >= v_popular_threshold
            then 'popular_now'
          else null
        end
      )                                                  as reason_key,
      null::text                                         as reason_entity_name,
      fci.content_type                                   as content_type,
      fci.post_id                                        as post_id,
      fci.kind                                           as kind,
      fci.content_format                                 as content_format,
      fci.media_type                                     as media_type,
      fci.duration_seconds                               as duration_seconds,
      null::uuid                                         as ad_id,
      null::uuid                                         as club_id,
      null::uuid                                         as team_id,
      null::text                                         as team_name,
      null::text                                         as team_type,
      null::text                                         as role_required,
      null::text                                         as category,
      null::text                                         as loc_city,
      null::text                                         as loc_province,
      null::text                                         as loc_region,
      null::text                                         as target_role,
      null::boolean                                      as is_secondary_match,
      null::jsonb                                        as repost_info
    from public.feed_content_index fci
    left join saved_content sv
      on sv.content_type = fci.content_type and sv.post_id = fci.post_id
    left join public.media_content_engagement eng
      on eng.content_type = fci.content_type and eng.post_id = fci.post_id
    cross join lateral (
      select
        f.is_following,
        greatest(
          case when f.is_following then 2 else 0 end,
          case
            when v_pref_active and (
              (coalesce(v_wants_clubs, false) and fci.publisher_type = 'club')
              or (
                coalesce(v_wants_local_media, false)
                and fci.source_kind in ('testata', 'giornalista', 'creator', 'pagina')
                and v_region is not null
                and fci.publisher_region = v_region
              )
            ) then 1 else 0
          end,
          case
            when v_region is not null and fci.publisher_region = v_region then 1 else 0
          end
        ) as affinity,
        case
          when f.is_following and fci.publisher_type = 'club'    then 'followed_club_publisher'
          when f.is_following and fci.publisher_type = 'profile'  then 'followed_profile_publisher'
          when v_pref_active and (
            (coalesce(v_wants_clubs, false) and fci.publisher_type = 'club')
            or (
              coalesce(v_wants_local_media, false)
              and fci.source_kind in ('testata', 'giornalista', 'creator', 'pagina')
              and v_region is not null
              and fci.publisher_region = v_region
            )
          ) then 'preferred_source'
          when v_region is not null and fci.publisher_region = v_region then 'same_region'
          else null
        end as reason_key
      from (
        select (
          case
            when fci.publisher_type = 'club'
              then exists (select 1 from followed_clubs fc where fc.club_id = fci.publisher_id)
            else exists (select 1 from followed_profiles fp where fp.profile_id = fci.publisher_id)
          end
        ) as is_following
      ) f
    ) aff
    where
      not (fci.publisher_type = 'profile' and fci.publisher_id = v_uid)
      and (
        fci.publisher_type <> 'profile'
        or not exists (select 1 from blocked_profiles bp where bp.profile_id = fci.publisher_id)
      )
      and (p_tab = 'per_te' or aff.is_following)
      and (
        p_tab = 'seguiti'
        or not v_use_floor
        or fci.published_at >= v_as_of - interval '180 days'
      )
      and fci.published_at <= v_as_of
      -- HOM-10 §185, §197: un originale che ha un wrapper non compare anche come
      -- copia organica (nessuna doppia esposizione nella stessa pagina).
      and not exists (
        select 1 from repost_groups rg
        where rg.g_content_type = fci.content_type and rg.g_post_id = fci.post_id)
  ),

  -- ── candidati: Simple Repost (wrapper) ──────────────────────────
  -- Stesso contenuto dell'originale (autore, payload, azioni: §75–§82), con la
  -- data del repost più recente. Il wrapper NON ha engagement proprio.
  repost_candidates as (
    select
      'repost:' || fci.content_type || ':' || fci.post_id::text          as item_uid,
      public.footme_feed_item_type(fci.content_type, fci.content_format) as item_type,
      0::smallint                                        as rank_bucket,
      g.g_published_at                                   as published_at,
      fci.publisher_id                                   as author_key,
      fci.title                                          as title,
      fci.excerpt                                        as excerpt,
      fci.thumbnail_url                                  as thumbnail_url,
      fci.publisher_type                                 as author_kind,
      fci.publisher_id                                   as author_id,
      fci.publisher_name                                 as author_name,
      fci.publisher_avatar_url                           as author_avatar_url,
      fci.source_kind                                    as author_source_kind,
      coalesce(fci.publisher_is_verified, false)         as author_is_verified,
      (sv.post_id is not null)                           as is_saved,
      (case
         when fci.publisher_type = 'club'
           then exists (select 1 from followed_clubs fc where fc.club_id = fci.publisher_id)
         else exists (select 1 from followed_profiles fp where fp.profile_id = fci.publisher_id)
       end)                                              as is_following_author,
      null::text                                         as reason_key,
      null::text                                         as reason_entity_name,
      fci.content_type                                   as content_type,
      fci.post_id                                        as post_id,
      fci.kind                                           as kind,
      fci.content_format                                 as content_format,
      fci.media_type                                     as media_type,
      fci.duration_seconds                               as duration_seconds,
      null::uuid                                         as ad_id,
      null::uuid                                         as club_id,
      null::uuid                                         as team_id,
      null::text                                         as team_name,
      null::text                                         as team_type,
      null::text                                         as role_required,
      null::text                                         as category,
      null::text                                         as loc_city,
      null::text                                         as loc_province,
      null::text                                         as loc_region,
      null::text                                         as target_role,
      null::boolean                                      as is_secondary_match,
      jsonb_build_object(
        'reposter', jsonb_build_object(
          'identity_type', g.g_reposter_type,
          'identity_id',   g.g_reposter_id,
          'display_name',  rc.card -> 'name',
          'avatar_url',    rc.card -> 'avatar_url',
          'is_verified',   coalesce(rc.card -> 'is_verified', 'false'::jsonb)),
        'additional_count', g.g_additional)               as repost_info
    from repost_groups g
    join public.feed_content_index fci
      on fci.content_type = g.g_content_type and fci.post_id = g.g_post_id
    left join saved_content sv
      on sv.content_type = fci.content_type and sv.post_id = fci.post_id
    cross join lateral (
      select public.footme_composer_identity_card(g.g_reposter_type, g.g_reposter_id) as card
    ) rc
    where fci.published_at <= v_as_of
      and rc.card is not null
  ),

  -- ── candidati: posizioni aperte ─────────────────────────────────
  position_candidates as (
    select
      'recruiting_ad:' || ra.id::text                    as item_uid,
      'suggested_position'::text                         as item_type,
      case
        when p_tab = 'seguiti' then 0::smallint
        else public.footme_feed_rank_bucket(pa.affinity, false, ra.published_at, v_as_of)
      end                                                as rank_bucket,
      ra.published_at                                    as published_at,
      ra.club_id                                         as author_key,
      ra.title                                           as title,
      null::text                                         as excerpt,
      null::text                                         as thumbnail_url,
      'club'::text                                       as author_kind,
      ra.club_id                                         as author_id,
      c.name                                             as author_name,
      c.logo_url                                         as author_avatar_url,
      'ufficiale'::text                                  as author_source_kind,
      (c.verification_status = 'verified')               as author_is_verified,
      (sp.ad_id is not null)                             as is_saved,
      pa.is_following                                    as is_following_author,
      pa.reason_key                                      as reason_key,
      c.name                                             as reason_entity_name,
      null::text                                         as content_type,
      null::uuid                                         as post_id,
      null::text                                         as kind,
      null::text                                         as content_format,
      null::text                                         as media_type,
      null::int                                          as duration_seconds,
      ra.id                                              as ad_id,
      ra.club_id                                         as club_id,
      ra.team_id                                         as team_id,
      ct.name                                            as team_name,
      ct.team_type                                       as team_type,
      ra.role_required::text                             as role_required,
      coalesce(ra.category, ct.category, c.category)     as category,
      coalesce(ct.city, c.city)                          as loc_city,
      coalesce(ct.province, c.province)                  as loc_province,
      coalesce(ra.region, ct.region, c.region)           as loc_region,
      ra.target_role::text                               as target_role,
      pa.is_secondary_match                              as is_secondary_match,
      null::jsonb                                        as repost_info
    from public.recruiting_ads ra
    join public.clubs c            on c.id = ra.club_id
    left join public.club_teams ct on ct.id = ra.team_id
    left join saved_positions sp   on sp.ad_id = ra.id
    cross join lateral (
      select
        m.is_following,
        m.is_secondary_match,
        m.role_match,
        m.region_match,
        greatest(
          case when m.is_following then 2 else 0 end,
          case when m.region_match or m.role_match then 1 else 0 end
        ) as affinity,
        case
          when m.is_following then 'followed_club_position'
          when m.role_match   then 'open_position_match'
          when m.region_match then 'same_region'
          else null
        end as reason_key
      from (
        select
          exists (select 1 from followed_clubs fc where fc.club_id = ra.club_id) as is_following,
          (
            v_target_role is not null
            and ra.target_role::text = v_target_role
            and v_primary_position is not null
            and ra.role_required = any(v_secondary_positions)
            and ra.role_required <> v_primary_position
          ) as is_secondary_match,
          (
            v_target_role is not null
            and ra.target_role::text = v_target_role
            and (
              v_primary_position is null
              or ra.role_required = v_primary_position
              or ra.role_required = any(v_secondary_positions)
            )
          ) as role_match,
          (
            coalesce(ra.region, ct.region, c.region) is not null
            and (
              coalesce(ra.region, ct.region, c.region) = v_region
              or coalesce(ra.region, ct.region, c.region) = any(v_preferred_regions)
            )
          ) as region_match
      ) m
    ) pa
    where v_include_positions
      and ra.status = 'published'
      and ra.published_at is not null
      and ra.published_at <= v_as_of
      and (ra.deadline is null or ra.deadline >= current_date)
      and (
        case
          when p_tab = 'seguiti' then pa.is_following
          else pa.is_following or pa.role_match or pa.region_match
        end
      )
      and (
        p_tab = 'seguiti'
        or not v_use_floor
        or ra.published_at >= v_as_of - interval '180 days'
      )
  ),

  candidates as (
    select * from content_candidates
    union all
    select * from repost_candidates
    union all
    select * from position_candidates
  ),

  filtered as (
    select cd.*
    from candidates cd
    where p_cursor_uid is null
       or cd.rank_bucket < p_cursor_bucket
       or (cd.rank_bucket = p_cursor_bucket and cd.published_at < p_cursor_published_at)
       or (
         cd.rank_bucket = p_cursor_bucket
         and cd.published_at = p_cursor_published_at
         and cd.item_uid > p_cursor_uid
       )
  ),
  ordered as (
    select
      f.*,
      row_number() over (
        order by f.rank_bucket desc, f.published_at desc, f.item_uid asc
      ) as base_ord
    from filtered f
    order by f.rank_bucket desc, f.published_at desc, f.item_uid asc
    limit v_limit + 1
  ),
  window_rows as (
    select o.* from ordered o where o.base_ord <= v_limit
  ),
  boundary as (
    select w.rank_bucket, w.published_at, w.item_uid
    from window_rows w
    order by w.base_ord desc
    limit 1
  ),

  diversified as (
    select
      w.*,
      w.base_ord
      + (row_number() over (partition by w.author_key order by w.base_ord) - 1) * 3
      + case
          when w.item_type = 'suggested_position'
            then (row_number() over (partition by w.item_type order by w.base_ord) - 1) * 2
          else 0
        end as final_ord
    from window_rows w
  ),
  emitted as (
    select d.*, row_number() over (order by d.final_ord, d.base_ord) as emit_ord
    from diversified d
  ),

  slot_rows as (
    select sp.slot_offset, sp.item_type
    from public.footme_feed_slot_plan(p_tab, v_page, v_limit) sp
    where sp.slot_offset < (select count(*) from emitted)
  ),

  -- HOM-02/HOM-03: il payload completo di Post, Articoli e video editoriali
  -- della pagina è costruito in batch, una volta, sulle sole chiavi emesse.
  -- Gli array escono dalla stessa aggregazione con lo stesso ordine, quindi
  -- restano allineati.
  post_keys as (
    select
      array_agg(e.content_type order by e.item_uid) as content_types,
      array_agg(e.post_id      order by e.item_uid) as post_ids
    from emitted e
    where e.item_type in ('post', 'article', 'video')
  ),
  post_payloads as (
    select pl.r_content_type, pl.r_post_id, pl.payload
    from post_keys pk
    cross join lateral public.footme_post_payloads(v_uid, pk.content_types, pk.post_ids) pl
  ),

  feed_rows as (
    select
      e.item_uid, e.item_type, e.rank_bucket, e.published_at,
      e.title, e.excerpt, e.thumbnail_url,
      e.author_kind, e.author_id, e.author_name, e.author_avatar_url,
      e.author_source_kind, e.author_is_verified, e.is_saved, e.is_following_author,
      e.reason_key, e.reason_entity_name,
      e.content_type, e.post_id, e.kind, e.content_format,
      e.media_type, e.duration_seconds,
      e.ad_id, e.club_id, e.team_id, e.team_name, e.team_type,
      e.role_required, e.category, e.loc_city, e.loc_province, e.loc_region,
      e.target_role, e.is_secondary_match, e.repost_info,
      e.emit_ord::numeric as sort_key
    from emitted e

    union all

    select
      'module:' || s.item_type || ':' || v_page::text, s.item_type,
      0::smallint, null::timestamptz,
      null::text, null::text, null::text,
      null::text, null::uuid, null::text, null::text,
      null::text, false, false, false,
      'not_followed_yet'::text, null::text,
      null::text, null::uuid, null::text, null::text,
      null::text, null::int,
      null::uuid, null::uuid, null::uuid, null::text, null::text,
      null::text, null::text, null::text, null::text, null::text,
      null::text, null::boolean, null::jsonb,
      s.slot_offset + 0.5
    from slot_rows s
  )

  select
    fr.item_uid,
    fr.item_type,
    (v_page * v_limit + row_number() over (order by fr.sort_key))::int as rank_position,
    fr.rank_bucket,
    public.footme_feed_layout_hint(
      fr.item_type,
      fr.thumbnail_url is not null,
      length(coalesce(fr.excerpt, ''))
    ) as layout_hint,
    public.footme_feed_component_version(fr.item_type) as component_version,
    fr.title,
    case
      when fr.excerpt is null       then null
      when fr.item_type = 'post'    then left(fr.excerpt, 280)
      else                               left(fr.excerpt, 200)
    end as excerpt,
    fr.thumbnail_url,
    fr.published_at,
    fr.author_kind,
    fr.author_id,
    fr.author_name,
    fr.author_avatar_url,
    fr.author_source_kind,
    fr.author_is_verified,
    false as is_seen,
    fr.is_saved,
    fr.is_following_author,
    fr.reason_key as suggestion_reason_key,
    public.footme_feed_reason_label(fr.reason_key, fr.reason_entity_name) as suggestion_reason_label,
    case
      when fr.item_type = 'suggested_position'                      then 'position'
      when fr.item_type in ('suggested_profiles', 'suggested_clubs') then null
      else 'content'
    end as nav_kind,
    case
      when fr.item_type = 'suggested_position'
        then jsonb_build_object('ad_id', fr.ad_id)
      when fr.item_type in ('suggested_profiles', 'suggested_clubs')
        then null
      else jsonb_build_object('content_type', fr.content_type, 'post_id', fr.post_id)
    end as nav_params,
    case
      when fr.item_type = 'suggested_position' then jsonb_build_object(
        'ad_id',              fr.ad_id,
        'club_id',            fr.club_id,
        'team_id',            fr.team_id,
        'club_name',          fr.author_name,
        'club_logo_url',      fr.author_avatar_url,
        'team_name',          fr.team_name,
        'team_type',          fr.team_type,
        'role_required',      fr.role_required,
        'category',           fr.category,
        'city',               fr.loc_city,
        'province',           fr.loc_province,
        'region',             fr.loc_region,
        'target_role',        fr.target_role,
        'is_secondary_match', coalesce(fr.is_secondary_match, false)
      )
      when fr.item_type in ('suggested_profiles', 'suggested_clubs') then jsonb_build_object(
        'module_key',   fr.item_type,
        'module_limit', 6
      )
      else jsonb_build_object(
        'content_type',     fr.content_type,
        'post_id',          fr.post_id,
        'kind',             fr.kind,
        'kind_label',       public.footme_content_kind_label(fr.content_type, fr.kind),
        'content_format',   fr.content_format,
        'media_type',       fr.media_type,
        'duration_seconds', fr.duration_seconds,
        'is_truncated',     length(coalesce(fr.excerpt, ''))
                              > (case when fr.item_type = 'post' then 280 else 200 end)
      )
      -- HOM-02/HOM-03: Post, Articoli e video editoriali portano le chiavi del
      -- Post social standard; le posizioni e i moduli discovery no.
      || case
           when fr.item_type in ('post', 'article', 'video')
             then coalesce(ppl.payload, '{}'::jsonb)
           else '{}'::jsonb
         end
    end
    -- HOM-10 §73–§82, §186: il contesto «X ha ripostato» (reposter rappresentativo e
    -- quanti altri). Le azioni e il payload restano dell'originale.
    || case
         when fr.repost_info is not null then jsonb_build_object('repost', fr.repost_info)
         else '{}'::jsonb
       end as data,
    v_as_of as as_of,
    case
      when (select count(*) from ordered) > v_limit
        then (select b.rank_bucket from boundary b)
      else null
    end as next_cursor_bucket,
    case
      when (select count(*) from ordered) > v_limit
        then (select b.published_at from boundary b)
      else null
    end as next_cursor_published_at,
    case
      when (select count(*) from ordered) > v_limit
        then (select b.item_uid from boundary b)
      else null
    end as next_cursor_uid,
    ((select count(*) from ordered) <= v_limit) as is_last_page
  from feed_rows fr
  left join post_payloads ppl
    on fr.item_type in ('post', 'article', 'video')
   and ppl.r_content_type = fr.content_type
   and ppl.r_post_id = fr.post_id
  order by fr.sort_key;
end;
$function$;

revoke all on function public.fetch_home_feed_page(text, timestamptz, smallint, timestamptz, text, integer, integer) from public;
revoke execute on function public.fetch_home_feed_page(text, timestamptz, smallint, timestamptz, text, integer, integer) from anon;
grant execute on function public.fetch_home_feed_page(text, timestamptz, smallint, timestamptz, text, integer, integer) to authenticated;

-- 5. fetch_home_feed_updates (sorgente: 20260727120000_home_feed_rpcs.sql)
create or replace function public.fetch_home_feed_updates(
  p_tab   text        default 'per_te',
  p_since timestamptz default null
)
returns table (
  new_items_count     int,
  newest_published_at timestamptz,
  preview_avatar_urls text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_since timestamptz;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_tab is null or p_tab not in ('per_te', 'seguiti') then
    raise exception 'Tab del Feed non supportata: %', coalesce(p_tab, 'null');
  end if;

  -- Senza watermark non c'è nulla di "nuovo" da segnalare.
  v_since := coalesce(p_since, timezone('utc', now()));

  return query
  with followed_clubs as (
    select f.club_id from public.club_follows f where f.profile_id = v_uid
  ),
  followed_profiles as (
    select f.followed_profile_id as profile_id
    from public.profile_follows f
    where f.follower_profile_id = v_uid
  ),
  blocked_profiles as (
    select ub.blocked_profile_id as profile_id
    from public.user_blocks ub
    where ub.blocker_profile_id = v_uid
    union
    select ub.blocker_profile_id
    from public.user_blocks ub
    where ub.blocked_profile_id = v_uid
  ),
  -- HOM-10: gli stessi wrapper della pagina (footme_feed_repost_groups), solo Seguiti.
  repost_groups as (
    select g.*
    from public.footme_feed_repost_groups(v_uid, timezone('utc', now())) g
    where p_tab = 'seguiti'
  ),
  fresh as (
    select fci.published_at, fci.publisher_avatar_url
    from public.feed_content_index fci
    where fci.published_at > v_since
      and not exists (
        select 1 from repost_groups rg
        where rg.g_content_type = fci.content_type and rg.g_post_id = fci.post_id)
      and not (fci.publisher_type = 'profile' and fci.publisher_id = v_uid)
      and (
        fci.publisher_type <> 'profile'
        or not exists (select 1 from blocked_profiles bp where bp.profile_id = fci.publisher_id)
      )
      and (
        p_tab = 'per_te'
        or (
          case
            when fci.publisher_type = 'club'
              then exists (select 1 from followed_clubs fc where fc.club_id = fci.publisher_id)
            else exists (select 1 from followed_profiles fp where fp.profile_id = fci.publisher_id)
          end
        )
      )
    union all
    select g.g_published_at, fci.publisher_avatar_url
    from repost_groups g
    join public.feed_content_index fci
      on fci.content_type = g.g_content_type and fci.post_id = g.g_post_id
    where g.g_published_at > v_since
    limit 100
  )
  select
    (select count(*)::int from fresh),
    (select max(f.published_at) from fresh f),
    coalesce(
      (
        select array_agg(a.publisher_avatar_url)
        from (
          select f.publisher_avatar_url
          from fresh f
          where f.publisher_avatar_url is not null
          order by f.published_at desc
          limit 3
        ) a
      ),
      '{}'::text[]
    );
end;
$$;

revoke all on function public.fetch_home_feed_updates(text, timestamptz) from public;
revoke execute on function public.fetch_home_feed_updates(text, timestamptz) from anon;
grant execute on function public.fetch_home_feed_updates(text, timestamptz) to authenticated;

-- 5. fetch_content_insights (sorgente: 20261124090000_home_content_share.sql)
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
  v_rp_simple   bigint;
  v_rp_ref      bigint;
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

  -- ── Repost (HOM-10 §207–§214) ─────────────────────────────────
  -- Simple Repost attivi + Post pubblicati che referenziano direttamente il
  -- contenuto. Distinti dalle Condivisioni (§211–§212: un Repost non scrive in
  -- content_share_actions) e, come loro, fuori da `interactions`. null = tipo non
  -- ripostabile (riga nascosta).
  select c.c_simple, c.c_referenced into v_rp_simple, v_rp_ref
  from public.footme_content_repost_counts(p_content_type, p_post_id) c;

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
      'reposts',  case when v_rp_simple is not null then v_rp_simple + v_rp_ref end,
      'reposts_breakdown', case when v_rp_simple is not null then jsonb_build_object(
                                 'simple_reposts_count',   v_rp_simple,
                                 'referenced_posts_count', v_rp_ref,
                                 'reposts_total',          v_rp_simple + v_rp_ref) end,
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

-- 5. fetch_content_for_editor (sorgente: 20261121090000_home_editorial_drafts_scheduling.sql)
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
                 'preview', v_ex.link_preview) end,
      -- HOM-10 §139, §161: la reference (sola lettura) per riaprire la bozza.
      'reference', public.footme_repost_reference_json(
                     v_uid, v_ex.referenced_content_type, v_ex.referenced_content_id));
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

-- 5. fetch_post_for_edit (sorgente: 20261120090000_home_post_composer.sql)
create or replace function public.fetch_post_for_edit(
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
  v_uid     uuid := auth.uid();
  v_r       record;
  v_kind    text;
  v_body    text;
  v_idtype  text;
  v_card    jsonb;
  v_ex      public.content_post_extras;
  v_link    jsonb := null;
  v_snap    public.link_preview_snapshots;
  v_url     text;
  v_sid     uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_post_id is null or p_content_type not in ('profile_post', 'club_media', 'media_profile') then
    raise exception 'post_not_found' using errcode = 'P0002';
  end if;

  select * into v_r from public.footme_content_rights(p_content_type, p_post_id) r;
  -- Inesistente, eliminato, bozza o archiviato: non esiste per la modifica.
  if v_r.r_status is distinct from 'published' then
    raise exception 'post_not_found' using errcode = 'P0002';
  end if;

  if p_content_type = 'profile_post' then
    select 'post', pp.body into v_kind, v_body from public.profile_posts pp where pp.id = p_post_id;
    v_idtype := 'person';
  elsif p_content_type = 'club_media' then
    select cm.kind, cm.body into v_kind, v_body from public.club_media_posts cm where cm.id = p_post_id;
    v_idtype := 'society';
  else
    select mp.kind, mp.body into v_kind, v_body from public.media_profile_posts mp where mp.id = p_post_id;
    v_idtype := 'media';
  end if;

  -- Il composer modifica solo i Post: gli altri kind (Articolo, highlights, ...)
  -- hanno un loro editor (HOM-06.2).
  if v_kind is distinct from 'post' or v_r.r_can_edit is not true then
    raise exception 'post_edit_denied' using errcode = '42501';
  end if;

  v_card := public.footme_composer_identity_card(v_idtype, v_r.r_publisher_id);
  if v_card is null then
    raise exception 'post_not_found' using errcode = 'P0002';
  end if;

  select * into v_ex from public.content_post_extras x
  where x.content_type = p_content_type and x.post_id = p_post_id;

  if v_ex.link_target is not null then
    v_url := v_ex.link_target ->> 'url';
    begin
      v_sid := nullif(v_ex.link_target ->> 'snapshot_id', '')::uuid;
    exception when invalid_text_representation then
      v_sid := null;
    end;
    if v_sid is not null then
      select * into v_snap from public.link_preview_snapshots s where s.id = v_sid;
    end if;
    -- I dati della preview vengono dallo snapshot se c'è, altrimenti dalla
    -- link_preview salvata (post legacy, o snapshot rimosso). `has_preview` dice
    -- se il Post ha una preview visuale salvata: snapshot_id null, nessun titolo
    -- e has_preview false = preview rimossa o assente (§93).
    v_link := jsonb_build_object(
      'url',         v_url,
      'snapshot_id', case when v_snap.id is not null then v_snap.id end,
      'title',       coalesce(v_snap.title, v_ex.link_preview ->> 'title'),
      'description', coalesce(v_snap.description, v_ex.link_preview ->> 'description'),
      'image_url',   coalesce(v_snap.image_url, v_ex.link_preview ->> 'thumbnail_url'),
      'domain',      coalesce(v_snap.domain, nullif(v_ex.link_preview ->> 'domain', ''),
                       regexp_replace(split_part(substr(v_url, 9), '/', 1), '^www\.', '')),
      'has_preview', v_ex.link_preview is not null);
  elsif v_ex.link_preview is not null then
    -- Post precedente a HOM-06.1: la preview è l'unico dato di link.
    v_link := jsonb_build_object(
      'url',         v_ex.link_preview ->> 'url',
      'snapshot_id', null,
      'title',       v_ex.link_preview ->> 'title',
      'description', v_ex.link_preview ->> 'description',
      'image_url',   v_ex.link_preview ->> 'thumbnail_url',
      'domain',      coalesce(nullif(v_ex.link_preview ->> 'domain', ''),
                       regexp_replace(split_part(substr(v_ex.link_preview ->> 'url', 9), '/', 1), '^www\.', '')),
      'has_preview', true);
  end if;

  return jsonb_build_object(
    'content_type', p_content_type,
    'content_id',   p_post_id,
    'version',      to_char(v_r.r_updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'author',       v_card,
    'body',         coalesce(v_body, ''),
    'mentions',     coalesce(v_ex.mentions, '[]'::jsonb),
    'tagged', coalesce((
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
          where p_content_type = 'profile_post' and tt.post_id = p_post_id and tt.status = 'active'
          union all
          select tt.target_type, coalesce(tt.target_id, tt.profile_id), tt.created_at
          from public.club_media_tagged_profiles tt
          where p_content_type = 'club_media' and tt.post_id = p_post_id and tt.status = 'active'
          union all
          select tt.target_type, tt.target_id, tt.created_at
          from public.media_profile_post_tagged_targets tt
          where p_content_type = 'media_profile' and tt.post_id = p_post_id and tt.status = 'active'
        ) x
        where x.target_type in ('profile', 'club')
      ) t
      left join public.profiles pr on t.target_type = 'profile' and pr.id = t.target_id
      left join public.clubs cl    on t.target_type = 'club'    and cl.id = t.target_id
      where coalesce(case t.target_type when 'profile' then pr.full_name else cl.name end, '') <> ''
    ), '[]'::jsonb),
    'link',         v_link,
    'media', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'position',         m.position,
                 'media_type',       m.media_type,
                 'url',              m.url,
                 'thumbnail_url',    m.thumbnail_url,
                 'width',            m.width,
                 'height',           m.height,
                 'duration_seconds', m.duration_seconds)
               order by m.position)
      from public.content_post_media m
      where m.content_type = p_content_type and m.post_id = p_post_id and m.url is not null
    ), '[]'::jsonb),
    -- HOM-10 §158–§162: la reference in Modifica è di sola lettura.
    'reference',    public.footme_repost_reference_json(
                      v_uid, v_ex.referenced_content_type, v_ex.referenced_content_id),
    'can_edit',     true);
end;
$$;

revoke all on function public.fetch_post_for_edit(text, uuid) from public;
revoke execute on function public.fetch_post_for_edit(text, uuid) from anon;
grant execute on function public.fetch_post_for_edit(text, uuid) to authenticated;

-- Commenti di contratto delle RPC riemesse che ne perdono il testo con la sostituzione? No:
-- create or replace conserva i commenti esistenti. Si aggiornano solo quelli che cambiano.
comment on function public.fetch_content_insights(text, uuid) is
  'HOM-05 §152: statistiche aggregate di un contenuto. {status: ok|unavailable, ...}; 42501 content_permission_denied se il contenuto è leggibile ma la capability manca. null = non disponibile, 0 = zero reale. HOM-09: engagement.shares = batch interni completati + Copia link (null per fan_tribuna e media_tribuna). HOM-10: engagement.reposts = Simple Repost attivi + Post pubblicati che referenziano il contenuto, engagement.reposts_breakdown = {simple_reposts_count, referenced_posts_count, reposts_total} (entrambi null per i tipi non ripostabili); fuori da interactions.';
