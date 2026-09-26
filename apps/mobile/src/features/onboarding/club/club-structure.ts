/**
 * Struttura reale della società (REV-ONB-05 §N, §BD).
 *
 * È il perno del flusso: dopo referente e identità l'utente dichiara come è
 * fatto il club, e il resto dell'onboarding si costruisce su quella scelta.
 * La semantica è univoca — prima squadra, prima squadra + vivaio, solo
 * vivaio — e non viene dedotta a valle da campi sparsi.
 */
import type { SelectorOption } from "../ui/BottomSheetSelector";

export type ClubStructure =
  | ""
  | "first_team_only"
  | "first_team_and_youth"
  | "youth_only";

type ClubStructureOption = SelectorOption<Exclude<ClubStructure, "">>;

/** Le tre configurazioni, mutuamente esclusive (§O, §P, §Q). */
export const CLUB_STRUCTURE_OPTIONS: ClubStructureOption[] = [
  {
    description:
      "La società gestisce una prima squadra e non un settore giovanile.",
    label: "Prima squadra",
    value: "first_team_only",
  },
  {
    description:
      "La società gestisce sia la prima squadra sia il proprio settore giovanile.",
    label: "Prima squadra + settore giovanile",
    value: "first_team_and_youth",
  },
  {
    description: "La società opera esclusivamente nel calcio giovanile.",
    label: "Solo settore giovanile",
    value: "youth_only",
  },
];

export function clubStructureHasFirstTeam(structure: ClubStructure) {
  return (
    structure === "first_team_only" || structure === "first_team_and_youth"
  );
}

export function clubStructureHasYouth(structure: ClubStructure) {
  return structure === "youth_only" || structure === "first_team_and_youth";
}

export function coerceClubStructure(value: unknown): ClubStructure {
  if (
    value === "first_team_only" ||
    value === "first_team_and_youth" ||
    value === "youth_only"
  ) {
    return value;
  }

  return "";
}

/**
 * Mappa un profilo società creato con il vecchio onboarding (§BC).
 *
 * Il vecchio flusso non chiedeva la struttura: la ricostruiamo dai due
 * segnali che raccoglieva — categoria della prima squadra e toggle del
 * settore giovanile — senza perdere nulla di ciò che era già stato scritto.
 */
export function deriveLegacyClubStructure(legacy: {
  clubCategory?: string | null;
  clubHasYouthSector?: boolean | null;
  clubYouthCategories?: string[] | null;
}): ClubStructure {
  const hasFirstTeam = Boolean(legacy.clubCategory?.trim());
  const hasYouth =
    Boolean(legacy.clubHasYouthSector) ||
    (legacy.clubYouthCategories?.length ?? 0) > 0;

  if (hasFirstTeam && hasYouth) {
    return "first_team_and_youth";
  }

  if (hasFirstTeam) {
    return "first_team_only";
  }

  if (hasYouth) {
    return "youth_only";
  }

  return "";
}

/**
 * Patch del form quando l'utente sceglie o cambia configurazione (§T).
 *
 * Durante la sessione i campi restano compilati finché la configurazione li
 * prevede; quelli che la nuova struttura non contempla vengono azzerati, così
 * un club "Solo settore giovanile" non può salvare una categoria di prima
 * squadra rimasta attiva da un giro precedente.
 */
export function buildClubStructurePatch(structure: ClubStructure) {
  const hasFirstTeam = clubStructureHasFirstTeam(structure);
  const hasYouth = clubStructureHasYouth(structure);

  return {
    clubStructure: structure,
    // Il toggle legacy non è più una domanda: resta come proiezione della
    // struttura, per non rompere i consumatori che lo leggono ancora (§BC).
    clubHasYouthSector: hasYouth,
    ...(hasFirstTeam ? {} : { clubCategory: "" }),
    ...(hasYouth ? {} : { clubYouthCategories: [] as string[] }),
  };
}
