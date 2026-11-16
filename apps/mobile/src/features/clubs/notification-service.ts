import { supabase } from "../../lib/supabase";
import type { AppNotification } from "./membership-types";

/**
 * Ultime notifiche per l'anteprima della Dashboard personale (legacy).
 *
 * HOM-14: il Centro Notifiche, il badge e i comandi seen/opened/delete vivono in
 * `features/notifications/notification-service.ts` (RPC dedicate). Qui resta la
 * sola lettura di anteprima: titolo e corpo, nessuno stato letto/non letto.
 * `mark_all_notifications_read` non esiste più (§18).
 */
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
