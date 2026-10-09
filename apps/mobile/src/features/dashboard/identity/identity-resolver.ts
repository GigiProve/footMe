/**
 * Risoluzione del contesto Dashboard all'apertura e dopo una revoca (§11, §13).
 *
 * Funzioni pure, separate dal provider: sono la parte più facile da sbagliare
 * — l'ordine di precedenza e il fallback — e l'unica verificabile senza
 * montare un albero React.
 */

import type { DashboardIdentity } from "../dashboard-types";

export type ResolveInput = {
  /** Identità disponibili, nell'ordine deterministico deciso dal backend. */
  identities: DashboardIdentity[];
  /** Identità richiesta da una route contestuale ("Apri Dashboard società"). */
  requestedId?: string | null;
  /** Ultima Dashboard usata da questo utente, da preferenza persistita. */
  storedId?: string | null;
};

/**
 * Ordine di precedenza:
 *
 *   1. identità richiesta esplicitamente dalla route, **se autorizzata**;
 *   2. ultima usata, **se ancora valida**;
 *   3. personale, se eleggibile;
 *   4. prima altra identità valida, in ordine deterministico;
 *   5. null — nessuna identità operativa.
 *
 * "Se autorizzata" ha un significato preciso: l'identità deve trovarsi
 * nell'elenco appena restituito dal backend. Una preferenza salvata o un id in
 * un deep link non provano nulla da soli; una cache vecchia nemmeno (§9).
 */
export function resolveInitialIdentity({
  identities,
  requestedId,
  storedId,
}: ResolveInput): DashboardIdentity | null {
  if (identities.length === 0) {
    return null;
  }

  const requested = findAuthorized(identities, requestedId);
  if (requested) {
    return requested;
  }

  const stored = findAuthorized(identities, storedId);
  if (stored) {
    return stored;
  }

  return fallbackIdentity(identities);
}

/**
 * Fallback dopo la revoca dell'identità attiva: personale valido, altrimenti
 * la prima altra identità valida. Mai un'aggregazione, mai una scelta che
 * dipenda da quale identità è appena stata persa.
 */
export function fallbackIdentity(
  identities: DashboardIdentity[],
): DashboardIdentity | null {
  const personal = identities.find((identity) => identity.kind === "person");

  return personal ?? identities[0] ?? null;
}

function findAuthorized(
  identities: DashboardIdentity[],
  id: string | null | undefined,
): DashboardIdentity | null {
  if (!id) {
    return null;
  }

  return identities.find((identity) => identity.id === id) ?? null;
}

/**
 * Il contesto identità si mostra solo quando dice qualcosa.
 *
 *   · una sola identità personale → nascosto: l'header "Dashboard" basta e
 *     ripetere nome e avatar dell'utente a se stesso è rumore;
 *   · una sola identità organizzativa → statico, senza chevron;
 *   · due o più → selezionabile.
 *
 * Il conteggio comprende **tutte** le identità eleggibili, personale incluso:
 * una Società più un personale richiedono il selector anche se la Società
 * amministrabile è una sola (§8).
 */
export type IdentityPresentation = "hidden" | "static" | "selectable";

export function identityPresentation(
  identities: DashboardIdentity[],
  current: DashboardIdentity | null,
): IdentityPresentation {
  if (identities.length > 1) {
    return "selectable";
  }

  if (!current || current.kind === "person") {
    return "hidden";
  }

  return "static";
}
