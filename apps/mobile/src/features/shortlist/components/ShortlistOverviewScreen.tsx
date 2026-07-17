import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../../components/ui/screen";
import { AppText, Button, EmptyState, ScreenHeader, Skeleton, StatCard } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { colors, radius, spacing } from "../../../theme/tokens";
import { useShortlistPermissions } from "../use-shortlist-permissions";
import {
  fetchClubShortlists,
  fetchShortlistOverviewCounts,
} from "../shortlist-service";
import { ShortlistAccessDenied } from "./ShortlistAccessDenied";
import { ShortlistListRow } from "./ShortlistListRow";
import { CreateListModal } from "./CreateListModal";

export function ShortlistOverviewScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const permissionsQuery = useShortlistPermissions();
  const permissions = permissionsQuery.data;
  const canView = !!permissions?.can_view;
  const clubId = permissions?.club_id;

  const [isCreateOpen, setCreateOpen] = useState(false);

  const overviewQuery = useQuery({
    enabled: !!clubId && canView,
    queryFn: () => fetchShortlistOverviewCounts(clubId as string),
    queryKey: ["shortlist-overview", clubId ?? "none"],
  });

  const listsQuery = useQuery({
    enabled: !!clubId && canView,
    queryFn: () => fetchClubShortlists(clubId as string),
    queryKey: ["shortlists", clubId ?? "none"],
  });

  if (permissionsQuery.isLoading) {
    return (
      <Screen>
        <HeaderRow onBack={() => router.back()} title="Shortlist" />
        <Skeleton.Card />
      </Screen>
    );
  }

  if (!permissions || !canView) {
    return (
      <Screen>
        <HeaderRow onBack={() => router.back()} title="Shortlist" />
        <ShortlistAccessDenied />
      </Screen>
    );
  }

  const counts = overviewQuery.data;
  const lists = listsQuery.data ?? [];

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={lists}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          listsQuery.isLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <EmptyState
              icon="clipboard-outline"
              title="Nessuna lista creata"
              description="Crea la prima shortlist per iniziare a organizzare i profili osservati."
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <HeaderRow onBack={() => router.back()} title="Shortlist" />
            <AppText color="muted" style={styles.intro} variant="bodySm">
              Organizza profili interessanti, note interne e valutazioni della società.
            </AppText>
            <View style={styles.lockRow}>
              <Ionicons color={colors.textMuted} name="lock-closed-outline" size={14} />
              <AppText color="muted" variant="caption">
                Visibile solo agli utenti autorizzati.
              </AppText>
            </View>
            <View style={styles.statsGrid}>
              <StatCard
                label="Liste attive"
                style={styles.statCard}
                value={String(counts?.lists_count ?? 0)}
              />
              <StatCard
                label="Profili totali"
                style={styles.statCard}
                value={String(counts?.total_entries ?? 0)}
              />
              <StatCard
                label="Da contattare"
                style={styles.statCard}
                value={String(counts?.da_contattare_count ?? 0)}
              />
              <StatCard
                label="Priorità alta"
                style={styles.statCard}
                value={String(counts?.alta_count ?? 0)}
              />
            </View>
            {permissions.can_create_lists ? (
              <Button
                label="+ Crea lista"
                onPress={() => setCreateOpen(true)}
                style={styles.createButton}
                variant="primary"
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => <ShortlistListRow list={item} />}
      />

      {clubId && profile ? (
        <CreateListModal
          clubId={clubId}
          createdByProfileId={profile.id}
          onClose={() => setCreateOpen(false)}
          visible={isCreateOpen}
        />
      ) : null}
    </Screen>
  );
}

function HeaderRow({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.headerRow}>
      <ScreenHeader
        action={
          <Pressable
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
          </Pressable>
        }
        title={title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  createButton: {
    marginTop: spacing[4],
  },
  headerBlock: {
    gap: spacing[16],
    marginBottom: spacing[16],
  },
  headerRow: {
    marginBottom: spacing[4],
  },
  intro: {
    marginTop: spacing[4],
  },
  listContent: {
    paddingBottom: spacing[24],
  },
  lockRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  pressed: {
    opacity: 0.75,
  },
  statCard: {
    flexBasis: "48%",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[12],
  },
});
