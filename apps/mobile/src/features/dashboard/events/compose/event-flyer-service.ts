/**
 * Locandina facoltativa: scelta, caricamento e registrazione (DAS-REV-29 §8).
 *
 * «Riusa picker/upload, autorizzazioni dispositivo e storage del progetto.»
 * Picker e permessi sono quelli di `expo-image-picker` già usati dai media
 * profilo; lo Storage è Supabase. Cambia il bucket — privato, perché una
 * locandina di bozza non deve avere un URL pubblico permanente — e cambia il
 * passo finale: il file caricato non diventa un URL scritto dal client ma un
 * asset registrato dal server, che legge MIME e peso dall'oggetto reale e lo
 * lega alla Società (QA-018).
 *
 *   · nessun ritaglio (`allowsEditing: false`): §8 vieta il crop che taglia il
 *     testo della locandina;
 *   · i limiti sono quelli del server (`selection_event_limits`): il client li
 *     controlla prima solo per dirlo subito, mai con valori propri;
 *   · annullare il picker non è un errore; un permesso negato sì, con un
 *     messaggio che non fa perdere l'evento (QA-016).
 */
import * as ImagePicker from "expo-image-picker";

import { supabase } from "../../../../lib/supabase";
import { FLYER_BUCKET } from "../detail/event-detail-service";
import { selectionEventsRpc } from "../events-service";
import type { EventFlyerRef, EventLimits } from "../events-types";

export type FlyerErrorCode =
  | "permission_denied"
  | "flyer_format"
  | "flyer_too_large"
  | "upload_failed";

export class FlyerUploadError extends Error {
  code: FlyerErrorCode;

  constructor(code: FlyerErrorCode) {
    super(code);
    this.code = code;
    this.name = "FlyerUploadError";
  }
}

export type PickedFlyer = {
  height: number | null;
  mimeType: string;
  size: number | null;
  uri: string;
  width: number | null;
};

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** UUID v4: l'ID dell'asset è anche il nome del file (`<club>/<id>.<ext>`). */
export function createAssetId(): string {
  const bytes = new Uint8Array(16);
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;

  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Il MIME dichiarato dal picker, o dedotto dall'estensione del file. */
export function flyerMimeOf(asset: { fileName?: string | null; mimeType?: string | null; uri: string }): string | null {
  const declared = asset.mimeType?.toLowerCase() ?? null;

  if (declared) {
    return declared === "image/jpg" ? "image/jpeg" : declared;
  }

  const name = (asset.fileName ?? asset.uri).toLowerCase();

  if (/\.jpe?g$/.test(name)) return "image/jpeg";
  if (/\.png$/.test(name)) return "image/png";
  if (/\.webp$/.test(name)) return "image/webp";

  return null;
}

/** Controllo anticipato con i **limiti del server** (§8). */
export function flyerPrecheck(
  picked: Pick<PickedFlyer, "mimeType" | "size">,
  limits: Pick<EventLimits, "flyerMaxBytes" | "flyerMimeTypes">,
): FlyerErrorCode | null {
  if (!limits.flyerMimeTypes.includes(picked.mimeType)) {
    return "flyer_format";
  }

  if (picked.size !== null && picked.size > limits.flyerMaxBytes) {
    return "flyer_too_large";
  }

  return null;
}

/** `null` = picker annullato: nessun errore, nessun cambiamento (QA-016). */
export async function pickFlyerImage(): Promise<PickedFlyer | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new FlyerUploadError("permission_denied");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    allowsMultipleSelection: false,
    mediaTypes: ["images"],
    quality: 0.85,
  });

  const asset = result.canceled ? null : result.assets[0];

  if (!asset) {
    return null;
  }

  const mimeType = flyerMimeOf(asset);

  if (!mimeType) {
    throw new FlyerUploadError("flyer_format");
  }

  return {
    height: asset.height || null,
    mimeType,
    size: asset.fileSize ?? null,
    uri: asset.uri,
    width: asset.width || null,
  };
}

/**
 * Carica il file e lo registra. Fino a qui l'evento non è stato toccato: il
 * nuovo riferimento entra solo con il salvataggio del form (§8: «Durante
 * upload conserva la versione salvata»).
 */
export async function uploadFlyer(input: {
  clubId: string;
  limits: Pick<EventLimits, "flyerMaxBytes" | "flyerMimeTypes">;
  picked: PickedFlyer;
}): Promise<EventFlyerRef> {
  const precheck = flyerPrecheck(input.picked, input.limits);

  if (precheck) {
    throw new FlyerUploadError(precheck);
  }

  const assetId = createAssetId();
  const path = `${input.clubId}/${assetId}.${EXTENSIONS[input.picked.mimeType] ?? "jpg"}`;
  let body: ArrayBuffer;

  try {
    body = await (await fetch(input.picked.uri)).arrayBuffer();
  } catch {
    throw new FlyerUploadError("upload_failed");
  }

  if (body.byteLength > input.limits.flyerMaxBytes) {
    throw new FlyerUploadError("flyer_too_large");
  }

  const { error } = await supabase.storage.from(FLYER_BUCKET).upload(path, body, {
    contentType: input.picked.mimeType,
    upsert: false,
  });

  if (error) {
    throw new FlyerUploadError(/size|large/i.test(error.message) ? "flyer_too_large" : "upload_failed");
  }

  const registered = await selectionEventsRpc<Record<string, unknown>>("register_selection_event_flyer", {
    p_asset_id: assetId,
    p_club_id: input.clubId,
    p_height: input.picked.height,
    p_width: input.picked.width,
  });

  const id = typeof registered?.asset_id === "string" ? registered.asset_id : null;
  const registeredPath = typeof registered?.path === "string" ? registered.path : null;

  if (!id || !registeredPath) {
    throw new FlyerUploadError("upload_failed");
  }

  return {
    height: typeof registered.height === "number" ? registered.height : input.picked.height,
    id,
    path: registeredPath,
    width: typeof registered.width === "number" ? registered.width : input.picked.width,
  };
}
