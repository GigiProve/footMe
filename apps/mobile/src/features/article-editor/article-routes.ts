/**
 * Destinazioni dell'editor Articolo (HOM-06.2 §7A, §7E–§7F, §7O, §28–§29,
 * §72, §147, §165, §217–§218). Una definizione per destinazione.
 *
 * Tutte FUORI da `(tabs)`: nessuna bottom navigation né chrome Home (§29, §7A).
 *  • `/article-compose`          — «Come vuoi creare l'articolo?» (§7A);
 *  • `/article-compose/editor`   — editor canonico (NATIVE e dopo l'import, §7E, §7T);
 *  • `/article-compose/link`     — Collega da un link (§7F);
 *  • `/article-compose/paste`    — Incolla un articolo (§7O);
 *  • `/article-compose/preview`  — Anteprima con il renderer reale (§73);
 *  • `/article-compose/open`     — riapertura per ref quando la modalità non è
 *    nota (notifica di fallimento §200): carica e sostituisce con lo schermo giusto.
 */

import type { ComposerOrigin } from "../post-composer/composer-types";
import type { ArticleCreationMode, ContentRef } from "../publishing/publishing-types";

export const ARTICLE_COMPOSE_PATH = "/article-compose";
export const ARTICLE_EDITOR_PATH = "/article-compose/editor";
export const ARTICLE_LINK_PATH = "/article-compose/link";
export const ARTICLE_PASTE_PATH = "/article-compose/paste";
export const ARTICLE_PREVIEW_PATH = "/article-compose/preview";
export const ARTICLE_OPEN_PATH = "/article-compose/open";

/** Origin dell'editor: quelli del composer Post più la lista Bozze e la notifica. */
export type ArticleOrigin = ComposerOrigin | "DRAFTS" | "NOTIFICATION";

const ORIGINS: readonly ArticleOrigin[] = [
  "HOME_PER_TE",
  "HOME_SEGUITI",
  "PERSONAL_PROFILE",
  "SOCIETY_PROFILE",
  "MEDIA_PROFILE",
  "CONTENT_DETAIL",
  "DRAFTS",
  "NOTIFICATION",
];

const MODES: readonly ArticleCreationMode[] = ["native", "external_link", "imported_text"];

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : null;
}

function query(parts: Record<string, string | null | undefined>): string {
  const entries = Object.entries(parts).filter(([, value]) => value);
  return entries.length > 0 ? `?${entries.map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`).join("&")}` : "";
}

/** §7A: il tap su «Articolo» del launcher. `identity` = identity contestuale (§22–§23). */
export function articleNewHref(origin: ArticleOrigin, identityId: string | null = null): string {
  return `${ARTICLE_COMPOSE_PATH}${query({ identity: identityId, origin })}`;
}

/** Lo schermo di una modalità per un articolo nuovo (dopo «Continua» o fast path §7A). */
export function articleModeHref(mode: ArticleCreationMode, origin: ArticleOrigin, identityId: string | null = null): string {
  const path = mode === "external_link" ? ARTICLE_LINK_PATH : mode === "imported_text" ? ARTICLE_PASTE_PATH : ARTICLE_EDITOR_PATH;
  return `${path}${query({ identity: identityId, mode: mode === "imported_text" ? null : mode, origin })}`;
}

/**
 * §7T: «Importa nell'editor» e il cambio modalità (§7X) passano lo stato nello
 * store condiviso (`article-store.ts`), non nell'URL: `handoff=1` dice
 * all'editor di NON ripartire da zero ma di proseguire la sessione in corso.
 * Un handoff senza sessione nello store (deep link, ricreazione) riparte pulito.
 */
export function articleHandoffHref(mode: ArticleCreationMode, origin: ArticleOrigin, identityId: string | null = null): string {
  const path = mode === "external_link" ? ARTICLE_LINK_PATH : ARTICLE_EDITOR_PATH;
  return `${path}${query({ handoff: "1", identity: identityId, mode, origin })}`;
}

/** §147: una bozza/programmato si riapre nella modalità salvata. */
export function articleDraftHref(ref: ContentRef, mode: ArticleCreationMode | null = null, origin: ArticleOrigin = "DRAFTS"): string {
  const params = { draft_id: ref.contentId, draft_type: ref.contentType, origin };
  if (mode === "external_link") return `${ARTICLE_LINK_PATH}${query(params)}`;
  if (mode === "native" || mode === "imported_text") return `${ARTICLE_EDITOR_PATH}${query({ ...params, mode })}`;
  return `${ARTICLE_OPEN_PATH}${query(params)}`;
}

/** §217–§218: ••• → Modifica articolo su un Articolo pubblicato. */
export function articleEditHref(ref: ContentRef, origin: ArticleOrigin = "CONTENT_DETAIL"): string {
  return `${ARTICLE_OPEN_PATH}${query({ draft_id: ref.contentId, draft_type: ref.contentType, edit: "1", origin })}`;
}

export type ArticleRouteParams = {
  origin: ArticleOrigin;
  identityId: string | null;
  mode: ArticleCreationMode | null;
  draftRef: ContentRef | null;
  editPublished: boolean;
  /** `handoff=1`: prosegue la sessione già nello store (vedi `articleHandoffHref`). */
  handoff: boolean;
};

const REF_TYPES = ["club_media", "media_profile", "profile_post"] as const;

export function parseArticleParams(params: SearchParams): ArticleRouteParams {
  const originRaw = first(params.origin);
  const modeRaw = first(params.mode);
  const type = first(params.draft_type);
  const id = first(params.draft_id);
  const contentType = REF_TYPES.find((candidate) => candidate === type);
  return {
    draftRef: contentType && id ? { contentId: id, contentType } : null,
    editPublished: first(params.edit) === "1",
    handoff: first(params.handoff) === "1",
    identityId: first(params.identity),
    mode: MODES.find((mode) => mode === modeRaw) ?? null,
    origin: ORIGINS.find((origin) => origin === originRaw) ?? "HOME_PER_TE",
  };
}
