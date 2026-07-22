import { formatPosition, formatRole } from "../profiles/profile-display-helpers";
import type {
  ClubShortlist,
  ShortlistEntry,
  ShortlistEvaluationStatus,
  ShortlistPriority,
} from "./shortlist-service";

type ShortlistBadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "accent";

const PRIORITY_BADGE_VARIANTS: Record<ShortlistPriority, ShortlistBadgeVariant> = {
  alta: "error",
  bassa: "accent",
  media: "warning",
};

export function getPriorityBadgeVariant(
  priority: ShortlistPriority,
): ShortlistBadgeVariant {
  return PRIORITY_BADGE_VARIANTS[priority];
}

export function getStatusBadgeVariant(
  status: ShortlistEvaluationStatus,
): ShortlistBadgeVariant {
  return status === "contattato" ? "success" : "default";
}

/**
 * "Attaccante · AC Como · Classe 2006" — players show their primary
 * position (falls back to formatPosition's own default label); every other
 * role shows formatRole instead. Team falls back to "Svincolato" when the
 * profile has no current club, and the birth year segment is omitted when
 * unknown.
 */
export function formatEntrySubtitle(
  entry: Pick<ShortlistEntry, "role" | "primary_position" | "current_team" | "birth_year">,
): string {
  const roleOrPosition =
    entry.role === "player"
      ? formatPosition(entry.primary_position)
      : formatRole(entry.role);

  const parts = [roleOrPosition, entry.current_team ?? "Svincolato"];

  if (entry.birth_year) {
    parts.push(`Classe ${entry.birth_year}`);
  }

  return parts.join(" • ");
}

const ITALIAN_MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

/** "12 giugno 2026" — UTC-based to stay deterministic regardless of the runtime timezone. */
export function formatAddedDate(iso: string): string {
  const date = new Date(iso);
  const day = date.getUTCDate();
  const month = ITALIAN_MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();

  return `${day} ${month} ${year}`;
}

/** "12 profili • 3 priorità alta" — omits the priority segment when zero, singular "1 profilo". */
export function formatListSubtitle(
  list: Pick<ClubShortlist, "entry_count" | "high_priority_count">,
): string {
  const profileLabel =
    list.entry_count === 1 ? "1 profilo" : `${list.entry_count} profili`;

  if (list.high_priority_count <= 0) {
    return profileLabel;
  }

  return `${profileLabel} • ${list.high_priority_count} priorità alta`;
}
