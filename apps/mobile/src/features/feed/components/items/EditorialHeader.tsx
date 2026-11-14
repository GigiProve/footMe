/**
 * Header di Articolo e Video editoriale (HOM-03 §31, §42, §59, §86–87).
 *
 * È l'header del Post (`FeedItemHeader`): avatar o logo, nome, check, riga meta.
 * Cambia solo la riga meta, che dice il formato come etichetta discreta — «Video
 * · 3 h», «Articolo · 2 h» (§32) — e a destra il segnalibro prima del ••• (§59).
 * Il menu degli editoriali non ripete «Salva» (il segnalibro è già visibile) ed
 * espone le altre voci esattamente come nel Post. Nessun «Profilo ufficiale»
 * (§86), nessun colore per tipo di autore o di formato.
 */

import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../theme/tokens";
import type { ContentManagement } from "../../content-management-types";
import { FEED_POST_OPEN_AUTHOR_HINT } from "../../feed-labels";
import {
  buildEditorialAccessibilityLabel,
  buildEditorialMetaLine,
} from "../../feed-video-presentation";
import type { FeedEditorialItem } from "../../feed-types";
import { contentSavedTarget, useIsSaved } from "../../../saved/saved-store";
import { FeedBookmarkButton } from "./FeedBookmarkButton";
import { FeedItemHeader } from "./FeedItemHeader";
import { FeedItemMenu } from "./FeedItemMenu";

type EditorialHeaderProps = {
  item: FeedEditorialItem;
  onPressAuthor: () => void;
  onToggleSaved: () => void;
  /** HOM-04: azioni di gestione dal server (Articolo → «articolo», video → «contenuto»). */
  management?: ContentManagement;
};

export function EditorialHeader({
  item,
  management,
  onPressAuthor,
  onToggleSaved,
}: EditorialHeaderProps) {
  const line = { publishedAt: item.publishedAt, type: item.type };
  // HOM-07 §92, §133: segnalibro e menu leggono lo stesso store Salvati.
  const savedTarget = contentSavedTarget(item.payload.contentType, item.payload.postId);
  const isSaved = useIsSaved(savedTarget, item.isSaved);

  return (
    <FeedItemHeader
      accessibilityHint={FEED_POST_OPEN_AUTHOR_HINT}
      accessibilityLabel={
        item.author
          ? buildEditorialAccessibilityLabel({
              ...line,
              isVerified: item.author.isVerified,
              name: item.author.name,
            })
          : undefined
      }
      item={item}
      metaLine={buildEditorialMetaLine(line)}
      onPressAuthor={onPressAuthor}
      right={
        <View style={styles.right}>
          {item.payload.capabilities.canSave ? (
            <FeedBookmarkButton isSaved={isSaved} onToggle={onToggleSaved} />
          ) : null}
          <FeedItemMenu
            authorName={item.author?.name}
            canSave={false}
            isSaved={isSaved}
            itemType={item.type}
            management={management}
            onToggleSaved={onToggleSaved}
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  right: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
});
