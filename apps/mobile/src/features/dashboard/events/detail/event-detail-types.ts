/**
 * Modello del dettaglio canonico di un evento di selezione (DAS-REV-29 §7,
 * §10, §13, §20).
 *
 * Tre proiezioni separate, come le restituisce il server (§7): la parte
 * pubblica (sempre), `personal` (solo la partecipazione e le capability
 * dell'actor) e `management` (solo per la Società nello scope, altrimenti
 * null). §20: «Stato pubblico e stato personale devono rimanere separati nel
 * modello e nella cache» — qui sono campi distinti, mai fusi in un'etichetta.
 */
import type {
  ConfirmationMode,
  EventFlyerRef,
  ParticipationMode,
  SelectionEventStatus,
  SelectionEventType,
} from "../events-types";

/** §10: la riga della matrice che la landing mostra, calcolata dal server. */
export type EventPublicState =
  | "open"
  | "open_full_manual"
  | "full"
  | "closed"
  | "cancelled"
  | "completed";

export type EventAvailability = {
  canSubmitRequest: boolean;
  confirmationMode: ConfirmationMode | null;
  effectiveDeadline: string | null;
  hasExplicitDeadline: boolean;
  isFull: boolean;
  lifecycle: SelectionEventStatus;
  maxParticipants: number | null;
  nextTransitionAt: string | null;
  publicState: EventPublicState;
  registrationOpen: boolean;
  started: boolean;
};

export type EventClubIdentity = {
  isVerified: boolean;
  logoUrl: string | null;
  name: string;
};

/** Proiezione pubblica: la stessa allowlist della landing (§11). */
export type EventPublicProjection = {
  availability: EventAvailability;
  birthYearFrom: number | null;
  birthYearTo: number | null;
  club: EventClubIdentity;
  confirmationMode: ConfirmationMode | null;
  /** Solo con un limite configurato (§11): mai un count senza denominatore. */
  confirmedCount: number | null;
  deadlineDate: string | null;
  deadlineTime: string | null;
  description: string | null;
  endTime: string | null;
  eventId: string;
  eventType: SelectionEventType | null;
  flyer: Omit<EventFlyerRef, "id"> | null;
  maxParticipants: number | null;
  publicId: string | null;
  requirements: string | null;
  startDate: string | null;
  startTime: string | null;
  teamName: string;
  timezone: string;
  title: string | null;
  venueAddress: string | null;
  venueName: string | null;
  version: number;
};

/**
 * DAS-REV-30 §9: gli stati canonici della partecipazione. Invito, rifiuto
 * del destinatario, revoca e rimozione sono distinti da richiesta, non
 * accettazione e ritiro volontario.
 */
export type ParticipationStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "withdrawn"
  | "invited"
  | "declined"
  | "revoked"
  | "removed";

/** DAS-REV-30 §9: provenienza della conferma corrente. */
export type ConfirmationSource = "automatic" | "manual" | "invitation";

export type MyParticipation = {
  confirmationSource: ConfirmationSource | null;
  confirmedAt: string | null;
  /** Solo su REJECTED (§18): una reiscrizione non lo ripropone. */
  decisionMessage: string | null;
  id: string;
  /** DAS-REV-30 §20: la generazione che i comandi devono citare. */
  invitationGeneration: number;
  /** Solo mentre l'invito è corrente (§9). */
  invitationMessage: string | null;
  invitedAt: string | null;
  rejectedAt: string | null;
  /** Solo su REMOVED (§25). */
  removalMessage: string | null;
  source: "registration" | "invitation";
  status: ParticipationStatus;
  submittedAt: string | null;
  version: number;
  withdrawnAt: string | null;
  /** §19: «Richiesta ritirata» o «Partecipazione annullata». */
  withdrawnFrom: "pending" | "confirmed" | null;
};

/** §20: «capability effettive (register, withdraw, register_again)». */
export type PersonalCapabilities = {
  /** DAS-REV-30 §18: Accetta invito, rivalidato al commit. */
  accept: boolean;
  /** «full» quando manca solo il posto (screen 09). */
  acceptBlockedReason: "full" | null;
  decline: boolean;
  register: boolean;
  registerAgain: boolean;
  withdraw: boolean;
};

export type PersonalState = {
  birthYear: number | null;
  birthYearMismatch: boolean;
  capabilities: PersonalCapabilities;
  /** `not_sports_profile`, `blocked`, `no_profile` o null. */
  ineligibleReason: string | null;
  participation: MyParticipation | null;
};

/** DAS-REV-30 §8: i tre count privati, solo con la lettura partecipanti. */
export type ParticipantsSummary = {
  confirmedCount: number;
  invitedCount: number;
  pendingCount: number;
};

export type EventManagement = {
  canDecide: boolean;
  canEdit: boolean;
  /** DAS-REV-30 §8: nuovi inviti (operativo, non pieno, capability). */
  canInvite: boolean;
  canManageParticipants: boolean;
  canReadParticipants: boolean;
  canShare: boolean;
  confirmedCount: number;
  /** «full» quando l'invito manca solo per la capienza (§8). */
  inviteBlockedReason: "full" | null;
  participants: ParticipantsSummary | null;
  pendingRequestsCount: number | null;
};

export type SelectionEventDetail = EventPublicProjection & {
  clubId: string;
  landingVisible: boolean;
  management: EventManagement | null;
  participationMode: ParticipationMode | null;
  personal: PersonalState;
  status: SelectionEventStatus;
  teamId: string;
};

/** Una riga della preview «Richieste da valutare» (§17). */
export type PendingRequestPreview = {
  avatarUrl: string | null;
  birthYear: number | null;
  fullName: string;
  participationId: string;
  personId: string;
  role: string | null;
  submittedAt: string | null;
  version: number;
};

export type PendingRequestsPreview = {
  items: PendingRequestPreview[];
  /** Totale privato dal backend; null quando l'actor non può decidere. */
  total: number | null;
};

/** Dettaglio della singola richiesta (§17, screen 16). */
export type EventRequestDetail = {
  capabilities: {
    confirm: boolean;
    confirmBlockedReason: "full" | null;
    reject: boolean;
  };
  decisionMessage: string | null;
  event: {
    confirmedCount: number;
    endTime: string | null;
    eventType: SelectionEventType | null;
    id: string;
    isFull: boolean;
    maxParticipants: number | null;
    startDate: string | null;
    startTime: string | null;
    status: SelectionEventStatus;
    teamName: string;
    timezone: string;
    title: string | null;
  };
  participationId: string;
  person: {
    avatarUrl: string | null;
    birthYear: number | null;
    fullName: string;
    id: string;
    role: string | null;
  };
  status: ParticipationStatus;
  submittedAt: string | null;
  version: number;
  withdrawnFrom: "pending" | "confirmed" | null;
};

/** Esito di un comando di partecipazione. */
export type ParticipationCommandResult = {
  outcome:
    | "submitted"
    | "resubmitted"
    | "already_registered"
    | "replayed"
    | "request_withdrawn"
    | "participation_cancelled"
    | "already_invited"
    | "invitation_accepted"
    | "invitation_declined"
    | "invitation_revoked"
    | "participant_removed"
    | null;
  participationId: string | null;
  replayed: boolean;
  status: ParticipationStatus | null;
  version: number | null;
};
