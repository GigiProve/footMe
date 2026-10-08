-- ============================================================
-- REV-PROF-22 — Modifica profilo Media/Creator
--
-- L'editor modulare non introduce una seconda realtà editoriale: scrive sulle
-- stesse colonne che l'onboarding (REV-ONB-09) riempie e che il Master
-- Profile (REV-PROF-21) legge. Mancava però una cosa sola, e questa
-- migrazione la aggiunge.
--
-- **Le Aree coperte non avevano una modalità.** `covered_territories` è un
-- `text[]` di etichette e basta: non sa dire se una realtà copre tutta
-- Italia, alcune regioni o alcune zone. Il selettore geografico canonico —
-- quello di REV-ONB-02, riusato dal Tifoso in REV-ONB-08 — ha invece tre
-- modalità, e senza una colonna che le registri "Tutta Italia" e "nessuna
-- area dichiarata" sarebbero lo stesso stato. Da qui `coverage_scope` e
-- `covered_provinces`, modellate sulle omologhe di `fan_profiles`
-- (`geo_scope`, `interest_regions`, `interest_provinces`) invece che su un
-- secondo modello geografico.
--
-- Non viene creato, di proposito:
--   • nessun permesso nuovo: una realtà editoriale ha un solo proprietario
--     (`media_profiles.profile_id` = `profiles.id`) e le RLS `is_current_user`
--     esistenti sono già la regola. Il giorno in cui esisteranno
--     collaboratori cambierà il calcolo delle capability dentro
--     `fetch_public_media_profile`, non questa tabella;
--   • nessuna colonna per i canali ufficiali: vivono su `profile_contacts`
--     con i loro flag `show_*`, che è dove l'onboarding li scrive e da dove
--     `get_profile_public_contacts` li filtra;
--   • nessun workflow di verifica: `verification_status` resta
--     backend-controlled e l'editor non lo tocca.
--
-- Migrazione non distruttiva e idempotente: aggiunge due colonne, classifica
-- le righe esistenti senza riscriverne i dati, ed estende il payload pubblico
-- con i due campi nuovi.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — modalità e zone della copertura editoriale
-- ============================================================

alter table public.media_profiles
  add column if not exists coverage_scope text,
  add column if not exists covered_provinces text[] not null default '{}';

comment on column public.media_profiles.coverage_scope is
  'REV-PROF-22: modalita della copertura geografica editoriale. '
  'ITALY | REGIONS | PROVINCES. Null = non ancora dichiarata.';
comment on column public.media_profiles.covered_provinces is
  'REV-PROF-22: zone della copertura quando coverage_scope = PROVINCES. '
  'Le regioni restano in covered_territories.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'media_profiles_coverage_scope_check'
  ) then
    alter table public.media_profiles
      add constraint media_profiles_coverage_scope_check
      check (
        coverage_scope is null
        or coverage_scope in ('ITALY', 'REGIONS', 'PROVINCES')
      );
  end if;
end $$;

-- Classificazione delle righe esistenti.
--
-- Chi ha dei territori dichiarati li ha dichiarati come regioni: è l'unico
-- livello che il flusso storico raccoglieva, ed è così che la tab Info li
-- mostra oggi. Quei valori erano già pubblici, quindi registrarne la modalità
-- non pubblica niente di nuovo — e non ne cambia nemmeno uno.
--
-- Chi non ne ha resta `null`: "Tutta Italia" sarebbe una dichiarazione di
-- copertura che nessuno ha fatto. L'hub mostrerà "Da completare" e sarà
-- l'owner a scegliere.
update public.media_profiles
set coverage_scope = 'REGIONS'
where coverage_scope is null
  and coalesce(array_length(covered_territories, 1), 0) > 0;


-- ============================================================
-- SEZIONE 2 — payload pubblico: modalità e zone
--
-- `fetch_public_media_profile` proiettava le sole `covered_territories`. Con
-- le tre modalità servono anche la modalità scelta e le zone, altrimenti una
-- realtà che copre "Tutta Italia" apparirebbe senza aree e una che copre
-- delle province apparirebbe senza niente.
--
-- Il resto della funzione è identico a quello di
-- 20261009160000_media_master_profile.sql: `create or replace` non consente
-- di sostituire una sola espressione, quindi la definizione viene ripetuta
-- per intero con quelle due aggiunte.
-- ============================================================

create or replace function public.fetch_public_media_profile(
  p_profile_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_profile      record;
  v_media        record;
  v_is_owner     boolean;
  v_is_blocked   boolean;
  v_channels     jsonb;
  v_website      text;
  v_contacts     record;
begin
  if p_profile_id is null then
    return null;
  end if;

  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select p.id, p.role, p.cover_url
    into v_profile
  from public.profiles p
  where p.id = p_profile_id;

  if not found or v_profile.role <> 'media' then
    return null;
  end if;

  v_is_owner := v_uid = p_profile_id;

  v_is_blocked := not v_is_owner and exists (
    select 1
    from public.user_blocks block
    where (block.blocker_profile_id = v_uid
           and block.blocked_profile_id = p_profile_id)
       or (block.blocker_profile_id = p_profile_id
           and block.blocked_profile_id = v_uid)
  );

  if v_is_blocked then
    return null;
  end if;

  select
    m.entity_name,
    m.short_description,
    m.logo_url,
    m.creator_type,
    m.creator_type_other,
    m.editorial_type,
    m.affiliation_type,
    m.verification_status,
    m.coverage_scope,
    coalesce(m.focus_areas, '{}'::text[])          as focus_areas,
    coalesce(m.content_types, '{}'::text[])        as content_types,
    coalesce(m.covered_territories, '{}'::text[])  as covered_territories,
    coalesce(m.covered_provinces, '{}'::text[])    as covered_provinces,
    coalesce(m.covered_competitions, '{}'::text[]) as covered_competitions,
    coalesce(m.covered_teams, '{}'::text[])        as covered_teams,
    coalesce(m.covered_topics, '{}'::text[])       as covered_topics
    into v_media
  from public.media_profiles m
  where m.profile_id = p_profile_id;

  select c.instagram, c.facebook, c.tiktok, c.youtube, c.website
    into v_contacts
  from public.get_profile_public_contacts(p_profile_id) c;

  with legacy as (
    select
      ch.channel_type,
      nullif(trim(ch.label), '') as label,
      trim(ch.url)               as url,
      ch.sort_order
    from public.media_profile_channels ch
    where ch.media_profile_id = p_profile_id
      and ch.is_public
      and trim(ch.url) <> ''
  ),
  onboarding as (
    -- I tipi sono espliciti perché questo ramo apre la UNION: un letterale
    -- `unknown` in prima posizione lascerebbe la risoluzione dei tipi al
    -- caso, e qui si uniscono colonne vere a letterali.
    select * from (
      values
        ('website'::text,   nullif(trim(v_contacts.website), ''),   0),
        ('instagram'::text, nullif(trim(v_contacts.instagram), ''), 1),
        ('youtube'::text,   nullif(trim(v_contacts.youtube), ''),   2),
        ('tiktok'::text,    nullif(trim(v_contacts.tiktok), ''),    3),
        ('facebook'::text,  nullif(trim(v_contacts.facebook), ''),  4)
    ) as t(channel_type, url, sort_order)
    where url is not null
  ),
  merged as (
    -- REV-PROF-22: `profile_contacts` è la superficie che l'editor scrive, e
    -- vince sulla tabella storica. Prima era il contrario, e un canale
    -- corretto nell'editor sarebbe rimasto invisibile dietro il valore
    -- legacy che nessuna schermata sa più modificare.
    select channel_type, null::text as label, url, sort_order, 0 as source_rank
      from onboarding
    union all
    select channel_type, label, url, sort_order, 1 from legacy
  ),
  deduplicated as (
    select distinct on (channel_type)
      channel_type, label, url, sort_order
    from merged
    order by channel_type, source_rank, sort_order
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'channel_type', channel_type,
        'label',        label,
        'url',          url
      )
      order by sort_order, channel_type
    ),
    '[]'::jsonb
  )
    into v_channels
  from deduplicated;

  select url into v_website
  from jsonb_to_recordset(v_channels) as c(channel_type text, url text)
  where c.channel_type = 'website'
  limit 1;

  return jsonb_build_object(
    'entity', jsonb_build_object(
      'profile_id',           p_profile_id,
      'entity_name',          nullif(trim(coalesce(v_media.entity_name, '')), ''),
      'short_description',    nullif(trim(coalesce(v_media.short_description, '')), ''),
      'logo_url',             nullif(trim(coalesce(v_media.logo_url, '')), ''),
      'cover_url',            nullif(trim(coalesce(v_profile.cover_url, '')), ''),
      'creator_type',         v_media.creator_type,
      'creator_type_other',   nullif(trim(coalesce(v_media.creator_type_other, '')), ''),
      'editorial_type',       nullif(trim(coalesce(v_media.editorial_type, '')), ''),
      'affiliation_type',     nullif(trim(coalesce(v_media.affiliation_type, '')), ''),
      'verification_status',  coalesce(v_media.verification_status, 'unverified'),
      'coverage_scope',       v_media.coverage_scope,
      'focus_areas',          to_jsonb(coalesce(v_media.focus_areas, '{}'::text[])),
      'content_types',        to_jsonb(coalesce(v_media.content_types, '{}'::text[])),
      'covered_territories',  to_jsonb(coalesce(v_media.covered_territories, '{}'::text[])),
      'covered_provinces',    to_jsonb(coalesce(v_media.covered_provinces, '{}'::text[])),
      'covered_competitions', to_jsonb(coalesce(v_media.covered_competitions, '{}'::text[])),
      'covered_teams',        to_jsonb(coalesce(v_media.covered_teams, '{}'::text[])),
      'covered_topics',       to_jsonb(coalesce(v_media.covered_topics, '{}'::text[])),
      'channels',             coalesce(v_channels, '[]'::jsonb),
      'website_url',          v_website
    ),
    'viewer', jsonb_build_object(
      'mode', case when v_is_owner then 'owner' else 'visitor' end,
      'can_edit_profile',            v_is_owner,
      'can_publish_article',         v_is_owner,
      'can_create_tribuna_content',  v_is_owner,
      'can_manage_tribuna_content',  v_is_owner,
      'can_add_media',               v_is_owner,
      'can_follow',                  not v_is_owner,
      'can_message',                 not v_is_owner,
      'can_share',                   true,
      'can_report',                  not v_is_owner,
      'can_block',                   not v_is_owner,
      'can_view_website',            v_website is not null,
      'is_following', not v_is_owner and exists (
        select 1
        from public.profile_follows f
        where f.followed_profile_id = p_profile_id
          and f.follower_profile_id = v_uid
      )
    )
  );
end;
$$;

comment on function public.fetch_public_media_profile(uuid) is
  'REV-PROF-21 / REV-PROF-22: payload pubblico + capabilities del Master '
  'Profile Media/Creator. Proiezione esplicita: nessun dato personale del '
  'proprietario puo uscire da qui.';

revoke all on function public.fetch_public_media_profile(uuid) from public;
grant execute on function public.fetch_public_media_profile(uuid) to authenticated;
