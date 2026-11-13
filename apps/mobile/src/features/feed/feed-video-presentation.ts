/**
 * Derivazioni pure di Video e Articolo nel Feed (HOM-03).
 *
 * Come per il Post (`feed-post-presentation.ts`), tutto ciò che si calcola dal
 * payload vive qui e non nei componenti: stato del video, sorgente di
 * riproduzione, orologio del player, riga meta editoriale, layout dell'Articolo.
 * Si testa senza renderizzare.
 *
 * Decisioni centrali:
 *  • un solo Post per i video social (§3): lo stato di un video lo dice
 *    `videoMediaState`, e `uploaded` vale `processing` (§64, §114) — mai un enum
 *    tecnico a schermo;
 *  • un video «pronto» ma senza alcuna sorgente riproducibile è «non
 *    disponibile» (§67, §120): non si mostra un Play che non può funzionare;
 *  • sorgente: si preferisce lo streaming adattivo (HLS) tra le varianti (§72),
 *    poi l'URL del media, poi la prima variante; niente download del file intero;
 *  • la riga meta editoriale è il formato — «Video · 3 h», «Articolo · 2 h» —
 *    come etichetta discreta (§32): nessuna pill, nessun colore per formato;
 *  • un solo Articolo nel Feed (§39–40): il layout orizzontale testo + miniatura
 *    passa a verticale con Dynamic Type alto (§127), mai riducendo il font.
 */

import { formatCompactRelativeTime, formatSpokenRelativeTime } from "../../lib/relative-time";
import {
  VIDEO_PROCESSING_HELPER,
  VIDEO_PROCESSING_TITLE,
  VIDEO_UNAVAILABLE_HELPER,
  VIDEO_UNAVAILABLE_TITLE,
} from "./feed-labels";
import {
  mediaCellState,
  orderMedia,
  spokenVideoDuration,
  type MediaCellState,
} from "./feed-post-presentation";
import type { FeedEditorialPayload, FeedMediaItem } from "./feed-types";

// ────────────────────────────────────────────────────────────────
// Stato e sorgente del video (§61–70, §72)
// ────────────────────────────────────────────────────────────────

export type VideoMediaState = MediaCellState;

export type PlaybackSource = {
  uri: string;
  /** `hls` quando la sorgente è uno stream adattivo, altrimenti il player decide. */
  contentType: "hls" | "auto";
};

const HLS_MIME = /mpegurl/i;
const HLS_EXTENSION = /\.m3u8(\?|#|$)/i;

/** §72: streaming adattivo se disponibile, altrimenti il file; mai null se c'è un URL. */
export function pickPlaybackSource(
  media: Pick<FeedMediaItem, "url" | "variants">,
): PlaybackSource | null {
  const variants = (media.variants ?? []).filter((variant) => Boolean(variant.url));
  const hls = variants.find(
    (variant) => HLS_MIME.test(variant.mimeType ?? "") || HLS_EXTENSION.test(variant.url),
  );

  if (hls) {
    return { contentType: "hls", uri: hls.url };
  }

  if (media.url) {
    return { contentType: HLS_EXTENSION.test(media.url) ? "hls" : "auto", uri: media.url };
  }

  const first = variants[0];

  return first ? { contentType: "auto", uri: first.url } : null;
}

/**
 * Stato dell'area video: pronto solo se il media è riproducibile E ha una
 * sorgente. In elaborazione resta tale anche senza URL (§62).
 */
export function videoMediaState(media: FeedMediaItem): VideoMediaState {
  const state = mediaCellState(media);

  if (state !== "ready") {
    return state;
  }

  return pickPlaybackSource(media) ? "ready" : "unavailable";
}

/** §113: il copy è definitivo e vive in `feed-labels`. */
export function videoStateCopy(
  state: VideoMediaState,
): { title: string; helper: string } | null {
  switch (state) {
    case "processing":
      return { helper: VIDEO_PROCESSING_HELPER, title: VIDEO_PROCESSING_TITLE };
    case "unavailable":
      return { helper: VIDEO_UNAVAILABLE_HELPER, title: VIDEO_UNAVAILABLE_TITLE };
    default:
      return null;
  }
}

/** Una riga sola per lo screen reader: «Video in elaborazione. Il video sarà …» (§83). */
export function videoStateAccessibilityLabel(state: VideoMediaState): string | null {
  const copy = videoStateCopy(state);

  return copy ? `${copy.title}. ${copy.helper}` : null;
}

// ────────────────────────────────────────────────────────────────
// Etichette parlate dei controlli (§83, §128)
// ────────────────────────────────────────────────────────────────

export const VIDEO_A11Y = {
  enterFullscreen: "Schermo intero",
  mute: "Disattiva audio",
  pause: "Metti in pausa",
  play: "Riproduci video",
  progress: "Avanzamento video",
  resume: "Riprendi",
  unmute: "Attiva audio",
} as const;

/** «Riproduci video, durata 48 secondi»; con alt text lo antepone. */
export function videoPlayAccessibilityLabel(
  media: Pick<FeedMediaItem, "durationSeconds" | "altText">,
): string {
  const duration = spokenVideoDuration(media.durationSeconds);
  const base = duration ? `${VIDEO_A11Y.play}, durata ${duration}` : VIDEO_A11Y.play;

  return media.altText ? `${media.altText}. ${base}` : base;
}

// ────────────────────────────────────────────────────────────────
// Orologio e avanzamento del player (§14)
// ────────────────────────────────────────────────────────────────

/** §15: i controlli si ritirano dopo tre secondi di riproduzione senza tocchi. */
export const PLAYER_CONTROLS_AUTO_HIDE_MS = 3000;
/** Salto dell'azione di accessibilità «avanza/indietreggia» sulla barra. */
export const PLAYER_SEEK_STEP_SECONDS = 10;
/** Frequenza del progresso: abbastanza per una barra fluida, non per un re-render continuo. */
export const PLAYER_TIME_UPDATE_INTERVAL_S = 0.25;
/** Entro questa distanza dalla fine il video si considera concluso. */
const END_TOLERANCE_SECONDS = 0.5;

function finiteOrZero(value: number | null | undefined): number {
  return value != null && Number.isFinite(value) && value > 0 ? value : 0;
}

/** «0:18», «1:02:05»; valori ignoti o negativi valgono «0:00». */
export function formatPlayerClock(seconds: number | null | undefined): string {
  const total = Math.floor(finiteOrZero(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

/** Durata effettiva: quella del player appena nota, altrimenti i metadata del backend (§71). */
export function resolveDuration(
  playerDuration: number | null | undefined,
  metadataDuration: number | null | undefined,
): number {
  return finiteOrZero(playerDuration) || finiteOrZero(metadataDuration);
}

/** Frazione 0–1 dell'avanzamento; durata ignota → 0. */
export function playbackRatio(current: number, duration: number): number {
  const total = finiteOrZero(duration);

  if (total === 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, finiteOrZero(current) / total));
}

/** Posizione in secondi per un tap sulla barra; il rapporto è limitato a 0–1. */
export function seekTarget(ratio: number, duration: number): number {
  const clamped = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;

  return clamped * finiteOrZero(duration);
}

/** Salto relativo, tenuto dentro il video. */
export function seekBy(current: number, delta: number, duration: number): number {
  const total = finiteOrZero(duration);
  const next = finiteOrZero(current) + delta;

  return total === 0 ? Math.max(0, next) : Math.min(total, Math.max(0, next));
}

export function hasPlayedToEnd(current: number, duration: number): boolean {
  const total = finiteOrZero(duration);

  return total > 0 && finiteOrZero(current) >= total - END_TOLERANCE_SECONDS;
}

/** «0:18 di 0:48» per il valore della barra letto dallo screen reader. */
export function progressAccessibilityValue(current: number, duration: number): string {
  return `${formatPlayerClock(current)} di ${formatPlayerClock(duration)}`;
}

/** §14: «0:18 / 0:48» come nel visual master. */
export function playerClockLabel(current: number, duration: number): string {
  return `${formatPlayerClock(current)} / ${formatPlayerClock(duration)}`;
}

// ────────────────────────────────────────────────────────────────
// Video editoriale e Articolo (§30–51)
// ────────────────────────────────────────────────────────────────

export type EditorialKind = "video" | "article";

export const EDITORIAL_KIND_LABELS: Record<EditorialKind, string> = {
  article: "Articolo",
  video: "Video",
};

/** §33–34: titolo 2–3 righe, sommario 1–2. Uguali per Video e Articolo (§44–45). */
export const EDITORIAL_TITLE_MAX_LINES = 3;
export const EDITORIAL_SUMMARY_MAX_LINES = 2;

type EditorialLineInput = {
  type: EditorialKind;
  publishedAt: string | null;
  now?: Date;
};

/** «Video · 3 h», «Articolo · 2 h»: il formato è una label discreta (§32), non una pill. */
export function buildEditorialMetaLine({ type, publishedAt, now }: EditorialLineInput): string {
  const time = publishedAt ? formatCompactRelativeTime(publishedAt, now) : "";

  return [EDITORIAL_KIND_LABELS[type], time].filter(Boolean).join(" · ");
}

/** §85: «Gazzetta dello Sport, profilo verificato, Articolo, pubblicato 2 ore fa». */
export function buildEditorialAccessibilityLabel({
  type,
  publishedAt,
  now,
  name,
  isVerified,
}: EditorialLineInput & { name: string; isVerified: boolean }): string {
  const spoken = publishedAt ? formatSpokenRelativeTime(publishedAt, now) : "";

  return [
    name,
    isVerified ? "profilo verificato" : null,
    EDITORIAL_KIND_LABELS[type],
    spoken ? `pubblicato ${spoken}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Etichetta del bookmark: lo stato è nel nome, non solo nel colore (§85). */
export function bookmarkAccessibilityLabel(isSaved: boolean): string {
  return isSaved ? "Rimuovi dai salvati" : "Salva";
}

/** §48: l'etichetta della preview è il titolo; l'azione è nel suggerimento. */
export function articleAccessibilityLabel(
  title: string | null,
  summary: string | null,
): string | undefined {
  const parts = [title, summary].filter((part): part is string => Boolean(part?.trim()));

  return parts.length > 0 ? parts.join(". ") : undefined;
}

export type ArticleLayout = "horizontal" | "stacked";

/** Larghezza della miniatura laterale (§43): non occupa mai metà schermata (§46). */
export const ARTICLE_THUMBNAIL_WIDTH = 96;
/** 4:5, come nel visual master: la cover è un po' più alta che larga. */
export const ARTICLE_THUMBNAIL_RATIO = 4 / 5;
/** §127: da qui il layout diventa verticale. Il font non si riduce mai. */
export const ARTICLE_STACKED_FONT_SCALE = 1.3;
/** Cover del layout verticale: compatta, non una hero (§43). */
export const ARTICLE_STACKED_COVER_RATIO = 2;

export function articleLayoutFor(fontScale: number): ArticleLayout {
  return Number.isFinite(fontScale) && fontScale >= ARTICLE_STACKED_FONT_SCALE
    ? "stacked"
    : "horizontal";
}

/**
 * §46: la cover è la prima immagine della collezione, poi la miniatura legacy
 * del payload. Il thumbnail del media è il più leggero.
 */
export function articleCoverUri(
  payload: Pick<FeedEditorialPayload, "media" | "thumbnailUrl">,
): string | null {
  const cover = orderMedia(payload.media ?? []).find((item) => item.type === "image");
  const fromMedia = cover ? (cover.thumbnailUrl ?? cover.url) : null;

  return fromMedia ?? payload.thumbnailUrl ?? null;
}

/** §85: testo alternativo della cover; senza, si nomina l'articolo. */
export function articleCoverAltText(
  payload: Pick<FeedEditorialPayload, "media">,
  title: string | null,
): string {
  const cover = orderMedia(payload.media ?? []).find((item) => item.type === "image");

  return cover?.altText ?? (title ? `Copertina: ${title}` : "Copertina dell'articolo");
}

/** Il video di un editoriale: il primo della collezione nell'ordine dell'autore (§31). */
export function editorialVideoMedia(
  payload: Pick<FeedEditorialPayload, "media">,
): FeedMediaItem | null {
  return orderMedia(payload.media ?? []).find((item) => item.type === "video") ?? null;
}

/**
 * Dettaglio storico (`/content/[type]/[id]`): le cinque sorgenti CER-05 hanno
 * il video in colonne proprie, non in una `media[]`. Lo si porta nella stessa
 * forma del Feed per riprodurlo con lo stesso componente (§35, §38).
 */
export function legacyVideoMedia(input: {
  id: string;
  url: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
}): FeedMediaItem {
  return {
    altText: null,
    aspectRatio: null,
    availability: input.url ? "available" : "unavailable",
    captions: [],
    createdAt: null,
    durationSeconds: input.durationSeconds,
    height: null,
    id: input.id,
    position: 0,
    processingState: input.url ? "ready" : "failed",
    thumbnailUrl: input.thumbnailUrl,
    type: "video",
    url: input.url,
    variants: [],
    width: null,
  };
}
