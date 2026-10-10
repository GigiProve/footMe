-- ============================================================
-- DAS-REV-09 — Dettaglio operativo Squadra
--
-- Due letture, non una. §25 chiede «richieste parallele dove utile» e §24
-- chiede che il fallimento delle Posizioni resti **locale** mentre Organico,
-- Candidature e Inviti restano leggibili: due provider separati sono l'unico
-- modo di renderlo vero invece di simulato in un `catch` del client.
--
--   `fetch_team_detail`             base, permessi, Organico, Candidature,
--                                   Inviti, metadata del Gruppo;
--   `fetch_team_positions_preview`  totale attive e fino a due anteprime.
--
-- Nessuna tabella nuova. Nessun lifecycle nuovo. Tutto ciò che serve esiste
-- già nei domini canonici e qui viene **proiettato**:
--
--   Organico     → `club_members` (team_id, status, is_current, member_role)
--                  con la stessa deduplicazione di `fetch_teams_center_page`;
--   Posizioni    → `recruiting_ads.team_id` + `recruiting_ad_is_available`,
--                  la normalizzazione canonica di DAS-REV-05;
--   Candidature  → `recruiting_applications` con lo stesso perimetro della
--                  Dashboard Società (tutto ciò che non è `withdrawn`);
--   Inviti       → `club_members.status = 'pending'`, cioè inviti in uscita;
--   Gruppo       → **non esiste** nel dominio Messaggi (vedi SEZIONE 5).
--
-- Permessi: nessun sistema nuovo (§9). Si riusano le chiavi di
-- `club_member_permissions` e il perimetro **per singola capability** di
-- `dashboard_club_capability_scope`, che DAS-REV-07 ha introdotto proprio
-- per non far trapelare le candidature di una squadra a chi ha solo
-- `teams_view` su di essa.
--
-- Rollback: `drop function public.fetch_team_detail(uuid);`
--           `drop function public.fetch_team_positions_preview(uuid);`
-- Nessuna struttura viene modificata, quindi il rollback è completo.
--
-- Convenzioni riusate:
--   20261019090000_teams_center.sql          (capability, scope, conteggi)
--   20261018090000_dashboard_society_overview.sql (null ≠ zero, revision)
--   20261016090000_dashboard_saved_positions.sql  (disponibilità posizione)
-- ============================================================


-- ============================================================
-- SEZIONE 1 — Perimetro di una singola squadra (§9)
--
-- `teams_view` concede la Società **o** un elenco di squadre: la differenza
-- fra «null = nessuna restrizione» e «array = solo queste» è già codificata
-- in `dashboard_club_capability_scope`. Questa funzione la applica a una
-- chiave e a un Team, perché ogni modulo interroga la **propria** chiave.
--
-- Non è un nuovo sistema di autorizzazioni: è la stessa funzione, chiamata
-- una volta per capability invece che una volta per pagina.
-- ============================================================

create or replace function public.team_capability_allows(
  p_club_id uuid,
  p_team_id uuid,
  p_key     text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope uuid[];
begin
  if p_club_id is null or p_team_id is null then
    return false;
  end if;

  if public.owns_club(p_club_id) then
    return true;
  end if;

  if not (p_key = any (public.dashboard_club_capabilities(p_club_id))) then
    return false;
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, p_key);

  -- `null` qui significa «la chiave c'è e non ha perimetro», non «nessuna
  -- squadra»: il controllo sulla presenza della chiave è già avvenuto sopra.
  return v_scope is null or p_team_id = any (v_scope);
end;
$$;

revoke all on function public.team_capability_allows(uuid, uuid, text) from public;
grant execute on function public.team_capability_allows(uuid, uuid, text) to authenticated;

comment on function public.team_capability_allows(uuid, uuid, text) is
  'DAS-REV-09 §9: una capability, una squadra. Non somma perimetri di chiavi '
  'diverse — vedi dashboard_club_capability_scope.';


-- ============================================================
-- SEZIONE 2 — Anteprima avatar dell'Organico (§11, §25)
--
-- «Per Organico servono aggregati e fino a quattro riferimenti avatar
-- autorizzati, non il roster completo.»
--
-- Vengono restituiti **solo** l'identificativo della membership, l'URL
-- dell'avatar e le iniziali calcolate qui. Non il nome: §29 chiede che gli
-- avatar decorativi non espongano «dati non necessari», e le iniziali
-- bastano al fallback del design system. I record manuali non hanno un
-- profilo PROLINK e restano fuori dall'anteprima pur restando nei conteggi:
-- §11 vuole «persone autorizzate nel contesto corrente».
--
-- L'ordine è neutro e stabile — ordine di inserimento nel roster — e non
-- esprime ranking, titolarità o importanza (§11).
-- ============================================================

create or replace function public.team_roster_initials(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(trim(p_name), '') = '' then ''
    when array_length(regexp_split_to_array(trim(p_name), '\s+'), 1) = 1
      then upper(left(trim(p_name), 1))
    else upper(left((regexp_split_to_array(trim(p_name), '\s+'))[1], 1))
       || upper(left(
            (regexp_split_to_array(trim(p_name), '\s+'))[
              array_length(regexp_split_to_array(trim(p_name), '\s+'), 1)
            ], 1))
  end;
$$;

grant execute on function public.team_roster_initials(text) to authenticated;


-- ============================================================
-- SEZIONE 3 — public.fetch_team_detail (§7, §8, §11, §15, §16, §25)
--
-- Una riga con la base della pagina. Ogni colonna `null` significa «non
-- autorizzato» o «non disponibile», **mai zero** (§25): il client distingue
-- i tre casi e §14 vieta di scrivere «Nessuna posizione aperta» quando il
-- dato non è arrivato.
--
-- Risorsa non consultabile: un solo codice, `TEAM_NOT_FOUND`, per squadra
-- inesistente, Società senza `teams_view` e squadra fuori perimetro. §27
-- chiede un «messaggio neutro … senza rivelare informazioni sulla risorsa
-- non consultabile», e tre codici diversi direbbero all'attaccante quale dei
-- tre casi ha incontrato.
-- ============================================================

create or replace function public.fetch_team_detail(p_team_id uuid)
returns table (
  team_id                uuid,
  club_id                uuid,
  club_name              text,
  club_logo_url          text,
  club_is_verified       boolean,
  name                   text,
  crest_url              text,
  crest_inherited        boolean,
  city                   text,
  city_inherited         boolean,
  season_id              text,
  season_label           text,
  has_season_config      boolean,
  type_id                text,
  type_label             text,
  level_id               text,
  level_label            text,
  is_archived            boolean,
  -- capability risolte sul contesto Team–Società
  is_owner               boolean,
  can_edit               boolean,
  can_view_roster        boolean,
  can_manage_roster      boolean,
  can_view_applications  boolean,
  can_view_invites       boolean,
  can_manage_invites     boolean,
  can_view_positions     boolean,
  can_create_positions   boolean,
  -- Organico
  roster_players_count   integer,
  roster_staff_count     integer,
  roster_avatars         jsonb,
  -- Candidature
  applications_count     integer,
  applications_new_count integer,
  -- Inviti e richieste
  invites_pending_count  integer,
  -- Gruppo squadra (vedi SEZIONE 5: dominio assente)
  group_supported        boolean,
  group_conversation_id  uuid,
  group_title            text,
  group_member_count     integer,
  access_verified_at     timestamptz,
  data_revision          bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_club        uuid;
  v_season      text := public.current_season_id();
  v_now         timestamptz := timezone('utc', now());
  v_owner       boolean;
  v_roster      boolean;
  v_apps        boolean;
  v_inv_view    boolean;
  v_inv_manage  boolean;
  v_pos_view    boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select ct.club_id into v_club from public.club_teams ct where ct.id = p_team_id;

  -- Inesistente, non consultabile o fuori perimetro: un solo esito (§27).
  if v_club is null
     or not public.team_capability_allows(v_club, p_team_id, 'teams_view')
  then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  v_owner      := public.owns_club(v_club);
  v_roster     := public.team_capability_allows(v_club, p_team_id, 'roster_view');
  v_apps       := public.team_capability_allows(v_club, p_team_id, 'applications_view');
  v_inv_view   := public.team_capability_allows(v_club, p_team_id, 'invites_view');
  v_inv_manage := public.team_capability_allows(v_club, p_team_id, 'invites_create');
  v_pos_view   := public.team_capability_allows(v_club, p_team_id, 'positions_view');

  return query
  select
    ct.id,
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    ct.name,
    -- `logo_url` e `city` sono già il valore **risolto** dal trigger di
    -- DAS-REV-08: la modalità dice soltanto da dove proviene. Il client non
    -- ricalcola l'ereditarietà e un errore di caricamento dell'immagine non
    -- la cambia (§8).
    ct.logo_url,
    ct.crest_mode = 'inherited',
    ct.city,
    ct.city_mode = 'inherited',
    v_season,
    (select s.label from public.seasons s where s.id = v_season),
    (cts.id is not null),
    cts.team_type_id,
    tt.label,
    cts.level_id,
    tl.label,
    ct.is_archived,

    v_owner,
    public.can_edit_club_team(ct.id),
    v_roster,
    -- "roster.manage" nel vocabolario di §9 è, in questo dominio, la facoltà
    -- di **collegare una persona**: la chiave è `invites_create`, perché il
    -- solo percorso esistente passa dagli inviti.
    v_inv_manage,
    v_apps,
    v_inv_view,
    v_inv_manage,
    v_pos_view,
    public.team_capability_allows(v_club, ct.id, 'positions_create'),

    -- ── Organico (§11) ────────────────────────────────────────────────
    -- Stessa deduplicazione di `fetch_teams_center_page`: una persona con
    -- più record tecnici non va moltiplicata nello stesso aggregato.
    case when v_roster then (
      select count(distinct coalesce(
               cm.profile_id::text,
               'manual:' || public.footme_normalize_lookup(cm.manual_name)
             ))::integer
      from public.club_members cm
      where cm.team_id = ct.id
        and cm.status = 'active'
        and cm.is_current
        and cm.member_role = 'player'
    ) end,
    case when v_roster then (
      select count(distinct coalesce(
               cm.profile_id::text,
               'manual:' || public.footme_normalize_lookup(cm.manual_name)
             ))::integer
      from public.club_members cm
      where cm.team_id = ct.id
        and cm.status = 'active'
        and cm.is_current
        and cm.member_role in ('coach', 'staff', 'director')
    ) end,
    case when v_roster then coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', a.id,
                 'avatar_url', a.avatar_url,
                 'initials', a.initials
               )
               order by a.ord
             )
      from (
        select
          cm.id,
          p.avatar_url,
          public.team_roster_initials(p.full_name) as initials,
          row_number() over (order by cm.created_at, cm.id) as ord
        from public.club_members cm
        join public.profiles p on p.id = cm.profile_id
        where cm.team_id = ct.id
          and cm.status = 'active'
          and cm.is_current
          and cm.profile_id is not null
        order by cm.created_at, cm.id
        limit 4
      ) a
    ), '[]'::jsonb) end,

    -- ── Candidature (§15) ─────────────────────────────────────────────
    -- Stesso perimetro del centro proprietario: tutto ciò che non è
    -- `withdrawn`, comprese le candidature di posizioni ormai chiuse ma
    -- ancora consultabili. Non è ristretto alle due posizioni in anteprima.
    case when v_apps then (
      select count(*)::integer
      from public.recruiting_applications ra
      join public.recruiting_ads ad on ad.id = ra.ad_id
      where ad.team_id = ct.id
        and ra.status <> 'withdrawn'
    ) end,
    -- "Nuove" è lo stato canonico `submitted` letto dal lato Società, non un
    -- contatore letto/non letto locale a questa pagina (§15). Nessuna GET lo
    -- consuma: solo il dominio proprietario fa avanzare lo stato.
    case when v_apps then (
      select count(*)::integer
      from public.recruiting_applications ra
      join public.recruiting_ads ad on ad.id = ra.ad_id
      where ad.team_id = ct.id
        and ra.status = 'submitted'
    ) end,

    -- ── Inviti e richieste (§16) ──────────────────────────────────────
    -- Inviti in **uscita** verso un profilo PROLINK, come nella Dashboard
    -- Società. I `club_invite_links` non si contano: sono token, non inviti
    -- a una persona. Pending non è membro dell'Organico, ed è il motivo per
    -- cui l'aggregato è separato dai conteggi del roster.
    case when v_inv_view then (
      select count(*)::integer
      from public.club_members cm
      where cm.team_id = ct.id
        and cm.status = 'pending'
        and cm.profile_id is not null
    ) end,

    -- ── Gruppo squadra: dominio assente (SEZIONE 5) ───────────────────
    false,
    null::uuid,
    null::text,
    null::integer,

    v_now,
    (extract(epoch from v_now) * 1000)::bigint
  from public.club_teams ct
  join public.clubs c on c.id = ct.club_id
  left join public.club_team_seasons cts
    on cts.team_id = ct.id and cts.season_id = v_season
  left join public.team_types tt on tt.id = cts.team_type_id
  left join public.team_levels tl on tl.id = cts.level_id
  where ct.id = p_team_id;
end;
$$;

revoke all on function public.fetch_team_detail(uuid) from public;
grant execute on function public.fetch_team_detail(uuid) to authenticated;

comment on function public.fetch_team_detail(uuid) is
  'DAS-REV-09 §25: proiezione leggera del dettaglio operativo di una '
  'squadra — base, capability, aggregati di Organico, Candidature e Inviti. '
  'Colonna null = non autorizzato o non disponibile, mai zero.';


-- ============================================================
-- SEZIONE 4 — public.fetch_team_positions_preview (§13, §24)
--
-- Provider separato per una ragione precisa: il master 06 mostra **solo**
-- Posizioni in errore mentre il resto della pagina funziona. Con un unico
-- endpoint quello stato sarebbe una finzione del client.
--
-- «Attive» usa `recruiting_ad_is_available(status, application_deadline_at)`,
-- la normalizzazione canonica di DAS-REV-05: `status = 'published'` e
-- scadenza di invio non superata. Non `can_apply`, non la colonna `deadline`
-- (una data senza orario, che il dominio non usa mai come cutoff).
--
-- Il totale **non** è la dimensione dell'array di anteprima (§13): sono due
-- valori con due query, perché 4 attive con 2 preview è lo stato del master
-- 03 e confonderli lo renderebbe irrappresentabile.
--
-- Nessun filtro temporale sulla stagione: §13 è esplicito — «Una posizione
-- ancora valida non va esclusa soltanto perché creata prima del cambio
-- stagione». Il dominio Posizioni non ha un asse stagionale.
-- ============================================================

create or replace function public.fetch_team_positions_preview(p_team_id uuid)
returns table (
  can_view     boolean,
  can_create   boolean,
  active_count integer,
  items        jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_club uuid;
  v_view boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select ct.club_id into v_club from public.club_teams ct where ct.id = p_team_id;

  if v_club is null
     or not public.team_capability_allows(v_club, p_team_id, 'teams_view')
  then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  v_view := public.team_capability_allows(v_club, p_team_id, 'positions_view');

  if not v_view then
    -- Non autorizzato ≠ nessuna posizione: il conteggio resta `null` e il
    -- client omette il modulo invece di scrivere zero (§10, §25).
    return query select false, false, null::integer, '[]'::jsonb;
    return;
  end if;

  return query
  select
    true,
    public.team_capability_allows(v_club, p_team_id, 'positions_create'),
    (
      select count(*)::integer
      from public.recruiting_ads ad
      where ad.team_id = p_team_id
        and public.recruiting_ad_is_available(ad.status, ad.application_deadline_at)
    ),
    coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', x.id,
                 'title', x.title,
                 'target_role', x.target_role
               )
               order by x.ord
             )
      from (
        select
          ad.id,
          ad.title,
          -- `target_role` è `text` nei file di migrazione e `app_role` sul
          -- remoto: il cast esplicito legge entrambi senza scommettere su
          -- quale dei due schemi sia installato.
          ad.target_role::text as target_role,
          row_number() over (order by ad.created_at desc, ad.id) as ord
        from public.recruiting_ads ad
        where ad.team_id = p_team_id
          and public.recruiting_ad_is_available(ad.status, ad.application_deadline_at)
        order by ad.created_at desc, ad.id
        limit 2
      ) x
    ), '[]'::jsonb);
end;
$$;

revoke all on function public.fetch_team_positions_preview(uuid) from public;
grant execute on function public.fetch_team_positions_preview(uuid) to authenticated;

comment on function public.fetch_team_positions_preview(uuid) is
  'DAS-REV-09 §13: totale delle posizioni attive della squadra e fino a due '
  'anteprime. Provider separato perché §24 chiede un errore locale al solo '
  'modulo Posizioni.';


-- ============================================================
-- SEZIONE 5 — Gruppo squadra: integrazione dichiarata mancante (§17)
--
-- Il dominio **non esiste**. `public.conversations` (20260309000000, estesa
-- da 20260718090000 con `conversation_type in ('direct','group')`, `title` e
-- `avatar_url`) non ha alcuna colonna verso `club_teams`, non esiste una
-- tabella ponte, non esiste una RPC di creazione e nessuna schermata
-- dell'app crea un gruppo: l'unico gruppo esistente è quello del seed demo,
-- legato a una squadra solo dal testo del titolo.
--
-- §3 colloca «gestione completa di Gruppi, partecipanti e messaggistica»
-- **fuori perimetro**, e §4 chiede in quel caso di «implementare l'adapter e
-- le parti indipendenti della pagina, indicando l'integrazione mancante».
--
-- Di conseguenza:
--   · il contratto esiste (le quattro colonne `group_*` di SEZIONE 3);
--   · `group_supported` è `false` e le altre tre sono `null`;
--   · il client omette il modulo invece di mostrare una CTA senza
--     destinazione, come §35 richiede.
--
-- Per renderlo reale servono, nell'ordine: una colonna
-- `conversations.club_team_id` (o una tabella ponte), una RPC di
-- creazione idempotente, la sincronizzazione dei partecipanti da
-- `club_members` e un punto di ingresso in Messaggi. Nessuna delle quattro
-- è di questo pack.
-- ============================================================
