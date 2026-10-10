import { Stack } from "expo-router";

import { DashboardIdentityProvider } from "../../../src/features/dashboard/identity/DashboardIdentityProvider";

/**
 * Stack annidato nella tab Dashboard (DAS-REV-08 §4).
 *
 * Il Centro Squadre deve mostrare la bottom navigation **con Dashboard
 * selezionata**. Una route sorella nelle tab (`href: null`) l'avrebbe mostrata
 * senza nessuna tab attiva; una route fuori dalle tab non l'avrebbe mostrata
 * affatto. Un figlio della tab è l'unica forma che soddisfa entrambe le cose.
 *
 * Il provider di identità sale qui dalla sola `index`: è lo stesso contesto —
 * quale Società si sta gestendo — e condividerlo evita che il Centro debba
 * rileggerlo o, peggio, sceglierlo per conto proprio. Resta comunque locale
 * alla Dashboard: Home, Cerca, Messaggi e Profilo non lo vedono.
 */
export default function DashboardLayout() {
  return (
    <DashboardIdentityProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="teams" />
        <Stack.Screen name="team/[teamId]" />
        {/* DAS-REV-10 §9: le tre viste di consultazione di Stagioni e
            storico sono figlie della stessa tab — bottom navigation
            visibile, Dashboard selezionata. I flussi focalizzati stanno
            invece in app/team-seasons/. */}
        <Stack.Screen name="seasons/index" />
        <Stack.Screen name="seasons/inactive" />
        <Stack.Screen name="seasons/[teamId]" />
      </Stack>
    </DashboardIdentityProvider>
  );
}
