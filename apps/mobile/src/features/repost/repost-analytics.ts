/**
 * Eventi di prodotto del Repost (HOM-10 §269–§272). Non sono mai mostrati
 * all'utente.
 *
 * La union tipizzata è il punto: aggiungere un evento senza dichiararlo qui non
 * compila, e il test verifica la corrispondenza 1:1 con l'elenco del §269 (stesso
 * schema di `share-analytics.ts`).
 *
 * PRIVACY (§270): mai il testo del body, mai l'URL completo (al massimo il dominio),
 * mai il contenuto di una bozza, mai il testo di una mention privata. Le proprietà
 * sono id e tipo del contenuto già pubblicato, tipo d'identità, conteggi ed esiti.
 *
 * I DUE esiti tecnici sono distinti nei nomi (§271): `simple_repost_*` per la
 * redistribuzione, `referenced_post_*` per il nuovo Post con testo. Il contatore
 * Repost di HOM-05 non nasce da questi eventi ma dal server (§272).
 */

import { trackEvent, type AnalyticsProps } from "../../lib/analytics";
import type { FeedContentType, FeedIdentityType } from "../feed/feed-types";
import type { ComposerOrigin } from "../post-composer/composer-types";
import type { ShareOrigin } from "../share/share-types";

export const REPOST_ANALYTICS_EVENT_NAMES = [
  "repost_entry_selected",
  "repost_composer_open",
  "repost_identity_changed",
  "simple_repost_attempt",
  "simple_repost_success",
  "simple_repost_failure",
  "simple_repost_removed",
  "repost_text_started",
  "repost_mention_added",
  "repost_link_added",
  "referenced_post_publish_attempt",
  "referenced_post_publish_success",
  "referenced_post_publish_failure",
  "repost_draft_created",
  "referenced_post_scheduled",
  "referenced_content_opened",
  "aggregated_simple_repost_rendered",
] as const;

type TargetProps = {
  contentId: string;
  contentType: FeedContentType;
};

type IdentityProps = {
  identityType: FeedIdentityType | null;
};

/** Da dove si apre il contenuto incorporato (§111, §60). */
export type ReferenceSurface = "feed" | "detail" | "composer";

export type RepostAnalyticsEvent =
  | ({ name: "repost_entry_selected"; origin: ShareOrigin; alreadyReposted: boolean } & TargetProps)
  | ({ name: "repost_composer_open"; origin: ComposerOrigin; source: "entry" | "draft" } & TargetProps & IdentityProps)
  | { name: "repost_identity_changed"; from: FeedIdentityType; to: FeedIdentityType }
  | ({ name: "simple_repost_attempt" } & TargetProps & IdentityProps)
  | ({ name: "simple_repost_success"; replayed: boolean } & TargetProps & IdentityProps)
  | ({ name: "simple_repost_failure"; reason: "unavailable" | "forbidden" | "error" } & TargetProps & IdentityProps)
  | ({ name: "simple_repost_removed" } & TargetProps & IdentityProps)
  // Solo il momento in cui il body diventa significativo, mai il testo (§138, §270).
  | ({ name: "repost_text_started" } & TargetProps & IdentityProps)
  | { name: "repost_mention_added"; targetType: "profile" | "club" }
  // Del link si conserva solo il dominio (§270).
  | { name: "repost_link_added"; domain: string }
  | ({ name: "referenced_post_publish_attempt"; hasLink: boolean; mentionCount: number; scheduled: boolean } & TargetProps & IdentityProps)
  | ({ name: "referenced_post_publish_success"; replayed: boolean; postContentType: FeedContentType } & TargetProps & IdentityProps)
  | ({ name: "referenced_post_publish_failure"; code: string } & TargetProps & IdentityProps)
  | ({ name: "repost_draft_created" } & TargetProps & IdentityProps)
  | ({ name: "referenced_post_scheduled" } & TargetProps & IdentityProps)
  | ({ name: "referenced_content_opened"; surface: ReferenceSurface } & TargetProps)
  | ({ name: "aggregated_simple_repost_rendered"; additionalCount: number } & TargetProps);

export function trackRepost(event: RepostAnalyticsEvent): void {
  const { name, ...rest } = event;
  trackEvent(name, rest as AnalyticsProps);
}
