import { Stack } from "expo-router";

/**
 * Bozze e programmati (HOM-06.2 §137): schermata unica fuori dalle tab, come
 * `app/post-compose/` — nessuna bottom navigation, nessun header PROLINK. Il
 * ritorno è `router.back()` verso la superficie da cui si è partiti (il «+» della
 * Home, una notifica).
 */
export default function DraftsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
