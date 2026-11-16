/**
 * Blocca / Sblocca senza React: conferma, rollback, idempotenza, toast, eventi, cache
 * (HOM-12 §22–§23, §152–§156, §198–§207, §250–§252).
 */
import { describe, expect, it, vi } from "vitest";

import { createBlockedIdentityStore } from "./blocked-identity-store";
import { BLOCK_COPY, blockTargetKey } from "./blocking-presentation";
import { createBlockActions } from "./use-block-actions";

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("../../ui", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../auth/use-session", () => ({ useSession: () => ({}) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));

const blocker = { id: "me", type: "person" as const };
const target = { id: "t1", name: "Marco Bianchi", type: "person" as const };
const KEY = blockTargetKey(target);

function setup(overrides: { block?: ReturnType<typeof vi.fn>; unblock?: ReturnType<typeof vi.fn> } = {}) {
  const store = createBlockedIdentityStore();
  const block = overrides.block ?? vi.fn().mockResolvedValue({ blockId: "block-1", status: "blocked" });
  const unblock = overrides.unblock ?? vi.fn().mockResolvedValue("unblocked");
  const notify = vi.fn();
  const track = vi.fn();
  const onChanged = vi.fn();
  const actions = createBlockActions({
    newKey: () => "op-key",
    notify,
    now: () => 1000,
    onChanged,
    service: { block, unblock } as never,
    store,
    track,
  });

  return { actions, block, notify, onChanged, store, track, unblock };
}

describe("Blocca", () => {
  it("successo: stato bloccato, cache invalidate, nessun toast, eventi senza nomi", async () => {
    const { actions, block, notify, onChanged, store, track } = setup();

    await expect(actions.block({ blocker, surface: "profile", target })).resolves.toBe(true);

    expect(block).toHaveBeenCalledWith({
      blocker,
      operationKey: "op-key",
      target: { id: "t1", type: "person" },
    });
    expect(store.get(KEY)).toMatchObject({ blockId: "block-1", phase: "blocked" });
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
    expect(track.mock.calls.map(([event]) => event.name)).toEqual(["block_submit", "block_success"]);
    expect(JSON.stringify(track.mock.calls)).not.toContain("Marco");
  });

  it("ottimismo: durante la richiesta la cella è già bloccata", async () => {
    let release: (value: unknown) => void = () => undefined;
    const block = vi.fn().mockImplementation(() => new Promise((resolve) => (release = resolve)));
    const { actions, store } = setup({ block });

    const pending = actions.block({ blocker, surface: "chat", target });
    expect(store.isBlocked(KEY)).toBe(true);

    release({ blockId: "b", status: "blocked" });
    await pending;
    expect(store.get(KEY)?.phase).toBe("blocked");
  });

  it("errore di rete: rollback completo, messaggio, cache intatte (§199–§201)", async () => {
    const { actions, notify, onChanged, store, track } = setup({
      block: vi.fn().mockRejectedValue(new Error("network")),
    });

    await expect(actions.block({ blocker, surface: "profile", target })).resolves.toBe(false);

    expect(store.isBlocked(KEY)).toBe(false);
    expect(notify).toHaveBeenCalledWith("block-error", BLOCK_COPY.blockError);
    expect(onChanged).not.toHaveBeenCalled();
    expect(track.mock.calls.at(-1)?.[0]).toMatchObject({ name: "block_failure", reason: "network" });
  });

  it("rifiuto del server (not_allowed / target_unavailable): stesso rollback", async () => {
    for (const status of ["not_allowed", "target_unavailable", "invalid"]) {
      const { actions, notify, store } = setup({ block: vi.fn().mockResolvedValue({ blockId: null, status }) });

      await expect(actions.block({ blocker, surface: "profile", target })).resolves.toBe(false);
      expect(store.isBlocked(KEY)).toBe(false);
      expect(notify).toHaveBeenCalledWith("block-error", BLOCK_COPY.blockError);
    }
  });

  it("already_blocked vale come Block attivo (idempotenza, §206)", async () => {
    const { actions, store } = setup({
      block: vi.fn().mockResolvedValue({ blockId: "b0", status: "already_blocked" }),
    });

    await expect(actions.block({ blocker, surface: "profile", target })).resolves.toBe(true);
    expect(store.isBlocked(KEY)).toBe(true);
  });

  it("doppio tap: una sola richiesta", async () => {
    let release: (value: unknown) => void = () => undefined;
    const block = vi.fn().mockImplementation(() => new Promise((resolve) => (release = resolve)));
    const { actions } = setup({ block });

    const first = actions.block({ blocker, surface: "profile", target });
    const second = actions.block({ blocker, surface: "profile", target });
    release({ blockId: "b", status: "blocked" });
    await Promise.all([first, second]);

    expect(block).toHaveBeenCalledTimes(1);
  });
});

describe("Sblocca", () => {
  it("senza conferma: toast «{nome} è stato sbloccato», cache invalidate, evento", async () => {
    const { actions, notify, onChanged, store, track, unblock } = setup();
    store.seed(KEY, true, "block-1", 1);

    await expect(actions.unblock({ blocker, surface: "settings", target })).resolves.toBe(true);

    expect(unblock).toHaveBeenCalledWith({ blocker, target: { id: "t1", type: "person" } });
    expect(store.isBlocked(KEY)).toBe(false);
    expect(notify).toHaveBeenCalledWith("unblock-success", "Marco Bianchi è stato sbloccato");
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(track.mock.calls.at(-1)?.[0]).toMatchObject({ name: "unblock_success", surface: "settings" });
  });

  it("errore: il Block resta, messaggio dedicato, nessuna invalidazione (§203)", async () => {
    const { actions, notify, onChanged, store } = setup({ unblock: vi.fn().mockRejectedValue(new Error("x")) });
    store.seed(KEY, true, "block-1", 1);

    await expect(actions.unblock({ blocker, surface: "chat", target })).resolves.toBe(false);

    expect(store.isBlocked(KEY)).toBe(true);
    expect(notify).toHaveBeenCalledWith("unblock-error", BLOCK_COPY.unblockError);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("doppio tap: una sola richiesta (§207)", async () => {
    let release: (value: unknown) => void = () => undefined;
    const unblock = vi.fn().mockImplementation(() => new Promise((resolve) => (release = resolve)));
    const { actions, store } = setup({ unblock });
    store.seed(KEY, true, "block-1", 1);

    const first = actions.unblock({ blocker, surface: "settings", target });
    const second = actions.unblock({ blocker, surface: "settings", target });
    release("unblocked");
    await Promise.all([first, second]);

    expect(unblock).toHaveBeenCalledTimes(1);
  });

  it("not_blocked vale come sbloccato (idempotenza)", async () => {
    const { actions, store } = setup({ unblock: vi.fn().mockResolvedValue("not_blocked") });
    store.seed(KEY, true, "block-1", 1);

    await expect(actions.unblock({ blocker, surface: "profile", target })).resolves.toBe(true);
    expect(store.isBlocked(KEY)).toBe(false);
  });

  it("not_allowed: il Block resta e compare l'errore", async () => {
    const { actions, notify, store } = setup({ unblock: vi.fn().mockResolvedValue("not_allowed") });
    store.seed(KEY, true, "block-1", 1);

    await expect(actions.unblock({ blocker, surface: "profile", target })).resolves.toBe(false);
    expect(store.isBlocked(KEY)).toBe(true);
    expect(notify).toHaveBeenCalledWith("unblock-error", BLOCK_COPY.unblockError);
  });
});

describe("logout durante la richiesta", () => {
  it("una risposta dell'utente di prima non scrive nello store del successivo", async () => {
    let release: (value: unknown) => void = () => undefined;
    const block = vi.fn().mockImplementation(() => new Promise((resolve) => (release = resolve)));
    const { actions, notify, onChanged, store } = setup({ block });

    const pending = actions.block({ blocker, surface: "profile", target });
    store.clear();
    release({ blockId: "b", status: "blocked" });
    await pending;

    expect(store.get(KEY)).toBeUndefined();
    expect(onChanged).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
});
