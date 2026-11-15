/**
 * Link canonico del contenuto, copia e share sheet di sistema (HOM-09
 * §144–§173, D2).
 *
 * L'URL è `https://<origine>/content/<type>/<id>` quando c'è un'origine web
 * configurata (`EXPO_PUBLIC_CONTENT_WEB_ORIGIN`, in subordine
 * `EXPO_PUBLIC_INVITE_WEB_ORIGIN`: il prodotto ha una sola soluzione di link,
 * già usata da eventi, inviti e Rete); altrimenti `footme://content/<type>/<id>`,
 * che l'app apre da sola. Mai un dominio inventato. Dominio, associated domains
 * e landing sono gate di rilascio, non di questo codice.
 *
 * Nel link entrano solo tipo e id del contenuto (§147): niente CDN, storage,
 * URL firmati, thumbnail, media o endpoint API (§148). Il deep link non
 * bypassa la visibilità: chi lo apre passa dalle stesse regole di accesso del
 * dettaglio (§153–§154, §307).
 *
 * Lo share sheet esterno descrive la **sheet**, non la consegna: il sistema
 * non dice se l'invio sia avvenuto, quindi non si registra mai una
 * «condivisione completata» (§202–§203, D4). Stesso modello di
 * `features/dashboard/events/detail/event-link.ts`.
 */

import { Share } from "react-native";
import * as Clipboard from "expo-clipboard";

import type { FeedContentType } from "../feed/feed-types";
import { isShareContentType } from "./share-types";

const WEB_ORIGIN =
  process.env.EXPO_PUBLIC_CONTENT_WEB_ORIGIN ?? process.env.EXPO_PUBLIC_INVITE_WEB_ORIGIN ?? "";

const APP_SCHEME_PREFIX = "footme://content/";

/** Allowlist dell'id: UUID e simili, mai un percorso né una query. */
function isSafeContentId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9-]{8,64}$/.test(value);
}

/**
 * URL canonico del contenuto, o `null` se tipo o id non sono apribili.
 * L'origine è un parametro per i test; di default è quella dell'ambiente.
 */
export function buildContentUrl(
  contentType: FeedContentType | string,
  contentId: string,
  origin: string = WEB_ORIGIN,
): string | null {
  if (!isShareContentType(contentType) || !isSafeContentId(contentId)) {
    return null;
  }

  const path = `content/${contentType}/${contentId}`;
  const trimmed = origin.trim().replace(/\/+$/, "");

  return trimmed ? `${trimmed}/${path}` : `${APP_SCHEME_PREFIX}${contentType}/${contentId}`;
}

/** §155: copia subito l'URL canonico; il chiamante mostra «Link copiato». */
export async function copyContentLink(url: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(url);

    return true;
  } catch {
    return false;
  }
}

export type ExternalShareOutcome = "opened" | "unavailable";

/**
 * §158: invoca la share sheet del sistema. Il valore ritornato dice solo se la
 * sheet si è potuta aprire. L'esito dell'utente (condiviso o annullato) non
 * viene letto: iOS e Android non lo garantiscono in modo affidabile (§203).
 */
export async function openExternalShare(input: {
  message: string;
  title: string;
}): Promise<ExternalShareOutcome> {
  try {
    await Share.share({ message: input.message, title: input.title }, { dialogTitle: input.title });

    return "opened";
  } catch {
    return "unavailable";
  }
}
