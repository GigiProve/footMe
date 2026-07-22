-- Migration: MES-03 Centro Notifiche — notification categories + preference
-- gating trigger.
--
-- Adds `category` to public.notifications for tab-style grouping in the
-- client (richieste | candidature | attivita | store | sistema), backfills
-- existing rows, and installs a BEFORE INSERT trigger that:
--   1. Always (re)derives NEW.category from NEW.type — ignoring any
--      caller-supplied value, so category can never drift from type.
--   2. Resolves the gating preference key for NEW.type, if any, and skips
--      the insert entirely (RETURN NULL) when the recipient has explicitly
--      turned that preference off. A missing preferences row, an explicit
--      `true`, or a type that maps to no preference key (sistema/security
--      types) all mean "deliver".
--
-- security definer is required: the caller creating a notification (e.g.
-- another user's agent_representation_request, or a follow trigger) is
-- typically not the recipient, so the trigger must be able to read the
-- recipient's own notification_preferences row regardless of that table's
-- owner-only RLS policies.

alter table public.notifications
  add column if not exists category text;

update public.notifications
set category = case type
  when 'agent_representation_request'            then 'richieste'
  when 'agent_representation_responded'          then 'richieste'
  when 'agent_representation_removed'            then 'richieste'
  when 'agent_representation_visibility_proposed' then 'richieste'
  when 'member_joined'                            then 'richieste'
  when 'roster_assignment_responded'              then 'richieste'
  when 'application_received'                     then 'candidature'
  when 'application_status'                       then 'candidature'
  when 'content_tag'                              then 'attivita'
  when 'new_follower'                             then 'attivita'
  else 'sistema'
end
where category is null;

create index if not exists notifications_recipient_category_idx
  on public.notifications (recipient_profile_id, category, is_read, created_at desc);

create or replace function public.notifications_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pref_key text;
  v_enabled  boolean;
begin
  -- 1. Category is always derived server-side from type.
  new.category := case new.type
    when 'agent_representation_request'            then 'richieste'
    when 'agent_representation_responded'          then 'richieste'
    when 'agent_representation_removed'            then 'richieste'
    when 'agent_representation_visibility_proposed' then 'richieste'
    when 'member_joined'                            then 'richieste'
    when 'roster_assignment_responded'              then 'richieste'
    when 'application_received'                     then 'candidature'
    when 'application_status'                       then 'candidature'
    when 'content_tag'                              then 'attivita'
    when 'new_follower'                             then 'attivita'
    else 'sistema'
  end;

  -- 2. Resolve the gating preference key for this type, if any.
  --    Types not listed here (sistema/security types) are never gated:
  --    v_pref_key stays null and the insert always proceeds.
  v_pref_key := case new.type
    when 'agent_representation_request'            then 'requests'
    when 'agent_representation_responded'          then 'requests'
    when 'agent_representation_removed'            then 'requests'
    when 'agent_representation_visibility_proposed' then 'requests'
    when 'member_joined'                            then 'requests'
    when 'roster_assignment_responded'              then 'requests'
    when 'application_received'                     then 'applications'
    when 'application_status'                       then 'applications'
    when 'content_tag'                              then 'content_tags'
    when 'new_follower'                             then 'new_followers'
    when 'promo'                                    then 'promotions'
    else null
  end;

  if v_pref_key is not null then
    select case v_pref_key
      when 'requests'      then requests
      when 'applications'  then applications
      when 'content_tags'  then content_tags
      when 'new_followers' then new_followers
      when 'store'         then store
      when 'promotions'    then promotions
    end
    into v_enabled
    from public.notification_preferences
    where profile_id = new.recipient_profile_id;

    -- No preferences row (v_enabled stays null) or explicit true => deliver.
    -- Explicit false => skip the insert.
    if v_enabled is false then
      return null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_before_insert on public.notifications;
create trigger notifications_before_insert
  before insert on public.notifications
  for each row execute function public.notifications_before_insert();
