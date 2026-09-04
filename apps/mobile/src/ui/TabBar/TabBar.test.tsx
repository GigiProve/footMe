import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { colors } from "../../styles";
import { TabBar } from "./TabBar";

const ITEMS = [
  { label: "Per te", value: "per_te" },
  { label: "Seguiti", value: "seguiti" },
] as const;

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

function tabsOf(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAll(
    (node) =>
      typeof node.type === "string" && node.props?.accessibilityRole === "tab",
  );
}

function flatStyle(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

describe("TabBar", () => {
  /**
   * §1a: «Le tab non sono mai bottoni.» Una pillola piena legge come CTA, e
   * questa è la guardia che impedisce di reintrodurla.
   */
  it("segna la tab attiva con un indicatore, non con un fondo pieno", () => {
    const tree = render(
      <TabBar active="per_te" items={ITEMS} onChange={vi.fn()} />,
    );
    const [active, inactive] = tabsOf(tree).map((tab) =>
      flatStyle(tab.props.style),
    );

    expect(active.borderBottomColor).toBe(colors.accent);
    expect(active.borderBottomWidth).toBe(2);
    expect(active.backgroundColor).toBeUndefined();

    expect(inactive.borderBottomColor).toBe("transparent");
    expect(inactive.backgroundColor).toBeUndefined();
  });

  it("distribuisce le tab a larghezza uguale solo con fill", () => {
    const filled = tabsOf(
      render(<TabBar active="per_te" fill items={ITEMS} onChange={vi.fn()} />),
    );
    const aligned = tabsOf(
      render(<TabBar active="per_te" items={ITEMS} onChange={vi.fn()} />),
    );

    expect(flatStyle(filled[0].props.style).flex).toBe(1);
    expect(flatStyle(aligned[0].props.style).flex).toBeUndefined();
  });

  it("notifica il cambio tab", () => {
    const onChange = vi.fn();
    const tree = render(
      <TabBar active="per_te" items={ITEMS} onChange={onChange} />,
    );

    act(() => {
      tabsOf(tree)[1].props.onPress();
    });

    expect(onChange).toHaveBeenCalledWith("seguiti");
  });
});
