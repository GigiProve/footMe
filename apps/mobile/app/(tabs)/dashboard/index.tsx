import { DashboardFoundation } from "../../../src/features/dashboard/DashboardFoundation";

/**
 * Un solo container Dashboard (DAS-REV-01 §4).
 *
 * Prima di questa task la route sceglieva fra `ClubDashboard` e
 * `PersonalDashboard` con un `if` su `profile.role`: due schermate per due
 * ruoli. Ora c'è una Foundation sola, e che cosa mostri dipende dall'identità
 * gestita e dalle capability reali su di essa.
 *
 * Il provider di identità è salito in `_layout` quando DAS-REV-08 ha aggiunto
 * il Centro Squadre come figlio della tab: resta **locale alla Dashboard** —
 * Home, Cerca, Messaggi e Profilo non lo vedono — ma ora lo condividono le
 * schermate che ne fanno parte.
 */
export default function DashboardScreen() {
  return <DashboardFoundation />;
}
