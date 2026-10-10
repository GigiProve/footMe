/**
 * Token di invito messo da parte prima dell'autenticazione.
 *
 * Il meccanismo nasce con gli inviti procuratore→assistito (REV-PROF-14):
 * un link può arrivare a chi non ha ancora un account, e il redirect su
 * login lo perderebbe per strada. DAS-REV-11 §19 chiede di «riutilizzare il
 * meccanismo di deferred deep link o sessione di invito del progetto», non
 * di scriverne un secondo: la logica è quindi qui, una volta, e i due domini
 * si distinguono solo per la chiave.
 *
 * Il token resta **locale al dispositivo** e viene consumato una volta sola.
 * Non è una prova di identità e non sostituisce la verifica server-side:
 * dopo l'autenticazione il token viene risolto di nuovo dal backend, che
 * rivaluta invito, destinatario e autorizzazioni (§19).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type PendingLinkStore = {
  /** Legge e cancella: un invito già mostrato non si ripropone a ogni avvio. */
  consume: () => Promise<string | null>;
  clear: () => Promise<void>;
  store: (token: string) => Promise<void>;
};

export function createPendingLinkStore(storageKey: string): PendingLinkStore {
  return {
    async clear() {
      try {
        await AsyncStorage.removeItem(storageKey);
      } catch {
        // Un invito non ripreso è un fastidio; un crash all'avvio no.
      }
    },
    async consume() {
      try {
        const token = await AsyncStorage.getItem(storageKey);

        if (token) {
          await AsyncStorage.removeItem(storageKey);
        }

        return token;
      } catch {
        return null;
      }
    },
    async store(token: string) {
      try {
        await AsyncStorage.setItem(storageKey, token);
      } catch {
        // vedi sopra
      }
    },
  };
}
