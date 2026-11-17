import { useLocalSearchParams } from "expo-router";

import { conversationLinkFromParams } from "../src/features/notifications/conversation-target-presentation";
import { NotificationCenterScreen } from "../src/features/notifications/NotificationCenterScreen";

type Param = string | string[] | undefined;

function first(value: Param): string | null {
  return (Array.isArray(value) ? value[0] : value) || null;
}

/**
 * HOM-14 §177: `?open=<notification_id>` arriva dal tap su un push. La logica
 * (marcare aperta, risolvere il target) vive nel modulo notifiche.
 *
 * DAS-REV-34 §293: `?conversation=<id>&period=<id>&intent=<intent>` è il path opaco
 * di un tap su una push chat ripreso dopo il login. Solo identificativi validati:
 * la destinazione la decide il server.
 */
export default function NotificationsRoute() {
  const { conversation, intent, open, period } = useLocalSearchParams<{
    conversation?: Param;
    intent?: Param;
    open?: Param;
    period?: Param;
  }>();

  return (
    <NotificationCenterScreen
      openConversation={conversationLinkFromParams({
        conversation: first(conversation),
        intent: first(intent),
        period: first(period),
      })}
      openNotificationId={first(open)}
    />
  );
}
