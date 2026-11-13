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

const CONTENT_PROPS = {
  authorIdentityType: "society",
  contentId: "p-1",
  contentType: "club_media",
  origin: "HOME_PER_TE",
} as const;

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
    { name: "home_personalization_prompt_impression" },
    { name: "home_personalization_opened" },
    { name: "home_personalization_skipped" },
    { count: 3, name: "feed_new_content_available", scope: "per_te" },
    { name: "feed_new_content_tap", scope: "per_te" },
    { identityType: "person", itemId: "p:1", name: "feed_post_author_open" },
    { itemId: "p:1", name: "feed_post_text_expand" },
    { itemId: "p:1", name: "feed_post_text_collapse" },
    { identityType: "profile", itemId: "p:1", name: "feed_post_mention_open" },
    { count: 3, itemId: "p:1", name: "feed_post_tagged_list_open" },
    { index: 0, itemId: "p:1", mediaType: "image", name: "feed_post_media_open" },
    { count: 7, itemId: "p:1", name: "feed_post_gallery_open" },
    { index: 1, itemId: "p:1", name: "feed_post_video_select" },
    { itemId: "p:1", liked: true, name: "feed_post_like_tap" },
    { itemId: "p:1", name: "feed_post_comment_tap" },
    { itemId: "p:1", name: "feed_post_share_tap" },
    { domain: "example.com", itemId: "p:1", name: "feed_post_link_preview_open" },
    // HOM-03 §99–102
    { itemId: "p:1", mediaId: "m-1", name: "feed_video_play", surface: "feed" },
    { itemId: "p:1", mediaId: "m-1", name: "feed_video_play", surface: "detail" },
    { itemId: "p:1", mediaId: "m-1", name: "feed_video_progress", percent: 25 },
    { itemId: "p:1", mediaId: "m-1", name: "feed_video_complete" },
    { itemId: "p:1", mediaId: "m-1", name: "feed_video_watch", seconds: 12 },
    { itemId: "p:1", muted: true, name: "feed_video_mute" },
    { itemId: "p:1", name: "feed_video_fullscreen" },
    { itemId: "p:1", mediaId: "m-1", name: "feed_video_error" },
    { itemId: "p:1", mediaId: "m-1", name: "feed_video_retry" },
    { itemId: "a:1", name: "feed_article_impression" },
    { itemId: "a:1", name: "feed_article_open", origin: "feed", position: 4 },
    // HOM-04 §134–135: solo id, tipo, identità autrice e origine
    { ...CONTENT_PROPS, name: "content_menu_open" },
    { ...CONTENT_PROPS, name: "edit_selected" },
    { ...CONTENT_PROPS, name: "insights_selected" },
    { ...CONTENT_PROPS, name: "delete_selected" },
    { ...CONTENT_PROPS, name: "delete_cancelled" },
    { ...CONTENT_PROPS, name: "delete_confirmed" },
    { ...CONTENT_PROPS, name: "delete_success" },
    { ...CONTENT_PROPS, name: "delete_failed" },
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

  it("gli eventi di gestione portano solo le quattro proprietà del §135", () => {
    const events = collect();

    trackFeed({ ...CONTENT_PROPS, name: "delete_success" });

    expect(Object.keys(events[0].props ?? {}).sort()).toEqual([
      "authorIdentityType",
      "contentId",
      "contentType",
      "origin",
    ]);
  });

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
      // HOM-01.1 §69–§70
      "home_personalization_prompt_impression",
      "home_personalization_opened",
      "home_personalization_skipped",
      "feed_new_content_available",
      "feed_new_content_tap",
      // HOM-02 §89 (impression e menu restano feed_item_impression e feed_item_menu_open)
      "feed_item_menu_open",
      "feed_post_author_open",
      "feed_post_text_expand",
      "feed_post_text_collapse",
      "feed_post_mention_open",
      "feed_post_tagged_list_open",
      "feed_post_media_open",
      "feed_post_gallery_open",
      "feed_post_video_select",
      "feed_post_like_tap",
      "feed_post_comment_tap",
      "feed_post_share_tap",
      "feed_post_link_preview_open",
      // HOM-03 §99–102: play, progress e completion distinti dall'impression
      "feed_video_play",
      "feed_video_progress",
      "feed_video_complete",
      "feed_video_watch",
      "feed_video_mute",
      "feed_video_fullscreen",
      "feed_video_error",
      "feed_video_retry",
      "feed_article_impression",
      "feed_article_open",
      // HOM-04 §134
      "content_menu_open",
      "edit_selected",
      "insights_selected",
      "delete_selected",
      "delete_cancelled",
      "delete_confirmed",
      "delete_success",
      "delete_failed",
    ];

    const covered = new Set(cases.map((event) => event.name));
    for (const name of required) {
      expect(covered.has(name as FeedAnalyticsEvent["name"])).toBe(true);
    }
  });
});
