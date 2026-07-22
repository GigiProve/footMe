import { supabase } from "../../lib/supabase";

export type ShortlistPermissionKey =
  | "shortlist_view"
  | "shortlist_create_lists"
  | "shortlist_add_profiles"
  | "shortlist_add_notes"
  | "shortlist_edit_status"
  | "shortlist_remove_profiles";

export const SHORTLIST_PERMISSION_LABELS: Record<ShortlistPermissionKey, string> = {
  shortlist_add_notes: "Aggiungere note interne",
  shortlist_add_profiles: "Aggiungere profili",
  shortlist_create_lists: "Creare liste",
  shortlist_edit_status: "Modificare stato valutazione",
  shortlist_remove_profiles: "Rimuovere profili",
  shortlist_view: "Vedere shortlist",
};

export type ClubNotifPermissionKey =
  | "notif_new_applications"
  | "notif_shortlist_updates"
  | "notif_connection_requests"
  | "notif_store_orders"
  | "notif_content_tags"
  | "notif_affiliations"
  | "notif_profile_verifications";

export const CLUB_NOTIF_PERMISSION_LABELS: Record<
  ClubNotifPermissionKey,
  string
> = {
  notif_affiliations: "Affiliazioni",
  notif_connection_requests: "Richieste collegamenti",
  notif_content_tags: "Tag contenuti",
  notif_new_applications: "Nuove candidature",
  notif_profile_verifications: "Verifiche profilo",
  notif_shortlist_updates: "Aggiornamenti Shortlist",
  notif_store_orders: "Nuovi ordini Store",
};

// Any grantable permission key stored in club_member_permissions.
export type ClubPermissionKey = ShortlistPermissionKey | ClubNotifPermissionKey;

export type MyShortlistPermissions = {
  club_id: string;
  club_name: string;
  is_owner: boolean;
  can_view: boolean;
  can_create_lists: boolean;
  can_add_profiles: boolean;
  can_add_notes: boolean;
  can_edit_status: boolean;
  can_remove_profiles: boolean;
};

export type ClubPermissionMember = {
  member_id: string;
  profile_id: string;
  full_name: string | null;
  avatar_url: string | null;
  member_role: string;
  permissions: ClubPermissionKey[];
};

export async function fetchMyShortlistPermissions(): Promise<MyShortlistPermissions | null> {
  const { data, error } = await supabase.rpc("fetch_my_shortlist_permissions");

  if (error) {
    throw error;
  }

  return (data?.[0] as MyShortlistPermissions | undefined) ?? null;
}

export async function fetchClubPermissionMembers(
  clubId: string,
): Promise<ClubPermissionMember[]> {
  const [
    { data: members, error: membersError },
    { data: grants, error: grantsError },
  ] = await Promise.all([
    supabase
      .from("club_members")
      .select("id, profile_id, member_role, profiles(full_name, avatar_url)")
      .eq("club_id", clubId)
      .eq("status", "active")
      .not("profile_id", "is", null),
    supabase
      .from("club_member_permissions")
      .select("profile_id, permission_key")
      .eq("club_id", clubId),
  ]);

  if (membersError) {
    throw membersError;
  }

  if (grantsError) {
    throw grantsError;
  }

  const permissionsByProfile = new Map<string, ClubPermissionKey[]>();

  for (const grant of grants ?? []) {
    const list = permissionsByProfile.get(grant.profile_id) ?? [];
    list.push(grant.permission_key as ClubPermissionKey);
    permissionsByProfile.set(grant.profile_id, list);
  }

  return (members ?? []).map((row) => {
    const profile = (
      Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    ) as { full_name: string | null; avatar_url: string | null } | null;

    return {
      avatar_url: profile?.avatar_url ?? null,
      full_name: profile?.full_name ?? null,
      member_id: row.id,
      member_role: row.member_role,
      permissions: permissionsByProfile.get(row.profile_id as string) ?? [],
      profile_id: row.profile_id as string,
    };
  });
}

export async function grantClubPermission(
  clubId: string,
  profileId: string,
  permissionKey: ClubPermissionKey,
  grantedByProfileId: string,
): Promise<void> {
  const { error } = await supabase.from("club_member_permissions").upsert(
    {
      club_id: clubId,
      granted_by_profile_id: grantedByProfileId,
      permission_key: permissionKey,
      profile_id: profileId,
    },
    {
      ignoreDuplicates: true,
      onConflict: "club_id,profile_id,permission_key",
    },
  );

  if (error) {
    throw error;
  }
}

export async function revokeClubPermission(
  clubId: string,
  profileId: string,
  permissionKey: ClubPermissionKey,
): Promise<void> {
  const { error } = await supabase
    .from("club_member_permissions")
    .delete()
    .eq("club_id", clubId)
    .eq("profile_id", profileId)
    .eq("permission_key", permissionKey);

  if (error) {
    throw error;
  }
}
