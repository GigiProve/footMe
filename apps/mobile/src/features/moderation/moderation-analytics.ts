/**
 * Eventi di prodotto di Segnala (HOM-11 §188–§191, §297–§298). Mai mostrati all'utente.
 *
 * Gli otto eventi del §188, uno a uno. §189: MAI il testo libero della segnalazione —
 * le props sono tipizzate per nome evento, e `hasDetails` è un booleano, non un testo,
 * così un campo di testo non ci entra per distrazione. §190: l'id interno della
 * categoria (non sensibile) sì. §191: nessun evento lega l'identità del reporter
 * all'autore: il reporting resta privato.
 *
 * Distinti per nome dagli eventi di «Non mi interessa» e di Follow (§297): le tre
 * famiglie non si confondono.
 */

import { trackEvent, type AnalyticsProps } from "../../lib/analytics";
import type { ContentOrigin } from "../feed/content-routes";
import type { ReportTargetType } from "./moderation-types";

type Base = {
  targetType: ReportTargetType;
  contentType: string;
  origin: ContentOrigin | null;
};

export type ReportFailureReason = "network" | "invalid_category" | "not_allowed";

export type ReportAnalyticsEvent =
  | ({ name: "report_flow_open" } & Base)
  | ({ name: "report_category_selected"; categoryId: string } & Base)
  | ({ name: "report_subcategory_selected"; categoryId: string; subcategoryId: string } & Base)
  | ({
      name: "report_submit_attempt";
      categoryId: string;
      subcategoryId: string | null;
      hasDetails: boolean;
      isRetry: boolean;
    } & Base)
  | ({ name: "report_submit_success"; categoryId: string } & Base)
  | ({ name: "report_submit_failure"; categoryId: string; reason: ReportFailureReason } & Base)
  | ({ name: "report_duplicate_detected"; via: "state" | "submit" } & Base)
  | ({ name: "report_comment_open" } & Base);

/** Gli eventi del §188, nell'ordine della specifica (il test li confronta uno a uno). */
export const REPORT_ANALYTICS_EVENT_NAMES = [
  "report_flow_open",
  "report_category_selected",
  "report_subcategory_selected",
  "report_submit_attempt",
  "report_submit_success",
  "report_submit_failure",
  "report_duplicate_detected",
  "report_comment_open",
] as const satisfies readonly ReportAnalyticsEvent["name"][];

export function trackReport(event: ReportAnalyticsEvent): void {
  const { name, ...rest } = event;
  trackEvent(name, rest as AnalyticsProps);
}
