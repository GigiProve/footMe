import { useLocalSearchParams } from "expo-router";

import { NotificationCenterScreen } from "../src/features/notifications/NotificationCenterScreen";

/**
 * HOM-14 §177: `?open=<notification_id>` arriva dal tap su un push. La logica
 * (marcare aperta, risolvere il target) vive nel modulo notifiche.
 */
export default function NotificationsRoute() {
  const { open } = useLocalSearchParams<{ open?: string | string[] }>();
  const notificationId = Array.isArray(open) ? open[0] : open;

  return <NotificationCenterScreen openNotificationId={notificationId || null} />;
}
