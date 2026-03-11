import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchProfiles, searchRecruitingAds } from "./discovery-service";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

describe("discovery-service", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: [], error: null });
  });

  it("normalizes profile search filters before calling the RPC", async () => {
    await searchProfiles({
      position: "all",
      query: "  Rossi ",
      region: "  Lombardia ",
      role: "all",
    });

    expect(rpcMock).toHaveBeenCalledWith("search_profiles", {
      position_filter: null,
      region_filter: "Lombardia",
      role_filter: null,
      search_text: "Rossi",
    });
  });

  it("forces published status and trims recruiting ad filters", async () => {
    await searchRecruitingAds({
      position: "forward",
      query: "  attaccante ",
      region: "  Lazio ",
    });

    expect(rpcMock).toHaveBeenCalledWith("search_recruiting_ads", {
      region_filter: "Lazio",
      role_filter: "forward",
      search_text: "attaccante",
      status_filter: "published",
    });
  });

  it("rethrows Supabase RPC errors", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: new Error("rpc failed"),
    });

    await expect(
      searchProfiles({
        position: "goalkeeper",
        query: "",
        region: "",
        role: "player",
      }),
    ).rejects.toThrow("rpc failed");
  });
});
