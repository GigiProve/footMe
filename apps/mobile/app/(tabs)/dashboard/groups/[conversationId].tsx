/**
 * Dettaglio amministrativo di un gruppo (DAS-REV-32 §11; screen 03, 04).
 *
 * Stesso `conversation_id` della chat e dell'Inbox (§4). Nello Stack della
 * tab Dashboard, con Dashboard selezionata.
 */
import { GroupDetailScreen } from "../../../../src/features/dashboard/groups/GroupDetailScreen";

export default function DashboardGroupDetailRoute() {
  return <GroupDetailScreen />;
}
