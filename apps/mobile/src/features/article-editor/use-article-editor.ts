/**
 * Hook dell'editor Articolo (HOM-06.2 §21–§27, §72–§80, §116–§136, §203–§211,
 * §217–§229, §7Q, §7X): possiede i flussi asincroni dello stato condiviso in
 * `article-store.ts` per le schermate che MODIFICANO l'articolo (editor e
 * «Collega da un link»). L'Anteprima legge lo stesso store e invia attraverso il
 * controller che qui si registra (§77: stessa CTA, stesso invio).
 *
 * Scelte che reggono il flusso:
 *  • autosave (§117–§122, §125–§129): `useAutosave` con il payload wire e la copia
 *    locale dell'intero contenuto. Attivo per articoli nuovi, bozze e falliti;
 *    NON per programmati e pubblicati (§224–§227): lì le modifiche restano in una
 *    copia locale di staging finché non si tocca «Salva»;
 *  • invio: prima si attende il salvataggio in corso (la bozza esiste e ha una
 *    versione), poi `submit_content` con una chiave di operazione propria,
 *    separata da quella dell'autosave: un doppio tap o un retry restituiscono lo
 *    stesso esito (§239). A successo si ferma l'autosave, si invalidano liste e
 *    launcher (§234), si mostra il toast (§209–§212, nessuna schermata
 *    celebrativa) e le schermate si chiudono verso l'origin (§122–§127);
 *  • errori (§233, §237, §7Y): niente si cancella, la CTA resta disponibile e la
 *    copy non è tecnica; il duplicato (§7M) porta il ref dell'articolo già
 *    collegato per «Visualizza articolo»; un permesso perso rilegge il contesto;
 *  • uscita (§133–§136): editor vuoto → chiude; con una bozza significativa →
 *    dialogo a tre azioni; modifica a salvataggio esplicito → conferma di
 *    scarto solo se c'è qualcosa da perdere. Back hardware e gesture valgono
 *    Annulla (`beforeRemove`);
 *  • rich link nel corpo (§63–§70): la preview si cerca per ogni riga «in
 *    caricamento»; un fallimento non blocca la pubblicazione (§70).
 */

import { useQueryClient } from "@tanstack/react-query";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { useToast } from "../../ui";
import { contentDetailHref } from "../feed/content-routes";
import { FEED_QK } from "../feed/feed-keys";
import { applyPublishToCaches } from "../post-composer/composer-cache";
import { COMPOSER_FALLBACK_HREF } from "../post-composer/composer-routes";
import type { ComposerMediaItem } from "../post-composer/composer-types";
import { newComposerOperationKey } from "../post-composer/operation-key";
import { localDraftKey, removeLocalDraft, writeLocalDraft } from "../publishing/draft-local-store";
import { trackPublishing } from "../publishing/publishing-analytics";
import { publishingKeys } from "../publishing/publishing-keys";
import { deviceTimeZone, publishingErrorCopy, submitSuccessCopy } from "../publishing/publishing-presentation";
import {
  deleteContentDraft,
  parsePublishingError,
  PublishingRequestError,
  submitContent,
  toWirePublication,
} from "../publishing/publishing-service";
import { trackArticle } from "./article-analytics";
import { COVER_PERMISSION_COPY, pickArticleCover, uploadArticleCover } from "./article-cover";
import { exitDecision } from "./article-presentation";
import { articleDraftHref } from "./article-routes";
import { buildArticlePayload, fetchRichLinkPreview } from "./article-service";
import { articleKeys } from "./article-keys";
import {
  articleStore,
  contentSignature,
  effectivePublication,
  hasUnsavedChanges,
  selectArticleView,
  sourceChangedOnPublished,
  toLocalSnapshot,
  type ArticleController,
  type SubmitOutcome,
} from "./article-store";
import { useAutosave } from "../publishing/use-autosave";
import { useArticleIdentityPicker, refreshArticleContext } from "./use-article-identity";
import { useArticleStoreState } from "./use-article-store";
import { useArticleTags } from "./use-article-tags";

export type ArticleExitDecision = "close" | "ask" | "confirm-discard" | "block";

type EditorNavigation = {
  addListener: (type: "beforeRemove" | "focus", callback: (event: { preventDefault: () => void }) => void) => () => void;
  isFocused: () => boolean;
};

export const ARTICLE_UPDATED_TOAST = "Articolo aggiornato";
export const ARTICLE_VIEW_ACTION = "Visualizza";
export const ARTICLE_DUPLICATE_ACTION = "Visualizza articolo";

export function useArticleEditor({ userId, profileId }: { userId: string; profileId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigation = useNavigation() as unknown as EditorNavigation;
  const { showToast } = useToast();
  const state = useArticleStoreState();
  const view = selectArticleView(state);
  const session = state.session;

  const identityPicker = useArticleIdentityPicker(userId);
  const tags = useArticleTags(userId);

  /* ---------------- autosave (§117–§129) ---------------- */

  // Programmati e pubblicati si salvano solo con «Salva» (§167, §224–§227).
  const autosaveEnabled = session !== null && session.editing === null;
  const identity = view.identity;
  const payload = {
    ...buildArticlePayload(view.draft, state.tagged),
    publication: toWirePublication(view.canSchedule ? state.publication : { mode: "now" }),
  };

  const autosave = useAutosave({
    enabled: autosaveEnabled,
    format: "article",
    identity: identity ? { id: identity.id, type: identity.type } : null,
    initialRef: session?.ref ?? null,
    initialVersion: session?.version ?? null,
    // Una copia locale ripristinata contiene modifiche non ancora sul server (§127).
    initialSynced: session?.restored !== true,
    // §7Q: la conferma dei diritti la decide il server; se l'ha tolta, si richiede di nuovo.
    onSaved: (saved, sent) => {
      if (saved.rightsConfirmed === false && sent.rights_confirmed === true) {
        articleStore.dispatch({ type: "rightsChanged", value: false });
      }
    },
    operationKey: session?.operationKey ?? "",
    // Nessun salvataggio a timer fra flush() e submit_content: farebbe salire la versione (§121, §128).
    paused: view.submitting,
    payload,
    significant: view.significant,
    snapshot: toLocalSnapshot(state),
    userId: userId || null,
  });

  // Gli handler asincroni (invio, background, focus) leggono sempre l'ultimo render.
  const latest = useRef({ autosave, autosaveEnabled, leave, submit });
  latest.current = { autosave, autosaveEnabled, leave, submit };

  // L'autosave possiede ref e versione; lo store li tiene per le schermate che subentrano (cambio modalità).
  useEffect(() => {
    if (autosave.ref && autosave.version !== null) {
      articleStore.dispatch({ ref: autosave.ref, type: "serverSynced", version: autosave.version });
    }
  }, [autosave.ref, autosave.version]);

  // §225: staging locale delle modifiche a un programmato o a un pubblicato.
  const dirty = hasUnsavedChanges(state);
  const signature = autosaveEnabled ? "" : contentSignature(state);
  const stagingKey = !autosaveEnabled && session?.ref ? localDraftKey(userId, "article", session.ref) : null;

  useEffect(() => {
    if (!stagingKey || !dirty) return;
    const timer = setTimeout(() => {
      const current = articleStore.getState();
      if (!current.session) return;
      void writeLocalDraft(stagingKey, {
        baseVersion: current.session.version,
        format: "article",
        operationKey: current.session.operationKey,
        ref: current.session.ref,
        savedAt: new Date().toISOString(),
        snapshot: toLocalSnapshot(current),
        version: 1,
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [stagingKey, dirty, signature]);

  // §135: l'app in background non aspetta il debounce.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active" && latest.current.autosaveEnabled) {
        void latest.current.autosave.flush();
      }
    });
    return () => subscription.remove();
  }, []);

  /* ---------------- rich link nel corpo (§63–§70) ---------------- */

  const fetchingLinks = useRef(new Set<string>());
  const pendingLinks = state.lines.flatMap((line) => (line.kind === "rich_link" && line.status === "loading" ? [`${line.id}|${line.url}`] : []));
  const pendingLinksKey = pendingLinks.join(",");

  useEffect(() => {
    for (const line of articleStore.getState().lines) {
      if (line.kind !== "rich_link" || line.status !== "loading") continue;
      const key = `${line.id}|${line.url}`;
      if (fetchingLinks.current.has(key)) continue;
      fetchingLinks.current.add(key);
      void fetchRichLinkPreview(line.url).then((result) => {
        fetchingLinks.current.delete(key);
        articleStore.dispatch({ lineId: line.id, preview: result.preview, snapshotId: result.snapshotId, type: "richLinkResolved", url: line.url });
        trackArticle({ name: "rich_link_generated", success: result.preview !== null });
      });
    }
  }, [pendingLinksKey]);

  /* ---------------- copertina (§36–§40) ---------------- */

  const coverItem = useRef<ComposerMediaItem | null>(null);
  const [coverNotice, setCoverNotice] = useState<string | null>(null);

  async function uploadCover(item: ComposerMediaItem) {
    articleStore.dispatch({ patch: { uploadStatus: "uploading" }, type: "coverUpdated" });
    const stillCurrent = () => articleStore.getState().cover?.localUri === item.localUri;
    try {
      const uploaded = await uploadArticleCover(userId, item);
      if (stillCurrent()) {
        articleStore.dispatch({ patch: { storagePath: uploaded.storagePath, uploadStatus: "uploaded", url: uploaded.url }, type: "coverUpdated" });
      }
    } catch {
      if (stillCurrent()) {
        articleStore.dispatch({ patch: { uploadStatus: "failed" }, type: "coverUpdated" });
      }
    }
  }

  async function pickCover() {
    setCoverNotice(null);
    const picked = await pickArticleCover();
    if (picked.status === "denied") {
      setCoverNotice(COVER_PERMISSION_COPY);
      return;
    }
    if (picked.status !== "picked") return;
    coverItem.current = picked.item;
    articleStore.dispatch({ cover: picked.cover, type: "coverSet" });
    trackArticle({ name: "cover_added" });
    void uploadCover(picked.item);
  }

  function removeCover() {
    coverItem.current = null;
    setCoverNotice(null);
    articleStore.dispatch({ cover: null, type: "coverSet" });
    trackArticle({ name: "cover_removed" });
  }

  function retryCover() {
    if (coverItem.current) void uploadCover(coverItem.current);
  }

  /* ---------------- chiusura e uscita (§122–§127, §133–§136) ---------------- */

  const [exitOpen, setExitOpen] = useState(false);
  const [exitBusy, setExitBusy] = useState(false);
  const [exitError, setExitError] = useState<string | null>(null);
  const leavingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const hasServerDraft = autosaveEnabled && autosave.ref !== null;
  const decision: ArticleExitDecision = view.submitting
    ? "block"
    : session?.editing
      ? dirty
        ? "confirm-discard"
        : "close"
      : exitDecision(view.significant, false, hasServerDraft) === "ask"
        ? "ask"
        : "close";

  /** §122–§127: indietro alla superficie d'origine; senza stack (deep link, riapertura) la Home. */
  function leave(): void {
    if (leavingRef.current) return;
    leavingRef.current = true;
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(COMPOSER_FALLBACK_HREF as never);
    }
  }

  /** Passa a un'altra schermata della stessa sessione (cambio modalità, ricarica): non è un'uscita. */
  function navigateAway(href: string) {
    leavingRef.current = true;
    router.replace(href as never);
  }

  const exitRef = useRef<{ decision: ArticleExitDecision }>({ decision });
  useEffect(() => {
    exitRef.current = { decision };
  });

  // §138 di HOM-06.1: back hardware Android e gesture valgono Annulla.
  useEffect(() => {
    return navigation.addListener("beforeRemove", (event) => {
      if (leavingRef.current) return;
      const current = exitRef.current.decision;
      if (current === "close") {
        void latest.current.autosave.stop();
        return;
      }
      event.preventDefault();
      if (current !== "block") setExitOpen(true);
    });
  }, [navigation]);

  // Un invio riuscito dall'Anteprima chiude prima l'Anteprima, poi (a fuoco tornato) l'editor.
  useEffect(() => {
    const check = () => {
      if (articleStore.getState().submitted && navigation.isFocused() && mountedRef.current) latest.current.leave();
    };
    check();
    return navigation.addListener("focus", check);
  }, [state.submitted, navigation]);

  function requestExit() {
    if (decision === "block") return;
    if (decision === "close") {
      void autosave.stop();
      leave();
      return;
    }
    setExitError(null);
    setExitOpen(true);
  }

  /** «Esci e conserva bozza» (§135): salva e sincronizza, poi esce. Senza rete resta la copia locale (§126). */
  async function keepAndExit() {
    setExitBusy(true);
    await autosave.flush();
    // La bozza deve comparire subito in Bozze e nei contatori del «+» (§135, §234).
    void queryClient.invalidateQueries({ queryKey: publishingKeys.all });
    setExitBusy(false);
    setExitOpen(false);
    leave();
  }

  /** «Elimina bozza» (§136): soft delete sul server se la bozza esiste, poi copia locale e uscita. */
  async function discardDraftAndExit() {
    setExitBusy(true);
    setExitError(null);
    try {
      if (autosaveEnabled && autosave.ref) {
        const saved = await autosave.flush();
        const version = saved?.version ?? autosave.version ?? session?.version ?? 0;
        await deleteContentDraft(saved?.ref ?? autosave.ref, version);
        trackPublishing({ format: "article", name: "draft_deleted" });
        void queryClient.invalidateQueries({ queryKey: publishingKeys.all });
      }
      await autosave.stop();
      setExitOpen(false);
      leave();
    } catch (error) {
      setExitError(publishingErrorCopy(parsePublishingError(error).kind, "article"));
    } finally {
      setExitBusy(false);
    }
  }

  /** Modifica a salvataggio esplicito: si scartano le modifiche locali, il pubblicato non è stato toccato (§226). */
  async function discardChangesAndExit() {
    await autosave.stop();
    setExitOpen(false);
    leave();
  }

  /* ---------------- invio (§203–§211, §227) ---------------- */

  async function submit(options: { confirmSourceChange?: boolean } = {}): Promise<SubmitOutcome> {
    const started = articleStore.getState();
    if (started.publish.status === "submitting" || !started.session) return null;
    const startedView = selectArticleView(started);
    if (startedView.blocker !== null || !startedView.identity) return null;

    articleStore.dispatch({ type: "publishStarted" });

    try {
      let ref = started.session.ref;
      let version = started.session.version;
      if (latest.current.autosaveEnabled) {
        // Prima la bozza (ref e versione), poi l'invio. Se il salvataggio non riesce l'invio prosegue con ciò che si sa.
        const saved = await latest.current.autosave.flush();
        ref = saved?.ref ?? latest.current.autosave.ref ?? ref;
        version = saved?.version ?? latest.current.autosave.version ?? version;
      }

      // Dopo gli `await` si rilegge: il contenuto è quello più recente.
      const current = articleStore.getState();
      const currentView = selectArticleView(current);
      if (!current.session || !currentView.identity) {
        articleStore.dispatch({ error: "unknown", duplicateRef: null, type: "publishFailed" });
        return null;
      }
      const publication = effectivePublication(current);

      const result = await submitContent({
        expectedVersion: version,
        format: "article",
        identityId: currentView.identity.id,
        identityType: currentView.identity.type,
        operationKey: current.session.submitKey,
        origin: current.session.origin,
        payload: buildArticlePayload(currentView.draft, current.tagged, { confirmSourceChange: options.confirmSourceChange }),
        publication,
        ref,
      });

      await latest.current.autosave.stop();
      void removeLocalDraft(localDraftKey(userId, "article", result.ref));
      applyPublishToCaches(queryClient, { profileId });
      void queryClient.invalidateQueries({ queryKey: publishingKeys.all });
      void queryClient.invalidateQueries({ queryKey: articleKeys.detail(result.ref.contentType, result.ref.contentId) });
      void queryClient.invalidateQueries({ queryKey: FEED_QK.postDetail(result.ref.contentId) });

      if (publication !== "keep" && publication.mode === "scheduled") {
        trackPublishing({
          format: "article",
          identityType: currentView.identity.type,
          name: "schedule_confirmed",
        });
      }

      const published = result.status === "published";
      showToast({
        action: published
          ? {
              label: ARTICLE_VIEW_ACTION,
              onPress: () => router.push(contentDetailHref(result.ref.contentType, result.ref.contentId) as never),
            }
          : undefined,
        message: current.session.editing
          ? ARTICLE_UPDATED_TOAST
          : submitSuccessCopy(
              "article",
              result.status === "scheduled" && result.scheduledAt
                ? { mode: "scheduled", scheduledAt: result.scheduledAt, timezone: deviceTimeZone() }
                : { mode: "now" },
            ),
        tone: "success",
      });
      articleStore.dispatch({ type: "submitted" });
      return null;
    } catch (error) {
      const parsed = error instanceof PublishingRequestError ? error.parsed : parsePublishingError(error);

      // §219: il server chiede la conferma esplicita del cambio di URL: non è un errore, è un dialogo.
      if (parsed.kind === "article_invalid_source" && parsed.detail?.includes("confirm_source_change")) {
        articleStore.dispatch({ type: "publishIdle" });
        return "needs_source_confirmation";
      }

      articleStore.dispatch({ duplicateRef: parsed.duplicateRef, error: parsed.kind, type: "publishFailed" });

      // §7Q: il server ha scartato la conferma dei diritti (fonte, autore, URL o identity cambiati): va riconfermata.
      if (parsed.kind === "article_rights_required") {
        articleStore.dispatch({ type: "rightsChanged", value: false });
      }

      if (parsed.kind === "article_duplicate") {
        trackArticle({ name: "external_article_duplicate_detected" });
      }
      // La chiave non è più riusabile: nuova chiave, contenuto intatto, l'utente riprova (§239).
      if (parsed.kind === "content_operation_conflict") {
        articleStore.dispatch({ key: newComposerOperationKey(), type: "submitKeyRotated" });
      }
      // Capability persa (§169–§172 di HOM-06.1): la lista del server è l'autorità sulle identity.
      if (parsed.kind === "content_permission_denied" || parsed.kind === "article_mode_not_allowed" || parsed.kind === "schedule_not_allowed") {
        await refreshArticleContext(queryClient, userId);
      }
      return null;
    }
  }

  /* ---------------- registrazione per l'Anteprima (§77) ---------------- */

  useEffect(() => {
    const controller: ArticleController = {
      needsSourceConfirmation: () => sourceChangedOnPublished(articleStore.getState()),
      submit: (options) => latest.current.submit(options),
    };
    articleStore.setController(controller);
    return () => articleStore.clearController(controller);
  }, []);

  /* ---------------- apertura ---------------- */

  useEffect(() => {
    const opened = articleStore.getState();
    trackArticle({ mode: opened.mode, name: "article_editor_open", restored: opened.session?.restored === true });
  }, []);

  /** §128–§130: conflitto di versione → si riapre l'ultima versione del server. */
  function reloadHref(): string | null {
    const current = articleStore.getState();
    return current.session?.ref ? articleDraftHref(current.session.ref, current.mode, current.session.origin) : null;
  }

  return {
    autosave: { ref: autosave.ref, status: autosave.status, version: autosave.version },
    cover: { notice: coverNotice, pick: pickCover, remove: removeCover, retry: retryCover },
    exit: {
      busy: exitBusy,
      decision,
      discardChanges: discardChangesAndExit,
      discardDraft: discardDraftAndExit,
      dismiss: () => setExitOpen(false),
      error: exitError,
      keep: keepAndExit,
      open: exitOpen,
      request: requestExit,
    },
    flush: () => latest.current.autosave.flush(),
    identityPicker,
    leave,
    navigateAway,
    needsSourceConfirmation: () => sourceChangedOnPublished(articleStore.getState()),
    reloadHref,
    state,
    submit,
    tags,
    view,
  };
}

export type ArticleEditor = ReturnType<typeof useArticleEditor>;
