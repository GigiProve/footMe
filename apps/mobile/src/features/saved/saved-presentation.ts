/**
 * Derivazioni pure del Saved Center (HOM-07 §105–§128, §152–§161).
 *
 * Qui vivono il parsing difensivo delle righe di `list_saved`, i testi delle
 * righe, le destinazioni e il dedupe tra pagine (§161): niente di tutto ciò
 * richiede un render per essere verificato.
 *
 * Scelte che discendono dalla spec:
 *  • content row: etichetta discreta POST / VIDEO / ARTICOLO (§113), titolo o
 *    prime righe del body, mai un placeholder immagine per il Post text-only
 *    (§110);
 *  • Società: le righe `team` stanno qui come «Squadra · Società» (§82, Luigi
 *    2026-11-14); non esiste una categoria Squadre;
 *  • posizione: ruolo, Società, eventuale Squadra, categoria, località e, se
 *    chiusa, «Posizione chiusa» senza CTA (§127–§128, §150). Mai scadenza,
 *    candidati o match score.
 */

import { contentDetailHref } from "../feed/content-routes";
import { authorMetaParts } from "../feed/feed-post-presentation";
import type { FeedContentType } from "../feed/feed-types";
import { formatRole } from "../profiles/profile-display-helpers";
import { formatCompactRelativeTime } from "../../lib/relative-time";
import {
  SAVED_CONFIRMATION,
  SAVED_COPY,
  SAVED_ERRORS,
  saveFailureMessage,
} from "./saved-copy";
import { savedKey } from "./saved-store";
import {
  SAVED_CATEGORIES,
  type SavedCategory,
  type SavedClubPayload,
  type SavedContentPayload,
  type SavedCursor,
  type SavedItemKind,
  type SavedListRowWire,
  type SavedPage,
  type SavedPositionPayload,
  type SavedProfilePayload,
  type SavedRow,
  type SavedTeamPayload,
} from "./saved-types";

// ── Copy (§152–§158, §181) ──────────────────────────────────────
// I testi stanno in `saved-copy.ts` (senza dipendenze); qui si riesportano
// per chi già importa dalla presentazione.

export { SAVED_CONFIRMATION, SAVED_COPY, SAVED_ERRORS, saveFailureMessage };

export const SAVED_TAB_ITEMS: readonly { label: string; value: SavedCategory }[] = [
  { label: "Contenuti", value: "content" },
  { label: "Profili", value: "profile" },
  { label: "Società", value: "society" },
  { label: "Posizioni", value: "position" },
];

export function emptyCopy(category: SavedCategory): { description?: string; title: string } {
  switch (category) {
    case "content":
      return {
        description: SAVED_COPY.emptyContentDescription,
        title: SAVED_COPY.emptyContentTitle,
      };
    case "profile":
      return { title: SAVED_COPY.emptyProfileTitle };
    case "society":
      return { title: SAVED_COPY.emptySocietyTitle };
    case "position":
      return { title: SAVED_COPY.emptyPositionTitle };
  }
}

/**
 * `?filter=` resta compatibile con i vecchi ingressi (`content`, `profile`,
 * `club`, `position`, `all`): un valore sconosciuto apre Contenuti.
 */
export function resolveInitialCategory(value: string | string[] | undefined): SavedCategory {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === "club" || raw === "team") {
    return "society";
  }

  return SAVED_CATEGORIES.find((category) => category === raw) ?? "content";
}

// ── Parsing difensivo di list_saved ─────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const CONTENT_TYPES: readonly FeedContentType[] = [
  "club_media",
  "fan_media",
  "fan_tribuna",
  "media_profile",
  "media_tribuna",
  "profile_post",
];

function itemKindOf(value: unknown): SavedItemKind {
  return value === "video" || value === "article" ? value : "post";
}

function parseContentPayload(raw: unknown): SavedContentPayload {
  const payload = asRecord(raw);
  const author = asRecord(payload.author);
  const authorName = str(author.name);

  return {
    author: authorName
      ? {
          id: str(author.id) ?? "",
          is_verified: author.is_verified === true,
          name: authorName,
          type: str(author.type) ?? "",
        }
      : null,
    duration_seconds: num(payload.duration_seconds),
    excerpt: str(payload.excerpt),
    item_kind: itemKindOf(payload.item_kind),
    published_at: str(payload.published_at),
    thumbnail_url: str(payload.thumbnail_url),
    title: str(payload.title),
  };
}

function parseProfilePayload(raw: unknown): SavedProfilePayload {
  const payload = asRecord(raw);

  return {
    avatar_url: str(payload.avatar_url),
    club_name: str(payload.club_name),
    is_verified: payload.is_verified === true,
    media_kind: str(payload.media_kind),
    name: str(payload.name) ?? "",
    primary_position: str(payload.primary_position),
    role: str(payload.role),
    team_label: str(payload.team_label),
  };
}

function parseClubPayload(raw: unknown): SavedClubPayload {
  const payload = asRecord(raw);

  return {
    club_category: str(payload.club_category),
    is_verified: payload.is_verified === true,
    logo_url: str(payload.logo_url),
    name: str(payload.name) ?? "",
  };
}

function parseTeamPayload(raw: unknown): SavedTeamPayload {
  const payload = asRecord(raw);

  return {
    ...parseClubPayload(raw),
    club_id: str(payload.club_id),
    club_name: str(payload.club_name),
    team_category: str(payload.team_category),
  };
}

function parsePositionPayload(raw: unknown): SavedPositionPayload {
  const payload = asRecord(raw);

  return {
    category: str(payload.category),
    club_name: str(payload.club_name),
    lifecycle: payload.lifecycle === "closed" ? "closed" : "open",
    location: str(payload.location),
    // §127: il ruolo è l'elemento principale. `role_label` è l'etichetta leggibile
    // dal catalogo ruoli («Portiere»); il `title` dell'annuncio è il ripiego.
    role_label: str(payload.role_label) ?? str(payload.title),
    target_role: str(payload.target_role),
    team_label: str(payload.team_label),
  };
}

/**
 * Una riga non riconoscibile si scarta invece di far cadere la lista: il
 * server può introdurre un tipo che un client vecchio non conosce.
 */
export function parseSavedRow(wire: SavedListRowWire): SavedRow | null {
  const id = str(wire.target_id);

  if (!id) {
    return null;
  }

  const savedAt = wire.saved_at;

  switch (wire.target_type) {
    case "content": {
      const contentType = CONTENT_TYPES.find((type) => type === wire.content_type);
      return contentType
        ? {
            kind: "content",
            payload: parseContentPayload(wire.payload),
            savedAt,
            target: { contentType, id, type: "content" },
          }
        : null;
    }
    case "profile":
      return {
        kind: "profile",
        payload: parseProfilePayload(wire.payload),
        savedAt,
        target: { id, type: "profile" },
      };
    case "society":
    case "club":
      return {
        kind: "society",
        payload: parseClubPayload(wire.payload),
        savedAt,
        target: { id, type: "society" },
      };
    case "team":
      return {
        kind: "team",
        payload: parseTeamPayload(wire.payload),
        savedAt,
        target: { id, type: "team" },
      };
    case "position":
      return {
        kind: "position",
        payload: parsePositionPayload(wire.payload),
        savedAt,
        target: { id, type: "position" },
      };
    default:
      return null;
  }
}

/** Le righe della pagina e il cursore della sua ultima riga (§160). */
export function parseSavedPage(wireRows: readonly SavedListRowWire[]): SavedPage {
  const rows: SavedRow[] = [];

  for (const wire of wireRows) {
    const row = parseSavedRow(wire);
    if (row) {
      rows.push(row);
    }
  }

  const last = wireRows[wireRows.length - 1];
  const cursor = last?.next_cursor ?? null;

  return {
    nextCursor: cursor && cursor.ts && cursor.k ? (cursor as SavedCursor) : null,
    rows,
  };
}

export function savedRowKey(row: SavedRow): string {
  return savedKey(row.target);
}

/** §161: nessun target duplicato tra pagine; vale la prima occorrenza. */
export function flattenSavedPages(pages: readonly SavedPage[] | undefined): SavedRow[] {
  const seen = new Set<string>();
  const rows: SavedRow[] = [];

  for (const page of pages ?? []) {
    for (const row of page.rows) {
      const key = savedRowKey(row);
      if (!seen.has(key)) {
        seen.add(key);
        rows.push(row);
      }
    }
  }

  return rows;
}

// ── Destinazioni (§114, §123–§126) ──────────────────────────────

export function savedRowHref(row: SavedRow): string {
  switch (row.kind) {
    case "content":
      // HOM-05: la provenienza Salvati, per la source degli eventi.
      return contentDetailHref(row.target.contentType, row.target.id, { origin: "SAVED" });
    case "profile":
      return `/profile/${row.target.id}`;
    case "society":
      return `/club/${row.target.id}`;
    case "team":
      return `/club/team/${row.target.id}`;
    case "position":
      return `/position/${row.target.id}`;
  }
}

// ── Testi di riga ───────────────────────────────────────────────

export const CONTENT_KIND_LABEL: Record<SavedItemKind, string> = {
  article: "ARTICOLO",
  post: "POST",
  video: "VIDEO",
};

/** «03:24» (§111): minuti e secondi, con le ore solo se servono. */
export function formatClock(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** §109–§112: l'Articolo ha il titolo; il Post text-only le prime righe del body. */
export function contentRowTitle(payload: SavedContentPayload): string {
  const text =
    payload.item_kind === "post"
      ? (payload.excerpt ?? payload.title)
      : (payload.title ?? payload.excerpt);
  if (text && text.trim().length > 0) {
    return text;
  }
  // Un Post solo media non ha testo: la riga dice comunque cosa si apre.
  return { article: "Articolo", post: "Post con contenuti multimediali", video: "Video" }[payload.item_kind];
}

export function contentRowTime(payload: SavedContentPayload, now?: Date): string {
  return payload.published_at ? formatCompactRelativeTime(payload.published_at, now) : "";
}

/** «AC Como · 18 ago»: autore e tempo; la verifica è un glifo accanto al nome. */
export function contentRowMeta(payload: SavedContentPayload, now?: Date): string {
  return [payload.author?.name ?? null, contentRowTime(payload, now)].filter(Boolean).join(" · ");
}

/** Una riga è una sola unità semantica (§179): tipo, titolo, autore, verifica e tempo. */
export function contentRowAccessibilityLabel(payload: SavedContentPayload, now?: Date): string {
  const kind = { article: "Articolo", post: "Post", video: "Video" }[payload.item_kind];

  return [
    kind,
    contentRowTitle(payload),
    payload.author?.name ?? null,
    payload.author?.is_verified ? "profilo verificato" : null,
    contentRowTime(payload, now),
  ]
    .filter(Boolean)
    .join(", ");
}

export function profileRowSubtitle(payload: SavedProfilePayload): string {
  // Il profilo Media dice la tipologia (testata, creator…), non un ruolo professionale.
  const parts = authorMetaParts(payload.role === "media" ? "media" : "person", {
    clubCategory: null,
    clubName: payload.club_name,
    mediaKind: payload.media_kind ?? null,
    primaryPosition: payload.primary_position,
    role: payload.role,
    teamLabel: payload.team_label,
  });

  return parts.length > 0 ? parts.join(" · ") : payload.role ? formatRole(payload.role) : "";
}

export function societyRowTitle(row: Extract<SavedRow, { kind: "society" | "team" }>): string {
  return row.payload.name;
}

/**
 * Società: la categoria («Serie D»). Squadra: «Squadra · AC Como» — la squadra
 * resta legata alla sua Società (§82, decisione di Luigi del 2026-11-14), e la
 * categoria della squadra è già nel nome («Under 17»).
 */
export function societyRowSubtitle(row: Extract<SavedRow, { kind: "society" | "team" }>): string {
  if (row.kind === "team") {
    return ["Squadra", row.payload.club_name].filter(Boolean).join(" · ");
  }

  return row.payload.club_category ?? "Società";
}

export function positionRowTitle(payload: SavedPositionPayload): string {
  return payload.role_label ?? (payload.target_role ? formatRole(payload.target_role) : "Posizione");
}

export function positionRowSubtitle(payload: SavedPositionPayload): string {
  return [payload.club_name, payload.team_label].filter(Boolean).join(" · ");
}

export function positionRowMeta(payload: SavedPositionPayload): string {
  return [payload.category, payload.location].filter(Boolean).join(" · ");
}
