-- Migration: RET-05 Phase 1 — agent↔player representation relationship types,
-- extended statuses, lifecycle RPCs, admin moderation, and enriched assistiti query.
--
-- Extends the EXISTING agent_representations table. Never edits old migrations.
-- Mirrors RPC/grant/revoke conventions from:
--   20260615120100_agent_representations.sql
--   20260615140000_phase3_moderation_privacy.sql
--   20260619100000_content_tag_states_targets_reports.sql


-- ============================================================
-- SECTION 1: Extend agent_representations columns
-- ============================================================

-- 1a. relationship_type
alter table public.agent_representations
  add column if not exists relationship_type text not null default 'procuratore';

alter table public.agent_representations
  drop constraint if exists agent_representations_relationship_type_check;

alter table public.agent_representations
  add constraint agent_representations_relationship_type_check
  check (relationship_type in ('procuratore', 'intermediario', 'referente_sportivo'));

-- 1b. message (visible to both parties)
alter table public.agent_representations
  add column if not exists message text;

-- 1c. private_note (agent-only note; no RLS policy change needed — select policy
--     already gates on own rows; the RPC for fetch_agent_assistiti is SECURITY DEFINER)
alter table public.agent_representations
  add column if not exists private_note text;

-- 1d. report fields
alter table public.agent_representations
  add column if not exists reported_reason text;

alter table public.agent_representations
  add column if not exists reported_at timestamptz;

-- 1e. lifecycle timestamps
alter table public.agent_representations
  add column if not exists terminated_at timestamptz;

-- 1f. pending_visibility (nullable; non-null only when agent has proposed a change
--     that the player has not yet confirmed)
alter table public.agent_representations
  add column if not exists pending_visibility text;

alter table public.agent_representations
  drop constraint if exists agent_representations_pending_visibility_check;

alter table public.agent_representations
  add constraint agent_representations_pending_visibility_check
  check (pending_visibility in ('public', 'private') or pending_visibility is null);

-- 1g. Widen status check to include new lifecycle values.
--     The original unnamed inline check is auto-named agent_representations_status_check.
--     Drop it and replace with a v2 named constraint.
alter table public.agent_representations
  drop constraint if exists agent_representations_status_check;

alter table public.agent_representations
  drop constraint if exists agent_representations_status_check_v2;

alter table public.agent_representations
  add constraint agent_representations_status_check_v2
  check (status in (
    'pending',
    'accepted',
    'rejected',
    'removed',       -- kept for back-compat
    'terminated',    -- agent ended the relationship
    'revoked',       -- agent cancelled pending request OR player removed the relationship
    'reported'       -- player reported; pending admin review
  ));


-- ============================================================
-- SECTION 2: Recreate request_agent_representation with new params
-- ============================================================

-- The original function signature is (uuid). CREATE OR REPLACE cannot change the
-- signature, so we drop and recreate with default-valued params so existing callers
-- that pass only p_player_profile_id continue to work.
drop function if exists public.request_agent_representation(uuid);

create or replace function public.request_agent_representation(
  p_player_profile_id uuid,
  p_relationship_type text default 'procuratore',
  p_visibility        text default 'public',
  p_message           text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent        uuid := auth.uid();
  v_rep          public.agent_representations%rowtype;
  v_result_id    uuid;
  v_agent_name   text;
  v_label        text;
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

  if not exists (
    select 1 from public.profiles where id = p_player_profile_id
  ) then
    raise exception 'Profilo giocatore non trovato';
  end if;

  -- Human label for notification body
  v_label := case p_relationship_type
    when 'procuratore'       then 'Procuratore'
    when 'intermediario'     then 'Intermediario'
    when 'referente_sportivo' then 'Referente sportivo'
    else p_relationship_type
  end;

  -- Check for an existing row between this agent and player
  select * into v_rep
  from public.agent_representations
  where agent_profile_id  = v_agent
    and player_profile_id = p_player_profile_id;

  if found then
    if v_rep.status in ('accepted', 'pending') then
      return v_rep.id;
    end if;

    -- rejected / removed / revoked / terminated: reset to pending
    update public.agent_representations
    set
      status            = 'pending',
      relationship_type = p_relationship_type,
      visibility        = p_visibility,
      message           = p_message,
      requested_by      = v_agent,
      accepted_at       = null,
      rejected_at       = null,
      terminated_at     = null,
      reported_reason   = null,
      reported_at       = null,
      pending_visibility = null,
      updated_at        = timezone('utc', now())
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
      message
    ) values (
      v_agent,
      p_player_profile_id,
      v_agent,
      'pending',
      p_relationship_type,
      p_visibility,
      p_message
    )
    returning id into v_result_id;
  end if;

  -- Notify the player
  select full_name into v_agent_name
  from public.profiles where id = v_agent;

  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    p_player_profile_id,
    'agent_representation_request',
    'Richiesta di rappresentanza',
    coalesce(v_agent_name, 'Un agente') || ' ti ha inviato una richiesta come ' || v_label || '.',
    jsonb_build_object(
      'agent_profile_id',   v_agent::text,
      'representation_id',  v_result_id::text
    )
  );

  return v_result_id;
end;
$$;

revoke all on function public.request_agent_representation(uuid, text, text, text) from public;
grant execute on function public.request_agent_representation(uuid, text, text, text) to authenticated;


-- ============================================================
-- SECTION 3: remove_agent_representation
-- ============================================================
-- Either party can remove an accepted (or pending) relationship.
-- Agent calling → status='terminated'; player calling → status='revoked'.
-- Notifies the other party.

create or replace function public.remove_agent_representation(
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   uuid := auth.uid();
  v_rep      public.agent_representations%rowtype;
  v_other    uuid;
  v_new_status text;
  v_caller_name text;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  select * into v_rep
  from public.agent_representations
  where id = p_id;

  if not found then
    raise exception 'Relazione non trovata';
  end if;

  if v_rep.agent_profile_id <> v_caller
     and v_rep.player_profile_id <> v_caller then
    raise exception 'Non autorizzato';
  end if;

  if v_rep.status not in ('accepted', 'pending') then
    raise exception 'La relazione non è in uno stato rimuovibile';
  end if;

  if v_caller = v_rep.agent_profile_id then
    v_new_status := 'terminated';
    v_other      := v_rep.player_profile_id;
  else
    v_new_status := 'revoked';
    v_other      := v_rep.agent_profile_id;
  end if;

  update public.agent_representations
  set
    status        = v_new_status,
    terminated_at = case when v_new_status = 'terminated' then timezone('utc', now()) else terminated_at end,
    updated_at    = timezone('utc', now())
  where id = p_id;

  select full_name into v_caller_name
  from public.profiles where id = v_caller;

  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    v_other,
    'agent_representation_removed',
    'Rappresentanza rimossa',
    coalesce(v_caller_name, 'Un utente') || ' ha rimosso la relazione di rappresentanza.',
    jsonb_build_object(
      'representation_id', p_id::text
    )
  );
end;
$$;

revoke all on function public.remove_agent_representation(uuid) from public;
grant execute on function public.remove_agent_representation(uuid) to authenticated;


-- ============================================================
-- SECTION 4: cancel_agent_representation_request
-- ============================================================
-- Agent cancels their own pending request (before the player responds).

create or replace function public.cancel_agent_representation_request(
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_rep    public.agent_representations%rowtype;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  select * into v_rep
  from public.agent_representations
  where id = p_id;

  if not found then
    raise exception 'Richiesta non trovata';
  end if;

  if v_rep.agent_profile_id <> v_caller then
    raise exception 'Non autorizzato';
  end if;

  if v_rep.status <> 'pending' then
    raise exception 'Solo le richieste in attesa possono essere annullate';
  end if;

  update public.agent_representations
  set
    status     = 'revoked',
    updated_at = timezone('utc', now())
  where id = p_id;
end;
$$;

revoke all on function public.cancel_agent_representation_request(uuid) from public;
grant execute on function public.cancel_agent_representation_request(uuid) to authenticated;


-- ============================================================
-- SECTION 5: report_agent_representation
-- ============================================================
-- Player reports a representation row for admin review.

create or replace function public.report_agent_representation(
  p_id     uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_rep    public.agent_representations%rowtype;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  select * into v_rep
  from public.agent_representations
  where id = p_id;

  if not found then
    raise exception 'Relazione non trovata';
  end if;

  if v_rep.player_profile_id <> v_caller then
    raise exception 'Non autorizzato';
  end if;

  update public.agent_representations
  set
    status          = 'reported',
    reported_reason = p_reason,
    reported_at     = timezone('utc', now()),
    updated_at      = timezone('utc', now())
  where id = p_id;
end;
$$;

revoke all on function public.report_agent_representation(uuid, text) from public;
grant execute on function public.report_agent_representation(uuid, text) to authenticated;


-- ============================================================
-- SECTION 6: propose_representation_visibility / confirm_representation_visibility
-- ============================================================

-- 6a. Agent proposes a visibility change.
--     'public' requires player confirmation (pending_visibility);
--     'private' is applied immediately.

create or replace function public.propose_representation_visibility(
  p_id         uuid,
  p_visibility text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_rep    public.agent_representations%rowtype;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  if p_visibility not in ('public', 'private') then
    raise exception 'Visibilita'' non valida';
  end if;

  select * into v_rep
  from public.agent_representations
  where id = p_id;

  if not found then
    raise exception 'Relazione non trovata';
  end if;

  if v_rep.agent_profile_id <> v_caller then
    raise exception 'Non autorizzato';
  end if;

  if v_rep.status <> 'accepted' then
    raise exception 'La visibilita'' può essere modificata solo su relazioni attive';
  end if;

  if p_visibility = 'private' then
    -- Apply immediately, clear any pending proposal
    update public.agent_representations
    set
      visibility         = 'private',
      pending_visibility = null,
      updated_at         = timezone('utc', now())
    where id = p_id;

  elsif p_visibility = 'public' and v_rep.visibility = 'private' then
    -- Propose to the player; notify them
    update public.agent_representations
    set
      pending_visibility = 'public',
      updated_at         = timezone('utc', now())
    where id = p_id;

    insert into public.notifications (recipient_profile_id, type, title, body, data)
    values (
      v_rep.player_profile_id,
      'agent_representation_visibility_proposed',
      'Proposta di visibilità',
      'Il tuo agente ha proposto di rendere pubblica la vostra relazione di rappresentanza.',
      jsonb_build_object(
        'representation_id', p_id::text
      )
    );
  end if;
  -- No-op if p_visibility='public' and current visibility is already 'public'.
end;
$$;

revoke all on function public.propose_representation_visibility(uuid, text) from public;
grant execute on function public.propose_representation_visibility(uuid, text) to authenticated;


-- 6b. Player confirms or rejects a pending visibility proposal.

create or replace function public.confirm_representation_visibility(
  p_id     uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_rep    public.agent_representations%rowtype;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  select * into v_rep
  from public.agent_representations
  where id = p_id;

  if not found then
    raise exception 'Relazione non trovata';
  end if;

  if v_rep.player_profile_id <> v_caller then
    raise exception 'Non autorizzato';
  end if;

  if v_rep.pending_visibility is null then
    raise exception 'Nessuna proposta di visibilità in attesa';
  end if;

  update public.agent_representations
  set
    visibility         = case when p_accept then v_rep.pending_visibility else visibility end,
    pending_visibility = null,
    updated_at         = timezone('utc', now())
  where id = p_id;
end;
$$;

revoke all on function public.confirm_representation_visibility(uuid, boolean) from public;
grant execute on function public.confirm_representation_visibility(uuid, boolean) to authenticated;


-- ============================================================
-- SECTION 7: fetch_agent_assistiti
-- ============================================================
-- Returns enriched rows for an agent's representations with status IN
-- ('pending','accepted'). Ordered: pending first, then accepted, newest first.
-- current_team: derived from club_members (is_current=true, status='active').
-- birth_year: derived from profiles.birth_date (mirrors search_agent_player_candidates).

create or replace function public.fetch_agent_assistiti(
  p_agent_profile_id uuid
)
returns table (
  id                uuid,
  player_profile_id uuid,
  player_full_name  text,
  player_avatar_url text,
  primary_position  public.player_position,
  current_team      text,
  birth_year        integer,
  relationship_type text,
  visibility        text,
  status            text,
  message           text,
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

  return query
    select
      r.id,
      r.player_profile_id,
      p.full_name                                                   as player_full_name,
      p.avatar_url                                                  as player_avatar_url,
      pp.primary_position,
      cl.name                                                       as current_team,
      case
        when p.birth_date is not null
          then extract(year from p.birth_date)::integer
        else null
      end                                                           as birth_year,
      r.relationship_type,
      r.visibility,
      r.status,
      r.message,
      r.created_at
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
      and r.status in ('pending', 'accepted')
    order by
      case r.status when 'pending' then 0 else 1 end,
      r.created_at desc;
end;
$$;

revoke all on function public.fetch_agent_assistiti(uuid) from public;
grant execute on function public.fetch_agent_assistiti(uuid) to authenticated;


-- ============================================================
-- SECTION 8: Admin moderation — mirroring fetch_reported_content_tags
--            and moderate_content_tag from 20260619100000
-- ============================================================

-- 8a. fetch_reported_representations
--     Returns reported representation rows joined with agent + player details.

create or replace function public.fetch_reported_representations()
returns table (
  id                uuid,
  agent_profile_id  uuid,
  agent_name        text,
  agent_avatar_url  text,
  player_profile_id uuid,
  player_name       text,
  player_avatar_url text,
  relationship_type text,
  reported_reason   text,
  reported_at       timestamptz,
  created_at        timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;

  return query
    select
      r.id,
      r.agent_profile_id,
      coalesce(pa.full_name, 'Agente')         as agent_name,
      pa.avatar_url                             as agent_avatar_url,
      r.player_profile_id,
      coalesce(pp.full_name, 'Giocatore')       as player_name,
      pp.avatar_url                             as player_avatar_url,
      r.relationship_type,
      r.reported_reason,
      r.reported_at,
      r.created_at
    from public.agent_representations r
    join public.profiles pa on pa.id = r.agent_profile_id
    join public.profiles pp on pp.id = r.player_profile_id
    where r.status = 'reported'
    order by r.reported_at desc nulls last;
end;
$$;

revoke all on function public.fetch_reported_representations() from public;
grant execute on function public.fetch_reported_representations() to authenticated;


-- 8b. moderate_representation
--     p_remove=true  → status='terminated' (rapporto rimosso dall'admin)
--     p_remove=false → dismiss: restore status='accepted', clear reported fields

create or replace function public.moderate_representation(
  p_id     uuid,
  p_remove boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rep public.agent_representations%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;

  select * into v_rep
  from public.agent_representations
  where id = p_id;

  if not found then
    raise exception 'Relazione non trovata';
  end if;

  if v_rep.status <> 'reported' then
    raise exception 'Solo le relazioni segnalate possono essere moderate';
  end if;

  if p_remove then
    update public.agent_representations
    set
      status        = 'terminated',
      terminated_at = timezone('utc', now()),
      updated_at    = timezone('utc', now())
    where id = p_id;
  else
    -- Dismiss: restore to accepted and clear report fields
    update public.agent_representations
    set
      status          = 'accepted',
      reported_reason = null,
      reported_at     = null,
      updated_at      = timezone('utc', now())
    where id = p_id;
  end if;
end;
$$;

revoke all on function public.moderate_representation(uuid, boolean) from public;
grant execute on function public.moderate_representation(uuid, boolean) to authenticated;


-- ============================================================
-- SECTION 9: set_representation_private_note
-- ============================================================
-- Agent updates the private note on their own representation row.
-- Only the agent party (agent_profile_id = auth.uid()) may write this field.

create or replace function public.set_representation_private_note(
  p_id   uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_rep    public.agent_representations%rowtype;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  select * into v_rep
  from public.agent_representations
  where id = p_id;

  if not found then
    raise exception 'Relazione non trovata';
  end if;

  if v_rep.agent_profile_id <> v_caller then
    raise exception 'Non autorizzato';
  end if;

  update public.agent_representations
  set
    private_note = p_note,
    updated_at   = timezone('utc', now())
  where id = p_id;
end;
$$;

revoke all on function public.set_representation_private_note(uuid, text) from public;
grant execute on function public.set_representation_private_note(uuid, text) to authenticated;
