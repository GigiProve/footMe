/**
 * Selezione e upload dei media del Post (HOM-06.1 §39–41, §61–63, §67–72, §178,
 * §202–204).
 *
 *  • Un'UNICA azione apre il picker nativo con immagini e video insieme (§39–41);
 *    `selectionLimit` = slot rimasti, `quality` 0.8 come compressione delle
 *    immagini (§63). Nessuna dipendenza nativa nuova: `expo-image-picker` c'è già.
 *  • Il filtro (limite §62, durata massima dei video) è `selectPickedAssets` in
 *    composer-presentation.ts, puro e testato; qui si chiama e si mappa.
 *  • L'upload va nel bucket `profile-media` a `<uid>/posts/<nome>-<suffisso>`,
 *    con gli helper di `features/profiles/media-upload-service.ts`.
 *  • La coda (`createUploadQueue`) limita a 2 gli upload paralleli (§204); il
 *    retry è per item (§72) e non rilancia i caricamenti già riusciti.
 *
 * Il progresso resta `null`: `supabase.storage.upload` non lo espone e non si
 * aggiunge una dipendenza nativa per misurarlo (§63 «quando utile»).
 * Le thumbnail dei video non si generano qui (§203 richiede una libreria nativa
 * che non c'è): `thumbnailUri` è `null` per i video e il componente mostra il
 * segnaposto con Play e durata.
 */

import * as ImagePicker from "expo-image-picker";

import { supabase } from "../../lib/supabase";
import {
  PROFILE_MEDIA_BUCKET,
  ProfileMediaUploadError,
  createUploadSuffix,
  normalizeFileName,
} from "../profiles/media-upload-service";
import { selectPickedAssets } from "./composer-presentation";
import type { ComposerLimits, ComposerMediaItem } from "./composer-types";
import { newComposerLocalId } from "./operation-key";

/* ------------------------------------------------------------------ */
/* Picker                                                              */
/* ------------------------------------------------------------------ */

export type ComposerPickOutcome = {
  items: ComposerMediaItem[];
  /** L'utente ha chiuso il picker senza scegliere. */
  canceled: boolean;
  /** §62: mostrare «Hai raggiunto il numero massimo di contenuti per questo post.» */
  limitReached: boolean;
  /** Video scartati perché oltre `maxVideoSeconds`. */
  rejectedVideos: number;
  permissionDenied: boolean;
};

const EMPTY_OUTCOME: ComposerPickOutcome = {
  canceled: false,
  items: [],
  limitReached: false,
  permissionDenied: false,
  rejectedVideos: 0,
};

// Il picker non riporta sempre il mimeType; senza, supabase-js carica come
// text/plain e il bucket lo rifiuta (stesso motivo di chat-media-service.ts).
const EXTENSION_MIME_TYPES: Record<string, string> = {
  heic: "image/heic",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  mov: "video/quicktime",
  mp4: "video/mp4",
  png: "image/png",
  webp: "image/webp",
};

function inferMimeType(type: "image" | "video", fileName: string | null | undefined, uri: string): string {
  const extension = (fileName || uri).split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MIME_TYPES[extension] ?? (type === "video" ? "video/mp4" : "image/jpeg");
}

/** Pura: un asset del picker come item della collection `media[]` (§43). `duration` è in ms. */
export function mediaItemFromAsset(asset: ImagePicker.ImagePickerAsset, localId: string): ComposerMediaItem {
  const type = asset.type === "video" ? "video" : "image";

  return {
    altText: null,
    durationSeconds: type === "video" && asset.duration ? Math.round(asset.duration / 1000) : null,
    errorCode: null,
    height: asset.height || null,
    localId,
    localUri: asset.uri,
    mimeType: asset.mimeType ?? inferMimeType(type, asset.fileName, asset.uri),
    remoteMediaPosition: null,
    remoteUrl: null,
    storagePath: null,
    thumbnailUri: type === "image" ? asset.uri : null,
    type,
    uploadProgress: null,
    uploadStatus: "pending",
    width: asset.width || null,
  };
}

/**
 * §39–41: foto e video nella stessa selezione. Ritorna gli item già pronti per
 * `mediaAdded`, più i flag per la copy del limite e dei video troppo lunghi.
 */
export async function pickComposerMedia(input: {
  remainingSlots: number;
  limits: Pick<ComposerLimits, "maxVideoSeconds">;
}): Promise<ComposerPickOutcome> {
  if (input.remainingSlots <= 0) {
    return { ...EMPTY_OUTCOME, limitReached: true };
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    return { ...EMPTY_OUTCOME, permissionDenied: true };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: true,
    mediaTypes: ["images", "videos"],
    orderedSelection: true,
    quality: 0.8,
    selectionLimit: input.remainingSlots,
  });

  if (result.canceled) {
    return { ...EMPTY_OUTCOME, canceled: true };
  }

  const selection = selectPickedAssets(result.assets, {
    maxVideoSeconds: input.limits.maxVideoSeconds,
    remainingSlots: input.remainingSlots,
  });

  return {
    ...EMPTY_OUTCOME,
    items: selection.accepted.map((asset) => mediaItemFromAsset(asset, newComposerLocalId())),
    limitReached: selection.limitReached,
    rejectedVideos: selection.rejectedVideos,
  };
}

/* ------------------------------------------------------------------ */
/* Upload                                                              */
/* ------------------------------------------------------------------ */

export type ComposerUploadResult = { storagePath: string; remoteUrl: string };

/** `<uid>/posts/<nome>-<suffisso>` (§63): il prefisso `<uid>` è ciò che la policy del bucket controlla. */
export function composerStoragePath(userId: string, item: ComposerMediaItem, suffix: string): string {
  const name = normalizeFileName(item.localUri?.split("/").pop(), `${item.type}-${suffix}`);
  return `${userId}/posts/${name}-${suffix}`;
}

/** Carica UN item; lancia `ProfileMediaUploadError` con il codice (lettura, permessi, upload). */
export async function uploadComposerMedia(userId: string, item: ComposerMediaItem): Promise<ComposerUploadResult> {
  if (!item.localUri) {
    throw new ProfileMediaUploadError("file_read_failed", "Il file selezionato non è più disponibile.");
  }

  let body: ArrayBuffer;

  try {
    const response = await fetch(item.localUri);
    body = await response.arrayBuffer();
  } catch (error) {
    throw new ProfileMediaUploadError("file_read_failed", "Impossibile leggere il file selezionato.", {
      cause: error,
    });
  }

  const path = composerStoragePath(userId, item, createUploadSuffix());
  const { error } = await supabase.storage.from(PROFILE_MEDIA_BUCKET).upload(path, body, {
    contentType: item.mimeType ?? undefined,
    upsert: false,
  });

  if (error) {
    throw new ProfileMediaUploadError("upload_failed", error.message, { cause: error });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PROFILE_MEDIA_BUCKET).getPublicUrl(path);

  return { remoteUrl: publicUrl, storagePath: path };
}

/* ------------------------------------------------------------------ */
/* Coda                                                                */
/* ------------------------------------------------------------------ */

export const UPLOAD_CONCURRENCY = 2; // §204

export type UploadQueue = {
  /** Accoda un compito; un id già in coda o in corso non si duplica. */
  enqueue: (id: string, task: () => Promise<void>) => void;
  /** Toglie dalla coda un compito non ancora partito (media rimosso, §59). */
  cancel: (id: string) => void;
  has: (id: string) => boolean;
  /** Si risolve quando non c'è nulla in coda né in corso (§68: Pubblica durante upload). */
  whenIdle: () => Promise<void>;
};

/**
 * Coda con concorrenza limitata. Un compito che lancia non ferma gli altri: lo
 * stato dell'errore lo scrive il compito stesso (vedi `createMediaUploader`).
 */
export function createUploadQueue(concurrency: number = UPLOAD_CONCURRENCY): UploadQueue {
  const waiting: { id: string; task: () => Promise<void> }[] = [];
  const running = new Set<string>();
  let idleWaiters: (() => void)[] = [];

  function settleIfIdle() {
    if (waiting.length === 0 && running.size === 0) {
      const waiters = idleWaiters;
      idleWaiters = [];
      waiters.forEach((resolve) => resolve());
    }
  }

  function pump() {
    while (running.size < concurrency && waiting.length > 0) {
      const next = waiting.shift();

      if (!next) {
        break;
      }

      running.add(next.id);
      next
        .task()
        .catch(() => undefined)
        .finally(() => {
          running.delete(next.id);
          pump();
          settleIfIdle();
        });
    }
  }

  return {
    cancel(id) {
      const index = waiting.findIndex((job) => job.id === id);

      if (index >= 0) {
        waiting.splice(index, 1);
        settleIfIdle();
      }
    },
    enqueue(id, task) {
      if (running.has(id) || waiting.some((job) => job.id === id)) {
        return;
      }

      waiting.push({ id, task });
      pump();
    },
    has: (id) => running.has(id) || waiting.some((job) => job.id === id),
    whenIdle() {
      return waiting.length === 0 && running.size === 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => idleWaiters.push(resolve));
    },
  };
}

export type MediaUploadPatch = Partial<
  Pick<ComposerMediaItem, "uploadStatus" | "uploadProgress" | "storagePath" | "remoteUrl" | "errorCode">
>;

/**
 * Il collegamento coda + upload + stato. `onChange` riceve le patch da girare al
 * reducer (`mediaUploadUpdated`). Un fallimento resta sull'item (§70–71): gli
 * altri e il resto del Post non si toccano; `retry` riaccoda solo quello (§72,
 * §178: senza reinserirlo). Un item rimosso a metà upload non scrive più nulla
 * (`isActive`).
 */
export function createMediaUploader(input: {
  userId: string;
  onChange: (localId: string, patch: MediaUploadPatch) => void;
  /** `false` se l'item è stato rimosso: il risultato dell'upload si butta. */
  isActive: (localId: string) => boolean;
  queue?: UploadQueue;
  upload?: typeof uploadComposerMedia;
}) {
  const queue = input.queue ?? createUploadQueue();
  const upload = input.upload ?? uploadComposerMedia;

  function enqueue(item: ComposerMediaItem) {
    queue.enqueue(item.localId, async () => {
      if (!input.isActive(item.localId)) {
        return;
      }

      input.onChange(item.localId, { errorCode: null, uploadProgress: null, uploadStatus: "uploading" });

      try {
        const result = await upload(input.userId, item);

        if (input.isActive(item.localId)) {
          input.onChange(item.localId, {
            remoteUrl: result.remoteUrl,
            storagePath: result.storagePath,
            uploadProgress: 1,
            uploadStatus: "uploaded",
          });
        }
      } catch (error) {
        if (input.isActive(item.localId)) {
          input.onChange(item.localId, {
            errorCode: error instanceof ProfileMediaUploadError ? error.code : "upload_failed",
            uploadProgress: null,
            uploadStatus: "failed",
          });
        }
      }
    });
  }

  return {
    cancel: (localId: string) => queue.cancel(localId),
    enqueue,
    /** §72: stesso item, stessa coda; il reducer lo ha già riportato a `pending`. */
    retry: enqueue,
    whenIdle: () => queue.whenIdle(),
  };
}
