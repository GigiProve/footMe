/** Il rapporto con una società (master 14, 18, 20) — tab Profilo. */
import { useLocalSearchParams, useRouter } from "expo-router";

import { DashboardGlobalError } from "../../../../src/features/dashboard/components/DashboardStates";
import { SocietyRolesScreen } from "../../../../src/features/role-link/roles/SocietyRolesScreen";

export default function MySocietyRolesRoute() {
  const router = useRouter();
  const { clubId } = useLocalSearchParams<{ clubId?: string }>();

  if (typeof clubId !== "string" || clubId.length === 0) {
    return (
      <DashboardGlobalError
        body="Riapri la società da Società e ruoli."
        onRetry={() => router.back()}
        title="Rapporto non disponibile"
      />
    );
  }

  return <SocietyRolesScreen clubId={clubId} />;
}
