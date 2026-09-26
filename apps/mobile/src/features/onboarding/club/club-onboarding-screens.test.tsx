import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { defaultOnboardingFormState } from "../onboarding-form";
import { ClubFirstTeamStep } from "./ClubFirstTeamStep";
import { ClubProfileStep } from "./ClubProfileStep";
import { ClubStructureStep } from "./ClubStructureStep";
import { ClubYouthStep } from "./ClubYouthStep";
import { isClubMasterStep } from "./ClubOnboardingFlow";

vi.mock("@expo/vector-icons/Ionicons", () => {
  function Ionicons(props: Record<string, unknown>) {
    return React.createElement("Ionicon", props);
  }

  Ionicons.glyphMap = {};

  return { default: Ionicons };
});

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

function findPressable(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const match = tree.root
    .findAllByProps({ testID })
    .find(
      (instance) =>
        typeof instance.type === "string" &&
        typeof instance.props.onPress === "function",
    );

  if (!match) {
    throw new Error(`Nessun elemento premibile con testID "${testID}"`);
  }

  return match;
}

function texts(tree: TestRenderer.ReactTestRenderer) {
  return tree.root
    .findAll((node) => typeof node.type === "string")
    .flatMap((node) =>
      React.Children.toArray(node.props.children).filter(
        (child): child is string => typeof child === "string",
      ),
    );
}

/** Il bottom sheet resta montato anche da chiuso: questo dice se è aperto. */
function openSheetTitles(tree: TestRenderer.ReactTestRenderer) {
  return tree.root
    .findAllByType("Modal" as never)
    .filter((node) => node.props.visible)
    .flatMap((node) =>
      node
        .findAll((child) => typeof child.type === "string")
        .flatMap((child) =>
          React.Children.toArray(child.props.children).filter(
            (value): value is string => typeof value === "string",
          ),
        ),
    );
}

const counter = { current: 4, label: "Struttura", total: 7 };

describe("REV-ONB-05 — Struttura del club (§N–§R)", () => {
  function renderStructure(overrides: Record<string, unknown> = {}) {
    return render(
      <ClubStructureStep
        currentStep={counter.current}
        isBusy={false}
        onBack={() => {}}
        onContinue={() => {}}
        onSelect={() => {}}
        stepLabel={counter.label}
        totalSteps={counter.total}
        value=""
        {...overrides}
      />,
    );
  }

  it("presenta le tre configurazioni con il copy della task", () => {
    const rendered = texts(renderStructure());

    expect(rendered).toContain("Come è strutturato il tuo club?");
    expect(rendered).toContain("Prima squadra");
    expect(rendered).toContain("Prima squadra + settore giovanile");
    expect(rendered).toContain("Solo settore giovanile");
    expect(rendered).toContain(
      "La società opera esclusivamente nel calcio giovanile.",
    );
  });

  it("espone le opzioni come radio, non come checkbox (§BH)", () => {
    const tree = renderStructure({ value: "youth_only" });
    const option = findPressable(tree, "club-structure-youth_only");

    expect(option.props.accessibilityRole).toBe("radio");
    expect(option.props.accessibilityState).toMatchObject({ checked: true });
  });

  it("propaga la configurazione scelta", () => {
    const onSelect = vi.fn();
    const tree = renderStructure({ onSelect });

    act(() => {
      findPressable(tree, "club-structure-first_team_and_youth").props.onPress();
    });

    expect(onSelect).toHaveBeenCalledWith("first_team_and_youth");
  });
});

describe("REV-ONB-05 — Settore giovanile (§X–§Z)", () => {
  function renderYouth(selected: string[] = []) {
    return render(
      <ClubYouthStep
        currentStep={5}
        isBusy={false}
        onBack={() => {}}
        onChange={() => {}}
        onContinue={() => {}}
        selectedCategories={selected}
        stepLabel="Settore giovanile"
        totalSteps={7}
      />,
    );
  }

  it("non ripropone il toggle sul settore giovanile (§X)", () => {
    expect(texts(renderYouth())).not.toContain(
      "La società ha un settore giovanile",
    );
  });

  it("usa le macro-categorie e non l'elenco delle Under (§Y)", () => {
    const rendered = texts(renderYouth());

    expect(rendered).toContain("Primavera");
    expect(rendered).toContain("Attività di base");
    expect(rendered).not.toContain("Under 17");
    expect(rendered).not.toContain("Under 15");
  });

  it("è multi-selezione con stato leggibile (§Z, §BH)", () => {
    const tree = renderYouth(["Allievi", "Primavera"]);

    expect(
      findPressable(tree, "club-youth-Allievi").props.accessibilityRole,
    ).toBe("checkbox");
    expect(
      findPressable(tree, "club-youth-Allievi").props.accessibilityState,
    ).toMatchObject({ checked: true });
    expect(
      findPressable(tree, "club-youth-Giovanissimi").props.accessibilityState,
    ).toMatchObject({ checked: false });
  });
});

describe("REV-ONB-05 — Prima squadra (§U–§W)", () => {
  it("chiede una sola categoria senza srotolare la lista nella pagina", () => {
    const tree = render(
      <ClubFirstTeamStep
        currentStep={4}
        isBusy={false}
        onBack={() => {}}
        onChange={() => {}}
        onContinue={() => {}}
        stepLabel="Prima squadra"
        totalSteps={6}
        value=""
      />,
    );

    const rendered = texts(tree);

    expect(rendered).toContain("Prima squadra");
    expect(rendered).toContain("Seleziona categoria");
    // Le categorie vivono nel bottom sheet, che parte chiuso: la pagina non
    // srotola l elenco dei campionati (§W).
    expect(openSheetTitles(tree)).toEqual([]);
  });
});

describe("REV-ONB-05 — Completa il profilo (§AG–§AN)", () => {
  function renderProfile() {
    return render(
      <ClubProfileStep
        currentStep={7}
        form={defaultOnboardingFormState}
        isBusy={false}
        onBack={() => {}}
        onFieldChange={() => {}}
        onSubmit={() => {}}
        stepLabel="Profilo"
        totalSteps={7}
      />,
    );
  }

  it("mostra solo sito e Instagram, con l'aggiunta progressiva (§AK)", () => {
    const rendered = texts(renderProfile());

    expect(rendered).toContain("Sito web");
    expect(rendered).toContain("Instagram");
    expect(rendered).toContain("Aggiungi altro canale");
    // Facebook, TikTok e YouTube esistono solo dentro il selector chiuso:
    // nessun campo vuoto per piattaforme che il club non usa (§AL).
    expect(openSheetTitles(renderProfile())).toEqual([]);
  });

  it("non chiede più il numero di tesserati e non offre un Salta (§AJ, §AN)", () => {
    const rendered = texts(renderProfile());

    expect(rendered).not.toContain("Numero totale tesserati");
    expect(rendered).not.toContain("Salta");
    expect(rendered).toContain("Completa registrazione");
  });
});

describe("REV-ONB-05 — instradamento", () => {
  it("rivendica i passi Società e lascia stare gli altri ruoli", () => {
    expect(isClubMasterStep("club_structure", "club_admin")).toBe(true);
    expect(isClubMasterStep("club_first_team", "club_admin")).toBe(true);
    expect(isClubMasterStep("club_structure", "coach")).toBe(false);
    expect(isClubMasterStep("base", "club_admin")).toBe(false);
  });
});
