import { StyleSheet, View } from "react-native";

import { AppText, Avatar } from "../../../ui";
import { colors, radius, spacing } from "../../../theme/tokens";

type ProfileSummaryCardProps = {
  avatarUrl?: string | null;
  fullName: string;
  subtitle: string;
};

export function ProfileSummaryCard({
  avatarUrl,
  fullName,
  subtitle,
}: ProfileSummaryCardProps) {
  return (
    <View style={styles.card}>
      <Avatar name={fullName} size="md" uri={avatarUrl} />
      <View style={styles.body}>
        <AppText numberOfLines={1} variant="titleSm">
          {fullName}
        </AppText>
        <AppText color="muted" numberOfLines={1} variant="bodySm">
          {subtitle}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing[4],
  },
  card: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[12],
  },
});
