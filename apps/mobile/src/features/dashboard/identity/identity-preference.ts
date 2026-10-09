/**
 * Ultima Dashboard Identity usata, per utente.
 *
 * Segue il template di `features/feed/feed-cache.ts` e
 * `features/search/recent-searches.ts`: prefisso versionato, una chiave per
 * profilo, ogni accesso avvolto in try/catch che ingoia l'errore. La
 * preferenza è best-effort — se AsyncStorage fallisce la Dashboard apre il
 * default, non si rompe.
 *
 * Una chiave **per utente** è il requisito §11: logout e cambio account non
 * devono ripristinare, neppure per un frame, la preferenza di qualcun altro.
 *
 * Questa preferenza è specifica della Dashboard. Non è, e non deve diventare,
 * un "current society" globale: §22 vieta esplicitamente che l'accesso della
 * stessa persona a due Società su due device dipenda da uno stato condiviso
 * mutabile. Qui vive sul dispositivo, e ogni sessione mantiene il proprio
 * contesto attivo.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "@footme/dashboard-identity/v1/";

function storageKey(actorId: string): string {
  return `${PREFIX}${actorId}`;
}

export async function readLastIdentityId(
  actorId: string,
): Promise<string | null> {
  if (!actorId) {
    return null;
  }

  try {
    const raw = await AsyncStorage.getItem(storageKey(actorId));
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Salva la scelta solo quando l'ingresso nel nuovo contesto è stato
 * autorizzato. Il chiamante invoca questa funzione dopo la rivalidazione, mai
 * al tap: una selezione rifiutata non deve diventare il prossimo default.
 */
export async function writeLastIdentityId(
  actorId: string,
  identityId: string,
): Promise<void> {
  if (!actorId || !identityId) {
    return;
  }

  try {
    await AsyncStorage.setItem(storageKey(actorId), identityId);
  } catch {
    // Preferenza best-effort: perderla costa un default, non una sessione.
  }
}

export async function clearLastIdentityId(actorId: string): Promise<void> {
  if (!actorId) {
    return;
  }

  try {
    await AsyncStorage.removeItem(storageKey(actorId));
  } catch {
    // idem
  }
}
