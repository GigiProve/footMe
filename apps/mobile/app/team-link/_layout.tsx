import { Stack, useLocalSearchParams } from "expo-router";

import { DashboardIdentityProvider } from "../../src/features/dashboard/identity/DashboardIdentityProvider";
import { JoinLinkComposeProvider } from "../../src/features/dashboard/join-links/compose/JoinLinkComposeProvider";

/**
 * Composer del link di invito (DAS-REV-20 §6, §11).
 *
 * «Form focalizzati, landing, percorsi della persona, dettagli e conferme
 * seguono il PNG e non mostrano una bottom navigation aggiuntiva»: le route
 * stanno quindi fuori dalle tab, non dentro con `href: null` — una sorella
 * delle tab mostrerebbe comunque la barra.
 *
 * Il provider di identità è montato qui perché queste route sono **sorelle**
 * delle tab, non discendenti: senza, `useDashboardIdentity()` non trova
 * nessun contesto. Non è una seconda "current society": risolve la stessa
 * preferenza persistita per actor che il centro ha lasciato.
 *
 * `JoinLinkComposeProvider` tiene lo stato non inviato dei passi. §11 vieta
 * di creare un record vuoto all'apertura del form: prima di «Genera link»
 * non esiste nessun TeamJoinLink.
 */
export default function TeamLinkLayout() {
  const params = useLocalSearchParams<{ teamId?: string }>();

  return (
    <DashboardIdentityProvider>
      <JoinLinkComposeProvider
        initialTeamId={
          typeof params.teamId === "string" && params.teamId
            ? params.teamId
            : null
        }
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="configure" />
          <Stack.Screen name="roles" />
          <Stack.Screen name="review" />
          <Stack.Screen name="ready/[linkId]" />
        </Stack>
      </JoinLinkComposeProvider>
    </DashboardIdentityProvider>
  );
}
