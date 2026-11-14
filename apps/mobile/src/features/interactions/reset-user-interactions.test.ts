import { describe, expect, it, vi } from "vitest";

import { beginSavedMutation, getSavedEntry, getSavedEpoch, seedSaved } from "../saved/saved-store";
import { likeStore } from "./like-store";
import { resetUserInteractions } from "./reset-user-interactions";

vi.mock("../../ui", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

describe("resetUserInteractions — logout e cambio account (HOM-07 §70, §103)", () => {
  it("svuota Mi piace, identità e Salvati e cambia generazione a entrambi gli store", () => {
    likeStore.bindOwner("user-a");
    likeStore.setIdentity({
      avatarUrl: null,
      id: "user-a",
      isVerified: false,
      name: "A",
      rank: 0,
      type: "person",
    });
    likeStore.seed("club_media:p1", { likedAs: [{ id: "user-a", type: "person" }], likesCount: 3 }, 1);
    seedSaved("profile:-:u1", true, 1);
    beginSavedMutation("profile:-:u2", true);
    const likeEpoch = likeStore.epoch();
    const savedEpoch = getSavedEpoch();

    resetUserInteractions();

    expect(likeStore.get("club_media:p1")).toBeUndefined();
    expect(likeStore.getIdentity()).toBeNull();
    expect(getSavedEntry("profile:-:u1")).toBeUndefined();
    expect(getSavedEntry("profile:-:u2")).toBeUndefined();
    expect(likeStore.epoch()).toBe(likeEpoch + 1);
    expect(getSavedEpoch()).toBe(savedEpoch + 1);
  });
});
