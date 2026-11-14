/**
 * Autosave persistente condiviso da composer Post ed editor Articolo
 * (HOM-06.2 §116–§132).
 *
 *  • §117, §121–§122: al primo contenuto significativo nasce UN draft_id
 *    stabile (chiave di operazione per sessione di editor: un retry o un crash
 *    restituiscono la stessa bozza); ogni salvataggio successivo aggiorna la
 *    stessa riga con la versione attesa (§128–§129).
 *  • §118: niente bozze server vuote: finché `significant` è falso non si salva.
 *  • §119–§120: stato discreto («Salvataggio…» → «Bozza salvata»), mai toast.
 *  • §125–§127: copia locale a ogni modifica; offline la bozza resta sul
 *    dispositivo e si sincronizza al primo salvataggio riuscito.
 *  • §128, §130: conflitto di versione → stop, nessuna sovrascrittura
 *    silenziosa; l'utente ricarica.
 *
 * Il payload arriva già nella forma wire; la sua serializzazione è la
 * dipendenza dell'effetto (un oggetto nuovo a ogni render non riavvia il timer
 * se il contenuto non cambia).
 */

import { useEffect, useRef, useState } from "react";

import { localDraftKey, removeLocalDraft, writeLocalDraft } from "./draft-local-store";
import { trackPublishing } from "./publishing-analytics";
import { PublishingRequestError, saveContentDraft, type SavedDraft } from "./publishing-service";
import type { AutosaveStatus, ContentFormat, ContentRef } from "./publishing-types";

export type AutosaveOptions<T> = {
  userId: string | null;
  format: ContentFormat;
  /** false per programmati e pubblicati: si salvano solo con «Salva» (§167, §224–§227). */
  enabled: boolean;
  significant: boolean;
  identity: { type: string; id: string } | null;
  payload: Record<string, unknown>;
  /** Stato dell'editor per la copia locale (specifico del formato). */
  snapshot: T;
  initialRef: ContentRef | null;
  initialVersion: number | null;
  operationKey: string;
  debounceMs?: number;
  /**
   * false quando il formato ha già una sua copia locale (il composer Post usa
   * `composer-recovery` di HOM-06.1): una sola copia locale per editor.
   */
  persistLocal?: boolean;
  /**
   * true durante un invio (Pubblica/Programma): i salvataggi a timer non partono,
   * così una bozza non nasce DOPO che l'invio ha già creato il contenuto. `flush()`
   * resta valido: è lui che l'invio chiama per primo (§121).
   */
  paused?: boolean;
  /**
   * Dopo ogni salvataggio riuscito, con il payload inviato. Serve all'Articolo:
   * `rights_confirmed` della risposta è autoritativo (§7Q) — il server toglie la
   * conferma quando fonte, autore, link originale o identity cambiano.
   */
  onSaved?: (saved: SavedDraft, sentPayload: Record<string, unknown>) => void;
  /**
   * Con `initialRef`: il contenuto aperto coincide con quello del server, quindi
   * non c'è niente da salvare finché l'utente non modifica (riaprire una bozza non
   * la fa diventare «Modificato ora»). false quando l'editor ha ripristinato una
   * copia locale non sincronizzata (§127): allora il primo salvataggio serve.
   */
  initialSynced?: boolean;
};

export type AutosaveHandle = {
  status: AutosaveStatus;
  ref: ContentRef | null;
  version: number | null;
  /** Salva subito ciò che è in attesa (uscita «Esci e conserva bozza» §135, prima di Anteprima/Pubblica). */
  flush: () => Promise<{ ref: ContentRef; version: number } | null>;
  /** Dopo una submit riuscita o una cancellazione: niente più salvataggi, copia locale rimossa. */
  stop: () => Promise<void>;
  /** Dopo un'operazione esterna che ha cambiato la versione (es. submit `keep`). */
  adopt: (ref: ContentRef, version: number) => void;
};

const DEFAULT_DEBOUNCE_MS = 1500;
const RETRY_MS = 15_000;

export function useAutosave<T>(options: AutosaveOptions<T>): AutosaveHandle {
  const { userId, format, enabled, significant, identity, payload, snapshot, initialRef, initialVersion, operationKey } = options;
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const persistLocal = options.persistLocal ?? true;
  const paused = options.paused ?? false;

  const [status, setStatus] = useState<AutosaveStatus>(initialRef ? { at: "", status: "saved" } : { status: "idle" });
  const [ref, setRef] = useState<ContentRef | null>(initialRef);
  const [version, setVersion] = useState<number | null>(initialVersion);

  const refRef = useRef<ContentRef | null>(initialRef);
  const versionRef = useRef<number | null>(initialVersion);
  const onSaved = options.onSaved;
  const latest = useRef({ format, identity, onSaved, operationKey, paused, payload, significant, snapshot, userId });
  latest.current = { format, identity, onSaved, operationKey, paused, payload, significant, snapshot, userId };

  const inFlight = useRef<Promise<{ ref: ContentRef; version: number } | null> | null>(null);
  const dirty = useRef(false);
  const stopped = useRef(false);
  const conflicted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedPayloadKey = useRef<string | null>(null);

  const payloadKey = JSON.stringify({ identity, payload });

  const localKey = (target: ContentRef | null) =>
    persistLocal && latest.current.userId ? localDraftKey(latest.current.userId, latest.current.format, target) : null;

  async function writeLocal() {
    const key = localKey(refRef.current);
    if (!key) return;
    await writeLocalDraft(key, {
      baseVersion: versionRef.current,
      format: latest.current.format,
      operationKey: latest.current.operationKey,
      ref: refRef.current,
      savedAt: new Date().toISOString(),
      snapshot: latest.current.snapshot,
      version: 1,
    });
  }

  async function saveNow(): Promise<{ ref: ContentRef; version: number } | null> {
    if (stopped.current || conflicted.current) return null;
    const current = latest.current;
    if (!current.significant || !current.identity) return null;

    if (inFlight.current) {
      // Un salvataggio alla volta: quello in corso finisce, poi si risalva se serve.
      dirty.current = true;
      return inFlight.current.then(() => (dirty.current ? saveNow() : refRef.current && versionRef.current !== null ? { ref: refRef.current, version: versionRef.current } : null));
    }

    const key = JSON.stringify({ identity: current.identity, payload: current.payload });
    if (key === savedPayloadKey.current && refRef.current && versionRef.current !== null) {
      return { ref: refRef.current, version: versionRef.current };
    }

    dirty.current = false;
    const created = refRef.current === null;
    setStatus({ status: "saving" });
    trackPublishing({ format: current.format, name: "autosave_started" });

    const run = (async () => {
      try {
        const saved = await saveContentDraft({
          expectedVersion: versionRef.current,
          format: current.format,
          identityId: current.identity!.id,
          identityType: current.identity!.type,
          operationKey: current.operationKey,
          payload: current.payload,
          ref: refRef.current,
        });
        const previousKey = localKey(refRef.current);
        refRef.current = saved.ref;
        versionRef.current = saved.version;
        savedPayloadKey.current = key;
        setRef(saved.ref);
        setVersion(saved.version);
        setStatus({ at: saved.updatedAt, status: "saved" });
        trackPublishing({ created, format: current.format, name: "autosave_success" });
        latest.current.onSaved?.(saved, current.payload);
        // La copia «new» diventa la copia della bozza (§127).
        const nextKey = localKey(saved.ref);
        if (previousKey && previousKey !== nextKey) await removeLocalDraft(previousKey);
        if (nextKey) await removeLocalDraft(nextKey);
        return { ref: saved.ref, version: saved.version };
      } catch (error) {
        const parsed = error instanceof PublishingRequestError ? error.parsed : null;
        const kind = parsed?.kind ?? "unknown";
        trackPublishing({ code: kind, format: current.format, name: "autosave_failed" });
        if (kind === "content_version_conflict") {
          conflicted.current = true;
          setStatus({ status: "conflict" });
        } else if (kind === "network") {
          setStatus({ status: "offline" });
          scheduleRetry();
        } else {
          setStatus({ code: kind, status: "error" });
          if (kind === "unknown") scheduleRetry();
        }
        return null;
      } finally {
        inFlight.current = null;
      }
    })();

    inFlight.current = run;
    const result = await run;
    if (dirty.current && !stopped.current && !conflicted.current) {
      return saveNow();
    }
    return result;
  }

  function scheduleRetry() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (!latest.current.paused) void saveNow();
    }, RETRY_MS);
  }

  // La bozza può arrivare dopo il mount (caricamento asincrono dell'editor): si adotta una
  // volta per ref, prima dell'effetto di salvataggio (stesso commit, ordine di dichiarazione).
  const initialSynced = options.initialSynced ?? true;
  const initialKey = initialRef ? `${initialRef.contentType}:${initialRef.contentId}` : null;
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!initialRef || !initialKey || seededFor.current === initialKey) return;
    seededFor.current = initialKey;
    if (refRef.current && refRef.current.contentId !== initialRef.contentId) return;
    refRef.current = initialRef;
    versionRef.current = initialVersion;
    setRef(initialRef);
    setVersion(initialVersion);
    if (initialSynced) savedPayloadKey.current = payloadKey;
    // Solo l'identità della bozza iniziale conta: il payload di quel momento è «già salvato».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  useEffect(() => {
    if (!enabled || paused || stopped.current || conflicted.current || !significant || !identity) {
      return;
    }
    if (savedPayloadKey.current === payloadKey) {
      return;
    }
    void writeLocal();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (!latest.current.paused) void saveNow();
    }, debounceMs);
    // saveNow/writeLocal leggono `latest`: la sola chiave del contenuto (e la pausa) decide quando ripartire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey, enabled, significant, debounceMs, paused]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return {
    adopt: (nextRef, nextVersion) => {
      refRef.current = nextRef;
      versionRef.current = nextVersion;
      savedPayloadKey.current = JSON.stringify({ identity: latest.current.identity, payload: latest.current.payload });
      setRef(nextRef);
      setVersion(nextVersion);
    },
    flush: async () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (!enabled) {
        return refRef.current && versionRef.current !== null ? { ref: refRef.current, version: versionRef.current } : null;
      }
      return saveNow();
    },
    ref,
    status,
    stop: async () => {
      stopped.current = true;
      if (timer.current) clearTimeout(timer.current);
      const keys = [localKey(null), localKey(refRef.current)].filter((key): key is string => Boolean(key));
      await Promise.all(keys.map((key) => removeLocalDraft(key)));
    },
    version,
  };
}

/** Testo discreto dello stato (§119): «Salvataggio…», «Bozza salvata», offline, conflitto. */
export function autosaveLabel(status: AutosaveStatus): string | null {
  switch (status.status) {
    case "saving":
      return "Salvataggio…";
    case "saved":
      return "Bozza salvata";
    case "offline":
      return "Bozza salvata sul dispositivo";
    case "conflict":
      return "Modificata altrove";
    case "error":
      return "Salvataggio non riuscito";
    default:
      return null;
  }
}
