/**
 * Tassonomie della società (REV-ONB-05 §V, §Y, §BF).
 *
 * Le categorie non sono etichette libere digitate nello step: sono chiavi
 * stabili del modello condiviso, le stesse che la piattaforma usa per
 * filtri, discovery, offerte e matching. L'onboarding ne mostra il
 * sottoinsieme leggibile, non l'intero albero.
 */
import { SENIOR_CATEGORY_OPTIONS } from "../../profiles/player-sports";
import type { SelectorOption } from "../ui/BottomSheetSelector";

/**
 * Campionato della prima squadra (§V): la taxonomy senior della piattaforma,
 * non una lista copiata dal mockup.
 */
export const CLUB_FIRST_TEAM_CATEGORY_OPTIONS: SelectorOption<string>[] =
  SENIOR_CATEGORY_OPTIONS.map((option) => ({
    label: option.label,
    value: option.value,
  }));

/**
 * Macro-categorie del vivaio (§Y). In onboarding si dichiara la forma del
 * settore giovanile, non l'elenco delle annate: "Attività di base" raggruppa
 * le categorie più piccole (§AA), il dettaglio arriva dalla gestione club.
 */
export const CLUB_YOUTH_CATEGORY_OPTIONS: SelectorOption<string>[] = [
  { label: "Primavera", value: "Primavera" },
  { label: "Juniores", value: "Juniores" },
  { label: "Allievi", value: "Allievi" },
  { label: "Giovanissimi", value: "Giovanissimi" },
  { label: "Attività di base", value: "Attività di base" },
];

/**
 * Colori sociali (§L, §M): una collezione senza gerarchia. Non esistono un
 * colore principale e uno secondario, e l'ordine di selezione non conta.
 * Ogni voce porta anche il proprio nome, così la scelta non dipende dal solo
 * colore (§BH).
 */
export type ClubSocialColorOption = SelectorOption<string> & { hex: string };

export const CLUB_SOCIAL_COLOR_OPTIONS: ClubSocialColorOption[] = [
  { hex: "#1B4FD8", label: "Blu", value: "Blu" },
  { hex: "#0B2A6B", label: "Blu navy", value: "Blu navy" },
  { hex: "#1FA0E0", label: "Azzurro", value: "Azzurro" },
  { hex: "#D0021B", label: "Rosso", value: "Rosso" },
  { hex: "#7B1020", label: "Granata", value: "Granata" },
  { hex: "#F5A623", label: "Arancione", value: "Arancione" },
  { hex: "#F8D521", label: "Giallo", value: "Giallo" },
  { hex: "#1A9B54", label: "Verde", value: "Verde" },
  { hex: "#6B3FA0", label: "Viola", value: "Viola" },
  { hex: "#8B5E3C", label: "Marrone", value: "Marrone" },
  { hex: "#0C1B2A", label: "Nero", value: "Nero" },
  { hex: "#8E99A8", label: "Grigio", value: "Grigio" },
  { hex: "#FFFFFF", label: "Bianco", value: "Bianco" },
];

export function getClubSocialColorHex(value: string) {
  return CLUB_SOCIAL_COLOR_OPTIONS.find((option) => option.value === value)
    ?.hex;
}
