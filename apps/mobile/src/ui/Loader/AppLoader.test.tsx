import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it } from "vitest";

import { colors } from "../../styles";
import { AppLoader } from "./AppLoader";

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

describe("AppLoader", () => {
  it("renders an ActivityIndicator with accent color", () => {
    const tree = render(<AppLoader testID="loader" />);
    const spinner = tree.root.findByProps({ testID: "loader-spinner" });
    expect(spinner.props.color).toBe(colors.accent);
  });

  it("renders a label when provided", () => {
    const tree = render(<AppLoader label="Caricamento…" />);
    const label = tree.root.findByProps({ preset: "bodySmall" });
    expect(label.props.children).toBe("Caricamento…");
  });

  it("does not render a label when omitted", () => {
    const tree = render(<AppLoader />);
    const labels = tree.root.findAllByProps({ preset: "bodySmall" });
    expect(labels).toHaveLength(0);
  });
});
