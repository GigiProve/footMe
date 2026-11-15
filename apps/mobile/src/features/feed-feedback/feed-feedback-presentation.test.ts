/**
 * «Non mi interessa»: copy, whitelist delle origin, chiave del target, ordine dei motivi
 * e condizioni del link ai motivi (HOM-11 §19–§53, §198–§199).
 */
import { describe, expect, it } from "vitest";

import {
  HIDDEN_PLACEHOLDER_LABEL,
  HIDDEN_UNDO_LABEL,
  NOT_INTERESTED_A11Y_HINT,
  NOT_INTERESTED_ERROR,
  NOT_INTERESTED_LABEL,
  NOT_INTERESTED_ORIGINS,
  REASONS_LINK_LABEL,
  REASONS_SHEET_BODY,
  REASONS_SHEET_SUBTITLE,
  REASONS_SHEET_TITLE,
  canOfferReasons,
  hiddenTargetKey,
  isNotInterestedOrigin,
  placeholderAnnouncement,
  reposterOf,
  sortReasons,
} from "./feed-feedback-presentation";

describe("copy — §30, §44, §46, §52, §198", () => {
  it("le stringhe della spec, una per una", () => {
    expect(NOT_INTERESTED_LABEL).toBe("Non mi interessa");
    expect(NOT_INTERESTED_A11Y_HINT).toBe("Nascondi questo contenuto e mostra meno contenuti simili");
    expect(HIDDEN_PLACEHOLDER_LABEL).toBe("Contenuto nascosto");
    expect(HIDDEN_UNDO_LABEL).toBe("Annulla");
    expect(REASONS_LINK_LABEL).toBe("Aiutaci a migliorare i suggerimenti");
    expect(REASONS_SHEET_TITLE).toBe("Aiutaci a migliorare i suggerimenti");
    expect(REASONS_SHEET_SUBTITLE).toBe("Facoltativo");
    expect(REASONS_SHEET_BODY).toBe("La tua scelta ci aiuta a proporti contenuti più rilevanti.");
    expect(NOT_INTERESTED_ERROR).toBe("Non è stato possibile completare l'operazione.");
  });

  it("§199: il placeholder si annuncia con l'Annulla raggiungibile subito", () => {
    expect(placeholderAnnouncement()).toBe("Contenuto nascosto. Annulla");
  });
});

describe("whitelist delle origin — D2, §21–§27", () => {
  it("V1: solo Home → Per te", () => {
    expect(NOT_INTERESTED_ORIGINS).toEqual(["HOME_PER_TE"]);
    expect(isNotInterestedOrigin("HOME_PER_TE")).toBe(true);
  });

  it.each(["HOME_SEGUITI", "PROFILE", "SEARCH", "SAVED", "MESSAGE", "DEEP_LINK"] as const)(
    "%s non offre «Non mi interessa» (§23–§26)",
    (origin) => {
      expect(isNotInterestedOrigin(origin)).toBe(false);
    },
  );

  it("senza origin non c'è nessuna recommendation a cui dare un segnale", () => {
    expect(isNotInterestedOrigin(null)).toBe(false);
  });
});

describe("chiave del target", () => {
  it("tipo e id insieme: lo stesso uuid non identifica un contenuto da solo", () => {
    expect(hiddenTargetKey("club_media", "p1")).toBe("club_media:p1");
    expect(hiddenTargetKey("club_media", "p1")).not.toBe(hiddenTargetKey("media_profile", "p1"));
  });
});

describe("reposterOf — §39, §146", () => {
  it("il reposter di un Simple Repost, nella forma dell'RPC", () => {
    expect(
      reposterOf({
        additionalCount: 2,
        reposter: {
          avatarUrl: null,
          identityId: "p-9",
          identityType: "person",
          isVerified: false,
          name: "Marco Bianchi",
        },
      }),
    ).toEqual({ identityId: "p-9", identityType: "person" });
  });

  it("senza Simple Repost non c'è reposter", () => {
    expect(reposterOf(null)).toBeNull();
    expect(reposterOf(undefined)).toBeNull();
  });
});

describe("motivi — §47–§49", () => {
  it("si ordinano per sort_order senza mutare l'array del server", () => {
    const reasons = [
      { label: "B", reasonId: "b", sortOrder: 2 },
      { label: "A", reasonId: "a", sortOrder: 1 },
    ];

    expect(sortReasons(reasons).map((reason) => reason.reasonId)).toEqual(["a", "b"]);
    expect(reasons.map((reason) => reason.reasonId)).toEqual(["b", "a"]);
  });
});

describe("canOfferReasons — §44–§45", () => {
  const base = { attempt: 1, feedbackId: "f-1", phase: "hidden" as const, reasonId: null };

  it("a hide confermato e senza un motivo già scelto", () => {
    expect(canOfferReasons(base)).toBe(true);
  });

  it("con l'hide ancora in volo non c'è un feedback a cui associarlo", () => {
    expect(canOfferReasons({ ...base, feedbackId: null, phase: "pending" })).toBe(false);
  });

  it("dopo aver scelto un motivo il link non si ripropone", () => {
    expect(canOfferReasons({ ...base, reasonId: "other" })).toBe(false);
  });

  it("senza cella (contenuto ripristinato) nulla", () => {
    expect(canOfferReasons(undefined)).toBe(false);
  });
});
