import { describe, expect, it } from "vitest";

import { buildData, buildMessages, chunk, summarizeTickets, type ClaimedDelivery } from "./expo-push";

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

// DAS-REV-34 §15, DOD-025: push di conversazione sulla stessa coda.
const chat = (over: Partial<ClaimedDelivery> = {}): ClaimedDelivery => ({
  d_id: 2,
  d_notification_id: null,
  d_recipient: "u1",
  d_priority: "high",
  d_title: "Staff Primavera",
  d_body: "Mister Bianchi: Domani allenamento alle 18:00",
  d_data: { conversation_id: "c1", period_id: "p1", kind: "message" },
  d_tokens: [{ device_id: "a", token: "ExponentPushToken[aaa]" }],
  d_kind: "chat_message",
  d_thread_id: "c1",
  d_ttl_seconds: 21500,
  ...over,
});

describe("buildMessages — push di conversazione", () => {
  it("dati = solo conversation_id, period_id e kind; threadId = conversation_id; ttl residuo", () => {
    const [m] = buildMessages(chat());
    expect(m.data).toEqual({ conversation_id: "c1", period_id: "p1", kind: "message" });
    expect(m.threadId).toBe("c1");
    expect(m.ttl).toBe(21500);
    expect(m.priority).toBe("high");
    expect(Object.keys(m).sort()).toEqual(
      ["body", "channelId", "data", "priority", "sound", "threadId", "title", "to", "ttl"].sort(),
    );
  });

  it("mai collapseId: sostituirebbe messaggi distinti della stessa chat", () => {
    for (const d of [chat(), chat({ d_kind: "group_lifecycle", d_data: { conversation_id: "c1", period_id: "p1", kind: "lifecycle" } })]) {
      const [m] = buildMessages(d);
      expect("collapseId" in m).toBe(false);
    }
  });

  it("lifecycle: kind 'lifecycle', stesso thread", () => {
    const [m] = buildMessages(chat({ d_kind: "group_lifecycle", d_data: { conversation_id: "c1", period_id: "p1", kind: "lifecycle" }, d_body: "Il gruppo è stato archiviato." }));
    expect(m.data).toEqual({ conversation_id: "c1", period_id: "p1", kind: "lifecycle" });
    expect(m.threadId).toBe("c1");
  });

  it("DIRECT senza periodo: period_id null, senza titolo ripiega su ProLink", () => {
    const [m] = buildMessages(chat({ d_title: null, d_body: "Nuovo messaggio", d_data: { conversation_id: "c1", period_id: null, kind: "message" } }));
    expect(m.title).toBe("ProLink");
    expect(m.body).toBe("Nuovo messaggio");
    expect((m.data as { period_id: string | null }).period_id).toBeNull();
  });

  it("whitelist: chiavi extra dal database (testo, nome) non arrivano al dispositivo", () => {
    const leaky = chat({
      d_data: { conversation_id: "c1", period_id: "p1", kind: "message", body: "segreto", sender_name: "Mario" } as ClaimedDelivery["d_data"],
    });
    const [m] = buildMessages(leaky);
    expect(Object.keys(m.data).sort()).toEqual(["conversation_id", "kind", "period_id"]);
    expect(JSON.stringify(m.data)).not.toContain("segreto");
  });

  it("ttl non valido (0, negativo, null) viene omesso; threadId vuoto omesso", () => {
    for (const ttl of [0, -5, null]) {
      expect("ttl" in buildMessages(chat({ d_ttl_seconds: ttl }))[0]).toBe(false);
    }
    expect("threadId" in buildMessages(chat({ d_thread_id: "  " }))[0]).toBe(false);
  });

  it("notifica strutturale: data = notification_id, threadId = conversazione, ttl strutturale", () => {
    const [m] = buildMessages(
      delivery({ d_title: "Sei stato aggiunto al gruppo Staff Primavera", d_body: null, d_kind: "notification", d_thread_id: "c1", d_ttl_seconds: 86400 }),
    );
    expect(m.data).toEqual({ notification_id: "n1" });
    expect(m.threadId).toBe("c1");
    expect(m.ttl).toBe(86400);
  });

  it("notifica social senza thread né ttl: forma invariata (compatibilità con la claim precedente)", () => {
    const [m] = buildMessages(delivery());
    expect("threadId" in m).toBe(false);
    expect("ttl" in m).toBe(false);
    expect(buildData(delivery())).toEqual({ notification_id: "n1" });
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
