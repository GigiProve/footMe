export type CoachExperienceType = "MULTI_SEASON" | "SINGLE_SEASON" | "CUSTOM_PERIOD";

export type CoachCareerEntry = {
  id: string;
  teamName: string;
  category: string;
  role: string;
  type: CoachExperienceType;
  seasons: string[]; // used for MULTI_SEASON and SINGLE_SEASON
  period: {
    startMonth: string; // optional, empty string if not set
    startYear: string;
    endMonth: string; // optional
    endYear: string;
  } | null; // used for CUSTOM_PERIOD
};

export type SimplePlayerCareerEntry = {
  id: string;
  teamName: string;
  season: string;
  category: string;
  position: string;
};
