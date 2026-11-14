/**
 * Copia locale di una bozza (HOM-06.2 §125–§127).
 *
 * Il server è la persistenza preferita quando c'è rete (§125). La copia locale
 * copre offline, crash, interruzioni e latenza (§126): si scrive a ogni
 * modifica significativa e si sincronizza al ritorno della rete senza creare
 * duplicati (§127) — la chiave di operazione è nella copia, quindi il primo
 * salvataggio server rilanciato dopo un crash restituisce la stessa bozza.
 *
 * Una slot per utente e formato finché la bozza non ha un id server («new»),
 * poi una per ref. Le copie scadono dopo 14 giorni; leggere una copia rotta
 * equivale a non averla.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ContentFormat, ContentRef } from "./publishing-types";

const PREFIX = "@prolink/content-draft/v1";
const TTL_MS = 14 * 86_400_000;

export type LocalDraft<T> = {
  version: 1;
  savedAt: string;
  format: ContentFormat;
  ref: ContentRef | null;
  /** Versione server su cui le modifiche locali si basano (§128): null se mai salvata. */
  baseVersion: number | null;
  operationKey: string;
  /** Stato dell'editor, specifico del formato. */
  snapshot: T;
};

export function localDraftKey(userId: string, format: ContentFormat, ref: ContentRef | null): string {
  return ref ? `${PREFIX}/${userId}/${format}/${ref.contentType}/${ref.contentId}` : `${PREFIX}/${userId}/${format}/new`;
}

export async function readLocalDraft<T>(key: string, now: Date = new Date()): Promise<LocalDraft<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalDraft<T>;
    if (parsed?.version !== 1 || !parsed.savedAt) return null;
    if (now.getTime() - new Date(parsed.savedAt).getTime() > TTL_MS) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeLocalDraft<T>(key: string, draft: LocalDraft<T>): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Spazio pieno o storage non disponibile: resta la persistenza server.
  }
}

export async function removeLocalDraft(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Niente da fare: la copia scadrà da sola.
  }
}

/**
 * La copia locale vince sul server solo se contiene modifiche NON sincronizzate
 * fatte sulla stessa versione che il server ha ancora (§127–§128). Se il
 * server è andato avanti (un altro gestore, §130), la copia locale non
 * sovrascrive: si scarta.
 */
export function shouldRestoreLocal(
  local: Pick<LocalDraft<unknown>, "baseVersion" | "savedAt"> | null,
  server: { version: number; updatedAt: string } | null,
): boolean {
  if (!local) return false;
  if (!server) return true;
  if (local.baseVersion !== server.version) return false;
  return new Date(local.savedAt).getTime() > new Date(server.updatedAt).getTime();
}
