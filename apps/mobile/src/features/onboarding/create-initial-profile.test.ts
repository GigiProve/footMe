import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInitialProfile } from "./create-initial-profile";
import { DEFAULT_PROFILE_AVATAR_URI } from "../profiles/profile-avatar";

const { fromMock, upsertMocks } = vi.hoisted(() => {
  const upsertMocks = {
    clubs: vi.fn(),
    coach_profiles: vi.fn(),
    player_profiles: vi.fn(),
    profile_private_contacts: vi.fn(),
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
        avatarUrl: "https://example.com/avatar.jpg",
        birthDate: "1998-05-12",
        clubCity: "",
        clubName: "",
        clubRegion: "",
        domicile: "Perugia",
        fullName: "   ",
        gender: "male",
        nationality: "IT",
        phoneNumber: "",
        primaryPosition: "midfielder",
        residence: "Perugia",
        role: "player",
        staffSpecialization: "fitness_coach",
        userId: "user-1",
      }),
    ).rejects.toThrow("Inserisci nome e cognome prima di continuare.");

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("creates a player profile with trimmed base profile data", async () => {
    await createInitialProfile({
      avatarUrl: " https://example.com/avatar.jpg ",
      birthDate: "1998-05-12",
      clubCity: "",
      clubName: "",
      clubRegion: "",
      domicile: "  Assisi ",
      fullName: "  Marco Rossi  ",
      gender: "male",
      nationality: " IT ",
      phoneNumber: " +39 333 1234567 ",
      primaryPosition: "forward",
      residence: "  Perugia ",
      role: "player",
      staffSpecialization: "fitness_coach",
      userId: "user-2",
    });

    expect(upsertMocks.profiles).toHaveBeenCalledWith({
      avatar_url: "https://example.com/avatar.jpg",
      birth_date: "1998-05-12",
      domicile: "Assisi",
      full_name: "Marco Rossi",
      gender: "male",
      id: "user-2",
      nationality: "IT",
      phone_number: null,
      residence: "Perugia",
      role: "player",
    });
    expect(upsertMocks.profile_private_contacts).toHaveBeenCalledWith({
      phone: "+39 333 1234567",
      profile_id: "user-2",
    });
    expect(upsertMocks.player_profiles).toHaveBeenCalledWith({
      primary_position: "forward",
      profile_id: "user-2",
    });
    expect(upsertMocks.clubs).not.toHaveBeenCalled();
  });

  it("creates a club profile with an accent-safe slug", async () => {
    await createInitialProfile({
      avatarUrl: "https://example.com/avatar.jpg",
      birthDate: "1988-03-17",
      clubCity: "  Città di Castello ",
      clubName: "  Città Élite Naïve FC ",
      clubRegion: " Umbria ",
      domicile: "Città di Castello",
      fullName: "Club Owner",
      gender: "female",
      nationality: "IT",
      phoneNumber: "",
      primaryPosition: "midfielder",
      residence: "Città di Castello",
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
        avatarUrl: "https://example.com/avatar.jpg",
        birthDate: "1988-03-17",
        clubCity: " ",
        clubName: "Club",
        clubRegion: "",
        domicile: "Roma",
        fullName: "Club Owner",
        gender: "male",
        nationality: "IT",
        phoneNumber: "",
        primaryPosition: "midfielder",
        residence: "Roma",
        role: "club_admin",
        staffSpecialization: "fitness_coach",
        userId: "club-2",
      }),
    ).rejects.toThrow("Per una societa' servono nome, citta' e regione.");

    expect(upsertMocks.clubs).not.toHaveBeenCalled();
  });

  it("requires the mandatory base onboarding fields", async () => {
    await expect(
      createInitialProfile({
        avatarUrl: " ",
        birthDate: "",
        clubCity: "",
        clubName: "",
        clubRegion: "",
        domicile: "",
        fullName: "Player Example",
        gender: "male",
        nationality: "",
        phoneNumber: "",
        primaryPosition: "midfielder",
        residence: "",
        role: "player",
        staffSpecialization: "fitness_coach",
        userId: "user-3",
      }),
    ).rejects.toThrow(
      "Completa sesso, data di nascita, nazionalita', residenza e domicilio.",
    );

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("uses the blank default avatar when no profile image is uploaded", async () => {
    await createInitialProfile({
      avatarUrl: " ",
      birthDate: "1998-05-12",
      clubCity: "",
      clubName: "",
      clubRegion: "",
      domicile: "Assisi",
      fullName: "Marco Rossi",
      gender: "male",
      nationality: "IT",
      phoneNumber: "",
      primaryPosition: "forward",
      residence: "Perugia",
      role: "player",
      staffSpecialization: "fitness_coach",
      userId: "user-4",
    });

    expect(upsertMocks.profiles).toHaveBeenCalledWith(
      expect.objectContaining({
        avatar_url: DEFAULT_PROFILE_AVATAR_URI,
      }),
    );
  });
});
