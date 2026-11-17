-- ============================================================
-- DAS-REV-34 — Gruppi: integrazione Messaging/Push, parte A: stato personale
--
-- COSA MANCAVA
--
-- La task DAS-REV-34 chiede che la Conversation GROUP dei gruppi operativi e la
-- DIRECT condividano UN motore per read state, unread, badge, mute e
-- preferenze, senza sistemi paralleli (§1). Verificato sul codice (non sul
-- remoto) mancano sei cose:
--
--   1. LO STATO PERSONALE (§4). `conversation_participants` è leggibile dai
--      co-membri (RLS filtra righe, non colonne): un mute lì dentro trapelerebbe
--      agli altri partecipanti. Serve una tabella a parte, owner-only, legata al
--      periodo di membership (§4, §14): `conversation_actor_states`.
--   2. IL CONFINE DI LETTURA SERVER (§11). L'unread di oggi confronta
--      `messages.sent_at` con `last_read_at`: un orario, quindi un ack «fino a
--      qui» non esiste, e un messaggio arrivato mentre si conferma la lettura
--      verrebbe azzerato alla cieca. Si passa alla `messages.seq` (già
--      assegnata dal server, DAS-REV-33) con `last_read_seq`, un ack
--      `acknowledge_conversation_read` che non retrocede mai e rifiuta il
--      periodo vecchio (§11, §14).
--   3. UNA SOLA REGOLA DI UNREAD (§1, §10, §11, §12). Oggi il conteggio è
--      scritto in linea dentro fetch_inbox_conversations e, a parte, nel
--      layout del client (`filter(unread_count > 0)` sulla pagina caricata).
--      Qui: `footme_conversation_unread_count`, usata da inbox, badge e ack.
--      Non contano i SYSTEM_EVENT (§12), né i propri messaggi, né quel che
--      precede il confine del periodo (§14).
--   4. IL BADGE COME AGGREGATO SERVER (§10). Il client lo calcolava sulla
--      pagina di 50 righe. `fetch_messages_badge_count` conta le unità
--      conversazione (non i messaggi: 17+2+4 su tre chat = 3), esclude le chat
--      archiviate personalmente e i GROUP globalmente ARCHIVED/eliminati
--      (§13), e somma le Comunicazioni non lette (decisione: restano nel badge
--      Messaggi; la regola è quella già usata dal client e da
--      fetch_communications).
--   5. IL MUTE (§9). Opzioni 1h/8h/1w/indefinito/attive, scadenza calcolata dal
--      server e valutata in lettura (nessun cron, nessuna notifica di
--      «riattivate»), operation id contro il retry, versione contro i cambi da
--      due dispositivi. Vale per DIRECT e GROUP con la stessa RPC (§9: non due
--      sistemi di salvataggio). Nessun ruolo né capability Società (§5): conta
--      solo essere partecipante del periodo corrente.
--   6. DUE PREFERENZE GLOBALI (decisione di Luigi 2026-11-17): «Messaggi»
--      (`push_messages`) e «Mostra anteprima» (`message_preview`), più il
--      resolver server-side dei deep link (§21).
--
-- PERCHÉ QUESTA SOLUZIONE
--
--   · Tabella separata, non colonne su `conversation_participants`: vedi (1).
--     Si scrive solo da RPC definer; il client non ha INSERT/UPDATE/DELETE.
--   · `period_id` nello stato: il mute vale solo se coincide col periodo
--     corrente del partecipante (`is not distinct from`: nelle DIRECT è
--     null/null). Alla fine del periodo (DELETE della riga partecipante) un
--     trigger elimina anche lo stato; se per qualunque motivo restasse, la
--     lettura lo ignora comunque. Un nuovo periodo parte da «Attive» e da
--     unread zero rispetto ai contenuti anteriori (§14): `last_read_seq` è una
--     colonna della RIGA partecipante, che per un re-add è una riga nuova.
--   · `state_version` viene da una sequence globale, non da old+1: così resta
--     crescente anche quando lo stato viene eliminato e ricreato in un nuovo
--     periodo (il client scarta le risposte con versione più vecchia).
--   · Retry del mute: `conversation_mute_operations` registra TUTTE le
--     operazioni viste, non solo l'ultima. Con la sola «ultima operazione» un
--     retry tardivo di X dopo che un altro dispositivo ha applicato Y
--     riapplicherebbe X con una durata ricalcolata e scavalcherebbe Y (§9).
--   · `acknowledge_conversation_read` richiede il periodo nei GROUP con
--     periodo: un client vecchio senza `p_period_id` non avanza il confine del
--     periodo nuovo (§11, §14).
--   · Scadenza lazy: «mute effettivo» = indefinite OR mute_until > now(). Le
--     letture restituiscono già Attive a mute scaduto, anche a telefono spento.
--   · Il backfill di `last_read_seq` usa il massimo seq dei messaggi con
--     sent_at <= last_read_at: nulla di nuovo viene segnato letto e nulla di
--     letto torna non letto (§28). Eseguito una sola volta (alla creazione
--     della colonna), quindi la migrazione è rieseguibile.
--   · Le funzioni sono riemesse dall'ULTIMA definizione (verificata con grep):
--       fetch_inbox_conversations        ← 20261127090000 (NON 20261113110000)
--       mark_conversation_read           ← 20260718090000
--       mark_inbox_all_read              ← 20260718090200
--       fetch_my_notification_preferences,
--       set_notification_preference,
--       footme_notification_push_enabled ← 20261129090000
--   · `fetch_inbox_conversations` mantiene le 19 colonne esistenti nello stesso
--     ordine; le nuove sono IN CODA. Cambia la signature di ritorno, quindi
--     drop + create (come le riemissioni precedenti). `search_share_recipients`
--     la usa con `select i.*` in plpgsql: le colonne in più non la toccano.
--
-- SCELTE DOVUTE ALLA REGOLA §5 E ALLA PRIVACY
--
--   · Le RPC rispondono solo con id, enum e booleani: nessun nome, nessun body.
--   · Un manager non membro riceve NOT_MEMBER e nessuna riga viene creata.
--   · Il resolver rivela «deleted»/«revoked» solo a chi ha o ha avuto un
--     periodo nel gruppo; a chiunque altro risponde «unavailable» (un id non è
--     una capability e non deve confermare l'esistenza di un gruppo).
--
-- DA SAPERE PER CHI LEGGE (limiti dichiarati)
--
--   · `last_read_seq` è una colonna di `conversation_participants`: nelle DIRECT
--     (e nei gruppi legacy senza metadata) i co-membri leggono la riga, come
--     già oggi `last_read_at`. Nei gruppi operativi ognuno legge solo la
--     propria riga (policy DAS-REV-33). Il mute NON è in quella tabella.
--   · Verificato con PGlite (una sola connessione): le conseguenze dei lock e
--     degli upsert, non la concorrenza reale.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — read state: last_read_seq + backfill (§11, §28)
-- ============================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'conversation_participants'
      and column_name = 'last_read_seq'
  ) then
    alter table public.conversation_participants
      add column last_read_seq bigint not null default 0;

    /* Una sola volta: il massimo seq già coperto dal vecchio last_read_at.
       Chi non aveva last_read_at resta a 0 (tutto non letto, come prima). */
    update public.conversation_participants cp
    set last_read_seq = coalesce((
      select max(m.seq)
      from public.messages m
      where m.conversation_id = cp.conversation_id
        and m.sent_at <= cp.last_read_at
    ), 0)
    where cp.last_read_at is not null;
  end if;
end
$$;

comment on column public.conversation_participants.last_read_seq is
  'DAS-REV-34 §11: confine di lettura lato server (messages.seq). Mai '
  'decrescente. Unread = messaggi non system_event di altri con '
  'seq > last_read_seq e seq >= access_from_seq. last_read_at resta come '
  'dato informativo/legacy.';


-- ============================================================
-- SEZIONE 2 — stato personale mute (§4, §9, §14)
-- ============================================================

create sequence if not exists public.conversation_actor_states_version_seq;

revoke all on sequence public.conversation_actor_states_version_seq from public, anon, authenticated;

create table if not exists public.conversation_actor_states (
  conversation_id        uuid not null references public.conversations(id) on delete cascade,
  profile_id             uuid not null references public.profiles(id) on delete cascade,
  /* GROUP: periodo di membership corrente a cui lo stato appartiene. DIRECT: null. */
  period_id              uuid,
  /* null = Attive. */
  mute_option            text check (mute_option in ('1h', '8h', '1w', 'indefinite')),
  /* UTC, calcolata dal server. null per Attive e per «indefinite». */
  mute_until             timestamptz,
  last_mute_operation_id uuid,
  state_version          bigint not null default 0,
  updated_at             timestamptz not null default timezone('utc', now()),
  primary key (conversation_id, profile_id),
  constraint conversation_actor_states_mute_shape check (
    (mute_option is null and mute_until is null)
    or (mute_option = 'indefinite' and mute_until is null)
    or (mute_option in ('1h', '8h', '1w') and mute_until is not null)
  )
);

create index if not exists conversation_actor_states_profile_idx
  on public.conversation_actor_states (profile_id);

comment on table public.conversation_actor_states is
  'DAS-REV-34 §4: stato personale della conversazione (mute), owner-only. Valido '
  'solo se period_id coincide col periodo corrente del partecipante. Scritto '
  'soltanto da set_conversation_mute (definer). Separato da '
  'conversation_participants perché quella tabella è leggibile dai co-membri.';

alter table public.conversation_actor_states enable row level security;

/* Default privileges di Supabase: tabella nuova = tutto ad anon/authenticated. */
revoke all on public.conversation_actor_states from public, anon, authenticated;
grant select on public.conversation_actor_states to authenticated;

drop policy if exists "owner reads own conversation actor state" on public.conversation_actor_states;
create policy "owner reads own conversation actor state"
on public.conversation_actor_states
for select
to authenticated
using (profile_id = auth.uid());

/* Realtime (cross-device, §22): solo se la publication esiste e la tabella non
   c'è già. Le righe viaggiano filtrate dalla RLS: ognuno riceve solo le sue. */
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'conversation_actor_states'
     ) then
    alter publication supabase_realtime add table public.conversation_actor_states;
  end if;
end
$$;

/* Registro delle operazioni mute già viste (§9): un retry con lo stesso
   operation id restituisce l'esito registrato anche se nel frattempo un altro
   dispositivo ha applicato altre scelte («ricorda solo l'ultima» non basta).
   Chiuso al client (nessun grant, nessuna policy); scritto solo da
   set_conversation_mute, che pota le righe oltre i 30 giorni. Non ha un
   periodo: sopravvive alla fine del periodo (il retry di un'operazione di un
   periodo chiuso viene comunque rifiutato dal contesto prima di arrivarci). */
create table if not exists public.conversation_mute_operations (
  operation_id    uuid primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  result          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default timezone('utc', now())
);

create index if not exists conversation_mute_operations_created_idx
  on public.conversation_mute_operations (created_at);

alter table public.conversation_mute_operations enable row level security;
revoke all on public.conversation_mute_operations from public, anon, authenticated;

/* Fine del periodo (o uscita dalla DIRECT): lo stato personale muore con la
   riga partecipante, quindi un re-add parte da «Attive» (§14). */
create or replace function public.conversation_actor_state_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.conversation_actor_states s
  where s.conversation_id = old.conversation_id
    and s.profile_id = old.profile_id;
  return old;
end;
$$;

revoke all on function public.conversation_actor_state_cleanup() from public, anon, authenticated;

drop trigger if exists conversation_actor_state_cleanup on public.conversation_participants;
create trigger conversation_actor_state_cleanup
after delete on public.conversation_participants
for each row execute function public.conversation_actor_state_cleanup();


-- ============================================================
-- SEZIONE 3 — helper interni (non chiamabili dal client)
-- ============================================================

/* L'UNICA regola di unread (§11, §12, §14). p_cap limita il conteggio (il
   badge chiede solo «almeno uno»: cap 1). Solo il partecipante della riga
   `conversation_participants` (profilo, conversazione) ha un conteggio. */
create or replace function public.footme_conversation_unread_count(
  p_conversation_id uuid,
  p_profile_id      uuid,
  p_cap             integer default null
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from (
    select 1
    from public.conversation_participants cp
    join public.messages m on m.conversation_id = cp.conversation_id
    where cp.conversation_id = p_conversation_id
      and cp.profile_id = p_profile_id
      and m.message_kind <> 'system_event'
      and m.sender_profile_id is distinct from p_profile_id
      and m.seq > cp.last_read_seq
      and m.seq >= cp.access_from_seq
    limit p_cap
  ) unread;
$$;

revoke all on function public.footme_conversation_unread_count(uuid, uuid, integer) from public, anon, authenticated;

/* Proiezione di attenzione (§13): un GROUP globalmente ARCHIVED (o eliminato)
   non produce attenzione; i marker di lettura restano intatti e alla
   riattivazione tornano a contare solo gli unread davvero non letti. */
create or replace function public.footme_conversation_attention_unread(
  p_conversation_id uuid,
  p_profile_id      uuid,
  p_cap             integer default null
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.society_groups g
      where g.conversation_id = p_conversation_id
        and (g.status = 'archived' or g.deleted_at is not null)
    ) then 0::bigint
    else public.footme_conversation_unread_count(p_conversation_id, p_profile_id, p_cap)
  end;
$$;

revoke all on function public.footme_conversation_attention_unread(uuid, uuid, integer) from public, anon, authenticated;

/* Mute EFFETTIVO ora (scadenza lazy). Ignora lo stato di un periodo vecchio. */
create or replace function public.footme_conversation_is_muted(
  p_conversation_id uuid,
  p_profile_id      uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select s.mute_option = 'indefinite' or s.mute_until > now()
    from public.conversation_participants cp
    join public.conversation_actor_states s
      on s.conversation_id = cp.conversation_id
     and s.profile_id = cp.profile_id
     and s.period_id is not distinct from cp.period_id
    where cp.conversation_id = p_conversation_id
      and cp.profile_id = p_profile_id
  ), false);
$$;

revoke all on function public.footme_conversation_is_muted(uuid, uuid) from public, anon, authenticated;

/* Contesto autorizzato di una operazione personale. Errori (messaggio = codice):
     GROUP_DELETED  gruppo eliminato (chi ha/ha avuto un periodo)
     PERIOD_ENDED   p_period_id dato e diverso dal periodo corrente (o già chiuso)
     NOT_MEMBER     nessuna riga partecipante e nessun periodo noto
   Un gruppo ARCHIVED è consentito (§13). p_lock: FOR SHARE sulla riga
   partecipante, così un Remove concorrente non lascia stato di un periodo
   chiuso. Nessuno stato viene creato qui (§4). */
create or replace function public.footme_conversation_actor_context(
  p_conversation_id uuid,
  p_profile_id      uuid,
  p_period_id       uuid default null,
  p_lock            boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_found   boolean;
  v_type    text;
  v_period  uuid;
  v_from    bigint;
  v_read    bigint;
  v_status  text;
  v_deleted boolean;
begin
  select exists (
    select 1 from public.society_groups g
    where g.conversation_id = p_conversation_id and g.deleted_at is not null
  ) into v_deleted;

  if p_lock then
    select c.conversation_type, cp.period_id, cp.access_from_seq, cp.last_read_seq
    into v_type, v_period, v_from, v_read
    from public.conversation_participants cp
    join public.conversations c on c.id = cp.conversation_id
    where cp.conversation_id = p_conversation_id
      and cp.profile_id = p_profile_id
    for share of cp;
  else
    select c.conversation_type, cp.period_id, cp.access_from_seq, cp.last_read_seq
    into v_type, v_period, v_from, v_read
    from public.conversation_participants cp
    join public.conversations c on c.id = cp.conversation_id
    where cp.conversation_id = p_conversation_id
      and cp.profile_id = p_profile_id;
  end if;
  v_found := found;

  if not v_found then
    if v_deleted and exists (
      select 1 from public.society_group_membership_periods per
      where per.conversation_id = p_conversation_id and per.profile_id = p_profile_id
    ) then
      raise exception 'GROUP_DELETED';
    end if;

    if p_period_id is not null and exists (
      select 1 from public.society_group_membership_periods per
      where per.id = p_period_id
        and per.conversation_id = p_conversation_id
        and per.profile_id = p_profile_id
    ) then
      raise exception 'PERIOD_ENDED';
    end if;

    raise exception 'NOT_MEMBER';
  end if;

  if v_deleted then
    raise exception 'GROUP_DELETED';
  end if;

  if p_period_id is not null and v_period is distinct from p_period_id then
    raise exception 'PERIOD_ENDED';
  end if;

  select g.status into v_status
  from public.society_groups g
  where g.conversation_id = p_conversation_id;

  return jsonb_build_object(
    'conversation_type', v_type,
    'period_id',         v_period,
    'access_from_seq',   v_from,
    'last_read_seq',     v_read,
    'group_status',      v_status);
end;
$$;

revoke all on function public.footme_conversation_actor_context(uuid, uuid, uuid, boolean) from public, anon, authenticated;

/* Avanza il confine di lettura di UN partecipante, mai indietro. p_up_to_seq
   null = fino all'ultimo messaggio visibile. Il confine è limitato ai messaggi
   visibili (seq >= access_from_seq): non si legge nulla di precedente al
   periodo. Per le DIRECT aggiorna anche le ricevute `messages.read_at` fino al
   confine (nei gruppi un partecipante non segna letto «per tutti»). Ritorna
   {last_read_seq, receipts}. Il chiamante ha già verificato l'accesso. */
create or replace function public.footme_conversation_advance_read(
  p_conversation_id uuid,
  p_profile_id      uuid,
  p_up_to_seq       bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from     bigint;
  v_type     text;
  v_max      bigint;
  v_target   bigint;
  v_new      bigint;
  v_receipts integer := 0;
begin
  select cp.access_from_seq, c.conversation_type
  into v_from, v_type
  from public.conversation_participants cp
  join public.conversations c on c.id = cp.conversation_id
  where cp.conversation_id = p_conversation_id
    and cp.profile_id = p_profile_id;

  select max(m.seq) into v_max
  from public.messages m
  where m.conversation_id = p_conversation_id
    and m.seq >= v_from;

  v_target := least(coalesce(p_up_to_seq, v_max, 0), coalesce(v_max, 0));

  update public.conversation_participants cp
  set last_read_seq = greatest(cp.last_read_seq, v_target),
      last_read_at  = case when v_target > cp.last_read_seq
                           then timezone('utc', now())
                           else cp.last_read_at end
  where cp.conversation_id = p_conversation_id
    and cp.profile_id = p_profile_id
  returning cp.last_read_seq into v_new;

  if v_type = 'direct' and v_new > 0 then
    update public.messages m
    set read_at = timezone('utc', now())
    where m.conversation_id = p_conversation_id
      and m.sender_profile_id is distinct from p_profile_id
      and m.read_at is null
      and m.seq <= v_new;

    get diagnostics v_receipts = row_count;
  end if;

  return jsonb_build_object('last_read_seq', v_new, 'receipts', v_receipts);
end;
$$;

revoke all on function public.footme_conversation_advance_read(uuid, uuid, bigint) from public, anon, authenticated;

/* Forma unica della risposta mute (§24): solo id, enum, booleani, istanti. */
create or replace function public.footme_conversation_notification_state_json(
  p_conversation_id uuid,
  p_profile_id      uuid,
  p_type            text,
  p_period_id       uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with st as (
    select s.mute_option, s.mute_until, s.state_version,
           (s.mute_option = 'indefinite' or s.mute_until > now()) as effective
    from public.conversation_actor_states s
    where s.conversation_id = p_conversation_id
      and s.profile_id = p_profile_id
      and s.period_id is not distinct from p_period_id
  )
  select jsonb_build_object(
    'conversation_id',   p_conversation_id,
    'conversation_type', p_type,
    'period_id',         p_period_id,
    'is_muted',          coalesce((select effective from st), false),
    'mute_option',       (select case when effective then mute_option end from st),
    'muted_until',       (select case when effective and mute_option <> 'indefinite'
                                      then mute_until end from st),
    'state_version',     coalesce((select state_version from st), 0),
    'can_change',        true);
$$;

revoke all on function public.footme_conversation_notification_state_json(uuid, uuid, text, uuid) from public, anon, authenticated;


-- ============================================================
-- SEZIONE 4 — read state: RPC (§11)
-- ============================================================

create or replace function public.acknowledge_conversation_read(
  p_conversation_id uuid,
  p_up_to_seq       bigint,
  p_period_id       uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ctx jsonb;
  v_res jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_ctx := public.footme_conversation_actor_context(p_conversation_id, v_uid, p_period_id, true);

  /* In un GROUP con periodo il periodo è OBBLIGATORIO (§11, §14): un client
     vecchio o fabbricato che non lo indica non può far avanzare il confine di
     un periodo che non conosce. Le DIRECT e i gruppi legacy non hanno periodo. */
  if v_ctx ->> 'conversation_type' = 'group'
     and v_ctx ->> 'period_id' is not null
     and p_period_id is null then
    raise exception 'PERIOD_ENDED';
  end if;

  /* Nulla da confermare (conversazione senza messaggi visibili): stato attuale. */
  if p_up_to_seq is null then
    return jsonb_build_object(
      'last_read_seq', (v_ctx ->> 'last_read_seq')::bigint,
      'unread_count',  public.footme_conversation_attention_unread(p_conversation_id, v_uid));
  end if;

  v_res := public.footme_conversation_advance_read(p_conversation_id, v_uid, p_up_to_seq);

  return jsonb_build_object(
    'last_read_seq', (v_res ->> 'last_read_seq')::bigint,
    'unread_count',  public.footme_conversation_attention_unread(p_conversation_id, v_uid));
end;
$$;

revoke all on function public.acknowledge_conversation_read(uuid, bigint, uuid) from public;
revoke execute on function public.acknowledge_conversation_read(uuid, bigint, uuid) from anon;
grant execute on function public.acknowledge_conversation_read(uuid, bigint, uuid) to authenticated;

/* Riemessa da 20260718090000 (ultima definizione): stessa signature e stesso
   ritorno (numero di ricevute DIRECT aggiornate), stesso errore per chi non è
   partecipante. Ora è una delega: confine = ultimo messaggio visibile, via
   l'helper comune. Un gruppo eliminato non è accessibile (§23 di DAS-REV-33). */
create or replace function public.mark_conversation_read(target_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
  v_res              jsonb;
begin
  if current_profile_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = target_conversation_id
      and participant.profile_id = current_profile_id
  ) or exists (
    select 1 from public.society_groups g
    where g.conversation_id = target_conversation_id and g.deleted_at is not null
  ) then
    raise exception 'Conversation not accessible';
  end if;

  v_res := public.footme_conversation_advance_read(target_conversation_id, current_profile_id, null);

  return (v_res ->> 'receipts')::integer;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public;
revoke execute on function public.mark_conversation_read(uuid) from anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

/* Riemessa da 20260718090200 (ultima definizione): stesso ritorno (righe
   conversazione + ricevute DIRECT + comunicazioni). Nuovo: salta i GROUP
   globalmente ARCHIVED o eliminati (§13: l'archiviazione non dichiara letti i
   vecchi messaggi) e avanza `last_read_seq` col confine comune. */
create or replace function public.mark_inbox_all_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid                  uuid := auth.uid();
  v_conversations_count  integer := 0;
  v_messages_count       integer := 0;
  v_communications_count integer := 0;
  v_conv                 uuid;
  v_res                  jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  for v_conv in
    select cp.conversation_id
    from public.conversation_participants cp
    where cp.profile_id = v_uid
      and not exists (
        select 1 from public.society_groups g
        where g.conversation_id = cp.conversation_id
          and (g.status = 'archived' or g.deleted_at is not null)
      )
  loop
    v_res := public.footme_conversation_advance_read(v_conv, v_uid, null);
    v_conversations_count := v_conversations_count + 1;
    v_messages_count := v_messages_count + (v_res ->> 'receipts')::integer;
  end loop;

  update public.communication_recipients
  set read_at = timezone('utc', now())
  where profile_id = v_uid
    and read_at is null;

  get diagnostics v_communications_count = row_count;

  return v_conversations_count + v_messages_count + v_communications_count;
end;
$$;

revoke all on function public.mark_inbox_all_read() from public;
revoke execute on function public.mark_inbox_all_read() from anon;
grant execute on function public.mark_inbox_all_read() to authenticated;


-- ============================================================
-- SEZIONE 5 — Inbox e badge (§10, §13)
-- ============================================================

/* Riemessa da 20261127090000 (ultima definizione): le 19 colonne e l'ordine
   restano identici. Nuove, in coda: is_muted, mute_option, muted_until,
   period_id, state_version, last_read_seq, max_seq. `unread_count` segue la
   regola unica (e vale 0 per un GROUP globalmente ARCHIVED: proiezione, i
   marker restano). Tie-break stabile per c.id (§10). */
drop function if exists public.fetch_inbox_conversations(integer, integer, boolean);

CREATE OR REPLACE FUNCTION public.fetch_inbox_conversations(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_include_archived boolean DEFAULT false)
 RETURNS TABLE(conversation_id uuid, conversation_type text, display_title text, avatar_url text, other_profile_id uuid, participant_count integer, last_message_body text, last_message_kind text, last_message_sent_at timestamp with time zone, last_message_sender_profile_id uuid, last_message_sender_name text, unread_count bigint, archived boolean, blocked_by_me boolean, can_send boolean, group_avatar_path text, group_status text, last_message_system_event_type text, last_message_system_payload jsonb, is_muted boolean, mute_option text, muted_until timestamp with time zone, period_id uuid, state_version bigint, last_read_seq bigint, max_seq bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    c.id                                                            as conversation_id,
    c.conversation_type,
    coalesce(c.title, other_profile.full_name, 'Conversazione')      as display_title,
    coalesce(c.avatar_url, other_profile.avatar_url)                 as avatar_url,
    other_profile.id                                                 as other_profile_id,
    participant_summary.participant_count,
    last_message.body                                                as last_message_body,
    last_message.message_kind                                        as last_message_kind,
    last_message.sent_at                                             as last_message_sent_at,
    last_message.sender_profile_id                                   as last_message_sender_profile_id,
    last_message_sender.full_name                                    as last_message_sender_name,
    coalesce(public.footme_conversation_attention_unread(c.id, v_uid), 0) as unread_count,
    (my_participant.archived_at is not null)                         as archived,
    exists (
      select 1
      from public.user_blocks block_row
      where block_row.blocker_profile_id = v_uid
        and block_row.blocked_profile_id = other_profile.id
    )                                                                 as blocked_by_me,
    -- HOM-12 §90, §107: false se il blocco esiste in QUALUNQUE direzione, senza
    -- dire chi ha bloccato. I gruppi non sono toccati (§119-§125).
    (c.conversation_type <> 'direct'
      or not exists (
        select 1 from public.user_blocks block_row
        where (block_row.blocker_profile_id = v_uid and block_row.blocked_profile_id = other_profile.id)
           or (block_row.blocker_profile_id = other_profile.id and block_row.blocked_profile_id = v_uid)
      ))                                                              as can_send,
    group_info.storage_path                                          as group_avatar_path,
    group_info.status                                                as group_status,
    last_message.system_event_type                                   as last_message_system_event_type,
    last_message.system_payload                                      as last_message_system_payload,
    -- DAS-REV-34 §9, §10: mute personale del periodo corrente, scadenza lazy.
    coalesce(actor_state.mute_option = 'indefinite' or actor_state.mute_until > now(), false)
                                                                      as is_muted,
    case when actor_state.mute_option = 'indefinite' or actor_state.mute_until > now()
         then actor_state.mute_option end                             as mute_option,
    case when actor_state.mute_until > now() then actor_state.mute_until end
                                                                      as muted_until,
    my_participant.period_id                                          as period_id,
    coalesce(actor_state.state_version, 0)                            as state_version,
    my_participant.last_read_seq                                      as last_read_seq,
    last_message.seq                                                  as max_seq
  from public.conversation_participants my_participant
  join public.conversations c
    on c.id = my_participant.conversation_id
  left join public.conversation_actor_states actor_state
    on actor_state.conversation_id = c.id
   and actor_state.profile_id = v_uid
   and actor_state.period_id is not distinct from my_participant.period_id
  left join lateral (
    select p2.id, p2.full_name, p2.avatar_url
    from public.conversation_participants other_participant
    join public.profiles p2 on p2.id = other_participant.profile_id
    where other_participant.conversation_id = c.id
      and other_participant.profile_id <> v_uid
    limit 1
  ) other_profile on c.conversation_type = 'direct'
  left join lateral (
    select count(*)::integer as participant_count
    from public.conversation_participants cp2
    where cp2.conversation_id = c.id
  ) participant_summary on true
  left join lateral (
    select m.body, m.message_kind, m.sent_at, m.sender_profile_id,
           m.system_event_type, m.system_payload, m.seq
    from public.messages m
    where m.conversation_id = c.id
      and m.seq >= my_participant.access_from_seq
    order by m.seq desc
    limit 1
  ) last_message on true
  left join public.profiles last_message_sender
    on last_message_sender.id = last_message.sender_profile_id
  left join lateral (
    select a.storage_path, g.status
    from public.society_groups g
    left join public.society_group_avatar_assets a on a.id = g.avatar_asset_id
    where g.conversation_id = c.id
  ) group_info on c.conversation_type = 'group'
  where my_participant.profile_id = v_uid
    and (p_include_archived or my_participant.archived_at is null)
    and not exists (
      select 1 from public.society_groups gd
      where gd.conversation_id = c.id and gd.deleted_at is not null
    )
  order by coalesce(last_message.sent_at, c.created_at) desc, c.id
  limit p_limit
  offset p_offset;
end;
$function$;

revoke all on function public.fetch_inbox_conversations(integer, integer, boolean) from public, anon;
grant execute on function public.fetch_inbox_conversations(integer, integer, boolean) to authenticated;

/* Badge Messaggi (§10): aggregato server su tutto l'insieme pertinente, non
   sulla pagina caricata. Unità = conversazioni (non messaggi). Conta solo chi
   è partecipante (un manager Società non membro non ha riga: §5); esclude
   l'archivio personale e i GROUP ARCHIVED/eliminati (§13); i SYSTEM_EVENT non
   contano (regola unica). Le Comunicazioni restano nel badge Messaggi, con la
   stessa regola di fetch_communications (destinatario, non letta, club noto). */
create or replace function public.fetch_messages_badge_count()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_conversations integer;
  v_communications integer;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select count(*)::integer into v_conversations
  from public.conversation_participants cp
  where cp.profile_id = v_uid
    and cp.archived_at is null
    and public.footme_conversation_attention_unread(cp.conversation_id, v_uid, 1) > 0;

  select count(*)::integer into v_communications
  from public.communication_recipients r
  join public.communications c on c.id = r.communication_id
  join public.clubs club on club.id = c.sender_club_id
  where r.profile_id = v_uid
    and r.read_at is null;

  return jsonb_build_object(
    'conversation_units',  v_conversations,
    'communication_units', v_communications,
    'total',               v_conversations + v_communications);
end;
$$;

revoke all on function public.fetch_messages_badge_count() from public;
revoke execute on function public.fetch_messages_badge_count() from anon;
grant execute on function public.fetch_messages_badge_count() to authenticated;


-- ============================================================
-- SEZIONE 6 — mute (§5, §9)
-- ============================================================

create or replace function public.fetch_conversation_notification_state(
  p_conversation_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ctx jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_ctx := public.footme_conversation_actor_context(p_conversation_id, v_uid, null, false);

  return public.footme_conversation_notification_state_json(
    p_conversation_id, v_uid, v_ctx ->> 'conversation_type', (v_ctx ->> 'period_id')::uuid);
end;
$$;

revoke all on function public.fetch_conversation_notification_state(uuid) from public;
revoke execute on function public.fetch_conversation_notification_state(uuid) from anon;
grant execute on function public.fetch_conversation_notification_state(uuid) to authenticated;

/* Imposta il mute personale. Durata dal now() del server (1w = 7 giorni).
   Idempotenza (§9): REGISTRO delle operazioni già viste
   (`conversation_mute_operations`), non solo «l'ultima». Il registro si
   scrive PER PRIMO con `on conflict do nothing`: chi trova l'operation id già
   presente (retry dopo risposta persa, anche dopo che un altro dispositivo ha
   applicato altre scelte) riceve l'esito REGISTRATO, senza riapplicare né
   ricalcolare la durata; il client scarta da sé la risposta con
   state_version più vecchio. L'indice unico fa attendere un doppio invio
   concorrente fino al commit del primo. Un operation id già usato da un altro
   profilo o su un'altra conversazione → INVALID_OPERATION_ID.
   Consentito in ARCHIVED, vietato se eliminato; nessun ruolo Società. */
create or replace function public.set_conversation_mute(
  p_conversation_id uuid,
  p_option          text,
  p_operation_id    uuid,
  p_period_id       uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_ctx    jsonb;
  v_period uuid;
  v_option text;
  v_until  timestamptz;
  v_new    integer;
  v_op     record;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_option is null or p_option not in ('active', '1h', '8h', '1w', 'indefinite') then
    raise exception 'INVALID_OPTION';
  end if;

  if p_operation_id is null then
    raise exception 'INVALID_OPERATION_ID';
  end if;

  v_ctx := public.footme_conversation_actor_context(p_conversation_id, v_uid, p_period_id, true);
  v_period := (v_ctx ->> 'period_id')::uuid;

  /* Potatura a lotti piccoli: il registro serve ai retry, non alla storia. */
  delete from public.conversation_mute_operations o
  where o.operation_id in (
    select o2.operation_id
    from public.conversation_mute_operations o2
    where o2.created_at < timezone('utc', now()) - interval '30 days'
    limit 50);

  insert into public.conversation_mute_operations (operation_id, conversation_id, profile_id)
  values (p_operation_id, p_conversation_id, v_uid)
  on conflict (operation_id) do nothing;
  get diagnostics v_new = row_count;

  if v_new = 0 then
    select o.conversation_id, o.profile_id, o.result
    into v_op
    from public.conversation_mute_operations o
    where o.operation_id = p_operation_id;

    if v_op.conversation_id is distinct from p_conversation_id
       or v_op.profile_id is distinct from v_uid then
      raise exception 'INVALID_OPERATION_ID';
    end if;

    return v_op.result;
  end if;

  v_option := case when p_option = 'active' then null else p_option end;
  v_until := case p_option
    when '1h' then now() + interval '1 hour'
    when '8h' then now() + interval '8 hours'
    when '1w' then now() + interval '7 days'
    else null
  end;

  insert into public.conversation_actor_states as st
    (conversation_id, profile_id, period_id, mute_option, mute_until,
     last_mute_operation_id, state_version, updated_at)
  values
    (p_conversation_id, v_uid, v_period, v_option, v_until,
     p_operation_id, nextval('public.conversation_actor_states_version_seq'),
     timezone('utc', now()))
  on conflict (conversation_id, profile_id) do update
    set period_id              = excluded.period_id,
        mute_option            = excluded.mute_option,
        mute_until             = excluded.mute_until,
        last_mute_operation_id = excluded.last_mute_operation_id,
        state_version          = excluded.state_version,
        updated_at             = excluded.updated_at;

  v_result := public.footme_conversation_notification_state_json(
    p_conversation_id, v_uid, v_ctx ->> 'conversation_type', v_period);

  update public.conversation_mute_operations o
  set result = v_result
  where o.operation_id = p_operation_id;

  return v_result;
end;
$$;

revoke all on function public.set_conversation_mute(uuid, text, uuid, uuid) from public;
revoke execute on function public.set_conversation_mute(uuid, text, uuid, uuid) from anon;
grant execute on function public.set_conversation_mute(uuid, text, uuid, uuid) to authenticated;


-- ============================================================
-- SEZIONE 7 — preferenze globali (decisione di Luigi 2026-11-17)
--
-- Colonna NULL = «usa il default del backend» (come HOM-14 §195): i default
-- vivono in app_policy_settings e valgono true se la chiave manca.
-- ============================================================

alter table public.notification_preferences
  add column if not exists push_messages  boolean,
  add column if not exists message_preview boolean;

insert into public.app_policy_settings (key, value, description)
values
  ('notification_push_default.messages', to_jsonb(true),
   'DAS-REV-34 — default push «Messaggi» (ON): DIRECT, GROUP e notifiche strutturali dei gruppi.'),
  ('notification_push_default.message_preview', to_jsonb(true),
   'DAS-REV-34 — default «Mostra anteprima» (ON): il testo del messaggio nella push.')
on conflict (key) do nothing;

/* Riemessa da 20261129090000 (ultima definizione) + i rami 'messages' e
   'message_preview'. Il mapping categoria → colonna sta qui, accanto alle
   colonne. */
create or replace function public.footme_notification_push_enabled(
  p_profile  uuid,
  p_category text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case p_category
        when 'comments_replies'  then np.push_comments_replies
        when 'mentions'          then np.push_mentions
        when 'reposts'           then np.push_reposts
        when 'new_followers'     then np.push_new_followers
        when 'likes'             then np.push_likes
        when 'scheduled_content' then np.push_scheduled_content
        when 'messages'          then np.push_messages
        when 'message_preview'   then np.message_preview
      end
     from public.notification_preferences np
     where np.profile_id = p_profile),
    public.footme_notification_push_default(p_category));
$$;

revoke all on function public.footme_notification_push_enabled(uuid, text) from public;
revoke execute on function public.footme_notification_push_enabled(uuid, text) from anon, authenticated;

/* Riemessa da 20261129090000 (ultima definizione): stessa forma jsonb, più
   `messages` e `message_preview` dentro `push`. Nessuna colonna OUT (trappola
   «returns table + on conflict»), nessuna scrittura in lettura. */
drop function if exists public.fetch_my_notification_preferences();

create or replace function public.fetch_my_notification_preferences()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_np  public.notification_preferences%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_np from public.notification_preferences np where np.profile_id = v_uid;

  return jsonb_build_object(
    'push', jsonb_build_object(
      'comments_replies',  coalesce(v_np.push_comments_replies,  public.footme_notification_push_default('comments_replies')),
      'mentions',          coalesce(v_np.push_mentions,          public.footme_notification_push_default('mentions')),
      'reposts',           coalesce(v_np.push_reposts,           public.footme_notification_push_default('reposts')),
      'new_followers',     coalesce(v_np.push_new_followers,     public.footme_notification_push_default('new_followers')),
      'likes',             coalesce(v_np.push_likes,             public.footme_notification_push_default('likes')),
      'scheduled_content', coalesce(v_np.push_scheduled_content, public.footme_notification_push_default('scheduled_content')),
      'push_messages',     coalesce(v_np.push_messages,          public.footme_notification_push_default('messages')),
      'message_preview',   coalesce(v_np.message_preview,        public.footme_notification_push_default('message_preview'))),
    'other', jsonb_build_object(
      'requests',     coalesce(v_np.requests, true),
      'applications', coalesce(v_np.applications, true),
      'content_tags', coalesce(v_np.content_tags, true),
      'store',        coalesce(v_np.store, true),
      'promotions',   coalesce(v_np.promotions, true)));
end;
$$;

revoke all on function public.fetch_my_notification_preferences() from public;
revoke execute on function public.fetch_my_notification_preferences() from anon;
grant execute on function public.fetch_my_notification_preferences() to authenticated;

/* Riemessa da 20261129090000 (ultima definizione) + 'messages' (alias di
   push_messages), 'push_messages' e 'message_preview'. La colonna è scelta da
   un CASE, mai interpolata dal testo del chiamante. */
create or replace function public.set_notification_preference(
  p_key   text,
  p_value boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_col text;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_value is null then
    raise exception 'Valore preferenza non valido' using errcode = '22023';
  end if;

  v_col := case p_key
    when 'requests'          then 'requests'
    when 'applications'      then 'applications'
    when 'content_tags'      then 'content_tags'
    when 'store'             then 'store'
    when 'promotions'        then 'promotions'
    when 'comments_replies'  then 'push_comments_replies'
    when 'mentions'          then 'push_mentions'
    when 'reposts'           then 'push_reposts'
    when 'new_followers'     then 'push_new_followers'
    when 'likes'             then 'push_likes'
    when 'scheduled_content' then 'push_scheduled_content'
    when 'messages'          then 'push_messages'
    when 'push_comments_replies'  then 'push_comments_replies'
    when 'push_mentions'          then 'push_mentions'
    when 'push_reposts'           then 'push_reposts'
    when 'push_new_followers'     then 'push_new_followers'
    when 'push_likes'             then 'push_likes'
    when 'push_scheduled_content' then 'push_scheduled_content'
    when 'push_messages'          then 'push_messages'
    when 'message_preview'        then 'message_preview'
  end;

  if v_col is null then
    raise exception 'Chiave preferenza non valida: %', p_key using errcode = '22023';
  end if;

  insert into public.notification_preferences as np (profile_id)
  values (v_uid)
  on conflict (profile_id) do nothing;

  execute format(
    'update public.notification_preferences set %I = $1 where profile_id = $2', v_col)
  using p_value, v_uid;
end;
$$;

revoke all on function public.set_notification_preference(text, boolean) from public;
revoke execute on function public.set_notification_preference(text, boolean) from anon;
grant execute on function public.set_notification_preference(text, boolean) to authenticated;


-- ============================================================
-- SEZIONE 8 — resolver dei deep link (§21)
--
-- Un id nella push o nella riga campanella non è una capability: l'esito si
-- decide qui, col periodo e l'intento. La risposta non contiene nomi né body.
--   outcome: open | info | revoked | deleted | unavailable
--   intent:  message | added | role | lifecycle | removed | deleted
-- ============================================================

create or replace function public.resolve_conversation_target(
  p_conversation_id uuid,
  p_period_id       uuid default null,
  p_intent          text default 'message'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_type    text;
  v_period  uuid;
  v_member  boolean;
  v_related boolean;
  v_deleted boolean;
  v_intent  text := coalesce(p_intent, 'message');
  v_outcome text;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if v_intent not in ('message', 'added', 'role', 'lifecycle', 'removed', 'deleted') then
    v_intent := 'message';
  end if;

  select c.conversation_type into v_type
  from public.conversations c
  where c.id = p_conversation_id;

  if v_type is null then
    return jsonb_build_object('outcome', 'unavailable',
      'conversation_id', p_conversation_id, 'conversation_type', null, 'period_id', null);
  end if;

  select cp.period_id into v_period
  from public.conversation_participants cp
  where cp.conversation_id = p_conversation_id
    and cp.profile_id = v_uid;
  v_member := found;

  if v_type <> 'group' then
    /* DIRECT: il partecipante apre, chiunque altro non vede nulla. */
    v_outcome := case
      when v_member and p_period_id is null then 'open'
      else 'unavailable' end;
    /* Il tipo si rivela solo a chi è partecipante: a un estraneo un id non dice nulla. */
    return jsonb_build_object('outcome', v_outcome,
      'conversation_id', p_conversation_id,
      'conversation_type', case when v_member then v_type end,
      'period_id', null);
  end if;

  v_related := v_member or exists (
    select 1 from public.society_group_membership_periods per
    where per.conversation_id = p_conversation_id and per.profile_id = v_uid
  );

  if not v_related then
    return jsonb_build_object('outcome', 'unavailable',
      'conversation_id', p_conversation_id, 'conversation_type', null, 'period_id', null);
  end if;

  select exists (
    select 1 from public.society_groups g
    where g.conversation_id = p_conversation_id and g.deleted_at is not null
  ) into v_deleted;

  v_outcome := case
    when v_deleted or v_intent = 'deleted' then 'deleted'
    when v_intent = 'removed' or not v_member then 'revoked'
    when p_period_id is not null and v_period is distinct from p_period_id then 'unavailable'
    when v_intent = 'role' then 'info'
    else 'open'
  end;

  return jsonb_build_object(
    'outcome',           v_outcome,
    'conversation_id',   p_conversation_id,
    'conversation_type', v_type,
    'period_id',       case when v_outcome in ('open', 'info') then v_period end);
end;
$$;

revoke all on function public.resolve_conversation_target(uuid, uuid, text) from public;
revoke execute on function public.resolve_conversation_target(uuid, uuid, text) from anon;
grant execute on function public.resolve_conversation_target(uuid, uuid, text) to authenticated;
