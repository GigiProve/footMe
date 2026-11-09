import { supabase } from "../../lib/supabase";
import type { AppNotification } from "./membership-types";

export async function fetchNotifications(
  profileId: string,
  limit = 50,
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, recipient_profile_id, type, title, body, data, is_read, created_at, updated_at, category, revision, aggregate_key",
    )
    .eq("recipient_profile_id", profileId)
    /* DAS-REV-31 §23: un gruppo aggiornato risale in cima. A parità di
       istante l'id rende l'ordine stabile fra due letture. */
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as AppNotification[];
}

/**
 * DAS-REV-31 §24: marca letta la revisione **vista**. Restituisce false se
 * nel frattempo il gruppo ha ricevuto una nuova risposta: la riga resta non
 * letta e il chiamante rilegge il Centro.
 */
export async function markNotificationRead(
  notificationId: string,
  revision: number | null = null,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
    p_revision: revision,
  });

  if (error) {
    throw error;
  }

  return data === true;
}

/**
 * DAS-REV-31 §24: `asOf` è l'aggiornamento più recente che il Centro ha
 * mostrato. Un gruppo che riceve una risposta dopo resta non letto.
 */
export async function markAllNotificationsRead(asOf: string | null = null): Promise<number> {
  const { data, error } = await supabase.rpc("mark_all_notifications_read", { p_as_of: asOf });

  if (error) {
    throw error;
  }

  return (data as number) ?? 0;
}

export async function deleteReadNotifications(): Promise<number> {
  const { data, error } = await supabase.rpc("delete_read_notifications");

  if (error) {
    throw error;
  }

  return (data as number) ?? 0;
}

export async function getUnreadCount(profileId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_profile_id", profileId)
    .eq("is_read", false);

  if (error) {
    throw error;
  }

  return count ?? 0;
}
