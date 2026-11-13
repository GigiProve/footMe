import { afterEach, describe, expect, it } from "vitest";

import { setAnalyticsSink, type AnalyticsEvent } from "../../lib/analytics";
import {
  COMPOSER_ANALYTICS_EVENT_NAMES,
  domainOf,
  trackComposer,
  type ComposerAnalyticsEvent,
  type PublishProps,
} from "./composer-analytics";

afterEach(() => {
  setAnalyticsSink(null);
});

function collect() {
  const events: AnalyticsEvent[] = [];
  setAnalyticsSink((event) => events.push(event));
  return events;
}

const PUBLISH: PublishProps = {
  hasLink: true,
  hasText: true,
  identityType: "person",
  mediaCount: 3,
  mentionCount: 1,
  origin: "HOME_PER_TE",
  tagCount: 2,
};

describe("trackComposer", () => {
  /** Copertura 1:1 dell'elenco del §200: se un evento sparisce dalla union, questo non compila più. */
  const cases: ComposerAnalyticsEvent[] = [
    { identityType: "person", name: "composer_open", origin: "HOME_PER_TE" },
    { from: "person", name: "identity_changed", to: "society" },
    { count: 2, name: "image_added" },
    { count: 1, name: "video_added" },
    { images: 2, name: "mixed_media_created", videos: 1 },
    { mediaType: "image", name: "media_removed" },
    { name: "media_reordered", via: "drag" },
    { domain: "example.com", name: "link_detected" },
    { domain: "example.com", name: "link_preview_success" },
    { domain: null, name: "link_preview_failed", retryable: true },
    { domain: "example.com", name: "link_preview_removed" },
    { name: "tag_selector_open", selected: 2 },
    { name: "tag_added", targetType: "profile" },
    { name: "tag_removed", targetType: "club" },
    { name: "mention_added", targetType: "profile" },
    { ...PUBLISH, name: "publish_attempt" },
    { ...PUBLISH, contentType: "profile_post", name: "publish_success", replayed: false },
    { ...PUBLISH, code: "network", name: "publish_failure" },
    { mediaType: "video", name: "upload_retry" },
    { contentId: "p1", contentType: "club_media", identityType: "society", name: "edit_open" },
    { contentId: "p1", contentType: "club_media", identityType: "society", name: "edit_success" },
    { code: "post_version_conflict", contentId: "p1", contentType: "club_media", identityType: "society", name: "edit_failure" },
  ];

  it.each(cases.map((event) => [event.name, event] as const))("inoltra %s con nome separato dalle proprietà", (name, event) => {
    const events = collect();

    trackComposer(event);

    expect(events).toHaveLength(1);
    expect(events[0].name).toBe(name);
    expect(events[0].props).not.toHaveProperty("name");
  });

  it("copre tutti gli eventi richiesti dal §200, e solo quelli", () => {
    expect(new Set(cases.map((event) => event.name))).toEqual(new Set(COMPOSER_ANALYTICS_EVENT_NAMES));
    expect(COMPOSER_ANALYTICS_EVENT_NAMES).toHaveLength(22);
  });

  it("nessun evento porta testo, mention, URL completo o query (§201)", () => {
    const forbidden = ["body", "text", "url", "query", "displayName", "mention", "caption"];

    for (const event of cases) {
      const events = collect();
      trackComposer(event);

      for (const key of Object.keys(events[events.length - 1].props)) {
        expect(forbidden).not.toContain(key);
      }
      setAnalyticsSink(null);
    }
  });
});

describe("domainOf (§201)", () => {
  it("solo il dominio, senza www, porta, percorso, query", () => {
    expect(domainOf("https://www.Example.com:8080/a/b?q=segreto#x")).toBe("example.com");
    expect(domainOf("http://sportnews.it")).toBe("sportnews.it");
  });

  it("non-URL → null", () => {
    expect(domainOf("non è un link")).toBeNull();
    expect(domainOf("")).toBeNull();
  });
});
