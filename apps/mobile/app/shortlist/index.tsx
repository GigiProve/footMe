/**
 * Deep link storico del centro Shortlist.
 *
 * DAS-REV-24 §25, §26: il centro vive ora dentro la tab Dashboard, dove la
 * bottom navigation resta visibile. Questa route non mostra più un secondo
 * centro — §36 vieta «una nuova Dashboard completa o un recruiting center
 * parallelo» — e reindirizza a quello canonico, così i link già emessi
 * continuano a funzionare (QA124).
 */
import { Redirect } from "expo-router";

import { SHORTLIST_HREFS } from "../../src/features/dashboard/shortlist/shortlist-routes";

export default function ShortlistDeepLink() {
  return <Redirect href={SHORTLIST_HREFS.center() as never} />;
}
