import { Stack } from "expo-router";

import { HistoryDraftProvider } from "../../src/features/teams/seasons/HistoryDraftProvider";

/**
 * Flussi focalizzati di Stagioni e storico (DAS-REV-10 §9).
 *
 * Stanno **fuori** dal gruppo `(tabs)` perché la bottom navigation non deve
 * comparire: §9 elenca gli screen 03, 04, 05, 06, 07 e 10 come «flussi
 * focalizzati senza bottom navigation». Il back e il titolo contestuale sono
 * l'unica navigazione.
 *
 * `HistoryDraftProvider` sale qui perché la bozza dello storico vive fra due
 * route — il form del periodo e il riepilogo — e §21 vuole che il passaggio
 * fra le due la conservi. Resta comunque locale a questo Stack: uscendo dai
 * flussi la bozza non sopravvive, com'è giusto per dati non persistiti.
 */
export default function TeamSeasonsLayout() {
  return (
    <HistoryDraftProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="config" />
        <Stack.Screen name="history-season" />
        <Stack.Screen name="history-period" />
        <Stack.Screen name="history-review" />
        <Stack.Screen name="deactivate" />
        <Stack.Screen name="reactivate" />
      </Stack>
    </HistoryDraftProvider>
  );
}
