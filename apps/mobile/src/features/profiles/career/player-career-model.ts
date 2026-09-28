/**
 * Modello di lettura della carriera del Calciatore (REV-PROF-01 §12–§22).
 *
 * È l'unico posto in cui la carriera viene raggruppata, ordinata, sommata e
 * trasformata in serie per il grafico: i componenti ricevono dati già pronti e
 * non rifanno aggregazioni a ogni render (§20, §41).
 *
 * Raggruppamento e ordinamento non sono riscritti qui: passano per
 * `formsToPlayerEntries` e `sortPlayerEntriesByRecency`, il comparator
 * canonico introdotto con REV-ONB-02 (§18).
 */
import {
  formsToPlayerEntries,
  formatSeasonShort,
  getEntrySeasonLabels,
  playerPeriodMonthToNumber,
  sortPlayerEntriesByRecency,
} from "../../onboarding/career/player-career-utils";
import type {
  PlayerCareerEntry,
  PlayerCareerType,
} from "../../onboarding/career/player-career-types";
import type { PlayerExperienceForm } from "../player-sports";

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

/** `null` = dato non disponibile. Non è uno zero (§19). */
export type CareerStat = number | null;

export type CareerMetric = "appearances" | "goals" | "assists";

export type CareerSeason = {
  appearances: CareerStat;
  assists: CareerStat;
  awards: string[];
  category: string;
  goals: CareerStat;
  /** Etichetta compatta mostrata a schermo: "2024/25". */
  label: string;
  /** Chiave canonica della stagione: "2024/2025". */
  seasonKey: string;
  startYear: number | null;
};

export type CareerExperience = {
  careerType: PlayerCareerType;
  clubId: string | null;
  clubName: string;
  /** Id dell'esperienza: due periodi nello stesso club restano distinti (§12). */
  id: string;
  /** L'esperienza copre la stagione sportiva in corso. */
  isCurrent: boolean;
  logoUrl: string;
  /** "2022 — Presente · 3 stagioni", oppure il periodo reale di un CUSTOM_PERIOD. */
  periodLabel: string;
  seasons: CareerSeason[];
};

export type CareerTotals = {
  appearances: CareerStat;
  assists: CareerStat;
  goals: CareerStat;
};

export type CareerChartPoint = {
  label: string;
  seasonKey: string;
  startYear: number;
  value: CareerStat;
};

export type PlayerCareerView = {
  experiences: CareerExperience[];
  totals: CareerTotals;
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const MONTH_LABELS = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

function parseStat(value: string | undefined): CareerStat {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseAwards(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((award) => award.trim())
    .filter(Boolean);
}

function getSeasonStartYear(seasonKey: string): number | null {
  const parsed = parseInt(seasonKey.slice(0, 4), 10);

  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Stagione sportiva corrente: luglio apre la stagione nuova. Serve solo per
 * dire "Presente" al posto dell'anno di fine, non per inventare dati.
 */
export function getCurrentSeasonKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const startYear = now.getMonth() + 1 >= 7 ? year : year - 1;

  return `${startYear}/${startYear + 1}`;
}

function formatSeasonCount(count: number): string {
  return count === 1 ? "1 stagione" : `${count} stagioni`;
}

function formatCustomPeriodLabel(
  period: NonNullable<PlayerCareerEntry["period"]>,
): string {
  const startMonth = Number(playerPeriodMonthToNumber(period.startMonth));
  const endMonth = Number(playerPeriodMonthToNumber(period.endMonth));
  const start = [MONTH_LABELS[startMonth - 1], period.startYear]
    .filter(Boolean)
    .join(" ");
  const end = [MONTH_LABELS[endMonth - 1], period.endYear]
    .filter(Boolean)
    .join(" ");

  return [start, end].filter(Boolean).join(" — ");
}

function buildSeasonPeriodLabel(
  seasons: CareerSeason[],
  isCurrent: boolean,
): string {
  const years = seasons
    .map((season) => season.startYear)
    .filter((year): year is number => year !== null);

  if (years.length === 0) {
    return seasons.length > 0 ? formatSeasonCount(seasons.length) : "";
  }

  const startYear = Math.min(...years);
  const endYear = Math.max(...years) + 1;
  const range = isCurrent
    ? `${startYear} — Presente`
    : startYear === endYear - 1
      ? `${startYear}/${String(endYear).slice(2)}`
      : `${startYear} — ${endYear}`;

  return `${range} · ${formatSeasonCount(seasons.length)}`;
}

// ---------------------------------------------------------------------------
// Costruzione della vista
// ---------------------------------------------------------------------------

function toCareerSeasons(entry: PlayerCareerEntry): CareerSeason[] {
  // Un periodo personalizzato porta le sue stagioni dentro `seasonDetails`:
  // sono quelle salvate davvero. Solo se mancano si ricade sulle stagioni
  // calcolate dal periodo, che restano una derivazione e non un dato inserito.
  const detailKeys = Object.keys(entry.seasonDetails);
  const seasonKeys =
    entry.type === "CUSTOM_PERIOD" && detailKeys.length > 0
      ? detailKeys
      : getEntrySeasonLabels(entry);

  // Le statistiche stanno in `seasonDetails`, che è già una mappa per stagione:
  // una stagione ripetuta in `seasons` porterebbe due righe identiche, quindi
  // raddoppierebbe i totali e il bucket del grafico.
  const uniqueSeasonKeys = [...new Set(seasonKeys.filter(Boolean))];

  return uniqueSeasonKeys
    .map((seasonKey) => {
      const detail = entry.seasonDetails[seasonKey];

      return {
        appearances: parseStat(detail?.appearances),
        assists: parseStat(detail?.assists),
        awards: parseAwards(detail?.awards),
        category: (detail?.category || entry.category || "").trim(),
        goals: parseStat(detail?.goals),
        label: formatSeasonShort(seasonKey),
        seasonKey,
        startYear: getSeasonStartYear(seasonKey),
      } satisfies CareerSeason;
    })
    .sort((left, right) => (right.startYear ?? -1) - (left.startYear ?? -1));
}

/**
 * Un periodo personalizzato è in corso se la sua data di fine non è ancora
 * passata. L'etichetta resta comunque il periodo reale — "Presente" al posto
 * di una data inventerebbe un dato (§17) — ma l'esperienza deve poter essere
 * riconosciuta come attuale da header e Situazione attuale (§7, §28).
 */
function isCustomPeriodOpen(
  period: NonNullable<PlayerCareerEntry["period"]>,
  now: Date,
): boolean {
  const endYear = parseInt(period.endYear, 10);

  if (Number.isNaN(endYear)) {
    return false;
  }

  const endMonth = Number(playerPeriodMonthToNumber(period.endMonth)) || 12;
  const endOfPeriod = endYear * 12 + endMonth;

  return endOfPeriod >= now.getFullYear() * 12 + now.getMonth() + 1;
}

function toCareerExperience(
  entry: PlayerCareerEntry,
  currentSeasonKey: string,
  now: Date,
): CareerExperience {
  const seasons = toCareerSeasons(entry);
  const isCurrent =
    entry.type === "CUSTOM_PERIOD"
      ? Boolean(entry.period && isCustomPeriodOpen(entry.period, now))
      : seasons.some((season) => season.seasonKey === currentSeasonKey);

  return {
    careerType: entry.type,
    clubId: entry.clubId ?? null,
    clubName: entry.teamName,
    id: entry.id,
    isCurrent,
    logoUrl: entry.teamLogoUrl ?? "",
    periodLabel:
      entry.type === "CUSTOM_PERIOD" && entry.period
        ? formatCustomPeriodLabel(entry.period)
        : buildSeasonPeriodLabel(seasons, isCurrent),
    // (il periodo di un CUSTOM_PERIOD resta la sua data reale anche quando
    //  l'esperienza è in corso)
    seasons,
  };
}

/**
 * Somma di una metrica sulle stagioni. La source of truth sono le statistiche
 * per stagione di REV-ONB-02: sommando solo quelle non può esserci il double
 * counting fra totale di esperienza e dettaglio stagionale (§20).
 * Se nessuna stagione porta il dato, il totale resta sconosciuto.
 */
function sumMetric(
  experiences: CareerExperience[],
  metric: CareerMetric,
): CareerStat {
  let total = 0;
  let hasValue = false;

  for (const experience of experiences) {
    for (const season of experience.seasons) {
      const value = season[metric];

      if (value !== null) {
        total += value;
        hasValue = true;
      }
    }
  }

  return hasValue ? total : null;
}

export function buildPlayerCareerView(
  forms: PlayerExperienceForm[],
  { now = new Date() }: { now?: Date } = {},
): PlayerCareerView {
  const currentSeasonKey = getCurrentSeasonKey(now);
  // Nessun filtro sulle stagioni: un'esperienza con una `season_label`
  // illeggibile resta in Carriera con il suo header invece di sparire senza
  // che l'utente possa accorgersene (§38).
  const experiences = sortPlayerEntriesByRecency(formsToPlayerEntries(forms)).map(
    (entry) => toCareerExperience(entry, currentSeasonKey, now),
  );

  return {
    experiences,
    totals: {
      appearances: sumMetric(experiences, "appearances"),
      assists: sumMetric(experiences, "assists"),
      goals: sumMetric(experiences, "goals"),
    },
  };
}

// ---------------------------------------------------------------------------
// Serie del grafico
// ---------------------------------------------------------------------------

/**
 * Un punto per stagione sportiva (§22). Due esperienze nella stessa stagione —
 * il caso del trasferimento a gennaio — confluiscono nello stesso bucket senza
 * che nessuna delle due sparisca dalla Carriera.
 *
 * Una stagione in cui la metrica non è mai stata inserita resta nella serie con
 * valore sconosciuto: toglierla falsificherebbe la linea temporale.
 */
export function buildCareerChartSeries(
  view: PlayerCareerView,
  metric: CareerMetric,
): CareerChartPoint[] {
  const buckets = new Map<string, { hasValue: boolean; total: number }>();

  for (const experience of view.experiences) {
    for (const season of experience.seasons) {
      if (season.startYear === null) {
        continue;
      }

      const bucket = buckets.get(season.seasonKey) ?? {
        hasValue: false,
        total: 0,
      };
      const value = season[metric];

      if (value !== null) {
        bucket.hasValue = true;
        bucket.total += value;
      }

      buckets.set(season.seasonKey, bucket);
    }
  }

  return [...buckets.entries()]
    .map(([seasonKey, bucket]) => ({
      label: formatSeasonShort(seasonKey),
      seasonKey,
      startYear: getSeasonStartYear(seasonKey) ?? 0,
      value: bucket.hasValue ? bucket.total : null,
    }))
    .sort((left, right) => left.startYear - right.startYear);
}

// ---------------------------------------------------------------------------
// Formattazione
// ---------------------------------------------------------------------------

/** Placeholder di una statistica mai inserita: neutro, non uno zero (§19). */
export const MISSING_STAT_LABEL = "—";

export function formatCareerStat(value: CareerStat): string {
  return value === null ? MISSING_STAT_LABEL : String(value);
}

export const CAREER_METRIC_LABELS: Record<CareerMetric, string> = {
  appearances: "Presenze",
  assists: "Assist",
  goals: "Gol",
};

/** Etichetta per screen reader di una statistica di stagione (§39). */
export function getCareerStatAccessibilityLabel(
  metric: CareerMetric,
  value: CareerStat,
): string {
  return value === null
    ? `${CAREER_METRIC_LABELS[metric]}, dato non disponibile`
    : `${value} ${CAREER_METRIC_LABELS[metric]}`;
}
