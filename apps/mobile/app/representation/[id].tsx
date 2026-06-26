import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../src/components/ui/screen";
import { formatRole } from "../../src/features/profiles/profile-display-helpers";
import {
  fetchRepresentationDetail,
  getRelationshipTypeLabel,
  reportRepresentation,
  respondRepresentation,
} from "../../src/features/relationships/agent-representation-service";
import { colors, radius, spacing } from "../../src/styles";
import {
  AppText,
  Avatar,
  Button,
  Divider,
  ModalHeader,
  SectionCard,
  useToast,
} from "../../src/ui";
import { ScreenHeader } from "../../src/ui";

const REPORT_REASONS = [
  "Non conosco questa persona",
  "Richiesta falsa o impropria",
  "Uso improprio del mio profilo",
  "Spam",
  "Altro",
];

export default function RepresentationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [successState, setSuccessState] = useState(false);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);

  const {
    data: detail,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["representation-detail", id],
    queryFn: () => fetchRepresentationDetail(id),
    enabled: !!id,
  });

  const respondMutation = useMutation({
    mutationFn: ({ accept }: { accept: boolean }) =>
      respondRepresentation(id, accept),
    onSuccess: (_data, { accept }) => {
      queryClient.invalidateQueries({ queryKey: ["representation-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      if (accept) {
        setSuccessState(true);
        showToast({
          message: "Collegamento attivato con successo",
          tone: "success",
          icon: "checkmark-circle-outline",
        });
      } else {
        showToast({ message: "Richiesta rifiutata", tone: "neutral" });
        router.back();
      }
    },
  });

  const reportMutation = useMutation({
    mutationFn: (reason: string) => reportRepresentation(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setReportSheetVisible(false);
      showToast({ message: "Segnalazione inviata", tone: "neutral" });
      router.back();
    },
  });

  function handleAccept() {
    if (!detail) return;
    const typeLabel = getRelationshipTypeLabel(detail.relationship_type);
    const agentName = detail.agent_full_name ?? "Questo agente";
    Alert.alert(
      "Accettare collegamento?",
      `${agentName} comparirà come ${typeLabel} nel tuo profilo pubblico. Potrai modificare la visibilità o rimuovere il collegamento in qualsiasi momento.`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Accetta",
          onPress: () => respondMutation.mutate({ accept: true }),
        },
      ],
    );
  }

  function handleReject() {
    if (!detail) return;
    const agentName = detail.agent_full_name ?? "Questo agente";
    Alert.alert(
      "Rifiutare richiesta?",
      `La richiesta di ${agentName} verrà rifiutata. Non verrà creato alcun collegamento.`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Rifiuta",
          style: "destructive",
          onPress: () => respondMutation.mutate({ accept: false }),
        },
      ],
    );
  }

  function handleReport(reason: string) {
    reportMutation.mutate(reason);
  }

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.headerWrapper}>
          <Button
            label="Indietro"
            onPress={() => router.back()}
            size="sm"
            variant="link"
          />
          <ScreenHeader title="Richiesta collegamento" />
        </View>
        <View style={styles.center}>
          <AppText variant="bodySm" color="muted">
            Caricamento...
          </AppText>
        </View>
      </Screen>
    );
  }

  if (isError || !detail) {
    return (
      <Screen>
        <View style={styles.headerWrapper}>
          <Button
            label="Indietro"
            onPress={() => router.back()}
            size="sm"
            variant="link"
          />
          <ScreenHeader title="Richiesta collegamento" />
        </View>
        <View style={styles.center}>
          <AppText variant="bodySm" color="muted">
            Impossibile caricare i dettagli. Riprova.
          </AppText>
        </View>
      </Screen>
    );
  }

  const typeLabel = getRelationshipTypeLabel(detail.relationship_type);
  const visibilityLabel =
    detail.visibility === "public" ? "Pubblico sul profilo" : "Privato";
  const agentName = detail.agent_full_name ?? "Agente";
  const agentRole = formatRole(detail.agent_role);

  if (successState) {
    return (
      <Screen>
        <View style={styles.headerWrapper}>
          <Button
            label="Indietro"
            onPress={() => router.back()}
            size="sm"
            variant="link"
          />
          <ScreenHeader title="Richiesta collegamento" />
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.successCard}>
            <Ionicons
              name="checkmark-circle"
              size={48}
              color={colors.success}
            />
            <AppText variant="titleMd" style={styles.successTitle}>
              Collegamento attivo
            </AppText>
            <AppText variant="bodyLg" color="secondary" style={styles.successBody}>
              {agentName} è ora collegato al tuo profilo come {typeLabel}.
            </AppText>
            <View style={styles.successMeta}>
              <AppText variant="bodySm" color="muted">
                Visibilità: {visibilityLabel}
              </AppText>
            </View>
          </View>
          <View style={styles.ctaStack}>
            <Button
              label="Gestisci collegamento"
              variant="primary"
              fullWidth
              onPress={() =>
                router.push(`/representation/manage/${id}` as never)
              }
            />
            <Button
              label="Vedi profilo"
              variant="outline"
              fullWidth
              onPress={() =>
                router.push(`/profile/${detail.agent_profile_id}` as never)
              }
            />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.headerWrapper}>
        <Button
          label="Indietro"
          onPress={() => router.back()}
          size="sm"
          variant="link"
        />
        <ScreenHeader title="Richiesta collegamento" />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Agent header */}
        <View style={styles.agentCard}>
          <Avatar uri={detail.agent_avatar_url} name={agentName} size="lg" />
          <View style={styles.agentInfo}>
            <AppText variant="titleSm">{agentName}</AppText>
            <AppText variant="bodySm" color="secondary">
              {agentRole}
            </AppText>
            <Button
              label="Vedi profilo"
              variant="link"
              size="sm"
              onPress={() =>
                router.push(`/profile/${detail.agent_profile_id}` as never)
              }
            />
          </View>
        </View>

        <Divider />

        {/* Request details */}
        <SectionCard title="Dettagli richiesta">
          <View style={styles.detailRow}>
            <AppText variant="bodySm" color="secondary">
              Richiede di collegarsi a te come
            </AppText>
            <AppText variant="bodySm">{typeLabel}</AppText>
          </View>
          <View style={styles.detailRow}>
            <AppText variant="bodySm" color="secondary">
              Visibilità proposta
            </AppText>
            <AppText variant="bodySm">{visibilityLabel}</AppText>
          </View>
          {detail.message ? (
            <View style={styles.messageBlock}>
              <AppText variant="bodySm" color="secondary">
                Messaggio
              </AppText>
              <View style={styles.quotedMessage}>
                <AppText variant="bodySm" style={styles.quoteText}>
                  "{detail.message}"
                </AppText>
              </View>
            </View>
          ) : null}
        </SectionCard>

        {/* Status note or action buttons */}
        {detail.status !== "pending" ? (
          <View style={styles.statusNote}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={colors.textMuted}
            />
            <AppText variant="bodySm" color="muted">
              {detail.status === "accepted"
                ? "Richiesta già accettata"
                : detail.status === "rejected"
                  ? "Richiesta rifiutata"
                  : detail.status === "reported"
                    ? "Richiesta segnalata"
                    : detail.status === "removed" ||
                        detail.status === "revoked" ||
                        detail.status === "terminated"
                      ? "Collegamento non più attivo"
                      : "Richiesta non disponibile"}
            </AppText>
          </View>
        ) : (
          <View style={styles.ctaStack}>
            <Button
              label="Accetta"
              variant="primary"
              fullWidth
              loading={respondMutation.isPending}
              onPress={handleAccept}
            />
            <Button
              label="Rifiuta"
              variant="outline"
              destructive
              fullWidth
              disabled={respondMutation.isPending}
              onPress={handleReject}
            />
            <Button
              label="Segnala"
              variant="ghost"
              fullWidth
              disabled={respondMutation.isPending}
              onPress={() => setReportSheetVisible(true)}
            />
          </View>
        )}
      </ScrollView>

      {/* Report bottom sheet */}
      <Modal
        visible={reportSheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setReportSheetVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setReportSheetVisible(false)}
        />
        <View style={styles.sheetContainer}>
          <ModalHeader
            title="Segnala richiesta"
            onClose={() => setReportSheetVisible(false)}
          />
          <View style={styles.sheetContent}>
            <AppText variant="bodySm" color="secondary" style={styles.sheetSubtitle}>
              Seleziona il motivo della segnalazione
            </AppText>
            {REPORT_REASONS.map((reason) => (
              <Pressable
                key={reason}
                style={({ pressed }) => [
                  styles.reasonRow,
                  pressed ? styles.reasonRowPressed : null,
                ]}
                onPress={() => handleReport(reason)}
                disabled={reportMutation.isPending}
              >
                <AppText variant="bodyLg">{reason}</AppText>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textMuted}
                />
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    gap: spacing[8],
    paddingBottom: spacing[8],
  },
  scrollContent: {
    gap: spacing[20],
    paddingBottom: spacing[40],
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[20],
  },
  agentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[16],
    backgroundColor: colors.surface,
    borderRadius: radius[8],
    padding: spacing[16],
    borderWidth: 1,
    borderColor: colors.border,
  },
  agentInfo: {
    flex: 1,
    gap: spacing[4],
  },
  detailRow: {
    gap: spacing[4],
  },
  messageBlock: {
    gap: spacing[8],
  },
  quotedMessage: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    padding: spacing[12],
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  quoteText: {
    fontStyle: "italic",
  },
  statusNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[8],
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    padding: spacing[16],
  },
  ctaStack: {
    gap: spacing[12],
  },
  successCard: {
    alignItems: "center",
    backgroundColor: colors.successSoft,
    borderRadius: radius[8],
    padding: spacing[24],
    gap: spacing[12],
    borderWidth: 1,
    borderColor: colors.success,
  },
  successTitle: {
    textAlign: "center",
  },
  successBody: {
    textAlign: "center",
  },
  successMeta: {
    marginTop: spacing[4],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius[16],
    borderTopRightRadius: radius[16],
    paddingBottom: spacing[32],
  },
  sheetContent: {
    paddingHorizontal: spacing[16],
    gap: spacing[4],
    paddingTop: spacing[8],
  },
  sheetSubtitle: {
    paddingBottom: spacing[8],
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[14],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reasonRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
});
