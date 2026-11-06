/**
 * Centro Inviti e richieste (DAS-REV-19, screen 01-03).
 *
 * Vive nello Stack annidato della tab Dashboard: §6 vuole la bottom
 * navigation «Home | Cerca | Dashboard | Messaggi | Profilo» visibile con
 * Dashboard selezionata. I cinque ingressi elencati in §6 puntano
 * direttamente qui, senza pagine intermedie.
 */
import { InvitesCenterScreen } from "../../../../src/features/dashboard/invites/InvitesCenterScreen";

export default function DashboardInvitesRoute() {
  return <InvitesCenterScreen />;
}
