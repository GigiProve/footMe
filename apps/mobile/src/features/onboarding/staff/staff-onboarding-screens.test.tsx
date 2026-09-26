import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { CoachCareerEntry } from "../coach/coach-career-types";
import { isStaffMasterStep } from "./StaffOnboardingFlow";
import { StaffAvailabilityStep } from "./StaffAvailabilityStep";
import { StaffExperiencesStep } from "./StaffExperiencesStep";
import { StaffPreviousExperiencesStep } from "./StaffPreviousExperiencesStep";
import { StaffRolesStep } from "./StaffRolesStep";

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

const searchTeams = vi.fn(async () => []);

describe("isStaffMasterStep", () => {
  it("copre schermate comuni e passi specifici dello Staff", () => {
    for (const step of [
      "base",
      "photo",
      "staff_role",
      "staff_availability",
      "staff_career",
      "staff_previous_experiences",
      "staff_coach_career",
      "staff_player_career",
    ] as const) {
      expect(isStaffMasterStep(step, "staff")).toBe(true);
    }
  });

  it("non intercetta i passi di un altro ruolo", () => {
    expect(isStaffMasterStep("base", "coach")).toBe(false);
    expect(isStaffMasterStep("coach_career", "staff")).toBe(false);
  });
});

describe("StaffRolesStep (§E, §F)", () => {
  function renderRoles(
    props: Partial<React.ComponentProps<typeof StaffRolesStep>> = {},
  ) {
    return render(
      <StaffRolesStep
        currentStep={3}
        isBusy={false}
        onBack={vi.fn()}
        onContinue={vi.fn()}
        onPrimaryRoleChange={vi.fn()}
        onRolesChange={vi.fn()}
        primaryRole=""
        selectedRoles={[]}
        stepLabel="Ruoli"
        totalSteps={6}
        {...props}
      />,
    );
  }

  it("mostra i sei ruoli V1 in selezione multipla", () => {
    const tree = renderRoles();

    for (const role of [
      "Preparatore atletico",
      "Match analyst",
      "Collaboratore tecnico",
      "Preparatore dei portieri",
      "Fisioterapista",
      "Team manager",
    ]) {
      expect(
        tree.root.findAllByProps({
          accessibilityRole: "checkbox",
          accessibilityLabel: role,
        }).length,
      ).toBeGreaterThan(0);
    }
  });

  it("con un solo ruolo lo promuove a ruolo principale e non chiede altro", () => {
    const onRolesChange = vi.fn();
    const tree = renderRoles({ onRolesChange });

    press(tree, "staff-role-Match analyst");

    expect(onRolesChange).toHaveBeenCalledWith(
      ["Match analyst"],
      "Match analyst",
    );
    expect(texts(tree)).not.toContain("Ruolo principale");
  });

  it("con due ruoli chiede il ruolo principale fra quelli selezionati", () => {
    const tree = renderRoles({
      primaryRole: "Preparatore atletico",
      selectedRoles: ["Preparatore atletico", "Match analyst"],
    });

    expect(texts(tree)).toContain("Ruolo principale");
    expect(
      tree.root.findAllByProps({ testID: "staff-primary-role-Match analyst" })
        .length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({ testID: "staff-primary-role-Fisioterapista" })
        .length,
    ).toBe(0);
  });

  it("§AZ: togliendo il ruolo principale non lascia riferimenti inconsistenti", () => {
    const onRolesChange = vi.fn();
    const tree = renderRoles({
      onRolesChange,
      primaryRole: "Match analyst",
      selectedRoles: ["Preparatore atletico", "Match analyst"],
    });

    press(tree, "staff-role-Match analyst");

    expect(onRolesChange).toHaveBeenCalledWith(
      ["Preparatore atletico"],
      "Preparatore atletico",
    );
  });
});

describe("StaffAvailabilityStep (§H–§O)", () => {
  const draft = {
    mode: "ITALY" as const,
    provinces: [] as string[],
    regions: [] as string[],
  };

  function renderAvailability(
    props: Partial<React.ComponentProps<typeof StaffAvailabilityStep>> = {},
  ) {
    return render(
      <StaffAvailabilityStep
        availableFrom=""
        categories={[]}
        currentStep={4}
        draft={draft}
        isAvailable
        isBusy={false}
        onAvailableFromChange={vi.fn()}
        onBack={vi.fn()}
        onCategoriesChange={vi.fn()}
        onContinue={vi.fn()}
        onDraftChange={vi.fn()}
        onIsAvailableChange={vi.fn()}
        stepLabel="Disponibilità"
        totalSteps={6}
        {...props}
      />,
    );
  }

  it("§I: con il toggle spento non chiede area né periodo", () => {
    const onContinue = vi.fn();
    const tree = renderAvailability({ isAvailable: false, onContinue });

    expect(
      tree.root.findAllByProps({ testID: "staff-availability-mode-italy" }),
    ).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: "staff-available-from" })).toHaveLength(
      0,
    );

    press(tree, "staff-availability-continue");

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("§J, §K: espone le tre modalità e 'Ovunque in Italia' non apre selector", () => {
    const onContinue = vi.fn();
    const tree = renderAvailability({ onContinue });

    for (const testID of [
      "staff-availability-mode-italy",
      "staff-availability-mode-regions",
      "staff-availability-mode-provinces",
    ]) {
      expect(tree.root.findAllByProps({ testID }).length).toBeGreaterThan(0);
    }

    press(tree, "staff-availability-mode-italy");
    press(tree, "staff-availability-continue");

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("§L: 'In una o più regioni' apre il selector con ricerca e multi-select", () => {
    const tree = renderAvailability({ draft: { ...draft, mode: "REGIONS" } });

    press(tree, "staff-availability-mode-regions");

    expect(
      tree.root.findAllByProps({ testID: "staff-availability-regions" }).length,
    ).toBeGreaterThan(0);
    expect(texts(tree)).toContain("Seleziona le regioni");
  });

  it("§M: 'Zone specifiche' apre il selector delle province", () => {
    const tree = renderAvailability({ draft: { ...draft, mode: "PROVINCES" } });

    press(tree, "staff-availability-mode-provinces");

    expect(
      tree.root.findAllByProps({ testID: "staff-availability-provinces" }).length,
    ).toBeGreaterThan(0);
    expect(texts(tree)).toContain("Seleziona le province");
  });

  it("§J: una modalità senza dettaglio non lascia continuare", () => {
    const onContinue = vi.fn();
    const tree = renderAvailability({
      draft: { ...draft, mode: "REGIONS" },
      onContinue,
    });

    press(tree, "staff-availability-continue");

    expect(onContinue).not.toHaveBeenCalled();
  });
});

describe("StaffExperiencesStep (§P–§X)", () => {
  function entry(overrides: Partial<CoachCareerEntry> = {}): CoachCareerEntry {
    return {
      category: "Serie A",
      clubId: null,
      description: null,
      id: "staff-entry-1",
      period: null,
      role: "Preparatore atletico",
      seasonDetails: {},
      seasons: ["2024/2025"],
      teamLogoUrl: null,
      teamName: "AC Milan",
      type: "SINGLE_SEASON",
      ...overrides,
    };
  }

  function renderExperiences(
    props: Partial<React.ComponentProps<typeof StaffExperiencesStep>> = {},
  ) {
    return render(
      <StaffExperiencesStep
        currentStep={5}
        declaredRoles={["Preparatore atletico", "Match analyst"]}
        defaultRole="Preparatore atletico"
        entries={[]}
        isBusy={false}
        onBack={vi.fn()}
        onContinue={vi.fn()}
        onUpdateEntries={vi.fn()}
        searchTeams={searchTeams}
        stepLabel="Esperienze"
        totalSteps={6}
        {...props}
      />,
    );
  }

  it("§P: l'entry propone esattamente le tre modalità", () => {
    const tree = renderExperiences();

    press(tree, "staff-career-add-experience");

    for (const type of ["MULTI_SEASON", "SINGLE_SEASON", "CUSTOM_PERIOD"]) {
      expect(
        tree.root.findAllByProps({ testID: `coach-experience-type-${type}` })
          .length,
      ).toBeGreaterThan(0);
    }
  });

  it("§R: il ruolo è precompilato con il ruolo principale e resta modificabile", () => {
    const tree = renderExperiences();

    press(tree, "staff-career-add-experience");
    press(tree, "coach-experience-type-SINGLE_SEASON");

    const roleField = tree.root
      .findAllByProps({ testID: "coach-experience-role" })
      .find((node) => Array.isArray(node.props.options));

    expect(roleField?.props.value).toBe("Preparatore atletico");
    expect(roleField?.props.options.map((o: { value: string }) => o.value)).toEqual([
      "Preparatore atletico",
      "Match analyst",
    ]);
  });

  it("§W: nessuna statistica nell'editor Staff", () => {
    const tree = renderExperiences();

    press(tree, "staff-career-add-experience");
    press(tree, "coach-experience-type-SINGLE_SEASON");

    const rendered = texts(tree);

    for (const label of ["Presenze", "Gol", "Assist", "Vittorie"]) {
      expect(rendered).not.toContain(label);
    }
  });

  it("§Z, §BD: un periodo personalizzato può restare in corso", () => {
    const tree = renderExperiences();

    press(tree, "staff-career-add-experience");
    press(tree, "coach-experience-type-CUSTOM_PERIOD");

    expect(tree.root.findAllByProps({ testID: "coach-period-end" }).length)
      .toBeGreaterThan(0);

    const ongoing = tree.root.findAll(
      (node) =>
        typeof node.type === "string" &&
        node.props.accessibilityLabel === "In corso" &&
        typeof node.props.onPress === "function",
    );

    expect(ongoing.length).toBeGreaterThan(0);

    act(() => ongoing[0].props.onPress());

    // La data di fine sparisce e non viene più richiesta dalla validazione.
    expect(tree.root.findAllByProps({ testID: "coach-period-end" })).toHaveLength(0);

    press(tree, "coach-save-experience");

    expect(texts(tree)).not.toContain("Indica il mese e l'anno di fine.");
    expect(texts(tree)).toContain("Indica il mese e l'anno di inizio.");
  });

  it("§AA, §AC: il riepilogo elenca le esperienze e offre di aggiungerne un'altra", () => {
    const tree = renderExperiences({ entries: [entry()] });

    expect(texts(tree)).toContain("Le tue esperienze");
    expect(
      tree.root.findAllByProps({ testID: "staff-career-row-staff-entry-1" })
        .length,
    ).toBeGreaterThan(0);
    expect(
      findPressable(tree, "staff-career-add-experience").props
        .accessibilityLabel ?? "",
    ).toBeDefined();
  });
});

describe("StaffPreviousExperiencesStep (§AE–§AG)", () => {
  function renderPrevious(
    props: Partial<
      React.ComponentProps<typeof StaffPreviousExperiencesStep>
    > = {},
  ) {
    return render(
      <StaffPreviousExperiencesStep
        currentStep={6}
        isBusy={false}
        onBack={vi.fn()}
        onChange={vi.fn()}
        onContinue={vi.fn()}
        selection={[]}
        stepLabel="Precedenti"
        totalSteps={6}
        {...props}
      />,
    );
  }

  it("§AF: le tre opzioni sono checkbox, non scelte esclusive", () => {
    const tree = renderPrevious();

    for (const label of [
      "Esperienza da allenatore",
      "Esperienza da calciatore",
      "Nessuna esperienza aggiuntiva",
    ]) {
      expect(
        tree.root.findAllByProps({
          accessibilityRole: "checkbox",
          accessibilityLabel: label,
        }).length,
      ).toBeGreaterThan(0);
    }
  });

  it("§AW: lo stato selezionato è annunciato, non affidato al solo colore", () => {
    const tree = renderPrevious({ selection: ["coach"] });

    const row = tree.root
      .findAllByProps({ accessibilityLabel: "Esperienza da allenatore" })
      .find((node) => node.props.accessibilityState);

    expect(row?.props.accessibilityState.checked).toBe(true);
  });

  it("§AG: 'Nessuna esperienza aggiuntiva' spegne le altre due", () => {
    const onChange = vi.fn();
    const tree = renderPrevious({
      onChange,
      selection: ["coach", "player"],
    });

    press(tree, "staff-previous-experience-none");

    expect(onChange).toHaveBeenCalledWith(["none"]);
  });

  it("§AT: senza nessuna scelta non si continua", () => {
    const onContinue = vi.fn();
    const tree = renderPrevious({ onContinue });

    press(tree, "staff-previous-experiences-continue");

    expect(onContinue).not.toHaveBeenCalled();
    expect(texts(tree)).toContain("Seleziona almeno un'opzione per continuare.");
  });
});
