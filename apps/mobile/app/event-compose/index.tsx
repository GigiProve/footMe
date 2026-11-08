/**
 * Crea evento / riprendi bozza (DAS-REV-28 §13, §23). `?eventId=` riapre la
 * stessa bozza; senza parametro nessun record viene creato all'apertura.
 */
import { EventComposeScreen } from "../../src/features/dashboard/events/compose/EventComposeScreen";

export default function EventComposeRoute() {
  return <EventComposeScreen />;
}
