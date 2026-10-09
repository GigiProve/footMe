-- ============================================================
-- DAS-REV-02 — Foundation Dashboard: priorità, cache e stati
--
-- DAS-REV-01 ha introdotto `fetch_dashboard_society_overview` con **una**
-- priorità calcolata in linea (`priority_ad_id`, `priority_ad_title`,
-- `priority_new_applications`). Quel contratto non regge i requisiti di
-- DAS-REV-02:
--
--   · §7  richiede un registro di tipi versionati, non un caso cablato;
--   · §8  richiede livello, natura, impatto, scadenza e recency per ordinare;
--   · §9  richiede una chiave di aggregazione stabile, indipendente dal testo
--         e dal conteggio, e un totale calcolato prima del limite visuale;
--   · §14 richiede metadata di freschezza e revisione;
--   · §15 richiede l'istante dell'ultima verifica server-side di accesso.
--
-- Questa migrazione sostituisce quelle tre colonne con `priority_signals`
-- (array jsonb di segnali normalizzati) e aggiunge i metadata mancanti.
-- Non è una seconda RPC: §34 vieta un sistema Dashboard parallelo.
--
-- Aggiunge inoltre `fetch_dashboard_society_positions`, che DAS-REV-01 non
-- aveva perché le Posizioni comparivano solo come riga in "Aree di gestione".
-- §24 chiede un modulo "Posizioni aperte" con azione "Gestisci" e due
-- preview, e §11 stabilisce che **senza priorità** quel modulo precede
-- "Candidature ricevute".
--
-- È una funzione **separata**, non una colonna del riepilogo, per una ragione
-- precisa: il master 04 mostra la lista Posizioni in errore mentre riepilogo
-- e candidature restano utilizzabili. Con una sola RPC quel caso non
-- esisterebbe — un fallimento spegnerebbe tutto — e §26 lo richiede
-- esplicitamente, insieme al retry che «non ricarica inutilmente le
-- candidature». Il **conteggio** delle Posizioni resta nel riepilogo, così da
-- restare noto anche quando la lista fallisce (§16).
--
-- Nessuna tabella nuova, nessuna colonna nuova, nessun permesso concesso:
-- solo proiezioni di lettura, sbarrate dalle stesse capability già introdotte
-- da 20261012090000.
--
-- Rollback: ripristinare la definizione di 20261012090000_dashboard_foundation.sql
-- e droppare `fetch_dashboard_society_positions`. Nessun dato da ripristinare.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — public.fetch_dashboard_society_overview (rimpiazzo)
--
-- La firma cambia: `drop` esplicito prima del `create`, perché PostgreSQL
-- non consente a `create or replace function` di modificare il tipo di
-- ritorno di una funzione che restituisce una table.
-- ============================================================

drop function if exists public.fetch_dashboard_society_overview(uuid);

create function public.fetch_dashboard_society_overview(p_club_id uuid)
returns table (
  -- ── Riepilogo e conteggi (invariati da DAS-REV-01) ──────────────────
  positions_open_count          integer,
  applications_count            integer,
  teams_count                   integer,
  drafts_count                  integer,
  scheduled_count               integer,

  -- ── Conteggio canonico "da gestire" (§10) ───────────────────────────
  -- Distinto dal totale: §24 chiede che risolvere la priorità porti questo
  -- a zero **senza** azzerare le 27 candidature storiche.
  applications_to_handle_count  integer,

  -- ── Segnali operativi normalizzati (§7, §8, §9) ─────────────────────
  priority_signals              jsonb,
  -- Totale dopo eligibility e deduplicazione, **prima** del limite visuale.
  priority_total_count          integer,

  -- ── Preview ─────────────────────────────────────────────────────────
  -- Le Posizioni **non** sono qui: hanno un provider indipendente, così il
  -- loro fallimento resta locale al modulo mentre riepilogo e candidature
  -- restano utilizzabili (§26, master 04).
  applications_preview          jsonb,
  drafts_preview                jsonb,
  recent_content_preview        jsonb,

  -- ── Metadata di cache e accesso (§14, §15) ──────────────────────────
  -- `access_verified_at` è l'istante in cui il server ha verificato accesso
  -- e scope. È il solo riferimento che apre la finestra di 15 minuti di
  -- visualizzazione offline: un controllo locale di rete o di token non la
  -- rinnova.
  access_verified_at            timestamptz,
  -- Revisione monotona della risposta: una risposta più vecchia non
  -- sovrascrive una più recente della stessa identità (§21, QA-17).
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
  v_now     timestamptz := timezone('utc', now());
  v_signals jsonb  := '[]'::jsonb;
  v_total   integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  -- Nessun accesso: nessun conteggio, nessun segnale, nessun metadata. Non
  -- si distingue da "Società inesistente", per non rivelare l'esistenza
  -- della Società a chi non la amministra.
  if not ('dashboard_view' = any (v_caps)) then
    return query select
      null::integer, null::integer, null::integer, null::integer, null::integer,
      null::integer,
      null::jsonb, null::integer,
      null::jsonb, null::jsonb, null::jsonb,
      null::timestamptz, null::bigint;
    return;
  end if;

  -- ── Segnali `new_applications` (§7) ───────────────────────────────────
  --
  -- Un segnale per Posizione con almeno una candidatura ancora `submitted`.
  -- §8: «una condizione canonica di almeno una candidatura ancora da
  -- gestire è sufficiente» — il 5 del mockup non è una soglia.
  --
  -- `aggregation_key` nasce da tipo + Società + Posizione: resta la stessa
  -- quando il conteggio scende da cinque a due (§9, QA-03).
  --
  -- `occurred_at` è il `created_at` della candidatura da gestire più
  -- recente, non `now()`: §8 vieta che la sola modifica del conteggio
  -- aggiorni artificialmente la data dell'evento. Se il conteggio scende,
  -- il massimo residuo non può aumentare.
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
        -- Contesto localizzabile, non testo precotto: "Attaccante · Prima
        -- squadra" viene composto dal client dalle sue due parti.
        'role',            ra.role_required::text,
        'team_name',       ct.name,
        -- La scadenza della Posizione esiste nel dominio ma §2 la esclude
        -- dalle preview; qui serve solo al ranking (§8, criterio 4).
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
      group by ra.id, ra.role_required, ra.deadline, ct.name
      -- Cap di sicurezza sul payload: il limite visuale è 3 (§9), dieci
      -- segnali bastano a ogni ordinamento. `priority_total_count` resta il
      -- totale vero, così il cap non si traveste da totale.
      order by max(app.created_at) desc
      limit 10
    ) signals;

    -- Totale vero, calcolato senza il cap: un cap del payload non deve
    -- potersi travestire da totale (§9).
    select count(*)::integer into v_total
    from (
      select ra.id
      from public.recruiting_ads ra
      join public.recruiting_applications app
        on app.ad_id = ra.id
       and app.status = 'submitted'
      where ra.club_id = p_club_id
        and ra.status = 'published'
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

    -- Contratto predisposto, dominio non ancora capace di programmare.
    null::integer as scheduled_count,

    case when 'applications_view' = any (v_caps) then (
      select count(*)::integer
      from public.recruiting_applications app
      join public.recruiting_ads ra on ra.id = app.ad_id
      where ra.club_id = p_club_id
        and app.status = 'submitted'
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
          and cmp.published_at <= v_now
        order by cmp.published_at desc
        limit 3
      ) preview
    ) end as recent_content_preview,

    -- Verifica di accesso e scope appena eseguita: è questo istante, non
    -- quello della risposta HTTP, ad aprire la finestra offline di §15.
    v_now as access_verified_at,
    -- Da `v_now`, non da `clock_timestamp()`: la funzione è `stable` e deve
    -- restare tale. Due risposte nella stessa transazione condividono la
    -- revisione — ed è corretto, perché sono lo stesso dato; due richieste
    -- HTTP diverse sono transazioni diverse e la revisione avanza.
    (extract(epoch from v_now) * 1000)::bigint as data_revision;
end;
$$;

revoke all on function public.fetch_dashboard_society_overview(uuid) from public;
grant execute on function public.fetch_dashboard_society_overview(uuid) to authenticated;

comment on function public.fetch_dashboard_society_overview(uuid) is
  'DAS-REV-02: riepilogo, segnali di priorità normalizzati, preview e '
  'metadata di freschezza di una Società. Ogni colonna null significa '
  '"non autorizzato", non "zero". access_verified_at apre la finestra di '
  'visualizzazione offline di 15 minuti (DAS-REV-02 §15).';


-- ============================================================
-- SEZIONE 2 — public.fetch_dashboard_society_positions
--
-- Provider **indipendente** del modulo "Posizioni aperte" (§16, §26).
--
-- Stessa capability del conteggio (`positions_view`), stesso filtro di
-- autorizzazione: separare il provider non allarga di un millimetro ciò che
-- l'actor può leggere. Separa solo il **destino del fallimento**, che è il
-- requisito del master 04.
--
-- Nessuna scadenza, descrizione, retribuzione o punteggio nel payload: §24
-- le esclude dalle preview Posizione, e un campo restituito è un campo che
-- prima o poi qualcuno disegna.
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
  v_caps text[];
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

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
  order by ra.created_at desc
  limit 3;
end;
$$;

revoke all on function public.fetch_dashboard_society_positions(uuid) from public;
grant execute on function public.fetch_dashboard_society_positions(uuid) to authenticated;

comment on function public.fetch_dashboard_society_positions(uuid) is
  'DAS-REV-02: preview delle Posizioni aperte di una Società. Provider '
  'indipendente dal riepilogo, perché il master 04 richiede che il suo '
  'fallimento resti locale al modulo. Nessun risultato = nessuna capability '
  'positions_view oppure nessuna Posizione pubblicata.';
