import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { blockedIdentityStore } from "../blocking/blocked-identity-store";
import { BLOCK_QK } from "../blocking/blocking-keys";
import { commentCountStore } from "../comments/comment-count-store";
import { createCommentDraftStore, registerCommentDraft } from "../comments/comment-draft-store";
import { COMMENTS_QK } from "../comments/comment-keys";
import { commentStore } from "../comments/comment-store";
import { hiddenContentStore } from "../feed-feedback/hidden-content-store";
import { useFeedSessionSeen } from "../feed/use-feed-session-seen";
import { unfollowedSourcesStore } from "../following/unfollowed-sources-store";
import { MODERATION_QK } from "../moderation/moderation-keys";
import { reportDraftStore } from "../moderation/report-draft-store";
import { reportedStore } from "../moderation/reported-store";
import { queryClient } from "../../lib/query-client";
import { beginSavedMutation, getSavedEntry, getSavedEpoch, seedSaved } from "../saved/saved-store";
import { likeStore } from "./like-store";
import { resetUserInteractions } from "./reset-user-interactions";

vi.mock("../../ui", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("resetUserInteractions — Block di sessione (HOM-12 §193–§194)", () => {
  it("svuota lo store dei Block e l'availability in cache", () => {
    blockedIdentityStore.seed("profile:u1", true, "b1", 1);
    queryClient.setQueryData(BLOCK_QK.availability("user-a", { id: "u1", type: "person" }), { state: "blocked_by_me" });
    const epoch = blockedIdentityStore.epoch();

    resetUserInteractions();

    expect(blockedIdentityStore.get("profile:u1")).toBeUndefined();
    expect(blockedIdentityStore.epoch()).toBe(epoch + 1);
    expect(
      queryClient.getQueryData(BLOCK_QK.availability("user-a", { id: "u1", type: "person" })),
    ).toBeUndefined();
  });
});

describe("resetUserInteractions — registro impression (HOM-15 §281, §387)", () => {
  it("svuota il registro di sessione: il prossimo account emette di nuovo le impression", () => {
    let seen!: ReturnType<typeof useFeedSessionSeen>;
    function Probe() {
      seen = useFeedSessionSeen({ initialSeenIds: [], profileId: "", scope: "per_te" });
      return null;
    }
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(createElement(Probe));
    });

    expect(seen.markSeen("club_media:p1")).toBe(true);
    expect(seen.markSeen("club_media:p1")).toBe(false);

    resetUserInteractions();

    expect(seen.hasSeen("club_media:p1")).toBe(false);
    expect(seen.markSeen("club_media:p1")).toBe(true);
    act(() => tree.unmount());
  });
});

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

  it("HOM-11: svuota contenuti nascosti, fonti lasciate, segnalati e bozze di segnalazione (§176, §184)", () => {
    hiddenContentStore.begin("club_media:p1");
    unfollowedSourcesStore.add("club:c-1");
    reportedStore.add("COMMENT:c-1");
    reportDraftStore.update("COMMENT:c-1", (draft) => ({ ...draft, details: "testo privato" }));
    queryClient.setQueryData(
      MODERATION_QK.state("user-a", { contentType: "profile_post", targetId: "p1", targetType: "CONTENT" }),
      { alreadyReported: true, available: true, reportable: true },
    );
    const hiddenEpoch = hiddenContentStore.epoch();

    resetUserInteractions();

    expect(hiddenContentStore.get("club_media:p1")).toBeUndefined();
    expect(hiddenContentStore.epoch()).toBe(hiddenEpoch + 1);
    expect(unfollowedSourcesStore.has("club:c-1")).toBe(false);
    expect(reportedStore.has("COMMENT:c-1")).toBe(false);
    expect(reportDraftStore.has("COMMENT:c-1")).toBe(false);
    expect(
      queryClient.getQueryData(
        MODERATION_QK.state("user-a", { contentType: "profile_post", targetId: "p1", targetType: "CONTENT" }),
      ),
    ).toBeUndefined();
  });
});
