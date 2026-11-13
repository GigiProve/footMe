import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ContentPermissionError,
  deleteContent,
  isContentPermissionError,
  parseDeleteContentStatus,
} from "./content-manage-service";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));

beforeEach(() => {
  mocks.rpc.mockReset();
});

describe("parseDeleteContentStatus", () => {
  it("accetta i tre esiti del contratto", () => {
    expect(parseDeleteContentStatus({ status: "deleted" })).toBe("deleted");
    expect(parseDeleteContentStatus({ status: "already_deleted" })).toBe("already_deleted");
    expect(parseDeleteContentStatus([{ status: "unavailable" }])).toBe("unavailable");
  });

  it("una risposta senza stato non è un esito", () => {
    expect(() => parseDeleteContentStatus(null)).toThrow();
    expect(() => parseDeleteContentStatus({ status: "ok" })).toThrow();
  });
});

describe("deleteContent", () => {
  it("chiama delete_content con tipo e id e restituisce lo stato", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "deleted" }, error: null });

    await expect(deleteContent("profile_post", "p1")).resolves.toEqual({ status: "deleted" });
    expect(mocks.rpc).toHaveBeenCalledWith("delete_content", {
      p_content_type: "profile_post",
      p_post_id: "p1",
    });
  });

  it("errcode 42501 → errore tipizzato di permesso", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "content_permission_denied" },
    });

    const error = await deleteContent("club_media", "p1").catch((caught) => caught);

    expect(error).toBeInstanceOf(ContentPermissionError);
    expect(isContentPermissionError(error)).toBe(true);
  });

  it("ogni altro errore resta un errore generico", async () => {
    const failure = { code: "08006", message: "connection" };
    mocks.rpc.mockResolvedValue({ data: null, error: failure });

    const error = await deleteContent("club_media", "p1").catch((caught) => caught);

    expect(error).toBe(failure);
    expect(isContentPermissionError(error)).toBe(false);
  });
});
