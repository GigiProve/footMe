-- ============================================================
-- HOM-12 — Blocca / Sblocca Profilo (identity-level): dati, RPC, enforcement
--
-- COSA MANCAVA (spec HOM-12 §1-§6, §29-§34, §166)
--
-- Il blocco esistente (MES-02, 20260718090400) è a livello ACCOUNT: una coppia
-- di uuid `user_blocks(blocker_profile_id, blocked_profile_id)`, hard delete,
-- scritta da `block_user/unblock_user`, riconosciuta solo da Messaggi, Feed,
-- qualche suggerimento e alcune superfici Dashboard. Mancavano:
--   1. il blocco tra IDENTITY (PERSON / SOCIETY / MEDIA, §1-§2): una Società
--      non poteva bloccare né essere bloccata, e bloccare la Società propagava
--      al titolare (footme_publisher_blocked, footme_like_actor_visible leggono
--      `clubs.owner_profile_id`), contro §3-§6 e §127;
--   2. un modello con block_id, stato e removed_at (§29), unico per coppia
--      orientata (§30), sbloccabile solo dal blocker (§33) e non cancellato
--      (soft remove);
--   3. la capability `can_block_identity` (§11-§12): una Società può bloccare
--      solo con una chiave esplicita nel catalogo DAS-REV-14;
--   4. lo storico dei Follow interrotti (§37) senza ripristino (§40, §253);
--   5. enforcement server-side oggi ASSENTE su Cerca (search_global,
--      search_profiles_page, search_clubs_page, search_media_*,
--      search_positions_page), mention (search_tag_targets), Follow (scritture
--      dirette sulle tabelle), destinatari Share, soglie Notifiche, dettaglio e
--      candidatura Posizione, e per le Società su Feed, suggerimenti e Repost.
--   6. un cancello di disponibilità del profilo (§79-§85, §173-§175) con stati
--      neutri per il bloccato.
--
-- DECISIONI (Luigi 2026-11-16, vincolanti)
--   D1 le superfici personali usano l'identità persona/media dell'account
--      (auth.uid); un blocco «come Società» vale come TARGET ovunque e come
--      BLOCKER nelle superfici Dashboard-Società. D2 propagazione
--      Società → titolare RIMOSSA. D3 `can_block_identity`: titolare implicito
--      (come ogni chiave, footme_actor_club_permission), admin solo con
--      concessione esplicita, nessun default, nessun backfill. Media: l'account.
--   Prese dall'implementatore: D5 block_user/unblock_user restano come wrapper
--   deprecati; D6 sblocca un blocco Società qualunque account che oggi ha
--   `can_block_identity` su quella Società; D7 la lista Profili bloccati
--   mostra i blocchi della persona/media dell'account + quelli delle Società su
--   cui ha la capability; D11 followers/mutual escludono le identità bloccate.
--
-- PERCHÉ QUESTA SOLUZIONE
--   * UNA sola tabella evoluta (`user_blocks` → `identity_blocks`), non un
--     secondo core. `user_blocks` resta come VISTA di compatibilità (righe
--     attive tra person/media, stesse tre colonne): le ~35 funzioni che la
--     nominano continuano a compilare e a vedere i blocchi persona/media senza
--     riemissione. La vista NON mostra i blocchi con una Società: per quelli
--     servono i nuovi helper, e sono riemesse solo le funzioni che toccano
--     identità Società (feed, readability, ricerca, share, follow, profili).
--   * Un solo predicato: `footme_identity_blocked(viewer, tipo, id)` (puntuale)
--     e `footme_blocked_keys(viewer)` (insieme, per anti-join nel Feed, §190-§191:
--     nessuna query per riga). I due helper e `footme_publisher_blocked` /
--     `footme_like_actor_visible` sono il punto unico: readability di contenuti,
--     commenti, Like, Repost e reference HOM-10 ne ereditano senza riemissione.
--   * RLS attiva sulle tabelle del blocco, NESSUN grant ai client: tutto passa
--     da RPC. RLS filtra righe non colonne, per questo la tabella non è
--     leggibile nemmeno dal blocker via PostgREST (il bloccato non deve poter
--     dedurre nulla, §82).
--   * Follow: il blocco è un dominio separato (§166) che CANCELLA i Follow attivi
--     nella stessa transazione e li registra in
--     `identity_block_severed_follows` (mai letta per ripristinare). Un trigger
--     BEFORE INSERT su profile_follows/club_follows, con lo stesso advisory
--     lock della coppia usato da block_identity, rifiuta nuovi Follow durante il
--     blocco e chiude la race §45 (un trigger solo invece di policy duplicate:
--     copre anche scritture definer).
--   * Messaggi: policy messages/storage chiamano già is_direct_conversation_blocked
--     che legge `user_blocks` (vista): invariate. Errore al send: violazione RLS
--     42501 su `messages` (invariato, §112). Un blocco con Società non tocca le
--     DIRECT (conversazioni tra account).
--   * Nessuna notifica di blocco, nessun report, nessun effetto su
--     feed_not_interested/moderation_reports (§138, §169-§170).
--
-- NOTA SICUREZZA: footme_block_canonical_type e footme_blocker_club_ids (che leggono
--   `clubs`) sono SECURITY INVOKER e chiuse a public/anon/authenticated: le chiamano
--   solo RPC definer (girano come proprietario), non sono una porta di lettura di
--   `clubs` per i client.
--
-- LIMITI DICHIARATI
--   * Profilo persona: nessuna RPC di lettura, il cancello è
--     `fetch_profile_availability` chiamato dal client (D4); un client ostile
--     può ancora leggere i dati pubblici persona via PostgREST.
--   * La concorrenza reale non è riproducibile in PGlite: la race Follow/Block è
--     coperta dal lock + dal controllo sotto lock, verificato in sequenza.
-- ============================================================

-- ============================================================
-- SEZIONE 1 — tabella evoluta + vista di compatibilità
-- ============================================================

-- Rieseguibile: il rename avviene solo se user_blocks è ancora la tabella.
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relname = 'user_blocks' and c.relkind = 'r') then
    drop policy if exists "blocker can view own blocks" on public.user_blocks;
    alter table public.user_blocks rename to identity_blocks;
  end if;
end
$$;

alter table public.identity_blocks
  add column if not exists block_id uuid not null default gen_random_uuid(),
  add column if not exists blocker_identity_type text,
  add column if not exists blocker_identity_id uuid,
  add column if not exists blocked_identity_type text,
  add column if not exists blocked_identity_id uuid,
  add column if not exists acted_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists status text not null default 'active',
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by_profile_id uuid references public.profiles(id) on delete set null;

-- Backfill: i blocchi esistenti sono tra account; 'media' se l'account ha una
-- riga media_profiles, altrimenti 'person'.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'identity_blocks' and column_name = 'blocker_profile_id') then
    update public.identity_blocks b
       set blocker_identity_id   = b.blocker_profile_id,
           blocked_identity_id   = b.blocked_profile_id,
           acted_by_profile_id   = b.blocker_profile_id,
           blocker_identity_type = case when exists (select 1 from public.media_profiles m where m.profile_id = b.blocker_profile_id) then 'media' else 'person' end,
           blocked_identity_type = case when exists (select 1 from public.media_profiles m where m.profile_id = b.blocked_profile_id) then 'media' else 'person' end
     where b.blocker_identity_id is null;
  end if;
end
$$;

alter table public.identity_blocks
  alter column blocker_identity_type set not null,
  alter column blocker_identity_id   set not null,
  alter column blocked_identity_type set not null,
  alter column blocked_identity_id   set not null;

-- Le colonne profilo (e con loro PK, FK, check not_self e indice) escono: la
-- vista `user_blocks` le riespone.
alter table public.identity_blocks
  drop column if exists blocker_profile_id,
  drop column if exists blocked_profile_id;

alter table public.identity_blocks
  drop constraint if exists identity_blocks_blocker_type_check,
  drop constraint if exists identity_blocks_blocked_type_check,
  drop constraint if exists identity_blocks_status_check,
  drop constraint if exists identity_blocks_removed_check,
  drop constraint if exists identity_blocks_not_self;
alter table public.identity_blocks
  add constraint identity_blocks_blocker_type_check check (blocker_identity_type in ('person', 'society', 'media')),
  add constraint identity_blocks_blocked_type_check check (blocked_identity_type in ('person', 'society', 'media')),
  add constraint identity_blocks_status_check check (status in ('active', 'removed')),
  add constraint identity_blocks_removed_check check ((status = 'removed') = (removed_at is not null)),
  add constraint identity_blocks_not_self check (
    not (blocker_identity_type = blocked_identity_type and blocker_identity_id = blocked_identity_id));

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.identity_blocks'::regclass and contype = 'p') then
    alter table public.identity_blocks add constraint identity_blocks_pkey primary key (block_id);
  end if;
end
$$;

-- §30: al massimo un blocco ATTIVO per coppia orientata.
create unique index if not exists identity_blocks_active_pair_uidx
  on public.identity_blocks (blocker_identity_type, blocker_identity_id, blocked_identity_type, blocked_identity_id)
  where status = 'active';
create index if not exists identity_blocks_blocked_active_idx
  on public.identity_blocks (blocked_identity_id) where status = 'active';
create index if not exists identity_blocks_blocker_active_idx
  on public.identity_blocks (blocker_identity_id, created_at desc, block_id) where status = 'active';

alter table public.identity_blocks enable row level security;
revoke all on public.identity_blocks from public, anon, authenticated;

create or replace view public.user_blocks as
  select b.blocker_identity_id as blocker_profile_id,
         b.blocked_identity_id as blocked_profile_id,
         b.created_at
    from public.identity_blocks b
   where b.status = 'active'
     and b.blocker_identity_type in ('person', 'media')
     and b.blocked_identity_type in ('person', 'media');
revoke all on public.user_blocks from public, anon, authenticated;

-- §37: storia dei Follow interrotti. Scritta solo da block_identity, mai letta
-- per ripristinare (§40, §253).
create table if not exists public.identity_block_severed_follows (
  id             uuid primary key default gen_random_uuid(),
  block_id       uuid not null references public.identity_blocks(block_id) on delete cascade,
  follower_type  text not null check (follower_type in ('person', 'society', 'media')),
  follower_id    uuid not null,
  followed_type  text not null check (followed_type in ('person', 'society', 'media')),
  followed_id    uuid not null,
  followed_since timestamptz,
  severed_at     timestamptz not null default timezone('utc', now())
);
create index if not exists identity_block_severed_follows_block_idx
  on public.identity_block_severed_follows (block_id);
alter table public.identity_block_severed_follows enable row level security;
revoke all on public.identity_block_severed_follows from public, anon, authenticated;

-- Senza FK verso profiles/clubs (identità di tre tipi): i blocchi seguono la
-- vita dell'identità con due trigger.
create or replace function public.identity_blocks_on_identity_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.identity_blocks b
   where (tg_table_name = 'profiles'
          and ((b.blocker_identity_type in ('person', 'media') and b.blocker_identity_id = old.id)
            or (b.blocked_identity_type in ('person', 'media') and b.blocked_identity_id = old.id)))
      or (tg_table_name = 'clubs'
          and ((b.blocker_identity_type = 'society' and b.blocker_identity_id = old.id)
            or (b.blocked_identity_type = 'society' and b.blocked_identity_id = old.id)));
  return old;
end;
$$;
revoke all on function public.identity_blocks_on_identity_delete() from public, anon, authenticated;

drop trigger if exists identity_blocks_profile_delete on public.profiles;
create trigger identity_blocks_profile_delete after delete on public.profiles
  for each row execute function public.identity_blocks_on_identity_delete();
drop trigger if exists identity_blocks_club_delete on public.clubs;
create trigger identity_blocks_club_delete after delete on public.clubs
  for each row execute function public.identity_blocks_on_identity_delete();

-- ============================================================
-- SEZIONE 2 — helper (definer, search_path public, nessuna lettura di clubs
-- tranne footme_blocker_club_ids che restituisce solo gli id dell'attore)
-- ============================================================

create or replace function public.footme_block_viewer_identity(p_viewer uuid)
returns table(v_type text, v_id uuid)
language sql stable security definer set search_path = public
as $$
  select case when exists (select 1 from public.media_profiles m where m.profile_id = p_viewer)
              then 'media' else 'person' end, p_viewer
  where p_viewer is not null;
$$;

-- Puntuale e simmetrico: esiste un blocco attivo tra l'identità del viewer
-- (persona/media) e l'identità (tipo, id) in una qualunque direzione. 'person'
-- e 'media' sono equivalenti (entrambi profiles.id); 'society' è distinto.
create or replace function public.footme_identity_blocked(p_viewer uuid, p_type text, p_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_viewer is not null and p_id is not null and p_id <> p_viewer and exists (
    select 1 from public.identity_blocks b
    where b.status = 'active'
      and (
        (b.blocker_identity_type in ('person', 'media') and b.blocker_identity_id = p_viewer
          and (b.blocked_identity_type = 'society') = (p_type = 'society') and b.blocked_identity_id = p_id)
        or
        (b.blocked_identity_type in ('person', 'media') and b.blocked_identity_id = p_viewer
          and (b.blocker_identity_type = 'society') = (p_type = 'society') and b.blocker_identity_id = p_id)));
$$;

-- Insieme, per anti-join (§190-§191). b_kind: 'profile' (person+media) | 'society'.
create or replace function public.footme_blocked_keys(p_viewer uuid)
returns table(b_kind text, b_id uuid)
language sql stable security definer set search_path = public
as $$
  select case when b.blocked_identity_type = 'society' then 'society' else 'profile' end, b.blocked_identity_id
    from public.identity_blocks b
   where p_viewer is not null and b.status = 'active'
     and b.blocker_identity_type in ('person', 'media') and b.blocker_identity_id = p_viewer
  union
  select case when b.blocker_identity_type = 'society' then 'society' else 'profile' end, b.blocker_identity_id
    from public.identity_blocks b
   where p_viewer is not null and b.status = 'active'
     and b.blocked_identity_type in ('person', 'media') and b.blocked_identity_id = p_viewer;
$$;

-- Società su cui l'attore può bloccare (titolare, o chiave esplicita attiva).
-- Solo id dell'attore stesso: nessun dato della Società esce.
create or replace function public.footme_blocker_club_ids(p_actor uuid)
returns table(c_id uuid)
language sql stable security invoker set search_path = public
as $$
  select c.id from public.clubs c where p_actor is not null and c.owner_profile_id = p_actor
  union
  select perm.club_id from public.club_member_permissions perm
   where p_actor is not null and perm.profile_id = p_actor
     and perm.permission_key = 'can_block_identity'
     and public.club_access_is_active(perm.club_id, p_actor);
$$;

-- Lock di coppia condiviso da block_identity e dal trigger Follow (§45).
create or replace function public.footme_block_pair_lock(p_a_kind text, p_a uuid, p_b_kind text, p_b uuid)
returns void
language plpgsql
as $$
declare
  v_a text := case when p_a_kind = 'society' then 'society' else 'profile' end || ':' || p_a::text;
  v_b text := case when p_b_kind = 'society' then 'society' else 'profile' end || ':' || p_b::text;
begin
  perform pg_advisory_xact_lock(hashtextextended(least(v_a, v_b) || '|' || greatest(v_a, v_b), 12));
end;
$$;

-- ============================================================
-- SEZIONE 3 — catalogo permessi DAS-REV-14, revisione 10 (D3)
-- Chiave `can_block_identity`, area nuova `identity_safety` (scope society),
-- controllo omonimo. Nessun ruolo esistente la riceve, nessun backfill: il
-- titolare la ha implicita, un admin solo se l'editor ruoli gliela concede.
-- Le due whitelist si ricostruiscono da quelle VIVE (nessuna lista copiata).
-- ============================================================

do $$
declare
  v_tbl text;
  v_con text;
  v_def text;
  v_keys text[];
begin
  foreach v_tbl in array array['club_member_permissions', 'club_admin_role_permissions'] loop
    v_con := v_tbl || '_key_check';
    select pg_get_constraintdef(c.oid) into v_def
      from pg_constraint c
     where c.conname = v_con and c.conrelid = ('public.' || v_tbl)::regclass;
    v_keys := string_to_array(substring(v_def from '\{([^}]*)\}'), ',');
    if v_keys is null or array_length(v_keys, 1) < 50 then
      raise exception 'whitelist % non riconosciuta: %', v_con, v_def;
    end if;
    if not ('can_block_identity' = any (v_keys)) then
      v_keys := v_keys || 'can_block_identity'::text;
    end if;
    execute format('alter table public.%I drop constraint %I', v_tbl, v_con);
    execute format('alter table public.%I add constraint %I check (permission_key = any (%L::text[]))', v_tbl, v_con, v_keys);
  end loop;
end
$$;

insert into public.club_permission_areas (id, label, description, sort_order, scope_kind, is_available) values
  ('identity_safety', 'Sicurezza dei profili',
     'Blocco di persone, società e pagine Media a nome della società.', 12, 'society', true)
on conflict (id) do update
  set label = excluded.label, description = excluded.description, sort_order = excluded.sort_order,
      scope_kind = excluded.scope_kind, is_available = excluded.is_available;

insert into public.club_permission_controls (id, area_id, label, helper, bundle, requires, sort_order, is_available) values
  ('can_block_identity', 'identity_safety', 'Bloccare profili a nome della società', null,
     'manage', array[]::text[], 1, true)
on conflict (id) do update
  set area_id = excluded.area_id, label = excluded.label, helper = excluded.helper, bundle = excluded.bundle,
      requires = excluded.requires, sort_order = excluded.sort_order, is_available = excluded.is_available;

insert into public.club_permission_control_keys (control_id, permission_key) values
  ('can_block_identity', 'can_block_identity')
on conflict do nothing;

insert into public.app_policy_settings (key, value, description)
values ('admin_permission_catalog_revision', to_jsonb(10),
  'DAS-REV-14 §7 — revisione della tassonomia aree/controlli/chiavi. Va incrementata da ogni migrazione che cambia il catalogo.')
on conflict (key) do update set value = to_jsonb(10);

-- ============================================================
-- SEZIONE 4 — RPC del blocco (definer, auth.uid() nel corpo)
--
-- Tipi canonici: 'person' | 'media' (profiles.id; 'media' se esiste una riga
-- media_profiles) | 'society' (clubs.id). Un client che dichiara 'person' per un
-- profilo Media (o viceversa) viene canonicalizzato, non rifiutato.
-- ============================================================

create or replace function public.footme_block_canonical_type(p_type text, p_id uuid)
returns text
language sql stable security invoker set search_path = public
as $$
  select case
    when p_type = 'society' then case when exists (select 1 from public.clubs c where c.id = p_id) then 'society' end
    when p_type in ('person', 'media') then
      case when exists (select 1 from public.profiles p where p.id = p_id)
           then case when exists (select 1 from public.media_profiles m where m.profile_id = p_id) then 'media' else 'person' end
      end
  end;
$$;

create or replace function public.block_identity(
  p_operation_key uuid,
  p_blocker_type text,
  p_blocker_id uuid,
  p_target_type text,
  p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bt text := lower(coalesce(p_blocker_type, ''));
  v_tt text := lower(coalesce(p_target_type, ''));
  v_block_id uuid;
  v_at timestamptz;
  v_existing record;
  v_f record;
  v_blocker_profile uuid;
  v_target_profile uuid;
  v_club uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if v_bt not in ('person', 'media', 'society') or v_tt not in ('person', 'media', 'society')
     or p_blocker_id is null or p_target_id is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- Blocker (§8, §11-§13): la persona/media è l'account stesso; una Società
  -- richiede `can_block_identity` (titolare implicito, admin solo con chiave).
  if v_bt = 'society' then
    if not public.footme_actor_club_permission(v_uid, p_blocker_id, 'can_block_identity') then
      return jsonb_build_object('status', 'not_allowed');
    end if;
  else
    if p_blocker_id <> v_uid then
      return jsonb_build_object('status', 'not_allowed');
    end if;
    v_bt := public.footme_block_canonical_type(v_bt, p_blocker_id);
    if v_bt is null then
      return jsonb_build_object('status', 'not_allowed');
    end if;
  end if;

  -- Target esistente.
  v_tt := public.footme_block_canonical_type(v_tt, p_target_id);
  if v_tt is null then
    return jsonb_build_object('status', 'target_unavailable');
  end if;

  -- Nessun auto-blocco: né la propria identità, né una Società controllata.
  if (v_bt = v_tt and p_blocker_id = p_target_id)
     or (v_tt <> 'society' and p_target_id = v_uid)
     or (v_tt = 'society' and public.footme_actor_club_permission(v_uid, p_target_id, 'can_block_identity')) then
    return jsonb_build_object('status', 'invalid');
  end if;

  perform public.footme_block_pair_lock(v_bt, p_blocker_id, v_tt, p_target_id);

  insert into public.identity_blocks as ib
    (blocker_identity_type, blocker_identity_id, blocked_identity_type, blocked_identity_id, acted_by_profile_id)
  values (v_bt, p_blocker_id, v_tt, p_target_id, v_uid)
  on conflict (blocker_identity_type, blocker_identity_id, blocked_identity_type, blocked_identity_id)
    where status = 'active'
  do nothing
  returning ib.block_id, ib.created_at into v_block_id, v_at;

  if v_block_id is null then
    select ib.block_id, ib.created_at into v_existing
      from public.identity_blocks ib
     where ib.status = 'active'
       and ib.blocker_identity_type = v_bt and ib.blocker_identity_id = p_blocker_id
       and ib.blocked_identity_type = v_tt and ib.blocked_identity_id = p_target_id;
    return jsonb_build_object('status', 'already_blocked', 'block_id', v_existing.block_id,
                              'blocked_at', v_existing.created_at);
  end if;

  -- Follow attivi tra le due identità: interrotti (§35, §38-§39), registrati
  -- (§37), mai ripristinati (§40). Società: solo club_follows (Q8).
  if v_bt <> 'society' and v_tt <> 'society' then
    for v_f in
      delete from public.profile_follows f
       where (f.follower_profile_id = p_blocker_id and f.followed_profile_id = p_target_id)
          or (f.follower_profile_id = p_target_id and f.followed_profile_id = p_blocker_id)
      returning f.follower_profile_id as fr, f.followed_profile_id as fd, f.created_at as since
    loop
      insert into public.identity_block_severed_follows
        (block_id, follower_type, follower_id, followed_type, followed_id, followed_since)
      values (v_block_id,
              case when v_f.fr = p_blocker_id then v_bt else v_tt end, v_f.fr,
              case when v_f.fd = p_blocker_id then v_bt else v_tt end, v_f.fd, v_f.since);
    end loop;
  else
    v_club := case when v_bt = 'society' then p_blocker_id else p_target_id end;
    v_target_profile := case when v_bt = 'society' then p_target_id else p_blocker_id end;
    for v_f in
      delete from public.club_follows f
       where f.club_id = v_club and f.profile_id = v_target_profile
      returning f.profile_id as fr, f.club_id as fd, f.created_at as since
    loop
      insert into public.identity_block_severed_follows
        (block_id, follower_type, follower_id, followed_type, followed_id, followed_since)
      values (v_block_id,
              case when v_bt = 'society' then v_tt else v_bt end, v_f.fr,
              'society', v_f.fd, v_f.since);
    end loop;
  end if;

  return jsonb_build_object('status', 'blocked', 'block_id', v_block_id, 'blocked_at', v_at);
end;
$$;

create or replace function public.unblock_identity(
  p_blocker_type text,
  p_blocker_id uuid,
  p_target_type text,
  p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bt text := lower(coalesce(p_blocker_type, ''));
  v_tt text := lower(coalesce(p_target_type, ''));
  v_block_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if v_bt not in ('person', 'media', 'society') or v_tt not in ('person', 'media', 'society')
     or p_blocker_id is null or p_target_id is null then
    return jsonb_build_object('status', 'not_allowed');
  end if;

  -- §33, D6: solo chi controlla l'identità blocker.
  if v_bt = 'society' then
    if not public.footme_actor_club_permission(v_uid, p_blocker_id, 'can_block_identity') then
      return jsonb_build_object('status', 'not_allowed');
    end if;
  elsif p_blocker_id <> v_uid then
    return jsonb_build_object('status', 'not_allowed');
  end if;

  perform public.footme_block_pair_lock(v_bt, p_blocker_id, v_tt, p_target_id);

  update public.identity_blocks b
     set status = 'removed',
         removed_at = timezone('utc', now()),
         removed_by_profile_id = v_uid
   where b.status = 'active'
     and (b.blocker_identity_type = 'society') = (v_bt = 'society')
     and b.blocker_identity_id = p_blocker_id
     and (b.blocked_identity_type = 'society') = (v_tt = 'society')
     and b.blocked_identity_id = p_target_id
  returning b.block_id into v_block_id;

  if v_block_id is null then
    return jsonb_build_object('status', 'not_blocked');
  end if;
  return jsonb_build_object('status', 'unblocked', 'block_id', v_block_id);
end;
$$;

-- Nome del target per lo stato blocked_by_me (§154). INVOKER (legge profiles /
-- media_profiles / clubs): chiamato solo dalla RPC definer, chiuso ai client.
create or replace function public.footme_block_target_name(p_type text, p_id uuid)
returns text
language sql stable security invoker set search_path = public
as $$
  select case
    when p_type = 'society' then (select c.name from public.clubs c where c.id = p_id)
    else coalesce((select nullif(btrim(m.entity_name), '') from public.media_profiles m where m.profile_id = p_id),
                  (select p.full_name from public.profiles p where p.id = p_id))
  end;
$$;

-- Cancello di disponibilità (§79-§85, §173-§176). Mai rivela il motivo.
create or replace function public.fetch_profile_availability(p_target_type text, p_target_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tt text := lower(coalesce(p_target_type, ''));
  v_canon text;
  v_mine record;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if v_tt not in ('person', 'media', 'society') or p_target_id is null then
    return jsonb_build_object('state', 'unavailable');
  end if;
  v_canon := public.footme_block_canonical_type(v_tt, p_target_id);
  if v_canon is null then
    return jsonb_build_object('state', 'unavailable');
  end if;
  if v_canon <> 'society' and p_target_id = v_uid then
    return jsonb_build_object('state', 'available');
  end if;

  -- Blocco fatto da me (persona/media dell'account o Società che controllo).
  select b.block_id, b.blocker_identity_type as bt, b.blocker_identity_id as bid into v_mine
    from public.identity_blocks b
   where b.status = 'active'
     and (b.blocked_identity_type = 'society') = (v_canon = 'society')
     and b.blocked_identity_id = p_target_id
     and ((b.blocker_identity_type in ('person', 'media') and b.blocker_identity_id = v_uid)
       or (b.blocker_identity_type = 'society'
           and b.blocker_identity_id in (select k.c_id from public.footme_blocker_club_ids(v_uid) k)))
   order by (b.blocker_identity_type = 'society'), b.created_at, b.block_id
   limit 1;
  if v_mine.block_id is not null then
    return jsonb_build_object('state', 'blocked_by_me', 'block_id', v_mine.block_id,
                              'name', public.footme_block_target_name(v_canon, p_target_id),
                              'blocker', jsonb_build_object('type', v_mine.bt, 'id', v_mine.bid));
  end if;

  -- Blocco subito, o Società non pubblica: stesso stato neutro (§82-§85).
  if public.footme_identity_blocked(v_uid, v_canon, p_target_id) then
    return jsonb_build_object('state', 'unavailable');
  end if;
  if v_canon = 'society' and not public.footme_like_actor_visible(v_uid, 'society', p_target_id)
     and not exists (select 1 from public.footme_blocker_club_ids(v_uid) k where k.c_id = p_target_id) then
    return jsonb_build_object('state', 'unavailable');
  end if;
  return jsonb_build_object('state', 'available');
end;
$$;

-- Lista Profili bloccati (§141-§150, D7). Invoker: i dati di profili/club si
-- leggono sotto RLS; le chiavi dei blocchi vengono dall'helper definer.
create or replace function public.footme_blocked_identity_page(
  p_actor uuid, p_cursor_at timestamptz, p_cursor_id uuid, p_limit integer)
returns table(h_block_id uuid, h_type text, h_id uuid, h_blocker_type text, h_blocker_id uuid, h_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select b.block_id, b.blocked_identity_type, b.blocked_identity_id,
         b.blocker_identity_type, b.blocker_identity_id, b.created_at
    from public.identity_blocks b
   where p_actor is not null and p_actor = auth.uid()
     and b.status = 'active'
     and ((b.blocker_identity_type in ('person', 'media') and b.blocker_identity_id = p_actor)
       or (b.blocker_identity_type = 'society'
           and b.blocker_identity_id in (select k.c_id from public.footme_blocker_club_ids(p_actor) k)))
     and (p_cursor_at is null
          or b.created_at < p_cursor_at
          or (b.created_at = p_cursor_at and b.block_id > p_cursor_id))
   order by b.created_at desc, b.block_id asc
   limit greatest(1, least(coalesce(p_limit, 30), 100)) + 1;
$$;

create or replace function public.fetch_blocked_identities(p_cursor jsonb default null, p_limit integer default 30)
returns table(
  block_id uuid, identity_type text, identity_id uuid, name text, avatar_url text, is_verified boolean,
  subtitle text, blocker_type text, blocker_id uuid, blocked_at timestamptz, next_cursor jsonb)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 30), 100));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  return query
  with page as (
    select h.*, row_number() over (order by h.h_at desc, h.h_block_id asc) as rn
      from public.footme_blocked_identity_page(
        auth.uid(),
        nullif(p_cursor ->> 'blocked_at', '')::timestamptz,
        nullif(p_cursor ->> 'block_id', '')::uuid,
        v_limit) h
  ),
  shown as (select * from page where rn <= v_limit),
  has_more as (select exists (select 1 from page where rn > v_limit) as v),
  last_row as (select * from shown order by rn desc limit 1)
  select
    s.h_block_id,
    s.h_type,
    s.h_id,
    case s.h_type
      when 'society' then coalesce(c.name, 'Società')
      when 'media'   then coalesce(mp.entity_name, pr.full_name, 'Pagina Media')
      else coalesce(pr.full_name, 'Profilo')
    end,
    case s.h_type when 'society' then c.logo_url when 'media' then coalesce(mp.logo_url, pr.avatar_url) else pr.avatar_url end,
    case s.h_type
      when 'society' then coalesce(c.verification_status = 'verified', false)
      when 'media'   then coalesce(mp.verification_status = 'verified', false)
      else false
    end,
    case s.h_type
      when 'society' then 'Società'
      when 'media'   then 'Media'
      else concat_ws(' · ',
        case pr.role::text
          when 'player' then 'Calciatore' when 'coach' then 'Allenatore' when 'staff' then 'Staff tecnico'
          when 'director' then 'Dirigente' when 'agent' then 'Procuratore' when 'fan' then 'Tifoso'
          when 'club_admin' then 'Amministratore' else null end,
        (select cc.name from public.club_members cm join public.clubs cc on cc.id = cm.club_id
          where cm.profile_id = s.h_id and cm.status = 'active' and cm.is_current = true
          order by cm.created_at desc limit 1))
    end,
    s.h_blocker_type,
    s.h_blocker_id,
    s.h_at,
    case when s.rn = (select max(rn) from shown) and (select v from has_more)
         then jsonb_build_object('blocked_at', s.h_at, 'block_id', s.h_block_id) end
  from shown s
  left join public.profiles pr on pr.id = s.h_id and s.h_type <> 'society'
  left join public.media_profiles mp on mp.profile_id = s.h_id and s.h_type = 'media'
  left join public.clubs c on c.id = s.h_id and s.h_type = 'society'
  order by s.rn;
end;
$$;

-- D5: wrapper deprecati (stessa firma, stessi tipi di ritorno). Nessun client
-- nuovo li usa; i client vecchi bloccano la persona/media propria.
create or replace function public.block_user(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_r jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if target_profile_id is null then
    raise exception 'Profilo da bloccare non specificato';
  end if;
  if v_uid = target_profile_id then
    raise exception 'Non puoi bloccare te stesso';
  end if;
  v_r := public.block_identity(gen_random_uuid(), 'person', v_uid, 'person', target_profile_id);
  if v_r ->> 'status' not in ('blocked', 'already_blocked') then
    raise exception 'Non è stato possibile bloccare questo profilo';
  end if;
end;
$$;

create or replace function public.unblock_user(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  perform public.unblock_identity('person', auth.uid(), 'person', target_profile_id);
end;
$$;

-- Variante a zero argomenti per le funzioni INVOKER (search_share_recipients): il
-- viewer è sempre auth.uid(), quindi non permette di sondare i blocchi altrui.
create or replace function public.footme_my_blocked_keys()
returns table(b_kind text, b_id uuid)
language sql stable security definer set search_path = public
as $$
  select k.b_kind, k.b_id from public.footme_blocked_keys(auth.uid()) k;
$$;

-- ============================================================
-- SEZIONE 5 — Follow: nessun nuovo Follow durante il blocco (§44-§45)
-- ============================================================

create or replace function public.footme_follow_block_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a uuid;
  v_b uuid;
  v_kind text;
begin
  if tg_table_name = 'profile_follows' then
    v_a := new.follower_profile_id; v_b := new.followed_profile_id; v_kind := 'profile';
  else
    v_a := new.profile_id; v_b := new.club_id; v_kind := 'society';
  end if;
  perform public.footme_block_pair_lock('profile', v_a, v_kind, v_b);
  if public.footme_identity_blocked(v_a, v_kind, v_b) then
    raise exception 'Non puoi seguire questo profilo' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profile_follows_block_guard on public.profile_follows;
create trigger profile_follows_block_guard before insert on public.profile_follows
  for each row execute function public.footme_follow_block_guard();
drop trigger if exists club_follows_block_guard on public.club_follows;
create trigger club_follows_block_guard before insert on public.club_follows
  for each row execute function public.footme_follow_block_guard();

-- ============================================================
-- SEZIONE 6 — D2: la propagazione Società → titolare sparisce da
-- footme_publisher_blocked e footme_like_actor_visible. Riemesse dalle
-- definizioni vive (pg_get_functiondef di 20261122090000), cambiano SOLO i
-- rami `club` / `society`.
-- ============================================================

create or replace function public.footme_publisher_blocked(p_viewer uuid, p_publisher_type text, p_publisher_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case
    when p_viewer is null then false
    when p_publisher_type = 'profile' then public.footme_profiles_blocked(p_viewer, p_publisher_id)
    when p_publisher_type = 'club' then public.footme_identity_blocked(p_viewer, 'society', p_publisher_id)
    else false
  end;
$$;

create or replace function public.footme_like_actor_visible(p_viewer uuid, p_actor_type text, p_actor_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case p_actor_type
    when 'person' then
      exists (select 1 from public.profiles p where p.id = p_actor_id)
      and not public.footme_profiles_blocked(p_viewer, p_actor_id)
    when 'media' then
      exists (select 1 from public.media_profiles mp
              join public.profiles p on p.id = mp.profile_id
              where mp.profile_id = p_actor_id)
      and not public.footme_profiles_blocked(p_viewer, p_actor_id)
    when 'society' then
      exists (select 1 from public.clubs c
              where c.id = p_actor_id
                and c.verification_status not in ('suspended', 'rejected', 'flagged'))
      and not public.footme_identity_blocked(p_viewer, 'society', p_actor_id)
    else false
  end;
$$;

-- ============================================================
-- Privilegi: nessun grant ai client sulle tabelle; execute solo alle 4 RPC
-- client (+ wrapper deprecati + helper chiamati da funzioni invoker).
-- `revoke from public` NON chiude anon: revoke esplicito.
-- ============================================================

do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'footme_block_viewer_identity(uuid)',
    'footme_identity_blocked(uuid,text,uuid)',
    'footme_blocked_keys(uuid)',
    'footme_blocker_club_ids(uuid)',
    'footme_block_pair_lock(text,uuid,text,uuid)',
    'footme_block_canonical_type(text,uuid)',
    'footme_block_target_name(text,uuid)',
    'footme_blocked_identity_page(uuid,timestamptz,uuid,integer)',
    'block_identity(uuid,text,uuid,text,uuid)',
    'unblock_identity(text,uuid,text,uuid)',
    'fetch_profile_availability(text,uuid)',
    'fetch_blocked_identities(jsonb,integer)',
    'footme_follow_block_guard()',
    'footme_my_blocked_keys()',
    'block_user(uuid)',
    'unblock_user(uuid)'] loop
    execute format('revoke all on function public.%s from public', v_fn);
    execute format('revoke execute on function public.%s from anon', v_fn);
  end loop;
  foreach v_fn in array array[
    'block_identity(uuid,text,uuid,text,uuid)',
    'unblock_identity(text,uuid,text,uuid)',
    'fetch_profile_availability(text,uuid)',
    'fetch_blocked_identities(jsonb,integer)',
    'block_user(uuid)',
    'unblock_user(uuid)',
    -- chiamate da funzioni INVOKER: il corpo è limitato a auth.uid().
    -- Gli altri helper (p_viewer arbitrario) restano chiusi ai client: le
    -- funzioni definer li chiamano coi privilegi del proprietario.
    'footme_blocked_identity_page(uuid,timestamptz,uuid,integer)',
    'footme_my_blocked_keys()'] loop
    execute format('grant execute on function public.%s to authenticated', v_fn);
  end loop;
end
$$;

-- Helper con p_viewer arbitrario: chiusi anche ad authenticated (non devono
-- permettere di sondare i blocchi di terzi). Le definer li usano comunque.
do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'footme_block_viewer_identity(uuid)',
    'footme_identity_blocked(uuid,text,uuid)',
    'footme_blocked_keys(uuid)',
    'footme_blocker_club_ids(uuid)',
    'footme_block_pair_lock(text,uuid,text,uuid)',
    'footme_block_canonical_type(text,uuid)',
    'footme_block_target_name(text,uuid)',
    'footme_follow_block_guard()'] loop
    execute format('revoke execute on function public.%s from authenticated', v_fn);
  end loop;
end
$$;

-- ============================================================
-- SEZIONE 7 — Feed, readability, suggerimenti (§64-§67, §53-§59, §77-§78, §184-§191)
-- Riemesse dalle definizioni VIVE (pg_get_functiondef dopo 20261126090000);
-- cambia solo il filtro di blocco: anti-join su footme_blocked_keys, profili E
-- Società. Simple Repost e reference HOM-10: ereditano da footme_content_readable
-- → footme_publisher_blocked (sezione 6).
-- ============================================================

CREATE OR REPLACE FUNCTION public.fetch_home_feed_page(p_tab text DEFAULT 'per_te'::text, p_as_of timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_bucket smallint DEFAULT NULL::smallint, p_cursor_published_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_uid text DEFAULT NULL::text, p_page_index integer DEFAULT 0, p_limit integer DEFAULT 10)
 RETURNS TABLE(item_uid text, item_type text, rank_position integer, rank_bucket smallint, layout_hint text, component_version smallint, title text, excerpt text, thumbnail_url text, published_at timestamp with time zone, author_kind text, author_id uuid, author_name text, author_avatar_url text, author_source_kind text, author_is_verified boolean, is_seen boolean, is_saved boolean, is_following_author boolean, suggestion_reason_key text, suggestion_reason_label text, nav_kind text, nav_params jsonb, data jsonb, as_of timestamp with time zone, next_cursor_bucket smallint, next_cursor_published_at timestamp with time zone, next_cursor_uid text, is_last_page boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid                 uuid := auth.uid();
  v_as_of               timestamptz;
  v_limit               int := least(greatest(coalesce(p_limit, 10), 1), 30);
  v_page                int := greatest(coalesce(p_page_index, 0), 0);
  v_region              text;
  v_role                text;
  v_pref_active         boolean := false;
  v_wants_clubs         boolean := false;
  v_wants_positions     boolean := false;
  v_wants_local_media   boolean := false;
  v_include_positions   boolean;
  v_target_role         text;
  v_primary_position    public.player_position;
  v_secondary_positions public.player_position[] := '{}';
  v_preferred_regions   text[] := '{}';
  v_popular_threshold   int := public.footme_feed_popularity_threshold();
  v_recent_count        int := 0;
  v_use_floor           boolean := true;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_tab is null or p_tab not in ('per_te', 'seguiti') then
    raise exception 'Tab del Feed non supportata: %', coalesce(p_tab, 'null');
  end if;

  if (p_cursor_uid is null) <> (p_cursor_published_at is null)
     or (p_cursor_uid is null) <> (p_cursor_bucket is null) then
    raise exception
      'Cursore del Feed incompleto: bucket, published_at e uid vanno forniti insieme';
  end if;

  if p_cursor_uid is not null and p_as_of is null then
    raise exception
      'Il cursore del Feed richiede p_as_of: passare l''as_of restituito dalla prima pagina';
  end if;

  v_as_of := coalesce(p_as_of, timezone('utc', now()));

  select p.region, p.role::text into v_region, v_role
  from public.profiles p
  where p.id = v_uid;

  select
    fp.applies_until is not null and fp.applies_until > v_as_of,
    fp.wants_clubs,
    fp.wants_positions,
    fp.wants_local_media
  into v_pref_active, v_wants_clubs, v_wants_positions, v_wants_local_media
  from public.feed_preferences fp
  where fp.profile_id = v_uid;

  v_pref_active := coalesce(v_pref_active, false);

  v_target_role := case
    when v_role = 'player' then 'player'
    when v_role = 'coach'  then 'coach'
    when v_role = 'staff'  then 'staff'
    else null
  end;

  select pp.primary_position, coalesce(pp.secondary_positions, '{}')
  into v_primary_position, v_secondary_positions
  from public.player_profiles pp
  where pp.profile_id = v_uid;

  select coalesce(
    (select pp.transfer_regions from public.player_profiles pp where pp.profile_id = v_uid),
    (select cp.preferred_regions from public.coach_profiles cp where cp.profile_id = v_uid),
    (select sp.preferred_regions from public.staff_profiles sp where sp.profile_id = v_uid),
    '{}'::text[]
  ) into v_preferred_regions;

  v_include_positions :=
    coalesce(v_role, '') in ('player', 'coach', 'staff', 'agent', 'director', 'club_admin')
    or (v_pref_active and coalesce(v_wants_positions, false));

  -- PUNTO A: il floor a 180 giorni si applica solo se c'è abbastanza materiale
  -- recente da riempire una pagina. Su un archivio poco recente cade, così la
  -- Home mostra contenuti vecchi invece di niente. Sonda limitata: costa una
  -- pagina. Deterministica per un dato as_of, quindi il cursore resta valido.
  if p_tab = 'per_te' then
    select count(*) into v_recent_count
    from (
      select 1
      from public.feed_content_index fci
      where fci.published_at <= v_as_of
        and fci.published_at >= v_as_of - interval '180 days'
      limit v_limit
    ) probe;

    v_use_floor := v_recent_count >= v_limit;
  end if;

  return query
  with followed_clubs as (
    select f.club_id from public.club_follows f where f.profile_id = v_uid
  ),
  followed_profiles as (
    select f.followed_profile_id as profile_id
    from public.profile_follows f
    where f.follower_profile_id = v_uid
  ),
  -- HOM-12 §64-§67, §190-§191: insieme dei bloccati (profili e Società, entrambe
  -- le direzioni) calcolato UNA volta e usato in anti-join; il blocco è un
  -- filtro di eligibility prima del ranking.
  blocked_keys as materialized (
    select k.b_kind, k.b_id from public.footme_blocked_keys(v_uid) k
  ),
  saved_content as (
    select 'club_media'::text as content_type, s.post_id
      from public.saved_club_media s           where s.profile_id = v_uid
    union all
    select 'media_profile', s.post_id
      from public.saved_media_profile_posts s  where s.profile_id = v_uid
    union all
    select 'media_tribuna', s.post_id
      from public.saved_media_tribuna s        where s.profile_id = v_uid
    union all
    select 'fan_tribuna', s.post_id
      from public.saved_fan_tribuna s          where s.profile_id = v_uid
    union all
    select 'fan_media', s.post_id
      from public.saved_fan_media s            where s.profile_id = v_uid
    union all
    select 'profile_post', s.post_id
      from public.saved_profile_posts s        where s.profile_id = v_uid
  ),
  saved_positions as (
    select sa.ad_id from public.saved_ads sa where sa.profile_id = v_uid
  ),

  -- HOM-10 §73, §185–§187, D2: i Simple Repost dei reposter seguiti, UNA riga per
  -- originale. Solo Seguiti: in Per te l'insieme è vuoto (nessun cambiamento).
  repost_groups as (
    select g.*
    from public.footme_feed_repost_groups(v_uid, v_as_of) g
    where p_tab = 'seguiti'
  ),

  -- ── candidati: contenuti ────────────────────────────────────────
  content_candidates as (
    select
      fci.content_type || ':' || fci.post_id::text        as item_uid,
      public.footme_feed_item_type(fci.content_type, fci.content_format) as item_type,
      case
        when p_tab = 'seguiti' then 0::smallint
        else public.footme_feed_rank_bucket(
          aff.affinity,
          coalesce(eng.engagement_count, 0) >= v_popular_threshold,
          fci.published_at,
          v_as_of
        )
      end                                                as rank_bucket,
      fci.published_at                                   as published_at,
      fci.publisher_id                                   as author_key,
      fci.title                                          as title,
      fci.excerpt                                        as excerpt,
      fci.thumbnail_url                                  as thumbnail_url,
      fci.publisher_type                                 as author_kind,
      fci.publisher_id                                   as author_id,
      fci.publisher_name                                 as author_name,
      fci.publisher_avatar_url                           as author_avatar_url,
      fci.source_kind                                    as author_source_kind,
      coalesce(fci.publisher_is_verified, false)         as author_is_verified,
      (sv.post_id is not null)                           as is_saved,
      aff.is_following                                   as is_following_author,
      -- Un contenuto senza altri segnali ma molto commentato ha comunque un
      -- motivo da mostrare: è il "popolare" richiesto.
      coalesce(
        aff.reason_key,
        case
          when coalesce(eng.engagement_count, 0) >= v_popular_threshold
            then 'popular_now'
          else null
        end
      )                                                  as reason_key,
      null::text                                         as reason_entity_name,
      fci.content_type                                   as content_type,
      fci.post_id                                        as post_id,
      fci.kind                                           as kind,
      fci.content_format                                 as content_format,
      fci.media_type                                     as media_type,
      fci.duration_seconds                               as duration_seconds,
      null::uuid                                         as ad_id,
      null::uuid                                         as club_id,
      null::uuid                                         as team_id,
      null::text                                         as team_name,
      null::text                                         as team_type,
      null::text                                         as role_required,
      null::text                                         as category,
      null::text                                         as loc_city,
      null::text                                         as loc_province,
      null::text                                         as loc_region,
      null::text                                         as target_role,
      null::boolean                                      as is_secondary_match,
      null::jsonb                                        as repost_info
    from public.feed_content_index fci
    left join saved_content sv
      on sv.content_type = fci.content_type and sv.post_id = fci.post_id
    left join public.media_content_engagement eng
      on eng.content_type = fci.content_type and eng.post_id = fci.post_id
    cross join lateral (
      select
        f.is_following,
        greatest(
          case when f.is_following then 2 else 0 end,
          case
            when v_pref_active and (
              (coalesce(v_wants_clubs, false) and fci.publisher_type = 'club')
              or (
                coalesce(v_wants_local_media, false)
                and fci.source_kind in ('testata', 'giornalista', 'creator', 'pagina')
                and v_region is not null
                and fci.publisher_region = v_region
              )
            ) then 1 else 0
          end,
          case
            when v_region is not null and fci.publisher_region = v_region then 1 else 0
          end
        ) as affinity,
        case
          when f.is_following and fci.publisher_type = 'club'    then 'followed_club_publisher'
          when f.is_following and fci.publisher_type = 'profile'  then 'followed_profile_publisher'
          when v_pref_active and (
            (coalesce(v_wants_clubs, false) and fci.publisher_type = 'club')
            or (
              coalesce(v_wants_local_media, false)
              and fci.source_kind in ('testata', 'giornalista', 'creator', 'pagina')
              and v_region is not null
              and fci.publisher_region = v_region
            )
          ) then 'preferred_source'
          when v_region is not null and fci.publisher_region = v_region then 'same_region'
          else null
        end as reason_key
      from (
        select (
          case
            when fci.publisher_type = 'club'
              then exists (select 1 from followed_clubs fc where fc.club_id = fci.publisher_id)
            else exists (select 1 from followed_profiles fp where fp.profile_id = fci.publisher_id)
          end
        ) as is_following
      ) f
    ) aff
    where
      not (fci.publisher_type = 'profile' and fci.publisher_id = v_uid)
      and not exists (
        select 1 from blocked_keys bk
        where bk.b_id = fci.publisher_id
          and bk.b_kind = case when fci.publisher_type = 'club' then 'society' else 'profile' end)
      and (p_tab = 'per_te' or aff.is_following)
      and (
        p_tab = 'seguiti'
        or not v_use_floor
        or fci.published_at >= v_as_of - interval '180 days'
      )
      and fci.published_at <= v_as_of
      -- HOM-11 §123–§125, §171, §293: un CONTENT segnalato dal viewer non compare
      -- né in Per te né in Seguiti (viewer-specific, nessuna rimozione globale).
      and not exists (
        select 1 from public.moderation_reports mr
        where mr.reporter_profile_id = v_uid
          and mr.target_type = 'CONTENT'
          and mr.target_content_type = fci.content_type
          and mr.target_id = fci.post_id)
      -- HOM-11 §26, §169–§170, §292: «Non mi interessa» esclude da Per te; Seguiti
      -- non usa quel segnale.
      and not (
        p_tab = 'per_te'
        and exists (
          select 1 from public.feed_not_interested ni
          where ni.viewer_profile_id = v_uid
            and ni.content_type = fci.content_type
            and ni.content_id = fci.post_id))
      -- HOM-10 §185, §197: un originale che ha un wrapper non compare anche come
      -- copia organica (nessuna doppia esposizione nella stessa pagina).
      and not exists (
        select 1 from repost_groups rg
        where rg.g_content_type = fci.content_type and rg.g_post_id = fci.post_id)
  ),

  -- ── candidati: Simple Repost (wrapper) ──────────────────────────
  -- Stesso contenuto dell'originale (autore, payload, azioni: §75–§82), con la
  -- data del repost più recente. Il wrapper NON ha engagement proprio.
  repost_candidates as (
    select
      'repost:' || fci.content_type || ':' || fci.post_id::text          as item_uid,
      public.footme_feed_item_type(fci.content_type, fci.content_format) as item_type,
      0::smallint                                        as rank_bucket,
      g.g_published_at                                   as published_at,
      fci.publisher_id                                   as author_key,
      fci.title                                          as title,
      fci.excerpt                                        as excerpt,
      fci.thumbnail_url                                  as thumbnail_url,
      fci.publisher_type                                 as author_kind,
      fci.publisher_id                                   as author_id,
      fci.publisher_name                                 as author_name,
      fci.publisher_avatar_url                           as author_avatar_url,
      fci.source_kind                                    as author_source_kind,
      coalesce(fci.publisher_is_verified, false)         as author_is_verified,
      (sv.post_id is not null)                           as is_saved,
      (case
         when fci.publisher_type = 'club'
           then exists (select 1 from followed_clubs fc where fc.club_id = fci.publisher_id)
         else exists (select 1 from followed_profiles fp where fp.profile_id = fci.publisher_id)
       end)                                              as is_following_author,
      null::text                                         as reason_key,
      null::text                                         as reason_entity_name,
      fci.content_type                                   as content_type,
      fci.post_id                                        as post_id,
      fci.kind                                           as kind,
      fci.content_format                                 as content_format,
      fci.media_type                                     as media_type,
      fci.duration_seconds                               as duration_seconds,
      null::uuid                                         as ad_id,
      null::uuid                                         as club_id,
      null::uuid                                         as team_id,
      null::text                                         as team_name,
      null::text                                         as team_type,
      null::text                                         as role_required,
      null::text                                         as category,
      null::text                                         as loc_city,
      null::text                                         as loc_province,
      null::text                                         as loc_region,
      null::text                                         as target_role,
      null::boolean                                      as is_secondary_match,
      jsonb_build_object(
        'reposter', jsonb_build_object(
          'identity_type', g.g_reposter_type,
          'identity_id',   g.g_reposter_id,
          'display_name',  rc.card -> 'name',
          'avatar_url',    rc.card -> 'avatar_url',
          'is_verified',   coalesce(rc.card -> 'is_verified', 'false'::jsonb)),
        'additional_count', g.g_additional)               as repost_info
    from repost_groups g
    join public.feed_content_index fci
      on fci.content_type = g.g_content_type and fci.post_id = g.g_post_id
    left join saved_content sv
      on sv.content_type = fci.content_type and sv.post_id = fci.post_id
    cross join lateral (
      select public.footme_composer_identity_card(g.g_reposter_type, g.g_reposter_id) as card
    ) rc
    where fci.published_at <= v_as_of
      and rc.card is not null
      -- HOM-11 §143: il wrapper porta l'originale; se il viewer ha segnalato
      -- l'originale, sparisce anche il wrapper.
      and not exists (
        select 1 from public.moderation_reports mr
        where mr.reporter_profile_id = v_uid
          and mr.target_type = 'CONTENT'
          and mr.target_content_type = fci.content_type
          and mr.target_id = fci.post_id)
  ),

  -- ── candidati: posizioni aperte ─────────────────────────────────
  position_candidates as (
    select
      'recruiting_ad:' || ra.id::text                    as item_uid,
      'suggested_position'::text                         as item_type,
      case
        when p_tab = 'seguiti' then 0::smallint
        else public.footme_feed_rank_bucket(pa.affinity, false, ra.published_at, v_as_of)
      end                                                as rank_bucket,
      ra.published_at                                    as published_at,
      ra.club_id                                         as author_key,
      ra.title                                           as title,
      null::text                                         as excerpt,
      null::text                                         as thumbnail_url,
      'club'::text                                       as author_kind,
      ra.club_id                                         as author_id,
      c.name                                             as author_name,
      c.logo_url                                         as author_avatar_url,
      'ufficiale'::text                                  as author_source_kind,
      (c.verification_status = 'verified')               as author_is_verified,
      (sp.ad_id is not null)                             as is_saved,
      pa.is_following                                    as is_following_author,
      pa.reason_key                                      as reason_key,
      c.name                                             as reason_entity_name,
      null::text                                         as content_type,
      null::uuid                                         as post_id,
      null::text                                         as kind,
      null::text                                         as content_format,
      null::text                                         as media_type,
      null::int                                          as duration_seconds,
      ra.id                                              as ad_id,
      ra.club_id                                         as club_id,
      ra.team_id                                         as team_id,
      ct.name                                            as team_name,
      ct.team_type                                       as team_type,
      ra.role_required::text                             as role_required,
      coalesce(ra.category, ct.category, c.category)     as category,
      coalesce(ct.city, c.city)                          as loc_city,
      coalesce(ct.province, c.province)                  as loc_province,
      coalesce(ra.region, ct.region, c.region)           as loc_region,
      ra.target_role::text                               as target_role,
      pa.is_secondary_match                              as is_secondary_match,
      null::jsonb                                        as repost_info
    from public.recruiting_ads ra
    join public.clubs c            on c.id = ra.club_id
    left join public.club_teams ct on ct.id = ra.team_id
    left join saved_positions sp   on sp.ad_id = ra.id
    cross join lateral (
      select
        m.is_following,
        m.is_secondary_match,
        m.role_match,
        m.region_match,
        greatest(
          case when m.is_following then 2 else 0 end,
          case when m.region_match or m.role_match then 1 else 0 end
        ) as affinity,
        case
          when m.is_following then 'followed_club_position'
          when m.role_match   then 'open_position_match'
          when m.region_match then 'same_region'
          else null
        end as reason_key
      from (
        select
          exists (select 1 from followed_clubs fc where fc.club_id = ra.club_id) as is_following,
          (
            v_target_role is not null
            and ra.target_role::text = v_target_role
            and v_primary_position is not null
            and ra.role_required = any(v_secondary_positions)
            and ra.role_required <> v_primary_position
          ) as is_secondary_match,
          (
            v_target_role is not null
            and ra.target_role::text = v_target_role
            and (
              v_primary_position is null
              or ra.role_required = v_primary_position
              or ra.role_required = any(v_secondary_positions)
            )
          ) as role_match,
          (
            coalesce(ra.region, ct.region, c.region) is not null
            and (
              coalesce(ra.region, ct.region, c.region) = v_region
              or coalesce(ra.region, ct.region, c.region) = any(v_preferred_regions)
            )
          ) as region_match
      ) m
    ) pa
    where v_include_positions
      and ra.status = 'published'
      and ra.published_at is not null
      and not exists (select 1 from blocked_keys bk where bk.b_kind = 'society' and bk.b_id = ra.club_id)
      and ra.published_at <= v_as_of
      and (ra.deadline is null or ra.deadline >= current_date)
      and (
        case
          when p_tab = 'seguiti' then pa.is_following
          else pa.is_following or pa.role_match or pa.region_match
        end
      )
      and (
        p_tab = 'seguiti'
        or not v_use_floor
        or ra.published_at >= v_as_of - interval '180 days'
      )
  ),

  candidates as (
    select * from content_candidates
    union all
    select * from repost_candidates
    union all
    select * from position_candidates
  ),

  filtered as (
    select cd.*
    from candidates cd
    where p_cursor_uid is null
       or cd.rank_bucket < p_cursor_bucket
       or (cd.rank_bucket = p_cursor_bucket and cd.published_at < p_cursor_published_at)
       or (
         cd.rank_bucket = p_cursor_bucket
         and cd.published_at = p_cursor_published_at
         and cd.item_uid > p_cursor_uid
       )
  ),
  ordered as (
    select
      f.*,
      row_number() over (
        order by f.rank_bucket desc, f.published_at desc, f.item_uid asc
      ) as base_ord
    from filtered f
    order by f.rank_bucket desc, f.published_at desc, f.item_uid asc
    limit v_limit + 1
  ),
  window_rows as (
    select o.* from ordered o where o.base_ord <= v_limit
  ),
  boundary as (
    select w.rank_bucket, w.published_at, w.item_uid
    from window_rows w
    order by w.base_ord desc
    limit 1
  ),

  diversified as (
    select
      w.*,
      w.base_ord
      + (row_number() over (partition by w.author_key order by w.base_ord) - 1) * 3
      + case
          when w.item_type = 'suggested_position'
            then (row_number() over (partition by w.item_type order by w.base_ord) - 1) * 2
          else 0
        end as final_ord
    from window_rows w
  ),
  emitted as (
    select d.*, row_number() over (order by d.final_ord, d.base_ord) as emit_ord
    from diversified d
  ),

  slot_rows as (
    select sp.slot_offset, sp.item_type
    from public.footme_feed_slot_plan(p_tab, v_page, v_limit) sp
    where sp.slot_offset < (select count(*) from emitted)
  ),

  -- HOM-02/HOM-03: il payload completo di Post, Articoli e video editoriali
  -- della pagina è costruito in batch, una volta, sulle sole chiavi emesse.
  -- Gli array escono dalla stessa aggregazione con lo stesso ordine, quindi
  -- restano allineati.
  post_keys as (
    select
      array_agg(e.content_type order by e.item_uid) as content_types,
      array_agg(e.post_id      order by e.item_uid) as post_ids
    from emitted e
    where e.item_type in ('post', 'article', 'video')
  ),
  post_payloads as (
    select pl.r_content_type, pl.r_post_id, pl.payload
    from post_keys pk
    cross join lateral public.footme_post_payloads(v_uid, pk.content_types, pk.post_ids) pl
  ),

  feed_rows as (
    select
      e.item_uid, e.item_type, e.rank_bucket, e.published_at,
      e.title, e.excerpt, e.thumbnail_url,
      e.author_kind, e.author_id, e.author_name, e.author_avatar_url,
      e.author_source_kind, e.author_is_verified, e.is_saved, e.is_following_author,
      e.reason_key, e.reason_entity_name,
      e.content_type, e.post_id, e.kind, e.content_format,
      e.media_type, e.duration_seconds,
      e.ad_id, e.club_id, e.team_id, e.team_name, e.team_type,
      e.role_required, e.category, e.loc_city, e.loc_province, e.loc_region,
      e.target_role, e.is_secondary_match, e.repost_info,
      e.emit_ord::numeric as sort_key
    from emitted e

    union all

    select
      'module:' || s.item_type || ':' || v_page::text, s.item_type,
      0::smallint, null::timestamptz,
      null::text, null::text, null::text,
      null::text, null::uuid, null::text, null::text,
      null::text, false, false, false,
      'not_followed_yet'::text, null::text,
      null::text, null::uuid, null::text, null::text,
      null::text, null::int,
      null::uuid, null::uuid, null::uuid, null::text, null::text,
      null::text, null::text, null::text, null::text, null::text,
      null::text, null::boolean, null::jsonb,
      s.slot_offset + 0.5
    from slot_rows s
  )

  select
    fr.item_uid,
    fr.item_type,
    (v_page * v_limit + row_number() over (order by fr.sort_key))::int as rank_position,
    fr.rank_bucket,
    public.footme_feed_layout_hint(
      fr.item_type,
      fr.thumbnail_url is not null,
      length(coalesce(fr.excerpt, ''))
    ) as layout_hint,
    public.footme_feed_component_version(fr.item_type) as component_version,
    fr.title,
    case
      when fr.excerpt is null       then null
      when fr.item_type = 'post'    then left(fr.excerpt, 280)
      else                               left(fr.excerpt, 200)
    end as excerpt,
    fr.thumbnail_url,
    fr.published_at,
    fr.author_kind,
    fr.author_id,
    fr.author_name,
    fr.author_avatar_url,
    fr.author_source_kind,
    fr.author_is_verified,
    false as is_seen,
    fr.is_saved,
    fr.is_following_author,
    fr.reason_key as suggestion_reason_key,
    public.footme_feed_reason_label(fr.reason_key, fr.reason_entity_name) as suggestion_reason_label,
    case
      when fr.item_type = 'suggested_position'                      then 'position'
      when fr.item_type in ('suggested_profiles', 'suggested_clubs') then null
      else 'content'
    end as nav_kind,
    case
      when fr.item_type = 'suggested_position'
        then jsonb_build_object('ad_id', fr.ad_id)
      when fr.item_type in ('suggested_profiles', 'suggested_clubs')
        then null
      else jsonb_build_object('content_type', fr.content_type, 'post_id', fr.post_id)
    end as nav_params,
    case
      when fr.item_type = 'suggested_position' then jsonb_build_object(
        'ad_id',              fr.ad_id,
        'club_id',            fr.club_id,
        'team_id',            fr.team_id,
        'club_name',          fr.author_name,
        'club_logo_url',      fr.author_avatar_url,
        'team_name',          fr.team_name,
        'team_type',          fr.team_type,
        'role_required',      fr.role_required,
        'category',           fr.category,
        'city',               fr.loc_city,
        'province',           fr.loc_province,
        'region',             fr.loc_region,
        'target_role',        fr.target_role,
        'is_secondary_match', coalesce(fr.is_secondary_match, false)
      )
      when fr.item_type in ('suggested_profiles', 'suggested_clubs') then jsonb_build_object(
        'module_key',   fr.item_type,
        'module_limit', 6
      )
      else jsonb_build_object(
        'content_type',     fr.content_type,
        'post_id',          fr.post_id,
        'kind',             fr.kind,
        'kind_label',       public.footme_content_kind_label(fr.content_type, fr.kind),
        'content_format',   fr.content_format,
        'media_type',       fr.media_type,
        'duration_seconds', fr.duration_seconds,
        'is_truncated',     length(coalesce(fr.excerpt, ''))
                              > (case when fr.item_type = 'post' then 280 else 200 end)
      )
      -- HOM-02/HOM-03: Post, Articoli e video editoriali portano le chiavi del
      -- Post social standard; le posizioni e i moduli discovery no.
      || case
           when fr.item_type in ('post', 'article', 'video')
             -- HOM-11 §20–§26: can_mark_not_interested dipende dalla TAB (solo Per
             -- te) e dalla gestione del contenuto (can_report = non gestito).
             then case
                    when ppl.payload is null then '{}'::jsonb
                    else jsonb_set(
                           ppl.payload,
                           '{capabilities,can_mark_not_interested}',
                           to_jsonb(p_tab = 'per_te'
                                    and coalesce((ppl.payload #>> '{capabilities,can_report}')::boolean, false)),
                           true)
                  end
           else '{}'::jsonb
         end
    end
    -- HOM-10 §73–§82, §186: il contesto «X ha ripostato» (reposter rappresentativo e
    -- quanti altri). Le azioni e il payload restano dell'originale.
    || case
         when fr.repost_info is not null then jsonb_build_object('repost', fr.repost_info)
         else '{}'::jsonb
       end as data,
    v_as_of as as_of,
    case
      when (select count(*) from ordered) > v_limit
        then (select b.rank_bucket from boundary b)
      else null
    end as next_cursor_bucket,
    case
      when (select count(*) from ordered) > v_limit
        then (select b.published_at from boundary b)
      else null
    end as next_cursor_published_at,
    case
      when (select count(*) from ordered) > v_limit
        then (select b.item_uid from boundary b)
      else null
    end as next_cursor_uid,
    ((select count(*) from ordered) <= v_limit) as is_last_page
  from feed_rows fr
  left join post_payloads ppl
    on fr.item_type in ('post', 'article', 'video')
   and ppl.r_content_type = fr.content_type
   and ppl.r_post_id = fr.post_id
  order by fr.sort_key;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fetch_home_feed_updates(p_tab text DEFAULT 'per_te'::text, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(new_items_count integer, newest_published_at timestamp with time zone, preview_avatar_urls text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid   uuid := auth.uid();
  v_since timestamptz;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_tab is null or p_tab not in ('per_te', 'seguiti') then
    raise exception 'Tab del Feed non supportata: %', coalesce(p_tab, 'null');
  end if;

  -- Senza watermark non c'è nulla di "nuovo" da segnalare.
  v_since := coalesce(p_since, timezone('utc', now()));

  return query
  with followed_clubs as (
    select f.club_id from public.club_follows f where f.profile_id = v_uid
  ),
  followed_profiles as (
    select f.followed_profile_id as profile_id
    from public.profile_follows f
    where f.follower_profile_id = v_uid
  ),
  -- HOM-12 §64-§67, §190-§191: insieme dei bloccati (profili e Società, entrambe
  -- le direzioni) calcolato UNA volta e usato in anti-join; il blocco è un
  -- filtro di eligibility prima del ranking.
  blocked_keys as materialized (
    select k.b_kind, k.b_id from public.footme_blocked_keys(v_uid) k
  ),
  -- HOM-10: gli stessi wrapper della pagina (footme_feed_repost_groups), solo Seguiti.
  repost_groups as (
    select g.*
    from public.footme_feed_repost_groups(v_uid, timezone('utc', now())) g
    where p_tab = 'seguiti'
  ),
  fresh as (
    select fci.published_at, fci.publisher_avatar_url
    from public.feed_content_index fci
    where fci.published_at > v_since
      -- HOM-11 §123–§125, §169: stesse esclusioni della pagina (segnalati; Non mi
      -- interessa solo in Per te), così il conteggio «nuovi» non promette ciò che
      -- il refresh poi non mostra.
      and not exists (
        select 1 from public.moderation_reports mr
        where mr.reporter_profile_id = v_uid
          and mr.target_type = 'CONTENT'
          and mr.target_content_type = fci.content_type
          and mr.target_id = fci.post_id)
      and not (
        p_tab = 'per_te'
        and exists (
          select 1 from public.feed_not_interested ni
          where ni.viewer_profile_id = v_uid
            and ni.content_type = fci.content_type
            and ni.content_id = fci.post_id))
      and not exists (
        select 1 from repost_groups rg
        where rg.g_content_type = fci.content_type and rg.g_post_id = fci.post_id)
      and not (fci.publisher_type = 'profile' and fci.publisher_id = v_uid)
      and not exists (
        select 1 from blocked_keys bk
        where bk.b_id = fci.publisher_id
          and bk.b_kind = case when fci.publisher_type = 'club' then 'society' else 'profile' end)
      and (
        p_tab = 'per_te'
        or (
          case
            when fci.publisher_type = 'club'
              then exists (select 1 from followed_clubs fc where fc.club_id = fci.publisher_id)
            else exists (select 1 from followed_profiles fp where fp.profile_id = fci.publisher_id)
          end
        )
      )
    union all
    select g.g_published_at, fci.publisher_avatar_url
    from repost_groups g
    join public.feed_content_index fci
      on fci.content_type = g.g_content_type and fci.post_id = g.g_post_id
    where g.g_published_at > v_since
      -- HOM-11 §143: originale segnalato → niente wrapper.
      and not exists (
        select 1 from public.moderation_reports mr
        where mr.reporter_profile_id = v_uid
          and mr.target_type = 'CONTENT'
          and mr.target_content_type = g.g_content_type
          and mr.target_id = g.g_post_id)
    limit 100
  )
  select
    (select count(*)::int from fresh),
    (select max(f.published_at) from fresh f),
    coalesce(
      (
        select array_agg(a.publisher_avatar_url)
        from (
          select f.publisher_avatar_url
          from fresh f
          where f.publisher_avatar_url is not null
          order by f.published_at desc
          limit 3
        ) a
      ),
      '{}'::text[]
    );
end;
$function$;

CREATE OR REPLACE FUNCTION public.footme_feed_readable_items(p_viewer uuid, p_content_types text[], p_post_ids uuid[])
 RETURNS TABLE(r_content_type text, r_post_id uuid, r_content_format text, r_excerpt text, r_body text, r_publisher_type text, r_publisher_id uuid, r_source_kind text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with keys as (
    select distinct k.content_type, k.post_id
    from unnest(p_content_types, p_post_ids) as k(content_type, post_id)
  ),
  blocked as (
    select k.b_kind, k.b_id from public.footme_blocked_keys(p_viewer) k
  )
  select
    fci.content_type, fci.post_id, fci.content_format, fci.excerpt, fci.body,
    fci.publisher_type, fci.publisher_id, fci.source_kind
  from keys k
  join public.feed_content_index fci
    on fci.content_type = k.content_type and fci.post_id = k.post_id
  -- Predicati espliciti sugli array: il join con `unnest` da solo potrebbe non
  -- essere spinto dentro i sei rami della vista, che verrebbe scansionata
  -- intera per una pagina di 10 elementi.
  where fci.content_type = any(p_content_types)
    and fci.post_id = any(p_post_ids)
    and fci.published_at <= timezone('utc', now())
    and not exists (
      select 1 from blocked bl
      where bl.b_id = fci.publisher_id
        and bl.b_kind = case when fci.publisher_type = 'club' then 'society' else 'profile' end);
$function$;

CREATE OR REPLACE FUNCTION public.footme_post_payloads(p_viewer uuid, p_content_types text[], p_post_ids uuid[])
 RETURNS TABLE(r_content_type text, r_post_id uuid, payload jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with blocked as (
    select k.b_kind, k.b_id from public.footme_blocked_keys(p_viewer) k
  ),

  -- Solo ciò che il Feed mostrerebbe: la regola vive in
  -- footme_feed_readable_items (pubblicato, non programmato, autore profilo non
  -- bloccato in nessuna direzione), la stessa che usano il poll dei media e lo
  -- stato interazioni.
  base as (
    select
      ri.r_content_type as content_type, ri.r_post_id as post_id,
      ri.r_content_format as content_format, ri.r_excerpt as excerpt,
      ri.r_body as body, ri.r_publisher_type as publisher_type,
      ri.r_publisher_id as publisher_id, ri.r_source_kind as source_kind
    from public.footme_feed_readable_items(p_viewer, p_content_types, p_post_ids) ri
  ),

  media_agg as (
    select
      m.content_type, m.post_id,
      jsonb_agg(public.footme_media_json(m) order by m.position) as media
    from public.content_post_media m
    join base b on b.content_type = m.content_type and b.post_id = m.post_id
    group by m.content_type, m.post_id
  ),

  -- HOM-07: i Mi piace da footme_visible_likes (definizione unica di «chi ha
  -- messo Mi piace»: attori esistenti, non sospesi, non bloccati con il viewer)
  -- e, per il viewer, le sole sue identità di interazione che hanno messo Mi
  -- piace. Nessuna identità altrui esce dal payload.
  likes_agg as (
    select
      vl.v_content_type as content_type,
      vl.v_post_id      as post_id,
      count(*)::int     as n,
      coalesce(
        jsonb_agg(
          jsonb_build_object('type', vl.v_actor_type, 'id', vl.v_actor_id)
          order by vl.v_created_at, vl.v_actor_type, vl.v_actor_id
        ) filter (where mi.c_id is not null),
        '[]'::jsonb
      ) as liked_as
    from (
      select
        array_agg(b.content_type order by b.content_type, b.post_id) as cts,
        array_agg(b.post_id      order by b.content_type, b.post_id) as pids
      from base b
    ) k
    cross join lateral public.footme_visible_likes(p_viewer, k.cts, k.pids) vl
    left join public.footme_interaction_identities(p_viewer) mi
      on mi.c_type = vl.v_actor_type and mi.c_id = vl.v_actor_id
    group by vl.v_content_type, vl.v_post_id
  ),

  -- HOM-07 §133: lo stato Salvato del viewer sui sei contenuti salvabili.
  saved_agg as (
    select sv.content_type, sv.post_id
    from (
      select 'club_media'::text as content_type, x.post_id
      from public.saved_club_media x
      join base b on b.content_type = 'club_media' and b.post_id = x.post_id
      where x.profile_id = p_viewer
      union all
      select 'media_profile', x.post_id
      from public.saved_media_profile_posts x
      join base b on b.content_type = 'media_profile' and b.post_id = x.post_id
      where x.profile_id = p_viewer
      union all
      select 'media_tribuna', x.post_id
      from public.saved_media_tribuna x
      join base b on b.content_type = 'media_tribuna' and b.post_id = x.post_id
      where x.profile_id = p_viewer
      union all
      select 'fan_tribuna', x.post_id
      from public.saved_fan_tribuna x
      join base b on b.content_type = 'fan_tribuna' and b.post_id = x.post_id
      where x.profile_id = p_viewer
      union all
      select 'fan_media', x.post_id
      from public.saved_fan_media x
      join base b on b.content_type = 'fan_media' and b.post_id = x.post_id
      where x.profile_id = p_viewer
      union all
      select 'profile_post', x.post_id
      from public.saved_profile_posts x
      join base b on b.content_type = 'profile_post' and b.post_id = x.post_id
      where x.profile_id = p_viewer
    ) sv
  ),

  -- HOM-08: i commenti da footme_visible_comments (definizione unica di «commento
  -- visibile al viewer»: root + risposte attivi, autore visibile, tombstone e
  -- placeholder mai contati; commenti nascosti = 0).
  comments_agg as (
    select vc.content_type, vc.content_id as post_id, count(*)::int as n
    from (
      select
        array_agg(b.content_type order by b.content_type, b.post_id) as cts,
        array_agg(b.post_id      order by b.content_type, b.post_id) as pids
      from base b
    ) k
    cross join lateral public.footme_visible_comments(p_viewer, k.cts, k.pids) vc
    group by vc.content_type, vc.content_id
  ),

  -- HOM-08: can_comment richiede almeno un'identità con cui commentare (§42–§43).
  has_identity as (
    select exists (select 1 from public.footme_interaction_identities(p_viewer)) as yes
  ),

  -- HOM-10 §32, §44: can_repost richiede almeno un'identità che può ripostare
  -- (footme_can_repost, D1) oltre a un contenuto ripostabile e leggibile.
  repost_identity as (
    select exists (
      select 1
      from public.footme_publishing_identities(p_viewer) i
      where public.footme_can_repost(p_viewer, i.c_type, i.c_id)) as yes
  ),

  -- Solo tag attivi (§20). fan_tribuna conserva un display_name proprio, usato
  -- come ripiego se l'identità non si risolve più.
  tags_raw as (
    select 'club_media'::text as content_type, t.post_id,
           t.target_type, coalesce(t.target_id, t.profile_id) as target_id,
           null::text as fallback_name, t.created_at
    from public.club_media_tagged_profiles t
    join base b on b.content_type = 'club_media' and b.post_id = t.post_id
    where t.status = 'active'
    union all
    select 'fan_tribuna', t.post_id,
           t.target_type, coalesce(t.target_id, t.player_profile_id),
           t.display_name, t.created_at
    from public.fan_tribuna_tagged_players t
    join base b on b.content_type = 'fan_tribuna' and b.post_id = t.post_id
    where t.status = 'active'
    union all
    select 'media_profile', t.post_id, t.target_type, t.target_id, null::text, t.created_at
    from public.media_profile_post_tagged_targets t
    join base b on b.content_type = 'media_profile' and b.post_id = t.post_id
    where t.status = 'active'
    union all
    select 'profile_post', t.post_id, t.target_type, t.target_id, null::text, t.created_at
    from public.profile_post_tagged_targets t
    join base b on b.content_type = 'profile_post' and b.post_id = t.post_id
    where t.status = 'active'
  ),
  tags_resolved as (
    select
      tr.content_type, tr.post_id, tr.created_at, tr.target_id,
      jsonb_build_object(
        'identity_id',   tr.target_id,
        'identity_type', tr.target_type,
        'display_name',  coalesce(
                           case tr.target_type
                             when 'profile' then pr.full_name
                             when 'club'    then cl.name
                             when 'team'    then ct.name
                           end,
                           tr.fallback_name
                         ),
        'avatar_url',    case tr.target_type
                           when 'profile' then pr.avatar_url
                           when 'club'    then cl.logo_url
                           when 'team'    then coalesce(ct.logo_url, tcl.logo_url)
                         end
      ) as tag,
      coalesce(
        case tr.target_type
          when 'profile' then pr.full_name
          when 'club'    then cl.name
          when 'team'    then ct.name
        end,
        tr.fallback_name
      ) as resolved_name
    from tags_raw tr
    left join public.profiles pr   on tr.target_type = 'profile' and pr.id = tr.target_id
    left join public.clubs cl      on tr.target_type = 'club'    and cl.id = tr.target_id
    left join public.club_teams ct on tr.target_type = 'team'    and ct.id = tr.target_id
    left join public.clubs tcl     on tr.target_type = 'team'    and tcl.id = ct.club_id
    where not exists (
      select 1 from blocked bl
      where bl.b_id = case tr.target_type when 'team' then ct.club_id else tr.target_id end
        and bl.b_kind = case tr.target_type when 'club' then 'society' when 'team' then 'society' when 'profile' then 'profile' end)
  ),
  tags_agg as (
    select
      t.content_type, t.post_id,
      jsonb_agg(t.tag order by t.created_at, t.target_id) as tagged
    from tags_resolved t
    where t.resolved_name is not null
    group by t.content_type, t.post_id
  ),

  -- Identità che pubblica (§80) e dati grezzi per la seconda riga (§9).
  -- Società → 'society'; contenuti di un profilo Media → 'media'; ogni altro
  -- caso (persone, tifosi) → 'person'. La corrente appartenenza di una persona
  -- usa la stessa derivazione di fetch_home_suggested_profiles.
  authored as (
    select
      b.content_type, b.post_id, b.body, b.excerpt, b.source_kind,
      public.footme_feed_item_type(b.content_type, b.content_format) as item_type,
      case
        when b.publisher_type = 'club'                                then 'society'
        when b.content_type in ('media_profile', 'media_tribuna')     then 'media'
        else 'person'
      end as identity_type,
      pr.role::text                as person_role,
      pl.primary_position::text    as person_position,
      cur.club_name,
      cur.team_label,
      cl.category                  as club_category,
      -- HOM-11 §54, §62: il Follow globale del viewer verso l'identità autrice
      -- (club_follows per la Società, profile_follows per persona e Media).
      case
        when b.publisher_type = 'club'
          then exists (select 1 from public.club_follows f
                       where f.profile_id = p_viewer and f.club_id = b.publisher_id)
        else exists (select 1 from public.profile_follows f
                     where f.follower_profile_id = p_viewer
                       and f.followed_profile_id = b.publisher_id)
      end as viewer_follows_author,
      -- HOM-11 §126, §174: il viewer ha già segnalato questo contenuto (canonico).
      exists (select 1 from public.moderation_reports mr
              where mr.reporter_profile_id = p_viewer
                and mr.target_type = 'CONTENT'
                and mr.target_content_type = b.content_type
                and mr.target_id = b.post_id) as viewer_has_reported
    from base b
    left join public.clubs cl
      on b.publisher_type = 'club' and cl.id = b.publisher_id
    left join public.profiles pr
      on b.publisher_type = 'profile' and pr.id = b.publisher_id
    left join public.player_profiles pl
      on pl.profile_id = pr.id and pr.role::text = 'player'
    left join lateral (
      select c.name as club_name, ct.name as team_label
      from public.club_members cm
      join public.clubs c on c.id = cm.club_id
      left join public.club_teams ct on ct.id = cm.team_id
      where cm.profile_id = pr.id
        and cm.status = 'active'
        and cm.is_current = true
      order by cm.created_at desc
      limit 1
    ) cur on true
  )

  select
    a.content_type as r_content_type,
    a.post_id      as r_post_id,
    jsonb_build_object(
      'author_identity_type', a.identity_type,
      'author_meta', jsonb_build_object(
        'role',             case when a.identity_type = 'person'  then a.person_role end,
        'primary_position', case when a.identity_type = 'person'  then a.person_position end,
        'club_name',        case when a.identity_type = 'person'  then a.club_name end,
        'team_label',       case when a.identity_type = 'person'  then a.team_label end,
        'club_category',    case when a.identity_type = 'society' then a.club_category end,
        'media_kind',       case when a.identity_type = 'media'   then a.source_kind end
      ),
      'media',        coalesce(ma.media, '[]'::jsonb),
      'mentions',     coalesce(ex.mentions, '[]'::jsonb),
      'tagged',       coalesce(ta.tagged, '[]'::jsonb),
      'link_preview', ex.link_preview,
      'likes_count',    coalesce(la.n, 0),
      'comments_count', coalesce(ca.n, 0),
      'comments_enabled', coalesce(cs.comments_enabled, true),
      'is_liked',       jsonb_array_length(coalesce(la.liked_as, '[]'::jsonb)) > 0,
      'liked_as',       coalesce(la.liked_as, '[]'::jsonb),
      'is_saved',       sa.post_id is not null,
      -- HOM-11 §54, §126: stato del viewer per il menu (Non seguire / Segnalazione inviata).
      'viewer_follows_author', a.viewer_follows_author,
      'viewer_has_reported',   a.viewer_has_reported,
      'capabilities', jsonb_build_object(
        'can_like',          a.content_type in ('club_media', 'fan_media', 'profile_post', 'media_profile'),
        'can_comment',       public.footme_content_readable(p_viewer, a.content_type, a.post_id)
                             and coalesce(cs.comments_enabled, true) and hid.yes,
        'can_share',         true,
        'can_repost',        a.content_type in ('club_media', 'fan_media', 'profile_post', 'media_profile')
                             and rid.yes
                             and public.footme_content_readable(p_viewer, a.content_type, a.post_id),
        'can_save',          true,
        -- HOM-11 §4–§7: la stessa regola di gestione del menu owner HOM-04
        -- (footme_viewer_manages_content), non più solo «autore = viewer».
        'can_report',        not public.footme_viewer_manages_content(p_viewer, a.content_type, a.post_id),
        'can_edit',          coalesce(cr.r_can_edit, false),
        'can_delete',        coalesce(cr.r_can_delete, false),
        'can_view_insights', coalesce(cr.r_can_view_insights, false)
      ),
      -- HOM-10 §45–§46, §88: la reference del Post (null se non ne ha), un livello solo.
      'reference', public.footme_repost_reference_json(p_viewer, ex.referenced_content_type, ex.referenced_content_id),
      'status', 'published',
      -- HOM-04 §73: versione minima per l'editor (updated_at, ISO UTC).
      'version', to_char(cr.r_updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    )
    -- HOM-03: il Post porta il testo intero; Articolo e video editoriale no
    -- (un articolo può pesare migliaia di caratteri e la preview non lo usa) e
    -- portano invece summary: l'excerpt della vista, al massimo 280 caratteri.
    || case
         when a.item_type = 'post'
           then jsonb_build_object('body', coalesce(a.body, ''))
         else jsonb_build_object('summary', left(nullif(trim(a.excerpt), ''), 280))
       end
    as payload
  from authored a
  cross join has_identity hid
  cross join repost_identity rid
  -- HOM-04: capability e versione dalla regola unica footme_content_rights,
  -- una sola chiamata per elemento. Non passa da content_manage_capabilities,
  -- che solleva senza sessione: il Feed resta leggibile anche senza utente.
  -- Lo stato 'published' è già garantito da base, quindi i r_can_* bastano.
  -- footme_content_rights usa auth.uid(); i chiamanti passano p_viewer = auth.uid().
  left join lateral public.footme_content_rights(a.content_type, a.post_id) cr on true
  left join media_agg ma    on ma.content_type = a.content_type and ma.post_id = a.post_id
  left join likes_agg la    on la.content_type = a.content_type and la.post_id = a.post_id
  left join saved_agg sa    on sa.content_type = a.content_type and sa.post_id = a.post_id
  left join comments_agg ca on ca.content_type = a.content_type and ca.post_id = a.post_id
  left join public.content_comment_settings cs
    on cs.content_type = a.content_type and cs.content_id = a.post_id
  left join tags_agg ta     on ta.content_type = a.content_type and ta.post_id = a.post_id
  left join public.content_post_extras ex
    on ex.content_type = a.content_type and ex.post_id = a.post_id;
$function$;

CREATE OR REPLACE FUNCTION public.fetch_home_suggested_clubs(p_limit integer DEFAULT 6)
 RETURNS TABLE(item_uid text, entity_id uuid, name text, logo_url text, city text, province text, region text, category text, open_positions_count integer, is_following boolean, is_saved boolean, suggestion_reason_key text, suggestion_reason_label text, component_version smallint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid    uuid := auth.uid();
  v_limit  int := least(greatest(coalesce(p_limit, 6), 1), 20);
  v_region text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select p.region into v_region from public.profiles p where p.id = v_uid;

  return query
  with open_ads as (
    select ra.club_id, count(*)::int as open_count
    from public.recruiting_ads ra
    where ra.status = 'published'
      and (ra.deadline is null or ra.deadline >= current_date)
    group by ra.club_id
  )
  select
    'club:' || c.id::text as item_uid,
    c.id                  as entity_id,
    c.name,
    c.logo_url,
    c.city,
    c.province,
    c.region,
    c.category,
    coalesce(oa.open_count, 0) as open_positions_count,
    false                 as is_following,
    (sv.club_id is not null) as is_saved,
    case
      when v_region is not null and c.region = v_region then 'same_region'
      else 'not_followed_yet'
    end                   as suggestion_reason_key,
    public.footme_feed_reason_label(
      case
        when v_region is not null and c.region = v_region then 'same_region'
        else 'not_followed_yet'
      end
    )                     as suggestion_reason_label,
    public.footme_feed_component_version('suggested_clubs') as component_version
  from public.clubs c
  left join open_ads oa on oa.club_id = c.id
  left join public.saved_clubs sv
    on sv.owner_profile_id = v_uid and sv.club_id = c.id
  where c.owner_profile_id is distinct from v_uid
    and not exists (select 1 from public.footme_blocked_keys(v_uid) bk where bk.b_kind = 'society' and bk.b_id = c.id)
    and not exists (
      select 1 from public.club_follows cf
      where cf.profile_id = v_uid and cf.club_id = c.id
    )
  order by
    (v_region is not null and c.region = v_region) desc,
    (coalesce(oa.open_count, 0) > 0) desc,
    c.name asc,
    c.id asc
  limit v_limit;
end;
$function$;

-- ============================================================
-- SEZIONE 8 — Cerca e mention (§68-§74, §127-§129, §134, §179, §182)
-- Il blocco di una PERSONA non nasconde la sua Società né le sue Posizioni
-- (§70, §127); una Società bloccata nasconde Società, squadre, Posizioni e
-- contenuti. Le funzioni invoker (search_clubs_page) usano l'helper a zero
-- argomenti.
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_profiles_page(p_query text DEFAULT NULL::text, p_role app_role DEFAULT NULL::app_role, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_filters jsonb DEFAULT NULL::jsonb, p_sort text DEFAULT 'relevance'::text)
 RETURNS TABLE(profile_id uuid, full_name text, avatar_url text, role app_role, region text, city text, primary_position player_position, current_club_name text, current_team_name text, age integer, is_available boolean, birth_year integer, is_open_to_transfer boolean, current_category text, coach_primary_role text, coach_top_license text, coach_context text, open_to_new_role boolean, staff_primary_role text, experience_summary text, open_to_work boolean, agency_name text, managed_players_count text, agent_operating_areas text[], open_to_players boolean, years_experience integer, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid          uuid := auth.uid();
  v_term         text := trim(coalesce(p_query, ''));
  v_limit        int  := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset       int  := greatest(coalesce(p_offset, 0), 0);
  v_filters      jsonb := coalesce(p_filters, '{}'::jsonb);
  v_sort         text := coalesce(nullif(trim(p_sort), ''), 'relevance');
  v_current_year int  := extract(year from current_date)::int;
  v_viewer_region text;
  v_swap         int;

  -- "Settore giovanile" category set, shared by coach_context and the
  -- staff scope fallback heuristic. Keep aligned with the categories
  -- surfaced by onboarding (player-sports.ts YOUTH_CATEGORY_OPTIONS /
  -- PLAYER_CATEGORY_OPTIONS use a slightly different list; this is the
  -- coarser "youth vs first team" split used only for search filters).
  v_youth_categories text[] := array[
    'Juniores', 'Allievi', 'Giovanissimi', 'Berretti', 'Scuola Calcio', 'Settore Giovanile'
  ];

  -- shared
  v_region       text;
  v_is_available boolean;

  -- player
  v_p_positions           public.player_position[];
  v_p_classe_min          int;
  v_p_classe_max          int;
  v_p_situation           text;
  v_p_categories          text[];
  v_p_provinces           text[];
  v_p_transfer_areas      text[];
  v_p_is_open_to_transfer boolean;
  v_p_preferred_foot      public.preferred_foot;
  v_p_height_min          int;
  v_p_height_max          int;
  v_p_has_video           boolean;

  -- coach
  v_c_role               text;
  v_c_licenses           text[];
  v_c_context            text;
  v_c_min_seasons        int;
  v_c_coached_categories text[];
  v_c_provinces          text[];
  v_c_open_to_new_role   boolean;
  v_c_backgrounds        text[];

  -- staff
  v_s_roles              text[];
  v_s_has_certifications boolean;
  v_s_certifications     text[];
  v_s_categories         text[];
  v_s_scope              text;
  v_s_provinces          text[];
  v_s_open_to_work       boolean;

  -- agent
  v_a_operating_areas        text[];
  v_a_player_types           text[];
  v_a_managed_bands          text[];
  v_a_min_years              int;
  v_a_is_federation_licensed boolean;
  v_a_open_to_players        boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_role is not null and p_role::text not in ('player', 'coach', 'staff', 'agent') then
    raise exception 'Ruolo di ricerca non supportato';
  end if;

  if v_sort not in ('relevance', 'recent', 'vicini', 'classe_asc', 'classe_desc') then
    raise exception 'Ordinamento non supportato';
  end if;

  -- -------------------------------------------------------
  -- Filter extraction: defensive parsing of p_filters.
  -- Unknown keys are ignored. Enum-typed columns are only ever cast from
  -- client text after checking it against enum_range(...) — client text is
  -- NEVER cast blindly to an enum. Plain text[] overlap filters do not need
  -- this guard (no cast happens, equality/overlap against garbage values is
  -- simply a no-match). Numeric filters are clamped to sane bounds and
  -- swapped when min > max.
  -- -------------------------------------------------------

  v_region := nullif(trim(coalesce(v_filters ->> 'region', '')), '');
  v_is_available := (v_filters ->> 'is_available')::boolean;

  -- player.positions
  select array_agg(pos)
  into v_p_positions
  from (
    select distinct (elem)::public.player_position as pos
    from jsonb_array_elements_text(coalesce(v_filters #> '{player,positions}', '[]'::jsonb)) as elem
    where elem = any(enum_range(null::public.player_position)::text[])
  ) valid_positions;

  -- player.classe_min / classe_max (canonical = birth year)
  v_p_classe_min := nullif(v_filters #>> '{player,classe_min}', '')::int;
  v_p_classe_max := nullif(v_filters #>> '{player,classe_max}', '')::int;

  if v_p_classe_min is not null then
    v_p_classe_min := least(greatest(v_p_classe_min, 1940), v_current_year);
  end if;

  if v_p_classe_max is not null then
    v_p_classe_max := least(greatest(v_p_classe_max, 1940), v_current_year);
  end if;

  if v_p_classe_min is not null and v_p_classe_max is not null and v_p_classe_min > v_p_classe_max then
    v_swap := v_p_classe_min;
    v_p_classe_min := v_p_classe_max;
    v_p_classe_max := v_swap;
  end if;

  v_p_situation := case trim(coalesce(v_filters #>> '{player,situation}', ''))
    when 'svincolato'  then 'svincolato'
    when 'tesserato'   then 'tesserato'
    when 'disponibile' then 'disponibile'
    when 'in_scadenza' then 'in_scadenza'
    else null
  end;

  select array_agg(elem)
  into v_p_categories
  from jsonb_array_elements_text(coalesce(v_filters #> '{player,categories}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  select array_agg(elem)
  into v_p_provinces
  from jsonb_array_elements_text(coalesce(v_filters #> '{player,provinces}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  select array_agg(elem)
  into v_p_transfer_areas
  from jsonb_array_elements_text(coalesce(v_filters #> '{player,transfer_areas}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  v_p_is_open_to_transfer := (v_filters #>> '{player,is_open_to_transfer}')::boolean;

  v_p_preferred_foot := case
    when (v_filters #>> '{player,preferred_foot}') = any(enum_range(null::public.preferred_foot)::text[])
      then (v_filters #>> '{player,preferred_foot}')::public.preferred_foot
    else null
  end;

  v_p_height_min := nullif(v_filters #>> '{player,height_min}', '')::int;
  v_p_height_max := nullif(v_filters #>> '{player,height_max}', '')::int;

  if v_p_height_min is not null then
    v_p_height_min := least(greatest(v_p_height_min, 100), 230);
  end if;

  if v_p_height_max is not null then
    v_p_height_max := least(greatest(v_p_height_max, 100), 230);
  end if;

  if v_p_height_min is not null and v_p_height_max is not null and v_p_height_min > v_p_height_max then
    v_swap := v_p_height_min;
    v_p_height_min := v_p_height_max;
    v_p_height_max := v_swap;
  end if;

  v_p_has_video := (v_filters #>> '{player,has_video}')::boolean;

  -- coach.*
  v_c_role := nullif(trim(coalesce(v_filters #>> '{coach,coach_role}', '')), '');

  select array_agg(elem)
  into v_c_licenses
  from jsonb_array_elements_text(coalesce(v_filters #> '{coach,licenses}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  v_c_context := case trim(coalesce(v_filters #>> '{coach,context}', ''))
    when 'prima_squadra'     then 'prima_squadra'
    when 'settore_giovanile' then 'settore_giovanile'
    when 'entrambi'          then 'entrambi'
    else null
  end;

  v_c_min_seasons := nullif(v_filters #>> '{coach,min_seasons}', '')::int;
  if v_c_min_seasons is not null then
    v_c_min_seasons := greatest(v_c_min_seasons, 0);
  end if;

  select array_agg(elem)
  into v_c_coached_categories
  from jsonb_array_elements_text(coalesce(v_filters #> '{coach,coached_categories}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  select array_agg(elem)
  into v_c_provinces
  from jsonb_array_elements_text(coalesce(v_filters #> '{coach,provinces}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  v_c_open_to_new_role := (v_filters #>> '{coach,open_to_new_role}')::boolean;

  select array_agg(elem)
  into v_c_backgrounds
  from jsonb_array_elements_text(coalesce(v_filters #> '{coach,backgrounds}', '[]'::jsonb)) as elem
  where elem in ('ex_calciatore', 'preparatore_atletico', 'collaboratore_tecnico', 'osservatore');

  -- staff.*
  select array_agg(elem)
  into v_s_roles
  from jsonb_array_elements_text(coalesce(v_filters #> '{staff,staff_roles}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  v_s_has_certifications := (v_filters #>> '{staff,has_certifications}')::boolean;

  select array_agg(elem)
  into v_s_certifications
  from jsonb_array_elements_text(coalesce(v_filters #> '{staff,certifications}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  select array_agg(elem)
  into v_s_categories
  from jsonb_array_elements_text(coalesce(v_filters #> '{staff,categories}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  v_s_scope := case trim(coalesce(v_filters #>> '{staff,scope}', ''))
    when 'prima_squadra'     then 'prima_squadra'
    when 'settore_giovanile' then 'settore_giovanile'
    when 'entrambi'          then 'entrambi'
    else null
  end;

  select array_agg(elem)
  into v_s_provinces
  from jsonb_array_elements_text(coalesce(v_filters #> '{staff,provinces}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  v_s_open_to_work := (v_filters #>> '{staff,open_to_work}')::boolean;

  -- agent.*
  select array_agg(elem)
  into v_a_operating_areas
  from jsonb_array_elements_text(coalesce(v_filters #> '{agent,operating_areas}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  select array_agg(elem)
  into v_a_player_types
  from jsonb_array_elements_text(coalesce(v_filters #> '{agent,player_types}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  select array_agg(elem)
  into v_a_managed_bands
  from jsonb_array_elements_text(coalesce(v_filters #> '{agent,managed_bands}', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  v_a_min_years := nullif(v_filters #>> '{agent,min_years}', '')::int;
  if v_a_min_years is not null then
    v_a_min_years := greatest(v_a_min_years, 0);
  end if;

  v_a_is_federation_licensed := (v_filters #>> '{agent,is_federation_licensed}')::boolean;
  v_a_open_to_players := (v_filters #>> '{agent,open_to_players}')::boolean;

  select p.region into v_viewer_region
  from public.profiles p
  where p.id = v_uid;

  return query
  select
    pwa.id                as profile_id,
    pwa.full_name,
    pwa.avatar_url,
    pwa.role,
    pwa.region,
    pwa.city,
    pp.primary_position,
    cm_club.name          as current_club_name,
    cm_team.name          as current_team_name,
    pwa.age,
    pwa.is_available,
    (case when pwa.birth_date is not null then extract(year from pwa.birth_date)::int else null end) as birth_year,
    pwa.is_open_to_transfer,
    coalesce(cm_team.category, cm_club.category) as current_category,
    cp.primary_role       as coach_primary_role,
    (case
      when 'UEFA Pro'       = any(coalesce(cp.licenses, '{}'::text[])) then 'UEFA Pro'
      when 'UEFA A'         = any(coalesce(cp.licenses, '{}'::text[])) then 'UEFA A'
      when 'UEFA B'         = any(coalesce(cp.licenses, '{}'::text[])) then 'UEFA B'
      when 'UEFA C'         = any(coalesce(cp.licenses, '{}'::text[])) then 'UEFA C'
      when 'Patentino base' = any(coalesce(cp.licenses, '{}'::text[])) then 'Patentino base'
      else null
    end)                  as coach_top_license,
    coach_ctx.value       as coach_context,
    cp.open_to_new_role,
    sp.primary_staff_role as staff_primary_role,
    sp.experience_summary,
    sp.open_to_work,
    ap.agency_name,
    ap.managed_players_count,
    coalesce(nullif(ap.operating_macro_areas, '{}'::text[]), ap.operating_regions) as agent_operating_areas,
    ap.open_to_players,
    (case when agent_start.min_start_year is not null then v_current_year - agent_start.min_start_year else null end) as years_experience,
    count(*) over () as total_count
  from public.profiles_with_age pwa
  left join public.player_profiles pp on pp.profile_id = pwa.id
  left join public.coach_profiles  cp on cp.profile_id = pwa.id
  left join public.staff_profiles  sp on sp.profile_id = pwa.id
  left join public.agent_profiles  ap on ap.profile_id = pwa.id
  left join lateral (
    select cm.club_id, cm.team_id
    from public.club_members cm
    where cm.profile_id = pwa.id
      and cm.status     = 'active'
      and cm.is_current = true
    order by cm.created_at desc
    limit 1
  ) cm on true
  left join public.clubs      cm_club on cm_club.id = cm.club_id
  left join public.club_teams cm_team on cm_team.id = cm.team_id
  -- coach_context: derived from coached_categories vs. the youth-set above.
  left join lateral (
    select case
      when 'Prima Squadra' = any(coalesce(cp.coached_categories, '{}'::text[]))
       and coalesce(cp.coached_categories, '{}'::text[]) && v_youth_categories
        then 'entrambi'
      when 'Prima Squadra' = any(coalesce(cp.coached_categories, '{}'::text[]))
        then 'prima_squadra'
      when coalesce(cp.coached_categories, '{}'::text[]) && v_youth_categories
        then 'settore_giovanile'
      else null
    end as value
  ) coach_ctx on true
  -- min_seasons proxy: distinct seasons[] labels + years covered by
  -- period_start_year..coalesce(period_end_year, current year) for entries
  -- that only recorded a period range. Best-effort, documented in the
  -- header comment above; sparse/legacy data can under-count.
  left join lateral (
    select count(distinct season_key) as season_count
    from (
      select unnest(cce.seasons) as season_key
      from public.coach_career_entries cce
      where cce.coach_profile_id = pwa.id
        and coalesce(array_length(cce.seasons, 1), 0) > 0
      union all
      select gs::text as season_key
      from public.coach_career_entries cce2
      cross join lateral generate_series(
        cce2.period_start_year,
        coalesce(cce2.period_end_year, v_current_year)
      ) as gs
      where cce2.coach_profile_id = pwa.id
        and coalesce(array_length(cce2.seasons, 1), 0) = 0
        and cce2.period_start_year is not null
    ) all_seasons
  ) coach_seasons on true
  -- staff scope: prefer the reliable club_teams.team_type discriminator of
  -- the current team when tesserato; otherwise fall back to the same
  -- youth-set heuristic applied to preferred_categories.
  left join lateral (
    select case
      when cm_team.team_type = 'senior' then 'prima_squadra'
      when cm_team.team_type = 'youth'  then 'settore_giovanile'
      when 'Prima Squadra' = any(coalesce(sp.preferred_categories, '{}'::text[]))
       and coalesce(sp.preferred_categories, '{}'::text[]) && v_youth_categories
        then 'entrambi'
      when 'Prima Squadra' = any(coalesce(sp.preferred_categories, '{}'::text[]))
        then 'prima_squadra'
      when coalesce(sp.preferred_categories, '{}'::text[]) && v_youth_categories
        then 'settore_giovanile'
      else null
    end as value
  ) staff_scope on true
  -- agent years_experience proxy: current year minus the earliest known
  -- start year across the agent_profiles row and agent_career_entries.
  left join lateral (
    select least(
      ap.period_start_year,
      (
        select min(ace.period_start_year)
        from public.agent_career_entries ace
        where ace.agent_profile_id = pwa.id
      )
    ) as min_start_year
  ) agent_start on true
  where pwa.role in ('player', 'coach', 'staff', 'agent')
    and (p_role is null or pwa.role = p_role)
    and not exists (select 1 from public.footme_blocked_keys(v_uid) bk where bk.b_kind = 'profile' and bk.b_id = pwa.id)
    and (v_term = '' or pwa.full_name ilike '%' || v_term || '%')

    -- shared
    and (v_region is null or pwa.region = v_region)
    and (v_is_available is null or pwa.is_available = v_is_available)

    -- player
    and (
      p_role is distinct from 'player' or v_p_positions is null
      or pp.primary_position = any(v_p_positions)
      or pp.secondary_positions && v_p_positions
    )
    and (
      p_role is distinct from 'player'
      or (v_p_classe_min is null and v_p_classe_max is null)
      or (
        extract(year from pwa.birth_date)::int >= coalesce(v_p_classe_min, 1940)
        and extract(year from pwa.birth_date)::int <= coalesce(v_p_classe_max, v_current_year)
      )
    )
    and (
      p_role is distinct from 'player' or v_p_situation is null
      or (v_p_situation = 'svincolato'  and cm.club_id is null)
      or (v_p_situation = 'tesserato'   and cm.club_id is not null)
      or (v_p_situation = 'disponibile' and (pwa.is_open_to_transfer or pp.willing_to_change_club))
      or (
        v_p_situation = 'in_scadenza'
        and pp.contract_expiry is not null
        and pp.contract_expiry <= (current_date + interval '6 months')::date
      )
    )
    and (
      p_role is distinct from 'player' or v_p_categories is null
      or coalesce(cm_team.category, cm_club.category) = any(v_p_categories)
    )
    and (
      p_role is distinct from 'player' or v_p_provinces is null
      or pp.transfer_provinces && v_p_provinces
    )
    and (
      p_role is distinct from 'player' or v_p_transfer_areas is null
      or pp.availability_type = 'ITALY'
      or pp.transfer_regions && v_p_transfer_areas
    )
    and (
      p_role is distinct from 'player' or v_p_is_open_to_transfer is null
      or pwa.is_open_to_transfer = v_p_is_open_to_transfer
    )
    and (
      p_role is distinct from 'player' or v_p_preferred_foot is null
      or pp.preferred_foot = v_p_preferred_foot
    )
    and (
      p_role is distinct from 'player'
      or (v_p_height_min is null and v_p_height_max is null)
      or (
        pp.height_cm is not null
        and pp.height_cm >= coalesce(v_p_height_min, 100)
        and pp.height_cm <= coalesce(v_p_height_max, 230)
      )
    )
    and (
      p_role is distinct from 'player' or coalesce(v_p_has_video, false) = false
      or (
        nullif(pp.highlight_video_url, '') is not null
        or coalesce(array_length(pp.media_urls, 1), 0) > 0
        or coalesce(jsonb_array_length(pp.media_items), 0) > 0
      )
    )

    -- coach
    and (
      p_role is distinct from 'coach' or v_c_role is null
      or cp.primary_role = v_c_role
    )
    and (
      p_role is distinct from 'coach' or v_c_licenses is null
      or cp.licenses && v_c_licenses
    )
    and (
      p_role is distinct from 'coach' or v_c_context is null
      or coach_ctx.value = v_c_context
    )
    and (
      p_role is distinct from 'coach' or v_c_min_seasons is null
      or coalesce(coach_seasons.season_count, 0) >= v_c_min_seasons
    )
    and (
      p_role is distinct from 'coach' or v_c_coached_categories is null
      or cp.coached_categories && v_c_coached_categories
    )
    and (
      p_role is distinct from 'coach' or v_c_provinces is null
      or cp.preferred_provinces && v_c_provinces
    )
    and (
      p_role is distinct from 'coach' or v_c_open_to_new_role is null
      or cp.open_to_new_role = v_c_open_to_new_role
    )
    and (
      p_role is distinct from 'coach' or v_c_backgrounds is null
      or (
        (
          not ('ex_calciatore' = any(v_c_backgrounds))
          or exists (
            select 1 from public.coach_player_career_entries cpce
            where cpce.coach_profile_id = pwa.id
          )
        )
        and (
          not ('preparatore_atletico' = any(v_c_backgrounds))
          or exists (
            select 1 from public.coach_career_entries cce
            where cce.coach_profile_id = pwa.id and cce.role ilike '%preparatore atletico%'
            union all
            select 1 from public.coach_director_career_entries cde
            where cde.coach_profile_id = pwa.id and cde.role ilike '%preparatore atletico%'
          )
        )
        and (
          not ('collaboratore_tecnico' = any(v_c_backgrounds))
          or exists (
            select 1 from public.coach_career_entries cce
            where cce.coach_profile_id = pwa.id and cce.role ilike '%collaboratore tecnico%'
            union all
            select 1 from public.coach_director_career_entries cde
            where cde.coach_profile_id = pwa.id and cde.role ilike '%collaboratore tecnico%'
          )
        )
        and (
          not ('osservatore' = any(v_c_backgrounds))
          or exists (
            select 1 from public.coach_career_entries cce
            where cce.coach_profile_id = pwa.id and cce.role ilike '%osservatore%'
            union all
            select 1 from public.coach_director_career_entries cde
            where cde.coach_profile_id = pwa.id and cde.role ilike '%osservatore%'
          )
        )
      )
    )

    -- staff
    and (
      p_role is distinct from 'staff' or v_s_roles is null
      or sp.primary_staff_role = any(v_s_roles)
      or sp.staff_roles && v_s_roles
    )
    and (
      p_role is distinct from 'staff' or v_s_has_certifications is null
      or (coalesce(array_length(sp.certifications, 1), 0) > 0) = v_s_has_certifications
    )
    and (
      p_role is distinct from 'staff' or v_s_certifications is null
      or sp.certifications && v_s_certifications
    )
    and (
      p_role is distinct from 'staff' or v_s_categories is null
      or sp.preferred_categories && v_s_categories
    )
    and (
      p_role is distinct from 'staff' or v_s_scope is null
      or staff_scope.value = v_s_scope
    )
    and (
      p_role is distinct from 'staff' or v_s_provinces is null
      or sp.preferred_provinces && v_s_provinces
    )
    and (
      p_role is distinct from 'staff' or v_s_open_to_work is null
      or sp.open_to_work = v_s_open_to_work
    )

    -- agent
    and (
      p_role is distinct from 'agent' or v_a_operating_areas is null
      or ap.operating_regions && v_a_operating_areas
      or ap.operating_macro_areas && v_a_operating_areas
    )
    and (
      p_role is distinct from 'agent' or v_a_player_types is null
      or ap.player_types && v_a_player_types
      or 'Entrambi' = any(ap.player_types)
    )
    and (
      p_role is distinct from 'agent' or v_a_managed_bands is null
      or ap.managed_players_count = any(v_a_managed_bands)
    )
    and (
      p_role is distinct from 'agent' or v_a_min_years is null
      or (
        agent_start.min_start_year is not null
        and (v_current_year - agent_start.min_start_year) >= v_a_min_years
      )
    )
    and (
      p_role is distinct from 'agent' or v_a_is_federation_licensed is null
      or ap.is_federation_licensed = v_a_is_federation_licensed
    )
    and (
      p_role is distinct from 'agent' or v_a_open_to_players is null
      or ap.open_to_players = v_a_open_to_players
    )
  order by
    (case when v_sort = 'vicini' and v_viewer_region is not null and pwa.region = v_viewer_region then 0 else 1 end) asc,
    (case when v_sort in ('relevance', 'vicini') and v_term <> '' then similarity(lower(pwa.full_name), lower(v_term)) else 0 end) desc,
    (case when v_sort = 'recent' then pwa.updated_at end) desc nulls last,
    (case when v_sort = 'classe_asc' then pwa.birth_date end) asc nulls last,
    (case when v_sort = 'classe_desc' then pwa.birth_date end) desc nulls last,
    pwa.full_name asc,
    pwa.id asc
  limit v_limit
  offset v_offset;
end;
$function$;

CREATE OR REPLACE FUNCTION public.search_clubs_page(p_query text DEFAULT NULL::text, p_kind text DEFAULT NULL::text, p_filters jsonb DEFAULT NULL::jsonb, p_sort text DEFAULT 'relevance'::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(kind text, entity_id uuid, name text, logo_url text, city text, region text, category text, parent_club_id uuid, parent_club_name text, is_affiliate boolean, has_senior boolean, has_youth boolean, affiliate_count integer, open_positions_count integer, total_count bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  v_uid    uuid  := auth.uid();
  v_term   text  := trim(coalesce(p_query, ''));
  v_limit  int   := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset int   := greatest(coalesce(p_offset, 0), 0);
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb);
  v_sort   text  := coalesce(nullif(trim(p_sort), ''), 'relevance');
  v_viewer_region text;

  v_categories      text[];
  v_region          text;
  v_city            text;
  v_has_senior      boolean;
  v_has_youth       boolean;
  v_has_teams       boolean;
  v_has_affiliates  boolean;
  v_open_positions  boolean;
  v_target_roles    text[];
  v_followed        boolean;
  v_saved           boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_kind is not null and p_kind not in ('club', 'team', 'affiliate') then
    raise exception 'Filtro società non supportato';
  end if;

  if v_sort not in ('relevance', 'vicini', 'recent', 'positions', 'name') then
    raise exception 'Ordinamento non supportato';
  end if;

  -- -------------------------------------------------------
  -- Filter extraction (defensive; unknown keys ignored — see
  -- 20260724100000_search_profiles_filters.sql for the same style).
  -- -------------------------------------------------------

  select array_agg(elem)
  into v_categories
  from jsonb_array_elements_text(coalesce(v_filters -> 'categories', '[]'::jsonb)) as elem
  where nullif(trim(elem), '') is not null;

  v_region := nullif(trim(coalesce(v_filters ->> 'region', '')), '');
  v_city   := nullif(trim(coalesce(v_filters ->> 'city', '')), '');

  v_has_senior     := (v_filters ->> 'has_senior')::boolean;
  v_has_youth      := (v_filters ->> 'has_youth')::boolean;
  v_has_teams      := (v_filters ->> 'has_teams')::boolean;
  v_has_affiliates := (v_filters ->> 'has_affiliates')::boolean;
  v_open_positions := (v_filters ->> 'open_positions')::boolean;

  select array_agg(elem)
  into v_target_roles
  from jsonb_array_elements_text(coalesce(v_filters -> 'target_roles', '[]'::jsonb)) as elem
  where elem in ('player', 'coach', 'staff');

  v_followed := (v_filters ->> 'followed')::boolean;
  v_saved    := (v_filters ->> 'saved')::boolean;

  select p.region into v_viewer_region
  from public.profiles p
  where p.id = v_uid;

  return query
  with
  clubs_q as (
    select
      'club'::text          as kind,
      c.id                  as entity_id,
      c.name                as name,
      c.logo_url            as logo_url,
      c.city                as city,
      c.region              as region,
      c.category            as category,
      null::uuid            as parent_club_id,
      null::text            as parent_club_name,
      exists (
        select 1 from public.club_affiliations ca
        where ca.affiliate_club_id = c.id
      )                     as is_affiliate,
      exists (
        select 1 from public.club_teams ct
        where ct.club_id = c.id and ct.team_type = 'senior'
      )                     as has_senior,
      exists (
        select 1 from public.club_teams ct
        where ct.club_id = c.id and ct.team_type = 'youth'
      )                     as has_youth,
      (
        select count(*)::int from public.club_affiliations ca
        where ca.club_id = c.id
      )                     as affiliate_count,
      (
        -- Same "published" predicate + club link as search_positions_page.
        select count(*)::int from public.recruiting_ads ra
        where ra.club_id = c.id and ra.status = 'published'
      )                     as open_positions_count,
      c.updated_at          as updated_at,
      (case when v_term <> '' then similarity(lower(c.name), lower(v_term)) else 0 end) as rank_score
    from public.clubs c
    where (v_term = '' or c.name ilike '%' || v_term || '%')
      and not exists (select 1 from public.footme_my_blocked_keys() bk where bk.b_kind = 'society' and bk.b_id = c.id)
  ),
  teams_q as (
    select
      'team'::text          as kind,
      ct.id                 as entity_id,
      ct.name               as name,
      ct.logo_url           as logo_url,
      ct.city               as city,
      ct.region             as region,
      ct.category           as category,
      parent.id             as parent_club_id,
      parent.name           as parent_club_name,
      false                 as is_affiliate,
      null::boolean         as has_senior,
      null::boolean         as has_youth,
      null::int             as affiliate_count,
      null::int             as open_positions_count,
      ct.updated_at         as updated_at,
      (case when v_term <> '' then similarity(lower(ct.name), lower(v_term)) else 0 end) as rank_score
    from public.club_teams ct
    join public.clubs parent on parent.id = ct.club_id
    where (v_term = '' or ct.name ilike '%' || v_term || '%')
      and not exists (select 1 from public.footme_my_blocked_keys() bk where bk.b_kind = 'society' and bk.b_id = parent.id)
  ),
  combined as (
    select * from clubs_q
    union all
    select * from teams_q
  ),
  filtered as (
    select combined.*
    from combined
    where
      case p_kind
        when 'club'      then combined.kind = 'club'
        when 'team'       then combined.kind = 'team'
        when 'affiliate'  then combined.kind = 'club' and combined.is_affiliate
        else true
      end
      and (
        v_categories is null
        or exists (
          select 1 from unnest(v_categories) as cat
          where combined.category ilike '%' || cat || '%'
        )
      )
      and (v_region is null or combined.region = v_region)
      and (v_city is null or combined.city ilike '%' || v_city || '%')
      and (coalesce(v_has_senior, false) = false or combined.has_senior = true)
      and (coalesce(v_has_youth, false) = false or combined.has_youth = true)
      and (
        coalesce(v_has_teams, false) = false
        or combined.has_senior = true
        or combined.has_youth = true
      )
      and (
        coalesce(v_has_affiliates, false) = false
        or coalesce(combined.affiliate_count, 0) > 0
      )
      and (
        coalesce(v_open_positions, false) = false
        or coalesce(combined.open_positions_count, 0) > 0
      )
      and (
        v_target_roles is null
        or exists (
          select 1 from public.recruiting_ads ra
          where ra.club_id = combined.entity_id
            and ra.status = 'published'
            and ra.target_role = any(v_target_roles)
        )
      )
      and (
        coalesce(v_followed, false) = false
        or exists (
          select 1 from public.club_follows cf
          where cf.profile_id = v_uid and cf.club_id = combined.entity_id
        )
      )
      and (
        coalesce(v_saved, false) = false
        or exists (
          select 1 from public.saved_clubs sc
          where sc.owner_profile_id = v_uid and sc.club_id = combined.entity_id
        )
      )
  )
  select
    filtered.kind,
    filtered.entity_id,
    filtered.name,
    filtered.logo_url,
    filtered.city,
    filtered.region,
    filtered.category,
    filtered.parent_club_id,
    filtered.parent_club_name,
    filtered.is_affiliate,
    filtered.has_senior,
    filtered.has_youth,
    filtered.affiliate_count,
    filtered.open_positions_count,
    count(*) over ()::bigint as total_count
  from filtered
  order by
    (case
      when v_sort = 'vicini' and v_viewer_region is not null and filtered.region = v_viewer_region
      then 0 else 1
    end) asc,
    (case when v_sort in ('relevance', 'vicini') then filtered.rank_score else 0 end) desc,
    (case when v_sort = 'recent' then filtered.updated_at end) desc nulls last,
    (case when v_sort = 'positions' then filtered.open_positions_count end) desc nulls last,
    filtered.name asc,
    filtered.entity_id asc
  limit v_limit
  offset v_offset;
end;
$function$;

CREATE OR REPLACE FUNCTION public.search_global(p_query text, p_per_category integer DEFAULT 3, p_content_limit integer DEFAULT 2)
 RETURNS TABLE(group_key text, target_type text, target_id uuid, title text, subtitle text, image_url text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid  uuid := auth.uid();
  v_term text := trim(coalesce(p_query, ''));
  -- Client-controlled sizes are clamped as defense in depth.
  v_per_category  int := least(greatest(coalesce(p_per_category, 3), 1), 10);
  v_content_limit int := least(greatest(coalesce(p_content_limit, 2), 0), 10);
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if length(v_term) < 2 then
    return;
  end if;

  return query

  with

  -- -------------------------------------------------------
  -- PROFILO: player / coach / staff / agent
  -- Subtitle built per-role, same pattern as search_tag_targets.
  -- -------------------------------------------------------
  profilo_ranked as (
    select
      pwa.id                             as target_id,
      pwa.full_name                      as title,
      coalesce(
        case pwa.role::text

          when 'player' then (
            select
              case
                when player_info.team_or_club is not null
                  and player_info.pos_label is not null
                then player_info.team_or_club || ' • ' || player_info.pos_label
                when player_info.team_or_club is not null
                then player_info.team_or_club
                else player_info.pos_label
              end
            from (
              select
                nullif(trim(coalesce(ct.name, c.name, '')), '') as team_or_club,
                -- Italian labels, mirroring getPlayerPositionLabel on the client
                -- (subtitle is prebuilt here, so the client cannot re-format it).
                case pp.primary_position::text
                  when 'goalkeeper'           then 'Portiere'
                  when 'defender'             then 'Difensore'
                  when 'center_back'          then 'Difensore centrale'
                  when 'right_back'           then 'Terzino destro'
                  when 'left_back'            then 'Terzino sinistro'
                  when 'midfielder'           then 'Centrocampista'
                  when 'defensive_midfielder' then 'Centrocampista difensivo'
                  when 'central_midfielder'   then 'Centrocampista centrale'
                  when 'attacking_midfielder' then 'Trequartista'
                  when 'right_winger'         then 'Ala destra'
                  when 'left_winger'          then 'Ala sinistra'
                  when 'striker'              then 'Attaccante'
                  when 'forward'              then 'Attaccante'
                  else nullif(trim(pp.primary_position::text), '')
                end as pos_label
              from public.player_profiles pp
              left join lateral (
                select cm.club_id, cm.team_id
                from public.club_members cm
                where cm.profile_id = pwa.id
                  and cm.status     = 'active'
                  and cm.is_current = true
                order by cm.created_at desc
                limit 1
              ) cm on true
              left join public.clubs      c  on c.id  = cm.club_id
              left join public.club_teams ct on ct.id = cm.team_id
              where pp.profile_id = pwa.id
            ) player_info
          )

          when 'coach' then (
            select
              case
                when nullif(trim(coalesce(cp.current_club, '')), '') is not null
                  and nullif(trim(coalesce(cp.primary_role, '')), '') is not null
                then
                  nullif(trim(cp.current_club), '')
                  || ' • '
                  || nullif(trim(cp.primary_role), '')
                when nullif(trim(coalesce(cp.current_club, '')), '') is not null
                then nullif(trim(cp.current_club), '')
                when nullif(trim(coalesce(cp.primary_role, '')), '') is not null
                then nullif(trim(cp.primary_role), '')
                else null
              end
            from public.coach_profiles cp
            where cp.profile_id = pwa.id
          )

          when 'staff' then (
            select
              case
                when nullif(trim(coalesce(c.name, '')), '') is not null
                  and nullif(trim(coalesce(sp.primary_staff_role, '')), '') is not null
                then
                  nullif(trim(c.name), '')
                  || ' • '
                  || nullif(trim(sp.primary_staff_role), '')
                when nullif(trim(coalesce(c.name, '')), '') is not null
                then nullif(trim(c.name), '')
                when nullif(trim(coalesce(sp.primary_staff_role, '')), '') is not null
                then nullif(trim(sp.primary_staff_role), '')
                else null
              end
            from public.staff_profiles sp
            left join lateral (
              select cm.club_id
              from public.club_members cm
              where cm.profile_id = pwa.id
                and cm.status     = 'active'
                and cm.is_current = true
              order by cm.created_at desc
              limit 1
            ) cm on true
            left join public.clubs c on c.id = cm.club_id
            where sp.profile_id = pwa.id
          )

          when 'agent' then 'Procuratore'

          else null
        end,
        pwa.city,
        ''
      )                                   as subtitle,
      pwa.avatar_url                      as image_url,
      similarity(lower(pwa.full_name), lower(v_term)) as rank_score
    from public.profiles_with_age pwa
    where pwa.role in ('player', 'coach', 'staff', 'agent')
      and pwa.full_name ilike '%' || v_term || '%'
      and not exists (select 1 from public.footme_blocked_keys(v_uid) bk where bk.b_kind = 'profile' and bk.b_id = pwa.id)
  ),
  profilo as (
    select
      'profilo'::text  as group_key,
      'profile'::text  as target_type,
      pr.target_id,
      pr.title,
      pr.subtitle,
      pr.image_url,
      row_number() over (order by pr.rank_score desc) as rnk
    from profilo_ranked pr
    order by pr.rank_score desc
    limit v_per_category
  ),

  -- -------------------------------------------------------
  -- SOCIETA: clubs + club_teams (squadre interne)
  -- -------------------------------------------------------
  club_match as (
    select
      c.id                                as target_id,
      c.name                               as title,
      array_to_string(
        array_remove(
          array[
            nullif(trim(coalesce(c.category, c.league, '')), ''),
            nullif(trim(coalesce(c.city, '')), '')
          ],
          null
        ),
        ' • '
      )                                    as subtitle,
      c.logo_url                           as image_url,
      similarity(lower(c.name), lower(v_term)) as rank_score
    from public.clubs c
    where c.name ilike '%' || v_term || '%'
      and not exists (select 1 from public.footme_blocked_keys(v_uid) bk where bk.b_kind = 'society' and bk.b_id = c.id)
  ),
  team_match as (
    select
      ct.id                                as target_id,
      ct.name                              as title,
      'Squadra interna • ' || parent.name  as subtitle,
      ct.logo_url                          as image_url,
      similarity(lower(ct.name), lower(v_term)) as rank_score
    from public.club_teams ct
    join public.clubs parent on parent.id = ct.club_id
    where ct.name ilike '%' || v_term || '%'
      and not exists (select 1 from public.footme_blocked_keys(v_uid) bk where bk.b_kind = 'society' and bk.b_id = parent.id)
  ),
  societa_ranked as (
    select 'club'::text as target_type, * from club_match
    union all
    select 'club_team'::text as target_type, * from team_match
  ),
  societa as (
    select
      'societa'::text as group_key,
      sr.target_type,
      sr.target_id,
      sr.title,
      sr.subtitle,
      sr.image_url,
      row_number() over (order by sr.rank_score desc) as rnk
    from societa_ranked sr
    order by sr.rank_score desc
    limit v_per_category
  ),

  -- -------------------------------------------------------
  -- POSIZIONE: published recruiting ads
  -- -------------------------------------------------------
  posizione_ranked as (
    select
      ra.id                                as target_id,
      ra.title                             as title,
      array_to_string(
        array_remove(
          array[
            nullif(trim(c.name), ''),
            nullif(trim(ct.name), ''),
            nullif(trim(ra.category), '')
          ],
          null
        ),
        ' • '
      )                                    as subtitle,
      c.logo_url                           as image_url,
      similarity(lower(ra.title), lower(v_term)) as rank_score,
      ra.published_at                      as published_at
    from public.recruiting_ads ra
    join public.clubs c on c.id = ra.club_id
    left join public.club_teams ct on ct.id = ra.team_id
    where ra.status = 'published'
      and not exists (select 1 from public.footme_blocked_keys(v_uid) bk where bk.b_kind = 'society' and bk.b_id = ra.club_id)
      and (
        ra.title ilike '%' || v_term || '%'
        or ra.description ilike '%' || v_term || '%'
        or c.name ilike '%' || v_term || '%'
      )
  ),
  posizione as (
    select
      'posizione'::text     as group_key,
      'recruiting_ad'::text as target_type,
      pzr.target_id,
      pzr.title,
      pzr.subtitle,
      pzr.image_url,
      row_number() over (order by pzr.rank_score desc, pzr.published_at desc) as rnk
    from posizione_ranked pzr
    order by pzr.rank_score desc, pzr.published_at desc
    limit v_per_category
  ),

  -- -------------------------------------------------------
  -- CONTENUTO: club_media_posts + fan_tribuna_posts (published only)
  -- Combined and capped to p_content_limit total, most recent first.
  -- -------------------------------------------------------
  content_club_media as (
    select
      cmp.id                                        as target_id,
      cmp.title                                      as title,
      'Contenuto club'::text                         as subtitle,
      coalesce(cmp.thumbnail_url, cmp.visual_url)    as image_url,
      cmp.published_at                               as published_at
    from public.club_media_posts cmp
    where cmp.status = 'published'
      and cmp.title ilike '%' || v_term || '%'
      and not exists (select 1 from public.footme_blocked_keys(v_uid) bk where bk.b_kind = 'society' and bk.b_id = cmp.club_id)
  ),
  content_fan_tribuna as (
    select
      ftp.id                as target_id,
      ftp.title             as title,
      'Tribuna tifosi'::text as subtitle,
      null::text            as image_url,
      ftp.published_at      as published_at
    from public.fan_tribuna_posts ftp
    where ftp.status = 'published'
      and ftp.title ilike '%' || v_term || '%'
      and not exists (select 1 from public.footme_blocked_keys(v_uid) bk where bk.b_kind = 'profile' and bk.b_id = ftp.profile_id)
  ),
  contenuto_ranked as (
    select 'club_media'::text as target_type, * from content_club_media
    union all
    select 'fan_tribuna'::text as target_type, * from content_fan_tribuna
  ),
  contenuto as (
    select
      'contenuto'::text as group_key,
      cr.target_type,
      cr.target_id,
      cr.title,
      cr.subtitle,
      cr.image_url,
      row_number() over (order by cr.published_at desc) as rnk
    from contenuto_ranked cr
    order by cr.published_at desc
    limit v_content_limit
  )

  select combined.group_key, combined.target_type, combined.target_id,
         combined.title, combined.subtitle, combined.image_url
  from (
    select *, 1 as group_order from societa
    union all
    select *, 2 as group_order from profilo
    union all
    select *, 3 as group_order from posizione
    union all
    select *, 4 as group_order from contenuto
  ) combined
  order by combined.group_order, combined.rnk;
end;
$function$;

CREATE OR REPLACE FUNCTION public.search_media_content_page(p_query text DEFAULT NULL::text, p_filters jsonb DEFAULT NULL::jsonb, p_sort text DEFAULT 'pertinenza'::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(content_type text, post_id uuid, content_format text, kind text, kind_label text, title text, thumbnail_url text, media_type text, duration_seconds integer, publisher_type text, publisher_id uuid, publisher_name text, publisher_avatar_url text, source_kind text, published_at timestamp with time zone, is_saved boolean, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid      uuid   := auth.uid();
  v_filters  jsonb  := coalesce(p_filters, '{}'::jsonb);
  v_sort     text   := coalesce(nullif(trim(coalesce(p_sort, '')), ''), 'pertinenza');
  v_limit    int    := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset   int    := greatest(coalesce(p_offset, 0), 0);
  v_norm     text   := public.footme_normalize_lookup(coalesce(p_query, ''));
  v_tokens   text[] := public.footme_search_tokens(p_query);
  v_formats    text[];
  v_sources    text[];
  v_categories text[];
  v_regions    text[];
  v_provinces  text[];
  v_since      timestamptz;
  v_saved_only        boolean := (v_filters ->> 'saved')::boolean;
  v_followed_sources  boolean := (v_filters ->> 'followed_sources')::boolean;
  v_followed_clubs    boolean := (v_filters ->> 'followed_clubs')::boolean;
  v_followed_profiles boolean := (v_filters ->> 'followed_profiles')::boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_sort not in ('pertinenza', 'recenti', 'evidenza', 'discussi') then
    raise exception 'Ordinamento non supportato';
  end if;

  -- Gli array jsonb vengono validati contro i valori attesi: un valore
  -- sconosciuto viene scartato, non passato al motore di ricerca.
  select nullif(array_agg(distinct v), '{}'::text[]) into v_formats
  from jsonb_array_elements_text(coalesce(v_filters -> 'formats', '[]'::jsonb)) as v
  where v in ('articolo', 'video', 'foto', 'post');

  select nullif(array_agg(distinct v), '{}'::text[]) into v_sources
  from jsonb_array_elements_text(coalesce(v_filters -> 'sources', '[]'::jsonb)) as v
  where v in ('ufficiale', 'testata', 'giornalista', 'creator', 'pagina');

  select nullif(array_agg(distinct trim(v)), '{}'::text[]) into v_categories
  from jsonb_array_elements_text(coalesce(v_filters -> 'categories', '[]'::jsonb)) as v
  where length(trim(v)) > 0;

  select nullif(array_agg(distinct trim(v)), '{}'::text[]) into v_regions
  from jsonb_array_elements_text(coalesce(v_filters -> 'regions', '[]'::jsonb)) as v
  where length(trim(v)) > 0;

  select nullif(array_agg(distinct trim(v)), '{}'::text[]) into v_provinces
  from jsonb_array_elements_text(coalesce(v_filters -> 'provinces', '[]'::jsonb)) as v
  where length(trim(v)) > 0;

  v_since := case v_filters ->> 'published_within'
    when 'today'  then date_trunc('day', timezone('utc', now()))
    when 'last7'  then timezone('utc', now()) - interval '7 days'
    when 'last30' then timezone('utc', now()) - interval '30 days'
    else null
  end;

  return query
  with saved as (
    select 'club_media'::text as content_type, s.post_id
      from public.saved_club_media s          where s.profile_id = v_uid
    union all
    select 'media_profile', s.post_id
      from public.saved_media_profile_posts s  where s.profile_id = v_uid
    union all
    select 'media_tribuna', s.post_id
      from public.saved_media_tribuna s        where s.profile_id = v_uid
    union all
    select 'fan_tribuna', s.post_id
      from public.saved_fan_tribuna s          where s.profile_id = v_uid
    union all
    select 'fan_media', s.post_id
      from public.saved_fan_media s            where s.profile_id = v_uid
  ),
  followed as (
    select 'profile'::text as publisher_type, f.followed_profile_id as publisher_id
      from public.profile_follows f where f.follower_profile_id = v_uid
    union all
    select 'club', f.club_id
      from public.club_follows f   where f.profile_id = v_uid
  ),
  flags as (
    select
      mci.content_type,
      mci.post_id,
      mci.content_format,
      mci.kind,
      mci.title,
      mci.thumbnail_url,
      mci.media_type,
      mci.duration_seconds,
      mci.publisher_type,
      mci.publisher_id,
      mci.publisher_name,
      mci.publisher_avatar_url,
      mci.source_kind,
      mci.published_at,
      mci.engagement_count,
      mci.title_norm,
      (sv.post_id is not null)                                              as is_saved,
      public.footme_tokens_all_present(v_tokens, mci.publisher_norm)        as pub_match,
      public.footme_tokens_all_present(v_tokens, mci.tagged_norm)           as tag_match,
      public.footme_tokens_all_present(v_tokens, mci.title_norm)            as title_match,
      public.footme_tokens_any_present(v_tokens, mci.categories_norm)       as cat_match,
      public.footme_tokens_any_present(v_tokens, mci.territory_norm)        as geo_match
    from public.media_content_index mci
    left join saved sv
      on sv.content_type = mci.content_type and sv.post_id = mci.post_id
    where public.footme_tokens_all_present(v_tokens, mci.search_blob)
      and not exists (
        select 1 from public.footme_blocked_keys(v_uid) bk
        where bk.b_id = mci.publisher_id
          and bk.b_kind = case when mci.publisher_type = 'club' then 'society' else 'profile' end)
      and (v_formats    is null or mci.content_format = any(v_formats))
      and (v_sources    is null or mci.source_kind    = any(v_sources))
      and (v_regions    is null or mci.regions   && v_regions)
      and (v_provinces  is null or mci.provinces && v_provinces)
      and (
        v_categories is null
        or exists (
          select 1
          from unnest(mci.categories) as have, unnest(v_categories) as want
          where have ilike '%' || want || '%'
        )
      )
      and (v_since is null or mci.published_at >= v_since)
      and (coalesce(v_saved_only, false) = false or sv.post_id is not null)
      and (
        coalesce(v_followed_sources, false) = false
        or exists (
          select 1 from followed fo
          where fo.publisher_type = mci.publisher_type
            and fo.publisher_id = mci.publisher_id
        )
      )
      and (
        coalesce(v_followed_clubs, false) = false
        or exists (
          select 1 from public.club_follows cf
          where cf.profile_id = v_uid
            and (
              (mci.publisher_type = 'club' and cf.club_id = mci.publisher_id)
              or cf.club_id = any(mci.tagged_club_ids)
            )
        )
      )
      and (
        coalesce(v_followed_profiles, false) = false
        or exists (
          select 1 from public.profile_follows pf
          where pf.follower_profile_id = v_uid
            and (
              (mci.publisher_type = 'profile' and pf.followed_profile_id = mci.publisher_id)
              or pf.followed_profile_id = any(mci.tagged_profile_ids)
            )
        )
      )
  )
  select
    f.content_type,
    f.post_id,
    f.content_format,
    f.kind,
    public.footme_content_kind_label(f.content_type, f.kind) as kind_label,
    f.title,
    f.thumbnail_url,
    f.media_type,
    f.duration_seconds,
    f.publisher_type,
    f.publisher_id,
    f.publisher_name,
    f.publisher_avatar_url,
    f.source_kind,
    f.published_at,
    f.is_saved,
    count(*) over ()::bigint as total_count
  from flags f
  order by
    -- §9: pubblicato dal soggetto cercato > soggetto taggato > editoriale
    -- pertinente > altri contenuti correlati. Coerenza categoria+territorio
    -- vale come massima pertinenza per le query di categoria/zona.
    (case
       when v_sort <> 'pertinenza' or cardinality(v_tokens) = 0 then 0
       when f.pub_match                                         then 0
       when f.cat_match and f.geo_match                         then 0
       when f.tag_match                                         then 1
       when f.title_match
         and f.source_kind in ('testata', 'giornalista')        then 2
       when f.title_match                                       then 3
       else 4
     end) asc,
    (case
       when v_sort = 'pertinenza' and cardinality(v_tokens) > 0
       then similarity(f.title_norm, v_norm)
       else 0
     end) desc,
    (case when v_sort = 'discussi' then f.engagement_count else 0 end) desc,
    (case
       when v_sort = 'evidenza'
       then f.engagement_count::numeric / (
         1 + greatest(
           0,
           extract(epoch from (timezone('utc', now()) - f.published_at)) / 86400
         )
       )
       else 0
     end) desc,
    f.published_at desc nulls last,
    f.post_id asc
  limit v_limit
  offset v_offset;
end;
$function$;

CREATE OR REPLACE FUNCTION public.search_media_sources_page(p_query text DEFAULT NULL::text, p_filters jsonb DEFAULT NULL::jsonb, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(source_type text, source_kind text, entity_id uuid, name text, avatar_url text, description text, regions text[], categories text[], topics text[], is_verified boolean, content_count integer, last_published_at timestamp with time zone, is_following boolean, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid     uuid   := auth.uid();
  v_filters jsonb  := coalesce(p_filters, '{}'::jsonb);
  v_limit   int    := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset  int    := greatest(coalesce(p_offset, 0), 0);
  v_norm    text   := public.footme_normalize_lookup(coalesce(p_query, ''));
  v_tokens  text[] := public.footme_search_tokens(p_query);
  v_sources    text[];
  v_categories text[];
  v_regions    text[];
  v_provinces  text[];
  v_followed_only boolean := (v_filters ->> 'followed_sources')::boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select nullif(array_agg(distinct v), '{}'::text[]) into v_sources
  from jsonb_array_elements_text(coalesce(v_filters -> 'sources', '[]'::jsonb)) as v
  where v in ('ufficiale', 'testata', 'giornalista', 'creator', 'pagina');

  select nullif(array_agg(distinct trim(v)), '{}'::text[]) into v_categories
  from jsonb_array_elements_text(coalesce(v_filters -> 'categories', '[]'::jsonb)) as v
  where length(trim(v)) > 0;

  select nullif(array_agg(distinct trim(v)), '{}'::text[]) into v_regions
  from jsonb_array_elements_text(coalesce(v_filters -> 'regions', '[]'::jsonb)) as v
  where length(trim(v)) > 0;

  select nullif(array_agg(distinct trim(v)), '{}'::text[]) into v_provinces
  from jsonb_array_elements_text(coalesce(v_filters -> 'provinces', '[]'::jsonb)) as v
  where length(trim(v)) > 0;

  return query
  with followed as (
    select 'media_profile'::text as source_type, f.followed_profile_id as entity_id
      from public.profile_follows f where f.follower_profile_id = v_uid
    union all
    select 'club', f.club_id
      from public.club_follows f   where f.profile_id = v_uid
  ),
  filtered as (
    select
      msi.source_type,
      msi.source_kind,
      msi.entity_id,
      msi.name,
      msi.avatar_url,
      msi.description,
      msi.regions,
      msi.categories,
      msi.topics,
      msi.is_verified,
      msi.content_count,
      msi.last_published_at,
      msi.name_norm,
      (fo.entity_id is not null)                                    as is_following,
      public.footme_tokens_all_present(v_tokens, msi.name_norm)      as name_match
    from public.media_source_index msi
    left join followed fo
      on fo.source_type = msi.source_type and fo.entity_id = msi.entity_id
    where public.footme_tokens_all_present(v_tokens, msi.search_blob)
      and not exists (
        select 1 from public.footme_blocked_keys(v_uid) bk
        where bk.b_id = msi.entity_id
          and bk.b_kind = case when msi.source_type = 'club' then 'society' else 'profile' end)
      and (v_sources   is null or msi.source_kind = any(v_sources))
      and (v_regions   is null or msi.regions   && v_regions)
      and (v_provinces is null or msi.provinces && v_provinces)
      and (
        v_categories is null
        or exists (
          select 1
          from unnest(msi.categories) as have, unnest(v_categories) as want
          where have ilike '%' || want || '%'
        )
      )
      and (coalesce(v_followed_only, false) = false or fo.entity_id is not null)
  )
  select
    f.source_type,
    f.source_kind,
    f.entity_id,
    f.name,
    f.avatar_url,
    f.description,
    f.regions,
    f.categories,
    f.topics,
    f.is_verified,
    f.content_count,
    f.last_published_at,
    f.is_following,
    count(*) over ()::bigint as total_count
  from filtered f
  order by
    (case when cardinality(v_tokens) > 0 and f.name_match then 0 else 1 end) asc,
    (case
       when cardinality(v_tokens) > 0 then similarity(f.name_norm, v_norm)
       else 0
     end) desc,
    f.content_count desc,
    f.last_published_at desc nulls last,
    f.name asc,
    f.entity_id asc
  limit v_limit
  offset v_offset;
end;
$function$;

CREATE OR REPLACE FUNCTION public.search_media_suggestions(p_query text, p_per_group integer DEFAULT 3)
 RETURNS TABLE(group_key text, group_order integer, target_type text, target_id uuid, label text, subtitle text, image_url text, search_term text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid   uuid := auth.uid();
  v_size  int  := least(greatest(coalesce(p_per_group, 3), 1), 10);
  v_term  text := trim(coalesce(p_query, ''));
  v_norm  text := public.footme_normalize_lookup(coalesce(p_query, ''));
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if length(v_term) < 2 or length(v_norm) = 0 then
    return;
  end if;

  return query
  with societa as (
    select
      'societa'::text                              as group_key,
      1                                            as group_order,
      'club'::text                                 as target_type,
      c.id                                         as target_id,
      c.name                                       as label,
      'Società e contenuti correlati'::text        as subtitle,
      c.logo_url                                   as image_url,
      null::text                                   as search_term,
      row_number() over (
        order by similarity(public.footme_normalize_lookup(c.name), v_norm) desc, c.name asc
      )                                            as rnk
    from public.clubs c
    where position(v_norm in public.footme_normalize_lookup(c.name)) > 0
      and not exists (select 1 from public.footme_blocked_keys(v_uid) bk where bk.b_kind = 'society' and bk.b_id = c.id)
  ),
  squadre as (
    select
      'societa'::text                              as group_key,
      1                                            as group_order,
      'club_team'::text                            as target_type,
      ct.id                                        as target_id,
      ct.name                                      as label,
      concat_ws(' · ', 'Squadra', ct.category)     as subtitle,
      ct.logo_url                                  as image_url,
      null::text                                   as search_term,
      row_number() over (
        order by similarity(public.footme_normalize_lookup(ct.name), v_norm) desc, ct.name asc
      )                                            as rnk
    from public.club_teams ct
    where position(v_norm in public.footme_normalize_lookup(ct.name)) > 0
      and not exists (select 1 from public.footme_blocked_keys(v_uid) bk where bk.b_kind = 'society' and bk.b_id = ct.club_id)
  ),
  fonti as (
    select
      'fonte'::text                                as group_key,
      2                                            as group_order,
      msi.source_type                              as target_type,
      msi.entity_id                                as target_id,
      msi.name                                     as label,
      concat_ws(' · ',
        case msi.source_kind
          when 'testata'     then 'Testata sportiva'
          when 'giornalista' then 'Giornalista sportivo'
          when 'creator'     then 'Creator'
          when 'ufficiale'   then 'Profilo ufficiale'
          else 'Pagina sportiva'
        end,
        (select r from unnest(msi.regions) as r limit 1)
      )                                            as subtitle,
      msi.avatar_url                               as image_url,
      null::text                                   as search_term,
      row_number() over (
        order by similarity(msi.name_norm, v_norm) desc, msi.content_count desc, msi.name asc
      )                                            as rnk
    from public.media_source_index msi
    -- Solo profili Media: le società compaiono già nel gruppo "societa" e
    -- una riga per entità evita suggerimenti duplicati. La classificazione
    -- "Profilo ufficiale" resta comunque disponibile nei filtri Fonte e
    -- nella lista fonti di search_media_sources_page.
    where msi.source_type = 'media_profile'
      and position(v_norm in msi.search_blob) > 0
      and not exists (select 1 from public.footme_blocked_keys(v_uid) bk where bk.b_kind = 'profile' and bk.b_id = msi.entity_id)
  ),
  profili as (
    select
      'profilo'::text                              as group_key,
      3                                            as group_order,
      'profile'::text                              as target_type,
      p.id                                         as target_id,
      p.full_name                                  as label,
      concat_ws(' · ', p.role::text, p.region)     as subtitle,
      p.avatar_url                                 as image_url,
      null::text                                   as search_term,
      row_number() over (
        order by similarity(public.footme_normalize_lookup(p.full_name), v_norm) desc,
                 p.full_name asc
      )                                            as rnk
    from public.profiles p
    where p.role in ('player', 'coach', 'staff', 'director', 'agent')
      and position(v_norm in public.footme_normalize_lookup(p.full_name)) > 0
      and not exists (select 1 from public.footme_blocked_keys(v_uid) bk where bk.b_kind = 'profile' and bk.b_id = p.id)
  ),
  argomenti as (
    select
      'argomento'::text                            as group_key,
      4                                            as group_order,
      null::text                                   as target_type,
      null::uuid                                   as target_id,
      a.label                                      as label,
      'Argomento'::text                            as subtitle,
      null::text                                   as image_url,
      a.label                                      as search_term,
      row_number() over (order by length(a.label) asc, a.label asc) as rnk
    from (
      select distinct trim(raw.v) as label
      from (
        select c.category             as v from public.clubs c
        union all
        select mpp.category                from public.media_profile_posts mpp
          where mpp.status = 'published'
        union all
        select ftp.reference_category      from public.fan_tribuna_posts ftp
          where ftp.status = 'published'
        union all
        select fmp.tag                     from public.fan_media_posts fmp
          where fmp.status = 'published'
      ) raw
      where raw.v is not null
        and length(trim(raw.v)) > 0
        and position(v_norm in public.footme_normalize_lookup(raw.v)) > 0
    ) a
  ),
  territori as (
    select
      'territorio'::text                           as group_key,
      5                                            as group_order,
      null::text                                   as target_type,
      null::uuid                                   as target_id,
      t.label                                      as label,
      t.subtitle                                   as subtitle,
      null::text                                   as image_url,
      t.label                                      as search_term,
      row_number() over (order by t.subtitle asc, t.label asc) as rnk
    from (
      select distinct ic.region as label, 'Regione'::text as subtitle
      from public.italian_comuni ic
      where position(v_norm in public.footme_normalize_lookup(ic.region)) > 0
      union
      select distinct ic.province as label, 'Provincia'::text as subtitle
      from public.italian_comuni ic
      where position(v_norm in public.footme_normalize_lookup(ic.province)) > 0
    ) t
  ),
  combined as (
    select * from societa
    union all select * from squadre
    union all select * from fonti
    union all select * from profili
    union all select * from argomenti
    union all select * from territori
  )
  select
    combined.group_key,
    combined.group_order,
    combined.target_type,
    combined.target_id,
    combined.label,
    combined.subtitle,
    combined.image_url,
    combined.search_term
  from combined
  where combined.rnk <= v_size
  order by combined.group_order asc, combined.rnk asc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.search_positions_page(p_query text DEFAULT NULL::text, p_target text DEFAULT NULL::text, p_saved_only boolean DEFAULT false, p_positions text[] DEFAULT NULL::text[], p_primary_positions text[] DEFAULT NULL::text[], p_regions text[] DEFAULT NULL::text[], p_provinces text[] DEFAULT NULL::text[], p_categories text[] DEFAULT NULL::text[], p_team_type text DEFAULT NULL::text, p_club_id uuid DEFAULT NULL::uuid, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_radius_km double precision DEFAULT NULL::double precision, p_sort text DEFAULT NULL::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(ad_id uuid, title text, club_name text, club_logo_url text, team_name text, team_type text, role_required text, category text, city text, province text, region text, target_role text, deadline date, published_at timestamp with time zone, distance_km double precision, is_secondary_match boolean, is_saved boolean, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid    uuid := auth.uid();
  v_term   text := trim(coalesce(p_query, ''));
  v_limit  int  := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset int  := greatest(coalesce(p_offset, 0), 0);
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_target is not null and p_target not in ('player', 'coach', 'staff') then
    raise exception 'Ruolo target non supportato';
  end if;

  if p_sort is not null
     and p_sort not in ('pertinenza', 'recenti', 'vicinanza', 'categoria', 'localita') then
    raise exception 'Ordinamento non supportato';
  end if;

  return query
  with base as (
    select
      ra.id                                   as ad_id,
      ra.title                                as title,
      c.name                                  as club_name,
      c.logo_url                              as club_logo_url,
      ct.name                                 as team_name,
      ct.team_type                            as team_type,
      ra.role_required::text                  as role_required,
      ra.category                             as category,
      coalesce(ct.city, c.city)               as city,
      coalesce(ct.province, c.province)       as province,
      coalesce(ra.region, ct.region, c.region) as region,
      ra.target_role                          as target_role,
      ra.deadline                             as deadline,
      ra.published_at                         as published_at,
      case
        when p_lat is null or p_lng is null then null
        when coalesce(ct.latitude, c.latitude) is null then null
        else 6371 * acos(least(1, greatest(-1,
          sin(radians(p_lat)) * sin(radians(coalesce(ct.latitude, c.latitude))) +
          cos(radians(p_lat)) * cos(radians(coalesce(ct.latitude, c.latitude))) *
          cos(radians(coalesce(ct.longitude, c.longitude) - p_lng))
        )))
      end                                     as distance_km,
      coalesce(
        p_primary_positions is not null
          and not (ra.role_required::text = any(p_primary_positions)),
        false
      )                                       as is_secondary_match,
      exists (
        select 1 from public.saved_ads sa
        where sa.ad_id = ra.id and sa.profile_id = v_uid
      )                                       as is_saved,
      case
        when v_term <> '' then similarity(lower(ra.title), lower(v_term))
        else 0
      end                                     as title_sim
    from public.recruiting_ads ra
    join public.clubs c on c.id = ra.club_id
    left join public.club_teams ct on ct.id = ra.team_id
    where ra.status = 'published'
      and not exists (select 1 from public.footme_blocked_keys(v_uid) bk where bk.b_kind = 'society' and bk.b_id = ra.club_id)
      and (p_target is null or ra.target_role = p_target)
      and (
        v_term = ''
        or ra.title ilike '%' || v_term || '%'
        or ra.description ilike '%' || v_term || '%'
        or c.name ilike '%' || v_term || '%'
      )
      and (
        not p_saved_only
        or exists (
          select 1 from public.saved_ads sa
          where sa.ad_id = ra.id and sa.profile_id = v_uid
        )
      )
      -- role matching applies to player ads only
      and (
        p_positions is null
        or ra.target_role is distinct from 'player'
        or ra.role_required::text = any(p_positions)
      )
      and (p_regions is null
           or coalesce(ra.region, ct.region, c.region) = any(p_regions))
      and (p_provinces is null
           or coalesce(ct.province, c.province) = any(p_provinces))
      and (p_categories is null or ra.category = any(p_categories))
      and (p_team_type is null or ct.team_type = p_team_type)
      and (p_club_id is null or ra.club_id = p_club_id)
  )
  select
    base.ad_id,
    base.title,
    base.club_name,
    base.club_logo_url,
    base.team_name,
    base.team_type,
    base.role_required,
    base.category,
    base.city,
    base.province,
    base.region,
    base.target_role,
    base.deadline,
    base.published_at,
    base.distance_km,
    base.is_secondary_match,
    base.is_saved,
    count(*) over () as total_count
  from base
  where (
    p_lat is null or p_lng is null or p_radius_km is null
    or (base.distance_km is not null and base.distance_km <= p_radius_km)
  )
  order by
    -- the active sort mode leads; remaining keys break ties
    case when p_sort = 'vicinanza' then base.distance_km end asc nulls last,
    case when p_sort = 'recenti'   then base.published_at end desc nulls last,
    case when p_sort = 'categoria' then base.category end asc nulls last,
    case when p_sort = 'localita'  then base.region end asc nulls last,
    case when p_sort = 'localita'  then base.city end asc nulls last,
    base.is_secondary_match asc,
    base.title_sim desc,
    base.published_at desc,
    base.ad_id asc
  limit v_limit
  offset v_offset;
end;
$function$;

CREATE OR REPLACE FUNCTION public.search_tag_targets(p_query text, p_limit integer DEFAULT 20)
 RETURNS TABLE(target_type text, target_id uuid, display_name text, avatar_url text, role_label text, subtitle text, is_verified boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if length(trim(p_query)) < 2 then
    raise exception 'La ricerca richiede almeno 2 caratteri';
  end if;

  return query

    -- -------------------------------------------------------
    -- Profiles: player, coach, staff, director, media
    -- -------------------------------------------------------
    select
      'profile'::text                    as target_type,
      pwa.id                             as target_id,
      pwa.full_name                      as display_name,
      pwa.avatar_url                     as avatar_url,
      pwa.role::text                     as role_label,

      coalesce(
        case pwa.role::text

          -- ---- PLAYER ----------------------------------------
          when 'player' then (
            select
              case
                when nullif(trim(coalesce(ct.name, c.name, '')), '') is not null
                  and nullif(trim(pp.primary_position::text), '') is not null
                then
                  nullif(trim(coalesce(ct.name, c.name, '')), '')
                  || ' • '
                  || pp.primary_position::text

                when nullif(trim(coalesce(ct.name, c.name, '')), '') is not null
                then nullif(trim(coalesce(ct.name, c.name, '')), '')

                when nullif(trim(pp.primary_position::text), '') is not null
                then pp.primary_position::text

                else null
              end
            from public.player_profiles pp
            left join lateral (
              select cm.club_id, cm.team_id
              from public.club_members cm
              where cm.profile_id = pwa.id
                and cm.status     = 'active'
                and cm.is_current = true
              order by cm.created_at desc
              limit 1
            ) cm on true
            left join public.clubs      c  on c.id  = cm.club_id
            left join public.club_teams ct on ct.id = cm.team_id
            where pp.profile_id = pwa.id
          )

          -- ---- COACH -----------------------------------------
          when 'coach' then (
            select
              case
                when nullif(trim(coalesce(cp.current_club, '')), '') is not null
                  and nullif(trim(coalesce(cp.primary_role, '')), '') is not null
                then
                  nullif(trim(cp.current_club), '')
                  || ' • '
                  || nullif(trim(cp.primary_role), '')

                when nullif(trim(coalesce(cp.current_club, '')), '') is not null
                then nullif(trim(cp.current_club), '')

                when nullif(trim(coalesce(cp.primary_role, '')), '') is not null
                then nullif(trim(cp.primary_role), '')

                else null
              end
            from public.coach_profiles cp
            where cp.profile_id = pwa.id
          )

          -- ---- STAFF -----------------------------------------
          when 'staff' then (
            select
              case
                when nullif(trim(coalesce(c.name, '')), '') is not null
                  and nullif(trim(coalesce(sp.primary_staff_role, '')), '') is not null
                then
                  nullif(trim(c.name), '')
                  || ' • '
                  || nullif(trim(sp.primary_staff_role), '')

                when nullif(trim(coalesce(c.name, '')), '') is not null
                then nullif(trim(c.name), '')

                when nullif(trim(coalesce(sp.primary_staff_role, '')), '') is not null
                then nullif(trim(sp.primary_staff_role), '')

                else null
              end
            from public.staff_profiles sp
            left join lateral (
              select cm.club_id
              from public.club_members cm
              where cm.profile_id = pwa.id
                and cm.status     = 'active'
                and cm.is_current = true
              order by cm.created_at desc
              limit 1
            ) cm on true
            left join public.clubs c on c.id = cm.club_id
            where sp.profile_id = pwa.id
          )

          -- ---- DIRECTOR --------------------------------------
          when 'director' then (
            select
              case
                when nullif(trim(coalesce(c.name, '')), '') is not null
                  and nullif(trim(coalesce(dp.primary_role, '')), '') is not null
                then
                  nullif(trim(c.name), '')
                  || ' • '
                  || nullif(trim(dp.primary_role), '')

                when nullif(trim(coalesce(c.name, '')), '') is not null
                then nullif(trim(c.name), '')

                when nullif(trim(coalesce(dp.primary_role, '')), '') is not null
                then nullif(trim(dp.primary_role), '')

                else null
              end
            from public.director_profiles dp
            left join lateral (
              select cm.club_id
              from public.club_members cm
              where cm.profile_id = pwa.id
                and cm.status     = 'active'
                and cm.is_current = true
              order by cm.created_at desc
              limit 1
            ) cm on true
            left join public.clubs c on c.id = cm.club_id
            where dp.profile_id = pwa.id
          )

          else null
        end,
        -- Final fallback: city
        pwa.city
      , ''
      )                                  as subtitle,

      -- Stessa fonte di fetch_dashboard_identities e del Feed: solo il
      -- Media/Creator ha una verifica (media_profile_verifications); le
      -- persone no.
      (pwa.role::text = 'media' and exists (
         select 1 from public.media_profile_verifications mv
         where mv.media_profile_id = pwa.id
           and mv.verification_type = 'profile_verified'
           and mv.status = 'verified'
       ))                                 as is_verified

    from public.profiles_with_age pwa
    where pwa.role in ('player', 'coach', 'staff', 'director', 'media')
      and pwa.full_name ilike '%' || trim(p_query) || '%'
      and not exists (select 1 from public.footme_blocked_keys(auth.uid()) bk where bk.b_kind = 'profile' and bk.b_id = pwa.id)

    union all

    -- -------------------------------------------------------
    -- Clubs
    -- -------------------------------------------------------
    select
      'club'::text,
      c.id,
      c.name,
      c.logo_url,
      'club'::text,
      coalesce(c.city, '') as subtitle,
      (c.verification_status = 'verified') as is_verified
    from public.clubs c
    where c.name ilike '%' || trim(p_query) || '%'
      and not exists (select 1 from public.footme_blocked_keys(auth.uid()) bk where bk.b_kind = 'society' and bk.b_id = c.id)

    union all

    -- -------------------------------------------------------
    -- Club teams (squadre interne)
    -- -------------------------------------------------------
    select
      'team'::text,
      ct.id,
      ct.name,
      ct.logo_url,
      'team'::text,
      coalesce(ct.category, ct.city, '') as subtitle,
      false as is_verified
    from public.club_teams ct
    where ct.name ilike '%' || trim(p_query) || '%'
      and not exists (select 1 from public.footme_blocked_keys(auth.uid()) bk where bk.b_kind = 'society' and bk.b_id = ct.club_id)

    order by display_name
    limit p_limit;
end;
$function$;

-- ============================================================
-- SEZIONE 9 — Messaggi e destinatari Share (§86-§125, §183)
-- can_send (senza dire chi ha bloccato) in inbox e meta; i destinatari bloccati
-- sono ESCLUSI dalla ricerca Share (non marcati). is_direct_conversation_blocked,
-- open_direct_conversation, send_content_share e le policy messages/storage
-- leggono già la vista user_blocks: invariate (verificate in QA).
-- ============================================================

drop function if exists public.fetch_inbox_conversations(integer, integer, boolean);

CREATE OR REPLACE FUNCTION public.fetch_inbox_conversations(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_include_archived boolean DEFAULT false)
 RETURNS TABLE(conversation_id uuid, conversation_type text, display_title text, avatar_url text, other_profile_id uuid, participant_count integer, last_message_body text, last_message_kind text, last_message_sent_at timestamp with time zone, last_message_sender_profile_id uuid, last_message_sender_name text, unread_count bigint, archived boolean, blocked_by_me boolean, can_send boolean, group_avatar_path text, group_status text, last_message_system_event_type text, last_message_system_payload jsonb)
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
    coalesce(unread_summary.unread_count, 0)                         as unread_count,
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
    last_message.system_payload                                      as last_message_system_payload
  from public.conversation_participants my_participant
  join public.conversations c
    on c.id = my_participant.conversation_id
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
           m.system_event_type, m.system_payload
    from public.messages m
    where m.conversation_id = c.id
      and m.seq >= my_participant.access_from_seq
    order by m.seq desc
    limit 1
  ) last_message on true
  left join public.profiles last_message_sender
    on last_message_sender.id = last_message.sender_profile_id
  left join lateral (
    select count(*)::bigint as unread_count
    from public.messages m
    where m.conversation_id = c.id
      and m.message_kind <> 'system_event'
      and m.sender_profile_id <> v_uid
      and m.seq >= my_participant.access_from_seq
      and m.sent_at > coalesce(my_participant.last_read_at, '-infinity'::timestamptz)
  ) unread_summary on true
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
  order by coalesce(last_message.sent_at, c.created_at) desc
  limit p_limit
  offset p_offset;
end;
$function$;

drop function if exists public.fetch_direct_conversation_meta(uuid);

CREATE OR REPLACE FUNCTION public.fetch_direct_conversation_meta(target_conversation_id uuid)
 RETURNS TABLE(other_profile_id uuid, other_full_name text, other_avatar_url text, other_role app_role, other_primary_position player_position, club_id uuid, club_name text, club_category text, mutual_follow boolean, representation_active boolean, representation_type text, roster_linked boolean, shortlisted boolean, i_have_sent boolean, other_has_sent boolean, blocked_by_me boolean, can_send boolean, archived boolean, application_id uuid, application_status text, ad_id uuid, ad_title text, applicant_full_name text)
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

  if not exists (
    select 1
    from public.conversations conversation
    join public.conversation_participants participant
      on participant.conversation_id = conversation.id
     and participant.profile_id = v_uid
    where conversation.id = target_conversation_id
      and conversation.conversation_type = 'direct'
  ) then
    raise exception 'Conversazione non trovata';
  end if;

  return query
  with target as (
    select
      conversation.id,
      conversation.context_application_id
    from public.conversations conversation
    where conversation.id = target_conversation_id
  ),
  other as (
    select participant.profile_id as id
    from public.conversation_participants participant
    where participant.conversation_id = target_conversation_id
      and participant.profile_id <> v_uid
    limit 1
  ),
  other_club as (
    select club.id, club.name, club.category
    from other
    join public.profiles other_profile_check
      on other_profile_check.id = other.id
     and other_profile_check.role = 'club_admin'
    join public.clubs club
      on club.owner_profile_id = other.id
    order by club.created_at
    limit 1
  )
  select
    other_profile.id                                                        as other_profile_id,
    other_profile.full_name                                                 as other_full_name,
    other_profile.avatar_url                                                as other_avatar_url,
    other_profile.role                                                      as other_role,
    other_player.primary_position                                           as other_primary_position,
    other_club.id                                                           as club_id,
    other_club.name                                                         as club_name,
    other_club.category                                                     as club_category,
    (
      (
        exists (
          select 1 from public.profile_follows f
          where f.follower_profile_id = v_uid and f.followed_profile_id = other.id
        )
        or exists (
          select 1 from public.club_follows cf
          where cf.profile_id = v_uid and cf.club_id = other_club.id
        )
      )
      and exists (
        select 1 from public.profile_follows f2
        where f2.follower_profile_id = other.id and f2.followed_profile_id = v_uid
      )
    )                                                                        as mutual_follow,
    (rep.viewer_is_agent is not null)                                       as representation_active,
    case
      when rep.viewer_is_agent is null then null
      when rep.viewer_is_agent then 'agent'
      else 'player'
    end                                                                      as representation_type,
    (
      exists (
        select 1
        from public.club_members member
        join public.clubs my_club on my_club.id = member.club_id
        where member.status = 'active'
          and member.profile_id = v_uid
          and my_club.owner_profile_id = other.id
      )
      or exists (
        select 1
        from public.club_members member
        join public.clubs other_owned_club on other_owned_club.id = member.club_id
        where member.status = 'active'
          and member.profile_id = other.id
          and other_owned_club.owner_profile_id = v_uid
      )
    )                                                                        as roster_linked,
    (
      exists (
        select 1
        from public.club_shortlist_entries entry
        join public.club_shortlists list on list.id = entry.shortlist_id
        join public.clubs my_club on my_club.id = list.club_id
        where my_club.owner_profile_id = v_uid
          and entry.player_profile_id = other.id
      )
      or exists (
        select 1
        from public.club_shortlist_entries entry
        join public.club_shortlists list on list.id = entry.shortlist_id
        join public.clubs other_owned_club on other_owned_club.id = list.club_id
        where other_owned_club.owner_profile_id = other.id
          and entry.player_profile_id = v_uid
      )
    )                                                                        as shortlisted,
    exists (
      select 1 from public.messages message
      where message.conversation_id = target_conversation_id
        and message.sender_profile_id = v_uid
    )                                                                        as i_have_sent,
    exists (
      select 1 from public.messages message
      where message.conversation_id = target_conversation_id
        and message.sender_profile_id = other.id
    )                                                                        as other_has_sent,
    exists (
      select 1 from public.user_blocks block_row
      where block_row.blocker_profile_id = v_uid
        and block_row.blocked_profile_id = other.id
    )                                                                        as blocked_by_me,
    not exists (
      select 1 from public.user_blocks block_row
      where (block_row.blocker_profile_id = v_uid and block_row.blocked_profile_id = other.id)
         or (block_row.blocker_profile_id = other.id and block_row.blocked_profile_id = v_uid)
    )                                                                        as can_send,
    (my_participant.archived_at is not null)                                 as archived,
    application.id                                                          as application_id,
    application.status::text                                                as application_status,
    ad.id                                                                    as ad_id,
    ad.title                                                                 as ad_title,
    applicant.full_name                                                     as applicant_full_name
  from target
  join other on true
  join public.profiles other_profile on other_profile.id = other.id
  left join public.player_profiles other_player on other_player.profile_id = other.id
  left join other_club on true
  left join lateral (
    select (arep.agent_profile_id = v_uid) as viewer_is_agent
    from public.agent_representations arep
    where arep.status = 'accepted'
      and (
        (arep.agent_profile_id = v_uid and arep.player_profile_id = other.id)
        or (arep.agent_profile_id = other.id and arep.player_profile_id = v_uid)
      )
    limit 1
  ) rep on true
  join public.conversation_participants my_participant
    on my_participant.conversation_id = target_conversation_id
   and my_participant.profile_id = v_uid
  left join public.recruiting_applications application on application.id = target.context_application_id
  left join public.recruiting_ads ad on ad.id = application.ad_id
  left join public.profiles applicant on applicant.id = application.applicant_profile_id;
end;
$function$;

revoke all on function public.fetch_inbox_conversations(integer, integer, boolean) from public, anon;
grant execute on function public.fetch_inbox_conversations(integer, integer, boolean) to authenticated;
revoke all on function public.fetch_direct_conversation_meta(uuid) from public, anon;
grant execute on function public.fetch_direct_conversation_meta(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.search_share_recipients(p_query text DEFAULT NULL::text, p_cursor text DEFAULT NULL::text, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  v_uid     uuid := auth.uid();
  v_term    text := btrim(coalesce(p_query, ''));
  v_like    text;
  v_prefix  text;
  v_limit   integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_cur     jsonb;
  c_tier    integer;
  c_sort    numeric;
  c_name    text;
  c_key     text;
  v_items   jsonb;
  v_rows    integer;
  v_lastcur jsonb;
  v_next    text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_like := '%' || replace(replace(replace(lower(v_term), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_prefix := replace(replace(replace(lower(v_term), '\', '\\'), '%', '\%'), '_', '\_') || '%';

  if p_cursor is not null then
    begin
      v_cur := convert_from(decode(p_cursor, 'hex'), 'UTF8')::jsonb;
      c_tier := (v_cur ->> 0)::integer;
      c_sort := (v_cur ->> 1)::numeric;
      c_name := v_cur ->> 2;
      c_key  := v_cur ->> 3;
    exception when others then
      raise exception 'invalid_cursor' using errcode = '22023';
    end;
    if c_tier is null or c_sort is null or c_name is null or c_key is null then
      raise exception 'invalid_cursor' using errcode = '22023';
    end if;
  end if;

  with
  convs as (
    select i.*
    from public.fetch_inbox_conversations(1000, 0, true) i
    where i.conversation_type in ('direct', 'group')
      and (i.conversation_type = 'group' or i.can_send)
      and (v_term <> '' or not i.archived)
      and (
        (i.conversation_type = 'direct' and i.other_profile_id is not null)
        or (i.conversation_type = 'group' and coalesce(i.group_status, 'active') = 'active')
      )
  ),
  conv_rows as (
    select
      'conv:' || c.conversation_id::text                          as recipient_key,
      case when c.conversation_type = 'group' then 'group' else 'direct' end as kind,
      c.conversation_id                                           as conversation_id,
      c.other_profile_id                                          as profile_id,
      null::uuid                                                  as club_id,
      case when p.role::text = 'media'
           then coalesce(nullif(btrim(mp.entity_name), ''), c.display_title)
           else c.display_title end                               as display_name,
      case when p.role::text = 'media'
           then coalesce(mp.logo_url, c.avatar_url)
           else c.avatar_url end                                  as avatar_url,
      c.group_avatar_path                                         as group_avatar_path,
      coalesce(mp.verification_status = 'verified', false)        as is_verified,
      p.role::text                                                as role,
      case when c.conversation_type = 'group' then c.participant_count end as participant_count,
      true                                                        as available,
      c.last_message_sent_at                                      as last_at
    from convs c
    left join public.profiles p on p.id = c.other_profile_id and c.conversation_type = 'direct'
    left join public.media_profiles mp on mp.profile_id = p.id and p.role::text = 'media'
  ),
  person_rows as (
    select
      'profile:' || p.id::text                                    as recipient_key,
      'person'::text                                              as kind,
      null::uuid                                                  as conversation_id,
      p.id                                                        as profile_id,
      null::uuid                                                  as club_id,
      p.full_name                                                 as display_name,
      p.avatar_url                                                as avatar_url,
      null::text                                                  as group_avatar_path,
      false                                                       as is_verified,
      p.role::text                                                as role,
      null::integer                                               as participant_count,
      true                                                        as available,
      null::timestamptz                                           as last_at
    from public.profiles p
    where char_length(v_term) >= 2
      and p.id <> v_uid
      and p.role::text not in ('club_admin', 'media')
      and lower(p.full_name) like v_like
      and not exists (select 1 from public.footme_my_blocked_keys() bk where bk.b_kind = 'profile' and bk.b_id = p.id)
      and not exists (select 1 from conv_rows cr where cr.kind = 'direct' and cr.profile_id = p.id)
  ),
  media_rows as (
    select
      'profile:' || p.id::text                                    as recipient_key,
      'media'::text                                               as kind,
      null::uuid                                                  as conversation_id,
      p.id                                                        as profile_id,
      null::uuid                                                  as club_id,
      coalesce(nullif(btrim(mp.entity_name), ''), p.full_name)    as display_name,
      coalesce(mp.logo_url, p.avatar_url)                         as avatar_url,
      null::text                                                  as group_avatar_path,
      coalesce(mp.verification_status = 'verified', false)        as is_verified,
      p.role::text                                                as role,
      null::integer                                               as participant_count,
      true                                                        as available,
      null::timestamptz                                           as last_at
    from public.media_profiles mp
    join public.profiles p on p.id = mp.profile_id
    where char_length(v_term) >= 2
      and p.id <> v_uid
      and (lower(coalesce(mp.entity_name, '')) like v_like or lower(p.full_name) like v_like)
      and not exists (select 1 from public.footme_my_blocked_keys() bk where bk.b_kind = 'profile' and bk.b_id = p.id)
      and not exists (select 1 from conv_rows cr where cr.kind = 'direct' and cr.profile_id = p.id)
  ),
  club_rows as (
    select
      'club:' || c.id::text                                       as recipient_key,
      'club'::text                                                as kind,
      null::uuid                                                  as conversation_id,
      c.owner_profile_id                                          as profile_id,
      c.id                                                        as club_id,
      c.name                                                      as display_name,
      c.logo_url                                                  as avatar_url,
      null::text                                                  as group_avatar_path,
      (c.verification_status = 'verified')                        as is_verified,
      null::text                                                  as role,
      null::integer                                               as participant_count,
      (c.owner_profile_id <> v_uid)                               as available,
      null::timestamptz                                           as last_at
    from public.clubs c
    where char_length(v_term) >= 2
      and lower(c.name) like v_like
      and not exists (select 1 from public.footme_my_blocked_keys() bk where bk.b_kind = 'society' and bk.b_id = c.id)
      and not exists (select 1 from public.footme_my_blocked_keys() bk where bk.b_kind = 'profile' and bk.b_id = c.owner_profile_id)
  ),
  unioned as (
    select 0 as tier, cr.* from conv_rows cr
    where v_term = '' or lower(cr.display_name) like v_like
    union all
    select 1, pr.* from person_rows pr
    union all
    select 1, mr.* from media_rows mr
    union all
    select 1, kr.* from club_rows kr
  ),
  scored as (
    select u.*,
           (lower(u.display_name) collate "C") as lname,
           case
             when v_term = '' then round(coalesce(extract(epoch from u.last_at), 0)::numeric, 3)
             else round(similarity(lower(u.display_name), lower(v_term))::numeric, 4)
                  + case when lower(u.display_name) like v_prefix then 1 else 0 end
           end as sort_num
    from unioned u
  ),
  paged as (
    select s.*, (s.recipient_key collate "C") as rkey
    from scored s
    where p_cursor is null
       or s.tier > c_tier
       or (s.tier = c_tier and (
            s.sort_num < c_sort
            or (s.sort_num = c_sort and (
                 s.lname > (c_name collate "C")
                 or (s.lname = (c_name collate "C") and (s.recipient_key collate "C") > (c_key collate "C"))))))
    order by s.tier, s.sort_num desc, s.lname, (s.recipient_key collate "C")
    limit v_limit + 1
  ),
  numbered as (
    select
      row_number() over (order by pg.tier, pg.sort_num desc, pg.lname, pg.rkey) as rn,
      pg.tier, pg.sort_num, pg.lname, pg.recipient_key,
      jsonb_build_object(
        'recipient_key', pg.recipient_key,
        'kind', pg.kind,
        'conversation_id', pg.conversation_id,
        'profile_id', pg.profile_id,
        'club_id', pg.club_id,
        'display_name', pg.display_name,
        'avatar_url', pg.avatar_url,
        'group_avatar_path', pg.group_avatar_path,
        'is_verified', pg.is_verified,
        'role', pg.role,
        'context_label', case
                           when pg.kind = 'media' or pg.role = 'media' then 'Media'
                           when pg.kind = 'club' then (select c.category from public.clubs c where c.id = pg.club_id)
                           when pg.kind in ('direct', 'person') then (
                             select cl.name
                             from public.club_members cm
                             join public.clubs cl on cl.id = cm.club_id
                             where cm.profile_id = pg.profile_id
                               and cm.status = 'active'
                               and cm.is_current = true
                             order by cm.created_at desc
                             limit 1)
                         end,
        'participant_count', pg.participant_count,
        'available', pg.available) as item
    from paged pg
  )
  select
    coalesce(jsonb_agg(n.item order by n.rn) filter (where n.rn <= v_limit), '[]'::jsonb),
    count(*)::integer,
    (select jsonb_build_array(l.tier, l.sort_num, l.lname, l.recipient_key)
       from numbered l where l.rn = v_limit)
  into v_items, v_rows, v_lastcur
  from numbered n;

  if v_rows > v_limit then
    v_next := encode(convert_to(v_lastcur::text, 'UTF8'), 'hex');
  end if;

  return jsonb_build_object('items', v_items, 'next_cursor', v_next);
end;
$function$;

-- ============================================================
-- SEZIONE 10 — liste follower, profilo Società, Posizioni, Eventi (D2, D11)
-- ============================================================

CREATE OR REPLACE FUNCTION public.fetch_profile_followers(target_profile_id uuid, page_limit integer DEFAULT 20, page_offset integer DEFAULT 0)
 RETURNS TABLE(profile_id uuid, display_name text, avatar_url text, role_label text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_limit int := least(greatest(coalesce(page_limit, 20), 1), 50);
  v_offset int := greatest(coalesce(page_offset, 0), 0);
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    p.id         as profile_id,
    p.full_name  as display_name,
    p.avatar_url as avatar_url,
    p.role::text as role_label
  from public.profile_follows pf
  join public.profiles p on p.id = pf.follower_profile_id
  where pf.followed_profile_id = target_profile_id
    and not exists (select 1 from public.footme_my_blocked_keys() bk where bk.b_kind = 'profile' and bk.b_id = pf.follower_profile_id)
  order by pf.created_at desc
  limit v_limit
  offset v_offset;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fetch_profile_mutual_connections(target_profile_id uuid, page_limit integer DEFAULT 20, page_offset integer DEFAULT 0)
 RETURNS TABLE(profile_id uuid, display_name text, avatar_url text, role_label text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_limit int := least(greatest(coalesce(page_limit, 20), 1), 50);
  v_offset int := greatest(coalesce(page_offset, 0), 0);
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    p.id         as profile_id,
    p.full_name  as display_name,
    p.avatar_url as avatar_url,
    p.role::text as role_label
  from public.profile_follows caller_follows
  join public.profile_follows target_followed
    on target_followed.follower_profile_id = caller_follows.followed_profile_id
   and target_followed.followed_profile_id = target_profile_id
  join public.profiles p on p.id = caller_follows.followed_profile_id
  where caller_follows.follower_profile_id = v_uid
    and caller_follows.followed_profile_id <> v_uid
    and caller_follows.followed_profile_id <> target_profile_id
    and not exists (select 1 from public.footme_my_blocked_keys() bk where bk.b_kind = 'profile' and bk.b_id = caller_follows.followed_profile_id)
  order by caller_follows.created_at desc
  limit v_limit
  offset v_offset;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fetch_profile_social_summary(target_profile_id uuid)
 RETURNS TABLE(follower_count bigint, following_count bigint, mutual_total bigint, mutual_preview jsonb)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  return query
  with mutuals as (
    select
      p.id,
      p.full_name,
      p.avatar_url,
      caller_follows.created_at
    from public.profile_follows caller_follows
    join public.profile_follows target_followed
      on target_followed.follower_profile_id = caller_follows.followed_profile_id
     and target_followed.followed_profile_id = target_profile_id
    join public.profiles p on p.id = caller_follows.followed_profile_id
    where caller_follows.follower_profile_id = v_uid
      and caller_follows.followed_profile_id <> v_uid
      and caller_follows.followed_profile_id <> target_profile_id
      and not exists (select 1 from public.footme_my_blocked_keys() bk where bk.b_kind = 'profile' and bk.b_id = caller_follows.followed_profile_id)
  )
  select
    (
      select count(*)
      from public.profile_follows
      where followed_profile_id = target_profile_id
        and not exists (select 1 from public.footme_my_blocked_keys() bk where bk.b_kind = 'profile' and bk.b_id = follower_profile_id)
    )::bigint as follower_count,
    (
      select count(*)
      from public.profile_follows
      where follower_profile_id = target_profile_id
        and not exists (select 1 from public.footme_my_blocked_keys() bk where bk.b_kind = 'profile' and bk.b_id = followed_profile_id)
    )::bigint as following_count,
    (select count(*) from mutuals)::bigint as mutual_total,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'profile_id', preview.id,
            'display_name', preview.full_name,
            'avatar_url', preview.avatar_url
          )
        )
        from (
          select id, full_name, avatar_url
          from mutuals
          order by created_at desc
          limit 3
        ) preview
      ),
      '[]'::jsonb
    ) as mutual_preview;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fetch_society_master_profile(p_club_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
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

  -- HOM-12 §129, §173-§175: una Società bloccata (in qualunque direzione) dal
  -- viewer non si apre. Helper definer a zero argomenti: questa funzione resta
  -- invoker e non legge identity_blocks.
  if auth.uid() is not null and not public.can_manage_society(p_club_id)
     and exists (select 1 from public.footme_my_blocked_keys() bk
                 where bk.b_kind = 'society' and bk.b_id = p_club_id) then
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
$function$;

CREATE OR REPLACE FUNCTION public.apply_to_position(p_ad_id uuid, p_cover_message text, p_expected_revision integer DEFAULT NULL::integer, p_idempotency_key text DEFAULT NULL::text)
 RETURNS TABLE(application_id uuid, status text, created_at timestamp with time zone, replayed boolean, submission_revision integer, latest_submitted_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid         uuid := auth.uid();
  v_ad          public.recruiting_ads%rowtype;
  v_app         public.recruiting_applications%rowtype;
  v_role        text;
  v_target      text;
  v_player      boolean;
  v_now         timestamptz := timezone('utc', now());
  v_fingerprint text;
  v_receipt     jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_fingerprint := 'apply|' || coalesce(p_expected_revision::text, '*');

  v_receipt := public.application_operation_replay(
    p_idempotency_key, p_ad_id, 'application_apply', v_fingerprint
  );

  if v_receipt is not null then
    /* §13: la ricevuta prova che l'invio è già avvenuto; lo stato è quello
       corrente. Se nel frattempo la persona ha ritirato, il retry **non**
       riattiva niente e restituisce la candidatura ritirata. */
    select * into v_app
    from public.recruiting_applications a
    where a.ad_id = p_ad_id and a.applicant_profile_id = v_uid;

    if found then
      application_id      := v_app.id;
      status              := v_app.status::text;
      created_at          := v_app.created_at;
      replayed            := true;
      submission_revision := v_app.submission_revision;
      latest_submitted_at := v_app.latest_submitted_at;
      return next;

      return;
    end if;
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

  select * into v_ad
  from public.recruiting_ads
  where id = p_ad_id
  for share;

  if not found or v_ad.status = 'draft' then
    raise exception 'POSITION_NOT_AVAILABLE';
  end if;

  -- HOM-12 §134: una Società direttamente bloccata non è una nuova opportunità.
  -- Le candidature già inviate restano (§130, §133): il replay sopra le serve.
  if public.footme_identity_blocked(v_uid, 'society', v_ad.club_id) then
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
    /* Qualificato: `status` e `created_at` sono anche nomi di colonna OUT, e
       in un RETURNING non qualificato plpgsql non sa quale dei due intendi.
       La riga intera, non cinque colonne: v_app è un %rowtype e una lista
       parziale ci finirebbe dentro per posizione, non per nome. */
    returning recruiting_applications.* into v_app;

    perform public.application_operation_record(
      p_idempotency_key, p_ad_id, 'application_apply', v_fingerprint,
      jsonb_build_object('application_id', v_app.id, 'revision', 1)
    );

    perform public.notify_application_received(v_app.id, v_app.submission_revision);

    application_id      := v_app.id;
    status              := v_app.status::text;
    created_at          := v_app.created_at;
    replayed            := false;
    submission_revision := v_app.submission_revision;
    latest_submitted_at := v_app.latest_submitted_at;
    return next;
  exception when unique_violation then
    /* Riga già presente per questa persona e questa Position: o è un retry
       senza chiave di un invio già committato, o è una ricandidatura dopo un
       ritiro. §5: «Per la stessa combinazione persona + Position deve
       esistere una sola candidatura corrente» — in nessuno dei due casi se ne
       crea una seconda. */
    select * into v_app
    from public.recruiting_applications a
    where a.ad_id = p_ad_id and a.applicant_profile_id = v_uid
    for update;

    if v_app.status = 'withdrawn' then
      if p_expected_revision is not null
         and p_expected_revision is distinct from v_app.submission_revision then
        raise exception 'APPLICATION_REVISION_STALE';
      end if;

      update public.recruiting_applications a
      set status              = 'submitted',
          latest_submitted_at = v_now,
          submission_revision = a.submission_revision + 1,
          cover_message       = coalesce(
            nullif(btrim(coalesce(p_cover_message, '')), ''), a.cover_message
          ),
          updated_at          = v_now
      where a.id = v_app.id
      returning a.* into v_app;

      perform public.application_operation_record(
        p_idempotency_key, p_ad_id, 'application_apply', v_fingerprint,
        jsonb_build_object(
          'application_id', v_app.id, 'revision', v_app.submission_revision
        )
      );

      /* §25: «Una ricandidatura valida è una nuova submission operativa e può
         alimentare lo stesso evento/tipo.» La revisione nuova la distingue
         dalla precedente e la fa passare dalla deduplicazione. */
      perform public.notify_application_received(v_app.id, v_app.submission_revision);

      application_id      := v_app.id;
      status              := v_app.status::text;
      created_at          := v_app.created_at;
      /* Non è un replay: è un invio nuovo che i lettori devono vedere come
         non letto e in cima all'ordinamento (§12). */
      replayed            := false;
      submission_revision := v_app.submission_revision;
      latest_submitted_at := v_app.latest_submitted_at;
      return next;

      return;
    end if;

    /* §9: «Una seconda richiesta per una Application già ACTIVE non è un modo
       per riportarsi in cima: non aggiorna latest_submitted_at, non genera un
       nuovo evento o una notifica, non azzera la lettura.» */
    application_id      := v_app.id;
    status              := v_app.status::text;
    created_at          := v_app.created_at;
    replayed            := true;
    submission_revision := v_app.submission_revision;
    latest_submitted_at := v_app.latest_submitted_at;
    return next;
  end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_position_action_state(p_ad_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid       uuid := auth.uid();
  v_ad        public.recruiting_ads%rowtype;
  v_role      public.app_role;
  v_applied   boolean;
  v_is_player boolean;
  v_can_apply boolean;
  v_reason    text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_ad from public.recruiting_ads where id = p_ad_id;

  if found and public.footme_identity_blocked(v_uid, 'society', v_ad.club_id) then
    return jsonb_build_object(
      'action_type',       'none',
      'can_apply',         false,
      'already_applied',   false,
      'is_open',           false,
      'status',            null,
      'deadline_at',       null,
      'deadline_date',     null,
      'deadline_timezone', null,
      'reason',            'not_available'
    );
  end if;

  if not found or v_ad.status = 'draft' then
    return jsonb_build_object(
      'action_type',       'none',
      'can_apply',         false,
      'already_applied',   false,
      'is_open',           false,
      'status',            case when found then v_ad.status::text else null end,
      'deadline_at',       null,
      'deadline_date',     null,
      'deadline_timezone', null,
      'reason',            'not_available'
    );
  end if;

  if v_ad.status = 'closed' then
    return jsonb_build_object(
      'action_type',       'none',
      'can_apply',         false,
      'already_applied',   false,
      'is_open',           false,
      'status',            v_ad.status::text,
      'deadline_at',       v_ad.application_deadline_at,
      'deadline_date',
        case
          when v_ad.application_deadline_at is null then null
          else public.position_deadline_date(
                 v_ad.application_deadline_at,
                 coalesce(v_ad.application_deadline_timezone,
                          public.society_position_timezone(v_ad.club_id))
               )
        end,
      'deadline_timezone', v_ad.application_deadline_timezone,
      -- §32: distinto da `deadline_passed`. Una CLOSED è chiusa per
      -- decisione esplicita, non perché il cutoff sia scaduto.
      'reason',            'position_closed'
    );
  end if;

  select role into v_role from public.profiles where id = v_uid;

  v_applied := exists (
    select 1
    from public.recruiting_applications app
    where app.ad_id = p_ad_id
      and app.applicant_profile_id = v_uid
      and app.status <> 'withdrawn'
  );

  v_is_player := exists (
    select 1 from public.player_profiles pp where pp.profile_id = v_uid
  );

  v_can_apply :=
    not v_applied
    and v_is_player
    and v_role = 'player'::public.app_role
    and coalesce(v_ad.target_role, 'player') = 'player'
    and (
      v_ad.application_deadline_at is null
      or timezone('utc', now()) < v_ad.application_deadline_at
    );

  v_reason := case
    when v_applied then 'already_applied'
    when v_ad.application_deadline_at is not null
         and timezone('utc', now()) >= v_ad.application_deadline_at then 'deadline_passed'
    when not v_is_player or v_role <> 'player'::public.app_role then 'role_not_supported'
    else null
  end;

  return jsonb_build_object(
    'action_type',       case when v_can_apply then 'apply' else 'none' end,
    'can_apply',         v_can_apply,
    'already_applied',   v_applied,
    'is_open',           true,
    'status',            v_ad.status::text,
    'deadline_at',       v_ad.application_deadline_at,
    'deadline_date',
      case
        when v_ad.application_deadline_at is null then null
        else public.position_deadline_date(
               v_ad.application_deadline_at,
               coalesce(v_ad.application_deadline_timezone,
                        public.society_position_timezone(v_ad.club_id))
             )
      end,
    'deadline_timezone', v_ad.application_deadline_timezone,
    'reason',            v_reason
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.selection_event_person_ineligibility(p_event selection_events, p_uid uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role  text;
  v_owner uuid;
begin
  select pr.role::text into v_role from public.profiles pr where pr.id = p_uid;

  if v_role is null then
    return 'no_profile';
  end if;

  if v_role <> 'player'
     or not exists (select 1 from public.player_profiles pp where pp.profile_id = p_uid) then
    return 'not_sports_profile';
  end if;

  select c.owner_profile_id into v_owner from public.clubs c where c.id = p_event.club_id;

  if v_owner = p_uid then
    return 'not_sports_profile';
  end if;

  -- HOM-12 D2: il blocco riguarda la Società dell'evento, non il suo titolare.
  if public.footme_identity_blocked(p_uid, 'society', p_event.club_id) then
    return 'blocked';
  end if;

  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.selection_event_invitee_ineligibility(p_event selection_events, p_uid uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role  text;
  v_owner uuid;
begin
  select pr.role::text into v_role from public.profiles pr where pr.id = p_uid;

  if v_role is null then
    return 'no_profile';
  end if;

  if not (
    (v_role = 'player' and exists (select 1 from public.player_profiles pp where pp.profile_id = p_uid))
    or (v_role = 'coach' and exists (select 1 from public.coach_profiles cp where cp.profile_id = p_uid))
    or (v_role = 'staff' and exists (select 1 from public.staff_profiles sp where sp.profile_id = p_uid))
  ) then
    return 'not_sports_profile';
  end if;

  select c.owner_profile_id into v_owner from public.clubs c where c.id = p_event.club_id;

  if v_owner = p_uid then
    return 'not_sports_profile';
  end if;

  -- HOM-12 D2: il blocco riguarda la Società dell'evento, non il suo titolare.
  if public.footme_identity_blocked(p_uid, 'society', p_event.club_id) then
    return 'blocked';
  end if;

  return null;
end;
$function$;
