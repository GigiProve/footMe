/**
 * Dettaglio gestionale di una Position (DAS-REV-17, screen 01, 04, 06, 07,
 * 11, 12).
 *
 * Figlia della tab Dashboard, non un flusso focalizzato: §6 — «Le pagine di
 * dettaglio mantengono la navigazione Home | Cerca | Dashboard | Messaggi |
 * Profilo, con Dashboard selezionata.» Editor e anteprima stanno invece in
 * `app/position-manage/`, dove la bottom navigation non c'è.
 */
import { PositionManageDetailScreen } from "../../../../src/features/dashboard/positions/manage/PositionManageDetailScreen";

export default function DashboardPositionDetailRoute() {
  return <PositionManageDetailScreen />;
}
