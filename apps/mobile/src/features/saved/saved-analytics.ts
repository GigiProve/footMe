/**
 * Eventi di prodotto dei Salvati (HOM-07 §189, parte Salvati).
 *
 * Union tipizzata come `publishing-analytics.ts`: un evento non dichiarato non
 * compila. I dieci nomi sono quelli del §189; i Mi piace stanno nel modulo
 * dei Mi piace.
 *
 * PRIVACY (§190): solo tipo di target, content type, superficie, categoria ed
 * esito. Mai titolo, testo, nome, id del contenuto o dell'autore: il salvataggio
 * è privato (§70) e non dice nulla di ciò che l'utente ha salvato.
 */

import { trackEvent, type AnalyticsProps } from "../../lib/analytics";
import type { SavedCategory, SavedTarget } from "./saved-types";

export const SAVED_ANALYTICS_EVENT_NAMES = [
  "save_attempt",
  "save_success",
  "unsave_attempt",
  "unsave_success",
  "save_failure",
  "saved_center_open",
  "saved_category_changed",
  "saved_target_open",
  "saved_target_removed",
  "saved_remove_undo",
] as const;

/** Da dove parte l'azione: serve a leggere i funnel, non dice nulla del contenuto. */
export type SavedSurface =
  | "feed"
  | "content_detail"
  | "search"
  | "profile"
  | "position"
  | "dashboard"
  | "saved_center";

type TargetProps = {
  targetType: SavedTarget["type"];
  /** Solo per i contenuti. */
  contentType: string | null;
  surface: SavedSurface;
};

export type SavedAnalyticsEvent =
  | ({ name: "save_attempt" } & TargetProps)
  | ({ name: "save_success" } & TargetProps)
  | ({ name: "unsave_attempt" } & TargetProps)
  | ({ name: "unsave_success" } & TargetProps)
  | ({ name: "save_failure" } & TargetProps & { action: "save" | "unsave" })
  | { name: "saved_center_open"; category: SavedCategory }
  | { name: "saved_category_changed"; from: SavedCategory; to: SavedCategory }
  | { name: "saved_target_open"; category: SavedCategory; targetType: SavedTarget["type"] }
  | { name: "saved_target_removed"; category: SavedCategory; targetType: SavedTarget["type"] }
  | { name: "saved_remove_undo"; category: SavedCategory; targetType: SavedTarget["type"] };

export function trackSaved(event: SavedAnalyticsEvent): void {
  const { name, ...rest } = event;
  trackEvent(name, rest as AnalyticsProps);
}

export function targetProps(target: SavedTarget, surface: SavedSurface): TargetProps {
  return {
    contentType: target.type === "content" ? target.contentType : null,
    surface,
    targetType: target.type,
  };
}
