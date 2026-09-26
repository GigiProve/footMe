-- REV-ONB-07 — Onboarding Dirigente
--
-- La review non riscrive il modello: aggiunge le colonne che servono alle
-- nuove semantiche e lascia intatte quelle già popolate (§AW).
--
-- Restano volutamente in tabella, senza essere più raccolte dall'onboarding:
--   • experience_categories — §K: le categorie si ricavano dalle esperienze;
--   • market_involvement    — assorbito dalle aree di responsabilità;
--   • club_types            — ricavabile dalle esperienze inserite.
-- I profili salvati prima della review continuano a leggerle.

alter table public.director_profiles
  -- §H: ruolo dichiarato scegliendo "Altro" nello step "Il tuo ruolo nel club".
  add column if not exists other_role_label text,
  -- §M–§N: da chi il dirigente accetta di ricevere contatti. Sono preferenze
  -- di contatto, non permessi: l'enforcement resta al modello privacy.
  add column if not exists open_to_clubs boolean not null default true,
  add column if not exists open_to_staff boolean not null default true,
  add column if not exists open_to_players boolean not null default true,
  add column if not exists open_to_others boolean not null default true,
  -- §Z–§AA: altre esperienze nel calcio, selezione multipla.
  -- Valori: player | coach | staff | scout | agent | referee | other.
  add column if not exists previous_roles text[] not null default '{}',
  -- §AE, §AG: rami esperienza che prima non avevano dove essere salvati.
  add column if not exists staff_career_entries jsonb not null default '[]'::jsonb,
  add column if not exists other_career_entries jsonb not null default '[]'::jsonb;

-- Backfill: le vecchie etichette libere diventano la tassonomia chiusa della
-- nuova schermata (§AW).
--
-- "Preparatore atletico" confluisce nello Staff tecnico, che è il ramo che ne
-- raccoglie le esperienze; "Ex calciatore" diventa "player" perché il dato è
-- la carriera, non il tempo verbale. Un'etichetta non mappata viene scartata:
-- meglio nessun ruolo che un ruolo inventato.
update public.director_profiles as target
set previous_roles = mapped.roles
from (
  select
    source.profile_id,
    array_agg(distinct translated.role_value order by translated.role_value)
      as roles
  from public.director_profiles as source
  cross join lateral unnest(source.other_football_roles) as legacy(label)
  cross join lateral (
    select case legacy.label
      when 'Ex calciatore' then 'player'
      when 'Allenatore' then 'coach'
      when 'Staff tecnico' then 'staff'
      when 'Preparatore atletico' then 'staff'
      when 'Scout' then 'scout'
      when 'Procuratore' then 'agent'
      when 'Altro' then 'other'
    end as role_value
  ) as translated
  where translated.role_value is not null
  group by source.profile_id
) as mapped
where target.profile_id = mapped.profile_id
  and cardinality(target.previous_roles) = 0;

-- Il flag legacy "ha giocato" vale quanto una chip: è la stessa
-- dichiarazione, fatta con un controllo diverso.
update public.director_profiles
set previous_roles = previous_roles || array['player']
where has_played_football
  and not ('player' = any(previous_roles));
