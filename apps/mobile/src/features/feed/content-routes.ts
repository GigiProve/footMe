/**
 * Destinazioni e provenienza dei contenuti (HOM-04 §34–37, §122–127).
 *
 * Un file solo per le destinazioni di gestione (Luigi 2026-11-13): Modifica è
 * il composer Post (HOM-06.1) o l'editor Articolo (HOM-06.2); per i tipi senza
 * editor la destinazione è `null` e il chiamante risponde «in arrivo».
 * Dettagli e statistiche (HOM-05): la sua href vive in
 * `content-insights/insights-routes.ts`. Nessuna schermata segnaposto.
 *
 * `ContentOrigin` è il contesto di navigazione che ogni apertura porta con sé
 * (§122). Il Feed lo passa per ogni elemento; le altre superfici non lo
 * passano, e la sua assenza vuol dire «affidati al Back» (§127): non si
 * modificano le ~20 superfici che aprono `/content/...`.
 */

import { articleEditHref, type ArticleOrigin } from "../article-editor/article-routes";
import { contentInsightsHref } from "../content-insights/insights-routes";
import { composerEditHref, isComposerEditableType } from "../post-composer/composer-routes";
import type { ContentVisibleKind } from "./content-actions-presentation";
import type { FeedContentType, FeedIdentityType, FeedScope } from "./feed-types";

export const CONTENT_ORIGINS = [
  "HOME_PER_TE",
  "HOME_SEGUITI",
  "PROFILE",
  "SEARCH",
  "SAVED",
  "MESSAGE",
  "DEEP_LINK",
] as const;

export type ContentOrigin = (typeof CONTENT_ORIGINS)[number];

export function originForScope(scope: FeedScope): ContentOrigin {
  return scope === "seguiti" ? "HOME_SEGUITI" : "HOME_PER_TE";
}

export function isHomeOrigin(origin: ContentOrigin | null): boolean {
  return origin === "HOME_PER_TE" || origin === "HOME_SEGUITI";
}

/** Il valore della query string, o `null` se assente o sconosciuto. */
export function parseContentOrigin(value: string | string[] | undefined): ContentOrigin | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return CONTENT_ORIGINS.find((origin) => origin === raw) ?? null;
}

/** §34, §37: i parametri che le destinazioni future ricevono. */
export type ContentManageParams = {
  content_id: string;
  content_type: FeedContentType;
  author_identity_id: string | null;
  author_identity_type: FeedIdentityType;
  origin: ContentOrigin;
  /** `updated_at` del contenuto all'apertura del menu (§73): solo la modifica lo usa. */
  current_version: string | null;
};

export type ContentManageTarget = {
  contentId: string;
  contentType: FeedContentType;
  authorIdentityId: string | null;
  authorIdentityType: FeedIdentityType;
  origin: ContentOrigin;
  version: string | null;
};

export function contentManageParams(target: ContentManageTarget): ContentManageParams {
  return {
    author_identity_id: target.authorIdentityId,
    author_identity_type: target.authorIdentityType,
    content_id: target.contentId,
    content_type: target.contentType,
    current_version: target.version,
    origin: target.origin,
  };
}

/** I due tipi che ospitano Articoli (decisione 2026-11-13): Società e Media. */
const ARTICLE_EDITABLE_TYPES: readonly FeedContentType[] = ["club_media", "media_profile"];

/**
 * L'origin di navigazione di un contenuto → quello dell'editor Articolo. Solo
 * la Home ha un'identità propria; ogni altra superficie (profilo, Cerca,
 * Salvati, messaggio, deep link) rientra con `CONTENT_DETAIL`, il valore
 * neutro: l'editor torna con `router.back()` alla superficie di partenza.
 */
export function articleOriginForContent(origin: ContentOrigin): ArticleOrigin {
  return origin === "HOME_PER_TE" || origin === "HOME_SEGUITI" ? origin : "CONTENT_DETAIL";
}

/**
 * Destinazione della modifica, una sola per tipo di contenuto visibile.
 *
 *  • Articolo (HOM-06.2 §217–§218): `club_media` / `media_profile` con tipo
 *    visibile `article` → editor Articolo (`/article-compose/open`, che risolve
 *    la modalità dal contenuto). Il `ContentManageTarget` porta `visibleKind`
 *    dal tipo di elemento del Feed, che il server classifica con la stessa
 *    regola di `footme_feed_item_type`.
 *  • Post (HOM-06.1 §143): composer in modalità Modifica. Per i tre tipi che
 *    ospitano Post si costruisce la href anche senza `visibleKind` e
 *    `fetch_post_for_edit` rifiuta ciò che non è un Post; la capability
 *    `canEdit` del menu resta il gate di visibilità.
 *  • Gli altri tipi: `null` → «in arrivo».
 */
export function editContentHref(
  params: ContentManageParams,
  visibleKind: ContentVisibleKind | null = null,
): string | null {
  if (visibleKind === "article" && ARTICLE_EDITABLE_TYPES.includes(params.content_type)) {
    return articleEditHref(
      { contentId: params.content_id, contentType: params.content_type },
      articleOriginForContent(params.origin),
    );
  }
  return isComposerEditableType(params.content_type) ? composerEditHref(params) : null;
}

/**
 * Destinazione di Dettagli e statistiche (HOM-05 §3, §10): la route radice
 * `/content/insights/[type]/[id]` con la provenienza, perché il Back torni
 * alla superficie di partenza. Il permesso lo rivalida il server (§5).
 */
export function viewInsightsHref(params: ContentManageParams): string {
  return contentInsightsHref(params.content_type, params.content_id, params.origin);
}

/** Il dettaglio contenuto con la provenienza (§122). */
export function contentDetailHref(
  contentType: FeedContentType,
  postId: string,
  extra: { origin?: ContentOrigin | null; media?: number; position?: number } = {},
): string {
  const query: string[] = [];
  if (extra.media !== undefined) {
    query.push(`media=${extra.media}`);
  }
  if (extra.origin) {
    query.push(`origin=${extra.origin}`);
  }
  if (extra.position !== undefined) {
    query.push(`position=${extra.position}`);
  }
  const base = `/content/${contentType}/${postId}`;
  return query.length > 0 ? `${base}?${query.join("&")}` : base;
}

/** La Home esistente: l'unica destinazione costruita, e solo da deep link (§61). */
export const HOME_HREF = "/(tabs)";
