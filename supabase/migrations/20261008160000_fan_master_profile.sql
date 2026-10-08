-- REV-PROF-19 — Master Profile Tifoso.
--
-- Il profilo Tifoso raccoglie in onboarding (REV-ONB-08) due cose diverse che
-- fino a oggi viaggiavano insieme nello stesso payload:
--
--   1. dati di profilo pubblici  — squadra del cuore, interessi calcistici,
--      categorie seguite;
--   2. preferenze di personalizzazione — `geo_scope`, `interest_regions`,
--      `interest_provinces`: servono a feed, ricerca e suggerimenti, non
--      descrivono la persona e non sono mai state una scelta di visibilità.
--
-- La policy di lettura attuale ("fan profiles are readable by authenticated
-- users ... using (true)") rende pubblico anche il gruppo 2, e RLS filtra
-- righe, non colonne: non esiste modo di nascondere tre colonne lasciando le
-- altre leggibili sulla stessa policy. Quindi:
--
--   • `fan_profiles` torna leggibile dal solo proprietario — nessun'altra
--     query dell'app la legge per conto di un visitatore, e nessuna policy di
--     altre tabelle dipende da questa SELECT (fan_media_posts e
--     fan_tribuna_posts usano `status`/`is_current_user`, non un join);
--   • il sottoinsieme pubblico esce da una RPC che proietta esplicitamente le
--     colonne pubblicabili. Ciò che non è elencato lì non può raggiungere il
--     client, nemmeno per distrazione.
--
-- Nessun dato viene cancellato o modificato: le preferenze restano dove sono,
-- continuano ad alimentare la personalizzazione e restano scrivibili e
-- leggibili dal proprietario. Cambia solo chi può leggerle.
--
-- La RPC è SECURITY DEFINER perché deve leggere `fan_profiles` di un'altra
-- persona dopo la restrizione qui sopra — a differenza delle RPC sul club
-- (20261008090000_society_master_profile.sql), che restano INVOKER proprio
-- perché la tabella sottostante è leggibile da `authenticated`. La proiezione
-- esplicita delle colonne è il contenimento: la funzione non accetta nomi di
-- colonna, non costruisce SQL dinamico e non restituisce mai la riga intera.


-- ============================================================
-- 1. fan_profiles — lettura riservata al proprietario
-- ============================================================

drop policy if exists "fan profiles are readable by authenticated users"
  on public.fan_profiles;

drop policy if exists "fans read own profile" on public.fan_profiles;
create policy "fans read own profile"
on public.fan_profiles
for select
to authenticated
using (public.is_current_user(profile_id));

-- "fans can manage own profile" (for all) resta invariata: il proprietario
-- continua a scrivere e rileggere la propria riga, onboarding compreso.


-- ============================================================
-- 2. RPC: public.fetch_public_fan_profile
--
-- Payload pubblico del Master Profile Tifoso. Una riga, o nessuna riga
-- quando il profilo non esiste, non è un Tifoso o c'è un blocco reciproco
-- fra chi guarda e il profilo guardato.
--
-- Colonne restituite:
--   favorite_club_id        uuid   -- solo se la società esiste ed è pubblicabile
--   favorite_club_name      text
--   favorite_club_logo_url  text
--   favorite_club_subtitle  text   -- categoria · regione, quando ci sono
--   favorite_team_name      text   -- valore legacy testuale, solo senza società
--   football_types          text[] -- interessi calcistici (REV-ONB-08 §AF)
--   interest_categories     text[] -- categorie seguite, dal vocabolario storico
--
-- Non restituite, per costruzione: geo_scope, interest_regions,
-- interest_provinces, e qualsiasi colonna futura non elencata qui.
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
    -- qualche parte: società presente, non rifiutata, non sospesa.
    club.id                                  as favorite_club_id,
    club.name                                as favorite_club_name,
    club.logo_url                            as favorite_club_logo_url,
    nullif(
      concat_ws(' · ', nullif(trim(club.category), ''), nullif(trim(club.region), '')),
      ''
    )                                        as favorite_club_subtitle,
    -- Il valore legacy testuale resta visibile solo finché non esiste una
    -- relazione canonica: non si mostrano due squadre del cuore.
    case
      when club.id is null then nullif(trim(fan.favorite_team_name), '')
      else null
    end                                      as favorite_team_name,
    coalesce(fan.football_types, '{}'::text[])      as football_types,
    coalesce(fan.interest_categories, '{}'::text[]) as interest_categories
  from public.fan_profiles fan
  join public.profiles profile on profile.id = fan.profile_id
  left join public.clubs club
    on club.id = fan.favorite_club_id
   and coalesce(club.verification_status, 'unverified')
         not in ('rejected', 'suspended')
  where fan.profile_id = target_profile_id
    and profile.role = 'fan';
end;
$$;

revoke all on function public.fetch_public_fan_profile(uuid) from public;
grant execute on function public.fetch_public_fan_profile(uuid) to authenticated;
