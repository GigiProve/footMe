/**
 * «Non seguire»: aggiornamento ottimistico, snackbar con il nome reale e Annulla, rollback su
 * errore, un solo Follow per fonte per volta, nessuna cascata (HOM-11 §54–§68, §145, §172,
 * §178, §187, §224, §246–§253, §284–§286).
 *
 * Si prova la logica pura (`createUnfollowActions`) con le dipendenze iniettate.
 */
import { describe, expect, it, vi } from "vitest";

import type { ToastOptions } from "../../ui";
import type { FollowAnalyticsEvent } from "./following-analytics";
import type { FollowSource } from "./follow-source";
import { createUnfollowedSourcesStore } from "./unfollowed-sources-store";
import { createUnfollowActions, unfollowMessage, type UnfollowRequest } from "./use-unfollow-from-content";

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("../../ui", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../auth/use-session", () => ({ useSession: () => ({ profile: { id: "viewer-1" } }) }));

const COMO: FollowSource = { id: "c-1", kind: "club", name: "AC Como" };
const MARCO: FollowSource = { id: "p-9", kind: "profile", name: "Marco Bianchi" };

function request(source: FollowSource, overrides: Partial<UnfollowRequest> = {}): UnfollowRequest {
  return { origin: "HOME_PER_TE", source, surface: "content", ...overrides };
}

function setup(setFollow: (source: FollowSource, shouldFollow: boolean) => Promise<void> = async () => undefined) {
  const store = createUnfollowedSourcesStore();
  const follow = vi.fn(setFollow);
  const toasts: ToastOptions[] = [];
  const events: FollowAnalyticsEvent[] = [];
  const cache = {
    applyUnfollow: vi.fn(() => ({})),
    invalidateFollowQueries: vi.fn(),
    restoreFollow: vi.fn(),
  };
  const actions = createUnfollowActions({
    cache,
    notify: (options) => toasts.push(options),
    setFollow: follow,
    store,
    track: (event) => events.push(event),
  });

  return { actions, cache, events, follow, store, toasts };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

describe("unfollow — §58–§59, §224, §248–§249", () => {
  it("nessuna conferma: aggiornamento ottimistico, poi Follow rimosso e snackbar col nome reale", async () => {
    const pending = deferred();
    const { actions, cache, follow, store, toasts } = setup(() => pending.promise);

    const running = actions.unfollow(request(COMO));

    // Prima della risposta del server la relazione è già aggiornata (§58).
    expect(store.has("club:c-1")).toBe(true);
    expect(cache.applyUnfollow).toHaveBeenCalledWith(COMO);
    expect(toasts).toHaveLength(0);

    pending.resolve();
    await running;

    expect(follow).toHaveBeenCalledWith(COMO, false);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("Non segui più AC Como");
    expect(toasts[0].action?.label).toBe("Annulla");
  });

  it("§224: la snackbar usa il nome dell'identità davvero lasciata", async () => {
    const { actions, toasts } = setup();

    await actions.unfollow(request(MARCO));

    expect(toasts[0].message).toBe(unfollowMessage("Marco Bianchi"));
    expect(toasts[0].message).toBe("Non segui più Marco Bianchi");
  });

  it("invalida Profilo, Cerca, Seguiti e contatori: lo stesso Follow globale (§62, §172, §294)", async () => {
    const { actions, cache } = setup();

    await actions.unfollow(request(COMO));

    expect(cache.invalidateFollowQueries).toHaveBeenCalledTimes(1);
    expect(cache.invalidateFollowQueries).toHaveBeenCalledWith({ following: false, source: COMO });
  });
});

describe("Annulla — §61, §250", () => {
  it("ripristina il Follow e la cache com'era", async () => {
    const snapshots = { per_te: undefined };
    const { actions, cache, follow, store, toasts } = setup();
    cache.applyUnfollow.mockReturnValue(snapshots as never);
    await actions.unfollow(request(COMO));

    toasts[0].action?.onPress();
    await vi.waitFor(() => expect(follow).toHaveBeenCalledTimes(2));

    expect(follow).toHaveBeenLastCalledWith(COMO, true);
    expect(store.has("club:c-1")).toBe(false);
    expect(cache.restoreFollow).toHaveBeenCalledWith(COMO, snapshots);
  });

  it("se il server non lo rimette, si torna a «non seguita» con un messaggio", async () => {
    const { actions, cache, events, follow, store, toasts } = setup();
    await actions.unfollow(request(COMO));
    follow.mockRejectedValueOnce(new Error("offline"));

    toasts[0].action?.onPress();
    await vi.waitFor(() => expect(events.some((event) => event.name === "follow_restore_failure")).toBe(true));

    expect(store.has("club:c-1")).toBe(true);
    expect(cache.applyUnfollow).toHaveBeenCalledTimes(2);
    expect(toasts.at(-1)?.message).toBe("Non è stato possibile completare l'operazione.");
  });
});

describe("errore — rollback completo", () => {
  it("il Follow non cambia: la fonte torna seguita, la cache com'era, copy di errore, nessuna snackbar di successo", async () => {
    const snapshots = { seguiti: undefined };
    const { actions, cache, events, store, toasts } = setup(async () => {
      throw new Error("offline");
    });
    cache.applyUnfollow.mockReturnValue(snapshots as never);

    await actions.unfollow(request(COMO));

    expect(store.has("club:c-1")).toBe(false);
    expect(cache.restoreFollow).toHaveBeenCalledWith(COMO, snapshots);
    expect(cache.invalidateFollowQueries).not.toHaveBeenCalled();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("Non è stato possibile completare l'operazione.");
    expect(toasts[0].action).toBeUndefined();
    expect(events.map((event) => event.name)).toEqual(["follow_remove_selected", "follow_remove_failure"]);
  });

  it("dopo il rollback si può riprovare", async () => {
    const { actions, follow, store } = setup();
    follow.mockRejectedValueOnce(new Error("offline"));

    await actions.unfollow(request(COMO));
    await actions.unfollow(request(COMO));

    expect(store.has("club:c-1")).toBe(true);
    expect(follow).toHaveBeenCalledTimes(2);
  });
});

describe("concorrenza — §178", () => {
  it("doppio tap: un solo Follow", async () => {
    const pending = deferred();
    const { actions, follow } = setup(() => pending.promise);

    const first = actions.unfollow(request(COMO));
    await actions.unfollow(request(COMO));
    pending.resolve();
    await first;

    expect(follow).toHaveBeenCalledTimes(1);
  });

  it("lo store di sessione non blocca: se il server dice che la segui di nuovo, «Non seguire» parte (§173)", async () => {
    const { actions, follow, store } = setup();
    await actions.unfollow(request(COMO));

    // Ri-seguita da un'altra superficie: un dato server più nuovo smentisce la voce.
    expect(store.reconcile("club:c-1", Date.now() + 1000)).toBe(true);
    await actions.unfollow(request(COMO));

    expect(follow).toHaveBeenCalledTimes(2);
    expect(store.has("club:c-1")).toBe(true);
  });

  it("anche con la voce ancora nello store la richiesta non esce: la cancellazione è idempotente", async () => {
    const { actions, follow } = setup();

    await actions.unfollow(request(COMO));
    await actions.unfollow(request(COMO));

    expect(follow).toHaveBeenCalledTimes(2);
  });

  it("con la scrittura in volo nessun dato server può smentire la voce; alla risposta la fissa", async () => {
    const pending = deferred();
    const { actions, store } = setup(() => pending.promise);

    const running = actions.unfollow(request(COMO));
    // Una pagina partita ora ma processata prima della cancellazione direbbe ancora «segui».
    expect(store.reconcile("club:c-1", Date.now() + 10_000)).toBe(false);
    expect(store.has("club:c-1")).toBe(true);

    pending.resolve();
    await running;

    // Confermata: solo un dato partito DOPO la risposta la smentisce.
    expect(store.reconcile("club:c-1", 1)).toBe(false);
    expect(store.reconcile("club:c-1", Date.now() + 10_000)).toBe(true);
  });

  it("due fonti diverse sono indipendenti", async () => {
    const { actions, follow } = setup();

    await actions.unfollow(request(COMO));
    await actions.unfollow(request(MARCO));

    expect(follow).toHaveBeenCalledTimes(2);
  });

  it("lo stesso id in due tabelle (club vs profilo) non si confonde", async () => {
    const { actions, follow } = setup();

    await actions.unfollow(request({ id: "x", kind: "club", name: "A" }));
    await actions.unfollow(request({ id: "x", kind: "profile", name: "B" }));

    expect(follow).toHaveBeenCalledTimes(2);
  });
});

describe("analytics — §187, §297", () => {
  it("source content_action_sheet, origin e superficie; mai id o nome della fonte", async () => {
    const { actions, events } = setup();

    await actions.unfollow(request(COMO, { origin: "HOME_SEGUITI", surface: "comment" }));

    expect(events.map((event) => event.name)).toEqual(["follow_remove_selected", "follow_remove_success"]);
    for (const event of events) {
      expect(event).toMatchObject({
        origin: "HOME_SEGUITI",
        source: "content_action_sheet",
        sourceKind: "club",
        surface: "comment",
      });
      expect(JSON.stringify(event)).not.toContain("AC Como");
      expect(JSON.stringify(event)).not.toContain("c-1");
    }
  });
});

describe("nessuna cascata — §66–§68, §253", () => {
  it("le sole dipendenze sono la mutation Follow, la cache e lo store: nessun Segnala, nessun «Non mi interessa»", async () => {
    const { actions, follow } = setup();

    await actions.unfollow(request(COMO));

    // Una sola scrittura Follow, e nient'altro.
    expect(follow).toHaveBeenCalledTimes(1);
    expect(Object.keys(actions)).toEqual(["unfollow"]);
  });
});
