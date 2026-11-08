/**
 * Dettaglio canonico dell'evento (DAS-REV-29 §7; screen 01, 08-15).
 *
 * Nello Stack della tab Dashboard: bottom navigation visibile con Dashboard
 * selezionata (§4). Lo stesso ID arriva dal Centro, dalle notifiche e dal
 * link pubblico risolto.
 */
import { SelectionEventDetailScreen } from "../../../../src/features/dashboard/events/detail/SelectionEventDetailScreen";

export default function SelectionEventDetailRoute() {
  return <SelectionEventDetailScreen />;
}
