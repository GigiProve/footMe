import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { describe, expect, it } from "vitest";

import { AppListItem } from "./AppListItem";

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

describe("AppListItem", () => {
  it("renders children", () => {
    const tree = render(
      <AppListItem>
        <Text>Mario Rossi</Text>
      </AppListItem>,
    );
    const text = tree.root.findByProps({ children: "Mario Rossi" });
    expect(text).toBeTruthy();
  });

  it("is pressable when onPress is provided", () => {
    const tree = render(
      <AppListItem onPress={() => undefined}>
        <Text>Name</Text>
      </AppListItem>,
    );
    const pressable = tree.root.findByProps({ accessibilityRole: "button" });
    expect(pressable).toBeTruthy();
  });

  it("renders leading and trailing accessories", () => {
    const tree = render(
      <AppListItem
        leading={<Text testID="leading">L</Text>}
        trailing={<Text testID="trailing">R</Text>}
      >
        <Text>Content</Text>
      </AppListItem>,
    );
    expect(tree.root.findByProps({ testID: "leading" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "trailing" })).toBeTruthy();
  });
});
