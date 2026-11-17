/**
 * Conferma di lettura (DAS-REV-34 §11, §14, §16): solo con la chat visibile,
 * fino alla sequence più alta caricata, con il periodo nei GROUP, mai ripetuta.
 */
import { describe, expect, it } from "vitest";

import { decideReadAck, maxLoadedSeq } from "./read-state-presentation";

const base = {
  isGroup: false,
  isReady: true,
  isRevoked: false,
  isVisible: true,
  lastAckedSeq: null,
  messages: [{ seq: 3 }, { seq: 8 }, { seq: 5 }],
  periodId: null,
} as const;

describe("maxLoadedSeq", () => {
  it("prende la sequence più alta, anche fuori ordine", () => {
    expect(maxLoadedSeq([{ seq: 3 }, { seq: 8 }, { seq: 5 }])).toBe(8);
  });

  it("ignora i messaggi senza seq; senza nessuna è null", () => {
    expect(maxLoadedSeq([{ seq: undefined }, { seq: 2 }])).toBe(2);
    expect(maxLoadedSeq([{ seq: undefined }])).toBeNull();
    expect(maxLoadedSeq([])).toBeNull();
  });
});

describe("decideReadAck", () => {
  it("DIRECT visibile: ack fino alla sequence più alta caricata, senza periodo", () => {
    expect(decideReadAck(base)).toEqual({ action: "ack", periodId: null, upToSeq: 8 });
  });

  it("GROUP: l'ack porta il periodo osservato", () => {
    expect(decideReadAck({ ...base, isGroup: true, periodId: "p1" })).toEqual({
      action: "ack",
      periodId: "p1",
      upToSeq: 8,
    });
  });

  it("GROUP senza periodo noto: si attende il meta, nessun ack che il server non possa validare", () => {
    expect(decideReadAck({ ...base, isGroup: true, periodId: null })).toEqual({ action: "none" });
  });

  it("chat non visibile (blur, app in background) o non pronta: nessun ack (QA-019)", () => {
    expect(decideReadAck({ ...base, isVisible: false })).toEqual({ action: "none" });
    expect(decideReadAck({ ...base, isReady: false })).toEqual({ action: "none" });
  });

  it("accesso revocato: nessun ack", () => {
    expect(decideReadAck({ ...base, isRevoked: true })).toEqual({ action: "none" });
  });

  it("nessun messaggio: niente da confermare", () => {
    expect(decideReadAck({ ...base, messages: [] })).toEqual({ action: "none" });
  });

  it("il confine avanza soltanto: stessa o minore sequence già confermata non rimanda l'ack", () => {
    expect(decideReadAck({ ...base, lastAckedSeq: 8 })).toEqual({ action: "none" });
    expect(decideReadAck({ ...base, lastAckedSeq: 9 })).toEqual({ action: "none" });
    expect(decideReadAck({ ...base, lastAckedSeq: 5 })).toEqual({ action: "ack", periodId: null, upToSeq: 8 });
  });

  it("un nuovo messaggio arrivato dopo l'ack porta il confine in avanti, non azzera alla cieca", () => {
    expect(decideReadAck({ ...base, lastAckedSeq: 8, messages: [{ seq: 8 }, { seq: 9 }] })).toEqual({
      action: "ack",
      periodId: null,
      upToSeq: 9,
    });
  });

  it("payload senza seq (server precedente): ripiego sulla RPC compatibile", () => {
    // §11: niente ripiego su mark_conversation_read, che leggerebbe fino al max server.
    expect(decideReadAck({ ...base, messages: [{ seq: undefined }] })).toEqual({ action: "none" });
  });
});
