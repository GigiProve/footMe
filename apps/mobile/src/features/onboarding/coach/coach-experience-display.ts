/**
 * Come si legge un'esperienza da allenatore nel riepilogo (REV-ONB-03 §AA).
 *
 * Solo formattazione. Nessuna statistica: le esperienze da allenatore non ne
 * hanno (§V), quindi qui non esiste nemmeno la funzione per mostrarle.
 */
import type { CoachCareerEntry } from "./coach-career-types";
import {
  computeCoachSeasonsFromPeriod,
  formatSeasonShort,
} from "./coach-career-utils";

/** "2026/27" · "2023/24, 2022/23" · "Da Gennaio 2025 a Febbraio 2026". */
export function formatCoachExperiencePeriod(entry: CoachCareerEntry): string {
  if (entry.type === "CUSTOM_PERIOD" && entry.period) {
    const { endMonth, endYear, startMonth, startYear } = entry.period;
    const start = startMonth ? `${startMonth} ${startYear}` : startYear;
    const end = endMonth ? `${endMonth} ${endYear}` : endYear;

    return start && end ? `Da ${start} a ${end}` : start || end;
  }

  return [...entry.seasons]
    .sort((left, right) => right.localeCompare(left))
    .map(formatSeasonShort)
    .join(", ");
}

/**
 * Riga di dettaglio: ruolo e categoria. Quando le stagioni del blocco hanno
 * ruoli diversi non se ne elegge uno: la riga dice quanti sono e il dettaglio
 * resta nell'editor (§S).
 */
export function formatCoachExperienceSubtitle(entry: CoachCareerEntry): string {
  const seasons =
    entry.type === "CUSTOM_PERIOD" && entry.period
      ? computeCoachSeasonsFromPeriod(entry.period)
      : entry.seasons;

  const roles = new Set(
    seasons
      .map((season) => entry.seasonDetails[season]?.role || entry.role)
      .filter(Boolean),
  );

  const role =
    roles.size === 0
      ? entry.role
      : roles.size === 1
        ? [...roles][0]
        : `${roles.size} ruoli`;

  return [role, entry.category].filter(Boolean).join(" · ");
}
