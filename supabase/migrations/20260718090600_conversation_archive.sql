-- Migration: per-participant conversation archiving.
--
-- archived_at lives on conversation_participants (one row per participant),
-- so archiving is a personal, non-destructive action — it never hides a
-- conversation from the other participant(s), and a new incoming message
-- always un-archives it for everyone (AFTER INSERT trigger below) so
-- archived chats never silently swallow new messages.
--
-- Also rebuilds fetch_inbox_conversations (new signature: adds
-- p_include_archived) — drop+recreate is required because the parameter
-- list changes. Original body from 20260718090000_conversation_types.sql.
--
-- Mirrors conventions from:
--   20260718090000_conversation_types.sql (fetch_inbox_conversations shape,
--                                            drop function (int,int) pattern)
--   20260619100000_content_tag_states_targets_reports.sql (security definer
--                                            trigger function pattern)


-- ============================================================
-- ALTER TABLE: public.conversation_participants
-- ============================================================

alter table public.conversation_participants
add column if not exists archived_at timestamptz;


-- ============================================================
-- RPC: public.set_conversation_archived
-- ============================================================

create or replace function public.set_conversation_archived(
  target_conversation_id uuid,
  p_archived boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
  updated_rows        integer := 0;
begin
  if current_profile_id is null then
    raise exception 'Authentication required';
  end if;

  update public.conversation_participants participant
  set archived_at = case when p_archived then timezone('utc', now()) else null end
  where participant.conversation_id = target_conversation_id
    and participant.profile_id = current_profile_id;

  get diagnostics updated_rows = row_count;

  if updated_rows = 0 then
    raise exception 'Conversazione non trovata';
  end if;
end;
$$;

revoke all on function public.set_conversation_archived(uuid, boolean) from public;
grant execute on function public.set_conversation_archived(uuid, boolean) to authenticated;


-- ============================================================
-- TRIGGER: un-archive all participants when a new message arrives.
-- ============================================================

create or replace function public.messages_unarchive_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversation_participants participant
  set archived_at = null
  where participant.conversation_id = new.conversation_id
    and participant.archived_at is not null;

  return new;
end;
$$;

drop trigger if exists messages_unarchive_after_insert on public.messages;
create trigger messages_unarchive_after_insert
after insert on public.messages
for each row execute function public.messages_unarchive_after_insert();


-- ============================================================
-- Rebuild: public.fetch_inbox_conversations
-- New signature adds p_include_archived; new columns: archived, blocked_by_me.
-- ============================================================

drop function if exists public.fetch_inbox_conversations(int, int);

create or replace function public.fetch_inbox_conversations(
  p_limit             int default 50,
  p_offset            int default 0,
  p_include_archived  boolean default false
)
returns table (
  conversation_id                uuid,
  conversation_type              text,
  display_title                  text,
  avatar_url                     text,
  other_profile_id               uuid,
  participant_count              integer,
  last_message_body              text,
  last_message_kind              text,
  last_message_sent_at           timestamptz,
  last_message_sender_profile_id uuid,
  last_message_sender_name       text,
  unread_count                   bigint,
  archived                       boolean,
  blocked_by_me                  boolean
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
    )                                                                 as blocked_by_me
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
    select m.body, m.message_kind, m.sent_at, m.sender_profile_id
    from public.messages m
    where m.conversation_id = c.id
    order by m.sent_at desc
    limit 1
  ) last_message on true
  left join public.profiles last_message_sender
    on last_message_sender.id = last_message.sender_profile_id
  left join lateral (
    select count(*)::bigint as unread_count
    from public.messages m
    where m.conversation_id = c.id
      and m.sender_profile_id <> v_uid
      and m.sent_at > coalesce(my_participant.last_read_at, '-infinity'::timestamptz)
  ) unread_summary on true
  where my_participant.profile_id = v_uid
    and (p_include_archived or my_participant.archived_at is null)
  order by coalesce(last_message.sent_at, c.created_at) desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.fetch_inbox_conversations(int, int, boolean) from public;
grant execute on function public.fetch_inbox_conversations(int, int, boolean) to authenticated;
