-- ============================================================
-- HOME-01c — allineamento al tipo reale di recruiting_ads.target_role
--
-- Supersedes 20260727140000_home_feed_never_empty.sql (stessa funzione, corpo
-- nuovo). Le migrazioni precedenti non vengono modificate: sono già applicate.
--
-- IL DIFETTO
--
-- La spina confrontava `ra.target_role` con la variabile `v_target_role`,
-- dichiarata `text`. Sul database remoto quel confronto solleva:
--
--     operator does not exist: app_role = text
--
-- perché in remoto `recruiting_ads.target_role` è di tipo `public.app_role`,
-- mentre la migrazione che l'ha introdotta (20260722100000_search_cerca.sql) la
-- dichiara `text`. Lo schema remoto è quindi DIVERSO da quello che i file di
-- migrazione descrivono: un database locale ricostruito da zero ha la colonna
-- `text` e il confronto funziona, in produzione no. È esattamente il motivo per
-- cui il difetto non è emerso in nessuna prova locale.
--
-- LA CORREZIONE
--
-- Il confronto avviene su `::text` da entrambi i lati. Così la funzione è
-- corretta sia se la colonna è `text` sia se è `app_role`, senza scommettere su
-- quale dei due sia "giusto" e senza toccare il tipo di una colonna in
-- produzione. Stessa cosa per la proiezione nel payload, che ora è
-- esplicitamente text invece di affidarsi a un cast di assegnazione.
--
-- NOTA per chi legge dopo: la stessa deriva colpisce anche
-- `search_clubs_page` (20260724110000), che fa `ra.target_role = any(v_target_roles)`
-- con `v_target_roles text[]`. Il filtro "target_roles" di Cerca > Società è
-- quindi rotto in remoto per la stessa ragione. Non viene corretto qui perché è
-- un'altra superficie: va aperto come attività a parte, insieme alla decisione
-- su quale dei due tipi debba diventare quello ufficiale.
-- ============================================================


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
      null::boolean                                      as is_secondary_match
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
