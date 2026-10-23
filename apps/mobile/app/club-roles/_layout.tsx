import { Stack } from "expo-router";

import { DashboardIdentityProvider } from "../../src/features/dashboard/identity/DashboardIdentityProvider";

/**
 * Editor dei ruoli (screen 02 e 03).
 *
 * §4: «gli screen 02–12 sono flussi focalizzati senza bottom navigation».
 * Vivono quindi fuori dalle tab, e portano con sé il contesto di identità
 * come i flussi di `admin-invite/`.
 *
 * Il livello granulare (screen 05) non ha una route: è una superficie a
 * schermo intero montata dentro l'editor, perché §30 chiede che il ritorno
 * dal granulare non perda il draft del parent.
 */
export default function ClubRolesLayout() {
  return (
    <DashboardIdentityProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="editor" />
      </Stack>
    </DashboardIdentityProvider>
  );
}
