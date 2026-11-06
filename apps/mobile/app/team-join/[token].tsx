/**
 * Percorso della PERSON autenticata sullo stesso link (DAS-REV-20,
 * screen 07-11).
 *
 * Il token sta nel **path** e non in un provider: §20 chiede che il link
 * sopravviva a login, registrazione, onboarding e avvio a freddo, e uno
 * stato in memoria non sopravvive a nessuno dei quattro.
 *
 * §6: «Il successo apre il suo profilo personale e non la Dashboard della
 * società invitante» — qui non c'è nessun contesto Society.
 */
import { useLocalSearchParams, router } from "expo-router";

import { DashboardGlobalError } from "../../src/features/dashboard/components/DashboardStates";
import { TeamJoinScreen } from "../../src/features/dashboard/join-links/join/TeamJoinScreen";

export default function TeamJoinRoute() {
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

  return <TeamJoinScreen />;
}
