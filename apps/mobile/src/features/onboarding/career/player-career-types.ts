export type PlayerCareerType = "MULTI_SEASON" | "SINGLE_SEASON" | "CUSTOM_PERIOD";

export type PlayerSeasonDetail = {
  category: string;
  appearances: string;
  goals: string;
  assists: string;
  minutesPlayed: string;
  awards: string;
};

export type PlayerCareerEntry = {
  id: string;
  teamName: string;
  category: string; // used for single season; defaults for new seasons
  type: PlayerCareerType;
  seasons: string[]; // used for MULTI_SEASON and SINGLE_SEASON
  period: {
    startMonth: string;
    startYear: string;
    endMonth: string;
    endYear: string;
  } | null; // used for CUSTOM_PERIOD
  seasonDetails: Record<string, PlayerSeasonDetail>; // keyed by season label "2024/2025"
};
