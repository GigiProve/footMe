import { useLocalSearchParams } from "expo-router";

import { ShortlistEntryScreen } from "../../../../../src/features/dashboard/shortlist/ShortlistEntryScreen";

export default function ShortlistEntryRoute() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();

  return <ShortlistEntryScreen entryId={entryId} />;
}
