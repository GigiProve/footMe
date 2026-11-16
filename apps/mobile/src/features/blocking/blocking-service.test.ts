/**
 * Servizio di Blocca / Sblocca: nomi delle RPC e dei parametri del contratto (§4), mapper con
 * default sicuri, nessun finto successo su una risposta ignota (HOM-12 §173–§177, §199).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  blockIdentity,
  fetchBlockedIdentities,
  fetchProfileAvailability,
  mapAvailability,
  mapBlockResult,
  mapBlockedIdentities,
  mapUnblockStatus,
  unblockIdentity,
} from "./blocking-service";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));

beforeEach(() => mocks.rpc.mockReset());

const blocker = { id: "me", type: "person" as const };
const target = { id: "t1", type: "person" as const };

describe("mapBlockResult / mapUnblockStatus", () => {
  it("accetta gli stati del contratto", () => {
    expect(mapBlockResult({ block_id: "b1", status: "blocked" })).toEqual({ blockId: "b1", status: "blocked" });
    expect(mapBlockResult({ status: "already_blocked" })).toEqual({ blockId: null, status: "already_blocked" });
    expect(mapBlockResult([{ status: "not_allowed" }]).status).toBe("not_allowed");
    expect(mapUnblockStatus({ status: "unblocked" })).toBe("unblocked");
    expect(mapUnblockStatus({ status: "not_blocked" })).toBe("not_blocked");
  });

  it("una risposta vuota o ignota è un errore, mai un successo", () => {
    expect(() => mapBlockResult(null)).toThrow();
    expect(() => mapBlockResult({ status: "boh" })).toThrow();
    expect(() => mapUnblockStatus({})).toThrow();
  });
});

describe("mapAvailability — §79–§84", () => {
  it("blocked_by_me porta block_id e blocker", () => {
    expect(
      mapAvailability({ block_id: "b1", blocker: { id: "me", type: "person" }, state: "blocked_by_me" }),
    ).toEqual({ blockId: "b1", blocker: { id: "me", type: "person" }, name: null, state: "blocked_by_me" });
  });

  it("available e unavailable non portano altro; il nome è facoltativo", () => {
    expect(mapAvailability({ state: "available" })).toMatchObject({ blocker: null, state: "available" });
    expect(mapAvailability({ state: "unavailable", name: "X" })).toMatchObject({ name: "X", state: "unavailable" });
  });

  it("uno stato ignoto non diventa mai «disponibile»", () => {
    expect(() => mapAvailability({ state: "boh" })).toThrow();
    expect(() => mapAvailability(null)).toThrow();
  });

  it("un blocker malformato si scarta", () => {
    expect(mapAvailability({ blocker: { id: 3, type: "x" }, state: "blocked_by_me" }).blocker).toBeNull();
  });
});

describe("mapBlockedIdentities — §143–§150", () => {
  const row = {
    avatar_url: "https://x/a.png",
    block_id: "b1",
    blocked_at: "2026-11-16T10:00:00Z",
    blocker_id: "me",
    blocker_type: "person",
    identity_id: "t1",
    identity_type: "person",
    is_verified: true,
    name: "Marco Bianchi",
    next_cursor: null,
    subtitle: "Allenatore · AC Como",
  };

  it("passa da snake_case a camelCase", () => {
    expect(mapBlockedIdentities([row]).items[0]).toEqual({
      avatarUrl: "https://x/a.png",
      blockId: "b1",
      blockedAt: "2026-11-16T10:00:00Z",
      blockerId: "me",
      blockerType: "person",
      identityId: "t1",
      identityType: "person",
      isVerified: true,
      name: "Marco Bianchi",
      subtitle: "Allenatore · AC Como",
    });
  });

  it("scarta righe non interpretabili senza far cadere la lista", () => {
    const page = mapBlockedIdentities([row, { ...row, identity_type: "robot" }, null]);
    expect(page.items).toHaveLength(1);
  });

  it("il cursore è quello dell'ultima riga; assente = ultima pagina", () => {
    const cursor = { block_id: "b2", blocked_at: "2026-11-16T09:00:00Z" };
    expect(mapBlockedIdentities([row, { ...row, block_id: "b2", next_cursor: cursor }]).nextCursor).toEqual(cursor);
    expect(mapBlockedIdentities([row]).nextCursor).toBeNull();
    expect(mapBlockedIdentities(null)).toEqual({ items: [], nextCursor: null });
  });
});

describe("RPC — nomi e parametri", () => {
  it("block_identity", async () => {
    mocks.rpc.mockResolvedValue({ data: { block_id: "b1", status: "blocked" }, error: null });

    await expect(blockIdentity({ blocker, operationKey: "op-1", target })).resolves.toEqual({
      blockId: "b1",
      status: "blocked",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("block_identity", {
      p_blocker_id: "me",
      p_blocker_type: "person",
      p_operation_key: "op-1",
      p_target_id: "t1",
      p_target_type: "person",
    });
  });

  it("unblock_identity non invia una chiave di operazione (è idempotente per stato)", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "unblocked" }, error: null });

    await expect(unblockIdentity({ blocker, target })).resolves.toBe("unblocked");
    expect(mocks.rpc).toHaveBeenCalledWith("unblock_identity", {
      p_blocker_id: "me",
      p_blocker_type: "person",
      p_target_id: "t1",
      p_target_type: "person",
    });
  });

  it("fetch_profile_availability", async () => {
    mocks.rpc.mockResolvedValue({ data: { state: "available" }, error: null });

    await fetchProfileAvailability({ id: "c1", type: "society" });
    expect(mocks.rpc).toHaveBeenCalledWith("fetch_profile_availability", {
      p_target_id: "c1",
      p_target_type: "society",
    });
  });

  it("fetch_blocked_identities con cursore keyset e pagina di 30", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await fetchBlockedIdentities({ block_id: "b", blocked_at: "t" });
    expect(mocks.rpc).toHaveBeenCalledWith("fetch_blocked_identities", {
      p_cursor: { block_id: "b", blocked_at: "t" },
      p_limit: 30,
    });
  });

  it("un errore RPC risale", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(blockIdentity({ blocker, operationKey: "k", target })).rejects.toThrow("boom");
    await expect(fetchProfileAvailability(target)).rejects.toThrow("boom");
  });
});
