import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { ClubVerificationStatus } from "../admin-service";

const config: Record<ClubVerificationStatus, { bg: string; label: string; text: string }> = {
  flagged: { bg: colors.warningSoft, label: "Segnalato", text: colors.warning },
  pending_review: { bg: "#DBEAFE", label: "In revisione", text: "#1E40AF" },
  rejected: { bg: colors.dangerSoft, label: "Rifiutato", text: colors.danger },
  suspended: { bg: colors.dangerSoft, label: "Sospeso", text: colors.dangerStrong },
  unverified: { bg: colors.surfaceMuted, label: "Non verificato", text: colors.textSecondary },
  verified: { bg: colors.successSoft, label: "Verificato", text: colors.success },
};

export function StatusBadge({ status }: { status: ClubVerificationStatus }) {
  const { bg, label, text } = config[status];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <AppText preset="caption" style={{ color: text }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius[14],
    marginTop: spacing[4],
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
  },
});
