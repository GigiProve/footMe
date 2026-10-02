/**
 * Sottotitoli dinamici dell'hub Modifica profilo Dirigente (REV-PROF-11,
 * "Conteggi").
 *
 * Modulo puro, così le regole che contano si possono provare senza montare
 * una schermata:
 *
 * - la Carriera conta **solo** le assegnazioni dirigenziali: allenatore,
 *   staff, calciatore e altri ruoli non entrano in quel numero;
 * - i Percorsi aggiuntivi contano i *percorsi* non vuoti, non le esperienze:
 *   sei stagioni da calciatore restano un percorso solo, e i valori possibili
 *   vanno da 0 a 4;
 * - i contatti contati sono quelli davvero pubblici e con un valore valido,
 *   non quelli salvati;
 * - singolare e plurale sono espliciti, mai "1 esperienze";
 * - un conteggio a zero diventa una frase, non "0 esperienze".
 *
 * Le cinque voci della prima macroarea hanno invece un sottotitolo fisso
 * (dichiarato in `director-edit-sections`): il mockup non mostra un conteggio
 * lì.
 */
import { buildDirectorProfileCareer } from "../career/director-career-model";
import { normalizeDirectorMediaItems } from "../director-media";
import { buildPublicContacts } from "../master/PublicContactsList";
import type { ProfileEditSectionKey } from "../profile-analytics";
import type { CompleteProfessionalProfile } from "../profile-service";

export type DirectorEditSectionId = Extract<
  ProfileEditSectionKey,
  | "personal"
  | "professional"
  | "responsibilities"
  | "opportunities"
  | "bio"
  | "career"
  | "paths"
  | "contacts"
  | "media"
>;

function pluralize(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Esperienze dirigenziali, raggruppate come nel Master Profile: tre stagioni
 * nella stessa società sono un'esperienza sola.
 */
export function countDirectorExperiences(
  data: CompleteProfessionalProfile,
): number {
  return buildDirectorProfileCareer({ directorProfile: data.directorProfile })
    .director.experiences.length;
}

/**
 * Percorsi aggiuntivi *non vuoti*: da 0 a 4. Non è la somma delle esperienze —
 * i quattro percorsi del Dirigente (allenatore, staff, calciatore, altri
 * ruoli) valgono uno ciascuno.
 */
export function countDirectorAdditionalPaths(
  data: CompleteProfessionalProfile,
): number {
  const career = buildDirectorProfileCareer({
    directorProfile: data.directorProfile,
  });

  return [
    career.coachExperienceCount,
    career.staffExperienceCount,
    career.playerExperienceCount,
    career.otherExperienceCount,
  ].filter((count) => count > 0).length;
}

/** Contatti realmente pubblicati: `buildPublicContacts` scarta i non validi. */
export function countDirectorPublicContacts(
  data: CompleteProfessionalProfile,
): number {
  return buildPublicContacts(data.userContacts).length;
}

export function countDirectorMediaItems(
  data: CompleteProfessionalProfile,
): number {
  return normalizeDirectorMediaItems(data.directorProfile?.media_items).length;
}

/**
 * Sottotitolo a conteggio di una voce della seconda macroarea. Le voci con un
 * sottotitolo fisso non passano di qui.
 */
export function buildDirectorSectionSummary(
  sectionId: ProfileEditSectionKey,
  data: CompleteProfessionalProfile,
): string | undefined {
  switch (sectionId) {
    case "career": {
      const count = countDirectorExperiences(data);

      return count === 0
        ? "Nessuna esperienza"
        : pluralize(count, "esperienza", "esperienze");
    }
    case "paths": {
      const count = countDirectorAdditionalPaths(data);

      return count === 0
        ? "Nessun percorso aggiunto"
        : pluralize(count, "percorso", "percorsi");
    }
    case "contacts": {
      const count = countDirectorPublicContacts(data);

      return count === 0
        ? "Nessun contatto visibile"
        : pluralize(count, "contatto visibile", "contatti visibili");
    }
    case "media": {
      const count = countDirectorMediaItems(data);

      return count === 0
        ? "Nessun contenuto"
        : pluralize(count, "contenuto", "contenuti");
    }
    default:
      return undefined;
  }
}
