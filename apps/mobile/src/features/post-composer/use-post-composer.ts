/**
 * Hook del composer Post (HOM-06.1 §26–29, §68–72, §73–98, §110–113, §117–121,
 * §134–142, §155–163, §169–177, §200–201, §205).
 *
 * Due hook, un solo file perché sono le due metà dello stesso flusso:
 *  • `usePostComposerSource` — carica ciò che serve per APRIRE il composer
 *    (contesto con identity e limiti §18, §61; in Modifica anche il Post §146) e
 *    produce lo stato iniziale. Nessun reducer finché i dati non ci sono;
 *  • `usePostComposer` — possiede lo stato (store esterno, vedi
 *    `composer-store.ts`) e tutti i flussi asincroni: upload, anteprima link,
 *    autocomplete mention, ricerca tag, recovery, pubblicazione, salvataggio.
 *
 * Non conosce router né toast: a successo chiama `onPublished` / `onUpdated` e lo
 * schermo chiude, torna all'origin e mostra il feedback (§121–129, §163–164).
 *
 * Scelte che reggono il flusso:
 *  • Pubblica durante upload (§68): lo stato diventa `publishing`, si attende la
 *    coda (`whenIdle`) e si rilegge lo stato aggiornato. Un upload fallito ferma
 *    tutto SENZA creare il Post (§70): l'errore resta sull'item e Pubblica torna
 *    disponibile dopo Riprova/Rimuovi. Nessun Post incompleto in silenzio.
 *  • Idempotenza (§118, §176): la `operationKey` è della sessione e non cambia tra
 *    i tentativi. Un timeout dopo l'invio si rilancia con la stessa chiave: il
 *    server risponde `replayed = true`, non crea un secondo Post.
 *  • Errore (§174–177): niente si cancella; Pubblica torna disponibile. Permesso
 *    perso → si rilegge il contesto (§169–172), la lista del server è l'autorità
 *    sulle identity (§28).
 *  • Recovery (§134–142, §205): snapshot silenzioso, debounced e al passaggio in
 *    background; si cancella a pubblicazione riuscita e a «Elimina». Il
 *    salvataggio parte solo dopo il caricamento dello snapshot, altrimenti uno
 *    stato vuoto cancellerebbe ciò che stiamo per ripristinare.
 *  • Anteprima link (§73–98): la decide `linkFetchTarget` (rispetta le X
 *    esplicite §93 e la regola media+link §95); qui solo il debounce e la chiamata.
 *  • Analytics (§200–201): solo conteggi, tipi, esiti e dominio.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { FeedContentType } from "../feed/feed-types";
import { domainOf, trackComposer, type PublishProps } from "./composer-analytics";
import { applyEditToCaches, applyPublishToCaches, editPatchFromState } from "./composer-cache";
import { composerKeys } from "./composer-keys";
import { createMediaUploader, pickComposerMedia } from "./composer-media";
import {
  defaultIdentity,
  firstEligibleUrl,
  hasFailedMedia,
  hasMeaningfulText,
  hasUploadsInFlight,
  isDirty,
  isEmpty,
  linkFetchTarget,
  mentionQueryAt,
  remainingMediaSlots,
  COMPOSER_MEDIA_LIMIT_COPY,
  toWirePublishArgs,
  toWireUpdateArgs,
} from "./composer-presentation";
import { clearRecovery, loadRecovery, saveRecovery } from "./composer-recovery";
import { createComposerStore } from "./composer-store";
import { createComposerState, createEditState, type ComposerState } from "./composer-reducer";
import { parseComposerOrigin } from "./composer-routes";
import {
  fetchComposerContext,
  fetchLinkPreview,
  fetchPostForEdit,
  parseComposerError,
  publishPost,
  searchTagCandidates,
  updatePost,
} from "./composer-service";
import type {
  ComposerErrorKind,
  ComposerIdentity,
  ComposerOrigin,
  ComposerTaggedIdentity,
  WirePublishPostResult,
  WireUpdatePostResult,
} from "./composer-types";
import { newComposerOperationKey } from "./operation-key";

export const COMPOSER_MEDIA_PERMISSION_COPY =
  "Consenti l'accesso a foto e video dalle impostazioni per aggiungerli al post.";
export const COMPOSER_VIDEO_TOO_LONG_COPY =
  "Alcuni video superano la durata massima consentita e non sono stati aggiunti.";
export const COMPOSER_TAG_SEARCH_ERROR_COPY = "Ricerca non disponibile. Riprova.";

/** Tempi in ms: la ricerca segue la digitazione, l'anteprima aspetta che si smetta di scrivere. */
export const LINK_DEBOUNCE_MS = 700;
export const SEARCH_DEBOUNCE_MS = 300;
export const RECOVERY_DEBOUNCE_MS = 800;
export const REORDER_HINT_MS = 6000;

/** Stessa soglia di `searchTagTargets` (§101): sotto i 2 caratteri non si cerca. */
const MIN_SEARCH_LENGTH = 2;

/* ------------------------------------------------------------------ */
/* Apertura: contesto e Post da modificare                             */
/* ------------------------------------------------------------------ */

export type ComposerSourceParams = {
  userId: string;
  origin: ComposerOrigin;
  /** Identity suggerita dall'apertura (§21–24); la lista del server resta l'autorità. */
  identityHint: string | null;
  /** Presente solo in Modifica. */
  edit: { contentType: FeedContentType; contentId: string; origin: string | null } | null;
};

export type ComposerSource =
  | { status: "loading" }
  | { status: "error"; code: ComposerErrorKind; retry: () => void }
  | { status: "ready"; initialState: ComposerState };

/**
 * §18, §61, §146. `staleTime: 0` + `gcTime: 0`: ogni apertura legge dal server, così
 * la versione di Modifica (§160) e le identity (§28) non vengono da una cache vecchia.
 */
export function usePostComposerSource(params: ComposerSourceParams): ComposerSource {
  // La chiave di idempotenza nasce con l'apertura (§118) e sopravvive ai tentativi.
  const [operationKey] = useState(newComposerOperationKey);
  const { edit, identityHint, origin, userId } = params;

  const context = useQuery({
    enabled: userId.length > 0,
    gcTime: 0,
    queryFn: fetchComposerContext,
    queryKey: composerKeys.context(userId),
    retry: 1,
    staleTime: 0,
  });

  const editQuery = useQuery({
    enabled: userId.length > 0 && edit !== null,
    gcTime: 0,
    queryFn: () => fetchPostForEdit(edit?.contentType ?? "profile_post", edit?.contentId ?? ""),
    queryKey: composerKeys.edit(userId, edit?.contentType ?? "profile_post", edit?.contentId ?? ""),
    retry: 1,
    staleTime: 0,
  });

  const failure = (edit ? editQuery.error : null) ?? context.error;

  if (failure) {
    return {
      code: parseComposerError(failure, edit ? "edit" : "publish"),
      retry: () => {
        void context.refetch();
        if (edit) {
          void editQuery.refetch();
        }
      },
      status: "error",
    };
  }

  if (!context.data || (edit && !editQuery.data)) {
    return { status: "loading" };
  }

  if (edit && editQuery.data) {
    return {
      initialState: createEditState({
        edit: editQuery.data,
        limits: context.data.limits,
        operationKey,
        origin: parseComposerOrigin(edit.origin ?? undefined) ?? undefined,
      }),
      status: "ready",
    };
  }

  return {
    initialState: createComposerState({
      identities: context.data.identities,
      identity: defaultIdentity(origin, context.data.identities, identityHint),
      limits: context.data.limits,
      operationKey,
      origin,
    }),
    status: "ready",
  };
}

/* ------------------------------------------------------------------ */
/* Composer                                                            */
/* ------------------------------------------------------------------ */

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

/** Solo la forma del Post, mai il suo contenuto (§201). */
function publishProps(state: ComposerState): PublishProps {
  return {
    hasLink: firstEligibleUrl(state.body) !== null,
    hasText: hasMeaningfulText(state),
    identityType: state.identity?.type ?? "person",
    mediaCount: state.media.length,
    mentionCount: state.mentions.length,
    origin: state.origin,
    tagCount: state.tagged.length,
  };
}

function tagKey(identity: Pick<ComposerTaggedIdentity, "identityType" | "identityId">): string {
  return `${identity.identityType}:${identity.identityId}`;
}

export type UsePostComposerOptions = {
  initialState: ComposerState;
  /** Utente autenticato: prefisso dello storage dei media e chiave del recovery. */
  userId: string;
  /** Profilo che possiede le query del Feed (`FEED_QK`). */
  profileId: string;
  onPublished: (result: WirePublishPostResult, state: ComposerState) => void;
  onUpdated: (result: WireUpdatePostResult, state: ComposerState) => void;
};

export function usePostComposer({ initialState, userId, profileId, onPublished, onUpdated }: UsePostComposerOptions) {
  const queryClient = useQueryClient();
  const [store] = useState(() => createComposerStore(initialState));
  const state = useSyncExternalStore(store.subscribe, store.getState);

  const [notice, setNotice] = useState<string | null>(null);
  const [selection, setSelection] = useState({ end: 0, start: 0 });
  const [reorderHintDismissed, setReorderHintDismissed] = useState(false);

  // Tag: la selezione è una bozza locale finché non si preme «Fine» (§104–106).
  const [tagOpen, setTagOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [tagDraft, setTagDraft] = useState<ComposerTaggedIdentity[]>([]);
  // Le persone già taggate all'apertura: con la ricerca vuota sono la lista, così si possono togliere e rimettere (§108).
  const [tagInitial, setTagInitial] = useState<ComposerTaggedIdentity[]>([]);

  const uploaderRef = useRef<ReturnType<typeof createMediaUploader> | null>(null);
  const recoveryRef = useRef({ off: false, ready: false });

  const isCreate = state.mode.kind === "create";

  /* ---------------- upload (§63–72, §204) ---------------- */

  useEffect(() => {
    const uploader = createMediaUploader({
      isActive: (localId) => store.getState().media.some((item) => item.localId === localId),
      onChange: (localId, patch) => store.dispatch({ localId, patch, type: "mediaUploadUpdated" }),
      userId,
    });
    uploaderRef.current = uploader;

    return () => {
      uploaderRef.current = null;
    };
  }, [store, userId]);

  // Ogni item `pending` entra in coda: nuovi media, retry (§72) e ripristino (§135).
  useEffect(() => {
    for (const item of state.media) {
      if (item.uploadStatus === "pending") {
        uploaderRef.current?.enqueue(item);
      }
    }
  }, [state.media]);

  /* ---------------- apertura e recovery (§134–142) ---------------- */

  useEffect(() => {
    const opened = store.getState();

    if (opened.mode.kind === "edit") {
      trackComposer({
        contentId: opened.mode.contentId,
        contentType: opened.mode.contentType,
        identityType: opened.identity?.type ?? "person",
        name: "edit_open",
      });
      return;
    }

    trackComposer({ identityType: opened.identity?.type ?? null, name: "composer_open", origin: opened.origin });
  }, [store]);

  useEffect(() => {
    if (store.getState().mode.kind !== "create") {
      return;
    }

    let cancelled = false;

    void loadRecovery(userId).then((snapshot) => {
      if (cancelled) {
        return;
      }

      // §142: ripristino silenzioso, e mai sopra a ciò che l'utente ha già scritto.
      if (snapshot && isEmpty(store.getState())) {
        store.dispatch({ snapshot, type: "restored" });
      }

      recoveryRef.current.ready = true;
    });

    return () => {
      cancelled = true;
    };
  }, [store, userId]);

  useEffect(() => {
    if (state.mode.kind !== "create") {
      return;
    }

    const timer = setTimeout(() => {
      if (recoveryRef.current.ready && !recoveryRef.current.off) {
        void saveRecovery(userId, store.getState());
      }
    }, RECOVERY_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state, store, userId]);

  // §135: l'app in background non deve aspettare il debounce.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      const current = store.getState();

      if (next !== "active" && current.mode.kind === "create" && recoveryRef.current.ready && !recoveryRef.current.off) {
        void saveRecovery(userId, current);
      }
    });

    return () => subscription.remove();
  }, [store, userId]);

  /* ---------------- anteprima link (§73–98) ---------------- */

  const linkTarget = linkFetchTarget(state);

  useEffect(() => {
    if (!linkTarget) {
      return;
    }

    const timer = setTimeout(() => {
      store.dispatch({ type: "linkLoading", url: linkTarget });
      trackComposer({ domain: domainOf(linkTarget) ?? "", name: "link_detected" });
    }, LINK_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [linkTarget, store]);

  const loadingUrl = state.link.status === "loading" ? state.link.url : null;

  useEffect(() => {
    if (!loadingUrl) {
      return;
    }

    let cancelled = false;

    void fetchLinkPreview(loadingUrl).then((result) => {
      // URL cambiato nel frattempo: il reducer scarterebbe comunque la risposta.
      if (cancelled) {
        return;
      }

      store.dispatch({ result, type: "linkResolved", url: loadingUrl });

      if (result.status === "ready") {
        trackComposer({ domain: result.domain, name: "link_preview_success" });
      } else if (result.status === "failed") {
        trackComposer({ domain: result.domain, name: "link_preview_failed", retryable: result.retryable });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadingUrl, store]);

  /* ---------------- mention (§110–113) ---------------- */

  const mentionQuery =
    selection.start === selection.end ? mentionQueryAt(state.body, selection.end, state.mentions) : null;
  const mentionText = useDebouncedValue(mentionQuery?.query ?? "", SEARCH_DEBOUNCE_MS);
  const mentionEnabled = mentionQuery !== null && mentionText.trim().length >= MIN_SEARCH_LENGTH;

  const mentionSearch = useQuery({
    enabled: mentionEnabled,
    queryFn: () => searchTagCandidates(mentionText),
    queryKey: composerKeys.tagSearch(userId, mentionText),
    staleTime: 60_000,
  });

  const mentionCandidates = mentionEnabled ? (mentionSearch.data ?? []) : [];
  const mentionLoading = mentionQuery !== null && mentionQuery.query.trim().length >= MIN_SEARCH_LENGTH
    ? mentionSearch.isFetching || mentionQuery.query !== mentionText
    : false;

  /* ---------------- ricerca tag (§99–106) ---------------- */

  const tagText = useDebouncedValue(tagQuery, SEARCH_DEBOUNCE_MS);
  const tagEnabled = tagOpen && tagText.trim().length >= MIN_SEARCH_LENGTH;

  const tagSearch = useQuery({
    enabled: tagEnabled,
    queryFn: () => searchTagCandidates(tagText),
    queryKey: composerKeys.tagSearch(userId, tagText),
    staleTime: 60_000,
  });

  /* ---------------- suggerimento di riordino (§56) ---------------- */

  const hintArmed = state.media.length >= 2 && !reorderHintDismissed;

  useEffect(() => {
    if (!hintArmed) {
      return;
    }

    const timer = setTimeout(() => setReorderHintDismissed(true), REORDER_HINT_MS);
    return () => clearTimeout(timer);
  }, [hintArmed]);

  /* ---------------- azioni ---------------- */

  async function refreshContext() {
    try {
      const context = await queryClient.fetchQuery({
        gcTime: 0,
        queryFn: fetchComposerContext,
        queryKey: composerKeys.context(userId),
        staleTime: 0,
      });

      store.dispatch({ identities: context.identities, limits: context.limits, type: "contextRefreshed" });
    } catch {
      // Senza rete si resta sull'ultima lista nota: il server rivaluta comunque al publish (§30).
    }
  }

  function setBody(body: string) {
    store.dispatch({ body, type: "bodyChanged" });
  }

  /** §26–29: cambia solo l'autore, poi si rivalidano le capability dalla lista del server. */
  function changeIdentity(identity: ComposerIdentity) {
    const previous = store.getState().identity;

    store.dispatch({ identityId: identity.id, type: "identityChanged" });

    const next = store.getState().identity;

    if (previous && next && (previous.id !== next.id || previous.type !== next.type)) {
      trackComposer({ from: previous.type, name: "identity_changed", to: next.type });
    }

    void refreshContext();
  }

  async function addMedia() {
    const current = store.getState();

    if (current.mode.kind !== "create") {
      return;
    }

    setNotice(null);

    const outcome = await pickComposerMedia({
      limits: current.limits,
      remainingSlots: remainingMediaSlots(store.getState()),
    });

    if (outcome.permissionDenied) {
      setNotice(COMPOSER_MEDIA_PERMISSION_COPY);
      return;
    }

    if (outcome.limitReached) {
      setNotice(COMPOSER_MEDIA_LIMIT_COPY); // §62
    } else if (outcome.rejectedVideos > 0) {
      setNotice(COMPOSER_VIDEO_TOO_LONG_COPY);
    }

    if (outcome.items.length === 0) {
      return;
    }

    const before = store.getState().media;
    store.dispatch({ items: outcome.items, type: "mediaAdded" });
    const after = store.getState().media;

    const images = outcome.items.filter((item) => item.type === "image").length;
    const videos = outcome.items.length - images;

    if (images > 0) {
      trackComposer({ count: images, name: "image_added" });
    }
    if (videos > 0) {
      trackComposer({ count: videos, name: "video_added" });
    }

    const hadBoth = before.some((item) => item.type === "image") && before.some((item) => item.type === "video");
    const imageCount = after.filter((item) => item.type === "image").length;
    const videoCount = after.length - imageCount;

    if (!hadBoth && imageCount > 0 && videoCount > 0) {
      trackComposer({ images: imageCount, name: "mixed_media_created", videos: videoCount });
    }
  }

  function removeMedia(localId: string) {
    const removed = store.getState().media.find((item) => item.localId === localId);

    uploaderRef.current?.cancel(localId);
    setNotice(null);
    store.dispatch({ localId, type: "mediaRemoved" });

    if (removed) {
      trackComposer({ mediaType: removed.type, name: "media_removed" });
    }
  }

  function moveMedia(localId: string, toIndex: number, via: "drag" | "buttons") {
    const before = store.getState().media.findIndex((item) => item.localId === localId);

    store.dispatch({ localId, toIndex, type: "mediaMovedTo" });

    if (before >= 0 && store.getState().media.findIndex((item) => item.localId === localId) !== before) {
      trackComposer({ name: "media_reordered", via });
    }
  }

  function retryMedia(localId: string) {
    const item = store.getState().media.find((candidate) => candidate.localId === localId);

    store.dispatch({ localId, type: "mediaRetried" });

    if (item && item.uploadStatus === "failed") {
      trackComposer({ mediaType: item.type, name: "upload_retry" });
    }
  }

  function dismissLink() {
    const link = store.getState().link;

    if (link.status !== "idle") {
      trackComposer({ domain: domainOf(link.url) ?? "", name: "link_preview_removed" });
    }

    store.dispatch({ type: "linkDismissed" });
  }

  function retryLink() {
    store.dispatch({ type: "linkRetried" });
  }

  function selectMention(candidate: ComposerTaggedIdentity) {
    const query = mentionQueryAt(store.getState().body, selection.end, store.getState().mentions);

    if (!query) {
      return;
    }

    const before = store.getState().mentions.length;

    store.dispatch({
      candidate: {
        displayName: candidate.displayName,
        identityId: candidate.identityId,
        identityType: candidate.identityType,
      },
      range: query.range,
      type: "mentionApplied",
    });

    if (store.getState().mentions.length > before) {
      trackComposer({ name: "mention_added", targetType: candidate.identityType });
    }
  }

  function openTagSheet() {
    const tagged = store.getState().tagged;

    setTagDraft(tagged);
    setTagInitial(tagged);
    setTagQuery("");
    setTagOpen(true);
    trackComposer({ name: "tag_selector_open", selected: tagged.length });
  }

  function toggleTag(identity: ComposerTaggedIdentity) {
    const key = tagKey(identity);
    const selected = tagDraft.some((candidate) => tagKey(candidate) === key);

    if (selected) {
      setTagDraft(tagDraft.filter((candidate) => tagKey(candidate) !== key));
    } else if (tagDraft.length < store.getState().limits.maxTags) {
      setTagDraft([...tagDraft, identity]);
    }
  }

  /** «Fine (N)»: la bozza della selezione diventa i tag del Post (§106). */
  function confirmTags() {
    const previous = store.getState().tagged;
    const keep = new Set(tagDraft.map(tagKey));
    const had = new Set(previous.map(tagKey));

    store.dispatch({ tagged: tagDraft, type: "taggedChanged" });
    setTagOpen(false);

    for (const identity of tagDraft) {
      if (!had.has(tagKey(identity))) {
        trackComposer({ name: "tag_added", targetType: identity.identityType });
      }
    }
    for (const identity of previous) {
      if (!keep.has(tagKey(identity))) {
        trackComposer({ name: "tag_removed", targetType: identity.identityType });
      }
    }
  }

  function closeTagSheet() {
    setTagOpen(false);
  }

  /** §141, §205: «Elimina» e uscita a composer vuoto tolgono lo stato tecnico locale. */
  function discard() {
    recoveryRef.current.off = true;

    for (const item of store.getState().media) {
      uploaderRef.current?.cancel(item.localId);
    }

    void clearRecovery(userId);
  }

  /* ---------------- pubblicazione e salvataggio ---------------- */

  async function submitCreate(started: ComposerState) {
    trackComposer({ name: "publish_attempt", ...publishProps(started) });

    // §68: i media ancora in coda partono; si attende la fine di quelli in volo.
    for (const item of started.media) {
      if (item.uploadStatus === "pending") {
        uploaderRef.current?.enqueue(item);
      }
    }
    await uploaderRef.current?.whenIdle();

    const latest = store.getState();

    // §70: un upload fallito (o rimasto indietro) ferma l'invio. Niente Post senza quel media.
    if (hasFailedMedia(latest.media) || hasUploadsInFlight(latest.media)) {
      store.dispatch({ type: "publishReset" });
      return;
    }

    try {
      const result = await publishPost(toWirePublishArgs(latest, latest.operationKey, latest.origin));

      recoveryRef.current.off = true;
      void clearRecovery(userId);
      applyPublishToCaches(queryClient, { profileId });
      trackComposer({
        ...publishProps(latest),
        contentType: result.content_type,
        name: "publish_success",
        replayed: result.replayed,
      });
      onPublished(result, latest);
    } catch (error) {
      const code = parseComposerError(error, "publish");

      store.dispatch({ code, type: "publishFailed" });
      trackComposer({ ...publishProps(latest), code, name: "publish_failure" });

      // La chiave non è più riusabile: nuova chiave, contenuto intatto, l'utente riprova (§118).
      if (code === "post_operation_conflict") {
        store.dispatch({ operationKey: newComposerOperationKey(), type: "operationKeyRotated" });
      }

      if (code === "post_permission_denied") {
        await refreshContext(); // §169–172
      }
    }
  }

  async function submitEdit(started: ComposerState) {
    if (started.mode.kind !== "edit") {
      return;
    }

    const editProps = {
      contentId: started.mode.contentId,
      contentType: started.mode.contentType,
      identityType: started.identity?.type ?? ("person" as const),
    };

    try {
      const result = await updatePost(toWireUpdateArgs(started));

      applyEditToCaches(queryClient, {
        contentId: editProps.contentId,
        itemId: `${editProps.contentType}:${editProps.contentId}`,
        patch: editPatchFromState(started, result.version),
        profileId,
      });
      trackComposer({ ...editProps, name: "edit_success" });
      onUpdated(result, started);
    } catch (error) {
      const code = parseComposerError(error, "edit");

      store.dispatch({ code, type: "publishFailed" });
      trackComposer({ ...editProps, code, name: "edit_failure" });
    }
  }

  /**
   * Pubblica / Salva. Il primo tap valido porta lo stato a `publishing`
   * in modo sincrono: il secondo non passa (§119, §239).
   */
  async function submit() {
    if (store.getState().publish.status === "publishing") {
      return;
    }

    store.dispatch({ type: "publishStarted" });

    const started = store.getState();

    if (started.publish.status !== "publishing") {
      return;
    }

    if (started.mode.kind === "edit") {
      await submitEdit(started);
    } else {
      await submitCreate(started);
    }
  }

  const mentionState = { candidates: mentionCandidates, loading: mentionLoading };

  return {
    actions: {
      addMedia,
      changeIdentity,
      closeTagSheet,
      confirmTags,
      discard,
      dismissLink,
      moveMedia,
      openTagSheet,
      removeMedia,
      retryLink,
      retryMedia,
      selectMention,
      setBody,
      setNotice,
      setSelection,
      setTagQuery,
      submit,
      toggleTag,
    },
    isDirty: isDirty(state),
    mention: mentionState,
    notice,
    showReorderHint: hintArmed,
    state,
    tag: {
      draft: tagDraft,
      error: tagSearch.isError ? COMPOSER_TAG_SEARCH_ERROR_COPY : null,
      loading: tagEnabled && (tagSearch.isFetching || tagQuery !== tagText),
      open: tagOpen,
      query: tagQuery,
      results: tagEnabled ? (tagSearch.data ?? []) : tagQuery.trim().length === 0 ? tagInitial : [],
    },
    isCreate,
  };
}
