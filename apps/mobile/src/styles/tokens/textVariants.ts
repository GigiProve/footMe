import { TextStyle } from "react-native";

import { typography } from "./typography";

/**
 * Varianti testo del design "ProLink UI Upgrade".
 *
 * Le varianti Mulish (`display*`, `statValue`, `screenTitle`, `heroName`,
 * `numeric`) non impostano `fontWeight`: il peso è nel file del font e su iOS
 * un weight esplicito porterebbe a un peso sintetizzato.
 */
export const textVariants = {
  // ── Mulish — numeri, statistiche, titoli di schermata, nomi in hero ────
  displayLg: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize[34],
    letterSpacing: typography.letterSpacing.tight,
    lineHeight: typography.lineHeight[38],
  },
  displaySm: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize[28],
    letterSpacing: typography.letterSpacing.tight,
    lineHeight: typography.lineHeight[32],
  },
  /** Titolo di schermata: "Cerca", "Annunci", "Messaggi". */
  screenTitle: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize[26],
    letterSpacing: typography.letterSpacing.tight,
    lineHeight: typography.lineHeight[32],
  },
  /** Nome in hero sopra l'header ink. */
  heroName: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize[25],
    letterSpacing: typography.letterSpacing.tight,
    lineHeight: typography.lineHeight[28],
  },
  /** Valore di una statistica (presenze, minuti, gol). */
  statValue: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize[28],
    lineHeight: typography.lineHeight[28],
  },
  /** Numero inline: iniziali avatar, stagione, contatore su tab. */
  numeric: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize[14],
    lineHeight: typography.lineHeight[18],
  },

  // ── System UI — tutto il resto ─────────────────────────────────────────
  headingLg: {
    fontSize: typography.fontSize[24],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight[28],
  },
  headingMd: {
    fontSize: typography.fontSize[20],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight[26],
  },
  headingSm: {
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight[24],
  },
  /** Titolo del corpo di un modulo (§1a: 15/700). */
  titleMd: {
    fontSize: typography.fontSize[15.5],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight[20],
  },
  /** Titolo di riga in lista o in card (§1d: 14,5/700). */
  titleSm: {
    fontSize: typography.fontSize[14.5],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight[20],
  },
  bodyLg: {
    fontSize: typography.fontSize[13.5],
    fontWeight: typography.fontWeight.regular,
    lineHeight: typography.lineHeight[20],
  },
  bodySm: {
    fontSize: typography.fontSize[12.5],
    fontWeight: typography.fontWeight.regular,
    lineHeight: typography.lineHeight[18],
  },
  /** Riga meta sotto il titolo: "Athletic Carpi · Prima squadra · Serie D". */
  meta: {
    fontSize: typography.fontSize[12.5],
    fontWeight: typography.fontWeight.regular,
    lineHeight: typography.lineHeight[19],
  },
  /** Riga meta con più peso, quando è l'unica informazione sotto al titolo. */
  metaStrong: {
    fontSize: typography.fontSize[12.5],
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight[19],
  },
  caption: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.regular,
    lineHeight: typography.lineHeight[16],
  },
  /** Etichetta di un'azione nel rail: "Candidati", "Leggi articolo". */
  actionLabel: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight[18],
  },
  /** Etichetta di tab attiva/inattiva (il peso cambia, la size no). */
  tabLabel: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight[18],
  },
  /** Etichetta della bottom nav. */
  navLabel: {
    fontSize: typography.fontSize[10.5],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight[14],
  },
  /** Testo dentro una chip. */
  chipLabel: {
    fontSize: typography.fontSize[11.5],
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight[16],
  },
  /**
   * Eyebrow — dice sempre perché quel blocco è lì ("Per te", "Carriera",
   * "In base al tuo profilo"). 10,5px maiuscolo, in cima a ogni modulo.
   */
  eyebrow: {
    fontSize: typography.fontSize[10.5],
    fontWeight: typography.fontWeight.heavy,
    letterSpacing: typography.letterSpacing.eyebrow,
    lineHeight: typography.lineHeight[14],
    textTransform: "uppercase" as const,
  },
  /** Alias storico di `eyebrow`, mantenuto per i punti che lo usano già. */
  overline: {
    fontSize: typography.fontSize[10.5],
    fontWeight: typography.fontWeight.heavy,
    letterSpacing: typography.letterSpacing.eyebrow,
    lineHeight: typography.lineHeight[14],
    textTransform: "uppercase" as const,
  },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textVariants;
