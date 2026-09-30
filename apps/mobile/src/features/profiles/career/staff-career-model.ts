/**
 * Derivazioni del Master Profile Staff tecnico (REV-PROF-06).
 *
 * Non è un secondo modello di carriera: la normalizzazione degli incarichi
 * resta quella condivisa in `coach-career-model`, che lo Staff tecnico usa
 * così com'è. Qui vivono soltanto le letture che la task chiede in più —
 * ruoli dichiarati, società distinte, categorie di esperienza e percorsi
 * professionali aggiuntivi — tutte calcolate dai record canonici.
 *
 * Nessuna di queste funzioni legge un conteggio memorizzato: `staffRoleCount`,
 * `staffClubCount` e simili non esistono come colonne proprio perché
 * divergerebbero dalla carriera alla prima modifica.
 */
import type {
  StaffCareerEntryRecord,
  StaffPlayerCareerEntryRecord,
} from "../profile-service";
import {
  buildCareerView,
  getCurrentExperience,
  type CoachCareerExperience,
  type CoachCareerView,
} from "./coach-career-model";
import { mapStaffPlayerEntriesToPlayerExperiences } from "./staff-career-grouping";
import { buildPlayerCareerView } from "./player-career-model";

/** Percorso professionale mostrato dal selettore della tab Carriera. */
export type StaffCareerPath = "staff" | "coach" | "player";

export type StaffProfileCareer = {
  /** Categorie distinte ricavate dalla sola carriera nello staff tecnico. */
  categories: string[];
  /** Società distinte della carriera nello staff tecnico. */
  clubCount: number;
  /** Incarico attuale, o `null` se nessuno è in corso. */
  currentExperience: CoachCareerExperience | null;
  /** Numero di esperienze nel percorso da allenatore. Zero se assente. */
  coachExperienceCount: number;
  /** Numero di esperienze nel percorso da calciatore. Zero se assente. */
  playerExperienceCount: number;
  /** Vista canonica del percorso nello staff tecnico. */
  staff: CoachCareerView;
  /** Vista canonica del percorso da allenatore. */
  coach: CoachCareerView;
};

/**
 * Società distinte di una carriera.
 *
 * L'identità è l'id canonico quando la società ha una pagina PROLINK; quando
 * non ce l'ha resta l'id del record, che è stabile. Due società con nomi simili
 * restano due società: il nome non entra mai nella chiave.
 */
export function countDistinctClubs(view: CoachCareerView): number {
  const keys = new Set(
    view.experiences.map((experience) => experience.clubId ?? `entry:${experience.id}`),
  );

  return keys.size;
}

/**
 * Categorie toccate dalla carriera, dalla più recente alla più remota.
 *
 * Le esperienze arrivano già ordinate dal modello condiviso e le stagioni sono
 * decrescenti dentro ciascuna, quindi l'ordine di incontro è quello giusto e
 * non serve ordinare di nuovo.
 */
export function collectCareerCategories(view: CoachCareerView): string[] {
  const categories: string[] = [];

  for (const experience of view.experiences) {
    for (const season of experience.seasons) {
      const category = season.category.trim();

      if (category && !categories.includes(category)) {
        categories.push(category);
      }
    }
  }

  return categories;
}

/**
 * Ruoli tecnici dichiarati nel profilo, in ordine e senza duplicati.
 *
 * Il ruolo principale apre sempre l'elenco: è il posizionamento scelto
 * dall'utente, non l'ultimo incarico ricoperto. I ruoli storici della carriera
 * non entrano qui — una stagione da Match analyst non aggiunge un ruolo al
 * profilo di chi non l'ha dichiarato.
 */
export function collectStaffRoles(
  primaryRole: string | null | undefined,
  staffRoles: readonly string[] | null | undefined,
): string[] {
  const roles: string[] = [];

  for (const value of [primaryRole, ...(staffRoles ?? [])]) {
    const role = value?.trim();

    if (role && !roles.includes(role)) {
      roles.push(role);
    }
  }

  return roles;
}

/** Ruoli tecnici diversi da quello principale. */
export function collectSecondaryStaffRoles(
  primaryRole: string | null | undefined,
  staffRoles: readonly string[] | null | undefined,
): string[] {
  const primary = primaryRole?.trim();

  return collectStaffRoles(primaryRole, staffRoles).filter(
    (role) => role !== primary,
  );
}

/**
 * Numero di esperienze da calciatore, raggruppate per squadra come nel Master
 * Profile Calciatore: due stagioni nella stessa società sono un'esperienza.
 */
function countPlayerExperiences(
  entries: readonly StaffPlayerCareerEntryRecord[],
): number {
  if (entries.length === 0) {
    return 0;
  }

  try {
    return buildPlayerCareerView(mapStaffPlayerEntriesToPlayerExperiences([...entries]))
      .experiences.length;
  } catch {
    return 0;
  }
}

/**
 * Tutto ciò che l'header e la tab Dettagli leggono della carriera, calcolato
 * una volta sola per render del profilo.
 */
export function buildStaffProfileCareer({
  coachEntries = [],
  playerEntries = [],
  staffEntries = [],
  now,
}: {
  coachEntries?: readonly StaffCareerEntryRecord[];
  now?: Date;
  playerEntries?: readonly StaffPlayerCareerEntryRecord[];
  staffEntries?: readonly StaffCareerEntryRecord[];
}): StaffProfileCareer {
  const options = now ? { now } : {};
  const staff = buildCareerView(staffEntries, options);
  const coach = buildCareerView(coachEntries, options);

  return {
    categories: collectCareerCategories(staff),
    clubCount: countDistinctClubs(staff),
    coach,
    coachExperienceCount: coach.experiences.length,
    currentExperience: getCurrentExperience(staff),
    playerExperienceCount: countPlayerExperiences(playerEntries),
    staff,
  };
}

/** Percorsi realmente presenti, nell'ordine in cui compaiono nel selettore. */
export function getAvailableStaffPaths(
  career: StaffProfileCareer,
): StaffCareerPath[] {
  return [
    "staff" as const,
    career.coachExperienceCount > 0 ? ("coach" as const) : null,
    career.playerExperienceCount > 0 ? ("player" as const) : null,
  ].filter((path): path is StaffCareerPath => path !== null);
}

/** "1 esperienza" / "3 esperienze". Zero non produce mai una riga. */
export function formatExperienceCount(count: number): string {
  return count === 1 ? "1 esperienza" : `${count} esperienze`;
}
