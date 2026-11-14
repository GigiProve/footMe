/**
 * Apertura di una sessione dell'editor Articolo (HOM-06.2 §7A, §7E, §7F, §7O,
 * §21–§23, §125–§127, §147–§148, §165, §217).
 *
 * Carica ciò che serve per APRIRE — il contesto con identity, modalità e limiti
 * (§16, §34), la bozza o l'Articolo da riaprire (§147), la copia locale — e ne
 * produce lo stato iniziale. Non scrive nulla sul server: un editor aperto non
 * crea una bozza (§118); nasce al primo contenuto significativo (autosave).
 *
 *  • `staleTime/gcTime: 0` e nessun refetch in background: ogni apertura legge dal
 *    server (versione e capability aggiornate) ma una lettura che fallisce DOPO
 *    l'apertura non deve smontare l'editor con il testo dentro. Per lo stesso
 *    motivo il risultato si congela alla prima volta che è pronto;
 *  • handoff (`handoff=1`): «Importa nell'editor» e il cambio modalità portano
 *    avanti la sessione già nello store — qui non c'è nulla da caricare;
 *  • copia locale (§127–§128): vince sul server solo se ha modifiche non
 *    sincronizzate fatte sulla versione che il server ha ancora.
 */

import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { newComposerOperationKey } from "../post-composer/operation-key";
import { localDraftKey, readLocalDraft, shouldRestoreLocal } from "../publishing/draft-local-store";
import { publishingKeys } from "../publishing/publishing-keys";
import { fetchContentForEditor, parsePublishingError, PublishingRequestError } from "../publishing/publishing-service";
import type { ArticleCreationMode, ContentRef, PublishingErrorKind } from "../publishing/publishing-types";
import { articleKeys } from "./article-keys";
import { identitiesForMode } from "./article-presentation";
import type { ArticleRouteParams } from "./article-routes";
import { fetchArticleComposerContext, mapArticleEditorPayload } from "./article-service";
import {
  applyLocalSnapshot,
  articleStore,
  createFreshInit,
  createLoadedInit,
  isRestorableSnapshot,
  loadedBlockedKind,
  type ArticleInit,
  type ArticleLocalSnapshot,
  type SessionIds,
} from "./article-store";
import type { WireArticleEditorPayload } from "./article-types";

export type ArticleSourceKind = "editor" | "link" | "paste";

export type ArticleSource =
  | { status: "loading" }
  | { status: "error"; kind: PublishingErrorKind; retry: () => void }
  /** `init` null = handoff: la sessione è già nello store. */
  | { status: "ready"; init: ArticleInit | null };

const NO_REF: ContentRef = { contentId: "", contentType: "profile_post" };

function modeForKind(kind: ArticleSourceKind, params: ArticleRouteParams): ArticleCreationMode {
  if (kind === "link") return "external_link";
  if (kind === "paste") return "imported_text";
  return params.mode === "imported_text" ? "imported_text" : "native";
}

/** Una copia locale di una versione precedente dell'app non deve far cadere l'editor. */
function isUsableSnapshot(snapshot: unknown): snapshot is ArticleLocalSnapshot {
  const value = snapshot as Partial<ArticleLocalSnapshot> | null;
  return Boolean(value) && Array.isArray(value?.lines) && typeof value?.mode === "string" && Array.isArray(value?.tagged);
}

export function useArticleSource(input: { userId: string; kind: ArticleSourceKind; params: ArticleRouteParams }): ArticleSource {
  const { userId, kind, params } = input;
  const draftRef = params.draftRef;
  const mode = modeForKind(kind, params);

  const [ids] = useState<SessionIds>(() => ({
    operation: newComposerOperationKey(),
    session: newComposerOperationKey(),
    submit: newComposerOperationKey(),
  }));
  // Letto una volta all'apertura: la sessione nello store non cambia l'esito mentre la schermata è montata.
  const [handoff] = useState(() => params.handoff && articleStore.getState().session !== null);
  const frozen = useRef<ArticleInit | null | undefined>(undefined);

  const enabled = userId.length > 0 && !handoff;
  const quiet = { gcTime: 0, refetchOnReconnect: false, refetchOnWindowFocus: false, staleTime: 0 } as const;

  const context = useQuery({
    ...quiet,
    enabled,
    queryFn: fetchArticleComposerContext,
    queryKey: articleKeys.context(userId),
    retry: 1,
  });

  const draft = useQuery({
    ...quiet,
    enabled: enabled && draftRef !== null,
    queryFn: async () => {
      const wire = await fetchContentForEditor<WireArticleEditorPayload>(draftRef ?? NO_REF);
      // Un ref di Post (o un contenuto che non è un Articolo) non si apre nell'editor Articolo.
      if (wire.format !== "article" || !wire.article) {
        throw new PublishingRequestError(new Error("content_not_found"));
      }
      return { loaded: mapArticleEditorPayload(wire), updatedAt: wire.updated_at };
    },
    queryKey: publishingKeys.editor(userId, draftRef ?? NO_REF),
    retry: 1,
  });

  const localScope = draftRef ? `${draftRef.contentType}:${draftRef.contentId}` : "new";
  const local = useQuery({
    ...quiet,
    enabled: enabled && kind !== "paste",
    queryFn: () => readLocalDraft<ArticleLocalSnapshot>(localDraftKey(userId, "article", draftRef)),
    queryKey: articleKeys.local(userId, localScope),
    retry: false,
  });

  if (frozen.current !== undefined) {
    return { init: frozen.current, status: "ready" };
  }
  if (handoff) {
    frozen.current = null;
    return { init: null, status: "ready" };
  }

  const retry = () => {
    void context.refetch();
    if (draftRef) void draft.refetch();
  };

  const failure = draft.error ?? context.error;
  if (failure) {
    return { kind: parsePublishingError(failure).kind, retry, status: "error" };
  }
  if (!context.data || (draftRef && !draft.data) || (kind !== "paste" && local.data === undefined)) {
    return { status: "loading" };
  }

  const base = {
    identities: context.data.identities,
    ids,
    limits: context.data.limits,
    origin: params.origin,
    schedulePolicy: context.data.schedule,
  };
  const snapshot = isUsableSnapshot(local.data?.snapshot) ? local.data : null;

  let init: ArticleInit;
  if (draft.data) {
    const blocked = loadedBlockedKind(draft.data.loaded);
    if (blocked) {
      return { kind: blocked, retry, status: "error" };
    }
    init = createLoadedInit({ ...base, loaded: draft.data.loaded });
    if (snapshot && shouldRestoreLocal(snapshot, { updatedAt: draft.data.updatedAt, version: draft.data.loaded.version })) {
      init = applyLocalSnapshot(init, snapshot.snapshot);
    }
  } else {
    if (identitiesForMode(base.identities, mode).length === 0) {
      return { kind: "article_mode_not_allowed", retry, status: "error" };
    }
    init = createFreshInit({ ...base, contextualIdentityId: params.identityId, mode });
    if (snapshot && isRestorableSnapshot(snapshot.snapshot)) {
      init = applyLocalSnapshot(init, snapshot.snapshot, snapshot.operationKey);
    }
  }

  frozen.current = init;
  return { init, status: "ready" };
}
