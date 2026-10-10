/** Configura la richiesta (master 04). */
import { useLocalSearchParams, useRouter } from "expo-router";

import { DashboardGlobalError } from "../../src/features/dashboard/components/DashboardStates";
import { LinkConfigureScreen } from "../../src/features/network/link/LinkConfigureScreen";

export default function SocietyLinkConfigureRoute() {
  const router = useRouter();
  const { clubId, targetClubId } = useLocalSearchParams<{
    clubId?: string;
    targetClubId?: string;
  }>();

  if (!clubId || !targetClubId) {
    return (
      <DashboardGlobalError
        body="Riapri la ricerca dalla rete societaria."
        onRetry={() => router.back()}
        title="Richiesta non disponibile"
      />
    );
  }

  return <LinkConfigureScreen clubId={clubId} targetClubId={targetClubId} />;
}
