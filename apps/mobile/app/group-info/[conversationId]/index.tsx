/**
 * Info gruppo (DAS-REV-33 §6, §9). Flusso focalizzato senza bottom navigation
 * da entrambi gli ingressi: da Messaggi (la chat lo apre con `groupInfoRoute`,
 * senza parametri) e dalla Dashboard («Gestisci gruppo», `?origin=dashboard`).
 * Un solo componente, una sola route: `origin` serve solo al ritorno.
 */
import { useLocalSearchParams } from "expo-router";

import { GroupInfoScreen } from "../../../src/features/dashboard/groups/manage/GroupInfoScreen";

export default function GroupInfoRoute() {
  const params = useLocalSearchParams<{ origin?: string }>();

  return <GroupInfoScreen origin={params.origin === "dashboard" ? "dashboard" : "messages"} />;
}
