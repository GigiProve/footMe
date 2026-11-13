import { Stack } from "expo-router";

/**
 * Composer Post (HOM-06.1 §6, §143): Nuovo post e Modifica post.
 *
 * Fuori dalle tab, come `app/event-compose/` e `app/position-compose/`: nessuna
 * bottom navigation, nessun header PROLINK. La presentazione a schermo intero
 * (modale) è dichiarata nel layout radice. Niente `DashboardIdentityProvider`: le
 * identity del composer arrivano da `fetch_post_composer_context` (§18), non
 * dalla Dashboard.
 */
export default function PostComposeLayout() {
  return (
    <Stack screenOptions={{ gestureEnabled: false, headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="edit" />
    </Stack>
  );
}
