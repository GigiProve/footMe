/**
 * «Non mi interessa»: hide ottimistico, rollback su errore, Annulla (anche con l'hide in volo),
 * motivo facoltativo, nessuna cascata (HOM-11 §28–§53, §166–§167, §177, §186, §240–§245).
 *
 * Si prova la logica pura (`createNotInterestedActions`) con le dipendenze iniettate: nessun
 * React, nessuna rete.
 */
import { describe, expect, it, vi } from "vitest";

import type { FeedFeedbackAnalyticsEvent } from "./feed-feedback-analytics";
import { createHiddenContentStore } from "./hidden-content-store";
import { createNotInterestedActions, type NotInterestedTarget } from "./use-not-interested";

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("../../ui", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../auth/use-session", () => ({ useSession: () => ({ profile: { id: "viewer-1" } }) }));

const TARGET: NotInterestedTarget = {
  contentId: "p1",
  contentType: "club_media",
  origin: "HOME_PER_TE",
  reposter: null,
};
const KEY = "club_media:p1";

function setup(overrides: { mark?: ReturnType<typeof vi.fn> } = {}) {
  const store = createHiddenContentStore();
  const service = {
    mark: overrides.mark ?? vi.fn(async () => ({ feedbackId: "f-1", status: "recorded" as const })),
    setReason: vi.fn(async () => "updated" as const),
    undo: vi.fn(async () => "removed" as const),
  };
  const notify = vi.fn();
  const onHidden = vi.fn();
  const events: FeedFeedbackAnalyticsEvent[] = [];
  let keyCount = 0;
  const actions = createNotInterestedActions({
    newKey: () => `key-${(keyCount += 1)}`,
    notify,
    onHidden,
    service: service as never,
    store,
    track: (event) => events.push(event),
  });

  return { actions, events, notify, onHidden, service, store };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

describe("mark — §28–§29, §240", () => {
  it("nasconde subito, senza attendere il server (nessuna conferma, §28)", async () => {
    const pending = deferred<{ feedbackId: string; status: "recorded" }>();
    const { actions, store } = setup({ mark: vi.fn(() => pending.promise) });

    const running = actions.mark(TARGET);

    // Il server non ha ancora risposto: il contenuto è già nascosto (§29).
    expect(store.get(KEY)).toMatchObject({ feedbackId: null, phase: "pending" });

    pending.resolve({ feedbackId: "f-1", status: "recorded" });
    await running;

    expect(store.get(KEY)).toMatchObject({ feedbackId: "f-1", phase: "hidden" });
  });

  it("registra il segnale con target, origin e chiave di idempotenza; nessun autore dal client (§180)", async () => {
    const { actions, service } = setup();

    await actions.mark(TARGET);

    expect(service.mark).toHaveBeenCalledWith({
      contentId: "p1",
      contentType: "club_media",
      operationKey: "key-1",
      origin: "HOME_PER_TE",
      reposter: null,
    });
  });

  it("Simple Repost: l'originale è il target e il reposter viaggia con il segnale (§39, §146, D4)", async () => {
    const { actions, service } = setup();

    await actions.mark({ ...TARGET, reposter: { identityId: "p-9", identityType: "person" } });

    expect(service.mark).toHaveBeenCalledWith(
      expect.objectContaining({
        contentId: "p1",
        reposter: { identityId: "p-9", identityType: "person" },
      }),
    );
  });

  it("doppio tap: una sola richiesta (§177)", async () => {
    const pending = deferred<{ feedbackId: string; status: "recorded" }>();
    const { actions, service } = setup({ mark: vi.fn(() => pending.promise) });

    const first = actions.mark(TARGET);
    await actions.mark(TARGET);
    pending.resolve({ feedbackId: "f-1", status: "recorded" });
    await first;

    expect(service.mark).toHaveBeenCalledTimes(1);
  });

  it("contenuto non più leggibile (`unavailable`): resta nascosto, senza errore", async () => {
    const { actions, events, notify, store } = setup({
      mark: vi.fn(async () => ({ feedbackId: null, status: "unavailable" as const })),
    });

    await actions.mark(TARGET);

    expect(store.get(KEY)).toMatchObject({ feedbackId: null, phase: "hidden" });
    expect(notify).not.toHaveBeenCalled();
    expect(events.find((event) => event.name === "not_interested_success")).toMatchObject({
      unavailable: true,
    });
  });
});

describe("cache su disco — §169–§170, §292, §36", () => {
  it("a hide confermato il contenuto esce dalla copia su disco; il segnaposto di sessione resta", async () => {
    const { actions, onHidden, store } = setup();

    await actions.mark(TARGET);

    expect(onHidden).toHaveBeenCalledTimes(1);
    expect(onHidden).toHaveBeenCalledWith(TARGET);
    // La lista visibile non cambia: la cella dello store (il placeholder) c'è ancora.
    expect(store.get(KEY)).toMatchObject({ phase: "hidden" });
  });

  it("anche con `unavailable` (il contenuto non è più leggibile) esce dalla copia su disco", async () => {
    const { actions, onHidden } = setup({
      mark: vi.fn(async () => ({ feedbackId: null, status: "unavailable" as const })),
    });

    await actions.mark(TARGET);

    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it("non prima della conferma: con l'hide in volo, in errore o non ammesso la copia su disco non si tocca", async () => {
    const pending = deferred<{ feedbackId: string; status: "recorded" }>();
    const inFlight = setup({ mark: vi.fn(() => pending.promise) });
    const running = inFlight.actions.mark(TARGET);
    expect(inFlight.onHidden).not.toHaveBeenCalled();
    pending.resolve({ feedbackId: "f-1", status: "recorded" });
    await running;

    const failed = setup({
      mark: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    await failed.actions.mark(TARGET);
    expect(failed.onHidden).not.toHaveBeenCalled();

    const denied = setup({ mark: vi.fn(async () => ({ feedbackId: null, status: "not_allowed" as const })) });
    await denied.actions.mark(TARGET);
    expect(denied.onHidden).not.toHaveBeenCalled();
  });

  it("con Annulla prima della risposta (risposta stale) non si tocca il disco", async () => {
    const pending = deferred<{ feedbackId: string; status: "recorded" }>();
    const { actions, onHidden } = setup({ mark: vi.fn(() => pending.promise) });

    const running = actions.mark(TARGET);
    await actions.undo(TARGET);
    pending.resolve({ feedbackId: "f-late", status: "recorded" });
    await running;

    expect(onHidden).not.toHaveBeenCalled();
  });
});

describe("errore e rollback — §51–§52, §245", () => {
  it("errore di rete: rollback, il contenuto torna, copy del §52", async () => {
    const { actions, events, notify, store } = setup({
      mark: vi.fn(async () => {
        throw new Error("offline");
      }),
    });

    await actions.mark(TARGET);

    expect(store.get(KEY)).toBeUndefined();
    expect(notify).toHaveBeenCalledWith("Non è stato possibile completare l'operazione.");
    expect(events.map((event) => event.name)).toEqual(["not_interested_selected", "not_interested_failure"]);
    expect(events[1]).toMatchObject({ reason: "network" });
  });

  it("not_allowed (origin fuori whitelist o contenuto gestito): rollback e messaggio (D2, D5)", async () => {
    const { actions, events, notify, store } = setup({
      mark: vi.fn(async () => ({ feedbackId: null, status: "not_allowed" as const })),
    });

    await actions.mark(TARGET);

    expect(store.get(KEY)).toBeUndefined();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(events[1]).toMatchObject({ name: "not_interested_failure", reason: "not_allowed" });
  });

  it("dopo il rollback si può riprovare", async () => {
    const mark = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ feedbackId: "f-2", status: "recorded" });
    const { actions, store } = setup({ mark });

    await actions.mark(TARGET);
    await actions.mark(TARGET);

    expect(store.get(KEY)).toMatchObject({ feedbackId: "f-2", phase: "hidden" });
  });
});

describe("Annulla — §34–§35, §53, §239", () => {
  it("ripristina subito e cancella il feedback sul server", async () => {
    const { actions, events, service, store } = setup();
    await actions.mark(TARGET);

    await actions.undo(TARGET);

    expect(store.get(KEY)).toBeUndefined();
    expect(service.undo).toHaveBeenCalledWith("f-1");
    expect(events.at(-1)).toMatchObject({ name: "not_interested_undo" });
  });

  it("Annulla con l'hide in volo: ripristino immediato; la riga creata dopo si cancella appena arriva l'id", async () => {
    const pending = deferred<{ feedbackId: string; status: "recorded" }>();
    const { actions, service, store } = setup({ mark: vi.fn(() => pending.promise) });

    const running = actions.mark(TARGET);
    await actions.undo(TARGET);

    // Il contenuto è già tornato; sul server non c'è ancora niente da cancellare.
    expect(store.get(KEY)).toBeUndefined();
    expect(service.undo).not.toHaveBeenCalled();

    pending.resolve({ feedbackId: "f-late", status: "recorded" });
    await running;

    expect(store.get(KEY)).toBeUndefined();
    expect(service.undo).toHaveBeenCalledWith("f-late");
  });

  it("se la cancellazione sul server fallisce il contenuto resta ripristinato (§176)", async () => {
    const { actions, notify, service, store } = setup();
    await actions.mark(TARGET);
    service.undo.mockRejectedValueOnce(new Error("offline"));

    await expect(actions.undo(TARGET)).resolves.toBeUndefined();

    expect(store.get(KEY)).toBeUndefined();
    expect(notify).not.toHaveBeenCalled();
  });

  it("Annulla su un contenuto non nascosto non fa nulla", async () => {
    const { actions, events, service } = setup();

    await actions.undo(TARGET);

    expect(service.undo).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });
});

describe("motivo facoltativo — §44–§50, §243", () => {
  it("registra il motivo sul feedback già creato; l'hide era già completo (§45)", async () => {
    const { actions, events, service, store } = setup();
    await actions.mark(TARGET);

    await actions.selectReason(TARGET, "other");

    expect(service.setReason).toHaveBeenCalledWith("f-1", "other");
    expect(store.get(KEY)).toMatchObject({ phase: "hidden", reasonId: "other" });
    expect(events.at(-1)).toMatchObject({ name: "not_interested_reason_selected", reasonId: "other" });
  });

  it("con l'hide ancora in volo non c'è un feedback a cui associarlo: nessuna chiamata", async () => {
    const pending = deferred<{ feedbackId: string; status: "recorded" }>();
    const { actions, service } = setup({ mark: vi.fn(() => pending.promise) });

    void actions.mark(TARGET);
    await actions.selectReason(TARGET, "other");

    expect(service.setReason).not.toHaveBeenCalled();
  });

  it("un fallimento lascia l'hide com'è e ripristina il link ai motivi", async () => {
    const { actions, notify, service, store } = setup();
    await actions.mark(TARGET);
    service.setReason.mockRejectedValueOnce(new Error("offline"));

    await actions.selectReason(TARGET, "other");

    expect(store.get(KEY)).toMatchObject({ phase: "hidden", reasonId: null });
    expect(notify).toHaveBeenCalledWith("Non è stato possibile completare l'operazione.");
  });

  it("invalid_reason (motivo disattivato nel frattempo): stesso ripristino", async () => {
    const { actions, service, store } = setup();
    await actions.mark(TARGET);
    service.setReason.mockResolvedValueOnce("invalid_reason" as never);

    await actions.selectReason(TARGET, "vecchio");

    expect(store.get(KEY)?.reasonId).toBeNull();
  });

  it("apertura del foglio: solo un evento", () => {
    const { actions, events } = setup();

    actions.trackReasonsOpen(TARGET);

    expect(events).toEqual([
      {
        contentId: "p1",
        contentType: "club_media",
        name: "not_interested_reason_open",
        origin: "HOME_PER_TE",
        simpleRepost: false,
      },
    ]);
  });
});

describe("logout e cambio account — §176", () => {
  it("una risposta partita per l'utente di prima non tocca lo store del successivo", async () => {
    const pending = deferred<{ feedbackId: string; status: "recorded" }>();
    const { actions, notify, store } = setup({ mark: vi.fn(() => pending.promise) });

    const running = actions.mark(TARGET);
    store.clear();
    store.begin(KEY);
    pending.resolve({ feedbackId: "f-1", status: "recorded" });
    await running;

    // La cella del nuovo utente non è stata confermata dalla risposta del vecchio.
    expect(store.get(KEY)).toMatchObject({ feedbackId: null, phase: "pending" });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("nessuna cascata — §41–§43, §166–§167, §241–§242", () => {
  it("le sole dipendenze sono mark, setReason e undo: nessun Follow, nessun Segnala", () => {
    const { service } = setup();

    expect(Object.keys(service).sort()).toEqual(["mark", "setReason", "undo"]);
  });
});
