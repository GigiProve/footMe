-- Migration: MES-03 Centro Notifiche — "new follower" notification producers
-- (profile follows + club follows) and bulk read/cleanup action RPCs.
--
-- Both AFTER INSERT triggers simply insert into public.notifications; the
-- BEFORE INSERT trigger from 20260719090100_notification_categories.sql
-- handles category derivation and preference gating automatically for
-- every row inserted here.
--
-- Client follow upserts use ON CONFLICT DO NOTHING (ignoreDuplicates), so
-- these AFTER INSERT triggers only fire for genuinely new follow rows —
-- re-following after an unfollow/re-follow cycle is a new row and will
-- notify again, which matches existing follow semantics.

-- ============================================================
-- TRIGGER: notify on public.profile_follows insert
-- ============================================================

create or replace function public.profile_follows_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_follower_name text;
begin
  if new.follower_profile_id = new.followed_profile_id then
    return new;
  end if;

  select full_name into v_follower_name
  from public.profiles
  where id = new.follower_profile_id;

  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    new.followed_profile_id,
    'new_follower',
    'Nuovo follower',
    coalesce(v_follower_name, 'Un utente') || ' ha iniziato a seguirti',
    jsonb_build_object(
      'follower_profile_id', new.follower_profile_id::text,
      'target_type', 'profile'
    )
  );

  return new;
end;
$$;

drop trigger if exists profile_follows_notify_follower on public.profile_follows;
create trigger profile_follows_notify_follower
  after insert on public.profile_follows
  for each row execute function public.profile_follows_notify();


-- ============================================================
-- TRIGGER: notify on public.club_follows insert
-- ============================================================

create or replace function public.club_follows_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner         uuid;
  v_follower_name text;
begin
  select owner_profile_id into v_owner
  from public.clubs
  where id = new.club_id;

  if v_owner is null or v_owner = new.profile_id then
    return new;
  end if;

  select full_name into v_follower_name
  from public.profiles
  where id = new.profile_id;

  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    v_owner,
    'new_follower',
    'Nuovo follower',
    coalesce(v_follower_name, 'Un utente') || ' ha iniziato a seguire la tua società',
    jsonb_build_object(
      'follower_profile_id', new.profile_id::text,
      'target_type', 'club',
      'club_id', new.club_id::text
    )
  );

  return new;
end;
$$;

drop trigger if exists club_follows_notify_owner on public.club_follows;
create trigger club_follows_notify_owner
  after insert on public.club_follows
  for each row execute function public.club_follows_notify();


-- ============================================================
-- RPC: public.mark_all_notifications_read
--
-- Marks every unread notification of the caller as read.
-- Returns the number of rows updated.
-- ============================================================

drop function if exists public.mark_all_notifications_read();

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  update public.notifications
  set is_read = true
  where recipient_profile_id = v_uid
    and is_read = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;


-- ============================================================
-- RPC: public.delete_read_notifications
--
-- Deletes every read notification of the caller. There is no DELETE
-- policy on public.notifications, so this security definer RPC — scoped
-- to auth.uid() in its WHERE clause — is the only supported way to clear
-- read notifications.
-- Returns the number of rows deleted.
-- ============================================================

drop function if exists public.delete_read_notifications();

create or replace function public.delete_read_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  delete from public.notifications
  where recipient_profile_id = v_uid
    and is_read = true;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.delete_read_notifications() from public;
grant execute on function public.delete_read_notifications() to authenticated;
