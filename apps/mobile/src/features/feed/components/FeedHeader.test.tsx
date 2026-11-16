import React from "react";
import { describe, expect, it, vi } from "vitest";

import { FEED_BRAND } from "../feed-labels";
import { countTestId, press, render, textOf } from "./feed-test-helpers";
import { FeedHeader } from "./FeedHeader";

function setup(overrides: Partial<React.ComponentProps<typeof FeedHeader>> = {}) {
  const props = {
    notificationCount: 0,
    onOpenComposer: vi.fn(),
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

  it("non mostra il badge quando non ci sono notifiche nuove", () => {
    const { tree } = setup({ notificationCount: 0 });

    expect(countTestId(tree, "feed-header-badge")).toBe(0);
  });

  // HOM-14 §5: il numero sulla campanella conta le notifiche nuove dall'ultima
  // apertura del Centro (sostituisce il punto di HOM-01.1 §5).
  it("mostra il numero delle notifiche nuove sulla campanella", () => {
    const { tree } = setup({ notificationCount: 5 });

    expect(countTestId(tree, "feed-header-badge")).toBe(1);
    expect(textOf(tree)).toContain("5");
  });

  it("la campanella dichiara a parole quante notifiche sono nuove", () => {
    const { tree } = setup({ notificationCount: 1 });

    const labels = tree.root
      .findAll((node) => typeof node.type === "string" && typeof node.props?.accessibilityLabel === "string")
      .map((node) => node.props.accessibilityLabel);

    expect(labels).toContain("Notifiche, 1 nuova");
  });

  it("collega campanella e + ai rispettivi handler", () => {
    const { props, tree } = setup();

    press(tree, "Notifiche");
    press(tree, "Crea contenuto");

    expect(props.onOpenNotifications).toHaveBeenCalledTimes(1);
    expect(props.onOpenComposer).toHaveBeenCalledTimes(1);
  });

  // HOM-01.1 §4: a sinistra solo il wordmark, nessuna icona menu.
  it("non ha un'icona menu a sinistra di PROLINK", () => {
    const { tree } = setup();

    const menu = tree.root.findAll(
      (node) =>
        typeof node.type === "string" && node.props?.accessibilityLabel === "Apri menu laterale",
    );

    expect(menu).toHaveLength(0);
  });

  it("non mostra una casella di ricerca", () => {
    // La ricerca vive nella tab Cerca: l'header della Home ha campanella e "+".
    const { tree } = setup();

    expect(textOf(tree).toLowerCase()).not.toContain("cerca");
  });
});
