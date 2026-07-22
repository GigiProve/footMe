-- Migration: open_direct_conversation() — MES-02's ungated replacement for
-- start_direct_conversation(). Anyone can open a 1:1 chat with anyone else;
-- the only hard stop is an existing user_blocks row on a brand-new thread
-- (reopening an already-blocked thread still returns the existing id so
-- history stays readable — sending is what RLS stops, per
-- is_direct_conversation_blocked() from 20260718090400).
--
-- Also introduces conversations.context_application_id so "Contatta" from a
-- recruiting application can carry the ad/candidacy context into the chat
-- (surfaced later by fetch_direct_conversation_meta in 20260718090800).
--
-- Mirrors conventions from:
--   20260311000000_networking_helpers.sql / 20260313000005_remote_schema_sync.sql
--     (start_direct_conversation's exact-2-party dedup shape — NOT type-scoped
--      there, so it is not copied verbatim: this version adds
--      conversation_type = 'direct' to the dedup predicate)
--   20260309000000_initial_schema.sql (recruiting_applications/recruiting_ads/
--      clubs shapes used to validate p_application_id)


-- ============================================================
-- ALTER TABLE: public.conversations
-- ============================================================

alter table public.conversations
add column if not exists context_application_id uuid
  references public.recruiting_applications(id) on delete set null;

create index if not exists conversations_context_application_idx
  on public.conversations (context_application_id)
  where context_application_id is not null;


-- ============================================================
-- RPC: public.open_direct_conversation
-- ============================================================

create or replace function public.open_direct_conversation(
  target_profile_id uuid,
  p_application_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id        uuid := auth.uid();
  existing_conversation_id  uuid;
  result_conversation_id    uuid;
  v_validated_application_id uuid;
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

  -- Serialize concurrent opens between this exact pair of profiles: without
  -- this, two simultaneous open_direct_conversation calls for the same pair
  -- can both miss the dedup lookup below (neither sees the other's
  -- not-yet-committed insert) and create duplicate direct threads. The lock
  -- key is order-independent (least/greatest) so an A->B call and a B->A
  -- call contend on the same advisory lock; it's transaction-scoped, so it
  -- releases automatically on commit or rollback.
  perform pg_advisory_xact_lock(
    hashtextextended(
      least(current_profile_id, target_profile_id)::text || ':' || greatest(current_profile_id, target_profile_id)::text,
      0
    )
  );

  -- Validate the application context up front: it must link the two
  -- parties (one is the applicant, the other owns the club behind the ad).
  -- An invalid/foreign application id is ignored silently — it never fails
  -- the call, it just means no context gets attached.
  if p_application_id is not null then
    select application.id
    into v_validated_application_id
    from public.recruiting_applications application
    join public.recruiting_ads ad on ad.id = application.ad_id
    join public.clubs club on club.id = ad.club_id
    where application.id = p_application_id
      and (
        (application.applicant_profile_id = current_profile_id and club.owner_profile_id = target_profile_id)
        or (application.applicant_profile_id = target_profile_id and club.owner_profile_id = current_profile_id)
      );
  end if;

  -- Type-scoped exact-2-party dedup. The legacy start_direct_conversation
  -- predicate below is NOT scoped to conversation_type, so it is
  -- deliberately not reused verbatim here.
  select conversation.id
  into existing_conversation_id
  from public.conversations conversation
  where conversation.conversation_type = 'direct'
    and exists (
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
  order by conversation.created_at
  limit 1;

  if existing_conversation_id is not null then
    update public.conversations conversation
    set context_application_id = coalesce(conversation.context_application_id, v_validated_application_id)
    where conversation.id = existing_conversation_id;

    -- Reopening a thread never fails, even if the two parties have since
    -- blocked each other: history stays readable, sending is stopped by RLS.
    return existing_conversation_id;
  end if;

  -- No existing thread: a block in either direction stops a brand-new one
  -- from being created.
  if exists (
    select 1
    from public.user_blocks block_row
    where (block_row.blocker_profile_id = current_profile_id and block_row.blocked_profile_id = target_profile_id)
       or (block_row.blocker_profile_id = target_profile_id and block_row.blocked_profile_id = current_profile_id)
  ) then
    raise exception 'Non puoi avviare una conversazione con questo profilo';
  end if;

  insert into public.conversations (created_by_profile_id, conversation_type, context_application_id)
  values (current_profile_id, 'direct', v_validated_application_id)
  returning id into result_conversation_id;

  insert into public.conversation_participants (conversation_id, profile_id)
  values
    (result_conversation_id, current_profile_id),
    (result_conversation_id, target_profile_id);

  return result_conversation_id;
end;
$$;

revoke all on function public.open_direct_conversation(uuid, uuid) from public;
grant execute on function public.open_direct_conversation(uuid, uuid) to authenticated;


-- ============================================================
-- RPC: public.start_direct_conversation (kept, now a thin delegate)
--
-- Retrocompatibility for any remaining caller of the old signature: the
-- connection-gate behavior is gone, this just forwards to
-- open_direct_conversation with no application context.
-- ============================================================

create or replace function public.start_direct_conversation(target_profile_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.open_direct_conversation(target_profile_id, null);
$$;

revoke all on function public.start_direct_conversation(uuid) from public;
grant execute on function public.start_direct_conversation(uuid) to authenticated;
