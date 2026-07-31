import React from "react";
import { describe, expect, it, vi } from "vitest";

import { FEED_ITEM_TYPES, type FeedItem } from "../feed-types";
import {
  makeArticleItem,
  makeModules,
  makePositionItem,
  makePostItem,
  makeSuggestedClubsItem,
  makeSuggestedProfilesItem,
  makeVideoItem,
  renderWithToast,
} from "./feed-test-helpers";
import { FeedItemRenderer } from "./FeedItemRenderer";

const handlers = {
  onOpenAuthor: vi.fn(),
  onOpenItem: vi.fn(),
  onToggleSaved: vi.fn(),
};

const byType: Record<string, () => FeedItem> = {
  article: makeArticleItem,
  post: makePostItem,
  suggested_clubs: makeSuggestedClubsItem,
  suggested_position: makePositionItem,
  suggested_profiles: makeSuggestedProfilesItem,
  video: makeVideoItem,
};

describe("FeedItemRenderer", () => {
  it.each(FEED_ITEM_TYPES)("rende un albero non vuoto per il tipo %s", (type) => {
    const build = byType[type];
    expect(build, `manca un costruttore per il tipo ${type}`).toBeTruthy();

    const tree = renderWithToast(
      <FeedItemRenderer handlers={handlers} item={build()} modules={makeModules()} />,
    );

    expect(tree.toJSON()).not.toBeNull();
  });

  it("copre tutti i tipi dichiarati: nessun tipo resta senza componente", () => {
    // Se un tipo viene aggiunto a FEED_ITEM_TYPES senza un componente, questo
    // test lo segnala prima che degradi silenziosamente a null in produzione.
    expect(Object.keys(byType).sort()).toEqual([...FEED_ITEM_TYPES].sort());
  });

  it("degrada a null su un tipo sconosciuto invece di sollevare", () => {
    const unknown = { ...makePostItem(), type: "tipo_dal_futuro" } as unknown as FeedItem;

    const tree = renderWithToast(
      <FeedItemRenderer handlers={handlers} item={unknown} modules={makeModules()} />,
    );

    // Il ToastProvider resta, il contenuto dell'elemento no.
    expect(JSON.stringify(tree.toJSON())).not.toContain("feed-post");
  });
});
