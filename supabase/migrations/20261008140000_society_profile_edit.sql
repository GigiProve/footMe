-- Migration: REV-PROF-18 — Modifica profilo Società.
--
-- L'editor Società esisteva già, ma come form unico (`EditClubInfoModal`) che
-- rispediva al backend l'intero profilo professionale per cambiare un campo.
-- Questa migrazione non aggiunge un secondo modello di dati: aggiunge le tre
-- cose che mancavano al modello canonico perché un hub modulare possa
-- esistere senza duplicare nulla.
--
-- 1. Visibilità dei contatti della Società
--    `clubs` porta già i recapiti ufficiali (club_email, club_phone,
--    website_url, instagram, facebook, tiktok, youtube) ma non sa dire quali
--    siano pubblici: oggi `fetch_society_master_profile` li pubblica tutti.
--    Senza un flag per canale, il toggle del mockup sarebbe una scelta del
--    client su un dato già uscito dal database. I default sono `true` perché
--    riproducono esattamente il comportamento attuale: nessun contatto
--    diventa pubblico adesso, e nessuno sparisce da un profilo pubblicato.
--
-- 2. Indirizzo dell'impianto uguale alla sede
--    Il toggle "Usa lo stesso indirizzo della sede" è un dato, non il
--    risultato del confronto fra due stringhe: due indirizzi scritti a mano in
--    modo leggermente diverso non significano che l'utente abbia chiesto di
--    tenerli allineati, e riallinearli automaticamente perderebbe il valore
--    distinto. Il backfill accende il flag solo dove i due indirizzi sono già
--    oggi lo stesso testo normalizzato.
--
-- 3. Scrittura delegabile e per sezione
--    La policy UPDATE di `clubs` è ancora "solo l'owner" (20260309000001),
--    mentre la lettura owner-mode del Master Profile passa già da
--    `can_manage_society` (20261008090000): un amministratore con
--    `society_manage_profile` vedeva le azioni di gestione e non poteva
--    salvare. La policy viene allineata all'helper, e la scrittura passa da
--    una RPC che accetta una sola sezione per volta — così un modulo non può
--    sovrascrivere i campi di un altro con valori stale.
--
-- Entrambe le RPC sono SECURITY INVOKER: la policy SELECT di `clubs` è
-- scoped `TO authenticated`, e una definer eseguita dal proprio owner
-- leggerebbe zero club (vedi 20260724120000_search_clubs_security_invoker.sql
-- e la nota in 20261008090000_society_master_profile.sql).
--
-- Convenzioni riprese da:
--   20260319000000_club_onboarding_fields.sql   (colonne identitarie del club)
--   20261008090000_society_master_profile.sql   (permessi society_*, RPC jsonb)
--   20260926100000_club_structure_onboarding.sql(enum della struttura club)


-- ============================================================
-- SEZIONE 1 — Visibilità dei contatti pubblici della Società
-- ============================================================

alter table public.clubs
  add column if not exists show_club_email boolean not null default true,
  add column if not exists show_club_phone boolean not null default true,
  add column if not exists show_website boolean not null default true,
  add column if not exists show_instagram boolean not null default true,
  add column if not exists show_facebook boolean not null default true,
  -- Il toggle del mockup, non una deduzione dal confronto fra due stringhe.
  add column if not exists venue_address_same_as_headquarters boolean not null default false;


-- Backfill del toggle: si accende solo dove i due indirizzi sono già oggi lo
-- stesso testo, a meno di spazi e maiuscole. Dove differiscono resta spento e
-- i due valori restano distinti — nessun indirizzo viene riscritto.
update public.clubs
set venue_address_same_as_headquarters = true
where venue_address_same_as_headquarters = false
  and field_address is not null
  and headquarters_address is not null
  and lower(regexp_replace(field_address, '\s+', ' ', 'g')) =
      lower(regexp_replace(headquarters_address, '\s+', ' ', 'g'))
  and btrim(field_address) <> '';


-- ============================================================
-- SEZIONE 2 — La gestione del profilo è delegabile
-- ============================================================
-- `can_manage_society` risolve già "owner oppure membro attivo con
-- society_manage_profile" (20261008090000). La policy di UPDATE ne prende il
-- posto della sola proprietà: altrimenti l'owner mode del Master Profile
-- mostrerebbe a un amministratore delegato azioni che il database rifiuta.
-- La policy di INSERT resta dell'owner: creare un club non è gestirne uno.

drop policy if exists "club owners can update clubs" on public.clubs;

create policy "society managers can update clubs"
on public.clubs
for update
to authenticated
using (public.can_manage_society(id))
with check (public.can_manage_society(id));


-- RLS filtra righe, non colonne: `clubs` è scrivibile direttamente dal client,
-- quindi allargare la policy a un amministratore delegato gli darebbe anche
-- `owner_profile_id` e `verification_status`. Il primo è unico — passata la
-- proprietà non si torna indietro — e il secondo è la "Pagina ufficiale", che
-- la task vieta esplicitamente di modificare da questo flusso.
--
-- La proprietà e la verifica restano quindi dell'owner e del back-office, e la
-- regola sta su un trigger perché è l'unico punto che vale per ogni scrittura,
-- RPC o chiamata PostgREST diretta che sia.
create or replace function public.guard_club_ownership_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Owner e back-office non cambiano comportamento: la regola aggiunge un
  -- vincolo solo a chi la policy ha appena ammesso, cioè il delegato.
  -- L'onboarding, per esempio, riscrive `verification_status` sul proprio
  -- club e deve continuare a funzionare.
  if public.is_admin() or old.owner_profile_id is not distinct from auth.uid() then
    return new;
  end if;

  if new.owner_profile_id is distinct from old.owner_profile_id then
    raise exception 'society_profile_owner_locked' using errcode = '42501';
  end if;

  if (
    new.verification_status is distinct from old.verification_status
    or new.verified_at     is distinct from old.verified_at
    or new.verified_by     is distinct from old.verified_by
    or new.reviewed_at     is distinct from old.reviewed_at
    or new.reviewed_by     is distinct from old.reviewed_by
  ) then
    raise exception 'society_profile_verification_locked' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists clubs_guard_ownership on public.clubs;
create trigger clubs_guard_ownership
  before update on public.clubs
  for each row execute function public.guard_club_ownership_columns();


-- Stessa incoerenza su `club_teams`: la 20261008090000 ha già portato la
-- lettura su `can_manage_society`, la scrittura è rimasta su `owns_club`.
-- Senza allinearla, il salvataggio del Profilo sportivo non potrebbe
-- aggiornare la categoria della prima squadra per un amministratore delegato —
-- e la gestione Squadre, che l'hub apre, gli resterebbe in sola lettura pur
-- essendo autorizzato.
drop policy if exists "Club owner manages teams" on public.club_teams;

create policy "Society managers manage teams"
  on public.club_teams for all
  using (public.can_manage_society(club_id))
  with check (public.can_manage_society(club_id));


-- ============================================================
-- SEZIONE 3 — Il payload pubblico rispetta i toggle
-- ============================================================
-- Un contatto spento non deve lasciare il database: nasconderlo nel client lo
-- lascerebbe raggiungibile da una cache, da un deep link o da una condivisione.
-- Il resto della RPC è invariato rispetto alla 20261008090000.

create or replace function public.fetch_society_master_profile(
  p_club_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_club       public.clubs%rowtype;
  v_can_manage boolean;
  v_teams      jsonb;
  v_affiliates jsonb;
  v_positions  jsonb;
  v_category   text;
begin
  if p_club_id is null then
    return null;
  end if;

  select * into v_club from public.clubs where id = p_club_id;

  if not found then
    return null;
  end if;

  v_can_manage := public.can_manage_society(p_club_id);

  select coalesce(jsonb_agg(team order by team_rank, team_sort, team_name), '[]'::jsonb)
    into v_teams
  from (
    select
      jsonb_build_object(
        'id',               t.id,
        'club_id',          t.club_id,
        'name',             t.name,
        'category',         t.category,
        'team_type',        t.team_type,
        'season',           t.season,
        'logo_url',         t.logo_url,
        'cover_url',        t.cover_url,
        'city',             t.city,
        'region',           t.region,
        'venue_name',       t.venue_name,
        'sort_order',       t.sort_order,
        'competition_name', tp.competition_name
      )                                                  as team,
      case when t.team_type = 'senior' then 0 else 1 end as team_rank,
      t.sort_order                                       as team_sort,
      t.name                                             as team_name
    from public.club_teams t
    left join public.club_team_profiles tp on tp.team_id = t.id
    where t.club_id = p_club_id
      and t.is_public
      and not t.is_archived
  ) ordered_teams;

  select coalesce(jsonb_agg(affiliate order by affiliate_sort, affiliate_name), '[]'::jsonb)
    into v_affiliates
  from (
    select distinct on (c.id)
      jsonb_build_object(
        'id',                 c.id,
        'name',               c.name,
        'logo_url',           c.logo_url,
        'city',               c.city,
        'region',             c.region,
        'category',           c.category,
        'relationship_label', a.relationship_label
      )            as affiliate,
      a.sort_order as affiliate_sort,
      c.name       as affiliate_name
    from public.club_affiliations a
    join public.clubs c on c.id = a.affiliate_club_id
    where a.club_id = p_club_id
      and a.status = 'confirmed'
      and a.is_public
    order by c.id, a.sort_order
  ) ordered_affiliates;

  select coalesce(jsonb_agg(position_row order by published_sort desc nulls last), '[]'::jsonb)
    into v_positions
  from (
    select
      jsonb_build_object(
        'id',            ad.id,
        'title',         ad.title,
        'role_required', ad.role_required,
        'target_role',   ad.target_role,
        'category',      coalesce(t.category, ad.category),
        'region',        coalesce(t.region, ad.region, v_club.region),
        'city',          coalesce(t.city, v_club.city),
        'team_id',       ad.team_id,
        'team_name',     t.name,
        'team_type',     coalesce(t.team_type, 'senior'),
        'published_at',  coalesce(ad.published_at, ad.created_at)
      )                                        as position_row,
      coalesce(ad.published_at, ad.created_at) as published_sort
    from public.recruiting_ads ad
    left join public.club_teams t
      on t.id = ad.team_id
     and t.is_public
     and not t.is_archived
    where ad.club_id = p_club_id
      and ad.status = 'published'
      and (ad.deadline is null or ad.deadline >= current_date)
  ) ordered_positions;

  select t.category into v_category
  from public.club_teams t
  where t.club_id = p_club_id
    and t.is_public
    and not t.is_archived
  order by case when t.team_type = 'senior' then 0 else 1 end, t.sort_order
  limit 1;

  return jsonb_build_object(
    'club', jsonb_build_object(
      'id',                   v_club.id,
      'name',                 v_club.name,
      'logo_url',             v_club.logo_url,
      'cover_url',            v_club.cover_url,
      'city',                 v_club.city,
      'province',             v_club.province,
      'region',               v_club.region,
      'category',             coalesce(v_category, v_club.category),
      'stadium',              v_club.stadium,
      'field_address',        v_club.field_address,
      'headquarters_address', v_club.headquarters_address,
      'founding_year',        v_club.founding_year,
      'club_colors',          v_club.club_colors,
      'description',          v_club.description,
      -- REV-PROF-18: i recapiti escono dal database solo se la Società li ha
      -- dichiarati pubblici. Spegnere un toggle non cancella il valore, lo
      -- toglie dal payload — anche per l'owner, che lo ritrova nell'editor.
      'website_url',          case when v_club.show_website     then v_club.website_url else null end,
      'club_email',           case when v_club.show_club_email  then v_club.club_email  else null end,
      'club_phone',           case when v_club.show_club_phone  then v_club.club_phone  else null end,
      'instagram',            case when v_club.show_instagram   then v_club.instagram   else null end,
      'facebook',             case when v_club.show_facebook    then v_club.facebook    else null end,
      'verification_status',  v_club.verification_status,
      'owner_profile_id',     v_club.owner_profile_id
    ),
    'viewer', jsonb_build_object(
      'profile_id', auth.uid(),
      'mode',       case when v_can_manage then 'owner' else 'visitor' end,
      'can_manage', v_can_manage,
      'can_manage_positions',
        public.has_club_permission(p_club_id, 'society_manage_positions') or v_can_manage,
      'can_publish_media',
        public.has_club_permission(p_club_id, 'society_publish_media') or v_can_manage,
      'is_following', auth.uid() is not null and exists (
        select 1 from public.club_follows f
        where f.club_id = p_club_id and f.profile_id = auth.uid()
      )
    ),
    'teams',      v_teams,
    'affiliates', v_affiliates,
    'positions',  v_positions
  );
end;
$$;

revoke all on function public.fetch_society_master_profile(uuid) from public;
grant execute on function public.fetch_society_master_profile(uuid) to authenticated;


-- ============================================================
-- SEZIONE 4 — RPC: i dati dell'editor in una chiamata
-- ============================================================
-- L'hub ha bisogno di cinque contatori reali e cinque moduli hanno bisogno
-- degli stessi campi del club: una lettura sola, non cinque query a cascata.
--
-- Il payload è owner-only: chi non può gestire la Società riceve `null`, non
-- un oggetto svuotato. Qui — e solo qui — compaiono i recapiti spenti, perché
-- questo è l'editor del proprietario e non il profilo pubblico.
--
-- Le categorie giovanili non sono un campo: sono la proiezione delle squadre
-- giovanili attive. Arrivano calcolate, così nessuna schermata è tentata di
-- tenerne una seconda copia.

create or replace function public.fetch_society_profile_editor(
  p_club_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_club              public.clubs%rowtype;
  v_teams_count       integer;
  v_affiliates_count  integer;
  v_positions_count   integer;
  v_media_count       integer;
  v_has_first_team    boolean;
  v_has_youth_teams   boolean;
  v_first_team        jsonb;
begin
  if p_club_id is null or not public.can_manage_society(p_club_id) then
    return null;
  end if;

  select * into v_club from public.clubs where id = p_club_id;

  if not found then
    return null;
  end if;

  -- Squadre attive e pubbliche: la stessa regola del conteggio mostrato nel
  -- Master Profile, non un totale di comodo che includa le archiviate.
  select count(*) into v_teams_count
  from public.club_teams t
  where t.club_id = p_club_id and t.is_public and not t.is_archived;

  select
    bool_or(t.team_type = 'senior'),
    bool_or(t.team_type = 'youth')
  into v_has_first_team, v_has_youth_teams
  from public.club_teams t
  where t.club_id = p_club_id and not t.is_archived;

  select jsonb_build_object('id', t.id, 'name', t.name, 'category', t.category)
    into v_first_team
  from public.club_teams t
  where t.club_id = p_club_id
    and t.team_type = 'senior'
    and not t.is_archived
  order by t.sort_order
  limit 1;

  select count(distinct c.id) into v_affiliates_count
  from public.club_affiliations a
  join public.clubs c on c.id = a.affiliate_club_id
  where a.club_id = p_club_id and a.status = 'confirmed' and a.is_public;

  select count(*) into v_positions_count
  from public.recruiting_ads ad
  where ad.club_id = p_club_id
    and ad.status = 'published'
    and (ad.deadline is null or ad.deadline >= current_date);

  select count(*) into v_media_count
  from public.club_media_posts m
  where m.club_id = p_club_id and m.status = 'published';

  return jsonb_build_object(
    'club', jsonb_build_object(
      'id',                   v_club.id,
      'name',                 v_club.name,
      'logo_url',             v_club.logo_url,
      'cover_url',            v_club.cover_url,
      'founding_year',        v_club.founding_year,
      'club_colors',          v_club.club_colors,
      'club_structure',       v_club.club_structure,
      'category',             v_club.category,
      'city',                 v_club.city,
      'province',             v_club.province,
      'region',               v_club.region,
      'country',              v_club.country,
      'headquarters_address', v_club.headquarters_address,
      'stadium',              v_club.stadium,
      'field_address',        v_club.field_address,
      'venue_address_same_as_headquarters', v_club.venue_address_same_as_headquarters,
      'description',          v_club.description,
      -- Valori sempre presenti: l'editor mostra anche ciò che è spento,
      -- altrimenti un contatto nascosto diventerebbe irrecuperabile.
      'club_email',           v_club.club_email,
      'club_phone',           v_club.club_phone,
      'website_url',          v_club.website_url,
      'instagram',            v_club.instagram,
      'facebook',             v_club.facebook,
      'show_club_email',      v_club.show_club_email,
      'show_club_phone',      v_club.show_club_phone,
      'show_website',         v_club.show_website,
      'show_instagram',       v_club.show_instagram,
      'show_facebook',        v_club.show_facebook,
      'verification_status',  v_club.verification_status,
      -- Chiave della concorrenza fra amministratori: il salvataggio la
      -- rimanda indietro e il database rifiuta se nel frattempo è cambiata.
      'updated_at',           v_club.updated_at
    ),
    'counts', jsonb_build_object(
      'teams',      coalesce(v_teams_count, 0),
      'affiliates', coalesce(v_affiliates_count, 0),
      'positions',  coalesce(v_positions_count, 0),
      'media',      coalesce(v_media_count, 0)
    ),
    'teams', jsonb_build_object(
      'has_first_team',   coalesce(v_has_first_team, false),
      'has_youth_teams',  coalesce(v_has_youth_teams, false),
      'first_team',       v_first_team
    )
  );
end;
$$;

revoke all on function public.fetch_society_profile_editor(uuid) from public;
grant execute on function public.fetch_society_profile_editor(uuid) to authenticated;


-- ============================================================
-- SEZIONE 5 — RPC: salvataggio di una sezione per volta
-- ============================================================
-- Una sola sezione per chiamata, e per ogni sezione un elenco chiuso di
-- colonne: un modulo non può sovrascrivere i campi di un altro nemmeno
-- sbagliando payload, e il client non deve rimandare indietro l'intero club
-- per cambiare una riga.
--
-- Le validazioni stanno qui oltre che nel client: il client le fa per dare un
-- errore vicino al campo, il database le fa perché è l'unico punto che non si
-- può aggirare.
--
-- `p_expected_updated_at` è la concorrenza fra amministratori: se il club è
-- cambiato dopo la lettura dell'editor, il salvataggio fallisce invece di
-- sovrascrivere in silenzio una versione più recente.

create or replace function public.save_society_profile_section(
  p_club_id uuid,
  p_section text,
  p_payload jsonb,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_club        public.clubs%rowtype;
  v_structure   text;
  v_year        integer;
  v_category    text;
  v_description text;
  v_name        text;
  v_city        text;
  v_region      text;
  v_same_addr   boolean;
begin
  if p_club_id is null then
    raise exception 'society_profile_not_found' using errcode = 'P0002';
  end if;

  if not public.can_manage_society(p_club_id) then
    raise exception 'society_profile_forbidden' using errcode = '42501';
  end if;

  select * into v_club from public.clubs where id = p_club_id for update;

  if not found then
    raise exception 'society_profile_not_found' using errcode = 'P0002';
  end if;

  if p_expected_updated_at is not null
     and v_club.updated_at is distinct from p_expected_updated_at then
    raise exception 'society_profile_conflict' using errcode = '40001';
  end if;

  if p_section = 'identity' then
    v_name := btrim(regexp_replace(coalesce(p_payload ->> 'name', ''), '\s+', ' ', 'g'));

    if v_name = '' then
      raise exception 'society_profile_name_required' using errcode = '23514';
    end if;

    v_year := nullif(p_payload ->> 'founding_year', '')::integer;

    if v_year is not null
       and (v_year < 1850 or v_year > extract(year from current_date)::integer) then
      raise exception 'society_profile_founding_year_invalid' using errcode = '23514';
    end if;

    update public.clubs
    set name          = v_name,
        founding_year = v_year,
        club_colors   = nullif(btrim(coalesce(p_payload ->> 'club_colors', '')), ''),
        logo_url      = nullif(btrim(coalesce(p_payload ->> 'logo_url', '')), ''),
        cover_url     = nullif(btrim(coalesce(p_payload ->> 'cover_url', '')), '')
    where id = p_club_id;

  elsif p_section = 'sport' then
    v_structure := nullif(btrim(coalesce(p_payload ->> 'club_structure', '')), '');

    if v_structure is null
       or v_structure not in ('first_team_only', 'first_team_and_youth', 'youth_only') then
      raise exception 'society_profile_structure_invalid' using errcode = '23514';
    end if;

    -- Cambiare struttura non cancella niente: se la nuova configurazione non
    -- combacia con le squadre attive, il salvataggio si ferma e la gestione
    -- Squadre resta l'unico posto in cui una squadra nasce o si archivia.
    if v_structure = 'first_team_only' and exists (
      select 1 from public.club_teams t
      where t.club_id = p_club_id and t.team_type = 'youth' and not t.is_archived
    ) then
      raise exception 'society_profile_youth_teams_active' using errcode = '23514';
    end if;

    if v_structure = 'youth_only' and exists (
      select 1 from public.club_teams t
      where t.club_id = p_club_id and t.team_type = 'senior' and not t.is_archived
    ) then
      raise exception 'society_profile_first_team_active' using errcode = '23514';
    end if;

    v_category := case
      when v_structure = 'youth_only' then null
      else nullif(btrim(coalesce(p_payload ->> 'category', '')), '')
    end;

    update public.clubs
    set club_structure = v_structure,
        -- "Solo settore giovanile" non ha una categoria di prima squadra: il
        -- campo si svuota invece di restare appeso da una configurazione
        -- precedente. Le categorie giovanili non si toccano: stanno sui Team.
        category = v_category
    where id = p_club_id;

    -- La categoria pubblica la dice la prima squadra, non il club: sia
    -- `fetch_society_master_profile` sia `fetch_society_profile_editor`
    -- leggono `club_teams.category` e usano `clubs.category` solo come
    -- ripiego. Scrivere solo sul club lascerebbe l'header invariato dopo un
    -- salvataggio riuscito. Il settore giovanile non viene toccato.
    if v_category is not null then
      update public.club_teams
      set category = v_category
      where club_id = p_club_id
        and team_type = 'senior'
        and not is_archived;
    end if;

  elsif p_section = 'venue' then
    v_city   := btrim(coalesce(p_payload ->> 'city', ''));
    v_region := btrim(coalesce(p_payload ->> 'region', ''));

    if v_city = '' or v_region = '' then
      raise exception 'society_profile_city_required' using errcode = '23514';
    end if;

    v_same_addr := coalesce((p_payload ->> 'venue_address_same_as_headquarters')::boolean, false);

    -- `province`, `latitude` e `longitude` non compaiono: li scrive il
    -- trigger `clubs_geocode` (20260725100000) dal comune e dalla regione.
    -- Scriverli da qui significherebbe avere due sorgenti per lo stesso dato.
    update public.clubs
    set city                 = v_city,
        region               = v_region,
        headquarters_address = nullif(btrim(coalesce(p_payload ->> 'headquarters_address', '')), ''),
        stadium              = nullif(btrim(coalesce(p_payload ->> 'stadium', '')), ''),
        -- Con il toggle attivo l'indirizzo dell'impianto non è una seconda
        -- copia scritta dal client: è la sede, risolta qui.
        field_address        = case
          when v_same_addr then nullif(btrim(coalesce(p_payload ->> 'headquarters_address', '')), '')
          else nullif(btrim(coalesce(p_payload ->> 'field_address', '')), '')
        end,
        venue_address_same_as_headquarters = v_same_addr
    where id = p_club_id;

  elsif p_section = 'description' then
    v_description := nullif(btrim(coalesce(p_payload ->> 'description', '')), '');

    if v_description is not null and char_length(v_description) > 500 then
      raise exception 'society_profile_description_too_long' using errcode = '23514';
    end if;

    update public.clubs
    set description = v_description
    where id = p_club_id;

  elsif p_section = 'contacts' then
    -- Un canale senza valore non può essere pubblico: il flag non è una
    -- preferenza slegata dal dato, e questo è il punto che lo garantisce
    -- qualunque cosa mandi il client.
    -- Una chiave assente non è una chiave vuota: `p_payload ? 'x'` evita che
    -- un payload parziale cancelli un recapito che la schermata non gestisce.
    update public.clubs
    set club_email  = case when p_payload ? 'club_email'
                      then nullif(btrim(p_payload ->> 'club_email'), '') else club_email end,
        club_phone  = case when p_payload ? 'club_phone'
                      then nullif(btrim(p_payload ->> 'club_phone'), '') else club_phone end,
        website_url = case when p_payload ? 'website_url'
                      then nullif(btrim(p_payload ->> 'website_url'), '') else website_url end,
        instagram   = case when p_payload ? 'instagram'
                      then nullif(btrim(p_payload ->> 'instagram'), '') else instagram end,
        facebook    = case when p_payload ? 'facebook'
                      then nullif(btrim(p_payload ->> 'facebook'), '') else facebook end,
        show_club_email = coalesce((p_payload ->> 'show_club_email')::boolean, false)
                          and nullif(btrim(coalesce(p_payload ->> 'club_email', '')), '') is not null,
        show_club_phone = coalesce((p_payload ->> 'show_club_phone')::boolean, false)
                          and nullif(btrim(coalesce(p_payload ->> 'club_phone', '')), '') is not null,
        show_website    = coalesce((p_payload ->> 'show_website')::boolean, false)
                          and nullif(btrim(coalesce(p_payload ->> 'website_url', '')), '') is not null,
        show_instagram  = coalesce((p_payload ->> 'show_instagram')::boolean, false)
                          and nullif(btrim(coalesce(p_payload ->> 'instagram', '')), '') is not null,
        show_facebook   = coalesce((p_payload ->> 'show_facebook')::boolean, false)
                          and nullif(btrim(coalesce(p_payload ->> 'facebook', '')), '') is not null
    where id = p_club_id;

  else
    raise exception 'society_profile_unknown_section' using errcode = '22023';
  end if;

  return public.fetch_society_profile_editor(p_club_id);
end;
$$;

revoke all on function public.save_society_profile_section(uuid, text, jsonb, timestamptz) from public;
grant execute on function public.save_society_profile_section(uuid, text, jsonb, timestamptz) to authenticated;
