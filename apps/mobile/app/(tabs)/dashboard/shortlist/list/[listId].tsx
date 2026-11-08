/**
 * Dettaglio di una lista personalizzata dentro la tab Dashboard.
 *
 * DAS-REV-27 §9: la schermata di RET-07 lascia il posto a
 * `CustomShortlistScreen`, che riusa pool, filtri e scheda entry della 25
 * (§3, §15). La bottom navigation resta visibile, Dashboard selezionata (§4).
 */
import { useLocalSearchParams } from "expo-router";

import { CustomShortlistScreen } from "../../../../../src/features/dashboard/shortlist/custom/CustomShortlistScreen";

export default function CustomShortlistRoute() {
  const params = useLocalSearchParams<{ listId?: string }>();
  const listId = typeof params.listId === "string" ? params.listId : "";

  /* `key`: un'altra lista è un'altra istanza, senza stato o revoca ereditati. */
  return <CustomShortlistScreen key={listId} shortlistId={listId} />;
}
