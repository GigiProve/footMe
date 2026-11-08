-- ============================================================
-- DAS-REV-26 — Aggiunta a Shortlist dal profilo
--
-- La 24 ha consegnato il core unico (`club_shortlists`,
-- `club_shortlist_entries`, `club_shortlist_membership_log`) e la 25 il pool,
-- l'editor di valutazione e la rimozione come comando. Dal profilo, però, il
-- flusso era ancora quello di RET-07: un selector di **sole CUSTOM**
-- (`fetch_club_shortlists`), un insert PostgREST diretto e un form di
-- valutazione obbligatorio prima dell'aggiunta. La 26 lo rovescia (§1, §13):
--
--   · la destinazione può essere una **Position** (pubblicata, bozza
--     persistita o chiusa) anche senza candidatura, oppure una CUSTOM;
--   · il tap su una riga è l'aggiunta — niente form, default Da valutare /
--     priorità null / nota null **solo** per la entry nuova;
--   · una nuova CUSTOM nasce **Solo io**, con owner canonico, su tutti gli
--     ingressi del servizio condiviso (§3 «Raccordo minimo CUSTOM», §18).
--
-- Cosa mancava nel modello, e perché lo aggiunge questo file:
--
--   1. **owner e accesso della singola lista** (§18). `club_shortlists` aveva
--      solo `created_by_profile_id`, che è un autore e non un permesso. Nasce
--      `owner_profile_id` + `access_mode` ('scope' | 'owner_only'). Le righe
--      esistenti diventano 'scope', cioè **esattamente** la policy che
--      avevano (capability ∩ perimetro): §29 vieta di «restringere o
--      ampliare in massa l'accesso alle liste storiche senza una migrazione
--      verificata», e di «inventare owner da nomi». Il loro owner resta
--      nullo: non determinabile, non inventato.
--   2. **il default Solo io lato server**, in un trigger e non nel client:
--      §29 — «il nuovo default non può valere soltanto per il form del
--      profilo mentre il centro crea implicitamente liste visibili a tutti»
--      e «I client precedenti non possono bypassare i nuovi guard con
--      payload vecchi». Il trigger sovrascrive owner e access mode a ogni
--      insert CUSTOM, qualunque cosa mandi il client (QA124).
--   3. **tutti i lettori** rispettano l'accesso della singola lista (§18:
--      «centro, selector, stella, count, dettaglio, note, mutation, deep
--      link e cache»). `shortlist_in_scope` — usato dalla RLS delle entry e
--      dai comandi update/remove — lo include per costruzione; i lettori che
--      chiamano `society_position_in_scope` direttamente sono riemessi in
--      fondo al file dalla loro definizione più recente, con una sola riga
--      in più ciascuno.
--   4. le letture del profilo: **stato della stella** (§9, §24 — non un
--      booleano con false di ripiego), **destinazioni** per gruppo con
--      cursore proprio (§11, §12 — un gruppo in errore non è un gruppo
--      vuoto) e **membership della persona** (§14).
--   5. i comandi: **aggiunta dal profilo** (§13) a Position o CUSTOM, e
--      **creazione CUSTOM con persona iniziale** in una sola transazione
--      idempotente (§19). Lo stesso comando di creazione serve il centro,
--      con persona nulla: un solo servizio, un solo default.
--   6. **ambiti di creazione** autorizzati (§17): il form leggeva
--      `club_teams` filtrato dalla sola RLS di lettura delle squadre, che
--      non è il perimetro di `shortlist_create_lists`.
--
-- Riuso, non duplicazione (§2, §24): nessuna nuova tabella di entry, nessun
-- secondo registro di idempotenza — le ricevute stanno in
-- `application_operations` con le due funzioni `application_operation_*`
-- (20261103090000), come per i comandi della 24 e della 25. Il contenitore
-- POSITION si materializza con `get_or_create_position_shortlist` (24). La
-- candidatura pertinente si collega con il trigger
-- `link_shortlist_entry_application` (24), che non tocca l'origine PROFILE.
--
-- Nessun insert in `public.notifications`, nessuna Application, nessun
-- evento di feed in tutto il file: §23, §28.
--
-- Le funzioni riemesse sono copiate dalla **definizione più recente
-- effettiva** (20261105090000 per context/pool/entry, 20261104090000 per
-- le altre) e differiscono soltanto nelle righe marcate «DAS-REV-26».
-- ============================================================


-- ============================================================
-- SEZIONE 1 — owner e accesso della singola lista (§18, §29)
-- ============================================================

alter table public.club_shortlists
  add column if not exists owner_profile_id uuid
    references public.profiles(id) on delete set null;

alter table public.club_shortlists
  add column if not exists access_mode text not null default 'scope';

alter table public.club_shortlists
  drop constraint if exists club_shortlists_access_mode_check;

alter table public.club_shortlists
  add constraint club_shortlists_access_mode_check
  check (access_mode in ('scope', 'owner_only'));

/* §18: «Non applicare owner personale o ACL Solo io alle Position
   Shortlist.» Un CHECK basta: è una proprietà della riga sola. */
alter table public.club_shortlists
  drop constraint if exists club_shortlists_position_access_check;

alter table public.club_shortlists
  add constraint club_shortlists_position_access_check
  check (
    list_type = 'custom'
    or (access_mode = 'scope' and owner_profile_id is null)
  );

/* Owner eliminato: `on delete set null` lascia una Solo io senza owner,
   che `shortlist_list_access_ok` non concede a nessuno. È la scelta
   conservativa di §29 — «Una policy legacy non determinabile non va
   sostituita con accesso aperto. Proteggi il dato e segnala il gap» — e non
   cancella liste e valutazioni con l'account (§29: nessuna cancellazione
   non richiesta). Il recupero di quelle liste è un gap dichiarato per la 27
   (gestione e trasferimento owner). Un CHECK «owner_only ⇒ owner» qui
   bloccherebbe invece la cancellazione dell'account. */

create index if not exists club_shortlists_owner_idx
  on public.club_shortlists (owner_profile_id)
  where owner_profile_id is not null;

comment on column public.club_shortlists.owner_profile_id is
  'DAS-REV-26 §18: owner reale della lista CUSTOM, derivato dal server '
  '(auth.uid()) alla creazione. Null per le POSITION e per le CUSTOM '
  'anteriori alla 26, il cui owner non è determinabile (§29).';

comment on column public.club_shortlists.access_mode is
  'DAS-REV-26 §18: `owner_only` = Solo io (default di ogni nuova CUSTOM); '
  '`scope` = capability ∩ perimetro, la policy effettiva delle liste '
  'anteriori alla 26 e di tutte le POSITION. La condivisione selettiva è '
  'della DAS-REV-27.';

/**
 * Accesso della singola lista, **in aggiunta** a capability ∩ perimetro.
 *
 * §21: «Per CUSTOM vale anche l'accesso alla lista. Essere owner o
 * destinatario di una lista non concede accesso a un Team fuori ambito.»
 * Per questo il predicato non sostituisce `society_position_in_scope`: lo
 * restringe. Un owner che perde lo scope perde anche la sua lista (§18:
 * «Il creator non conserva accesso se perde quello organizzativo
 * necessario», QA069).
 *
 * `security definer` come gli altri predicati del perimetro: è chiamato
 * dalle policy RLS, e non deve dipendere dai grant dell'actor sullo schema
 * `auth` per leggere `auth.uid()`.
 */
create or replace function public.shortlist_list_access_ok(
  p_list_type   text,
  p_access_mode text,
  p_owner       uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_list_type = 'position'
      or coalesce(p_access_mode, 'scope') = 'scope'
      or (p_owner is not null and p_owner = auth.uid());
$$;

revoke all on function public.shortlist_list_access_ok(text, text, uuid) from public;
revoke execute on function public.shortlist_list_access_ok(text, text, uuid) from anon;
grant execute on function public.shortlist_list_access_ok(text, text, uuid) to authenticated;

comment on function public.shortlist_list_access_ok(text, text, uuid) is
  'DAS-REV-26 §18: accesso della singola lista. Restringe capability ∩ '
  'perimetro, non lo sostituisce: una POSITION e una CUSTOM `scope` non '
  'aggiungono vincoli; una `owner_only` è leggibile solo dal suo owner.';

/**
 * Limiti centrali del form CUSTOM (§16).
 *
 * «Se i limiti non sono ancora definiti, centralizzali secondo il
 * modello/storage e documentali; non utilizzare un limite diverso soltanto
 * perché l'ingresso è il profilo.» Lo schema aveva `text` senza vincolo e
 * il form nessun limite. Nascono qui, unici, e il client li legge dalle
 * stesse costanti (`shortlist-profile-presentation.ts`). Come per la nota
 * della 25, non sono CHECK: un nome storico più lungo resta valido finché
 * non viene modificato (§16: «nessun troncamento silenzioso di input o
 * dati storici»).
 */
create or replace function public.shortlist_list_name_max_length()
returns integer
language sql
immutable
as $$ select 80; $$;

create or replace function public.shortlist_list_description_max_length()
returns integer
language sql
immutable
as $$ select 500; $$;

revoke all on function public.shortlist_list_name_max_length() from public;
revoke all on function public.shortlist_list_description_max_length() from public;
grant execute on function public.shortlist_list_name_max_length() to authenticated;
grant execute on function public.shortlist_list_description_max_length() to authenticated;

/**
 * Default Solo io e validazione del nome, su **ogni** creazione CUSTOM.
 *
 * Un trigger e non soltanto il comando: l'insert PostgREST del centro
 * (RET-07, ancora autorizzato dalla policy della 24) e qualunque client
 * precedente passano di qui. §29 — «Tutti gli ingressi di creazione devono
 * usare lo stesso servizio»; §28 — «Proteggi … contraffazione di owner,
 * access mode».
 *
 * Owner e accesso non si modificano da qui in avanti: la 26 non introduce un
 * pannello di condivisione (§3), e un update PostgREST non deve poter
 * trasformare una Solo io in una lista di scope. La 27 lo farà con un
 * comando proprio.
 */
create or replace function public.stamp_club_shortlist_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.list_type = 'custom' then
      new.owner_profile_id := coalesce(auth.uid(), new.created_by_profile_id);
      new.access_mode      := 'owner_only';
    else
      new.owner_profile_id := null;
      new.access_mode      := 'scope';
    end if;
  elsif new.owner_profile_id is distinct from old.owner_profile_id
        or new.access_mode is distinct from old.access_mode then
    /* `on delete set null` dell'owner arriva dal trigger RI interno, con
       profondità > 1: è la cancellazione dell'account, non un cambio di
       accesso, e il CHECK sopra la tratta. */
    if pg_trigger_depth() <= 1 then
      raise exception 'SHORTLIST_ACCESS_IMMUTABLE';
    end if;
  end if;

  if new.list_type = 'custom'
     and (tg_op = 'INSERT'
          or new.name is distinct from old.name
          or new.description is distinct from old.description) then
    /* §16: «rimuovi spazi superflui ai bordi, valida»; le interruzioni di
       riga interne della descrizione restano. */
    new.name        := btrim(coalesce(new.name, ''));
    new.description := nullif(btrim(coalesce(new.description, '')), '');

    if char_length(new.name) = 0 then
      raise exception 'SHORTLIST_LIST_NAME_REQUIRED';
    end if;

    if char_length(new.name) > public.shortlist_list_name_max_length() then
      raise exception 'SHORTLIST_LIST_NAME_TOO_LONG';
    end if;

    if new.description is not null
       and char_length(new.description) > public.shortlist_list_description_max_length() then
      raise exception 'SHORTLIST_LIST_DESCRIPTION_TOO_LONG';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists stamp_club_shortlist_access on public.club_shortlists;
create trigger stamp_club_shortlist_access
  before insert or update on public.club_shortlists
  for each row execute function public.stamp_club_shortlist_access();

comment on function public.stamp_club_shortlist_access() is
  'DAS-REV-26 §18, §29: ogni nuova CUSTOM nasce Solo io con owner = actor '
  'autenticato, da qualunque ingresso. Owner e accesso non sono scrivibili '
  'dal client. Nome e descrizione validati con i limiti centrali.';


-- ============================================================
-- SEZIONE 2 — il perimetro di una lista include il suo accesso (§18)
--
-- `shortlist_in_scope` è la porta usata dalla RLS delle entry e dai comandi
-- della 25 (`update_shortlist_entry`, `remove_shortlist_entry`, e il
-- ricalcolo della stella dopo una rimozione). Estenderla qui chiude in un
-- punto solo letture dirette, note, modifica e rimozione di una Solo io
-- altrui (QA068, QA125).
-- ============================================================

create or replace function public.shortlist_in_scope(
  p_shortlist_id uuid,
  p_key          text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club  uuid;
  v_team  uuid;
  v_type  text;
  v_mode  text;
  v_owner uuid;
begin
  if p_shortlist_id is null then
    return false;
  end if;

  select cs.club_id, cs.list_type, cs.access_mode, cs.owner_profile_id,
         case when cs.list_type = 'position' then ad.team_id else cs.team_id end
    into v_club, v_type, v_mode, v_owner, v_team
  from public.club_shortlists cs
  left join public.recruiting_ads ad on ad.id = cs.position_id
  where cs.id = p_shortlist_id;

  if v_club is null then
    return false;
  end if;

  /* DAS-REV-26 §18: l'accesso della singola lista restringe il perimetro. */
  if not public.shortlist_list_access_ok(v_type, v_mode, v_owner) then
    return false;
  end if;

  return public.society_position_in_scope(v_club, v_team, p_key);
end;
$$;

comment on function public.shortlist_in_scope(uuid, text) is
  'DAS-REV-24 §22 + DAS-REV-26 §18: capability ∩ scope ∩ accesso corrente '
  '∩ accesso della singola lista. Una POSITION eredita il perimetro dalla '
  'sua Position; una CUSTOM Solo io è leggibile soltanto dal suo owner.';

/* RLS del contenitore: stessa restrizione per lettura, modifica e
   cancellazione. L'insert resta la policy della 24 — owner e accesso li
   stampa il trigger della sezione 1, qualunque cosa arrivi dal client. */
drop policy if exists "authorized members read club shortlists" on public.club_shortlists;
create policy "authorized members read club shortlists"
on public.club_shortlists
for select
to authenticated
using (
  public.shortlist_list_access_ok(list_type, access_mode, owner_profile_id)
  and public.society_position_in_scope(
    club_id,
    case
      when list_type = 'position' then (
        select ad.team_id from public.recruiting_ads ad where ad.id = position_id
      )
      else team_id
    end,
    'shortlist_view'
  )
);

drop policy if exists "authorized members update club shortlists" on public.club_shortlists;
create policy "authorized members update club shortlists"
on public.club_shortlists
for update
to authenticated
using (
  list_type = 'custom'
  and public.shortlist_list_access_ok(list_type, access_mode, owner_profile_id)
  and public.society_position_in_scope(club_id, team_id, 'shortlist_create_lists')
)
with check (
  list_type = 'custom'
  and position_id is null
  and public.shortlist_list_access_ok(list_type, access_mode, owner_profile_id)
  and public.society_position_in_scope(club_id, team_id, 'shortlist_create_lists')
);

drop policy if exists "authorized members delete club shortlists" on public.club_shortlists;
create policy "authorized members delete club shortlists"
on public.club_shortlists
for delete
to authenticated
using (
  list_type = 'custom'
  and public.shortlist_list_access_ok(list_type, access_mode, owner_profile_id)
  and public.society_position_in_scope(club_id, team_id, 'shortlist_create_lists')
);


-- ============================================================
-- SEZIONE 3 — predicati condivisi del flusso profilo (§8, §10)
-- ============================================================

/**
 * Tipo professionale canonico del profilo visitato, se candidabile.
 *
 * §10: «Supporta i profili professionali candidabili secondo la tassonomia
 * centrale: almeno Calciatore, Allenatore, Staff e Dirigente … Non
 * introdurre automaticamente la stella per Società, Media/Creator o
 * Tifoso.» La tassonomia centrale è quella di `recruiting_ads.target_role`
 * (CHECK del 20261027090000): gli stessi quattro valori di `app_role`.
 * Il client non lo passa: si legge da `profiles.role` (§10: «Valida il
 * contesto professionale sul server, anche se il client lo passa»).
 */
create or replace function public.shortlist_person_kind(p_person_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role::text
  from public.profiles p
  where p.id = p_person_id
    and p.role::text in ('player', 'coach', 'staff', 'director');
$$;

revoke all on function public.shortlist_person_kind(uuid) from public;
revoke execute on function public.shortlist_person_kind(uuid) from anon;

/**
 * La chiave è concessa all'actor su **almeno** un perimetro della Society.
 *
 * Serve a decidere se lo strumento esiste (stella presente o assente, §9) e
 * se Aggiungi ad altra lista ha senso (§14). Non autorizza nessun comando:
 * ogni comando verifica la chiave sulla destinazione concreta.
 */
create or replace function public.shortlist_key_in_any_scope(
  p_club_id uuid,
  p_key     text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_club_id is not null and (
    public.owns_club(p_club_id)
    or (
      public.club_access_is_active(p_club_id, auth.uid())
      and p_key = any (public.dashboard_club_capabilities(p_club_id))
    )
  );
$$;

revoke all on function public.shortlist_key_in_any_scope(uuid, text) from public;
revoke execute on function public.shortlist_key_in_any_scope(uuid, text) from anon;

/**
 * Etichetta di perimetro di una lista, una sola definizione.
 *
 * POSITION: come `fetch_shortlist_entry` (25) — squadra della Position,
 * snapshot pubblicato se chiusa, Intera società per gli incarichi SOCIETY.
 * CUSTOM: la squadra reale, oppure l'etichetta storica di `scope` per le
 * righe anteriori alla 24 (§26 della 24, QA125).
 */
create or replace function public.shortlist_scope_label(p_shortlist_id uuid, p_position_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when ad.id is not null then
      case
        when ad.position_scope_type = 'society' then 'Intera società'
        when ad.status = 'closed' then coalesce(
          ad.published_team_name,
          (select ct.name from public.club_teams ct where ct.id = ad.team_id)
        )
        else (select ct.name from public.club_teams ct where ct.id = ad.team_id)
      end
    when cs.team_id is not null then
      (select ct.name from public.club_teams ct where ct.id = cs.team_id)
    when cs.scope = 'prima_squadra' then 'Prima squadra'
    when cs.scope = 'juniores'      then 'Juniores'
    when cs.scope = 'under_17'      then 'Under 17'
    when cs.scope = 'under_15'      then 'Under 15'
    else 'Intera società'
  end
  from (select 1) one
  left join public.club_shortlists cs on cs.id = p_shortlist_id
  left join public.recruiting_ads ad
    on ad.id = coalesce(p_position_id, cs.position_id);
$$;

revoke all on function public.shortlist_scope_label(uuid, uuid) from public;
revoke execute on function public.shortlist_scope_label(uuid, uuid) from anon;

/** Titolo derivato della Position (§16 della 24: mai una seconda fonte). */
create or replace function public.shortlist_position_title(p_position_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(btrim(ad.custom_role_name), ''),
    (select pr.label from public.position_roles pr where pr.id = ad.structured_role_id),
    nullif(btrim(ad.title), ''),
    'Posizione'
  )
  from public.recruiting_ads ad
  where ad.id = p_position_id;
$$;

revoke all on function public.shortlist_position_title(uuid) from public;
revoke execute on function public.shortlist_position_title(uuid) from anon;

/**
 * Una Position è una destinazione interna valida per questa persona? (§10)
 *
 *   · stessa Society, tipo professionale compatibile con il profilo — non
 *     un exact match di ruolo (§10: «Un Calciatore può essere valutato per
 *     Centrocampista, Esterno offensivo o Seconda punta»);
 *   · PUBLISHED, DRAFT **persistita con perimetro valido**, CLOSED — la
 *     scadenza da sola non chiude nulla (§10, tabella lifecycle);
 *   · `shortlist_add_profiles` e `shortlist_view` nel perimetro della
 *     Position: §8 — «Una capability add che richiede anche lettura deve
 *     rispettare quella dipendenza».
 *
 * Una Position eliminata non esiste più (cascade), quindi non serve un
 * ramo: è il lifecycle reale a escluderla.
 */
create or replace function public.shortlist_position_destination_ok(
  p_club_id     uuid,
  p_position_id uuid,
  p_person_kind text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.recruiting_ads ad
    where ad.id = p_position_id
      and ad.club_id = p_club_id
      and p_person_kind is not null
      and ad.target_role::text = p_person_kind
      and ad.status in ('published', 'draft', 'closed')
      and not (
        ad.status = 'draft'
        and ad.position_scope_type is distinct from 'society'
        and ad.team_id is null
      )
      and public.society_position_in_scope(ad.club_id, ad.team_id, 'shortlist_add_profiles')
      and public.society_position_in_scope(ad.club_id, ad.team_id, 'shortlist_view')
  );
$$;

revoke all on function public.shortlist_position_destination_ok(uuid, uuid, text) from public;
revoke execute on function public.shortlist_position_destination_ok(uuid, uuid, text) from anon;

/** Una CUSTOM è una destinazione valida per l'actor? (§8, §18) */
create or replace function public.shortlist_custom_destination_ok(
  p_club_id      uuid,
  p_shortlist_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_shortlists cs
    where cs.id = p_shortlist_id
      and cs.club_id = p_club_id
      and cs.list_type = 'custom'
      and public.shortlist_list_access_ok(cs.list_type, cs.access_mode, cs.owner_profile_id)
      and public.society_position_in_scope(cs.club_id, cs.team_id, 'shortlist_add_profiles')
      and public.society_position_in_scope(cs.club_id, cs.team_id, 'shortlist_view')
  );
$$;

revoke all on function public.shortlist_custom_destination_ok(uuid, uuid) from public;
revoke execute on function public.shortlist_custom_destination_ok(uuid, uuid) from anon;

/**
 * Almeno una membership **accessibile** della persona nella Society (§9).
 *
 * Una sola definizione per la stella, per l'esito dei comandi e per la
 * lettura delle membership: tre query diverse finirebbero per dare tre
 * risposte diverse alla stessa domanda.
 */
create or replace function public.shortlist_person_in_any_list(
  p_club_id   uuid,
  p_person_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_shortlist_entries e
    join public.club_shortlists cs on cs.id = e.shortlist_id
    left join public.recruiting_ads ad on ad.id = cs.position_id
    where cs.club_id = p_club_id
      and e.player_profile_id = p_person_id
      and public.shortlist_list_access_ok(cs.list_type, cs.access_mode, cs.owner_profile_id)
      and public.society_position_in_scope(
        cs.club_id,
        case when cs.list_type = 'position' then ad.team_id else cs.team_id end,
        'shortlist_view'
      )
  );
$$;

revoke all on function public.shortlist_person_in_any_list(uuid, uuid) from public;
revoke execute on function public.shortlist_person_in_any_list(uuid, uuid) from anon;


-- ============================================================
-- SEZIONE 4 — stato della stella (§9, §24)
--
-- «Il read model organizzativo deve distinguere almeno caricamento, assenza
-- confermata, presenza confermata, errore e indisponibilità per permesso.
-- Non usare un singolo boolean con false come fallback per ogni
-- condizione.» Il caricamento e l'errore sono del client; qui si
-- distinguono `available` (lo strumento esiste per questo actor e questo
-- profilo) e la presenza, che è significativa **solo** quando available.
--
-- Output minimo (§24): niente note, niente elenco di liste, niente altre
-- Society. Il nome di una lista non arriva al profilo per disegnare
-- un'icona (§9).
-- ============================================================

create or replace function public.fetch_profile_shortlist_state(
  p_club_id   uuid,
  p_person_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_kind      text;
  v_can_view  boolean;
  v_can_add   boolean;
  v_can_create boolean;
  v_in_any    boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_kind := public.shortlist_person_kind(p_person_id);

  v_can_view   := public.shortlist_key_in_any_scope(p_club_id, 'shortlist_view');
  v_can_add    := v_can_view
                  and public.shortlist_key_in_any_scope(p_club_id, 'shortlist_add_profiles');
  v_can_create := v_can_add
                  and public.shortlist_key_in_any_scope(p_club_id, 'shortlist_create_lists');

  /* §9: «Il profilo owner personale e i visitatori senza contesto/capability
     organizzativi non mostrano dati di scouting.» Un profilo non
     candidabile (Società, Media, Tifoso, Procuratore) non ha lo strumento
     (§10, QA015). */
  if v_kind is null or p_person_id = v_uid or not v_can_view then
    return jsonb_build_object(
      'available', false,
      'access_verified_at', timezone('utc', now())
    );
  end if;

  v_in_any := public.shortlist_person_in_any_list(p_club_id, p_person_id);

  return jsonb_build_object(
    'available',   v_in_any or v_can_add,
    'in_any_list', v_in_any,
    'can_add',     v_can_add,
    'can_create',  v_can_create,
    'person_kind', v_kind,
    'access_verified_at', timezone('utc', now())
  );
end;
$$;

revoke all on function public.fetch_profile_shortlist_state(uuid, uuid) from public;
revoke execute on function public.fetch_profile_shortlist_state(uuid, uuid) from anon;
grant execute on function public.fetch_profile_shortlist_state(uuid, uuid) to authenticated;

comment on function public.fetch_profile_shortlist_state(uuid, uuid) is
  'DAS-REV-26 §9, §24: proiezione privata della stella per actor, Society '
  'operativa e persona. `available=false` = nessuna stella; altrimenti '
  '`in_any_list` distingue ☆ da ★. Nessun nome di lista, nessuna nota.';


-- ============================================================
-- SEZIONE 5 — membership della persona (§14, §15, §24)
--
-- «Gruppi delle entry accessibili con ID/generazione, destinazione
-- canonica, campi di valutazione minimi autorizzati e azioni. Caricamento
-- lazy al tap, paginato se necessario. Nessun testo integrale della nota.»
--
-- Priorità e stato viaggiano con `shortlist_view`, come nel pool della 25:
-- è la stessa proiezione, non una più larga. La nota non c'è.
--
-- Il limite di 100 righe è un tetto tecnico, non una pagina: una persona in
-- più di cento liste accessibili della stessa Società non è uno scenario
-- d'uso, e il flag `truncated` lo rende dichiarato invece che silenzioso.
-- ============================================================

create or replace function public.fetch_profile_shortlist_memberships(
  p_club_id   uuid,
  p_person_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_items jsonb;
  v_total integer;
  v_can_add boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.shortlist_key_in_any_scope(p_club_id, 'shortlist_view') then
    raise exception 'SHORTLIST_NOT_AUTHORIZED';
  end if;

  with visible as (
    select
      e.id               as entry_id,
      e.revision,
      e.priority,
      e.evaluation_status,
      cs.id              as shortlist_id,
      cs.list_type,
      cs.position_id,
      cs.last_activity_at,
      ad.status::text    as ad_status,
      coalesce(log.generation, 1) as generation,
      case when cs.list_type = 'position' then ad.team_id else cs.team_id end as team_ref,
      case cs.list_type
        when 'position' then case ad.status::text
          when 'published' then 0 when 'draft' then 1 else 2 end
        else 3
      end as group_rank,
      case cs.list_type
        when 'position' then case ad.status::text
          when 'published' then coalesce(ad.published_at, ad.created_at)
          when 'draft'     then ad.updated_at
          else coalesce(ad.closed_at, ad.updated_at)
        end
        else cs.last_activity_at
      end as sort_at
    from public.club_shortlist_entries e
    join public.club_shortlists cs on cs.id = e.shortlist_id
    left join public.recruiting_ads ad on ad.id = cs.position_id
    left join public.club_shortlist_membership_log log
      on log.shortlist_id = cs.id and log.person_profile_id = e.player_profile_id
    where cs.club_id = p_club_id
      and e.player_profile_id = p_person_id
      and public.shortlist_list_access_ok(cs.list_type, cs.access_mode, cs.owner_profile_id)
      and public.society_position_in_scope(
        cs.club_id,
        case when cs.list_type = 'position' then ad.team_id else cs.team_id end,
        'shortlist_view'
      )
  ),
  ordered as (
    select v.*, row_number() over (
      order by v.group_rank, v.sort_at desc nulls last, v.shortlist_id desc
    ) as rn
    from visible v
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'entry_id',     o.entry_id,
      'shortlist_id', o.shortlist_id,
      'list_type',    o.list_type,
      'position_id',  o.position_id,
      'title', case
        when o.list_type = 'position' then public.shortlist_position_title(o.position_id)
        else (select cs2.name from public.club_shortlists cs2 where cs2.id = o.shortlist_id)
      end,
      'scope_label',  public.shortlist_scope_label(o.shortlist_id, o.position_id),
      'is_draft',     o.ad_status = 'draft',
      'is_closed',    o.ad_status = 'closed',
      'priority',     o.priority,
      'evaluation_status', o.evaluation_status,
      'revision',     o.revision,
      'generation',   o.generation,
      'can_edit_status', public.society_position_in_scope(p_club_id, o.team_ref, 'shortlist_edit_status'),
      'can_edit_note',   public.society_position_in_scope(p_club_id, o.team_ref, 'shortlist_add_notes'),
      'can_remove',      public.society_position_in_scope(p_club_id, o.team_ref, 'shortlist_remove_profiles')
    ) order by o.rn) filter (where o.rn <= 100), '[]'::jsonb),
    count(*)::integer
  into v_items, v_total
  from ordered o;

  v_can_add := public.shortlist_key_in_any_scope(p_club_id, 'shortlist_add_profiles')
               and public.shortlist_person_kind(p_person_id) is not null;

  return jsonb_build_object(
    'items',       v_items,
    'truncated',   v_total > 100,
    'can_add_more', v_can_add,
    'can_create',  v_can_add
                   and public.shortlist_key_in_any_scope(p_club_id, 'shortlist_create_lists'),
    'access_verified_at', timezone('utc', now())
  );
end;
$$;

revoke all on function public.fetch_profile_shortlist_memberships(uuid, uuid) from public;
revoke execute on function public.fetch_profile_shortlist_memberships(uuid, uuid) from anon;
grant execute on function public.fetch_profile_shortlist_memberships(uuid, uuid) to authenticated;

comment on function public.fetch_profile_shortlist_memberships(uuid, uuid) is
  'DAS-REV-26 §14, §24: membership leggibili della persona nella Society '
  'operativa, Position prima (PUBLISHED → DRAFT → CLOSED) e CUSTOM dopo. '
  'Priorità e stato con shortlist_view; mai la nota.';


-- ============================================================
-- SEZIONE 6 — destinazioni del selector (§11, §12, §24)
--
-- Un gruppo per chiamata, con cursore proprio: §11 — «Un gruppo in errore
-- non è un gruppo vuoto», §12 — «pagine distinte dei due gruppi … Il
-- caricamento delle Position non deve rendere irraggiungibili le CUSTOM».
--
-- §12: «Autorizzazione ed esclusione delle membership precedono ordinamento
-- e paginazione.» Le destinazioni già occupate dalla persona sono escluse
-- **nella stessa query** che pagina.
--
-- Ordine Position: PUBLISHED → DRAFT → CLOSED, e dentro ciascun gruppo la
-- recency canonica che §12 indica in mancanza di una regola condivisa —
-- published_at, updated_at, closed_at — decrescente, id come spareggio.
-- CUSTOM: attività reale decrescente, come il centro della 24.
--
-- Un GET non materializza nulla: le Position senza contenitore arrivano per
-- `position_id` (§10, QA022).
-- ============================================================

create or replace function public.fetch_profile_shortlist_destinations(
  p_club_id   uuid,
  p_person_id uuid,
  p_group     text,
  p_limit     integer default 20,
  p_cursor    text    default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_limit  integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_kind   text;
  v_rank   integer;
  v_at     timestamptz;
  v_id     uuid;
  v_items  jsonb;
  v_next   text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_group not in ('position', 'custom') then
    raise exception 'SHORTLIST_FILTER_INVALID';
  end if;

  if not public.shortlist_key_in_any_scope(p_club_id, 'shortlist_add_profiles')
     or not public.shortlist_key_in_any_scope(p_club_id, 'shortlist_view') then
    raise exception 'SHORTLIST_NOT_AUTHORIZED';
  end if;

  v_kind := public.shortlist_person_kind(p_person_id);

  if v_kind is null then
    /* Profilo non candidabile: §10 — nessuna estensione automatica dello
       strumento. Stesso codice di una risorsa non disponibile. */
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  if p_cursor is not null and btrim(p_cursor) <> '' then
    begin
      v_rank := split_part(p_cursor, '|', 1)::integer;
      v_at   := split_part(p_cursor, '|', 2)::timestamptz;
      v_id   := split_part(p_cursor, '|', 3)::uuid;
    exception when others then
      raise exception 'SHORTLIST_CURSOR_INVALID';
    end;
  end if;

  if p_group = 'position' then
    with candidates as (
      select
        ad.id as position_id,
        ad.status::text as ad_status,
        case ad.status::text when 'published' then 0 when 'draft' then 1 else 2 end as rank,
        case ad.status::text
          when 'published' then coalesce(ad.published_at, ad.created_at)
          when 'draft'     then ad.updated_at
          else coalesce(ad.closed_at, ad.updated_at)
        end as sort_at,
        cs.id as shortlist_id
      from public.recruiting_ads ad
      left join public.club_shortlists cs on cs.position_id = ad.id
      where ad.club_id = p_club_id
        and public.shortlist_position_destination_ok(p_club_id, ad.id, v_kind)
        /* §11: «Escludi normalmente le destinazioni già occupate da una
           membership attuale della persona.» */
        and not exists (
          select 1 from public.club_shortlist_entries e
          where e.shortlist_id = cs.id and e.player_profile_id = p_person_id
        )
    ),
    page as (
      select c.*
      from candidates c
      where v_rank is null
         or (c.rank, -extract(epoch from c.sort_at), c.position_id::text)
            > (v_rank, -extract(epoch from v_at), v_id::text)
      /* Spareggio per id **crescente**: è l'unico verso coerente con il
         confronto fra tuple del cursore qui sopra. */
      order by c.rank, c.sort_at desc, c.position_id::text
      limit v_limit + 1
    ),
    numbered as (
      select p.*, row_number() over (order by p.rank, p.sort_at desc, p.position_id::text) as rn
      from page p
    )
    select
      coalesce(jsonb_agg(jsonb_build_object(
        'kind',         'position',
        'position_id',  n.position_id,
        'shortlist_id', n.shortlist_id,
        'title',        public.shortlist_position_title(n.position_id),
        'scope_label',  public.shortlist_scope_label(null, n.position_id),
        'is_draft',     n.ad_status = 'draft',
        'is_closed',    n.ad_status = 'closed'
      ) order by n.rn) filter (where n.rn <= v_limit), '[]'::jsonb),
      max(case when n.rn = v_limit and (select count(*) from numbered) > v_limit
               then n.rank::text || '|' || n.sort_at::text || '|' || n.position_id::text end)
    into v_items, v_next
    from numbered n;
  else
    with candidates as (
      select cs.id as shortlist_id, cs.name, cs.last_activity_at as sort_at
      from public.club_shortlists cs
      where cs.club_id = p_club_id
        and cs.list_type = 'custom'
        and public.shortlist_custom_destination_ok(p_club_id, cs.id)
        and not exists (
          select 1 from public.club_shortlist_entries e
          where e.shortlist_id = cs.id and e.player_profile_id = p_person_id
        )
    ),
    page as (
      select c.*
      from candidates c
      where v_rank is null
         or (-extract(epoch from c.sort_at), c.shortlist_id::text)
            > (-extract(epoch from v_at), v_id::text)
      order by c.sort_at desc, c.shortlist_id::text
      limit v_limit + 1
    ),
    numbered as (
      select p.*, row_number() over (order by p.sort_at desc, p.shortlist_id::text) as rn
      from page p
    )
    select
      coalesce(jsonb_agg(jsonb_build_object(
        'kind',         'custom',
        'position_id',  null,
        'shortlist_id', n.shortlist_id,
        'title',        n.name,
        'scope_label',  public.shortlist_scope_label(n.shortlist_id, null),
        'is_draft',     false,
        'is_closed',    false
      ) order by n.rn) filter (where n.rn <= v_limit), '[]'::jsonb),
      max(case when n.rn = v_limit and (select count(*) from numbered) > v_limit
               then '3|' || n.sort_at::text || '|' || n.shortlist_id::text end)
    into v_items, v_next
    from numbered n;
  end if;

  return jsonb_build_object(
    'items',       v_items,
    'next_cursor', v_next,
    /* §11: «+ Crea nuova lista … soltanto se l'actor può creare una lista in
       almeno un ambito valido e completare l'aggiunta della persona.» */
    'can_create',  p_group = 'custom'
                   and exists (
                     select 1
                     from jsonb_array_elements(
                       public.fetch_shortlist_custom_scope_options(p_club_id, true)
                     )
                   ),
    'access_verified_at', timezone('utc', now())
  );
end;
$$;


-- ============================================================
-- SEZIONE 7 — ambiti di creazione (§17)
--
-- «Il backend restituisce solo ambiti validi sui quali l'actor può creare
-- la lista e aggiungervi il profilo.» `p_with_add` distingue i due ingressi
-- dello stesso form: dal centro basta creare; dal profilo serve anche
-- l'aggiunta della persona iniziale.
--
-- «Non mostrare ambiti non autorizzati disabilitati.» Le squadre archiviate
-- non sono utilizzabili secondo il dominio Squadre (20261021090000).
-- ============================================================

create or replace function public.fetch_shortlist_custom_scope_options(
  p_club_id  uuid,
  p_with_add boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'team_id', o.team_id,
      'label',   o.label
    ) order by o.ord, o.sort_order, o.label), '[]'::jsonb)
    from (
      select null::uuid as team_id, 'Intera società'::text as label,
             0 as ord, 0 as sort_order
      where public.society_position_in_scope(p_club_id, null, 'shortlist_create_lists')
        and (not p_with_add or (
          public.society_position_in_scope(p_club_id, null, 'shortlist_add_profiles')
          and public.society_position_in_scope(p_club_id, null, 'shortlist_view')
        ))
      union all
      select ct.id, ct.name, 1, coalesce(ct.sort_order, 0)
      from public.club_teams ct
      where ct.club_id = p_club_id
        and not coalesce(ct.is_archived, false)
        and public.society_position_in_scope(p_club_id, ct.id, 'shortlist_create_lists')
        and (not p_with_add or (
          public.society_position_in_scope(p_club_id, ct.id, 'shortlist_add_profiles')
          and public.society_position_in_scope(p_club_id, ct.id, 'shortlist_view')
        ))
    ) o
  );
end;
$$;

revoke all on function public.fetch_shortlist_custom_scope_options(uuid, boolean) from public;
revoke execute on function public.fetch_shortlist_custom_scope_options(uuid, boolean) from anon;
grant execute on function public.fetch_shortlist_custom_scope_options(uuid, boolean) to authenticated;

comment on function public.fetch_shortlist_custom_scope_options(uuid, boolean) is
  'DAS-REV-26 §17: ambiti sui quali l''actor può creare una CUSTOM (e, con '
  'p_with_add, aggiungervi la persona iniziale). Intera società solo con '
  'scope Society-wide; nessun ambito non autorizzato restituito.';

revoke all on function public.fetch_profile_shortlist_destinations(uuid, uuid, text, integer, text) from public;
revoke execute on function public.fetch_profile_shortlist_destinations(uuid, uuid, text, integer, text) from anon;
grant execute on function public.fetch_profile_shortlist_destinations(uuid, uuid, text, integer, text) to authenticated;

comment on function public.fetch_profile_shortlist_destinations(uuid, uuid, text, integer, text) is
  'DAS-REV-26 §11, §12: destinazioni del selector per un gruppo (position '
  'o custom), autorizzate, compatibili con il tipo professionale, senza le '
  'liste già occupate dalla persona, paginate per cursore. Nessuna scrittura.';


-- ============================================================
-- SEZIONE 8 — inserimento della entry dal profilo (§13)
--
-- Interna e senza grant: la usano i due comandi della sezione 9 e 10, così
-- che «stessa unique key e stesso comando di membership» (§24) sia vero per
-- costruzione e non per disciplina.
--
-- §13.6-7: «crea la entry solo se manca una membership attuale; applica i
-- default soltanto alla nuova entry.» L'`on conflict do nothing` sull'unique
-- (shortlist_id, player_profile_id) è anche la risposta a QA037/QA038: due
-- add concorrenti producono una riga, e il secondo legge quella del primo
-- senza toccarne origine, valori, autore o data (QA041, QA101).
-- ============================================================

create or replace function public.shortlist_profile_insert_entry(
  p_shortlist_id uuid,
  p_person_id    uuid
)
returns table (entry_ref uuid, already boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.club_shortlist_entries%rowtype;
begin
  insert into public.club_shortlist_entries
    (shortlist_id, player_profile_id, priority, evaluation_status,
     internal_note, added_by_profile_id, application_id, created_source)
  values
    (p_shortlist_id, p_person_id, null, 'da_valutare',
     null, auth.uid(), null, 'profile')
  on conflict (shortlist_id, player_profile_id) do nothing
  returning club_shortlist_entries.* into v_row;

  if v_row.id is not null then
    entry_ref := v_row.id;
    already   := false;
    return next;
    return;
  end if;

  select * into v_row
  from public.club_shortlist_entries e0
  where e0.shortlist_id = p_shortlist_id
    and e0.player_profile_id = p_person_id;

  entry_ref := v_row.id;
  already   := true;
  return next;
end;
$$;

revoke all on function public.shortlist_profile_insert_entry(uuid, uuid) from public;
revoke execute on function public.shortlist_profile_insert_entry(uuid, uuid) from anon;


-- ============================================================
-- SEZIONE 9 — aggiunta dal profilo (§13, §25)
--
-- Esattamente una destinazione: `p_position_id` (anche senza contenitore,
-- §13 — «POSITION usa position_id anche senza shortlist_id materializzato»)
-- oppure `p_shortlist_id` di una CUSTOM. Nessun tipo, Society, scope,
-- added_by, data, valutazione o Application dal client: si derivano.
--
-- Ricevuta: la stessa coppia `application_operation_replay/record` dei
-- comandi 24/25, con la **generazione** della membership dentro. Un retry
-- tardivo di un add dopo una rimozione trova la generazione chiusa e non
-- ripristina nulla (§21, §25, QA098): restituisce `removed_since`.
-- ============================================================

create or replace function public.add_profile_to_shortlist(
  p_club_id         uuid,
  p_person_id       uuid,
  p_position_id     uuid default null,
  p_shortlist_id    uuid default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_kind        text;
  v_list        uuid;
  v_type        text;
  v_position    uuid;
  v_fingerprint text;
  v_receipt     jsonb;
  v_log         public.club_shortlist_membership_log%rowtype;
  v_entry       public.club_shortlist_entries%rowtype;
  v_entry_id    uuid;
  v_already     boolean;
  v_result      jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if (p_position_id is null) = (p_shortlist_id is null) then
    /* Una sola destinazione per comando: §11 — «il tap avvia
       immediatamente un solo add». */
    raise exception 'SHORTLIST_VALUE_INVALID';
  end if;

  v_fingerprint := md5(
    'shortlist_profile_add|v1|' || p_club_id::text || '|' || p_person_id::text || '|'
    || coalesce('p:' || p_position_id::text, 'c:' || p_shortlist_id::text)
  );

  v_receipt := public.application_operation_replay(
    p_idempotency_key, p_person_id, 'shortlist_profile_add', v_fingerprint
  );

  if v_receipt is not null then
    /* §25: «Distingui ricevuta storica del comando e proiezione corrente.»
       La ricevuta dice quale generazione aveva creato o trovato; se quella
       generazione è chiusa, la persona è stata rimossa dopo e il retry non
       la riporta indietro. */
    select * into v_log
    from public.club_shortlist_membership_log l
    where l.shortlist_id = (v_receipt ->> 'shortlist_id')::uuid
      and l.person_profile_id = p_person_id;

    select * into v_entry
    from public.club_shortlist_entries e0
    where e0.id = (v_receipt ->> 'entry_id')::uuid;

    return v_receipt || jsonb_build_object(
      'replayed',      true,
      'removed_since', v_entry.id is null
                       or not coalesce(v_log.is_active, false)
                       or v_log.generation is distinct from (v_receipt ->> 'generation')::integer,
      'revision',      v_entry.revision,
      'in_any_list',   public.shortlist_person_in_any_list(p_club_id, p_person_id)
    );
  end if;

  /* §13.2: accesso al profilo e contesto professionale, dal server. */
  v_kind := public.shortlist_person_kind(p_person_id);

  if v_kind is null or p_person_id = v_uid then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  if p_position_id is not null then
    /* §13.3-4: stessa Society, capability, scope, lifecycle, compatibilità.
       Il lock condiviso serializza l'add con una modifica concorrente del
       lifecycle o del perimetro della Position: §27 — «PUBLISHED→CLOSED
       … l'add può proseguire», ma una cancellazione o uno spostamento di
       scope si decidono qui, non sulla schermata. */
    perform 1 from public.recruiting_ads ad where ad.id = p_position_id for share;

    if not public.shortlist_position_destination_ok(p_club_id, p_position_id, v_kind) then
      /* §27: «Questa lista non è più disponibile» — senza rivelare se
         appartiene a un'altra Society o è stata resa riservata. */
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    /* §13.5: contenitore canonico unico, anche sotto concorrenza (24). */
    v_list     := public.get_or_create_position_shortlist(p_position_id);
    v_type     := 'position';
    v_position := p_position_id;
  else
    perform 1 from public.club_shortlists cs0 where cs0.id = p_shortlist_id for share;

    if not public.shortlist_custom_destination_ok(p_club_id, p_shortlist_id) then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    v_list     := p_shortlist_id;
    v_type     := 'custom';
    v_position := null;
  end if;

  select r.entry_ref, r.already into v_entry_id, v_already
  from public.shortlist_profile_insert_entry(v_list, p_person_id) r;

  /* Rilettura dopo l'insert: `link_shortlist_entry_application` (24) può
     aver già collegato una candidatura pertinente nello stesso statement,
     origine PROFILE invariata (§13.8). */
  select * into v_entry from public.club_shortlist_entries e0 where e0.id = v_entry_id;

  select * into v_log
  from public.club_shortlist_membership_log l
  where l.shortlist_id = v_list and l.person_profile_id = p_person_id;

  v_result := jsonb_build_object(
    'entry_id',     v_entry.id,
    'shortlist_id', v_list,
    'position_id',  v_position,
    'list_type',    v_type,
    'person_id',    p_person_id,
    'club_id',      p_club_id,
    'already',      v_already,
    'generation',   coalesce(v_log.generation, 1),
    'created_at',   v_entry.created_at
  );

  perform public.application_operation_record(
    p_idempotency_key, p_person_id, 'shortlist_profile_add', v_fingerprint, v_result
  );

  return v_result || jsonb_build_object(
    'replayed',      false,
    'removed_since', false,
    'revision',      v_entry.revision,
    'in_any_list',   true
  );
end;
$$;

revoke all on function public.add_profile_to_shortlist(uuid, uuid, uuid, uuid, text) from public;
revoke execute on function public.add_profile_to_shortlist(uuid, uuid, uuid, uuid, text) from anon;
grant execute on function public.add_profile_to_shortlist(uuid, uuid, uuid, uuid, text) to authenticated;

comment on function public.add_profile_to_shortlist(uuid, uuid, uuid, uuid, text) is
  'DAS-REV-26 §13: aggiunta dal profilo a una Position (anche senza '
  'candidatura né contenitore) o a una CUSTOM accessibile. Default solo '
  'sulla entry nuova, origine PROFILE, nessuna Application, nessuna '
  'notifica. Idempotente con ricevuta e generazione.';


-- ============================================================
-- SEZIONE 10 — creazione CUSTOM, con persona iniziale facoltativa (§16-§19)
--
-- §19: «Preferisci una transazione per creare CUSTOM e membership
-- iniziale.» Qui lo è: un'unica funzione plpgsql. Lista e membership
-- esistono entrambe o nessuna delle due — il percorso sano non è mai
-- parziale. Lo stato «lista creata, inserimento mancante» del screen 16 non
-- è producibile da questo comando; resta rappresentabile nel client per
-- l'esito incerto (§19) e verificato con una fixture di recupero, come §19
-- consente: «Se il flusso normale è completamente transazionale, verifica
-- comunque il componente screen 16 tramite fixture di recupero».
--
-- È anche il servizio del centro (persona nulla): §29 — un solo servizio di
-- creazione per tutti gli ingressi, con lo stesso default Solo io.
--
-- Ricevuta con risorsa = Società e fingerprint sul contenuto completo:
-- §25 — «La stessa key con payload incompatibile va rifiutata; non deve
-- identificare due creazioni diverse» (QA077). Il replay restituisce la
-- **stessa** lista, non ne cerca una per nome (QA075, QA076).
-- ============================================================

create or replace function public.create_custom_shortlist(
  p_club_id         uuid,
  p_name            text,
  p_description     text    default null,
  p_team_id         uuid    default null,
  p_person_id       uuid    default null,
  p_idempotency_key text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_name        text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_fingerprint text;
  v_receipt     jsonb;
  v_list        public.club_shortlists%rowtype;
  v_entry       public.club_shortlist_entries%rowtype;
  v_entry_id    uuid;
  v_already     boolean;
  v_log         public.club_shortlist_membership_log%rowtype;
  v_result      jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_fingerprint := md5(
    'shortlist_create|v1|' || p_club_id::text || '|'
    || coalesce(p_person_id::text, '-') || '|'
    || coalesce(p_team_id::text, 'society') || '|'
    || v_name || '|' || coalesce(v_description, '')
  );

  v_receipt := public.application_operation_replay(
    p_idempotency_key, p_club_id, 'shortlist_create', v_fingerprint
  );

  if v_receipt is not null then
    /* §19: «Se la lista è stata eliminata o l'accesso revocato durante il
       recupero, non ricrearla automaticamente.» */
    if not exists (
      select 1 from public.club_shortlists cs0
      where cs0.id = (v_receipt ->> 'shortlist_id')::uuid
    ) or not public.shortlist_in_scope((v_receipt ->> 'shortlist_id')::uuid, 'shortlist_view') then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    select * into v_entry
    from public.club_shortlist_entries e0
    where e0.id = (v_receipt ->> 'entry_id')::uuid;

    return v_receipt || jsonb_build_object(
      'replayed',     true,
      'entry_active', v_entry.id is not null
    );
  end if;

  /* §16: nome obbligatorio dopo trim, limiti centrali, nessun troncamento.
     Il trigger della sezione 1 ripete il controllo per l'insert diretto. */
  if char_length(v_name) = 0 then
    raise exception 'SHORTLIST_LIST_NAME_REQUIRED';
  end if;

  if char_length(v_name) > public.shortlist_list_name_max_length() then
    raise exception 'SHORTLIST_LIST_NAME_TOO_LONG';
  end if;

  if v_description is not null
     and char_length(v_description) > public.shortlist_list_description_max_length() then
    raise exception 'SHORTLIST_LIST_DESCRIPTION_TOO_LONG';
  end if;

  /* §17: Team della stessa Society, utilizzabile e nel perimetro reale;
     Intera società solo con scope Society-wide. Nessun fallback a Intera
     società quando lo scope manca (QA063). */
  if p_team_id is not null and not exists (
    select 1 from public.club_teams ct
    where ct.id = p_team_id
      and ct.club_id = p_club_id
      and not coalesce(ct.is_archived, false)
  ) then
    raise exception 'SHORTLIST_SCOPE_INVALID';
  end if;

  if not public.society_position_in_scope(p_club_id, p_team_id, 'shortlist_create_lists') then
    raise exception 'SHORTLIST_SCOPE_INVALID';
  end if;

  if p_person_id is not null then
    /* §16: «Crea e aggiungi è disponibile con form valido e capability di
       creazione e inserimento entrambe attuali.» */
    if public.shortlist_person_kind(p_person_id) is null or p_person_id = v_uid then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    if not public.society_position_in_scope(p_club_id, p_team_id, 'shortlist_add_profiles')
       or not public.society_position_in_scope(p_club_id, p_team_id, 'shortlist_view') then
      raise exception 'SHORTLIST_SCOPE_INVALID';
    end if;
  end if;

  /* Owner e access mode li stampa il trigger: qui non sono nemmeno
     esprimibili (§18: «Nessun owner o access mode arbitrario dal client»). */
  insert into public.club_shortlists
    (club_id, name, description, scope, list_type, team_id, created_by_profile_id)
  values
    (p_club_id, v_name, v_description, 'tutta_la_societa', 'custom', p_team_id, v_uid)
  returning club_shortlists.* into v_list;

  if p_person_id is not null then
    select r.entry_ref, r.already into v_entry_id, v_already
    from public.shortlist_profile_insert_entry(v_list.id, p_person_id) r;

    select * into v_entry from public.club_shortlist_entries e0 where e0.id = v_entry_id;

    select * into v_log
    from public.club_shortlist_membership_log l
    where l.shortlist_id = v_list.id and l.person_profile_id = p_person_id;
  end if;

  v_result := jsonb_build_object(
    'status',       case when p_person_id is null then 'created' else 'completed' end,
    'shortlist_id', v_list.id,
    'club_id',      p_club_id,
    'name',         v_list.name,
    'scope_label',  public.shortlist_scope_label(v_list.id, null),
    'access_mode',  v_list.access_mode,
    'person_id',    p_person_id,
    'entry_id',     v_entry.id,
    'generation',   v_log.generation
  );

  perform public.application_operation_record(
    p_idempotency_key, p_club_id, 'shortlist_create', v_fingerprint, v_result
  );

  return v_result || jsonb_build_object(
    'replayed',     false,
    'entry_active', v_entry.id is not null
  );
end;
$$;

revoke all on function public.create_custom_shortlist(uuid, text, text, uuid, uuid, text) from public;
revoke execute on function public.create_custom_shortlist(uuid, text, text, uuid, uuid, text) from anon;
grant execute on function public.create_custom_shortlist(uuid, text, text, uuid, uuid, text) to authenticated;

comment on function public.create_custom_shortlist(uuid, text, text, uuid, uuid, text) is
  'DAS-REV-26 §16-§19: creazione CUSTOM Solo io, con inserimento iniziale '
  'della persona nella stessa transazione quando p_person_id è dato. '
  'Servizio unico per centro e profilo; idempotente per chiave e contenuto.';


-- ============================================================
-- SEZIONE 11 — lettori riemessi con l'accesso della singola lista (§18)
--
-- «Il requisito deve valere sul server e su tutti i consumatori: centro,
-- selector, stella, count, dettaglio, note, mutation, deep link e cache.»
-- Ognuna delle sette funzioni qui sotto chiamava `society_position_in_scope`
-- direttamente su una CUSTOM, senza passare da `shortlist_in_scope`:
-- centro (gruppo CUSTOM), selector legacy, stella batch di Cerca, lettore
-- legacy della lista, contesto, pool e scheda della entry.
-- ============================================================

/* fetch_shortlist_custom_lists: copiata da 20261104090000 (definizione più recente), unica
   differenza marcata «DAS-REV-26». */
create or replace function public.fetch_shortlist_custom_lists(
  p_club_id uuid,
  p_limit   integer default 20,
  p_cursor  text    default null
)
returns table (
  shortlist_id   uuid,
  name           text,
  scope_label    text,
  profiles_count bigint,
  last_activity_at timestamptz,
  next_cursor    text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_limit    integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_activity timestamptz;
  v_id       uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_cursor is not null and btrim(p_cursor) <> '' then
    v_activity := split_part(p_cursor, '|', 1)::timestamptz;
    v_id       := split_part(p_cursor, '|', 2)::uuid;
  end if;

  return query
  with visible as (
    select
      cs.id,
      cs.name,
      cs.scope,
      cs.team_id,
      ct.name as team_name,
      cs.last_activity_at,
      (
        select count(*)
        from public.club_shortlist_entries e
        where e.shortlist_id = cs.id
      ) as entries
    from public.club_shortlists cs
    left join public.club_teams ct on ct.id = cs.team_id
    where cs.club_id = p_club_id
      and cs.list_type = 'custom'
      and public.society_position_in_scope(cs.club_id, cs.team_id, 'shortlist_view')
      /* DAS-REV-26 §18: una CUSTOM «Solo io» è del suo owner. */
      and public.shortlist_list_access_ok(cs.list_type, cs.access_mode, cs.owner_profile_id)
  ),
  page as (
    select v.*, row_number() over (
      order by v.last_activity_at desc, v.id desc
    ) as rn
    from visible v
    where v_activity is null
       or (v.last_activity_at, v.id) < (v_activity, v_id)
    order by v.last_activity_at desc, v.id desc
    limit v_limit + 1
  )
  select
    p.id,
    p.name,
    /* Una lista nata prima della 24 non ha `team_id`: la sua etichetta resta
       quella storica di `scope` (§26, QA125), e il suo perimetro è
       Society-wide. */
    case
      when p.team_id is not null then p.team_name
      when p.scope = 'prima_squadra'   then 'Prima squadra'
      when p.scope = 'juniores'        then 'Juniores'
      when p.scope = 'under_17'        then 'Under 17'
      when p.scope = 'under_15'        then 'Under 15'
      else 'Intera società'
    end,
    p.entries,
    p.last_activity_at,
    case
      when (select count(*) from page) > v_limit and p.rn = v_limit
        then p.last_activity_at::text || '|' || p.id::text
    end
  from page p
  where p.rn <= v_limit
  order by p.rn;
end;
$$;

/* fetch_club_shortlists: copiata da 20261104090000 (definizione più recente), unica
   differenza marcata «DAS-REV-26». */
create or replace function public.fetch_club_shortlists(
  p_club_id uuid,
  p_limit   int default 50,
  p_offset  int default 0
)
returns table (
  id                     uuid,
  club_id                uuid,
  name                   text,
  description            text,
  scope                  text,
  team_id                uuid,
  scope_label            text,
  entry_count            bigint,
  high_priority_count    bigint,
  created_by_profile_id  uuid,
  created_by_full_name   text,
  created_at             timestamptz,
  updated_at             timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    cs.id,
    cs.club_id,
    cs.name,
    cs.description,
    cs.scope,
    cs.team_id,
    case
      when cs.team_id is not null then ct.name
      when cs.scope = 'prima_squadra' then 'Prima squadra'
      when cs.scope = 'juniores'      then 'Juniores'
      when cs.scope = 'under_17'      then 'Under 17'
      when cs.scope = 'under_15'      then 'Under 15'
      else 'Intera società'
    end,
    count(e.id),
    count(e.id) filter (where e.priority = 'alta'),
    cs.created_by_profile_id,
    creator.full_name,
    cs.created_at,
    cs.updated_at
  from public.club_shortlists cs
  left join public.club_shortlist_entries e on e.shortlist_id = cs.id
  left join public.profiles creator on creator.id = cs.created_by_profile_id
  left join public.club_teams ct on ct.id = cs.team_id
  where cs.club_id = p_club_id
    and cs.list_type = 'custom'
    and public.society_position_in_scope(cs.club_id, cs.team_id, 'shortlist_view')
    /* DAS-REV-26 §18 */
    and public.shortlist_list_access_ok(cs.list_type, cs.access_mode, cs.owner_profile_id)
  group by cs.id, cs.club_id, cs.name, cs.description, cs.scope, cs.team_id,
           ct.name, cs.created_by_profile_id, creator.full_name,
           cs.created_at, cs.updated_at, cs.last_activity_at
  order by cs.last_activity_at desc, cs.id desc
  limit p_limit
  offset p_offset;
end;
$$;

/* fetch_shortlist_membership: copiata da 20261104090000 (definizione più recente), unica
   differenza marcata «DAS-REV-26». */
create or replace function public.fetch_shortlist_membership(
  p_club_id     uuid,
  p_person_ids  uuid[],
  p_position_id uuid default null
)
returns table (
  person_id        uuid,
  in_any_list      boolean,
  in_position_list boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_person_ids is null or array_length(p_person_ids, 1) is null then
    return;
  end if;

  return query
  select
    pid.id,
    exists (
      select 1
      from public.club_shortlist_entries e
      join public.club_shortlists cs on cs.id = e.shortlist_id
      left join public.recruiting_ads ad on ad.id = cs.position_id
      where cs.club_id = p_club_id
        and e.player_profile_id = pid.id
        /* §22: «La stella considera soltanto le appartenenze ammesse»
           (QA094). Il filtro è nella stessa query del conteggio, non un
           passaggio successivo nel client. */
        and public.society_position_in_scope(
          cs.club_id,
          case when cs.list_type = 'position' then ad.team_id else cs.team_id end,
          'shortlist_view'
        )
        /* DAS-REV-26 §9: una membership nella «Solo io» di un altro actor
           non riempie la stella (QA006). */
        and public.shortlist_list_access_ok(cs.list_type, cs.access_mode, cs.owner_profile_id)
    ),
    case
      when p_position_id is null then false
      else exists (
        select 1
        from public.club_shortlist_entries e
        join public.club_shortlists cs on cs.id = e.shortlist_id
        join public.recruiting_ads ad on ad.id = cs.position_id
        where cs.club_id = p_club_id
          and cs.list_type = 'position'
          and cs.position_id = p_position_id
          and e.player_profile_id = pid.id
          and public.society_position_in_scope(cs.club_id, ad.team_id, 'shortlist_view')
      )
    end
  from unnest(p_person_ids) as pid(id);
end;
$$;

/* fetch_shortlist_entries: copiata da 20261104090000 (definizione più recente), unica
   differenza marcata «DAS-REV-26». */
create or replace function public.fetch_shortlist_entries(
  p_shortlist_id uuid,
  p_limit        int default 100,
  p_offset       int default 0
)
returns table (
  id                    uuid,
  shortlist_id          uuid,
  player_profile_id     uuid,
  full_name             text,
  avatar_url            text,
  role                  text,
  primary_position      public.player_position,
  current_team          text,
  birth_year            integer,
  priority              text,
  evaluation_status     text,
  internal_note         text,
  added_by_profile_id   uuid,
  added_by_full_name    text,
  application_id        uuid,
  has_application       boolean,
  created_source        text,
  revision              integer,
  created_at            timestamptz,
  updated_at            timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_list      public.club_shortlists%rowtype;
  v_team      uuid;
  v_ad_team   uuid;
  v_can_apps  boolean;
  v_can_notes boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_list from public.club_shortlists cs0 where cs0.id = p_shortlist_id;

  if not found then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  if v_list.list_type = 'position' then
    select ad.team_id into v_ad_team from public.recruiting_ads ad where ad.id = v_list.position_id;
    v_team := v_ad_team;
  else
    v_team := v_list.team_id;
  end if;

  if not public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_view')
     or not public.shortlist_list_access_ok(v_list.list_type, v_list.access_mode, v_list.owner_profile_id) then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  /* §22: due permessi distinti. Il metadata della candidatura richiede
     `applications_view` nel suo perimetro; la nota richiede
     `shortlist_add_notes` — §14: «Non caricare o mostrare note complete
     nella riga», e chi non può scriverle non le riceve nemmeno. */
  v_can_apps := public.society_position_in_scope(
    v_list.club_id, v_team, 'applications_view'
  );
  v_can_notes := public.society_position_in_scope(
    v_list.club_id, v_team, 'shortlist_add_notes'
  );

  return query
  select
    e.id,
    e.shortlist_id,
    e.player_profile_id,
    p.full_name,
    p.avatar_url,
    p.role::text,
    pp.primary_position,
    cl.name,
    case
      when p.birth_date is not null then extract(year from p.birth_date)::integer
    end,
    e.priority,
    e.evaluation_status,
    case when v_can_notes then e.internal_note end,
    e.added_by_profile_id,
    adder.full_name,
    case when v_can_apps then e.application_id end,
    /* §14: «eventuale informazione discreta sulla candidatura collegata» —
       il fatto, non il link, e solo a chi può vederlo. */
    case when v_can_apps then e.application_id is not null end,
    e.created_source,
    e.revision,
    e.created_at,
    e.updated_at
  from public.club_shortlist_entries e
  join public.profiles p on p.id = e.player_profile_id
  left join public.player_profiles pp on pp.profile_id = e.player_profile_id
  left join lateral (
    select c.name
    from public.club_members cm
    join public.clubs c on c.id = cm.club_id
    where cm.profile_id = e.player_profile_id
      and cm.is_current = true
      and cm.status = 'active'
    limit 1
  ) cl on true
  left join public.profiles adder on adder.id = e.added_by_profile_id
  where e.shortlist_id = p_shortlist_id
  order by e.created_at desc, e.id desc
  limit p_limit
  offset p_offset;
end;
$$;

/* fetch_shortlist_context: copiata da 20261105090000 (definizione più recente), unica
   differenza marcata «DAS-REV-26». */
create or replace function public.fetch_shortlist_context(
  p_shortlist_id uuid default null,
  p_position_id  uuid default null
)
returns table (
  shortlist_id   uuid,
  club_id        uuid,
  list_type      text,
  position_id    uuid,
  title          text,
  scope_label    text,
  profiles_count bigint,
  is_closed      boolean,
  is_draft       boolean,
  can_add_profiles    boolean,
  can_add_notes       boolean,
  can_view_notes      boolean,
  can_edit_status     boolean,
  can_remove_profiles boolean,
  access_verified_at  timestamptz,
  data_revision       bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_list  public.club_shortlists%rowtype;
  v_ad    public.recruiting_ads%rowtype;
  v_team  uuid;
  v_club  uuid;
  v_caps  text[];
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  /* Alias obbligatorio: `position_id` è anche una colonna OUT di questa
     `returns table`, e in plpgsql una referenza non qualificata diventa
     «column reference is ambiguous» a runtime. */
  if p_shortlist_id is not null then
    select * into v_list from public.club_shortlists cs0 where cs0.id = p_shortlist_id;
  elsif p_position_id is not null then
    select * into v_list from public.club_shortlists cs0 where cs0.position_id = p_position_id;
  else
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  if v_list.id is null then
    /* Nessun contenitore: può ancora essere una Position legittima senza
       profili. §9 — «Una route per position_id può leggere il contesto
       autorizzato e una lista vuota senza creare un record.» */
    if p_position_id is null then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    select * into v_ad from public.recruiting_ads where id = p_position_id;

    if not found then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    /* §9: una bozza senza perimetro persistito non è autorizzabile, e
       l'errore è distinto da «non esiste» perché il rimedio è diverso —
       completare il contesto nel flusso Position, non cercare altrove. */
    if v_ad.status = 'draft'
       and v_ad.position_scope_type is distinct from 'society'
       and v_ad.team_id is null then
      raise exception 'SHORTLIST_SCOPE_UNDEFINED';
    end if;

    if not public.society_position_in_scope(v_ad.club_id, v_ad.team_id, 'shortlist_view') then
      raise exception 'SHORTLIST_NOT_FOUND';
    end if;

    v_caps := public.dashboard_club_capabilities(v_ad.club_id);

    shortlist_id   := null;
    club_id        := v_ad.club_id;
    list_type      := 'position';
    position_id    := v_ad.id;
    title          := coalesce(
      nullif(btrim(v_ad.custom_role_name), ''),
      (select pr.label from public.position_roles pr where pr.id = v_ad.structured_role_id),
      nullif(btrim(v_ad.title), ''),
      'Posizione'
    );
    scope_label    := case
      when v_ad.position_scope_type = 'society' then 'Intera società'
      when v_ad.status = 'closed' then coalesce(
        v_ad.published_team_name,
        (select ct.name from public.club_teams ct where ct.id = v_ad.team_id)
      )
      else (select ct.name from public.club_teams ct where ct.id = v_ad.team_id)
    end;
    profiles_count := 0;
    is_closed      := v_ad.status = 'closed';
    is_draft       := v_ad.status = 'draft';
    can_add_profiles    := 'shortlist_add_profiles' = any (v_caps);
    can_add_notes       := 'shortlist_add_notes' = any (v_caps);
    can_view_notes      := 'shortlist_add_notes' = any (v_caps);
    can_edit_status     := 'shortlist_edit_status' = any (v_caps);
    can_remove_profiles := 'shortlist_remove_profiles' = any (v_caps);
    access_verified_at  := timezone('utc', now());
    data_revision       := 0;
    return next;

    return;
  end if;

  v_club := v_list.club_id;

  if v_list.list_type = 'position' then
    select * into v_ad from public.recruiting_ads where id = v_list.position_id;
    v_team := v_ad.team_id;
  else
    v_team := v_list.team_id;
  end if;

  if not public.society_position_in_scope(v_club, v_team, 'shortlist_view')
     or not public.shortlist_list_access_ok(v_list.list_type, v_list.access_mode, v_list.owner_profile_id) then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  v_caps := public.dashboard_club_capabilities(v_club);

  shortlist_id := v_list.id;
  club_id      := v_club;
  list_type    := v_list.list_type;
  position_id  := v_list.position_id;
  title        := case
    when v_list.list_type = 'position' then coalesce(
      nullif(btrim(v_ad.custom_role_name), ''),
      (select pr.label from public.position_roles pr where pr.id = v_ad.structured_role_id),
      nullif(btrim(v_ad.title), ''),
      'Posizione'
    )
    else v_list.name
  end;
  scope_label := case
    when v_list.list_type = 'position' then case
      when v_ad.position_scope_type = 'society' then 'Intera società'
      when v_ad.status = 'closed' then coalesce(
        v_ad.published_team_name,
        (select ct.name from public.club_teams ct where ct.id = v_ad.team_id)
      )
      else (select ct.name from public.club_teams ct where ct.id = v_ad.team_id)
    end
    when v_list.team_id is not null then
      (select ct.name from public.club_teams ct where ct.id = v_list.team_id)
    when v_list.scope = 'prima_squadra' then 'Prima squadra'
    when v_list.scope = 'juniores'      then 'Juniores'
    when v_list.scope = 'under_17'      then 'Under 17'
    when v_list.scope = 'under_15'      then 'Under 15'
    else 'Intera società'
  end;
  profiles_count := (
    select count(*) from public.club_shortlist_entries e where e.shortlist_id = v_list.id
  );
  is_closed := v_list.list_type = 'position' and v_ad.status = 'closed';
  is_draft  := v_list.list_type = 'position' and v_ad.status = 'draft';
  can_add_profiles    := 'shortlist_add_profiles' = any (v_caps);
  can_add_notes       := 'shortlist_add_notes' = any (v_caps);
  can_view_notes      := 'shortlist_add_notes' = any (v_caps);
  can_edit_status     := 'shortlist_edit_status' = any (v_caps);
  can_remove_profiles := 'shortlist_remove_profiles' = any (v_caps);
  access_verified_at  := timezone('utc', now());
  data_revision := (extract(epoch from v_list.last_activity_at) * 1000)::bigint;
  return next;
end;
$$;

/* fetch_shortlist_pool_page: copiata da 20261105090000 (definizione più recente), unica
   differenza marcata «DAS-REV-26». */
create or replace function public.fetch_shortlist_pool_page(
  p_shortlist_id uuid,
  p_priorities   text[] default null,
  p_statuses     text[] default null,
  p_cursor       text   default null,
  p_limit        integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_list       public.club_shortlists%rowtype;
  v_team       uuid;
  v_limit      integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_priorities text[];
  v_statuses   text[];
  v_fingerprint text;
  v_cursor_at  timestamptz;
  v_cursor_id  uuid;
  v_total      bigint;
  v_filtered   bigint;
  v_can_notes  boolean;
  v_can_apps   boolean;
  v_can_edit   boolean;
  v_can_remove boolean;
  v_items      jsonb;
  v_next       text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_list from public.club_shortlists cs0 where cs0.id = p_shortlist_id;

  if not found then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  v_team := public.shortlist_scope_team(v_list.id);

  if not public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_view')
     or not public.shortlist_list_access_ok(v_list.list_type, v_list.access_mode, v_list.owner_profile_id) then
    raise exception 'SHORTLIST_NOT_FOUND';
  end if;

  /* §8: «Un filtro non può diventare un modo per dedurre un campo che
     l'actor non può leggere … il backend rifiuta filtri su campi non
     autorizzati anche se il client nasconde il controllo.» Priorità e stato
     appartengono alla capacità «Visualizzare la shortlist nel relativo
     scope» del catalogo §8, già verificata sopra: chi è arrivato qui li
     legge, e quindi li può filtrare. La nota non è una dimensione di
     filtro, e infatti non compare fra i parametri. */
  v_priorities := public.shortlist_filter_normalize(
    p_priorities, array['alta', 'media', 'bassa', 'none']
  );
  v_statuses := public.shortlist_filter_normalize(
    p_statuses,
    array['da_valutare', 'interessante', 'da_contattare', 'contattato',
          'non_prioritario', 'scartato']
  );

  v_fingerprint := md5(
    coalesce(array_to_string(v_priorities, ','), '*') || '#' ||
    coalesce(array_to_string(v_statuses, ','), '*')
  );

  if p_cursor is not null and btrim(p_cursor) <> '' then
    /* §14: il cursore è validato contro lista e filtri. Un cursore di
       un'altra query non «degrada»: viene rifiutato, così il client ne
       chiede uno nuovo coerente invece di mescolare pagine incompatibili. */
    if split_part(p_cursor, '|', 1) is distinct from p_shortlist_id::text
       or split_part(p_cursor, '|', 2) is distinct from v_fingerprint then
      raise exception 'SHORTLIST_CURSOR_INVALID';
    end if;

    v_cursor_at := split_part(p_cursor, '|', 3)::timestamptz;
    v_cursor_id := split_part(p_cursor, '|', 4)::uuid;
  end if;

  v_can_notes  := public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_add_notes');
  v_can_apps   := public.society_position_in_scope(v_list.club_id, v_team, 'applications_view');
  v_can_edit   := public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_edit_status');
  v_can_remove := public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_remove_profiles');

  /* §14: «Il backend applica: autorizzazione e visibilità → filtri →
     ordinamento stabile → pagina. Restituisce il numero totale accessibile
     della lista e, con filtri, il totale delle corrispondenze.» I due
     conteggi usano lo stesso perimetro delle righe, non una query a parte
     con condizioni proprie. */
  select
    count(*),
    count(*) filter (
      where (v_priorities is null
             or coalesce(e.priority, 'none') = any (v_priorities))
        and (v_statuses is null
             or e.evaluation_status = any (v_statuses))
    )
  into v_total, v_filtered
  from public.club_shortlist_entries e
  where e.shortlist_id = p_shortlist_id;

  with page as (
    select e.*
    from public.club_shortlist_entries e
    where e.shortlist_id = p_shortlist_id
      and (v_priorities is null
           or coalesce(e.priority, 'none') = any (v_priorities))
      and (v_statuses is null
           or e.evaluation_status = any (v_statuses))
      and (
        v_cursor_at is null
        or e.created_at < v_cursor_at
        or (e.created_at = v_cursor_at and e.id < v_cursor_id)
      )
    order by e.created_at desc, e.id desc
    limit v_limit + 1
  ),
  trimmed as (
    select p.*, row_number() over (order by p.created_at desc, p.id desc) as rn
    from page p
  ),
  rows as (
    select
      t.rn,
      jsonb_build_object(
        'entry_id',  t.id,
        'person_id', t.player_profile_id,
        'name',      prof.full_name,
        'avatar_url', prof.avatar_url,
        'role',      prof.role::text,
        'primary_position', pp.primary_position::text,
        /* §12: «contesto corrente essenziale». Deriva dalla funzione
           canonica del pack Candidature, che distingue «Svincolato»
           dichiarato da «non determinabile» e restituisce null nel secondo
           caso — §12 vieta di sostituire un dato assente con un valore
           demo, e questa è la stessa regola già applicata alle righe
           candidatura. */
        'situation', public.profile_current_situation(t.player_profile_id),
        'priority',  t.priority,
        'evaluation_status', t.evaluation_status,
        'revision',  t.revision,
        /* §12: «eventuale anteprima della nota in una sola riga» e «Non
           scaricare note complete in un endpoint che serve solo una lista
           con preview». Il troncamento è server-side: la riga non riceve
           mai il testo integrale. */
        'note_preview', case
          when v_can_notes and nullif(btrim(t.internal_note), '') is not null
            then left(regexp_replace(btrim(t.internal_note), '\s+', ' ', 'g'), 120)
        end,
        /* §16: l'origine è audit storico; «se la dicitura storica Da
           candidatura rivelerebbe una relazione Application non
           autorizzata, ometti quella dicitura dalla proiezione di quell
           actor». `profile` non rivela nulla e resta. */
        'created_source', case
          when t.created_source = 'application' and not v_can_apps then 'unknown'
          else t.created_source
        end,
        /* §16: la relazione **corrente**, distinta dall'origine. `null`
           significa «non autorizzato a saperlo» e §16 vieta di tradurlo in
           «non si è candidato». */
        'application_state', case
          when not v_can_apps then null
          when t.application_id is null then 'none'
          when app.status = 'withdrawn' then 'withdrawn'
          else 'active'
        end
      ) as item
    from trimmed t
    join public.profiles prof on prof.id = t.player_profile_id
    left join public.player_profiles pp on pp.profile_id = t.player_profile_id
    left join public.recruiting_applications app on app.id = t.application_id
    where t.rn <= v_limit
  )
  select
    coalesce(jsonb_agg(r.item order by r.rn), '[]'::jsonb),
    (
      select p_shortlist_id::text || '|' || v_fingerprint || '|'
             || t2.created_at::text || '|' || t2.id::text
      from trimmed t2
      where t2.rn = v_limit
        and (select count(*) from trimmed) > v_limit
    )
  into v_items, v_next
  from rows r;

  return jsonb_build_object(
    'shortlist_id', p_shortlist_id,
    'total',        v_total,
    'filtered',     v_filtered,
    'filters_applied', (v_priorities is not null or v_statuses is not null),
    'priorities',   to_jsonb(v_priorities),
    'statuses',     to_jsonb(v_statuses),
    'next_cursor',  v_next,
    'can_view_notes',   v_can_notes,
    'can_view_applications', v_can_apps,
    'can_edit_status',  v_can_edit,
    'can_remove',       v_can_remove,
    'access_verified_at', timezone('utc', now()),
    'items',        coalesce(v_items, '[]'::jsonb)
  );
end;
$$;

/* fetch_shortlist_entry: copiata da 20261105090000 (definizione più recente), unica
   differenza marcata «DAS-REV-26». */
create or replace function public.fetch_shortlist_entry(
  p_entry_id       uuid default null,
  p_application_id uuid default null,
  p_with_note      boolean default true
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_entry      public.club_shortlist_entries%rowtype;
  v_list       public.club_shortlists%rowtype;
  v_ad         public.recruiting_ads%rowtype;
  v_app        public.recruiting_applications%rowtype;
  v_team       uuid;
  v_can_notes  boolean;
  v_can_apps   boolean;
  v_can_edit   boolean;
  v_can_remove boolean;
  v_person     public.profiles%rowtype;
  v_adder      text;
  v_position   text;
  v_scope      text;
  v_current    text;
  v_role_pos   text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_entry_id is not null then
    select * into v_entry from public.club_shortlist_entries e0 where e0.id = p_entry_id;
  elsif p_application_id is not null then
    /* La catena parte dalla candidatura: Position della candidatura →
       contenitore POSITION di quella Position → membership della persona
       che si è candidata. Nessun riferimento arriva dal client. */
    select e0.* into v_entry
    from public.recruiting_applications a0
    join public.club_shortlists cs0
      on cs0.position_id = a0.ad_id and cs0.list_type = 'position'
    join public.club_shortlist_entries e0
      on e0.shortlist_id = cs0.id and e0.player_profile_id = a0.applicant_profile_id
    where a0.id = p_application_id;
  else
    raise exception 'SHORTLIST_ENTRY_NOT_FOUND';
  end if;

  if v_entry.id is null then
    raise exception 'SHORTLIST_ENTRY_NOT_FOUND';
  end if;

  select * into v_list from public.club_shortlists cs0 where cs0.id = v_entry.shortlist_id;

  if not found then
    raise exception 'SHORTLIST_ENTRY_NOT_FOUND';
  end if;

  v_team := public.shortlist_scope_team(v_list.id);

  if not public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_view')
     or not public.shortlist_list_access_ok(v_list.list_type, v_list.access_mode, v_list.owner_profile_id) then
    /* §28: «Contenuto non disponibile … senza rivelare risorse altrui.»
       Negata e inesistente producono lo stesso errore. */
    raise exception 'SHORTLIST_ENTRY_NOT_FOUND';
  end if;

  v_can_notes  := public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_add_notes');
  v_can_apps   := public.society_position_in_scope(v_list.club_id, v_team, 'applications_view');
  v_can_edit   := public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_edit_status');
  v_can_remove := public.society_position_in_scope(v_list.club_id, v_team, 'shortlist_remove_profiles');

  if v_list.list_type = 'position' then
    select * into v_ad from public.recruiting_ads where id = v_list.position_id;

    v_position := coalesce(
      nullif(btrim(v_ad.custom_role_name), ''),
      (select pr.label from public.position_roles pr where pr.id = v_ad.structured_role_id),
      nullif(btrim(v_ad.title), ''),
      'Posizione'
    );
    v_scope := case
      when v_ad.position_scope_type = 'society' then 'Intera società'
      when v_ad.status = 'closed' then coalesce(
        v_ad.published_team_name,
        (select ct.name from public.club_teams ct where ct.id = v_ad.team_id)
      )
      else (select ct.name from public.club_teams ct where ct.id = v_ad.team_id)
    end;
  else
    v_position := v_list.name;
    v_scope := case
      when v_list.team_id is not null then
        (select ct.name from public.club_teams ct where ct.id = v_list.team_id)
      else 'Intera società'
    end;
  end if;

  select * into v_person from public.profiles where id = v_entry.player_profile_id;

  select pp.primary_position::text into v_role_pos
  from public.player_profiles pp where pp.profile_id = v_entry.player_profile_id;

  v_current := public.profile_current_situation(v_entry.player_profile_id);

  select pr2.full_name into v_adder
  from public.profiles pr2 where pr2.id = v_entry.added_by_profile_id;

  if v_entry.application_id is not null then
    select * into v_app from public.recruiting_applications where id = v_entry.application_id;
  end if;

  return jsonb_build_object(
    'entry_id',     v_entry.id,
    'shortlist_id', v_list.id,
    'club_id',      v_list.club_id,
    'position_id',  v_list.position_id,
    'person_id',    v_entry.player_profile_id,
    'name',         coalesce(v_person.full_name, 'Profilo'),
    'avatar_url',   v_person.avatar_url,
    'role',         v_person.role::text,
    'primary_position', v_role_pos,
    'situation',    v_current,
    'position_title', v_position,
    'scope_label',  v_scope,
    'is_closed',    v_list.list_type = 'position' and v_ad.status = 'closed',
    'is_draft',     v_list.list_type = 'position' and v_ad.status = 'draft',
    'priority',     v_entry.priority,
    'evaluation_status', v_entry.evaluation_status,
    'revision',     v_entry.revision,
    /* §15: il testo integrale **solo** a chi lo può leggere, e solo quando
       la superficie lo richiede (§11 per lo sheet). `note_available` dice
       al client se l'assenza è un permesso o una nota vuota: §12 vieta di
       usare «Nessuna nota aggiunta.» per una nota nascosta dai permessi. */
    'note',           case when v_can_notes and p_with_note then v_entry.internal_note end,
    'note_available', v_can_notes,
    'created_source', case
      when v_entry.created_source = 'application' and not v_can_apps then 'unknown'
      else v_entry.created_source
    end,
    'added_by_name', v_adder,
    'created_at',    v_entry.created_at,
    'application_id', case when v_can_apps then v_entry.application_id end,
    'application_state', case
      when not v_can_apps then null
      when v_entry.application_id is null then 'none'
      when v_app.status = 'withdrawn' then 'withdrawn'
      else 'active'
    end,
    'can_edit_status', v_can_edit,
    'can_edit_note',   v_can_notes,
    'can_view_notes',  v_can_notes,
    'can_remove',      v_can_remove,
    'can_view_applications', v_can_apps,
    'access_verified_at', timezone('utc', now())
  );
end;
$$;
