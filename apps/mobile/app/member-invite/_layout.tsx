import { Stack, useLocalSearchParams } from "expo-router";

import { DashboardIdentityProvider } from "../../src/features/dashboard/identity/DashboardIdentityProvider";
import { InviteComposeProvider } from "../../src/features/dashboard/invites/compose/InviteComposeProvider";

/**
 * Composer dell'invito sportivo (DAS-REV-19 §6, §16).
 *
 * «Il composer Persona/Collegamento/Riepilogo è focalizzato e non mostra
 * bottom navigation»: sta quindi fuori dalle tab, non dentro con
 * `href: null` — una route sorella mostrerebbe comunque la barra.
 *
 * Il provider di identità è montato qui perché queste route sono **sorelle**
 * delle tab, non discendenti: senza, `useDashboardIdentity()` non trova
 * nessun contesto. Non è una seconda "current society" — risolve la stessa
 * preferenza persistita per actor che il Centro ha lasciato.
 *
 * `InviteComposeProvider` tiene lo stato non inviato dei tre passi: §16
 * vieta che l'apertura, la ricerca o il cambio passo creino un pending.
 */
export default function MemberInviteLayout() {
  const params = useLocalSearchParams<{ teamId?: string }>();

  return (
    <DashboardIdentityProvider>
      <InviteComposeProvider
        initialTeamId={
          typeof params.teamId === "string" && params.teamId
            ? params.teamId
            : null
        }
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="search" />
          <Stack.Screen name="configure" />
          <Stack.Screen name="review" />
        </Stack>
      </InviteComposeProvider>
    </DashboardIdentityProvider>
  );
}
