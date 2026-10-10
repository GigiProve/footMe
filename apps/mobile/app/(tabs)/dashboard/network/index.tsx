/**
 * Centro Rete societaria (DAS-REV-11 §4, master 01 e 02).
 *
 * Figlia della tab Dashboard: la bottom navigation resta visibile con
 * Dashboard selezionata, come chiede §4. I flussi focalizzati — ricerca,
 * form e revisione del consenso — stanno invece in `app/society-link/`.
 */
import { SocietyNetworkScreen } from "../../../../src/features/network/SocietyNetworkScreen";

export default function SocietyNetworkRoute() {
  return <SocietyNetworkScreen />;
}
