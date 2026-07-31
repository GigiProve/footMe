import { afterEach, describe, expect, it, vi } from "vitest";

import { setAnalyticsSink, trackEvent, type AnalyticsEvent } from "../../lib/analytics";
import { trackFeed, type FeedAnalyticsEvent } from "./feed-analytics";

afterEach(() => {
  setAnalyticsSink(null);
});

function collect() {
  const events: AnalyticsEvent[] = [];
  setAnalyticsSink((event) => events.push(event));
  return events;
}

describe("trackEvent", () => {
  it("non fa nulla quando nessun sink è registrato", () => {
    // Il §25 chiede di predisporre gli eventi, non un fornitore: senza sink il
    // percorso deve essere un no-op silenzioso.
    expect(() => trackEvent("home_open")).not.toThrow();
  });

  it("inoltra nome, proprietà e istante al sink", () => {
    const events = collect();

    trackEvent("feed_tab_open", { scope: "seguiti" });

    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("feed_tab_open");
    expect(events[0].props).toEqual({ scope: "seguiti" });
    expect(typeof events[0].at).toBe("string");
  });

  it("un sink che solleva non propaga l'errore", () => {
    setAnalyticsSink(() => {
      throw new Error("sink rotto");
    });

    expect(() => trackEvent("home_open")).not.toThrow();
  });

  it("smette di inoltrare quando il sink viene rimosso", () => {
    const sink = vi.fn();
    setAnalyticsSink(sink);
    trackEvent("home_open");
    setAnalyticsSink(null);
    trackEvent("home_open");

    expect(sink).toHaveBeenCalledTimes(1);
  });
});

describe("trackFeed", () => {
  /**
   * Copertura 1:1 dell'elenco del §25. Se un evento richiesto sparisce dalla
   * union, questo test non compila più — che è esattamente il punto.
   */
  const cases: FeedAnalyticsEvent[] = [
    { name: "home_open" },
    { name: "feed_tab_open", scope: "per_te" },
    { name: "feed_tab_open", scope: "seguiti" },
    {
      name: "feed_item_impression",
      itemId: "club_media:1",
      itemType: "post",
      position: 3,
      scope: "per_te",
    },
    {
      name: "feed_content_open",
      itemId: "club_media:1",
      itemType: "post",
      scope: "per_te",
    },
    { name: "feed_position_open", positionId: "ad-1", scope: "per_te" },
    { name: "feed_suggested_profile_open", profileId: "p-1", scope: "per_te" },
    { name: "feed_follow_tap", scope: "per_te", targetId: "p-1", targetType: "profile" },
    { name: "feed_personalize_tap", options: "wants_clubs" },
    { name: "feed_personalize_dismiss", reason: "later" },
    { name: "feed_refresh", scope: "per_te", trigger: "pull" },
    { name: "feed_page_load", page: 2, scope: "per_te" },
    { name: "feed_empty_state_shown", reason: "no_follows", scope: "seguiti" },
    { name: "feed_discover_profiles_tap", scope: "seguiti" },
    { name: "feed_save_tap", itemId: "club_media:1", saved: true },
    { name: "feed_item_menu_open", itemType: "post" },
  ];

  it.each(cases.map((event) => [event.name, event] as const))(
    "inoltra %s con il nome separato dalle proprietà",
    (name, event) => {
      const events = collect();

      trackFeed(event);

      expect(events).toHaveLength(1);
      expect(events[0].name).toBe(name);
      expect(events[0].props).not.toHaveProperty("name");
    },
  );

  it("copre tutti gli eventi richiesti dal §25", () => {
    const required = [
      "home_open",
      "feed_tab_open",
      "feed_item_impression",
      "feed_content_open",
      "feed_position_open",
      "feed_suggested_profile_open",
      "feed_follow_tap",
      "feed_personalize_tap",
      "feed_personalize_dismiss",
      "feed_refresh",
      "feed_page_load",
      "feed_empty_state_shown",
      "feed_discover_profiles_tap",
    ];

    const covered = new Set(cases.map((event) => event.name));
    for (const name of required) {
      expect(covered.has(name as FeedAnalyticsEvent["name"])).toBe(true);
    }
  });

  it("non prevede eventi per Mi piace, commenti o condivisione", () => {
    // Sono nelle esclusioni del §29 e non compaiono nell'elenco del §25.
    const names = cases.map((event) => String(event.name));
    expect(names.some((name) => name.includes("like"))).toBe(false);
    expect(names.some((name) => name.includes("comment"))).toBe(false);
    expect(names.some((name) => name.includes("share"))).toBe(false);
  });
});
