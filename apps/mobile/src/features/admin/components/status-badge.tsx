import { StyleSheet, View } from "react-native";

import { radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { ClubVerificationStatus } from "../admin-service";

const config: Record<ClubVerificationStatus, { bg: string; label: string; text: string }> = {
  flagged: { bg: "#FEF3C7", label: "Segnalato", text: "#92400E" },
  pending_review: { bg: "#DBEAFE", label: "In revisione", text: "#1E40AF" },
  rejected: { bg: "#FEE2E2", label: "Rifiutato", text: "#B42318" },
  suspended: { bg: "#FEE2E2", label: "Sospeso", text: "#991B1B" },
  unverified: { bg: "#EEF3F8", label: "Non verificato", text: "#5E6E7E" },
  verified: { bg: "#D1FAE5", label: "Verificato", text: "#065F46" },
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
