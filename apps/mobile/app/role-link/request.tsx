/** Compilazione della richiesta (master 02, 03, 04, 05). */
import { useLocalSearchParams, useRouter } from "expo-router";

import { DashboardGlobalError } from "../../src/features/dashboard/components/DashboardStates";
import { RoleRequestFormScreen } from "../../src/features/role-link/request/RoleRequestFormScreen";

export default function RoleRequestRoute() {
  const router = useRouter();
  const { clubId } = useLocalSearchParams<{ clubId?: string }>();

  if (typeof clubId !== "string" || clubId.length === 0) {
    return (
      <DashboardGlobalError
        body="Riapri la richiesta dal profilo della società."
        onRetry={() => router.back()}
        title="Richiesta non disponibile"
      />
    );
  }

  return <RoleRequestFormScreen clubId={clubId} />;
}
