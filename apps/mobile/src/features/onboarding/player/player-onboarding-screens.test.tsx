import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { FootballPitchRoleSelector } from "./FootballPitchRoleSelector";
import { PlayerAvailabilityStep } from "./PlayerAvailabilityStep";
import { PlayerCareerStep } from "./PlayerCareerStep";
import type { GeographicAvailabilityDraft } from "./geographic-availability";

vi.mock("@expo/vector-icons/Ionicons", () => {
  function Ionicons(props: Record<string, unknown>) {
    return React.createElement("Ionicon", props);
  }

  Ionicons.glyphMap = {};

  return { default: Ionicons };
});

vi.mock("../../profiles/player-sports-section", () => ({
  TeamAutocompleteInput: (props: Record<string, unknown>) =>
    React.createElement("MockTeamAutocompleteInput", props),
}));

/**
 * `findByProps` intercetta anche il componente composito che riceve il
 * `testID`: qui serve l'elemento premibile che lo rende davvero.
 */
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

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

/** `onLayout` non scatta in test: lo simuliamo per far comparire i nodi. */
function layoutPitch(tree: TestRenderer.ReactTestRenderer) {
  const pitch = tree.root.findByProps({ testID: "player-pitch-surface" });

  act(() => {
    pitch.props.onLayout({
      nativeEvent: { layout: { height: 400, width: 272 } },
    });
  });
}

describe("FootballPitchRoleSelector", () => {
  it("mostra un nodo per ogni ruolo con un'etichetta accessibile", () => {
    const tree = render(
      <FootballPitchRoleSelector
        testID="player-pitch"
        onSelectPrimary={vi.fn()}
        primaryPosition=""
        secondaryPosition=""
      />,
    );

    layoutPitch(tree);

    const goalkeeper = findPressable(tree, "pitch-role-goalkeeper");

    expect(goalkeeper.props.accessibilityLabel).toBe(
      "Portiere — non selezionato",
    );
  });

  it("il tap su un nodo imposta il ruolo principale", () => {
    const onSelectPrimary = vi.fn();
    const tree = render(
      <FootballPitchRoleSelector
        testID="player-pitch"
        onSelectPrimary={onSelectPrimary}
        primaryPosition=""
        secondaryPosition=""
      />,
    );

    layoutPitch(tree);

    act(() => {
      findPressable(tree, "pitch-role-striker").props.onPress();
    });

    expect(onSelectPrimary).toHaveBeenCalledWith("striker");
  });

  it("distingue principale e secondario sullo stesso campo", () => {
    const tree = render(
      <FootballPitchRoleSelector
        testID="player-pitch"
        onSelectPrimary={vi.fn()}
        primaryPosition="central_midfielder"
        secondaryPosition="attacking_midfielder"
      />,
    );

    layoutPitch(tree);

    expect(
      findPressable(tree, "pitch-role-central_midfielder").props
        .accessibilityLabel,
    ).toBe("Centrocampista centrale — ruolo principale");
    expect(
      findPressable(tree, "pitch-role-attacking_midfielder").props
        .accessibilityLabel,
    ).toBe("Trequartista — ruolo secondario");
  });
});

describe("PlayerAvailabilityStep", () => {
  function renderStep(
    draft: GeographicAvailabilityDraft,
    overrides: Partial<React.ComponentProps<typeof PlayerAvailabilityStep>> = {},
  ) {
    const props: React.ComponentProps<typeof PlayerAvailabilityStep> = {
      categories: [],
      currentStep: 4,
      draft,
      isAvailable: true,
      isBusy: false,
      onBack: vi.fn(),
      onCategoriesChange: vi.fn(),
      onContinue: vi.fn(),
      onDraftChange: vi.fn(),
      onIsAvailableChange: vi.fn(),
      stepLabel: "Disponibilità",
      totalSteps: 5,
      ...overrides,
    };

    return { props, tree: render(<PlayerAvailabilityStep {...props} />) };
  }

  it("Ovunque in Italia è una scelta diretta, senza chevron", () => {
    const { tree } = renderStep({ mode: "ITALY", provinces: [], regions: [] });
    const card = findPressable(tree, "availability-mode-italy");

    expect(card.props.accessibilityRole).toBe("radio");
    expect(card.props.accessibilityState.selected).toBe(true);
  });

  it("le due modalità di dettaglio aprono un livello successivo", () => {
    const { tree } = renderStep({ mode: "ITALY", provinces: [], regions: [] });

    for (const testID of [
      "availability-mode-regions",
      "availability-mode-provinces",
    ]) {
      const card = findPressable(tree, testID);

      expect(card.props.accessibilityRole).toBe("button");
      expect(card.props.accessibilityHint).toBe(
        "Apre la selezione di dettaglio",
      );
    }
  });

  it("scegliere le regioni apre subito il selettore regioni", () => {
    const { tree } = renderStep({ mode: "ITALY", provinces: [], regions: [] });

    act(() => {
      findPressable(tree, "availability-mode-regions").props.onPress();
    });

    expect(
      tree.root.findByProps({ testID: "availability-regions" }),
    ).toBeTruthy();
  });

  it("non procede senza almeno una regione", () => {
    const onContinue = vi.fn();
    const { tree } = renderStep(
      { mode: "REGIONS", provinces: [], regions: [] },
      { onContinue },
    );

    act(() => {
      findPressable(tree, "availability-continue").props.onPress();
    });

    expect(onContinue).not.toHaveBeenCalled();
    expect(
      tree.root.findByProps({ message: "Seleziona almeno una regione." }),
    ).toBeTruthy();
  });

  it("non procede senza almeno una categoria di interesse", () => {
    const onContinue = vi.fn();
    const { tree } = renderStep(
      { mode: "ITALY", provinces: [], regions: [] },
      { categories: [], onContinue },
    );

    act(() => {
      findPressable(tree, "availability-continue").props.onPress();
    });

    expect(onContinue).not.toHaveBeenCalled();
    expect(
      tree.root.findByProps({ message: "Seleziona almeno una categoria." }),
    ).toBeTruthy();
  });

  it("con la modalità completa mostra il riepilogo prima di continuare", () => {
    const onContinue = vi.fn();
    const { tree } = renderStep(
      { mode: "REGIONS", provinces: [], regions: ["Lombardia"] },
      { categories: ["Serie A"], onContinue },
    );

    act(() => {
      findPressable(tree, "availability-continue").props.onPress();
    });

    expect(onContinue).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ testID: "availability-recap" })).toBeTruthy();

    act(() => {
      findPressable(tree, "availability-recap-continue").props.onPress();
    });

    expect(onContinue).toHaveBeenCalled();
  });
});

describe("PlayerCareerStep", () => {
  function renderStep(
    overrides: Partial<React.ComponentProps<typeof PlayerCareerStep>> = {},
  ) {
    return render(
      <PlayerCareerStep
        careerEntries={[]}
        currentStep={5}
        isBusy={false}
        onBack={vi.fn()}
        onContinue={vi.fn()}
        onUpdateEntries={vi.fn()}
        searchTeams={vi.fn().mockResolvedValue([])}
        stepLabel="Esperienze"
        totalSteps={5}
        {...overrides}
      />,
    );
  }

  it("parte dallo stato vuoto e non offre alcun Salta", () => {
    const tree = renderStep();

    expect(tree.root.findByProps({ testID: "career-empty-state" })).toBeTruthy();
    expect(tree.root.findAllByProps({ label: "Salta" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ label: "Salta per ora" })).toHaveLength(0);
  });

  it("offre esattamente le tre tipologie di esperienza", () => {
    const tree = renderStep();

    act(() => {
      findPressable(tree, "career-add-experience").props.onPress();
    });

    for (const type of ["MULTI_SEASON", "SINGLE_SEASON", "CUSTOM_PERIOD"]) {
      expect(
        tree.root.findByProps({ testID: `experience-type-${type}` }),
      ).toBeTruthy();
    }
  });

  it("il periodo personalizzato usa due soli campi mese+anno", () => {
    const tree = renderStep();

    act(() => {
      findPressable(tree, "career-add-experience").props.onPress();
    });

    act(() => {
      findPressable(tree, "experience-type-CUSTOM_PERIOD").props.onPress();
    });

    expect(
      tree.root.findByProps({ testID: "custom-period-start" }),
    ).toBeTruthy();
    expect(tree.root.findByProps({ testID: "custom-period-end" })).toBeTruthy();
  });
});
