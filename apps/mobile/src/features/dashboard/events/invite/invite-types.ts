/**
 * Modello del flusso di invito (DAS-REV-30 §13–§17).
 *
 * Una sorgente è un **filtro** dell'elenco, non la destinazione
 * dell'invito (§14). Un candidato è identificato dal `personId` canonico:
 * la selezione è un insieme di persone, mai di righe.
 */
import type { ParticipationMode, SelectionEventType } from "../events-types";
import type { ParticipationStatus } from "../detail/event-detail-types";

export type InviteSourceList = {
  listType: "position" | "custom";
  name: string;
  scopeLabel: string | null;
  shortlistId: string;
};

/** `null` = Tutti i profili (ricerca canonica). */
export type InviteSource = InviteSourceList | null;

export type InviteSources = {
  customLists: InviteSourceList[];
  positionLists: InviteSourceList[];
};

export type CandidateReason = "already_invited" | "already_confirmed" | "pending_request";

export type InviteCandidate = {
  avatarUrl: string | null;
  fullName: string;
  personId: string;
  primaryPosition: string | null;
  reason: CandidateReason | null;
  relationStatus: ParticipationStatus | null;
  role: string | null;
  selectable: boolean;
};

export type CandidatesPage = {
  items: InviteCandidate[];
  nextCursor: string | null;
};

export type InviteOutcome =
  | "sent"
  | "already_invited"
  | "already_confirmed"
  | "pending_request"
  | "unavailable";

export type InviteOutcomeItem = {
  /** Null quando l'identità non è più mostrabile (§16). */
  fullName: string | null;
  outcome: InviteOutcome;
  personId: string | null;
};

export type InviteResult = {
  confirmedCount: number;
  invitedCount: number;
  items: InviteOutcomeItem[];
  pendingCount: number;
  replayed: boolean;
  sentCount: number;
  skippedCount: number;
};

/** Evento proposto dal profilo (§17, screen 06). */
export type InvitableEvent = {
  endTime: string | null;
  eventId: string;
  eventType: SelectionEventType | null;
  participationMode: ParticipationMode | null;
  startDate: string | null;
  startTime: string | null;
  teamName: string;
  timezone: string;
  title: string;
};

/** Persona selezionata: quanto basta a contare e a disegnare la conferma. */
export type SelectedPerson = Pick<InviteCandidate, "avatarUrl" | "fullName" | "personId" | "primaryPosition" | "role">;
