/**
 * Eventi tecnici della Home (§25). Non sono MAI mostrati all'utente.
 *
 * La union tipizzata è il punto: aggiungere un evento senza dichiararlo qui non
 * compila, e il test associato verifica la corrispondenza 1:1 con l'elenco del
 * §25. Nessun evento per Mi piace / Commenta / Condividi: quelle azioni sono
 * solo visive in questo blocco e il §25 non le elenca.
 *
 * `feed_save_tap` e `feed_item_menu_open` vanno oltre il minimo del §25: il
 * segnalibro è l'unica azione realmente funzionante sulle card e il menu ⋯ è
 * l'unico punto d'accesso alle azioni future, quindi misurarli da subito costa
 * nulla e dice qualcosa.
 */

import { trackEvent, type AnalyticsProps } from "../../lib/analytics";
import type { FeedItemType, FeedScope } from "./feed-types";

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
  | { name: "feed_item_menu_open"; itemType: FeedItemType };

export function trackFeed(event: FeedAnalyticsEvent): void {
  const { name, ...rest } = event;
  trackEvent(name, rest as AnalyticsProps);
}
