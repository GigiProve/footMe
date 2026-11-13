/**
 * Payload di Dettagli e statistiche per i test (HOM-05). Solo test: nessun
 * componente lo importa.
 */

import type { ContentInsights } from "./insights-types";

export function makeInsights(overrides: Partial<ContentInsights> = {}): ContentInsights {
  return {
    article_insights: null,
    content_preview: {
      author: {
        avatar_url: null,
        id: "author-1",
        identity_type: "person",
        is_verified: true,
        name: "Matteo Rossi",
      },
      content_type: "profile_post",
      duration_seconds: null,
      excerpt: null,
      format: "photo",
      item_type: "post",
      post_id: "post-1",
      published_at: new Date(2026, 7, 18, 19, 42).toISOString(),
      thumbnail_url: "https://example.com/t.jpg",
      title: "Allenamento e obiettivi per la nuova stagione",
    },
    default_period: "since_publication",
    engagement: { comments: 23, likes: 196, reposts: null, saves: 47, shares: 18 },
    has_data: true,
    insights_kind: "post",
    overview: { generated_actions: 190, interactions: 284, reach: 3160, views: 4820 },
    periods: [
      { available: true, period: "24h" },
      { available: true, period: "7d" },
      { available: false, period: "30d" },
      { available: true, period: "since_publication" },
    ],
    professional_actions: {
      insight: { kind: "profile_visit_rate", percent: 4 },
      linked_content_opens: null,
      new_followers: 18,
      profile_visits: 126,
      society_visits: 14,
      tagged_opens: 32,
    },
    status: "ok",
    tracking_started_at: "2026-08-01T00:00:00.000Z",
    traffic_sources: [
      { percent: 58, source: "HOME_FOR_YOU" },
      { percent: 21, source: "HOME_FOLLOWING" },
      { percent: 11, source: "PROFILE" },
      { percent: 6, source: "SEARCH" },
      { percent: 3, source: "SHARE" },
      { percent: 1, source: "MESSAGE" },
    ],
    updated_at: "2026-08-19T10:00:00.000Z",
    video_insights: null,
    ...overrides,
  };
}
