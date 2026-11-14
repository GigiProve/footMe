/**
 * L'identità di interazione corrente (HOM-07 §10–§11).
 *
 * Derivata, mai scelta: nessuna UI di selezione. Legge l'ultima identità usata
 * in Dashboard dalla preferenza locale (sola lettura: non la scrive mai) e la
 * confronta con l'elenco autorizzato dal server (`loadInteractionIdentity`).
 *
 * Il risultato viene anche pubblicato nello store dei Mi piace, così le action
 * row decidono «messo/non messo» senza un abbonamento a react-query per ogni
 * cella: ne basta uno per schermata. Il cambio utente svuota lo store.
 */

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { INTERACTION_QK } from "./interaction-keys";
import { loadInteractionIdentity } from "./interaction-service";
import { likeStore } from "./like-store";

/**
 * L'elenco autorizzato cambia di rado. La preferenza Dashboard invece si
 * rilegge a ogni montaggio (`refetchOnMount: "always"`) e subito dopo uno
 * switch in Dashboard, che invalida questa key.
 */
export const INTERACTION_IDENTITY_STALE_MS = 5 * 60 * 1000;

export function interactionIdentityQuery(profileId: string) {
  return {
    queryFn: () => loadInteractionIdentity(profileId),
    queryKey: INTERACTION_QK.identity(profileId),
    staleTime: INTERACTION_IDENTITY_STALE_MS,
  };
}

export function useInteractionIdentity(profileId: string) {
  const query = useQuery({
    ...interactionIdentityQuery(profileId),
    enabled: profileId.length > 0,
    refetchOnMount: "always",
  });
  const identity = query.data ?? null;

  useEffect(() => {
    likeStore.bindOwner(profileId);
  }, [profileId]);

  useEffect(() => {
    if (profileId.length > 0) {
      likeStore.setIdentity(identity);
    }
  }, [identity, profileId]);

  return { identity, isLoading: query.isLoading };
}
