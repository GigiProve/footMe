import { Stack } from "expo-router";

/**
 * Stack annidato nella tab Profilo (DAS-REV-21 §6).
 *
 * «Nel PNG la navigation compare negli screen 01,09,13,14,18,21. Sono
 * selezionate rispettivamente Cerca, Dashboard, Profilo, Profilo, Profilo,
 * Dashboard.» Gli screen 13, 14 e 18 sono quindi pagine della tab Profilo con
 * la bottom navigation visibile: come il Centro Squadre nella Dashboard, sono
 * figlie della tab e non route sorelle con `href: null` — quelle mostrerebbero
 * la barra senza nessuna tab attiva.
 *
 * Il dettaglio del singolo incarico (screen 15), i form e le conferme restano
 * flussi focalizzati in `app/role-link/`: il PNG non vi mostra la bottom
 * navigation, e §6 vuole «la shell focalizzata con back e safe area».
 */
export default function ProfileTabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="societies/index" />
      <Stack.Screen name="societies/[clubId]" />
    </Stack>
  );
}
