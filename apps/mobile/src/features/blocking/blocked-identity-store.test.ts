/**
 * Store di sessione dei Block: ottimismo, rollback, idempotenza, convergenza (HOM-12
 * §193–§194, §198–§210).
 */
import { describe, expect, it, vi } from "vitest";

import { createBlockedIdentityStore } from "./blocked-identity-store";

const KEY = "profile:u1";

describe("Blocca — §198–§201, §206", () => {
  it("ottimistico: la cella nasce pending_block e il doppio tap non parte due volte", () => {
    const store = createBlockedIdentityStore();
    const attempt = store.beginBlock(KEY);

    expect(attempt).not.toBeNull();
    expect(store.isBlocked(KEY)).toBe(true);
    expect(store.beginBlock(KEY)).toBeNull();
  });

  it("conferma: blocked con il block_id", () => {
    const store = createBlockedIdentityStore();
    const attempt = store.beginBlock(KEY) as number;

    expect(store.settleBlock(KEY, attempt, "block-1", 100)).toBe(true);
    expect(store.get(KEY)).toMatchObject({ blockId: "block-1", phase: "blocked" });
    expect(store.beginBlock(KEY)).toBeNull();
  });

  it("errore: rollback completo, nessuno stato parziale", () => {
    const store = createBlockedIdentityStore();
    const attempt = store.beginBlock(KEY) as number;

    expect(store.failBlock(KEY, attempt)).toBe(true);
    expect(store.isBlocked(KEY)).toBe(false);
    expect(store.beginBlock(KEY)).not.toBeNull();
  });

  it("un tentativo superato non scrive sulla cella di quello nuovo", () => {
    const store = createBlockedIdentityStore();
    const first = store.beginBlock(KEY) as number;
    store.failBlock(KEY, first);
    const second = store.beginBlock(KEY) as number;

    expect(store.settleBlock(KEY, first, "old", 1)).toBe(false);
    expect(store.failBlock(KEY, first)).toBe(false);
    expect(store.get(KEY)?.phase).toBe("pending_block");
    expect(store.settleBlock(KEY, second, "new", 2)).toBe(true);
  });
});

describe("Sblocca — §202–§207", () => {
  function blocked() {
    const store = createBlockedIdentityStore();
    store.seed(KEY, true, "block-1", 10);
    return store;
  }

  it("durante lo sblocco resta bloccato (§205), alla conferma è sbloccato", () => {
    const store = blocked();
    const attempt = store.beginUnblock(KEY) as number;

    expect(store.isBlocked(KEY)).toBe(true);
    expect(store.settleUnblock(KEY, attempt, 20)).toBe(true);
    expect(store.isBlocked(KEY)).toBe(false);
  });

  it("errore: il Block resta attivo (§203)", () => {
    const store = blocked();
    const attempt = store.beginUnblock(KEY) as number;

    expect(store.failUnblock(KEY, attempt)).toBe(true);
    expect(store.get(KEY)?.phase).toBe("blocked");
    expect(store.isBlocked(KEY)).toBe(true);
  });

  it("doppio tap: una sola richiesta; su un target non bloccato non parte nulla", () => {
    const store = blocked();
    expect(store.beginUnblock(KEY)).not.toBeNull();
    expect(store.beginUnblock(KEY)).toBeNull();

    const clean = createBlockedIdentityStore();
    clean.seed(KEY, false, null, 1);
    expect(clean.beginUnblock(KEY)).toBeNull();
  });

  it("da una lista mai vista (cella assente) lo sblocco parte e porta il block_id noto", () => {
    const store = createBlockedIdentityStore();
    expect(store.beginUnblock(KEY, "block-9")).not.toBeNull();
    expect(store.get(KEY)?.blockId).toBe("block-9");
  });
});

describe("convergenza con il server — §194, §208–§210", () => {
  it("un seed più recente riallinea la cella (Block fatto su un altro device)", () => {
    const store = createBlockedIdentityStore();
    store.seed(KEY, false, null, 10);
    store.seed(KEY, true, "block-2", 20);

    expect(store.isBlocked(KEY)).toBe(true);
    expect(store.get(KEY)?.blockId).toBe("block-2");
  });

  it("un seed più vecchio non cancella conoscenza più recente", () => {
    const store = createBlockedIdentityStore();
    store.seed(KEY, true, "block-1", 20);
    store.seed(KEY, false, null, 10);

    expect(store.isBlocked(KEY)).toBe(true);
  });

  it("un seed non tocca una cella con un tentativo in volo", () => {
    const store = createBlockedIdentityStore();
    store.beginBlock(KEY);
    store.seed(KEY, false, null, 999);

    expect(store.get(KEY)?.phase).toBe("pending_block");
  });

  it("i listener sono per cella", () => {
    const store = createBlockedIdentityStore();
    const own = vi.fn();
    const other = vi.fn();
    store.subscribe(KEY, own);
    store.subscribe("profile:u2", other);

    store.beginBlock(KEY);

    expect(own).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });
});

describe("privacy — logout e cambio account", () => {
  it("clear svuota le celle, cambia generazione e avvisa gli abbonati", () => {
    const store = createBlockedIdentityStore();
    store.seed(KEY, true, "b", 1);
    const listener = vi.fn();
    store.subscribe(KEY, listener);
    const epoch = store.epoch();

    store.clear();

    expect(store.get(KEY)).toBeUndefined();
    expect(store.epoch()).toBe(epoch + 1);
    expect(listener).toHaveBeenCalled();
  });
});
