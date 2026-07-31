import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatContentSourceLine,
  formatMediaAge,
  formatMediaFormatLabel,
  formatMediaResultsCount,
  formatSourceFocus,
  formatSourceKindLabel,
  formatSourceMeta,
  formatVideoDuration,
} from "./media-labels";
import type { MediaContentRow, MediaSourceRowData } from "./media-search-types";

function makeContentRow(overrides: Partial<MediaContentRow> = {}): MediaContentRow {
  return {
    content_format: "articolo",
    content_type: "media_profile",
    duration_seconds: null,
    is_saved: false,
    kind: "article",
    kind_label: "Articolo",
    media_type: null,
    post_id: "c1",
    published_at: "2026-07-31T08:00:00.000Z",
    publisher_avatar_url: null,
    publisher_id: "m1",
    publisher_name: "Como Football News",
    publisher_type: "profile",
    source_kind: "testata",
    thumbnail_url: null,
    title: "AC Como, tre nuovi innesti",
    total_count: 1,
    ...overrides,
  };
}

function makeSourceRow(overrides: Partial<MediaSourceRowData> = {}): MediaSourceRowData {
  return {
    avatar_url: null,
    categories: ["Serie D"],
    content_count: 2,
    description: "Serie D e calcio lombardo",
    entity_id: "m1",
    is_following: false,
    is_verified: true,
    last_published_at: null,
    name: "Como Football News",
    regions: ["Lombardia"],
    source_kind: "testata",
    source_type: "media_profile",
    topics: ["Mercato"],
    total_count: 1,
    ...overrides,
  };
}

describe("formatMediaFormatLabel", () => {
  it("maps every format to its Italian label", () => {
    expect(formatMediaFormatLabel("articolo")).toBe("Articolo");
    expect(formatMediaFormatLabel("video")).toBe("Video");
    expect(formatMediaFormatLabel("foto")).toBe("Foto");
    expect(formatMediaFormatLabel("post")).toBe("Post");
  });
});

describe("formatSourceKindLabel", () => {
  it("maps every source kind", () => {
    expect(formatSourceKindLabel("ufficiale")).toBe("Profilo ufficiale");
    expect(formatSourceKindLabel("testata")).toBe("Testata sportiva");
    expect(formatSourceKindLabel("giornalista")).toBe("Giornalista sportivo");
    expect(formatSourceKindLabel("creator")).toBe("Creator");
    expect(formatSourceKindLabel("pagina")).toBe("Pagina sportiva");
    expect(formatSourceKindLabel("tifoso")).toBe("Profilo tifoso");
  });
});

describe("formatVideoDuration", () => {
  it("pads minutes and seconds", () => {
    expect(formatVideoDuration(154)).toBe("02:34");
    expect(formatVideoDuration(9)).toBe("00:09");
  });

  it("adds an hours segment past one hour", () => {
    expect(formatVideoDuration(3754)).toBe("1:02:34");
  });

  it("returns null when there is no usable duration", () => {
    expect(formatVideoDuration(null)).toBeNull();
    expect(formatVideoDuration(0)).toBeNull();
    expect(formatVideoDuration(-5)).toBeNull();
  });
});

describe("formatMediaAge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("collapses the first hour to 'adesso'", () => {
    expect(formatMediaAge("2026-07-31T09:30:00.000Z")).toBe("adesso");
  });

  it("shows whole hours within the day", () => {
    expect(formatMediaAge("2026-07-31T08:00:00.000Z")).toBe("2 h");
  });

  it("shows 'ieri' for the previous calendar day", () => {
    expect(formatMediaAge("2026-07-30T09:00:00.000Z")).toBe("ieri");
  });

  it("shows days within the week", () => {
    expect(formatMediaAge("2026-07-28T09:00:00.000Z")).toBe("3 gg");
  });

  it("falls back to a short date beyond a week", () => {
    expect(formatMediaAge("2026-07-01T09:00:00.000Z")).toMatch(/lug/);
  });

  it("returns an empty string for missing or invalid dates", () => {
    expect(formatMediaAge(null)).toBe("");
    expect(formatMediaAge("not-a-date")).toBe("");
  });
});

describe("formatContentSourceLine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("joins publisher and relative age", () => {
    expect(formatContentSourceLine(makeContentRow())).toBe("Como Football News · 2 h");
  });

  it("omits the age when the date is missing", () => {
    expect(formatContentSourceLine(makeContentRow({ published_at: null }))).toBe(
      "Como Football News",
    );
  });
});

describe("formatSourceMeta", () => {
  it("joins the source kind and the first territory", () => {
    expect(formatSourceMeta(makeSourceRow())).toBe("Testata sportiva · Lombardia");
  });

  it("omits the territory when unknown", () => {
    expect(formatSourceMeta(makeSourceRow({ regions: [] }))).toBe("Testata sportiva");
  });
});

describe("formatSourceFocus", () => {
  it("prefers the description", () => {
    expect(formatSourceFocus(makeSourceRow())).toBe("Serie D e calcio lombardo");
  });

  it("falls back to categories and topics", () => {
    expect(formatSourceFocus(makeSourceRow({ description: null }))).toBe(
      "Serie D, Mercato",
    );
  });

  it("returns null when there is nothing to show", () => {
    expect(
      formatSourceFocus(makeSourceRow({ categories: [], description: "  ", topics: [] })),
    ).toBeNull();
  });
});

describe("formatMediaResultsCount", () => {
  it("uses the singular for one result", () => {
    expect(formatMediaResultsCount(1)).toBe("1 risultato");
  });

  it("uses the plural otherwise", () => {
    expect(formatMediaResultsCount(0)).toBe("0 risultati");
    expect(formatMediaResultsCount(42)).toBe("42 risultati");
  });

  it("returns null when the total is unknown", () => {
    expect(formatMediaResultsCount(null)).toBeNull();
  });
});
