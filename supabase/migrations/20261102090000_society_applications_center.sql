-- DAS-REV-22 — Candidature ricevute: centro e dettaglio
--
-- Il lato Società leggeva le candidature in tre modi diversi e incompatibili:
--
--   * `getClubApplications()` via PostgREST, protetto da una policy
--     **owner-only** (`owns_club`) — un amministratore con `applications_view`
--     vedeva i conteggi e apriva una lista vuota;
--   * i conteggi di `fetch_society_position_detail` /
--     `fetch_society_positions_page`, che chiamavano "nuove" lo stato
--     `submitted` della selezione;
--   * il widget della Dashboard, con la stessa definizione di "nuove".
--
-- §8 separa le due cose: «Nuova identifica una submission corrente da
-- consultare, non una fase della selezione.» Serve quindi un read model vero,
-- per actor e per revisione della submission, e una lettura di lista
-- autorizzata via SECURITY DEFINER come ogni altra superficie societaria.
--
-- Cosa introduce, in ordine:
--
--   1. submission corrente su `recruiting_applications`
--      (`latest_submitted_at`, `submission_revision`, `withdrawn_at`) e
--      candidature di Allenatore / Staff / Dirigente, oggi impossibili per un
--      `player_profile_id not null`;
--   2. `position_application_reads` — la lettura, per actor e revisione;
--   3. `position_shortlist_entries` — la shortlist **della Position**, che
--      §4 chiama PositionShortlistEntry e che non esisteva: `club_shortlists`
--      sono le liste di scouting di RET-07, un dominio diverso;
--   4. le RPC di lettura e le due mutation del centro;
--   5. la riemissione delle tre proiezioni che contavano le "nuove" sullo
--      stato della selezione.
--
-- Idempotenza: `add column if not exists`, `create table if not exists`,
-- `create or replace function`, `drop policy if exists` prima di ogni
-- `create policy`, `create index if not exists`. I backfill sono scritti per
-- non riapplicarsi (`where ... is null`).
--
-- Convenzioni riprese da:
--   20261026090000_society_positions_center.sql  (society_position_in_scope,
--     cursore opaco vincolato a query + `as_of` congelato)
--   20261029090000_position_deadline_close.sql   (apply_to_position, cutoff)
--   20261030090000_society_member_invites.sql    (forma delle RPC di centro)


-- ============================================================
-- SEZIONE 1 — submission corrente, ritiro, applicanti non calciatori
--
-- §7: «La data mostrata nella lista e nel dettaglio deriva da
-- latest_submitted_at o dall'evento corrente equivalente. Non usare sempre
-- Application.created_at: dopo una ricandidatura quest'ultimo può
-- rappresentare il primo invio storico.»
--
-- `submission_revision` è l'altra metà: §8 chiede di «inviare al comando di
-- lettura la revisione della submission realmente visualizzata», così che un
-- retry relativo alla vecchia revisione non marchi letta quella nuova.
--
-- `player_profile_id` era `not null` con FK su `player_profiles`: una
-- Position con `target_role` coach/staff/director non poteva ricevere
-- candidature, e §17 ne descrive quattro varianti professionali. La colonna
-- resta — è il riferimento dei lettori esistenti — ma diventa facoltativa.
-- ============================================================

alter table public.recruiting_applications
  add column if not exists latest_submitted_at timestamptz;

alter table public.recruiting_applications
  add column if not exists submission_revision integer not null default 1;

alter table public.recruiting_applications
  add column if not exists withdrawn_at timestamptz;

alter table public.recruiting_applications
  alter column player_profile_id drop not null;

comment on column public.recruiting_applications.latest_submitted_at is
  'DAS-REV-22 §7: istante della submission corrente. Non cambia quando la '
  'candidatura viene letta, aggiunta alla shortlist o quando la Position '
  'viene chiusa; una ricandidatura valida lo aggiorna. Distinto da '
  'created_at, che resta il primo invio storico.';

comment on column public.recruiting_applications.submission_revision is
  'DAS-REV-22 §8: revisione della submission corrente. La lettura è '
  'registrata per revisione, quindi una ricandidatura torna non letta senza '
  'cancellare il marker storico e una vecchia conferma di lettura non può '
  'marcare letta la revisione successiva.';

comment on column public.recruiting_applications.withdrawn_at is
  'DAS-REV-22 §19: istante del ritiro, quando conosciuto. Null su una '
  'candidatura non ritirata e null anche su un ritiro storico senza '
  'testimonianza affidabile — §32 vieta di backfillare da updated_at.';

comment on column public.recruiting_applications.player_profile_id is
  'DAS-REV-22 §17: facoltativo dal 20261102090000. Resta valorizzato per le '
  'candidature di un Calciatore; Allenatore, Staff e Dirigente non hanno una '
  'riga player_profiles e lo lasciano null.';

-- §32: «Non backfillare latest_submitted_at da updated_at indiscriminatamente.
-- Usa eventi, dati originari affidabili o assenza esplicita.»
--
-- Qui `created_at` è dimostrabilmente l'invio pertinente, non un fallback di
-- comodo: fino a questa migrazione il dominio non aveva né ritiro né
-- ricandidatura — `apply_to_position` era l'unica scrittura di una riga nuova
-- e su `unique_violation` restituiva l'esistente senza reinviare. Ogni riga
-- esistente ha quindi esattamente una submission, ed è quella.
update public.recruiting_applications
set latest_submitted_at = created_at
where latest_submitted_at is null;

-- Il ritiro storico ha una testimonianza solo se il trigger di log ha
-- registrato la transizione. Dove non c'è, la colonna resta null: §19 —
-- «Per record legacy senza una data storica affidabile conserva l'assenza».
update public.recruiting_applications a
set withdrawn_at = e.occurred_at
from (
  select
    ev.application_id,
    max(ev.occurred_at) as occurred_at
  from public.recruiting_application_events ev
  where ev.to_status = 'withdrawn'
  group by ev.application_id
) e
where e.application_id = a.id
  and a.status = 'withdrawn'
  and a.withdrawn_at is null;

/**
 * Ordinamento unico di §10: `latest_submitted_at desc`, tie-breaker `id desc`.
 * L'indice lo copre per Position; il centro generale filtra per club e si
 * appoggia a questo indice attraverso il join sull'ad.
 */
create index if not exists recruiting_applications_submission_idx
  on public.recruiting_applications (ad_id, latest_submitted_at desc, id desc);

create index if not exists recruiting_applications_applicant_idx
  on public.recruiting_applications (applicant_profile_id);


-- ------------------------------------------------------------
-- Il ritiro timbra la propria data senza un nuovo flusso
--
-- §3 vieta di ridisegnare ritiro e ricandidatura lato persona, e oggi il
-- ritiro è una `update` PostgREST diretta (recruiting-service.ts). Un trigger
-- è il solo modo di rendere la data affidabile per i lettori senza toccare
-- quel chiamante.
--
-- `before` e non `after`: la riga scritta deve già contenere il valore, così
-- una lettura concorrente non vede mai WITHDRAWN senza `withdrawn_at`.
-- ------------------------------------------------------------

create or replace function public.recruiting_applications_stamp_withdrawal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'withdrawn' and old.status <> 'withdrawn' then
    new.withdrawn_at := coalesce(new.withdrawn_at, timezone('utc', now()));
  end if;

  /* Una ricandidatura valida esce da WITHDRAWN: la data del ritiro
     precedente non descrive più lo stato corrente e viene azzerata insieme
     alla nuova submission (§24). */
  if old.status = 'withdrawn' and new.status <> 'withdrawn' then
    new.withdrawn_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists recruiting_applications_stamp_withdrawal
  on public.recruiting_applications;

create trigger recruiting_applications_stamp_withdrawal
  before update of status on public.recruiting_applications
  for each row execute function public.recruiting_applications_stamp_withdrawal();

comment on function public.recruiting_applications_stamp_withdrawal() is
  'DAS-REV-22 §19, §24: timbra withdrawn_at sulla transizione verso '
  'withdrawn e lo azzera quando la candidatura torna attiva, senza '
  'richiedere un nuovo flusso di ritiro lato persona.';


-- ------------------------------------------------------------
-- La policy di INSERT tollera il `player_profile_id` nullo
--
-- Allargamento minimo e necessario: senza di esso la colonna resa
-- facoltativa non sarebbe scrivibile da nessuno. L'identità dell'applicante
-- resta vincolata ad `auth.uid()`.
-- ------------------------------------------------------------

drop policy if exists "players can create own applications"
  on public.recruiting_applications;

create policy "applicants can create own applications"
on public.recruiting_applications
for insert
to authenticated
with check (
  public.is_current_user(applicant_profile_id)
  and (
    player_profile_id is null
    or public.is_current_user(player_profile_id)
  )
);


-- ============================================================
-- SEZIONE 2 — la lettura, per actor e per revisione (§8)
--
-- «In assenza di una policy Society-shared esplicitamente approvata, applica
-- il default corrente: lettura per actor amministrativo nel contesto
-- Society.» La chiave primaria è quindi (candidatura, actor); `club_id` sta
-- in riga perché la revoca dell'accesso a una Società deve poter invalidare
-- le sue letture senza risalire ogni volta la catena verso l'ad.
--
-- `submission_revision` sulla riga, non un booleano: §8 — «Preferisci marker
-- per revisione o una verifica condizionale atomica equivalente. Non usare un
-- comando cieco is_read=true sulla candidatura corrente.»
-- ============================================================

create table if not exists public.position_application_reads (
  application_id      uuid not null
    references public.recruiting_applications(id) on delete cascade,
  actor_profile_id    uuid not null
    references public.profiles(id) on delete cascade,
  club_id             uuid not null
    references public.clubs(id) on delete cascade,
  submission_revision integer not null,
  read_at             timestamptz not null default timezone('utc', now()),
  constraint position_application_reads_pkey
    primary key (application_id, actor_profile_id)
);

create index if not exists position_application_reads_actor_idx
  on public.position_application_reads (actor_profile_id, club_id);

comment on table public.position_application_reads is
  'DAS-REV-22 §8: submission consultate, per actor amministrativo e per '
  'revisione. Nessun record qui descrive una fase della selezione: lo stato '
  'della candidatura resta recruiting_applications.status.';

alter table public.position_application_reads enable row level security;

/**
 * Lettura della propria riga soltanto. Le scritture passano esclusivamente da
 * `mark_society_application_read`, che rivalida la catena
 * Application → Position → Society/scope: §5 vieta che il client decida
 * l'autorizzazione.
 */
drop policy if exists "actors read own application reads"
  on public.position_application_reads;

create policy "actors read own application reads"
  on public.position_application_reads
  for select
  to authenticated
  using (actor_profile_id = auth.uid());


-- ============================================================
-- SEZIONE 3 — PositionShortlistEntry (§4, §20)
--
-- §3: «Se manca il supporto minimo alla shortlist, implementalo nel dominio
-- canonico condiviso con persistenza e autorizzazioni reali, predisposto per
-- la sua successiva gestione completa.» Mancava: `club_shortlist_entries`
-- (20260717090100) lega una persona a una **lista di scouting** con priorità,
-- stato di valutazione e note. La shortlist di §20 è un'altra cosa — «una
-- scelta interna relativa a una posizione» — e le due non vanno fuse: una
-- entry di lista sopravvive alla Position, questa no.
--
-- Nessuna colonna di valutazione, ordinamento o rimozione: §39 esclude «la
-- rimozione/ordinamento/valutazione completa della shortlist», che resta
-- nella sua area. Qui si registrano solo provenienza, autore e istante, che
-- §20 richiede esplicitamente.
-- ============================================================

create table if not exists public.position_shortlist_entries (
  id                    uuid primary key default gen_random_uuid(),
  ad_id                 uuid not null
    references public.recruiting_ads(id) on delete cascade,
  person_profile_id     uuid not null
    references public.profiles(id) on delete cascade,
  /* §20.6: «registra origine Application». `set null` e non `cascade`: la
     entry è una scelta della Società e non sparisce con la candidatura. */
  source_application_id uuid
    references public.recruiting_applications(id) on delete set null,
  added_by_profile_id   uuid
    references public.profiles(id) on delete set null,
  created_at            timestamptz not null default timezone('utc', now()),
  unique (ad_id, person_profile_id)
);

create index if not exists position_shortlist_entries_person_idx
  on public.position_shortlist_entries (person_profile_id);

comment on table public.position_shortlist_entries is
  'DAS-REV-22 §4, §20: shortlist della singola Position. L''unique '
  '(ad_id, person_profile_id) è la garanzia di idempotenza di §20 — due '
  'amministratori concorrenti, un doppio tap o un retry dopo timeout '
  'producono una sola entry. Non equivale ad accettazione della candidatura '
  'né a un incarico sportivo.';

alter table public.position_shortlist_entries enable row level security;

/**
 * Lettura consentita a chi può leggere le candidature di quella Position. La
 * scrittura passa solo da `add_position_shortlist_entry`.
 */
drop policy if exists "society reads position shortlist"
  on public.position_shortlist_entries;

create policy "society reads position shortlist"
  on public.position_shortlist_entries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.recruiting_ads ad
      where ad.id = position_shortlist_entries.ad_id
        and public.society_position_in_scope(
          ad.club_id, ad.team_id, 'applications_view'
        )
    )
  );


-- ============================================================
-- SEZIONE 4 — predicati condivisi
--
-- Un posto solo per dire «questa candidatura è nuova». §9 lo impone:
-- «Il conteggio Nuove usa esattamente la stessa eligibility del relativo
-- elenco.» Tre conteggi e due liste lo chiamano; duplicarlo significherebbe
-- cinque definizioni che divergono alla prima modifica.
-- ============================================================

create or replace function public.society_application_unread(
  p_application_id uuid,
  p_revision       integer,
  p_actor          uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.position_application_reads r
    where r.application_id = p_application_id
      and r.actor_profile_id = p_actor
      /* `>=` e non `=`: una lettura registrata su una revisione successiva
         (ordine di arrivo imprevisto) non deve far ricomparire la riga fra
         le Nuove. */
      and r.submission_revision >= p_revision
  );
$$;

revoke all on function public.society_application_unread(uuid, integer, uuid) from public;
/* Nessun grant ad authenticated: SECURITY DEFINER, bypassa la RLS di position_application_reads: esposta,
   direbbe a chiunque se un altro amministratore ha letto una candidatura. */

comment on function public.society_application_unread(uuid, integer, uuid) is
  'DAS-REV-22 §8, §9: submission corrente non ancora consultata da questo '
  'actor. Non dice nulla sull''autorizzazione, che resta a '
  'society_position_in_scope.';

/**
 * Eligibility completa della tab Nuove (§9), meno l'autorizzazione:
 *
 *   · Application attualmente attiva — WITHDRAWN esclusa;
 *   · Position PUBLISHED — CLOSED esclusa;
 *   · submission corrente non letta da questo actor.
 *
 * La deadline **non** compare: §9 è esplicito — «Una deadline superata con
 * Position ancora PUBLISHED non esclude le candidature già ricevute da
 * Nuove. La raccolta di nuove candidature e la consultazione di quelle
 * ricevute sono distinte.»
 */
create or replace function public.society_application_is_new(
  p_application_id uuid,
  p_revision       integer,
  p_status         public.application_status,
  p_ad_status      public.ad_status,
  p_actor          uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_status <> 'withdrawn'
     and p_ad_status = 'published'
     and public.society_application_unread(p_application_id, p_revision, p_actor);
$$;

revoke all on function public.society_application_is_new(uuid, integer, public.application_status, public.ad_status, uuid) from public;
/* Nessun grant ad authenticated: stessa ragione: accetta un p_actor arbitrario. */

comment on function public.society_application_is_new(uuid, integer, public.application_status, public.ad_status, uuid) is
  'DAS-REV-22 §9: l''unica definizione di "nuova" condivisa da lista '
  'globale, lista per Position, dettaglio Position e widget Dashboard. La '
  'deadline superata non ne fa parte.';

/**
 * Autorizzazione di una singola candidatura: §5 — «La catena Application →
 * Position → Society/scope deve essere verificata sul server.»
 *
 * Restituisce il contesto risolto, non un booleano: ogni chiamante ha bisogno
 * anche di club e team per decidere le capacità, e risolverli due volte è il
 * modo di farli divergere.
 */
create or replace function public.society_application_context(
  p_application_id uuid,
  out club_id      uuid,
  out team_id      uuid,
  out ad_id        uuid,
  out authorized   boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  select ad.club_id, ad.team_id, ad.id
    into club_id, team_id, ad_id
  from public.recruiting_applications app
  join public.recruiting_ads ad on ad.id = app.ad_id
  where app.id = p_application_id;

  if ad_id is null then
    authorized := false;

    return;
  end if;

  /* Una bozza mai pubblicata non ha candidature valide (§23). Se il legacy
     ne contiene, il record resta ma non è consultabile da qui. */
  authorized := public.society_position_in_scope(
    club_id, team_id, 'applications_view'
  );
end;
$$;

/* Nessun grant ad `authenticated`: non è una RPC del client, la chiamano
   solo le funzioni SECURITY DEFINER di questo file, che girano come
   proprietario. Esposta, restituirebbe club e Team di una candidatura
   qualsiasi anche con `authorized = false`. */
revoke all on function public.society_application_context(uuid) from public;

comment on function public.society_application_context(uuid) is
  'DAS-REV-22 §5: risolve sul server la catena Application -> Position -> '
  'Society e dice se l''actor corrente è autorizzato a leggerla. Nessun '
  'client decide questa risposta.';


-- ============================================================
-- SEZIONE 5 — cursore opaco vincolato alla query (§10, §28)
--
-- Stessa forma del cursore del Centro Posizioni (20261026090000): contesto
-- nel token, `as_of` congelato alla prima pagina, rifiuto esplicito quando il
-- contesto non coincide. «Un vecchio cursore non deve funzionare con filtri o
-- autorizzazioni diversi.»
--
-- Il digest dei filtri entra nel token: due selezioni diverse non possono
-- continuare l'una la paginazione dell'altra.
-- ============================================================

create or replace function public.society_applications_filter_digest(
  p_team_ids uuid[],
  p_ad_ids   uuid[],
  p_ad_id    uuid
)
returns text
language sql
immutable
set search_path = public
as $$
  select md5(
    coalesce(array_to_string((select array_agg(t order by t) from unnest(coalesce(p_team_ids, '{}'::uuid[])) t), ','), '')
    || '|' ||
    coalesce(array_to_string((select array_agg(a order by a) from unnest(coalesce(p_ad_ids, '{}'::uuid[])) a), ','), '')
    || '|' || coalesce(p_ad_id::text, '-')
  );
$$;

revoke all on function public.society_applications_filter_digest(uuid[], uuid[], uuid) from public;
/* Nessun grant ad authenticated: puro, interno al cursore. */

create or replace function public.society_applications_cursor_encode(
  p_club_id uuid,
  p_tab     text,
  p_digest  text,
  p_as_of   timestamptz,
  p_sort_at timestamptz,
  p_sort_id uuid
)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(convert_to(
    'v1|' || p_club_id::text
          || '|' || p_tab
          || '|' || p_digest
          || '|' || (extract(epoch from p_as_of) * 1000)::bigint::text
          || '|' || (extract(epoch from p_sort_at) * 1000000)::bigint::text
          || '|' || p_sort_id::text,
    'utf8'), 'base64');
$$;

revoke all on function public.society_applications_cursor_encode(uuid, text, text, timestamptz, timestamptz, uuid) from public;
/* Nessun grant ad authenticated: puro, interno al cursore. */

create or replace function public.society_applications_cursor_decode(
  p_cursor  text,
  p_club_id uuid,
  p_tab     text,
  p_digest  text,
  out as_of   timestamptz,
  out sort_at timestamptz,
  out sort_id uuid
)
language plpgsql
immutable
set search_path = public
as $$
declare
  v_parts text[];
begin
  begin
    v_parts := string_to_array(convert_from(decode(p_cursor, 'base64'), 'utf8'), '|');

    if array_length(v_parts, 1) <> 7
       or v_parts[1] <> 'v1'
       or v_parts[2] <> p_club_id::text
       or v_parts[3] <> p_tab
       or v_parts[4] <> p_digest then
      raise exception 'APPLICATIONS_CURSOR_INVALID';
    end if;

    as_of   := to_timestamp(v_parts[5]::bigint / 1000.0);
    sort_at := to_timestamp(v_parts[6]::bigint / 1000000.0);
    sort_id := v_parts[7]::uuid;
  exception when others then
    raise exception 'APPLICATIONS_CURSOR_INVALID';
  end;
end;
$$;

revoke all on function public.society_applications_cursor_decode(text, uuid, text, text) from public;
/* Nessun grant ad authenticated: puro, interno al cursore. */


-- ============================================================
-- SEZIONE 6 — situazione professionale corrente, un resolver solo
--
-- §16: «Lista e dettaglio usano lo stesso resolver della situazione
-- professionale. Se esistono più rapporti attuali e il profilo non determina
-- un contesto univoco, applica il suo riepilogo canonico oppure ometti il
-- dato; non scegliere arbitrariamente il primo club.»
--
-- Vive in SQL perché la lista non può permettersi N letture di profilo (§10
-- vieta le query N+1) e il dettaglio deve dire la stessa cosa. Ogni ramo
-- legge il dato che quella tipologia di profilo dichiara, mai una deduzione:
-- §4 — «Svincolato deriva da un dato esplicito e attendibile del profilo. Non
-- derivarlo da assenza di membership PROLINK».
-- ============================================================

/**
 * Stagione sportiva corrente nel formato delle carriere (`2025/2026`).
 *
 * Distinta da `current_season_id()`, che usa il formato compatto `2025/26`
 * della tassonomia Squadre: sono due vocabolari diversi e confonderli
 * produce zero righe correnti in silenzio.
 */
create or replace function public.career_current_season_label(
  p_now timestamptz default timezone('utc', now())
)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when extract(month from p_now) >= 7
      then extract(year from p_now)::integer::text || '/' || (extract(year from p_now)::integer + 1)::text
    else (extract(year from p_now)::integer - 1)::text || '/' || extract(year from p_now)::integer::text
  end;
$$;

revoke all on function public.career_current_season_label(timestamptz) from public;
/* Nessun grant ad authenticated: puro, interno al resolver. */

comment on function public.career_current_season_label(timestamptz) is
  'DAS-REV-22 §16: stagione corrente nel formato YYYY/YYYY usato da '
  'player_career_entries.season_label e dagli array seasons di coach/staff. '
  'Luglio apre la stagione nuova, come getCurrentSeasonKey lato client.';

create or replace function public.profile_current_situation(p_profile_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role    text;
  v_season  text := public.career_current_season_label();
  v_value   text;
  v_count   integer;
begin
  select pr.role::text into v_role
  from public.profiles pr
  where pr.id = p_profile_id;

  if v_role is null then
    return null;
  end if;

  if v_role = 'player' then
    /* Dato esplicito e attendibile, non una deduzione (§4). */
    if exists (
      select 1 from public.player_profiles pp
      where pp.profile_id = p_profile_id and pp.contract_status = 'svincolato'
    ) then
      return 'Svincolato';
    end if;

    select count(distinct nullif(btrim(e.club_name), '')),
           min(nullif(btrim(e.club_name), ''))
      into v_count, v_value
    from public.player_career_entries e
    where e.player_profile_id = p_profile_id
      and e.season_label = v_season;

    return case when v_count = 1 then v_value end;
  end if;

  if v_role = 'coach' then
    select nullif(btrim(cp.current_club), '') into v_value
    from public.coach_profiles cp
    where cp.profile_id = p_profile_id;

    if v_value is not null then
      return v_value;
    end if;

    select count(distinct nullif(btrim(e.team_name), '')),
           min(nullif(btrim(e.team_name), ''))
      into v_count, v_value
    from public.coach_career_entries e
    where e.coach_profile_id = p_profile_id
      and v_season = any (e.seasons);

    return case when v_count = 1 then v_value end;
  end if;

  if v_role = 'staff' then
    select count(distinct nullif(btrim(e.team_name), '')),
           min(nullif(btrim(e.team_name), ''))
      into v_count, v_value
    from public.staff_career_entries e
    where e.staff_profile_id = p_profile_id
      and v_season = any (e.seasons);

    return case when v_count = 1 then v_value end;
  end if;

  if v_role = 'director' then
    /* La carriera del Dirigente è jsonb dentro director_profiles
       (REV-PROF-09): un periodo senza fine vale "in corso". */
    select count(distinct nullif(btrim(entry ->> 'team_name'), '')),
           min(nullif(btrim(entry ->> 'team_name'), ''))
      into v_count, v_value
    from public.director_profiles dp
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(dp.career_entries) = 'array'
        then dp.career_entries else '[]'::jsonb end
    ) as entry
    where dp.profile_id = p_profile_id
      and coalesce(entry ->> 'period_end_year', '') = '';

    return case when v_count = 1 then v_value end;
  end if;

  return null;
end;
$$;

revoke all on function public.profile_current_situation(uuid) from public;
/* Nessun grant ad authenticated: SECURITY DEFINER sui profili per ruolo: esposta, restituirebbe la
   situazione corrente di qualunque profilo scavalcando la RLS. */

comment on function public.profile_current_situation(uuid) is
  'DAS-REV-22 §16: situazione professionale corrente, letta dal dato che la '
  'tipologia di profilo dichiara. Null quando il profilo non determina un '
  'contesto univoco: §16 vieta di scegliere arbitrariamente il primo club, e '
  'null non è "Svincolato".';


-- ============================================================
-- SEZIONE 7 — intestazione del Centro (§12)
--
-- Stessa forma di `fetch_society_invites_center`: identità reale, capacità, i
-- due conteggi non filtrati dell'intero scope dell'actor. §9 — «Un count
-- locale filtrato e il count Dashboard non filtrato possono differire
-- legittimamente»: questi sono i secondi, e la pagina restituisce i primi.
--
-- `null` e non `0` quando la capability manca: §9 — «Non inventare un count
-- zero in presenza di errore, dato assente o capability mancante.»
-- ============================================================

create or replace function public.fetch_society_applications_center(p_club_id uuid)
returns table (
  club_id            uuid,
  club_name          text,
  club_logo_url      text,
  club_is_verified   boolean,
  can_view           boolean,
  can_add_shortlist  boolean,
  scope_label        text,
  new_count          integer,
  total_count        integer,
  access_verified_at timestamptz,
  data_revision      integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_caps      text[];
  v_view      boolean;
  v_shortlist boolean;
  v_scope     uuid[];
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.owns_club(p_club_id)
     and not public.club_access_is_active(p_club_id, v_uid) then
    raise exception 'APPLICATIONS_NOT_AUTHORIZED';
  end if;

  v_caps  := public.dashboard_club_capabilities(p_club_id);
  v_view  := 'applications_view' = any (v_caps);

  if not v_view then
    raise exception 'APPLICATIONS_NOT_AUTHORIZED';
  end if;

  v_shortlist := 'shortlist_add_profiles' = any (v_caps);
  v_scope     := case when not public.owns_club(p_club_id)
    then public.dashboard_club_capability_scope(p_club_id, 'applications_view') end;

  return query
  select
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    v_view,
    v_shortlist,
    public.dashboard_club_scope_label(p_club_id),
    (
      select count(*)::integer
      from public.recruiting_applications app
      join public.recruiting_ads ad on ad.id = app.ad_id
      where ad.club_id = p_club_id
        and (v_scope is null or (ad.team_id is not null and ad.team_id = any (v_scope)))
        and public.society_application_is_new(
          app.id, app.submission_revision, app.status, ad.status, v_uid
        )
    ),
    (
      /* §9: «Il totale candidature conta le relazioni correnti visibili
         persona–Position», non gli eventi di ricandidatura. Una riga per
         Application, che l'unique (ad_id, applicant_profile_id) garantisce
         essere una sola per persona e Position.

         Le ritirate sono comprese, perché «visibili» qui significa
         consultabili in Tutte: la fixture di §33 conta 7 righe includendo
         A6, che è WITHDRAWN. È deliberatamente diverso da
         `applications_total` di una singola Position, che esclude le
         ritirate da DAS-REV-17 e misura l'altra cosa — quante candidature
         quella ricerca ha ancora in piedi. §9 ammette due conteggi diversi
         con perimetri diversi; questo commento esiste perché non sembrino
         lo stesso numero sbagliato. */
      select count(*)::integer
      from public.recruiting_applications app
      join public.recruiting_ads ad on ad.id = app.ad_id
      where ad.club_id = p_club_id
        and ad.status <> 'draft'
        and (v_scope is null or (ad.team_id is not null and ad.team_id = any (v_scope)))
    ),
    timezone('utc', now()),
    1
  from public.clubs c
  where c.id = p_club_id;
end;
$$;

revoke all on function public.fetch_society_applications_center(uuid) from public;
grant execute on function public.fetch_society_applications_center(uuid) to authenticated;

comment on function public.fetch_society_applications_center(uuid) is
  'DAS-REV-22 §12: intestazione del Centro candidature. I due conteggi sono '
  'quelli dell''intero scope autorizzato, non quelli dei filtri della vista.';


-- ============================================================
-- SEZIONE 8 — opzioni dei filtri (§14)
--
-- Due dimensioni sole, e solo opzioni autorizzate: «Mostra solo opzioni
-- autorizzate, neppure in forma disabled per quelle escluse.»
--
-- Le Squadre offerte sono quelle che sono **squadra principale** di almeno
-- una Position leggibile: §6 — «Nel filtro ordinario Squadre usa il criterio
-- della squadra principale della Position, coerente con il centro Position.»
-- Una squadra senza ricerche non è un filtro, è un vicolo cieco.
--
-- Non c'è una finta squadra "Intera società": §14 — «Per isolare una ricerca
-- Intera società seleziona quella Position nella seconda dimensione.»
-- ============================================================

create or replace function public.fetch_society_application_filters(p_club_id uuid)
returns table (
  option_kind text,
  team_id     uuid,
  ad_id       uuid,
  label       text,
  sublabel    text,
  group_key   text,
  sort_order  integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_scope uuid[];
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.owns_club(p_club_id)
     and not public.club_access_is_active(p_club_id, v_uid) then
    return;
  end if;

  if not ('applications_view' = any (public.dashboard_club_capabilities(p_club_id))) then
    return;
  end if;

  v_scope := case when not public.owns_club(p_club_id)
    then public.dashboard_club_capability_scope(p_club_id, 'applications_view') end;

  return query
  select
    'team'::text,
    ct.id,
    null::uuid,
    ct.name,
    null::text,
    null::text,
    0
  from public.club_teams ct
  where ct.club_id = p_club_id
    and (v_scope is null or ct.id = any (v_scope))
    and exists (
      select 1
      from public.recruiting_ads ra
      where ra.team_id = ct.id
        and ra.club_id = p_club_id
        and ra.status <> 'draft'
        and ra.position_scope_type = 'team'
    )

  union all

  select
    'position'::text,
    ra.team_id,
    ra.id,
    /* Stesso vocabolario del centro Position: ruolo strutturato, custom, o
       titolo. Non una quarta formattazione del nome di una ricerca. */
    coalesce(
      nullif(btrim(ra.custom_role_name), ''),
      pr.label,
      nullif(btrim(ra.title), ''),
      'Posizione senza titolo'
    ),
    case
      when ra.position_scope_type = 'society' then 'Intera società'
      when ra.status = 'closed' then coalesce(ra.published_team_name, ct.name)
      else ct.name
    end,
    public.society_position_group(ra.status),
    1
  from public.recruiting_ads ra
  left join public.club_teams ct on ct.id = ra.team_id
  left join public.position_roles pr on pr.id = ra.structured_role_id
  where ra.club_id = p_club_id
    and ra.status <> 'draft'
    and public.society_position_in_scope(ra.club_id, ra.team_id, 'applications_view')
  order by 7, 6 nulls first, 4;
end;
$$;

revoke all on function public.fetch_society_application_filters(uuid) from public;
grant execute on function public.fetch_society_application_filters(uuid) to authenticated;

comment on function public.fetch_society_application_filters(uuid) is
  'DAS-REV-22 §14: le due sole dimensioni del filtro. Le Position chiuse '
  'restano opzioni valide — «Una Position CLOSED ancora autorizzata non è un '
  'filtro invalido» — e sono raggruppate da group_key.';


-- ============================================================
-- SEZIONE 9 — la pagina (§9, §10, §13, §14, §23)
--
-- Una sola lettura per le quattro superfici di elenco: centro generale,
-- risultati filtrati, elenco di una Position PUBLISHED e storico di una
-- CLOSED. §15 lo chiede per il dettaglio e §23 per la lista — «Tap apre lo
-- stesso elenco canonico limitato all'esatto position_id». Quattro RPC
-- sarebbero quattro punti in cui dimenticare un controllo di scope.
--
-- Ordine di applicazione, quello di §10: Society, autorizzazione/visibilità,
-- eligibility del tab, filtri, ordinamento, paginazione. Mai filtrare dopo
-- aver scaricato una pagina non autorizzata.
--
-- `as_of` congelato alla prima pagina, come nel Centro Posizioni: una
-- ricandidatura arrivata durante lo scorrimento non sposta una riga sotto il
-- dito e non la duplica fra due pagine (§10). Il nuovo ordine entra al
-- refresh esplicito.
--
-- Chiave di ordinamento `coalesce(latest_submitted_at, 'epoch')`: §32 —
-- «I record con data sconosciuta mantengono un ordinamento deterministico
-- documentato e non ricevono la data di oggi.» `epoch` li tiene in fondo
-- senza inventare nulla; la data mostrata resta null.
-- ============================================================

create or replace function public.fetch_society_applications_page(
  p_club_id  uuid,
  p_tab      text    default 'new',
  p_team_ids uuid[]  default null,
  p_ad_ids   uuid[]  default null,
  p_ad_id    uuid    default null,
  p_cursor   text    default null,
  p_limit    integer default 20
)
returns table (
  items              jsonb,
  next_cursor        text,
  as_of              timestamptz,
  effective_team_ids uuid[],
  effective_ad_ids   uuid[],
  filtered_total     integer,
  filtered_new       integer,
  filtered_operative integer,
  position_context   jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_tab       text := coalesce(p_tab, 'new');
  v_limit     integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_scope     uuid[];
  v_teams     uuid[];
  v_ads       uuid[];
  v_digest    text;
  v_as_of     timestamptz;
  v_sort_at   timestamptz;
  v_sort_id   uuid;
  v_items     jsonb;
  v_next      text;
  v_total     integer;
  v_new       integer;
  v_context   jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_tab not in ('new', 'all') then
    raise exception 'APPLICATIONS_TAB_INVALID';
  end if;

  if not public.owns_club(p_club_id)
     and not public.club_access_is_active(p_club_id, v_uid) then
    raise exception 'APPLICATIONS_NOT_AUTHORIZED';
  end if;

  if not ('applications_view' = any (public.dashboard_club_capabilities(p_club_id))) then
    raise exception 'APPLICATIONS_NOT_AUTHORIZED';
  end if;

  v_scope := case when not public.owns_club(p_club_id)
    then public.dashboard_club_capability_scope(p_club_id, 'applications_view') end;

  /* Lista contestuale: il position_id fissa il contesto e §23 vieta i filtri
     ridondanti. Un ad fuori scope non viene «filtrato dopo»: solleva. */
  if p_ad_id is not null then
    if not exists (
      select 1
      from public.recruiting_ads ra
      where ra.id = p_ad_id
        and ra.club_id = p_club_id
        and ra.status <> 'draft'
        and public.society_position_in_scope(ra.club_id, ra.team_id, 'applications_view')
    ) then
      raise exception 'APPLICATIONS_NOT_AUTHORIZED';
    end if;

    v_teams := null;
    v_ads   := null;

    select jsonb_build_object(
      'ad_id',      ra.id,
      'status',     ra.status::text,
      'group',      public.society_position_group(ra.status),
      'scope',      ra.position_scope_type,
      'team_id',    ra.team_id,
      'team_label', case
        when ra.position_scope_type = 'society' then 'Intera società'
        when ra.status = 'closed' then coalesce(ra.published_team_name, ct.name)
        else ct.name
      end,
      'role_label', coalesce(
        nullif(btrim(ra.custom_role_name), ''),
        pr.label,
        nullif(btrim(ra.title), ''),
        'Posizione senza titolo'
      ),
      'target_role', ra.target_role::text
    )
    into v_context
    from public.recruiting_ads ra
    left join public.club_teams ct on ct.id = ra.team_id
    left join public.position_roles pr on pr.id = ra.structured_role_id
    where ra.id = p_ad_id;
  else
    /* §14: «Se permessi/scope cambiano, il server normalizza anche il filtro
       applicato e restituisce i valori effettivi.» L'intersezione è con ciò
       che l'actor può davvero leggere, non con ciò che ha chiesto. Un
       risultato vuoto su una dimensione la annulla: il client riallinea il
       riepilogo ai dati restituiti, invece di mostrarne uno diverso dal
       dataset (§26). */
    select array_agg(ct.id)
    into v_teams
    from public.club_teams ct
    where ct.club_id = p_club_id
      and ct.id = any (coalesce(p_team_ids, '{}'::uuid[]))
      and (v_scope is null or ct.id = any (v_scope));

    select array_agg(ra.id)
    into v_ads
    from public.recruiting_ads ra
    where ra.club_id = p_club_id
      and ra.id = any (coalesce(p_ad_ids, '{}'::uuid[]))
      and ra.status <> 'draft'
      and public.society_position_in_scope(ra.club_id, ra.team_id, 'applications_view');

    v_context := null;
  end if;

  v_digest := public.society_applications_filter_digest(v_teams, v_ads, p_ad_id);

  if p_cursor is null then
    v_as_of   := timezone('utc', now());
    v_sort_at := null;
    v_sort_id := null;
  else
    select d.as_of, d.sort_at, d.sort_id
      into v_as_of, v_sort_at, v_sort_id
    from public.society_applications_cursor_decode(
      p_cursor, p_club_id, v_tab, v_digest
    ) d;
  end if;


  return query
  with base as (
    select
      app.id,
      app.submission_revision,
      app.status::text                       as app_status,
      app.latest_submitted_at,
      app.withdrawn_at,
      coalesce(app.latest_submitted_at, 'epoch'::timestamptz) as sort_at,
      public.society_application_is_new(
        app.id, app.submission_revision, app.status, ra.status, v_uid
      )                                      as is_new,
      app.applicant_profile_id               as person_id,
      ra.id                                  as ad_id,
      ra.status::text                        as ad_status,
      ra.position_scope_type                 as position_scope,
      ra.team_id,
      case
        when ra.position_scope_type = 'society' then 'Intera società'
        when ra.status = 'closed' then coalesce(ra.published_team_name, ct.name)
        else ct.name
      end                                    as team_label,
      coalesce(
        nullif(btrim(ra.custom_role_name), ''),
        pr.label,
        nullif(btrim(ra.title), ''),
        'Posizione senza titolo'
      )                                      as role_label,
      ra.target_role::text                   as target_role
    from public.recruiting_applications app
    join public.recruiting_ads ra on ra.id = app.ad_id
    left join public.club_teams ct on ct.id = ra.team_id
    left join public.position_roles pr on pr.id = ra.structured_role_id
    where ra.club_id = p_club_id
      /* §23: «Una Position DRAFT mai pubblicata non ha candidature valide e
         non mostra conteggi o accessi storici fittizi.» I record restano, ma
         non sono consultabili da qui. */
      and ra.status <> 'draft'
      and (v_scope is null or (ra.team_id is not null and ra.team_id = any (v_scope)))
      and (p_ad_id is null or ra.id = p_ad_id)
      and (
        v_teams is null
        or (ra.position_scope_type = 'team' and ra.team_id = any (v_teams))
      )
      and (v_ads is null or ra.id = any (v_ads))
      and coalesce(app.latest_submitted_at, 'epoch'::timestamptz) <= v_as_of
  ),
  eligible as (
    select * from base
    where v_tab = 'all' or is_new
  ),
  counted as (
    select
      /* §9: il totale della vista non dipende dalla tab — è ciò che
         «Tutte» mostrerebbe con questi filtri, ed è la metà sinistra di
         «2 candidature · 1 nuova» negli screen 11 e 12. */
      count(*)::integer                                          as filtered_total,
      count(*) filter (where b.is_new)::integer                  as filtered_new,
      /* §27: «Se Nuove è vuoto perché esistono soltanto candidature
         ritirate/di posizioni chiuse, usa una copy vera … Non affermare che
         siano state tutte lette.» Per distinguere i due casi serve sapere
         quante righe **potrebbero** essere nuove: una candidatura attiva su
         una Position PUBLISHED, letta o no. Senza questo terzo conteggio
         «tutte consultate» e «solo storico» sono indistinguibili, e una
         delle due copy sarebbe sempre falsa. */
      count(*) filter (
        where b.app_status <> 'withdrawn' and b.ad_status = 'published'
      )::integer                                                 as filtered_operative
    from base b
  ),
  page as (
    select e.*
    from eligible e
    where v_sort_at is null
       or (e.sort_at, e.id) < (v_sort_at, v_sort_id)
    order by e.sort_at desc, e.id desc
    limit v_limit
  ),
  enriched as (
    select
      page.*,
      prof.full_name                                 as person_name,
      prof.avatar_url                                as person_avatar_url,
      prof.role::text                                as person_role,
      public.profile_current_situation(page.person_id) as person_situation
    from page
    join public.profiles prof on prof.id = page.person_id
  )
  select
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'application_id',      x.id,
            'submission_revision', x.submission_revision,
            'status',              x.app_status,
            'latest_submitted_at', x.latest_submitted_at,
            'withdrawn_at',        x.withdrawn_at,
            'is_new',              x.is_new,
            'person_id',           x.person_id,
            'person_name',         x.person_name,
            'person_avatar_url',   x.person_avatar_url,
            'person_role',         x.person_role,
            'person_situation',    x.person_situation,
            'ad_id',               x.ad_id,
            'ad_status',           x.ad_status,
            'position_scope',      x.position_scope,
            'team_id',             x.team_id,
            'team_label',          x.team_label,
            'role_label',          x.role_label,
            'target_role',         x.target_role
          )
          order by x.sort_at desc, x.id desc
        )
        from enriched x
      ),
      '[]'::jsonb
    ),
    (
      select public.society_applications_cursor_encode(
        p_club_id, v_tab, v_digest, v_as_of, last.sort_at, last.id
      )
      from (
        select e.sort_at, e.id
        from enriched e
        order by e.sort_at asc, e.id asc
        limit 1
      ) last
      where (select count(*) from enriched) >= v_limit
    ),
    v_as_of,
    coalesce(v_teams, '{}'::uuid[]),
    coalesce(v_ads, '{}'::uuid[]),
    (select c.filtered_total from counted c),
    (select c.filtered_new from counted c),
    (select c.filtered_operative from counted c),
    v_context;
end;
$$;

revoke all on function public.fetch_society_applications_page(uuid, text, uuid[], uuid[], uuid, text, integer) from public;
grant execute on function public.fetch_society_applications_page(uuid, text, uuid[], uuid[], uuid, text, integer) to authenticated;

comment on function public.fetch_society_applications_page(uuid, text, uuid[], uuid[], uuid, text, integer) is
  'DAS-REV-22 §9, §10, §14, §23: elenco autorizzato delle candidature della '
  'Società. Lo stesso contratto serve il centro generale e l''elenco di una '
  'singola Position (p_ad_id), che non accetta filtri perché il contesto è '
  'già fissato. OR dentro ogni dimensione, AND fra le due.';


-- ============================================================
-- SEZIONE 10 — il dettaglio (§15, §19, §26)
--
-- Un solo dettaglio per tutti gli ingressi e per tutte e quattro le
-- tipologie professionali: §15 — «Usa un solo container e un solo modello di
-- dettaglio, con contenuti professionali adattivi.»
--
-- Qui stanno l'identità, il **contesto storico dell'invio** e le capacità.
-- I blocchi professionali e la carriera **non** stanno qui: §16 chiede che
-- vengano «dai profili canonici, tramite servizi/read model condivisi», ed è
-- il profilo pubblico a saperli esporre con le sue regole di privacy. Due
-- letture indipendenti sono anche ciò che rende possibile §27 — «Errore di
-- un singolo blocco della carriera: mostra il resto autorizzato».
--
-- Nessun dato personale viene restituito quando l'actor non è autorizzato:
-- §25 vieta «una scheda parzialmente oscurata con dati residui». La funzione
-- solleva e basta.
-- ============================================================

create or replace function public.fetch_society_application_detail(p_application_id uuid)
returns table (
  application_id       uuid,
  submission_revision  integer,
  status               text,
  latest_submitted_at  timestamptz,
  withdrawn_at         timestamptz,
  is_new               boolean,
  created_at           timestamptz,
  person_id            uuid,
  person_name          text,
  person_avatar_url    text,
  person_role          text,
  person_situation     text,
  club_id              uuid,
  club_name            text,
  club_logo_url        text,
  club_is_verified     boolean,
  ad_id                uuid,
  ad_status            text,
  ad_group             text,
  position_scope       text,
  team_id              uuid,
  team_label           text,
  role_label           text,
  target_role          text,
  season_label         text,
  receiving_closed     boolean,
  in_shortlist         boolean,
  can_add_shortlist    boolean,
  can_message          boolean,
  access_verified_at   timestamptz,
  data_revision        bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_ctx       record;
  v_caps      text[];
  v_app       public.recruiting_applications%rowtype;
  v_ad        public.recruiting_ads%rowtype;
  v_shortlist boolean;
  v_message   boolean;
  v_now       timestamptz := timezone('utc', now());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_ctx from public.society_application_context(p_application_id);

  if v_ctx.ad_id is null or not v_ctx.authorized then
    /* §25: lo stato generico non rivela se l'ID appartenga a un'altra
       Society né quale permesso manchi. Un codice solo per entrambi i casi. */
    raise exception 'APPLICATION_NOT_AVAILABLE';
  end if;

  select * into v_app from public.recruiting_applications where id = p_application_id;
  select * into v_ad  from public.recruiting_ads where id = v_ctx.ad_id;

  if v_ad.status = 'draft' then
    raise exception 'APPLICATION_NOT_AVAILABLE';
  end if;

  v_caps := public.dashboard_club_capabilities(v_ctx.club_id);

  /* §20: l'aggiunta richiede una capacità distinta dalla consultazione, e la
     candidatura ritirata non ne consente di nuove — «No da quella
     candidatura» (§24). CLOSED e deadline, da sole, non la bloccano. */
  v_shortlist := ('shortlist_add_profiles' = any (v_caps))
    and public.society_position_in_scope(
      v_ctx.club_id, v_ctx.team_id, 'applications_view'
    )
    and v_app.status <> 'withdrawn';

  /*
   * §22: «Messaggio apre la DIRECT canonica fra la Society corrente e la
   * PERSON candidata, quando la capacità e le regole del sistema Messaggi lo
   * consentono», e «Non usare automaticamente la conversazione personale
   * dell'amministratore».
   *
   * Nel dominio Messaggi di questo repository una conversazione ha due
   * `profile_id` e non esiste una MessagingIdentity di Società: l'identità
   * della Società **è** il profilo proprietario del club. Un amministratore
   * che non sia quel profilo non ha, oggi, un modo di scrivere come Società —
   * e §22 vieta esplicitamente il fallback «scrivi come persona». L'azione
   * resta quindi nascosta per lui, invece di aprire la chat sbagliata.
   */
  v_message := exists (
    select 1
    from public.clubs cl
    where cl.id = v_ctx.club_id
      and cl.owner_profile_id = v_uid
  )
  and v_uid <> v_app.applicant_profile_id
  and not exists (
    select 1
    from public.user_blocks b
    where (b.blocker_profile_id = v_uid and b.blocked_profile_id = v_app.applicant_profile_id)
       or (b.blocker_profile_id = v_app.applicant_profile_id and b.blocked_profile_id = v_uid)
  );

  return query
  select
    v_app.id,
    v_app.submission_revision,
    v_app.status::text,
    v_app.latest_submitted_at,
    v_app.withdrawn_at,
    public.society_application_is_new(
      v_app.id, v_app.submission_revision, v_app.status, v_ad.status, v_uid
    ),
    v_app.created_at,
    prof.id,
    prof.full_name,
    prof.avatar_url,
    prof.role::text,
    public.profile_current_situation(prof.id),
    c.id,
    c.name,
    c.logo_url,
    coalesce(c.verification_status, 'unverified') = 'verified',
    v_ad.id,
    v_ad.status::text,
    public.society_position_group(v_ad.status),
    v_ad.position_scope_type,
    v_ad.team_id,
    /* §19: «Usa versioni/snapshot autorevoli già fissati alla pubblicazione
       della Position. Una rinomina della squadra non riscrive
       retroattivamente la ricerca.» */
    case
      when v_ad.position_scope_type = 'society' then 'Intera società'
      when v_ad.status = 'closed' then coalesce(v_ad.published_team_name, ct.name)
      else ct.name
    end,
    coalesce(
      nullif(btrim(v_ad.custom_role_name), ''),
      pr.label,
      nullif(btrim(v_ad.title), ''),
      'Posizione senza titolo'
    ),
    v_ad.target_role::text,
    case when v_ad.status = 'closed' then snap_season.label end,
    (v_ad.status = 'published'
      and v_ad.application_deadline_at is not null
      and v_now >= v_ad.application_deadline_at),
    exists (
      select 1
      from public.position_shortlist_entries pse
      where pse.ad_id = v_ad.id
        and pse.person_profile_id = v_app.applicant_profile_id
    ),
    v_shortlist,
    v_message,
    v_now,
    (extract(epoch from greatest(v_app.updated_at, v_ad.updated_at)) * 1000)::bigint
  from public.profiles prof
  join public.clubs c on c.id = v_ctx.club_id
  left join public.club_teams ct on ct.id = v_ad.team_id
  left join public.position_roles pr on pr.id = v_ad.structured_role_id
  left join public.seasons snap_season on snap_season.id = v_ad.published_season_id
  where prof.id = v_app.applicant_profile_id;
end;
$$;

revoke all on function public.fetch_society_application_detail(uuid) from public;
grant execute on function public.fetch_society_application_detail(uuid) to authenticated;

comment on function public.fetch_society_application_detail(uuid) is
  'DAS-REV-22 §15, §19, §26: contesto storico dell''invio, identità corrente '
  'e capacità delle azioni. I blocchi professionali e la carriera arrivano '
  'dal profilo canonico, non da qui: §16 vieta un secondo profilo.';


-- ============================================================
-- SEZIONE 11 — marcare letta la submission visualizzata (§8)
--
-- «Invia al comando di lettura la revisione della submission realmente
-- visualizzata. Se nel frattempo arriva una ricandidatura, una risposta o un
-- retry relativo alla vecchia revisione non deve marcare letta quella nuova.»
--
-- Da cui la forma del comando: la revisione è un **parametro**, non una
-- lettura interna. Una revisione diversa da quella corrente non scrive nulla
-- e restituisce lo stato autorevole, che il client riconcilia.
--
-- Idempotente per costruzione: la chiave primaria è (candidatura, actor) e
-- l'`on conflict` alza la revisione solo verso l'alto. Più aperture della
-- stessa submission non generano contatori negativi o eventi duplicati.
-- ============================================================

/*
 * Nessuna colonna OUT porta il nome di una colonna di
 * `position_application_reads`. `application_id` e
 * `submission_revision` lo facevano, ed e' la trappola gia' documentata nel
 * progetto: in plpgsql una colonna OUT omonima rende ambigua ogni
 * referenza non qualificata, e il `on conflict (...)` non si puo' aliasare.
 *
 * `application_id` non viene piu' restituita affatto: il chiamante l'ha
 * appena passata, quindi era ridondante — lo stesso rimedio adottato da
 * fetch_my_feed_preferences (20260727110000). `submission_revision` diventa
 * `current_revision`, che e' anche il nome piu' esatto: e' la revisione
 * **corrente** della candidatura, non quella inviata dal client.
 */
create or replace function public.mark_society_application_read(
  p_application_id uuid,
  p_revision       integer
)
returns table (
  current_revision integer,
  is_new           boolean,
  marked           boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_ctx     record;
  v_app     public.recruiting_applications%rowtype;
  v_ad      public.recruiting_ads%rowtype;
  v_marked  boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_ctx from public.society_application_context(p_application_id);

  /* §8: «Alla perdita di autorizzazione non applicare letture o
     invalidazioni provenienti da un vecchio contesto.» */
  if v_ctx.ad_id is null or not v_ctx.authorized then
    raise exception 'APPLICATION_NOT_AVAILABLE';
  end if;

  /* Punto di linearizzazione: la revisione va confrontata con quella
     effettiva al commit, non con quella letta da una pagina aperta prima di
     una ricandidatura (§24 — «stato e revisione effettivi devono essere
     rivalidati al commit»). */
  select * into v_app
  from public.recruiting_applications
  where id = p_application_id
  for share;

  select * into v_ad from public.recruiting_ads where id = v_ctx.ad_id;

  if v_ad.status = 'draft' then
    raise exception 'APPLICATION_NOT_AVAILABLE';
  end if;

  if p_revision is not null and p_revision = v_app.submission_revision then
    insert into public.position_application_reads
      (application_id, actor_profile_id, club_id, submission_revision, read_at)
    values
      (p_application_id, v_uid, v_ctx.club_id, v_app.submission_revision, timezone('utc', now()))
    /* Per **nome del vincolo**, non per lista di colonne: `application_id`
       e `submission_revision` sono anche colonne OUT di questa funzione, e
       in un target di inferenza `on conflict (...)` non esiste alias con cui
       disambiguare — l'errore sarebbe «column reference is ambiguous», a
       runtime e proprio sulla mutazione che parte a ogni apertura del
       dettaglio. Il `do update` qui sotto è invece già qualificato per
       intero, e i target di `set` sono colonne per posizione, non espressioni. */
    on conflict on constraint position_application_reads_pkey do update
      set submission_revision = greatest(
            public.position_application_reads.submission_revision,
            excluded.submission_revision
          ),
          read_at = case
            when excluded.submission_revision > public.position_application_reads.submission_revision
              then excluded.read_at
            else public.position_application_reads.read_at
          end,
          club_id = excluded.club_id;

    v_marked := true;
  end if;

  return query
  select
    v_app.submission_revision,
    public.society_application_is_new(
      v_app.id, v_app.submission_revision, v_app.status, v_ad.status, v_uid
    ),
    v_marked;
end;
$$;

revoke all on function public.mark_society_application_read(uuid, integer) from public;
grant execute on function public.mark_society_application_read(uuid, integer) to authenticated;

comment on function public.mark_society_application_read(uuid, integer) is
  'DAS-REV-22 §8: marca consultata **quella** revisione. Una revisione non '
  'più corrente non scrive e restituisce marked = false: non è un errore, è '
  'una lettura arrivata tardi.';


-- ============================================================
-- SEZIONE 12 — aggiunta alla shortlist della Position (§20)
--
-- «Non fidarti di person_id, Society o position_id arbitrari inviati dal
-- client»: l'unico parametro è la candidatura, e persona e Position si
-- risolvono da lei. Non esiste un picker di destinazione perché non esiste
-- una destinazione da scegliere.
--
-- «Garantisci unicità e idempotenza con protezioni backend/database, anche
-- per due admin contemporanei, doppio tap o retry dopo timeout»: la garanzia
-- è l'unique (ad_id, person_profile_id) e un `on conflict do nothing`, non un
-- controllo di esistenza che due transazioni possono superare entrambe.
-- ============================================================

/*
 * Nomi delle colonne OUT: nessuno coincide con una colonna di
 * `position_shortlist_entries`. `ad_id` e `created_at` lo facevano, e in
 * plpgsql una colonna OUT che porta il nome di una colonna rende ambigua
 * ogni referenza non qualificata — `on conflict (ad_id, ...)` compreso, dove
 * non esiste un alias con cui disambiguare. L'errore è «column reference is
 * ambiguous», a runtime e solo sul ramo del conflitto: esattamente il ramo
 * che garantisce l'idempotenza di §20.
 */
create or replace function public.add_position_shortlist_entry(p_application_id uuid)
returns table (
  entry_id     uuid,
  position_id  uuid,
  person_id    uuid,
  added_at     timestamptz,
  already      boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_ctx  record;
  v_app  public.recruiting_applications%rowtype;
  v_ad   public.recruiting_ads%rowtype;
  v_row  public.position_shortlist_entries%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_ctx from public.society_application_context(p_application_id);

  if v_ctx.ad_id is null or not v_ctx.authorized then
    raise exception 'APPLICATION_NOT_AVAILABLE';
  end if;

  if not ('shortlist_add_profiles' = any (public.dashboard_club_capabilities(v_ctx.club_id))) then
    raise exception 'SHORTLIST_NOT_AUTHORIZED';
  end if;

  /* Stato rivalidato sotto lock: §24 — «Una schermata stale non concede
     un'azione non più valida». La race ritiro/aggiunta si decide qui. */
  select * into v_app
  from public.recruiting_applications
  where id = p_application_id
  for share;

  select * into v_ad from public.recruiting_ads where id = v_ctx.ad_id;

  if v_ad.status = 'draft' then
    raise exception 'APPLICATION_NOT_AVAILABLE';
  end if;

  /* §24: «WITHDRAWN … No da quella candidatura.» CLOSED e deadline superata
     non la bloccano: «CLOSED da solo non la blocca». */
  if v_app.status = 'withdrawn' then
    raise exception 'APPLICATION_WITHDRAWN';
  end if;

  insert into public.position_shortlist_entries
    (ad_id, person_profile_id, source_application_id, added_by_profile_id)
  values
    (v_ad.id, v_app.applicant_profile_id, v_app.id, v_uid)
  on conflict (ad_id, person_profile_id) do nothing
  returning * into v_row;

  if v_row.id is null then
    /* §20: «Una entry già esistente da altro percorso deve essere
       riconosciuta.» Un secondo tap non è un errore e non crea una seconda
       entry; restituisce la stessa. */
    select * into v_row
    from public.position_shortlist_entries pse
    where pse.ad_id = v_ad.id
      and pse.person_profile_id = v_app.applicant_profile_id;

    entry_id    := v_row.id;
    position_id := v_row.ad_id;
    person_id   := v_row.person_profile_id;
    added_at    := v_row.created_at;
    already     := true;
    return next;

    return;
  end if;

  entry_id    := v_row.id;
  position_id := v_row.ad_id;
  person_id   := v_row.person_profile_id;
  added_at    := v_row.created_at;
  already     := false;
  return next;
end;
$$;

revoke all on function public.add_position_shortlist_entry(uuid) from public;
grant execute on function public.add_position_shortlist_entry(uuid) to authenticated;

comment on function public.add_position_shortlist_entry(uuid) is
  'DAS-REV-22 §20: aggiunta atomica e idempotente alla shortlist della '
  'Position della candidatura. Non cambia lo stato della Application, non '
  'notifica il candidato, non crea Follow, incarichi o conversazioni.';


-- ============================================================
-- SEZIONE 13 — `apply_to_position` esteso, non ridisegnato (§3, §24, §32)
--
-- §3 vieta di ridisegnare l'invio lato persona, §32 autorizza invece a
-- «estendere il contratto condiviso in modo compatibile» quando servono
-- revisione e submission per la correttezza dei lettori. Qui serve, per due
-- ragioni indipendenti:
--
--   1. §17 descrive quattro varianti professionali e §33 mette in fixture
--      candidature di Allenatore, Staff e Dirigente. La versione precedente
--      sollevava POSITION_APPLICANT_NOT_ELIGIBLE senza una riga
--      `player_profiles` e POSITION_ROLE_NOT_SUPPORTED per ogni
--      `target_role` diverso da player: quelle tre candidature erano
--      impossibili, non solo assenti.
--   2. §24 descrive la ricandidatura dopo un ritiro — «aggiorna
--      latest_submitted_at e la revisione della submission, torna non letta e
--      risale nell'ordinamento; resta una sola riga corrente per persona +
--      Position». Senza di essa la riga ritirata sarebbe un vicolo cieco.
--
-- Il contratto di ritorno è invariato (stesse quattro colonne OUT, nessun
-- drop) e i codici di dominio esistenti restano gli stessi. `replayed` ora
-- distingue tre esiti: primo invio (false), retry dello stesso invio (true),
-- ricandidatura valida dopo ritiro (false, con revisione incrementata).
-- ============================================================

create or replace function public.apply_to_position(
  p_ad_id          uuid,
  p_cover_message  text
)
returns table (
  application_id uuid,
  status         text,
  created_at     timestamptz,
  replayed       boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_ad     public.recruiting_ads%rowtype;
  v_app    record;
  v_role   text;
  v_target text;
  v_player boolean;
  v_now    timestamptz := timezone('utc', now());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select pr.role::text into v_role
  from public.profiles pr
  where pr.id = v_uid;

  if v_role is null then
    raise exception 'POSITION_APPLICANT_NOT_ELIGIBLE';
  end if;

  v_player := exists (
    select 1 from public.player_profiles pp where pp.profile_id = v_uid
  );

  -- Stesso punto di linearizzazione di prima: la candidatura rivaluta lo
  -- stato corrente sotto lock, non quello letto da una pagina aperta prima
  -- del cutoff o prima della chiusura.
  select * into v_ad
  from public.recruiting_ads
  where id = p_ad_id
  for share;

  if not found or v_ad.status = 'draft' then
    raise exception 'POSITION_NOT_AVAILABLE';
  end if;

  if v_ad.status = 'closed' then
    raise exception 'POSITION_CLOSED';
  end if;

  if v_ad.application_deadline_at is not null
     and v_now >= v_ad.application_deadline_at then
    raise exception 'POSITION_DEADLINE_PASSED';
  end if;

  v_target := coalesce(v_ad.target_role::text, 'player');

  -- Il profilo deve essere della tipologia cercata. Il Calciatore ha in più
  -- il vincolo della riga `player_profiles`, che è il riferimento della
  -- colonna omonima.
  if v_role <> v_target then
    raise exception 'POSITION_ROLE_NOT_SUPPORTED';
  end if;

  if v_target = 'player' and not v_player then
    raise exception 'POSITION_APPLICANT_NOT_ELIGIBLE';
  end if;

  begin
    insert into public.recruiting_applications
      (ad_id, applicant_profile_id, player_profile_id, cover_message, status,
       latest_submitted_at, submission_revision)
    values (
      p_ad_id,
      v_uid,
      case when v_target = 'player' then v_uid end,
      nullif(btrim(coalesce(p_cover_message, '')), ''),
      'submitted',
      v_now,
      1
    )
    /* Qualificato: `status` e `created_at` sono anche nomi di colonna OUT di
       questa funzione, e in un RETURNING non qualificato plpgsql non sa
       quale dei due intendi — l'errore è «column reference is ambiguous», a
       runtime e non alla creazione. */
    returning
      recruiting_applications.id,
      recruiting_applications.status::text,
      recruiting_applications.created_at
      into v_app;

    application_id := v_app.id;
    status         := v_app.status;
    created_at     := v_app.created_at;
    replayed       := false;
    return next;
  exception when unique_violation then
    -- Riga già presente per questa persona e questa Position: o è un retry
    -- di un invio già committato, o è una ricandidatura dopo un ritiro.
    -- §24: «resta una sola riga corrente per persona + Position» — in
    -- nessuno dei due casi se ne crea una seconda.
    update public.recruiting_applications a
    set status              = 'submitted',
        latest_submitted_at = v_now,
        submission_revision = a.submission_revision + 1,
        cover_message       = coalesce(
          nullif(btrim(coalesce(p_cover_message, '')), ''), a.cover_message
        ),
        updated_at          = v_now
    where a.ad_id = p_ad_id
      and a.applicant_profile_id = v_uid
      and a.status = 'withdrawn'
    returning a.id, a.status::text, a.created_at into v_app;

    if found then
      application_id := v_app.id;
      status         := v_app.status;
      created_at     := v_app.created_at;
      /* Non è un replay: è un invio nuovo che i lettori devono vedere come
         non letto e in cima all'ordinamento. */
      replayed       := false;
      return next;

      return;
    end if;

    -- §43.78 della task precedente: un retry dopo un invio già committato
    -- recupera l'esito anche dopo il cutoff, senza duplicare e senza
    -- sollevare un errore di dominio. La submission corrente resta quella.
    select a.id, a.status::text, a.created_at into v_app
    from public.recruiting_applications a
    where a.ad_id = p_ad_id and a.applicant_profile_id = v_uid;

    application_id := v_app.id;
    status         := v_app.status;
    created_at     := v_app.created_at;
    replayed       := true;
    return next;
  end;
end;
$$;

revoke all on function public.apply_to_position(uuid, text) from public;
grant execute on function public.apply_to_position(uuid, text) to authenticated;

comment on function public.apply_to_position(uuid, text) is
  'DAS-REV-18 §17, §23 + DAS-REV-22 §24, §32: candidatura atomica e '
  'rivalidata sotto lock, estesa alle quattro tipologie professionali e alla '
  'ricandidatura dopo ritiro, che incrementa submission_revision invece di '
  'creare una seconda riga.';


-- ------------------------------------------------------------
-- La finestra di invio controlla anche la tipologia dell'applicante
--
-- Prima di questa migrazione `player_profile_id` era `not null` con FK su
-- `player_profiles`: **qualunque** percorso di insert — RPC o POST PostgREST
-- diretto — richiedeva implicitamente che chi scriveva fosse un calciatore
-- registrato. Rendendo la colonna facoltativa quella garanzia sparisce, e la
-- policy di INSERT controlla l'identità, non il ruolo.
--
-- `apply_to_position` verifica `role = target_role`, ma è una RPC: un insert
-- diretto non la attraversa, e questa tabella ha già oggi scritture dirette
-- (il ritiro è una `update` PostgREST). Il controllo va quindi dove passa
-- ogni insert, cioè qui — dove la riga dell'annuncio è peraltro già bloccata
-- `for share`.
-- ------------------------------------------------------------

create or replace function public.enforce_application_submission_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad     public.recruiting_ads%rowtype;
  v_role   text;
  v_target text;
begin
  -- Punto di linearizzazione: l'insert attende qui il `for update` di una
  -- chiusura concorrente e rilegge lo stato definitivo prima di procedere.
  select * into v_ad
  from public.recruiting_ads
  where id = new.ad_id
  for share;

  if not found then
    raise exception 'Questa posizione non è più disponibile.';
  end if;

  if v_ad.status <> 'published' then
    raise exception 'Questa posizione non accetta più candidature.';
  end if;

  -- Il valore è esclusivo (DAS-REV-18 sezione 1): il confronto resta `>=`, ma
  -- significa "il cutoff è già iniziato", non "l'ultimo microsecondo è già
  -- passato".
  if v_ad.application_deadline_at is not null
     and timezone('utc', now()) >= v_ad.application_deadline_at then
    raise exception 'Il termine per candidarsi è scaduto.';
  end if;

  select pr.role::text into v_role
  from public.profiles pr
  where pr.id = new.applicant_profile_id;

  v_target := coalesce(v_ad.target_role::text, 'player');

  if v_role is null or v_role <> v_target then
    raise exception 'POSITION_ROLE_NOT_SUPPORTED';
  end if;

  -- Il Calciatore ha in più il vincolo della riga `player_profiles`, che è il
  -- riferimento della colonna omonima.
  if v_target = 'player'
     and not exists (
       select 1 from public.player_profiles pp
       where pp.profile_id = new.applicant_profile_id
     ) then
    raise exception 'POSITION_APPLICANT_NOT_ELIGIBLE';
  end if;

  return new;
end;
$$;

comment on function public.enforce_application_submission_window() is
  'DAS-REV-18 §17 + DAS-REV-22 §17: rivalidazione di cutoff e lifecycle '
  'sotto lock, più l''eleggibilità per tipologia. Vale su ogni percorso di '
  'insert, non solo sulla RPC: con player_profile_id facoltativo la policy '
  'RLS da sola non distingue più chi può candidarsi a che cosa.';


-- ------------------------------------------------------------
-- Il trigger della finestra di invio deve tollerare la ricandidatura
--
-- `enforce_application_submission_window` è `before insert`: la
-- ricandidatura è una `update`, quindi non lo attraversa e la finestra
-- sarebbe aggirata. Lo stesso controllo va applicato anche lì — ma solo
-- quando la riga **torna** attiva, non a ogni aggiornamento di stato fatto
-- dalla Società.
-- ------------------------------------------------------------

create or replace function public.enforce_application_resubmission_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ad  public.recruiting_ads%rowtype;
  v_now timestamptz := timezone('utc', now());
begin
  if not (old.status = 'withdrawn' and new.status <> 'withdrawn') then
    return new;
  end if;

  select * into v_ad
  from public.recruiting_ads
  where id = new.ad_id
  for share;

  if not found or v_ad.status = 'draft' then
    raise exception 'Questa posizione non è più disponibile.';
  end if;

  if v_ad.status = 'closed' then
    raise exception 'Questa posizione non accetta più candidature.';
  end if;

  if v_ad.application_deadline_at is not null
     and v_now >= v_ad.application_deadline_at then
    raise exception 'Il termine per candidarsi è scaduto.';
  end if;

  return new;
end;
$$;

drop trigger if exists recruiting_applications_resubmission_window
  on public.recruiting_applications;

create trigger recruiting_applications_resubmission_window
  before update of status on public.recruiting_applications
  for each row execute function public.enforce_application_resubmission_window();

comment on function public.enforce_application_resubmission_window() is
  'DAS-REV-22 §24: la ricandidatura rispetta la stessa finestra dell''invio. '
  'Si applica solo alla transizione da withdrawn verso uno stato attivo: le '
  'altre scritture di stato della Società non passano di qui.';


-- ============================================================
-- SEZIONE 14 — le tre proiezioni che chiamavano "nuove" la selezione
--
-- §28: «Dopo una lettura aggiorna coerentemente: Nuove e Tutte per lo stesso
-- actor/context, widget/count Dashboard, count/lista/dettaglio Position,
-- lista contestuale, read state del dettaglio.» Finché le tre proiezioni
-- contano `status = 'submitted'`, aprire una candidatura non cambia nulla
-- altrove e §9 — «Il conteggio Nuove usa esattamente la stessa eligibility
-- del relativo elenco» — resta falso.
--
-- Le tre funzioni sono riemesse **dalla loro definizione più recente**
-- (fetch_society_position_detail e fetch_society_positions_page da
-- 20261029090000, fetch_dashboard_society_overview da 20261030090000), con le
-- sole sostituzioni elencate qui sotto. Ricrearle da una versione precedente
-- avrebbe silenziosamente arretrato deadline, chiusure e perimetri.
--
-- Sostituzioni, tutte e sole:
--
--   · `app.status = 'submitted'`  ->  `society_application_is_new(...)`,
--     nei quattro punti in cui definiva "nuove";
--   · `app.created_at <= v_as_of` ->  `coalesce(app.latest_submitted_at,
--     'epoch') <= v_as_of`, perché con la ricandidatura la data pertinente
--     non è più quella di creazione (§7);
--   · `max(app.created_at)`       ->  `max(app.latest_submitted_at)` nel
--     segnale di priorità, per la stessa ragione.
--
-- `applications_total` resta `status <> 'withdrawn'`: §9 — «Il totale
-- candidature conta le relazioni correnti visibili persona–Position».
-- ============================================================
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
  data_revision      bigint,
  close_reason       text,
  close_reason_text  text,
  deadline_history_visible boolean
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
    -- §8: proiezione del giorno civile via l'adapter, mai un cast diretto —
    -- con il cutoff esclusivo un cast diretto mostrerebbe il giorno dopo.
    case
      when ra.application_deadline_at is null then null
      else public.position_deadline_date(
             ra.application_deadline_at,
             coalesce(ra.application_deadline_timezone, public.society_position_timezone(ra.club_id))
           )
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
      where app.ad_id = ra.id
        and public.society_application_is_new(
          app.id, app.submission_revision, app.status, ra.status, v_uid
        )
    ) end,
    /* DAS-REV-15 §13: «Una Position CLOSED non espone modifica,
       riapertura, duplicazione o eliminazione in V1.» */
    v_edit and v_status <> 'closed',
    /* §7: «Un utente con modifica ma senza pubblicazione può completare e
       salvare la bozza; non vede Pubblica posizione.» Il permesso è qui, la
       validità del contenuto in `blockers`. */
    v_publish and v_status = 'draft',
    /* §19: Chiudi compare soltanto su una PUBLISHED e con permesso di
       modifica sull'intero incarico, squadre secondarie incluse. */
    v_edit and v_status = 'published',
    public.position_has_details(ra.id),
    public.position_publish_blockers(ra.id),
    ra.resource_version,
    ra.schema_version,
    ra.creation_batch_id,
    v_now,
    (extract(epoch from ra.updated_at) * 1000)::bigint,
    rac.reason::text,
    rac.reason_text,
    (ra.status = 'closed' and ra.application_deadline_at is not null)
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
  left join public.recruiting_ad_closures rac on rac.ad_id = ra.id
  where ra.id = p_ad_id;
end;
$$;

create or replace function public.fetch_society_positions_page(
  p_club_id uuid,
  p_group   text default 'active',
  p_scope   text default 'all',
  p_team_id uuid default null,
  p_cursor  text default null,
  p_limit   integer default 20
)
returns table (
  position_id        uuid,
  title              text,
  role_required      text,
  target_role        text,
  status             text,
  position_scope     text,
  team_id            uuid,
  team_name          text,
  team_is_inactive   boolean,
  context_label      text,
  season_label       text,
  published_at       timestamptz,
  updated_at         timestamptz,
  closed_at          timestamptz,
  receiving_closed   boolean,
  counts_available   boolean,
  applications_total integer,
  applications_new   integer,
  sort_key           text,
  next_cursor        text,
  as_of              timestamptz,
  close_reason       text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_caps      text[];
  v_scope     uuid[];
  v_app_scope uuid[];
  v_app_view  boolean;
  v_group     text := coalesce(p_group, 'active');
  v_filter    text := coalesce(p_scope, 'all');
  v_limit     integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_season    text := public.current_season_id();
  v_as_of     timestamptz;
  v_after     text;
  v_now       timestamptz := timezone('utc', now());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_group not in ('active', 'drafts', 'closed') then
    raise exception 'POSITIONS_GROUP_INVALID';
  end if;

  if v_filter not in ('all', 'society', 'team') then
    raise exception 'POSITIONS_FILTER_INVALID';
  end if;

  -- §22: «Non usare un Team ID null ambiguo per significare sia Tutte sia
  -- Intera società.» Il tipo di filtro è esplicito e il Team ID vale solo
  -- per TEAM.
  if v_filter = 'team' and p_team_id is null then
    raise exception 'POSITIONS_FILTER_INVALID';
  end if;

  if v_filter <> 'team' and p_team_id is not null then
    raise exception 'POSITIONS_FILTER_INVALID';
  end if;

  if not public.owns_club(p_club_id)
     and not public.club_access_is_active(p_club_id, v_uid) then
    raise exception 'POSITIONS_CENTER_NOT_AUTHORIZED';
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  if not ('positions_view' = any (v_caps)) then
    raise exception 'POSITIONS_CENTER_NOT_AUTHORIZED';
  end if;

  v_scope     := public.dashboard_club_capability_scope(p_club_id, 'positions_view');
  v_app_view  := 'applications_view' = any (v_caps);
  v_app_scope := case when v_app_view
    then public.dashboard_club_capability_scope(p_club_id, 'applications_view')
  end;

  -- §15: «Una selezione arbitraria passata tramite query/deep link non va
  -- accettata o convertita silenziosamente in un accesso più ampio.» Un
  -- filtro fuori perimetro non diventa "tutte": diventa un errore.
  if v_filter = 'society' and v_scope is not null then
    raise exception 'POSITIONS_FILTER_NOT_AUTHORIZED';
  end if;

  if v_filter = 'team'
     and not (
       v_scope is null
       or p_team_id = any (v_scope)
     ) then
    raise exception 'POSITIONS_FILTER_NOT_AUTHORIZED';
  end if;

  if v_filter = 'team'
     and not exists (
       select 1 from public.club_teams ct
       where ct.id = p_team_id and ct.club_id = p_club_id
     ) then
    raise exception 'POSITIONS_FILTER_NOT_AUTHORIZED';
  end if;

  if p_cursor is null then
    v_as_of := v_now;
    v_after := null;
  else
    select d.as_of, d.sort_key
      into v_as_of, v_after
    from public.society_positions_cursor_decode(
      p_cursor, p_club_id, v_group, v_filter, p_team_id
    ) d;
  end if;

  return query
  with rows_in_scope as (
    select
      ra.id,
      nullif(btrim(ra.title), '')        as title,
      ra.role_required::text             as role_required,
      ra.target_role::text               as target_role,
      ra.status,
      ra.team_id,
      ra.position_scope_type,
      ra.published_at,
      ra.updated_at,
      ra.closed_at,
      ra.application_deadline_at,
      ct.name                            as team_name,
      coalesce(ct.is_archived, false)    as team_is_inactive,
      /* Contesto corrente: tipo e livello della stagione in corso. */
      cur_lvl.label                      as current_level_label,
      coalesce(cur_type.tier, ct.team_type) as current_tier,
      /* Contesto storico: la fotografia della prima pubblicazione. */
      snap_lvl.label                     as snapshot_level_label,
      snap_type.tier                     as snapshot_tier,
      ra.published_team_name             as snapshot_team_name,
      snap_season.label                  as snapshot_season_label,
      /* DAS-REV-18 §26: motivo di chiusura, solo per lo storico. */
      rac.reason::text                   as closure_reason,
      /* §9: l'aggregato è leggibile solo con `applications_view` nel
         perimetro di **questa** riga. Nessuna eccezione permissiva nel
         serializer del Centro. */
      (
        v_app_view
        and (
          v_app_scope is null
          or (ra.team_id is not null and ra.team_id = any (v_app_scope))
        )
      ) as counts_available
    from public.recruiting_ads ra
    left join public.club_teams ct
      on ct.id = ra.team_id
    left join public.club_team_seasons cur_cfg
      on cur_cfg.team_id = ct.id
     and cur_cfg.season_id = v_season
    left join public.team_levels cur_lvl on cur_lvl.id = cur_cfg.level_id
    left join public.team_types  cur_type on cur_type.id = cur_cfg.team_type_id
    left join public.team_levels snap_lvl on snap_lvl.id = ra.published_level_id
    left join public.team_types  snap_type on snap_type.id = ra.published_team_type_id
    left join public.seasons     snap_season on snap_season.id = ra.published_season_id
    left join public.recruiting_ad_closures rac on rac.ad_id = ra.id
    where ra.club_id = p_club_id
      and public.society_position_group(ra.status) = v_group
      /* Istante congelato: l'appartenenza di una riga alla consultazione non
         cambia mentre si scorre. */
      and ra.created_at <= v_as_of
      /* Scope della capability, applicato **prima** di aggregare, ordinare e
         paginare (§9). */
      and (v_scope is null or (ra.team_id is not null and ra.team_id = any (v_scope)))
      /* Filtro di consultazione, che restringe e non amplia. */
      and (
        v_filter = 'all'
        or (v_filter = 'society' and ra.position_scope_type = 'society')
        or (v_filter = 'team'    and ra.team_id = p_team_id)
      )
  ),
  with_counts as (
    select
      r.*,
      case when r.counts_available then (
        select count(*)::integer
        from public.recruiting_applications app
        where app.ad_id = r.id
          and app.status <> 'withdrawn'
          and coalesce(app.latest_submitted_at, 'epoch'::timestamptz) <= v_as_of
      ) end as applications_total,
      case when r.counts_available then (
        select count(*)::integer
        from public.recruiting_applications app
        where app.ad_id = r.id
          and public.society_application_is_new(
            app.id, app.submission_revision, app.status, r.status, v_uid
          )
          and coalesce(app.latest_submitted_at, 'epoch'::timestamptz) <= v_as_of
      ) end as applications_new
    from rows_in_scope r
  ),
  keyed as (
    select
      w.*,
      case v_group
        when 'active' then
          (case when coalesce(w.applications_new, 0) > 0 then '0' else '1' end)
          || '|' || lpad((9999999999999
               - coalesce((extract(epoch from w.published_at) * 1000)::bigint, 0))::text, 13, '0')
          || '|' || w.id::text
        when 'drafts' then
          lpad((9999999999999
               - (extract(epoch from w.updated_at) * 1000)::bigint)::text, 13, '0')
          || '|' || w.id::text
        else
          (case when w.closed_at is null then '1' else '0' end)
          || '|' || lpad((9999999999999
               - coalesce((extract(epoch from w.closed_at) * 1000)::bigint, 0))::text, 13, '0')
          || '|' || w.id::text
      end as sort_key
    from with_counts w
  )
  select
    k.id,
    k.title,
    k.role_required,
    k.target_role,
    k.status::text,
    k.position_scope_type,
    k.team_id,
    /* §13: sulle righe storiche il nome è quello conservato, quando esiste.
       Una rinomina corrente non riscrive il significato storico. */
    case
      when k.position_scope_type = 'society' then null
      when v_group = 'closed' then coalesce(k.snapshot_team_name, k.team_name)
      else k.team_name
    end,
    k.team_is_inactive,
    case
      when k.position_scope_type = 'society' then null
      when v_group = 'closed' then
        coalesce(
          k.snapshot_level_label,
          case when k.snapshot_tier = 'youth' then 'Settore giovanile' end
        )
      else
        coalesce(
          k.current_level_label,
          case when k.current_tier = 'youth' then 'Settore giovanile' end
        )
    end,
    /* La stagione compare solo dove è un dato storico reale. */
    case when v_group = 'closed' then k.snapshot_season_label end,
    k.published_at,
    k.updated_at,
    k.closed_at,
    /* §17: ricezione, non lifecycle. Una PUBLISHED scaduta resta Attiva. */
    (k.status = 'published'
      and k.application_deadline_at is not null
      and v_now >= k.application_deadline_at),
    k.counts_available,
    k.applications_total,
    k.applications_new,
    k.sort_key,
    public.society_positions_cursor_encode(
      p_club_id, v_group, v_filter, p_team_id, v_as_of, k.sort_key
    ),
    v_as_of,
    /* §26: il testo "Altro" esteso resta nel dettaglio; qui solo il codice. */
    case when v_group = 'closed' then k.closure_reason else null end
  from keyed k
  where v_after is null or k.sort_key > v_after
  order by k.sort_key
  limit v_limit;
end;
$$;

/*
 * `drop` prima del `create`, come in **ogni** riemissione precedente
 * di questa funzione (20261013090000:51, 20261018090000:573,
 * 20261030090000:2944): il suo tipo di ritorno è cambiato più volte, quindi
 * la definizione canonica è un `create function` nudo e non un
 * `create or replace`, che su una colonna OUT diversa fallirebbe comunque
 * con «cannot change return type of existing function».
 *
 * Senza il drop l'istruzione muore con «function ... already exists with
 * same argument types» (42723). Le due sorelle qui sopra sono invece
 * `create or replace` perché riemettono una firma identica a quella già
 * applicata, e in quel caso sostituire è preferibile: non perde i grant.
 */
drop function if exists public.fetch_dashboard_society_overview(uuid);

create function public.fetch_dashboard_society_overview(p_club_id uuid)
returns table (
  -- ── Riepilogo e conteggi ────────────────────────────────────────────
  positions_open_count          integer,
  applications_count            integer,
  teams_count                   integer,
  drafts_count                  integer,
  scheduled_count               integer,

  -- ── Inviti e richieste (§14) ────────────────────────────────────────
  invites_incoming_count        integer,
  invites_pending_count         integer,

  -- ── Conteggio canonico "da gestire" (§10) ───────────────────────────
  applications_to_handle_count  integer,

  -- ── Segnali operativi normalizzati ──────────────────────────────────
  priority_signals              jsonb,
  priority_total_count          integer,

  -- ── Preview ─────────────────────────────────────────────────────────
  applications_preview          jsonb,
  teams_preview                 jsonb,
  drafts_preview                jsonb,
  recent_content_preview        jsonb,

  -- ── Metadata di cache e accesso ─────────────────────────────────────
  access_verified_at            timestamptz,
  data_revision                 bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid   := auth.uid();
  v_caps    text[];
  -- Un perimetro **per capability** (§19). Le coppie `_all` esistono perché
  -- «scope null = illimitato» è la regola più facile da invertire per
  -- sbaglio: scritta una volta, riusata in ogni predicato.
  v_pos_scope  uuid[];
  v_pos_all    boolean;
  v_app_scope  uuid[];
  v_app_all    boolean;
  v_team_scope uuid[];
  v_team_all   boolean;
  v_inv_scope  uuid[];
  v_inv_all    boolean;
  v_req_scope  uuid[];
  v_req_all    boolean;
  -- I contenuti non hanno squadra: `club_media_posts` appartiene alla
  -- Società. Le metriche editoriali esistono quindi solo per chi ha
  -- `content_view` senza restrizione di squadra.
  v_content_all boolean;
  v_now     timestamptz := timezone('utc', now());
  v_signals jsonb  := '[]'::jsonb;
  v_total   integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_caps := public.dashboard_club_capabilities(p_club_id);

  v_pos_scope  := public.dashboard_club_capability_scope(p_club_id, 'positions_view');
  v_pos_all    := v_pos_scope is null;
  v_app_scope  := public.dashboard_club_capability_scope(p_club_id, 'applications_view');
  v_app_all    := v_app_scope is null;
  v_team_scope := public.dashboard_club_capability_scope(p_club_id, 'teams_view');
  v_team_all   := v_team_scope is null;
  v_inv_scope  := public.dashboard_club_capability_scope(p_club_id, 'invites_view');
  v_inv_all    := v_inv_scope is null;
  v_req_scope  := public.dashboard_club_capability_scope(p_club_id, 'member_requests_view');
  v_req_all    := v_req_scope is null;
  v_content_all := public.dashboard_club_capability_scope(p_club_id, 'content_view') is null;

  if not ('dashboard_view' = any (v_caps)) then
    return query select
      null::integer, null::integer, null::integer, null::integer, null::integer,
      null::integer, null::integer,
      null::integer,
      null::jsonb, null::integer,
      null::jsonb, null::jsonb, null::jsonb, null::jsonb,
      null::timestamptz, null::bigint;
    return;
  end if;

  -- ── Segnali `new_applications` ────────────────────────────────────────
  if 'applications_view' = any (v_caps) then
    select coalesce(jsonb_agg(signal order by signal->>'occurred_at' desc), '[]'::jsonb)
      into v_signals
    from (
      select jsonb_build_object(
        'type_id',         'new_applications',
        'aggregation_key', 'new_applications:' || p_club_id::text || ':' || ra.id::text,
        'target_kind',     'position',
        'target_id',       ra.id,
        'count',           count(app.id)::integer,
        'role',            ra.role_required::text,
        'team_name',       ct.name,
        'deadline_at',     ra.deadline,
        'occurred_at',     max(app.latest_submitted_at)
      ) as signal
      from public.recruiting_ads ra
      join public.recruiting_applications app
        on app.ad_id = ra.id
       and public.society_application_is_new(
             app.id, app.submission_revision, app.status, ra.status, v_uid
           )
      left join public.club_teams ct on ct.id = ra.team_id
      where ra.club_id = p_club_id
        and ra.status = 'published'
        and (v_app_all or ra.team_id = any (v_app_scope))
      group by ra.id, ra.role_required, ra.deadline, ct.name
      order by max(app.latest_submitted_at) desc
      limit 10
    ) signals;

    select count(*)::integer into v_total
    from (
      select ra.id
      from public.recruiting_ads ra
      join public.recruiting_applications app
        on app.ad_id = ra.id
       and public.society_application_is_new(
             app.id, app.submission_revision, app.status, ra.status, v_uid
           )
      where ra.club_id = p_club_id
        and ra.status = 'published'
        and (v_app_all or ra.team_id = any (v_app_scope))
      group by ra.id
    ) totals;
  end if;

  return query
  select
    case when 'positions_view' = any (v_caps) then (
      select count(*)::integer
      from public.recruiting_ads ra
      where ra.club_id = p_club_id
        and ra.status = 'published'
        and (v_pos_all or ra.team_id = any (v_pos_scope))
    ) end as positions_open_count,

    case when 'applications_view' = any (v_caps) then (
      select count(*)::integer
      from public.recruiting_applications app
      join public.recruiting_ads ra on ra.id = app.ad_id
      where ra.club_id = p_club_id
        and app.status <> 'withdrawn'
        and (v_app_all or ra.team_id = any (v_app_scope))
    ) end as applications_count,

    -- §15: archiviate escluse. Le affiliate non compaiono perché la fonte è
    -- `club_teams`, non `club_affiliations`: una Società collegata non è una
    -- squadra di questa Società.
    case when 'teams_view' = any (v_caps) then (
      select count(*)::integer
      from public.club_teams ct
      where ct.club_id = p_club_id
        and not ct.is_archived
        and (v_team_all or ct.id = any (v_team_scope))
    ) end as teams_count,

    case when 'content_view' = any (v_caps) and v_content_all then (
      select count(*)::integer
      from public.club_media_posts cmp
      where cmp.club_id = p_club_id
        and cmp.status = 'draft'
    ) end as drafts_count,

    -- Contratto predisposto, dominio non ancora capace di programmare:
    -- `club_media_posts.status` ammette draft/published/archived.
    null::integer as scheduled_count,

    /* DAS-REV-19 §15: le richieste in ingresso **esistono** — sono il
       modello canonico delle richieste avviate dalla persona, che il Centro
       legge nella seconda tab. Finché nessuno le leggeva, DAS-REV-07 §14
       imponeva `null` invece di uno zero inventato; ora il numero è reale,
       e resta `null` per chi non ha la chiave di lettura. */
    case when 'member_requests_view' = any (v_caps) then (
      select count(*)::integer
      from public.club_members cm
      where cm.club_id = p_club_id
        and cm.status = 'pending'
        and cm.added_by = 'self_request'
        and cm.profile_id is not null
        and (v_req_all or (cm.team_id is not null and cm.team_id = any (v_req_scope)))
    ) end as invites_incoming_count,

    case when 'invites_view' = any (v_caps) then (
      /* DAS-REV-19 §35: il pending canonico è ora l'Invitation, non una riga
         di organico in stato `pending`. Le proposte storiche sono state
         rispecchiate, quindi il numero non cambia per i dati esistenti e
         comincia a contare quelle nuove, che `club_members` non ha mai. */
      select count(*)::integer
      from public.club_member_invites inv
      where inv.club_id = p_club_id
        and inv.status = 'pending'
        and (
          v_inv_all
          or (inv.scope_type = 'team' and inv.team_id = any (v_inv_scope))
        )
    ) end as invites_pending_count,

    case when 'applications_view' = any (v_caps) then (
      select count(*)::integer
      from public.recruiting_applications app
      join public.recruiting_ads ra on ra.id = app.ad_id
      where ra.club_id = p_club_id
        and public.society_application_is_new(
          app.id, app.submission_revision, app.status, ra.status, v_uid
        )
        and (v_app_all or ra.team_id = any (v_app_scope))
    ) end as applications_to_handle_count,

    case when 'applications_view' = any (v_caps) then v_signals end
      as priority_signals,
    case when 'applications_view' = any (v_caps) then v_total end
      as priority_total_count,

    case when 'applications_view' = any (v_caps) then (
      select coalesce(jsonb_agg(item order by item->>'created_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',         app.id,
          'created_at', app.created_at,
          'status',     app.status,
          'ad_id',      ra.id,
          'ad_title',   ra.title,
          'role',       ra.role_required,
          'team_name',  ct.name,
          'name',       coalesce(nullif(trim(p.full_name), ''), 'Candidato'),
          'avatar_url', p.avatar_url
        ) as item
        from public.recruiting_applications app
        join public.recruiting_ads ra on ra.id = app.ad_id
        join public.profiles p on p.id = app.applicant_profile_id
        left join public.club_teams ct on ct.id = ra.team_id
        where ra.club_id = p_club_id
          and app.status <> 'withdrawn'
          and (v_app_all or ra.team_id = any (v_app_scope))
        order by app.created_at desc
        limit 3
      ) preview
    ) end as applications_preview,

    -- §15: ordinamento sportivo stabile — prima squadra, poi settore
    -- giovanile secondo `sort_order`. Nessun conteggio di giocatori o staff
    -- nel payload: un campo restituito è un campo che prima o poi qualcuno
    -- disegna, e §15 lo vieta.
    case when 'teams_view' = any (v_caps) then (
      select coalesce(jsonb_agg(item order by item->>'rank', item->>'name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',       ct.id,
          'name',     ct.name,
          'category', ct.category,
          'logo_url', ct.logo_url,
          'rank',     lpad((
            case when ct.team_type = 'senior' then 0 else 1 end * 100000
            + greatest(0, least(ct.sort_order, 99999))
          )::text, 6, '0')
        ) as item
        from public.club_teams ct
        where ct.club_id = p_club_id
          and not ct.is_archived
          and (v_team_all or ct.id = any (v_team_scope))
        order by
          case when ct.team_type = 'senior' then 0 else 1 end,
          ct.sort_order,
          ct.name
        limit 3
      ) preview
    ) end as teams_preview,

    case when 'content_view' = any (v_caps) and v_content_all then (
      select coalesce(jsonb_agg(item order by item->>'updated_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',            cmp.id,
          'title',         cmp.title,
          'kind',          cmp.kind,
          'status',        cmp.status,
          'thumbnail_url', coalesce(cmp.thumbnail_url, cmp.visual_url),
          'updated_at',    cmp.updated_at
        ) as item
        from public.club_media_posts cmp
        where cmp.club_id = p_club_id
          and cmp.status = 'draft'
        order by cmp.updated_at desc
        limit 3
      ) preview
    ) end as drafts_preview,

    case when 'content_view' = any (v_caps) and v_content_all then (
      select coalesce(jsonb_agg(item order by item->>'published_at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id',            cmp.id,
          'title',         cmp.title,
          'kind',          cmp.kind,
          'status',        cmp.status,
          'thumbnail_url', coalesce(cmp.thumbnail_url, cmp.visual_url),
          'published_at',  cmp.published_at
        ) as item
        from public.club_media_posts cmp
        where cmp.club_id = p_club_id
          and cmp.status = 'published'
          and cmp.published_at <= v_now
        order by cmp.published_at desc
        limit 3
      ) preview
    ) end as recent_content_preview,

    v_now as access_verified_at,
    (extract(epoch from v_now) * 1000)::bigint as data_revision;
end;
$$;

revoke all on function public.fetch_society_position_detail(uuid) from public;
grant execute on function public.fetch_society_position_detail(uuid) to authenticated;

revoke all on function public.fetch_society_positions_page(uuid, text, text, uuid, text, integer) from public;
grant execute on function public.fetch_society_positions_page(uuid, text, text, uuid, text, integer) to authenticated;

revoke all on function public.fetch_dashboard_society_overview(uuid) from public;
grant execute on function public.fetch_dashboard_society_overview(uuid) to authenticated;

comment on function public.fetch_society_position_detail(uuid) is
  'DAS-REV-17/18 + DAS-REV-22 §9: applications_new ora usa il read model '
  'delle submission, non lo stato submitted della selezione.';
