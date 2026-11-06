/**
 * Dettaglio dell'invito inviato e annullamento (§26; screen 15).
 *
 * «Il dettaglio non è un profilo amministratore»: mostra la proposta — chi,
 * quale incarico, quale ambito, stato e date — e una sola azione, quando
 * autorizzata e quando il record è ancora pending.
 *
 * §26 vieta esplicitamente tre cose che qui non esistono: modifica inline di
 * ruolo o destinatario, un «Reinvia» che duplicherebbe il record, e l'icona
 * cestino — «Un'azione distruttiva non deve essere identificata da un
 * cestino quando significa annullare una proposta e non eliminare una
 * persona» (§5).
 */
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  DashboardGlobalError,
  DashboardSkeleton,
} from "../../components/DashboardStates";
import { InviteConfirmSheet } from "../components/InviteConfirmSheet";
import { InviteFieldRow } from "../components/InviteFieldRow";
import { InvitePersonHeader } from "../components/InvitePersonHeader";
import { trackInvitesEvent } from "../invites-analytics";
import { INVITES_QK, INVITES_QK_PREFIXES } from "../invites-keys";
import {
  INVITES_COPY,
  cancelQuestion,
  formatLongDate,
  mutationErrorCopy,
  stateLabel,
} from "../invites-presentation";
import {
  InvitesAccessError,
  cancelMemberInvite,
  fetchSentInvite,
  toInvitesError,
} from "../invites-service";
import { newInviteSessionNonce, operationKeyOf } from "../operation-key";

export function SentInviteDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const params = useLocalSearchParams<{ inviteId?: string | string[] }>();
  const inviteId = Array.isArray(params.inviteId)
    ? params.inviteId[0]
    : params.inviteId;

  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce] = useState(newInviteSessionNonce);

  const inviteQuery = useQuery({
    enabled: !!inviteId && !!actorId,
    queryFn: () => fetchSentInvite(inviteId as string),
    queryKey: INVITES_QK.sentInvite(actorId, inviteId ?? ""),
    retry: (failureCount, raw) =>
      !(raw instanceof InvitesAccessError) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const invite = inviteQuery.data ?? null;

  const mutation = useMutation({
    mutationFn: () =>
      cancelMemberInvite({
        inviteId: inviteId as string,
        operationKey: operationKeyOf(nonce, "cancel"),
        revision: invite?.revision ?? 1,
      }),
    onError: (raw) => {
      const failure =
        raw instanceof InvitesAccessError ? raw : toInvitesError(raw);

      trackInvitesEvent("invite_cancel_result", {
        outcome: "error",
        reason: failure.code,
      });
      setConfirming(false);
      setError(mutationErrorCopy(failure.code, "cancel"));
      /* §26: «Se accept ha già completato l'incarico … mostra "L'invito è
         già stato accettato." e riconcilia il dettaglio.» */
      void inviteQuery.refetch();
    },
    onSuccess: () => {
      trackInvitesEvent("invite_cancel_result", { outcome: "ok" });
      setConfirming(false);
      setError(null);

      INVITES_QK_PREFIXES.forEach((prefix) => {
        void queryClient.invalidateQueries({ queryKey: [prefix] });
      });
      void inviteQuery.refetch();
    },
  });

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace("/(tabs)/dashboard/invites" as never);
  }, [router]);

  const shell = (body: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <View style={styles.bar}>
          <Pressable
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            hitSlop={8}
            onPress={goBack}
            style={styles.back}
            testID="invite-sent-back"
          >
            <Ionicons color={colors.textNeutral} name="arrow-back" size={22} />
          </Pressable>
          <AppText
            accessibilityRole="header"
            color="neutral"
            style={styles.barTitle}
            variant="titleMd"
          >
            {INVITES_COPY.sentTitle}
          </AppText>
        </View>
      </View>
      {body}
    </View>
  );

  if (!inviteId) {
    return shell(
      <DashboardGlobalError
        body="Riapri l'invito dal Centro."
        onRetry={goBack}
        title={INVITES_COPY.detailError}
      />,
    );
  }

  if (inviteQuery.isLoading && !invite) {
    return shell(
      <View style={styles.content}>
        <DashboardSkeleton />
      </View>,
    );
  }

  if (!invite) {
    return shell(
      <DashboardGlobalError
        body={INVITES_COPY.detailError}
        onRetry={() => void inviteQuery.refetch()}
        title="Invito non disponibile"
      />,
    );
  }

  const resolved = formatLongDate(invite.resolvedAt);
  const created = formatLongDate(invite.createdAt);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <View style={styles.bar}>
          <Pressable
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            hitSlop={8}
            onPress={goBack}
            style={styles.back}
            testID="invite-sent-back"
          >
            <Ionicons color={colors.textNeutral} name="arrow-back" size={22} />
          </Pressable>
          <AppText
            accessibilityRole="header"
            color="neutral"
            style={styles.barTitle}
            variant="titleMd"
          >
            {INVITES_COPY.sentTitle}
          </AppText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[32] + insets.bottom },
        ]}
      >
        <InvitePersonHeader
          avatarUrl={invite.personAvatarUrl}
          name={invite.personName}
          subtitle={invite.contextLabel}
        />

        <AppText color="neutralMuted" style={styles.section} variant="metaStrong">
          {INVITES_COPY.linkSection}
        </AppText>

        <InviteFieldRow label="Ruolo" value={invite.roleLabel} />

        {invite.scopeType === "society" ? (
          <InviteFieldRow
            label={INVITES_COPY.scopeFieldLabel}
            showDivider
            value={INVITES_COPY.societyScope}
          />
        ) : (
          <InviteFieldRow
            label={INVITES_COPY.teamFieldLabel}
            showDivider
            value={invite.contextLabel}
          />
        )}

        <InviteFieldRow
          label="Stato"
          showDivider
          value={
            resolved
              ? `${stateLabel(invite.state)} · ${resolved}`
              : stateLabel(invite.state)
          }
        />

        {created ? (
          <InviteFieldRow label="Inviato" showDivider value={created} />
        ) : null}

        {error ? (
          <AppText
            accessibilityRole="alert"
            color="danger"
            style={styles.error}
            variant="bodySm"
          >
            {error}
          </AppText>
        ) : null}
      </ScrollView>

      {/* §26: «Mostra Annulla invito soltanto quando PENDING e actor
          autorizzato a questo comando sul relativo ambito.» Negli altri casi
          la barra non esiste — non un pulsante disabilitato. */}
      {invite.canCancel ? (
        <View style={[styles.footer, { paddingBottom: spacing[16] + insets.bottom }]}>
          {/* §5: il rosso pieno è «nella conferma finale», sulla reale
              azione distruttiva. Questo pulsante apre la conferma e non
              distrugge niente: resta outlined, con il colore che ne annuncia
              la natura. Due rossi pieni per un'azione sola la farebbero
              sembrare già compiuta. */}
          <Button
            destructive
            fullWidth
            label={INVITES_COPY.cancelInvite}
            onPress={() => {
              trackInvitesEvent("invite_cancel_confirm_opened");
              setConfirming(true);
            }}
            size="md"
            testID="invite-cancel"
            variant="neutralOutline"
          />
        </View>
      ) : null}

      <InviteConfirmSheet
        body={INVITES_COPY.cancelConfirmBody}
        cancelLabel={INVITES_COPY.keepInvite}
        confirmLabel={INVITES_COPY.cancelInvite}
        destructive
        isBusy={mutation.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => mutation.mutate()}
        title={cancelQuestion(invite.personName)}
        visible={confirming}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  navWrap: {
    paddingHorizontal: spacing[20],
  },
  bar: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
  },
  back: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    marginLeft: -spacing[10],
    width: sizes.touchTarget,
  },
  barTitle: {
    flexShrink: 1,
  },
  content: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  section: {
    paddingBottom: spacing[4],
    paddingTop: spacing[16],
  },
  error: {
    paddingTop: spacing[16],
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
});
