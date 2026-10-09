/**
 * Un solo registro delle priorità (§7).
 *
 * Tre tipi, nessuno inventato:
 *
 *   · `new_applications`     candidature ancora da gestire su una Posizione.
 *                            Dominio recruiting, già sviluppato.
 *   · `publication_failed`   pubblicazione programmata non riuscita. Il
 *                            contratto esiste, il dominio no: il tipo resta
 *                            escluso dalla composizione di produzione tramite
 *                            `dashboard-features` (§3).
 *   · `availability_required` l'actor si dichiara disponibile al trasferimento
 *                            ma non ha indicato dove. Condizione di dominio
 *                            reale, non "profilo incompleto" (§7).
 *
 * Fuori dal registro per divieto esplicito: follower, like, visualizzazioni,
 * commenti, bozze esistenti, profilo non al 100%, contenuto vecchio, errori
 * tecnici della Dashboard.
 */

import type { DashboardPriorityTypeId, PriorityTypeDefinition } from "./priority-types";

/** Plurale minimo, senza concatenazioni fragili (§32). */
function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export const PRIORITY_REGISTRY: Record<
  DashboardPriorityTypeId,
  PriorityTypeDefinition
> = {
  /**
   * §8: «Nuove candidature appartengono normalmente a relevant.» Non
   * `attention`: una novità da valutare non è un guasto.
   *
   * Risoluzione: il conteggio canonico `submitted` della Posizione scende a
   * zero. Aprire la Dashboard, toccare la CTA o leggere una notifica **non**
   * risolve (§10, QA-05).
   */
  new_applications: {
    actionLabel: "Valuta candidature",
    capabilities: ["applications_view"],
    deadlinePolicy: "none",
    feature: "society_applications",
    id: "new_applications",
    impact: 50,
    level: "relevant",
    moduleId: "society_applications",
    nature: "action",
    resolution: "canonical_count_zero",
    source: "recruiting_applications.status = 'submitted'",
    targetHref: (signal) => `/position/${signal.targetId}`,
    title: (signal) =>
      `${signal.count} ${plural(
        signal.count,
        "nuova candidatura",
        "nuove candidature",
      )}`,
  },

  /**
   * §22: il percorso approvato è **"Apri contenuto"** verso l'elemento
   * fallito in Bozze e programmati. L'eventuale "Riprova" della pubblicazione
   * appartiene al dominio editoriale, non alla Dashboard — un retry di
   * lettura non deve mai ripubblicare nulla.
   *
   * `attention` e non `critical`: §8 vieta di assegnare `critical` a
   * qualunque errore in assenza di un caso di dominio giustificato.
   */
  publication_failed: {
    actionLabel: "Apri contenuto",
    capabilities: ["content_view"],
    deadlinePolicy: "real",
    feature: "society_scheduled_content",
    id: "publication_failed",
    impact: 70,
    level: "attention",
    moduleId: "society_drafts",
    nature: "action",
    resolution: "domain_transition",
    source: "club_media_posts.status = 'failed' (dominio non ancora disponibile)",
    targetHref: (signal) => `/content/club_media/${signal.targetId}`,
    title: () => "Pubblicazione non riuscita",
  },

  /**
   * Identità personale: nessuna capability: le risorse personali sono
   * protette dalla RLS dell'actor su se stesso, e una capability fittizia
   * darebbe l'illusione di un controllo che non esiste.
   *
   * `moduleId: null` — non esiste un modulo "disponibilità" da promuovere, e
   * §11 vieta di promuoverne uno arbitrario per dare peso visivo al segnale.
   */
  availability_required: {
    actionLabel: "Imposta aree",
    capabilities: [],
    deadlinePolicy: "none",
    feature: "personal_availability",
    id: "availability_required",
    impact: 30,
    level: "normal",
    moduleId: null,
    nature: "action",
    resolution: "domain_requirements_met",
    source: "profiles.is_open_to_transfer senza aree di disponibilità",
    targetHref: () => "/profile/edit/opportunities",
    title: () => "Completa la disponibilità",
  },
};

export function isKnownPriorityType(
  value: string,
): value is DashboardPriorityTypeId {
  return value in PRIORITY_REGISTRY;
}
