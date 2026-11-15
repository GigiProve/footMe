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
 *
 * HOM-10 (Repost, §14–§41, §61–§72, §120–§133, §137–§148, §225–§233) nello STESSO
 * hook, senza un editor nuovo (§16): una reference sul composer lo porta in
 * modalità Repost.
 *  • apertura: oltre al contesto si legge `fetch_repost_state` (identità con
 *    `can_repost`, originale e snapshot per la card); la lista di «Reposta come» è
 *    la sua, non quella di `fetch_post_composer_context` (§30);
 *  • body non significativo (§62) → Simple Repost: `repost_content`, OTTIMISTICO
 *    (§70) — il composer si chiude al tap e l'esito arriva dopo; un errore fa
 *    rollback e mostra la frase dell'errore (§72). Nessuna bozza (§137);
 *  • body significativo → `submit_content` con `reference` nel payload, stessa
 *    idempotenza, bozze e programmazione di HOM-06.2 (§86, §235, §151);
 *  • niente recovery locale (la bozza server la sostituisce, e quella locale del
 *    Post normale non si tocca) né anteprima link (§97).
 *
 * HOM-06.2 (bozze e programmazione, §81–§136, §147, §163–§167, §203–§211) nello
 * stesso hook, senza un secondo composer (§83):
 *  • autosave su `save_content_draft` (`useAutosave`) dal primo contenuto
 *    significativo; la copia locale resta `composer-recovery` e porta ref+versione
 *    della bozza, così un crash riprende la STESSA riga;
 *  • due chiavi di operazione per sessione: `draft.operationKey` (salvataggio
 *    bozza) e `operationKey` (invio) — due operazioni, due retry indipendenti;
 *  • l'invio di un Post nuovo/bozza è `submit_content`: prima si attende il
 *    salvataggio in sospeso (`flush`), così una bozza in creazione non si
 *    duplica; Pubblica = «Ora», Programma = data futura, `keep` su un programmato.
 *    `publish_post`/`update_post` restano per la Modifica di un Post pubblicato;
 *  • uscita a tre azioni: `keepDraft` (salva e conserva), `deleteDraft`
 *    (elimina secondo la policy del server), nessuna delle due per un programmato.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { FeedContentType } from "../feed/feed-types";
import { trackPublishing } from "../publishing/publishing-analytics";
import { publishingKeys } from "../publishing/publishing-keys";
import { publishingErrorCopy } from "../publishing/publishing-presentation";
import {
  deleteContentDraft,
  parsePublishingError,
  PublishingRequestError,
  submitContent,
} from "../publishing/publishing-service";
import type { ContentRef, Publication } from "../publishing/publishing-types";
import { useAutosave } from "../publishing/use-autosave";
import { trackRepost } from "../repost/repost-analytics";
import { performRemoveRepost, performSimpleRepost } from "../repost/repost-actions";
import { invalidateAfterRepostChange } from "../repost/repost-cache";
import {
  hintFirstIdentity,
  insertTokenAtSelection,
  isReferenceUnavailableCode,
  isRepostComposer,
  isSignificantRepostBody,
  repostIntent,
  REPOST_COMPOSER_COPY,
} from "../repost/repost-composer-presentation";
import { REPOST_QK } from "../repost/repost-keys";
import {
  composerIdentitiesFromState,
  composerReferenceFromState,
} from "../repost/repost-presentation";
import { fetchRepostState } from "../repost/repost-service";
import type { RepostContentRef, SimpleRepostFailure } from "../repost/repost-types";
import { domainOf, trackComposer, type PublishProps } from "./composer-analytics";
import { applyEditToCaches, applyPublishToCaches, editPatchFromState } from "./composer-cache";
import { composerKeys } from "./composer-keys";
import { createMediaUploader, pickComposerMedia } from "./composer-media";
import {
  defaultIdentity,
  firstEligibleUrl,
  hasFailedMedia,
  hasMeaningfulText,
  hasSavableContent,
  hasUploadsInFlight,
  isDirty,
  isEditingScheduled,
  isEmpty,
  linkFetchTarget,
  mentionQueryAt,
  remainingMediaSlots,
  submitPublication,
  COMPOSER_MEDIA_LIMIT_COPY,
  toDraftContent,
  toDraftPayload,
  toWireUpdateArgs,
} from "./composer-presentation";
import { clearRecovery, loadRecovery, saveRecovery } from "./composer-recovery";
import { createComposerStore } from "./composer-store";
import { createComposerState, createDraftState, createEditState, type ComposerState } from "./composer-reducer";
import { parseComposerOrigin } from "./composer-routes";
import {
  fetchComposerContext,
  fetchLinkPreview,
  fetchPostDraftForEditor,
  fetchPostForEdit,
  parseComposerError,
  searchTagCandidates,
  updatePost,
} from "./composer-service";
import type {
  ComposerIdentity,
  ComposerOrigin,
  ComposerSubmitErrorKind,
  ComposerTaggedIdentity,
  WireUpdatePostResult,
} from "./composer-types";
import { newComposerOperationKey } from "./operation-key";
import {
  MIN_SEARCH_LENGTH,
  SEARCH_DEBOUNCE_MS,
  useDebouncedValue,
  useMentionAutocomplete,
} from "./use-mention-autocomplete";

export const COMPOSER_MEDIA_PERMISSION_COPY =
  "Consenti l'accesso a foto e video dalle impostazioni per aggiungerli al post.";
export const COMPOSER_VIDEO_TOO_LONG_COPY =
  "Alcuni video superano la durata massima consentita e non sono stati aggiunti.";
export const COMPOSER_TAG_SEARCH_ERROR_COPY = "Ricerca non disponibile. Riprova.";

/** Tempi in ms: la ricerca segue la digitazione (`SEARCH_DEBOUNCE_MS`), l'anteprima aspetta che si smetta di scrivere. */
export const LINK_DEBOUNCE_MS = 700;
export { SEARCH_DEBOUNCE_MS };
export const RECOVERY_DEBOUNCE_MS = 800;
export const REORDER_HINT_MS = 6000;

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
  /** HOM-06.2 §147: la bozza / il programmato / il fallito da riaprire (`draft_type` + `draft_id`). */
  draftRef?: ContentRef | null;
  /** HOM-10 §14, §16: l'originale da ripostare (`mode=repost`). Assente = composer Post normale. */
  reference?: RepostContentRef | null;
};

export type ComposerSource =
  | { status: "loading" }
  | { status: "error"; code: ComposerSubmitErrorKind; retry: () => void }
  | { status: "ready"; initialState: ComposerState };

/** `content_not_found` non migliora al secondo tentativo: niente attesa inutile (§259). */
function retryDraftFetch(count: number, error: unknown): boolean {
  return count < 1 && !(error instanceof PublishingRequestError && error.parsed.kind === "content_not_found");
}

/**
 * §18, §61, §146. `staleTime: 0` + `gcTime: 0`: ogni apertura legge dal server, così
 * la versione di Modifica (§160) e le identity (§28) non vengono da una cache vecchia.
 * HOM-06.2: con `draftRef` si legge anche la bozza (`fetch_content_for_editor`, §147–§148).
 */
export function usePostComposerSource(params: ComposerSourceParams): ComposerSource {
  // La chiave di idempotenza nasce con l'apertura (§118) e sopravvive ai tentativi.
  const [operationKey] = useState(newComposerOperationKey);
  // Quella del salvataggio bozza è un'altra operazione (§117): chiave propria per sessione.
  const [draftOperationKey] = useState(newComposerOperationKey);
  const { edit, identityHint, origin, userId } = params;
  const draftRef = edit ? null : (params.draftRef ?? null);

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

  const draftQuery = useQuery({
    enabled: userId.length > 0 && draftRef !== null,
    gcTime: 0,
    queryFn: () => fetchPostDraftForEditor(draftRef as ContentRef),
    queryKey: draftRef ? publishingKeys.editor(userId, draftRef) : [...publishingKeys.all, "editor", "none"],
    retry: retryDraftFetch,
    staleTime: 0,
  });

  // HOM-10 §14, §139–§141: l'originale viene dal link d'ingresso o dalla bozza riaperta.
  const draftReference = draftRef ? (draftQuery.data?.reference ?? null) : null;
  const repostRef: RepostContentRef | null = edit
    ? null
    : (params.reference ??
      (draftReference ? { contentId: draftReference.contentId, contentType: draftReference.contentType } : null));

  // Lo stato Repost si rilegge a ogni apertura (§35): le capability e `has_simple_repost` non vengono dalla cache.
  const repostQuery = useQuery({
    enabled: userId.length > 0 && repostRef !== null,
    queryFn: () => fetchRepostState(repostRef as RepostContentRef),
    queryKey: repostRef
      ? REPOST_QK.state(userId, repostRef.contentType, repostRef.contentId)
      : [...REPOST_QK.root, "none"],
    refetchOnMount: "always",
    retry: 1,
    staleTime: 0,
  });

  const failure =
    (edit ? editQuery.error : null) ?? (draftRef ? draftQuery.error : null) ?? context.error ?? repostQuery.error;

  if (failure) {
    return {
      code:
        failure instanceof PublishingRequestError ? failure.parsed.kind : parseComposerError(failure, edit ? "edit" : "publish"),
      retry: () => {
        void context.refetch();
        if (edit) {
          void editQuery.refetch();
        }
        if (draftRef) {
          void draftQuery.refetch();
        }
        if (repostRef) {
          void repostQuery.refetch();
        }
      },
      status: "error",
    };
  }

  if (
    !context.data ||
    (edit && !editQuery.data) ||
    (draftRef && !draftQuery.data) ||
    (repostRef && !repostQuery.data)
  ) {
    return { status: "loading" };
  }

  // HOM-10 §16: stesso editor, aperto sull'originale. La lista di «Reposta come» è quella del server
  // per il Repost (`can_repost`, §30), non quella del Post normale.
  if (repostRef && repostQuery.data) {
    const reference = composerReferenceFromState(repostRef, repostQuery.data);
    const identities = composerIdentitiesFromState(repostQuery.data);

    if (draftRef && draftQuery.data) {
      return {
        initialState: createDraftState({
          draft: { ...draftQuery.data, reference },
          draftOperationKey,
          identities,
          limits: context.data.limits,
          operationKey,
          origin,
          schedule: context.data.schedule,
        }),
        status: "ready",
      };
    }

    return {
      initialState: createComposerState({
        draftOperationKey,
        identities,
        // §28: l'identità della riga Condividi vince su quella di default dell'origin (profilo → persona).
        identity: hintFirstIdentity(identities, identityHint) ?? defaultIdentity(origin, identities, identityHint),
        limits: context.data.limits,
        operationKey,
        origin,
        reference,
        schedule: context.data.schedule,
      }),
      status: "ready",
    };
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

  if (draftRef && draftQuery.data) {
    return {
      initialState: createDraftState({
        draft: draftQuery.data,
        draftOperationKey,
        identities: context.data.identities,
        limits: context.data.limits,
        operationKey,
        origin,
        schedule: context.data.schedule,
      }),
      status: "ready",
    };
  }

  return {
    initialState: createComposerState({
      draftOperationKey,
      identities: context.data.identities,
      identity: defaultIdentity(origin, context.data.identities, identityHint),
      limits: context.data.limits,
      operationKey,
      origin,
      schedule: context.data.schedule,
    }),
    status: "ready",
  };
}

/* ------------------------------------------------------------------ */
/* Composer                                                            */
/* ------------------------------------------------------------------ */

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

/**
 * L'errore di una RPC di HOM-06.2 è già classificato (`PublishingRequestError`);
 * quello lanciato direttamente (rete caduta prima della risposta) passa dal
 * classificatore di HOM-06.1, che riconosce rete e SQLSTATE.
 */
function submitErrorKind(error: unknown, context: "publish" | "edit"): ComposerSubmitErrorKind {
  return error instanceof PublishingRequestError ? error.parsed.kind : parseComposerError(error, context);
}

function tagKey(identity: Pick<ComposerTaggedIdentity, "identityType" | "identityId">): string {
  return `${identity.identityType}:${identity.identityId}`;
}

/**
 * Esito di un invio riuscito (§207–§211). `publication` è ciò che è partito:
 * «Ora» → Post pubblicato (con «Visualizza»), data → «Post programmato per…»,
 * `keep` → «Salva» su un programmato.
 */
export type ComposerPublishedResult = {
  contentType: FeedContentType;
  contentId: string;
  status: "published" | "scheduled";
  scheduledAt: string | null;
  replayed: boolean;
  publication: Publication | "keep";
};

export type UsePostComposerOptions = {
  initialState: ComposerState;
  /** Utente autenticato: prefisso dello storage dei media e chiave del recovery. */
  userId: string;
  /** Profilo che possiede le query del Feed (`FEED_QK`). */
  profileId: string;
  onPublished: (result: ComposerPublishedResult, state: ComposerState) => void;
  onUpdated: (result: WireUpdatePostResult, state: ComposerState) => void;
  /**
   * HOM-10 §70–§71, §245: il Simple Repost è partito (ottimistico). Lo schermo chiude e torna
   * all'origine con il toast «Repost effettuato»; l'esito vero arriva dopo.
   */
  onSimpleReposted?: () => void;
  /** HOM-10 §72, §229: la chiamata è fallita (o l'originale è sparito); lo stato locale è già tornato indietro. */
  onSimpleRepostFailed?: (failure: SimpleRepostFailure) => void;
  /** HOM-10 §130: «Rimuovi repost» riuscito → toast «Repost rimosso». */
  onRepostRemoved?: () => void;
};

export function usePostComposer({
  initialState,
  userId,
  profileId,
  onPublished,
  onUpdated,
  onSimpleReposted,
  onSimpleRepostFailed,
  onRepostRemoved,
}: UsePostComposerOptions) {
  const queryClient = useQueryClient();
  const [store] = useState(() => createComposerStore(initialState));
  const state = useSyncExternalStore(store.subscribe, store.getState);
  // HOM-10 §16: stessa sessione, stessa modalità. La reference non cambia mai (§47), quindi vale per tutta la vita dell'hook.
  const isRepost = isRepostComposer(initialState);
  // §234: la chiave del Simple Repost è dell'azione, non di `operationKey` (che è del `submit_content`):
  // doppio tap e retry la riusano, e un invio con testo successivo non la sovrascrive.
  const [simpleRepostKey] = useState(newComposerOperationKey);
  const removingRef = useRef(false);
  const orphanDeletedRef = useRef(false);
  // §128–§131: finché «Rimuovi repost» è in volo «Reposta» non parte (due richieste senza ordine).
  const [removingRepost, setRemovingRepost] = useState(false);

  /* ---------------- bozza server e autosave (HOM-06.2 §116–§132) ---------------- */

  // Autosave sulla stessa riga dal primo contenuto significativo (§117–§118). La copia locale resta
  // `composer-recovery` (una sola, §125): `persistLocal: false`. Un programmato si salva solo con «Salva» (§167).
  const autosaveEnabled = state.mode.kind === "create" && !isEditingScheduled(state) && state.draft.status !== "publishing";
  const autosave = useAutosave({
    enabled: autosaveEnabled,
    format: "post",
    identity: state.identity ? { id: state.identity.id, type: state.identity.type } : null,
    initialRef: initialState.draft.ref,
    initialVersion: initialState.draft.version,
    operationKey: state.draft.operationKey,
    // Durante l'invio i salvataggi a timer si fermano (la bozza non nasce dopo il contenuto); `flush` resta valido.
    paused: state.publish.status === "publishing",
    payload: toDraftPayload(state),
    persistLocal: false,
    // HOM-10 §137, §338: nel Repost «significativo» è la regola del §62 (invisibili e token `@`/`https://` soli
    // inclusi), la stessa che decide Simple Repost vs Post: un body che la UI tratta da vuoto non crea bozze.
    significant:
      autosaveEnabled && (isRepost ? isSignificantRepostBody(state.body, state.mentions) : hasSavableContent(state)),
    snapshot: null,
    userId,
  });
  // Le funzioni asincrone sotto leggono sempre l'handle più recente, mai quello del render in cui sono nate.
  const autosaveRef = useRef(autosave);
  autosaveRef.current = autosave;

  // Una bozza riaperta parte «già salvata»: senza questo il primo render la riscriverebbe identica, bumpando la versione.
  useEffect(() => {
    const { ref, version } = store.getState().draft;

    if (ref && version !== null) {
      autosaveRef.current.adopt(ref, version);
    }
  }, [store]);

  const [notice, setNotice] = useState<string | null>(null);
  // HOM-08: stesso core per le mention dei commenti (`use-mention-autocomplete.ts`).
  const mentionAutocomplete = useMentionAutocomplete({ body: state.body, mentions: state.mentions, userId });
  const { selection, setSelection } = mentionAutocomplete;
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

    // HOM-10 §269: il Repost ha il suo evento di apertura; non è anche un «composer_open» di Post.
    if (opened.reference) {
      trackRepost({
        contentId: opened.reference.contentId,
        contentType: opened.reference.contentType,
        identityType: opened.identity?.type ?? null,
        name: "repost_composer_open",
        origin: opened.origin,
        source: opened.draft.ref ? "draft" : "entry",
      });
      return;
    }

    trackComposer({ identityType: opened.identity?.type ?? null, name: "composer_open", origin: opened.origin });
  }, [store]);

  useEffect(() => {
    // HOM-10: il composer Repost non ripristina la copia locale (è del Post normale) e non la scrive.
    if (store.getState().mode.kind !== "create" || isRepost) {
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

        // HOM-06.2 §121, §127: il crash riprende la STESSA bozza server, non ne crea una seconda.
        if (snapshot.draftRef && typeof snapshot.draftVersion === "number") {
          autosaveRef.current.adopt(snapshot.draftRef, snapshot.draftVersion);
        }
      }

      recoveryRef.current.ready = true;
    });

    return () => {
      cancelled = true;
    };
  }, [isRepost, store, userId]);

  // La bozza server (ref + versione) viaggia nello snapshot: è l'unica copia locale (§125). Un programmato non ne ha (§167).
  const savedRef = autosave.ref;
  const savedVersion = autosave.version;

  useEffect(() => {
    if (state.mode.kind !== "create" || isEditingScheduled(state)) {
      return;
    }

    const timer = setTimeout(() => {
      if (recoveryRef.current.ready && !recoveryRef.current.off) {
        void saveRecovery(
          userId,
          store.getState(),
          savedRef && savedVersion !== null ? { ref: savedRef, version: savedVersion } : null,
        );
      }
    }, RECOVERY_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state, store, userId, savedRef, savedVersion]);

  // §135: l'app in background non deve aspettare il debounce.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      const current = store.getState();

      if (
        next !== "active" &&
        current.mode.kind === "create" &&
        !isEditingScheduled(current) &&
        recoveryRef.current.ready &&
        !recoveryRef.current.off
      ) {
        const handle = autosaveRef.current;
        void saveRecovery(userId, current, handle.ref && handle.version !== null ? { ref: handle.ref, version: handle.version } : null);
      }
    });

    return () => subscription.remove();
  }, [store, userId]);

  /* ---------------- anteprima link (§73–98) ---------------- */

  // HOM-10 §97: nel Repost un URL resta testo cliccabile, senza una seconda rich card accanto all'originale.
  const linkTarget = isRepost ? null : linkFetchTarget(state);

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

  /* ---------------- analytics del Repost (§269–§271) ---------------- */

  const refType = state.reference?.contentType ?? null;
  const refId = state.reference?.contentId ?? null;
  const identityType = state.identity?.type ?? null;
  // §138: «testo iniziato» = il body è diventato significativo; mai il testo.
  const textStarted = isRepost && isSignificantRepostBody(state.body, state.mentions);
  const textTrackedRef = useRef(false);
  const linkDomain = isRepost ? domainOf(firstEligibleUrl(state.body)?.normalized ?? "") : null;
  const draftTrackedRef = useRef(initialState.draft.ref !== null);
  const hasDraftRef = autosave.ref !== null;

  useEffect(() => {
    if (textStarted && refType && refId && !textTrackedRef.current) {
      textTrackedRef.current = true;
      trackRepost({ contentId: refId, contentType: refType, identityType, name: "repost_text_started" });
    }
  }, [textStarted, refType, refId, identityType]);

  useEffect(() => {
    if (linkDomain) {
      trackRepost({ domain: linkDomain, name: "repost_link_added" });
    }
  }, [linkDomain]);

  // §137–§138: la bozza nasce al primo contenuto significativo, mai da un Simple Repost vuoto.
  useEffect(() => {
    if (isRepost && hasDraftRef && refType && refId && !draftTrackedRef.current) {
      draftTrackedRef.current = true;
      trackRepost({ contentId: refId, contentType: refType, identityType, name: "repost_draft_created" });
    }
  }, [hasDraftRef, identityType, isRepost, refId, refType]);

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

  // Query, debounce e candidati: `useMentionAutocomplete`, chiamato sopra.

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

      const current = store.getState();

      // HOM-10 §37, §155: nel Repost la lista e le capability sono quelle di `fetch_repost_state`
      // (can_repost, can_publish_post, has_simple_repost), e l'originale si rivalida.
      if (isRepostComposer(current) && current.reference) {
        const ref: RepostContentRef = { contentId: current.reference.contentId, contentType: current.reference.contentType };
        const repostState = await queryClient.fetchQuery({
          queryFn: () => fetchRepostState(ref),
          queryKey: REPOST_QK.state(userId, ref.contentType, ref.contentId),
          staleTime: 0,
        });

        store.dispatch({
          identities: composerIdentitiesFromState(repostState),
          limits: context.limits,
          schedule: context.schedule,
          type: "contextRefreshed",
        });
        store.dispatch({ reference: composerReferenceFromState(ref, repostState), type: "referenceRefreshed" });
        return;
      }

      store.dispatch({
        identities: context.identities,
        limits: context.limits,
        schedule: context.schedule,
        type: "contextRefreshed",
      });
    } catch {
      // Senza rete si resta sull'ultima lista nota: il server rivaluta comunque al publish (§30).
    }
  }

  function setBody(body: string) {
    store.dispatch({ body, type: "bodyChanged" });
  }

  /**
   * HOM-10 §17–§18, §94, §96: la toolbar del Repost inserisce `@` o `https://` alla selezione.
   * `@` apre l'autocomplete esistente (`mentionQueryAt`); non esiste un secondo selettore.
   * Il cursore va dopo il token, così digitare continua la mention o l'URL.
   */
  function insertToken(token: string) {
    const current = store.getState();
    const inserted = insertTokenAtSelection(current.body, selection, token);

    store.dispatch({ body: inserted.body, type: "bodyChanged" });
    setSelection({ end: inserted.cursor, start: inserted.cursor });
  }

  /** §26–29: cambia solo l'autore, poi si rivalidano le capability dalla lista del server. */
  function changeIdentity(identity: ComposerIdentity) {
    const previous = store.getState().identity;

    store.dispatch({ identityId: identity.id, type: "identityChanged" });

    const next = store.getState().identity;

    if (previous && next && (previous.id !== next.id || previous.type !== next.type)) {
      if (isRepost) {
        trackRepost({ from: previous.type, name: "repost_identity_changed", to: next.type });
      } else {
        trackComposer({ from: previous.type, name: "identity_changed", to: next.type });
      }
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
      if (isRepost) {
        trackRepost({ name: "repost_mention_added", targetType: candidate.identityType });
      } else {
        trackComposer({ name: "mention_added", targetType: candidate.identityType });
      }
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

  /**
   * §141, §205: «Elimina» e uscita a composer vuoto tolgono lo stato tecnico locale.
   * Un programmato non scrive mai la copia locale: non si cancella quella di un altro lavoro.
   */
  function discard() {
    recoveryRef.current.off = true;

    for (const item of store.getState().media) {
      uploaderRef.current?.cancel(item.localId);
    }

    // HOM-10: il composer Repost non ha una copia locale; quella che c'è è del Post normale e non si tocca.
    if (!isEditingScheduled(store.getState()) && !isRepost) {
      void clearRecovery(userId);
    }

    discardEmptiedRepostDraft();
  }

  /**
   * HOM-10 §137, §142, §338: il testo di un Repost è stato tolto dopo che l'autosave aveva già creato la bozza
   * (o la bozza riaperta è stata svuotata). Uscendo senza testo non resta nessuna bozza col vecchio testo:
   * si elimina secondo la policy HOM-06.2. Con del testo vale l'uscita a tre azioni, non questo ramo.
   * Fire-and-forget: un fallimento lascia la bozza in Bozze, eliminabile da lì.
   */
  function discardEmptiedRepostDraft() {
    const current = store.getState();
    const handle = autosaveRef.current;

    if (
      !isRepost ||
      isSignificantRepostBody(current.body, current.mentions) ||
      isEditingScheduled(current) ||
      orphanDeletedRef.current ||
      !handle.ref ||
      handle.version === null
    ) {
      return;
    }

    orphanDeletedRef.current = true;
    const target = { ref: handle.ref, version: handle.version };

    void (async () => {
      try {
        // Un body non significativo non salva (flush ritorna la versione nota): nessun salvataggio nuovo.
        const latest = (await handle.flush()) ?? target;
        await deleteContentDraft(latest.ref, latest.version);
      } catch {
        // La bozza resta in Bozze.
      }

      await handle.stop();
      invalidatePublishing();
    })();
  }

  /* ---------------- bozza: scelta di pubblicazione, uscita (§81–§102, §133–§136) ---------------- */

  /** Dopo ogni cambio sul server le liste Bozze/Programmati e i contatori del «+» si rileggono (§234). */
  function invalidatePublishing() {
    void queryClient.invalidateQueries({ queryKey: publishingKeys.lists(userId) });
    void queryClient.invalidateQueries({ queryKey: publishingKeys.launcher(userId) });
  }

  /** §86–§91: la scelta del foglio «Quando vuoi pubblicare?». */
  function setPublication(publication: Publication) {
    store.dispatch({ publication, type: "publicationChanged" });
    trackPublishing({ format: "post", name: publication.mode === "now" ? "schedule_now_selected" : "schedule_future_selected" });
  }

  /** Ref e versione più recenti della bozza server, dopo aver atteso ciò che era in sospeso (§121). */
  async function flushDraft(): Promise<{ ref: ContentRef; version: number } | null> {
    const saved = await autosaveRef.current.flush();

    if (saved) {
      return saved;
    }

    const handle = autosaveRef.current;
    return handle.ref && handle.version !== null ? { ref: handle.ref, version: handle.version } : null;
  }

  /**
   * §135 «Esci e conserva bozza»: salva e sincronizza. La copia locale cade solo se
   * il server ha tutto; con rete assente (§126) o upload non finiti resta e si
   * riprende alla prossima apertura (§127).
   */
  async function keepDraft(): Promise<void> {
    const saved = await autosaveRef.current.flush();
    const media = store.getState().media;

    if (saved && !hasUploadsInFlight(media) && !hasFailedMedia(media)) {
      recoveryRef.current.off = true;
      if (!isRepost) {
        await clearRecovery(userId);
      }
    }

    invalidatePublishing();
  }

  /**
   * §136 «Elimina bozza»: se esiste una bozza sul server la elimina secondo la sua
   * policy (soft delete), poi toglie la copia locale. `content_not_found` vale
   * «già eliminata». Con un altro errore la bozza resta e lo si dice (§233).
   */
  async function deleteDraft(): Promise<{ ok: true } | { ok: false; error: string }> {
    const handle = autosaveRef.current;
    let target = handle.ref && handle.version !== null ? { ref: handle.ref, version: handle.version } : null;

    if (target) {
      // La versione più recente: un salvataggio in volo l'avrebbe già spostata (§128).
      target = (await handle.flush()) ?? target;

      try {
        await deleteContentDraft(target.ref, target.version);
      } catch (error) {
        const kind = parsePublishingError(error instanceof PublishingRequestError ? error.cause : error).kind;

        if (kind !== "content_not_found") {
          return { error: publishingErrorCopy(kind, "post"), ok: false };
        }
      }

      trackPublishing({ format: "post", name: "draft_deleted" });
    }

    await handle.stop();
    discard();
    invalidatePublishing();
    return { ok: true };
  }

  /* ---------------- pubblicazione e salvataggio ---------------- */

  /** HOM-10 §269, §271: gli eventi del Post con testo, distinti da quelli del Simple Repost. */
  function referencedProps(snapshot: ComposerState) {
    return {
      contentId: snapshot.reference?.contentId ?? "",
      contentType: snapshot.reference?.contentType ?? ("profile_post" as FeedContentType),
      identityType: snapshot.identity?.type ?? null,
    };
  }

  async function submitCreate(started: ComposerState) {
    if (isRepost) {
      const intended = submitPublication(started);

      trackRepost({
        hasLink: firstEligibleUrl(started.body) !== null,
        mentionCount: started.mentions.length,
        name: "referenced_post_publish_attempt",
        scheduled: intended !== "keep" && intended.mode === "scheduled",
        ...referencedProps(started),
      });
    } else {
      trackComposer({ name: "publish_attempt", ...publishProps(started) });
    }

    // §68: i media ancora in coda partono; si attende la fine di quelli in volo.
    for (const item of started.media) {
      if (item.uploadStatus === "pending") {
        uploaderRef.current?.enqueue(item);
      }
    }
    await uploaderRef.current?.whenIdle();

    const latest = store.getState();

    // §70: un upload fallito (o rimasto indietro) ferma l'invio. Niente Post senza quel media.
    if (hasFailedMedia(latest.media) || hasUploadsInFlight(latest.media) || !latest.identity) {
      store.dispatch({ type: "publishReset" });
      return;
    }

    const { identity } = latest;
    const publication = submitPublication(latest);

    try {
      // §121: prima si salva ciò che è in attesa, così una bozza in creazione non si duplica.
      const saved = await flushDraft();
      const result = await submitContent({
        expectedVersion: saved?.version ?? null,
        format: "post",
        identityId: identity.id,
        identityType: identity.type,
        operationKey: latest.operationKey,
        origin: latest.origin,
        payload: toDraftContent(latest),
        publication,
        ref: saved?.ref ?? null,
      });

      recoveryRef.current.off = true;
      if (!isRepost) {
        void clearRecovery(userId);
      }
      await autosaveRef.current.stop();
      applyPublishToCaches(queryClient, { profileId });
      invalidatePublishing();
      if (isRepost) {
        // §271: l'esito tecnico «Post con reference» ha i suoi eventi; l'insight dell'originale si rilegge (§239).
        trackRepost({
          name: "referenced_post_publish_success",
          postContentType: result.ref.contentType,
          replayed: result.replayed,
          ...referencedProps(latest),
        });
        if (result.status === "scheduled") {
          trackRepost({ name: "referenced_post_scheduled", ...referencedProps(latest) });
        }
        if (latest.reference) {
          invalidateAfterRepostChange(queryClient, profileId, latest.reference);
        }
      } else {
        trackComposer({
          ...publishProps(latest),
          contentType: result.ref.contentType,
          name: "publish_success",
          replayed: result.replayed,
        });
      }
      if (result.status === "scheduled") {
        trackPublishing({ format: "post", identityType: identity.type, name: "schedule_confirmed" });
      }
      onPublished(
        {
          contentId: result.ref.contentId,
          contentType: result.ref.contentType,
          publication,
          replayed: result.replayed,
          scheduledAt: result.scheduledAt,
          status: result.status,
        },
        latest,
      );
    } catch (error) {
      const kind = submitErrorKind(error, "publish");
      // Per il composer «permesso perso» è una cosa sola, qualunque RPC l'abbia detta (§169–172).
      const code: ComposerSubmitErrorKind = kind === "content_permission_denied" ? "post_permission_denied" : kind;

      store.dispatch({ code, type: "publishFailed" });
      if (isRepost) {
        trackRepost({ code, name: "referenced_post_publish_failure", ...referencedProps(latest) });
      } else {
        trackComposer({ ...publishProps(latest), code, name: "publish_failure" });
      }

      // La chiave non è più riusabile: nuova chiave, contenuto intatto, l'utente riprova (§118).
      if (code === "post_operation_conflict" || code === "content_operation_conflict") {
        store.dispatch({ operationKey: newComposerOperationKey(), type: "operationKeyRotated" });
      }

      // §169–172, §37, §231: il permesso o l'originale sono cambiati → si rilegge, il testo resta (§230).
      if (code === "post_permission_denied" || isReferenceUnavailableCode(code)) {
        await refreshContext();
      }
    }
  }

  /**
   * HOM-10 §63, §70–§72, §126, §137: Simple Repost. Ottimistico: lo stato diventa «ripostato»
   * e lo schermo si chiude PRIMA della risposta (`onSimpleReposted`); l'esito arriva dopo e,
   * se negativo, `performSimpleRepost` ha già fatto il rollback e qui si dice perché (§72).
   * Nessuna bozza e nessun recovery: il body è vuoto (§137).
   */
  async function submitSimpleRepost(started: ComposerState) {
    const { identity, reference } = started;

    if (!identity || !reference) {
      store.dispatch({ type: "publishReset" });
      return;
    }

    // §137, §338: una bozza server nata da del testo poi cancellato (o riaperta da Bozze) non deve restare
    // dopo il Repost. Si attende l'eventuale salvataggio in volo PRIMA di chiudere, così la versione da
    // eliminare è quella giusta (senza, il CAS fallirebbe); senza bozza questo passo non costa nulla.
    const handle = autosaveRef.current;
    let draftTarget: { ref: ContentRef; version: number } | null = null;

    if (handle.ref && handle.version !== null) {
      draftTarget = (await handle.flush()) ?? { ref: handle.ref, version: handle.version };
    }

    recoveryRef.current.off = true;
    onSimpleReposted?.();

    const result = await performSimpleRepost({
      actor: { id: identity.id, type: identity.type },
      operationKey: simpleRepostKey,
      profileId,
      queryClient,
      ref: { contentId: reference.contentId, contentType: reference.contentType },
    });

    if (result.ok) {
      if (draftTarget) {
        try {
          await deleteContentDraft(draftTarget.ref, draftTarget.version);
        } catch {
          // Il Repost è fatto: una bozza che non si riesce a togliere resta in Bozze, eliminabile da lì.
        }
        invalidatePublishing();
      }
      return;
    }

    // Lo schermo può essere già chiuso: lo store è esterno, il reset è innocuo.
    store.dispatch({ type: "publishReset" });
    onSimpleRepostFailed?.(result.failure);
  }

  /**
   * HOM-10 §128–§131, §238: «Rimuovi repost», immediato e senza conferma. Il composer resta
   * aperto (il testo è ancora utilizzabile §125) e il flag torna a «non ripostato»; su errore
   * rollback e una riga di stato.
   */
  async function removeSimpleRepost() {
    const { identity, reference } = store.getState();

    if (!identity || !reference || removingRef.current) {
      return;
    }

    removingRef.current = true;
    setRemovingRepost(true);
    const actor = { id: identity.id, type: identity.type };

    store.dispatch({ identityId: actor.id, identityType: actor.type, type: "simpleRepostChanged", value: false });

    const result = await performRemoveRepost({
      actor,
      profileId,
      queryClient,
      ref: { contentId: reference.contentId, contentType: reference.contentType },
    });

    removingRef.current = false;
    setRemovingRepost(false);

    if (result.ok) {
      setNotice(null);
      onRepostRemoved?.();
      return;
    }

    store.dispatch({ identityId: actor.id, identityType: actor.type, type: "simpleRepostChanged", value: true });
    setNotice(REPOST_COMPOSER_COPY.removeFailed);
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
    // `removingRef` e non lo stato: il tap può arrivare prima del re-render.
    if (store.getState().publish.status === "publishing" || removingRef.current) {
      return;
    }

    store.dispatch({ type: "publishStarted" });

    const started = store.getState();

    if (started.publish.status !== "publishing") {
      return;
    }

    if (started.mode.kind === "edit") {
      await submitEdit(started);
    } else if (isRepost && repostIntent(started) === "simple") {
      // §61–§64: lo decide il body normalizzato; l'utente non vede la distinzione (§65).
      await submitSimpleRepost(started);
    } else {
      await submitCreate(started);
    }
  }

  const mentionState = { candidates: mentionAutocomplete.candidates, loading: mentionAutocomplete.loading };

  return {
    actions: {
      addMedia,
      changeIdentity,
      closeTagSheet,
      confirmTags,
      deleteDraft,
      discard,
      dismissLink,
      insertToken,
      keepDraft,
      moveMedia,
      openTagSheet,
      removeMedia,
      removeSimpleRepost,
      retryLink,
      retryMedia,
      selectMention,
      setBody,
      setNotice,
      setPublication,
      setSelection,
      setTagQuery,
      submit,
      toggleTag,
    },
    /** Stato discreto dell'autosave (§119–§120): `idle` in Modifica e per i programmati. */
    autosave: autosave.status,
    /** Una bozza server esiste già: «Elimina bozza» ha qualcosa da eliminare lì (§136). */
    hasServerDraft: autosave.ref !== null,
    isDirty: isDirty(state),
    mention: mentionState,
    notice,
    /** HOM-10: «Rimuovi repost» in corso → CTA chiusa e nessun invio. */
    removingRepost,
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
