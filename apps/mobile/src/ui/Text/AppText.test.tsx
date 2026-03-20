import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it } from "vitest";

import { colors, textPresets } from "../../styles";
import { AppText } from "./AppText";

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

/** Find the inner mock Text element rendered by AppText. */
function findTextElement(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findByType("Text" as never);
}

describe("AppText", () => {
  it("applies the body preset by default", () => {
    const tree = render(<AppText>Hello</AppText>);
    const text = findTextElement(tree);
    expect(text.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontSize: textPresets.body.fontSize,
          fontWeight: textPresets.body.fontWeight,
        }),
      ]),
    );
  });

  it("uses the specified preset", () => {
    const tree = render(<AppText preset="h1">Title</AppText>);
    const text = findTextElement(tree);
    expect(text.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontSize: textPresets.h1.fontSize,
          fontWeight: textPresets.h1.fontWeight,
        }),
      ]),
    );
  });

  it("overrides color when the color prop is set", () => {
    const tree = render(
      <AppText color="textSecondary">Muted</AppText>,
    );
    const text = findTextElement(tree);
    expect(text.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: colors.textSecondary }),
      ]),
    );
  });

  it("sets textAlign when align is provided", () => {
    const tree = render(<AppText align="center">Center</AppText>);
    const text = findTextElement(tree);
    expect(text.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ textAlign: "center" }),
      ]),
    );
  });

  it("passes numberOfLines through", () => {
    const tree = render(<AppText numberOfLines={2}>Truncated</AppText>);
    const text = findTextElement(tree);
    expect(text.props.numberOfLines).toBe(2);
  });
});
