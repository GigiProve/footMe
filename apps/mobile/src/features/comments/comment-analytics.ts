/**
 * Eventi di prodotto dei Commenti (HOM-08 §258–§259). Mai mostrati all'utente.
 *
 * I ventiquattro eventi del §258, uno a uno. §259: solo id, tipi e conteggi —
 * MAI il testo del commento o della risposta, l'URL completo, il testo di una
 * mention, il contenuto del composer. Le props sono tipizzate per nome evento, così
 * un campo di testo non ci entra per distrazione. Lo stesso `trackEvent` del resto
 * dell'app: nessun nuovo sink. §216: HOM-05 riceve solo aggregati dal server, il
 * client non gli manda liste né testi.
 *
 * `comment_like_added/removed` e `comment_likes_list_open` sono eventi propri dei
 * commenti (§258), distinti da `like_add_success` / `likes_list_open` del Mi piace
 * sul contenuto: il motore del Like emette anche i suoi (con `contentType:"comment"`).
 * §260: l'apertura di Segnala appartiene a HOM-11 e non è qui.
 */

import { trackEvent, type AnalyticsProps } from "../../lib/analytics";
import type { CommentIdentityType, CommentSort } from "./comment-types";

type ContentBase = { contentType: string; contentId: string };
type CommentBase = ContentBase & { commentId: string };

/** Perché un invio non è riuscito, senza testo d'errore. */
export type CommentFailureReason =
  | "unavailable"
  | "target_unavailable"
  | "permission"
  | "disabled"
  | "invalid"
  | "network";

export type CommentAnalyticsEvent =
  | ({ name: "comments_open"; commentsCount: number; origin: string | null } & ContentBase)
  | ({ name: "comments_open_with_composer"; origin: string | null } & ContentBase)
  | ({ name: "comments_sort_changed"; sort: CommentSort } & ContentBase)
  | ({
      name: "comment_composer_open";
      identityType: CommentIdentityType | null;
      origin: string | null;
    } & ContentBase)
  | ({
      name: "comment_identity_changed";
      from: CommentIdentityType;
      to: CommentIdentityType;
    } & ContentBase)
  | ({
      name: "comment_publish_attempt";
      identityType: CommentIdentityType;
      mentionCount: number;
      linkCount: number;
    } & ContentBase)
  | ({
      name: "comment_publish_success";
      identityType: CommentIdentityType;
      mentionCount: number;
      linkCount: number;
    } & ContentBase)
  | ({
      name: "comment_publish_failure";
      identityType: CommentIdentityType | null;
      reason: CommentFailureReason;
    } & ContentBase)
  | ({ name: "comment_retry"; identityType: CommentIdentityType } & ContentBase)
  | ({ name: "reply_selected"; targetType: CommentIdentityType | null } & CommentBase)
  | ({ name: "reply_publish_attempt"; identityType: CommentIdentityType } & CommentBase)
  | ({ name: "reply_publish_success"; identityType: CommentIdentityType } & CommentBase)
  | ({ name: "mention_added"; targetType: "profile" | "club" } & ContentBase)
  | ({ name: "comment_link_added"; linkCount: number } & ContentBase)
  | ({ name: "comment_like_added"; identityType: CommentIdentityType | null } & CommentBase)
  | ({ name: "comment_like_removed"; identityType: CommentIdentityType | null } & CommentBase)
  | ({ name: "comment_likes_list_open"; likesCount: number } & CommentBase)
  | ({ name: "replies_expanded"; repliesCount: number } & CommentBase)
  | ({ name: "more_replies_loaded"; loaded: number } & CommentBase)
  | ({ name: "comment_edit_open" } & CommentBase)
  | ({ name: "comment_edit_success"; mentionCount: number; linkCount: number } & CommentBase)
  | ({ name: "comment_delete_attempt" } & CommentBase)
  | ({ name: "comment_delete_success"; outcome: "removed" | "tombstoned" } & CommentBase)
  | ({
      name: "author_profile_open_from_comment";
      authorType: CommentIdentityType;
      via: "avatar" | "name" | "mention";
    } & CommentBase);

/** Gli eventi del §258, nell'ordine della specifica (il test li confronta uno a uno). */
export const COMMENT_ANALYTICS_EVENT_NAMES = [
  "comments_open",
  "comments_open_with_composer",
  "comments_sort_changed",
  "comment_composer_open",
  "comment_identity_changed",
  "comment_publish_attempt",
  "comment_publish_success",
  "comment_publish_failure",
  "comment_retry",
  "reply_selected",
  "reply_publish_attempt",
  "reply_publish_success",
  "mention_added",
  "comment_link_added",
  "comment_like_added",
  "comment_like_removed",
  "comment_likes_list_open",
  "replies_expanded",
  "more_replies_loaded",
  "comment_edit_open",
  "comment_edit_success",
  "comment_delete_attempt",
  "comment_delete_success",
  "author_profile_open_from_comment",
] as const satisfies readonly CommentAnalyticsEvent["name"][];

export function trackComment(event: CommentAnalyticsEvent): void {
  const { name, ...rest } = event;
  trackEvent(name, rest as AnalyticsProps);
}
