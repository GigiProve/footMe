-- REV-PROF-05 — Modifica profilo Allenatore: palmarès strutturato e contatti
-- pubblici leggibili dal Visitor.
--
-- Due cose separate, ma entrambe necessarie perché le schermate 6-7 e 8 della
-- task abbiano dati veri dietro.
--
-- 1. `coach_achievements` nasceva come riga editoriale: un `label` scritto a
--    mano più una descrizione. Il mockup chiede invece tipo, competizione,
--    stagione e società come campi distinti — serve per l'anteprima, per
--    l'ordinamento per stagione e per il blocco dei duplicati esatti. Le
--    colonne vengono aggiunte, `label` resta e continua a essere scritta (è il
--    titolo già composto, letto dal Master Profile senza modifiche).
--
-- 2. `get_profile_public_contacts` conosceva tre canali su sei. Da quando
--    `profile_contacts` ha anche tiktok, youtube e sito, un Visitor non poteva
--    vedere quei tre nemmeno quando il proprietario li aveva resi pubblici,
--    perché la RLS della tabella è owner-only e questa funzione era l'unica
--    via d'uscita. La privacy resta applicata qui, nel backend: un canale con
--    il flag spento non esce dalla funzione, quindi non esiste cache, deep
--    link o condivisione che possa esporlo.
--
-- Migrazione additiva e rieseguibile: nessuna colonna rimossa, nessun dato
-- riscritto due volte.

-- ---------------------------------------------------------------------------
-- 1. Palmarès dell'Allenatore
-- ---------------------------------------------------------------------------

alter table public.coach_achievements
  add column if not exists competition_name text,
  add column if not exists season_label text,
  add column if not exists club_name text,
  add column if not exists club_id uuid references public.clubs(id) on delete set null;

-- Le righe storiche hanno solo `label`: diventa la competizione, che è ciò
-- che l'editor mostrerà riaprendole. Nessuna stagione viene inventata.
update public.coach_achievements
set competition_name = label
where competition_name is null;

-- `premio_personale` è il quarto tipo del mockup. `playoff` e `altro` restano
-- validi: sono già sul database e il vincolo non deve invalidarli.
alter table public.coach_achievements
  drop constraint if exists coach_achievements_achievement_type_check;

alter table public.coach_achievements
  add constraint coach_achievements_achievement_type_check
  check (
    achievement_type in (
      'campionato',
      'promozione',
      'coppa',
      'premio_personale',
      'playoff',
      'altro'
    )
  );

-- Duplicato esatto = stesso allenatore, stesso tipo, stessa competizione,
-- stessa stagione, stessa società. Il client lo intercetta prima di salvare;
-- questo indice è la rete sotto, perché due submit ravvicinati non creino due
-- righe identiche. Confronto normalizzato: "Coppa Italia" e "coppa italia "
-- sono lo stesso riconoscimento.
--
-- Indice **parziale**: le righe salvate prima di questa task non hanno una
-- stagione, e due vecchie voci con la stessa etichetta farebbero fallire la
-- creazione dell indice — cioè l intera migrazione. Restano fuori dal
-- vincolo; ogni riga scritta dall editor nuovo ha sempre una stagione.
create unique index if not exists idx_coach_achievements_unique_entry
  on public.coach_achievements (
    coach_profile_id,
    achievement_type,
    lower(btrim(coalesce(competition_name, ''))),
    lower(btrim(season_label)),
    lower(btrim(coalesce(club_name, '')))
  )
  where season_label is not null;

-- ---------------------------------------------------------------------------
-- 2. Contatti pubblici visibili al Visitor
-- ---------------------------------------------------------------------------
-- Il telefono resta dov era, in `profile_private_contacts`: non viene copiato
-- in `profile_contacts` per non avere due numeri che possono divergere. Qui
-- gli si affianca soltanto la sua preferenza di visibilità, spenta per
-- default — un numero già salvato non diventa pubblico per effetto di questa
-- migrazione.

alter table public.profile_private_contacts
  add column if not exists show_phone boolean not null default false;

-- Stessa forma di prima, sette canali invece di tre. Resta `security definer`
-- perché deve superare la RLS owner-only di `profile_contacts`, e resta
-- l'unica porta: ogni `case when` spento restituisce NULL, mai il valore.
--
-- Il DROP non è pigrizia: `create or replace` non può cambiare il tipo di
-- ritorno di una funzione che restituisce una table, e qui le colonne passano
-- da tre a sette.

drop function if exists public.get_profile_public_contacts(uuid);

create function public.get_profile_public_contacts(target_profile_id uuid)
returns table (
  instagram text,
  facebook text,
  email text,
  tiktok text,
  youtube text,
  website text,
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
