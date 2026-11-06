/** Le proprie richieste verso una società (§11, più proposte aperte). */
import { useLocalSearchParams, useRouter } from "expo-router";

import { DashboardGlobalError } from "../../src/features/dashboard/components/DashboardStates";
import { MyClubRequestsScreen } from "../../src/features/role-link/request/MyClubRequestsScreen";

export default function MyClubRequestsRoute() {
  const router = useRouter();
  const { clubId } = useLocalSearchParams<{ clubId?: string }>();

  if (typeof clubId !== "string" || clubId.length === 0) {
    return (
      <DashboardGlobalError
        body="Riapri l'elenco dal profilo della società."
        onRetry={() => router.back()}
        title="Richieste non disponibili"
      />
    );
  }

  return <MyClubRequestsScreen clubId={clubId} />;
}
