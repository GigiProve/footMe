-- Migration: user_blocks table + is_direct_conversation_blocked() helper +
-- block_user/unblock_user RPCs. First piece of MES-02 (open, social 1:1
-- messaging): blocking is invisible to the blocked party — they simply see
-- their message sends silently rejected by RLS, never a "blocked_by_other"
-- flag (decision taken with the user, see MES-02 plan).
--
-- Mirrors conventions from:
--   20260309000001_rls_policies.sql (is_current_user/is_conversation_participant
--                                     helpers, messages INSERT policy rebuilt below)
--   20260619100000_content_tag_states_targets_reports.sql (reports table:
--                                     SELECT-only RLS, writes via RPC only)


-- ============================================================
-- TABLE: public.user_blocks
-- ============================================================

create table if not exists public.user_blocks (
  blocker_profile_id uuid        not null references public.profiles(id) on delete cascade,
  blocked_profile_id uuid        not null references public.profiles(id) on delete cascade,
  created_at         timestamptz not null default timezone('utc', now()),

  primary key (blocker_profile_id, blocked_profile_id),

  constraint user_blocks_not_self
    check (blocker_profile_id <> blocked_profile_id)
);

create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_profile_id);

alter table public.user_blocks enable row level security;

-- Only the blocker can see their own block rows. No INSERT/DELETE policy:
-- all writes go through block_user()/unblock_user() below.
drop policy if exists "blocker can view own blocks" on public.user_blocks;
create policy "blocker can view own blocks"
  on public.user_blocks
  for select
  to authenticated
  using (public.is_current_user(blocker_profile_id));


-- ============================================================
-- HELPER: public.is_direct_conversation_blocked
--
-- True when a user_blocks row exists in either direction between the
-- caller and the other participant of a direct conversation. Security
-- definer so it can read user_blocks rows the caller isn't the blocker of
-- (e.g. when the blocked party is the one attempting to send a message).
-- Only meaningful for conversation_type = 'direct' (group chats never block).
--
-- Requires the caller to actually be a participant of target_conversation_id:
-- without this, a non-participant could probe arbitrary conversation ids and
-- learn whether they block/are blocked by one of that conversation's real
-- participants, which is a block-relationship info leak. Participants get
-- identical behavior to before this hardening.
-- ============================================================

create or replace function public.is_direct_conversation_blocked(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations conversation
    join public.conversation_participants caller_participant
      on caller_participant.conversation_id = conversation.id
     and caller_participant.profile_id = auth.uid()
    join public.conversation_participants other_participant
      on other_participant.conversation_id = conversation.id
     and other_participant.profile_id <> auth.uid()
    join public.user_blocks block_row
      on (block_row.blocker_profile_id = auth.uid() and block_row.blocked_profile_id = other_participant.profile_id)
      or (block_row.blocker_profile_id = other_participant.profile_id and block_row.blocked_profile_id = auth.uid())
    where conversation.id = target_conversation_id
      and conversation.conversation_type = 'direct'
  );
$$;

revoke all on function public.is_direct_conversation_blocked(uuid) from public;
grant execute on function public.is_direct_conversation_blocked(uuid) to authenticated;


-- ============================================================
-- RPC: public.block_user / public.unblock_user
-- ============================================================

create or replace function public.block_user(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
begin
  if current_profile_id is null then
    raise exception 'Authentication required';
  end if;

  if target_profile_id is null then
    raise exception 'Profilo da bloccare non specificato';
  end if;

  if current_profile_id = target_profile_id then
    raise exception 'Non puoi bloccare te stesso';
  end if;

  insert into public.user_blocks (blocker_profile_id, blocked_profile_id)
  values (current_profile_id, target_profile_id)
  on conflict (blocker_profile_id, blocked_profile_id) do nothing;
end;
$$;

revoke all on function public.block_user(uuid) from public;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
begin
  if current_profile_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.user_blocks
  where blocker_profile_id = current_profile_id
    and blocked_profile_id = target_profile_id;
end;
$$;

revoke all on function public.unblock_user(uuid) from public;
grant execute on function public.unblock_user(uuid) to authenticated;


-- ============================================================
-- Rebuild: messages INSERT policy adds the block gate.
-- Original policy defined in 20260309000001_rls_policies.sql.
-- ============================================================

drop policy if exists "participants can send messages" on public.messages;
create policy "participants can send messages"
on public.messages
for insert
to authenticated
with check (
  public.is_conversation_participant(conversation_id)
  and public.is_current_user(sender_profile_id)
  and not public.is_direct_conversation_blocked(conversation_id)
);
