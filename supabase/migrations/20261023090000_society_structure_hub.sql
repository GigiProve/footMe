-- ============================================================
-- DAS-REV-12 — Hub Struttura societaria
--
-- L'hub non possiede dati: riunisce quattro domini che hanno già una fonte
-- canonica ciascuno. Per questo la migrazione aggiunge **una sola** funzione
-- di lettura, e non un endpoint che ricalcoli ciò che i centri sanno già:
--
--   · squadre attive          → `fetch_teams_center` (DAS-REV-08)
--   · relazioni e richieste   → `fetch_society_network` (DAS-REV-11)
--   · stagione corrente/prox. → `fetch_seasons_center` (DAS-REV-10)
--
-- §15: «Non imporre un secondo endpoint che duplichi integralmente dati già
-- ottenuti dalla Foundation» e «Mantieni la semantica delle metriche in un
-- solo livello condiviso. Hub e centri devono riutilizzarla.» Riusare quei
-- provider è anche ciò che rende possibile lo screen 06: tre provider sono
-- tre stati di errore indipendenti, un aggregato unico sarebbe uno solo.
--
-- Qui restano le sole parti che **nessun** centro espone:
--
--   1. eligibility e composizione dei domini (§7, §16);
--   2. conteggi amministrativi (§11) — accessi attivi e inviti amministrativi;
--   3. dati master minimi della Società (§12);
--   4. segnali strutturali "Da gestire" (§13), già filtrati, ordinati e
--      limitati server-side.
--
-- Ogni conteggio è `null` quando la lettura non è autorizzata. §15: «Dato
-- assente per permission, dato non caricato e dato fallito non devono essere
-- serializzati indistintamente come zero.»
-- ============================================================


-- ============================================================
-- SEZIONE 1 — public.society_structure_admin_ids (§11)
--
-- Gli **accessi amministrativi attivi** della Società, come insieme di
-- profili distinti.
--
-- Il criterio è quello canonico con cui la Foundation decide chi può aprire
-- la Dashboard della Società (`dashboard_club_capabilities`), non la rosa:
--
--   · l'Owner, una volta sola, perché il suo accesso è intrinseco;
--   · i membri `active` che hanno almeno un grant in
--     `club_member_permissions` per quella Società.
--
-- Ne restano fuori, come §11 richiede: allenatori, dirigenti e staff senza
-- grant (sono organico, non amministratori), gli affiliati (una Society
-- collegata resta autonoma) e i destinatari di un invito non accettato.
--
-- L'`union` deduplica per profilo: più ruoli o più scope sovrapposti non
-- generano due amministratori, e l'Owner che è anche membro con grant resta
-- una persona sola.
-- ============================================================

create or replace function public.society_structure_admin_ids(p_club_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.owner_profile_id
  from public.clubs c
  where c.id = p_club_id
    and c.owner_profile_id is not null

  union

  select cm.profile_id
  from public.club_members cm
  where cm.club_id = p_club_id
    and cm.status = 'active'
    and cm.profile_id is not null
    and exists (
      select 1
      from public.club_member_permissions perm
      where perm.club_id = cm.club_id
        and perm.profile_id = cm.profile_id
    );
$$;

revoke all on function public.society_structure_admin_ids(uuid) from public;
grant execute on function public.society_structure_admin_ids(uuid) to authenticated;

comment on function public.society_structure_admin_ids(uuid) is
  'DAS-REV-12 §11: profili con un accesso amministrativo attivo sulla '
  'Società — Owner più membri attivi con almeno un grant. Deduplicati: '
  'ruoli multipli e scope sovrapposti non moltiplicano la persona.';


-- ============================================================
-- SEZIONE 2 — public.fetch_society_structure (§7, §11, §12, §13, §15)
--
-- Una riga per l'hub: composizione, dati master, summary amministrativo e
-- segnali strutturali.
--
-- **Eligibility prima dei dati** (§16): se l'actor non ha nessun dominio
-- strutturale la funzione solleva `STRUCTURE_NOT_AUTHORIZED` invece di
-- restituire una riga svuotata. Una pagina vuota direbbe «questa Società non
-- ha nulla»; l'eccezione dice «questa pagina non è tua».
--
-- "Dati della società" da solo **non** rende accessibile l'hub: sono dati già
-- leggibili sul profilo pubblico, e §5 chiede di omettere l'ingresso quando
-- «nessun dominio strutturale è disponibile per l'actor».
-- ============================================================

create or replace function public.fetch_society_structure(p_club_id uuid)
returns table (
  club_id                     uuid,
  club_name                   text,
  club_logo_url               text,
  club_city                   text,
  club_is_verified            boolean,
  scope_label                 text,
  can_view_teams              boolean,
  can_view_seasons            boolean,
  can_view_network            boolean,
  can_view_requests           boolean,
  can_view_admins             boolean,
  can_view_admin_invites      boolean,
  can_open_admin_center       boolean,
  can_view_company_data       boolean,
  can_edit_company_data       boolean,
  admins_count                integer,
  admin_invites_pending_count integer,
  signals                     jsonb,
  access_verified_at          timestamptz,
  data_revision               bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_caps       text[];
  v_net        text[];
  v_owner      boolean;
  v_manage     boolean;
  v_teams      boolean;
  v_network    boolean;
  v_requests   boolean;
  v_company    boolean;
  v_scope      uuid[];
  v_season     text := public.current_season_id();
  v_next       text := public.next_season_id();
  v_now        timestamptz := timezone('utc', now());
  v_signals    jsonb := '[]'::jsonb;
  v_req_count  integer;
  v_req_row    record;
  v_team_row   record;
  v_cur_count  integer;
  v_next_count integer;
begin
  if v_uid is null then
    raise exception 'STRUCTURE_NOT_AUTHORIZED';
  end if;

  if p_club_id is null then
    raise exception 'STRUCTURE_NOT_AUTHORIZED';
  end if;

  v_caps   := public.dashboard_club_capabilities(p_club_id);
  v_net    := public.society_network_capabilities(p_club_id);
  v_owner  := public.owns_club(p_club_id);
  v_manage := public.can_manage_society(p_club_id);

  v_teams    := 'teams_view' = any (v_caps);
  v_network  := 'network_view' = any (v_net);
  v_requests := 'network_requests_view' = any (v_net);

  -- §7, riga «Dati societari nell'hub»: «Lettura dei dati master **nel
  -- contesto gestionale autorizzato**.» Il contesto gestionale della Società
  -- è quello di chi la amministra per intero — Owner o delega senza
  -- restrizione di squadra. Una delega limitata a un Team opera dentro quel
  -- Team: §7 vuole che veda «la Society corrente» e l'ambito, non il blocco
  -- dei dati societari (master 05, dove è presente il solo dominio Squadre).
  v_company := v_owner or public.dashboard_club_scope(p_club_id) is null;

  -- §7: «Aprire l'hub richiede accesso organizzativo valido alla Society e
  -- almeno un dominio autorizzato.» Il dominio "Dati della società" non
  -- conta: da solo non è una struttura da gestire.
  if not (v_teams or v_network or v_requests or v_owner) then
    raise exception 'STRUCTURE_NOT_AUTHORIZED';
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, 'teams_view');

  -- ── Segnale 1: richieste ricevute da valutare (§13, master 03) ────────
  --
  -- Il conteggio è quello delle richieste **ricevute**, pending e gestibili
  -- dalla Society destinataria: il summary della rete può mostrarne due
  -- perché somma anche quella inviata, che non è un'attività di questo actor.
  if v_requests and 'network_request_manage' = any (v_net) then
    select count(*)::integer into v_req_count
    from public.club_relationships r
    where r.status = 'pending'
      and r.recipient_club_id = p_club_id;

    if v_req_count = 1 then
      select
        r.id            as relationship_id,
        t.label         as type_label,
        other.name      as counterpart_name
      into v_req_row
      from public.club_relationships r
      join public.club_relationship_types t on t.id = r.type_id
      join public.clubs other
        on other.id = case
             when r.club_a_id = p_club_id then r.club_b_id
             else r.club_a_id
           end
      where r.status = 'pending'
        and r.recipient_club_id = p_club_id
      limit 1;

      -- La riga può essere sparita fra il conteggio e la lettura: senza
      -- riferimento canonico il segnale non si disegna (§14: «Ogni azione
      -- deve risolvere un target noto»).
      if found then
        v_signals := v_signals || jsonb_build_array(jsonb_build_object(
          'id',              'network_request:' || v_req_row.relationship_id::text,
          'kind',            'network_request',
          'title',           '1 richiesta da valutare',
          'context',         v_req_row.counterpart_name || ' · ' || v_req_row.type_label,
          'action_label',    'Valuta richiesta',
          'count',           1,
          'club_id',         p_club_id,
          'relationship_id', v_req_row.relationship_id,
          'team_id',         null,
          'season_target',   null,
          'sort',            1
        ));
      end if;
    elsif v_req_count > 1 then
      -- §13: «Se il segnale aggrega più richieste, usa titolo e destinazione
      -- coerenti con il gruppo … Non mostrare il nome di una sola controparte
      -- come se rappresentasse l'intero gruppo.»
      v_signals := v_signals || jsonb_build_array(jsonb_build_object(
        'id',              'network_requests',
        'kind',            'network_requests',
        'title',           v_req_count::text || ' richieste da valutare',
        'context',         null,
        'action_label',    'Vedi richieste',
        'count',           v_req_count,
        'club_id',         p_club_id,
        'relationship_id', null,
        'team_id',         null,
        'season_target',   null,
        'sort',            1
      ));
    end if;
  end if;

  -- ── Segnali stagionali (§13) ──────────────────────────────────────────
  --
  -- Due condizioni distinte e realmente azionabili, entrambe già esposte dal
  -- Centro Stagioni: la stagione **corrente** non configurata per una
  -- squadra attiva, e la stagione **successiva** preparabile secondo il
  -- catalogo centrale.
  --
  -- Il catalogo è server-side (`current_season_id` confronta `current_date`
  -- con le date della stagione): §13 vieta di «generare un'urgenza universale
  -- al cambio dell'anno del dispositivo», e qui l'orologio del dispositivo
  -- non entra mai nella decisione.
  if v_teams and 'seasons_prepare' = any (v_caps) and v_season is not null then
    select count(*)::integer into v_cur_count
    from public.club_teams ct
    where ct.club_id = p_club_id
      and not ct.is_archived
      and (v_scope is null or ct.id = any (v_scope))
      and not exists (
        select 1 from public.club_team_seasons cts
        where cts.team_id = ct.id and cts.season_id = v_season
      );

    if v_cur_count = 1 then
      select ct.id as team_id, ct.name as name into v_team_row
      from public.club_teams ct
      where ct.club_id = p_club_id
        and not ct.is_archived
        and (v_scope is null or ct.id = any (v_scope))
        and not exists (
          select 1 from public.club_team_seasons cts
          where cts.team_id = ct.id and cts.season_id = v_season
        )
      limit 1;

      if found then
        v_signals := v_signals || jsonb_build_array(jsonb_build_object(
          'id',              'season_configure:' || v_team_row.team_id::text,
          'kind',            'team_season',
          'title',           v_team_row.name || ' — stagione '
                               || (select s.label from public.seasons s where s.id = v_season)
                               || ' da configurare',
          'context',         null,
          'action_label',    'Configura stagione',
          'count',           1,
          'club_id',         p_club_id,
          'relationship_id', null,
          'team_id',         v_team_row.team_id,
          'season_target',   'current',
          'sort',            2
        ));
      end if;
    elsif v_cur_count > 1 then
      v_signals := v_signals || jsonb_build_array(jsonb_build_object(
        'id',              'season_configure',
        'kind',            'seasons_center',
        'title',           v_cur_count::text || ' squadre da configurare',
        'context',         'Stagione '
                             || (select s.label from public.seasons s where s.id = v_season),
        'action_label',    'Apri stagioni',
        'count',           v_cur_count,
        'club_id',         p_club_id,
        'relationship_id', null,
        'team_id',         null,
        'season_target',   'current',
        'sort',            2
      ));
    end if;

    -- La stagione successiva esiste nel catalogo soltanto quando è stata
    -- censita: `next_season_id()` restituisce null altrimenti, e §13 vieta di
    -- fabbricarne una («Non generare … il numero di stagione è un esempio:
    -- usa il catalogo centrale»).
    if v_next is not null then
      select count(*)::integer into v_next_count
      from public.club_teams ct
      where ct.club_id = p_club_id
        and not ct.is_archived
        and (v_scope is null or ct.id = any (v_scope))
        and not exists (
          select 1 from public.club_team_seasons cts
          where cts.team_id = ct.id and cts.season_id = v_next
        );

      if v_next_count = 1 then
        select ct.id as team_id, ct.name as name into v_team_row
        from public.club_teams ct
        where ct.club_id = p_club_id
          and not ct.is_archived
          and (v_scope is null or ct.id = any (v_scope))
          and not exists (
            select 1 from public.club_team_seasons cts
            where cts.team_id = ct.id and cts.season_id = v_next
          )
        limit 1;

        if found then
          v_signals := v_signals || jsonb_build_array(jsonb_build_object(
            'id',              'season_prepare:' || v_team_row.team_id::text,
            'kind',            'team_season',
            'title',           v_team_row.name || ' — stagione '
                                 || (select s.label from public.seasons s where s.id = v_next)
                                 || ' da preparare',
            'context',         null,
            'action_label',    'Prepara stagione',
            'count',           1,
            'club_id',         p_club_id,
            'relationship_id', null,
            'team_id',         v_team_row.team_id,
            'season_target',   'next',
            'sort',            3
          ));
        end if;
      elsif v_next_count > 1 then
        v_signals := v_signals || jsonb_build_array(jsonb_build_object(
          'id',              'season_prepare',
          'kind',            'seasons_center',
          'title',           v_next_count::text || ' squadre da preparare',
          'context',         'Stagione '
                               || (select s.label from public.seasons s where s.id = v_next),
          'action_label',    'Apri stagioni',
          'count',           v_next_count,
          'club_id',         p_club_id,
          'relationship_id', null,
          'team_id',         null,
          'season_target',   'next',
          'sort',            3
        ));
      end if;
    end if;
  end if;

  return query
  select
    c.id,
    c.name,
    c.logo_url,
    c.city,
    coalesce(c.verification_status, 'unverified') = 'verified',
    public.dashboard_club_scope_label(p_club_id),
    v_teams,
    -- §9: «Rivalida ogni accesso in modo indipendente.» Oggi il Centro
    -- Stagioni è gated sulla stessa chiave del Centro Squadre
    -- (`fetch_seasons_center` ritorna can_view = false senza `teams_view`):
    -- le due colonne restano separate nel contratto perché DAS-REV-14 può
    -- separarle davvero, e l'hub non deve cambiare forma quando accadrà.
    v_teams,
    v_network,
    v_requests,
    -- §11 / §7: oggi la lettura degli accessi amministrativi non ha una
    -- capability propria. L'unico lettore canonico è l'Owner — sia perché
    -- `club_member_permissions` è gestita da lui, sia perché la destinazione
    -- `/club-admin/permissions` è gated sul ruolo. DAS-REV-14 introdurrà la
    -- chiave granulare; fino ad allora leggere e aprire coincidono, e per
    -- chiunque altro il dominio è **assente**, non a zero.
    v_owner,
    v_owner,
    v_owner,
    -- §12 separa lettura e modifica: la sintesi resta visibile a chi non
    -- può modificarla, e l'azione sparisce — non un pulsante disabled.
    v_company,
    v_company and v_manage,
    case when v_owner then (
      select count(*)::integer from public.society_structure_admin_ids(p_club_id)
    ) end,
    case when v_owner then (
      -- §11: un invito **amministrativo** ancora pending. Non è un invito
      -- all'organico: la membership pending conta solo se porta già con sé
      -- almeno un grant, cioè se la persona è stata invitata *come*
      -- amministratore. `club_members` non ha scadenza, quindi la validità
      -- temporale coincide con lo stato: non esiste un pending scaduto da
      -- escludere, e nessun job di pulizia può falsare il numero.
      select count(distinct cm.profile_id)::integer
      from public.club_members cm
      where cm.club_id = p_club_id
        and cm.status = 'pending'
        and cm.profile_id is not null
        and cm.profile_id is distinct from c.owner_profile_id
        and exists (
          select 1
          from public.club_member_permissions perm
          where perm.club_id = cm.club_id
            and perm.profile_id = cm.profile_id
        )
    ) end,
    -- §13: massimo tre, ordine stabile. Il limite è applicato **dopo** il
    -- filtro per identity, scope e capability, non prima.
    (
      select coalesce(jsonb_agg(entry order by (entry->>'sort')::int), '[]'::jsonb)
      from (
        select entry
        from jsonb_array_elements(v_signals) as t(entry)
        order by (entry->>'sort')::int
        limit 3
      ) limited
    ),
    v_now,
    -- Revisione monotona: copre le sorgenti che l'hub possiede davvero —
    -- membership/grant e dati master. Squadre, stagioni e rete hanno la
    -- propria revisione dentro i rispettivi provider.
    greatest(
      (extract(epoch from c.updated_at)::bigint),
      (
        select coalesce(extract(epoch from max(cm.updated_at))::bigint, 0)
        from public.club_members cm
        where cm.club_id = p_club_id
      )
    )
  from public.clubs c
  where c.id = p_club_id;
end;
$$;

revoke all on function public.fetch_society_structure(uuid) from public;
grant execute on function public.fetch_society_structure(uuid) to authenticated;

comment on function public.fetch_society_structure(uuid) is
  'DAS-REV-12: composizione dell''hub Struttura societaria — domini '
  'autorizzati, dati master della Società, summary amministrativo e segnali '
  'strutturali già filtrati per scope e capability. Squadre, relazioni e '
  'stagioni restano ai rispettivi centri.';
