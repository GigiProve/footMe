import React from "react";
import { describe, expect, it, vi } from "vitest";

import { FEED_BRAND } from "../feed-labels";
import { countTestId, press, render, textOf } from "./feed-test-helpers";
import { FeedHeader } from "./FeedHeader";

function setup(overrides: Partial<React.ComponentProps<typeof FeedHeader>> = {}) {
  const props = {
    hasUnreadNotifications: false,
    onOpenComposer: vi.fn(),
    onOpenMenu: vi.fn(),
    onOpenNotifications: vi.fn(),
    ...overrides,
  };

  return { props, tree: render(<FeedHeader {...props} />) };
}

describe("FeedHeader", () => {
  it("mostra il solo nome testuale PROLINK", () => {
    const { tree } = setup();

    expect(textOf(tree)).toContain(FEED_BRAND);
    expect(FEED_BRAND).toBe("PROLINK");
  });

  it("non introduce un logo provvisorio", () => {
    // §2: il logo definitivo non è approvato, quindi niente segnaposto grafici.
    // Il riquadro con la lettera "F" di TopBar non deve comparire qui.
    const { tree } = setup();
    const json = textOf(tree);

    expect(json).not.toContain('"F"');
    expect(json).not.toContain("logo");
  });

  it("non mostra l'indicatore quando non ci sono notifiche non lette", () => {
    const { tree } = setup({ hasUnreadNotifications: false });

    expect(countTestId(tree, "feed-header-unread-dot")).toBe(0);
  });

  it("mostra un indicatore discreto, non un contatore, quando ci sono non lette", () => {
    const { tree } = setup({ hasUnreadNotifications: true });

    const dot = tree.root.find(
      (node) =>
        typeof node.type === "string" &&
        node.props?.testID === "feed-header-unread-dot",
    );

    expect(countTestId(tree, "feed-header-unread-dot")).toBe(1);
    // §2 vieta numeri grandi e badge invasivi: l'indicatore è un punto e non
    // contiene alcun testo.
    expect(dot.props.children ?? null).toBeNull();
    expect(
      tree.root.findAll(
        (node) => typeof node.type === "string" && String(node.type) === "Text",
      ).length,
    ).toBe(1); // solo "PROLINK"
  });

  it("collega campanella, + e menu ai rispettivi handler", () => {
    const { props, tree } = setup();

    press(tree, "Notifiche");
    press(tree, "Crea contenuto");
    press(tree, "Apri menu laterale");

    expect(props.onOpenNotifications).toHaveBeenCalledTimes(1);
    expect(props.onOpenComposer).toHaveBeenCalledTimes(1);
    expect(props.onOpenMenu).toHaveBeenCalledTimes(1);
  });

  it("non mostra una casella di ricerca", () => {
    // La ricerca vive nella tab Cerca: l'header della Home ha campanella e "+".
    const { tree } = setup();

    expect(textOf(tree).toLowerCase()).not.toContain("cerca");
  });
});
