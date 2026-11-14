import { describe, expect, it } from "vitest";

import type { AppNotification } from "../clubs/membership-types";
import {
  ctaLabelFor,
  filterNotificationsByCategory,
  filterUnread,
  groupNotifications,
  groupNotificationsByTime,
  iconNameForCategory,
  isScheduledContentNotification,
  isSelectionEventNotification,
  NOTIFICATION_FILTERS,
  notificationTimestamp,
  resolveNotificationCategory,
  latestUpdatedAt,
  scheduledContentNotificationHref,
  selectionEventNotificationHref,
  selectionEventResponseLines,
  timeBucketFor,
} from "./notifications-helpers";

function makeNotification(
  overrides: Partial<AppNotification> = {},
): AppNotification {
  const createdAt = overrides.created_at ?? "2026-07-17T10:00:00.000Z";

  return {
    id: "notif-1",
    recipient_profile_id: "profile-1",
    type: "content_tag",
    title: "Sei stato taggato",
    body: "In un post",
    data: {},
    is_read: false,
    created_at: createdAt,
    category: "attivita",
    aggregate_key: null,
    revision: 1,
    /* Righe non aggregate: updated_at = created_at (contratto DAS-REV-31). */
    updated_at: createdAt,
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

/* DAS-REV-31 §21–§25, screen 16–18: notifiche raggruppate e deep link. */
describe("DAS-REV-31 notifiche evento", () => {
  const group = (type: string, data: Record<string, unknown> = {}) =>
    makeNotification({
      aggregate_key: `${type}:e1`,
      body: "Mario Rossi, Luca Bianchi e altri 10",
      category: "candidature",
      data: {
        event_id: "e1",
        event_title: "Open day Primavera",
        preview_names: ["Mario Rossi", "Luca Bianchi"],
        distinct_person_count: 12,
        ...data,
      } as unknown as Record<string, string>,
      revision: 3,
      title: "12 profili hanno accettato l’invito a Open day Primavera.",
      type,
    });

  it("§25: ogni risposta apre il proprio filtro dei Partecipanti", () => {
    expect(selectionEventNotificationHref(group("selection_event_invitation_accepted"))).toBe(
      "/(tabs)/dashboard/events/participants/e1?filter=confirmed",
    );
    expect(selectionEventNotificationHref(group("selection_event_invitation_declined"))).toBe(
      "/(tabs)/dashboard/events/participants/e1?filter=declined",
    );
    expect(selectionEventNotificationHref(group("selection_event_participation_withdrawn"))).toBe(
      "/(tabs)/dashboard/events/participants/e1?filter=withdrawn",
    );
  });

  it("§25: annullato apre il dettaglio, aggiornato il dettaglio con il banner", () => {
    const data = { event_id: "e1" };

    expect(
      selectionEventNotificationHref(makeNotification({ data, type: "selection_event_cancelled" })),
    ).toBe("/(tabs)/dashboard/events/e1");
    expect(
      selectionEventNotificationHref(makeNotification({ data, type: "selection_event_updated" })),
    ).toBe("/(tabs)/dashboard/events/e1?updated=1");
    /* Le notifiche 29/30 restano sul dettaglio semplice. */
    expect(
      selectionEventNotificationHref(
        makeNotification({ data, type: "selection_event_invitation_received" }),
      ),
    ).toBe("/(tabs)/dashboard/events/e1");
  });

  it("senza event_id nessuna destinazione inventata; tipi estranei esclusi", () => {
    expect(
      selectionEventNotificationHref(makeNotification({ data: {}, type: "selection_event_cancelled" })),
    ).toBeNull();
    expect(
      selectionEventNotificationHref(makeNotification({ data: { event_id: "e1" }, type: "content_tag" })),
    ).toBeNull();
    expect(isSelectionEventNotification({ type: "content_tag" })).toBe(false);
    expect(isSelectionEventNotification({ type: "selection_event_updated" })).toBe(true);
  });

  it("§21: i cinque tipi nuovi stanno in Candidature anche senza colonna category", () => {
    for (const type of [
      "selection_event_cancelled",
      "selection_event_updated",
      "selection_event_invitation_accepted",
      "selection_event_invitation_declined",
      "selection_event_participation_withdrawn",
    ]) {
      expect(resolveNotificationCategory(makeNotification({ category: undefined, type }))).toBe(
        "candidature",
      );
    }
  });

  it("screen 16: riga di gruppo = titolo, evento e nomi; CTA verso i partecipanti", () => {
    const item = group("selection_event_invitation_accepted");

    expect(selectionEventResponseLines(item)).toEqual({
      eventTitle: "Open day Primavera",
      names: "Mario Rossi, Luca Bianchi e altri 10",
    });
    expect(ctaLabelFor(item)).toBe("Vedi partecipanti");
    /* Singola: body null, nessuna riga di nomi vuota. */
    expect(selectionEventResponseLines({ ...item, body: null })?.names).toBeNull();
    expect(selectionEventResponseLines(makeNotification())).toBeNull();
    expect(ctaLabelFor(makeNotification({ type: "selection_event_cancelled" }))).toBe("Vedi evento");
  });

  it("§23: ordine e fascia temporale seguono l'ultimo aggiornamento del gruppo", () => {
    const now = new Date(2026, 9, 1, 12, 0, 0);
    const item = group("selection_event_invitation_accepted", {});
    const refreshed = {
      ...item,
      created_at: new Date(2026, 8, 20, 9, 0, 0).toISOString(),
      updated_at: new Date(2026, 9, 1, 10, 0, 0).toISOString(),
    };

    expect(notificationTimestamp(refreshed)).toBe(refreshed.updated_at);
    expect(groupNotificationsByTime([refreshed], now)[0]?.title).toBe("Oggi");
  });
});

describe("DAS-REV-31 — segna tutte e Società della notifica", () => {
  it("latestUpdatedAt prende l’aggiornamento più recente mostrato", () => {
    expect(
      latestUpdatedAt([
        { created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-01T10:00:00Z" },
        { created_at: "2026-11-01T09:00:00Z", updated_at: "2026-11-02T08:00:00Z" },
      ]),
    ).toBe("2026-11-02T08:00:00Z");
    expect(latestUpdatedAt([])).toBeNull();
  });

  it("le risposte aggregate aprono i Partecipanti nella Società della notifica", () => {
    expect(
      selectionEventNotificationHref({
        data: { club_id: "club-1", event_id: "ev-1" },
        type: "selection_event_invitation_declined",
      }),
    ).toBe("/(tabs)/dashboard/events/participants/ev-1?filter=declined&asSociety=club-1");
  });
});

describe("HOM-06.2 — contenuti programmati nel Centro Notifiche (§199–§202)", () => {
  it("il fallimento apre Programmati, dove l'elemento fallito ha le sue azioni (§200)", () => {
    const item = makeNotification({
      data: { content_id: "c1", content_type: "club_media" },
      type: "scheduled_content_failed",
    });

    expect(scheduledContentNotificationHref(item)).toBe("/drafts?tab=scheduled");
    expect(isScheduledContentNotification(item)).toBe(true);
    expect(ctaLabelFor(item)).toBe("Vedi programmati");
  });

  it("la pubblicazione riuscita apre il contenuto, con tipo e id del server (§201)", () => {
    const item = makeNotification({
      data: { content_id: "c1", content_type: "club_media" },
      type: "scheduled_content_published",
    });

    expect(scheduledContentNotificationHref(item)).toBe("/content/club_media/c1");
    expect(ctaLabelFor(item)).toBe("Apri contenuto");
  });

  it("senza tipo o id nessuna destinazione inventata; tipi estranei esclusi", () => {
    expect(
      scheduledContentNotificationHref(makeNotification({ data: {}, type: "scheduled_content_published" })),
    ).toBeNull();
    expect(
      scheduledContentNotificationHref(
        makeNotification({ data: { content_id: "c1", content_type: "club_media" }, type: "content_tag" }),
      ),
    ).toBeNull();
    expect(isScheduledContentNotification({ type: "content_tag" })).toBe(false);
  });

  it("categoria di ripiego senza colonna: entrambi di sistema (non sono Messaggi, §202)", () => {
    expect(
      resolveNotificationCategory(makeNotification({ category: undefined, type: "scheduled_content_published" })),
    ).toBe("sistema");
    expect(
      resolveNotificationCategory(makeNotification({ category: undefined, type: "scheduled_content_failed" })),
    ).toBe("sistema");
  });
});
