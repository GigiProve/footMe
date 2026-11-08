import { Stack } from "expo-router";

import { DashboardIdentityProvider } from "../../src/features/dashboard/identity/DashboardIdentityProvider";

/**
 * Invita profili / Invita a evento (DAS-REV-30 §5, §13-§17; screen 02-06,
 * 20, 24).
 *
 * «Selector, composer e conferme sono flussi focalizzati: nessuna bottom
 * navigation interattiva» — per questo la route sta fuori dalle tab, come
 * `app/event-compose/`. Il provider di identità è ripetuto perché un flusso
 * fuori dalle tab non eredita quello della Dashboard: l'invito parte sempre
 * dalla Società attiva (§12).
 *
 * Una sola schermata: selezione, conferma ed esito sono stato interno, così
 * Indietro conserva selezione e messaggio senza inviare (§15).
 */
export default function EventInviteLayout() {
  return (
    <DashboardIdentityProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </DashboardIdentityProvider>
  );
}
