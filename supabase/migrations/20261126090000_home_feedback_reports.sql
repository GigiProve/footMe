-- ============================================================
-- HOM-11 — Segnalazioni e Feedback: lato database
--
-- COSA MANCAVA
--
-- Il menu ••• del contenuto (HOM-04) ha oggi le voci «Non mi interessa», «Non
-- seguire» e «Segnala» come segnaposto «in arrivo» (§1–§3, §11): dietro non c'è
-- alcun dato. Servono tre domini, tre mutation, nessuna cascata (§163–§167):
--
--   1. FeedFeedback («Non mi interessa», §28–§53): preferenza personale e
--      segnale negativo per il ranking. Tabella propria `feed_not_interested`
--      (§38: viewer, contenuto, tipo, identità autrice, origine, timestamp,
--      motivo opzionale; §39: contesto Simple Repost) + motivi server-driven
--      `feed_feedback_reasons` (§47–§49).
--   2. Follow («Non seguire», §54–§68): NESSUN oggetto nuovo. Vive già in
--      `profile_follows` / `club_follows` (HOM-07) e il client riusa le sue
--      mutation (§55, §165). Questa migrazione non le legge né le scrive: le
--      legge soltanto per esporre `viewer_follows_author` al menu (§54).
--   3. ModerationReport («Segnala», §74–§162): oggetto Trust & Safety
--      account-scoped, `moderation_reports`, con categorie server-driven a due
--      livelli `moderation_report_categories` (§83–§90), snapshot generato dal
--      server (§106–§111, §183), idempotenza (§100–§101) e stato «già
--      segnalato» persistente (§126, §174).
--
--   Mancano inoltre: la capability `can_mark_not_interested` nelle righe Feed
--   (§20), `can_report` coerente con la gestione del contenuto (§4–§7),
--   `viewer_has_reported` e `viewer_follows_author` nei payload di contenuto e
--   nelle card commento, e le esclusioni viewer-specific del Feed (§123–§125,
--   §169–§171).
--
-- DECISIONI (contratto HOM-11) CHE QUESTA MIGRAZIONE REALIZZA
--
--   * D1  Il reporter è SEMPRE l'account autenticato (`auth.uid()`, §75, §181).
--         Nessun «Segnala come» (§76). L'identità Home corrente viaggia solo
--         come metadata `contextual_identity_*` (§77) ed è VALIDATA qui: se non
--         è fra le identità di interazione dell'utente diventa NULL.
--   * D2  «Non mi interessa» V1 solo con origine in una whitelist centrale
--         (`footme_not_interested_origins()` → {HOME_PER_TE}). Un'altra origine
--         risponde `not_allowed`, non un errore: è una scelta di prodotto, non
--         un bug del chiamante (§19–§27). Mai su commenti (§71): il tipo
--         `comment` non è fra i tipi ammessi.
--   * D3  Esclusioni lato server per il viewer: «Non mi interessa» esce da Per
--         te (non da Seguiti, §26); un CONTENT segnalato esce da Per te e da
--         Seguiti (§123–§125, anche il wrapper Simple Repost del suo originale).
--         Un COMMENT segnalato RESTA nella lista e porta `viewer_has_reported`:
--         lo collassa il client, le risposte restano intatte (§134–§140).
--         Nessuna rimozione globale (§124, §274).
--   * D4  Simple Repost: il payload del wrapper è già quello dell'originale, quindi
--         il target canonico (§9, §143) è SEMPRE l'originale. «Non mi
--         interessa» conserva anche reposter e `distribution_context =
--         'SIMPLE_REPOST'` (§39, §146), ma solo se quel repost è davvero attivo:
--         il client non può inventarlo. Un Post HOM-10 con reference è un Post
--         autonomo: nessun report sull'embedded (§147–§149).
--   * D5  Contenuto proprio o gestito (§4–§7): UNA funzione,
--         `footme_viewer_manages_content`, riusa `footme_content_rights` (le
--         capability HOM-04 sull'identità autrice, Società comprese) e le
--         identità di interazione dell'utente. Se vera: `can_report = false`,
--         `can_mark_not_interested = false` e i due RPC rispondono
--         `not_allowed`. Il menu non decide da solo.
--   * D6  Già segnalato: `viewer_has_reported` nel payload e `already_reported`
--         in `fetch_report_state` / `create_moderation_report`.
--
-- PERCHÉ QUESTA SOLUZIONE (una regola in un posto solo)
--
--   * Tabelle chiuse ai client (RLS attiva, nessuna policy, nessun grant): si
--     legge e si scrive solo da RPC, come `content_reposts`. Così la privacy del
--     reporter (§78, §275) non dipende da una policy da non dimenticare, e RLS
--     non deve proteggere colonne (filtra righe, non colonne).
--   * `moderation_reports` NON ha foreign key verso i target: il report
--     sopravvive a modifica, soft delete e purge del target (§161–§162, §267–
--     §268). Lo snapshot è generato qui dal target canonico (§183) e il client
--     non può fornire autore, snapshot né stato (§180). Né HOM-04 (soft delete)
--     né HOM-08 (`footme_comment_remove`, `footme_comment_purge_side_data`)
--     nominano questa tabella: la QA lo verifica sul comportamento.
--   * Unico (reporter, target_type, target_id): è il vincolo, non una select, a
--     impedire il secondo report identico (§128, §276) anche da due device
--     (§174, §295). La chiave di operazione è per reporter, non globale: la
--     chiave di un altro utente non può collidere né rivelare nulla.
--   * `footme_report_target` è l'unica definizione di «target segnalabile dal
--     viewer» (leggibile / gestito / tipo e autore canonici), usata da
--     `fetch_report_state` e da `create_moderation_report`: lo stato mostrato
--     dal menu e l'esito del submit non possono divergere.
--   * `footme_post_payloads` (Feed e dettagli) e `footme_comment_cards` (liste
--     commenti) sono i builder unici dei payload: `viewer_has_reported`,
--     `viewer_follows_author` e `can_report` nascono lì, non in un secondo
--     builder. `fetch_home_feed_page` aggiunge soltanto ciò che dipende dalla
--     tab (`can_mark_not_interested`, §20–§26).
--
-- COSA NON SI FA
--
--   * Nessuna notifica, nessun evento all'autore o a Trust & Safety (§41, §43,
--     §68, §192, §299): non c'è alcun trigger né outbox su queste tabelle.
--   * Nessuna cascata fra le tre azioni (§167): «Non mi interessa» non crea
--     report né tocca i Follow (§41–§42); il report non tocca Follow,
--     `user_blocks` né `feed_not_interested` (§150–§152); il Follow non è letto
--     in scrittura. `user_blocks` (HOM-12) resta fuori: HOM-11 non lo scrive.
--   * Nessuna dashboard moderatori, «Le mie segnalazioni», appeal, strike,
--     contatore pubblico di report (§194–§196, §228): nessuna RPC di lettura dei
--     report e nessuna policy SELECT.
--   * Le tabelle report preesistenti (`club_reports`, `content_tag_reports`,
--     `conversation_reports`) sono domini stretti a motivi fissi (pagina club,
--     tag, chat) e NON si toccano. `moderation_reports` è estendibile a nuovi
--     `target_type` (§105: basta allargare il check e aggiungere un ramo a
--     `footme_report_target` / `footme_report_snapshot`) e un giorno potrà
--     assorbirle, ma oggi non le sostituisce.
--   * «Non mi interessa» non ha ranking: scrive il segnale e lo esclude da Per
--     te. L'algoritmo è la task Feed ranking (§40).
--
-- FUNZIONI RIEMESSE (tutte dall'ULTIMA definizione effettiva: schema ottenuto
-- applicando tutte le migrazioni e letto con pg_get_functiondef, poi modificato
-- nei soli punti HOM-11, marcati «HOM-11» nel corpo)
--
--   footme_post_payloads    (HOM-10: capabilities.can_repost, reference)
--   fetch_home_feed_page    (HOM-10: wrapper Simple Repost in Seguiti)
--   fetch_home_feed_updates (HOM-10: stessi wrapper della pagina)
--   footme_comment_cards    (HOM-08: card commento)
--
-- ROLLOUT E DATI
--
--   Solo oggetti nuovi + quattro funzioni riemesse con la stessa firma e le
--   stesse colonne di ritorno: nessun backfill, nessun dato esistente toccato.
--   Le chiavi nuove nei jsonb sono additive. Idempotente: tabelle `if not
--   exists`, seed `on conflict do nothing` (un'etichetta modificata a mano non
--   viene sovrascritta), funzioni `create or replace`.
-- ============================================================


-- ============================================================
-- 1. TABELLE (chiuse ai client: RLS attiva, nessuna policy, nessun grant)
-- ============================================================

-- 1a. Motivi opzionali di «Non mi interessa» (§47–§49): server-driven, un solo
-- posto per le etichette. L'ordine e `active` decidono cosa vede il client.
create table if not exists public.feed_feedback_reasons (
  reason_id   text        primary key,
  label       text        not null,
  sort_order  integer     not null default 0,
  active      boolean     not null default true,
  created_at  timestamptz not null default now(),
  constraint feed_feedback_reasons_label_check check (btrim(label) <> '')
);

alter table public.feed_feedback_reasons enable row level security;
revoke all on table public.feed_feedback_reasons from anon, authenticated;

insert into public.feed_feedback_reasons (reason_id, label, sort_order) values
  ('topic_not_interested', 'Non mi interessa questo argomento', 10),
  ('too_many_similar',     'Vedo troppi contenuti simili',      20),
  ('not_relevant',         'Non è rilevante per me',            30),
  ('other',                'Altro',                             40)
on conflict (reason_id) do nothing;

comment on table public.feed_feedback_reasons is
  'HOM-11 §47–§49: motivi opzionali di «Non mi interessa», server-driven. Chiusa ai client: si legge da fetch_feed_feedback_reasons().';

-- 1b. «Non mi interessa» (§37–§43, §163–§164): segnale di personalizzazione,
-- dominio SEPARATO dal report. Una riga per (viewer, contenuto). Il contenuto è
-- sempre il canonico: per un Simple Repost è l'originale e `distribution_context`
-- + reposter dicono come è arrivato (§39, §146). L'autore è DERIVATO dal server.
-- Nessuna FK verso il contenuto: la riga è un fatto del viewer e non deve
-- bloccare né essere cancellata a cascata dalle operazioni sul contenuto.
create table if not exists public.feed_not_interested (
  id                      uuid        primary key default gen_random_uuid(),
  viewer_profile_id       uuid        not null references public.profiles(id) on delete cascade,
  content_type            text        not null,
  content_id              uuid        not null,
  author_identity_type    text        not null,
  author_identity_id      uuid        not null,
  origin                  text        not null,
  distribution_context    text,
  reposter_identity_type  text,
  reposter_identity_id    uuid,
  reason_id               text        references public.feed_feedback_reasons(reason_id) on delete set null,
  reason_selected_at      timestamptz,
  operation_key           uuid        not null,
  created_at              timestamptz not null default now(),
  constraint feed_not_interested_target_key unique (viewer_profile_id, content_type, content_id),
  constraint feed_not_interested_operation_key unique (viewer_profile_id, operation_key),
  constraint feed_not_interested_content_type_check
    check (content_type in ('profile_post', 'club_media', 'media_profile', 'fan_media',
                            'fan_tribuna', 'media_tribuna')),
  constraint feed_not_interested_author_type_check
    check (author_identity_type in ('person', 'society', 'media')),
  constraint feed_not_interested_origin_check
    check (origin ~ '^[A-Z0-9_]{1,40}$'),
  constraint feed_not_interested_context_check
    check (distribution_context is null or distribution_context = 'SIMPLE_REPOST'),
  constraint feed_not_interested_reposter_check
    check ((reposter_identity_type is null) = (reposter_identity_id is null)
           and (reposter_identity_type is null
                or reposter_identity_type in ('person', 'society', 'media'))
           and ((distribution_context is null) = (reposter_identity_type is null)))
);

alter table public.feed_not_interested enable row level security;
revoke all on table public.feed_not_interested from anon, authenticated;

comment on table public.feed_not_interested is
  'HOM-11 §37–§43: segnale «Non mi interessa» (personalizzazione, NON moderazione né Follow). Una riga per (viewer, contenuto canonico). Chiusa ai client: solo RPC.';

-- 1c. Categorie di segnalazione (§83–§90): server-driven, due livelli. Le
-- sottocategorie sono righe con `parent_id`. `requires_subcategory` vale sulla
-- madre; `target_types` decide per quali target la categoria è offerta (§87).
create table if not exists public.moderation_report_categories (
  category_id           text        primary key,
  parent_id             text        references public.moderation_report_categories(category_id),
  label                 text        not null,
  description           text,
  sort_order            integer     not null default 0,
  active                boolean     not null default true,
  requires_subcategory  boolean     not null default false,
  allows_free_text      boolean     not null default true,
  target_types          text[]      not null default array['CONTENT', 'COMMENT'],
  created_at            timestamptz not null default now(),
  constraint moderation_report_categories_label_check check (btrim(label) <> ''),
  constraint moderation_report_categories_targets_check
    check (cardinality(target_types) > 0 and target_types <@ array['CONTENT', 'COMMENT']),
  -- Due livelli, non tre: una sottocategoria non ha figli propri.
  constraint moderation_report_categories_level_check
    check (parent_id is null or (requires_subcategory = false and parent_id <> category_id))
);

alter table public.moderation_report_categories enable row level security;
revoke all on table public.moderation_report_categories from anon, authenticated;

insert into public.moderation_report_categories
  (category_id, parent_id, label, sort_order, requires_subcategory) values
  ('spam_misleading', null, 'Spam o contenuto ingannevole',               10, true),
  ('harassment',      null, 'Molestie o comportamento offensivo',         20, false),
  ('hate',            null, 'Odio o discriminazione',                     30, false),
  ('violence',        null, 'Violenza o contenuti pericolosi',            40, false),
  ('sexual',          null, 'Contenuto sessuale o inappropriato',         50, false),
  ('privacy',         null, 'Violazione della privacy',                   60, false),
  ('minor_safety',    null, 'Problema relativo alla sicurezza di un minore', 70, false),
  ('other',           null, 'Altro',                                      80, false)
on conflict (category_id) do nothing;

insert into public.moderation_report_categories
  (category_id, parent_id, label, sort_order, requires_subcategory) values
  ('spam_misleading.spam',            'spam_misleading', 'Spam',                            10, false),
  ('spam_misleading.scam',            'spam_misleading', 'Truffa o tentativo di frode',     20, false),
  ('spam_misleading.false_info',      'spam_misleading', 'Contenuto falso o ingannevole',   30, false),
  ('spam_misleading.suspicious_link', 'spam_misleading', 'Link sospetto',                   40, false),
  ('spam_misleading.other',           'spam_misleading', 'Altro',                           50, false)
on conflict (category_id) do nothing;

comment on table public.moderation_report_categories is
  'HOM-11 §83–§90: categorie di segnalazione server-driven a due livelli. Chiusa ai client: si legge da fetch_report_categories(target_type).';

-- 1d. Segnalazione (§74–§162, §180–§184). Account-scoped: `reporter_profile_id`
-- è sempre auth.uid(). `target_author_*` e `snapshot` sono DERIVATI dal server.
-- NESSUNA FK verso il target (§161–§162): il report sopravvive a modifica,
-- soft delete e purge. Per un COMMENT, `target_content_type` / `parent_content_id`
-- sono il contenuto padre. Un report per (reporter, target) in V1 (§128).
create table if not exists public.moderation_reports (
  id                          uuid        primary key default gen_random_uuid(),
  reporter_profile_id         uuid        not null references public.profiles(id) on delete cascade,
  contextual_identity_type    text,
  contextual_identity_id      uuid,
  target_type                 text        not null,
  target_content_type         text,
  target_id                   uuid        not null,
  parent_content_id           uuid,
  target_author_identity_type text        not null,
  target_author_identity_id   uuid        not null,
  category_id                 text        not null references public.moderation_report_categories(category_id),
  subcategory_id              text        references public.moderation_report_categories(category_id),
  details                     text,
  origin                      text        not null,
  snapshot                    jsonb       not null,
  moderation_state            text        not null default 'RECEIVED',
  operation_key               uuid        not null,
  created_at                  timestamptz not null default now(),
  constraint moderation_reports_target_key unique (reporter_profile_id, target_type, target_id),
  constraint moderation_reports_operation_key unique (reporter_profile_id, operation_key),
  -- Estendibile (§105): un nuovo target_type allarga questo check, non crea un secondo motore.
  constraint moderation_reports_target_type_check check (target_type in ('CONTENT', 'COMMENT')),
  constraint moderation_reports_state_check
    check (moderation_state in ('RECEIVED', 'UNDER_REVIEW', 'ACTIONED', 'NO_VIOLATION', 'CLOSED')),
  constraint moderation_reports_contextual_check
    check ((contextual_identity_type is null) = (contextual_identity_id is null)
           and (contextual_identity_type is null
                or contextual_identity_type in ('person', 'society', 'media'))),
  constraint moderation_reports_author_type_check
    check (target_author_identity_type in ('person', 'society', 'media')),
  constraint moderation_reports_origin_check check (origin ~ '^[A-Z0-9_]{1,40}$'),
  constraint moderation_reports_details_check
    check (details is null or (details !~ '^\s*$' and char_length(details) <= 500)),
  constraint moderation_reports_snapshot_check check (jsonb_typeof(snapshot) = 'object')
);

create index if not exists moderation_reports_target_idx
  on public.moderation_reports (target_type, target_id);

alter table public.moderation_reports enable row level security;
revoke all on table public.moderation_reports from anon, authenticated;

comment on table public.moderation_reports is
  'HOM-11 §74–§162: segnalazione Trust & Safety account-scoped. Senza FK verso il target (sopravvive a modifica/eliminazione). Snapshot privato generato dal server. Nessuna policy né grant: nessun client la legge, nemmeno il reporter (§78, §195). Dominio separato da feed_not_interested e dai Follow.';

-- ============================================================
-- 2. REGOLE CENTRALI (funzioni interne: nessun grant ai client)
-- ============================================================

-- 2a. Origini in cui «Non mi interessa» è ammesso (D2, §21, §27). Una lista in un
-- solo posto: aprire una nuova superficie algoritmica = aggiungere qui.
create or replace function public.footme_not_interested_origins()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['HOME_PER_TE']::text[];
$$;

revoke all on function public.footme_not_interested_origins() from public;
revoke execute on function public.footme_not_interested_origins() from anon, authenticated;

-- 2b. Il viewer gestisce il contenuto? (D5, §4–§7). Le capability HOM-04
-- sull'identità autrice (modifica, eliminazione, insights: Società titolare e
-- delegati inclusi, non solo author_user_id) OPPURE l'identità autrice è una
-- delle identità con cui l'utente può pubblicare. Vera → menu owner HOM-04: né
-- «Non mi interessa», né «Non seguire», né «Segnala».
-- footme_content_rights legge auth.uid(): i chiamanti passano p_viewer = auth.uid().
create or replace function public.footme_viewer_manages_content(
  p_viewer uuid, p_content_type text, p_post_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
           select (r.r_can_edit or r.r_can_delete or r.r_can_view_insights)
           from public.footme_content_rights(p_content_type, p_post_id) r
         ), false)
      or exists (
           select 1
           from public.footme_content_publisher(p_content_type, p_post_id) pb
           join public.footme_interaction_identities(p_viewer) i
             on i.c_type = pb.pb_type and i.c_id = pb.pb_id);
$$;

revoke all on function public.footme_viewer_manages_content(uuid, text, uuid) from public;
revoke execute on function public.footme_viewer_manages_content(uuid, text, uuid) from anon, authenticated;

-- 2c. Il target della segnalazione, dal punto di vista del viewer (§159–§160,
-- §182). UNA definizione per `fetch_report_state` e `create_moderation_report`:
--   t_available  leggibile ora dal viewer (CONTENT: footme_content_readable;
--                COMMENT: footme_comment_readable, che include il padre);
--   t_managed    il viewer gestisce il contenuto / è l'autore del commento (D5);
--   t_content_type / t_parent_content_id  per un COMMENT il contenuto padre;
--   t_author_*   identità autrice CANONICA (mai dal client, §180).
create or replace function public.footme_report_target(
  p_viewer uuid, p_target_type text, p_content_type text, p_target_id uuid
)
returns table (
  t_available         boolean,
  t_managed           boolean,
  t_content_type      text,
  t_parent_content_id uuid,
  t_author_type       text,
  t_author_id         uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  t_available := false;
  t_managed := false;

  if p_target_type = 'CONTENT' then
    t_content_type := p_content_type;
    t_parent_content_id := null;
    if p_content_type in ('profile_post', 'club_media', 'media_profile', 'fan_media',
                          'fan_tribuna', 'media_tribuna')
       and p_target_id is not null then
      select pb.pb_type, pb.pb_id into t_author_type, t_author_id
      from public.footme_content_publisher(p_content_type, p_target_id) pb;
      t_available := t_author_id is not null
                     and public.footme_content_readable(p_viewer, p_content_type, p_target_id);
      t_managed := t_available
                   and public.footme_viewer_manages_content(p_viewer, p_content_type, p_target_id);
    end if;
  elsif p_target_type = 'COMMENT' and p_target_id is not null then
    select cc.content_type, cc.content_id, cc.author_type, cc.author_id
      into t_content_type, t_parent_content_id, t_author_type, t_author_id
    from public.content_comments cc
    where cc.id = p_target_id;
    t_available := t_author_id is not null
                   and public.footme_comment_readable(p_viewer, p_target_id);
    t_managed := t_available
                 and exists (select 1
                             from public.footme_interaction_identities(p_viewer) i
                             where i.c_type = t_author_type and i.c_id = t_author_id);
  end if;

  return next;
end;
$$;

revoke all on function public.footme_report_target(uuid, text, text, uuid) from public;
revoke execute on function public.footme_report_target(uuid, text, text, uuid) from anon, authenticated;

-- 2d. Snapshot di moderazione (§106–§111, §183), generato dal target canonico.
-- Minimizzato (§109): testo, riferimenti ai media (url/tipo, NON la copia del
-- file), autore, date, stato, reference HOM-10 (solo tipo/id). Per un commento:
-- testo, autore, padre, posizione nel thread. Mai esposto da alcuna RPC.
create or replace function public.footme_report_snapshot(
  p_target_type text, p_content_type text, p_target_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_snap jsonb;
begin
  if p_target_type = 'CONTENT' then
    select jsonb_build_object(
             'snapshot_version', 1,
             'captured_at',      now(),
             'target_type',      'CONTENT',
             'content_type',     fci.content_type,
             'content_id',       fci.post_id,
             'item_kind',        public.footme_feed_item_type(fci.content_type, fci.content_format),
             'status',           'published',
             'title',            fci.title,
             'body',             left(fci.body, 20000),
             'excerpt',          left(fci.excerpt, 1000),
             'thumbnail_url',    fci.thumbnail_url,
             'media_type',       fci.media_type,
             'media',            coalesce((
                                   select jsonb_agg(jsonb_build_object(
                                            'position',         m.position,
                                            'media_type',       m.media_type,
                                            'url',              m.url,
                                            'thumbnail_url',    m.thumbnail_url,
                                            'duration_seconds', m.duration_seconds)
                                          order by m.position)
                                   from public.content_post_media m
                                   where m.content_type = fci.content_type
                                     and m.post_id = fci.post_id), '[]'::jsonb),
             'author',           jsonb_build_object(
                                   'identity_type', a.author_type,
                                   'identity_id',   fci.publisher_id,
                                   'name',          fci.publisher_name),
             'published_at',     fci.published_at,
             'reference',        case when ex.referenced_content_id is not null
                                   then jsonb_build_object(
                                          'content_type', ex.referenced_content_type,
                                          'content_id',   ex.referenced_content_id) end,
             'article',          case when ar.post_id is not null
                                   then jsonb_build_object(
                                          'creation_mode', ar.creation_mode,
                                          'source_url',    ar.source_url,
                                          'document',      case when length(ar.document::text) <= 200000
                                                             then ar.document end) end)
      into v_snap
    from public.feed_content_index fci
    cross join lateral (
      select case
               when fci.publisher_type = 'club' then 'society'
               when fci.content_type in ('media_profile', 'media_tribuna') then 'media'
               else 'person'
             end as author_type
    ) a
    left join public.content_post_extras ex
      on ex.content_type = fci.content_type and ex.post_id = fci.post_id
    left join public.content_articles ar
      on ar.content_type = fci.content_type and ar.post_id = fci.post_id
    where fci.content_type = p_content_type
      and fci.post_id = p_target_id;
  elsif p_target_type = 'COMMENT' then
    select jsonb_build_object(
             'snapshot_version',    1,
             'captured_at',         now(),
             'target_type',         'COMMENT',
             'comment_id',          cc.id,
             'status',              cc.status,
             'body',                left(cc.body, 20000),
             'author',              jsonb_build_object(
                                      'identity_type', cc.author_type,
                                      'identity_id',   cc.author_id,
                                      'name',          public.footme_composer_identity_card(
                                                         cc.author_type, cc.author_id) ->> 'name'),
             'parent_content',      jsonb_build_object(
                                      'content_type', cc.content_type,
                                      'content_id',   cc.content_id),
             'root_comment_id',     cc.root_comment_id,
             'reply_to_comment_id', cc.reply_to_comment_id,
             'is_reply',            cc.root_comment_id is not null,
             'created_at',          cc.created_at,
             'edited_at',           cc.edited_at)
      into v_snap
    from public.content_comments cc
    where cc.id = p_target_id;
  end if;

  return v_snap;
end;
$$;

revoke all on function public.footme_report_snapshot(text, text, uuid) from public;
revoke execute on function public.footme_report_snapshot(text, text, uuid) from anon, authenticated;


-- ============================================================
-- 3. RPC CLIENT (security definer, auth.uid() nel corpo, anon chiuso)
-- ============================================================

-- 3a. Motivi opzionali (§47–§49). Solo attivi, nell'ordine del server.
create or replace function public.fetch_feed_feedback_reasons()
returns table (reason_id text, label text, sort_order integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  return query
  select r.reason_id, r.label, r.sort_order
  from public.feed_feedback_reasons r
  where r.active
  order by r.sort_order, r.reason_id;
end;
$$;

revoke all on function public.fetch_feed_feedback_reasons() from public;
revoke execute on function public.fetch_feed_feedback_reasons() from anon;
grant execute on function public.fetch_feed_feedback_reasons() to authenticated;

comment on function public.fetch_feed_feedback_reasons() is
  'HOM-11 §47–§49: {reason_id, label, sort_order} dei motivi attivi di «Non mi interessa», in ordine.';

-- 3b. mark_content_not_interested (§28–§45, §177). Esito {status, feedback_id}:
--   recorded          registrato ORA (o replay della stessa operation_key);
--   already_recorded  esiste già una riga per (viewer, contenuto): restituisce
--                     l'id canonico, mai una seconda (§177, multi-device §175);
--   unavailable       contenuto non leggibile ora (bozza, programmato, eliminato,
--                     bloccato);
--   not_allowed       origine fuori whitelist (D2) o contenuto gestito dal
--                     viewer (D5).
-- Input malformato = 22023: è un bug del chiamante, non un esito di flusso.
-- Non scrive report, Follow, notifiche: una sola tabella (§41–§43, §167).
-- `p_reposter_*` è il reposter rappresentativo (§39): conta solo se quel Simple
-- Repost è davvero attivo, altrimenti il segnale è un «Non mi interessa» semplice.
create or replace function public.mark_content_not_interested(
  p_operation_key         uuid,
  p_content_type          text,
  p_content_id            uuid,
  p_origin                text,
  p_reposter_identity_type text default null,
  p_reposter_identity_id   uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_origin  text := upper(btrim(coalesce(p_origin, '')));
  v_row     public.feed_not_interested;
  v_id      uuid;
  v_atype   text;
  v_aid     uuid;
  v_ctx     text := null;
  v_rtype   text := null;
  v_rid     uuid := null;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_operation_key is null
     or p_content_type is null
     or p_content_type not in ('profile_post', 'club_media', 'media_profile', 'fan_media',
                               'fan_tribuna', 'media_tribuna')
     or p_content_id is null
     or v_origin = '' or v_origin !~ '^[A-Z0-9_]{1,40}$'
     or (p_reposter_identity_type is null) <> (p_reposter_identity_id is null)
     or (p_reposter_identity_type is not null
         and p_reposter_identity_type not in ('person', 'society', 'media')) then
    raise exception 'not_interested_invalid_request' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('not_interested_op:' || v_uid::text || ':' || p_operation_key::text));

  -- Retry della stessa operazione: stesso esito, nessuna rivalidazione.
  select * into v_row from public.feed_not_interested n
  where n.viewer_profile_id = v_uid and n.operation_key = p_operation_key;
  if found then
    if v_row.content_type <> p_content_type or v_row.content_id <> p_content_id then
      raise exception 'not_interested_operation_conflict' using errcode = '40001';
    end if;
    return jsonb_build_object('status', 'recorded', 'feedback_id', v_row.id);
  end if;

  if not (v_origin = any (public.footme_not_interested_origins())) then
    return jsonb_build_object('status', 'not_allowed', 'feedback_id', null);
  end if;

  select n.id into v_id from public.feed_not_interested n
  where n.viewer_profile_id = v_uid
    and n.content_type = p_content_type
    and n.content_id = p_content_id;
  if found then
    return jsonb_build_object('status', 'already_recorded', 'feedback_id', v_id);
  end if;

  if not public.footme_content_readable(v_uid, p_content_type, p_content_id) then
    return jsonb_build_object('status', 'unavailable', 'feedback_id', null);
  end if;

  if public.footme_viewer_manages_content(v_uid, p_content_type, p_content_id) then
    return jsonb_build_object('status', 'not_allowed', 'feedback_id', null);
  end if;

  select pb.pb_type, pb.pb_id into v_atype, v_aid
  from public.footme_content_publisher(p_content_type, p_content_id) pb;
  if v_atype is null then
    return jsonb_build_object('status', 'unavailable', 'feedback_id', null);
  end if;

  if p_reposter_identity_type is not null
     and exists (
       select 1 from public.content_reposts r
       where r.status = 'active'
         and r.content_type = p_content_type
         and r.content_id = p_content_id
         and r.reposter_identity_type = p_reposter_identity_type
         and r.reposter_identity_id = p_reposter_identity_id) then
    v_ctx := 'SIMPLE_REPOST';
    v_rtype := p_reposter_identity_type;
    v_rid := p_reposter_identity_id;
  end if;

  v_id := null;
  insert into public.feed_not_interested
    (viewer_profile_id, content_type, content_id, author_identity_type, author_identity_id,
     origin, distribution_context, reposter_identity_type, reposter_identity_id, operation_key)
  values
    (v_uid, p_content_type, p_content_id, v_atype, v_aid,
     v_origin, v_ctx, v_rtype, v_rid, p_operation_key)
  on conflict do nothing
  returning id into v_id;

  -- Un'altra transazione ha vinto uno dei due unici fra la select e l'insert.
  if v_id is null then
    select n.id into v_id from public.feed_not_interested n
    where n.viewer_profile_id = v_uid and n.operation_key = p_operation_key;
    if found then
      return jsonb_build_object('status', 'recorded', 'feedback_id', v_id);
    end if;
    select n.id into v_id from public.feed_not_interested n
    where n.viewer_profile_id = v_uid
      and n.content_type = p_content_type
      and n.content_id = p_content_id;
    return jsonb_build_object('status', 'already_recorded', 'feedback_id', v_id);
  end if;

  return jsonb_build_object('status', 'recorded', 'feedback_id', v_id);
end;
$$;

revoke all on function public.mark_content_not_interested(uuid, text, uuid, text, text, uuid) from public;
revoke execute on function public.mark_content_not_interested(uuid, text, uuid, text, text, uuid) from anon;
grant execute on function public.mark_content_not_interested(uuid, text, uuid, text, text, uuid) to authenticated;

comment on function public.mark_content_not_interested(uuid, text, uuid, text, text, uuid) is
  'HOM-11 §28–§45, §177: «Non mi interessa». {status: recorded | already_recorded | unavailable | not_allowed, feedback_id}. Idempotente per operation_key e per (viewer, contenuto). 22023 not_interested_invalid_request per input malformato. Non crea report, non tocca i Follow, non notifica.';

-- 3c. set_not_interested_reason (§44–§50). Solo la riga propria. Il motivo è
-- facoltativo e mai necessario a completare l'azione (§45).
create or replace function public.set_not_interested_reason(
  p_feedback_id uuid,
  p_reason_id   text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select n.id into v_id from public.feed_not_interested n
  where n.id = p_feedback_id and n.viewer_profile_id = v_uid;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if p_reason_id is null
     or not exists (select 1 from public.feed_feedback_reasons r
                    where r.reason_id = p_reason_id and r.active) then
    return jsonb_build_object('status', 'invalid_reason');
  end if;

  update public.feed_not_interested n
     set reason_id = p_reason_id,
         reason_selected_at = now()
   where n.id = v_id;

  return jsonb_build_object('status', 'updated');
end;
$$;

revoke all on function public.set_not_interested_reason(uuid, text) from public;
revoke execute on function public.set_not_interested_reason(uuid, text) from anon;
grant execute on function public.set_not_interested_reason(uuid, text) to authenticated;

comment on function public.set_not_interested_reason(uuid, text) is
  'HOM-11 §44–§50: {status: updated | not_found | invalid_reason}. Solo la riga propria; motivo solo se attivo.';

-- 3d. undo_not_interested (§34, §53). Cancella la riga propria, motivo incluso.
-- Idempotente: la seconda chiamata risponde not_found e il client la tratta
-- come successo. Non tocca Follow né report (§167).
create or replace function public.undo_not_interested(p_feedback_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  delete from public.feed_not_interested n
  where n.id = p_feedback_id and n.viewer_profile_id = v_uid
  returning n.id into v_id;

  if v_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  return jsonb_build_object('status', 'removed');
end;
$$;

revoke all on function public.undo_not_interested(uuid) from public;
revoke execute on function public.undo_not_interested(uuid) from anon;
grant execute on function public.undo_not_interested(uuid) to authenticated;

comment on function public.undo_not_interested(uuid) is
  'HOM-11 §34, §53: {status: removed | not_found}. Cancella la riga propria (motivo incluso). Idempotente.';

-- 3e. Categorie di segnalazione per target (§83–§90). Piatta: le
-- sottocategorie sono righe con `parent_id`. Solo attive e compatibili col
-- target; una sottocategoria esce solo se anche la madre è offerta.
create or replace function public.fetch_report_categories(p_target_type text)
returns table (
  category_id          text,
  parent_id            text,
  label                text,
  description          text,
  sort_order           integer,
  requires_subcategory boolean,
  allows_free_text     boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_target_type is null or p_target_type not in ('CONTENT', 'COMMENT') then
    raise exception 'report_invalid_request' using errcode = '22023';
  end if;

  return query
  select c.category_id, c.parent_id, c.label, c.description, c.sort_order,
         c.requires_subcategory, c.allows_free_text
  from public.moderation_report_categories c
  left join public.moderation_report_categories par on par.category_id = c.parent_id
  where c.active
    and c.target_types @> array[p_target_type]
    and (c.parent_id is null
         or (par.active and par.target_types @> array[p_target_type]))
  order by coalesce(par.sort_order, c.sort_order), coalesce(c.parent_id, c.category_id),
           (c.parent_id is not null), c.sort_order, c.category_id;
end;
$$;

revoke all on function public.fetch_report_categories(text) from public;
revoke execute on function public.fetch_report_categories(text) from anon;
grant execute on function public.fetch_report_categories(text) to authenticated;

comment on function public.fetch_report_categories(text) is
  'HOM-11 §83–§90: categorie e sottocategorie attive per target (CONTENT | COMMENT), piatte con parent_id. 22023 per target sconosciuto.';

-- 3f. fetch_report_state (§126–§131, §159–§160). {reportable, already_reported,
-- available}: `available` = target leggibile ora; `already_reported` = questo
-- reporter ha già una segnalazione sul target (anche se ora non è più
-- leggibile); `reportable` = si può inviare una NUOVA segnalazione adesso
-- (available e non gestito dal viewer e non già segnalato). Per un COMMENT
-- `p_content_type` è ignorato: il padre si deriva dal commento.
create or replace function public.fetch_report_state(
  p_target_type  text,
  p_content_type text,
  p_target_id    uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_t        record;
  v_reported boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_target_type is null or p_target_type not in ('CONTENT', 'COMMENT')
     or p_target_id is null
     or (p_target_type = 'CONTENT'
         and (p_content_type is null
              or p_content_type not in ('profile_post', 'club_media', 'media_profile', 'fan_media',
                                        'fan_tribuna', 'media_tribuna'))) then
    raise exception 'report_invalid_request' using errcode = '22023';
  end if;

  select * into v_t from public.footme_report_target(v_uid, p_target_type, p_content_type, p_target_id);

  select exists (
    select 1 from public.moderation_reports mr
    where mr.reporter_profile_id = v_uid
      and mr.target_type = p_target_type
      and mr.target_id = p_target_id) into v_reported;

  return jsonb_build_object(
    'reportable',       v_t.t_available and not v_t.t_managed and not v_reported,
    'already_reported', v_reported,
    'available',        v_t.t_available);
end;
$$;

revoke all on function public.fetch_report_state(text, text, uuid) from public;
revoke execute on function public.fetch_report_state(text, text, uuid) from anon;
grant execute on function public.fetch_report_state(text, text, uuid) to authenticated;

comment on function public.fetch_report_state(text, text, uuid) is
  'HOM-11 §126–§131, §159–§160: {reportable, already_reported, available}. reportable = available e non gestito dal viewer e non già segnalato. 22023 per input malformato.';

-- 3g. create_moderation_report (§74–§162, §179–§184). Esito {status, report_id}:
--   created             creato ORA (o replay della stessa operation_key: lo stesso
--                       id anche dopo un timeout ambiguo, §101, §262);
--   already_reported    altro tentativo ma segnalazione già esistente (§127–§128,
--                       §276, multi-device §295): restituisce l'id canonico;
--   target_unavailable  target non più leggibile (§159–§160, §290);
--   invalid_category    categoria/sottocategoria inattiva, incompatibile col
--                       target, sottocategoria mancante o fuori madre, dettagli
--                       non ammessi dalla categoria;
--   not_allowed         il viewer gestisce il contenuto / è l'autore del commento (D5).
-- Reporter = auth.uid() (D1). L'identità contestuale è metadata e viene validata
-- (se non è dell'utente → NULL). Autore, snapshot e stato li produce il server
-- (§180). Per un COMMENT `p_content_type` è ignorato (il padre si deriva).
-- Malformato (chiave, target_type, id, categoria, origine, dettagli > 500
-- caratteri) = 22023. Nessun effetto su Follow, user_blocks, feed_not_interested,
-- contatori pubblici o notifiche (§150–§152, §192).
create or replace function public.create_moderation_report(
  p_operation_key            uuid,
  p_target_type              text,
  p_content_type             text,
  p_target_id                uuid,
  p_category_id              text,
  p_subcategory_id           text,
  p_details                  text,
  p_origin                   text,
  p_contextual_identity_type text,
  p_contextual_identity_id   uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_origin   text := upper(btrim(coalesce(p_origin, '')));
  v_details  text;
  v_row      public.moderation_reports;
  v_t        record;
  v_cat      public.moderation_report_categories;
  v_sub      public.moderation_report_categories;
  v_ctx_type text := null;
  v_ctx_id   uuid := null;
  v_id       uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  -- Sanitizzazione (§184): a capo normalizzati, caratteri di controllo rimossi
  -- (tab e a capo restano), spazi/a capo ai bordi tolti, vuoto → NULL.
  v_details := nullif(regexp_replace(
                 regexp_replace(
                   replace(replace(coalesce(p_details, ''), E'\r\n', E'\n'), E'\r', E'\n'),
                   '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'),
                 '^\s+|\s+$', '', 'g'), '');

  if p_operation_key is null
     or p_target_type is null or p_target_type not in ('CONTENT', 'COMMENT')
     or p_target_id is null
     or (p_target_type = 'CONTENT'
         and (p_content_type is null
              or p_content_type not in ('profile_post', 'club_media', 'media_profile', 'fan_media',
                                        'fan_tribuna', 'media_tribuna')))
     or p_category_id is null or btrim(p_category_id) = ''
     or v_origin = '' or v_origin !~ '^[A-Z0-9_]{1,40}$'
     or char_length(coalesce(v_details, '')) > 500 then
    raise exception 'report_invalid_request' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('report_op:' || v_uid::text || ':' || p_operation_key::text));

  -- Retry della stessa operazione (timeout ambiguo, doppio tap): stesso esito,
  -- nessuna rivalidazione e nessun secondo report.
  select * into v_row from public.moderation_reports r
  where r.reporter_profile_id = v_uid and r.operation_key = p_operation_key;
  if found then
    if v_row.target_type <> p_target_type
       or v_row.target_id <> p_target_id
       or v_row.category_id <> p_category_id
       or v_row.subcategory_id is distinct from nullif(btrim(coalesce(p_subcategory_id, '')), '') then
      raise exception 'report_operation_conflict' using errcode = '40001';
    end if;
    return jsonb_build_object('status', 'created', 'report_id', v_row.id);
  end if;

  -- Già segnalato da questo reporter (anche da un altro device): id canonico.
  -- Prima della disponibilità: un report esiste anche se il target è sparito (§161).
  select r.id into v_id from public.moderation_reports r
  where r.reporter_profile_id = v_uid
    and r.target_type = p_target_type
    and r.target_id = p_target_id;
  if found then
    return jsonb_build_object('status', 'already_reported', 'report_id', v_id);
  end if;

  select * into v_t from public.footme_report_target(v_uid, p_target_type, p_content_type, p_target_id);
  if not v_t.t_available then
    return jsonb_build_object('status', 'target_unavailable', 'report_id', null);
  end if;
  if v_t.t_managed then
    return jsonb_build_object('status', 'not_allowed', 'report_id', null);
  end if;

  -- Categoria: attiva, di primo livello, offerta per questo target.
  select * into v_cat from public.moderation_report_categories c
  where c.category_id = p_category_id
    and c.parent_id is null
    and c.active
    and c.target_types @> array[p_target_type];
  if not found then
    return jsonb_build_object('status', 'invalid_category', 'report_id', null);
  end if;

  if nullif(btrim(coalesce(p_subcategory_id, '')), '') is not null then
    select * into v_sub from public.moderation_report_categories c
    where c.category_id = btrim(p_subcategory_id)
      and c.parent_id = v_cat.category_id
      and c.active
      and c.target_types @> array[p_target_type];
    if not found then
      return jsonb_build_object('status', 'invalid_category', 'report_id', null);
    end if;
  elsif v_cat.requires_subcategory then
    return jsonb_build_object('status', 'invalid_category', 'report_id', null);
  end if;

  -- Dettagli solo dove la categoria (e la sottocategoria) li ammette.
  if v_details is not null
     and not (v_cat.allows_free_text and coalesce(v_sub.allows_free_text, true)) then
    return jsonb_build_object('status', 'invalid_category', 'report_id', null);
  end if;

  -- Identità contestuale = metadata (§77), mai l'identità del reporter: valida
  -- solo se è una identità di interazione dell'utente, altrimenti NULL.
  if p_contextual_identity_type is not null and p_contextual_identity_id is not null
     and exists (select 1 from public.footme_interaction_identities(v_uid) i
                 where i.c_type = p_contextual_identity_type
                   and i.c_id = p_contextual_identity_id) then
    v_ctx_type := p_contextual_identity_type;
    v_ctx_id := p_contextual_identity_id;
  end if;

  v_id := null;
  insert into public.moderation_reports
    (reporter_profile_id, contextual_identity_type, contextual_identity_id,
     target_type, target_content_type, target_id, parent_content_id,
     target_author_identity_type, target_author_identity_id,
     category_id, subcategory_id, details, origin, snapshot, operation_key)
  values
    (v_uid, v_ctx_type, v_ctx_id,
     p_target_type, v_t.t_content_type, p_target_id, v_t.t_parent_content_id,
     v_t.t_author_type, v_t.t_author_id,
     v_cat.category_id, v_sub.category_id, v_details, v_origin,
     public.footme_report_snapshot(p_target_type, v_t.t_content_type, p_target_id),
     p_operation_key)
  on conflict do nothing
  returning id into v_id;

  -- Un'altra transazione ha vinto uno dei due unici fra la select e l'insert.
  if v_id is null then
    select r.id into v_id from public.moderation_reports r
    where r.reporter_profile_id = v_uid and r.operation_key = p_operation_key;
    if found then
      return jsonb_build_object('status', 'created', 'report_id', v_id);
    end if;
    select r.id into v_id from public.moderation_reports r
    where r.reporter_profile_id = v_uid
      and r.target_type = p_target_type
      and r.target_id = p_target_id;
    return jsonb_build_object('status', 'already_reported', 'report_id', v_id);
  end if;

  return jsonb_build_object('status', 'created', 'report_id', v_id);
end;
$$;

revoke all on function public.create_moderation_report(uuid, text, text, uuid, text, text, text, text, text, uuid) from public;
revoke execute on function public.create_moderation_report(uuid, text, text, uuid, text, text, text, text, text, uuid) from anon;
grant execute on function public.create_moderation_report(uuid, text, text, uuid, text, text, text, text, text, uuid) to authenticated;

comment on function public.create_moderation_report(uuid, text, text, uuid, text, text, text, text, text, uuid) is
  'HOM-11 §74–§162: segnalazione account-scoped (CONTENT | COMMENT). {status: created | already_reported | target_unavailable | invalid_category | not_allowed, report_id}. Idempotente per operation_key e per (reporter, target). Snapshot, autore e stato generati dal server. 22023 report_invalid_request per input malformato.';


-- ============================================================
-- 4. FUNZIONI RIEMESSE (ultima definizione effettiva + modifiche HOM-11)
-- ============================================================

-- 4a. footme_post_payloads: builder unico dei payload di contenuto (Feed e
-- dettagli). HOM-11 aggiunge viewer_follows_author, viewer_has_reported e rende
-- can_report coerente con la gestione del contenuto.
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
      -- HOM-11 §54, §62: il Follow globale del viewer verso l'identità autrice
      -- (club_follows per la Società, profile_follows per persona e Media).
      case
        when b.publisher_type = 'club'
          then exists (select 1 from public.club_follows f
                       where f.profile_id = p_viewer and f.club_id = b.publisher_id)
        else exists (select 1 from public.profile_follows f
                     where f.follower_profile_id = p_viewer
                       and f.followed_profile_id = b.publisher_id)
      end as viewer_follows_author,
      -- HOM-11 §126, §174: il viewer ha già segnalato questo contenuto (canonico).
      exists (select 1 from public.moderation_reports mr
              where mr.reporter_profile_id = p_viewer
                and mr.target_type = 'CONTENT'
                and mr.target_content_type = b.content_type
                and mr.target_id = b.post_id) as viewer_has_reported
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
      -- HOM-11 §54, §126: stato del viewer per il menu (Non seguire / Segnalazione inviata).
      'viewer_follows_author', a.viewer_follows_author,
      'viewer_has_reported',   a.viewer_has_reported,
      'capabilities', jsonb_build_object(
        'can_like',          a.content_type in ('club_media', 'fan_media', 'profile_post', 'media_profile'),
        'can_comment',       public.footme_content_readable(p_viewer, a.content_type, a.post_id)
                             and coalesce(cs.comments_enabled, true) and hid.yes,
        'can_share',         true,
        'can_repost',        a.content_type in ('club_media', 'fan_media', 'profile_post', 'media_profile')
                             and rid.yes
                             and public.footme_content_readable(p_viewer, a.content_type, a.post_id),
        'can_save',          true,
        -- HOM-11 §4–§7: la stessa regola di gestione del menu owner HOM-04
        -- (footme_viewer_manages_content), non più solo «autore = viewer».
        'can_report',        not public.footme_viewer_manages_content(p_viewer, a.content_type, a.post_id),
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

-- Firma invariata: i privilegi esistenti restano; li dichiaro comunque.
revoke all on function public.footme_post_payloads(uuid, text[], uuid[]) from public;
revoke execute on function public.footme_post_payloads(uuid, text[], uuid[]) from anon, authenticated;

-- 4b. footme_comment_cards: builder unico delle card commento (HOM-08).
CREATE OR REPLACE FUNCTION public.footme_comment_cards(p_viewer uuid, p_comment_ids uuid[])
 RETURNS TABLE(k_id uuid, k_comment jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
                                   'can_like', false, 'can_open_author', false,
                                   'can_report', false),
          -- HOM-11: chiavi sempre presenti, valori neutri su tombstone e non visibili.
          'viewer_follows_author', false,
          'viewer_has_reported',   false,
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
                                   'can_open_author', true,
                                   -- HOM-11 §70: Segnala solo su commenti altrui e leggibili
                                   -- (autore fra le identità del viewer = proprio/gestito → no).
                                   'can_report', coalesce(x.readable, false)
                                                 and not exists (select 1 from mine m
                                                                 where m.c_type = s.author_type and m.c_id = s.author_id)),
          -- HOM-11 §70, §134–§140: Follow globale verso l'autore del commento e stato
          -- «segnalato» del viewer (il commento resta in lista: lo collassa il client).
          'viewer_follows_author', case
                                     when s.author_type = 'society'
                                       then exists (select 1 from public.club_follows f
                                                    where f.profile_id = p_viewer and f.club_id = s.author_id)
                                     else exists (select 1 from public.profile_follows f
                                                  where f.follower_profile_id = p_viewer
                                                    and f.followed_profile_id = s.author_id)
                                   end,
          'viewer_has_reported',   exists (select 1 from public.moderation_reports mr
                                           where mr.reporter_profile_id = p_viewer
                                             and mr.target_type = 'COMMENT'
                                             and mr.target_id = s.id),
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
$function$;

revoke all on function public.footme_comment_cards(uuid, uuid[]) from public;
revoke execute on function public.footme_comment_cards(uuid, uuid[]) from anon, authenticated;

-- 4c. fetch_home_feed_page: esclusioni viewer-specific e can_mark_not_interested.
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
      -- HOM-11 §123–§125, §171, §293: un CONTENT segnalato dal viewer non compare
      -- né in Per te né in Seguiti (viewer-specific, nessuna rimozione globale).
      and not exists (
        select 1 from public.moderation_reports mr
        where mr.reporter_profile_id = v_uid
          and mr.target_type = 'CONTENT'
          and mr.target_content_type = fci.content_type
          and mr.target_id = fci.post_id)
      -- HOM-11 §26, §169–§170, §292: «Non mi interessa» esclude da Per te; Seguiti
      -- non usa quel segnale.
      and not (
        p_tab = 'per_te'
        and exists (
          select 1 from public.feed_not_interested ni
          where ni.viewer_profile_id = v_uid
            and ni.content_type = fci.content_type
            and ni.content_id = fci.post_id))
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
      -- HOM-11 §143: il wrapper porta l'originale; se il viewer ha segnalato
      -- l'originale, sparisce anche il wrapper.
      and not exists (
        select 1 from public.moderation_reports mr
        where mr.reporter_profile_id = v_uid
          and mr.target_type = 'CONTENT'
          and mr.target_content_type = fci.content_type
          and mr.target_id = fci.post_id)
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
             -- HOM-11 §20–§26: can_mark_not_interested dipende dalla TAB (solo Per
             -- te) e dalla gestione del contenuto (can_report = non gestito).
             then case
                    when ppl.payload is null then '{}'::jsonb
                    else jsonb_set(
                           ppl.payload,
                           '{capabilities,can_mark_not_interested}',
                           to_jsonb(p_tab = 'per_te'
                                    and coalesce((ppl.payload #>> '{capabilities,can_report}')::boolean, false)),
                           true)
                  end
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

-- 4d. fetch_home_feed_updates: stesso insieme della pagina.
CREATE OR REPLACE FUNCTION public.fetch_home_feed_updates(p_tab text DEFAULT 'per_te'::text, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(new_items_count integer, newest_published_at timestamp with time zone, preview_avatar_urls text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      -- HOM-11 §123–§125, §169: stesse esclusioni della pagina (segnalati; Non mi
      -- interessa solo in Per te), così il conteggio «nuovi» non promette ciò che
      -- il refresh poi non mostra.
      and not exists (
        select 1 from public.moderation_reports mr
        where mr.reporter_profile_id = v_uid
          and mr.target_type = 'CONTENT'
          and mr.target_content_type = fci.content_type
          and mr.target_id = fci.post_id)
      and not (
        p_tab = 'per_te'
        and exists (
          select 1 from public.feed_not_interested ni
          where ni.viewer_profile_id = v_uid
            and ni.content_type = fci.content_type
            and ni.content_id = fci.post_id))
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
      -- HOM-11 §143: originale segnalato → niente wrapper.
      and not exists (
        select 1 from public.moderation_reports mr
        where mr.reporter_profile_id = v_uid
          and mr.target_type = 'CONTENT'
          and mr.target_content_type = g.g_content_type
          and mr.target_id = g.g_post_id)
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
$function$;

revoke all on function public.fetch_home_feed_updates(text, timestamptz) from public;
revoke execute on function public.fetch_home_feed_updates(text, timestamptz) from anon;
grant execute on function public.fetch_home_feed_updates(text, timestamptz) to authenticated;
