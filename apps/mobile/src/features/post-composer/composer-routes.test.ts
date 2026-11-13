import { describe, expect, it } from "vitest";

import { contentManageParams } from "../feed/content-routes";
import {
  COMPOSER_PATH,
  composerEditHref,
  composerHref,
  contentOriginForComposer,
  isComposerEditableType,
  parseComposerCreateParams,
  parseComposerEditParams,
  parseComposerOrigin,
  returnTargetForOrigin,
} from "./composer-routes";
import { COMPOSER_ORIGINS } from "./composer-types";

describe("composerHref (§2, §4, §5)", () => {
  it("porta l'origin e, se c'è, l'identity suggerita", () => {
    expect(COMPOSER_PATH).toBe("/post-compose");
    expect(composerHref({ origin: "HOME_PER_TE" })).toBe("/post-compose?origin=HOME_PER_TE");
    expect(composerHref({ identityId: "club 1", origin: "SOCIETY_PROFILE" })).toBe(
      "/post-compose?origin=SOCIETY_PROFILE&identity=club%201",
    );
  });

  it("ogni origin della spec è parsabile e ricostruibile", () => {
    for (const origin of COMPOSER_ORIGINS) {
      const href = composerHref({ origin });
      const query = Object.fromEntries(new URLSearchParams(href.split("?")[1]));
      expect(parseComposerCreateParams(query).origin).toBe(origin);
    }
  });
});

describe("parseComposerCreateParams", () => {
  it("origin assente o ignoto → Home per te; identity opzionale", () => {
    expect(parseComposerCreateParams({})).toEqual({ identityId: null, origin: "HOME_PER_TE" });
    expect(parseComposerCreateParams({ origin: "BOH" }).origin).toBe("HOME_PER_TE");
    expect(parseComposerCreateParams({ identity: ["a", "b"], origin: "MEDIA_PROFILE" })).toEqual({
      identityId: "a",
      origin: "MEDIA_PROFILE",
    });
  });

  it("parseComposerOrigin accetta array e rifiuta il resto", () => {
    expect(parseComposerOrigin(["PERSONAL_PROFILE"])).toBe("PERSONAL_PROFILE");
    expect(parseComposerOrigin(undefined)).toBeNull();
    expect(parseComposerOrigin("SAVED")).toBeNull();
  });
});

describe("composerEditHref (§143, §164)", () => {
  const params = contentManageParams({
    authorIdentityId: "a1",
    authorIdentityType: "society",
    contentId: "post-1",
    contentType: "club_media",
    origin: "PROFILE",
    version: "2026-11-13T10:00:00+00:00",
  });

  it("porta tipo, id, origin di navigazione e versione codificata", () => {
    expect(composerEditHref(params)).toBe(
      "/post-compose/edit?type=club_media&id=post-1&origin=PROFILE&version=2026-11-13T10%3A00%3A00%2B00%3A00",
    );
  });

  it("andata e ritorno: parseComposerEditParams ridà ciò che c'era", () => {
    const query = Object.fromEntries(new URLSearchParams(composerEditHref(params).split("?")[1]));

    expect(parseComposerEditParams(query)).toEqual({
      contentId: "post-1",
      contentType: "club_media",
      origin: "PROFILE",
      version: "2026-11-13T10:00:00+00:00",
    });
  });

  it("tipo sconosciuto o non Post, o id mancante → null", () => {
    expect(parseComposerEditParams({ id: "x", type: "fan_tribuna" })).toBeNull();
    expect(parseComposerEditParams({ type: "profile_post" })).toBeNull();
    expect(parseComposerEditParams({})).toBeNull();
  });

  it("senza versione il parametro manca", () => {
    expect(parseComposerEditParams({ id: "x", type: "profile_post" })?.version).toBeNull();
  });

  it("i tipi modificabili sono le tre tabelle dei Post", () => {
    expect(isComposerEditableType("profile_post")).toBe(true);
    expect(isComposerEditableType("club_media")).toBe(true);
    expect(isComposerEditableType("media_profile")).toBe(true);
    expect(isComposerEditableType("fan_media")).toBe(false);
  });
});

describe("ritorno (§122–127)", () => {
  it("da qualunque origin si torna indietro, mai a Home → Per te", () => {
    for (const origin of COMPOSER_ORIGINS) {
      expect(returnTargetForOrigin(origin).kind).toBe("back");
    }
    expect(returnTargetForOrigin(null).kind).toBe("back");
  });

  it("il fallback senza stack è la Home esistente", () => {
    expect(returnTargetForOrigin("SOCIETY_PROFILE")).toEqual({ fallbackHref: "/(tabs)", kind: "back" });
  });

  it("l'origin del dettaglio (Visualizza) segue quello del composer", () => {
    expect(contentOriginForComposer("HOME_SEGUITI")).toBe("HOME_SEGUITI");
    expect(contentOriginForComposer("PERSONAL_PROFILE")).toBe("PROFILE");
    expect(contentOriginForComposer("CONTENT_DETAIL")).toBeNull();
  });
});
