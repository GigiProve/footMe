import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useSession } from "../auth/use-session";
import { getPlayerPositionLabel } from "../profiles/player-sports";
import { APPLICATION_STATUS_LABELS } from "../recruiting/recruiting-service";
import { DashboardEntityRow } from "../dashboard/components/DashboardEntityRow";
import { colors, radius, spacing } from "../../theme/tokens";
import { AppText, EmptyState, ScreenHeader, TabBar } from "../../ui";
import {
  APPLICATIONS_PAGE_SIZE,
  fetchMyApplications,
  type ApplicationFilter,
  type ApplicationListItem,
} from "./applications-service";

const FILTERS = [
  { label: "Attive", value: "active" as const },
  { label: "Tutte", value: "all" as const },
];

function resolveFilter(value: string | undefined): ApplicationFilter {
  return value === "all" || value === "active" ? value : "active";
}

/**
 * "Le mie candidature" (DAS-REV-03 §9, §20).
 *
 * Destinazione di "Vedi tutte" e della metrica "Candidature attive". Il
 * filtro di default segue il parametro: la metrica apre `?filter=active`, così
 * il numero e la lista che si apre hanno lo stesso perimetro — §7 è esplicito
 * su questo, ed è il modo più comune di rendere un conteggio inspiegabile.
 *
 * È il **minimo funzionante** richiesto da §4: lista, stato canonico, accesso
 * al dettaglio. Ritiro, storico, valutazione e filtri avanzati sono di
 * DAS-REV-04 e non vengono anticipati qui.
 */
export function MyApplicationsScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const profileId = profile?.id ?? null;
  const params = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<ApplicationFilter>(
    resolveFilter(typeof params.filter === "string" ? params.filter : undefined),
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      enabled: !!profileId,
      initialPageParam: 0,
      queryFn: ({ pageParam }: { pageParam: number }) =>
        fetchMyApplications(profileId as string, filter, pageParam),
      queryKey: ["my-applications", profileId, filter],
      getNextPageParam: (
        lastPage: ApplicationListItem[],
        allPages: ApplicationListItem[][],
      ) =>
        lastPage.length === APPLICATIONS_PAGE_SIZE ? allPages.length : undefined,
    });

  const items = data?.pages.flat() ?? [];

  return (
    <>
      <View style={styles.headerRow}>
        <ScreenHeader
          title="Le mie candidature"
          action={
            <Pressable
              accessibilityLabel="Indietro"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
            </Pressable>
          }
        />
      </View>

      <TabBar
        active={filter}
        items={FILTERS}
        onChange={setFilter}
        style={styles.tabs}
      />

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          description="Le candidature che invii compaiono qui con il loro stato."
          icon="document-text-outline"
          title="Nessuna candidatura"
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={items}
          keyExtractor={(item) => item.id}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              void fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color={colors.accent} style={styles.footer} />
            ) : null
          }
          renderItem={({ index, item }) => (
            <DashboardEntityRow
              avatarName={item.clubName}
              avatarUrl={item.clubLogoUrl}
              meta={[item.clubName, item.teamName].filter(Boolean).join(" · ")}
              onPress={() => router.push(`/applications/${item.id}` as never)}
              showDivider={index > 0}
              status={
                APPLICATION_STATUS_LABELS[
                  item.status as keyof typeof APPLICATION_STATUS_LABELS
                ] ?? null
              }
              statusPlacement="trailing"
              title={getPlayerPositionLabel(item.role, item.role)}
            />
          )}
        />
      )}

      <AppText color="muted" style={styles.note} variant="caption">
        Solo tu vedi le tue candidature.
      </AppText>
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    marginBottom: spacing[12],
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  tabs: {
    marginBottom: spacing[8],
  },
  loader: {
    paddingVertical: spacing[32],
  },
  list: {
    paddingBottom: spacing[24],
  },
  footer: {
    paddingVertical: spacing[16],
  },
  note: {
    paddingVertical: spacing[8],
  },
  pressed: {
    opacity: 0.75,
  },
});
