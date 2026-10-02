/**
 * SCREEN 7 — Invita su PROLINK (REV-PROF-14).
 *
 * Nessun canale invia niente da solo: ogni voce apre WhatsApp, il composer SMS
 * o la share sheet di sistema e lascia all'utente il gesto finale, compresa la
 * scelta del destinatario — che non viene letto né salvato.
 *
 * Il link contiene solo il token. Il token in chiaro esiste una volta sola, nel
 * momento in cui il database lo genera: non è riletto da nessuna query, quindi
 * se la schermata viene riaperta senza averlo in memoria il segreto viene
 * ruotato sullo stesso invito — stessa riga, stessa storia, nessun duplicato.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../../src/components/ui/screen";
import {
  AppText,
  Avatar,
  Button,
  ConfirmModal,
  ScreenHeader,
  useToast,
} from "../../../src/ui";
import { useSession } from "../../../src/features/auth/use-session";
import { trackAssistitiEvent } from "../../../src/features/relationships/assistiti/assistiti-analytics";
import {
  describeAssistitiError,
  getInviteStatusLabel,
  type InviteChannel,
} from "../../../src/features/relationships/assistiti/assistiti-model";
import {
  assistitiQueryKeys,
  deleteManualAssistito,
  fetchAssistitiOverview,
  issueInvite,
  markInviteShared,
  revokeInvite,
} from "../../../src/features/relationships/assistiti/assistiti-service";
import {
  buildAssistitoInviteUrl,
  buildInviteMessage,
  copyInviteLink,
  INVITE_CHANNELS,
  shareViaSms,
  shareViaSystem,
  shareViaWhatsApp,
} from "../../../src/features/relationships/assistiti/assistiti-invite-link";
import {
  AssistitiSkeleton,
  BackButton,
  SectionError,
} from "../../../src/features/relationships/assistiti/assistiti-ui";
import { getPlayerPositionLabel } from "../../../src/features/profiles/player-sports";
import { colors, radius, spacing } from "../../../src/theme/tokens";

export default function InviteAssistitoScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const params = useLocalSearchParams<{
    inviteId?: string;
    manualId?: string;
    token?: string;
  }>();

  const manualId = params.manualId ?? "";
  const agentProfileId = profile?.id ?? "";

  const [token, setToken] = useState<string | null>(params.token ?? null);
  const [inviteId, setInviteId] = useState<string | null>(
    params.inviteId ?? null,
  );
  const [busyChannel, setBusyChannel] = useState<InviteChannel | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"revoke" | "delete" | null>(null);
  const [isConfirming, setConfirming] = useState(false);

  const overviewQuery = useQuery({
    enabled: Boolean(agentProfileId),
    queryFn: () => fetchAssistitiOverview(agentProfileId),
    queryKey: assistitiQueryKeys.overview(agentProfileId),
  });

  const row = useMemo(
    () =>
      (overviewQuery.data ?? []).find(
        (item) => item.kind === "manual" && item.id === manualId,
      ) ?? null,
    [manualId, overviewQuery.data],
  );

  const isFresh = Boolean(params.token);

  useEffect(() => {
    trackAssistitiEvent("assistiti_invite_channels_opened");
  }, []);

  const refreshLists = useCallback(async () => {
    if (!agentProfileId) {
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: assistitiQueryKeys.overview(agentProfileId),
    });
    await queryClient.invalidateQueries({
      queryKey: assistitiQueryKeys.counts(agentProfileId),
    });
  }, [agentProfileId, queryClient]);

  /** Il token in memoria quando c'è; altrimenti rotazione sullo stesso invito. */
  async function ensureToken(): Promise<string> {
    if (token) {
      return token;
    }

    const issued = await issueInvite(manualId, { rotate: true });

    setInviteId(issued.invite_id);
    setToken(issued.invite_token);

    if (!issued.invite_token) {
      throw new Error("Non è stato possibile creare l'invito. Riprova.");
    }

    return issued.invite_token;
  }

  async function handleChannel(channel: InviteChannel) {
    if (busyChannel) {
      return;
    }

    setBusyChannel(channel);
    setErrorMessage(null);
    trackAssistitiEvent("assistiti_invite_channel_selected", { channel });

    try {
      const activeToken = await ensureToken();
      const link = buildAssistitoInviteUrl(activeToken);
      const message = buildInviteMessage({
        link,
        recipientName: row?.full_name ?? null,
      });

      let shared = false;

      if (channel === "copy_link") {
        shared = await copyInviteLink(link);

        if (shared) {
          trackAssistitiEvent("assistiti_invite_link_copied");
          showToast({ message: "Link copiato.", tone: "success" });
        }
      } else if (channel === "whatsapp") {
        shared = (await shareViaWhatsApp(message)) === "shared";
      } else if (channel === "sms") {
        shared = (await shareViaSms(message)) === "shared";
      } else {
        trackAssistitiEvent("assistiti_invite_share_sheet_opened");
        shared = (await shareViaSystem(message)) === "shared";
      }

      if (!shared) {
        // Annullamento della share sheet: nessuno stato cambia, nessun
        // messaggio viene dato per inviato.
        return;
      }

      const activeInviteId =
        inviteId ?? (await issueInvite(manualId)).invite_id;

      setInviteId(activeInviteId);
      await markInviteShared(activeInviteId, channel);
      await refreshLists();
    } catch (error) {
      trackAssistitiEvent("assistiti_invite_failed", { channel, success: false });
      setErrorMessage(
        describeAssistitiError(
          error,
          "Non è stato possibile creare l'invito. Riprova.",
        ),
      );
    } finally {
      setBusyChannel(null);
    }
  }

  async function handleConfirm() {
    if (!confirm) {
      return;
    }

    setConfirming(true);

    try {
      if (confirm === "revoke") {
        const activeInviteId = inviteId ?? row?.invite_id ?? null;

        if (activeInviteId) {
          await revokeInvite(activeInviteId);
          trackAssistitiEvent("assistiti_invite_revoked");
        }

        setToken(null);
      } else {
        await deleteManualAssistito(manualId);
      }

      await refreshLists();
      setConfirm(null);

      if (confirm === "delete") {
        router.back();
      }
    } catch (error) {
      setErrorMessage(
        describeAssistitiError(error, "Operazione non riuscita. Riprova."),
      );
      setConfirm(null);
    } finally {
      setConfirming(false);
    }
  }

  function handleLater() {
    trackAssistitiEvent("assistiti_invite_postponed");
    // Il record manuale resta salvato e l'invito resta disponibile: tornare
    // indietro non annulla niente e non segna niente come inviato.
    router.replace("/representation/hub" as never);
  }

  const name = row?.full_name ?? "Assistito";
  const meta = [
    row?.primary_position ? getPlayerPositionLabel(row.primary_position) : null,
    row?.team_label,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <Screen>
      <ScreenHeader
        leading={<BackButton onPress={() => router.back()} />}
        title="Invita su PROLINK"
      />

      {overviewQuery.isLoading ? (
        <AssistitiSkeleton rows={2} />
      ) : overviewQuery.isError ? (
        <SectionError
          message="Non è stato possibile caricare l'assistito."
          onRetry={() => void overviewQuery.refetch()}
        />
      ) : (
        <View style={styles.content}>
          <View style={styles.card}>
            <Avatar name={name} size="md" />
            <View style={styles.cardBody}>
              <AppText numberOfLines={1} variant="titleSm">
                {name}
              </AppText>
              {meta ? (
                <AppText color="secondary" numberOfLines={1} variant="bodySm">
                  {meta}
                </AppText>
              ) : null}
              <View style={styles.savedRow}>
                <Ionicons
                  color={colors.success}
                  name="checkmark-circle"
                  size={14}
                />
                <AppText color="success" variant="caption">
                  {isFresh
                    ? "Profilo manuale salvato"
                    : getInviteStatusLabel(row?.invite_status ?? null)}
                </AppText>
              </View>
            </View>
          </View>

          <View style={styles.intro}>
            <AppText variant="headingSm">
              Invitalo a completare il profilo
            </AppText>
            <AppText color="secondary" variant="bodySm">
              Riceverà un link personale per registrarsi e collegarsi al tuo
              portfolio.
            </AppText>
          </View>

          <View style={styles.channels}>
            {INVITE_CHANNELS.map((channel) => (
              <Pressable
                accessibilityLabel={`Invita con ${channel.label}`}
                accessibilityRole="button"
                disabled={busyChannel != null}
                key={channel.value}
                onPress={() => void handleChannel(channel.value)}
                style={({ pressed }) => [
                  styles.channelRow,
                  pressed ? styles.pressed : null,
                ]}
                testID={`assistiti-invite-channel-${channel.value}`}
              >
                <Ionicons
                  color={
                    channel.value === "whatsapp" ? colors.success : colors.accent
                  }
                  name={channel.icon}
                  size={20}
                />
                <AppText style={styles.channelLabel} variant="titleSm">
                  {channel.label}
                </AppText>
                <Ionicons
                  color={colors.textMuted}
                  name="chevron-forward"
                  size={18}
                />
              </Pressable>
            ))}
          </View>

          {errorMessage ? (
            <AppText color="danger" variant="bodySm">
              {errorMessage}
            </AppText>
          ) : null}

          {!isFresh ? (
            <View style={styles.manageRow}>
              <Button
                label="Revoca invito"
                onPress={() => setConfirm("revoke")}
                size="sm"
                variant="ghost"
              />
              <Button
                destructive
                label="Elimina assistito"
                onPress={() => setConfirm("delete")}
                size="sm"
                variant="ghost"
              />
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.footer}>
        <Button
          fullWidth
          label="Invita con WhatsApp"
          loading={busyChannel === "whatsapp"}
          onPress={() => void handleChannel("whatsapp")}
          testID="assistiti-invite-whatsapp"
        />
        <Button label="Lo farò più tardi" onPress={handleLater} variant="link" />
        <View style={styles.privacyNote}>
          <Ionicons
            color={colors.textMuted}
            name="lock-closed-outline"
            size={12}
          />
          <AppText color="muted" variant="caption">
            Il link non contiene dati personali del Procuratore o del Calciatore.
          </AppText>
        </View>
      </View>

      <ConfirmModal
        cancelLabel="Annulla"
        confirmLabel={confirm === "revoke" ? "Revoca invito" : "Elimina"}
        destructive
        isBusy={isConfirming}
        message={
          confirm === "revoke"
            ? "Il link non potrà più essere utilizzato."
            : "L'assistito e il suo invito verranno eliminati."
        }
        onCancel={() => setConfirm(null)}
        onConfirm={() => void handleConfirm()}
        title={
          confirm === "revoke"
            ? "Revocare questo invito?"
            : "Eliminare questo assistito?"
        }
        visible={confirm != null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[12],
  },
  cardBody: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  channelLabel: {
    flex: 1,
  },
  channelRow: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 52,
  },
  channels: {
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    paddingHorizontal: spacing[12],
  },
  content: {
    flex: 1,
    gap: spacing[16],
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing[8],
    paddingTop: spacing[12],
  },
  intro: {
    gap: spacing[4],
  },
  manageRow: {
    flexDirection: "row",
    gap: spacing[8],
  },
  pressed: {
    opacity: 0.6,
  },
  privacyNote: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    justifyContent: "center",
  },
  savedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
});
