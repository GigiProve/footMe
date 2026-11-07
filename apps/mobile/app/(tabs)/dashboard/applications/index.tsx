/**
 * Centro Candidature ricevute (DAS-REV-22, screen 01-04, 14, 15).
 *
 * Figlia della tab Dashboard: §11 — «Bottom navigation canonica Home | Cerca
 * | Dashboard | Messaggi | Profilo. Dashboard selezionata nelle superfici di
 * questa task.» Qui non esiste nessun flusso focalizzato: non si compone
 * niente, si consulta.
 */
import { ApplicationsCenterScreen } from "../../../../src/features/dashboard/applications/ApplicationsCenterScreen";

export default function DashboardApplicationsRoute() {
  return <ApplicationsCenterScreen />;
}
