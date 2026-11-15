import { afterEach, describe, expect, it } from "vitest";

import { setAnalyticsSink, type AnalyticsEvent } from "../../lib/analytics";
import { REPOST_ANALYTICS_EVENT_NAMES, trackRepost, type RepostAnalyticsEvent } from "./repost-analytics";

afterEach(() => {
  setAnalyticsSink(null);
});

function collect() {
  const events: AnalyticsEvent[] = [];
  setAnalyticsSink((event) => events.push(event));
  return events;
}

const TARGET = { contentId: "c-1", contentType: "club_media" } as const;
const WHO = { identityType: "person" } as const;

/** Un evento per ciascun nome del §269, nello stesso ordine. */
const ALL_EVENTS: RepostAnalyticsEvent[] = [
  { alreadyReposted: false, name: "repost_entry_selected", origin: "HOME_PER_TE", ...TARGET },
  { name: "repost_composer_open", origin: "HOME_PER_TE", source: "entry", ...TARGET, ...WHO },
  { from: "person", name: "repost_identity_changed", to: "society" },
  { name: "simple_repost_attempt", ...TARGET, ...WHO },
  { name: "simple_repost_success", replayed: false, ...TARGET, ...WHO },
  { name: "simple_repost_failure", reason: "error", ...TARGET, ...WHO },
  { name: "simple_repost_removed", ...TARGET, ...WHO },
  { name: "repost_text_started", ...TARGET, ...WHO },
  { name: "repost_mention_added", targetType: "profile" },
  { domain: "example.com", name: "repost_link_added" },
  { hasLink: true, mentionCount: 1, name: "referenced_post_publish_attempt", scheduled: false, ...TARGET, ...WHO },
  { name: "referenced_post_publish_success", postContentType: "profile_post", replayed: false, ...TARGET, ...WHO },
  { code: "network", name: "referenced_post_publish_failure", ...TARGET, ...WHO },
  { name: "repost_draft_created", ...TARGET, ...WHO },
  { name: "referenced_post_scheduled", ...TARGET, ...WHO },
  { name: "referenced_content_opened", surface: "feed", ...TARGET },
  { additionalCount: 3, name: "aggregated_simple_repost_rendered", ...TARGET },
];

describe("trackRepost (HOM-10 §269–§272)", () => {
  it("registra esattamente gli eventi del §269", () => {
    const events = collect();

    ALL_EVENTS.forEach(trackRepost);

    expect(events.map((event) => event.name)).toEqual([...REPOST_ANALYTICS_EVENT_NAMES]);
    expect(REPOST_ANALYTICS_EVENT_NAMES).toHaveLength(17);
  });

  it("distingue i due esiti tecnici nei nomi (§271)", () => {
    expect(REPOST_ANALYTICS_EVENT_NAMES.filter((name) => name.startsWith("simple_repost"))).toHaveLength(4);
    expect(REPOST_ANALYTICS_EVENT_NAMES.filter((name) => name.startsWith("referenced_post"))).toHaveLength(4);
  });

  it("nessuna proprietà contiene testo, bozza, mention o URL completo (§270)", () => {
    const events = collect();

    ALL_EVENTS.forEach(trackRepost);

    const keys = new Set(events.flatMap((event) => Object.keys(event.props)));
    const values = events.flatMap((event) => Object.values(event.props)).map(String);

    for (const forbidden of ["body", "text", "draft", "url", "displayName", "name", "mention"]) {
      expect(keys.has(forbidden)).toBe(false);
    }

    expect(values.some((value) => /^https?:\/\//.test(value))).toBe(false);
  });
});
