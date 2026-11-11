import React from "react";
import type TestRenderer from "react-test-renderer";
import { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FEED_POST_SHOW_LESS, FEED_POST_SHOW_MORE } from "../../feed-labels";
import type {
  FeedAuthorMeta,
  FeedLinkPreview,
  FeedMediaItem,
  FeedMention,
  FeedPostPayload,
  FeedTaggedIdentity,
} from "../../feed-types";
import {
  countTestId,
  findByLabel,
  makeMediaItem,
  makePostItem,
  press,
  pressMatching,
  renderWithToast,
  textOf,
} from "../feed-test-helpers";
import { PostFeedItem } from "./PostFeedItem";

const NOW = new Date("2026-07-31T12:00:00.000Z");

beforeEach(() => {
  // Solo `Date`: il tempo relativo dell'header deve essere deterministico
  // (la fixture è pubblicata alle 10:00), i timer reali restano intatti.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function setup(payload: Partial<FeedPostPayload> = {}, overrides: Parameters<typeof makePostItem>[0] = {}) {
  const props = {
    onComment: vi.fn(),
    onOpenIdentity: vi.fn(),
    onOpenLink: vi.fn(),
    onOpenMedia: vi.fn(),
    onPress: vi.fn(),
    onPressAuthor: vi.fn(),
    onShare: vi.fn(),
    onToggleLike: vi.fn(),
    onToggleSaved: vi.fn(),
  };

  return {
    props,
    tree: renderWithToast(<PostFeedItem item={makePostItem(overrides, payload)} {...props} />),
  };
}

const meta = (overrides: Partial<FeedAuthorMeta>): FeedAuthorMeta => ({
  clubCategory: null,
  clubName: null,
  mediaKind: null,
  primaryPosition: null,
  role: null,
  teamLabel: null,
  ...overrides,
});

function hostByTestId(tree: TestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll(
    (node) => typeof node.type === "string" && node.props?.testID === testID,
  );
}

function countTestIdPrefix(tree: TestRenderer.ReactTestRenderer, prefix: string): number {
  return tree.root.findAll(
    (node) =>
      typeof node.type === "string" &&
      typeof node.props?.testID === "string" &&
      node.props.testID.startsWith(prefix),
  ).length;
}

function pressTestId(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const target = hostByTestId(tree, testID).find((node) => typeof node.props.onPress === "function");

  if (!target) {
    throw new Error(`Nessun elemento premibile con testID "${testID}"`);
  }

  act(() => {
    target.props.onPress();
  });
}

function taggedSheets(tree: TestRenderer.ReactTestRenderer) {
  // Il Modal del foglio tag è l'unico con animazione slide; il menu usa fade.
  return tree.root.findAll(
    (node) => String(node.type) === "Modal" && node.props?.animationType === "slide",
  );
}

const mention = (overrides: Partial<FeedMention> = {}): FeedMention => ({
  displayName: "Marco Bianchi",
  end: 30,
  identityId: "p-marco",
  identityType: "profile",
  start: 16,
  ...overrides,
});

const tag = (
  id: string,
  name: string,
  identityType: FeedTaggedIdentity["identityType"] = "profile",
): FeedTaggedIdentity => ({ avatarUrl: null, displayName: name, identityId: id, identityType });

const MENTION_BODY = "Allenamento con @Marco Bianchi oggi";

const preview: FeedLinkPreview = {
  description: "La cronaca della partita.",
  domain: "gazzetta.it",
  thumbnailUrl: null,
  title: "Il Como vince a Lecco",
  url: "https://www.gazzetta.it/calcio/serie-d/como-lecco-cronaca-completa?utm_source=app",
};

describe("PostFeedItem — contenuto", () => {
  it("mostra autore, titolo e testo", () => {
    const json = textOf(setup().tree);

    expect(json).toContain("Como 1907");
    expect(json).toContain("Buon lavoro, ragazzi!");
    expect(json).toContain("Testo del post.");
  });

  it("un post di solo testo non ha nodo media né preview e non riserva altezza (§12)", () => {
    const { tree } = setup();

    expect(countTestId(tree, "feed-post-media")).toBe(0);
    expect(countTestId(tree, "feed-post-link-preview")).toBe(0);
    expect(countTestIdPrefix(tree, "feed-post-media-cell-")).toBe(0);
  });

  it("senza testo né titolo mostra comunque header e azioni", () => {
    const { tree } = setup({ body: null, text: null }, { title: null });
    const json = textOf(tree);

    expect(countTestId(tree, "feed-post-body")).toBe(0);
    expect(json).toContain("Mi piace");
  });

  it("rispetta l'ordine del §3: header, titolo, testo, preview, media, azioni", () => {
    const { tree } = setup({
      linkPreview: preview,
      media: [makeMediaItem(0)],
    });
    const json = textOf(tree);
    const order = [
      "Como 1907",
      "Buon lavoro, ragazzi!",
      "Testo del post.",
      "feed-post-link-preview",
      "feed-post-media",
      "feed-post-action-like",
    ].map((marker) => json.indexOf(marker));

    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe("PostFeedItem — header autore", () => {
  it("persona: ruolo · Società · tempo", () => {
    const { tree } = setup({
      authorIdentityType: "person",
      authorMeta: meta({ clubName: "AC Como", primaryPosition: "striker", role: "player" }),
    });

    expect(textOf(tree)).toContain("Attaccante · AC Como · 2 h");
  });

  it("Allenatore: ruolo · Team · tempo (§5)", () => {
    const { tree } = setup({
      authorIdentityType: "person",
      authorMeta: meta({ role: "coach", teamLabel: "Settore giovanile" }),
    });

    expect(textOf(tree)).toContain("Allenatore · Settore giovanile · 2 h");
  });

  it("Società: categoria · tempo, senza prefisso né badge", () => {
    const { tree } = setup({
      authorIdentityType: "society",
      authorMeta: meta({ clubCategory: "Serie D" }),
    });
    const json = textOf(tree);

    expect(json).toContain("Serie D · 2 h");
    expect(json).not.toContain("Società ·");
  });

  it("Media: tipologia · tempo", () => {
    const { tree } = setup({
      authorIdentityType: "media",
      authorMeta: meta({ mediaKind: "testata" }),
    });

    expect(textOf(tree)).toContain("Testata sportiva · 2 h");
  });

  it("non compare mai «Profilo ufficiale» né il motivo di suggerimento (§8, §9)", () => {
    const { tree } = setup(
      { authorIdentityType: "media", authorMeta: meta({ mediaKind: "ufficiale" }) },
      { reasonLabel: "Dalla tua zona" },
    );
    const json = textOf(tree);

    expect(json).not.toContain("Profilo ufficiale");
    expect(json).not.toContain("Dalla tua zona");
  });

  it("il check di verifica è il componente standard, una volta sola", () => {
    const { tree } = setup();

    expect(findByLabel(tree, "Profilo verificato")).toHaveLength(1);
  });

  it("senza verifica non c'è check", () => {
    const { tree } = setup(
      {},
      {
        author: {
          avatarUrl: null,
          id: "p-1",
          isVerified: false,
          kind: "profile",
          name: "Matteo Rossi",
          sourceKind: null,
        },
      },
    );

    expect(findByLabel(tree, "Profilo verificato")).toHaveLength(0);
  });

  it("il tap su avatar e nome apre l'autore e nient'altro (§7)", () => {
    const { props, tree } = setup();

    pressMatching(tree, /^Como 1907, profilo verificato, pubblicato 2 ore fa$/);

    expect(props.onPressAuthor).toHaveBeenCalledTimes(1);
    expect(props.onPress).not.toHaveBeenCalled();
  });

  it("il tap sul corpo non apre l'autore", () => {
    const { props, tree } = setup();
    const body = tree.root.find(
      (node) => String(node.type) === "Pressable" && node.props.accessible === false,
    );

    act(() => {
      body.props.onPress();
    });

    expect(props.onPress).toHaveBeenCalledTimes(1);
    expect(props.onPressAuthor).not.toHaveBeenCalled();
  });

  it("espone il menu contestuale e vi lascia Salva (§62)", () => {
    const { tree } = setup();

    expect(() => press(tree, "Altre azioni")).not.toThrow();
    expect(textOf(tree)).toContain('"Salva"');
  });

  it("senza capability di salvataggio il menu non offre Salva", () => {
    const { tree } = setup({
      capabilities: { ...makePostItem().payload.capabilities, canSave: false },
    });

    expect(textOf(tree)).not.toContain('"Salva"');
  });
});

describe("PostFeedItem — Mostra altro", () => {
  const LONG_BODY = "x".repeat(300);

  it("testo breve: tutto il testo, nessun controllo e nessuna misura (§13)", () => {
    const { tree } = setup();

    expect(findByLabel(tree, FEED_POST_SHOW_MORE)).toHaveLength(0);
    expect(countTestId(tree, "feed-post-body-measure")).toBe(0);
  });

  it("testo con molti a capo: Mostra altro subito, senza misura", () => {
    const { tree } = setup({ body: "a\nb\nc\nd\ne\nf\ng" });

    expect(findByLabel(tree, FEED_POST_SHOW_MORE).length).toBeGreaterThan(0);
    expect(countTestId(tree, "feed-post-body-measure")).toBe(0);
  });

  it("testo da misurare: il layout reale decide (oltre 5 righe)", () => {
    const { tree } = setup({ body: LONG_BODY });

    expect(findByLabel(tree, FEED_POST_SHOW_MORE)).toHaveLength(0);

    const [measure] = hostByTestId(tree, "feed-post-body-measure");

    act(() => {
      measure.props.onTextLayout({ nativeEvent: { lines: Array.from({ length: 7 }, () => ({})) } });
    });

    expect(findByLabel(tree, FEED_POST_SHOW_MORE).length).toBeGreaterThan(0);
    expect(countTestId(tree, "feed-post-body-measure")).toBe(0);
  });

  it("testo da misurare ma entro cinque righe: nessun controllo", () => {
    const { tree } = setup({ body: LONG_BODY });
    const [measure] = hostByTestId(tree, "feed-post-body-measure");

    act(() => {
      measure.props.onTextLayout({ nativeEvent: { lines: Array.from({ length: 4 }, () => ({})) } });
    });

    expect(findByLabel(tree, FEED_POST_SHOW_MORE)).toHaveLength(0);
    expect(findByLabel(tree, FEED_POST_SHOW_LESS)).toHaveLength(0);
  });

  it("espande inline e richiude, senza aprire il contenuto (§15, §16)", () => {
    const { props, tree } = setup({ body: "a\nb\nc\nd\ne\nf\ng" });
    const bodyLines = () => hostByTestId(tree, "feed-post-body")[0].props.numberOfLines;

    expect(bodyLines()).toBe(5);

    press(tree, FEED_POST_SHOW_MORE);

    expect(bodyLines()).toBeUndefined();
    expect(findByLabel(tree, FEED_POST_SHOW_LESS).length).toBeGreaterThan(0);

    press(tree, FEED_POST_SHOW_LESS);

    expect(bodyLines()).toBe(5);
    expect(findByLabel(tree, FEED_POST_SHOW_MORE).length).toBeGreaterThan(0);
    expect(props.onPress).not.toHaveBeenCalled();
  });
});

describe("PostFeedItem — mention e tag", () => {
  it("il tap su una mention apre l'identità per id e non il contenuto (§19)", () => {
    const { props, tree } = setup({ body: MENTION_BODY, mentions: [mention()] });

    press(tree, "Apri Marco Bianchi");

    expect(props.onOpenIdentity).toHaveBeenCalledTimes(1);
    expect(props.onOpenIdentity).toHaveBeenCalledWith({
      identityId: "p-marco",
      identityType: "profile",
    });
    expect(props.onPress).not.toHaveBeenCalled();
  });

  it("una mention a una Società apre il club", () => {
    const { props, tree } = setup({
      body: MENTION_BODY,
      mentions: [mention({ displayName: "AC Como", identityId: "c-como", identityType: "club" })],
    });

    press(tree, "Apri AC Como");

    expect(props.onOpenIdentity).toHaveBeenCalledWith({
      identityId: "c-como",
      identityType: "club",
    });
  });

  it("nessun tag: nessuna riga «Con …»", () => {
    const { tree } = setup();

    expect(
      tree.root.findAll(
        (node) =>
          typeof node.type === "string" &&
          typeof node.props?.accessibilityLabel === "string" &&
          node.props.accessibilityLabel.startsWith("Con "),
      ),
    ).toHaveLength(0);
  });

  it("un tag già menzionato non si ripete sotto (§21)", () => {
    const { tree } = setup({
      body: MENTION_BODY,
      mentions: [mention()],
      tagged: [tag("p-marco", "Marco Bianchi")],
    });

    expect(findByLabel(tree, "Con Marco Bianchi")).toHaveLength(0);
    expect(taggedSheets(tree)).toHaveLength(0);
  });

  it("toglie il già menzionato e tiene gli altri", () => {
    const { tree } = setup({
      body: MENTION_BODY,
      mentions: [mention()],
      tagged: [tag("p-marco", "Marco Bianchi"), tag("p-luca", "Luca Neri")],
    });

    expect(findByLabel(tree, "Con Luca Neri")).toHaveLength(1);
  });

  it("un solo tag apre direttamente l'identità, senza foglio", () => {
    const { props, tree } = setup({ tagged: [tag("p-luca", "Luca Neri")] });

    press(tree, "Con Luca Neri");

    expect(props.onOpenIdentity).toHaveBeenCalledWith({
      identityId: "p-luca",
      identityType: "profile",
    });
    expect(taggedSheets(tree)).toHaveLength(0);
  });

  it("più tag: sintesi «e altre N persone» e foglio con la lista (§22)", () => {
    const { props, tree } = setup({
      tagged: [
        tag("p1", "Luca Neri"),
        tag("p2", "Anna Verdi"),
        tag("p3", "Paolo Gialli"),
        tag("p4", "Sara Blu"),
      ],
    });

    expect(findByLabel(tree, "Con Luca Neri e altre 3 persone")).toHaveLength(1);
    expect(taggedSheets(tree)[0].props.visible).toBe(false);

    press(tree, "Con Luca Neri e altre 3 persone");

    expect(taggedSheets(tree)[0].props.visible).toBe(true);
    expect(props.onOpenIdentity).not.toHaveBeenCalled();

    // La scelta di un profilo nel foglio chiude il foglio e apre l'identità.
    const row = tree.root
      .findAll(
        (node) =>
          String(node.type) === "Pressable" &&
          node.props.accessibilityRole === "button" &&
          node.findAll((child) => child.props?.children === "Anna Verdi").length > 0,
      )
      .at(-1);

    act(() => {
      row?.props.onPress();
    });

    expect(props.onOpenIdentity).toHaveBeenCalledWith({
      identityId: "p2",
      identityType: "profile",
    });
    expect(taggedSheets(tree)[0].props.visible).toBe(false);
  });
});

describe("PostFeedItem — link preview", () => {
  it("mostra titolo, descrizione e dominio, mai l'URL lungo (§43)", () => {
    const { tree } = setup({ linkPreview: preview });
    const json = textOf(tree);

    expect(json).toContain("Il Como vince a Lecco");
    expect(json).toContain("La cronaca della partita.");
    expect(json).toContain("gazzetta.it");
    expect(json).not.toContain("https://");
    expect(json).not.toContain("utm_source");
  });

  it("il tap apre il link tramite l'handler (§45)", () => {
    const { props, tree } = setup({ linkPreview: preview });

    press(tree, "Il Como vince a Lecco, gazzetta.it");

    expect(props.onOpenLink).toHaveBeenCalledTimes(1);
  });

  it("senza titolo il dominio fa da titolo e non si ripete", () => {
    const { tree } = setup({ linkPreview: { ...preview, description: null, title: null } });

    expect(textOf(tree).split("gazzetta.it").length - 1).toBeGreaterThan(0);
    expect(findByLabel(tree, "gazzetta.it")).toHaveLength(1);
  });
});

describe("PostFeedItem — media collection", () => {
  const images = (count: number): FeedMediaItem[] =>
    Array.from({ length: count }, (_, index) => makeMediaItem(index));

  it("un media: una sola cella, immagine ampia", () => {
    const { tree } = setup({ media: images(1) });

    expect(countTestId(tree, "feed-post-media")).toBe(1);
    expect(countTestIdPrefix(tree, "feed-post-media-cell-")).toBe(1);
  });

  it.each([
    [2, 2],
    [3, 3],
    [4, 4],
    [5, 4],
    [10, 4],
  ])("con %i media si disegnano %i celle", (count, cells) => {
    const { tree } = setup({ media: images(count) });

    expect(countTestIdPrefix(tree, "feed-post-media-cell-")).toBe(cells);
  });

  it.each([
    [5, "+1"],
    [7, "+3"],
    [10, "+6"],
  ])("con %i media l'ultima cella mostra %s (§31)", (count, label) => {
    const { tree } = setup({ media: images(count) });

    expect(textOf(tree)).toContain(`"${label}"`);
    expect(findByLabel(tree, `Gallery con ${count} contenuti`)).toHaveLength(1);
  });

  it("fino a quattro media non compare +N", () => {
    expect(textOf(setup({ media: images(4) }).tree)).not.toMatch(/"\+\d+"/);
  });

  it("un video mostra Play e durata «0:48» (§27)", () => {
    const { tree } = setup({
      media: [makeMediaItem(0, { durationSeconds: 48, type: "video" })],
    });
    const json = textOf(tree);

    expect(json).toContain('"0:48"');
    expect(json).toContain('"name":"play"');
    expect(findByLabel(tree, "Video, durata 48 secondi")).toHaveLength(1);
  });

  it("foto + video: il video mostra durata, la foto no, e l'ordine è quello dell'autore", () => {
    const { tree } = setup({
      media: [
        makeMediaItem(1, { durationSeconds: 90, id: "v", type: "video" }),
        makeMediaItem(0, { id: "i" }),
      ],
    });

    expect(countTestId(tree, "feed-post-media-duration")).toBe(1);
    // La foto (posizione 0) è la prima cella, il video la seconda.
    expect(findByLabel(tree, "Immagine 1 di 2")).toHaveLength(1);
    expect(hostByTestId(tree, "feed-post-media-cell-1")[0].props.accessibilityLabel).toBe(
      "Video, durata 1 minuto e 30 secondi",
    );
  });

  it("video + video: ciascuna cella ha la sua durata, anche piccola (§33)", () => {
    const { tree } = setup({
      media: [
        makeMediaItem(0, { durationSeconds: 48, type: "video" }),
        makeMediaItem(1, { durationSeconds: 62, type: "video" }),
      ],
    });
    const json = textOf(tree);

    expect(json).toContain('"0:48"');
    expect(json).toContain('"1:02"');
  });

  it("video sulla quarta cella con +N: niente durata, Play ridotto (§34)", () => {
    const { tree } = setup({
      media: [
        ...images(3),
        makeMediaItem(3, { durationSeconds: 48, type: "video" }),
        makeMediaItem(4),
      ],
    });

    expect(textOf(tree)).toContain('"+1"');
    expect(countTestId(tree, "feed-post-media-duration")).toBe(0);
    expect(textOf(tree)).toContain('"name":"play"');
  });

  it("il tap su una cella comunica l'indice nella collezione (§35)", () => {
    const { props, tree } = setup({ media: images(3) });

    pressTestId(tree, "feed-post-media-cell-2");

    expect(props.onOpenMedia).toHaveBeenCalledWith(2);
    expect(props.onPress).not.toHaveBeenCalled();
  });

  it("il tap sulla cella +N apre con l'indice dell'ultima cella (§32)", () => {
    const { props, tree } = setup({ media: images(7) });

    pressTestId(tree, "feed-post-media-cell-3");

    expect(props.onOpenMedia).toHaveBeenCalledWith(3);
  });

  it("il tap su un video comunica il suo indice", () => {
    const { props, tree } = setup({
      media: [makeMediaItem(0), makeMediaItem(1, { durationSeconds: 10, type: "video" })],
    });

    pressTestId(tree, "feed-post-media-cell-1");

    expect(props.onOpenMedia).toHaveBeenCalledWith(1);
  });

  it("una cella fallita mostra il suo stato e non rompe il Post (§41, §87)", () => {
    const { tree } = setup({
      media: [
        makeMediaItem(0, { availability: "unavailable", url: null, thumbnailUrl: null }),
        makeMediaItem(1, {
          availability: "unavailable",
          processingState: "processing",
          thumbnailUrl: null,
          type: "video",
          url: null,
        }),
        makeMediaItem(2, { processingState: "failed", type: "video" }),
        makeMediaItem(3),
      ],
    });
    const json = textOf(tree);

    expect(json).toContain("Immagine non disponibile");
    expect(json).toContain("Video in elaborazione");
    expect(json).toContain("Video non disponibile");
    // Il resto del Post resta intero.
    expect(json).toContain("Testo del post.");
    expect(countTestIdPrefix(tree, "feed-post-action-")).toBe(3);
  });

  it("una cella non riproducibile non è un tap morto: non è premibile", () => {
    const { tree } = setup({
      media: [makeMediaItem(0, { availability: "unavailable", url: null, thumbnailUrl: null })],
    });

    expect(() => pressTestId(tree, "feed-post-media-cell-0")).toThrow();
  });

  it("un'immagine con alt text lo usa come etichetta (§74)", () => {
    const { tree } = setup({ media: [makeMediaItem(0, { altText: "Esultanza dopo il gol" })] });

    expect(findByLabel(tree, "Esultanza dopo il gol")).toHaveLength(1);
  });
});

describe("PostFeedItem — riga azioni", () => {
  it("zero: «Mi piace» e «Commenta» senza mai «0» (§50, §55)", () => {
    const { tree } = setup();
    const json = textOf(tree);

    expect(findByLabel(tree, "Mi piace")).toHaveLength(1);
    expect(findByLabel(tree, "Commenta")).toHaveLength(1);
    expect(findByLabel(tree, "Condividi")).toHaveLength(1);
    expect(json).not.toContain('"0"');
    expect(json).not.toMatch(/0 (Mi piace|commenti)/);
  });

  it("con conteggi: «146» e «18» con etichetta parlata, un solo controllo Mi piace (§48, §107)", () => {
    const { tree } = setup({ commentsCount: 18, likesCount: 146 });
    const json = textOf(tree);

    expect(json).toContain('"146"');
    expect(json).toContain('"18"');
    expect(findByLabel(tree, "146 Mi piace")).toHaveLength(1);
    expect(findByLabel(tree, "18 commenti")).toHaveLength(1);
    // Nessun secondo «Mi piace» separato né «Commenta» ripetuto.
    expect(findByLabel(tree, "Mi piace")).toHaveLength(0);
    expect(findByLabel(tree, "Commenta")).toHaveLength(0);
    expect(countTestId(tree, "feed-post-action-like")).toBe(1);
  });

  it("numeri in formato italiano (§105)", () => {
    const { tree } = setup({ commentsCount: 12486, likesCount: 1234 });
    const json = textOf(tree);

    expect(json).toContain('"1.234"');
    expect(json).toContain('"12.486"');
    expect(json).not.toMatch(/1[.,]2K/);
  });

  it("Mi piace attivo: stesso controllo, selezionato, icona piena, numero attuale (§52)", () => {
    const { tree } = setup({ isLiked: true, likesCount: 147 });
    const [like] = hostByTestId(tree, "feed-post-action-like");
    const json = textOf(tree);

    expect(like.props.accessibilityState).toEqual({ selected: true });
    expect(like.props.accessibilityLabel).toBe("147 Mi piace");
    expect(json).toContain('"name":"thumbs-up"');
    expect(json).toContain('"147"');
    expect(countTestId(tree, "feed-post-action-like")).toBe(1);
  });

  it("Mi piace non attivo: icona vuota e non selezionato", () => {
    const { tree } = setup({ likesCount: 3 });
    const [like] = hostByTestId(tree, "feed-post-action-like");

    expect(like.props.accessibilityState).toEqual({ selected: false });
    expect(textOf(tree)).toContain('"name":"thumbs-up-outline"');
  });

  it("Condividi non mostra mai un conteggio", () => {
    const { tree } = setup({ commentsCount: 9, likesCount: 9 });
    const [share] = hostByTestId(tree, "feed-post-action-share");

    const texts = share
      .findAll((node) => String(node.type) === "Text")
      .map((node) => node.props.children);

    expect(share.props.accessibilityLabel).toBe("Condividi");
    expect(texts).toEqual(["Condividi"]);
  });

  it("la riga ha esattamente tre azioni e nessun segnalibro (§49, §62)", () => {
    const { tree } = setup();

    expect(countTestIdPrefix(tree, "feed-post-action-")).toBe(3);
    expect(findByLabel(tree, "Salva contenuto")).toHaveLength(0);
    expect(findByLabel(tree, "Rimuovi dai salvati")).toHaveLength(0);
  });

  it("le tre azioni hanno la stessa larghezza flessibile (§59–60)", () => {
    const { tree } = setup();
    // Ogni azione passa a Pressable una funzione `({ pressed }) => [stile, …]`.
    const flexOf = (id: string) => {
      const resolve = hostByTestId(tree, id)[0].props.style as (state: {
        pressed: boolean;
      }) => ({ flex?: number } | null)[];

      return resolve({ pressed: false }).find((entry) => entry?.flex !== undefined)?.flex;
    };

    expect(flexOf("feed-post-action-like")).toBe(1);
    expect(flexOf("feed-post-action-comment")).toBe(1);
    expect(flexOf("feed-post-action-share")).toBe(1);
  });

  it("i tap chiamano gli handler, una volta ciascuno", () => {
    const { props, tree } = setup({ commentsCount: 2, likesCount: 5 });

    pressTestId(tree, "feed-post-action-like");
    pressTestId(tree, "feed-post-action-comment");
    pressTestId(tree, "feed-post-action-share");

    expect(props.onToggleLike).toHaveBeenCalledTimes(1);
    expect(props.onComment).toHaveBeenCalledTimes(1);
    expect(props.onShare).toHaveBeenCalledTimes(1);
  });

  it("anche senza capability di Like il tap raggiunge l'handler, che risponde", () => {
    const { props, tree } = setup({
      capabilities: { ...makePostItem().payload.capabilities, canLike: false },
    });

    pressTestId(tree, "feed-post-action-like");

    expect(props.onToggleLike).toHaveBeenCalledTimes(1);
  });

  it("il segnalibro del menu invoca il salvataggio", () => {
    const { props, tree } = setup();
    const save = tree.root
      .findAll(
        (node) =>
          String(node.type) === "Pressable" &&
          node.props.accessibilityRole === "button" &&
          node.findAll((child) => child.props?.children === "Salva").length > 0,
      )
      .at(-1);

    act(() => {
      save?.props.onPress();
    });

    expect(props.onToggleSaved).toHaveBeenCalledTimes(1);
  });
});
