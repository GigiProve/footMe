import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setAnalyticsSink } from "../../../../lib/analytics";
import {
  FEED_INTRO_AREAS_TITLE,
  FEED_INTRO_BODY,
  FEED_INTRO_CLOSE,
  FEED_INTRO_EDIT_AREAS_A11Y,
  FEED_INTRO_NOTE,
  FEED_INTRO_PRIMARY_CTA,
  FEED_INTRO_TITLE,
} from "../../feed-labels";
import type { FeedIntroArea } from "../../feed-types";
import { countTestId, press, render, textOf } from "../feed-test-helpers";
import { FeedPersonalizeModule, resetIntroImpressionForTests } from "./FeedPersonalizeModule";

const AREAS: FeedIntroArea[] = [
  { kind: "region", label: "Lombardia" },
  { kind: "province", label: "Monza e Brianza" },
];

function setup(areas: FeedIntroArea[] = AREAS, withEdit = true) {
  const props = {
    areas,
    onClose: vi.fn(),
    onEditAreas: withEdit ? vi.fn() : undefined,
    onStart: vi.fn(),
  };

  return { props, tree: render(<FeedPersonalizeModule {...props} />) };
}

function captureEvents() {
  const names: string[] = [];
  setAnalyticsSink((event) => names.push(event.name));
  return names;
}

afterEach(() => {
  setAnalyticsSink(null);
  resetIntroImpressionForTests();
});

describe("FeedPersonalizeModule (HOM-13 D1)", () => {
  it("mostra il copy dei §136–§139 e la CTA principale «Inizia»", () => {
    const json = textOf(setup().tree);

    expect(json).toContain(FEED_INTRO_TITLE);
    expect(json).toContain(FEED_INTRO_BODY);
    expect(json).toContain(FEED_INTRO_NOTE);
    expect(json).toContain(FEED_INTRO_PRIMARY_CTA);
  });

  it("non ha checkbox né il vecchio «Non ora» (§240, §146)", () => {
    const { tree } = setup();

    const checkboxes = tree.root.findAll(
      (node) => typeof node.type === "string" && node.props?.accessibilityRole === "checkbox",
    );
    expect(checkboxes).toHaveLength(0);
    expect(textOf(tree)).not.toContain("Non ora");
    expect(textOf(tree)).not.toContain("Personalizza");
  });

  it("mostra «Le tue aree» con i valori del profilo (§140–§141)", () => {
    const json = textOf(setup().tree);

    expect(json).toContain(FEED_INTRO_AREAS_TITLE);
    expect(json).toContain("Lombardia");
    expect(json).toContain("Monza e Brianza");
  });

  it("senza aree non mostra la sezione", () => {
    const { tree } = setup([]);

    expect(countTestId(tree, "feed-personalize-areas")).toBe(0);
    expect(textOf(tree)).not.toContain(FEED_INTRO_AREAS_TITLE);
  });

  it("«Inizia» riconosce lo stato", () => {
    const { props, tree } = setup();

    press(tree, FEED_INTRO_PRIMARY_CTA);

    expect(props.onStart).toHaveBeenCalledTimes(1);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("l'accesso rapido chiude (§144)", () => {
    const { props, tree } = setup();

    press(tree, FEED_INTRO_CLOSE);

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onStart).not.toHaveBeenCalled();
  });

  it("«Modifica» porta all'editor del profilo (§142)", () => {
    const { props, tree } = setup();

    press(tree, FEED_INTRO_EDIT_AREAS_A11Y);

    expect(props.onEditAreas).toHaveBeenCalledTimes(1);
  });

  it("senza route di editor «Modifica» non compare", () => {
    const { tree } = setup(AREAS, false);

    expect(() => press(tree, FEED_INTRO_EDIT_AREAS_A11Y)).toThrow();
  });

  it("conta l'impression una volta per sessione, non a ogni rimontaggio", () => {
    const names = captureEvents();

    setup().tree.unmount();
    setup();

    expect(names.filter((name) => name === "home_intro_impression")).toHaveLength(1);
  });
});
