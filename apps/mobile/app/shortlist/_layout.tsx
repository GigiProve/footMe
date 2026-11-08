import { Stack } from "expo-router";

import { DashboardIdentityProvider } from "../../src/features/dashboard/identity/DashboardIdentityProvider";

/**
 * Stack storico `/shortlist`.
 *
 * DAS-REV-27 §19: ospita il recupero amministrativo, superficie focalizzata
 * senza bottom navigation (§4). Il provider di identità sale qui come in
 * `society-position/`: il recupero appartiene al contesto gestionale della
 * Società anche quando vi si arriva da un deep link. `index` e `[listId]`
 * sono deep link che reindirizzano alla tab Dashboard.
 */
export default function ShortlistLayout() {
  return (
    <DashboardIdentityProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="[listId]" />
        <Stack.Screen name="entry/[entryId]" />
        <Stack.Screen name="recovery/index" />
        <Stack.Screen name="recovery/[listId]" />
      </Stack>
    </DashboardIdentityProvider>
  );
}
