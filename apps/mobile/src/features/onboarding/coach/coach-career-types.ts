export type CoachExperienceType = "MULTI_SEASON" | "SINGLE_SEASON" | "CUSTOM_PERIOD";

export type CoachSeasonDetail = {
  category: string;
  role: string;
};

export type CoachCareerEntry = {
  clubId?: string | null;
  id: string;
  teamCity?: string;
  teamLogoUrl?: string | null;
  teamName: string;
  category: string; // used for single season; defaults for new seasons
  role: string; // used for single season; defaults for new seasons
  type: CoachExperienceType;
  seasons: string[]; // used for MULTI_SEASON and SINGLE_SEASON
  period: {
    startMonth: string; // optional, empty string if not set
    startYear: string;
    endMonth: string; // optional
    endYear: string;
  } | null; // used for CUSTOM_PERIOD
  seasonDetails: Record<string, CoachSeasonDetail>; // keyed by season label "2024/2025"
};

export type SimplePlayerCareerEntry = {
  id: string;
  teamName: string;
  season: string;
  category: string;
  position: string;
};
