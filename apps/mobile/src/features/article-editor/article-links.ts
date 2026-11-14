/**
 * Apertura dei link esterni dell'Articolo (HOM-06.2 §7K, §59–§62, §67).
 *
 * Stesso pattern dell'app (`Linking.openURL(url).catch`, già in FeedPane e
 * ProfilePostDetail), con un solo cancello: l'URL deve passare da
 * `safeLinkUrl`, quindi si apre solo https. Un link non sicuro non fa nulla e
 * non solleva: il testo resta leggibile, semplicemente non è tappabile.
 */

import { Linking } from "react-native";

import { safeLinkUrl } from "./article-document";

/** `true` se il sistema ha preso in carico l'apertura. */
export async function openExternalUrl(raw: string | null | undefined): Promise<boolean> {
  const href = raw ? safeLinkUrl(raw) : null;
  if (!href) {
    return false;
  }
  try {
    await Linking.openURL(href);
    return true;
  } catch {
    return false;
  }
}
