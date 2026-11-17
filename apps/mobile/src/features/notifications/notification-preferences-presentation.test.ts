import { describe, expect, it } from "vitest";

import {
  DEFAULT_PUSH_PREFERENCES,
  OTHER_ACTIVITY_SECTION,
  PUSH_INTERACTION_SECTION,
  PUSH_MESSAGES_SECTION,
  PUSH_PUBLISHING_SECTION,
  applyPreferenceChange,
  isPushPreferenceKey,
  parseNotificationPreferences,
  readPreference,
} from "./notification-preferences-presentation";

const FULL = {
  other: { applications: false, content_tags: true, promotions: false, requests: true, store: true },
  push: {
    comments_replies: false,
    likes: true,
    mentions: true,
    message_preview: false,
    new_followers: false,
    push_messages: true,
    reposts: true,
    scheduled_content: false,
  },
};

describe("parseNotificationPreferences", () => {
  it("legge il jsonb {push, other} del backend", () => {
    expect(parseNotificationPreferences(FULL)).toEqual(FULL);
  });

  it("accetta il jsonb avvolto in array", () => {
    expect(parseNotificationPreferences([FULL])).toEqual(FULL);
  });

  it("completa le chiavi mancanti coi default HOM-14 (Mi piace OFF, il resto ON)", () => {
    const parsed = parseNotificationPreferences({ push: { mentions: false } });

    expect(parsed.push.mentions).toBe(false);
    expect(parsed.push.likes).toBe(false);
    expect(parsed.push.comments_replies).toBe(true);
    expect(parsed.push.scheduled_content).toBe(true);
    expect(parsed.other.requests).toBe(true);
  });

  it("Messaggi e Mostra anteprima: acceso se il backend non li manda ancora (DAS-REV-34 §15)", () => {
    const parsed = parseNotificationPreferences({ push: { mentions: false } });

    expect(parsed.push.push_messages).toBe(true);
    expect(parsed.push.message_preview).toBe(true);
  });

  it("legge `push.push_messages` e `push.message_preview`", () => {
    expect(
      parseNotificationPreferences({ push: { message_preview: false, push_messages: false } }).push,
    ).toMatchObject({ message_preview: false, push_messages: false });
  });

  it("ignora valori non booleani e chiavi sconosciute", () => {
    const parsed = parseNotificationPreferences({
      other: null,
      push: { mentions: "no", messages: false, push_messages: "no" },
    });

    expect(parsed.push.mentions).toBe(true);
    expect(parsed.push.push_messages).toBe(true);
    expect(parsed.push).not.toHaveProperty("messages");
    expect(parsed.other.store).toBe(true);
  });

  it("un valore non oggetto è un errore, non un default silenzioso", () => {
    expect(() => parseNotificationPreferences(null)).toThrow();
    expect(() => parseNotificationPreferences("x")).toThrow();
    expect(() => parseNotificationPreferences([])).toThrow();
  });
});

describe("applyPreferenceChange", () => {
  it("cambia una chiave push senza toccare le altre né l'originale", () => {
    const parsed = parseNotificationPreferences(FULL);
    const next = applyPreferenceChange(parsed, "mentions", false);

    expect(next.push.mentions).toBe(false);
    expect(next.push.likes).toBe(true);
    expect(next.other).toEqual(parsed.other);
    expect(parsed.push.mentions).toBe(true);
  });

  it("cambia una chiave operativa nel gruppo other", () => {
    const next = applyPreferenceChange(parseNotificationPreferences(FULL), "requests", false);

    expect(next.other.requests).toBe(false);
    expect(readPreference(next, "requests")).toBe(false);
    expect(readPreference(next, "likes")).toBe(true);
  });

  it("cambia Messaggi o Mostra anteprima senza toccare l'altro interruttore", () => {
    const parsed = parseNotificationPreferences(FULL);
    const off = applyPreferenceChange(parsed, "push_messages", false);
    const on = applyPreferenceChange(parsed, "message_preview", true);

    expect(off.push.push_messages).toBe(false);
    expect(off.push.message_preview).toBe(false);
    expect(on.push.message_preview).toBe(true);
    expect(on.push.push_messages).toBe(true);
    expect(readPreference(off, "push_messages")).toBe(false);
    expect(parsed.push.push_messages).toBe(true);
  });
});

describe("sezione Messaggi (DAS-REV-34 §15–§17)", () => {
  it("due interruttori: «Messaggi» e «Mostra anteprima», con l'aiuto che dice cosa controllano", () => {
    expect(PUSH_MESSAGES_SECTION.eyebrow).toBe("Messaggi");
    expect(PUSH_MESSAGES_SECTION.rows).toEqual([
      {
        key: "push_messages",
        label: "Messaggi",
        subtitle: "Notifiche push dei nuovi messaggi in chat e gruppi",
      },
      { key: "message_preview", label: "Mostra anteprima", subtitle: "Mostra mittente e testo nella notifica" },
    ]);
  });

  it("sono preferenze push: restano visibili ma non modificabili col permesso OS negato", () => {
    expect(isPushPreferenceKey("push_messages")).toBe(true);
    expect(isPushPreferenceKey("message_preview")).toBe(true);
  });

  it("i default sono entrambi accesi", () => {
    expect(DEFAULT_PUSH_PREFERENCES.push_messages).toBe(true);
    expect(DEFAULT_PUSH_PREFERENCES.message_preview).toBe(true);
  });
});

describe("sezioni (§187-§188, §201)", () => {
  it("Interazioni e Pubblicazione hanno le righe della spec, senza Messaggi", () => {
    expect(PUSH_INTERACTION_SECTION.rows.map((row) => row.key)).toEqual([
      "comments_replies",
      "mentions",
      "reposts",
      "new_followers",
      "likes",
    ]);
    expect(PUSH_PUBLISHING_SECTION.rows.map((row) => row.key)).toEqual(["scheduled_content"]);

    const labels = [...PUSH_INTERACTION_SECTION.rows, ...PUSH_PUBLISHING_SECTION.rows].map(
      (row) => row.label,
    );
    expect(labels).not.toContain("Messaggi");
  });

  it("le righe push non si ripetono in Altre attività", () => {
    for (const row of OTHER_ACTIVITY_SECTION.rows) {
      expect(isPushPreferenceKey(row.key)).toBe(false);
    }
  });
});
