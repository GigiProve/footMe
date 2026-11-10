import { Stack } from "expo-router";

import { DashboardIdentityProvider } from "../../src/features/dashboard/identity/DashboardIdentityProvider";

/**
 * Wizard «Crea gruppo» (DAS-REV-32 §13): flusso full-screen senza bottom
 * navigation, quindi fuori dalle tab come `app/event-compose/`. Il provider di
 * identità è ripetuto qui perché un flusso fuori dalle tab non eredita quello
 * della Dashboard. Una sola schermata: i tre step sono stato interno.
 */
export default function GroupComposeLayout() {
  return (
    <DashboardIdentityProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </DashboardIdentityProvider>
  );
}
