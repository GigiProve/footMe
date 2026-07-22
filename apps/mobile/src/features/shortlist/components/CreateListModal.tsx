import { useEffect, useState } from "react";
import { Modal, SafeAreaView, StyleSheet, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { KeyboardAwareForm } from "../../../components/ui/keyboard-aware-form";
import { AppText, Button, Divider, Input, ModalHeader, Radio, useToast } from "../../../ui";
import { colors, spacing } from "../../../theme/tokens";
import {
  createShortlist,
  getScopeLabel,
  type ShortlistScope,
} from "../shortlist-service";

const SCOPES: ShortlistScope[] = [
  "tutta_la_societa",
  "prima_squadra",
  "juniores",
  "under_17",
  "under_15",
];

type CreateListModalProps = {
  clubId: string;
  createdByProfileId: string;
  onClose: () => void;
  onCreated?: (listId: string) => void;
  onDismiss?: () => void;
  successMode?: "panel" | "skip";
  visible: boolean;
};

export function CreateListModal({
  clubId,
  createdByProfileId,
  onClose,
  onCreated,
  onDismiss,
  successMode = "panel",
  visible,
}: CreateListModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [step, setStep] = useState<"form" | "success">("form");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<ShortlistScope>("tutta_la_societa");
  const [createdListId, setCreatedListId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setStep("form");
      setName("");
      setDescription("");
      setScope("tutta_la_societa");
      setCreatedListId(null);
    }
  }, [visible]);

  const mutation = useMutation({
    mutationFn: () =>
      createShortlist(clubId, createdByProfileId, {
        description: description.trim() || undefined,
        name: name.trim(),
        scope,
      }),
    onError: (error) => {
      showToast({
        message:
          error instanceof Error ? error.message : "Impossibile creare la lista.",
        tone: "neutral",
      });
    },
    onSuccess: (newListId) => {
      queryClient.invalidateQueries({ queryKey: ["shortlists", clubId] });
      queryClient.invalidateQueries({ queryKey: ["shortlist-overview", clubId] });

      if (successMode === "skip") {
        // In modalità skip la chiusura e la transizione successiva sono
        // responsabilità del chiamante (onClose qui segnalerebbe un annullo).
        onCreated?.(newListId);
        return;
      }

      setCreatedListId(newListId);
      setStep("success");
    },
  });

  const isFormValid = name.trim().length > 0;

  return (
    <Modal
      animationType="slide"
      onDismiss={onDismiss}
      onRequestClose={onClose}
      visible={visible}
    >
      <SafeAreaView style={styles.root}>
        {step === "form" ? (
          <>
            <ModalHeader onClose={onClose} title="Crea lista" />
            <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
              <Input
                label="Nome lista"
                onChangeText={setName}
                placeholder="Es. Attaccanti 2025/26"
                value={name}
              />
              <Input
                label="Descrizione opzionale"
                multiline
                onChangeText={setDescription}
                placeholder="Es. Profili offensivi da valutare per la prossima stagione."
                value={description}
              />
              <View style={styles.group}>
                <AppText color="muted" variant="caption">
                  Ambito
                </AppText>
                {SCOPES.map((option) => (
                  <Radio
                    checked={scope === option}
                    key={option}
                    label={getScopeLabel(option)}
                    onPress={() => setScope(option)}
                  />
                ))}
              </View>
              <View style={styles.group}>
                <AppText color="muted" variant="caption">
                  Visibilità interna
                </AppText>
                <View style={styles.lockRow}>
                  <Ionicons color={colors.textMuted} name="lock-closed-outline" size={16} />
                  <AppText color="muted" variant="bodySm">
                    Solo utenti autorizzati
                  </AppText>
                </View>
              </View>
            </KeyboardAwareForm>
            <View style={styles.footer}>
              <Button
                disabled={!isFormValid || mutation.isPending}
                label={mutation.isPending ? "Creazione..." : "Crea lista"}
                onPress={() => mutation.mutate()}
                variant="primary"
              />
            </View>
          </>
        ) : (
          <>
            <ModalHeader onClose={onClose} title="Lista creata" />
            <View style={styles.successContent}>
              <Ionicons color={colors.success} name="checkmark-circle" size={72} />
              <AppText align="center" variant="headingSm">
                Lista creata
              </AppText>
              <AppText align="center" variant="titleMd">
                {name}
              </AppText>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <AppText color="muted" variant="bodySm">
                    Ambito
                  </AppText>
                  <AppText variant="bodySm">{getScopeLabel(scope)}</AppText>
                </View>
                <Divider spacing={8} />
                <View style={styles.summaryRow}>
                  <AppText color="muted" variant="bodySm">
                    Visibilità
                  </AppText>
                  <View style={styles.lockRow}>
                    <Ionicons color={colors.textMuted} name="lock-closed-outline" size={14} />
                    <AppText color="muted" variant="bodySm">
                      Solo utenti autorizzati
                    </AppText>
                  </View>
                </View>
              </View>
              <Button
                fullWidth
                label="Aggiungi profili"
                onPress={() => {
                  onClose();
                  if (createdListId) {
                    router.push(`/shortlist/${createdListId}` as never);
                  }
                }}
                variant="primary"
              />
              <Button fullWidth label="Torna a Shortlist" onPress={onClose} variant="link" />
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
  group: {
    gap: spacing[8],
  },
  lockRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    gap: spacing[20],
    padding: spacing[20],
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
