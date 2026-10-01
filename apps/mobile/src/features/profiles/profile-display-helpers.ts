import { getPlayerPositionLabel } from "./player-sports";
import { getOptionLabel, REGION_OPTIONS } from "./profile-form-utils";
import type {
  CoachCareerEntryRecord,
  CoachPlayerCareerEntryRecord,
  StaffPlayerCareerEntryRecord,
} from "./profile-service";

const roleLabels: Record<string, string> = {
  agent: "Procuratore",
  club_admin: "Societa'",
  coach: "Allenatore",
  director: "Dirigente",
  player: "Calciatore",
  staff: "Staff",
};

export function formatRole(value: string | null): string {
  if (!value) {
    return "Ruolo non definito";
  }

  return roleLabels[value] ?? value;
}

export function formatPosition(value: string | null): string {
  return getPlayerPositionLabel(value, "Posizione non definita");
}

export function formatLocation(
  city: string | null,
  region: string | null,
): string {
  return [city, region].filter(Boolean).join(" · ") || "Localita' non definita";
}

const CATEGORY_LEVEL_ORDER = [
  "Serie A", "Serie B", "Serie C", "Serie D",
  "Eccellenza", "Promozione", "Prima Categoria",
  "Seconda Categoria", "Terza Categoria",
  "Juniores", "Allievi", "Giovanissimi",
];

export type PlayerBackground = {
  primaryPosition: string | null;
  careerYears: number;
  topCategory: string | null;
  totalAppearances: number;
  totalGoals: number;
  totalAssists: number;
};

export function computePlayerBackground(
  entries: (CoachPlayerCareerEntryRecord | StaffPlayerCareerEntryRecord)[],
): PlayerBackground {
  if (!entries.length) {
    return { primaryPosition: null, careerYears: 0, topCategory: null, totalAppearances: 0, totalGoals: 0, totalAssists: 0 };
  }
  const posCount: Record<string, number> = {};
  entries.forEach((e) => {
    if (e.position) posCount[e.position] = (posCount[e.position] ?? 0) + 1;
  });
  const primaryPosition = Object.entries(posCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const seasons = new Set(entries.map((e) => e.season).filter(Boolean));
  const careerYears = seasons.size;
  let topCategory: string | null = null;
  let topIndex = Infinity;
  entries.forEach((e) => {
    if (!e.category) return;
    const idx = CATEGORY_LEVEL_ORDER.indexOf(e.category);
    if (idx !== -1 && idx < topIndex) {
      topIndex = idx;
      topCategory = e.category;
    } else if (idx === -1 && topCategory === null) {
      topCategory = e.category;
    }
  });
  const totalAppearances = entries.reduce((s, e) => s + (e.appearances ?? 0), 0);
  const totalGoals = entries.reduce((s, e) => s + (e.goals ?? 0), 0);
  const totalAssists = entries.reduce((s, e) => s + (e.assists ?? 0), 0);
  return { primaryPosition, careerYears, topCategory, totalAppearances, totalGoals, totalAssists };
}

// ────────────────────────────────
// Coach experience years (merged, non-overlapping intervals)
// ────────────────────────────────

type MonthInterval = [number, number];

function monthIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}

function parseMonthValue(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
}

function parseSeasonStartYear(seasonLabel: string): number | null {
  const parsed = Number.parseInt(seasonLabel.split("/")[0] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildCoachExperienceIntervals(
  entry: CoachCareerEntryRecord,
  now: Date,
): MonthInterval[] {
  if (entry.period_start_year) {
    const startMonth = parseMonthValue(entry.period_start_month) ?? 1;
    const start = monthIndex(entry.period_start_year, startMonth);

    const end = entry.period_end_year
      ? monthIndex(entry.period_end_year, parseMonthValue(entry.period_end_month) ?? 12)
      : monthIndex(now.getFullYear(), now.getMonth() + 1);

    return end >= start ? [[start, end]] : [];
  }

  // One interval per season so non-consecutive seasons at the same club are
  // not bridged into a single span; a season conventionally runs July -> June.
  return (entry.seasons ?? [])
    .map(parseSeasonStartYear)
    .filter((year): year is number => year !== null)
    .map((year): MonthInterval => [monthIndex(year, 7), monthIndex(year + 1, 6)]);
}

function mergeMonthIntervals(intervals: MonthInterval[]): MonthInterval[] {
  const sorted = [...intervals].sort((left, right) => left[0] - right[0]);
  const merged: MonthInterval[] = [];

  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];

    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  return merged;
}

/**
 * Computes total years of coaching experience from career entries, merging
 * overlapping or contiguous periods so time is never double-counted.
 * Entries with neither a reliable period nor parseable seasons are ignored.
 * Returns null when no reliable interval can be built or the total rounds to 0 years.
 */
export function computeCoachExperienceYears(
  entries: CoachCareerEntryRecord[],
  now: Date = new Date(),
): number | null {
  const intervals = entries.flatMap((entry) =>
    buildCoachExperienceIntervals(entry, now),
  );

  if (intervals.length === 0) {
    return null;
  }

  const mergedIntervals = mergeMonthIntervals(intervals);
  const totalMonths = mergedIntervals.reduce(
    (sum, [start, end]) => sum + (end - start + 1),
    0,
  );
  const years = Math.floor(totalMonths / 12);

  return years > 0 ? years : null;
}

export function formatCoachExperienceLabel(years: number): string {
  return years === 1 ? "1 anno di esperienza" : `${years} anni di esperienza`;
}

// ────────────────────────────────
// Situazione attuale e disponibilita geografica
// ────────────────────────────────

/**
 * "Sotto contratto" / "Svincolato" vengono dal dato, non dall esperienza.
 *
 * `contract_status` e una colonna `text` senza vincolo: qualsiasi altro
 * valore resta sconosciuto e non viene tradotto in una label inventata.
 */
export function formatContractStatus(
  status: string | null | undefined,
): string | null {
  if (status === "tesserato") {
    return "Sotto contratto";
  }

  if (status === "svincolato") {
    return "Svincolato";
  }

  return null;
}

/**
 * Zone disponibili. Con la modalita "tutta Italia" si mostra soltanto
 * "Ovunque in Italia": elencare anche regioni o province sarebbe una
 * contraddizione. `ALL_ITALY` e un valore legacy equivalente a `ITALY`.
 */
export function buildAvailabilityZonesLabel(
  availabilityType: string,
  regions: readonly string[],
  provinces: readonly string[],
): string | null {
  if (availabilityType === "ITALY" || availabilityType === "ALL_ITALY") {
    return "Ovunque in Italia";
  }

  if (availabilityType === "REGIONS") {
    const labels = regions.map((code) => getOptionLabel(REGION_OPTIONS, code));

    return labels.length > 0 ? labels.join(", ") : null;
  }

  if (availabilityType === "PROVINCES") {
    return provinces.length > 0 ? provinces.join(", ") : null;
  }

  return null;
}

/**
 * Macroarea geografica di una regione italiana (REV-PROF-09, "Area
 * operativa").
 *
 * Serve a dare alla regione dichiarata un contesto piu ampio — "Sicilia,
 * Isole" — senza chiedere all'utente un secondo dato che non esiste nel
 * modello. Una regione fuori elenco non produce nessuna macroarea: meglio una
 * riga piu corta di una classificazione inventata.
 */
const REGION_MACRO_AREAS: Record<string, string> = {
  Abruzzo: "Centro Italia",
  Basilicata: "Sud Italia",
  Calabria: "Sud Italia",
  Campania: "Sud Italia",
  "Emilia-Romagna": "Nord Italia",
  "Friuli-Venezia Giulia": "Nord Italia",
  Lazio: "Centro Italia",
  Liguria: "Nord Italia",
  Lombardia: "Nord Italia",
  Marche: "Centro Italia",
  Molise: "Sud Italia",
  Piemonte: "Nord Italia",
  Puglia: "Sud Italia",
  Sardegna: "Isole",
  Sicilia: "Isole",
  Toscana: "Centro Italia",
  "Trentino-Alto Adige": "Nord Italia",
  Umbria: "Centro Italia",
  "Valle d'Aosta": "Nord Italia",
  Veneto: "Nord Italia",
};

/**
 * Area operativa in formato compatto: "Sicilia, Isole".
 *
 * Nessuna regione dichiarata: si ricade sulla localita pubblica gia mostrata
 * altrove nel profilo, e se non c'e nemmeno quella la riga non esiste.
 */
export function buildOperatingAreaLabel(
  region: string | null | undefined,
  fallbackLocation?: string | null,
): string | null {
  const normalizedRegion = region?.trim();

  if (!normalizedRegion) {
    return fallbackLocation?.trim() || null;
  }

  const macroArea = REGION_MACRO_AREAS[normalizedRegion];

  return macroArea ? `${normalizedRegion}, ${macroArea}` : normalizedRegion;
}

// ────────────────────────────────
// Elenchi e disponibilita (REV-PROF-03)
// ────────────────────────────────

const LIST_SUMMARY_LIMIT = 3;

/**
 * Elenco di valori con sintesi "+N" (REV-PROF-03, "Opportunita" e "Profilo
 * tecnico"). La sintesi entra solo quando serve davvero: fino a
 * `LIST_SUMMARY_LIMIT` voci l'elenco resta per esteso, perche un "+1" al posto
 * di una parola non farebbe guadagnare niente.
 *
 * Nessun valore: la riga non esiste, invece di mostrare un placeholder.
 */
export function summarizeList(
  values: readonly (string | null | undefined)[],
  limit: number = LIST_SUMMARY_LIMIT,
): string | null {
  const cleaned = [
    ...new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  if (cleaned.length === 0) {
    return null;
  }

  if (cleaned.length <= limit) {
    return cleaned.join(", ");
  }

  return `${cleaned.slice(0, limit).join(", ")} +${cleaned.length - limit}`;
}

const AVAILABLE_FROM_MONTHS = [
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

/**
 * "Disponibile da" dell'Allenatore (REV-PROF-03).
 *
 * La colonna e nata come testo libero ("Fine stagione") e da REV-ONB-03 riceve
 * anche "YYYY-MM": l'uno viene mostrato com'e, l'altro tradotto in "Luglio
 * 2026". Chi e disponibile ma non ha indicato una data e disponibile adesso.
 * Chi non e disponibile non ha una data da mostrare.
 */
export function formatCoachAvailableFrom(
  availableFrom: string | null | undefined,
  openToNewRole: boolean,
): string | null {
  const trimmed = availableFrom?.trim();

  if (!trimmed) {
    return openToNewRole ? "Da subito" : null;
  }

  const match = /^(\d{4})-(\d{2})$/.exec(trimmed);

  if (!match) {
    return trimmed;
  }

  const monthIndex = Number.parseInt(match[2] as string, 10) - 1;
  const monthLabel = AVAILABLE_FROM_MONTHS[monthIndex];

  return monthLabel ? `${monthLabel} ${match[1]}` : trimmed;
}
