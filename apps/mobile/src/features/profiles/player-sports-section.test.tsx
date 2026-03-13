import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import {
  ExperienceCard,
  PlayerExperiencesSection,
  TeamAutocompleteInput,
} from "./player-sports-section";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

describe("player-sports-section", () => {
  it("shows team suggestions and the create-new-team action", async () => {
    vi.useFakeTimers();
    const searchTeams = vi.fn().mockResolvedValue([
      {
        city: "Milano",
        id: "club-1",
        logoUrl: "https://example.com/logo.png",
        name: "ASD Real Milano",
      },
    ]);
    const onSelectTeam = vi.fn();

    let tree: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(
        <TeamAutocompleteInput
          label="Squadra"
          onChangeText={() => undefined}
          onSelectTeam={onSelectTeam}
          searchTeams={searchTeams}
          value="Mil"
        />,
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      tree!.root.findByProps({ testID: "team-autocomplete-suggestion-ASD Real Milano" }),
    ).toBeTruthy();
    expect(tree!.root.findByProps({ testID: "team-autocomplete-create-option" })).toBeTruthy();

    await act(async () => {
      tree!.root.findByProps({ testID: "team-autocomplete-suggestion-ASD Real Milano" }).props.onPress();
    });

    expect(onSelectTeam).toHaveBeenCalledWith({
      city: "Milano",
      id: "club-1",
      logoUrl: "https://example.com/logo.png",
      name: "ASD Real Milano",
    });

    vi.useRealTimers();
  });

  it("renders the automatic experience badges", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <ExperienceCard
          experience={{
            appearances: "30",
            assists: "5",
            awards: "",
            category: "Promozione",
            clubId: "club-1",
            clubName: "ASD Real Milano",
            goals: "10",
            minutesPlayed: "1800",
            seasonLabel: "2024/2025",
            teamCity: "Milano",
            teamLogoUrl: "",
          }}
        />,
      );
    });

    expect(tree!.root.findByProps({ children: "⚽ 10+ gol stagione" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "⭐ Stagione completa" })).toBeTruthy();
  });

  it("keeps the timeline ordered and supports deletion in edit mode", () => {
    const onChange = vi.fn();

    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <PlayerExperiencesSection
          editable
          experiences={[
            {
              appearances: "8",
              assists: "1",
              awards: "",
              category: "Promozione",
              clubId: null,
              clubName: "Club 2022",
              goals: "2",
              minutesPlayed: "600",
              seasonLabel: "2022/2023",
              teamCity: "",
              teamLogoUrl: "",
            },
            {
              appearances: "18",
              assists: "3",
              awards: "",
              category: "Eccellenza",
              clubId: null,
              clubName: "Club 2024",
              goals: "6",
              minutesPlayed: "1440",
              seasonLabel: "2024/2025",
              teamCity: "",
              teamLogoUrl: "",
            },
          ]}
          onChange={onChange}
          searchTeams={vi.fn().mockResolvedValue([])}
        />,
      );
    });

    const teamNameNodes = tree!.root.findAllByType("Text" as never);
    expect(teamNameNodes.some((node) => node.props.children === "Club 2024")).toBe(true);

    const deleteButtons = tree!.root.findAllByProps({ accessibilityLabel: "Elimina" });

    act(() => {
      deleteButtons[0].props.onPress();
    });

    expect(onChange).toHaveBeenCalledWith([
      {
        appearances: "8",
        assists: "1",
        awards: "",
        category: "Promozione",
        clubId: null,
        clubName: "Club 2022",
        goals: "2",
        minutesPlayed: "600",
        seasonLabel: "2022/2023",
        teamCity: "",
        teamLogoUrl: "",
      },
    ]);
  });
});
