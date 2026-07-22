import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";

import { AppText, Card, Checkbox, useToast } from "../../../ui";
import { colors, spacing } from "../../../theme/tokens";
import { formatMemberRole } from "./PermissionMemberList";
import {
  CLUB_NOTIF_PERMISSION_LABELS,
  grantClubPermission,
  revokeClubPermission,
  SHORTLIST_PERMISSION_LABELS,
  type ClubNotifPermissionKey,
  type ClubPermissionKey,
  type ClubPermissionMember,
  type ShortlistPermissionKey,
} from "../shortlist-permissions-service";

const PERMISSION_ORDER: ShortlistPermissionKey[] = [
  "shortlist_view",
  "shortlist_create_lists",
  "shortlist_add_profiles",
  "shortlist_add_notes",
  "shortlist_edit_status",
  "shortlist_remove_profiles",
];

const CLUB_NOTIF_PERMISSION_ORDER: ClubNotifPermissionKey[] = [
  "notif_new_applications",
  "notif_shortlist_updates",
  "notif_connection_requests",
  "notif_store_orders",
  "notif_content_tags",
  "notif_affiliations",
  "notif_profile_verifications",
];

type MemberPermissionsEditorProps = {
  clubId: string;
  member: ClubPermissionMember;
  ownerProfileId: string;
};

export function MemberPermissionsEditor({
  clubId,
  member,
  ownerProfileId,
}: MemberPermissionsEditorProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [permissions, setPermissions] = useState<ClubPermissionKey[]>(
    member.permissions,
  );
  const [pendingKeys, setPendingKeys] = useState<ClubPermissionKey[]>([]);

  const displayName = member.full_name ?? "Membro senza nome";
  const roleLabel = formatMemberRole(member.member_role);

  async function handleToggle(key: ClubPermissionKey, nextChecked: boolean) {
    const previous = permissions;
    setPermissions((current) =>
      nextChecked ? [...current, key] : current.filter((item) => item !== key),
    );
    setPendingKeys((current) => [...current, key]);

    try {
      if (nextChecked) {
        await grantClubPermission(clubId, member.profile_id, key, ownerProfileId);
      } else {
        await revokeClubPermission(clubId, member.profile_id, key);
      }
      queryClient.invalidateQueries({
        queryKey: ["club-permission-members", clubId],
      });
      queryClient.invalidateQueries({ queryKey: ["shortlist-permissions"] });
    } catch {
      setPermissions(previous);
      showToast({
        message: "Impossibile aggiornare il permesso. Riprova.",
        tone: "neutral",
      });
    } finally {
      setPendingKeys((current) => current.filter((item) => item !== key));
    }
  }

  return (
    <View style={styles.container}>
      <Card>
        <AppText variant="bodySm" color="muted">
          Ruolo
        </AppText>
        <AppText variant="titleMd">
          {displayName} · {roleLabel}
        </AppText>
      </Card>

      <View style={styles.section}>
        <AppText variant="titleMd" style={styles.sectionTitle}>
          Shortlist / Scouting
        </AppText>
        <View style={styles.checkboxGroup}>
          {PERMISSION_ORDER.map((key) => (
            <Checkbox
              key={key}
              checked={permissions.includes(key)}
              disabled={pendingKeys.includes(key)}
              label={SHORTLIST_PERMISSION_LABELS[key]}
              onValueChange={(value) => {
                void handleToggle(key, value);
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="titleMd" style={styles.sectionTitle}>
          Notifiche operative
        </AppText>
        <AppText variant="bodySm" color="muted" style={styles.sectionSubtitle}>
          Scegli quali aggiornamenti operativi riceve questo membro.
        </AppText>
        <View style={styles.checkboxGroup}>
          {CLUB_NOTIF_PERMISSION_ORDER.map((key) => (
            <Checkbox
              key={key}
              checked={permissions.includes(key)}
              disabled={pendingKeys.includes(key)}
              label={CLUB_NOTIF_PERMISSION_LABELS[key]}
              onValueChange={(value) => {
                void handleToggle(key, value);
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.noteRow}>
        <Ionicons color={colors.textMuted} name="lock-closed-outline" size={14} />
        <AppText variant="caption" color="muted" style={styles.noteText}>
          Questi permessi si applicano alle funzioni Shortlist / Scouting e alle
          notifiche operative della società.
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[20],
  },
  section: {
    gap: spacing[4],
  },
  sectionTitle: {
    marginBottom: spacing[4],
  },
  sectionSubtitle: {
    marginBottom: spacing[8],
  },
  checkboxGroup: {
    gap: spacing[4],
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[8],
  },
  noteText: {
    flex: 1,
  },
});
