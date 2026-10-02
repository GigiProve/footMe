-- Migration: REV-PROF-14 — Gestione assistiti Procuratore.
--
-- Estende il modello canonico esistente (`agent_representations`, 20260615120100
-- e 20260626120000) invece di crearne uno parallelo, e aggiunge le due cose che
-- mancavano per chiudere il flusso:
--
--   1. `agent_manual_assistiti` — il record di un calciatore NON registrato.
--      Non e' un account, non e' un profilo, non e' ricercabile: e' un
--      promemoria privato del procuratore, forzato a visibility 'private' da un
--      check di colonna, non da una regola applicativa.
--   2. `agent_assistito_invites` — l'invito tokenizzato che trasforma quel
--      record in una relazione vera quando il calciatore si registra. Il token
--      in chiaro esiste solo nella risposta della RPC che lo genera: in tabella
--      vive il solo sha256, quindi un dump del database non permette di aprire
--      nessun invito.
--
-- Stati: il task chiede pending/accepted/rejected/cancelled/revoked/ended. La
-- convenzione esistente li copre gia' tutti — 'revoked' e' l'annullamento della
-- richiesta da parte del procuratore, 'terminated' la conclusione del rapporto —
-- quindi qui non nasce nessuno stato equivalente duplicato.
--
-- Mirror delle convenzioni di:
--   20260626120000_representation_relationship_types.sql (RPC security definer,
--                  revoke/grant, notifiche inline, fetch_* arricchite)
--   20260718090400_user_blocks.sql (scritture solo via RPC, select RLS stretta)
--   20260323000001_club_invite_links.sql (token via gen_random_bytes) — da cui
--                  ci si discosta volutamente: li' il token e' in chiaro e
--                  leggibile da qualunque autenticato, qui no.


-- ============================================================
-- SECTION 1: la relazione canonica impara le date del rapporto
-- ============================================================
-- Il mockup chiede "Dal" in inserimento e "Concludi rapporto" con data finale.
-- `terminated_at` esiste gia' ma e' il momento tecnico dell'operazione, non la
-- data dichiarata dal procuratore: sono due informazioni diverse e la seconda
-- mancava.

alter table public.agent_representations
  add column if not exists started_on date;

alter table public.agent_representations
  add column if not exists ended_on date;

-- Provenienza della relazione: distinguere una richiesta nata dalla ricerca da
-- una nata dalla riconciliazione di un invito serve agli analytics e al
-- supporto, e non e' deducibile a posteriori.
alter table public.agent_representations
  add column if not exists origin text not null default 'search';

alter table public.agent_representations
  drop constraint if exists agent_representations_origin_check;

alter table public.agent_representations
  add constraint agent_representations_origin_check
  check (origin in ('search', 'invite', 'onboarding'));


-- ============================================================
-- SECTION 2: tabella dei record manuali
-- ============================================================

create table if not exists public.agent_manual_assistiti (
  id                 uuid        primary key default gen_random_uuid(),
  agent_profile_id   uuid        not null references public.profiles(id) on delete cascade,

  full_name          text        not null,
  -- Nome normalizzato per il controllo duplicati: minuscolo, senza spazi
  -- ripetuti. Generato dal database perche' un confronto fatto dal client
  -- sarebbe aggirabile e divergerebbe fra piattaforme.
  normalized_name    text        generated always as (
                                   lower(regexp_replace(trim(full_name), '\s+', ' ', 'g'))
                                 ) stored,

  primary_position   public.player_position,
  team_label         text,

  relationship_type  text        not null default 'procuratore',
  started_on         date,

  -- Forzata, non suggerita: un record manuale pubblico non deve poter esistere
  -- nemmeno per un bug applicativo.
  visibility         text        not null default 'private'
                                 check (visibility = 'private'),

  status             text        not null default 'active'
                                 check (status in ('active', 'linked', 'archived')),

  -- Riconciliazione: compilati solo quando il calciatore si registra e accetta.
  linked_profile_id  uuid        references public.profiles(id) on delete set null,
  representation_id  uuid        references public.agent_representations(id) on delete set null,
  reconciled_at      timestamptz,

  -- Suggerimento ereditato dal vecchio portfolio di onboarding: un profilo
  -- PROLINK che il procuratore aveva associato senza passare da una richiesta.
  -- Non e' un collegamento: serve solo a proporre la richiesta giusta.
  suggested_profile_id uuid      references public.profiles(id) on delete set null,

  created_at         timestamptz not null default timezone('utc', now()),
  updated_at         timestamptz not null default timezone('utc', now()),

  constraint agent_manual_assistiti_relationship_type_check
    check (relationship_type in ('procuratore', 'intermediario', 'referente_sportivo')),
  constraint agent_manual_assistiti_name_not_blank
    check (length(trim(full_name)) > 0),
  constraint agent_manual_assistiti_linked_consistency
    check (
      (status = 'linked' and linked_profile_id is not null)
      or (status <> 'linked' and reconciled_at is null)
    )
);

create index if not exists agent_manual_assistiti_agent_idx
  on public.agent_manual_assistiti (agent_profile_id, status, created_at desc);

create index if not exists agent_manual_assistiti_dedupe_idx
  on public.agent_manual_assistiti (agent_profile_id, normalized_name);

create index if not exists agent_manual_assistiti_linked_idx
  on public.agent_manual_assistiti (linked_profile_id);

alter table public.agent_manual_assistiti enable row level security;

-- Solo il procuratore proprietario vede i propri record. Nessuna policy di
-- scrittura: tutto passa dalle RPC security definer piu' sotto.
drop policy if exists "agent manual assistiti select own" on public.agent_manual_assistiti;
create policy "agent manual assistiti select own"
  on public.agent_manual_assistiti
  for select
  to authenticated
  using (public.is_current_user(agent_profile_id));


-- ============================================================
-- SECTION 3: tabella degli inviti
-- ============================================================

create table if not exists public.agent_assistito_invites (
  id                    uuid        primary key default gen_random_uuid(),
  agent_profile_id      uuid        not null references public.profiles(id) on delete cascade,
  manual_assistito_id   uuid        not null references public.agent_manual_assistiti(id) on delete cascade,

  -- sha256 esadecimale del token. Il token in chiaro non viene mai scritto.
  token_hash            text        not null unique,

  status                text        not null default 'created'
                                    check (status in (
                                      'created',    -- link generato, mai condiviso
                                      'shared',     -- share sheet / canale aperto dall'utente
                                      'opened',     -- qualcuno ha risolto il token
                                      'registered', -- il destinatario ha un account
                                      'accepted',   -- rapporto creato
                                      'expired',
                                      'revoked'
                                    )),

  -- Canale dell'ultima condivisione, quando noto. Il destinatario scelto nella
  -- share sheet non arriva mai qui: il sistema operativo non lo comunica e il
  -- prodotto non deve conservarlo.
  channel               text        check (channel in ('whatsapp', 'sms', 'copy_link', 'other')),

  created_at            timestamptz not null default timezone('utc', now()),
  shared_at             timestamptz,
  opened_at             timestamptz,
  expires_at            timestamptz not null default (timezone('utc', now()) + interval '30 days'),
  revoked_at            timestamptz,

  registered_profile_id uuid        references public.profiles(id) on delete set null,
  reconciled_at         timestamptz,
  updated_at            timestamptz not null default timezone('utc', now())
);

create index if not exists agent_assistito_invites_agent_idx
  on public.agent_assistito_invites (agent_profile_id, status, created_at desc);

create index if not exists agent_assistito_invites_manual_idx
  on public.agent_assistito_invites (manual_assistito_id, status);

alter table public.agent_assistito_invites enable row level security;

-- Il procuratore vede i propri inviti; il token_hash non e' utile a nessuno ma
-- non e' nemmeno un segreto (e' un hash), quindi non serve una colonna esclusa.
-- Il destinatario non legge mai questa tabella: passa dalla RPC di risoluzione.
drop policy if exists "agent assistito invites select own" on public.agent_assistito_invites;
create policy "agent assistito invites select own"
  on public.agent_assistito_invites
  for select
  to authenticated
  using (public.is_current_user(agent_profile_id));


-- ============================================================
-- SECTION 4: rate limiting
-- ============================================================
-- Il progetto non aveva alcuna forma di throttling. Invece di una tabella per
-- ogni azione, una sola tabella di eventi con (profilo, azione, chiave) e un
-- helper che solleva quando la finestra e' piena. `target_key` permette limiti
-- per destinatario ("quante richieste allo stesso calciatore") senza cambiare
-- struttura.

create table if not exists public.agent_action_rate_events (
  id          uuid        primary key default gen_random_uuid(),
  profile_id  uuid        not null references public.profiles(id) on delete cascade,
  action      text        not null,
  target_key  text,
  created_at  timestamptz not null default timezone('utc', now())
);

create index if not exists agent_action_rate_events_lookup_idx
  on public.agent_action_rate_events (profile_id, action, created_at desc);

alter table public.agent_action_rate_events enable row level security;
-- Nessuna policy: la tabella e' scritta e letta solo da funzioni security definer.

create or replace function public.assert_agent_rate_limit(
  p_action     text,
  p_target_key text,
  p_max        integer,
  p_window     interval
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := auth.uid();
  v_count   integer;
begin
  if v_profile is null then
    raise exception 'Authentication required';
  end if;

  select count(*)
  into v_count
  from public.agent_action_rate_events e
  where e.profile_id = v_profile
    and e.action     = p_action
    and (p_target_key is null or e.target_key = p_target_key)
    and e.created_at > timezone('utc', now()) - p_window;

  if v_count >= p_max then
    -- Messaggio unico e volutamente generico: il client lo mostra cosi' com'e'
    -- e non deve poter dedurre soglia o finestra.
    raise exception 'RATE_LIMIT';
  end if;

  insert into public.agent_action_rate_events (profile_id, action, target_key)
  values (v_profile, p_action, p_target_key);

  -- Potatura opportunistica: senza, la tabella cresce per sempre.
  delete from public.agent_action_rate_events
  where profile_id = v_profile
    and created_at < timezone('utc', now()) - interval '7 days';
end;
$$;

revoke all on function public.assert_agent_rate_limit(text, text, integer, interval) from public;


-- ============================================================
-- SECTION 5: richiesta di collegamento — blocchi, data, provenienza
-- ============================================================
-- Ricreata (non `create or replace`: cambia la firma) per aggiungere
-- `p_started_on`, il rispetto di user_blocks e il rate limiting. I chiamatori
-- esistenti passano parametri nominati e continuano a funzionare.

drop function if exists public.request_agent_representation(uuid);
drop function if exists public.request_agent_representation(uuid, text, text, text);

create or replace function public.request_agent_representation(
  p_player_profile_id uuid,
  p_relationship_type text default 'procuratore',
  p_visibility        text default 'public',
  p_message           text default null,
  p_started_on        date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent      uuid := auth.uid();
  v_rep        public.agent_representations%rowtype;
  v_has_rep    boolean;
  v_result_id  uuid;
  v_agent_name text;
  v_label      text;
begin
  if v_agent is null then
    raise exception 'Authentication required';
  end if;

  if p_player_profile_id is null then
    raise exception 'Profilo giocatore richiesto';
  end if;

  if v_agent = p_player_profile_id then
    raise exception 'Non puoi richiedere di rappresentare te stesso';
  end if;

  if p_relationship_type not in ('procuratore', 'intermediario', 'referente_sportivo') then
    raise exception 'Tipo di relazione non valido';
  end if;

  if p_visibility not in ('public', 'private') then
    raise exception 'Visibilita'' non valida';
  end if;

  if p_started_on is not null and p_started_on > (timezone('utc', now()))::date then
    raise exception 'La data iniziale non e'' valida';
  end if;

  if not exists (
    select 1 from public.profiles where id = p_player_profile_id
  ) then
    raise exception 'Profilo giocatore non trovato';
  end if;

  -- Un blocco in una delle due direzioni rende il collegamento impossibile.
  -- Il messaggio non dice da che parte sta il blocco: la convenzione di
  -- MES-02 e' che il blocco resta invisibile al bloccato.
  if exists (
    select 1
    from public.user_blocks b
    where (b.blocker_profile_id = v_agent and b.blocked_profile_id = p_player_profile_id)
       or (b.blocker_profile_id = p_player_profile_id and b.blocked_profile_id = v_agent)
  ) then
    raise exception 'Non e'' possibile collegarsi a questo profilo';
  end if;

  v_label := case p_relationship_type
    when 'procuratore'        then 'Procuratore'
    when 'intermediario'      then 'Intermediario'
    when 'referente_sportivo' then 'Referente sportivo'
    else p_relationship_type
  end;

  select * into v_rep
  from public.agent_representations
  where agent_profile_id  = v_agent
    and player_profile_id = p_player_profile_id;

  -- FOUND viene riscritto dal primo PERFORM qui sotto: va catturato adesso.
  v_has_rep := found;

  if v_has_rep and v_rep.status in ('accepted', 'pending') then
    -- Idempotente: un doppio submit non crea una seconda richiesta e non
    -- consuma il rate limit.
    return v_rep.id;
  end if;

  perform public.assert_agent_rate_limit(
    'representation_request', p_player_profile_id::text, 3, interval '24 hours'
  );
  perform public.assert_agent_rate_limit(
    'representation_request_daily', null, 50, interval '24 hours'
  );

  if v_has_rep then
    update public.agent_representations
    set
      status             = 'pending',
      relationship_type  = p_relationship_type,
      visibility         = p_visibility,
      message            = p_message,
      started_on         = p_started_on,
      ended_on           = null,
      origin             = 'search',
      requested_by       = v_agent,
      accepted_at        = null,
      rejected_at        = null,
      terminated_at      = null,
      reported_reason    = null,
      reported_at        = null,
      pending_visibility = null,
      updated_at         = timezone('utc', now())
    where id = v_rep.id;

    v_result_id := v_rep.id;
  else
    insert into public.agent_representations (
      agent_profile_id,
      player_profile_id,
      requested_by,
      status,
      relationship_type,
      visibility,
      message,
      started_on,
      origin
    ) values (
      v_agent,
      p_player_profile_id,
      v_agent,
      'pending',
      p_relationship_type,
      p_visibility,
      p_message,
      p_started_on,
      'search'
    )
    returning id into v_result_id;
  end if;

  select full_name into v_agent_name
  from public.profiles where id = v_agent;

  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    p_player_profile_id,
    'agent_representation_request',
    'Richiesta di collegamento',
    coalesce(v_agent_name, 'Un procuratore') || ' ti ha inviato una richiesta come ' || v_label || '.',
    jsonb_build_object(
      'representation_id', v_result_id::text,
      'agent_profile_id',  v_agent::text
    )
  );

  return v_result_id;
end;
$$;

revoke all on function public.request_agent_representation(uuid, text, text, text, date) from public;
grant execute on function public.request_agent_representation(uuid, text, text, text, date) to authenticated;


-- ============================================================
-- SECTION 6: modifica e conclusione del rapporto (lato procuratore)
-- ============================================================
-- La visibilita' NON si tocca da qui: resta appannaggio di
-- `propose_representation_visibility`, che applica 'private' subito e manda
-- 'public' in proposta al calciatore. Un endpoint che cambiasse la visibilita'
-- insieme al resto renderebbe pubblico un rapporto senza consenso.

create or replace function public.update_agent_representation_terms(
  p_id                uuid,
  p_relationship_type text default null,
  p_started_on        date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent uuid := auth.uid();
  v_rep   public.agent_representations%rowtype;
begin
  if v_agent is null then
    raise exception 'Authentication required';
  end if;

  select * into v_rep
  from public.agent_representations
  where id = p_id;

  if not found then
    raise exception 'Collegamento non trovato';
  end if;

  if v_rep.agent_profile_id <> v_agent then
    raise exception 'Non autorizzato';
  end if;

  if v_rep.status not in ('pending', 'accepted') then
    raise exception 'Rapporto non modificabile';
  end if;

  if p_relationship_type is not null
     and p_relationship_type not in ('procuratore', 'intermediario', 'referente_sportivo') then
    raise exception 'Tipo di relazione non valido';
  end if;

  if p_started_on is not null and p_started_on > (timezone('utc', now()))::date then
    raise exception 'La data iniziale non e'' valida';
  end if;

  update public.agent_representations
  set
    relationship_type = coalesce(p_relationship_type, relationship_type),
    started_on        = coalesce(p_started_on, started_on),
    updated_at        = timezone('utc', now())
  where id = p_id;
end;
$$;

revoke all on function public.update_agent_representation_terms(uuid, text, date) from public;
grant execute on function public.update_agent_representation_terms(uuid, text, date) to authenticated;


create or replace function public.end_agent_representation(
  p_id       uuid,
  p_ended_on date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent      uuid := auth.uid();
  v_rep        public.agent_representations%rowtype;
  v_agent_name text;
begin
  if v_agent is null then
    raise exception 'Authentication required';
  end if;

  select * into v_rep
  from public.agent_representations
  where id = p_id;

  if not found then
    raise exception 'Collegamento non trovato';
  end if;

  if v_rep.agent_profile_id <> v_agent then
    raise exception 'Non autorizzato';
  end if;

  if v_rep.status = 'terminated' then
    return; -- idempotente
  end if;

  if v_rep.status <> 'accepted' then
    raise exception 'Solo un rapporto attivo puo'' essere concluso';
  end if;

  if p_ended_on is not null and p_ended_on > (timezone('utc', now()))::date then
    raise exception 'La data finale non e'' valida';
  end if;

  update public.agent_representations
  set
    status        = 'terminated',
    ended_on      = coalesce(p_ended_on, (timezone('utc', now()))::date),
    terminated_at = timezone('utc', now()),
    updated_at    = timezone('utc', now())
  where id = p_id;

  select full_name into v_agent_name
  from public.profiles where id = v_agent;

  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    v_rep.player_profile_id,
    'agent_representation_removed',
    'Rapporto concluso',
    coalesce(v_agent_name, 'Il procuratore') || ' ha concluso il rapporto di rappresentanza.',
    jsonb_build_object('representation_id', p_id::text)
  );
end;
$$;

revoke all on function public.end_agent_representation(uuid, date) from public;
grant execute on function public.end_agent_representation(uuid, date) to authenticated;


-- ============================================================
-- SECTION 7: record manuali — duplicati, creazione, modifica, eliminazione
-- ============================================================

-- 7a. Controllo duplicati. Separato dalla creazione perche' il mockup mostra
--     l'avviso PRIMA di salvare: "Potrebbe essere gia' presente nel tuo
--     portfolio" con la possibilita' di aprire il record esistente.
--     Il confronto non e' solo sul nome: ruolo e squadra, quando presenti,
--     devono combaciare o essere assenti. Due omonimi con ruolo diverso non
--     sono lo stesso assistito.

create or replace function public.find_agent_manual_duplicates(
  p_full_name text,
  p_position  public.player_position default null,
  p_team      text default null
)
returns table (
  kind              text,
  id                uuid,
  full_name         text,
  primary_position  public.player_position,
  team_label        text,
  status            text,
  invite_status     text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_agent      uuid := auth.uid();
  v_normalized text;
  v_team       text;
begin
  if v_agent is null then
    raise exception 'Authentication required';
  end if;

  v_normalized := lower(regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g'));
  v_team       := nullif(lower(trim(coalesce(p_team, ''))), '');

  if v_normalized = '' then
    return;
  end if;

  return query
    -- Record manuali ancora attivi dello stesso procuratore.
    select
      'manual'::text                                      as kind,
      m.id,
      m.full_name,
      m.primary_position,
      m.team_label,
      m.status,
      (
        select i.status
        from public.agent_assistito_invites i
        where i.manual_assistito_id = m.id
          and i.status not in ('revoked', 'expired')
        order by i.created_at desc
        limit 1
      )                                                   as invite_status
    from public.agent_manual_assistiti m
    where m.agent_profile_id = v_agent
      and m.status = 'active'
      and m.normalized_name = v_normalized
      and (p_position is null or m.primary_position is null or m.primary_position = p_position)
      and (
        v_team is null
        or m.team_label is null
        or lower(trim(m.team_label)) = v_team
      )

    union all

    -- Relazioni gia' esistenti con un profilo omonimo: un duplicato puo'
    -- benissimo essere un calciatore gia' collegato.
    select
      'representation'::text                              as kind,
      r.id,
      p.full_name,
      pp.primary_position,
      null::text                                          as team_label,
      r.status,
      null::text                                          as invite_status
    from public.agent_representations r
    join public.profiles p
      on p.id = r.player_profile_id
    left join public.player_profiles pp
      on pp.profile_id = r.player_profile_id
    where r.agent_profile_id = v_agent
      and r.status in ('pending', 'accepted')
      and lower(regexp_replace(trim(coalesce(p.full_name, '')), '\s+', ' ', 'g')) = v_normalized;
end;
$$;

revoke all on function public.find_agent_manual_duplicates(text, public.player_position, text) from public;
grant execute on function public.find_agent_manual_duplicates(text, public.player_position, text) to authenticated;


-- 7b. Creazione record manuale + invito, in una sola transazione.
--     Restituisce il token in chiaro: e' l'unico momento in cui esiste.

create or replace function public.create_agent_manual_assistito(
  p_full_name         text,
  p_relationship_type text default 'procuratore',
  p_position          public.player_position default null,
  p_team              text default null,
  p_started_on        date default null,
  p_confirm_duplicate boolean default false
)
returns table (
  manual_id    uuid,
  invite_id    uuid,
  invite_token text,
  expires_at   timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_agent      uuid := auth.uid();
  v_name       text;
  v_manual_id  uuid;
  v_invite_id  uuid;
  v_token      text;
  v_expires    timestamptz;
begin
  if v_agent is null then
    raise exception 'Authentication required';
  end if;

  v_name := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');

  if v_name = '' then
    raise exception 'Inserisci nome e cognome';
  end if;

  if length(v_name) > 120 then
    raise exception 'Nome troppo lungo';
  end if;

  if p_relationship_type not in ('procuratore', 'intermediario', 'referente_sportivo') then
    raise exception 'Tipo di relazione non valido';
  end if;

  if p_started_on is not null and p_started_on > (timezone('utc', now()))::date then
    raise exception 'La data iniziale non e'' valida';
  end if;

  if not p_confirm_duplicate and exists (
    select 1 from public.find_agent_manual_duplicates(v_name, p_position, p_team)
  ) then
    raise exception 'DUPLICATE_SUSPECTED';
  end if;

  perform public.assert_agent_rate_limit(
    'manual_assistito_create', null, 30, interval '24 hours'
  );

  insert into public.agent_manual_assistiti (
    agent_profile_id,
    full_name,
    primary_position,
    team_label,
    relationship_type,
    started_on
  ) values (
    v_agent,
    v_name,
    p_position,
    nullif(trim(coalesce(p_team, '')), ''),
    p_relationship_type,
    p_started_on
  )
  returning id into v_manual_id;

  v_token   := encode(gen_random_bytes(32), 'hex');
  v_expires := timezone('utc', now()) + interval '30 days';

  insert into public.agent_assistito_invites (
    agent_profile_id,
    manual_assistito_id,
    token_hash,
    expires_at
  ) values (
    v_agent,
    v_manual_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    v_expires
  )
  returning id into v_invite_id;

  return query select v_manual_id, v_invite_id, v_token, v_expires;
end;
$$;

revoke all on function public.create_agent_manual_assistito(text, text, public.player_position, text, date, boolean) from public;
grant execute on function public.create_agent_manual_assistito(text, text, public.player_position, text, date, boolean) to authenticated;


-- 7c. Modifica ed eliminazione del record manuale.

create or replace function public.update_agent_manual_assistito(
  p_id                uuid,
  p_full_name         text default null,
  p_relationship_type text default null,
  p_position          public.player_position default null,
  p_team              text default null,
  p_started_on        date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent  uuid := auth.uid();
  v_manual public.agent_manual_assistiti%rowtype;
begin
  if v_agent is null then
    raise exception 'Authentication required';
  end if;

  select * into v_manual
  from public.agent_manual_assistiti
  where id = p_id;

  if not found then
    raise exception 'Assistito non trovato';
  end if;

  if v_manual.agent_profile_id <> v_agent then
    raise exception 'Non autorizzato';
  end if;

  if v_manual.status <> 'active' then
    raise exception 'Record non modificabile';
  end if;

  if p_relationship_type is not null
     and p_relationship_type not in ('procuratore', 'intermediario', 'referente_sportivo') then
    raise exception 'Tipo di relazione non valido';
  end if;

  if p_started_on is not null and p_started_on > (timezone('utc', now()))::date then
    raise exception 'La data iniziale non e'' valida';
  end if;

  update public.agent_manual_assistiti
  set
    full_name         = coalesce(nullif(regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g'), ''), full_name),
    relationship_type = coalesce(p_relationship_type, relationship_type),
    primary_position  = coalesce(p_position, primary_position),
    team_label        = coalesce(nullif(trim(coalesce(p_team, '')), ''), team_label),
    started_on        = coalesce(p_started_on, started_on),
    updated_at        = timezone('utc', now())
  where id = p_id;
end;
$$;

revoke all on function public.update_agent_manual_assistito(uuid, text, text, public.player_position, text, date) from public;
grant execute on function public.update_agent_manual_assistito(uuid, text, text, public.player_position, text, date) to authenticated;


create or replace function public.delete_agent_manual_assistito(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent  uuid := auth.uid();
  v_manual public.agent_manual_assistiti%rowtype;
begin
  if v_agent is null then
    raise exception 'Authentication required';
  end if;

  select * into v_manual
  from public.agent_manual_assistiti
  where id = p_id;

  if not found then
    return; -- idempotente
  end if;

  if v_manual.agent_profile_id <> v_agent then
    raise exception 'Non autorizzato';
  end if;

  -- Gli inviti cadono per cascade: il token smette di esistere con il record.
  delete from public.agent_manual_assistiti where id = p_id;
end;
$$;

revoke all on function public.delete_agent_manual_assistito(uuid) from public;
grant execute on function public.delete_agent_manual_assistito(uuid) to authenticated;


-- ============================================================
-- SECTION 8: inviti — rigenerazione, condivisione, revoca
-- ============================================================

-- 8a. Recupera l'invito valido del record, o ne crea uno nuovo.
--     Il token in chiaro non e' recuperabile: se esiste gia' un invito valido
--     ma il client non ha piu' il token (es. torna sulla schermata dopo giorni)
--     si rigenera il segreto sullo stesso invito, invalidando il precedente.
--     Lo stato e la storia dell'invito restano, quindi non nasce un duplicato.

create or replace function public.issue_agent_assistito_invite(
  p_manual_assistito_id uuid,
  p_rotate              boolean default false
)
returns table (
  invite_id    uuid,
  invite_token text,
  status       text,
  expires_at   timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_agent   uuid := auth.uid();
  v_manual  public.agent_manual_assistiti%rowtype;
  v_invite  public.agent_assistito_invites%rowtype;
  v_has_inv boolean;
  v_token   text;
  v_expires timestamptz;
begin
  if v_agent is null then
    raise exception 'Authentication required';
  end if;

  select * into v_manual
  from public.agent_manual_assistiti
  where id = p_manual_assistito_id;

  if not found then
    raise exception 'Assistito non trovato';
  end if;

  if v_manual.agent_profile_id <> v_agent then
    raise exception 'Non autorizzato';
  end if;

  if v_manual.status <> 'active' then
    raise exception 'Questo assistito e'' gia'' collegato';
  end if;

  -- Ogni colonna va qualificata: `status` ed `expires_at` sono anche parametri
  -- OUT di questa funzione e un riferimento nudo sarebbe ambiguo a runtime.
  select inv.* into v_invite
  from public.agent_assistito_invites inv
  where inv.manual_assistito_id = p_manual_assistito_id
    and inv.status not in ('revoked', 'expired', 'accepted')
    and inv.expires_at > timezone('utc', now())
  order by inv.created_at desc
  limit 1;

  -- Come sopra: FOUND non sopravvive al PERFORM del rate limit.
  v_has_inv := found;

  if v_has_inv and not p_rotate then
    -- Nessun token da restituire: chi lo aveva lo ha gia'. Il client capisce
    -- dalla colonna nulla che deve chiedere una rotazione per riottenerlo.
    return query select v_invite.id, null::text, v_invite.status, v_invite.expires_at;
    return;
  end if;

  perform public.assert_agent_rate_limit(
    'invite_issue', p_manual_assistito_id::text, 5, interval '1 hour'
  );

  v_token   := encode(gen_random_bytes(32), 'hex');
  v_expires := timezone('utc', now()) + interval '30 days';

  if v_has_inv then
    update public.agent_assistito_invites
    set
      token_hash = encode(digest(v_token, 'sha256'), 'hex'),
      status     = 'created',
      expires_at = v_expires,
      opened_at  = null,
      updated_at = timezone('utc', now())
    where id = v_invite.id;

    return query select v_invite.id, v_token, 'created'::text, v_expires;
  else
    insert into public.agent_assistito_invites (
      agent_profile_id,
      manual_assistito_id,
      token_hash,
      expires_at
    ) values (
      v_agent,
      p_manual_assistito_id,
      encode(digest(v_token, 'sha256'), 'hex'),
      v_expires
    )
    returning id into v_invite.id;

    return query select v_invite.id, v_token, 'created'::text, v_expires;
  end if;
end;
$$;

revoke all on function public.issue_agent_assistito_invite(uuid, boolean) from public;
grant execute on function public.issue_agent_assistito_invite(uuid, boolean) to authenticated;


-- 8b. L'utente ha davvero aperto un canale. Non significa "consegnato": il
--     sistema operativo conferma solo la chiusura positiva della share sheet.

create or replace function public.mark_agent_assistito_invite_shared(
  p_invite_id uuid,
  p_channel   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent uuid := auth.uid();
begin
  if v_agent is null then
    raise exception 'Authentication required';
  end if;

  if p_channel is not null and p_channel not in ('whatsapp', 'sms', 'copy_link', 'other') then
    raise exception 'Canale non valido';
  end if;

  update public.agent_assistito_invites
  set
    status     = case when status in ('created', 'shared') then 'shared' else status end,
    channel    = coalesce(p_channel, channel),
    shared_at  = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = p_invite_id
    and agent_profile_id = v_agent;
end;
$$;

revoke all on function public.mark_agent_assistito_invite_shared(uuid, text) from public;
grant execute on function public.mark_agent_assistito_invite_shared(uuid, text) to authenticated;


create or replace function public.revoke_agent_assistito_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent uuid := auth.uid();
begin
  if v_agent is null then
    raise exception 'Authentication required';
  end if;

  update public.agent_assistito_invites
  set
    -- Il token_hash viene sostituito con un valore irraggiungibile: anche chi
    -- possiede il link non puo' piu' farlo risolvere, nemmeno per errore.
    token_hash = 'revoked:' || id::text,
    status     = 'revoked',
    revoked_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = p_invite_id
    and agent_profile_id = v_agent
    and status not in ('accepted', 'revoked');
end;
$$;

revoke all on function public.revoke_agent_assistito_invite(uuid) from public;
grant execute on function public.revoke_agent_assistito_invite(uuid) to authenticated;


-- ============================================================
-- SECTION 9: risoluzione del token e riconciliazione
-- ============================================================
-- La risoluzione richiede autenticazione. E' la scelta che chiude in un colpo
-- solo l'enumerazione (nessuno puo' sondare token da anonimo) e l'esposizione
-- di dati: prima del login il client non ha nulla da mostrare se non "ti hanno
-- invitato su PROLINK", che non e' un dato personale di nessuno.

create or replace function public.resolve_agent_assistito_invite(p_token text)
returns table (
  invite_id         uuid,
  invite_status     text,
  agent_profile_id  uuid,
  agent_full_name   text,
  agent_avatar_url  text,
  agency_name       text,
  relationship_type text,
  visibility        text,
  manual_full_name  text,
  expires_at        timestamptz,
  already_linked    boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user   uuid := auth.uid();
  v_hash   text;
  v_invite public.agent_assistito_invites%rowtype;
  v_manual public.agent_manual_assistiti%rowtype;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_agent_rate_limit(
    'invite_resolve', null, 20, interval '1 hour'
  );

  v_hash := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');

  select * into v_invite
  from public.agent_assistito_invites
  where token_hash = v_hash;

  if not found then
    raise exception 'INVITE_INVALID';
  end if;

  if v_invite.status = 'revoked' then
    raise exception 'INVITE_INVALID';
  end if;

  if v_invite.expires_at <= timezone('utc', now()) then
    update public.agent_assistito_invites
    set status = 'expired', updated_at = timezone('utc', now())
    where id = v_invite.id
      and status not in ('accepted', 'revoked');

    raise exception 'INVITE_EXPIRED';
  end if;

  select * into v_manual
  from public.agent_manual_assistiti
  where id = v_invite.manual_assistito_id;

  if not found then
    raise exception 'INVITE_INVALID';
  end if;

  if v_invite.agent_profile_id = v_user then
    -- Il procuratore che apre il proprio link non e' il destinatario.
    raise exception 'INVITE_SELF';
  end if;

  -- Apertura registrata una volta sola: il contatore non deve avanzare a ogni
  -- rimbalzo fra login e schermata.
  update public.agent_assistito_invites
  set
    status                = case
                              when status in ('created', 'shared') then 'opened'
                              else status
                            end,
    opened_at             = coalesce(opened_at, timezone('utc', now())),
    registered_profile_id = coalesce(registered_profile_id, v_user),
    updated_at            = timezone('utc', now())
  where id = v_invite.id;

  return query
    select
      v_invite.id,
      case when v_invite.status in ('created', 'shared') then 'opened' else v_invite.status end,
      v_invite.agent_profile_id,
      p.full_name,
      p.avatar_url,
      ap.agency_name,
      v_manual.relationship_type,
      v_manual.visibility,
      v_manual.full_name,
      v_invite.expires_at,
      exists (
        select 1
        from public.agent_representations r
        where r.agent_profile_id  = v_invite.agent_profile_id
          and r.player_profile_id = v_user
          and r.status in ('pending', 'accepted')
      )
    from public.profiles p
    left join public.agent_profiles ap
      on ap.profile_id = p.id
    where p.id = v_invite.agent_profile_id;
end;
$$;

revoke all on function public.resolve_agent_assistito_invite(text) from public;
grant execute on function public.resolve_agent_assistito_invite(text) to authenticated;


-- 9b. Accettazione o rifiuto da parte del calciatore. E' il solo punto in cui
--     un record manuale diventa una relazione: tutto dentro una funzione, cioe'
--     dentro una transazione, quindi o esistono relazione collegata, record
--     riconciliato e invito accettato, oppure non esiste niente di parziale.
--     Idempotente: una seconda chiamata con lo stesso token ritorna la stessa
--     relazione senza crearne una seconda.

create or replace function public.respond_agent_assistito_invite(
  p_token  text,
  p_accept boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user         uuid := auth.uid();
  v_hash         text;
  v_invite       public.agent_assistito_invites%rowtype;
  v_manual       public.agent_manual_assistiti%rowtype;
  v_rep          public.agent_representations%rowtype;
  v_rep_id       uuid;
  v_player_name  text;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  v_hash := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');

  -- Il lock serializza le aperture concorrenti dello stesso link: senza, due
  -- tap ravvicinati potrebbero creare due relazioni.
  select * into v_invite
  from public.agent_assistito_invites
  where token_hash = v_hash
  for update;

  if not found or v_invite.status = 'revoked' then
    raise exception 'INVITE_INVALID';
  end if;

  if v_invite.expires_at <= timezone('utc', now()) then
    raise exception 'INVITE_EXPIRED';
  end if;

  if v_invite.agent_profile_id = v_user then
    raise exception 'INVITE_SELF';
  end if;

  select * into v_manual
  from public.agent_manual_assistiti
  where id = v_invite.manual_assistito_id
  for update;

  if not found then
    raise exception 'INVITE_INVALID';
  end if;

  if not p_accept then
    update public.agent_assistito_invites
    set
      status     = 'revoked',
      revoked_at = timezone('utc', now()),
      token_hash = 'declined:' || id::text,
      updated_at = timezone('utc', now())
    where id = v_invite.id;

    return null;
  end if;

  if exists (
    select 1
    from public.user_blocks b
    where (b.blocker_profile_id = v_user and b.blocked_profile_id = v_invite.agent_profile_id)
       or (b.blocker_profile_id = v_invite.agent_profile_id and b.blocked_profile_id = v_user)
  ) then
    raise exception 'Non e'' possibile collegarsi a questo profilo';
  end if;

  -- Deduplicazione: se un rapporto esiste gia' non se ne crea un secondo, il
  -- record manuale viene comunque archiviato sopra quello.
  select * into v_rep
  from public.agent_representations
  where agent_profile_id  = v_invite.agent_profile_id
    and player_profile_id = v_user
  for update;

  if found then
    v_rep_id := v_rep.id;

    if v_rep.status not in ('accepted') then
      update public.agent_representations
      set
        status             = 'accepted',
        relationship_type  = v_manual.relationship_type,
        -- La relazione nata da un record manuale privato resta privata: la
        -- pubblicazione e' una scelta separata, con il consenso del calciatore.
        visibility         = 'private',
        started_on         = coalesce(v_manual.started_on, started_on),
        ended_on           = null,
        origin             = 'invite',
        accepted_at        = timezone('utc', now()),
        rejected_at        = null,
        terminated_at      = null,
        pending_visibility = null,
        updated_at         = timezone('utc', now())
      where id = v_rep.id;
    end if;
  else
    insert into public.agent_representations (
      agent_profile_id,
      player_profile_id,
      requested_by,
      status,
      relationship_type,
      visibility,
      started_on,
      origin,
      accepted_at
    ) values (
      v_invite.agent_profile_id,
      v_user,
      v_invite.agent_profile_id,
      'accepted',
      v_manual.relationship_type,
      'private',
      v_manual.started_on,
      'invite',
      timezone('utc', now())
    )
    returning id into v_rep_id;
  end if;

  update public.agent_manual_assistiti
  set
    status            = 'linked',
    linked_profile_id = v_user,
    representation_id = v_rep_id,
    reconciled_at     = coalesce(reconciled_at, timezone('utc', now())),
    updated_at        = timezone('utc', now())
  where id = v_manual.id;

  update public.agent_assistito_invites
  set
    status                = 'accepted',
    registered_profile_id = v_user,
    reconciled_at         = coalesce(reconciled_at, timezone('utc', now())),
    token_hash            = 'accepted:' || id::text,
    updated_at            = timezone('utc', now())
  where id = v_invite.id;

  -- Ogni altro invito ancora aperto dello stesso procuratore verso lo stesso
  -- account perde senso: chiuderlo evita il doppio collegamento.
  update public.agent_assistito_invites
  set
    status     = 'revoked',
    revoked_at = timezone('utc', now()),
    token_hash = 'superseded:' || id::text,
    updated_at = timezone('utc', now())
  where agent_profile_id = v_invite.agent_profile_id
    and id <> v_invite.id
    and registered_profile_id = v_user
    and status not in ('accepted', 'revoked');

  select full_name into v_player_name
  from public.profiles where id = v_user;

  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    v_invite.agent_profile_id,
    'agent_invite_reconciled',
    'Assistito collegato',
    coalesce(v_player_name, 'Il calciatore') || ' si e'' collegato al tuo portfolio.',
    jsonb_build_object(
      'representation_id', v_rep_id::text,
      'manual_id',         v_manual.id::text
    )
  );

  return v_rep_id;
end;
$$;

revoke all on function public.respond_agent_assistito_invite(text, boolean) from public;
grant execute on function public.respond_agent_assistito_invite(text, boolean) to authenticated;


-- ============================================================
-- SECTION 10: letture dell'hub
-- ============================================================

-- 10a. Conteggi. Derivati dal database, non dalla lista caricata: la lista e'
--      paginabile e filtrata, i conteggi no.

create or replace function public.fetch_agent_assistiti_counts(
  p_agent_profile_id uuid
)
returns table (
  active_count   integer,
  pending_count  integer,
  private_count  integer,
  public_count   integer,
  invite_count   integer,
  ended_count    integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if auth.uid() <> p_agent_profile_id then
    raise exception 'Non autorizzato';
  end if;

  return query
    select
      (select count(*)::integer from public.agent_representations r
        where r.agent_profile_id = p_agent_profile_id and r.status = 'accepted'),
      (select count(*)::integer from public.agent_representations r
        where r.agent_profile_id = p_agent_profile_id and r.status = 'pending'),
      (select count(*)::integer from public.agent_representations r
        where r.agent_profile_id = p_agent_profile_id
          and r.status = 'accepted' and r.visibility = 'private'),
      (select count(*)::integer from public.agent_representations r
        where r.agent_profile_id = p_agent_profile_id
          and r.status = 'accepted' and r.visibility = 'public'),
      (select count(*)::integer from public.agent_manual_assistiti m
        where m.agent_profile_id = p_agent_profile_id and m.status = 'active'),
      (select count(*)::integer from public.agent_representations r
        where r.agent_profile_id = p_agent_profile_id
          and r.status in ('rejected', 'revoked', 'terminated', 'removed'));
end;
$$;

revoke all on function public.fetch_agent_assistiti_counts(uuid) from public;
grant execute on function public.fetch_agent_assistiti_counts(uuid) to authenticated;


-- 10b. Elenco unico: relazioni e record manuali nella stessa forma, distinti
--      dalla colonna `kind`. Una sola lettura alimenta hub, filtri, schermata
--      Richieste e inviti: niente seconde liste da tenere allineate.

create or replace function public.fetch_agent_assistiti_overview(
  p_agent_profile_id uuid
)
returns table (
  kind              text,
  id                uuid,
  player_profile_id uuid,
  full_name         text,
  avatar_url        text,
  primary_position  public.player_position,
  team_label        text,
  relationship_type text,
  visibility        text,
  status            text,
  started_on        date,
  ended_on          date,
  invite_id         uuid,
  invite_status     text,
  invite_channel    text,
  invite_shared_at  timestamptz,
  invite_expires_at timestamptz,
  created_at        timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if auth.uid() <> p_agent_profile_id then
    raise exception 'Non autorizzato';
  end if;

  -- L'unione vive dentro una sottoquery con alias: l'ORDER BY finale deve
  -- poter qualificare la colonna, altrimenti `created_at` coincide con il
  -- parametro OUT omonimo e il riferimento diventa ambiguo a runtime.
  return query
    select
      u.kind,
      u.id,
      u.player_profile_id,
      u.full_name,
      u.avatar_url,
      u.primary_position,
      u.team_label,
      u.relationship_type,
      u.visibility,
      u.status,
      u.started_on,
      u.ended_on,
      u.invite_id,
      u.invite_status,
      u.invite_channel,
      u.invite_shared_at,
      u.invite_expires_at,
      u.created_at
    from (
    select
      'representation'::text                             as kind,
      r.id                                               as id,
      r.player_profile_id                                as player_profile_id,
      p.full_name                                        as full_name,
      p.avatar_url                                       as avatar_url,
      pp.primary_position                                as primary_position,
      cl.name                                            as team_label,
      r.relationship_type                                as relationship_type,
      r.visibility                                       as visibility,
      r.status                                           as status,
      r.started_on                                       as started_on,
      r.ended_on                                         as ended_on,
      null::uuid                                         as invite_id,
      null::text                                         as invite_status,
      null::text                                         as invite_channel,
      null::timestamptz                                  as invite_shared_at,
      null::timestamptz                                  as invite_expires_at,
      r.created_at                                       as created_at
    from public.agent_representations r
    join public.profiles p
      on p.id = r.player_profile_id
    left join public.player_profiles pp
      on pp.profile_id = r.player_profile_id
    left join lateral (
      select c.name
      from public.club_members cm
      join public.clubs c on c.id = cm.club_id
      where cm.profile_id = r.player_profile_id
        and cm.is_current = true
        and cm.status = 'active'
      limit 1
    ) cl on true
    where r.agent_profile_id = p_agent_profile_id
      and r.status in ('pending', 'accepted', 'rejected', 'revoked', 'terminated', 'removed')

    union all

    select
      'manual'::text,
      m.id,
      m.linked_profile_id,
      m.full_name,
      null::text,
      m.primary_position,
      m.team_label,
      m.relationship_type,
      m.visibility,
      m.status,
      m.started_on,
      null::date,
      i.id,
      i.status,
      i.channel,
      i.shared_at,
      i.expires_at,
      m.created_at
    from public.agent_manual_assistiti m
    left join lateral (
      select inv.*
      from public.agent_assistito_invites inv
      where inv.manual_assistito_id = m.id
      order by
        case when inv.status in ('revoked', 'expired') then 1 else 0 end,
        inv.created_at desc
      limit 1
    ) i on true
    where m.agent_profile_id = p_agent_profile_id
      and m.status <> 'linked'
    ) u
    order by u.created_at desc;
end;
$$;

revoke all on function public.fetch_agent_assistiti_overview(uuid) from public;
grant execute on function public.fetch_agent_assistiti_overview(uuid) to authenticated;


-- 10c. Stato della relazione per un insieme di profili: alimenta le CTA dei
--      risultati di ricerca ("Gia' collegato", "Richiesta in attesa") senza
--      duplicare il motore di ricerca ne' aggiungere una colonna alla sua RPC.

create or replace function public.fetch_agent_relationship_states(
  p_player_profile_ids uuid[]
)
returns table (
  player_profile_id uuid,
  status            text,
  blocked           boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_agent uuid := auth.uid();
begin
  if v_agent is null then
    raise exception 'Authentication required';
  end if;

  return query
    select
      t.player_id,
      r.status,
      exists (
        select 1
        from public.user_blocks b
        where (b.blocker_profile_id = v_agent and b.blocked_profile_id = t.player_id)
           or (b.blocker_profile_id = t.player_id and b.blocked_profile_id = v_agent)
      )
    from unnest(coalesce(p_player_profile_ids, '{}'::uuid[])) as t(player_id)
    left join public.agent_representations r
      on r.agent_profile_id  = v_agent
     and r.player_profile_id = t.player_id
     and r.status in ('pending', 'accepted');
end;
$$;

revoke all on function public.fetch_agent_relationship_states(uuid[]) from public;
grant execute on function public.fetch_agent_relationship_states(uuid[]) to authenticated;


-- ============================================================
-- SECTION 11: notifiche — i tipi nuovi entrano nella categoria giusta
-- ============================================================
-- Senza questo, `agent_invite_reconciled` finirebbe in 'sistema' e sfuggirebbe
-- al gating delle preferenze: una notifica di rapporto consegnata a chi aveva
-- disattivato le richieste.

create or replace function public.notifications_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pref_key text;
  v_enabled  boolean;
begin
  new.category := case new.type
    when 'agent_representation_request'             then 'richieste'
    when 'agent_representation_responded'           then 'richieste'
    when 'agent_representation_removed'             then 'richieste'
    when 'agent_representation_visibility_proposed' then 'richieste'
    when 'agent_invite_reconciled'                  then 'richieste'
    when 'member_joined'                            then 'richieste'
    when 'roster_assignment_responded'              then 'richieste'
    when 'application_received'                     then 'candidature'
    when 'application_status'                       then 'candidature'
    when 'content_tag'                              then 'attivita'
    when 'new_follower'                             then 'attivita'
    else 'sistema'
  end;

  v_pref_key := case new.type
    when 'agent_representation_request'             then 'requests'
    when 'agent_representation_responded'           then 'requests'
    when 'agent_representation_removed'             then 'requests'
    when 'agent_representation_visibility_proposed' then 'requests'
    when 'agent_invite_reconciled'                  then 'requests'
    when 'member_joined'                            then 'requests'
    when 'roster_assignment_responded'              then 'requests'
    when 'application_received'                     then 'applications'
    when 'application_status'                       then 'applications'
    when 'content_tag'                              then 'content_tags'
    when 'new_follower'                             then 'new_followers'
    when 'promo'                                    then 'promotions'
    else null
  end;

  if v_pref_key is not null then
    select case v_pref_key
      when 'requests'      then requests
      when 'applications'  then applications
      when 'content_tags'  then content_tags
      when 'new_followers' then new_followers
      when 'store'         then store
      when 'promotions'    then promotions
    end
    into v_enabled
    from public.notification_preferences
    where profile_id = new.recipient_profile_id;

    if v_enabled is false then
      return null;
    end if;
  end if;

  return new;
end;
$$;


-- ============================================================
-- SECTION 12: il portfolio dell'onboarding entra nel modello canonico
-- ============================================================
-- `agent_managed_player_entries` nasceva come lista di visualizzazione del
-- profilo: leggibile da chiunque (`using (true)`) e riscritta per intero a ogni
-- salvataggio dal payload del client. Entrambe le cose sono incompatibili con
-- questa task — un record manuale non puo' essere pubblico e lo stato di una
-- relazione non puo' arrivare dal client — quindi la lista resta dov'e' come
-- composizione visuale dell'onboarding, ma smette di essere pubblica e smette
-- di essere la fonte: la verita' si sposta su agent_manual_assistiti e
-- agent_representations.

drop policy if exists "agent managed players are readable by authenticated users"
  on public.agent_managed_player_entries;

drop policy if exists "agent managed players select own"
  on public.agent_managed_player_entries;

create policy "agent managed players select own"
  on public.agent_managed_player_entries
  for select
  to authenticated
  using (public.is_current_user(agent_profile_id));


-- 12b. Sincronizzazione: ogni voce del portfolio di onboarding diventa una
--      richiesta di collegamento (se puntava a un profilo reale) o un record
--      manuale privato (se era un nome scritto a mano). Idempotente: chiamarla
--      due volte non crea nulla di nuovo.

create or replace function public.sync_agent_portfolio_entries()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent   uuid := auth.uid();
  v_entry   record;
  v_created integer := 0;
  v_name    text;
  v_rep_id  uuid;
begin
  if v_agent is null then
    raise exception 'Authentication required';
  end if;

  for v_entry in
    select *
    from public.agent_managed_player_entries
    where agent_profile_id = v_agent
  loop
    v_name := regexp_replace(trim(coalesce(v_entry.display_name, '')), '\s+', ' ', 'g');

    if v_name = '' then
      continue;
    end if;

    if v_entry.linked_profile_id is not null then
      if v_entry.linked_profile_id = v_agent then
        continue;
      end if;

      if exists (
        select 1 from public.agent_representations r
        where r.agent_profile_id  = v_agent
          and r.player_profile_id = v_entry.linked_profile_id
      ) then
        continue;
      end if;

      if exists (
        select 1 from public.user_blocks b
        where (b.blocker_profile_id = v_agent and b.blocked_profile_id = v_entry.linked_profile_id)
           or (b.blocker_profile_id = v_entry.linked_profile_id and b.blocked_profile_id = v_agent)
      ) then
        continue;
      end if;

      insert into public.agent_representations (
        agent_profile_id, player_profile_id, requested_by,
        status, relationship_type, visibility, origin
      ) values (
        v_agent, v_entry.linked_profile_id, v_agent,
        'pending', 'procuratore', 'private', 'onboarding'
      )
      returning id into v_rep_id;

      insert into public.notifications (recipient_profile_id, type, title, body, data)
      select
        v_entry.linked_profile_id,
        'agent_representation_request',
        'Richiesta di collegamento',
        coalesce(p.full_name, 'Un procuratore') || ' ti ha inviato una richiesta come Procuratore.',
        jsonb_build_object(
          'agent_profile_id',   v_agent::text,
          'representation_id',  v_rep_id::text
        )
      from public.profiles p
      where p.id = v_agent;

      v_created := v_created + 1;
    else
      if exists (
        select 1 from public.agent_manual_assistiti m
        where m.agent_profile_id = v_agent
          and m.normalized_name  = lower(v_name)
          and m.status <> 'archived'
      ) then
        continue;
      end if;

      insert into public.agent_manual_assistiti (
        agent_profile_id, full_name, primary_position, team_label, relationship_type
      ) values (
        v_agent, v_name, v_entry.primary_position,
        nullif(trim(coalesce(v_entry.category_label, '')), ''), 'procuratore'
      );

      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$$;

revoke all on function public.sync_agent_portfolio_entries() from public;
grant execute on function public.sync_agent_portfolio_entries() to authenticated;


-- 12c. Backfill dei dati esistenti. Le voci senza profilo collegato diventano
--      record manuali privati; quelle con un profilo collegato ma senza alcuna
--      relazione diventano record manuali con `suggested_profile_id`, non
--      richieste: generare richieste retroattive significherebbe notificare
--      centinaia di calciatori per una migrazione, cosa che nessuno ha chiesto.
--      Il procuratore le convertira' dall'hub, con un gesto esplicito.

insert into public.agent_manual_assistiti (
  agent_profile_id,
  full_name,
  primary_position,
  team_label,
  relationship_type,
  suggested_profile_id,
  created_at
)
select
  e.agent_profile_id,
  regexp_replace(trim(e.display_name), '\s+', ' ', 'g'),
  e.primary_position,
  nullif(trim(coalesce(e.category_label, '')), ''),
  'procuratore',
  e.linked_profile_id,
  e.created_at
from public.agent_managed_player_entries e
where length(trim(coalesce(e.display_name, ''))) > 0
  -- Niente duplicati di cio' che e' gia' una relazione.
  and not exists (
    select 1
    from public.agent_representations r
    where r.agent_profile_id = e.agent_profile_id
      and e.linked_profile_id is not null
      and r.player_profile_id = e.linked_profile_id
  )
  and not exists (
    select 1
    from public.agent_manual_assistiti m
    where m.agent_profile_id = e.agent_profile_id
      and m.normalized_name  = lower(regexp_replace(trim(e.display_name), '\s+', ' ', 'g'))
  );
