import React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  FEED_ERROR_BODY,
  FEED_ERROR_TITLE,
  FEED_FOLLOWING_EMPTY_CTA,
  FEED_PER_TE_EMPTY_BODY,
  FEED_PER_TE_EMPTY_TITLE,
  FEED_RETRY,
} from "../../feed-labels";
import { press, render, textOf } from "../feed-test-helpers";
import { FeedErrorState, FeedPerTeEmpty } from "./FeedBanners";

describe("FeedErrorState", () => {
  it("mostra titolo, testo e riprova", () => {
    const json = textOf(render(<FeedErrorState onRetry={vi.fn()} />));

    expect(json).toContain(FEED_ERROR_TITLE);
    expect(json).toContain(FEED_ERROR_BODY);
    expect(json).toContain(FEED_RETRY);
  });

  it("riporta la causa quando disponibile", () => {
    // Senza il dettaglio, una RPC assente e un problema di rete sono
    // indistinguibili: è esattamente il caso in cui serve saperlo.
    const json = textOf(
      render(
        <FeedErrorState
          detail='Could not find the function public.fetch_home_feed_page'
          onRetry={vi.fn()}
        />,
      ),
    );

    expect(json).toContain("fetch_home_feed_page");
  });

  it("non aggiunge righe di testo quando la causa è assente", () => {
    const countTexts = (element: React.ReactElement) =>
      render(element).root.findAll(
        (node) => typeof node.type === "string" && String(node.type) === "Text",
      ).length;

    // titolo + corpo + etichetta del pulsante
    expect(countTexts(<FeedErrorState detail={null} onRetry={vi.fn()} />)).toBe(3);
    // ...più la riga con la causa
    expect(countTexts(<FeedErrorState detail="boom" onRetry={vi.fn()} />)).toBe(4);
  });

  it("invoca il retry", () => {
    const onRetry = vi.fn();
    const tree = render(<FeedErrorState onRetry={onRetry} />);

    press(tree, FEED_RETRY);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("FeedPerTeEmpty", () => {
  it("spiega l'assenza di contenuti invece di lasciare la Home bianca", () => {
    const json = textOf(render(<FeedPerTeEmpty onDiscover={vi.fn()} />));

    expect(json).toContain(FEED_PER_TE_EMPTY_TITLE);
    expect(json).toContain(FEED_PER_TE_EMPTY_BODY);
    expect(json).toContain(FEED_FOLLOWING_EMPTY_CTA);
  });

  it("non usa illustrazioni (§28: nessuna illustrazione dominante)", () => {
    const tree = render(<FeedPerTeEmpty onDiscover={vi.fn()} />);

    expect(
      tree.root.findAll(
        (node) => typeof node.type === "string" && String(node.type) === "Ionicons",
      ),
    ).toHaveLength(0);
  });

  it("porta a Scopri profili da seguire", () => {
    const onDiscover = vi.fn();
    const tree = render(<FeedPerTeEmpty onDiscover={onDiscover} />);

    press(tree, FEED_FOLLOWING_EMPTY_CTA);

    expect(onDiscover).toHaveBeenCalledTimes(1);
  });
});
