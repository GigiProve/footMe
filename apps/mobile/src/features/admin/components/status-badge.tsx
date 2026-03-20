import { Text, View } from "react-native";

import { colors, radius, spacing, typography } from "../../../theme/tokens";
import type { ClubVerificationStatus } from "../admin-service";

const config: Record<ClubVerificationStatus, { bg: string; label: string; text: string }> = {
  flagged: { bg: "#FEF3C7", label: "Segnalato", text: "#92400E" },
  pending_review: { bg: "#DBEAFE", label: "In revisione", text: "#1E40AF" },
  rejected: { bg: colors.dangerSoft, label: "Rifiutato", text: colors.danger },
  suspended: { bg: "#FEE2E2", label: "Sospeso", text: "#991B1B" },
  unverified: { bg: colors.surfaceMuted, label: "Non verificato", text: colors.textSecondary },
  verified: { bg: "#D1FAE5", label: "Verificato", text: "#065F46" },
};

export function StatusBadge({ status }: { status: ClubVerificationStatus }) {
  const { bg, label, text } = config[status];

  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: bg,
        borderRadius: radius[14],
        marginTop: spacing[4],
        paddingHorizontal: spacing[8],
        paddingVertical: spacing[4],
      }}
    >
      <Text
        style={{
          color: text,
          fontSize: typography.fontSize[12],
          fontWeight: typography.fontWeight.bold,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
