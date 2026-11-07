/**
 * Candidature di una singola Position (DAS-REV-22, screen 12, 13).
 *
 * §23: lo stesso elenco canonico, limitato all'esatto position_id e senza
 * filtri ridondanti.
 */
import { PositionApplicationsScreen } from "../../../../../src/features/dashboard/applications/PositionApplicationsScreen";

export default function DashboardPositionApplicationsRoute() {
  return <PositionApplicationsScreen />;
}
