/**
 * Query key di Moderation (HOM-11 §83, §126, §295).
 *
 * Le categorie dipendono dal target (§87) e non dall'utente. Lo stato «già
 * segnalato» invece è per viewer: la key porta il profilo, così un cambio account non
 * legge lo stato dell'altro (§174, §295).
 */

import type { ReportTarget, ReportTargetType } from "./moderation-types";

export const MODERATION_QK = {
  all: ["moderation"] as const,
  categories: (targetType: ReportTargetType) => ["moderation", "categories", targetType] as const,
  state: (viewerId: string, target: Pick<ReportTarget, "targetType" | "contentType" | "targetId">) =>
    ["moderation", "state", viewerId, target.targetType, target.contentType, target.targetId] as const,
};
