/**
 * Analytics dei Commenti: i 24 eventi del §258 uno a uno e la privacy del §259.
 */
import { afterEach, describe, expect, it } from "vitest";

import { setAnalyticsSink, type AnalyticsEvent } from "../../lib/analytics";
import { COMMENT_ANALYTICS_EVENT_NAMES, trackComment } from "./comment-analytics";

afterEach(() => setAnalyticsSink(null));

function capture() {
  const events: AnalyticsEvent[] = [];
  setAnalyticsSink((event) => events.push(event));
  return events;
}

describe("comment-analytics — HOM-08 §258", () => {
  it("i ventiquattro eventi del §258, né più né meno, nell'ordine della specifica", () => {
    expect([...COMMENT_ANALYTICS_EVENT_NAMES]).toEqual([
      "comments_open",
      "comments_open_with_composer",
      "comments_sort_changed",
      "comment_composer_open",
      "comment_identity_changed",
      "comment_publish_attempt",
      "comment_publish_success",
      "comment_publish_failure",
      "comment_retry",
      "reply_selected",
      "reply_publish_attempt",
      "reply_publish_success",
      "mention_added",
      "comment_link_added",
      "comment_like_added",
      "comment_like_removed",
      "comment_likes_list_open",
      "replies_expanded",
      "more_replies_loaded",
      "comment_edit_open",
      "comment_edit_success",
      "comment_delete_attempt",
      "comment_delete_success",
      "author_profile_open_from_comment",
    ]);
    expect(new Set(COMMENT_ANALYTICS_EVENT_NAMES).size).toBe(24);
  });

  it("separa il nome dalle proprietà", () => {
    const events = capture();

    trackComment({
      commentId: "c-1",
      contentId: "post-1",
      contentType: "profile_post",
      name: "reply_selected",
      targetType: "society",
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: "reply_selected",
      props: {
        commentId: "c-1",
        contentId: "post-1",
        contentType: "profile_post",
        targetType: "society",
      },
    });
  });

  it("§259: nessun testo di commento, URL o mention nelle proprietà", () => {
    const events = capture();

    trackComment({
      contentId: "post-1",
      contentType: "club_media",
      identityType: "person",
      linkCount: 1,
      mentionCount: 2,
      name: "comment_publish_attempt",
    });
    trackComment({
      commentId: "c-1",
      contentId: "post-1",
      contentType: "club_media",
      mentionCount: 0,
      linkCount: 0,
      name: "comment_edit_success",
    });

    for (const event of events) {
      const keys = Object.keys(event.props);
      for (const forbidden of ["body", "text", "url", "name", "displayName", "preview"]) {
        expect(keys).not.toContain(forbidden);
      }
    }
  });
});
