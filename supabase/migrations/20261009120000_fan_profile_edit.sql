-- REV-PROF-20 — Modifica profilo Tifoso.
--
-- REV-PROF-19 ha chiuso `fan_profiles` ai visitatori e ha fatto uscire il
-- sottoinsieme pubblicabile da una RPC con proiezione esplicita. Quella
-- proiezione però pubblicava *tutto* ciò che era pubblicabile: squadra del
-- cuore, interessi e categorie comparivano nella tab Info per il solo fatto
-- di esistere. L'editor introduce una scelta — "Mostra nel profilo" — e
-- quella scelta deve vivere nel database, non nel rendering.
--
-- Tre colonne booleane, una per dominio, e nient'altro:
--
--   • favorite_club_is_public
--   • football_types_are_public
--   • interest_categories_are_public
--
-- Le aree di interesse (`geo_scope`, `interest_regions`,
-- `interest_provinces`) non ricevono un toggle: non sono informazioni di
-- profilo, personalizzano feed e suggerimenti e restano fuori dal payload
-- pubblico per costruzione, come già oggi. Lo stesso vale per data di nascita
-- e residenza, che vivono su `profiles` e non passano da questa RPC.
--
-- Default `true`, e non `false`: oggi quei tre dati **sono** pubblici per
-- tutti i Tifosi, quindi "pubblico" è lo stato verificabile da cui si parte.
-- Spegnerli in massa svuoterebbe silenziosamente la tab Info di chiunque, che
-- è esattamente il tipo di cambiamento non richiesto che la migrazione deve
-- evitare. La regola "in assenza di evidenza, resta privato" si applica dove
-- l'evidenza manca davvero: la squadra salvata come stringa libera, che non
-- ha una relazione canonica e quindi nasce non pubblicabile.
--
-- L'invariante "visibilità accesa solo con un valore" non è un CHECK ma un
-- trigger di normalizzazione. Un CHECK farebbe fallire le scritture di chi
-- non conosce queste colonne — l'onboarding, `create-initial-profile`, un
-- client più vecchio — mentre il trigger le rende coerenti. Nello stesso
-- passaggio vengono normalizzati gli array (trim, dedup, tetto) e azzerata la
-- lista geografica che non appartiene alla modalità attiva: così un patch
-- parziale che cambia solo `geo_scope` non può violare il vincolo di
-- consistenza introdotto da REV-ONB-08.


-- ============================================================
-- 1. Colonne di visibilità
-- ============================================================

alter table public.fan_profiles
  add column if not exists favorite_club_is_public boolean not null default true,
  add column if not exists football_types_are_public boolean not null default true,
  add column if not exists interest_categories_are_public boolean not null default true;

-- Una preferenza accesa senza valore non è una preferenza: è una sezione
-- vuota nel profilo pubblico. Il backfill la spegne prima che il trigger
-- esista, perché il trigger non tocca le righe che nessuno riscrive.
update public.fan_profiles
set favorite_club_is_public = false
where favorite_club_is_public
  and favorite_club_id is null;

update public.fan_profiles
set football_types_are_public = false
where football_types_are_public
  and cardinality(coalesce(football_types, '{}'::text[])) = 0;

update public.fan_profiles
set interest_categories_are_public = false
where interest_categories_are_public
  and cardinality(coalesce(interest_categories, '{}'::text[])) = 0;


-- ============================================================
-- 2. Normalizzazione e invarianti
--
-- Tetto a 40 voci e 80 caratteri per voce: i due array sono liste di
-- identificativi di tassonomia, non testo libero. `football_types` ha già il
-- suo CHECK sul vocabolario chiuso; `interest_categories` no, e non lo
-- riceve ora — contiene valori del vecchio flusso Appassionato che non
-- appartengono più alla tassonomia corrente e che non vanno perduti
-- (REV-PROF-19 li mostra con la loro grafia, in coda).
-- ============================================================

create or replace function public.normalize_fan_profile_preferences()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Array: trim, scarto dei vuoti, dedup conservando il primo posto, tetto.
  select coalesce(array_agg(value order by ord), '{}'::text[])
  into new.football_types
  from (
    select distinct on (btrim(elem)) left(btrim(elem), 80) as value, ord
    from unnest(coalesce(new.football_types, '{}'::text[]))
      with ordinality as entry(elem, ord)
    where btrim(elem) <> ''
    order by btrim(elem), ord
  ) cleaned;

  select coalesce(array_agg(value order by ord), '{}'::text[])
  into new.interest_categories
  from (
    select distinct on (btrim(elem)) left(btrim(elem), 80) as value, ord
    from unnest(coalesce(new.interest_categories, '{}'::text[]))
      with ordinality as entry(elem, ord)
    where btrim(elem) <> ''
    order by btrim(elem), ord
  ) cleaned;

  new.football_types := new.football_types[1:40];
  new.interest_categories := new.interest_categories[1:40];

  -- Una sola modalità geografica è attiva: l'altra lista non resta nel
  -- database. Vale anche per un patch che nomina solo `geo_scope`.
  if new.geo_scope = 'ITALY' then
    new.interest_regions := '{}'::text[];
    new.interest_provinces := '{}'::text[];
  elsif new.geo_scope = 'REGIONS' then
    new.interest_provinces := '{}'::text[];
  elsif new.geo_scope = 'PROVINCES' then
    new.interest_regions := '{}'::text[];
  end if;

  -- Visibilità accesa solo con un valore da mostrare. Spegnerla qui — invece
  -- di rifiutare la scrittura — è ciò che permette a un client che non
  -- conosce queste colonne di rimuovere la squadra senza lasciarla pubblica.
  if new.favorite_club_id is null then
    new.favorite_club_is_public := false;
  end if;

  if cardinality(new.football_types) = 0 then
    new.football_types_are_public := false;
  end if;

  if cardinality(new.interest_categories) = 0 then
    new.interest_categories_are_public := false;
  end if;

  return new;
end;
$$;

drop trigger if exists fan_profiles_normalize_preferences on public.fan_profiles;
create trigger fan_profiles_normalize_preferences
before insert or update on public.fan_profiles
for each row execute procedure public.normalize_fan_profile_preferences();


-- ============================================================
-- 3. RPC: public.fetch_public_fan_profile
--
-- Stessa firma e stesse colonne di REV-PROF-19: i chiamanti non cambiano.
-- Cambia che ogni dominio esce solo con il proprio toggle acceso, e che la
-- decisione è presa qui — non nel client, che non riceve nemmeno il valore
-- da nascondere.
-- ============================================================

drop function if exists public.fetch_public_fan_profile(uuid);

create or replace function public.fetch_public_fan_profile(
  target_profile_id uuid
)
returns table (
  favorite_club_id       uuid,
  favorite_club_name     text,
  favorite_club_logo_url text,
  favorite_club_subtitle text,
  favorite_team_name     text,
  football_types         text[],
  interest_categories    text[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  -- Un blocco in una qualsiasi delle due direzioni rende il profilo non
  -- disponibile, come ovunque nell'app: nessuna riga, non una riga vuota.
  if v_uid <> target_profile_id and exists (
    select 1
    from public.user_blocks block
    where (block.blocker_profile_id = v_uid
           and block.blocked_profile_id = target_profile_id)
       or (block.blocker_profile_id = target_profile_id
           and block.blocked_profile_id = v_uid)
  ) then
    return;
  end if;

  return query
  select
    -- La card della squadra del cuore esiste solo se porta davvero da
    -- qualche parte: società presente, non rifiutata, non sospesa — e
    -- toggle acceso.
    club.id                                  as favorite_club_id,
    club.name                                as favorite_club_name,
    club.logo_url                            as favorite_club_logo_url,
    nullif(
      concat_ws(' · ', nullif(trim(club.category), ''), nullif(trim(club.region), '')),
      ''
    )                                        as favorite_club_subtitle,
    -- Il valore legacy testuale resta visibile solo finché non esiste una
    -- relazione canonica, e solo se il Tifoso mostra la squadra: non si
    -- mostrano due squadre del cuore, e non si pubblica una preferenza
    -- che è stata messa in privato.
    case
      when club.id is null and fan.favorite_club_is_public
        then nullif(trim(fan.favorite_team_name), '')
      else null
    end                                      as favorite_team_name,
    case
      when fan.football_types_are_public
        then coalesce(fan.football_types, '{}'::text[])
      else '{}'::text[]
    end                                      as football_types,
    case
      when fan.interest_categories_are_public
        then coalesce(fan.interest_categories, '{}'::text[])
      else '{}'::text[]
    end                                      as interest_categories
  from public.fan_profiles fan
  join public.profiles profile on profile.id = fan.profile_id
  left join public.clubs club
    on club.id = fan.favorite_club_id
   and fan.favorite_club_is_public
   and coalesce(club.verification_status, 'unverified')
         not in ('rejected', 'suspended')
  where fan.profile_id = target_profile_id
    and profile.role = 'fan';
end;
$$;

revoke all on function public.fetch_public_fan_profile(uuid) from public;
grant execute on function public.fetch_public_fan_profile(uuid) to authenticated;


-- ============================================================
-- 4. RPC: public.search_fan_favorite_clubs
--
-- Ricerca della squadra del cuore. `search_teams` non va bene qui per due
-- motivi che non si risolvono con un parametro: restituisce anche i nomi
-- scritti a mano nelle carriere (`id` nullo), e la squadra del cuore deve
-- essere una relazione canonica; e non conosce lo stato di verifica, quindi
-- proporrebbe società sospese che il payload pubblico poi scarta.
-- `search_clubs_page` (CER-03) conosce le società ma nemmeno lui lo stato, e
-- porta con sé filtri, squadre e affiliate che questa schermata non usa.
--
-- Resta INVOKER: `clubs` è leggibile da `authenticated`, quindi non serve
-- scavalcare nessuna policy per leggerne nome, logo e categoria.
-- ============================================================

create or replace function public.search_fan_favorite_clubs(
  p_query text,
  p_limit integer default 20
)
returns table (
  club_id  uuid,
  name     text,
  logo_url text,
  subtitle text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id   as club_id,
    c.name as name,
    c.logo_url,
    nullif(
      concat_ws(' · ', nullif(trim(c.category), ''), nullif(trim(c.region), '')),
      ''
    ) as subtitle
  from public.clubs c
  where btrim(coalesce(p_query, '')) <> ''
    and c.name ilike '%' || btrim(p_query) || '%'
    and coalesce(c.verification_status, 'unverified')
          not in ('rejected', 'suspended')
  order by
    -- I prefissi prima delle corrispondenze interne, poi alfabetico: chi
    -- cerca "Como" vuole il Como, non l'ASD Comorello.
    case when c.name ilike btrim(p_query) || '%' then 0 else 1 end,
    c.name
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.search_fan_favorite_clubs(text, integer) from public;
grant execute on function public.search_fan_favorite_clubs(text, integer) to authenticated;
