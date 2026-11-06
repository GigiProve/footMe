/**
 * Dettaglio dell'invito inviato (DAS-REV-19, screen 15).
 *
 * Figlia della tab Dashboard come il dettaglio Position di DAS-REV-17: è una
 * pagina gestionale della Società, non un flusso focalizzato. Le superfici
 * del destinatario stanno invece in `app/invitation/`, dove la Dashboard
 * della Società invitante non è raggiungibile (§6).
 */
import { SentInviteDetailScreen } from "../../../../src/features/dashboard/invites/detail/SentInviteDetailScreen";

export default function DashboardSentInviteRoute() {
  return <SentInviteDetailScreen />;
}
