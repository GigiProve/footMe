/**
 * Tab interne della Home (§3): Per te e Seguiti.
 *
 * Requisiti soddisfatti qui: stessa larghezza (`fill`), aggiornamento del
 * contenuto nella stessa pagina (nessuna navigazione), indicatore attivo
 * chiaro. La posizione di scroll separata per tab è gestita da `FeedScreen`,
 * che tiene entrambi i pane montati.
 *
 * Il design "ProLink UI Upgrade" (§1a) vieta le pillole piene qui: leggevano
 * come CTA e competevano con l'azione vera della pagina. La tab attiva è testo
 * blu con indicatore 2px sotto, come ovunque nell'app.
 *
 * Nessuna terza tab: il §3 elenca esplicitamente Video, Articoli, Posizioni,
 * Esplora, Eventi, Salvati, Aggiornamenti e Opportunità come da NON aggiungere.
 */

import { TabBar, type TabBarItem } from "../../../ui";
import { FEED_TAB_LABELS } from "../feed-labels";
import type { FeedScope } from "../feed-types";

const TABS: readonly TabBarItem<FeedScope>[] = [
  { label: FEED_TAB_LABELS.per_te, value: "per_te" },
  { label: FEED_TAB_LABELS.seguiti, value: "seguiti" },
];

type FeedTabsProps = {
  active: FeedScope;
  onChange: (scope: FeedScope) => void;
};

export function FeedTabs({ active, onChange }: FeedTabsProps) {
  return (
    <TabBar
      active={active}
      fill
      items={TABS}
      onChange={onChange}
      testID="feed-tabs"
    />
  );
}
