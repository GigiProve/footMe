-- REV-ONB-05 — Onboarding Società.
--
-- La struttura della società diventa un attributo esplicito del club invece
-- di una deduzione a valle (categoria prima squadra + flag vivaio). Aggiunge
-- inoltre i due canali digitali che l'onboarding può ora raccogliere.
--
-- Tutte le colonne sono nullable: nessun dato esistente viene toccato.

alter table public.clubs add column if not exists club_structure text;
alter table public.clubs add column if not exists tiktok text;
alter table public.clubs add column if not exists youtube text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clubs_club_structure_values'
  ) then
    alter table public.clubs add constraint clubs_club_structure_values
      check (
        club_structure is null
        or club_structure in (
          'first_team_only',
          'first_team_and_youth',
          'youth_only'
        )
      );
  end if;
end $$;

-- Backfill delle società già registrate (§BC).
--
-- La semantica si ricostruisce dalle squadre realmente create:
--   senior + youth -> prima squadra + settore giovanile
--   solo senior    -> prima squadra
--   solo youth     -> solo settore giovanile
-- I club senza squadre restano a null: non inventiamo una configurazione
-- che nessuno ha mai dichiarato.
update public.clubs c
set club_structure = case
  when teams.has_senior and teams.has_youth then 'first_team_and_youth'
  when teams.has_senior then 'first_team_only'
  when teams.has_youth then 'youth_only'
end
from (
  select
    club_id,
    bool_or(team_type = 'senior') as has_senior,
    bool_or(team_type = 'youth') as has_youth
  from public.club_teams
  group by club_id
) as teams
where teams.club_id = c.id
  and c.club_structure is null
  and (teams.has_senior or teams.has_youth);

-- Fallback per i club creati prima di club_teams: resta la sola categoria.
update public.clubs
set club_structure = 'first_team_only'
where club_structure is null
  and category is not null
  and btrim(category) <> '';

create index if not exists clubs_club_structure_idx
  on public.clubs (club_structure)
  where club_structure is not null;
