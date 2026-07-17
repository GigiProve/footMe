import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { Screen } from "../../../src/components/ui/screen";
import { KeyboardAwareForm } from "../../../src/components/ui/keyboard-aware-form";
import { EmptyState, ScreenHeader } from "../../../src/ui";
import { useSession } from "../../../src/features/auth/use-session";
import { MemberPermissionsEditor } from "../../../src/features/shortlist/components/MemberPermissionsEditor";
import { fetchClubPermissionMembers } from "../../../src/features/shortlist/shortlist-permissions-service";
import { colors, radius, spacing } from "../../../src/theme/tokens";

export default function ClubAdminMemberPermissionsScreen() {
  const router = useRouter();
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const { profile } = useSession();
  const clubId = profile?.club_id ?? null;

  const { data, isLoading } = useQuery({
    enabled: !!clubId,
    queryFn: () => fetchClubPermissionMembers(clubId as string),
    queryKey: ["club-permission-members", clubId],
  });

  const member = data?.find((item) => item.profile_id === memberId) ?? null;

  return (
    <Screen>
      <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <ScreenHeader
            title="Permessi"
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
                <Ionicons
                  color={colors.textPrimary}
                  name="arrow-back"
                  size={20}
                />
              </Pressable>
            }
          />
        </View>

        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : member && clubId && profile?.id ? (
          <MemberPermissionsEditor
            clubId={clubId}
            member={member}
            ownerProfileId={profile.id}
          />
        ) : (
          <EmptyState
            icon="person-outline"
            title="Membro non trovato"
            description="Il membro selezionato non è più disponibile."
          />
        )}
      </KeyboardAwareForm>
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
  scrollContent: {
    gap: spacing[18],
    paddingBottom: spacing[48],
  },
});
