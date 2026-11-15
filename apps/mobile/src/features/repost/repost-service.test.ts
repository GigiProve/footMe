import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchRepostState,
  mapRemoveOutcome,
  mapRepostIdentity,
  mapRepostResult,
  mapRepostState,
  removeRepost,
  repostContent,
} from "./repost-service";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: rpcMock } }));

beforeEach(() => {
  rpcMock.mockReset();
});

const WIRE_IDENTITY = {
  avatar_url: "https://cdn.test/a.jpg",
  can_publish_post: true,
  can_repost: true,
  can_schedule_content: true,
  context_label: "Allenatore · AC Como",
  display_name: "Marco Bianchi",
  has_simple_repost: false,
  identity_id: "p1",
  identity_type: "person",
  is_verified: true,
} as const;

const REF = { contentId: "c-1", contentType: "club_media" } as const;

describe("mapRepostIdentity (contratto fetch_repost_state)", () => {
  it("mappa snake_case in camelCase", () => {
    expect(mapRepostIdentity(WIRE_IDENTITY)).toEqual({
      avatarUrl: "https://cdn.test/a.jpg",
      canPublishPost: true,
      canRepost: true,
      canSchedule: true,
      contextLabel: "Allenatore · AC Como",
      hasSimpleRepost: false,
      id: "p1",
      isVerified: true,
      name: "Marco Bianchi",
      type: "person",
    });
  });

  it("le capability assenti valgono NO: mai un default permissivo (§35)", () => {
    const identity = mapRepostIdentity({ display_name: "X", identity_id: "p1", identity_type: "person" });

    expect(identity).toMatchObject({
      canPublishPost: false,
      canRepost: false,
      canSchedule: false,
      hasSimpleRepost: false,
      isVerified: false,
    });
  });

  it("senza context_label ripiega sul tipo d'identità", () => {
    expect(mapRepostIdentity({ ...WIRE_IDENTITY, context_label: null })?.contextLabel).toBe("Profilo personale");
    expect(
      mapRepostIdentity({ ...WIRE_IDENTITY, context_label: "  ", identity_type: "society" })?.contextLabel,
    ).toBe("Società");
    expect(mapRepostIdentity({ ...WIRE_IDENTITY, context_label: null, identity_type: "media" })?.contextLabel).toBe(
      "Media",
    );
  });

  it("scarta le righe senza id o con un tipo ignoto", () => {
    expect(mapRepostIdentity({ ...WIRE_IDENTITY, identity_id: "" })).toBeNull();
    expect(mapRepostIdentity({ ...WIRE_IDENTITY, identity_type: "club" as never })).toBeNull();
    expect(mapRepostIdentity(null)).toBeNull();
  });
});

describe("mapRepostState", () => {
  it("ripostabile, identità e preview dallo snapshot", () => {
    const state = mapRepostState({
      identities: [WIRE_IDENTITY],
      repostable: true,
      snapshot: { author_name: "Matteo Rossi", excerpt: "Grande vittoria", item_kind: "post" },
    });

    expect(state.repostable).toBe(true);
    expect(state.identities).toHaveLength(1);
    expect(state.preview).toMatchObject({ authorName: "Matteo Rossi", excerpt: "Grande vittoria" });
  });

  it("un campo `repostable` assente non è un sì", () => {
    expect(mapRepostState({ identities: [WIRE_IDENTITY] }).repostable).toBe(false);
    expect(mapRepostState(null)).toEqual({ identities: [], preview: null, repostable: false });
  });

  it("scarta le identità malformate senza far cadere lo stato", () => {
    const state = mapRepostState({
      identities: [WIRE_IDENTITY, { identity_type: "person" } as never],
      repostable: true,
    });

    expect(state.identities).toHaveLength(1);
  });
});

describe("mapRepostResult / mapRemoveOutcome", () => {
  it.each(["created", "already_reposted", "content_unavailable", "forbidden"] as const)("repost_content: %s", (status) => {
    expect(mapRepostResult({ repost_id: "r1", status })).toEqual({ repostId: "r1", status });
  });

  it("accetta la riga in un array e un repost_id mancante", () => {
    expect(mapRepostResult([{ status: "forbidden" }])).toEqual({ repostId: null, status: "forbidden" });
  });

  it("uno stato ignoto è un errore, non un successo inventato", () => {
    expect(() => mapRepostResult({ status: "boh" })).toThrow();
    expect(() => mapRepostResult(null)).toThrow();
    expect(() => mapRemoveOutcome({})).toThrow();
  });

  it.each(["removed", "not_found", "forbidden"] as const)("remove_repost: %s", (status) => {
    expect(mapRemoveOutcome({ status })).toBe(status);
  });
});

describe("RPC", () => {
  it("fetch_repost_state chiama con tipo e id e mappa la risposta", async () => {
    rpcMock.mockResolvedValue({ data: { identities: [WIRE_IDENTITY], repostable: true }, error: null });

    const state = await fetchRepostState(REF);

    expect(rpcMock).toHaveBeenCalledWith("fetch_repost_state", { p_content_id: "c-1", p_content_type: "club_media" });
    expect(state.repostable).toBe(true);
    expect(state.identities[0].id).toBe("p1");
  });

  it("repost_content porta chiave, identità e contenuto; gli esiti di business non sono eccezioni", async () => {
    rpcMock.mockResolvedValue({ data: { repost_id: null, status: "content_unavailable" }, error: null });

    const result = await repostContent({ identityId: "p1", identityType: "person", operationKey: "op-1", ref: REF });

    expect(rpcMock).toHaveBeenCalledWith("repost_content", {
      p_content_id: "c-1",
      p_content_type: "club_media",
      p_identity_id: "p1",
      p_identity_type: "person",
      p_operation_key: "op-1",
    });
    expect(result.status).toBe("content_unavailable");
  });

  it("repost_content: l'input rifiutato (22023) o la rete lanciano", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "22023", message: "bad input" } });

    await expect(
      repostContent({ identityId: "p1", identityType: "person", operationKey: "op-1", ref: REF }),
    ).rejects.toMatchObject({ code: "22023" });
  });

  it("remove_repost: seconda chiamata = not_found, trattata come riuscita dal chiamante (§238)", async () => {
    rpcMock.mockResolvedValue({ data: { status: "not_found" }, error: null });

    await expect(removeRepost({ identityId: "p1", identityType: "person", ref: REF })).resolves.toBe("not_found");
    expect(rpcMock).toHaveBeenCalledWith("remove_repost", {
      p_content_id: "c-1",
      p_content_type: "club_media",
      p_identity_id: "p1",
      p_identity_type: "person",
    });
  });

  it("l'errore del server esce com'è", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(fetchRepostState(REF)).rejects.toMatchObject({ message: "boom" });
  });
});
