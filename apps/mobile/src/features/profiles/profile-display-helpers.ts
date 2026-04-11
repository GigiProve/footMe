import { getPlayerPositionLabel } from "./player-sports";
import type {
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
