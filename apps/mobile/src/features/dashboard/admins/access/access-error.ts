/**
 * Traduzione degli errori dei comandi in copy (§29).
 *
 * `describeRolesError(toRolesError(e).code)` compariva identico in ogni
 * schermata di questo modulo. Una funzione sola perché il timeout non vada
 * perso per strada: `toRolesError` **rilancia** `DashboardTimeoutError`
 * invece di classificarlo, e §29 vuole che un timeout resti ritentabile
 * mentre un rifiuto autorizzativo non lo sia.
 */
import { DashboardTimeoutError } from "../../state/error-classification";
import {
  RolesAccessError,
  toRolesError,
  type RolesErrorCode,
} from "../../roles/roles-service";
import { describeRolesError } from "../../roles/roles-presentation";

export { RolesAccessError, toRolesError };
export type { RolesErrorCode };

export function describeRolesErrorSafe(error: unknown): string {
  if (error instanceof DashboardTimeoutError) {
    return "Non siamo riusciti a completare l'operazione. Riprova.";
  }

  try {
    return describeRolesError(toRolesError(error).code);
  } catch {
    /* `toRolesError` rilancia il timeout: il catch lo riporta alla stessa
       copy ritentabile invece di lasciarlo propagare dentro un renderer. */
    return "Non siamo riusciti a completare l'operazione. Riprova.";
  }
}
