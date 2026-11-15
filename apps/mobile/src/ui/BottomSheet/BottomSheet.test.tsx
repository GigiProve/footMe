import React from "react";
import { Modal } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it } from "vitest";

import { AppText } from "../AppText/AppText";
import { BottomSheet } from "./BottomSheet";

function renderSheet(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

describe("BottomSheet", () => {
  it("renders the title and children when visible", () => {
    const tree = renderSheet(
      <BottomSheet onClose={() => undefined} title="Filtri" visible>
        <AppText>Contenuto</AppText>
      </BottomSheet>,
    );

    expect(tree.root.findByProps({ children: "Filtri" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Contenuto" })).toBeTruthy();
  });

  it("draws the handle only when asked (HOM-09 §12)", () => {
    const without = renderSheet(
      <BottomSheet onClose={() => undefined} visible>
        <AppText>Contenuto</AppText>
      </BottomSheet>,
    );
    const withHandle = renderSheet(
      <BottomSheet onClose={() => undefined} showHandle visible>
        <AppText>Contenuto</AppText>
      </BottomSheet>,
    );

    expect(without.root.findAllByProps({ testID: "bottom-sheet-handle" })).toHaveLength(0);
    expect(withHandle.root.findAllByProps({ testID: "bottom-sheet-handle" }).length).toBeGreaterThan(0);
  });

  it("scrolls its content only when asked (HOM-09 §335)", () => {
    const plain = renderSheet(
      <BottomSheet onClose={() => undefined} visible>
        <AppText>Contenuto</AppText>
      </BottomSheet>,
    );
    const scrollable = renderSheet(
      <BottomSheet onClose={() => undefined} scrollable visible>
        <AppText>Contenuto</AppText>
      </BottomSheet>,
    );

    expect(plain.root.findAllByProps({ testID: "bottom-sheet-scroll" })).toHaveLength(0);
    expect(scrollable.root.findAllByProps({ testID: "bottom-sheet-scroll" }).length).toBeGreaterThan(0);
    expect(scrollable.root.findByProps({ children: "Contenuto" })).toBeTruthy();
  });

  it("keeps the modal mounted but hidden when not visible", () => {
    // Il Modal non viene smontato: su iOS onDismiss non verrebbe consegnato
    // a un Modal rimosso dall'albero, rompendo gli handoff sheet -> modal.
    const tree = renderSheet(
      <BottomSheet onClose={() => undefined} title="Filtri" visible={false}>
        <AppText>Contenuto</AppText>
      </BottomSheet>,
    );

    const modal = tree.root.findByType(Modal);
    expect(modal.props.visible).toBe(false);
  });
});
