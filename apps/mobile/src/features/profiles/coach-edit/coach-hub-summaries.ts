/**
 * Sottotitoli dinamici dell'hub Modifica profilo Allenatore (REV-PROF-05,
 * "Requisiti hub").
 *
 * Modulo puro, così le regole che contano si possono provare senza montare
 * una schermata:
 *
 * - il conteggio della Carriera è il numero di **esperienze**, non di stagioni:
 *   tre anni allo stesso club sono un'esperienza sola;
 * - i contatti contati sono quelli davvero pubblici, non quelli salvati;
 * - singolare e plurale sono espliciti, mai "1 esperienze".
 *
 * Le quattro voci della prima macroarea hanno invece un sottotitolo fisso
 * (dichiarato in `coach-edit-sections`): il mockup non mostra un conteggio lì.
 */
import { buildCoachCareerView } from "../career/coach-career-model";
import { buildPublicContacts } from "../master/PublicContactsList";
import { normalizeCoachMediaItems } from "../coach-media";
import type { CompleteProfessionalProfile } from "../profile-service";

export type CoachEditSectionId =
  | "personal"
  | "technical"
  | "opportunities"
  | "philosophy"
  | "career"
  | "awards"
  | "contacts"
  | "media";

function pluralize(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function countCoachExperiences(
  data: CompleteProfessionalProfile,
): number {
  return buildCoachCareerView(data.coachCareerEntries ?? []).experiences.length;
}

export function countCoachAwards(data: CompleteProfessionalProfile): number {
  return data.coachProfile?.achievements?.length ?? 0;
}

export function countCoachPublicContacts(
  data: CompleteProfessionalProfile,
): number {
  return buildPublicContacts(data.userContacts).length;
}

export function countCoachMediaItems(
  data: CompleteProfessionalProfile,
): number {
  return normalizeCoachMediaItems(data.coachProfile?.media_items).length;
}

/**
 * Sottotitolo a conteggio di una voce della seconda macroarea. Le voci con un
 * sottotitolo fisso non passano di qui.
 */
export function buildCoachSectionSummary(
  sectionId: CoachEditSectionId,
  data: CompleteProfessionalProfile,
): string | undefined {
  switch (sectionId) {
    case "career":
      return pluralize(countCoachExperiences(data), "esperienza", "esperienze");
    case "awards":
      return pluralize(
        countCoachAwards(data),
        "riconoscimento",
        "riconoscimenti",
      );
    case "contacts":
      return pluralize(
        countCoachPublicContacts(data),
        "contatto visibile",
        "contatti visibili",
      );
    case "media":
      return pluralize(countCoachMediaItems(data), "contenuto", "contenuti");
    default:
      return undefined;
  }
}
