import { describe, expect, it } from "vitest";

import {
  CONTENT_ACTION_IDS,
  CONTENT_KIND_COPY,
  buildContentActions,
  buildManageTarget,
  composeActionList,
  hasManagementActions,
  visibleKindOfContentType,
  visibleKindOfItemType,
} from "./content-actions-presentation";
import type { ContentActionDescriptor } from "./content-actions-presentation";
import { makeEditorialItem, makePostItem } from "./feed-post-fixtures";
import type { FeedContentItem } from "./feed-types";

const ALL = { canDelete: true, canEdit: true, canViewInsights: true };

const ids = (actions: { id: string }[]) => actions.map((action) => action.id);

describe("buildContentActions — matrice delle capability (§136–138)", () => {
  it("owner completo: tre azioni nell'ordine Modifica → Dettagli → Elimina (§15)", () => {
    const actions = buildContentActions("post", ALL);

    expect(ids(actions)).toEqual([
      CONTENT_ACTION_IDS.edit,
      CONTENT_ACTION_IDS.insights,
      CONTENT_ACTION_IDS.delete,
    ]);
    expect(actions.map((action) => action.label)).toEqual([
      "Modifica post",
      "Dettagli e statistiche",
      "Elimina post",
    ]);
  });

  it("Elimina è distruttiva, ultima, con il divisore davanti", () => {
    const actions = buildContentActions("post", ALL);
    const last = actions[actions.length - 1];

    expect(last).toMatchObject({ destructive: true, dividerBefore: true, id: "DELETE_CONTENT" });
    expect(actions.slice(0, -1).some((action) => action.destructive || action.dividerBefore)).toBe(false);
  });

  it("can_delete=false: Elimina assente, nessuna riga disabilitata (§137, §28)", () => {
    const actions = buildContentActions("post", { ...ALL, canDelete: false });

    expect(ids(actions)).toEqual(["EDIT_CONTENT", "VIEW_INSIGHTS"]);
    expect(actions.some((action) => action.dividerBefore)).toBe(false);
  });

  it("solo can_view_insights: una sola riga (§138)", () => {
    const actions = buildContentActions("post", {
      canDelete: false,
      canEdit: false,
      canViewInsights: true,
    });

    expect(ids(actions)).toEqual(["VIEW_INSIGHTS"]);
  });

  it("nessuna capability: nessuna azione", () => {
    const none = { canDelete: false, canEdit: false, canViewInsights: false };

    expect(buildContentActions("post", none)).toEqual([]);
    expect(hasManagementActions(none)).toBe(false);
    expect(hasManagementActions({ ...none, canDelete: true })).toBe(true);
  });
});

describe("copy per tipo visibile (§17–20, §140–141)", () => {
  it("Articolo: «articolo», mai «post»", () => {
    const labels = buildContentActions("article", ALL).map((action) => action.label);

    expect(labels).toEqual(["Modifica articolo", "Dettagli e statistiche", "Elimina articolo"]);
  });

  it("video editoriale: «contenuto», senza nomi tecnici", () => {
    const labels = buildContentActions("content", ALL).map((action) => action.label);

    expect(labels).toEqual(["Modifica contenuto", "Dettagli e statistiche", "Elimina contenuto"]);
  });

  it("Video social = Post (§18)", () => {
    // Un Video social è un elemento `post` con un video nella collezione.
    expect(visibleKindOfItemType("post")).toBe("post");
    expect(visibleKindOfItemType("article")).toBe("article");
    expect(visibleKindOfItemType("video")).toBe("content");
  });

  it("dal dettaglio: solo media_profile può essere articolo o contenuto", () => {
    expect(visibleKindOfContentType("media_profile", false)).toBe("article");
    expect(visibleKindOfContentType("media_profile", true)).toBe("content");
    expect(visibleKindOfContentType("club_media", true)).toBe("post");
    expect(visibleKindOfContentType("profile_post", false)).toBe("post");
  });

  it("conferma di eliminazione: titolo e testo del §40–42", () => {
    expect(CONTENT_KIND_COPY.post.confirmTitle).toBe("Eliminare questo post?");
    expect(CONTENT_KIND_COPY.post.confirmMessage).toBe(
      "Il post non sarà più visibile su PROLINK. Questa azione non può essere annullata.",
    );
    expect(CONTENT_KIND_COPY.article.confirmTitle).toBe("Eliminare questo articolo?");
    expect(CONTENT_KIND_COPY.content.confirmTitle).toBe("Eliminare questo contenuto?");
  });

  it("feedback: «Post eliminato» / «Articolo eliminato» / «Contenuto eliminato» (§48)", () => {
    expect(CONTENT_KIND_COPY.post.deleted).toBe("Post eliminato");
    expect(CONTENT_KIND_COPY.article.deleted).toBe("Articolo eliminato");
    expect(CONTENT_KIND_COPY.content.deleted).toBe("Contenuto eliminato");
  });

  it("errore di eliminazione per tipo (§69)", () => {
    expect(CONTENT_KIND_COPY.post.deleteFailed).toBe("Non è stato possibile eliminare il post. Riprova.");
  });
});

describe("composeActionList — nessun duplicato (§131–132)", () => {
  it("Elimina compare una sola volta anche se due moduli la forniscono", () => {
    const fromManagement = buildContentActions("post", ALL);
    const fromOtherModule: ContentActionDescriptor[] = [
      { icon: "trash-outline", id: CONTENT_ACTION_IDS.delete, label: "Elimina (altro modulo)" },
    ];

    const merged = composeActionList(fromManagement, fromOtherModule);

    expect(merged.filter((action) => action.id === "DELETE_CONTENT")).toHaveLength(1);
    expect(merged.find((action) => action.id === "DELETE_CONTENT")?.label).toBe("Elimina post");
  });

  it("conserva l'ordine e le azioni senza id", () => {
    const first: { id?: string }[] = [{ id: "a" }, {}];
    const second: { id?: string }[] = [{ id: "a" }, { id: "b" }];
    const merged = composeActionList(first, second);

    expect(merged).toHaveLength(3);
    expect(merged.map((action) => action.id)).toEqual(["a", undefined, "b"]);
  });
});

describe("buildManageTarget (§34, §37)", () => {
  it("porta id, tipo, identità autrice, origine e versione", () => {
    const item = {
      ...makePostItem("club_media:p1", { contentType: "club_media", postId: "p1", version: "2026-11-12T10:00:00Z" }),
      author: { avatarUrl: null, id: "club-1", isVerified: true, kind: "club", name: "AC Como", sourceKind: null },
    } as FeedContentItem;

    expect(buildManageTarget(item, "HOME_PER_TE")).toEqual({
      authorIdentityId: "club-1",
      authorIdentityType: "society",
      contentId: "p1",
      contentType: "club_media",
      itemId: "club_media:p1",
      origin: "HOME_PER_TE",
      version: "2026-11-12T10:00:00Z",
      visibleKind: "post",
    });
  });

  it("un video editoriale ha tipo visibile «content»", () => {
    const video = makeEditorialItem("media_profile:v1", "video") as FeedContentItem;

    expect(buildManageTarget(video, "HOME_SEGUITI")).toMatchObject({
      authorIdentityId: null,
      origin: "HOME_SEGUITI",
      visibleKind: "content",
    });
  });
});
