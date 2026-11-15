/**
 * La destinazione del flow Segnala (HOM-11 §79, §116–§119, D7): una route a schermo
 * intero fuori dalle tab, `/report/[targetType]/[id]`, come Dettagli e statistiche
 * (HOM-05): niente bottom navigation, niente chrome Home.
 *
 * Una sola definizione per destinazione: il menu del contenuto, il menu del commento e
 * la route la leggono da qui. Il segmento `targetType` è minuscolo (`content`,
 * `comment`) per l'URL; il dominio usa `CONTENT` / `COMMENT`.
 *
 * Query: `contentType` (tipo del contenuto; per un commento, del padre), `contentId`
 * (solo commento: id del contenuto padre), `origin` (da dove si è partiti, §118). «Fine»
 * torna indietro nello stack, quindi all'origin con tab, scroll e thread (§116–§119).
 */

import { asFeedContentType } from "../feed/feed-post-mapper";
import { parseContentOrigin } from "../feed/content-routes";
import type { ReportTarget, ReportTargetType } from "./moderation-types";

const SEGMENT_BY_TYPE: Record<ReportTargetType, string> = {
  COMMENT: "comment",
  CONTENT: "content",
};

export function reportHref(target: ReportTarget): string {
  const query: string[] = [`contentType=${encodeURIComponent(target.contentType)}`];
  if (target.parentContentId) {
    query.push(`contentId=${encodeURIComponent(target.parentContentId)}`);
  }
  if (target.origin) {
    query.push(`origin=${target.origin}`);
  }

  return `/report/${SEGMENT_BY_TYPE[target.targetType]}/${encodeURIComponent(target.targetId)}?${query.join("&")}`;
}

/** Il segmento della route, o `null` se sconosciuto. */
export function parseReportTargetType(value: string | string[] | undefined): ReportTargetType | null {
  const raw = (Array.isArray(value) ? value[0] : value)?.toLowerCase();
  if (raw === "content") {
    return "CONTENT";
  }
  return raw === "comment" ? "COMMENT" : null;
}

type RouteParam = string | string[] | undefined;

function firstOf(value: RouteParam): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : null;
}

/**
 * I parametri della route → il bersaglio, o `null` se non valido (il flow mostra «non
 * più disponibile» invece di chiedere una categoria per un target che non esiste).
 * Un CONTENT deve avere un tipo contenuto noto; un COMMENT il tipo del padre.
 */
export function parseReportTarget(params: {
  targetType: RouteParam;
  id: RouteParam;
  contentType: RouteParam;
  contentId: RouteParam;
  origin: RouteParam;
}): ReportTarget | null {
  const targetType = parseReportTargetType(params.targetType);
  const targetId = firstOf(params.id);
  const contentType = firstOf(params.contentType);

  if (!targetType || !targetId || !contentType) {
    return null;
  }
  if (targetType === "CONTENT" && !asFeedContentType(contentType)) {
    return null;
  }

  return {
    contentType,
    origin: parseContentOrigin(params.origin),
    parentContentId: targetType === "COMMENT" ? firstOf(params.contentId) : null,
    targetId,
    targetType,
  };
}
