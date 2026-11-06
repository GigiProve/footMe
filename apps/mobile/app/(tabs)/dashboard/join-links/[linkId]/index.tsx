/**
 * Dettaglio del link, disponibile o disattivato (DAS-REV-20, screen 13 e 17).
 *
 * Una sola route per i due stati: §32 chiede che revocare conservi squadra,
 * audience, impostazioni, utilizzi storici e persone collegate, quindi il
 * contenuto è lo stesso e cambiano solo le azioni concesse.
 */
import { JoinLinkDetailScreen } from "../../../../../src/features/dashboard/join-links/detail/JoinLinkDetailScreen";

export default function DashboardJoinLinkDetailRoute() {
  return <JoinLinkDetailScreen />;
}
