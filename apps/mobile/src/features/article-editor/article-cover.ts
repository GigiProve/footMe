/**
 * Copertina dell'Articolo (HOM-06.2 §36–§40): aggiunta, anteprima, sostituzione,
 * rimozione e crop, non obbligatoria (§37).
 *
 *  • il crop è quello nativo del picker (`allowsEditing` con rapporto 16:9): la
 *    stessa proporzione con cui la copertina compare nel Feed e nel dettaglio;
 *  • l'upload riusa gli helper del composer Post (`composer-media.ts`): stesso
 *    bucket `profile-media`, stesso prefisso `<uid>/posts/` che la policy dello
 *    storage controlla; il client conosce il path solo dopo l'upload (§40) e il
 *    server rivalida l'asset (§260);
 *  • una copertina non ancora caricata blocca Pubblica/Programma ma non il testo
 *    (`cover_uploading`).
 */

import * as ImagePicker from "expo-image-picker";

import { mediaItemFromAsset, uploadComposerMedia } from "../post-composer/composer-media";
import type { ComposerMediaItem } from "../post-composer/composer-types";
import { newComposerLocalId } from "../post-composer/operation-key";
import type { ArticleCover } from "./article-types";

export const COVER_ASPECT: [number, number] = [16, 9];
export const COVER_PERMISSION_COPY = "Consenti l'accesso alle foto dalle impostazioni per aggiungere una copertina.";

export type CoverPick =
  | { status: "picked"; cover: ArticleCover; item: ComposerMediaItem }
  | { status: "canceled" }
  | { status: "denied" };

export async function pickArticleCover(): Promise<CoverPick> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { status: "denied" };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: COVER_ASPECT,
    mediaTypes: ["images"],
    quality: 0.8,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) {
    return { status: "canceled" };
  }

  const item = mediaItemFromAsset(asset, newComposerLocalId());
  return {
    cover: {
      altText: null,
      height: item.height,
      localUri: asset.uri,
      storagePath: null,
      uploadStatus: "pending",
      url: null,
      width: item.width,
    },
    item,
    status: "picked",
  };
}

/** Lancia se l'upload fallisce: il chiamante segna la copertina `failed` e offre «Riprova». */
export async function uploadArticleCover(userId: string, item: ComposerMediaItem): Promise<{ storagePath: string; url: string }> {
  const uploaded = await uploadComposerMedia(userId, item);
  return { storagePath: uploaded.storagePath, url: uploaded.remoteUrl };
}
