/**
 * Modello degli stati della Dashboard (§13).
 *
 * Cinque dimensioni **separate**, non cinque booleani indipendenti: la
 * differenza è che qui le combinazioni valide sono derivate da una funzione
 * sola, e non possono formarsi stati impossibili come "pagina pronta e
 * nessun dato interpretabile".
 *
 * Sono combinazioni legittime, e tutte e tre compaiono nei master:
 *   · pronta e offline              (screen 05)
 *   · pronta con refresh fallito    (screen 06)
 *   · pronta con un modulo in errore (screen 04)
 *
 * L'errore di un modulo **non** diventa errore di pagina.
 */

import type { DashboardErrorCategory } from "./error-classification";

/** Stato della pagina. */
export type DashboardPageState =
  /** Prima composizione non ancora nota: skeleton. */
  | "initial"
  /** Almeno un modulo operativo con dati consultabili. */
  | "ready"
  /** Risposte valide, nessuna attività da mostrare. */
  | "empty"
  /** Nessuna Dashboard sufficientemente affidabile da mostrare. */
  | "unavailable";

/** Stato di un singolo modulo. */
export type DashboardModuleState = "loading" | "loaded" | "empty" | "error";

/**
 * Connessione. `unknown` non è un ripiego: senza rilevamento proattivo è lo
 * stato onesto prima della prima risposta, e impedisce di dichiarare un
 * offline che non è stato osservato.
 */
export type DashboardConnectionState = "online" | "offline" | "unknown";

export type DashboardRefreshState = "idle" | "running" | "failed";

/** Accesso all'identità, secondo la finestra di §15. */
export type DashboardAccessState = "valid" | "revalidate" | "revoked";

/** Utilizzabilità del dato, indipendente dalla sua freschezza percepita. */
export type DashboardDataState =
  | "absent"
  | "fresh"
  | "stale_usable"
  | "unusable";

export type DashboardStateInput = {
  access: DashboardAccessState;
  connection: DashboardConnectionState;
  /** Esiste almeno un modulo con dati utili consultabili. */
  hasUsableContent: boolean;
  /** Tutti i moduli eleggibili hanno risposto in modo valido. */
  allModulesSettled: boolean;
  /** Tutti i moduli eleggibili hanno risposto e sono vuoti. */
  allModulesEmpty: boolean;
  /** La composizione (identità + capability + moduli) è nota e interpretabile. */
  compositionKnown: boolean;
  data: DashboardDataState;
  /** Almeno un modulo eleggibile esiste per questa identità. */
  hasEligibleModules: boolean;
};

/**
 * Deriva lo stato di pagina. L'ordine delle condizioni è il contenuto della
 * funzione: invertirne due produce esattamente i bug che §13 vieta.
 */
export function derivePageState(input: DashboardStateInput): DashboardPageState {
  // La revoca ha effetto immediato e non attende un safe point (§21).
  if (input.access === "revoked") {
    return "unavailable";
  }

  // Senza composizione interpretabile non si sa nemmeno di chi sarebbe la
  // pagina: non è un empty, è un'indisponibilità.
  if (!input.compositionKnown) {
    return "initial";
  }

  if (input.data === "unusable" && !input.hasUsableContent) {
    return "unavailable";
  }

  // «Nessun modulo autorizzato disponibile per configurazione o capability è
  // un caso distinto dal fallimento della rete» (§13): resta il fallback
  // neutro, non il Global Error.
  if (!input.hasEligibleModules) {
    return "empty";
  }

  if (input.hasUsableContent) {
    return "ready";
  }

  // Global Empty richiede risposte **valide** su tutti i moduli eleggibili:
  // moduli ancora pending o in errore non si convertono in liste vuote.
  if (input.allModulesSettled && input.allModulesEmpty) {
    return "empty";
  }

  if (!input.allModulesSettled) {
    return "initial";
  }

  return "unavailable";
}

/**
 * Transizione dello stato di connessione.
 *
 * Un successo riporta sempre online; solo un fallimento di trasporto porta
 * offline. Un 500 lascia lo stato invariato: il server è irraggiungibile, il
 * dispositivo no (§17).
 */
export function nextConnectionState(input: {
  category: DashboardErrorCategory | null;
  current: DashboardConnectionState;
  outcome: "success" | "failure";
}): DashboardConnectionState {
  if (input.outcome === "success") {
    return "online";
  }

  if (input.category === "network" || input.category === "offline") {
    return "offline";
  }

  return input.current;
}

/**
 * Lo stato globale "offline senza dati" (screen 07, variante offline) si
 * distingue dall'errore generale solo qui: stessa superficie, copy diversa.
 */
export function isOfflineWithoutData(input: {
  connection: DashboardConnectionState;
  pageState: DashboardPageState;
}): boolean {
  return input.connection === "offline" && input.pageState === "unavailable";
}
