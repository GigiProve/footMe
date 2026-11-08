import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addShortlistEntry,
  fetchClubShortlists,
  fetchProfileShortlistMemberships,
  fetchShortlistEntries,
  fetchShortlistedProfileIds,
  getEvaluationStatusLabel,
  getPriorityLabel,
  getScopeLabel,
  removeShortlistEntry,
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

describe("addShortlistEntry", () => {
  it("inserts an entry with the given priority/status/note", async () => {
    await addShortlistEntry("list-1", "player-1", "adder-1", {
      evaluationStatus: "interessante",
      internalNote: "  Ottimo colpo di testa  ",
      priority: "alta",
    });

    expect(mocks.builder.insert).toHaveBeenCalledWith({
      added_by_profile_id: "adder-1",
      /* DAS-REV-24 §19: l'origine di nascita la scrive il client solo qui,
         dove l'ingresso è il profilo; il legame con una candidatura lo
         stabilisce il server (§23). */
      created_source: "profile",
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
      created_source: "profile",
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
      /* DAS-REV-24 §17, §20: cancellazione esplicita della priorità e
       compare-and-set sulla revisione. `p_set_priority` segue la presenza
       della chiave nel patch, non il suo valore. */
      p_set_priority: true,
      p_expected_revision: null,
    });
  });

  it("clears the priority when it is explicitly null (DAS-REV-24 §17)", async () => {
    mocks.rpc.mockResolvedValue({ error: null });

    await updateShortlistEntry("entry-1", { priority: null });

    /* Senza `p_set_priority` un `null` sarebbe indistinguibile da «lascia
       com'è», e una priorità non si potrebbe più togliere. */
    expect(mocks.rpc).toHaveBeenCalledWith("update_shortlist_entry", {
      p_entry_id: "entry-1",
      p_evaluation_status: null,
      p_internal_note: null,
      p_priority: null,
      p_set_note: false,
      p_set_priority: true,
      p_expected_revision: null,
    });
  });

  it("forwards the expected revision for compare-and-set (DAS-REV-24 §20)", async () => {
    mocks.rpc.mockResolvedValue({ error: null });

    await updateShortlistEntry("entry-1", {
      evaluationStatus: "interessante",
      expectedRevision: 7,
    });

    expect(mocks.rpc).toHaveBeenCalledWith("update_shortlist_entry", {
      p_entry_id: "entry-1",
      p_evaluation_status: "interessante",
      p_internal_note: null,
      p_priority: null,
      p_set_note: false,
      p_set_priority: false,
      p_expected_revision: 7,
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
      /* DAS-REV-24 §17, §20: cancellazione esplicita della priorità e
       compare-and-set sulla revisione, entrambi facoltativi. */
      p_set_priority: false,
      p_expected_revision: null,
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
      /* DAS-REV-24 §17, §20: cancellazione esplicita della priorità e
       compare-and-set sulla revisione, entrambi facoltativi. */
      p_set_priority: false,
      p_expected_revision: null,
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
  /* DAS-REV-25 §21: la rimozione è un comando, non un delete diretto. Un
     secondo percorso avrebbe autorizzazioni e ricevute diverse sullo stesso
     dato. */
  it("passa dal comando autorizzato e non dalla tabella", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    await removeShortlistEntry("entry-1");

    expect(mocks.rpc).toHaveBeenCalledWith("remove_shortlist_entry", {
      p_entry_id: "entry-1",
      p_idempotency_key: null,
    });
    expect(mocks.builder.delete).not.toHaveBeenCalled();
  });

  it("inoltra la chiave idempotente quando il chiamante ne ha una", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    await removeShortlistEntry("entry-1", "op-7");

    expect(mocks.rpc).toHaveBeenCalledWith("remove_shortlist_entry", {
      p_entry_id: "entry-1",
      p_idempotency_key: "op-7",
    });
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
