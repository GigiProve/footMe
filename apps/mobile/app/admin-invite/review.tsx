/**
 * Invito ricevuto (screen 04).
 *
 * È il contesto della persona destinataria, non quello gestionale: §6 vuole
 * la revisione del consenso fuori dalla shell Dashboard, e §23 usa qui il
 * guard PERSON/invito invece di quello della Società.
 */
import { AdminInviteReviewScreen } from "../../src/features/dashboard/admins/invite/AdminInviteReviewScreen";

export default function AdminInviteReviewRoute() {
  return <AdminInviteReviewScreen />;
}
