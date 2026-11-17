/**
 * Tipi dello stato personale Notifiche di una conversazione (DAS-REV-34 §4, §9).
 *
 * Lo stato vive nel server (`conversation_actor_states`, solo proprie righe):
 * il client lo legge e lo comanda, non lo calcola. DIRECT e GROUP condividono
 * lo stesso modello (QA-006); il solo campo specifico è `periodId`, che nelle
 * GROUP lega il comando al periodo di appartenenza corrente (§4, §14).
 */

/** Le cinque scelte di §9. `active` rimuove il mute. */
export type MuteChoice = "active" | "1h" | "8h" | "1w" | "indefinite";

/** Opzioni persistite: tutto tranne `active` (null = Attive). */
export type MuteOption = Exclude<MuteChoice, "active">;

export type ConversationKind = "direct" | "group";

export type ConversationNotificationState = {
  /** Il server dice se la preferenza è modificabile (es. gruppo eliminato → no). */
  canChange: boolean;
  conversationId: string;
  conversationType: ConversationKind;
  /** Mute effettivo adesso, valutato dal server (scadenza lazy, §9). */
  isMuted: boolean;
  muteOption: MuteOption | null;
  /** Istante UTC calcolato dal server; mai dal dispositivo. */
  mutedUntil: string | null;
  /** GROUP: periodo corrente; DIRECT: null. */
  periodId: string | null;
  /** Incrementa a ogni comando: risolve due dispositivi e risposte in ritardo (§9). */
  stateVersion: number;
};
