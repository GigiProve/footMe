-- ============================================================
-- HOM-02 — Post social standard: dati
--
-- COSA MANCAVA
--
-- Il Feed (HOME-01) sa mostrare un "Post" ma il suo payload è povero e il
-- dominio sotto è frammentato. Il task HOM-02 (§79–§84, §110–§111) chiede un
-- Post social standard e il server non può darlo:
--
--   1. Non esiste un post per le PERSONE. Calciatori, Allenatori, Staff,
--      Procuratori e Dirigenti non hanno nessuna tabella in cui pubblicare:
--      i cinque contenuti che entrano nel Feed (club_media_posts,
--      media_profile_posts, media_tribuna_posts, fan_tribuna_posts,
--      fan_media_posts) appartengono a Società, Media e Tifosi.
--   2. Il media di un post vive in colonne diverse per ogni sorgente
--      (visual_url, cover_url, media_url, ...) e ne ammette uno solo. §24 vuole
--      una collezione unica ordinata, foto e video insieme.
--   3. Il payload del Feed taglia il testo a 280 caratteri, non dice che tipo
--      di identità ha pubblicato (§80), non porta mention, taggati, anteprima
--      link, contatori reali, stato "mi piace" né le azioni consentite (§81).
--   4. Il "Mi piace" non ha una scrittura unica: esistono due tabelle di like
--      (club_media_likes, fan_media_likes) e nessun comando che le muova.
--
-- DECISIONI DI LUIGI (2026-11-11) CHE QUESTA MIGRAZIONE REALIZZA
--
--   * Tabella ora per gli autori PERSONA: `profile_posts` (content_type
--     `profile_post`). Nessun composer (HOM-06.1): si crea per insert RLS del
--     proprietario. Solo i ruoli persona (player, coach, staff, agent,
--     director) possono inserire.
--   * UNA tabella media polimorfica per tutte le sorgenti:
--     `content_post_media (content_type, post_id, position)`, riempita con una
--     riga per ogni post legacy che ha un visual.
--   * Contatori e is_liked reali; il Mi piace funziona ora dove esiste una
--     tabella di like: club_media, fan_media e il nuovo profile_post.
--   * Il tap su un media apre il dettaglio contenuto esistente: serve quindi
--     una lettura di dettaglio per `profile_post`.
--
-- PERCHÉ QUESTA SOLUZIONE
--
--   * UNA regola di leggibilità, non sei copie. `content_post_media` e
--     `content_post_extras` non hanno FK (sono polimorfiche) e le loro policy
--     chiedono a `content_post_is_readable()` se il chiamante può leggere il
--     post padre. La funzione è SECURITY INVOKER: interroga la tabella padre
--     con le policy del padre. Così il media di un post non pubblicato, di un
--     autore bloccato o programmato nel futuro non è selezionabile per
--     costruzione, e se un domani cambia la regola di un padre cambia una
--     volta sola. Stessa idea per la scrittura (`content_post_is_owner`).
--   * Le righe media delle sorgenti legacy non si possono lasciare "da
--     backfill": un post Società creato domani dal composer attuale non
--     avrebbe media nella nuova tabella e sparirebbe dal Feed. Un trigger sulle
--     quattro tabelle legacy che hanno un visual mantiene allineata la
--     posizione 0; le posizioni successive sono dei compositori futuri e non
--     vengono toccate. Un secondo trigger ripulisce media ed extras alla
--     cancellazione del padre: senza FK non lo fa il database.
--   * Il payload di un Post è costruito in UN punto, `footme_post_payloads()`,
--     in batch sulle chiavi della pagina (niente subquery correlate per riga),
--     e lo usano sia `fetch_home_feed_page` sia `fetch_profile_post_detail`.
--   * `profile_posts.status` è protetto da un trigger: RLS filtra righe, non
--     colonne, e senza il trigger il proprietario potrebbe riportare a
--     `published` un post rimosso dalla moderazione.
--   * `set_content_like` è un SET idempotente (liked true/false), non un
--     toggle: un doppio tap o un retry non devono invertire lo stato. È
--     SECURITY INVOKER: le policy delle tabelle di like (is_current_user +
--     padre leggibile) bastano, e l'RPC non può quindi superarle.
--
-- COSA NON FA (dichiarato, non dimenticato)
--
--   * `fetch_home_feed_page` mantiene firma e colonne; cambia solo `data`
--     delle righe item_type = 'post' (chiavi aggiunte). Riemessa dalla
--     definizione più recente (20260727150000), che è l'ultima.
--   * `feed_content_index` (ultima definizione: 20261009160000 §6) è riemessa
--     con `profile_post` come sesta sorgente e UNA colonna aggiunta in coda,
--     `body` (testo intero, il Feed continua a tagliare l'excerpt a 280).
--   * Commenti per profile_post: nessuna tabella qui (HOM-08), quindi
--     comments_count 0 e can_comment false. Salvataggio profile_post: nessuna
--     tabella saved_* (HOM-07), can_save false.
--   * La ricerca CER-05 (`media_content_index`) NON viene estesa.
--   * Validazione dei target di mention/link: è HOM-06.1. Qui solo forma e
--     schema https per l'URL dell'anteprima.
--   * `created_by_profile_id` e ogni "acted_by" non compaiono mai nel payload
--     (§111): la Società resta l'autore anche quando scrive un suo admin.
--
-- PRIVACY / PERMESSI
--
--   * Tutto è `to authenticated`. anon: revoke esplicito sulle tabelle e
--     `revoke execute ... from anon` sulle funzioni (revoke from public non
--     chiude anon perché Supabase concede execute ad anon direttamente).
--   * Le funzioni definer controllano `auth.uid()` nel corpo.
--   * Blocchi: `user_blocks` è leggibile solo dal bloccante, quindi la policy
--     di lettura non può interrogarla da invoker. L'helper
--     `is_profile_blocked_with_viewer` è definer e restituisce solo un
--     booleano per il chiamante.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — helper: blocco bidirezionale tra chiamante e un profilo
-- ============================================================

create or replace function public.is_profile_blocked_with_viewer(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.user_blocks ub
      where (ub.blocker_profile_id = auth.uid() and ub.blocked_profile_id = p_profile_id)
         or (ub.blocked_profile_id = auth.uid() and ub.blocker_profile_id = p_profile_id)
    );
$$;

revoke all on function public.is_profile_blocked_with_viewer(uuid) from public;
revoke execute on function public.is_profile_blocked_with_viewer(uuid) from anon;
grant execute on function public.is_profile_blocked_with_viewer(uuid) to authenticated;


-- ============================================================
-- SEZIONE 2 — profile_posts: il post delle persone
--
-- Ruoli persona = valori reali di app_role che non sono né società né
-- contenuto: player, coach, staff, agent, director. `club_admin`, `fan`,
-- `media` e `admin` non possono inserire (fan e media hanno già le loro
-- sorgenti; l'ambito Società scrive sempre come Società).
-- ============================================================

create table if not exists public.profile_posts (
  id           uuid        primary key default gen_random_uuid(),
  profile_id   uuid        not null references public.profiles(id) on delete cascade,
  body         text        not null default '',
  status       text        not null default 'published',
  published_at timestamptz not null default timezone('utc', now()),
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now()),
  constraint profile_posts_body_length_check check (char_length(body) <= 3000),
  constraint profile_posts_status_check check (status in ('published', 'hidden', 'removed'))
);

create index if not exists profile_posts_profile_published_idx
  on public.profile_posts (profile_id, status, published_at desc);

create index if not exists profile_posts_published_idx
  on public.profile_posts (published_at desc)
  where status = 'published';

alter table public.profile_posts enable row level security;

revoke all on table public.profile_posts from anon;
grant select, insert, update, delete on table public.profile_posts to authenticated;

-- Lettura: pubblicato, non programmato nel futuro, autore non bloccato in
-- nessuna direzione. Stesso predicato che il Feed applica agli autori profilo.
drop policy if exists "published profile posts readable by authenticated users"
  on public.profile_posts;
create policy "published profile posts readable by authenticated users"
on public.profile_posts
for select
to authenticated
using (
  status = 'published'
  and published_at <= timezone('utc', now())
  and not public.is_profile_blocked_with_viewer(profile_id)
);

-- Scrittura e lettura propria (bozze/nascosti/rimossi inclusi: sono il dominio
-- di gestione). Solo ruoli persona.
drop policy if exists "person owners manage own profile posts" on public.profile_posts;
create policy "person owners manage own profile posts"
on public.profile_posts
for all
to authenticated
using (
  public.is_current_user(profile_id)
  and exists (
    select 1 from public.profiles p
    where p.id = profile_id
      and p.role::text in ('player', 'coach', 'staff', 'agent', 'director')
  )
)
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1 from public.profiles p
    where p.id = profile_id
      and p.role::text in ('player', 'coach', 'staff', 'agent', 'director')
  )
);

-- Colonne che RLS non protegge: autore immutabile; un post rimosso dalla
-- moderazione non torna visibile per mano del proprietario. Le chiamate senza
-- auth.uid() (service role, manutenzione) non sono vincolate.
create or replace function public.profile_posts_guard_columns()
returns trigger
language plpgsql
as $$
begin
  if new.profile_id is distinct from old.profile_id then
    raise exception 'L''autore di un post non può cambiare';
  end if;

  if auth.uid() is not null
     and old.status = 'removed'
     and new.status is distinct from old.status then
    raise exception 'Un post rimosso non può essere ripristinato';
  end if;

  return new;
end;
$$;

drop trigger if exists profile_posts_guard_columns on public.profile_posts;
create trigger profile_posts_guard_columns
before update on public.profile_posts
for each row execute function public.profile_posts_guard_columns();

drop trigger if exists profile_posts_set_updated_at on public.profile_posts;
create trigger profile_posts_set_updated_at
before update on public.profile_posts
for each row execute function public.set_updated_at();


-- ============================================================
-- SEZIONE 3 — profile_post_likes (stessa forma e RLS di club_media_likes)
-- ============================================================

create table if not exists public.profile_post_likes (
  post_id    uuid        not null references public.profile_posts(id) on delete cascade,
  profile_id uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, profile_id)
);

alter table public.profile_post_likes enable row level security;

revoke all on table public.profile_post_likes from anon;
grant select, insert, delete on table public.profile_post_likes to authenticated;

drop policy if exists "users read profile post likes" on public.profile_post_likes;
create policy "users read profile post likes"
on public.profile_post_likes
for select
to authenticated
using (
  exists (
    select 1 from public.profile_posts post
    where post.id = post_id and post.status = 'published'
  )
);

drop policy if exists "users manage own profile post likes" on public.profile_post_likes;
create policy "users manage own profile post likes"
on public.profile_post_likes
for all
to authenticated
using (public.is_current_user(profile_id))
with check (
  public.is_current_user(profile_id)
  and exists (
    select 1 from public.profile_posts post
    where post.id = post_id and post.status = 'published'
  )
);


-- ============================================================
-- SEZIONE 4 — profile_post_tagged_targets
--
-- Stessa forma di media_profile_post_tagged_targets nella sua definizione
-- attuale (status + target 'team' aggiunti da 20260615120200/20260619100000).
-- Un target 'team' è ammesso perché il payload `tagged` lo prevede e le altre
-- tre sorgenti lo ammettono.
-- ============================================================

create table if not exists public.profile_post_tagged_targets (
  post_id     uuid        not null references public.profile_posts(id) on delete cascade,
  target_type text        not null,
  target_id   uuid        not null,
  status      text        not null default 'active',
  created_at  timestamptz not null default timezone('utc', now()),
  primary key (post_id, target_type, target_id),
  constraint profile_post_tagged_targets_type_check
    check (target_type in ('profile', 'club', 'team')),
  constraint profile_post_tagged_targets_status_check
    check (status in ('active', 'hidden', 'reported', 'in_review', 'removed'))
);

create index if not exists profile_post_tagged_targets_type_id_idx
  on public.profile_post_tagged_targets (target_type, target_id);

alter table public.profile_post_tagged_targets enable row level security;

revoke all on table public.profile_post_tagged_targets from anon;
grant select, insert, update, delete on table public.profile_post_tagged_targets to authenticated;

drop policy if exists "published profile post tags readable by authenticated users"
  on public.profile_post_tagged_targets;
create policy "published profile post tags readable by authenticated users"
on public.profile_post_tagged_targets
for select
to authenticated
using (
  exists (
    select 1 from public.profile_posts post
    where post.id = post_id and post.status = 'published'
  )
);

drop policy if exists "profile post owners manage own tags" on public.profile_post_tagged_targets;
create policy "profile post owners manage own tags"
on public.profile_post_tagged_targets
for all
to authenticated
using (
  exists (
    select 1 from public.profile_posts post
    where post.id = post_id and public.is_current_user(post.profile_id)
  )
)
with check (
  exists (
    select 1 from public.profile_posts post
    where post.id = post_id and public.is_current_user(post.profile_id)
  )
);


-- ============================================================
-- SEZIONE 5 — regole polimorfiche: leggibilità e proprietà del post padre
--
-- SECURITY INVOKER di proposito: l'`exists` sul padre passa dalle policy del
-- padre. "Leggibile" significa esattamente ciò che il padre lascia leggere a
-- chi chiama (pubblicato per tutti, qualunque stato per il proprietario).
-- ============================================================

create or replace function public.content_post_is_readable(
  p_content_type text,
  p_post_id      uuid
)
returns boolean
language sql
stable
set search_path = public
as $$
  select case p_content_type
    when 'club_media'     then exists (select 1 from public.club_media_posts p     where p.id = p_post_id)
    when 'media_profile'  then exists (select 1 from public.media_profile_posts p  where p.id = p_post_id)
    when 'media_tribuna'  then exists (select 1 from public.media_tribuna_posts p  where p.id = p_post_id)
    when 'fan_tribuna'    then exists (select 1 from public.fan_tribuna_posts p    where p.id = p_post_id)
    when 'fan_media'      then exists (select 1 from public.fan_media_posts p      where p.id = p_post_id)
    when 'profile_post'   then exists (select 1 from public.profile_posts p        where p.id = p_post_id)
    else false
  end;
$$;

create or replace function public.content_post_is_owner(
  p_content_type text,
  p_post_id      uuid
)
returns boolean
language sql
stable
set search_path = public
as $$
  select case p_content_type
    when 'club_media'     then exists (select 1 from public.club_media_posts p
                                       where p.id = p_post_id and public.owns_club(p.club_id))
    when 'media_profile'  then exists (select 1 from public.media_profile_posts p
                                       where p.id = p_post_id and public.is_current_user(p.media_profile_id))
    when 'media_tribuna'  then exists (select 1 from public.media_tribuna_posts p
                                       where p.id = p_post_id and public.is_current_user(p.media_profile_id))
    when 'fan_tribuna'    then exists (select 1 from public.fan_tribuna_posts p
                                       where p.id = p_post_id and public.is_current_user(p.profile_id))
    when 'fan_media'      then exists (select 1 from public.fan_media_posts p
                                       where p.id = p_post_id and public.is_current_user(p.profile_id))
    when 'profile_post'   then exists (select 1 from public.profile_posts p
                                       where p.id = p_post_id and public.is_current_user(p.profile_id))
    else false
  end;
$$;

revoke all on function public.content_post_is_readable(text, uuid) from public;
revoke execute on function public.content_post_is_readable(text, uuid) from anon;
grant execute on function public.content_post_is_readable(text, uuid) to authenticated;

revoke all on function public.content_post_is_owner(text, uuid) from public;
revoke execute on function public.content_post_is_owner(text, uuid) from anon;
grant execute on function public.content_post_is_owner(text, uuid) to authenticated;


-- ============================================================
-- SEZIONE 6 — content_post_media e content_post_extras
-- ============================================================

create table if not exists public.content_post_media (
  content_type     text        not null,
  post_id          uuid        not null,
  position         smallint    not null,
  media_type       text        not null,
  url              text,
  thumbnail_url    text,
  width            integer,
  height           integer,
  duration_seconds integer,
  alt_text         text,
  processing_state text        not null default 'ready',
  created_at       timestamptz not null default timezone('utc', now()),
  primary key (content_type, post_id, position),
  constraint content_post_media_content_type_check check (content_type in (
    'club_media', 'media_profile', 'media_tribuna', 'fan_tribuna', 'fan_media', 'profile_post'
  )),
  constraint content_post_media_position_check check (position >= 0),
  constraint content_post_media_type_check check (media_type in ('image', 'video')),
  constraint content_post_media_state_check check (processing_state in ('ready', 'processing', 'failed')),
  constraint content_post_media_size_check check (
    (width is null or width > 0) and (height is null or height > 0)
  ),
  constraint content_post_media_duration_check check (
    duration_seconds is null or duration_seconds >= 0
  )
);

create table if not exists public.content_post_extras (
  content_type text        not null,
  post_id      uuid        not null,
  mentions     jsonb       not null default '[]'::jsonb,
  link_preview jsonb,
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now()),
  primary key (content_type, post_id),
  constraint content_post_extras_content_type_check check (content_type in (
    'club_media', 'media_profile', 'media_tribuna', 'fan_tribuna', 'fan_media', 'profile_post'
  )),
  constraint content_post_extras_mentions_check check (
    jsonb_typeof(mentions) = 'array' and jsonb_array_length(mentions) <= 50
  ),
  -- Solo https (§43): niente http, javascript:, data: nell'anteprima.
  constraint content_post_extras_link_preview_check check (
    link_preview is null
    or (
      jsonb_typeof(link_preview) = 'object'
      and (link_preview ->> 'url') ~ '^https://'
    )
  )
);

drop trigger if exists content_post_extras_set_updated_at on public.content_post_extras;
create trigger content_post_extras_set_updated_at
before update on public.content_post_extras
for each row execute function public.set_updated_at();

alter table public.content_post_media enable row level security;
alter table public.content_post_extras enable row level security;

revoke all on table public.content_post_media from anon;
revoke all on table public.content_post_extras from anon;
grant select, insert, update, delete on table public.content_post_media to authenticated;
grant select, insert, update, delete on table public.content_post_extras to authenticated;

drop policy if exists "post media readable with the post" on public.content_post_media;
create policy "post media readable with the post"
on public.content_post_media
for select
to authenticated
using (public.content_post_is_readable(content_type, post_id));

drop policy if exists "post owners manage post media" on public.content_post_media;
create policy "post owners manage post media"
on public.content_post_media
for all
to authenticated
using (public.content_post_is_owner(content_type, post_id))
with check (public.content_post_is_owner(content_type, post_id));

drop policy if exists "post extras readable with the post" on public.content_post_extras;
create policy "post extras readable with the post"
on public.content_post_extras
for select
to authenticated
using (public.content_post_is_readable(content_type, post_id));

drop policy if exists "post owners manage post extras" on public.content_post_extras;
create policy "post owners manage post extras"
on public.content_post_extras
for all
to authenticated
using (public.content_post_is_owner(content_type, post_id))
with check (public.content_post_is_owner(content_type, post_id));


-- ============================================================
-- SEZIONE 7 — allineamento delle sorgenti legacy
--
-- (a) Posizione 0 = il visual che la sorgente già ha, con la stessa regola del
--     Feed (thumbnail o visual presenti). Il trigger la mantiene su insert e
--     update; le posizioni > 0 non vengono mai toccate. Se la sorgente perde il
--     visual, cade solo la posizione 0.
-- (b) Alla cancellazione del padre, media ed extras vanno via con lui.
--
-- media_tribuna_posts non ha un visual: solo il trigger di cancellazione.
-- ============================================================

create or replace function public.content_post_sync_legacy_media()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v        jsonb := to_jsonb(new);
  v_ct     text;
  v_url    text;
  v_type   text;
  v_thumb  text;
  v_dur    integer;
begin
  case tg_table_name
    when 'club_media_posts' then
      v_ct := 'club_media';
      v_url := v ->> 'visual_url';
      v_type := v ->> 'visual_type';
      v_thumb := v ->> 'thumbnail_url';
      v_dur := nullif(v ->> 'video_duration_seconds', '')::integer;
    when 'media_profile_posts' then
      v_ct := 'media_profile';
      v_url := v ->> 'cover_url';
      v_type := v ->> 'cover_type';
    when 'fan_tribuna_posts' then
      v_ct := 'fan_tribuna';
      v_url := v ->> 'media_url';
      v_type := v ->> 'media_type';
      v_thumb := v ->> 'thumbnail_url';
    when 'fan_media_posts' then
      v_ct := 'fan_media';
      v_url := v ->> 'visual_url';
      v_type := v ->> 'visual_type';
      v_thumb := v ->> 'thumbnail_url';
    else
      return new;
  end case;

  if coalesce(v_thumb, v_url) is null then
    delete from public.content_post_media m
    where m.content_type = v_ct and m.post_id = new.id and m.position = 0;
  else
    insert into public.content_post_media as m (
      content_type, post_id, position, media_type, url, thumbnail_url, duration_seconds
    ) values (
      v_ct, new.id, 0, coalesce(v_type, 'image'), v_url, v_thumb, v_dur
    )
    on conflict (content_type, post_id, position) do update
      set media_type       = excluded.media_type,
          url              = excluded.url,
          thumbnail_url    = excluded.thumbnail_url,
          duration_seconds = excluded.duration_seconds,
          -- Un visual nuovo ha dimensioni e alt nuovi: tenere quelli vecchi
          -- darebbe al Feed il rapporto sbagliato (spazio riservato errato, §40).
          width            = case when m.url is distinct from excluded.url then null else m.width end,
          height           = case when m.url is distinct from excluded.url then null else m.height end,
          alt_text         = case when m.url is distinct from excluded.url then null else m.alt_text end;
  end if;

  return new;
end;
$$;

revoke all on function public.content_post_sync_legacy_media() from public;
revoke execute on function public.content_post_sync_legacy_media() from anon, authenticated;

create or replace function public.content_post_cleanup_children()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ct text := case tg_table_name
    when 'club_media_posts'    then 'club_media'
    when 'media_profile_posts' then 'media_profile'
    when 'media_tribuna_posts' then 'media_tribuna'
    when 'fan_tribuna_posts'   then 'fan_tribuna'
    when 'fan_media_posts'     then 'fan_media'
    when 'profile_posts'       then 'profile_post'
  end;
begin
  delete from public.content_post_media m
  where m.content_type = v_ct and m.post_id = old.id;
  delete from public.content_post_extras x
  where x.content_type = v_ct and x.post_id = old.id;
  return old;
end;
$$;

revoke all on function public.content_post_cleanup_children() from public;
revoke execute on function public.content_post_cleanup_children() from anon, authenticated;

drop trigger if exists content_post_sync_media on public.club_media_posts;
create trigger content_post_sync_media
after insert or update on public.club_media_posts
for each row execute function public.content_post_sync_legacy_media();

drop trigger if exists content_post_sync_media on public.media_profile_posts;
create trigger content_post_sync_media
after insert or update on public.media_profile_posts
for each row execute function public.content_post_sync_legacy_media();

drop trigger if exists content_post_sync_media on public.fan_tribuna_posts;
create trigger content_post_sync_media
after insert or update on public.fan_tribuna_posts
for each row execute function public.content_post_sync_legacy_media();

drop trigger if exists content_post_sync_media on public.fan_media_posts;
create trigger content_post_sync_media
after insert or update on public.fan_media_posts
for each row execute function public.content_post_sync_legacy_media();

drop trigger if exists content_post_cleanup on public.club_media_posts;
create trigger content_post_cleanup
after delete on public.club_media_posts
for each row execute function public.content_post_cleanup_children();

drop trigger if exists content_post_cleanup on public.media_profile_posts;
create trigger content_post_cleanup
after delete on public.media_profile_posts
for each row execute function public.content_post_cleanup_children();

drop trigger if exists content_post_cleanup on public.media_tribuna_posts;
create trigger content_post_cleanup
after delete on public.media_tribuna_posts
for each row execute function public.content_post_cleanup_children();

drop trigger if exists content_post_cleanup on public.fan_tribuna_posts;
create trigger content_post_cleanup
after delete on public.fan_tribuna_posts
for each row execute function public.content_post_cleanup_children();

drop trigger if exists content_post_cleanup on public.fan_media_posts;
create trigger content_post_cleanup
after delete on public.fan_media_posts
for each row execute function public.content_post_cleanup_children();

drop trigger if exists content_post_cleanup on public.profile_posts;
create trigger content_post_cleanup
after delete on public.profile_posts
for each row execute function public.content_post_cleanup_children();

-- Backfill: una riga (posizione 0) per ogni post legacy che ha un visual, con
-- la regola del Feed (thumbnail o visual). Dimensioni sconosciute: null.
insert into public.content_post_media (content_type, post_id, position, media_type, url, thumbnail_url, duration_seconds)
select 'club_media', cmp.id, 0, coalesce(cmp.visual_type, 'image'), cmp.visual_url, cmp.thumbnail_url, cmp.video_duration_seconds
from public.club_media_posts cmp
where coalesce(cmp.thumbnail_url, cmp.visual_url) is not null
on conflict (content_type, post_id, position) do nothing;

insert into public.content_post_media (content_type, post_id, position, media_type, url, thumbnail_url, duration_seconds)
select 'media_profile', mpp.id, 0, coalesce(mpp.cover_type, 'image'), mpp.cover_url, null, null
from public.media_profile_posts mpp
where mpp.cover_url is not null
on conflict (content_type, post_id, position) do nothing;

insert into public.content_post_media (content_type, post_id, position, media_type, url, thumbnail_url, duration_seconds)
select 'fan_tribuna', ftp.id, 0, coalesce(ftp.media_type, 'image'), ftp.media_url, ftp.thumbnail_url, null
from public.fan_tribuna_posts ftp
where coalesce(ftp.thumbnail_url, ftp.media_url) is not null
on conflict (content_type, post_id, position) do nothing;

insert into public.content_post_media (content_type, post_id, position, media_type, url, thumbnail_url, duration_seconds)
select 'fan_media', fmp.id, 0, coalesce(fmp.visual_type, 'image'), fmp.visual_url, fmp.thumbnail_url, null
from public.fan_media_posts fmp
where coalesce(fmp.thumbnail_url, fmp.visual_url) is not null
on conflict (content_type, post_id, position) do nothing;


-- ============================================================
-- SEZIONE 8 — feed_content_index: profile_post come sesta sorgente
--
-- Riemessa dalla definizione più recente (20261009160000 §6). Cambia solo:
--   * la colonna `body` in coda (testo intero; `excerpt` resta quello che il
--     Feed taglia a 280);
--   * il ramo profile_posts.
-- Aggiungere una colonna in coda è l'unico cambiamento di forma che
-- `create or replace view` ammette: le altre colonne restano identiche.
-- ============================================================

create or replace view public.feed_content_index as

  -- ── club_media_posts (contenuto ufficiale di una società) ──────
  select
    'club_media'::text                                      as content_type,
    cmp.id                                                  as post_id,
    case
      when cmp.visual_type = 'video'                            then 'video'
      when cmp.visual_type = 'image' and cmp.body is null       then 'foto'
      when length(coalesce(cmp.body, '')) >= 400                then 'articolo'
      else 'post'
    end                                                     as content_format,
    cmp.kind                                                as kind,
    cmp.title                                               as title,
    coalesce(cmp.excerpt, cmp.body)                         as excerpt,
    coalesce(cmp.thumbnail_url, cmp.visual_url)             as thumbnail_url,
    cmp.visual_type                                         as media_type,
    cmp.video_duration_seconds                              as duration_seconds,
    'club'::text                                            as publisher_type,
    cmp.club_id                                             as publisher_id,
    c.name                                                  as publisher_name,
    c.logo_url                                              as publisher_avatar_url,
    'ufficiale'::text                                       as source_kind,
    cmp.interviewee_name                                    as author_name,
    cmp.published_at                                        as published_at,
    c.region                                                as publisher_region,
    (c.verification_status = 'verified')                    as publisher_is_verified,
    coalesce(cmp.body, cmp.excerpt)                         as body
  from public.club_media_posts cmp
  join public.clubs c on c.id = cmp.club_id
  where cmp.status = 'published'
    and cmp.published_at is not null

  union all

  -- ── media_profile_posts (contenuto editoriale) ──────────────────
  select
    'media_profile'::text,
    mpp.id,
    (case
      when mpp.kind = 'media' and mpp.cover_type = 'video' then 'video'
      when mpp.kind = 'media'                            then 'foto'
      else 'articolo'
    end)::text,
    mpp.kind,
    mpp.title,
    coalesce(mpp.excerpt, mpp.subtitle),
    mpp.cover_url,
    mpp.cover_type,
    null::int,
    'profile'::text,
    mpp.media_profile_id,
    coalesce(mp.entity_name, p.full_name),
    coalesce(mp.logo_url, p.avatar_url),
    coalesce(mp.media_kind, 'pagina'),
    mpp.author_name,
    mpp.published_at,
    p.region,
    (mp.verification_status = 'verified'),
    coalesce(mpp.body, mpp.excerpt, mpp.subtitle)
  from public.media_profile_posts mpp
  join public.media_profiles mp on mp.profile_id = mpp.media_profile_id
  join public.profiles p        on p.id = mpp.media_profile_id
  where mpp.status = 'published'
    and mpp.published_at is not null

  union all

  -- ── media_tribuna_posts (dibattiti / sondaggi editoriali) ───────
  -- `excerpt` è il body intero: vedi delta 3 nell'header.
  select
    'media_tribuna'::text,
    mtp.id,
    'post'::text,
    mtp.kind,
    mtp.title,
    mtp.body,
    null::text,
    null::text,
    null::int,
    'profile'::text,
    mtp.media_profile_id,
    coalesce(mp.entity_name, p.full_name),
    coalesce(mp.logo_url, p.avatar_url),
    coalesce(mp.media_kind, 'pagina'),
    null::text,
    mtp.published_at,
    p.region,
    (mp.verification_status = 'verified'),
    mtp.body
  from public.media_tribuna_posts mtp
  join public.media_profiles mp on mp.profile_id = mtp.media_profile_id
  join public.profiles p        on p.id = mtp.media_profile_id
  where mtp.status = 'published'
    and mtp.published_at is not null

  union all

  -- ── fan_tribuna_posts (contenuto tifoso: opinioni, foto, sondaggi) ──
  select
    'fan_tribuna'::text,
    ftp.id,
    case
      when ftp.kind = 'photo' and ftp.media_type = 'video' then 'video'
      when ftp.kind = 'photo'                              then 'foto'
      else 'post'
    end,
    ftp.kind,
    ftp.title,
    ftp.body,
    coalesce(ftp.thumbnail_url, ftp.media_url),
    ftp.media_type,
    null::int,
    'profile'::text,
    ftp.profile_id,
    p.full_name,
    p.avatar_url,
    'tifoso'::text,
    null::text,
    ftp.published_at,
    p.region,
    false,
    ftp.body
  from public.fan_tribuna_posts ftp
  join public.profiles p on p.id = ftp.profile_id
  where ftp.status = 'published'
    and ftp.published_at is not null

  union all

  -- ── fan_media_posts (bacheca tifoso: foto e video) ──────────────
  -- title/excerpt invertiti rispetto a media_content_index: vedi delta 2.
  select
    'fan_media'::text,
    fmp.id,
    case when fmp.visual_type = 'video' then 'video' else 'foto' end,
    fmp.tag,
    null::text,
    fmp.description,
    coalesce(fmp.thumbnail_url, fmp.visual_url),
    fmp.visual_type,
    null::int,
    'profile'::text,
    fmp.profile_id,
    p.full_name,
    p.avatar_url,
    'tifoso'::text,
    null::text,
    fmp.published_at,
    p.region,
    false,
    fmp.description
  from public.fan_media_posts fmp
  join public.profiles p on p.id = fmp.profile_id
  where fmp.status = 'published'
    and fmp.published_at is not null

  union all

  -- ── profile_posts (post delle persone: HOM-02) ──────────────────
  -- `kind` e `title` assenti: il Post persona è testo + media, senza
  -- tipologia editoriale. Thumbnail, tipo e durata vengono dalla prima riga
  -- di content_post_media (posizione 0). source_kind 'persona' non coincide
  -- con nessun valore che il Feed usa per le preferenze (testata, giornalista,
  -- creator, pagina). Nessuna verifica esiste per le persone: false.
  select
    'profile_post'::text,
    pp.id,
    'post'::text,
    null::text,
    null::text,
    nullif(pp.body, ''),
    coalesce(m.thumbnail_url, m.url),
    m.media_type,
    m.duration_seconds,
    'profile'::text,
    pp.profile_id,
    p.full_name,
    p.avatar_url,
    'persona'::text,
    null::text,
    pp.published_at,
    p.region,
    false,
    pp.body
  from public.profile_posts pp
  join public.profiles p on p.id = pp.profile_id
  left join lateral (
    select cpm.thumbnail_url, cpm.url, cpm.media_type, cpm.duration_seconds
    from public.content_post_media cpm
    where cpm.content_type = 'profile_post' and cpm.post_id = pp.id
    order by cpm.position
    limit 1
  ) m on true
  where pp.status = 'published'
    and pp.published_at <= timezone('utc', now());

-- La vista resta non leggibile direttamente: le RPC del Feed sono
-- SECURITY DEFINER e la interrogano al posto del client.
revoke all on table public.feed_content_index from anon, authenticated;


-- ============================================================
-- SEZIONE 9 — footme_post_payloads: il Post social standard, in un punto solo
--
-- Costruisce, in batch su (content_type, post_id), le chiavi aggiunte a `data`
-- dei Post (§14–§24, §80–§81). I contatori e l'is_liked si calcolano per
-- l'insieme di chiavi, non per riga. Non restituisce created_by_* né alcun
-- "acted_by" (§111).
--
-- DEFINER perché legge tabelle che il chiamante non deve poter interrogare per
-- intero (user_blocks, club_members) e perché lavora sulle chiavi che la
-- vista ha già ammesso. È interna: nessun ruolo client la esegue.
-- ============================================================

create or replace function public.footme_post_payloads(
  p_viewer        uuid,
  p_content_types text[],
  p_post_ids      uuid[]
)
returns table (
  r_content_type text,
  r_post_id      uuid,
  payload        jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with keys as (
    select k.content_type, k.post_id
    from unnest(p_content_types, p_post_ids) as k(content_type, post_id)
  ),
  blocked as (
    select ub.blocked_profile_id as profile_id
    from public.user_blocks ub
    where ub.blocker_profile_id = p_viewer
    union
    select ub.blocker_profile_id
    from public.user_blocks ub
    where ub.blocked_profile_id = p_viewer
  ),

  -- Solo ciò che il Feed mostrerebbe: pubblicato (la vista lo garantisce),
  -- non programmato, autore profilo non bloccato in nessuna direzione.
  base as (
    select
      fci.content_type, fci.post_id, fci.body,
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
      and not (
        fci.publisher_type = 'profile'
        and exists (select 1 from blocked bl where bl.profile_id = fci.publisher_id)
      )
  ),

  media_agg as (
    select
      m.content_type, m.post_id,
      jsonb_agg(
        jsonb_build_object(
          'media_id',         m.content_type || ':' || m.post_id::text || ':' || m.position::text,
          'media_type',       m.media_type,
          'position',         m.position,
          'url',              m.url,
          'thumbnail_url',    m.thumbnail_url,
          'width',            m.width,
          'height',           m.height,
          'duration_seconds', m.duration_seconds,
          'alt_text',         m.alt_text,
          'processing_state', m.processing_state,
          'availability',     case when m.url is null then 'unavailable' else 'available' end
        )
        order by m.position
      ) as media
    from public.content_post_media m
    join base b on b.content_type = m.content_type and b.post_id = m.post_id
    group by m.content_type, m.post_id
  ),

  likes_agg as (
    select
      l.content_type, l.post_id,
      count(*)::int as n,
      coalesce(bool_or(l.profile_id = p_viewer), false) as liked
    from (
      select 'club_media'::text as content_type, x.post_id, x.profile_id
      from public.club_media_likes x
      join base b on b.content_type = 'club_media' and b.post_id = x.post_id
      union all
      select 'fan_media', x.post_id, x.profile_id
      from public.fan_media_likes x
      join base b on b.content_type = 'fan_media' and b.post_id = x.post_id
      union all
      select 'profile_post', x.post_id, x.profile_id
      from public.profile_post_likes x
      join base b on b.content_type = 'profile_post' and b.post_id = x.post_id
    ) l
    group by l.content_type, l.post_id
  ),

  comments_agg as (
    select c.content_type, c.post_id, count(*)::int as n
    from (
      select 'club_media'::text as content_type, x.post_id
      from public.club_media_comments x
      join base b on b.content_type = 'club_media' and b.post_id = x.post_id
      union all
      select 'media_profile', x.post_id
      from public.media_profile_post_comments x
      join base b on b.content_type = 'media_profile' and b.post_id = x.post_id
      union all
      select 'media_tribuna', x.post_id
      from public.media_tribuna_comments x
      join base b on b.content_type = 'media_tribuna' and b.post_id = x.post_id
      union all
      select 'fan_tribuna', x.post_id
      from public.fan_tribuna_comments x
      join base b on b.content_type = 'fan_tribuna' and b.post_id = x.post_id
      union all
      select 'fan_media', x.post_id
      from public.fan_media_comments x
      join base b on b.content_type = 'fan_media' and b.post_id = x.post_id
    ) c
    group by c.content_type, c.post_id
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
    where not (
      tr.target_type = 'profile'
      and exists (select 1 from blocked bl where bl.profile_id = tr.target_id)
    )
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
      b.content_type, b.post_id, b.body, b.source_kind,
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
      coalesce(
        case when b.publisher_type = 'club' then cl.owner_profile_id = p_viewer end,
        case when b.publisher_type = 'profile' then b.publisher_id = p_viewer end,
        false
      ) as is_own
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
      'body',                 coalesce(a.body, ''),
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
      'is_liked',       coalesce(la.liked, false),
      'capabilities', jsonb_build_object(
        'can_like',          a.content_type in ('club_media', 'fan_media', 'profile_post'),
        'can_comment',       a.content_type <> 'profile_post',
        'can_share',         true,
        'can_save',          a.content_type <> 'profile_post',
        'can_report',        not a.is_own,
        'can_edit',          a.is_own,
        'can_delete',        a.is_own,
        'can_view_insights', false
      ),
      'status', 'published'
    ) as payload
  from authored a
  left join media_agg ma    on ma.content_type = a.content_type and ma.post_id = a.post_id
  left join likes_agg la    on la.content_type = a.content_type and la.post_id = a.post_id
  left join comments_agg ca on ca.content_type = a.content_type and ca.post_id = a.post_id
  left join tags_agg ta     on ta.content_type = a.content_type and ta.post_id = a.post_id
  left join public.content_post_extras ex
    on ex.content_type = a.content_type and ex.post_id = a.post_id;
$$;

-- Funzione interna: la chiamano solo le RPC definer del Feed. Nessun ruolo
-- client la esegue direttamente (accetta un viewer arbitrario).
revoke all on function public.footme_post_payloads(uuid, text[], uuid[]) from public;
revoke execute on function public.footme_post_payloads(uuid, text[], uuid[]) from anon, authenticated;


-- ============================================================
-- SEZIONE 10 — fetch_home_feed_page: `data` dei Post esteso
--
-- Riemessa per intero dalla definizione più recente,
-- 20260727150000_home_feed_target_role_cast.sql (nessuna migrazione
-- successiva la tocca: verificato con grep). Cambiano SOLO tre punti:
--
--   1. due CTE (post_keys, post_payloads) tra slot_rows e feed_rows;
--   2. `data` delle righe item_type = 'post' riceve le chiavi di
--      footme_post_payloads (le chiavi legacy restano identiche);
--   3. un left join a post_payloads nella select finale.
--
-- Firma, colonne, ranking, cursore, blocco autori e diversificazione sono
-- invariati. Aggiunto `revoke execute ... from anon`, che la versione
-- originale non faceva.
-- ============================================================

create or replace function public.fetch_home_feed_page(
  p_tab                 text        default 'per_te',
  p_as_of               timestamptz default null,
  p_cursor_bucket       smallint    default null,
  p_cursor_published_at timestamptz default null,
  p_cursor_uid          text        default null,
  p_page_index          int         default 0,
  p_limit               int         default 10
)
returns table (
  item_uid                 text,
  item_type                text,
  rank_position            int,
  rank_bucket              smallint,
  layout_hint              text,
  component_version        smallint,
  title                    text,
  excerpt                  text,
  thumbnail_url            text,
  published_at             timestamptz,
  author_kind              text,
  author_id                uuid,
  author_name              text,
  author_avatar_url        text,
  author_source_kind       text,
  author_is_verified       boolean,
  is_seen                  boolean,
  is_saved                 boolean,
  is_following_author      boolean,
  suggestion_reason_key    text,
  suggestion_reason_label  text,
  nav_kind                 text,
  nav_params               jsonb,
  data                     jsonb,
  as_of                    timestamptz,
  next_cursor_bucket       smallint,
  next_cursor_published_at timestamptz,
  next_cursor_uid          text,
  is_last_page             boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
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
  blocked_profiles as (
    select ub.blocked_profile_id as profile_id
    from public.user_blocks ub
    where ub.blocker_profile_id = v_uid
    union
    select ub.blocker_profile_id
    from public.user_blocks ub
    where ub.blocked_profile_id = v_uid
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
  ),
  saved_positions as (
    select sa.ad_id from public.saved_ads sa where sa.profile_id = v_uid
  ),

  -- ── candidati: contenuti ────────────────────────────────────────
  content_candidates as (
    select
      fci.content_type || ':' || fci.post_id::text        as item_uid,
      public.footme_feed_item_type(fci.content_format)    as item_type,
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
      null::boolean                                      as is_secondary_match
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
      and (
        fci.publisher_type <> 'profile'
        or not exists (select 1 from blocked_profiles bp where bp.profile_id = fci.publisher_id)
      )
      and (p_tab = 'per_te' or aff.is_following)
      and (
        p_tab = 'seguiti'
        or not v_use_floor
        or fci.published_at >= v_as_of - interval '180 days'
      )
      and fci.published_at <= v_as_of
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
      pa.is_secondary_match                              as is_secondary_match
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

  -- HOM-02: il payload completo dei Post della pagina è costruito in batch,
  -- una volta, sulle sole chiavi emesse. Gli array escono dalla stessa
  -- aggregazione con lo stesso ordine, quindi restano allineati.
  post_keys as (
    select
      array_agg(e.content_type order by e.item_uid) as content_types,
      array_agg(e.post_id      order by e.item_uid) as post_ids
    from emitted e
    where e.item_type = 'post'
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
      e.target_role, e.is_secondary_match,
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
      null::text, null::boolean,
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
      -- HOM-02: solo i Post portano le chiavi del Post social standard.
      || case
           when fr.item_type = 'post' then coalesce(ppl.payload, '{}'::jsonb)
           else '{}'::jsonb
         end
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
    on fr.item_type = 'post'
   and ppl.r_content_type = fr.content_type
   and ppl.r_post_id = fr.post_id
  order by fr.sort_key;
end;
$$;

revoke all on function public.fetch_home_feed_page(text, timestamptz, smallint, timestamptz, text, int, int) from public;
revoke execute on function public.fetch_home_feed_page(text, timestamptz, smallint, timestamptz, text, int, int) from anon;
grant execute on function public.fetch_home_feed_page(text, timestamptz, smallint, timestamptz, text, int, int) to authenticated;

-- ============================================================
-- SEZIONE 11 — set_content_like: il "Mi piace" come SET idempotente
--
-- SECURITY INVOKER: la scrittura passa dalle policy delle tabelle di like
-- ("manage own": is_current_user + padre pubblicato) e il conteggio dalla loro
-- policy di lettura. Il controllo di leggibilità esplicito sul padre rende
-- esplicito l'errore invece di lasciare che sia una violazione RLS. Per
-- fan_media vale anche il blocco, come nel Feed.
-- ============================================================

create or replace function public.set_content_like(
  p_content_type text,
  p_post_id      uuid,
  p_liked        boolean
)
returns table (
  likes_count integer,
  is_liked    boolean
)
language plpgsql
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_liked is null then
    raise exception 'Stato del Mi piace mancante';
  end if;

  if p_content_type = 'club_media' then
    if not exists (
      select 1 from public.club_media_posts p
      where p.id = p_post_id and p.status = 'published'
    ) then
      raise exception 'Contenuto non disponibile';
    end if;

    if p_liked then
      insert into public.club_media_likes as l (post_id, profile_id)
      values (p_post_id, v_uid)
      on conflict (post_id, profile_id) do nothing;
    else
      delete from public.club_media_likes l
      where l.post_id = p_post_id and l.profile_id = v_uid;
    end if;

    select count(*)::integer into v_count
    from public.club_media_likes l where l.post_id = p_post_id;

  elsif p_content_type = 'fan_media' then
    if not exists (
      select 1 from public.fan_media_posts p
      where p.id = p_post_id and p.status = 'published'
        and not public.is_profile_blocked_with_viewer(p.profile_id)
    ) then
      raise exception 'Contenuto non disponibile';
    end if;

    if p_liked then
      insert into public.fan_media_likes as l (post_id, profile_id)
      values (p_post_id, v_uid)
      on conflict (post_id, profile_id) do nothing;
    else
      delete from public.fan_media_likes l
      where l.post_id = p_post_id and l.profile_id = v_uid;
    end if;

    select count(*)::integer into v_count
    from public.fan_media_likes l where l.post_id = p_post_id;

  elsif p_content_type = 'profile_post' then
    -- La lettura passa già dalla policy di profile_posts (pubblicato, non
    -- programmato, autore non bloccato).
    if not exists (
      select 1 from public.profile_posts p
      where p.id = p_post_id and p.status = 'published'
    ) then
      raise exception 'Contenuto non disponibile';
    end if;

    if p_liked then
      insert into public.profile_post_likes as l (post_id, profile_id)
      values (p_post_id, v_uid)
      on conflict (post_id, profile_id) do nothing;
    else
      delete from public.profile_post_likes l
      where l.post_id = p_post_id and l.profile_id = v_uid;
    end if;

    select count(*)::integer into v_count
    from public.profile_post_likes l where l.post_id = p_post_id;

  else
    raise exception 'Tipo di contenuto non supportato per il Mi piace: %',
      coalesce(p_content_type, 'null');
  end if;

  return query select v_count, p_liked;
end;
$$;

revoke all on function public.set_content_like(text, uuid, boolean) from public;
revoke execute on function public.set_content_like(text, uuid, boolean) from anon;
grant execute on function public.set_content_like(text, uuid, boolean) to authenticated;


-- ============================================================
-- SEZIONE 12 — fetch_profile_post_detail
--
-- Dettaglio di un post persona (il tap su un media apre /content/[type]/[id]).
-- Restituisce null quando il post non è leggibile per il chiamante: non
-- esiste, non è pubblicato, è programmato, o l'autore è bloccato in una
-- direzione. Lo stesso payload `data` del Feed, più le chiavi legacy, così il
-- client ha un solo parser. L'autore è solo {id, name, avatar_url,
-- is_verified}: mai created_by_* (§111).
-- ============================================================

create or replace function public.fetch_profile_post_detail(p_post_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select jsonb_build_object(
    'post_id',      fci.post_id,
    'published_at', fci.published_at,
    'author', jsonb_build_object(
      'id',          fci.publisher_id,
      'name',        fci.publisher_name,
      'avatar_url',  fci.publisher_avatar_url,
      'is_verified', coalesce(fci.publisher_is_verified, false)
    ),
    'data', jsonb_build_object(
      'content_type',     fci.content_type,
      'post_id',          fci.post_id,
      'kind',             fci.kind,
      'kind_label',       public.footme_content_kind_label(fci.content_type, fci.kind),
      'content_format',   fci.content_format,
      'media_type',       fci.media_type,
      'duration_seconds', fci.duration_seconds,
      'is_truncated',     false
    ) || pl.payload
  )
  into v_result
  from public.feed_content_index fci
  join lateral public.footme_post_payloads(
    v_uid, array['profile_post'], array[p_post_id]
  ) pl on pl.r_post_id = fci.post_id
  where fci.content_type = 'profile_post'
    and fci.post_id = p_post_id;

  return v_result;
end;
$$;

revoke all on function public.fetch_profile_post_detail(uuid) from public;
revoke execute on function public.fetch_profile_post_detail(uuid) from anon;
grant execute on function public.fetch_profile_post_detail(uuid) to authenticated;
