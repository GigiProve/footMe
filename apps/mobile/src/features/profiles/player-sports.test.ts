import { describe, expect, it } from "vitest";

import {
  getLatestPlayerExperience,
  getPlayerExperienceBadges,
  normalizeSeasonLabelInput,
  parsePlayerExperienceForms,
  sortPlayerExperiencesBySeason,
  toPlayerExperienceForm,
} from "./player-sports";

describe("player-sports", () => {
  it("normalizes legacy season labels to the extended format", () => {
    expect(normalizeSeasonLabelInput("24/25")).toBe("2024/2025");
    expect(normalizeSeasonLabelInput("2024/25")).toBe("2024/2025");
    expect(normalizeSeasonLabelInput("2024/2025")).toBe("2024/2025");
  });

  it("sorts experiences from the most recent season to the oldest", () => {
    const entries = sortPlayerExperiencesBySeason([
      {
        ...toPlayerExperienceForm({
          appearances: 10,
          assists: 2,
          club_name: "Club 2022",
          competition_name: "Promozione",
          goals: 1,
          minutes_played: 800,
          season_label: "2022/2023",
        }),
      },
      {
        ...toPlayerExperienceForm({
          appearances: 18,
          assists: 6,
          club_name: "Club 2024",
          competition_name: "Eccellenza",
          goals: 11,
          minutes_played: 1500,
          season_label: "2024/2025",
        }),
      },
    ]);

    expect(entries.map((entry) => entry.clubName)).toEqual(["Club 2024", "Club 2022"]);
    expect(getLatestPlayerExperience(entries)?.clubName).toBe("Club 2024");
  });

  it("builds automatic badges from season statistics", () => {
    expect(
      getPlayerExperienceBadges({
        appearances: "30",
        assists: "5",
        goals: "10",
      }),
    ).toEqual([
      "⚽ 10+ gol stagione",
      "🔥 20+ presenze",
      "🎯 5+ assist",
      "⭐ Stagione completa",
    ]);
  });

  it("parses reusable player experience forms into the centralized payload", () => {
    const result = parsePlayerExperienceForms([
      {
        appearances: "18",
        assists: "3",
        awards: "",
        category: "Promozione",
        clubId: "club-1",
        clubName: "ASD Real Milano",
        goals: "6",
        id: "experience-1",
        minutesPlayed: "1440",
        seasonLabel: "2024/2025",
        teamCity: "Milano",
        teamLogoUrl: "https://example.com/logo.png",
      },
    ]);

    expect(result).toEqual([
      {
        appearances: 18,
        assists: 3,
        awards: null,
        category: "Promozione",
        club_id: "club-1",
        club_name: "ASD Real Milano",
        goals: 6,
        id: "experience-1",
        minutes_played: 1440,
        season_label: "2024/2025",
        sort_order: 0,
        team_logo_url: "https://example.com/logo.png",
      },
    ]);
  });
});
