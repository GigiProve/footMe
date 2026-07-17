-- Migration: Shortlist RPCs — enriched reads and the single write path for
-- entry value changes (priority / evaluation_status / internal_note).
--
-- All functions are SECURITY DEFINER, so RLS on club_shortlists /
-- club_shortlist_entries is bypassed at the table level; every function
-- therefore re-checks has_club_permission() explicitly before touching or
-- returning any row (mirrors fetch_agent_assistiti / confirm_representation_visibility
-- in 20260626120000_representation_relationship_types.sql).
--
-- No insert into public.notifications anywhere in this feature: Shortlist is
-- an internal scouting tool and must never notify the observed profile.
--
-- Mirrors conventions from:
--   20260626120000_representation_relationship_types.sql (fetch_agent_assistiti enrichment pattern)
--   20260627090100_saved_following_rpcs.sql               (RPC scaffolding, fetch_saved_counts template)


-- ============================================================
-- RPC: public.fetch_club_shortlists
--
-- Lists for a club with entry_count / high_priority_count aggregates and
-- the creator's display name. Guarded by shortlist_view.
-- Paginated (p_limit/p_offset) per project convention even though a club's
-- own list count is expected to stay small.
-- ============================================================

drop function if exists public.fetch_club_shortlists(uuid);
drop function if exists public.fetch_club_shortlists(uuid, int, int);

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

  if not public.has_club_permission(p_club_id, 'shortlist_view') then
    raise exception 'Non autorizzato';
  end if;

  return query
  select
    cs.id,
    cs.club_id,
    cs.name,
    cs.description,
    cs.scope,
    count(e.id)                                     as entry_count,
    count(e.id) filter (where e.priority = 'alta')  as high_priority_count,
    cs.created_by_profile_id,
    creator.full_name                               as created_by_full_name,
    cs.created_at,
    cs.updated_at
  from public.club_shortlists cs
  left join public.club_shortlist_entries e
    on e.shortlist_id = cs.id
  left join public.profiles creator
    on creator.id = cs.created_by_profile_id
  where cs.club_id = p_club_id
  group by cs.id, cs.club_id, cs.name, cs.description, cs.scope,
           cs.created_by_profile_id, creator.full_name, cs.created_at, cs.updated_at
  order by cs.created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.fetch_club_shortlists(uuid, int, int) from public;
grant execute on function public.fetch_club_shortlists(uuid, int, int) to authenticated;


-- ============================================================
-- RPC: public.fetch_shortlist_overview_counts
--
-- Single-row dashboard counters for a club. Template: fetch_saved_counts.
-- Guarded by shortlist_view.
-- ============================================================

drop function if exists public.fetch_shortlist_overview_counts(uuid);

create or replace function public.fetch_shortlist_overview_counts(
  p_club_id uuid
)
returns table (
  lists_count          bigint,
  total_entries        bigint,
  da_contattare_count  bigint,
  alta_count           bigint
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

  if not public.has_club_permission(p_club_id, 'shortlist_view') then
    raise exception 'Non autorizzato';
  end if;

  return query
  select
    (select count(*)
       from public.club_shortlists
       where club_id = p_club_id)::bigint,
    (select count(*)
       from public.club_shortlist_entries e
       join public.club_shortlists cs on cs.id = e.shortlist_id
       where cs.club_id = p_club_id)::bigint,
    (select count(*)
       from public.club_shortlist_entries e
       join public.club_shortlists cs on cs.id = e.shortlist_id
       where cs.club_id = p_club_id
         and e.evaluation_status = 'da_contattare')::bigint,
    (select count(*)
       from public.club_shortlist_entries e
       join public.club_shortlists cs on cs.id = e.shortlist_id
       where cs.club_id = p_club_id
         and e.priority = 'alta')::bigint;
end;
$$;

revoke all on function public.fetch_shortlist_overview_counts(uuid) from public;
grant execute on function public.fetch_shortlist_overview_counts(uuid) to authenticated;


-- ============================================================
-- RPC: public.fetch_shortlist_entries
--
-- Enriched entry rows for a single list: target profile summary,
-- primary_position, current_team (lateral join on club_members/clubs,
-- is_current = true and status = 'active' — copied from fetch_agent_assistiti
-- in 20260626120000), birth_year, and the adder's display name.
-- Guarded by shortlist_view, resolved from the parent list's club_id.
-- Paginated (p_limit/p_offset) per project convention.
-- ============================================================

drop function if exists public.fetch_shortlist_entries(uuid);
drop function if exists public.fetch_shortlist_entries(uuid, int, int);

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
  created_at            timestamptz,
  updated_at            timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_club_id  uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select cs0.club_id into v_club_id
  from public.club_shortlists cs0
  where cs0.id = p_shortlist_id;

  if not found then
    raise exception 'Lista non trovata';
  end if;

  if not public.has_club_permission(v_club_id, 'shortlist_view') then
    raise exception 'Non autorizzato';
  end if;

  return query
  select
    e.id,
    e.shortlist_id,
    e.player_profile_id,
    p.full_name                                                   as full_name,
    p.avatar_url                                                  as avatar_url,
    p.role::text                                                  as role,
    pp.primary_position,
    cl.name                                                       as current_team,
    case
      when p.birth_date is not null
        then extract(year from p.birth_date)::integer
      else null
    end                                                            as birth_year,
    e.priority,
    e.evaluation_status,
    e.internal_note,
    e.added_by_profile_id,
    adder.full_name                                               as added_by_full_name,
    e.created_at,
    e.updated_at
  from public.club_shortlist_entries e
  join public.profiles p
    on p.id = e.player_profile_id
  left join public.player_profiles pp
    on pp.profile_id = e.player_profile_id
  left join lateral (
    select c.name
    from public.club_members cm
    join public.clubs c on c.id = cm.club_id
    where cm.profile_id = e.player_profile_id
      and cm.is_current = true
      and cm.status = 'active'
    limit 1
  ) cl on true
  left join public.profiles adder
    on adder.id = e.added_by_profile_id
  where e.shortlist_id = p_shortlist_id
  order by e.created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.fetch_shortlist_entries(uuid, int, int) from public;
grant execute on function public.fetch_shortlist_entries(uuid, int, int) to authenticated;


-- ============================================================
-- RPC: public.update_shortlist_entry
--
-- Single write path for entry value changes (club_shortlist_entries has no
-- UPDATE policy). Baseline requires shortlist_view. shortlist_edit_status is
-- required only if p_priority or p_evaluation_status is non-null AND differs
-- from the stored value. shortlist_add_notes is required only if p_set_note
-- is true AND the resulting note differs from the stored one.
--
-- p_set_note distinguishes "leave the note untouched" (false, default) from
-- "set the note to p_internal_note" (true) — including clearing it via
-- p_set_note = true, p_internal_note = null.
--
-- No insert into public.notifications.
-- ============================================================

drop function if exists public.update_shortlist_entry(uuid, text, text, boolean, text);

create or replace function public.update_shortlist_entry(
  p_entry_id           uuid,
  p_priority           text default null,
  p_evaluation_status  text default null,
  p_set_note           boolean default false,
  p_internal_note      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid              uuid := auth.uid();
  v_entry            public.club_shortlist_entries%rowtype;
  v_club_id          uuid;
  v_status_changing  boolean;
  v_note_changing    boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_entry
  from public.club_shortlist_entries
  where id = p_entry_id;

  if not found then
    raise exception 'Voce non trovata';
  end if;

  select club_id into v_club_id
  from public.club_shortlists
  where id = v_entry.shortlist_id;

  if not public.has_club_permission(v_club_id, 'shortlist_view') then
    raise exception 'Non autorizzato';
  end if;

  v_status_changing :=
    (p_priority is not null and p_priority <> v_entry.priority)
    or (p_evaluation_status is not null and p_evaluation_status <> v_entry.evaluation_status);

  if v_status_changing and not public.has_club_permission(v_club_id, 'shortlist_edit_status') then
    raise exception 'Non autorizzato';
  end if;

  v_note_changing := p_set_note and (p_internal_note is distinct from v_entry.internal_note);

  if v_note_changing and not public.has_club_permission(v_club_id, 'shortlist_add_notes') then
    raise exception 'Non autorizzato';
  end if;

  if p_priority is not null and p_priority not in ('alta', 'media', 'bassa') then
    raise exception 'Valore non valido';
  end if;

  if p_evaluation_status is not null and p_evaluation_status not in (
    'da_valutare', 'interessante', 'da_contattare', 'contattato', 'non_prioritario', 'scartato'
  ) then
    raise exception 'Valore non valido';
  end if;

  update public.club_shortlist_entries
  set
    priority           = coalesce(p_priority, priority),
    evaluation_status   = coalesce(p_evaluation_status, evaluation_status),
    internal_note       = case when p_set_note then p_internal_note else internal_note end
  where id = p_entry_id;
end;
$$;

revoke all on function public.update_shortlist_entry(uuid, text, text, boolean, text) from public;
grant execute on function public.update_shortlist_entry(uuid, text, text, boolean, text) to authenticated;
