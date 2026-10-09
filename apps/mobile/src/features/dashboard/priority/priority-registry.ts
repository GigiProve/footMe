/**
 * Un solo registro delle priorità (DAS-REV-02 §7).
 *
 * Quattro tipi, nessuno inventato:
 *
 *   · `new_applications`     candidature ancora da gestire su una Posizione.
 *                            Dominio recruiting, già sviluppato.
 *   · `publication_failed`   pubblicazione programmata non riuscita. Il
 *                            contratto esiste, il dominio no: il tipo resta
 *                            escluso dalla composizione di produzione tramite
 *                            `dashboard-features` (§3).
 *   · `saved_deadline`       opportunità salvata con scadenza reale, ancora
 *                            azionabile dalla PERSON e dentro la finestra di
 *                            promozione (DAS-REV-03 §14–§16).
 *   · `profile_requirements_missing`
 *                            informazione professionale realmente
 *                            obbligatoria e mancante (DAS-REV-03 §13).
 *
 * `availability_required` di DAS-REV-02 **non è più qui**. DAS-REV-03 §19 è
 * esplicito: le aree geografiche sono facoltative e «Non chiamarlo
 * Informazioni richieste, Profilo incompleto o Da gestire se il dato non è
 * obbligatorio». Un dato facoltativo non è una priorità operativa, quindi il
 * suggerimento vive nel suo modulo in fondo alla pagina
 * (`personal_profile_suggestion`), non in "Da gestire".
 *
 * Fuori dal registro per divieto esplicito: follower, like, visualizzazioni,
 * commenti, bozze esistenti, profilo non al 100%, contenuto vecchio, errori
 * tecnici della Dashboard.
 */

import type {
  DashboardPriorityTypeId,
  PriorityTypeDefinition,
} from "./priority-types";

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
    presentation: "card",
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
    presentation: "card",
    resolution: "domain_transition",
    source: "club_media_posts.status = 'failed' (dominio non ancora disponibile)",
    targetHref: (signal) => `/content/club_media/${signal.targetId}`,
    title: () => "Pubblicazione non riuscita",
  },

  /**
   * DAS-REV-03 §14–§16. `attention` e non `relevant`: a differenza di una
   * novità da valutare, questa attività smette di essere possibile a una data
   * certa. §8 ammette `attention` per ciò che ha una finestra reale — e il
   * livello resta interno, nessun badge e nessun countdown (§14: «Nessun
   * countdown, timer live, "2 giorni rimasti", "Ultima occasione"»).
   *
   * `moduleId: null`: §11 ammette **zero o un** modulo promosso, e le
   * candidature restano il dominio personale principale (§6). Promuovere i
   * Salvati perché due scadenze sono vicine sposterebbe la pagina sotto i
   * piedi dell'utente senza che i Salvati siano diventati più importanti.
   *
   * Risoluzione: il dominio conferma l'invio (`domain_transition`). Aprire
   * l'opportunità non risolve; §18 impone il ricalcolo dopo invio, unsave,
   * chiusura, scadenza spostata o superata.
   */
  saved_deadline: {
    actionLabel: "Vedi opportunità",
    capabilities: [],
    deadlinePolicy: "real",
    feature: "personal_saved_positions",
    id: "saved_deadline",
    impact: 60,
    level: "attention",
    moduleId: null,
    nature: "action",
    presentation: "row",
    resolution: "domain_transition",
    source: "saved_ads × recruiting_ads.application_deadline_at",
    targetHref: (signal) => `/position/${signal.targetId}`,
    // Il titolo è l'opportunità, non il motivo: «Provino AC Como Under 19».
    // Il backend manda titolo, società e squadra; qui si sceglie il più
    // specifico disponibile senza inventare testo.
    title: (signal) =>
      signal.payload?.adTitle?.trim() ||
      [signal.payload?.clubName, signal.payload?.teamName]
        .filter(Boolean)
        .join(" · ") ||
      "Opportunità salvata",
  },

  /**
   * DAS-REV-03 §13. Un solo elemento aggregato anche con più requisiti
   * mancanti, con una destinazione coerente.
   *
   * `relevant` e non `attention`: non c'è una finestra temporale, ma è
   * un'azione obbligatoria e precede gli informativi per natura (§8,
   * criterio 2).
   *
   * Risoluzione: `domain_requirements_met`. §13 è categorico — «Un requisito
   * si risolve dopo il salvataggio confermato dei dati necessari. Non basta
   * aprire il form, leggere una notifica o premere un pulsante locale
   * "Completato".»
   */
  profile_requirements_missing: {
    actionLabel: "Completa informazioni",
    capabilities: [],
    deadlinePolicy: "none",
    feature: "personal_profile_requirements",
    id: "profile_requirements_missing",
    impact: 65,
    level: "relevant",
    moduleId: null,
    nature: "action",
    presentation: "card",
    resolution: "domain_requirements_met",
    source: "ruolo principale canonico del profilo (per ruolo)",
    // Più requisiti → l'hub di modifica del ruolo, che li contiene tutti.
    // Uno solo → la sezione esatta, così la CTA non chiede di cercare.
    targetHref: (signal) => {
      const requirements = signal.payload?.requirements ?? [];

      if (requirements.length === 1) {
        return requirements[0].href;
      }

      return (
        signal.payload?.hubHref ?? requirements[0]?.href ?? "/profile/edit"
      );
    },
    title: () => "Informazioni richieste",
  },
};

export function isKnownPriorityType(
  value: string,
): value is DashboardPriorityTypeId {
  return value in PRIORITY_REGISTRY;
}
