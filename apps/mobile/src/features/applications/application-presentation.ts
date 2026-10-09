/**
 * Presentazione condivisa del dominio Candidature (DAS-REV-04).
 *
 * Funzioni pure, usate sia dal widget della Dashboard sia dalla lista "Le mie
 * candidature": una sola regola per l'esito, per la data di conclusione e per
 * il metadato della posizione chiusa. Due copie divergerebbero, ed è
 * esattamente il modo in cui la Dashboard finisce per dire una cosa e la
 * lista un'altra sulla stessa candidatura.
 *
 * Nessuna di queste funzioni legge l'orologio: l'istante è un parametro.
 */

import { APPLICATION_STATUS_LABELS } from "../recruiting/recruiting-service";
import type { ApplicationOutcome } from "./applications-service";

/**
 * §8: «normalmente si mostrano due preview, anche con sette candidature
 * attive; il massimo di preview è tre».
 *
 * Il backend ne manda tre: la terza entra solo quando la deduplicazione ne
 * toglie una già promossa negli aggiornamenti (§10).
 */
export const MAX_APPLICATION_PREVIEWS = 2;

/**
 * §7: metadato secondario, non uno stato terminale e non un badge dominante.
 */
export const POSITION_CLOSED_NOTE = "Posizione chiusa alle nuove candidature";

/**
 * §22: lo screen reader deve dire che cosa è chiuso e che cosa non lo è.
 * «La posizione non accetta più nuove candidature. La tua candidatura è
 * ancora in valutazione.»
 */
export const POSITION_CLOSED_A11Y =
  "La posizione non accetta più nuove candidature. La tua candidatura è ancora in valutazione.";

/** §7: esito generico, usato solo quando il dominio non ne conosce uno. */
export const SELECTION_COMPLETED_LABEL = "Selezione conclusa";

const ITALIAN_MONTHS_SHORT = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
] as const;

/** Label canonica dello stato corrente della candidatura. */
export function applicationStatusLabel(status: string): string {
  return (
    APPLICATION_STATUS_LABELS[
      status as keyof typeof APPLICATION_STATUS_LABELS
    ] ?? status
  );
}

/**
 * Esito di una candidatura conclusa (§7, §14).
 *
 * «Se il dominio conosce un esito finale più specifico, usare il suo testo
 * localizzato. Lo stato Selezione conclusa non deve sovrascrivere gli esiti
 * canonici conosciuti.» E al contrario: senza un esito per candidato non si
 * inventa Rifiutata o Non selezionato — vale il generico.
 */
export function applicationOutcomeLabel(
  status: string,
  outcome: ApplicationOutcome | null,
): string {
  if (outcome === "selection_completed") {
    return SELECTION_COMPLETED_LABEL;
  }

  return applicationStatusLabel(status);
}

/**
 * Data reale della conclusione (§14).
 *
 * «Se tale data manca: non ricavarla dalla chiusura dell'annuncio; ometterla
 * oppure mostrare un'altra data reale con label esplicita.» Qui si omette:
 * una riga storica senza data resta leggibile, una con la data sbagliata no.
 */
export function formatConcludedDate(concludedAt: string | null): string | null {
  if (!concludedAt) {
    return null;
  }

  const date = new Date(concludedAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const month = ITALIAN_MONTHS_SHORT[date.getMonth()];

  return month ? `${date.getDate()} ${month} ${date.getFullYear()}` : null;
}

/**
 * Riga di contesto finale della row storica: esito e, quando nota, la data.
 */
export function formatOutcomeLine(input: {
  concludedAt: string | null;
  outcome: ApplicationOutcome | null;
  status: string;
}): string {
  return [
    applicationOutcomeLabel(input.status, input.outcome),
    formatConcludedDate(input.concludedAt),
  ]
    .filter(Boolean)
    .join(" · ");
}
