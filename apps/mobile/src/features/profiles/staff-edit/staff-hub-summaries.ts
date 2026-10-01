/**
 * Sottotitoli dinamici dell'hub Modifica profilo Staff tecnico
 * (REV-PROF-08, "Requisiti hub").
 *
 * Modulo puro, così le regole che contano si possono provare senza montare una
 * schermata:
 *
 * - la Carriera conta **solo** le esperienze nello staff tecnico: i percorsi da
 *   allenatore e da calciatore non entrano in quel numero;
 * - i Percorsi aggiuntivi contano i *percorsi* non vuoti, non le esperienze:
 *   i valori possibili sono 0, 1 o 2;
 * - i contatti contati sono quelli davvero pubblici e con un valore valido,
 *   non quelli salvati;
 * - singolare e plurale sono espliciti, mai "1 esperienze";
 * - un conteggio a zero diventa una frase, non "0 esperienze".
 *
 * Le tre voci della prima macroarea hanno invece un sottotitolo fisso
 * (dichiarato in `staff-edit-sections`): il mockup non mostra un conteggio lì.
 */
import { buildCareerView } from "../career/coach-career-model";
import { buildStaffProfileCareer } from "../career/staff-career-model";
import { buildPublicContacts } from "../master/PublicContactsList";
import type { ProfileEditSectionKey } from "../profile-analytics";
import type { CompleteProfessionalProfile } from "../profile-service";
import { normalizeStaffMediaItems } from "../staff-media";

export type StaffEditSectionId = Extract<
  ProfileEditSectionKey,
  "personal" | "professional" | "opportunities" | "career" | "paths" | "contacts" | "media"
>;

function pluralize(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Esperienze nello staff tecnico, raggruppate come nel Master Profile: tre
 * stagioni nella stessa società sono un'esperienza sola.
 */
export function countStaffExperiences(
  data: CompleteProfessionalProfile,
): number {
  return buildCareerView(data.staffCareerEntries ?? []).experiences.length;
}

/**
 * Percorsi aggiuntivi *non vuoti*: 0, 1 o 2. Non è la somma delle esperienze —
 * sei stagioni da calciatore restano un percorso solo.
 */
export function countStaffAdditionalPaths(
  data: CompleteProfessionalProfile,
): number {
  const career = buildStaffProfileCareer({
    coachEntries: data.staffCoachCareerEntries ?? [],
    playerEntries: data.staffPlayerCareerEntries ?? [],
    staffEntries: data.staffCareerEntries ?? [],
  });

  return (
    (career.coachExperienceCount > 0 ? 1 : 0) +
    (career.playerExperienceCount > 0 ? 1 : 0)
  );
}

/** Contatti realmente pubblicati: `buildPublicContacts` scarta i non validi. */
export function countStaffPublicContacts(
  data: CompleteProfessionalProfile,
): number {
  return buildPublicContacts(data.userContacts).length;
}

export function countStaffMediaItems(
  data: CompleteProfessionalProfile,
): number {
  return normalizeStaffMediaItems(data.staffProfile?.media_items).length;
}

/**
 * Sottotitolo a conteggio di una voce della seconda macroarea. Le voci con un
 * sottotitolo fisso non passano di qui.
 */
export function buildStaffSectionSummary(
  sectionId: ProfileEditSectionKey,
  data: CompleteProfessionalProfile,
): string | undefined {
  switch (sectionId) {
    case "career": {
      const count = countStaffExperiences(data);

      return count === 0
        ? "Nessuna esperienza"
        : pluralize(count, "esperienza", "esperienze");
    }
    case "paths": {
      const count = countStaffAdditionalPaths(data);

      return count === 0
        ? "Nessun percorso aggiunto"
        : pluralize(count, "percorso", "percorsi");
    }
    case "contacts": {
      const count = countStaffPublicContacts(data);

      return count === 0
        ? "Nessun contatto visibile"
        : pluralize(count, "contatto visibile", "contatti visibili");
    }
    case "media": {
      const count = countStaffMediaItems(data);

      return count === 0
        ? "Nessun contenuto"
        : pluralize(count, "contenuto", "contenuti");
    }
    default:
      return undefined;
  }
}
