import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Screen } from "../../../src/components/ui/screen";
import {
  AppText,
  Avatar,
  Badge,
  Button,
  Divider,
  SectionCard,
  useToast,
} from "../../../src/ui";
import {
  confirmVisibility,
  fetchRepresentationDetail,
  getRelationshipTypeLabel,
  removeRepresentation,
  reportRepresentation,
  setRepresentationVisibility,
  type AgentRepresentation,
  type RelationshipType,
  type RepresentationVisibility,
} from "../../../src/features/relationships/agent-representation-service";
import { colors, radius, spacing } from "../../../src/theme/tokens";

type RepresentationDetail = AgentRepresentation & {
  agent_avatar_url: string | null;
  agent_full_name: string | null;
  agent_role: string | null;
};

const REPORT_REASONS = [
  "Non conosco questa persona",
  "Richiesta falsa o impropria",
  "Uso improprio del mio profilo",
  "Spam",
  "Altro",
] as const;

type ScreenView = "main" | "visibility";

export default function ManageRepresentationScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [detail, setDetail] = useState<RepresentationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [view, setView] = useState<ScreenView>("main");

  // Visibility sub-view state
  const [selectedVisibility, setSelectedVisibility] =
    useState<RepresentationVisibility>("public");
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);

  // Pending visibility confirmation loading
  const [isConfirmingVisibility, setIsConfirmingVisibility] = useState(false);

  // Remove loading
  const [isRemoving, setIsRemoving] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await fetchRepresentationDetail(id);
      if (!data) {
        setErrorMessage("Collegamento non trovato.");
        return;
      }
      setDetail(data as RepresentationDetail);
      setSelectedVisibility(data.visibility as RepresentationVisibility);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Errore nel caricamento.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function handleConfirmVisibility(accept: boolean) {
    if (!id) return;
    try {
      setIsConfirmingVisibility(true);
      await confirmVisibility(id, accept);
      showToast({
        icon: accept ? "checkmark-circle" : "close-circle",
        message: accept ? "Visibilità confermata." : "Proposta rifiutata.",
        tone: accept ? "success" : "neutral",
      });
      await loadDetail();
    } catch (err) {
      Alert.alert(
        "Errore",
        err instanceof Error ? err.message : "Operazione non riuscita.",
      );
    } finally {
      setIsConfirmingVisibility(false);
    }
  }

  async function handleSaveVisibility() {
    if (!id) return;
    try {
      setIsSavingVisibility(true);
      await setRepresentationVisibility(id, selectedVisibility);
      showToast({
        icon: "checkmark-circle",
        message: "Visibilità aggiornata.",
        tone: "success",
      });
      await loadDetail();
      setView("main");
    } catch (err) {
      Alert.alert(
        "Errore",
        err instanceof Error ? err.message : "Operazione non riuscita.",
      );
    } finally {
      setIsSavingVisibility(false);
    }
  }

  function handleRemoveConfirm() {
    if (!detail) return;
    const agentName = detail.agent_full_name ?? "l'agente";
    const typeLabel = getRelationshipTypeLabel(
      detail.relationship_type as RelationshipType,
    );
    Alert.alert(
      "Rimuovi collegamento",
      `Rimuovere il collegamento? ${agentName} non sarà più collegato al tuo profilo come ${typeLabel}. Potrai ricevere nuove richieste in futuro.`,
      [
        { style: "cancel", text: "Annulla" },
        {
          onPress: () => void handleRemove(),
          style: "destructive",
          text: "Rimuovi",
        },
      ],
    );
  }

  async function handleRemove() {
    if (!id) return;
    try {
      setIsRemoving(true);
      await removeRepresentation(id);
      showToast({
        icon: "checkmark-circle",
        message: "Collegamento rimosso.",
        tone: "success",
      });
      router.back();
    } catch (err) {
      setIsRemoving(false);
      Alert.alert(
        "Errore",
        err instanceof Error ? err.message : "Operazione non riuscita.",
      );
    }
  }

  function handleReportSheet() {
    Alert.alert("Segnala rapporto", "Seleziona il motivo della segnalazione", [
      ...REPORT_REASONS.map((reason) => ({
        onPress: () => void handleReport(reason),
        text: reason,
      })),
      { style: "cancel" as const, text: "Annulla" },
    ]);
  }

  async function handleReport(reason: string) {
    if (!id) return;
    try {
      await reportRepresentation(id, reason);
      showToast({
        icon: "checkmark-circle",
        message: "Segnalazione inviata.",
        tone: "neutral",
      });
    } catch (err) {
      Alert.alert(
        "Errore",
        err instanceof Error ? err.message : "Segnalazione non inviata.",
      );
    }
  }

  // ── Visibility sub-view ──────────────────────────────────────────────────
  if (view === "visibility" && detail) {
    const agentName = detail.agent_full_name ?? "l'agente";
    const typeLabel = getRelationshipTypeLabel(
      detail.relationship_type as RelationshipType,
    );

    return (
      <Screen>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Torna indietro"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setView("main")}
            style={styles.backButton}
          >
            <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
          </Pressable>
          <AppText variant="titleSm">Cambia visibilità</AppText>
          <View style={styles.backButtonPlaceholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.visibilityContent}
          showsVerticalScrollIndicator={false}
        >
          <SectionCard title="Visibilità collegamento">
            <VisibilityOptionRow
              checked={selectedVisibility === "public"}
              description={`Mostra ${agentName} come ${typeLabel} nel tuo profilo.`}
              label="Pubblico sul profilo"
              onPress={() => setSelectedVisibility("public")}
            />
            <VisibilityOptionRow
              checked={selectedVisibility === "private"}
              description="Nascondi il collegamento dal profilo pubblico."
              label="Privato"
              onPress={() => setSelectedVisibility("private")}
            />
          </SectionCard>

          <Button
            fullWidth
            label="Salva modifiche"
            loading={isSavingVisibility}
            onPress={handleSaveVisibility}
            variant="primary"
          />
        </ScrollView>
      </Screen>
    );
  }

  // ── Main view ────────────────────────────────────────────────────────────
  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Torna indietro"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
        </Pressable>
        <AppText variant="titleSm">Gestisci collegamento</AppText>
        <View style={styles.backButtonPlaceholder} />
      </View>

      {isLoading ? (
        <View style={styles.stateBlock}>
          <ActivityIndicator color={colors.accent} />
          <AppText color="secondary" variant="bodySm">
            Caricamento...
          </AppText>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateBlock}>
          <AppText variant="titleSm">Dati non disponibili</AppText>
          <AppText color="secondary" variant="bodySm">
            {errorMessage}
          </AppText>
        </View>
      ) : detail ? (
        <ScrollView
          contentContainerStyle={styles.mainContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Agent header card */}
          <View style={styles.agentCard}>
            <Avatar
              name={detail.agent_full_name ?? "Agente"}
              size="lg"
              uri={detail.agent_avatar_url}
            />
            <View style={styles.agentInfo}>
              <AppText variant="titleSm" numberOfLines={1}>
                {detail.agent_full_name ?? "Agente"}
              </AppText>
              <AppText color="secondary" variant="bodySm" numberOfLines={1}>
                {getRelationshipTypeLabel(
                  detail.relationship_type as RelationshipType,
                )}
              </AppText>
              <View style={styles.badgeRow}>
                <Badge label="Attivo" variant="success" />
                <Badge
                  label={
                    detail.visibility === "public" ? "Pubblico" : "Privato"
                  }
                  variant={
                    detail.visibility === "public" ? "info" : "default"
                  }
                />
              </View>
            </View>
          </View>

          {/* Pending visibility proposal banner */}
          {detail.pending_visibility != null ? (
            <View style={styles.pendingBanner}>
              <Ionicons
                color={colors.warning}
                name="information-circle-outline"
                size={18}
              />
              <View style={styles.pendingBannerText}>
                <AppText variant="bodySm">
                  <AppText variant="bodySm" style={styles.pendingBannerBold}>
                    {detail.agent_full_name ?? "L'agente"}
                  </AppText>
                  {" propone di rendere pubblico il collegamento."}
                </AppText>
              </View>
              <View style={styles.pendingBannerActions}>
                <Button
                  disabled={isConfirmingVisibility}
                  label="Conferma"
                  loading={isConfirmingVisibility}
                  onPress={() => handleConfirmVisibility(true)}
                  size="sm"
                  variant="primary"
                />
                <Button
                  disabled={isConfirmingVisibility}
                  label="Rifiuta"
                  onPress={() => handleConfirmVisibility(false)}
                  size="sm"
                  variant="ghost"
                />
              </View>
            </View>
          ) : null}

          {/* Actions */}
          <SectionCard title="Azioni">
            <Pressable
              accessibilityLabel="Cambia visibilità"
              accessibilityRole="button"
              onPress={() => setView("visibility")}
              style={({ pressed }) => [
                styles.actionRow,
                pressed ? styles.actionRowPressed : null,
              ]}
            >
              <View style={styles.actionRowIcon}>
                <Ionicons
                  color={colors.accent}
                  name="eye-outline"
                  size={20}
                />
              </View>
              <View style={styles.actionRowBody}>
                <AppText variant="titleSm">Cambia visibilità</AppText>
                <AppText color="secondary" variant="bodySm">
                  {detail.visibility === "public"
                    ? "Attualmente pubblico sul tuo profilo."
                    : "Attualmente privato, non visibile sul profilo."}
                </AppText>
              </View>
              <Ionicons
                color={colors.textSecondary}
                name="chevron-forward"
                size={16}
              />
            </Pressable>

            <Divider />

            <Pressable
              accessibilityLabel="Rimuovi collegamento"
              accessibilityRole="button"
              disabled={isRemoving}
              onPress={handleRemoveConfirm}
              style={({ pressed }) => [
                styles.actionRow,
                pressed ? styles.actionRowPressed : null,
              ]}
            >
              <View style={[styles.actionRowIcon, styles.actionRowIconDanger]}>
                <Ionicons
                  color={colors.danger}
                  name="trash-outline"
                  size={20}
                />
              </View>
              <View style={styles.actionRowBody}>
                <AppText style={styles.dangerText} variant="titleSm">
                  Rimuovi collegamento
                </AppText>
                <AppText color="secondary" variant="bodySm">
                  Termina il rapporto professionale con questo agente.
                </AppText>
              </View>
              {isRemoving ? (
                <ActivityIndicator color={colors.danger} size="small" />
              ) : (
                <Ionicons
                  color={colors.textSecondary}
                  name="chevron-forward"
                  size={16}
                />
              )}
            </Pressable>

            <Divider />

            <Pressable
              accessibilityLabel="Segnala rapporto"
              accessibilityRole="button"
              onPress={handleReportSheet}
              style={({ pressed }) => [
                styles.actionRow,
                pressed ? styles.actionRowPressed : null,
              ]}
            >
              <View style={styles.actionRowIcon}>
                <Ionicons
                  color={colors.textSecondary}
                  name="flag-outline"
                  size={20}
                />
              </View>
              <View style={styles.actionRowBody}>
                <AppText variant="titleSm">Segnala rapporto</AppText>
                <AppText color="secondary" variant="bodySm">
                  Informa il team di supporto di un problema.
                </AppText>
              </View>
              <Ionicons
                color={colors.textSecondary}
                name="chevron-forward"
                size={16}
              />
            </Pressable>
          </SectionCard>
        </ScrollView>
      ) : null}
    </Screen>
  );
}

type VisibilityOptionRowProps = {
  checked: boolean;
  description: string;
  label: string;
  onPress: () => void;
};

function VisibilityOptionRow({
  checked,
  description,
  label,
  onPress,
}: VisibilityOptionRowProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        checked ? styles.optionRowSelected : null,
        pressed ? styles.optionRowPressed : null,
      ]}
    >
      <View style={styles.optionRadio}>
        <View
          style={[
            styles.radioCircle,
            checked ? styles.radioCircleChecked : null,
          ]}
        />
      </View>
      <View style={styles.optionText}>
        <AppText variant="titleSm">{label}</AppText>
        <AppText color="secondary" variant="bodySm">
          {description}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing[16],
  },
  backButton: {
    alignItems: "center",
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  backButtonPlaceholder: {
    width: 36,
  },
  stateBlock: {
    alignItems: "center",
    flex: 1,
    gap: spacing[12],
    justifyContent: "center",
    paddingHorizontal: spacing[24],
  },
  mainContent: {
    gap: spacing[16],
    paddingBottom: spacing[40],
  },
  agentCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[14],
    padding: spacing[16],
  },
  agentInfo: {
    flex: 1,
    gap: spacing[6],
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[6],
    marginTop: spacing[4],
  },
  pendingBanner: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
    borderRadius: radius[8],
    borderWidth: 1,
    gap: spacing[10],
    padding: spacing[14],
  },
  pendingBannerText: {
    flex: 1,
  },
  pendingBannerBold: {
    fontWeight: "600",
  },
  pendingBannerActions: {
    flexDirection: "row",
    gap: spacing[10],
    marginTop: spacing[4],
  },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  actionRowPressed: {
    opacity: 0.75,
  },
  actionRowIcon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius[8],
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  actionRowIconDanger: {
    backgroundColor: colors.dangerSoft,
  },
  actionRowBody: {
    flex: 1,
    gap: spacing[4],
  },
  dangerText: {
    color: colors.danger,
  },
  visibilityContent: {
    gap: spacing[16],
    paddingBottom: spacing[40],
  },
  optionRow: {
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[12],
  },
  optionRowSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  optionRowPressed: {
    opacity: 0.82,
  },
  optionRadio: {
    paddingTop: spacing[4],
  },
  radioCircle: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1.5,
    height: 20,
    width: 20,
  },
  radioCircleChecked: {
    borderColor: colors.accent,
    borderWidth: 6,
  },
  optionText: {
    flex: 1,
    gap: spacing[4],
  },
});
