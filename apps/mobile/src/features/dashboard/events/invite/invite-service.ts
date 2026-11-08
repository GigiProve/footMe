/**
 * Accesso ai dati del flusso di invito (DAS-REV-30 §13–§17, §27).
 *
 * Le sorgenti Shortlist, i candidati e gli eventi invitabili arrivano già
 * autorizzati: il server rivalida ACL di lista, scope della Società e
 * idoneità della persona a ogni lettura (§14). Il comando di invio porta
 * solo evento, Società attesa, persone, messaggio e chiave idempotente:
 * actor, `invited_by`, source e stato li deriva il server (§16).
 */
import { supabase } from "../../../../lib/supabase";
import { SelectionEventsError, selectionEventsRpc } from "../events-service";
import { participationStatus } from "../detail/event-detail-service";
import type {
  CandidateReason,
  CandidatesPage,
  InvitableEvent,
  InviteCandidate,
  InviteOutcome,
  InviteResult,
  InviteSourceList,
  InviteSources,
} from "./invite-types";

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
const hm = (value: unknown): string | null => {
  const raw = text(value);

  return raw && /^\d{2}:\d{2}/.test(raw) ? raw.slice(0, 5) : null;
};
const civil = (value: unknown): string | null => {
  const raw = text(value);

  return raw && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null;
};

function mapList(value: unknown, listType: "position" | "custom"): InviteSourceList | null {
  const raw = obj(value);
  const id = raw ? text(raw.shortlist_id) : null;

  return raw && id
    ? { listType, name: text(raw.name) ?? "", scopeLabel: text(raw.scope_label), shortlistId: id }
    : null;
}

export function mapInviteSources(value: unknown): InviteSources {
  const raw = obj(value) ?? {};
  const lists = (entries: unknown, type: "position" | "custom") =>
    (Array.isArray(entries) ? entries : []).flatMap((entry) => {
      const list = mapList(entry, type);

      return list ? [list] : [];
    });

  return {
    customLists: lists(raw.custom_lists, "custom"),
    positionLists: lists(raw.position_lists, "position"),
  };
}

export async function fetchInviteSources(eventId: string): Promise<InviteSources> {
  return mapInviteSources(
    await selectionEventsRpc<unknown>("fetch_selection_event_invite_sources", { p_event_id: eventId }),
  );
}

function reason(value: unknown): CandidateReason | null {
  return value === "already_invited" || value === "already_confirmed" || value === "pending_request"
    ? value
    : null;
}

export function mapCandidate(value: unknown): InviteCandidate | null {
  const raw = obj(value);
  const id = raw ? text(raw.person_id) : null;

  if (!raw || !id) {
    return null;
  }

  return {
    avatarUrl: text(raw.avatar_url),
    fullName: text(raw.full_name) ?? "",
    personId: id,
    primaryPosition: text(raw.primary_position),
    reason: reason(raw.reason),
    relationStatus: participationStatus(raw.relation_status),
    role: text(raw.role),
    /* Prudente: una riga senza esito esplicito non è selezionabile. */
    selectable: raw.selectable === true,
  };
}

export function mapCandidatesPage(value: unknown): CandidatesPage {
  const raw = obj(value);

  if (!raw) {
    throw new SelectionEventsError("UNKNOWN");
  }

  return {
    items: (Array.isArray(raw.items) ? raw.items : []).flatMap((entry) => {
      const candidate = mapCandidate(entry);

      return candidate ? [candidate] : [];
    }),
    nextCursor: text(raw.next_cursor),
  };
}

export async function searchInviteCandidates(input: {
  cursor?: string | null;
  eventId: string;
  query: string;
  shortlistId: string | null;
}): Promise<CandidatesPage> {
  return mapCandidatesPage(
    await selectionEventsRpc<unknown>("search_selection_event_candidates", {
      p_cursor: input.cursor ?? null,
      p_event_id: input.eventId,
      p_limit: 20,
      p_query: input.query.trim() ? input.query.trim() : null,
      p_shortlist_id: input.shortlistId,
    }),
  );
}

const OUTCOMES: readonly InviteOutcome[] = [
  "sent",
  "already_invited",
  "already_confirmed",
  "pending_request",
  "unavailable",
];

export function mapInviteResult(value: unknown): InviteResult {
  const raw = obj(value);

  if (!raw) {
    throw new SelectionEventsError("UNKNOWN");
  }

  return {
    confirmedCount: int(raw.confirmed_count) ?? 0,
    invitedCount: int(raw.invited_count) ?? 0,
    items: (Array.isArray(raw.items) ? raw.items : []).flatMap((entry) => {
      const item = obj(entry);
      const outcome = item?.outcome as InviteOutcome;

      return item && OUTCOMES.includes(outcome)
        ? [{ fullName: text(item.full_name), outcome, personId: text(item.person_id) }]
        : [];
    }),
    pendingCount: int(raw.pending_count) ?? 0,
    replayed: raw.replayed === true,
    sentCount: int(raw.sent_count) ?? 0,
    skippedCount: int(raw.skipped_count) ?? 0,
  };
}

/**
 * `sendEventInvitations` di §16. `clubId` è il contesto atteso: un invio
 * partito prima di un cambio di Società viene rifiutato dal server (§12).
 */
export async function sendEventInvitations(input: {
  clubId: string;
  eventId: string;
  idempotencyKey: string;
  message: string | null;
  personIds: readonly string[];
}): Promise<InviteResult> {
  return mapInviteResult(
    await selectionEventsRpc<unknown>("send_selection_event_invitations", {
      p_club_id: input.clubId,
      p_event_id: input.eventId,
      p_idempotency_key: input.idempotencyKey,
      p_message: input.message,
      p_person_ids: [...input.personIds],
    }),
  );
}

export function mapInvitableEvents(value: unknown): InvitableEvent[] {
  const raw = obj(value) ?? {};

  return (Array.isArray(raw.items) ? raw.items : []).flatMap((entry) => {
    const item = obj(entry);
    const id = item ? text(item.event_id) : null;

    return item && id
      ? [
          {
            endTime: hm(item.end_time),
            eventId: id,
            eventType:
              item.event_type === "tryout" || item.event_type === "stage" || item.event_type === "open_day"
                ? item.event_type
                : null,
            participationMode:
              item.participation_mode === "open_registration" || item.participation_mode === "invite_only"
                ? item.participation_mode
                : null,
            startDate: civil(item.start_date),
            startTime: hm(item.start_time),
            teamName: text(item.team_name) ?? "",
            timezone: text(item.timezone) ?? "Europe/Rome",
            title: text(item.title) ?? "",
          },
        ]
      : [];
  });
}

export async function fetchInvitableEvents(clubId: string, personId: string): Promise<InvitableEvent[]> {
  return mapInvitableEvents(
    await selectionEventsRpc<unknown>("fetch_invitable_selection_events", {
      p_club_id: clubId,
      p_person_id: personId,
    }),
  );
}

/** §17: la micro-CTA esiste solo se il server dice di sì. */
export async function fetchProfileEventInviteState(clubId: string, personId: string): Promise<boolean> {
  const raw = obj(
    await selectionEventsRpc<unknown>("fetch_profile_event_invite_state", {
      p_club_id: clubId,
      p_person_id: personId,
    }),
  );

  return raw?.available === true;
}

/**
 * Identità mostrabile della persona invitata dal profilo (§17): solo nome,
 * avatar e ruolo, letti con le policy del profilo. Nessun dato privato.
 */
export async function fetchInvitePerson(personId: string): Promise<{
  avatarUrl: string | null;
  fullName: string;
  personId: string;
  role: string | null;
} | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role")
    .eq("id", personId)
    .maybeSingle();

  if (error) {
    throw new SelectionEventsError("UNKNOWN", [], error.message);
  }

  const raw = obj(data);
  const id = raw ? text(raw.id) : null;

  return raw && id
    ? { avatarUrl: text(raw.avatar_url), fullName: text(raw.full_name) ?? "", personId: id, role: text(raw.role) }
    : null;
}
