/**
 * Riconciliazione delle fonti lasciate con i dati server più nuovi: Feed, dettaglio e card
 * commento (HOM-11 §62, §173, §296).
 */
import { describe, expect, it, vi } from "vitest";

import { makePostItem } from "../feed/components/feed-test-helpers";
import type { FeedItem, FeedRepostContext } from "../feed/feed-types";
import { reconcileFollowFromComments, reconcileFollowFromItems } from "./reconcile-follow";
import { createUnfollowedSourcesStore } from "./unfollowed-sources-store";

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));

function item(overrides: Record<string, unknown>): FeedItem {
  return makePostItem(
    {
      author: { avatarUrl: null, id: "club-1", isVerified: false, kind: "club", name: "Como", sourceKind: null },
      ...overrides,
    } as never,
    {},
  );
}

function storeWith(key: string, at: number) {
  const store = createUnfollowedSourcesStore();
  store.add(key);
  store.settle(key, at);
  return store;
}

describe("reconcileFollowFromItems — §173", () => {
  it("una riga server partita DOPO la rimozione che dice «seguito» toglie la voce", () => {
    const store = storeWith("club:club-1", 1000);

    reconcileFollowFromItems([item({ fetchedAt: 2000, isFollowingAuthor: true })], store);

    expect(store.has("club:club-1")).toBe(false);
  });

  it("una pagina più vecchia della rimozione (cache) non la smentisce", () => {
    const store = storeWith("club:club-1", 1000);

    reconcileFollowFromItems([item({ fetchedAt: 500, isFollowingAuthor: true })], store);

    expect(store.has("club:club-1")).toBe(true);
  });

  it("senza istante (righe da disco) non smentisce mai", () => {
    const store = storeWith("club:club-1", 1000);

    reconcileFollowFromItems([item({ isFollowingAuthor: true })], store);

    expect(store.has("club:club-1")).toBe(true);
  });

  it("una riga che dice «non seguito» conferma la rimozione", () => {
    const store = storeWith("club:club-1", 1000);

    reconcileFollowFromItems([item({ fetchedAt: 2000, isFollowingAuthor: false })], store);

    expect(store.has("club:club-1")).toBe(true);
  });

  it("un'altra fonte non tocca la voce", () => {
    const store = storeWith("club:club-1", 1000);

    reconcileFollowFromItems(
      [
        item({
          author: { avatarUrl: null, id: "p-5", isVerified: false, kind: "profile", name: "X", sourceKind: null },
          fetchedAt: 2000,
          isFollowingAuthor: true,
        }),
      ],
      store,
    );

    expect(store.has("club:club-1")).toBe(true);
  });

  it("Simple Repost: il reposter, seguito per costruzione, smentisce la sua voce (§145)", () => {
    const store = storeWith("profile:p-9", 1000);
    const repost: FeedRepostContext = {
      additionalCount: 0,
      reposter: { avatarUrl: null, identityId: "p-9", identityType: "person", isVerified: false, name: "Marco" },
    };

    reconcileFollowFromItems([item({ fetchedAt: 2000, isFollowingAuthor: false, repost })], store);

    expect(store.has("profile:p-9")).toBe(false);
  });

  it("senza voci nello store non fa nulla", () => {
    const store = createUnfollowedSourcesStore();

    expect(() => reconcileFollowFromItems([item({ fetchedAt: 2000, isFollowingAuthor: true })], store)).not.toThrow();
  });
});

describe("reconcileFollowFromComments — §173", () => {
  const author = { identityId: "c-77", identityType: "society" };

  it("una pagina di commenti più nuova che dice «seguito» (Società → club) toglie la voce", () => {
    const store = storeWith("club:c-77", 1000);

    reconcileFollowFromComments([{ author, viewerFollowsAuthor: true }], 2000, store);

    expect(store.has("club:c-77")).toBe(false);
  });

  it("più vecchia, o «non seguito», o senza autore: la voce resta", () => {
    const store = storeWith("club:c-77", 1000);

    reconcileFollowFromComments([{ author, viewerFollowsAuthor: true }], 500, store);
    reconcileFollowFromComments([{ author, viewerFollowsAuthor: false }], 2000, store);
    reconcileFollowFromComments([{ author: null, viewerFollowsAuthor: true }], 2000, store);

    expect(store.has("club:c-77")).toBe(true);
  });
});
