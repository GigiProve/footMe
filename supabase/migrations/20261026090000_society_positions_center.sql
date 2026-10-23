-- ============================================================
-- DAS-REV-15 — Centro Posizioni aperte (Dashboard Società)
--
-- Il Centro legge il dominio Position già esistente (`recruiting_ads`) e il
-- dominio Application già esistente (`recruiting_applications`). Questa
-- migrazione **non** crea un PositionV2, una seconda collezione di
-- candidature o un lifecycle parallelo: `public.ad_status` resta l'unico
-- lifecycle, ed è già esattamente draft | published | closed.
--
-- Quattro lacune reali impediscono però di implementare la specifica
-- leggendo soltanto ciò che esiste:
--
--   1. **Non esiste una data di chiusura.** §13 vieta di usare `updated_at`
--      (si muove per qualunque scrittura) e vieta di usare la deadline
--      candidature (è un cutoff di ricezione, non una chiusura). Sezione 1.
--   2. **Le bozze sono leggibili da chiunque sia autenticato.** La policy
--      `using (true)` del 2026-03-09 espone `status = 'draft'` a tutto il
--      prodotto; §12 e §9 chiedono l'opposto. Sezione 2.
--   3. **Non esiste un contesto storico della Position.** §13: «Non
--      sostituire il campionato della posizione chiusa con quello corrente
--      della squadra.» Serve uno snapshot alla prima pubblicazione.
--      Sezione 3.
--   4. **Non esiste una lettura gestionale** per gruppo, ambito, cursore e
--      aggregati autorizzati. Sezioni 5-8.
--
-- Rollback: droppare le funzioni `society_position*` / `fetch_society_
-- position*`, il trigger `recruiting_ads_lifecycle_stamps`, ripristinare la
-- policy di SELECT `using (true)`. Le colonne aggiunte sono nullable e
-- additive: lasciarle non rompe nessuna lettura precedente.
--
-- Idempotenza: `add column if not exists`, `create or replace function`,
-- `drop policy if exists` + `create policy`, backfill con `where ... is
-- null`. Rieseguire la migrazione non duplica dati e non riscrive una data
-- già stabilita.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — `closed_at`: la chiusura esplicita ha una data propria
--
-- §13: «La data proviene da closed_at della chiusura esplicita, o dal suo
-- equivalente autorevole nel modello; non dalla deadline candidature. Una
-- data sconosciuta non diventa oggi.»
--
-- `recruiting_ad_availability_events` (DAS-REV-05) registra le transizioni di
-- **disponibilità**, che è un'altra cosa: una deadline spostata nel passato
-- vi produce un `became_unavailable` con reason `deadline_passed`. Solo le
-- righe con `reason = 'closed'` testimoniano una chiusura, e solo da
-- 20261016 in avanti — prima non esiste alcuna fonte. Il backfill prende
-- quelle righe e **lascia null** tutto il resto: §13 vieta di riempire dati
-- storici mancanti con valori dimostrativi.
-- ============================================================

alter table public.recruiting_ads
  add column if not exists closed_at timestamptz;

comment on column public.recruiting_ads.closed_at is
  'DAS-REV-15 §13: istante della chiusura esplicita PUBLISHED -> CLOSED. '
  'Null su una posizione non chiusa, e null anche su una chiusura storica '
  'senza testimonianza affidabile: in quel caso la lista mostra la label '
  'neutra "Posizione chiusa". Distinto da application_deadline_at, che '
  'interrompe la ricezione senza chiudere, e da updated_at, che si muove '
  'per qualunque scrittura.';

create index if not exists recruiting_ads_closed_at_idx
  on public.recruiting_ads (club_id, closed_at desc)
  where status = 'closed';


-- ============================================================
-- SEZIONE 2 — contesto storico conservato alla prima pubblicazione
--
-- §13: «Per una ricerca già pubblicata/chiusa usa il nome e il contesto Team
-- conservati alla prima pubblicazione tramite riferimento versionato o
-- snapshot minimo autorevole. Una rinomina corrente non deve riscrivere il
-- significato storico.»
--
-- Snapshot **minimo**: stagione, nome del Team, tipo e livello. Non una copia
-- della Position e non una copia del Team — solo ciò che la riga storica
-- mostra. I tre id restano chiavi della tassonomia centrale, non stringhe
-- calcolate dal nome della squadra (§4).
--
-- Nessun backfill dai master attuali: §13 è esplicito — «Se manca un dato
-- originario affidabile, mostra soltanto il contesto noto, senza presentare
-- una fotografia dei master attuali come storica.»
-- ============================================================

alter table public.recruiting_ads
  add column if not exists published_season_id text references public.seasons(id);

alter table public.recruiting_ads
  add column if not exists published_team_name text;

alter table public.recruiting_ads
  add column if not exists published_team_type_id text references public.team_types(id);

alter table public.recruiting_ads
  add column if not exists published_level_id text references public.team_levels(id);

comment on column public.recruiting_ads.published_season_id is
  'DAS-REV-15 §13: stagione in cui la ricerca è stata pubblicata la prima '
  'volta. Null = nessuna fotografia storica affidabile; la riga mostra '
  'allora soltanto il contesto corrente conosciuto.';


-- ============================================================
-- SEZIONE 3 — un solo trigger per le due impronte di lifecycle
--
-- Entrambe nascono dalla stessa transizione e devono essere coerenti fra
-- loro, quindi vivono nella stessa funzione: due trigger separati
-- potrebbero essere disattivati uno senza l'altro e produrre una chiusura
-- senza data o uno snapshot senza pubblicazione.
--
-- `before` e non `after`: la riga scritta deve già contenere i valori, così
-- una lettura concorrente non vede mai una CLOSED senza `closed_at`.
--
-- La riapertura azzera `closed_at` (una CLOSED tornata PUBLISHED non è più
-- chiusa) ma **non** azzera lo snapshot: la prima pubblicazione resta quella,
-- e §13 vieta che una ripubblicazione riscriva il significato storico.
-- ============================================================

create or replace function public.recruiting_ads_stamp_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season text;
begin
  -- ── closed_at ────────────────────────────────────────────────────────
  if new.status = 'closed' then
    -- Una chiusura già datata non viene ridatata da una scrittura
    -- successiva: §13 vuole l'istante della chiusura, non dell'ultimo
    -- update. Una riesecuzione dello stesso comando è quindi innocua.
    if new.closed_at is null then
      new.closed_at := timezone('utc', now());
    end if;
  else
    new.closed_at := null;
  end if;

  -- ── snapshot del contesto alla prima pubblicazione ───────────────────
  if new.status = 'published' and new.published_season_id is null then
    v_season := public.current_season_id();

    select
      ct.name,
      cts.team_type_id,
      cts.level_id
    into
      new.published_team_name,
      new.published_team_type_id,
      new.published_level_id
    from public.club_teams ct
    left join public.club_team_seasons cts
      on cts.team_id = ct.id
     and cts.season_id = v_season
    where ct.id = new.team_id;

    -- La stagione si registra anche per un incarico SOCIETY, che non ha
    -- Team: è il contesto temporale della ricerca, non del Team.
    new.published_season_id := v_season;
  end if;

  return new;
end;
$$;

comment on function public.recruiting_ads_stamp_lifecycle() is
  'DAS-REV-15 §13: data di chiusura esplicita e fotografia storica del '
  'contesto, scritte dal dominio e non dal client. Nessuna delle due si '
  'ricava da updated_at o dalla deadline candidature.';

drop trigger if exists recruiting_ads_lifecycle_stamps on public.recruiting_ads;
create trigger recruiting_ads_lifecycle_stamps
before insert or update of status on public.recruiting_ads
for each row execute function public.recruiting_ads_stamp_lifecycle();


-- Backfill, una volta sola e solo dove esiste una testimonianza reale.
update public.recruiting_ads ra
set closed_at = ev.occurred_at
from (
  select distinct on (e.ad_id)
    e.ad_id,
    e.occurred_at
  from public.recruiting_ad_availability_events e
  where e.transition = 'became_unavailable'
    and e.reason = 'closed'
  order by e.ad_id, e.occurred_at desc, e.id desc
) ev
where ra.id = ev.ad_id
  and ra.status = 'closed'
  and ra.closed_at is null;


-- ============================================================
-- SEZIONE 4 — RLS: una bozza non è un annuncio pubblico
--
-- La policy del 2026-03-09 era `using (true)`: qualunque utente autenticato
-- poteva leggere **tutte** le `recruiting_ads`, bozze comprese. §12 chiede
-- l'opposto — «Una bozza privata non leggibile non viene restituita» — e §9
-- estende la regola: «Le ACL della bozza si applicano all'intero oggetto.»
--
-- La lettura pubblica di published/closed resta invariata: Cerca, profili
-- Società, Home e dettaglio pubblico filtrano già `status = 'published'`
-- (o published/closed nel dettaglio) e non perdono nulla.
--
-- Il diritto gestionale sulla bozza è la capability `positions_view` **nel
-- suo scope**: una bozza TEAM richiede la squadra nel perimetro, una bozza
-- SOCIETY richiede il perimetro Society-wide (scope null). Un `team_id`
-- nullo non aggira i permessi (§9).
-- ============================================================

create or replace function public.society_position_in_scope(
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
  if p_club_id is null then
    return false;
  end if;

  if public.owns_club(p_club_id) then
    return true;
  end if;

  if not public.club_access_is_active(p_club_id, auth.uid()) then
    return false;
  end if;

  if not (p_key = any (public.dashboard_club_capabilities(p_club_id))) then
    return false;
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, p_key);

  -- `null` = la chiave non ha perimetro di squadra, quindi copre anche gli
  -- incarichi SOCIETY. Un array copre soltanto quelle squadre, e per
  -- costruzione non copre `team_id is null`.
  if v_scope is null then
    return true;
  end if;

  return p_team_id is not null and p_team_id = any (v_scope);
end;
$$;

revoke all on function public.society_position_in_scope(uuid, uuid, text) from public;
grant execute on function public.society_position_in_scope(uuid, uuid, text) to authenticated;

comment on function public.society_position_in_scope(uuid, uuid, text) is
  'DAS-REV-15 §9: una capability, una Position. Lo scope Society-wide '
  '(null) copre anche gli incarichi SOCIETY; uno scope di squadre non li '
  'copre mai, perché un team_id nullo non appartiene a nessuna squadra.';

drop policy if exists "ads are readable by authenticated users" on public.recruiting_ads;
create policy "published ads are readable by authenticated users"
on public.recruiting_ads
for select
to authenticated
using (
  status <> 'draft'
  or public.owns_club(club_id)
  or public.is_current_user(created_by_profile_id)
  or public.society_position_in_scope(club_id, team_id, 'positions_view')
);


-- ============================================================
-- SEZIONE 5 — mappatura lifecycle -> gruppo del Centro (§8)
--
-- «Supporta concetti equivalenti a DRAFT, PUBLISHED e CLOSED, adattandoli
-- agli stati reali del repository. Non creare un lifecycle Dashboard
-- separato.» Qui non c'è nessuno stato intermedio da mappare: l'enum ha
-- esattamente tre valori. La funzione esiste perché sia **un posto solo** a
-- dirlo, e perché un eventuale quarto valore futuro produca un errore
-- esplicito invece di scomparire silenziosamente da tutte e tre le tab.
--
-- La deadline non compare: §8 è categorico — «PUBLISHED determina
-- l'appartenenza alle Attive, ma non prova che la Position sia ancora
-- candidabile.»
-- ============================================================

create or replace function public.society_position_group(p_status public.ad_status)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_status
    when 'draft'     then 'drafts'
    when 'published' then 'active'
    when 'closed'    then 'closed'
  end;
$$;

grant execute on function public.society_position_group(public.ad_status) to authenticated;

comment on function public.society_position_group(public.ad_status) is
  'DAS-REV-15 §8: Attive | Bozze | Chiuse. Deriva dal solo lifecycle: la '
  'ricezione candidature è una proiezione separata e non sposta una riga.';


-- ============================================================
-- SEZIONE 6 — intestazione del Centro e capability (§9)
--
-- «Il client riceve solo dati e azioni realmente autorizzati.»
--
-- `can_view_counts` è **separato** da `can_view`: §9 è categorico —
-- «Visualizzare Posizioni non implica visualizzare Candidature.» Il catalogo
-- DAS-REV-14 lo codifica già con due aree distinte (`positions` e
-- `applications`), quindi qui si leggono due chiavi diverse e non si deduce
-- la seconda dalla prima.
--
-- Una chiamata senza `positions_view` solleva `POSITIONS_CENTER_NOT_
-- AUTHORIZED`: §8 vieta di «presentare un 403 come elenco vuoto».
-- ============================================================

create or replace function public.fetch_society_positions_center(p_club_id uuid)
returns table (
  club_id             uuid,
  club_name           text,
  club_logo_url       text,
  club_is_verified    boolean,
  scope_label         text,
  can_create          boolean,
  can_view_counts     boolean,
  counts_scope_all    boolean,
  access_verified_at  timestamptz,
  data_revision       bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_caps  text[];
  v_now   timestamptz := timezone('utc', now());
  v_scope uuid[];
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_club_id is null
     or not exists (select 1 from public.clubs c where c.id = p_club_id) then
    raise exception 'POSITIONS_CENTER_NOT_AUTHORIZED';
  end if;

  -- §9: sessione, actor, Society, membership attiva, capability, scope.
  -- L'ordine conta: senza accesso attivo non si leggono nemmeno le chiavi.
  if not public.owns_club(p_club_id)
     and not public.club_access_is_active(p_club_id, v_uid) then
    raise exception 'POSITIONS_CENTER_NOT_AUTHORIZED';
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  if not ('positions_view' = any (v_caps)) then
    raise exception 'POSITIONS_CENTER_NOT_AUTHORIZED';
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, 'applications_view');

  return query
  select
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    public.dashboard_club_scope_label(p_club_id),
    /* §19: la CTA compare soltanto con capability di creazione. Il composer
       rivalida comunque: questo booleano decide la UI, non il permesso. */
    ('positions_create' = any (v_caps)) or ('society_manage_positions' = any (v_caps)),
    ('applications_view' = any (v_caps)),
    /* Serve al client per sapere se gli aggregati sono leggibili ovunque o
       solo su alcune squadre: nel secondo caso una riga senza conteggi non è
       un errore ma un perimetro. */
    ('applications_view' = any (v_caps)) and v_scope is null,
    v_now,
    greatest(
      (select coalesce(extract(epoch from max(ra.updated_at))::bigint, 0)
       from public.recruiting_ads ra where ra.club_id = p_club_id),
      (extract(epoch from c.updated_at)::bigint)
    )
  from public.clubs c
  where c.id = p_club_id;
end;
$$;

revoke all on function public.fetch_society_positions_center(uuid) from public;
grant execute on function public.fetch_society_positions_center(uuid) to authenticated;

comment on function public.fetch_society_positions_center(uuid) is
  'DAS-REV-15 §9: identità, scope e capability del Centro Posizioni. '
  'Lettura Posizioni e lettura Candidature sono due autorizzazioni distinte '
  'e viaggiano in due colonne distinte.';


-- ============================================================
-- SEZIONE 7 — opzioni del filtro per ambito (§14)
--
-- Le opzioni dipendono dalla **tab**, non dalla pagina caricata:
--
--   | Attive | Team interni attivi entro lo scope consentito             |
--   | Bozze  | + Team non attivi con bozze ancora leggibili              |
--   | Chiuse | + Team non attivi con storico consultabile                |
--
-- «Puoi includere Team attivi autorizzati senza posizioni e l'ambito SOCIETY
-- consultabile anche se vuoto, per consentire risultati vuoti contestuali.»
-- Per questo i Team attivi in scope compaiono sempre, mentre i non attivi
-- compaiono solo se hanno davvero contenuto in quel gruppo.
--
-- L'opzione SOCIETY **non** è «tutte le posizioni delle squadre»: seleziona
-- i soli incarichi con ambito SOCIETY, e compare solo con perimetro
-- Society-wide — uno scope limitato a Primavera non legge un incarico del
-- club (§9).
--
-- La riga `all` non viene emessa: è un'opzione costante del client. Emetterla
-- qui significherebbe poterla perdere con un errore di rete.
-- ============================================================

create or replace function public.fetch_society_position_filters(
  p_club_id uuid,
  p_group   text default 'active'
)
returns table (
  option_kind text,
  team_id     uuid,
  label       text,
  is_inactive boolean,
  sort_order  integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_caps  text[];
  v_scope uuid[];
  v_group text := coalesce(p_group, 'active');
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_group not in ('active', 'drafts', 'closed') then
    raise exception 'POSITIONS_GROUP_INVALID';
  end if;

  if not public.owns_club(p_club_id)
     and not public.club_access_is_active(p_club_id, v_uid) then
    return;
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  if not ('positions_view' = any (v_caps)) then
    return;
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, 'positions_view');

  return query
  -- Ambito SOCIETY: disponibile per il solo perimetro Society-wide.
  select
    'society'::text,
    null::uuid,
    'Intera società'::text,
    false,
    0
  where v_scope is null

  union all

  select
    'team'::text,
    ct.id,
    ct.name,
    ct.is_archived,
    1
  from public.club_teams ct
  where ct.club_id = p_club_id
    and (v_scope is null or ct.id = any (v_scope))
    and (
      not ct.is_archived
      /* Un Team non attivo resta un'opzione soltanto se in quella tab ha
         davvero qualcosa di leggibile: §13 chiede che lo storico sia
         raggiungibile, non che ogni squadra dismessa torni nel picker
         operativo delle Attive. */
      or exists (
        select 1
        from public.recruiting_ads ra
        where ra.team_id = ct.id
          and public.society_position_group(ra.status) = v_group
      )
    )
    /* Le Attive non offrono squadre disattivate: non vi si può operare e
       §15 vieta di proporvi una creazione. */
    and (v_group <> 'active' or not ct.is_archived)
  order by 4, 5, 3;
end;
$$;

revoke all on function public.fetch_society_position_filters(uuid, text) from public;
grant execute on function public.fetch_society_position_filters(uuid, text) to authenticated;

comment on function public.fetch_society_position_filters(uuid, text) is
  'DAS-REV-15 §14: opzioni di ambito per una tab. Intera società seleziona '
  'i soli incarichi SOCIETY e non equivale a Tutte le posizioni.';


-- ============================================================
-- SEZIONE 8 — cursore opaco vincolato alla query e all'istante
--
-- §16: «Usa un cursore opaco vincolato a query e autorizzazione. Non
-- riutilizzare il cursore di AC Como su un'altra Society o quello di Attive
-- su Bozze.»
--
-- Il token trasporta Society, gruppo, tipo di filtro, Team e l'istante
-- `as_of` congelato alla prima pagina. Il server rifiuta un token il cui
-- contesto non coincide con i parametri della richiesta: un cursore
-- manipolato non amplia il perimetro, che resta comunque ricalcolato dalle
-- capability a ogni pagina (§9 — «Un token passato dal client non
-- sostituisce la revalidation dei permessi»).
--
-- `as_of` è la risposta a §16 sulla stabilità: «Un ordinamento basato su
-- nuove/updated_at può cambiare.» Congelandolo, l'appartenenza delle righe e
-- il conteggio delle candidature di una stessa consultazione sono una
-- funzione pura dell'istante, quindi una candidatura arrivata durante lo
-- scorrimento non sposta una riga sotto il dito e non la duplica fra due
-- pagine. Il nuovo ordine entra al refresh esplicito, che è il punto sicuro
-- previsto da §21.
-- ============================================================

create or replace function public.society_positions_cursor_encode(
  p_club_id uuid,
  p_group   text,
  p_scope   text,
  p_team_id uuid,
  p_as_of   timestamptz,
  p_sort_key text
)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(convert_to(
    'v1|' || p_club_id::text
          || '|' || p_group
          || '|' || p_scope
          || '|' || coalesce(p_team_id::text, '-')
          || '|' || (extract(epoch from p_as_of) * 1000)::bigint::text
          || '|' || p_sort_key,
    'utf8'), 'base64');
$$;

grant execute on function public.society_positions_cursor_encode(uuid, text, text, uuid, timestamptz, text) to authenticated;

/**
 * Decodifica e **verifica**. Restituisce `(as_of, sort_key)` solo se il token
 * appartiene esattamente a questa query; altrimenti solleva, perché §16
 * vieta di «continuare con cursori obsoleti» e §15 vieta di convertire
 * silenziosamente una selezione arbitraria in un accesso più ampio.
 */
create or replace function public.society_positions_cursor_decode(
  p_cursor  text,
  p_club_id uuid,
  p_group   text,
  p_scope   text,
  p_team_id uuid,
  out as_of    timestamptz,
  out sort_key text
)
language plpgsql
immutable
set search_path = public
as $$
declare
  v_parts text[];
begin
  -- Tutto il parsing sta dentro la stessa guardia: un token manomesso che
  -- superi i controlli di contesto ma porti spazzatura nell'istante deve
  -- comunque produrre POSITIONS_CURSOR_INVALID, non un errore di cast.
  begin
    v_parts := string_to_array(convert_from(decode(p_cursor, 'base64'), 'utf8'), '|');

    if array_length(v_parts, 1) <> 7
       or v_parts[1] <> 'v1'
       or v_parts[2] <> p_club_id::text
       or v_parts[3] <> p_group
       or v_parts[4] <> p_scope
       or v_parts[5] <> coalesce(p_team_id::text, '-') then
      raise exception 'POSITIONS_CURSOR_INVALID';
    end if;

    as_of    := to_timestamp(v_parts[6]::bigint / 1000.0);
    sort_key := v_parts[7];
  exception when others then
    raise exception 'POSITIONS_CURSOR_INVALID';
  end;
end;
$$;

grant execute on function public.society_positions_cursor_decode(text, uuid, text, text, uuid) to authenticated;


-- ============================================================
-- SEZIONE 9 — pagina del Centro (§11, §12, §13, §16, §22)
--
-- Una sola lettura per tutte e tre le tab: cambiano il gruppo e la chiave di
-- ordinamento, non il dominio. Tre RPC avrebbero significato tre punti in cui
-- dimenticare un controllo di scope.
--
-- Ordinamenti di §16, applicati **server-side**:
--   Attive  prima le posizioni con nuove candidature autorizzate, poi
--           published_at decrescente, poi id;
--   Bozze   updated_at decrescente, poi id;
--   Chiuse  closed_at decrescente, date sconosciute in fondo, poi id.
--
-- «Per un actor senza diritto ai conteggi, non ordinare usando candidature
-- nascoste»: il flag `has_new` entra nella chiave soltanto quando l'actor è
-- autorizzato a leggerlo su quella riga. Senza quel diritto l'ordine è la
-- sola recency, che è un criterio autorizzato.
--
-- Il contesto sportivo ha due fonti **diverse e non intercambiabili**: le
-- righe correnti leggono la configurazione della stagione in corso, le righe
-- storiche leggono lo snapshot della prima pubblicazione (§13 — «Non
-- sostituire il campionato della posizione chiusa con quello corrente della
-- squadra»).
-- ============================================================

create or replace function public.fetch_society_positions_page(
  p_club_id uuid,
  p_group   text default 'active',
  p_scope   text default 'all',
  p_team_id uuid default null,
  p_cursor  text default null,
  p_limit   integer default 20
)
returns table (
  position_id        uuid,
  title              text,
  role_required      text,
  target_role        text,
  status             text,
  position_scope     text,
  team_id            uuid,
  team_name          text,
  team_is_inactive   boolean,
  context_label      text,
  season_label       text,
  published_at       timestamptz,
  updated_at         timestamptz,
  closed_at          timestamptz,
  receiving_closed   boolean,
  counts_available   boolean,
  applications_total integer,
  applications_new   integer,
  sort_key           text,
  next_cursor        text,
  as_of              timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_caps      text[];
  v_scope     uuid[];
  v_app_scope uuid[];
  v_app_view  boolean;
  v_group     text := coalesce(p_group, 'active');
  v_filter    text := coalesce(p_scope, 'all');
  v_limit     integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_season    text := public.current_season_id();
  v_as_of     timestamptz;
  v_after     text;
  v_now       timestamptz := timezone('utc', now());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_group not in ('active', 'drafts', 'closed') then
    raise exception 'POSITIONS_GROUP_INVALID';
  end if;

  if v_filter not in ('all', 'society', 'team') then
    raise exception 'POSITIONS_FILTER_INVALID';
  end if;

  -- §22: «Non usare un Team ID null ambiguo per significare sia Tutte sia
  -- Intera società.» Il tipo di filtro è esplicito e il Team ID vale solo
  -- per TEAM.
  if v_filter = 'team' and p_team_id is null then
    raise exception 'POSITIONS_FILTER_INVALID';
  end if;

  if v_filter <> 'team' and p_team_id is not null then
    raise exception 'POSITIONS_FILTER_INVALID';
  end if;

  if not public.owns_club(p_club_id)
     and not public.club_access_is_active(p_club_id, v_uid) then
    raise exception 'POSITIONS_CENTER_NOT_AUTHORIZED';
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  if not ('positions_view' = any (v_caps)) then
    raise exception 'POSITIONS_CENTER_NOT_AUTHORIZED';
  end if;

  v_scope     := public.dashboard_club_capability_scope(p_club_id, 'positions_view');
  v_app_view  := 'applications_view' = any (v_caps);
  v_app_scope := case when v_app_view
    then public.dashboard_club_capability_scope(p_club_id, 'applications_view')
  end;

  -- §15: «Una selezione arbitraria passata tramite query/deep link non va
  -- accettata o convertita silenziosamente in un accesso più ampio.» Un
  -- filtro fuori perimetro non diventa "tutte": diventa un errore.
  if v_filter = 'society' and v_scope is not null then
    raise exception 'POSITIONS_FILTER_NOT_AUTHORIZED';
  end if;

  if v_filter = 'team'
     and not (
       v_scope is null
       or p_team_id = any (v_scope)
     ) then
    raise exception 'POSITIONS_FILTER_NOT_AUTHORIZED';
  end if;

  if v_filter = 'team'
     and not exists (
       select 1 from public.club_teams ct
       where ct.id = p_team_id and ct.club_id = p_club_id
     ) then
    raise exception 'POSITIONS_FILTER_NOT_AUTHORIZED';
  end if;

  if p_cursor is null then
    v_as_of := v_now;
    v_after := null;
  else
    select d.as_of, d.sort_key
      into v_as_of, v_after
    from public.society_positions_cursor_decode(
      p_cursor, p_club_id, v_group, v_filter, p_team_id
    ) d;
  end if;

  return query
  with rows_in_scope as (
    select
      ra.id,
      nullif(btrim(ra.title), '')        as title,
      ra.role_required::text             as role_required,
      ra.target_role::text               as target_role,
      ra.status,
      ra.team_id,
      ra.published_at,
      ra.updated_at,
      ra.closed_at,
      ra.application_deadline_at,
      ct.name                            as team_name,
      coalesce(ct.is_archived, false)    as team_is_inactive,
      /* Contesto corrente: tipo e livello della stagione in corso. */
      cur_lvl.label                      as current_level_label,
      coalesce(cur_type.tier, ct.team_type) as current_tier,
      /* Contesto storico: la fotografia della prima pubblicazione. */
      snap_lvl.label                     as snapshot_level_label,
      snap_type.tier                     as snapshot_tier,
      ra.published_team_name             as snapshot_team_name,
      snap_season.label                  as snapshot_season_label,
      /* §9: l'aggregato è leggibile solo con `applications_view` nel
         perimetro di **questa** riga. Nessuna eccezione permissiva nel
         serializer del Centro. */
      (
        v_app_view
        and (
          v_app_scope is null
          or (ra.team_id is not null and ra.team_id = any (v_app_scope))
        )
      ) as counts_available
    from public.recruiting_ads ra
    left join public.club_teams ct
      on ct.id = ra.team_id
    left join public.club_team_seasons cur_cfg
      on cur_cfg.team_id = ct.id
     and cur_cfg.season_id = v_season
    left join public.team_levels cur_lvl on cur_lvl.id = cur_cfg.level_id
    left join public.team_types  cur_type on cur_type.id = cur_cfg.team_type_id
    left join public.team_levels snap_lvl on snap_lvl.id = ra.published_level_id
    left join public.team_types  snap_type on snap_type.id = ra.published_team_type_id
    left join public.seasons     snap_season on snap_season.id = ra.published_season_id
    where ra.club_id = p_club_id
      and public.society_position_group(ra.status) = v_group
      /* Istante congelato: l'appartenenza di una riga alla consultazione non
         cambia mentre si scorre. */
      and ra.created_at <= v_as_of
      /* Scope della capability, applicato **prima** di aggregare, ordinare e
         paginare (§9). */
      and (v_scope is null or (ra.team_id is not null and ra.team_id = any (v_scope)))
      /* Filtro di consultazione, che restringe e non amplia. */
      and (
        v_filter = 'all'
        or (v_filter = 'society' and ra.team_id is null)
        or (v_filter = 'team'    and ra.team_id = p_team_id)
      )
  ),
  with_counts as (
    select
      r.*,
      case when r.counts_available then (
        select count(*)::integer
        from public.recruiting_applications app
        where app.ad_id = r.id
          and app.status <> 'withdrawn'
          and app.created_at <= v_as_of
      ) end as applications_total,
      case when r.counts_available then (
        select count(*)::integer
        from public.recruiting_applications app
        where app.ad_id = r.id
          and app.status = 'submitted'
          and app.created_at <= v_as_of
      ) end as applications_new
    from rows_in_scope r
  ),
  keyed as (
    select
      w.*,
      case v_group
        when 'active' then
          (case when coalesce(w.applications_new, 0) > 0 then '0' else '1' end)
          || '|' || lpad((9999999999999
               - coalesce((extract(epoch from w.published_at) * 1000)::bigint, 0))::text, 13, '0')
          || '|' || w.id::text
        when 'drafts' then
          lpad((9999999999999
               - (extract(epoch from w.updated_at) * 1000)::bigint)::text, 13, '0')
          || '|' || w.id::text
        else
          (case when w.closed_at is null then '1' else '0' end)
          || '|' || lpad((9999999999999
               - coalesce((extract(epoch from w.closed_at) * 1000)::bigint, 0))::text, 13, '0')
          || '|' || w.id::text
      end as sort_key
    from with_counts w
  )
  select
    k.id,
    k.title,
    k.role_required,
    k.target_role,
    k.status::text,
    case when k.team_id is null then 'society' else 'team' end,
    k.team_id,
    /* §13: sulle righe storiche il nome è quello conservato, quando esiste.
       Una rinomina corrente non riscrive il significato storico. */
    case
      when k.team_id is null then null
      when v_group = 'closed' then coalesce(k.snapshot_team_name, k.team_name)
      else k.team_name
    end,
    k.team_is_inactive,
    case
      when k.team_id is null then null
      when v_group = 'closed' then
        coalesce(
          k.snapshot_level_label,
          case when k.snapshot_tier = 'youth' then 'Settore giovanile' end
        )
      else
        coalesce(
          k.current_level_label,
          case when k.current_tier = 'youth' then 'Settore giovanile' end
        )
    end,
    /* La stagione compare solo dove è un dato storico reale. */
    case when v_group = 'closed' then k.snapshot_season_label end,
    k.published_at,
    k.updated_at,
    k.closed_at,
    /* §17: ricezione, non lifecycle. Una PUBLISHED scaduta resta Attiva. */
    (k.status = 'published'
      and k.application_deadline_at is not null
      and v_now >= k.application_deadline_at),
    k.counts_available,
    k.applications_total,
    k.applications_new,
    k.sort_key,
    public.society_positions_cursor_encode(
      p_club_id, v_group, v_filter, p_team_id, v_as_of, k.sort_key
    ),
    v_as_of
  from keyed k
  where v_after is null or k.sort_key > v_after
  order by k.sort_key
  limit v_limit;
end;
$$;

revoke all on function public.fetch_society_positions_page(uuid, text, text, uuid, text, integer) from public;
grant execute on function public.fetch_society_positions_page(uuid, text, text, uuid, text, integer) to authenticated;

comment on function public.fetch_society_positions_page(uuid, text, text, uuid, text, integer) is
  'DAS-REV-15 §11-§16: una pagina del Centro Posizioni. Scope e filtro sono '
  'applicati prima di aggregare e paginare; i conteggi Candidature sono '
  'null quando non autorizzati e non viaggiano nascosti nel payload.';


-- ============================================================
-- SEZIONE 10 — dettaglio gestionale della Position (§18)
--
-- «Il dettaglio gestionale non deve aprire per errore la pagina visitor con
-- CTA Candidati dell'amministratore alla propria posizione.»
--
-- Il dettaglio pubblico esiste già (`fetch_position_detail`, dominio Cerca)
-- e resta quello che è: risolve la candidabilità del **visitatore**. Questa
-- lettura risolve invece il perimetro dell'**amministratore**, sullo stesso
-- Position ID e senza copiare l'oggetto (§18 — «Conserva Position ID
-- attraverso Dashboard, Cerca, profilo Society, dettaglio, candidature e
-- storico»).
--
-- Le azioni di scrittura — Modifica, Completa, Pubblica, Chiudi — sono di
-- DAS-REV-17 e DAS-REV-18. Qui vengono **risolte** (`can_edit`,
-- `can_publish`, `can_close`) perché la loro disponibilità appartiene al
-- permission domain, non al pack che le disegna: il Centro può così mostrare
-- la variante di sola consultazione senza indovinare.
-- ============================================================

create or replace function public.fetch_society_position_detail(p_ad_id uuid)
returns table (
  position_id        uuid,
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  club_is_verified   boolean,
  title              text,
  description        text,
  role_required      text,
  target_role        text,
  status             text,
  group_key          text,
  position_scope     text,
  team_id            uuid,
  team_name          text,
  team_is_inactive   boolean,
  context_label      text,
  season_label       text,
  region             text,
  age_min            integer,
  age_max            integer,
  compensation_summary text,
  published_at       timestamptz,
  updated_at         timestamptz,
  closed_at          timestamptz,
  deadline_at        timestamptz,
  deadline_timezone  text,
  receiving_closed   boolean,
  counts_available   boolean,
  applications_total integer,
  applications_new   integer,
  can_edit           boolean,
  can_publish        boolean,
  can_close          boolean,
  access_verified_at timestamptz,
  data_revision      bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_club    uuid;
  v_team    uuid;
  v_status  public.ad_status;
  v_caps    text[];
  v_manage  boolean;
  v_group   text;
  v_season  text := public.current_season_id();
  v_now     timestamptz := timezone('utc', now());
  v_app_ok  boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select ra.club_id, ra.team_id, ra.status
    into v_club, v_team, v_status
  from public.recruiting_ads ra
  where ra.id = p_ad_id;

  -- §18: «Non rivelare l'esistenza di una Position di altra Society tramite
  -- messaggi diversi non necessari.» Inesistente e non autorizzata producono
  -- lo stesso esito.
  if v_club is null then
    raise exception 'POSITION_NOT_AVAILABLE';
  end if;

  if not public.owns_club(v_club)
     and not public.club_access_is_active(v_club, v_uid) then
    raise exception 'POSITION_NOT_AVAILABLE';
  end if;

  v_caps := public.dashboard_club_capabilities(v_club);

  if not ('positions_view' = any (v_caps))
     or not public.society_position_in_scope(v_club, v_team, 'positions_view') then
    raise exception 'POSITION_NOT_AVAILABLE';
  end if;

  v_group  := public.society_position_group(v_status);
  v_manage := public.society_position_in_scope(v_club, v_team, 'positions_create')
           or public.society_position_in_scope(v_club, v_team, 'society_manage_positions');
  v_app_ok := ('applications_view' = any (v_caps))
           and public.society_position_in_scope(v_club, v_team, 'applications_view');

  return query
  select
    ra.id,
    ra.club_id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    nullif(btrim(ra.title), ''),
    nullif(btrim(ra.description), ''),
    ra.role_required::text,
    ra.target_role::text,
    ra.status::text,
    v_group,
    case when ra.team_id is null then 'society' else 'team' end,
    ra.team_id,
    case
      when ra.team_id is null then null
      when v_group = 'closed' then coalesce(ra.published_team_name, ct.name)
      else ct.name
    end,
    coalesce(ct.is_archived, false),
    case
      when ra.team_id is null then null
      when v_group = 'closed' then
        coalesce(snap_lvl.label,
          case when snap_type.tier = 'youth' then 'Settore giovanile' end)
      else
        coalesce(cur_lvl.label,
          case when coalesce(cur_type.tier, ct.team_type) = 'youth'
            then 'Settore giovanile' end)
    end,
    case when v_group = 'closed' then snap_season.label end,
    ra.region,
    ra.age_min,
    ra.age_max,
    nullif(btrim(ra.compensation_summary), ''),
    ra.published_at,
    ra.updated_at,
    ra.closed_at,
    ra.application_deadline_at,
    ra.application_deadline_timezone,
    (ra.status = 'published'
      and ra.application_deadline_at is not null
      and v_now >= ra.application_deadline_at),
    v_app_ok,
    case when v_app_ok then (
      select count(*)::integer
      from public.recruiting_applications app
      where app.ad_id = ra.id and app.status <> 'withdrawn'
    ) end,
    case when v_app_ok then (
      select count(*)::integer
      from public.recruiting_applications app
      where app.ad_id = ra.id and app.status = 'submitted'
    ) end,
    /* §13: «Una Position CLOSED non espone modifica, riapertura,
       duplicazione o eliminazione in V1.» */
    v_manage and v_status <> 'closed',
    /* §12: Pubblica compare soltanto se la bozza è valida e la deadline
       salvata non è già passata. La validità di contenuto resta del
       composer; qui si risolvono permesso, stato e scadenza. */
    v_manage
      and v_status = 'draft'
      and nullif(btrim(ra.title), '') is not null
      and (ra.application_deadline_at is null or v_now < ra.application_deadline_at),
    v_manage and v_status = 'published',
    v_now,
    (extract(epoch from ra.updated_at) * 1000)::bigint
  from public.recruiting_ads ra
  join public.clubs c on c.id = ra.club_id
  left join public.club_teams ct on ct.id = ra.team_id
  left join public.club_team_seasons cur_cfg
    on cur_cfg.team_id = ct.id and cur_cfg.season_id = v_season
  left join public.team_levels cur_lvl  on cur_lvl.id = cur_cfg.level_id
  left join public.team_types  cur_type on cur_type.id = cur_cfg.team_type_id
  left join public.team_levels snap_lvl  on snap_lvl.id = ra.published_level_id
  left join public.team_types  snap_type on snap_type.id = ra.published_team_type_id
  left join public.seasons     snap_season on snap_season.id = ra.published_season_id
  where ra.id = p_ad_id;
end;
$$;

revoke all on function public.fetch_society_position_detail(uuid) from public;
grant execute on function public.fetch_society_position_detail(uuid) to authenticated;

comment on function public.fetch_society_position_detail(uuid) is
  'DAS-REV-15 §18: variante gestionale del dettaglio, sullo stesso Position '
  'ID della superficie pubblica. Non espone la CTA Candidati e risolve le '
  'azioni autorizzate invece di dedurle dal nome del ruolo.';


-- ============================================================
-- SEZIONE 11 — indici di supporto
--
-- §23: «Applica scope prima del conteggio e della paginazione.» Gli indici
-- servono i due predicati che ogni pagina usa — Società + gruppo, e Società
-- + squadra — e il conteggio per annuncio del dominio Application.
-- ============================================================

create index if not exists recruiting_ads_club_status_published_idx
  on public.recruiting_ads (club_id, status, published_at desc);

create index if not exists recruiting_ads_club_status_updated_idx
  on public.recruiting_ads (club_id, status, updated_at desc);

create index if not exists recruiting_ads_club_team_status_idx
  on public.recruiting_ads (club_id, team_id, status);

create index if not exists recruiting_applications_ad_status_idx
  on public.recruiting_applications (ad_id, status);
