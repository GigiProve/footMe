/**
 * Assistiti in evidenza (REV-PROF-16, schermata 7).
 *
 * Due cose vivono qui, e nient'altro: come si legge l'elenco eleggibile e
 * come si scrive la selezione. Il rapporto con l'assistito — crearlo,
 * invitarlo, approvarlo, renderlo pubblico, concluderlo — appartiene alla
 * Gestione assistiti (REV-PROF-14) e da questo modulo non è raggiungibile
 * nemmeno per sbaglio: la RPC di scrittura tocca solo la posizione.
 *
 * **L'eleggibilità non si calcola nel client.** `fetch_agent_public_assistiti`
 * restituisce già i soli rapporti accettati e pubblici: richieste pendenti,
 * rifiutate, revocate, concluse, rapporti privati e inserimenti manuali non
 * attraversano nemmeno la rete. Filtrare di nuovo qui darebbe l'impressione
 * che la regola stia nel client, e un domani le due copie divergerebbero.
 *
 * Le funzioni pure di selezione e riordino stanno fuori dai componenti perché
 * sono le regole che contano: limite di tre, nessuna sostituzione automatica,
 * ordine esplicito.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  fetchAgentPublicAssistiti,
  setAgentFeaturedAssistiti,
  type AgentPublicAssistito,
} from "../../relationships/agent-representation-service";
import { completeProfileQueryKey } from "../edit/player-profile-edit-service";

/** REV-PROF-16: "Scegli fino a 3 assistiti pubblici da mostrare nel profilo." */
export const AGENT_FEATURED_LIMIT = 3;

export const AGENT_FEATURED_LIMIT_MESSAGE =
  "Puoi mettere in evidenza fino a 3 assistiti.";

export function agentPublicAssistitiQueryKey(profileId: string | null) {
  return ["agent-public-assistiti", profileId] as const;
}

/**
 * Elenco degli assistiti eleggibili, condiviso fra l'hub (che ne mostra il
 * conteggio) e la schermata di selezione: una lettura sola, così il numero
 * nella riga e l'elenco dentro al modulo non possono divergere.
 */
export function useAgentPublicAssistitiQuery(
  profileId: string | null,
): UseQueryResult<AgentPublicAssistito[], Error> {
  return useQuery({
    enabled: Boolean(profileId),
    queryFn: () => fetchAgentPublicAssistiti(profileId as string),
    queryKey: agentPublicAssistitiQueryKey(profileId),
  });
}

/**
 * La selezione iniziale: gli assistiti già in evidenza, nel loro ordine.
 *
 * Un profilo che non ha mai scelto parte vuoto, non con i primi tre
 * preselezionati: il Master Profile ne mostra tre comunque, ma quella è una
 * conseguenza dell'assenza di scelta, non una scelta da confermare.
 */
export function readFeaturedSelection(
  assistiti: readonly AgentPublicAssistito[],
): string[] {
  return assistiti
    .filter((item) => item.featured_rank != null)
    .slice()
    .sort((a, b) => (a.featured_rank ?? 0) - (b.featured_rank ?? 0))
    .map((item) => item.id);
}

/**
 * Aggiunge o toglie un assistito dalla selezione.
 *
 * Al quarto tentativo la selezione resta **identica**: non si toglie
 * automaticamente il primo per far posto, perché sarebbe una scelta presa al
 * posto dell'utente. Il chiamante mostra il messaggio e non cambia niente.
 */
export function toggleFeaturedSelection(
  selection: readonly string[],
  relationshipId: string,
): { atLimit: boolean; selection: string[] } {
  if (selection.includes(relationshipId)) {
    return {
      atLimit: false,
      selection: selection.filter((id) => id !== relationshipId),
    };
  }

  if (selection.length >= AGENT_FEATURED_LIMIT) {
    return { atLimit: true, selection: [...selection] };
  }

  return { atLimit: false, selection: [...selection, relationshipId] };
}

/**
 * Sposta un assistito di una posizione.
 *
 * È l'alternativa accessibile al trascinamento, non un ripiego: "Sposta su" e
 * "Sposta giù" producono esattamente lo stesso risultato, e un movimento
 * fuori dai bordi non è un errore — semplicemente non succede niente.
 */
export function moveFeaturedSelection(
  selection: readonly string[],
  relationshipId: string,
  direction: "down" | "up",
): string[] {
  const index = selection.indexOf(relationshipId);
  const target = direction === "up" ? index - 1 : index + 1;

  if (index < 0 || target < 0 || target >= selection.length) {
    return [...selection];
  }

  const next = [...selection];
  [next[index], next[target]] = [next[target], next[index]];

  return next;
}

/**
 * Toglie dalla selezione gli id che non sono più eleggibili.
 *
 * Serve quando l'elenco viene riletto dopo che qualcosa è cambiato altrove —
 * un assistito reso privato, un rapporto concluso. L'ordine dei rimanenti
 * resta quello scelto e nessuno prende il posto liberato: il profilo mostrerà
 * due assistiti invece di tre, che è la verità.
 */
export function pruneFeaturedSelection(
  selection: readonly string[],
  assistiti: readonly AgentPublicAssistito[],
): string[] {
  const eligible = new Set(assistiti.map((item) => item.id));

  return selection.filter((id) => eligible.has(id));
}

export type SaveFeaturedAssistitiVariables = {
  profileId: string;
  relationshipIds: readonly string[];
};

/**
 * Persiste la selezione e rilegge l'elenco, così l'hub mostra subito il nuovo
 * conteggio. Il profilo completo viene invalidato perché il Master Profile
 * legge gli assistiti dalla stessa proiezione pubblica.
 */
export function useSaveFeaturedAssistiti(): UseMutationResult<
  void,
  Error,
  SaveFeaturedAssistitiVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profileId, relationshipIds }) =>
      setAgentFeaturedAssistiti(profileId, relationshipIds),
    onSuccess: (_result, { profileId }) => {
      void queryClient.invalidateQueries({
        queryKey: agentPublicAssistitiQueryKey(profileId),
      });
      /*
        Il Master Profile legge gli assistiti dalla stessa proiezione, ma il
        suo conteggio arriva dal profilo completo: invalidare solo l'elenco
        lascerebbe l'hub aggiornato e l'header indietro.
      */
      void queryClient.invalidateQueries({
        queryKey: completeProfileQueryKey(profileId),
      });
    },
  });
}
