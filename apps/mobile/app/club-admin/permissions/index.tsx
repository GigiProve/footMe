import { Redirect } from "expo-router";

import { ROLES_HREFS } from "../../../src/features/dashboard/roles/roles-routes";

/**
 * Vecchio ingresso «Amministratori · Ruoli e permessi».
 *
 * Elencava i membri dell'organico e apriva un editor di singoli grant per
 * persona. DAS-REV-14 §3 vieta «un secondo motore di ruoli per la sola
 * Dashboard»: con i permessi ora derivati dal ruolo della membership, due
 * superfici che scrivono `club_member_permissions` sono due fonti di verità.
 *
 * La pagina non viene cancellata — §24 chiede di «riallineare», non di
 * rimuovere — ma reindirizza al Centro Ruoli e permessi, che è la
 * destinazione canonica e non è più gated sul ruolo `club_admin`.
 */
export default function ClubAdminPermissionsRedirect() {
  return <Redirect href={ROLES_HREFS.center() as never} />;
}
