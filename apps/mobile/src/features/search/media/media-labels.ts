/**
 * Label builders for Cerca > Media e contenuti previews (CER-05 §10/§12/§16).
 *
 * Le anteprime restano volutamente povere: tipologia, titolo, fonte e tempo
 * relativo. Nessun contatore di interazione, nessuna descrizione lunga.
 */

import type {
  MediaContentFormat,
  MediaContentRow,
  MediaSourceKind,
  MediaSourceRowData,
} from "./media-search-types";

const FORMAT_LABELS: Record<MediaContentFormat, string> = {
  articolo: "Articolo",
  video: "Video",
  foto: "Foto",
  post: "Post",
};

const SOURCE_KIND_LABELS: Record<MediaSourceKind, string> = {
  ufficiale: "Profilo ufficiale",
  testata: "Testata sportiva",
  giornalista: "Giornalista sportivo",
  creator: "Creator",
  pagina: "Pagina sportiva",
  tifoso: "Profilo tifoso",
};

export function formatMediaFormatLabel(format: MediaContentFormat): string {
  return FORMAT_LABELS[format];
}

export function formatSourceKindLabel(kind: MediaSourceKind): string {
  return SOURCE_KIND_LABELS[kind] ?? SOURCE_KIND_LABELS.pagina;
}

/**
 * Tempo dalla pubblicazione, compatto: "adesso" · "2 h" · "ieri" · "3 gg" ·
 * "12 lug". Nessun secondo, nessuna data completa entro la settimana.
 */
export function formatMediaAge(iso: string | null | undefined): string {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = Date.now() - date.getTime();

  if (diffMs < 0) {
    return "adesso";
  }

  const diffHours = Math.floor(diffMs / 3_600_000);

  if (diffHours < 1) {
    return "adesso";
  }

  if (diffHours < 24) {
    return `${diffHours} h`;
  }

  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

  if (diffDays <= 1) {
    return "ieri";
  }

  if (diffDays < 7) {
    return `${diffDays} gg`;
  }

  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

/** Durata video sovrapposta alla miniatura: "02:34", "1:02:34". */
export function formatVideoDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}

/** Riga fonte dell'anteprima contenuto: "Como Football News · 2 h". */
export function formatContentSourceLine(
  row: Pick<MediaContentRow, "published_at" | "publisher_name">,
): string {
  return [row.publisher_name, formatMediaAge(row.published_at)]
    .filter((part) => Boolean(part))
    .join(" · ");
}

/** Meta della fonte: "Testata sportiva · Como". */
export function formatSourceMeta(
  row: Pick<MediaSourceRowData, "regions" | "source_kind">,
): string {
  return [formatSourceKindLabel(row.source_kind), row.regions[0]]
    .filter((part) => Boolean(part))
    .join(" · ");
}

/** Specializzazione della fonte: "Serie D e calcio lombardo". */
export function formatSourceFocus(
  row: Pick<MediaSourceRowData, "categories" | "description" | "topics">,
): string | null {
  if (row.description && row.description.trim().length > 0) {
    return row.description.trim();
  }

  const focus = [...row.categories, ...row.topics].filter(Boolean);

  return focus.length > 0 ? focus.slice(0, 3).join(", ") : null;
}

export function formatMediaResultsCount(total: number | null): string | null {
  if (total == null) {
    return null;
  }

  return total === 1 ? "1 risultato" : `${total} risultati`;
}
