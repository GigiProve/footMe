/**
 * Riga di stato del composer (HOM-06.1 §29, §62, §68, §120, §169–177): decide
 * QUALE messaggio mostra `ComposerStatusBanner`, con la priorità della spec.
 *
 * Pura e testabile senza schermo. Ordine:
 *  1. invio in corso → «Pubblicazione in corso…» (§68, §120);
 *  2. blocco permanente del momento (permesso perso §169/§173, identità non
 *     compatibile §29, nessuna identity §172, upload fallito §70, conflitto §161);
 *  3. esito dell'ultimo invio fallito (§174–177);
 *  4. avviso transitorio (limite media §62, video troppo lunghi).
 * Niente di tutto ciò cancella contenuto (§170).
 */

import { errorCopy, publishBlockReason } from "./composer-presentation";
import type { ComposerState } from "./composer-reducer";

export const COMPOSER_PUBLISHING_COPY = "Pubblicazione in corso…"; // §68
export const COMPOSER_SAVING_COPY = "Salvataggio in corso…";

/**
 * Cosa fa un tentativo di uscita (Annulla, back hardware Android, gesture,
 * §137–139):
 *  • `block`   — invio in corso: non si esce, l'invio non va interrotto (§119);
 *  • `confirm` — c'è del lavoro: dialogo di conferma (§138);
 *  • `leave`   — niente da perdere: si chiude direttamente (§137).
 */
export type ExitDecision = "block" | "confirm" | "leave";

export function exitDecision(input: { isPublishing: boolean; isDirty: boolean }): ExitDecision {
  if (input.isPublishing) {
    return "block";
  }

  return input.isDirty ? "confirm" : "leave";
}

export type ComposerStatus ={ tone: "progress" | "error" | "notice"; message: string };

export function composerStatus(state: ComposerState, notice: string | null): ComposerStatus | null {
  const mode = state.mode.kind;

  if (state.publish.status === "publishing") {
    return { message: mode === "edit" ? COMPOSER_SAVING_COPY : COMPOSER_PUBLISHING_COPY, tone: "progress" };
  }

  const blocked = publishBlockReason(state, state.limits);

  if (blocked) {
    return { message: blocked, tone: "error" };
  }

  if (state.publish.status === "failed") {
    return { message: errorCopy(state.publish.code, mode), tone: "error" };
  }

  return notice ? { message: notice, tone: "notice" } : null;
}
