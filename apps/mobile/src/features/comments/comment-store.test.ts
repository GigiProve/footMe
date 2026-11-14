/**
 * Store normalizzato dei commenti (HOM-08 §92–§95, §111, §128–§129, §163–§168,
 * §223, §225–§226): entità per id, ottimistico con riconciliazione che mantiene
 * posizione e chiave, segnaposto, rimozioni, stato di sessione.
 */
import { describe, expect, it, vi } from "vitest";

import { buildOptimisticComment } from "./comment-presentation";
import { createCommentStore } from "./comment-store";
import type { Comment, CommentIdentity } from "./comment-types";

const CONTENT = "profile_post:post-1";

const ME: CommentIdentity = {
  avatarUrl: null,
  canComment: true,
  clubCategory: null,
  clubName: null,
  mediaKind: null,
  primaryPosition: null,
  teamLabel: null,
  id: "p-1",
  isVerified: false,
  name: "Matteo Rossi",
  rank: 0,
  role: null,
  type: "person",
};

function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    author: {
      avatarUrl: null,
      clubCategory: null,
      clubName: null,
      identityId: "p-2",
      identityType: "person",
      isVerified: false,
      mediaKind: null,
      name: "Marco Bianchi",
      primaryPosition: null,
      role: null,
      teamLabel: null,
    },
    body: "Ottimo progetto.",
    capabilities: { canDelete: false, canEdit: false, canLike: true, canOpenAuthor: true, canReply: true },
    contentId: "post-1",
    contentType: "profile_post",
    createdAt: "2026-11-14T10:00:00.000Z",
    editedAt: null,
    id: "c-1",
    isContentAuthor: false,
    likedAs: [],
    likesCount: 0,
    links: [],
    mentions: [],
    operationKey: null,
    repliesCount: 0,
    replyTo: null,
    replyToCommentId: null,
    rootCommentId: "c-1",
    status: "active",
    updatedAt: "2026-11-14T10:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

function optimistic(operationKey: string, replyTo: Parameters<typeof buildOptimisticComment>[0]["replyTo"] = null) {
  return buildOptimisticComment({
    body: "Il mio commento",
    contentAuthor: null,
    contentId: "post-1",
    contentType: "profile_post",
    identity: ME,
    links: [],
    mentions: [],
    operationKey,
    replyTo,
  });
}

describe("entità — una riga si abbona solo alla propria (§225)", () => {
  it("un cambiamento notifica solo l'entità interessata", () => {
    const store = createCommentStore();
    const onOne = vi.fn();
    const onTwo = vi.fn();
    store.seed([comment({ id: "c-1" }), comment({ id: "c-2", rootCommentId: "c-2" })], 10);
    store.subscribeEntity("c-1", onOne);
    store.subscribeEntity("c-2", onTwo);

    store.write(comment({ body: "Modificato", editedAt: "2026-11-14T11:00:00.000Z", id: "c-1", version: 2 }), 20);

    expect(onOne).toHaveBeenCalledTimes(1);
    expect(onTwo).not.toHaveBeenCalled();
    expect(store.get("c-1")?.body).toBe("Modificato");
    expect(store.get("c-2")?.body).toBe("Ottimo progetto.");
  });

  it("un seed identico non notifica; uno più vecchio non scrive; uno più nuovo e diverso sì", () => {
    const store = createCommentStore();
    store.seed([comment()], 100);
    const listener = vi.fn();
    store.subscribeEntity("c-1", listener);

    store.seed([comment()], 200);
    expect(listener).not.toHaveBeenCalled();

    store.write(comment({ body: "Modificato", version: 2 }), 300);
    listener.mockClear();
    store.seed([comment({ body: "Vecchio" })], 250);
    expect(store.get("c-1")?.body).toBe("Modificato");
    expect(listener).not.toHaveBeenCalled();

    store.seed([comment({ body: "Da un altro device", version: 3, updatedAt: "2026-11-14T12:00:00.000Z" })], 400);
    expect(store.get("c-1")?.body).toBe("Da un altro device");
  });
});

describe("ottimistico e riconciliazione (§92–§95, §223)", () => {
  it("il proprio commento entra in cima ai principali, con id temporaneo e stato `sending`", () => {
    const store = createCommentStore();
    store.insertOptimistic(optimistic("k-1"), CONTENT);
    store.insertOptimistic(optimistic("k-2"), CONTENT);

    expect(store.ownRoots(CONTENT).map((ref) => ref.id)).toEqual(["tmp:k-2", "tmp:k-1"]);
    expect(store.get("tmp:k-1")?.send?.state).toBe("sending");
  });

  it("dopo il successo l'id diventa quello del server, stessa posizione e stessa chiave React", () => {
    const store = createCommentStore();
    store.insertOptimistic(optimistic("k-1"), CONTENT);
    store.insertOptimistic(optimistic("k-2"), CONTENT);
    const before = store.ownRoots(CONTENT);

    store.reconcile("tmp:k-1", comment({ id: "c-77", operationKey: "k-1", rootCommentId: "c-77" }), 50);

    const after = store.ownRoots(CONTENT);
    expect(after.map((ref) => ref.id)).toEqual(["tmp:k-2", "c-77"]);
    expect(after.map((ref) => ref.key)).toEqual(before.map((ref) => ref.key));
    expect(store.get("tmp:k-1")).toBeUndefined();
    expect(store.get("c-77")?.send).toBeNull();
  });

  it("una pagina che contiene già il commento (stessa operation key) lo riconcilia: nessun duplicato", () => {
    const store = createCommentStore();
    store.insertOptimistic(optimistic("k-1"), CONTENT);

    store.seed([comment({ id: "c-77", operationKey: "k-1", rootCommentId: "c-77" })], 60);

    expect(store.ownRoots(CONTENT).map((ref) => ref.id)).toEqual(["c-77"]);
    expect(store.get("tmp:k-1")).toBeUndefined();

    // la risposta di create_comment arriva dopo: aggiorna soltanto
    store.reconcile("tmp:k-1", comment({ id: "c-77", operationKey: "k-1", rootCommentId: "c-77" }), 70);
    expect(store.ownRoots(CONTENT).map((ref) => ref.id)).toEqual(["c-77"]);
  });

  it("l'invio fallito resta in lista con il testo; Riprova lo rimette in `sending` (§97–§99)", () => {
    const store = createCommentStore();
    store.insertOptimistic(optimistic("k-1"), CONTENT);

    store.markFailed("tmp:k-1", "network");
    expect(store.get("tmp:k-1")?.send).toMatchObject({ failure: "network", state: "failed" });
    expect(store.get("tmp:k-1")?.body).toBe("Il mio commento");

    store.markSending("tmp:k-1");
    expect(store.get("tmp:k-1")?.send).toMatchObject({ failure: null, state: "sending" });
  });

  it("riaprire il testo fallito toglie l'elemento e restituisce l'invio con la sua chiave (§101)", () => {
    const store = createCommentStore();
    store.insertOptimistic(optimistic("k-1"), CONTENT);
    store.markFailed("tmp:k-1", "network");

    const send = store.discardOptimistic("tmp:k-1");

    expect(send).toMatchObject({ body: "Il mio commento", operationKey: "k-1" });
    expect(store.ownRoots(CONTENT)).toEqual([]);
    expect(store.get("tmp:k-1")).toBeUndefined();
  });

  it("una risposta entra in fondo al thread del suo root, che si espande (§126)", () => {
    const store = createCommentStore();
    store.seed([comment({ id: "c-1", repliesCount: 3 })], 10);
    const target = { author: comment().author, id: "c-2", rootCommentId: "c-1" };

    store.insertOptimistic(optimistic("k-1", target), CONTENT);
    store.insertOptimistic(optimistic("k-2", target), CONTENT);

    expect(store.ownReplies("c-1").map((ref) => ref.id)).toEqual(["tmp:k-1", "tmp:k-2"]);
    expect(store.ownRoots(CONTENT)).toEqual([]);
    expect(store.isExpanded("c-1")).toBe(true);
  });

  it("il conteggio risposte del root segue l'ottimistico e poi il server (§88, §170)", () => {
    const store = createCommentStore();
    store.seed([comment({ id: "c-1", repliesCount: 3 })], 10);

    store.adjustReplies("c-1", 1);
    expect(store.get("c-1")?.repliesCount).toBe(4);

    store.setReplies("c-1", 5);
    expect(store.get("c-1")?.repliesCount).toBe(5);

    store.adjustReplies("c-1", -9);
    expect(store.get("c-1")?.repliesCount).toBe(0);
  });
});

describe("eliminazione (§163–§170)", () => {
  it("senza risposte: la riga sparisce (cancellazione fisica)", () => {
    const store = createCommentStore();
    store.seed([comment()], 10);
    const onStructure = vi.fn();
    store.subscribeStructure(onStructure);

    store.remove("c-1");

    expect(store.isRemoved("c-1")).toBe(true);
    expect(onStructure).toHaveBeenCalled();
  });

  it("con risposte: «Commento eliminato», senza autore, testo, link, like né capability; il thread resta", () => {
    const store = createCommentStore();
    store.seed(
      [
        comment({
          capabilities: { canDelete: true, canEdit: true, canLike: true, canOpenAuthor: true, canReply: true },
          likesCount: 4,
          mentions: [{ displayName: "X", end: 2, identityId: "p-9", identityType: "profile", start: 0 }],
          repliesCount: 2,
        }),
      ],
      10,
    );

    store.tombstone("c-1", 20);

    const entity = store.get("c-1");
    expect(entity).toMatchObject({
      author: null,
      body: "",
      likesCount: 0,
      links: [],
      mentions: [],
      repliesCount: 2,
      status: "deleted",
    });
    expect(Object.values(entity?.capabilities ?? {}).every((value) => value === false)).toBe(true);
    expect(store.isRemoved("c-1")).toBe(false);
  });

  it("un seed più vecchio non risuscita un commento che ho appena eliminato", () => {
    const store = createCommentStore();
    store.seed([comment()], 10);
    store.tombstone("c-1", 100);

    store.seed([comment({ body: "Ottimo progetto." })], 50);

    expect(store.get("c-1")?.status).toBe("deleted");
  });
});

describe("stato di sessione (§111, §128–§129)", () => {
  it("ordinamento per contenuto: «Più rilevanti» di default, la scelta sopravvive", () => {
    const store = createCommentStore();

    expect(store.getSort(CONTENT)).toBe("relevant");
    store.setSort(CONTENT, "recent");
    expect(store.getSort(CONTENT)).toBe("recent");
    expect(store.getSort("profile_post:altro")).toBe("relevant");
  });

  it("espansione di un thread: notifica solo quel thread", () => {
    const store = createCommentStore();
    const onOne = vi.fn();
    const onTwo = vi.fn();
    store.subscribeExpanded("c-1", onOne);
    store.subscribeExpanded("c-2", onTwo);

    store.setExpanded("c-1", true);
    store.setExpanded("c-1", true);

    expect(onOne).toHaveBeenCalledTimes(1);
    expect(onTwo).not.toHaveBeenCalled();
    expect(store.isExpanded("c-1")).toBe(true);
  });

  it("clear svuota tutto, incrementa epoch e notifica", () => {
    const store = createCommentStore();
    store.seed([comment()], 10);
    store.insertOptimistic(optimistic("k-1"), CONTENT);
    store.setSort(CONTENT, "recent");
    store.setExpanded("c-1", true);
    const listener = vi.fn();
    store.subscribeEntity("c-1", listener);
    const epoch = store.epoch();

    store.clear();

    expect(store.get("c-1")).toBeUndefined();
    expect(store.ownRoots(CONTENT)).toEqual([]);
    expect(store.getSort(CONTENT)).toBe("relevant");
    expect(store.isExpanded("c-1")).toBe(false);
    expect(store.epoch()).toBe(epoch + 1);
    expect(listener).toHaveBeenCalled();
  });
});
