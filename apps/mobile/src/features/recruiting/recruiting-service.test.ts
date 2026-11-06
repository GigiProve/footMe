import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyToRecruitingAd,
  getOwnedClub,
  toggleSavedAd,
  updateApplicationStatus,
} from "./recruiting-service";

const mocks = vi.hoisted(() => {
  const clubMaybeSingleMock = vi.fn();
  const deleteFinalEqMock = vi.fn();
  const deleteFirstEqMock = vi.fn();
  const playerProfileMaybeSingleMock = vi.fn();
  const recruitingApplicationInsertMock = vi.fn();
  const recruitingApplicationUpdateEqMock = vi.fn();
  const savedAdsUpsertMock = vi.fn();
  const recruitingAdMaybeSingleMock = vi.fn();
  const profileMaybeSingleMock = vi.fn();
  const notificationsInsertMock = vi.fn();
  const rpcMock = vi.fn();

  const deleteChain = {
    eq: deleteFinalEqMock,
  };

  return {
    clubMaybeSingleMock,
    deleteChain,
    rpcMock,
    deleteFinalEqMock,
    deleteFirstEqMock,
    fromMock: vi.fn((table: string) => {
      if (table === "clubs") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: clubMaybeSingleMock,
            })),
          })),
        };
      }

      if (table === "saved_ads") {
        return {
          delete: vi.fn(() => ({
            eq: deleteFirstEqMock,
          })),
          upsert: savedAdsUpsertMock,
        };
      }

      if (table === "player_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: playerProfileMaybeSingleMock,
            })),
          })),
        };
      }

      if (table === "recruiting_applications") {
        return {
          insert: recruitingApplicationInsertMock,
          update: vi.fn(() => ({
            eq: recruitingApplicationUpdateEqMock,
          })),
        };
      }

      if (table === "recruiting_ads") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: recruitingAdMaybeSingleMock,
            })),
          })),
        };
      }

      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: profileMaybeSingleMock,
            })),
          })),
        };
      }

      if (table === "notifications") {
        return {
          insert: notificationsInsertMock,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    notificationsInsertMock,
    playerProfileMaybeSingleMock,
    profileMaybeSingleMock,
    recruitingAdMaybeSingleMock,
    recruitingApplicationInsertMock,
    recruitingApplicationUpdateEqMock,
    savedAdsUpsertMock,
  };
});

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: mocks.fromMock,
    rpc: mocks.rpcMock,
  },
}));

describe("recruiting-service", () => {
  beforeEach(() => {
    mocks.fromMock.mockClear();
    mocks.clubMaybeSingleMock.mockReset();
    mocks.clubMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    mocks.savedAdsUpsertMock.mockReset();
    mocks.savedAdsUpsertMock.mockResolvedValue({ error: null });
    mocks.deleteFirstEqMock.mockReset();
    mocks.deleteFinalEqMock.mockReset();
    mocks.deleteFirstEqMock.mockImplementation(() => mocks.deleteChain);
    mocks.deleteFinalEqMock.mockResolvedValue({ error: null });
    mocks.playerProfileMaybeSingleMock.mockReset();
    mocks.playerProfileMaybeSingleMock.mockResolvedValue({
      data: { profile_id: "player-1" },
      error: null,
    });
    mocks.rpcMock.mockReset();
    mocks.rpcMock.mockResolvedValue({
      data: [{ application_id: "app-1", replayed: false, status: "submitted" }],
      error: null,
    });
    mocks.recruitingApplicationInsertMock.mockReset();
    mocks.recruitingApplicationInsertMock.mockResolvedValue({ error: null });
    mocks.recruitingAdMaybeSingleMock.mockReset();
    mocks.recruitingAdMaybeSingleMock.mockResolvedValue({
      data: {
        club_id: "club-1",
        clubs: { owner_profile_id: "club-owner-1" },
        title: "Cercasi attaccante",
      },
      error: null,
    });
    mocks.profileMaybeSingleMock.mockReset();
    mocks.profileMaybeSingleMock.mockResolvedValue({
      data: { full_name: "Mario Rossi" },
      error: null,
    });
    mocks.notificationsInsertMock.mockReset();
    mocks.notificationsInsertMock.mockResolvedValue({ error: null });
    mocks.recruitingApplicationUpdateEqMock.mockReset();
    mocks.recruitingApplicationUpdateEqMock.mockResolvedValue({ error: null });
  });

  it("returns the owned club when present", async () => {
    const club = {
      category: "Juniores",
      city: "Perugia",
      id: "club-1",
      name: "AC ProLink",
      region: "Umbria",
    };
    mocks.clubMaybeSingleMock.mockResolvedValueOnce({ data: club, error: null });

    await expect(getOwnedClub("profile-1")).resolves.toEqual(club);
  });

  it("saves an ad with the expected conflict target", async () => {
    await toggleSavedAd("profile-2", "ad-4", true);

    expect(mocks.savedAdsUpsertMock).toHaveBeenCalledWith(
      {
        ad_id: "ad-4",
        profile_id: "profile-2",
      },
      { onConflict: "ad_id,profile_id" },
    );
  });

  it("removes a saved ad by ad and profile id", async () => {
    await toggleSavedAd("profile-3", "ad-7", false);

    expect(mocks.deleteFirstEqMock).toHaveBeenCalledWith("ad_id", "ad-7");
    expect(mocks.deleteFinalEqMock).toHaveBeenCalledWith(
      "profile_id",
      "profile-3",
    );
  });

  /**
   * DAS-REV-18 §17: la candidatura passa dalla RPC transazionale, non da un
   * insert diretto. L'eligibility, il lifecycle e il cutoff li decide il
   * server **sotto lock**, non il client prima di scrivere: qui si verifica
   * che il client non riprenda a decidere per conto suo.
   */
  it("non precalcola l'eligibility: la decide il server", async () => {
    mocks.rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "PostgREST: POSITION_APPLICANT_NOT_ELIGIBLE" },
    });

    await expect(
      applyToRecruitingAd("profile-4", "ad-8", "Disponibile subito"),
    ).rejects.toThrow(
      "La candidatura è disponibile solo per profili calciatore completati.",
    );

    expect(mocks.recruitingApplicationInsertMock).not.toHaveBeenCalled();
  });

  it("traduce i motivi di dominio in frasi distinte", async () => {
    /* §32: una ricerca chiusa e un termine scaduto non sono la stessa cosa
       per chi legge, e il server li distingue proprio per questo. */
    for (const [code, message] of [
      ["POSITION_CLOSED", "Questa posizione non accetta più candidature."],
      ["POSITION_DEADLINE_PASSED", "Il termine per candidarsi è scaduto."],
    ] as const) {
      mocks.rpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: `PostgREST: ${code}` },
      });

      await expect(
        applyToRecruitingAd("profile-4", "ad-8", ""),
      ).rejects.toThrow(message);
    }
  });

  it("invia la candidatura con il messaggio ripulito", async () => {
    mocks.rpcMock.mockResolvedValueOnce({
      data: [{ application_id: "app-1", replayed: false, status: "submitted" }],
      error: null,
    });

    await applyToRecruitingAd("profile-5", "ad-9", "  Pronto a mettermi in gioco ");

    expect(mocks.rpcMock).toHaveBeenCalledWith("apply_to_position", {
      p_ad_id: "ad-9",
      p_cover_message: "Pronto a mettermi in gioco",
    });
    expect(mocks.recruitingApplicationInsertMock).not.toHaveBeenCalled();
  });

  it("un replay non produce una seconda notifica al club", async () => {
    /* §17: «Retry idempotente di un invio già committato restituisce
       l'esito originale.» Un esito recuperato non è un nuovo invio. */
    mocks.rpcMock.mockResolvedValueOnce({
      data: [{ application_id: "app-1", replayed: true, status: "submitted" }],
      error: null,
    });

    await applyToRecruitingAd("profile-5", "ad-9", "Pronto");

    expect(mocks.notificationsInsertMock).not.toHaveBeenCalled();
  });

  it("notifies the club owner when a new application is submitted", async () => {
    await applyToRecruitingAd("profile-5", "ad-9", "Pronto");

    expect(mocks.notificationsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient_profile_id: "club-owner-1",
        type: "application_received",
      }),
    );
  });

  it("updates an application status and notifies the applicant", async () => {
    await updateApplicationStatus({
      adTitle: "Cercasi attaccante",
      applicantProfileId: "applicant-1",
      applicationId: "app-1",
      status: "accepted",
    });

    expect(mocks.recruitingApplicationUpdateEqMock).toHaveBeenCalledWith(
      "id",
      "app-1",
    );
    expect(mocks.notificationsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient_profile_id: "applicant-1",
        type: "application_status",
      }),
    );
  });
});
