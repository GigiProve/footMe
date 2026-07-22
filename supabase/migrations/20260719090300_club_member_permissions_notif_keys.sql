-- Migration: MES-03 Centro Notifiche — extend club_member_permissions with
-- the "Notifiche operative" permission group, allowing a club owner to
-- delegate which operational notification types a staff member receives.
--
-- Per the extensibility convention documented in
-- 20260717090000_club_member_permissions.sql, future permission groups
-- extend the permission_key CHECK via drop + re-add rather than editing the
-- original migration. The existing shortlist_* keys are preserved verbatim.
--
-- No new RLS or RPC is needed: the existing owner-only INSERT/DELETE
-- policies on club_member_permissions already cover any permission_key
-- value, so the client reuses the generic grant/revoke via direct table
-- access for these new keys too.

alter table public.club_member_permissions
  drop constraint if exists club_member_permissions_key_check;

alter table public.club_member_permissions
  add constraint club_member_permissions_key_check
  check (permission_key in (
    'shortlist_view',
    'shortlist_create_lists',
    'shortlist_add_profiles',
    'shortlist_add_notes',
    'shortlist_edit_status',
    'shortlist_remove_profiles',
    'notif_new_applications',
    'notif_shortlist_updates',
    'notif_connection_requests',
    'notif_store_orders',
    'notif_content_tags',
    'notif_affiliations',
    'notif_profile_verifications'
  ));
