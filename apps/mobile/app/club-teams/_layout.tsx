import { Stack } from "expo-router";

/**
 * Creazione e modifica squadra (DAS-REV-08 §4).
 *
 * Flussi focalizzati: stanno **fuori** dal gruppo `(tabs)` perché la bottom
 * navigation non deve comparire. Il back e il titolo contestuale sono l'unica
 * navigazione.
 */
export default function ClubTeamsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="new" />
      <Stack.Screen name="[teamId]" />
    </Stack>
  );
}
