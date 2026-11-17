/**
 * Fallback 11/12 (DAS-REV-34 §22): copy esatti, lettura del parametro e route.
 */
import { describe, expect, it } from "vitest";

import { conversationUnavailableRoute } from "./messaging-routes";
import {
  UNAVAILABLE_BACK_LABEL,
  UNAVAILABLE_COPY,
  unavailableReasonForRevocation,
  unavailableReasonOf,
} from "./unavailable-presentation";

describe("copy del fallback", () => {
  it("accesso revocato (PNG 11)", () => {
    expect(UNAVAILABLE_COPY.revoked).toEqual({
      body: "Non puoi più accedere alla conversazione.",
      title: "Non fai più parte di questo gruppo",
    });
  });

  it("gruppo eliminato (PNG 12)", () => {
    expect(UNAVAILABLE_COPY.deleted).toEqual({
      body: "Questa conversazione non è più disponibile.",
      title: "Il gruppo è stato eliminato",
    });
  });

  it("caso neutro dei link storici e delle Push", () => {
    expect(UNAVAILABLE_COPY.unavailable).toEqual({
      body: null,
      title: "Questa conversazione non è più disponibile.",
    });
  });

  it("la CTA primaria è «Torna ai messaggi»", () => {
    expect(UNAVAILABLE_BACK_LABEL).toBe("Torna ai messaggi");
  });
});

describe("motivo di route", () => {
  it("legge revoked e deleted; qualunque altro valore è il caso neutro", () => {
    expect(unavailableReasonOf("revoked")).toBe("revoked");
    expect(unavailableReasonOf("deleted")).toBe("deleted");
    expect(unavailableReasonOf("unavailable")).toBe("unavailable");
    expect(unavailableReasonOf("qualcosa")).toBe("unavailable");
    expect(unavailableReasonOf(undefined)).toBe("unavailable");
    expect(unavailableReasonOf(["deleted", "revoked"])).toBe("deleted");
  });

  it("una revoca osservata dalla chat sceglie il motivo giusto", () => {
    expect(unavailableReasonForRevocation("ended")).toBe("revoked");
    expect(unavailableReasonForRevocation("deleted")).toBe("deleted");
  });

  it("la route porta il solo motivo, mai un nome o un id", () => {
    expect(conversationUnavailableRoute("revoked")).toBe("/messages/unavailable?reason=revoked");
    expect(conversationUnavailableRoute("deleted")).toBe("/messages/unavailable?reason=deleted");
    expect(conversationUnavailableRoute("unavailable")).toBe("/messages/unavailable?reason=unavailable");
  });
});
