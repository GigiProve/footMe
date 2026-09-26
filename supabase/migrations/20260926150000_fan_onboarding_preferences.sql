-- REV-ONB-08 §AF: le preferenze del Tifoso raccolte in onboarding diventano
-- dato strutturato e riutilizzabile da feed, discovery e suggerimenti (§AG).
--
-- Due sole dimensioni: che calcio seguire (macro-categorie, mai i singoli
-- campionati) e da dove seguirlo. Lo scope geografico riusa i token già in
-- uso su player_profiles.availability_type — ITALY / REGIONS / PROVINCES —
-- così la stessa domanda non ha due vocabolari nel database.
--
-- interest_regions esisteva già e continua a contenere le regioni: cambia
-- solo chi la scrive. interest_categories resta per i profili storici e non
-- viene più alimentata dall'onboarding (§O, §P).

alter table public.fan_profiles
  add column if not exists football_types text[] not null default '{}',
  add column if not exists geo_scope text not null default 'ITALY',
  add column if not exists interest_provinces text[] not null default '{}';

-- Chi aveva già scelto delle regioni con il vecchio flusso non è un tifoso
-- "di tutta Italia": lo scope segue il dato che esiste già (§AU).
update public.fan_profiles
set geo_scope = 'REGIONS'
where geo_scope = 'ITALY'
  and cardinality(interest_regions) > 0;

alter table public.fan_profiles
  drop constraint if exists fan_profiles_geo_scope_check;

alter table public.fan_profiles
  add constraint fan_profiles_geo_scope_check
  check (geo_scope in ('ITALY', 'REGIONS', 'PROVINCES'));

alter table public.fan_profiles
  drop constraint if exists fan_profiles_football_types_check;

alter table public.fan_profiles
  add constraint fan_profiles_football_types_check
  check (
    football_types <@ array['professional', 'amateur', 'women', 'youth']::text[]
  );

-- §R, §BD: le tre modalità sono mutuamente esclusive. Il database non deve
-- poter contenere "tutta Italia" insieme a un elenco di regioni.
alter table public.fan_profiles
  drop constraint if exists fan_profiles_geo_scope_consistency_check;

alter table public.fan_profiles
  add constraint fan_profiles_geo_scope_consistency_check
  check (
    case geo_scope
      when 'ITALY' then
        cardinality(interest_regions) = 0 and cardinality(interest_provinces) = 0
      when 'REGIONS' then
        cardinality(interest_provinces) = 0
      when 'PROVINCES' then
        cardinality(interest_regions) = 0
      else false
    end
  );

create index if not exists fan_profiles_football_types_idx
  on public.fan_profiles using gin (football_types);

create index if not exists fan_profiles_interest_regions_idx
  on public.fan_profiles using gin (interest_regions);

create index if not exists fan_profiles_interest_provinces_idx
  on public.fan_profiles using gin (interest_provinces);
