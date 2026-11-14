/**
 * Bozze e programmati (HOM-06.2 §137). `?tab=drafts|scheduled` apre la tab
 * giusta (il «+» con soli programmati, la notifica di un fallimento §200).
 */
import { useLocalSearchParams } from "expo-router";

import { DraftsScheduledScreen } from "../../src/features/publishing/components/DraftsScheduledScreen";
import { parseDraftsTab } from "../../src/features/publishing/publishing-routes";

export default function DraftsRoute() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();

  return <DraftsScheduledScreen initialTab={parseDraftsTab(tab)} />;
}
