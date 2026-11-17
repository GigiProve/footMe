import { describe, expect, it } from "vitest";

import {
  iconNameForCategory,
  isScheduledContentNotification,
  isSelectionEventNotification,
  resolveNotificationCategory,
  scheduledContentNotificationHref,
  selectionEventNotificationHref,
} from "./notifications-helpers";

type TestNotification = {
  body: string | null;
  category?: string | null;
  data: Record<string, unknown>;
  type: string;
};

function makeNotification(overrides: Partial<TestNotification> = {}): TestNotification {
  return {
    body: "In un post",
    category: "attivita",
    data: {},
    type: "content_tag",
    ...overrides,
  };
}

describe("resolveNotificationCategory", () => {
  it("prefers the explicit category column", () => {
    expect(resolveNotificationCategory(makeNotification({ category: "store" }))).toBe("store");
  });

  it("falls back to a type-based guess when category is missing", () => {
    expect(
      resolveNotificationCategory(makeNotification({ category: undefined, type: "new_follower" })),
    ).toBe("attivita");
    expect(
      resolveNotificationCategory(
        makeNotification({ category: undefined, type: "agent_representation_request" }),
      ),
    ).toBe("richieste");
    expect(
      resolveNotificationCategory(makeNotification({ category: undefined, type: "application_received" })),
    ).toBe("candidature");
    expect(
      resolveNotificationCategory(makeNotification({ category: undefined, type: "content_tag" })),
    ).toBe("attivita");
    expect(
      resolveNotificationCategory(makeNotification({ category: null, type: "unknown_type" })),
    ).toBe("sistema");
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

/* DAS-REV-31 §21–§25, screen 16–18: notifiche raggruppate e deep link. */
describe("DAS-REV-31 notifiche evento", () => {
  const group = (type: string, data: Record<string, unknown> = {}) =>
    makeNotification({
      body: "Mario Rossi, Luca Bianchi e altri 10",
      category: "candidature",
      data: {
        event_id: "e1",
        event_title: "Open day Primavera",
        preview_names: ["Mario Rossi", "Luca Bianchi"],
        distinct_person_count: 12,
        ...data,
      },
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
  });

  it("la pubblicazione riuscita apre il contenuto, con tipo e id del server (§201)", () => {
    const item = makeNotification({
      data: { content_id: "c1", content_type: "club_media" },
      type: "scheduled_content_published",
    });

    expect(scheduledContentNotificationHref(item)).toBe("/content/club_media/c1?origin=NOTIFICATION");
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
