import type { PlayerPosition } from "../../profiles/player-sports";

export const AGENT_MANAGED_PLAYERS_OPTIONS = [
  "1-5 calciatori",
  "5-15 calciatori",
  "15+ calciatori",
] as const;

export const AGENT_FOOTBALL_ROLE_OPTIONS = [
  "Ex calciatore",
  "Direttore sportivo",
  "Allenatore",
  "Scout",
  "Staff tecnico",
  "Altro",
] as const;

export const AGENT_PLAYER_TYPE_OPTIONS = [
  "Giovani",
  "Senior",
  "Entrambi",
] as const;

export const AGENT_PLAYER_ROLE_OPTIONS: {
  label: string;
  value: PlayerPosition;
}[] = [
  { label: "Portiere", value: "goalkeeper" },
  { label: "Difensore", value: "defender" },
  { label: "Centrocampista", value: "midfielder" },
  { label: "Attaccante", value: "forward" },
];

export const AGENT_LANGUAGE_OPTIONS = [
  "Italiano",
  "Inglese",
  "Francese",
  "Spagnolo",
  "Tedesco",
  "Portoghese",
] as const;

export const AGENT_FEDERATION_OPTIONS = [
  { label: "FIGC (Italia)", value: "FIGC (Italia)" },
  { label: "FIGC SGS", value: "FIGC SGS" },
  { label: "Federazione Svizzera", value: "Federazione Svizzera" },
  { label: "UEFA", value: "UEFA" },
] as const;
