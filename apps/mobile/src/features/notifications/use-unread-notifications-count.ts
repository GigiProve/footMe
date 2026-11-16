/**
 * HOM-14 §5–§7, §213: il numero sulla campanella, un solo hook per ogni
 * superficie (Home, Cerca, Messaggi, Profilo, Dashboard).
 *
 * Conta le notifiche NUOVE dall'ultima apertura del Centro (unità di inbox, non
 * eventi grezzi), non quelle mai aperte: la fonte è `fetch_notification_badge_count`.
 * La chiave porta l'account (§275) e resta sotto la radice `notifications-unread`
 * già invalidata da blocchi e azioni sulle richieste.
 */

import { useQuery } from "@tanstack/react-query";

import { useSession } from "../auth/use-session";
import { notificationKeys } from "./notification-keys";
import { fetchNotificationBadgeCount } from "./notification-service";

export function useUnreadNotificationsCount() {
  const { profile } = useSession();
  const profileId = profile?.id ?? "";

  const { data } = useQuery({
    enabled: !!profileId,
    queryFn: fetchNotificationBadgeCount,
    queryKey: notificationKeys.badge(profileId),
  });

  return data ?? 0;
}
