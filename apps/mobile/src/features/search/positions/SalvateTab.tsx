import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, EmptyState, Skeleton } from "../../../ui";
import { useSession } from "../../auth/use-session";
import {
  fetchSavedPositionsPage,
  SAVED_PAGE_SIZE,
  savedGroupQueryKey,
  type SavedGroup,
} from "./saved-positions-service";
import { SavedPositionRow } from "./SavedPositionRow";
import { useUnsavePosition } from "./use-unsave-position";

type SalvateTabProps = {
  /** Filtro iniziale: Disponibili è il default dell'accesso ordinario (§15). */
  initialGroup?: SavedGroup;
  /** Posizione su cui l'accesso contestuale chiede di aprire la lista (§23). */
  focusAdId?: string | null;
  onSearchPositions: () => void;
};

const GROUP_OPTIONS: { group: SavedGroup; label: string }[] = [
  { group: "available", label: "Disponibili" },
  { group: "unavailable", label: "Non più disponibili" },
];

/**
 * Tab "Salvate" di Posizioni aperte (DAS-REV-05 §15, §16, §20).
 *
 * I due filtri sono **interni** alla tab: §15 vieta di aggiungerli alla
 * navigazione principale (Per te | Esplora | Salvate resta invariata) e di
 * creare una pagina Salvate separata per la Dashboard.
 *
 * Le due liste restano separate — query, cache, paginazione e conteggio per
 * gruppo — così cambiare filtro non mescola i dati e il totale viene sempre
 * dal backend, non dalle righe scaricate.
 */
export function SalvateTab({
  focusAdId = null,
  initialGroup = "available",
  onSearchPositions,
}: SalvateTabProps) {
  const router = useRouter();
  const { profile } = useSession();
  const profileId = profile?.id ?? null;
  const unsave = useUnsavePosition();

  const [group, setGroup] = useState<SavedGroup>(initialGroup);

  // L'accesso contestuale può cambiare filtro su una schermata già montata
  // (aggiornamento informativo toccato mentre la lista è nello stack).
  useEffect(() => {
    setGroup(initialGroup);
  }, [initialGroup]);

  const query = useInfiniteQuery({
    enabled: !!profileId,
    queryKey: savedGroupQueryKey(profileId, group),
    queryFn: ({ pageParam }) =>
      fetchSavedPositionsPage({ group, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.rows.length === SAVED_PAGE_SIZE ? allPages.length : undefined,
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.pages.flatMap((page) => page.rows) ?? [];
  const total = query.data?.pages[0]?.totalCount ?? 0;

  // §23: focus sulla risorsa pertinente, con identificativi canonici. Un
  // parametro non conferisce accesso: se il bookmark non c'è più, la riga
  // semplicemente non è nella lista e non viene ricreata.
  const ordered =
    focusAdId && rows.some((row) => row.adId === focusAdId)
      ? [
          ...rows.filter((row) => row.adId === focusAdId),
          ...rows.filter((row) => row.adId !== focusAdId),
        ]
      : rows;

  return (
    <View style={styles.root}>
      <View style={styles.filters}>
        {GROUP_OPTIONS.map((option) => (
          <Button
            key={option.group}
            label={option.label}
            onPress={() => setGroup(option.group)}
            selected={group === option.group}
            size="sm"
            style={styles.filter}
            variant="chipAction"
          />
        ))}
      </View>

      {query.isError && rows.length === 0 ? (
        <View style={styles.state}>
          <AppText color="secondary" variant="bodySm">
            Non siamo riusciti a caricare le posizioni salvate.
          </AppText>
          <Button
            label="Riprova"
            onPress={() => void query.refetch()}
            size="sm"
            variant="link"
          />
        </View>
      ) : null}

      {!query.isLoading && !query.isError ? (
        <AppText color="secondary" style={styles.count} variant="bodySm">
          {countLabel(group, total)}
        </AppText>
      ) : null}

      <FlatList
        contentContainerStyle={styles.content}
        data={ordered}
        keyExtractor={(item) => item.adId}
        ListEmptyComponent={
          query.isLoading ? (
            <View style={styles.loader}>
              <Skeleton.Row />
              <Skeleton.Row />
              <Skeleton.Row />
            </View>
          ) : query.isError ? null : group === "unavailable" ? (
            // §20: empty minimale, nessuna illustrazione grande e nessuna
            // azione nuova.
            <EmptyState
              icon="bookmark-outline"
              title="Nessuna posizione non più disponibile"
            />
          ) : (
            // §20: da questa superficie la CTA porta alla ricerca di
            // posizioni, non di nuovo al filtro Salvate.
            <EmptyState
              action={
                <Button
                  label="Cerca posizioni"
                  onPress={onSearchPositions}
                  variant="primary"
                />
              }
              description="Salva le opportunità che vuoi ritrovare facilmente."
              icon="bookmark-outline"
              title="Non hai posizioni salvate"
            />
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            void query.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <SavedPositionRow
            // §16: nessuna navigazione verso un dettaglio che sappiamo già
            // inaccessibile. Il bookmark resta attivo comunque.
            onPress={
              item.isNavigable
                ? () => router.push(`/position/${item.adId}` as never)
                : null
            }
            onToggleSaved={() => unsave.mutate(item.adId)}
            row={item}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

/** §15: il conteggio viene dal backend e dal filtro corrente. */
function countLabel(group: SavedGroup, total: number): string {
  if (group === "unavailable") {
    return total === 1
      ? "1 posizione non più disponibile"
      : `${total} posizioni non più disponibili`;
  }

  return total === 1 ? "1 posizione disponibile" : `${total} posizioni disponibili`;
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing[24],
  },
  count: {
    paddingBottom: spacing[8],
  },
  filter: {
    minHeight: 34,
    paddingHorizontal: spacing[12],
  },
  filters: {
    flexDirection: "row",
    gap: spacing[8],
    paddingBottom: spacing[12],
  },
  footer: {
    alignItems: "center",
    paddingVertical: spacing[16],
  },
  loader: {
    gap: spacing[8],
    paddingTop: spacing[16],
  },
  root: {
    flex: 1,
  },
  state: {
    alignItems: "flex-start",
    gap: spacing[4],
    paddingVertical: spacing[12],
  },
});
