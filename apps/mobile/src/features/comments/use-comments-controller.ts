/**
 * Il controller dei Commenti di UN contenuto: l'unico punto di integrazione per i due
 * dettagli (HOM-08 §5–§6, §17, §111, §129, B1/B2 del contratto).
 *
 *   const comments = useCommentsController({ contentType, contentId, focus, origin, scrollRef });
 *   // dentro lo ScrollView, dopo contenuto e action row, figlio diretto del contenuto scrollabile:
 *   <CommentsSection controller={comments} />
 *   // FUORI dallo ScrollView, dentro il KeyboardAvoidingView del dettaglio:
 *   <CommentComposerBar controller={comments} />
 *   <CommentsOverlays controller={comments} />   // sheet e modali
 *
 * Compone gli hook di dominio (contesto, liste, pubblicazione, modifica, eliminazione,
 * «Nuovi commenti») e tiene lo stato di UI che attraversa sezione e composer
 * (ordinamento, fogli aperti). NON legge mai il testo che si digita: quello vive in
 * `comment-draft-store`, così scrivere non rirenderizza il thread; e non legge le
 * singole entità: ogni riga si abbona alla propria (§225).
 *
 *  • `focus = 'comments'` → scroll alla sezione, tastiera chiusa (§5);
 *    `focus = 'composer'` → scroll + composer attivo con focus (§6), una volta sola e
 *    solo se commentare è possibile. Questo hook emette `comments_open` /
 *    `comments_open_with_composer` una volta sola, se `focus` non è nullo.
 *  • Lo stato (ordinamento, thread espansi, liste in cache, bozza) sopravvive al push
 *    di un profilo o di una menzione e al ritorno (§111, §129): il dettaglio resta
 *    montato nello stack e l'ordinamento sta anche nello store per contenuto.
 *  • Il Mi piace del commento è il motore HOM-07 (`useContentLikeToggle`,
 *    `contentType: "comment"`, identità derivata, nessun selettore, §74–§79); la lista
 *    di chi ha messo Mi piace è la STESSA `LikesScreen` (§75–§76).
 */

import { useEffect, useRef, useState, type RefObject } from "react";
import type { LayoutChangeEvent, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { useToast } from "../../ui";
import { openExternalUrl } from "../article-editor/article-links";
import { useSession } from "../auth/use-session";
import { parseContentOrigin, type CommentTarget } from "../feed/content-routes";
import { resolveIdentityHref } from "../feed/feed-service";
import { useContentLikeToggle } from "../feed/use-feed-post-like";
import { followSourceOfIdentity } from "../following/follow-source";
import { useUnfollowFromContent } from "../following/use-unfollow-from-content";
import { isLikedForDisplay } from "../interactions/interaction-identity";
import { likeItemKey, likeStore } from "../interactions/like-store";
import { useOpenLikes } from "../likes/use-open-likes";
import { reportHref } from "../moderation/moderation-routes";
import { trackComment } from "./comment-analytics";
import { commentCountStore } from "./comment-count-store";
import {
  createCommentDraftStore,
  registerCommentDraft,
  type CommentDraftStore,
} from "./comment-draft-store";
import { COMMENTS_QK } from "./comment-keys";
import {
  authorHref,
  commentActionContext,
  commentableIdentities,
  extractCommentLinks,
  mergeRootRefs,
  replyMentionPrefix,
  resolveCommentIdentity,
} from "./comment-presentation";
import { commentStore, useCommentStructure } from "./comment-store";
import type {
  CommentAuthor,
  CommentContext,
  CommentEntity,
  CommentIdentity,
  CommentLimits,
  CommentMentionRef,
  CommentRef,
  CommentSort,
} from "./comment-types";
import type { CommentMenuSelection } from "./components/CommentActionSheet";
import { useCommentContext, type CommentContextState } from "./use-comment-context";
import { useCommentUpdates } from "./use-comment-updates";
import { useDeleteComment } from "./use-delete-comment";
import { useEditComment } from "./use-edit-comment";
import { usePublishComment } from "./use-publish-comment";
import { useRootComments } from "./use-root-comments";

const DEFAULT_LIMITS: CommentLimits = { maxBodyLength: 1000, maxLinks: 10, maxMentions: 20 };

/** Un po' d'aria sopra l'intestazione della sezione quando ci si scorre. */
const SCROLL_MARGIN = 8;

export type CommentsFocus = "comments" | "composer" | null;

export type CommentsController = {
  contentType: string;
  contentId: string;
  /** `likeItemKey(contentType, contentId)`: la cella del conteggio (`comment-count-store`). */
  contentKey: string;
  viewerId: string;

  /** Il contesto del server (identità, limiti, abilitazione); `loading` finché non c'è. */
  context: CommentContextState;
  limits: CommentLimits;
  contentAuthor: CommentContext["contentAuthor"];

  /**
   * Cosa dice la sezione al posto della lista (§178, §188–§190): contenuto non
   * disponibile o commenti disattivati con commenti esistenti nascosti.
   */
  blocked: "content_unavailable" | "disabled_hidden" | null;
  /** Commenti disattivati ma ancora leggibili: la lista c'è, niente composer né azioni (§177–§180). */
  disabledNotice: boolean;

  sort: CommentSort;
  setSort: (sort: CommentSort) => void;

  /** I commenti principali: le righe da mostrare, la paginazione, gli stati (§130–§131, §184–§187). */
  roots: {
    status: "loading" | "error" | "ready";
    refs: CommentRef[];
    hasMore: boolean;
    isFetchingMore: boolean;
    loadMoreFailed: boolean;
    loadMore: () => void;
    retry: () => void;
  };

  /** «↑ Nuovi commenti» (§141–§145). */
  newComments: { isVisible: boolean; show: () => void };

  composer: {
    /** `hidden` = nessun campo (commenti disattivati, contenuto non disponibile, §179). */
    mode: "hidden" | "loading" | "ready";
    store: CommentDraftStore;
    /**
     * Altezza misurata della barra: la sezione la aggiunge come spazio in fondo, così
     * l'ultimo contenuto (es. «Nessun commento») non resta nascosto dietro il composer.
     */
    barHeight: number;
    onBarLayout: (event: LayoutChangeEvent) => void;
    /** Solo le identità con `can_comment` (§34). */
    identities: CommentIdentity[];
    open: () => void;
    close: () => void;
    setBody: (body: string, mentions: CommentMentionRef[]) => void;
    chooseIdentity: (identity: CommentIdentity) => void;
    cancelReply: () => void;
    publish: () => void;
    onMentionAdded: (identityType: "profile" | "club") => void;
  };

  edit: {
    start: (comment: CommentEntity) => void;
    change: (body: string, mentions: CommentMentionRef[]) => void;
    cancel: () => void;
    save: () => void;
    limits: CommentLimits;
  };

  remove: {
    target: ReturnType<typeof useDeleteComment>["target"];
    isBusy: boolean;
    cancel: () => void;
    confirm: () => void;
  };

  /** Azioni di riga: ogni riga le chiama con la propria entità. */
  actions: {
    reply: (comment: CommentEntity) => void;
    retrySend: (tempId: string) => void;
    reopenFailed: (tempId: string) => void;
    toggleLike: (comment: CommentEntity) => void;
    openLikes: (comment: CommentEntity) => void;
    openAuthor: (author: CommentAuthor, commentId: string, via: "avatar" | "name") => void;
    openMention: (mention: CommentMentionRef, commentId: string) => void;
    expandThread: (comment: CommentEntity) => void;
    onThreadMoreLoaded: (rootId: string, loaded: number) => void;
    openMenu: (comment: CommentEntity) => void;
    openLink: (url: string) => void;
  };

  /** Fogli e modali: lo stato è qui perché lo condividono sezione e composer. */
  overlays: {
    sortOpen: boolean;
    setSortOpen: (open: boolean) => void;
    asOpen: boolean;
    setAsOpen: (open: boolean) => void;
    menuTarget: CommentEntity | null;
    closeMenu: () => void;
    /** Modifica / Elimina (HOM-08), Non seguire / Segnala (HOM-11 §70). */
    runMenuAction: (action: CommentMenuSelection) => void;
  };

  /** Da attaccare all'`onLayout` della sezione, per lo scroll di apertura (§5–§6). */
  onSectionLayout: (event: LayoutChangeEvent) => void;
  /**
   * Il tap sulla cella Commenta della action row DEL DETTAGLIO (§13): con commenti
   * scorre alla sezione senza tastiera (§5), a zero attiva il composer con focus (§6).
   * Decide dal conteggio vivo dello store, non dal payload.
   */
  onActionRowComment: () => void;
};

export function useCommentsController({
  contentType,
  contentId,
  focus,
  origin = null,
  scrollRef,
  target = null,
}: {
  contentType: string;
  contentId: string;
  focus: CommentsFocus;
  origin?: string | null;
  scrollRef: RefObject<ScrollView | null>;
  /**
   * HOM-14 §47, §51: il commento (e il thread) a cui porta la notifica. Apre il
   * thread del commento principale; senza di esso la sezione si apre come sempre.
   */
  target?: CommentTarget | null;
}): CommentsController {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const { showToast } = useToast();
  const viewerId = profile?.id ?? "";
  const contentKey = likeItemKey(contentType, contentId);

  /* ---------------- contesto e disponibilità ---------------- */

  const context = useCommentContext({ contentId, contentType, viewerId });
  const contextData = context.status === "ready" ? context.data : null;
  const contextRef = useRef<CommentContext | null>(contextData);
  contextRef.current = contextData;

  const [contentGone, setContentGone] = useState(false);
  const contentUnavailable =
    contentGone || (context.status === "error" && context.kind === "content_unavailable");
  const commentsHidden = contextData !== null && !contextData.commentsVisible;
  const commentsEnabled = contextData === null ? true : contextData.commentsEnabled;
  const limits = contextData?.limits ?? DEFAULT_LIMITS;
  const identities = commentableIdentities(contextData?.identities ?? []);

  const blocked: CommentsController["blocked"] = contentUnavailable
    ? "content_unavailable"
    : commentsHidden
      ? "disabled_hidden"
      : null;

  /* ---------------- lista ---------------- */

  const [sort, setSortState] = useState<CommentSort>(() => commentStore.getSort(contentKey));
  const roots = useRootComments({
    contentId,
    contentType,
    // La lista parte in parallelo al contesto (§184: niente attese a cascata).
    enabled: blocked === null,
    sort,
    viewerId,
  });
  // La struttura (miei aggiunti, rimossi, riconciliazioni) rirenderizza la lista, non ogni riga.
  useCommentStructure();
  const refs = mergeRootRefs({
    isRemoved: commentStore.isRemoved,
    own: commentStore.ownRoots(contentKey),
    pageIds: roots.pageIds,
  });

  const updates = useCommentUpdates({
    contentId,
    contentType,
    enabled: blocked === null && roots.status === "ready",
    viewerId,
    // Tempo del SERVER: l'as_of della prima pagina, o quello del contesto se è vuota.
    watermark: roots.firstAsOf ?? contextData?.asOf ?? null,
  });

  /* ---------------- bozza e scritture ---------------- */

  const [draftStore] = useState(createCommentDraftStore);
  useEffect(() => registerCommentDraft(draftStore), [draftStore]);

  const refreshContext = () => {
    if (context.status === "ready") {
      context.refresh();
    } else if (context.status === "error") {
      context.retry();
    }
  };

  const publisher = usePublishComment({
    contentId,
    contentKey,
    contentType,
    draftStore,
    getContext: () => contextRef.current,
    onContentUnavailable: () => setContentGone(true),
    onNotice: (message) => showToast({ message }),
    // Permesso perso o commenti disattivati: il contesto si rilegge, così il composer
    // sparisce (§179) o cambia identità (§43) invece di fallire a ogni Pubblica.
    onPermissionLost: refreshContext,
  });

  /**
   * §155: dopo un conflitto di versione si rilegge il commento — i thread aperti e i
   * principali — così lo store ha il testo CORRENTE da mostrare accanto al proprio.
   */
  const reloadComment = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["comments", "roots", contentType, contentId] }),
      queryClient.invalidateQueries({ queryKey: [...COMMENTS_QK.all, "replies"] }),
    ]);
  };

  const editor = useEditComment({
    contentId,
    contentType,
    draftStore,
    getLimits: () => contextRef.current?.limits ?? DEFAULT_LIMITS,
    onContentUnavailable: () => setContentGone(true),
    reloadComment,
  });

  const deletion = useDeleteComment({
    contentId,
    contentKey,
    contentType,
    onMessage: (message) => showToast({ message }),
  });

  /* ---------------- Mi piace del commento (HOM-07) ---------------- */

  const toggleLikeEngine = useContentLikeToggle({ profileId: viewerId });
  const openLikesList = useOpenLikes();

  /* ---------------- Non seguire dal menu del commento (HOM-11 §70) ---------------- */

  // Il Follow globale, non un sistema dei commenti: stessa mutation, stessa snackbar dei contenuti.
  const unfollowActions = useUnfollowFromContent();

  /* ---------------- fogli ---------------- */

  const [sortOpen, setSortOpen] = useState(false);
  const [asOpen, setAsOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState<CommentEntity | null>(null);

  /* ---------------- thread di una notifica (HOM-14 §51) ---------------- */

  // Una risposta apre il thread del suo commento principale; una volta sola per commento.
  const targetRootId = target?.rootCommentId ?? null;
  const targetCommentId = target?.commentId ?? null;
  useEffect(() => {
    if (targetRootId && targetCommentId && targetRootId !== targetCommentId) {
      commentStore.setExpanded(targetRootId, true);
    }
  }, [targetCommentId, targetRootId]);

  /* ---------------- scroll di apertura (§5–§6) ---------------- */

  const [sectionY, setSectionY] = useState<number | null>(null);
  const [barHeight, setBarHeight] = useState(0);
  const focusDone = useRef(false);
  const settled = contextData !== null || context.status === "error";
  const listSettled = blocked !== null || roots.status !== "loading";
  const composerReady = contextData !== null && commentsEnabled && blocked === null;

  // Senza lista di dipendenze di proposito: legge molto stato di render e la guardia
  // `focusDone` lo fa scattare UNA volta, appena sezione, contesto e lista sono pronti.
  useEffect(() => {
    if (focusDone.current || focus === null || sectionY === null || !settled || !listSettled) {
      return;
    }
    focusDone.current = true;

    // §6: zero commenti → il composer parte attivo, con focus. Solo se commentare è possibile.
    if (focus === "composer" && composerReady) {
      draftStore.set((draft) => ({ active: true, focusToken: draft.focusToken + 1 }));
      trackComment({
        contentId,
        contentType,
        identityType: resolveCommentIdentity(identities, draftStore.getState().identity).identity?.type ?? null,
        name: "comment_composer_open",
        origin,
      });
    }

    scrollRef.current?.scrollTo({ animated: true, y: Math.max(0, sectionY - SCROLL_MARGIN) });
  });

  // §258: apertura del dettaglio sui commenti — UNA volta, solo se il dettaglio è stato
  // aperto con `focus`. Nessuna lista di dipendenze: la guardia `openTracked` la fa scattare una volta.
  const openTracked = useRef(false);
  useEffect(() => {
    if (openTracked.current || focus === null) {
      return;
    }
    openTracked.current = true;

    if (focus === "composer") {
      trackComment({ contentId, contentType, name: "comments_open_with_composer", origin });
    } else {
      trackComment({
        commentsCount: commentCountStore.get(contentKey) ?? 0,
        contentId,
        contentType,
        name: "comments_open",
        origin,
      });
    }
  });

  /* ---------------- azioni ---------------- */

  function scrollToSection() {
    if (sectionY !== null) {
      scrollRef.current?.scrollTo({ animated: true, y: Math.max(0, sectionY - SCROLL_MARGIN) });
    }
  }

  function onActionRowComment() {
    const count = commentCountStore.get(contentKey) ?? contextRef.current?.commentsCount ?? 0;

    if (count > 0 || !composerReady) {
      scrollToSection();
      return;
    }

    open();
    scrollToSection();
  }

  function setSort(next: CommentSort) {
    if (next === sort) {
      return;
    }
    commentStore.setSort(contentKey, next);
    setSortState(next);
    trackComment({ contentId, contentType, name: "comments_sort_changed", sort: next });
  }

  function open() {
    if (!composerReady) {
      return;
    }
    draftStore.set((draft) => ({ active: true, focusToken: draft.focusToken + 1 }));
    trackComment({
      contentId,
      contentType,
      identityType: resolveCommentIdentity(identities, draftStore.getState().identity).identity?.type ?? null,
      name: "comment_composer_open",
      origin,
    });
  }

  /** Il composer si richiude solo se non c'è niente da perdere (§18–§19, §44). */
  function close() {
    const draft = draftStore.getState();

    // Con «Commenta come» aperto l'input perde il focus ma l'utente sta ancora componendo.
    if (asOpen) {
      return;
    }

    if (draft.body.length === 0 && draft.replyTo === null) {
      draftStore.set({ active: false, notice: null });
    }
  }

  function setBody(body: string, mentions: CommentMentionRef[]) {
    const before = extractCommentLinks(draftStore.getState().body, limits.maxLinks).length;
    const after = extractCommentLinks(body, limits.maxLinks).length;

    draftStore.set({ body, mentions, notice: null });

    if (after > before) {
      trackComment({ contentId, contentType, linkCount: after, name: "comment_link_added" });
    }
  }

  /** §40–§41: cambia solo chi parla; testo, mention, link e stato di risposta restano. */
  function chooseIdentity(next: CommentIdentity) {
    const previous = resolveCommentIdentity(identities, draftStore.getState().identity).identity;

    draftStore.set({ identity: next, notice: null });
    setAsOpen(false);

    if (previous && (previous.type !== next.type || previous.id !== next.id)) {
      trackComment({ contentId, contentType, from: previous.type, name: "comment_identity_changed", to: next.type });
    }
    // §41: le capability dell'identità scelta si rileggono dal server.
    refreshContext();
  }

  function reply(comment: CommentEntity) {
    if (!composerReady || !comment.capabilities.canReply || !comment.author) {
      return;
    }

    const draft = draftStore.getState();
    const self = resolveCommentIdentity(identities, draft.identity).identity;
    const prefix = replyMentionPrefix(comment.author, {
      currentBody: draft.body,
      maxBodyLength: limits.maxBodyLength,
      self: self ? { id: self.id, type: self.type } : null,
    });

    draftStore.set({
      active: true,
      body: prefix?.body ?? draft.body,
      focusToken: draft.focusToken + 1,
      mentions: prefix?.mentions ?? draft.mentions,
      notice: null,
      replyTo: {
        commentId: comment.id,
        identityId: comment.author.identityId,
        identityType: comment.author.identityType,
        name: comment.author.name,
        rootCommentId: comment.rootCommentId,
      },
    });
    trackComment({
      commentId: comment.id,
      contentId,
      contentType,
      name: "reply_selected",
      targetType: comment.author.identityType,
    });
  }

  /** §83: si torna al commento principale senza cancellare il testo. */
  function cancelReply() {
    draftStore.set({ notice: null, replyTo: null });
  }

  function toggleLike(comment: CommentEntity) {
    const key = likeItemKey("comment", comment.id);
    const snapshot = likeStore.get(key) ?? { likedAs: comment.likedAs, likesCount: comment.likesCount };
    const identity = likeStore.getIdentity();
    const adding = !isLikedForDisplay(snapshot.likedAs, identity);

    trackComment({
      commentId: comment.id,
      contentId,
      contentType,
      identityType: identity?.type ?? null,
      name: adding ? "comment_like_added" : "comment_like_removed",
    });
    toggleLikeEngine({
      canLike: comment.capabilities.canLike,
      contentType: "comment",
      postId: comment.id,
      seed: { likedAs: comment.likedAs, likesCount: comment.likesCount },
    });
  }

  function openLikes(comment: CommentEntity) {
    const current = likeStore.get(likeItemKey("comment", comment.id));
    const likesCount = current?.likesCount ?? comment.likesCount;

    trackComment({ commentId: comment.id, contentId, contentType, likesCount, name: "comment_likes_list_open" });
    openLikesList({ contentType: "comment", likesCount, postId: comment.id });
  }

  function openAuthor(author: CommentAuthor, commentId: string, via: "avatar" | "name") {
    trackComment({
      authorType: author.identityType,
      commentId,
      contentId,
      contentType,
      name: "author_profile_open_from_comment",
      via,
    });
    router.push(authorHref(author) as never);
  }

  function openMention(mention: CommentMentionRef, commentId: string) {
    trackComment({
      authorType: mention.identityType === "club" ? "society" : "person",
      commentId,
      contentId,
      contentType,
      name: "author_profile_open_from_comment",
      via: "mention",
    });
    router.push(resolveIdentityHref(mention) as never);
  }

  function expandThread(comment: CommentEntity) {
    commentStore.setExpanded(comment.id, true);
    trackComment({
      commentId: comment.id,
      contentId,
      contentType,
      name: "replies_expanded",
      repliesCount: comment.repliesCount,
    });
  }

  function onThreadMoreLoaded(rootId: string, loaded: number) {
    trackComment({ commentId: rootId, contentId, contentType, loaded, name: "more_replies_loaded" });
  }

  function runMenuAction(action: CommentMenuSelection) {
    // L'entità di ADESSO, non lo snapshot di quando il menu si è aperto: un seed arrivato
    // nel frattempo cambia versione e testo, e una modifica con la versione vecchia
    // sarebbe un conflitto spurio.
    const target = menuTarget ? (commentStore.get(menuTarget.id) ?? menuTarget) : null;
    setMenuTarget(null);

    if (!target) {
      return;
    }
    if (action === "edit") {
      editor.start(target);
    } else if (action === "delete") {
      deletion.request(target);
    } else if (action === "unfollow") {
      // §70, §145: la fonte è l'identità che ha scritto il commento (Società → `club_follows`).
      const source = target.author ? followSourceOfIdentity(target.author) : null;
      if (source) {
        void unfollowActions.unfollow({ origin: parseContentOrigin(origin ?? undefined), source, surface: "comment" });
      }
    } else {
      // §132–§133: lo stesso flow dei contenuti, con `target_type = COMMENT`. Il contesto per
      // le azioni contestuali è quello di HOM-08 §174; «Fine» torna a questo thread (§116–§119).
      const context = commentActionContext(target, viewerId);
      router.push(
        reportHref({
          contentType: context.contentType,
          origin: parseContentOrigin(origin ?? undefined),
          parentContentId: context.contentId,
          targetId: context.commentId,
          targetType: "COMMENT",
        }) as never,
      );
    }
  }

  /** §144: la rilettura è controllata — prima pagina, sul posto, nessuno scroll jump (§142, §311). */
  function showNewComments() {
    updates.dismiss();
    void roots.refreshFirstPage();
    // I thread aperti si rileggono: anche le risposte nuove contano nel conteggio della pill.
    void queryClient.invalidateQueries({ queryKey: [...COMMENTS_QK.all, "replies"] });
  }

  const composerMode: CommentsController["composer"]["mode"] =
    blocked !== null || !commentsEnabled ? "hidden" : contextData === null ? "loading" : "ready";

  return {
    actions: {
      expandThread,
      onThreadMoreLoaded,
      openAuthor,
      openLikes,
      // §116: stesso cancello dei link dell'Articolo — solo https, mai HTML.
      openLink: (url) => {
        void openExternalUrl(url);
      },
      openMention,
      openMenu: setMenuTarget,
      reopenFailed: publisher.reopen,
      reply,
      retrySend: publisher.retry,
      toggleLike,
    },
    blocked,
    composer: {
      // Senza composer (nascosto) la barra non c'è: nessuno spazio.
      barHeight: composerMode === "hidden" ? 0 : barHeight,
      onBarLayout: (event) => setBarHeight(Math.round(event.nativeEvent.layout.height)),
      cancelReply,
      chooseIdentity,
      close,
      identities,
      mode: composerMode,
      onMentionAdded: (identityType) =>
        trackComment({ contentId, contentType, name: "mention_added", targetType: identityType }),
      open,
      publish: publisher.publish,
      setBody,
      store: draftStore,
    },
    contentAuthor: contextData?.contentAuthor ?? null,
    contentId,
    contentKey,
    contentType,
    context,
    disabledNotice: contextData !== null && !contextData.commentsEnabled && contextData.commentsVisible,
    edit: {
      cancel: editor.cancel,
      change: editor.change,
      limits,
      save: () => {
        void editor.save();
      },
      start: editor.start,
    },
    limits,
    newComments: { isVisible: updates.isVisible, show: showNewComments },
    onActionRowComment,
    onSectionLayout: (event) => setSectionY(event.nativeEvent.layout.y),
    overlays: {
      asOpen,
      closeMenu: () => setMenuTarget(null),
      menuTarget,
      runMenuAction,
      setAsOpen,
      setSortOpen,
      sortOpen,
    },
    remove: {
      cancel: deletion.cancel,
      confirm: () => {
        void deletion.confirm();
      },
      isBusy: deletion.isBusy,
      target: deletion.target,
    },
    roots: {
      hasMore: roots.hasMore,
      isFetchingMore: roots.isFetchingMore,
      loadMore: roots.loadMore,
      loadMoreFailed: roots.loadMoreFailed,
      refs,
      // Il «Riprova» della sezione rilegge anche il contesto, se era fallito.
      retry: () => {
        roots.retry();
        if (context.status === "error") {
          context.retry();
        }
      },
      status: roots.status,
    },
    setSort,
    sort,
    viewerId,
  };
}
