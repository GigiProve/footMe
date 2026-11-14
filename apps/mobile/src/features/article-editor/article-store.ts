/**
 * Store condiviso dell'editor Articolo (HOM-06.2 §7E, §7F, §7O, §7T, §7X, §24–§27,
 * §72–§80, §118, §224–§227).
 *
 * Perché uno store di modulo e non lo stato di una schermata: l'Articolo vive su
 * più route — selector, editor, «Collega da un link», «Incolla un articolo»,
 * Anteprima — e queste devono vedere lo STESSO contenuto: «Importa nell'editor»
 * consegna il documento all'editor (§7T), l'Anteprima mostra ciò che l'editor ha
 * (§73), il cambio modalità conserva identity, tag e bozza (§7X). Stesso schema di
 * `post-composer/composer-store.ts` (stato esterno letto con
 * `useSyncExternalStore`, `getState()` sempre attuale dopo ogni `await`).
 *
 * Regole che il reducer porta con sé:
 *  • cambio identity (§24–§25): non si perde nulla; la conferma dei diritti si
 *    azzera quando serve riconfermarla (§7Q); una pubblicazione programmata
 *    torna a «Ora» se la nuova identity non può programmare;
 *  • cambio modalità (§7X): solo ciò che è incompatibile con la nuova modalità
 *    viene tolto, mai in silenzio (lo spiega `modeSwitchLosses` al chiamante);
 *  • modifica di un Articolo pubblicato o programmato (§224–§227): nessun
 *    autosave sul server, `contentSignature` dice se c'è qualcosa da perdere.
 *
 * Il file è puro (niente React, rete o storage): è ciò che si prova in
 * `article-store.test.ts`. I flussi asincroni stanno in `use-article-editor.ts`.
 */

import type { ComposerTaggedIdentity } from "../post-composer/composer-types";
import { primaryCtaLabel } from "../publishing/publishing-presentation";
import type {
  ArticleCreationMode,
  ContentLifecycleState,
  ContentRef,
  Publication,
  PublishingErrorKind,
  SchedulePolicy,
} from "../publishing/publishing-types";
import { documentToLines, emptyTextLine, linesToDocument } from "./article-document";
import {
  articleBlocker,
  defaultIdentityId,
  EMPTY_PROVENANCE,
  identitiesForMode,
  isSignificantArticle,
  modeChangeLosses,
  rightsNeedReconfirm,
  type ArticleBlocker,
  type ArticleDraftState,
  type ExternalSourceState,
} from "./article-presentation";
import type { ArticleRouteParams } from "./article-routes";
import type { ArticleIdentity, LoadedArticle } from "./article-service";
import {
  DEFAULT_ARTICLE_LIMITS,
  type ArticleCover,
  type ArticleDocument,
  type ArticleLimits,
  type ArticleProvenance,
  type EditorLine,
  type RichLinkPreview,
} from "./article-types";

/* ------------------------------------------------------------------ */
/* Stato                                                               */
/* ------------------------------------------------------------------ */

/** Il contenuto dell'articolo: ciò che si salva, si anteprima e si pubblica. */
export type ArticleContentState = {
  identityId: string | null;
  mode: ArticleCreationMode;
  title: string;
  /** external_link: titolo scritto a mano quando i metadata non l'hanno (§7J). */
  manualTitle: string;
  cover: ArticleCover | null;
  lines: EditorLine[];
  tagged: ComposerTaggedIdentity[];
  source: ExternalSourceState;
  provenance: ArticleProvenance;
  rightsConfirmed: boolean;
  publication: Publication;
};

/** Una sessione di editor: una bozza in lavorazione, dall'apertura all'uscita. */
export type ArticleSession = {
  id: string;
  origin: ArticleRouteParams["origin"];
  /** Chiave di idempotenza dell'autosave (§117, §121): una per sessione, sopravvive ai retry. */
  operationKey: string;
  /** Chiave di idempotenza dell'invio: separata da quella dell'autosave. */
  submitKey: string;
  /** La riga del server, quando esiste (bozza riaperta o primo autosave riuscito). */
  ref: ContentRef | null;
  version: number | null;
  /** Stato server alla riapertura; null per un articolo nuovo. */
  loadedStatus: ContentLifecycleState | null;
  /** Modifica con «Salva» esplicito (§224–§227, §165–§167): nessun autosave sul server. */
  editing: "published" | "scheduled" | null;
  loadedPublication: Publication | null;
  /** URL della fonte alla riapertura: cambiarlo su un pubblicato chiede conferma (§219). */
  loadedSourceUrl: string | null;
  /** Il testo era dichiarato «già pubblicato altrove»: in modifica l'attribuzione non si toglie (§219, §7U). */
  loadedElsewhere: boolean;
  /** Firma del contenuto all'apertura: serve a sapere se c'è qualcosa da perdere. */
  baseline: string;
  restored: boolean;
};

export type PublishState = {
  status: "idle" | "submitting";
  error: PublishingErrorKind | null;
  /** Solo `article_duplicate` (§7M): l'articolo già collegato, per «Visualizza articolo». */
  duplicateRef: ContentRef | null;
};

export type ArticleStoreState = ArticleContentState & {
  session: ArticleSession | null;
  identities: ArticleIdentity[];
  limits: ArticleLimits;
  schedulePolicy: SchedulePolicy;
  publish: PublishState;
  /** Invio riuscito: le schermate aperte si chiudono (preview poi editor). */
  submitted: boolean;
  /** §7R: elementi non supportati rimossi all'import → avviso non bloccante. */
  importWarning: boolean;
};

export type ArticleInit = Omit<ArticleStoreState, "publish" | "submitted" | "importWarning">;

export const IDLE_PUBLISH: PublishState = { duplicateRef: null, error: null, status: "idle" };

const DEFAULT_SCHEDULE_POLICY: SchedulePolicy = { maxHorizonDays: 365, minLeadMinutes: 5 };

export const EMPTY_ARTICLE_STATE: ArticleStoreState = {
  cover: null,
  identities: [],
  identityId: null,
  importWarning: false,
  limits: DEFAULT_ARTICLE_LIMITS,
  lines: [emptyTextLine()],
  manualTitle: "",
  mode: "native",
  provenance: EMPTY_PROVENANCE,
  publication: { mode: "now" },
  publish: IDLE_PUBLISH,
  rightsConfirmed: false,
  schedulePolicy: DEFAULT_SCHEDULE_POLICY,
  session: null,
  source: { status: "empty" },
  submitted: false,
  tagged: [],
  title: "",
};

/* ------------------------------------------------------------------ */
/* Azioni e reducer                                                    */
/* ------------------------------------------------------------------ */

export type ArticleAction =
  | { type: "identityChanged"; identityId: string }
  | { type: "contextRefreshed"; identities: ArticleIdentity[]; limits: ArticleLimits; schedulePolicy: SchedulePolicy }
  | { type: "titleChanged"; title: string }
  | { type: "manualTitleChanged"; value: string }
  | { type: "coverSet"; cover: ArticleCover | null }
  | { type: "coverUpdated"; patch: Partial<ArticleCover> }
  | { type: "linesChanged"; lines: EditorLine[] }
  | { type: "richLinkResolved"; lineId: string; url: string; snapshotId: string | null; preview: RichLinkPreview | null }
  | { type: "taggedChanged"; tagged: ComposerTaggedIdentity[] }
  | { type: "sourceChanged"; source: ExternalSourceState }
  | { type: "provenanceChanged"; patch: Partial<ArticleProvenance> }
  | { type: "rightsChanged"; value: boolean }
  | { type: "publicationChanged"; publication: Publication }
  | { type: "modeChanged"; mode: ArticleCreationMode }
  | {
      type: "importApplied";
      document: ArticleDocument;
      proposedTitle: string | null;
      removedUnsupported: boolean;
    }
  | { type: "serverSynced"; ref: ContentRef; version: number }
  | { type: "publishStarted" }
  | { type: "publishFailed"; error: PublishingErrorKind; duplicateRef: ContentRef | null }
  | { type: "publishErrorCleared" }
  /** L'invio si è fermato senza errore (serve una conferma dell'utente): la CTA torna disponibile. */
  | { type: "publishIdle" }
  | { type: "submitKeyRotated"; key: string }
  | { type: "submitted" }
  | { type: "importWarningDismissed" };

export function publicationEquals(a: Publication, b: Publication): boolean {
  if (a.mode !== b.mode) return false;
  return a.mode === "now" || (b.mode === "scheduled" && a.scheduledAt === b.scheduledAt);
}

function sameIdentity(identities: readonly ArticleIdentity[], id: string | null): ArticleIdentity | null {
  return identities.find((item) => item.id === id) ?? null;
}

/** §25: una pubblicazione programmata non sopravvive a un'identity che non può programmare. */
function publicationFor(identity: ArticleIdentity | null, publication: Publication): Publication {
  return identity?.canSchedule === true || publication.mode === "now" ? publication : { mode: "now" };
}

export function articleReducer(state: ArticleStoreState, action: ArticleAction): ArticleStoreState {
  switch (action.type) {
    case "identityChanged": {
      if (state.identityId === action.identityId) return state;
      const identity = sameIdentity(state.identities, action.identityId);
      // Un'identity che non può usare la modalità corrente non si sceglie (§7B).
      if (!identity || !identity.modes.includes(state.mode)) return state;
      const reconfirm = rightsNeedReconfirm(
        { identityId: state.identityId, provenance: state.provenance },
        { identityId: action.identityId, provenance: state.provenance },
      );
      return {
        ...state,
        identityId: action.identityId,
        publication: publicationFor(identity, state.publication),
        rightsConfirmed: reconfirm ? false : state.rightsConfirmed,
      };
    }

    case "contextRefreshed": {
      // §26: l'identity corrente resta anche se non è più nella lista (il contenuto non si perde,
      // il server rifiuterà l'invio). Si conserva la sua scheda per mostrarla.
      const current = sameIdentity(state.identities, state.identityId);
      const kept = current && !sameIdentity(action.identities, current.id) ? [current] : [];
      const identities = [...action.identities, ...kept];
      return {
        ...state,
        identities,
        limits: action.limits,
        publication: publicationFor(sameIdentity(identities, state.identityId), state.publication),
        schedulePolicy: action.schedulePolicy,
      };
    }

    case "titleChanged":
      return action.title === state.title ? state : { ...state, title: action.title };

    case "manualTitleChanged":
      return action.value === state.manualTitle ? state : { ...state, manualTitle: action.value };

    case "coverSet":
      return { ...state, cover: action.cover };

    case "coverUpdated":
      return state.cover ? { ...state, cover: { ...state.cover, ...action.patch } } : state;

    case "linesChanged":
      return { ...state, lines: action.lines };

    case "richLinkResolved": {
      let changed = false;
      const lines = state.lines.map((line): EditorLine => {
        if (line.kind !== "rich_link" || line.id !== action.lineId || line.url !== action.url) return line;
        changed = true;
        return {
          ...line,
          preview: action.preview,
          snapshotId: action.snapshotId,
          status: action.preview || action.snapshotId ? "ready" : "failed",
        };
      });
      return changed ? { ...state, lines } : state;
    }

    case "taggedChanged":
      return { ...state, tagged: action.tagged };

    case "sourceChanged":
      return { ...state, source: action.source };

    case "provenanceChanged": {
      // §219, §7U: su un Articolo pubblicato con fonte dichiarata l'attribuzione non si toglie.
      const locked = state.session?.editing === "published" && state.session.loadedElsewhere;
      const patch = locked && action.patch.publishedElsewhere === false ? { ...action.patch, publishedElsewhere: true } : action.patch;
      const provenance = { ...state.provenance, ...patch };
      const reconfirm = rightsNeedReconfirm(
        { identityId: state.identityId, provenance: state.provenance },
        { identityId: state.identityId, provenance },
      );
      return { ...state, provenance, rightsConfirmed: reconfirm ? false : state.rightsConfirmed };
    }

    case "rightsChanged":
      return action.value === state.rightsConfirmed ? state : { ...state, rightsConfirmed: action.value };

    case "publicationChanged":
      return { ...state, publication: action.publication };

    case "modeChanged": {
      if (state.mode === action.mode) return state;
      const toExternal = action.mode === "external_link";
      const fromExternal = state.mode === "external_link";
      return {
        ...state,
        cover: toExternal ? null : state.cover,
        lines: toExternal ? [emptyTextLine()] : state.lines,
        manualTitle: fromExternal ? "" : state.manualTitle,
        mode: action.mode,
        // La fonte e i diritti appartengono a IMPORTED_TEXT: fuori da lì non hanno senso (§7P).
        provenance: EMPTY_PROVENANCE,
        rightsConfirmed: false,
        source: fromExternal ? { status: "empty" } : state.source,
        title: toExternal ? "" : state.title,
      };
    }

    case "importApplied":
      return {
        ...state,
        importWarning: action.removedUnsupported,
        lines: documentToLines(action.document),
        mode: "imported_text",
        title: action.proposedTitle ?? state.title,
      };

    case "serverSynced": {
      const session = state.session;
      if (!session) return state;
      const same =
        session.ref?.contentId === action.ref.contentId &&
        session.ref.contentType === action.ref.contentType &&
        session.version === action.version;
      return same ? state : { ...state, session: { ...session, ref: action.ref, version: action.version } };
    }

    case "publishStarted":
      return state.publish.status === "submitting" ? state : { ...state, publish: { duplicateRef: null, error: null, status: "submitting" } };

    case "publishFailed":
      return { ...state, publish: { duplicateRef: action.duplicateRef, error: action.error, status: "idle" } };

    case "publishErrorCleared":
      return state.publish.error ? { ...state, publish: IDLE_PUBLISH } : state;

    case "publishIdle":
      return state.publish === IDLE_PUBLISH ? state : { ...state, publish: IDLE_PUBLISH };

    case "submitKeyRotated":
      return state.session ? { ...state, session: { ...state.session, submitKey: action.key } } : state;

    case "submitted":
      return { ...state, publish: IDLE_PUBLISH, submitted: true };

    case "importWarningDismissed":
      return state.importWarning ? { ...state, importWarning: false } : state;
  }
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

/** Ciò che una schermata proprietaria dell'editor offre alle altre (l'Anteprima invia con lo stesso invio, §77). */
export type SubmitOutcome = "needs_source_confirmation" | null;

export type ArticleController = {
  /**
   * `needs_source_confirmation`: il server vuole la conferma esplicita del cambio di URL di un
   * Articolo pubblicato (§219, `article_invalid_source` con detail `confirm_source_change`):
   * il chiamante mostra il dialogo e reinvia con `confirmSourceChange`.
   */
  submit: (options?: { confirmSourceChange?: boolean }) => Promise<SubmitOutcome>;
  /** §219: cambiare l'URL di un Articolo pubblicato chiede una conferma prima di inviare. */
  needsSourceConfirmation: () => boolean;
};

export type ArticleStore = {
  getState: () => ArticleStoreState;
  dispatch: (action: ArticleAction) => void;
  subscribe: (listener: () => void) => () => void;
  /**
   * Apre una sessione. Idempotente per `session.id` e silenziosa: viene chiamata
   * mentre la schermata che la apre sta ancora montando, nessuno ascolta ancora.
   */
  begin: (init: ArticleInit) => void;
  setController: (controller: ArticleController) => void;
  clearController: (controller: ArticleController) => void;
  getController: () => ArticleController | null;
};

export function createArticleStore(initial: ArticleStoreState = EMPTY_ARTICLE_STATE): ArticleStore {
  let state = initial;
  let controller: ArticleController | null = null;
  const listeners = new Set<() => void>();

  return {
    begin(init) {
      if (state.session && state.session.id === init.session?.id) return;
      state = { ...init, importWarning: false, publish: IDLE_PUBLISH, submitted: false };
    },
    clearController(candidate) {
      if (controller === candidate) controller = null;
    },
    dispatch(action) {
      const next = articleReducer(state, action);
      if (next !== state) {
        state = next;
        listeners.forEach((listener) => listener());
      }
    },
    getController: () => controller,
    getState: () => state,
    setController(next) {
      controller = next;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** L'unico store: le route dell'editor sono una sola sessione alla volta. */
export const articleStore = createArticleStore();

/* ------------------------------------------------------------------ */
/* Derivazioni                                                         */
/* ------------------------------------------------------------------ */

export function currentIdentity(state: Pick<ArticleStoreState, "identities" | "identityId">): ArticleIdentity | null {
  return sameIdentity(state.identities, state.identityId);
}

function sourceUrl(source: ExternalSourceState): string | null {
  return source.status === "empty" ? null : source.url;
}

/** Il contenuto come lo vedono le regole di `article-presentation.ts`. */
export function toDraftState(state: ArticleContentState): ArticleDraftState {
  return {
    cover: state.cover,
    document: linesToDocument(state.lines),
    manualTitle: state.manualTitle,
    mode: state.mode,
    provenance: state.provenance,
    rightsConfirmed: state.rightsConfirmed,
    source: state.source,
    tagCount: state.tagged.length,
    title: state.title,
  };
}

export type ArticleView = {
  identity: ArticleIdentity | null;
  draft: ArticleDraftState;
  document: ArticleDocument;
  significant: boolean;
  /** Il primo motivo per cui Pubblica/Programma non sono disponibili (§32, §7J, §7Q). */
  blocker: ArticleBlocker | null;
  editing: ArticleSession["editing"];
  canSchedule: boolean;
  /** §84–§85: la riga Pubblicazione solo con can_schedule_content, mai su un Articolo già pubblicato. */
  showPublicationRow: boolean;
  /** §79: la CTA riflette SEMPRE il tipo di pubblicazione scelto. */
  ctaLabel: string;
  submitting: boolean;
};

export function selectArticleView(state: ArticleStoreState): ArticleView {
  const identity = currentIdentity(state);
  const draft = toDraftState(state);
  const editing = state.session?.editing ?? null;
  const canSchedule = identity?.canSchedule === true;
  return {
    blocker: articleBlocker(draft, state.limits),
    canSchedule,
    ctaLabel: primaryCtaLabel(canSchedule ? state.publication : { mode: "now" }, { editing }),
    document: draft.document,
    draft,
    editing,
    identity,
    showPublicationRow: canSchedule && editing !== "published",
    significant: isSignificantArticle(draft),
    submitting: state.publish.status === "submitting",
  };
}

/**
 * Cosa inviare a `submit_content` come pubblicazione (§167, §227): `keep` per un
 * Articolo pubblicato e per un programmato la cui data non è stata toccata.
 */
export function effectivePublication(state: ArticleStoreState): Publication | "keep" {
  const editing = state.session?.editing ?? null;
  if (editing === "published") return "keep";
  const wanted = publicationFor(currentIdentity(state), state.publication);
  if (editing === "scheduled") {
    const loaded = state.session?.loadedPublication ?? null;
    return loaded && publicationEquals(loaded, wanted) ? "keep" : wanted;
  }
  return wanted;
}

/** Il nuovo URL di un Articolo pubblicato diverso da quello salvato (§219). */
export function sourceChangedOnPublished(state: ArticleStoreState): boolean {
  const session = state.session;
  if (!session || session.editing !== "published" || state.mode !== "external_link") return false;
  const current = sourceUrl(state.source);
  return current !== null && session.loadedSourceUrl !== null && current !== session.loadedSourceUrl;
}

/** Impronta del contenuto: uguale a `session.baseline` = nulla da perdere in una modifica a salvataggio esplicito. */
export function contentSignature(state: ArticleContentState): string {
  return JSON.stringify({
    c: state.cover ? (state.cover.storagePath ?? state.cover.localUri) : null,
    i: state.identityId,
    l: state.lines.map((line) =>
      line.kind === "rich_link" ? [line.id, line.kind, line.url] : [line.id, line.kind, line.text, line.marks, line.links],
    ),
    m: state.mode,
    mt: state.manualTitle,
    p: state.provenance,
    pub: state.publication,
    r: state.rightsConfirmed,
    s: sourceUrl(state.source),
    t: state.title,
    tg: state.tagged.map((tag) => `${tag.identityType}:${tag.identityId}`),
  });
}

export function hasUnsavedChanges(state: ArticleStoreState): boolean {
  return state.session !== null && contentSignature(state) !== state.session.baseline;
}

/**
 * §7X: ciò che il cambio modalità non conserverebbe. Fra due modalità a corpo
 * (NATIVE ⇄ IMPORTED_TEXT) testo e copertina restano: si perde solo ciò che
 * appartiene a IMPORTED_TEXT (fonte e diritti).
 */
export function modeSwitchLosses(state: ArticleStoreState, next: ArticleCreationMode): string[] {
  const draft = toDraftState(state);
  const bothBodies = state.mode !== "external_link" && next !== "external_link";
  if (!bothBodies) return modeChangeLosses(draft, next);
  return state.mode === "imported_text" && state.provenance.publishedElsewhere !== null ? ["la fonte e la conferma dei diritti"] : [];
}

/* ------------------------------------------------------------------ */
/* Apertura di una sessione                                            */
/* ------------------------------------------------------------------ */

export type SessionIds = { session: string; operation: string; submit: string };

type InitBase = {
  ids: SessionIds;
  origin: ArticleRouteParams["origin"];
  identities: ArticleIdentity[];
  limits: ArticleLimits;
  schedulePolicy: SchedulePolicy;
};

/** Articolo nuovo (§28): identity di default (§21–§23), contenuto vuoto, nessuna riga sul server. */
export function createFreshInit(input: InitBase & { mode: ArticleCreationMode; contextualIdentityId: string | null }): ArticleInit {
  const usable = identitiesForMode(input.identities, input.mode);
  const content: ArticleContentState = {
    cover: null,
    identityId: defaultIdentityId(usable, { contextual: input.contextualIdentityId }),
    lines: [emptyTextLine()],
    manualTitle: "",
    mode: input.mode,
    provenance: EMPTY_PROVENANCE,
    publication: { mode: "now" },
    rightsConfirmed: false,
    source: { status: "empty" },
    tagged: [],
    title: "",
  };
  return {
    ...content,
    identities: input.identities,
    limits: input.limits,
    schedulePolicy: input.schedulePolicy,
    session: {
      baseline: contentSignature(content),
      editing: null,
      id: input.ids.session,
      loadedElsewhere: false,
      loadedPublication: null,
      loadedSourceUrl: null,
      loadedStatus: null,
      operationKey: input.ids.operation,
      origin: input.origin,
      ref: null,
      restored: false,
      submitKey: input.ids.submit,
      version: null,
    },
  };
}

/**
 * Un contenuto riaperto che l'editor non sa aprire: eliminato (§259, indistinguibile da «non esiste»),
 * in pubblicazione (§263: nessuna operazione che creerebbe inconsistenza) o non modificabile da chi lo apre.
 */
export function loadedBlockedKind(loaded: Pick<LoadedArticle, "status" | "canEdit">): PublishingErrorKind | null {
  if (loaded.status === "deleted") return "content_not_found";
  if (loaded.status === "publishing") return "content_invalid_state";
  return loaded.canEdit ? null : "content_permission_denied";
}

/** Bozza, programmato o pubblicato riaperto (§147–§148, §165, §217): modalità e dati esattamente come salvati. */
export function createLoadedInit(input: InitBase & { loaded: LoadedArticle }): ArticleInit {
  const { loaded } = input;
  const known = input.identities.some((identity) => identity.id === loaded.identity.id);
  // L'identity della bozza resta anche se oggi non può più pubblicare Articoli: il contenuto non si perde (§26).
  const identities: ArticleIdentity[] = known
    ? input.identities
    : [...input.identities, { ...loaded.identity, canSchedule: loaded.canSchedule, modes: [loaded.state.mode] }];
  const editing = loaded.status === "published" ? "published" : loaded.status === "scheduled" ? "scheduled" : null;
  const content: ArticleContentState = {
    cover: loaded.state.cover,
    identityId: loaded.identity.id,
    lines: loaded.lines,
    manualTitle: loaded.state.manualTitle,
    mode: loaded.state.mode,
    provenance: loaded.state.provenance,
    publication: editing === "published" ? { mode: "now" } : loaded.publication,
    rightsConfirmed: loaded.state.rightsConfirmed,
    source: loaded.state.source,
    tagged: loaded.tagged,
    title: loaded.state.title,
  };
  return {
    ...content,
    identities,
    limits: input.limits,
    schedulePolicy: input.schedulePolicy,
    session: {
      baseline: contentSignature(content),
      editing,
      id: input.ids.session,
      loadedElsewhere: loaded.state.provenance.publishedElsewhere === true,
      loadedPublication: editing === "scheduled" ? loaded.publication : null,
      loadedSourceUrl: sourceUrl(loaded.state.source),
      loadedStatus: loaded.status,
      operationKey: input.ids.operation,
      origin: input.origin,
      ref: { contentId: loaded.contentId, contentType: loaded.contentType },
      restored: false,
      submitKey: input.ids.submit,
      version: loaded.version,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Copia locale (§125–§127, §225)                                       */
/* ------------------------------------------------------------------ */

/** Ciò che si conserva sul dispositivo: il contenuto, mai il resto dello stato di sessione. */
export type ArticleLocalSnapshot = ArticleContentState;

/** Una copertina non ancora caricata non sopravvive al riavvio; una fonte «in caricamento» diventa recuperabile con Riprova. */
export function toLocalSnapshot(state: ArticleContentState): ArticleLocalSnapshot {
  return {
    cover: state.cover && state.cover.uploadStatus === "uploaded" ? state.cover : null,
    identityId: state.identityId,
    lines: state.lines,
    manualTitle: state.manualTitle,
    mode: state.mode,
    provenance: state.provenance,
    publication: state.publication,
    rightsConfirmed: state.rightsConfirmed,
    source:
      state.source.status === "loading"
        ? { domain: null, reason: "unavailable", status: "failed", url: state.source.url }
        : state.source,
    tagged: state.tagged,
    title: state.title,
  };
}

/** Una copia locale vuota non vale la pena di essere ripristinata (§118). */
export function isRestorableSnapshot(snapshot: ArticleLocalSnapshot): boolean {
  return isSignificantArticle(toDraftState(snapshot));
}

/**
 * Applica la copia locale a una sessione aperta (§127). La modalità deve
 * coincidere: la copia di un altro tipo di articolo non si mescola. L'identity di
 * una bozza già sul server non cambia; un articolo nuovo riprende quella della
 * copia se è ancora valida.
 */
export function applyLocalSnapshot(init: ArticleInit, snapshot: ArticleLocalSnapshot, operationKey: string | null = null): ArticleInit {
  if (snapshot.mode !== init.mode || !init.session) return init;
  const identityStillValid = identitiesForMode(init.identities, init.mode).some((identity) => identity.id === snapshot.identityId);
  const identityId = init.session.ref === null && identityStillValid ? snapshot.identityId : init.identityId;
  const scheduledInPast = snapshot.publication.mode === "scheduled" && new Date(snapshot.publication.scheduledAt).getTime() <= Date.now();
  return {
    ...init,
    cover: snapshot.cover,
    identityId,
    lines: snapshot.lines.length > 0 ? snapshot.lines : init.lines,
    manualTitle: snapshot.manualTitle,
    provenance: snapshot.provenance,
    publication: scheduledInPast ? { mode: "now" } : publicationFor(sameIdentity(init.identities, identityId), snapshot.publication),
    rightsConfirmed: snapshot.rightsConfirmed,
    session: {
      ...init.session,
      operationKey: init.session.ref === null && operationKey ? operationKey : init.session.operationKey,
      restored: true,
    },
    source: snapshot.source,
    tagged: snapshot.tagged,
    title: snapshot.title,
  };
}
