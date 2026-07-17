-- Migration: Conversation types (direct/group) for the Messaggi inbox.
--
-- Adds group-chat support to the existing conversations/conversation_participants
-- tables, backfills per-participant last_read_at from historical read_at data,
-- introduces fetch_inbox_conversations() (a unified list RPC covering both
-- direct and group conversations), and updates mark_conversation_read() to
-- track last_read_at for everyone while still restricting the legacy
-- messages.read_at receipt semantics to direct (1:1) conversations.
--
-- Does NOT touch public.get_conversation_summaries() (20260311000000): that
-- RPC remains the direct-only conversation list consumer, untouched.
--
-- Mirrors conventions from:
--   20260717090200_shortlist_rpcs.sql       (RPC scaffolding: security definer,
--                                             v_uid/auth check, revoke+grant)
--   20260313000002_profile_contacts_and_contact_cards.sql (guarded named-check
--                                             constraint pattern for ALTER TABLE)
--   20260311000000_networking_helpers.sql   (mark_conversation_read original
--                                             signature/behavior to preserve)


-- ============================================================
-- ALTER TABLE: public.conversations
-- ============================================================

alter table public.conversations
add column if not exists conversation_type text not null default 'direct';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversations_conversation_type_check'
  ) then
    alter table public.conversations
    add constraint conversations_conversation_type_check
    check (conversation_type in ('direct', 'group'));
  end if;
end
$$;

alter table public.conversations
add column if not exists title text;

alter table public.conversations
add column if not exists avatar_url text;


-- ============================================================
-- ALTER TABLE: public.conversation_participants
-- ============================================================

alter table public.conversation_participants
add column if not exists last_read_at timestamptz;

-- One-shot backfill: derive each participant's last_read_at from the latest
-- message that had already been marked read under the old read_at-only
-- scheme, so existing direct conversations don't appear fully unread.
update public.conversation_participants cp
set last_read_at = (
  select max(m.sent_at)
  from public.messages m
  where m.conversation_id = cp.conversation_id
    and m.read_at is not null
)
where cp.last_read_at is null;

create index if not exists conversation_participants_profile_idx
  on public.conversation_participants (profile_id);


-- ============================================================
-- RPC: public.fetch_inbox_conversations
--
-- Unified inbox list covering both direct and group conversations for the
-- calling user. For direct conversations, other_profile_id/display_title/
-- avatar_url resolve from the other participant's profile; for group
-- conversations, other_profile_id is null and display_title/avatar_url fall
-- back to the conversation's own title/avatar_url (or 'Conversazione').
-- unread_count compares each message's sent_at against the caller's
-- last_read_at (never null after the backfill above, but coalesced
-- defensively for participants who join after this migration without an
-- explicit value).
-- ============================================================

drop function if exists public.fetch_inbox_conversations(int, int);

create or replace function public.fetch_inbox_conversations(
  p_limit  int default 50,
  p_offset int default 0
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
  unread_count                   bigint
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
    coalesce(unread_summary.unread_count, 0)                         as unread_count
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
  order by coalesce(last_message.sent_at, c.created_at) desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.fetch_inbox_conversations(int, int) from public;
grant execute on function public.fetch_inbox_conversations(int, int) to authenticated;


-- ============================================================
-- RPC: public.mark_conversation_read (create or replace, same signature)
--
-- Always advances the caller's own last_read_at (drives the unread badge for
-- both direct and group conversations via fetch_inbox_conversations). The
-- legacy per-message read_at receipt is still updated, but only for direct
-- conversations: group messages must never be marked as read "for everyone"
-- by a single participant opening the thread.
-- ============================================================

create or replace function public.mark_conversation_read(target_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id      uuid := auth.uid();
  v_conversation_type      text;
  updated_messages         integer := 0;
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

  select c.conversation_type
  into v_conversation_type
  from public.conversations c
  where c.id = target_conversation_id;

  update public.conversation_participants participant
  set last_read_at = timezone('utc', now())
  where participant.conversation_id = target_conversation_id
    and participant.profile_id = current_profile_id;

  if v_conversation_type = 'direct' then
    update public.messages message
    set read_at = timezone('utc', now())
    where message.conversation_id = target_conversation_id
      and message.sender_profile_id <> current_profile_id
      and message.read_at is null;

    get diagnostics updated_messages = row_count;
  end if;

  return updated_messages;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
