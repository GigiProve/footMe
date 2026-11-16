import { describe, expect, it } from "vitest";

import { buildMessages, chunk, summarizeTickets, type ClaimedDelivery } from "./expo-push";

const delivery = (over: Partial<ClaimedDelivery> = {}): ClaimedDelivery => ({
  d_id: 1,
  d_notification_id: "n1",
  d_recipient: "u1",
  d_priority: "medium",
  d_title: "Nuovo commento",
  d_body: "Marco Bianchi ha commentato il tuo contenuto",
  d_data: { notification_id: "n1" },
  d_tokens: [
    { device_id: "a", token: "ExponentPushToken[aaa]" },
    { device_id: "b", token: "ExponentPushToken[bbb]" },
  ],
  ...over,
});

describe("buildMessages", () => {
  it("un messaggio per dispositivo con il solo notification_id nei dati", () => {
    const messages = buildMessages(delivery());
    expect(messages).toHaveLength(2);
    expect(messages[0].data).toEqual({ notification_id: "n1" });
    expect(Object.keys(messages[0]).sort()).toEqual(
      ["body", "channelId", "data", "priority", "sound", "title", "to"].sort(),
    );
  });

  it("HIGH esce con priorità alta, gli altri default", () => {
    expect(buildMessages(delivery({ d_priority: "high" }))[0].priority).toBe("high");
    expect(buildMessages(delivery({ d_priority: "low" }))[0].priority).toBe("default");
  });

  it("senza titolo ripiega su ProLink e omette il corpo vuoto", () => {
    const [m] = buildMessages(delivery({ d_title: null, d_body: null, d_tokens: [{ device_id: "a", token: "ExpoPushToken[x]" }] }));
    expect(m.title).toBe("ProLink");
    expect("body" in m).toBe(false);
  });
});

describe("chunk", () => {
  it("spezza in lotti", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe("summarizeTickets", () => {
  const messages = buildMessages(delivery());

  it("inviata se almeno un ticket è ok; disattiva i token non registrati", () => {
    const out = summarizeTickets(messages, [
      { status: "ok" },
      { status: "error", details: { error: "DeviceNotRegistered" } },
    ]);
    expect(out).toEqual({ status: "sent", reason: null, invalidTokens: ["ExponentPushToken[bbb]"] });
  });

  it("riprova se non c'è alcun ticket ok e l'errore è transitorio", () => {
    expect(summarizeTickets(messages, [null, null]).status).toBe("retry");
    expect(
      summarizeTickets(messages, [
        { status: "error", details: { error: "MessageRateExceeded" } },
        { status: "error", details: { error: "MessageRateExceeded" } },
      ]).status,
    ).toBe("retry");
  });

  it("fallisce se tutti i token sono morti", () => {
    const out = summarizeTickets(messages, [
      { status: "error", details: { error: "DeviceNotRegistered" } },
      { status: "error", details: { error: "DeviceNotRegistered" } },
    ]);
    expect(out.status).toBe("failed");
    expect(out.invalidTokens).toHaveLength(2);
  });
});
