import { beforeEach, describe, expect, it, vi } from "vitest";

const { setStringAsyncMock } = vi.hoisted(() => ({ setStringAsyncMock: vi.fn() }));

vi.mock("expo-clipboard", () => ({ setStringAsync: setStringAsyncMock }));

import { buildContentUrl, copyContentLink } from "./share-links";

const ID = "11111111-2222-4333-8444-555555555555";

describe("buildContentUrl (HOM-09 §147–§149, D2)", () => {
  it("con un'origine web è un URL https canonico del contenuto", () => {
    expect(buildContentUrl("club_media", ID, "https://prolink.app")).toBe(
      `https://prolink.app/content/club_media/${ID}`,
    );
  });

  it("ignora gli slash finali dell'origine", () => {
    expect(buildContentUrl("profile_post", ID, "https://prolink.app//")).toBe(
      `https://prolink.app/content/profile_post/${ID}`,
    );
  });

  it("senza origine ricade sullo schema dell'app, mai su un dominio inventato", () => {
    expect(buildContentUrl("media_profile", ID, "")).toBe(`footme://content/media_profile/${ID}`);
  });

  it("contiene solo tipo e id: niente titolo, CDN, storage o query", () => {
    const url = buildContentUrl("club_media", ID, "https://prolink.app") as string;

    expect(url).not.toMatch(/[?#]/);
    expect(url).not.toMatch(/supabase|storage|cdn|signed|token|thumbnail|\/api\//i);
  });

  it("rifiuta un tipo che non è un contenuto PROLINK", () => {
    expect(buildContentUrl("qualcosa", ID, "https://prolink.app")).toBeNull();
    expect(buildContentUrl("../admin", ID, "https://prolink.app")).toBeNull();
  });

  it("rifiuta i tipi che il server non condivide (fan_tribuna, media_tribuna)", () => {
    expect(buildContentUrl("fan_tribuna", ID, "https://prolink.app")).toBeNull();
    expect(buildContentUrl("media_tribuna", ID, "https://prolink.app")).toBeNull();
    expect(buildContentUrl("fan_media", ID, "https://prolink.app")).toBe(
      `https://prolink.app/content/fan_media/${ID}`,
    );
  });

  it("rifiuta un id che non è un identificativo semplice", () => {
    expect(buildContentUrl("club_media", "a/b", "https://prolink.app")).toBeNull();
    expect(buildContentUrl("club_media", `${ID}?x=1`, "https://prolink.app")).toBeNull();
    expect(buildContentUrl("club_media", "", "https://prolink.app")).toBeNull();
  });
});

describe("copyContentLink (§155)", () => {
  beforeEach(() => {
    setStringAsyncMock.mockReset();
  });

  it("copia l'URL e dice di averlo fatto", async () => {
    setStringAsyncMock.mockResolvedValue(true);

    await expect(copyContentLink("https://prolink.app/content/club_media/x")).resolves.toBe(true);
    expect(setStringAsyncMock).toHaveBeenCalledWith("https://prolink.app/content/club_media/x");
  });

  it("se la clipboard fallisce non dichiara una copia mai avvenuta", async () => {
    setStringAsyncMock.mockRejectedValue(new Error("no clipboard"));

    await expect(copyContentLink("https://prolink.app/x")).resolves.toBe(false);
  });
});
