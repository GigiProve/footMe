import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { FanInterestsStep } from "./FanInterestsStep";

vi.mock("../../profiles/player-sports-section", () => ({
  TeamAutocompleteInput: (props: Record<string, unknown>) =>
    React.createElement("MockTeamAutocompleteInput", props),
}));

describe("FanInterestsStep", () => {
  it("lets fans enter a free favorite team or select a linked club", () => {
    const onUpdate = vi.fn();
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <FanInterestsStep
          favoriteClubId={null}
          favoriteTeamName="AC Como"
          interestCategories={["Serie D"]}
          interestRegions={["Lombardia"]}
          onUpdate={onUpdate}
          searchTeams={vi.fn().mockResolvedValue([])}
          validationErrors={{}}
        />,
      );
    });

    const teamInput = tree.root.findByType("MockTeamAutocompleteInput" as never);

    expect(teamInput.props.value).toBe("AC Como");

    act(() => {
      teamInput.props.onChangeText("Como libera");
    });

    expect(onUpdate).toHaveBeenCalledWith({
      fanFavoriteClubId: null,
      fanFavoriteTeamName: "Como libera",
    });

    act(() => {
      teamInput.props.onSelectTeam({
        city: "Como",
        id: "club-1",
        name: "Como 1907",
        region: "Lombardia",
      });
    });

    expect(onUpdate).toHaveBeenCalledWith({
      fanFavoriteClubId: "club-1",
      fanFavoriteTeamName: "Como 1907",
    });
  });
});
