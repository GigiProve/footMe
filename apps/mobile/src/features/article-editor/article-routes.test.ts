import { describe, expect, it } from "vitest";

import {
  articleDraftHref,
  articleEditHref,
  articleHandoffHref,
  articleModeHref,
  articleNewHref,
  parseArticleParams,
} from "./article-routes";

describe("destinazioni dell'editor Articolo", () => {
  it("il selector, le modalità e le bozze portano origin e identity", () => {
    expect(articleNewHref("HOME_PER_TE", "como")).toBe("/article-compose?identity=como&origin=HOME_PER_TE");
    expect(articleModeHref("native", "SOCIETY_PROFILE", null)).toBe("/article-compose/editor?mode=native&origin=SOCIETY_PROFILE");
    expect(articleModeHref("external_link", "HOME_PER_TE", "como")).toBe("/article-compose/link?identity=como&mode=external_link&origin=HOME_PER_TE");
    // «Incolla un articolo» ha un suo schermo, senza parametro di modalità.
    expect(articleModeHref("imported_text", "HOME_PER_TE", null)).toBe("/article-compose/paste?origin=HOME_PER_TE");
  });

  it("«Importa nell'editor» e il cambio modalità continuano la sessione nello store (§7T, §7X)", () => {
    expect(articleHandoffHref("imported_text", "HOME_PER_TE", "como")).toBe(
      "/article-compose/editor?handoff=1&identity=como&mode=imported_text&origin=HOME_PER_TE",
    );
    expect(articleHandoffHref("external_link", "HOME_PER_TE")).toBe("/article-compose/link?handoff=1&mode=external_link&origin=HOME_PER_TE");
    expect(parseArticleParams({ handoff: "1", mode: "imported_text", origin: "HOME_PER_TE" })).toMatchObject({ handoff: true, mode: "imported_text" });
    expect(parseArticleParams({ origin: "HOME_PER_TE" }).handoff).toBe(false);
  });

  it("una bozza si riapre nella modalità salvata; senza modalità passa dalla riapertura per ref", () => {
    const ref = { contentId: "c1", contentType: "club_media" } as const;
    expect(articleDraftHref(ref, "external_link")).toContain("/article-compose/link?");
    expect(articleDraftHref(ref, "imported_text")).toContain("/article-compose/editor?");
    expect(articleDraftHref(ref, null)).toContain("/article-compose/open?");
    expect(articleEditHref(ref)).toContain("edit=1");
  });

  it("parametri sconosciuti o malformati tornano ai valori neutri", () => {
    const parsed = parseArticleParams({ draft_id: "x", draft_type: "boh", mode: "altro", origin: "ovunque" });
    expect(parsed).toEqual({
      draftRef: null,
      editPublished: false,
      handoff: false,
      identityId: null,
      mode: null,
      origin: "HOME_PER_TE",
    });
    expect(parseArticleParams({ draft_id: "c1", draft_type: "media_profile", edit: "1" })).toMatchObject({
      draftRef: { contentId: "c1", contentType: "media_profile" },
      editPublished: true,
    });
  });
});
