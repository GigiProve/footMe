import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { CareerExperienceStep } from "./CareerExperienceStep";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

vi.mock("../../../components/ui/select-field", () => ({
  SelectField: (props: Record<string, unknown>) =>
    React.createElement("MockSelectField", props),
}));

vi.mock("../../../components/ui/wheel-picker", () => ({
  WheelPicker: (props: Record<string, unknown>) =>
    React.createElement("MockWheelPicker", props),
}));

vi.mock("../../profiles/player-sports-section", () => ({
  TeamAutocompleteInput: (props: Record<string, unknown>) =>
    React.createElement("MockTeamAutocompleteInput", props),
}));

describe("CareerExperienceStep", () => {
  it("shows type selector when add button is pressed", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <CareerExperienceStep
          careerEntries={[]}
          isBusy={false}
          onSaveAndContinue={vi.fn()}
          onSkip={vi.fn()}
          onUpdateEntries={vi.fn()}
          searchTeams={vi.fn().mockResolvedValue([])}
        />,
      );
    });

    // Find the add button by label
    const addButton = tree!.root.findByProps({ label: "Aggiungi esperienza" });

    act(() => {
      addButton.props.onPress();
    });

    // Should now show the PlayerExperienceTypeSelector
    // There should be at least 3 pressable type option buttons
    const optionButtons = tree!.root.findAllByProps({ accessibilityRole: "button" });
    expect(optionButtons.length).toBeGreaterThanOrEqual(3);
  });

  it("navigates to form after type is selected", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <CareerExperienceStep
          careerEntries={[]}
          isBusy={false}
          onSaveAndContinue={vi.fn()}
          onSkip={vi.fn()}
          onUpdateEntries={vi.fn()}
          searchTeams={vi.fn().mockResolvedValue([])}
        />,
      );
    });

    // Navigate to type selector
    const addButton = tree!.root.findByProps({ label: "Aggiungi esperienza" });
    act(() => {
      addButton.props.onPress();
    });

    // Select MULTI_SEASON (first pressable option card in the selector)
    const optionButtons = tree!.root.findAllByProps({ accessibilityRole: "button" });
    act(() => {
      optionButtons[0].props.onPress();
    });

    // Should now show the form — TeamAutocompleteInput is rendered in the form
    const teamInput = tree!.root.findByType("MockTeamAutocompleteInput" as never);
    expect(teamInput).toBeTruthy();
  });
});
