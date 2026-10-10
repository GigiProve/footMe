/** Cerca una società (master 03) e sheet di invito (master 06). */
import { useLocalSearchParams, useRouter } from "expo-router";

import { DashboardGlobalError } from "../../src/features/dashboard/components/DashboardStates";
import { LinkSearchScreen } from "../../src/features/network/link/LinkSearchScreen";

export default function SocietyLinkSearchRoute() {
  const router = useRouter();
  const { clubId } = useLocalSearchParams<{ clubId?: string }>();

  if (!clubId) {
    return (
      <DashboardGlobalError
        body="Riapri la rete societaria dalla Dashboard."
        onRetry={() => router.back()}
        title="Società non disponibile"
      />
    );
  }

  return <LinkSearchScreen clubId={clubId} />;
}
