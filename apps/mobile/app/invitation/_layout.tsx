import { Stack } from "expo-router";

/**
 * Superfici del destinatario (DAS-REV-19 §6).
 *
 * «Il dettaglio ricevuto, le conferme e gli esiti sono superfici
 * focalizzate. Aprirli non deve rendere disponibile la Dashboard della
 * società invitante.»
 *
 * Nessun `DashboardIdentityProvider`: la persona che risponde non sta
 * amministrando niente, e montarlo qui significherebbe esattamente quello
 * che §6 vieta.
 */
export default function InvitationLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
