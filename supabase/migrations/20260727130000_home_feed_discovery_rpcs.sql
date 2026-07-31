-- ============================================================
-- HOME-01 — Home/Feed Blocco 1: RPC dei moduli discovery
--
-- Schema sources reused (verified against the actual migrations before
-- writing this file):
--   20260727100000_home_feed_foundation.sql     footme_feed_reason_label(),
--                                               footme_feed_component_version()
--   20260727110000_home_feed_state.sql          feed_preferences
--   20260724100000_search_profiles_filters.sql  lateral su club_members
--                                               (status='active', is_current)
--                                               per current_club_name
--   20260724110000_clubs_search_and_saved_teams.sql  saved_clubs,
--                                               conteggio posizioni aperte
--   20260627090000_saved_profiles_clubs.sql     saved_profiles, saved_clubs
--   20260515020000_fan_community_profile.sql    profile_follows
--   20260411100000_remote_schema_sync.sql       club_follows
--   20260718090400_user_blocks.sql              user_blocks
--
-- PERCHÉ RPC NUOVE E NON search_profiles_page / search_clubs_page
--
-- Quelle RPC sono ottime per Cerca e sbagliate per un modulo da tre righe:
--   • prendono fino a 16 parametri e pretendono che il client costruisca i
--     criteri per ruolo (positions-criteria.ts nel client è la misura di
--     quanto costa), mentre §11 vuole un modulo che "non deve utilizzare
--     grandi card individuali" e il client non deve sapere nulla di ruoli;
--   • calcolano `count(*) over ()` sull'intero risultato: puro spreco per sei
--     righe;
--   • implementano semantica di ricerca (rilevanza sulla query, saved_only,
--     whitelist di sort) che il Feed non usa;
--   • non filtrano user_blocks.
-- Queste derivano tutto server-side: il client passa solo `p_limit`.
--
-- NESSUNA fetch_home_suggested_positions
--
-- Le posizioni non sono un modulo: vivono nella spina come elementi
-- `suggested_position`, così partecipano al cursore keyset e alla
-- diversificazione condivisi con i contenuti. Vedi
-- 20260727120000_home_feed_rpcs.sql.
--
-- NESSUN PUNTEGGIO ESPOSTO
--
-- Le priorità sono flag booleani interni usati solo nell'ORDER BY, come in
-- search_profiles_page. Al client arriva solo `suggestion_reason_key`, che è
-- una chiave di motivo, non un punteggio.
-- ============================================================


-- ============================================================
-- SECTION 1: RPC public.fetch_home_suggested_profiles
--
-- "Persone che potresti conoscere" (§11). Esclude sé stessi, i profili già
-- seguiti, quelli già salvati, quelli bloccati (in entrambe le direzioni) e
-- gli admin di piattaforma.
--
-- La rilevanza per ruolo è deliberatamente grossolana: il §11 dice che "il
-- comportamento completo dei suggerimenti sarà sviluppato successivamente" e
-- la personalizzazione per tipologia di profilo è un task a parte. Qui conta
-- solo che il modulo non sia vuoto e non sia casuale.
-- ============================================================

drop function if exists public.fetch_home_suggested_profiles(int);

create or replace function public.fetch_home_suggested_profiles(
  p_limit int default 6
)
returns table (
  item_uid                text,
  entity_id               uuid,
  full_name               text,
  avatar_url              text,
  role                    public.app_role,
  region                  text,
  city                    text,
  primary_position        public.player_position,
  current_club_name       text,
  is_following            boolean,
  is_saved                boolean,
  suggestion_reason_key   text,
  suggestion_reason_label text,
  component_version       smallint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_limit         int := least(greatest(coalesce(p_limit, 6), 1), 20);
  v_region        text;
  v_role          text;
  v_pref_active   boolean := false;
  v_wants_players boolean := false;
  v_relevant      text[];
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select p.region, p.role::text into v_region, v_role
  from public.profiles p
  where p.id = v_uid;

  select
    fp.applies_until is not null and fp.applies_until > timezone('utc', now()),
    fp.wants_players
  into v_pref_active, v_wants_players
  from public.feed_preferences fp
  where fp.profile_id = v_uid;

  v_pref_active := coalesce(v_pref_active, false);

  -- Ruoli "rilevanti" per chi guarda. Chi cerca giocatori vede giocatori; un
  -- giocatore vede anche chi può ingaggiarlo.
  v_relevant := case coalesce(v_role, '')
    when 'player'     then array['player', 'coach', 'agent', 'director']
    when 'coach'      then array['player', 'coach', 'director', 'club_admin']
    when 'staff'      then array['staff', 'coach', 'director', 'club_admin']
    when 'agent'      then array['player', 'coach', 'director', 'club_admin']
    when 'director'   then array['player', 'coach', 'staff', 'agent']
    when 'club_admin' then array['player', 'coach', 'staff', 'agent']
    when 'fan'        then array['player', 'coach', 'media']
    when 'media'      then array['player', 'coach', 'club_admin', 'media']
    else array['player', 'coach']
  end;

  return query
  with blocked_profiles as (
    select ub.blocked_profile_id as profile_id
    from public.user_blocks ub
    where ub.blocker_profile_id = v_uid
    union
    select ub.blocker_profile_id
    from public.user_blocks ub
    where ub.blocked_profile_id = v_uid
  )
  select
    'profile:' || p.id::text as item_uid,
    p.id                     as entity_id,
    p.full_name,
    p.avatar_url,
    p.role,
    p.region,
    p.city,
    pp.primary_position,
    cm_club.name             as current_club_name,
    false                    as is_following,
    (sv.target_profile_id is not null) as is_saved,
    case
      when v_region is not null and p.region = v_region then 'same_region'
      else 'not_followed_yet'
    end                      as suggestion_reason_key,
    public.footme_feed_reason_label(
      case
        when v_region is not null and p.region = v_region then 'same_region'
        else 'not_followed_yet'
      end
    )                        as suggestion_reason_label,
    public.footme_feed_component_version('suggested_profiles') as component_version
  from public.profiles p
  left join public.player_profiles pp on pp.profile_id = p.id
  left join lateral (
    select cm.club_id
    from public.club_members cm
    where cm.profile_id = p.id
      and cm.status = 'active'
      and cm.is_current = true
    order by cm.created_at desc
    limit 1
  ) cm on true
  left join public.clubs cm_club on cm_club.id = cm.club_id
  left join public.saved_profiles sv
    on sv.owner_profile_id = v_uid and sv.target_profile_id = p.id
  where p.id <> v_uid
    and p.full_name is not null
    and p.role <> 'admin'
    and not coalesce(p.is_admin, false)
    and not exists (
      select 1 from public.profile_follows pf
      where pf.follower_profile_id = v_uid and pf.followed_profile_id = p.id
    )
    and not exists (
      select 1 from blocked_profiles bp where bp.profile_id = p.id
    )
  order by
    (v_region is not null and p.region = v_region) desc,
    (p.role::text = any(v_relevant)) desc,
    (v_pref_active and coalesce(v_wants_players, false) and p.role = 'player') desc,
    p.updated_at desc nulls last,
    p.id asc
  limit v_limit;
end;
$$;

revoke all on function public.fetch_home_suggested_profiles(int) from public;
grant execute on function public.fetch_home_suggested_profiles(int) to authenticated;


-- ============================================================
-- SECTION 2: RPC public.fetch_home_suggested_clubs
--
-- Società consigliate. Esclude quelle già seguite e quelle di cui il
-- chiamante è owner (suggerirgli la propria società sarebbe rumore).
-- `open_positions_count` è l'unica informazione "operativa" ammessa qui: è
-- una proprietà della società, non un KPI della Home (§22).
-- ============================================================

drop function if exists public.fetch_home_suggested_clubs(int);

create or replace function public.fetch_home_suggested_clubs(
  p_limit int default 6
)
returns table (
  item_uid                text,
  entity_id               uuid,
  name                    text,
  logo_url                text,
  city                    text,
  province                text,
  region                  text,
  category                text,
  open_positions_count    int,
  is_following            boolean,
  is_saved                boolean,
  suggestion_reason_key   text,
  suggestion_reason_label text,
  component_version       smallint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_limit  int := least(greatest(coalesce(p_limit, 6), 1), 20);
  v_region text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select p.region into v_region from public.profiles p where p.id = v_uid;

  return query
  select
    'club:' || c.id::text as item_uid,
    c.id                  as entity_id,
    c.name,
    c.logo_url,
    c.city,
    c.province,
    c.region,
    c.category,
    coalesce(ads.open_count, 0)::int as open_positions_count,
    false                 as is_following,
    (sv.club_id is not null) as is_saved,
    case
      when v_region is not null and c.region = v_region then 'same_region'
      else 'not_followed_yet'
    end                   as suggestion_reason_key,
    public.footme_feed_reason_label(
      case
        when v_region is not null and c.region = v_region then 'same_region'
        else 'not_followed_yet'
      end
    )                     as suggestion_reason_label,
    public.footme_feed_component_version('suggested_clubs') as component_version
  from public.clubs c
  left join lateral (
    select count(*) as open_count
    from public.recruiting_ads ra
    where ra.club_id = c.id
      and ra.status = 'published'
      and (ra.deadline is null or ra.deadline >= current_date)
  ) ads on true
  left join public.saved_clubs sv
    on sv.owner_profile_id = v_uid and sv.club_id = c.id
  where c.owner_profile_id is distinct from v_uid
    and not exists (
      select 1 from public.club_follows cf
      where cf.profile_id = v_uid and cf.club_id = c.id
    )
  order by
    (v_region is not null and c.region = v_region) desc,
    (coalesce(ads.open_count, 0) > 0) desc,
    c.name asc,
    c.id asc
  limit v_limit;
end;
$$;

revoke all on function public.fetch_home_suggested_clubs(int) from public;
grant execute on function public.fetch_home_suggested_clubs(int) to authenticated;
