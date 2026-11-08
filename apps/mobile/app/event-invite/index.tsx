/**
 * Flusso di invito (DAS-REV-30 §13, §17). `?eventId=` parte dall'evento
 * (selezione destinatari); `?personId=` parte dal profilo (scelta evento).
 */
import { EventInviteScreen } from "../../src/features/dashboard/events/invite/EventInviteScreen";

export default function EventInviteRoute() {
  return <EventInviteScreen />;
}
