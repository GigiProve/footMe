/**
 * Come si legge un'esperienza nel riepilogo carriera (REV-ONB-02 §BB–§BD).
 *
 * Solo formattazione: nessuna informazione inventata. Quando le categorie
 * differiscono fra le stagioni la riga lo dice, invece di mostrarne una sola
 * come se valesse per tutte (§BC).
 */
import type { PlayerCareerEntry } from "./player-career-types";
import {
  computePlayerSeasonsFromPeriod,
  formatSeasonShort,
} from "./player-career-utils";

/** Periodo leggibile: "2026/27", "2023/24, 2022/23", "Da Gennaio 2025 a Febbraio 2026". */
export function formatExperiencePeriod(entry: PlayerCareerEntry): string {
  if (entry.type === "CUSTOM_PERIOD" && entry.period) {
    const { endMonth, endYear, startMonth, startYear } = entry.period;
    const start = startMonth ? `${startMonth} ${startYear}` : startYear;
    const end = endMonth ? `${endMonth} ${endYear}` : endYear;

    return start && end ? `Da ${start} a ${end}` : start || end;
  }

  return entry.seasons.map(formatSeasonShort).join(", ");
}

/**
 * Categoria mostrata nella riga. Con categorie diverse fra le stagioni non si
 * sceglie un vincitore: il dettaglio resta nell'editor (§BC).
 */
export function formatExperienceCategory(entry: PlayerCareerEntry): string {
  const seasons =
    entry.type === "CUSTOM_PERIOD" && entry.period
      ? computePlayerSeasonsFromPeriod(entry.period)
      : entry.seasons;

  const categories = new Set(
    seasons
      .map((season) => entry.seasonDetails[season]?.category || entry.category)
      .filter(Boolean),
  );

  if (categories.size === 0) {
    return entry.category;
  }

  if (categories.size === 1) {
    return [...categories][0];
  }

  return `${categories.size} categorie`;
}

/** Statistiche sintetiche della riga: assenti quando non c'è nulla da dire. */
export function formatExperienceStats(
  entry: PlayerCareerEntry,
): string | undefined {
  // Un periodo personalizzato non popola `seasons`: le sue stagioni si
  // calcolano dalle date, altrimenti le statistiche sparirebbero dalla riga.
  const seasons =
    entry.type === "CUSTOM_PERIOD" && entry.period
      ? computePlayerSeasonsFromPeriod(entry.period)
      : entry.seasons;

  const totals = seasons.reduce(
    (accumulator, season) => {
      const detail = entry.seasonDetails[season];

      return {
        appearances:
          accumulator.appearances + (Number(detail?.appearances) || 0),
        assists: accumulator.assists + (Number(detail?.assists) || 0),
        goals: accumulator.goals + (Number(detail?.goals) || 0),
      };
    },
    { appearances: 0, assists: 0, goals: 0 },
  );

  if (!totals.appearances && !totals.goals && !totals.assists) {
    return undefined;
  }

  return `${totals.appearances} presenze · ${totals.goals} gol · ${totals.assists} assist`;
}
