-- Migration: add moderation status column to the three content-tag tables
-- and give tagged users an UPDATE policy to moderate their own tag row.
--
-- Verified state from source migrations:
--   club_media_tagged_profiles       (20260514001000): PK (post_id, profile_id),
--                                    RLS enabled, select + owner-all policies present.
--   fan_tribuna_tagged_players       (20260515030000): PK id uuid, keyed on
--                                    player_profile_id, RLS enabled, select +
--                                    fan-owner-all policies present.
--   media_profile_post_tagged_targets (20260519090000): PK (post_id, target_type,
--                                    target_id), RLS enabled, select +
--                                    media-owner-all policies present.
-- No RLS enable or new SELECT policy is needed; only the status column and
-- tagged-user UPDATE policies are added.

-- -----------------------------------------------------------------------
-- club_media_tagged_profiles
-- -----------------------------------------------------------------------
alter table public.club_media_tagged_profiles
  add column if not exists status text not null default 'active'
  check (status in ('active', 'hidden', 'reported'));

create policy "tagged user can moderate own club media tag"
  on public.club_media_tagged_profiles
  for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- -----------------------------------------------------------------------
-- fan_tribuna_tagged_players
-- -----------------------------------------------------------------------
alter table public.fan_tribuna_tagged_players
  add column if not exists status text not null default 'active'
  check (status in ('active', 'hidden', 'reported'));

create policy "tagged user can moderate own fan tribuna tag"
  on public.fan_tribuna_tagged_players
  for update
  to authenticated
  using (player_profile_id = auth.uid())
  with check (player_profile_id = auth.uid());

-- -----------------------------------------------------------------------
-- media_profile_post_tagged_targets
-- -----------------------------------------------------------------------
alter table public.media_profile_post_tagged_targets
  add column if not exists status text not null default 'active'
  check (status in ('active', 'hidden', 'reported'));

create policy "tagged user can moderate own media profile tag"
  on public.media_profile_post_tagged_targets
  for update
  to authenticated
  using (target_type = 'profile' and target_id = auth.uid())
  with check (target_type = 'profile' and target_id = auth.uid());
