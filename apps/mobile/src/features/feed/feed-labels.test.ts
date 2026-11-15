/**
 * Il copy del menu dopo HOM-11: niente più «Nascondi» né messaggi «arriverà presto» per
 * Non mi interessa, Non seguire e Segnala (HOM-11 §1–§3, §49, §229).
 */
import { describe, expect, it } from "vitest";

import { FEED_MENU_LABELS, FEED_SOON_MESSAGES } from "./feed-labels";

describe("feed-labels — pulizia HOM-11", () => {
  it("le etichette del menu restano solo Salva / Rimuovi dai salvati (HOM-07): il resto ha il suo modulo", () => {
    expect(FEED_MENU_LABELS).toEqual({ save: "Salva", unsave: "Rimuovi dai salvati" });
  });

  it("nessun messaggio «arriverà presto» per le azioni ora reali; resta solo quello del Mi piace legacy", () => {
    expect(Object.keys(FEED_SOON_MESSAGES)).toEqual(["like"]);
  });

  it("«Nascondi» non esiste: la spec distingue Non mi interessa, Non seguire e Segnala", () => {
    expect(JSON.stringify(FEED_MENU_LABELS)).not.toContain("Nascondi");
  });
});
