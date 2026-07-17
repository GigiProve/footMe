import { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  InteractionManager,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../../components/ui/screen";
import { AppText, Button, EmptyState, ScreenHeader, Skeleton } from "../../../ui";
import { colors, radius, spacing } from "../../../theme/tokens";
import { useShortlistPermissions } from "../use-shortlist-permissions";
import {
  fetchClubShortlists,
  fetchShortlistEntries,
  getScopeLabel,
  type ShortlistEntry,
} from "../shortlist-service";
import { formatListSubtitle } from "../shortlist-display-helpers";
import {
  AddProfileSearchModal,
  type AddProfileSearchTarget,
} from "./AddProfileSearchModal";
import { AddToShortlistFlow } from "./AddToShortlistFlow";
import { ShortlistAccessDenied } from "./ShortlistAccessDenied";
import {
  ShortlistFilterChips,
  type ShortlistEntryFilter,
} from "./ShortlistFilterChips";
import { ShortlistEntryRow } from "./ShortlistEntryRow";

type AddFlowState = {
  mode: "fixed" | "picker";
  profile: AddProfileSearchTarget;
};

function filterEntries(
  entries: ShortlistEntry[],
  filter: ShortlistEntryFilter,
): ShortlistEntry[] {
  switch (filter) {
    case "alta_priorita":
      return entries.filter((entry) => entry.priority === "alta");
    case "da_valutare":
      return entries.filter((entry) => entry.evaluation_status === "da_valutare");
    case "da_contattare":
      return entries.filter((entry) => entry.evaluation_status === "da_contattare");
    case "contattato":
      return entries.filter((entry) => entry.evaluation_status === "contattato");
    case "scartato":
      return entries.filter((entry) => entry.evaluation_status === "scartato");
    default:
      return entries;
  }
}

export function ShortlistListDetailScreen() {
  const router = useRouter();
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const permissionsQuery = useShortlistPermissions();
  const permissions = permissionsQuery.data;
  const canView = !!permissions?.can_view;
  const clubId = permissions?.club_id;

  const [filter, setFilter] = useState<ShortlistEntryFilter>("all");
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [addFlow, setAddFlow] = useState<AddFlowState | null>(null);
  const pendingAddFlowRef = useRef<AddFlowState | null>(null);

  function applyPendingAddFlow() {
    if (pendingAddFlowRef.current) {
      setAddFlow(pendingAddFlowRef.current);
      pendingAddFlowRef.current = null;
    }
  }

  function requestAddFlow(mode: AddFlowState["mode"], profile: AddProfileSearchTarget) {
    pendingAddFlowRef.current = { mode, profile };
    setSearchModalVisible(false);

    if (Platform.OS === "android") {
      InteractionManager.runAfterInteractions(applyPendingAddFlow);
    }
  }

  const listsQuery = useQuery({
    enabled: !!clubId && canView,
    queryFn: () => fetchClubShortlists(clubId as string),
    queryKey: ["shortlists", clubId ?? "none"],
  });

  const entriesQuery = useQuery({
    enabled: !!listId && canView,
    queryFn: () => fetchShortlistEntries(listId as string),
    queryKey: ["shortlist-entries", listId ?? "none"],
  });

  if (permissionsQuery.isLoading) {
    return (
      <Screen>
        <HeaderRow onBack={() => router.back()} title="Lista" />
        <Skeleton.Card />
      </Screen>
    );
  }

  if (!permissions || !canView) {
    return (
      <Screen>
        <HeaderRow onBack={() => router.back()} title="Lista" />
        <ShortlistAccessDenied />
      </Screen>
    );
  }

  const list = listsQuery.data?.find((item) => item.id === listId);
  const entries = entriesQuery.data ?? [];
  const filteredEntries = filterEntries(entries, filter);

  return (
    <Screen>
      <HeaderRow onBack={() => router.back()} title={list?.name ?? "Lista"} />

      {list ? (
        <AppText color="muted" style={styles.subheader} variant="bodySm">
          {`${getScopeLabel(list.scope)} • ${formatListSubtitle(list)}`}
        </AppText>
      ) : null}

      <View style={styles.lockRow}>
        <Ionicons color={colors.textMuted} name="lock-closed-outline" size={14} />
        <AppText color="muted" variant="caption">
          Visibile solo agli utenti autorizzati.
        </AppText>
      </View>

      <View style={styles.filtersWrapper}>
        <ShortlistFilterChips onChange={setFilter} value={filter} />
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={filteredEntries}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          entriesQuery.isLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <EmptyState
              action={
                permissions.can_add_profiles ? (
                  <Button
                    label="+ Aggiungi profilo"
                    onPress={() => setSearchModalVisible(true)}
                    variant="primary"
                  />
                ) : undefined
              }
              icon="people-outline"
              title="Nessun profilo in questa lista"
              description="Aggiungi calciatori interessanti per iniziare la valutazione interna."
            />
          )
        }
        renderItem={({ item }) => (
          <ShortlistEntryRow entry={item} listId={listId as string} />
        )}
      />

      {permissions.can_add_profiles ? (
        <Button
          label="+ Aggiungi profilo"
          onPress={() => setSearchModalVisible(true)}
          style={styles.footerButton}
          variant="outline"
        />
      ) : null}

      <AddProfileSearchModal
        entries={entries}
        listId={listId as string}
        listName={list?.name ?? "Lista"}
        onClose={() => setSearchModalVisible(false)}
        onDismiss={applyPendingAddFlow}
        onRequestAddProfile={(profile) => requestAddFlow("fixed", profile)}
        onRequestAddToOtherList={(profile) => requestAddFlow("picker", profile)}
        visible={searchModalVisible}
      />

      {addFlow ? (
        <AddToShortlistFlow
          clubId={clubId as string}
          fixedList={
            addFlow.mode === "fixed"
              ? { id: (listId as string), name: list?.name ?? "Lista" }
              : undefined
          }
          initialMode="picker"
          onClose={() => setAddFlow(null)}
          open
          permissions={permissions}
          profile={addFlow.profile}
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
  filtersWrapper: {
    marginBottom: spacing[8],
  },
  footerButton: {
    marginTop: spacing[12],
  },
  headerRow: {
    marginBottom: spacing[4],
  },
  listContent: {
    paddingBottom: spacing[24],
  },
  lockRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    marginBottom: spacing[12],
  },
  pressed: {
    opacity: 0.75,
  },
  subheader: {
    marginBottom: spacing[8],
  },
});
