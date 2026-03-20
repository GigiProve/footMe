import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it } from "vitest";

import { AppChip } from "./AppChip";

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

describe("AppChip", () => {
  it("renders the label text", () => {
    const tree = render(<AppChip label="Attaccante" />);
    const text = tree.root.findByProps({ preset: "caption" });
    expect(text.props.children).toBe("Attaccante");
  });

  it("is pressable when onPress is provided", () => {
    const tree = render(
      <AppChip label="Under 21" onPress={() => undefined} />,
    );
    const pressable = tree.root.findByProps({ accessibilityRole: "button" });
    expect(pressable).toBeTruthy();
  });

  it("has no accessibilityRole when not pressable", () => {
    const tree = render(<AppChip label="Tag" testID="chip" />);
    const nodes = tree.root.findAllByProps({ accessibilityRole: "button" });
    expect(nodes).toHaveLength(0);
  });
});
