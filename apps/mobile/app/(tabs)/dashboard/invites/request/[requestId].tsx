/**
 * Dettaglio consultabile della richiesta ricevuta (DAS-REV-19 §15).
 *
 * Destinazione **canonica**: DAS-REV-21 aggiungerà qui le sue azioni di
 * conferma invece di creare una seconda pagina.
 */
import { RequestDetailScreen } from "../../../../../src/features/dashboard/invites/detail/RequestDetailScreen";

export default function DashboardMemberRequestRoute() {
  return <RequestDetailScreen />;
}
