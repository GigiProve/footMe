import { Redirect } from "expo-router";

/**
 * Reindirizzamento (DAS-REV-23 §28).
 *
 * La lista è passata sotto la tab Dashboard per mostrare la bottom
 * navigation. Questa route resta perché i deep link e le notifiche già
 * inviate puntano qui: §28 — «Deep link e notifiche attraversano gli stessi
 * guard delle navigazioni normali», e un 404 non è un guard.
 */
export default function MyApplicationsRedirect() {
  return <Redirect href={"/(tabs)/dashboard/my-applications" as never} />;
}
