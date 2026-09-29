/**
 * Testata dell'hub (§F.1): avatar, nome, tipologia profilo e l'azione testuale
 * "Visualizza profilo".
 *
 * È un'ancora, non un editor: la foto si cambia da "Foto e dati personali".
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";

type ProfileEditIdentityHeaderProps = {
  avatarUrl: string | null;
  fullName: string;
  onViewProfile: () => void;
  roleLabel: string;
};

export function ProfileEditIdentityHeader({
  avatarUrl,
  fullName,
  onViewProfile,
  roleLabel,
}: ProfileEditIdentityHeaderProps) {
  return (
    <View style={styles.container} testID="profile-edit-identity">
      <Avatar name={fullName} size="lg" uri={avatarUrl ?? undefined} />
      <View style={styles.textBlock}>
        <AppText numberOfLines={1} variant="titleMd">
          {fullName}
        </AppText>
        <AppText color="secondary" variant="bodySm">
          {roleLabel}
        </AppText>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onViewProfile}
          style={styles.viewProfile}
          testID="profile-edit-view-profile"
        >
          <AppText color="accent" variant="actionLabel">
            Visualizza profilo
          </AppText>
          <Ionicons color={colors.accent} name="chevron-forward" size={14} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[16],
    padding: spacing[16],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  textBlock: {
    flex: 1,
    gap: spacing[4],
  },
  viewProfile: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
  },
});
