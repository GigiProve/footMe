/**
 * URL pubblico, condivisione e ritorno all'evento (DAS-REV-29 §9, §12).
 *
 * «Usa lo stesso URL HTTPS canonico per iOS, Android e browser … Non
 * hardcodare un provider nuovo se esiste già una soluzione.» Il prodotto ne
 * ha una sola, già usata da inviti amministrativi, link di squadra, Rete e
 * assistiti: `EXPO_PUBLIC_INVITE_WEB_ORIGIN` più lo schema `footme://`. Qui
 * cambia solo il percorso, `/event/<public_id>`.
 *
 * Nel link entra **solo** l'identificatore pubblico (§9): niente titolo,
 * partecipanti, ruoli, token o grant. Il contenuto lo risolve il server.
 */
import { Share } from "react-native";
import * as Clipboard from "expo-clipboard";

import { createPendingLinkStore } from "../../../../lib/pending-deep-link";

const WEB_ORIGIN = process.env.EXPO_PUBLIC_INVITE_WEB_ORIGIN ?? "";
const APP_SCHEME_PREFIX = "footme://event/";

/** §12: allowlist dell'identificatore, la stessa del server. */
export function isValidPublicId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(value);
}

/**
 * URL canonico dell'evento. Senza origine web configurata si ricade sullo
 * schema dell'app, come gli altri link del prodotto: mai un dominio
 * inventato (§12).
 */
export function buildEventUrl(publicId: string, origin: string = WEB_ORIGIN): string {
  return origin
    ? `${origin.replace(/\/+$/, "")}/event/${publicId}`
    : `${APP_SCHEME_PREFIX}${publicId}`;
}

export type ShareOutcome = "shared" | "dismissed" | "unavailable";

/**
 * §9: share sheet nativa con titolo, Società e URL. Nessun selector di social
 * network. Il risultato descrive la **sheet**, non la consegna: chiuderla non
 * produce un successo falso (QA-034).
 */
export async function shareEventLink(input: {
  message: string;
  title: string;
  url: string;
}): Promise<ShareOutcome> {
  try {
    const result = await Share.share(
      { message: input.message, title: input.title, url: input.url },
      { dialogTitle: input.title, subject: input.title },
    );

    return result.action === Share.sharedAction ? "shared" : "dismissed";
  } catch {
    return "unavailable";
  }
}

/** §9: «Copia esegue subito la copia dell'URL canonico.» */
export async function copyEventLink(url: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(url);

    return true;
  } catch {
    return false;
  }
}

/**
 * Destinazione pendente equivalente a `return_to_event(public_id)` (§12).
 *
 * Sopravvive a login, registrazione, onboarding e riavvio perché è
 * persistita, non nello stato della schermata. Contiene solo l'identificatore
 * pubblico: nessuna selezione, nessuna autorizzazione dell'utente precedente.
 * Viene consumata una volta sola; un link aperto dopo sovrascrive il
 * precedente («l'intento più recente prevale»).
 */
export const pendingEventLink = createPendingLinkStore("@footme/pending-event/v1");
