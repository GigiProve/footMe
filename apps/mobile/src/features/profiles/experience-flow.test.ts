import { describe, expect, it } from "vitest";

import {
  areAllBlocksValid,
  blocksToExperienceForms,
  createEmptySeasonDetail,
  getBlockConflicts,
  getUsedSeasonsMap,
  type ExperienceBlockData,
} from "./experience-flow";

describe("experience-flow", () => {
  it("allows consecutive seasons with the same team and different categories", () => {
    const blocks: ExperienceBlockData[] = [
      {
        localId: "block-1",
        teamId: "club-1",
        teamName: "ASD Real Milano",
        teamCity: "Milano",
        teamLogoUrl: "",
        startYear: "2023",
        startMonth: "7",
        endYear: "2024",
        endMonth: "6",
        isOngoing: false,
        isTeamLocked: false,
        seasonDetails: [
          {
            ...createEmptySeasonDetail("2023/2024"),
            category: "Juniores",
          },
        ],
      },
      {
        localId: "block-2",
        teamId: "club-1",
        teamName: "ASD Real Milano",
        teamCity: "Milano",
        teamLogoUrl: "",
        startYear: "2024",
        startMonth: "7",
        endYear: "2025",
        endMonth: "6",
        isOngoing: false,
        isTeamLocked: true,
        seasonDetails: [
          {
            ...createEmptySeasonDetail("2024/2025"),
            category: "Promozione",
          },
        ],
      },
    ];

    const firstConflicts = getBlockConflicts(
      blocks[0],
      getUsedSeasonsMap(blocks, blocks[0].localId),
    );
    const secondConflicts = getBlockConflicts(
      blocks[1],
      getUsedSeasonsMap(blocks, blocks[1].localId),
    );

    expect(firstConflicts.size).toBe(0);
    expect(secondConflicts.size).toBe(0);
    expect(areAllBlocksValid(blocks)).toBe(true);

    expect(blocksToExperienceForms(blocks)).toEqual([
      expect.objectContaining({
        category: "Juniores",
        clubId: "club-1",
        clubName: "ASD Real Milano",
        seasonLabel: "2023/2024",
      }),
      expect.objectContaining({
        category: "Promozione",
        clubId: "club-1",
        clubName: "ASD Real Milano",
        seasonLabel: "2024/2025",
      }),
    ]);
  });
});
