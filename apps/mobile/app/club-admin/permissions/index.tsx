import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { Screen } from "../../../src/components/ui/screen";
import { ScreenHeader } from "../../../src/ui";
import { useSession } from "../../../src/features/auth/use-session";
import { PermissionMemberList } from "../../../src/features/shortlist/components/PermissionMemberList";
import { fetchClubPermissionMembers } from "../../../src/features/shortlist/shortlist-permissions-service";
import { colors, radius, spacing } from "../../../src/theme/tokens";

export default function ClubAdminPermissionsScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const clubId = profile?.club_id ?? null;

  const { data, isLoading } = useQuery({
    enabled: !!clubId,
    queryFn: () => fetchClubPermissionMembers(clubId as string),
    queryKey: ["club-permission-members", clubId],
  });

  return (
    <Screen>
      <View style={styles.headerRow}>
        <ScreenHeader
          title="Amministratori"
          subtitle="Ruoli e permessi"
          action={
            <Pressable
              accessibilityLabel="Indietro"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
            </Pressable>
          }
        />
      </View>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <PermissionMemberList
          members={data ?? []}
          onSelectMember={(member) =>
            router.push(`/club-admin/permissions/${member.profile_id}` as never)
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    marginBottom: spacing[16],
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  pressed: {
    opacity: 0.75,
  },
  loaderContainer: {
    alignItems: "center",
    paddingVertical: spacing[40],
  },
});
