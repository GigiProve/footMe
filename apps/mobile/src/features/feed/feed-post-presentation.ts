/**
 * Derivazioni pure del Post nel Feed (HOM-02).
 *
 * Tutto ciò che si può calcolare dal payload vive qui e non nei componenti,
 * così regole come "+N", "Con …" o la riga meta si testano senza renderizzare
 * (CLAUDE.md: `-presentation.ts`). Il client decide il layout dai dati del Post
 * (§82): collezione, ordine, tipo. Il backend non manda mai layout né HTML.
 *
 * Decisioni centrali, prese qui una volta e non per schermata:
 *  • riga meta Società = "categoria · tempo" (§5, §9). Il §64 e il mockup
 *    scrivono anche "Società ·" davanti, ma il §9 elenca solo categoria e
 *    timestamp e il §65 vieta il badge "Società": le due scritture del §64
 *    perdono contro la lista di priorità del §9 e contro il divieto.
 *  • rich preview + media insieme (§46): nessun limite, l'ordine è sempre
 *    testo → preview → media. La densità la governa la preview compatta, non
 *    un'esclusione.
 *  • la quarta cella con +N è sempre tappabile e apre la galleria (§32).
 */

import { formatCount, normalizeCount } from "../../lib/format-count";
import {
  formatCompactRelativeTime,
  formatSpokenRelativeTime,
} from "../../lib/relative-time";
import { getPlayerPositionLabel } from "../profiles/player-sports";
import { formatRole } from "../profiles/profile-display-helpers";
import { formatSourceKindLabel } from "../search/media/media-labels";
import type { MediaSourceKind } from "../search/media/media-search-types";
import {
  FEED_ACTION_COMMENT,
  FEED_ACTION_LIKE,
  FEED_ACTION_SHARE,
  FEED_MEDIA_STATE_LABELS,
} from "./feed-labels";
import type {
  FeedAuthorMeta,
  FeedIdentityType,
  FeedLinkPreview,
  FeedMediaItem,
  FeedMention,
  FeedPostPayload,
  FeedTaggedIdentity,
} from "./feed-types";

// ────────────────────────────────────────────────────────────────
// Testo, mention, "Mostra altro"
// ────────────────────────────────────────────────────────────────

/** §14: «circa 4–5 righe». */
export const POST_BODY_MAX_LINES = 5;

/**
 * Sotto questa lunghezza, senza a capo, il testo non può superare le righe
 * massime nemmeno con Dynamic Type molto alto: non serve misurarlo.
 */
const SHORT_BODY_MAX_CHARS = 40;

/**
 * Oltre questa lunghezza il testo supera le righe massime su qualunque
 * telefono: a 15px una riga non tiene più di ~65 caratteri (5 × 65 = 325).
 * Serve dove `onTextLayout` non arriva (react-native-web, QA HOM-02): senza,
 * un paragrafo lungo senza a capo veniva tagliato senza "Mostra altro".
 */
const LONG_BODY_MIN_CHARS = 360;

/** §79: `body` è il testo completo; `text` è l'estratto legacy a 280 caratteri. */
export function postBodyText(payload: Pick<FeedPostPayload, "body" | "text">): string {
  const raw = payload.body ?? payload.text ?? "";
  return raw.trim().length === 0 ? "" : raw;
}

export type BodyLengthClass = "short" | "long" | "unknown";

/**
 * Scorciatoia prima della misura reale (`onTextLayout`): evita il misuratore
 * per i testi certamente brevi e per quelli certamente lunghi. Per gli altri la
 * sola misura sul layout effettivo dice se il testo va oltre le righe (§14).
 */
export function classifyBodyLength(
  body: string,
  maxLines: number = POST_BODY_MAX_LINES,
): BodyLengthClass {
  if (body.length === 0) {
    return "short";
  }

  const hardLines = body.split("\n").length;

  if (hardLines > maxLines || body.length >= LONG_BODY_MIN_CHARS) {
    return "long";
  }

  if (hardLines === 1 && body.length <= SHORT_BODY_MAX_CHARS) {
    return "short";
  }

  return "unknown";
}

export function bodyOverflows(
  lineCount: number,
  maxLines: number = POST_BODY_MAX_LINES,
): boolean {
  return lineCount > maxLines;
}

export type PostBodySegment =
  | { kind: "text"; text: string }
  | { kind: "mention"; text: string; mention: FeedMention };

function splitsSurrogatePair(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) {
    return false;
  }

  const previous = text.charCodeAt(index - 1);
  const current = text.charCodeAt(index);

  return previous >= 0xd800 && previous <= 0xdbff && current >= 0xdc00 && current <= 0xdfff;
}

/**
 * §18: suddivide il testo in segmenti di testo semplice e mention, secondo i
 * range strutturati. Un range non valido (fuori dal testo, vuoto, non intero,
 * che taglia una coppia surrogata) o che si sovrappone a uno già accettato
 * viene ignorato: il testo resta comunque intero e leggibile. Solo testo
 * semplice, mai HTML (§17): il segmento mention riporta la sottostringa del
 * corpo, non un nome inviato dal server.
 */
export function segmentBody(
  body: string,
  mentions: readonly FeedMention[],
): PostBodySegment[] {
  if (!body) {
    return [];
  }

  const usable = mentions
    .filter(
      (mention) =>
        Number.isInteger(mention.start) &&
        Number.isInteger(mention.end) &&
        mention.start >= 0 &&
        mention.end > mention.start &&
        mention.end <= body.length &&
        !splitsSurrogatePair(body, mention.start) &&
        !splitsSurrogatePair(body, mention.end),
    )
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const segments: PostBodySegment[] = [];
  let cursor = 0;

  for (const mention of usable) {
    if (mention.start < cursor) {
      continue;
    }

    if (mention.start > cursor) {
      segments.push({ kind: "text", text: body.slice(cursor, mention.start) });
    }

    segments.push({
      kind: "mention",
      mention,
      text: body.slice(mention.start, mention.end),
    });
    cursor = mention.end;
  }

  if (cursor < body.length) {
    segments.push({ kind: "text", text: body.slice(cursor) });
  }

  return segments;
}

// ────────────────────────────────────────────────────────────────
// Riga "Con …" (§20–22)
// ────────────────────────────────────────────────────────────────

export type TaggedSummary = {
  /** Identità che la riga riguarda: i tag non già menzionati nel testo. */
  remaining: FeedTaggedIdentity[];
  lead: FeedTaggedIdentity;
  /** "e altre 2 persone" quando i tag sono più d'uno, altrimenti null. */
  suffix: string | null;
  /** Testo completo per lo screen reader: "Con Marco Bianchi e altre 2 persone". */
  text: string;
};

function taggedKey(identity: { identityType: string; identityId: string }): string {
  return `${identity.identityType}:${identity.identityId}`;
}

function othersLabel(others: FeedTaggedIdentity[]): string {
  const count = others.length;
  const allPeople = others.every((identity) => identity.identityType === "profile");

  if (allPeople) {
    return count === 1 ? "e un'altra persona" : `e altre ${count} persone`;
  }

  return count === 1 ? "e un altro" : `e altri ${count}`;
}

/**
 * §21: un'identità già menzionata nel testo non si ripete sotto. La riga
 * esiste solo quando aggiunge informazione: nessun tag rimasto → `null`.
 * Un tag → "Con X"; più tag → "Con X e altre N persone" e il tap apre l'elenco
 * (§22).
 */
export function summarizeTagged(
  tagged: readonly FeedTaggedIdentity[],
  mentions: readonly FeedMention[],
): TaggedSummary | null {
  const mentioned = new Set(mentions.map(taggedKey));
  const seen = new Set<string>();
  const remaining: FeedTaggedIdentity[] = [];

  for (const identity of tagged) {
    const key = taggedKey(identity);

    if (mentioned.has(key) || seen.has(key)) {
      continue;
    }

    seen.add(key);
    remaining.push(identity);
  }

  const [lead, ...others] = remaining;

  if (!lead) {
    return null;
  }

  const suffix = others.length > 0 ? othersLabel(others) : null;

  return {
    lead,
    remaining,
    suffix,
    text: ["Con", lead.displayName, suffix].filter(Boolean).join(" "),
  };
}

// ────────────────────────────────────────────────────────────────
// Riga autore (§5, §9, §10, §75)
// ────────────────────────────────────────────────────────────────

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Solo le tipologie che un Media può davvero avere: mai "Profilo ufficiale" (§8). */
const MEDIA_KINDS_SHOWN: readonly string[] = ["testata", "giornalista", "creator", "pagina"];

function personRoleLabel(meta: FeedAuthorMeta): string | null {
  const role = clean(meta.role);

  if (!role) {
    return null;
  }

  const position = clean(meta.primaryPosition);

  if (role === "player" && position) {
    return getPlayerPositionLabel(position, formatRole(role));
  }

  return formatRole(role);
}

/**
 * Le parti della seconda riga SENZA il tempo, mai più di due: §9 vieta di
 * mostrare insieme ruolo, Società, categoria, città, regione e badge.
 *  • persona: ruolo (per i calciatori la posizione) + Società attuale; per
 *    Allenatori e Staff, senza Società, il contesto Team (§69). Team e Società
 *    restano distinti: non si mostrano mai insieme.
 *  • Società: categoria.
 *  • Media: tipologia.
 * Nessun motivo di suggerimento (§9) e nessun "Profilo ufficiale" (§8).
 */
export function authorMetaParts(
  identityType: FeedIdentityType,
  meta: FeedAuthorMeta,
): string[] {
  switch (identityType) {
    case "society":
      return [clean(meta.clubCategory)].filter((part): part is string => part !== null);

    case "media": {
      const kind = clean(meta.mediaKind);
      return kind && MEDIA_KINDS_SHOWN.includes(kind)
        ? [formatSourceKindLabel(kind as MediaSourceKind)]
        : [];
    }

    case "person": {
      const isTeamBased = meta.role === "coach" || meta.role === "staff";
      const context = clean(meta.clubName) ?? (isTeamBased ? clean(meta.teamLabel) : null);

      return [personRoleLabel(meta), context].filter(
        (part): part is string => part !== null,
      );
    }
  }
}

type AuthorLineInput = {
  identityType: FeedIdentityType;
  meta: FeedAuthorMeta;
  publishedAt: string | null;
  now?: Date;
};

/** "Attaccante · AC Como · 2 h". */
export function buildAuthorMetaLine({
  identityType,
  meta,
  publishedAt,
  now,
}: AuthorLineInput): string {
  const time = publishedAt ? formatCompactRelativeTime(publishedAt, now) : "";

  return [...authorMetaParts(identityType, meta), time].filter(Boolean).join(" · ");
}

/** §75: "Matteo Rossi, profilo verificato, Attaccante AC Como, pubblicato 2 ore fa". */
export function buildAuthorAccessibilityLabel({
  name,
  isVerified,
  identityType,
  meta,
  publishedAt,
  now,
}: AuthorLineInput & { name: string; isVerified: boolean }): string {
  const spoken = publishedAt ? formatSpokenRelativeTime(publishedAt, now) : "";

  return [
    name,
    isVerified ? "profilo verificato" : null,
    authorMetaParts(identityType, meta).join(" "),
    spoken ? `pubblicato ${spoken}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

// ────────────────────────────────────────────────────────────────
// Media collection (§23–34, §40–41, §71)
// ────────────────────────────────────────────────────────────────

/** §31: nel Feed le celle sono al massimo quattro, il resto è "+N". */
export const POST_MEDIA_MAX_CELLS = 4;

const DEFAULT_IMAGE_RATIO = 4 / 3;
const DEFAULT_VIDEO_RATIO = 16 / 9;
/** §71: niente portrait giganti (4:5) né panorama illeggibili (~1,91:1). */
const MIN_SINGLE_RATIO = 4 / 5;
const MAX_SINGLE_RATIO = 1.91;

/**
 * Rapporto del contenitore per i layout a più celle, scelto perché le celle
 * risultino quasi quadrate (§28–30): coppia 2:1, 1+2 a 3:2 con il principale a
 * due terzi della larghezza, griglia 2×2 a 4:3.
 */
const PAIR_RATIO = 2;
const TRIO_RATIO = 3 / 2;
const QUAD_RATIO = 4 / 3;

export type MediaLayoutKind = "none" | "single" | "pair" | "trio" | "quad";

export type MediaCellPlan = {
  item: FeedMediaItem;
  /** Indice nella collezione ordinata, quello passato al viewer (§35). */
  index: number;
  /** N di "+N" sull'ultima cella quando i media superano le quattro celle. */
  overflowCount: number | null;
};

export type MediaLayout = {
  kind: MediaLayoutKind;
  cells: MediaCellPlan[];
  total: number;
  /** Rapporto del contenitore: spazio riservato prima del download (§40). */
  aspectRatio: number;
};

/** §25: l'ordine scelto dall'autore è quello mostrato; a parità vale l'ordine ricevuto. */
export function orderMedia(media: readonly FeedMediaItem[]): FeedMediaItem[] {
  return media
    .map((item, original) => ({ item, original }))
    .sort((a, b) => a.item.position - b.item.position || a.original - b.original)
    .map(({ item }) => item);
}

/** §26, §71: rapporto del media singolo, con default e limiti. */
export function singleMediaAspectRatio(item: FeedMediaItem): number {
  const fallback = item.type === "video" ? DEFAULT_VIDEO_RATIO : DEFAULT_IMAGE_RATIO;
  const derived =
    item.width && item.height && item.width > 0 && item.height > 0
      ? item.width / item.height
      : null;
  const raw = item.aspectRatio ?? derived;

  if (raw == null || !Number.isFinite(raw) || raw <= 0) {
    return fallback;
  }

  return Math.min(MAX_SINGLE_RATIO, Math.max(MIN_SINGLE_RATIO, raw));
}

export function buildMediaLayout(media: readonly FeedMediaItem[]): MediaLayout {
  const ordered = orderMedia(media);
  const total = ordered.length;

  if (total === 0) {
    return { aspectRatio: 1, cells: [], kind: "none", total: 0 };
  }

  const cells: MediaCellPlan[] = ordered
    .slice(0, POST_MEDIA_MAX_CELLS)
    .map((item, index) => ({
      index,
      item,
      overflowCount:
        total > POST_MEDIA_MAX_CELLS && index === POST_MEDIA_MAX_CELLS - 1
          ? total - POST_MEDIA_MAX_CELLS
          : null,
    }));

  switch (cells.length) {
    case 1:
      return { aspectRatio: singleMediaAspectRatio(cells[0].item), cells, kind: "single", total };
    case 2:
      return { aspectRatio: PAIR_RATIO, cells, kind: "pair", total };
    case 3:
      return { aspectRatio: TRIO_RATIO, cells, kind: "trio", total };
    default:
      return { aspectRatio: QUAD_RATIO, cells, kind: "quad", total };
  }
}

export type MediaCellState = "ready" | "processing" | "unavailable";

/**
 * HOM-03 §64, §114: `uploaded` e `processing` sono per l'utente lo stesso stato
 * («Video in elaborazione»): il client non mostra mai l'enum tecnico. Prende una
 * stringa per non dipendere da quali valori il tipo del payload ammette.
 */
export function isProcessingState(state: string): boolean {
  return state === "processing" || state === "uploaded";
}

/**
 * §41, §87–88: stato di una singola cella. Una cella fallita non fa fallire il
 * Post. Per un video la miniatura che non carica non lo rende "non
 * disponibile": il video resta riproducibile, manca solo l'anteprima.
 */
export function mediaCellState(item: FeedMediaItem, imageFailed = false): MediaCellState {
  if (item.type === "video") {
    if (isProcessingState(item.processingState)) {
      return "processing";
    }

    return item.processingState === "failed" || item.availability === "unavailable"
      ? "unavailable"
      : "ready";
  }

  return item.availability === "unavailable" ||
    item.processingState === "failed" ||
    imageFailed
    ? "unavailable"
    : "ready";
}

export function mediaCellStateLabel(item: FeedMediaItem, state: MediaCellState): string | null {
  if (state === "ready") {
    return null;
  }

  if (item.type === "image") {
    return FEED_MEDIA_STATE_LABELS.imageUnavailable;
  }

  return state === "processing"
    ? FEED_MEDIA_STATE_LABELS.videoProcessing
    : FEED_MEDIA_STATE_LABELS.videoUnavailable;
}

/** Sorgente dell'immagine della cella: miniatura per i video, intera per il media singolo. */
export function mediaImageUri(item: FeedMediaItem, preferFull: boolean): string | null {
  if (item.type === "video") {
    return item.thumbnailUrl ?? null;
  }

  return preferFull
    ? (item.url ?? item.thumbnailUrl ?? null)
    : (item.thumbnailUrl ?? item.url ?? null);
}

/** §27: "0:48", "1:02:05". Più compatta di `formatVideoDuration` ("02:34") di CER-05. */
export function formatPostVideoDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

function plural(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

/** "48 secondi", "1 minuto e 2 secondi", "1 ora, 2 minuti e 5 secondi". */
export function spokenVideoDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const parts = [
    hours > 0 ? plural(hours, "ora", "ore") : null,
    minutes > 0 ? plural(minutes, "minuto", "minuti") : null,
    secs > 0 ? plural(secs, "secondo", "secondi") : null,
  ].filter((part): part is string => part !== null);

  if (parts.length <= 1) {
    return parts[0] ?? null;
  }

  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}

/**
 * §76, §107: etichetta di una cella per lo screen reader. L'overlay +N parla
 * della galleria, non del singolo media; un video dice "Video, durata …".
 */
export function mediaCellAccessibilityLabel(
  cell: MediaCellPlan,
  total: number,
  state: MediaCellState,
): string {
  if (cell.overflowCount !== null) {
    return `Gallery con ${total} contenuti`;
  }

  const stateLabel = mediaCellStateLabel(cell.item, state);

  if (stateLabel) {
    return stateLabel;
  }

  if (cell.item.type === "video") {
    const duration = spokenVideoDuration(cell.item.durationSeconds);
    const base = duration ? `Video, durata ${duration}` : "Video";

    return cell.item.altText ? `${cell.item.altText}. ${base}` : base;
  }

  if (cell.item.altText) {
    return cell.item.altText;
  }

  return total > 1 ? `Immagine ${cell.index + 1} di ${total}` : "Immagine";
}

// ────────────────────────────────────────────────────────────────
// Link preview (§43)
// ────────────────────────────────────────────────────────────────

/** Solo il dominio, mai l'URL lungo. Ricade sull'host dell'URL se il dominio manca. */
export function linkPreviewDomain(preview: Pick<FeedLinkPreview, "domain" | "url">): string {
  const domain = clean(preview.domain);

  if (domain) {
    return domain;
  }

  const host = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(preview.url)?.[1] ?? "";

  return host.replace(/^www\./i, "");
}

// ────────────────────────────────────────────────────────────────
// Riga azioni (§49–58, §105–108)
// ────────────────────────────────────────────────────────────────

export type PostActionModel = {
  like: { text: string; accessibilityLabel: string; selected: boolean };
  comment: { text: string; accessibilityLabel: string };
  share: { text: string; accessibilityLabel: string };
};

/**
 * Un solo controllo per ogni interazione: il conteggio fa parte del controllo
 * (§48, §57). Zero → solo la label, mai "0". Il numero parla allo screen reader
 * come "146 Mi piace" / "18 commenti" (§107). Condividi non ha mai un conteggio (§58).
 */
export function buildPostActionModel(input: {
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
}): PostActionModel {
  const likes = normalizeCount(input.likesCount);
  const comments = normalizeCount(input.commentsCount);

  return {
    comment: {
      accessibilityLabel:
        comments > 0
          ? `${formatCount(comments)} ${comments === 1 ? "commento" : "commenti"}`
          : FEED_ACTION_COMMENT,
      text: comments > 0 ? formatCount(comments) : FEED_ACTION_COMMENT,
    },
    like: {
      accessibilityLabel: likes > 0 ? `${formatCount(likes)} ${FEED_ACTION_LIKE}` : FEED_ACTION_LIKE,
      selected: input.isLiked,
      text: likes > 0 ? formatCount(likes) : FEED_ACTION_LIKE,
    },
    share: { accessibilityLabel: FEED_ACTION_SHARE, text: FEED_ACTION_SHARE },
  };
}
