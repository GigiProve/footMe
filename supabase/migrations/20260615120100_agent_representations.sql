-- Migration: agent_representations table with RLS and request/respond RPCs.

create table if not exists public.agent_representations (
  id                uuid        primary key default gen_random_uuid(),
  agent_profile_id  uuid        not null references public.profiles(id) on delete cascade,
  player_profile_id uuid        not null references public.profiles(id) on delete cascade,
  status            text        not null default 'pending'
                                check (status in ('pending', 'accepted', 'rejected', 'removed')),
  visibility        text        not null default 'public'
                                check (visibility in ('public', 'private')),
  requested_by      uuid        not null references public.profiles(id),
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now()),
  accepted_at       timestamptz,
  rejected_at       timestamptz,
  constraint agent_representations_distinct
    check (agent_profile_id <> player_profile_id),
  unique (agent_profile_id, player_profile_id)
);

create index if not exists agent_representations_agent_idx
  on public.agent_representations (agent_profile_id, status);

create index if not exists agent_representations_player_idx
  on public.agent_representations (player_profile_id, status);

alter table public.agent_representations enable row level security;

-- SELECT: parties see their own rows; everyone sees accepted+public rows
create policy "agent representations select"
  on public.agent_representations
  for select
  to authenticated
  using (
    agent_profile_id  = auth.uid()
    or player_profile_id = auth.uid()
    or (status = 'accepted' and visibility = 'public')
  );

-- No direct INSERT / UPDATE policies for clients; RPCs are security definer.

-- -----------------------------------------------------------------------
-- RPC: agent requests to represent a player
-- -----------------------------------------------------------------------
create or replace function public.request_agent_representation(
  p_player_profile_id uuid
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
  v_player_name  text;
  v_agent_name   text;
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

  if not exists (
    select 1 from public.profiles where id = p_player_profile_id
  ) then
    raise exception 'Profilo giocatore non trovato';
  end if;

  -- Check for an existing row between this agent and player
  select * into v_rep
  from public.agent_representations
  where agent_profile_id  = v_agent
    and player_profile_id = p_player_profile_id;

  if found then
    if v_rep.status in ('accepted', 'pending') then
      return v_rep.id;
    end if;

    -- rejected or removed: reset to pending
    update public.agent_representations
    set
      status       = 'pending',
      requested_by = v_agent,
      accepted_at  = null,
      rejected_at  = null,
      updated_at   = timezone('utc', now())
    where id = v_rep.id;

    v_result_id := v_rep.id;
  else
    insert into public.agent_representations
      (agent_profile_id, player_profile_id, requested_by, status)
    values
      (v_agent, p_player_profile_id, v_agent, 'pending')
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
    coalesce(v_agent_name, 'Un agente') || ' ha richiesto di collegarsi al tuo profilo',
    jsonb_build_object(
      'representation_id',  v_result_id::text,
      'agent_profile_id',   v_agent::text
    )
  );

  return v_result_id;
end;
$$;

revoke all on function public.request_agent_representation(uuid) from public;
grant execute on function public.request_agent_representation(uuid) to authenticated;

-- -----------------------------------------------------------------------
-- RPC: player responds to a pending representation request
-- -----------------------------------------------------------------------
create or replace function public.respond_agent_representation(
  p_id     uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current      uuid := auth.uid();
  v_rep          public.agent_representations%rowtype;
  v_player_name  text;
  v_action       text;
  v_new_status   text;
begin
  if v_current is null then
    raise exception 'Authentication required';
  end if;

  select * into v_rep
  from public.agent_representations
  where id = p_id;

  if not found then
    raise exception 'Richiesta non trovata';
  end if;

  if v_rep.player_profile_id <> v_current then
    raise exception 'Non autorizzato';
  end if;

  if v_rep.status <> 'pending' then
    raise exception 'Richiesta già gestita';
  end if;

  v_new_status := case when p_accept then 'accepted' else 'rejected' end;
  v_action     := case when p_accept then 'accettato' else 'rifiutato' end;

  update public.agent_representations
  set
    status      = v_new_status,
    accepted_at = case when p_accept then timezone('utc', now()) else null end,
    rejected_at = case when not p_accept then timezone('utc', now()) else null end,
    updated_at  = timezone('utc', now())
  where id = p_id;

  -- Notify the agent
  select full_name into v_player_name
  from public.profiles where id = v_current;

  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    v_rep.agent_profile_id,
    'agent_representation_responded',
    'Risposta alla richiesta di rappresentanza',
    coalesce(v_player_name, 'Il giocatore') || ' ha ' || v_action || ' la tua richiesta',
    jsonb_build_object(
      'representation_id',  p_id::text,
      'player_profile_id',  v_current::text,
      'accepted',           p_accept
    )
  );
end;
$$;

revoke all on function public.respond_agent_representation(uuid, boolean) from public;
grant execute on function public.respond_agent_representation(uuid, boolean) to authenticated;
