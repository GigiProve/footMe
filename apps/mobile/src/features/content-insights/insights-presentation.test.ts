import { describe, expect, it } from "vitest";

import { makeInsights } from "./insights-fixtures";
import {
  buildActionRows,
  buildArticleRows,
  buildEngagementRows,
  buildInsightSentence,
  buildInsightsViewModel,
  buildKpis,
  buildPeriodOptions,
  buildPreviewModel,
  buildSourceRows,
  buildVideoRows,
  chunkItems,
  formatDuration,
  formatInsightPercent,
  formatMetricNumber,
  formatPercent,
  formatPublishedAt,
  formatUpdatedLabel,
  insightsLayoutFor,
  resolveInsightsScreenState,
  resolvePeriod,
  resolveTrendState,
  trendAccessibilitySummary,
  trendAxisLabels,
  trendAxisWidth,
  trendGeometry,
  trendScale,
} from "./insights-presentation";
import type { ContentInsightsTrend } from "./insights-types";

const NOW = new Date(2026, 7, 19, 12, 0);

describe("formattazione (§31, §92, §168)", () => {
  it("numeri in formato italiano", () => {
    expect(formatMetricNumber(4820)).toBe("4.820");
    expect(formatMetricNumber(284)).toBe("284");
    expect(formatMetricNumber(1234567)).toBe("1.234.567");
  });

  it("percentuali con la virgola", () => {
    expect(formatPercent(56)).toBe("56%");
    expect(formatPercent(21.8)).toBe("21,8%");
    expect(formatInsightPercent(4)).toBe("4,0%");
  });

  it("durate: sec e min", () => {
    expect(formatDuration(27)).toBe("27 sec");
    expect(formatDuration(134)).toBe("2 min 14 sec");
    expect(formatDuration(120)).toBe("2 min");
    expect(formatDuration(3900)).toBe("1 h 5 min");
    expect(formatDuration(0)).toBe("0 sec");
  });

  it("data di pubblicazione «18 ago 2026, 19:42»", () => {
    expect(formatPublishedAt(new Date(2026, 7, 18, 19, 42).toISOString())).toBe("18 ago 2026, 19:42");
    expect(formatPublishedAt("non-una-data")).toBe("");
  });

  it("«Aggiornato pochi minuti fa» e mai un timestamp tecnico (§129)", () => {
    expect(formatUpdatedLabel(new Date(2026, 7, 19, 11, 59, 40).toISOString(), NOW)).toBe("Aggiornato ora");
    expect(formatUpdatedLabel(new Date(2026, 7, 19, 11, 55).toISOString(), NOW)).toBe(
      "Aggiornato pochi minuti fa",
    );
    expect(formatUpdatedLabel(new Date(2026, 7, 19, 11, 30).toISOString(), NOW)).toBe(
      "Aggiornato 30 minuti fa",
    );
    expect(formatUpdatedLabel("x", NOW)).toBeNull();
  });
});

describe("preview (§20–25)", () => {
  it("esempio del §22", () => {
    const model = buildPreviewModel(makeInsights().content_preview);

    expect(model.title).toBe("Allenamento e obiettivi per la nuova stagione");
    expect(model.meta).toBe("Post con foto · 18 ago 2026, 19:42");
    expect(model.authorName).toBe("Matteo Rossi");
    expect(model.isVerified).toBe(true);
    expect(model.authorAccessibilityLabel).toBe("Matteo Rossi, profilo verificato");
    expect(model.isVideo).toBe(false);
    expect(model.durationLabel).toBeNull();
  });

  it("senza titolo usa le prime righe", () => {
    const base = makeInsights().content_preview;
    const model = buildPreviewModel({ ...base, excerpt: " Prime righe ", format: "text", title: null });

    expect(model.title).toBe("Prime righe");
    expect(model.meta.startsWith("Post testuale")).toBe(true);
  });

  it("video: Play e durata, non un player (§23)", () => {
    const base = makeInsights().content_preview;
    const model = buildPreviewModel({ ...base, duration_seconds: 84, format: "editorial_video", item_type: "video" });

    expect(model.isVideo).toBe(true);
    expect(model.durationLabel).toBe("1:24");
    expect(model.typeLabel).toBe("Video");
  });

  it("articolo", () => {
    const base = makeInsights().content_preview;

    expect(buildPreviewModel({ ...base, format: "article", item_type: "article" }).typeLabel).toBe("Articolo");
  });
});

describe("Interazioni: null nascosto, 0 reale (§36–40, §118–120)", () => {
  it("ordine definitivo e Repost nascosto se null (§182)", () => {
    const rows = buildEngagementRows(makeInsights().engagement);

    expect(rows.map((row) => row.key)).toEqual(["likes", "comments", "shares", "saves"]);
    expect(rows.some((row) => row.label === "Repost")).toBe(false);
  });

  it("Repost disponibile: compare dopo Condivisioni e distinto da esse (§39)", () => {
    const rows = buildEngagementRows({ comments: 1, likes: 2, reposts: 12, saves: 3, shares: 18 });

    expect(rows.map((row) => row.key)).toEqual(["likes", "comments", "shares", "reposts", "saves"]);
    expect(rows.find((row) => row.key === "reposts")?.value).toBe("12");
    expect(rows.find((row) => row.key === "shares")?.value).toBe("18");
  });

  it("uno zero reale si mostra («Commenti 0», §119)", () => {
    const rows = buildEngagementRows({ comments: 0, likes: 5, reposts: null, saves: null, shares: null });

    expect(rows.find((row) => row.key === "comments")?.value).toBe("0");
  });

  it("niente righe → sezione assente", () => {
    expect(buildEngagementRows(null)).toEqual([]);
    expect(
      buildEngagementRows({ comments: null, likes: null, reposts: null, saves: null, shares: null }),
    ).toEqual([]);
  });

  it("a11y letta per esteso", () => {
    const rows = buildEngagementRows({ comments: 1, likes: 196, reposts: null, saves: 47, shares: null });

    expect(rows.find((row) => row.key === "comments")?.accessibilityLabel).toBe("1 commento");
    expect(rows.find((row) => row.key === "saves")?.accessibilityLabel).toBe("47 salvataggi");
  });

  it("stato iniziale: restano solo i valori già maggiori di zero (§122–123)", () => {
    const rows = buildEngagementRows(
      { comments: 0, likes: 3, reposts: null, saves: 0, shares: null },
      { onlyPositive: true },
    );

    expect(rows.map((row) => row.key)).toEqual(["likes"]);
  });
});

describe("Azioni generate (§45–61)", () => {
  it("solo le azioni applicabili, nell'ordine del §47", () => {
    const rows = buildActionRows(makeInsights().professional_actions);

    expect(rows.map((row) => row.label)).toEqual([
      "Visite al profilo",
      "Nuovi follower",
      "Aperture profili taggati",
      "Visite alla Società",
    ]);
  });

  it("Società: nessuna «Visite al profilo» quando il server la manda null (§48)", () => {
    const rows = buildActionRows({
      insight: null,
      linked_content_opens: null,
      new_followers: 4,
      profile_visits: null,
      society_visits: 9,
      tagged_opens: null,
    });

    expect(rows.map((row) => row.key)).toEqual(["new_followers", "society_visits"]);
  });

  it("blocco assente → nessuna riga", () => {
    expect(buildActionRows(null)).toEqual([]);
  });

  it("insight neutrale solo se il server lo manda (§58, §185)", () => {
    const actions = makeInsights().professional_actions;

    expect(buildInsightSentence(actions)).toBe("Il 4,0% dei profili raggiunti ha visitato il tuo profilo.");
    expect(buildInsightSentence(actions && { ...actions, insight: null })).toBeNull();
    expect(
      buildInsightSentence(actions && { ...actions, insight: { kind: "profile_visit_rate", percent: 0 } }),
    ).toBeNull();
    expect(
      buildInsightSentence(actions && { ...actions, insight: { kind: "society_visit_rate", percent: 3.25 } }),
    ).toBe("Il 3,3% dei profili raggiunti ha visitato la Società.");
  });
});

describe("Panoramica: al massimo quattro KPI (§28–31, §179–180)", () => {
  it("i quattro KPI nell'ordine del §31, senza «Tasso di interazione»", () => {
    const kpis = buildKpis(makeInsights(), { hasActionRows: true });

    expect(kpis.map((kpi) => kpi.label)).toEqual([
      "Visualizzazioni",
      "Profili raggiunti",
      "Interazioni",
      "Azioni generate",
    ]);
    expect(kpis.map((kpi) => kpi.value)).toEqual(["4.820", "3.160", "284", "190"]);
    expect(kpis.length).toBeLessThanOrEqual(4);
    expect(JSON.stringify(kpis)).not.toMatch(/Tasso di interazione/i);
  });

  it("a11y: «4.820 visualizzazioni» (§168), singolare per 1", () => {
    const kpis = buildKpis(
      makeInsights({ overview: { generated_actions: 1, interactions: 1, reach: 1, views: 4820 } }),
      { hasActionRows: true },
    );

    expect(kpis[0].accessibilityLabel).toBe("4.820 visualizzazioni");
    expect(kpis[1].accessibilityLabel).toBe("1 profilo raggiunto");
    expect(kpis[3].accessibilityLabel).toBe("1 azione generata");
  });

  it("un KPI null non c'è; Azioni generate 0 senza sezione non c'è", () => {
    const kpis = buildKpis(
      makeInsights({ overview: { generated_actions: 0, interactions: null, reach: 10, views: 12 } }),
      { hasActionRows: false },
    );

    expect(kpis.map((kpi) => kpi.key)).toEqual(["views", "reach"]);
  });

  it("griglia 2×2 e colonna con font grandi (§167)", () => {
    expect(chunkItems([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
    expect(chunkItems([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
    expect(chunkItems([1, 2], 1)).toEqual([[1], [2]]);
    expect(insightsLayoutFor(1)).toBe("grid");
    expect(insightsLayoutFor(1.3)).toBe("stacked");
    expect(insightsLayoutFor(Number.NaN)).toBe("grid");
  });
});

describe("Origine delle visualizzazioni (§76–84)", () => {
  it("etichette del mockup, Condivisioni e Messaggi fusi", () => {
    const rows = buildSourceRows(makeInsights().traffic_sources);

    expect(rows.map((row) => [row.label, row.percentLabel])).toEqual([
      ["Home · Per te", "58%"],
      ["Home · Seguiti", "21%"],
      ["Profilo", "11%"],
      ["Cerca", "6%"],
      ["Condivisioni e Messaggi", "4%"],
    ]);
  });

  it("Altro sempre ultima; sorgente sconosciuta confluisce in Altro (§80)", () => {
    const rows = buildSourceRows([
      { percent: 40, source: "OTHER" },
      { percent: 3, source: "SEARCH" },
      { percent: 52, source: "PROFILE" },
      { percent: 5, source: "FUTURE_THING" as never },
    ]);

    expect(rows.map((row) => row.label)).toEqual(["Profilo", "Cerca", "Altro"]);
    expect(rows[2].percent).toBe(45);
  });

  it("vuota o con percentuali non valide → nessuna riga", () => {
    expect(buildSourceRows([])).toEqual([]);
    expect(buildSourceRows([{ percent: 0, source: "SEARCH" }])).toEqual([]);
  });

  it("barra 0–1 e a11y con la percentuale scritta (§170)", () => {
    const [row] = buildSourceRows([{ percent: 58, source: "HOME_FOR_YOU" }]);

    expect(row.barRatio).toBeCloseTo(0.58);
    expect(row.accessibilityLabel).toBe("Home · Per te, 58 percento");
  });
});

describe("Prestazioni video e articolo (§90–113)", () => {
  it("video: solo Riproduzioni, Tempo medio, Completamento", () => {
    const rows = buildVideoRows({ avg_watch_seconds: 27, completion_percent: 56, plays: 3840 });

    expect(rows.map((row) => [row.label, row.value])).toEqual([
      ["Riproduzioni", "3.840"],
      ["Tempo medio di visualizzazione", "27 sec"],
      ["Completamento", "56%"],
    ]);
  });

  it("video senza play: righe null nascoste", () => {
    expect(buildVideoRows({ avg_watch_seconds: null, completion_percent: null, plays: 0 }).map((r) => r.key)).toEqual([
      "plays",
    ]);
  });

  it("articolo: nessun clic link se null, nessuna metrica comune ripetuta (§110, §111)", () => {
    const rows = buildArticleRows({ avg_read_seconds: 134, link_clicks: null, open_rate_percent: 21.8, opens: 1184 });

    expect(rows.map((row) => [row.label, row.value])).toEqual([
      ["Aperture", "1.184"],
      ["Tasso di apertura", "21,8%"],
      ["Tempo medio di lettura", "2 min 14 sec"],
    ]);
    expect(rows.some((row) => /Mi piace|Salvataggi|Impression/.test(row.label))).toBe(false);
  });

  it("tempo di lettura non affidabile (null) → riga nascosta (§108)", () => {
    const rows = buildArticleRows({ avg_read_seconds: null, link_clicks: 38, open_rate_percent: null, opens: 5 });

    expect(rows.map((row) => row.key)).toEqual(["opens", "link_clicks"]);
  });
});

describe("periodi (§68–70, §188)", () => {
  const periods = makeInsights().periods;

  it("solo i periodi disponibili, in ordine canonico", () => {
    expect(buildPeriodOptions(periods).map((option) => option.label)).toEqual([
      "24 ore",
      "7 giorni",
      "Dalla pubblicazione",
    ]);
  });

  it("risolve la scelta: utente → default server → primo", () => {
    const options = buildPeriodOptions(periods);

    expect(resolvePeriod("7d", options, "since_publication")).toBe("7d");
    expect(resolvePeriod("30d", options, "since_publication")).toBe("since_publication");
    expect(resolvePeriod(null, options, "30d")).toBe("24h");
    expect(resolvePeriod(null, [], "7d")).toBe("since_publication");
  });
});

describe("grafico (§65, §75, §166, §169)", () => {
  it("scala tonda con tre riferimenti interi", () => {
    expect(trendScale(4820)).toEqual({ max: 6000, ticks: [0, 3000, 6000] });
    expect(trendScale(284)).toEqual({ max: 400, ticks: [0, 200, 400] });
    expect(trendScale(3)).toEqual({ max: 4, ticks: [0, 2, 4] });
    expect(trendScale(0).max).toBe(2);
  });

  it("larghezza dell'asse Y dall'etichetta più lunga", () => {
    expect(trendAxisWidth(["0", "3.000", "6.000"])).toBe(40);
  });

  it("geometria: una polilinea nel riquadro", () => {
    const coordinates = trendGeometry(
      [
        { ts: "a", value: 0 },
        { ts: "b", value: 50 },
        { ts: "c", value: 100 },
      ],
      100,
      { bottom: 10, height: 110, left: 20, right: 0, top: 10, width: 100 },
    );

    expect(coordinates).toEqual([
      { x: 20, y: 100 },
      { x: 60, y: 55 },
      { x: 100, y: 10 },
    ]);
  });

  it("etichette X equidistanti, prima e ultima sempre presenti", () => {
    const points = Array.from({ length: 5 }, (_, day) => ({
      ts: new Date(2026, 7, 12 + day, 10).toISOString(),
      value: day,
    }));

    expect(trendAxisLabels(points, "day", 4)).toEqual([
      { index: 0, label: "12 ago" },
      { index: 1, label: "13 ago" },
      { index: 3, label: "15 ago" },
      { index: 4, label: "16 ago" },
    ]);
    expect(trendAxisLabels(points.slice(0, 2), "hour", 4)).toEqual([
      { index: 0, label: "10:00" },
      { index: 1, label: "10:00" },
    ]);
    expect(trendAxisLabels([], "day")).toEqual([]);
  });

  it("alternativa testuale: metrica, periodo, valore iniziale e finale", () => {
    expect(
      trendAccessibilitySummary({
        metric: "views",
        period: "7d",
        points: [
          { ts: "a", value: 120 },
          { ts: "b", value: 3160 },
        ],
      }),
    ).toBe("Andamento, visualizzazioni, ultimi 7 giorni. Valore iniziale 120, valore finale 3.160.");
  });

  it("stato del trend: insufficiente non è un grafico, errore è di sezione", () => {
    const base: ContentInsightsTrend = {
      cumulative: true,
      interval: "day",
      metric: "views",
      period: "7d",
      points: [],
      status: "ok",
      sufficient: false,
      timezone: "Europe/Rome",
    };
    const points = [
      { ts: "a", value: 1 },
      { ts: "b", value: 2 },
      { ts: "c", value: 3 },
    ];

    expect(resolveTrendState({ data: base, hasError: false })).toEqual({ kind: "insufficient" });
    expect(resolveTrendState({ data: { ...base, points, sufficient: true }, hasError: false }).kind).toBe("ready");
    expect(resolveTrendState({ data: undefined, hasError: true })).toEqual({ kind: "error" });
    expect(resolveTrendState({ data: undefined, hasError: false })).toEqual({ kind: "loading" });
    expect(resolveTrendState({ data: { status: "unavailable" }, hasError: false })).toEqual({
      kind: "insufficient",
    });
  });
});

describe("buildInsightsViewModel: sezioni dinamiche (§13, §114–117)", () => {
  it("Post: sezioni comuni, nessuna Prestazioni video/articolo", () => {
    const view = buildInsightsViewModel(makeInsights(), NOW);

    expect(view.overview).toHaveLength(4);
    expect(view.interactions?.map((row) => row.key)).toEqual(["likes", "comments", "shares", "saves"]);
    expect(view.actions?.insight).toContain("4,0%");
    expect(view.trend?.defaultPeriod).toBe("since_publication");
    expect(view.sources).toHaveLength(5);
    expect(view.video).toBeNull();
    expect(view.article).toBeNull();
    expect(view.initialState).toBeNull();
  });

  it("Video: aggiunge Prestazioni video", () => {
    const view = buildInsightsViewModel(
      makeInsights({
        insights_kind: "video",
        video_insights: { avg_watch_seconds: 27, completion_percent: 56, plays: 3840 },
      }),
      NOW,
    );

    expect(view.video).toHaveLength(3);
    expect(view.article).toBeNull();
  });

  it("Articolo: aggiunge Prestazioni articolo", () => {
    const view = buildInsightsViewModel(
      makeInsights({
        article_insights: { avg_read_seconds: 134, link_clicks: 38, open_rate_percent: 21.8, opens: 1184 },
        insights_kind: "article",
      }),
      NOW,
    );

    expect(view.article).toHaveLength(4);
    expect(view.video).toBeNull();
  });

  it("blocco video presente ma kind diverso → sezione omessa", () => {
    const view = buildInsightsViewModel(
      makeInsights({ video_insights: { avg_watch_seconds: 1, completion_percent: 1, plays: 1 } }),
      NOW,
    );

    expect(view.video).toBeNull();
  });

  it("professional_actions null → né sezione né KPI Azioni generate a 0", () => {
    const view = buildInsightsViewModel(
      makeInsights({
        overview: { generated_actions: 0, interactions: 5, reach: 10, views: 12 },
        professional_actions: null,
      }),
      NOW,
    );

    expect(view.actions).toBeNull();
    expect(view.overview?.map((kpi) => kpi.key)).toEqual(["views", "reach", "interactions"]);
  });

  it("traffic_sources vuoto e periodi assenti → sezioni omesse", () => {
    const view = buildInsightsViewModel(makeInsights({ periods: [], traffic_sources: [] }), NOW);

    expect(view.sources).toBeNull();
    expect(view.trend).toBeNull();
  });

  it("nessun «Tasso di interazione», nessun benchmark, nessun verde in nessuna stringa", () => {
    const text = JSON.stringify(buildInsightsViewModel(makeInsights(), NOW));

    expect(text).not.toMatch(/Tasso di interazione|rispetto ai tuoi|sopra la media|Chi hai raggiunto/i);
  });
});

describe("stato iniziale (§121–124, §196)", () => {
  const empty = makeInsights({
    engagement: { comments: 0, likes: 0, reposts: null, saves: 0, shares: null },
    has_data: false,
    overview: { generated_actions: 0, interactions: 0, reach: 0, views: 0 },
    professional_actions: null,
    traffic_sources: [],
  });

  it("senza dati: solo preview + stato informativo, nessuna dashboard di zeri", () => {
    const view = buildInsightsViewModel(empty, NOW);

    expect(view.initialState).toBe("full");
    expect(view.overview).toBeNull();
    expect(view.interactions).toBeNull();
    expect(view.actions).toBeNull();
    expect(view.trend).toBeNull();
    expect(view.sources).toBeNull();
  });

  it("valori già validi restano visibili e lo stato diventa compatto (§123)", () => {
    const view = buildInsightsViewModel(
      makeInsights({
        ...empty,
        engagement: { comments: 0, likes: 4, reposts: null, saves: 0, shares: null },
        overview: { generated_actions: 0, interactions: 4, reach: 0, views: 0 },
      }),
      NOW,
    );

    expect(view.initialState).toBe("compact");
    expect(view.interactions?.map((row) => row.key)).toEqual(["likes"]);
    expect(view.overview?.map((kpi) => kpi.key)).toEqual(["interactions"]);
    expect(view.trend).toBeNull();
  });
});

describe("resolveInsightsScreenState (§126, §135–138, §141)", () => {
  const ok = makeInsights();
  const base = { data: undefined, hasError: false, hasTarget: true, permissionRevoked: false };

  it("caricamento senza dati", () => {
    expect(resolveInsightsScreenState(base)).toEqual({ kind: "loading" });
  });

  it("cache presente → ready, anche se un refresh in background è fallito", () => {
    expect(resolveInsightsScreenState({ ...base, data: ok, hasError: true })).toEqual({ data: ok, kind: "ready" });
  });

  it("errore senza dati → error, mai «nessuna statistica»", () => {
    expect(resolveInsightsScreenState({ ...base, hasError: true })).toEqual({ kind: "error" });
  });

  it("permesso revocato batte i dati in cache (§137–138)", () => {
    expect(resolveInsightsScreenState({ ...base, data: ok, permissionRevoked: true })).toEqual({
      kind: "permission_revoked",
    });
  });

  it("unavailable e target non valido → contenuto non disponibile", () => {
    expect(resolveInsightsScreenState({ ...base, data: { status: "unavailable" } })).toEqual({ kind: "unavailable" });
    expect(resolveInsightsScreenState({ ...base, hasTarget: false })).toEqual({ kind: "unavailable" });
  });
});
