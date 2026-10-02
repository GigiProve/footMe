-- Migration: REV-PROF-13 — Master Profile Procuratore.
--
-- Due interventi, entrambi non distruttivi e idempotenti:
--
-- 1. `agent_career_entries` diventa la struttura canonica dell'esperienza
--    professionale. Finora l'incarico attuale viveva in tre colonne separate di
--    `agent_profiles` (agency_name / agency_role / period_*) e le esperienze
--    precedenti in questa tabella: due posti per lo stesso dato. Il Master
--    Profile deriva ora agenzia e ruolo attuali dalla carriera, quindi le
--    colonne legacy vengono MAPPATE qui dentro, non cancellate — restano
--    leggibili durante il rilascio e nessun client che le scrive si rompe.
--
-- 2. `fetch_agent_public_assistiti`: la proiezione pubblica del portfolio.
--    `fetch_agent_assistiti` (20260626120000) è riservata all'owner — solleva
--    "Non autorizzato" per chiunque altro — e restituisce anche richieste
--    pendenti e relazioni private. Il profilo pubblico ha bisogno dell'opposto:
--    solo accepted + public, e la stessa risposta per owner e visitor, così
--    l'owner vede davvero ciò che vedono gli altri.
--
-- Convenzioni riprese da:
--   20260410090000_agent_career_portfolio.sql  (tabella e RLS)
--   20260626120000_representation_relationship_types.sql (arricchimento RPC)


-- ============================================================
-- SECTION 1: esperienza professionale canonica
-- ============================================================

alter table public.agent_career_entries
  -- L'incarico è in corso. Finora era implicito in "period_end_year is null".
  add column if not exists is_current boolean not null default false,
  -- L'incarico principale fra quelli in corso: è quello che l'header mostra.
  add column if not exists is_primary boolean not null default false,
  -- Un'esperienza può essere tenuta fuori dal profilo pubblico.
  add column if not exists visibility text not null default 'public',
  -- Agenzia/studio oppure attività indipendente: un indipendente non ha
  -- un'organizzazione, e un nome vuoto non deve diventare un logo mancante.
  add column if not exists organization_mode text not null default 'agency',
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.agent_career_entries
  drop constraint if exists agent_career_entries_visibility_check;

alter table public.agent_career_entries
  add constraint agent_career_entries_visibility_check
  check (visibility in ('public', 'private'));

alter table public.agent_career_entries
  drop constraint if exists agent_career_entries_organization_mode_check;

alter table public.agent_career_entries
  add constraint agent_career_entries_organization_mode_check
  check (organization_mode in ('agency', 'independent'));

-- `agency_name` è `not null` dalla 20260410090000: un indipendente non ha un
-- nome da scrivere lì, quindi il vincolo va rilassato invece di costringere a
-- inventare un'organizzazione fittizia.
alter table public.agent_career_entries
  alter column agency_name drop not null;

create index if not exists idx_agent_career_entries_current
  on public.agent_career_entries(agent_profile_id, is_current, is_primary);


-- ------------------------------------------------------------
-- 1a. Un incarico senza data di fine era già un incarico in corso.
-- ------------------------------------------------------------
-- Solo le righe mai toccate dal nuovo modello: `is_current` parte a false, e
-- rieseguire la migrazione non riaccende niente che qualcuno abbia spento,
-- perché la condizione sulla data di fine resta la stessa.
update public.agent_career_entries
set is_current = true
where period_end_year is null
  and period_end_month is null
  and is_current = false;


-- ------------------------------------------------------------
-- 1b. Un solo incarico principale per procuratore.
-- ------------------------------------------------------------
-- Si sceglie il più recente fra quelli in corso. Gli altri restano in carriera:
-- "principale" decide cosa mostra l'header, non cosa sopravvive.
with ranked as (
  select
    e.id,
    row_number() over (
      partition by e.agent_profile_id
      order by
        coalesce(e.period_start_year, 0) desc,
        e.sort_order asc,
        e.created_at asc
    ) as position
  from public.agent_career_entries e
  where e.is_current = true
    and not exists (
      select 1
      from public.agent_career_entries other
      where other.agent_profile_id = e.agent_profile_id
        and other.is_primary = true
    )
)
update public.agent_career_entries entry
set is_primary = true
from ranked
where ranked.id = entry.id
  and ranked.position = 1;


-- ------------------------------------------------------------
-- 1c. L'incarico attuale che viveva su `agent_profiles` diventa carriera.
-- ------------------------------------------------------------
-- Viene inserito solo quando quel profilo non ha ancora nessuna riga di
-- carriera con la stessa agenzia: la migrazione non duplica un'esperienza che
-- il procuratore aveva già inserito a mano, e rieseguirla non ne crea una
-- seconda. Le colonne di origine non vengono toccate.
insert into public.agent_career_entries (
  agent_profile_id,
  agency_name,
  agency_logo_url,
  role,
  period_start_month,
  period_start_year,
  period_end_month,
  period_end_year,
  sort_order,
  is_current,
  is_primary,
  organization_mode,
  visibility
)
select
  p.profile_id,
  nullif(btrim(coalesce(p.agency_name, '')), ''),
  p.agency_logo_url,
  coalesce(nullif(btrim(coalesce(p.agency_role, '')), ''), 'Procuratore'),
  p.period_start_month,
  p.period_start_year,
  p.period_end_month,
  p.period_end_year,
  -- Davanti alle esperienze già inserite: è l'incarico attuale.
  -1,
  -- In corso quando la colonna legacy non porta una data di fine.
  (p.period_end_year is null and p.period_end_month is null),
  -- Principale solo se nessun'altra riga lo è già (1b può averlo deciso).
  (
    p.period_end_year is null
    and p.period_end_month is null
    and not exists (
      select 1
      from public.agent_career_entries existing
      where existing.agent_profile_id = p.profile_id
        and existing.is_primary = true
    )
  ),
  case when p.professional_mode = 'independent' then 'independent' else 'agency' end,
  'public'
from public.agent_profiles p
where
  -- Un indipendente va migrato anche senza nome agenzia: l'esperienza esiste
  -- lo stesso, è il nome a non esserci.
  (
    nullif(btrim(coalesce(p.agency_name, '')), '') is not null
    or p.professional_mode = 'independent'
  )
  and not exists (
    select 1
    from public.agent_career_entries existing
    where existing.agent_profile_id = p.profile_id
      and (
        -- Stessa agenzia già in carriera...
        (
          nullif(btrim(coalesce(existing.agency_name, '')), '') is not distinct from
          nullif(btrim(coalesce(p.agency_name, '')), '')
        )
        -- ...oppure, per un indipendente, una riga indipendente qualsiasi.
        or (
          p.professional_mode = 'independent'
          and existing.organization_mode = 'independent'
        )
      )
  );


-- ============================================================
-- SECTION 2: proiezione pubblica del portfolio assistiti
-- ============================================================
-- Stessi campi arricchiti di `fetch_agent_assistiti`, ma:
--   * nessun controllo di proprietà: owner e visitor leggono la stessa cosa;
--   * solo status 'accepted' e visibility 'public';
--   * nessun campo riservato (message, private_note, visibility pendente).
-- La RLS della tabella consente già questa lettura a chiunque; la funzione
-- esiste per fare i join su `profiles` e `club_members` senza esporre altro.

create or replace function public.fetch_agent_public_assistiti(
  p_agent_profile_id uuid
)
returns table (
  id                uuid,
  player_profile_id uuid,
  player_full_name  text,
  player_avatar_url text,
  primary_position  public.player_position,
  current_team      text,
  relationship_type text,
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

  if p_agent_profile_id is null then
    return;
  end if;

  return query
    select
      r.id,
      r.player_profile_id,
      p.full_name                                                   as player_full_name,
      p.avatar_url                                                  as player_avatar_url,
      pp.primary_position,
      cl.name                                                       as current_team,
      r.relationship_type,
      r.created_at
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
      and r.status = 'accepted'
      and r.visibility = 'public'
    order by r.accepted_at desc nulls last, r.created_at desc;
end;
$$;

revoke all on function public.fetch_agent_public_assistiti(uuid) from public;
grant execute on function public.fetch_agent_public_assistiti(uuid) to authenticated;


-- ============================================================
-- SECTION 3: lo stato canonico sopravvive al salvataggio
-- ============================================================
-- `save_agent_profile_details` (20260410090000, riscritta dalla 20260926120000)
-- cancella e reinserisce l'intera carriera a ogni salvataggio, e la sua
-- `insert` non conosce le colonne aggiunte qui: senza questo trigger ogni
-- modifica dal flusso Modifica profilo riporterebbe `is_current` e
-- `organization_mode` ai valori di default, spegnendo l'incarico attuale del
-- procuratore. Invece di duplicare quella funzione di duecento righe — che
-- resterebbe da tenere allineata a mano — l'invariante vive accanto al dato.
--
-- Le regole sono le stesse del backfill:
--   * nessuna data di fine → incarico in corso;
--   * modalità organizzativa presa dal profilo, quando la riga non la dichiara.
-- `is_primary` non viene derivato qui: in sua assenza il client elegge il più
-- recente fra gli incarichi in corso, quindi una colonna indovinata dal
-- database aggiungerebbe solo un secondo posto da cui la scelta può divergere.

create or replace function public.agent_career_entry_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_current = false
     and new.period_end_year is null
     and new.period_end_month is null then
    new.is_current := true;
  end if;

  if new.organization_mode = 'agency'
     and nullif(btrim(coalesce(new.agency_name, '')), '') is null then
    select case when p.professional_mode = 'independent' then 'independent' else 'agency' end
      into new.organization_mode
    from public.agent_profiles p
    where p.profile_id = new.agent_profile_id;

    new.organization_mode := coalesce(new.organization_mode, 'agency');
  end if;

  return new;
end;
$$;

drop trigger if exists agent_career_entry_defaults_trigger on public.agent_career_entries;

create trigger agent_career_entry_defaults_trigger
  before insert or update on public.agent_career_entries
  for each row
  execute function public.agent_career_entry_defaults();
