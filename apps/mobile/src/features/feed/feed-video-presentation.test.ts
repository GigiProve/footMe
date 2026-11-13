import { describe, expect, it } from "vitest";

import {
  ARTICLE_STACKED_FONT_SCALE,
  articleAccessibilityLabel,
  articleCoverAltText,
  articleCoverUri,
  articleLayoutFor,
  bookmarkAccessibilityLabel,
  buildEditorialAccessibilityLabel,
  buildEditorialMetaLine,
  editorialVideoMedia,
  formatPlayerClock,
  hasPlayedToEnd,
  legacyVideoMedia,
  pickPlaybackSource,
  playbackRatio,
  playerClockLabel,
  progressAccessibilityValue,
  resolveDuration,
  seekBy,
  seekTarget,
  videoMediaState,
  videoPlayAccessibilityLabel,
  videoStateAccessibilityLabel,
  videoStateCopy,
} from "./feed-video-presentation";
import { isProcessingState, mediaCellState } from "./feed-post-presentation";
import type { FeedMediaItem } from "./feed-types";

const NOW = new Date("2026-11-12T12:00:00.000Z");

function video(overrides: Partial<FeedMediaItem> = {}): FeedMediaItem {
  return {
    altText: null,
    aspectRatio: null,
    availability: "available",
    captions: [],
    createdAt: null,
    durationSeconds: 48,
    height: null,
    id: "v",
    position: 0,
    processingState: "ready",
    thumbnailUrl: "https://cdn.test/t.jpg",
    type: "video",
    url: "https://cdn.test/v.mp4",
    variants: [],
    width: null,
    ...overrides,
  };
}

describe("stato del video (§61–70, §114)", () => {
  it("pronto con una sorgente è riproducibile", () => {
    expect(videoMediaState(video())).toBe("ready");
  });

  it("uploaded e processing sono lo stesso stato «in elaborazione»", () => {
    expect(isProcessingState("uploaded")).toBe(true);
    expect(isProcessingState("processing")).toBe(true);
    expect(isProcessingState("ready")).toBe(false);
    expect(videoMediaState(video({ processingState: "processing" }))).toBe("processing");
    expect(videoMediaState(video({ processingState: "uploaded" as never }))).toBe("processing");
    expect(mediaCellState(video({ processingState: "uploaded" as never }))).toBe("processing");
  });

  it("in elaborazione resta tale anche senza url e con disponibilità negata", () => {
    expect(
      videoMediaState(video({ availability: "unavailable", processingState: "processing", url: null })),
    ).toBe("processing");
  });

  it("failed o non disponibile → non disponibile", () => {
    expect(videoMediaState(video({ processingState: "failed" }))).toBe("unavailable");
    expect(videoMediaState(video({ availability: "unavailable" }))).toBe("unavailable");
  });

  it("pronto ma senza alcuna sorgente → non disponibile, mai un Play che non funziona", () => {
    expect(videoMediaState(video({ url: null }))).toBe("unavailable");
  });

  it("il copy è quello definitivo del §113", () => {
    expect(videoStateCopy("processing")).toEqual({
      helper: "Il video sarà disponibile a breve.",
      title: "Video in elaborazione",
    });
    expect(videoStateCopy("unavailable")).toEqual({
      helper: "Il contenuto non è al momento accessibile.",
      title: "Video non disponibile",
    });
    expect(videoStateCopy("ready")).toBeNull();
  });

  it("l'etichetta parlata unisce titolo e helper, senza codici (§83, §114)", () => {
    const label = videoStateAccessibilityLabel("processing");

    expect(label).toBe("Video in elaborazione. Il video sarà disponibile a breve.");
    expect(label).not.toMatch(/uploaded|processing|transcoding|404|CDN/i);
    expect(videoStateAccessibilityLabel("ready")).toBeNull();
  });
});

describe("sorgente di riproduzione (§72)", () => {
  it("senza varianti usa l'url del media", () => {
    expect(pickPlaybackSource({ url: "https://cdn.test/v.mp4", variants: [] })).toEqual({
      contentType: "auto",
      uri: "https://cdn.test/v.mp4",
    });
  });

  it("preferisce lo streaming adattivo tra le varianti", () => {
    const source = pickPlaybackSource({
      url: "https://cdn.test/v.mp4",
      variants: [
        { bitrate: 1, height: 720, mimeType: "video/mp4", url: "https://cdn.test/720.mp4", width: 1280 },
        {
          bitrate: null,
          height: null,
          mimeType: "application/x-mpegURL",
          url: "https://cdn.test/master",
          width: null,
        },
      ],
    });

    expect(source).toEqual({ contentType: "hls", uri: "https://cdn.test/master" });
  });

  it("riconosce HLS dall'estensione anche senza mime type", () => {
    expect(pickPlaybackSource({ url: "https://cdn.test/v/master.m3u8?t=1", variants: [] })).toEqual({
      contentType: "hls",
      uri: "https://cdn.test/v/master.m3u8?t=1",
    });
  });

  it("senza url usa la prima variante; senza nulla non c'è sorgente", () => {
    expect(
      pickPlaybackSource({
        url: null,
        variants: [{ bitrate: null, height: null, mimeType: "video/mp4", url: "https://cdn.test/a.mp4", width: null }],
      }),
    ).toEqual({ contentType: "auto", uri: "https://cdn.test/a.mp4" });
    expect(pickPlaybackSource({ url: null, variants: [] })).toBeNull();
  });
});

describe("etichetta del Play (§83)", () => {
  it("dice la durata parlata", () => {
    expect(videoPlayAccessibilityLabel({ altText: null, durationSeconds: 48 })).toBe(
      "Riproduci video, durata 48 secondi",
    );
    expect(videoPlayAccessibilityLabel({ altText: null, durationSeconds: null })).toBe(
      "Riproduci video",
    );
  });

  it("antepone l'alt text", () => {
    expect(videoPlayAccessibilityLabel({ altText: "Gol di Rossi", durationSeconds: 90 })).toBe(
      "Gol di Rossi. Riproduci video, durata 1 minuto e 30 secondi",
    );
  });
});

describe("orologio e avanzamento (§14)", () => {
  it.each([
    [0, "0:00"],
    [18, "0:18"],
    [48.9, "0:48"],
    [72, "1:12"],
    [3725, "1:02:05"],
    [-5, "0:00"],
    [Number.NaN, "0:00"],
    [null, "0:00"],
  ])("%s → %s", (seconds, expected) => {
    expect(formatPlayerClock(seconds as number | null)).toBe(expected);
  });

  it("«0:18 / 0:48» come nel visual master", () => {
    expect(playerClockLabel(18, 48)).toBe("0:18 / 0:48");
    expect(progressAccessibilityValue(18, 48)).toBe("0:18 di 0:48");
  });

  it("la durata del player vince, i metadata fanno da ripiego", () => {
    expect(resolveDuration(51, 48)).toBe(51);
    expect(resolveDuration(0, 48)).toBe(48);
    expect(resolveDuration(Number.NaN, null)).toBe(0);
  });

  it("rapporto di avanzamento limitato a 0–1; durata ignota → 0", () => {
    expect(playbackRatio(12, 48)).toBe(0.25);
    expect(playbackRatio(60, 48)).toBe(1);
    expect(playbackRatio(-1, 48)).toBe(0);
    expect(playbackRatio(10, 0)).toBe(0);
  });

  it("tap sulla barra e salti restano dentro il video", () => {
    expect(seekTarget(0.5, 48)).toBe(24);
    expect(seekTarget(2, 48)).toBe(48);
    expect(seekTarget(Number.NaN, 48)).toBe(0);
    expect(seekBy(40, 10, 48)).toBe(48);
    expect(seekBy(3, -10, 48)).toBe(0);
    expect(seekBy(3, 10, 0)).toBe(13);
  });

  it("concluso entro mezzo secondo dalla fine", () => {
    expect(hasPlayedToEnd(47.6, 48)).toBe(true);
    expect(hasPlayedToEnd(30, 48)).toBe(false);
    expect(hasPlayedToEnd(5, 0)).toBe(false);
  });
});

describe("riga meta e accessibilità editoriale (§32, §85)", () => {
  const publishedAt = "2026-11-12T09:00:00.000Z";

  it("il formato è l'etichetta: «Video · 3 h», «Articolo · 3 h»", () => {
    expect(buildEditorialMetaLine({ now: NOW, publishedAt, type: "video" })).toBe("Video · 3 h");
    expect(buildEditorialMetaLine({ now: NOW, publishedAt, type: "article" })).toBe("Articolo · 3 h");
  });

  it("senza data resta solo il formato", () => {
    expect(buildEditorialMetaLine({ now: NOW, publishedAt: null, type: "article" })).toBe("Articolo");
  });

  it("non compaiono mai «Profilo ufficiale» né «Società»", () => {
    const line = buildEditorialMetaLine({ now: NOW, publishedAt, type: "article" });

    expect(line).not.toMatch(/Profilo ufficiale|Società/);
  });

  it("etichetta parlata dell'autore con verifica, formato e tempo", () => {
    expect(
      buildEditorialAccessibilityLabel({
        isVerified: true,
        name: "Gazzetta dello Sport",
        now: NOW,
        publishedAt,
        type: "article",
      }),
    ).toBe("Gazzetta dello Sport, profilo verificato, Articolo, pubblicato 3 ore fa");
  });

  it("il segnalibro dice il suo stato a parole", () => {
    expect(bookmarkAccessibilityLabel(false)).toBe("Salva");
    expect(bookmarkAccessibilityLabel(true)).toBe("Rimuovi dai salvati");
  });

  it("etichetta della preview: titolo e sommario", () => {
    expect(articleAccessibilityLabel("Titolo", "Sommario")).toBe("Titolo. Sommario");
    expect(articleAccessibilityLabel("Titolo", null)).toBe("Titolo");
    expect(articleAccessibilityLabel(null, null)).toBeUndefined();
  });
});

describe("layout dell'Articolo (§43, §127)", () => {
  it("orizzontale a font normale, verticale da 1,3 in su", () => {
    expect(articleLayoutFor(1)).toBe("horizontal");
    expect(articleLayoutFor(1.29)).toBe("horizontal");
    expect(articleLayoutFor(ARTICLE_STACKED_FONT_SCALE)).toBe("stacked");
    expect(articleLayoutFor(2)).toBe("stacked");
    expect(articleLayoutFor(Number.NaN)).toBe("horizontal");
  });

  it("la cover è la prima immagine, poi la miniatura legacy", () => {
    const payload = {
      media: [
        video({ position: 0 }),
        { ...video({ position: 2 }), id: "i2", thumbnailUrl: "https://cdn.test/i2.jpg", type: "image" as const },
        { ...video({ position: 1 }), id: "i1", thumbnailUrl: "https://cdn.test/i1.jpg", type: "image" as const },
      ],
      thumbnailUrl: "https://cdn.test/legacy.jpg",
    };

    expect(articleCoverUri(payload)).toBe("https://cdn.test/i1.jpg");
    expect(articleCoverUri({ media: [], thumbnailUrl: "https://cdn.test/legacy.jpg" })).toBe(
      "https://cdn.test/legacy.jpg",
    );
    expect(articleCoverUri({ media: [], thumbnailUrl: null })).toBeNull();
  });

  it("alt text della cover: quello del media, altrimenti il titolo", () => {
    const withAlt = { media: [{ ...video(), altText: "Stadio", type: "image" as const }] };

    expect(articleCoverAltText(withAlt, "Titolo")).toBe("Stadio");
    expect(articleCoverAltText({ media: [] }, "Titolo")).toBe("Copertina: Titolo");
    expect(articleCoverAltText({ media: [] }, null)).toBe("Copertina dell'articolo");
  });

  it("il video editoriale è il primo video della collezione", () => {
    expect(editorialVideoMedia({ media: [video({ id: "b", position: 1 }), video({ id: "a", position: 0 })] })?.id).toBe("a");
    expect(editorialVideoMedia({ media: [] })).toBeNull();
  });
});

describe("video del dettaglio storico (§35)", () => {
  it("un video con url è pronto e riproducibile", () => {
    const media = legacyVideoMedia({
      durationSeconds: 95,
      id: "x",
      thumbnailUrl: "https://cdn.test/t.jpg",
      url: "https://cdn.test/v.mp4",
    });

    expect(videoMediaState(media)).toBe("ready");
    expect(media.durationSeconds).toBe(95);
  });

  it("senza url non è riproducibile", () => {
    expect(
      videoMediaState(legacyVideoMedia({ durationSeconds: null, id: "x", thumbnailUrl: null, url: null })),
    ).toBe("unavailable");
  });
});
