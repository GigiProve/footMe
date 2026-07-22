import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import {
  AppText,
  Avatar,
  ConfirmModal,
  EmptyState,
  Input,
  ModalHeader,
} from "../../../ui";
import { colors, radius, spacing } from "../../../theme/tokens";
import {
  formatLocation,
  formatPosition,
  formatRole,
} from "../../profiles/profile-display-helpers";
import {
  searchProfiles,
  type ProfileSearchResult,
} from "../../discovery/discovery-service";
import type { ShortlistEntry } from "../shortlist-service";

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export type AddProfileSearchTarget = {
  avatarUrl?: string | null;
  fullName: string;
  id: string;
  subtitle: string;
};

type AddProfileSearchModalProps = {
  /** Entries currently in the target list — drives client-side de-duplication. */
  entries: ShortlistEntry[];
  listId: string;
  listName: string;
  onClose: () => void;
  onDismiss?: () => void;
  /** Profile is NOT already in this list — hand off to the fixed-list evaluate step. */
  onRequestAddProfile: (profile: AddProfileSearchTarget) => void;
  /** Profile turned out to already be in this list and the user chose another list. */
  onRequestAddToOtherList: (profile: AddProfileSearchTarget) => void;
  visible: boolean;
};

function formatSearchSubtitle(result: ProfileSearchResult): string {
  const roleOrPosition =
    result.role === "player"
      ? formatPosition(result.primary_position)
      : formatRole(result.role);
  const location = formatLocation(result.city, result.region);

  return location === "Localita' non definita"
    ? roleOrPosition
    : `${roleOrPosition} • ${location}`;
}

type DuplicateState = {
  entryId: string;
  profile: AddProfileSearchTarget;
};

export function AddProfileSearchModal({
  entries,
  listId,
  listName,
  onClose,
  onDismiss,
  onRequestAddProfile,
  onRequestAddToOtherList,
  visible,
}: AddProfileSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateState | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setResults([]);
      setIsSearching(false);
      setDuplicate(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let isMounted = true;
    setIsSearching(true);

    const timeout = setTimeout(() => {
      async function runSearch() {
        try {
          const rows = await searchProfiles({
            position: "all",
            query,
            region: "",
            role: "all",
          });

          if (isMounted) {
            setResults(rows);
          }
        } catch {
          if (isMounted) {
            setResults([]);
          }
        } finally {
          if (isMounted) {
            setIsSearching(false);
          }
        }
      }

      void runSearch();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [query, visible]);

  // I profili già presenti nella lista restano visibili tra i risultati
  // (mockup schermata 18): al tap su "Aggiungi" si apre il dialog
  // "già presente" con le azioni "Apri nella shortlist" / "Aggiungi ad
  // altra lista". Vengono esclusi solo gli account società.
  const filteredResults = results.filter(
    (result) => result.role !== "club_admin",
  );

  function handleAddPress(result: ProfileSearchResult) {
    const target: AddProfileSearchTarget = {
      fullName: result.full_name,
      id: result.profile_id,
      subtitle: formatSearchSubtitle(result),
    };

    const existingEntry = entries.find(
      (entry) => entry.player_profile_id === result.profile_id,
    );

    if (existingEntry) {
      setDuplicate({ entryId: existingEntry.id, profile: target });
      return;
    }

    onRequestAddProfile(target);
  }

  return (
    <>
      <Modal
        animationType="slide"
        onDismiss={onDismiss}
        onRequestClose={onClose}
        visible={visible}
      >
        <SafeAreaView style={styles.root}>
          <ModalHeader onClose={onClose} title="Aggiungi profilo" />

          <View style={styles.searchWrapper}>
            <View style={styles.searchIconCircle}>
              <Ionicons color={colors.textMuted} name="search-outline" size={16} />
            </View>
            <View style={styles.searchInputSlot}>
              <Input
                autoFocus
                onChangeText={setQuery}
                placeholder="Cerca calciatore, allenatore o profilo..."
                value={query}
              />
            </View>
          </View>

          <FlatList
            contentContainerStyle={styles.listContent}
            data={filteredResults}
            keyExtractor={(item) => item.profile_id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              query.trim().length < MIN_QUERY_LENGTH ? (
                <AppText color="muted" style={styles.hint} variant="bodySm">
                  Cerca per nome, ruolo o posizione per trovare un profilo da
                  aggiungere alla lista.
                </AppText>
              ) : isSearching ? (
                <ActivityIndicator color={colors.accent} style={styles.spinner} />
              ) : (
                <EmptyState
                  description="Prova con un altro nome, ruolo o posizione."
                  icon="search-outline"
                  title="Nessun profilo trovato"
                />
              )
            }
            renderItem={({ item }) => (
              <View style={styles.resultRow}>
                <Avatar name={item.full_name} size="md" />
                <View style={styles.resultInfo}>
                  <AppText numberOfLines={1} variant="titleSm">
                    {item.full_name}
                  </AppText>
                  <AppText color="muted" numberOfLines={1} variant="bodySm">
                    {formatSearchSubtitle(item)}
                  </AppText>
                </View>
                <Pressable
                  accessibilityLabel={`Aggiungi ${item.full_name}`}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => handleAddPress(item)}
                  style={({ pressed }) => [
                    styles.addAction,
                    pressed ? styles.addActionPressed : null,
                  ]}
                >
                  <AppText color="accent" variant="bodySm">
                    Aggiungi
                  </AppText>
                  <Ionicons color={colors.accent} name="arrow-forward" size={16} />
                </Pressable>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>

      <ConfirmModal
        cancelLabel="Aggiungi ad altra lista"
        confirmLabel="Apri nella shortlist"
        message={
          duplicate
            ? `${duplicate.profile.fullName} è già presente in ${listName}.`
            : undefined
        }
        onCancel={() => {
          if (duplicate) {
            onRequestAddToOtherList(duplicate.profile);
          }
          setDuplicate(null);
        }}
        onConfirm={() => {
          if (!duplicate) {
            return;
          }

          const entryId = duplicate.entryId;
          setDuplicate(null);
          onClose();
          router.push(`/shortlist/entry/${entryId}?listId=${listId}` as never);
        }}
        title="Profilo già presente"
        visible={!!duplicate}
      />
    </>
  );
}

const styles = StyleSheet.create({
  addAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[8],
  },
  addActionPressed: {
    opacity: 0.7,
  },
  hint: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
    textAlign: "center",
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[20],
  },
  resultInfo: {
    flex: 1,
    gap: spacing[4],
  },
  resultRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  searchIconCircle: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 40,
    justifyContent: "center",
    marginTop: spacing[8],
    width: 40,
  },
  searchInputSlot: {
    flex: 1,
  },
  searchWrapper: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[8],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[4],
  },
  spinner: {
    marginTop: spacing[24],
  },
});
