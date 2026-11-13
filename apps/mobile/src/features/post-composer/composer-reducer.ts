/**
 * Stato e reducer puri del composer Post (HOM-06.1 §26–27, §59–60, §93, §119,
 * §134, §144–153).
 *
 * UN SOLO reducer per Nuovo post e Modifica (§144: niente PostEditor separato).
 * La modalità cambia ciò che le azioni possono fare, non la forma dello stato:
 *  • create — identity cambiabile (§26), media gestibili (§59, §55);
 *  • edit   — identity fissa (§147), media in sola lettura (§148–153): le azioni
 *             sui media sono ignorate, non nascoste dalla UI e basta.
 *
 * Invarianti:
 *  • cambiare identity non tocca testo, mention, tag, media, link (§27);
 *  • togliere un media non chiede conferma e non tocca gli altri (§60, §224);
 *  • una mention il cui intervallo viene toccato dal testo cade (§209);
 *  • dopo una X esplicita la preview di quell'URL non rigenera (§93);
 *  • `publishStarted` è idempotente: il secondo invio non esiste (§119).
 *
 * Il flag «dirty» non è nello stato: è derivato (`isDirty` in
 * composer-presentation.ts) perché dipende dal confronto con quanto caricato.
 */

import {
  baselineOf,
  canPublish,
  firstEligibleUrl,
  applyMention,
  reconcileMentions,
  remainingMediaSlots,
  type ComposerBaseline,
} from "./composer-presentation";
import type {
  ComposerErrorKind,
  ComposerIdentity,
  ComposerLimits,
  ComposerLinkPreviewState,
  ComposerMediaItem,
  ComposerMention,
  ComposerMentionCandidate,
  ComposerMode,
  ComposerOrigin,
  ComposerPostForEdit,
  ComposerPublishStatus,
  ComposerRecoverySnapshot,
  ComposerTaggedIdentity,
  ComposerTextRange,
} from "./composer-types";

export type ComposerState = {
  mode: ComposerMode;
  origin: ComposerOrigin;
  /** Chiave di idempotenza della sessione (§118): non cambia tra i tentativi. */
  operationKey: string;
  identity: ComposerIdentity | null;
  /** Solo identity con can_publish_post (§18); in Modifica la sola autrice. */
  identities: ComposerIdentity[];
  limits: ComposerLimits;
  /** `can_edit` letto da `fetch_post_for_edit`; in creazione sempre true. */
  canEdit: boolean;
  body: string;
  mentions: ComposerMention[];
  tagged: ComposerTaggedIdentity[];
  media: ComposerMediaItem[];
  link: ComposerLinkPreviewState;
  /** §93: URL normalizzati la cui preview l'utente ha rimosso. */
  dismissedUrls: string[];
  publish: ComposerPublishStatus;
  /** Solo Modifica: cosa c'era all'apertura, per Salva (§158) e Annulla (§138). */
  baseline: ComposerBaseline | null;
};

/** I campi che l'upload può aggiornare su un item. */
export type ComposerUploadPatch = Partial<
  Pick<
    ComposerMediaItem,
    "uploadStatus" | "uploadProgress" | "storagePath" | "remoteUrl" | "errorCode" | "thumbnailUri"
  >
>;

export type ComposerAction =
  | { type: "identityChanged"; identityId: string }
  /** §28: rivalidazione delle capability; l'identity corrente non viene sostituita. */
  | { type: "contextRefreshed"; identities: ComposerIdentity[]; limits: ComposerLimits }
  | { type: "bodyChanged"; body: string }
  | { type: "mentionApplied"; range: ComposerTextRange; candidate: ComposerMentionCandidate }
  /** La selezione completa del selector Tagga (§104, §108), non un delta. */
  | { type: "taggedChanged"; tagged: ComposerTaggedIdentity[] }
  | { type: "mediaAdded"; items: ComposerMediaItem[] }
  | { type: "mediaRemoved"; localId: string }
  /** §58: alternativa accessibile al drag. -1 = «Sposta prima», +1 = «Sposta dopo». */
  | { type: "mediaMoved"; localId: string; by: -1 | 1 }
  /** §55: long press + drag. */
  | { type: "mediaMovedTo"; localId: string; toIndex: number }
  | { type: "mediaUploadUpdated"; localId: string; patch: ComposerUploadPatch }
  /** §72: agisce solo sull'item fallito. */
  | { type: "mediaRetried"; localId: string }
  | { type: "linkLoading"; url: string }
  /** Scartata se nel frattempo l'URL è cambiato (risposta in ritardo). */
  | { type: "linkResolved"; url: string; result: ComposerLinkPreviewState }
  | { type: "linkRetried" }
  | { type: "linkDismissed" }
  | { type: "publishStarted" }
  | { type: "publishFailed"; code: ComposerErrorKind }
  | { type: "publishReset" }
  /**
   * `post_operation_conflict`: la chiave non è più utilizzabile (stesso key con
   * altro payload, o post replayed non più pubblicato). Se ne usa una nuova e il
   * contenuto resta intatto (§118, §174).
   */
  | { type: "operationKeyRotated"; operationKey: string }
  | { type: "restored"; snapshot: ComposerRecoverySnapshot };

/* ------------------------------------------------------------------ */
/* Creazione dello stato                                               */
/* ------------------------------------------------------------------ */

export function createComposerState(input: {
  origin: ComposerOrigin;
  identities: ComposerIdentity[];
  limits: ComposerLimits;
  identity: ComposerIdentity | null;
  operationKey: string;
}): ComposerState {
  return {
    baseline: null,
    body: "",
    canEdit: true,
    dismissedUrls: [],
    identities: input.identities,
    identity: input.identity,
    limits: input.limits,
    link: { status: "idle" },
    media: [],
    mentions: [],
    mode: { kind: "create" },
    operationKey: input.operationKey,
    origin: input.origin,
    publish: { status: "idle" },
    tagged: [],
  };
}

/** §146: precarica identity, testo, mention, tag, link e media pubblicati (sola lettura). */
export function createEditState(input: {
  edit: ComposerPostForEdit;
  limits: ComposerLimits;
  operationKey: string;
  origin?: ComposerOrigin;
}): ComposerState {
  const { edit } = input;
  const link = edit.link ?? ({ status: "idle" } as const);

  // §93, §156–157: un URL già nel Post ma senza anteprima salvata non deve
  // rigenerarla da solo all'apertura (né rendere attivo «Salva» da un'anteprima
  // appena arrivata): per quell'URL vale come se l'utente l'avesse rimossa. Un URL
  // diverso, digitato dopo, può generarne una nuova.
  const stored = edit.link ? null : firstEligibleUrl(edit.body);

  return {
    baseline: baselineOf({
      body: edit.body,
      hadPreview: edit.link !== null,
      linkUrl: edit.link?.url ?? null,
      mentions: edit.mentions,
      snapshotId: edit.link?.snapshotId ?? null,
      tagged: edit.tagged,
    }),
    body: edit.body,
    canEdit: edit.canEdit,
    dismissedUrls: stored ? [stored.normalized] : [],
    identities: [edit.author],
    identity: edit.author,
    limits: input.limits,
    link,
    media: edit.media,
    mentions: edit.mentions,
    mode: {
      contentId: edit.contentId,
      contentType: edit.contentType,
      expectedVersion: edit.version,
      kind: "edit",
    },
    operationKey: input.operationKey,
    origin: input.origin ?? "CONTENT_DETAIL",
    publish: { status: "idle" },
    tagged: edit.tagged,
  };
}

/* ------------------------------------------------------------------ */
/* Helper                                                              */
/* ------------------------------------------------------------------ */

function isCreate(state: ComposerState): boolean {
  return state.mode.kind === "create";
}

function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const target = Math.min(Math.max(to, 0), list.length - 1);

  if (from < 0 || from === target) {
    return [...list];
  }

  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

function updateMedia(
  state: ComposerState,
  localId: string,
  change: (item: ComposerMediaItem) => ComposerMediaItem,
): ComposerState {
  if (!isCreate(state) || !state.media.some((item) => item.localId === localId)) {
    return state;
  }

  return {
    ...state,
    media: state.media.map((item) => (item.localId === localId ? change(item) : item)),
  };
}

/** §156–157: la preview non sopravvive a un URL cambiato o sparito. */
function dropStaleLink(state: ComposerState): ComposerState {
  if (state.link.status === "idle") {
    return state;
  }

  const first = firstEligibleUrl(state.body);

  return first && first.normalized === state.link.url ? state : { ...state, link: { status: "idle" } };
}

function dedupeTagged(tagged: readonly ComposerTaggedIdentity[], max: number): ComposerTaggedIdentity[] {
  const seen = new Set<string>();
  const out: ComposerTaggedIdentity[] = [];

  for (const identity of tagged) {
    const key = `${identity.identityType}:${identity.identityId}`;

    if (!seen.has(key) && out.length < max) {
      seen.add(key);
      out.push(identity);
    }
  }

  return out;
}

/** Un upload non finito non sopravvive al riavvio: torna in coda (§135, §178). */
function restoreMedia(items: readonly ComposerMediaItem[], max: number): ComposerMediaItem[] {
  return items.slice(0, max).map((item) =>
    item.uploadStatus === "uploading"
      ? { ...item, uploadProgress: null, uploadStatus: "pending" as const }
      : item,
  );
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

export function composerReducer(state: ComposerState, action: ComposerAction): ComposerState {
  switch (action.type) {
    case "identityChanged": {
      const next = state.identities.find((identity) => identity.id === action.identityId);

      if (!isCreate(state) || !next) {
        return state;
      }

      // §27: solo l'autore cambia; l'esito dell'invio precedente non vale più (§28).
      return { ...state, identity: next, publish: { status: "idle" } };
    }

    case "contextRefreshed":
      return isCreate(state)
        ? { ...state, identities: action.identities, limits: action.limits }
        : { ...state, limits: action.limits };

    case "bodyChanged": {
      const body = action.body.slice(0, state.limits.maxBodyLength);

      if (body === state.body) {
        return state;
      }

      return dropStaleLink({
        ...state,
        body,
        mentions: reconcileMentions(state.body, body, state.mentions),
        publish: state.publish.status === "failed" ? { status: "idle" } : state.publish,
      });
    }

    case "mentionApplied": {
      if (state.mentions.length >= state.limits.maxMentions) {
        return state;
      }

      const result = applyMention(state.body, state.mentions, action.range, action.candidate);

      if (result.body.length > state.limits.maxBodyLength) {
        return state;
      }

      return dropStaleLink({ ...state, body: result.body, mentions: result.mentions });
    }

    case "taggedChanged":
      return { ...state, tagged: dedupeTagged(action.tagged, state.limits.maxTags) };

    case "mediaAdded": {
      if (!isCreate(state)) {
        return state;
      }

      // §61: il tetto è del server; qui è solo l'ultima difesa dopo `selectPickedAssets`.
      const items = action.items.slice(0, remainingMediaSlots(state));
      return items.length === 0 ? state : { ...state, media: [...state.media, ...items] };
    }

    case "mediaRemoved":
      // §59–60: nessuna conferma; gli altri item restano com'erano (§224).
      return isCreate(state)
        ? { ...state, media: state.media.filter((item) => item.localId !== action.localId) }
        : state;

    case "mediaMoved": {
      if (!isCreate(state)) {
        return state;
      }

      const from = state.media.findIndex((item) => item.localId === action.localId);
      return from < 0 ? state : { ...state, media: moveItem(state.media, from, from + action.by) };
    }

    case "mediaMovedTo": {
      if (!isCreate(state)) {
        return state;
      }

      const from = state.media.findIndex((item) => item.localId === action.localId);
      return from < 0 ? state : { ...state, media: moveItem(state.media, from, action.toIndex) };
    }

    case "mediaUploadUpdated":
      return updateMedia(state, action.localId, (item) => ({ ...item, ...action.patch }));

    case "mediaRetried":
      return updateMedia(state, action.localId, (item) =>
        item.uploadStatus === "failed"
          ? { ...item, errorCode: null, uploadProgress: null, uploadStatus: "pending" }
          : item,
      );

    case "linkLoading":
      return { ...state, link: { status: "loading", url: action.url } };

    case "linkResolved":
      return state.link.status === "loading" && state.link.url === action.url
        ? { ...state, link: action.result }
        : state;

    case "linkRetried":
      return state.link.status === "failed" && state.link.retryable
        ? { ...state, link: { status: "loading", url: state.link.url } }
        : state;

    case "linkDismissed": {
      if (state.link.status === "idle") {
        return state;
      }

      const url = state.link.url;
      return {
        ...state,
        dismissedUrls: state.dismissedUrls.includes(url) ? state.dismissedUrls : [...state.dismissedUrls, url],
        link: { status: "idle" },
      };
    }

    case "publishStarted":
      // §119: solo dal primo tap valido; con un invio già in corso non cambia nulla.
      return state.publish.status === "publishing" || !canPublish(state)
        ? state
        : { ...state, publish: { status: "publishing" } };

    case "publishFailed":
      // §174: il contenuto resta intatto, cambia solo l'esito.
      return { ...state, publish: { code: action.code, status: "failed" } };

    case "publishReset":
      return { ...state, publish: { status: "idle" } };

    case "operationKeyRotated":
      return state.mode.kind === "create" ? { ...state, operationKey: action.operationKey } : state;

    case "restored": {
      if (!isCreate(state)) {
        return state;
      }

      const { snapshot } = action;
      const identity =
        state.identities.find(
          (candidate) => candidate.id === snapshot.identityId && candidate.type === snapshot.identityType,
        ) ?? state.identity;
      const body = snapshot.body.slice(0, state.limits.maxBodyLength);

      return {
        ...state,
        body,
        dismissedUrls: snapshot.dismissedUrls,
        identity,
        media: restoreMedia(snapshot.media, state.limits.maxMedia),
        mentions: snapshot.mentions.filter(
          (mention) => body.slice(mention.start, mention.end) === `@${mention.displayName}`,
        ),
        operationKey: snapshot.operationKey,
        tagged: dedupeTagged(snapshot.tagged, state.limits.maxTags),
      };
    }
  }
}
