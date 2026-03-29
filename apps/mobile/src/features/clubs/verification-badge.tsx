import { Badge } from "../../ui";

type VerificationStatus =
  | "flagged"
  | "pending_review"
  | "suspended"
  | "unverified"
  | "verified";

type BadgeVariant = "default" | "info" | "success" | "warning" | "error";

const config: Record<
  VerificationStatus,
  { label: string; variant: BadgeVariant }
> = {
  flagged: { label: "Segnalato", variant: "warning" },
  pending_review: { label: "In revisione", variant: "info" },
  suspended: { label: "Sospeso", variant: "error" },
  unverified: { label: "Non verificato", variant: "default" },
  verified: { label: "Verificato", variant: "success" },
};

export function VerificationBadge({ status }: { status: string }) {
  const safeStatus = (
    Object.keys(config).includes(status) ? status : "unverified"
  ) as VerificationStatus;
  const { label, variant } = config[safeStatus];

  return <Badge label={label} variant={variant} />;
}
