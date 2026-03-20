import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it } from "vitest";

import { AppSection } from "./AppSection";

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

describe("AppSection", () => {
  it("renders the title text", () => {
    const tree = render(
      <AppSection title="Esperienze">
        <></>
      </AppSection>,
    );
    const titleNode = tree.root.findByProps({ preset: "h3" });
    expect(titleNode.props.children).toBe("Esperienze");
  });

  it("renders description when provided", () => {
    const tree = render(
      <AppSection description="Dettagli aggiuntivi" title="Bio">
        <></>
      </AppSection>,
    );
    const desc = tree.root.findByProps({ preset: "bodySmall" });
    expect(desc.props.children).toBe("Dettagli aggiuntivi");
  });

  it("does not render description when omitted", () => {
    const tree = render(
      <AppSection title="Contatti">
        <></>
      </AppSection>,
    );
    const allPresets = tree.root.findAllByProps({ preset: "bodySmall" });
    expect(allPresets).toHaveLength(0);
  });
});
