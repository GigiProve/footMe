import { describe, expect, it } from "vitest";

import { normalizeAgentMediaItems } from "./agent-media";

describe("agent-media", () => {
  it("normalizes agent media items with operation type and tagged players", () => {
    const result = normalizeAgentMediaItems([
      {
        created_at: "2026-04-10T08:00:00.000Z",
        description: "Firma in Serie D",
        id: "media-1",
        operation_type: "signature",
        tag: "transfer",
        tagged_players: [
          {
            avatar_url: "https://example.com/player.png",
            display_name: "Marco Rossi",
            profile_id: "player-1",
          },
          {
            avatar_url: null,
            display_name: "",
            profile_id: "player-2",
          },
        ],
        type: "video",
        url: "https://example.com/video.mp4",
      },
      {
        id: "missing-url",
      },
    ]);

    expect(result).toEqual([
      {
        created_at: "2026-04-10T08:00:00.000Z",
        description: "Firma in Serie D",
        id: "media-1",
        operation_type: "signature",
        tag: "transfer",
        tagged_players: [
          {
            avatar_url: "https://example.com/player.png",
            display_name: "Marco Rossi",
            profile_id: "player-1",
          },
        ],
        thumbnail_url: null,
        type: "video",
        url: "https://example.com/video.mp4",
      },
    ]);
  });
});
