import { describe, expect, it } from "vitest";

import { linesToDocument } from "./article-document";
import { EMPTY_PROVENANCE } from "./article-presentation";
import type { ArticleIdentity, LoadedArticle } from "./article-service";
import {
  applyLocalSnapshot,
  articleReducer,
  contentSignature,
  createArticleStore,
  createFreshInit,
  createLoadedInit,
  effectivePublication,
  hasUnsavedChanges,
  isRestorableSnapshot,
  loadedBlockedKind,
  modeSwitchLosses,
  selectArticleView,
  sourceChangedOnPublished,
  toLocalSnapshot,
  type ArticleInit,
  type ArticleStoreState,
} from "./article-store";
import { DEFAULT_ARTICLE_LIMITS, type EditorLine, type TextLine } from "./article-types";

const COMO: ArticleIdentity = {
  avatarUrl: null,
  canSchedule: true,
  contextLabel: "Società",
  id: "como",
  isVerified: true,
  modes: ["native", "external_link", "imported_text"],
  name: "AC Como",
  type: "society",
};

const NEWS: ArticleIdentity = {
  avatarUrl: null,
  canSchedule: false,
  contextLabel: "Media",
  id: "news",
  isVerified: false,
  modes: ["native", "external_link"],
  name: "Como News",
  type: "media",
};

const IDS = { operation: "op", session: "s1", submit: "sub" };
const BASE = {
  ids: IDS,
  identities: [COMO, NEWS],
  limits: DEFAULT_ARTICLE_LIMITS,
  origin: "HOME_PER_TE" as const,
  schedulePolicy: { maxHorizonDays: 365, minLeadMinutes: 5 },
};

function open(mode: "native" | "external_link" | "imported_text" = "native", extra: Partial<ArticleInit> = {}): ArticleStoreState {
  const store = createArticleStore();
  store.begin({ ...createFreshInit({ ...BASE, contextualIdentityId: null, mode }), ...extra });
  return store.getState();
}

function textLine(text: string, extra: Partial<TextLine> = {}): TextLine {
  return { id: "l1", kind: "paragraph", links: [], marks: [], text, ...extra };
}

describe("apertura di una sessione", () => {
  it("parte dall'identity di default compatibile con la modalità e non crea nulla sul server", () => {
    const state = open("imported_text");
    expect(state.identityId).toBe("como");
    expect(state.session?.ref).toBeNull();
    expect(state.session?.editing).toBeNull();
  });

  it("l'identity contestuale vince, se compatibile (§21)", () => {
    const init = createFreshInit({ ...BASE, contextualIdentityId: "news", mode: "native" });
    expect(init.identityId).toBe("news");
    // «news» non importa testi (§7B): la contestuale non si impone a una modalità che non può usare.
    expect(createFreshInit({ ...BASE, contextualIdentityId: "news", mode: "imported_text" }).identityId).toBe("como");
  });

  it("begin è idempotente per sessione: non azzera ciò che l'utente ha già scritto", () => {
    const store = createArticleStore();
    const init = createFreshInit({ ...BASE, contextualIdentityId: null, mode: "native" });
    store.begin(init);
    store.dispatch({ title: "Titolo", type: "titleChanged" });
    store.begin(init);
    expect(store.getState().title).toBe("Titolo");
  });

  it("riapre un articolo caricato con modalità, tag e riga server (§147)", () => {
    const loaded: LoadedArticle = {
      canDelete: true,
      canEdit: true,
      canSchedule: true,
      contentId: "c1",
      contentType: "club_media",
      failureCode: null,
      identity: { avatarUrl: null, canSchedule: true, contextLabel: "Società", id: "como", isVerified: true, name: "AC Como", type: "society" },
      lines: [textLine("Corpo")],
      publication: { mode: "scheduled", scheduledAt: "2030-08-20T16:30:00.000Z", timezone: "Europe/Rome" },
      state: {
        cover: null,
        document: linesToDocument([textLine("Corpo")]),
        manualTitle: "",
        mode: "native",
        provenance: EMPTY_PROVENANCE,
        rightsConfirmed: false,
        source: { status: "empty" },
        title: "Il progetto",
      },
      status: "scheduled",
      tagged: [],
      version: 4,
    };
    const init = createLoadedInit({ ...BASE, loaded });
    expect(init.session).toMatchObject({ editing: "scheduled", loadedStatus: "scheduled", ref: { contentId: "c1" }, version: 4 });
    expect(init.session?.loadedPublication).toEqual(loaded.publication);
    expect(init.title).toBe("Il progetto");
  });

  it("un'identity che oggi non può più pubblicare Articoli resta quella della bozza (§26)", () => {
    const loaded = {
      canDelete: true,
      canEdit: true,
      canSchedule: false,
      contentId: "c1",
      contentType: "media_profile",
      failureCode: null,
      identity: { avatarUrl: null, canSchedule: false, contextLabel: "Media", id: "gone", isVerified: false, name: "Vecchio Media", type: "media" },
      lines: [textLine("x")],
      publication: { mode: "now" },
      state: { cover: null, document: { blocks: [], v: 1 }, manualTitle: "", mode: "native", provenance: EMPTY_PROVENANCE, rightsConfirmed: false, source: { status: "empty" }, title: "T" },
      status: "draft",
      tagged: [],
      version: 1,
    } as LoadedArticle;
    const init = createLoadedInit({ ...BASE, loaded });
    expect(init.identityId).toBe("gone");
    expect(init.identities.map((identity) => identity.id)).toContain("gone");
  });
});

describe("cambio identity (§24–§27, §7Q)", () => {
  it("conserva titolo, testo e tag, e azzera i diritti confermati", () => {
    let state = open("imported_text");
    state = articleReducer(state, { type: "titleChanged", title: "T" });
    state = articleReducer(state, { patch: { publishedElsewhere: false }, type: "provenanceChanged" });
    state = articleReducer(state, { type: "rightsChanged", value: true });
    const next = articleReducer(state, { identityId: "como", type: "identityChanged" });
    expect(next).toBe(state);

    const withNews = articleReducer({ ...state, mode: "native", rightsConfirmed: true }, { identityId: "news", type: "identityChanged" });
    expect(withNews.identityId).toBe("news");
    expect(withNews.title).toBe("T");
    expect(withNews.rightsConfirmed).toBe(false);
  });

  it("non sceglie un'identity che non può usare la modalità", () => {
    const state = open("imported_text");
    expect(articleReducer(state, { identityId: "news", type: "identityChanged" })).toBe(state);
  });

  it("una pubblicazione programmata torna a «Ora» se la nuova identity non può programmare (§25)", () => {
    let state = open("native");
    state = articleReducer(state, {
      publication: { mode: "scheduled", scheduledAt: "2030-01-01T10:00:00.000Z", timezone: "UTC" },
      type: "publicationChanged",
    });
    const next = articleReducer(state, { identityId: "news", type: "identityChanged" });
    expect(next.publication).toEqual({ mode: "now" });
  });
});

describe("fonte e diritti (§7P–§7Q)", () => {
  it("cambiare fonte, autore o URL originali azzera i diritti confermati; il resto no", () => {
    let state = open("imported_text");
    state = articleReducer(state, { patch: { originalUrl: "https://a.it", publishedElsewhere: true, sourceName: "Il Giornale" }, type: "provenanceChanged" });
    state = articleReducer(state, { type: "rightsChanged", value: true });
    expect(articleReducer(state, { patch: { noOriginalLink: false }, type: "provenanceChanged" }).rightsConfirmed).toBe(true);
    expect(articleReducer(state, { patch: { sourceName: "Altro" }, type: "provenanceChanged" }).rightsConfirmed).toBe(false);
    expect(articleReducer(state, { patch: { originalAuthor: "Mario" }, type: "provenanceChanged" }).rightsConfirmed).toBe(false);
  });
});

describe("attribuzione di un pubblicato (§219, §7U)", () => {
  it("non si può togliere «già pubblicato altrove» da un Articolo pubblicato con fonte", () => {
    const base = open("imported_text");
    const published: ArticleStoreState = {
      ...base,
      provenance: { ...EMPTY_PROVENANCE, publishedElsewhere: true, sourceName: "Il Giornale" },
      session: { ...base.session!, editing: "published", loadedElsewhere: true },
    };
    const next = articleReducer(published, { patch: { publishedElsewhere: false }, type: "provenanceChanged" });
    expect(next.provenance.publishedElsewhere).toBe(true);
    // In una bozza la scelta resta libera.
    const draft = articleReducer({ ...published, session: { ...published.session!, editing: null } }, { patch: { publishedElsewhere: false }, type: "provenanceChanged" });
    expect(draft.provenance.publishedElsewhere).toBe(false);
  });
});

describe("contenuto riaperto (§259, §263)", () => {
  it("un eliminato, uno in pubblicazione o non modificabile non si apre nell'editor", () => {
    expect(loadedBlockedKind({ canEdit: true, status: "deleted" })).toBe("content_not_found");
    expect(loadedBlockedKind({ canEdit: true, status: "publishing" })).toBe("content_invalid_state");
    expect(loadedBlockedKind({ canEdit: false, status: "draft" })).toBe("content_permission_denied");
    expect(loadedBlockedKind({ canEdit: true, status: "scheduled" })).toBeNull();
  });
});

describe("cambio modalità (§7X)", () => {
  it("da NATIVE a EXTERNAL_LINK toglie testo, copertina e titolo; conserva identity e tag", () => {
    let state = open("native");
    state = articleReducer(state, { type: "titleChanged", title: "T" });
    state = articleReducer(state, { lines: [textLine("Corpo")], type: "linesChanged" });
    state = articleReducer(state, {
      tagged: [{ avatarUrl: null, displayName: "Marco", identityId: "m", identityType: "profile", isVerified: false, subtitle: null }],
      type: "taggedChanged",
    });
    expect(modeSwitchLosses(state, "external_link")).toEqual(["il testo dell'articolo"]);
    const next = articleReducer(state, { mode: "external_link", type: "modeChanged" });
    expect(next.mode).toBe("external_link");
    expect(next.title).toBe("");
    expect((next.lines[0] as TextLine).text).toBe("");
    expect(next.tagged).toHaveLength(1);
    expect(next.identityId).toBe("como");
  });

  it("da EXTERNAL_LINK a NATIVE toglie la fonte e il titolo manuale", () => {
    let state = open("external_link");
    state = articleReducer(state, {
      source: { canonicalUrl: null, domain: "a.it", finalUrl: "https://a.it/x", normalizedUrl: null, siteName: null, snapshot: { author: null, description: null, favicon_url: null, image_url: null, published_time: null, site_name: null, title: null }, snapshotId: "s", status: "ready", url: "https://a.it/x" },
      type: "sourceChanged",
    });
    state = articleReducer(state, { type: "manualTitleChanged", value: "Titolo mio" });
    expect(modeSwitchLosses(state, "native")).toEqual(["il link della fonte e la sua anteprima"]);
    const next = articleReducer(state, { mode: "native", type: "modeChanged" });
    expect(next.source).toEqual({ status: "empty" });
    expect(next.manualTitle).toBe("");
  });

  it("fra NATIVE e IMPORTED_TEXT il testo resta e si perde solo la fonte (§7X)", () => {
    let state = open("imported_text");
    state = articleReducer(state, { lines: [textLine("Corpo")], type: "linesChanged" });
    expect(modeSwitchLosses(state, "native")).toEqual([]);
    state = articleReducer(state, { patch: { publishedElsewhere: false }, type: "provenanceChanged" });
    expect(modeSwitchLosses(state, "native")).toEqual(["la fonte e la conferma dei diritti"]);
    const next = articleReducer(state, { mode: "native", type: "modeChanged" });
    expect((next.lines[0] as TextLine).text).toBe("Corpo");
    expect(next.provenance).toEqual(EMPTY_PROVENANCE);
  });
});

describe("import (§7T)", () => {
  it("riempie corpo e titolo proposto, passa a IMPORTED_TEXT e segnala gli elementi rimossi", () => {
    const state = open("imported_text");
    const document = linesToDocument([textLine("Corpo importato")]);
    const next = articleReducer(state, { document, proposedTitle: "Titolo proposto", removedUnsupported: true, type: "importApplied" });
    expect(next.mode).toBe("imported_text");
    expect(next.title).toBe("Titolo proposto");
    expect((next.lines[0] as TextLine).text).toBe("Corpo importato");
    expect(next.importWarning).toBe(true);
    expect(articleReducer(next, { type: "importWarningDismissed" }).importWarning).toBe(false);
  });

  it("senza titolo proposto non cancella quello già scritto", () => {
    let state = open("imported_text");
    state = articleReducer(state, { type: "titleChanged", title: "Mio titolo" });
    const next = articleReducer(state, { document: linesToDocument([textLine("x")]), proposedTitle: null, removedUnsupported: false, type: "importApplied" });
    expect(next.title).toBe("Mio titolo");
  });
});

describe("rich link nel corpo (§63–§70)", () => {
  it("risolve la preview della riga giusta e ignora risposte per un URL cambiato", () => {
    const link: EditorLine = { id: "r1", kind: "rich_link", preview: null, snapshotId: null, status: "loading", url: "https://a.it/x" };
    let state = open("native");
    state = articleReducer(state, { lines: [link, textLine("")], type: "linesChanged" });
    const stale = articleReducer(state, { lineId: "r1", preview: null, snapshotId: "s", type: "richLinkResolved", url: "https://altro.it" });
    expect(stale).toBe(state);
    const ok = articleReducer(state, { lineId: "r1", preview: null, snapshotId: "s", type: "richLinkResolved", url: "https://a.it/x" });
    expect(ok.lines[0]).toMatchObject({ snapshotId: "s", status: "ready" });
    const failed = articleReducer(state, { lineId: "r1", preview: null, snapshotId: null, type: "richLinkResolved", url: "https://a.it/x" });
    expect(failed.lines[0]).toMatchObject({ status: "failed" });
  });
});

describe("vista e CTA", () => {
  it("la CTA segue la pubblicazione scelta, mai «Programma» con Ora (§79)", () => {
    let state = open("native");
    expect(selectArticleView(state).ctaLabel).toBe("Pubblica");
    state = articleReducer(state, {
      publication: { mode: "scheduled", scheduledAt: "2030-01-01T10:00:00.000Z", timezone: "UTC" },
      type: "publicationChanged",
    });
    expect(selectArticleView(state).ctaLabel).toBe("Programma");
    expect(selectArticleView(articleReducer(state, { publication: { mode: "now" }, type: "publicationChanged" })).ctaLabel).toBe("Pubblica");
  });

  it("senza can_schedule la riga Pubblicazione non c'è e la CTA resta «Pubblica» (§84–§85)", () => {
    const store = createArticleStore();
    store.begin(createFreshInit({ ...BASE, contextualIdentityId: "news", mode: "native" }));
    const view = selectArticleView(store.getState());
    expect(view.showPublicationRow).toBe(false);
    expect(view.ctaLabel).toBe("Pubblica");
  });

  it("un editor vuoto non è significativo e Pubblica è bloccata dal titolo (§32, §118)", () => {
    const view = selectArticleView(open("native"));
    expect(view.significant).toBe(false);
    expect(view.blocker).toBe("missing_title");
  });
});

describe("pubblicazione da inviare", () => {
  function editing(kind: "published" | "scheduled"): ArticleStoreState {
    const state = open("native");
    return {
      ...state,
      publication: kind === "scheduled" ? { mode: "scheduled", scheduledAt: "2030-01-01T10:00:00.000Z", timezone: "UTC" } : { mode: "now" },
      session: {
        ...state.session!,
        editing: kind,
        loadedPublication: kind === "scheduled" ? { mode: "scheduled", scheduledAt: "2030-01-01T10:00:00.000Z", timezone: "UTC" } : null,
        loadedStatus: kind,
        ref: { contentId: "c", contentType: "club_media" },
        version: 3,
      },
    };
  }

  it("un Articolo pubblicato si salva sempre con keep, e la CTA è «Salva» (§218, §227)", () => {
    const state = editing("published");
    expect(effectivePublication(state)).toBe("keep");
    expect(selectArticleView(state).ctaLabel).toBe("Salva");
    expect(selectArticleView(state).showPublicationRow).toBe(false);
  });

  it("un programmato con la data intatta si salva con keep, altrimenti con la nuova data (§166–§167)", () => {
    const state = editing("scheduled");
    expect(effectivePublication(state)).toBe("keep");
    const moved = articleReducer(state, {
      publication: { mode: "scheduled", scheduledAt: "2030-02-02T10:00:00.000Z", timezone: "UTC" },
      type: "publicationChanged",
    });
    expect(effectivePublication(moved)).toEqual({ mode: "scheduled", scheduledAt: "2030-02-02T10:00:00.000Z", timezone: "UTC" });
  });

  it("una bozza nuova invia la pubblicazione scelta, ma «Ora» se l'identity non può programmare", () => {
    const state = open("native");
    expect(effectivePublication(state)).toEqual({ mode: "now" });
    const forced = { ...state, identityId: "news", publication: { mode: "scheduled", scheduledAt: "2030-01-01T10:00:00.000Z", timezone: "UTC" } } as ArticleStoreState;
    expect(effectivePublication(forced)).toEqual({ mode: "now" });
  });

  it("cambiare l'URL di un Articolo collegato già pubblicato richiede conferma (§219)", () => {
    const base = editing("published");
    const state: ArticleStoreState = {
      ...base,
      mode: "external_link",
      session: { ...base.session!, loadedSourceUrl: "https://a.it/uno" },
      source: { domain: "a.it", reason: "unavailable", status: "failed", url: "https://a.it/due" },
    };
    expect(sourceChangedOnPublished(state)).toBe(true);
    expect(sourceChangedOnPublished({ ...state, source: { ...state.source, url: "https://a.it/uno" } as ArticleStoreState["source"] })).toBe(false);
    expect(sourceChangedOnPublished(open("external_link"))).toBe(false);
  });
});

describe("modifiche non salvate", () => {
  it("la firma cambia con il contenuto ma non con lo stato di invio", () => {
    const state = open("native");
    expect(hasUnsavedChanges(state)).toBe(false);
    const edited = articleReducer(state, { type: "titleChanged", title: "Nuovo" });
    expect(hasUnsavedChanges(edited)).toBe(true);
    expect(contentSignature(articleReducer(edited, { type: "publishStarted" }))).toBe(contentSignature(edited));
    expect(hasUnsavedChanges(articleReducer(edited, { type: "titleChanged", title: "" }))).toBe(false);
  });
});

describe("copia locale (§125–§127, §225)", () => {
  it("si ripristina solo se la modalità coincide e ha contenuto", () => {
    const fresh = createFreshInit({ ...BASE, contextualIdentityId: null, mode: "native" });
    const written = articleReducer({ ...open("native") }, { type: "titleChanged", title: "Bozza" });
    const snapshot = toLocalSnapshot(written);
    expect(isRestorableSnapshot(snapshot)).toBe(true);
    expect(isRestorableSnapshot(toLocalSnapshot(open("native")))).toBe(false);

    const restored = applyLocalSnapshot(fresh, snapshot, "op-locale");
    expect(restored.title).toBe("Bozza");
    expect(restored.session).toMatchObject({ operationKey: "op-locale", restored: true });

    const otherMode = createFreshInit({ ...BASE, contextualIdentityId: null, mode: "external_link" });
    expect(applyLocalSnapshot(otherMode, snapshot)).toBe(otherMode);
  });

  it("una copertina non ancora caricata e una fonte in caricamento non restano in uno stato impossibile", () => {
    let state = open("external_link");
    state = articleReducer(state, { source: { status: "loading", url: "https://a.it/x" }, type: "sourceChanged" });
    expect(toLocalSnapshot(state).source).toMatchObject({ reason: "unavailable", status: "failed", url: "https://a.it/x" });

    const withCover = articleReducer(open("native"), {
      cover: { altText: null, height: null, localUri: "file://x.jpg", storagePath: null, uploadStatus: "uploading", url: null, width: null },
      type: "coverSet",
    });
    expect(toLocalSnapshot(withCover).cover).toBeNull();
  });

  it("una bozza già sul server conserva la sua identity e la sua chiave di operazione", () => {
    const base = createFreshInit({ ...BASE, contextualIdentityId: null, mode: "native" });
    const onServer: ArticleInit = { ...base, session: { ...base.session!, ref: { contentId: "c", contentType: "club_media" }, version: 2 } };
    const snapshot = { ...toLocalSnapshot(articleReducer(open("native"), { type: "titleChanged", title: "X" })), identityId: "news" };
    const restored = applyLocalSnapshot(onServer, snapshot, "altra-chiave");
    expect(restored.identityId).toBe("como");
    expect(restored.session?.operationKey).toBe("op");
  });
});

describe("controller e store", () => {
  it("registra e libera l'invio condiviso con l'Anteprima", () => {
    const store = createArticleStore();
    const controller = { needsSourceConfirmation: () => false, submit: async () => null };
    store.setController(controller);
    expect(store.getController()).toBe(controller);
    store.clearController({ needsSourceConfirmation: () => true, submit: async () => null });
    expect(store.getController()).toBe(controller);
    store.clearController(controller);
    expect(store.getController()).toBeNull();
  });

  it("l'esito dell'invio: avvio, errore con duplicato, successo", () => {
    let state = open("external_link");
    state = articleReducer(state, { type: "publishStarted" });
    expect(state.publish.status).toBe("submitting");
    state = articleReducer(state, { duplicateRef: { contentId: "x", contentType: "club_media" }, error: "article_duplicate", type: "publishFailed" });
    expect(state.publish).toMatchObject({ duplicateRef: { contentId: "x" }, error: "article_duplicate", status: "idle" });
    expect(articleReducer(state, { type: "publishErrorCleared" }).publish.error).toBeNull();
    // Una richiesta di conferma del server riporta la CTA disponibile, senza errore (§219).
    const submitting = articleReducer(open("external_link"), { type: "publishStarted" });
    expect(articleReducer(submitting, { type: "publishIdle" }).publish).toMatchObject({ error: null, status: "idle" });
    expect(articleReducer(state, { type: "submitted" }).submitted).toBe(true);
  });
});
