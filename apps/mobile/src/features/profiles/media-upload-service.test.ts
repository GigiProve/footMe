import { beforeEach, describe, expect, it, vi } from "vitest";

import { pickAndUploadMedia } from "./media-upload-service";

const mocks = vi.hoisted(() => {
  return {
    from: vi.fn(),
    getPublicUrl: vi.fn(),
    launchImageLibraryAsync: vi.fn(),
    requestMediaLibraryPermissionsAsync: vi.fn(),
    upload: vi.fn(),
  };
});

vi.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: mocks.launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync: mocks.requestMediaLibraryPermissionsAsync,
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    storage: {
      from: mocks.from,
    },
  },
}));

describe("pickAndUploadMedia", () => {
  beforeEach(() => {
    mocks.upload.mockReset();
    mocks.getPublicUrl.mockReset();
    mocks.from.mockReset();
    mocks.launchImageLibraryAsync.mockReset();
    mocks.requestMediaLibraryPermissionsAsync.mockReset();

    mocks.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    mocks.upload.mockResolvedValue({ error: null });
    mocks.getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/profile-media/user-1/avatar.jpg" },
    });
    mocks.from.mockReturnValue({
      getPublicUrl: mocks.getPublicUrl,
      upload: mocks.upload,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      }),
    );
  });

  it("uploads the selected assets to Supabase storage", async () => {
    mocks.launchImageLibraryAsync.mockResolvedValue({
      assets: [
        {
          fileName: "avatar.jpg",
          mimeType: "image/jpeg",
          type: "image",
          uri: "file:///avatar.jpg",
        },
      ],
      canceled: false,
    });

    const result = await pickAndUploadMedia({
      folder: "avatars",
      mediaTypes: ["images"],
      userId: "user-1",
    });

    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.upload.mock.calls[0]?.[0]).toContain("user-1/avatars/");
    expect(result).toEqual([
      {
        fileName: "avatar.jpg",
        type: "image",
        url: "https://example.com/profile-media/user-1/avatar.jpg",
      },
    ]);
  });

  it("rejects when media library permissions are denied", async () => {
    mocks.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({
      granted: false,
    });

    await expect(
      pickAndUploadMedia({
        folder: "player-media",
        mediaTypes: ["images", "videos"],
        userId: "user-2",
      }),
    ).rejects.toThrow(
      "Consenti l'accesso alla libreria foto per caricare i media.",
    );
  });
});
