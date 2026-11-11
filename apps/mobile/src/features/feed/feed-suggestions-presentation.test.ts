import { describe, expect, it } from "vitest";

import type { FeedSuggestedClubRow, FeedSuggestedProfileRow } from "./feed-types";
import { mixFollowingSuggestions } from "./feed-suggestions-presentation";

function profile(id: string): FeedSuggestedProfileRow {
  return { entity_id: id } as FeedSuggestedProfileRow;
}

function club(id: string): FeedSuggestedClubRow {
  return { entity_id: id } as FeedSuggestedClubRow;
}

const ids = (list: ReturnType<typeof mixFollowingSuggestions>) =>
  list.map((entry) => `${entry.kind}:${entry.row.entity_id}`);

describe("mixFollowingSuggestions", () => {
  it("alterna Società e persone partendo da una Società", () => {
    const result = mixFollowingSuggestions(
      [profile("p1"), profile("p2"), profile("p3")],
      [club("c1"), club("c2")],
      4,
    );

    expect(ids(result)).toEqual(["club:c1", "profile:p1", "club:c2", "profile:p2"]);
  });

  it("rispetta il limite del §37", () => {
    const result = mixFollowingSuggestions(
      [profile("p1"), profile("p2"), profile("p3")],
      [club("c1"), club("c2"), club("c3")],
      4,
    );

    expect(result).toHaveLength(4);
  });

  it("un tipo esaurito lascia il posto all'altro", () => {
    const result = mixFollowingSuggestions(
      [profile("p1"), profile("p2"), profile("p3")],
      [club("c1")],
      4,
    );

    expect(ids(result)).toEqual(["club:c1", "profile:p1", "profile:p2", "profile:p3"]);
  });

  it("regge fonti assenti o vuote", () => {
    expect(mixFollowingSuggestions(undefined, undefined, 4)).toEqual([]);
    expect(ids(mixFollowingSuggestions([profile("p1")], [], 4))).toEqual(["profile:p1"]);
    expect(ids(mixFollowingSuggestions(undefined, [club("c1")], 4))).toEqual(["club:c1"]);
  });
});
