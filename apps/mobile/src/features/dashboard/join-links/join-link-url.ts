/**
 * URL, condivisione e ripresa del link di squadra (§18, §20).
 *
 * «Riusare i meccanismi di app link/deep link e i domini reali configurati.»
 * Il prodotto ne ha uno solo — `EXPO_PUBLIC_INVITE_WEB_ORIGIN` più lo schema
 * `footme://` — già usato dagli inviti amministrativi, dalla Rete societaria
 * e dagli inviti procuratore→assistito: qui cambia soltanto il percorso.
 *
 * Nel link entra **solo** il token (§43): niente nome della Società, id
 * della squadra o categorie come parametri autorevoli. Chi apre il link
 * riceve il contesto dal resolver, non dalla query string.
 */
import { Share } from "react-native";
import * as Clipboard from "expo-clipboard";

import { createPendingLinkStore } from "../../../lib/pending-deep-link";

const WEB_ORIGIN = process.env.EXPO_PUBLIC_INVITE_WEB_ORIGIN ?? "";

const APP_SCHEME_PREFIX = "footme://team-invite/";

export function buildTeamJoinUrl(token: string): string {
  if (WEB_ORIGIN) {
    return `${WEB_ORIGIN.replace(/\/+$/, "")}/team-invite/${token}`;
  }

  return `${APP_SCHEME_PREFIX}${token}`;
}

export type ShareOutcome = "shared" | "dismissed" | "unavailable";

/**
 * §18: «La condivisione apre il native share sheet iOS/Android … Non
 * implementare pulsanti proprietari di invio WhatsApp, Telegram, email o
 * SMS dentro questo flow.»
 *
 * Il valore restituito descrive la **sheet**, non la consegna: §18 vieta di
 * dichiarare inviato un invito solo perché il foglio di sistema si è aperto.
 */
export async function shareTeamJoinLink(
  message: string,
): Promise<ShareOutcome> {
  try {
    const result = await Share.share({ message });

    return result.action === Share.sharedAction ? "shared" : "dismissed";
  } catch {
    return "unavailable";
  }
}

/** Fallback standard quando il native share non è disponibile (§18). */
export async function copyTeamJoinLink(link: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(link);

    return true;
  } catch {
    return false;
  }
}

/**
 * Link aperto prima dell'autenticazione (§20).
 *
 * «Conserva un riferimento sicuro al link attraverso landing, login, signup,
 * onboarding e conferma. Non ricostruirlo confrontando AC Como + Prima
 * squadra.»
 *
 * Il token messo da parte non prova nulla: al ritorno la configurazione
 * canonica viene risolta di nuovo dal backend. Serve soltanto a non perdere
 * il percorso.
 */
export const pendingTeamJoin = createPendingLinkStore(
  "@footme/pending-team-join/v1",
);
