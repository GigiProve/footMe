/**
 * Centro Ruoli e permessi (screen 01).
 *
 * Vive nello Stack annidato della tab Dashboard: §4 vuole la bottom
 * navigation visibile con Dashboard selezionata su questo solo screen.
 */
import { RolesCenterScreen } from "../../../src/features/dashboard/roles/RolesCenterScreen";

export default function DashboardRolesRoute() {
  return <RolesCenterScreen />;
}
