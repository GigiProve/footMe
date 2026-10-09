import { useEffect, useState } from "react";

import {
  isOrgAccessWindowValid,
  ORG_ACCESS_WINDOW_MS,
} from "../cache/freshness-policy";

/**
 * Ogni quanto si ricontrolla la finestra. Trenta secondi su quindici minuti:
 * abbastanza fitto perché la scadenza non resti visibile a lungo, abbastanza
 * rado da non essere un timer visuale.
 */
const TICK_MS = 30 * 1000;

/**
 * Validità della finestra di accesso organizzativa (§15).
 *
 * Il punto di questo hook è la **pagina già aperta**: alla scadenza i
 * contenuti privati devono diventare inaccessibili anche senza che l'utente
 * faccia nulla. Senza un tick, una Dashboard Società lasciata aperta offline
 * resterebbe leggibile indefinitamente.
 *
 * L'identità personale non passa di qui: per il personale valgono la sessione
 * e la cache privata dell'app, non una finestra di scope che non esiste.
 *
 * `Date.now()` arretrato produce un'età negativa e `isOrgAccessWindowValid`
 * restituisce `false`: un orologio spostato indietro **accorcia** la
 * finestra, non la prolunga (QA-30).
 */
export function useAccessWindow(input: {
  accessVerifiedAt: number | null;
  isOrganizational: boolean;
}): { isValid: boolean; remainingMs: number } {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!input.isOrganizational || input.accessVerifiedAt === null) {
      return;
    }

    const timer = setInterval(() => setNow(Date.now()), TICK_MS);

    return () => clearInterval(timer);
  }, [input.accessVerifiedAt, input.isOrganizational]);

  // Una verifica appena riuscita riapre subito la finestra senza attendere
  // il tick successivo.
  useEffect(() => {
    setNow(Date.now());
  }, [input.accessVerifiedAt]);

  if (!input.isOrganizational) {
    return { isValid: true, remainingMs: Number.POSITIVE_INFINITY };
  }

  if (input.accessVerifiedAt === null) {
    return { isValid: false, remainingMs: 0 };
  }

  const isValid = isOrgAccessWindowValid({
    accessVerifiedAt: input.accessVerifiedAt,
    now,
  });

  return {
    isValid,
    remainingMs: Math.max(
      0,
      input.accessVerifiedAt + ORG_ACCESS_WINDOW_MS - now,
    ),
  };
}
