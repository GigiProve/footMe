/**
 * SCREEN 1 — Hub assistiti (REV-PROF-14).
 *
 * È l'unico elenco gestionale del procuratore: relazioni e record manuali
 * arrivano dalla stessa RPC, i conteggi da una seconda RPC. Nessun numero viene
 * calcolato contando la lista a schermo, perché la lista è filtrata e i
 * conteggi no.
 *
 * "+ Aggiungi assistito" apre direttamente la ricerca: non esiste nessuna
 * schermata di scelta fra "cerca" e "inserisci a mano", e l'inserimento manuale
 * compare solo dopo che una ricerca è stata davvero eseguita.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../src/components/ui/screen";
import { AppText, Button, EmptyState, ScreenHeader } from "../../src/ui";
import { useSession } from "../../src/features/auth/use-session";
import { trackAssistitiEvent } from "../../src/features/relationships/assistiti/assistiti-analytics";
import {
  EMPTY_ASSISTITI_COUNTS,
  filterAssistiti,
  type AssistitiFilter,
} from "../../src/features/relationships/assistiti/assistiti-model";
import {
  assistitiQueryKeys,
  fetchAssistitiCounts,
  fetchAssistitiOverview,
} from "../../src/features/relationships/assistiti/assistiti-service";
import {
  AssistitiFilterChips,
  AssistitiSkeleton,
  AssistitoCard,
  BackButton,
  PortfolioCounts,
  SectionError,
} from "../../src/features/relationships/assistiti/assistiti-ui";
import { colors, radius, spacing } from "../../src/theme/tokens";

export default function AssistitiHubScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const params = useLocalSearchParams<{ source?: string }>();
  const agentProfileId = profile?.id ?? "";

  const [filter, setFilter] = useState<AssistitiFilter>("all");

  const countsQuery = useQuery({
    enabled: Boolean(agentProfileId),
    queryFn: () => fetchAssistitiCounts(agentProfileId),
    queryKey: assistitiQueryKeys.counts(agentProfileId),
  });

  const overviewQuery = useQuery({
    enabled: Boolean(agentProfileId),
    queryFn: () => fetchAssistitiOverview(agentProfileId),
    queryKey: assistitiQueryKeys.overview(agentProfileId),
  });

  useEffect(() => {
    trackAssistitiEvent("assistiti_hub_opened", {
      source: typeof params.source === "string" ? params.source : "profile",
    });
    // Una sola volta per apertura: la sorgente non cambia mentre la schermata
    // è montata, e un secondo evento falserebbe il conteggio delle aperture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tornando da richiesta, invito o dettaglio i numeri devono essere già
  // aggiornati: è l'unico modo perché il portfolio non menta per un attimo.
  useFocusEffect(
    useCallback(() => {
      if (!agentProfileId) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: assistitiQueryKeys.counts(agentProfileId),
      });
      void queryClient.invalidateQueries({
        queryKey: assistitiQueryKeys.overview(agentProfileId),
      });
    }, [agentProfileId, queryClient]),
  );

  const rows = useMemo(
    () => filterAssistiti(overviewQuery.data ?? [], filter),
    [filter, overviewQuery.data],
  );

  const counts = countsQuery.data ?? EMPTY_ASSISTITI_COUNTS;
  const pendingTotal = counts.pending_count + counts.invite_count;

  function handleFilterChange(next: AssistitiFilter) {
    setFilter(next);
    trackAssistitiEvent("assistiti_filter_changed", { filter: next });
  }

  function handleAdd() {
    trackAssistitiEvent("assistiti_add_tapped", { source: "hub" });
    router.push("/representation/add" as never);
  }

  function handleOpenRow(id: string, kind: "manual" | "representation") {
    router.push(
      (kind === "manual"
        ? `/representation/invite/${id}`
        : `/representation/assistito/${id}`) as never,
    );
  }

  function handleFinish() {
    trackAssistitiEvent("assistiti_hub_completed");
    router.back();
  }

  const isLoading = overviewQuery.isLoading || countsQuery.isLoading;
  const hasFailed = overviewQuery.isError;

  return (
    <Screen>
      <ScreenHeader
        leading={<BackButton onPress={() => router.back()} />}
        title="Gestisci assistiti"
      />

      <FlatList
        ListEmptyComponent={
          isLoading || hasFailed ? null : (
            <EmptyState
              action={
                filter === "all" ? (
                  <Button
                    label="Aggiungi assistito"
                    onPress={handleAdd}
                    testID="assistiti-empty-cta"
                  />
                ) : undefined
              }
              description={
                filter === "all"
                  ? "Cerca i Calciatori che segui e invia una richiesta di collegamento."
                  : "Nessun assistito in questa selezione."
              }
              icon="people-outline"
              title={
                filter === "all"
                  ? "Costruisci il tuo portfolio"
                  : "Nessun risultato"
              }
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText variant="screenTitle">Il tuo portfolio</AppText>

            <PortfolioCounts counts={counts} isLoading={countsQuery.isLoading} />

            {countsQuery.isError ? (
              <SectionError
                message="Non è stato possibile caricare i conteggi."
                onRetry={() => void countsQuery.refetch()}
              />
            ) : null}

            <AssistitiFilterChips onChange={handleFilterChange} value={filter} />

            <Pressable
              accessibilityLabel={`Richieste e inviti, ${pendingTotal} in attesa`}
              accessibilityRole="button"
              onPress={() => router.push("/representation/requests" as never)}
              style={({ pressed }) => [
                styles.requestsRow,
                pressed ? styles.pressed : null,
              ]}
              testID="assistiti-open-requests"
            >
              <Ionicons
                color={colors.accent}
                name="paper-plane-outline"
                size={18}
              />
              <AppText style={styles.requestsLabel} variant="titleSm">
                Richieste e inviti
              </AppText>
              {pendingTotal > 0 ? (
                <AppText color="accent" variant="metaStrong">
                  {String(pendingTotal)}
                </AppText>
              ) : null}
              <Ionicons
                color={colors.textMuted}
                name="chevron-forward"
                size={18}
              />
            </Pressable>

            {hasFailed ? (
              <SectionError
                message="Non è stato possibile caricare gli assistiti."
                onRetry={() => void overviewQuery.refetch()}
              />
            ) : null}

            {isLoading ? <AssistitiSkeleton /> : null}
          </View>
        }
        contentContainerStyle={styles.listContent}
        data={isLoading || hasFailed ? [] : rows}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        renderItem={({ item }) => (
          <AssistitoCard
            onPress={() => handleOpenRow(item.id, item.kind)}
            row={item}
          />
        )}
      />

      <View style={styles.footer}>
        <Button
          fullWidth
          label="+ Aggiungi assistito"
          onPress={handleAdd}
          testID="assistiti-add-cta"
          variant="outline"
        />
        <Button
          fullWidth
          label="Fine"
          onPress={handleFinish}
          testID="assistiti-finish"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing[8],
    paddingTop: spacing[12],
  },
  header: {
    gap: spacing[16],
    paddingBottom: spacing[8],
  },
  listContent: {
    gap: spacing[8],
    paddingBottom: spacing[16],
  },
  pressed: {
    opacity: 0.6,
  },
  requestsLabel: {
    flex: 1,
  },
  requestsRow: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[10],
    minHeight: 48,
    paddingHorizontal: spacing[12],
  },
});
