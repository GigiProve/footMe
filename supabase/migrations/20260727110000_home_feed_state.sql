-- ============================================================
-- HOME-01 — Home/Feed Blocco 1: preferenze e modulo di primo accesso
--
-- Schema sources reused (verified against the actual migrations before
-- writing this file):
--   20260719090000_notification_preferences.sql  struttura tabella + 3 policy
--                                                owner + trigger set_updated_at
--                                                + RPC con insert lazy
--   20260309000000_initial_schema.sql            public.set_updated_at(),
--                                                profiles.is_open_to_transfer
--   20260309000001_rls_policies.sql              public.is_current_user()
--   20260318000000/20260318000001                player_profiles.primary_position
--   20260515020000_fan_community_profile.sql     profile_follows
--   20260411100000_remote_schema_sync.sql        club_follows
--
-- COSA FA IL MODULO DI PRIMO ACCESSO (§6) E COSA NON FA
--
-- Le 4 preferenze (Calciatori / Società / Posizioni aperte / Media locali)
-- NON sono filtri del Feed. Il §6 è esplicito: servono solo a migliorare i
-- *primi* suggerimenti quando l'utente non segue ancora nessuno, ha un
-- profilo incompleto o non ha generato abbastanza segnali.
--
-- Il vincolo è reso strutturale in tre modi, tutti verificabili leggendo la
-- spina in 20260727120000_home_feed_rpcs.sql:
--
--  1. ADDITIVE, MAI SOTTRATTIVE. Le preferenze non compaiono in nessun
--     WHERE. Alzano l'affinità di un solo passo (`greatest(affinity, 1)`),
--     quindi una preferenza non può mai superare un follow reale. L'unica
--     eccezione è `wants_positions`, che *abilita* la sorgente posizioni per
--     i ruoli in cui è spenta di default (fan, media): anche quella è
--     un'inclusione, non un filtro.
--  2. A TEMPO. set_feed_preferences scrive `applies_until = now() + 14
--     giorni`. La spina calcola `pref_active := applies_until > as_of`: alla
--     scadenza il boost smette da solo, senza che nessuno debba ricordarsene.
--     È letteralmente "migliora i primi suggerimenti".
--  3. NON OCCUPANO IL FEED. `intro_state <> 'pending'` ⇒ il modulo non viene
--     più restituito, quindi non può occupare permanentemente il Feed.
--
-- `wants_players` non ha effetto sui contenuti: nessuna delle 5 superfici di
-- contenuto è pubblicata da un profilo calciatore (club_media viene dalle
-- società, media_profile/media_tribuna dai profili Media, fan_tribuna/
-- fan_media dai profili tifoso). Influenza solo
-- fetch_home_suggested_profiles. Documentarlo qui evita che qualcuno lo
-- cerchi nella spina convinto che sia stato dimenticato.
--
-- DEFAULT `false` E NON ALL-TRUE (deviazione da notification_preferences)
--
-- notification_preferences usa default all-true perché una preferenza di
-- notifica ha semantica opt-out: riga assente ≡ "consegna". Qui la semantica
-- è opposta: una riga assente e una riga tutta-false devono essere
-- indistinguibili, cioè "nessun segnale espresso". Con default true l'RPC
-- inventerebbe quattro preferenze che l'utente non ha mai dato, e le userebbe
-- per alzare l'affinità: esattamente il filtro implicito che il §6 vieta.
--
-- NESSUNA TABELLA `feed_seen_items`
--
-- §26 elenca lo "stato visualizzato" tra i campi dell'elemento e §27 chiede
-- di memorizzare *localmente* i contenuti già visti nella sessione. Per il
-- Blocco 1 il tracciamento resta solo client-side (Set di sessione + mirror
-- AsyncStorage): la spina espone `is_seen` costante false, così il contratto
-- del §26 esiste e può essere riempito in seguito senza cambiare firma, ma
-- non si introduce una tabella a crescita illimitata che richiederebbe subito
-- un job di retention.
-- ============================================================


-- ============================================================
-- SECTION 1: tabella public.feed_preferences
-- ============================================================

create table if not exists public.feed_preferences (
  profile_id        uuid primary key references public.profiles(id) on delete cascade,
  wants_players     boolean not null default false,
  wants_clubs       boolean not null default false,
  wants_positions   boolean not null default false,
  wants_local_media boolean not null default false,
  intro_state       text    not null default 'pending',
  intro_resolved_at timestamptz,
  applies_until     timestamptz,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now()),
  constraint feed_preferences_intro_state_check
    check (intro_state in ('pending', 'completed', 'skipped'))
);

alter table public.feed_preferences enable row level security;

drop policy if exists "owner reads own feed preferences" on public.feed_preferences;
create policy "owner reads own feed preferences"
on public.feed_preferences
for select
to authenticated
using (public.is_current_user(profile_id));

drop policy if exists "owner inserts own feed preferences" on public.feed_preferences;
create policy "owner inserts own feed preferences"
on public.feed_preferences
for insert
to authenticated
with check (public.is_current_user(profile_id));

drop policy if exists "owner updates own feed preferences" on public.feed_preferences;
create policy "owner updates own feed preferences"
on public.feed_preferences
for update
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop trigger if exists feed_preferences_set_updated_at on public.feed_preferences;
create trigger feed_preferences_set_updated_at
before update on public.feed_preferences
for each row execute function public.set_updated_at();


-- ============================================================
-- SECTION 2: RPC public.fetch_my_feed_preferences
--
-- Riga singola del chiamante, creandola con i default se manca: il client non
-- deve mai gestire il caso "preferenze non ancora esistenti".
--
-- NON si restituisce `profile_id`: una colonna OUT con quel nome diventa una
-- variabile PL/pgSQL e rende ambigua la clausola `on conflict (profile_id)`
-- ("column reference profile_id is ambiguous"), facendo fallire la funzione a
-- runtime. Il chiamante è sempre il proprietario della riga, quindi la colonna
-- sarebbe comunque ridondante.
-- ============================================================

drop function if exists public.fetch_my_feed_preferences();

create or replace function public.fetch_my_feed_preferences()
returns table (
  wants_players     boolean,
  wants_clubs       boolean,
  wants_positions   boolean,
  wants_local_media boolean,
  intro_state       text,
  intro_resolved_at timestamptz,
  applies_until     timestamptz
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

  insert into public.feed_preferences (profile_id)
  values (v_uid)
  on conflict (profile_id) do nothing;

  return query
  select
    fp.wants_players,
    fp.wants_clubs,
    fp.wants_positions,
    fp.wants_local_media,
    fp.intro_state,
    fp.intro_resolved_at,
    fp.applies_until
  from public.feed_preferences fp
  where fp.profile_id = v_uid;
end;
$$;

revoke all on function public.fetch_my_feed_preferences() from public;
grant execute on function public.fetch_my_feed_preferences() to authenticated;


-- ============================================================
-- SECTION 3: RPC public.set_feed_preferences
--
-- Deviazione da set_notification_preference(p_key, p_value): setter a quattro
-- argomenti fissi invece di uno per-chiave con `format('... %I ...')`, perché
-- il modulo di primo accesso invia tutte e quattro le opzioni dietro un'unica
-- CTA "Personalizza Feed". Non essendoci SQL dinamico, questa forma è più
-- sicura del pattern che sostituisce, non meno.
--
-- `applies_until` è ciò che rende il boost temporaneo (vedi header, punto 2).
-- ============================================================

drop function if exists public.set_feed_preferences(boolean, boolean, boolean, boolean);

create or replace function public.set_feed_preferences(
  p_wants_players     boolean,
  p_wants_clubs       boolean,
  p_wants_positions   boolean,
  p_wants_local_media boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  insert into public.feed_preferences (
    profile_id,
    wants_players,
    wants_clubs,
    wants_positions,
    wants_local_media,
    intro_state,
    intro_resolved_at,
    applies_until
  )
  values (
    v_uid,
    coalesce(p_wants_players, false),
    coalesce(p_wants_clubs, false),
    coalesce(p_wants_positions, false),
    coalesce(p_wants_local_media, false),
    'completed',
    v_now,
    v_now + interval '14 days'
  )
  on conflict (profile_id) do update set
    wants_players     = coalesce(p_wants_players, false),
    wants_clubs       = coalesce(p_wants_clubs, false),
    wants_positions   = coalesce(p_wants_positions, false),
    wants_local_media = coalesce(p_wants_local_media, false),
    intro_state       = 'completed',
    intro_resolved_at = v_now,
    applies_until     = v_now + interval '14 days';
end;
$$;

revoke all on function public.set_feed_preferences(boolean, boolean, boolean, boolean) from public;
grant execute on function public.set_feed_preferences(boolean, boolean, boolean, boolean) to authenticated;


-- ============================================================
-- SECTION 4: RPC public.dismiss_feed_intro
--
-- "Lo farò più tardi" (§6): il modulo sparisce dal Feed ma non lascia alcun
-- boost, perché l'utente non ha espresso preferenze. `applies_until` viene
-- azzerato proprio per questo.
-- ============================================================

drop function if exists public.dismiss_feed_intro();

create or replace function public.dismiss_feed_intro()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  insert into public.feed_preferences (profile_id, intro_state, intro_resolved_at, applies_until)
  values (v_uid, 'skipped', v_now, null)
  on conflict (profile_id) do update set
    intro_state       = 'skipped',
    intro_resolved_at = v_now,
    applies_until     = null;
end;
$$;

revoke all on function public.dismiss_feed_intro() from public;
grant execute on function public.dismiss_feed_intro() to authenticated;


-- ============================================================
-- SECTION 5: RPC public.fetch_my_feed_intro
--
-- Restituisce le 4 opzioni del modulo con etichetta italiana, stato iniziale
-- suggerito e il flag `is_derivable`, più gli scalari `intro_state` e
-- `should_show` ripetuti su ogni riga (stessa tecnica di `total_count`).
--
-- `is_derivable` implementa il §7 ("non richiedere nuovamente informazioni
-- già presenti nel profilo") LATO SERVER, così il client non ospita nessuna
-- euristica sul modello dei dati:
--   wants_positions   ← ha una posizione primaria oppure è aperto al
--                       trasferimento
--   wants_clubs       ← segue già almeno una società
--   wants_local_media ← segue già almeno un profilo Media
--   wants_players     ← il ruolo implica interesse per i calciatori
--                       (agent, director, club_admin, coach)
--
-- Se tutte e quattro sono derivabili, il modulo non ha nulla da chiedere:
-- l'RPC chiude da sola l'intro con `completed` e restituisce
-- `should_show = false`. Il profilo fornisce già i segnali.
--
-- `should_show` è vero anche per un `skipped` più vecchio di 30 giorni:
-- "Lo farò più tardi" significa più tardi, non mai. Resta compatibile col §6
-- ("dopo il completamento o la chiusura il modulo non deve occupare
-- permanentemente il Feed") perché tra una riproposta e l'altra passa un mese.
-- ============================================================

drop function if exists public.fetch_my_feed_intro();

create or replace function public.fetch_my_feed_intro()
returns table (
  pref_key     text,
  label        text,
  prefill      boolean,
  is_derivable boolean,
  intro_state  text,
  should_show  boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid                uuid := auth.uid();
  v_now                timestamptz := timezone('utc', now());
  v_role               text;
  v_derive_positions   boolean;
  v_derive_clubs       boolean;
  v_derive_local_media boolean;
  v_derive_players     boolean;
  v_state              text;
  v_resolved_at        timestamptz;
  v_should_show        boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  insert into public.feed_preferences (profile_id)
  values (v_uid)
  on conflict (profile_id) do nothing;

  select p.role::text into v_role from public.profiles p where p.id = v_uid;

  v_derive_positions := exists (
    select 1 from public.player_profiles pp
    where pp.profile_id = v_uid and pp.primary_position is not null
  ) or exists (
    select 1 from public.profiles p
    where p.id = v_uid and coalesce(p.is_open_to_transfer, false)
  );

  v_derive_clubs := exists (
    select 1 from public.club_follows cf where cf.profile_id = v_uid
  );

  v_derive_local_media := exists (
    select 1
    from public.profile_follows pf
    join public.profiles fp on fp.id = pf.followed_profile_id
    where pf.follower_profile_id = v_uid and fp.role = 'media'
  );

  v_derive_players := coalesce(v_role, '') in ('agent', 'director', 'club_admin', 'coach');

  select fp.intro_state, fp.intro_resolved_at
  into v_state, v_resolved_at
  from public.feed_preferences fp
  where fp.profile_id = v_uid;

  -- Il profilo risponde già a tutte e quattro le domande: niente da chiedere.
  if v_state = 'pending'
     and v_derive_positions and v_derive_clubs
     and v_derive_local_media and v_derive_players then
    update public.feed_preferences fp
    set intro_state = 'completed', intro_resolved_at = v_now
    where fp.profile_id = v_uid;

    v_state := 'completed';
    v_resolved_at := v_now;
  end if;

  v_should_show :=
    v_state = 'pending'
    or (v_state = 'skipped' and coalesce(v_resolved_at, v_now) < v_now - interval '30 days');

  return query
  select
    o.pref_key,
    o.label,
    o.prefill,
    o.is_derivable,
    v_state       as intro_state,
    v_should_show as should_show
  from (
    values
      ('wants_players',     'Calciatori',        v_derive_players,     v_derive_players),
      ('wants_clubs',       'Società',           v_derive_clubs,       v_derive_clubs),
      ('wants_positions',   'Posizioni aperte',  v_derive_positions,   v_derive_positions),
      ('wants_local_media', 'Media locali',      v_derive_local_media, v_derive_local_media)
  ) as o(pref_key, label, prefill, is_derivable);
end;
$$;

revoke all on function public.fetch_my_feed_intro() from public;
grant execute on function public.fetch_my_feed_intro() to authenticated;
