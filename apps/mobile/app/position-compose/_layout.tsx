import { Stack } from "expo-router";
import { useLocalSearchParams } from "expo-router";

import { DashboardIdentityProvider } from "../../src/features/dashboard/identity/DashboardIdentityProvider";
import { ComposeSessionProvider } from "../../src/features/dashboard/positions/compose/ComposeSessionProvider";
import type { ComposeOrigin } from "../../src/features/dashboard/positions/compose/compose-routes";

/**
 * Flusso focalizzato «Nuova posizione» (DAS-REV-16 §4).
 *
 * «Questo è un flusso focalizzato: nessuna bottom navigation, nessuna
 * seconda shell Dashboard, FAB, campanella o menu generale sopra i campi.»
 * Per questo le route vivono qui e non sotto `app/(tabs)/dashboard/`, come
 * già fanno `society-admin/`, `club-roles/` e `admin-invite/`.
 *
 * Due provider, due ragioni diverse:
 *
 *   * `DashboardIdentityProvider` tiene la Società del contesto gestionale,
 *     che §5 vuole **fissa per la sessione di creazione**;
 *   * `ComposeSessionProvider` tiene la proposta dello step 1 e gli ID
 *     creati, che devono sopravvivere al passaggio fra le tre fasi — §4:
 *     «Il numero di route interne non cambia il significato dei tre
 *     passaggi.»
 *
 * I parametri di ingresso sono letti qui perché la sessione nasce con essi:
 * §5 — «Un Team esplicitamente scelto nel Centro viene proposto nel
 * composer», e un ingresso dal filtro Intera società può preimpostare
 * l'ambito SOCIETY.
 */
export default function PositionComposeLayout() {
  const params = useLocalSearchParams<{
    from?: string;
    scope?: string;
    teamId?: string;
  }>();

  const origin: ComposeOrigin =
    params.from === "dashboard" || params.from === "team" ? params.from : "center";

  return (
    <DashboardIdentityProvider>
      <ComposeSessionProvider
        initialScope={params.scope === "society" ? "society" : "team"}
        initialTeamId={typeof params.teamId === "string" ? params.teamId : null}
        origin={origin}
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="hub" />
          <Stack.Screen name="details/[positionId]" />
          <Stack.Screen name="preview/index" />
          <Stack.Screen name="preview/[positionId]" />
        </Stack>
      </ComposeSessionProvider>
    </DashboardIdentityProvider>
  );
}
