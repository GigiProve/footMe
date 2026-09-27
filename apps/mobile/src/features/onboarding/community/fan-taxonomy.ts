/**
 * Vocabolario del ramo Tifoso (REV-ONB-08 §E, §J–§N, §Q).
 *
 * Due sole dimensioni vengono chieste in onboarding: *che* calcio seguire e
 * *dove* seguirlo. Tutto il resto — squadra del cuore, interessi, contenuti
 * preferiti — si ricava dopo, dal comportamento (§O, §P).
 */
import type Ionicons from "@expo/vector-icons/Ionicons";

// ---------------------------------------------------------------------------
// Scelta del percorso dentro "Media e tifosi" (§E, §F)
// ---------------------------------------------------------------------------

export type CommunityPath = "fan" | "media";

export type CommunityPathOption = {
  value: CommunityPath;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

/**
 * §F: line icon, stesso stroke, dimensione contenuta. Niente illustrazioni,
 * niente simboli caricaturali: sono due modi di stare nel calcio, non due
 * mascotte.
 *
 * REV-ONB-09 §6: il copy dice a che cosa serve il profilo, non che cosa
 * rappresenta in astratto. "Media/Creator" è il nome definitivo del
 * sotto-profilo professionale.
 */
export const COMMUNITY_PATH_OPTIONS: CommunityPathOption[] = [
  {
    description: "Per seguire, commentare e vivere il calcio.",
    icon: "people-outline",
    label: "Tifoso",
    value: "fan",
  },
  {
    description: "Per creator, pagine, testate e progetti editoriali.",
    icon: "newspaper-outline",
    label: "Media/Creator",
    value: "media",
  },
];

// ---------------------------------------------------------------------------
// Che calcio seguire (§J–§N)
// ---------------------------------------------------------------------------

/**
 * Quattro macro-categorie, non quattordici campionati (§K). La scelta resta
 * alta: Serie A, Eccellenza o Giovanissimi non si chiedono in onboarding.
 */
export type FanFootballType = "professional" | "amateur" | "women" | "youth";

export type FanFootballTypeOption = {
  value: FanFootballType;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const FAN_FOOTBALL_TYPE_OPTIONS: FanFootballTypeOption[] = [
  {
    description: "Club e competizioni professionistiche.",
    icon: "trophy-outline",
    label: "Calcio professionistico",
    value: "professional",
  },
  {
    description: "Club e campionati del territorio.",
    icon: "flag-outline",
    label: "Calcio dilettantistico",
    value: "amateur",
  },
  {
    description: "Club e competizioni del calcio femminile.",
    icon: "female-outline",
    label: "Calcio femminile",
    value: "women",
  },
  {
    description: "Vivai, settori giovanili e talenti emergenti.",
    icon: "school-outline",
    label: "Calcio giovanile",
    value: "youth",
  },
];

const FAN_FOOTBALL_TYPE_VALUES = new Set<string>(
  FAN_FOOTBALL_TYPE_OPTIONS.map((option) => option.value),
);

export function isFanFootballType(value: unknown): value is FanFootballType {
  return typeof value === "string" && FAN_FOOTBALL_TYPE_VALUES.has(value);
}

/**
 * Etichette leggibili dei valori persistiti, nell'ordine ufficiale delle
 * opzioni: il profilo non deve mostrare `professional` (§AF, §AG).
 */
export function formatFanFootballTypes(
  values: readonly string[] | null | undefined,
): string[] {
  if (!values || values.length === 0) {
    return [];
  }

  const selected = new Set(values);

  return FAN_FOOTBALL_TYPE_OPTIONS.filter((option) =>
    selected.has(option.value),
  ).map((option) => option.label);
}

// ---------------------------------------------------------------------------
// Dove seguire il calcio (§Q–§S)
// ---------------------------------------------------------------------------

/**
 * Copy delle tre modalità geografiche. La meccanica è quella approvata per la
 * Disponibilità geografica del Calciatore (REV-ONB-02 §S–§X), il copy no: il
 * Tifoso non dichiara dove è disposto a trasferirsi (§Q).
 */
export const FAN_TERRITORY_MODE_COPY = {
  ITALY: {
    description: "Segui il calcio da tutto il territorio nazionale.",
    icon: "globe-outline",
    title: "Tutta Italia",
  },
  PROVINCES: {
    description: "Seleziona le province che ti interessano di più.",
    icon: "location-outline",
    title: "Zone specifiche",
  },
  REGIONS: {
    description: "Scegli le regioni che vuoi seguire.",
    icon: "map-outline",
    title: "In una o più regioni",
  },
} as const satisfies Record<
  "ITALY" | "REGIONS" | "PROVINCES",
  { description: string; icon: keyof typeof Ionicons.glyphMap; title: string }
>;
