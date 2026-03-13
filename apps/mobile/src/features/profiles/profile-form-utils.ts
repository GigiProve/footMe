import italianCities from "./italian-cities.json";

export type SelectOption<T extends string = string> = {
  label: string;
  value: T;
};

export type ItalianCityOption = {
  name: string;
  region: string;
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
const italianCityOptions = italianCities as ItalianCityOption[];
const normalizedItalianCityOptions = italianCityOptions.map((entry) => ({
  ...entry,
  normalizedName: normalizeLookupValue(entry.name),
}));

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

export function formatBirthDateInputValue(value: string | null | undefined) {
  const formattedValue = formatBirthDate(value);
  return formattedValue === "Da completare" ? "" : formattedValue;
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

export function normalizeBirthDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function parseBirthDateInput(
  value: string | null | undefined,
  currentDate = new Date(),
) {
  const normalizedValue = normalizeBirthDateInput(value ?? "");
  const match = normalizedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const numericDay = Number(day);
  const numericMonth = Number(month);
  const numericYear = Number(year);

  if (
    numericYear < FIRST_BIRTH_YEAR ||
    numericYear > currentDate.getFullYear() ||
    numericMonth < 1 ||
    numericMonth > 12 ||
    numericDay < 1
  ) {
    return null;
  }

  const candidate = new Date(numericYear, numericMonth - 1, numericDay);

  if (
    Number.isNaN(candidate.getTime()) ||
    candidate.getFullYear() !== numericYear ||
    candidate.getMonth() !== numericMonth - 1 ||
    candidate.getDate() !== numericDay
  ) {
    return null;
  }

  if (candidate > currentDate) {
    return null;
  }

  return {
    date: candidate,
    isoValue: formatBirthDateValue(candidate),
    normalizedValue,
  };
}

export function validateBirthDateInput(
  value: string | null | undefined,
  currentDate = new Date(),
) {
  const normalizedValue = normalizeBirthDateInput(value ?? "");

  if (!normalizedValue) {
    return {
      isValid: true,
      isoValue: null,
      message: null,
    };
  }

  const parsedValue = parseBirthDateInput(normalizedValue, currentDate);

  if (!parsedValue) {
    return {
      isValid: false,
      isoValue: null,
      message:
        "Inserisci una data valida in formato GG/MM/AAAA senza usare date future.",
    };
  }

  return {
    isValid: true,
    isoValue: parsedValue.isoValue,
    message: null,
  };
}

export function calculateAge(
  value: Date | string | null | undefined,
  currentDate = new Date(),
) {
  const parsedValue =
    value instanceof Date
      ? value
      : parseBirthDate(value) ?? parseBirthDateInput(value, currentDate)?.date ?? null;

  if (!parsedValue) {
    return null;
  }

  let age = currentDate.getFullYear() - parsedValue.getFullYear();
  const currentMonth = currentDate.getMonth();
  const birthMonth = parsedValue.getMonth();

  if (
    currentMonth < birthMonth ||
    (currentMonth === birthMonth && currentDate.getDate() < parsedValue.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export function formatProfileDisplayName(fullName: string, age: number | null | undefined) {
  const trimmedName = fullName.trim();

  if (!trimmedName) {
    return "Da completare";
  }

  return age === null || age === undefined ? trimmedName : `${trimmedName}, ${age}`;
}

export function formatLocationSummary(
  city: string | null | undefined,
  region: string | null | undefined,
) {
  const normalizedValues = [city, region].map((value) => value?.trim()).filter(Boolean);
  return normalizedValues.length > 0 ? normalizedValues.join(", ") : "Da completare";
}

export function getRegionFromCity(cityName: string) {
  return (
    normalizedItalianCityOptions.find(
      (entry) => entry.normalizedName === normalizeLookupValue(cityName),
    )?.region ?? ""
  );
}

export function getRegionsFromCity(cityName: string) {
  const normalizedName = normalizeLookupValue(cityName);
  const regions = normalizedItalianCityOptions
    .filter((entry) => entry.normalizedName === normalizedName)
    .map((entry) => entry.region);

  return Array.from(new Set(regions));
}

export function isRegionConsistentWithCity(cityName: string, region: string) {
  const normalizedRegion = region.trim();

  if (!cityName.trim() || !normalizedRegion) {
    return true;
  }

  return getRegionsFromCity(cityName).includes(normalizedRegion);
}

export function searchItalianCities(query: string, limit = 8) {
  const normalizedQuery = normalizeLookupValue(query);

  if (!normalizedQuery) {
    return [];
  }

  const startsWithMatches: ItalianCityOption[] = [];
  const includesMatches: ItalianCityOption[] = [];

  for (const entry of normalizedItalianCityOptions) {
    if (entry.normalizedName.startsWith(normalizedQuery)) {
      startsWithMatches.push({ name: entry.name, region: entry.region });
      continue;
    }

    if (entry.normalizedName.includes(normalizedQuery)) {
      includesMatches.push({ name: entry.name, region: entry.region });
    }
  }

  return [...startsWithMatches, ...includesMatches].slice(0, limit);
}

export function isItalianCity(cityName: string) {
  return Boolean(getRegionFromCity(cityName));
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

export function normalizeInstagramInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const normalizedValue = trimmed.replace(/^@+/, "");

  if (/^https?:\/\//i.test(normalizedValue)) {
    const match = normalizedValue.match(
      /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)\/?(?:\?.*)?$/i,
    );

    return match?.[1] ? `https://instagram.com/${match[1]}` : "";
  }

  return /^[A-Za-z0-9._]+$/.test(normalizedValue)
    ? `https://instagram.com/${normalizedValue}`
    : "";
}

export function normalizeFacebookInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const match = trimmed.match(
      /^https?:\/\/(?:www\.)?facebook\.com\/([A-Za-z0-9.\-]+)\/?(?:\?.*)?$/i,
    );

    return match?.[1] ? `https://facebook.com/${match[1]}` : "";
  }

  return /^[A-Za-z0-9.\-]+$/.test(trimmed) ? `https://facebook.com/${trimmed}` : "";
}

export function normalizeContactEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function normalizePhoneInput(value: string) {
  const compactValue = value.replace(/[^\d+]/g, "");

  if (!compactValue) {
    return "";
  }

  if (compactValue.startsWith("00")) {
    return `+${compactValue.slice(2).replace(/[^\d]/g, "")}`;
  }

  if (compactValue.startsWith("+")) {
    return `+${compactValue.slice(1).replace(/[^\d]/g, "")}`;
  }

  return compactValue.replace(/[^\d]/g, "");
}

export function isPhoneNumberValid(value: string) {
  const normalizedValue = normalizePhoneInput(value);
  // Prefer strict E.164 semantics for stored phone numbers so chat sharing can
  // always generate stable tel: links and avoid ambiguous local formats.
  return /^\+[1-9]\d{6,14}$/.test(normalizedValue);
}

export function getSocialDisplayValue(
  platform: "facebook" | "instagram",
  value: string | null | undefined,
) {
  const normalizedValue =
    platform === "instagram"
      ? normalizeInstagramInput(value ?? "")
      : normalizeFacebookInput(value ?? "");

  if (!normalizedValue) {
    return "";
  }

  const username = normalizedValue.split("/").filter(Boolean).at(-1) ?? "";
  return platform === "instagram" ? `@${username}` : username;
}

function normalizeLookupValue(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
