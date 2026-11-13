import React from "react";
import type TestRenderer from "react-test-renderer";
import { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  countTestId,
  findByLabel,
  hostByTestId,
  makeArticleItem,
  makeMediaItem,
  press,
  pressTestId,
  renderWithToast,
  textOf,
} from "../feed-test-helpers";
import { ArticleFeedPreview } from "./ArticleFeedPreview";

const dimensions = vi.hoisted(() => ({ fontScale: 1 }));

vi.mock("react-native", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-native")>()),
  useWindowDimensions: () => ({
    fontScale: dimensions.fontScale,
    height: 812,
    scale: 3,
    width: 390,
  }),
}));

const NOW = new Date("2026-07-31T12:00:00.000Z");

beforeEach(() => {
  dimensions.fontScale = 1;
  // Solo `Date`: la riga meta è relativa alle 10:00 della fixture.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function setup(
  overrides: Parameters<typeof makeArticleItem>[0] = {},
  payload: Parameters<typeof makeArticleItem>[1] = {},
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
      <ArticleFeedPreview
        item={makeArticleItem(overrides, {
          media: [makeMediaItem(0)],
          ...payload,
        })}
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

describe("ArticleFeedPreview — struttura compatta (§41–46)", () => {
  it("fonte, verifica, riga meta «Articolo · 2 h», titolo, sommario e miniatura", () => {
    const { tree } = setup();
    const json = textOf(tree);

    expect(json).toContain("Como 1907");
    expect(findByLabel(tree, "Profilo verificato")).toHaveLength(1);
    expect(json).toContain("Articolo · 2 h");
    expect(json).toContain("Il calcio italiano e i giovani talenti");
    expect(json).toContain("Analisi sui protagonisti emergenti.");
    expect(countTestId(tree, "feed-article-cover")).toBe(1);
  });

  it("layout orizzontale: testo a sinistra, miniatura di 96pt a destra (§43)", () => {
    const { tree } = setup();
    const [layout] = hostByTestId(tree, "feed-article-layout");
    const [cover] = hostByTestId(tree, "feed-article-cover");

    expect((layout.props.style as { flexDirection: string }).flexDirection).toBe("row");
    expect((cover.props.style as { width: number }).width).toBe(96);
    // L'ordine nell'albero è testo → miniatura.
    const json = textOf(tree);
    expect(json.indexOf("feed-article-title")).toBeLessThan(json.indexOf("feed-article-cover"));
  });

  it("titolo fino a tre righe, sommario fino a due (§44–45)", () => {
    const { tree } = setup();

    expect(hostByTestId(tree, "feed-article-title")[0].props.numberOfLines).toBe(3);
    expect(hostByTestId(tree, "feed-article-summary")[0].props.numberOfLines).toBe(2);
  });

  it("senza sommario il componente resta compatto, senza spazio vuoto (§45)", () => {
    const { tree } = setup({}, { intro: null, summary: null });

    expect(countTestId(tree, "feed-article-summary")).toBe(0);
    expect(countTestId(tree, "feed-article-title")).toBe(1);
    expect(countTestId(tree, "feed-article-cover")).toBe(1);
  });

  it("senza cover resta solo testo (nessuna miniatura riservata)", () => {
    const { tree } = setup({}, { media: [], thumbnailUrl: null });

    expect(countTestId(tree, "feed-article-cover")).toBe(0);
    expect(countTestId(tree, "feed-article-body")).toBe(1);
  });

  it("la cover può arrivare dalla miniatura legacy del payload", () => {
    const { tree } = setup({}, { media: [], thumbnailUrl: "https://cdn.test/legacy.jpg" });

    expect(textOf(tree)).toContain("https://cdn.test/legacy.jpg");
  });

  it("una cover che non carica sparisce senza rompere la preview", () => {
    const { tree } = setup();
    const [cover] = hostByTestId(tree, "feed-article-cover");

    act(() => {
      cover.props.onError();
    });

    expect(countTestId(tree, "feed-article-cover")).toBe(0);
    expect(countTestId(tree, "feed-article-title")).toBe(1);
  });

  it("la micro-CTA «Leggi articolo» è un segno piccolo, non un controllo a sé (§47)", () => {
    const { tree } = setup();

    expect(textNodes(tree, "Leggi articolo")).toHaveLength(1);
    expect(countTestId(tree, "feed-article-cta")).toBe(1);
    expect(hostByTestId(tree, "feed-article-cta")[0].props.onPress).toBeUndefined();
  });
});

describe("ArticleFeedPreview — una sola preview (§39–40, §89–90)", () => {
  it("nessuna variante large/compact: lo stesso albero per ogni layoutHint", () => {
    const hints = ["compact", "standard", "tall", "carousel"] as const;
    const trees = hints.map((layoutHint) => textOf(setup({ layoutHint }).tree));

    expect(new Set(trees).size).toBe(1);
  });

  it("Media e Società usano lo stesso renderer: cambiano solo identità e logo", () => {
    const media = setup(
      {},
      { authorIdentityType: "media", authorMeta: { ...makeArticleItem().payload.authorMeta, mediaKind: "testata" } },
    );
    const society = setup(
      {},
      {
        authorIdentityType: "society",
        authorMeta: { ...makeArticleItem().payload.authorMeta, clubCategory: "Serie D" },
      },
    );

    for (const { tree } of [media, society]) {
      expect(countTestId(tree, "feed-article")).toBe(1);
      expect(countTestId(tree, "feed-article-body")).toBe(1);
      // Il formato è la riga meta; mai «Società ·» né «Profilo ufficiale».
      expect(textOf(tree)).toContain("Articolo · 2 h");
      expect(textOf(tree)).not.toMatch(/Società ·|Profilo ufficiale/);
    }
  });

  it("Dynamic Type alto: layout verticale, miniatura sotto il testo, font invariato (§127)", () => {
    dimensions.fontScale = 1.5;
    const { tree } = setup();
    const [layout] = hostByTestId(tree, "feed-article-layout");
    const [cover] = hostByTestId(tree, "feed-article-cover");

    expect((layout.props.style as { flexDirection?: string }).flexDirection).toBeUndefined();
    expect((cover.props.style as { width: string }).width).toBe("100%");
    // La CTA non si taglia: resta nel testo, che non ha righe massime.
    expect(textNodes(tree, "Leggi articolo")).toHaveLength(1);
  });

  it("a 1,29 resta orizzontale", () => {
    dimensions.fontScale = 1.29;
    const { tree } = setup();

    expect((hostByTestId(tree, "feed-article-layout")[0].props.style as { flexDirection: string }).flexDirection).toBe("row");
  });
});

describe("ArticleFeedPreview — tocco e accessibilità (§47–48, §85)", () => {
  it("titolo, sommario, CTA e miniatura stanno tutti dentro un solo bersaglio di tocco", () => {
    const { tree } = setup();
    const [body] = hostByTestId(tree, "feed-article-body");
    const inside = (testID: string) =>
      body.findAll((node) => typeof node.type === "string" && node.props.testID === testID);

    expect(inside("feed-article-title")).toHaveLength(1);
    expect(inside("feed-article-summary")).toHaveLength(1);
    expect(inside("feed-article-cta")).toHaveLength(1);
    expect(inside("feed-article-cover")).toHaveLength(1);
  });

  it("il tocco sulla preview apre il dettaglio, una volta, senza aprire l'autore", () => {
    const { props, tree } = setup();

    pressTestId(tree, "feed-article-body");

    expect(props.onPress).toHaveBeenCalledTimes(1);
    expect(props.onPressAuthor).not.toHaveBeenCalled();
  });

  it("il tap su autore e nome apre l'autore e nient'altro", () => {
    const { props, tree } = setup();
    const author = tree.root.find(
      (node) =>
        typeof node.type === "string" &&
        typeof node.props.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.startsWith("Como 1907, profilo verificato, Articolo"),
    );

    author.props.onPress();

    expect(props.onPressAuthor).toHaveBeenCalledTimes(1);
    expect(props.onPress).not.toHaveBeenCalled();
  });

  it("la preview ha etichetta (titolo e sommario) e suggerimento «Leggi articolo»", () => {
    const { tree } = setup();
    const [body] = hostByTestId(tree, "feed-article-body");

    expect(body.props.accessibilityLabel).toBe(
      "Il calcio italiano e i giovani talenti. Analisi sui protagonisti emergenti.",
    );
    expect(body.props.accessibilityHint).toBe("Leggi articolo");
    expect(body.props.accessibilityRole).toBe("button");
  });

  it("la miniatura ha un testo alternativo (§85)", () => {
    const withTitle = setup();
    const withAlt = setup({}, { media: [makeMediaItem(0, { altText: "Stadio di Como" })] });

    expect(hostByTestId(withTitle.tree, "feed-article-cover")[0].props.accessibilityLabel).toBe(
      "Copertina: Il calcio italiano e i giovani talenti",
    );
    expect(hostByTestId(withAlt.tree, "feed-article-cover")[0].props.accessibilityLabel).toBe(
      "Stadio di Como",
    );
  });
});

describe("ArticleFeedPreview — segnalibro e riga azioni (§51–59)", () => {
  it("il segnalibro è nell'header, discreto, e mostra il suo stato a parole", () => {
    const { tree } = setup();
    const json = textOf(tree);

    expect(countTestId(tree, "feed-bookmark")).toBe(1);
    expect(findByLabel(tree, "Salva")).toHaveLength(1);
    // Ordine: header (con il segnalibro) → preview → riga azioni.
    expect(json.indexOf("feed-bookmark")).toBeGreaterThan(-1);
    expect(json.indexOf("feed-bookmark")).toBeLessThan(json.indexOf("feed-article-body"));
    expect(json.indexOf("feed-article-body")).toBeLessThan(json.indexOf("feed-post-action-like"));
  });

  it("salvato: «Rimuovi dai salvati», selezionato; il tap invoca il toggle del Saved system", () => {
    const { props, tree } = setup({ isSaved: true });
    const [bookmark] = hostByTestId(tree, "feed-bookmark");

    expect(bookmark.props.accessibilityLabel).toBe("Rimuovi dai salvati");
    expect(bookmark.props.accessibilityState).toEqual({ selected: true });

    press(tree, "Rimuovi dai salvati");

    expect(props.onToggleSaved).toHaveBeenCalledTimes(1);
  });

  it("senza capability di salvataggio non c'è segnalibro", () => {
    const { tree } = setup(
      {},
      { capabilities: { ...makeArticleItem().payload.capabilities, canSave: false } },
    );

    expect(countTestId(tree, "feed-bookmark")).toBe(0);
  });

  it("il bookmark non è la quarta azione: la riga ha esattamente tre azioni e non lo contiene", () => {
    const { tree } = setup();
    const actionIds = ["feed-post-action-like", "feed-post-action-comment", "feed-post-action-share"];

    for (const id of actionIds) {
      expect(countTestId(tree, id)).toBe(1);
    }
    expect(
      tree.root.findAll(
        (node) =>
          typeof node.type === "string" &&
          typeof node.props.testID === "string" &&
          node.props.testID.startsWith("feed-post-action-"),
      ),
    ).toHaveLength(3);
  });

  it("il menu ••• degli editoriali non ripete «Salva»", () => {
    const { tree } = setup();

    press(tree, "Altre azioni");

    // Il menu è aperto (le altre voci ci sono) ma Salva no: lo fa il segnalibro.
    expect(textNodes(tree, "Nascondi").length).toBeGreaterThan(0);
    expect(textNodes(tree, "Salva")).toHaveLength(0);
    expect(textNodes(tree, "Rimuovi dai salvati")).toHaveLength(0);
  });

  it("Mi piace · Commenta · Condividi: zero → label, mai «0»; con conteggi il solo numero", () => {
    const zero = setup();
    expect(findByLabel(zero.tree, "Mi piace")).toHaveLength(1);
    expect(findByLabel(zero.tree, "Commenta")).toHaveLength(1);
    expect(findByLabel(zero.tree, "Condividi")).toHaveLength(1);
    expect(textOf(zero.tree)).not.toContain('"0"');

    const counted = setup({}, { commentsCount: 23, likesCount: 156 });
    expect(textOf(counted.tree)).toContain('"156"');
    expect(textOf(counted.tree)).toContain('"23"');
    expect(findByLabel(counted.tree, "156 Mi piace")).toHaveLength(1);
    expect(findByLabel(counted.tree, "Mi piace")).toHaveLength(0);
  });

  it("i tap sulle azioni chiamano gli handler, una volta ciascuno", () => {
    const { props, tree } = setup();

    pressTestId(tree, "feed-post-action-like");
    pressTestId(tree, "feed-post-action-comment");
    pressTestId(tree, "feed-post-action-share");

    expect(props.onToggleLike).toHaveBeenCalledTimes(1);
    expect(props.onComment).toHaveBeenCalledTimes(1);
    expect(props.onShare).toHaveBeenCalledTimes(1);
    expect(props.onPress).not.toHaveBeenCalled();
  });

  it("Mi piace attivo: stesso controllo, selezionato", () => {
    const { tree } = setup({}, { isLiked: true, likesCount: 157 });
    const [like] = hostByTestId(tree, "feed-post-action-like");

    expect(like.props.accessibilityState).toEqual({ selected: true });
    expect(like.props.accessibilityLabel).toBe("157 Mi piace");
  });
});
