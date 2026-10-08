/**
 * Regole dei moduli Modifica profilo Procuratore (REV-PROF-16).
 *
 * Stanno fuori dalle schermate perché sono il comportamento, non il
 * rendering: il limite di tre attività e la forma di un numero di licenza si
 * provano senza montare React Native, e restano leggibili accanto alla loro
 * motivazione invece che in mezzo a un form.
 */
import { AGENT_PRIMARY_ACTIVITY_LIMIT } from "../../onboarding/agent/agent-taxonomy";

export const AGENT_ACTIVITY_LIMIT_MESSAGE =
  "Puoi selezionare fino a 3 attività principali.";

/**
 * Aggiunge o toglie un'attività rispettando il limite di tre.
 *
 * Restituisce `atLimit` invece di troncare: la schermata deve poter dire
 * all'utente che il limite è stato raggiunto, e il modo in cui lo dice non
 * riguarda questa regola. Al quarto tentativo la selezione resta identica —
 * togliere la prima per far posto sarebbe una scelta presa al posto suo.
 */
export function toggleAgentActivity(
  activities: readonly string[],
  value: string,
): { atLimit: boolean; activities: string[] } {
  if (activities.includes(value)) {
    return {
      activities: activities.filter((entry) => entry !== value),
      atLimit: false,
    };
  }

  if (activities.length >= AGENT_PRIMARY_ACTIVITY_LIMIT) {
    return { activities: [...activities], atLimit: true };
  }

  return { activities: [...activities, value], atLimit: false };
}

/**
 * Normalizza un numero di licenza: maiuscolo, senza spazi superflui.
 *
 * Serve perché lo stesso numero scritto in due modi non diventi due dati —
 * non per renderlo più bello.
 */
export function normalizeAgentLicenseNumber(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Un numero di licenza accettabile: lettere, cifre, trattini e barre, da 2 a
 * 32 caratteri.
 *
 * Non esiste un formato unico fra FIGC, FIFA e le federazioni estere, quindi
 * si rifiuta ciò che certamente non è un numero di licenza — non si pretende
 * un formato che il prodotto non conosce. Il vuoto resta valido: il numero è
 * facoltativo anche con l'abilitazione attiva.
 */
export function isAgentLicenseNumberValid(value: string): boolean {
  const normalized = normalizeAgentLicenseNumber(value);

  return (
    normalized.length === 0 || /^[A-Z0-9][A-Z0-9\-/ ]{1,31}$/.test(normalized)
  );
}
