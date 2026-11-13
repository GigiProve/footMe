import { describe, expect, it } from "vitest";

import { CONTENT_DELETE_INVALIDATIONS } from "./content-lifecycle-cache";
import { contentManageParams, editContentHref, viewInsightsHref } from "./content-routes";

const target = {
  authorIdentityId: "author-1",
  authorIdentityType: "person" as const,
  contentId: "post-1",
  contentType: "profile_post" as const,
  origin: "HOME_PER_TE" as const,
  version: null,
};

describe("viewInsightsHref (HOM-05 §3, §10)", () => {
  it("restituisce la route di Dettagli e statistiche con tipo, id e origin", () => {
    expect(viewInsightsHref(contentManageParams(target))).toBe(
      "/content/insights/profile_post/post-1?origin=HOME_PER_TE",
    );
  });

  it("l'origin cambia con la superficie di partenza", () => {
    expect(viewInsightsHref(contentManageParams({ ...target, contentType: "media_profile", origin: "SAVED" }))).toBe(
      "/content/insights/media_profile/post-1?origin=SAVED",
    );
  });

  it("la modifica resta senza destinazione (HOM-06)", () => {
    expect(editContentHref(contentManageParams(target))).toBeNull();
  });
});

describe("eliminazione (HOM-05 §140–141)", () => {
  it("le statistiche sono tra le cache invalidate", () => {
    expect(CONTENT_DELETE_INVALIDATIONS).toContainEqual(["content-insights"]);
  });
});
