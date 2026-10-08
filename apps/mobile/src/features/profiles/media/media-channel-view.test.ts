import { describe, expect, it } from "vitest";

import { buildMediaChannelRows } from "./media-channel-view";

describe("canali ufficiali", () => {
  it("mostra il sito web per primo e i social nell'ordine dell'onboarding", () => {
    const rows = buildMediaChannelRows([
      { channelType: "facebook", label: null, url: "facebook.com/td" },
      { channelType: "youtube", label: null, url: "youtube.com/@td" },
      { channelType: "website", label: null, url: "tuttodilettanti.it" },
      { channelType: "instagram", label: null, url: "instagram.com/td" },
    ]);

    expect(rows.map((row) => row.key)).toEqual([
      "website",
      "instagram",
      "youtube",
      "facebook",
    ]);
  });

  it("usa l'etichetta canonica quando la realtà non ne ha una propria", () => {
    const rows = buildMediaChannelRows([
      { channelType: "website", label: null, url: "tuttodilettanti.it" },
      { channelType: "tiktok", label: "  ", url: "tiktok.com/@td" },
    ]);

    expect(rows.map((row) => row.label)).toEqual(["Sito web", "TikTok"]);
  });

  it("preferisce l'etichetta curata dalla realtà", () => {
    const rows = buildMediaChannelRows([
      {
        channelType: "newsletter",
        label: "La newsletter del lunedì",
        url: "newsletter.tuttodilettanti.it",
      },
    ]);

    expect(rows[0]?.label).toBe("La newsletter del lunedì");
  });

  it("normalizza l'URL e non espone quello completo come etichetta", () => {
    const rows = buildMediaChannelRows([
      { channelType: "website", label: null, url: "tuttodilettanti.it" },
    ]);

    expect(rows[0]?.url).toBe("https://tuttodilettanti.it");
    expect(rows[0]?.label).toBe("Sito web");
  });

  it("scarta un canale con un URL non apribile", () => {
    const rows = buildMediaChannelRows([
      { channelType: "website", label: null, url: "javascript:alert(1)" },
      { channelType: "instagram", label: null, url: "   " },
      { channelType: "youtube", label: null, url: "data:text/html,<script>" },
    ]);

    expect(rows).toEqual([]);
  });

  it("scarta un tipo di canale non supportato", () => {
    const rows = buildMediaChannelRows([
      { channelType: "telegram", label: null, url: "t.me/td" },
      { channelType: "website", label: null, url: "tuttodilettanti.it" },
    ]);

    expect(rows.map((row) => row.key)).toEqual(["website"]);
  });

  it("deduplica per tipo tenendo la prima sorgente", () => {
    const rows = buildMediaChannelRows([
      { channelType: "website", label: "Curato", url: "curato.it" },
      { channelType: "website", label: null, url: "onboarding.it" },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.label).toBe("Curato");
    expect(rows[0]?.url).toBe("https://curato.it");
  });

  it("non inventa righe quando non ci sono canali", () => {
    expect(buildMediaChannelRows([])).toEqual([]);
  });
});
