/**
 * Layout del campo da calcio verticale del profilo sportivo (REV-ONB-02 §M–§N).
 *
 * Le posizioni derivano dalla tassonomia ruoli già in uso in ProLink
 * (`PLAYER_POSITION_OPTIONS`): qui si dichiara soltanto *dove* ognuna sta sul
 * campo e con quale abbreviazione viene letta. Nessun ruolo nuovo.
 *
 * Le coordinate sono frazioni del rettangolo di gioco (0 = alto/sinistra,
 * 1 = basso/destra). Il campo è visto dall'alto con l'attacco in alto, come
 * nello screen approvato.
 */
import {
  getPlayerPositionLabel,
  type PlayerPosition,
} from "../../profiles/player-sports";

export type PitchSlot = {
  /** Sigla mostrata dentro il nodo: POR, DC, TD, TS, MED, CC, TRQ, AS, AD, ATT. */
  abbreviation: string;
  position: PlayerPosition;
  /** 0 = linea laterale sinistra, 1 = linea laterale destra. */
  x: number;
  /** 0 = linea di fondo avversaria (attacco), 1 = porta difesa. */
  y: number;
};

export const PITCH_SLOTS: PitchSlot[] = [
  { abbreviation: "ATT", position: "striker", x: 0.5, y: 0.11 },
  { abbreviation: "AS", position: "left_winger", x: 0.17, y: 0.19 },
  { abbreviation: "AD", position: "right_winger", x: 0.83, y: 0.19 },
  { abbreviation: "TRQ", position: "attacking_midfielder", x: 0.5, y: 0.31 },
  { abbreviation: "CC", position: "central_midfielder", x: 0.5, y: 0.45 },
  { abbreviation: "MED", position: "defensive_midfielder", x: 0.5, y: 0.59 },
  { abbreviation: "TS", position: "left_back", x: 0.15, y: 0.735 },
  { abbreviation: "DC", position: "center_back", x: 0.5, y: 0.745 },
  { abbreviation: "TD", position: "right_back", x: 0.85, y: 0.735 },
  { abbreviation: "POR", position: "goalkeeper", x: 0.5, y: 0.9 },
];

export type PitchSlotState = "primary" | "secondary" | "idle";

export function getPitchSlotState(
  position: PlayerPosition,
  primaryPosition: PlayerPosition | "",
  secondaryPosition: PlayerPosition | "",
): PitchSlotState {
  if (primaryPosition === position) {
    return "primary";
  }

  if (secondaryPosition === position) {
    return "secondary";
  }

  return "idle";
}

/**
 * Etichetta per screen reader (§BX): il ruolo non può essere comprensibile
 * solo dalla posizione del pallino sul campo.
 */
export function getPitchSlotAccessibilityLabel(
  position: PlayerPosition,
  state: PitchSlotState,
): string {
  const label = getPlayerPositionLabel(position);

  if (state === "primary") {
    return `${label} — ruolo principale`;
  }

  if (state === "secondary") {
    return `${label} — ruolo secondario`;
  }

  return `${label} — non selezionato`;
}

/**
 * Ruolo secondario ammesso dopo un cambio di ruolo principale (§R): il
 * secondario non può coincidere con il principale.
 */
export function revalidateSecondaryPosition(
  secondaryPosition: PlayerPosition | "",
  nextPrimaryPosition: PlayerPosition | "",
): PlayerPosition | "" {
  return secondaryPosition && secondaryPosition === nextPrimaryPosition
    ? ""
    : secondaryPosition;
}

/** Opzioni del selector "Ruolo secondario": tutte tranne il principale. */
export function getSecondaryPositionOptions(
  primaryPosition: PlayerPosition | "",
) {
  return PITCH_SLOTS.filter((slot) => slot.position !== primaryPosition).map(
    (slot) => ({
      label: `${getPlayerPositionLabel(slot.position)} (${slot.abbreviation})`,
      value: slot.position,
    }),
  );
}
