/**
 * Store del conteggio commenti: stessa disciplina di freschezza del Mi piace
 * (HOM-08 §87–§91, §100, §209–§214, §312).
 */
import { describe, expect, it, vi } from "vitest";

import { createCommentCountStore } from "./comment-count-store";

const KEY = "profile_post:post-1";
const OTHER = "profile_post:post-2";

describe("createCommentCountStore — una cella per contenuto", () => {
  it("un cambio notifica solo la cella interessata", () => {
    const store = createCommentCountStore();
    const onKey = vi.fn();
    const onOther = vi.fn();
    store.subscribe(KEY, onKey);
    store.subscribe(OTHER, onOther);
    store.seed(KEY, 18, 10);
    store.seed(OTHER, 3, 10);
    onKey.mockClear();
    onOther.mockClear();

    store.apply(KEY, 19, 20);

    expect(onKey).toHaveBeenCalledTimes(1);
    expect(onOther).not.toHaveBeenCalled();
    expect(store.get(KEY)).toBe(19);
    expect(store.get(OTHER)).toBe(3);
  });

  it("scrivere lo stesso valore non notifica; l'abbonamento si chiude", () => {
    const store = createCommentCountStore();
    store.seed(KEY, 5, 10);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(KEY, listener);

    store.apply(KEY, 5, 20);
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
    store.apply(KEY, 6, 30);
    expect(listener).not.toHaveBeenCalled();
  });

  it("senza cella `get` non inventa nulla", () => {
    expect(createCommentCountStore().get(KEY)).toBeUndefined();
  });
});

describe("freschezza del dato server (§214, §312)", () => {
  it("un seed più vecchio — una pagina del Feed in cache — non cancella ciò che si sa", () => {
    const store = createCommentCountStore();
    store.seed(KEY, 18, 100);
    store.apply(KEY, 19, 200); // commento pubblicato nel detail

    store.seed(KEY, 18, 150); // la pagina del Feed era partita prima

    expect(store.get(KEY)).toBe(19);
  });

  it("un seed più nuovo (altro device, refetch) prevale", () => {
    const store = createCommentCountStore();
    store.seed(KEY, 18, 100);

    store.seed(KEY, 25, 300);

    expect(store.get(KEY)).toBe(25);
  });

  it("un seed senza istante riempie solo una cella che non esiste", () => {
    const store = createCommentCountStore();

    store.seed(KEY, 4);
    store.seed(KEY, 9);

    expect(store.get(KEY)).toBe(4);
  });

  it("un apply più vecchio della cella è ignorato", () => {
    const store = createCommentCountStore();
    store.apply(KEY, 10, 500);

    store.apply(KEY, 3, 400);

    expect(store.get(KEY)).toBe(10);
  });
});

describe("mutazione ottimistica (§211–§212, §100)", () => {
  it("+1 subito, poi il conteggio del server alla risposta", () => {
    const store = createCommentCountStore();
    store.seed(KEY, 18, 100);

    store.adjust(KEY, 1);
    expect(store.get(KEY)).toBe(19);

    store.confirm(KEY, 1, 21, 200); // nel frattempo ne sono arrivati altri
    expect(store.get(KEY)).toBe(21);
  });

  it("un invio fallito toglie il proprio +1 (rollback)", () => {
    const store = createCommentCountStore();
    store.seed(KEY, 18, 100);

    store.adjust(KEY, 1);
    store.rollback(KEY, 1);

    expect(store.get(KEY)).toBe(18);
  });

  it("due invii in volo: il fallito non toglie il +1 dell'altro", () => {
    const store = createCommentCountStore();
    store.seed(KEY, 18, 100);

    store.adjust(KEY, 1);
    store.adjust(KEY, 1);
    expect(store.get(KEY)).toBe(20);

    store.rollback(KEY, 1);
    expect(store.get(KEY)).toBe(19);

    store.confirm(KEY, 1, 19, 300);
    expect(store.get(KEY)).toBe(19);
  });

  it("la conferma della prima mostra ancora il +1 della seconda ancora in volo", () => {
    const store = createCommentCountStore();
    store.seed(KEY, 18, 100);

    store.adjust(KEY, 1);
    store.adjust(KEY, 1);
    store.confirm(KEY, 1, 19, 300);

    expect(store.get(KEY)).toBe(20);
  });

  it("una conferma più vecchia della cella (fuori ordine) chiude la mutazione senza riscrivere il conteggio", () => {
    const store = createCommentCountStore();
    store.seed(KEY, 18, 100);
    store.adjust(KEY, 1);
    store.apply(KEY, 25, 500); // un dato server più nuovo è già arrivato

    store.confirm(KEY, 1, 19, 300); // la risposta lenta, di prima

    expect(store.get(KEY)).toBe(25);
  });

  it("senza cella `adjust` parte dalla base del payload", () => {
    const store = createCommentCountStore();

    store.adjust(KEY, 1, 18);

    expect(store.get(KEY)).toBe(19);
  });

  it("mai sotto zero", () => {
    const store = createCommentCountStore();
    store.seed(KEY, 0, 100);

    store.adjust(KEY, -1);

    expect(store.get(KEY)).toBe(0);
  });
});

describe("seed durante una mutazione in volo (la cella è tenuta)", () => {
  it("un seed più nuovo non rompe l'ottimistico", () => {
    const store = createCommentCountStore();
    store.seed(KEY, 18, 100);
    store.adjust(KEY, 1);

    store.seed(KEY, 30, 400);

    expect(store.get(KEY)).toBe(19);
  });

  it("alla conferma, se il seed è più nuovo della risposta, è lui lo stato finale", () => {
    const store = createCommentCountStore();
    store.seed(KEY, 18, 100);
    store.adjust(KEY, 1);
    store.seed(KEY, 30, 400);

    store.confirm(KEY, 1, 19, 300);

    expect(store.get(KEY)).toBe(30);
  });

  it("al rollback, un seed più nuovo vale più del conto ripristinato", () => {
    const store = createCommentCountStore();
    store.seed(KEY, 18, 100);
    store.adjust(KEY, 1);
    store.seed(KEY, 30, 400);

    store.rollback(KEY, 1);

    expect(store.get(KEY)).toBe(30);
  });

  it("un seed più vecchio della risposta è scartato", () => {
    const store = createCommentCountStore();
    store.seed(KEY, 18, 100);
    store.adjust(KEY, 1);
    store.seed(KEY, 30, 200);

    store.confirm(KEY, 1, 19, 300);

    expect(store.get(KEY)).toBe(19);
  });
});

describe("svuotamento (logout, cambio utente)", () => {
  it("clear svuota lo store, notifica e incrementa epoch", () => {
    const store = createCommentCountStore();
    store.seed(KEY, 18, 100);
    const listener = vi.fn();
    store.subscribe(KEY, listener);
    const before = store.epoch();

    store.clear();

    expect(store.get(KEY)).toBeUndefined();
    expect(store.epoch()).toBe(before + 1);
    expect(listener).toHaveBeenCalled();
  });
});
