import { Badge } from "../../../ui";
import type { ClubVerificationStatus } from "../admin-service";

type BadgeVariant = "default" | "info" | "success" | "warning" | "error";

const config: Record<
  ClubVerificationStatus,
  { label: string; variant: BadgeVariant }
> = {
  flagged: { label: "Segnalato", variant: "warning" },
  pending_review: { label: "In revisione", variant: "info" },
  rejected: { label: "Rifiutato", variant: "error" },
  suspended: { label: "Sospeso", variant: "error" },
  unverified: { label: "Non verificato", variant: "default" },
  verified: { label: "Verificato", variant: "success" },
};

export function StatusBadge({ status }: { status: ClubVerificationStatus }) {
  const { label, variant } = config[status];

  return <Badge label={label} variant={variant} />;
}
