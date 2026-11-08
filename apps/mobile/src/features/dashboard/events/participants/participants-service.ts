/**
 * Accesso ai dati del centro Partecipanti (DAS-REV-30 §21–§25, §27).
 *
 * Nessuna regola vive qui: chi legge, chi gestisce e quali azioni esistono
 * per riga lo dice il server a ogni chiamata. I comandi inviano solo
 * partecipazione, versione vista, messaggio e chiave idempotente — mai
 * stato, actor o count (§27).
 *
 * Conferma e non accettazione delle richieste PENDING **non** sono qui: si
 * riusano i comandi della 29 (`event-detail-service`), come chiede §23.
 */
import { SelectionEventsError, selectionEventsRpc } from "../events-service";
import { mapCommand, participationStatus } from "../detail/event-detail-service";
import type { ParticipationCommandResult } from "../detail/event-detail-types";
import type {
  ParticipantAction,
  ParticipantRow,
  ParticipantsFilter,
  ParticipantsPage,
  StarState,
} from "./participants-types";

type Raw = Record<string, unknown>;

const obj = (value: unknown): Raw | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null;
const text = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;
const int = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  return typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : null;
};

const FILTERS: readonly ParticipantsFilter[] = [
  "confirmed",
  "pending",
  "invited",
  "rejected",
  "declined",
  "withdrawn",
  "all",
];

export function parseFilter(value: unknown): ParticipantsFilter {
  return FILTERS.includes(value as ParticipantsFilter) ? (value as ParticipantsFilter) : "confirmed";
}

const ACTIONS: readonly ParticipantAction[] = ["confirm", "reject", "revoke", "remove"];

function star(value: unknown): StarState {
  return value === "filled" || value === "empty" ? value : "hidden";
}

/**
 * Una riga con stato sconosciuto cade (QA-150): non diventa mai un
 * confermato né un'altra etichetta inventata.
 */
export function mapParticipantRow(value: unknown): ParticipantRow | null {
  const raw = obj(value);
  const id = raw ? text(raw.participation_id) : null;
  const status = raw ? participationStatus(raw.status) : null;

  if (!raw || !id || !status) {
    return null;
  }

  const actions = Array.isArray(raw.actions)
    ? raw.actions.filter((entry): entry is ParticipantAction => ACTIONS.includes(entry as ParticipantAction))
    : [];

  return {
    actions,
    avatarUrl: text(raw.avatar_url),
    confirmBlockedReason: raw.confirm_blocked_reason === "full" ? "full" : null,
    fullName: text(raw.full_name) ?? "",
    invitationGeneration: int(raw.invitation_generation) ?? 0,
    invitationMessage: text(raw.invitation_message),
    invitedAt: text(raw.invited_at),
    participationId: id,
    personId: text(raw.person_id) ?? "",
    primaryPosition: text(raw.primary_position),
    role: text(raw.role),
    source: raw.source === "invitation" ? "invitation" : "registration",
    star: star(raw.star),
    status,
    statusAt: text(raw.status_at),
    version: int(raw.version) ?? 1,
    withdrawnFrom:
      raw.withdrawn_from === "pending" || raw.withdrawn_from === "confirmed" ? raw.withdrawn_from : null,
  };
}

export function mapParticipantsPage(value: unknown): ParticipantsPage {
  const raw = obj(value);

  if (!raw) {
    /* §29: una risposta non valida non simula «zero partecipanti». */
    throw new SelectionEventsError("UNKNOWN");
  }

  const counts = obj(raw.counts) ?? {};
  const caps = obj(raw.capabilities) ?? {};
  const items = Array.isArray(raw.items) ? raw.items : [];

  return {
    capabilities: {
      isFull: caps.is_full === true,
      manage: caps.manage === true,
      operational: caps.operational === true,
    },
    counts: {
      confirmed: int(counts.confirmed_count) ?? 0,
      invited: int(counts.invited_count) ?? 0,
      pending: int(counts.pending_count) ?? 0,
    },
    filter: parseFilter(raw.filter),
    items: items.flatMap((entry) => {
      const row = mapParticipantRow(entry);

      return row ? [row] : [];
    }),
    nextCursor: text(raw.next_cursor),
    total: int(raw.total) ?? 0,
  };
}

export async function fetchEventParticipants(input: {
  cursor?: string | null;
  eventId: string;
  filter: ParticipantsFilter;
  limit?: number;
  query?: string;
}): Promise<ParticipantsPage> {
  return mapParticipantsPage(
    await selectionEventsRpc<unknown>("fetch_selection_event_participants", {
      p_cursor: input.cursor ?? null,
      p_event_id: input.eventId,
      p_filter: input.filter,
      p_limit: input.limit ?? 20,
      p_query: input.query?.trim() ? input.query.trim() : null,
    }),
  );
}

/** §24: solo INVITED, alla versione vista. Nessuna motivazione. */
export async function revokeEventInvitation(input: {
  expectedVersion: number;
  idempotencyKey: string;
  participationId: string;
}): Promise<ParticipationCommandResult> {
  return mapCommand(
    await selectionEventsRpc<unknown>("revoke_selection_event_invitation", {
      p_expected_version: input.expectedVersion,
      p_idempotency_key: input.idempotencyKey,
      p_participation_id: input.participationId,
    }),
  );
}

/** §25: solo CONFIRMED; messaggio facoltativo ripulito e limitato dal server. */
export async function removeEventParticipant(input: {
  expectedVersion: number;
  idempotencyKey: string;
  message: string | null;
  participationId: string;
}): Promise<ParticipationCommandResult> {
  return mapCommand(
    await selectionEventsRpc<unknown>("remove_selection_event_participant", {
      p_expected_version: input.expectedVersion,
      p_idempotency_key: input.idempotencyKey,
      p_message: input.message,
      p_participation_id: input.participationId,
    }),
  );
}
