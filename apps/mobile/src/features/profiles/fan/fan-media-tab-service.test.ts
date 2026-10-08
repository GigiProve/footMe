/**
 * Sorgente della tab Media del Tifoso (REV-PROF-19, Screen 4).
 *
 * Verifica che la tab interroghi solo foto e video, che unisca la bacheca
 * storica senza duplicare record e che ogni elemento apra il dettaglio
 * canonico del proprio dominio.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchFanMediaPage } from "./fan-media-tab-service";

const mocks = vi.hoisted(() => ({
  fetchFanMediaFeed: vi.fn(),
  fetchFanTribunaFeed: vi.fn(),
}));

vi.mock("../fan-tribuna-service", () => ({
  fetchFanTribunaFeed: mocks.fetchFanTribunaFeed,
}));

vi.mock("../fan-media-service", () => ({
  FAN_MEDIA_PAGE_SIZE: 24,
  fetchFanMediaFeed: mocks.fetchFanMediaFeed,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchFanTribunaFeed.mockResolvedValue([]);
  mocks.fetchFanMediaFeed.mockResolvedValue([]);
});

function tribunaPhoto(overrides: Record<string, unknown> = {}) {
  return {
    body: "Derby",
    comment_count: 4,
    created_at: "2026-02-01T10:00:00Z",
    id: "tribuna-photo-1",
    is_saved: false,
    is_supported: true,
    kind: "photo",
    media_type: "video",
    media_url: "https://cdn.test/clip.mp4",
    published_at: "2026-02-01T10:00:00Z",
    support_count: 12,
    thumbnail_url: "https://cdn.test/clip.jpg",
    title: "Derby",
    ...overrides,
  };
}

function legacyPost(overrides: Record<string, unknown> = {}) {
  return {
    comment_count: 1,
    created_at: "2026-01-01T10:00:00Z",
    description: "Curva",
    id: "legacy-1",
    is_liked: false,
    is_saved: false,
    like_count: 3,
    published_at: "2026-01-01T10:00:00Z",
    thumbnail_url: null,
    visual_type: "image",
    visual_url: "https://cdn.test/curva.jpg",
    ...overrides,
  };
}

describe("fetchFanMediaPage", () => {
  it("interroga la Tribuna solo per i contenuti di tipo foto/video", async () => {
    await fetchFanMediaPage("fan-1", "viewer-1");

    expect(mocks.fetchFanTribunaFeed).toHaveBeenCalledWith(
      "fan-1",
      "viewer-1",
      expect.objectContaining({ kinds: ["photo"] }),
    );
  });

  it("unisce le due sorgenti ordinando dal più recente", async () => {
    mocks.fetchFanTribunaFeed.mockResolvedValue([tribunaPhoto()]);
    mocks.fetchFanMediaFeed.mockResolvedValue([legacyPost()]);

    const page = await fetchFanMediaPage("fan-1", "viewer-1");

    expect(page.items.map((item) => item.id)).toEqual([
      "tribuna-photo-1",
      "legacy-1",
    ]);
  });

  it("riconosce il video e porta l'url riproducibile", async () => {
    mocks.fetchFanTribunaFeed.mockResolvedValue([tribunaPhoto()]);

    const [item] = (await fetchFanMediaPage("fan-1", null)).items;

    expect(item.type).toBe("video");
    expect(item.videoUrl).toBe("https://cdn.test/clip.mp4");
    expect(item.thumbnailUrl).toBe("https://cdn.test/clip.jpg");
  });

  it("apre il dettaglio canonico del dominio di provenienza", async () => {
    mocks.fetchFanTribunaFeed.mockResolvedValue([tribunaPhoto()]);
    mocks.fetchFanMediaFeed.mockResolvedValue([legacyPost()]);

    const page = await fetchFanMediaPage("fan-1", null);

    expect(page.items.map((item) => item.taggedRef)).toEqual([
      { contentType: "fan_tribuna", postId: "tribuna-photo-1" },
      { contentType: "fan_media", postId: "legacy-1" },
    ]);
  });

  it("non mostra due volte lo stesso id fra le due sorgenti", async () => {
    mocks.fetchFanTribunaFeed.mockResolvedValue([tribunaPhoto({ id: "shared" })]);
    mocks.fetchFanMediaFeed.mockResolvedValue([legacyPost({ id: "shared" })]);

    const page = await fetchFanMediaPage("fan-1", null);

    expect(page.items).toHaveLength(1);
  });

  it("avanza gli offset per sorgente e segnala che c'è altro da leggere", async () => {
    mocks.fetchFanTribunaFeed.mockResolvedValue(
      Array.from({ length: 2 }, (_value, index) =>
        tribunaPhoto({ id: `tribuna-${index}` }),
      ),
    );
    mocks.fetchFanMediaFeed.mockResolvedValue([legacyPost()]);

    const page = await fetchFanMediaPage("fan-1", null, {
      legacyOffset: 0,
      tribunaOffset: 0,
    }, 2);

    expect(page.cursor).toEqual({ legacyOffset: 1, tribunaOffset: 2 });
    expect(page.hasMore).toBe(true);
  });

  it("non promette altre pagine quando entrambe le sorgenti sono esaurite", async () => {
    mocks.fetchFanTribunaFeed.mockResolvedValue([tribunaPhoto()]);
    mocks.fetchFanMediaFeed.mockResolvedValue([legacyPost()]);

    const page = await fetchFanMediaPage(
      "fan-1",
      null,
      { legacyOffset: 0, tribunaOffset: 0 },
      10,
    );

    expect(page.hasMore).toBe(false);
  });

  it("non espone l'icona Salvati: la griglia riceve solo lo stato, non un controllo", async () => {
    mocks.fetchFanTribunaFeed.mockResolvedValue([
      tribunaPhoto({ is_saved: true }),
    ]);

    const [item] = (await fetchFanMediaPage("fan-1", null)).items;

    // REV-PROF-12: il bookmark vive nel dettaglio, mai sulla thumbnail.
    expect(item.isSaved).toBe(true);
    expect(item.taggedRef?.contentType).toBe("fan_tribuna");
  });
});
