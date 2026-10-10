import { Redirect } from "expo-router";

/**
 * Vecchio accesso gestionale alle squadre.
 *
 * DAS-REV-08 §12 chiede **un solo centro e un solo form condiviso**,
 * raggiungibili anche dagli accessi gestionali del profilo Società. Questa
 * route resta come reindirizzamento perché è già nei link salvati e nei deep
 * link, ma non ospita più una seconda gestione: la sezione "Squadre e
 * affiliate" con `EditTeamsModal` scriveva nome e categoria direttamente su
 * `club_teams`, cioè la fonte che ora appartiene alla configurazione
 * stagionale.
 */
export default function LegacyClubTeamsRoute() {
  return <Redirect href="/(tabs)/dashboard/teams" />;
}
