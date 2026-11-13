import React from "react";
import type TestRenderer from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { videoMock } from "../../../../test/expo-video";
import {
  countTestId,
  findByLabel,
  hostByTestId,
  makeVideoItem,
  makeVideoMedia,
  press,
  pressTestId,
  renderWithToast,
  textOf,
} from "../feed-test-helpers";
import { EditorialVideoFeedItem } from "./EditorialVideoFeedItem";

vi.mock("expo-video", () => import("../../../../test/expo-video"));
vi.mock("expo-router", () => ({ useFocusEffect: () => undefined }));

const NOW = new Date("2026-07-31T12:00:00.000Z");

beforeEach(() => {
  videoMock.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function setup(
  overrides: Parameters<typeof makeVideoItem>[0] = {},
  payload: Parameters<typeof makeVideoItem>[1] = {},
) {
  const props = {
    onComment: vi.fn(),
    onPress: vi.fn(),
    onPressAuthor: vi.fn(),
    onShare: vi.fn(),
    onToggleLike: vi.fn(),
    onToggleSaved: vi.fn(),
  };

  return {
    props,
    tree: renderWithToast(
      <EditorialVideoFeedItem
        item={makeVideoItem(overrides, { summary: "Tutti i gol del weekend.", ...payload })}
        {...props}
      />,
    ),
  };
}

function textNodes(tree: TestRenderer.ReactTestRenderer, text: string) {
  return tree.root.findAll(
    (node) => String(node.type) === "Text" && node.props.children === text,
  );
}

describe("EditorialVideoFeedItem — struttura (§30–34)", () => {
  it("fonte con verifica, riga meta «Video · 2 h», titolo, sommario, miniatura, Play e durata", () => {
    const { tree } = setup();
    const json = textOf(tree);

    expect(json).toContain("Como 1907");
    expect(findByLabel(tree, "Profilo verificato")).toHaveLength(1);
    expect(json).toContain("Video · 2 h");
    expect(json).toContain("Gli highlights della partita");
    expect(json).toContain("Tutti i gol del weekend.");
    expect(json).toContain("https://cdn.test/0-thumb.jpg");
    expect(json).toContain('"name":"play"');
    expect(json).toContain('"1:35"');
  });

  it("ordine: header → titolo → sommario → video → azioni", () => {
    const json = textOf(setup().tree);
    const order = [
      "Como 1907",
      "Gli highlights della partita",
      "Tutti i gol del weekend.",
      "feed-video-media",
      "feed-post-action-like",
    ].map((marker) => json.indexOf(marker));

    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("la label «Video» è discreta: solo testo nella riga meta, nessuna pill dedicata (§32)", () => {
    const { tree } = setup();

    expect(textNodes(tree, "Video")).toHaveLength(0);
    expect(textOf(tree)).toContain("Video · 2 h");
    expect(textOf(tree)).not.toMatch(/Profilo ufficiale/);
  });

  it("titolo fino a tre righe, sommario fino a due", () => {
    const { tree } = setup();
    const lines = tree.root
      .findAll((node) => String(node.type) === "Text")
      .filter((node) =>
        [
          "Gli highlights della partita",
          "Tutti i gol del weekend.",
        ].includes(node.props.children as string),
      )
      .map((node) => node.props.numberOfLines);

    expect(lines).toEqual([3, 2]);
  });

  it("senza sommario non lascia spazio vuoto", () => {
    const { tree } = setup({}, { intro: null, summary: null });

    expect(textOf(tree)).not.toContain("Tutti i gol del weekend.");
    expect(countTestId(tree, "feed-editorial-video-title")).toBe(1);
  });

  it("senza titolo né sommario il blocco testo non esiste", () => {
    const { tree } = setup({ title: null }, { intro: null, summary: null });

    expect(countTestId(tree, "feed-editorial-video-title")).toBe(0);
    expect(countTestId(tree, "feed-video-media")).toBe(1);
  });
});

describe("EditorialVideoFeedItem — tocco sul titolo e Play sono azioni distinte (§35–36)", () => {
  it("il tocco sul titolo apre il dettaglio e non avvia il video", () => {
    const { props, tree } = setup();

    pressTestId(tree, "feed-editorial-video-title");

    expect(props.onPress).toHaveBeenCalledTimes(1);
    expect(videoMock.players).toHaveLength(0);
    expect(countTestId(tree, "feed-video-player")).toBe(0);
  });

  it("il Play avvia inline con lo stesso player e non apre il dettaglio", () => {
    const { props, tree } = setup();

    pressTestId(tree, "feed-video-play");

    expect(props.onPress).not.toHaveBeenCalled();
    expect(countTestId(tree, "feed-video-player")).toBe(1);
    expect(videoMock.players).toHaveLength(1);
    expect(videoMock.last.playing).toBe(true);
    expect(videoMock.fullscreenEnters).toBe(0);
  });

  it("l'area video non è dentro il bersaglio del titolo: sono fratelli", () => {
    const { tree } = setup();
    const [title] = hostByTestId(tree, "feed-editorial-video-title");

    expect(
      title.findAll((node) => typeof node.type === "string" && node.props.testID === "feed-video-play"),
    ).toHaveLength(0);
  });

  it("nessun autoplay all'ingresso (§16)", () => {
    setup();

    expect(videoMock.players).toHaveLength(0);
  });

  it("il tap su autore e nome apre l'autore e nient'altro", () => {
    const { props, tree } = setup();
    const author = tree.root.find(
      (node) =>
        typeof node.type === "string" &&
        typeof node.props.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.startsWith("Como 1907, profilo verificato, Video"),
    );

    author.props.onPress();

    expect(props.onPressAuthor).toHaveBeenCalledTimes(1);
    expect(props.onPress).not.toHaveBeenCalled();
  });
});

describe("EditorialVideoFeedItem — stati del video (§60–70)", () => {
  it("in elaborazione: stato dedicato, senza Play; titolo e azioni restano (§63)", () => {
    const { tree } = setup(
      {},
      {
        media: [makeVideoMedia(0, { processingState: "processing", thumbnailUrl: null, url: null })],
      },
    );
    const json = textOf(tree);

    expect(json).toContain("Video in elaborazione");
    expect(json).toContain("Il video sarà disponibile a breve.");
    expect(countTestId(tree, "feed-video-play")).toBe(0);
    expect(json).toContain("Gli highlights della partita");
    expect(countTestId(tree, "feed-post-action-like")).toBe(1);
  });

  it("non disponibile: stato dedicato, senza Play, il Post non sparisce (§68)", () => {
    const { tree } = setup({}, { media: [makeVideoMedia(0, { availability: "unavailable" })] });
    const json = textOf(tree);

    expect(json).toContain("Video non disponibile");
    expect(json).toContain("Il contenuto non è al momento accessibile.");
    expect(countTestId(tree, "feed-video-play")).toBe(0);
    expect(json).toContain("Como 1907");
  });

  it("senza video nel payload mostra comunque titolo e azioni", () => {
    const { tree } = setup({}, { media: [] });

    expect(countTestId(tree, "feed-video-media")).toBe(0);
    expect(countTestId(tree, "feed-editorial-video-title")).toBe(1);
    expect(countTestId(tree, "feed-post-action-like")).toBe(1);
  });
});

describe("EditorialVideoFeedItem — segnalibro e azioni (§37, §52–59)", () => {
  it("il segnalibro è nell'header e usa il toggle del Saved system", () => {
    const { props, tree } = setup();
    const json = textOf(tree);

    expect(countTestId(tree, "feed-bookmark")).toBe(1);
    expect(json.indexOf("feed-bookmark")).toBeLessThan(json.indexOf("feed-editorial-video-title"));

    press(tree, "Salva");

    expect(props.onToggleSaved).toHaveBeenCalledTimes(1);
  });

  it("salvato: etichetta «Rimuovi dai salvati»", () => {
    const { tree } = setup({ isSaved: true });

    expect(findByLabel(tree, "Rimuovi dai salvati")).toHaveLength(1);
  });

  it("la riga azioni è quella del Post: tre azioni, nessun segnalibro tra loro", () => {
    const { tree } = setup();
    const actions = tree.root.findAll(
      (node) =>
        typeof node.type === "string" &&
        typeof node.props.testID === "string" &&
        node.props.testID.startsWith("feed-post-action-"),
    );

    expect(actions).toHaveLength(3);
  });

  it("conteggi nello stesso controllo, mai «0» a zero (§53–54)", () => {
    const zero = setup();
    expect(findByLabel(zero.tree, "Mi piace")).toHaveLength(1);
    expect(textOf(zero.tree)).not.toContain('"0"');

    const counted = setup({}, { commentsCount: 27, likesCount: 234 });
    expect(findByLabel(counted.tree, "234 Mi piace")).toHaveLength(1);
    expect(findByLabel(counted.tree, "27 commenti")).toHaveLength(1);
  });

  it("Mi piace, Commenta e Condividi chiamano gli handler dell'elemento editoriale", () => {
    const { props, tree } = setup();

    pressTestId(tree, "feed-post-action-like");
    pressTestId(tree, "feed-post-action-comment");
    pressTestId(tree, "feed-post-action-share");

    expect(props.onToggleLike).toHaveBeenCalledTimes(1);
    expect(props.onComment).toHaveBeenCalledTimes(1);
    expect(props.onShare).toHaveBeenCalledTimes(1);
  });
});
