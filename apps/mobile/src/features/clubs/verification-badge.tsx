import { Text, View } from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing, typography } from "../../theme/tokens";

type VerificationStatus =
  | "flagged"
  | "pending_review"
  | "suspended"
  | "unverified"
  | "verified";

const config: Record<VerificationStatus, { bg: string; icon: string; label: string; text: string }> = {
  flagged: { bg: "#FEF3C7", icon: "warning-outline", label: "Segnalato", text: "#92400E" },
  pending_review: { bg: "#DBEAFE", icon: "time-outline", label: "In revisione", text: "#1E40AF" },
  suspended: { bg: "#FEE2E2", icon: "close-circle-outline", label: "Sospeso", text: "#991B1B" },
  unverified: { bg: colors.surfaceMuted, icon: "help-circle-outline", label: "Non verificato", text: colors.textSecondary },
  verified: { bg: "#D1FAE5", icon: "checkmark-circle", label: "Verificato", text: "#065F46" },
};

export function VerificationBadge({ status }: { status: string }) {
  const safeStatus = (Object.keys(config).includes(status) ? status : "unverified") as VerificationStatus;
  const { bg, icon, label, text } = config[safeStatus];

  return (
    <View
      style={{
        alignItems: "center",
        alignSelf: "flex-start",
        backgroundColor: bg,
        borderRadius: radius[14],
        flexDirection: "row",
        gap: spacing[4],
        paddingHorizontal: spacing[10],
        paddingVertical: spacing[6],
      }}
    >
      <Ionicons color={text} name={icon as never} size={14} />
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
