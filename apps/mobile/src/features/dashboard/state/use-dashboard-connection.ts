import { useCallback, useRef, useState } from "react";

import {
  classifyDashboardError,
  type DashboardErrorCategory,
} from "./error-classification";
import {
  nextConnectionState,
  type DashboardConnectionState,
} from "./dashboard-state";

/**
 * Stato di connessione derivato dagli esiti delle richieste (§17).
 *
 * Non esiste un rilevatore proattivo in questo progetto, e la task non
 * giustifica da sola l'aggiunta di `netinfo` (CC-02): la distinzione che
 * serve — «non affermare "Sei offline" solo perché un server è
 * irraggiungibile» — si ottiene dalla **forma** del fallimento. Una risposta
 * HTTP, anche 500, dimostra che il dispositivo è online.
 *
 * Le oscillazioni rapide non producono raffiche di banner perché lo stato
 * cambia solo quando cambia davvero: `setState` con lo stesso valore non
 * rende, e gli esiti arrivano già coalescenti da TanStack Query. L'unica
 * sequenza possibile è offline → online, cioè il ritorno della rete.
 */
export function useDashboardConnection(): {
  connection: DashboardConnectionState;
  /** Ultima categoria osservata, per scegliere copy e policy di retry. */
  lastCategory: DashboardErrorCategory | null;
  reportFailure: (error: unknown) => DashboardErrorCategory;
  reportSuccess: () => void;
} {
  const [connection, setConnection] = useState<DashboardConnectionState>("unknown");
  const [lastCategory, setLastCategory] = useState<DashboardErrorCategory | null>(
    null,
  );
  const connectionRef = useRef<DashboardConnectionState>("unknown");

  const reportSuccess = useCallback(() => {
    connectionRef.current = "online";
    setConnection("online");
    setLastCategory(null);
  }, []);

  const reportFailure = useCallback((error: unknown) => {
    const category = classifyDashboardError(error);

    const next = nextConnectionState({
      category,
      current: connectionRef.current,
      outcome: "failure",
    });

    connectionRef.current = next;
    setConnection(next);
    setLastCategory(category);

    return category;
  }, []);

  return { connection, lastCategory, reportFailure, reportSuccess };
}
