/**
 * Destinazioni del composer Post (HOM-06.1 §2–6, §122–127, §143, §164).
 *
 * Una definizione sola per le due route, entrambe FUORI da `(tabs)` così non c'è
 * bottom navigation né header Home (§6):
 *   • `/post-compose`       — Nuovo post, con `origin` e identity suggerita;
 *   • `/post-compose/edit`  — Modifica post, con tipo, id, versione e origin.
 *
 * Ritorno (§122–127, §164): il composer è SEMPRE una push sopra la superficie
 * d'origine, quindi il ritorno corretto è `router.back()`: ripristina tab, Feed e
 * scroll senza costruire una nuova istanza della Home (§123, §127). Il fallback
 * esiste solo per l'apertura senza stack (deep link, ricreazione dello screen
 * dopo recovery §135): lì si va alla Home, l'unica destinazione costruibile
 * senza conoscere l'id della superficie.
 *
 * Nota sui cicli: `content-routes.ts` importa da qui `composerEditHref`, quindi
 * questo file importa da `content-routes` SOLO tipi. Per lo stesso motivo
 * `parseComposerParams` restituisce l'origin di modifica grezzo: lo schermo lo
 * passa a `parseContentOrigin`.
 */

import type { ContentManageParams, ContentOrigin } from "../feed/content-routes";
import type { FeedContentType } from "../feed/feed-types";
import { COMPOSER_ORIGINS, type ComposerOrigin } from "./composer-types";

export const COMPOSER_PATH = "/post-compose";
export const COMPOSER_EDIT_PATH = "/post-compose/edit";

/** Fallback senza stack: la Home esistente (stessa di `HOME_HREF`). */
export const COMPOSER_FALLBACK_HREF = "/(tabs)";

/** I tipi che il composer sa modificare: le tre tabelle dei Post (decisione 2026-11-13). */
export const COMPOSER_EDITABLE_TYPES: readonly FeedContentType[] = [
  "profile_post",
  "club_media",
  "media_profile",
];

export function isComposerEditableType(type: FeedContentType): boolean {
  return COMPOSER_EDITABLE_TYPES.includes(type);
}

export function composerHref({
  origin,
  identityId,
}: {
  origin: ComposerOrigin;
  identityId?: string | null;
}): string {
  const query = [`origin=${origin}`];
  if (identityId) {
    query.push(`identity=${encodeURIComponent(identityId)}`);
  }
  return `${COMPOSER_PATH}?${query.join("&")}`;
}

/** §143, §164: la modifica porta con sé la versione letta all'apertura del menu (§160). */
export function composerEditHref(params: ContentManageParams): string {
  const query = [
    `type=${params.content_type}`,
    `id=${encodeURIComponent(params.content_id)}`,
    `origin=${params.origin}`,
  ];
  if (params.current_version) {
    query.push(`version=${encodeURIComponent(params.current_version)}`);
  }
  return `${COMPOSER_EDIT_PATH}?${query.join("&")}`;
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : null;
}

export function parseComposerOrigin(value: string | string[] | undefined): ComposerOrigin | null {
  const raw = first(value);
  return COMPOSER_ORIGINS.find((origin) => origin === raw) ?? null;
}

export type ComposerCreateParams = {
  origin: ComposerOrigin;
  identityId: string | null;
};

export type ComposerEditParams = {
  contentType: FeedContentType;
  contentId: string;
  /** Può mancare: il server rifiuta l'edit senza versione (§161), il client la rilegge da `fetch_post_for_edit`. */
  version: string | null;
  /** Grezzo: passarlo a `parseContentOrigin` (vedi nota sui cicli). */
  origin: string | null;
};

/** Origin assente o sconosciuto → Home per te: il valore più neutro (§5 «origin aggiuntivi»). */
export function parseComposerCreateParams(params: SearchParams): ComposerCreateParams {
  return {
    identityId: first(params.identity),
    origin: parseComposerOrigin(params.origin) ?? "HOME_PER_TE",
  };
}

/** `null` se tipo o id mancano o il tipo non è un Post modificabile: lo schermo mostra «non disponibile». */
export function parseComposerEditParams(params: SearchParams): ComposerEditParams | null {
  const type = first(params.type);
  const id = first(params.id);
  const contentType = COMPOSER_EDITABLE_TYPES.find((candidate) => candidate === type);

  if (!contentType || !id) {
    return null;
  }

  return {
    contentId: id,
    contentType,
    origin: first(params.origin),
    version: first(params.version),
  };
}

export type ComposerReturnTarget =
  | { kind: "back"; fallbackHref: string }
  | { kind: "replace"; href: string };

/**
 * §122–127: da qualunque origin si torna alla superficie di partenza con
 * `router.back()`. `fallbackHref` si usa solo se `router.canGoBack()` è falso.
 * Nessun origin forza «Home → Per te» (§122).
 */
export function returnTargetForOrigin(origin: ComposerOrigin | ContentOrigin | null): ComposerReturnTarget {
  void origin;
  return { fallbackHref: COMPOSER_FALLBACK_HREF, kind: "back" };
}

/** L'origin del dettaglio contenuto (§129 «Visualizza») dato quello del composer. */
export function contentOriginForComposer(origin: ComposerOrigin): ContentOrigin | null {
  switch (origin) {
    case "HOME_PER_TE":
      return "HOME_PER_TE";
    case "HOME_SEGUITI":
      return "HOME_SEGUITI";
    case "PERSONAL_PROFILE":
    case "SOCIETY_PROFILE":
    case "MEDIA_PROFILE":
      return "PROFILE";
    case "CONTENT_DETAIL":
    // HOM-06.2: dalla lista Bozze o da una notifica il dettaglio si affida al Back (§127).
    case "DRAFTS":
    case "NOTIFICATION":
      return null;
  }
}
