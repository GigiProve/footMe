/**
 * Corpo del pool: righe, vuoto reale, vuoto filtrato, errore e pagine
 * successive (DAS-REV-25 §13, §28; DAS-REV-27 §15, §24).
 *
 * Estratto da `PositionShortlistScreen` per servire anche il dettaglio
 * CUSTOM. Cambia soltanto la copy del vuoto reale: §24 della 27 — «Lista
 * vuota: Nessun profilo in shortlist / I profili aggiunti a questa lista
 * compariranno qui. Non aggiungere Cerca profili dentro la lista.»
 *
 * Quale superficie mostrare lo decide `poolPresentation`, non un
 * `rows.length === 0`: vuoto reale e vuoto filtrato restano distinti.
 */
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { DashboardGlobalError } from "../../components/DashboardStates";
import { SHORTLIST_COPY, type PoolSurface } from "../shortlist-presentation";
import type { ShortlistPoolRow } from "../shortlist-types";
import { ShortlistPoolRowView } from "./ShortlistPoolRow";
import { ShortlistSectionSkeleton } from "./ShortlistSection";

type Props = {
  emptyBody: string;
  focusEntryId: string | null;
  isError: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  onClearFilters: () => void;
  onRetry: () => void;
  onRowPress: (row: ShortlistPoolRow) => void;
  rows: ShortlistPoolRow[];
  surface: PoolSurface;
};

export function ShortlistPoolList({
  emptyBody,
  focusEntryId,
  isError,
  isFetchingNextPage,
  isLoading,
  onClearFilters,
  onRetry,
  onRowPress,
  rows,
  surface,
}: Props) {
  return (
    <>
      {isLoading && rows.length === 0 ? <ShortlistSectionSkeleton rows={3} /> : null}

      {isError ? (
        <DashboardGlobalError
          body={SHORTLIST_COPY.errorBody}
          onRetry={onRetry}
          title={SHORTLIST_COPY.poolErrorTitle}
        />
      ) : null}

      {!isLoading && !isError && surface === "empty" ? (
        <View style={styles.empty} testID="shortlist-pool-empty">
          <Ionicons color={colors.textNeutralSoft} name="document-text-outline" size={40} />

          <AppText align="center" color="neutral" variant="titleSm">
            {SHORTLIST_COPY.poolEmptyTitle}
          </AppText>

          <AppText align="center" color="neutralMuted" variant="bodySm">
            {emptyBody}
          </AppText>
        </View>
      ) : null}

      {!isLoading && !isError && surface === "filteredEmpty" ? (
        <View style={styles.empty} testID="shortlist-pool-filtered-empty">
          <Ionicons color={colors.textNeutralSoft} name="star-outline" size={40} />

          <AppText align="center" color="neutral" variant="titleSm">
            {SHORTLIST_COPY.poolFilteredEmptyTitle}
          </AppText>

          <AppText align="center" color="neutralMuted" variant="bodySm">
            {SHORTLIST_COPY.poolFilteredEmptyBody}
          </AppText>

          <Button
            fullWidth
            label={SHORTLIST_COPY.filterClear}
            onPress={onClearFilters}
            size="lg"
            testID="shortlist-pool-clear-filters"
            variant="primary"
          />
        </View>
      ) : null}

      {rows.map((row, index) => (
        <ShortlistPoolRowView
          focused={focusEntryId === row.entryId}
          key={row.entryId}
          onPress={() => onRowPress(row)}
          row={row}
          showDivider={index > 0}
        />
      ))}

      {isFetchingNextPage ? <ShortlistSectionSkeleton rows={1} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    gap: spacing[8],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[40],
  },
});
