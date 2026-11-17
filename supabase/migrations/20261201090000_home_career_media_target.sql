-- ============================================================
-- HOM-15 — Release gate Home: Mi piace e Salva sui media di carriera
--
-- COSA MANCAVA (§174, §175 HOM-15; decisione di Luigi: «nuovo target backend
-- ora»)
--
--   Il viewer Media del profilo altrui (MediaTabContent, mode "visitor")
--   mostrava Mi piace e Salva sui media di carriera — il json `media_items` di
--   player/coach/staff/agent/director_profiles, più i due video sintetici
--   «profile-highlight-video» (player_profiles.highlight_video_url) e
--   «coach-technical-video» (coach_profiles.technical_video_url) — ma i due
--   controlli cambiavano solo lo stato locale: conteggio seminato a 0, nessuna
--   scrittura. Quegli elementi non sono contenuti canonici: content_likes e i
--   Salvati accettano solo i tipi del Feed, e un elemento del json non ha un id
--   uuid (né sempre un id: il client ripiega su `player-media-<indice>`).
--
-- PERCHÉ QUESTA SOLUZIONE
--
--   * IDENTITÀ. Un registro `career_media_items` dà a ogni elemento un uuid
--     server stabile: chiave naturale (profile_id, source, item_key), dove
--     item_key è l'`id` dell'elemento nel json (o la chiave del video
--     sintetico) e source è la tabella di provenienza. Il content type nuovo è
--     'career_media' e content_id = career_media_items.id: content_likes e i
--     Salvati restano chiavi (tipo, uuid) come per ogni altro contenuto, e il
--     proprietario si risolve con una lettura per chiave primaria.
--   * ID NEL JSON. Un trigger BEFORE sulle cinque tabelle assegna un uuid
--     testuale agli elementi senza id valido, a quelli che usano una chiave
--     riservata ai video sintetici e ai duplicati (stessa regola nel backfill:
--     footme_career_media_fix_ids). Gli editor del client conservano già l'id
--     che leggono (lo portano nella bozza e lo riscrivono), quindi dopo la
--     prima scrittura l'id è stabile; il fallback per indice del client non
--     nasce più da righe nuove.
--   * SINCRONIA. Un trigger AFTER (insert / update dei campi media / delete)
--     riconcilia il registro con il json. Un elemento tolto dal json esce dal
--     registro e i suoi Mi piace e Salvataggi si CANCELLANO (trigger di pulizia
--     su content_likes, FK on delete cascade su saved_career_media): stessa
--     scelta di HOM-07 per i contenuti eliminati (§144–§145) — un filtro in
--     lettura lascerebbe righe orfane che nessuno potrà mai vedere né togliere.
--     I video sintetici esistono solo quando il client li mostra (nessun
--     elemento valido nel json; per il Calciatore anche nessun media_urls
--     legacy) e cambiano identità se cambia l'URL: un video nuovo non eredita i
--     Mi piace di quello vecchio.
--   * LEGGIBILITÀ. footme_career_media_readable: l'elemento è nel registro, la
--     sua sorgente è quella del ruolo ATTUALE del proprietario (un ex
--     Calciatore diventato Allenatore non mostra più la galleria da
--     Calciatore) e nessun blocco fra viewer e proprietario
--     (footme_publisher_blocked 'profile', la regola di profile_post, che passa
--     da identity_blocks di HOM-12). Il profilo di una persona non ha altra
--     visibilità che il blocco (fetch_profile_availability).
--   * PERIMETRO STRETTO. footme_content_readable NON cambia: è il gate anche
--     di commenti, condivisione, repost, segnalazioni e Non mi interessa, e un
--     ramo 'career_media' lì li aprirebbe tutti a un tipo che non li ha.
--     Like e Salva passano da footme_like_save_target_readable, che delega a
--     footme_content_readable per ogni tipo esistente: per quelli niente
--     cambia.
--   * STATO. fetch_career_media_interactions(profile) restituisce in un colpo
--     solo, per gli elementi leggibili di quel profilo, uuid, conteggio,
--     liked_as, can_like/can_save e is_saved — con le stesse definizioni del
--     payload del Feed (footme_visible_likes, footme_interaction_identities).
--
-- FUNZIONI RIEMESSE (dalla loro ULTIMA definizione, cambiando solo quanto
-- indicato)
--
--   * set_content_like, list_content_likers (20261123090000 §5-6, §5-7):
--     'career_media' in whitelist, leggibilità da
--     footme_like_save_target_readable.
--   * footme_saved_target_accessible, set_saved, footme_saved_rows, list_saved
--     (20261122090000, unica definizione): ramo 'career_media' →
--     saved_career_media; payload della riga Salvati con item_kind 'video' /
--     'photo', autore = il proprietario (persona), owner_profile_id e
--     item_key per aprire il profilo. fetch_saved_counts legge
--     footme_saved_rows e non cambia.
--   * notifications_on_content_like (20261129090000 §5a): 'career_media'
--     esce come 'comment', SENZA notifica. Esplicito, non lasciato al fatto
--     che footme_content_publisher non lo conosce: il resolver dei target del
--     client apre /content/<tipo>/<id> e per questo tipo non esiste un
--     dettaglio; notificare chiede una destinazione profilo/viewer che è
--     fuori dal perimetro di questa correzione.
--
-- INVENTARIO DEI LETTORI DI content_likes / Salvati, e cosa succede al tipo
--
--   * footme_visible_likes, footme_like_actor_visible: per chiave, nessuna
--     whitelist: funzionano per il tipo nuovo.
--   * footme_post_payloads / fetch_content_interaction_state / Insights
--     (footme_content_interaction_rows) / media_content_engagement: leggono
--     feed_content_index o filtrano per tipo; il tipo nuovo non c'è e non
--     deve esserci (niente Feed, niente Insights).
--   * Viste club_media_likes / fan_media_likes: filtrate per tipo.
--   * Ranking del Feed (20261128): i Mi piace dell'identità entrano come
--     evidenza senza publisher, esattamente come i Mi piace ai commenti;
--     saved_career_media non è nell'elenco dei salvataggi del ranking.
--   * Push / notifiche: nessuna riga per il tipo (sopra).
--   * content_events, commenti, share, repost, report, Non mi interessa:
--     whitelist proprie o footme_content_readable, che resta falso per il tipo.
--
-- VOLUTAMENTE NON TOCCATO
--
--   * Gli elementi legacy di player_profiles.media_urls (mostrati dal client
--     come legacy-media-N quando media_items è vuoto) non hanno un id
--     persistito né un elemento nel json: nessun target, il viewer non mostra
--     i controlli. Materializzarli nel json è una modifica di dati profilo.
--   * Nessun commento, share, repost, insight o Feed per i media di carriera.
--
-- Rieseguibile: if not exists, drop/create dei trigger e delle policy,
-- vincolo cercato per definizione, backfill idempotente.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — registro e Salvati dei media di carriera
-- ============================================================

create table if not exists public.career_media_items (
  id            uuid        primary key default gen_random_uuid(),
  profile_id    uuid        not null references public.profiles(id) on delete cascade,
  source        text        not null check (source in ('player', 'coach', 'staff', 'agent', 'director')),
  item_key      text        not null,
  media_type    text        not null check (media_type in ('image', 'video')),
  media_url     text        not null,
  thumbnail_url text,
  description   text,
  registered_at timestamptz not null default now(),
  unique (profile_id, source, item_key)
);

-- Interno: si legge solo dalle RPC (security definer).
alter table public.career_media_items enable row level security;
revoke all on table public.career_media_items from anon, authenticated;

-- Stessa forma di saved_profile_posts (colonna `post_id`, così set_saved usa lo
-- stesso ramo dinamico dei contenuti). Nessuna scrittura dal client: si scrive
-- solo con set_saved; il client legge e cancella i propri.
create table if not exists public.saved_career_media (
  post_id    uuid        not null references public.career_media_items(id) on delete cascade,
  profile_id uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, profile_id)
);
create index if not exists saved_career_media_profile_idx
  on public.saved_career_media (profile_id, created_at desc);

alter table public.saved_career_media enable row level security;
revoke all on table public.saved_career_media from anon, authenticated;
grant select, delete on table public.saved_career_media to authenticated;

drop policy if exists "users read own saved career media" on public.saved_career_media;
create policy "users read own saved career media"
on public.saved_career_media
for select
to authenticated
using (public.is_current_user(profile_id));

drop policy if exists "users delete own saved career media" on public.saved_career_media;
create policy "users delete own saved career media"
on public.saved_career_media
for delete
to authenticated
using (public.is_current_user(profile_id));

-- content_likes accetta 'career_media'. Il vincolo si cerca per DEFINIZIONE
-- (come HOM-08): lo schema remoto non sempre coincide con le migrazioni.
do $$
declare
  v_con record;
begin
  for v_con in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.content_likes'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%content_type%'
  loop
    execute format('alter table public.content_likes drop constraint %I', v_con.conname);
  end loop;

  alter table public.content_likes
    add constraint content_likes_content_type_check
    check (content_type in ('club_media', 'fan_media', 'profile_post', 'media_profile', 'comment', 'career_media'));
end
$$;

-- Un elemento che esce dal registro porta via i suoi Mi piace (i Salvati
-- escono per FK). Stessa funzione di pulizia dei contenuti (HOM-07).
drop trigger if exists content_likes_cleanup on public.career_media_items;
create trigger content_likes_cleanup after delete on public.career_media_items
  for each row execute function public.content_likes_cleanup_content('career_media');


-- ============================================================
-- SEZIONE 2 — id stabili nel json e riconciliazione del registro
-- ============================================================

-- Ogni oggetto del json ha un `id` testuale non vuoto, unico nell'array e
-- diverso dalle due chiavi riservate ai video sintetici; altrimenti ne riceve
-- uno nuovo. Gli altri elementi (e l'ordine) restano identici.
create or replace function public.footme_career_media_fix_ids(p_items jsonb)
returns jsonb
language sql
volatile
set search_path = public
as $$
  select case
    when jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then p_items
    else (
      select jsonb_agg(
               case when x.needs_id
                    then x.e || jsonb_build_object('id', gen_random_uuid()::text)
                    else x.e end
               order by x.ord)
      from (
        select t.e, t.ord,
               jsonb_typeof(t.e) = 'object' and (
                 t.k is null
                 or t.k in ('profile-highlight-video', 'coach-technical-video')
                 or row_number() over (partition by t.k order by t.ord) > 1) as needs_id
        from (
          select a.e, a.ord,
                 case when jsonb_typeof(a.e -> 'id') = 'string' and btrim(a.e ->> 'id') <> ''
                      then a.e ->> 'id' end as k
          from jsonb_array_elements(p_items) with ordinality as a(e, ord)
        ) t
      ) x)
  end;
$$;

-- security definer: il trigger scatta con i diritti di chi scrive il profilo
-- (authenticated), che non ha EXECUTE sulle funzioni interne.
create or replace function public.career_media_items_ensure_ids()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fixed jsonb;
begin
  v_fixed := public.footme_career_media_fix_ids(new.media_items);
  if v_fixed is distinct from new.media_items then
    new.media_items := v_fixed;
  end if;
  return new;
end;
$$;

-- Il registro di (profilo, sorgente) diventa quello che il client mostra:
-- gli oggetti del json con url e id stringa (stesse condizioni dei normalizer
-- client: senza url l'elemento non compare) e, se non ce n'è nessuno, il video
-- sintetico della sorgente. Gli elementi che restano tengono il loro uuid;
-- un video sintetico con URL cambiato è un elemento nuovo.
create or replace function public.footme_career_media_reconcile(p_profile_id uuid, p_source text, p_row jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items   jsonb := case when jsonb_typeof(p_row -> 'media_items') = 'array'
                          then p_row -> 'media_items' else '[]'::jsonb end;
  v_desired jsonb;
  v_url     text;
begin
  if p_profile_id is null or p_source is null then
    return;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'k', d.k, 't', d.t, 'u', d.u, 'th', d.th, 'd', d.d, 's', false)), '[]'::jsonb)
    into v_desired
  from (
    select distinct on (e ->> 'id')
      e ->> 'id' as k,
      case
        when e ->> 'type' in ('image', 'video') then e ->> 'type'
        when btrim(e ->> 'url') ~* '\.(mp4|mov|m4v|webm|avi|mkv)(\?.*)?$' then 'video'
        else 'image'
      end as t,
      btrim(e ->> 'url') as u,
      nullif(btrim(case when jsonb_typeof(e -> 'thumbnail_url') = 'string' then e ->> 'thumbnail_url' end), '') as th,
      nullif(btrim(case when jsonb_typeof(e -> 'description') = 'string' then e ->> 'description' end), '') as d
    from jsonb_array_elements(v_items) with ordinality as a(e, ord)
    where jsonb_typeof(e) = 'object'
      and jsonb_typeof(e -> 'url') = 'string' and btrim(e ->> 'url') <> ''
      and jsonb_typeof(e -> 'id') = 'string' and btrim(e ->> 'id') <> ''
    order by e ->> 'id', a.ord
  ) d;

  if jsonb_array_length(v_desired) = 0 then
    if p_source = 'player' and not exists (
         select 1
         from jsonb_array_elements_text(case when jsonb_typeof(p_row -> 'media_urls') = 'array'
                                             then p_row -> 'media_urls' else '[]'::jsonb end) u
         where btrim(u) <> '') then
      v_url := nullif(btrim(p_row ->> 'highlight_video_url'), '');
      if v_url is not null then
        v_desired := jsonb_build_array(jsonb_build_object(
          'k', 'profile-highlight-video', 't', 'video', 'u', v_url, 'th', null,
          'd', 'Video highlights del profilo.', 's', true));
      end if;
    elsif p_source = 'coach' then
      v_url := nullif(btrim(p_row ->> 'technical_video_url'), '');
      if v_url is not null then
        v_desired := jsonb_build_array(jsonb_build_object(
          'k', 'coach-technical-video', 't', 'video', 'u', v_url, 'th', null,
          'd', 'Video tecnico del profilo.', 's', true));
      end if;
    end if;
  end if;

  delete from public.career_media_items m
  where m.profile_id = p_profile_id
    and m.source = p_source
    and not exists (
      select 1
      from jsonb_to_recordset(v_desired) as d(k text, t text, u text, th text, d text, s boolean)
      where d.k = m.item_key
        and (not d.s or d.u = m.media_url));

  insert into public.career_media_items as m
    (profile_id, source, item_key, media_type, media_url, thumbnail_url, description)
  select p_profile_id, p_source, d.k, d.t, d.u, d.th, d.d
  from jsonb_to_recordset(v_desired) as d(k text, t text, u text, th text, d text, s boolean)
  on conflict (profile_id, source, item_key) do update
    set media_type    = excluded.media_type,
        media_url     = excluded.media_url,
        thumbnail_url = excluded.thumbnail_url,
        description   = excluded.description
    where (m.media_type, m.media_url, m.thumbnail_url, m.description)
          is distinct from (excluded.media_type, excluded.media_url, excluded.thumbnail_url, excluded.description);
end;
$$;

create or replace function public.career_media_items_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.career_media_items m
    where m.profile_id = old.profile_id and m.source = tg_argv[0];
    return old;
  end if;

  perform public.footme_career_media_reconcile(new.profile_id, tg_argv[0], to_jsonb(new));
  return new;
end;
$$;

drop trigger if exists career_media_ensure_ids on public.player_profiles;
create trigger career_media_ensure_ids before insert or update of media_items on public.player_profiles
  for each row execute function public.career_media_items_ensure_ids();
drop trigger if exists career_media_ensure_ids on public.coach_profiles;
create trigger career_media_ensure_ids before insert or update of media_items on public.coach_profiles
  for each row execute function public.career_media_items_ensure_ids();
drop trigger if exists career_media_ensure_ids on public.staff_profiles;
create trigger career_media_ensure_ids before insert or update of media_items on public.staff_profiles
  for each row execute function public.career_media_items_ensure_ids();
drop trigger if exists career_media_ensure_ids on public.agent_profiles;
create trigger career_media_ensure_ids before insert or update of media_items on public.agent_profiles
  for each row execute function public.career_media_items_ensure_ids();
drop trigger if exists career_media_ensure_ids on public.director_profiles;
create trigger career_media_ensure_ids before insert or update of media_items on public.director_profiles
  for each row execute function public.career_media_items_ensure_ids();

drop trigger if exists career_media_sync on public.player_profiles;
create trigger career_media_sync
  after insert or update of media_items, highlight_video_url, media_urls or delete on public.player_profiles
  for each row execute function public.career_media_items_sync('player');
drop trigger if exists career_media_sync on public.coach_profiles;
create trigger career_media_sync
  after insert or update of media_items, technical_video_url or delete on public.coach_profiles
  for each row execute function public.career_media_items_sync('coach');
drop trigger if exists career_media_sync on public.staff_profiles;
create trigger career_media_sync
  after insert or update of media_items or delete on public.staff_profiles
  for each row execute function public.career_media_items_sync('staff');
drop trigger if exists career_media_sync on public.agent_profiles;
create trigger career_media_sync
  after insert or update of media_items or delete on public.agent_profiles
  for each row execute function public.career_media_items_sync('agent');
drop trigger if exists career_media_sync on public.director_profiles;
create trigger career_media_sync
  after insert or update of media_items or delete on public.director_profiles
  for each row execute function public.career_media_items_sync('director');

-- Backfill. (1) id mancanti/duplicati/riservati: tocca SOLO le righe da
-- correggere (l'update passa dai trigger, quindi registra anche la riga).
-- (2) registro per tutte le righe, senza update: nessun updated_at spostato.
update public.player_profiles t set media_items = public.footme_career_media_fix_ids(t.media_items)
  where jsonb_typeof(t.media_items) = 'array' and jsonb_array_length(t.media_items) > 0
    and public.footme_career_media_fix_ids(t.media_items) is distinct from t.media_items;
update public.coach_profiles t set media_items = public.footme_career_media_fix_ids(t.media_items)
  where jsonb_typeof(t.media_items) = 'array' and jsonb_array_length(t.media_items) > 0
    and public.footme_career_media_fix_ids(t.media_items) is distinct from t.media_items;
update public.staff_profiles t set media_items = public.footme_career_media_fix_ids(t.media_items)
  where jsonb_typeof(t.media_items) = 'array' and jsonb_array_length(t.media_items) > 0
    and public.footme_career_media_fix_ids(t.media_items) is distinct from t.media_items;
update public.agent_profiles t set media_items = public.footme_career_media_fix_ids(t.media_items)
  where jsonb_typeof(t.media_items) = 'array' and jsonb_array_length(t.media_items) > 0
    and public.footme_career_media_fix_ids(t.media_items) is distinct from t.media_items;
update public.director_profiles t set media_items = public.footme_career_media_fix_ids(t.media_items)
  where jsonb_typeof(t.media_items) = 'array' and jsonb_array_length(t.media_items) > 0
    and public.footme_career_media_fix_ids(t.media_items) is distinct from t.media_items;

do $$
declare
  r record;
begin
  for r in select t.profile_id, to_jsonb(t) as j from public.player_profiles t loop
    perform public.footme_career_media_reconcile(r.profile_id, 'player', r.j);
  end loop;
  for r in select t.profile_id, to_jsonb(t) as j from public.coach_profiles t loop
    perform public.footme_career_media_reconcile(r.profile_id, 'coach', r.j);
  end loop;
  for r in select t.profile_id, to_jsonb(t) as j from public.staff_profiles t loop
    perform public.footme_career_media_reconcile(r.profile_id, 'staff', r.j);
  end loop;
  for r in select t.profile_id, to_jsonb(t) as j from public.agent_profiles t loop
    perform public.footme_career_media_reconcile(r.profile_id, 'agent', r.j);
  end loop;
  for r in select t.profile_id, to_jsonb(t) as j from public.director_profiles t loop
    perform public.footme_career_media_reconcile(r.profile_id, 'director', r.j);
  end loop;
end
$$;


-- ============================================================
-- SEZIONE 3 — leggibilità (solo per Like e Salva)
-- ============================================================

create or replace function public.footme_career_media_readable(p_viewer uuid, p_media_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_media_id is not null and exists (
    select 1
    from public.career_media_items m
    join public.profiles p on p.id = m.profile_id
    where m.id = p_media_id
      and p.role::text = m.source
      and not public.footme_publisher_blocked(p_viewer, 'profile', m.profile_id));
$$;

-- Il gate di Like, lista dei Mi piace e Salva. Per ogni tipo esistente è
-- footme_content_readable, identico; 'career_media' ha la sua regola.
create or replace function public.footme_like_save_target_readable(p_viewer uuid, p_content_type text, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_content_type = 'career_media' then public.footme_career_media_readable(p_viewer, p_id)
    else public.footme_content_readable(p_viewer, p_content_type, p_id)
  end;
$$;


-- ============================================================
-- SEZIONE 4 — stato per il viewer Media del profilo
--
-- Una chiamata per profilo: per ogni elemento leggibile ora, la chiave che il
-- client conosce (item_key = `id` del json o chiave del video sintetico),
-- l'uuid canonico e lo stato Like/Salva con le definizioni del payload del Feed.
-- Profilo bloccato o elementi di una sorgente non più del ruolo → nessuna riga
-- (il client non mostra i controlli).
-- ============================================================

create or replace function public.fetch_career_media_interactions(p_profile_id uuid)
returns table (
  item_key    text,
  media_id    uuid,
  likes_count integer,
  liked_as    jsonb,
  can_like    boolean,
  can_save    boolean,
  is_saved    boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_profile_id is null then
    return;
  end if;

  return query
  with items as (
    select m.id as m_id, m.item_key as m_key
    from public.career_media_items m
    join public.profiles p on p.id = m.profile_id
    where m.profile_id = p_profile_id
      and p.role::text = m.source
      and not public.footme_publisher_blocked(v_uid, 'profile', m.profile_id)
  ),
  likes as (
    select
      vl.v_post_id as l_id,
      count(*)::int as l_n,
      coalesce(
        jsonb_agg(
          jsonb_build_object('type', vl.v_actor_type, 'id', vl.v_actor_id)
          order by vl.v_created_at, vl.v_actor_type, vl.v_actor_id
        ) filter (where mi.c_id is not null),
        '[]'::jsonb
      ) as l_as
    from (
      select array_agg('career_media'::text) as cts, array_agg(i.m_id) as ids from items i
    ) k
    cross join lateral public.footme_visible_likes(v_uid, k.cts, k.ids) vl
    left join public.footme_interaction_identities(v_uid) mi
      on mi.c_type = vl.v_actor_type and mi.c_id = vl.v_actor_id
    group by vl.v_post_id
  )
  select
    i.m_key,
    i.m_id,
    coalesce(l.l_n, 0),
    coalesce(l.l_as, '[]'::jsonb),
    true,
    true,
    exists (select 1 from public.saved_career_media s
            where s.post_id = i.m_id and s.profile_id = v_uid)
  from items i
  left join likes l on l.l_id = i.m_id
  order by i.m_key;
end;
$$;

revoke all on function public.fetch_career_media_interactions(uuid) from public;
revoke execute on function public.fetch_career_media_interactions(uuid) from anon;
grant execute on function public.fetch_career_media_interactions(uuid) to authenticated;


-- ============================================================
-- SEZIONE 5 — set_content_like (sorgente: 20261123090000 §5-6)
-- Whitelist con 'career_media'; leggibilità da footme_like_save_target_readable.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_content_like(p_content_type text, p_post_id uuid, p_liked boolean, p_identity_type text, p_identity_id uuid)
 RETURNS TABLE(likes_count bigint, is_liked boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid   uuid := auth.uid();
  v_count bigint;
  v_liked boolean;
  v_readable boolean;
  v_inserted integer;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_liked is null then
    raise exception 'Stato del Mi piace mancante' using errcode = '22023';
  end if;

  if p_content_type is null
     or p_content_type not in ('club_media', 'fan_media', 'profile_post', 'media_profile', 'comment', 'career_media') then
    raise exception 'like_content_type_unsupported' using errcode = '22023';
  end if;

  if p_identity_type is null or p_identity_id is null or not exists (
    select 1 from public.footme_interaction_identities(v_uid) i
    where i.c_type = p_identity_type and i.c_id = p_identity_id
  ) then
    raise exception 'like_identity_forbidden' using errcode = '42501';
  end if;

  v_readable := public.footme_like_save_target_readable(v_uid, p_content_type, p_post_id);

  if p_liked and not v_readable then
    raise exception 'content_unavailable' using errcode = 'P0002';
  end if;

  if p_liked then
    insert into public.content_likes as cl (content_type, post_id, actor_type, actor_id, acted_by)
    values (p_content_type, p_post_id, p_identity_type, p_identity_id, v_uid)
    on conflict do nothing;
    get diagnostics v_inserted = row_count;
    -- HOM-08 §200–§208: COMMENT_LIKED solo all'inserimento reale, mai su conflict.
    if v_inserted > 0 and p_content_type = 'comment' then
      perform public.footme_comment_like_event(p_post_id, p_identity_type, p_identity_id, v_uid);
    end if;
  else
    delete from public.content_likes cl
    where cl.content_type = p_content_type
      and cl.post_id = p_post_id
      and cl.actor_type = p_identity_type
      and cl.actor_id = p_identity_id;
  end if;

  if v_readable then
    select count(*) into v_count
    from public.footme_visible_likes(v_uid, array[p_content_type], array[p_post_id]);
  else
    v_count := 0;
  end if;

  select exists (
    select 1 from public.content_likes cl
    where cl.content_type = p_content_type
      and cl.post_id = p_post_id
      and cl.actor_type = p_identity_type
      and cl.actor_id = p_identity_id
  ) into v_liked;

  return query select v_count, v_liked;
end;
$function$;

revoke all on function public.set_content_like(text, uuid, boolean, text, uuid) from public;
revoke execute on function public.set_content_like(text, uuid, boolean, text, uuid) from anon;
grant execute on function public.set_content_like(text, uuid, boolean, text, uuid) to authenticated;

-- ============================================================
-- SEZIONE 6 — list_content_likers (sorgente: 20261123090000 §5-7)
-- Stesse due modifiche: la route /likes/career_media/<id> non si rompe.
-- ============================================================

CREATE OR REPLACE FUNCTION public.list_content_likers(p_content_type text, p_post_id uuid, p_cursor jsonb DEFAULT NULL::jsonb, p_limit integer DEFAULT 30)
 RETURNS TABLE(actor_type text, actor_id uuid, name text, avatar_url text, is_verified boolean, role text, club_name text, team_label text, club_category text, media_kind text, primary_position text, is_self boolean, is_following boolean, next_cursor jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_uid    uuid := auth.uid();
  v_limit  integer := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_cb     integer;
  v_cts    timestamptz;
  v_ct     text;
  v_cid    uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_content_type is null
     or p_content_type not in ('club_media', 'fan_media', 'profile_post', 'media_profile', 'comment', 'career_media') then
    raise exception 'like_content_type_unsupported' using errcode = '22023';
  end if;

  if not public.footme_like_save_target_readable(v_uid, p_content_type, p_post_id) then
    raise exception 'content_unavailable' using errcode = 'P0002';
  end if;

  if p_cursor is not null then
    begin
      v_cb  := (p_cursor ->> 'b')::integer;
      v_cts := (p_cursor ->> 'ts')::timestamptz;
      v_ct  := p_cursor ->> 't';
      v_cid := (p_cursor ->> 'id')::uuid;
    exception when others then
      raise exception 'likes_invalid_cursor' using errcode = '22023';
    end;
    if v_cb is null or v_cts is null or v_ct is null or v_cid is null then
      raise exception 'likes_invalid_cursor' using errcode = '22023';
    end if;
  end if;

  return query
  with mine as (
    select i.c_type, i.c_id from public.footme_interaction_identities(v_uid) i
  ),
  likers as (
    select
      vl.v_actor_type as a_type,
      vl.v_actor_id   as a_id,
      vl.v_created_at as a_ts,
      case
        when vl.v_actor_type = 'society' then exists (
          select 1 from public.club_follows f
          where f.profile_id = v_uid and f.club_id = vl.v_actor_id)
        else exists (
          select 1 from public.profile_follows f
          where f.follower_profile_id = v_uid and f.followed_profile_id = vl.v_actor_id)
      end as a_following
    from public.footme_visible_likes(v_uid, array[p_content_type], array[p_post_id]) vl
  ),
  ranked as (
    select l.a_type, l.a_id, l.a_ts, l.a_following,
           case when l.a_following then 0 else 1 end as a_bucket
    from likers l
  ),
  page as (
    select r.*
    from ranked r
    where p_cursor is null
       or r.a_bucket > v_cb
       or (r.a_bucket = v_cb and r.a_ts < v_cts)
       or (r.a_bucket = v_cb and r.a_ts = v_cts and r.a_type > v_ct)
       or (r.a_bucket = v_cb and r.a_ts = v_cts and r.a_type = v_ct and r.a_id > v_cid)
    order by r.a_bucket, r.a_ts desc, r.a_type, r.a_id
    limit v_limit + 1
  ),
  numbered as (
    select pg.*, row_number() over (order by pg.a_bucket, pg.a_ts desc, pg.a_type, pg.a_id) as rn
    from page pg
  ),
  shown as (
    select n.* from numbered n where n.rn <= v_limit
  )
  select
    s.a_type,
    s.a_id,
    case s.a_type
      when 'society' then c.name
      when 'media'   then coalesce(nullif(btrim(mp.entity_name), ''), nullif(btrim(p.full_name), ''), 'Media')
      else coalesce(nullif(btrim(p.full_name), ''), 'Profilo')
    end,
    case s.a_type
      when 'society' then c.logo_url
      when 'media'   then coalesce(mp.logo_url, p.avatar_url)
      else p.avatar_url
    end,
    case s.a_type
      when 'society' then c.verification_status = 'verified'
      when 'media'   then coalesce(mp.verification_status = 'verified', false)
      else false
    end,
    case when s.a_type = 'society' then null else p.role::text end,
    case when s.a_type = 'person' then cur.club_name end,
    case when s.a_type = 'person' then cur.team_label end,
    case when s.a_type = 'society' then c.category end,
    case when s.a_type = 'media' then coalesce(mp.media_kind, 'pagina') end,
    case when s.a_type = 'person' and p.role::text = 'player' then pl.primary_position::text end,
    exists (select 1 from mine m where m.c_type = s.a_type and m.c_id = s.a_id),
    s.a_following,
    case
      when s.rn = v_limit and (select count(*) from numbered) > v_limit
        then jsonb_build_object('b', s.a_bucket, 'ts', s.a_ts, 't', s.a_type, 'id', s.a_id)
    end
  from shown s
  left join public.clubs c           on s.a_type = 'society' and c.id = s.a_id
  left join public.profiles p        on s.a_type in ('person', 'media') and p.id = s.a_id
  left join public.media_profiles mp on s.a_type = 'media' and mp.profile_id = s.a_id
  left join public.player_profiles pl on s.a_type = 'person' and pl.profile_id = s.a_id
  left join lateral (
    select cl.name as club_name, ct.name as team_label
    from public.club_members cm
    join public.clubs cl on cl.id = cm.club_id
    left join public.club_teams ct on ct.id = cm.team_id
    where s.a_type = 'person'
      and cm.profile_id = s.a_id
      and cm.status = 'active'
      and cm.is_current = true
    order by cm.created_at desc
    limit 1
  ) cur on true
  order by s.rn;
end;
$function$;

revoke all on function public.list_content_likers(text, uuid, jsonb, integer) from public;
revoke execute on function public.list_content_likers(text, uuid, jsonb, integer) from anon;
grant execute on function public.list_content_likers(text, uuid, jsonb, integer) to authenticated;

-- ============================================================
-- SEZIONE 7 — Salvati (sorgente: 20261122090000, unica definizione)
-- footme_saved_target_accessible: ramo content da footme_like_save_target_readable.
-- set_saved: 'career_media' → saved_career_media. footme_saved_rows: ramo
-- career_media. list_saved: payload della riga career_media.
-- ============================================================

create or replace function public.footme_saved_target_accessible(
  p_target_type  text,
  p_target_id    uuid,
  p_content_type text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null or p_target_id is null then false
    when p_target_type = 'content' then
      p_content_type is not null
      and public.footme_like_save_target_readable(auth.uid(), p_content_type, p_target_id)
    when p_target_type = 'profile' then
      p_target_id <> auth.uid()
      and exists (select 1 from public.profiles pr where pr.id = p_target_id)
      and not public.footme_profiles_blocked(auth.uid(), p_target_id)
    when p_target_type = 'society' then
      exists (
        select 1 from public.clubs c
        where c.id = p_target_id
          and c.verification_status not in ('suspended', 'rejected', 'flagged')
          and not public.footme_profiles_blocked(auth.uid(), c.owner_profile_id))
    when p_target_type = 'team' then
      exists (
        select 1
        from public.club_teams ct
        join public.clubs c on c.id = ct.club_id
        where ct.id = p_target_id
          and ct.is_public and not ct.is_archived
          and c.verification_status not in ('suspended', 'rejected', 'flagged')
          and not public.footme_profiles_blocked(auth.uid(), c.owner_profile_id))
    when p_target_type = 'position' then
      -- consultabile (non bozza): chiusa ma consultabile si può ancora salvare (§149)
      exists (
        select 1
        from public.recruiting_ads ra
        join public.clubs c on c.id = ra.club_id
        where ra.id = p_target_id
          and ra.status <> 'draft'
          and c.verification_status not in ('suspended', 'rejected', 'flagged')
          and not public.footme_profiles_blocked(auth.uid(), c.owner_profile_id))
    else false
  end;
$$;

create or replace function public.set_saved(
  p_target_type  text,
  p_target_id    uuid,
  p_saved        boolean,
  p_content_type text default null
)
returns table (is_saved boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tbl text;
  v_now boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_saved is null or p_target_id is null
     or p_target_type is null
     or p_target_type not in ('content', 'profile', 'society', 'team', 'position') then
    raise exception 'saved_invalid_target' using errcode = '22023';
  end if;

  if p_target_type = 'content' then
    v_tbl := case p_content_type
      when 'club_media'    then 'saved_club_media'
      when 'media_profile' then 'saved_media_profile_posts'
      when 'media_tribuna' then 'saved_media_tribuna'
      when 'fan_tribuna'   then 'saved_fan_tribuna'
      when 'fan_media'     then 'saved_fan_media'
      when 'profile_post'  then 'saved_profile_posts'
      when 'career_media'  then 'saved_career_media'
    end;
    if v_tbl is null then
      raise exception 'saved_invalid_target' using errcode = '22023';
    end if;
  elsif p_target_type = 'profile' and p_target_id = v_uid and p_saved then
    raise exception 'saved_invalid_target' using errcode = '22023';
  end if;

  if p_saved and not public.footme_saved_target_accessible(p_target_type, p_target_id, p_content_type) then
    raise exception 'saved_target_unavailable' using errcode = 'P0002';
  end if;

  if p_target_type = 'content' then
    if p_saved then
      execute format('insert into public.%I (post_id, profile_id) values ($1, $2) on conflict do nothing', v_tbl)
        using p_target_id, v_uid;
    else
      execute format('delete from public.%I where post_id = $1 and profile_id = $2', v_tbl)
        using p_target_id, v_uid;
    end if;
    execute format('select exists (select 1 from public.%I where post_id = $1 and profile_id = $2)', v_tbl)
      into v_now using p_target_id, v_uid;

  elsif p_target_type = 'profile' then
    if p_saved then
      insert into public.saved_profiles as sp (owner_profile_id, target_profile_id)
      values (v_uid, p_target_id) on conflict do nothing;
    else
      delete from public.saved_profiles sp
      where sp.owner_profile_id = v_uid and sp.target_profile_id = p_target_id;
    end if;
    select exists (select 1 from public.saved_profiles sp
                   where sp.owner_profile_id = v_uid and sp.target_profile_id = p_target_id) into v_now;

  elsif p_target_type = 'society' then
    if p_saved then
      insert into public.saved_clubs as sc (owner_profile_id, club_id)
      values (v_uid, p_target_id) on conflict do nothing;
    else
      delete from public.saved_clubs sc
      where sc.owner_profile_id = v_uid and sc.club_id = p_target_id;
    end if;
    select exists (select 1 from public.saved_clubs sc
                   where sc.owner_profile_id = v_uid and sc.club_id = p_target_id) into v_now;

  elsif p_target_type = 'team' then
    if p_saved then
      insert into public.saved_teams as st (owner_profile_id, team_id)
      values (v_uid, p_target_id) on conflict do nothing;
    else
      delete from public.saved_teams st
      where st.owner_profile_id = v_uid and st.team_id = p_target_id;
    end if;
    select exists (select 1 from public.saved_teams st
                   where st.owner_profile_id = v_uid and st.team_id = p_target_id) into v_now;

  else
    if p_saved then
      insert into public.saved_ads as sa (ad_id, profile_id)
      values (p_target_id, v_uid) on conflict do nothing;
    else
      delete from public.saved_ads sa
      where sa.ad_id = p_target_id and sa.profile_id = v_uid;
    end if;
    select exists (select 1 from public.saved_ads sa
                   where sa.ad_id = p_target_id and sa.profile_id = v_uid) into v_now;
  end if;

  return query select v_now;
end;
$$;

revoke all on function public.set_saved(text, uuid, boolean, text) from public;
revoke execute on function public.set_saved(text, uuid, boolean, text) from anon;
grant execute on function public.set_saved(text, uuid, boolean, text) to authenticated;

create or replace function public.footme_saved_rows(p_uid uuid, p_category text default null)
returns table (
  s_category     text,
  s_target_type  text,
  s_target_id    uuid,
  s_content_type text,
  s_saved_at     timestamptz,
  s_key          text
)
language sql
stable
security definer
set search_path = public
as $$
  -- contenuti: pubblicati, non programmati, non bloccati
  select 'content'::text, 'content'::text, x.post_id, x.content_type, x.created_at,
         'content:' || x.content_type || ':' || x.post_id::text
  from (
    select 'club_media'::text as content_type, s.post_id, s.created_at
      from public.saved_club_media s where s.profile_id = p_uid
    union all
    select 'media_profile', s.post_id, s.created_at
      from public.saved_media_profile_posts s where s.profile_id = p_uid
    union all
    select 'media_tribuna', s.post_id, s.created_at
      from public.saved_media_tribuna s where s.profile_id = p_uid
    union all
    select 'fan_tribuna', s.post_id, s.created_at
      from public.saved_fan_tribuna s where s.profile_id = p_uid
    union all
    select 'fan_media', s.post_id, s.created_at
      from public.saved_fan_media s where s.profile_id = p_uid
    union all
    select 'profile_post', s.post_id, s.created_at
      from public.saved_profile_posts s where s.profile_id = p_uid
  ) x
  -- leggibilità in un join set-based (footme_readable_content è la parte della
  -- regola che non dipende dal viewer; il blocco è lo stesso predicato di
  -- footme_content_readable), non una chiamata per riga prima della paginazione
  join public.footme_readable_content rc
    on rc.content_type = x.content_type and rc.post_id = x.post_id
  where (p_category is null or p_category = 'content')
    and not public.footme_publisher_blocked(p_uid, rc.publisher_type, rc.publisher_id)

  union all

  -- HOM-15: media di carriera — nel registro, sorgente del ruolo attuale del
  -- proprietario, proprietario non bloccato (footme_career_media_readable).
  select 'content'::text, 'content'::text, s.post_id, 'career_media'::text, s.created_at,
         'content:career_media:' || s.post_id::text
  from public.saved_career_media s
  join public.career_media_items m on m.id = s.post_id
  join public.profiles p on p.id = m.profile_id and p.role::text = m.source
  where (p_category is null or p_category = 'content')
    and s.profile_id = p_uid
    and not public.footme_publisher_blocked(p_uid, 'profile', m.profile_id)

  union all

  -- profili: esistono e non sono bloccati
  select 'profile', 'profile', sp.target_profile_id, null::text, sp.created_at,
         'profile::' || sp.target_profile_id::text
  from public.saved_profiles sp
  join public.profiles p on p.id = sp.target_profile_id
  where (p_category is null or p_category = 'profile')
    and sp.owner_profile_id = p_uid
    and not public.footme_profiles_blocked(p_uid, p.id)

  union all

  -- società
  select 'society', 'society', sc.club_id, null::text, sc.created_at,
         'society::' || sc.club_id::text
  from public.saved_clubs sc
  join public.clubs c on c.id = sc.club_id
  where (p_category is null or p_category = 'society')
    and sc.owner_profile_id = p_uid
    and c.verification_status not in ('suspended', 'rejected', 'flagged')
    and not public.footme_profiles_blocked(p_uid, c.owner_profile_id)

  union all

  -- squadre: dentro la categoria società
  select 'society', 'team', st.team_id, null::text, st.created_at,
         'team::' || st.team_id::text
  from public.saved_teams st
  join public.club_teams ct on ct.id = st.team_id
  join public.clubs c on c.id = ct.club_id
  where (p_category is null or p_category = 'society')
    and st.owner_profile_id = p_uid
    and ct.is_public and not ct.is_archived
    and c.verification_status not in ('suspended', 'rejected', 'flagged')
    and not public.footme_profiles_blocked(p_uid, c.owner_profile_id)

  union all

  -- posizioni: consultabili (non bozza, is_navigable di saved_positions_base),
  -- aperte o chiuse; quelle non più visibili escono (§149–§151)
  select 'position', 'position', b.ad_id, null::text, b.saved_at,
         'position::' || b.ad_id::text
  from public.saved_positions_base(p_uid) b
  join public.clubs c on c.id = b.club_id
  where (p_category is null or p_category = 'position')
    and b.is_navigable
    and c.verification_status not in ('suspended', 'rejected', 'flagged')
    and not public.footme_profiles_blocked(p_uid, c.owner_profile_id);
$$;

create or replace function public.list_saved(
  p_category text,
  p_cursor   jsonb   default null,
  p_limit    integer default 20
)
returns table (
  target_type  text,
  target_id    uuid,
  content_type text,
  saved_at     timestamptz,
  payload      jsonb,
  next_cursor  jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid   uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_ts    timestamptz;
  v_key   text;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_category is null or p_category not in ('content', 'profile', 'society', 'position') then
    raise exception 'saved_invalid_target' using errcode = '22023';
  end if;

  if p_cursor is not null then
    begin
      v_ts  := (p_cursor ->> 'ts')::timestamptz;
      v_key := p_cursor ->> 'k';
    exception when others then
      raise exception 'saved_invalid_cursor' using errcode = '22023';
    end;
    if v_ts is null or v_key is null then
      raise exception 'saved_invalid_cursor' using errcode = '22023';
    end if;
  end if;

  return query
  with page as (
    select r.*
    from public.footme_saved_rows(v_uid, p_category) r
    where p_cursor is null or (r.s_saved_at, r.s_key) < (v_ts, v_key)
    order by r.s_saved_at desc, r.s_key desc
    limit v_limit + 1
  ),
  numbered as (
    select pg.*, row_number() over (order by pg.s_saved_at desc, pg.s_key desc) as rn
    from page pg
  ),
  shown as (
    select n.* from numbered n where n.rn <= v_limit
  ),
  -- saved_positions_base una sola volta per la pagina (non per riga) e solo per
  -- la categoria posizioni.
  pos as materialized (
    select
      b.ad_id, b.role, b.club_id, b.club_name, b.club_logo_url, b.team_name,
      b.category, b.location, b.availability_group, ra.title, ra.target_role,
      -- etichetta leggibile dal catalogo dei ruoli di recruiting (id = valore di
      -- role_required per i Calciatori); un ruolo libero usa il suo nome. Null se
      -- non risolvibile: il client ripiega su target_role.
      coalesce(
        nullif(btrim(ra.custom_role_name), ''),
        (select pr.label from public.position_roles pr
         where pr.id = coalesce(ra.structured_role_id, ra.role_required::text))
      ) as role_label
    from public.saved_positions_base(v_uid) b
    join public.recruiting_ads ra on ra.id = b.ad_id
    where p_category = 'position'
      and b.ad_id in (select sh.s_target_id from shown sh)
  )
  select
    s.s_target_type,
    s.s_target_id,
    s.s_content_type,
    s.s_saved_at,
    case s.s_target_type
      -- HOM-15: un media di carriera non è nel Feed. Stessa forma del payload
      -- contenuto (item_kind video/photo, autore = il proprietario) più
      -- owner_profile_id e item_key: la riga apre il profilo, tab Media.
      when 'content' then case when s.s_content_type = 'career_media' then (
        select jsonb_build_object(
          'item_kind',        case when m.media_type = 'video' then 'video' else 'photo' end,
          'title',            null,
          'excerpt',          left(m.description, 200),
          'thumbnail_url',    coalesce(m.thumbnail_url, case when m.media_type = 'image' then m.media_url end),
          'duration_seconds', null,
          'author', jsonb_build_object(
            'type',        'person',
            'id',          p.id,
            'name',        coalesce(nullif(btrim(p.full_name), ''), 'Profilo'),
            'is_verified', false),
          'published_at',     null,
          'owner_profile_id', p.id,
          'item_key',         m.item_key)
        from public.career_media_items m
        join public.profiles p on p.id = m.profile_id
        where m.id = s.s_target_id)
      else (
        select jsonb_build_object(
          'item_kind',        public.footme_feed_item_type(fci.content_type, fci.content_format),
          'title',            case when public.footme_feed_item_type(fci.content_type, fci.content_format) = 'post'
                                   then null else nullif(btrim(fci.title), '') end,
          'excerpt',          case when public.footme_feed_item_type(fci.content_type, fci.content_format) = 'post'
                                   then left(nullif(btrim(coalesce(fci.body, fci.excerpt)), ''), 280)
                                   else left(nullif(btrim(fci.excerpt), ''), 200) end,
          'thumbnail_url',    fci.thumbnail_url,
          'duration_seconds', fci.duration_seconds,
          'author', jsonb_build_object(
            'type',        case
                             when fci.publisher_type = 'club' then 'society'
                             when fci.content_type in ('media_profile', 'media_tribuna') then 'media'
                             else 'person'
                           end,
            'id',          fci.publisher_id,
            'name',        fci.publisher_name,
            'is_verified', coalesce(fci.publisher_is_verified, false)),
          'published_at',     fci.published_at)
        from public.feed_content_index fci
        where fci.content_type = s.s_content_type and fci.post_id = s.s_target_id) end
      when 'profile' then (
        select jsonb_build_object(
          'name',             coalesce(nullif(btrim(mp.entity_name), ''), nullif(btrim(p.full_name), ''), 'Profilo'),
          'avatar_url',       case when p.role::text = 'media' then coalesce(mp.logo_url, p.avatar_url) else p.avatar_url end,
          'is_verified',      coalesce(mp.verification_status = 'verified', false),
          'role',             p.role::text,
          'media_kind',       case when p.role::text = 'media' then coalesce(mp.media_kind, 'pagina') end,
          'primary_position', case when p.role::text = 'player' then pl.primary_position::text end,
          'club_name',        cur.club_name,
          'team_label',       cur.team_label)
        from public.profiles p
        left join public.media_profiles mp on mp.profile_id = p.id and p.role::text = 'media'
        left join public.player_profiles pl on pl.profile_id = p.id and p.role::text = 'player'
        left join lateral (
          select cl.name as club_name, ct.name as team_label
          from public.club_members cm
          join public.clubs cl on cl.id = cm.club_id
          left join public.club_teams ct on ct.id = cm.team_id
          where cm.profile_id = p.id and cm.status = 'active' and cm.is_current = true
          order by cm.created_at desc
          limit 1
        ) cur on p.role::text <> 'media'
        where p.id = s.s_target_id)
      when 'society' then (
        select jsonb_build_object(
          'name',          c.name,
          'logo_url',      c.logo_url,
          'is_verified',   c.verification_status = 'verified',
          'club_category', c.category)
        from public.clubs c
        where c.id = s.s_target_id)
      when 'team' then (
        select jsonb_build_object(
          'name',          ct.name,
          'club_id',       c.id,
          'club_name',     c.name,
          'logo_url',      coalesce(ct.logo_url, c.logo_url),
          'is_verified',   c.verification_status = 'verified',
          'club_category', c.category,
          'team_category', ct.category)
        from public.club_teams ct
        join public.clubs c on c.id = ct.club_id
        where ct.id = s.s_target_id)
      when 'position' then (
        select jsonb_build_object(
          'title',         pos.title,
          'role',          pos.role,
          'role_label',    pos.role_label,
          'target_role',   pos.target_role,
          'club_id',       pos.club_id,
          'club_name',     pos.club_name,
          'club_logo_url', pos.club_logo_url,
          'team_label',    pos.team_name,
          'category',      pos.category,
          'location',      pos.location,
          'lifecycle',     case when pos.availability_group = 'available' then 'open' else 'closed' end)
        from pos
        where pos.ad_id = s.s_target_id)
    end,
    case
      when s.rn = v_limit and (select count(*) from numbered) > v_limit
        then jsonb_build_object('ts', s.s_saved_at, 'k', s.s_key)
    end
  from shown s
  order by s.rn;
end;
$$;

revoke all on function public.list_saved(text, jsonb, integer) from public;
revoke execute on function public.list_saved(text, jsonb, integer) from anon;
grant execute on function public.list_saved(text, jsonb, integer) to authenticated;

-- ============================================================
-- SEZIONE 8 — notifications_on_content_like (sorgente: 20261129090000 §5a)
-- 'career_media' esce senza notifica, come 'comment'.
-- ============================================================

create or replace function public.notifications_on_content_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pb_type text;
  v_pb_id   uuid;
begin
  /* Mi piace a un commento: nessuna notifica (§70 HOM-08, fuori da HOM-14).
     HOM-15: nemmeno a un media di carriera — il client non ha una
     destinazione per il tipo (nessun /content/career_media). */
  if new.content_type in ('comment', 'career_media') then
    return new;
  end if;

  begin
    select pb.pb_type, pb.pb_id into v_pb_type, v_pb_id
    from public.footme_content_publisher(new.content_type, new.post_id) pb;

    if v_pb_id is not null then
      perform public.footme_notify_event(
        'content_liked',
        /* Per contenuto e identità, senza data: attivare e togliere il Mi piace
           non rinotifica (anti-spam); la retention libera la chiave. */
        'LIKE:' || new.content_type || ':' || new.post_id::text || ':' || new.actor_type || ':' || new.actor_id::text,
        new.actor_type, new.actor_id, new.acted_by,
        v_pb_type, v_pb_id,
        'content', new.post_id, jsonb_build_object('content_type', new.content_type),
        null,
        new.content_type || ':' || new.post_id::text);
    end if;
  exception when others then
    raise warning 'HOM-14: notifica Mi piace non prodotta: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.notifications_on_content_like() from public;
revoke execute on function public.notifications_on_content_like() from anon, authenticated;

-- ============================================================
-- SEZIONE 9 — privilegi delle funzioni interne
-- `revoke from public` non chiude anon: revoca esplicita. footme_saved_target_accessible
-- resta eseguibile da authenticated (la chiamano le policy delle tabelle saved_*).
-- ============================================================

revoke all on function public.footme_career_media_fix_ids(jsonb) from public;
revoke execute on function public.footme_career_media_fix_ids(jsonb) from anon, authenticated;
revoke all on function public.career_media_items_ensure_ids() from public;
revoke execute on function public.career_media_items_ensure_ids() from anon, authenticated;
revoke all on function public.footme_career_media_reconcile(uuid, text, jsonb) from public;
revoke execute on function public.footme_career_media_reconcile(uuid, text, jsonb) from anon, authenticated;
revoke all on function public.career_media_items_sync() from public;
revoke execute on function public.career_media_items_sync() from anon, authenticated;
revoke all on function public.footme_career_media_readable(uuid, uuid) from public;
revoke execute on function public.footme_career_media_readable(uuid, uuid) from anon, authenticated;
revoke all on function public.footme_like_save_target_readable(uuid, text, uuid) from public;
revoke execute on function public.footme_like_save_target_readable(uuid, text, uuid) from anon, authenticated;
revoke all on function public.footme_saved_rows(uuid, text) from public;
revoke execute on function public.footme_saved_rows(uuid, text) from anon, authenticated;
revoke all on function public.footme_saved_target_accessible(text, uuid, text) from public;
revoke execute on function public.footme_saved_target_accessible(text, uuid, text) from anon;
grant execute on function public.footme_saved_target_accessible(text, uuid, text) to authenticated;
