import { ScrollView, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { spacing } from "../../../theme/tokens";
import { AppText, Button, EmptyState, Skeleton } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { searchPositionsForYou } from "../search-service";
import type { PositionSearchRow } from "../search-types";
import { forYouQueryKey } from "./positions-criteria";
import { profileAreaLabel, roleSummaryLabel } from "./positions-labels";
import { usePositionsSearch } from "./positions-search-context";
import { PositionPreviewRow } from "./PositionPreviewRow";
import { useToggleSavedPosition } from "./use-toggle-saved-position";

type ForYouTabProps = {
  onOpenEdit: () => void;
};

export function ForYouTab({ onOpenEdit }: ForYouTabProps) {
  const router = useRouter();
  const { profile } = useSession();
  const profileId = profile?.id ?? null;
  const { criteria, isSeeded } = usePositionsSearch();
  const toggleSaved = useToggleSavedPosition();

  const forYou = useQuery({
    enabled: isSeeded && !!profileId,
    queryFn: () =>
      searchPositionsForYou({
        compatiblePositions: criteria.compatiblePositions,
        primaryPositions: criteria.primaryPositions,
        regions: criteria.profileRegions,
        target: criteria.target,
      }),
    queryKey: forYouQueryKey(profileId, criteria),
  });

  function renderRow(row: PositionSearchRow) {
    return (
      <PositionPreviewRow
        key={row.ad_id}
        onPress={() => router.push(`/position/${row.ad_id}` as never)}
        onToggleSaved={() =>
          toggleSaved.mutate({ adId: row.ad_id, saved: row.is_saved })
        }
        row={row}
      />
    );
  }

  const primary = forYou.data?.primary ?? [];
  const suggestions = forYou.data?.suggestions ?? [];
  const isEmpty = !forYou.isLoading && primary.length === 0 && suggestions.length === 0;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.intro}>
        <AppText variant="headingSm">Posizioni per te</AppText>
        <AppText color="muted" variant="bodySm">
          Risultati selezionati in base al tuo ruolo e alla tua disponibilità.
        </AppText>
        <View style={styles.summaryRow}>
          <AppText numberOfLines={1} style={styles.summary} variant="bodyLg">
            {roleSummaryLabel(criteria)} · {profileAreaLabel(criteria)}
          </AppText>
          <Button label="Modifica ricerca" onPress={onOpenEdit} size="sm" variant="link" />
        </View>
      </View>

      {forYou.isLoading ? (
        <View style={styles.loader}>
          <Skeleton.Row />
          <Skeleton.Row />
          <Skeleton.Row />
        </View>
      ) : isEmpty ? (
        <EmptyState
          action={<Button label="Modifica ricerca" onPress={onOpenEdit} variant="outline" />}
          description="Prova a modificare il ruolo o l'area di ricerca."
          icon="search-outline"
          title="Nessuna posizione trovata"
        />
      ) : (
        <>
          <View style={styles.section}>{primary.map(renderRow)}</View>

          {suggestions.length > 0 ? (
            <View style={styles.section}>
              <AppText style={styles.sectionTitle} variant="titleSm">
                Potrebbero interessarti anche
              </AppText>
              {suggestions.map(renderRow)}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[16],
    paddingBottom: spacing[24],
  },
  intro: {
    gap: spacing[8],
  },
  loader: {
    gap: spacing[8],
  },
  section: {
    gap: spacing[4],
  },
  sectionTitle: {
    marginBottom: spacing[4],
    marginTop: spacing[8],
  },
  summary: {
    flex: 1,
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
});
