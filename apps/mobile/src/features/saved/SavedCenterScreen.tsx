/**
 * Saved Center (HOM-07 §102–§128, §152–§161, §179, §182).
 *
 * «← Salvati» con quattro categorie — Contenuti | Profili | Società | Posizioni
 * (§105) — come navigazione locale a testo e indicatore (`TabBar`: il design
 * ProLink vieta le tab-bottone, §106 chiede un controllo leggero). Una lista
 * verticale per categoria, non una dashboard (§198), ordinata per `saved_at`
 * decrescente dal server (§120–§121).
 *
 * Privato dell'utente (§103): nessun elemento di questa schermata è mai
 * mostrato ad altri, nessuna riga dice chi ha salvato.
 *
 * Rimozione (§116–§119): il segnalibro attivo toglie la riga subito, lo store
 * Salvati la nasconde e un toast «Rimosso dai salvati · Annulla» la riporta al
 * suo posto; le liste non si ricaricano finché l'utente può annullare.
 *
 * Errori (§158–§159): «Non è stato possibile caricare i salvati.» + «Riprova»,
 * ma solo se non c'è nulla in cache da mostrare. Empty compatti (§152–§156).
 */

import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../components/ui/screen";
import { colors, spacing } from "../../theme/tokens";
import { AppText, Button, ScreenHeader, TabBar } from "../../ui";
import { SavedListSkeleton, SavedRowItem } from "./components/SavedRows";
import { trackSaved } from "./saved-analytics";
import {
  SAVED_COPY,
  SAVED_TAB_ITEMS,
  emptyCopy,
  flattenSavedPages,
  resolveInitialCategory,
  savedRowHref,
  savedRowKey,
} from "./saved-presentation";
import { POSITION_SAVED_INVALIDATIONS } from "./saved-position-invalidations";
import { getSavedValue, savedKey, seedSaved, useSavedStoreVersion } from "./saved-store";
import type { SavedCategory, SavedRow } from "./saved-types";
import { useSavedList } from "./use-saved-list";
import { useSetSaved } from "./use-set-saved";

export function SavedCenterScreen({ initialFilter }: { initialFilter?: string | string[] }) {
  const router = useRouter();
  const [initialCategory] = useState(() => resolveInitialCategory(initialFilter));
  const [category, setCategory] = useState<SavedCategory>(initialCategory);
  const list = useSavedList(category);
  const setSaved = useSetSaved();

  useEffect(() => {
    trackSaved({ category: initialCategory, name: "saved_center_open" });
  }, [initialCategory]);

  // Ogni pagina semina lo store con il proprio istante (§141): una pagina più
  // nuova di un tap fatto altrove prevale, una più vecchia no.
  const pages = list.data?.pages;
  useEffect(() => {
    for (const page of pages ?? []) {
      for (const row of page.rows) {
        seedSaved(savedKey(row.target), true, page.fetchedAt ?? 0);
      }
    }
  }, [pages]);
  const fetchedAtByKey = new Map<string, number>();
  for (const page of pages ?? []) {
    for (const row of page.rows) {
      fetchedAtByKey.set(savedKey(row.target), page.fetchedAt ?? 0);
    }
  }

  // Lo store decide quali righe sono ancora salvate (§116, §119, §134).
  useSavedStoreVersion();
  const rows = flattenSavedPages(pages).filter((row) =>
    getSavedValue(row.target, true, fetchedAtByKey.get(savedKey(row.target)) ?? 0),
  );

  const changeCategory = (next: SavedCategory) => {
    if (next === category) {
      return;
    }
    trackSaved({ from: category, name: "saved_category_changed", to: next });
    setCategory(next);
  };

  const openRow = (row: SavedRow) => {
    trackSaved({ category, name: "saved_target_open", targetType: row.target.type });
    router.push(savedRowHref(row) as never);
  };

  const removeRow = (row: SavedRow) => {
    setSaved.mutate({
      invalidate: row.kind === "position" ? POSITION_SAVED_INVALIDATIONS : undefined,
      keepLists: true,
      saved: false,
      surface: "saved_center",
      target: row.target,
      undoCategory: category,
    });
  };

  const hasRows = rows.length > 0;
  const showFullError = list.isError && !hasRows;
  const empty = emptyCopy(category);

  return (
    <Screen>
      <ScreenHeader
        leading={
          <Pressable
            accessibilityLabel={SAVED_COPY.backLabel}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.back()}
            style={styles.back}
          >
            <Ionicons color={colors.textPrimary} name="arrow-back" size={22} />
          </Pressable>
        }
        title={SAVED_COPY.title}
      />

      {/* §182: le categorie sono navigazione locale, non azioni. */}
      <View accessibilityRole="tablist" style={styles.tabs}>
        <TabBar
          active={category}
          items={SAVED_TAB_ITEMS}
          onChange={changeCategory}
          style={styles.tabBar}
          testID="saved-tabs"
        />
      </View>

      <FlatList
        contentContainerStyle={styles.content}
        data={showFullError ? [] : rows}
        keyExtractor={savedRowKey}
        ListEmptyComponent={
          list.isPending ? (
            <SavedListSkeleton />
          ) : showFullError ? (
            <View style={styles.state} testID="saved-error">
              <AppText align="center" color="secondary" variant="bodyLg">
                {SAVED_COPY.errorTitle}
              </AppText>
              <Button
                label={SAVED_COPY.errorRetry}
                onPress={() => void list.refetch()}
                size="sm"
                variant="link"
              />
            </View>
          ) : (
            <View style={styles.state} testID="saved-empty">
              <AppText align="center" variant="titleSm">
                {empty.title}
              </AppText>
              {empty.description ? (
                <AppText align="center" color="muted" variant="bodySm">
                  {empty.description}
                </AppText>
              ) : null}
            </View>
          )
        }
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : list.isError && hasRows ? (
            // §159: la cache resta, l'errore è un avviso discreto in coda.
            <View style={styles.footer}>
              <AppText color="secondary" variant="bodySm">
                {SAVED_COPY.errorTitle}
              </AppText>
              <Button
                label={SAVED_COPY.errorRetry}
                onPress={() => void (list.hasNextPage ? list.fetchNextPage() : list.refetch())}
                size="sm"
                variant="link"
              />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage && !list.isError) {
            void list.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <SavedRowItem onOpen={openRow} onRemove={removeRow} row={item} />
        )}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    marginLeft: -spacing[8],
    width: 44,
  },
  content: {
    paddingBottom: spacing[24],
  },
  footer: {
    alignItems: "center",
    gap: spacing[4],
    paddingVertical: spacing[16],
  },
  state: {
    alignItems: "center",
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[32],
  },
  tabBar: {
    paddingHorizontal: spacing[0],
  },
  tabs: {
    marginBottom: spacing[4],
    marginTop: spacing[8],
  },
});
