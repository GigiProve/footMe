import { describe, expect, it } from "vitest";

import {
  conversationChatHref,
  conversationFallbackHref,
  conversationLinkFromParams,
  conversationLinkFromTarget,
  conversationOutcomeHref,
  conversationPendingHref,
  conversationTypeOf,
  isDeniedOutcome,
  parseConversationOutcome,
  parseConversationResolution,
} from "./conversation-target-presentation";

const CONVERSATION = "3f8c1b5e-1d2a-4c3b-9a7e-0123456789ab";
const PERIOD = "9f8c1b5e-1d2a-4c3b-9a7e-0123456789ab";

describe("conversationLinkFromTarget (§25)", () => {
  it("legge periodo e intento dai params del target", () => {
    expect(
      conversationLinkFromTarget({ id: CONVERSATION, params: { intent: "role", period_id: PERIOD } }),
    ).toEqual({ conversationId: CONVERSATION, intent: "role", periodId: PERIOD });
  });

  it("un intento mancante o sconosciuto vale `message`: non concede nulla, decide il server", () => {
    expect(conversationLinkFromTarget({ id: CONVERSATION, params: {} })?.intent).toBe("message");
    expect(conversationLinkFromTarget({ id: CONVERSATION, params: { intent: "admin" } })?.intent).toBe("message");
  });

  it("scarta id e periodo che non sono uuid", () => {
    expect(conversationLinkFromTarget({ id: "../settings", params: {} })).toBeNull();
    expect(conversationLinkFromTarget({ id: CONVERSATION, params: { period_id: "x&y=1" } })).toBeNull();
  });

  it("un periodo null è una DIRECT", () => {
    expect(conversationLinkFromTarget({ id: CONVERSATION, params: { period_id: null } })?.periodId).toBeNull();
  });
});

describe("parseConversationOutcome", () => {
  it("accetta i cinque esiti, anche avvolti in array", () => {
    for (const outcome of ["open", "info", "revoked", "deleted", "unavailable"] as const) {
      expect(parseConversationOutcome({ conversation_id: CONVERSATION, outcome })).toBe(outcome);
      expect(parseConversationOutcome([{ outcome }])).toBe(outcome);
    }
  });

  it("una forma sconosciuta non è un esito", () => {
    expect(parseConversationOutcome(null)).toBeNull();
    expect(parseConversationOutcome({})).toBeNull();
    expect(parseConversationOutcome({ outcome: "granted" })).toBeNull();
    expect(parseConversationOutcome("open")).toBeNull();
  });
});

describe("parseConversationResolution", () => {
  it("legge conversation_type dal server (minuscolo) e lo porta in DIRECT | GROUP", () => {
    expect(parseConversationResolution({ conversation_type: "group", outcome: "open" })).toEqual({
      conversationType: "GROUP",
      outcome: "open",
    });
    expect(parseConversationResolution({ conversation_type: "direct", outcome: "unavailable" })).toEqual({
      conversationType: "DIRECT",
      outcome: "unavailable",
    });
  });

  it("conversation_type null, assente o sconosciuto resta null (nessuna deduzione dal link)", () => {
    expect(parseConversationResolution({ conversation_type: null, outcome: "unavailable" })?.conversationType).toBeNull();
    expect(parseConversationResolution({ outcome: "open" })?.conversationType).toBeNull();
    expect(parseConversationResolution({ conversation_type: "channel", outcome: "open" })?.conversationType).toBeNull();
    expect(parseConversationResolution({ conversation_type: "group" })).toBeNull();
  });
});

describe("destinazione dell'esito (§25, screen 11/12)", () => {
  it("open → chat, info → Info gruppo", () => {
    expect(conversationOutcomeHref("open", CONVERSATION)).toBe(conversationChatHref(CONVERSATION));
    expect(conversationOutcomeHref("open", CONVERSATION)).toBe(`/messages/${CONVERSATION}`);
    expect(conversationOutcomeHref("info", CONVERSATION)).toBe(`/group-info/${CONVERSATION}`);
  });

  it("revoked / deleted / unavailable → fallback col motivo, senza l'id della conversazione", () => {
    for (const reason of ["revoked", "deleted", "unavailable"] as const) {
      expect(conversationOutcomeHref(reason, CONVERSATION)).toBe(`/messages/unavailable?reason=${reason}`);
      expect(conversationFallbackHref(reason)).not.toContain(CONVERSATION);
      expect(isDeniedOutcome(reason)).toBe(true);
    }
    expect(isDeniedOutcome("open")).toBe(false);
    expect(isDeniedOutcome("info")).toBe(false);
  });
});

describe("conversationTypeOf (§27)", () => {
  it("vale il tipo del server", () => {
    expect(conversationTypeOf("GROUP")).toBe("GROUP");
    expect(conversationTypeOf("DIRECT")).toBe("DIRECT");
  });

  it("con null (estraneo o id inesistente) non si deduce nulla: `unknown`", () => {
    expect(conversationTypeOf(null)).toBe("unknown");
  });
});

describe("path opaco dopo il login (§293)", () => {
  it("porta solo identificativi e torna uguale dai parametri della route", () => {
    const link = { conversationId: CONVERSATION, intent: "lifecycle", periodId: PERIOD } as const;
    const href = conversationPendingHref(link);

    expect(href).toBe(`/notifications?conversation=${CONVERSATION}&intent=lifecycle&period=${PERIOD}`);
    expect(conversationLinkFromParams({ conversation: CONVERSATION, intent: "lifecycle", period: PERIOD })).toEqual(
      link,
    );
  });

  it("una DIRECT non porta il periodo", () => {
    expect(conversationPendingHref({ conversationId: CONVERSATION, intent: "message", periodId: null })).toBe(
      `/notifications?conversation=${CONVERSATION}&intent=message`,
    );
  });

  it("i parametri manomessi non diventano un link", () => {
    expect(conversationLinkFromParams({ conversation: "abc" })).toBeNull();
    expect(conversationLinkFromParams({ conversation: null })).toBeNull();
    expect(conversationLinkFromParams({ conversation: CONVERSATION, period: "no" })).toBeNull();
    expect(conversationLinkFromParams({ conversation: CONVERSATION, intent: "boh" })?.intent).toBe("message");
  });
});
