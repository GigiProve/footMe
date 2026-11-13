import { describe, expect, it } from "vitest";

import { NO_MANAGE_CAPABILITIES } from "./content-actions-presentation";
import { patchContentCapabilities, removeContentFromFeed } from "./content-lifecycle-cache";
import { makePostItem } from "./feed-post-fixtures";
import type { FeedItem } from "./feed-types";

function data(...pages: FeedItem[][]) {
  return {
    pageParams: pages.map((_, pageIndex) => ({ cursor: null, pageIndex })),
    pages: pages.map((items, pageIndex) => ({
      asOf: "x",
      isLastPage: false,
      items,
      nextCursor: null,
      pageIndex,
    })),
  };
}

describe("removeContentFromFeed (§47, §105–107)", () => {
  it("toglie l'elemento da qualunque pagina e conserva ordine e pagine", () => {
    const [a, b, c] = [makePostItem("x:a"), makePostItem("x:b"), makePostItem("x:c")];
    const result = removeContentFromFeed(data([a, b], [c]), "x:b")!;

    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].items).toEqual([a]);
    expect(result.pages[1].items).toEqual([c]);
    expect(result.pageParams).toHaveLength(2);
  });

  it("se non c'è, restituisce la stessa cache (nessuna riscrittura)", () => {
    const cache = data([makePostItem("x:a")]);

    expect(removeContentFromFeed(cache, "x:zzz")).toBe(cache);
    expect(removeContentFromFeed(undefined, "x:a")).toBeUndefined();
  });
});

describe("patchContentCapabilities (§72)", () => {
  it("azzera le tre capability di gestione di un solo elemento", () => {
    const other = makePostItem("x:b", {
      capabilities: { ...makeCaps(), canDelete: true },
    });
    const target = makePostItem("x:a", { capabilities: { ...makeCaps(), canDelete: true, canEdit: true } });

    const [patchedTarget, patchedOther] = patchContentCapabilities(
      data([target, other]),
      "x:a",
      NO_MANAGE_CAPABILITIES,
    )!.pages[0].items;

    expect(patchedTarget.type === "post" ? patchedTarget.payload.capabilities : null).toMatchObject({
      canDelete: false,
      canEdit: false,
      canLike: true,
    });
    expect(patchedOther).toBe(other);
  });
});

function makeCaps() {
  return {
    canComment: true,
    canDelete: false,
    canEdit: false,
    canLike: true,
    canReport: true,
    canSave: true,
    canShare: true,
    canViewInsights: false,
  };
}
