/**
 * Palette ProLink — allineata al design "ProLink UI Upgrade" (§1a).
 *
 * Il blu si sposta da #0A66C2 (identico a quello di LinkedIn) a #1B4FD8: resta
 * riconoscibile come "blu professionale", smette di essere una citazione.
 *
 * La scala è costruita su sei valori:
 *   #1B4FD8 accent · #1540AE pressed · #EDF2FE soft
 *   #0C1B2A ink    · #0FA36B disponibile · #F4F6FA canvas
 *
 * Due sole hairline: `border` per la cornice dei moduli, `divider` per le
 * righe interne a un modulo. Nessuna ombra — l'elevazione è data dai bordi.
 */
export const colors = {
  // ── Superfici ──────────────────────────────────────────────────────────
  background: "#F4F6FA",
  backgroundStrong: "#E7ECF3",
  surface: "#FFFFFF",
  surfaceMuted: "#F4F6FA",
  /** Placeholder di media (foto/video non ancora caricati). */
  surfacePlaceholder: "#E7ECF3",
  surfaceInverse: "#0C1B2A",
  surfaceOverlay: "rgba(255,255,255,0.16)",
  inputBackground: "#F4F6FA",

  // ── Testo ──────────────────────────────────────────────────────────────
  textPrimary: "#0C1B2A",
  textSecondary: "#56657A",
  textMuted: "#8695A8",
  textInverseMuted: "rgba(255,255,255,0.72)",
  textInverseSoft: "rgba(255,255,255,0.55)",
  inkInvert: "#FFFFFF",

  // ── Blu ProLink ────────────────────────────────────────────────────────
  accent: "#1B4FD8",
  accentStrong: "#1540AE",
  accentSoft: "#EDF2FE",
  accentSoftBorder: "#C9D8FA",
  /** Blu leggibile su superficie ink (badge verificato, link su header scuro). */
  accentOnInverse: "#4E8CF7",

  // ── Ink (header profilo, avatar società, overlay sui media) ────────────
  hero: "#0C1B2A",
  heroSoft: "#EDF2FE",

  // ── Bordi ──────────────────────────────────────────────────────────────
  border: "#E3E8EF",
  borderStrong: "#C9D2DE",
  /** Hairline fra le righe interne a un modulo. */
  divider: "#F0F3F7",

  // ── Stati ──────────────────────────────────────────────────────────────
  success: "#0FA36B",
  successSoft: "rgba(15,163,107,0.10)",
  successBorder: "rgba(15,163,107,0.30)",
  successForeground: "#0A7D51",
  /** Verde leggibile su superficie ink. */
  successOnInverse: "#4BD9A0",
  danger: "#E23D3D",
  dangerSoft: "#FDECEC",
  dangerStrong: "#B32626",
  destructiveForeground: "#FFFFFF",
  warning: "#F2A93B",
  warningSoft: "#FEF5E7",
  warningStrong: "#8A5A10",
  warningForeground: "#8A5A10",
  buttonDisabled: "#A9BEF0",
  shadow: "rgba(12, 27, 42, 0.06)",
  gold: "#FFD166",
  goldStrong: "#3B2F00",

  // ── Chat (MES-02) ──────────────────────────────────────────────────────
  chatBackground: "#F4F6FA",
  chatBubbleSent: "#EDF2FE",
  chatBubbleSentText: "#1540AE",
  chatBubbleReceived: "#F0F3F7",
  chatBubbleReceivedText: "#0C1B2A",
  chatDateSeparator: "#E3E8EF",
  chatComposerField: "#F4F6FA",
  chatComposerBorder: "#E3E8EF",

  // ── Notice / info ──────────────────────────────────────────────────────
  infoSurface: "#EDF2FE",
  infoBorder: "#C9D8FA",
  noticeWarnSurface: "#FEF5E7",
  noticeWarnBorder: "#F7DFB6",
  noticeWarnText: "#8A5A10",
  noticeSuccessSurface: "rgba(15,163,107,0.10)",
  noticeSuccessBorder: "rgba(15,163,107,0.30)",
  noticeSuccessText: "#0A7D51",

  // ── Categorie contenuto Media Società (ClubMediaTabContent) ─────────────
  // Non sono stati di sistema (successo/attenzione/errore): sono colori
  // identificativi per categoria di contenuto, nessuno dei token esistenti
  // corrisponde esattamente — da qui nomi dedicati invece di riusare quelli
  // semantici.
  contentCategoryEvent: "#DB2777",
  contentCategoryEventSoft: "#FCE7F3",
  contentCategoryStatement: "#4F46E5",
  contentCategoryStatementSoft: "#EEF2FF",
  contentCategoryTraining: "#D97706",

  // ── Campo tattico (anteprima formazione Tifoso) ──────────────────────────
  pitchSurface: "#238A55",

  // ── Viewer dei contenuti Media (MediaTabContent) ─────────────────────────
  // Velature di `hero` (#0C1B2A) e di bianco sopra foto e video: servono a
  // tenere leggibili badge e controlli qualunque sia l'immagine sotto. Il
  // badge "in evidenza" usava il blu del vecchio design system (#0A66C2):
  // ora è una velatura del blu ProLink.
  featuredBadgeSurface: "rgba(27,79,216,0.92)",
  mediaScrim: "rgba(12,27,42,0.08)",
  mediaBadgeSurface: "rgba(12,27,42,0.74)",
  mediaControlSurface: "rgba(12,27,42,0.46)",
  mediaSheetSurface: "rgba(12,27,42,0.32)",
  mediaViewerOverlay: "rgba(0,0,0,0.28)",
  mediaDangerSurface: "rgba(226,61,61,0.45)",
  mediaHairlineOnMedia: "rgba(255,255,255,0.18)",
  mediaBorderOnMedia: "rgba(255,255,255,0.45)",
} as const;
