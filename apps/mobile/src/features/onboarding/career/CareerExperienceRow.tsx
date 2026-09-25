import { ExperienceSummaryCard } from "../ui";
import {
  formatExperienceCategory,
  formatExperiencePeriod,
  formatExperienceStats,
} from "./career-experience-display";
import type { PlayerCareerEntry } from "./player-career-types";

type CareerExperienceRowProps = {
  entry: PlayerCareerEntry;
  onEdit: () => void;
  onRemove?: () => void;
  testID?: string;
};

/**
 * Riga del riepilogo carriera (REV-ONB-02 §BA–§BF).
 *
 * Usa la card esperienza del Master: logo reale della società quando c'è,
 * placeholder neutro quando non c'è. Nessun crest inventato (§BE).
 */
export function CareerExperienceRow({
  entry,
  onEdit,
  onRemove,
  testID,
}: CareerExperienceRowProps) {
  return (
    <ExperienceSummaryCard
      logoUrl={entry.teamLogoUrl || null}
      onEdit={onEdit}
      onRemove={onRemove}
      period={formatExperiencePeriod(entry)}
      stats={formatExperienceStats(entry)}
      subtitle={formatExperienceCategory(entry)}
      testID={testID}
      title={entry.teamName}
    />
  );
}
