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
    expect(normalizeSeasonLabelInput("99/00")).toBe("1999/2000");
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

  // §19: il campo lasciato vuoto non diventa 0, resta `null`.
  it("keeps empty statistics unknown instead of turning them into zero", () => {
    const [payload] = parsePlayerExperienceForms([
      {
        appearances: "",
        assists: "0",
        awards: "",
        category: "Promozione",
        clubId: null,
        clubName: "ASD Real Milano",
        goals: "",
        minutesPlayed: "",
        periodEndMonth: "",
        periodStartMonth: "",
        seasonLabel: "2024/2025",
        seasonPeriod: "full",
        teamCity: "",
        teamLogoUrl: "",
      },
    ]);

    expect(payload?.appearances).toBeNull();
    expect(payload?.goals).toBeNull();
    expect(payload?.assists).toBe(0);
  });

  it("parses reusable player experience forms into the centralized payload", () => {
    const result = parsePlayerExperienceForms([
      {
        appearances: "18",
        assists: "3",
        awards: "",
        careerType: "SINGLE_SEASON",
        category: "Promozione",
        clubId: "club-1",
        clubName: "ASD Real Milano",
        goals: "6",
        groupId: "group-1",
        id: "experience-1",
        minutesPlayed: "1440",
        periodEndMonth: "",
        periodStartMonth: "",
        seasonLabel: "2024/2025",
        seasonPeriod: "full",
        teamCity: "Milano",
        teamLogoUrl: "https://example.com/logo.png",
      },
    ]);

    expect(result).toEqual([
      {
        appearances: 18,
        assists: 3,
        awards: null,
        career_type: "SINGLE_SEASON",
        club_id: "club-1",
        club_name: "ASD Real Milano",
        competition_name: "Promozione",
        experience_group_id: "group-1",
        goals: 6,
        id: "experience-1",
        minutes_played: 1440,
        period_end_month: null,
        period_start_month: null,
        season_label: "2024/2025",
        season_period: "full",
        sort_order: 0,
        team_logo_url: "https://example.com/logo.png",
      },
    ]);
  });
});
