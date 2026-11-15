/**
 * Store di sessione dei contenuti nascosti: hide ottimistico, conferma, rollback, Annulla,
 * motivo, epoch al logout (HOM-11 §29–§36, §51, §168–§170, §176).
 */
import { describe, expect, it, vi } from "vitest";

import { createHiddenContentStore } from "./hidden-content-store";

const KEY = "club_media:p1";

describe("createHiddenContentStore", () => {
  it("§29: nasconde subito — la cella nasce `pending`, senza feedback né motivo", () => {
    const store = createHiddenContentStore();

    const attempt = store.begin(KEY);

    expect(attempt).not.toBeNull();
    expect(store.get(KEY)).toEqual({ attempt, feedbackId: null, phase: "pending", reasonId: null });
  });

  it("doppio tap: un secondo begin sullo stesso target non crea un secondo tentativo (§177)", () => {
    const store = createHiddenContentStore();

    expect(store.begin(KEY)).not.toBeNull();
    expect(store.begin(KEY)).toBeNull();
  });

  it("settle: confermato dal server, la cella è `hidden` con il feedback_id", () => {
    const store = createHiddenContentStore();
    const attempt = store.begin(KEY) as number;

    expect(store.settle(KEY, attempt, "f-1")).toBe("settled");
    expect(store.get(KEY)).toMatchObject({ feedbackId: "f-1", phase: "hidden" });
  });

  it("fail: rollback (§51) — la cella sparisce e il contenuto torna", () => {
    const store = createHiddenContentStore();
    const attempt = store.begin(KEY) as number;

    expect(store.fail(KEY, attempt)).toBe(true);
    expect(store.get(KEY)).toBeUndefined();
    expect(store.has(KEY)).toBe(false);
  });

  it("restore: Annulla toglie la cella e ritorna com'era, per cancellare il feedback sul server (§34)", () => {
    const store = createHiddenContentStore();
    const attempt = store.begin(KEY) as number;
    store.settle(KEY, attempt, "f-1");

    expect(store.restore(KEY)).toMatchObject({ feedbackId: "f-1" });
    expect(store.get(KEY)).toBeUndefined();
    expect(store.restore(KEY)).toBeUndefined();
  });

  it("Annulla con l'hide in volo: la risposta in ritardo è `stale` e non resuscita la cella", () => {
    const store = createHiddenContentStore();
    const attempt = store.begin(KEY) as number;

    store.restore(KEY);

    expect(store.settle(KEY, attempt, "f-1")).toBe("stale");
    expect(store.get(KEY)).toBeUndefined();
  });

  it("nascondi → annulla → nascondi: la risposta del primo tentativo non tocca il secondo", () => {
    const store = createHiddenContentStore();
    const first = store.begin(KEY) as number;
    store.restore(KEY);
    const second = store.begin(KEY) as number;

    expect(second).not.toBe(first);
    expect(store.settle(KEY, first, "f-1")).toBe("stale");
    expect(store.fail(KEY, first)).toBe(false);
    expect(store.get(KEY)).toMatchObject({ attempt: second, feedbackId: null, phase: "pending" });
  });

  it("setReason: solo a hide confermato (§44–§45); `null` per un rollback", () => {
    const store = createHiddenContentStore();
    const attempt = store.begin(KEY) as number;

    expect(store.setReason(KEY, "other")).toBe(false);

    store.settle(KEY, attempt, "f-1");
    expect(store.setReason(KEY, "other")).toBe(true);
    expect(store.get(KEY)?.reasonId).toBe("other");

    store.setReason(KEY, null);
    expect(store.get(KEY)?.reasonId).toBeNull();
  });

  it("notifica solo i listener di quel target: un hide non rirenderizza gli altri", () => {
    const store = createHiddenContentStore();
    const mine = vi.fn();
    const other = vi.fn();
    store.subscribe(KEY, mine);
    store.subscribe("club_media:p2", other);

    store.begin(KEY);

    expect(mine).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  it("l'unsubscribe smette di notificare", () => {
    const store = createHiddenContentStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(KEY, listener);

    unsubscribe();
    store.begin(KEY);

    expect(listener).not.toHaveBeenCalled();
  });

  it("clear: logout e cambio account svuotano lo store e cambiano generazione (§176)", () => {
    const store = createHiddenContentStore();
    const listener = vi.fn();
    store.begin(KEY);
    store.subscribe(KEY, listener);
    const epoch = store.epoch();

    store.clear();

    expect(store.get(KEY)).toBeUndefined();
    expect(store.epoch()).toBe(epoch + 1);
    expect(listener).toHaveBeenCalled();
  });
});
