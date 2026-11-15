/**
 * La fonte di un Follow vista da un contenuto, e l'insieme di sessione delle fonti lasciate
 * (HOM-11 §54–§65, §145, §284).
 */
import { describe, expect, it, vi } from "vitest";

import {
  followKindOfIdentity,
  followSourceKey,
  followSourceOfIdentity,
  sameFollowSource,
  unfollowLabel,
} from "./follow-source";
import { createUnfollowedSourcesStore } from "./unfollowed-sources-store";

describe("follow-source", () => {
  it("§57: «Non seguire <nome>» con il nome dell'identità", () => {
    expect(unfollowLabel("Marco Bianchi")).toBe("Non seguire Marco Bianchi");
    expect(unfollowLabel("AC Como")).toBe("Non seguire AC Como");
    expect(unfollowLabel("Calcio Lombardia")).toBe("Non seguire Calcio Lombardia");
  });

  it("la Società è `club_follows`; persone e Media `profile_follows` (§55)", () => {
    expect(followKindOfIdentity("society")).toBe("club");
    expect(followKindOfIdentity("person")).toBe("profile");
    expect(followKindOfIdentity("media")).toBe("profile");
  });

  it("la chiave distingue tipo e id; lo stesso id in due tabelle non si confonde", () => {
    expect(followSourceKey({ id: "x", kind: "club" })).toBe("club:x");
    expect(followSourceKey({ id: "x", kind: "profile" })).toBe("profile:x");
    expect(sameFollowSource({ id: "x", kind: "club" }, { id: "x", kind: "profile" })).toBe(false);
    expect(sameFollowSource({ id: "x", kind: "club" }, { id: "x", kind: "club" })).toBe(true);
  });

  it("una fonte da un'identità: tipo di sistema → tabella; senza id o nome non c'è fonte da dire", () => {
    expect(followSourceOfIdentity({ identityId: "c-1", identityType: "society", name: "AC Como" })).toEqual({
      id: "c-1",
      kind: "club",
      name: "AC Como",
    });
    expect(followSourceOfIdentity({ identityId: "p-1", identityType: "media", name: "Calcio Lombardia" })).toEqual({
      id: "p-1",
      kind: "profile",
      name: "Calcio Lombardia",
    });
    expect(followSourceOfIdentity({ identityId: "", identityType: "person", name: "X" })).toBeNull();
    expect(followSourceOfIdentity({ identityId: "p-1", identityType: "person", name: "  " })).toBeNull();
  });
});

describe("createUnfollowedSourcesStore — §62–§65", () => {
  it("add, has, remove", () => {
    const store = createUnfollowedSourcesStore();

    store.add("club:c-1");
    expect(store.has("club:c-1")).toBe(true);
    expect(store.size()).toBe(1);

    store.remove("club:c-1");
    expect(store.has("club:c-1")).toBe(false);
  });

  it("notifica solo se cambia davvero (nessun rerender a vuoto)", () => {
    const store = createUnfollowedSourcesStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.add("club:c-1");
    store.add("club:c-1");
    store.remove("club:altra");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("la versione cambia a ogni modifica: la lista Seguiti si rilegge", () => {
    const store = createUnfollowedSourcesStore();
    const version = store.version();

    store.add("profile:p-1");

    expect(store.version()).toBe(version + 1);
  });

  it("§173: vale solo finché un dato server PIÙ NUOVO non lo smentisce (reconcile)", () => {
    const store = createUnfollowedSourcesStore();
    const listener = vi.fn();
    store.add("club:c-1");
    store.settle("club:c-1", 1000);
    store.subscribe(listener);

    // Un dato partito prima della conferma (o alla stessa ora) non smentisce nulla.
    expect(store.reconcile("club:c-1", 999)).toBe(false);
    expect(store.reconcile("club:c-1", 1000)).toBe(false);
    expect(store.has("club:c-1")).toBe(true);
    expect(listener).not.toHaveBeenCalled();

    // Uno più nuovo che dice «seguita»: la voce cade e la lista si rilegge.
    expect(store.reconcile("club:c-1", 1001)).toBe(true);
    expect(store.has("club:c-1")).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("con la scrittura in volo (`at = Infinity`) nessun dato server la smentisce", () => {
    const store = createUnfollowedSourcesStore();
    store.add("profile:p-1");

    expect(store.reconcile("profile:p-1", Date.now() + 60_000)).toBe(false);
    expect(store.has("profile:p-1")).toBe(true);
  });

  it("reconcile di una fonte che non c'è non fa nulla; settle idem", () => {
    const store = createUnfollowedSourcesStore();

    expect(store.reconcile("club:x", 5)).toBe(false);
    store.settle("club:x", 5);
    expect(store.has("club:x")).toBe(false);
  });

  it("clear: un account nuovo non eredita le fonti lasciate", () => {
    const store = createUnfollowedSourcesStore();
    store.add("club:c-1");

    store.clear();

    expect(store.has("club:c-1")).toBe(false);
  });
});
