-- REV-PROF-11 — Modifica profilo Dirigente
--
-- L'hub "Opportunità" chiede tre cose che il Dirigente non sapeva ancora dire:
-- se è disponibile, dove opera e con quale granularità territoriale.
--
-- Le quattro preferenze di contatto (`open_to_clubs/staff/players/others`,
-- REV-ONB-07 §M) non bastano a rappresentarle: spegnere la disponibilità
-- avrebbe significato azzerarle, e la task chiede esplicitamente che le
-- selezioni si ritrovino riaccendendo il toggle. Serve quindi un interruttore
-- separato dai destinatari, non al posto loro.
--
-- Le colonne ricalcano quelle che Allenatore e Staff tecnico hanno già su
-- `coach_profiles` / `staff_profiles`: stessa semantica, stessi nomi, stesso
-- vocabolario di `availability_type` (ITALY | REGIONS | PROVINCES). Nessun
-- modello geografico nuovo, nessun campo duplicato.

alter table public.director_profiles
  -- Disponibilità generale. Prima era derivata dai destinatari: il backfill
  -- qui sotto riproduce esattamente quello stato per le righe esistenti.
  add column if not exists open_to_work boolean not null default true,
  -- ITALY | REGIONS | PROVINCES. NULL vale ITALY, come per gli altri ruoli.
  add column if not exists availability_type text,
  add column if not exists preferred_regions text[] not null default '{}',
  add column if not exists preferred_provinces text[] not null default '{}';

-- Un profilo con tutti i destinatari spenti non risultava disponibile: resta
-- com'era. Tutti gli altri erano disponibili e restano disponibili.
update public.director_profiles
set open_to_work = false
where not (
  open_to_clubs or open_to_staff or open_to_players or open_to_others
);
