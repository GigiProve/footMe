/**
 * Sorgente della tab Media del Media/Creator (REV-PROF-21, Screen 4).
 *
 * Il test fissa due regole: la tab legge soltanto i contenuti visivi della
 * redazione — mai gli articoli, nemmeno quelli con una copertina video — e
 * ogni elemento punta al dettaglio condiviso, perché è lì che vivono Salva,
 * commenti e reazioni (REV-PROF-12).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MediaProfilePost } from "../media-profile-post-service";
import { fetchMediaProfileMediaPage } from "./media-media-tab-service";

const mocks = vi.hoisted(() => ({ fetchMediaProfilePostFeed: vi.fn() }));

vi.mock("../media-profile-post-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    fetchMediaProfilePostFeed: mocks.fetchMediaProfilePostFeed,
  };
});

function buildMediaPost(
  overrides: Partial<MediaProfilePost> = {},
): MediaProfilePost {
  return {
    author_id: null,
    author_name: "TuttoDilettanti",
    body: null,
    category: "Media",
    comment_count: 4,
    comments: [],
    cover_type: "image",
    cover_url: "https://cdn.test/foto.jpg",
    created_at: "2026-06-19T08:00:00Z",
    created_by_profile_id: "media-1",
    display_mode: "full",
    excerpt: "La festa promozione",
    external_url: null,
    id: "media-post-1",
    is_saved: true,
    kind: "media",
    media_profile_id: "media-1",
    published_at: "2026-06-19T08:00:00Z",
    publisher_name: "TuttoDilettanti",
    reading_time_minutes: 1,
    source_name: null,
    source_type: "platform",
    status: "published",
    subtitle: null,
    tagged_targets: [],
    title: "La festa promozione",
    updated_at: "2026-06-19T08:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchMediaProfileMediaPage", () => {
  it("interroga soltanto i contenuti con kind 'media'", async () => {
    mocks.fetchMediaProfilePostFeed.mockResolvedValue([]);

    await fetchMediaProfileMediaPage("media-1", "viewer-1", 0, 10);

    expect(mocks.fetchMediaProfilePostFeed).toHaveBeenCalledWith(
      "media-1",
      "viewer-1",
      { kinds: ["media"], limit: 10, offset: 0 },
    );
  });

  it("mappa foto e video sulla forma del modulo Media condiviso", async () => {
    mocks.fetchMediaProfilePostFeed.mockResolvedValue([
      buildMediaPost(),
      buildMediaPost({
        cover_type: "video",
        cover_url: "https://cdn.test/clip.mp4",
        id: "media-post-2",
      }),
    ]);

    const page = await fetchMediaProfileMediaPage("media-1", "viewer-1");

    expect(page.items[0]).toMatchObject({
      id: "media-post-1",
      thumbnailUrl: "https://cdn.test/foto.jpg",
      type: "image",
    });
    expect(page.items[1]).toMatchObject({
      id: "media-post-2",
      type: "video",
      videoUrl: "https://cdn.test/clip.mp4",
    });
  });

  it("ogni elemento apre il dettaglio contenuto condiviso", async () => {
    mocks.fetchMediaProfilePostFeed.mockResolvedValue([buildMediaPost()]);

    const page = await fetchMediaProfileMediaPage("media-1", "viewer-1");

    expect(page.items[0]?.taggedRef).toEqual({
      contentType: "media_profile",
      postId: "media-post-1",
    });
  });

  it("avanza il cursore e dichiara se c'è un'altra pagina", async () => {
    mocks.fetchMediaProfilePostFeed.mockResolvedValue([
      buildMediaPost({ id: "a" }),
      buildMediaPost({ id: "b" }),
    ]);

    const full = await fetchMediaProfileMediaPage("media-1", null, 4, 2);

    expect(full.nextOffset).toBe(6);
    expect(full.hasMore).toBe(true);

    mocks.fetchMediaProfilePostFeed.mockResolvedValue([buildMediaPost()]);

    const partial = await fetchMediaProfileMediaPage("media-1", null, 6, 2);

    expect(partial.nextOffset).toBe(7);
    expect(partial.hasMore).toBe(false);
  });
});
