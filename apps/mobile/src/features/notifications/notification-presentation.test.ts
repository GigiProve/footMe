import { describe, expect, it } from "vitest";

import {
  flattenNotificationPages,
  groupNotificationsByTime,
  notificationAccessibilityLabel,
  notificationActorName,
  notificationActorSuffix,
  notificationPreview,
  notificationPrimaryText,
  notificationSecondaryText,
  notificationSectionKey,
} from "./notification-presentation";
import type { InboxNotification } from "./notification-types";

const NOW = new Date(2026, 10, 16, 12, 0, 0);

function at(day: number, hour = 9): string {
  return new Date(2026, 10, day, hour, 0, 0).toISOString();
}

function make(overrides: Partial<InboxNotification> = {}): InboxNotification {
  return {
    actor: { available: true, avatarUrl: null, id: "a1", name: "Marco Bianchi", type: "person", verified: true },
    body: null,
    category: "attivita",
    createdAt: at(16),
    data: {},
    displayAt: at(16),
    eventCount: 1,
    id: "n1",
    isNew: true,
    isOpened: false,
    preview: null,
    recipient: { id: "r1", managed: false, name: "Alessandro Conti", type: "person" },
    revision: 1,
    target: { id: "c1", params: { content_type: "profile_post" }, type: "content" },
    title: "Titolo del server",
    type: "content_commented",
    ...overrides,
  };
}

describe("sezioni temporali (§23, §145)", () => {
  it("Oggi / Questa settimana / Precedenti su displayAt, senza «Ieri»", () => {
    expect(notificationSectionKey(at(16, 8), NOW)).toBe("today");
    expect(notificationSectionKey(at(15, 23), NOW)).toBe("week");
    expect(notificationSectionKey(at(10, 9), NOW)).toBe("week");
    expect(notificationSectionKey(at(9, 9), NOW)).toBe("earlier");
  });

  it("raggruppa nell'ordine del server e salta le sezioni vuote", () => {
    const items = [
      make({ displayAt: at(16, 10), id: "a" }),
      make({ displayAt: at(12), id: "b" }),
      make({ displayAt: at(1), id: "c" }),
    ];

    expect(groupNotificationsByTime(items, NOW).map((s) => [s.title, s.data.map((i) => i.id)])).toEqual([
      ["Oggi", ["a"]],
      ["Questa settimana", ["b"]],
      ["Precedenti", ["c"]],
    ]);
    expect(groupNotificationsByTime([items[2]], NOW).map((s) => s.title)).toEqual(["Precedenti"]);
  });

  it("un aggregato aggiornato oggi sta in Oggi anche se creato prima (§144)", () => {
    const aggregate = make({ createdAt: at(1), displayAt: at(16, 11) });

    expect(groupNotificationsByTime([aggregate], NOW)[0]?.title).toBe("Oggi");
  });
});

describe("paginazione senza duplicati (§223, §329)", () => {
  it("vale la prima occorrenza di un id che compare in due pagine", () => {
    const first = make({ id: "x", title: "nuova" });
    const stale = make({ id: "x", title: "vecchia" });
    const other = make({ id: "y" });

    const items = flattenNotificationPages([
      { asOf: null, hasMore: true, items: [first] },
      { asOf: null, hasMore: false, items: [stale, other] },
    ]);

    expect(items.map((i) => [i.id, i.title])).toEqual([
      ["x", "nuova"],
      ["y", "Titolo del server"],
    ]);
  });
});

describe("copy sociale (§34–§66)", () => {
  it("nome dell'attore sopra, azione sotto", () => {
    const comment = make();

    expect(notificationPrimaryText(comment)).toBe("Marco Bianchi");
    expect(notificationSecondaryText(comment)).toBe("ha commentato il tuo post");
  });

  it("copy per ogni tipo, singolare", () => {
    const text = (type: string, extra: Partial<InboxNotification> = {}) =>
      notificationSecondaryText(make({ type, ...extra }));

    expect(text("new_follower", { target: { id: "a1", params: {}, type: "profile" } })).toBe(
      "ha iniziato a seguirti",
    );
    expect(text("content_liked")).toBe("ha messo Mi piace al tuo post");
    expect(text("comment_replied", { target: { id: "c", params: {}, type: "comment" } })).toBe(
      "ha risposto al tuo commento",
    );
    expect(text("identity_mentioned", { target: { id: "c", params: {}, type: "comment" } })).toBe(
      "ti ha menzionato in un commento",
    );
    expect(text("identity_mentioned")).toBe("ti ha menzionato in un post");
    expect(text("simple_reposted")).toBe("ha ripostato il tuo post");
    expect(text("post_reposted_with_text")).toBe("ha ripostato il tuo post aggiungendo un testo");
  });

  it("altri tipi di contenuto: «contenuto», non «post»", () => {
    const article = make({
      target: { id: "c1", params: { content_type: "club_media" }, type: "content" },
      type: "content_liked",
    });

    expect(notificationSecondaryText(article)).toBe("ha messo Mi piace al tuo contenuto");
  });

  it("aggregato: «e altre 12 persone hanno messo Mi piace al tuo post» (§40, §63, §130)", () => {
    const liked = make({ eventCount: 13, type: "content_liked" });

    expect(notificationActorSuffix(liked)).toBe("e altre 12 persone");
    expect(notificationSecondaryText(liked)).toBe("e altre 12 persone hanno messo Mi piace al tuo post");
    expect(notificationSecondaryText(make({ eventCount: 2, type: "simple_reposted" }))).toBe(
      "e un'altra persona hanno ripostato il tuo post",
    );
    expect(
      notificationSecondaryText(
        make({ eventCount: 6, target: { id: "a1", params: {}, type: "profile" }, type: "new_follower" }),
      ),
    ).toBe("e altre 5 persone hanno iniziato a seguirti");
    expect(notificationActorSuffix(make({ eventCount: 1 }))).toBeNull();
  });

  it("identità gestita: disambigua col nome della Società (§98, §99, §102)", () => {
    const recipient = { id: "club-1", managed: true, name: "AC Como", type: "society" as const };

    expect(notificationSecondaryText(make({ recipient }))).toBe("ha commentato il post di AC Como");
    expect(notificationSecondaryText(make({ recipient, type: "content_liked" }))).toBe(
      "ha messo Mi piace al post di AC Como",
    );
    expect(
      notificationSecondaryText(make({ recipient, target: { id: "c", params: {}, type: "comment" }, type: "comment_replied" })),
    ).toBe("ha risposto al commento di AC Como");
    expect(
      notificationSecondaryText(
        make({ recipient, target: { id: "a1", params: {}, type: "profile" }, type: "new_follower" }),
      ),
    ).toBe("ha iniziato a seguire AC Como");
    expect(
      notificationSecondaryText(
        make({ recipient, target: { id: "c", params: {}, type: "comment" }, type: "identity_mentioned" }),
      ),
    ).toBe("ha menzionato AC Como in un commento");
  });

  it("Società gestita senza nome: ripiego sul «tuo», mai un nome inventato", () => {
    const recipient = { id: "club-1", managed: true, name: null, type: "society" as const };

    expect(notificationSecondaryText(make({ recipient }))).toBe("ha commentato il tuo post");
  });

  it("attore Società: il nome è quello della Società, non dell'amministratore (§95)", () => {
    const actor = { available: true, avatarUrl: null, id: "club", name: "AC Como", type: "society" as const, verified: true };

    expect(notificationPrimaryText(make({ actor }))).toBe("AC Como");
  });

  it("attore non disponibile: ripiego neutro, nessun crash (§266)", () => {
    const gone = make({
      actor: { available: false, avatarUrl: null, id: "a1", name: null, type: "person", verified: false },
    });

    expect(notificationActorName(gone)).toBe("Un utente");
    expect(notificationPrimaryText(gone)).toBe("Un utente");
    expect(notificationSecondaryText(gone)).toBe("ha commentato il tuo post");
  });

  it("anteprima: spazi e vuoti diventano null (§262)", () => {
    expect(notificationPreview({ preview: "  Grande progetto  " })).toBe("Grande progetto");
    expect(notificationPreview({ preview: "   " })).toBeNull();
    expect(notificationPreview({ preview: null })).toBeNull();
  });
});

describe("tipi senza attore", () => {
  it("operativi: titolo e corpo del server, invariati", () => {
    const application = make({
      actor: null,
      body: "Stato aggiornato",
      target: null,
      title: "Candidatura accettata",
      type: "application_status",
    });

    expect(notificationPrimaryText(application)).toBe("Candidatura accettata");
    expect(notificationSecondaryText(application)).toBe("Stato aggiornato");
  });

  it("programmati: frasi del §86 e §88, con il contesto della Società gestita", () => {
    const published = make({ actor: null, type: "scheduled_content_published" });
    const failed = make({ actor: null, type: "scheduled_content_failed" });
    const recipient = { id: "club-1", managed: true, name: "AC Como", type: "society" as const };

    expect(notificationPrimaryText(published)).toBe("Il contenuto programmato è stato pubblicato");
    expect(notificationPrimaryText(failed)).toBe("Non è stato possibile pubblicare un contenuto programmato");
    expect(notificationPrimaryText({ ...published, recipient })).toBe(
      "Il contenuto programmato di AC Como è stato pubblicato",
    );
  });

  it("riga storica di follow senza attore: resta il titolo del server", () => {
    const legacy = make({ actor: null, target: null, title: "Mario Rossi", type: "new_follower" });

    expect(notificationPrimaryText(legacy)).toBe("Mario Rossi");
  });
});

describe("accessibilità (§248–§249)", () => {
  it("attore, azione, anteprima, tempo e «Non aperta» a parole", () => {
    const label = notificationAccessibilityLabel(
      make({ displayAt: new Date(2026, 10, 16, 10, 0, 0).toISOString(), preview: "Grande progetto" }),
      NOW,
    );

    expect(label).toBe(
      "Marco Bianchi ha commentato il tuo post. Anteprima: Grande progetto. 2 ore fa. Non aperta",
    );
  });

  it("riga operativa: titolo e corpo sono due frasi separate", () => {
    const label = notificationAccessibilityLabel(
      make({
        actor: null,
        body: "La tua candidatura è stata accettata",
        category: "candidature",
        displayAt: new Date(2026, 10, 16, 11, 59, 30).toISOString(),
        isOpened: true,
        target: null,
        title: "Candidatura accettata",
        type: "application_status",
      }),
      NOW,
    );

    expect(label).toBe("Candidatura accettata. La tua candidatura è stata accettata. adesso");
  });

  it("una riga aperta non dichiara «Non aperta»", () => {
    const label = notificationAccessibilityLabel(
      make({ displayAt: new Date(2026, 10, 16, 11, 59, 30).toISOString(), isOpened: true }),
      NOW,
    );

    expect(label).toBe("Marco Bianchi ha commentato il tuo post. adesso");
  });

  it("aggregato e identità gestita nella stessa frase", () => {
    const label = notificationAccessibilityLabel(
      make({
        eventCount: 13,
        recipient: { id: "club-1", managed: true, name: "AC Como", type: "society" },
        type: "content_liked",
      }),
      NOW,
    );

    expect(label.startsWith("Marco Bianchi e altre 12 persone hanno messo Mi piace al post di AC Como.")).toBe(true);
  });
});
