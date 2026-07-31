import React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  FEED_FOLLOWING_EMPTY_CTA,
  FEED_FOLLOWING_EMPTY_TITLE,
  FEED_FOLLOWING_QUIET_TITLE,
  FEED_SUGGESTIONS_TITLE,
} from "../../feed-labels";
import { makeProfileRow, render, textOf } from "../feed-test-helpers";
import { FeedFollowingEmpty } from "./FeedFollowingEmpty";

function setup(overrides: Partial<React.ComponentProps<typeof FeedFollowingEmpty>> = {}) {
  const props = {
    onDiscover: vi.fn(),
    onPressProfile: vi.fn(),
    onToggleFollow: vi.fn(),
    pendingId: null,
    reason: "no_follows" as const,
    suggestions: [makeProfileRow()],
    ...overrides,
  };

  return { props, tree: render(<FeedFollowingEmpty {...props} />) };
}

describe("FeedFollowingEmpty", () => {
  it("mostra titolo, CTA principale e i suggerimenti", () => {
    const { tree } = setup();
    const json = textOf(tree);

    expect(json).toContain(FEED_FOLLOWING_EMPTY_TITLE);
    expect(json).toContain(FEED_FOLLOWING_EMPTY_CTA);
    expect(json).toContain(FEED_SUGGESTIONS_TITLE);
    expect(json).toContain("Lorenzo Colombo");
  });

  /**
   * §14 contiene una correzione grafica esplicita: nessun grande campo
   * illustrato, nessuna area vuota eccessiva. `EmptyState` porterebbe un
   * cerchio con icona, quindi non va usato qui.
   */
  it("non usa illustrazioni né icone decorative", () => {
    const { tree } = setup();

    const icons = tree.root.findAll(
      (node) => typeof node.type === "string" && String(node.type) === "Ionicons",
    );

    expect(icons).toHaveLength(0);
  });

  it("collega la CTA a Scopri profili da seguire", () => {
    const { props, tree } = setup();

    const cta = tree.root
      .findAll(
        (node) =>
          typeof node.type === "string" &&
          node.props?.accessibilityLabel === FEED_FOLLOWING_EMPTY_CTA,
      )
      .at(0);

    cta?.props.onPress();

    expect(props.onDiscover).toHaveBeenCalledTimes(1);
  });

  it("con follow presenti ma nessun contenuto cambia il titolo", () => {
    const { tree } = setup({ reason: "no_content" });

    expect(textOf(tree)).toContain(FEED_FOLLOWING_QUIET_TITLE);
  });

  it("con follow presenti NON propone il blocco discovery (§5)", () => {
    // L'utente ha già scelto chi seguire: suggerirgli altri profili qui
    // contraddirebbe la promessa della tab.
    const { tree } = setup({ reason: "no_content" });

    expect(textOf(tree)).not.toContain(FEED_SUGGESTIONS_TITLE);
    expect(textOf(tree)).not.toContain("Lorenzo Colombo");
  });

  it("regge l'assenza di suggerimenti", () => {
    const { tree } = setup({ suggestions: undefined });

    expect(textOf(tree)).toContain(FEED_FOLLOWING_EMPTY_CTA);
    expect(textOf(tree)).not.toContain(FEED_SUGGESTIONS_TITLE);
  });
});
