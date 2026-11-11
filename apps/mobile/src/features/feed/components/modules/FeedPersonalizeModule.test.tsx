import React from "react";
import { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setAnalyticsSink } from "../../../../lib/analytics";
import {
  FEED_INTRO_BODY,
  FEED_INTRO_PRIMARY_CTA,
  FEED_INTRO_SECONDARY_CTA,
  FEED_INTRO_SHEET_SAVE,
  FEED_INTRO_TITLE,
} from "../../feed-labels";
import type { FeedIntroOption } from "../../feed-types";
import { press, render, textOf } from "../feed-test-helpers";
import { FeedPersonalizeModule, resetPromptImpressionForTests } from "./FeedPersonalizeModule";

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

function sheetVisible(tree: ReturnType<typeof render>): boolean {
  const modal = tree.root.find(
    (node) => typeof node.type === "string" && String(node.type) === "Modal",
  );
  return modal.props.visible === true;
}

function captureEvents() {
  const names: string[] = [];
  setAnalyticsSink((event) => names.push(event.name));
  return names;
}

afterEach(() => {
  setAnalyticsSink(null);
  resetPromptImpressionForTests();
});

describe("FeedPersonalizeModule", () => {
  it("mostra il copy del §28 e le due azioni", () => {
    const json = textOf(setup().tree);

    expect(json).toContain(FEED_INTRO_TITLE);
    expect(json).toContain(FEED_INTRO_BODY);
    expect(json).toContain(FEED_INTRO_PRIMARY_CTA);
    expect(json).toContain(FEED_INTRO_SECONDARY_CTA);
  });

  /** §27: i quattro selettori non stanno più nella Home. */
  it("non mostra le opzioni finché non si tocca Personalizza", () => {
    const { tree } = setup();

    expect(sheetVisible(tree)).toBe(false);

    press(tree, FEED_INTRO_PRIMARY_CTA);

    expect(sheetVisible(tree)).toBe(true);
  });

  it("preseleziona nel foglio le opzioni deducibili dal profilo", () => {
    const boxes = checkboxes(setup().tree);

    expect(boxes).toHaveLength(4);
    expect(boxes[0].props.accessibilityState).toEqual({ checked: false });
    expect(boxes[1].props.accessibilityState).toEqual({ checked: true });
  });

  it("salva le sole opzioni selezionate", () => {
    const { props, tree } = setup();

    press(tree, FEED_INTRO_PRIMARY_CTA);
    act(() => {
      checkboxes(tree)[0].props.onPress();
    });
    press(tree, FEED_INTRO_SHEET_SAVE);

    expect(props.onSave).toHaveBeenCalledTimes(1);
    const selected = props.onSave.mock.calls[0][0] as string[];
    expect([...selected].sort()).toEqual(["wants_clubs", "wants_players"]);
  });

  it("Non ora chiude senza salvare (§31)", () => {
    const { props, tree } = setup();

    // La × fa la stessa cosa ma ha un'etichetta propria: lo screen reader non
    // deve trovare due controlli "Non ora" identici.
    press(tree, FEED_INTRO_SECONDARY_CTA);
    press(tree, "Chiudi");

    expect(props.onDismiss).toHaveBeenCalledTimes(2);
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("traccia impression, apertura e rinvio del §69", () => {
    const names = captureEvents();
    const { tree } = setup();

    press(tree, FEED_INTRO_PRIMARY_CTA);
    press(tree, FEED_INTRO_SECONDARY_CTA);

    expect(names).toEqual([
      "home_personalization_prompt_impression",
      "home_personalization_opened",
      "home_personalization_skipped",
    ]);
  });
});

describe("FeedPersonalizeModule — impression", () => {
  afterEach(() => {
    setAnalyticsSink(null);
    resetPromptImpressionForTests();
  });

  it("conta l'impression una volta per sessione, non a ogni rimontaggio", () => {
    const names = captureEvents();

    setup().tree.unmount();
    setup();

    expect(names.filter((name) => name === "home_personalization_prompt_impression")).toHaveLength(1);
  });
});
