import { describe, expect, it } from "vitest";

import {
  authorMetaParts,
  bodyOverflows,
  buildAuthorAccessibilityLabel,
  buildAuthorMetaLine,
  buildMediaLayout,
  buildPostActionModel,
  classifyBodyLength,
  formatPostVideoDuration,
  linkPreviewDomain,
  mediaCellAccessibilityLabel,
  mediaCellState,
  mediaCellStateLabel,
  postBodyText,
  segmentBody,
  singleMediaAspectRatio,
  spokenVideoDuration,
  summarizeTagged,
} from "./feed-post-presentation";
import type {
  FeedAuthorMeta,
  FeedMediaItem,
  FeedMention,
  FeedTaggedIdentity,
} from "./feed-types";

const NOW = new Date("2026-07-31T12:00:00.000Z");
const TWO_HOURS_AGO = "2026-07-31T10:00:00.000Z";

function media(position: number, overrides: Partial<FeedMediaItem> = {}): FeedMediaItem {
  return {
    altText: null,
    aspectRatio: null,
    availability: "available",
    durationSeconds: null,
    height: null,
    id: `m${position}`,
    position,
    processingState: "ready",
    thumbnailUrl: `https://cdn.test/${position}-thumb.jpg`,
    type: "image",
    url: `https://cdn.test/${position}.jpg`,
    width: null,
    ...overrides,
  };
}

function collection(count: number, overrides: (index: number) => Partial<FeedMediaItem> = () => ({})) {
  return Array.from({ length: count }, (_, index) => media(index, overrides(index)));
}

const emptyMeta: FeedAuthorMeta = {
  clubCategory: null,
  clubName: null,
  mediaKind: null,
  primaryPosition: null,
  role: null,
  teamLabel: null,
};

function mention(overrides: Partial<FeedMention> = {}): FeedMention {
  return {
    displayName: "Marco Bianchi",
    end: 22,
    identityId: "p-marco",
    identityType: "profile",
    start: 9,
    ...overrides,
  };
}

function tag(id: string, name: string, type: FeedTaggedIdentity["identityType"] = "profile") {
  return { avatarUrl: null, displayName: name, identityId: id, identityType: type };
}

describe("buildMediaLayout", () => {
  it("nessun media: nessun layout e nessuno spazio riservato (§12)", () => {
    const layout = buildMediaLayout([]);

    expect(layout.kind).toBe("none");
    expect(layout.cells).toHaveLength(0);
  });

  it.each([
    [1, "single"],
    [2, "pair"],
    [3, "trio"],
    [4, "quad"],
    [5, "quad"],
  ] as const)("con %i media usa il layout %s", (count, kind) => {
    expect(buildMediaLayout(collection(count)).kind).toBe(kind);
  });

  it("fino a quattro media non mostra +N", () => {
    const layout = buildMediaLayout(collection(4));

    expect(layout.cells.map((cell) => cell.overflowCount)).toEqual([null, null, null, null]);
  });

  it.each([
    [5, 1],
    [7, 3],
    [10, 6],
  ])("con %i media l'ultima cella mostra +%i (§31, §122)", (count, extra) => {
    const layout = buildMediaLayout(collection(count));

    expect(layout.cells).toHaveLength(4);
    expect(layout.total).toBe(count);
    expect(layout.cells.map((cell) => cell.overflowCount)).toEqual([null, null, null, extra]);
  });

  it("l'ordine dell'autore è quello mostrato, anche con una collezione mista (§25)", () => {
    const layout = buildMediaLayout([
      media(2, { id: "c" }),
      media(0, { id: "a", type: "video" }),
      media(1, { id: "b" }),
    ]);

    expect(layout.cells.map((cell) => cell.item.id)).toEqual(["a", "b", "c"]);
    expect(layout.cells.map((cell) => cell.index)).toEqual([0, 1, 2]);
    expect(layout.cells[0].item.type).toBe("video");
  });

  it("a parità di posizione conserva l'ordine ricevuto", () => {
    const layout = buildMediaLayout([media(0, { id: "x" }), media(0, { id: "y" })]);

    expect(layout.cells.map((cell) => cell.item.id)).toEqual(["x", "y"]);
  });

  it("la cella +N di un video resta una cella video con la sua posizione", () => {
    const layout = buildMediaLayout(
      collection(6, (index) => (index === 3 ? { type: "video" } : {})),
    );

    expect(layout.cells[3].item.type).toBe("video");
    expect(layout.cells[3].overflowCount).toBe(2);
  });
});

describe("singleMediaAspectRatio", () => {
  it("usa il rapporto ricevuto quando è ragionevole", () => {
    expect(singleMediaAspectRatio(media(0, { aspectRatio: 1 }))).toBe(1);
  });

  it("lo ricava da larghezza e altezza se il rapporto manca", () => {
    expect(singleMediaAspectRatio(media(0, { height: 800, width: 1000 }))).toBe(1.25);
  });

  it("senza dati usa un default per tipo (§40)", () => {
    expect(singleMediaAspectRatio(media(0))).toBeCloseTo(4 / 3);
    expect(singleMediaAspectRatio(media(0, { type: "video" }))).toBeCloseTo(16 / 9);
  });

  it("limita portrait giganti e panorama illeggibili (§71)", () => {
    expect(singleMediaAspectRatio(media(0, { aspectRatio: 0.3 }))).toBeCloseTo(0.8);
    expect(singleMediaAspectRatio(media(0, { aspectRatio: 4 }))).toBeCloseTo(1.91);
  });

  it("ignora valori non validi", () => {
    expect(singleMediaAspectRatio(media(0, { aspectRatio: Number.NaN }))).toBeCloseTo(4 / 3);
    expect(singleMediaAspectRatio(media(0, { aspectRatio: -2 }))).toBeCloseTo(4 / 3);
  });
});

describe("stato e etichette delle celle", () => {
  it("un'immagine senza url o fallita è non disponibile", () => {
    expect(mediaCellState(media(0, { availability: "unavailable", url: null }))).toBe("unavailable");
    expect(mediaCellState(media(0), true)).toBe("unavailable");
    expect(mediaCellStateLabel(media(0), "unavailable")).toBe("Immagine non disponibile");
  });

  it("un video in elaborazione vince sulla mancanza di url (§41)", () => {
    const video = media(0, {
      availability: "unavailable",
      processingState: "processing",
      type: "video",
      url: null,
    });

    expect(mediaCellState(video)).toBe("processing");
    expect(mediaCellStateLabel(video, "processing")).toBe("Video in elaborazione");
  });

  it("un video fallito è non disponibile; una miniatura rotta no", () => {
    const failed = media(0, { processingState: "failed", type: "video" });

    expect(mediaCellState(failed)).toBe("unavailable");
    expect(mediaCellStateLabel(failed, "unavailable")).toBe("Video non disponibile");
    expect(mediaCellState(media(0, { type: "video" }), true)).toBe("ready");
  });

  it("l'etichetta accessibile di un video dice durata parlata (§76)", () => {
    const layout = buildMediaLayout([media(0, { durationSeconds: 48, type: "video" })]);

    expect(mediaCellAccessibilityLabel(layout.cells[0], 1, "ready")).toBe(
      "Video, durata 48 secondi",
    );
  });

  it("la cella +N dice «Gallery con 7 contenuti» (§76)", () => {
    const layout = buildMediaLayout(collection(7));

    expect(mediaCellAccessibilityLabel(layout.cells[3], layout.total, "ready")).toBe(
      "Gallery con 7 contenuti",
    );
  });

  it("un'immagine usa l'alt text, altrimenti la sua posizione", () => {
    const layout = buildMediaLayout([media(0, { altText: "Gol al 90'" }), media(1)]);

    expect(mediaCellAccessibilityLabel(layout.cells[0], 2, "ready")).toBe("Gol al 90'");
    expect(mediaCellAccessibilityLabel(layout.cells[1], 2, "ready")).toBe("Immagine 2 di 2");
  });
});

describe("durata video", () => {
  it.each([
    [48, "0:48"],
    [62, "1:02"],
    [3725, "1:02:05"],
  ])("%i secondi → %s", (seconds, expected) => {
    expect(formatPostVideoDuration(seconds)).toBe(expected);
  });

  it("non inventa una durata", () => {
    expect(formatPostVideoDuration(null)).toBeNull();
    expect(formatPostVideoDuration(0)).toBeNull();
  });

  it("la durata parlata usa singolare e plurale", () => {
    expect(spokenVideoDuration(48)).toBe("48 secondi");
    expect(spokenVideoDuration(61)).toBe("1 minuto e 1 secondo");
    expect(spokenVideoDuration(3725)).toBe("1 ora, 2 minuti e 5 secondi");
    expect(spokenVideoDuration(60)).toBe("1 minuto");
  });
});

describe("segmentBody", () => {
  const body = "Allenamento con @Marco Bianchi oggi";

  it("separa testo e mention secondo il range", () => {
    const segments = segmentBody(body, [mention({ end: 30, start: 16 })]);

    expect(segments).toEqual([
      { kind: "text", text: "Allenamento con " },
      { kind: "mention", mention: expect.objectContaining({ identityId: "p-marco" }), text: "@Marco Bianchi" },
      { kind: "text", text: " oggi" },
    ]);
  });

  it("senza mention restituisce un solo segmento di testo", () => {
    expect(segmentBody("Ciao", [])).toEqual([{ kind: "text", text: "Ciao" }]);
  });

  it("ignora range non validi senza perdere testo", () => {
    const joined = (mentions: FeedMention[]) =>
      segmentBody(body, mentions)
        .map((segment) => segment.text)
        .join("");

    for (const bad of [
      mention({ end: 99, start: 16 }),
      mention({ end: 10, start: 10 }),
      mention({ end: 5, start: 10 }),
      mention({ end: 30, start: -1 }),
      mention({ end: 30.5, start: 16 }),
    ]) {
      expect(segmentBody(body, [bad]).some((segment) => segment.kind === "mention")).toBe(false);
      expect(joined([bad])).toBe(body);
    }
  });

  it("tiene la prima di due mention sovrapposte", () => {
    const segments = segmentBody(body, [
      mention({ end: 30, identityId: "a", start: 16 }),
      mention({ end: 25, identityId: "b", start: 20 }),
    ]);
    const mentions = segments.filter((segment) => segment.kind === "mention");

    expect(mentions).toHaveLength(1);
    expect(mentions[0].kind === "mention" && mentions[0].mention.identityId).toBe("a");
  });

  it("accetta mention fornite in disordine", () => {
    const segments = segmentBody("@Aa e @Bb", [
      mention({ end: 9, identityId: "b", start: 6 }),
      mention({ end: 3, identityId: "a", start: 0 }),
    ]);

    expect(segments.map((segment) => segment.text)).toEqual(["@Aa", " e ", "@Bb"]);
  });

  it("non taglia una coppia surrogata (emoji)", () => {
    // "🔴" occupa due unità UTF-16: un range che ne taglia metà è scartato.
    const segments = segmentBody("a🔴b", [mention({ end: 2, start: 1 })]);

    expect(segments).toEqual([{ kind: "text", text: "a🔴b" }]);
  });

  it("testo vuoto: nessun segmento", () => {
    expect(segmentBody("", [mention()])).toEqual([]);
  });
});

describe("corpo e Mostra altro", () => {
  it("usa il corpo completo, ricade sull'estratto, ignora il solo spazio", () => {
    expect(postBodyText({ body: "completo", text: "estratto" })).toBe("completo");
    expect(postBodyText({ body: null, text: "estratto" })).toBe("estratto");
    expect(postBodyText({ body: "   ", text: null })).toBe("");
  });

  it("classifica breve, lungo e da misurare", () => {
    expect(classifyBodyLength("")).toBe("short");
    expect(classifyBodyLength("Ciao a tutti")).toBe("short");
    expect(classifyBodyLength("a\nb\nc\nd\ne\nf")).toBe("long");
    expect(classifyBodyLength("x".repeat(200))).toBe("unknown");
    expect(classifyBodyLength("x".repeat(480))).toBe("long");
  });

  it("sfora solo oltre le righe massime", () => {
    expect(bodyOverflows(5)).toBe(false);
    expect(bodyOverflows(6)).toBe(true);
  });
});

describe("summarizeTagged", () => {
  it("nessun tag: nessuna riga (§21)", () => {
    expect(summarizeTagged([], [])).toBeNull();
  });

  it("un tag → «Con X»", () => {
    expect(summarizeTagged([tag("p1", "Marco Bianchi")], [])?.text).toBe("Con Marco Bianchi");
  });

  it("più tag → «Con X e altre N persone» (§22)", () => {
    const summary = summarizeTagged(
      [tag("p1", "Marco Bianchi"), tag("p2", "A"), tag("p3", "B"), tag("p4", "C")],
      [],
    );

    expect(summary?.text).toBe("Con Marco Bianchi e altre 3 persone");
    expect(summary?.remaining).toHaveLength(4);
  });

  it("due tag → «e un'altra persona»", () => {
    expect(summarizeTagged([tag("p1", "Marco"), tag("p2", "Luca")], [])?.text).toBe(
      "Con Marco e un'altra persona",
    );
  });

  it("non conta come «persone» una Società taggata", () => {
    expect(summarizeTagged([tag("p1", "Marco"), tag("c1", "AC Como", "club")], [])?.text).toBe(
      "Con Marco e un altro",
    );
  });

  it("esclude le identità già menzionate nel testo (§21)", () => {
    const summary = summarizeTagged(
      [tag("p-marco", "Marco Bianchi"), tag("p2", "Luca")],
      [mention()],
    );

    expect(summary?.text).toBe("Con Luca");
  });

  it("se tutti i tag sono già menzionati la riga non c'è", () => {
    expect(summarizeTagged([tag("p-marco", "Marco Bianchi")], [mention()])).toBeNull();
  });

  it("lo stesso id con tipo diverso non è la stessa identità", () => {
    expect(summarizeTagged([tag("p-marco", "Marco", "club")], [mention()])?.text).toBe("Con Marco");
  });

  it("non ripete un tag duplicato", () => {
    expect(summarizeTagged([tag("p1", "Marco"), tag("p1", "Marco")], [])?.text).toBe("Con Marco");
  });
});

describe("riga autore", () => {
  const line = (
    identityType: Parameters<typeof buildAuthorMetaLine>[0]["identityType"],
    meta: Partial<FeedAuthorMeta>,
  ) =>
    buildAuthorMetaLine({
      identityType,
      meta: { ...emptyMeta, ...meta },
      now: NOW,
      publishedAt: TWO_HOURS_AGO,
    });

  it("persona: ruolo · Società · tempo (§5)", () => {
    expect(line("person", { clubName: "AC Como", role: "coach" })).toBe(
      "Allenatore · AC Como · 2 h",
    );
  });

  it("calciatore: la posizione al posto del ruolo generico", () => {
    expect(
      line("person", { clubName: "AC Como", primaryPosition: "striker", role: "player" }),
    ).toBe("Attaccante · AC Como · 2 h");
  });

  it("Allenatore o Staff senza Società: il contesto Team (§69)", () => {
    expect(line("person", { role: "coach", teamLabel: "Settore giovanile" })).toBe(
      "Allenatore · Settore giovanile · 2 h",
    );
    expect(line("person", { role: "staff", teamLabel: "Prima squadra" })).toBe(
      "Staff · Prima squadra · 2 h",
    );
  });

  it("Team e Società non compaiono insieme (§9, §69)", () => {
    expect(line("person", { clubName: "AC Como", role: "coach", teamLabel: "Under 17" })).toBe(
      "Allenatore · AC Como · 2 h",
    );
  });

  it("un calciatore non mostra il Team quando manca la Società", () => {
    expect(
      line("person", { primaryPosition: "striker", role: "player", teamLabel: "Primavera" }),
    ).toBe("Attaccante · 2 h");
  });

  it("Società: categoria · tempo, senza il prefisso «Società»", () => {
    expect(line("society", { clubCategory: "Serie D" })).toBe("Serie D · 2 h");
  });

  it("Media: tipologia · tempo", () => {
    expect(line("media", { mediaKind: "testata" })).toBe("Testata sportiva · 2 h");
  });

  it("non mostra mai «Profilo ufficiale» né un kind sconosciuto (§8)", () => {
    expect(line("media", { mediaKind: "ufficiale" })).toBe("2 h");
    expect(line("media", { mediaKind: "qualcosa" })).toBe("2 h");
    expect(authorMetaParts("media", { ...emptyMeta, mediaKind: "ufficiale" })).toEqual([]);
  });

  it("dati mancanti: resta il tempo, senza separatori spuri", () => {
    expect(line("person", {})).toBe("2 h");
    expect(
      buildAuthorMetaLine({
        identityType: "person",
        meta: emptyMeta,
        now: NOW,
        publishedAt: null,
      }),
    ).toBe("");
  });

  it("etichetta accessibile dell'autore (§75)", () => {
    expect(
      buildAuthorAccessibilityLabel({
        identityType: "person",
        isVerified: true,
        meta: { ...emptyMeta, clubName: "AC Como", primaryPosition: "striker", role: "player" },
        name: "Matteo Rossi",
        now: NOW,
        publishedAt: TWO_HOURS_AGO,
      }),
    ).toBe("Matteo Rossi, profilo verificato, Attaccante AC Como, pubblicato 2 ore fa");
  });

  it("senza verifica non dice «profilo verificato»", () => {
    expect(
      buildAuthorAccessibilityLabel({
        identityType: "society",
        isVerified: false,
        meta: { ...emptyMeta, clubCategory: "Serie D" },
        name: "AC Como",
        now: NOW,
        publishedAt: TWO_HOURS_AGO,
      }),
    ).toBe("AC Como, Serie D, pubblicato 2 ore fa");
  });
});

describe("buildPostActionModel", () => {
  it("zero: solo le label, mai «0» (§50, §55)", () => {
    const model = buildPostActionModel({ commentsCount: 0, isLiked: false, likesCount: 0 });

    expect(model.like.text).toBe("Mi piace");
    expect(model.comment.text).toBe("Commenta");
    expect(model.like.accessibilityLabel).toBe("Mi piace");
    expect(model.comment.accessibilityLabel).toBe("Commenta");
  });

  it("con conteggi: solo il numero, label accessibile con il nome (§107)", () => {
    const model = buildPostActionModel({ commentsCount: 18, isLiked: false, likesCount: 146 });

    expect(model.like.text).toBe("146");
    expect(model.like.accessibilityLabel).toBe("146 Mi piace");
    expect(model.comment.text).toBe("18");
    expect(model.comment.accessibilityLabel).toBe("18 commenti");
  });

  it("formato italiano, mai 1,2K (§105)", () => {
    const model = buildPostActionModel({ commentsCount: 12486, isLiked: false, likesCount: 1234 });

    expect(model.like.text).toBe("1.234");
    expect(model.comment.text).toBe("12.486");
  });

  it("un solo commento usa il singolare", () => {
    expect(
      buildPostActionModel({ commentsCount: 1, isLiked: false, likesCount: 0 }).comment
        .accessibilityLabel,
    ).toBe("1 commento");
  });

  it("lo stato attivo sta nello stesso controllo e conserva il numero (§52)", () => {
    const model = buildPostActionModel({ commentsCount: 0, isLiked: true, likesCount: 147 });

    expect(model.like.selected).toBe(true);
    expect(model.like.text).toBe("147");
  });

  it("Condividi non ha mai un conteggio (§58)", () => {
    expect(
      buildPostActionModel({ commentsCount: 5, isLiked: false, likesCount: 5 }).share.text,
    ).toBe("Condividi");
  });
});

describe("linkPreviewDomain", () => {
  it("usa il dominio ricevuto", () => {
    expect(linkPreviewDomain({ domain: "gazzetta.it", url: "https://www.gazzetta.it/a/b?c=1" })).toBe(
      "gazzetta.it",
    );
  });

  it("ricade sull'host dell'URL se il dominio manca", () => {
    expect(linkPreviewDomain({ domain: " ", url: "https://www.gazzetta.it/a/b?c=1" })).toBe(
      "gazzetta.it",
    );
  });
});
