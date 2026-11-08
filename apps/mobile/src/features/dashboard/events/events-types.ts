/**
 * Modello degli eventi di selezione (DAS-REV-28 §8).
 *
 * Provino, Stage e Open day sono **tre valori di un attributo** della stessa
 * entità, non tre modelli (§1). Gli enum sono i valori del dominio; le
 * parole italiane stanno in `events-copy.ts` (§8: «Non mostrare enum inglesi
 * nella UI»).
 *
 * Il tempo è espresso come il server lo conserva (§15): giorno civile
 * `YYYY-MM-DD` e orari `HH:MM` **nel fuso dell'evento**, più il fuso IANA.
 * Il client non converte mai un orario in istante, quindi un cambio di fuso
 * del dispositivo non sposta nulla.
 */

export type SelectionEventType = "tryout" | "stage" | "open_day";

export type SelectionEventStatus =
  | "draft"
  | "published"
  | "completed"
  | "cancelled";

export type ParticipationMode = "open_registration" | "invite_only";

export type ConfirmationMode = "automatic" | "manual";

/** Le tre sezioni del Centro, nell'ordine fisso di §10. */
export type EventSection = "upcoming" | "drafts" | "history";

export const EVENT_SECTIONS: readonly EventSection[] = [
  "upcoming",
  "drafts",
  "history",
];

/** Limiti condivisi, ricevuti dal server (§14: «una sola configurazione»). */
export type EventLimits = {
  birthYearMax: number;
  birthYearMin: number;
  description: number;
  maxParticipants: number;
  requirements: number;
  title: number;
  venueAddress: number;
  venueName: number;
};

/** Intestazione del Centro e contesto del wizard. */
export type SelectionEventsCenter = {
  accessVerifiedAt: number;
  canCreate: boolean;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  limits: EventLimits;
  /** Squadre del perimetro quando è limitato; null se è l'intera Società. */
  scopeLabel: string | null;
  timezone: string;
};

/**
 * Una riga del Centro (§21: «solo id, titolo, tipo, Team, stato, starts_at,
 * limite/count derivati e capability di navigazione»).
 *
 * I conteggi sono `null` sulle bozze — una bozza non ha partecipazione
 * (QA-017) — e quando non sono disponibili: §11 vieta di trasformare un
 * conteggio ignoto in «0 confermati».
 */
export type SelectionEventRow = {
  canEdit: boolean;
  confirmedCount: number | null;
  countsAvailable: boolean;
  eventType: SelectionEventType | null;
  id: string;
  isFull: boolean;
  maxParticipants: number | null;
  pendingRequestsCount: number | null;
  startDate: string | null;
  startTime: string | null;
  status: SelectionEventStatus;
  teamId: string;
  teamName: string;
  timezone: string;
  title: string | null;
  updatedAt: string | null;
};

export type SelectionEventsPage = {
  hasMore: boolean;
  nextCursor: string | null;
  rows: SelectionEventRow[];
};

/** Squadra utilizzabile come destinazione (§9). */
export type SelectionEventTeam = {
  canCreate: boolean;
  canEdit: boolean;
  contextLabel: string | null;
  id: string;
  name: string;
};

/**
 * I valori del form, così come l'utente li vede. Le stringhe vuote sono
 * «non ancora scelto»; diventano `null` solo nel payload (§8: i campi non
 * determinati non si inventano).
 */
export type EventDraftValues = {
  birthYearFrom: string;
  birthYearTo: string;
  confirmationMode: ConfirmationMode | null;
  deadlineDate: string | null;
  deadlineTime: string | null;
  description: string;
  endTime: string | null;
  eventType: SelectionEventType | null;
  maxParticipants: string;
  participationMode: ParticipationMode | null;
  requirements: string;
  startDate: string | null;
  startTime: string | null;
  teamId: string | null;
  title: string;
  venueAddress: string;
  venueName: string;
};

/** Configurazione completa letta per il wizard. */
export type SelectionEventEditor = {
  canEdit: boolean;
  canPublish: boolean;
  clubId: string;
  hasActivity: boolean;
  id: string;
  status: SelectionEventStatus;
  teamIsArchived: boolean;
  teamName: string;
  timezone: string;
  values: EventDraftValues;
  version: number;
};

export type SaveResult = {
  eventId: string;
  replayed: boolean;
  status: SelectionEventStatus;
  version: number;
};
