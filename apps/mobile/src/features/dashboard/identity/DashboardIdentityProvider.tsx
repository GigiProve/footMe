import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "../../auth/use-session";
import { DASHBOARD_QK } from "../dashboard-keys";
import type { DashboardIdentity } from "../dashboard-types";
import { fetchDashboardIdentities } from "./identity-service";
import {
  fallbackIdentity,
  identityPresentation,
  resolveInitialIdentity,
  type IdentityPresentation,
} from "./identity-resolver";
import {
  readLastIdentityId,
  writeLastIdentityId,
} from "./identity-preference";

export type DashboardContextValue = {
  /**
   * Token del contesto attivo. Cambia a ogni switch, anche verso un'identità
   * già visitata. Chi avvia un'operazione asincrona lo cattura e lo confronta
   * al ritorno: una risposta di B non può applicarsi a C.
   */
  contextToken: string;
  current: DashboardIdentity | null;
  error: unknown;
  identities: DashboardIdentity[];
  isLoading: boolean;
  /** true finché la composizione del nuovo contesto non è stata risolta. */
  isSwitching: boolean;
  presentation: IdentityPresentation;
  refresh: () => Promise<void>;
  selectIdentity: (identityId: string) => void;
};

export const DashboardContext = createContext<DashboardContextValue | undefined>(
  undefined,
);

/**
 * Il `key` sull'actor è il meccanismo che garantisce §11: logout e cambio
 * account non devono ripristinare, neppure per un frame, preferenze o dati
 * dell'utente precedente.
 *
 * React smonta e rimonta l'intero sottoalbero quando l'actor cambia, quindi
 * non resta stato locale da azzerare a mano — ed è una garanzia strutturale,
 * non una sequenza di reset che qualcuno può dimenticare di estendere.
 */
export function DashboardIdentityProvider({ children }: PropsWithChildren) {
  const { profile } = useSession();
  const actorId = profile?.id ?? "";

  return (
    <DashboardIdentityProviderInner actorId={actorId} key={actorId}>
      {children}
    </DashboardIdentityProviderInner>
  );
}

function DashboardIdentityProviderInner({
  actorId,
  children,
}: PropsWithChildren<{ actorId: string }>) {
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const [storedId, setStoredId] = useState<string | null>(null);
  // Senza actor non c'è preferenza da leggere: il valore iniziale è già
  // corretto. Il componente è keyed sull'actor, quindi questo stato non
  // sopravvive a un cambio account e non va risincronizzato a mano.
  const [isPreferenceRead, setPreferenceRead] = useState(!actorId);

  const identitiesQuery = useQuery({
    enabled: !!actorId,
    queryFn: fetchDashboardIdentities,
    queryKey: DASHBOARD_QK.identities(actorId),
    // Le capability cambiano raramente ma la revoca deve poter arrivare: lo
    // stesso valore usato da `use-shortlist-permissions`, non il default
    // globale di 30 s pensato per i contenuti.
    staleTime: 5 * 60 * 1000,
  });

  const identities = useMemo(
    () => identitiesQuery.data ?? [],
    [identitiesQuery.data],
  );

  useEffect(() => {
    let isMounted = true;

    if (!actorId) {
      return () => {
        isMounted = false;
      };
    }

    readLastIdentityId(actorId).then((value) => {
      if (isMounted) {
        setStoredId(value);
        setPreferenceRead(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [actorId]);

  const current = useMemo(() => {
    if (identities.length === 0) {
      return null;
    }

    // Una selezione esplicita vale solo finché resta autorizzata: se l'elenco
    // si aggiorna e l'identità non c'è più, si ricade sul fallback senza
    // attendere un'azione dell'utente (§13).
    const selected = selectedId
      ? identities.find((identity) => identity.id === selectedId)
      : undefined;

    if (selected) {
      return selected;
    }

    if (selectedId) {
      return fallbackIdentity(identities);
    }

    return resolveInitialIdentity({ identities, storedId });
  }, [identities, selectedId, storedId]);

  // L'id corrente, leggibile da un callback asincrono senza scrivere il ref
  // durante il render.
  const currentIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentIdRef.current = current?.id ?? null;
  }, [current?.id]);

  // Persistenza: si scrive solo dopo che il backend ha confermato l'identità
  // nell'elenco. Una scelta rifiutata non diventa il prossimo default.
  useEffect(() => {
    if (!actorId || !current || current.id === storedId) {
      return;
    }

    const identityId = current.id;

    writeLastIdentityId(actorId, identityId).then(() => {
      // Se nel frattempo il contesto è cambiato, la scrittura è andata a buon
      // fine ma non deve più guidare la risoluzione di questo render.
      if (currentIdRef.current === identityId) {
        setStoredId(identityId);
      }
    });
  }, [actorId, current, storedId]);

  const selectIdentity = useCallback(
    (identityId: string) => {
      // Selezionare l'identità già attiva non è uno switch: niente nuova
      // generazione, niente richieste, niente scroll azzerato (§9).
      if (identityId === current?.id) {
        return;
      }

      // Un id che non è nell'elenco autorizzato non apre nulla. Vale anche per
      // un deep link: l'autorizzazione non si deduce dall'avere l'id.
      if (!identities.some((identity) => identity.id === identityId)) {
        return;
      }

      setGeneration((value) => value + 1);
      setSelectedId(identityId);
    },
    [current?.id, identities],
  );

  const refresh = useCallback(async () => {
    // Il refresh rivaluta accesso e capability, non solo i contatori: senza
    // questa invalidazione una revoca resterebbe invisibile fino allo
    // scadere dello staleTime.
    await queryClient.invalidateQueries({
      queryKey: DASHBOARD_QK.identities(actorId),
    });
  }, [actorId, queryClient]);

  const value = useMemo<DashboardContextValue>(
    () => ({
      contextToken: `${actorId}:${current?.id ?? "none"}:${generation}`,
      current,
      error: identitiesQuery.error,
      identities,
      isLoading: !isPreferenceRead || identitiesQuery.isPending,
      // Derivato, non in stato: si sta cambiando finché l'identità risolta non
      // coincide con quella selezionata.
      isSwitching: selectedId !== null && current?.id !== selectedId,
      presentation: identityPresentation(identities, current),
      refresh,
      selectIdentity,
    }),
    [
      actorId,
      current,
      generation,
      identities,
      identitiesQuery.error,
      identitiesQuery.isPending,
      isPreferenceRead,
      refresh,
      selectIdentity,
      selectedId,
    ],
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
