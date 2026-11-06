/**
 * Landing pubblica del link di squadra (DAS-REV-20, screen 06 e 12).
 *
 * È l'unica route del pack che contiene una guardia, perché deve funzionare
 * **senza contesto autenticato**: §19 vuole che l'invito sia comprensibile
 * prima di chiedere l'accesso, e §20 che un token assente non porti a una
 * pagina rotta.
 *
 * Nessun provider di identità e nessuna bottom navigation: §6 vieta che
 * aprire un invito renda disponibile la Dashboard della Società invitante.
 */
import { useLocalSearchParams, router } from "expo-router";

import { DashboardGlobalError } from "../../src/features/dashboard/components/DashboardStates";
import { TeamJoinLandingScreen } from "../../src/features/dashboard/join-links/join/TeamJoinLandingScreen";

export default function TeamInviteRoute() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token =
    typeof params.token === "string" && params.token ? params.token : null;

  if (!token) {
    return (
      <DashboardGlobalError
        body="Chiedi alla società un nuovo invito."
        onRetry={() => router.replace("/")}
        title="Invito non più disponibile"
      />
    );
  }

  return <TeamJoinLandingScreen />;
}
