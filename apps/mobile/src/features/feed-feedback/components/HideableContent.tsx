/**
 * Il contenuto o il suo segnaposto compatto, nella stessa posizione (HOM-11 §29–§36,
 * §168–§169).
 *
 * L'elemento resta nei dati della lista: quando «Non mi interessa» lo nasconde, QUI il
 * Post lascia il posto a `HiddenContentPlaceholder`; con Annulla torna dov'era, senza un
 * salto di scroll (§34–§35) — gli elementi sopra non cambiano. La lista non rirenderizza:
 * la cella dello store è per target (`useHiddenContent`).
 *
 * `origin` è dato solo dove «Non mi interessa» esiste (Per te, D2): in Seguiti resta
 * `null` e il contenuto non si sostituisce mai, anche se lo stesso Post è stato nascosto
 * in Per te (§26). Con il Post smontato anche un eventuale video si ferma.
 */

import type { ReactNode } from "react";

import type { ContentOrigin } from "../../feed/content-routes";
import type { FeedContentItem } from "../../feed/feed-types";
import { hiddenTargetKey, reposterOf } from "../feed-feedback-presentation";
import { useHiddenContent } from "../hidden-content-store";
import { HiddenContentPlaceholder } from "./HiddenContentPlaceholder";

type HideableContentProps = {
  item: FeedContentItem;
  origin: ContentOrigin | null;
  children: ReactNode;
};

export function HideableContent({ children, item, origin }: HideableContentProps) {
  const { contentType, postId } = item.payload;
  const entry = useHiddenContent(origin ? hiddenTargetKey(contentType, postId) : null);

  if (!origin || !entry) {
    return <>{children}</>;
  }

  return (
    <HiddenContentPlaceholder
      target={{ contentId: postId, contentType, origin, reposter: reposterOf(item.repost) }}
    />
  );
}
