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

  it("la modifica di un Post apre il composer con tipo, id, origin e versione (HOM-06.1 §143)", () => {
    expect(editContentHref(contentManageParams({ ...target, version: "2026-11-13T10:00:00+00:00" }))).toBe(
      "/post-compose/edit?type=profile_post&id=post-1&origin=HOME_PER_TE&version=2026-11-13T10%3A00%3A00%2B00%3A00",
    );
  });

  it("senza versione la href non ha il parametro version", () => {
    expect(editContentHref(contentManageParams(target))).toBe(
      "/post-compose/edit?type=profile_post&id=post-1&origin=HOME_PER_TE",
    );
  });

  it("club_media e media_profile aprono il composer (il server rifiuta ciò che non è un Post)", () => {
    expect(editContentHref(contentManageParams({ ...target, contentType: "club_media" }))).toContain(
      "/post-compose/edit?type=club_media",
    );
    expect(editContentHref(contentManageParams({ ...target, contentType: "media_profile" }))).toContain(
      "/post-compose/edit?type=media_profile",
    );
  });

  it("gli altri tipi restano senza destinazione (Articolo = HOM-06.2)", () => {
    expect(editContentHref(contentManageParams({ ...target, contentType: "fan_tribuna" }))).toBeNull();
    expect(editContentHref(contentManageParams({ ...target, contentType: "media_tribuna" }))).toBeNull();
    expect(editContentHref(contentManageParams({ ...target, contentType: "fan_media" }))).toBeNull();
  });
});

describe("eliminazione (HOM-05 §140–141)", () => {
  it("le statistiche sono tra le cache invalidate", () => {
    expect(CONTENT_DELETE_INVALIDATIONS).toContainEqual(["content-insights"]);
  });
});
