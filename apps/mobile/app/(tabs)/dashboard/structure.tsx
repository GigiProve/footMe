/**
 * Hub Struttura societaria (DAS-REV-12 §6).
 *
 * Figlia della tab Dashboard, come il Centro Squadre, il Centro Stagioni e
 * la Rete societaria: la bottom navigation resta visibile con Dashboard
 * selezionata, e il back torna alla Dashboard di origine.
 */
import { SocietyStructureScreen } from "../../../src/features/dashboard/structure/SocietyStructureScreen";

export default function SocietyStructureRoute() {
  return <SocietyStructureScreen />;
}
