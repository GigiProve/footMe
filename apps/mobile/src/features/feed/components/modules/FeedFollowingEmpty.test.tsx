import React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  FEED_FOLLOWING_EMPTY_BODY,
  FEED_FOLLOWING_EMPTY_CTA,
  FEED_FOLLOWING_EMPTY_TITLE,
  FEED_SUGGESTIONS_TITLE,
} from "../../feed-labels";
import { makeClubRow, makeProfileRow, press, render, textOf } from "../feed-test-helpers";
import { FeedFollowingEmpty } from "./FeedFollowingEmpty";

function setup(overrides: Partial<React.ComponentProps<typeof FeedFollowingEmpty>> = {}) {
  const props = {
    clubs: [makeClubRow()],
    onDiscover: vi.fn(),
    onPressClub: vi.fn(),
    onPressProfile: vi.fn(),
    onToggleFollowClub: vi.fn(),
    onToggleFollowProfile: vi.fn(),
    pendingId: null,
    profiles: [makeProfileRow()],
    reason: "no_follows" as const,
    ...overrides,
  };

  return { props, tree: render(<FeedFollowingEmpty {...props} />) };
}

describe("FeedFollowingEmpty", () => {
  it("mostra il copy del §35 e i suggerimenti del §37", () => {
    const { tree } = setup();
    const json = textOf(tree);

    expect(json).toContain(FEED_FOLLOWING_EMPTY_TITLE);
    expect(json).toContain(FEED_FOLLOWING_EMPTY_BODY);
    expect(json).toContain(FEED_FOLLOWING_EMPTY_CTA);
    expect(json).toContain(FEED_SUGGESTIONS_TITLE);
  });

  it("propone insieme Società e persone, Società per prima", () => {
    const json = textOf(setup().tree);

    expect(json).toContain("AC Milan");
    expect(json).toContain("Lorenzo Colombo");
    expect(json.indexOf("AC Milan")).toBeLessThan(json.indexOf("Lorenzo Colombo"));
  });

  it("non supera quattro righe di suggerimenti", () => {
    const profiles = ["a", "b", "c"].map((id) =>
      makeProfileRow({ entity_id: id, full_name: `Persona ${id}` }),
    );
    const clubs = ["x", "y", "z"].map((id) => makeClubRow({ entity_id: id, name: `Società ${id}` }));
    const { tree } = setup({ clubs, profiles });

    const follows = tree.root.findAll(
      (node) =>
        typeof node.type === "string" &&
        typeof node.props?.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.startsWith("Segui "),
    );

    expect(follows).toHaveLength(4);
  });

  /**
   * §34: niente grande illustrazione. L'unica icona è quella nel cerchio del
   * visual master; il resto sono le righe.
   */
  it("non usa illustrazioni: al massimo l'icona del cerchio", () => {
    const { tree } = setup({ clubs: [], profiles: [] });

    const images = tree.root.findAll(
      (node) => typeof node.type === "string" && String(node.type) === "Image",
    );
    const icons = tree.root.findAll(
      (node) => typeof node.type === "string" && String(node.type) === "Ionicons",
    );

    expect(images).toHaveLength(0);
    expect(icons.length).toBeLessThanOrEqual(1);
  });

  it("Scopri chi seguire apre la discovery", () => {
    const { props, tree } = setup();

    press(tree, FEED_FOLLOWING_EMPTY_CTA);

    expect(props.onDiscover).toHaveBeenCalledTimes(1);
  });

  it("Segui usa il follow globale del tipo giusto", () => {
    const { props, tree } = setup();

    press(tree, "Segui AC Milan");
    press(tree, "Segui Lorenzo Colombo");

    expect(props.onToggleFollowClub).toHaveBeenCalledTimes(1);
    expect(props.onToggleFollowProfile).toHaveBeenCalledTimes(1);
  });

  it("con follow presenti NON propone suggerimenti (§25)", () => {
    // L'utente ha già scelto chi seguire: Seguiti non mostra moduli discovery.
    const { tree } = setup({ reason: "no_content" });

    expect(textOf(tree)).toContain(FEED_FOLLOWING_EMPTY_TITLE);
    expect(textOf(tree)).not.toContain(FEED_SUGGESTIONS_TITLE);
    expect(textOf(tree)).not.toContain("Lorenzo Colombo");
  });

  it("regge l'assenza di suggerimenti", () => {
    const { tree } = setup({ clubs: undefined, profiles: undefined });

    expect(textOf(tree)).toContain(FEED_FOLLOWING_EMPTY_CTA);
    expect(textOf(tree)).not.toContain(FEED_SUGGESTIONS_TITLE);
  });
});
