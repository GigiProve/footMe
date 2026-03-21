import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it } from "vitest";

import { Avatar } from "./Avatar";

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

describe("Avatar", () => {
  it("renders an Image when uri is provided", () => {
    const tree = render(<Avatar uri="https://example.com/photo.jpg" />);
    const image = tree.root.findByType("Image" as never);

    expect(image.props.source).toEqual({ uri: "https://example.com/photo.jpg" });
  });

  it("renders initials when no uri is provided but name is given", () => {
    const tree = render(<Avatar name="Mario Rossi" />);
    const initials = tree.root.findByProps({ children: "MR" });

    expect(initials).toBeTruthy();
  });

  it("renders single initial for single-word name", () => {
    const tree = render(<Avatar name="Mario" />);
    const initials = tree.root.findByProps({ children: "M" });

    expect(initials).toBeTruthy();
  });

  it("applies the correct dimensions for each size", () => {
    const tree = render(<Avatar name="Test" size="xl" />);
    const container = tree.root.findByProps({ accessibilityLabel: "Test" });
    const style = container.props.style;
    const widthStyle = style.find(
      (s: Record<string, unknown>) => s && typeof s === "object" && "width" in s,
    );

    expect(widthStyle).toEqual(
      expect.objectContaining({ width: 104, height: 104 }),
    );
  });

  it("uses square border radius when square prop is true", () => {
    const tree = render(<Avatar name="Test" size="md" square />);
    const container = tree.root.findByProps({ accessibilityLabel: "Test" });
    const style = container.props.style;
    const radiusStyle = style.find(
      (s: Record<string, unknown>) => s && typeof s === "object" && "borderRadius" in s,
    );

    expect(radiusStyle.borderRadius).toBe(12);
  });
});
