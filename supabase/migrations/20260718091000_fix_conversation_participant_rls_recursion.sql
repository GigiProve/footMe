-- Migration: fix infinite recursion in public.is_conversation_participant().
--
-- Pre-existing bug, present since 20260309000001_rls_policies.sql (well
-- before MES-02, unrelated to the 6 migrations above): is_conversation_participant()
-- is a plain (non security definer) SQL function that queries
-- conversation_participants — but conversation_participants' OWN SELECT
-- policy ("participant rows visible to conversation members") evaluates
-- is_conversation_participant() again for every candidate row. For any real
-- "authenticated" caller (RLS is not bypassed the way it is for a table
-- owner/superuser), Postgres inlines the function into the policy check,
-- which cascades into unbounded recursion and a hard "stack depth limit
-- exceeded" error instead of Postgres's usual clean "infinite recursion
-- detected in policy" message (the self-reference is hidden behind a
-- function-call boundary, so the planner's same-query recursion guard never
-- sees it).
--
-- Verified locally against a Supabase-shaped Postgres 17 instance that this
-- reproduces with ZERO MES-02 changes applied (i.e. against the original,
-- unmodified "participants can send messages" INSERT policy exactly as
-- shipped) — every non-superuser INSERT into messages, and by extension
-- every SELECT against conversations/conversation_participants/messages
-- that depends on this helper, is broken today. It would also break the new
-- chat-media storage.objects policies from 20260718090900_chat_attachments.sql,
-- which reuse this same helper. That is what surfaced it during MES-02
-- verification, but the root cause predates and is independent of MES-02.
--
-- Fix mirrors the exact precedent already used for is_admin() in
-- 20260319400000_fix_admin_rls_recursion.sql: make the helper SECURITY
-- DEFINER so its internal query bypasses RLS instead of re-triggering the
-- policy that calls it. Same signature, same return semantics for callers —
-- purely an RLS-bypass fix on the function's own body.

create or replace function public.is_conversation_participant(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = target_conversation_id
      and participant.profile_id = auth.uid()
  );
$$;
