import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchInteractionIdentities,
  loadInteractionIdentity,
  setContentLike,
} from "./interaction-service";

const mocks = vi.hoisted(() => ({
  readLastIdentityId: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("../dashboard/identity/identity-preference", () => ({
  readLastIdentityId: mocks.readLastIdentityId,
}));

const PERSON_ROW = {
  avatar_url: null,
  identity_id: "p-1",
  identity_type: "person",
  is_verified: false,
  name: "Marco Bianchi",
  rank: 0,
};

const SOCIETY_ROW = {
  avatar_url: "https://x.test/logo.png",
  identity_id: "c-1",
  identity_type: "society",
  is_verified: true,
  name: "AC Como",
  rank: 1,
};

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.readLastIdentityId.mockReset();
});

describe("fetchInteractionIdentities", () => {
  it("mappa le righe e scarta quelle di tipo sconosciuto", async () => {
    mocks.rpc.mockResolvedValue({
      data: [PERSON_ROW, { ...SOCIETY_ROW, identity_type: "robot" }, SOCIETY_ROW],
      error: null,
    });

    await expect(fetchInteractionIdentities()).resolves.toEqual([
      { avatarUrl: null, id: "p-1", isVerified: false, name: "Marco Bianchi", rank: 0, type: "person" },
      {
        avatarUrl: "https://x.test/logo.png",
        id: "c-1",
        isVerified: true,
        name: "AC Como",
        rank: 1,
        type: "society",
      },
    ]);
    expect(mocks.rpc).toHaveBeenCalledWith("fetch_interaction_identities");
  });

  it("propaga l'errore della RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(fetchInteractionIdentities()).rejects.toThrow("boom");
  });
});

describe("loadInteractionIdentity — HOM-07 §11", () => {
  it("usa l'ultima identità Dashboard se è fra quelle autorizzate", async () => {
    mocks.rpc.mockResolvedValue({ data: [PERSON_ROW, SOCIETY_ROW], error: null });
    mocks.readLastIdentityId.mockResolvedValue("c-1");

    await expect(loadInteractionIdentity("p-1")).resolves.toMatchObject({
      id: "c-1",
      type: "society",
    });
    expect(mocks.readLastIdentityId).toHaveBeenCalledWith("p-1");
  });

  it("senza preferenza vale l'identità personale", async () => {
    mocks.rpc.mockResolvedValue({ data: [SOCIETY_ROW, PERSON_ROW], error: null });
    mocks.readLastIdentityId.mockResolvedValue(null);

    await expect(loadInteractionIdentity("p-1")).resolves.toMatchObject({ id: "p-1" });
  });

  it("nessuna identità dal server: null", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    mocks.readLastIdentityId.mockResolvedValue("c-1");

    await expect(loadInteractionIdentity("p-1")).resolves.toBeNull();
  });
});

describe("setContentLike", () => {
  it("invia lo stato desiderato con l'identità e restituisce il conteggio del server", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ is_liked: true, likes_count: 147 }], error: null });

    await expect(
      setContentLike("club_media", "post-1", true, { id: "c-1", type: "society" }),
    ).resolves.toEqual({ isLiked: true, likesCount: 147 });
    expect(mocks.rpc).toHaveBeenCalledWith("set_content_like", {
      p_content_type: "club_media",
      p_identity_id: "c-1",
      p_identity_type: "society",
      p_liked: true,
      p_post_id: "post-1",
    });
  });

  it("propaga l'errore della RPC (identità non autorizzata, contenuto non disponibile)", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("like_identity_forbidden") });

    await expect(
      setContentLike("fan_media", "f-1", false, { id: "p-1", type: "person" }),
    ).rejects.toThrow("like_identity_forbidden");
  });

  it("likes_count è un bigint: una stringa numerica si converte", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ is_liked: false, likes_count: "1234" }], error: null });

    await expect(
      setContentLike("club_media", "post-1", false, { id: "p-1", type: "person" }),
    ).resolves.toEqual({ isLiked: false, likesCount: 1234 });
  });

  it("una risposta vuota è un errore, non uno stato a zero", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    await expect(
      setContentLike("club_media", "post-1", true, { id: "p-1", type: "person" }),
    ).rejects.toThrow();
  });
});
