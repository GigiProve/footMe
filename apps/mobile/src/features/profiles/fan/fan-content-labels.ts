/**
 * Etichette e formati dei contenuti del Tifoso (REV-PROF-19).
 *
 * Una sola fonte per il nome e l'icona di ogni tipo di contenuto, così la
 * card della Tribuna, il bottom sheet "Crea" e il dettaglio non divergono.
 */
import type Ionicons from "@expo/vector-icons/Ionicons";

import type { FanTribunaKind } from "../fan-tribuna-service";

export function getFanContentLabel(kind: FanTribunaKind): string {
  switch (kind) {
    case "formation":
      return "Formazione";
    case "proposal":
      return "Proposta";
    case "opinion":
      return "Opinione";
    case "photo":
      return "Foto / Video";
    case "poll":
    default:
      return "Sondaggio";
  }
}

export function getFanContentIcon(
  kind: FanTribunaKind,
): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case "formation":
      return "football-outline";
    case "proposal":
      return "bulb-outline";
    case "opinion":
      return "chatbubble-ellipses-outline";
    case "photo":
      return "videocam-outline";
    case "poll":
    default:
      return "stats-chart-outline";
  }
}

/** Conteggi sempre localizzati: "1.204", non "1204". */
export function formatFanCount(value: number): string {
  return new Intl.NumberFormat("it-IT").format(Math.max(0, value));
}

/**
 * Tempo relativo compatto della card — "3g", "2h", "ora" — con la data
 * estesa oltre la settimana, dove il relativo smette di dire qualcosa.
 *
 * `now` è iniettabile perché il formato dipende dall'orologio e un test non
 * deve aspettare che passi un giorno.
 */
export function formatFanRelativeDate(
  value: string | null,
  now: Date = new Date(),
): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const elapsedMinutes = Math.floor(
    (now.getTime() - date.getTime()) / (60 * 1000),
  );

  if (elapsedMinutes < 1) {
    return "ora";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 8) {
    return `${elapsedDays}g`;
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
  }).format(date);
}
