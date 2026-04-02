import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { CareerExperienceStep } from "./CareerExperienceStep";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

vi.mock("../../profiles/experience-flow-section", () => ({
  ExperienceFlowScreen: (props: Record<string, unknown>) =>
    React.createElement("MockExperienceFlowScreen", props),
}));

describe("CareerExperienceStep", () => {
  it("uses the shared add-experience flow and appends saved entries", () => {
    const onUpdateEntries = vi.fn();

    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <CareerExperienceStep
          careerEntries={[]}
          isBusy={false}
          onSaveAndContinue={vi.fn()}
          onSkip={vi.fn()}
          onUpdateEntries={onUpdateEntries}
          searchTeams={vi.fn().mockResolvedValue([])}
        />,
      );
    });

    const addButton = tree!.root.findByProps({
      accessibilityLabel: "Aggiungi esperienza",
    });

    act(() => {
      addButton.props.onPress();
    });

    const flow = tree!.root.findByType("MockExperienceFlowScreen" as never);
    expect(flow.props.visible).toBe(true);

    act(() => {
      flow.props.onSave([
        {
          appearances: "20",
          assists: "4",
          awards: "",
          category: "Juniores",
          clubId: "club-1",
          clubName: "ASD Real Milano",
          goals: "8",
          minutesPlayed: "1600",
          periodEndMonth: "",
          periodStartMonth: "",
          seasonLabel: "2023/2024",
          seasonPeriod: "full",
          teamCity: "Milano",
          teamLogoUrl: "",
        },
        {
          appearances: "18",
          assists: "3",
          awards: "",
          category: "Promozione",
          clubId: "club-1",
          clubName: "ASD Real Milano",
          goals: "5",
          minutesPlayed: "1440",
          periodEndMonth: "",
          periodStartMonth: "",
          seasonLabel: "2024/2025",
          seasonPeriod: "full",
          teamCity: "Milano",
          teamLogoUrl: "",
        },
      ]);
    });

    expect(onUpdateEntries).toHaveBeenCalledWith([
      {
        appearances: "20",
        assists: "4",
        awards: "",
        category: "Juniores",
        clubId: "club-1",
        clubName: "ASD Real Milano",
        goals: "8",
        minutesPlayed: "1600",
        periodEndMonth: "",
        periodStartMonth: "",
        seasonLabel: "2023/2024",
        seasonPeriod: "full",
        teamCity: "Milano",
        teamLogoUrl: "",
      },
      {
        appearances: "18",
        assists: "3",
        awards: "",
        category: "Promozione",
        clubId: "club-1",
        clubName: "ASD Real Milano",
        goals: "5",
        minutesPlayed: "1440",
        periodEndMonth: "",
        periodStartMonth: "",
        seasonLabel: "2024/2025",
        seasonPeriod: "full",
        teamCity: "Milano",
        teamLogoUrl: "",
      },
    ]);

    expect(
      tree!.root.findByType("MockExperienceFlowScreen" as never).props.visible,
    ).toBe(false);
  });
});
