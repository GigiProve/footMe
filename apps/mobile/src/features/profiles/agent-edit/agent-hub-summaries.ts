/**
 * Sottotitoli dinamici dell'hub Modifica profilo Procuratore (REV-PROF-16,
 * "I contatori devono essere calcolati dai dati reali").
 *
 * Modulo puro, così le regole che contano si possono provare senza montare
 * una schermata:
 *
 * - la Carriera conta **solo** gli incarichi da procuratore: allenatore,
 *   staff, dirigente e calciatore non entrano in quel numero;
 * - i Percorsi aggiuntivi contano i *percorsi* non vuoti, non le esperienze:
 *   sei stagioni da calciatore restano un percorso solo, e i valori possibili
 *   vanno da 0 a 4;
 * - gli assistiti contati sono quelli **pubblici**, gli stessi che un visitor
 *   vede nel Master Profile: un record manuale, una richiesta in attesa o un
 *   rapporto privato non gonfiano il numero mostrato all'owner;
 * - i contatti contati sono quelli davvero pubblici e con un valore valido,
 *   non quelli salvati;
 * - singolare e plurale sono espliciti, mai "1 esperienze";
 * - un conteggio a zero diventa una frase, non "0 esperienze".
 *
 * Le cinque voci della prima macroarea hanno invece un sottotitolo fisso
 * (dichiarato in `agent-edit-sections`): il mockup non mostra un conteggio lì.
 */
import type { AgentPublicAssistito } from "../../relationships/agent-representation-service";
import { normalizeAgentMediaItems } from "../agent-media";
import { buildAgentProfileCareer } from "../career/agent-career-model";
import { buildPublicContacts } from "../master/PublicContactsList";
import type { ProfileEditSectionKey } from "../profile-analytics";
import type { CompleteProfessionalProfile } from "../profile-service";

export type AgentEditSectionId = Extract<
  ProfileEditSectionKey,
  | "personal"
  | "professional"
  | "activities"
  | "opportunities"
  | "bio"
  | "assistiti"
  | "career"
  | "paths"
  | "contacts"
  | "media"
>;

function pluralize(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Incarichi da procuratore, come li mostra il Master Profile. */
export function countAgentExperiences(
  data: CompleteProfessionalProfile,
): number {
  return buildAgentProfileCareer({
    agentCareerEntries: data.agentCareerEntries,
    agentProfile: data.agentProfile,
  }).experiences.length;
}

/**
 * Percorsi aggiuntivi *non vuoti*: da 0 a 4. Non è la somma delle esperienze —
 * i quattro percorsi del Procuratore (dirigente, allenatore, staff,
 * calciatore) valgono uno ciascuno.
 */
export function countAgentAdditionalPaths(
  data: CompleteProfessionalProfile,
): number {
  const career = buildAgentProfileCareer({
    agentCareerEntries: data.agentCareerEntries,
    agentProfile: data.agentProfile,
  });

  return [
    career.directorExperienceCount,
    career.coachExperienceCount,
    career.staffExperienceCount,
    career.playerExperienceCount,
  ].filter((count) => count > 0).length;
}

/** Contatti realmente pubblicati: `buildPublicContacts` scarta i non validi. */
export function countAgentPublicContacts(
  data: CompleteProfessionalProfile,
): number {
  return buildPublicContacts(data.userContacts).length;
}

export function countAgentMediaItems(
  data: CompleteProfessionalProfile,
): number {
  return normalizeAgentMediaItems(data.agentProfile?.media_items).length;
}

/**
 * "12 assistiti · 3 in evidenza" (REV-PROF-16, schermata 1).
 *
 * Due numeri perché dicono due cose diverse: quanti rapporti pubblici
 * esistono e quanti di quelli sono stati scelti per il profilo. La seconda
 * metà sparisce quando nessuno è in evidenza, invece di scrivere "0 in
 * evidenza" accanto a un portfolio pieno.
 *
 * Finché l'elenco non è arrivato il sottotitolo è vuoto: scrivere "Nessun
 * assistito" durante il caricamento sarebbe un'informazione sbagliata, non
 * un'informazione mancante.
 */
export function buildAgentAssistitiSummary(
  assistiti: readonly AgentPublicAssistito[] | undefined,
): string {
  if (!assistiti) {
    return "";
  }

  if (assistiti.length === 0) {
    return "Nessun assistito pubblico";
  }

  const featured = assistiti.filter(
    (item) => item.featured_rank != null,
  ).length;
  const total = pluralize(assistiti.length, "assistito", "assistiti");

  return featured > 0 ? `${total} · ${featured} in evidenza` : total;
}

/**
 * Sottotitolo a conteggio di una voce della seconda macroarea. Le voci con un
 * sottotitolo fisso non passano di qui.
 */
export function buildAgentSectionSummary(
  sectionId: ProfileEditSectionKey,
  data: CompleteProfessionalProfile,
  assistiti?: readonly AgentPublicAssistito[],
): string | undefined {
  switch (sectionId) {
    case "assistiti":
      return buildAgentAssistitiSummary(assistiti);
    case "career": {
      const count = countAgentExperiences(data);

      return count === 0
        ? "Nessuna esperienza"
        : pluralize(count, "esperienza", "esperienze");
    }
    case "paths": {
      const count = countAgentAdditionalPaths(data);

      return count === 0
        ? "Nessun percorso aggiunto"
        : pluralize(count, "percorso", "percorsi");
    }
    case "contacts": {
      const count = countAgentPublicContacts(data);

      return count === 0
        ? "Nessun contatto visibile"
        : pluralize(count, "contatto visibile", "contatti visibili");
    }
    case "media": {
      const count = countAgentMediaItems(data);

      return count === 0
        ? "Nessun contenuto"
        : pluralize(count, "contenuto", "contenuti");
    }
    default:
      return undefined;
  }
}
