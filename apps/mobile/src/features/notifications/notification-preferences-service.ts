import { supabase } from "../../lib/supabase";

export type NotificationPreferenceKey =
  | "requests"
  | "applications"
  | "content_tags"
  | "new_followers"
  | "store"
  | "promotions";

export type NotificationPreferences = {
  profile_id: string;
  requests: boolean;
  applications: boolean;
  content_tags: boolean;
  new_followers: boolean;
  store: boolean;
  promotions: boolean;
};

export async function fetchMyNotificationPreferences(): Promise<NotificationPreferences> {
  const { data, error } = await supabase.rpc(
    "fetch_my_notification_preferences",
  );

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row as NotificationPreferences;
}

export async function setNotificationPreference(
  key: NotificationPreferenceKey,
  value: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("set_notification_preference", {
    p_key: key,
    p_value: value,
  });

  if (error) {
    throw error;
  }
}
