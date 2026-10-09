import { useCallback, useEffect, useRef, useState } from "react";

import type { DashboardModuleId, ModuleDefinition } from "../modules/module-registry";
import { orderFingerprint, type OrderApplyTrigger } from "./module-order";

/**
 * Ordine applicato e ordine in attesa (§12).
 *
 * Tre regole, e la loro asimmetria è il contenuto dell'hook:
 *
 *  · **riordini e aggiunte** attendono un momento sicuro;
 *  · **rimozioni** hanno effetto immediato, perché possono dipendere da una
 *    revoca e §21 chiede che non aspettino nulla;
 *  · un ordine proposto identico a quello applicato non è "in attesa".
 *
 * Il filtro che realizza la seconda regola è una riga sola: l'ordine mostrato
 * è sempre `applied ∩ proposed`. Un modulo sparito dalla proposta non può
 * comparire, qualunque sia lo stato di interazione.
 */
export function useDashboardOrder(input: {
  /** true durante scroll, gesture, input: nessun riordino sotto il dito. */
  isInteracting: boolean;
  proposed: ModuleDefinition[];
  /**
   * Cambia a ogni momento sicuro: primo caricamento utile, cambio identità,
   * refresh completato, ritorno da un'azione confermata.
   */
  safePointToken: string;
}): {
  /** true quando esiste un ordine nuovo non ancora applicato. */
  hasPendingOrder: boolean;
  modules: ModuleDefinition[];
} {
  const [appliedIds, setAppliedIds] = useState<DashboardModuleId[]>(() =>
    input.proposed.map((module) => module.id),
  );

  const proposedIds = input.proposed.map((module) => module.id);
  const proposedKey = orderFingerprint(input.proposed);
  const appliedKey = appliedIds.join("|");

  const lastSafePoint = useRef(input.safePointToken);

  const apply = useCallback((ids: DashboardModuleId[]) => {
    setAppliedIds((current) =>
      current.join("|") === ids.join("|") ? current : ids,
    );
  }, []);

  useEffect(() => {
    const isNewSafePoint = lastSafePoint.current !== input.safePointToken;

    if (isNewSafePoint) {
      lastSafePoint.current = input.safePointToken;
    }

    // Primo ordine utile: non c'è niente da proteggere, si applica subito.
    if (appliedIds.length === 0) {
      apply(proposedIds);

      return;
    }

    if (isNewSafePoint && !input.isInteracting) {
      apply(proposedIds);

      return;
    }

    // Fuori da un momento sicuro si applica comunque **l'insieme** — mai
    // l'ordine: le aggiunte e i riordini restano pending, le rimozioni sono
    // già garantite dal filtro in uscita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apply, input.isInteracting, input.safePointToken, proposedKey]);

  const visible = appliedIds
    .map((id) => input.proposed.find((module) => module.id === id))
    .filter((module): module is ModuleDefinition => !!module);

  // Un modulo appena autorizzato non è ancora nell'ordine applicato: non
  // scompare, resta in coda finché un momento sicuro non lo colloca.
  const appended = input.proposed.filter(
    (module) => !appliedIds.includes(module.id),
  );

  return {
    hasPendingOrder: appliedKey !== proposedKey,
    modules: [...visible, ...appended],
  };
}
