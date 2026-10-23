import { Stack } from "expo-router";

import { DashboardIdentityProvider } from "../../src/features/dashboard/identity/DashboardIdentityProvider";

/**
 * Accesso amministrativo di una persona (screen 06–12).
 *
 * Flussi focalizzati senza bottom navigation (§4), con il contesto di
 * identità proprio come `admin-invite/` e `club-roles/`.
 *
 * Il picker delle squadre (screen 08) e la selezione del nuovo Owner
 * (screen 11) non compaiono qui: §16 vieta «una route autonoma per questo
 * elenco» e §19 vuole il pannello sovrapposto al dettaglio che lo ha aperto.
 */
export default function SocietyAdminLayout() {
  return (
    <DashboardIdentityProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="[profileId]" />
        <Stack.Screen name="permissions" />
        <Stack.Screen name="scope" />
        <Stack.Screen name="invite" />
        <Stack.Screen name="transfer" />
      </Stack>
    </DashboardIdentityProvider>
  );
}
