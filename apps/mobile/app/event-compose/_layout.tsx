import { Stack } from "expo-router";

import { DashboardIdentityProvider } from "../../src/features/dashboard/identity/DashboardIdentityProvider";

/**
 * Wizard «Crea evento» (DAS-REV-28 §4, §13; screen 04-12).
 *
 * «wizard e selector focalizzati senza bottom navigation»: per questo la
 * route sta fuori dalle tab, come `app/position-compose/`. Il provider di
 * identità è ripetuto qui perché un flusso fuori dalle tab non eredita
 * quello della Dashboard (DAS-REV-13: senza, la Società si perdeva).
 *
 * Una sola schermata: i tre step sono stato interno (§13), non route.
 */
export default function EventComposeLayout() {
  return (
    <DashboardIdentityProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </DashboardIdentityProvider>
  );
}
