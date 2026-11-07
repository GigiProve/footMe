import { useLocalSearchParams } from "expo-router";

import { PositionShortlistScreen } from "../../../../../src/features/dashboard/shortlist/PositionShortlistScreen";

export default function PositionShortlistRoute() {
  const { positionId } = useLocalSearchParams<{ positionId: string }>();

  return <PositionShortlistScreen positionId={positionId} />;
}
