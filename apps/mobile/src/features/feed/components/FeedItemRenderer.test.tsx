import React from "react";
import { describe, expect, it, vi } from "vitest";

import { buildManageTarget } from "../content-actions-presentation";
import type { ContentManagement } from "../content-management-types";
import { FEED_ITEM_TYPES, type FeedContentItem, type FeedItem } from "../feed-types";
import {
  countTestId,
  makeArticleItem,
  makeModules,
  makePositionItem,
  makePostItem,
  makeSuggestedClubsItem,
  makeSuggestedProfilesItem,
  makeVideoItem,
  pressTestId,
  renderWithToast,
} from "./feed-test-helpers";
import { FeedItemRenderer } from "./FeedItemRenderer";

// Il video editoriale monta `VideoMedia`, che importa il player nativo e il
// binding del controller (che aggancia il blur della schermata).
vi.mock("expo-video", () => import("../../../test/expo-video"));
vi.mock("expo-router", () => ({ useFocusEffect: () => undefined }));

const handlers = {
  onComment: vi.fn(),
  onOpenAuthor: vi.fn(),
  onOpenIdentity: vi.fn(),
  onOpenItem: vi.fn(),
  onOpenLink: vi.fn(),
  onOpenMedia: vi.fn(),
  onShare: vi.fn(),
  onToggleLike: vi.fn(),
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

  it("mappa l'Articolo sull'unica preview, il video editoriale sul suo componente, il Post sul Post (HOM-03 §39, §96)", () => {
    const render = (item: FeedItem) =>
      renderWithToast(<FeedItemRenderer handlers={handlers} item={item} modules={makeModules()} />);

    const article = render(makeArticleItem());
    expect(countTestId(article, "feed-article")).toBe(1);
    expect(countTestId(article, "feed-editorial-video")).toBe(0);
    expect(countTestId(article, "feed-post")).toBe(0);

    const video = render(makeVideoItem());
    expect(countTestId(video, "feed-editorial-video")).toBe(1);
    expect(countTestId(video, "feed-article")).toBe(0);
    expect(countTestId(video, "feed-post")).toBe(0);

    const post = render(makePostItem());
    expect(countTestId(post, "feed-post")).toBe(1);
    expect(countTestId(post, "feed-article")).toBe(0);
    expect(countTestId(post, "feed-editorial-video")).toBe(0);
  });

  it("Mi piace, Commenta, Condividi e Salva dell'Articolo passano dagli handler del Feed con l'elemento", () => {
    const item = makeArticleItem();
    const tree = renderWithToast(
      <FeedItemRenderer handlers={handlers} item={item} modules={makeModules()} />,
    );

    pressTestId(tree, "feed-post-action-like");
    pressTestId(tree, "feed-post-action-comment");
    pressTestId(tree, "feed-post-action-share");
    pressTestId(tree, "feed-bookmark");
    pressTestId(tree, "feed-article-body");

    expect(handlers.onToggleLike).toHaveBeenCalledWith(item);
    expect(handlers.onComment).toHaveBeenCalledWith(item);
    expect(handlers.onShare).toHaveBeenCalledWith(item);
    expect(handlers.onToggleSaved).toHaveBeenCalledWith(item);
    expect(handlers.onOpenItem).toHaveBeenCalledWith(item);
  });

  it("il video editoriale apre il dettaglio dal titolo e passa Like e Salva con l'elemento", () => {
    const item = makeVideoItem();
    const tree = renderWithToast(
      <FeedItemRenderer handlers={handlers} item={item} modules={makeModules()} />,
    );

    pressTestId(tree, "feed-editorial-video-title");
    pressTestId(tree, "feed-post-action-like");
    pressTestId(tree, "feed-bookmark");

    expect(handlers.onOpenItem).toHaveBeenCalledWith(item);
    expect(handlers.onToggleLike).toHaveBeenCalledWith(item);
    expect(handlers.onToggleSaved).toHaveBeenCalledWith(item);
  });

  it("HOM-04 §17–19: la gestione arriva da getManagement e il copy segue il tipo visibile", () => {
    const manage = (item: FeedContentItem): ContentManagement => ({
      capabilities: { canDelete: true, canEdit: true, canViewInsights: true },
      onDelete: async () => "removed",
      onEdit: vi.fn(),
      onInsights: vi.fn(),
      target: buildManageTarget(item, "HOME_PER_TE"),
    });
    const withManagement = { ...handlers, getManagement: (item: FeedContentItem) => manage(item) };
    const render = (item: FeedItem) =>
      JSON.stringify(
        renderWithToast(
          <FeedItemRenderer handlers={withManagement} item={item} modules={makeModules()} />,
        ).toJSON(),
      );

    const article = render(makeArticleItem());
    expect(article).toContain("Modifica articolo");
    expect(article).toContain("Elimina articolo");
    expect(article).not.toContain("Elimina post");

    const video = render(makeVideoItem());
    expect(video).toContain("Modifica contenuto");
    expect(video).toContain("Elimina contenuto");

    // Un Post (anche con un video social) usa il copy Post.
    const post = render(makePostItem());
    expect(post).toContain("Modifica post");
    expect(post).toContain("Elimina post");
  });

  it("senza getManagement i contenuti non mostrano azioni di gestione", () => {
    const json = JSON.stringify(
      renderWithToast(
        <FeedItemRenderer handlers={handlers} item={makePostItem()} modules={makeModules()} />,
      ).toJSON(),
    );

    expect(json).not.toContain("Elimina post");
    expect(json).not.toContain("Dettagli e statistiche");
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
