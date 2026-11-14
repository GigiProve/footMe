import { useLocalSearchParams } from "expo-router";

import { SavedCenterScreen } from "../../src/features/saved/SavedCenterScreen";

/**
 * HOM-07 §102–§105: il Saved Center. `?filter=` apre già sulla categoria
 * giusta (`content`, `profile`, `club`, `position`), per i vecchi ingressi.
 */
export default function SavedRoute() {
  const params = useLocalSearchParams<{ filter?: string }>();

  return <SavedCenterScreen initialFilter={params.filter} />;
}
