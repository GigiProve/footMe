/**
 * Centro Partecipanti di un evento (DAS-REV-30 §21; screen 11-19, 23).
 *
 * Nello Stack della tab Dashboard: bottom navigation visibile con Dashboard
 * selezionata (§5). `?filter=` preimposta il filtro dalle tre righe del
 * dettaglio; «Gestisci partecipanti» apre Confermati.
 */
import { EventParticipantsScreen } from "../../../../../src/features/dashboard/events/participants/EventParticipantsScreen";

export default function EventParticipantsRoute() {
  return <EventParticipantsScreen />;
}
