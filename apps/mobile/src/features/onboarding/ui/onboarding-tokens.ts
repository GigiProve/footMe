/**
 * Token del Master UI onboarding (REV-ONB-01).
 *
 * Tutti i flussi di onboarding — Calciatore, Allenatore, Staff, Società,
 * Procuratore, Dirigente, Media e appassionati — leggono da qui. Nessuno step
 * deve hardcodare altezze, padding o raggi propri: se un valore manca,
 * si aggiunge in questo file, non nel singolo screen.
 *
 * I valori derivano dai token globali ProLink (`src/styles/tokens`): questo
 * file li nomina per ruolo, non ne inventa di nuovi.
 */
import { radius, sizes, spacing } from "../../../styles";

/** Scala di spacing dell'onboarding: XS · S · M · L · XL. */
export const onboardingSpacing = {
  xs: spacing[4],
  s: spacing[8],
  m: spacing[16],
  l: spacing[24],
  xl: spacing[32],
} as const;

export const onboardingLayout = {
  /** Padding orizzontale di pagina, identico su ogni step. */
  pagePaddingHorizontal: spacing[20],
  pagePaddingTop: spacing[8],
  /** Aria sotto l'ultimo blocco, prima del footer sticky. */
  pagePaddingBottom: spacing[32],

  /** Distanza titolo → copy di supporto. */
  titleGap: spacing[8],
  /** Distanza blocco titolo → contenuto. */
  headerContentGap: spacing[24],
  /** Distanza fra due sezioni di contenuto. */
  sectionGap: spacing[24],
  /** Distanza fra due campi nella stessa sezione. */
  fieldGap: spacing[16],
  /** Distanza label → campo. */
  labelGap: spacing[8],

  headerHeight: 52,
  headerIconButton: 40,
  progressTrackHeight: 3,

  /** Altezza di un campo di testo / select. */
  controlHeight: 48,
  /** Altezza minima di una riga selezionabile o di una riga toggle. */
  rowMinHeight: 56,
  /** Altezza della CTA primaria nel footer. */
  ctaHeight: 52,
  /** Touch target minimo accessibile. */
  touchTarget: sizes.touchTarget,
} as const;

export const onboardingRadius = {
  /** Campi, righe selezionabili, bottom sheet rows. */
  control: radius[12],
  /** Card: role tile, esperienza salvata, empty state. */
  card: radius[16],
  /** CTA. */
  cta: radius[14],
  /** Checkbox quadrata. */
  checkbox: radius[6],
  pill: radius.full,
} as const;

export const onboardingBorderWidth = {
  hairline: 1,
  /** Bordo di uno stato selezionato: resta sottile, non ingrossa la riga. */
  selected: 1.5,
} as const;

/** Durata delle micro-interazioni (progress, espansione toggle, selezione). */
export const onboardingMotion = {
  fast: 140,
  base: 220,
} as const;
