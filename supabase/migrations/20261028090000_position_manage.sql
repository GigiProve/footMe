-- ============================================================
-- DAS-REV-17 — Bozza, modifica e pubblicazione Position
--
-- Nessuna Position nuova, nessun lifecycle nuovo, nessuna tabella nuova.
-- §4 è esplicito: «Riutilizza la Position esistente e il relativo ID
-- stabile. Non creare DraftPositionV2, PublishedPositionCopy, modelli per
-- singolo ruolo o una seconda tabella di annunci pubblici.»
--
-- Restano quindi `recruiting_ads` come unica Position, `ad_status` come
-- unico lifecycle, `publish_positions` come unico commit di prima
-- pubblicazione (DAS-REV-16 §25, riusato da §16 di questa revisione) e
-- `position_publish_blockers` come unica autorità sulla pubblicabilità.
--
-- Due lacune reali impediscono però di esprimere il contratto con ciò che
-- esiste oggi:
--
--   1. **Il dettaglio gestionale non sa dire se una bozza è pubblicabile.**
--      `fetch_society_position_detail` della 20261026 risponde al Centro —
--      titolo, conteggi, stato — e deriva `can_publish` da «titolo non
--      vuoto e scadenza non passata», che §10 vieta: «Il server deve
--      restituire una valutazione coerente della bozza, con gli
--      identificativi dei campi mancanti o non validi» e §23 «non fidarti
--      di is_ready del client». La sezione 1 estende quella lettura con lo
--      schema del composer (profilo, ruolo, ambito, dettagli, squadre
--      secondarie, versione) e con `blockers` reali.
--
--   2. **Una Position pubblicata non è modificabile.** `update_position_draft`
--      rifiuta qualsiasi stato diverso da DRAFT, e il dominio non ha un
--      comando per i soli dettagli consentiti. §20 e §21 ne chiedono uno
--      con una whitelist per lifecycle, che mantenga ID, `published_at`,
--      candidature e identità sportiva. È la sezione 3.
--
-- Ciò che **non** serve creare, e che infatti non c'è:
--
--   * il blocco degli identificativi dopo la pubblicazione esiste già nel
--     trigger `recruiting_ads_composer_guard` (DAS-REV-16 §25) — qui si
--     aggiunge soltanto il rifiuto *esplicito* del comando incoerente, che
--     §21 chiede di non ignorare silenziosamente;
--   * `published_at` una volta sola, idem;
--   * `resource_version` incrementale, idem;
--   * l'idempotenza della pubblicazione, già in `position_compose_operations`.
--
-- Rollback: droppare `update_published_position` e `position_editable_keys`;
-- ripristinare `fetch_society_position_detail` dalla 20261027. Nessuna
-- colonna viene aggiunta o rimossa, nessun dato viene riscritto: questa
-- migrazione è di sole funzioni, quindi il rollback non perde nulla.
--
-- Idempotenza: `create or replace function` ovunque; il solo `drop` è
-- quello che precede la ricreazione di una funzione con più colonne OUT —
-- PostgreSQL non permette di cambiarle con `create or replace`.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — la lettura gestionale, una sola (§7, §18, §23)
--
-- §23 chiede una sola operazione «Leggi dettaglio gestionale» che
-- restituisca «Dati consentiti, lifecycle, versione, schema, azioni
-- effettive, valutazione della bozza». Oggi quei dati vivono divisi fra
-- `fetch_society_position_detail` (conteggi, gruppo, scadenza) e
-- `fetch_position_drafts` (schema, dettagli, blockers, versione): due
-- letture per una pagina sola, con due nozioni diverse di `can_publish`.
--
-- Si estende la prima invece di aggiungerne una terza. Le colonne nuove
-- sono additive e il Centro continua a leggere le sue; cambia la semantica
-- di due colonne già esistenti, e cambia in meglio:
--
--   * `can_edit` / `can_publish` passano da `society_position_in_scope` a
--     `position_can_operate_on_ad`, che verifica il perimetro anche sulle
--     **squadre secondarie** (DAS-REV-16 §5, §28 — «Se viene perso scope su
--     un Team secondaria, il server non pubblica un incarico ridotto»);
--   * `can_publish` non prova più a indovinare la validità del contenuto
--     dal titolo: la dice `blockers`, e §10 vuole che sia il server a
--     produrla per intero.
--
-- Il drop è obbligato: `create or replace function` non può cambiare il
-- tipo di ritorno di una funzione `returns table`.
-- ============================================================

drop function if exists public.fetch_society_position_detail(uuid);

create or replace function public.fetch_society_position_detail(p_ad_id uuid)
returns table (
  position_id        uuid,
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  club_is_verified   boolean,
  club_region        text,
  club_city          text,
  title              text,
  description        text,
  role_required      text,
  target_role        text,
  profile_type       text,
  role_id            text,
  role_label         text,
  role_is_custom     boolean,
  custom_role_name   text,
  status             text,
  group_key          text,
  position_scope     text,
  team_id            uuid,
  team_name          text,
  team_is_inactive   boolean,
  context_label      text,
  season_label       text,
  region             text,
  age_mode           text,
  age_min            integer,
  age_max            integer,
  details            jsonb,
  secondary_teams    jsonb,
  compensation_summary text,
  published_at       timestamptz,
  updated_at         timestamptz,
  closed_at          timestamptz,
  deadline_at        timestamptz,
  deadline_date      date,
  deadline_timezone  text,
  receiving_closed   boolean,
  counts_available   boolean,
  applications_total integer,
  applications_new   integer,
  can_edit           boolean,
  can_publish        boolean,
  can_close          boolean,
  has_details        boolean,
  blockers           text[],
  resource_version   integer,
  schema_version     integer,
  creation_batch_id  uuid,
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
  v_club    uuid;
  v_team    uuid;
  v_status  public.ad_status;
  v_caps    text[];
  v_group   text;
  v_season  text := public.current_season_id();
  v_now     timestamptz := timezone('utc', now());
  v_app_ok  boolean;
  v_edit    boolean;
  v_publish boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select ra.club_id, ra.team_id, ra.status
    into v_club, v_team, v_status
  from public.recruiting_ads ra
  where ra.id = p_ad_id;

  -- §23: «Un errore di autorizzazione non deve rivelare i dati della
  -- risorsa negata.» Inesistente e non autorizzata producono lo stesso
  -- esito, e lo stesso vale per la readiness: §23 vieta che «Readiness e
  -- numero di campi mancanti siano utilizzabili per sondare bozze private
  -- tramite ID arbitrari».
  if v_club is null then
    raise exception 'POSITION_NOT_AVAILABLE';
  end if;

  if not public.owns_club(v_club)
     and not public.club_access_is_active(v_club, v_uid) then
    raise exception 'POSITION_NOT_AVAILABLE';
  end if;

  v_caps := public.dashboard_club_capabilities(v_club);

  if not ('positions_view' = any (v_caps))
     or not public.society_position_in_scope(v_club, v_team, 'positions_view') then
    raise exception 'POSITION_NOT_AVAILABLE';
  end if;

  v_group := public.society_position_group(v_status);

  -- §5: «La sola capacità di leggere una Position non concede
  -- automaticamente accesso a nomi, conteggi, nuove candidature o dettagli
  -- dei candidati. Non mostrare conteggi protetti nemmeno come zero.»
  v_app_ok := ('applications_view' = any (v_caps))
           and public.society_position_in_scope(v_club, v_team, 'applications_view');

  -- Perimetro su **tutte** le squadre dell'incarico, principale e
  -- secondarie, non sulla sola principale.
  v_edit    := public.position_can_operate_on_ad(p_ad_id, 'edit');
  v_publish := public.position_can_operate_on_ad(p_ad_id, 'publish');

  return query
  select
    ra.id,
    ra.club_id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    c.region,
    c.city,
    nullif(btrim(ra.title), ''),
    nullif(btrim(ra.description), ''),
    ra.role_required::text,
    ra.target_role::text,
    ra.target_role::text,
    ra.structured_role_id,
    pr.label,
    coalesce(pr.is_custom, false),
    ra.custom_role_name,
    ra.status::text,
    v_group,
    ra.position_scope_type,
    ra.team_id,
    case
      when ra.position_scope_type = 'society' then null
      when v_group = 'closed' then coalesce(ra.published_team_name, ct.name)
      else ct.name
    end,
    coalesce(ct.is_archived, false),
    case
      when ra.position_scope_type = 'society' then null
      when v_group = 'closed' then
        coalesce(snap_lvl.label,
          case when snap_type.tier = 'youth' then 'Settore giovanile' end)
      else
        coalesce(cur_lvl.label,
          case when coalesce(cur_type.tier, ct.team_type) = 'youth'
            then 'Settore giovanile' end)
    end,
    case when v_group = 'closed' then snap_season.label end,
    ra.region,
    ra.age_mode,
    ra.age_min,
    ra.age_max,
    coalesce(ra.details, '{}'::jsonb),
    coalesce(
      (select jsonb_agg(jsonb_build_object(
                'teamId', t.id,
                'name',   t.name,
                'isInactive', t.is_archived
              ) order by t.sort_order, t.name)
         from public.recruiting_ad_teams rat
         join public.club_teams t on t.id = rat.team_id
        where rat.ad_id = ra.id),
      '[]'::jsonb
    ),
    nullif(btrim(ra.compensation_summary), ''),
    ra.published_at,
    ra.updated_at,
    ra.closed_at,
    ra.application_deadline_at,
    /* Giorno civile nel fuso della Società: il client non riconverte un
       istante UTC e non sposta il giorno (DAS-REV-16 §23). */
    case
      when ra.application_deadline_at is null then null
      else (ra.application_deadline_at
              at time zone public.society_position_timezone(ra.club_id))::date
    end,
    ra.application_deadline_timezone,
    (ra.status = 'published'
      and ra.application_deadline_at is not null
      and v_now >= ra.application_deadline_at),
    v_app_ok,
    case when v_app_ok then (
      select count(*)::integer
      from public.recruiting_applications app
      where app.ad_id = ra.id and app.status <> 'withdrawn'
    ) end,
    /* §18: «aprire la posizione non deve segnare automaticamente tutte le
       candidature come lette». La lettura resta una lettura. */
    case when v_app_ok then (
      select count(*)::integer
      from public.recruiting_applications app
      where app.ad_id = ra.id and app.status = 'submitted'
    ) end,
    /* DAS-REV-15 §13: «Una Position CLOSED non espone modifica,
       riapertura, duplicazione o eliminazione in V1.» */
    v_edit and v_status <> 'closed',
    /* §7: «Un utente con modifica ma senza pubblicazione può completare e
       salvare la bozza; non vede Pubblica posizione.» Il permesso è qui, la
       validità del contenuto in `blockers`: §4 vieta di confondere le due —
       «Pronta per la pubblicazione non è un nuovo lifecycle». */
    v_publish and v_status = 'draft',
    /* Chiusura: DAS-REV-18, non questa task. Resta la sola informazione di
       permesso già prodotta dal Centro. */
    v_edit and v_status = 'published',
    public.position_has_details(ra.id),
    public.position_publish_blockers(ra.id),
    ra.resource_version,
    ra.schema_version,
    ra.creation_batch_id,
    v_now,
    (extract(epoch from ra.updated_at) * 1000)::bigint
  from public.recruiting_ads ra
  join public.clubs c on c.id = ra.club_id
  left join public.club_teams ct on ct.id = ra.team_id
  left join public.position_roles pr on pr.id = ra.structured_role_id
  left join public.club_team_seasons cur_cfg
    on cur_cfg.team_id = ct.id and cur_cfg.season_id = v_season
  left join public.team_levels cur_lvl  on cur_lvl.id = cur_cfg.level_id
  left join public.team_types  cur_type on cur_type.id = cur_cfg.team_type_id
  left join public.team_levels snap_lvl  on snap_lvl.id = ra.published_level_id
  left join public.team_types  snap_type on snap_type.id = ra.published_team_type_id
  left join public.seasons     snap_season on snap_season.id = ra.published_season_id
  where ra.id = p_ad_id;
end;
$$;

revoke all on function public.fetch_society_position_detail(uuid) from public;
grant execute on function public.fetch_society_position_detail(uuid) to authenticated;

comment on function public.fetch_society_position_detail(uuid) is
  'DAS-REV-17 §23: la lettura gestionale unica — dati consentiti, '
  'lifecycle, versione, schema, azioni effettive e valutazione della '
  'bozza. I conteggi Application restano gated da applications_view: §5 '
  'vieta di mostrarli, anche come zero, a chi non li può vedere.';


-- ============================================================
-- SEZIONE 2 — la whitelist per lifecycle (§19, §20, §24)
--
-- §24: «La validazione è condivisa tra crea, modifica bozza e pubblica; la
-- whitelist delle attive restringe ulteriormente i campi ammessi. Non
-- mantenere tre versioni incompatibili delle stesse regole.»
--
-- Un punto solo, interrogabile, invece di un `case` ripetuto dentro il
-- comando: il client mostra righe bloccate e il server rifiuta patch con le
-- **stesse** chiavi, e il giorno in cui uno schema cambia cambia qui.
--
-- Le chiavi sono quelle del contratto client (`PositionDetails` +
-- `PositionPatch`), non i nomi delle colonne: è il payload che va
-- autorizzato, e `description` è una colonna mentre `requirements` è una
-- chiave di `details`. La distinzione la fa il comando, non la whitelist.
-- ============================================================

create or replace function public.position_editable_keys(
  p_profile_type text,
  p_status       text
)
returns text[]
language plpgsql
immutable
as $$
declare
  v_details text[];
begin
  -- §19: dopo la pubblicazione restano fissi Society, profilo, ruolo, nome
  -- custom, ambito e squadra principale. Non compaiono in questa lista, e
  -- nessuna eccezione «modificabile con zero candidature» li riammette.
  v_details := case p_profile_type
    when 'player' then array[
      'ageMode', 'ageMin', 'ageMax', 'description',
      'availability', 'playerExperience', 'playerSituation', 'requirements'
    ]
    when 'coach' then array[
      'secondaryTeamIds', 'description',
      'coachQualificationId', 'experience', 'availability', 'requirements'
    ]
    when 'staff' then array[
      'secondaryTeamIds', 'description',
      'staffQualification', 'experience', 'availability', 'requirements'
    ]
    when 'director' then array[
      'description',
      'responsibilities', 'experience', 'availability', 'requirements'
    ]
    else array[]::text[]
  end;

  if p_status = 'published' then
    return v_details;
  end if;

  -- In bozza si aggiungono i dati comuni: §11 — «sono modificabili i campi
  -- comuni ammessi: profilo, ruolo, etichetta di Altro, ambito e squadra
  -- principale, oltre ai dettagli specifici».
  if p_status = 'draft' then
    return array['profileType', 'roleId', 'customRoleName', 'scope', 'teamId']
           || v_details;
  end if;

  return array[]::text[];
end;
$$;

revoke all on function public.position_editable_keys(text, text) from public;
grant execute on function public.position_editable_keys(text, text) to authenticated;

comment on function public.position_editable_keys(text, text) is
  'DAS-REV-17 §24: le chiavi di patch ammesse per profilo e lifecycle. '
  'Una sola fonte per il form, il comando e i test.';


-- ============================================================
-- SEZIONE 3 — modifica dei dettagli di una Position attiva (§20, §21)
--
-- «Al tap esegui un comando autorizzato, versionato e atomico. Deve
-- verificare lifecycle ancora compatibile e whitelist dei campi, poi
-- aggiornare i dettagli della stessa Position.»
--
-- Alla riuscita, §21: lifecycle invariato, stesso Position ID, stesso
-- `published_at`, `updated_at` e versione nuovi, candidature intatte. Le
-- prime tre sono garantite dal trigger `recruiting_ads_composer_guard`
-- (DAS-REV-16 §25) e non vengono riscritte qui; le candidature non sono
-- toccate perché questo comando non le nomina — §21 vieta esplicitamente
-- «rifiuti o accettazioni automatiche» a seguito di nuovi criteri.
--
-- «Una richiesta che combina campi consentiti e identificativi vietati deve
-- essere rifiutata come comando incoerente: non ignorare silenziosamente i
-- campi vietati salvando il resto.» Da qui il controllo della whitelist
-- **prima** di qualunque scrittura, dentro la stessa transazione del lock.
-- ============================================================

create or replace function public.update_published_position(
  p_ad_id            uuid,
  p_expected_version integer,
  p_patch            jsonb
)
returns table (position_id uuid, resource_version integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad      record;
  v_patch   jsonb := coalesce(p_patch, '{}'::jsonb);
  v_allowed text[];
  /* Le chiavi che vivono in **colonne** o in una relazione, non dentro
     `details`. Servono a distinguere i due livelli della patch: senza,
     `details.description` sarebbe accettata e finirebbe in un doppione
     jsonb che nessuno legge, e un `requirements` di primo livello verrebbe
     ignorato in silenzio — che è ciò che §21 vieta. */
  v_columns text[] := array[
    'ageMode', 'ageMin', 'ageMax', 'description', 'secondaryTeamIds'
  ];
  v_details jsonb;
  v_key     text;
  v_value   jsonb;
  v_teams   uuid[];
  v_team    uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- §25: «Una verifica di stato fatta prima della transazione non è
  -- sufficiente se lo stato può cambiare prima della scrittura.» Il lock
  -- apre la sezione critica; tutto ciò che segue vive dentro di essa.
  select ra.*, ra.target_role::text as profile_type into v_ad
  from public.recruiting_ads ra
  where ra.id = p_ad_id
  for update;

  if not found then
    raise exception 'POSITION_NOT_FOUND';
  end if;

  if not public.position_can_operate_on_ad(p_ad_id, 'edit') then
    raise exception 'POSITION_NOT_AUTHORIZED';
  end if;

  -- §24: una CLOSED, o una tornata DRAFT, non accetta questa patch. Il
  -- client riconcilia lo stato reale invece di forzare.
  if v_ad.status <> 'published' then
    raise exception 'POSITION_LIFECYCLE_CONFLICT';
  end if;

  if p_expected_version is not null
     and p_expected_version <> v_ad.resource_version then
    raise exception 'POSITION_VERSION_CONFLICT';
  end if;

  v_allowed := public.position_editable_keys(v_ad.profile_type, 'published');

  -- ── Rifiuto del comando incoerente, prima di ogni scrittura (§21) ────
  --
  -- Profilo, ruolo, nome custom, ambito e squadra principale non sono nella
  -- whitelist: §19 li vuole fissi, e §21 vuole il rifiuto dell'intero
  -- comando, non il salvataggio dei soli campi leciti.
  if exists (
    select 1
    from jsonb_object_keys(v_patch) as k
    where k <> 'details'
      and k = any (array['profileType', 'roleId', 'customRoleName', 'scope', 'teamId'])
  ) then
    raise exception 'POSITION_IDENTITY_LOCKED';
  end if;

  -- Primo livello: solo colonne e relazioni ammesse dal lifecycle.
  if exists (
    select 1
    from jsonb_object_keys(v_patch) as k
    where k <> 'details'
      and not (k = any (v_allowed) and k = any (v_columns))
  ) then
    raise exception 'POSITION_FIELD_NOT_EDITABLE';
  end if;

  if v_patch ? 'details' then
    if jsonb_typeof(v_patch -> 'details') <> 'object' then
      raise exception 'POSITION_PATCH_INVALID';
    end if;

    -- Dentro `details`: solo chiavi dello schema, mai una colonna travestita.
    if exists (
      select 1
      from jsonb_object_keys(v_patch -> 'details') as k
      where not (k = any (v_allowed)) or k = any (v_columns)
    ) then
      raise exception 'POSITION_FIELD_NOT_EDITABLE';
    end if;
  end if;

  v_details := coalesce(v_ad.details, '{}'::jsonb);

  -- ── Fascia d'età (§20) ───────────────────────────────────────────────
  --
  -- «L'età del Calciatore è un criterio dell'annuncio, non un dato
  -- identificativo bloccato: può essere aggiornata a un altro intervallo
  -- valido o a Nessun limite di età. Su una Position pubblicata non può
  -- tornare a una scelta non impostata.»
  if v_patch ? 'ageMode' then
    if coalesce(v_patch ->> 'ageMode', 'unset') = 'unset' then
      raise exception 'POSITION_AGE_UNSET_NOT_ALLOWED';
    end if;

    update public.recruiting_ads
       set age_mode = v_patch ->> 'ageMode',
           age_min = case
             when (v_patch ->> 'ageMode') = 'range'
               then nullif(v_patch ->> 'ageMin', '')::integer
             else null end,
           age_max = case
             when (v_patch ->> 'ageMode') = 'range'
               then nullif(v_patch ->> 'ageMax', '')::integer
             else null end
     where id = p_ad_id;
  end if;

  if v_patch ? 'description' then
    update public.recruiting_ads
       set description = nullif(btrim(coalesce(v_patch ->> 'description', '')), '')
     where id = p_ad_id;
  end if;

  -- ── Squadre dello stesso incarico (§20) ──────────────────────────────
  --
  -- «Aggiunta e rimozione delle secondarie restano consentite dove
  -- previsto, anche nell'editor attivo … Le relazioni secondarie non
  -- generano nuove Application o richieste di candidatura.»
  if v_patch ? 'secondaryTeamIds' then
    if jsonb_typeof(v_patch -> 'secondaryTeamIds') <> 'array' then
      raise exception 'POSITION_PATCH_INVALID';
    end if;

    select coalesce(array_agg(distinct t::uuid), array[]::uuid[])
      into v_teams
    from jsonb_array_elements_text(v_patch -> 'secondaryTeamIds') as t
    where nullif(t, '') is not null;

    foreach v_team in array v_teams loop
      -- §9: «Valida ID reali, appartenenza alla stessa Society, assenza di
      -- duplicati, esclusione della principale dalle secondarie,
      -- disponibilità e autorizzazione su tutte le relazioni interessate.»
      if v_team = v_ad.team_id then
        raise exception 'POSITION_SECONDARY_TEAM_IS_PRIMARY';
      end if;

      if not exists (
        select 1 from public.club_teams ct
        where ct.id = v_team and ct.club_id = v_ad.club_id and not ct.is_archived
      ) then
        raise exception 'POSITION_TEAM_NOT_ELIGIBLE';
      end if;

      if not public.position_can_operate(v_ad.club_id, 'team', v_team, 'edit') then
        raise exception 'POSITION_NOT_AUTHORIZED';
      end if;
    end loop;

    delete from public.recruiting_ad_teams
     where ad_id = p_ad_id
       and team_id <> all (v_teams);

    insert into public.recruiting_ad_teams (ad_id, team_id)
    select p_ad_id, t from unnest(v_teams) as t
    on conflict do nothing;
  end if;

  -- ── Dettagli tipizzati: fusione, non sostituzione (§12) ──────────────
  --
  -- «Usa patch parziali. Un campo non presente nel comando significa
  -- nessuna modifica; un azzeramento esplicito significa rimozione soltanto
  -- se permessa.» E «Preserva i dati legacy sconosciuti durante lettura e
  -- aggiornamento dei campi noti»: le chiavi non nominate sopravvivono
  -- proprio perché la fusione non riscrive l'oggetto.
  if v_patch ? 'details' then
    for v_key, v_value in select * from jsonb_each(v_patch -> 'details') loop
      if jsonb_typeof(v_value) = 'null' then
        v_details := v_details - v_key;
      elsif jsonb_typeof(v_value) = 'string'
        and nullif(btrim(v_value #>> '{}'), '') is null then
        -- Spazi soltanto equivalgono a rimozione: §12 chiede «rimozione
        -- degli spazi inutili ai margini», e un campo di soli spazi non è
        -- un dettaglio.
        v_details := v_details - v_key;
      elsif jsonb_typeof(v_value) = 'string' then
        v_details := jsonb_set(v_details, array[v_key], to_jsonb(btrim(v_value #>> '{}')));
      elsif jsonb_typeof(v_value) = 'array'
        and jsonb_array_length(v_value) = 0 then
        v_details := v_details - v_key;
      else
        v_details := jsonb_set(v_details, array[v_key], v_value);
      end if;
    end loop;

    update public.recruiting_ads set details = v_details where id = p_ad_id;
  end if;

  update public.recruiting_ads
     set updated_at = timezone('utc', now())
   where id = p_ad_id;

  -- §21: «Non serve una seconda approvazione della modifica.» Lo stato
  -- resta `published`, `published_at` resta la prima pubblicazione, e la
  -- versione la incrementa il trigger: nessuna delle tre è scritta qui.
  return query
  select ra.id, ra.resource_version
  from public.recruiting_ads ra where ra.id = p_ad_id;
end;
$$;

revoke all on function public.update_published_position(uuid, integer, jsonb) from public;
grant execute on function public.update_published_position(uuid, integer, jsonb) to authenticated;

comment on function public.update_published_position(uuid, integer, jsonb) is
  'DAS-REV-17 §21: aggiorna i soli dettagli consentiti di una Position '
  'attiva. Stesso ID, stesso lifecycle, stesso published_at, stesse '
  'candidature. Un payload che nomina un identificativo bloccato viene '
  'rifiutato per intero, non salvato a metà.';
