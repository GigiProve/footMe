import { supabase } from "../../lib/supabase";
import type { AppNotification } from "./membership-types";

export async function fetchNotifications(
  profileId: string,
  limit = 20,
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, recipient_profile_id, type, title, body, data, is_read, created_at")
    .eq("recipient_profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as AppNotification[];
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) {
    throw error;
  }
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
