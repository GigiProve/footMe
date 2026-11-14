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

import { DEFAULT_SCHEDULE_POLICY } from "../publishing/publishing-presentation";
import type { Publication, SchedulePolicy } from "../publishing/publishing-types";
import {
  baselineOf,
  canPublish,
  contentKey,
  firstEligibleUrl,
  applyMention,
  reconcileMentions,
  remainingMediaSlots,
  sameIdentity,
  type ComposerBaseline,
} from "./composer-presentation";
import type {
  ComposerDraftForEditor,
  ComposerDraftInfo,
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
  ComposerSubmitErrorKind,
  ComposerTaggedIdentity,
  ComposerTextRange,
} from "./composer-types";
import { newComposerOperationKey } from "./operation-key";

export type ComposerState = {
  mode: ComposerMode;
  origin: ComposerOrigin;
  /** Chiave di idempotenza dell'INVIO della sessione (§118): non cambia tra i tentativi. */
  operationKey: string;
  /**
   * HOM-06.2: legame con la bozza server (§117–§132). La chiave di salvataggio
   * bozza è distinta da `operationKey`: un retry del salvataggio e un retry
   * dell'invio sono due operazioni diverse.
   */
  draft: ComposerDraftInfo;
  /** HOM-06.2 §81–§102: «Ora» (default §87) o un istante futuro. */
  publication: Publication;
  /** HOM-06.2 §96: lead time e orizzonte dal server. */
  schedule: SchedulePolicy;
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
  /**
   * §28: rivalidazione delle capability. L'identity corrente non viene sostituita
   * da un'altra; se è ancora nell'elenco ne prende le capability aggiornate
   * (HOM-06.2: `canSchedule`).
   */
  | { type: "contextRefreshed"; identities: ComposerIdentity[]; limits: ComposerLimits; schedule?: SchedulePolicy }
  /** HOM-06.2 §86–§91: la scelta del foglio «Quando vuoi pubblicare?». */
  | { type: "publicationChanged"; publication: Publication }
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
  | { type: "publishFailed"; code: ComposerSubmitErrorKind }
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

/** Nessun legame con il server: contenuto nuovo (§117: la bozza nasce al primo salvataggio significativo). */
function newDraftInfo(operationKey: string | undefined): ComposerDraftInfo {
  return {
    baselineKey: null,
    initialPublication: null,
    operationKey: operationKey ?? newComposerOperationKey(),
    ref: null,
    status: null,
    version: null,
  };
}

export function createComposerState(input: {
  origin: ComposerOrigin;
  identities: ComposerIdentity[];
  limits: ComposerLimits;
  identity: ComposerIdentity | null;
  operationKey: string;
  /** HOM-06.2: assenti nei chiamanti di HOM-06.1 → default prudenti. */
  schedule?: SchedulePolicy;
  draftOperationKey?: string;
}): ComposerState {
  return {
    baseline: null,
    body: "",
    canEdit: true,
    dismissedUrls: [],
    draft: newDraftInfo(input.draftOperationKey),
    identities: input.identities,
    identity: input.identity,
    limits: input.limits,
    link: { status: "idle" },
    media: [],
    mentions: [],
    mode: { kind: "create" },
    operationKey: input.operationKey,
    origin: input.origin,
    publication: { mode: "now" },
    publish: { status: "idle" },
    schedule: input.schedule ?? DEFAULT_SCHEDULE_POLICY,
    tagged: [],
  };
}

/**
 * HOM-06.2 §147–§148, §163–§164: riapre una bozza, un programmato o un fallito
 * nello STESSO composer (nessun secondo editor, §83). A differenza della
 * Modifica di un pubblicato i media restano editabili (§112–§114).
 *
 *  • bozza / fallito — autosave sulla stessa riga; un fallito riparte da «Ora»
 *    se la data è passata (già deciso da `mapDraftForEditor`);
 *  • programmato — nessun autosave, «Salva» esplicito che non tocca la data se
 *    non la cambi (§166–§167): la chiave di base serve a sapere se è cambiato.
 *
 * L'identity è quella dell'elenco del server (capability fresche); se non c'è
 * più, resta quella della bozza e `publishBlockReason` dice che il permesso è
 * perso, senza trasferire l'ownership (§231).
 */
export function createDraftState(input: {
  draft: ComposerDraftForEditor;
  identities: ComposerIdentity[];
  limits: ComposerLimits;
  schedule: SchedulePolicy;
  operationKey: string;
  draftOperationKey?: string;
  origin: ComposerOrigin;
}): ComposerState {
  const { draft } = input;
  const identity = input.identities.find((candidate) => sameIdentity(candidate, draft.identity)) ?? draft.identity;
  const scheduled = draft.status === "scheduled";
  const stored = draft.hadLinkWithoutPreview ? firstEligibleUrl(draft.body) : null;

  const state: ComposerState = {
    baseline: null,
    body: draft.body,
    canEdit: draft.canEdit,
    dismissedUrls: stored ? [stored.normalized] : [],
    draft: {
      ...newDraftInfo(input.draftOperationKey),
      initialPublication: draft.publication,
      ref: draft.ref,
      status: draft.status,
      version: draft.version,
    },
    identities: input.identities,
    identity,
    limits: input.limits,
    link: draft.link ?? { status: "idle" },
    media: draft.media,
    mentions: draft.mentions,
    mode: { kind: "create" },
    operationKey: input.operationKey,
    origin: input.origin,
    // Un programmato conserva la propria data anche se l'identity ha perso la capability (§190): non si riscrive da sola.
    publication: scheduled || identity.canSchedule ? draft.publication : { mode: "now" },
    publish: { status: "idle" },
    schedule: input.schedule,
    tagged: draft.tagged,
  };

  return scheduled ? { ...state, draft: { ...state.draft, baselineKey: contentKey(state) } } : state;
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
    // Un Post pubblicato non ha bozza né programmazione: si salva solo con `update_post` (HOM-06.1).
    draft: newDraftInfo(undefined),
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
    publication: { mode: "now" },
    publish: { status: "idle" },
    schedule: DEFAULT_SCHEDULE_POLICY,
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

      if (!isCreate(state) || !next || state.draft.status === "scheduled" || state.draft.status === "publishing") {
        return state;
      }

      // §27: solo l'autore cambia; l'esito dell'invio precedente non vale più (§28).
      // §85: senza `can_schedule_content` non c'è programmazione, si torna a «Ora».
      return {
        ...state,
        identity: next,
        publication: next.canSchedule ? state.publication : { mode: "now" },
        publish: { status: "idle" },
      };
    }

    case "contextRefreshed": {
      const schedule = action.schedule ?? state.schedule;

      if (!isCreate(state)) {
        return { ...state, limits: action.limits, schedule };
      }

      // L'identity corrente non cambia: se è ancora in elenco ne prende le capability fresche (§28).
      const refreshed = state.identity
        ? action.identities.find((candidate) => sameIdentity(candidate, state.identity))
        : undefined;
      const identity = refreshed ?? state.identity;
      // Un programmato non perde la sua data se la capability sparisce (§190): lo dice il server al Salva.
      const keepsPublication = state.draft.status === "scheduled" || identity?.canSchedule === true;

      return {
        ...state,
        identities: action.identities,
        identity,
        limits: action.limits,
        publication: keepsPublication ? state.publication : { mode: "now" },
        schedule,
      };
    }

    case "publicationChanged": {
      // Solo in creazione/bozza e solo con la capability (§84–§85).
      if (!isCreate(state) || state.publish.status === "publishing" || !state.identity?.canSchedule) {
        return state;
      }

      return {
        ...state,
        publication: action.publication,
        publish: state.publish.status === "failed" ? { status: "idle" } : state.publish,
      };
    }

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

      // HOM-06.2: la data salvata vale solo se l'identity può ancora programmare e l'istante è futuro (§85, §98).
      const savedPublication = snapshot.publication;
      const publication: Publication =
        savedPublication?.mode === "scheduled" &&
        identity?.canSchedule === true &&
        new Date(savedPublication.scheduledAt).getTime() > Date.now()
          ? savedPublication
          : { mode: "now" };

      return {
        ...state,
        body,
        dismissedUrls: snapshot.dismissedUrls,
        // Una bozza server riprende la STESSA riga e le STESSE chiavi: un crash non ne crea una seconda (§121, §127).
        draft: {
          ...state.draft,
          operationKey: snapshot.draftOperationKey ?? state.draft.operationKey,
          ref: snapshot.draftRef ?? null,
          status: snapshot.draftRef ? "draft" : null,
          version: snapshot.draftRef ? (snapshot.draftVersion ?? null) : null,
        },
        identity,
        media: restoreMedia(snapshot.media, state.limits.maxMedia),
        mentions: snapshot.mentions.filter(
          (mention) => body.slice(mention.start, mention.end) === `@${mention.displayName}`,
        ),
        operationKey: snapshot.operationKey,
        publication,
        tagged: dedupeTagged(snapshot.tagged, state.limits.maxTags),
      };
    }
  }
}
