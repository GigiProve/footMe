/**
 * «Torna al feed» (HOM-04 §58–62, §126–127).
 *
 * Un solo fallback centrale invece di una CTA diversa per ogni superficie: con
 * uno stack valido si torna indietro, al Feed esistente con tab, scroll e
 * contenuti caricati (§59, §62); solo senza stack (deep link da fuori app,
 * §61) si costruisce la Home. Restituisce `undefined` quando la CTA non serve:
 * da Cerca, Profilo o chat il Back nativo riporta già dove si era (§123–125).
 */

import { useRouter } from "expo-router";

import { backToFeedMode, showBackToFeed } from "./content-availability-presentation";
import { HOME_HREF, type ContentOrigin } from "./content-routes";

export function useBackToFeed(origin: ContentOrigin | null): (() => void) | undefined {
  const router = useRouter();

  if (!showBackToFeed({ canGoBack: router.canGoBack(), origin })) {
    return undefined;
  }

  return () => {
    if (backToFeedMode(router.canGoBack()) === "back") {
      router.back();
    } else {
      router.replace(HOME_HREF as never);
    }
  };
}
