import { describe, expect, it, vi } from "vitest";

import { commentCountStore } from "../comments/comment-count-store";
import { createCommentDraftStore, registerCommentDraft } from "../comments/comment-draft-store";
import { COMMENTS_QK } from "../comments/comment-keys";
import { commentStore } from "../comments/comment-store";
import { queryClient } from "../../lib/query-client";
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

  it("HOM-08: svuota conteggi commenti, commenti e bozze del composer dell'utente che esce", () => {
    const draft = createCommentDraftStore();
    const unregister = registerCommentDraft(draft);
    draft.set({ active: true, body: "testo dell'utente A" });
    commentCountStore.seed("profile_post:p1", 18, 1);
    commentStore.setSort("profile_post:p1", "recent");
    const countEpoch = commentCountStore.epoch();
    const commentEpoch = commentStore.epoch();
    queryClient.setQueryData(COMMENTS_QK.roots("profile_post", "p1", "relevant", "user-a"), { pages: [] });

    resetUserInteractions();
    unregister();

    // Le liste in cache portano solo id: non devono sopravvivere agli store svuotati.
    expect(queryClient.getQueryData(COMMENTS_QK.roots("profile_post", "p1", "relevant", "user-a"))).toBeUndefined();
    expect(commentCountStore.get("profile_post:p1")).toBeUndefined();
    expect(commentStore.getSort("profile_post:p1")).toBe("relevant");
    expect(draft.getState()).toMatchObject({ active: false, body: "" });
    expect(commentCountStore.epoch()).toBe(countEpoch + 1);
    expect(commentStore.epoch()).toBe(commentEpoch + 1);
  });
});
