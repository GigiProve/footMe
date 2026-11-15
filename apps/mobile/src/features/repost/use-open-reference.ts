/**
 * Apre l'originale dalla card incorporata (HOM-10 §49, §60, §111, §113, §269).
 *
 * Il tap porta al dettaglio canonico del contenuto con la provenienza (HOM-04 §122),
 * così il Back torna alla superficie di partenza (§248). Per un Video apre HOM-03,
 * mai un autoplay nella card (§113); per il Post B di un annidamento apre B intero,
 * dove la sua reference si vede normalmente (§60). Una card non disponibile non
 * arriva qui: non è tappabile (§177).
 */

import { useRouter } from "expo-router";

import { contentDetailHref, type ContentOrigin } from "../feed/content-routes";
import type { FeedContentType } from "../feed/feed-types";
import { trackRepost, type ReferenceSurface } from "./repost-analytics";

export function useOpenReference(surface: ReferenceSurface, origin: ContentOrigin | null) {
  const router = useRouter();

  return (reference: { contentType: FeedContentType; contentId: string }) => {
    trackRepost({
      contentId: reference.contentId,
      contentType: reference.contentType,
      name: "referenced_content_opened",
      surface,
    });
    router.push(contentDetailHref(reference.contentType, reference.contentId, { origin }) as never);
  };
}
