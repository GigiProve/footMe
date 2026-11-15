/**
 * Eventi del Follow globale quando nascono dal menu di un contenuto o di un commento
 * (HOM-11 §187, §297). Mai mostrati all'utente.
 *
 * §187 chiede di riusare gli eventi Follow globali con `source = content_action_sheet`
 * e il contesto/origin. Nel repo non esisteva un evento Follow globale (solo
 * `follow_from_likes` della lista Mi piace, `profile_follow_tapped` del profilo): qui
 * nasce il set minimo, con `source` e `origin` come proprietà, così le altre superfici
 * Follow possono emettere gli stessi nomi con un altro `source`.
 *
 * Distinti per nome da «Non mi interessa» e da Segnala (§297). Nessun id né nome
 * della fonte: solo il tipo di fonte e da dove è partita l'azione.
 */

import { trackEvent, type AnalyticsProps } from "../../lib/analytics";
import type { ContentOrigin } from "../feed/content-routes";
import type { FollowSourceKind } from "./follow-source";

/** §187: dove è nata l'azione Follow. */
export type FollowEventSource = "content_action_sheet";

/** Il menu del contenuto o quello del commento (§70). */
export type FollowEventSurface = "content" | "comment";

type Base = {
  source: FollowEventSource;
  surface: FollowEventSurface;
  origin: ContentOrigin | null;
  sourceKind: FollowSourceKind;
};

export type FollowAnalyticsEvent =
  | ({ name: "follow_remove_selected" } & Base)
  | ({ name: "follow_remove_success" } & Base)
  | ({ name: "follow_remove_failure" } & Base)
  | ({ name: "follow_restore_success" } & Base)
  | ({ name: "follow_restore_failure" } & Base);

export function trackFollow(event: FollowAnalyticsEvent): void {
  const { name, ...rest } = event;
  trackEvent(name, rest as AnalyticsProps);
}
