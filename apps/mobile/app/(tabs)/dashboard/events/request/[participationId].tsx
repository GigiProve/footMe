/**
 * Richiesta di partecipazione singola (DAS-REV-29 §17; screen 16-17).
 *
 * Pagina gestionale della Società nello Stack della tab Dashboard. È la
 * route canonica che la gestione partecipanti della 30 riuserà.
 */
import { EventRequestScreen } from "../../../../../src/features/dashboard/events/requests/EventRequestScreen";

export default function SelectionEventRequestRoute() {
  return <EventRequestScreen />;
}
