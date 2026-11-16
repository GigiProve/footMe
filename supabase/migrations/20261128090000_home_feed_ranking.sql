-- ============================================================
-- HOM-13 — Ranking, personalizzazione e Discovery Feed (parte database)
--
-- COSA MANCAVA (spec HOM-13 §11-§13, §17-§27, §41-§80, §81-§99, §109-§126,
-- §127-§170, §171-§191, §212-§222, §259-§266)
--
-- Il Feed Per te era la stessa spina cronologica di Seguiti con un «bucket»
-- (affinità x freschezza), cursor keyset su (bucket, published_at, uid) e
-- una diversificazione per autore che slittava le righe di +3 posizioni. Non
-- esistevano: pipeline Eligibility→Pool→Score→Diversity→Dedup→Moduli (§11),
-- candidate pool separati e un mix configurabile (§17, §27), matrice
-- professionale (§30), segnali comportamentali e confidence (§41-§71, §155),
-- seen-state da impression HOM-05 (§75-§80), sessione Feed con snapshot
-- stabile (§81-§99), broadening invisibile (§160-§167), Posizioni come unit
-- distinta dal Post (§171-§182, §223), suggeriti con soglia di qualità
-- (§183-§191), ranking_version e reason interna (§212-§217), analytics di
-- Feed non-contenuto (§259) e fallback (§264-§266). Il primo accesso chiedeva
-- 4 checkbox di categorie professionali con boost a 14 giorni (contro §128,
-- §240) e si riproponeva dopo 30 giorni (contro §146-§148).
--
-- DECISIONI (Luigi 2026-11-16, vincolanti)
--   D1 primo accesso: niente checkbox, niente boost a 14 giorni, niente
--      riproposta; «Le tue aree» dal profilo; mostrato una sola volta.
--      `feed_preferences` resta (migrazioni append-only) ma NON entra più nel
--      ranking. D2 Posizioni solo per chi può candidarsi (stessa regola di
--      `dashboard_position_action_state`), disponibilità canonica
--      `recruiting_ad_is_available`, escluse le già candidate (§175).
--   D3 identità del ranking = identità ATTIVA della Home (persona/media o
--      Società): segnali, matrice, rete e aree sono suoi; il Block resta la
--      regola V1 HOM-12 (identità personale dell'account, footme_blocked_keys).
--   D4 rete professionale (§19): membri della stessa Società/squadra,
--      rappresentanza procuratore<->assistito, rete societaria
--      (club_relationships), follow di secondo grado.
--
-- PERCHÉ QUESTA SOLUZIONE
--   * UNA RPC nuova per Per te, `fetch_home_for_you_page`, a sessione:
--     p_session_id null = nuova sessione (pull-to-refresh, pill, primo avvio):
--     la pipeline costruisce uno SNAPSHOT ordinato in `feed_session_units`;
--     le pagine successive leggono lo snapshot per posizione (stabilità §83-§86,
--     §96) e ricontrollano SOLO le esclusioni dure (Block, Non mi interessa,
--     contenuto non più leggibile, Posizione non più disponibile: §87-§88).
--     Snapshot esaurito = estensione con le chiavi già emesse escluse (§98-§99).
--     Seguiti resta su `fetch_home_feed_page('seguiti')`, invariata.
--   * Config UNICA in `app_policy_settings` (chiavi `feed_ranking.*`), letta da
--     `footme_feed_ranking_config()` con default fusi: pesi, mix dei pool,
--     matrice, recency, diversity, exploration, broadening, frequenza moduli,
--     soglie, dimensione snapshot, flag (§27, §30, §57, §74, §112, §122, §218).
--     I default vivono in UNA funzione (`footme_feed_ranking_defaults`) e le
--     righe seed ne derivano: nessun secondo posto da tenere allineato.
--   * Nessuno score né reason verso il client (§214-§216): restano in
--     `feed_session_units` (reason, candidate_source, score) con
--     `ranking_version` in `feed_sessions`.
--   * Tabelle chiuse (RLS attiva, nessuna policy, revoke da anon e
--     authenticated): sessioni, unit, eventi Feed non-contenuto (§250-§251,
--     §260). Le impression dei CONTENUTI restano in content_events (HOM-05,
--     session_id = feed_session_id): nessun secondo tracking.
--   * Fallback (§264-§266): un'eccezione nel ranking ricostruisce la sessione
--     con ranking semplice (recency + follow + regione) marcata
--     `ranking_version = '<v>-fallback'`; mai Feed vuoto se c'è contenuto.
--   * Pulizia: `footme_feed_prune_sessions` (retention da config) + pg_cron
--     condizionale come DAS-REV-31.
--
-- LIMITI DICHIARATI
--   * I segnali che vivono in tabelle di ACCOUNT (salvati, follow,
--     candidature, impression, Non mi interessa, condivisioni) usano l'account;
--     quelli identity-level (Mi piace, commenti, Repost) usano l'identità attiva.
--   * Il segnale «apertura Posizione» non è tracciato oggi (nessuna tabella):
--     la candidatura e il Salvataggio lo sostituiscono; skip/dwell rimandati.
--   * La geografia è a livello regione (feed_content_index espone solo
--     publisher_region); la provincia non è disponibile sugli autori profilo.
--   * Le RPC leggono `clubs` come definer (colonne pubbliche: regione,
--     categoria), come la spina esistente: nessun campo privato esce.
--   * La concorrenza reale non è riproducibile in PGlite.
-- ============================================================

-- ============================================================
-- SEZIONE 1 — configurazione (feed_ranking.*)
-- ============================================================

create or replace function public.footme_feed_ranking_defaults()
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'version', jsonb_build_object('ranking_version', 'v1'),
    'flags', jsonb_build_object(
      'ranking_enabled', true,
      'pool_mix_enabled', true,
      'exploration_enabled', true,
      'broadening_enabled', true,
      'opportunities_enabled', true,
      'suggested_enabled', true,
      'diversity_enabled', true
    ),
    'snapshot', jsonb_build_object(
      'size', 150, 'extension_size', 60, 'min_candidates', 40,
      'floor_days', 180, 'ttl_hours', 24, 'keep_per_viewer', 6, 'overfetch', 2.5,
      'max_scan_iterations', 40
    ),
    'pools', jsonb_build_object(
      'follow', 0.30, 'network', 0.15, 'professional', 0.15, 'geographic', 0.12,
      'football', 0.05, 'editorial', 0.08, 'discovery', 0.15
    ),
    'weights', jsonb_build_object(
      'follow', 0.30, 'network', 0.12, 'role', 0.14, 'geo', 0.12, 'category', 0.05,
      'recency', 0.25, 'verified', 0.01, 'engagement', 0.05,
      'learned_author', 0.20, 'learned_category', 0.10, 'learned_format', 0.05,
      'repost_network', 0.10, 'new_creator', 0.08,
      'seen_penalty', 0.35, 'cross_tab_penalty', 0.30,
      'ni_author_penalty', 0.08, 'ni_topic_penalty', 0.40, 'ni_relevance_penalty', 0.12,
      'repeat_publication_penalty', 0.12
    ),
    'role_matrix', jsonb_build_object(
      'player',   jsonb_build_object('society',1.0,'coach',0.8,'agent',0.8,'director',0.8,'player',0.6,'staff',0.4,'media',0.4,'fan',0.2),
      'coach',    jsonb_build_object('society',1.0,'director',0.9,'staff',0.8,'player',0.7,'coach',0.6,'agent',0.4,'media',0.4,'fan',0.2),
      'staff',    jsonb_build_object('society',1.0,'coach',0.8,'staff',0.8,'director',0.6,'player',0.4,'agent',0.3,'media',0.4,'fan',0.2),
      'agent',    jsonb_build_object('player',1.0,'society',0.8,'director',0.8,'coach',0.7,'agent',0.4,'staff',0.3,'media',0.4,'fan',0.2),
      'director', jsonb_build_object('society',0.9,'player',0.8,'coach',0.8,'staff',0.8,'agent',0.7,'director',0.6,'media',0.4,'fan',0.2),
      'society',  jsonb_build_object('player',0.9,'coach',0.9,'staff',0.8,'director',0.8,'agent',0.7,'society',0.7,'media',0.6,'fan',0.2),
      'media',    jsonb_build_object('society',1.0,'player',0.8,'coach',0.8,'director',0.7,'media',0.5,'staff',0.4,'agent',0.4,'fan',0.3),
      'fan',      jsonb_build_object('society',0.9,'player',0.8,'media',0.8,'coach',0.5,'director',0.3,'staff',0.3,'agent',0.2,'fan',0.5),
      'default_boost', 0.3
    ),
    'recency', jsonb_build_object('half_life_hours', 72, 'article_half_life_hours', 168),
    'learning', jsonb_build_object(
      'lookback_days', 60, 'decay_days', 30, 'confidence_k', 12, 'max_blend', 0.6,
      'signal_cap', 6,
      'signal_weights', jsonb_build_object(
        'follow_after_exposure', 3, 'save', 3, 'share', 3, 'repost', 3, 'application', 4,
        'comment', 2, 'profile_open', 1.5, 'article_open', 1, 'video_watch', 0.5, 'like', 1),
      'cold_start_confidence', 0.05,
      'seen_days', 14, 'cross_tab_hours', 24
    ),
    'diversity', jsonb_build_object(
      'author_consecutive_cap', 2, 'author_window', 12, 'author_window_cap', 3,
      'format_run_cap', 4, 'category_run_cap', 4, 'society_window', 12, 'society_window_cap', 4,
      'repeat_publication_threshold', 3,
      'reference_run_cap', 1, 'reference_window', 12, 'reference_window_cap', 3
    ),
    'exploration', jsonb_build_object('share', 0.15, 'new_creator_share', 0.06, 'new_creator_days', 21),
    'broadening', jsonb_build_object('second_degree_min', 2),
    'modules', jsonb_build_object(
      'opportunity', jsonb_build_object(
        'every_min', 12, 'every_max', 20, 'first_at', 5, 'strong_score', 0.75, 'strong_gap', 6,
        'min_relevance', 0.45, 'max_per_snapshot', 8, 'min_gap_other_module', 3),
      'suggested_profiles', jsonb_build_object(
        'every_min', 14, 'every_max', 24, 'first_at', 6, 'max_per_snapshot', 2),
      'suggested_clubs', jsonb_build_object(
        'every_min', 20, 'every_max', 30, 'first_at', 9, 'max_per_snapshot', 1, 'min_candidates', 2)
    ),
    'suggested', jsonb_build_object(
      'max_rows', 3, 'min_candidates', 2, 'min_score', 0.30,
      'weights', jsonb_build_object('role', 0.35, 'geo', 0.20, 'network', 0.25, 'category', 0.10, 'mutual', 0.10)
    )
  );
$$;

-- Lettore unico: default fusi con le righe `feed_ranking.<gruppo>` (merge
-- superficiale per gruppo: una riga può cambiare un solo campo).
create or replace function public.footme_feed_ranking_config()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(d.key,
           case when jsonb_typeof(d.value) = 'object' and jsonb_typeof(s.value) = 'object'
                then d.value || s.value else d.value end), '{}'::jsonb)
  from jsonb_each(public.footme_feed_ranking_defaults()) d
  left join public.app_policy_settings s on s.key = 'feed_ranking.' || d.key;
$$;

insert into public.app_policy_settings (key, value, description)
select 'feed_ranking.' || d.key, d.value,
       'HOM-13 §27, §57, §218 — gruppo di configurazione del ranking Per te (' || d.key || '). Modificabile senza release mobile.'
from jsonb_each(public.footme_feed_ranking_defaults()) d
on conflict (key) do nothing;

-- ============================================================
-- SEZIONE 2 — tabelle chiuse: sessioni, unit, eventi Feed
-- ============================================================

create table if not exists public.feed_sessions (
  id                 uuid        primary key default gen_random_uuid(),
  viewer_profile_id  uuid        not null references public.profiles(id) on delete cascade,
  tab                text        not null default 'per_te' check (tab = 'per_te'),
  identity_type      text        not null check (identity_type in ('person', 'media', 'society')),
  identity_id        uuid        not null,
  as_of              timestamptz not null,
  ranking_version    text        not null,
  confidence         numeric(5,4) not null default 0,
  cold_start         boolean     not null default false,
  broadening_level   smallint    not null default 1,
  is_fallback        boolean     not null default false,
  fallback_reason    text,
  exhausted          boolean     not null default false,
  unit_count         integer     not null default 0,
  duplicates_prevented integer   not null default 0,
  reposts_aggregated integer     not null default 0,
  created_at         timestamptz not null default timezone('utc', now()),
  expires_at         timestamptz not null
);

create index if not exists feed_sessions_viewer_idx
  on public.feed_sessions (viewer_profile_id, created_at desc);
create index if not exists feed_sessions_expires_idx
  on public.feed_sessions (expires_at);

create table if not exists public.feed_session_units (
  session_id       uuid    not null references public.feed_sessions(id) on delete cascade,
  position         integer not null check (position >= 1),
  unit_type        text    not null check (unit_type in ('CONTENT', 'SIMPLE_REPOST', 'OPPORTUNITY', 'SUGGESTED_PROFILES')),
  unit_key         text    not null,
  dedupe_key       text    not null,
  content_type     text,
  post_id          uuid,
  ad_id            uuid,
  module_index     integer,
  reposter_type    text,
  reposter_id      uuid,
  reposter_additional integer,
  reposted_at      timestamptz,
  candidate_source text,
  reason           text,
  score            numeric(8,4),
  primary key (session_id, position),
  constraint feed_session_units_dedupe_key unique (session_id, dedupe_key)
);

create table if not exists public.feed_events (
  id                bigint      generated always as identity primary key,
  event_id          uuid        not null,
  event_type        text        not null,
  viewer_profile_id uuid        not null references public.profiles(id) on delete cascade,
  feed_session_id   uuid        references public.feed_sessions(id) on delete set null,
  tab               text        not null,
  unit_type         text,
  unit_key          text,
  unit_position     integer,
  target_type       text,
  target_id         uuid,
  occurred_at       timestamptz not null,
  received_at       timestamptz not null default timezone('utc', now()),
  constraint feed_events_event_id_key unique (event_id),
  constraint feed_events_type_check check (event_type in (
    'feed_session_start', 'feed_refresh', 'feed_load_more', 'new_content_pill_shown',
    'new_content_pill_tap', 'feed_unit_impression', 'feed_unit_open', 'opportunity_impression',
    'opportunity_open', 'suggested_profiles_impression', 'suggested_profile_open', 'follow_from_feed')),
  constraint feed_events_tab_check check (tab in ('HOME_FOR_YOU', 'HOME_FOLLOWING')),
  constraint feed_events_unit_type_check check (
    unit_type is null or unit_type in ('CONTENT', 'SIMPLE_REPOST', 'OPPORTUNITY', 'SUGGESTED_PROFILES')),
  constraint feed_events_target_type_check check (
    target_type is null or target_type in ('profile', 'club', 'position', 'content')),
  constraint feed_events_unit_key_length check (unit_key is null or char_length(unit_key) <= 200)
);

create index if not exists feed_events_viewer_idx on public.feed_events (viewer_profile_id, occurred_at desc);
create index if not exists feed_events_session_idx on public.feed_events (feed_session_id) where feed_session_id is not null;

alter table public.feed_sessions enable row level security;
alter table public.feed_session_units enable row level security;
alter table public.feed_events enable row level security;
revoke all on table public.feed_sessions from anon, authenticated;
revoke all on table public.feed_session_units from anon, authenticated;
revoke all on table public.feed_events from anon, authenticated;

comment on table public.feed_sessions is
  'HOM-13 §81-§82: sessione Feed Per te (snapshot, ranking_version, identità attiva, broadening). Chiusa ai client: solo RPC.';
comment on table public.feed_session_units is
  'HOM-13 §96, §212: snapshot ordinato di unit; reason/candidate_source/score sono INTERNI (§214-§216). Chiusa ai client.';
comment on table public.feed_events is
  'HOM-13 §259: eventi Feed non-contenuto (sessione, pill, moduli). Le impression dei contenuti restano in content_events (HOM-05). Chiusa ai client.';

-- ============================================================
-- SEZIONE 3 — helper (nessuno eseguibile dai client: p_viewer arbitrario)
-- ============================================================

-- 3a. Identità attiva (D3). Valida l'identità richiesta contro le identità con
-- cui l'account può interagire (footme_interaction_identities, la stessa regola
-- di HOM-07/HOM-08); altrimenti ricade sulla personale. i_role = chiave della
-- matrice: ruolo persona | 'media' | 'society' (club_admin conta come Società).
create or replace function public.footme_feed_resolve_identity(p_viewer uuid, p_type text, p_id uuid)
returns table (i_type text, i_id uuid, i_role text)
language sql
stable
security definer
set search_path = public
as $$
  with personal as (
    select case when exists (select 1 from public.media_profiles m where m.profile_id = pr.id)
                then 'media' else 'person' end as t,
           pr.id as id,
           case when pr.role::text = 'club_admin' then 'society'
                when exists (select 1 from public.media_profiles m where m.profile_id = pr.id) then 'media'
                else pr.role::text end as r
    from public.profiles pr where pr.id = p_viewer
  ),
  soc as (
    select 'society'::text as t, i.c_id as id, 'society'::text as r
    from public.footme_interaction_identities(p_viewer) i
    where p_type = 'society' and i.c_type = 'society' and i.c_id = p_id
  )
  select t, id, r from soc
  union all
  select t, id, r from personal where not exists (select 1 from soc);
$$;

-- 3b. Rete professionale (D4, §19). Una riga per (kind, id) con la forza
-- massima e il numero di vie (n_via) per il secondo grado.
create or replace function public.footme_feed_network(p_viewer uuid, p_type text, p_id uuid, p_second_min integer)
returns table (n_kind text, n_id uuid, n_strength numeric, n_via integer)
language sql
stable
security definer
set search_path = public
as $$
  with my_clubs as (
    select p_id as club_id where p_type = 'society'
    union
    select cm.club_id from public.club_members cm
     where p_type <> 'society' and cm.profile_id = p_viewer and cm.status = 'active' and cm.is_current
    union
    select c.id from public.clubs c where p_type <> 'society' and c.owner_profile_id = p_viewer
  ),
  base as (
    select 'club'::text as k, mc.club_id as i, 1.0::numeric as s, 99 as v from my_clubs mc
    union all
    select 'profile', cm.profile_id, 1.0, 99
      from public.club_members cm join my_clubs mc on mc.club_id = cm.club_id
     where cm.status = 'active' and cm.is_current and cm.profile_id is not null
    union all
    select 'profile', c.owner_profile_id, 1.0, 99
      from public.clubs c join my_clubs mc on mc.club_id = c.id
    union all
    select 'profile', ar.player_profile_id, 1.0, 99
      from public.agent_representations ar
     where p_type <> 'society' and ar.agent_profile_id = p_viewer and ar.status = 'accepted'
    union all
    select 'profile', ar.agent_profile_id, 1.0, 99
      from public.agent_representations ar
     where p_type <> 'society' and ar.player_profile_id = p_viewer and ar.status = 'accepted'
    union all
    select 'club', case when r.club_a_id = mc.club_id then r.club_b_id else r.club_a_id end, 0.7, 99
      from public.club_relationships r join my_clubs mc on mc.club_id in (r.club_a_id, r.club_b_id)
     where r.status = 'active'
    union all
    select 'profile', f2.followed_profile_id, 0.4, count(*)::int
      from public.profile_follows f1
      join public.profile_follows f2 on f2.follower_profile_id = f1.followed_profile_id
     where f1.follower_profile_id = p_viewer
     group by f2.followed_profile_id
    having count(*) >= greatest(coalesce(p_second_min, 1), 1)
    union all
    select 'club', cf.club_id, 0.4, count(*)::int
      from public.profile_follows f1
      join public.club_follows cf on cf.profile_id = f1.followed_profile_id
     where f1.follower_profile_id = p_viewer
     group by cf.club_id
    having count(*) >= greatest(coalesce(p_second_min, 1), 1)
  )
  select b.k, b.i, max(b.s), max(b.v)
  from base b
  where b.i is not null and b.i <> p_viewer and b.i <> p_id
  group by b.k, b.i;
$$;

-- 3c. Eligibility dei CONTENUTI (§13-§15). UNICA definizione: la usano la
-- costruzione dello snapshot (p_cts null = tutto) e il ricontrollo a lettura
-- (chiavi esplicite, p_as_of = ora). Esclude: non pubblicati/programmati (la
-- vista contiene solo pubblicati), Block HOM-12 in entrambe le direzioni,
-- contenuti propri e dell'identità attiva, segnalati dal viewer (HOM-11),
-- «Non mi interessa» del viewer (HOM-11).
create or replace function public.footme_feed_eligible_content(
  p_viewer uuid, p_identity_type text, p_identity_id uuid,
  p_as_of timestamptz, p_floor_days integer, p_cts text[], p_ids uuid[])
returns table (
  e_ct text, e_post uuid, e_format text, e_kind text, e_pub_type text, e_pub_id uuid,
  e_source_kind text, e_published_at timestamptz, e_region text, e_verified boolean)
language sql
stable
security definer
set search_path = public
as $$
  with blocked as materialized (
    select k.b_kind, k.b_id from public.footme_blocked_keys(p_viewer) k
  )
  select fci.content_type, fci.post_id, fci.content_format, fci.kind, fci.publisher_type, fci.publisher_id,
         fci.source_kind, fci.published_at, fci.publisher_region, coalesce(fci.publisher_is_verified, false)
  from public.feed_content_index fci
  where p_viewer is not null
    and fci.published_at <= p_as_of
    and (p_floor_days is null or fci.published_at >= p_as_of - make_interval(days => p_floor_days))
    and (p_cts is null or exists (
          select 1 from unnest(p_cts, p_ids) k(ct, id) where k.ct = fci.content_type and k.id = fci.post_id))
    and not (fci.publisher_type = 'profile' and fci.publisher_id = p_viewer)
    and not (fci.publisher_type = 'club' and p_identity_type = 'society' and fci.publisher_id = p_identity_id)
    and not exists (
      select 1 from blocked bk
      where bk.b_id = fci.publisher_id
        and bk.b_kind = case when fci.publisher_type = 'club' then 'society' else 'profile' end)
    and not exists (
      select 1 from public.moderation_reports mr
      where mr.reporter_profile_id = p_viewer and mr.target_type = 'CONTENT'
        and mr.target_content_type = fci.content_type and mr.target_id = fci.post_id)
    and not exists (
      select 1 from public.feed_not_interested ni
      where ni.viewer_profile_id = p_viewer
        and ni.content_type = fci.content_type and ni.content_id = fci.post_id);
$$;

-- 3d. Posizioni candidabili (D2, §171-§182). Gate: l'identità attiva è la
-- persona e può candidarsi (ruolo player con scheda player: stessa regola di
-- dashboard_position_action_state), la Posizione è disponibile
-- (recruiting_ad_is_available + published_at), target_role compatibile, non
-- bloccata, nessuna candidatura non ritirata. La rilevanza (0..1, mai esposta)
-- somma posizione, regione, categoria, età, Società seguita, freschezza.
create or replace function public.footme_feed_position_candidates(
  p_viewer uuid, p_identity_type text, p_as_of timestamptz, p_ad_ids uuid[])
returns table (p_ad_id uuid, p_club_id uuid, p_relevance numeric, p_reason text, p_published_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select pr.id, pr.region, pr.birth_date, pp.primary_position, coalesce(pp.secondary_positions, '{}') as secondary_positions,
           coalesce(pp.transfer_regions, '{}') as regions, coalesce(pp.preferred_categories, '{}') as categories
    from public.profiles pr
    join public.player_profiles pp on pp.profile_id = pr.id
    where pr.id = p_viewer and pr.role = 'player' and p_identity_type in ('person', 'media')
  ),
  blocked as materialized (
    select k.b_id from public.footme_blocked_keys(p_viewer) k where k.b_kind = 'society'
  ),
  base as (
    select ra.id, ra.club_id, ra.published_at, ra.role_required, ra.age_min, ra.age_max,
           coalesce(ra.category, ct.category, c.category) as category,
           coalesce(ra.region, ct.region, c.region) as region,
           exists (select 1 from public.club_follows cf where cf.profile_id = p_viewer and cf.club_id = ra.club_id) as followed,
           me.region as my_region, me.regions, me.categories, me.primary_position, me.secondary_positions,
           case when me.birth_date is null then null
                else extract(year from age(p_as_of, me.birth_date))::int end as my_age
    from me
    cross join public.recruiting_ads ra
    join public.clubs c on c.id = ra.club_id
    left join public.club_teams ct on ct.id = ra.team_id
    where ra.published_at is not null
      and ra.published_at <= p_as_of
      and public.recruiting_ad_is_available(ra.status, ra.application_deadline_at)
      and coalesce(ra.target_role, 'player') = 'player'
      and (p_ad_ids is null or ra.id = any(p_ad_ids))
      and not exists (select 1 from blocked b where b.b_id = ra.club_id)
      and not exists (
        select 1 from public.recruiting_applications app
        where app.ad_id = ra.id and app.applicant_profile_id = p_viewer and app.status <> 'withdrawn')
  ),
  scored as (
    select b.*,
      (case
         when b.primary_position is null then 0.15
         when b.role_required = b.primary_position then 0.35
         when b.role_required = any(b.secondary_positions) then 0.20
         else 0 end) as s_pos,
      (case when b.region is not null and (b.region = b.my_region or b.region = any(b.regions)) then 0.25 else 0 end) as s_geo,
      (case when b.category is not null and b.category = any(b.categories) then 0.15 else 0 end) as s_cat,
      (case when b.followed then 0.15 else 0 end) as s_fol,
      (0.10 * exp(-ln(2) * greatest(extract(epoch from (p_as_of - b.published_at)) / 3600.0, 0) / 168.0)) as s_rec,
      (case when b.my_age is null or (b.age_min is null and b.age_max is null) then 0
            when (b.age_min is null or b.my_age >= b.age_min) and (b.age_max is null or b.my_age <= b.age_max) then 0.10
            else -0.40 end) as s_age
    from base b
  )
  select s.id, s.club_id,
         round(greatest(s.s_pos + s.s_geo + s.s_cat + s.s_fol + s.s_rec + s.s_age, 0)::numeric, 4),
         case when s.followed then 'followed_club_position'
              when s.s_pos >= 0.2 then 'open_position_match'
              when s.s_geo > 0 then 'same_region'
              else 'open_position_match' end,
         s.published_at
  from scored s;
$$;

-- 3e. Profili suggeriti (§183-§191): matrice di ruolo, geografia, rete D4,
-- categoria, contesto mutuo. Esclude sé stessi, già seguiti, bloccati (HOM-12),
-- admin, profili senza nome. Sotto soglia = non candidato (§191).
create or replace function public.footme_feed_suggested_candidates(
  p_viewer uuid, p_identity_type text, p_identity_id uuid, p_limit integer)
returns table (s_profile_id uuid, s_score numeric, s_reason text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cfg     jsonb := public.footme_feed_ranking_config();
  v_w       jsonb := v_cfg -> 'suggested' -> 'weights';
  v_min     numeric := (v_cfg -> 'suggested' ->> 'min_score')::numeric;
  v_matrix  jsonb := v_cfg -> 'role_matrix';
  v_role    text;
  v_region  text;
  v_cats    text[];
begin
  select r.i_role into v_role from public.footme_feed_resolve_identity(p_viewer, p_identity_type, p_identity_id) r limit 1;
  select pr.region into v_region from public.profiles pr where pr.id = p_viewer;
  select coalesce(array_agg(distinct x), '{}') into v_cats from (
    select unnest(pp.preferred_categories) x from public.player_profiles pp where pp.profile_id = p_viewer
    union select unnest(cp.preferred_categories) from public.coach_profiles cp where cp.profile_id = p_viewer
    union select unnest(sp.preferred_categories) from public.staff_profiles sp where sp.profile_id = p_viewer
    union select c.category from public.club_members cm join public.clubs c on c.id = cm.club_id
           where cm.profile_id = p_viewer and cm.status = 'active' and cm.is_current
    union select c.category from public.clubs c where c.id = p_identity_id and p_identity_type = 'society'
  ) t where x is not null;

  return query
  with net as materialized (
    select n.n_id, n.n_strength from public.footme_feed_network(p_viewer, p_identity_type, p_identity_id, 1) n
     where n.n_kind = 'profile'
  ),
  blocked as materialized (
    select k.b_id from public.footme_blocked_keys(p_viewer) k where k.b_kind = 'profile'
  ),
  cand as (
    select p.id as pid,
           case when exists (select 1 from public.media_profiles m where m.profile_id = p.id) then 'media'
                when p.role::text = 'club_admin' then 'society' else p.role::text end as acat,
           p.region as pregion,
           (select c.category from public.club_members cm join public.clubs c on c.id = cm.club_id
             where cm.profile_id = p.id and cm.status = 'active' and cm.is_current
             order by cm.created_at desc limit 1) as pcat,
           coalesce((select n.n_strength from net n where n.n_id = p.id), 0) as nstr,
           (select count(*) from public.profile_follows f1
              join public.profile_follows f2 on f2.follower_profile_id = f1.followed_profile_id
             where f1.follower_profile_id = p_viewer and f2.followed_profile_id = p.id) as mutual
    from public.profiles p
    where p.id <> p_viewer
      and p.full_name is not null and p.role::text <> 'admin' and not coalesce(p.is_admin, false)
      and not exists (select 1 from public.profile_follows pf where pf.follower_profile_id = p_viewer and pf.followed_profile_id = p.id)
      and not exists (select 1 from blocked b where b.b_id = p.id)
  ),
  scored as (
    select c.pid,
      coalesce((v_matrix -> v_role ->> c.acat)::numeric, (v_matrix ->> 'default_boost')::numeric) as m,
      (c.pregion is not null and v_region is not null and c.pregion = v_region) as g,
      c.nstr, (c.pcat is not null and c.pcat = any(v_cats)) as k, least(c.mutual, 3) / 3.0 as mu
    from cand c
  ),
  final as (
    select s.pid,
      (s.m * (v_w ->> 'role')::numeric
       + (case when s.g then 1 else 0 end) * (v_w ->> 'geo')::numeric
       + s.nstr * (v_w ->> 'network')::numeric
       + (case when s.k then 1 else 0 end) * (v_w ->> 'category')::numeric
       + s.mu * (v_w ->> 'mutual')::numeric) as sc,
      case when s.nstr > 0 or s.mu > 0 then 'network_context'
           when s.g then 'same_region'
           else 'open_position_match' end as rs
    from scored s
  )
  select f.pid, round(f.sc, 4), f.rs
  from final f
  where f.sc >= v_min
  order by f.sc desc, f.pid asc
  limit greatest(p_limit, 0);
end;
$$;

-- Etichetta in più per i suggeriti di rete (§216: nessun numero, solo parole).
-- Riemessa dalla definizione vigente (20260727100000, mai ridefinita dopo).
create or replace function public.footme_feed_reason_label(
  p_reason_key  text,
  p_entity_name text default null
)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_reason_key
    when 'followed_club_publisher'    then 'Dalla società che segui'
    when 'followed_profile_publisher' then 'Dal profilo che segui'
    when 'followed_club_position'     then coalesce(
      nullif(p_entity_name, '') || ' ha pubblicato una posizione',
      'Da una società che segui'
    )
    when 'same_region'                then 'Dalla tua zona'
    when 'preferred_source'           then 'In base ai tuoi interessi'
    when 'open_position_match'        then 'In base al tuo profilo'
    when 'popular_now'                then 'Tra i contenuti recenti'
    when 'not_followed_yet'           then 'Da scoprire'
    when 'network_context'            then 'Nella tua rete'
    else null
  end;
$$;

-- ============================================================
-- SEZIONE 4 — pipeline: costruzione dello snapshot
-- (§11: Eligibility → Candidate pool → Feature/score → Diversity → Dedup →
--  Module insertion → snapshot). Chiamata solo da fetch_home_for_you_page.
-- ============================================================

create or replace function public.footme_feed_build_units(p_session uuid, p_fallback boolean, p_target integer)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  s            public.feed_sessions%rowtype;
  v_cfg        jsonb := public.footme_feed_ranking_config();
  w            jsonb := v_cfg -> 'weights';
  dv           jsonb := v_cfg -> 'diversity';
  ln_          jsonb := v_cfg -> 'learning';
  ex_          jsonb := v_cfg -> 'exploration';
  mo           jsonb := v_cfg -> 'modules' -> 'opportunity';
  ms           jsonb := v_cfg -> 'modules' -> 'suggested_profiles';
  mc           jsonb := v_cfg -> 'modules' -> 'suggested_clubs';
  sn           jsonb := v_cfg -> 'snapshot';
  fl           jsonb := v_cfg -> 'flags';
  v_simple     boolean := p_fallback;
  v_viewer     uuid;
  v_role       text;
  v_regions    text[];
  v_main_region text;
  v_cats       text[];
  v_conf       numeric := 0;
  v_blend      numeric := 0;
  v_evidence   numeric := 0;
  v_floor      integer := (sn ->> 'floor_days')::int;
  v_min_cand   integer := (sn ->> 'min_candidates')::int;
  v_budget     integer;
  v_level      smallint := 1;
  v_try        integer;
  v_cnt        integer;
  v_prev_cnt   integer;
  v_prev_level smallint;
  v_sec_min    integer := (v_cfg -> 'broadening' ->> 'second_degree_min')::int;
  v_cap        numeric := (ln_ ->> 'signal_cap')::numeric;
  -- pesi effettivi (in modalità semplice: solo recency + follow + regione, §265)
  w_follow numeric; w_net numeric; w_role numeric; w_geo numeric; w_cat numeric; w_rec numeric;
  w_la numeric; w_lc numeric; w_lf numeric; w_ver numeric; w_eng numeric; w_new numeric; w_rep numeric;
  -- greedy
  v_pos        integer;
  v_start      integer;
  v_kc         integer := 0;
  v_row        record;
  v_target     integer;
  v_pick       text;
  v_r          integer;
  v_pref       text;
  v_ha uuid[] := '{}'; v_hs uuid[] := '{}';
  v_last_a uuid; v_run_a integer := 0; v_last_f text; v_run_f integer := 0; v_last_c text; v_run_c integer := 0;
  v_cap_a integer := (dv ->> 'author_consecutive_cap')::int;
  v_win_a integer := (dv ->> 'author_window')::int;
  v_wcap_a integer := (dv ->> 'author_window_cap')::int;
  v_cap_f integer := (dv ->> 'format_run_cap')::int;
  v_cap_c integer := (dv ->> 'category_run_cap')::int;
  v_win_s integer := (dv ->> 'society_window')::int;
  v_wcap_s integer := (dv ->> 'society_window_cap')::int;
  v_cap_r integer := (dv ->> 'reference_run_cap')::int;
  v_win_r integer := (dv ->> 'reference_window')::int;
  v_wcap_r integer := (dv ->> 'reference_window_cap')::int;
  v_last_r text; v_run_r integer := 0; v_hr text[] := '{}';
  v_clb_total integer := 0; v_clb_done integer := 0; v_clb_cnt integer; v_since_clb integer; v_gap_clb integer;
  v_since_opp  integer; v_since_sug integer; v_last_mod integer;
  v_opp_n integer := 0; v_opp_left integer := 0; v_opp_ad uuid; v_opp_rel numeric;
  v_sug_n integer; v_sug_total integer := 0; v_sug_done integer := 0; v_sug_cnt integer;
  v_gap_opp integer; v_gap_sug integer;
  v_emitted integer := 0;
  v_dups integer := 0;
begin
  select * into s from public.feed_sessions where id = p_session;
  v_viewer := s.viewer_profile_id;
  v_target := coalesce(p_target, (sn ->> 'size')::int);
  v_budget := ceil(v_target * (sn ->> 'overfetch')::numeric)::int;
  -- Il broadening si ferma solo quando i candidati coprono la dimensione richiesta dello
  -- snapshot (non una soglia fissa più bassa): così lo snapshot non si dichiara esaurito
  -- finché esistono candidati a livelli più ampi (recall prima di precision, §159).
  v_min_cand := greatest(v_min_cand, v_target);

  select r.i_role into v_role from public.footme_feed_resolve_identity(v_viewer, s.identity_type, s.identity_id) r limit 1;

  -- ── contesto: aree e categorie dell'identità attiva (§132, §22) ──
  select coalesce(array_agg(distinct x) filter (where x is not null), '{}') into v_regions from (
    select pr.region as x from public.profiles pr where pr.id = v_viewer and s.identity_type <> 'society'
    union select unnest(pp.transfer_regions) from public.player_profiles pp where pp.profile_id = v_viewer and s.identity_type <> 'society'
    union select unnest(cp.preferred_regions) from public.coach_profiles cp where cp.profile_id = v_viewer and s.identity_type <> 'society'
    union select unnest(sp.preferred_regions) from public.staff_profiles sp where sp.profile_id = v_viewer and s.identity_type <> 'society'
    union select unnest(dp.preferred_regions) from public.director_profiles dp where dp.profile_id = v_viewer and s.identity_type <> 'society'
    union select unnest(ap.operating_regions) from public.agent_profiles ap where ap.profile_id = v_viewer and s.identity_type <> 'society'
    union select c.region from public.clubs c where s.identity_type = 'society' and c.id = s.identity_id
  ) t;
  select case when s.identity_type = 'society' then (select c.region from public.clubs c where c.id = s.identity_id)
              else (select pr.region from public.profiles pr where pr.id = v_viewer) end into v_main_region;
  select coalesce(array_agg(distinct x) filter (where x is not null), '{}') into v_cats from (
    select unnest(pp.preferred_categories) as x from public.player_profiles pp where pp.profile_id = v_viewer and s.identity_type <> 'society'
    union select unnest(cp.preferred_categories) from public.coach_profiles cp where cp.profile_id = v_viewer and s.identity_type <> 'society'
    union select unnest(sp.preferred_categories) from public.staff_profiles sp where sp.profile_id = v_viewer and s.identity_type <> 'society'
    union select c.category from public.club_members cm join public.clubs c on c.id = cm.club_id
           where s.identity_type <> 'society' and cm.profile_id = v_viewer and cm.status = 'active' and cm.is_current
    union select c.category from public.clubs c where s.identity_type = 'society' and c.id = s.identity_id
  ) t;

  -- ── tabelle di lavoro ──
  drop table if exists _fs_net; drop table if exists _fs_ev; drop table if exists _fs_sig;
  drop table if exists _fs_neg; drop table if exists _fs_seen; drop table if exists _fs_rg;
  drop table if exists _fs_c; drop table if exists _fs_opp;
  create temp table _fs_net (n_kind text, n_id uuid, n_strength numeric, n_via integer) on commit drop;
  create temp table _fs_sig (k text, key text, v numeric) on commit drop;
  create temp table _fs_neg (k text, key text, n integer) on commit drop;
  create temp table _fs_seen (ct text, post uuid, crosstab boolean) on commit drop;
  create temp table _fs_rg (g_content_type text, g_post_id uuid, g_published_at timestamptz,
                            g_reposter_type text, g_reposter_id uuid, g_additional integer) on commit drop;
  create temp table _fs_opp (ad_id uuid, rel numeric, taken boolean default false) on commit drop;
  create temp table _fs_c (
    dedupe_key text primary key, unit_type text, content_type text, post_id uuid,
    author_key uuid, author_cat text, society_key uuid, fmt text, topic text,
    rank_at timestamptz, is_follow boolean, net numeric, net_via integer, role_boost numeric,
    geo boolean, geo_main boolean, cat boolean, rec numeric, ver boolean, eng numeric, rep_n integer,
    seen boolean, cross_tab boolean, is_new boolean, lvl smallint, pool text, is_expl boolean,
    score numeric, reason text, reposter_type text, reposter_id uuid, additional integer,
    ref_key text, kept boolean default false, taken boolean default false) on commit drop;

  if not v_simple then
    insert into _fs_net select * from public.footme_feed_network(v_viewer, s.identity_type, s.identity_id, 1);

    -- ── segnali positivi (§43-§53), identità attiva per le tabelle identity-level ──
    create temp table _fs_ev on commit drop as
    select e.kind, e.ct, e.post, e.pubt, e.pubid, e.wt, e.at from (
      select 'like'::text kind, l.content_type ct, l.post_id post, null::text pubt, null::uuid pubid,
             (ln_ -> 'signal_weights' ->> 'like')::numeric wt, l.created_at at
        from public.content_likes l
       where l.actor_type = s.identity_type and l.actor_id = s.identity_id
      union all
      select 'comment', c.content_type, c.content_id, null, null, (ln_ -> 'signal_weights' ->> 'comment')::numeric, c.created_at
        from public.content_comments c
       where c.author_type = s.identity_type and c.author_id = s.identity_id and c.deleted_at is null
      union all
      select 'repost', r.content_type, r.content_id, null, null, (ln_ -> 'signal_weights' ->> 'repost')::numeric, r.created_at
        from public.content_reposts r
       where r.reposter_identity_type = s.identity_type and r.reposter_identity_id = s.identity_id and r.status = 'active'
      union all
      select 'save', x.ct, x.post_id, null, null, (ln_ -> 'signal_weights' ->> 'save')::numeric, x.created_at from (
        select 'club_media'::text ct, a.post_id, a.created_at from public.saved_club_media a where a.profile_id = v_viewer
        union all select 'media_profile', a.post_id, a.created_at from public.saved_media_profile_posts a where a.profile_id = v_viewer
        union all select 'media_tribuna', a.post_id, a.created_at from public.saved_media_tribuna a where a.profile_id = v_viewer
        union all select 'fan_tribuna', a.post_id, a.created_at from public.saved_fan_tribuna a where a.profile_id = v_viewer
        union all select 'fan_media', a.post_id, a.created_at from public.saved_fan_media a where a.profile_id = v_viewer
        union all select 'profile_post', a.post_id, a.created_at from public.saved_profile_posts a where a.profile_id = v_viewer) x
      union all
      select 'share', sa.content_type, sa.content_id, null, null, (ln_ -> 'signal_weights' ->> 'share')::numeric, sa.created_at
        from public.content_share_actions sa where sa.sharer_profile_id = v_viewer
      union all
      select 'application', null, null, 'club', ra.club_id, (ln_ -> 'signal_weights' ->> 'application')::numeric, app.created_at
        from public.recruiting_applications app join public.recruiting_ads ra on ra.id = app.ad_id
       where app.applicant_profile_id = v_viewer
      union all
      select 'profile_open', null, null, ce.publisher_type, ce.publisher_id, (ln_ -> 'signal_weights' ->> 'profile_open')::numeric, ce.occurred_at
        from public.content_events ce
       where ce.viewer_profile_id = v_viewer and ce.event_type in ('author_profile_open', 'society_open')
      union all
      select 'article_open', ce.content_type, ce.post_id, ce.publisher_type, ce.publisher_id, (ln_ -> 'signal_weights' ->> 'article_open')::numeric, ce.occurred_at
        from public.content_events ce where ce.viewer_profile_id = v_viewer and ce.event_type = 'article_open'
      union all
      -- watch time non obiettivo (§49): UN solo contributo per contenuto, peso basso.
      select 'video_watch', vw.content_type, vw.post_id, vw.publisher_type, vw.publisher_id, (ln_ -> 'signal_weights' ->> 'video_watch')::numeric, vw.at
        from (select ce.content_type, ce.post_id, ce.publisher_type, ce.publisher_id, max(ce.occurred_at) at
                from public.content_events ce
               where ce.viewer_profile_id = v_viewer and ce.event_type = 'video_watch'
               group by 1, 2, 3, 4) vw
      union all
      select 'follow_after_exposure', null, null, 'profile', pf.followed_profile_id, (ln_ -> 'signal_weights' ->> 'follow_after_exposure')::numeric, pf.created_at
        from public.profile_follows pf
       where pf.follower_profile_id = v_viewer
         and exists (select 1 from public.content_events ce
                      where ce.viewer_profile_id = v_viewer and ce.event_type = 'impression'
                        and ce.publisher_type = 'profile' and ce.publisher_id = pf.followed_profile_id
                        and ce.occurred_at between pf.created_at - interval '24 hours' and pf.created_at)
      union all
      select 'follow_after_exposure', null, null, 'club', cf.club_id, (ln_ -> 'signal_weights' ->> 'follow_after_exposure')::numeric, cf.created_at
        from public.club_follows cf
       where cf.profile_id = v_viewer
         and exists (select 1 from public.content_events ce
                      where ce.viewer_profile_id = v_viewer and ce.event_type = 'impression'
                        and ce.publisher_type = 'club' and ce.publisher_id = cf.club_id
                        and ce.occurred_at between cf.created_at - interval '24 hours' and cf.created_at)
    ) e
    where e.at > s.as_of - make_interval(days => (ln_ ->> 'lookback_days')::int);

    select coalesce(sum(e.wt), 0) into v_evidence from _fs_ev e;
    v_conf := 1 - exp(-v_evidence / (ln_ ->> 'confidence_k')::numeric);
    v_blend := v_conf * (ln_ ->> 'max_blend')::numeric;

    insert into _fs_sig
    with ev as (
      select e.wt * exp(-greatest(extract(epoch from (s.as_of - e.at)) / 86400.0, 0) / (ln_ ->> 'decay_days')::numeric) as wt,
             coalesce(e.pubt, fci.publisher_type) as pubt, coalesce(e.pubid, fci.publisher_id) as pubid,
             fci.content_format as fmt
        from _fs_ev e
        left join public.feed_content_index fci on fci.content_type = e.ct and fci.post_id = e.post
    ), ev2 as (
      select ev.wt, ev.pubid, ev.fmt,
             case when ev.pubt = 'club' then 'society' when pr.role::text = 'club_admin' then 'society'
                  else pr.role::text end as acat
        from ev left join public.profiles pr on ev.pubt = 'profile' and pr.id = ev.pubid
    )
    select 'author', ev2.pubid::text, sum(ev2.wt) from ev2 where ev2.pubid is not null group by ev2.pubid
    union all select 'cat', ev2.acat, sum(ev2.wt) from ev2 where ev2.acat is not null group by ev2.acat
    union all select 'fmt', ev2.fmt, sum(ev2.wt) from ev2 where ev2.fmt is not null group by ev2.fmt;

    -- ── segnali negativi HOM-11 (§58-§63): contenuto escluso dall'eligibility;
    -- qui solo l'effetto SULLE CARATTERISTICHE, mai l'azzeramento dell'autore (§60).
    insert into _fs_neg
    select 'author', ni.author_identity_id::text, count(*)::int
      from public.feed_not_interested ni where ni.viewer_profile_id = v_viewer
     group by ni.author_identity_id
    union all
    select case ni.reason_id when 'topic_not_interested' then 'topic' when 'not_relevant' then 'rel_cat'
                             when 'too_many_similar' then 'similar' end,
           case ni.reason_id when 'topic_not_interested' then fci.kind
                             when 'not_relevant' then
                               case when fci.publisher_type = 'club' then 'society' else pr.role::text end
                             when 'too_many_similar' then fci.content_format end,
           count(*)::int
      from public.feed_not_interested ni
      join public.feed_content_index fci on fci.content_type = ni.content_type and fci.post_id = ni.content_id
      left join public.profiles pr on fci.publisher_type = 'profile' and pr.id = fci.publisher_id
     where ni.viewer_profile_id = v_viewer and ni.reason_id in ('topic_not_interested', 'not_relevant', 'too_many_similar')
     group by 1, 2
    having case ni.reason_id when 'topic_not_interested' then fci.kind
                             when 'not_relevant' then case when fci.publisher_type = 'club' then 'society' else pr.role::text end
                             when 'too_many_similar' then fci.content_format end is not null;

    -- ── seen-state da impression HOM-05 (§75-§80) ──
    insert into _fs_seen
    select ce.content_type, ce.post_id,
           bool_or(ce.source = 'HOME_FOLLOWING' and ce.occurred_at > s.as_of - make_interval(hours => (ln_ ->> 'cross_tab_hours')::int))
      from public.content_events ce
     where ce.viewer_profile_id = v_viewer and ce.event_type = 'impression'
       and ce.occurred_at > s.as_of - make_interval(days => (ln_ ->> 'seen_days')::int)
     group by ce.content_type, ce.post_id;

    w_follow := (w ->> 'follow')::numeric; w_net := (w ->> 'network')::numeric; w_role := (w ->> 'role')::numeric;
    w_geo := (w ->> 'geo')::numeric; w_cat := (w ->> 'category')::numeric; w_rec := (w ->> 'recency')::numeric;
    w_la := (w ->> 'learned_author')::numeric; w_lc := (w ->> 'learned_category')::numeric; w_lf := (w ->> 'learned_format')::numeric;
    w_ver := (w ->> 'verified')::numeric; w_eng := (w ->> 'engagement')::numeric; w_new := (w ->> 'new_creator')::numeric;
    w_rep := (w ->> 'repost_network')::numeric;
  else
    -- §265: ranking semplice = recency + follow + regione
    w_follow := 1; w_net := 0; w_role := 0; w_geo := 0.3; w_cat := 0; w_rec := 0.6;
    w_la := 0; w_lc := 0; w_lf := 0; w_ver := 0; w_eng := 0; w_new := 0; w_rep := 0.3;
  end if;

  -- ── Simple Repost (HOM-10): stesso insieme di Seguiti (reposter seguito), §100-§105 ──
  insert into _fs_rg select g.* from public.footme_feed_repost_groups(v_viewer, s.as_of) g;

  -- ── eligibility + feature enrichment (§13-§15, §41). Due tentativi: con la
  -- finestra recente, poi senza (broadening livello 4, §164). ──
  for v_try in 1..2 loop
    if v_try = 2 then
      v_prev_cnt := v_cnt; v_prev_level := v_level;
      exit when v_floor is null or v_cnt >= v_min_cand or not coalesce((fl ->> 'broadening_enabled')::boolean, true);
      delete from _fs_c; v_floor := null;
    end if;

    insert into _fs_c (dedupe_key, unit_type, content_type, post_id, author_key, author_cat, society_key, fmt, topic,
                       rank_at, is_follow, net, net_via, role_boost, geo, geo_main, cat, rec, ver, eng, rep_n,
                       seen, cross_tab, is_new, reposter_type, reposter_id, additional, ref_key)
    select x.e_ct || ':' || x.e_post,
           case when g.g_post_id is not null then 'SIMPLE_REPOST' else 'CONTENT' end,
           x.e_ct, x.e_post, x.e_pub_id,
           case when x.e_pub_type = 'club' or pr.role::text = 'club_admin' then 'society'
                when mp.profile_id is not null then 'media' else coalesce(pr.role::text, 'person') end,
           case when x.e_pub_type = 'club' then x.e_pub_id else cur.club_id end,
           x.e_format, x.e_kind,
           coalesce(g.g_published_at, x.e_published_at),
           case when x.e_pub_type = 'club'
                then exists (select 1 from public.club_follows f where f.profile_id = v_viewer and f.club_id = x.e_pub_id)
                else exists (select 1 from public.profile_follows f where f.follower_profile_id = v_viewer and f.followed_profile_id = x.e_pub_id) end,
           coalesce(n.n_strength, 0), coalesce(n.n_via, 0),
           case when v_simple then 0 else coalesce(
             (v_cfg -> 'role_matrix' -> v_role ->> (case when x.e_pub_type = 'club' or pr.role::text = 'club_admin' then 'society'
                                                         when mp.profile_id is not null then 'media' else coalesce(pr.role::text, 'person') end))::numeric,
             (v_cfg -> 'role_matrix' ->> 'default_boost')::numeric) end,
           (x.e_region is not null and x.e_region = any(v_regions)),
           (x.e_region is not null and x.e_region = v_main_region),
           (coalesce(cur.category, cl.category) is not null and coalesce(cur.category, cl.category) = any(v_cats)),
           exp(-ln(2) * greatest(extract(epoch from (s.as_of - coalesce(g.g_published_at, x.e_published_at))) / 3600.0, 0)
               / (case when x.e_format = 'articolo' then (v_cfg -> 'recency' ->> 'article_half_life_hours')::numeric
                       else (v_cfg -> 'recency' ->> 'half_life_hours')::numeric end)),
           x.e_verified,
           case when eng.engagement_count is null then 0
                else least(ln(1 + eng.engagement_count) / ln(1 + 20), 1) end,
           count(*) filter (where x.e_published_at > s.as_of - interval '24 hours') over (partition by x.e_pub_id),
           exists (select 1 from _fs_seen sn_ where sn_.ct = x.e_ct and sn_.post = x.e_post),
           exists (select 1 from _fs_seen sn_ where sn_.ct = x.e_ct and sn_.post = x.e_post and sn_.crosstab),
           coalesce(case when x.e_pub_type = 'club' then cl.created_at else pr.created_at end, s.as_of - interval '3650 days')
             > s.as_of - make_interval(days => (ex_ ->> 'new_creator_days')::int),
           g.g_reposter_type, g.g_reposter_id, g.g_additional,
           -- §103, §107: gruppo di reference = l'originale cui il Post si riferisce, altrimenti sé stesso
           case when ex.referenced_content_id is not null
                then ex.referenced_content_type || ':' || ex.referenced_content_id else x.e_ct || ':' || x.e_post end
    from (
      select * from public.footme_feed_eligible_content(v_viewer, s.identity_type, s.identity_id, s.as_of, v_floor, null, null)
      union
      select * from public.footme_feed_eligible_content(v_viewer, s.identity_type, s.identity_id, s.as_of, null,
                      coalesce((select array_agg(r.g_content_type) from _fs_rg r), '{}'),
                      coalesce((select array_agg(r.g_post_id) from _fs_rg r), '{}'))
    ) x
    left join _fs_rg g on g.g_content_type = x.e_ct and g.g_post_id = x.e_post
    left join public.profiles pr on x.e_pub_type = 'profile' and pr.id = x.e_pub_id
    left join public.media_profiles mp on x.e_pub_type = 'profile' and mp.profile_id = x.e_pub_id
    left join public.clubs cl on x.e_pub_type = 'club' and cl.id = x.e_pub_id
    left join lateral (
      select cm.club_id, c2.category from public.club_members cm join public.clubs c2 on c2.id = cm.club_id
       where x.e_pub_type = 'profile' and cm.profile_id = x.e_pub_id and cm.status = 'active' and cm.is_current
       order by cm.created_at desc limit 1) cur on true
    left join _fs_net n on n.n_kind = case when x.e_pub_type = 'club' then 'club' else 'profile' end and n.n_id = x.e_pub_id
    left join public.media_content_engagement eng on eng.content_type = x.e_ct and eng.post_id = x.e_post
    left join public.content_post_extras ex on ex.content_type = x.e_ct and ex.post_id = x.e_post
    where not exists (select 1 from public.feed_session_units u where u.session_id = p_session and u.dedupe_key = x.e_ct || ':' || x.e_post)
    on conflict (dedupe_key) do nothing;

    -- livello di rilevanza: 1 rete/area/forte rilevanza, 2 regione/rete estesa/ruoli
    -- complementari, 3 Italia (tutto il leggibile). Il 4 è la finestra senza floor.
    update _fs_c c set lvl = case
      when c.is_follow or c.net_via >= v_sec_min or c.net >= 0.7 or c.geo or c.role_boost >= 0.7
           or exists (select 1 from _fs_sig sg where sg.k = 'author' and sg.key = c.author_key::text and sg.v >= 1) then 1
      when c.role_boost >= 0.5 or c.geo_main or c.net > 0 then 2
      else 3 end;

    v_level := 1;
    if coalesce((fl ->> 'broadening_enabled')::boolean, true) then
      while v_level < 3 and (select count(*) from _fs_c c where c.lvl <= v_level) < v_min_cand loop
        v_level := v_level + 1;
      end loop;
    end if;
    select count(*) into v_cnt from _fs_c c where c.lvl <= v_level;
    -- livello 4 (finestra senza floor) solo se ha davvero aggiunto candidati
    if v_try = 2 then v_level := case when v_cnt > v_prev_cnt then 4 else v_prev_level end; end if;
  end loop;
  delete from _fs_c c where c.lvl > least(v_level, 3);

  -- ── score (§41-§53, §72, §152-§157): blend continuo profilo/geografia/matrice/rete
  -- ↔ preferenze apprese, in funzione della confidence. ──
  update _fs_c c set score =
      w_follow * (case when c.is_follow then 1 else 0 end)
    + w_rec * c.rec
    + (1 - v_blend) * (w_role * c.role_boost + w_geo * (case when c.geo then 1 else 0 end)
                       + w_net * c.net + w_cat * (case when c.cat then 1 else 0 end))
    + v_blend * (case when (w_la + w_lc + w_lf) = 0 then 0 else
        (w_la * least(coalesce((select sg.v from _fs_sig sg where sg.k = 'author' and sg.key = c.author_key::text), 0) / v_cap, 1)
       + w_lc * least(coalesce((select sg.v from _fs_sig sg where sg.k = 'cat' and sg.key = c.author_cat), 0) / v_cap, 1)
       + w_lf * least(coalesce((select sg.v from _fs_sig sg where sg.k = 'fmt' and sg.key = c.fmt), 0) / v_cap, 1))
        / (w_la + w_lc + w_lf) * (w_role + w_geo + w_net + w_cat) end)
    + w_ver * (case when c.ver then 1 else 0 end) + w_eng * c.eng
    + w_new * (case when c.is_new and not c.is_follow then 1 else 0 end)
    + (case when c.unit_type = 'SIMPLE_REPOST' then coalesce(w_rep, 0) else 0 end)
    - (case when c.seen then (w ->> 'seen_penalty')::numeric else 0 end)
    - (case when c.cross_tab then (w ->> 'cross_tab_penalty')::numeric else 0 end)
    - (w ->> 'ni_author_penalty')::numeric * least(coalesce((select ng.n from _fs_neg ng where ng.k = 'author' and ng.key = c.author_key::text), 0), 3)
    - (case when exists (select 1 from _fs_neg ng where ng.k = 'topic' and ng.key = c.topic) then (w ->> 'ni_topic_penalty')::numeric else 0 end)
    - (case when exists (select 1 from _fs_neg ng where ng.k = 'rel_cat' and ng.key = c.author_cat) then (w ->> 'ni_relevance_penalty')::numeric else 0 end)
    - (case when c.rep_n >= (dv ->> 'repeat_publication_threshold')::int then (w ->> 'repeat_publication_penalty')::numeric else 0 end),
    pool = case when c.is_follow then 'follow' when c.net > 0 then 'network' when c.role_boost >= 0.7 then 'professional'
                when c.geo then 'geographic' when c.cat then 'football'
                when c.author_cat in ('society', 'media') then 'editorial' else 'discovery' end,
    is_expl = (not c.is_follow and c.net = 0 and (c.role_boost >= 0.5 or c.geo or c.cat)),
    reason = case when c.unit_type = 'SIMPLE_REPOST' then 'REPOST_NETWORK' when c.is_follow then 'FOLLOWED_AUTHOR'
                  when c.net > 0 then 'NETWORK_RELEVANCE' when c.geo then 'GEOGRAPHIC_RELEVANCE'
                  when c.role_boost >= 0.7 then 'PROFESSIONAL_RELEVANCE'
                  when not c.is_follow and c.net = 0 and (c.role_boost >= 0.5 or c.geo or c.cat) then 'EXPLORATION'
                  else 'DISCOVERY' end;

  -- ── candidate pool: budget per pool da config (§17, §27); il non usato si
  -- redistribuisce per score (recall prima di precision, §159). ──
  if not v_simple and coalesce((fl ->> 'pool_mix_enabled')::boolean, true) then
    update _fs_c c set kept = (r.rn <= ceil(v_budget * coalesce((v_cfg -> 'pools' ->> c.pool)::numeric, 0.1)))
      from (select c2.dedupe_key, row_number() over (partition by c2.pool order by c2.score desc, c2.rank_at desc, c2.dedupe_key) rn from _fs_c c2) r
     where r.dedupe_key = c.dedupe_key;
    update _fs_c c set kept = true
     where c.dedupe_key in (select c2.dedupe_key from _fs_c c2 where not c2.kept
                            order by c2.score desc, c2.rank_at desc, c2.dedupe_key
                            limit greatest(v_budget - (select count(*) from _fs_c c3 where c3.kept), 0))
        or (c.is_new and not c.is_follow);
    delete from _fs_c c where not c.kept;
  end if;

  -- ── Posizioni (D2) ──
  if not v_simple and coalesce((fl ->> 'opportunities_enabled')::boolean, true) then
    insert into _fs_opp (ad_id, rel)
    select pc.p_ad_id, pc.p_relevance
      from public.footme_feed_position_candidates(v_viewer, s.identity_type, s.as_of, null) pc
     where pc.p_relevance >= (mo ->> 'min_relevance')::numeric
       and not exists (select 1 from public.feed_session_units u where u.session_id = p_session and u.dedupe_key = 'recruiting_ad:' || pc.p_ad_id::text)
     order by pc.p_relevance desc, pc.p_published_at desc, pc.p_ad_id
     limit (mo ->> 'max_per_snapshot')::int;
    select count(*) into v_opp_left from _fs_opp;

    -- ── moduli Profili suggeriti: segnaposto solo se i candidati reggono (§191) ──
    if coalesce((fl ->> 'suggested_enabled')::boolean, true) then
      select count(*) into v_sug_cnt
        from public.footme_feed_suggested_candidates(v_viewer, s.identity_type, s.identity_id,
               (v_cfg -> 'suggested' ->> 'max_rows')::int * (ms ->> 'max_per_snapshot')::int);
      if v_sug_cnt >= (v_cfg -> 'suggested' ->> 'min_candidates')::int then
        v_sug_total := least((ms ->> 'max_per_snapshot')::int, greatest(1, v_sug_cnt / (v_cfg -> 'suggested' ->> 'max_rows')::int));
        v_sug_done := coalesce((select count(*) from public.feed_session_units u where u.session_id = p_session and u.unit_key like 'module:suggested_profiles:%'), 0);
      end if;
    end if;

    -- ── carosello Società (HOM-01.1): stessa regola «niente modulo debole». Candidati =
    -- stesso predicato di fetch_home_suggested_clubs (non propria, non bloccata, non seguita). ──
    if coalesce((fl ->> 'suggested_enabled')::boolean, true) then
      select count(*) into v_clb_cnt from public.clubs c
       where c.owner_profile_id is distinct from v_viewer
         and not exists (select 1 from public.footme_blocked_keys(v_viewer) bk where bk.b_kind = 'society' and bk.b_id = c.id)
         and not exists (select 1 from public.club_follows cf where cf.profile_id = v_viewer and cf.club_id = c.id);
      if v_clb_cnt >= (mc ->> 'min_candidates')::int then
        v_clb_total := (mc ->> 'max_per_snapshot')::int;
        v_clb_done := coalesce((select count(*) from public.feed_session_units u where u.session_id = p_session and u.unit_key like 'module:suggested_clubs:%'), 0);
      end if;
    end if;
  end if;

  -- ── diversity re-rank + module insertion → snapshot (§109-§126, §179-§182) ──
  v_pos := coalesce((select max(u.position) from public.feed_session_units u where u.session_id = p_session), 0);
  v_start := v_pos;
  v_since_opp := v_pos - coalesce((select max(u.position) from public.feed_session_units u where u.session_id = p_session and u.unit_type = 'OPPORTUNITY'), 0);
  v_since_sug := v_pos - coalesce((select max(u.position) from public.feed_session_units u where u.session_id = p_session and u.unit_key like 'module:suggested_profiles:%'), 0);
  v_since_clb := v_pos - coalesce((select max(u.position) from public.feed_session_units u where u.session_id = p_session and u.unit_key like 'module:suggested_clubs:%'), 0);
  v_last_mod := coalesce((select max(u.position) from public.feed_session_units u where u.session_id = p_session and u.unit_type in ('OPPORTUNITY', 'SUGGESTED_PROFILES')), -100);
  v_opp_n := coalesce((select count(*) from public.feed_session_units u where u.session_id = p_session and u.unit_type = 'OPPORTUNITY'), 0);

  while (v_pos - v_start) < v_target loop
    -- modulo Posizione dovuto?
    select o.ad_id, o.rel into v_opp_ad, v_opp_rel from _fs_opp o where not o.taken order by o.rel desc, o.ad_id limit 1;
    v_gap_opp := (mo ->> 'every_min')::int + abs(hashtext(p_session::text || 'o' || v_opp_n::text)) % greatest((mo ->> 'every_max')::int - (mo ->> 'every_min')::int + 1, 1);
    v_gap_clb := (mc ->> 'every_min')::int + abs(hashtext(p_session::text || 'c' || v_clb_done::text)) % greatest((mc ->> 'every_max')::int - (mc ->> 'every_min')::int + 1, 1);
    v_gap_sug := (ms ->> 'every_min')::int + abs(hashtext(p_session::text || 's' || v_sug_done::text)) % greatest((ms ->> 'every_max')::int - (ms ->> 'every_min')::int + 1, 1);

    if v_opp_ad is not null and v_pos + 1 >= (mo ->> 'first_at')::int
       and v_since_opp >= (case when v_opp_rel >= (mo ->> 'strong_score')::numeric then (mo ->> 'strong_gap')::int else v_gap_opp end)
       and (v_pos - v_last_mod) >= (mo ->> 'min_gap_other_module')::int then
      v_pos := v_pos + 1;
      insert into public.feed_session_units (session_id, position, unit_type, unit_key, dedupe_key, ad_id, candidate_source, reason, score)
      values (p_session, v_pos, 'OPPORTUNITY', 'recruiting_ad:' || v_opp_ad::text, 'recruiting_ad:' || v_opp_ad::text, v_opp_ad,
              'OPPORTUNITY', 'OPPORTUNITY_MATCH', v_opp_rel);
      update _fs_opp o set taken = true where o.ad_id = v_opp_ad;
      v_opp_n := v_opp_n + 1; v_since_opp := 0; v_since_sug := v_since_sug + 1; v_since_clb := v_since_clb + 1; v_last_mod := v_pos;
      continue;
    end if;

    if v_sug_done < v_sug_total and v_pos + 1 >= (ms ->> 'first_at')::int and v_since_sug >= v_gap_sug
       and (v_pos - v_last_mod) >= (mo ->> 'min_gap_other_module')::int then
      v_pos := v_pos + 1;
      insert into public.feed_session_units (session_id, position, unit_type, unit_key, dedupe_key, module_index, candidate_source, reason)
      values (p_session, v_pos, 'SUGGESTED_PROFILES', 'module:suggested_profiles:' || v_sug_done::text,
              'module:suggested_profiles:' || v_sug_done::text, v_sug_done, 'DISCOVERY', 'DISCOVERY');
      v_sug_done := v_sug_done + 1; v_since_sug := 0; v_since_opp := v_since_opp + 1; v_since_clb := v_since_clb + 1; v_last_mod := v_pos;
      continue;
    end if;

    if v_clb_done < v_clb_total and v_pos + 1 >= (mc ->> 'first_at')::int and v_since_clb >= v_gap_clb
       and (v_pos - v_last_mod) >= (mo ->> 'min_gap_other_module')::int then
      v_pos := v_pos + 1;
      insert into public.feed_session_units (session_id, position, unit_type, unit_key, dedupe_key, module_index, candidate_source, reason)
      values (p_session, v_pos, 'SUGGESTED_PROFILES', 'module:suggested_clubs:' || v_clb_done::text,
              'module:suggested_clubs:' || v_clb_done::text, v_clb_done, 'DISCOVERY', 'DISCOVERY');
      v_clb_done := v_clb_done + 1; v_since_clb := 0; v_since_opp := v_since_opp + 1; v_since_sug := v_since_sug + 1; v_last_mod := v_pos;
      continue;
    end if;

    -- contenuto: slot riservati a esplorazione e nuovi creator (§120-§125)
    v_kc := v_kc + 1;
    v_pref := case
      when not v_simple and coalesce((fl ->> 'exploration_enabled')::boolean, true)
           and floor(v_kc * (ex_ ->> 'share')::numeric) > floor((v_kc - 1) * (ex_ ->> 'share')::numeric) then 'expl'
      when not v_simple and coalesce((fl ->> 'exploration_enabled')::boolean, true)
           and floor(v_kc * (ex_ ->> 'new_creator_share')::numeric) > floor((v_kc - 1) * (ex_ ->> 'new_creator_share')::numeric) then 'new'
      else null end;

    v_pick := null;
    for v_r in (case when v_simple or not coalesce((fl ->> 'diversity_enabled')::boolean, true) then 2 else 0 end)..3 loop
      select c.dedupe_key into v_pick from _fs_c c
       where not c.taken
         and (v_r >= 3 or c.author_key is distinct from v_last_a or v_run_a < v_cap_a)
         and (v_r >= 2 or (select count(*) from unnest(v_ha[greatest(1, cardinality(v_ha) - v_win_a + 1):]) a where a = c.author_key) < v_wcap_a)
         and (v_r >= 1 or ((c.fmt is distinct from v_last_f or v_run_f < v_cap_f) and (c.author_cat is distinct from v_last_c or v_run_c < v_cap_c)))
         and (v_r >= 2 or c.ref_key is distinct from v_last_r or v_run_r < v_cap_r)
         and (v_r >= 2 or (select count(*) from unnest(v_hr[greatest(1, cardinality(v_hr) - v_win_r + 1):]) a where a = c.ref_key) < v_wcap_r)
         and (v_r >= 2 or c.society_key is null or (select count(*) from unnest(v_hs[greatest(1, cardinality(v_hs) - v_win_s + 1):]) a where a = c.society_key) < v_wcap_s)
       order by (case when v_pref = 'expl' and c.is_expl then 0 when v_pref = 'new' and c.is_new and not c.is_follow then 0 else 1 end),
                c.score desc, c.rank_at desc, c.dedupe_key
       limit 1;
      exit when v_pick is not null;
    end loop;
    exit when v_pick is null;

    select * into v_row from _fs_c c where c.dedupe_key = v_pick;
    update _fs_c c set taken = true where c.dedupe_key = v_pick;
    v_pos := v_pos + 1;
    insert into public.feed_session_units (session_id, position, unit_type, unit_key, dedupe_key, content_type, post_id,
                                           reposter_type, reposter_id, reposter_additional, reposted_at, candidate_source, reason, score)
    values (p_session, v_pos, v_row.unit_type,
            case when v_row.unit_type = 'SIMPLE_REPOST' then 'repost:' || v_row.dedupe_key else v_row.dedupe_key end,
            v_row.dedupe_key, v_row.content_type, v_row.post_id, v_row.reposter_type, v_row.reposter_id, v_row.additional,
            case when v_row.unit_type = 'SIMPLE_REPOST' then v_row.rank_at end,
            upper(v_row.pool), v_row.reason, round(v_row.score, 4));

    if v_row.author_key is not distinct from v_last_a then v_run_a := v_run_a + 1; else v_run_a := 1; v_last_a := v_row.author_key; end if;
    if v_row.fmt is not distinct from v_last_f then v_run_f := v_run_f + 1; else v_run_f := 1; v_last_f := v_row.fmt; end if;
    if v_row.author_cat is not distinct from v_last_c then v_run_c := v_run_c + 1; else v_run_c := 1; v_last_c := v_row.author_cat; end if;
    if v_row.ref_key is not distinct from v_last_r then v_run_r := v_run_r + 1; else v_run_r := 1; v_last_r := v_row.ref_key; end if;
    v_hr := v_hr || v_row.ref_key;
    v_ha := v_ha || v_row.author_key;
    v_hs := v_hs || coalesce(v_row.society_key, '00000000-0000-0000-0000-000000000000'::uuid);
    v_since_opp := v_since_opp + 1; v_since_sug := v_since_sug + 1; v_since_clb := v_since_clb + 1;
    v_emitted := v_emitted + 1;
  end loop;

  select count(*) into v_dups from _fs_c c where c.unit_type = 'SIMPLE_REPOST';
  update public.feed_sessions fs set
    unit_count = (select count(*) from public.feed_session_units u where u.session_id = p_session),
    exhausted = ((v_pos - v_start) < v_target),
    broadening_level = greatest(fs.broadening_level, v_level),
    confidence = case when v_simple then fs.confidence else round(v_conf, 4) end,
    cold_start = case when fs.unit_count = 0 then (not v_simple and v_conf < (ln_ ->> 'cold_start_confidence')::numeric) else fs.cold_start end,
    duplicates_prevented = fs.duplicates_prevented + v_dups,
    reposts_aggregated = fs.reposts_aggregated + (select count(*) from _fs_c c where c.unit_type = 'SIMPLE_REPOST' and c.additional > 0)
  where fs.id = p_session;

  return v_pos - v_start;
end;
$$;


-- Costruzione con fallback (§264-§266): un'eccezione del ranking avanzato
-- ricostruisce la sessione con il ranking semplice, marcata nella versione.
create or replace function public.footme_feed_fill_session(p_session uuid, p_target integer)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_cfg jsonb := public.footme_feed_ranking_config();
  v_err text;
  v_n   integer;
begin
  -- Serializza le costruzioni sulla stessa sessione: max(position) e l'inserimento
  -- delle unit devono vedere lo stato dopo l'eventuale estensione concorrente.
  perform 1 from public.feed_sessions fs where fs.id = p_session for update;

  if coalesce((v_cfg -> 'flags' ->> 'ranking_enabled')::boolean, true) then
    begin
      return public.footme_feed_build_units(p_session, false, p_target);
    exception when others then
      v_err := left(sqlstate || ': ' || sqlerrm, 200);
    end;
  else
    v_err := 'ranking_disabled';
  end if;

  v_n := public.footme_feed_build_units(p_session, true, p_target);
  update public.feed_sessions fs
     set is_fallback = true, fallback_reason = v_err,
         ranking_version = (v_cfg -> 'version' ->> 'ranking_version') || '-fallback'
   where fs.id = p_session;
  return v_n;
end;
$$;

-- Retention (§250-§251, §260): sessioni scadute e, per ogni viewer, solo le
-- ultime N. Gli eventi restano (feed_session_id → null).
create or replace function public.footme_feed_prune_sessions(p_viewer uuid default null)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_keep integer := (public.footme_feed_ranking_config() -> 'snapshot' ->> 'keep_per_viewer')::int;
  v_n integer;
begin
  delete from public.feed_sessions fs
   where (p_viewer is null or fs.viewer_profile_id = p_viewer)
     and (fs.expires_at <= timezone('utc', now())
          or fs.id in (select r.id from (
               select s2.id, row_number() over (partition by s2.viewer_profile_id order by s2.created_at desc, s2.id) rn
                 from public.feed_sessions s2
                where p_viewer is null or s2.viewer_profile_id = p_viewer) r
             where r.rn > v_keep));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ============================================================
-- SEZIONE 5 — fetch_home_for_you_page (Per te a sessione)
-- ============================================================

create or replace function public.fetch_home_for_you_page(
  p_session_id    uuid    default null,
  p_after_position integer default null,
  p_limit         integer default 10,
  p_identity_type text    default null,
  p_identity_id   uuid    default null)
returns table (
  item_uid text, item_type text, rank_position integer, rank_bucket smallint, layout_hint text,
  component_version smallint, title text, excerpt text, thumbnail_url text, published_at timestamptz,
  author_kind text, author_id uuid, author_name text, author_avatar_url text, author_source_kind text,
  author_is_verified boolean, is_seen boolean, is_saved boolean, is_following_author boolean,
  suggestion_reason_key text, suggestion_reason_label text, nav_kind text, nav_params jsonb, data jsonb,
  feed_session_id uuid, feed_unit_id text, unit_type text, ranking_version text,
  next_position integer, is_last_page boolean)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid     uuid := auth.uid();
  v_limit   integer := least(greatest(coalesce(p_limit, 10), 1), 30);
  v_cfg     jsonb;
  s         public.feed_sessions%rowtype;
  v_ident   record;
  v_after   integer;
  v_cursor  integer;
  v_iter    integer := 0;
  v_valid   integer;
  v_scanned integer;
  v_has_more boolean;
  v_truncated boolean := false;
  v_batch   integer;
  v_max_iter integer;
  v_next    integer;
  v_now     timestamptz := timezone('utc', now());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_cfg := public.footme_feed_ranking_config();
  v_max_iter := coalesce((v_cfg -> 'snapshot' ->> 'max_scan_iterations')::int, 40);

  if p_session_id is null then
    if p_after_position is not null then
      raise exception 'p_after_position richiede p_session_id';
    end if;

    select r.* into v_ident from public.footme_feed_resolve_identity(v_uid, p_identity_type, p_identity_id) r limit 1;
    if v_ident.i_id is null then
      raise exception 'Profilo non trovato';
    end if;

    perform public.footme_feed_prune_sessions(v_uid);

    insert into public.feed_sessions (viewer_profile_id, identity_type, identity_id, as_of, ranking_version, expires_at)
    values (v_uid, v_ident.i_type, v_ident.i_id, v_now,
            v_cfg -> 'version' ->> 'ranking_version',
            v_now + make_interval(hours => (v_cfg -> 'snapshot' ->> 'ttl_hours')::int))
    returning * into s;

    perform public.footme_feed_fill_session(s.id, (v_cfg -> 'snapshot' ->> 'size')::int);
    -- il fallback può aver cambiato ranking_version: rileggo la sessione
    select fs.* into s from public.feed_sessions fs where fs.id = s.id;
    v_after := 0;
  else
    select fs.* into s from public.feed_sessions fs
     where fs.id = p_session_id and fs.viewer_profile_id = v_uid and fs.expires_at > v_now;
    if not found then
      raise exception 'Sessione Feed non valida o scaduta' using errcode = 'P0002', hint = 'feed_session_expired';
    end if;
    v_after := greatest(coalesce(p_after_position, 0), 0);
  end if;

  drop table if exists _fs_page;
  create temp table _fs_page on commit drop as select u.* from public.feed_session_units u where false;

  v_cursor := v_after;
  v_batch := v_limit * 2 + 4;
  loop
    v_iter := v_iter + 1;
    -- limite di sicurezza: NON dichiara mai la fine del Feed (vedi is_last_page sotto)
    if v_iter > v_max_iter then v_truncated := true; exit; end if;

    with b as (
      select u.* from public.feed_session_units u
       where u.session_id = s.id and u.position > v_cursor
       order by u.position limit v_batch
    ),
    elig as (
      select e.e_ct, e.e_post from public.footme_feed_eligible_content(
        v_uid, s.identity_type, s.identity_id, v_now, null,
        coalesce((select array_agg(b.content_type) from b where b.content_type is not null), '{}'),
        coalesce((select array_agg(b.post_id) from b where b.post_id is not null), '{}')) e
    ),
    opp as (
      select pc.p_ad_id from public.footme_feed_position_candidates(
        v_uid, s.identity_type, v_now,
        coalesce((select array_agg(b.ad_id) from b where b.ad_id is not null), '{}')) pc
    ),
    ins as (
      insert into _fs_page
      select b.* from b
       where case b.unit_type
               -- §87-§88: ricontrollo delle sole esclusioni dure a lettura
               when 'CONTENT' then exists (select 1 from elig e where e.e_ct = b.content_type and e.e_post = b.post_id)
               when 'SIMPLE_REPOST' then exists (select 1 from elig e where e.e_ct = b.content_type and e.e_post = b.post_id)
                                         and public.footme_like_actor_visible(v_uid, b.reposter_type, b.reposter_id)
               when 'OPPORTUNITY' then exists (select 1 from opp o where o.p_ad_id = b.ad_id)
               else true end
      returning 1
    )
    select (select count(*) from b), coalesce((select max(b.position) from b), v_cursor) into v_scanned, v_cursor;

    v_batch := least(v_batch * 2, 400);

    select count(*) into v_valid from _fs_page;
    exit when v_valid >= v_limit + 1;

    if v_scanned = 0 then
      -- snapshot esaurito: estensione con le chiavi già emesse escluse (§98-§99).
      -- Lock sulla riga di sessione, poi RICONTROLLO: se una chiamata concorrente ha già
      -- esteso, si legge senza estendere di nuovo (niente collisione su (session_id, position)).
      exit when s.exhausted;
      perform 1 from public.feed_sessions fs where fs.id = s.id for update;
      select fs.* into s from public.feed_sessions fs where fs.id = s.id;
      if not exists (select 1 from public.feed_session_units u where u.session_id = s.id and u.position > v_cursor) then
        exit when s.exhausted;
        perform public.footme_feed_fill_session(s.id, (v_cfg -> 'snapshot' ->> 'extension_size')::int);
        select fs.* into s from public.feed_sessions fs where fs.id = s.id;
        exit when not exists (select 1 from public.feed_session_units u where u.session_id = s.id and u.position > v_cursor);
      end if;
    end if;
  end loop;

  select count(*) into v_valid from _fs_page;
  -- Se si esce per il limite di scansione il Feed NON è finito: is_last_page = false e il
  -- cursore riparte da dove la scansione è arrivata. (Una pagina vuota non può portare un
  -- cursore: in quel caso, irraggiungibile in pratica, si solleva feed_scan_truncated.)
  v_has_more := v_valid > v_limit or v_truncated;
  if v_valid > v_limit then
    select max(q.position) into v_next from (select p.position from _fs_page p order by p.position limit v_limit) q;
  else
    v_next := v_cursor;
  end if;
  if v_truncated and v_valid = 0 then
    raise exception 'Scansione del Feed interrotta' using errcode = 'P0001', hint = 'feed_scan_truncated';
  end if;

  return query
  with pg as (select p.* from _fs_page p order by p.position limit v_limit),
  keys as (
    select coalesce(array_agg(pg.content_type order by pg.position), '{}') as cts,
           coalesce(array_agg(pg.post_id order by pg.position), '{}') as ids
      from pg where pg.unit_type in ('CONTENT', 'SIMPLE_REPOST')
  ),
  payloads as (
    select pl.r_content_type, pl.r_post_id, pl.payload
      from keys k cross join lateral public.footme_post_payloads(v_uid, k.cts, k.ids) pl
  ),
  saved_content as (
    select 'club_media'::text as content_type, x.post_id from public.saved_club_media x where x.profile_id = v_uid
    union all select 'media_profile', x.post_id from public.saved_media_profile_posts x where x.profile_id = v_uid
    union all select 'media_tribuna', x.post_id from public.saved_media_tribuna x where x.profile_id = v_uid
    union all select 'fan_tribuna', x.post_id from public.saved_fan_tribuna x where x.profile_id = v_uid
    union all select 'fan_media', x.post_id from public.saved_fan_media x where x.profile_id = v_uid
    union all select 'profile_post', x.post_id from public.saved_profile_posts x where x.profile_id = v_uid
  ),
  me as (
    select pp.primary_position, coalesce(pp.secondary_positions, '{}') as secondary_positions
      from public.player_profiles pp where pp.profile_id = v_uid
  ),
  rows_ as (
    select
      pg.position, pg.unit_type, pg.unit_key,
      case when pg.unit_type in ('CONTENT', 'SIMPLE_REPOST') then public.footme_feed_item_type(fci.content_type, fci.content_format)
           when pg.unit_type = 'OPPORTUNITY' then 'suggested_position'
           when pg.unit_key like 'module:suggested_clubs:%' then 'suggested_clubs'
           else 'suggested_profiles' end as item_type,
      coalesce(fci.title, ra.title) as title,
      fci.excerpt as excerpt,
      fci.thumbnail_url as thumbnail_url,
      -- Simple Repost: data del repost più recente del gruppo (come Seguiti), non dell'originale
      case when pg.unit_type = 'SIMPLE_REPOST' then pg.reposted_at else coalesce(fci.published_at, ra.published_at) end as published_at,
      case when pg.unit_type = 'OPPORTUNITY' then 'club' else fci.publisher_type end as author_kind,
      case when pg.unit_type = 'OPPORTUNITY' then ra.club_id else fci.publisher_id end as author_id,
      case when pg.unit_type = 'OPPORTUNITY' then c.name else fci.publisher_name end as author_name,
      case when pg.unit_type = 'OPPORTUNITY' then c.logo_url else fci.publisher_avatar_url end as author_avatar_url,
      case when pg.unit_type = 'OPPORTUNITY' then 'ufficiale' else fci.source_kind end as author_source_kind,
      case when pg.unit_type = 'OPPORTUNITY' then coalesce(c.verification_status = 'verified', false)
           else coalesce(fci.publisher_is_verified, false) end as author_is_verified,
      case when pg.unit_type = 'OPPORTUNITY' then exists (select 1 from public.saved_ads sa where sa.profile_id = v_uid and sa.ad_id = pg.ad_id)
           when pg.unit_type = 'SUGGESTED_PROFILES' then false
           else exists (select 1 from saved_content sv where sv.content_type = fci.content_type and sv.post_id = fci.post_id) end as is_saved,
      case when pg.unit_type = 'SUGGESTED_PROFILES' then false
           when pg.unit_type = 'OPPORTUNITY'
             then exists (select 1 from public.club_follows f where f.profile_id = v_uid and f.club_id = ra.club_id)
           when fci.publisher_type = 'club'
             then exists (select 1 from public.club_follows f where f.profile_id = v_uid and f.club_id = fci.publisher_id)
           else exists (select 1 from public.profile_follows f where f.follower_profile_id = v_uid and f.followed_profile_id = fci.publisher_id) end as is_following,
      fci.content_type, fci.post_id, fci.kind, fci.content_format, fci.media_type, fci.duration_seconds,
      ra.id as ad_id, ra.club_id, ra.team_id, ct.name as team_name, ct.team_type, ra.role_required::text as role_required,
      coalesce(ra.category, ct.category, c.category) as category,
      coalesce(ct.city, c.city) as loc_city, coalesce(ct.province, c.province) as loc_province,
      coalesce(ra.region, ct.region, c.region) as loc_region, ra.target_role,
      (select (m.primary_position is not null and ra.role_required = any(m.secondary_positions) and ra.role_required <> m.primary_position) from me m) as is_secondary,
      pg.module_index, pg.reposter_type, pg.reposter_id, pg.reposter_additional
    from pg
    left join public.feed_content_index fci
      on pg.unit_type in ('CONTENT', 'SIMPLE_REPOST') and fci.content_type = pg.content_type and fci.post_id = pg.post_id
    left join public.recruiting_ads ra on pg.unit_type = 'OPPORTUNITY' and ra.id = pg.ad_id
    left join public.clubs c on c.id = ra.club_id
    left join public.club_teams ct on ct.id = ra.team_id
  )
  select
    r.unit_key,
    r.item_type,
    r.position,
    0::smallint,
    public.footme_feed_layout_hint(r.item_type, r.thumbnail_url is not null, length(coalesce(r.excerpt, ''))),
    public.footme_feed_component_version(r.item_type),
    r.title,
    case when r.excerpt is null then null when r.item_type = 'post' then left(r.excerpt, 280) else left(r.excerpt, 200) end,
    r.thumbnail_url,
    r.published_at,
    r.author_kind, r.author_id, r.author_name, r.author_avatar_url, r.author_source_kind, r.author_is_verified,
    false,
    r.is_saved,
    r.is_following,
    -- §214-§216: nessuna reason/score verso il client; solo l'etichetta contestuale §173/§281.
    case when r.unit_type = 'OPPORTUNITY' then 'open_position_match' else null end,
    case when r.unit_type = 'OPPORTUNITY' then public.footme_feed_reason_label('open_position_match') else null end,
    case when r.unit_type = 'OPPORTUNITY' then 'position' when r.unit_type = 'SUGGESTED_PROFILES' then null else 'content' end,
    case when r.unit_type = 'OPPORTUNITY' then jsonb_build_object('ad_id', r.ad_id)
         when r.unit_type = 'SUGGESTED_PROFILES' then null
         else jsonb_build_object('content_type', r.content_type, 'post_id', r.post_id) end,
    case
      when r.unit_type = 'OPPORTUNITY' then jsonb_build_object(
        'ad_id', r.ad_id, 'club_id', r.club_id, 'team_id', r.team_id, 'club_name', r.author_name,
        'club_logo_url', r.author_avatar_url, 'team_name', r.team_name, 'team_type', r.team_type,
        'role_required', r.role_required, 'category', r.category, 'city', r.loc_city, 'province', r.loc_province,
        'region', r.loc_region, 'target_role', r.target_role, 'is_secondary_match', coalesce(r.is_secondary, false))
      when r.unit_type = 'SUGGESTED_PROFILES' then jsonb_build_object(
        'module_key', r.item_type,
        'identity_type', s.identity_type,
        'identity_id', s.identity_id,
        'module_limit', case when r.item_type = 'suggested_clubs' then 6 else (v_cfg -> 'suggested' ->> 'max_rows')::int end,
        'module_index', r.module_index)
      else jsonb_build_object(
        'content_type', r.content_type, 'post_id', r.post_id, 'kind', r.kind,
        'kind_label', public.footme_content_kind_label(r.content_type, r.kind),
        'content_format', r.content_format, 'media_type', r.media_type, 'duration_seconds', r.duration_seconds,
        'is_truncated', length(coalesce(r.excerpt, '')) > (case when r.item_type = 'post' then 280 else 200 end))
        || case when ppl.payload is null then '{}'::jsonb
                else jsonb_set(ppl.payload, '{capabilities,can_mark_not_interested}',
                               to_jsonb(coalesce((ppl.payload #>> '{capabilities,can_report}')::boolean, false)), true) end
    end
    || case when r.unit_type = 'SIMPLE_REPOST' then jsonb_build_object('repost', jsonb_build_object(
         'reposter', jsonb_build_object(
           'identity_type', r.reposter_type, 'identity_id', r.reposter_id,
           'display_name', rc.card -> 'name', 'avatar_url', rc.card -> 'avatar_url',
           'is_verified', coalesce(rc.card -> 'is_verified', 'false'::jsonb)),
         'additional_count', r.reposter_additional)) else '{}'::jsonb end,
    s.id,
    r.unit_key,
    r.unit_type,
    s.ranking_version,
    case when v_has_more then v_next else null end,
    not v_has_more
  from rows_ r
  left join payloads ppl on r.unit_type in ('CONTENT', 'SIMPLE_REPOST') and ppl.r_content_type = r.content_type and ppl.r_post_id = r.post_id
  left join lateral (select public.footme_composer_identity_card(r.reposter_type, r.reposter_id) as card) rc on r.unit_type = 'SIMPLE_REPOST'
  order by r.position;
end;
$$;

-- ============================================================
-- SEZIONE 6 — «Nuovi contenuti» per Per te (§90-§92)
-- Stessa eligibility dello snapshot (footme_feed_eligible_content): il conteggio
-- non promette ciò che la nuova sessione poi non mostra. Seguiti continua a
-- usare fetch_home_feed_updates (invariata).
-- ============================================================

create or replace function public.fetch_home_for_you_updates(p_session_id uuid)
returns table (new_items_count integer, newest_published_at timestamptz, preview_avatar_urls text[])
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid     uuid := auth.uid();
  v_now     timestamptz := timezone('utc', now());
  v_sec_min integer := (public.footme_feed_ranking_config() -> 'broadening' ->> 'second_degree_min')::int;
  s         public.feed_sessions%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select fs.* into s from public.feed_sessions fs where fs.id = p_session_id and fs.viewer_profile_id = v_uid;
  if not found then
    raise exception 'Sessione Feed non valida o scaduta' using errcode = 'P0002', hint = 'feed_session_expired';
  end if;

  -- §90-§92: la pill segnala NOVITÀ RILEVANTI, non tutto il catalogo pubblico: solo i
  -- contenuti dei pool di rete (identità seguite + rete professionale D4) e i Simple
  -- Repost di reposter seguiti. Stessa eligibility dello snapshot.
  return query
  with net as materialized (
    select n.n_kind, n.n_id from public.footme_feed_network(v_uid, s.identity_type, s.identity_id, v_sec_min) n
  ),
  fresh as (
    select e.e_published_at as pub, fci.publisher_avatar_url as avatar
      from public.footme_feed_eligible_content(v_uid, s.identity_type, s.identity_id, v_now, null, null, null) e
      join public.feed_content_index fci on fci.content_type = e.e_ct and fci.post_id = e.e_post
     where e.e_published_at > s.as_of
       and not exists (select 1 from public.feed_session_units u
                        where u.session_id = s.id and u.dedupe_key = e.e_ct || ':' || e.e_post)
       and (
         case when e.e_pub_type = 'club'
              then exists (select 1 from public.club_follows f where f.profile_id = v_uid and f.club_id = e.e_pub_id)
              else exists (select 1 from public.profile_follows f where f.follower_profile_id = v_uid and f.followed_profile_id = e.e_pub_id) end
         or exists (select 1 from net n where n.n_id = e.e_pub_id
                      and n.n_kind = case when e.e_pub_type = 'club' then 'club' else 'profile' end))
    union all
    select g.g_published_at, fci.publisher_avatar_url
      from public.footme_feed_repost_groups(v_uid, v_now) g
      join public.feed_content_index fci on fci.content_type = g.g_content_type and fci.post_id = g.g_post_id
     where g.g_published_at > s.as_of
       and not exists (select 1 from public.feed_session_units u
                        where u.session_id = s.id and u.dedupe_key = g.g_content_type || ':' || g.g_post_id)
  ),
  capped as (
    select f.pub, f.avatar from fresh f order by f.pub desc limit 100
  )
  select (select count(*)::int from capped),
         (select max(c.pub) from capped c),
         coalesce((select array_agg(a.avatar order by a.pub desc) from (
                     select c.avatar, c.pub from capped c where c.avatar is not null order by c.pub desc limit 3) a), '{}'::text[]);
end;
$$;

-- ============================================================
-- SEZIONE 7 — profili suggeriti (§183-§191), riscritta
-- Matrice da config, rete D4, esclusi già seguiti/bloccati/admin, massimo
-- `suggested.max_rows` (3), OMESSA (zero righe) se i candidati sopra soglia
-- sono meno di `suggested.min_candidates`. Stesse colonne di prima: il client
-- continua a riempire i segnaposto SUGGESTED_PROFILES (fallimento isolato,
-- §269-§271). p_module_index sceglie la fetta, così due moduli della stessa
-- sessione non mostrano le stesse persone.
-- ============================================================

drop function if exists public.fetch_home_suggested_profiles(int);

create or replace function public.fetch_home_suggested_profiles(
  p_limit integer default 3,
  p_module_index integer default 0,
  p_identity_type text default null,
  p_identity_id uuid default null)
returns table (
  item_uid text, entity_id uuid, full_name text, avatar_url text, role public.app_role, region text, city text,
  primary_position public.player_position, current_club_name text, is_following boolean, is_saved boolean,
  suggestion_reason_key text, suggestion_reason_label text, component_version smallint)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid   uuid := auth.uid();
  v_cfg   jsonb := public.footme_feed_ranking_config();
  v_rows  integer := (v_cfg -> 'suggested' ->> 'max_rows')::int;
  v_min   integer := (v_cfg -> 'suggested' ->> 'min_candidates')::int;
  v_idx   integer := greatest(coalesce(p_module_index, 0), 0);
  v_lim   integer := least(greatest(coalesce(p_limit, v_rows), 1), v_rows);
  v_ident record;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select r.* into v_ident from public.footme_feed_resolve_identity(v_uid, p_identity_type, p_identity_id) r limit 1;

  create temp table if not exists _fs_sugg (pid uuid, sc numeric, rs text, rn integer) on commit drop;
  delete from _fs_sugg;
  insert into _fs_sugg
  select c.s_profile_id, c.s_score, c.s_reason, (row_number() over (order by c.s_score desc, c.s_profile_id))::int
    from public.footme_feed_suggested_candidates(v_uid, v_ident.i_type, v_ident.i_id, v_rows * (v_idx + 1)) c;

  select count(*) into v_count from _fs_sugg g where g.rn > v_idx * v_rows and g.rn <= (v_idx + 1) * v_rows;
  if v_count < v_min then
    return;
  end if;

  return query
  select
    'profile:' || p.id::text, p.id, p.full_name, p.avatar_url, p.role, p.region, p.city, pp.primary_position,
    cm_club.name, false,
    (sv.target_profile_id is not null),
    g.rs,
    public.footme_feed_reason_label(g.rs),
    public.footme_feed_component_version('suggested_profiles')
  from _fs_sugg g
  join public.profiles p on p.id = g.pid
  left join public.player_profiles pp on pp.profile_id = p.id
  left join lateral (
    select cm.club_id from public.club_members cm
     where cm.profile_id = p.id and cm.status = 'active' and cm.is_current
     order by cm.created_at desc limit 1) cm on true
  left join public.clubs cm_club on cm_club.id = cm.club_id
  left join public.saved_profiles sv on sv.owner_profile_id = v_uid and sv.target_profile_id = p.id
  where g.rn > v_idx * v_rows and g.rn <= (v_idx + 1) * v_rows
  order by g.rn
  limit v_lim;
end;
$$;

-- ============================================================
-- SEZIONE 8 — primo accesso (D1, §135-§148)
-- Niente checkbox, niente boost a 14 giorni, niente riproposta dopo 30 giorni:
-- mostrato UNA volta (intro_state = 'pending'), «Le tue aree» dal profilo
-- (regione e aree già dichiarate: nessuna nuova tassonomia, §142), «Inizia» =
-- acknowledge_feed_intro. `feed_preferences` resta (append-only) ma non entra
-- più nel ranking; set_feed_preferences / dismiss_feed_intro restano per i
-- client vecchi e per la compatibilità dei dati esistenti (completed/skipped
-- non rivedono più l'intro).
-- ============================================================

drop function if exists public.fetch_my_feed_intro();

create or replace function public.fetch_my_feed_intro()
returns table (should_show boolean, intro_state text, areas jsonb)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid   uuid := auth.uid();
  v_state text;
  v_areas jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  insert into public.feed_preferences (profile_id) values (v_uid) on conflict (profile_id) do nothing;
  select fp.intro_state into v_state from public.feed_preferences fp where fp.profile_id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object('kind', a.kind, 'label', a.label) order by a.ord, a.label), '[]'::jsonb)
    into v_areas
  from (
    select distinct on (x.kind, x.label) x.kind, x.label, x.ord from (
      select 'region'::text kind, pr.region label, 0 ord from public.profiles pr where pr.id = v_uid
      union all select 'city', pr.city, 3 from public.profiles pr where pr.id = v_uid
      union all select 'region', unnest(pp.transfer_regions), 1 from public.player_profiles pp where pp.profile_id = v_uid
      union all select 'province', unnest(pp.transfer_provinces), 2 from public.player_profiles pp where pp.profile_id = v_uid
      union all select 'region', unnest(cp.preferred_regions), 1 from public.coach_profiles cp where cp.profile_id = v_uid
      union all select 'province', unnest(cp.preferred_provinces), 2 from public.coach_profiles cp where cp.profile_id = v_uid
      union all select 'region', unnest(sp.preferred_regions), 1 from public.staff_profiles sp where sp.profile_id = v_uid
      union all select 'province', unnest(sp.preferred_provinces), 2 from public.staff_profiles sp where sp.profile_id = v_uid
      union all select 'region', unnest(dp.preferred_regions), 1 from public.director_profiles dp where dp.profile_id = v_uid
      union all select 'province', unnest(dp.preferred_provinces), 2 from public.director_profiles dp where dp.profile_id = v_uid
      union all select 'region', unnest(ap.operating_regions), 1 from public.agent_profiles ap where ap.profile_id = v_uid
      union all select 'province', unnest(ap.operating_provinces), 2 from public.agent_profiles ap where ap.profile_id = v_uid
    ) x
    where x.label is not null and btrim(x.label) <> ''
    order by x.kind, x.label, x.ord
  ) a;

  return query select (v_state = 'pending'), v_state, v_areas;
end;
$$;

create or replace function public.acknowledge_feed_intro()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  insert into public.feed_preferences (profile_id, intro_state, intro_resolved_at, applies_until)
  values (v_uid, 'completed', timezone('utc', now()), null)
  on conflict (profile_id) do update set
    intro_state = 'completed', intro_resolved_at = timezone('utc', now()), applies_until = null
  where public.feed_preferences.intro_state = 'pending';
end;
$$;

comment on function public.set_feed_preferences(boolean, boolean, boolean, boolean) is
  'DEPRECATA da HOM-13 D1: le preferenze non entrano più nel ranking e il primo accesso non le chiede più.';

-- ============================================================
-- SEZIONE 9 — eventi Feed non-contenuto (§254-§259)
-- Batch idempotente su event_id (retry sicuro), whitelist client, sessione
-- accettata solo se dell'utente; niente testo libero, niente formule (§258).
-- ============================================================

create or replace function public.record_feed_events(p_events jsonb)
returns jsonb
language plpgsql
volatile
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
    select t.e from jsonb_array_elements(p_events) with ordinality as t(e, ord)
     where t.ord <= 50 and jsonb_typeof(t.e) = 'object'
  ),
  parsed as (
    select public.footme_try_uuid(r.e ->> 'event_id') as event_id,
           r.e ->> 'event_type' as event_type,
           r.e ->> 'tab' as tab,
           public.footme_try_uuid(r.e ->> 'feed_session_id') as sid,
           r.e ->> 'unit_type' as unit_type,
           left(nullif(btrim(r.e ->> 'unit_key'), ''), 200) as unit_key,
           case when (r.e ->> 'position') ~ '^[0-9]{1,5}$' then (r.e ->> 'position')::int end as pos,
           r.e ->> 'target_type' as target_type,
           public.footme_try_uuid(r.e ->> 'target_id') as target_id,
           least(greatest(coalesce(public.footme_try_timestamptz(r.e ->> 'occurred_at'), v_now),
                          v_now - interval '24 hours'), v_now) as occurred_at
      from raw r
  )
  insert into public.feed_events (event_id, event_type, viewer_profile_id, feed_session_id, tab, unit_type,
                                  unit_key, unit_position, target_type, target_id, occurred_at)
  select p.event_id, p.event_type, v_uid,
         (select fs.id from public.feed_sessions fs where fs.id = p.sid and fs.viewer_profile_id = v_uid),
         p.tab,
         case when p.unit_type in ('CONTENT', 'SIMPLE_REPOST', 'OPPORTUNITY', 'SUGGESTED_PROFILES') then p.unit_type end,
         p.unit_key, p.pos,
         case when p.target_type in ('profile', 'club', 'position', 'content') then p.target_type end,
         case when p.target_type in ('profile', 'club', 'position', 'content') then p.target_id end,
         p.occurred_at
    from parsed p
   where p.event_id is not null
     and p.event_type in ('feed_session_start', 'feed_refresh', 'feed_load_more', 'new_content_pill_shown',
                          'new_content_pill_tap', 'feed_unit_impression', 'feed_unit_open', 'opportunity_impression',
                          'opportunity_open', 'suggested_profiles_impression', 'suggested_profile_open', 'follow_from_feed')
     and p.tab in ('HOME_FOR_YOU', 'HOME_FOLLOWING')
  on conflict (event_id) do nothing;

  get diagnostics v_accepted = row_count;
  return jsonb_build_object('accepted', v_accepted);
end;
$$;

-- ============================================================
-- SEZIONE 10 — privilegi
-- `revoke from public` NON chiude anon: revoke esplicito. Gli helper con
-- viewer arbitrario non sono eseguibili dai client (le definer li chiamano coi
-- privilegi del proprietario).
-- ============================================================

do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'footme_feed_ranking_defaults()', 'footme_feed_ranking_config()',
    'footme_feed_resolve_identity(uuid,text,uuid)', 'footme_feed_network(uuid,text,uuid,integer)',
    'footme_feed_eligible_content(uuid,text,uuid,timestamptz,integer,text[],uuid[])',
    'footme_feed_position_candidates(uuid,text,timestamptz,uuid[])',
    'footme_feed_suggested_candidates(uuid,text,uuid,integer)',
    'footme_feed_build_units(uuid,boolean,integer)', 'footme_feed_fill_session(uuid,integer)',
    'footme_feed_prune_sessions(uuid)'] loop
    execute format('revoke all on function public.%s from public', v_fn);
    execute format('revoke execute on function public.%s from anon, authenticated', v_fn);
  end loop;

  foreach v_fn in array array[
    'fetch_home_for_you_page(uuid,integer,integer,text,uuid)', 'fetch_home_for_you_updates(uuid)',
    'fetch_home_suggested_profiles(integer,integer,text,uuid)', 'fetch_my_feed_intro()',
    'acknowledge_feed_intro()', 'record_feed_events(jsonb)'] loop
    execute format('revoke all on function public.%s from public', v_fn);
    execute format('revoke execute on function public.%s from anon', v_fn);
    execute format('grant execute on function public.%s to authenticated', v_fn);
  end loop;
end
$$;

-- ============================================================
-- SEZIONE 11 — pulizia programmata (pg_cron se disponibile, come DAS-REV-31).
-- Senza pg_cron le sessioni scadute vengono comunque potate del viewer a ogni
-- nuova sessione (fetch_home_for_you_page); il job serve alle sessioni
-- abbandonate.
-- ============================================================

do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
   begin
    create extension if not exists pg_cron;
    if exists (select 1 from cron.job where jobname = 'feed-sessions-prune') then
      perform cron.unschedule('feed-sessions-prune');
    end if;
    perform cron.schedule('feed-sessions-prune', '*/30 * * * *', 'select public.footme_feed_prune_sessions(null)');
   exception when others then
    raise warning 'HOM-13: pg_cron non attivabile (%); pulizia sessioni Feed non programmata.', sqlerrm;
   end;
  else
    raise notice 'HOM-13: pg_cron non disponibile; pulizia sessioni Feed non programmata in questo ambiente.';
  end if;
end;
$do$;
