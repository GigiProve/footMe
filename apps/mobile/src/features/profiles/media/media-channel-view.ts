/**
 * Canali ufficiali della realtà editoriale (REV-PROF-21, Screen 5).
 *
 * I canali supportati da REV-ONB-09 sono cinque — Instagram, TikTok, YouTube,
 * Facebook e sito web — e sono gli unici che questa sezione mostra. Email e
 * telefono non sono canali editoriali e non arrivano nemmeno nel payload.
 *
 * La validazione in lettura avviene qui, prima di renderizzare: un URL con
 * uno schema non sicuro non diventa una riga su cui si può premere.
 */
import type Ionicons from "@expo/vector-icons/Ionicons";

import { normalizeExternalUrl } from "./media-master-profile";
import type { MediaPublicChannel } from "./media-public-profile-service";

export type MediaChannelRow = {
  icon: keyof typeof Ionicons.glyphMap;
  key: string;
  label: string;
  url: string;
};

/**
 * Ordine di presentazione: il sito web apre la lista perché è il canale
 * proprietario della realtà, i social seguono nell'ordine dell'onboarding.
 */
const CHANNEL_ORDER: readonly string[] = [
  "website",
  "instagram",
  "youtube",
  "tiktok",
  "facebook",
  "x",
  "twitter",
  "newsletter",
  "podcast",
  "other",
];

const CHANNEL_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  newsletter: "Newsletter",
  other: "Altro canale",
  podcast: "Podcast",
  tiktok: "TikTok",
  twitter: "X",
  website: "Sito web",
  x: "X",
  youtube: "YouTube",
};

const CHANNEL_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  facebook: "logo-facebook",
  instagram: "logo-instagram",
  newsletter: "mail-outline",
  other: "link-outline",
  podcast: "mic-outline",
  tiktok: "logo-tiktok",
  twitter: "logo-twitter",
  website: "globe-outline",
  x: "logo-twitter",
  youtube: "logo-youtube",
};

/**
 * Righe da mostrare: solo canali presenti, validi, pubblici e supportati.
 * L'URL completo non compare — ridurrebbe la leggibilità senza aggiungere
 * nulla — ma il nome accessibile dice dove porta il link.
 */
export function buildMediaChannelRows(
  channels: readonly MediaPublicChannel[],
): MediaChannelRow[] {
  const rows: MediaChannelRow[] = [];
  const seen = new Set<string>();

  for (const channel of channels) {
    const type = channel.channelType.trim().toLowerCase();
    const url = normalizeExternalUrl(channel.url);

    if (!url || seen.has(type) || !CHANNEL_LABELS[type]) {
      continue;
    }

    seen.add(type);
    rows.push({
      icon: CHANNEL_ICONS[type] ?? "link-outline",
      key: type,
      // L'etichetta curata dalla realtà vince sul nome del canale: "La
      // newsletter del lunedì" dice più di "Newsletter".
      label: channel.label?.trim() || CHANNEL_LABELS[type],
      url,
    });
  }

  return rows.sort(
    (left, right) => channelRank(left.key) - channelRank(right.key),
  );
}

function channelRank(key: string): number {
  const index = CHANNEL_ORDER.indexOf(key);

  return index === -1 ? CHANNEL_ORDER.length : index;
}
