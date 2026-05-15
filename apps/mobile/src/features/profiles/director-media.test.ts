import { describe, expect, it } from "vitest";

import {
  getDirectorMediaTagMeta,
  inferDirectorMediaTypeFromUrl,
  normalizeDirectorMediaItems,
  normalizeDirectorMediaTag,
} from "./director-media";

describe("director media", () => {
  it("normalizes supported director media tags", () => {
    expect(normalizeDirectorMediaTag("interview")).toBe("interview");
    expect(normalizeDirectorMediaTag("presentation")).toBe("presentation");
    expect(normalizeDirectorMediaTag("scouting")).toBe("scouting");
    expect(normalizeDirectorMediaTag("market")).toBe("market");
    expect(normalizeDirectorMediaTag("goal")).toBeNull();
    expect(getDirectorMediaTagMeta("interview")?.label).toBe("Intervista");
  });

  it("infers media types from URLs", () => {
    expect(inferDirectorMediaTypeFromUrl("https://example.com/media.jpg")).toBe("image");
    expect(inferDirectorMediaTypeFromUrl("https://example.com/media.mp4?token=1")).toBe("video");
  });

  it("keeps thumbnails clean when a media item has no tag", () => {
    expect(
      normalizeDirectorMediaItems([
        {
          id: "media-1",
          type: "image",
          url: "https://example.com/photo.jpg",
        },
      ]),
    ).toEqual([
      {
        created_at: null,
        description: null,
        id: "media-1",
        is_featured: false,
        linked_targets: [],
        tag: null,
        thumbnail_url: "https://example.com/photo.jpg",
        type: "image",
        url: "https://example.com/photo.jpg",
      },
    ]);
  });

  it("normalizes linked targets and drops incomplete entries", () => {
    expect(
      normalizeDirectorMediaItems([
        {
          created_at: "2026-05-15T10:00:00.000Z",
          description: "Presentazione ufficiale.",
          id: "media-1",
          is_featured: true,
          linked_targets: [
            {
              avatar_url: "https://example.com/player.jpg",
              display_name: "Luca Bianchi",
              role: "player",
              subtitle: "Attaccante",
              target_id: "player-1",
              target_type: "profile",
            },
            {
              display_name: "Senza target",
              target_type: "profile",
            },
          ],
          tag: "presentation",
          thumbnail_url: null,
          type: "video",
          url: "https://example.com/video.mp4",
        },
      ]),
    ).toEqual([
      {
        created_at: "2026-05-15T10:00:00.000Z",
        description: "Presentazione ufficiale.",
        id: "media-1",
        is_featured: true,
        linked_targets: [
          {
            avatar_url: "https://example.com/player.jpg",
            display_name: "Luca Bianchi",
            role: "player",
            subtitle: "Attaccante",
            target_id: "player-1",
            target_type: "profile",
          },
        ],
        tag: "presentation",
        thumbnail_url: null,
        type: "video",
        url: "https://example.com/video.mp4",
      },
    ]);
  });
});
