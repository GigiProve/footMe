import { getPlayerPositionLabel } from "./player-sports";

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
