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

  it("l'Articolo (club_media / media_profile) apre l'editor Articolo, non il composer (HOM-06.2 §217)", () => {
    expect(editContentHref(contentManageParams({ ...target, contentType: "club_media" }), "article")).toBe(
      "/article-compose/open?draft_id=post-1&draft_type=club_media&edit=1&origin=HOME_PER_TE",
    );
    expect(editContentHref(contentManageParams({ ...target, contentType: "media_profile" }), "article")).toBe(
      "/article-compose/open?draft_id=post-1&draft_type=media_profile&edit=1&origin=HOME_PER_TE",
    );
  });

  it("l'origin dell'editor Articolo: la Home resta Home, ogni altra superficie rientra dal dettaglio", () => {
    const edit = (origin: "HOME_SEGUITI" | "PROFILE" | "SEARCH" | "SAVED" | "DEEP_LINK") =>
      editContentHref(contentManageParams({ ...target, contentType: "club_media", origin }), "article");

    expect(edit("HOME_SEGUITI")).toContain("origin=HOME_SEGUITI");
    expect(edit("PROFILE")).toContain("origin=CONTENT_DETAIL");
    expect(edit("SEARCH")).toContain("origin=CONTENT_DETAIL");
    expect(edit("SAVED")).toContain("origin=CONTENT_DETAIL");
    expect(edit("DEEP_LINK")).toContain("origin=CONTENT_DETAIL");
  });

  it("un Post (o un video) dentro club_media / media_profile resta sul composer Post", () => {
    expect(editContentHref(contentManageParams({ ...target, contentType: "club_media" }), "post")).toContain(
      "/post-compose/edit?type=club_media",
    );
    expect(editContentHref(contentManageParams({ ...target, contentType: "media_profile" }), "content")).toContain(
      "/post-compose/edit?type=media_profile",
    );
  });

  it("un profile_post non è mai un Articolo: il tipo visibile non cambia la destinazione", () => {
    expect(editContentHref(contentManageParams(target), "article")).toContain("/post-compose/edit?type=profile_post");
  });

  it("gli altri tipi restano senza destinazione", () => {
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
