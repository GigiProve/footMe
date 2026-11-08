/**
 * Modello del centro Partecipanti (DAS-REV-30 §21–§23).
 *
 * Una riga per relazione persona–evento, come la restituisce
 * `fetch_selection_event_participants`. Le azioni sono capability del
 * server (§27: «Backend restituisce permitted_actions coerenti ma le
 * rivalida al commit»); il client non le deduce da stato o colore.
 */
import type { ParticipationStatus } from "../detail/event-detail-types";

/** §21: «esattamente queste opzioni principali». */
export type ParticipantsFilter =
  | "confirmed"
  | "pending"
  | "invited"
  | "rejected"
  | "declined"
  | "withdrawn"
  | "all";

export type ParticipantAction = "confirm" | "reject" | "revoke" | "remove";

/** §26: ☆/★ dipendono da actor, Società e liste accessibili; mai globali. */
export type StarState = "hidden" | "empty" | "filled";

export type ParticipantRow = {
  actions: ParticipantAction[];
  avatarUrl: string | null;
  confirmBlockedReason: "full" | null;
  fullName: string;
  invitationGeneration: number;
  invitationMessage: string | null;
  invitedAt: string | null;
  participationId: string;
  personId: string;
  primaryPosition: string | null;
  role: string | null;
  source: "registration" | "invitation";
  star: StarState;
  status: ParticipationStatus;
  statusAt: string | null;
  version: number;
  withdrawnFrom: "pending" | "confirmed" | null;
};

export type ParticipantsCounts = {
  confirmed: number;
  invited: number;
  pending: number;
};

export type ParticipantsPage = {
  capabilities: { isFull: boolean; manage: boolean; operational: boolean };
  counts: ParticipantsCounts;
  filter: ParticipantsFilter;
  items: ParticipantRow[];
  nextCursor: string | null;
  /** Count del filtro e della query sull'insieme autorizzato (§21). */
  total: number;
};
