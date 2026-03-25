import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../theme/tokens";
import { Badge } from "../../ui";

type VerificationStatus =
  | "flagged"
  | "pending_review"
  | "suspended"
  | "unverified"
  | "verified";

type BadgeVariant = "default" | "info" | "success" | "warning" | "error";

const config: Record<VerificationStatus, { icon: string; label: string; variant: BadgeVariant }> = {
  flagged: { icon: "warning-outline", label: "Segnalato", variant: "warning" },
  pending_review: { icon: "time-outline", label: "In revisione", variant: "info" },
  suspended: { icon: "close-circle-outline", label: "Sospeso", variant: "error" },
  unverified: { icon: "help-circle-outline", label: "Non verificato", variant: "default" },
  verified: { icon: "checkmark-circle", label: "Verificato", variant: "success" },
};

export function VerificationBadge({ status }: { status: string }) {
  const safeStatus = (Object.keys(config).includes(status) ? status : "unverified") as VerificationStatus;
  const { label, variant } = config[safeStatus];

  return <Badge label={label} variant={variant} />;
}
