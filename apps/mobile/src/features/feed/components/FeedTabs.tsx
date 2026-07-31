/**
 * Tab interne della Home (§3): Per te e Seguiti.
 *
 * Requisiti soddisfatti qui: stessa larghezza (`flex: 1` su entrambe),
 * aggiornamento del contenuto nella stessa pagina (nessuna navigazione),
 * indicatore attivo chiaro. La posizione di scroll separata per tab è gestita da
 * `FeedScreen`, che tiene entrambi i pane montati.
 *
 * Nessuna terza tab: il §3 elenca esplicitamente Video, Articoli, Posizioni,
 * Esplora, Eventi, Salvati, Aggiornamenti e Opportunità come da NON aggiungere.
 */

import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { FEED_TAB_LABELS } from "../feed-labels";
import type { FeedScope } from "../feed-types";

const TABS: readonly FeedScope[] = ["per_te", "seguiti"];

type FeedTabsProps = {
  active: FeedScope;
  onChange: (scope: FeedScope) => void;
};

export function FeedTabs({ active, onChange }: FeedTabsProps) {
  return (
    <View style={styles.bar} testID="feed-tabs">
      {TABS.map((scope) => {
        const isActive = scope === active;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            key={scope}
            onPress={() => onChange(scope)}
            style={[styles.tab, isActive ? styles.tabActive : null]}
          >
            <AppText
              align="center"
              color={isActive ? "inverse" : "secondary"}
              variant="titleSm"
            >
              {FEED_TAB_LABELS[scope]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    paddingBottom: spacing[10],
    paddingHorizontal: spacing[12],
  },
  tab: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    paddingVertical: spacing[10],
  },
  tabActive: {
    backgroundColor: colors.hero,
    borderColor: colors.hero,
  },
});
