import React from "react";
import { describe, expect, it, vi } from "vitest";

import { FEED_TAB_LABELS } from "../feed-labels";
import { render, textOf } from "./feed-test-helpers";
import { FeedTabs } from "./FeedTabs";

/** Tab escluse dal §3: non devono comparire nella prima versione. */
const FORBIDDEN_TABS = [
  "Video",
  "Articoli",
  "Posizioni",
  "Esplora",
  "Eventi",
  "Salvati",
  "Aggiornamenti",
  "Opportunità",
];

describe("FeedTabs", () => {
  it("mostra esclusivamente Per te e Seguiti", () => {
    const tree = render(<FeedTabs active="per_te" onChange={vi.fn()} />);
    const json = textOf(tree);

    expect(json).toContain(FEED_TAB_LABELS.per_te);
    expect(json).toContain(FEED_TAB_LABELS.seguiti);

    for (const label of FORBIDDEN_TABS) {
      expect(json).not.toContain(label);
    }
  });

  it("rende due sole tab", () => {
    const tree = render(<FeedTabs active="per_te" onChange={vi.fn()} />);

    const tabs = tree.root.findAll(
      (node) => typeof node.type === "string" && node.props?.accessibilityRole === "tab",
    );

    expect(tabs).toHaveLength(2);
  });

  it("marca Per te come selezionata quando è attiva", () => {
    const tree = render(<FeedTabs active="per_te" onChange={vi.fn()} />);

    const tabs = tree.root.findAll(
      (node) => typeof node.type === "string" && node.props?.accessibilityRole === "tab",
    );

    expect(tabs[0].props.accessibilityState).toEqual({ selected: true });
    expect(tabs[1].props.accessibilityState).toEqual({ selected: false });
  });

  it("marca Seguiti come selezionata quando è attiva", () => {
    const tree = render(<FeedTabs active="seguiti" onChange={vi.fn()} />);

    const tabs = tree.root.findAll(
      (node) => typeof node.type === "string" && node.props?.accessibilityRole === "tab",
    );

    expect(tabs[1].props.accessibilityState).toEqual({ selected: true });
  });

  it("notifica il cambio tab", () => {
    const onChange = vi.fn();
    const tree = render(<FeedTabs active="per_te" onChange={onChange} />);

    const tabs = tree.root.findAll(
      (node) => typeof node.type === "string" && node.props?.accessibilityRole === "tab",
    );
    tabs[1].props.onPress();

    expect(onChange).toHaveBeenCalledWith("seguiti");
  });

  it("dà alle due tab la stessa larghezza", () => {
    const tree = render(<FeedTabs active="per_te" onChange={vi.fn()} />);

    const tabs = tree.root.findAll(
      (node) => typeof node.type === "string" && node.props?.accessibilityRole === "tab",
    );

    for (const tab of tabs) {
      const style = Object.assign({}, ...[tab.props.style].flat().filter(Boolean));
      expect(style.flex).toBe(1);
    }
  });
});
