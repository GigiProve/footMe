/**
 * La sezione Commenti del dettaglio (HOM-08 §16–§17, §50–§51, §111, §130–§138,
 * §141–§145, §177–§190, §224–§226, §238–§239).
 *
 * Va DENTRO lo ScrollView del dettaglio, dopo contenuto, action row e divider, come
 * figlio diretto del contenuto scrollabile (il suo `onLayout` dà l'offset per lo scroll
 * di apertura, §5–§6). Ordine: header «Commenti» + «Più rilevanti ▾», commenti
 * principali, risposte espanse a richiesta. Il composer sticky è un altro componente,
 * FUORI dallo scroll.
 *
 * Stati, sempre dentro la sezione e mai a scapito del contenuto (§184–§187, §307–§308):
 * righe skeleton mentre carica; «Non è stato possibile caricare i commenti.» con
 * «Riprova» se fallisce; empty compatto e senza illustrazione (§182–§183, §306);
 * «I commenti sono disattivati per questo contenuto.» (§178) e «Contenuto non
 * disponibile» (§190).
 *
 * Thread: ogni commento principale è una `CommentThread` che si abbona alla propria
 * entità; le risposte si caricano SOLO all'espansione (§136) e un Mi piace o una
 * modifica rirenderizzano una riga, non la pagina (§225–§226). Risposta a risposta
 * resta allo stesso livello (§51). Nessuna card: spazio, gerarchia e rientro (§238–§239).
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { NewContentPill } from "../../feed/components/modules/FeedBanners";
import {
  COMMENT_CONTENT_UNAVAILABLE,
  COMMENTS_DISABLED,
  COMMENTS_EMPTY_BODY,
  COMMENTS_EMPTY_TITLE,
  COMMENTS_LOAD_ERROR,
  COMMENTS_LOAD_MORE,
  COMMENTS_NEW,
  COMMENTS_RETRY,
  COMMENTS_SORT_ACCESSIBILITY,
  COMMENTS_TITLE,
} from "../comment-labels";
import { mergeReplyRefs, repliesToggleModel, sortLabel } from "../comment-presentation";
import { isTempCommentId } from "../comment-operation-key";
import {
  commentStore,
  useCommentEntity,
  useCommentStructure,
  useThreadExpanded,
} from "../comment-store";
import type { CommentEntity } from "../comment-types";
import type { CommentsController } from "../use-comments-controller";
import { useCommentReplies } from "../use-comment-replies";
import { CommentPlaceholderRow } from "./CommentPlaceholderRow";
import { CommentRepliesToggle } from "./CommentRepliesToggle";
import { CommentRow } from "./CommentRow";
import { CommentSkeleton } from "./CommentSkeleton";

type ControllerProps = { controller: CommentsController };

/** «Non è stato possibile caricare … · Riprova»: un errore leggero dentro la sezione, mai a tutto schermo. */
function InlineRetry({ message, onRetry, testID }: { message: string; onRetry: () => void; testID?: string }) {
  return (
    <View accessibilityRole="alert" style={styles.errorBlock} testID={testID}>
      <AppText color="secondary" variant="bodyLg">
        {message}
      </AppText>
      <Button
        label={COMMENTS_RETRY}
        onPress={onRetry}
        size="lg"
        testID={testID ? `${testID}-retry` : undefined}
        variant="secondary"
      />
    </View>
  );
}

function SortControl({ controller }: ControllerProps) {
  const label = sortLabel(controller.sort);

  return (
    <Pressable
      accessibilityLabel={`${COMMENTS_SORT_ACCESSIBILITY}, ${label}`}
      accessibilityRole="button"
      hitSlop={4}
      onPress={() => controller.overlays.setSortOpen(true)}
      style={({ pressed }) => [styles.sort, pressed ? styles.pressed : null]}
      testID="comments-sort"
    >
      <AppText color="secondary" variant="feedMeta">
        {label}
      </AppText>
      <Ionicons color={colors.textSecondary} name="chevron-down" size={16} />
    </Pressable>
  );
}

/** Una risposta: sempre al livello 2, anche se risponde a un'altra risposta (§51). */
function ReplyItem({ id, controller }: { id: string; controller: CommentsController }) {
  const entity = useCommentEntity(id);

  if (!entity) {
    return null;
  }

  return entity.status === "active" ? (
    <CommentRow comment={entity} controller={controller} isReply />
  ) : (
    <CommentPlaceholderRow isReply status={entity.status} />
  );
}

/** Le risposte di un thread, caricate solo se espanso (§133, §136), a blocchi (§134–§135). */
function ThreadReplies({ root, controller }: { root: CommentEntity; controller: CommentsController }) {
  const expanded = useThreadExpanded(root.id);
  const replies = useCommentReplies({
    enabled: expanded && !isTempCommentId(root.id),
    rootCommentId: root.id,
    viewerId: controller.viewerId,
  });
  // Aggiunte mie, rimozioni e riconciliazioni cambiano la struttura del thread.
  useCommentStructure();

  const refs = expanded
    ? mergeReplyRefs({
        isRemoved: commentStore.isRemoved,
        own: commentStore.ownReplies(root.id),
        pageIds: replies.pageIds,
      })
    : [];
  const toggle = repliesToggleModel({ expanded, hasMore: replies.hasMore, repliesCount: root.repliesCount });

  return (
    <View testID={`comment-thread-replies-${root.id}`}>
      {refs.map((ref) => (
        <ReplyItem controller={controller} id={ref.id} key={ref.key} />
      ))}

      {expanded && replies.status === "loading" && refs.length === 0 ? <CommentSkeleton rows={1} /> : null}
      {expanded && replies.status === "error" && refs.length === 0 ? (
        <InlineRetry message={COMMENTS_LOAD_ERROR} onRetry={replies.retry} />
      ) : null}
      {expanded && replies.loadMoreFailed && refs.length > 0 ? (
        <InlineRetry message={COMMENTS_LOAD_ERROR} onRetry={replies.retry} />
      ) : null}

      {toggle.kind === "expand" ? (
        <CommentRepliesToggle
          label={toggle.label}
          onPress={() => controller.actions.expandThread(root)}
          testID={`comment-replies-expand-${root.id}`}
        />
      ) : null}
      {toggle.kind === "more" && !replies.loadMoreFailed ? (
        <CommentRepliesToggle
          busy={replies.isFetchingMore}
          label={toggle.label}
          onPress={() => {
            controller.actions.onThreadMoreLoaded(root.id, refs.length);
            replies.loadMore();
          }}
          testID={`comment-replies-more-${root.id}`}
        />
      ) : null}
    </View>
  );
}

/** Un commento principale con il suo thread (due livelli grafici al massimo, §50). */
function CommentThread({ id, controller }: { id: string; controller: CommentsController }) {
  const entity = useCommentEntity(id);

  if (!entity) {
    return null;
  }

  return (
    <View testID={`comment-thread-${id}`}>
      {entity.status === "active" ? (
        <CommentRow comment={entity} controller={controller} isReply={false} />
      ) : (
        <CommentPlaceholderRow status={entity.status} />
      )}
      <ThreadReplies controller={controller} root={entity} />
    </View>
  );
}

function EmptyComments({ canComment }: { canComment: boolean }) {
  return (
    <View style={styles.empty} testID="comments-empty">
      <AppText align="center" variant="titleSm">
        {COMMENTS_EMPTY_TITLE}
      </AppText>
      {canComment ? (
        <AppText align="center" color="secondary" variant="bodyLg">
          {COMMENTS_EMPTY_BODY}
        </AppText>
      ) : null}
    </View>
  );
}

export function CommentsSection({ controller }: ControllerProps) {
  const { roots, blocked } = controller;

  if (blocked === "content_unavailable") {
    return (
      <View onLayout={controller.onSectionLayout} style={styles.section} testID="comments-section">
        <AppText color="secondary" variant="bodyLg">
          {COMMENT_CONTENT_UNAVAILABLE}
        </AppText>
      </View>
    );
  }

  // L'unico valore dinamico: l'altezza MISURATA del composer, aggiunta in fondo così
  // l'ultimo contenuto non resta dietro la barra sticky.
  const bottomInset = { paddingBottom: controller.composer.barHeight };

  return (
    <View onLayout={controller.onSectionLayout} style={[styles.section, bottomInset]} testID="comments-section">
      <View style={styles.header}>
        <AppText accessibilityRole="header" variant="titleMd">
          {COMMENTS_TITLE}
        </AppText>
        {blocked === null ? <SortControl controller={controller} /> : null}
      </View>

      {blocked === "disabled_hidden" ? (
        <AppText color="secondary" testID="comments-disabled" variant="bodyLg">
          {COMMENTS_DISABLED}
        </AppText>
      ) : (
        <>
          {controller.newComments.isVisible ? (
            <View style={styles.pill}>
              <NewContentPill
                accessibilityHint="Mostra i commenti più recenti"
                label={COMMENTS_NEW}
                onPress={controller.newComments.show}
              />
            </View>
          ) : null}

          {controller.disabledNotice ? (
            <AppText color="secondary" testID="comments-disabled" variant="bodyLg">
              {COMMENTS_DISABLED}
            </AppText>
          ) : null}

          {roots.status === "loading" ? <CommentSkeleton /> : null}
          {roots.status === "error" ? (
            <InlineRetry message={COMMENTS_LOAD_ERROR} onRetry={roots.retry} testID="comments-error" />
          ) : null}

          {roots.status === "ready" && roots.refs.length === 0 ? (
            <EmptyComments canComment={controller.composer.mode !== "hidden"} />
          ) : null}

          {roots.refs.map((ref) => (
            <CommentThread controller={controller} id={ref.id} key={ref.key} />
          ))}

          {roots.status === "ready" && roots.isFetchingMore ? <CommentSkeleton rows={1} /> : null}
          {roots.status === "ready" && roots.loadMoreFailed ? (
            <InlineRetry message={COMMENTS_LOAD_ERROR} onRetry={roots.retry} />
          ) : null}
          {roots.status === "ready" && roots.hasMore && !roots.isFetchingMore && !roots.loadMoreFailed ? (
            <CommentRepliesToggle flush label={COMMENTS_LOAD_MORE} onPress={roots.loadMore} testID="comments-load-more" />
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    gap: spacing[4],
    paddingVertical: spacing[24],
  },
  errorBlock: {
    alignItems: "flex-start",
    gap: spacing[12],
    paddingVertical: spacing[16],
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: sizes.touchTarget,
  },
  pill: {
    alignItems: "center",
    paddingVertical: spacing[8],
  },
  pressed: {
    opacity: 0.6,
  },
  section: {
    paddingTop: spacing[8],
  },
  sort: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
    justifyContent: "flex-end",
    minHeight: sizes.touchTarget,
  },
});
