import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it } from "vitest";

import { colors } from "../../theme/tokens";
import { Screen } from "./screen";

function renderScreen(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

describe("Screen", () => {
  it("renders children inside the content container", () => {
    function Child() {
      return React.createElement("mock-text", null, "Contenuto test");
    }

    const tree = renderScreen(
      <Screen>
        <Child />
      </Screen>,
    );
    const root = tree.root;

    expect(root.findByProps({ testID: "screen-content" })).toBeTruthy();
    expect(root.findByProps({ children: "Contenuto test" })).toBeTruthy();
  });

  it("applies the correct background color to the root container", () => {
    function Child() {
      return React.createElement("mock-text", null, "Background test");
    }

    const tree = renderScreen(
      <Screen>
        <Child />
      </Screen>,
    );
    const root = tree.root;
    const rootElement = root.findByProps({ testID: "screen-root" });

    expect(rootElement.props.style.backgroundColor).toBe(colors.background);
  });
});
