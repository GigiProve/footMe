import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it } from "vitest";

import { colors, spacing } from "../../styles";
import { Divider } from "./Divider";

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

describe("Divider", () => {
  it("renders a thin line with border color", () => {
    const tree = render(<Divider />);
    const view = tree.root.findByType("View" as never);
    const flatStyle = Object.assign({}, ...view.props.style.filter(Boolean));

    expect(flatStyle.backgroundColor).toBe(colors.border);
  });

  it("applies vertical margin when spacing is provided", () => {
    const tree = render(<Divider spacing={16} />);
    const view = tree.root.findByType("View" as never);
    const flatStyle = Object.assign({}, ...view.props.style.filter(Boolean));

    expect(flatStyle.marginVertical).toBe(spacing[16]);
  });
});
