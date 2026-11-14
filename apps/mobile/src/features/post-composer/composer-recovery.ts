/**
 * Recovery tecnico del composer Post (HOM-06.1 §134–142, §205–206).
 *
 * Uno snapshot AsyncStorage per utente, solo in creazione (§144: la Modifica si
 * ricarica dal server). NON è Bozze (§136): nessuna lista, nessun titolo, nessuna
 * gestione; l'utente non lo vede mai come archivio (§142). Serve a non perdere il
 * lavoro dopo background, interruzione, crash o ricreazione dello screen (§135).
 *
 * Segue il template di `features/dashboard/identity/identity-preference.ts`:
 * prefisso versionato, una chiave per utente (logout e cambio account non devono
 * ripristinare il lavoro di qualcun altro), ogni accesso in try/catch che ingoia
 * l'errore — è best-effort, se fallisce il composer parte vuoto.
 *
 * Il salvataggio è debounced DAL CHIAMANTE. Un composer vuoto non si salva e
 * cancella lo snapshot precedente (§137: nulla da recuperare). Lo stato della
 * preview link NON si salva: si rigenera dall'URL (lo snapshot server può
 * essere scaduto); la `operationKey` sì, così un retry dopo un crash resta
 * idempotente (§118). Scade dopo 7 giorni: un lavoro dimenticato non deve
 * ricomparire settimane dopo.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ContentRef } from "../publishing/publishing-types";
import { isEmpty } from "./composer-presentation";
import type { ComposerState } from "./composer-reducer";
import { COMPOSER_ORIGINS, type ComposerRecoverySnapshot } from "./composer-types";

const PREFIX = "@footme/post-composer/v1/";
const SCHEMA_VERSION = 1;
export const RECOVERY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function storageKey(userId: string): string {
  return `${PREFIX}${userId}`;
}

/** HOM-06.2 §121, §127: ref e versione della bozza server nel momento dello snapshot (il valore vivo è di `useAutosave`). */
export type RecoveryDraftRef = { ref: ContentRef; version: number } | null;

/**
 * Pura: lo stato → snapshot, o `null` se non c'è nulla da recuperare o non è creazione.
 *
 * HOM-06.2: resta l'UNICA copia locale del composer Post (§125–§127). Con la
 * bozza server nello snapshot un crash riprende la stessa riga, con le stesse
 * chiavi di operazione. Un programmato non si recupera da qui: si modifica solo
 * con «Salva» esplicito e si riapre dal server (§167).
 */
export function toRecoverySnapshot(
  state: ComposerState,
  now: Date = new Date(),
  draft: RecoveryDraftRef = null,
): ComposerRecoverySnapshot | null {
  if (state.mode.kind !== "create" || isEmpty(state) || state.draft.status === "scheduled") {
    return null;
  }

  return {
    body: state.body,
    dismissedUrls: state.dismissedUrls,
    draftOperationKey: state.draft.operationKey,
    draftRef: draft?.ref ?? null,
    draftVersion: draft?.version ?? null,
    identityId: state.identity?.id ?? null,
    identityType: state.identity?.type ?? null,
    media: state.media,
    mentions: state.mentions,
    operationKey: state.operationKey,
    origin: state.origin,
    publication: state.publication,
    savedAt: now.toISOString(),
    tagged: state.tagged,
    version: SCHEMA_VERSION,
  };
}

/** Pura: ciò che arriva da disco è sconosciuto finché non lo si valida. Una forma sbagliata fa cadere tutto. */
export function parseRecoverySnapshot(raw: unknown, now: Date = new Date()): ComposerRecoverySnapshot | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const value = raw as Partial<ComposerRecoverySnapshot>;
  const savedAt = typeof value.savedAt === "string" ? Date.parse(value.savedAt) : Number.NaN;

  if (
    value.version !== SCHEMA_VERSION ||
    Number.isNaN(savedAt) ||
    now.getTime() - savedAt > RECOVERY_TTL_MS ||
    typeof value.body !== "string" ||
    typeof value.operationKey !== "string" ||
    !COMPOSER_ORIGINS.some((origin) => origin === value.origin) ||
    !Array.isArray(value.mentions) ||
    !Array.isArray(value.tagged) ||
    !Array.isArray(value.media) ||
    !Array.isArray(value.dismissedUrls)
  ) {
    return null;
  }

  const snapshot = value as ComposerRecoverySnapshot;
  const ref = snapshot.draftRef;
  const refIsValid =
    ref === undefined ||
    ref === null ||
    (typeof ref === "object" && typeof ref.contentId === "string" && typeof ref.contentType === "string");

  // HOM-06.2: i campi della bozza sono opzionali; una forma sbagliata fa cadere solo il legame, non il lavoro.
  return refIsValid ? snapshot : { ...snapshot, draftRef: null, draftVersion: null };
}

export async function loadRecovery(userId: string): Promise<ComposerRecoverySnapshot | null> {
  if (!userId) {
    return null;
  }

  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    return raw ? parseRecoverySnapshot(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Debounced dal chiamante. Stato vuoto → rimuove lo snapshot (nulla da recuperare, §137). */
export async function saveRecovery(userId: string, state: ComposerState, draft: RecoveryDraftRef = null): Promise<void> {
  if (!userId) {
    return;
  }

  const snapshot = toRecoverySnapshot(state, new Date(), draft);

  try {
    if (snapshot) {
      await AsyncStorage.setItem(storageKey(userId), JSON.stringify(snapshot));
    } else {
      await AsyncStorage.removeItem(storageKey(userId));
    }
  } catch {
    // Recovery best-effort: perderlo costa il lavoro non salvato, non la sessione.
  }
}

/** §121, §141, §205: dopo la pubblicazione o «Elimina» nella conferma di abbandono. */
export async function clearRecovery(userId: string): Promise<void> {
  if (!userId) {
    return;
  }

  try {
    await AsyncStorage.removeItem(storageKey(userId));
  } catch {
    // idem
  }
}
