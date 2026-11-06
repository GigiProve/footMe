/**
 * Dettaglio della richiesta ricevuta — destinazione canonica.
 *
 * DAS-REV-19 §15 la preannunciava: «La gestione arriva con DAS-REV-21, sulla
 * stessa destinazione.» È quello che succede qui, senza una seconda pagina.
 *
 * Due letture dietro la stessa route perché le sorgenti sono due e §48 vieta
 * di riscriverne una per far entrare l'altra:
 *
 *   `kind=role`  una `club_role_requests`, la proposta canonica con ruolo
 *                strutturato, ambito e lifecycle proprio — risolvibile;
 *   altrimenti   una riga `club_members.self_request` storica, che un ruolo
 *                del catalogo non ce l'ha e che resta in sola lettura.
 *
 * Il `kind` arriva dalla riga del Centro, cioè dal backend, e non è un
 * tentativo del client di indovinare il dominio da un ID.
 */
import { useLocalSearchParams } from "expo-router";

import { RequestDetailScreen } from "../../../../../src/features/dashboard/invites/detail/RequestDetailScreen";
import { SocietyRoleRequestScreen } from "../../../../../src/features/role-link/society/SocietyRoleRequestScreen";

export default function DashboardMemberRequestRoute() {
  const { kind, requestId } = useLocalSearchParams<{
    kind?: string;
    requestId?: string;
  }>();

  if (kind === "role" && typeof requestId === "string" && requestId.length > 0) {
    return <SocietyRoleRequestScreen requestId={requestId} />;
  }

  return <RequestDetailScreen />;
}
