-- ============================================================
-- HOM-15 — Release gate Home: consolidamento lato database
--
-- COSA MANCAVA (verificato sulle migrazioni, non sul remoto)
--
--   1. «Posizione aperta» nel «+» (§168, §171). Il launcher della Home
--      (`fetch_content_launcher`, HOM-06.2) restituiva solo le capability di
--      Post/Articolo/Bozze; la riga «Posizione aperta» la deduceva il client
--      dal ruolo `club_admin` (composer-entry.ts). §168 vieta di assumere una
--      capability dal solo ruolo admin: un titolare la ha, ma anche un membro
--      con `positions_create` / `society_manage_positions`, mentre un
--      club_admin il cui club non esiste più non la ha.
--      → `fetch_content_launcher` è riemessa dalla sua unica definizione
--        (20261121090000, §11c) con un campo in più, `can_open_position`.
--        Il criterio NON è nuovo: è quello che il composer Position
--        (DAS-REV-16, `fetch_position_composer_context`) applica per aprirsi
--        (porta `view` su Società o su almeno una squadra) e per offrire la
--        creazione (`can_create`: `create` su Società o su almeno una squadra
--        non archiviata), entrambi via `position_can_operate`. Le Società
--        candidate sono quelle in cui `position_can_operate` può dare vero:
--        titolare, o accesso attivo (`club_access_is_active`: club_members o
--        club_admin_memberships attivi). L'helper restituisce solo un
--        booleano sulle Società del chiamante: nessun dato di `clubs` esce,
--        per questo può restare definer come il launcher che lo usa.
--
--   2. Origine 'NOTIFICATION' degli eventi contenuto (HOM-15, apertura del
--      dettaglio da una notifica HOM-14). `content_events.source` è una
--      whitelist doppia: il CHECK `content_events_source_check` e la lista in
--      `record_content_events` (HOM-05, unica definizione 20261119090000).
--      Senza la nuova voce un evento da notifica verrebbe scartato in
--      silenzio dalla funzione (e rifiutato dal CHECK).
--      → drop/add del CHECK con 'NOTIFICATION'; `record_content_events`
--        riemessa identica salvo la lista. Gli insights già mappano una source
--        sconosciuta su «Altro» lato client: nessun dato si rompe.
--
--   3. Mention di Società bloccate (§158, §337, §382).
--      `footme_post_normalize_mentions` (HOM-06.1, unica definizione
--      20261120090000 §4g, riusata dai commenti HOM-08) per un profilo
--      controlla esistenza + blocco, ma per una Società solo l'esistenza: con
--      un payload costruito a mano si menziona in Post e commenti una Società
--      bloccata dal viewer o che ha bloccato il viewer. HOM-12 ha reso il
--      blocco identity-level (`identity_blocks`) ma non ha riemesso questa
--      funzione.
--      → riemessa dalla sua unica definizione, stessa firma/security/grant,
--        con il controllo di blocco nel ramo Società tramite lo stesso helper
--        che `search_tag_targets` (riemessa in HOM-12) usa per escludere le
--        Società dalla ricerca mention: `footme_blocked_keys(auth.uid())`,
--        simmetrico (blocker o bloccato). Stesso errore: post_invalid_mention
--        detail 'identity', indistinguibile da «non esiste» (§82 HOM-12).
--
--   4. Composer Position irraggiungibile (bug DAS-REV-16 emerso nel QA del
--      punto 1). `fetch_position_composer_context` dichiara
--      `access_verified_at timestamptz` ma restituisce
--      `timezone('utc', now())`, un timestamp senza fuso: `return query` non
--      converte e ogni chiamata falliva («structure of query does not match
--      function result type»), per chiunque. Il criterio del punto 1 è
--      quello di questa funzione, quindi la riga «Posizione aperta» avrebbe
--      portato a un composer che non si apre.
--      → riemessa dalla sua unica definizione (20261027090000, SEZIONE 10)
--        con `now()` al posto di `timezone('utc', now())`. Nient'altro cambia.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — can_open_position nel launcher del «+»
-- ============================================================

-- Stesso criterio di fetch_position_composer_context (DAS-REV-16): la porta
-- del composer (view su Società o su una squadra) e la capability di
-- creazione (create su Società o su una squadra non archiviata).
create or replace function public.footme_position_launcher_allowed(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (public.position_can_operate(p_club_id, 'society', null, 'view')
      or exists (
        select 1 from public.club_teams ct
        where ct.club_id = p_club_id
          and public.position_can_operate(p_club_id, 'team', ct.id, 'view')))
    and
    (public.position_can_operate(p_club_id, 'society', null, 'create')
      or exists (
        select 1 from public.club_teams ct
        where ct.club_id = p_club_id and not ct.is_archived
          and public.position_can_operate(p_club_id, 'team', ct.id, 'create')));
$$;

revoke all on function public.footme_position_launcher_allowed(uuid) from public;
revoke execute on function public.footme_position_launcher_allowed(uuid) from anon, authenticated;

comment on function public.footme_position_launcher_allowed(uuid) is
  'HOM-15 §168: il chiamante può aprire il composer Position e creare in questa Società (criterio di fetch_position_composer_context).';

-- Riemessa da 20261121090000 §11c: invariata salvo `can_open_position`.
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
    -- HOM-15 §168: capability server, non il ruolo club_admin. Candidate = le
    -- Società in cui position_can_operate può rispondere vero.
    'can_open_position',   exists (
      select 1
      from (
        select c.id as club_id from public.clubs c where c.owner_profile_id = v_uid
        union
        select cm.club_id from public.club_members cm
        where cm.profile_id = v_uid and cm.status = 'active'
        union
        select m.club_id from public.club_admin_memberships m
        where m.profile_id = v_uid and m.status = 'active'
      ) cand
      where public.footme_position_launcher_allowed(cand.club_id)),
    'drafts_count',    (select count(*)::int from public.footme_content_actor_rows(v_uid, array['draft'])),
    'scheduled_count', (select count(*)::int from public.footme_content_actor_rows(v_uid, array['scheduled', 'publishing'])),
    'failed_count',    (select count(*)::int from public.footme_content_actor_rows(v_uid, array['failed'])));
end;
$$;

revoke all on function public.fetch_content_launcher() from public;
revoke execute on function public.fetch_content_launcher() from anon;
grant execute on function public.fetch_content_launcher() to authenticated;

comment on function public.fetch_content_launcher() is
  'HOM-06.2 §4–§6, §9 + HOM-15 §168: azioni disponibili nel + (incl. can_open_position da capability Position) e conteggi di bozze, programmati e falliti accessibili al chiamante.';


-- ============================================================
-- SEZIONE 2 — source 'NOTIFICATION' per content_events
-- ============================================================

alter table public.content_events drop constraint if exists content_events_source_check;
-- `not valid` + `validate`: la verifica delle righe esistenti non tiene
-- `content_events` (tabella di eventi, cresce) sotto lock esclusivo.
alter table public.content_events add constraint content_events_source_check check (source in (
  'HOME_FOR_YOU', 'HOME_FOLLOWING', 'PROFILE', 'SEARCH', 'SHARE', 'MESSAGE', 'REPOST', 'NOTIFICATION', 'OTHER'
)) not valid;
alter table public.content_events validate constraint content_events_source_check;

-- Riemessa da 20261119090000 §4: invariata salvo la whitelist delle source.
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
        'HOME_FOR_YOU', 'HOME_FOLLOWING', 'PROFILE', 'SEARCH', 'SHARE', 'MESSAGE', 'REPOST', 'NOTIFICATION', 'OTHER')
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
-- SEZIONE 3 — mention di Società bloccate (§158, §337, §382)
-- ============================================================

-- Riemessa da 20261120090000 §4g: invariata salvo il blocco nel ramo Società.
-- 4g. Mention (§112, §209). Valida e restituisce l'array normalizzato (ordinato
-- per posizione, duplicati esatti scartati). Solleva post_invalid_mention.
create or replace function public.footme_post_normalize_mentions(
  p_body     text,
  p_mentions jsonb,
  p_max      integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_off     integer[] := public.footme_utf16_offsets(p_body);
  v_all     jsonb := '[]'::jsonb;
  v_out     jsonb := '[]'::jsonb;
  v_e       jsonb;
  v_id      uuid;
  v_type    text;
  v_name    text;
  v_start   integer;
  v_end     integer;
  v_cs      integer;
  v_ce      integer;
  v_prev_end integer := -1;
  v_prev    jsonb;
begin
  if p_mentions is null or p_mentions = 'null'::jsonb then
    return '[]'::jsonb;
  end if;

  if jsonb_typeof(p_mentions) <> 'array' then
    raise exception 'post_invalid_mention' using errcode = '22023', detail = 'not_array';
  end if;

  begin
    for v_e in select e from jsonb_array_elements(p_mentions) e loop
      if jsonb_typeof(v_e) <> 'object'
         or coalesce(jsonb_typeof(v_e -> 'start'), '') <> 'number'
         or coalesce(jsonb_typeof(v_e -> 'end'), '') <> 'number'
         or coalesce(jsonb_typeof(v_e -> 'display_name'), '') <> 'string'
         or coalesce(jsonb_typeof(v_e -> 'identity_id'), '') <> 'string'
         or coalesce(jsonb_typeof(v_e -> 'identity_type'), '') <> 'string' then
        raise exception 'post_invalid_mention' using errcode = '22023', detail = 'shape';
      end if;

      v_id    := (v_e ->> 'identity_id')::uuid;
      v_type  := v_e ->> 'identity_type';
      v_name  := v_e ->> 'display_name';
      v_start := (v_e ->> 'start')::integer;
      v_end   := (v_e ->> 'end')::integer;

      if v_type not in ('profile', 'club')
         or v_name <> btrim(v_name) or v_name = '' or char_length(v_name) > 120
         or v_start < 0 or v_end <= v_start then
        raise exception 'post_invalid_mention' using errcode = '22023', detail = 'fields';
      end if;

      v_all := v_all || jsonb_build_array(jsonb_build_object(
        'identity_id', v_id, 'identity_type', v_type, 'display_name', v_name,
        'start', v_start, 'end', v_end));
    end loop;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'post_invalid_mention' using errcode = '22023', detail = 'cast';
  end;

  for v_e in
    select e from jsonb_array_elements(v_all) e
    order by (e ->> 'start')::int, (e ->> 'end')::int, e ->> 'identity_id'
  loop
    v_start := (v_e ->> 'start')::int;
    v_end   := (v_e ->> 'end')::int;
    v_id    := (v_e ->> 'identity_id')::uuid;
    v_type  := v_e ->> 'identity_type';
    v_name  := v_e ->> 'display_name';

    -- Duplicato esatto (stesso range, stessa identità): scartato (§210 per le
    -- mention). Sovrapposizione parziale: rifiutata.
    if v_prev is not null and v_prev = v_e then
      continue;
    end if;
    if v_start < v_prev_end then
      raise exception 'post_invalid_mention' using errcode = '22023', detail = 'overlap';
    end if;

    -- Range → caratteri. Un offset che cade dentro una coppia surrogata, o
    -- oltre la fine del testo, non ha corrispondenza.
    v_cs := array_position(v_off, v_start) - 1;
    v_ce := array_position(v_off, v_end) - 1;
    if v_cs is null or v_ce is null then
      raise exception 'post_invalid_mention' using errcode = '22023', detail = 'range';
    end if;

    if substr(coalesce(p_body, ''), v_cs + 1, v_ce - v_cs) <> '@' || v_name then
      raise exception 'post_invalid_mention' using errcode = '22023', detail = 'token';
    end if;

    if v_type = 'profile' then
      if not exists (select 1 from public.profiles p where p.id = v_id)
         or public.is_profile_blocked_with_viewer(v_id) then
        raise exception 'post_invalid_mention' using errcode = '22023', detail = 'identity';
      end if;
    elsif not exists (select 1 from public.clubs c where c.id = v_id)
          -- HOM-15: blocco identity-level HOM-12 in entrambe le direzioni, con lo
          -- stesso helper di search_tag_targets per le Società.
          or exists (select 1 from public.footme_blocked_keys(auth.uid()) bk
                     where bk.b_kind = 'society' and bk.b_id = v_id) then
      raise exception 'post_invalid_mention' using errcode = '22023', detail = 'identity';
    end if;

    v_out := v_out || jsonb_build_array(v_e);
    v_prev := v_e;
    v_prev_end := v_end;
  end loop;

  if jsonb_array_length(v_out) > p_max then
    raise exception 'post_invalid_mention' using errcode = '22023', detail = 'too_many';
  end if;

  return v_out;
end;
$$;

revoke all on function public.footme_post_normalize_mentions(text, jsonb, integer) from public;
revoke execute on function public.footme_post_normalize_mentions(text, jsonb, integer) from anon, authenticated;


-- ============================================================
-- SEZIONE 4 — fetch_position_composer_context: tipo di access_verified_at
--
-- Riemessa dalla sua unica definizione (20261027090000, SEZIONE 10), identica
-- salvo una riga: `timezone('utc', now())` è un timestamp SENZA fuso, mentre la
-- colonna dichiarata è timestamptz; in PL/pgSQL `return query` non converte e
-- ogni chiamata falliva con «structure of query does not match function result
-- type». `now()` è lo stesso istante, già timestamptz.
-- ============================================================

create or replace function public.fetch_position_composer_context(p_club_id uuid)
returns table (
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  club_is_verified   boolean,
  club_region        text,
  club_city          text,
  can_create         boolean,
  can_publish        boolean,
  can_create_society boolean,
  schema_version     integer,
  timezone_name      text,
  access_verified_at timestamptz,
  limits             jsonb
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

  if p_club_id is null
     or not exists (select 1 from public.clubs c where c.id = p_club_id) then
    raise exception 'POSITION_COMPOSER_NOT_AUTHORIZED';
  end if;

  /* Un actor con perimetro limitato a una squadra **deve** poter aprire il
     composer per quella squadra: §5 restringe l'ambito SOCIETY al perimetro
     Society-wide, non l'accesso al flusso. Il probe con Team nullo da solo
     fallirebbe proprio per chi ha uno scope di squadre, quindi la porta si
     apre anche con una sola squadra nel perimetro. */
  if not public.position_can_operate(p_club_id, 'society', null, 'view')
     and not exists (
       select 1 from public.club_teams ct
       where ct.club_id = p_club_id
         and public.position_can_operate(p_club_id, 'team', ct.id, 'view')
     ) then
    raise exception 'POSITION_COMPOSER_NOT_AUTHORIZED';
  end if;

  return query
  select
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    c.region,
    c.city,
    /* «Nascondi azioni non autorizzate»: `can_create` è vero se esiste
       almeno un ambito in cui l'actor può creare. */
    public.position_can_operate(p_club_id, 'society', null, 'create')
      or exists (
        select 1 from public.club_teams ct
        where ct.club_id = p_club_id and not ct.is_archived
          and public.position_can_operate(p_club_id, 'team', ct.id, 'create')
      ),
    public.position_can_operate(p_club_id, 'society', null, 'publish')
      or exists (
        select 1 from public.club_teams ct
        where ct.club_id = p_club_id and not ct.is_archived
          and public.position_can_operate(p_club_id, 'team', ct.id, 'publish')
      ),
    public.position_can_operate(p_club_id, 'society', null, 'create'),
    1,
    public.society_position_timezone(p_club_id),
    now(),
    /* §20: «una sola configurazione iniziale, condivisa client/server». Il
       client non ha una seconda copia di questi numeri. */
    jsonb_build_object(
      'customRoleName',    80,
      'staffQualification', 300,
      'responsibilities',  1500,
      'description',       2000,
      'requirements',      1000,
      'ageMin',            5,
      'ageMax',            70
    )
  from public.clubs c
  where c.id = p_club_id;
end;
$$;

revoke all on function public.fetch_position_composer_context(uuid) from public;
-- `revoke from public` non chiude anon (playbook): il corpo rifiuta già uid
-- nullo, ma la funzione non deve nemmeno essere eseguibile.
revoke execute on function public.fetch_position_composer_context(uuid) from anon;
grant execute on function public.fetch_position_composer_context(uuid) to authenticated;
