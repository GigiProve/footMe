import { Stack } from "expo-router";

/**
 * Flussi focalizzati della Rete societaria (DAS-REV-11 §4).
 *
 * «Search, form di richiesta e revisione del consenso sono flussi focalizzati
 * senza bottom navigation.» Stanno quindi fuori dalle tab, non dentro con
 * `href: null` — una route sorella mostrerebbe comunque la barra.
 */
export default function SocietyLinkLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
