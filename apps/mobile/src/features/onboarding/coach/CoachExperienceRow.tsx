import { ExperienceSummaryCard } from "../ui";
import type { CoachCareerEntry } from "./coach-career-types";
import {
  formatCoachExperiencePeriod,
  formatCoachExperienceSubtitle,
} from "./coach-experience-display";

type CoachExperienceRowProps = {
  entry: CoachCareerEntry;
  onEdit: () => void;
  onRemove?: () => void;
  testID?: string;
};

/**
 * Riga del riepilogo "Le tue esperienze da allenatore" (REV-ONB-03 §AA–§AB).
 *
 * Usa la card esperienza del Master: logo reale della società quando c'è,
 * placeholder neutro quando non c'è. Nessuna statistica (§V), nessun pulsante
 * MODIFICA a tutta larghezza: l'icona matita della card basta.
 */
export function CoachExperienceRow({
  entry,
  onEdit,
  onRemove,
  testID,
}: CoachExperienceRowProps) {
  return (
    <ExperienceSummaryCard
      logoUrl={entry.teamLogoUrl || null}
      onEdit={onEdit}
      onRemove={onRemove}
      period={formatCoachExperiencePeriod(entry)}
      subtitle={formatCoachExperienceSubtitle(entry)}
      testID={testID}
      title={entry.teamName}
    />
  );
}
