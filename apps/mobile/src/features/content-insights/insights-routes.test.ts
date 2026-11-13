import { describe, expect, it } from "vitest";

import { INSIGHTS_QK, isInsightsKeyFor } from "./insights-keys";
import { contentInsightsHref, parseInsightsContentType } from "./insights-routes";

describe("contentInsightsHref", () => {
  it("route radice a quattro segmenti con la provenienza (§10)", () => {
    expect(contentInsightsHref("profile_post", "p1", "HOME_PER_TE")).toBe(
      "/content/insights/profile_post/p1?origin=HOME_PER_TE",
    );
    expect(contentInsightsHref("media_profile", "p2")).toBe("/content/insights/media_profile/p2");
  });
});

describe("parseInsightsContentType", () => {
  it("accetta i sei tipi, rifiuta il resto (§65)", () => {
    expect(parseInsightsContentType("fan_media")).toBe("fan_media");
    expect(parseInsightsContentType(["club_media"])).toBe("club_media");
    expect(parseInsightsContentType("insights")).toBeNull();
    expect(parseInsightsContentType(undefined)).toBeNull();
  });
});

describe("chiavi di cache (§131–132)", () => {
  it("il trend estende la key del dettaglio con metrica e periodo", () => {
    expect(INSIGHTS_QK.detail("v1", "profile_post", "p1")).toEqual(["content-insights", "v1", "profile_post", "p1"]);
    expect(INSIGHTS_QK.trend("v1", "profile_post", "p1", "views", "7d")).toEqual([
      "content-insights",
      "v1",
      "profile_post",
      "p1",
      "trend",
      "views",
      "7d",
    ]);
  });

  it("isInsightsKeyFor riconosce dettaglio e trend di UN contenuto", () => {
    expect(isInsightsKeyFor(INSIGHTS_QK.detail("v1", "profile_post", "p1"), "profile_post", "p1")).toBe(true);
    expect(isInsightsKeyFor(INSIGHTS_QK.trend("v1", "profile_post", "p1", "reach", "24h"), "profile_post", "p1")).toBe(
      true,
    );
    expect(isInsightsKeyFor(INSIGHTS_QK.detail("v1", "profile_post", "p2"), "profile_post", "p1")).toBe(false);
    expect(isInsightsKeyFor(["saved-items", "v1", "profile_post", "p1"], "profile_post", "p1")).toBe(false);
  });
});
