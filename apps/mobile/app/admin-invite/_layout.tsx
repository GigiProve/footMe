import { Stack } from "expo-router";

import { DashboardIdentityProvider } from "../../src/features/dashboard/identity/DashboardIdentityProvider";

/**
 * Flussi focalizzati dell'invito amministrativo (DAS-REV-13 §6).
 *
 * Il provider di identità vive nello Stack della tab Dashboard, e queste
 * route sono **sorelle** delle tab, non discendenti: senza un provider
 * proprio `useDashboardIdentity()` non trova nessun contesto e le schermate
 * del composer falliscono al mount. Il layout mancava, e con esso il
 * contesto.
 *
 * Non è un secondo "current society": il provider risolve dalla preferenza
 * persistita per actor (`identity-preference`), quindi la Società è quella
 * che il Centro ha lasciato. DAS-REV-13 §22 vieta uno stato condiviso
 * mutabile fra device, non un secondo lettore della stessa preferenza.
 *
 * La landing pubblica `[token]` non legge il contesto e resta invariata: con
 * un visitatore non autenticato il provider non esegue nessuna query, e §13
 * vieta di **selezionare** una Società prima dell'accettazione, non di
 * montare il contesto della persona già autenticata.
 */
export default function AdminInviteLayout() {
  return (
    <DashboardIdentityProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="[token]" />
        <Stack.Screen name="search" />
        <Stack.Screen name="configure" />
        <Stack.Screen name="external" />
        <Stack.Screen name="review" />
      </Stack>
    </DashboardIdentityProvider>
  );
}
