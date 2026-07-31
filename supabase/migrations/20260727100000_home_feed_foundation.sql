-- ============================================================
-- HOME-01 — Home/Feed Blocco 1: fondamenta
--
-- Schema sources reused (verified against the actual migrations before
-- writing this file):
--   20260726100000_media_search_foundation.sql  media_content_index (SECTION 5),
--                                               footme_text_array_clean(),
--                                               footme_content_kind_label(),
--                                               media_profiles.media_kind,
--                                               pattern `revoke ... from anon, authenticated`
--   20260514001000_club_media_posts.sql         club_media_posts
--   20260519090000_media_profile_posts.sql      media_profile_posts
--   20260519100000_media_tribuna_posts.sql      media_tribuna_posts
--   20260515030000_fan_tribuna_posts.sql        fan_tribuna_posts
--   20260515020000_fan_community_profile.sql    fan_media_posts
--   20260309000000_initial_schema.sql           recruiting_ads, clubs, profiles
--   20260725100000_comuni_geo.sql               clubs.province/latitude/longitude
--
-- PERCHÉ UNA VISTA SORELLA E NON media_content_index
--
-- media_content_index calcola, per ogni riga delle 5 tabelle di contenuto,
-- `search_blob` (concat_ws di titolo + excerpt + left(body, 2000) + fonte +
-- autore + nomi taggati + categorie + territori + argomenti, il tutto
-- normalizzato) più cinque colonne `*_norm`, e fa join con
-- media_content_tag_agg (GROUP BY su 3 tabelle tag con join a clubs /
-- club_teams / profiles) e media_content_engagement (GROUP BY su 10 tabelle).
-- Le subquery di un UNION ALL non vengono appiattite dal planner: l'intera
-- target list viene valutata anche quando la query esterna seleziona tre
-- colonne. È un costo accettabile per una schermata di ricerca, non per una
-- superficie colpita a ogni apertura della Home.
--
-- feed_content_index ripete le stesse 5 branch con le sole colonne che il
-- Feed usa: nessun blob, nessun `*_norm`, nessun join di aggregazione.
--
-- DELTA COMPORTAMENTALI DA CONOSCERE (non sono bug)
--
--  1. `publisher_region` è la regione del *publisher*, non l'array `regions[]`
--     derivato anche dalle entità taggate. Un contenuto taggato con una
--     società lombarda ma pubblicato da un profilo laziale conta come
--     "stessa regione" in Cerca e NON nel Feed. Il segnale di affinità del
--     Feed è volutamente più stretto: tenerlo calcolabile senza il join sui
--     tag è ciò che rende la vista economica.
--  2. `fan_media_posts` non ha `title`: media_content_index mette
--     `description` in `title` e null in `excerpt`. Qui i due campi sono
--     invertiti (title null, excerpt = description) perché per quella
--     sorgente il testo *è* il contenuto del post, e il renderer `post` del
--     client deve restare uniforme su tutte le sorgenti.
--  3. `media_tribuna_posts.excerpt` è il body intero (media_content_index
--     mappa `body` sia in `excerpt` sia in `body`). La vista lo lascia
--     passare grezzo: il troncamento per tipologia (280 caratteri per i post,
--     200 per gli articoli) avviene una volta sola, nella SELECT finale di
--     fetch_home_feed_page, dopo che la finestra dei candidati è stata
--     materializzata. Troncare qui *e* là significherebbe due limiti da
--     tenere allineati.
--  4. `published_at is not null` è spinto nel WHERE di ogni branch: un
--     elemento senza timestamp non è ordinabile né indirizzabile dal
--     cursore keyset, e §26 richiede comunque un timestamp per ogni elemento.
--
-- La vista è `revoke`d da anon e authenticated come le indici di CER-05:
-- è leggibile solo dalle RPC `security definer`, che riapplicano
-- `status = 'published'` (lo stesso predicato delle policy RLS sui post).
-- ============================================================


-- ============================================================
-- SECTION 1: vista public.feed_content_index
--
-- `content_format` usa la stessa regola deterministica di CER-05 §4, copiata
-- alla lettera da media_content_index: il Feed non deve classificare un
-- contenuto in modo diverso da come lo classifica Cerca.
-- ============================================================

drop view if exists public.feed_content_index;

create view public.feed_content_index as

  -- ── club_media_posts (contenuto ufficiale di una società) ──────
  select
    'club_media'::text                                      as content_type,
    cmp.id                                                  as post_id,
    case
      when cmp.visual_type = 'video'                            then 'video'
      when cmp.visual_type = 'image' and cmp.body is null       then 'foto'
      when length(coalesce(cmp.body, '')) >= 400                then 'articolo'
      else 'post'
    end                                                     as content_format,
    cmp.kind                                                as kind,
    cmp.title                                               as title,
    coalesce(cmp.excerpt, cmp.body)                         as excerpt,
    coalesce(cmp.thumbnail_url, cmp.visual_url)             as thumbnail_url,
    cmp.visual_type                                         as media_type,
    cmp.video_duration_seconds                              as duration_seconds,
    'club'::text                                            as publisher_type,
    cmp.club_id                                             as publisher_id,
    c.name                                                  as publisher_name,
    c.logo_url                                              as publisher_avatar_url,
    'ufficiale'::text                                       as source_kind,
    cmp.interviewee_name                                    as author_name,
    cmp.published_at                                        as published_at,
    c.region                                                as publisher_region,
    (c.verification_status = 'verified')                    as publisher_is_verified
  from public.club_media_posts cmp
  join public.clubs c on c.id = cmp.club_id
  where cmp.status = 'published'
    and cmp.published_at is not null

  union all

  -- ── media_profile_posts (contenuto editoriale) ──────────────────
  select
    'media_profile'::text,
    mpp.id,
    'articolo'::text,
    mpp.kind,
    mpp.title,
    coalesce(mpp.excerpt, mpp.subtitle),
    mpp.cover_url,
    mpp.cover_type,
    null::int,
    'profile'::text,
    mpp.media_profile_id,
    coalesce(mp.entity_name, p.full_name),
    coalesce(mp.logo_url, p.avatar_url),
    coalesce(mp.media_kind, 'pagina'),
    mpp.author_name,
    mpp.published_at,
    p.region,
    (mp.verification_status = 'verified')
  from public.media_profile_posts mpp
  join public.media_profiles mp on mp.profile_id = mpp.media_profile_id
  join public.profiles p        on p.id = mpp.media_profile_id
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
    (mp.verification_status = 'verified')
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
    false
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
    false
  from public.fan_media_posts fmp
  join public.profiles p on p.id = fmp.profile_id
  where fmp.status = 'published'
    and fmp.published_at is not null;

revoke all on table public.feed_content_index from anon, authenticated;


-- ============================================================
-- SECTION 2: mappatura formato -> tipo componente
--
-- 'foto' e 'post' collassano entrambi su `post`: il componente Post del §10
-- è testo + immagine opzionale, che copre esattamente le due forme.
-- ============================================================

create or replace function public.footme_feed_item_type(p_content_format text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_content_format
    when 'articolo' then 'article'
    when 'video'    then 'video'
    else 'post'
  end;
$$;


-- ============================================================
-- SECTION 3: versione del componente
--
-- §26 richiede una "versione del componente" su ogni elemento: serve a un
-- client vecchio per riconoscere un payload che non sa rendere. Tutti a 1 in
-- questo blocco; si incrementa il singolo tipo quando il suo payload cambia
-- in modo non retrocompatibile.
-- ============================================================

create or replace function public.footme_feed_component_version(p_item_type text)
returns smallint
language sql
immutable
set search_path = public
as $$
  select 1::smallint;
$$;


-- ============================================================
-- SECTION 4: bucket di ordinamento
--
-- Il bucket è la prima colonna del cursore keyset. NON è un punteggio e
-- non viene mai interpretato dal client: è un intero opaco che serve solo a
-- rendere l'ordine totale e stabile.
--
-- Perche' non `affinity desc` puro: sarebbe illimitato. Chi segue 50 società
-- scorrerebbe anni di contenuti seguiti prima di vedere qualsiasi altra cosa.
-- Il bucket incrocia affinità e freschezza, così ogni bucket alto è una
-- fetta recente *finita* e il Feed alterna naturalmente seguiti e scoperta.
--
-- `p_as_of` (e non `now()`) è obbligatorio: con `now()` un elemento potrebbe
-- cambiare bucket tra la pagina N e la N+1, producendo duplicati o salti
-- silenziosi. Congelando l'istante per tutta la sessione di paginazione
-- l'ordine diventa immutabile.
--
-- Il task di ranking futuro riscrive il CORPO di questa funzione senza
-- toccare il contratto del cursore: è l'unico punto di estensione previsto.
-- ============================================================

create or replace function public.footme_feed_rank_bucket(
  p_affinity     int,
  p_published_at timestamptz,
  p_as_of        timestamptz
)
returns smallint
language sql
immutable
set search_path = public
as $$
  select (case
    when p_published_at is null then 0
    when p_affinity >= 2 and p_published_at >= p_as_of - interval '3 days'  then 5
    when p_affinity >= 1 and p_published_at >= p_as_of - interval '3 days'  then 4
    when p_affinity >= 2 and p_published_at >= p_as_of - interval '14 days' then 3
    when p_affinity >= 1 and p_published_at >= p_as_of - interval '14 days' then 2
    when p_published_at >= p_as_of - interval '30 days'                     then 1
    else 0
  end)::smallint;
$$;


-- ============================================================
-- SECTION 5: piano degli slot discovery
--
-- Questo è il SOLO posto dove vive la cadenza dei moduli discovery. Il
-- client non decide mai dove vanno (§12: la sequenza non è codificata nel
-- client) e un task futuro cambia la cadenza qui, senza toccare la spina.
--
-- Invarianti che rendono impossibile la violazione del §8:
--   • mai a offset 0 (il Feed non apre con un modulo di scoperta);
--   • sempre a distanza >= 4 tra loro, quindi due moduli discovery non
--     possono essere adiacenti nemmeno a cavallo di due pagine;
--   • piano vuoto per 'seguiti': §5 vieta suggerimenti algoritmici da fonti
--     non seguite in quella tab.
-- ============================================================

create or replace function public.footme_feed_slot_plan(
  p_tab        text,
  p_page_index int,
  p_page_size  int
)
returns table (slot_offset int, item_type text)
language sql
immutable
set search_path = public
as $$
  select v.slot_offset, v.item_type
  from (values (3, 'suggested_profiles'), (8, 'suggested_clubs')) as v(slot_offset, item_type)
  where p_tab = 'per_te' and coalesce(p_page_index, 0) = 0 and p_page_size >= 10

  union all

  select
    4,
    case when p_page_index % 2 = 1 then 'suggested_clubs' else 'suggested_profiles' end
  where p_tab = 'per_te' and coalesce(p_page_index, 0) >= 1 and p_page_size >= 8;
$$;


-- ============================================================
-- SECTION 6: suggerimento di altezza
--
-- §8 chiede di evitare che "tutti gli elementi abbiano la stessa altezza".
-- SQL non può alternare altezze: può solo dire al client di che taglia è
-- ogni elemento. Il rispetto della regola resta nel render, questo è il
-- segnale su cui si basa.
-- ============================================================

create or replace function public.footme_feed_layout_hint(
  p_item_type      text,
  p_has_thumbnail  boolean,
  p_excerpt_length int
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_item_type in ('suggested_profiles', 'suggested_clubs') then 'carousel'
    when p_item_type = 'suggested_position'                       then 'compact'
    when p_item_type in ('article', 'video')                      then 'compact'
    when coalesce(p_has_thumbnail, false)                         then 'tall'
    when coalesce(p_excerpt_length, 0) >= 160                     then 'standard'
    else 'compact'
  end;
$$;


-- ============================================================
-- SECTION 7: etichette dei motivi di suggerimento
--
-- §26 richiede il "motivo interno del suggerimento". Si espone una chiave
-- macchina stabile (per i test e per le analitiche) e un'etichetta italiana
-- già composta, perché solo SQL conosce il nome dell'entità che ha
-- generato il motivo. Una chiave di motivo non è un punteggio, quindi la
-- regola "nessun punteggio esposto al client" resta rispettata.
-- ============================================================

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
    else null
  end;
$$;


-- ============================================================
-- SECTION 8: indici
--
-- NESSUN INDICE NUOVO SULLE 5 TABELLE DI CONTENUTO, e la ragione va detta
-- perché è controintuitiva.
--
-- Ognuna delle cinque ha già `<tabella>_status_published_idx` su
-- `(status, published_at desc)`. Per il predicato `status = 'published'` quel
-- composito è un indice ordinato per `published_at desc` a tutti gli effetti:
-- la scansione del range restituisce le righe già nell'ordine che il Feed
-- chiede. Un indice parziale su `(published_at desc) where status='published'`
-- descriverebbe lo stesso accesso con un albero in più da mantenere a ogni
-- scrittura, su tabelle che vengono scritte spesso.
--
-- Verificato, non supposto: con entrambi disponibili il planner ha scelto il
-- composito preesistente per `select ... from feed_content_index order by
-- published_at desc limit 10`. L'indice parziale era peso morto ed è stato
-- rimosso.
--
-- Restano quindi solo i due indici su `recruiting_ads`, che sono realmente
-- assenti: quella tabella aveva soltanto `(status)`, `(region)` e `(team_id)`,
-- e sia l'ordinamento globale delle posizioni sia il filtro "società seguite"
-- della tab Seguiti sono sul percorso caldo del Feed.
--
-- (La tab "Per te" ha il bucket nell'ORDER BY e non può comunque evitare un
-- sort: per quella il contenimento arriva dal floor a 180 giorni nella spina.)
-- ============================================================

create index if not exists recruiting_ads_feed_idx
  on public.recruiting_ads (published_at desc)
  where status = 'published' and published_at is not null;

create index if not exists recruiting_ads_club_published_idx
  on public.recruiting_ads (club_id, published_at desc)
  where status = 'published';


-- ============================================================
-- SECTION 9: grant
--
-- Le funzioni helper sono `immutable` e non leggono tabelle: possono essere
-- eseguite da authenticated senza esporre nulla. La vista invece resta
-- raggiungibile solo dalle RPC `security definer` (SECTION 1).
-- ============================================================

revoke all on function public.footme_feed_item_type(text) from public;
grant execute on function public.footme_feed_item_type(text) to authenticated;

revoke all on function public.footme_feed_component_version(text) from public;
grant execute on function public.footme_feed_component_version(text) to authenticated;

revoke all on function public.footme_feed_rank_bucket(int, timestamptz, timestamptz) from public;
grant execute on function public.footme_feed_rank_bucket(int, timestamptz, timestamptz) to authenticated;

revoke all on function public.footme_feed_slot_plan(text, int, int) from public;
grant execute on function public.footme_feed_slot_plan(text, int, int) to authenticated;

revoke all on function public.footme_feed_layout_hint(text, boolean, int) from public;
grant execute on function public.footme_feed_layout_hint(text, boolean, int) to authenticated;

revoke all on function public.footme_feed_reason_label(text, text) from public;
grant execute on function public.footme_feed_reason_label(text, text) to authenticated;
