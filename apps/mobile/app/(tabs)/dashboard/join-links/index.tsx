/**
 * Centro Link di invito (DAS-REV-20, screen 01).
 *
 * Vive nello Stack annidato della tab Dashboard: §6 vuole la bottom
 * navigation «Home | Cerca | Dashboard | Messaggi | Profilo» visibile con
 * Dashboard selezionata. L'ingresso canonico è il Centro Inviti, che però
 * conserva le sue due tab — §6 vieta di aggiungerne una terza per i link.
 */
import { JoinLinksCenterScreen } from "../../../../src/features/dashboard/join-links/JoinLinksCenterScreen";

export default function DashboardJoinLinksRoute() {
  return <JoinLinksCenterScreen />;
}
