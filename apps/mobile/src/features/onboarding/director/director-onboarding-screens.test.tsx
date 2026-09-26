import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { isDirectorMasterStep } from "./DirectorOnboardingFlow";
import { DirectorAvailabilityStep } from "./DirectorAvailabilityStep";
import { DirectorClubRoleStep } from "./DirectorClubRoleStep";
import { DirectorFocusStep } from "./DirectorFocusStep";
import { DirectorPresentationStep } from "./DirectorPresentationStep";
import { DirectorPreviousExperiencesStep } from "./DirectorPreviousExperiencesStep";
import { DirectorResponsibilitiesStep } from "./DirectorResponsibilitiesStep";

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

function queryTestID(tree: TestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.findAllByProps({ testID }).length > 0;
}

describe("isDirectorMasterStep", () => {
  it("copre schermate comuni e passi specifici del Dirigente", () => {
    for (const step of [
      "base",
      "photo",
      "director_roles",
      "director_responsibilities",
      "director_focus",
      "director_availability",
      "director_career",
      "director_previous_experiences",
      "director_player_career",
      "director_coach_career",
      "director_staff_career",
      "director_other_career",
      "director_extra",
    ] as const) {
      expect(isDirectorMasterStep(step, "director")).toBe(true);
    }
  });

  it("non intercetta i passi di un altro ruolo", () => {
    expect(isDirectorMasterStep("base", "coach")).toBe(false);
    expect(isDirectorMasterStep("staff_career", "director")).toBe(false);
  });
});

describe("DirectorClubRoleStep (§F–§H)", () => {
  function renderRoles(
    props: Partial<React.ComponentProps<typeof DirectorClubRoleStep>> = {},
  ) {
    return render(
      <DirectorClubRoleStep
        currentStep={4}
        isBusy={false}
        onBack={vi.fn()}
        onContinue={vi.fn()}
        onOtherRoleLabelChange={vi.fn()}
        onPrimaryRoleChange={vi.fn()}
        onRolesChange={vi.fn()}
        otherRoleLabel=""
        primaryRole=""
        selectedRoles={[]}
        stepLabel="Ruolo"
        totalSteps={10}
        {...props}
      />,
    );
  }

  it("mostra tutti i ruoli in un'unica sezione, Presidente compreso", () => {
    const tree = renderRoles();
    const rendered = texts(tree);

    for (const role of [
      "Presidente",
      "Vicepresidente",
      "Direttore sportivo",
      "Direttore generale",
      "Team manager",
      "Responsabile scouting",
      "Responsabile settore giovanile",
      "Direttore tecnico",
      "Segretario generale",
      "Dirigente generico",
      "Altro",
    ]) {
      expect(rendered).toContain(role);
    }

    // §F: nessuna distinzione fra ruoli principali e responsabilità extra.
    expect(rendered).toContain("Ruoli ricoperti");
    expect(rendered).not.toContain("Responsabilità extra");
  });

  it("non chiede il ruolo principale con un ruolo solo (§G)", () => {
    const tree = renderRoles({ selectedRoles: ["Presidente"] });

    expect(texts(tree)).not.toContain("Ruolo principale");
  });

  it("chiede il ruolo principale solo fra i ruoli selezionati (§G)", () => {
    const tree = renderRoles({
      primaryRole: "Presidente",
      selectedRoles: ["Presidente", "Direttore sportivo"],
    });

    expect(texts(tree)).toContain("Ruolo principale");
    expect(queryTestID(tree, "director-primary-role-Presidente")).toBe(true);
    expect(
      queryTestID(tree, "director-primary-role-Direttore sportivo"),
    ).toBe(true);
    expect(queryTestID(tree, "director-primary-role-Team manager")).toBe(false);
  });

  it("azzera il ruolo principale quando viene deselezionato (§AX)", () => {
    const onRolesChange = vi.fn();
    const tree = renderRoles({
      onRolesChange,
      primaryRole: "Presidente",
      selectedRoles: ["Presidente", "Direttore sportivo"],
    });

    press(tree, "director-role-Presidente");

    expect(onRolesChange).toHaveBeenCalledWith(["Direttore sportivo"], "Direttore sportivo");
  });

  it("promuove automaticamente l'unico ruolo rimasto (§G)", () => {
    const onRolesChange = vi.fn();
    const tree = renderRoles({ onRolesChange, selectedRoles: [] });

    press(tree, "director-role-Direttore sportivo");

    expect(onRolesChange).toHaveBeenCalledWith(
      ["Direttore sportivo"],
      "Direttore sportivo",
    );
  });

  it("mostra il campo libero solo selezionando Altro (§H)", () => {
    expect(queryTestID(renderRoles(), "director-other-role")).toBe(false);
    expect(
      queryTestID(renderRoles({ selectedRoles: ["Altro"] }), "director-other-role"),
    ).toBe(true);
  });
});

describe("DirectorResponsibilitiesStep (§I–§J)", () => {
  it("presenta le aree come chip in selezione multipla", () => {
    const tree = render(
      <DirectorResponsibilitiesStep
        currentStep={5}
        isBusy={false}
        onBack={vi.fn()}
        onChange={vi.fn()}
        onContinue={vi.fn()}
        selectedValues={["Mercato calciatori"]}
        stepLabel="Responsabilità"
        totalSteps={10}
      />,
    );
    const rendered = texts(tree);

    expect(rendered).toContain("Aree di responsabilità");
    expect(rendered).toContain("Gestione rose e contratti");
    expect(rendered).toContain("Area legale");
    expect(rendered).toContain("Puoi selezionarne più di una.");
  });
});

describe("DirectorFocusStep (§L)", () => {
  it("offre tre card a scelta singola", () => {
    const onSelect = vi.fn();
    const tree = render(
      <DirectorFocusStep
        currentStep={6}
        isBusy={false}
        onBack={vi.fn()}
        onContinue={vi.fn()}
        onSelect={onSelect}
        selectedValue=""
        stepLabel="Focus"
        totalSteps={10}
      />,
    );

    const rendered = texts(tree);
    expect(rendered).toContain("Prima squadra");
    expect(rendered).toContain("Settore giovanile");
    expect(rendered).toContain("Entrambi");

    press(tree, "director-focus-Entrambi");
    expect(onSelect).toHaveBeenCalledWith("Entrambi");
  });
});

describe("DirectorAvailabilityStep (§M–§N)", () => {
  it("espone quattro categorie indipendenti", () => {
    const onChange = vi.fn();
    const tree = render(
      <DirectorAvailabilityStep
        currentStep={7}
        isBusy={false}
        onBack={vi.fn()}
        onChange={onChange}
        onContinue={vi.fn()}
        stepLabel="Disponibilità"
        totalSteps={10}
        values={{ clubs: true, others: true, players: true, staff: true }}
      />,
    );

    const rendered = texts(tree);
    expect(rendered).toContain("Società e club");
    expect(rendered).toContain("Staff tecnico");
    expect(rendered).toContain("Giocatori");
    expect(rendered).toContain("Altre figure");
    expect(rendered).toContain("Presidenti, DS e staff");

    press(tree, "director-availability-players");
    expect(onChange).toHaveBeenCalledWith("players", false);
  });
});

describe("DirectorPreviousExperiencesStep (§Z–§AB)", () => {
  function renderStep(
    props: Partial<
      React.ComponentProps<typeof DirectorPreviousExperiencesStep>
    > = {},
  ) {
    return render(
      <DirectorPreviousExperiencesStep
        currentStep={9}
        isBusy={false}
        onBack={vi.fn()}
        onChange={vi.fn()}
        onContinue={vi.fn()}
        selection={[]}
        stepLabel="Esperienze"
        totalSteps={10}
        {...props}
      />,
    );
  }

  it("offre i sette ruoli precedenti usando Procuratore, non Agente (§AA)", () => {
    const rendered = texts(renderStep());

    for (const label of [
      "Calciatore",
      "Allenatore",
      "Staff tecnico",
      "Scout",
      "Procuratore",
      "Arbitro",
      "Altro",
    ]) {
      expect(rendered).toContain(label);
    }

    expect(rendered).not.toContain("Agente");
  });

  it("permette di proseguire senza selezioni (§AB)", () => {
    const onContinue = vi.fn();
    const tree = renderStep({ onContinue, selection: [] });

    press(tree, "director-previous-experiences-continue");

    expect(onContinue).toHaveBeenCalledTimes(1);
    // §AB: nessuna voce "Nessuna" da dover scegliere per avanzare.
    expect(texts(tree)).not.toContain("Nessuna esperienza precedente");
  });

  it("accumula più ruoli invece di sostituirli (§Z)", () => {
    const onChange = vi.fn();
    const tree = renderStep({ onChange, selection: ["player"] });

    press(tree, "director-previous-role-coach");

    expect(onChange).toHaveBeenCalledWith(["player", "coach"]);
  });
});

describe("DirectorPresentationStep (§AI–§AK)", () => {
  it("chiude con una sola CTA primaria e campi opzionali", () => {
    const onFinish = vi.fn();
    const tree = render(
      <DirectorPresentationStep
        bio=""
        currentStep={10}
        isBusy={false}
        languages={[]}
        onBack={vi.fn()}
        onBioChange={vi.fn()}
        onFinish={onFinish}
        onLanguagesChange={vi.fn()}
        stepLabel="Profilo"
        totalSteps={10}
      />,
    );

    const rendered = texts(tree);
    expect(rendered).toContain("Informazioni aggiuntive");
    expect(rendered).toContain("Bio professionale");
    expect(rendered).toContain("Lingue parlate");
    expect(rendered).toContain("Completa registrazione");
    // §AK: nessuna CTA "Salta" concorrente.
    expect(rendered).not.toContain("Salta");

    press(tree, "director-presentation-finish");
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
