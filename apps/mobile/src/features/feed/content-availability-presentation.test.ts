import { describe, expect, it } from "vitest";

import {
  CONTENT_UNAVAILABLE_BODY,
  CONTENT_UNAVAILABLE_CTA,
  CONTENT_UNAVAILABLE_TITLE,
  backToFeedMode,
  classifyContentError,
  loadContentAvailability,
  normalizeContentAvailability,
  showBackToFeed,
} from "./content-availability-presentation";
import {
  contentDetailHref,
  isHomeOrigin,
  originForScope,
  parseContentOrigin,
} from "./content-routes";

describe("normalizeContentAvailability (§66–68)", () => {
  it("dati presenti → ready", () => {
    expect(normalizeContentAvailability({ data: { id: 1 }, isError: false })).toEqual({
      data: { id: 1 },
      status: "ready",
    });
  });

  it("null / undefined senza errore → unavailable (risposta definitiva)", () => {
    expect(normalizeContentAvailability({ data: null, isError: false })).toEqual({ status: "unavailable" });
    expect(normalizeContentAvailability({ data: undefined, isError: false })).toEqual({ status: "unavailable" });
  });

  it("errore di rete → error, MAI unavailable (§67, §158)", () => {
    expect(
      normalizeContentAvailability({ data: undefined, error: new TypeError("Network request failed"), isError: true }),
    ).toEqual({ status: "error" });
  });

  it("risposte definitive dal server → unavailable (§63)", () => {
    for (const code of ["22P02", "PGRST116", "42501"]) {
      expect(classifyContentError({ code })).toBe("unavailable");
    }
    expect(classifyContentError({ code: "57014" })).toBe("error");
    expect(classifyContentError(null)).toBe("error");
  });
});

describe("loadContentAvailability", () => {
  it("risolve ready / unavailable / error dalle tre forme di risposta", async () => {
    expect(await loadContentAvailability(async () => "post")).toEqual({ data: "post", status: "ready" });
    expect(await loadContentAvailability(async () => null)).toEqual({ status: "unavailable" });
    expect(
      await loadContentAvailability(async () => {
        throw new Error("offline");
      }),
    ).toEqual({ status: "error" });
  });
});

describe("copy (§57, §59)", () => {
  it("titolo, testo e CTA", () => {
    expect(CONTENT_UNAVAILABLE_TITLE).toBe("Contenuto non disponibile");
    expect(CONTENT_UNAVAILABLE_BODY).toBe("Questo contenuto è stato eliminato o non è più disponibile.");
    expect(CONTENT_UNAVAILABLE_CTA).toBe("Torna al feed");
    expect(CONTENT_UNAVAILABLE_CTA).not.toMatch(/Home/);
  });
});

describe("«Torna al feed» (§58–62, §123–127)", () => {
  it("origine Home: la CTA c'è, e con uno stack torna indietro senza una nuova Home", () => {
    expect(showBackToFeed({ canGoBack: true, origin: "HOME_PER_TE" })).toBe(true);
    expect(showBackToFeed({ canGoBack: true, origin: "HOME_SEGUITI" })).toBe(true);
    expect(backToFeedMode(true)).toBe("back");
  });

  it("deep link da fuori app, senza stack: CTA e Home costruita (§61)", () => {
    expect(showBackToFeed({ canGoBack: false, origin: "DEEP_LINK" })).toBe(true);
    expect(showBackToFeed({ canGoBack: false, origin: null })).toBe(true);
    expect(backToFeedMode(false)).toBe("replace_home");
  });

  it("da Cerca, Profilo, Salvati, chat con uno stack: nessuna CTA, basta il Back (§123–125)", () => {
    for (const origin of ["SEARCH", "PROFILE", "SAVED", "MESSAGE"] as const) {
      expect(showBackToFeed({ canGoBack: true, origin })).toBe(false);
    }
    expect(showBackToFeed({ canGoBack: true, origin: null })).toBe(false);
  });
});

describe("origine (§122)", () => {
  it("la tab del Feed diventa l'origine", () => {
    expect(originForScope("per_te")).toBe("HOME_PER_TE");
    expect(originForScope("seguiti")).toBe("HOME_SEGUITI");
    expect(isHomeOrigin("HOME_SEGUITI")).toBe(true);
    expect(isHomeOrigin("SEARCH")).toBe(false);
    expect(isHomeOrigin(null)).toBe(false);
  });

  it("parseContentOrigin accetta solo i valori noti", () => {
    expect(parseContentOrigin("HOME_PER_TE")).toBe("HOME_PER_TE");
    expect(parseContentOrigin(["SEARCH"])).toBe("SEARCH");
    expect(parseContentOrigin("feed")).toBeNull();
    expect(parseContentOrigin(undefined)).toBeNull();
  });

  it("contentDetailHref compone media, origine e posizione", () => {
    expect(contentDetailHref("club_media", "p1")).toBe("/content/club_media/p1");
    expect(contentDetailHref("club_media", "p1", { media: 2, origin: "HOME_PER_TE" })).toBe(
      "/content/club_media/p1?media=2&origin=HOME_PER_TE",
    );
    expect(contentDetailHref("media_profile", "a1", { origin: "HOME_SEGUITI", position: 7 })).toBe(
      "/content/media_profile/a1?origin=HOME_SEGUITI&position=7",
    );
  });
});
