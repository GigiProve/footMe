/**
 * Disponibilità di un contenuto: un solo layer per tutte le route (HOM-04
 * §54–55, §63–68, §126–127, §158–159).
 *
 * Risposte equivalenti devono dare lo stesso stato UI, non «404 qui, null là,
 * toast altrove, pagina vuota altrove» (§66). Tre stati, mai di più:
 *  • `ready`       — il contenuto c'è;
 *  • `unavailable` — risposta DEFINITIVA: eliminato, non più pubblico, non
 *                    visibile, riferimento non valido. Non si distingue il
 *                    motivo (§64) e non si rivela se l'id esiste (§65);
 *  • `error`       — fallimento temporaneo (rete): «Riprova», mai «non
 *                    disponibile» finché non c'è una risposta definitiva (§67–68).
 */

import { isHomeOrigin, type ContentOrigin } from "./content-routes";

export type ContentAvailability<T> =
  | { status: "ready"; data: T }
  | { status: "unavailable" }
  | { status: "error" };

/** §57 */
export const CONTENT_UNAVAILABLE_TITLE = "Contenuto non disponibile";
export const CONTENT_UNAVAILABLE_BODY = "Questo contenuto è stato eliminato o non è più disponibile.";
/** §59: dentro la Home la CTA è «Torna al feed», mai «Torna alla Home». */
export const CONTENT_UNAVAILABLE_CTA = "Torna al feed";
/** §68 */
export const CONTENT_LOAD_ERROR = "Non è stato possibile caricare il contenuto.";
export const CONTENT_LOAD_RETRY = "Riprova";

/**
 * Codici che sono una risposta definitiva e non un guasto: id malformato
 * (22P02), nessuna riga (PGRST116), permesso negato (42501). Tutto il resto —
 * rete, timeout, 5xx — è temporaneo (§63, §67).
 */
const DEFINITIVE_ERROR_CODES: readonly string[] = ["22P02", "PGRST116", "42501"];

export function classifyContentError(error: unknown): "unavailable" | "error" {
  const code =
    typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;

  return typeof code === "string" && DEFINITIVE_ERROR_CODES.includes(code)
    ? "unavailable"
    : "error";
}

/** Dall'esito di una query (dati o errore) allo stato UI. `null` è una risposta definitiva. */
export function normalizeContentAvailability<T>(input: {
  data: T | null | undefined;
  isError: boolean;
  error?: unknown;
}): ContentAvailability<T> {
  if (input.isError) {
    return { status: classifyContentError(input.error) };
  }
  return input.data ? { data: input.data, status: "ready" } : { status: "unavailable" };
}

/** Come `normalizeContentAvailability`, per i dettagli che caricano con una funzione async. */
export async function loadContentAvailability<T>(
  load: () => Promise<T | null | undefined>,
): Promise<ContentAvailability<T>> {
  try {
    const data = await load();
    return normalizeContentAvailability({ data, isError: false });
  } catch (error) {
    return normalizeContentAvailability<T>({ data: null, error, isError: true });
  }
}

/**
 * §58–62, §126–127: «Torna al feed» compare dove l'utente arriva dalla Home, o
 * dove non c'è uno stack a cui tornare (deep link da fuori app, §61). Dalle
 * altre superfici basta il Back nativo, che riporta a Cerca, Profilo, chat… (§123–125).
 */
export function showBackToFeed(input: {
  origin: ContentOrigin | null;
  canGoBack: boolean;
}): boolean {
  return isHomeOrigin(input.origin) || input.origin === "DEEP_LINK" || !input.canGoBack;
}

/** Cosa fa «Torna al feed»: torna al Feed esistente se c'è, altrimenti costruisce la Home (§62). */
export function backToFeedMode(canGoBack: boolean): "back" | "replace_home" {
  return canGoBack ? "back" : "replace_home";
}
