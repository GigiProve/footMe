/** Riepilogo prima dell'invio (master 06). */
import { useLocalSearchParams, useRouter } from "expo-router";

import { DashboardGlobalError } from "../../src/features/dashboard/components/DashboardStates";
import { RoleRequestReviewScreen } from "../../src/features/role-link/request/RoleRequestReviewScreen";

export default function RoleRequestReviewRoute() {
  const router = useRouter();
  const { clubId } = useLocalSearchParams<{ clubId?: string }>();

  if (typeof clubId !== "string" || clubId.length === 0) {
    return (
      <DashboardGlobalError
        body="Torna al form e controlla i dati."
        onRetry={() => router.back()}
        title="Riepilogo non disponibile"
      />
    );
  }

  return <RoleRequestReviewScreen clubId={clubId} />;
}
