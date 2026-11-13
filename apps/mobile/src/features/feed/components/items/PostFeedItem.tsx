/**
 * Post nel Feed (HOM-02 §2–4, §9, §47–49; HOM-01.1 §10, §17, §18).
 *
 * Un solo componente per ogni autore — Calciatore, Allenatore, Staff,
 * Procuratore, Dirigente, Società, Media: cambiano identità, avatar/logo, riga
 * meta e contenuto, mai il linguaggio visivo (nessun template per ruolo, nessun
 * colore per tipo di autore, nessuna dicitura «Profilo ufficiale»).
 *
 * Contenuto aperto, non una card, nell'ordine fisso del §3:
 * header autore → titolo (solo i post legacy di Società ne hanno uno) → testo
 * con mention → riga «Con …» → rich link preview → media collection → riga
 * azioni. L'ordine non cambia da un autore all'altro.
 *
 * HOM-03: il Video social è questo stesso componente (§2–3). Un Post con un solo
 * video lo riproduce inline nella media collection; nessun `VideoPost`.
 *
 * Il tap su avatar e nome apre l'autore e basta (§7): il corpo apre il
 * contenuto, le mention aprono la loro identità senza risalire al corpo. Tutti
 * gli effetti — Like, apertura media/identità/link, commenti, condivisione —
 * sono handler ricevuti: navigazione, scrittura e analytics stanno in FeedPane
 * (HOM-07/08/09). Il componente traccia solo ciò che nasce al suo interno.
 */

import { Pressable, StyleSheet } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import {
  buildAuthorAccessibilityLabel,
  buildAuthorMetaLine,
  postBodyText,
  summarizeTagged,
} from "../../feed-post-presentation";
import type { ContentManagement } from "../../content-management-types";
import { FEED_POST_OPEN_AUTHOR_HINT } from "../../feed-labels";
import type { FeedPostItem } from "../../feed-types";
import type { FeedIdentityTarget } from "../FeedItemRenderer";
import { PostActionRow } from "../post/PostActionRow";
import { PostBody } from "../post/PostBody";
import { PostLinkPreview } from "../post/PostLinkPreview";
import { PostMediaCollection } from "../post/PostMediaCollection";
import { PostTaggedLine } from "../post/PostTaggedLine";
import { FeedItemFrame } from "./FeedItemFrame";
import { FeedItemHeader } from "./FeedItemHeader";
import { FeedItemMenu } from "./FeedItemMenu";

type PostFeedItemProps = {
  item: FeedPostItem;
  onPress: () => void;
  onPressAuthor: () => void;
  onToggleSaved: () => void;
  onToggleLike: () => void;
  /** §35: l'indice è quello della collezione nell'ordine del Post. */
  onOpenMedia: (index: number) => void;
  /** §19, §22: mention e tag aprono l'identità per id. */
  onOpenIdentity: (target: FeedIdentityTarget) => void;
  onOpenLink: () => void;
  onComment: () => void;
  onShare: () => void;
  /** Il dettaglio mostra l’intera collezione (`list`), il Feed la griglia. */
  mediaVariant?: "grid" | "list";
  onMediaLayout?: (index: number, y: number) => void;
  /** HOM-03: nel dettaglio, il video toccato nel Feed parte inline, una volta sola. */
  autoStartMediaIndex?: number | null;
  /** HOM-04: azioni di gestione dal server, per il menu •••. Assente = nessuna. */
  management?: ContentManagement;
};

export function PostFeedItem({
  item,
  onPress,
  onPressAuthor,
  onToggleSaved,
  onToggleLike,
  onOpenMedia,
  onOpenIdentity,
  onOpenLink,
  onComment,
  onShare,
  mediaVariant = "grid",
  onMediaLayout,
  autoStartMediaIndex = null,
  management,
}: PostFeedItemProps) {
  const { payload } = item;
  const body = postBodyText(payload);
  const taggedSummary = summarizeTagged(payload.tagged, payload.mentions);
  const authorLine = {
    identityType: payload.authorIdentityType,
    meta: payload.authorMeta,
    publishedAt: item.publishedAt,
  };

  return (
    <FeedItemFrame testID="feed-post">
      <FeedItemHeader
        accessibilityHint={FEED_POST_OPEN_AUTHOR_HINT}
        accessibilityLabel={
          item.author
            ? buildAuthorAccessibilityLabel({
                ...authorLine,
                isVerified: item.author.isVerified,
                name: item.author.name,
              })
            : undefined
        }
        item={item}
        metaLine={buildAuthorMetaLine(authorLine)}
        onPressAuthor={onPressAuthor}
        right={
          <FeedItemMenu
            authorName={item.author?.name}
            canSave={payload.capabilities.canSave}
            isSaved={item.isSaved}
            itemType={item.type}
            management={management}
            onToggleSaved={onToggleSaved}
          />
        }
      />

      {item.title ? (
        <Pressable onPress={onPress} style={styles.title}>
          <AppText numberOfLines={2} variant="titleMd">
            {item.title}
          </AppText>
        </Pressable>
      ) : null}

      <PostBody
        body={body}
        itemId={item.id}
        mentions={payload.mentions}
        onPress={onPress}
        onPressMention={(mention) =>
          onOpenIdentity({
            identityId: mention.identityId,
            identityType: mention.identityType,
          })
        }
      />

      {taggedSummary ? (
        <PostTaggedLine
          itemId={item.id}
          onOpenIdentity={onOpenIdentity}
          summary={taggedSummary}
        />
      ) : null}

      {payload.linkPreview ? (
        <PostLinkPreview onPress={onOpenLink} preview={payload.linkPreview} />
      ) : null}

      <PostMediaCollection
        autoStartIndex={autoStartMediaIndex}
        itemId={item.id}
        media={payload.media}
        onOpenMedia={onOpenMedia}
        onMediaLayout={onMediaLayout}
        variant={mediaVariant}
      />

      <PostActionRow
        commentsCount={payload.commentsCount}
        isLiked={payload.isLiked}
        likesCount={payload.likesCount}
        onComment={onComment}
        onLike={onToggleLike}
        onShare={onShare}
      />
    </FeedItemFrame>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: spacing[12],
  },
});
