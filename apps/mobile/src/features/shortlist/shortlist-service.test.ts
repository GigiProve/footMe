import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addShortlistEntry,
  createShortlist,
  deleteShortlist,
  fetchClubShortlists,
  fetchProfileShortlistMemberships,
  fetchShortlistEntries,
  fetchShortlistOverviewCounts,
  fetchShortlistedProfileIds,
  getEvaluationStatusLabel,
  getPriorityLabel,
  getScopeLabel,
  removeShortlistEntry,
  updateShortlist,
  updateShortlistEntry,
  type ShortlistEvaluationStatus,
  type ShortlistPriority,
  type ShortlistScope,
} from "./shortlist-service";

const mocks = vi.hoisted(() => {
  const builder: Record<string, unknown> = {};
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.not = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  builder.then = vi.fn((resolve: (value: unknown) => unknown) =>
    resolve({ data: null, error: null }),
  );

  return {
    builder,
    from: vi.fn(() => builder),
    rpc: vi.fn(),
  };
});

vi.mock("../../lib/supabase", () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));

beforeEach(() => {
  vi.clearAllMocks();
  (mocks.builder.insert as ReturnType<typeof vi.fn>).mockImplementation(() => mocks.builder);
  (mocks.builder.update as ReturnType<typeof vi.fn>).mockImplementation(() => mocks.builder);
  (mocks.builder.delete as ReturnType<typeof vi.fn>).mockImplementation(() => mocks.builder);
  (mocks.builder.select as ReturnType<typeof vi.fn>).mockImplementation(() => mocks.builder);
  (mocks.builder.eq as ReturnType<typeof vi.fn>).mockImplementation(() => mocks.builder);
  (mocks.builder.not as ReturnType<typeof vi.fn>).mockImplementation(() => mocks.builder);
  (mocks.builder.in as ReturnType<typeof vi.fn>).mockImplementation(() => mocks.builder);
  (mocks.builder.single as ReturnType<typeof vi.fn>).mockImplementation(() =>
    Promise.resolve({ data: null, error: null }),
  );
  (mocks.builder.then as ReturnType<typeof vi.fn>).mockImplementation(
    (resolve: (value: unknown) => unknown) => resolve({ data: null, error: null }),
  );
});

describe("rpc readers", () => {
  it("fetchClubShortlists forwards club id and pagination", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ id: "l1" }], error: null });
    const result = await fetchClubShortlists("club-1", 1, 20);
    expect(mocks.rpc).toHaveBeenCalledWith("fetch_club_shortlists", {
      p_club_id: "club-1",
      p_limit: 20,
      p_offset: 20,
    });
    expect(result).toHaveLength(1);
  });

  it("fetchShortlistOverviewCounts coerces string counts to numbers", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          alta_count: "4",
          da_contattare_count: "2",
          lists_count: "3",
          total_entries: "9",
        },
      ],
      error: null,
    });

    const counts = await fetchShortlistOverviewCounts("club-1");

    expect(counts).toEqual({
      alta_count: 4,
      da_contattare_count: 2,
      lists_count: 3,
      total_entries: 9,
    });
  });

  it("fetchShortlistOverviewCounts defaults to zero when the row is missing fields", async () => {
    mocks.rpc.mockResolvedValue({ data: [{}], error: null });

    const counts = await fetchShortlistOverviewCounts("club-1");

    expect(counts).toEqual({
      alta_count: 0,
      da_contattare_count: 0,
      lists_count: 0,
      total_entries: 0,
    });
  });

  it("fetchShortlistEntries forwards shortlist id and pagination", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ id: "e1" }], error: null });
    const result = await fetchShortlistEntries("list-1", 2, 50);
    expect(mocks.rpc).toHaveBeenCalledWith("fetch_shortlist_entries", {
      p_limit: 50,
      p_offset: 100,
      p_shortlist_id: "list-1",
    });
    expect(result).toHaveLength(1);
  });
});

describe("createShortlist", () => {
  it("inserts a row and returns the new id", async () => {
    (mocks.builder.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { id: "list-99" },
      error: null,
    });

    const id = await createShortlist("club-1", "profile-1", {
      description: "  Profili offensivi  ",
      name: "  Attaccanti 2025/26  ",
      scope: "prima_squadra",
    });

    expect(mocks.from).toHaveBeenCalledWith("club_shortlists");
    expect(mocks.builder.insert).toHaveBeenCalledWith({
      club_id: "club-1",
      created_by_profile_id: "profile-1",
      description: "Profili offensivi",
      name: "Attaccanti 2025/26",
      scope: "prima_squadra",
    });
    expect(id).toBe("list-99");
  });
});

describe("updateShortlist / deleteShortlist", () => {
  it("updates the row by id", async () => {
    await updateShortlist("list-1", { name: "Nuovo nome" });
    expect(mocks.from).toHaveBeenCalledWith("club_shortlists");
    expect(mocks.builder.update).toHaveBeenCalledWith({ name: "Nuovo nome" });
    expect(mocks.builder.eq).toHaveBeenCalledWith("id", "list-1");
  });

  it("deletes the row by id", async () => {
    await deleteShortlist("list-1");
    expect(mocks.builder.delete).toHaveBeenCalled();
    expect(mocks.builder.eq).toHaveBeenCalledWith("id", "list-1");
  });
});

describe("addShortlistEntry", () => {
  it("inserts an entry with the given priority/status/note", async () => {
    await addShortlistEntry("list-1", "player-1", "adder-1", {
      evaluationStatus: "interessante",
      internalNote: "  Ottimo colpo di testa  ",
      priority: "alta",
    });

    expect(mocks.builder.insert).toHaveBeenCalledWith({
      added_by_profile_id: "adder-1",
      evaluation_status: "interessante",
      internal_note: "Ottimo colpo di testa",
      player_profile_id: "player-1",
      priority: "alta",
      shortlist_id: "list-1",
    });
  });

  it("defaults evaluation_status and internal_note when omitted", async () => {
    await addShortlistEntry("list-1", "player-1", "adder-1", { priority: "media" });

    expect(mocks.builder.insert).toHaveBeenCalledWith({
      added_by_profile_id: "adder-1",
      evaluation_status: "da_valutare",
      internal_note: null,
      player_profile_id: "player-1",
      priority: "media",
      shortlist_id: "list-1",
    });
  });

  it("maps a unique-violation (23505) into an Italian duplicate message", async () => {
    (mocks.builder.then as ReturnType<typeof vi.fn>).mockImplementation(
      (resolve: (value: unknown) => unknown) =>
        resolve({ error: { code: "23505", message: "duplicate key" } }),
    );

    await expect(
      addShortlistEntry("list-1", "player-1", "adder-1", { priority: "alta" }),
    ).rejects.toThrow("Profilo già presente in questa lista.");
  });

  it("passes through any other error unchanged", async () => {
    const otherError = { code: "42501", message: "Non autorizzato" };
    (mocks.builder.then as ReturnType<typeof vi.fn>).mockImplementation(
      (resolve: (value: unknown) => unknown) => resolve({ error: otherError }),
    );

    await expect(
      addShortlistEntry("list-1", "player-1", "adder-1", { priority: "alta" }),
    ).rejects.toBe(otherError);
  });
});

describe("updateShortlistEntry", () => {
  it("does not set the note and sends p_set_note: false when internalNote is absent", async () => {
    mocks.rpc.mockResolvedValue({ error: null });

    await updateShortlistEntry("entry-1", { priority: "alta" });

    expect(mocks.rpc).toHaveBeenCalledWith("update_shortlist_entry", {
      p_entry_id: "entry-1",
      p_evaluation_status: null,
      p_internal_note: null,
      p_priority: "alta",
      p_set_note: false,
    });
  });

  it("sends p_set_note: true and forwards null when clearing the note", async () => {
    mocks.rpc.mockResolvedValue({ error: null });

    await updateShortlistEntry("entry-1", { internalNote: null });

    expect(mocks.rpc).toHaveBeenCalledWith("update_shortlist_entry", {
      p_entry_id: "entry-1",
      p_evaluation_status: null,
      p_internal_note: null,
      p_priority: null,
      p_set_note: true,
    });
  });

  it("sends p_set_note: true with the trimmed note when setting a new note", async () => {
    mocks.rpc.mockResolvedValue({ error: null });

    await updateShortlistEntry("entry-1", {
      evaluationStatus: "contattato",
      internalNote: "Nota aggiornata",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("update_shortlist_entry", {
      p_entry_id: "entry-1",
      p_evaluation_status: "contattato",
      p_internal_note: "Nota aggiornata",
      p_priority: null,
      p_set_note: true,
    });
  });

  it("throws when the rpc returns an error", async () => {
    mocks.rpc.mockResolvedValue({ error: new Error("Non autorizzato") });

    await expect(
      updateShortlistEntry("entry-1", { priority: "bassa" }),
    ).rejects.toThrow("Non autorizzato");
  });
});

describe("removeShortlistEntry", () => {
  it("deletes the entry by id", async () => {
    await removeShortlistEntry("entry-1");
    expect(mocks.from).toHaveBeenCalledWith("club_shortlist_entries");
    expect(mocks.builder.delete).toHaveBeenCalled();
    expect(mocks.builder.eq).toHaveBeenCalledWith("id", "entry-1");
  });
});

describe("fetchProfileShortlistMemberships", () => {
  it("maps rows with the embedded club_shortlists relation", async () => {
    (mocks.builder.then as ReturnType<typeof vi.fn>).mockImplementation(
      (resolve: (value: unknown) => unknown) =>
        resolve({
          data: [
            {
              club_shortlists: { id: "list-1", name: "Attaccanti 2025/26" },
              evaluation_status: "interessante",
              id: "entry-1",
              priority: "alta",
              shortlist_id: "list-1",
            },
          ],
          error: null,
        }),
    );

    const result = await fetchProfileShortlistMemberships("player-1", "club-1");

    expect(result).toEqual([
      {
        entry_id: "entry-1",
        evaluation_status: "interessante",
        priority: "alta",
        shortlist_id: "list-1",
        shortlist_name: "Attaccanti 2025/26",
      },
    ]);
    expect(mocks.builder.eq).toHaveBeenCalledWith(
      "player_profile_id",
      "player-1",
    );
    expect(mocks.builder.eq).toHaveBeenCalledWith(
      "club_shortlists.club_id",
      "club-1",
    );
  });

  it("returns an empty array when there are no memberships", async () => {
    (mocks.builder.then as ReturnType<typeof vi.fn>).mockImplementation(
      (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null }),
    );

    const result = await fetchProfileShortlistMemberships("player-1", "club-1");
    expect(result).toEqual([]);
  });

  it("returns an empty array when data is null", async () => {
    (mocks.builder.then as ReturnType<typeof vi.fn>).mockImplementation(
      (resolve: (value: unknown) => unknown) => resolve({ data: null, error: null }),
    );

    const result = await fetchProfileShortlistMemberships("player-1", "club-1");
    expect(result).toEqual([]);
  });
});

describe("fetchShortlistedProfileIds", () => {
  it("short-circuits on an empty input without querying supabase", async () => {
    const result = await fetchShortlistedProfileIds("club-1", []);

    expect(result).toEqual(new Set());
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns the shortlisted subset as a Set, scoped to the club", async () => {
    (mocks.builder.then as ReturnType<typeof vi.fn>).mockImplementation(
      (resolve: (value: unknown) => unknown) =>
        resolve({
          data: [
            { player_profile_id: "p1", club_shortlists: { club_id: "club-1" } },
            { player_profile_id: "p3", club_shortlists: { club_id: "club-1" } },
          ],
          error: null,
        }),
    );

    const result = await fetchShortlistedProfileIds("club-1", ["p1", "p2", "p3"]);

    expect(mocks.from).toHaveBeenCalledWith("club_shortlist_entries");
    expect(mocks.builder.eq).toHaveBeenCalledWith(
      "club_shortlists.club_id",
      "club-1",
    );
    expect(mocks.builder.in).toHaveBeenCalledWith("player_profile_id", [
      "p1",
      "p2",
      "p3",
    ]);
    expect(result).toEqual(new Set(["p1", "p3"]));
  });

  it("propagates errors", async () => {
    (mocks.builder.then as ReturnType<typeof vi.fn>).mockImplementation(
      (resolve: (value: unknown) => unknown) =>
        resolve({ data: null, error: new Error("boom") }),
    );

    await expect(
      fetchShortlistedProfileIds("club-1", ["p1"]),
    ).rejects.toThrow("boom");
  });
});

describe("label helpers", () => {
  it("getScopeLabel covers every scope value", () => {
    const expected: Record<ShortlistScope, string> = {
      juniores: "Juniores",
      prima_squadra: "Prima squadra",
      tutta_la_societa: "Tutta la società",
      under_15: "Under 15",
      under_17: "Under 17",
    };

    for (const [scope, label] of Object.entries(expected)) {
      expect(getScopeLabel(scope as ShortlistScope)).toBe(label);
    }
  });

  it("getPriorityLabel covers every priority value", () => {
    const expected: Record<ShortlistPriority, string> = {
      alta: "Alta",
      bassa: "Bassa",
      media: "Media",
    };

    for (const [priority, label] of Object.entries(expected)) {
      expect(getPriorityLabel(priority as ShortlistPriority)).toBe(label);
    }
  });

  it("getEvaluationStatusLabel covers every status value", () => {
    const expected: Record<ShortlistEvaluationStatus, string> = {
      contattato: "Contattato",
      da_contattare: "Da contattare",
      da_valutare: "Da valutare",
      interessante: "Interessante",
      non_prioritario: "Non prioritario",
      scartato: "Scartato",
    };

    for (const [status, label] of Object.entries(expected)) {
      expect(getEvaluationStatusLabel(status as ShortlistEvaluationStatus)).toBe(label);
    }
  });
});
