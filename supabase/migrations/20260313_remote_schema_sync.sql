create extension if not exists pg_trgm;

alter type public.player_position add value if not exists 'center_back';
alter type public.player_position add value if not exists 'right_back';
alter type public.player_position add value if not exists 'left_back';
alter type public.player_position add value if not exists 'defensive_midfielder';
alter type public.player_position add value if not exists 'central_midfielder';
alter type public.player_position add value if not exists 'attacking_midfielder';
alter type public.player_position add value if not exists 'right_winger';
alter type public.player_position add value if not exists 'left_winger';
alter type public.player_position add value if not exists 'striker';

alter table public.player_career_entries
add column if not exists club_id uuid references public.clubs(id) on delete set null,
add column if not exists team_logo_url text;

create index if not exists player_career_entries_club_id_idx
on public.player_career_entries (club_id);

create index if not exists clubs_name_search_idx
on public.clubs using gin (name gin_trgm_ops);

drop function if exists public.search_profiles(text, public.app_role, text, public.player_position);

create function public.search_profiles(
  search_text text default null,
  role_filter public.app_role default null,
  region_filter text default null,
  position_filter public.player_position default null
)
returns table (
  profile_id uuid,
  full_name text,
  role public.app_role,
  region text,
  city text,
  bio text,
  primary_position public.player_position,
  is_available boolean
)
language sql
stable
as $$
  select
    profile.id as profile_id,
    profile.full_name,
    profile.role,
    profile.region,
    profile.city,
    profile.bio,
    player.primary_position,
    profile.is_available
  from public.profiles profile
  left join public.player_profiles player on player.profile_id = profile.id
  where
    (search_text is null or profile.full_name ilike '%' || search_text || '%')
    and (role_filter is null or profile.role = role_filter)
    and (region_filter is null or profile.region = region_filter)
    and (position_filter is null or player.primary_position = position_filter)
  order by profile.full_name asc;
$$;

create or replace function public.request_connection(target_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
  existing_connection public.connections%rowtype;
  result_connection_id uuid;
begin
  if current_profile_id is null then
    raise exception 'Authentication required';
  end if;

  if target_profile_id is null then
    raise exception 'Target profile is required';
  end if;

  if current_profile_id = target_profile_id then
    raise exception 'Non puoi inviare una richiesta a te stesso';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = target_profile_id
  ) then
    raise exception 'Profilo destinatario non trovato';
  end if;

  select connection.*
  into existing_connection
  from public.connections connection
  where
    (connection.requester_profile_id = current_profile_id and connection.addressee_profile_id = target_profile_id)
    or (connection.requester_profile_id = target_profile_id and connection.addressee_profile_id = current_profile_id)
  order by connection.created_at desc
  limit 1;

  if found then
    if existing_connection.status = 'blocked' then
      raise exception 'Questa connessione non è disponibile';
    end if;

    if existing_connection.status = 'accepted' then
      return existing_connection.id;
    end if;

    if existing_connection.status = 'pending' then
      if existing_connection.requester_profile_id = current_profile_id then
        return existing_connection.id;
      end if;

      update public.connections connection
      set status = 'accepted', updated_at = timezone('utc', now())
      where connection.id = existing_connection.id;

      return existing_connection.id;
    end if;

    update public.connections connection
    set
      requester_profile_id = current_profile_id,
      addressee_profile_id = target_profile_id,
      status = 'pending',
      updated_at = timezone('utc', now())
    where connection.id = existing_connection.id;

    return existing_connection.id;
  end if;

  insert into public.connections (requester_profile_id, addressee_profile_id)
  values (current_profile_id, target_profile_id)
  returning id into result_connection_id;

  return result_connection_id;
end;
$$;

create or replace function public.get_network_overview()
returns table (
  connection_id uuid,
  status public.connection_status,
  is_requester boolean,
  other_profile_id uuid,
  other_full_name text,
  other_role public.app_role,
  other_region text,
  other_city text,
  other_primary_position public.player_position,
  other_is_available boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
as $$
  with current_profile as (
    select auth.uid() as profile_id
  )
  select
    connection.id as connection_id,
    connection.status,
    connection.requester_profile_id = current_profile.profile_id as is_requester,
    other_profile.id as other_profile_id,
    other_profile.full_name as other_full_name,
    other_profile.role as other_role,
    other_profile.region as other_region,
    other_profile.city as other_city,
    other_player.primary_position as other_primary_position,
    other_profile.is_available as other_is_available,
    connection.created_at,
    connection.updated_at
  from current_profile
  join public.connections connection
    on connection.requester_profile_id = current_profile.profile_id
    or connection.addressee_profile_id = current_profile.profile_id
  join public.profiles other_profile
    on other_profile.id = case
      when connection.requester_profile_id = current_profile.profile_id then connection.addressee_profile_id
      else connection.requester_profile_id
    end
  left join public.player_profiles other_player on other_player.profile_id = other_profile.id
  order by
    case connection.status
      when 'pending' then 0
      when 'accepted' then 1
      when 'rejected' then 2
      else 3
    end,
    connection.updated_at desc;
$$;

create or replace function public.get_conversation_summaries()
returns table (
  conversation_id uuid,
  other_profile_id uuid,
  other_full_name text,
  other_role public.app_role,
  other_region text,
  other_city text,
  other_primary_position public.player_position,
  last_message_body text,
  last_message_sent_at timestamptz,
  last_message_sender_profile_id uuid,
  unread_count bigint
)
language sql
stable
as $$
  with current_profile as (
    select auth.uid() as profile_id
  )
  select
    conversation.id as conversation_id,
    other_profile.id as other_profile_id,
    other_profile.full_name as other_full_name,
    other_profile.role as other_role,
    other_profile.region as other_region,
    other_profile.city as other_city,
    other_player.primary_position as other_primary_position,
    last_message.body as last_message_body,
    last_message.sent_at as last_message_sent_at,
    last_message.sender_profile_id as last_message_sender_profile_id,
    coalesce(unread_summary.unread_count, 0) as unread_count
  from current_profile
  join public.conversation_participants current_participant
    on current_participant.profile_id = current_profile.profile_id
  join public.conversations conversation
    on conversation.id = current_participant.conversation_id
  join public.conversation_participants other_participant
    on other_participant.conversation_id = conversation.id
    and other_participant.profile_id <> current_profile.profile_id
  join public.profiles other_profile on other_profile.id = other_participant.profile_id
  left join public.player_profiles other_player on other_player.profile_id = other_profile.id
  left join lateral (
    select message.body, message.sent_at, message.sender_profile_id
    from public.messages message
    where message.conversation_id = conversation.id
    order by message.sent_at desc
    limit 1
  ) last_message on true
  left join lateral (
    select count(*)::bigint as unread_count
    from public.messages message
    where message.conversation_id = conversation.id
      and message.sender_profile_id <> current_profile.profile_id
      and message.read_at is null
  ) unread_summary on true
  order by coalesce(last_message.sent_at, conversation.created_at) desc;
$$;

create or replace function public.get_conversation_messages(target_conversation_id uuid)
returns table (
  message_id uuid,
  body text,
  sent_at timestamptz,
  read_at timestamptz,
  sender_profile_id uuid,
  sender_full_name text,
  message_kind text,
  shared_contact_name text,
  shared_contact_phone text
)
language sql
stable
as $$
  select
    message.id as message_id,
    message.body,
    message.sent_at,
    message.read_at,
    sender_profile.id as sender_profile_id,
    sender_profile.full_name as sender_full_name,
    message.message_kind,
    message.shared_contact_name,
    message.shared_contact_phone
  from public.messages message
  join public.profiles sender_profile on sender_profile.id = message.sender_profile_id
  where message.conversation_id = target_conversation_id
    and exists (
      select 1
      from public.conversation_participants participant
      where participant.conversation_id = target_conversation_id
        and participant.profile_id = auth.uid()
    )
  order by message.sent_at asc;
$$;

create or replace function public.start_direct_conversation(target_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
  existing_conversation_id uuid;
  result_conversation_id uuid;
begin
  if current_profile_id is null then
    raise exception 'Authentication required';
  end if;

  if target_profile_id is null then
    raise exception 'Target profile is required';
  end if;

  if current_profile_id = target_profile_id then
    raise exception 'Non puoi avviare una conversazione con te stesso';
  end if;

  if not exists (
    select 1
    from public.connections connection
    where
      ((connection.requester_profile_id = current_profile_id and connection.addressee_profile_id = target_profile_id)
      or (connection.requester_profile_id = target_profile_id and connection.addressee_profile_id = current_profile_id))
      and connection.status = 'accepted'
  ) then
    raise exception 'Serve una connessione accettata prima di aprire una chat';
  end if;

  select conversation.id
  into existing_conversation_id
  from public.conversations conversation
  where
    exists (
      select 1
      from public.conversation_participants participant
      where participant.conversation_id = conversation.id
        and participant.profile_id = current_profile_id
    )
    and exists (
      select 1
      from public.conversation_participants participant
      where participant.conversation_id = conversation.id
        and participant.profile_id = target_profile_id
    )
    and not exists (
      select 1
      from public.conversation_participants participant
      where participant.conversation_id = conversation.id
        and participant.profile_id not in (current_profile_id, target_profile_id)
    )
  limit 1;

  if existing_conversation_id is not null then
    return existing_conversation_id;
  end if;

  insert into public.conversations (created_by_profile_id)
  values (current_profile_id)
  returning id into result_conversation_id;

  insert into public.conversation_participants (conversation_id, profile_id)
  values
    (result_conversation_id, current_profile_id),
    (result_conversation_id, target_profile_id);

  return result_conversation_id;
end;
$$;

create or replace function public.mark_conversation_read(target_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
  updated_messages integer := 0;
begin
  if current_profile_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = target_conversation_id
      and participant.profile_id = current_profile_id
  ) then
    raise exception 'Conversation not accessible';
  end if;

  update public.messages message
  set read_at = timezone('utc', now())
  where message.conversation_id = target_conversation_id
    and message.sender_profile_id <> current_profile_id
    and message.read_at is null;

  get diagnostics updated_messages = row_count;

  return updated_messages;
end;
$$;

revoke all on function public.request_connection(uuid) from public;
grant execute on function public.request_connection(uuid) to authenticated;

revoke all on function public.get_network_overview() from public;
grant execute on function public.get_network_overview() to authenticated;

revoke all on function public.get_conversation_summaries() from public;
grant execute on function public.get_conversation_summaries() to authenticated;

revoke all on function public.get_conversation_messages(uuid) from public;
grant execute on function public.get_conversation_messages(uuid) to authenticated;

revoke all on function public.start_direct_conversation(uuid) from public;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;