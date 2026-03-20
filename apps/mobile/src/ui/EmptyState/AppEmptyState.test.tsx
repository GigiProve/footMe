import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { AppEmptyState } from "./AppEmptyState";

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

describe("AppEmptyState", () => {
  it("renders the title", () => {
    const tree = render(<AppEmptyState title="Nessun risultato" />);
    const title = tree.root.findByProps({ preset: "title" });
    expect(title.props.children).toBe("Nessun risultato");
  });

  it("renders description when provided", () => {
    const tree = render(
      <AppEmptyState
        description="Prova a modificare i filtri."
        title="Nessun risultato"
      />,
    );
    const desc = tree.root.findByProps({ preset: "bodySmall" });
    expect(desc.props.children).toBe("Prova a modificare i filtri.");
  });

  it("renders an action node when provided", () => {
    const tree = render(
      <AppEmptyState
        action={<></>}
        title="Vuoto"
      />,
    );
    // Should render without errors
    expect(tree.toJSON()).toBeTruthy();
  });
});
