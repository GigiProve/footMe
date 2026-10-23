/**
 * Centro Amministratori (screen 01).
 *
 * Vive nello Stack annidato della tab Dashboard: §6 vuole la bottom
 * navigation visibile con Dashboard selezionata, e §6 vieta «una pagina
 * intermedia tra l'entry e il centro» — i due ingressi puntano qui.
 */
import { AdminCenterScreen } from "../../../src/features/dashboard/admins/AdminCenterScreen";

export default function DashboardAdminsRoute() {
  return <AdminCenterScreen />;
}
