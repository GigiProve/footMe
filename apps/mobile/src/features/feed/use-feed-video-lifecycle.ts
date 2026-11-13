/**
 * HOM-03 §77–80: quando il Feed (o un dettaglio) smette di essere in primo
 * piano, il video corrente va in pausa e NON riprende al ritorno (§20).
 *
 * File separato da use-feed-video.tsx di proposito: questo è l'unico pezzo che
 * dipende da expo-router. Le thumbnail e il player importano solo lo slot, e
 * così restano montabili nei test senza il router.
 */

import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";

import type { FeedVideoController } from "./feed-video-controller";

/**
 * In FeedScreen: AppState non attivo → pause("background") (§77, §80);
 * blur della route → pause("blur") (§79). Nessuna ripresa al ritorno (§20).
 */
export function useFeedVideoLifecycle(controller: FeedVideoController): void {
  useEffect(() => {
    // `inactive` copre anche le interruzioni di sistema su iOS (chiamata,
    // centro di controllo): §80 vuole la pausa, non la ripresa forzata.
    const subscription = AppState?.addEventListener?.("change", (state) => {
      if (state !== "active") {
        controller.pause("background");
      }
    });
    return () => {
      subscription?.remove();
      controller.pause("blur");
    };
  }, [controller]);

  // useFocusEffect riesegue l'effetto a ogni nuova identità della callback: senza
  // useCallback la pulizia ("blur") scatterebbe a ogni render del Feed.
  useFocusEffect(
    useCallback(() => () => controller.pause("blur"), [controller]),
  );
}
