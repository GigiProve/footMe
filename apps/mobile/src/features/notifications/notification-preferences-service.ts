/**
 * HOM-14 §196 — accesso dati alle Preferenze notifiche. Persistenza lato server,
 * quindi sincronizzata tra device. Il mapping del jsonb sta in
 * `notification-preferences-presentation.ts`.
 */
import { supabase } from "../../lib/supabase";
import { parseNotificationPreferences } from "./notification-preferences-presentation";
import type {
  NotificationPreferenceKey,
  NotificationPreferences,
} from "./notification-preferences-types";

export type {
  NotificationPreferenceKey,
  NotificationPreferences,
} from "./notification-preferences-types";

export async function fetchMyNotificationPreferences(): Promise<NotificationPreferences> {
  const { data, error } = await supabase.rpc("fetch_my_notification_preferences");

  if (error) {
    throw error;
  }

  return parseNotificationPreferences(data);
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
