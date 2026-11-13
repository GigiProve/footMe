/**
 * Eventi tecnici della Home (§25). Non sono MAI mostrati all'utente.
 *
 * La union tipizzata è il punto: aggiungere un evento senza dichiararlo qui non
 * compila, e il test associato verifica la corrispondenza 1:1 con l'elenco del
 * §25. Da HOM-02 §89 ci sono anche gli eventi del Post
 * (autore, testo, mention, tag, media, Mi piace, Commenta, Condividi, link).
 *
 * `feed_save_tap` e `feed_item_menu_open` vanno oltre il minimo del §25: il
 * segnalibro è l'unica azione realmente funzionante sulle card e il menu ⋯ è
 * l'unico punto d'accesso alle azioni future, quindi misurarli da subito costa
 * nulla e dice qualcosa.
 *
 * HOM-03 §99–102 aggiunge gli eventi del player e dell'Articolo.
 */

import { trackEvent, type AnalyticsProps } from "../../lib/analytics";
import type { ContentOrigin } from "./content-routes";
import type { FeedContentType, FeedIdentityType, FeedItemType, FeedScope } from "./feed-types";

export type FeedAnalyticsEvent =
  | { name: "home_open" }
  | { name: "feed_tab_open"; scope: FeedScope }
  | {
      name: "feed_item_impression";
      scope: FeedScope;
      itemType: FeedItemType;
      itemId: string;
      position: number;
    }
  | {
      name: "feed_content_open";
      scope: FeedScope;
      itemType: FeedItemType;
      itemId: string;
    }
  | { name: "feed_position_open"; scope: FeedScope; positionId: string }
  | { name: "feed_suggested_profile_open"; scope: FeedScope; profileId: string }
  | {
      name: "feed_follow_tap";
      scope: FeedScope;
      targetType: "profile" | "club";
      targetId: string;
    }
  | { name: "feed_personalize_tap"; options: string }
  | { name: "feed_personalize_dismiss"; reason: "later" | "completed" }
  | { name: "feed_refresh"; scope: FeedScope; trigger: "pull" | "new_content_banner" }
  | { name: "feed_page_load"; scope: FeedScope; page: number }
  | { name: "feed_empty_state_shown"; scope: FeedScope; reason: "no_follows" | "no_content" }
  | { name: "feed_discover_profiles_tap"; scope: FeedScope }
  | { name: "feed_save_tap"; itemId: string; saved: boolean }
  | { name: "feed_item_menu_open"; itemType: FeedItemType }
  // HOM-01.1 §69: il prompt di primo accesso. Nessuna proprietà: non serve
  // altro per contare impression, aperture e rinvii.
  | { name: "home_personalization_prompt_impression" }
  | { name: "home_personalization_opened" }
  | { name: "home_personalization_skipped" }
  // HOM-01.1 §70: la pill "Nuovi contenuti". La disponibilità NON è
  // un'impression degli elementi: quelle restano `feed_item_impression`,
  // registrate solo quando gli elementi sono davvero a schermo.
  | { name: "feed_new_content_available"; scope: FeedScope; count: number }
  | { name: "feed_new_content_tap"; scope: FeedScope }
  // HOM-02 §89: eventi minimi del Post. L’impression resta
  // `feed_item_impression` (§90: montare il componente non è un’impression), il
  // menu resta `feed_item_menu_open`. La logica completa di Like, commenti e
  // condivisione si consolida in HOM-07/08/09.
  | { name: "feed_post_author_open"; itemId: string; identityType: FeedIdentityType }
  | { name: "feed_post_text_expand"; itemId: string }
  | { name: "feed_post_text_collapse"; itemId: string }
  | { name: "feed_post_mention_open"; itemId: string; identityType: "profile" | "club" }
  | { name: "feed_post_tagged_list_open"; itemId: string; count: number }
  | { name: "feed_post_media_open"; itemId: string; index: number; mediaType: "image" | "video" }
  | { name: "feed_post_gallery_open"; itemId: string; count: number }
  | { name: "feed_post_video_select"; itemId: string; index: number }
  | { name: "feed_post_like_tap"; itemId: string; liked: boolean }
  | { name: "feed_post_comment_tap"; itemId: string }
  | { name: "feed_post_share_tap"; itemId: string }
  | { name: "feed_post_link_preview_open"; itemId: string; domain: string }
  // HOM-03 §99–102: la thumbnail a schermo NON è un play (§99). Play, quartili,
  // completamento e tempo di visione sono eventi grezzi per HOME-05: nessuna
  // statistica calcolata qui (§101). Vedi feed-video-analytics.ts.
  | { name: "feed_video_play"; itemId: string; mediaId: string; surface: FeedVideoSurface }
  | { name: "feed_video_progress"; itemId: string; mediaId: string; percent: 25 | 50 | 75 }
  | { name: "feed_video_complete"; itemId: string; mediaId: string }
  | { name: "feed_video_watch"; itemId: string; mediaId: string; seconds: number }
  | { name: "feed_video_mute"; itemId: string; muted: boolean }
  | { name: "feed_video_fullscreen"; itemId: string }
  | { name: "feed_video_error"; itemId: string; mediaId: string }
  | { name: "feed_video_retry"; itemId: string; mediaId: string }
  | { name: "feed_article_impression"; itemId: string }
  | { name: "feed_article_open"; itemId: string; origin: FeedOpenOrigin; position: number }
  // HOM-04 §134–135: gestione del contenuto. Solo id, tipo, tipo identità
  // autrice e provenienza: mai il testo del Post.
  | ({ name: "content_menu_open" } & ContentAnalyticsProps)
  | ({ name: "edit_selected" } & ContentAnalyticsProps)
  | ({ name: "insights_selected" } & ContentAnalyticsProps)
  | ({ name: "delete_selected" } & ContentAnalyticsProps)
  | ({ name: "delete_cancelled" } & ContentAnalyticsProps)
  | ({ name: "delete_confirmed" } & ContentAnalyticsProps)
  | ({ name: "delete_success" } & ContentAnalyticsProps)
  | ({ name: "delete_failed" } & ContentAnalyticsProps);

/** HOM-04 §135: le sole proprietà ammesse sugli eventi di gestione. */
export type ContentAnalyticsProps = {
  contentId: string;
  contentType: FeedContentType;
  authorIdentityType: FeedIdentityType;
  origin: ContentOrigin | null;
};

/** Dove gira il player: il Feed o il dettaglio del contenuto. */
export type FeedVideoSurface = "feed" | "detail";

/** §49: da dove arriva l'apertura di un Articolo. Oggi solo il Feed. */
export type FeedOpenOrigin = "feed";

export function trackFeed(event: FeedAnalyticsEvent): void {
  const { name, ...rest } = event;
  trackEvent(name, rest as AnalyticsProps);
}
