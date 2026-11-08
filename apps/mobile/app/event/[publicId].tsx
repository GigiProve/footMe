/**
 * Link pubblico dell'evento dentro l'app (DAS-REV-29 §12).
 *
 * Stesso percorso dell'URL HTTPS canonico (`/event/<public_id>`): Universal
 * Links, App Links e `footme://event/<id>` arrivano qui senza traduzioni.
 * Fuori dalle tab perché deve funzionare anche senza sessione, come le
 * landing degli inviti; con sessione sostituisce sé stessa con il dettaglio
 * nella tab Dashboard.
 */
import { EventLinkScreen } from "../../src/features/dashboard/events/link/EventLinkScreen";

export default function SelectionEventLinkRoute() {
  return <EventLinkScreen />;
}
