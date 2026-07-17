import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchCommunicationDetail,
  fetchCommunications,
  markCommunicationRead,
} from "./communications-service";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

beforeEach(() => {
  rpcMock.mockReset();
});

describe("fetchCommunications", () => {
  it("forwards pagination and returns the list", async () => {
    rpcMock.mockResolvedValue({
      data: [{ communication_id: "com-1" }],
      error: null,
    });

    const result = await fetchCommunications(20, 10);

    expect(rpcMock).toHaveBeenCalledWith("fetch_communications", {
      p_limit: 20,
      p_offset: 10,
    });
    expect(result).toEqual([{ communication_id: "com-1" }]);
  });

  it("defaults to an empty array when data is null", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await fetchCommunications();

    expect(rpcMock).toHaveBeenCalledWith("fetch_communications", {
      p_limit: 50,
      p_offset: 0,
    });
    expect(result).toEqual([]);
  });

  it("throws when the rpc errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(fetchCommunications()).rejects.toThrow("boom");
  });
});

describe("fetchCommunicationDetail", () => {
  it("returns the first row from the rpc table result", async () => {
    rpcMock.mockResolvedValue({
      data: [{ communication_id: "com-1", title: "Titolo" }],
      error: null,
    });

    const result = await fetchCommunicationDetail("com-1");

    expect(rpcMock).toHaveBeenCalledWith("fetch_communication_detail", {
      p_communication_id: "com-1",
    });
    expect(result).toEqual({ communication_id: "com-1", title: "Titolo" });
  });

  it("throws a friendly error when no row is returned", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    await expect(fetchCommunicationDetail("missing")).rejects.toThrow(
      "Comunicazione non trovata",
    );
  });

  it("throws when the rpc errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(fetchCommunicationDetail("com-1")).rejects.toThrow("boom");
  });
});

describe("markCommunicationRead", () => {
  it("returns the boolean result from the rpc", async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });

    const result = await markCommunicationRead("com-1");

    expect(rpcMock).toHaveBeenCalledWith("mark_communication_read", {
      p_communication_id: "com-1",
    });
    expect(result).toBe(true);
  });

  it("throws when the rpc errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(markCommunicationRead("com-1")).rejects.toThrow("boom");
  });
});
