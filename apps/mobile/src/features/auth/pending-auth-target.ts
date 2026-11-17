/**
 * Target originario da riprendere dopo l'accesso (HOM-15 §297).
 *
 * Riusa il meccanismo dei link pendenti degli inviti (`lib/pending-deep-link`,
 * DAS-REV-11 §19 «non scriverne un secondo»): persistito, letto e cancellato
 * una volta sola. La memoria di modulo non basta: l'accesso social apre il
 * browser di sistema e torna con `footme://auth/callback`, e la conferma email
 * riapre l'app dal link — in entrambi i casi il processo può ripartire a
 * freddo. Il target è solo un path interno, rivalidato in lettura
 * (`isSafeInternalTarget`): la destinazione rilegge sessione, visibilità e
 * Block dal server (§293–§296).
 *
 * §297 dice «quando possibile»: il ritorno vale per l'accesso che il deep link
 * ha appena provocato, non per uno qualsiasi. Senza scadenza un link aperto e
 * abbandonato giorni prima riporterebbe lì il primo login successivo, magari
 * di un altro account sullo stesso dispositivo. Il valore porta quindi
 * l'istante del salvataggio e scade dopo `PENDING_AUTH_TARGET_TTL_MS`.
 *
 * Lo scrive `SessionGuard`, lo consuma `usePendingAuthTarget` nel layout delle
 * tab, lo cancella `logout`.
 */
import { createPendingLinkStore, type PendingLinkStore } from "../../lib/pending-deep-link";

/** Abbastanza per login, conferma email o registrazione + onboarding. */
export const PENDING_AUTH_TARGET_TTL_MS = 30 * 60 * 1000;

export function encodePendingAuthTarget(target: string, now: number): string {
  return JSON.stringify({ savedAt: now, target });
}

/** `null` se assente, malformato o scaduto. */
export function decodePendingAuthTarget(raw: string | null, now: number): string | null {
  if (!raw) {
    return null;
  }

  try {
    const value = JSON.parse(raw) as { savedAt?: unknown; target?: unknown };

    if (typeof value.target !== "string" || typeof value.savedAt !== "number") {
      return null;
    }

    const age = now - value.savedAt;

    return age >= 0 && age <= PENDING_AUTH_TARGET_TTL_MS ? value.target : null;
  } catch {
    return null;
  }
}

const rawStore = createPendingLinkStore("@footme/pending-auth-target/v1");

export const pendingAuthTarget: PendingLinkStore = {
  clear: rawStore.clear,
  async consume() {
    return decodePendingAuthTarget(await rawStore.consume(), Date.now());
  },
  store(target: string) {
    return rawStore.store(encodePendingAuthTarget(target, Date.now()));
  },
};
