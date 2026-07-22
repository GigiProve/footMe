-- Migration: MES-03 Centro Notifiche — per-profile notification preferences.
--
-- One row per profile with a boolean toggle per gated notification group.
-- A missing row or an explicit `true` column both mean "deliver" — see the
-- gating trigger installed in 20260719090100_notification_categories.sql.
-- RPCs lazily create the row with all-true defaults on first read/write, so
-- the client never has to special-case "no preferences yet".
--
-- Mirrors conventions from:
--   20260627090100_saved_following_rpcs.sql (RPC style, security definer)
--   20260309000000_initial_schema.sql       (public.set_updated_at trigger)

create table if not exists public.notification_preferences (
  profile_id     uuid primary key references public.profiles(id) on delete cascade,
  requests       boolean not null default true,
  applications   boolean not null default true,
  content_tags   boolean not null default true,
  new_followers  boolean not null default true,
  store          boolean not null default true,
  promotions     boolean not null default true,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);

alter table public.notification_preferences enable row level security;

drop policy if exists "owner reads own notification preferences" on public.notification_preferences;
create policy "owner reads own notification preferences"
on public.notification_preferences
for select
to authenticated
using (public.is_current_user(profile_id));

drop policy if exists "owner inserts own notification preferences" on public.notification_preferences;
create policy "owner inserts own notification preferences"
on public.notification_preferences
for insert
to authenticated
with check (public.is_current_user(profile_id));

drop policy if exists "owner updates own notification preferences" on public.notification_preferences;
create policy "owner updates own notification preferences"
on public.notification_preferences
for update
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();


-- ============================================================
-- RPC: public.fetch_my_notification_preferences
--
-- Returns the caller's single preferences row, inserting the all-true
-- default row first when the caller has none yet.
-- ============================================================

drop function if exists public.fetch_my_notification_preferences();

create or replace function public.fetch_my_notification_preferences()
returns table (
  profile_id     uuid,
  requests       boolean,
  applications   boolean,
  content_tags   boolean,
  new_followers  boolean,
  store          boolean,
  promotions     boolean
)
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

  insert into public.notification_preferences (profile_id)
  values (v_uid)
  on conflict (profile_id) do nothing;

  return query
  select
    np.profile_id,
    np.requests,
    np.applications,
    np.content_tags,
    np.new_followers,
    np.store,
    np.promotions
  from public.notification_preferences np
  where np.profile_id = v_uid;
end;
$$;

revoke all on function public.fetch_my_notification_preferences() from public;
grant execute on function public.fetch_my_notification_preferences() to authenticated;


-- ============================================================
-- RPC: public.set_notification_preference
--
-- Upserts the caller's row (all-true defaults) then toggles a single
-- column. p_key is validated against a fixed whitelist before being used
-- as an identifier in the dynamic UPDATE, so this is not injectable.
-- ============================================================

drop function if exists public.set_notification_preference(text, boolean);

create or replace function public.set_notification_preference(
  p_key   text,
  p_value boolean
)
returns void
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

  if p_key not in ('requests', 'applications', 'content_tags', 'new_followers', 'store', 'promotions') then
    raise exception 'Chiave preferenza non valida: %', p_key;
  end if;

  insert into public.notification_preferences (profile_id)
  values (v_uid)
  on conflict (profile_id) do nothing;

  execute format(
    'update public.notification_preferences set %I = $1 where profile_id = $2',
    p_key
  )
  using p_value, v_uid;
end;
$$;

revoke all on function public.set_notification_preference(text, boolean) from public;
grant execute on function public.set_notification_preference(text, boolean) to authenticated;
