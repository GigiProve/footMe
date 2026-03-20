import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { sizes } from "../../styles";
import { AppAvatar } from "./AppAvatar";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

describe("AppAvatar", () => {
  it("shows an image when imageUrl is provided", () => {
    const tree = render(
      <AppAvatar imageUrl="https://example.com/photo.png" testID="avatar" />,
    );
    const image = tree.root.findByType("Image" as never);
    expect(image.props.source).toEqual({ uri: "https://example.com/photo.png" });
  });

  it("shows a fallback icon when no imageUrl is provided", () => {
    const tree = render(<AppAvatar testID="avatar" />);
    // Should render a View (placeholder) not an Image
    const images = tree.root.findAllByType("Image" as never);
    expect(images).toHaveLength(0);
    // Should render the fallback Ionicon
    const icon = tree.root.findByType("Ionicon" as never);
    expect(icon).toBeTruthy();
  });

  it("uses the correct dimension for each size", () => {
    const tree = render(<AppAvatar size="lg" />);
    // Find the View placeholder (no imageUrl, so placeholder renders)
    const view = tree.root.findByType("View" as never);
    const style = Array.isArray(view.props.style) ? view.props.style : [view.props.style];
    const flatStyle = Object.assign({}, ...style.filter(Boolean));
    expect(flatStyle.width).toBe(sizes.avatarLg);
    expect(flatStyle.height).toBe(sizes.avatarLg);
  });
});
