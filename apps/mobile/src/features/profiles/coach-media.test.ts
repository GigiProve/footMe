import { describe, expect, it } from "vitest";

import {
  getCoachMediaTagMeta,
  normalizeCoachMediaItems,
  normalizeCoachMediaTag,
} from "./coach-media";

describe("coach-media", () => {
  it("normalizes unsupported tags to training", () => {
    expect(normalizeCoachMediaTag("unknown")).toBe("training");
    expect(getCoachMediaTagMeta("training").label).toBe("Allenamento");
  });

  it("normalizes coach media records and infers media type", () => {
    expect(
      normalizeCoachMediaItems([
        {
          id: "media-1",
          tag: "analysis",
          thumbnail_url: "",
          url: "https://example.com/video.mp4",
        },
      ]),
    ).toEqual([
      {
        created_at: null,
        description: null,
        id: "media-1",
        is_featured: false,
        tag: "analysis",
        thumbnail_url: null,
        type: "video",
        url: "https://example.com/video.mp4",
      },
    ]);
  });
});
