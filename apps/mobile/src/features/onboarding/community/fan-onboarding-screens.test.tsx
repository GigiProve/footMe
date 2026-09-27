import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { isCommunityMasterStep } from "./CommunityOnboardingFlow";
import { CommunityPathStep } from "./CommunityPathStep";
import { FanFootballTypesStep } from "./FanFootballTypesStep";
import { FanTerritoriesStep } from "./FanTerritoriesStep";

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

function press(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const target = findPressable(tree, testID);

  act(() => {
    target.props.onPress();
  });
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

function queryTestID(tree: TestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.findAllByProps({ testID }).length > 0;
}

describe("isCommunityMasterStep", () => {
  it("copre il bivio e tutti i passi del Tifoso", () => {
    for (const step of [
      "community_profile_type",
      "base",
      "photo",
      "fan_football_types",
      "fan_territories",
    ] as const) {
      expect(isCommunityMasterStep(step, "fan")).toBe(true);
    }
  });

  /**
   * §G, REV-ONB-09 §7, §8: il Media / Creator condivide il bivio e i due
   * passi comuni di identità, poi prende la sua strada.
   */
  it("intercetta del Media / Creator il bivio e i passi comuni", () => {
    expect(isCommunityMasterStep("community_profile_type", "media")).toBe(true);
    expect(isCommunityMasterStep("base", "media")).toBe(true);
    expect(isCommunityMasterStep("photo", "media")).toBe(true);
    expect(isCommunityMasterStep("media_entity", "media")).toBe(false);
    expect(isCommunityMasterStep("fan_football_types", "media")).toBe(false);
  });

  it("non intercetta i passi di un altro ruolo", () => {
    expect(isCommunityMasterStep("base", "coach")).toBe(false);
    expect(isCommunityMasterStep("fan_territories", "player")).toBe(false);
  });
});

describe("CommunityPathStep (§E, §F)", () => {
  function renderPath(
    props: Partial<React.ComponentProps<typeof CommunityPathStep>> = {},
  ) {
    return render(
      <CommunityPathStep
        currentStep={1}
        isBusy={false}
        onContinue={vi.fn()}
        onSelect={vi.fn()}
        selectedValue=""
        stepLabel="Percorso"
        totalSteps={5}
        {...props}
      />,
    );
  }

  it("propone due sole opzioni, con titolo e copy della task", () => {
    const rendered = texts(renderPath());

    expect(rendered).toContain("Come vuoi usare ProLink?");
    expect(rendered).toContain(
      "Scegli il profilo che descrive meglio il tuo utilizzo della piattaforma.",
    );
    expect(rendered).toContain("Tifoso");
    expect(rendered).toContain("Media/Creator");
    // §B: il vecchio vocabolario non è più visibile da nessuna parte.
    expect(rendered).not.toContain("Profilo base");
    expect(rendered).not.toContain("Media e appassionati");
  });

  it("seleziona un percorso alla volta", () => {
    const onSelect = vi.fn();
    const tree = renderPath({ onSelect });

    press(tree, "community-path-fan");

    expect(onSelect).toHaveBeenCalledWith("fan");
    expect(
      findPressable(tree, "community-path-fan").props.accessibilityRole,
    ).toBe("radio");
  });

  it("mostra l'errore di validazione inline (§AL)", () => {
    const rendered = texts(
      renderPath({ errorMessage: "Seleziona il tipo di profilo." }),
    );

    expect(rendered).toContain("Seleziona il tipo di profilo.");
  });
});

describe("FanFootballTypesStep (§J–§N)", () => {
  function renderTypes(
    props: Partial<React.ComponentProps<typeof FanFootballTypesStep>> = {},
  ) {
    return render(
      <FanFootballTypesStep
        currentStep={4}
        isBusy={false}
        onBack={vi.fn()}
        onChange={vi.fn()}
        onContinue={vi.fn()}
        selectedValues={[]}
        stepLabel="Calcio"
        totalSteps={5}
        {...props}
      />,
    );
  }

  it("mostra le quattro macro-categorie e nessun campionato (§K)", () => {
    const rendered = texts(renderTypes());

    expect(rendered).toContain("Che calcio vuoi seguire?");
    expect(rendered).toContain("Calcio professionistico");
    expect(rendered).toContain("Calcio dilettantistico");
    expect(rendered).toContain("Calcio femminile");
    expect(rendered).toContain("Calcio giovanile");

    for (const league of ["Serie A", "Serie B", "Serie D", "Eccellenza"]) {
      expect(rendered).not.toContain(league);
    }
  });

  it("accumula le selezioni invece di sostituirle (§N)", () => {
    const onChange = vi.fn();
    const tree = renderTypes({ onChange, selectedValues: ["professional"] });

    press(tree, "fan-football-type-youth");

    expect(onChange).toHaveBeenCalledWith(["professional", "youth"]);
  });

  it("deseleziona una categoria già scelta", () => {
    const onChange = vi.fn();
    const tree = renderTypes({
      onChange,
      selectedValues: ["professional", "youth"],
    });

    press(tree, "fan-football-type-professional");

    expect(onChange).toHaveBeenCalledWith(["youth"]);
  });

  it("usa checkbox, non radio: le categorie non si escludono (§N)", () => {
    const tree = renderTypes();

    expect(
      findPressable(tree, "fan-football-type-women").props.accessibilityRole,
    ).toBe("checkbox");
  });
});

describe("FanTerritoriesStep (§Q–§AA)", () => {
  function renderTerritories(
    props: Partial<React.ComponentProps<typeof FanTerritoriesStep>> = {},
  ) {
    return render(
      <FanTerritoriesStep
        currentStep={5}
        draft={{ mode: "ITALY", provinces: [], regions: [] }}
        isBusy={false}
        onBack={vi.fn()}
        onContinue={vi.fn()}
        onDraftChange={vi.fn()}
        stepLabel="Territori"
        totalSteps={5}
        {...props}
      />,
    );
  }

  it("mostra le tre modalità con il copy del Tifoso, non della disponibilità", () => {
    const rendered = texts(renderTerritories());

    expect(rendered).toContain("Dove vuoi seguire il calcio?");
    expect(rendered).toContain(
      "Scegli da quali territori vuoi ricevere contenuti e aggiornamenti.",
    );
    expect(rendered).toContain("Tutta Italia");
    expect(rendered).toContain("In una o più regioni");
    expect(rendered).toContain("Zone specifiche");
    expect(rendered).not.toContain("Disponibilità geografica");
  });

  /** §S: il chevron dice "qui dentro c'è dell'altro", il radio "ho scelto". */
  it("dà il chevron solo alle due modalità che aprono un livello", () => {
    const tree = renderTerritories();

    expect(
      findPressable(tree, "fan-territory-mode-italy").props.accessibilityRole,
    ).toBe("radio");
    expect(
      findPressable(tree, "fan-territory-mode-regions").props.accessibilityRole,
    ).toBe("button");
    expect(
      findPressable(tree, "fan-territory-mode-provinces").props
        .accessibilityRole,
    ).toBe("button");
  });

  it("non apre altre schermate scegliendo tutta Italia (§R)", () => {
    const onDraftChange = vi.fn();
    const tree = renderTerritories({
      draft: { mode: "REGIONS", provinces: [], regions: ["Lombardia"] },
      onDraftChange,
    });

    press(tree, "fan-territory-mode-italy");

    expect(onDraftChange).toHaveBeenCalledWith({
      // §AA: le regioni restano nella bozza, solo la modalità attiva cambia.
      mode: "ITALY",
      provinces: [],
      regions: ["Lombardia"],
    });
    expect(queryTestID(tree, "fan-regions")).toBe(false);
  });

  it("apre la ricerca regioni e ci mantiene le selezioni (§T–§W)", () => {
    const tree = renderTerritories({
      draft: { mode: "REGIONS", provinces: [], regions: ["Lombardia"] },
    });

    press(tree, "fan-territory-mode-regions");

    const rendered = texts(tree);

    expect(rendered).toContain("Seleziona le regioni");
    expect(rendered).toContain("Hai selezionato 1 regione");
    expect(rendered).toContain("Lombardia");
  });

  it("apre la ricerca province con il proprio copy (§X, §Z)", () => {
    const tree = renderTerritories({
      draft: {
        mode: "PROVINCES",
        provinces: ["Milano", "Bergamo"],
        regions: [],
      },
    });

    press(tree, "fan-territory-mode-provinces");

    const rendered = texts(tree);

    expect(rendered).toContain("Seleziona le province");
    expect(rendered).toContain("Scegli una o più province che vuoi seguire.");
    expect(rendered).toContain("Hai selezionato 2 province");
  });

  it("blocca il Continua senza il dettaglio della modalità scelta (§AL)", () => {
    const onContinue = vi.fn();
    const tree = renderTerritories({
      draft: { mode: "REGIONS", provinces: [], regions: [] },
      onContinue,
    });

    press(tree, "fan-territories-continue");

    expect(onContinue).not.toHaveBeenCalled();
    expect(texts(tree)).toContain("Seleziona almeno una regione.");
  });

  it("lascia passare tutta Italia senza altre selezioni", () => {
    const onContinue = vi.fn();
    const tree = renderTerritories({ onContinue });

    press(tree, "fan-territories-continue");

    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
