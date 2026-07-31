-- ============================================================
-- HOME-01 — Home/Feed Blocco 1: RPC della spina
--
-- Schema sources reused (verified against the actual migrations before
-- writing this file):
--   20260727100000_home_feed_foundation.sql  feed_content_index,
--                                            footme_feed_item_type(),
--                                            footme_feed_rank_bucket(),
--                                            footme_feed_slot_plan(),
--                                            footme_feed_layout_hint(),
--                                            footme_feed_reason_label(),
--                                            footme_feed_component_version()
--   20260727110000_home_feed_state.sql       feed_preferences
--   20260726100000_media_search_foundation.sql  footme_content_kind_label()
--   20260726110000_media_search_rpcs.sql     CTE `saved` a 5 rami (ripresa
--                                            da fetch_media_for_you), stile RPC
--   20260725110000_positions_discovery_rpc.sql  risoluzione località
--                                            `coalesce(team, club)` e
--                                            is_secondary_match da
--                                            player_profiles.secondary_positions
--   20260515020000_fan_community_profile.sql profile_follows
--   20260411100000_remote_schema_sync.sql    club_follows
--   20260718090400_user_blocks.sql           user_blocks
--   20260309000000_initial_schema.sql        recruiting_ads, saved_ads, clubs
--   20260324000000_club_teams.sql            club_teams
--
-- Convenzioni ereditate da 20260726110000_media_search_rpcs.sql:
--   `p_sort`/`p_tab` con whitelist e messaggio d'errore in italiano; limit
--   clampato server-side; `security definer` + `stable` +
--   `set search_path = public`; `raise exception 'Authentication required'`
--   su auth.uid() null; revoke from public + grant execute to authenticated;
--   nessun punteggio esposto al client.
--
-- DUE DEVIAZIONI DALLE CONVENZIONI, ENTRAMBE VOLUTE
--
--  a) NIENTE `total_count` come ultima colonna. Un feed a cursore keyset non
--     ha un totale sensato (non esiste "pagina 7 di 12"): quello slot finale
--     è occupato dagli scalari di paginazione (`as_of`, i tre
--     `next_cursor_*`, `is_last_page`), ripetuti identici su ogni riga con la
--     stessa tecnica con cui le RPC di ricerca ripetono `total_count`.
--  b) ENVELOPE IN COLONNE TIPIZZATE + `data jsonb` PER IL PAYLOAD. Le altre
--     RPC sono interamente piatte. Qui l'envelope (§26: id, tipo, autore,
--     timestamp, posizione, motivo, stati, navigazione, versione) è presente
--     su OGNI elemento e guida dispatcher, dedup e cursore: merita colonne
--     tipizzate, che danno type-safety ai tipi scritti a mano del client e
--     parsing corretto di timestamptz/uuid da supabase-js. Il payload invece
--     cambia per tipo: appiattirlo significherebbe una quindicina di colonne
--     quasi sempre null *e* un `drop function` + cambio di firma a ogni
--     tipologia aggiunta. `data` è costruito con un solo `jsonb_build_object`
--     per tipo, in un unico `case` nella SELECT finale, così le chiavi sono
--     enumerate in un posto solo e restano allineabili alla union TS.
--
-- PERCHÉ LE RIGHE SEGNAPOSTO
--
-- §12 chiede che la sequenza dei componenti non sia codificata nel client;
-- §23 chiede che il fallimento di un modulo non blocchi tutta la Home. Un
-- RPC monolitico soddisfa il primo e viola il secondo (una sottoquery che
-- fallisce annulla la transazione: Home bianca). N RPC indipendenti fanno
-- l'opposto. Qui la spina emette anche righe `suggested_profiles` /
-- `suggested_clubs` SENZA entità, con `data = {"module_key": ...}`: il client
-- cammina il rowset in ordine e, sul segnaposto, chiama l'RPC del modulo. Il
-- client non ha logica di sequenza (rows.map(byType)) e un modulo che
-- fallisce rifiuta solo la propria promise.
--
-- PERCHÉ IL CURSORE È IL CONFINE DELLA FINESTRA
--
-- La diversificazione riordina le righe *dentro* la pagina. Se il cursore
-- fosse "l'ultima riga emessa", il riordino ri-emetterebbe righe con chiave
-- precedente già mostrate. La spina consuma quindi `v_limit + 1` candidati in
-- ordine base, diversifica dentro la finestra, emette tutto, e mette il
-- cursore sulla chiave IN ORDINE BASE dell'ultimo candidato della finestra.
-- Niente viene scartato e niente viene riletto. Tutte le regole del §8 sono
-- locali (nessuna adiacenza, nessun autore dominante), quindi la finestra è
-- lo scope corretto per applicarle.
--
-- `is_seen` È COSTANTE false
--
-- Il tracciamento dei contenuti già visti resta client-side per il Blocco 1
-- (vedi header di 20260727110000_home_feed_state.sql). La colonna esiste per
-- non cambiare firma quando diventerà server-side.
-- ============================================================


-- ============================================================
-- SECTION 1: RPC public.fetch_home_feed_page
-- ============================================================

drop function if exists public.fetch_home_feed_page(text, timestamptz, smallint, timestamptz, text, int, int);

create or replace function public.fetch_home_feed_page(
  p_tab                 text        default 'per_te',
  p_as_of               timestamptz default null,
  p_cursor_bucket       smallint    default null,
  p_cursor_published_at timestamptz default null,
  p_cursor_uid          text        default null,
  p_page_index          int         default 0,
  p_limit               int         default 10
)
returns table (
  item_uid                 text,
  item_type                text,
  rank_position            int,
  rank_bucket              smallint,
  layout_hint              text,
  component_version        smallint,
  title                    text,
  excerpt                  text,
  thumbnail_url            text,
  published_at             timestamptz,
  author_kind              text,
  author_id                uuid,
  author_name              text,
  author_avatar_url        text,
  author_source_kind       text,
  author_is_verified       boolean,
  is_seen                  boolean,
  is_saved                 boolean,
  is_following_author      boolean,
  suggestion_reason_key    text,
  suggestion_reason_label  text,
  nav_kind                 text,
  nav_params               jsonb,
  data                     jsonb,
  as_of                    timestamptz,
  next_cursor_bucket       smallint,
  next_cursor_published_at timestamptz,
  next_cursor_uid          text,
  is_last_page             boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid                 uuid := auth.uid();
  v_as_of               timestamptz;
  -- 30 e non 50: ogni riga porta un payload jsonb.
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
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_tab is null or p_tab not in ('per_te', 'seguiti') then
    raise exception 'Tab del Feed non supportata: %', coalesce(p_tab, 'null');
  end if;

  -- Il cursore è una tripla: una tripla parziale produrrebbe un predicato
  -- keyset che vale null, cioè una pagina vuota o sbagliata in silenzio.
  -- Meglio fallire subito e forte.
  if (p_cursor_uid is null) <> (p_cursor_published_at is null)
     or (p_cursor_uid is null) <> (p_cursor_bucket is null) then
    raise exception
      'Cursore del Feed incompleto: bucket, published_at e uid vanno forniti insieme';
  end if;

  -- Protezione dell'invariante più fragile di tutto il Feed: se il client
  -- pagina senza rimandare l'`as_of` della sessione, il bucket si ricalcola su
  -- un istante diverso, l'ordine si sposta e compaiono duplicati o salti che
  -- nessun test di integrazione noterebbe. Qui diventa un errore esplicito.
  if p_cursor_uid is not null and p_as_of is null then
    raise exception
      'Il cursore del Feed richiede p_as_of: passare l''as_of restituito dalla prima pagina';
  end if;

  -- Pagina 0 congela l'istante; le pagine successive lo ricevono indietro dal
  -- client. Senza questo, un bucket che dipende da now() cambierebbe tra le
  -- pagine e produrrebbe duplicati o salti silenziosi.
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

  -- Zone di interesse dichiarate, per ruolo. Servono solo come segnale di
  -- inclusione delle posizioni, non come filtro del Feed.
  select coalesce(
    (select pp.transfer_regions from public.player_profiles pp where pp.profile_id = v_uid),
    (select cp.preferred_regions from public.coach_profiles cp where cp.profile_id = v_uid),
    (select sp.preferred_regions from public.staff_profiles sp where sp.profile_id = v_uid),
    '{}'::text[]
  ) into v_preferred_regions;

  -- I ruoli che vivono di opportunità ricevono posizioni per default; fan e
  -- media solo se hanno spuntato "Posizioni aperte" nel modulo di primo
  -- accesso. È l'unico punto in cui una preferenza *abilita* una sorgente
  -- invece di limitarsi ad alzare l'affinità.
  v_include_positions :=
    coalesce(v_role, '') in ('player', 'coach', 'staff', 'agent', 'director', 'club_admin')
    or (v_pref_active and coalesce(v_wants_positions, false));

  return query
  with followed_clubs as (
    select f.club_id from public.club_follows f where f.profile_id = v_uid
  ),
  followed_profiles as (
    select f.followed_profile_id as profile_id
    from public.profile_follows f
    where f.follower_profile_id = v_uid
  ),
  -- Blocchi bidirezionali. Le RPC di Cerca non filtrano user_blocks oggi: il
  -- Feed è la superficie più esposta dell'app e non deve ereditare
  -- quell'incoerenza (vedi il follow-up nel piano).
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
  ),
  saved_positions as (
    select sa.ad_id from public.saved_ads sa where sa.profile_id = v_uid
  ),

  -- ── candidati: contenuti ────────────────────────────────────────
  content_candidates as (
    select
      fci.content_type || ':' || fci.post_id::text        as item_uid,
      public.footme_feed_item_type(fci.content_format)    as item_type,
      case
        when p_tab = 'seguiti' then 0::smallint
        else public.footme_feed_rank_bucket(aff.affinity, fci.published_at, v_as_of)
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
      aff.reason_key                                     as reason_key,
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
      null::boolean                                      as is_secondary_match
    from public.feed_content_index fci
    left join saved_content sv
      on sv.content_type = fci.content_type and sv.post_id = fci.post_id
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
      -- Mai i propri contenuti nel proprio Feed.
      not (fci.publisher_type = 'profile' and fci.publisher_id = v_uid)
      and (
        fci.publisher_type <> 'profile'
        or not exists (select 1 from blocked_profiles bp where bp.profile_id = fci.publisher_id)
      )
      and (
        -- §5: la tab Seguiti mostra SOLO fonti seguite. Un tag non è un
        -- follow: includere l'affinità sui tag farebbe emergere contenuti di
        -- publisher non seguiti, che è esattamente ciò che il §5 vieta.
        p_tab = 'per_te' or aff.is_following
      )
      and (
        -- Floor solo su "Per te": il bucket nell'ORDER BY impedisce il
        -- MergeAppend, quindi il sort va contenuto. Su "Seguiti" l'archivio
        -- cronologico è il senso della tab e MergeAppend lo rende economico.
        p_tab = 'seguiti' or fci.published_at >= v_as_of - interval '180 days'
      )
      and fci.published_at <= v_as_of
  ),

  -- ── candidati: posizioni aperte ─────────────────────────────────
  position_candidates as (
    select
      'recruiting_ad:' || ra.id::text                    as item_uid,
      'suggested_position'::text                         as item_type,
      case
        when p_tab = 'seguiti' then 0::smallint
        else public.footme_feed_rank_bucket(pa.affinity, ra.published_at, v_as_of)
      end                                                as rank_bucket,
      ra.published_at                                    as published_at,
      ra.club_id                                         as author_key,
      ra.title                                           as title,
      -- §9 vieta descrizioni lunghe nel contenitore posizione.
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
      ra.target_role                                     as target_role,
      pa.is_secondary_match                              as is_secondary_match
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
            and ra.target_role = v_target_role
            and v_primary_position is not null
            and ra.role_required = any(v_secondary_positions)
            and ra.role_required <> v_primary_position
          ) as is_secondary_match,
          (
            v_target_role is not null
            and ra.target_role = v_target_role
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
      -- La scadenza filtra gli annunci chiusi ma NON viene mai restituita:
      -- §9 vieta di mostrarla nel contenitore del Feed.
      and (ra.deadline is null or ra.deadline >= current_date)
      and (
        case
          -- In Seguiti una posizione compare solo se pubblicata da una società
          -- seguita: è contenuto di una fonte seguita, non un suggerimento.
          when p_tab = 'seguiti' then pa.is_following
          else pa.is_following or pa.role_match or pa.region_match
        end
      )
      and (p_tab = 'seguiti' or ra.published_at >= v_as_of - interval '180 days')
  ),

  candidates as (
    select * from content_candidates
    union all
    select * from position_candidates
  ),

  -- ── keyset: ordine base totale e stabile ────────────────────────
  -- Direzioni mescolate (bucket desc, published_at desc, uid asc): non si può
  -- usare il confronto di riga, serve il predicato espanso.
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
  -- Il confine della finestra in ordine BASE, non l'ultima riga emessa.
  boundary as (
    select w.rank_bucket, w.published_at, w.item_uid
    from window_rows w
    order by w.base_ord desc
    limit 1
  ),

  -- ── diversificazione §8, set-based (nessun loop: la funzione resta stable) ──
  -- Indice penalizzato: il 2°/3° elemento dello stesso autore scende di
  -- qualche slot, e una sequenza di posizioni viene diradata. Nulla viene
  -- scartato — scartare interagirebbe male col cursore di confine.
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

  -- ── righe segnaposto dei moduli discovery ───────────────────────
  slot_rows as (
    select sp.slot_offset, sp.item_type
    from public.footme_feed_slot_plan(p_tab, v_page, v_limit) sp
    -- Mai uno slot in coda alla pagina: senza contenuto dopo, un modulo di
    -- scoperta chiuderebbe il Feed.
    where sp.slot_offset < (select count(*) from emitted)
  ),

  -- ── fusione: chiave di ordinamento unica per contenuti e slot ────
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
      e.target_role, e.is_secondary_match,
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
      null::text, null::boolean,
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
    -- Troncamento unico, qui e solo qui, sui <= 11 elementi della finestra:
    -- media_tribuna_posts porta il body intero in `excerpt` (vedi delta 3
    -- nell'header della migrazione fondamenta).
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
    -- Si restituiscono i parametri, non gli href: le route expo-router non
    -- vanno congelate in SQL (stesso principio di resolveMediaContentHref).
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
  order by fr.sort_key;
end;
$$;

revoke all on function public.fetch_home_feed_page(text, timestamptz, smallint, timestamptz, text, int, int) from public;
grant execute on function public.fetch_home_feed_page(text, timestamptz, smallint, timestamptz, text, int, int) to authenticated;


-- ============================================================
-- SECTION 2: RPC public.fetch_home_feed_updates
--
-- Alimenta il banner "Nuovi contenuti" del §19. Non tocca la lista: il client
-- mostra solo un pulsante e non riporta MAI l'utente in cima da solo.
--
-- `p_since` DEVE essere l'`as_of` della sessione, non il `published_at`
-- dell'ultimo elemento caricato. Con il bucket, l'ultimo elemento caricato
-- non è il più recente in assoluto (un elemento di bucket 0 di settimana
-- scorsa può stare sopra un bucket 5 di oggi in una pagina successiva):
-- `as_of` è l'unico watermark corretto, ed è esattamente il confine dello
-- snapshot che la spina impone con `published_at <= as_of`.
--
-- Il conteggio è clampato a 100 con una subquery `limit 100`: non si scandisce
-- mai la coda dell'archivio per scrivere "99+" su una pill.
-- ============================================================

drop function if exists public.fetch_home_feed_updates(text, timestamptz);

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
  fresh as (
    select fci.published_at, fci.publisher_avatar_url
    from public.feed_content_index fci
    where fci.published_at > v_since
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
grant execute on function public.fetch_home_feed_updates(text, timestamptz) to authenticated;


-- ============================================================
-- SECTION 3: RPC public.fetch_home_following_state
--
-- §14 descrive due stati vuoti diversi per la tab Seguiti e la spina non può
-- distinguerli: a zero righe non ha colonne da restituire. Questa RPC li
-- separa:
--   • entrambi i contatori a 0  -> "non segui ancora nessuno": qui il blocco
--     "Suggerimenti per iniziare" è ammesso (è uno stato vuoto, non il Feed);
--   • contatori > 0 e has_published_content = false -> "i tuoi seguiti non
--     hanno ancora pubblicato": NIENTE blocco discovery, perché il §5 vale
--     ancora e l'utente ha già espresso le sue scelte.
-- ============================================================

drop function if exists public.fetch_home_following_state();

create or replace function public.fetch_home_following_state()
returns table (
  followed_profiles_count int,
  followed_clubs_count    int,
  has_published_content   boolean,
  newest_published_at     timestamptz
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
  with followed_clubs as (
    select f.club_id from public.club_follows f where f.profile_id = v_uid
  ),
  followed_profiles as (
    select f.followed_profile_id as profile_id
    from public.profile_follows f
    where f.follower_profile_id = v_uid
  ),
  followed_content as (
    select fci.published_at
    from public.feed_content_index fci
    where case
      when fci.publisher_type = 'club'
        then exists (select 1 from followed_clubs fc where fc.club_id = fci.publisher_id)
      else exists (select 1 from followed_profiles fp where fp.profile_id = fci.publisher_id)
    end
    order by fci.published_at desc
    limit 1
  )
  select
    (select count(*)::int from followed_profiles),
    (select count(*)::int from followed_clubs),
    exists (select 1 from followed_content),
    (select fc.published_at from followed_content fc);
end;
$$;

revoke all on function public.fetch_home_following_state() from public;
grant execute on function public.fetch_home_following_state() to authenticated;
