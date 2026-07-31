import React from "react";
import { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import {
  FEED_INTRO_BODY,
  FEED_INTRO_PRIMARY_CTA,
  FEED_INTRO_SECONDARY_CTA,
  FEED_INTRO_TITLE,
} from "../../feed-labels";
import type { FeedIntroOption } from "../../feed-types";
import { render, textOf } from "../feed-test-helpers";
import { FeedPersonalizeModule } from "./FeedPersonalizeModule";

const OPTIONS: FeedIntroOption[] = [
  { key: "wants_players", label: "Calciatori", prefill: false, isDerivable: false },
  { key: "wants_clubs", label: "Società", prefill: true, isDerivable: true },
  { key: "wants_positions", label: "Posizioni aperte", prefill: false, isDerivable: true },
  { key: "wants_local_media", label: "Media locali", prefill: false, isDerivable: false },
];

function setup(options = OPTIONS) {
  const props = { isSaving: false, onDismiss: vi.fn(), onSave: vi.fn(), options };

  return { props, tree: render(<FeedPersonalizeModule {...props} />) };
}

function checkboxes(tree: ReturnType<typeof render>) {
  return tree.root.findAll(
    (node) =>
      typeof node.type === "string" && node.props?.accessibilityRole === "checkbox",
  );
}

describe("FeedPersonalizeModule", () => {
  it("mostra titolo, testo e le quattro opzioni del §6", () => {
    const { tree } = setup();
    const json = textOf(tree);

    expect(json).toContain(FEED_INTRO_TITLE);
    expect(json).toContain(FEED_INTRO_BODY);
    expect(json).toContain("Calciatori");
    expect(json).toContain("Società");
    expect(json).toContain("Posizioni aperte");
    expect(json).toContain("Media locali");
  });

  it("mostra entrambe le CTA, con la personalizzazione non obbligatoria", () => {
    const json = textOf(setup().tree);

    expect(json).toContain(FEED_INTRO_PRIMARY_CTA);
    expect(json).toContain(FEED_INTRO_SECONDARY_CTA);
  });

  it("preseleziona le opzioni già deducibili dal profilo (§7)", () => {
    const { tree } = setup();
    const boxes = checkboxes(tree);

    expect(boxes[0].props.accessibilityState).toEqual({ checked: false });
    expect(boxes[1].props.accessibilityState).toEqual({ checked: true });
  });

  it("invia le sole opzioni selezionate", () => {
    const { props, tree } = setup();

    act(() => {
      checkboxes(tree)[0].props.onPress();
    });

    const cta = tree.root
      .findAll(
        (node) =>
          typeof node.type === "string" &&
          node.props?.accessibilityLabel === FEED_INTRO_PRIMARY_CTA,
      )
      .at(0);

    act(() => {
      cta?.props.onPress();
    });

    expect(props.onSave).toHaveBeenCalledTimes(1);
    const selected = props.onSave.mock.calls[0][0] as string[];
    expect([...selected].sort()).toEqual(["wants_clubs", "wants_players"]);
  });

  it("permette di deselezionare un'opzione preselezionata", () => {
    const { props, tree } = setup();

    act(() => {
      checkboxes(tree)[1].props.onPress();
    });

    const cta = tree.root
      .findAll(
        (node) =>
          typeof node.type === "string" &&
          node.props?.accessibilityLabel === FEED_INTRO_PRIMARY_CTA,
      )
      .at(0);

    act(() => {
      cta?.props.onPress();
    });

    expect(props.onSave.mock.calls[0][0]).toEqual([]);
  });

  it("il rinvio non salva nulla", () => {
    const { props, tree } = setup();

    const later = tree.root
      .findAll(
        (node) =>
          typeof node.type === "string" &&
          node.props?.accessibilityLabel === FEED_INTRO_SECONDARY_CTA,
      )
      .at(0);

    act(() => {
      later?.props.onPress();
    });

    expect(props.onDismiss).toHaveBeenCalledTimes(1);
    expect(props.onSave).not.toHaveBeenCalled();
  });
});
