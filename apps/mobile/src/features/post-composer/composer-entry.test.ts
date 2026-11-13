import { describe, expect, it } from "vitest";

import { composerFormatsForRole, composerOriginForScope, resolveComposerEntry } from "./composer-entry";

describe("resolveComposerEntry (§2–3, §213)", () => {
  it("solo Post → apertura diretta, senza schermata intermedia", () => {
    expect(resolveComposerEntry(["post"])).toBe("direct");
  });

  it("Post + altri formati → menu", () => {
    expect(resolveComposerEntry(["post", "fan_post"])).toBe("menu");
    expect(resolveComposerEntry(["post", "club_content", "open_position"])).toBe("menu");
  });

  it("nessun formato → diretto: il composer spiega l'assenza di identity (§172)", () => {
    expect(resolveComposerEntry([])).toBe("direct");
  });

  it("un formato diverso dal Post senza il Post è comunque un menu", () => {
    expect(resolveComposerEntry(["media_article"])).toBe("menu");
  });
});

describe("composerFormatsForRole", () => {
  it.each(["player", "coach", "staff", "director", "agent", "unknown", null, undefined])(
    "%s → solo Post, un tap",
    (role) => {
      const formats = composerFormatsForRole(role);

      expect(formats).toEqual(["post"]);
      expect(resolveComposerEntry(formats)).toBe("direct");
    },
  );

  it("fan, media e club_admin mantengono i formati legacy con «Post» per primo", () => {
    expect(composerFormatsForRole("fan")).toEqual(["post", "fan_post"]);
    expect(composerFormatsForRole("media")).toEqual(["post", "media_article"]);
    expect(composerFormatsForRole("club_admin")).toEqual(["post", "club_content", "open_position"]);

    for (const role of ["fan", "media", "club_admin"]) {
      expect(resolveComposerEntry(composerFormatsForRole(role))).toBe("menu");
    }
  });
});

describe("composerOriginForScope (§5, §123)", () => {
  it("la tab Home di partenza diventa l'origin", () => {
    expect(composerOriginForScope("per_te")).toBe("HOME_PER_TE");
    expect(composerOriginForScope("seguiti")).toBe("HOME_SEGUITI");
  });
});
