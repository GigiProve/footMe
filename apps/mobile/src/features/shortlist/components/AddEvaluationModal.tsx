import { useEffect, useState } from "react";
import { Modal, SafeAreaView, StyleSheet, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AppText, Badge, Button, Divider, ModalHeader, useToast } from "../../../ui";
import { colors, spacing } from "../../../theme/tokens";
import {
  addShortlistEntry,
  getEvaluationStatusLabel,
  getPriorityLabel,
  type ShortlistEvaluationStatus,
  type ShortlistPriority,
} from "../shortlist-service";
import { getPriorityBadgeVariant, getStatusBadgeVariant } from "../shortlist-display-helpers";
import { EvaluationFields } from "./EvaluationFields";
import { ProfileSummaryCard } from "./ProfileSummaryCard";

type AddEvaluationModalProfile = {
  avatarUrl?: string | null;
  fullName: string;
  id: string;
  subtitle: string;
};

type AddEvaluationModalProps = {
  canAddNotes: boolean;
  clubId: string;
  currentUserId: string;
  listId: string;
  listName: string;
  onBackToPicker: () => void;
  onCloseFlow: () => void;
  onDismiss?: () => void;
  profile: AddEvaluationModalProfile;
  visible: boolean;
};

export function AddEvaluationModal({
  canAddNotes,
  clubId,
  currentUserId,
  listId,
  listName,
  onBackToPicker,
  onCloseFlow,
  onDismiss,
  profile,
  visible,
}: AddEvaluationModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [step, setStep] = useState<"form" | "success">("form");
  const [priority, setPriority] = useState<ShortlistPriority>("media");
  const [status, setStatus] = useState<ShortlistEvaluationStatus>("da_valutare");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!visible) {
      setStep("form");
      setPriority("media");
      setStatus("da_valutare");
      setNote("");
    }
  }, [visible]);

  const mutation = useMutation({
    mutationFn: () =>
      addShortlistEntry(listId, profile.id, currentUserId, {
        evaluationStatus: status,
        internalNote: canAddNotes ? note : undefined,
        priority,
      }),
    onError: (error) => {
      showToast({
        message:
          error instanceof Error
            ? error.message
            : "Impossibile aggiungere il profilo alla shortlist.",
        tone: "neutral",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shortlist-entries", listId] });
      queryClient.invalidateQueries({ queryKey: ["shortlists", clubId] });
      queryClient.invalidateQueries({ queryKey: ["shortlist-overview", clubId] });
      queryClient.invalidateQueries({
        queryKey: ["shortlist-memberships", profile.id],
      });
      setStep("success");
    },
  });

  return (
    <Modal
      animationType="slide"
      onDismiss={onDismiss}
      onRequestClose={onBackToPicker}
      visible={visible}
    >
      <SafeAreaView style={styles.root}>
        {step === "form" ? (
          <>
            <ModalHeader onClose={onBackToPicker} title="Aggiungi a shortlist" />
            <View style={styles.scrollContent}>
              <ProfileSummaryCard
                avatarUrl={profile.avatarUrl}
                fullName={profile.fullName}
                subtitle={profile.subtitle}
              />
              <View style={styles.selectedListRow}>
                <AppText color="muted" variant="bodySm">
                  Lista selezionata:{" "}
                </AppText>
                <AppText variant="titleSm">{listName}</AppText>
              </View>
              <EvaluationFields
                canEditNote={canAddNotes}
                canEditStatus
                note={note}
                onNoteChange={setNote}
                onPriorityChange={setPriority}
                onStatusChange={setStatus}
                priority={priority}
                status={status}
              />
            </View>
            <View style={styles.footer}>
              <Button
                disabled={mutation.isPending}
                label={mutation.isPending ? "Aggiunta in corso..." : "Aggiungi alla shortlist"}
                onPress={() => mutation.mutate()}
                variant="primary"
              />
            </View>
          </>
        ) : (
          <>
            <ModalHeader onClose={onCloseFlow} title="Aggiunto alla shortlist" />
            <View style={styles.successContent}>
              <Ionicons color={colors.success} name="checkmark-circle" size={72} />
              <AppText align="center" variant="headingSm">
                Aggiunto alla shortlist
              </AppText>
              <AppText align="center" color="muted" variant="bodySm">
                {profile.fullName} è stato aggiunto a:
              </AppText>
              <AppText align="center" variant="titleMd">
                {listName}
              </AppText>

              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <AppText color="muted" variant="bodySm">
                    Priorità
                  </AppText>
                  <Badge label={getPriorityLabel(priority)} variant={getPriorityBadgeVariant(priority)} />
                </View>
                <Divider spacing={8} />
                <View style={styles.summaryRow}>
                  <AppText color="muted" variant="bodySm">
                    Stato
                  </AppText>
                  <Badge label={getEvaluationStatusLabel(status)} variant={getStatusBadgeVariant(status)} />
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons color={colors.textMuted} name="information-circle-outline" size={16} />
                <AppText color="muted" style={styles.infoText} variant="caption">
                  Operazione interna alla società. {profile.fullName} non riceverà notifiche.
                </AppText>
              </View>

              <Button
                fullWidth
                label="Vedi shortlist"
                onPress={() => {
                  onCloseFlow();
                  router.push(`/shortlist/${listId}` as never);
                }}
                variant="primary"
              />
              <Button fullWidth label="Torna al profilo" onPress={onCloseFlow} variant="link" />
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
  },
  infoRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[8],
  },
  infoText: {
    flex: 1,
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    gap: spacing[20],
    padding: spacing[20],
  },
  selectedListRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing[8],
    padding: spacing[16],
    width: "100%",
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  successContent: {
    alignItems: "center",
    flex: 1,
    gap: spacing[16],
    paddingHorizontal: spacing[24],
    paddingTop: spacing[24],
  },
});
