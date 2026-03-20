import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it } from "vitest";

import { colors } from "../../styles";
import { AppDivider } from "./AppDivider";

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

describe("AppDivider", () => {
  it("renders a 1px horizontal line with border color", () => {
    const tree = render(<AppDivider />);
    const view = tree.root.findByType("View" as never);
    expect(view.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          height: 1,
          backgroundColor: colors.border,
        }),
      ]),
    );
  });

  it("applies vertical margin when spacing is provided", () => {
    const tree = render(<AppDivider spacing={16} />);
    const view = tree.root.findByType("View" as never);
    expect(view.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ marginVertical: 16 }),
      ]),
    );
  });
});
