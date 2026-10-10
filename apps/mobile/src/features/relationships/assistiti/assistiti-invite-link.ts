/**
 * Link di invito, messaggio e canali di condivisione (REV-PROF-14).
 *
 * Un solo posto costruisce il link e un solo posto scrive il messaggio: il
 * template non va duplicato nelle schermate. Nel link entra soltanto il token —
 * niente nome, cognome, telefono, email, ruolo, squadra o id sequenziali — e
 * nessun canale invia nulla da solo: ogni funzione qui apre un'app o una share
 * sheet e lascia all'utente il gesto finale.
 */
import { Linking, Platform, Share } from "react-native";
import * as Clipboard from "expo-clipboard";

import { createPendingLinkStore } from "../../../lib/pending-deep-link";
import type { InviteChannel } from "./assistiti-model";

/**
 * Origine https del link. Quando è configurata, il link è un universal/app link
 * apribile anche da chi non ha l'app; altrimenti si ripiega sullo schema
 * custom, che funziona solo con l'app installata.
 */
const WEB_ORIGIN = process.env.EXPO_PUBLIC_INVITE_WEB_ORIGIN ?? "";

const APP_SCHEME_PREFIX = "footme://assistito-invite/";

export function buildAssistitoInviteUrl(token: string): string {
  if (WEB_ORIGIN) {
    return `${WEB_ORIGIN.replace(/\/+$/, "")}/assistito-invite/${token}`;
  }

  return `${APP_SCHEME_PREFIX}${token}`;
}

/**
 * Template localizzato dell'invito. Il nome del destinatario entra solo se il
 * procuratore lo ha già inserito a mano: non viene mai dedotto da altro.
 */
export function buildInviteMessage(input: {
  link: string;
  recipientName?: string | null;
}): string {
  const greeting = input.recipientName?.trim()
    ? `Ciao ${input.recipientName.trim()}`
    : "Ciao";

  return `${greeting}, ti invito a creare il tuo profilo su PROLINK e a collegarti al mio portfolio professionale: ${input.link}`;
}

export type ShareOutcome = "shared" | "dismissed" | "unavailable";

async function openUrlIfPossible(url: string): Promise<boolean> {
  try {
    if (!(await Linking.canOpenURL(url))) {
      return false;
    }

    await Linking.openURL(url);

    return true;
  } catch {
    return false;
  }
}

/**
 * WhatsApp: apre l'app con il testo già pronto e lascia all'utente la scelta
 * del destinatario. Se WhatsApp non c'è si ripiega sulla share sheet di
 * sistema, senza mai affermare che il messaggio sia partito.
 */
export async function shareViaWhatsApp(message: string): Promise<ShareOutcome> {
  const opened = await openUrlIfPossible(
    `whatsapp://send?text=${encodeURIComponent(message)}`,
  );

  if (opened) {
    return "shared";
  }

  return shareViaSystem(message);
}

/** SMS: apre il composer con il testo precompilato, quando supportato. */
export async function shareViaSms(message: string): Promise<ShareOutcome> {
  // iOS separa il corpo con `&`, Android con `?`. Il numero resta vuoto: il
  // destinatario lo sceglie l'utente e non viene mai letto né salvato.
  const separator = Platform.OS === "ios" ? "&" : "?";
  const opened = await openUrlIfPossible(
    `sms:${separator}body=${encodeURIComponent(message)}`,
  );

  if (opened) {
    return "shared";
  }

  return shareViaSystem(message);
}

/** Share sheet di sistema: email, Telegram e qualunque app installata. */
export async function shareViaSystem(message: string): Promise<ShareOutcome> {
  try {
    const result = await Share.share({ message });

    return result.action === Share.sharedAction ? "shared" : "dismissed";
  } catch {
    return "unavailable";
  }
}

export async function copyInviteLink(link: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(link);

    return true;
  } catch {
    return false;
  }
}

export const INVITE_CHANNELS: readonly {
  icon: "logo-whatsapp" | "chatbubble-ellipses-outline" | "link-outline" | "share-social-outline";
  label: string;
  value: InviteChannel;
}[] = [
  { icon: "logo-whatsapp", label: "WhatsApp", value: "whatsapp" },
  { icon: "chatbubble-ellipses-outline", label: "SMS", value: "sms" },
  { icon: "link-outline", label: "Copia link", value: "copy_link" },
  { icon: "share-social-outline", label: "Altri canali", value: "other" },
] as const;

/**
 * Token in attesa di autenticazione.
 *
 * Il link di invito può arrivare a chi non ha ancora un account: senza questo,
 * il redirect su login lo perderebbe per strada (è quello che succede oggi con
 * `app/invite/[token].tsx`). Il token resta locale al dispositivo e viene
 * consumato una volta sola, al primo ingresso utile.
 *
 * Da DAS-REV-11 il meccanismo vive in `lib/pending-deep-link.ts`: la Rete
 * societaria ha lo stesso bisogno e §19 chiede di riusare quello esistente,
 * non di scriverne un secondo. Qui restano la chiave e i nomi pubblici.
 */
const pendingAssistitoInvite = createPendingLinkStore(
  "@footme/pending-assistito-invite/v1",
);

export async function storePendingInviteToken(token: string): Promise<void> {
  await pendingAssistitoInvite.store(token);
}

export async function consumePendingInviteToken(): Promise<string | null> {
  return pendingAssistitoInvite.consume();
}

export async function clearPendingInviteToken(): Promise<void> {
  await pendingAssistitoInvite.clear();
}
