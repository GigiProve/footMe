export type SportsSelectOption<T extends string = string> = {
  label: string;
  value: T;
};

export type PreferredFoot = "right" | "left" | "both";

export type PlayerPosition =
  | "goalkeeper"
  | "defender"
  | "center_back"
  | "right_back"
  | "left_back"
  | "midfielder"
  | "defensive_midfielder"
  | "central_midfielder"
  | "attacking_midfielder"
  | "forward"
  | "right_winger"
  | "left_winger"
  | "striker";

export type TeamAutocompleteOption = {
  city: string | null;
  id: string | null;
  isCustom?: boolean;
  logoUrl: string | null;
  name: string;
};

export type PlayerExperienceForm = {
  appearances: string;
  assists: string;
  awards: string;
  category: string;
  clubId: string | null;
  clubName: string;
  goals: string;
  id?: string;
  minutesPlayed: string;
  seasonLabel: string;
  teamCity: string;
  teamLogoUrl: string;
};

export type PlayerExperiencePayload = {
  appearances: number;
  assists: number;
  awards: string | null;
  club_id: string | null;
  club_name: string;
  competition_name: string | null;
  goals: number;
  id?: string;
  minutes_played: number;
  season_label: string;
  sort_order: number;
  team_logo_url: string | null;
};

type PlayerExperienceSource = {
  appearances: number;
  assists: number;
  awards?: string | null;
  club_id?: string | null;
  club_name: string;
  competition_name?: string | null;
  goals: number;
  id?: string;
  minutes_played?: number;
  season_label: string;
  team_logo_url?: string | null;
};

export const DEFAULT_PLAYER_PRIMARY_POSITION: PlayerPosition = "central_midfielder";

export const PLAYER_POSITION_OPTIONS: SportsSelectOption<PlayerPosition>[] = [
  { label: "Portiere", value: "goalkeeper" },
  { label: "Difensore centrale", value: "center_back" },
  { label: "Terzino destro", value: "right_back" },
  { label: "Terzino sinistro", value: "left_back" },
  { label: "Centrocampista difensivo", value: "defensive_midfielder" },
  { label: "Centrocampista centrale", value: "central_midfielder" },
  { label: "Trequartista", value: "attacking_midfielder" },
  { label: "Ala destra", value: "right_winger" },
  { label: "Ala sinistra", value: "left_winger" },
  { label: "Attaccante", value: "striker" },
];

export const PREFERRED_FOOT_OPTIONS: SportsSelectOption<PreferredFoot>[] = [
  { label: "Destro", value: "right" },
  { label: "Sinistro", value: "left" },
  { label: "Ambidestro", value: "both" },
];

export const PLAYER_CATEGORY_OPTIONS: SportsSelectOption[] = [
  { label: "Serie D", value: "Serie D" },
  { label: "Eccellenza", value: "Eccellenza" },
  { label: "Promozione", value: "Promozione" },
  { label: "Prima categoria", value: "Prima categoria" },
  { label: "Seconda categoria", value: "Seconda categoria" },
  { label: "Terza categoria", value: "Terza categoria" },
  { label: "Juniores", value: "Juniores" },
];

export function createPlayerSeasonOptions(startYear = 2024, totalSeasons = 4) {
  return Array.from({ length: totalSeasons }, (_, index) => {
    const currentStartYear = startYear - index;
    const currentEndYear = currentStartYear + 1;
    const label = `${currentStartYear}/${currentEndYear}`;

    return {
      label,
      value: label,
    };
  });
}

export const PLAYER_SEASON_OPTIONS = createPlayerSeasonOptions();

function expandTwoDigitSeasonYear(startYear: number, endYear: number) {
  const currentYear = new Date().getFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;
  const currentCenturyThreshold = (currentYear % 100) + 1;
  const baseCentury = startYear <= currentCenturyThreshold ? currentCentury : currentCentury - 100;
  const normalizedStartYear = baseCentury + startYear;
  const normalizedEndYear =
    endYear >= startYear ? baseCentury + endYear : baseCentury + 100 + endYear;

  return {
    normalizedEndYear,
    normalizedStartYear,
  };
}

const playerPositionLabels: Record<PlayerPosition, string> = {
  attacking_midfielder: "Trequartista",
  center_back: "Difensore centrale",
  central_midfielder: "Centrocampista centrale",
  defender: "Difensore",
  defensive_midfielder: "Centrocampista difensivo",
  forward: "Attaccante",
  goalkeeper: "Portiere",
  left_back: "Terzino sinistro",
  left_winger: "Ala sinistra",
  midfielder: "Centrocampista",
  right_back: "Terzino destro",
  right_winger: "Ala destra",
  striker: "Attaccante",
};

const preferredFootLabels: Record<PreferredFoot, string> = {
  both: "Ambidestro",
  left: "Sinistro",
  right: "Destro",
};

export function isPlayerPosition(value: unknown): value is PlayerPosition {
  return typeof value === "string" && value in playerPositionLabels;
}

export function getPlayerPositionLabel(
  value: PlayerPosition | string | null | undefined,
  fallback = "Da completare",
) {
  if (!value || !isPlayerPosition(value)) {
    return fallback;
  }

  return playerPositionLabels[value];
}

export function getPreferredFootLabel(
  value: PreferredFoot | null | undefined,
  fallback = "Da completare",
) {
  if (!value) {
    return fallback;
  }

  return preferredFootLabels[value] ?? fallback;
}

export function createEmptyPlayerExperienceForm(): PlayerExperienceForm {
  return {
    appearances: "",
    assists: "",
    awards: "",
    category: "",
    clubId: null,
    clubName: "",
    goals: "",
    minutesPlayed: "",
    seasonLabel: "",
    teamCity: "",
    teamLogoUrl: "",
  };
}

export function normalizeNumericInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

function parseNonNegativeStat(
  value: string,
  fieldLabel: string,
  {
    allowEmpty = true,
  }: {
    allowEmpty?: boolean;
  } = {},
) {
  const trimmed = value.trim();

  if (!trimmed) {
    if (allowEmpty) {
      return 0;
    }

    throw new Error(`${fieldLabel} è obbligatorio.`);
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${fieldLabel} deve contenere solo numeri validi.`);
  }

  return Number(trimmed);
}

function parseOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeSeasonLabelInput(value: string) {
  const compactValue = value.replace(/\s+/g, "");

  const fullPatternMatch = compactValue.match(/^(\d{4})\/(\d{4})$/);

  if (fullPatternMatch) {
    const startYear = Number(fullPatternMatch[1]);
    const endYear = Number(fullPatternMatch[2]);

    return endYear === startYear + 1 ? `${startYear}/${endYear}` : compactValue;
  }

  const mixedPatternMatch = compactValue.match(/^(\d{4})\/(\d{2})$/);

  if (mixedPatternMatch) {
    const startYear = Number(mixedPatternMatch[1]);
    const century = Math.floor(startYear / 100) * 100;
    const normalizedEndYear = century + Number(mixedPatternMatch[2]);

    return `${startYear}/${normalizedEndYear}`;
  }

  const shortPatternMatch = compactValue.match(/^(\d{2})\/(\d{2})$/);

  if (shortPatternMatch) {
    const { normalizedEndYear, normalizedStartYear } = expandTwoDigitSeasonYear(
      Number(shortPatternMatch[1]),
      Number(shortPatternMatch[2]),
    );

    return `${normalizedStartYear}/${normalizedEndYear}`;
  }

  if (/^\d{8}$/.test(compactValue)) {
    const digitsOnly = compactValue;
    return `${digitsOnly.slice(0, 4)}/${digitsOnly.slice(4, 8)}`;
  }

  if (/^\d{4}$/.test(compactValue)) {
    const digitsOnly = compactValue;
    const { normalizedEndYear, normalizedStartYear } = expandTwoDigitSeasonYear(
      Number(digitsOnly.slice(0, 2)),
      Number(digitsOnly.slice(2, 4)),
    );

    return `${normalizedStartYear}/${normalizedEndYear}`;
  }

  return compactValue;
}

export function isSeasonLabelValid(value: string) {
  const normalizedValue = normalizeSeasonLabelInput(value);
  const match = normalizedValue.match(/^(\d{4})\/(\d{4})$/);

  if (!match) {
    return false;
  }

  return Number(match[2]) === Number(match[1]) + 1;
}

export function getSeasonStartYear(value: string) {
  if (!isSeasonLabelValid(value)) {
    return null;
  }

  return Number(normalizeSeasonLabelInput(value).slice(0, 4));
}

export function sortPlayerExperiencesBySeason<T extends { seasonLabel: string }>(entries: T[]) {
  return [...entries].sort((left, right) => {
    const leftYear = getSeasonStartYear(left.seasonLabel) ?? -1;
    const rightYear = getSeasonStartYear(right.seasonLabel) ?? -1;

    if (leftYear === rightYear) {
      return right.seasonLabel.localeCompare(left.seasonLabel);
    }

    return rightYear - leftYear;
  });
}

export function hasPlayerExperienceContent(entry: PlayerExperienceForm) {
  return Boolean(
    entry.clubName.trim() ||
      entry.seasonLabel.trim() ||
      entry.category.trim() ||
      entry.appearances.trim() ||
      entry.goals.trim() ||
      entry.assists.trim() ||
      entry.minutesPlayed.trim() ||
      entry.awards.trim(),
  );
}

export function toPlayerExperienceForm(
  entry: PlayerExperienceSource,
): PlayerExperienceForm {
  return {
    appearances: String(entry.appearances ?? 0),
    assists: String(entry.assists ?? 0),
    awards: entry.awards ?? "",
    category: entry.competition_name ?? "",
    clubId: entry.club_id ?? null,
    clubName: entry.club_name,
    goals: String(entry.goals ?? 0),
    id: entry.id,
    minutesPlayed: String(entry.minutes_played ?? 0),
    seasonLabel: normalizeSeasonLabelInput(entry.season_label),
    teamCity: "",
    teamLogoUrl: entry.team_logo_url ?? "",
  };
}

export function parsePlayerExperienceForms(entries: PlayerExperienceForm[]) {
  return sortPlayerExperiencesBySeason(entries.filter(hasPlayerExperienceContent)).map(
    (entry, index): PlayerExperiencePayload => {
      const seasonLabel = normalizeSeasonLabelInput(entry.seasonLabel);
      const clubName = entry.clubName.trim();
      const category = entry.category.trim();

      if (!clubName) {
        throw new Error(`Inserisci la squadra per l'esperienza ${index + 1}.`);
      }

      if (!isSeasonLabelValid(seasonLabel)) {
        throw new Error(
          `La stagione dell'esperienza ${index + 1} deve essere nel formato 2024/2025.`,
        );
      }

      if (!category) {
        throw new Error(`Seleziona la categoria per l'esperienza ${index + 1}.`);
      }

      return {
        appearances: parseNonNegativeStat(entry.appearances, "Presenze"),
        assists: parseNonNegativeStat(entry.assists, "Assist"),
        awards: parseOptionalText(entry.awards),
        club_id: entry.clubId,
        club_name: clubName,
        competition_name: category,
        goals: parseNonNegativeStat(entry.goals, "Gol"),
        id: entry.id,
        minutes_played: parseNonNegativeStat(entry.minutesPlayed, "Minuti giocati"),
        season_label: seasonLabel,
        sort_order: index,
        team_logo_url: parseOptionalText(entry.teamLogoUrl),
      };
    },
  );
}

export function getPlayerExperienceBadges(experience: Pick<
  PlayerExperienceForm,
  "appearances" | "assists" | "goals"
>) {
  const appearances = parseNonNegativeStat(experience.appearances, "Presenze");
  const goals = parseNonNegativeStat(experience.goals, "Gol");
  const assists = parseNonNegativeStat(experience.assists, "Assist");
  const badges: string[] = [];

  if (goals >= 10) {
    badges.push("⚽ 10+ gol stagione");
  }

  if (appearances >= 20) {
    badges.push("🔥 20+ presenze");
  }

  if (assists >= 5) {
    badges.push("🎯 5+ assist");
  }

  if (appearances >= 30) {
    badges.push("⭐ Stagione completa");
  }

  return badges;
}

export function getLatestPlayerExperience(entries: PlayerExperienceForm[]) {
  return (
    sortPlayerExperiencesBySeason(entries).find(
      (entry) => entry.clubName.trim() && entry.category.trim(),
    ) ??
    sortPlayerExperiencesBySeason(entries).find(
      (entry) => entry.clubName.trim() || entry.category.trim(),
    ) ??
    null
  );
}
