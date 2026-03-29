export type CareerExperienceType = "FIRST_TEAM" | "YOUTH";

export type DurationType = "SEASON" | "PERIOD";

export type SeasonStats = {
  appearances: string;
  goals: string;
  assists: string;
};

export type CareerExperiencePeriod = {
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
};

export type CareerExperience = {
  id: string;
  type: CareerExperienceType;
  teamName: string;
  category: string;
  durationType: DurationType;
  seasons: string[];
  period: CareerExperiencePeriod | null;
  statsEnabled: boolean;
  stats: Record<string, SeasonStats>;
};
