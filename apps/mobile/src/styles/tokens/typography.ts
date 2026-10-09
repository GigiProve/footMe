/**
 * Scala tipografica ProLink (§1a del design "ProLink UI Upgrade").
 *
 * Due famiglie soltanto:
 *   · Mulish 900 → numeri, statistiche, titoli di schermata, nomi in hero.
 *   · System UI  → tutto il resto (400/600/700/800).
 *
 * I mezzi punti (10.5, 12.5, 14.5…) vengono dal design e sono voluti: danno
 * la differenza di peso fra riga meta e corpo senza cambiare weight.
 */
export const typography = {
  fontFamily: {
    /** Mulish 900. Va usato senza `fontWeight`: il peso è nel file. */
    display: "Mulish_900Black",
    /** Mulish 800, per i numeri più piccoli dove il 900 chiude troppo. */
    displaySoft: "Mulish_800ExtraBold",
  },
  fontSize: {
    /** Solo per l'etichetta nei marker minuscoli del campo tattico (Tifoso). */
    9: 9,
    10: 10,
    10.5: 10.5,
    11: 11,
    11.5: 11.5,
    12: 12,
    12.5: 12.5,
    13: 13,
    13.5: 13.5,
    14: 14,
    14.5: 14.5,
    15: 15,
    15.5: 15.5,
    16: 16,
    17: 17,
    18: 18,
    19: 19,
    20: 20,
    22: 22,
    24: 24,
    25: 25,
    26: 26,
    28: 28,
    30: 30,
    32: 32,
    34: 34,
  },
  lineHeight: {
    14: 14,
    16: 16,
    18: 18,
    19: 19,
    20: 20,
    22: 22,
    24: 24,
    26: 26,
    28: 28,
    32: 32,
    34: 34,
    36: 36,
    38: 38,
  },
  fontWeight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    heavy: "800",
  },
  letterSpacing: {
    /** -0.02em sui titoli Mulish. */
    tight: -0.5,
    sm: 0.5,
    md: 1.2,
    /** 0.09em sull'eyebrow da 10.5px. */
    eyebrow: 0.95,
  },
} as const;
