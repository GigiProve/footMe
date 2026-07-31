/**
 * Avviso offline (§24) per inferenza, senza aggiungere dipendenze.
 *
 * `@react-native-community/netinfo` non è installato e introdurlo per un avviso
 * discreto non si giustifica in questo blocco. Si deduce invece dallo stato
 * della query: un errore che ha la forma di un errore di rete, dopo che almeno
 * una richiesta era andata a buon fine, con contenuti in cache da mostrare.
 *
 * COSA SI PERDE (esplicito, così nessuno lo scopre in QA):
 *   • nessun avviso proattivo prima che l'utente agisca: lo si sa solo dopo una
 *     richiesta fallita;
 *   • nessun "sei tornato online" istantaneo: si pulisce al primo successo;
 *   • un 5xx non è distinguibile in modo affidabile da un'assenza di rete,
 *     motivo per cui il testo del §24 resta volutamente morbido.
 * Se servirà un avviso proattivo, netinfo va in un'attività dedicata.
 */

const NETWORK_ERROR_HINTS = [
  "network request failed",
  "failed to fetch",
  "network error",
  "load failed",
  "timeout",
];

export function isLikelyNetworkError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  if (error instanceof TypeError) {
    return true;
  }

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);

  const normalized = message.toLowerCase();
  return NETWORK_ERROR_HINTS.some((hint) => normalized.includes(hint));
}

export function useFeedConnectivity({
  isError,
  error,
  hasCachedItems,
}: {
  isError: boolean;
  error: unknown;
  hasCachedItems: boolean;
}): { isOffline: boolean } {
  return {
    isOffline: isError && hasCachedItems && isLikelyNetworkError(error),
  };
}
