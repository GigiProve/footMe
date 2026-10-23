/**
 * Apertura del link (screen 06).
 *
 * Route pubblica: §13 la vuole raggiungibile senza sessione, con wordmark
 * PROLINK e senza shell Dashboard. Sta quindi fuori dalle tab.
 */
import { useLocalSearchParams, useRouter } from "expo-router";

import { DashboardGlobalError } from "../../src/features/dashboard/components/DashboardStates";
import { AdminInviteLandingScreen } from "../../src/features/dashboard/admins/invite/AdminInviteLandingScreen";

export default function AdminInviteLandingRoute() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

  if (!token) {
    return (
      <DashboardGlobalError
        body="Chiedi alla società un nuovo link."
        onRetry={() => router.replace("/" as never)}
        title="Invito non disponibile"
      />
    );
  }

  return <AdminInviteLandingScreen token={token} />;
}
