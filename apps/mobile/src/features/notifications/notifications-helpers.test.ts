import { describe, expect, it } from "vitest";

import type { AppNotification } from "../clubs/membership-types";
import {
  ctaLabelFor,
  filterNotificationsByCategory,
  filterUnread,
  groupNotifications,
  groupNotificationsByTime,
  iconNameForCategory,
  NOTIFICATION_FILTERS,
  resolveNotificationCategory,
  timeBucketFor,
} from "./notifications-helpers";

function makeNotification(
  overrides: Partial<AppNotification> = {},
): AppNotification {
  return {
    id: "notif-1",
    recipient_profile_id: "profile-1",
    type: "content_tag",
    title: "Sei stato taggato",
    body: "In un post",
    data: {},
    is_read: false,
    created_at: "2026-07-17T10:00:00.000Z",
    category: "attivita",
    ...overrides,
  };
}

describe("resolveNotificationCategory", () => {
  it("prefers the explicit category column", () => {
    expect(
      resolveNotificationCategory(makeNotification({ category: "store" })),
    ).toBe("store");
  });

  it("falls back to a type-based guess when category is missing", () => {
    expect(
      resolveNotificationCategory(
        makeNotification({ category: undefined, type: "new_follower" }),
      ),
    ).toBe("attivita");
    expect(
      resolveNotificationCategory(
        makeNotification({
          category: undefined,
          type: "agent_representation_request",
        }),
      ),
    ).toBe("richieste");
    expect(
      resolveNotificationCategory(
        makeNotification({ category: undefined, type: "application_received" }),
      ),
    ).toBe("candidature");
    expect(
      resolveNotificationCategory(
        makeNotification({ category: undefined, type: "content_tag" }),
      ),
    ).toBe("attivita");
    expect(
      resolveNotificationCategory(
        makeNotification({ category: undefined, type: "unknown_type" }),
      ),
    ).toBe("sistema");
  });
});

describe("filterNotificationsByCategory", () => {
  const notifications = [
    makeNotification({ id: "1", category: "richieste" }),
    makeNotification({ id: "2", category: "candidature" }),
    makeNotification({ id: "3", category: "attivita" }),
  ];

  it("returns everything for 'tutte'", () => {
    expect(filterNotificationsByCategory(notifications, "tutte")).toEqual(
      notifications,
    );
  });

  it("filters by category", () => {
    expect(filterNotificationsByCategory(notifications, "candidature")).toEqual([
      notifications[1],
    ]);
  });
});

describe("filterUnread", () => {
  it("keeps only unread notifications", () => {
    const notifications = [
      makeNotification({ id: "1", is_read: false }),
      makeNotification({ id: "2", is_read: true }),
    ];
    expect(filterUnread(notifications)).toEqual([notifications[0]]);
  });
});

describe("timeBucketFor", () => {
  const now = new Date("2026-07-17T18:00:00.000Z");

  it("buckets items from today", () => {
    expect(timeBucketFor("2026-07-17T09:00:00.000Z", now)).toBe("oggi");
  });

  it("buckets items from yesterday", () => {
    expect(timeBucketFor("2026-07-16T09:00:00.000Z", now)).toBe("ieri");
  });

  it("buckets older items as precedenti", () => {
    expect(timeBucketFor("2026-07-10T09:00:00.000Z", now)).toBe("precedenti");
  });
});

describe("groupNotificationsByTime", () => {
  const now = new Date("2026-07-17T18:00:00.000Z");

  it("groups notifications into labeled sections, skipping empty buckets", () => {
    const notifications = [
      makeNotification({ id: "1", created_at: "2026-07-17T09:00:00.000Z" }),
      makeNotification({ id: "2", created_at: "2026-07-10T09:00:00.000Z" }),
    ];

    const sections = groupNotificationsByTime(notifications, now);

    expect(sections).toEqual([
      { title: "Oggi", data: [notifications[0]] },
      { title: "Precedenti", data: [notifications[1]] },
    ]);
  });
});

describe("groupNotifications", () => {
  it("leaves the list untouched when there is at most one unread follower notification", () => {
    const notifications = [
      makeNotification({ id: "1", type: "new_follower", is_read: false }),
      makeNotification({ id: "2", type: "content_tag", is_read: false }),
    ];
    expect(groupNotifications(notifications)).toEqual(notifications);
  });

  it("collapses multiple unread new_follower notifications into one summary row", () => {
    const notifications = [
      makeNotification({
        id: "1",
        type: "new_follower",
        is_read: false,
        title: "Mario Rossi",
        data: { follower_name: "Mario Rossi" },
        created_at: "2026-07-17T12:00:00.000Z",
      }),
      makeNotification({
        id: "2",
        type: "content_tag",
        is_read: false,
        created_at: "2026-07-17T11:00:00.000Z",
      }),
      makeNotification({
        id: "3",
        type: "new_follower",
        is_read: false,
        title: "Luca Bianchi",
        data: { follower_name: "Luca Bianchi" },
        created_at: "2026-07-17T10:00:00.000Z",
      }),
    ];

    const result = groupNotifications(notifications);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("1");
    expect(result[0].title).toBe("Mario Rossi e altri 1");
    expect(result[0].body).toBe("Hanno iniziato a seguirti.");
    expect(result[1].id).toBe("2");
  });

  it("does not collapse read new_follower notifications", () => {
    const notifications = [
      makeNotification({ id: "1", type: "new_follower", is_read: true }),
      makeNotification({ id: "2", type: "new_follower", is_read: true }),
    ];
    expect(groupNotifications(notifications)).toEqual(notifications);
  });
});

describe("ctaLabelFor", () => {
  it("maps notification types/categories to CTA labels", () => {
    expect(
      ctaLabelFor(makeNotification({ type: "new_follower", category: "richieste" })),
    ).toBe("Vedi profilo");
    expect(
      ctaLabelFor(makeNotification({ type: "content_tag", category: "attivita" })),
    ).toBe("Apri contenuto");
    expect(
      ctaLabelFor(
        makeNotification({
          type: "agent_representation_request",
          category: "richieste",
        }),
      ),
    ).toBe("Gestisci richiesta");
    expect(
      ctaLabelFor(
        makeNotification({ type: "application_received", category: "candidature" }),
      ),
    ).toBe("Vedi candidatura");
    expect(
      ctaLabelFor(makeNotification({ type: "store_order", category: "store" })),
    ).toBe("Vedi ordine");
    expect(
      ctaLabelFor(makeNotification({ type: "system_alert", category: "sistema" })),
    ).toBe("Apri");
  });
});

describe("iconNameForCategory", () => {
  it("maps each category to an icon name", () => {
    expect(iconNameForCategory("richieste")).toBe("person-add-outline");
    expect(iconNameForCategory("candidature")).toBe("briefcase-outline");
    expect(iconNameForCategory("attivita")).toBe("pricetag-outline");
    expect(iconNameForCategory("store")).toBe("bag-outline");
    expect(iconNameForCategory("sistema")).toBe("shield-checkmark-outline");
  });
});

describe("NOTIFICATION_FILTERS", () => {
  it("exposes the expected chip definitions without a Messaggi filter", () => {
    expect(NOTIFICATION_FILTERS).toEqual([
      { label: "Tutte", value: "tutte" },
      { label: "Richieste", value: "richieste" },
      { label: "Candidature", value: "candidature" },
      { label: "Attività", value: "attivita" },
      { label: "Store", value: "store" },
      { label: "Sistema", value: "sistema" },
    ]);
  });
});
