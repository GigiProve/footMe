-- Migration: REV-PROF-17 — Master Profile Società.
--
-- Il profilo Società esiste già (clubs + club_teams + club_affiliations +
-- club_members). Questa migrazione non lo sostituisce: gli aggiunge le cose
-- che il Master Profile richiede e che oggi mancano nel dato.
--
-- 1. Identità visiva e stato delle sottoentità
--    `clubs` non ha una cover (ce l'hanno i `profiles` dalla 20260722090000),
--    e `club_teams` non sa dire se una squadra è pubblica, archiviata o a
--    quale stagione appartenga. Senza queste colonne il conteggio "8 squadre"
--    non è calcolabile correttamente e la visibilità resterebbe una scelta
--    del client. Ogni colonna nasce con un default che riproduce il
--    comportamento attuale: nessuna squadra esistente sparisce.
--
-- 2. Affiliazioni confermate
--    `club_affiliations` è oggi una coppia (club, affiliata) scritta
--    unilateralmente dalla società madre: non distingue un invito in attesa
--    da una relazione confermata, né una relazione privata da una pubblica.
--    La tab Profilo deve mostrare solo relazioni confermate, attive e
--    pubbliche, quindi lo stato va nel dato e non nella query del client.
--
-- 3. Owner mode dal permesso, non dal ruolo
--    Oggi il client decide `isOwner` dal fatto che l'utente stia guardando il
--    proprio tab Profilo. REV-PROF-17 lo vieta esplicitamente. Arriva quindi
--    il gruppo di permessi `society_*` e l'helper `can_manage_society()`, che
--    il backend usa per autorizzare e il client legge dalla RPC.
--
-- Le letture passano da due RPC che restituiscono jsonb: una per il club, una
-- per la singola squadra. jsonb e non `returns table` per due motivi — la
-- pagina ha bisogno di sezioni eterogenee in un giro solo (niente N+1 su
-- squadre, affiliate, posizioni e organico) e il progetto ha già pagato il
-- prezzo delle colonne OUT ambigue in una `returns table`.
--
-- Entrambe le RPC sono SECURITY INVOKER, non DEFINER: la policy SELECT di
-- `clubs` è scoped `TO authenticated`, quindi una definer eseguita dal
-- proprio owner leggerebbe zero club. È esattamente il bug diagnosticato in
-- 20260724120000_search_clubs_security_invoker.sql, e non va ricommesso.
--
-- Convenzioni riprese da:
--   20260324000000_club_teams.sql               (tabelle e RLS del club)
--   20260717090000_club_member_permissions.sql  (gruppo permessi + CHECK)
--   20260724120000_search_clubs_security_invoker.sql (invoker sulle letture)


-- ============================================================
-- SEZIONE 1 — Identità del club e stato delle squadre
-- ============================================================

alter table public.clubs
  -- Cover editoriale dell'header. Nessun `cover_position`: il crop lo decide
  -- il componente, come per i profili persona.
  add column if not exists cover_url text;

alter table public.club_teams
  -- Stagione di riferimento ("2026/27"). L'organico la usa per non mescolare
  -- persone di stagioni diverse.
  add column if not exists season text,
  -- Archiviata: resta nel database e nell'area gestionale, sparisce dal
  -- profilo pubblico e dal conteggio.
  add column if not exists is_archived boolean not null default false,
  -- Visibilità pubblica. Default true: nessuna squadra esistente sparisce.
  add column if not exists is_public boolean not null default true,
  add column if not exists cover_url text,
  -- Campo/impianto specifico. Assente: si eredita dalla Società madre.
  add column if not exists venue_name text;

create index if not exists club_teams_public_idx
  on public.club_teams (club_id, is_public, is_archived, sort_order);


-- ============================================================
-- SEZIONE 2 — Affiliazioni: stato e visibilità
-- ============================================================

alter table public.club_affiliations
  -- Le righe già presenti sono state create dall'owner nella sua area
  -- gestionale: erano confermate di fatto, quindi il default le conferma e
  -- nessuna affiliata sparisce dai profili pubblicati oggi.
  add column if not exists status text not null default 'confirmed',
  add column if not exists is_public boolean not null default true;

alter table public.club_affiliations
  drop constraint if exists club_affiliations_status_check;

alter table public.club_affiliations
  add constraint club_affiliations_status_check
  check (status in ('pending', 'confirmed', 'rejected', 'ended'));

create index if not exists club_affiliations_public_idx
  on public.club_affiliations (club_id, status, is_public, sort_order);


-- ============================================================
-- SEZIONE 3 — Permessi di gestione della Società
-- ============================================================
-- Estensione del CHECK secondo la convenzione della 20260717090000: drop e
-- re-add con l'elenco allargato, senza toccare la migrazione originale.

alter table public.club_member_permissions
  drop constraint if exists club_member_permissions_key_check;

alter table public.club_member_permissions
  add constraint club_member_permissions_key_check
  check (permission_key in (
    'shortlist_view',
    'shortlist_create_lists',
    'shortlist_add_profiles',
    'shortlist_add_notes',
    'shortlist_edit_status',
    'shortlist_remove_profiles',
    'notif_new_applications',
    'notif_shortlist_updates',
    'notif_connection_requests',
    'notif_store_orders',
    'notif_content_tags',
    'notif_affiliations',
    'notif_profile_verifications',
    'society_manage_profile',
    'society_manage_positions',
    'society_publish_media'
  ));


-- `has_club_permission` (20260717090000) risolve già "owner implicito oppure
-- delega esplicita a un membro attivo": non serve una seconda regola, serve
-- un nome leggibile nelle policy. L'unica differenza è SECURITY INVOKER —
-- l'helper originale è DEFINER, e `owns_club` legge `clubs`, la cui policy è
-- `TO authenticated`: eseguita dall'owner della funzione tornerebbe false
-- proprio per chi possiede il club.
create or replace function public.can_manage_society(target_club_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    target_club_id is not null
    and (
      public.owns_club(target_club_id)
      or exists (
        select 1
        from public.club_member_permissions perm
        join public.club_members cm
          on cm.club_id = perm.club_id
         and cm.profile_id = perm.profile_id
        where perm.club_id = target_club_id
          and perm.profile_id = auth.uid()
          and perm.permission_key = 'society_manage_profile'
          and cm.status = 'active'
      )
    );
$$;

revoke all on function public.can_manage_society(uuid) from public;
grant execute on function public.can_manage_society(uuid) to authenticated, anon;


-- ============================================================
-- SEZIONE 4 — RLS: la visibilità la applica il database
-- ============================================================
-- "Anyone can read teams" (20260324000000) esponeva ogni riga. Una squadra
-- archiviata o non pubblica adesso la vede solo chi può gestirla: nasconderla
-- lato client l'avrebbe lasciata raggiungibile cambiando una query.
--
-- Il visitatore non autenticato continua a leggere esattamente ciò che
-- leggeva prima, perché ogni riga esistente nasce `is_public = true` e
-- `is_archived = false`.

drop policy if exists "Anyone can read teams" on public.club_teams;

create policy "Public reads published teams"
  on public.club_teams for select
  using (
    (is_public and not is_archived)
    or public.can_manage_society(club_id)
  );

drop policy if exists "club affiliations are readable by authenticated users"
  on public.club_affiliations;

create policy "Public reads confirmed affiliations"
  on public.club_affiliations for select to authenticated
  using (
    (status = 'confirmed' and is_public)
    or public.can_manage_society(club_id)
    or public.can_manage_society(affiliate_club_id)
  );


-- ============================================================
-- SEZIONE 5 — RPC: il Master Profile Società in una chiamata
-- ============================================================
-- Una sola superficie riceve club, viewer, permessi, squadre, affiliate e
-- posizioni pubbliche. Il payload contiene solo dati pubblici: i recapiti
-- personali dell'amministratore vivono in `profile_private_contacts` e non
-- sono raggiungibili da qui, quindi non c'è niente che il client debba
-- nascondere dopo averlo ricevuto.

create or replace function public.fetch_society_master_profile(
  p_club_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
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

  v_can_manage := public.can_manage_society(p_club_id);

  -- Squadre interne pubbliche e attive, nell'ordine configurato dalla
  -- Società. `sort_order` è il dato di prodotto; la prima squadra precede
  -- sempre il settore giovanile, e il nome è solo l'ultimo criterio perché
  -- l'alfabeto non conosce la gerarchia sportiva.
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

  -- Società affiliate: solo relazioni confermate, attive e pubbliche, una
  -- riga per società anche se il dato storico ne contenesse due. Il tap apre
  -- un Master Profile Società, mai un profilo squadra.
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

  -- Posizioni pubbliche: pubblicate, non scadute, non chiuse. Bozze e
  -- archiviate non entrano nel payload nemmeno per l'owner — la sua lista è
  -- la stessa del visitor, come chiede la task. La scadenza segue la regola
  -- già usata da fetch_home_suggested_clubs.
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

  -- La categoria dell'header è quella della prima squadra attiva, non un
  -- valore scritto a mano sul club.
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
      'website_url',          v_club.website_url,
      -- Recapiti dichiarati pubblici dall'onboarding Società. I recapiti
      -- personali dell'amministratore non passano di qui.
      'club_email',           v_club.club_email,
      'club_phone',           v_club.club_phone,
      'instagram',            v_club.instagram,
      'facebook',             v_club.facebook,
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
$$;

revoke all on function public.fetch_society_master_profile(uuid) from public;
grant execute on function public.fetch_society_master_profile(uuid) to authenticated;


-- ============================================================
-- SEZIONE 6 — RPC: profilo della singola squadra
-- ============================================================
-- La squadra resta una sottoentità: non ha account, non ha permessi propri, e
-- i dati mancanti ricadono sulla Società madre. Il fallback è calcolato qui,
-- una volta sola, invece che in ogni schermata che legge una squadra.

create or replace function public.fetch_society_team_profile(
  p_team_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_team       public.club_teams%rowtype;
  v_club       public.clubs%rowtype;
  v_can_manage boolean;
  v_squad      jsonb;
  v_staff      jsonb;
begin
  if p_team_id is null then
    return null;
  end if;

  -- La policy SELECT di club_teams filtra già archiviate e non pubbliche per
  -- chi non può gestirle: qui "not found" copre entrambi i casi.
  select * into v_team from public.club_teams where id = p_team_id;

  if not found then
    return null;
  end if;

  select * into v_club from public.clubs where id = v_team.club_id;

  if not found then
    return null;
  end if;

  v_can_manage := public.can_manage_society(v_team.club_id);

  -- Rosa: membri attivi e correnti della squadra. Un record manuale resta
  -- visibile come nome, ma senza profile_id non è tappabile — non è un
  -- profilo PROLINK e non deve sembrarlo.
  select coalesce(jsonb_agg(member order by member_name), '[]'::jsonb)
    into v_squad
  from (
    select
      jsonb_build_object(
        'id',               cm.id,
        'profile_id',       cm.profile_id,
        'full_name',        coalesce(p.full_name, cm.manual_name),
        'avatar_url',       p.avatar_url,
        'primary_position', pp.primary_position,
        'is_linked',        cm.profile_id is not null
      )                                     as member,
      coalesce(p.full_name, cm.manual_name) as member_name
    from public.club_members cm
    left join public.profiles p         on p.id = cm.profile_id
    left join public.player_profiles pp on pp.profile_id = cm.profile_id
    where cm.team_id = p_team_id
      and cm.status = 'active'
      and cm.is_current
      and cm.member_role = 'player'
  ) squad;

  -- Staff tecnico: l'allenatore è il primo, poi il vice, poi gli altri ruoli.
  -- Nessuna sezione separata per l'allenatore: sta dentro l'Organico.
  select coalesce(jsonb_agg(member order by member_rank, member_name), '[]'::jsonb)
    into v_staff
  from (
    select distinct on (coalesce(cm.profile_id::text, cm.id::text))
      jsonb_build_object(
        'id',         cm.id,
        'profile_id', cm.profile_id,
        'full_name',  coalesce(p.full_name, cm.manual_name),
        'avatar_url', p.avatar_url,
        'role_label', coalesce(cm.staff_title, cm.member_role),
        'is_linked',  cm.profile_id is not null
      )                                     as member,
      case
        when cm.member_role = 'coach' then 0
        when cm.staff_title ilike '%vice%' then 1
        else 2
      end                                   as member_rank,
      coalesce(p.full_name, cm.manual_name) as member_name
    from public.club_members cm
    left join public.profiles p on p.id = cm.profile_id
    where cm.team_id = p_team_id
      and cm.status = 'active'
      and cm.is_current
      and cm.member_role in ('coach', 'staff')
    order by coalesce(cm.profile_id::text, cm.id::text), member_rank
  ) staff;

  return jsonb_build_object(
    'team', jsonb_build_object(
      'id',        v_team.id,
      'club_id',   v_team.club_id,
      'name',      v_team.name,
      'category',  v_team.category,
      'team_type', v_team.team_type,
      'season',    v_team.season,
      -- Fallback in lettura: dato della squadra, poi dato della Società. Il
      -- fallback visuale neutro lo mette il client.
      'logo_url',   coalesce(v_team.logo_url, v_club.logo_url),
      'cover_url',  coalesce(v_team.cover_url, v_club.cover_url),
      'city',       coalesce(v_team.city, v_club.city),
      'region',     coalesce(v_team.region, v_club.region),
      'venue_name', coalesce(v_team.venue_name, v_club.stadium)
    ),
    'club', jsonb_build_object(
      'id',                  v_club.id,
      'name',                v_club.name,
      'logo_url',            v_club.logo_url,
      'owner_profile_id',    v_club.owner_profile_id,
      'verification_status', v_club.verification_status
    ),
    'viewer', jsonb_build_object(
      'profile_id', auth.uid(),
      'mode',       case when v_can_manage then 'owner' else 'visitor' end,
      'can_manage', v_can_manage,
      'is_following', auth.uid() is not null and exists (
        select 1 from public.club_follows f
        where f.club_id = v_team.club_id and f.profile_id = auth.uid()
      )
    ),
    'squad', v_squad,
    'staff', v_staff
  );
end;
$$;

revoke all on function public.fetch_society_team_profile(uuid) from public;
grant execute on function public.fetch_society_team_profile(uuid) to authenticated;
