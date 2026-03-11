import React from "react";
import TestRenderer from "react-test-renderer";
import { describe, expect, it } from "vitest";

import { colors } from "../../theme/tokens";
import { Screen } from "./screen";

describe("Screen", () => {
  it("renders children inside the content container", () => {
    function Child() {
      return React.createElement("mock-text", null, "Contenuto test");
    }

    const tree = TestRenderer.create(
      <Screen>
        <Child />
      </Screen>,
    );
    const root = tree.root;

    expect(root.findByProps({ testID: "screen-content" })).toBeTruthy();
    expect(root.findByProps({ children: "Contenuto test" })).toBeTruthy();
  });

  it("renders the decorative background layers with the expected styles", () => {
    function Child() {
      return React.createElement("mock-text", null, "Decorazioni");
    }

    const tree = TestRenderer.create(
      <Screen>
        <Child />
      </Screen>,
    );
    const root = tree.root;
    const rootStyle = root.findByProps({ testID: "screen-root" }).props.style;
    const heroOrb = root.findByProps({ testID: "screen-orb-hero" });
    const accentOrb = root.findByProps({ testID: "screen-orb-accent" });
    const heroStyle = heroOrb.props.style;
    const accentStyle = accentOrb.props.style;

    expect(rootStyle.backgroundColor).toBe(colors.background);
    expect(heroOrb.props.pointerEvents).toBe("none");
    expect(heroStyle.top).toBe(-80);
    expect(heroStyle.right).toBe(-40);
    expect(heroStyle.backgroundColor).toBe(colors.heroSoft);
    expect(accentOrb.props.pointerEvents).toBe("none");
    expect(accentStyle.bottom).toBe(-120);
    expect(accentStyle.left).toBe(-70);
    expect(accentStyle.backgroundColor).toBe(colors.accentSoft);
  });
});
