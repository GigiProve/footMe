import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../../components/ui/screen";
import {
  AppText,
  Avatar,
  Badge,
  Button,
  ConfirmModal,
  Divider,
  EmptyState,
  ScreenHeader,
  SectionCard,
  Skeleton,
  useToast,
} from "../../../ui";
import { colors, radius, spacing } from "../../../theme/tokens";
import { useShortlistPermissions } from "../use-shortlist-permissions";
import {
  fetchClubShortlists,
  fetchShortlistEntries,
  getEvaluationStatusLabel,
  getPriorityLabel,
  removeShortlistEntry,
} from "../shortlist-service";
import {
  formatAddedDate,
  formatEntrySubtitle,
  getPriorityBadgeVariant,
  getStatusBadgeVariant,
} from "../shortlist-display-helpers";
import { ShortlistAccessDenied } from "./ShortlistAccessDenied";
import { EditEvaluationModal } from "./EditEvaluationModal";

export function ShortlistEntryDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { entryId, listId } = useLocalSearchParams<{
    entryId: string;
    listId?: string;
  }>();

  const permissionsQuery = useShortlistPermissions();
  const permissions = permissionsQuery.data;
  const canView = !!permissions?.can_view;
  const clubId = permissions?.club_id;

  const [isEditOpen, setEditOpen] = useState(false);
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  const entriesQuery = useQuery({
    enabled: !!listId && canView,
    queryFn: () => fetchShortlistEntries(listId as string),
    queryKey: ["shortlist-entries", listId ?? "none"],
  });

  const listsQuery = useQuery({
    enabled: !!clubId && canView,
    queryFn: () => fetchClubShortlists(clubId as string),
    queryKey: ["shortlists", clubId ?? "none"],
  });

  const removeMutation = useMutation({
    mutationFn: () => removeShortlistEntry(entryId as string),
    onError: (error) => {
      showToast({
        message:
          error instanceof Error
            ? error.message
            : "Impossibile rimuovere il profilo.",
        tone: "neutral",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shortlist-entries", listId] });
      queryClient.invalidateQueries({ queryKey: ["shortlists", clubId] });
      queryClient.invalidateQueries({ queryKey: ["shortlist-overview", clubId] });

      if (entry) {
        queryClient.invalidateQueries({
          queryKey: ["shortlist-memberships", entry.player_profile_id],
        });
      }

      showToast({ message: "Rimosso dalla shortlist", tone: "success" });
      setConfirmOpen(false);
      router.back();
    },
  });

  if (permissionsQuery.isLoading) {
    return (
      <Screen>
        <HeaderRow onBack={() => router.back()} title="Profilo" />
        <Skeleton.Card />
      </Screen>
    );
  }

  if (!permissions || !canView) {
    return (
      <Screen>
        <HeaderRow onBack={() => router.back()} title="Profilo" />
        <ShortlistAccessDenied />
      </Screen>
    );
  }

  const entry = entriesQuery.data?.find((item) => item.id === entryId);
  const list = listsQuery.data?.find((item) => item.id === listId);

  if (!entry) {
    return (
      <Screen>
        <HeaderRow onBack={() => router.back()} title="Profilo" />
        {entriesQuery.isLoading ? (
          <Skeleton.Card />
        ) : (
          <EmptyState
            description="La voce potrebbe essere stata rimossa dalla lista."
            icon="alert-circle-outline"
            title="Profilo non trovato"
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <HeaderRow onBack={() => router.back()} title={entry.full_name ?? "Profilo"} />

        {list ? (
          <AppText color="muted" style={styles.listLabel} variant="bodySm">
            {`Shortlist: ${list.name}`}
          </AppText>
        ) : null}

        <View style={styles.profileBlock}>
          <Avatar name={entry.full_name ?? undefined} size="xl" uri={entry.avatar_url} />
          <AppText style={styles.profileName} variant="titleMd">
            {entry.full_name ?? "Profilo"}
          </AppText>
          <AppText color="muted" variant="bodySm">
            {formatEntrySubtitle(entry)}
          </AppText>
          <Button
            label="Apri profilo"
            onPress={() =>
              router.push(`/profile/${entry.player_profile_id}` as never)
            }
            style={styles.openProfileButton}
            variant="outline"
          />
        </View>

        <SectionCard title="Valutazione interna">
          <View style={styles.evalRow}>
            <AppText color="muted" variant="bodySm">
              Priorità
            </AppText>
            <Badge
              label={getPriorityLabel(entry.priority)}
              variant={getPriorityBadgeVariant(entry.priority)}
            />
          </View>
          <View style={styles.evalRow}>
            <AppText color="muted" variant="bodySm">
              Stato valutazione
            </AppText>
            <Badge
              label={getEvaluationStatusLabel(entry.evaluation_status)}
              variant={getStatusBadgeVariant(entry.evaluation_status)}
            />
          </View>
          <View style={styles.evalRow}>
            <AppText color="muted" variant="bodySm">
              Aggiunto da
            </AppText>
            <AppText variant="bodySm">
              {entry.added_by_full_name ?? "Utente rimosso"}
            </AppText>
          </View>
          <View style={styles.evalRow}>
            <AppText color="muted" variant="bodySm">
              Data inserimento
            </AppText>
            <AppText variant="bodySm">{formatAddedDate(entry.created_at)}</AppText>
          </View>
          <Divider />
          <View style={styles.noteBlock}>
            <AppText variant="bodySm">Nota interna:</AppText>
            <AppText color="muted" variant="bodySm">
              {entry.internal_note ?? "—"}
            </AppText>
          </View>
        </SectionCard>

        <View style={styles.lockRow}>
          <Ionicons color={colors.textMuted} name="lock-closed-outline" size={14} />
          <AppText color="muted" style={styles.lockText} variant="caption">
            Queste informazioni sono visibili solo agli utenti autorizzati della società.
          </AppText>
        </View>

        {permissions.can_edit_status || permissions.can_add_notes ? (
          <Button
            fullWidth
            label="Modifica valutazione"
            onPress={() => setEditOpen(true)}
            style={styles.actionButton}
            variant="primary"
          />
        ) : null}

        {permissions.can_remove_profiles ? (
          <Button
            fullWidth
            label="Rimuovi dalla shortlist"
            onPress={() => setConfirmOpen(true)}
            style={styles.actionButton}
            variant="danger"
          />
        ) : null}
      </ScrollView>

      {clubId ? (
        <EditEvaluationModal
          canAddNotes={permissions.can_add_notes}
          canEditStatus={permissions.can_edit_status}
          clubId={clubId}
          entry={entry}
          listId={listId as string}
          listName={list?.name ?? ""}
          onClose={() => setEditOpen(false)}
          visible={isEditOpen}
        />
      ) : null}

      <ConfirmModal
        cancelLabel="Annulla"
        confirmLabel="Rimuovi"
        isBusy={removeMutation.isPending}
        message={`${entry.full_name ?? "Il profilo"} verrà rimosso da ${
          list?.name ?? "questa lista"
        }. Le note interne associate a questa lista non saranno più visibili in questa shortlist.`}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => removeMutation.mutate()}
        title="Rimuovere dalla shortlist?"
        visible={isConfirmOpen}
      />
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
  actionButton: {
    marginTop: spacing[8],
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  evalRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerRow: {
    marginBottom: spacing[4],
  },
  listLabel: {
    marginBottom: spacing[8],
  },
  lockRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[6],
    marginVertical: spacing[16],
  },
  lockText: {
    flex: 1,
  },
  noteBlock: {
    gap: spacing[4],
  },
  openProfileButton: {
    marginTop: spacing[8],
  },
  pressed: {
    opacity: 0.75,
  },
  profileBlock: {
    alignItems: "center",
    gap: spacing[6],
    marginBottom: spacing[20],
  },
  profileName: {
    marginTop: spacing[8],
  },
  scrollContent: {
    paddingBottom: spacing[32],
  },
});
