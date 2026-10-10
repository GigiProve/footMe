/**
 * Link, messaggio e condivisione dell'invito di collegamento (§17).
 *
 * «Usare il dominio e il sistema app/universal link reali del prodotto, con
 * fallback browser. Non inserire URL dimostrativi nel codice di produzione.»
 * Il prodotto ne ha uno solo — `EXPO_PUBLIC_INVITE_WEB_ORIGIN` più lo schema
 * `footme://` — ed è quello usato dagli inviti procuratore→assistito: questo
 * file riusa la stessa origine, cambiando soltanto il percorso.
 *
 * Nel link entra soltanto il token: §17 vieta di includere nell'URL «dati
 * privati, privilegi amministrativi o informazioni di autenticazione
 * dell'actor».
 *
 * Nessuna interfaccia WhatsApp proprietaria (§16): la condivisione è la
 * share sheet di sistema e nient'altro.
 */
import { Share } from "react-native";

import { createPendingLinkStore } from "../../lib/pending-deep-link";

const WEB_ORIGIN = process.env.EXPO_PUBLIC_INVITE_WEB_ORIGIN ?? "";

const APP_SCHEME_PREFIX = "footme://society-invite/";

export function buildSocietyInviteUrl(token: string): string {
  if (WEB_ORIGIN) {
    return `${WEB_ORIGIN.replace(/\/+$/, "")}/society-invite/${token}`;
  }

  return `${APP_SCHEME_PREFIX}${token}`;
}

/**
 * Messaggio dell'invito.
 *
 * Il nome descrittivo entra solo se il mittente lo ha scritto: §16 dice che
 * non è «una prova dell'identità del futuro destinatario», quindi non viene
 * mai dedotto da altro.
 */
export function buildSocietyInviteMessage(input: {
  descriptiveName?: string | null;
  inviterName: string;
  link: string;
}): string {
  const greeting = input.descriptiveName?.trim()
    ? `Ciao ${input.descriptiveName.trim()}`
    : "Ciao";

  return `${greeting}, ${input.inviterName} vuole collegare la tua società alla propria rete su PROLINK: ${input.link}`;
}

export type ShareOutcome = "shared" | "dismissed" | "unavailable";

/**
 * §17: «Aprire o annullare lo share sheet non dimostra che un invito sia
 * stato consegnato. Tracciare solo eventi tecnicamente osservabili.» Il
 * valore restituito dice cosa è successo alla **sheet**, non al messaggio.
 */
export async function shareSocietyInvite(message: string): Promise<ShareOutcome> {
  try {
    const result = await Share.share({ message });

    return result.action === Share.sharedAction ? "shared" : "dismissed";
  } catch {
    return "unavailable";
  }
}

/**
 * Invito aperto prima dell'autenticazione (§19).
 *
 * Il token messo da parte non è una prova di nulla: dopo il login viene
 * risolto di nuovo dal server, che rivaluta invito, destinatario e
 * autorizzazioni. Serve solo a non perdere il percorso.
 */
export const pendingSocietyInvite = createPendingLinkStore(
  "@footme/pending-society-invite/v1",
);
