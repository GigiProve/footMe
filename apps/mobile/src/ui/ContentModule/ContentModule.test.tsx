import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { colors, sizes } from "../../styles";
import { AppText } from "../AppText/AppText";
import { ContentModule } from "./ContentModule";

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

function flatStyle(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

function textOf(tree: TestRenderer.ReactTestRenderer): string {
  return JSON.stringify(tree.toJSON());
}

describe("ContentModule", () => {
  it("disegna la barra di personalizzazione solo quando il contenuto è scelto per l'utente", () => {
    const plain = render(
      <ContentModule>
        <AppText>Corpo</AppText>
      </ContentModule>,
    );
    const personalized = render(
      <ContentModule personalized>
        <AppText>Corpo</AppText>
      </ContentModule>,
    );

    const railOf = (tree: TestRenderer.ReactTestRenderer) =>
      tree.root.findAll(
        (node) =>
          typeof node.type === "string" &&
          flatStyle(node.props?.style).width === sizes.personalizedRail,
      );

    expect(railOf(plain)).toHaveLength(0);
    expect(railOf(personalized)).toHaveLength(1);
    expect(flatStyle(railOf(personalized)[0].props.style).backgroundColor).toBe(
      colors.accent,
    );
  });

  it("tiene il rail azioni a 44px con la hairline sopra", () => {
    const tree = render(
      <ContentModule actions={[{ label: "Apri posizione" }]}>
        <AppText>Corpo</AppText>
      </ContentModule>,
    );

    const rail = tree.root.find(
      (node) =>
        typeof node.type === "string" &&
        flatStyle(node.props?.style).height === sizes.actionRail,
    );
    const style = flatStyle(rail.props.style);

    expect(style.borderTopWidth).toBe(1);
    expect(style.borderTopColor).toBe(colors.border);
  });

  it("non disegna il rail quando non ci sono né azioni né trailing", () => {
    const tree = render(
      <ContentModule>
        <AppText>Corpo</AppText>
      </ContentModule>,
    );

    const rails = tree.root.findAll(
      (node) =>
        typeof node.type === "string" &&
        flatStyle(node.props?.style).height === sizes.actionRail,
    );

    expect(rails).toHaveLength(0);
  });

  it("mostra eyebrow e nota, e notifica l'azione premuta", () => {
    const onPress = vi.fn();
    const tree = render(
      <ContentModule
        actions={[{ label: "Candidati", onPress }]}
        eyebrow="Posizione per te"
        eyebrowNote="In base al tuo profilo"
      >
        <AppText>Corpo</AppText>
      </ContentModule>,
    );

    expect(textOf(tree)).toContain("Posizione per te");
    expect(textOf(tree)).toContain("In base al tuo profilo");

    const action = tree.root.find(
      (node) =>
        typeof node.type === "string" &&
        node.props?.accessibilityLabel === "Candidati",
    );
    act(() => {
      action.props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
