import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInitialProfile } from "./create-initial-profile";

const { fromMock, upsertMocks } = vi.hoisted(() => {
  const upsertMocks = {
    clubs: vi.fn(),
    coach_profiles: vi.fn(),
    player_profiles: vi.fn(),
    profiles: vi.fn(),
    staff_profiles: vi.fn(),
  };

  return {
    fromMock: vi.fn((table: keyof typeof upsertMocks) => ({
      upsert: upsertMocks[table],
    })),
    upsertMocks,
  };
});

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: fromMock,
  },
}));

describe("createInitialProfile", () => {
  beforeEach(() => {
    fromMock.mockClear();
    Object.values(upsertMocks).forEach((mock) => {
      mock.mockReset();
      mock.mockResolvedValue({ error: null });
    });
  });

  it("rejects empty full name before calling Supabase", async () => {
    await expect(
      createInitialProfile({
        clubCity: "",
        clubName: "",
        clubRegion: "",
        fullName: "   ",
        primaryPosition: "midfielder",
        role: "player",
        staffSpecialization: "fitness_coach",
        userId: "user-1",
      }),
    ).rejects.toThrow("Inserisci nome e cognome prima di continuare.");

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("creates a player profile with trimmed base profile data", async () => {
    await createInitialProfile({
      clubCity: "",
      clubName: "",
      clubRegion: "",
      fullName: "  Marco Rossi  ",
      primaryPosition: "forward",
      role: "player",
      staffSpecialization: "fitness_coach",
      userId: "user-2",
    });

    expect(upsertMocks.profiles).toHaveBeenCalledWith({
      full_name: "Marco Rossi",
      id: "user-2",
      role: "player",
    });
    expect(upsertMocks.player_profiles).toHaveBeenCalledWith({
      primary_position: "forward",
      profile_id: "user-2",
    });
    expect(upsertMocks.clubs).not.toHaveBeenCalled();
  });

  it("creates a club profile with an accent-safe slug", async () => {
    await createInitialProfile({
      clubCity: "  Città di Castello ",
      clubName: "  Città Élite Naïve FC ",
      clubRegion: " Umbria ",
      fullName: "Club Owner",
      primaryPosition: "midfielder",
      role: "club_admin",
      staffSpecialization: "fitness_coach",
      userId: "club-1",
    });

    expect(upsertMocks.clubs).toHaveBeenCalledWith({
      city: "Città di Castello",
      name: "Città Élite Naïve FC",
      owner_profile_id: "club-1",
      region: "Umbria",
      slug: "citta-elite-naive-fc",
    });
  });

  it("requires club identity fields for club admins", async () => {
    await expect(
      createInitialProfile({
        clubCity: " ",
        clubName: "Club",
        clubRegion: "",
        fullName: "Club Owner",
        primaryPosition: "midfielder",
        role: "club_admin",
        staffSpecialization: "fitness_coach",
        userId: "club-2",
      }),
    ).rejects.toThrow("Per una societa' servono nome, citta' e regione.");

    expect(upsertMocks.clubs).not.toHaveBeenCalled();
  });
});
