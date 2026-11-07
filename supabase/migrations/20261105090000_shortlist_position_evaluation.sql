-- ============================================================
-- DAS-REV-25 — Shortlist Position: aggiunta e valutazione
--
-- La 24 ha consegnato il core unico (`club_shortlists`,
-- `club_shortlist_entries`, `club_shortlist_membership_log`), il centro e la
-- **vista base** del pool. Questa migrazione completa le tre cose che la 24
-- aveva lasciato intenzionalmente minime (§3 della 25) e che il modello
-- attuale non sa esprimere:
--
--   1. una Position **DRAFT** persistita con scope valido può avere una
--      shortlist prima della pubblicazione (§9). Oggi
--      `fetch_shortlist_context` solleva `SHORTLIST_NOT_FOUND` su una bozza
--      e `fetch_shortlist_position_lists` la esclude con
--      `ad.status <> 'draft'`: non è un dettaglio di UI, è una porta chiusa
--      nel server;
--   2. il pool ha bisogno di **filtri, cursore e due conteggi** (§13, §14).
--      `fetch_shortlist_entries` è offset-based, senza filtri e senza
--      totali: la sua firma non può esprimere «1 di 3 profili» su più
--      pagine, perché il conteggio del batch non è il totale (§14);
--   3. la **rimozione** era un `delete` PostgREST diretto dal client. §19,
--      §21 e §26 la vogliono comando: autorizzata server-side, con ricevuta
--      di operazione e un esito idempotente che non decrementa due volte.
--
-- Riuso, non duplicazione (§7, §25, §30): nessuna nuova tabella, nessun
-- secondo enum, nessun secondo registro di idempotenza. Si riusano
-- `society_position_in_scope`, `shortlist_in_scope`, `shortlist_scope_team`,
-- `dashboard_club_capabilities`, `club_shortlist_membership_log` e le due
-- funzioni di ricevuta `application_operation_replay` /
-- `application_operation_record` (20261103090000), che sono il registro
-- operazioni del progetto e non un dettaglio del dominio Candidature.
--
-- Nessun insert in `public.notifications` in tutto il file: §29 — «Non
-- inviare notifiche o messaggi alla persona per apertura, aggiunta, filtro,
-- nota, cambio stato, priorità, rimozione o collegamento tecnico
-- dell'Application.»
--
-- Le funzioni riemesse qui (`fetch_shortlist_context`,
-- `fetch_shortlist_position_lists`, `update_shortlist_entry`,
-- `fetch_society_position_detail`) sono state copiate dalla **definizione
-- più recente effettiva** — rispettivamente 20261104090000 per le prime tre
-- e 20261102090000 per l'ultima — e non da una migrazione più vecchia con
-- lo stesso nome. È la trappola che il playbook segna come già costata una
-- regressione silenziosa.


-- ============================================================
-- SEZIONE 1 — indici per l'ordine e i filtri del pool (§14, §30)
--
-- §14 fissa l'ordine «created_at DESC, entry_id DESC» e §30 chiede indici
-- «per lista/persona, ordine created_at+ID e filtri solo quando necessari ai
-- volumi reali». L'ordine è quello di ogni pagina del pool: senza indice
-- ogni cursore diventa una sort completa della lista.
-- ============================================================

create index if not exists club_shortlist_entries_pool_idx
  on public.club_shortlist_entries (shortlist_id, created_at desc, id desc);


-- ============================================================
-- SEZIONE 2 — il contesto accetta una bozza persistita (§9)
--
-- «Una bozza già salvata con Position ID reale e scope definito può avere
-- una shortlist prima della pubblicazione.» Il ramo «nessun contenitore»
-- della 24 rifiutava `status = 'draft'`, quindi lo screen 12 era
-- irraggiungibile per costruzione.
--
-- Il limite che resta è quello che §9 impone davvero: **lo scope**. «Se il
-- draft non ha ancora il minimo contesto persistito necessario per
-- autorizzare lo scope, completa prima quel contesto nel flusso Position;
-- non assumere Intera società.» Una bozza senza `position_scope_type` e
-- senza `team_id` non ha un perimetro, e autorizzarla come Society-wide
-- sarebbe esattamente l'assunzione vietata: solleva
-- `SHORTLIST_SCOPE_UNDEFINED`.
--
-- Due colonne OUT nuove:
--   · `is_draft` — la label neutra **Bozza** di §9, che `is_closed` da sola
--     non può rappresentare;
--   · `can_view_notes` — §8 distingue «Leggere note interne» da
--     «Visualizzare la shortlist», e il catalogo DAS-REV-14 ha due chiavi
--     separate (`shortlist_view`, `shortlist_add_notes`). Il client ne ha
--     bisogno per non costruire un'anteprima nota che il server non
--     restituisce.
--
-- `can_view_evaluation` **non** esiste come colonna: §8 assegna priorità e
-- stato alla capacità «Visualizzare la shortlist nel relativo scope → entry
-- e dati di valutazione ammessi», quindi chi è arrivato fin qui li legge
-- per definizione. Documentarlo qui è la «risoluzione documentata» che §8
-- chiede quando una lettura è inclusa in una capability più ampia.
-- ============================================================

drop function if exists public.fetch_shortlist_context(uuid, uuid);

create or replace function public.fetch_shortlist_context(
  p_shortlist_id uuid default null,
  p_position_id  uuid default null
)
returns table (
  shortlist_id   uuid,
  club_id        uuid,
  list_type      text,
  position_id    uuid,
  title          text,
  scope_label    text,
  profiles_count bigint,
  is_closed      boolean,
  is_draft       boolean,
  can_add_profiles    boolean,
  can_add_notes       boolean,
  can_view_notes      boolean,
  can_edit_status     boolean,
  can_remove_profiles boolean,
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
  v_list  public.club_shortlists%rowtype;
  v_ad    public.recruiting_ads%rowtype;
  v_team  uuid;
  v_club  uuid;
  v_caps  text[];
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  /* Alias obbligatorio: `position_id` è anche una colonna OUT di questa
     `returns table`, e in plpgsql una referenza non qualificata diventa
     «column reference is ambiguous» a runtime. */
  if p_shortlist_id is not null then
    select * into v_list from public.club_shortlists cs0 where cs0.id = p_shortlist_id;
  elsif p_position_id is not null then
    select * into v_list from public.club_shortlists cs0 where cs0.position_id = p_position_id;
  else
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  if v_list.id is null then
    /* Nessun contenitore: può ancora essere una Position legittima senza
       profili. §9 — «Una route per position_id può leggere il contesto
       autorizzato e una lista vuota senza creare un record.» */
    if p_position_id is null then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    select * into v_ad from public.recruiting_ads where id = p_position_id;

    if not found then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    /* §9: una bozza senza perimetro persistito non è autorizzabile, e
       l'errore è distinto da «non esiste» perché il rimedio è diverso —
       completare il contesto nel flusso Position, non cercare altrove. */
    if v_ad.status = 'draft'
       and v_ad.position_scope_type is distinct from 'society'
       and v_ad.team_id is null then
      raise exception 'SHORTLIST_SCOPE_UNDEFINED';
    end if;

    if not public.society_position_in_scope(v_ad.club_id, v_ad.team_id, 'shortlist_view') then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    v_caps := public.dashboard_club_capabilities(v_ad.club_id);

    shortlist_id   := null;
    club_id        := v_ad.club_id;
    list_type      := 'position';
    position_id    := v_ad.id;
    title          := coalesce(
      nullif(btrim(v_ad.custom_role_name), ''),
      (select pr.label from public.position_roles pr where pr.id = v_ad.structured_role_id),
      nullif(btrim(v_ad.title), ''),
      'Posizione'
    );
    scope_label    := case
      when v_ad.position_scope_type = 'society' then 'Intera società'
      when v_ad.status = 'closed' then coalesce(
        v_ad.published_team_name,
        (select ct.name from public.club_teams ct where ct.id = v_ad.team_id)
      )
      else (select ct.name from public.club_teams ct where ct.id = v_ad.team_id)
    end;
    profiles_count := 0;
    is_closed      := v_ad.status = 'closed';
    is_draft       := v_ad.status = 'draft';
    can_add_profiles    := 'shortlist_add_profiles' = any (v_caps);
    can_add_notes       := 'shortlist_add_notes' = any (v_caps);
    can_view_notes      := 'shortlist_add_notes' = any (v_caps);
    can_edit_status     := 'shortlist_edit_status' = any (v_caps);
    can_remove_profiles := 'shortlist_remove_profiles' = any (v_caps);
    access_verified_at  := timezone('utc', now());
    data_revision       := 0;
    return next;

    return;
  end if;

  v_club := v_list.club_id;

  if v_list.list_type = 'position' then
    select * into v_ad from public.recruiting_ads where id = v_list.position_id;
    v_team := v_ad.team_id;
  else
    v_team := v_list.team_id;
  end if;

  if not public.society_position_in_scope(v_club, v_team, 'shortlist_view') then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  v_caps := public.dashboard_club_capabilities(v_club);

  shortlist_id := v_list.id;
  club_id      := v_club;
  list_type    := v_list.list_type;
  position_id  := v_list.position_id;
  title        := case
    when v_list.list_type = 'position' then coalesce(
      nullif(btrim(v_ad.custom_role_name), ''),
      (select pr.label from public.position_roles pr where pr.id = v_ad.structured_role_id),
      nullif(btrim(v_ad.title), ''),
      'Posizione'
    )
    else v_list.name
  end;
  scope_label := case
    when v_list.list_type = 'position' then case
      when v_ad.position_scope_type = 'society' then 'Intera società'
      when v_ad.status = 'closed' then coalesce(
        v_ad.published_team_name,
        (select ct.name from public.club_teams ct where ct.id = v_ad.team_id)
      )
      else (select ct.name from public.club_teams ct where ct.id = v_ad.team_id)
    end
    when v_list.team_id is not null then
      (select ct.name from public.club_teams ct where ct.id = v_list.team_id)
    when v_list.scope = 'prima_squadra' then 'Prima squadra'
    when v_list.scope = 'juniores'      then 'Juniores'
    when v_list.scope = 'under_17'      then 'Under 17'
    when v_list.scope = 'under_15'      then 'Under 15'
    else 'Intera società'
  end;
  profiles_count := (
    select count(*) from public.club_shortlist_entries e where e.shortlist_id = v_list.id
  );
  is_closed := v_list.list_type = 'position' and v_ad.status = 'closed';
  is_draft  := v_list.list_type = 'position' and v_ad.status = 'draft';
  can_add_profiles    := 'shortlist_add_profiles' = any (v_caps);
  can_add_notes       := 'shortlist_add_notes' = any (v_caps);
  can_view_notes      := 'shortlist_add_notes' = any (v_caps);
  can_edit_status     := 'shortlist_edit_status' = any (v_caps);
  can_remove_profiles := 'shortlist_remove_profiles' = any (v_caps);
  access_verified_at  := timezone('utc', now());
  data_revision := (extract(epoch from v_list.last_activity_at) * 1000)::bigint;
  return next;
end;
$$;

revoke all on function public.fetch_shortlist_context(uuid, uuid) from public;
grant execute on function public.fetch_shortlist_context(uuid, uuid) to authenticated;

comment on function public.fetch_shortlist_context(uuid, uuid) is
  'DAS-REV-25 §9: contesto della lista per id o per Position, bozza '
  'persistita compresa. Non materializza nulla: una Position senza '
  'contenitore restituisce profiles_count 0 e shortlist_id null.';


-- ============================================================
-- SEZIONE 3 — il centro accoglie le bozze con entry (§9)
--
-- «Le liste Position con zero profili restano assenti dal centro, incluse
-- quelle delle bozze. Se una DRAFT persistita possiede entry accessibili,
-- includila nella sezione Per posizione con label neutra Bozza. Ordine dei
-- gruppi di liste: PUBLISHED → DRAFT → CLOSED; all'interno di ogni gruppo
-- conserva attività reale decrescente e spareggio stabile della 24.»
--
-- Due differenze rispetto alla 24, e nessun'altra: cade il filtro
-- `ad.status <> 'draft'`, e `sort_group` passa da due valori (aperta/chiusa)
-- a tre. Il keyset resta esplicito e non una row-comparison, per la ragione
-- già documentata nella 24: `sort_group` sale e `last_activity_at` scende.
-- ============================================================

drop function if exists public.fetch_shortlist_position_lists(uuid, integer, text);

create or replace function public.fetch_shortlist_position_lists(
  p_club_id uuid,
  p_limit   integer default 20,
  p_cursor  text    default null
)
returns table (
  shortlist_id   uuid,
  position_id    uuid,
  title          text,
  scope_label    text,
  profiles_count bigint,
  is_closed      boolean,
  is_draft       boolean,
  last_activity_at timestamptz,
  next_cursor    text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_limit     integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_sort      integer;
  v_activity  timestamptz;
  v_id        uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_cursor is not null and btrim(p_cursor) <> '' then
    v_sort     := split_part(p_cursor, '|', 1)::integer;
    v_activity := split_part(p_cursor, '|', 2)::timestamptz;
    v_id       := split_part(p_cursor, '|', 3)::uuid;
  end if;

  return query
  with visible as (
    select
      cs.id,
      cs.position_id,
      ad.status,
      ad.team_id,
      ad.position_scope_type,
      ad.published_team_name,
      ad.custom_role_name,
      ad.title,
      ad.structured_role_id,
      ct.name as team_name,
      cs.last_activity_at,
      (
        select count(*)
        from public.club_shortlist_entries e
        where e.shortlist_id = cs.id
      ) as entries,
      /* §9: PUBLISHED → DRAFT → CLOSED. Il numero è l'ordine, non un
         codice di stato esposto: la label resta `is_draft`/`is_closed`. */
      case ad.status
        when 'closed' then 2
        when 'draft'  then 1
        else 0
      end as sort_group
    from public.club_shortlists cs
    join public.recruiting_ads ad on ad.id = cs.position_id
    left join public.club_teams ct on ct.id = ad.team_id
    where cs.club_id = p_club_id
      and cs.list_type = 'position'
      /* §24 della 24: filtro autorizzativo **prima** di contare e paginare. */
      and public.society_position_in_scope(cs.club_id, ad.team_id, 'shortlist_view')
  ),
  page as (
    select *
    from visible v
    /* §9: «le liste Position con zero profili restano assenti dal centro,
       incluse quelle delle bozze». */
    where v.entries > 0
      and (
        v_sort is null
        or v.sort_group > v_sort
        or (
          v.sort_group = v_sort
          and (
            v.last_activity_at < v_activity
            or (v.last_activity_at = v_activity and v.id < v_id)
          )
        )
      )
    order by v.sort_group asc, v.last_activity_at desc, v.id desc
    limit v_limit + 1
  ),
  trimmed as (
    select p.*, row_number() over (
      order by p.sort_group asc, p.last_activity_at desc, p.id desc
    ) as rn
    from page p
  )
  select
    t.id,
    t.position_id,
    coalesce(
      nullif(btrim(t.custom_role_name), ''),
      pr.label,
      nullif(btrim(t.title), ''),
      'Posizione'
    ),
    case
      when t.position_scope_type = 'society' then 'Intera società'
      when t.status = 'closed' then coalesce(t.published_team_name, t.team_name)
      else t.team_name
    end,
    t.entries,
    t.status = 'closed',
    t.status = 'draft',
    t.last_activity_at,
    case
      when (select count(*) from trimmed) > v_limit and t.rn = v_limit
        then t.sort_group::text || '|' || t.last_activity_at::text || '|' || t.id::text
    end
  from trimmed t
  left join public.position_roles pr on pr.id = t.structured_role_id
  where t.rn <= v_limit
  order by t.rn;
end;
$$;

revoke all on function public.fetch_shortlist_position_lists(uuid, integer, text) from public;
grant execute on function public.fetch_shortlist_position_lists(uuid, integer, text) to authenticated;

comment on function public.fetch_shortlist_position_lists(uuid, integer, text) is
  'DAS-REV-25 §9: gruppo «Per posizione» del centro, con le bozze che '
  'possiedono entry accessibili. Ordine dei gruppi PUBLISHED → DRAFT → '
  'CLOSED e, dentro ciascuno, attività reale decrescente.';


-- ============================================================
-- SEZIONE 4 — normalizzazione dei filtri (§13)
--
-- «Normalizza selezioni duplicate e ordine dei valori nella query/cache. La
-- selezione di tutti i valori ammessi in una dimensione equivale a nessuna
-- restrizione e può essere normalizzata al set vuoto.»
--
-- E §13 di nuovo, sul rifiuto: «Enum non consentite o combinazioni
-- sintatticamente invalide sono rifiutate dal backend, non ignorate
-- silenziosamente.» Ignorare un valore sconosciuto allargherebbe il
-- risultato in silenzio — il contrario di quello che l'actor ha chiesto.
--
-- `null` in uscita significa «nessuna restrizione su questa dimensione», ed
-- è lo stesso valore prodotto da un array vuoto e da un array completo:
-- §13 — «Nessuna scelta in una dimensione significa nessuna restrizione per
-- quella dimensione.»
-- ============================================================

create or replace function public.shortlist_filter_normalize(
  p_values  text[],
  p_allowed text[]
)
returns text[]
language plpgsql
immutable
as $$
declare
  v_clean text[];
  v_value text;
begin
  if p_values is null then
    return null;
  end if;

  foreach v_value in array p_values loop
    if v_value is null or not (v_value = any (p_allowed)) then
      raise exception 'SHORTLIST_FILTER_INVALID';
    end if;
  end loop;

  select coalesce(array_agg(distinct v order by v), '{}'::text[])
    into v_clean
  from unnest(p_values) as v;

  if cardinality(v_clean) = 0
     or cardinality(v_clean) = cardinality(p_allowed) then
    return null;
  end if;

  return v_clean;
end;
$$;

revoke all on function public.shortlist_filter_normalize(text[], text[]) from public;
/* Interna alle letture: non è un endpoint. */

comment on function public.shortlist_filter_normalize(text[], text[]) is
  'DAS-REV-25 §13: valida, deduplica e ordina i valori di una dimensione di '
  'filtro. null = nessuna restrizione, anche quando sono selezionati tutti '
  'i valori ammessi.';


-- ============================================================
-- SEZIONE 5 — lettura del pool: filtri, due conteggi, cursore (§13, §14, §25)
--
-- §25: «Lettura pool Position. Input: position_id o lista canonica, filtri
-- validati, cursore e contesto autenticato. Output: contesto
-- Position/Society autorizzato, totale accessibile, totale filtrato, entry
-- della pagina, next cursor, versione/snapshot e capability pertinenti.»
--
-- Una `returns table` non può portare quell'output: con zero corrispondenze
-- non restituirebbe nessuna riga, e con essa perderebbe proprio i due numeri
-- che lo screen 16 deve mostrare — **0 di 3 profili**. §14 è esplicito:
-- «Questi numeri non sono il conteggio del batch già caricato.» Da qui il
-- `jsonb`: un oggetto solo, con `items` dentro.
--
-- Questa è la lettura canonica del pool per **entrambi** i tipi di lista.
-- `fetch_shortlist_entries` resta in vita perché serve il dettaglio CUSTOM
-- di RET-07, che la 25 non tocca (§3: «Mantieni i percorsi dal profilo e
-- CUSTOM già esistenti e il loro core»); la 27, che possiede le liste
-- personalizzate, può spostarlo qui senza una terza funzione.
--
-- Ordine: §14 — «created_at DESC, entry_id DESC, usando il timestamp server
-- dell'inserimento originario. Non riordinare per priorità, stato, sorgente,
-- nota o updated_at.»
--
-- Il cursore porta l'impronta dei filtri e l'id della lista, e viene
-- **verificato**: §14 — «Un cursore di altra Society/lista o query non può
-- essere riutilizzato per ottenere dati.»
-- ============================================================

create or replace function public.fetch_shortlist_pool_page(
  p_shortlist_id uuid,
  p_priorities   text[] default null,
  p_statuses     text[] default null,
  p_cursor       text   default null,
  p_limit        integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_list       public.club_shortlists%rowtype;
  v_team       uuid;
  v_limit      integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_priorities text[];
  v_statuses   text[];
  v_fingerprint text;
  v_cursor_at  timestamptz;
  v_cursor_id  uuid;
  v_total      bigint;
  v_filtered   bigint;
  v_can_notes  boolean;
  v_can_apps   boolean;
  v_can_edit   boolean;
  v_can_remove boolean;
  v_items      jsonb;
  v_next       text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_list from public.club_shortlists cs0 where cs0.id = p_shortlist_id;

  if not found then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  v_team := public.shortlist_scope_team(v_list.id);

  if not public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_view') then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  /* §8: «Un filtro non può diventare un modo per dedurre un campo che
     l'actor non può leggere … il backend rifiuta filtri su campi non
     autorizzati anche se il client nasconde il controllo.» Priorità e stato
     appartengono alla capacità «Visualizzare la shortlist nel relativo
     scope» del catalogo §8, già verificata sopra: chi è arrivato qui li
     legge, e quindi li può filtrare. La nota non è una dimensione di
     filtro, e infatti non compare fra i parametri. */
  v_priorities := public.shortlist_filter_normalize(
    p_priorities, array['alta', 'media', 'bassa', 'none']
  );
  v_statuses := public.shortlist_filter_normalize(
    p_statuses,
    array['da_valutare', 'interessante', 'da_contattare', 'contattato',
          'non_prioritario', 'scartato']
  );

  v_fingerprint := md5(
    coalesce(array_to_string(v_priorities, ','), '*') || '#' ||
    coalesce(array_to_string(v_statuses, ','), '*')
  );

  if p_cursor is not null and btrim(p_cursor) <> '' then
    /* §14: il cursore è validato contro lista e filtri. Un cursore di
       un'altra query non «degrada»: viene rifiutato, così il client ne
       chiede uno nuovo coerente invece di mescolare pagine incompatibili. */
    if split_part(p_cursor, '|', 1) is distinct from p_shortlist_id::text
       or split_part(p_cursor, '|', 2) is distinct from v_fingerprint then
      raise exception 'SHORTLIST_CURSOR_INVALID';
    end if;

    v_cursor_at := split_part(p_cursor, '|', 3)::timestamptz;
    v_cursor_id := split_part(p_cursor, '|', 4)::uuid;
  end if;

  v_can_notes  := public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_add_notes');
  v_can_apps   := public.society_position_in_scope(v_list.club_id, v_team, 'applications_view');
  v_can_edit   := public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_edit_status');
  v_can_remove := public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_remove_profiles');

  /* §14: «Il backend applica: autorizzazione e visibilità → filtri →
     ordinamento stabile → pagina. Restituisce il numero totale accessibile
     della lista e, con filtri, il totale delle corrispondenze.» I due
     conteggi usano lo stesso perimetro delle righe, non una query a parte
     con condizioni proprie. */
  select
    count(*),
    count(*) filter (
      where (v_priorities is null
             or coalesce(e.priority, 'none') = any (v_priorities))
        and (v_statuses is null
             or e.evaluation_status = any (v_statuses))
    )
  into v_total, v_filtered
  from public.club_shortlist_entries e
  where e.shortlist_id = p_shortlist_id;

  with page as (
    select e.*
    from public.club_shortlist_entries e
    where e.shortlist_id = p_shortlist_id
      and (v_priorities is null
           or coalesce(e.priority, 'none') = any (v_priorities))
      and (v_statuses is null
           or e.evaluation_status = any (v_statuses))
      and (
        v_cursor_at is null
        or e.created_at < v_cursor_at
        or (e.created_at = v_cursor_at and e.id < v_cursor_id)
      )
    order by e.created_at desc, e.id desc
    limit v_limit + 1
  ),
  trimmed as (
    select p.*, row_number() over (order by p.created_at desc, p.id desc) as rn
    from page p
  ),
  rows as (
    select
      t.rn,
      jsonb_build_object(
        'entry_id',  t.id,
        'person_id', t.player_profile_id,
        'name',      prof.full_name,
        'avatar_url', prof.avatar_url,
        'role',      prof.role::text,
        'primary_position', pp.primary_position::text,
        /* §12: «contesto corrente essenziale». Deriva dalla funzione
           canonica del pack Candidature, che distingue «Svincolato»
           dichiarato da «non determinabile» e restituisce null nel secondo
           caso — §12 vieta di sostituire un dato assente con un valore
           demo, e questa è la stessa regola già applicata alle righe
           candidatura. */
        'situation', public.profile_current_situation(t.player_profile_id),
        'priority',  t.priority,
        'evaluation_status', t.evaluation_status,
        'revision',  t.revision,
        /* §12: «eventuale anteprima della nota in una sola riga» e «Non
           scaricare note complete in un endpoint che serve solo una lista
           con preview». Il troncamento è server-side: la riga non riceve
           mai il testo integrale. */
        'note_preview', case
          when v_can_notes and nullif(btrim(t.internal_note), '') is not null
            then left(regexp_replace(btrim(t.internal_note), '\s+', ' ', 'g'), 120)
        end,
        /* §16: l'origine è audit storico; «se la dicitura storica Da
           candidatura rivelerebbe una relazione Application non
           autorizzata, ometti quella dicitura dalla proiezione di quell
           actor». `profile` non rivela nulla e resta. */
        'created_source', case
          when t.created_source = 'application' and not v_can_apps then 'unknown'
          else t.created_source
        end,
        /* §16: la relazione **corrente**, distinta dall'origine. `null`
           significa «non autorizzato a saperlo» e §16 vieta di tradurlo in
           «non si è candidato». */
        'application_state', case
          when not v_can_apps then null
          when t.application_id is null then 'none'
          when app.status = 'withdrawn' then 'withdrawn'
          else 'active'
        end
      ) as item
    from trimmed t
    join public.profiles prof on prof.id = t.player_profile_id
    left join public.player_profiles pp on pp.profile_id = t.player_profile_id
    left join public.recruiting_applications app on app.id = t.application_id
    where t.rn <= v_limit
  )
  select
    coalesce(jsonb_agg(r.item order by r.rn), '[]'::jsonb),
    (
      select p_shortlist_id::text || '|' || v_fingerprint || '|'
             || t2.created_at::text || '|' || t2.id::text
      from trimmed t2
      where t2.rn = v_limit
        and (select count(*) from trimmed) > v_limit
    )
  into v_items, v_next
  from rows r;

  return jsonb_build_object(
    'shortlist_id', p_shortlist_id,
    'total',        v_total,
    'filtered',     v_filtered,
    'filters_applied', (v_priorities is not null or v_statuses is not null),
    'priorities',   to_jsonb(v_priorities),
    'statuses',     to_jsonb(v_statuses),
    'next_cursor',  v_next,
    'can_view_notes',   v_can_notes,
    'can_view_applications', v_can_apps,
    'can_edit_status',  v_can_edit,
    'can_remove',       v_can_remove,
    'access_verified_at', timezone('utc', now()),
    'items',        coalesce(v_items, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.fetch_shortlist_pool_page(uuid, text[], text[], text, integer) from public;
grant execute on function public.fetch_shortlist_pool_page(uuid, text[], text[], text, integer) to authenticated;

comment on function public.fetch_shortlist_pool_page(uuid, text[], text[], text, integer) is
  'DAS-REV-25 §13, §14, §25: pagina del pool con filtri validati, totale '
  'accessibile e totale filtrato calcolati sullo stesso perimetro delle '
  'righe, ordine created_at DESC + id DESC e cursore legato a lista e '
  'filtri.';


-- ============================================================
-- SEZIONE 6 — lettura della entry (§15, §16, §25)
--
-- §25: «Lettura entry. Input: entry_id; output minimo autorizzato con dati
-- persona live, valutazione e nota se leggibili, origine ammessa, audit di
-- aggiunta, eventuale Application accessibile, capability, entry
-- version/generation. Il lookup verifica la catena entry→lista→Position→
-- Society.»
--
-- Due modi di indirizzare la stessa entry, non due funzioni: `p_entry_id`
-- dal pool, `p_application_id` dallo sheet §11 del dettaglio candidatura,
-- che conosce la candidatura e non la membership. Lo sheet deriva così
-- persona e Position **server-side**, come §10 pretende per il comando di
-- aggiunta; una seconda API di membership è esplicitamente vietata (§3).
--
-- `p_with_note` esiste per §11: «Non caricare l'intera nota privata per
-- riempire lo sheet.» È una proiezione più stretta della stessa lettura,
-- non un endpoint diverso.
--
-- §15: «Date e autore non vengono inventati quando assenti nei dati
-- precedenti; usa il fallback neutro canonico per un actor non più
-- disponibile senza collegare la persona a un profilo diverso.» Qui il
-- fallback è `added_by_name = null`: il client mostra la sola data e non
-- sostituisce l'autore con il gestore corrente (QA065).
-- ============================================================

create or replace function public.fetch_shortlist_entry(
  p_entry_id       uuid default null,
  p_application_id uuid default null,
  p_with_note      boolean default true
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_entry      public.club_shortlist_entries%rowtype;
  v_list       public.club_shortlists%rowtype;
  v_ad         public.recruiting_ads%rowtype;
  v_app        public.recruiting_applications%rowtype;
  v_team       uuid;
  v_can_notes  boolean;
  v_can_apps   boolean;
  v_can_edit   boolean;
  v_can_remove boolean;
  v_person     public.profiles%rowtype;
  v_adder      text;
  v_position   text;
  v_scope      text;
  v_current    text;
  v_role_pos   text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_entry_id is not null then
    select * into v_entry from public.club_shortlist_entries e0 where e0.id = p_entry_id;
  elsif p_application_id is not null then
    /* La catena parte dalla candidatura: Position della candidatura →
       contenitore POSITION di quella Position → membership della persona
       che si è candidata. Nessun riferimento arriva dal client. */
    select e0.* into v_entry
    from public.recruiting_applications a0
    join public.club_shortlists cs0
      on cs0.position_id = a0.ad_id and cs0.list_type = 'position'
    join public.club_shortlist_entries e0
      on e0.shortlist_id = cs0.id and e0.player_profile_id = a0.applicant_profile_id
    where a0.id = p_application_id;
  else
    raise exception 'SHORTLIST_ENTRY_NOT_FOUND';
  end if;

  if v_entry.id is null then
    raise exception 'SHORTLIST_ENTRY_NOT_FOUND';
  end if;

  select * into v_list from public.club_shortlists cs0 where cs0.id = v_entry.shortlist_id;

  if not found then
    raise exception 'SHORTLIST_ENTRY_NOT_FOUND';
  end if;

  v_team := public.shortlist_scope_team(v_list.id);

  if not public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_view') then
    /* §28: «Contenuto non disponibile … senza rivelare risorse altrui.»
       Negata e inesistente producono lo stesso errore. */
    raise exception 'SHORTLIST_ENTRY_NOT_FOUND';
  end if;

  v_can_notes  := public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_add_notes');
  v_can_apps   := public.society_position_in_scope(v_list.club_id, v_team, 'applications_view');
  v_can_edit   := public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_edit_status');
  v_can_remove := public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_remove_profiles');

  if v_list.list_type = 'position' then
    select * into v_ad from public.recruiting_ads where id = v_list.position_id;

    v_position := coalesce(
      nullif(btrim(v_ad.custom_role_name), ''),
      (select pr.label from public.position_roles pr where pr.id = v_ad.structured_role_id),
      nullif(btrim(v_ad.title), ''),
      'Posizione'
    );
    v_scope := case
      when v_ad.position_scope_type = 'society' then 'Intera società'
      when v_ad.status = 'closed' then coalesce(
        v_ad.published_team_name,
        (select ct.name from public.club_teams ct where ct.id = v_ad.team_id)
      )
      else (select ct.name from public.club_teams ct where ct.id = v_ad.team_id)
    end;
  else
    v_position := v_list.name;
    v_scope := case
      when v_list.team_id is not null then
        (select ct.name from public.club_teams ct where ct.id = v_list.team_id)
      else 'Intera società'
    end;
  end if;

  select * into v_person from public.profiles where id = v_entry.player_profile_id;

  select pp.primary_position::text into v_role_pos
  from public.player_profiles pp where pp.profile_id = v_entry.player_profile_id;

  v_current := public.profile_current_situation(v_entry.player_profile_id);

  select pr2.full_name into v_adder
  from public.profiles pr2 where pr2.id = v_entry.added_by_profile_id;

  if v_entry.application_id is not null then
    select * into v_app from public.recruiting_applications where id = v_entry.application_id;
  end if;

  return jsonb_build_object(
    'entry_id',     v_entry.id,
    'shortlist_id', v_list.id,
    'club_id',      v_list.club_id,
    'position_id',  v_list.position_id,
    'person_id',    v_entry.player_profile_id,
    'name',         coalesce(v_person.full_name, 'Profilo'),
    'avatar_url',   v_person.avatar_url,
    'role',         v_person.role::text,
    'primary_position', v_role_pos,
    'situation',    v_current,
    'position_title', v_position,
    'scope_label',  v_scope,
    'is_closed',    v_list.list_type = 'position' and v_ad.status = 'closed',
    'is_draft',     v_list.list_type = 'position' and v_ad.status = 'draft',
    'priority',     v_entry.priority,
    'evaluation_status', v_entry.evaluation_status,
    'revision',     v_entry.revision,
    /* §15: il testo integrale **solo** a chi lo può leggere, e solo quando
       la superficie lo richiede (§11 per lo sheet). `note_available` dice
       al client se l'assenza è un permesso o una nota vuota: §12 vieta di
       usare «Nessuna nota aggiunta.» per una nota nascosta dai permessi. */
    'note',           case when v_can_notes and p_with_note then v_entry.internal_note end,
    'note_available', v_can_notes,
    'created_source', case
      when v_entry.created_source = 'application' and not v_can_apps then 'unknown'
      else v_entry.created_source
    end,
    'added_by_name', v_adder,
    'created_at',    v_entry.created_at,
    'application_id', case when v_can_apps then v_entry.application_id end,
    'application_state', case
      when not v_can_apps then null
      when v_entry.application_id is null then 'none'
      when v_app.status = 'withdrawn' then 'withdrawn'
      else 'active'
    end,
    'can_edit_status', v_can_edit,
    'can_edit_note',   v_can_notes,
    'can_view_notes',  v_can_notes,
    'can_remove',      v_can_remove,
    'can_view_applications', v_can_apps,
    'access_verified_at', timezone('utc', now())
  );
end;
$$;

revoke all on function public.fetch_shortlist_entry(uuid, uuid, boolean) from public;
grant execute on function public.fetch_shortlist_entry(uuid, uuid, boolean) to authenticated;

comment on function public.fetch_shortlist_entry(uuid, uuid, boolean) is
  'DAS-REV-25 §15, §16, §25: scheda interna della membership. Indirizzabile '
  'per entry o per candidatura (lo sheet §11 non conosce la membership). '
  'Nota, metadata Application e origine seguono capability distinte.';


-- ============================================================
-- SEZIONE 7 — limite della nota interna (§18)
--
-- «Riutilizza il limite massimo e le regole del campo nota interno già
-- esistente. Il limite deve essere unico e disponibile a backend/client; non
-- assegnare numeri diversi ai due ingressi. Se il contratto non espone
-- ancora il limite, centralizzalo coerentemente con i vincoli del campo/
-- storage e documentalo prima del rilascio.»
--
-- Il contratto non lo esponeva: `club_shortlist_entries.internal_note` è
-- `text` senza vincolo, e nessun client ne imponeva uno. Il limite nasce
-- qui, **unico**, e il client lo legge dalla stessa costante (vedi
-- `shortlist-presentation.ts`).
--
-- Non è un CHECK sulla tabella, ed è deliberato: §18 — «Se il testo storico
-- supera un nuovo limite, preserva il dato e usa la strategia compatibile
-- del dominio, non una migrazione distruttiva.» Un CHECK rifiuterebbe
-- qualunque `update` su una riga storica più lunga, anche un update che la
-- nota non la tocca. La validazione sta nel comando e scatta solo quando la
-- nota **cambia**.
-- ============================================================

create or replace function public.shortlist_note_max_length()
returns integer
language sql
immutable
as $$ select 1000; $$;

revoke all on function public.shortlist_note_max_length() from public;
grant execute on function public.shortlist_note_max_length() to authenticated;

comment on function public.shortlist_note_max_length() is
  'DAS-REV-25 §18: limite unico della nota interna, condiviso da backend e '
  'client. Applicato alla scrittura, non come CHECK, per non rendere '
  'immodificabili le righe storiche più lunghe.';


-- ============================================================
-- SEZIONE 8 — salvataggio della valutazione (§17, §18, §19, §26)
--
-- La 24 aveva `update_shortlist_entry`: patch parziale con
-- `p_set_priority` / `p_set_note` per distinguere «omesso» da «null», e
-- compare-and-set su `revision`. Restituiva un `integer`. Mancano tre cose
-- che la 25 richiede esplicitamente:
--
--   · §19 — «La mutation avviene esclusivamente con Salva modifiche, con
--     versione attesa della entry **e protezione dalle ripetizioni prevista
--     dal core**»: serve la idempotency key, con la revisione attesa dentro
--     il fingerprint, così che la stessa chiave su valori successivi non
--     venga scambiata per lo stesso comando;
--   · §19 — «Restituisci una proiezione autorizzata»: il client deve poter
--     riconciliare senza una seconda lettura, e con una `integer` non può;
--   · §18 — il limite della nota.
--
-- La firma cambia tipo di ritorno, quindi la funzione va rilasciata e
-- ricreata. I chiamanti passano parametri **nominali** e ignorano il
-- risultato: il modulo legacy continua a funzionare senza modifiche.
--
-- Quello che la funzione continua a **non** fare, e che §18 vieta
-- esplicitamente: toccare person_id, shortlist_id, application_id, Society,
-- scope, origine, added_by o la data di creazione. Non sono parametri, non
-- per dimenticanza ma perché «Non cambiare … tramite l'editor» significa
-- che il comando non deve nemmeno poterli esprimere (QA088).
-- ============================================================

drop function if exists public.update_shortlist_entry(uuid, text, text, boolean, text, boolean, integer);

create or replace function public.update_shortlist_entry(
  p_entry_id           uuid,
  p_priority           text    default null,
  p_evaluation_status  text    default null,
  p_set_note           boolean default false,
  p_internal_note      text    default null,
  p_set_priority       boolean default false,
  p_expected_revision  integer default null,
  p_idempotency_key    text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid              uuid := auth.uid();
  v_entry            public.club_shortlist_entries%rowtype;
  v_status_changing  boolean;
  v_note_changing    boolean;
  v_next_priority    text;
  v_next_note        text;
  v_fingerprint      text;
  v_receipt          jsonb;
  v_result           jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  /* §19: «Il riutilizzo di una idempotency key restituisce l'esito della
     stessa operazione, non esegue un nuovo salvataggio su valori
     successivi.» Per questo la revisione attesa entra nel fingerprint: la
     stessa chiave con una revisione diversa è un'altra intenzione, e
     solleva invece di replicare un esito che non le appartiene. */
  v_fingerprint := md5(
    'shortlist_evaluate|v1|'
    || coalesce(p_expected_revision::text, '*') || '|'
    || case when p_set_priority then coalesce(p_priority, 'null') else '-' end || '|'
    || coalesce(p_evaluation_status, '-') || '|'
    || case when p_set_note then coalesce(p_internal_note, 'null') else '-' end
  );

  v_receipt := public.application_operation_replay(
    p_idempotency_key, p_entry_id, 'shortlist_evaluate', v_fingerprint
  );

  if v_receipt is not null then
    /* §19: «La proiezione corrente deve prevalere su una ricevuta storica
       quando un altro comando è già intervenuto.» La ricevuta dice «già
       fatto»; i valori li rilegge la lettura canonica. */
    select * into v_entry
    from public.club_shortlist_entries where id = p_entry_id;

    if v_entry.id is null then
      /* §26: «Una entry rimossa mentre l'editor è aperto non viene
         ricreata da Salva.» Nemmeno dal retry di un salvataggio che era
         andato a buon fine prima della rimozione. */
      raise exception 'SHORTLIST_ENTRY_NOT_FOUND';
    end if;

    return jsonb_build_object(
      'entry_id',  v_entry.id,
      'revision',  v_entry.revision,
      'priority',  v_entry.priority,
      'evaluation_status', v_entry.evaluation_status,
      'note_changed', (v_receipt ->> 'note_changed')::boolean,
      'replayed',  true
    );
  end if;

  select * into v_entry
  from public.club_shortlist_entries
  where id = p_entry_id
  for update;

  if not found then
    raise exception 'SHORTLIST_ENTRY_NOT_FOUND';
  end if;

  if not public.shortlist_in_scope(v_entry.shortlist_id, 'shortlist_view') then
    raise exception 'SHORTLIST_NOT_AUTHORIZED';
  end if;

  if p_expected_revision is not null
     and p_expected_revision is distinct from v_entry.revision then
    /* §26: «Non usare last-write-wins silenzioso. Un mismatch della
       versione restituisce un conflitto e mantiene il draft locale.» */
    raise exception 'SHORTLIST_ENTRY_REVISION_STALE';
  end if;

  v_next_priority := case when p_set_priority then p_priority else v_entry.priority end;

  v_status_changing :=
    (v_next_priority is distinct from v_entry.priority)
    or (p_evaluation_status is not null
        and p_evaluation_status <> v_entry.evaluation_status);

  if v_status_changing
     and not public.shortlist_in_scope(v_entry.shortlist_id, 'shortlist_edit_status') then
    raise exception 'SHORTLIST_NOT_AUTHORIZED';
  end if;

  /* §18: «Normalizza gli spazi superflui ai bordi secondo lo standard del
     progetto, senza riscrivere automaticamente il contenuto», e «Un testo
     vuoto normalizzato può essere null secondo il contratto canonico». Le
     interruzioni di riga **interne** restano intatte: lo screen 06 le
     prevede e §18 chiede di preservarle. */
  v_next_note := case
    when p_set_note then nullif(btrim(p_internal_note), '')
    else v_entry.internal_note
  end;

  v_note_changing := p_set_note and (v_next_note is distinct from v_entry.internal_note);

  if v_note_changing
     and not public.shortlist_in_scope(v_entry.shortlist_id, 'shortlist_add_notes') then
    raise exception 'SHORTLIST_NOT_AUTHORIZED';
  end if;

  /* §18: «Un valore troppo lungo non viene tagliato silenziosamente.» */
  if v_note_changing
     and v_next_note is not null
     and char_length(v_next_note) > public.shortlist_note_max_length() then
    raise exception 'SHORTLIST_NOTE_TOO_LONG';
  end if;

  if v_next_priority is not null and v_next_priority not in ('alta', 'media', 'bassa') then
    raise exception 'SHORTLIST_VALUE_INVALID';
  end if;

  if p_evaluation_status is not null and p_evaluation_status not in (
    'da_valutare', 'interessante', 'da_contattare', 'contattato',
    'non_prioritario', 'scartato'
  ) then
    raise exception 'SHORTLIST_VALUE_INVALID';
  end if;

  /* §19: «Il salvataggio di più campi è atomico: nessun successo parziale
     silenzioso.» Un solo update, dentro la transazione della funzione. */
  update public.club_shortlist_entries
  set
    priority          = v_next_priority,
    evaluation_status = coalesce(p_evaluation_status, evaluation_status),
    internal_note     = case when p_set_note then v_next_note else internal_note end
  where id = p_entry_id
  returning club_shortlist_entries.* into v_entry;

  v_result := jsonb_build_object(
    'entry_id',  v_entry.id,
    'revision',  v_entry.revision,
    'priority',  v_entry.priority,
    'evaluation_status', v_entry.evaluation_status,
    'note_changed', v_note_changing,
    'replayed',  false
  );

  perform public.application_operation_record(
    p_idempotency_key, p_entry_id, 'shortlist_evaluate', v_fingerprint,
    jsonb_build_object('revision', v_entry.revision, 'note_changed', v_note_changing)
  );

  return v_result;
end;
$$;

revoke all on function public.update_shortlist_entry(uuid, text, text, boolean, text, boolean, integer, text) from public;
grant execute on function public.update_shortlist_entry(uuid, text, text, boolean, text, boolean, integer, text) to authenticated;

comment on function public.update_shortlist_entry(uuid, text, text, boolean, text, boolean, integer, text) is
  'DAS-REV-25 §17-§19: patch atomica della valutazione, per campo e per '
  'capability, con revisione attesa, ricevuta di operazione e proiezione '
  'autorizzata in uscita. Non esprime nessun campo protetto.';


-- ============================================================
-- SEZIONE 9 — la rimozione diventa un comando (§21, §22, §26)
--
-- Prima era `supabase.from("club_shortlist_entries").delete().eq("id", …)`:
-- autorizzata dalla policy RLS, ma senza ricevuta, senza esito e senza i
-- dati che §21 chiede di riconciliare dopo il successo — count della
-- Position, centro, membership e stella.
--
-- §26: «Il retry di una rimozione già committata restituisce l'esito
-- idempotente senza decrementare due volte.» La ricevuta lo garantisce.
--
-- §26: «Anche se la stessa persona è stata riaggiunta, un vecchio editor/
-- rimuovi/retry non deve colpire la nuova generazione.» Qui la protezione è
-- strutturale e non richiede un parametro: una riaggiunta crea una **nuova
-- riga** con una nuova chiave primaria, quindi un comando che porta il
-- vecchio `entry_id` non trova nulla. `club_shortlist_membership_log`
-- continua a registrare la generazione per le ricevute dell'add.
--
-- `in_any_list` è la stella di §22: «almeno una membership accessibile della
-- Society operativa, incluse le CUSTOM». Viene ricalcolata **dopo** il
-- delete e nello stesso comando, così il client non deve indovinare se la
-- stella resta piena (QA099).
-- ============================================================

create or replace function public.remove_shortlist_entry(
  p_entry_id        uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_entry       public.club_shortlist_entries%rowtype;
  v_list        public.club_shortlists%rowtype;
  v_fingerprint text := 'shortlist_remove|v1';
  v_receipt     jsonb;
  v_total       bigint;
  v_any         boolean;
  v_result      jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_receipt := public.application_operation_replay(
    p_idempotency_key, p_entry_id, 'shortlist_remove', v_fingerprint
  );

  if v_receipt is not null then
    return v_receipt || jsonb_build_object('replayed', true);
  end if;

  select * into v_entry
  from public.club_shortlist_entries
  where id = p_entry_id
  for update;

  if not found then
    /* Nessuna ricevuta e nessuna riga: o un'altra sessione l'ha già
       rimossa, o l'id non è mai esistito. §28 — «Questo profilo non è più
       presente nella shortlist.» soltanto quando il motivo è noto e
       divulgabile; qui non lo è, e il client riconcilia. */
    raise exception 'SHORTLIST_ENTRY_NOT_FOUND';
  end if;

  select * into v_list from public.club_shortlists cs0 where cs0.id = v_entry.shortlist_id;

  if not public.shortlist_in_scope(v_entry.shortlist_id, 'shortlist_view') then
    raise exception 'SHORTLIST_ENTRY_NOT_FOUND';
  end if;

  if not public.shortlist_in_scope(v_entry.shortlist_id, 'shortlist_remove_profiles') then
    raise exception 'SHORTLIST_NOT_AUTHORIZED';
  end if;

  /* §21: «Non cancellare o modificare Application, Person, altre
     membership, carriera, organico, Follow, Salvati o chat.» Una sola
     riga, e il trigger `track_club_shortlist_membership` chiude la
     generazione. */
  delete from public.club_shortlist_entries where id = p_entry_id;

  select count(*) into v_total
  from public.club_shortlist_entries e
  where e.shortlist_id = v_entry.shortlist_id;

  /* §22: la stella guarda la **Society operativa**, non un booleano
     globale: ogni lista accessibile di questo club, CUSTOM comprese. */
  select exists (
    select 1
    from public.club_shortlist_entries e2
    join public.club_shortlists cs2 on cs2.id = e2.shortlist_id
    where cs2.club_id = v_list.club_id
      and e2.player_profile_id = v_entry.player_profile_id
      and public.shortlist_in_scope(cs2.id, 'shortlist_view')
  ) into v_any;

  v_result := jsonb_build_object(
    'entry_id',     p_entry_id,
    'shortlist_id', v_entry.shortlist_id,
    'club_id',      v_list.club_id,
    'position_id',  v_list.position_id,
    'person_id',    v_entry.player_profile_id,
    'profiles_total', v_total,
    'in_any_list',  v_any,
    'removed',      true
  );

  perform public.application_operation_record(
    p_idempotency_key, p_entry_id, 'shortlist_remove', v_fingerprint, v_result
  );

  return v_result || jsonb_build_object('replayed', false);
end;
$$;

revoke all on function public.remove_shortlist_entry(uuid, text) from public;
grant execute on function public.remove_shortlist_entry(uuid, text) to authenticated;

comment on function public.remove_shortlist_entry(uuid, text) is
  'DAS-REV-25 §21, §22, §26: rimozione di una sola membership, con ricevuta '
  'idempotente e i dati per riconciliare count, centro e stella. La '
  'protezione fra generazioni è l''entry_id, che una riaggiunta rinnova.';


-- ============================================================
-- SEZIONE 10 — la riga Shortlist nel dettaglio Position (§9)
--
-- «Nel dettaglio gestionale Position mostra, quando ciascun dominio è
-- autorizzato, due righe sorelle: Candidature ricevute … e Shortlist:
-- totale reale in profili, chevron e tap dell'intera riga.»
--
-- La lettura gestionale esisteva già e porta i conteggi Application: le
-- mancavano soltanto le due informazioni della riga sorella. Riemessa dalla
-- sua definizione più recente (20261102090000) con **due colonne in più** e
-- nessun'altra differenza.
--
-- §9: «Nessun GET, mount, preview, refresh o apertura del dettaglio
-- materializza liste o entry.» Il conteggio è una `count(*)` su
-- `club_shortlist_entries` attraverso il contenitore **se esiste**: una
-- Position senza contenitore produce 0, non lo crea.
--
-- §9 e QA010: «Senza capability Shortlist la row e il count sono assenti
-- anche dal payload Position.» `shortlist_available` falso porta con sé un
-- conteggio nullo — non uno zero, che direbbe «non c'è nessuno» a chi non
-- ha diritto di saperlo.
-- ============================================================

drop function if exists public.fetch_society_position_detail(uuid);

create or replace function public.fetch_society_position_detail(p_ad_id uuid)
returns table (
  position_id        uuid,
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  club_is_verified   boolean,
  club_region        text,
  club_city          text,
  title              text,
  description        text,
  role_required      text,
  target_role        text,
  profile_type       text,
  role_id            text,
  role_label         text,
  role_is_custom     boolean,
  custom_role_name   text,
  status             text,
  group_key          text,
  position_scope     text,
  team_id            uuid,
  team_name          text,
  team_is_inactive   boolean,
  context_label      text,
  season_label       text,
  region             text,
  age_mode           text,
  age_min            integer,
  age_max            integer,
  details            jsonb,
  secondary_teams    jsonb,
  compensation_summary text,
  published_at       timestamptz,
  updated_at         timestamptz,
  closed_at          timestamptz,
  deadline_at        timestamptz,
  deadline_date      date,
  deadline_timezone  text,
  receiving_closed   boolean,
  counts_available   boolean,
  applications_total integer,
  applications_new   integer,
  can_edit           boolean,
  can_publish        boolean,
  can_close          boolean,
  has_details        boolean,
  blockers           text[],
  resource_version   integer,
  schema_version     integer,
  creation_batch_id  uuid,
  access_verified_at timestamptz,
  data_revision      bigint,
  close_reason       text,
  close_reason_text  text,
  deadline_history_visible boolean,
  shortlist_available      boolean,
  shortlist_profiles_count integer
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
  v_group   text;
  v_season  text := public.current_season_id();
  v_now     timestamptz := timezone('utc', now());
  v_app_ok  boolean;
  v_edit    boolean;
  v_publish boolean;
  v_short_ok boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select ra.club_id, ra.team_id, ra.status
    into v_club, v_team, v_status
  from public.recruiting_ads ra
  where ra.id = p_ad_id;

  -- §23: «Un errore di autorizzazione non deve rivelare i dati della
  -- risorsa negata.» Inesistente e non autorizzata producono lo stesso
  -- esito, e lo stesso vale per la readiness: §23 vieta che «Readiness e
  -- numero di campi mancanti siano utilizzabili per sondare bozze private
  -- tramite ID arbitrari».
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

  v_group := public.society_position_group(v_status);

  -- §5: «La sola capacità di leggere una Position non concede
  -- automaticamente accesso a nomi, conteggi, nuove candidature o dettagli
  -- dei candidati. Non mostrare conteggi protetti nemmeno come zero.»
  v_app_ok := ('applications_view' = any (v_caps))
           and public.society_position_in_scope(v_club, v_team, 'applications_view');

  -- DAS-REV-25 §9, QA010: la riga Shortlist e il suo conteggio seguono la
  -- propria capability nel proprio perimetro, non quella delle candidature.
  -- «Non annidare Shortlist in Candidature ricevute»: sono due domini, e
  -- un actor puo' vedere l'uno senza l'altro.
  v_short_ok := ('shortlist_view' = any (v_caps))
             and public.society_position_in_scope(v_club, v_team, 'shortlist_view');

  -- Perimetro su **tutte** le squadre dell'incarico, principale e
  -- secondarie, non sulla sola principale.
  v_edit    := public.position_can_operate_on_ad(p_ad_id, 'edit');
  v_publish := public.position_can_operate_on_ad(p_ad_id, 'publish');

  return query
  select
    ra.id,
    ra.club_id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    c.region,
    c.city,
    nullif(btrim(ra.title), ''),
    nullif(btrim(ra.description), ''),
    ra.role_required::text,
    ra.target_role::text,
    ra.target_role::text,
    ra.structured_role_id,
    pr.label,
    coalesce(pr.is_custom, false),
    ra.custom_role_name,
    ra.status::text,
    v_group,
    ra.position_scope_type,
    ra.team_id,
    case
      when ra.position_scope_type = 'society' then null
      when v_group = 'closed' then coalesce(ra.published_team_name, ct.name)
      else ct.name
    end,
    coalesce(ct.is_archived, false),
    case
      when ra.position_scope_type = 'society' then null
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
    ra.age_mode,
    ra.age_min,
    ra.age_max,
    coalesce(ra.details, '{}'::jsonb),
    coalesce(
      (select jsonb_agg(jsonb_build_object(
                'teamId', t.id,
                'name',   t.name,
                'isInactive', t.is_archived
              ) order by t.sort_order, t.name)
         from public.recruiting_ad_teams rat
         join public.club_teams t on t.id = rat.team_id
        where rat.ad_id = ra.id),
      '[]'::jsonb
    ),
    nullif(btrim(ra.compensation_summary), ''),
    ra.published_at,
    ra.updated_at,
    ra.closed_at,
    ra.application_deadline_at,
    -- §8: proiezione del giorno civile via l'adapter, mai un cast diretto —
    -- con il cutoff esclusivo un cast diretto mostrerebbe il giorno dopo.
    case
      when ra.application_deadline_at is null then null
      else public.position_deadline_date(
             ra.application_deadline_at,
             coalesce(ra.application_deadline_timezone, public.society_position_timezone(ra.club_id))
           )
    end,
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
    /* §18: «aprire la posizione non deve segnare automaticamente tutte le
       candidature come lette». La lettura resta una lettura. */
    case when v_app_ok then (
      select count(*)::integer
      from public.recruiting_applications app
      where app.ad_id = ra.id
        and public.society_application_is_new(
          app.id, app.submission_revision, app.status, ra.status, v_uid
        )
    ) end,
    /* DAS-REV-15 §13: «Una Position CLOSED non espone modifica,
       riapertura, duplicazione o eliminazione in V1.» */
    v_edit and v_status <> 'closed',
    /* §7: «Un utente con modifica ma senza pubblicazione può completare e
       salvare la bozza; non vede Pubblica posizione.» Il permesso è qui, la
       validità del contenuto in `blockers`. */
    v_publish and v_status = 'draft',
    /* §19: Chiudi compare soltanto su una PUBLISHED e con permesso di
       modifica sull'intero incarico, squadre secondarie incluse. */
    v_edit and v_status = 'published',
    public.position_has_details(ra.id),
    public.position_publish_blockers(ra.id),
    ra.resource_version,
    ra.schema_version,
    ra.creation_batch_id,
    v_now,
    (extract(epoch from ra.updated_at) * 1000)::bigint,
    rac.reason::text,
    rac.reason_text,
    (ra.status = 'closed' and ra.application_deadline_at is not null),
    v_short_ok,
    /* DAS-REV-25 §9: «Nessun GET, mount, preview, refresh o apertura del
       dettaglio materializza liste o entry.» Il contenitore viene letto se
       c'e'; se non c'e', il conteggio e' zero e non viene creato nulla. */
    case when v_short_ok then coalesce((
      select count(*)::integer
      from public.club_shortlist_entries sle
      join public.club_shortlists sl on sl.id = sle.shortlist_id
      where sl.list_type = 'position' and sl.position_id = ra.id
    ), 0) end
  from public.recruiting_ads ra
  join public.clubs c on c.id = ra.club_id
  left join public.club_teams ct on ct.id = ra.team_id
  left join public.position_roles pr on pr.id = ra.structured_role_id
  left join public.club_team_seasons cur_cfg
    on cur_cfg.team_id = ct.id and cur_cfg.season_id = v_season
  left join public.team_levels cur_lvl  on cur_lvl.id = cur_cfg.level_id
  left join public.team_types  cur_type on cur_type.id = cur_cfg.team_type_id
  left join public.team_levels snap_lvl  on snap_lvl.id = ra.published_level_id
  left join public.team_types  snap_type on snap_type.id = ra.published_team_type_id
  left join public.seasons     snap_season on snap_season.id = ra.published_season_id
  left join public.recruiting_ad_closures rac on rac.ad_id = ra.id
  where ra.id = p_ad_id;
end;
$$;

revoke all on function public.fetch_society_position_detail(uuid) from public;
grant execute on function public.fetch_society_position_detail(uuid) to authenticated;

comment on function public.fetch_society_position_detail(uuid) is
  'DAS-REV-17/18/22 + DAS-REV-25 §9: lettura gestionale della Position. '
  'Porta ora anche la riga sorella Shortlist — disponibilità e conteggio '
  'reale — senza materializzare il contenitore.';


-- ============================================================
-- SEZIONE 11 — spostamento di scope con entry dipendenti (§9)
--
-- «Se l'editor Position modifica lo scope di una bozza con entry, proteggi
-- anche i dati Shortlist … Se il dominio non supporta ancora uno spostamento
-- sicuro con dati dipendenti, conserva lo scope corrente e restituisci un
-- errore controllato per quello spostamento; non clonare, cancellare o
-- sbloccare la lista. Le normali modifiche dei dettagli della Position
-- restano disponibili.»
--
-- Il dominio **non** lo supporta: la shortlist POSITION deriva il perimetro
-- da `recruiting_ads.team_id` (`shortlist_scope_team`), quindi un semplice
-- `update … set team_id = …` sposterebbe in un colpo solo note e valutazioni
-- dentro un perimetro che non le ha mai autorizzate — esattamente il «Non
-- ampliare l'accesso a note per effetto di un semplice payload team_id» di
-- §9. Fino a che non esiste un comando che autorizza entrambi i contesti,
-- lo spostamento è rifiutato con un errore proprio.
--
-- Il guard è deliberatamente stretto, perché i guard trigger di questo
-- repository hanno già rotto un flusso legittimo una volta
-- (`guard_team_is_active` e la pubblicazione delle Position di squadra):
--
--   · scatta **solo** se `team_id` o `position_scope_type` cambiano davvero;
--   · scatta **solo** se la lista di quella Position ha almeno una entry;
--   · non guarda nient'altro — titolo, descrizione, deadline, stato,
--     pubblicazione e chiusura passano senza essere nemmeno interrogati.
-- ============================================================

create or replace function public.guard_position_scope_with_shortlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.team_id is not distinct from old.team_id
     and new.position_scope_type is not distinct from old.position_scope_type then
    return new;
  end if;

  if exists (
    select 1
    from public.club_shortlists cs
    join public.club_shortlist_entries e on e.shortlist_id = cs.id
    where cs.list_type = 'position' and cs.position_id = old.id
  ) then
    raise exception 'SHORTLIST_SCOPE_MOVE_BLOCKED';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_position_scope_with_shortlist on public.recruiting_ads;
create trigger guard_position_scope_with_shortlist
  before update of team_id, position_scope_type on public.recruiting_ads
  for each row execute function public.guard_position_scope_with_shortlist();

comment on function public.guard_position_scope_with_shortlist() is
  'DAS-REV-25 §9: finché non esiste un comando che autorizza origine e '
  'destinazione, spostare il perimetro di una Position con entry in '
  'shortlist è rifiutato. Conserva lo scope corrente invece di spostare '
  'note e valutazioni in un perimetro che non le autorizzava.';


-- ============================================================
-- SEZIONE 12 — `position_publish_blockers` non poteva restituire un blocker
--
-- Fuori perimetro per contenuto, dentro per necessità: §9 richiede che «una
-- bozza già salvata con Position ID reale e scope definito» apra la propria
-- shortlist dal dettaglio gestionale (screen 12), e quel dettaglio —
-- `fetch_society_position_detail` — chiama questa funzione. Finché la
-- funzione solleva, lo screen 12 non esiste.
--
-- Il difetto è in ognuna delle 27 righe che aggiungono un motivo:
--
--     v_out := v_out || 'ROLE_MISSING';
--
-- `text[] || <letterale senza tipo>` è ambiguo, e Postgres risolve
-- `anyarray || anyarray`: il letterale viene letto come **array**, e
-- l'esecuzione muore con `malformed array literal: "ROLE_MISSING"`. Non è un
-- caso limite: succede al **primo** motivo trovato, quindi per ogni bozza
-- incompleta — cioè per ogni bozza che la readiness deve spiegare.
--
-- La correzione è un cast esplicito su ciascuna riga; niente altro cambia.
-- La funzione è riemessa dalla sua unica definizione (20261027090000), come
-- vuole la regola del progetto sulle funzioni ricreate da file vecchi.
--
-- Verificato su PGlite con le migrazioni reali: prima
-- `fetch_society_position_detail` su una bozza senza ruolo strutturato
-- sollevava, dopo restituisce la riga con i blockers attesi.
-- ============================================================

create or replace function public.position_publish_blockers(p_ad_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ad      record;
  v_role    record;
  v_out     text[] := array[]::text[];
  v_details jsonb;
  v_avail   jsonb;
  v_exp     jsonb;
  v_item    text;
begin
  select ra.*, ra.target_role::text as profile_type
    into v_ad
  from public.recruiting_ads ra
  where ra.id = p_ad_id;

  if not found then
    return array['POSITION_NOT_FOUND'];
  end if;

  v_details := coalesce(v_ad.details, '{}'::jsonb);

  -- ── Ruolo ────────────────────────────────────────────────────────────
  if v_ad.structured_role_id is null then
    v_out := v_out || 'ROLE_MISSING'::text;
  else
    select pr.* into v_role
    from public.position_roles pr
    where pr.id = v_ad.structured_role_id;

    if not found or not v_role.is_active or v_role.profile_type <> v_ad.profile_type then
      v_out := v_out || 'ROLE_INVALID'::text;
    elsif v_role.is_custom
      and nullif(btrim(coalesce(v_ad.custom_role_name, '')), '') is null then
      v_out := v_out || 'CUSTOM_ROLE_MISSING'::text;
    end if;
  end if;

  -- ── Ambito e Team (§6, §29) ──────────────────────────────────────────
  if v_ad.position_scope_type = 'team' then
    if v_ad.team_id is null then
      v_out := v_out || 'TEAM_MISSING'::text;
    elsif not exists (
      select 1 from public.club_teams ct
      where ct.id = v_ad.team_id
        and ct.club_id = v_ad.club_id
        and not ct.is_archived
    ) then
      -- §29: «Team non attivo, eliminato o non più autorizzato dopo la
      -- creazione della DRAFT richiede revisione prima del publish.»
      v_out := v_out || 'TEAM_UNAVAILABLE'::text;
    end if;
  elsif v_ad.position_scope_type = 'society' then
    if v_ad.team_id is not null then
      v_out := v_out || 'SCOPE_CONFLICT'::text;
    end if;

    if v_ad.profile_type <> 'director' then
      v_out := v_out || 'SCOPE_NOT_ALLOWED'::text;
    end if;
  end if;

  -- Squadre secondarie ancora valide (§29).
  if exists (
    select 1
    from public.recruiting_ad_teams rat
    join public.club_teams ct on ct.id = rat.team_id
    where rat.ad_id = p_ad_id
      and (ct.club_id <> v_ad.club_id or ct.is_archived)
  ) then
    v_out := v_out || 'SECONDARY_TEAM_UNAVAILABLE'::text;
  end if;

  -- ── Fascia d'età, solo Calciatore (§13) ──────────────────────────────
  if v_ad.profile_type = 'player' then
    if v_ad.age_mode = 'unset' then
      v_out := v_out || 'AGE_UNSET'::text;
    elsif v_ad.age_mode = 'range' then
      if v_ad.age_min is null or v_ad.age_max is null then
        v_out := v_out || 'AGE_RANGE_INCOMPLETE'::text;
      elsif v_ad.age_min > v_ad.age_max then
        v_out := v_out || 'AGE_RANGE_INVALID'::text;
      elsif v_ad.age_min < 5 or v_ad.age_max > 70 then
        -- §13: «centralizza un intervallo rappresentabile documentato; non
        -- presentarlo come regola federale.»
        v_out := v_out || 'AGE_OUT_OF_BOUNDS'::text;
      end if;
    end if;
  end if;

  -- ── Formalità degli optional presenti (§7, §20) ──────────────────────
  if char_length(coalesce(v_ad.description, '')) > 2000 then
    v_out := v_out || 'DESCRIPTION_TOO_LONG'::text;
  end if;

  if char_length(coalesce(v_details ->> 'requirements', '')) > 1000 then
    v_out := v_out || 'REQUIREMENTS_TOO_LONG'::text;
  end if;

  if char_length(coalesce(v_details ->> 'staffQualification', '')) > 300 then
    v_out := v_out || 'STAFF_QUALIFICATION_TOO_LONG'::text;
  end if;

  if char_length(coalesce(v_details ->> 'responsibilities', '')) > 1500 then
    v_out := v_out || 'RESPONSIBILITIES_TOO_LONG'::text;
  end if;

  if v_details ? 'coachQualificationId'
     and jsonb_typeof(v_details -> 'coachQualificationId') <> 'null'
     and not exists (
       select 1 from public.position_qualifications q
       where q.id = v_details ->> 'coachQualificationId' and q.is_active
     ) then
    v_out := v_out || 'QUALIFICATION_INVALID'::text;
  end if;

  -- Disponibilità: modalità e parametro devono essere coerenti (§19).
  v_avail := v_details -> 'availability';

  if v_avail is not null and jsonb_typeof(v_avail) = 'object' then
    if (v_avail ->> 'mode') not in ('immediate', 'from_date', 'next_season') then
      v_out := v_out || 'AVAILABILITY_INVALID'::text;
    elsif v_avail ->> 'mode' = 'from_date' then
      begin
        perform (v_avail ->> 'date')::date;
      exception when others then
        v_out := v_out || 'AVAILABILITY_DATE_INVALID'::text;
      end;

      if (v_avail ->> 'date') is null then
        v_out := v_out || 'AVAILABILITY_DATE_INVALID'::text;
      end if;
    elsif v_avail ->> 'mode' = 'next_season'
      and (v_avail ->> 'seasonId') is not null
      and not exists (
        select 1 from public.seasons s where s.id = v_avail ->> 'seasonId'
      ) then
      v_out := v_out || 'AVAILABILITY_SEASON_INVALID'::text;
    end if;
  end if;

  -- Esperienze: id del catalogo del proprio profilo, senza duplicati (§19).
  v_exp := v_details -> 'experience';

  if v_exp is not null and jsonb_typeof(v_exp) = 'array' then
    for v_item in select jsonb_array_elements_text(v_exp) loop
      if not exists (
        select 1 from public.position_experience_options o
        where o.id = v_item and o.profile_type = v_ad.profile_type
      ) then
        v_out := v_out || 'EXPERIENCE_INVALID'::text;
        exit;
      end if;

      -- §17: un criterio relativo su una bozza SOCIETY senza riferimento
      -- resta recuperabile ma richiede revisione prima di pubblicare.
      if v_ad.position_scope_type = 'society'
         and exists (
           select 1 from public.position_experience_options o
           where o.id = v_item and o.profile_type = v_ad.profile_type
             and o.requires_team_context
         ) then
        v_out := v_out || 'EXPERIENCE_NEEDS_TEAM_CONTEXT'::text;
        exit;
      end if;
    end loop;
  end if;

  -- Esperienza Calciatore: scelta singola, con categoria quando serve (§14).
  if v_ad.profile_type = 'player'
     and v_details ? 'playerExperience'
     and jsonb_typeof(v_details -> 'playerExperience') = 'object' then
    if (v_details -> 'playerExperience' ->> 'mode')
         not in ('in_category', 'higher_categories', 'from_category') then
      v_out := v_out || 'EXPERIENCE_INVALID'::text;
    elsif (v_details -> 'playerExperience' ->> 'mode') = 'from_category'
      and not exists (
        select 1 from public.team_levels l
        where l.id = v_details -> 'playerExperience' ->> 'levelId'
      ) then
      v_out := v_out || 'EXPERIENCE_CATEGORY_INVALID'::text;
    end if;
  end if;

  if v_ad.profile_type = 'player'
     and v_details ? 'playerSituation'
     and jsonb_typeof(v_details -> 'playerSituation') <> 'null'
     and (v_details ->> 'playerSituation') not in ('free_agent', 'open_to_transfer') then
    v_out := v_out || 'SITUATION_INVALID'::text;
  end if;

  -- ── Deadline (§23, DAS-REV-18) ───────────────────────────────────────
  if v_ad.application_deadline_at is not null
     and v_ad.application_deadline_at <= timezone('utc', now()) then
    v_out := v_out || 'DEADLINE_PASSED'::text;
  end if;

  return v_out;
end;
$$;


revoke all on function public.position_publish_blockers(uuid) from public;
grant execute on function public.position_publish_blockers(uuid) to authenticated;
