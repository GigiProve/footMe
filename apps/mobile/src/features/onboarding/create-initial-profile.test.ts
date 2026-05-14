import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInitialProfile, validateBaseProfileStep } from "./create-initial-profile";
import type { StaffRole } from "./onboarding-types";

const { fromMock, upsertMocks } = vi.hoisted(() => {
  const upsertMocks = {
    agent_profiles: vi.fn(),
    club_teams: vi.fn(),
    clubs: vi.fn(),
    coach_profiles: vi.fn(),
    fan_profiles: vi.fn(),
    media_profiles: vi.fn(),
    player_profiles: vi.fn(),
    profile_contacts: vi.fn(),
    profile_private_contacts: vi.fn(),
    profiles: vi.fn(),
    staff_profiles: vi.fn(),
  };

  const clubsChain = {
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data: { id: "club-uuid-1" }, error: null }),
    })),
  };

  const clubTeamsInsertChain = {
    error: null,
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data: { id: "senior-team-uuid-1" }, error: null }),
    })),
  };

  return {
    clubTeamsInsertChain,
    clubsChain,
    fromMock: vi.fn((table: string) => {
      if (table === "clubs") {
        return {
          upsert: vi.fn((...args: unknown[]) => {
            upsertMocks.clubs(...args);
            return clubsChain;
          }),
        };
      }
      if (table === "club_teams") {
        return {
          insert: vi.fn((...args: unknown[]) => {
            upsertMocks.club_teams(...args);
            return clubTeamsInsertChain;
          }),
          upsert: vi.fn((...args: unknown[]) => {
            upsertMocks.club_teams(...args);
            return clubTeamsInsertChain;
          }),
        };
      }
      const mock = upsertMocks[table as keyof typeof upsertMocks];
      return mock ? { upsert: mock } : { upsert: vi.fn().mockResolvedValue({ error: null }) };
    }),
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

  const defaultClubFields = {
    authEmail: "test@example.com",
    clubCategory: "",
    clubColors: "",
    clubCountry: "IT",
    clubDescription: "",
    clubEmail: "",
    clubFacebook: "",
    clubFieldAddress: "",
    clubFoundingYear: "",
    clubHasYouthSector: false,
    clubHeadquartersAddress: "",
    clubInstagram: "",
    clubLogoUrl: "",
    clubName: "",
    clubPhone: "",
    clubRegion: "",
    clubStadium: "",
    clubTotalMembers: "",
    clubWebsite: "",
    clubYouthCategories: [] as string[],

    currentLocationCity: "",
    currentLocationCountry: "",
    legalStatus: "",
    repEmail: "",
    repPhone: "",
    residenceCountry: "",
    staffAvailableFrom: "",
    staffPrimaryRole: "",
    staffRoles: [] as StaffRole[],
  };

  it("rejects empty full name before calling Supabase", async () => {
    await expect(
      createInitialProfile({
        ...defaultClubFields,
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
      ...defaultClubFields,
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
      current_location_city: null,
      current_location_country: null,
      domicile: "Assisi",
      full_name: "Marco Rossi",
      gender: "male",
      id: "user-2",
      legal_status: null,
      nationality: "IT",
      phone_number: null,
      residence: "Perugia",
      residence_country: null,
      role: "player",
    });
    expect(upsertMocks.profile_private_contacts).toHaveBeenCalledWith({
      phone: "+393331234567",
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
      ...defaultClubFields,
      avatarUrl: "https://example.com/avatar.jpg",
      birthDate: "1988-03-17",
      clubCity: "  Città di Castello ",
      clubEmail: "info@elite.it",
      clubName: "  Città Élite Naïve FC ",
      clubRegion: " Umbria ",
      domicile: "Città di Castello",
      fullName: "Club Owner",
      gender: "female",
      nationality: "IT",
      phoneNumber: "",
      primaryPosition: "midfielder",
      repEmail: "owner@elite.it",
      repPhone: "",
      residence: "Città di Castello",
      role: "club_admin",
      staffSpecialization: "fitness_coach",
      userId: "club-1",
    });

    expect(upsertMocks.clubs).toHaveBeenCalledWith(
      expect.objectContaining({
        category: null,
        city: "Città di Castello",
        club_colors: null,
        club_email: "info@elite.it",
        club_phone: null,
        country: "IT",
        name: "Città Élite Naïve FC",
        owner_profile_id: "club-1",
        region: "Umbria",
        representative_email: "owner@elite.it",
        slug: "citta-elite-naive-fc",
        verification_status: "pending_review",
        website_url: null,
      }),
      { onConflict: "owner_profile_id" },
    );
  });

  it("requires the mandatory base onboarding fields", async () => {
    await expect(
      createInitialProfile({
        ...defaultClubFields,
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
    ).rejects.toThrow("Completa i campi obbligatori: data di nascita.");

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("reports the exact required fields that are missing", () => {
    expect(() =>
      validateBaseProfileStep({
        ...defaultClubFields,
        avatarUrl: "",
        birthDate: "",
        clubCity: "",
        clubName: "",
        clubRegion: "",
        domicile: " ",
        fullName: "Marco Rossi",
        gender: "male",
        nationality: "",
        phoneNumber: "",
        primaryPosition: "forward",
        residence: "",
        role: "player",
        staffSpecialization: "fitness_coach",
        userId: "user-5",
      }),
    ).toThrow("Completa i campi obbligatori: data di nascita.");
  });

  it("persists multi-role staff metadata on staff profile creation", async () => {
    await createInitialProfile({
      ...defaultClubFields,
      avatarUrl: "",
      birthDate: "1992-04-21",
      clubCity: "",
      clubName: "",
      clubRegion: "",
      domicile: "Milano",
      fullName: "Luca Bianchi",
      gender: "male",
      nationality: "IT",
      phoneNumber: "",
      primaryPosition: "midfielder",
      residence: "Milano",
      role: "staff",
      staffPrimaryRole: "Match analyst",
      staffRoles: ["Match analyst", "Collaboratore tecnico"],
      staffSpecialization: "match_analyst",
      userId: "staff-1",
    });

    expect(upsertMocks.staff_profiles).toHaveBeenCalledWith({
      available_from: null,
      primary_staff_role: "Match analyst",
      profile_id: "staff-1",
      specialization: "match_analyst",
      staff_roles: ["Match analyst", "Collaboratore tecnico"],
    });
  });

  it("allows optional nationality and residence fields to stay empty", () => {
    expect(
      validateBaseProfileStep({
        ...defaultClubFields,
        avatarUrl: "",
        birthDate: "1998-05-12",
        clubCity: "",
        clubName: "",
        clubRegion: "",
        domicile: "",
        fullName: "Marco Rossi",
        gender: "male",
        nationality: "",
        phoneNumber: "",
        primaryPosition: "forward",
        residence: "",
        role: "player",
        staffSpecialization: "fitness_coach",
        userId: "user-6",
      }),
    ).toMatchObject({
      birthDate: "1998-05-12",
      currentLocationCity: null,
      currentLocationCountry: null,
      domicile: null,
      legalStatus: null,
      nationality: null,
      residence: null,
      residenceCountry: null,
    });
  });

  it("creates agent profiles with the dedicated agent table", async () => {
    await createInitialProfile({
      ...defaultClubFields,
      avatarUrl: "",
      birthDate: "1990-01-01",
      clubCity: "",
      clubName: "",
      clubRegion: "",
      domicile: "",
      fullName: "Agent Example",
      gender: "female",
      nationality: "IT",
      phoneNumber: "+39 3331234567",
      primaryPosition: "midfielder",
      residence: "Roma",
      role: "agent",
      staffSpecialization: "fitness_coach",
      userId: "agent-1",
    });

    expect(upsertMocks.profiles).toHaveBeenCalledWith(
      expect.objectContaining({
        current_location_city: null,
        current_location_country: null,
        legal_status: null,
        role: "agent",
        residence_country: null,
      }),
    );
    expect(upsertMocks.agent_profiles).toHaveBeenCalledWith({
      profile_id: "agent-1",
    });
    expect(upsertMocks.player_profiles).not.toHaveBeenCalled();
    expect(upsertMocks.coach_profiles).not.toHaveBeenCalled();
    expect(upsertMocks.staff_profiles).not.toHaveBeenCalled();
    expect(upsertMocks.clubs).not.toHaveBeenCalled();
  });

  it("creates fan and media profiles in their dedicated tables", async () => {
    await createInitialProfile({
      ...defaultClubFields,
      avatarUrl: "",
      birthDate: "1996-01-01",
      clubCity: "",
      clubName: "",
      clubRegion: "",
      domicile: "",
      fullName: "Fan Example",
      gender: "" as never,
      nationality: "",
      phoneNumber: "",
      primaryPosition: "midfielder",
      residence: "",
      role: "fan",
      staffSpecialization: "fitness_coach",
      userId: "fan-1",
    });

    await createInitialProfile({
      ...defaultClubFields,
      avatarUrl: "",
      birthDate: "1994-01-01",
      clubCity: "",
      clubName: "",
      clubRegion: "",
      domicile: "",
      fullName: "Media Example",
      gender: "" as never,
      nationality: "",
      phoneNumber: "",
      primaryPosition: "midfielder",
      residence: "",
      role: "media",
      staffSpecialization: "fitness_coach",
      userId: "media-1",
    });

    expect(upsertMocks.fan_profiles).toHaveBeenCalledWith({
      profile_id: "fan-1",
    });
    expect(upsertMocks.media_profiles).toHaveBeenCalledWith({
      profile_id: "media-1",
    });
  });

  it("saves a null avatar when no profile image is uploaded", async () => {
    await createInitialProfile({
      ...defaultClubFields,
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
        avatar_url: null,
      }),
    );
  });

  it("persists international residence and legal-status fields when provided", async () => {
    await createInitialProfile({
      ...defaultClubFields,
      avatarUrl: "",
      birthDate: "1998-05-12",
      clubCity: "",
      clubName: "",
      clubRegion: "",
      currentLocationCity: "Bruxelles",
      currentLocationCountry: "BE",
      domicile: "",
      fullName: "Marco Rossi",
      gender: "male",
      legalStatus: "pending_permit",
      nationality: "BR",
      phoneNumber: "",
      primaryPosition: "forward",
      residence: "",
      residenceCountry: "IT",
      role: "player",
      staffSpecialization: "fitness_coach",
      userId: "user-7",
    });

    expect(upsertMocks.profiles).toHaveBeenCalledWith(
      expect.objectContaining({
        current_location_city: "Bruxelles",
        current_location_country: "BE",
        legal_status: "pending_permit",
        residence_country: "IT",
      }),
    );
  });
});
