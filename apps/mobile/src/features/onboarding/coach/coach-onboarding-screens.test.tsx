import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { CoachAvailabilityStep } from "./CoachAvailabilityStep";
import { CoachExperienceForm } from "./CoachExperienceForm";
import { CoachExperiencesStep } from "./CoachExperiencesStep";
import { CoachPhilosophyStep } from "./CoachPhilosophyStep";
import { CoachPlayerCareerChoiceStep } from "./CoachPlayerCareerChoiceStep";
import { CoachQualificationStep } from "./CoachQualificationStep";
import { isCoachMasterStep } from "./CoachOnboardingFlow";
import type { CoachCareerEntry } from "./coach-career-types";
import { formatCoachExperienceSubtitle } from "./coach-experience-display";

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

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

/**
 * `findAllByProps` intercetta anche il componente composito che riceve il
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

function press(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const target = findPressable(tree, testID);

  act(() => {
    target.props.onPress();
  });
}

const searchTeams = vi.fn(async () => []);

function baseEntry(
  overrides: Partial<CoachCareerEntry> = {},
): CoachCareerEntry {
  return {
    category: "Serie C",
    clubId: null,
    description: null,
    id: "entry-1",
    period: null,
    role: "Allenatore",
    seasonDetails: {},
    seasons: ["2024/2025"],
    teamLogoUrl: null,
    teamName: "Torino",
    type: "SINGLE_SEASON",
    ...overrides,
  };
}

describe("isCoachMasterStep", () => {
  it("copre schermate comuni e passi specifici dell'Allenatore", () => {
    for (const step of [
      "base",
      "photo",
      "coach_role",
      "coach_availability",
      "coach_career",
      "player_career_toggle",
      "player_career",
      "coach_extra",
    ] as const) {
      expect(isCoachMasterStep(step, "coach")).toBe(true);
    }
  });

  it("non intercetta i passi di un altro ruolo", () => {
    expect(isCoachMasterStep("base", "staff")).toBe(false);
    expect(isCoachMasterStep("player_career", "director")).toBe(false);
    expect(isCoachMasterStep("staff_career", "coach")).toBe(false);
  });
});

describe("CoachAvailabilityStep", () => {
  const draft = {
    mode: "ITALY" as const,
    provinces: [] as string[],
    regions: [] as string[],
  };

  it("§N: con il toggle spento non chiede zona né disponibilità", () => {
    const onContinue = vi.fn();
    const tree = render(
      <CoachAvailabilityStep
        availableFrom=""
        currentStep={2}
        draft={{ ...draft, mode: "REGIONS" }}
        isAvailable={false}
        isBusy={false}
        onAvailableFromChange={vi.fn()}
        onBack={vi.fn()}
        onContinue={onContinue}
        onDraftChange={vi.fn()}
        onIsAvailableChange={vi.fn()}
        stepLabel="Disponibilità"
        totalSteps={7}
      />,
    );

    expect(tree.root.findAllByProps({ testID: "coach-available-from" })).toHaveLength(
      0,
    );

    press(tree, "coach-availability-continue");

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("§J: con il toggle acceso blocca una modalità senza dettaglio", () => {
    const onContinue = vi.fn();
    const tree = render(
      <CoachAvailabilityStep
        availableFrom=""
        currentStep={2}
        draft={{ ...draft, mode: "REGIONS" }}
        isAvailable
        isBusy={false}
        onAvailableFromChange={vi.fn()}
        onBack={vi.fn()}
        onContinue={onContinue}
        onDraftChange={vi.fn()}
        onIsAvailableChange={vi.fn()}
        stepLabel="Disponibilità"
        totalSteps={7}
      />,
    );

    press(tree, "coach-availability-continue");

    expect(onContinue).not.toHaveBeenCalled();
  });

  it("§N: spegnere il toggle non cancella le zone già scelte", () => {
    const onIsAvailableChange = vi.fn();
    const onDraftChange = vi.fn();
    const tree = render(
      <CoachAvailabilityStep
        availableFrom="2026-06"
        currentStep={2}
        draft={{ mode: "REGIONS", provinces: [], regions: ["Piemonte"] }}
        isAvailable
        isBusy={false}
        onAvailableFromChange={vi.fn()}
        onBack={vi.fn()}
        onContinue={vi.fn()}
        onDraftChange={onDraftChange}
        onIsAvailableChange={onIsAvailableChange}
        stepLabel="Disponibilità"
        totalSteps={7}
      />,
    );

    const toggle = findPressable(tree, "coach-available-toggle");

    act(() => {
      toggle.props.onPress();
    });

    expect(onIsAvailableChange).toHaveBeenCalledWith(false);
    expect(onDraftChange).not.toHaveBeenCalled();
  });
});

describe("CoachPlayerCareerChoiceStep", () => {
  it("§AE: parte senza nessuna card selezionata", () => {
    const tree = render(
      <CoachPlayerCareerChoiceStep
        currentStep={5}
        hasPlayedFootball={false}
        isBusy={false}
        onBack={vi.fn()}
        onChange={vi.fn()}
        onContinue={vi.fn()}
        stepLabel="Giocatore"
        totalSteps={7}
      />,
    );

    expect(
      findPressable(tree, "coach-player-career-no").props.accessibilityState
        .checked,
    ).toBe(false);
    expect(
      findPressable(tree, "coach-player-career-yes").props.accessibilityState
        .checked,
    ).toBe(false);
  });

  it("§AF: la scelta è un bivio, non prosegue finché non si risponde", () => {
    const onChange = vi.fn();
    const onContinue = vi.fn();
    const tree = render(
      <CoachPlayerCareerChoiceStep
        currentStep={5}
        hasPlayedFootball={false}
        isBusy={false}
        onBack={vi.fn()}
        onChange={onChange}
        onContinue={onContinue}
        stepLabel="Giocatore"
        totalSteps={7}
      />,
    );

    press(tree, "coach-player-career-choice-continue");
    expect(onContinue).not.toHaveBeenCalled();

    press(tree, "coach-player-career-no");
    expect(onChange).toHaveBeenCalledWith(false);

    press(tree, "coach-player-career-choice-continue");
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

describe("CoachExperiencesStep", () => {
  it("§AQ: il riepilogo non offre nessuna CTA Salta", () => {
    const tree = render(
      <CoachExperiencesStep
        currentStep={4}
        defaultRole="Allenatore"
        entries={[]}
        isBusy={false}
        onBack={vi.fn()}
        onContinue={vi.fn()}
        onUpdateEntries={vi.fn()}
        searchTeams={searchTeams}
        stepLabel="Carriera"
        totalSteps={7}
      />,
    );

    const labels = tree.root
      .findAllByProps({ variant: "actionLabel" })
      .map((instance) => instance.props.children);

    expect(labels.join(" ")).not.toMatch(/salta/i);
  });

  it("§AD: ordina le esperienze dalla più recente alla più vecchia", () => {
    const tree = render(
      <CoachExperiencesStep
        currentStep={4}
        defaultRole="Allenatore"
        entries={[
          baseEntry({ id: "old", seasons: ["2019/2020"], teamName: "Pro Vercelli" }),
          baseEntry({ id: "new", seasons: ["2024/2025"], teamName: "Torino" }),
        ]}
        isBusy={false}
        onBack={vi.fn()}
        onContinue={vi.fn()}
        onUpdateEntries={vi.fn()}
        searchTeams={searchTeams}
        stepLabel="Carriera"
        totalSteps={7}
      />,
    );

    const rows = tree.root
      .findAllByProps({ variant: "titleSm" })
      .map((instance) => instance.props.children)
      .filter((child) => child === "Torino" || child === "Pro Vercelli");

    expect(rows[0]).toBe("Torino");
  });
});

describe("CoachExperienceForm", () => {
  it("§V: nessuna statistica, in nessuna modalità", () => {
    const tree = render(
      <CoachExperienceForm
        entry={baseEntry({ type: "MULTI_SEASON", seasons: ["2024/2025"] })}
        isEditing={false}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        searchTeams={searchTeams}
      />,
    );

    const text = JSON.stringify(tree.toJSON());

    for (const forbidden of ["presenz", "Gol", "Assist", "Vittorie", "Pareggi"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("§S: ogni stagione selezionata ha il proprio ruolo", () => {
    const onSave = vi.fn();
    const tree = render(
      <CoachExperienceForm
        entry={baseEntry({
          seasonDetails: {
            "2023/2024": { category: "Serie C", role: "Allenatore" },
            "2024/2025": { category: "Serie C", role: "Allenatore" },
          },
          seasons: ["2024/2025", "2023/2024"],
          type: "MULTI_SEASON",
        })}
        isEditing
        onCancel={vi.fn()}
        onSave={onSave}
        searchTeams={searchTeams}
      />,
    );

    const seasonRole = tree.root.findByProps({ testID: "season-role-2023/2024" });

    act(() => {
      seasonRole.props.onChange("Preparatore atletico");
    });

    press(tree, "coach-save-experience");

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as CoachCareerEntry;

    // L'anno modificato cambia, gli altri restano dove sono (§T).
    expect(saved.seasonDetails["2023/2024"].role).toBe("Preparatore atletico");
    expect(saved.seasonDetails["2024/2025"].role).toBe("Allenatore");
  });

  it("§Z: la data finale non può precedere quella iniziale", () => {
    const onSave = vi.fn();
    const tree = render(
      <CoachExperienceForm
        entry={baseEntry({
          period: {
            endMonth: "Gennaio",
            endYear: "2024",
            startMonth: "Febbraio",
            startYear: "2025",
          },
          seasons: [],
          type: "CUSTOM_PERIOD",
        })}
        isEditing
        onCancel={vi.fn()}
        onSave={onSave}
        searchTeams={searchTeams}
      />,
    );

    press(tree, "coach-save-experience");

    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("formatCoachExperienceSubtitle", () => {
  it("dice quanti ruoli ci sono quando le stagioni non concordano", () => {
    expect(
      formatCoachExperienceSubtitle(
        baseEntry({
          seasonDetails: {
            "2023/2024": { category: "Serie C", role: "Preparatore atletico" },
            "2024/2025": { category: "Serie C", role: "Allenatore" },
          },
          seasons: ["2024/2025", "2023/2024"],
          type: "MULTI_SEASON",
        }),
      ),
    ).toBe("2 ruoli · Serie C");
  });

  it("mostra il ruolo singolo quando è uno solo", () => {
    expect(formatCoachExperienceSubtitle(baseEntry())).toBe(
      "Allenatore · Serie C",
    );
  });
});

describe("schermate di ruolo", () => {
  it("Qualifica espone ruolo, patentino e categorie a chip", () => {
    const onCategoriesChange = vi.fn();
    const tree = render(
      <CoachQualificationStep
        categories={["Prima Squadra"]}
        currentStep={3}
        isBusy={false}
        licenseType="UEFA Pro"
        onBack={vi.fn()}
        onCategoriesChange={onCategoriesChange}
        onContinue={vi.fn()}
        onLicenseTypeChange={vi.fn()}
        onPrimaryRoleChange={vi.fn()}
        primaryRole="Allenatore"
        stepLabel="Qualifica"
        totalSteps={7}
      />,
    );

    expect(tree.root.findAllByProps({ testID: "coach-primary-role" }).length)
      .toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "coach-license-type" }).length)
      .toBeGreaterThan(0);

    // §F: le chip sono multi-select, quindi un tap aggiunge senza sostituire.
    press(tree, "coach-categories-Allievi");

    expect(onCategoriesChange).toHaveBeenCalledWith([
      "Prima Squadra",
      "Allievi",
    ]);
  });

  it("Filosofia mostra il contatore solo quando si è scritto qualcosa", () => {
    const empty = render(
      <CoachPhilosophyStep
        currentStep={7}
        formation=""
        isBusy={false}
        languages={[]}
        onBack={vi.fn()}
        onFinish={vi.fn()}
        onFormationChange={vi.fn()}
        onLanguagesChange={vi.fn()}
        onPhilosophyChange={vi.fn()}
        onPlayStyleChange={vi.fn()}
        philosophy=""
        playStyle=""
        stepLabel="Profilo"
        totalSteps={7}
      />,
    );

    expect(JSON.stringify(empty.toJSON())).not.toContain("/1000");

    const filled = render(
      <CoachPhilosophyStep
        currentStep={7}
        formation="4-3-3"
        isBusy={false}
        languages={["Italiano"]}
        onBack={vi.fn()}
        onFinish={vi.fn()}
        onFormationChange={vi.fn()}
        onLanguagesChange={vi.fn()}
        onPhilosophyChange={vi.fn()}
        onPlayStyleChange={vi.fn()}
        philosophy="Possesso e pressing."
        playStyle="Possesso palla"
        stepLabel="Profilo"
        totalSteps={7}
      />,
    );

    expect(JSON.stringify(filled.toJSON())).toContain("20/1000");
  });
});
