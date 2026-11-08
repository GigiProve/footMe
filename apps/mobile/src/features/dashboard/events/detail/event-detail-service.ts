/**
 * Accesso ai dati del dettaglio, della partecipazione e delle richieste
 * (DAS-REV-29 §7, §15–§21).
 *
 * Nessuna regola vive qui: chi vede cosa, se ci si può iscrivere, ritirare o
 * decidere lo dicono le RPC a ogni chiamata (§7: «Il server decide quali
 * campi e azioni sono disponibili»). I comandi non inviano mai `person_id`,
 * stato, modalità o conteggi (§21: «Non lasciare che un client invii
 * direttamente status=CONFIRMED, confirmed_count o decision_by»).
 *
 * I mapper partono dalle righe grezze snake_case, così la QA visuale con
 * fixture RPC verifica anche la mappatura.
 */
import { supabase } from "../../../../lib/supabase";
import { SelectionEventsError, selectionEventsRpc } from "../events-service";
import type { SelectionEventStatus, SelectionEventType } from "../events-types";
import type {
  EventAvailability,
  EventPublicProjection,
  EventPublicState,
  EventRequestDetail,
  MyParticipation,
  ParticipationCommandResult,
  ParticipationStatus,
  PendingRequestsPreview,
  PersonalState,
  SelectionEventDetail,
} from "./event-detail-types";

type Raw = Record<string, unknown>;

const obj = (value: unknown): Raw | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null;
const text = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;
const bool = (value: unknown): boolean => value === true;
const int = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  return typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : null;
};
const hm = (value: unknown): string | null => {
  const raw = text(value);

  return raw && /^\d{2}:\d{2}/.test(raw) ? raw.slice(0, 5) : null;
};
const civil = (value: unknown): string | null => {
  const raw = text(value);

  return raw && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null;
};

function eventType(value: unknown): SelectionEventType | null {
  return value === "tryout" || value === "stage" || value === "open_day" ? value : null;
}

function lifecycle(value: unknown): SelectionEventStatus {
  return value === "published" || value === "completed" || value === "cancelled" ? value : "draft";
}

function publicState(value: unknown): EventPublicState {
  return value === "open" ||
    value === "open_full_manual" ||
    value === "full" ||
    value === "cancelled" ||
    value === "completed"
    ? value
    : /* Prudente (§10): uno stato sconosciuto non pubblicizza iscrizioni. */
      "closed";
}

const PARTICIPATION_STATUSES: readonly ParticipationStatus[] = [
  "pending",
  "confirmed",
  "rejected",
  "withdrawn",
  "invited",
  "declined",
  "revoked",
  "removed",
];

/**
 * DAS-REV-30 QA-150: uno stato sconosciuto non diventa mai CONFIRMED né un
 * altro stato noto; la riga cade e il chiamante mostra il fallback.
 */
export function participationStatus(value: unknown): ParticipationStatus | null {
  return PARTICIPATION_STATUSES.includes(value as ParticipationStatus)
    ? (value as ParticipationStatus)
    : null;
}

function confirmationSource(value: unknown) {
  return value === "automatic" || value === "manual" || value === "invitation" ? value : null;
}

function confirmation(value: unknown) {
  return value === "automatic" || value === "manual" ? value : null;
}

function mapAvailability(value: unknown): EventAvailability {
  const raw = obj(value) ?? {};

  return {
    canSubmitRequest: bool(raw.can_submit_request),
    confirmationMode: confirmation(raw.confirmation_mode),
    effectiveDeadline: text(raw.effective_deadline),
    hasExplicitDeadline: bool(raw.has_explicit_deadline),
    isFull: bool(raw.is_full),
    lifecycle: lifecycle(raw.lifecycle),
    maxParticipants: int(raw.max_participants),
    nextTransitionAt: text(raw.next_transition_at),
    publicState: publicState(raw.public_state),
    registrationOpen: bool(raw.registration_open),
    started: bool(raw.started),
  };
}

export function mapPublicProjection(raw: Raw): EventPublicProjection | null {
  /* La lettura anonima non porta l'UUID interno (§11): l'identificatore
     pubblico ne fa le veci per la vista in app senza sessione. */
  const eventId = text(raw.event_id) ?? text(raw.public_id);

  if (raw.state !== "available" || !eventId) {
    return null;
  }

  const club = obj(raw.club) ?? {};
  const flyer = obj(raw.flyer);
  const flyerPath = flyer ? text(flyer.path) : null;

  return {
    availability: mapAvailability(raw.availability),
    birthYearFrom: int(raw.birth_year_from),
    birthYearTo: int(raw.birth_year_to),
    club: {
      isVerified: bool(club.is_verified),
      logoUrl: text(club.logo_url),
      name: text(club.name) ?? "",
    },
    confirmationMode: confirmation(raw.confirmation_mode),
    confirmedCount: int(raw.confirmed_count),
    deadlineDate: civil(raw.registration_deadline_date),
    deadlineTime: hm(raw.registration_deadline_time),
    description: text(raw.description),
    endTime: hm(raw.end_time),
    eventId,
    eventType: eventType(raw.event_type),
    flyer:
      flyer && flyerPath
        ? { height: int(flyer.height), path: flyerPath, width: int(flyer.width) }
        : null,
    maxParticipants: int(raw.max_participants),
    publicId: text(raw.public_id),
    requirements: text(raw.requirements_info),
    startDate: civil(raw.start_date),
    startTime: hm(raw.start_time),
    teamName: text(raw.team_name) ?? "",
    timezone: text(raw.timezone) ?? "Europe/Rome",
    title: text(raw.title),
    venueAddress: text(raw.venue_address),
    venueName: text(raw.venue_name),
    version: int(raw.version) ?? 1,
  };
}

function mapParticipation(value: unknown): MyParticipation | null {
  const raw = obj(value);
  const id = raw ? text(raw.id) : null;
  const status = raw ? participationStatus(raw.status) : null;

  if (!raw || !id || !status) {
    return null;
  }

  return {
    confirmationSource: confirmationSource(raw.confirmation_source),
    confirmedAt: text(raw.confirmed_at),
    decisionMessage: text(raw.decision_message),
    id,
    invitationGeneration: int(raw.invitation_generation) ?? 0,
    invitationMessage: text(raw.invitation_message),
    invitedAt: text(raw.invited_at),
    rejectedAt: text(raw.rejected_at),
    removalMessage: text(raw.removal_message),
    source: raw.source === "invitation" ? "invitation" : "registration",
    status,
    submittedAt: text(raw.submitted_at),
    version: int(raw.version) ?? 1,
    withdrawnAt: text(raw.withdrawn_at),
    withdrawnFrom:
      raw.withdrawn_from === "pending" || raw.withdrawn_from === "confirmed"
        ? raw.withdrawn_from
        : null,
  };
}

function mapPersonal(value: unknown): PersonalState {
  const raw = obj(value) ?? {};
  const caps = obj(raw.capabilities) ?? {};

  return {
    birthYear: int(raw.birth_year),
    birthYearMismatch: bool(raw.birth_year_mismatch),
    capabilities: {
      accept: bool(caps.accept),
      acceptBlockedReason: caps.accept_blocked_reason === "full" ? "full" : null,
      decline: bool(caps.decline),
      register: bool(caps.register),
      registerAgain: bool(caps.register_again),
      withdraw: bool(caps.withdraw),
    },
    ineligibleReason: text(raw.ineligible_reason),
    participation: mapParticipation(raw.participation),
  };
}

export function mapDetail(value: unknown): SelectionEventDetail {
  const raw = obj(value);
  const base = raw ? mapPublicProjection(raw) : null;

  if (!raw || !base) {
    throw new SelectionEventsError("SELECTION_EVENT_NOT_AVAILABLE");
  }

  const management = obj(raw.management);
  const participants = management ? obj(management.participants) : null;

  return {
    ...base,
    clubId: text(raw.club_id) ?? "",
    landingVisible: bool(raw.landing_visible),
    management: management
      ? {
          canDecide: bool(management.can_decide),
          canEdit: bool(management.can_edit),
          canInvite: bool(management.can_invite),
          canManageParticipants: bool(management.can_manage_participants),
          canReadParticipants: bool(management.can_read_participants),
          canShare: bool(management.can_share),
          confirmedCount: int(management.confirmed_count) ?? 0,
          inviteBlockedReason: management.invite_blocked_reason === "full" ? "full" : null,
          /* §8: i count esistono solo con la lettura partecipanti; senza,
             il blocco è null e la sezione non compare (mai «0» inventati). */
          participants: participants
            ? {
                confirmedCount: int(participants.confirmed_count) ?? 0,
                invitedCount: int(participants.invited_count) ?? 0,
                pendingCount: int(participants.pending_count) ?? 0,
              }
            : null,
          pendingRequestsCount: int(management.pending_requests_count),
        }
      : null,
    participationMode:
      raw.participation_mode === "open_registration" || raw.participation_mode === "invite_only"
        ? raw.participation_mode
        : null,
    personal: mapPersonal(raw.personal),
    status: lifecycle(raw.status),
    teamId: text(raw.team_id) ?? "",
  };
}

/**
 * Dettaglio autenticato. Un solo resolver per ogni origine (§7): il Centro e
 * le notifiche passano l'ID evento, il link passa l'identificatore pubblico.
 */
export async function fetchSelectionEventDetail(input: {
  eventId?: string | null;
  publicId?: string | null;
}): Promise<SelectionEventDetail> {
  const data = await selectionEventsRpc<unknown>("fetch_selection_event_detail", {
    p_event_id: input.eventId ?? null,
    p_public_id: input.publicId ?? null,
  });

  return mapDetail(data);
}

/**
 * Proiezione pubblica per chi apre il link nell'app senza sessione: la stessa
 * lettura anonima della landing. `null` = contenuto non disponibile.
 */
export async function fetchPublicSelectionEvent(publicId: string): Promise<EventPublicProjection | null> {
  const data = await selectionEventsRpc<unknown>("fetch_public_selection_event", {
    p_public_id: publicId,
  });
  const raw = obj(data);

  return raw ? mapPublicProjection(raw) : null;
}

// ── Comandi della persona ───────────────────────────────────────────────────

export function mapCommand(value: unknown): ParticipationCommandResult {
  const raw = obj(value) ?? {};
  const outcome = text(raw.outcome);

  return {
    outcome:
      outcome === "submitted" ||
      outcome === "resubmitted" ||
      outcome === "already_registered" ||
      outcome === "replayed" ||
      outcome === "request_withdrawn" ||
      outcome === "participation_cancelled" ||
      outcome === "already_invited" ||
      outcome === "invitation_accepted" ||
      outcome === "invitation_declined" ||
      outcome === "invitation_revoked" ||
      outcome === "participant_removed"
        ? outcome
        : null,
    participationId: text(raw.participation_id),
    replayed: bool(raw.replayed),
    status: participationStatus(raw.status),
    version: int(raw.version),
  };
}

/** §15: nessun `person_id`, nessuna modalità: il server deriva tutto. */
export async function registerForSelectionEvent(input: {
  eventId: string;
  idempotencyKey: string;
}): Promise<ParticipationCommandResult> {
  return mapCommand(
    await selectionEventsRpc<unknown>("register_for_selection_event", {
      p_event_id: input.eventId,
      p_idempotency_key: input.idempotencyKey,
    }),
  );
}

export async function withdrawSelectionEventParticipation(input: {
  expectedVersion: number;
  idempotencyKey: string;
  participationId: string;
}): Promise<ParticipationCommandResult> {
  return mapCommand(
    await selectionEventsRpc<unknown>("withdraw_selection_event_participation", {
      p_expected_version: input.expectedVersion,
      p_idempotency_key: input.idempotencyKey,
      p_participation_id: input.participationId,
    }),
  );
}

/**
 * DAS-REV-30 §18, §20: risposta all'invito. Il comando cita versione e
 * generazione **viste**: un tap da una schermata vecchia non tocca un
 * reinvito successivo. Nessun `person_id`: il destinatario è la sessione.
 */
export async function respondToEventInvitation(input: {
  expectedGeneration: number;
  expectedVersion: number;
  idempotencyKey: string;
  participationId: string;
  response: "accept" | "decline";
}): Promise<ParticipationCommandResult> {
  return mapCommand(
    await selectionEventsRpc<unknown>(
      input.response === "accept"
        ? "accept_selection_event_invitation"
        : "decline_selection_event_invitation",
      {
        p_expected_generation: input.expectedGeneration,
        p_expected_version: input.expectedVersion,
        p_idempotency_key: input.idempotencyKey,
        p_participation_id: input.participationId,
      },
    ),
  );
}

// ── Società: richieste ─────────────────────────────────────────────────────

export function mapPendingPreview(value: unknown): PendingRequestsPreview {
  const raw = obj(value) ?? {};
  const items = Array.isArray(raw.items) ? raw.items : [];

  return {
    items: items.flatMap((entry) => {
      const item = obj(entry);
      const participationId = item ? text(item.participation_id) : null;

      return item && participationId
        ? [
            {
              avatarUrl: text(item.avatar_url),
              birthYear: int(item.birth_year),
              fullName: text(item.full_name) ?? "",
              participationId,
              personId: text(item.person_id) ?? "",
              role: text(item.role),
              submittedAt: text(item.submitted_at),
              version: int(item.version) ?? 1,
            },
          ]
        : [];
    }),
    total: int(raw.total),
  };
}

export async function fetchPendingRequestsPreview(eventId: string): Promise<PendingRequestsPreview> {
  return mapPendingPreview(
    await selectionEventsRpc<unknown>("fetch_selection_event_pending_requests", {
      p_event_id: eventId,
      p_limit: 3,
    }),
  );
}

export function mapRequest(value: unknown): EventRequestDetail {
  const raw = obj(value);
  const id = raw ? text(raw.participation_id) : null;
  const status = raw ? participationStatus(raw.status) : null;

  if (!raw || !id || !status) {
    throw new SelectionEventsError("SELECTION_EVENT_NOT_AVAILABLE");
  }

  const person = obj(raw.person) ?? {};
  const event = obj(raw.event) ?? {};
  const caps = obj(raw.capabilities) ?? {};

  return {
    capabilities: {
      confirm: bool(caps.confirm),
      confirmBlockedReason: caps.confirm_blocked_reason === "full" ? "full" : null,
      reject: bool(caps.reject),
    },
    decisionMessage: text(raw.decision_message),
    event: {
      confirmedCount: int(event.confirmed_count) ?? 0,
      endTime: hm(event.end_time),
      eventType: eventType(event.event_type),
      id: text(event.id) ?? "",
      isFull: bool(event.is_full),
      maxParticipants: int(event.max_participants),
      startDate: civil(event.start_date),
      startTime: hm(event.start_time),
      status: lifecycle(event.status),
      teamName: text(event.team_name) ?? "",
      timezone: text(event.timezone) ?? "Europe/Rome",
      title: text(event.title),
    },
    participationId: id,
    person: {
      avatarUrl: text(person.avatar_url),
      birthYear: int(person.birth_year),
      fullName: text(person.full_name) ?? "",
      id: text(person.id) ?? "",
      role: text(person.role),
    },
    status,
    submittedAt: text(raw.submitted_at),
    version: int(raw.version) ?? 1,
    withdrawnFrom:
      raw.withdrawn_from === "pending" || raw.withdrawn_from === "confirmed"
        ? raw.withdrawn_from
        : null,
  };
}

export async function fetchEventRequest(participationId: string): Promise<EventRequestDetail> {
  return mapRequest(
    await selectionEventsRpc<unknown>("fetch_selection_event_request", {
      p_participation_id: participationId,
    }),
  );
}

export async function confirmEventParticipation(input: {
  expectedVersion: number;
  idempotencyKey: string;
  participationId: string;
}): Promise<ParticipationCommandResult> {
  return mapCommand(
    await selectionEventsRpc<unknown>("confirm_selection_event_participation", {
      p_expected_version: input.expectedVersion,
      p_idempotency_key: input.idempotencyKey,
      p_participation_id: input.participationId,
    }),
  );
}

/** §18: il messaggio viaggia come testo; il server lo ripulisce e lo limita. */
export async function rejectEventParticipation(input: {
  expectedVersion: number;
  idempotencyKey: string;
  message: string | null;
  participationId: string;
}): Promise<ParticipationCommandResult> {
  return mapCommand(
    await selectionEventsRpc<unknown>("reject_selection_event_participation", {
      p_expected_version: input.expectedVersion,
      p_idempotency_key: input.idempotencyKey,
      p_message: input.message,
      p_participation_id: input.participationId,
    }),
  );
}

// ── Locandina ──────────────────────────────────────────────────────────────

export const FLYER_BUCKET = "selection-event-flyers";

/**
 * URL firmato e temporaneo della locandina (§11: il bucket è privato). La
 * policy Storage riusa la visibilità dell'evento: chi non può vederlo non
 * ottiene la firma.
 */
export async function signFlyerUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(FLYER_BUCKET).createSignedUrl(path, 3600);

  return error ? null : (data?.signedUrl ?? null);
}
