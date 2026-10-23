/**
 * Modello del dettaglio gestionale di una Position (DAS-REV-17 §4).
 *
 * Non c'è un tipo nuovo per la bozza e uno per l'attiva: §4 vieta
 * «DraftPositionV2, PublishedPositionCopy, modelli per singolo ruolo». È lo
 * **stesso** oggetto, letto in due momenti del suo lifecycle, e gli screen
 * 01/04 e 07/11 del mockup sono infatti la stessa Position prima e dopo.
 *
 * `PositionManageDetail` estende `PositionDraft` invece di ricopiarlo: il
 * composer e questa superficie leggono lo stesso schema, e l'estensione fa
 * sì che il renderer pubblico dell'anteprima (`PositionPublicContent`)
 * accetti il dettaglio senza conversioni — §15 chiede che l'anteprima usi
 * «il renderer pubblico del composer, con tutti i dati della versione
 * candidata alla pubblicazione».
 *
 * Ciò che si aggiunge è quanto il composer non conosce e la gestione sì:
 * lifecycle completo, conteggi Application autorizzati e scadenza.
 */
import type { PositionDraft } from "../compose/compose-types";
import type { PositionGroup } from "../positions-types";

/**
 * Il lifecycle reale del dominio, non le label italiane.
 *
 * §4: «Usa le label italiane "Bozza" e "Attiva" nella UI. Mantieni
 * internamente gli enum reali del dominio; non introdurre un enum `ACTIVE`
 * soltanto perché il repository usa `PUBLISHED` per una posizione attiva.»
 */
export type PositionLifecycle = "draft" | "published" | "closed";

export type PositionManageDetail = PositionDraft & {
  accessVerifiedAt: number;
  /**
   * `null` quando l'actor non è autorizzato **oppure** quando il valore non
   * è ancora noto: `countsAvailable` distingue i due casi. §18 — «Non
   * sostituire un count sconosciuto con zero.»
   */
  applicationsNew: number | null;
  applicationsTotal: number | null;
  /** Chiusura: DAS-REV-18. Qui serve solo a non mostrare azioni assenti. */
  canClose: boolean;
  closedAt: string | null;
  countsAvailable: boolean;
  dataRevision: number;
  deadlineAt: string | null;
  group: PositionGroup;
  lifecycle: PositionLifecycle;
  /** `true` quando la scadenza ha interrotto la ricezione (DAS-REV-15 §17). */
  receivingClosed: boolean;
  /** Solo sulle Chiuse, e solo con una fotografia storica. */
  seasonLabel: string | null;
  teamIsInactive: boolean;
};

/**
 * Il campo a cui un elemento mancante rimanda nell'editor (§6).
 *
 * «Dettaglio bozza → singolo elemento mancante: stesso editor, sul campo
 * pertinente.» L'ancora è la chiave del campo nello schema condiviso, non un
 * indice di schermata: due posizioni di scroll dello stesso form non hanno
 * numeri di passo a cui puntare.
 */
export type PositionFieldAnchor = string;

/** Una riga dell'elenco «Da completare» (§7). */
export type PositionMissingItem = {
  /** Ancora nell'editor. `null` quando il campo non vive in quel form. */
  anchor: PositionFieldAnchor | null;
  /** «Imposta un intervallo oppure scegli Nessun limite di età.» */
  hint: string;
  /** «Fascia d'età». */
  label: string;
  /** Valore corrente, o «Da impostare» quando manca. */
  value: string | null;
};
