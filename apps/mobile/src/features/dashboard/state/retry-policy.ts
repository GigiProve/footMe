/**
 * Policy centralizzata di timeout, retry e budget (§18).
 *
 * Il progetto non ne aveva una: `query-client.ts` applica il default di
 * TanStack Query (3 retry con backoff esponenziale) a ogni lettura. Per la
 * Dashboard significa fino a quattro tentativi su un 403 — che non diventerà
 * mai un 200 — e un loading che dura più del budget.
 *
 * Default V1, modificabili per provider ma non duplicabili per schermata.
 */

import type { DashboardErrorCategory } from "./error-classification";

/** Timeout per singolo tentativo, accesso e composizione. */
export const ACCESS_TIMEOUT_MS = 10_000;
/** Timeout per singolo tentativo, dati di modulo. */
export const MODULE_TIMEOUT_MS = 15_000;
/** Massimo un retry automatico per le letture con errore transitorio. */
export const MAX_AUTO_RETRIES = 1;
/** Backoff iniziale; il jitter evita che N moduli ritentino nello stesso istante. */
export const BACKOFF_BASE_MS = 1_000;
export const BACKOFF_JITTER_MS = 300;
/** Budget complessivo di un ciclo di caricamento o refresh, retry inclusi. */
export const CYCLE_BUDGET_MS = 30_000;

/**
 * Categorie che non vengono **mai** ritentate automaticamente (§18).
 *
 * Non è un elenco di errori gravi: è l'elenco di quelli che un secondo
 * tentativo identico non può risolvere. Il rate limit è qui perché il retry
 * automatico aggirerebbe l'attesa imposta dal backend.
 */
const NO_AUTO_RETRY: readonly DashboardErrorCategory[] = [
  "offline",
  "authorization",
  "not_found",
  "unsupported_payload",
  "maintenance",
  "rate_limit",
];

export function shouldAutoRetry(input: {
  attempt: number;
  category: DashboardErrorCategory;
  elapsedMs: number;
}): boolean {
  if (input.attempt >= MAX_AUTO_RETRIES) {
    return false;
  }

  if (NO_AUTO_RETRY.includes(input.category)) {
    return false;
  }

  // §18: «Il budget complessivo prevale sul tempo residuo del singolo
  // tentativo.» Un retry che partirebbe fuori budget non parte.
  return input.elapsedMs + BACKOFF_BASE_MS < CYCLE_BUDGET_MS;
}

/**
 * Attesa prima del tentativo successivo. `random` è iniettabile perché un
 * test con jitter casuale non è un test.
 */
export function backoffDelayMs(
  attempt: number,
  random: () => number = Math.random,
): number {
  return BACKOFF_BASE_MS * 2 ** attempt + Math.floor(random() * BACKOFF_JITTER_MS);
}

/**
 * Tempo residuo del tentativo: il minimo fra il timeout del tentativo e
 * quanto resta del budget. Alla scadenza si esce dal loading nello stato
 * pertinente, non si resta appesi.
 */
export function remainingAttemptBudgetMs(input: {
  attemptTimeoutMs: number;
  elapsedMs: number;
}): number {
  return Math.max(0, Math.min(input.attemptTimeoutMs, CYCLE_BUDGET_MS - input.elapsedMs));
}

/**
 * Esegue una promise con un timeout. Non interrompe il lavoro sottostante —
 * Supabase non espone un AbortSignal su `rpc()` — ma impedisce al chiamante
 * di restare in loading oltre il budget, che è il requisito di §18.
 */
export async function withTimeout<T>(
  // `PromiseLike` e non `Promise`: i builder di supabase-js sono thenable,
  // non Promise, e tipizzarli stretti costringerebbe ogni chiamante a un
  // `Promise.resolve()` che ne perde la tipizzazione.
  task: PromiseLike<T>,
  timeoutMs: number,
  onTimeout: () => Error,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(onTimeout()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
