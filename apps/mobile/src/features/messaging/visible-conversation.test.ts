/**
 * Conversazione visibile (DAS-REV-34 §16): una sola, azzerabile, e lo
 * smontaggio di una chat non cancella l'id della chat che l'ha sostituita.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  clearVisibleConversation,
  getVisibleConversationId,
  setVisibleConversation,
} from "./visible-conversation";

afterEach(() => setVisibleConversation(null));

describe("visible-conversation", () => {
  it("parte vuota", () => {
    expect(getVisibleConversationId()).toBeNull();
  });

  it("imposta e azzera", () => {
    setVisibleConversation("c1");
    expect(getVisibleConversationId()).toBe("c1");

    setVisibleConversation(null);
    expect(getVisibleConversationId()).toBeNull();
  });

  it("clearVisibleConversation azzera solo la propria conversazione", () => {
    setVisibleConversation("c2");

    clearVisibleConversation("c1");
    expect(getVisibleConversationId()).toBe("c2");

    clearVisibleConversation("c2");
    expect(getVisibleConversationId()).toBeNull();
  });
});
