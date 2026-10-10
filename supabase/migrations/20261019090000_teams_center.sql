-- ============================================================
-- DAS-REV-08 — Centro e configurazione Squadre
--
-- Il principio della task in una riga: **la squadra è stabile nel tempo; la
-- classificazione sportiva appartiene alla singola stagione**. Il modello
-- attuale non lo sa dire. `club_teams` tiene insieme tre cose diverse:
--
--   · l'identità del Team      (nome, stemma, città)       → stabile
--   · il tipo                  (`team_type` senior/youth)  → stagionale
--   · il livello               (`category`, testo libero)  → stagionale
--
-- Promuovere Comashi da Under 18 · Regionale a Under 18 · Élite oggi
-- riscriverebbe `category` e cancellerebbe la stagione precedente; creare una
-- riga nuova spezzerebbe membership e riferimenti. Nessuna delle due è ciò
-- che il dominio intende, quindi §6 chiede Società → Team → Team Season e
-- questa migrazione la costruisce.
--
-- Cosa introduce
--   §7   `seasons` + `current_season()`: la stagione corrente è una sorgente
--        centrale, non l'anno del dispositivo né una stringa digitata.
--   §15  `team_types` / `team_levels` / `team_type_levels` / alias: due
--        tassonomie **distinte** e una compatibilità dichiarata. `category`
--        text restava un campo libero in cui "U18", "U 18" e "Under 18" erano
--        tre categorie diverse.
--   §6   `club_team_seasons`: una sola configurazione canonica per coppia
--        Team–stagione, imposta anche a livello persistente.
--   §17/18 `crest_mode` / `city_mode`: l'ereditarietà è una **modalità
--        persistente**, non una copia dell'immagine. Finché era una copia,
--        cambiare lo stemma della Società non raggiungeva le squadre.
--   §16  `team_level_reports`: la segnalazione di categoria mancante va
--        persistita, non mostrata e dimenticata.
--   §20/21 `team_duplicate_confirmations` e `team_create_requests`: la
--        conferma di "Crea comunque" è legata a dati e contesto verificati, e
--        la creazione è idempotente.
--   §5   chiavi `teams_create`, `teams_edit`, `roster_view`: consultare non è
--        creare, e leggere i conteggi dell'organico è una terza cosa ancora.
--
-- Cosa **non** fa
--   Non tocca `club_teams.team_type` e `club_teams.category`: restano dove
--   sono, leggibili dalle superfici che li usano oggi (profilo pubblico,
--   Cerca, Posizioni). Da qui in avanti però la fonte scrivibile della
--   classificazione corrente è una sola — `club_team_seasons` — e un trigger
--   riallinea le due colonne legacy invece di lasciarle divergere (§28:
--   «mantenere una sola fonte scrivibile per ogni campo»).
--   Non archivia, non riattiva, non prepara stagioni future (DAS-REV-10).
--   Non crea un dettaglio operativo (DAS-REV-09).
--
-- Rollback: droppare le funzioni di questa migrazione, le cinque tabelle
-- nuove, le colonne aggiunte a `club_teams`, e ripristinare il CHECK di
-- 20261018090000.
--
-- Convenzioni riusate:
--   20260324000000_club_teams.sql               (tabella Team, RLS)
--   20260717090000_club_member_permissions.sql  (grant, drop+re-add del CHECK)
--   20260725100000_comuni_geo.sql               (normalizzazione, geocode)
--   20261008090000_society_master_profile.sql   (can_manage_society, is_public)
--   20261018090000_dashboard_society_overview.sql (capability e scope)
-- ============================================================


-- ============================================================
-- SEZIONE 1 — Chiavi di permesso
--
-- §5 chiede quattro capability distinte. Ne esistevano due (`teams_view` e
-- l'ownership implicita); qui si aggiungono le altre.
--
-- `roster_view` esiste perché §10 applica i permessi **anche ai soli
-- numeri**: «un valore non consultabile viene omesso». Senza una chiave
-- propria, "24 calciatori · 6 staff" sarebbe un dato dell'organico mostrato a
-- chiunque possa consultare l'elenco delle squadre.
--
-- Nello stesso drop/re-add si ripristinano `society_manage_profile`,
-- `society_manage_positions` e `society_publish_media`. Erano stati introdotti
-- dalla 20261008090000 e la 20261012090000 li ha persi riscrivendo il CHECK
-- con il solo elenco Dashboard: da allora `can_manage_society` legge una
-- chiave che il database non accetta più in scrittura, quindi la delega del
-- profilo Società non era più concedibile. Qui l'elenco torna completo.
-- ============================================================

alter table public.club_member_permissions
  drop constraint if exists club_member_permissions_key_check;

alter table public.club_member_permissions
  add constraint club_member_permissions_key_check
  check (permission_key in (
    -- gruppo Shortlist (20260717090000)
    'shortlist_view',
    'shortlist_create_lists',
    'shortlist_add_profiles',
    'shortlist_add_notes',
    'shortlist_edit_status',
    'shortlist_remove_profiles',
    -- gruppo notifiche club (20260719090300)
    'notif_new_applications',
    'notif_shortlist_updates',
    'notif_connection_requests',
    'notif_store_orders',
    'notif_content_tags',
    'notif_affiliations',
    'notif_profile_verifications',
    -- gruppo profilo Società (20261008090000), ripristinate
    'society_manage_profile',
    'society_manage_positions',
    'society_publish_media',
    -- gruppo Dashboard (DAS-REV-01 / DAS-REV-07)
    'dashboard_view',
    'positions_view',
    'positions_create',
    'applications_view',
    'teams_view',
    'content_view',
    'content_create',
    'invites_create',
    'invites_view',
    -- gruppo Squadre (DAS-REV-08 §5) — nuove
    'teams_create',
    'teams_edit',
    'roster_view'
  ));


-- ============================================================
-- SEZIONE 2 — Stagione canonica (§7)
--
-- «La stagione corrente viene determinata dalla sorgente centrale PROLINK,
-- non dall'anno del dispositivo o da una stringa inserita dall'utente.»
--
-- L'id è la label ("2026/27"): è già la forma con cui il dominio scrive la
-- stagione in `club_teams.season`, `club_members.season` e nelle carriere.
-- Un uuid avrebbe richiesto una traduzione in ognuna di quelle superfici
-- senza aggiungere nulla — la stringa è stabile e irripetibile per
-- costruzione.
--
-- Il confine è 1 luglio – 30 giugno. Fuori dall'intervallo seminato
-- `current_season()` non restituisce nulla: §7 prevede esattamente quel caso
-- («se la stagione corrente non è caricabile … bloccare il submit con errore
-- e retry»), e inventare un valore sarebbe peggio di non averlo.
-- ============================================================

create table if not exists public.seasons (
  id         text primary key,
  label      text not null,
  starts_on  date not null,
  ends_on    date not null,
  sort_order integer not null
);

insert into public.seasons (id, label, starts_on, ends_on, sort_order)
select
  y::text || '/' || lpad(((y + 1) % 100)::text, 2, '0'),
  y::text || '/' || lpad(((y + 1) % 100)::text, 2, '0'),
  make_date(y, 7, 1),
  make_date(y + 1, 6, 30),
  y
from generate_series(2010, 2045) as y
on conflict (id) do nothing;

alter table public.seasons enable row level security;

drop policy if exists "seasons are readable" on public.seasons;
create policy "seasons are readable"
  on public.seasons for select to authenticated using (true);

create or replace function public.current_season_id()
returns text
language sql
stable
set search_path = public
as $$
  select s.id
  from public.seasons s
  where current_date between s.starts_on and s.ends_on
  limit 1;
$$;

grant execute on function public.current_season_id() to authenticated;


-- ============================================================
-- SEZIONE 3 — Tassonomia: Tipo squadra e Livello/campionato (§15)
--
-- Due identificativi canonici **distinti**. Il Tipo dice che cosa è la
-- squadra nell'organizzazione del club (Prima squadra, Primavera, Under 18);
-- il Livello dice dove gioca quella stagione (Serie D, Élite, Regionale).
-- §15 vieta di «mischiare tipi, aree geografiche e livelli in un unico
-- enum», ed è esattamente ciò che `club_teams.category` faceva: "Primavera" e
-- "Serie D" convivevano nella stessa colonna.
--
-- La compatibilità è dichiarata in `team_type_levels` e non dedotta da una
-- convenzione sui nomi: «Non mostrare campionati incompatibili».
--
-- `is_active = false` è il valore dismesso di §15: resta leggibile e
-- riconoscibile su una squadra che già lo usa, ma non compare più fra le
-- scelte. Non viene convertito in un altro campionato.
-- ============================================================

create table if not exists public.team_types (
  id         text primary key,
  label      text not null,
  -- Ponte verso `club_teams.team_type`, che il dominio pubblico legge ancora.
  tier       text not null check (tier in ('senior', 'youth')),
  sort_order integer not null,
  is_active  boolean not null default true
);

create table if not exists public.team_levels (
  id         text primary key,
  label      text not null,
  sort_order integer not null,
  is_active  boolean not null default true
);

create table if not exists public.team_type_levels (
  team_type_id text not null references public.team_types(id) on delete cascade,
  level_id     text not null references public.team_levels(id) on delete cascade,
  sort_order   integer not null default 0,
  primary key (team_type_id, level_id)
);

-- Alias ortografici (§15): "U18", "U 18" e "Under 18" sono lo stesso id.
-- La chiave è il testo **normalizzato** con la stessa funzione usata dai
-- comuni (20260725100000), così la normalizzazione del progetto è una sola.
create table if not exists public.team_type_aliases (
  alias_norm   text primary key,
  team_type_id text not null references public.team_types(id) on delete cascade
);

create table if not exists public.team_level_aliases (
  alias_norm text primary key,
  level_id   text not null references public.team_levels(id) on delete cascade
);

insert into public.team_types (id, label, tier, sort_order) values
  ('first_team',   'Prima squadra', 'senior', 10),
  ('primavera',    'Primavera',     'youth',  20),
  ('under_19',     'Under 19',      'youth',  30),
  ('under_18',     'Under 18',      'youth',  40),
  ('under_17',     'Under 17',      'youth',  50),
  ('under_16',     'Under 16',      'youth',  60),
  ('under_15',     'Under 15',      'youth',  70),
  ('under_14',     'Under 14',      'youth',  80),
  ('juniores',     'Juniores',      'youth',  90),
  ('allievi',      'Allievi',       'youth', 100),
  ('giovanissimi', 'Giovanissimi',  'youth', 110),
  ('esordienti',   'Esordienti',    'youth', 120),
  ('pulcini',      'Pulcini',       'youth', 130)
on conflict (id) do update
  set label = excluded.label,
      tier = excluded.tier,
      sort_order = excluded.sort_order;

insert into public.team_levels (id, label, sort_order) values
  ('serie_a',           'Serie A',           10),
  ('serie_b',           'Serie B',           20),
  ('serie_c',           'Serie C',           30),
  ('serie_d',           'Serie D',           40),
  ('eccellenza',        'Eccellenza',        50),
  ('promozione',        'Promozione',        60),
  ('prima_categoria',   'Prima Categoria',   70),
  ('seconda_categoria', 'Seconda Categoria', 80),
  ('terza_categoria',   'Terza Categoria',   90),
  ('primavera_1',       'Primavera 1',      100),
  ('primavera_2',       'Primavera 2',      110),
  ('primavera_3',       'Primavera 3',      120),
  ('primavera_4',       'Primavera 4',      130),
  ('nazionale',         'Nazionale',        140),
  ('elite',             'Élite',            150),
  ('regionale',         'Regionale',        160),
  ('provinciale',       'Provinciale',      170)
on conflict (id) do update
  set label = excluded.label,
      sort_order = excluded.sort_order;

-- Compatibilità. La Prima squadra gioca i campionati senior; la Primavera i
-- propri; le annate giovanili si classificano per livello territoriale.
insert into public.team_type_levels (team_type_id, level_id, sort_order)
select 'first_team', l.id, l.sort_order
from public.team_levels l
where l.id in (
  'serie_a', 'serie_b', 'serie_c', 'serie_d', 'eccellenza',
  'promozione', 'prima_categoria', 'seconda_categoria', 'terza_categoria'
)
on conflict do nothing;

insert into public.team_type_levels (team_type_id, level_id, sort_order)
select 'primavera', l.id, l.sort_order
from public.team_levels l
where l.id in ('primavera_1', 'primavera_2', 'primavera_3', 'primavera_4')
on conflict do nothing;

insert into public.team_type_levels (team_type_id, level_id, sort_order)
select t.id, l.id, l.sort_order
from public.team_types t
cross join public.team_levels l
where t.id in (
  'under_19', 'under_18', 'under_17', 'under_16', 'under_15', 'under_14',
  'juniores', 'allievi', 'giovanissimi'
)
  and l.id in ('elite', 'regionale', 'provinciale')
on conflict do nothing;

insert into public.team_type_levels (team_type_id, level_id, sort_order)
select t.id, l.id, l.sort_order
from public.team_types t
cross join public.team_levels l
where t.id in ('esordienti', 'pulcini')
  and l.id in ('regionale', 'provinciale')
on conflict do nothing;

-- Alias: la label canonica, la forma compatta e la variante con spazio.
insert into public.team_type_aliases (alias_norm, team_type_id)
select public.footme_normalize_lookup(alias), team_type_id
from (values
  ('Prima squadra', 'first_team'),
  ('Prima Squadra', 'first_team'),
  ('Senior', 'first_team'),
  ('Primavera', 'primavera'),
  ('Under 19', 'under_19'), ('U19', 'under_19'), ('U 19', 'under_19'),
  ('Under 18', 'under_18'), ('U18', 'under_18'), ('U 18', 'under_18'),
  ('Under 17', 'under_17'), ('U17', 'under_17'), ('U 17', 'under_17'),
  ('Under 16', 'under_16'), ('U16', 'under_16'), ('U 16', 'under_16'),
  ('Under 15', 'under_15'), ('U15', 'under_15'), ('U 15', 'under_15'),
  ('Under 14', 'under_14'), ('U14', 'under_14'), ('U 14', 'under_14'),
  ('Juniores', 'juniores'),
  ('Allievi', 'allievi'),
  ('Giovanissimi', 'giovanissimi'),
  ('Esordienti', 'esordienti'),
  ('Pulcini', 'pulcini')
) as a(alias, team_type_id)
on conflict (alias_norm) do nothing;

insert into public.team_level_aliases (alias_norm, level_id)
select public.footme_normalize_lookup(l.label), l.id
from public.team_levels l
on conflict (alias_norm) do nothing;

alter table public.team_types       enable row level security;
alter table public.team_levels      enable row level security;
alter table public.team_type_levels enable row level security;
alter table public.team_type_aliases  enable row level security;
alter table public.team_level_aliases enable row level security;

drop policy if exists "team types are readable" on public.team_types;
create policy "team types are readable"
  on public.team_types for select to authenticated using (true);

drop policy if exists "team levels are readable" on public.team_levels;
create policy "team levels are readable"
  on public.team_levels for select to authenticated using (true);

drop policy if exists "team type levels are readable" on public.team_type_levels;
create policy "team type levels are readable"
  on public.team_type_levels for select to authenticated using (true);

drop policy if exists "team type aliases are readable" on public.team_type_aliases;
create policy "team type aliases are readable"
  on public.team_type_aliases for select to authenticated using (true);

drop policy if exists "team level aliases are readable" on public.team_level_aliases;
create policy "team level aliases are readable"
  on public.team_level_aliases for select to authenticated using (true);


-- ============================================================
-- SEZIONE 4 — Il Team diventa stabile (§6, §17, §18)
--
-- Tre colonne, e nessuna di queste è un campo annuale.
--
-- `crest_mode` / `city_mode` trasformano l'ereditarietà da **copia** a
-- **modalità**. Oggi `EditTeamsModal` copia logo e città della prima squadra
-- dentro ogni giovanile: due valori uguali, nessuno che sappia dire se è una
-- scelta o un'eredità, e un cambio dello stemma societario che non raggiunge
-- nessuno. §17 è esplicito: «L'ereditarietà è una modalità persistente, non
-- una copia dell'immagine».
--
-- `version` è il controllo di concorrenza di §22 («usare versioni attese o
-- controllo equivalente per impedire sovrascritture silenziose»). Un intero
-- e non `updated_at`: due salvataggi nello stesso millisecondo esistono, e un
-- timestamp uguale non è un conflitto rilevato.
-- ============================================================

alter table public.club_teams
  add column if not exists crest_mode text not null default 'inherited',
  add column if not exists city_mode  text not null default 'inherited',
  add column if not exists version    integer not null default 1;

alter table public.club_teams
  drop constraint if exists club_teams_crest_mode_check;
alter table public.club_teams
  add constraint club_teams_crest_mode_check
  check (crest_mode in ('inherited', 'custom'));

alter table public.club_teams
  drop constraint if exists club_teams_city_mode_check;
alter table public.club_teams
  add constraint club_teams_city_mode_check
  check (city_mode in ('inherited', 'custom'));

create or replace function public.bump_row_version()
returns trigger
language plpgsql
as $$
begin
  new.version := coalesce(old.version, 0) + 1;
  return new;
end;
$$;

drop trigger if exists club_teams_bump_version on public.club_teams;
create trigger club_teams_bump_version
  before update on public.club_teams
  for each row execute function public.bump_row_version();


-- ============================================================
-- SEZIONE 5 — public.club_team_seasons (§6)
--
-- «Per la stessa coppia Team–stagione deve esistere al massimo una
-- configurazione canonica. Applicare il vincolo anche a livello persistente»:
-- la unique non è un indice di comodo, è la ragione per cui due
-- amministratori che creano insieme non producono due classificazioni dello
-- stesso anno (§20).
--
-- `level_id` è nullable perché §15 lo dichiara facoltativo. Nessun valore
-- sentinella "Non specificato": §16 lo vieta espressamente.
-- ============================================================

create table if not exists public.club_team_seasons (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.club_teams(id) on delete cascade,
  season_id    text not null references public.seasons(id),
  team_type_id text not null references public.team_types(id),
  level_id     text references public.team_levels(id),
  status       text not null default 'active'
                 check (status in ('active', 'archived')),
  version      integer not null default 1,
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now()),
  unique (team_id, season_id)
);

create index if not exists club_team_seasons_season_idx
  on public.club_team_seasons (season_id, team_id);

drop trigger if exists club_team_seasons_updated_at on public.club_team_seasons;
create trigger club_team_seasons_updated_at
  before update on public.club_team_seasons
  for each row execute function public.set_updated_at();

drop trigger if exists club_team_seasons_bump_version on public.club_team_seasons;
create trigger club_team_seasons_bump_version
  before update on public.club_team_seasons
  for each row execute function public.bump_row_version();

alter table public.club_team_seasons enable row level security;

-- La visibilità segue il Team: una configurazione stagionale non è più
-- riservata del Team a cui appartiene, e non è meno riservata.
drop policy if exists "team seasons follow team visibility" on public.club_team_seasons;
create policy "team seasons follow team visibility"
  on public.club_team_seasons for select
  using (
    exists (
      select 1
      from public.club_teams ct
      where ct.id = club_team_seasons.team_id
        and (
          (ct.is_public and not ct.is_archived)
          or public.can_manage_society(ct.club_id)
        )
    )
  );

drop policy if exists "society managers write team seasons" on public.club_team_seasons;
create policy "society managers write team seasons"
  on public.club_team_seasons for all
  using (
    exists (
      select 1 from public.club_teams ct
      where ct.id = club_team_seasons.team_id
        and public.can_manage_society(ct.club_id)
    )
  )
  with check (
    exists (
      select 1 from public.club_teams ct
      where ct.id = club_team_seasons.team_id
        and public.can_manage_society(ct.club_id)
    )
  );


-- ============================================================
-- SEZIONE 6 — Una sola fonte scrivibile (§28)
--
-- `club_teams.team_type` e `club_teams.category` restano: il profilo
-- pubblico, Cerca, le Posizioni e il Master Profile Società le leggono oggi e
-- riscrivere quelle superfici non appartiene a questo pack.
--
-- Da adesso però **non si scrivono a mano**. Questo trigger le riallinea
-- dalla configurazione della stagione corrente, così la classificazione ha
-- una fonte sola e le due colonne diventano una proiezione. Senza di lui
-- resterebbero due verità e §28 («mantenere una sola fonte scrivibile per
-- ogni campo») sarebbe violata dalla prima modifica.
--
-- Le stagioni non correnti non toccano la proiezione: §15 vuole che
-- modificare il campionato corrente non cambi lo storico, e una riga passata
-- che riscrivesse `category` farebbe esattamente il contrario.
-- ============================================================

create or replace function public.sync_club_team_classification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     public.club_team_seasons%rowtype;
  v_current text := public.current_season_id();
  v_tier    text;
  v_label   text;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  if v_current is null or v_row.season_id is distinct from v_current then
    return v_row;
  end if;

  if tg_op = 'DELETE' then
    -- La squadra resta, la classificazione corrente no. `category` non viene
    -- azzerata: diventerebbe una perdita di informazione sulle superfici
    -- pubbliche per un'operazione che riguarda la sola stagione.
    return old;
  end if;

  select t.tier into v_tier from public.team_types t where t.id = v_row.team_type_id;

  select coalesce(l.label, t.label) into v_label
  from public.team_types t
  left join public.team_levels l on l.id = v_row.level_id
  where t.id = v_row.team_type_id;

  update public.club_teams ct
     set team_type = coalesce(v_tier, ct.team_type),
         category  = coalesce(v_label, ct.category),
         season    = v_row.season_id
   where ct.id = v_row.team_id
     and (
       ct.team_type is distinct from coalesce(v_tier, ct.team_type)
       or ct.category is distinct from coalesce(v_label, ct.category)
       or ct.season is distinct from v_row.season_id
     );

  return v_row;
end;
$$;

drop trigger if exists club_team_seasons_sync_classification on public.club_team_seasons;
create trigger club_team_seasons_sync_classification
  after insert or update or delete on public.club_team_seasons
  for each row execute function public.sync_club_team_classification();


-- ============================================================
-- SEZIONE 7 — Ereditarietà: proiezione e propagazione (§17, §18)
--
-- `club_teams.logo_url`, `city` e `region` restano le colonne che profilo
-- pubblico, Cerca e organico leggono oggi. Cambiarne il significato avrebbe
-- richiesto di riscrivere quelle superfici, che questo pack non tocca.
--
-- Diventano quindi la **proiezione** del valore risolto: autorevoli quando la
-- modalità è `custom`, derivate dalla Società quando è `inherited`. La
-- modalità è il dato scrivibile; questo trigger tiene allineata la
-- proiezione quando cambia la parent, che è precisamente ciò che §17 chiede
-- («le squadre che lo ereditano leggono il nuovo valore; quelle
-- personalizzate conservano il proprio asset»).
--
-- `city` passa per il trigger `club_teams_geocode` della 20260725100000:
-- provincia e coordinate si riallineano da sole, senza una seconda geografia.
-- ============================================================

create or replace function public.propagate_club_inherited_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.logo_url is distinct from old.logo_url then
    update public.club_teams ct
       set logo_url = new.logo_url
     where ct.club_id = new.id
       and ct.crest_mode = 'inherited'
       and ct.logo_url is distinct from new.logo_url;
  end if;

  if new.city is distinct from old.city or new.region is distinct from old.region then
    update public.club_teams ct
       set city = new.city,
           region = new.region
     where ct.club_id = new.id
       and ct.city_mode = 'inherited'
       and (ct.city is distinct from new.city or ct.region is distinct from new.region);
  end if;

  return new;
end;
$$;

drop trigger if exists clubs_propagate_inherited_identity on public.clubs;
create trigger clubs_propagate_inherited_identity
  after update of logo_url, city, region on public.clubs
  for each row execute function public.propagate_club_inherited_identity();


-- ============================================================
-- SEZIONE 8 — Migrazione dei dati esistenti (§28)
--
-- Due attribuzioni, entrambe prudenti.
--
-- **Modalità.** `club_teams.inherited` non è un'uguaglianza osservata: è una
-- dichiarazione che `EditTeamsModal` scrive quando crea una giovanile che
-- eredita dalla prima squadra. Combinata con l'uguaglianza effettiva del
-- valore, è la «regola affidabile» che §28 richiede prima di dedurre
-- un'eredità. Fuori da quella combinazione un valore presente resta
-- `custom`: §28 ricorda che «due immagini o città uguali possono
-- rappresentare una personalizzazione intenzionale», e conservare un
-- override di troppo è reversibile, perderne uno no.
--
-- **Classificazione.** Viene creata una Team Season **solo** per i Team la
-- cui `season` è davvero la stagione corrente e il cui Tipo è determinabile
-- dalla tassonomia. Tutto il resto resta senza configurazione corrente e il
-- Centro lo mostra come "Stagione da configurare" (§7). §28 lo impone:
-- «Non attribuire automaticamente tutti i valori alla stagione corrente e
-- non replicare la classificazione su ogni anno».
--
-- Le ambiguità non vengono scartate in silenzio: il conteggio finisce nei
-- log della migrazione tramite `raise notice`.
-- ============================================================

do $$
declare
  v_current      text := public.current_season_id();
  v_configured   integer := 0;
  v_unattributed integer := 0;
begin
  -- ── modalità di stemma e città ──────────────────────────────────────
  update public.club_teams ct
     set crest_mode = case
           when ct.logo_url is null then 'inherited'
           when ct.inherited
                and ct.logo_url is not distinct from coalesce(
                      (select p.logo_url from public.club_teams p where p.id = ct.parent_team_id),
                      (select c.logo_url from public.clubs c where c.id = ct.club_id)
                    ) then 'inherited'
           else 'custom'
         end,
         city_mode = case
           when ct.city is null then 'inherited'
           when ct.inherited
                and ct.city is not distinct from coalesce(
                      (select p.city from public.club_teams p where p.id = ct.parent_team_id),
                      (select c.city from public.clubs c where c.id = ct.club_id)
                    ) then 'inherited'
           else 'custom'
         end;

  -- Allineamento della proiezione: `inherited` significa "il valore della
  -- Società". Le giovanili legacy copiavano la prima squadra, non il club, e
  -- lasciare la copia vecchia avrebbe mostrato nel Centro uno stemma diverso
  -- da quello che il form dichiara ereditato.
  update public.club_teams ct
     set logo_url = c.logo_url
    from public.clubs c
   where c.id = ct.club_id
     and ct.crest_mode = 'inherited'
     and ct.logo_url is distinct from c.logo_url;

  update public.club_teams ct
     set city = c.city,
         region = c.region
    from public.clubs c
   where c.id = ct.club_id
     and ct.city_mode = 'inherited'
     and (ct.city is distinct from c.city or ct.region is distinct from c.region);

  -- ── configurazione della stagione corrente ──────────────────────────
  if v_current is not null then
    insert into public.club_team_seasons (team_id, season_id, team_type_id, level_id)
    select
      resolved.id,
      v_current,
      resolved.type_id,
      resolved.level_id
    from (
      select
        ct.id,
        -- Tre fonti, nell'ordine in cui sono affidabili: la categoria
        -- dichiarata, il nome della squadra quando è letteralmente un Tipo
        -- della tassonomia ("Primavera" con categoria "Primavera 2"), e
        -- infine `team_type = 'senior'`, che nel vecchio modello poteva
        -- significare una cosa sola. Una squadra chiamata "Comashi" con
        -- categoria "Élite" resta senza Tipo e quindi senza configurazione:
        -- §28 preferisce il vuoto all'attribuzione inventata.
        coalesce(
          (select a.team_type_id
             from public.team_type_aliases a
            where a.alias_norm = public.footme_normalize_lookup(ct.category)),
          (select a.team_type_id
             from public.team_type_aliases a
            where a.alias_norm = public.footme_normalize_lookup(ct.name)),
          case when ct.team_type = 'senior' then 'first_team' end
        ) as type_id,
        (select al.level_id
           from public.team_level_aliases al
          where al.alias_norm = public.footme_normalize_lookup(ct.category)) as level_id
      from public.club_teams ct
      where ct.season = v_current
    ) resolved
    where resolved.type_id is not null
    on conflict (team_id, season_id) do nothing;

    get diagnostics v_configured = row_count;
  end if;

  select count(*) into v_unattributed
  from public.club_teams ct
  where not exists (
    select 1 from public.club_team_seasons cts
    where cts.team_id = ct.id
      and cts.season_id is not distinct from v_current
  );

  raise notice
    'DAS-REV-08: stagione corrente %, configurazioni create %, squadre senza configurazione corrente % (restano consultabili con "Stagione da configurare").',
    coalesce(v_current, 'non determinabile'), v_configured, v_unattributed;
end;
$$;


-- ============================================================
-- SEZIONE 9 — Segnalazione di categoria mancante (§16)
--
-- «Deve essere realmente persistita; il feedback di successo segue la
-- conferma backend.» Una tabella di raccolta, non un sistema amministrativo
-- di gestione tassonomie: la segnalazione non crea una categoria globale e
-- non diventa il valore libero del Team.
--
-- Il contesto minimo (Società, stagione, Tipo) serve a chi la leggerà per
-- capire di che campionato si parla. Il testo proposto resta dell'utente e
-- non entra in nessuna proiezione pubblica.
-- ============================================================

create table if not exists public.team_level_reports (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  team_id        uuid references public.club_teams(id) on delete set null,
  reporter_id    uuid not null references public.profiles(id) on delete cascade,
  season_id      text references public.seasons(id),
  team_type_id   text references public.team_types(id),
  proposed_label text not null,
  status         text not null default 'pending'
                   check (status in ('pending', 'reviewed', 'rejected')),
  created_at     timestamptz not null default timezone('utc', now())
);

create index if not exists team_level_reports_club_idx
  on public.team_level_reports (club_id, created_at desc);

alter table public.team_level_reports enable row level security;

drop policy if exists "reporters read own level reports" on public.team_level_reports;
create policy "reporters read own level reports"
  on public.team_level_reports for select to authenticated
  using (reporter_id = auth.uid());


-- ============================================================
-- SEZIONE 10 — Conferma duplicati e idempotenza (§20, §21)
--
-- Due tabelle piccole che risolvono due problemi diversi.
--
-- `team_duplicate_confirmations` è il «token contestuale validato dal
-- server» di §20. Contiene l'impronta dei dati **effettivamente
-- controllati**: se l'utente modifica il nome dopo l'avviso, l'impronta non
-- corrisponde più e il controllo si ripete. Un `force = true` generico
-- sarebbe un'autorizzazione permanente, che §20 vieta.
--
-- `team_create_requests` è l'idempotenza di §21. La chiave la genera il
-- client una volta per tentativo di creazione: doppio tap, timeout e retry
-- della stessa richiesta restituiscono lo stesso Team invece di crearne un
-- secondo, mentre una creazione esplicita di una seconda unità porta una
-- chiave nuova ed è legittima.
-- ============================================================

create table if not exists public.team_duplicate_confirmations (
  token       text primary key,
  club_id     uuid not null references public.clubs(id) on delete cascade,
  actor_id    uuid not null references public.profiles(id) on delete cascade,
  season_id   text not null references public.seasons(id),
  fingerprint text not null,
  team_id     uuid references public.club_teams(id) on delete cascade,
  created_at  timestamptz not null default timezone('utc', now())
);

create index if not exists team_duplicate_confirmations_created_idx
  on public.team_duplicate_confirmations (created_at);

create table if not exists public.team_create_requests (
  idempotency_key uuid primary key,
  club_id         uuid not null references public.clubs(id) on delete cascade,
  actor_id        uuid not null references public.profiles(id) on delete cascade,
  team_id         uuid not null references public.club_teams(id) on delete cascade,
  created_at      timestamptz not null default timezone('utc', now())
);

alter table public.team_duplicate_confirmations enable row level security;
alter table public.team_create_requests enable row level security;
-- Nessuna policy: si leggono e scrivono solo dalle funzioni SECURITY DEFINER
-- di questo file. Sono stato interno del protocollo, non dati del dominio.


-- ============================================================
-- SEZIONE 11 — Risoluzione del perimetro (§5)
--
-- Tre capability con perimetri indipendenti, sul modello di
-- `dashboard_club_capability_scope` (20261018090000): `teams_view` dice quali
-- squadre si consultano, `teams_edit` quali si modificano, `roster_view` di
-- quali si leggono i conteggi. Sommarli mostrerebbe i numeri di una squadra
-- che nessuno ha autorizzato a leggere.
--
-- `teams_create` non ha perimetro: si crea nella Società, non dentro una
-- squadra. Un grant limitato a una squadra non autorizza a crearne altre
-- (§5: «modificare un Team non implica creare altri Team»).
-- ============================================================

create or replace function public.can_create_club_team(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.owns_club(p_club_id)
    or exists (
      select 1
      from public.club_member_permissions perm
      join public.club_members cm
        on cm.club_id = perm.club_id
       and cm.profile_id = perm.profile_id
      where perm.club_id = p_club_id
        and perm.profile_id = auth.uid()
        and cm.status = 'active'
        and perm.permission_key = 'teams_create'
        and perm.team_id is null
    );
$$;

revoke all on function public.can_create_club_team(uuid) from public;
grant execute on function public.can_create_club_team(uuid) to authenticated;

create or replace function public.can_edit_club_team(p_team_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_scope uuid[];
begin
  select ct.club_id into v_club from public.club_teams ct where ct.id = p_team_id;

  if v_club is null then
    return false;
  end if;

  if public.owns_club(v_club) then
    return true;
  end if;

  v_scope := public.dashboard_club_capability_scope(v_club, 'teams_edit');

  -- `null` = nessuna restrizione, ma solo per chi quella chiave ce l'ha:
  -- la funzione restituisce `null` anche all'owner, già gestito sopra.
  if v_scope is null then
    return exists (
      select 1
      from public.club_member_permissions perm
      join public.club_members cm
        on cm.club_id = perm.club_id
       and cm.profile_id = perm.profile_id
      where perm.club_id = v_club
        and perm.profile_id = auth.uid()
        and cm.status = 'active'
        and perm.permission_key = 'teams_edit'
    );
  end if;

  return p_team_id = any (v_scope);
end;
$$;

revoke all on function public.can_edit_club_team(uuid) from public;
grant execute on function public.can_edit_club_team(uuid) to authenticated;


-- ============================================================
-- SEZIONE 12 — public.fetch_teams_center (§8, §25)
--
-- L'intestazione del Centro in una chiamata: contesto Società, stagione
-- corrente, perimetro, capability e **totale reale**.
--
-- §8 è esplicito sul totale: «deriva dal backend e usa gli stessi criteri
-- dell'elenco. Non deve coincidere necessariamente con il numero di righe già
-- caricate o visibili.» Per questo non è `count(righe della pagina)` ma una
-- count propria con lo stesso filtro.
--
-- Ogni colonna `null` significa "non autorizzato", mai zero (§25).
-- ============================================================

create or replace function public.fetch_teams_center(p_club_id uuid)
returns table (
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  club_is_verified   boolean,
  club_city          text,
  club_region        text,
  season_id          text,
  season_label       text,
  scope_label        text,
  can_view           boolean,
  can_create         boolean,
  can_view_counts    boolean,
  total_count        integer,
  inactive_count     integer,
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
  v_caps    text[];
  v_scope   uuid[];
  v_counts  uuid[];
  v_season  text := public.current_season_id();
  v_now     timestamptz := timezone('utc', now());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  if not ('teams_view' = any (v_caps)) then
    return query select
      p_club_id, null::text, null::text, null::boolean, null::text, null::text,
      v_season,
      (select s.label from public.seasons s where s.id = v_season),
      null::text,
      false, false, false,
      null::integer, null::integer,
      v_now,
      (extract(epoch from v_now) * 1000)::bigint;
    return;
  end if;

  v_scope  := public.dashboard_club_capability_scope(p_club_id, 'teams_view');
  v_counts := public.dashboard_club_capability_scope(p_club_id, 'roster_view');

  return query
  select
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    c.city,
    c.region,
    v_season,
    (select s.label from public.seasons s where s.id = v_season),
    public.dashboard_club_scope_label(p_club_id),
    true,
    public.can_create_club_team(p_club_id),
    -- Il perimetro dei conteggi è autonomo: può essere vuoto mentre quello
    -- delle squadre non lo è, e §10 chiede allora di omettere i numeri.
    (v_counts is null or coalesce(array_length(v_counts, 1), 0) > 0),
    (
      select count(*)::integer
      from public.club_teams ct
      where ct.club_id = p_club_id
        and not ct.is_archived
        and (v_scope is null or ct.id = any (v_scope))
    ),
    (
      select count(*)::integer
      from public.club_teams ct
      where ct.club_id = p_club_id
        and ct.is_archived
        and (v_scope is null or ct.id = any (v_scope))
    ),
    v_now,
    (extract(epoch from v_now) * 1000)::bigint
  from public.clubs c
  where c.id = p_club_id;
end;
$$;

revoke all on function public.fetch_teams_center(uuid) from public;
grant execute on function public.fetch_teams_center(uuid) to authenticated;

comment on function public.fetch_teams_center(uuid) is
  'DAS-REV-08 §8: intestazione del Centro Squadre — contesto Società, '
  'stagione canonica, perimetro, capability e totale reale con gli stessi '
  'criteri dell''elenco.';


-- ============================================================
-- SEZIONE 13 — public.fetch_teams_center_page (§8, §9, §10)
--
-- Una riga per squadra, paginata con un cursore deterministico (§8: «ordine
-- sportivo stabile … nessun riordino casuale al refresh»). La chiave è
-- costruita, non casuale: rango del Tipo, poi `sort_order`, poi nome, poi id.
--
-- Sui conteggi §10 chiede tre cose che il tipo di ritorno rende esplicite:
-- deduplicare le persone con più ruoli (`distinct` sull'identità, non sui
-- record), non promuovere inviti e candidature a organico (`status =
-- 'active'`), e distinguere assenza, zero ed errore —
-- `counts_available = false` è "non consultabile", `0` è zero.
--
-- La classificazione arriva dalla **stagione corrente**, con ID e label
-- separati (§25). `has_season_config = false` è lo stato "Stagione da
-- configurare" di §7, e non viene riempito con la classificazione dell'ultima
-- stagione.
-- ============================================================

create or replace function public.fetch_teams_center_page(
  p_club_id uuid,
  p_cursor  text default null,
  p_limit   integer default 20
)
returns table (
  team_id           uuid,
  name              text,
  crest_url         text,
  crest_inherited   boolean,
  type_id           text,
  type_label        text,
  level_id          text,
  level_label       text,
  has_season_config boolean,
  players_count     integer,
  staff_count       integer,
  counts_available  boolean,
  can_edit          boolean,
  sort_key          text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_caps   text[];
  v_scope  uuid[];
  v_counts uuid[];
  v_season text := public.current_season_id();
  v_limit  integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  if not ('teams_view' = any (v_caps)) then
    return;
  end if;

  v_scope  := public.dashboard_club_capability_scope(p_club_id, 'teams_view');
  v_counts := public.dashboard_club_capability_scope(p_club_id, 'roster_view');

  return query
  with team_rows as (
    select
      ct.id,
      ct.name,
      ct.logo_url,
      ct.crest_mode,
      cts.team_type_id,
      tt.label as type_label,
      cts.level_id,
      tl.label as level_label,
      (cts.id is not null) as has_config,
      lpad(
        (case when coalesce(tt.tier, ct.team_type) = 'senior' then 0 else 1 end)::text, 1, '0'
      )
      || '-' || lpad(coalesce(tt.sort_order, 999)::text, 4, '0')
      || '-' || lpad(greatest(0, least(ct.sort_order, 9999))::text, 4, '0')
      || '-' || public.footme_normalize_lookup(ct.name)
      || '-' || ct.id::text as sort_key
    from public.club_teams ct
    left join public.club_team_seasons cts
      on cts.team_id = ct.id
     and cts.season_id = v_season
    left join public.team_types tt on tt.id = cts.team_type_id
    left join public.team_levels tl on tl.id = cts.level_id
    where ct.club_id = p_club_id
      and not ct.is_archived
      and (v_scope is null or ct.id = any (v_scope))
  )
  select
    r.id,
    r.name,
    r.logo_url,
    r.crest_mode = 'inherited',
    r.team_type_id,
    r.type_label,
    r.level_id,
    r.level_label,
    r.has_config,
    case when v_counts is null or r.id = any (v_counts) then (
      select count(distinct coalesce(
               cm.profile_id::text,
               'manual:' || public.footme_normalize_lookup(cm.manual_name)
             ))::integer
      from public.club_members cm
      where cm.team_id = r.id
        and cm.status = 'active'
        and cm.is_current
        and cm.member_role = 'player'
    ) end,
    case when v_counts is null or r.id = any (v_counts) then (
      select count(distinct coalesce(
               cm.profile_id::text,
               'manual:' || public.footme_normalize_lookup(cm.manual_name)
             ))::integer
      from public.club_members cm
      where cm.team_id = r.id
        and cm.status = 'active'
        and cm.is_current
        and cm.member_role in ('coach', 'staff', 'director')
    ) end,
    (v_counts is null or r.id = any (v_counts)),
    public.can_edit_club_team(r.id),
    r.sort_key
  from team_rows r
  where p_cursor is null or r.sort_key > p_cursor
  order by r.sort_key
  limit v_limit;
end;
$$;

revoke all on function public.fetch_teams_center_page(uuid, text, integer) from public;
grant execute on function public.fetch_teams_center_page(uuid, text, integer) to authenticated;


-- ============================================================
-- SEZIONE 14 — Tassonomia per il form (§15, §16)
--
-- Due letture separate perché sono due domande separate: quali Tipi esistono,
-- e quali Livelli sono compatibili **con quel Tipo in quella stagione**. Un
-- solo endpoint che restituisse l'albero intero avrebbe riportato i
-- campionati incompatibili dentro il client, dove nessuno li filtra.
-- ============================================================

create or replace function public.fetch_team_type_options()
returns table (id text, label text, sort_order integer)
language sql
stable
set search_path = public
as $$
  select t.id, t.label, t.sort_order
  from public.team_types t
  where t.is_active
  order by t.sort_order;
$$;

grant execute on function public.fetch_team_type_options() to authenticated;

create or replace function public.fetch_team_level_options(
  p_type_id   text,
  p_season_id text default null,
  p_query     text default null
)
returns table (id text, label text, sort_order integer, is_active boolean)
language sql
stable
set search_path = public
as $$
  select l.id, l.label, ttl.sort_order, l.is_active
  from public.team_type_levels ttl
  join public.team_levels l on l.id = ttl.level_id
  where ttl.team_type_id = p_type_id
    and l.is_active
    and (
      p_query is null
      or public.footme_normalize_lookup(p_query) = ''
      or public.footme_normalize_lookup(l.label)
         like '%' || public.footme_normalize_lookup(p_query) || '%'
    )
  order by ttl.sort_order, l.label;
$$;

grant execute on function public.fetch_team_level_options(text, text, text) to authenticated;


-- ============================================================
-- SEZIONE 15 — public.fetch_team_editor (§13, §22)
--
-- Il payload della modifica: dati reali, **modalità** di ereditarietà e
-- versioni attese. Le versioni sono parte del contratto, non un dettaglio:
-- senza di loro §22 («impedire sovrascritture silenziose tra amministratori»)
-- non è implementabile dal client.
--
-- `season_config_id` nullo è il Team senza configurazione corrente di §7: il
-- form lo riconosce e non crea la stagione mancante come effetto implicito.
-- ============================================================

create or replace function public.fetch_team_editor(p_team_id uuid)
returns table (
  team_id          uuid,
  club_id          uuid,
  club_name        text,
  club_logo_url    text,
  club_city        text,
  club_region      text,
  club_is_verified boolean,
  name             text,
  crest_mode       text,
  crest_url        text,
  city_mode        text,
  city             text,
  region           text,
  province         text,
  season_id        text,
  season_label     text,
  season_config_id uuid,
  type_id          text,
  type_label       text,
  level_id         text,
  level_label      text,
  team_version     integer,
  season_version   integer,
  can_edit         boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_club   uuid;
  v_season text := public.current_season_id();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select ct.club_id into v_club from public.club_teams ct where ct.id = p_team_id;

  if v_club is null then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  -- §12: «I deep link ai form rivalidano accesso, parent e Team ID.»
  if not ('teams_view' = any (public.dashboard_club_capabilities(v_club))) then
    raise exception 'TEAM_NOT_AUTHORIZED';
  end if;

  if not public.can_edit_club_team(p_team_id) then
    raise exception 'TEAM_NOT_AUTHORIZED';
  end if;

  return query
  select
    ct.id,
    c.id,
    c.name,
    c.logo_url,
    c.city,
    c.region,
    coalesce(c.verification_status, 'unverified') = 'verified',
    ct.name,
    ct.crest_mode,
    ct.logo_url,
    ct.city_mode,
    ct.city,
    ct.region,
    ct.province,
    v_season,
    (select s.label from public.seasons s where s.id = v_season),
    cts.id,
    cts.team_type_id,
    tt.label,
    cts.level_id,
    tl.label,
    ct.version,
    cts.version,
    true
  from public.club_teams ct
  join public.clubs c on c.id = ct.club_id
  left join public.club_team_seasons cts
    on cts.team_id = ct.id and cts.season_id = v_season
  left join public.team_types tt on tt.id = cts.team_type_id
  left join public.team_levels tl on tl.id = cts.level_id
  where ct.id = p_team_id;
end;
$$;

revoke all on function public.fetch_team_editor(uuid) from public;
grant execute on function public.fetch_team_editor(uuid) to authenticated;


-- ============================================================
-- SEZIONE 16 — Rilevazione dei duplicati (§19, §20)
--
-- Tre esiti distinti, come §19 richiede:
--
--   `clear`    nessuna somiglianza;
--   `warning`  somiglianza superabile — il dominio ammette una seconda unità
--              (Under 17 A e Under 17 B sono legittime);
--   `conflict` vincolo reale e bloccante.
--
-- L'unico conflitto bloccante che il dominio possiede davvero è
-- `club_teams_one_senior` (20260324000000): una sola prima squadra per
-- Società. Non viene inventato un vincolo di unicità sul nome, che §19 vieta
-- espressamente di dedurre dalla somiglianza.
--
-- I candidati restituiti sono **solo** quelli consultabili dall'actor. Se il
-- vincolo coinvolge una risorsa fuori perimetro l'esito resta `conflict` ma
-- senza nome, id o metadata (§19, §25).
--
-- Il token di conferma viene emesso solo per `warning` ed è legato
-- all'impronta dei dati controllati: cambiare il nome dopo l'avviso rende il
-- token inutilizzabile (§20, test 18).
-- ============================================================

create or replace function public.team_duplicate_fingerprint(
  p_name     text,
  p_type_id  text,
  p_level_id text,
  p_team_id  uuid
)
returns text
language sql
immutable
set search_path = public
as $$
  select public.footme_normalize_lookup(p_name)
    || '|' || coalesce(p_type_id, '')
    || '|' || coalesce(p_level_id, '')
    || '|' || coalesce(p_team_id::text, 'new');
$$;

create or replace function public.check_club_team_duplicates(
  p_club_id  uuid,
  p_name     text,
  p_type_id  text,
  p_level_id text default null,
  p_team_id  uuid default null
)
returns table (
  verdict            text,
  confirmation_token text,
  candidates         jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_season      text := public.current_season_id();
  v_scope       uuid[];
  v_tier        text;
  v_senior_id   uuid;
  v_candidates  jsonb := '[]'::jsonb;
  v_verdict     text := 'clear';
  v_token       text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not ('teams_view' = any (public.dashboard_club_capabilities(p_club_id))) then
    raise exception 'TEAM_NOT_AUTHORIZED';
  end if;

  if v_season is null then
    raise exception 'TEAM_SEASON_UNAVAILABLE';
  end if;

  v_scope := public.dashboard_club_capability_scope(p_club_id, 'teams_view');

  select t.tier into v_tier from public.team_types t where t.id = p_type_id;

  -- ── vincolo reale: una sola prima squadra ───────────────────────────
  if v_tier = 'senior' then
    select ct.id into v_senior_id
    from public.club_teams ct
    where ct.club_id = p_club_id
      and ct.team_type = 'senior'
      and (p_team_id is null or ct.id <> p_team_id)
    limit 1;

    if v_senior_id is not null then
      return query select
        'conflict'::text,
        null::text,
        case
          when v_scope is null or v_senior_id = any (v_scope) then (
            select jsonb_build_array(jsonb_build_object(
              'id', ct.id, 'name', ct.name, 'crest_url', ct.logo_url,
              'type_label', coalesce(tt.label, 'Prima squadra'),
              'level_label', tl.label
            ))
            from public.club_teams ct
            left join public.club_team_seasons cts
              on cts.team_id = ct.id and cts.season_id = v_season
            left join public.team_types tt on tt.id = cts.team_type_id
            left join public.team_levels tl on tl.id = cts.level_id
            where ct.id = v_senior_id
          )
          -- Fuori perimetro: errore controllato, nessun metadato (§19).
          else '[]'::jsonb
        end;
      return;
    end if;
  end if;

  -- ── somiglianza superabile ──────────────────────────────────────────
  select coalesce(jsonb_agg(item), '[]'::jsonb) into v_candidates
  from (
    select jsonb_build_object(
      'id',          ct.id,
      'name',        ct.name,
      'crest_url',   ct.logo_url,
      'type_label',  tt.label,
      'level_label', tl.label
    ) as item
    from public.club_teams ct
    left join public.club_team_seasons cts
      on cts.team_id = ct.id and cts.season_id = v_season
    left join public.team_types tt on tt.id = cts.team_type_id
    left join public.team_levels tl on tl.id = cts.level_id
    where ct.club_id = p_club_id
      and not ct.is_archived
      and (p_team_id is null or ct.id <> p_team_id)
      and (v_scope is null or ct.id = any (v_scope))
      and (
        public.footme_normalize_lookup(ct.name)
          = public.footme_normalize_lookup(p_name)
        or (
          cts.team_type_id is not distinct from p_type_id
          and cts.level_id is not distinct from p_level_id
          and cts.team_type_id is not null
        )
      )
    limit 5
  ) matches;

  if jsonb_array_length(v_candidates) > 0 then
    v_verdict := 'warning';
    v_token := gen_random_uuid()::text;

    insert into public.team_duplicate_confirmations
      (token, club_id, actor_id, season_id, fingerprint, team_id)
    values (
      v_token, p_club_id, v_uid, v_season,
      public.team_duplicate_fingerprint(p_name, p_type_id, p_level_id, p_team_id),
      p_team_id
    );
  end if;

  -- Igiene: i token vivono quanto una sessione di compilazione.
  delete from public.team_duplicate_confirmations
  where created_at < timezone('utc', now()) - interval '2 hours';

  return query select v_verdict, v_token, v_candidates;
end;
$$;

revoke all on function public.check_club_team_duplicates(uuid, text, text, text, uuid) from public;
grant execute on function public.check_club_team_duplicates(uuid, text, text, text, uuid) to authenticated;


-- ============================================================
-- SEZIONE 17 — Validazioni condivise (§17, §18, §24)
--
-- Le stesse regole valgono in creazione e in modifica, quindi vivono in un
-- posto solo: §24 vuole il backend come autorità finale, e due copie della
-- regola sarebbero due autorità.
-- ============================================================

-- §17: «Non accettare riferimenti ad asset di contesti non autorizzati.»
-- L'upload del prodotto scrive sotto `profile-media/<uid>/…`: un URL che non
-- appartiene alla cartella dell'actor è un asset di qualcun altro.
create or replace function public.team_asset_is_authorized(p_url text)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_url is not null
     and p_url <> ''
     and position('/profile-media/' || auth.uid()::text || '/' in p_url) > 0;
$$;

grant execute on function public.team_asset_is_authorized(text) to authenticated;

-- §18: si salva il riferimento geografico canonico, non la stringa digitata.
-- Un comune italiano porta con sé la propria regione; una località estera
-- prevista dal prodotto arriva già con la sua, e viene accettata solo se
-- entrambe le parti ci sono.
create or replace function public.resolve_team_city(
  p_city   text,
  p_region text
)
returns table (city text, region text)
language plpgsql
stable
set search_path = public
as $$
declare
  v_city   text := nullif(trim(coalesce(p_city, '')), '');
  v_region text := nullif(trim(coalesce(p_region, '')), '');
  v_match  record;
begin
  if v_city is null then
    raise exception 'TEAM_CITY_INVALID';
  end if;

  select ic.name, ic.region into v_match
  from public.italian_comuni ic
  where ic.name_norm = public.footme_normalize_lookup(v_city)
  limit 1;

  if found then
    return query select v_match.name, v_match.region;
    return;
  end if;

  if v_region is null then
    raise exception 'TEAM_CITY_INVALID';
  end if;

  return query select v_city, v_region;
end;
$$;

grant execute on function public.resolve_team_city(text, text) to authenticated;


-- ============================================================
-- SEZIONE 18 — public.create_club_team (§13, §20, §21)
--
-- Una singola operazione coerente: una funzione plpgsql è già una
-- transazione, quindi un errore sulla configurazione stagionale non lascia
-- dietro di sé un Team senza stagione (§21).
--
-- L'ordine dei controlli non è casuale. L'idempotenza viene **prima** dei
-- duplicati: un retry della stessa richiesta non deve ripresentare un avviso
-- già superato né creare una seconda unità (§21, test 20).
-- ============================================================

create or replace function public.create_club_team(
  p_club_id         uuid,
  p_name            text,
  p_type_id         text,
  p_level_id        text default null,
  p_season_id       text default null,
  p_crest_mode      text default 'inherited',
  p_crest_url       text default null,
  p_city_mode       text default 'inherited',
  p_city            text default null,
  p_region          text default null,
  p_confirmation    text default null,
  p_idempotency_key uuid default null
)
returns table (team_id uuid, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_season    text := public.current_season_id();
  v_name      text := nullif(trim(coalesce(p_name, '')), '');
  v_tier      text;
  v_existing  uuid;
  v_club      public.clubs%rowtype;
  v_logo      text;
  v_city      text;
  v_region    text;
  v_check     record;
  v_conf      record;
  v_team      uuid;
  v_order     integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_create_club_team(p_club_id) then
    raise exception 'TEAM_NOT_AUTHORIZED';
  end if;

  -- §7: la stagione non è un campo del form. Se la sorgente centrale non la
  -- sa dire, il submit si blocca invece di chiedere all'utente di inventarla.
  if v_season is null then
    raise exception 'TEAM_SEASON_UNAVAILABLE';
  end if;

  if p_season_id is not null and p_season_id is distinct from v_season then
    raise exception 'TEAM_SEASON_CHANGED';
  end if;

  -- §21: idempotenza prima di tutto il resto.
  if p_idempotency_key is not null then
    select r.team_id into v_existing
    from public.team_create_requests r
    where r.idempotency_key = p_idempotency_key
      and r.actor_id = v_uid;

    if v_existing is not null then
      return query select v_existing, false;
      return;
    end if;
  end if;

  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'TEAM_NAME_INVALID';
  end if;

  select t.tier into v_tier
  from public.team_types t
  where t.id = p_type_id and t.is_active;

  if v_tier is null then
    raise exception 'TEAM_TYPE_INVALID';
  end if;

  if p_level_id is not null and not exists (
    select 1 from public.team_type_levels ttl
    join public.team_levels l on l.id = ttl.level_id
    where ttl.team_type_id = p_type_id
      and ttl.level_id = p_level_id
      and l.is_active
  ) then
    raise exception 'TEAM_LEVEL_INCOMPATIBLE';
  end if;

  select * into v_club from public.clubs where id = p_club_id;

  -- ── stemma (§17) ────────────────────────────────────────────────────
  if p_crest_mode = 'custom' then
    if not public.team_asset_is_authorized(p_crest_url) then
      raise exception 'TEAM_ASSET_INVALID';
    end if;
    v_logo := p_crest_url;
  elsif p_crest_mode = 'inherited' then
    v_logo := v_club.logo_url;
  else
    raise exception 'TEAM_CREST_MODE_INVALID';
  end if;

  -- ── città (§18) ─────────────────────────────────────────────────────
  if p_city_mode = 'custom' then
    select r.city, r.region into v_city, v_region
    from public.resolve_team_city(p_city, p_region) r;
  elsif p_city_mode = 'inherited' then
    v_city := v_club.city;
    v_region := v_club.region;
  else
    raise exception 'TEAM_CITY_MODE_INVALID';
  end if;

  -- ── duplicati (§19, §20) ────────────────────────────────────────────
  select * into v_check
  from public.check_club_team_duplicates(p_club_id, v_name, p_type_id, p_level_id, null);

  if v_check.verdict = 'conflict' then
    raise exception 'TEAM_DUPLICATE_CONFLICT';
  end if;

  if v_check.verdict = 'warning' then
    if p_confirmation is null then
      raise exception 'TEAM_CONFIRMATION_REQUIRED';
    end if;

    select * into v_conf
    from public.team_duplicate_confirmations tc
    where tc.token = p_confirmation
      and tc.actor_id = v_uid
      and tc.club_id = p_club_id
      and tc.season_id = v_season
      and tc.fingerprint =
          public.team_duplicate_fingerprint(v_name, p_type_id, p_level_id, null)
      and tc.created_at > timezone('utc', now()) - interval '2 hours';

    if not found then
      -- Dati cambiati dopo l'avviso, oppure token di un altro contesto: §20
      -- vieta di accettarlo come autorizzazione permanente.
      raise exception 'TEAM_CONFIRMATION_STALE';
    end if;

    delete from public.team_duplicate_confirmations where token = p_confirmation;
  end if;

  select coalesce(max(ct.sort_order), 0) + 1 into v_order
  from public.club_teams ct
  where ct.club_id = p_club_id;

  insert into public.club_teams (
    club_id, name, category, team_type, inherited,
    logo_url, city, region, sort_order, season,
    crest_mode, city_mode
  ) values (
    p_club_id,
    v_name,
    coalesce(
      (select l.label from public.team_levels l where l.id = p_level_id),
      (select t.label from public.team_types t where t.id = p_type_id)
    ),
    v_tier,
    p_crest_mode = 'inherited' and p_city_mode = 'inherited',
    v_logo,
    v_city,
    v_region,
    v_order,
    v_season,
    p_crest_mode,
    p_city_mode
  )
  returning id into v_team;

  insert into public.club_team_seasons (team_id, season_id, team_type_id, level_id)
  values (v_team, v_season, p_type_id, p_level_id);

  if p_idempotency_key is not null then
    insert into public.team_create_requests
      (idempotency_key, club_id, actor_id, team_id)
    values (p_idempotency_key, p_club_id, v_uid, v_team);
  end if;

  return query select v_team, true;
end;
$$;

revoke all on function public.create_club_team(
  uuid, text, text, text, text, text, text, text, text, text, text, uuid
) from public;
grant execute on function public.create_club_team(
  uuid, text, text, text, text, text, text, text, text, text, text, uuid
) to authenticated;


-- ============================================================
-- SEZIONE 19 — public.update_club_team (§13, §15, §22)
--
-- La patch è un `jsonb` e non una lista di parametri nullable, per una
-- ragione che §22 scrive a lettere: «Omettere i campi non modificati; non
-- sostituirli con null provenienti da un caricamento fallito». Con parametri
-- nullable "assente" e "svuotato" sono lo stesso valore; con un oggetto, la
-- presenza della chiave è il consenso esplicito a scrivere quel campo.
--
-- Le versioni attese sono due perché i livelli sono due: rinominare il Team e
-- cambiarne il campionato toccano righe diverse, e un conflitto su una non è
-- un conflitto sull'altra.
--
-- §15: «La modifica riguarda esclusivamente la configurazione corrente
-- identificata. Le stagioni precedenti e future restano inalterate.» La
-- `where` sulla sola `season_id = corrente` è quella garanzia.
-- ============================================================

create or replace function public.update_club_team(
  p_team_id                 uuid,
  p_patch                   jsonb,
  p_expected_team_version   integer default null,
  p_expected_season_version integer default null,
  p_season_id               text default null,
  p_confirmation            text default null
)
returns table (team_version integer, season_version integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_season     text := public.current_season_id();
  v_team       public.club_teams%rowtype;
  v_config     public.club_team_seasons%rowtype;
  v_club       public.clubs%rowtype;
  v_name       text;
  v_type       text;
  v_level      text;
  v_level_set  boolean := false;
  v_tier       text;
  v_crest_mode text;
  v_city_mode  text;
  v_logo       text;
  v_city       text;
  v_region     text;
  v_touch_team boolean := false;
  v_check      record;
  v_conf       record;
  v_new_team_version   integer;
  v_new_season_version integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_edit_club_team(p_team_id) then
    raise exception 'TEAM_NOT_AUTHORIZED';
  end if;

  if v_season is null then
    raise exception 'TEAM_SEASON_UNAVAILABLE';
  end if;

  if p_season_id is not null and p_season_id is distinct from v_season then
    raise exception 'TEAM_SEASON_CHANGED';
  end if;

  select * into v_team from public.club_teams where id = p_team_id;
  select * into v_club from public.clubs where id = v_team.club_id;

  select * into v_config
  from public.club_team_seasons
  where team_id = p_team_id and season_id = v_season;

  if p_expected_team_version is not null
     and v_team.version is distinct from p_expected_team_version then
    raise exception 'TEAM_VERSION_CONFLICT';
  end if;

  if v_config.id is not null
     and p_expected_season_version is not null
     and v_config.version is distinct from p_expected_season_version then
    raise exception 'TEAM_VERSION_CONFLICT';
  end if;

  -- ── campi stabili del Team ──────────────────────────────────────────
  v_name       := v_team.name;
  v_crest_mode := v_team.crest_mode;
  v_city_mode  := v_team.city_mode;
  v_logo       := v_team.logo_url;
  v_city       := v_team.city;
  v_region     := v_team.region;

  if p_patch ? 'name' then
    v_name := nullif(trim(coalesce(p_patch->>'name', '')), '');
    if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 80 then
      raise exception 'TEAM_NAME_INVALID';
    end if;
    v_touch_team := v_name is distinct from v_team.name;
  end if;

  if p_patch ? 'crest_mode' then
    v_crest_mode := p_patch->>'crest_mode';

    if v_crest_mode = 'custom' then
      if not (p_patch ? 'crest_url') then
        -- Modalità personalizzata senza asset pronto: §17 blocca il submit
        -- relativo a quella scelta invece di salvare metà decisione.
        if v_team.crest_mode <> 'custom' then
          raise exception 'TEAM_ASSET_INVALID';
        end if;
      else
        if not public.team_asset_is_authorized(p_patch->>'crest_url') then
          raise exception 'TEAM_ASSET_INVALID';
        end if;
        v_logo := p_patch->>'crest_url';
      end if;
    elsif v_crest_mode = 'inherited' then
      -- Rimuovere l'override non cancella nessun asset: §17 vieta di
      -- eliminare lo stemma parent o un file condiviso.
      v_logo := v_club.logo_url;
    else
      raise exception 'TEAM_CREST_MODE_INVALID';
    end if;

    v_touch_team := true;
  elsif p_patch ? 'crest_url' and v_team.crest_mode = 'custom' then
    if not public.team_asset_is_authorized(p_patch->>'crest_url') then
      raise exception 'TEAM_ASSET_INVALID';
    end if;
    v_logo := p_patch->>'crest_url';
    v_touch_team := true;
  end if;

  if p_patch ? 'city_mode' then
    v_city_mode := p_patch->>'city_mode';

    if v_city_mode = 'custom' then
      select r.city, r.region into v_city, v_region
      from public.resolve_team_city(
        coalesce(p_patch->>'city', v_team.city),
        coalesce(p_patch->>'region', v_team.region)
      ) r;
    elsif v_city_mode = 'inherited' then
      v_city := v_club.city;
      v_region := v_club.region;
    else
      raise exception 'TEAM_CITY_MODE_INVALID';
    end if;

    v_touch_team := true;
  elsif p_patch ? 'city' and v_team.city_mode = 'custom' then
    select r.city, r.region into v_city, v_region
    from public.resolve_team_city(
      p_patch->>'city',
      coalesce(p_patch->>'region', v_team.region)
    ) r;
    v_touch_team := true;
  end if;

  -- ── configurazione stagionale ───────────────────────────────────────
  v_type  := v_config.team_type_id;
  v_level := v_config.level_id;

  if p_patch ? 'type_id' or p_patch ? 'level_id' then
    -- §13: «Tipo e Livello non devono creare una configurazione stagionale
    -- tramite un effetto implicito del form.»
    if v_config.id is null then
      raise exception 'TEAM_NO_SEASON_CONFIG';
    end if;

    if p_patch ? 'type_id' then
      v_type := p_patch->>'type_id';

      select t.tier into v_tier
      from public.team_types t where t.id = v_type and t.is_active;

      if v_tier is null then
        raise exception 'TEAM_TYPE_INVALID';
      end if;
    end if;

    if p_patch ? 'level_id' then
      v_level := nullif(p_patch->>'level_id', '');
      v_level_set := true;
    end if;

    if v_level is not null and not exists (
      select 1 from public.team_type_levels ttl
      join public.team_levels l on l.id = ttl.level_id
      where ttl.team_type_id = v_type
        and ttl.level_id = v_level
        and (l.is_active or not v_level_set)
    ) then
      raise exception 'TEAM_LEVEL_INCOMPATIBLE';
    end if;
  end if;

  -- ── duplicati sulla nuova forma (§19) ───────────────────────────────
  if v_name is distinct from v_team.name
     or v_type is distinct from v_config.team_type_id
     or v_level is distinct from v_config.level_id then

    select * into v_check
    from public.check_club_team_duplicates(
      v_team.club_id, v_name, v_type, v_level, p_team_id
    );

    if v_check.verdict = 'conflict' then
      raise exception 'TEAM_DUPLICATE_CONFLICT';
    end if;

    if v_check.verdict = 'warning' then
      if p_confirmation is null then
        raise exception 'TEAM_CONFIRMATION_REQUIRED';
      end if;

      select * into v_conf
      from public.team_duplicate_confirmations tc
      where tc.token = p_confirmation
        and tc.actor_id = v_uid
        and tc.club_id = v_team.club_id
        and tc.season_id = v_season
        and tc.fingerprint =
            public.team_duplicate_fingerprint(v_name, v_type, v_level, p_team_id)
        and tc.created_at > timezone('utc', now()) - interval '2 hours';

      if not found then
        raise exception 'TEAM_CONFIRMATION_STALE';
      end if;

      delete from public.team_duplicate_confirmations where token = p_confirmation;
    end if;
  end if;

  -- ── scrittura ───────────────────────────────────────────────────────
  if v_touch_team then
    update public.club_teams
       set name       = v_name,
           crest_mode = v_crest_mode,
           city_mode  = v_city_mode,
           logo_url   = v_logo,
           city       = v_city,
           region     = v_region,
           inherited  = (v_crest_mode = 'inherited' and v_city_mode = 'inherited')
     where id = p_team_id;
  end if;

  if v_config.id is not null
     and (v_type is distinct from v_config.team_type_id
          or v_level is distinct from v_config.level_id) then
    update public.club_team_seasons
       set team_type_id = v_type,
           level_id     = v_level
     where id = v_config.id
       and season_id = v_season;
  end if;

  select ct.version into v_new_team_version
  from public.club_teams ct where ct.id = p_team_id;

  select cts.version into v_new_season_version
  from public.club_team_seasons cts
  where cts.team_id = p_team_id and cts.season_id = v_season;

  return query select v_new_team_version, v_new_season_version;
end;
$$;

revoke all on function public.update_club_team(uuid, jsonb, integer, integer, text, text) from public;
grant execute on function public.update_club_team(uuid, jsonb, integer, integer, text, text) to authenticated;


-- ============================================================
-- SEZIONE 20 — public.report_missing_team_level (§16)
--
-- «La segnalazione utilizza il canale strutturato condiviso … Deve essere
-- realmente persistita; il feedback di successo segue la conferma backend.»
--
-- Non crea una categoria globale, non diventa il valore del Team e non è
-- obbligatoria per proseguire: una riga di raccolta e nient'altro.
-- ============================================================

create or replace function public.report_missing_team_level(
  p_club_id      uuid,
  p_proposed     text,
  p_type_id      text default null,
  p_team_id      uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_label    text := nullif(trim(coalesce(p_proposed, '')), '');
  v_id       uuid;
  v_recent   integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not ('teams_view' = any (public.dashboard_club_capabilities(p_club_id))) then
    raise exception 'TEAM_NOT_AUTHORIZED';
  end if;

  if v_label is null or char_length(v_label) < 2 or char_length(v_label) > 80 then
    raise exception 'TEAM_LEVEL_REPORT_INVALID';
  end if;

  -- Stesso limite di cortesia degli inviti assistito (20261002160000): la
  -- raccolta è aperta, non illimitata.
  select count(*)::integer into v_recent
  from public.team_level_reports r
  where r.reporter_id = v_uid
    and r.created_at > timezone('utc', now()) - interval '1 hour';

  if v_recent >= 10 then
    raise exception 'RATE_LIMIT';
  end if;

  insert into public.team_level_reports
    (club_id, team_id, reporter_id, season_id, team_type_id, proposed_label)
  values (
    p_club_id, p_team_id, v_uid, public.current_season_id(), p_type_id, v_label
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.report_missing_team_level(uuid, text, text, uuid) from public;
grant execute on function public.report_missing_team_level(uuid, text, text, uuid) to authenticated;


-- ============================================================
-- SEZIONE 21 — public.dashboard_club_capabilities (rimpiazzo)
--
-- Le tre chiavi di §5 devono **arrivare** alla Dashboard, non solo essere
-- concedibili: la funzione legge un elenco esplicito, e una chiave assente da
-- quell'elenco è una chiave che nessuno vedrà mai anche dopo averla concessa.
--
-- L'owner le riceve tutte, come già per le altre: `owns_club` è l'accesso
-- implicito del proprietario, non un grant da creare.
--
-- Identica nella forma alla 20261018090000 — stessa query, stesso
-- `security definer`, stessa lista nei due rami — per non far divergere il
-- ramo owner da quello dei membri.
-- ============================================================

create or replace function public.dashboard_club_capabilities(p_club_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.owns_club(p_club_id) then array[
      'dashboard_view',
      'positions_view',
      'positions_create',
      'applications_view',
      'teams_view',
      'teams_create',
      'teams_edit',
      'roster_view',
      'content_view',
      'content_create',
      'invites_create',
      'invites_view',
      'shortlist_view'
    ]::text[]
    else coalesce(
      (
        select array_agg(distinct perm.permission_key order by perm.permission_key)
        from public.club_member_permissions perm
        join public.club_members cm
          on cm.club_id = perm.club_id
          and cm.profile_id = perm.profile_id
        where perm.club_id = p_club_id
          and perm.profile_id = auth.uid()
          and cm.status = 'active'
          and perm.permission_key in (
            'dashboard_view',
            'positions_view',
            'positions_create',
            'applications_view',
            'teams_view',
            'teams_create',
            'teams_edit',
            'roster_view',
            'content_view',
            'content_create',
            'invites_create',
            'invites_view',
            'shortlist_view'
          )
      ),
      array[]::text[]
    )
  end;
$$;

revoke all on function public.dashboard_club_capabilities(uuid) from public;
grant execute on function public.dashboard_club_capabilities(uuid) to authenticated;


-- ============================================================
-- SEZIONE 22 — public.dashboard_club_scope (rimpiazzo)
--
-- Solo l'elenco delle chiavi cambia: l'etichetta «Ambito: …» descrive dove
-- l'actor sta operando nel suo complesso, e un amministratore autorizzato
-- alla sola Primavera lo è ormai anche attraverso `teams_edit` e
-- `roster_view`. Lasciarle fuori avrebbe prodotto un "Ambito" assente proprio
-- nello scenario del master 08.
--
-- `teams_create` non compare: non ha perimetro di squadra per costruzione
-- (§5), e includerlo non cambierebbe nulla se non confondere la lettura.
--
-- Resta vero che questa funzione **non filtra dati**: per quello serve
-- `dashboard_club_capability_scope`, che non somma capability diverse.
-- ============================================================

create or replace function public.dashboard_club_scope(p_club_id uuid)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dashboard_keys text[] := array[
    'dashboard_view',
    'positions_view',
    'positions_create',
    'applications_view',
    'teams_view',
    'teams_edit',
    'roster_view',
    'content_view',
    'content_create',
    'invites_create',
    'invites_view'
  ];
  v_teams uuid[];
begin
  if public.owns_club(p_club_id) then
    return null;
  end if;

  if exists (
    select 1
    from public.club_member_permissions perm
    join public.club_members cm
      on cm.club_id = perm.club_id
      and cm.profile_id = perm.profile_id
    where perm.club_id = p_club_id
      and perm.profile_id = auth.uid()
      and cm.status = 'active'
      and perm.team_id is null
      and perm.permission_key = any (v_dashboard_keys)
  ) then
    return null;
  end if;

  select array_agg(distinct perm.team_id)
    into v_teams
  from public.club_member_permissions perm
  join public.club_members cm
    on cm.club_id = perm.club_id
    and cm.profile_id = perm.profile_id
  join public.club_teams ct
    on ct.id = perm.team_id
    and ct.club_id = perm.club_id
  where perm.club_id = p_club_id
    and perm.profile_id = auth.uid()
    and cm.status = 'active'
    and perm.team_id is not null
    and perm.permission_key = any (v_dashboard_keys);

  return v_teams;
end;
$$;

revoke all on function public.dashboard_club_scope(uuid) from public;
grant execute on function public.dashboard_club_scope(uuid) to authenticated;
