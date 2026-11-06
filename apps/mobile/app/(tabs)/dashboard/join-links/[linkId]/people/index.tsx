/**
 * Persone collegate tramite il link (DAS-REV-20, screen 18).
 *
 * È una pagina gestionale della Società e resta nello Stack della tab
 * Dashboard. §32: l'elenco rimane raggiungibile anche da un link revocato,
 * perché la consultazione dipende dalla capability e non dallo stato.
 */
import { JoinLinkPeopleScreen } from "../../../../../../src/features/dashboard/join-links/people/JoinLinkPeopleScreen";

export default function DashboardJoinLinkPeopleRoute() {
  return <JoinLinkPeopleScreen />;
}
