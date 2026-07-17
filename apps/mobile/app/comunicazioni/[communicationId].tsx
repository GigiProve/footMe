import { useLocalSearchParams } from "expo-router";

import { CommunicationDetailScreen } from "../../src/features/messaging/components/CommunicationDetailScreen";

export default function CommunicationDetailRoute() {
  const { communicationId } = useLocalSearchParams<{ communicationId: string }>();

  return <CommunicationDetailScreen communicationId={communicationId ?? ""} />;
}
