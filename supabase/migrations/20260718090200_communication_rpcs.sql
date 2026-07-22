-- Migration: Communications RPCs — all reads of public.communications /
-- public.communication_recipients (list, detail, mark-one-read) plus the
-- combined mark-everything-read action for the Messaggi inbox.
--
-- All functions are SECURITY DEFINER; RLS on communications /
-- communication_recipients only allows a recipient (or club owner) to read
-- their own rows, and there is no authenticated UPDATE policy on
-- communication_recipients at all — read-state changes go exclusively
-- through mark_communication_read / mark_inbox_all_read below.
--
-- Mirrors conventions from:
--   20260717090200_shortlist_rpcs.sql (plpgsql, security definer, v_uid /
--                                       auth check, drop-before-create,
--                                       revoke all + grant to authenticated)


-- ============================================================
-- RPC: public.fetch_communications
--
-- Recipient's inbox list, no filter/search params (client filters/searches
-- client-side over the fetched page). preview truncates body to 160 chars.
-- ============================================================

drop function if exists public.fetch_communications(int, int);

create or replace function public.fetch_communications(
  p_limit  int default 50,
  p_offset int default 0
)
returns table (
  communication_id uuid,
  category          text,
  title             text,
  preview           text,
  sender_club_id    uuid,
  sender_name       text,
  sender_logo_url   text,
  cta_label         text,
  cta_url           text,
  published_at      timestamptz,
  is_read           boolean
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
    c.id                  as communication_id,
    c.category,
    c.title,
    left(c.body, 160)     as preview,
    c.sender_club_id,
    club.name             as sender_name,
    club.logo_url         as sender_logo_url,
    c.cta_label,
    c.cta_url,
    c.published_at,
    r.read_at is not null as is_read
  from public.communication_recipients r
  join public.communications c
    on c.id = r.communication_id
  join public.clubs club
    on club.id = c.sender_club_id
  where r.profile_id = v_uid
  order by c.published_at desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.fetch_communications(int, int) from public;
grant execute on function public.fetch_communications(int, int) to authenticated;


-- ============================================================
-- RPC: public.fetch_communication_detail
--
-- Single communication, full body. Raises when the caller has no recipient
-- row for it (not fanned out to them / doesn't exist), mirroring the
-- "Lista non trovata" guard pattern from fetch_shortlist_entries.
-- ============================================================

drop function if exists public.fetch_communication_detail(uuid);

create or replace function public.fetch_communication_detail(
  p_communication_id uuid
)
returns table (
  communication_id uuid,
  category          text,
  title             text,
  body              text,
  audience_label    text,
  sender_club_id    uuid,
  sender_name       text,
  sender_logo_url   text,
  cta_label         text,
  cta_url           text,
  published_at      timestamptz,
  read_at           timestamptz,
  recipient_count   bigint
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

  if not exists (
    select 1
    from public.communication_recipients r
    where r.communication_id = p_communication_id
      and r.profile_id = v_uid
  ) then
    raise exception 'Comunicazione non trovata';
  end if;

  return query
  select
    c.id                as communication_id,
    c.category,
    c.title,
    c.body,
    c.audience_label,
    c.sender_club_id,
    club.name           as sender_name,
    club.logo_url       as sender_logo_url,
    c.cta_label,
    c.cta_url,
    c.published_at,
    r.read_at,
    (
      select count(*)::bigint
      from public.communication_recipients r2
      where r2.communication_id = c.id
    )                   as recipient_count
  from public.communications c
  join public.clubs club
    on club.id = c.sender_club_id
  join public.communication_recipients r
    on r.communication_id = c.id
    and r.profile_id = v_uid
  where c.id = p_communication_id;
end;
$$;

revoke all on function public.fetch_communication_detail(uuid) from public;
grant execute on function public.fetch_communication_detail(uuid) to authenticated;


-- ============================================================
-- RPC: public.mark_communication_read
--
-- Marks a single communication read for the caller. Returns whether the
-- update actually changed a row (false both when the caller is not a
-- recipient and when it was already read) — an idempotent, silent no-op
-- rather than raising, since re-marking an already-read item is a normal
-- client flow.
-- ============================================================

drop function if exists public.mark_communication_read(uuid);

create or replace function public.mark_communication_read(
  p_communication_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  update public.communication_recipients
  set read_at = timezone('utc', now())
  where communication_id = p_communication_id
    and profile_id = v_uid
    and read_at is null;

  return found;
end;
$$;

revoke all on function public.mark_communication_read(uuid) from public;
grant execute on function public.mark_communication_read(uuid) to authenticated;


-- ============================================================
-- RPC: public.mark_inbox_all_read
--
-- Combined "mark everything read" action for the Messaggi inbox: advances
-- last_read_at on every conversation the caller participates in, marks
-- direct-conversation messages as read (mirrors mark_conversation_read's
-- direct-only read_at semantics — group messages are never marked read for
-- everyone by one participant), and marks all communications read. Returns
-- the total number of rows changed across the three updates.
-- ============================================================

drop function if exists public.mark_inbox_all_read();

create or replace function public.mark_inbox_all_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid                uuid := auth.uid();
  v_conversations_count integer := 0;
  v_messages_count      integer := 0;
  v_communications_count integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  update public.conversation_participants
  set last_read_at = timezone('utc', now())
  where profile_id = v_uid;

  get diagnostics v_conversations_count = row_count;

  update public.messages m
  set read_at = timezone('utc', now())
  where m.read_at is null
    and m.sender_profile_id <> v_uid
    and m.conversation_id in (
      select cp.conversation_id
      from public.conversation_participants cp
      where cp.profile_id = v_uid
    )
    and exists (
      select 1
      from public.conversations c
      where c.id = m.conversation_id
        and c.conversation_type = 'direct'
    );

  get diagnostics v_messages_count = row_count;

  update public.communication_recipients
  set read_at = timezone('utc', now())
  where profile_id = v_uid
    and read_at is null;

  get diagnostics v_communications_count = row_count;

  return v_conversations_count + v_messages_count + v_communications_count;
end;
$$;

revoke all on function public.mark_inbox_all_read() from public;
grant execute on function public.mark_inbox_all_read() to authenticated;
