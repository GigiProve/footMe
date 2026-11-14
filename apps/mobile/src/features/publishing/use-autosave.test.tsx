import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PublishingRequestError } from "./publishing-service";
import { useAutosave, type AutosaveHandle, type AutosaveOptions } from "./use-autosave";

const mocks = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock("./publishing-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./publishing-service")>();
  return { ...actual, saveContentDraft: mocks.save };
});

vi.mock("./publishing-analytics", () => ({ trackPublishing: vi.fn() }));

const REF = { contentId: "c1", contentType: "club_media" as const };

type Props = Partial<AutosaveOptions<{ body: string }>> & { body: string };

let handle: AutosaveHandle | null = null;
const trees: TestRenderer.ReactTestRenderer[] = [];

/** Il risultato dell'hook esce da una callback: nessuna variabile esterna riassegnata nel render. */
function capture(next: AutosaveHandle) {
  handle = next;
}

function Harness(props: Props) {
  const result = useAutosave({
    debounceMs: 1000,
    enabled: true,
    format: "post",
    identity: { id: "club-1", type: "society" },
    initialRef: null,
    initialVersion: null,
    operationKey: "op-draft",
    payload: { body: props.body },
    persistLocal: false,
    significant: props.body.length > 0,
    snapshot: { body: props.body },
    userId: "u1",
    ...props,
  });
  capture(result);
  return null;
}

function mount(props: Props) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(createElement(Harness, props));
  });
  trees.push(tree);
  return tree;
}

function saved(version: number) {
  return { ref: REF, rightsConfirmed: null, updatedAt: `2026-11-13T10:00:0${version}Z`, version };
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.save.mockReset();
  handle = null;
});

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
  vi.useRealTimers();
});

describe("useAutosave (§117–§128)", () => {
  it("non salva un editor vuoto (§118)", async () => {
    mount({ body: "" });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(handle?.status).toEqual({ status: "idle" });
  });

  it("crea una bozza al primo contenuto, poi aggiorna lo stesso id con la versione attesa (§121–§122)", async () => {
    mocks.save.mockResolvedValueOnce(saved(1)).mockResolvedValueOnce(saved(2));
    const tree = mount({ body: "Ciao" });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ expectedVersion: null, operationKey: "op-draft", ref: null });
    expect(handle?.ref).toEqual(REF);
    expect(handle?.status.status).toBe("saved");

    act(() => {
      tree.update(createElement(Harness, { body: "Ciao a tutti" }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(mocks.save.mock.calls[1][0]).toMatchObject({ expectedVersion: 1, payload: { body: "Ciao a tutti" }, ref: REF });
    expect(handle?.version).toBe(2);
  });

  it("le modifiche rapide producono un solo salvataggio (debounce)", async () => {
    mocks.save.mockResolvedValue(saved(1));
    const tree = mount({ body: "a" });
    act(() => tree.update(createElement(Harness, { body: "ab" })));
    act(() => tree.update(createElement(Harness, { body: "abc" })));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save.mock.calls[0][0].payload).toEqual({ body: "abc" });
  });

  it("flush salva subito e non duplica se il contenuto è già salvato", async () => {
    mocks.save.mockResolvedValue(saved(1));
    mount({ body: "Ciao" });
    let result: Awaited<ReturnType<AutosaveHandle["flush"]>> = null;
    await act(async () => {
      result = await handle!.flush();
    });
    expect(result).toEqual({ ref: REF, version: 1 });
    await act(async () => {
      await handle!.flush();
    });
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });

  it("un conflitto di versione ferma l'autosave senza sovrascrivere (§128, §130)", async () => {
    mocks.save.mockRejectedValueOnce(new PublishingRequestError({ code: "40001", message: "content_version_conflict" }));
    const tree = mount({ body: "Ciao" });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(handle?.status).toEqual({ status: "conflict" });

    act(() => tree.update(createElement(Harness, { body: "Ciao ancora" })));
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });

  it("offline resta sul dispositivo e riprova più tardi (§126–§127)", async () => {
    mocks.save
      .mockRejectedValueOnce(new PublishingRequestError(new Error("Network request failed")))
      .mockResolvedValueOnce(saved(1));
    mount({ body: "Ciao" });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(handle?.status).toEqual({ status: "offline" });
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(handle?.status.status).toBe("saved");
  });

  it("in pausa (invio in corso) i timer non salvano (§121)", async () => {
    mocks.save.mockResolvedValue(saved(1));
    mount({ body: "Ciao", paused: true });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("onSaved riceve la risposta e il payload inviato (§7Q)", async () => {
    mocks.save.mockResolvedValue({ ...saved(1), rightsConfirmed: false });
    const onSaved = vi.fn();
    mount({ body: "Ciao", onSaved });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ rightsConfirmed: false }), { body: "Ciao" });
  });
});

describe("useAutosave — riapertura di una bozza", () => {
  it("aprire una bozza salvata non la risalva finché non cambia", async () => {
    mocks.save.mockResolvedValue(saved(4));
    const tree = mount({ body: "Ciao", initialRef: REF, initialVersion: 3 });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(handle?.version).toBe(3);

    act(() => tree.update(createElement(Harness, { body: "Ciao!", initialRef: REF, initialVersion: 3 })));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ expectedVersion: 3, ref: REF });
  });

  it("una bozza caricata dopo il mount viene adottata: nessuna seconda bozza", async () => {
    mocks.save.mockResolvedValue(saved(6));
    const tree = mount({ body: "" });
    act(() => tree.update(createElement(Harness, { body: "Ciao", initialRef: REF, initialVersion: 5 })));
    act(() => tree.update(createElement(Harness, { body: "Ciao!", initialRef: REF, initialVersion: 5 })));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ expectedVersion: 5, ref: REF });
  });

  it("una copia locale ripristinata si sincronizza subito (§127)", async () => {
    mocks.save.mockResolvedValue(saved(4));
    mount({ body: "Modifica offline", initialRef: REF, initialSynced: false, initialVersion: 3 });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
});
