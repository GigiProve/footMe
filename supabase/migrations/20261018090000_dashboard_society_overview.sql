-- ============================================================
-- DAS-REV-07 — Dashboard Società premium
--
-- DAS-REV-01/02 hanno costruito la Foundation (identità, capability, cache,
-- priorità) e con essa il minimo indispensabile della Società: riepilogo,
-- candidature, posizioni, contenuti. Questa migrazione completa il perimetro
-- che DAS-REV-07 chiede alla **panoramica operativa**:
--
--   §5/§19  lo **scope di squadra**. Il master 05 è «un amministratore
--           autorizzato su Primavera, non un nuovo ruolo tecnico
--           hardcodato». Finora `club_member_permissions` concedeva una
--           chiave su tutta la Società: un permesso limitato a una squadra
--           non era esprimibile, quindi «Ambito: Primavera» non poteva
--           esistere senza mentire. Qui diventa un dato.
--   §14     **Inviti e richieste**: conteggi reali, non derivati dal client
--           scaricando tutto l'organico.
--   §15     **Squadre del club**: preview e conteggio con le regole canoniche
--           (archiviate escluse), oggi assenti dal contratto.
--   §16     **Aree di gestione**: la riga Shortlist richiede di sapere se
--           l'actor ha quel permesso, che vive già in `shortlist_view`.
--
-- Non introduce tabelle, non duplica domini, non concede accessi: lo scope
-- **restringe**, `invites_view` è una chiave nuova che nessuno possiede
-- finché non viene concessa, e l'owner conserva l'accesso implicito.
--
-- Migrazione additiva e idempotente sul dato: una colonna nullable, due
-- indici unici che sostituivano una unique equivalente, funzioni ricreate.
-- Nessuna riga viene riscritta: tutti i grant esistenti restano `team_id
-- null`, cioè "tutta la Società", che è esattamente ciò che significavano.
--
-- Rollback: droppare `dashboard_club_scope`, `dashboard_club_capability_scope`
-- e `dashboard_club_scope_label`, ripristinare le definizioni di
-- 20261013090000 e 20261012090000, rimuovere la colonna `team_id` e la
-- chiave `invites_view` dal CHECK.
--
-- Convenzioni riusate:
--   20260717090000_club_member_permissions.sql  (grant table, drop+re-add CHECK)
--   20261012090000_dashboard_foundation.sql     (capability, identità)
--   20261013090000_dashboard_priority_states.sql (segnali, preview, metadata)
-- ============================================================


-- ============================================================
-- SEZIONE 1 — Chiave `invites_view`
--
-- `invites_create` esisteva già (l'azione rapida "Invita persona"), ma §14
-- chiede di **leggere** un riepilogo di inviti e richieste, e leggere non è
-- creare: un amministratore può vedere a che punto sono gli inviti
-- dell'organico senza poterne mandare di nuovi.
--
-- Convenzione del file originale: drop e re-add del CHECK con la lista
-- ampliata.
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
    -- gruppo Dashboard (DAS-REV-01) — invariato
    'dashboard_view',
    'positions_view',
    'positions_create',
    'applications_view',
    'teams_view',
    'content_view',
    'content_create',
    'invites_create',
    -- gruppo Dashboard (DAS-REV-07) — nuovo
    'invites_view'
  ));


-- ============================================================
-- SEZIONE 2 — Scope di squadra sui grant
--
-- `team_id null` = il grant vale su tutta la Società. È il significato che
-- **già avevano** tutte le righe esistenti, quindi nessun backfill: la
-- colonna nasce null e il comportamento non cambia di un millimetro.
--
-- La unique originale `(club_id, profile_id, permission_key)` non può
-- semplicemente accogliere `team_id`: in PostgreSQL i NULL sono distinti in
-- un indice unico, quindi `(club, profilo, chiave, null)` sarebbe
-- duplicabile e il grant societario perderebbe la sua unicità. Due indici
-- parziali tengono separate le due forme senza indebolire nessuna delle due.
-- ============================================================

alter table public.club_member_permissions
  add column if not exists team_id uuid references public.club_teams(id) on delete cascade;

-- La unique originale è dichiarata inline in 20260717090000, quindi il suo
-- nome è generato da PostgreSQL. Cercarla per **colonne** invece che per nome
-- evita che un database con un nome diverso resti con il vincolo vecchio: lì
-- un grant societario e uno di squadra per la stessa chiave non potrebbero
-- coesistere, e il perimetro più ampio non vincerebbe mai.
do $$
declare
  v_name text;
begin
  select con.conname into v_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'club_member_permissions'
    and con.contype = 'u'
    and (
      select array_agg(att.attname::text order by att.attname)
      from unnest(con.conkey) as k(attnum)
      join pg_attribute att
        on att.attrelid = con.conrelid
       and att.attnum = k.attnum
    ) = array['club_id', 'permission_key', 'profile_id']
  limit 1;

  if v_name is not null then
    execute format(
      'alter table public.club_member_permissions drop constraint %I',
      v_name
    );
  end if;
end;
$$;

create unique index if not exists club_member_permissions_society_grant_idx
  on public.club_member_permissions (club_id, profile_id, permission_key)
  where team_id is null;

create unique index if not exists club_member_permissions_team_grant_idx
  on public.club_member_permissions (club_id, profile_id, permission_key, team_id)
  where team_id is not null;

comment on column public.club_member_permissions.team_id is
  'DAS-REV-07 §19: squadra a cui il grant è limitato. null = tutta la '
  'Società. Un grant societario e un grant di squadra per la stessa chiave '
  'possono coesistere: prevale il più ampio.';


-- ============================================================
-- SEZIONE 3 — public.dashboard_club_capabilities (rimpiazzo)
--
-- Due chiavi in più nell'elenco letto: `invites_view` (sezione 1) e
-- `shortlist_view`, che esisteva già nel grant table ma non arrivava alla
-- Dashboard. §16 chiede di applicare i permessi a ogni riga di "Aree di
-- gestione", e la riga Shortlist si decide con quella chiave e non con una
-- regola nuova inventata qui.
--
-- La funzione resta **non scopata**: dice che cosa l'actor può fare, non su
-- quali squadre. Il perimetro è una domanda diversa e ha la sua funzione —
-- tenerle separate evita che un grant limitato alla Primavera si traveste da
-- assenza di capability.
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
      'invites_create',
      'invites_view',
      'shortlist_view'
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
            'invites_create',
            'invites_view',
            'shortlist_view'
          )
      ),
      array[]::text[]
    )
  end;
$$;

revoke all on function public.dashboard_club_capabilities(uuid) from public;
grant execute on function public.dashboard_club_capabilities(uuid) to authenticated;


-- ============================================================
-- SEZIONE 4 — Perimetro effettivo
--
-- Due funzioni, e la distinzione fra loro è il punto delicato di §19.
--
-- `dashboard_club_capability_scope(club, key)` è il perimetro **di una
-- singola capability**. Un membro può essere autorizzato alle candidature
-- della Primavera e alle squadre dell'Under 17: sommare i due perimetri in
-- uno solo gli mostrerebbe le candidature dell'Under 17, che nessuno gli ha
-- concesso. §19 lo vieta in due righe diverse — «Non unire arbitrariamente
-- permessi ricavati dalle etichette dei ruoli» e «usare il perimetro
-- effettivo calcolato dal permission domain». Quindi ogni aggregato
-- interroga la propria chiave.
--
-- `dashboard_club_scope(club)` è l'unione dei perimetri, e serve a una cosa
-- sola: l'etichetta «Ambito: …» di §5, che descrive dove l'actor sta
-- operando nel suo complesso. Non viene mai usata per filtrare un dato.
--
-- In entrambe `null` significa **nessuna restrizione**, non "nessuna
-- squadra". Un array vuoto non viene restituito: un membro senza quel grant
-- riceve comunque `null` dal chiamante, perché è la capability a mancare, e
-- confondere "non autorizzato" con "perimetro vuoto" produrrebbe uno zero al
-- posto di un'assenza.
-- ============================================================

create or replace function public.dashboard_club_capability_scope(
  p_club_id uuid,
  p_key text
)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_teams uuid[];
begin
  if public.owns_club(p_club_id) then
    return null;
  end if;

  -- Un grant societario per **questa** chiave: perimetro illimitato per
  -- questa chiave. Prevale il più ampio, non la somma.
  if exists (
    select 1
    from public.club_member_permissions perm
    join public.club_members cm
      on cm.club_id = perm.club_id
      and cm.profile_id = perm.profile_id
    where perm.club_id = p_club_id
      and perm.profile_id = auth.uid()
      and cm.status = 'active'
      and perm.team_id is null
      and perm.permission_key = p_key
  ) then
    return null;
  end if;

  select array_agg(distinct perm.team_id)
    into v_teams
  from public.club_member_permissions perm
  join public.club_members cm
    on cm.club_id = perm.club_id
    and cm.profile_id = perm.profile_id
  join public.club_teams ct
    on ct.id = perm.team_id
    and ct.club_id = perm.club_id
  where perm.club_id = p_club_id
    and perm.profile_id = auth.uid()
    and cm.status = 'active'
    and perm.team_id is not null
    and perm.permission_key = p_key;

  -- Nessun grant per questa chiave: array vuoto, non `null`. `null` sarebbe
  -- "illimitato" e trasformerebbe un permesso assente in accesso totale.
  return coalesce(v_teams, array[]::uuid[]);
end;
$$;

revoke all on function public.dashboard_club_capability_scope(uuid, text) from public;
grant execute on function public.dashboard_club_capability_scope(uuid, text) to authenticated;

comment on function public.dashboard_club_capability_scope(uuid, text) is
  'DAS-REV-07 §19: squadre su cui vale una singola capability. null = nessuna '
  'restrizione; array vuoto = capability non concessa. Ogni aggregato usa la '
  'propria chiave: i perimetri non si sommano fra capability diverse.';


create or replace function public.dashboard_club_scope(p_club_id uuid)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dashboard_keys text[] := array[
    'dashboard_view',
    'positions_view',
    'positions_create',
    'applications_view',
    'teams_view',
    'content_view',
    'content_create',
    'invites_create',
    'invites_view'
  ];
  v_teams uuid[];
begin
  if public.owns_club(p_club_id) then
    return null;
  end if;

  if exists (
    select 1
    from public.club_member_permissions perm
    join public.club_members cm
      on cm.club_id = perm.club_id
      and cm.profile_id = perm.profile_id
    where perm.club_id = p_club_id
      and perm.profile_id = auth.uid()
      and cm.status = 'active'
      and perm.team_id is null
      and perm.permission_key = any (v_dashboard_keys)
  ) then
    return null;
  end if;

  select array_agg(distinct perm.team_id)
    into v_teams
  from public.club_member_permissions perm
  join public.club_members cm
    on cm.club_id = perm.club_id
    and cm.profile_id = perm.profile_id
  join public.club_teams ct
    on ct.id = perm.team_id
    and ct.club_id = perm.club_id
  where perm.club_id = p_club_id
    and perm.profile_id = auth.uid()
    and cm.status = 'active'
    and perm.team_id is not null
    and perm.permission_key = any (v_dashboard_keys);

  return v_teams;
end;
$$;

revoke all on function public.dashboard_club_scope(uuid) from public;
grant execute on function public.dashboard_club_scope(uuid) to authenticated;

comment on function public.dashboard_club_scope(uuid) is
  'DAS-REV-07 §5: unione dei perimetri dell''actor su questa Società, per la '
  'sola etichetta "Ambito". Non filtra dati: per quello serve '
  'dashboard_club_capability_scope, che non somma capability diverse.';


-- ============================================================
-- SEZIONE 5 — public.dashboard_club_scope_label
--
-- L'etichetta leggibile di §5: «Ambito: Primavera», distinta dal nome della
-- Società e mai fusa con esso.
--
-- Con più squadre autorizzate §5 chiede «il riepilogo previsto dal modello,
-- senza creare un nuovo selector di scope»: il numero, non l'elenco. Tre
-- nomi su una riga a 320pt troncherebbero, e un elenco espandibile sarebbe
-- il selector che la task vieta.
-- ============================================================

create or replace function public.dashboard_club_scope_label(p_club_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope uuid[] := public.dashboard_club_scope(p_club_id);
  v_count integer;
  v_name  text;
begin
  if v_scope is null then
    return null;
  end if;

  v_count := coalesce(array_length(v_scope, 1), 0);

  if v_count = 0 then
    return null;
  end if;

  if v_count = 1 then
    select ct.name into v_name
    from public.club_teams ct
    where ct.id = v_scope[1];

    return v_name;
  end if;

  return v_count::text || ' squadre';
end;
$$;

revoke all on function public.dashboard_club_scope_label(uuid) from public;
grant execute on function public.dashboard_club_scope_label(uuid) to authenticated;


-- ============================================================
-- SEZIONE 6 — public.fetch_dashboard_identities (rimpiazzo)
--
-- Una colonna in più: `scope_label`. §5 la vuole nella riga identità, e §15
-- di DAS-REV-01 vieta al client di dedurre l'autorizzazione dal contenuto di
-- un elenco — quindi l'etichetta arriva dal server insieme alle capability,
-- non viene ricostruita guardando quali squadre compaiono nelle preview.
--
-- Il resto è identico a 20261012090000: stesse fonti, stesso ordine
-- deterministico, nessuna identità nuova. Una squadra continua a non essere
-- una Dashboard Identity (§5).
-- ============================================================

drop function if exists public.fetch_dashboard_identities();

create function public.fetch_dashboard_identities()
returns table (
  identity_id    uuid,
  identity_kind  text,
  name           text,
  avatar_url     text,
  is_verified    boolean,
  is_owner       boolean,
  capabilities   text[],
  scope_label    text,
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
      null::text                                      as scope_label,
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
      public.dashboard_club_scope_label(c.id)         as scope_label,
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
-- SEZIONE 7 — public.fetch_dashboard_society_overview (rimpiazzo)
--
-- Tre gruppi di modifiche. La firma cambia, quindi `drop` esplicito.
--
-- 1. **Scope** (§19). Ogni aggregato, ogni segnale e ogni preview passa dal
--    perimetro effettivo. §19 è esplicito: «Non restituire totali dell'intero
--    club per poi filtrare soltanto le righe». Il filtro è qui, prima del
--    conteggio, e vale anche per le priorità: un amministratore della
--    Primavera non riceve il segnale "5 nuove candidature" di una Posizione
--    della Prima squadra.
--
--    I contenuti editoriali fanno eccezione per sottrazione: `club_media_posts`
--    non ha `team_id`, un contenuto appartiene alla Società e basta. Con un
--    perimetro ristretto le metriche editoriali diventano quindi `null` —
--    non autorizzate — invece di mostrare a un amministratore di squadra le
--    bozze dell'intera Società.
--
-- 2. **Inviti** (§14). `invites_pending_count` conta le assegnazioni
--    all'organico ancora in attesa di conferma: `club_members.status =
--    'pending'`, cioè gli inviti in **uscita** che il dominio conosce
--    davvero.
--
--    `invites_incoming_count` resta **null**, e non è una svista: §14
--    distingue le richieste ricevute dagli inviti in attesa, e nel dominio
--    attuale le richieste in ingresso non esistono come stato — l'unico
--    scrittore di `added_by = 'self_request'` (`requestClubMembership`)
--    inserisce `status = 'active'`, cioè un ingresso già avvenuto, e non è
--    chiamato da nessuna schermata. Restituire 0 direbbe «nessuna richiesta
--    da gestire» su un dominio che non le modella; §14 prescrive invece di
--    omettere l'aggregato non consultabile.
--
--    I `club_invite_links` **non** entrano nel conteggio: §14 è esplicito —
--    «Un link riutilizzabile non equivale automaticamente a un invito per
--    ogni apertura». Un link è un token, non un invito a una persona.
--
-- 3. **Squadre** (§15). `teams_preview` affianca `teams_count`, che ora
--    esclude le archiviate: §15 vieta di contare «stagioni storiche come
--    squadre correnti» e chiede di riusare le regole canoniche. Il conteggio
--    è quello del centro di destinazione, non quello pubblico del profilo —
--    una squadra non pubblica resta visibile a chi la amministra.
-- ============================================================

drop function if exists public.fetch_dashboard_society_overview(uuid);

create function public.fetch_dashboard_society_overview(p_club_id uuid)
returns table (
  -- ── Riepilogo e conteggi ────────────────────────────────────────────
  positions_open_count          integer,
  applications_count            integer,
  teams_count                   integer,
  drafts_count                  integer,
  scheduled_count               integer,

  -- ── Inviti e richieste (§14) ────────────────────────────────────────
  invites_incoming_count        integer,
  invites_pending_count         integer,

  -- ── Conteggio canonico "da gestire" (§10) ───────────────────────────
  applications_to_handle_count  integer,

  -- ── Segnali operativi normalizzati ──────────────────────────────────
  priority_signals              jsonb,
  priority_total_count          integer,

  -- ── Preview ─────────────────────────────────────────────────────────
  applications_preview          jsonb,
  teams_preview                 jsonb,
  drafts_preview                jsonb,
  recent_content_preview        jsonb,

  -- ── Metadata di cache e accesso ─────────────────────────────────────
  access_verified_at            timestamptz,
  data_revision                 bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid   := auth.uid();
  v_caps    text[];
  -- Un perimetro **per capability** (§19). Le coppie `_all` esistono perché
  -- «scope null = illimitato» è la regola più facile da invertire per
  -- sbaglio: scritta una volta, riusata in ogni predicato.
  v_pos_scope  uuid[];
  v_pos_all    boolean;
  v_app_scope  uuid[];
  v_app_all    boolean;
  v_team_scope uuid[];
  v_team_all   boolean;
  v_inv_scope  uuid[];
  v_inv_all    boolean;
  -- I contenuti non hanno squadra: `club_media_posts` appartiene alla
  -- Società. Le metriche editoriali esistono quindi solo per chi ha
  -- `content_view` senza restrizione di squadra.
  v_content_all boolean;
  v_now     timestamptz := timezone('utc', now());
  v_signals jsonb  := '[]'::jsonb;
  v_total   integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  v_pos_scope  := public.dashboard_club_capability_scope(p_club_id, 'positions_view');
  v_pos_all    := v_pos_scope is null;
  v_app_scope  := public.dashboard_club_capability_scope(p_club_id, 'applications_view');
  v_app_all    := v_app_scope is null;
  v_team_scope := public.dashboard_club_capability_scope(p_club_id, 'teams_view');
  v_team_all   := v_team_scope is null;
  v_inv_scope  := public.dashboard_club_capability_scope(p_club_id, 'invites_view');
  v_inv_all    := v_inv_scope is null;
  v_content_all := public.dashboard_club_capability_scope(p_club_id, 'content_view') is null;

  if not ('dashboard_view' = any (v_caps)) then
    return query select
      null::integer, null::integer, null::integer, null::integer, null::integer,
      null::integer, null::integer,
      null::integer,
      null::jsonb, null::integer,
      null::jsonb, null::jsonb, null::jsonb, null::jsonb,
      null::timestamptz, null::bigint;
    return;
  end if;

  -- ── Segnali `new_applications` ────────────────────────────────────────
  if 'applications_view' = any (v_caps) then
    select coalesce(jsonb_agg(signal order by signal->>'occurred_at' desc), '[]'::jsonb)
      into v_signals
    from (
      select jsonb_build_object(
        'type_id',         'new_applications',
        'aggregation_key', 'new_applications:' || p_club_id::text || ':' || ra.id::text,
        'target_kind',     'position',
        'target_id',       ra.id,
        'count',           count(app.id)::integer,
        'role',            ra.role_required::text,
        'team_name',       ct.name,
        'deadline_at',     ra.deadline,
        'occurred_at',     max(app.created_at)
      ) as signal
      from public.recruiting_ads ra
      join public.recruiting_applications app
        on app.ad_id = ra.id
       and app.status = 'submitted'
      left join public.club_teams ct on ct.id = ra.team_id
      where ra.club_id = p_club_id
        and ra.status = 'published'
        and (v_app_all or ra.team_id = any (v_app_scope))
      group by ra.id, ra.role_required, ra.deadline, ct.name
      order by max(app.created_at) desc
      limit 10
    ) signals;

    select count(*)::integer into v_total
    from (
      select ra.id
      from public.recruiting_ads ra
      join public.recruiting_applications app
        on app.ad_id = ra.id
       and app.status = 'submitted'
      where ra.club_id = p_club_id
        and ra.status = 'published'
        and (v_app_all or ra.team_id = any (v_app_scope))
      group by ra.id
    ) totals;
  end if;

  return query
  select
    case when 'positions_view' = any (v_caps) then (
      select count(*)::integer
      from public.recruiting_ads ra
      where ra.club_id = p_club_id
        and ra.status = 'published'
        and (v_pos_all or ra.team_id = any (v_pos_scope))
    ) end as positions_open_count,

    case when 'applications_view' = any (v_caps) then (
      select count(*)::integer
      from public.recruiting_applications app
      join public.recruiting_ads ra on ra.id = app.ad_id
      where ra.club_id = p_club_id
        and app.status <> 'withdrawn'
        and (v_app_all or ra.team_id = any (v_app_scope))
    ) end as applications_count,

    -- §15: archiviate escluse. Le affiliate non compaiono perché la fonte è
    -- `club_teams`, non `club_affiliations`: una Società collegata non è una
    -- squadra di questa Società.
    case when 'teams_view' = any (v_caps) then (
      select count(*)::integer
      from public.club_teams ct
      where ct.club_id = p_club_id
        and not ct.is_archived
        and (v_team_all or ct.id = any (v_team_scope))
    ) end as teams_count,

    case when 'content_view' = any (v_caps) and v_content_all then (
      select count(*)::integer
      from public.club_media_posts cmp
      where cmp.club_id = p_club_id
        and cmp.status = 'draft'
    ) end as drafts_count,

    -- Contratto predisposto, dominio non ancora capace di programmare:
    -- `club_media_posts.status` ammette draft/published/archived.
    null::integer as scheduled_count,

    -- §14: le richieste in ingresso non esistono nel dominio. null, non 0.
    null::integer as invites_incoming_count,

    case when 'invites_view' = any (v_caps) then (
      select count(*)::integer
      from public.club_members cm
      where cm.club_id = p_club_id
        and cm.status = 'pending'
        and cm.profile_id is not null
        and (v_inv_all or cm.team_id = any (v_inv_scope))
    ) end as invites_pending_count,

    case when 'applications_view' = any (v_caps) then (
      select count(*)::integer
      from public.recruiting_applications app
      join public.recruiting_ads ra on ra.id = app.ad_id
      where ra.club_id = p_club_id
        and app.status = 'submitted'
        and (v_app_all or ra.team_id = any (v_app_scope))
    ) end as applications_to_handle_count,

    case when 'applications_view' = any (v_caps) then v_signals end
      as priority_signals,
    case when 'applications_view' = any (v_caps) then v_total end
      as priority_total_count,

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
          'team_name',  ct.name,
          'name',       coalesce(nullif(trim(p.full_name), ''), 'Candidato'),
          'avatar_url', p.avatar_url
        ) as item
        from public.recruiting_applications app
        join public.recruiting_ads ra on ra.id = app.ad_id
        join public.profiles p on p.id = app.applicant_profile_id
        left join public.club_teams ct on ct.id = ra.team_id
        where ra.club_id = p_club_id
          and app.status <> 'withdrawn'
          and (v_app_all or ra.team_id = any (v_app_scope))
        order by app.created_at desc
        limit 3
      ) preview
    ) end as applications_preview,

    -- §15: ordinamento sportivo stabile — prima squadra, poi settore
    -- giovanile secondo `sort_order`. Nessun conteggio di giocatori o staff
    -- nel payload: un campo restituito è un campo che prima o poi qualcuno
    -- disegna, e §15 lo vieta.
    case when 'teams_view' = any (v_caps) then (
      select coalesce(jsonb_agg(item order by item->>'rank', item->>'name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',       ct.id,
          'name',     ct.name,
          'category', ct.category,
          'logo_url', ct.logo_url,
          'rank',     lpad((
            case when ct.team_type = 'senior' then 0 else 1 end * 100000
            + greatest(0, least(ct.sort_order, 99999))
          )::text, 6, '0')
        ) as item
        from public.club_teams ct
        where ct.club_id = p_club_id
          and not ct.is_archived
          and (v_team_all or ct.id = any (v_team_scope))
        order by
          case when ct.team_type = 'senior' then 0 else 1 end,
          ct.sort_order,
          ct.name
        limit 3
      ) preview
    ) end as teams_preview,

    case when 'content_view' = any (v_caps) and v_content_all then (
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

    case when 'content_view' = any (v_caps) and v_content_all then (
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
          and cmp.published_at <= v_now
        order by cmp.published_at desc
        limit 3
      ) preview
    ) end as recent_content_preview,

    v_now as access_verified_at,
    (extract(epoch from v_now) * 1000)::bigint as data_revision;
end;
$$;

revoke all on function public.fetch_dashboard_society_overview(uuid) from public;
grant execute on function public.fetch_dashboard_society_overview(uuid) to authenticated;

comment on function public.fetch_dashboard_society_overview(uuid) is
  'DAS-REV-07: riepilogo, segnali, inviti, squadre, preview e metadata di '
  'una Società, filtrati per capability e per scope di squadra. Ogni colonna '
  'null significa "non autorizzato", non "zero".';


-- ============================================================
-- SEZIONE 8 — public.fetch_dashboard_society_positions (rimpiazzo)
--
-- Stesso provider indipendente di DAS-REV-02, con il perimetro di §19. Il
-- filtro è identico a quello del conteggio nel riepilogo: una preview che
-- mostrasse una Posizione fuori scope contraddirebbe il proprio totale.
-- ============================================================

create or replace function public.fetch_dashboard_society_positions(p_club_id uuid)
returns table (
  id          uuid,
  role        text,
  team_name   text,
  category    text,
  created_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caps  text[];
  v_scope uuid[];
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_caps  := public.dashboard_club_capabilities(p_club_id);
  v_scope := public.dashboard_club_capability_scope(p_club_id, 'positions_view');

  if not ('positions_view' = any (v_caps)) then
    return;
  end if;

  return query
  select
    ra.id,
    ra.role_required::text as role,
    ct.name                as team_name,
    coalesce(ct.category, ra.category) as category,
    ra.created_at
  from public.recruiting_ads ra
  left join public.club_teams ct on ct.id = ra.team_id
  where ra.club_id = p_club_id
    and ra.status = 'published'
    and (v_scope is null or ra.team_id = any (v_scope))
  order by ra.created_at desc
  limit 3;
end;
$$;

revoke all on function public.fetch_dashboard_society_positions(uuid) from public;
grant execute on function public.fetch_dashboard_society_positions(uuid) to authenticated;
