/**
 * Destinazioni di bozze e programmati (HOM-06.2 §137, §147, §163, §165, §200).
 *
 * Una definizione per destinazione (CLAUDE.md): la lista unica
 * `/drafts?tab=drafts|scheduled` è fuori dalle tab (niente bottom navigation,
 * come il composer). Aprire un elemento instrada al composer del suo formato
 * (§147): Post → composer HOM-06.1, Articolo → editor HOM-06.2 nella modalità
 * salvata. L'href dell'editor articolo vive in `article-editor/article-routes.ts`
 * e qui si importa: nessuna seconda definizione.
 */

import { articleDraftHref } from "../article-editor/article-routes";
import { COMPOSER_PATH } from "../post-composer/composer-routes";
import type { ArticleCreationMode, ContentFormat, ContentRef, DraftsTab } from "./publishing-types";

export const DRAFTS_PATH = "/drafts";

export function draftsHref(tab: DraftsTab = "drafts"): string {
  return `${DRAFTS_PATH}?tab=${tab}`;
}

export function parseDraftsTab(value: string | string[] | undefined): DraftsTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "scheduled" ? "scheduled" : "drafts";
}

/** §147: Post → composer HOM-06.1 sulla bozza; ARTICLE → editor nella modalità salvata. */
export function openDraftHref(format: ContentFormat, ref: ContentRef, creationMode: ArticleCreationMode | null = null): string {
  if (format === "article") {
    return articleDraftHref(ref, creationMode);
  }
  return `${COMPOSER_PATH}?draft_type=${ref.contentType}&draft_id=${encodeURIComponent(ref.contentId)}&origin=DRAFTS`;
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : null;
}

const REF_TYPES = ["profile_post", "club_media", "media_profile"] as const;

/** Il ref di una bozza passato a un composer (`draft_type` + `draft_id`), o null. */
export function parseDraftRef(params: SearchParams): ContentRef | null {
  const type = first(params.draft_type);
  const id = first(params.draft_id);
  const contentType = REF_TYPES.find((candidate) => candidate === type);
  return contentType && id ? { contentId: id, contentType } : null;
}
