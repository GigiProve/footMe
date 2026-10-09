import { DashboardFoundation } from "../../src/features/dashboard/DashboardFoundation";
import { DashboardIdentityProvider } from "../../src/features/dashboard/identity/DashboardIdentityProvider";

/**
 * Un solo container Dashboard (DAS-REV-01 §4).
 *
 * Prima di questa task la route sceglieva fra `ClubDashboard` e
 * `PersonalDashboard` con un `if` su `profile.role`: due schermate per due
 * ruoli. Ora c'è una Foundation sola, e che cosa mostri dipende dall'identità
 * gestita e dalle capability reali su di essa.
 *
 * Il provider sta qui e non più in alto nell'albero: il cambio di Dashboard
 * Identity è **locale alla Dashboard** e non deve poter raggiungere Home,
 * Cerca, Messaggi o Profilo.
 */
export default function DashboardScreen() {
  return (
    <DashboardIdentityProvider>
      <DashboardFoundation />
    </DashboardIdentityProvider>
  );
}
