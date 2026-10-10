/**
 * Apertura del link di invito (master 07).
 *
 * Route pubblica: §18 la vuole raggiungibile «senza contesto autenticato
 * sufficiente» e priva di chrome Dashboard. Sta quindi fuori dalle tab e
 * fuori da `app/society-link/`, che presuppone una Società corrente.
 */
import { useLocalSearchParams, useRouter } from "expo-router";

import { DashboardGlobalError } from "../../src/features/dashboard/components/DashboardStates";
import { SocietyInviteScreen } from "../../src/features/network/invite/SocietyInviteScreen";

export default function SocietyInviteRoute() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

  if (!token) {
    return (
      <DashboardGlobalError
        body="Chiedi alla società un nuovo link."
        onRetry={() => router.replace("/" as never)}
        title="Questo invito non è più disponibile"
      />
    );
  }

  return <SocietyInviteScreen token={token} />;
}
