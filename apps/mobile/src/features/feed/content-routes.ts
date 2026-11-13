/**
 * Destinazioni e provenienza dei contenuti (HOM-04 §34–37, §122–127).
 *
 * Un file solo per le destinazioni di gestione (Luigi 2026-11-13): Modifica
 * (HOM-06.1 / HOM-06.2) e Dettagli e statistiche (HOM-05) non esistono ancora,
 * quindi oggi la destinazione è `null` e il chiamante risponde «in arrivo».
 * Quando le schermate esistono si cambia solo questo file: i parametri (§34,
 * §37) sono già preparati. Nessuna schermata segnaposto.
 *
 * `ContentOrigin` è il contesto di navigazione che ogni apertura porta con sé
 * (§122). Il Feed lo passa per ogni elemento; le altre superfici non lo
 * passano, e la sua assenza vuol dire «affidati al Back» (§127): non si
 * modificano le ~20 superfici che aprono `/content/...`.
 */

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

/** Destinazione della modifica (HOM-06.1 Post, HOM-06.2 Articolo): non esiste ancora. */
export function editContentHref(params: ContentManageParams): string | null {
  void params;
  return null;
}

/** Destinazione di Dettagli e statistiche (HOM-05): non esiste ancora. */
export function viewInsightsHref(params: ContentManageParams): string | null {
  void params;
  return null;
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
