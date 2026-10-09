import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useSession } from "../../auth/use-session";
import {
  applyToRecruitingAd,
  toggleSavedAd,
} from "../../recruiting/recruiting-service";
import { formatDeadlineDetailLabel } from "../../dashboard/personal/personal-presentation";
import { fetchPositionDetail } from "../position-detail-service";
import { formatDeadlineLabel } from "../search-format";
import { colors, radius, spacing } from "../../../theme/tokens";
import {
  AppText,
  Avatar,
  Button,
  EmptyState,
  Skeleton,
  useToast,
} from "../../../ui";

export function PositionDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const profileId = profile?.id ?? null;
  const { id } = useLocalSearchParams<{ id: string }>();

  const detailQuery = useQuery({
    queryKey: ["position-detail", id, profileId],
    queryFn: () => fetchPositionDetail(profileId as string, id as string),
    enabled: !!profileId && !!id,
  });

  const detail = detailQuery.data;

  /**
   * §17: alla finalizzazione il backend rivalida visibilità, stato,
   * capability, azione già effettuata e cutoff — il trigger
   * `recruiting_applications_submission_window` e la RLS fanno quel lavoro.
   * Qui si riporta il feedback di dominio, senza falsa conferma: un dettaglio
   * aperto prima della scadenza e inviato dopo riceve l'errore reale.
   */
  const applyMutation = useMutation({
    mutationFn: () => {
      if (!profileId || !detail) {
        throw new Error("Sessione non valida.");
      }

      return applyToRecruitingAd(profileId, detail.ad_id, "");
    },
    onError: (error) => {
      showToast({
        message:
          error instanceof Error
            ? error.message
            : "Non siamo riusciti a inviare la candidatura.",
        tone: "neutral",
      });
    },
    onSuccess: () => {
      showToast({ message: "Candidatura inviata", tone: "success" });

      // §18: dopo un invio confermato il reminder va invalidato. Le chiavi
      // della Dashboard personale portano actor e identità, quindi si
      // invalida per prefisso invece di ricostruirle qui.
      queryClient.invalidateQueries({ queryKey: ["position-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-module"] });
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    },
  });

  /**
   * Perché l'azione non è disponibile, quando non lo è (§22, §54).
   *
   * Nessun pulsante disabilitato e nessuna CTA placeholder: una frase
   * fattuale, oppure niente. `role_not_supported` è il caso oggi più
   * frequente — il dominio Application accetta solo Calciatori, perché
   * `recruiting_applications.player_profile_id` è NOT NULL.
   */
  const actionNote = (() => {
    if (!detail || detail.action.action_type !== "none") {
      return null;
    }

    switch (detail.action.reason) {
      case "already_applied":
        return "Hai già inviato la tua candidatura per questa posizione.";
      case "deadline_passed":
        return "Il termine per candidarsi è scaduto.";
      case "role_not_supported":
        return "La candidatura è disponibile per i profili calciatore.";
      case "not_available":
        return "Questa posizione non accetta più candidature.";
      default:
        return null;
    }
  })();

  const cutoffLabel = detail?.action.deadline_at
    ? formatDeadlineDetailLabel(detail.action.deadline_at, {
        actionType:
          detail.action.action_type === "register" ? "register" : "apply",
        timeZone: detail.action.deadline_timezone,
      })
    : null;

  const toggleSavedMutation = useMutation({
    mutationFn: () => {
      if (!profileId || !detail) {
        throw new Error("Sessione non valida.");
      }
      return toggleSavedAd(profileId, detail.ad_id, !detail.is_saved);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["position-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["search-positions"] });
      queryClient.invalidateQueries({ queryKey: ["saved-items"] });
      queryClient.invalidateQueries({ queryKey: ["saved-counts"] });
    },
  });

  return (
    <>
      <View style={styles.headerRow}>
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
      </View>

      {detailQuery.isLoading ? (
        <View style={styles.loaderContainer}>
          <Skeleton.Row />
          <Skeleton.Row />
          <Skeleton.Row style={styles.skeletonShort} />
        </View>
      ) : !detail ? (
        <EmptyState
          icon="briefcase-outline"
          title="Posizione non disponibile"
          description="Questa posizione potrebbe non essere più pubblicata."
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <AppText variant="headingMd" style={styles.title}>
            {detail.title}
          </AppText>

          {detail.club_name ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                detail.club_id
                  ? router.push(`/club/${detail.club_id}` as never)
                  : undefined
              }
              style={styles.clubRow}
            >
              <Avatar name={detail.club_name} size="sm" square uri={detail.club_logo_url} />
              <View style={styles.clubText}>
                <AppText variant="titleSm">{detail.club_name}</AppText>
                {detail.category ? (
                  <AppText variant="bodySm" color="muted">
                    {detail.category}
                  </AppText>
                ) : null}
              </View>
            </Pressable>
          ) : null}

          <View style={styles.metaBlock}>
            {detail.region ? (
              <View style={styles.metaRow}>
                <Ionicons color={colors.textMuted} name="location-outline" size={16} />
                <AppText variant="bodySm" color="secondary">
                  {detail.region}
                </AppText>
              </View>
            ) : null}
            {detail.team_name ? (
              <View style={styles.metaRow}>
                <Ionicons color={colors.textMuted} name="shield-outline" size={16} />
                <AppText variant="bodySm" color="secondary">
                  {detail.team_name}
                </AppText>
              </View>
            ) : null}
            {detail.category ? (
              <View style={styles.metaRow}>
                <Ionicons color={colors.textMuted} name="trophy-outline" size={16} />
                <AppText variant="bodySm" color="secondary">
                  {detail.category}
                </AppText>
              </View>
            ) : null}
            {/*
              §17: la scadenza vicino alle informazioni principali.
              `action.deadline_at` è l'istante canonico e vince sempre sulla
              `deadline` legacy, che è una data locale senza cutoff definito.
              Il formato lungo aggiunge anno e — solo quando non è mezzanotte,
              cioè quando cambia la decisione — ora e fuso (§14).
            */}
            {cutoffLabel ? (
              <View style={styles.metaRow}>
                <Ionicons color={colors.textMuted} name="time-outline" size={16} />
                <AppText variant="bodySm" color="secondary">
                  {cutoffLabel}
                </AppText>
              </View>
            ) : detail.deadline ? (
              <View style={styles.metaRow}>
                <Ionicons color={colors.textMuted} name="time-outline" size={16} />
                <AppText variant="bodySm" color="secondary">
                  {formatDeadlineLabel(detail.deadline)}
                </AppText>
              </View>
            ) : null}
          </View>

          {detail.compensation_summary ? (
            <AppText variant="bodySm" color="secondary" style={styles.compensation}>
              {detail.compensation_summary}
            </AppText>
          ) : null}

          <AppText variant="bodyLg" style={styles.description}>
            {detail.description}
          </AppText>

          <View style={styles.actions}>
            {/*
              §17: «Utilizzare la CTA prevista dall'action type reale.» Il
              testo non si sceglie: viene da `action_type`, che il backend
              calcola. `Iscriviti` esiste nel vocabolario ma nessuna risorsa
              lo emette oggi — il dominio Eventi/provini non c'è (DAS-REV-28–31).

              Quando l'azione non è possibile non compare un pulsante
              disabilitato che pubblicizza un permesso mancante: compare la
              ragione, oppure niente.
            */}
            {detail.action.action_type === "apply" ? (
              <Button
                label="Candidati"
                loading={applyMutation.isPending}
                onPress={() => applyMutation.mutate()}
              />
            ) : detail.action.action_type === "register" ? (
              <Button
                label="Iscriviti"
                loading={applyMutation.isPending}
                onPress={() => applyMutation.mutate()}
              />
            ) : null}

            <Button
              label={detail.is_saved ? "Salvata" : "Salva"}
              leftIcon={
                <Ionicons
                  color={colors.accent}
                  name={detail.is_saved ? "bookmark" : "bookmark-outline"}
                  size={16}
                />
              }
              loading={toggleSavedMutation.isPending}
              onPress={() => toggleSavedMutation.mutate()}
              variant="secondary"
            />
          </View>

          {actionNote ? (
            <AppText color="muted" style={styles.actionNote} variant="bodySm">
              {actionNote}
            </AppText>
          ) : null}
        </ScrollView>
      )}
    </>
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
  clubRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    marginBottom: spacing[16],
  },
  clubText: {
    flex: 1,
    gap: spacing[4],
  },
  compensation: {
    marginBottom: spacing[8],
  },
  description: {
    marginBottom: spacing[24],
  },
  headerRow: {
    marginBottom: spacing[16],
  },
  loaderContainer: {
    gap: spacing[8],
  },
  metaBlock: {
    gap: spacing[8],
    marginBottom: spacing[16],
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  pressed: {
    opacity: 0.75,
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[12],
  },
  actionNote: {
    marginTop: spacing[8],
  },
  scroll: {
    flex: 1,
  },
  skeletonShort: {
    width: "60%",
  },
  title: {
    marginBottom: spacing[16],
  },
});
