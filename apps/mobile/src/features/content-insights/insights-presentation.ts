/**
 * Derivazioni pure di Dettagli e statistiche (HOM-05).
 *
 * Tutto ciò che si decide dal payload vive qui e non nei componenti, così le
 * regole che il QA verifica (§179–196) si testano senza renderizzare
 * (CLAUDE.md: `-presentation.ts`):
 *
 *  • `null` = not_available → la riga si NASCONDE; `0` = zero reale → si mostra
 *    (§118–120). Il client non trasforma mai l'uno nell'altro;
 *  • nessuna sezione vuota (§117): una sezione senza righe non esiste;
 *  • Panoramica: al massimo quattro KPI, mai «Tasso di interazione» (§28–29,
 *    §179–180); totali di Interazioni e Azioni generate dal backend (§43);
 *  • stato iniziale (§121–123): con `has_data` falso le sezioni che dipendono
 *    dalle visualizzazioni si omettono, i valori già validi restano visibili, e
 *    non esiste mai una dashboard di zeri (§122);
 *  • numeri in formato italiano «4.820» (riuso di `formatCount`, HOM-02 §105) e
 *    letti per esteso «4.820 visualizzazioni» (§168);
 *  • un solo accent, nessun giudizio qualitativo: qui non c'è alcun colore, e
 *    nessuna frase confronta la performance con altro (§60–62, §165);
 *  • l'insight sintetico (§58) è una frase neutrale e compare solo se il server
 *    lo manda (significativo e reale, §185): il client non lo calcola.
 */

import type Ionicons from "@expo/vector-icons/Ionicons";

import { formatCount } from "../../lib/format-count";
import { formatSpokenRelativeTime } from "../../lib/relative-time";
import { formatPostVideoDuration, spokenVideoDuration } from "../feed/feed-post-presentation";
import type {
  ContentInsights,
  ContentInsightsResult,
  ContentInsightsTrend,
  ContentInsightsTrendResult,
  InsightsArticlePerformance,
  InsightsEngagement,
  InsightsFormat,
  InsightsMetric,
  InsightsPeriod,
  InsightsPeriodAvailability,
  InsightsPreview,
  InsightsProfessionalActions,
  InsightsSource,
  InsightsTrafficSource,
  InsightsTrendInterval,
  InsightsTrendPoint,
  InsightsVideoPerformance,
} from "./insights-types";

export type InsightsIcon = keyof typeof Ionicons.glyphMap;

// ────────────────────────────────────────────────────────────────
// Copy (§45, §121, §134–135, §138)
// ────────────────────────────────────────────────────────────────

export const INSIGHTS_SECTION_TITLES = {
  actions: "Azioni generate",
  article: "Prestazioni articolo",
  interactions: "Interazioni",
  overview: "Panoramica",
  sources: "Origine delle visualizzazioni",
  trend: "Andamento",
  video: "Prestazioni video",
} as const;

/** §45 */
export const INSIGHTS_ACTIONS_HELPER = "Azioni effettuate dopo aver visualizzato questo contenuto.";
/** §121: nessun copy promozionale né motivazionale (§124). */
export const INSIGHTS_INITIAL_TITLE = "Le statistiche stanno iniziando a popolarsi";
export const INSIGHTS_INITIAL_BODY = "I dati saranno disponibili man mano che il contenuto viene visualizzato.";
/** §75: grafico con pochi dati → stato compatto, mai una serie inventata. */
export const INSIGHTS_TREND_INSUFFICIENT =
  "L'andamento sarà disponibile man mano che il contenuto viene visualizzato.";
/** §134 */
export const INSIGHTS_SECTION_ERROR = "Dati temporaneamente non disponibili";
export const INSIGHTS_RETRY = "Riprova";
/** §135 */
export const INSIGHTS_ERROR_TITLE = "Statistiche non disponibili";
export const INSIGHTS_ERROR_BODY = "Non è stato possibile caricare i dati. Riprova.";
/** §138 */
export const INSIGHTS_PERMISSION_LOST = "Non hai più i permessi per visualizzare queste statistiche.";
export const INSIGHTS_BACK_LABEL = "Indietro";
export const INSIGHTS_VIEW_CONTENT = "Visualizza contenuto →";
export const INSIGHTS_VIEW_CONTENT_A11Y = "Visualizza contenuto";
export const INSIGHTS_LOADING_A11Y = "Caricamento delle statistiche";

// ────────────────────────────────────────────────────────────────
// Numeri (§31, §92, §168)
// ────────────────────────────────────────────────────────────────

/** Un dato reale: finito e non negativo. Tutto il resto equivale a «non disponibile». */
export function isMetricValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** «4.820»: il formato italiano dei contatori, uguale a quello del Feed. */
export function formatMetricNumber(value: number): string {
  return formatCount(value);
}

function decimalComma(text: string): string {
  return text.replace(".", ",");
}

/** «56%», «21,8%»: intero se lo è, altrimenti un decimale con la virgola. */
export function formatPercent(value: number): string {
  return Number.isInteger(value) ? `${value}%` : `${decimalComma(value.toFixed(1))}%`;
}

/** «4,0%»: nell'insight il decimale c'è sempre (§58). */
export function formatInsightPercent(value: number): string {
  return `${decimalComma(value.toFixed(1))}%`;
}

/** §92, §102: «27 sec», «2 min 14 sec», «2 min», «1 h 5 min». */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));

  if (total < 60) {
    return `${total} sec`;
  }

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  }

  return secs > 0 ? `${minutes} min ${secs} sec` : `${minutes} min`;
}

function spokenDuration(seconds: number): string {
  return spokenVideoDuration(seconds) ?? "0 secondi";
}

function spokenPercent(value: number): string {
  return `${Number.isInteger(value) ? value : decimalComma(value.toFixed(1))} percento`;
}

function countPhrase(value: number, one: string, many: string): string {
  return `${formatMetricNumber(value)} ${value === 1 ? one : many}`;
}

// ────────────────────────────────────────────────────────────────
// Preview (§20–25)
// ────────────────────────────────────────────────────────────────

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

const FORMAT_LABELS: Record<InsightsFormat, string> = {
  article: "Articolo",
  editorial_video: "Video",
  gallery: "Gallery",
  other: "Contenuto",
  photo: "Post con foto",
  text: "Post testuale",
  video: "Post con video",
};

export function previewTypeLabel(format: InsightsFormat): string {
  return FORMAT_LABELS[format] ?? FORMAT_LABELS.other;
}

/** «18 ago 2026, 19:42», nel fuso del dispositivo. Data non valida → stringa vuota. */
export function formatPublishedAt(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export type PreviewModel = {
  authorName: string;
  /** Per lo screen reader: «Matteo Rossi, profilo verificato». */
  authorAccessibilityLabel: string;
  durationLabel: string | null;
  /** §23: la preview video mostra thumbnail, piccolo Play e durata — mai un player. */
  isVideo: boolean;
  isVerified: boolean;
  /** «Post con foto · 18 ago 2026, 19:42» (§22). */
  meta: string;
  thumbnailUrl: string | null;
  /** Titolo, o le prime righe se il contenuto non ha titolo (§21). */
  title: string | null;
  typeLabel: string;
};

function cleaned(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildPreviewModel(preview: InsightsPreview): PreviewModel {
  const typeLabel = previewTypeLabel(preview.format);
  const published = formatPublishedAt(preview.published_at);
  const isVideo =
    preview.format === "video" || preview.format === "editorial_video" || preview.item_type === "video";
  const name = preview.author.name;

  return {
    authorAccessibilityLabel: preview.author.is_verified ? `${name}, profilo verificato` : name,
    authorName: name,
    durationLabel: isVideo ? formatPostVideoDuration(preview.duration_seconds) : null,
    isVerified: preview.author.is_verified === true,
    isVideo,
    meta: [typeLabel, published].filter(Boolean).join(" · "),
    thumbnailUrl: cleaned(preview.thumbnail_url),
    title: cleaned(preview.title) ?? cleaned(preview.excerpt),
    typeLabel,
  };
}

// ────────────────────────────────────────────────────────────────
// Righe di metriche (§36–44, §47–49, §91, §102)
// ────────────────────────────────────────────────────────────────

export type MetricRowModel = {
  key: string;
  label: string;
  icon: InsightsIcon;
  /** Valore già formattato («4.820», «27 sec», «56%»). */
  value: string;
  accessibilityLabel: string;
};

function countRow(
  key: string,
  label: string,
  icon: InsightsIcon,
  value: number,
  one: string,
  many: string,
): MetricRowModel {
  return {
    accessibilityLabel: countPhrase(value, one, many),
    icon,
    key,
    label,
    value: formatMetricNumber(value),
  };
}

/**
 * §36–37, §40: Mi piace, Commenti, Condivisioni, Repost, Salvataggi, in
 * quest'ordine. Un `null` nasconde la riga (Repost prima di HOM-10 non è mai
 * «Repost 0»). Con `onlyPositive` (stato iniziale, §122) restano solo i valori
 * già maggiori di zero.
 */
export function buildEngagementRows(
  engagement: InsightsEngagement | null,
  options: { onlyPositive?: boolean } = {},
): MetricRowModel[] {
  if (!engagement) {
    return [];
  }

  const rows: (MetricRowModel | null)[] = [
    isMetricValue(engagement.likes)
      ? countRow("likes", "Mi piace", "heart-outline", engagement.likes, "Mi piace", "Mi piace")
      : null,
    isMetricValue(engagement.comments)
      ? countRow(
          "comments",
          "Commenti",
          "chatbubble-outline",
          engagement.comments,
          "commento",
          "commenti",
        )
      : null,
    isMetricValue(engagement.shares)
      ? countRow(
          "shares",
          "Condivisioni",
          "arrow-redo-outline",
          engagement.shares,
          "condivisione",
          "condivisioni",
        )
      : null,
    isMetricValue(engagement.reposts)
      ? countRow("reposts", "Repost", "repeat-outline", engagement.reposts, "repost", "repost")
      : null,
    isMetricValue(engagement.saves)
      ? countRow(
          "saves",
          "Salvataggi",
          "bookmark-outline",
          engagement.saves,
          "salvataggio",
          "salvataggi",
        )
      : null,
  ];

  return rows.filter((row): row is MetricRowModel => {
    if (!row) {
      return false;
    }
    return options.onlyPositive ? row.value !== "0" : true;
  });
}

/**
 * §47–49: solo le azioni applicabili e tracciate. «Visite al profilo» manca per
 * le Società perché il server la manda `null` (§48); il client non lo decide.
 */
export function buildActionRows(actions: InsightsProfessionalActions | null): MetricRowModel[] {
  if (!actions) {
    return [];
  }

  const rows: (MetricRowModel | null)[] = [
    isMetricValue(actions.profile_visits)
      ? countRow(
          "profile_visits",
          "Visite al profilo",
          "person-outline",
          actions.profile_visits,
          "visita al profilo",
          "visite al profilo",
        )
      : null,
    isMetricValue(actions.new_followers)
      ? countRow(
          "new_followers",
          "Nuovi follower",
          "person-add-outline",
          actions.new_followers,
          "nuovo follower",
          "nuovi follower",
        )
      : null,
    isMetricValue(actions.tagged_opens)
      ? countRow(
          "tagged_opens",
          "Aperture profili taggati",
          "pricetag-outline",
          actions.tagged_opens,
          "apertura di profili taggati",
          "aperture di profili taggati",
        )
      : null,
    isMetricValue(actions.society_visits)
      ? countRow(
          "society_visits",
          "Visite alla Società",
          "business-outline",
          actions.society_visits,
          "visita alla Società",
          "visite alla Società",
        )
      : null,
    isMetricValue(actions.linked_content_opens)
      ? countRow(
          "linked_content_opens",
          "Aperture contenuti collegati",
          "link-outline",
          actions.linked_content_opens,
          "apertura di contenuti collegati",
          "aperture di contenuti collegati",
        )
      : null,
  ];

  return rows.filter((row): row is MetricRowModel => row !== null);
}

/**
 * §58–59, §185: una frase neutrale, presente solo se il server manda l'insight
 * (significativo e reale). Nessun confronto con altri contenuti (§62).
 */
export function buildInsightSentence(actions: InsightsProfessionalActions | null): string | null {
  const insight = actions?.insight;

  if (!insight || !Number.isFinite(insight.percent) || insight.percent <= 0) {
    return null;
  }

  const percent = formatInsightPercent(insight.percent);

  switch (insight.kind) {
    case "profile_visit_rate":
      return `Il ${percent} dei profili raggiunti ha visitato il tuo profilo.`;
    case "society_visit_rate":
      return `Il ${percent} dei profili raggiunti ha visitato la Società.`;
    default:
      return null;
  }
}

/** §91, §100: solo Riproduzioni, Tempo medio di visualizzazione, Completamento. */
export function buildVideoRows(video: InsightsVideoPerformance | null): MetricRowModel[] {
  if (!video) {
    return [];
  }

  const rows: (MetricRowModel | null)[] = [
    isMetricValue(video.plays)
      ? countRow(
          "plays",
          "Riproduzioni",
          "play-circle-outline",
          video.plays,
          "riproduzione",
          "riproduzioni",
        )
      : null,
    isMetricValue(video.avg_watch_seconds)
      ? {
          accessibilityLabel: `Tempo medio di visualizzazione, ${spokenDuration(video.avg_watch_seconds)}`,
          icon: "time-outline",
          key: "avg_watch",
          label: "Tempo medio di visualizzazione",
          value: formatDuration(video.avg_watch_seconds),
        }
      : null,
    isMetricValue(video.completion_percent)
      ? {
          accessibilityLabel: `Completamento, ${spokenPercent(video.completion_percent)}`,
          icon: "checkmark-circle-outline",
          key: "completion",
          label: "Completamento",
          value: formatPercent(video.completion_percent),
        }
      : null,
  ];

  return rows.filter((row): row is MetricRowModel => row !== null);
}

/**
 * §102, §105–110: Aperture, Tasso di apertura, Tempo medio di lettura, Clic sui
 * link. Le metriche comuni (Mi piace, Salvataggi, Impression) NON si ripetono
 * qui (§44, §111–112).
 */
export function buildArticleRows(article: InsightsArticlePerformance | null): MetricRowModel[] {
  if (!article) {
    return [];
  }

  const rows: (MetricRowModel | null)[] = [
    isMetricValue(article.opens)
      ? countRow("opens", "Aperture", "book-outline", article.opens, "apertura", "aperture")
      : null,
    isMetricValue(article.open_rate_percent)
      ? {
          accessibilityLabel: `Tasso di apertura, ${spokenPercent(article.open_rate_percent)}`,
          icon: "stats-chart-outline",
          key: "open_rate",
          label: "Tasso di apertura",
          value: formatPercent(article.open_rate_percent),
        }
      : null,
    isMetricValue(article.avg_read_seconds)
      ? {
          accessibilityLabel: `Tempo medio di lettura, ${spokenDuration(article.avg_read_seconds)}`,
          icon: "time-outline",
          key: "avg_read",
          label: "Tempo medio di lettura",
          value: formatDuration(article.avg_read_seconds),
        }
      : null,
    isMetricValue(article.link_clicks)
      ? countRow(
          "link_clicks",
          "Clic sui link",
          "link-outline",
          article.link_clicks,
          "clic sui link",
          "clic sui link",
        )
      : null,
  ];

  return rows.filter((row): row is MetricRowModel => row !== null);
}

// ────────────────────────────────────────────────────────────────
// Panoramica (§28–31, §162)
// ────────────────────────────────────────────────────────────────

export type KpiModel = {
  key: "views" | "reach" | "interactions" | "generated_actions";
  label: string;
  icon: InsightsIcon;
  value: string;
  /** §168: «4.820 visualizzazioni». */
  accessibilityLabel: string;
};

const KPI_DEFS: readonly {
  key: KpiModel["key"];
  label: string;
  icon: InsightsIcon;
  one: string;
  many: string;
}[] = [
  { icon: "eye-outline", key: "views", label: "Visualizzazioni", many: "visualizzazioni", one: "visualizzazione" },
  { icon: "people-outline", key: "reach", label: "Profili raggiunti", many: "profili raggiunti", one: "profilo raggiunto" },
  { icon: "heart-outline", key: "interactions", label: "Interazioni", many: "interazioni", one: "interazione" },
  {
    icon: "trending-up-outline",
    key: "generated_actions",
    label: "Azioni generate",
    many: "azioni generate",
    one: "azione generata",
  },
];

/**
 * §28, §179: al massimo quattro KPI, nell'ordine del §31. Un KPI `null` non
 * c'è. Azioni generate non compare come «0» quando non ci sono azioni
 * applicabili da mostrare (la sezione non esiste, §117). Nello stato iniziale
 * (§122) restano solo i KPI già maggiori di zero.
 */
export function buildKpis(
  data: Pick<ContentInsights, "overview">,
  options: { onlyPositive?: boolean; hasActionRows: boolean },
): KpiModel[] {
  return KPI_DEFS.flatMap((def): KpiModel[] => {
    const value = data.overview[def.key];

    if (!isMetricValue(value)) {
      return [];
    }
    if (options.onlyPositive && value === 0) {
      return [];
    }
    if (def.key === "generated_actions" && value === 0 && !options.hasActionRows) {
      return [];
    }

    return [
      {
        accessibilityLabel: countPhrase(value, def.one, def.many),
        icon: def.icon,
        key: def.key,
        label: def.label,
        value: formatMetricNumber(value),
      },
    ];
  });
}

/** Righe di `size` elementi: l'ultima può essere più corta e occupa tutta la larghezza. */
export function chunkItems<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];

  for (let index = 0; index < items.length; index += Math.max(1, size)) {
    rows.push(items.slice(index, index + Math.max(1, size)));
  }

  return rows;
}

// ────────────────────────────────────────────────────────────────
// Origine delle visualizzazioni (§76–84)
// ────────────────────────────────────────────────────────────────

export type SourceRowModel = {
  key: string;
  label: string;
  percent: number;
  percentLabel: string;
  /** 0–1: lunghezza della barra, sempre un solo accent (§82). */
  barRatio: number;
  accessibilityLabel: string;
};

type SourceGroup = "home_for_you" | "home_following" | "profile" | "search" | "share_message" | "repost" | "other";

const SOURCE_GROUPS: Record<InsightsSource, SourceGroup> = {
  HOME_FOLLOWING: "home_following",
  HOME_FOR_YOU: "home_for_you",
  MESSAGE: "share_message",
  OTHER: "other",
  PROFILE: "profile",
  REPOST: "repost",
  SEARCH: "search",
  SHARE: "share_message",
};

const SOURCE_GROUP_ORDER: readonly SourceGroup[] = [
  "home_for_you",
  "home_following",
  "profile",
  "search",
  "share_message",
  "repost",
  "other",
];

const SOURCE_GROUP_LABELS: Record<SourceGroup, string> = {
  home_following: "Home · Seguiti",
  home_for_you: "Home · Per te",
  other: "Altro",
  profile: "Profilo",
  repost: "Repost",
  search: "Cerca",
  share_message: "Condivisioni e Messaggi",
};

/**
 * §77–79: le sorgenti del backend raggruppate come nel mockup. Condivisioni e
 * Messaggi sono una voce sola (§77); una sorgente sconosciuta confluisce in
 * «Altro», perché il client non inventa etichette (§80). Ordine decrescente per
 * percentuale, «Altro» sempre ultima. Le percentuali non si ricalcolano: il
 * backend le normalizza a 100 (§83); qui si sommano solo le voci fuse.
 */
export function buildSourceRows(sources: readonly InsightsTrafficSource[]): SourceRowModel[] {
  const totals = new Map<SourceGroup, number>();

  for (const entry of sources) {
    if (!Number.isFinite(entry.percent) || entry.percent <= 0) {
      continue;
    }

    const group = SOURCE_GROUPS[entry.source] ?? "other";
    totals.set(group, (totals.get(group) ?? 0) + entry.percent);
  }

  return [...totals.entries()]
    .sort(([groupA, a], [groupB, b]) => {
      if (groupA === "other" || groupB === "other") {
        return groupA === "other" ? 1 : -1;
      }
      return b - a || SOURCE_GROUP_ORDER.indexOf(groupA) - SOURCE_GROUP_ORDER.indexOf(groupB);
    })
    .map(([group, percent]) => {
      const rounded = Math.round(percent);

      return {
        accessibilityLabel: `${SOURCE_GROUP_LABELS[group]}, ${rounded} percento`,
        barRatio: Math.min(1, Math.max(0, percent / 100)),
        key: group,
        label: SOURCE_GROUP_LABELS[group],
        percent: rounded,
        percentLabel: `${rounded}%`,
      };
    });
}

// ────────────────────────────────────────────────────────────────
// Andamento: periodi, metriche, serie, grafico (§64–75, §169)
// ────────────────────────────────────────────────────────────────

export const PERIOD_ORDER: readonly InsightsPeriod[] = ["24h", "7d", "30d", "since_publication"];

export const PERIOD_LABELS: Record<InsightsPeriod, string> = {
  "24h": "24 ore",
  "30d": "30 giorni",
  "7d": "7 giorni",
  since_publication: "Dalla pubblicazione",
};

const PERIOD_SPOKEN: Record<InsightsPeriod, string> = {
  "24h": "ultime 24 ore",
  "30d": "ultimi 30 giorni",
  "7d": "ultimi 7 giorni",
  since_publication: "dalla pubblicazione",
};

/** §66: la metrica di default è Visualizzazioni. */
export const DEFAULT_METRIC: InsightsMetric = "views";

export const METRIC_ORDER: readonly InsightsMetric[] = ["views", "reach", "interactions"];

export const METRIC_LABELS: Record<InsightsMetric, string> = {
  interactions: "Interazioni",
  reach: "Profili raggiunti",
  views: "Visualizzazioni",
};

const METRIC_SPOKEN: Record<InsightsMetric, string> = {
  interactions: "interazioni",
  reach: "profili raggiunti",
  views: "visualizzazioni",
};

export type PeriodOption = { value: InsightsPeriod; label: string };

/**
 * §70, §188: solo i periodi che il server dichiara disponibili, nell'ordine
 * canonico. Un contenuto di due giorni non offre «30 giorni»: non è
 * disabilitato né finto, non c'è.
 */
export function buildPeriodOptions(periods: readonly InsightsPeriodAvailability[]): PeriodOption[] {
  return PERIOD_ORDER.filter((period) =>
    periods.some((entry) => entry.period === period && entry.available === true),
  ).map((period) => ({ label: PERIOD_LABELS[period], value: period }));
}

/**
 * §69: il periodo scelto dall'utente se è ancora disponibile; altrimenti il
 * default del server (Dalla pubblicazione quando utile); altrimenti il primo
 * disponibile.
 */
export function resolvePeriod(
  selected: InsightsPeriod | null,
  options: readonly PeriodOption[],
  serverDefault: InsightsPeriod,
): InsightsPeriod {
  const has = (period: InsightsPeriod | null) =>
    period !== null && options.some((option) => option.value === period);

  if (has(selected)) {
    return selected as InsightsPeriod;
  }
  if (has(serverDefault)) {
    return serverDefault;
  }
  return options[0]?.value ?? "since_publication";
}

/** Fuso IANA del dispositivo per il trend; `UTC` se non determinabile. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export type ChartBox = {
  width: number;
  height: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/**
 * Scala dell'asse Y: il primo valore «tondo» (2, 4, 6, 8, 10 × 10^k) che
 * contiene il massimo, con tre riferimenti 0 / metà / massimo. Metà è sempre
 * intera. Una sola scala per tutto il grafico: niente doppio asse (§65).
 */
export function trendScale(maxValue: number): { max: number; ticks: number[] } {
  const safe = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 0;
  let exponent = 1;

  for (;;) {
    for (const multiple of [2, 4, 6, 8, 10]) {
      const candidate = multiple * exponent;

      if (candidate >= safe) {
        return { max: candidate, ticks: [0, candidate / 2, candidate] };
      }
    }
    exponent *= 10;
  }
}

/** Larghezza dell'asse Y: abbastanza per l'etichetta più lunga («12.486»), senza sprecare spazio. */
export function trendAxisWidth(tickLabels: readonly string[]): number {
  const longest = tickLabels.reduce((max, label) => Math.max(max, label.length), 1);
  return longest * 6 + 10;
}

/** Coordinate dei punti nel riquadro del grafico; una sola linea, nessuna area (§65). */
export function trendGeometry(
  points: readonly InsightsTrendPoint[],
  scaleMax: number,
  box: ChartBox,
): { x: number; y: number }[] {
  const plotWidth = Math.max(0, box.width - box.left - box.right);
  const plotHeight = Math.max(0, box.height - box.top - box.bottom);
  const last = points.length - 1;

  return points.map((point, index) => ({
    x: box.left + (last > 0 ? (index / last) * plotWidth : 0),
    y: box.top + plotHeight * (1 - Math.min(1, Math.max(0, point.value / (scaleMax || 1)))),
  }));
}

/** «x,y x,y …» per la polilinea SVG. */
export function toPolylinePoints(coordinates: readonly { x: number; y: number }[]): string {
  return coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

function axisLabelFor(ts: string, interval: InsightsTrendInterval): string {
  const date = new Date(ts);

  if (Number.isNaN(date.getTime())) {
    return "";
  }
  if (interval === "hour") {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/**
 * Etichette dell'asse X: al massimo `maxLabels`, equidistanti, sempre la prima e
 * l'ultima. «12 ago» per i bucket giornalieri, «19:00» per quelli orari.
 */
export function trendAxisLabels(
  points: readonly InsightsTrendPoint[],
  interval: InsightsTrendInterval,
  maxLabels = 4,
): { index: number; label: string }[] {
  const count = points.length;

  if (count === 0) {
    return [];
  }

  const slots = Math.min(Math.max(1, maxLabels), count);
  const indices = new Set<number>();

  for (let slot = 0; slot < slots; slot += 1) {
    indices.add(slots === 1 ? 0 : Math.round((slot * (count - 1)) / (slots - 1)));
  }

  return [...indices].map((index) => ({ index, label: axisLabelFor(points[index].ts, interval) }));
}

/**
 * §169: l'alternativa testuale al grafico — metrica, periodo, valore iniziale e
 * finale. L'SVG non è accessibile di suo: questa frase lo sostituisce.
 */
export function trendAccessibilitySummary(
  trend: Pick<ContentInsightsTrend, "metric" | "period" | "points">,
): string {
  const metric = METRIC_SPOKEN[trend.metric];
  const period = PERIOD_SPOKEN[trend.period];

  if (trend.points.length === 0) {
    return `Andamento, ${metric}, ${period}. Dati non ancora sufficienti.`;
  }

  const first = trend.points[0].value;
  const last = trend.points[trend.points.length - 1].value;

  return `Andamento, ${metric}, ${period}. Valore iniziale ${formatMetricNumber(
    first,
  )}, valore finale ${formatMetricNumber(last)}.`;
}

export type TrendViewState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "insufficient" }
  | { kind: "ready"; trend: ContentInsightsTrend };

/**
 * §75, §133: stato della sola sezione Andamento. Una serie `sufficient: false`
 * (o con meno di due punti) è lo stato compatto, mai un grafico artificiale.
 * Un errore senza dati è l'errore di sezione; con dati già in cache si mostrano
 * i dati. `unavailable` del trend vale «insufficiente»: lo stato del contenuto
 * lo decide il dettaglio.
 */
export function resolveTrendState(input: {
  data: ContentInsightsTrendResult | undefined;
  hasError: boolean;
}): TrendViewState {
  if (input.data?.status === "ok") {
    return input.data.sufficient && input.data.points.length >= 2
      ? { kind: "ready", trend: input.data }
      : { kind: "insufficient" };
  }
  if (input.data?.status === "unavailable") {
    return { kind: "insufficient" };
  }
  return input.hasError ? { kind: "error" } : { kind: "loading" };
}

/** Valore massimo della serie, per la scala. */
export function trendMaxValue(points: readonly InsightsTrendPoint[]): number {
  return points.reduce((max, point) => Math.max(max, point.value), 0);
}

// ────────────────────────────────────────────────────────────────
// Aggiornamento (§129)
// ────────────────────────────────────────────────────────────────

/**
 * «Aggiornato pochi minuti fa»: discreto, mai un timestamp tecnico. Sotto il
 * minuto «ora»; fino a dieci minuti «pochi minuti fa»; oltre, il tempo parlato
 * dello stesso helper del Feed.
 */
export function formatUpdatedLabel(updatedAt: string, now: Date = new Date()): string | null {
  const date = new Date(updatedAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (minutes < 1) {
    return "Aggiornato ora";
  }
  if (minutes < 10) {
    return "Aggiornato pochi minuti fa";
  }

  const spoken = formatSpokenRelativeTime(updatedAt, now);

  return spoken ? `Aggiornato ${spoken}` : null;
}

// ────────────────────────────────────────────────────────────────
// Layout con font grandi (§167)
// ────────────────────────────────────────────────────────────────

/** Da qui KPI e preview passano a una colonna sola; il font non si riduce mai (§167, §205). */
export const INSIGHTS_STACKED_FONT_SCALE = 1.3;

export type InsightsLayout = "grid" | "stacked";

export function insightsLayoutFor(fontScale: number): InsightsLayout {
  return Number.isFinite(fontScale) && fontScale >= INSIGHTS_STACKED_FONT_SCALE ? "stacked" : "grid";
}

// ────────────────────────────────────────────────────────────────
// View model della schermata (§13, §114–123)
// ────────────────────────────────────────────────────────────────

export type ActionsSectionModel = {
  helper: string;
  rows: MetricRowModel[];
  /** §58: la frase neutrale, o `null`. */
  insight: string | null;
};

export type TrendSectionModel = {
  periods: PeriodOption[];
  defaultPeriod: InsightsPeriod;
};

export type InsightsViewModel = {
  preview: PreviewModel;
  overview: KpiModel[] | null;
  interactions: MetricRowModel[] | null;
  actions: ActionsSectionModel | null;
  trend: TrendSectionModel | null;
  sources: SourceRowModel[] | null;
  video: MetricRowModel[] | null;
  article: MetricRowModel[] | null;
  /**
   * §121–123: `full` quando non c'è nessun valore valido da mostrare (la pagina
   * è preview + stato informativo); `compact` quando alcune sezioni hanno già
   * dati e lo stato copre soltanto quelle senza dati; `null` con dati.
   */
  initialState: "full" | "compact" | null;
  updatedLabel: string | null;
};

function nonEmpty<T>(items: T[]): T[] | null {
  return items.length > 0 ? items : null;
}

/**
 * L'unico punto in cui si decide quali sezioni esistono, nell'ordine fisso del
 * §13: Preview → Panoramica → Interazioni → Azioni generate → Andamento →
 * Origine → (Prestazioni video | Prestazioni articolo). Nessuna sezione vuota
 * (§117); con `has_data` falso restano solo i valori già validi (§123).
 */
export function buildInsightsViewModel(data: ContentInsights, now: Date = new Date()): InsightsViewModel {
  const hasData = data.has_data === true;
  const onlyPositive = !hasData;

  const interactions = nonEmpty(buildEngagementRows(data.engagement, { onlyPositive }));

  const actionRows = hasData ? buildActionRows(data.professional_actions) : [];
  const actions: ActionsSectionModel | null =
    actionRows.length > 0
      ? {
          helper: INSIGHTS_ACTIONS_HELPER,
          insight: buildInsightSentence(data.professional_actions),
          rows: actionRows,
        }
      : null;

  const periodOptions = buildPeriodOptions(data.periods);
  const trend: TrendSectionModel | null =
    hasData && periodOptions.length > 0
      ? {
          defaultPeriod: resolvePeriod(null, periodOptions, data.default_period),
          periods: periodOptions,
        }
      : null;

  const sources = hasData ? nonEmpty(buildSourceRows(data.traffic_sources)) : null;
  const video = hasData && data.insights_kind === "video" ? nonEmpty(buildVideoRows(data.video_insights)) : null;
  const article =
    hasData && data.insights_kind === "article" ? nonEmpty(buildArticleRows(data.article_insights)) : null;

  const overview = nonEmpty(buildKpis(data, { hasActionRows: actionRows.length > 0, onlyPositive }));

  let initialState: InsightsViewModel["initialState"] = null;

  if (!hasData) {
    initialState = overview || interactions ? "compact" : "full";
  }

  return {
    actions,
    article,
    initialState,
    interactions,
    overview,
    preview: buildPreviewModel(data.content_preview),
    sources,
    trend,
    updatedLabel: formatUpdatedLabel(data.updated_at, now),
    video,
  };
}

// ────────────────────────────────────────────────────────────────
// Stato della schermata (§126, §133–138, §140–141)
// ────────────────────────────────────────────────────────────────

export type InsightsScreenState =
  | { kind: "loading" }
  | { kind: "ready"; data: ContentInsights }
  | { kind: "unavailable" }
  | { kind: "permission_revoked" }
  | { kind: "error" };

/**
 * Un solo posto che decide cosa mostrare, in ordine di precedenza:
 *  1. permesso revocato (42501, dal dettaglio O dal trend): niente dati,
 *     nemmeno quelli in cache (§137–138);
 *  2. contenuto non disponibile (risposta definitiva, anche per id/tipo non
 *     validi, §65) — così dopo un delete nessun KPI resta in vista (§141);
 *  3. dati presenti: si mostrano subito, anche se un refresh in background è
 *     fallito (§126, §128);
 *  4. errore senza dati: «Statistiche non disponibili», mai «nessuna statistica»
 *     (§135–136);
 *  5. altrimenti si sta caricando.
 */
export function resolveInsightsScreenState(input: {
  hasTarget: boolean;
  data: ContentInsightsResult | undefined;
  /** Una delle due query ha risposto 42501 (il chiamante lo riconosce con `isContentPermissionError`). */
  permissionRevoked: boolean;
  /** La query del dettaglio è in errore (rete, timeout, risposta malformata). */
  hasError: boolean;
}): InsightsScreenState {
  if (!input.hasTarget) {
    return { kind: "unavailable" };
  }
  if (input.permissionRevoked) {
    return { kind: "permission_revoked" };
  }
  if (input.data?.status === "unavailable") {
    return { kind: "unavailable" };
  }
  if (input.data?.status === "ok") {
    return { data: input.data, kind: "ready" };
  }
  if (input.hasError) {
    return { kind: "error" };
  }
  return { kind: "loading" };
}
