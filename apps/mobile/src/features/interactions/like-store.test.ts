import { describe, expect, it, vi } from "vitest";

import { createLikeStore, likeItemKey } from "./like-store";
import type { InteractionIdentity, LikeSnapshot } from "./interaction-types";

const PERSON: InteractionIdentity = {
  avatarUrl: null,
  id: "p-1",
  isVerified: false,
  name: "Io",
  rank: 0,
  type: "person",
};

const KEY = likeItemKey("club_media", "post-1");
const OTHER = likeItemKey("club_media", "post-2");

const unliked: LikeSnapshot = { likedAs: [], likesCount: 146 };
const liked: LikeSnapshot = { likedAs: [{ id: "p-1", type: "person" }], likesCount: 147 };

describe("likeItemKey", () => {
  it("è `<content_type>:<post_id>`", () => {
    expect(KEY).toBe("club_media:post-1");
  });
});

describe("createLikeStore — §135–§136", () => {
  it("un toggle notifica solo la cella interessata", () => {
    const store = createLikeStore();
    const onKey = vi.fn();
    const onOther = vi.fn();
    store.subscribe(KEY, onKey);
    store.subscribe(OTHER, onOther);
    store.seed(KEY, unliked);
    store.seed(OTHER, unliked);
    onKey.mockClear();
    onOther.mockClear();

    store.write(KEY, liked);

    expect(onKey).toHaveBeenCalledTimes(1);
    expect(onOther).not.toHaveBeenCalled();
    expect(store.get(KEY)).toEqual(liked);
    expect(store.get(OTHER)).toEqual(unliked);
  });

  it("scrivere uno stato uguale non notifica", () => {
    const store = createLikeStore();
    store.write(KEY, liked);
    const listener = vi.fn();
    store.subscribe(KEY, listener);

    store.write(KEY, { likedAs: [...liked.likedAs], likesCount: 147 });

    expect(listener).not.toHaveBeenCalled();
  });

  it("l'abbonamento si può chiudere", () => {
    const store = createLikeStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(KEY, listener);

    unsubscribe();
    store.write(KEY, liked);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("createLikeStore — vince il dato server più recente (§19, §141–§142)", () => {
  it("una pagina più vecchia della risposta al tap non cancella il Mi piace", () => {
    const store = createLikeStore();
    store.seed(KEY, unliked, 100);
    store.write(KEY, liked, 200);

    // La pagina del Feed in cache, richiesta a 100.
    store.seed(KEY, unliked, 100);

    expect(store.get(KEY)).toEqual(liked);
  });

  it("dopo il dettaglio, il Feed in cache non riporta indietro il conteggio", () => {
    const store = createLikeStore();
    store.seed(KEY, unliked, 100); // Feed
    store.write(KEY, liked, 200); // tap
    store.seed(KEY, { ...liked, likesCount: 148 }, 300); // dettaglio

    store.seed(KEY, unliked, 100); // il Feed rilegge la pagina vecchia

    expect(store.get(KEY)).toEqual({ ...liked, likesCount: 148 });
  });

  it("un dato richiesto dopo prevale (altro device, refetch)", () => {
    const store = createLikeStore();
    store.seed(KEY, unliked, 100);
    store.write(KEY, liked, 200);

    store.seed(KEY, { likedAs: [], likesCount: 150 }, 300);

    expect(store.get(KEY)).toEqual({ likedAs: [], likesCount: 150 });
  });

  it("un seed senza istante riempie solo una cella mancante", () => {
    const store = createLikeStore();
    store.seed(KEY, unliked);
    store.seed(KEY, { likedAs: [], likesCount: 9 });

    expect(store.get(KEY)).toEqual(unliked);
  });

  it("durante un toggle in volo il seed non tocca lo stato ottimistico", () => {
    const store = createLikeStore();
    store.seed(KEY, unliked, 100);
    store.hold(KEY);
    store.write(KEY, liked);

    store.seed(KEY, { likedAs: [], likesCount: 150 }, 150);
    expect(store.get(KEY)).toEqual(liked);

    // La risposta (tap a 200) è più nuova del seed arrivato in volo (150).
    store.release(KEY);
    store.write(KEY, liked, 200);
    expect(store.get(KEY)).toEqual(liked);
  });

  it("un seed arrivato in volo e più nuovo della risposta è lo stato finale", () => {
    const store = createLikeStore();
    store.seed(KEY, unliked, 100);
    store.hold(KEY);
    store.write(KEY, liked);

    store.seed(KEY, { likedAs: [], likesCount: 150 }, 300);
    store.release(KEY);
    store.write(KEY, liked, 200);

    expect(store.get(KEY)).toEqual({ likedAs: [], likesCount: 150 });
  });

  it("dopo un errore il ripristino lascia il posto a un seed arrivato in volo", () => {
    const store = createLikeStore();
    store.seed(KEY, unliked, 100);
    store.hold(KEY);
    store.write(KEY, liked);

    store.seed(KEY, { likedAs: [], likesCount: 150 }, 150);
    store.release(KEY);
    store.write(KEY, unliked);

    expect(store.get(KEY)).toEqual({ likedAs: [], likesCount: 150 });
  });

  it("`release` senza `hold` non va sotto zero", () => {
    const store = createLikeStore();
    store.seed(KEY, unliked, 100);

    store.release(KEY);
    store.seed(KEY, { likedAs: [], likesCount: 9 }, 200);

    expect(store.get(KEY)?.likesCount).toBe(9);
  });
});

describe("createLikeStore — utente e identità", () => {
  it("il cambio utente svuota celle e identità e avvisa chi ascolta", () => {
    const store = createLikeStore();
    store.bindOwner("user-a");
    store.setIdentity(PERSON);
    store.seed(KEY, liked);
    const onKey = vi.fn();
    const onIdentity = vi.fn();
    store.subscribe(KEY, onKey);
    store.subscribeIdentity(onIdentity);

    store.bindOwner("user-b");

    expect(store.get(KEY)).toBeUndefined();
    expect(store.getIdentity()).toBeNull();
    expect(onKey).toHaveBeenCalledTimes(1);
    expect(onIdentity).toHaveBeenCalledTimes(1);
  });

  it("lo stesso utente (o nessuno) non svuota nulla", () => {
    const store = createLikeStore();
    store.bindOwner("user-a");
    store.seed(KEY, liked);

    store.bindOwner("user-a");
    store.bindOwner("");

    expect(store.get(KEY)).toEqual(liked);
  });

  it("il primo utente adotta i seed già scritti (la prima schermata semina prima del bind)", () => {
    const store = createLikeStore();
    store.seed(KEY, liked);

    store.bindOwner("user-a");

    expect(store.get(KEY)).toEqual(liked);
  });

  it("setIdentity notifica solo se cambia", () => {
    const store = createLikeStore();
    const listener = vi.fn();
    store.subscribeIdentity(listener);

    store.setIdentity(PERSON);
    store.setIdentity(PERSON);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getIdentity()).toBe(PERSON);
  });
});

describe("createLikeStore — revisione HOM-07 (privacy, celle nuove)", () => {
  it("hold su una cella che non esiste la crea: un seed durante il volo non sovrascrive lo stato ottimistico", () => {
    const store = createLikeStore();
    store.hold(KEY, unliked);
    store.write(KEY, liked);

    // Pagina partita prima della risposta, arrivata durante il volo.
    store.seed(KEY, unliked, 1_000);
    expect(store.get(KEY)).toEqual(liked);

    store.release(KEY);
    store.write(KEY, liked, 2_000);
    expect(store.get(KEY)).toEqual(liked);
  });

  it("clear e cambio utente cambiano generazione e svuotano celle e identità", () => {
    const store = createLikeStore();
    store.bindOwner("user-a");
    store.setIdentity(PERSON);
    store.seed(KEY, liked, 1);
    const first = store.epoch();

    store.bindOwner("user-b");
    expect(store.epoch()).toBe(first + 1);
    expect(store.get(KEY)).toBeUndefined();
    expect(store.getIdentity()).toBeNull();

    store.seed(KEY, liked, 1);
    store.clear();
    expect(store.epoch()).toBe(first + 2);
    expect(store.get(KEY)).toBeUndefined();
  });

  it("il primo bind non cambia generazione (adotta i seed)", () => {
    const store = createLikeStore();
    const before = store.epoch();
    store.bindOwner("user-a");
    expect(store.epoch()).toBe(before);
  });
});
