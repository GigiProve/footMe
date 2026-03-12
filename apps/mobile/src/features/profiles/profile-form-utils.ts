export type SelectOption<T extends string = string> = {
  label: string;
  value: T;
};

export const REGION_OPTIONS: SelectOption[] = [
  { label: "Abruzzo", value: "Abruzzo" },
  { label: "Basilicata", value: "Basilicata" },
  { label: "Calabria", value: "Calabria" },
  { label: "Campania", value: "Campania" },
  { label: "Emilia-Romagna", value: "Emilia-Romagna" },
  { label: "Friuli-Venezia Giulia", value: "Friuli-Venezia Giulia" },
  { label: "Lazio", value: "Lazio" },
  { label: "Liguria", value: "Liguria" },
  { label: "Lombardia", value: "Lombardia" },
  { label: "Marche", value: "Marche" },
  { label: "Molise", value: "Molise" },
  { label: "Piemonte", value: "Piemonte" },
  { label: "Puglia", value: "Puglia" },
  { label: "Sardegna", value: "Sardegna" },
  { label: "Sicilia", value: "Sicilia" },
  { label: "Toscana", value: "Toscana" },
  { label: "Trentino-Alto Adige", value: "Trentino-Alto Adige" },
  { label: "Umbria", value: "Umbria" },
  { label: "Valle d'Aosta", value: "Valle d'Aosta" },
  { label: "Veneto", value: "Veneto" },
];

export const NATIONALITY_OPTIONS: SelectOption[] = [
  { label: "Albania", value: "AL" },
  { label: "Algeria", value: "DZ" },
  { label: "Argentina", value: "AR" },
  { label: "Australia", value: "AU" },
  { label: "Austria", value: "AT" },
  { label: "Belgio", value: "BE" },
  { label: "Bosnia ed Erzegovina", value: "BA" },
  { label: "Brasile", value: "BR" },
  { label: "Bulgaria", value: "BG" },
  { label: "Camerun", value: "CM" },
  { label: "Canada", value: "CA" },
  { label: "Cile", value: "CL" },
  { label: "Cina", value: "CN" },
  { label: "Colombia", value: "CO" },
  { label: "Corea del Sud", value: "KR" },
  { label: "Costa d'Avorio", value: "CI" },
  { label: "Croazia", value: "HR" },
  { label: "Danimarca", value: "DK" },
  { label: "Ecuador", value: "EC" },
  { label: "Egitto", value: "EG" },
  { label: "Francia", value: "FR" },
  { label: "Germania", value: "DE" },
  { label: "Ghana", value: "GH" },
  { label: "Giappone", value: "JP" },
  { label: "Grecia", value: "GR" },
  { label: "Inghilterra", value: "GB" },
  { label: "Irlanda", value: "IE" },
  { label: "Islanda", value: "IS" },
  { label: "Israele", value: "IL" },
  { label: "Italia", value: "IT" },
  { label: "Marocco", value: "MA" },
  { label: "Messico", value: "MX" },
  { label: "Nigeria", value: "NG" },
  { label: "Norvegia", value: "NO" },
  { label: "Paesi Bassi", value: "NL" },
  { label: "Paraguay", value: "PY" },
  { label: "Perù", value: "PE" },
  { label: "Polonia", value: "PL" },
  { label: "Portogallo", value: "PT" },
  { label: "Repubblica Ceca", value: "CZ" },
  { label: "Romania", value: "RO" },
  { label: "Scozia", value: "GB-SCT" },
  { label: "Senegal", value: "SN" },
  { label: "Serbia", value: "RS" },
  { label: "Slovacchia", value: "SK" },
  { label: "Slovenia", value: "SI" },
  { label: "Spagna", value: "ES" },
  { label: "Stati Uniti", value: "US" },
  { label: "Svezia", value: "SE" },
  { label: "Svizzera", value: "CH" },
  { label: "Togo", value: "TG" },
  { label: "Tunisia", value: "TN" },
  { label: "Turchia", value: "TR" },
  { label: "Ucraina", value: "UA" },
  { label: "Ungheria", value: "HU" },
  { label: "Uruguay", value: "UY" },
  { label: "Venezuela", value: "VE" },
];

export const BIRTH_MONTH_OPTIONS: SelectOption[] = [
  { label: "Gennaio", value: "01" },
  { label: "Febbraio", value: "02" },
  { label: "Marzo", value: "03" },
  { label: "Aprile", value: "04" },
  { label: "Maggio", value: "05" },
  { label: "Giugno", value: "06" },
  { label: "Luglio", value: "07" },
  { label: "Agosto", value: "08" },
  { label: "Settembre", value: "09" },
  { label: "Ottobre", value: "10" },
  { label: "Novembre", value: "11" },
  { label: "Dicembre", value: "12" },
];

// The current mobile MVP targets adult and senior amateur football profiles, so
// we cap the picker to a conservative historical range without introducing UX noise.
export const FIRST_BIRTH_YEAR = 1940;

export function ensureOption<T extends string>(
  options: SelectOption<T>[],
  value: T | "" | null | undefined,
) {
  if (!value || options.some((option) => option.value === value)) {
    return options;
  }

  return [{ label: value, value }, ...options];
}

export function getOptionLabel<T extends string>(
  options: SelectOption<T>[],
  value: T | "" | null | undefined,
  fallback = "Da completare",
) {
  if (!value) {
    return fallback;
  }

  return options.find((option) => option.value === value)?.label ?? value;
}

export function formatOptionalSummary(
  value: string | null | undefined,
  fallback = "Da completare",
) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function formatListSummary(
  values: string[] | null | undefined,
  fallback = "Da completare",
) {
  const normalized = (values ?? []).map((value) => value.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized.join(", ") : fallback;
}

export function formatBirthDate(value: string | null | undefined) {
  const parts = getBirthDateParts(value);

  if (!parts.day || !parts.month || !parts.year) {
    return "Da completare";
  }

  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function getBirthDateParts(value: string | null | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  return {
    day: match?.[3] ?? "",
    month: match?.[2] ?? "",
    year: match?.[1] ?? "",
  };
}

export function createBirthYearOptions(currentYear = new Date().getFullYear()) {
  return Array.from({ length: currentYear - FIRST_BIRTH_YEAR + 1 }, (_, index) => {
    const year = String(currentYear - index);
    return { label: year, value: year };
  });
}

export function createBirthDayOptions(year: string, month: string) {
  const daysInMonth =
    year && month
      ? new Date(Number(year), Number(month), 0).getDate()
      : 31;

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return { label: day, value: day };
  });
}

export function composeBirthDate(parts: {
  day: string;
  month: string;
  year: string;
}) {
  if (!parts.year || !parts.month || !parts.day) {
    return "";
  }

  const candidate = `${parts.year}-${parts.month}-${parts.day}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : "";
}

export function parseBirthDate(value: string | null | undefined) {
  const parts = getBirthDateParts(value);

  if (!parts.year || !parts.month || !parts.day) {
    return null;
  }

  const candidate = new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
  );

  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  return candidate;
}

export function formatBirthDateValue(date: Date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function normalizeSeasonLabelInput(value: string) {
  const compactValue = value.replace(/\s+/g, "");
  const shortPatternMatch = compactValue.match(/^(\d{2})\/?(\d{0,2})$/);

  if (shortPatternMatch) {
    const [, startYear, endYear] = shortPatternMatch;
    return endYear ? `${startYear}/${endYear}` : startYear;
  }

  const longPatternMatch = compactValue.match(/^(\d{4})\/?(\d{0,2})$/);

  if (longPatternMatch) {
    const [, startYear, endYear] = longPatternMatch;
    const normalizedStartYear = startYear.slice(-2);
    return endYear ? `${normalizedStartYear}/${endYear}` : normalizedStartYear;
  }

  if (/^\d+$/.test(compactValue)) {
    const digits = compactValue.slice(0, 4);
    return digits.length <= 2
      ? digits
      : `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
  }

  return compactValue.slice(0, 5);
}

export function isSeasonLabelValid(value: string) {
  return /^\d{2}\/\d{2}$/.test(value.trim());
}
