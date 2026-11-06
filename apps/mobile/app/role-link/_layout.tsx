import { Stack } from "expo-router";

import { RoleRequestProvider } from "../../src/features/role-link/request/RoleRequestProvider";
import { useLocalSearchParams } from "expo-router";

/**
 * Flussi focalizzati del collegamento Persona–Società (DAS-REV-21 §6).
 *
 * «Form, riepiloghi, dettagli focalizzati, esiti e conferme usano la shell
 * focalizzata con back e safe area, senza nuova bottom navigation.» Stanno
 * quindi fuori dalle tab, non dentro con `href: null` — una route sorella
 * mostrerebbe comunque la barra.
 *
 * `/society-link/` è la rete **fra società** di DAS-REV-11: due domini
 * distinti (§3), due namespace distinti.
 */
export default function RoleLinkLayout() {
  const { clubId } = useLocalSearchParams<{ clubId?: string }>();

  return (
    <RoleRequestProvider clubId={typeof clubId === "string" ? clubId : ""}>
      <Stack screenOptions={{ headerShown: false }} />
    </RoleRequestProvider>
  );
}
