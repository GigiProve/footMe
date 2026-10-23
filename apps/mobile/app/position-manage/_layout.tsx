import { Stack } from "expo-router";

import { DashboardIdentityProvider } from "../../src/features/dashboard/identity/DashboardIdentityProvider";

/**
 * Editor e anteprima di una Position esistente (DAS-REV-17 §6).
 *
 * «Editor e anteprima sono flussi focalizzati senza bottom navigation.» Per
 * questo le route vivono qui e non sotto `app/(tabs)/dashboard/`, come già
 * fanno `position-compose/`, `society-admin/` e `club-roles/`.
 *
 * Nessun `ComposeSessionProvider`: §2 — «Mantieni distinti i percorsi: la
 * creazione di una nuova Position resta nel composer; questa task gestisce
 * un oggetto già persistito.» Una sessione di creazione qui riporterebbe il
 * riepilogo e i ritorni del batch su una bozza aperta dal Centro.
 *
 * Il provider di identità resta perché la schermata appartiene al contesto
 * gestionale della Società anche quando vi si arriva da un deep link.
 */
export default function PositionManageLayout() {
  return (
    <DashboardIdentityProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="[id]/edit" />
        <Stack.Screen name="[id]/preview" />
      </Stack>
    </DashboardIdentityProvider>
  );
}
