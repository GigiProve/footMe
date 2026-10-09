/**
 * Freshness, scadenza rigida, accesso offline e retention (§14, §15).
 *
 * Quattro durate **diverse** che il progetto teneva confuse in un `staleTime`
 * globale di 30 s:
 *
 *   1. **stale**            quando il dato va aggiornato;
 *   2. **scadenza rigida**  quando il dato non è più mostrabile;
 *   3. **finestra accesso** quanto a lungo si può mostrare un dato privato
 *                           organizzativo senza una verifica server-side;
 *   4. **retention**        quanto a lungo il file resta sul dispositivo.
 *
 * La 3 non è un caso della 2: un payload fresco di 30 secondi non è
 * mostrabile se la verifica di accesso ha 20 minuti. Il valore effettivo è
 * sempre il **minimo** fra le due.
 */

/** Provider: determina l'intervallo di stale, non l'autorizzazione. */
export type FreshnessProvider =
  /** Segnali operativi, priorità, summary, candidature, programmati. */
  | "operational"
  /** Elenchi gestionali meno variabili (Squadre). */
  | "management"
  /** Metadata di presentazione (nome, logo, verifica). */
  | "presentation";

export const STALE_MS: Record<FreshnessProvider, number> = {
  operational: 60 * 1000,
  management: 5 * 60 * 1000,
  presentation: 15 * 60 * 1000,
};

/**
 * Scadenza rigida: oltre questo limite il payload **non è mostrabile**,
 * nemmeno marcato come vecchio. §14 chiede che ogni provider ne abbia una
 * finita.
 */
export const HARD_EXPIRY_MS: Record<FreshnessProvider, number> = {
  operational: 15 * 60 * 1000,
  management: 15 * 60 * 1000,
  presentation: 24 * 60 * 60 * 1000,
};

/**
 * **Decisione V1 di questo consolidamento** (§15): i dati privati della
 * Dashboard SOCIETY/MEDIA sono visualizzabili da cache per un massimo di 15
 * minuti dall'ultima verifica server-side riuscita di accesso e scope.
 *
 * Non è una promessa di revoca immediata offline — che nessun client può
 * mantenere — ma il limite entro cui una revoca non ancora osservata può
 * restare invisibile.
 */
export const ORG_ACCESS_WINDOW_MS = 15 * 60 * 1000;

/**
 * Retention del file persistito. 24 ore di retention **non** significano 24
 * ore di visualizzazione: la scadenza rigida resta quella sopra.
 */
export const RETENTION_MS = 24 * 60 * 60 * 1000;

export type FreshnessVerdict = "fresh" | "stale_usable" | "expired";

/**
 * Verdetto su un payload. `now` è un parametro per poter testare con orologio
 * controllato, come §36 richiede.
 */
export function evaluateFreshness(input: {
  fetchedAt: number;
  now: number;
  provider: FreshnessProvider;
}): FreshnessVerdict {
  const age = input.now - input.fetchedAt;

  // Orologio arretrato: l'età è negativa e non si può stabilire la validità.
  // §15 chiede di rivalidare prima di esporre dati privati, quindi scaduto.
  if (age < 0) {
    return "expired";
  }

  if (age >= HARD_EXPIRY_MS[input.provider]) {
    return "expired";
  }

  return age >= STALE_MS[input.provider] ? "stale_usable" : "fresh";
}

/**
 * La verifica di accesso organizzativa è ancora valida?
 *
 * Una verifica del solo stato di rete o del token locale **non** rinnova la
 * validità dei permessi (§15): questa funzione guarda solo l'istante
 * dell'ultima verifica server-side riuscita.
 */
export function isOrgAccessWindowValid(input: {
  accessVerifiedAt: number;
  now: number;
}): boolean {
  const elapsed = input.now - input.accessVerifiedAt;

  return elapsed >= 0 && elapsed < ORG_ACCESS_WINDOW_MS;
}

/** Il record va eliminato dal disco? Indipendente dalla mostrabilità. */
export function isBeyondRetention(input: {
  fetchedAt: number;
  now: number;
}): boolean {
  return input.now - input.fetchedAt >= RETENTION_MS;
}
