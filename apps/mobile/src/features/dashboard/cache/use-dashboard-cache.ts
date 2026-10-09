import { useCallback, useEffect, useRef, useState } from "react";

import type { DashboardIdentity } from "../dashboard-types";
import {
  pruneDashboardCache,
  readDashboardCache,
  writeDashboardCache,
  type CacheReadResult,
} from "./dashboard-cache";
import type { FreshnessProvider, FreshnessVerdict } from "./freshness-policy";

export type DashboardCacheState<TPayload> = {
  /** Istante dell'ultima verifica server-side nota, da cache o da rete. */
  accessVerifiedAt: number | null;
  freshness: FreshnessVerdict | null;
  /** true quando la lettura iniziale è conclusa: prima non si decide nulla. */
  isHydrated: boolean;
  payload: TPayload | null;
  /** Perché la cache non è utilizzabile, quando non lo è. */
  unusableReason: Exclude<CacheReadResult<TPayload>, { status: "usable" }>["reason"] | null;
};

/**
 * Idratazione da cache e scrittura dopo un risultato valido (§14).
 *
 * Due invarianti, entrambe esplicite in §14:
 *
 *  · la lettura dalla cache, un retry fallito e il passaggio in foreground
 *    **non** aggiornano `fetchedAt` né prolungano la scadenza — qui l'unica
 *    funzione che scrive richiede il payload, quindi non è chiamabile "a
 *    vuoto";
 *  · un errore temporaneo non cancella una cache ancora valida — questo hook
 *    non ha alcun ramo che svuoti lo stato in risposta a un errore.
 *
 * L'hook è keyed sul contesto: cambiare identità o capability produce una
 * chiave diversa, quindi una nuova idratazione. Non c'è un ramo "ripulisci al
 * cambio": semplicemente non si trova il record dell'altro contesto (QA-24).
 */
export function useDashboardCache<TPayload>(input: {
  actorId: string;
  identity: DashboardIdentity | null;
  isPayload: (value: unknown) => value is TPayload;
  provider: FreshnessProvider;
}): DashboardCacheState<TPayload> & {
  store: (payload: TPayload, accessVerifiedAt: number, revision: number) => void;
} {
  const { actorId, identity, isPayload, provider } = input;

  const [state, setState] = useState<DashboardCacheState<TPayload>>({
    accessVerifiedAt: null,
    freshness: null,
    isHydrated: false,
    payload: null,
    unusableReason: null,
  });

  // Il contesto per cui lo stato corrente è valido. Serve a ignorare una
  // lettura asincrona che ritorna dopo uno switch (§21).
  const contextKey = identity ? `${actorId}:${identity.id}` : "";
  const contextRef = useRef(contextKey);

  useEffect(() => {
    contextRef.current = contextKey;
  }, [contextKey]);

  useEffect(() => {
    let isMounted = true;

    if (!actorId || !identity) {
      setState({
        accessVerifiedAt: null,
        freshness: null,
        isHydrated: true,
        payload: null,
        unusableReason: null,
      });

      return () => {
        isMounted = false;
      };
    }

    // Lo stato riparte da "non idratato" a ogni cambio di contesto: senza
    // questo, i dati di A resterebbero a schermo sotto l'header di B per il
    // tempo della lettura.
    setState({
      accessVerifiedAt: null,
      freshness: null,
      isHydrated: false,
      payload: null,
      unusableReason: null,
    });

    const expectedContext = contextKey;

    void readDashboardCache<TPayload>({
      actorId,
      identity,
      isPayload,
      now: Date.now(),
      provider,
    }).then((result) => {
      if (!isMounted || contextRef.current !== expectedContext) {
        return;
      }

      if (result.status === "usable") {
        setState({
          accessVerifiedAt: result.record.accessVerifiedAt,
          freshness: result.freshness,
          isHydrated: true,
          payload: result.record.payload,
          unusableReason: null,
        });

        return;
      }

      setState({
        accessVerifiedAt: null,
        freshness: null,
        isHydrated: true,
        payload: null,
        unusableReason: result.reason,
      });
    });

    return () => {
      isMounted = false;
    };
    // `isPayload` è una funzione stabile definita a modulo: includerla
    // rieseguirebbe l'idratazione a ogni render se un chiamante passasse una
    // lambda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, contextKey, identity, provider]);

  // Retention: i payload oltre il limite spariscono dal disco. Non estende la
  // finestra di visualizzazione, che resta quella di `freshness-policy`.
  useEffect(() => {
    void pruneDashboardCache(Date.now());
  }, []);

  const store = useCallback(
    (payload: TPayload, accessVerifiedAt: number, revision: number) => {
      if (!actorId || !identity) {
        return;
      }

      const now = Date.now();

      setState({
        accessVerifiedAt,
        freshness: "fresh",
        isHydrated: true,
        payload,
        unusableReason: null,
      });

      void writeDashboardCache({
        accessVerifiedAt,
        actorId,
        identity,
        now,
        payload,
        revision,
      });
    },
    [actorId, identity],
  );

  return { ...state, store };
}
