import { describe, expect, it } from "vitest";

import {
  OTHER_ACTIVITY_SECTION,
  PUSH_INTERACTION_SECTION,
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
    new_followers: false,
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

  it("ignora valori non booleani e chiavi sconosciute", () => {
    const parsed = parseNotificationPreferences({ push: { mentions: "no", messages: false }, other: null });

    expect(parsed.push.mentions).toBe(true);
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
