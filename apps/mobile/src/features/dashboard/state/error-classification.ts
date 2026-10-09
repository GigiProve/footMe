/**
 * Classificazione interna degli errori (§18).
 *
 * I codici tecnici **non compaiono nella UI**: servono a decidere se
 * ritentare, se dichiarare l'offline e quale copy mostrare.
 *
 * La distinzione portante è una sola e si legge dalla presenza di uno stato
 * HTTP: se il server ha risposto, il dispositivo è online — anche quando la
 * risposta è un 500. §17 lo chiede esplicitamente: «Non affermare "Sei
 * offline" solo perché un server è irraggiungibile.»
 *
 * LIMITE DICHIARATO: senza `@react-native-community/netinfo` non esiste un
 * rilevamento **proattivo** della connessione. Lo stato parte da
 * `unknown` e diventa `offline` solo dopo un fallimento di trasporto. Il
 * modello degli stati prevede `unknown` proprio per non mentire in quella
 * finestra. L'alternativa — introdurre la dipendenza — non è stata scelta
 * perché la distinzione richiesta dalla task (connettività ≠ freshness) è
 * già ottenibile senza, e CC-02 chiede una necessità dimostrata.
 */

export const DASHBOARD_ERROR_CATEGORIES = [
  "offline",
  "network",
  "timeout",
  "server",
  "authorization",
  "not_found",
  "unsupported_payload",
  "rate_limit",
  "maintenance",
  "unknown",
] as const;

export type DashboardErrorCategory =
  (typeof DASHBOARD_ERROR_CATEGORIES)[number];

/** Errore sollevato dal budget o dal timeout per tentativo (§18). */
export class DashboardTimeoutError extends Error {
  constructor(message = "Dashboard request timed out") {
    super(message);
    this.name = "DashboardTimeoutError";
  }
}

/** Payload che questa build non sa interpretare (§18). */
export class DashboardPayloadError extends Error {
  constructor(message = "Dashboard payload not interpretable") {
    super(message);
    this.name = "DashboardPayloadError";
  }
}

const NETWORK_HINTS = [
  "network request failed",
  "failed to fetch",
  "network error",
  "load failed",
  "connection",
];

function readNumber(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  return null;
}

function fromStatus(status: number): DashboardErrorCategory {
  if (status === 401 || status === 403) {
    return "authorization";
  }

  if (status === 404) {
    return "not_found";
  }

  if (status === 408 || status === 504) {
    return "timeout";
  }

  if (status === 429) {
    return "rate_limit";
  }

  if (status === 503) {
    return "maintenance";
  }

  if (status >= 500) {
    return "server";
  }

  return "unknown";
}

/**
 * Codici PostgreSQL / PostgREST che hanno un significato preciso per questa
 * Dashboard. `42501` è il rifiuto di una policy RLS: è un problema di
 * autorizzazione, non un errore server, e non va ritentato.
 */
function fromPostgresCode(code: string): DashboardErrorCategory | null {
  if (code === "42501" || code === "PGRST301") {
    return "authorization";
  }

  if (code === "PGRST116") {
    return "not_found";
  }

  // 42703 colonna inesistente, 42P01 relazione inesistente: il client parla
  // con uno schema che non riconosce.
  if (code === "42703" || code === "42P01" || code === "PGRST202") {
    return "unsupported_payload";
  }

  return null;
}

export function classifyDashboardError(error: unknown): DashboardErrorCategory {
  if (!error) {
    return "unknown";
  }

  if (error instanceof DashboardTimeoutError) {
    return "timeout";
  }

  if (error instanceof DashboardPayloadError) {
    return "unsupported_payload";
  }

  if (error instanceof Error && error.name === "AbortError") {
    return "timeout";
  }

  if (typeof error === "object") {
    const source = error as Record<string, unknown>;

    const code = typeof source.code === "string" ? source.code : null;
    const fromCode = code ? fromPostgresCode(code) : null;

    if (fromCode) {
      return fromCode;
    }

    const status = readNumber(source, "status") ?? readNumber(source, "statusCode");

    // Uno status HTTP dimostra che una risposta è arrivata: qualunque sia
    // l'esito, non è un'assenza di rete.
    if (status !== null && status > 0) {
      return fromStatus(status);
    }
  }

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);

  const normalized = message.toLowerCase();

  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return "timeout";
  }

  // Nessuno status e una forma da fallimento di trasporto: la richiesta non
  // ha raggiunto il server.
  if (error instanceof TypeError || NETWORK_HINTS.some((hint) => normalized.includes(hint))) {
    return "network";
  }

  return "unknown";
}

/**
 * Un fallimento di trasporto è l'unico indizio di assenza di rete di cui
 * disponiamo senza netinfo. `timeout` **non** lo è: un server lento risponde
 * comunque da un dispositivo online.
 */
export function suggestsOffline(category: DashboardErrorCategory): boolean {
  return category === "offline" || category === "network";
}
