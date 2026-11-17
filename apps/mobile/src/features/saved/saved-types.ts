/**
 * Tipi del dominio Salvati (HOM-07 §77–§83, §166–§167).
 *
 * Un solo sistema Saved per tutta l'app: un target è identificato da
 * `target_type` + `target_id` (§167) e, per i contenuti, dal `content_type`.
 * I salvataggi restano privati dell'utente (§70–§72): nessun tipo qui espone
 * chi ha salvato.
 *
 * `team` è un target a sé per la scrittura (`saved_teams`), ma NON è una
 * categoria: in lettura compare dentro Società come «Squadra · Società» (§82,
 * decisione Luigi 2026-11-14).
 */

import type { FeedContentType } from "../feed/feed-types";

/** Le quattro categorie del Saved Center (§105). Nessuna categoria «Squadre» (§82). */
export const SAVED_CATEGORIES = ["content", "profile", "society", "position"] as const;
export type SavedCategory = (typeof SAVED_CATEGORIES)[number];

/**
 * I sei content type salvabili (Feed, dettaglio, Cerca > Media e contenuti) e,
 * da HOM-15 (§174–§175), i media di carriera del profilo: non hanno un
 * dettaglio `/content`, la riga dei Salvati apre il profilo sulla tab Media.
 */
export type SavedContentType = FeedContentType | "career_media";

export type SavedTarget =
  | { type: "content"; contentType: SavedContentType; id: string }
  | { type: "profile"; id: string }
  | { type: "society"; id: string }
  | { type: "team"; id: string }
  | { type: "position"; id: string };

export type SavedTargetType = SavedTarget["type"];

/**
 * Classificazione come il Feed: Articolo, Video editoriale o Post (§78, §113).
 * `photo` solo per i media di carriera (HOM-15): una foto del profilo non è un Post.
 */
export type SavedItemKind = "post" | "video" | "article" | "photo";

export type SavedContentPayload = {
  item_kind: SavedItemKind;
  title: string | null;
  excerpt: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  author: {
    type: string;
    id: string;
    name: string;
    is_verified: boolean;
  } | null;
  published_at: string | null;
  /** HOM-15: solo `career_media` — il profilo che la riga apre (tab Media). */
  owner_profile_id?: string | null;
};

export type SavedProfilePayload = {
  /** Solo per i profili Media (tipologia: testata, giornalista, creator, pagina). */
  media_kind?: string | null;
  name: string;
  avatar_url: string | null;
  is_verified: boolean;
  role: string | null;
  primary_position: string | null;
  club_name: string | null;
  team_label: string | null;
};

export type SavedClubPayload = {
  name: string;
  logo_url: string | null;
  is_verified: boolean;
  club_category: string | null;
};

export type SavedTeamPayload = SavedClubPayload & {
  club_id: string | null;
  club_name: string | null;
  /** Categoria della squadra; se manca vale quella della Società. */
  team_category?: string | null;
};

/** §127–§128: niente scadenza, candidati o match score nella riga salvata. */
export type SavedPositionPayload = {
  /** Il ruolo mostrato: `role_label` dal server, altrimenti il `title` dell'annuncio. */
  role_label: string | null;
  target_role: string | null;
  club_name: string | null;
  team_label: string | null;
  category: string | null;
  location: string | null;
  lifecycle: "open" | "closed";
};

/** La riga come arriva da `list_saved` (colonne comuni + payload per categoria). */
export type SavedListRowWire = {
  target_type: string;
  target_id: string;
  content_type: string | null;
  saved_at: string;
  payload: unknown;
  next_cursor: SavedCursor | null;
};

/** Keyset `{ts, k}` (§120, §161): lo restituisce il server sull'ultima riga. */
export type SavedCursor = { ts: string; k: string };

export type SavedRow =
  | {
      kind: "content";
      target: Extract<SavedTarget, { type: "content" }>;
      savedAt: string;
      payload: SavedContentPayload;
    }
  | {
      kind: "profile";
      target: Extract<SavedTarget, { type: "profile" }>;
      savedAt: string;
      payload: SavedProfilePayload;
    }
  | {
      kind: "society";
      target: Extract<SavedTarget, { type: "society" }>;
      savedAt: string;
      payload: SavedClubPayload;
    }
  | {
      kind: "team";
      target: Extract<SavedTarget, { type: "team" }>;
      savedAt: string;
      payload: SavedTeamPayload;
    }
  | {
      kind: "position";
      target: Extract<SavedTarget, { type: "position" }>;
      savedAt: string;
      payload: SavedPositionPayload;
    };

export type SavedPage = {
  rows: SavedRow[];
  nextCursor: SavedCursor | null;
  /**
   * HOM-07 §141: istante (ms) in cui è partita la richiesta della pagina; lo
   * store Salvati lo usa per far prevalere solo i dati più nuovi.
   */
  fetchedAt?: number;
};
