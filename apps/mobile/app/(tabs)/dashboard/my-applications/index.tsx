import { Screen } from "../../../../src/components/ui/screen";
import { MyApplicationsScreen } from "../../../../src/features/applications/MyApplicationsScreen";

/**
 * «Le mie candidature» (DAS-REV-23 §28).
 *
 * Figlia della tab Dashboard e non più una route di primo livello: «Bottom
 * navigation canonica Home | Cerca | Dashboard | Messaggi | Profilo.
 * Dashboard selezionata nelle pagine della tavola aperte dal relativo
 * percorso.» Fuori dalle tab la bottom navigation non si vedeva affatto.
 *
 * `app/applications/` resta come reindirizzamento per i deep link e le
 * notifiche già in circolazione.
 */
export default function MyApplicationsRoute() {
  return (
    <Screen>
      <MyApplicationsScreen />
    </Screen>
  );
}
