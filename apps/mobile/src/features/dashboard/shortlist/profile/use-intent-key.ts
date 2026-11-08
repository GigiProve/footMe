/**
 * Chiavi idempotenti **per intento** (DAS-REV-26 §25).
 *
 * «Idempotency key scoped all'actor/intento/contesto … Quando l'esito è
 * incerto verifica la stessa operazione prima di generarne una nuova.»
 *
 * `useOperationKey` (DAS-REV-14) lega la chiave al contenuto e non la
 * rinnova mai finché il contenuto non cambia. Dal profilo non basta:
 * aggiungere Mario a P1, rimuoverlo e riaggiungerlo è lo **stesso**
 * contenuto e un'intenzione **nuova** — con la vecchia chiave il server
 * replicherebbe la ricevuta storica e non ricreerebbe la membership (§21:
 * «Una nuova aggiunta esplicita può creare una nuova generazione»).
 *
 * Qui la chiave vive quanto l'esito è incerto: resta la stessa dopo un
 * errore di rete (il retry è la verifica della stessa operazione), e viene
 * dimenticata quando l'esito è noto — successo o rifiuto definitivo.
 */
import { useRef } from "react";

import { newAdminOperationKey } from "../../admins/operation-key";

export function useIntentKeys(scope: string) {
  const keys = useRef(new Map<string, string>());

  return {
    /** La chiave dell'intento, la stessa finché l'esito non è noto. */
    key(intent: string): string {
      const id = `${scope}|${intent}`;
      const existing = keys.current.get(id);

      if (existing) {
        return existing;
      }

      const created = newAdminOperationKey();
      keys.current.set(id, created);

      return created;
    },
    /** Esito noto: il prossimo tentativo è un'intenzione nuova. */
    settle(intent: string) {
      keys.current.delete(`${scope}|${intent}`);
    },
  };
}
