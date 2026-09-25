/**
 * Tassonomie dell'Allenatore (REV-ONB-03 §D, §E, §F, §AN–§AP).
 *
 * Unica fonte per ruoli tecnici, licenze, categorie allenate, moduli, stili e
 * lingue: l'onboarding, la carriera e i filtri di ricerca leggono da qui.
 * REV-ONB-03 non crea una seconda tassonomia parallela: se un valore manca,
 * si aggiunge in questo file.
 */

/**
 * Ruoli tecnici del dominio. È la stessa lista per il ruolo principale del
 * profilo e per il ruolo di ogni singola stagione di carriera (§D, §S).
 */
export const COACH_ROLE_OPTIONS: { label: string; value: string }[] = [
  { label: "Allenatore", value: "Allenatore" },
  { label: "Vice allenatore", value: "Vice allenatore" },
  { label: "Collaboratore tecnico", value: "Collaboratore tecnico" },
  { label: "Allenatore portieri", value: "Allenatore portieri" },
  { label: "Preparatore atletico", value: "Preparatore atletico" },
];

/** Alias storico usato dal profilo e dalla ricerca. */
export const COACH_PRIMARY_ROLE_OPTIONS = COACH_ROLE_OPTIONS;

/**
 * §E: la licenza si sceglie, non si verifica. Nessun processo documentale
 * dietro questo elenco.
 */
export const LICENSE_TYPE_OPTIONS: { label: string; value: string }[] = [
  { label: "UEFA Pro", value: "UEFA Pro" },
  { label: "UEFA A", value: "UEFA A" },
  { label: "UEFA B", value: "UEFA B" },
  { label: "UEFA C", value: "UEFA C" },
  { label: "Patentino base", value: "Patentino base" },
  { label: "Nessun patentino", value: "Nessun patentino" },
];

/** §F: categorie allenate, selezione multipla a chip. */
export const COACH_CATEGORY_OPTIONS: { label: string; value: string }[] = [
  { label: "Prima Squadra", value: "Prima Squadra" },
  { label: "Juniores", value: "Juniores" },
  { label: "Allievi", value: "Allievi" },
  { label: "Giovanissimi", value: "Giovanissimi" },
  { label: "Berretti", value: "Berretti" },
  { label: "Scuola Calcio", value: "Scuola Calcio" },
  { label: "Settore Giovanile", value: "Settore Giovanile" },
];

/**
 * Disponibilità a scelte predefinite: resta per lo Staff tecnico e per le
 * schermate di profilo che non sono ancora passate al picker mese/anno.
 * L'onboarding Allenatore usa un picker mese + anno (§I).
 */
export const AVAILABLE_FROM_OPTIONS: { label: string; value: string }[] = [
  { label: "Immediatamente", value: "Immediatamente" },
  { label: "Da luglio", value: "Da luglio" },
  { label: "Da settembre", value: "Da settembre" },
  { label: "Fine stagione", value: "Fine stagione" },
];

/** §AN: moduli preferiti. */
export const COACH_FORMATION_OPTIONS: { label: string; value: string }[] = [
  { label: "4-3-3", value: "4-3-3" },
  { label: "4-4-2", value: "4-4-2" },
  { label: "4-2-3-1", value: "4-2-3-1" },
  { label: "3-5-2", value: "3-5-2" },
  { label: "3-4-3", value: "3-4-3" },
  { label: "5-3-2", value: "5-3-2" },
  { label: "4-1-4-1", value: "4-1-4-1" },
  { label: "4-3-1-2", value: "4-3-1-2" },
];

/** §AO: stili di gioco. */
export const COACH_PLAY_STYLE_OPTIONS: { label: string; value: string }[] = [
  { label: "Possesso palla", value: "Possesso palla" },
  { label: "Costruzione dal basso", value: "Costruzione dal basso" },
  { label: "Pressing alto", value: "Pressing alto" },
  { label: "Transizioni", value: "Transizioni" },
  { label: "Contropiede", value: "Contropiede" },
  { label: "Gioco diretto", value: "Gioco diretto" },
  { label: "Misto", value: "Misto" },
];

/** §AP: lingue parlate, selezione multipla a chip. */
export const COACH_LANGUAGE_OPTIONS: { label: string; value: string }[] = [
  { label: "Italiano", value: "Italiano" },
  { label: "Inglese", value: "Inglese" },
  { label: "Spagnolo", value: "Spagnolo" },
  { label: "Francese", value: "Francese" },
  { label: "Tedesco", value: "Tedesco" },
  { label: "Portoghese", value: "Portoghese" },
  { label: "Arabo", value: "Arabo" },
];

/** §AM: limite della filosofia di gioco, allineato al counter mostrato. */
export const COACH_PHILOSOPHY_MAX_LENGTH = 1000;
