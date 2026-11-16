/**
 * HOM-14 — accesso dati del Centro Notifiche (§113–§123, §143, §216, §222).
 *
 * Tutto passa da RPC già scritte e testate lato backend: timeline keyset,
 * badge (unità nuove, non eventi grezzi, §213), apertura del Centro (cutoff =
 * ora del server, §15–§16), apertura della singola notifica, cancellazione
 * delle sole APERTE. Il client non genera mai notifiche (§171).
 *
 * `fetchNotificationTargetSource` è la sola lettura diretta della tabella: una
 * select puntuale per id (RLS proprietario) per il tap da push (§167), che
 * porta solo l'id della notifica e deve comunque passare dal Target Resolver.
 */

import { supabase } from "../../lib/supabase";
import type {
  InboxNotification,
  NotificationCursor,
  NotificationIdentityType,
  NotificationPage,
  NotificationTarget,
  NotificationTargetSource,
  NotificationTargetType,
} from "./notification-types";

export const NOTIFICATION_PAGE_SIZE = 30;

type TimelineRow = {
  n_actor_available: boolean | null;
  n_actor_avatar_url: string | null;
  n_actor_id: string | null;
  n_actor_name: string | null;
  n_actor_type: string | null;
  n_actor_verified: boolean | null;
  n_as_of: string | null;
  n_body: string | null;
  n_category: string | null;
  n_created_at: string;
  n_data: Record<string, unknown> | null;
  n_display_at: string;
  n_event_count: number | null;
  n_has_more: boolean | null;
  n_id: string;
  n_is_new: boolean | null;
  n_is_opened: boolean | null;
  n_preview: string | null;
  n_recipient_id: string | null;
  n_recipient_managed: boolean | null;
  n_recipient_name: string | null;
  n_recipient_type: string | null;
  n_revision: number | null;
  n_target_id: string | null;
  n_target_params: Record<string, unknown> | null;
  n_target_type: string | null;
  n_title: string | null;
  n_type: string;
};

const IDENTITY_TYPES: readonly string[] = ["person", "media", "society"];
const TARGET_TYPES: readonly string[] = ["profile", "content", "comment", "scheduled_content"];

function identityType(value: string | null): NotificationIdentityType | null {
  return value && IDENTITY_TYPES.includes(value) ? (value as NotificationIdentityType) : null;
}

function targetOf(
  type: string | null,
  id: string | null,
  params: Record<string, unknown> | null,
): NotificationTarget | null {
  if (!type || !id || !TARGET_TYPES.includes(type)) {
    return null;
  }

  return { id, params: params ?? {}, type: type as NotificationTargetType };
}

export function mapTimelineRow(row: TimelineRow): InboxNotification {
  const actorType = identityType(row.n_actor_type);
  const recipientType = identityType(row.n_recipient_type);

  return {
    actor:
      actorType && row.n_actor_id
        ? {
            available: row.n_actor_available === true,
            avatarUrl: row.n_actor_avatar_url,
            id: row.n_actor_id,
            name: row.n_actor_name,
            type: actorType,
            verified: row.n_actor_verified === true,
          }
        : null,
    body: row.n_body,
    category: row.n_category,
    createdAt: row.n_created_at,
    data: row.n_data ?? {},
    displayAt: row.n_display_at,
    eventCount: row.n_event_count ?? 1,
    id: row.n_id,
    isNew: row.n_is_new === true,
    isOpened: row.n_is_opened === true,
    preview: row.n_preview,
    recipient:
      recipientType && row.n_recipient_id
        ? {
            id: row.n_recipient_id,
            managed: row.n_recipient_managed === true,
            name: row.n_recipient_name,
            type: recipientType,
          }
        : null,
    revision: row.n_revision ?? 1,
    target: targetOf(row.n_target_type, row.n_target_id, row.n_target_params),
    title: row.n_title ?? "",
    type: row.n_type,
  };
}

/** Una pagina della timeline, dal cursore (assente = prima pagina). */
export async function fetchNotificationPage(
  cursor: NotificationCursor | null,
  limit = NOTIFICATION_PAGE_SIZE,
): Promise<NotificationPage> {
  const { data, error } = await supabase.rpc("fetch_notification_timeline", {
    p_before_at: cursor?.beforeAt ?? null,
    p_before_id: cursor?.beforeId ?? null,
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as TimelineRow[];

  return {
    // L'ora del server è uguale su ogni riga; con la pagina vuota non c'è nulla da vedere.
    asOf: rows[0]?.n_as_of ?? null,
    hasMore: rows[0]?.n_has_more === true,
    items: rows.map(mapTimelineRow),
  };
}

/** Il badge della campanella: unità di inbox nuove dall'ultima apertura del Centro (§5–§7, §213). */
export async function fetchNotificationBadgeCount(): Promise<number> {
  const { data, error } = await supabase.rpc("fetch_notification_badge_count");

  if (error) {
    throw error;
  }

  return typeof data === "number" ? data : 0;
}

/**
 * §14–§16: marca VISTE le notifiche fino al cutoff. `asOf` è l'ora del server
 * della prima pagina, mai l'orologio del device: una riga arrivata dopo resta NEW.
 */
export async function markNotificationCenterSeen(asOf: string | null): Promise<number> {
  const { data, error } = await supabase.rpc("mark_notification_center_seen", {
    p_cutoff: asOf,
  });

  if (error) {
    throw error;
  }

  return typeof data === "number" ? data : 0;
}

/**
 * §9, §121, §177: apertura della singola notifica. Con `revision` il server
 * rifiuta (false) se nel frattempo l'aggregato ha nuova attività; senza (tap da
 * push) apre la revisione corrente.
 */
export async function markNotificationOpened(
  notificationId: string,
  revision: number | null = null,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("mark_notification_opened", {
    p_id: notificationId,
    p_revision: revision,
  });

  if (error) {
    throw error;
  }

  return data === true;
}

/** Cancella le sole notifiche APERTE (§234: nessun archivio; la lettura non basta). */
export async function deleteOpenedNotifications(): Promise<number> {
  const { data, error } = await supabase.rpc("delete_read_notifications");

  if (error) {
    throw error;
  }

  return typeof data === "number" ? data : 0;
}

type TargetSourceRow = {
  actor_identity_id: string | null;
  actor_identity_type: string | null;
  data: Record<string, unknown> | null;
  target_id: string | null;
  target_params: Record<string, unknown> | null;
  target_type: string | null;
  type: string;
};

/**
 * Select puntuale dei soli campi necessari alla destinazione (§146, §167). Null
 * se la riga non esiste più o non è dell'account (RLS): il chiamante apre il
 * Centro, senza errori tecnici (§157).
 */
export async function fetchNotificationTargetSource(
  notificationId: string,
): Promise<NotificationTargetSource | null> {
  const { data, error } = await supabase
    .from("notifications")
    .select("type, data, target_type, target_id, target_params, actor_identity_type, actor_identity_id")
    .eq("id", notificationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as TargetSourceRow;
  const actorType = identityType(row.actor_identity_type);

  return {
    actor:
      actorType && row.actor_identity_id
        ? {
            available: true,
            avatarUrl: null,
            id: row.actor_identity_id,
            name: null,
            type: actorType,
            verified: false,
          }
        : null,
    data: row.data ?? {},
    target: targetOf(row.target_type, row.target_id, row.target_params),
    type: row.type,
  };
}
