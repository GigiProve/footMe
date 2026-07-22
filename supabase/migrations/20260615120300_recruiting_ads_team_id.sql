-- Migration: add optional team_id to recruiting_ads so an ad can target
-- a specific team within the club (e.g. a youth squad).
-- Existing RLS policies key on owns_club(club_id) and are unaffected.

alter table public.recruiting_ads
  add column if not exists team_id uuid references public.club_teams(id) on delete set null;

create index if not exists recruiting_ads_team_idx
  on public.recruiting_ads (team_id);
