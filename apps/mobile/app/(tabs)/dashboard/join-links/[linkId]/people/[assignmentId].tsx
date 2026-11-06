/**
 * Dettaglio contestuale della persona (DAS-REV-20, screen 19).
 *
 * §34: «Il fatto di gestire questo link non dà automaticamente accesso a
 * tutta la storia della persona.» La pagina mostra il solo incarico entrato
 * da questo link e la sua origine.
 */
import { JoinLinkPersonScreen } from "../../../../../../src/features/dashboard/join-links/people/JoinLinkPersonScreen";

export default function DashboardJoinLinkPersonRoute() {
  return <JoinLinkPersonScreen />;
}
