import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchSavedPositionsPage,
  removeAdFromPages,
  savedGroupQueryKey,
} from "./saved-positions-service";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../../lib/supabase", () => ({
  supabase: { rpc: mocks.rpc },
}));

function rawRow(overrides: Record<string, unknown> = {}) {
  return {
    ad_id: "ad1",
    availability_group: "available",
    category: "Prima squadra",
    club_id: "c1",
    club_logo_url: null,
    club_name: "Calcio Lecco",
    has_applied: false,
    is_navigable: true,
    location: "Lecco · Lombardia",
    role: "right_winger",
    saved_at: "2026-09-01T10:00:00Z",
    team_name: "Prima squadra",
    total_count: 4,
    unavailable_at: null,
    unavailable_reason: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchSavedPositionsPage", () => {
  it("asks the backend for the current group and page", async () => {
    mocks.rpc.mockResolvedValue({ data: [rawRow()], error: null });

    await fetchSavedPositionsPage({ group: "unavailable", page: 2 });

    expect(mocks.rpc).toHaveBeenCalledWith("fetch_saved_positions_page", {
      p_group: "unavailable",
      p_limit: 20,
      p_offset: 40,
    });
  });

  /**
   * §15: «I conteggi sopra le liste derivano dal backend e dal filtro
   * corrente, non dagli elementi della pagina scaricata.»
   */
  it("keeps the group total independent from the downloaded rows", async () => {
    mocks.rpc.mockResolvedValue({
      data: [rawRow(), rawRow({ ad_id: "ad2" })],
      error: null,
    });

    const page = await fetchSavedPositionsPage({ group: "available", page: 0 });

    expect(page.rows).toHaveLength(2);
    expect(page.totalCount).toBe(4);
  });

  /**
   * §7: una candidatura già inviata non rende indisponibile la posizione.
   * Gruppo e `hasApplied` restano due informazioni distinte.
   */
  it("does not let an application change the availability group", async () => {
    mocks.rpc.mockResolvedValue({
      data: [rawRow({ has_applied: true })],
      error: null,
    });

    const page = await fetchSavedPositionsPage({ group: "available", page: 0 });

    expect(page.rows[0].group).toBe("available");
    expect(page.rows[0].hasApplied).toBe(true);
  });

  /** §16: una row storica senza dettaglio accessibile non è un link. */
  it("maps the historical row with its reason, date and navigability", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        rawRow({
          availability_group: "unavailable",
          is_navigable: false,
          unavailable_at: "2026-09-05T08:00:00Z",
          unavailable_reason: "withdrawn",
        }),
      ],
      error: null,
    });

    const page = await fetchSavedPositionsPage({
      group: "unavailable",
      page: 0,
    });

    expect(page.rows[0]).toMatchObject({
      group: "unavailable",
      isNavigable: false,
      unavailableAt: "2026-09-05T08:00:00Z",
      unavailableReason: "withdrawn",
    });
  });

  /** §7: una motivazione non enumerata non arriva a schermo. */
  it("drops an unauthorised reason", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        rawRow({
          availability_group: "unavailable",
          unavailable_reason: "club_blocked_you",
        }),
      ],
      error: null,
    });

    const page = await fetchSavedPositionsPage({
      group: "unavailable",
      page: 0,
    });

    expect(page.rows[0].unavailableReason).toBeNull();
  });

  it("propagates the source error instead of showing an empty list", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(
      fetchSavedPositionsPage({ group: "available", page: 0 }),
    ).rejects.toThrow("boom");
  });
});

describe("savedGroupQueryKey", () => {
  /**
   * §15, §24: «Il cambio filtro mantiene i rispettivi dati e stati, senza
   * mescolare le due liste.» Chiavi diverse, cache diverse.
   */
  it("separates the two groups and the account", () => {
    expect(savedGroupQueryKey("p1", "available")).not.toEqual(
      savedGroupQueryKey("p1", "unavailable"),
    );
    expect(savedGroupQueryKey("p1", "available")).not.toEqual(
      savedGroupQueryKey("p2", "available"),
    );
  });
});

describe("removeAdFromPages", () => {
  function page(adIds: string[], totalCount: number) {
    return {
      rows: adIds.map((adId) => ({
        adId,
        category: null,
        clubId: null,
        clubLogoUrl: null,
        clubName: "AC Como",
        group: "available" as const,
        hasApplied: false,
        isNavigable: true,
        location: null,
        role: "forward",
        savedAt: "2026-09-01T10:00:00Z",
        teamName: null,
        unavailableAt: null,
        unavailableReason: null,
      })),
      totalCount,
    };
  }

  /** §19: «Rimuovere la row e riconciliare count, preview e lista.» */
  it("removes the row and decrements the group total once", () => {
    const [result] = removeAdFromPages([page(["a", "b"], 5)], "a");

    expect(result.rows.map((row) => row.adId)).toEqual(["b"]);
    expect(result.totalCount).toBe(4);
  });

  /**
   * §19: «Unsave da Non più disponibili — il count delle disponibili non
   * diminuisce, perché la risorsa non vi contribuiva.»
   */
  it("leaves the total alone when the group did not contain the row", () => {
    const [result] = removeAdFromPages([page(["a", "b"], 5)], "zzz");

    expect(result.rows).toHaveLength(2);
    expect(result.totalCount).toBe(5);
  });

  it("never produces a negative total", () => {
    const [result] = removeAdFromPages([page(["a"], 0)], "a");

    expect(result.totalCount).toBe(0);
  });
});
