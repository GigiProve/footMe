import { describe, expect, it } from "vitest";

import { baseState, mention, PERSON, SOCIETY } from "../post-composer/composer-fixtures";
import type { ComposerReference } from "../post-composer/composer-types";
import {
  canSubmitRepost,
  hintFirstIdentity,
  insertTokenAtSelection,
  isRepostComposer,
  isSignificantRepostBody,
  normalizeRepostBody,
  referencedPostErrorCopy,
  referencePayload,
  repostBlockReason,
  repostCtaLabel,
  repostIdentityAccessibilityLabel,
  repostIntent,
  REPOST_COMPOSER_COPY,
  shouldShowAlreadyReposted,
  shouldShowRepostPublication,
} from "./repost-composer-presentation";

const REFERENCE: ComposerReference = {
  available: true,
  contentId: "c-1",
  contentType: "club_media",
  preview: null,
};

const CAN_REPOST = { ...PERSON, canPublishPost: true, hasSimpleRepost: false };

/** Un composer Repost: persona che può ripostare e programmare, body vuoto. */
function repostState(overrides: Parameters<typeof baseState>[0] = {}) {
  return baseState({
    identities: [CAN_REPOST],
    identity: CAN_REPOST,
    reference: REFERENCE,
    ...overrides,
  });
}

describe("normalizeRepostBody / isSignificantRepostBody (§61–§64)", () => {
  it.each([
    ["stringa vuota", ""],
    ["soli spazi", "    "],
    ["newline e tab", "\n\n\t \r\n"],
    ["spazio non separabile", "  "],
    ["zero width space e joiner", "​‌‍"],
    ["BOM e soft hyphen", "﻿­"],
    ["marcatori bidi", "‎‏‪‬"],
    ["selettore di variazione isolato", "️"],
    ["riempitivo Hangul e braille vuoto", "ㅤ⠀"],
  ])("%s non è testo significativo (§62)", (_label, body) => {
    expect(normalizeRepostBody(body)).toBe("");
    expect(isSignificantRepostBody(body)).toBe(false);
  });

  it.each([
    ["una parola", "Ottimo"],
    ["un'emoji sola", "👏"],
    ["un'emoji con selettore di variazione", "❤️"],
    ["un URL solo", "https://example.com/x"],
    ["testo con invisibili intorno", "​ Ciao \n"],
  ])("%s è testo significativo", (_label, body) => {
    expect(isSignificantRepostBody(body)).toBe(true);
  });

  it("le mention da sole non sono testo (stessa regola di HOM-06.1 §12–§13)", () => {
    const body = "@Luca ";
    const mentions = [mention("Luca", 0)];

    expect(isSignificantRepostBody(body, mentions)).toBe(false);
    expect(isSignificantRepostBody(`${body}forza`, mentions)).toBe(true);
  });

  it("repostIntent: vuoto → simple, testo → referenced (§63–§64)", () => {
    expect(repostIntent({ body: "  \n", mentions: [] })).toBe("simple");
    expect(repostIntent({ body: "Bravo", mentions: [] })).toBe("referenced");
  });
});

describe("isRepostComposer (§16)", () => {
  it("è un Repost solo in creazione con una reference", () => {
    expect(isRepostComposer(repostState())).toBe(true);
    expect(isRepostComposer(baseState())).toBe(false);
    expect(
      isRepostComposer(
        repostState({ mode: { contentId: "p", contentType: "profile_post", expectedVersion: null, kind: "edit" } }),
      ),
    ).toBe(false);
  });

  it("uno stato senza il campo `reference` (snapshot vecchi) non è un Repost", () => {
    const legacy = { ...baseState() } as Partial<ReturnType<typeof baseState>>;
    delete legacy.reference;

    expect(isRepostComposer(legacy as ReturnType<typeof baseState>)).toBe(false);
  });
});

describe("canSubmitRepost / CTA (§15, §41, §126–§127, §146–§148)", () => {
  it("fast path: body vuoto → «Reposta» azionabile senza digitare (§21)", () => {
    const state = repostState();

    expect(canSubmitRepost(state)).toBe(true);
    expect(repostCtaLabel(state)).toBe("Reposta");
  });

  it("solo whitespace → ancora Simple Repost, non un Post (§300)", () => {
    const state = repostState({ body: "  \n​" });

    expect(repostIntent(state)).toBe("simple");
    expect(canSubmitRepost(state)).toBe(true);
  });

  it("body vuoto + Simple Repost già attivo → «Già ripostato», non azionabile (§126–§127)", () => {
    const state = repostState({ identity: { ...CAN_REPOST, hasSimpleRepost: true } });

    expect(repostCtaLabel(state)).toBe("Già ripostato");
    expect(canSubmitRepost(state)).toBe(false);
  });

  it("scrivere testo dopo «già ripostato» riabilita la CTA (§132–§133)", () => {
    const state = repostState({ body: "Ora ci metto la faccia", identity: { ...CAN_REPOST, hasSimpleRepost: true } });

    expect(repostCtaLabel(state)).toBe("Reposta");
    expect(canSubmitRepost(state)).toBe(true);
  });

  it("testo + data futura → «Programma», mai «Reposta» (§147–§148)", () => {
    const state = repostState({
      body: "Da vedere",
      publication: { mode: "scheduled", scheduledAt: "2030-08-30T16:30:00Z", timezone: "Europe/Rome" },
    });

    expect(repostCtaLabel(state)).toBe("Programma");
  });

  it("testo + «Ora» → «Reposta» (§146)", () => {
    expect(repostCtaLabel(repostState({ body: "Da vedere", publication: { mode: "now" } }))).toBe("Reposta");
  });

  it("senza `can_schedule_content` una data salvata non cambia la CTA (§85)", () => {
    const state = repostState({
      body: "Da vedere",
      identity: { ...CAN_REPOST, canSchedule: false },
      publication: { mode: "scheduled", scheduledAt: "2030-08-30T16:30:00Z", timezone: "Europe/Rome" },
    });

    expect(repostCtaLabel(state)).toBe("Reposta");
  });

  it("invio in corso → non azionabile (§119)", () => {
    expect(canSubmitRepost(repostState({ publish: { status: "publishing" } }))).toBe(false);
  });

  it("nessuna identità valida → CTA disabilitata (§41)", () => {
    const state = repostState({ identities: [], identity: null });

    expect(canSubmitRepost(state)).toBe(false);
    expect(repostBlockReason(state)).toBe(REPOST_COMPOSER_COPY.noIdentity);
  });
});

describe("repostBlockReason (§38–§41, §155, §226, §229–§231)", () => {
  it("identità non più fra quelle autorizzate → frase del §39, testo intatto", () => {
    const state = repostState({ body: "Il mio testo", identities: [{ ...SOCIETY, canPublishPost: true }] });

    expect(repostBlockReason(state)).toBe("Non hai più i permessi per effettuare il repost con questo profilo.");
    expect(state.body).toBe("Il mio testo");
    expect(canSubmitRepost(state)).toBe(false);
  });

  it("permesso negato dal server all'invio → stessa frase", () => {
    const state = repostState({ publish: { code: "post_permission_denied", status: "failed" } });

    expect(repostBlockReason(state)).toBe(REPOST_COMPOSER_COPY.permissionLost);
  });

  it("originale non disponibile: «Il contenuto originale non è più disponibile.», nessun invio (§155, §231, §287)", () => {
    const state = repostState({ body: "Il mio testo", reference: { ...REFERENCE, available: false } });

    expect(repostBlockReason(state)).toBe("Il contenuto originale non è più disponibile.");
    expect(canSubmitRepost(state)).toBe(false);
    expect(state.body).toBe("Il mio testo");
  });

  it("il server dice «reference non disponibile» → stessa frase, anche se la card era valida", () => {
    const state = repostState({ publish: { code: "repost_reference_unavailable", status: "failed" } });

    expect(repostBlockReason(state)).toBe(REPOST_COMPOSER_COPY.unavailable);
  });

  it("con testo serve anche can_publish_post (§33, §226)", () => {
    const noPost = { ...CAN_REPOST, canPublishPost: false };

    expect(canSubmitRepost(repostState({ body: "Testo", identities: [noPost], identity: noPost }))).toBe(false);
    // Il Simple Repost non richiede can_publish_post.
    expect(canSubmitRepost(repostState({ identities: [noPost], identity: noPost }))).toBe(true);
  });

  it("nessun blocco nel caso normale", () => {
    expect(repostBlockReason(repostState())).toBeNull();
  });
});

describe("riga Pubblicazione e «già ripostato» (§125, §144–§145)", () => {
  it("la riga Pubblicazione non c'è con body vuoto, anche con can_schedule (§144, §266, §341)", () => {
    expect(shouldShowRepostPublication(repostState())).toBe(false);
    expect(shouldShowRepostPublication(repostState({ body: "   " }))).toBe(false);
  });

  it("compare con testo e can_schedule_content (§145, §342)", () => {
    expect(shouldShowRepostPublication(repostState({ body: "Testo" }))).toBe(true);
    expect(
      shouldShowRepostPublication(repostState({ body: "Testo", identity: { ...CAN_REPOST, canSchedule: false } })),
    ).toBe(false);
  });

  it("l'avviso «già ripostato» c'è solo con un Simple Repost attivo", () => {
    expect(shouldShowAlreadyReposted(repostState())).toBe(false);
    expect(shouldShowAlreadyReposted(repostState({ identity: { ...CAN_REPOST, hasSimpleRepost: true } }))).toBe(true);
    expect(shouldShowAlreadyReposted(baseState())).toBe(false);
  });
});

describe("token della toolbar da soli non sono testo (revisione #3)", () => {
  it.each([["@"], ["https://"], ["http://"], ["  @ \n"], ["@ https://"], ["https://@"]])(
    "«%s» da solo vale vuoto: Simple Repost, non un Post",
    (body) => {
      expect(isSignificantRepostBody(body)).toBe(false);
      expect(repostIntent({ body, mentions: [] })).toBe("simple");
    },
  );

  it("un token in coda dopo del testo non cambia nulla: «Bravo @» resta un Post", () => {
    expect(isSignificantRepostBody("Bravo @")).toBe(true);
    expect(isSignificantRepostBody("@ Bravo")).toBe(true);
    expect(isSignificantRepostBody("Guarda https://example.com/x")).toBe(true);
  });

  it("un URL completo da solo resta testo", () => {
    expect(isSignificantRepostBody("https://example.com")).toBe(true);
  });

  it("con «@» da solo la CTA è «Reposta» azionabile e produce un Simple Repost", () => {
    const state = repostState({ body: "@" });

    expect(repostCtaLabel(state)).toBe("Reposta");
    expect(canSubmitRepost(state)).toBe(true);
    expect(shouldShowRepostPublication(state)).toBe(false);
  });
});

describe("programmato riaperto (revisione #1)", () => {
  const scheduledDraft = {
    baselineKey: null,
    initialPublication: null,
    operationKey: "dk",
    ref: { contentId: "d1", contentType: "club_media" as const },
    status: "scheduled" as const,
    version: 4,
  };

  it("body vuoto: non diventa mai un Simple Repost, CTA «Salva» chiusa e frase di vuoto", () => {
    const state = repostState({ draft: scheduledDraft });

    expect(canSubmitRepost(state)).toBe(false);
    expect(repostBlockReason(state)).toBe("Aggiungi un testo, un media o un link.");
    expect(repostCtaLabel(state)).toBe("Salva");
  });

  it("con testo si può salvare e la CTA resta «Salva»", () => {
    const state = repostState({ body: "Testo", draft: scheduledDraft });

    expect(canSubmitRepost(state)).toBe(true);
    expect(repostCtaLabel(state)).toBe("Salva");
  });

  it("una bozza riaperta (non programmata) svuotata resta un Simple Repost possibile", () => {
    const state = repostState({ draft: { ...scheduledDraft, status: "draft" } });

    expect(canSubmitRepost(state)).toBe(true);
  });
});

describe("permesso perso con lista vuota (QA #3, §38–§39, §41)", () => {
  it("identità selezionata che perde il permesso e svuota la lista: frase del §39, non «nessun profilo»", () => {
    const state = repostState({ identities: [], identity: CAN_REPOST });

    expect(repostBlockReason(state)).toBe(REPOST_COMPOSER_COPY.permissionLost);
    expect(canSubmitRepost(state)).toBe(false);
  });

  it("nessuna identità e nessuna lista: «nessun profilo» (§41)", () => {
    expect(repostBlockReason(repostState({ identities: [], identity: null }))).toBe(REPOST_COMPOSER_COPY.noIdentity);
  });
});

describe("hintFirstIdentity (revisione #2, §28)", () => {
  const club = { ...SOCIETY, canPublishPost: true };

  it("vince l'identità della riga Condividi, qualunque sia l'origin", () => {
    expect(hintFirstIdentity([CAN_REPOST, club], club.id)?.id).toBe(club.id);
  });

  it("senza suggerimento o con uno non autorizzato → null (si usa il default dell'origin)", () => {
    expect(hintFirstIdentity([CAN_REPOST, club], null)).toBeNull();
    expect(hintFirstIdentity([CAN_REPOST], club.id)).toBeNull();
    expect(hintFirstIdentity([], "x")).toBeNull();
  });
});

describe("copy, payload, toolbar", () => {
  it("il placeholder e la microcopy sono quelli del §23–§24, senza «Facoltativo» (§25)", () => {
    expect(REPOST_COMPOSER_COPY.placeholder).toBe("Aggiungi un testo al repost…");
    expect(REPOST_COMPOSER_COPY.microcopy).toBe("Se lasci vuoto, riposterai il contenuto senza aggiungere testo.");
    expect(JSON.stringify(REPOST_COMPOSER_COPY)).not.toContain("Facoltativo");
  });

  it("nessuna terminologia tecnica nelle copy (§65)", () => {
    const all = JSON.stringify(REPOST_COMPOSER_COPY).toLowerCase();

    for (const term of ["simple repost", "reference", "wrapper", "quote"]) {
      expect(all).not.toContain(term);
    }
  });

  it("referencedPostErrorCopy: originale, permesso, altrimenti «Pubblicazione non riuscita» (§288)", () => {
    expect(referencedPostErrorCopy("repost_reference_unavailable")).toBe(REPOST_COMPOSER_COPY.unavailable);
    expect(referencedPostErrorCopy("content_permission_denied")).toBe(REPOST_COMPOSER_COPY.permissionLost);
    expect(referencedPostErrorCopy("network")).toBe("Pubblicazione non riuscita. Riprova.");
  });

  it("referencePayload porta solo tipo e id (§88)", () => {
    expect(referencePayload(REFERENCE)).toEqual({ content_id: "c-1", content_type: "club_media" });
  });

  it("etichetta parlata dell'identità: «Reposta come …» (con verifica)", () => {
    expect(repostIdentityAccessibilityLabel({ ...PERSON, isVerified: false })).toBe("Reposta come Matteo Rossi");
    expect(repostIdentityAccessibilityLabel(PERSON)).toBe("Reposta come Matteo Rossi, profilo verificato");
  });

  it("insertTokenAtSelection: «@» a inizio testo, dopo uno spazio, e con uno spazio aggiunto se serve", () => {
    expect(insertTokenAtSelection("", { end: 0, start: 0 }, "@")).toEqual({ body: "@", cursor: 1 });
    expect(insertTokenAtSelection("Ciao ", { end: 5, start: 5 }, "@")).toEqual({ body: "Ciao @", cursor: 6 });
    // `@` deve seguire uno spazio per attivare l'autocomplete: se il carattere prima è una lettera lo si aggiunge.
    expect(insertTokenAtSelection("Ciao", { end: 4, start: 4 }, "@")).toEqual({ body: "Ciao @", cursor: 6 });
  });

  it("insertTokenAtSelection sostituisce la selezione e tiene il resto del testo", () => {
    expect(insertTokenAtSelection("Ciao mondo", { end: 10, start: 5 }, "https://")).toEqual({
      body: "Ciao https://",
      cursor: 13,
    });
    expect(insertTokenAtSelection("Ciao mondo", { end: 4, start: 4 }, "@")).toEqual({
      body: "Ciao @ mondo",
      cursor: 6,
    });
  });

  it("insertTokenAtSelection regge una selezione fuori dal testo", () => {
    expect(insertTokenAtSelection("Ok", { end: 99, start: 99 }, "@")).toEqual({ body: "Ok @", cursor: 4 });
  });
});
