import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it } from "vitest";

import { colors, textVariants } from "../../styles";
import { AppText } from "./AppText";

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

describe("AppText", () => {
  it("renders bodyLg variant with primary color by default", () => {
    const tree = render(<AppText>Hello</AppText>);
    const root = tree.root;
    const textElement = root.findByType("Text" as never);

    expect(textElement.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining(textVariants.bodyLg),
        expect.objectContaining({ color: colors.textPrimary }),
      ]),
    );
  });

  it("applies the requested variant styles", () => {
    const tree = render(<AppText variant="headingMd">Title</AppText>);
    const textElement = tree.root.findByType("Text" as never);

    expect(textElement.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining(textVariants.headingMd),
      ]),
    );
  });

  it("applies the requested color", () => {
    const tree = render(<AppText color="secondary">Muted</AppText>);
    const textElement = tree.root.findByType("Text" as never);

    expect(textElement.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: colors.textSecondary }),
      ]),
    );
  });

  it("applies text alignment when specified", () => {
    const tree = render(<AppText align="center">Centered</AppText>);
    const textElement = tree.root.findByType("Text" as never);

    expect(textElement.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ textAlign: "center" }),
      ]),
    );
  });

  it("forwards numberOfLines to the underlying Text", () => {
    const tree = render(<AppText numberOfLines={2}>Truncated</AppText>);
    const textElement = tree.root.findByType("Text" as never);

    expect(textElement.props.numberOfLines).toBe(2);
  });
});
