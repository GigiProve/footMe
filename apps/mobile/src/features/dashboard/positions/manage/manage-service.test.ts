/**
 * Contratto di trasporto del dettaglio gestionale (DAS-REV-17 §23, §35).
 *
 * Tre rischi che non si vedono a schermo:
 *
 *   * un conteggio protetto che arriva `0` invece che assente diventa «0
 *     candidature» per chi non ha il permesso di vederle (§5);
 *   * una patch dell'attiva che nomina un identificativo deve essere
 *     respinta **per intero**, e il client deve saperlo distinguere da un
 *     errore generico (§21);
 *   * un errore di autorizzazione e una risorsa inesistente devono
 *     produrre lo stesso esito, perché §23 vieta di rivelare l'esistenza
 *     di una Position altrui.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../../../../lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const { fetchPositionManageDetail, updatePublishedPosition } = await import(
  "./manage-service"
);
const { toComposeError } = await import("../compose/compose-service");

beforeEach(() => {
  rpc.mockReset();
});

function ok(data: unknown) {
  return Promise.resolve({ data, error: null });
}

function fail(message: string) {
  return Promise.resolve({ data: null, error: { message } });
}

const ROW = {
  access_verified_at: "2026-09-12T09:00:00Z",
  age_mode: "unset",
  blockers: [],
  can_close: false,
  can_edit: true,
  can_publish: true,
  club_id: "club-1",
  club_is_verified: true,
  club_name: "AC Como",
  context_label: "Settore giovanile",
  counts_available: false,
  details: { responsibilities: "Scouting del settore giovanile" },
  group_key: "drafts",
  has_details: true,
  position_id: "pos-a",
  position_scope: "team",
  profile_type: "director",
  resource_version: 4,
  role_id: "other_executive",
  role_is_custom: true,
  role_label: "Altro",
  custom_role_name: "Responsabile scouting",
  secondary_teams: [],
  status: "draft",
  team_id: "team-primavera",
  team_name: "Primavera",
  title: "Responsabile scouting",
};

describe("lettura gestionale (§5, §23)", () => {
  it("porta schema, versione e valutazione della bozza nello stesso payload", async () => {
    rpc.mockReturnValue(ok([ROW]));

    const detail = await fetchPositionManageDetail("pos-a");

    expect(rpc).toHaveBeenCalledWith("fetch_society_position_detail", {
      p_ad_id: "pos-a",
    });
    expect(detail.profileType).toBe("director");
    expect(detail.resourceVersion).toBe(4);
    expect(detail.lifecycle).toBe("draft");
    expect(detail.hasDetails).toBe(true);
    expect(detail.blockers).toEqual([]);
    expect(detail.details.responsibilities).toBe(
      "Scouting del settore giovanile",
    );
  });

  it("un conteggio non autorizzato resta assente, anche se il server mandasse zero", async () => {
    rpc.mockReturnValue(
      ok([
        {
          ...ROW,
          applications_new: 0,
          applications_total: 0,
          counts_available: false,
        },
      ]),
    );

    const detail = await fetchPositionManageDetail("pos-a");

    expect(detail.countsAvailable).toBe(false);
    expect(detail.applicationsTotal).toBeNull();
    expect(detail.applicationsNew).toBeNull();
  });

  it("i conteggi autorizzati passano come sono", async () => {
    rpc.mockReturnValue(
      ok([
        {
          ...ROW,
          applications_new: 3,
          applications_total: 12,
          counts_available: true,
        },
      ]),
    );

    const detail = await fetchPositionManageDetail("pos-a");

    expect(detail.applicationsTotal).toBe(12);
    expect(detail.applicationsNew).toBe(3);
  });

  it("un'età legacy nulla non diventa «Nessun limite di età»", async () => {
    rpc.mockReturnValue(
      ok([{ ...ROW, age_max: null, age_min: null, age_mode: null }]),
    );

    const detail = await fetchPositionManageDetail("pos-a");

    expect(detail.ageMode).toBe("unset");
  });

  it("una risposta vuota non diventa una posizione modificabile senza titolo", async () => {
    rpc.mockReturnValue(ok([]));

    await expect(fetchPositionManageDetail("pos-a")).rejects.toMatchObject({
      code: "POSITION_NOT_FOUND",
    });
  });

  it("negata e inesistente producono lo stesso codice", async () => {
    rpc.mockReturnValue(fail("POSITION_NOT_AVAILABLE"));

    await expect(fetchPositionManageDetail("pos-a")).rejects.toMatchObject({
      code: "POSITION_NOT_AVAILABLE",
    });
  });
});

describe("modifica della posizione attiva (§21)", () => {
  it("invia la patch con la versione attesa, sullo stesso ID", async () => {
    rpc.mockReturnValue(ok([{ position_id: "pos-c", resource_version: 9 }]));

    const result = await updatePublishedPosition({
      expectedVersion: 8,
      patch: { details: { availability: { mode: "immediate" } } },
      positionId: "pos-c",
    });

    expect(rpc).toHaveBeenCalledWith("update_published_position", {
      p_ad_id: "pos-c",
      p_expected_version: 8,
      p_patch: { details: { availability: { mode: "immediate" } } },
    });
    expect(result.resourceVersion).toBe(9);
  });

  it("riconosce il rifiuto degli identificativi bloccati", async () => {
    rpc.mockReturnValue(fail("POSITION_IDENTITY_LOCKED"));

    await expect(
      updatePublishedPosition({
        expectedVersion: 8,
        patch: { description: "x" },
        positionId: "pos-c",
      }),
    ).rejects.toMatchObject({ code: "POSITION_IDENTITY_LOCKED" });
  });

  it("distingue un campo fuori whitelist da un identificativo bloccato", () => {
    expect(toComposeError(new Error("POSITION_FIELD_NOT_EDITABLE")).code).toBe(
      "POSITION_FIELD_NOT_EDITABLE",
    );
    expect(
      toComposeError(new Error("POSITION_AGE_UNSET_NOT_ALLOWED")).code,
    ).toBe("POSITION_AGE_UNSET_NOT_ALLOWED");
  });

  it("un conflitto di versione non viene confuso con un rifiuto di lifecycle", async () => {
    rpc.mockReturnValue(fail("POSITION_VERSION_CONFLICT"));

    await expect(
      updatePublishedPosition({
        expectedVersion: 1,
        patch: { description: "x" },
        positionId: "pos-c",
      }),
    ).rejects.toMatchObject({ code: "POSITION_VERSION_CONFLICT" });
  });
});
