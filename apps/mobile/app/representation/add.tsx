/**
 * SCREEN 2 / 3 / 5 — Ricerca iniziale, risultati e nessun risultato
 * (REV-PROF-14).
 *
 * È la prima cosa che si apre da "Aggiungi assistito": non esiste una schermata
 * di scelta fra "cerca su PROLINK" e "aggiungi manualmente", e il fallback
 * manuale compare solo dopo che una ricerca è stata davvero eseguita.
 *
 * La ricerca non è un secondo motore: chiama `search_profiles_page` con
 * `role = 'player'`, la stessa RPC di Cerca → Profili. Lo stato della relazione
 * con ciascun risultato arriva da una RPC separata, così il motore di ricerca
 * non impara nulla su chi lo interroga.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../src/components/ui/screen";
import {
  AppText,
  Avatar,
  Button,
  ScreenHeader,
  SearchField,
} from "../../src/ui";
import { trackAssistitiEvent } from "../../src/features/relationships/assistiti/assistiti-analytics";
import {
  AssistitiSearchFilters,
  buildAssistitiSearchPayload,
  countActiveSearchFilters,
  EMPTY_SEARCH_FILTERS,
  type AssistitiSearchFiltersState,
} from "../../src/features/relationships/assistiti/AssistitiSearchFilters";
import { fetchRelationshipStates } from "../../src/features/relationships/assistiti/assistiti-service";
import {
  AssistitiSkeleton,
  BackButton,
  InfoCallout,
  SectionError,
} from "../../src/features/relationships/assistiti/assistiti-ui";
import {
  MIN_SEARCH_QUERY_LENGTH,
  SEARCH_PAGE_SIZE,
  searchProfilesPage,
} from "../../src/features/search/search-service";
import type { ProfileSearchRow } from "../../src/features/search/search-types";
import { getPlayerPositionLabel } from "../../src/features/profiles/player-sports";
import { colors, radius, spacing } from "../../src/theme/tokens";

const SEARCH_DEBOUNCE_MS = 300;

export default function AddAssistitoScreen() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<AssistitiSearchFiltersState>(
    EMPTY_SEARCH_FILTERS,
  );
  const searchStartedRef = useRef(false);

  // Debounce: una richiesta per carattere intaserebbe la rete e farebbe
  // arrivare risposte vecchie dopo quelle nuove.
  useEffect(() => {
    const trimmed = query.trim();
    const timeout = setTimeout(() => {
      setDebouncedQuery(trimmed.length >= MIN_SEARCH_QUERY_LENGTH ? trimmed : "");
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [query]);

  const payload = useMemo(
    () => buildAssistitiSearchPayload(filters),
    [filters],
  );

  const isQueryValid = debouncedQuery.length >= MIN_SEARCH_QUERY_LENGTH;

  const resultsQuery = useInfiniteQuery({
    enabled: isQueryValid,
    getNextPageParam: (lastPage: ProfileSearchRow[], allPages) =>
      lastPage.length === SEARCH_PAGE_SIZE ? allPages.length : undefined,
    initialPageParam: 0,
    // La risposta precedente resta a schermo durante il caricamento della
    // nuova pagina, ma la chiave include query e filtri: un risultato di una
    // ricerca passata non può mai essere scambiato per uno della corrente.
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) =>
      searchProfilesPage({
        filters: payload,
        page: pageParam as number,
        query: debouncedQuery,
        role: "player",
        sort: "relevance",
      }).then((result) => result.rows),
    queryKey: ["assistiti-search", debouncedQuery, payload],
  });

  const rows = useMemo(
    () => (resultsQuery.data?.pages ?? []).flat(),
    [resultsQuery.data],
  );

  const statesQuery = useQuery({
    enabled: rows.length > 0,
    queryFn: () => fetchRelationshipStates(rows.map((row) => row.profile_id)),
    queryKey: [
      "assistiti-search-states",
      rows.map((row) => row.profile_id).join(","),
    ],
  });

  useEffect(() => {
    if (!isQueryValid) {
      return;
    }

    if (!searchStartedRef.current) {
      searchStartedRef.current = true;
      trackAssistitiEvent("assistiti_search_started", {
        activeFilters: countActiveSearchFilters(filters),
      });
    }
    // Un solo evento di avvio per sessione di ricerca: il conteggio misura
    // quante volte si cerca, non quante volte cambia una lettera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQueryValid]);

  const hasSearched = isQueryValid && resultsQuery.isFetched;
  const isEmptyResult = hasSearched && !resultsQuery.isError && rows.length === 0;

  useEffect(() => {
    if (!hasSearched || resultsQuery.isError) {
      return;
    }

    trackAssistitiEvent(
      rows.length === 0 ? "assistiti_search_empty" : "assistiti_search_results",
      { resultCount: rows.length },
    );
  }, [hasSearched, resultsQuery.isError, rows.length]);

  useEffect(() => {
    if (resultsQuery.isError) {
      trackAssistitiEvent("assistiti_search_failed");
    }
  }, [resultsQuery.isError]);

  function openManualForm(source: "no_results" | "fallback") {
    trackAssistitiEvent("assistiti_manual_fallback_tapped", { source });
    router.push({
      params: { suggestedName: query.trim() },
      pathname: "/representation/manual",
    } as never);
  }

  function handleSelect(row: ProfileSearchRow) {
    trackAssistitiEvent("assistiti_candidate_selected");
    router.push({
      params: {
        name: row.full_name,
        playerId: row.profile_id,
        position: row.primary_position ?? "",
        team: row.current_team_name ?? row.current_club_name ?? "",
      },
      pathname: "/representation/request",
    } as never);
  }

  const showIdle = !isQueryValid && query.trim().length < MIN_SEARCH_QUERY_LENGTH;
  const showMinChars =
    query.trim().length > 0 && query.trim().length < MIN_SEARCH_QUERY_LENGTH;

  return (
    <Screen>
      <ScreenHeader
        leading={<BackButton onPress={() => router.back()} />}
        title={hasSearched ? "Cerca un calciatore" : "Aggiungi assistito"}
      />

      <FlatList
        ListEmptyComponent={
          resultsQuery.isError ? (
            <SectionError
              message="Non è stato possibile completare la ricerca."
              onRetry={() => void resultsQuery.refetch()}
            />
          ) : resultsQuery.isLoading && isQueryValid ? (
            <AssistitiSkeleton />
          ) : isEmptyResult ? (
            <View style={styles.emptyBlock} testID="assistiti-search-empty">
              <View style={styles.emptyIcon}>
                <Ionicons
                  color={colors.textMuted}
                  name="search-outline"
                  size={34}
                />
              </View>
              <AppText align="center" variant="headingSm">
                Nessun profilo trovato
              </AppText>
              <AppText align="center" color="secondary" variant="bodySm">
                Controlla il nome oppure aggiungi il calciatore manualmente.
              </AppText>
              <InfoCallout testID="assistiti-search-empty-note">
                <AppText color="secondary" variant="bodySm">
                  Dopo averlo aggiunto potrai invitarlo su PROLINK.
                </AppText>
              </InfoCallout>
              <Button
                fullWidth
                label="Aggiungi e invita"
                onPress={() => openManualForm("no_results")}
                testID="assistiti-add-and-invite"
              />
              <Button
                label="Modifica ricerca"
                onPress={() => setQuery("")}
                variant="link"
              />
            </View>
          ) : showIdle ? (
            <View style={styles.idleBlock} testID="assistiti-search-idle">
              <View style={styles.emptyIcon}>
                <Ionicons
                  color={colors.textMuted}
                  name="search-outline"
                  size={34}
                />
              </View>
              <AppText align="center" color="secondary" variant="bodySm">
                Inizia a digitare
              </AppText>
              <AppText align="center" color="muted" variant="bodySm">
                per trovare il profilo corretto.
              </AppText>
            </View>
          ) : null
        }
        ListFooterComponent={
          rows.length > 0 ? (
            <View style={styles.fallbackCard} testID="assistiti-manual-fallback">
              <AppText align="center" variant="titleSm">
                Non trovi il calciatore?
              </AppText>
              <AppText align="center" color="secondary" variant="bodySm">
                Prova una ricerca diversa oppure aggiungilo manualmente.
              </AppText>
              <Button
                fullWidth
                label="Aggiungi manualmente"
                onPress={() => openManualForm("fallback")}
                variant="outline"
              />
            </View>
          ) : null
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {!hasSearched ? (
              <View style={styles.intro}>
                <AppText variant="screenTitle">Cerca il calciatore</AppText>
                <AppText color="secondary" variant="bodySm">
                  Cerca prima tra i profili presenti su PROLINK.
                </AppText>
              </View>
            ) : null}

            <SearchField
              autoFocus
              onChangeText={setQuery}
              placeholder="Nome, squadra, ruolo o città"
              testID="assistiti-search-field"
              value={query}
            />

            {showMinChars ? (
              <AppText color="muted" variant="caption">
                Inserisci almeno 2 caratteri.
              </AppText>
            ) : null}

            <AssistitiSearchFilters onChange={setFilters} value={filters} />
          </View>
        }
        contentContainerStyle={styles.listContent}
        data={rows}
        keyExtractor={(item) => item.profile_id}
        onEndReached={() => {
          if (resultsQuery.hasNextPage && !resultsQuery.isFetchingNextPage) {
            void resultsQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <CandidateRow
            onSelect={() => handleSelect(item)}
            relationshipStatus={
              statesQuery.data?.get(item.profile_id)?.status ?? null
            }
            isBlocked={statesQuery.data?.get(item.profile_id)?.blocked ?? false}
            row={item}
          />
        )}
      />

      {!hasSearched ? (
        <View style={styles.footerNote}>
          <AppText align="center" color="muted" variant="caption">
            Se non lo trovi, potrai aggiungerlo manualmente e invitarlo.
          </AppText>
        </View>
      ) : null}

      {resultsQuery.isFetchingNextPage ? (
        <ActivityIndicator color={colors.accent} style={styles.pageSpinner} />
      ) : null}
    </Screen>
  );
}

/**
 * Riga di risultato. La CTA cambia con lo stato della relazione: un profilo già
 * collegato o con una richiesta aperta non può riceverne una seconda, e un
 * profilo bloccato non è collegabile affatto.
 */
function CandidateRow({
  isBlocked,
  onSelect,
  relationshipStatus,
  row,
}: {
  isBlocked: boolean;
  onSelect: () => void;
  relationshipStatus: "accepted" | "pending" | null;
  row: ProfileSearchRow;
}) {
  const meta = [
    row.primary_position ? getPlayerPositionLabel(row.primary_position) : null,
    row.current_team_name ?? row.current_club_name ?? row.current_category,
  ]
    .filter(Boolean)
    .join(" • ");

  // Omonimi: città e classe sono gli unici dati aggiuntivi mostrati, e solo
  // perché la ricerca pubblica li espone già.
  const disambiguation = [row.city ?? row.region, row.birth_year]
    .filter(Boolean)
    .join(" • ");

  const state = isBlocked
    ? "Non collegabile"
    : relationshipStatus === "accepted"
      ? "Già collegato"
      : relationshipStatus === "pending"
        ? "Richiesta in attesa"
        : null;

  return (
    <View style={styles.resultRow} testID={`assistiti-result-${row.profile_id}`}>
      <Avatar name={row.full_name} size="md" uri={row.avatar_url} />
      <View style={styles.resultBody}>
        <AppText numberOfLines={1} variant="titleSm">
          {row.full_name}
        </AppText>
        {meta ? (
          <AppText color="secondary" numberOfLines={1} variant="bodySm">
            {meta}
          </AppText>
        ) : null}
        {disambiguation ? (
          <AppText color="muted" numberOfLines={1} variant="caption">
            {disambiguation}
          </AppText>
        ) : null}
      </View>
      {state ? (
        <AppText color="muted" style={styles.resultState} variant="caption">
          {state}
        </AppText>
      ) : (
        <Button
          accessibilityLabel={`Seleziona ${row.full_name}`}
          label="Seleziona"
          onPress={onSelect}
          size="sm"
          testID={`assistiti-select-${row.profile_id}`}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyBlock: {
    alignItems: "center",
    gap: spacing[12],
    paddingVertical: spacing[24],
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  fallbackCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[16],
    gap: spacing[8],
    marginTop: spacing[16],
    padding: spacing[16],
  },
  footerNote: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing[12],
  },
  header: {
    gap: spacing[12],
    paddingBottom: spacing[12],
  },
  idleBlock: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[40],
  },
  intro: {
    gap: spacing[4],
  },
  listContent: {
    gap: spacing[8],
    paddingBottom: spacing[16],
  },
  pageSpinner: {
    paddingVertical: spacing[12],
  },
  resultBody: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  resultRow: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 64,
    paddingVertical: spacing[10],
  },
  resultState: {
    maxWidth: 108,
    textAlign: "right",
  },
});
