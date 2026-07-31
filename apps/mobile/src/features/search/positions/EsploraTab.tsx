import { StyleSheet, View } from "react-native";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, EmptyState } from "../../../ui";
import { SEARCH_PAGE_SIZE, searchPositionsPage } from "../search-service";
import { ResultsCountBar } from "../components/ResultsCountBar";
import {
  activeFilterCount,
  criteriaToParams,
  resultsQueryKey,
} from "./positions-criteria";
import {
  areaSummaryLabel,
  defaultSortFor,
  roleSummaryLabel,
  targetLabel,
} from "./positions-labels";
import { usePositionsSearch } from "./positions-search-context";
import { PositionsList } from "./PositionsList";

type EsploraTabProps = {
  onOpenEdit: () => void;
  onOpenFilters: () => void;
  onOpenGeo: () => void;
  onOpenSort: () => void;
};

export function EsploraTab({
  onOpenEdit,
  onOpenFilters,
  onOpenGeo,
  onOpenSort,
}: EsploraTabProps) {
  const { criteria, patch } = usePositionsSearch();

  const query = useInfiniteQuery({
    queryKey: resultsQueryKey(criteria),
    queryFn: ({ pageParam }) =>
      searchPositionsPage(criteriaToParams(criteria, pageParam)),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.rows.length === SEARCH_PAGE_SIZE ? allPages.length : undefined,
    placeholderData: keepPreviousData,
  });

  const items = query.data?.pages.flatMap((page) => page.rows) ?? [];
  const totalCount = query.data?.pages[0]?.totalCount ?? 0;
  const isNearMe = criteria.geoMode === "near_me";
  const countLabel = isNearMe
    ? `${totalCount} opportunità trovate`
    : `${totalCount} posizioni disponibili`;

  const header = (
    <View style={styles.header}>
      <View style={styles.recap}>
        <RecapRow label="Tipo opportunità" value={targetLabel(criteria.target)} />
        <RecapRow label="Ruolo" value={roleSummaryLabel(criteria)} />
        <RecapRow label="Area di ricerca" value={areaSummaryLabel(criteria)} />
        <Button
          label="Modifica ricerca"
          onPress={onOpenEdit}
          size="sm"
          style={styles.recapCta}
          variant="link"
        />
      </View>

      <View style={styles.shortcuts}>
        <Button
          label="Vicino a me"
          onPress={onOpenGeo}
          selected={isNearMe}
          size="sm"
          variant="chipAction"
        />
        <Button
          label="Tutta Italia"
          onPress={() => patch({ geoMode: "italy", sort: defaultSortFor("italy") })}
          selected={criteria.geoMode === "italy"}
          size="sm"
          variant="chipAction"
        />
        <Button
          label="Prima squadra"
          onPress={() =>
            patch({ teamType: criteria.teamType === "senior" ? null : "senior" })
          }
          selected={criteria.teamType === "senior"}
          size="sm"
          variant="chipAction"
        />
        <Button
          label="Settore giovanile"
          onPress={() =>
            patch({ teamType: criteria.teamType === "youth" ? null : "youth" })
          }
          selected={criteria.teamType === "youth"}
          size="sm"
          variant="chipAction"
        />
      </View>

      <ResultsCountBar
        filtersActiveCount={activeFilterCount(criteria)}
        label={countLabel}
        onFiltersPress={onOpenFilters}
        onSortPress={onOpenSort}
        showFilters
        sortActive={criteria.sort !== defaultSortFor(criteria.geoMode)}
      />
    </View>
  );

  return (
    <PositionsList
      isFetchingNextPage={query.isFetchingNextPage}
      isLoading={query.isLoading}
      items={items}
      ListEmptyComponent={
        <EmptyState
          action={
            <View style={styles.emptyActions}>
              <Button label="Modifica ricerca" onPress={onOpenEdit} variant="outline" />
              {isNearMe ? (
                <Button
                  label="Mostra opportunità in tutta Italia"
                  onPress={() =>
                    patch({ geoMode: "italy", sort: defaultSortFor("italy") })
                  }
                  variant="link"
                />
              ) : null}
            </View>
          }
          description={
            isNearMe
              ? "Prova ad aumentare la distanza o a includere ruoli compatibili."
              : "Prova ad aggiungere un'altra area o a modificare il ruolo."
          }
          icon="search-outline"
          title="Nessuna posizione trovata"
        />
      }
      ListHeaderComponent={header}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      }}
    />
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recapRow}>
      <AppText color="muted" variant="caption">
        {label}
      </AppText>
      <AppText numberOfLines={1} variant="bodyLg">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyActions: {
    alignSelf: "stretch",
    gap: spacing[8],
  },
  header: {
    gap: spacing[12],
    paddingBottom: spacing[8],
  },
  recap: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    gap: spacing[10],
    padding: spacing[16],
  },
  recapCta: {
    alignSelf: "flex-start",
  },
  recapRow: {
    gap: spacing[4],
  },
  shortcuts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
});
