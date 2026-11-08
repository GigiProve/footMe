/**
 * Deep link storico di una lista personalizzata.
 *
 * DAS-REV-27 §9, §17: il dettaglio canonico vive nella tab Dashboard. Questa
 * route non mostra più la schermata di RET-07 e reindirizza, così i link già
 * emessi continuano a funzionare e passano dagli stessi controlli di accesso.
 * Nell'URL resta soltanto l'id (§17).
 */
import { Redirect, useLocalSearchParams } from "expo-router";

import { SHORTLIST_HREFS } from "../../src/features/dashboard/shortlist/shortlist-routes";

export default function ShortlistListDeepLink() {
  const params = useLocalSearchParams<{ listId?: string }>();
  const listId = typeof params.listId === "string" ? params.listId : "";

  return <Redirect href={SHORTLIST_HREFS.customList(listId) as never} />;
}
