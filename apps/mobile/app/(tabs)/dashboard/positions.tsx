/**
 * Centro Posizioni aperte (DAS-REV-15, screen 01-06).
 *
 * Vive nello Stack annidato della tab Dashboard: §5 vuole la bottom
 * navigation «Home | Cerca | Dashboard | Messaggi | Profilo» visibile con
 * Dashboard selezionata, e vieta il passaggio obbligato per Struttura
 * societaria — i tre ingressi (Dashboard, dettaglio Squadra, disattivazione)
 * puntano direttamente qui.
 */
import { PositionsCenterScreen } from "../../../src/features/dashboard/positions/PositionsCenterScreen";

export default function DashboardPositionsRoute() {
  return <PositionsCenterScreen />;
}
