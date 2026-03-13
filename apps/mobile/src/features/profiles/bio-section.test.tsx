import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { BioSection, CharacterCounter, PublicBioBlock } from "./bio-section";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

function hasTextContent(
  tree: TestRenderer.ReactTestRenderer,
  expectedText: string,
) {
  return tree.root.findAllByType("Text" as never).some((node) => {
    const children = node.props.children;

    if (Array.isArray(children)) {
      return children.join("") === expectedText;
    }

    return children === expectedText;
  });
}

describe("bio-section", () => {
  it("renders the empty bio state in readonly mode", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(<BioSection bio="" />);
    });

    expect(tree!.root.findByProps({ children: "Presentazione" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Da completare" })).toBeTruthy();
  });

  it("renders editable bio input with a live character counter and error message", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <BioSection
          bio="Troppo corta"
          editable
          errorMessage="La bio deve contenere almeno 20 caratteri."
          onChangeText={() => undefined}
        />,
      );
    });

    const input = tree!.root.findByType("TextInput" as never);
    expect(input.props.maxLength).toBe(400);
    expect(hasTextContent(tree!, "12 / 400 caratteri")).toBe(true);
    expect(
      tree!.root.findByProps({
        children: "La bio deve contenere almeno 20 caratteri.",
      }),
    ).toBeTruthy();
  });

  it("expands and collapses long public bios", () => {
    const bio =
      "Centrocampista classe 2001 con visione di gioco, corsa e inserimenti. " +
      "Ultima stagione in Promozione con 20 presenze, 4 gol e disponibilità a valutare progetti ambiziosi.";
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(<PublicBioBlock bio={bio} />);
    });

    const text = tree!.root.findAllByType("Text" as never)[0];

    act(() => {
      text.props.onTextLayout({
        nativeEvent: {
          lines: [{}, {}, {}, {}],
        },
      });
    });

    const expandButton = tree!.root.findByProps({ children: "Mostra di più" });
    expect(expandButton).toBeTruthy();

    act(() => {
      tree!.root.findByType("Pressable" as never).props.onPress();
    });

    expect(tree!.root.findByProps({ children: "Mostra meno" })).toBeTruthy();
  });

  it("highlights the counter when approaching the limit", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(<CharacterCounter currentLength={380} />);
    });

    expect(hasTextContent(tree!, "380 / 400 caratteri")).toBe(true);
  });
});
