/**
 * Bozza del flow e target segnalati: bozza per target che sopravvive agli errori, insieme di
 * sessione che nasconde il segnalato al solo reporter, svuotamento al logout (HOM-11 §98–§99,
 * §123–§125, §131, §157, §176, §184, §273–§275).
 */
import { describe, expect, it, vi } from "vitest";

import { chooseCategory, setDetails } from "./moderation-presentation";
import { createReportDraftStore } from "./report-draft-store";
import { createReportedStore } from "./reported-store";

describe("createReportDraftStore — §98–§99, §157", () => {
  it("senza bozza ne vale una vuota, con identità stabile", () => {
    const store = createReportDraftStore();

    expect(store.get("COMMENT:c-1")).toBe(store.get("COMMENT:c-2"));
    expect(store.get("COMMENT:c-1")).toMatchObject({ categoryId: null, details: "", operationKey: null });
    expect(store.has("COMMENT:c-1")).toBe(false);
  });

  it("la bozza è per target: due segnalazioni non si mescolano", () => {
    const store = createReportDraftStore();

    store.update("COMMENT:c-1", (draft) => chooseCategory(draft, "spam"));
    store.update("CONTENT:club_media:p-1", (draft) => setDetails(draft, "altro testo"));

    expect(store.get("COMMENT:c-1")).toMatchObject({ categoryId: "spam", details: "" });
    expect(store.get("CONTENT:club_media:p-1")).toMatchObject({ categoryId: null, details: "altro testo" });
  });

  it("categoria, sottocategoria, testo e chiave restano fra un tentativo e l'altro", () => {
    const store = createReportDraftStore();

    store.update("COMMENT:c-1", (draft) => ({
      ...chooseCategory(draft, "spam"),
      attemptedFingerprint: "fp",
      details: "testo",
      operationKey: "k-1",
      subcategoryId: "spam.scam",
    }));

    // Errore di rete: nessuno svuotamento, il retry riparte da qui (§99, §157).
    expect(store.get("COMMENT:c-1")).toEqual({
      attemptedFingerprint: "fp",
      categoryId: "spam",
      details: "testo",
      operationKey: "k-1",
      subcategoryId: "spam.scam",
    });
  });

  it("clear: a flow concluso la bozza sparisce", () => {
    const store = createReportDraftStore();
    store.update("COMMENT:c-1", (draft) => chooseCategory(draft, "spam"));

    store.clear("COMMENT:c-1");

    expect(store.has("COMMENT:c-1")).toBe(false);
    expect(store.get("COMMENT:c-1").categoryId).toBeNull();
  });

  it("notifica solo i listener di quel target", () => {
    const store = createReportDraftStore();
    const mine = vi.fn();
    const other = vi.fn();
    store.subscribe("COMMENT:c-1", mine);
    store.subscribe("COMMENT:c-2", other);

    store.update("COMMENT:c-1", (draft) => chooseCategory(draft, "spam"));

    expect(mine).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  it("clearAll: il testo privato di un utente non compare all'altro (§184)", () => {
    const store = createReportDraftStore();
    store.update("COMMENT:c-1", (draft) => setDetails(draft, "testo privato"));

    store.clearAll();

    expect(store.get("COMMENT:c-1").details).toBe("");
  });
});

describe("createReportedStore — §123–§125, §131", () => {
  it("add e has: il segnalato è tale per il reporter", () => {
    const store = createReportedStore();

    store.add("CONTENT:club_media:p-1");

    expect(store.has("CONTENT:club_media:p-1")).toBe(true);
    expect(store.has("CONTENT:club_media:p-2")).toBe(false);
  });

  it("add è idempotente: un secondo add non notifica né cambia versione", () => {
    const store = createReportedStore();
    const listener = vi.fn();
    store.add("COMMENT:c-1");
    store.subscribeAll(listener);
    const version = store.version();

    store.add("COMMENT:c-1");

    expect(listener).not.toHaveBeenCalled();
    expect(store.version()).toBe(version);
  });

  it("notifica per target e, per le liste che filtrano, a ogni cambio", () => {
    const store = createReportedStore();
    const mine = vi.fn();
    const other = vi.fn();
    const all = vi.fn();
    store.subscribe("COMMENT:c-1", mine);
    store.subscribe("COMMENT:c-2", other);
    store.subscribeAll(all);

    store.add("COMMENT:c-1");

    expect(mine).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    expect(all).toHaveBeenCalledTimes(1);
  });

  it("clear: un account nuovo non eredita i segnalati del precedente", () => {
    const store = createReportedStore();
    const listener = vi.fn();
    store.add("COMMENT:c-1");
    store.subscribeAll(listener);

    store.clear();

    expect(store.has("COMMENT:c-1")).toBe(false);
    expect(listener).toHaveBeenCalled();
  });
});
