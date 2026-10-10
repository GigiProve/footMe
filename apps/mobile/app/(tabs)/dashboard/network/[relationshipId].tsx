/**
 * Dettaglio collegamento (master 08 e 09) e dettaglio storico.
 *
 * La Società corrente arriva dall'identità Dashboard condivisa dallo Stack:
 * §4 vieta un selector di identità dentro questi flussi, e leggerla dalla
 * route la renderebbe manipolabile.
 */
import { useLocalSearchParams, useRouter } from "expo-router";

import { useDashboardIdentity } from "../../../../src/features/dashboard/identity/use-dashboard-identity";
import { DashboardGlobalError } from "../../../../src/features/dashboard/components/DashboardStates";
import { RelationshipDetailScreen } from "../../../../src/features/network/RelationshipDetailScreen";

export default function RelationshipDetailRoute() {
  const router = useRouter();
  const { relationshipId } = useLocalSearchParams<{ relationshipId: string }>();
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;

  if (!clubId || !relationshipId) {
    return (
      <DashboardGlobalError
        body="Seleziona una società per aprire il collegamento."
        onRetry={() => router.back()}
        title="Collegamento non disponibile"
      />
    );
  }

  return (
    <RelationshipDetailScreen clubId={clubId} relationshipId={relationshipId} />
  );
}
