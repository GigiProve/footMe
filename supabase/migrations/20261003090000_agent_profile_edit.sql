-- Migration: REV-PROF-16 — Modifica profilo Procuratore.
--
-- Tre interventi indipendenti, tutti additivi e rieseguibili:
--
--  1. `agent_profiles.primary_activities`: le attività principali diventano un
--     dato proprio, con un massimo di tre. Finora vivevano in
--     `operational_focuses`, una lista senza limite né tassonomia chiusa che
--     l'onboarding non chiede più: quella colonna non viene svuotata — resta
--     leggibile e conserva le attività legacy oltre la terza — ma smette di
--     essere scritta dal profilo.
--
--  2. LinkedIn fra i contatti pubblici. Il canale è nel mockup di questa task e
--     nella sua lista di validazioni, ma non esisteva nel modello: lo si
--     aggiunge dove stanno gli altri sei social, con la stessa coppia
--     valore/visibilità e la stessa porta backend (`get_profile_public_contacts`
--     restituisce NULL per i canali spenti). Vale per tutti i ruoli, perché
--     `profile_contacts` è dell'utente e non del profilo professionale.
--
--  3. Assistiti in evidenza. La selezione è un attributo della relazione, non
--     una lista a parte: `agent_representations` acquisisce la posizione in
--     evidenza, il database garantisce che le posizioni siano al più tre e
--     distinte, e un rapporto che smette di essere pubblico o accettato perde
--     l'evidenza da solo — senza che nessuno debba ricordarsene dal client.
--
-- Convenzioni riprese da:
--   20260926120000_agent_procurator_onboarding.sql (colonne e vincoli agent)
--   20260929180000_coach_palmares_and_public_contacts.sql (contatti pubblici)
--   20261002120000_agent_master_profile.sql (fetch_agent_public_assistiti)


-- ============================================================
-- SECTION 1: attività principali
-- ============================================================

alter table public.agent_profiles
  -- Massimo tre, come il mockup. I valori sono i token della tassonomia
  -- condivisa; le etichette restano testo di prodotto.
  add column if not exists primary_activities text[] not null default '{}'::text[];

alter table public.agent_profiles
  drop constraint if exists agent_profiles_primary_activities_limit;

alter table public.agent_profiles
  add constraint agent_profiles_primary_activities_limit
  check (coalesce(array_length(primary_activities, 1), 0) <= 3);

-- ------------------------------------------------------------
-- 1a. Le attività già dichiarate diventano le principali.
-- ------------------------------------------------------------
-- Si prendono le prime tre nell'ordine in cui sono state salvate: nessuna
-- scelta viene inventata e nessuna viene cancellata — dalla quarta in poi
-- restano in `operational_focuses`, che questa migrazione non tocca. Il
-- profilo che le modificherà dovrà scegliere esplicitamente quali tre
-- promuovere, ed è esattamente ciò che la schermata chiede.
--
-- Solo le righe ancora vuote. Rieseguire la migrazione non tocca chi ha nel
-- frattempo scelto le sue tre attività; resta un caso scoperto — chi le
-- deseleziona tutte torna a '{}' e una seconda esecuzione gliele
-- ripromuoverebbe. È accettato perché una migrazione si applica una volta
-- sola: distinguere "mai scelto" da "scelto nulla" avrebbe richiesto una
-- colonna di stato per un caso che la riesecuzione non produce da sola.
update public.agent_profiles
set primary_activities = (
  -- "ord" e non "position": POSITION e una parola chiave SQL, e come alias di
  -- colonna si fa confondere con la funzione omonima.
  select coalesce(array_agg(focus order by ord), '{}'::text[])
  from (
    select focus, ord
    from unnest(operational_focuses) with ordinality as legacy(focus, ord)
    where nullif(btrim(focus), '') is not null
    order by ord
    limit 3
  ) as picked
)
where primary_activities = '{}'::text[]
  and coalesce(array_length(operational_focuses, 1), 0) > 0;


-- ============================================================
-- SECTION 2: LinkedIn fra i contatti pubblici
-- ============================================================

alter table public.profile_contacts
  add column if not exists linkedin text,
  -- Spento per default: una colonna nuova non pubblica niente da sola.
  add column if not exists show_linkedin boolean not null default false;

-- Stessa forma di prima, otto canali invece di sette. Resta `security definer`
-- perché deve superare la RLS owner-only di `profile_contacts`, e resta
-- l'unica porta: ogni `case when` spento restituisce NULL, mai il valore.
--
-- Il DROP non è pigrizia: `create or replace` non può cambiare il tipo di
-- ritorno di una funzione che restituisce una table.
drop function if exists public.get_profile_public_contacts(uuid);

create function public.get_profile_public_contacts(target_profile_id uuid)
returns table (
  instagram text,
  facebook text,
  email text,
  tiktok text,
  youtube text,
  website text,
  linkedin text,
  phone text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    case when contact.show_instagram then contact.instagram else null end as instagram,
    case when contact.show_facebook then contact.facebook else null end as facebook,
    case when contact.show_email then contact.email else null end as email,
    case when contact.show_tiktok then contact.tiktok else null end as tiktok,
    case when contact.show_youtube then contact.youtube else null end as youtube,
    case when contact.show_website then contact.website else null end as website,
    case when contact.show_linkedin then contact.linkedin else null end as linkedin,
    case when priv.show_phone then priv.phone else null end as phone
  from public.profile_contacts contact
  -- Left join: un profilo può avere i social pubblici e nessun telefono
  -- salvato, e non deve sparire per questo.
  left join public.profile_private_contacts priv
    on priv.profile_id = contact.profile_id
  where contact.profile_id = target_profile_id;
$$;

revoke all on function public.get_profile_public_contacts(uuid) from public;
grant execute on function public.get_profile_public_contacts(uuid) to authenticated;


-- ============================================================
-- SECTION 3: assistiti in evidenza
-- ============================================================

alter table public.agent_representations
  -- 1, 2 o 3: la posizione nel profilo pubblico. `null` = non in evidenza.
  add column if not exists featured_rank smallint,
  add column if not exists featured_at timestamptz;

alter table public.agent_representations
  drop constraint if exists agent_representations_featured_rank_check;

alter table public.agent_representations
  add constraint agent_representations_featured_rank_check
  check (featured_rank is null or featured_rank between 1 and 3);

-- Tre posizioni distinte per procuratore, garantite dal database: due
-- richieste concorrenti non possono lasciare due assistiti sullo stesso posto.
create unique index if not exists idx_agent_representations_featured_slot
  on public.agent_representations(agent_profile_id, featured_rank)
  where featured_rank is not null;


-- ------------------------------------------------------------
-- 3a. L'evidenza segue l'eleggibilità.
-- ------------------------------------------------------------
-- Un rapporto che diventa privato, concluso, revocato o rifiutato esce dal
-- profilo pubblico: `fetch_agent_public_assistiti` lo filtra comunque, ma
-- lasciargli addosso la posizione significherebbe tenere in giro uno stato che
-- non vale più e farlo riapparire se il rapporto tornasse pubblico. L'ordine
-- dei rimanenti non viene ricompattato qui: le posizioni restano quelle
-- scelte, e il client le rinumera alla prossima selezione.
create or replace function public.agent_representation_featured_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.featured_rank is not null
     and (new.status <> 'accepted' or new.visibility <> 'public') then
    new.featured_rank := null;
    new.featured_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists agent_representation_featured_guard_trigger
  on public.agent_representations;

create trigger agent_representation_featured_guard_trigger
  before insert or update on public.agent_representations
  for each row
  execute function public.agent_representation_featured_guard();

-- Le righe già non eleggibili non possono avere un'evidenza, ma la pulizia
-- costa poco ed è l'unica cosa che rende questa sezione indipendente
-- dall'ordine in cui le migrazioni vengono applicate.
update public.agent_representations
set featured_rank = null,
    featured_at = null
where featured_rank is not null
  and (status <> 'accepted' or visibility <> 'public');


-- ------------------------------------------------------------
-- 3b. Scrittura della selezione.
-- ------------------------------------------------------------
-- Una sola funzione, una sola transazione: azzera le posizioni precedenti e
-- riassegna quelle nuove nell'ordine ricevuto. Scrive **solo** la posizione —
-- stato, visibilità, tipologia e dati dell'assistito restano intoccati, che è
-- il motivo per cui la gestione del rapporto resta un altro modulo.
--
-- Un id non più eleggibile non fa fallire il salvataggio: viene scartato, e il
-- client rilegge l'elenco vero. Fallire avrebbe bloccato una selezione valida
-- per colpa di una riga cambiata nel frattempo da qualcun altro.
create or replace function public.set_agent_featured_assistiti(
  p_profile_id uuid,
  p_relationship_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[] := coalesce(p_relationship_ids, '{}'::uuid[]);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_user(p_profile_id) then
    raise exception 'Profile not accessible';
  end if;

  if coalesce(array_length(v_ids, 1), 0) > 3 then
    raise exception 'AGENT_FEATURED_LIMIT';
  end if;

  -- Prima si libera tutto: senza questo passaggio l'indice parziale farebbe
  -- fallire uno scambio di posizioni fra due assistiti già in evidenza.
  update public.agent_representations
  set featured_rank = null,
      featured_at = null
  where agent_profile_id = p_profile_id
    and featured_rank is not null;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return;
  end if;

  update public.agent_representations rel
  set featured_rank = chosen.ord::smallint,
      featured_at = timezone('utc', now())
  from unnest(v_ids) with ordinality as chosen(id, ord)
  where rel.id = chosen.id
    and rel.agent_profile_id = p_profile_id
    and rel.status = 'accepted'
    and rel.visibility = 'public';
end;
$$;

revoke all on function public.set_agent_featured_assistiti(uuid, uuid[]) from public;
grant execute on function public.set_agent_featured_assistiti(uuid, uuid[]) to authenticated;


-- ------------------------------------------------------------
-- 3c. La proiezione pubblica porta l'evidenza con sé.
-- ------------------------------------------------------------
-- Stessa funzione della 20261002120000 con una colonna in più e un ordinamento
-- diverso: prima gli assistiti in evidenza, nella posizione scelta, poi gli
-- altri come prima. Il Master Profile non deve riordinare niente, e owner e
-- visitor continuano a ricevere esattamente la stessa risposta.
drop function if exists public.fetch_agent_public_assistiti(uuid);

create function public.fetch_agent_public_assistiti(
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
  featured_rank     smallint,
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
      r.featured_rank,
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
    order by
      r.featured_rank asc nulls last,
      r.accepted_at desc nulls last,
      r.created_at desc;
end;
$$;

revoke all on function public.fetch_agent_public_assistiti(uuid) from public;
grant execute on function public.fetch_agent_public_assistiti(uuid) to authenticated;


-- ============================================================
-- SECTION 4: il numero di licenza esce dalla tabella pubblica
-- ============================================================
-- `agent_profiles` è leggibile da qualunque utente autenticato
-- (20260330123000: `for select ... using (true)`), perché è la tabella che
-- alimenta il Master Profile. Il numero di licenza vive lì dalla
-- 20260926120000, quindi finora bastava chiederlo per averlo: l'interfaccia
-- non lo mostrava, ma la riga lo portava comunque fuori dal dispositivo del
-- proprietario.
--
-- REV-PROF-16 lo vieta esplicitamente ("non deve essere restituito nelle API
-- pubbliche", "il backend deve applicare le regole di visibilità"), quindi il
-- dato si sposta dove la RLS lo protegge davvero. È lo stesso trattamento che
-- il telefono ha già in `profile_private_contacts` (20260313000002): un dato
-- del proprietario non sta nella tabella del profilo pubblico.
--
-- Il numero non viene perso: viene copiato prima di essere azzerato, e la
-- copia è l'unica da cui il client lo rilegge.

create table if not exists public.agent_license_credentials (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  license_number text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.agent_license_credentials enable row level security;

-- Nessuna policy di lettura pubblica: il numero è del proprietario e basta.
drop policy if exists "agents can read own license" on public.agent_license_credentials;
create policy "agents can read own license"
on public.agent_license_credentials
for select
to authenticated
using (public.is_current_user(profile_id));

drop policy if exists "agents can manage own license" on public.agent_license_credentials;
create policy "agents can manage own license"
on public.agent_license_credentials
for all
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop trigger if exists agent_license_credentials_set_updated_at
  on public.agent_license_credentials;
create trigger agent_license_credentials_set_updated_at
before update on public.agent_license_credentials
for each row execute procedure public.set_updated_at();

-- Copia prima, azzeramento dopo: fra le due istruzioni il dato esiste in due
-- posti, mai in zero. `do nothing` rende la copia rieseguibile senza
-- sovrascrivere un numero nel frattempo aggiornato dal proprietario.
insert into public.agent_license_credentials (profile_id, license_number)
select profile_id, license_number
from public.agent_profiles
where nullif(btrim(coalesce(license_number, '')), '') is not null
on conflict (profile_id) do nothing;

update public.agent_profiles
set license_number = null
where license_number is not null;

-- La colonna resta in piedi: `save_agent_profile_details` la nomina ancora e
-- rimuoverla farebbe fallire la RPC dell'onboarding. Da qui in avanti il
-- client non la legge e non la scrive più, quindi resta vuota.
comment on column public.agent_profiles.license_number is
  'Deprecata da REV-PROF-16: il numero di licenza vive in agent_license_credentials, che e owner-only. Questa colonna resta vuota.';
