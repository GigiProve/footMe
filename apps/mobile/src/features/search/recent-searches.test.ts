import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addRecentSearch,
  clearRecentSearches,
  formatRecentSearchAge,
  loadRecentSearches,
  MAX_RECENT_SEARCHES,
} from "./recent-searches";

const mocks = vi.hoisted(() => {
  const store = new Map<string, string>();

  return {
    store,
    getItem: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: mocks.getItem,
    removeItem: mocks.removeItem,
    setItem: mocks.setItem,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.store.clear();
});

describe("loadRecentSearches", () => {
  it("returns an empty list when nothing is stored", async () => {
    await expect(loadRecentSearches("u1")).resolves.toEqual([]);
  });

  it("recovers from corrupt JSON", async () => {
    mocks.store.set("@footme/recent-searches/u1", "{not json");

    await expect(loadRecentSearches("u1")).resolves.toEqual([]);
  });

  it("drops non-array payloads and malformed entries", async () => {
    mocks.store.set(
      "@footme/recent-searches/u1",
      JSON.stringify({ query: "como" }),
    );
    await expect(loadRecentSearches("u1")).resolves.toEqual([]);

    mocks.store.set(
      "@footme/recent-searches/u1",
      JSON.stringify([
        { query: "como", scope: "global", searchedAt: "2026-07-22T10:00:00Z" },
        { query: 42, scope: "global", searchedAt: "x" },
        { query: "valid", scope: "invalid-scope", searchedAt: "x" },
      ]),
    );

    await expect(loadRecentSearches("u1")).resolves.toEqual([
      { query: "como", scope: "global", searchedAt: "2026-07-22T10:00:00Z" },
    ]);
  });
});

describe("addRecentSearch", () => {
  it("prepends new entries newest first", async () => {
    await addRecentSearch("u1", "como", "global");
    const next = await addRecentSearch("u1", "attaccanti", "profiles");

    expect(next.map((entry) => entry.query)).toEqual(["attaccanti", "como"]);
    expect(next[0]?.scope).toBe("profiles");
  });

  it("dedupes case-insensitively keeping the newest entry", async () => {
    await addRecentSearch("u1", "Como", "global");
    const next = await addRecentSearch("u1", "como", "clubs");

    expect(next).toHaveLength(1);
    expect(next[0]?.query).toBe("como");
    expect(next[0]?.scope).toBe("clubs");
  });

  it("caps the history at the maximum size", async () => {
    for (let index = 0; index < MAX_RECENT_SEARCHES + 3; index += 1) {
      await addRecentSearch("u1", `query-${index}`, "global");
    }

    const stored = await loadRecentSearches("u1");
    expect(stored).toHaveLength(MAX_RECENT_SEARCHES);
    expect(stored[0]?.query).toBe(`query-${MAX_RECENT_SEARCHES + 2}`);
  });

  it("ignores queries shorter than two characters", async () => {
    await addRecentSearch("u1", "como", "global");
    const next = await addRecentSearch("u1", " a ", "global");

    expect(next.map((entry) => entry.query)).toEqual(["como"]);
    expect(mocks.setItem).toHaveBeenCalledTimes(1);
  });

  it("trims the query before storing", async () => {
    const next = await addRecentSearch("u1", "  como  ", "global");

    expect(next[0]?.query).toBe("como");
  });
});

describe("clearRecentSearches", () => {
  it("removes the profile history", async () => {
    await addRecentSearch("u1", "como", "global");
    await clearRecentSearches("u1");

    await expect(loadRecentSearches("u1")).resolves.toEqual([]);
  });
});

describe("formatRecentSearchAge", () => {
  const now = new Date("2026-07-22T18:00:00");

  it("labels same-day searches as oggi", () => {
    expect(formatRecentSearchAge("2026-07-22T08:00:00", now)).toBe("oggi");
  });

  it("labels the previous day as ieri", () => {
    expect(formatRecentSearchAge("2026-07-21T23:59:00", now)).toBe("ieri");
  });

  it("counts calendar days for older searches", () => {
    expect(formatRecentSearchAge("2026-07-20T01:00:00", now)).toBe(
      "2 giorni fa",
    );
    expect(formatRecentSearchAge("2026-07-18T22:00:00", now)).toBe(
      "4 giorni fa",
    );
  });

  it("falls back to oggi for future or invalid timestamps", () => {
    expect(formatRecentSearchAge("2026-07-23T10:00:00", now)).toBe("oggi");
    expect(formatRecentSearchAge("not-a-date", now)).toBe("oggi");
  });
});
