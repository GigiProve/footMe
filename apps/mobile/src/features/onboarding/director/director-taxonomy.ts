/**
 * Tassonomie del Dirigente (REV-ONB-07 §F–§L, §M, §AI–§AJ).
 *
 * Tre dati distinti che non vanno confusi fra loro (§I):
 * — i **ruoli** ricoperti nel club, tutti sullo stesso piano (§F);
 * — le **aree di responsabilità**, cioè di cosa ci si occupa (§I);
 * — il **focus**, cioè dove si concentra l'attività (§L).
 *
 * Le lingue arrivano dal selector già approvato negli altri onboarding: qui
 * non ne esiste una versione Dirigente (§AJ).
 */
import type Ionicons from "@expo/vector-icons/Ionicons";

import {
  DIRECTOR_FOCUS_OPTIONS,
  DIRECTOR_RESPONSIBILITY_OPTIONS,
  DIRECTOR_ROLE_OPTIONS,
  type DirectorFocus,
} from "../onboarding-types";

/**
 * §F: una sola sezione "Ruoli ricoperti". Presidente, Vicepresidente e
 * Dirigente generico stanno nella stessa lista degli altri, senza gerarchie
 * visuali né concettuali.
 */
export const DIRECTOR_CLUB_ROLE_OPTIONS: { label: string; value: string }[] =
  DIRECTOR_ROLE_OPTIONS.map((option) => ({
    label: option.label,
    value: option.value,
  }));

/** Il valore che apre il campo libero "Specifica ruolo" (§H). */
export const DIRECTOR_OTHER_ROLE_VALUE = "Altro";

export const DIRECTOR_RESPONSIBILITY_CHIP_OPTIONS: {
  label: string;
  value: string;
}[] = DIRECTOR_RESPONSIBILITY_OPTIONS.map((option) => ({
  label: option,
  value: option,
}));

/**
 * Icona di un'area di responsabilità (REV-PROF-09, Screen 4).
 *
 * Accompagna l'etichetta, non la sostituisce: nessuna informazione passa dalla
 * sola icona. Un'area salvata prima della review e non più fra le opzioni
 * ricade sull'icona neutra invece di restare senza.
 */
const DIRECTOR_RESPONSIBILITY_ICONS: Record<
  string,
  keyof typeof Ionicons.glyphMap
> = {
  "Area legale": "document-text-outline",
  Altro: "ellipsis-horizontal-outline",
  "Budget e finanze": "stats-chart-outline",
  "Comunicazione e sponsor": "megaphone-outline",
  "Gestione allenatori e staff": "clipboard-outline",
  "Gestione rose e contratti": "people-outline",
  "Mercato calciatori": "swap-horizontal-outline",
  "Organizzazione logistica": "calendar-outline",
  "Relazioni con la federazione": "business-outline",
  "Scouting e osservazione": "search-outline",
  "Settore giovanile": "school-outline",
};

export function getDirectorResponsibilityIcon(
  responsibility: string,
): keyof typeof Ionicons.glyphMap {
  return (
    DIRECTOR_RESPONSIBILITY_ICONS[responsibility.trim()] ?? "grid-outline"
  );
}

/**
 * §L: scelta singola resa a card, non tre toggle indipendenti.
 */
export const DIRECTOR_FOCUS_CARD_OPTIONS: {
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: DirectorFocus;
}[] = [
  {
    description: "Lavori principalmente sulla rosa senior.",
    icon: "shield-outline",
    label: "Prima squadra",
    value: "Prima squadra",
  },
  {
    description: "Lavori principalmente sulle giovanili.",
    icon: "school-outline",
    label: "Settore giovanile",
    value: "Settore giovanile",
  },
  {
    description: "Segui entrambe le aree con continuità.",
    icon: "git-merge-outline",
    label: "Entrambi",
    value: "Entrambi",
  },
];

/** Garantisce che le tre opzioni restino allineate al dato condiviso (§L). */
export const DIRECTOR_FOCUS_VALUES = DIRECTOR_FOCUS_OPTIONS.map(
  (option) => option.value,
);

/**
 * Disponibilità a ricevere contatti (§M).
 *
 * Sono preferenze di contatto del profilo, non permessi: chi possa davvero
 * scrivere resta deciso dal modello privacy/messaggistica del prodotto (§N).
 */
export type DirectorContactAudience =
  | "clubs"
  | "staff"
  | "players"
  | "others";

export const DIRECTOR_CONTACT_AUDIENCE_OPTIONS: {
  description: string;
  label: string;
  value: DirectorContactAudience;
}[] = [
  {
    description: "Presidenti, DS e staff",
    label: "Società e club",
    value: "clubs",
  },
  {
    description: "Allenatori e preparatori",
    label: "Staff tecnico",
    value: "staff",
  },
  {
    description: "Calciatori",
    label: "Giocatori",
    value: "players",
  },
  {
    description: "Osservatori, media e altri professionisti",
    label: "Altre figure",
    value: "others",
  },
];

/** §AI: la bio è opzionale e usa il contatore già previsto dal modello. */
export const DIRECTOR_BIO_MAX_LENGTH = 1000;

/**
 * Ruoli selezionabili dentro una singola esperienza dirigenziale (§R).
 *
 * Di norma sono i ruoli dichiarati nello step "Il tuo ruolo nel club", più
 * l'eventuale ruolo libero di "Altro" (§H). Un ruolo storico già salvato in
 * un'esperienza resta selezionabile anche se l'utente non lo dichiara più:
 * modificare il profilo non deve svuotare la carriera.
 */
export function getDirectorExperienceRoleOptions(
  declaredRoles: string[],
  otherRoleLabel = "",
  historicalRoles: string[] = [],
): { label: string; value: string }[] {
  const trimmedOther = otherRoleLabel.trim();

  const declared = declaredRoles
    .filter(Boolean)
    .map((role) =>
      role === DIRECTOR_OTHER_ROLE_VALUE && trimmedOther ? trimmedOther : role,
    );

  const preferred =
    declared.length > 0
      ? declared
      : DIRECTOR_CLUB_ROLE_OPTIONS.map((option) => option.value);

  const extra = historicalRoles.filter(
    (role) => Boolean(role) && !preferred.includes(role),
  );

  return [...new Set([...preferred, ...extra])].map((role) => ({
    label: role,
    value: role,
  }));
}
