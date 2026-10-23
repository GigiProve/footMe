import { Stack } from "expo-router";

import { DashboardIdentityProvider } from "../../src/features/dashboard/identity/DashboardIdentityProvider";

/**
 * Dettaglio gestionale di una Position (DAS-REV-15 §18).
 *
 * Flusso focalizzato, come `society-admin/` e `club-roles/`: il dettaglio di
 * una singola risorsa non è un livello della bottom navigation.
 *
 * Il provider di identità sale qui perché la schermata appartiene al
 * contesto gestionale della Società, anche quando vi si arriva da un deep
 * link: senza di esso il dettaglio non saprebbe quale Society sta
 * amministrando al ritorno.
 */
export default function SocietyPositionLayout() {
  return (
    <DashboardIdentityProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="[id]" />
      </Stack>
    </DashboardIdentityProvider>
  );
}
