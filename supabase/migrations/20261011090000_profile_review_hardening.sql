-- ============================================================
-- Migration: audit di fine ciclo REV-PROF-01..22 — hardening.
--
-- Migrazione additiva e idempotente: tutte le migrazioni precedenti sono
-- gia' applicate in produzione, quindi qui si usano solo
-- `create or replace function`, `alter table ... add column if not exists`
-- e `revoke`/`grant` ripetibili. Nessuna migrazione esistente viene toccata.
--
-- Chiude cinque problemi trovati in audit:
--   1. lo stato 'expired' di agent_assistito_invites non veniva mai
--      persistito (resolve_agent_assistito_invite annullava il proprio
--      update con il raise exception che segue, nella stessa transazione);
--      diventa uno stato derivato ovunque lo status viene letto;
--   2. save_player_profile_details poteva sovrascrivere righe carriera di
--      profili altrui (on conflict senza verifica di proprieta', in una
--      funzione security definer su una tabella con select using(true));
--   3. fetch_public_media_profile, essendo security invoker, non vedeva mai
--      le righe di user_blocks nella direzione "testata -> viewer" (la sola
--      policy select di user_blocks e' sul blocker);
--   4. il toggle "Mostra l'ente" del Procuratore riusa is_federation_licensed
--      per due concetti diversi (avere la licenza vs. mostrarla): si separa
--      con una colonna show_federation;
--   5. `revoke ... from public` non toglie l'execute di default che Supabase
--      concede ad `anon`: le RPC del dominio profilo che richiedono
--      autenticazione restano comunque invocabili con la sola anon key.
--
-- Non provata su un DB reale: nessun db push / db reset e' stato eseguito.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — lo stato 'expired' degli inviti diventa derivato
-- ============================================================

-- 1a. resolve_agent_assistito_invite: l'update su 'expired' veniva annullato
--     dal raise exception che lo seguiva nella stessa transazione (una
--     funzione plpgsql non puo' committare a meta' di se stessa). Si toglie
--     l'update inutile: l'eccezione 'INVITE_EXPIRED' resta, il client la
--     gestisce gia'. Corpo invariato per il resto.
create or replace function public.resolve_agent_assistito_invite(p_token text)
returns table (
  invite_id         uuid,
  invite_status     text,
  agent_profile_id  uuid,
  agent_full_name   text,
  agent_avatar_url  text,
  agency_name       text,
  relationship_type text,
  visibility        text,
  manual_full_name  text,
  expires_at        timestamptz,
  already_linked    boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user   uuid := auth.uid();
  v_hash   text;
  v_invite public.agent_assistito_invites%rowtype;
  v_manual public.agent_manual_assistiti%rowtype;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_agent_rate_limit(
    'invite_resolve', null, 20, interval '1 hour'
  );

  v_hash := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');

  select * into v_invite
  from public.agent_assistito_invites
  where token_hash = v_hash;

  if not found then
    raise exception 'INVITE_INVALID';
  end if;

  if v_invite.status = 'revoked' then
    raise exception 'INVITE_INVALID';
  end if;

  if v_invite.expires_at <= timezone('utc', now()) then
    -- BUG-FIX: qui sotto viveva un `update ... set status = 'expired'`
    -- seguito subito dal `raise exception`. L'eccezione fa rollback
    -- dell'intera funzione, quindi quell'update non e' mai stato persistito
    -- in nessuna chiamata: l'invito restava 'created'/'shared' per sempre e
    -- non finiva mai fra i "Conclusi" nell'hub del procuratore. Non si puo'
    -- correggere committando dentro la funzione (impossibile in plpgsql), e
    -- quindi la scadenza diventa uno stato *derivato* da `expires_at`,
    -- calcolato in sola lettura ovunque lo status viene esposto (vedi
    -- fetch_agent_assistiti_overview e find_agent_manual_duplicates piu'
    -- sotto). L'eccezione resta: e' l'unico comportamento che il client
    -- gestisce per bloccare la risoluzione di un invito scaduto.
    raise exception 'INVITE_EXPIRED';
  end if;

  select * into v_manual
  from public.agent_manual_assistiti
  where id = v_invite.manual_assistito_id;

  if not found then
    raise exception 'INVITE_INVALID';
  end if;

  if v_invite.agent_profile_id = v_user then
    -- Il procuratore che apre il proprio link non e' il destinatario.
    raise exception 'INVITE_SELF';
  end if;

  -- Apertura registrata una volta sola: il contatore non deve avanzare a ogni
  -- rimbalzo fra login e schermata.
  update public.agent_assistito_invites
  set
    status                = case
                              when status in ('created', 'shared') then 'opened'
                              else status
                            end,
    opened_at             = coalesce(opened_at, timezone('utc', now())),
    registered_profile_id = coalesce(registered_profile_id, v_user),
    updated_at            = timezone('utc', now())
  where id = v_invite.id;

  return query
    select
      v_invite.id,
      case when v_invite.status in ('created', 'shared') then 'opened' else v_invite.status end,
      v_invite.agent_profile_id,
      p.full_name,
      p.avatar_url,
      ap.agency_name,
      v_manual.relationship_type,
      v_manual.visibility,
      v_manual.full_name,
      v_invite.expires_at,
      exists (
        select 1
        from public.agent_representations r
        where r.agent_profile_id  = v_invite.agent_profile_id
          and r.player_profile_id = v_user
          and r.status in ('pending', 'accepted')
      )
    from public.profiles p
    left join public.agent_profiles ap
      on ap.profile_id = p.id
    where p.id = v_invite.agent_profile_id;
end;
$$;

revoke all on function public.resolve_agent_assistito_invite(text) from public;
grant execute on function public.resolve_agent_assistito_invite(text) to authenticated;
revoke execute on function public.resolve_agent_assistito_invite(text) from anon;


-- 1b. fetch_agent_assistiti_overview: la colonna invite_status, per il ramo
--     'manual', ora deriva 'expired' da expires_at invece di fidarsi della
--     colonna status (che per il motivo spiegato sopra non diventa mai
--     'expired' da sola). Anche l'ordinamento della lateral che sceglie
--     "l'invito piu' recente da mostrare" tiene conto della stessa
--     condizione, altrimenti un invito scaduto per tempo ma con status
--     ancora 'shared' continuerebbe a vincere su uno piu' vecchio e valido.
--     Corpo identico all'originale (20261002160000) per il resto.
create or replace function public.fetch_agent_assistiti_overview(
  p_agent_profile_id uuid
)
returns table (
  kind              text,
  id                uuid,
  player_profile_id uuid,
  full_name         text,
  avatar_url        text,
  primary_position  public.player_position,
  team_label        text,
  relationship_type text,
  visibility        text,
  status            text,
  started_on        date,
  ended_on          date,
  invite_id         uuid,
  invite_status     text,
  invite_channel    text,
  invite_shared_at  timestamptz,
  invite_expires_at timestamptz,
  created_at        timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if auth.uid() <> p_agent_profile_id then
    raise exception 'Non autorizzato';
  end if;

  -- L'unione vive dentro una sottoquery con alias: l'ORDER BY finale deve
  -- poter qualificare la colonna, altrimenti `created_at` coincide con il
  -- parametro OUT omonimo e il riferimento diventa ambiguo a runtime.
  return query
    select
      u.kind,
      u.id,
      u.player_profile_id,
      u.full_name,
      u.avatar_url,
      u.primary_position,
      u.team_label,
      u.relationship_type,
      u.visibility,
      u.status,
      u.started_on,
      u.ended_on,
      u.invite_id,
      u.invite_status,
      u.invite_channel,
      u.invite_shared_at,
      u.invite_expires_at,
      u.created_at
    from (
    select
      'representation'::text                             as kind,
      r.id                                               as id,
      r.player_profile_id                                as player_profile_id,
      p.full_name                                        as full_name,
      p.avatar_url                                       as avatar_url,
      pp.primary_position                                as primary_position,
      cl.name                                            as team_label,
      r.relationship_type                                as relationship_type,
      r.visibility                                       as visibility,
      r.status                                           as status,
      r.started_on                                       as started_on,
      r.ended_on                                         as ended_on,
      null::uuid                                         as invite_id,
      null::text                                         as invite_status,
      null::text                                         as invite_channel,
      null::timestamptz                                  as invite_shared_at,
      null::timestamptz                                  as invite_expires_at,
      r.created_at                                       as created_at
    from public.agent_representations r
    join public.profiles p
      on p.id = r.player_profile_id
    left join public.player_profiles pp
      on pp.profile_id = r.player_profile_id
    left join lateral (
      select c.name
      from public.club_members cm
      join public.clubs c on c.id = cm.club_id
      where cm.profile_id = r.player_profile_id
        and cm.is_current = true
        and cm.status = 'active'
      limit 1
    ) cl on true
    where r.agent_profile_id = p_agent_profile_id
      and r.status in ('pending', 'accepted', 'rejected', 'revoked', 'terminated', 'removed')

    union all

    select
      'manual'::text,
      m.id,
      m.linked_profile_id,
      m.full_name,
      null::text,
      m.primary_position,
      m.team_label,
      m.relationship_type,
      m.visibility,
      m.status,
      m.started_on,
      null::date,
      i.id,
      -- BUG-FIX: scadenza derivata, vedi commento sopra la funzione.
      case
        when i.status in ('created', 'shared')
         and i.expires_at <= timezone('utc', now())
          then 'expired'
        else i.status
      end,
      i.channel,
      i.shared_at,
      i.expires_at,
      m.created_at
    from public.agent_manual_assistiti m
    left join lateral (
      select inv.*
      from public.agent_assistito_invites inv
      where inv.manual_assistito_id = m.id
      order by
        -- Un invito 'created'/'shared' ma scaduto per tempo va deprioritizzato
        -- come un 'revoked'/'expired' esplicito: altrimenti, con piu' inviti
        -- per lo stesso record manuale, l'ultimo creato ma scaduto vincerebbe
        -- su uno precedente ancora valido.
        case
          when inv.status in ('revoked', 'expired') then 1
          when inv.status in ('created', 'shared')
           and inv.expires_at <= timezone('utc', now()) then 1
          else 0
        end,
        inv.created_at desc
      limit 1
    ) i on true
    where m.agent_profile_id = p_agent_profile_id
      and m.status <> 'linked'
    ) u
    order by u.created_at desc;
end;
$$;

revoke all on function public.fetch_agent_assistiti_overview(uuid) from public;
grant execute on function public.fetch_agent_assistiti_overview(uuid) to authenticated;
revoke execute on function public.fetch_agent_assistiti_overview(uuid) from anon;


-- 1c. find_agent_manual_duplicates: la sottoquery che cerca "l'invito ancora
--     attivo" per il controllo duplicati escludeva solo lo status letterale
--     'revoked'/'expired'. Ora esclude anche l'invito effettivamente scaduto
--     per tempo (altrimenti risalirebbe come se fosse ancora condivisibile),
--     e la colonna restituita applica la stessa derivazione per coerenza.
--     Corpo identico all'originale (20261002160000) per il resto.
create or replace function public.find_agent_manual_duplicates(
  p_full_name text,
  p_position  public.player_position default null,
  p_team      text default null
)
returns table (
  kind              text,
  id                uuid,
  full_name         text,
  primary_position  public.player_position,
  team_label        text,
  status            text,
  invite_status     text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_agent      uuid := auth.uid();
  v_normalized text;
  v_team       text;
begin
  if v_agent is null then
    raise exception 'Authentication required';
  end if;

  v_normalized := lower(regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g'));
  v_team       := nullif(lower(trim(coalesce(p_team, ''))), '');

  if v_normalized = '' then
    return;
  end if;

  return query
    -- Record manuali ancora attivi dello stesso procuratore.
    select
      'manual'::text                                      as kind,
      m.id,
      m.full_name,
      m.primary_position,
      m.team_label,
      m.status,
      (
        select case
                 -- BUG-FIX: scadenza derivata, vedi resolve_agent_assistito_invite.
                 when i.status in ('created', 'shared')
                  and i.expires_at <= timezone('utc', now())
                   then 'expired'
                 else i.status
               end
        from public.agent_assistito_invites i
        where i.manual_assistito_id = m.id
          and i.status <> 'revoked'
          and not (
            i.status in ('created', 'shared')
            and i.expires_at <= timezone('utc', now())
          )
        order by i.created_at desc
        limit 1
      )                                                   as invite_status
    from public.agent_manual_assistiti m
    where m.agent_profile_id = v_agent
      and m.status = 'active'
      and m.normalized_name = v_normalized
      and (p_position is null or m.primary_position is null or m.primary_position = p_position)
      and (
        v_team is null
        or m.team_label is null
        or lower(trim(m.team_label)) = v_team
      )

    union all

    -- Relazioni gia' esistenti con un profilo omonimo: un duplicato puo'
    -- benissimo essere un calciatore gia' collegato.
    select
      'representation'::text                              as kind,
      r.id,
      p.full_name,
      pp.primary_position,
      null::text                                          as team_label,
      r.status,
      null::text                                          as invite_status
    from public.agent_representations r
    join public.profiles p
      on p.id = r.player_profile_id
    left join public.player_profiles pp
      on pp.profile_id = r.player_profile_id
    where r.agent_profile_id = v_agent
      and r.status in ('pending', 'accepted')
      and lower(regexp_replace(trim(coalesce(p.full_name, '')), '\s+', ' ', 'g')) = v_normalized;
end;
$$;

revoke all on function public.find_agent_manual_duplicates(text, public.player_position, text) from public;
grant execute on function public.find_agent_manual_duplicates(text, public.player_position, text) to authenticated;
revoke execute on function public.find_agent_manual_duplicates(text, public.player_position, text) from anon;

-- 1d. fetch_agent_assistiti_counts: verificato e lasciato invariato. La sua
--     colonna `invite_count` non legge affatto `agent_assistito_invites`:
--     conta `agent_manual_assistiti` con `status = 'active'`, che non cambia
--     quando un invito scade (la scadenza non tocca lo status del record
--     manuale). Non contava e non contera' gli inviti scaduti come attivi,
--     quindi non necessita di modifiche per questo bug.
comment on function public.fetch_agent_assistiti_counts(uuid) is
  'Conteggi dell''hub Assistiti. invite_count conta agent_manual_assistiti '
  'attivi, non lo status degli inviti: la scadenza derivata (vedi '
  'resolve_agent_assistito_invite) non lo riguarda.';


-- ============================================================
-- SEZIONE 2 — save_player_profile_details: guardia di proprieta' sugli id
-- ============================================================
-- BUG-FIX: la funzione e' security definer e bypassa quindi la RLS "for all"
-- di player_career_entries; la select su quella tabella e' pero'
-- `using (true)`, cioe' ogni utente autenticato puo' leggere gli id altrui.
-- L'`on conflict (id) do update` non verificava la proprieta': un id copiato
-- da un'altra carriera veniva sovrascritto silenziosamente. Si aggiunge una
-- guardia esplicita (gli id gia' esistenti devono appartenere a
-- p_profile_id; gli id nuovi, non ancora in tabella, restano ammessi: sono
-- quelli generati dal client per una riga che sta per essere creata) e un
-- filtro difensivo sulla clausola di update. Corpo invariato per il resto.
create or replace function public.save_player_profile_details(
  p_profile_id uuid,
  p_player_profile jsonb,
  p_career_entries jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
begin
  if current_profile_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_user(p_profile_id) then
    raise exception 'Profile not accessible';
  end if;

  -- BUG-FIX: blocca la sovrascrittura di righe carriera di altri profili.
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_career_entries, '[]'::jsonb)) as entry(id uuid)
    join public.player_career_entries existing
      on existing.id = entry.id
    where entry.id is not null
      and existing.player_profile_id <> p_profile_id
  ) then
    raise exception 'Not authorized to modify these career entries';
  end if;

  insert into public.player_profiles (
    profile_id,
    preferred_foot,
    height_cm,
    weight_kg,
    primary_position,
    secondary_positions,
    willing_to_change_club,
    availability_type,
    transfer_regions,
    transfer_provinces,
    preferred_categories,
    highlight_video_url,
    open_to_trials,
    player_objectives,
    contract_status,
    contract_expiry,
    current_condition,
    show_transfer_badge,
    show_regions_badge
  )
  select
    p_profile_id,
    payload.preferred_foot,
    payload.height_cm,
    payload.weight_kg,
    coalesce(payload.primary_position, 'central_midfielder'::public.player_position),
    coalesce(payload.secondary_positions, '{}'::public.player_position[]),
    coalesce(payload.willing_to_change_club, false),
    coalesce(payload.availability_type, 'ITALY'),
    coalesce(payload.transfer_regions, '{}'::text[]),
    coalesce(payload.transfer_provinces, '{}'::text[]),
    coalesce(payload.preferred_categories, '{}'::text[]),
    payload.highlight_video_url,
    coalesce(payload.open_to_trials, false),
    coalesce(payload.player_objectives, '{}'::text[]),
    payload.contract_status,
    payload.contract_expiry,
    payload.current_condition,
    coalesce(payload.show_transfer_badge, false),
    coalesce(payload.show_regions_badge, false)
  from jsonb_to_record(coalesce(p_player_profile, '{}'::jsonb)) as payload(
    preferred_foot public.preferred_foot,
    height_cm integer,
    weight_kg integer,
    primary_position public.player_position,
    secondary_positions public.player_position[],
    willing_to_change_club boolean,
    availability_type text,
    transfer_regions text[],
    transfer_provinces text[],
    preferred_categories text[],
    highlight_video_url text,
    open_to_trials boolean,
    player_objectives text[],
    contract_status text,
    contract_expiry date,
    current_condition text,
    show_transfer_badge boolean,
    show_regions_badge boolean
  )
  on conflict (profile_id) do update
  set
    preferred_foot = excluded.preferred_foot,
    height_cm = excluded.height_cm,
    weight_kg = excluded.weight_kg,
    primary_position = excluded.primary_position,
    secondary_positions = excluded.secondary_positions,
    willing_to_change_club = excluded.willing_to_change_club,
    availability_type = excluded.availability_type,
    transfer_regions = excluded.transfer_regions,
    transfer_provinces = excluded.transfer_provinces,
    preferred_categories = excluded.preferred_categories,
    highlight_video_url = excluded.highlight_video_url,
    open_to_trials = excluded.open_to_trials,
    player_objectives = excluded.player_objectives,
    contract_status = excluded.contract_status,
    contract_expiry = excluded.contract_expiry,
    current_condition = excluded.current_condition,
    show_transfer_badge = excluded.show_transfer_badge,
    show_regions_badge = excluded.show_regions_badge,
    updated_at = timezone('utc', now());

  with provided_entries as (
    select *
    from jsonb_to_recordset(coalesce(p_career_entries, '[]'::jsonb)) as entry(
      id uuid,
      appearances integer,
      assists integer,
      awards text,
      club_id uuid,
      club_name text,
      competition_name text,
      goals integer,
      minutes_played integer,
      season_label text,
      sort_order integer,
      team_logo_url text,
      season_period text,
      period_start_month smallint,
      period_end_month smallint,
      experience_group_id text,
      career_type text
    )
  )
  delete from public.player_career_entries career
  where career.player_profile_id = p_profile_id
    and not exists (
      select 1
      from provided_entries entry
      where entry.id is not null
        and entry.id = career.id
    );

  with provided_entries as (
    select *
    from jsonb_to_recordset(coalesce(p_career_entries, '[]'::jsonb)) as entry(
      id uuid,
      appearances integer,
      assists integer,
      awards text,
      club_id uuid,
      club_name text,
      competition_name text,
      goals integer,
      minutes_played integer,
      season_label text,
      sort_order integer,
      team_logo_url text,
      season_period text,
      period_start_month smallint,
      period_end_month smallint,
      experience_group_id text,
      career_type text
    )
  )
  insert into public.player_career_entries (
    id,
    player_profile_id,
    season_label,
    club_name,
    competition_name,
    appearances,
    goals,
    assists,
    minutes_played,
    awards,
    sort_order,
    team_logo_url,
    club_id,
    season_period,
    period_start_month,
    period_end_month,
    experience_group_id,
    career_type
  )
  select
    coalesce(entry.id, gen_random_uuid()),
    p_profile_id,
    entry.season_label,
    entry.club_name,
    entry.competition_name,
    entry.appearances,
    entry.goals,
    entry.assists,
    entry.minutes_played,
    entry.awards,
    coalesce(entry.sort_order, 0),
    entry.team_logo_url,
    entry.club_id,
    coalesce(entry.season_period, 'full'),
    entry.period_start_month,
    entry.period_end_month,
    entry.experience_group_id,
    entry.career_type
  from provided_entries entry
  on conflict (id) do update
  set
    season_label = excluded.season_label,
    club_name = excluded.club_name,
    competition_name = excluded.competition_name,
    appearances = excluded.appearances,
    goals = excluded.goals,
    assists = excluded.assists,
    minutes_played = excluded.minutes_played,
    awards = excluded.awards,
    sort_order = excluded.sort_order,
    club_id = excluded.club_id,
    team_logo_url = excluded.team_logo_url,
    season_period = excluded.season_period,
    period_start_month = excluded.period_start_month,
    period_end_month = excluded.period_end_month,
    experience_group_id = excluded.experience_group_id,
    career_type = excluded.career_type
  where public.player_career_entries.player_profile_id = p_profile_id;
end;
$$;

revoke all on function public.save_player_profile_details(uuid, jsonb, jsonb) from public;
grant execute on function public.save_player_profile_details(uuid, jsonb, jsonb) to authenticated;
revoke execute on function public.save_player_profile_details(uuid, jsonb, jsonb) from anon;


-- ============================================================
-- SEZIONE 3 — fetch_public_media_profile: diventa security definer
-- ============================================================
-- BUG-FIX: `user_blocks` ha una sola policy select, `using
-- (is_current_user(blocker_profile_id))`. Con la funzione `security invoker`
-- il ramo `blocker_profile_id = p_profile_id and blocked_profile_id = v_uid`
-- (la testata ha bloccato il viewer) non puo' mai restituire righe, perche'
-- il viewer non e' il blocker di quella riga. Si converte la funzione a
-- `security definer`, come gia' fa `fetch_public_fan_profile`, mantenendo
-- intatto il check di autenticazione in testa e tutta la logica di
-- visibilita'. Verificato che nessun'altra tabella letta qui cambi
-- comportamento diventando definer: `profiles`, `media_profiles` e
-- `profile_follows` hanno gia' select `using (true)` per gli autenticati, e
-- `media_profile_channels` e' comunque filtrata su `is_public` nella query;
-- il payload resta costruito campo per campo, nessuna colonna nuova esce.
create or replace function public.fetch_public_media_profile(
  p_profile_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_profile      record;
  v_media        record;
  v_is_owner     boolean;
  v_is_blocked   boolean;
  v_channels     jsonb;
  v_website      text;
  v_contacts     record;
begin
  if p_profile_id is null then
    return null;
  end if;

  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select p.id, p.role, p.cover_url
    into v_profile
  from public.profiles p
  where p.id = p_profile_id;

  if not found or v_profile.role <> 'media' then
    return null;
  end if;

  v_is_owner := v_uid = p_profile_id;

  v_is_blocked := not v_is_owner and exists (
    select 1
    from public.user_blocks block
    where (block.blocker_profile_id = v_uid
           and block.blocked_profile_id = p_profile_id)
       or (block.blocker_profile_id = p_profile_id
           and block.blocked_profile_id = v_uid)
  );

  if v_is_blocked then
    return null;
  end if;

  select
    m.entity_name,
    m.short_description,
    m.logo_url,
    m.creator_type,
    m.creator_type_other,
    m.editorial_type,
    m.affiliation_type,
    m.verification_status,
    m.coverage_scope,
    coalesce(m.focus_areas, '{}'::text[])          as focus_areas,
    coalesce(m.content_types, '{}'::text[])        as content_types,
    coalesce(m.covered_territories, '{}'::text[])  as covered_territories,
    coalesce(m.covered_provinces, '{}'::text[])    as covered_provinces,
    coalesce(m.covered_competitions, '{}'::text[]) as covered_competitions,
    coalesce(m.covered_teams, '{}'::text[])        as covered_teams,
    coalesce(m.covered_topics, '{}'::text[])       as covered_topics
    into v_media
  from public.media_profiles m
  where m.profile_id = p_profile_id;

  select c.instagram, c.facebook, c.tiktok, c.youtube, c.website
    into v_contacts
  from public.get_profile_public_contacts(p_profile_id) c;

  with legacy as (
    select
      ch.channel_type,
      nullif(trim(ch.label), '') as label,
      trim(ch.url)               as url,
      ch.sort_order
    from public.media_profile_channels ch
    where ch.media_profile_id = p_profile_id
      and ch.is_public
      and trim(ch.url) <> ''
  ),
  onboarding as (
    -- I tipi sono espliciti perché questo ramo apre la UNION: un letterale
    -- `unknown` in prima posizione lascerebbe la risoluzione dei tipi al
    -- caso, e qui si uniscono colonne vere a letterali.
    select * from (
      values
        ('website'::text,   nullif(trim(v_contacts.website), ''),   0),
        ('instagram'::text, nullif(trim(v_contacts.instagram), ''), 1),
        ('youtube'::text,   nullif(trim(v_contacts.youtube), ''),   2),
        ('tiktok'::text,    nullif(trim(v_contacts.tiktok), ''),    3),
        ('facebook'::text,  nullif(trim(v_contacts.facebook), ''),  4)
    ) as t(channel_type, url, sort_order)
    where url is not null
  ),
  merged as (
    -- REV-PROF-22: `profile_contacts` è la superficie che l'editor scrive, e
    -- vince sulla tabella storica. Prima era il contrario, e un canale
    -- corretto nell'editor sarebbe rimasto invisibile dietro il valore
    -- legacy che nessuna schermata sa più modificare.
    select channel_type, null::text as label, url, sort_order, 0 as source_rank
      from onboarding
    union all
    select channel_type, label, url, sort_order, 1 from legacy
  ),
  deduplicated as (
    select distinct on (channel_type)
      channel_type, label, url, sort_order
    from merged
    order by channel_type, source_rank, sort_order
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'channel_type', channel_type,
        'label',        label,
        'url',          url
      )
      order by sort_order, channel_type
    ),
    '[]'::jsonb
  )
    into v_channels
  from deduplicated;

  select url into v_website
  from jsonb_to_recordset(v_channels) as c(channel_type text, url text)
  where c.channel_type = 'website'
  limit 1;

  return jsonb_build_object(
    'entity', jsonb_build_object(
      'profile_id',           p_profile_id,
      'entity_name',          nullif(trim(coalesce(v_media.entity_name, '')), ''),
      'short_description',    nullif(trim(coalesce(v_media.short_description, '')), ''),
      'logo_url',             nullif(trim(coalesce(v_media.logo_url, '')), ''),
      'cover_url',            nullif(trim(coalesce(v_profile.cover_url, '')), ''),
      'creator_type',         v_media.creator_type,
      'creator_type_other',   nullif(trim(coalesce(v_media.creator_type_other, '')), ''),
      'editorial_type',       nullif(trim(coalesce(v_media.editorial_type, '')), ''),
      'affiliation_type',     nullif(trim(coalesce(v_media.affiliation_type, '')), ''),
      'verification_status',  coalesce(v_media.verification_status, 'unverified'),
      'coverage_scope',       v_media.coverage_scope,
      'focus_areas',          to_jsonb(coalesce(v_media.focus_areas, '{}'::text[])),
      'content_types',        to_jsonb(coalesce(v_media.content_types, '{}'::text[])),
      'covered_territories',  to_jsonb(coalesce(v_media.covered_territories, '{}'::text[])),
      'covered_provinces',    to_jsonb(coalesce(v_media.covered_provinces, '{}'::text[])),
      'covered_competitions', to_jsonb(coalesce(v_media.covered_competitions, '{}'::text[])),
      'covered_teams',        to_jsonb(coalesce(v_media.covered_teams, '{}'::text[])),
      'covered_topics',       to_jsonb(coalesce(v_media.covered_topics, '{}'::text[])),
      'channels',             coalesce(v_channels, '[]'::jsonb),
      'website_url',          v_website
    ),
    'viewer', jsonb_build_object(
      'mode', case when v_is_owner then 'owner' else 'visitor' end,
      'can_edit_profile',            v_is_owner,
      'can_publish_article',         v_is_owner,
      'can_create_tribuna_content',  v_is_owner,
      'can_manage_tribuna_content',  v_is_owner,
      'can_add_media',               v_is_owner,
      'can_follow',                  not v_is_owner,
      'can_message',                 not v_is_owner,
      'can_share',                   true,
      'can_report',                  not v_is_owner,
      'can_block',                   not v_is_owner,
      'can_view_website',            v_website is not null,
      'is_following', not v_is_owner and exists (
        select 1
        from public.profile_follows f
        where f.followed_profile_id = p_profile_id
          and f.follower_profile_id = v_uid
      )
    )
  );
end;
$$;

comment on function public.fetch_public_media_profile(uuid) is
  'REV-PROF-21 / REV-PROF-22: payload pubblico + capabilities del Master '
  'Profile Media/Creator. Proiezione esplicita: nessun dato personale del '
  'proprietario puo uscire da qui. Security definer dalla hardening di fine '
  'ciclo: serve a vedere entrambe le direzioni di user_blocks.';

revoke all on function public.fetch_public_media_profile(uuid) from public;
grant execute on function public.fetch_public_media_profile(uuid) to authenticated;
revoke execute on function public.fetch_public_media_profile(uuid) from anon;


-- ============================================================
-- SEZIONE 4 — Procuratore: "Mostra l'ente" non deve cancellare la licenza
-- ============================================================
-- Oggi il client scrive `is_federation_licensed = isLicensed && showFederation`
-- (apps/mobile/src/features/profiles/agent-edit/sections/
-- AgentProfessionalProfileScreen.tsx): nascondere l'ente azzera anche il
-- fatto di avere la licenza, che e' un dato diverso e viene letto anche dal
-- filtro di ricerca "con licenza" (`search_profiles_filters`,
-- `v_a_is_federation_licensed`). Si aggiunge la colonna che separa i due
-- concetti; il default `true` preserva il comportamento attuale per le righe
-- esistenti (oggi "licenziato" implica "ente visibile", quindi non si perde
-- informazione passando al default).
alter table public.agent_profiles
  add column if not exists show_federation boolean not null default true;

comment on column public.agent_profiles.show_federation is
  'Hardening fine ciclo REV-PROF-16: separa "ha la licenza" '
  '(is_federation_licensed, usato anche dal filtro di ricerca) da '
  '"mostra il nome dell''ente nel profilo pubblico" (federation + questo '
  'flag). Prima del 2026-10-11 i due concetti erano un solo booleano e '
  'nascondere l''ente azzerava anche la licenza.';

-- LIMITE NOTO, non risolvibile in sola SQL in questa migrazione: non esiste
-- una RPC che costruisce il payload pubblico del Procuratore (a differenza
-- di Media/Fan/Società). Il client legge `agent_profiles` direttamente via
-- PostgREST, sotto la policy "agent profiles are readable by authenticated
-- users" (`using (true)`, to authenticated — invariata di proposito: non va
-- toccata, altrimenti si rompono le altre funzionalita' che leggono la
-- stessa tabella). Questo significa che `federation` resta leggibile da
-- chiunque sia autenticato indipendentemente da `show_federation`: la nuova
-- colonna, da sola, non maschera ancora nulla lato server.
-- Per chiudere davvero il mascheramento servirebbe una delle due cose,
-- entrambe fuori dallo scope di questa migrazione (sola SQL, nessun file
-- fuori da supabase/migrations):
--   a) una RPC pubblica security definer (sul modello di
--      fetch_public_media_profile / fetch_public_fan_profile) che proietti
--      `agent_profiles` campo per campo e restituisca `federation = null`
--      quando `show_federation = false`, con il client migrato a leggerla
--      al posto della select diretta sulla tabella; oppure
--   b) il client smette di inviare `federation`/`is_federation_licensed` nel
--      payload pubblico quando sta renderizzando il profilo di un altro
--      utente (mascheramento solo lato client, piu' debole: chiunque puo'
--      comunque leggere `federation` via REST con la sola anon/auth key).
-- Richiede un follow-up frontend esplicito: oggi il client scrive ancora
-- `is_federation_licensed: form.isLicensed && form.showFederation` — va
-- separato in due scritture indipendenti (`is_federation_licensed:
-- form.isLicensed`, `show_federation: form.showFederation`) perche' la
-- colonna aggiunta qui serva a qualcosa.


-- ============================================================
-- SEZIONE 5 — revoca dell'execute di default per il ruolo anon
-- ============================================================
-- Supabase concede execute di default su tutte le funzioni nuove sia ad
-- `anon` sia ad `authenticated`. Il pattern storico del progetto
-- (`revoke all ... from public; grant execute ... to authenticated;`) non
-- tocca quella concessione di default: il ruolo `public` non include `anon`
-- come membro implicito ai fini dei privilegi su oggetti, e le funzioni
-- restano quindi eseguibili con la sola anon key, protette solo dai check
-- `if auth.uid() is null then raise exception` dentro al corpo — quando
-- presenti. Le funzioni qui sotto appartengono al dominio profilo e
-- richiedono un utente autenticato per fare qualunque cosa di utile; si
-- revoca esplicitamente l'execute da `anon` per ciascuna.
--
-- Esclusioni volute:
--   • funzioni trigger (nessun grant utile, non sono mai invocate via RPC):
--     agent_career_entry_defaults, agent_representation_featured_guard,
--     guard_club_ownership_columns, normalize_fan_profile_preferences,
--     notifications_before_insert, sync_agent_portfolio_entries;
--   • can_manage_society: concessa di proposito anche ad anon
--     (20261008090000:156), lasciata invariata;
--   • footme_content_kind_label(text, text): verificata caso per caso e
--     esclusa di proposito. E' `language sql immutable`, non legge nessuna
--     tabella (e' solo una tabella di traduzione italiana per due codici
--     testuali), non ha e non le serve un check di autenticazione, ed e'
--     usata solo come funzione innestata dentro le viste
--     media_content_index/media_source_index (che a loro volta sono gia'
--     revocate sia da anon sia da authenticated e leggibili solo dalle RPC
--     di ricerca security definer). Revocarla non chiude nessuna
--     esposizione reale.
--
-- Le funzioni seguenti sono state verificate (via grep sulle migrazioni che
-- le definiscono) per avere tutte un controllo esplicito
-- `if auth.uid() is null then raise exception` nel corpo, oppure — nei casi
-- in cui ne sono prive (fetch_society_master_profile,
-- fetch_society_profile_editor, fetch_society_team_profile,
-- fetch_media_profile_article_categories, search_fan_favorite_clubs,
-- get_profile_public_contacts) — restano comunque funzioni del dominio
-- profilo riservate a utenti autenticati per policy di prodotto, quindi la
-- revoca riduce la superficie anche dove la RLS (per le `security invoker`)
-- o l'assenza di dati sensibili (per le `security definer` filtrate sui
-- flag `show_*`) le rendeva gia' innocue per `anon`.

revoke execute on function public.assert_agent_rate_limit(text, text, integer, interval) from anon;
revoke execute on function public.create_agent_manual_assistito(text, text, public.player_position, text, date, boolean) from anon;
revoke execute on function public.delete_agent_career_entry(uuid, uuid) from anon;
revoke execute on function public.delete_agent_manual_assistito(uuid) from anon;
revoke execute on function public.end_agent_career_entry(uuid, uuid, text, integer) from anon;
revoke execute on function public.end_agent_representation(uuid, date) from anon;
revoke execute on function public.fetch_agent_assistiti_counts(uuid) from anon;
revoke execute on function public.fetch_agent_public_assistiti(uuid) from anon;
revoke execute on function public.fetch_agent_relationship_states(uuid[]) from anon;
revoke execute on function public.fetch_media_profile_article_categories(uuid) from anon;
revoke execute on function public.fetch_public_fan_profile(uuid) from anon;
revoke execute on function public.fetch_society_master_profile(uuid) from anon;
revoke execute on function public.fetch_society_profile_editor(uuid) from anon;
revoke execute on function public.fetch_society_team_profile(uuid) from anon;
revoke execute on function public.get_profile_public_contacts(uuid) from anon;
revoke execute on function public.issue_agent_assistito_invite(uuid, boolean) from anon;
revoke execute on function public.mark_agent_assistito_invite_shared(uuid, text) from anon;
revoke execute on function public.request_agent_representation(uuid, text, text, text, date) from anon;
revoke execute on function public.respond_agent_assistito_invite(text, boolean) from anon;
revoke execute on function public.revoke_agent_assistito_invite(uuid) from anon;
revoke execute on function public.save_agent_career_entry(uuid, jsonb) from anon;
revoke execute on function public.save_agent_profile_details(uuid, jsonb, jsonb, jsonb) from anon;
revoke execute on function public.save_coach_career_details(uuid, jsonb, jsonb, jsonb, jsonb) from anon;
revoke execute on function public.save_society_profile_section(uuid, text, jsonb, timestamptz) from anon;
revoke execute on function public.save_staff_career_details(uuid, jsonb, jsonb, jsonb, jsonb) from anon;
revoke execute on function public.search_fan_favorite_clubs(text, integer) from anon;
revoke execute on function public.set_agent_featured_assistiti(uuid, uuid[]) from anon;
revoke execute on function public.update_agent_manual_assistito(uuid, text, text, public.player_position, text, date) from anon;
revoke execute on function public.update_agent_representation_terms(uuid, text, date) from anon;

-- Le altre quattro funzioni del dominio profilo gia' revocate sopra, nelle
-- rispettive sezioni, perche' sono anche quelle riscritte in questa
-- migrazione: resolve_agent_assistito_invite(text),
-- fetch_agent_assistiti_overview(uuid),
-- find_agent_manual_duplicates(text, public.player_position, text),
-- save_player_profile_details(uuid, jsonb, jsonb),
-- fetch_public_media_profile(uuid).
