/** La propria richiesta in attesa o terminale (master 07, 08). */
import { useLocalSearchParams, useRouter } from "expo-router";

import { DashboardGlobalError } from "../../../src/features/dashboard/components/DashboardStates";
import { MyRoleRequestScreen } from "../../../src/features/role-link/request/MyRoleRequestScreen";

export default function MyRoleRequestRoute() {
  const router = useRouter();
  const { requestId } = useLocalSearchParams<{ requestId?: string }>();

  if (typeof requestId !== "string" || requestId.length === 0) {
    return (
      <DashboardGlobalError
        body="Riapri la richiesta dal profilo della società."
        onRetry={() => router.back()}
        title="Richiesta non disponibile"
      />
    );
  }

  return <MyRoleRequestScreen requestId={requestId} />;
}
