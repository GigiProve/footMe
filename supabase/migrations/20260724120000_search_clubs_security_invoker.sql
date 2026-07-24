-- Migration: CER-03 fix — run search_clubs_page as the CALLING user.
--
-- Symptom: Cerca → Società returned no società (clubs), while the search still
-- worked for profiles, and clubs were clearly present (visible via the direct
-- "Società da seguire" read and via club_teams).
--
-- Root cause: the `clubs` RLS SELECT policy is scoped to a role —
--   create policy "clubs are readable by authenticated users"
--     on public.clubs for select TO authenticated using (true);
-- but `search_clubs_page` was SECURITY DEFINER, so it executed as its owner
-- role (not `authenticated`). On hosted Postgres that owner does not satisfy a
-- `TO authenticated` policy and does not bypass RLS, so the `clubs` read
-- returned 0 rows. `club_teams` still appeared because its policy is
-- `using (true)` (unrestricted), which is also why teams were readable by anon
-- while clubs were not. `search_profiles_page` is unaffected because it reads
-- the `profiles_with_age` view (which is granted to authenticated), not the
-- base table directly.
--
-- Fix: run the function as the invoker. Every table it reads — clubs,
-- club_teams, club_affiliations, recruiting_ads, club_follows, saved_clubs,
-- profiles — is already readable by the authenticated user directly (the app
-- reads all of them from the client), so SECURITY INVOKER is correct and
-- sufficient, and matches the working direct-read path.

alter function public.search_clubs_page(text, text, jsonb, text, int, int)
  security invoker;
