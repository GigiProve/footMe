/** Valuta una richiesta (master 05) e dettaglio di una richiesta inviata. */
import { useLocalSearchParams, useRouter } from "expo-router";

import { DashboardGlobalError } from "../../src/features/dashboard/components/DashboardStates";
import { RequestReviewScreen } from "../../src/features/network/link/RequestReviewScreen";

export default function SocietyLinkReviewRoute() {
  const router = useRouter();
  const { clubId, relationshipId } = useLocalSearchParams<{
    clubId?: string;
    relationshipId?: string;
  }>();

  if (!clubId || !relationshipId) {
    return (
      <DashboardGlobalError
        body="Riapri la richiesta dalla rete societaria."
        onRetry={() => router.back()}
        title="Richiesta non disponibile"
      />
    );
  }

  return <RequestReviewScreen clubId={clubId} relationshipId={relationshipId} />;
}
