/**
 * Crea gruppo (DAS-REV-32 §12, §13). `?origin=dashboard|messages` e `?clubId=`
 * opzionale: nessuna Conversation viene creata all'apertura.
 */
import { GroupComposeScreen } from "../../src/features/dashboard/groups/compose/GroupComposeScreen";

export default function GroupComposeRoute() {
  return <GroupComposeScreen />;
}
