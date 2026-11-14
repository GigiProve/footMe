-- ============================================================
-- HOM-07 — Mi piace e Salvataggi: dati
--
-- COSA MANCAVA
--
-- Il task HOM-07 (§1–§19, §22–§31, §45–§69, §70–§84, §94–§100, §102–§164,
-- §165–§174, §189–§192) chiede un sistema trasversale di Mi piace e di
-- Salvataggi. Oggi mancano cinque cose:
--
--   1. UN SOLO DOMINIO MI PIACE. I Mi piace stavano in quattro tabelle (una per
--      content type: club_media_likes, fan_media_likes, profile_post_likes,
--      media_profile_post_likes) e appartenevano al PROFILO che li metteva.
--      §1 («non creare sistemi Like differenti per content type») e §10–§12
--      (il Like appartiene all'identità che interagisce: PERSON, SOCIETY o
--      MEDIA, univoco per identità + contenuto) non sono esprimibili così: una
--      Società non può mettere Mi piace come Società.
--   2. CHI HA MESSO MI PIACE. Non c'è una lista (§45–§69): servono accesso
--      regolato dal contenuto (§62), filtri su identità eliminate/sospese e
--      Block (§63, §173), ranking e paginazione senza duplicati (§58–§60) e un
--      conteggio che derivi dalla stessa definizione della lista (§68, §174).
--   3. L'IDENTITÀ DI INTERAZIONE. Nessuna RPC dice con quali identità l'utente
--      può mettere Mi piace (§168), né il payload dice quali di esse l'hanno
--      già messo (§9).
--   4. UNA SOLA SCRITTURA PER I SALVATI. Ogni target aveva la sua tabella e la
--      sua scrittura diretta dal client (§83–§84): nessun controllo che il
--      target sia accessibile ORA (§169–§172). Il Post persona non aveva un
--      Salvato (HOM-02 lo aveva rinviato a questa task), le squadre salvate non
--      comparivano da nessuna parte nella lettura per categoria, e mancava
--      una lettura per categoria con ordine per data di salvataggio e keyset
--      (§105, §120–§121, §160–§162).
--   5. LA PULIZIA. Un contenuto eliminato restava nei Salvati (§144–§145).
--
-- DECISIONI DI LUIGI (2026-11-14) CHE QUESTA MIGRAZIONE REALIZZA
--
--   1. Like per identità. L'identità di interazione è una di quelle con cui si
--      può pubblicare (footme_publishing_identities, HOM-06.1: persona per i
--      ruoli non Media, Società con content_create, Media): UNA regola di
--      autorizzazione per pubblicare e per mettere Mi piace. Nessun selettore
--      (§11): lo sceglie il client.
--   2. Le squadre salvate vivono dentro la categoria Società (§82), come
--      target_type 'team'.
--
-- PERCHÉ QUESTA SOLUZIONE
--
--   * content_likes — chiave (content_type, post_id, actor_type, actor_id).
--     Nessuna policy né grant: si legge e si scrive solo dalle RPC, quindi i
--     filtri e le autorizzazioni non si aggirano con una select. Backfill dalle
--     quattro tabelle legacy con created_at preservato.
--   * footme_visible_likes è l'unica definizione di «Mi piace visibile al
--     viewer». Conteggio del payload, liked_as, risposta della mutation, lista e
--     Insights (HOM-05) leggono tutti da lì: nessuna divergenza possibile.
--   * footme_content_readable / footme_publisher_blocked sono l'unica regola di
--     «il contenuto è leggibile adesso» per Like, Salvataggio e lista. È la
--     regola del Feed (pubblicato, non programmato, non eliminato, publisher non
--     bloccato) più il blocco con il titolare della Società: il Feed non lo
--     applica ai club_media, ma §172 chiede che un Like non nasca da un
--     contenuto non più accessibile, e vale anche per i contenuti di Società.
--   * footme_saved_rows è l'unica definizione di «cosa compare nei Salvati»:
--     list_saved e fetch_saved_counts leggono da lì, quindi una lista e il suo
--     numero non divergono. Le posizioni riusano saved_positions_base
--     (DAS-REV: aperta/chiusa, is_navigable): chiusa non è inesistente (§149).
--   * set_saved scrive nelle tabelle esistenti (§84) dopo aver chiesto a
--     footme_saved_target_accessible se il target è accessibile ORA (§169–§172).
--     Le tabelle saved_* restano scrivibili dal client perché le app già
--     distribuite le usano direttamente, ma le loro policy di INSERT/UPDATE
--     chiamano la STESSA funzione: nessuna scrittura diretta può salvare ciò che
--     set_saved rifiuta. DELETE e SELECT restano del solo proprietario (togliere
--     un Salvato è sempre possibile). saved_profile_posts, nuova, non ha
--     scritture dal client: si scrive solo con set_saved.
--   * Nessuna notifica e nessun content_event per Like o Save (§76, §192): la
--     tabella content_likes, con created_at, è la sorgente di eventi futuri
--     (§191).
--
-- DEVIAZIONI DAL CONTRATTO DI COORDINAMENTO
--
--   * Il backfill NON mappa per ruolo ma con la regola di set_content_like
--     (footme_publishing_identities): persona per player/coach/staff/agent/
--     director/fan; Media solo con la sua riga media_profiles; club_admin → la
--     sua Società più vecchia fra quelle che possiede o in cui ha content_create
--     e che oggi è valida. I Like legacy che non si mappano su nessuna identità
--     (ruolo admin, Media senza profilo, club_admin senza Società valida) sono
--     SCARTATI: nessuna RPC potrebbe mai mostrarli né toglierli.
--   * togliere un Mi piace è permesso anche se il contenuto non è più leggibile
--     (richiede comunque l'identità autorizzata; il conteggio restituito è 0):
--     è una pulizia, come togliere un Salvato.
--   * Le posizioni salvate seguono la stessa esclusione dei club: titolare della
--     Società bloccato → non salvabile e fuori dalla lista.
--   * content_likes.acted_by è NULLABLE con ON DELETE SET NULL (il contratto
--     diceva NOT NULL + CASCADE): cancellare l'account di un amministratore non
--     deve cancellare il Mi piace della Società. I Like di persona/media di un
--     profilo eliminato escono con un trigger sulla riga profiles.
--   * set_saved ha p_saved prima di p_content_type (in Postgres un parametro con
--     default non può precedere uno senza). Il client chiama con argomenti con nome.
--   * Le due ex tabelle club_media_likes e fan_media_likes restano come viste di
--     sola lettura NON security_invoker (content_likes non ha policy: una vista
--     invoker non restituirebbe nulla); filtrano con gli stessi predicati della
--     lista (contenuto leggibile, attore visibile per auth.uid()), quindi non
--     espongono più di list_content_likers. Sono per i lettori client legacy: il
--     conteggio di queste viste non è quello del payload (niente Società).
--
-- VOLUTAMENTE NON TOCCATO
--
--   * fetch_saved_items (lettura legacy a pagine offset): resta com'è. Il Saved
--     Center nuovo legge list_saved; la vecchia RPC non conosce i Post persona
--     salvati e mette le squadre nel filtro 'club'. Da ritirare quando il client
--     nuovo è in produzione.
--   * footme_feed_readable_items: il Feed non applica il blocco con il titolare
--     della Società ai club_media; lo applicano solo Like, Salvataggi e lista
--     (footme_content_readable). Uniformare il Feed è una decisione di prodotto.
--   * La scrittura diretta sulle tabelle saved_* dal client: resta per le app già
--     distribuite, ora con la stessa accessibilità di set_saved (vedi sopra);
--     revocarla del tutto è un follow-up quando il nuovo client è in produzione.
--
-- ROLLOUT
--
--   Le app già distribuite chiamano set_content_like(text, uuid, boolean) e
--   scrivono sulle tabelle legacy: dopo questa migrazione quelle chiamate
--   falliscono. È voluto (un solo dominio, nessun dual-write): il client nuovo
--   va distribuito insieme o subito dopo.
-- ============================================================


-- ============================================================
-- SEZIONE 1 — content_likes: il dominio Mi piace unico (§1, §10–§12, §68)
--
-- La chiave è (content_type, post_id, actor_type, actor_id): una sola riga per
-- identità e contenuto (§12). `actor_id` è profiles.id per person/media e
-- clubs.id per society. `acted_by` è chi ha toccato il pulsante: serve ad
-- audit e a future notifiche, non esce mai da una RPC, e diventa NULL (non
-- cancella il Like) se quel profilo viene eliminato, perché il Like di una
-- Società non è dell'amministratore che lo ha messo.
--
-- Nessuna policy e nessun grant ai client: si scrive e si legge SOLO dalle RPC
-- di questa migrazione (security definer). Così i filtri di visibilità (§63,
-- §173) e le autorizzazioni (§168) non si possono aggirare con una select.
-- ============================================================

create table if not exists public.content_likes (
  content_type text        not null
                           check (content_type in ('club_media', 'fan_media', 'profile_post', 'media_profile')),
  post_id      uuid        not null,
  actor_type   text        not null check (actor_type in ('person', 'society', 'media')),
  actor_id     uuid        not null,
  acted_by     uuid        references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (content_type, post_id, actor_type, actor_id)
);

create index if not exists content_likes_post_idx
  on public.content_likes (content_type, post_id, created_at desc, actor_type, actor_id);
create index if not exists content_likes_actor_idx
  on public.content_likes (actor_type, actor_id);

alter table public.content_likes enable row level security;
revoke all on table public.content_likes from anon, authenticated;

-- Backfill dalle quattro tabelle legacy. L'identità di ogni Like legacy è
-- quella che oggi potrebbe metterlo (footme_publishing_identities, la stessa
-- regola di set_content_like): la persona per i ruoli player/coach/staff/agent/
-- director/fan, il Media per un profilo media con la sua riga media_profiles, e
-- per un club_admin (che non ha identità persona) la sua Società più vecchia
-- fra quelle che possiede o in cui ha content_create e che oggi non è
-- sospesa/rifiutata/segnalata. Un Like legacy che non si mappa su nessuna
-- identità (ruolo admin, Media senza profilo, club_admin senza Società valida)
-- è SCARTATO: nessuna RPC lo potrebbe mai mostrare né togliere.
with legacy as (
  select 'club_media'::text as content_type, x.post_id, x.profile_id, x.created_at from public.club_media_likes x
  union all
  select 'fan_media',     x.post_id, x.profile_id, x.created_at from public.fan_media_likes x
  union all
  select 'profile_post',  x.post_id, x.profile_id, x.created_at from public.profile_post_likes x
  union all
  select 'media_profile', x.post_id, x.profile_id, x.created_at from public.media_profile_post_likes x
),
who as (
  select pr.profile_id, i.c_type, i.c_id
  from (select distinct l.profile_id from legacy l) pr
  cross join lateral (
    select fi.c_type, fi.c_id
    from public.footme_publishing_identities(pr.profile_id) fi
    left join public.clubs c on fi.c_type = 'society' and c.id = fi.c_id
    where fi.can_post
    order by (fi.c_type = 'society'), fi.c_rank, c.created_at, fi.c_id
    limit 1
  ) i
)
insert into public.content_likes (content_type, post_id, actor_type, actor_id, acted_by, created_at)
select l.content_type, l.post_id, w.c_type, w.c_id, l.profile_id, l.created_at
from legacy l
join who w on w.profile_id = l.profile_id
on conflict do nothing;

-- ============================================================
-- SEZIONE 2 — regole di accesso e visibilità (una volta sola)
-- ============================================================

-- Blocco simmetrico fra due profili.
create or replace function public.footme_profiles_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_a is not null and p_b is not null and exists (
    select 1 from public.user_blocks ub
    where (ub.blocker_profile_id = p_a and ub.blocked_profile_id = p_b)
       or (ub.blocker_profile_id = p_b and ub.blocked_profile_id = p_a)
  );
$$;

-- Blocco fra il viewer e chi pubblica: per un profilo è il profilo, per una
-- Società (publisher_type 'club') è il suo titolare. Stessa regola per Like,
-- Salvataggi e lista dei Mi piace; anche per `club_media` (§172).
create or replace function public.footme_publisher_blocked(p_viewer uuid, p_publisher_type text, p_publisher_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_viewer is null then false
    when p_publisher_type = 'profile' then public.footme_profiles_blocked(p_viewer, p_publisher_id)
    when p_publisher_type = 'club' then coalesce(
      (select public.footme_profiles_blocked(p_viewer, c.owner_profile_id)
         from public.clubs c where c.id = p_publisher_id), false)
    else false
  end;
$$;

-- La parte della leggibilità che NON dipende dal viewer: pubblicato, non
-- programmato, non eliminato (la vista del Feed contiene solo i pubblicati).
-- Interna: nessun grant ai client. La usano footme_content_readable (un
-- contenuto) e footme_saved_rows (molti, in un join) così la regola è una.
create or replace view public.footme_readable_content as
select fci.*
from public.feed_content_index fci
where fci.published_at <= timezone('utc', now());

revoke all on public.footme_readable_content from anon, authenticated;

-- Il contenuto è leggibile dal viewer ADESSO? footme_readable_content più il
-- blocco con il publisher (per una Società: il suo titolare). È la regola di
-- footme_feed_readable_items più il blocco con il titolare, che il Feed non applica.
create or replace function public.footme_content_readable(p_viewer uuid, p_content_type text, p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.footme_readable_content rc
    where rc.content_type = p_content_type
      and rc.post_id = p_post_id
      and not public.footme_publisher_blocked(p_viewer, rc.publisher_type, rc.publisher_id)
  );
$$;

-- Identità con cui l'utente può interagire (§10–§11) = identità con cui può
-- pubblicare (HOM-06.1): una regola sola, quella di footme_publishing_identities.
-- Il parametro serve ai chiamanti che non hanno una sessione propria (il
-- payload riceve p_viewer); senza parametro usa auth.uid().
create or replace function public.footme_interaction_identities(p_actor uuid default null)
returns table (c_type text, c_id uuid, c_rank integer)
language sql
stable
security definer
set search_path = public
as $$
  select i.c_type, i.c_id, i.c_rank
  from public.footme_publishing_identities(coalesce(p_actor, auth.uid())) i
  where i.can_post;
$$;

-- L'attore di un Like è visibile al viewer? Predicato unico, riga per riga: lo
-- usano footme_visible_likes (conteggio, lista) e le viste di compatibilità.
-- Attore eliminato, Società sospesa/rifiutata/segnalata, o bloccato con il
-- viewer in qualunque direzione (per una Società: il titolare) → no. Con
-- p_viewer null nessun blocco da applicare (footme_profiles_blocked(null, x)
-- è falso): è il caso di Insights, che è dell'autore e non di un viewer.
create or replace function public.footme_like_actor_visible(p_viewer uuid, p_actor_type text, p_actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
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
                and c.verification_status not in ('suspended', 'rejected', 'flagged')
                and not public.footme_profiles_blocked(p_viewer, c.owner_profile_id))
    else false
  end;
$$;

-- I Mi piace che il viewer vede, per un insieme di contenuti. È la definizione
-- unica di «chi ha messo Mi piace» (§68): conteggio nel payload, stato
-- dell'identità, lista e risposta della mutation leggono tutti da qui, quindi
-- count e lista non possono divergere (§174). Esclude attori eliminati, Società
-- sospese/rifiutate/segnalate, e chi è bloccato con il viewer in qualunque
-- direzione (per una Società: il titolare). Con p_viewer null non c'è blocco
-- da applicare (Insights dell'autore).
create or replace function public.footme_visible_likes(p_viewer uuid, p_content_types text[], p_post_ids uuid[])
returns table (v_content_type text, v_post_id uuid, v_actor_type text, v_actor_id uuid, v_created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with keys as (
    select distinct k.content_type, k.post_id
    from unnest(p_content_types, p_post_ids) as k(content_type, post_id)
  )
  select cl.content_type, cl.post_id, cl.actor_type, cl.actor_id, cl.created_at
  from keys k
  join public.content_likes cl
    on cl.content_type = k.content_type and cl.post_id = k.post_id
  where public.footme_like_actor_visible(p_viewer, cl.actor_type, cl.actor_id);
$$;

-- Pulizia dei Like quando sparisce ciò a cui appartengono. La chiave è
-- polimorfica, quindi non ci sono foreign key: la fanno questi trigger.
create or replace function public.content_likes_cleanup_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.content_likes cl
  where cl.content_type = tg_argv[0] and cl.post_id = old.id;
  return old;
end;
$$;

create or replace function public.content_likes_cleanup_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_argv[0] = 'society' then
    delete from public.content_likes cl where cl.actor_type = 'society' and cl.actor_id = old.id;
  else
    delete from public.content_likes cl
    where cl.actor_type in ('person', 'media') and cl.actor_id = old.id;
  end if;
  return old;
end;
$$;

drop trigger if exists content_likes_cleanup on public.club_media_posts;
create trigger content_likes_cleanup after delete on public.club_media_posts
  for each row execute function public.content_likes_cleanup_content('club_media');
drop trigger if exists content_likes_cleanup on public.fan_media_posts;
create trigger content_likes_cleanup after delete on public.fan_media_posts
  for each row execute function public.content_likes_cleanup_content('fan_media');
drop trigger if exists content_likes_cleanup on public.profile_posts;
create trigger content_likes_cleanup after delete on public.profile_posts
  for each row execute function public.content_likes_cleanup_content('profile_post');
drop trigger if exists content_likes_cleanup on public.media_profile_posts;
create trigger content_likes_cleanup after delete on public.media_profile_posts
  for each row execute function public.content_likes_cleanup_content('media_profile');
drop trigger if exists content_likes_cleanup on public.clubs;
create trigger content_likes_cleanup after delete on public.clubs
  for each row execute function public.content_likes_cleanup_actor('society');
drop trigger if exists content_likes_cleanup on public.profiles;
create trigger content_likes_cleanup after delete on public.profiles
  for each row execute function public.content_likes_cleanup_actor('profile');

-- ============================================================
-- SEZIONE 3 — le due tabelle dei Salvati mancanti e la pulizia (§78, §144–§145)
-- ============================================================

-- Il Post di una persona non aveva un Salvato (HOM-02 lo aveva rinviato a
-- HOM-07). Stessa forma di saved_media_profile_posts, ma NESSUNA scrittura
-- dal client: non ci sono app già distribuite che lo usino, quindi si scrive
-- solo con set_saved (che controlla l'accessibilità, §169–§172); il client può
-- leggere e cancellare i propri.
create table if not exists public.saved_profile_posts (
  post_id    uuid        not null references public.profile_posts(id) on delete cascade,
  profile_id uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, profile_id)
);
create index if not exists saved_profile_posts_profile_idx
  on public.saved_profile_posts (profile_id, created_at desc);

alter table public.saved_profile_posts enable row level security;
revoke all on table public.saved_profile_posts from anon, authenticated;
grant select, delete on table public.saved_profile_posts to authenticated;

drop policy if exists "users read own saved profile posts" on public.saved_profile_posts;
create policy "users read own saved profile posts"
on public.saved_profile_posts
for select
to authenticated
using (public.is_current_user(profile_id));

drop policy if exists "users delete own saved profile posts" on public.saved_profile_posts;
create policy "users delete own saved profile posts"
on public.saved_profile_posts
for delete
to authenticated
using (public.is_current_user(profile_id));

-- Quando un contenuto passa a `deleted` (HOM-04 non ha ripristino) i Salvati
-- che lo puntano non hanno più senso: si cancellano nel server, non solo si
-- nascondono (§145). Vale per tutti e sei i contenuti salvabili.
create or replace function public.saved_cleanup_on_content_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tbl text;
begin
  v_tbl := case tg_argv[0]
    when 'club_media'    then 'saved_club_media'
    when 'media_profile' then 'saved_media_profile_posts'
    when 'media_tribuna' then 'saved_media_tribuna'
    when 'fan_tribuna'   then 'saved_fan_tribuna'
    when 'fan_media'     then 'saved_fan_media'
    when 'profile_post'  then 'saved_profile_posts'
  end;
  if v_tbl is not null then
    execute format('delete from public.%I where post_id = $1', v_tbl) using new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists saved_cleanup_on_delete on public.club_media_posts;
create trigger saved_cleanup_on_delete after update of status on public.club_media_posts
  for each row when (new.status = 'deleted' and old.status is distinct from 'deleted')
  execute function public.saved_cleanup_on_content_delete('club_media');
drop trigger if exists saved_cleanup_on_delete on public.media_profile_posts;
create trigger saved_cleanup_on_delete after update of status on public.media_profile_posts
  for each row when (new.status = 'deleted' and old.status is distinct from 'deleted')
  execute function public.saved_cleanup_on_content_delete('media_profile');
drop trigger if exists saved_cleanup_on_delete on public.media_tribuna_posts;
create trigger saved_cleanup_on_delete after update of status on public.media_tribuna_posts
  for each row when (new.status = 'deleted' and old.status is distinct from 'deleted')
  execute function public.saved_cleanup_on_content_delete('media_tribuna');
drop trigger if exists saved_cleanup_on_delete on public.fan_tribuna_posts;
create trigger saved_cleanup_on_delete after update of status on public.fan_tribuna_posts
  for each row when (new.status = 'deleted' and old.status is distinct from 'deleted')
  execute function public.saved_cleanup_on_content_delete('fan_tribuna');
drop trigger if exists saved_cleanup_on_delete on public.fan_media_posts;
create trigger saved_cleanup_on_delete after update of status on public.fan_media_posts
  for each row when (new.status = 'deleted' and old.status is distinct from 'deleted')
  execute function public.saved_cleanup_on_content_delete('fan_media');
drop trigger if exists saved_cleanup_on_delete on public.profile_posts;
create trigger saved_cleanup_on_delete after update of status on public.profile_posts
  for each row when (new.status = 'deleted' and old.status is distinct from 'deleted')
  execute function public.saved_cleanup_on_content_delete('profile_post');

-- Una tantum: i Salvati già orfani di contenuti eliminati prima di oggi.
delete from public.saved_club_media x using public.club_media_posts p where p.id = x.post_id and p.status = 'deleted';
delete from public.saved_media_profile_posts x using public.media_profile_posts p where p.id = x.post_id and p.status = 'deleted';
delete from public.saved_media_tribuna x using public.media_tribuna_posts p where p.id = x.post_id and p.status = 'deleted';
delete from public.saved_fan_tribuna x using public.fan_tribuna_posts p where p.id = x.post_id and p.status = 'deleted';
delete from public.saved_fan_media x using public.fan_media_posts p where p.id = x.post_id and p.status = 'deleted';

-- ============================================================
-- SEZIONE 4 — lettori server: dalle tabelle legacy a content_likes
--
-- Ogni funzione sotto è ripresa dalla definizione EFFETTIVA nel database dopo
-- tutte le migrazioni (pg_get_functiondef), non da una migrazione vecchia, con
-- le sole modifiche dichiarate nel commento che la precede.
-- ============================================================

-- 4-1. footme_post_payloads
--   * likes_count: conta footme_visible_likes (§68, §174), non più le quattro
--     tabelle legacy.
--   * liked_as: [{type,id}] delle SOLE identità di interazione del viewer che
--     hanno messo Mi piace (§9–§10); is_liked resta = liked_as non vuoto.
--   * can_save: vero per tutti e sei i contenuti (il Post persona ora ha
--     saved_profile_posts); is_saved: letto dalle sei tabelle dei Salvati.
CREATE OR REPLACE FUNCTION public.footme_post_payloads(p_viewer uuid, p_content_types text[], p_post_ids uuid[])
 RETURNS TABLE(r_content_type text, r_post_id uuid, payload jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with blocked as (
    select ub.blocked_profile_id as profile_id
    from public.user_blocks ub
    where ub.blocker_profile_id = p_viewer
    union
    select ub.blocker_profile_id
    from public.user_blocks ub
    where ub.blocked_profile_id = p_viewer
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
      'is_liked',       jsonb_array_length(coalesce(la.liked_as, '[]'::jsonb)) > 0,
      'liked_as',       coalesce(la.liked_as, '[]'::jsonb),
      'is_saved',       sa.post_id is not null,
      'capabilities', jsonb_build_object(
        'can_like',          a.content_type in ('club_media', 'fan_media', 'profile_post', 'media_profile'),
        'can_comment',       a.content_type <> 'profile_post',
        'can_share',         true,
        'can_save',          true,
        'can_report',        not a.is_own,
        'can_edit',          coalesce(cr.r_can_edit, false),
        'can_delete',        coalesce(cr.r_can_delete, false),
        'can_view_insights', coalesce(cr.r_can_view_insights, false)
      ),
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
  left join tags_agg ta     on ta.content_type = a.content_type and ta.post_id = a.post_id
  left join public.content_post_extras ex
    on ex.content_type = a.content_type and ex.post_id = a.post_id;
$function$;


-- 4-2. fetch_content_interaction_state: aggiunge liked_as, can_save e is_saved
--      (il dettaglio /content/[type]/[id] non ha il payload del Feed e legge
--      lo stato da qui; cambia il tipo di ritorno, quindi drop + create).
--      Stesso corpo: legge il payload.
drop function if exists public.fetch_content_interaction_state(text, uuid);
create function public.fetch_content_interaction_state(p_content_type text, p_post_id uuid)
returns table (likes_count integer, comments_count integer, is_liked boolean, can_like boolean, liked_as jsonb, can_save boolean, is_saved boolean)
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
    coalesce((pl.payload ->> 'likes_count')::integer, 0),
    coalesce((pl.payload ->> 'comments_count')::integer, 0),
    coalesce((pl.payload ->> 'is_liked')::boolean, false),
    coalesce((pl.payload -> 'capabilities' ->> 'can_like')::boolean, false),
    coalesce(pl.payload -> 'liked_as', '[]'::jsonb),
    coalesce((pl.payload -> 'capabilities' ->> 'can_save')::boolean, false),
    coalesce((pl.payload ->> 'is_saved')::boolean, false)
  from public.footme_post_payloads(
    v_uid, array[p_content_type], array[p_post_id]
  ) pl;
end;
$$;

revoke all on function public.fetch_content_interaction_state(text, uuid) from public;
revoke execute on function public.fetch_content_interaction_state(text, uuid) from anon;
grant execute on function public.fetch_content_interaction_state(text, uuid) to authenticated;

-- 4-3. footme_content_interaction_rows (sorgente di Insights HOM-05, §75, §138,
--      §140): i Mi piace da footme_visible_likes (senza blocchi: Insights è
--      dell'autore, non di un viewer), i Salvataggi anche da saved_profile_posts.
--      Solo aggregati: nessuna identità esce da qui.
create or replace function public.footme_content_interaction_rows(p_content_type text, p_post_id uuid)
returns table (i_kind text, i_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select 'like'::text, v.v_created_at
    from public.footme_visible_likes(null, array[p_content_type], array[p_post_id]) v
  union all
  select 'comment', x.created_at from public.club_media_comments x
    where p_content_type = 'club_media' and x.post_id = p_post_id
  union all
  select 'comment', x.created_at from public.media_profile_post_comments x
    where p_content_type = 'media_profile' and x.post_id = p_post_id
  union all
  select 'comment', x.created_at from public.media_tribuna_comments x
    where p_content_type = 'media_tribuna' and x.post_id = p_post_id
  union all
  select 'comment', x.created_at from public.fan_tribuna_comments x
    where p_content_type = 'fan_tribuna' and x.post_id = p_post_id
  union all
  select 'comment', x.created_at from public.fan_media_comments x
    where p_content_type = 'fan_media' and x.post_id = p_post_id
  union all
  select 'save', x.created_at from public.saved_club_media x
    where p_content_type = 'club_media' and x.post_id = p_post_id
  union all
  select 'save', x.created_at from public.saved_media_profile_posts x
    where p_content_type = 'media_profile' and x.post_id = p_post_id
  union all
  select 'save', x.created_at from public.saved_media_tribuna x
    where p_content_type = 'media_tribuna' and x.post_id = p_post_id
  union all
  select 'save', x.created_at from public.saved_fan_tribuna x
    where p_content_type = 'fan_tribuna' and x.post_id = p_post_id
  union all
  select 'save', x.created_at from public.saved_fan_media x
    where p_content_type = 'fan_media' and x.post_id = p_post_id
  union all
  select 'save', x.created_at from public.saved_profile_posts x
    where p_content_type = 'profile_post' and x.post_id = p_post_id;
$$;

-- 4-4. media_content_engagement (CER-05, alimenta il ranking del Feed e
--      media_content_index): stessa forma e stessa semantica — i Mi piace dei
--      soli club_media e fan_media più i commenti e i voti — ma i Mi piace
--      arrivano da content_likes. Deve precedere il drop delle tabelle legacy.
create or replace view public.media_content_engagement as
select e.content_type, e.post_id, sum(e.n)::integer as engagement_count
from (
  select 'club_media'::text as content_type, cl.post_id, count(*) as n
    from public.content_likes cl where cl.content_type = 'club_media' group by cl.post_id
  union all
  select 'club_media', c.post_id, count(*) from public.club_media_comments c group by c.post_id
  union all
  select 'media_profile', c.post_id, count(*) from public.media_profile_post_comments c group by c.post_id
  union all
  select 'fan_tribuna', c.post_id, count(*) from public.fan_tribuna_comments c group by c.post_id
  union all
  select 'fan_tribuna', v.post_id, count(*) from public.fan_tribuna_poll_votes v group by v.post_id
  union all
  select 'fan_tribuna', v.post_id, count(*) from public.fan_tribuna_support_votes v group by v.post_id
  union all
  select 'media_tribuna', c.post_id, count(*) from public.media_tribuna_comments c group by c.post_id
  union all
  select 'media_tribuna', v.post_id, count(*) from public.media_tribuna_option_votes v group by v.post_id
  union all
  select 'fan_media', cl.post_id, count(*) from public.content_likes cl where cl.content_type = 'fan_media' group by cl.post_id
  union all
  select 'fan_media', c.post_id, count(*) from public.fan_media_comments c group by c.post_id
) e
group by e.content_type, e.post_id;

-- 4-5. fetch_home_feed_page: il Salvato del Post persona entra in is_saved.
--      Nient'altro cambia (verificato per differenza con la definizione di partenza).
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
    union all
    select 'profile_post', s.post_id
      from public.saved_profile_posts s        where s.profile_id = v_uid
  ),
  saved_positions as (
    select sa.ad_id from public.saved_ads sa where sa.profile_id = v_uid
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
      -- HOM-02/HOM-03: Post, Articoli e video editoriali portano le chiavi del
      -- Post social standard; le posizioni e i moduli discovery no.
      || case
           when fr.item_type in ('post', 'article', 'video')
             then coalesce(ppl.payload, '{}'::jsonb)
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
    on fr.item_type in ('post', 'article', 'video')
   and ppl.r_content_type = fr.content_type
   and ppl.r_post_id = fr.post_id
  order by fr.sort_key;
end;
$function$;


-- ============================================================
-- SEZIONE 5 — mutation Mi piace (§13–§19, §165, §168–§172)
-- ============================================================

drop function if exists public.set_content_like(text, uuid, boolean);

-- Imposta (non alterna) il Mi piace di una identità di interazione su un
-- contenuto. Idempotente (§18): mettere due volte lo stesso Like o toglierne
-- uno assente non è un errore. Rifiuta, con un codice leggibile:
--   like_content_type_unsupported (22023)  tipo senza Mi piace
--   like_identity_forbidden       (42501)  l'identità non è una di quelle con cui
--                                          l'utente può interagire (§168)
--   content_unavailable           (P0002)  per METTERE il Like: contenuto non
--                                          leggibile ORA (non pubblicato,
--                                          eliminato, programmato, bloccato;
--                                          §170, §172)
-- Togliere il Like è sempre permesso all'identità autorizzata, anche se il
-- contenuto non è più leggibile (pulizia, come togliere un Salvato): in quel
-- caso il conteggio restituito è 0.
create function public.set_content_like(
  p_content_type  text,
  p_post_id       uuid,
  p_liked         boolean,
  p_identity_type text,
  p_identity_id   uuid
)
returns table (likes_count bigint, is_liked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_count bigint;
  v_liked boolean;
  v_readable boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_liked is null then
    raise exception 'Stato del Mi piace mancante' using errcode = '22023';
  end if;

  if p_content_type is null
     or p_content_type not in ('club_media', 'fan_media', 'profile_post', 'media_profile') then
    raise exception 'like_content_type_unsupported' using errcode = '22023';
  end if;

  if p_identity_type is null or p_identity_id is null or not exists (
    select 1 from public.footme_interaction_identities(v_uid) i
    where i.c_type = p_identity_type and i.c_id = p_identity_id
  ) then
    raise exception 'like_identity_forbidden' using errcode = '42501';
  end if;

  v_readable := public.footme_content_readable(v_uid, p_content_type, p_post_id);

  if p_liked and not v_readable then
    raise exception 'content_unavailable' using errcode = 'P0002';
  end if;

  if p_liked then
    insert into public.content_likes as cl (content_type, post_id, actor_type, actor_id, acted_by)
    values (p_content_type, p_post_id, p_identity_type, p_identity_id, v_uid)
    on conflict do nothing;
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
$$;

revoke all on function public.set_content_like(text, uuid, boolean, text, uuid) from public;
revoke execute on function public.set_content_like(text, uuid, boolean, text, uuid) from anon;
grant execute on function public.set_content_like(text, uuid, boolean, text, uuid) to authenticated;

-- Le identità con cui l'utente corrente può mettere Mi piace (§10–§11). Non
-- c'è un selettore (§11): il client ne deriva una dall'ultima identità usata
-- in Dashboard o dall'identità personale.
create or replace function public.fetch_interaction_identities()
returns table (identity_type text, identity_id uuid, name text, avatar_url text, is_verified boolean, rank integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  return query
  select
    c.card ->> 'identity_type',
    (c.card ->> 'identity_id')::uuid,
    c.card ->> 'name',
    c.card ->> 'avatar_url',
    coalesce((c.card ->> 'is_verified')::boolean, false),
    i.c_rank
  from public.footme_interaction_identities(v_uid) i
  cross join lateral (
    select public.footme_composer_identity_card(i.c_type, i.c_id) as card
  ) c
  where c.card is not null
  order by i.c_rank, i.c_id;
end;
$$;

revoke all on function public.fetch_interaction_identities() from public;
revoke execute on function public.fetch_interaction_identities() from anon;
grant execute on function public.fetch_interaction_identities() to authenticated;

-- ============================================================
-- SEZIONE 6 — lista Mi piace (§45–§69, §173–§174)
--
-- Ranking (§58–§59): prima chi il viewer segue, poi gli altri; dentro ogni
-- gruppo dal Like più recente, poi (actor_type, actor_id) per un ordine totale.
-- Cursore keyset {"b","ts","t","id"}: nessun duplicato fra pagine. La riga
-- porta i campi grezzi del Feed (author_meta) perché il client riusa i
-- presentatori esistenti (formatRole → «Procuratore»).
-- ============================================================

create or replace function public.list_content_likers(
  p_content_type text,
  p_post_id      uuid,
  p_cursor       jsonb   default null,
  p_limit        integer default 30
)
returns table (
  actor_type       text,
  actor_id         uuid,
  name             text,
  avatar_url       text,
  is_verified      boolean,
  role             text,
  club_name        text,
  team_label       text,
  club_category    text,
  media_kind       text,
  primary_position text,
  is_self          boolean,
  is_following     boolean,
  next_cursor      jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
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
     or p_content_type not in ('club_media', 'fan_media', 'profile_post', 'media_profile') then
    raise exception 'like_content_type_unsupported' using errcode = '22023';
  end if;

  if not public.footme_content_readable(v_uid, p_content_type, p_post_id) then
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
$$;

revoke all on function public.list_content_likers(text, uuid, jsonb, integer) from public;
revoke execute on function public.list_content_likers(text, uuid, jsonb, integer) from anon;
grant execute on function public.list_content_likers(text, uuid, jsonb, integer) to authenticated;

-- ============================================================
-- SEZIONE 7 — Salvataggi: scrittura unica (§70–§84, §94–§100, §166–§172)
--
-- Una RPC per tutti i target. Scrive nelle tabelle che già esistono (§84: non
-- serve una tabella unica) con owner = auth.uid(), mai di una Società o di un
-- Media (§71–§72). Nessuna notifica, nessun content_event (§76, §192).
-- Le tabelle saved_* restano scrivibili dal client perché le app già
-- distribuite le usano direttamente, ma la loro RLS di INSERT/UPDATE ora
-- chiede la stessa footme_saved_target_accessible (sezione 7b): nessuna
-- scrittura diretta può salvare ciò che set_saved rifiuta. Le cancellazioni
-- restano sempre permesse.
-- ============================================================

-- L'unica regola di «il target è accessibile ORA a chi sta salvando» (§169–
-- §172), per tutti i target. La usano set_saved e le policy di INSERT/UPDATE
-- delle tabelle saved_* (così la scrittura diretta delle app già distribuite
-- non può salvare ciò che set_saved rifiuterebbe). Usa auth.uid() e non un
-- parametro: dev'essere eseguibile dal client perché lo chiamano le policy, e
-- così non rivela nulla sui blocchi o sulla visibilità di altri utenti.
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
      and public.footme_content_readable(auth.uid(), p_content_type, p_target_id)
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

-- Imposta (non alterna) il Salvato di un target. Il Save richiede
-- footme_saved_target_accessible; togliere il Salvato è sempre permesso (pulizia).
--   saved_invalid_target     (22023)  target_type / content_type non validi, o
--                                     un profilo che salva se stesso
--   saved_target_unavailable (P0002)  il target non è accessibile ora
create function public.set_saved(
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

-- ============================================================
-- SEZIONE 8 — Salvataggi: lettura per categoria (§102–§164)
-- ============================================================

-- La regola unica di «cosa compare nei Salvati di p_uid»: righe presenti nelle
-- tabelle saved_* E ancora accessibili ora (§144–§151). list_saved e
-- fetch_saved_counts leggono da qui: conteggi e liste non possono divergere.
-- p_category null = tutte. target_type: content | profile | society | team |
-- position; le squadre vivono nella categoria society (decisione di Luigi).
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

-- Una pagina di una categoria dei Salvati, dal più recente salvataggio (§120–
-- §121). Keyset {"ts","k"}: nessun duplicato fra pagine (§161). Colonne comuni
-- più `payload` jsonb per riga; next_cursor è sull'ultima riga della pagina,
-- null se la categoria è finita.
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
      when 'content' then (
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
        where fci.content_type = s.s_content_type and fci.post_id = s.s_target_id)
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

-- fetch_saved_counts: stessa forma di prima (clubs_count conta società e
-- squadre, contents_count ora anche i Post persona), ma i numeri vengono da
-- footme_saved_rows, cioè dalla stessa regola delle liste.
create or replace function public.fetch_saved_counts()
returns table (profiles_count bigint, clubs_count bigint, positions_count bigint, contents_count bigint)
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
    count(*) filter (where r.s_category = 'profile')::bigint,
    count(*) filter (where r.s_category = 'society')::bigint,
    count(*) filter (where r.s_category = 'position')::bigint,
    count(*) filter (where r.s_category = 'content')::bigint
  from public.footme_saved_rows(v_uid, null) r;
end;
$$;

-- ============================================================
-- SEZIONE 7b — le scritture dirette sulle tabelle saved_* chiedono la stessa
-- accessibilità di set_saved (§169–§172)
--
-- Le app già distribuite scrivono su queste tabelle senza passare dalla RPC.
-- Le policy `for all` esistenti controllavano solo il proprietario (e, per i
-- contenuti, che il post fosse pubblicato). Si spezzano in select / insert /
-- update / delete: INSERT e UPDATE aggiungono footme_saved_target_accessible
-- (blocchi, club sospesi, posizioni in bozza, squadre archiviate…), SELECT e
-- DELETE restano solo del proprietario, quindi togliere un Salvato è sempre
-- possibile. I guard trigger esistenti (content_interaction_guard) restano.
-- ============================================================

-- club_media
drop policy if exists "users manage own saved club media" on public.saved_club_media;
create policy "users insert own saved club media" on public.saved_club_media for insert to authenticated
  with check (public.is_current_user(profile_id) and public.footme_saved_target_accessible('content', post_id, 'club_media'));
create policy "users update own saved club media" on public.saved_club_media for update to authenticated
  using (public.is_current_user(profile_id))
  with check (public.is_current_user(profile_id) and public.footme_saved_target_accessible('content', post_id, 'club_media'));
create policy "users delete own saved club media" on public.saved_club_media for delete to authenticated
  using (public.is_current_user(profile_id));

-- media_profile
drop policy if exists "users manage own saved media profile posts" on public.saved_media_profile_posts;
create policy "users insert own saved media profile posts" on public.saved_media_profile_posts for insert to authenticated
  with check (public.is_current_user(profile_id) and public.footme_saved_target_accessible('content', post_id, 'media_profile'));
create policy "users update own saved media profile posts" on public.saved_media_profile_posts for update to authenticated
  using (public.is_current_user(profile_id))
  with check (public.is_current_user(profile_id) and public.footme_saved_target_accessible('content', post_id, 'media_profile'));
create policy "users delete own saved media profile posts" on public.saved_media_profile_posts for delete to authenticated
  using (public.is_current_user(profile_id));

-- media_tribuna
drop policy if exists "users manage own saved media tribuna" on public.saved_media_tribuna;
create policy "users insert own saved media tribuna" on public.saved_media_tribuna for insert to authenticated
  with check (public.is_current_user(profile_id) and public.footme_saved_target_accessible('content', post_id, 'media_tribuna'));
create policy "users update own saved media tribuna" on public.saved_media_tribuna for update to authenticated
  using (public.is_current_user(profile_id))
  with check (public.is_current_user(profile_id) and public.footme_saved_target_accessible('content', post_id, 'media_tribuna'));
create policy "users delete own saved media tribuna" on public.saved_media_tribuna for delete to authenticated
  using (public.is_current_user(profile_id));

-- fan_tribuna
drop policy if exists "users manage own saved fan tribuna" on public.saved_fan_tribuna;
create policy "users insert own saved fan tribuna" on public.saved_fan_tribuna for insert to authenticated
  with check (public.is_current_user(profile_id) and public.footme_saved_target_accessible('content', post_id, 'fan_tribuna'));
create policy "users update own saved fan tribuna" on public.saved_fan_tribuna for update to authenticated
  using (public.is_current_user(profile_id))
  with check (public.is_current_user(profile_id) and public.footme_saved_target_accessible('content', post_id, 'fan_tribuna'));
create policy "users delete own saved fan tribuna" on public.saved_fan_tribuna for delete to authenticated
  using (public.is_current_user(profile_id));

-- fan_media
drop policy if exists "users manage own saved fan media" on public.saved_fan_media;
create policy "users insert own saved fan media" on public.saved_fan_media for insert to authenticated
  with check (public.is_current_user(profile_id) and public.footme_saved_target_accessible('content', post_id, 'fan_media'));
create policy "users update own saved fan media" on public.saved_fan_media for update to authenticated
  using (public.is_current_user(profile_id))
  with check (public.is_current_user(profile_id) and public.footme_saved_target_accessible('content', post_id, 'fan_media'));
create policy "users delete own saved fan media" on public.saved_fan_media for delete to authenticated
  using (public.is_current_user(profile_id));

-- profili, società, squadre, posizioni: la policy `for all` copriva anche la
-- lettura, che qui diventa una policy select propria.
drop policy if exists "users manage own saved profiles" on public.saved_profiles;
create policy "users read own saved profiles" on public.saved_profiles for select to authenticated
  using (public.is_current_user(owner_profile_id));
create policy "users insert own saved profiles" on public.saved_profiles for insert to authenticated
  with check (public.is_current_user(owner_profile_id) and public.footme_saved_target_accessible('profile', target_profile_id));
create policy "users update own saved profiles" on public.saved_profiles for update to authenticated
  using (public.is_current_user(owner_profile_id))
  with check (public.is_current_user(owner_profile_id) and public.footme_saved_target_accessible('profile', target_profile_id));
create policy "users delete own saved profiles" on public.saved_profiles for delete to authenticated
  using (public.is_current_user(owner_profile_id));

drop policy if exists "users manage own saved clubs" on public.saved_clubs;
create policy "users read own saved clubs" on public.saved_clubs for select to authenticated
  using (public.is_current_user(owner_profile_id));
create policy "users insert own saved clubs" on public.saved_clubs for insert to authenticated
  with check (public.is_current_user(owner_profile_id) and public.footme_saved_target_accessible('society', club_id));
create policy "users update own saved clubs" on public.saved_clubs for update to authenticated
  using (public.is_current_user(owner_profile_id))
  with check (public.is_current_user(owner_profile_id) and public.footme_saved_target_accessible('society', club_id));
create policy "users delete own saved clubs" on public.saved_clubs for delete to authenticated
  using (public.is_current_user(owner_profile_id));

drop policy if exists "users manage own saved teams" on public.saved_teams;
create policy "users read own saved teams" on public.saved_teams for select to authenticated
  using (public.is_current_user(owner_profile_id));
create policy "users insert own saved teams" on public.saved_teams for insert to authenticated
  with check (public.is_current_user(owner_profile_id) and public.footme_saved_target_accessible('team', team_id));
create policy "users update own saved teams" on public.saved_teams for update to authenticated
  using (public.is_current_user(owner_profile_id))
  with check (public.is_current_user(owner_profile_id) and public.footme_saved_target_accessible('team', team_id));
create policy "users delete own saved teams" on public.saved_teams for delete to authenticated
  using (public.is_current_user(owner_profile_id));

drop policy if exists "users manage own saved ads" on public.saved_ads;
create policy "users read own saved ads" on public.saved_ads for select to authenticated
  using (public.is_current_user(profile_id));
create policy "users insert own saved ads" on public.saved_ads for insert to authenticated
  with check (public.is_current_user(profile_id) and public.footme_saved_target_accessible('position', ad_id));
create policy "users update own saved ads" on public.saved_ads for update to authenticated
  using (public.is_current_user(profile_id))
  with check (public.is_current_user(profile_id) and public.footme_saved_target_accessible('position', ad_id));
create policy "users delete own saved ads" on public.saved_ads for delete to authenticated
  using (public.is_current_user(profile_id));

-- ============================================================
-- SEZIONE 9 — le tabelle Mi piace legacy escono di scena
--
-- Nessun lettore server le usa più (sezione 4). Le quattro tabelle vengono
-- eliminate. Due ex tabelle restano come VISTE di sola lettura, per i lettori
-- client legacy (club-media-service, fan-media-service) finché il client non
-- è passato al conteggio del payload: club_media_likes e fan_media_likes, con
-- le sole righe person/media (profile_id = actor_id). Non sono security_invoker
-- (content_likes non ha policy per i client), ma applicano gli STESSI filtri di
-- list_content_likers per il viewer auth.uid(): contenuto leggibile ora e
-- attore visibile (eliminati, sospesi, bloccati esclusi). Il conteggio di
-- queste viste NON conta le Società: la fonte autorevole è il payload.
-- profile_post_likes e media_profile_post_likes non avevano lettori client.
-- ============================================================

drop table public.club_media_likes;
drop table public.fan_media_likes;
drop table public.profile_post_likes;
drop table public.media_profile_post_likes;

-- Il permesso EXECUTE delle funzioni usate in una vista si controlla su chi
-- interroga, non sul proprietario della vista. footme_content_readable e
-- footme_like_actor_visible prendono un viewer qualsiasi e non devono essere
-- eseguibili dai client (rivelerebbero i blocchi di altri): la vista passa da
-- questo involucro, che usa SOLO auth.uid().
create or replace function public.footme_like_row_visible(p_content_type text, p_post_id uuid, p_actor_type text, p_actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.footme_content_readable(auth.uid(), p_content_type, p_post_id)
    and public.footme_like_actor_visible(auth.uid(), p_actor_type, p_actor_id);
$$;

revoke all on function public.footme_like_row_visible(text, uuid, text, uuid) from public;
revoke execute on function public.footme_like_row_visible(text, uuid, text, uuid) from anon;
grant execute on function public.footme_like_row_visible(text, uuid, text, uuid) to authenticated;

create view public.club_media_likes as
select cl.post_id, cl.actor_id as profile_id, cl.created_at
from public.content_likes cl
where cl.content_type = 'club_media'
  and cl.actor_type in ('person', 'media')
  and public.footme_like_row_visible(cl.content_type, cl.post_id, cl.actor_type, cl.actor_id);

create view public.fan_media_likes as
select cl.post_id, cl.actor_id as profile_id, cl.created_at
from public.content_likes cl
where cl.content_type = 'fan_media'
  and cl.actor_type in ('person', 'media')
  and public.footme_like_row_visible(cl.content_type, cl.post_id, cl.actor_type, cl.actor_id);

revoke all on public.club_media_likes from anon, authenticated;
revoke all on public.fan_media_likes from anon, authenticated;
grant select on public.club_media_likes to authenticated;
grant select on public.fan_media_likes to authenticated;

-- ============================================================
-- SEZIONE 10 — privilegi delle funzioni interne
-- Nessuna è chiamabile dal client: le RPC pubbliche sono security definer e le
-- invocano con i propri diritti. `revoke from public` non chiude anon (default
-- privileges di Supabase): serve la revoca esplicita.
-- ============================================================

revoke all on function public.footme_profiles_blocked(uuid, uuid) from public;
revoke execute on function public.footme_profiles_blocked(uuid, uuid) from anon, authenticated;
revoke all on function public.footme_publisher_blocked(uuid, text, uuid) from public;
revoke execute on function public.footme_publisher_blocked(uuid, text, uuid) from anon, authenticated;
revoke all on function public.footme_content_readable(uuid, text, uuid) from public;
revoke execute on function public.footme_content_readable(uuid, text, uuid) from anon, authenticated;
revoke all on function public.footme_interaction_identities(uuid) from public;
revoke execute on function public.footme_interaction_identities(uuid) from anon, authenticated;
revoke all on function public.footme_like_actor_visible(uuid, text, uuid) from public;
revoke execute on function public.footme_like_actor_visible(uuid, text, uuid) from anon, authenticated;
revoke all on function public.footme_visible_likes(uuid, text[], uuid[]) from public;
revoke execute on function public.footme_visible_likes(uuid, text[], uuid[]) from anon, authenticated;
revoke all on function public.footme_saved_rows(uuid, text) from public;
revoke execute on function public.footme_saved_rows(uuid, text) from anon, authenticated;
revoke all on function public.content_likes_cleanup_content() from public;
revoke execute on function public.content_likes_cleanup_content() from anon, authenticated;
revoke all on function public.content_likes_cleanup_actor() from public;
revoke execute on function public.content_likes_cleanup_actor() from anon, authenticated;
revoke all on function public.saved_cleanup_on_content_delete() from public;
revoke execute on function public.saved_cleanup_on_content_delete() from anon, authenticated;

-- Questa invece DEVE restare eseguibile dai client: la chiamano le policy di
-- INSERT/UPDATE delle tabelle saved_* con i diritti di chi scrive.
revoke all on function public.footme_saved_target_accessible(text, uuid, text) from public;
revoke execute on function public.footme_saved_target_accessible(text, uuid, text) from anon;
grant execute on function public.footme_saved_target_accessible(text, uuid, text) to authenticated;

revoke all on function public.fetch_saved_counts() from public;
revoke execute on function public.fetch_saved_counts() from anon;
grant execute on function public.fetch_saved_counts() to authenticated;
