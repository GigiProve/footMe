-- Each club_admin can own at most one club.
-- This also allows the client to use upsert with onConflict: "owner_profile_id".
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clubs_owner_profile_id_key'
  ) then
    alter table public.clubs add constraint clubs_owner_profile_id_key unique (owner_profile_id);
  end if;
end $$;
