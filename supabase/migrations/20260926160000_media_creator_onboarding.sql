-- ============================================================
-- REV-ONB-09 — Onboarding Media/Creator
--
-- L'onboarding Media chiedeva la tipologia come testo libero ("Testata o
-- sito", "Pagina o progetto media") dentro `affiliation_type`, un campo nato
-- per un'altra domanda — "sei collegato a una realtà specifica?" — che questa
-- task elimina (§24). Serve una categoria strutturata e interrogabile: sei
-- valori, nessuna stringa libera se non per "Altro" (§13, §29).
--
-- `media_kind` resta il vocabolario di ricerca di CER-05 e HOME-01 (testata |
-- giornalista | creator | pagina | ufficiale) e non viene allargato: si
-- deriva da `creator_type` con un trigger, così non può divergere da esso
-- qualunque sia il writer.
--
-- Nulla viene rimosso: `affiliation_type`, `affiliation_name` ed
-- `editorial_type` restano con i loro dati storici (§30). I profili già
-- registrati vengono classificati leggendo quei campi, non riscrivendoli.
-- ============================================================

-- ------------------------------------------------------------
-- SECTION 1: tipologia strutturata
-- ------------------------------------------------------------

alter table public.media_profiles
  add column if not exists creator_type text,
  add column if not exists creator_type_other text;

comment on column public.media_profiles.creator_type is
  'REV-ONB-09 §13: tipologia Media/Creator. Null sui profili anteriori alla task.';
comment on column public.media_profiles.creator_type_other is
  'REV-ONB-09 §14: testo libero, valido solo quando creator_type = ''other''.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'media_profiles_creator_type_check'
  ) then
    alter table public.media_profiles
      add constraint media_profiles_creator_type_check
      check (
        creator_type is null
        or creator_type in (
          'social_page',
          'news_outlet',
          'editorial_project',
          'independent_creator',
          'podcast_format',
          'other'
        )
      );
  end if;
end $$;

-- ------------------------------------------------------------
-- SECTION 2: creator_type -> media_kind
--
-- La mappa è volutamente non iniettiva: "progetto editoriale" e "testata"
-- sono due cose diverse per l'utente ma la stessa fonte per la ricerca, e
-- così per "creator" e "podcast/format". 'ufficiale' non è raggiungibile da
-- qui: appartiene ai canali dei club, non ai profili Media.
-- ------------------------------------------------------------

create or replace function public.prolink_media_kind_from_creator_type(
  p_creator_type text
)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_creator_type
    when 'news_outlet'         then 'testata'
    when 'editorial_project'   then 'testata'
    when 'independent_creator' then 'creator'
    when 'podcast_format'      then 'creator'
    when 'social_page'         then 'pagina'
    when 'other'               then 'pagina'
    else null
  end;
$$;

comment on function public.prolink_media_kind_from_creator_type(text) is
  'REV-ONB-09: tipologia onboarding -> vocabolario di ricerca CER-05.';

create or replace function public.prolink_media_profiles_sync_media_kind()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.creator_type is not null then
    new.media_kind := public.prolink_media_kind_from_creator_type(new.creator_type);
  elsif new.media_kind is null then
    -- Nessuna tipologia strutturata: resta l'euristica CER-05 sul testo libero.
    new.media_kind := public.footme_media_kind_from_text(
      new.editorial_type,
      new.affiliation_type
    );
  end if;

  return new;
end;
$$;

drop trigger if exists media_profiles_sync_media_kind on public.media_profiles;
create trigger media_profiles_sync_media_kind
before insert or update on public.media_profiles
for each row
execute function public.prolink_media_profiles_sync_media_kind();

-- ------------------------------------------------------------
-- SECTION 3: backfill dei profili esistenti (§30)
--
-- Chi ha già un `editorial_type` o un `affiliation_type` leggibile rientra
-- sulla categoria equivalente. Chi non ha nulla resta null: una tipologia
-- inventata sarebbe peggio di una mancante, e la UI la chiederà alla prima
-- modifica del profilo.
-- ------------------------------------------------------------

update public.media_profiles
set creator_type = case
  when lower(coalesce(editorial_type, affiliation_type, '')) like '%testata%'
    or lower(coalesce(editorial_type, affiliation_type, '')) like '%giornal%'
    or lower(coalesce(editorial_type, affiliation_type, '')) like '%sito%'
                                                             then 'news_outlet'
  when lower(coalesce(editorial_type, affiliation_type, '')) like '%podcast%'
    or lower(coalesce(editorial_type, affiliation_type, '')) like '%format%'
                                                             then 'podcast_format'
  when lower(coalesce(editorial_type, affiliation_type, '')) like '%creator%'
    or lower(coalesce(editorial_type, affiliation_type, '')) like '%influencer%'
                                                             then 'independent_creator'
  when lower(coalesce(editorial_type, affiliation_type, '')) like '%progetto%'
    or lower(coalesce(editorial_type, affiliation_type, '')) like '%portale%'
                                                             then 'editorial_project'
  when lower(coalesce(editorial_type, affiliation_type, '')) like '%pagina%'
    or lower(coalesce(editorial_type, affiliation_type, '')) like '%social%'
                                                             then 'social_page'
  else null
end
where creator_type is null;

-- ------------------------------------------------------------
-- SECTION 4: ambiti calcistici (§19, §30)
--
-- "Settore giovanile", "Professionistico" e "Mercato" diventano "Calcio
-- giovanile", "Calcio professionistico" e "Calciomercato": stesse aree, nomi
-- allineati al resto dell'app. Sono etichette, non chiavi: la riscrittura è
-- mirata ai soli valori noti, riga per riga.
-- ------------------------------------------------------------

-- L'ordine scelto dall'utente viene preservato: il remap può produrre
-- duplicati (chi aveva sia "Giovanile" sia "Settore giovanile") e di quelli
-- sopravvive la prima occorrenza, non la prima in ordine alfabetico.
update public.media_profiles
set focus_areas = (
  select coalesce(array_agg(mapped order by first_position), '{}')
  from (
    select mapped, min(position) as first_position
    from (
      select case value
        when 'Settore giovanile' then 'Calcio giovanile'
        when 'Giovanile'         then 'Calcio giovanile'
        when 'Professionistico'  then 'Calcio professionistico'
        when 'Mercato'           then 'Calciomercato'
        else value
      end as mapped,
      position
      from unnest(focus_areas) with ordinality as entry(value, position)
    ) remapped
    group by mapped
  ) deduplicated
)
where focus_areas && array[
  'Settore giovanile',
  'Giovanile',
  'Professionistico',
  'Mercato'
];
