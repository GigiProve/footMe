-- ============================================================
-- DAS-REV-01 — Foundation Dashboard: identità, capability e scope
--
-- La Dashboard oggi sceglie la schermata con `profile.role === 'club_admin'`
-- nel client. Questa migrazione sposta nel database le tre domande che la
-- Foundation deve poter fare senza fidarsi del client:
--
--   1. quali Dashboard Identity può aprire l'actor autenticato;
--   2. che cosa può fare su ciascuna di esse (capability + scope);
--   3. quali conteggi può vedere — perché un totale è già un dato
--      (DAS-REV-01 §14: è vietato restituire "27 candidature" a chi non può
--      accedere al recruiting e nasconderle solo nel rendering).
--
-- Nessuna tabella nuova. Il modello di grant esiste già
-- (20260717090000_club_member_permissions.sql) e viene esteso con il gruppo
-- `dashboard_*` seguendo la convenzione dichiarata in quel file: drop e
-- re-add del CHECK con la lista ampliata.
--
-- Migrazione non distruttiva: nessuna riga cancellata, spostata o riscritta;
-- nessun permesso concesso a chi non lo aveva. L'owner conserva l'accesso
-- implicito via owns_club(), esattamente come prima.
--
-- Rollback: drop delle tre funzioni introdotte qui e re-add del CHECK con la
-- sola lista `shortlist_*`. Nessun dato da ripristinare.
--
-- Convenzioni riusate:
--   20260309000001_rls_policies.sql          (owns_club / is_current_user)
--   20260717090000_club_member_permissions.sql (grant table, has_club_permission)
--   20260717090200_shortlist_rpcs.sql          (stile RPC security definer)
-- ============================================================


-- ============================================================
-- SEZIONE 1 — Gruppo di permessi `dashboard_*`
--
-- Le chiavi sono volutamente poche e per dominio, non per schermata: la
-- composizione è guidata da capability, non da una pagina per ruolo.
--
--   dashboard_view      accesso alla Dashboard della Società. Senza questa
--                       chiave l'identità non è eleggibile e non compare
--                       nel selector — non compare "bloccata" (§9).
--   positions_view      lettura delle Posizioni aperte e dei loro conteggi.
--   positions_create    creazione di una Posizione (azione rapida).
--   applications_view   lettura delle Candidature ricevute.
--   teams_view          accesso al centro operativo Squadre del club.
--   content_view        lettura di bozze e contenuti pubblicati della Società.
--   content_create      creazione di contenuti editoriali della Società.
--   invites_create      invio di inviti (azione rapida).
--
-- La lettura e l'azione sono chiavi distinte: §14 richiede che chi può
-- vedere le Posizioni ma non crearle non veda "Nuova posizione".
-- ============================================================

alter table public.club_member_permissions
  drop constraint if exists club_member_permissions_key_check;

alter table public.club_member_permissions
  add constraint club_member_permissions_key_check
  check (permission_key in (
    -- gruppo Shortlist (20260717090000) — invariato
    'shortlist_view',
    'shortlist_create_lists',
    'shortlist_add_profiles',
    'shortlist_add_notes',
    'shortlist_edit_status',
    'shortlist_remove_profiles',
    -- gruppo notifiche club (20260719090300) — invariato
    'notif_new_applications',
    'notif_shortlist_updates',
    'notif_connection_requests',
    'notif_store_orders',
    'notif_content_tags',
    'notif_affiliations',
    'notif_profile_verifications',
    -- gruppo Dashboard (DAS-REV-01) — nuovo
    'dashboard_view',
    'positions_view',
    'positions_create',
    'applications_view',
    'teams_view',
    'content_view',
    'content_create',
    'invites_create'
  ));


-- ============================================================
-- SEZIONE 2 — public.dashboard_club_capabilities
--
-- Capability effettive dell'actor su una Società, come array.
--
-- Due rami, come fetch_my_shortlist_permissions:
--   · owner  → tutte le chiavi del gruppo dashboard;
--   · member → le sole chiavi concesse, se la membership è ancora `active`.
--
-- Legare il grant a club_members.status = 'active' significa che rimuovere
-- un membro revoca l'accesso senza dover ripulire i grant: è la stessa
-- garanzia su cui si appoggia has_club_permission.
--
-- Array vuoto = nessun accesso. Il chiamante non deve distinguere fra
-- "Società inesistente" e "Società non amministrabile": in entrambi i casi
-- l'identità semplicemente non esiste per questo actor.
-- ============================================================

create or replace function public.dashboard_club_capabilities(p_club_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.owns_club(p_club_id) then array[
      'dashboard_view',
      'positions_view',
      'positions_create',
      'applications_view',
      'teams_view',
      'content_view',
      'content_create',
      'invites_create'
    ]::text[]
    else coalesce(
      (
        select array_agg(distinct perm.permission_key order by perm.permission_key)
        from public.club_member_permissions perm
        join public.club_members cm
          on cm.club_id = perm.club_id
          and cm.profile_id = perm.profile_id
        where perm.club_id = p_club_id
          and perm.profile_id = auth.uid()
          and cm.status = 'active'
          and perm.permission_key in (
            'dashboard_view',
            'positions_view',
            'positions_create',
            'applications_view',
            'teams_view',
            'content_view',
            'content_create',
            'invites_create'
          )
      ),
      array[]::text[]
    )
  end;
$$;

revoke all on function public.dashboard_club_capabilities(uuid) from public;
grant execute on function public.dashboard_club_capabilities(uuid) to authenticated;


-- ============================================================
-- SEZIONE 3 — public.fetch_dashboard_identities
--
-- L'elenco delle Dashboard che l'actor autenticato può aprire.
--
-- §10 — da dove NON derivano gli accessi: Follow, rapporti sportivi,
-- affiliazioni. Qui compaiono soltanto:
--   · l'identità personale dell'actor (PERSON, oppure MEDIA se il profilo è
--     di tipo `media`: in questo prodotto il Media/Creator È un profilo
--     personale con entity_name e logo propri, quindi il tipo canonico del
--     profilo determina il kind, senza creare una seconda identità);
--   · le Società di cui l'actor è owner;
--   · le Società in cui l'actor è membro attivo con almeno un grant del
--     gruppo dashboard.
--
-- club_affiliations non è interrogata: un'affiliata resta una Società
-- autonoma e l'ownership non si trasferisce (§10, DAS-03.3.3).
--
-- Ordine stabile e deterministico (§9): personale, Società, Media; dentro il
-- tipo per nome e, a parità, per id. L'identità selezionata NON viene
-- spostata in cima: l'ordine non dipende dallo stato del client.
--
-- `capabilities` è vuoto per l'identità personale: le risorse personali sono
-- già protette dalla RLS dell'actor su se stesso, e introdurre capability
-- fittizie darebbe l'impressione di un controllo che non esiste.
-- ============================================================

drop function if exists public.fetch_dashboard_identities();

create or replace function public.fetch_dashboard_identities()
returns table (
  identity_id    uuid,
  identity_kind  text,
  name           text,
  avatar_url     text,
  is_verified    boolean,
  is_owner       boolean,
  capabilities   text[],
  sort_rank      integer
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
  select *
  from (

    -- ── identità personale dell'actor ──────────────────────────────
    select
      p.id                                            as identity_id,
      case when p.role = 'media' then 'media' else 'person' end as identity_kind,
      coalesce(
        nullif(trim(mp.entity_name), ''),
        nullif(trim(p.full_name), ''),
        'Dashboard'
      )                                               as name,
      coalesce(mp.logo_url, p.avatar_url)             as avatar_url,
      case
        when p.role <> 'media' then false
        else exists (
          select 1
          from public.media_profile_verifications mv
          where mv.media_profile_id = p.id
            and mv.verification_type = 'profile_verified'
            and mv.status = 'verified'
        )
      end                                             as is_verified,
      true                                            as is_owner,
      array[]::text[]                                 as capabilities,
      case when p.role = 'media' then 2 else 0 end    as sort_rank
    from public.profiles p
    left join public.media_profiles mp
      on mp.profile_id = p.id
      and p.role = 'media'
    where p.id = v_uid

    union all

    -- ── Società amministrabili ─────────────────────────────────────
    select
      c.id                                            as identity_id,
      'society'                                       as identity_kind,
      c.name                                          as name,
      c.logo_url                                      as avatar_url,
      (c.verification_status = 'verified')            as is_verified,
      (c.owner_profile_id = v_uid)                    as is_owner,
      caps.capabilities                               as capabilities,
      1                                               as sort_rank
    from public.clubs c
    cross join lateral (
      select public.dashboard_club_capabilities(c.id) as capabilities
    ) caps
    where array_length(caps.capabilities, 1) > 0

  ) identities
  order by identities.sort_rank, identities.name, identities.identity_id;
end;
$$;

revoke all on function public.fetch_dashboard_identities() from public;
grant execute on function public.fetch_dashboard_identities() to authenticated;


-- ============================================================
-- SEZIONE 4 — public.fetch_dashboard_society_overview
--
-- Riepilogo, priorità e conteggi di una Società, filtrati server-side.
--
-- §14 e DoD #11: un conteggio è un dato. Ogni colonna qui sotto è `null`
-- quando la capability corrispondente manca — non zero, che significherebbe
-- "nessuna attività", e non un numero reale nascosto poi dal client.
--
-- `priority_*` descrive l'unica priorità che la Foundation sa calcolare oggi
-- in modo deterministico: le candidature ancora in stato `submitted` sulla
-- Posizione che ne ha di più. §17 chiede esattamente questo e vieta di
-- attribuire a una singola Position un conteggio globale.
--
-- NON calcolate qui, perché il dominio non le supporta ancora:
--   · contenuti programmati  — club_media_posts.status non ha 'scheduled';
--   · pubblicazioni fallite  — club_media_posts.status non ha 'failed'.
-- I rispettivi pack le introdurranno. La Foundation espone il contratto
-- (colonne presenti, valore null) senza simulare il dato.
-- ============================================================

drop function if exists public.fetch_dashboard_society_overview(uuid);

create or replace function public.fetch_dashboard_society_overview(p_club_id uuid)
returns table (
  positions_open_count      integer,
  applications_count         integer,
  teams_count                integer,
  drafts_count               integer,
  scheduled_count            integer,
  priority_ad_id             uuid,
  priority_ad_title          text,
  priority_new_applications  integer,
  applications_preview       jsonb,
  drafts_preview             jsonb,
  recent_content_preview     jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid    := auth.uid();
  v_caps      text[];
  v_prio_id   uuid;
  v_prio_name text;
  v_prio_new  integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  -- Nessun accesso alla Dashboard di questa Società: nessun conteggio.
  -- Non si distingue da "Società inesistente", per non rivelare metadati.
  if not ('dashboard_view' = any (v_caps)) then
    return query select
      null::integer, null::integer, null::integer, null::integer,
      null::integer, null::uuid, null::text, null::integer,
      null::jsonb, null::jsonb, null::jsonb;
    return;
  end if;

  -- Priorità "Da gestire": la Posizione pubblicata con più candidature
  -- ancora in stato `submitted`. Ordinamento deterministico — a parità di
  -- conteggio vince la Posizione più recente, poi l'id — così la stessa
  -- situazione produce sempre la stessa priorità (§21: ordine base stabile).
  if 'applications_view' = any (v_caps) then
    select ra.id, ra.title, count(app.id)::integer
      into v_prio_id, v_prio_name, v_prio_new
    from public.recruiting_ads ra
    join public.recruiting_applications app
      on app.ad_id = ra.id
     and app.status = 'submitted'
    where ra.club_id = p_club_id
      and ra.status = 'published'
    group by ra.id, ra.title, ra.created_at
    order by count(app.id) desc, ra.created_at desc, ra.id
    limit 1;
  end if;

  return query
  select
    case when 'positions_view' = any (v_caps) then (
      select count(*)::integer
      from public.recruiting_ads ra
      where ra.club_id = p_club_id
        and ra.status = 'published'
    ) end as positions_open_count,

    case when 'applications_view' = any (v_caps) then (
      select count(*)::integer
      from public.recruiting_applications app
      join public.recruiting_ads ra on ra.id = app.ad_id
      where ra.club_id = p_club_id
        and app.status <> 'withdrawn'
    ) end as applications_count,

    case when 'teams_view' = any (v_caps) then (
      select count(*)::integer
      from public.club_teams ct
      where ct.club_id = p_club_id
    ) end as teams_count,

    case when 'content_view' = any (v_caps) then (
      select count(*)::integer
      from public.club_media_posts cmp
      where cmp.club_id = p_club_id
        and cmp.status = 'draft'
    ) end as drafts_count,

    -- Contratto predisposto, dominio non ancora capace di programmare:
    -- resta null finché il pack editoriale non introduce lo stato.
    null::integer as scheduled_count,

    v_prio_id   as priority_ad_id,
    v_prio_name as priority_ad_title,
    v_prio_new  as priority_new_applications,

    -- ── Preview: stessa query dei conteggi, stessa autorizzazione ──────
    -- §20 chiede che riepilogo e preview non possano contraddirsi. Le righe
    -- arrivano da qui e non da una select del client perché la policy di
    -- recruiting_applications è owner-only: un membro con grant avrebbe
    -- conteggi pieni e lista vuota. La policy esistente NON viene allargata
    -- (§22) — questa è una lettura nuova, proiettata sui soli campi della
    -- preview e sbarrata dalla stessa capability del conteggio.
    case when 'applications_view' = any (v_caps) then (
      select coalesce(jsonb_agg(item order by item->>'created_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',         app.id,
          'created_at', app.created_at,
          'status',     app.status,
          'ad_id',      ra.id,
          'ad_title',   ra.title,
          'role',       ra.role_required,
          'name',       coalesce(nullif(trim(p.full_name), ''), 'Candidato'),
          'avatar_url', p.avatar_url
        ) as item
        from public.recruiting_applications app
        join public.recruiting_ads ra on ra.id = app.ad_id
        join public.profiles p on p.id = app.applicant_profile_id
        where ra.club_id = p_club_id
          and app.status <> 'withdrawn'
        order by app.created_at desc
        limit 3
      ) preview
    ) end as applications_preview,

    case when 'content_view' = any (v_caps) then (
      select coalesce(jsonb_agg(item order by item->>'updated_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',            cmp.id,
          'title',         cmp.title,
          'kind',          cmp.kind,
          'status',        cmp.status,
          'thumbnail_url', coalesce(cmp.thumbnail_url, cmp.visual_url),
          'updated_at',    cmp.updated_at
        ) as item
        from public.club_media_posts cmp
        where cmp.club_id = p_club_id
          and cmp.status = 'draft'
        order by cmp.updated_at desc
        limit 3
      ) preview
    ) end as drafts_preview,

    case when 'content_view' = any (v_caps) then (
      select coalesce(jsonb_agg(item order by item->>'published_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',            cmp.id,
          'title',         cmp.title,
          'kind',          cmp.kind,
          'status',        cmp.status,
          'thumbnail_url', coalesce(cmp.thumbnail_url, cmp.visual_url),
          'published_at',  cmp.published_at
        ) as item
        from public.club_media_posts cmp
        where cmp.club_id = p_club_id
          and cmp.status = 'published'
          and cmp.published_at <= timezone('utc', now())
        order by cmp.published_at desc
        limit 3
      ) preview
    ) end as recent_content_preview;
end;
$$;

revoke all on function public.fetch_dashboard_society_overview(uuid) from public;
grant execute on function public.fetch_dashboard_society_overview(uuid) to authenticated;


comment on function public.fetch_dashboard_identities() is
  'DAS-REV-01: Dashboard Identity eleggibili per l''actor autenticato. '
  'Non deriva da Follow, rapporti sportivi o affiliazioni.';

comment on function public.fetch_dashboard_society_overview(uuid) is
  'DAS-REV-01: riepilogo e priorità di una Società con conteggi filtrati per '
  'capability. Una colonna null significa "non autorizzato", non "zero".';
