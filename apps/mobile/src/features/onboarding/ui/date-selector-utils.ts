/**
 * Formati canonici dei periodi dell'onboarding (§Y).
 *
 * Il valore viaggia sempre come stringa, così uno step può salvarlo senza
 * conversioni: "2026-01-12" · "2026-01" · "2026" · "2023/24".
 */
export type DateSelectorMode = "date" | "monthYear" | "year" | "season";

export const MONTH_NAMES = [
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
] as const;

export function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

type DateParts = {
  day?: number;
  month?: number;
  year?: number;
  season?: string;
};

export function parseDateSelectorValue(
  mode: DateSelectorMode,
  value: string,
): DateParts {
  if (!value) {
    return {};
  }

  if (mode === "season") {
    return { season: value };
  }

  const [rawYear, rawMonth, rawDay] = value.split("-");
  const year = Number.parseInt(rawYear ?? "", 10);
  const month = Number.parseInt(rawMonth ?? "", 10);
  const day = Number.parseInt(rawDay ?? "", 10);

  return {
    day: Number.isNaN(day) ? undefined : day,
    month: Number.isNaN(month) ? undefined : month,
    year: Number.isNaN(year) ? undefined : year,
  };
}

export function buildDateSelectorValue(
  mode: DateSelectorMode,
  parts: DateParts,
): string {
  if (mode === "season") {
    return parts.season ?? "";
  }

  if (!parts.year) {
    return "";
  }

  if (mode === "year") {
    return String(parts.year);
  }

  if (!parts.month) {
    return "";
  }

  const month = String(parts.month).padStart(2, "0");

  if (mode === "monthYear") {
    return `${parts.year}-${month}`;
  }

  if (!parts.day) {
    return "";
  }

  return `${parts.year}-${month}-${String(parts.day).padStart(2, "0")}`;
}

/** Etichetta leggibile del valore: "12 gennaio 2026", "Gennaio 2026", "2023/24". */
export function formatDateSelectorValue(
  mode: DateSelectorMode,
  value: string,
): string {
  if (!value) {
    return "";
  }

  if (mode === "season") {
    return value;
  }

  const { day, month, year } = parseDateSelectorValue(mode, value);

  if (!year) {
    return "";
  }

  if (mode === "year") {
    return String(year);
  }

  const monthName = month ? MONTH_NAMES[month - 1] : undefined;

  if (!monthName) {
    return String(year);
  }

  if (mode === "monthYear") {
    return `${monthName} ${year}`;
  }

  return day ? `${day} ${monthName.toLowerCase()} ${year}` : `${monthName} ${year}`;
}

/** Elenco di stagioni discendenti: "2025/26", "2024/25", … */
export function buildSeasonOptions(count: number, endYear?: number) {
  const start = endYear ?? new Date().getFullYear();

  return Array.from({ length: count }, (_, index) => {
    const from = start - index;
    const to = String((from + 1) % 100).padStart(2, "0");

    return `${from}/${to}`;
  });
}

export function buildYearOptions(fromYear: number, toYear: number) {
  const years: number[] = [];

  for (let year = toYear; year >= fromYear; year -= 1) {
    years.push(year);
  }

  return years;
}
