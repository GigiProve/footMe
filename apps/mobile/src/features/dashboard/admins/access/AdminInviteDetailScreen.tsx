/**
 * Dettaglio di un invito amministrativo e annullamento (DAS-REV-14, screen 10).
 *
 * «Apri lo stesso invito canonico della DAS-REV-13, con destinatario, ruolo
 * e ambito proposti, stato e scadenza quando pertinenti» (§23). Nessun
 * oggetto nuovo: è la stessa proposta che il Centro elenca.
 *
 * «Non usare Revoca accesso per una persona che non ha ancora una membership
 * attiva derivante da quel pending»: qui l'azione distruttiva è
 * **Annulla invito**, e non tocca nessuna membership.
 *
 * La race con l'accept (§23) non è un errore: se l'accettazione ha vinto, il
 * comando restituisce lo stato reale e questa schermata lo mostra, offrendo
 * l'amministratore ormai attivo invece di revocarlo implicitamente.
 */
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Avatar, Button, ConfirmModal } from "../../../../ui";
import { useToast } from "../../../../ui/Toast/ToastProvider";
import { useSession } from "../../../auth/use-session";
import { NetworkNavBar } from "../../../network/components/NetworkNavBar";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardSkeleton,
} from "../../components/DashboardStates";
import { SocietyIdentityHeader } from "../../components/SocietyIdentityHeader";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { useOperationKey } from "../../roles/use-operation-key";
import { ADMIN_HREFS } from "../admins-routes";
import { trackRolesEvent } from "../../roles/roles-analytics";
import {
  RolesAccessError,
  describeRolesErrorSafe,
} from "./access-error";
import { ACCESS_QK, ACCESS_QK_PREFIXES } from "./access-keys";
import { ACCESS_HREFS } from "./access-routes";
import {
  ACCESS_COPY,
  cancelInviteQuestion,
  inviteRecipientName,
  inviteStatusLabel,
} from "./access-presentation";
import { cancelAdminInvite, fetchAdminInviteDetail } from "./access-service";

const INVALIDATE_PREFIXES = [
  ...ACCESS_QK_PREFIXES,
  "society-admin-center",
  "society-admin-invites",
] as const;

export function AdminInviteDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const params = useLocalSearchParams<{ inviteId?: string }>();
  const inviteId = typeof params.inviteId === "string" ? params.inviteId : null;

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const operationKey = useOperationKey(`${inviteId ?? ""}|cancel`);

  const inviteQuery = useQuery({
    enabled: !!clubId && !!actorId && !!inviteId,
    queryFn: () =>
      fetchAdminInviteDetail({
        clubId: clubId as string,
        inviteId: inviteId as string,
      }),
    queryKey: ACCESS_QK.invite(actorId, clubId ?? "", inviteId ?? ""),
    retry: (failureCount, error) =>
      !(error instanceof RolesAccessError) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const invite = inviteQuery.data ?? null;

  /* §23: la scadenza si mostra «quando pertinente» — cioè solo finché
     l'invito è ancora accettabile. Su un invito concluso sarebbe rumore. */
  const expiryLabel = useMemo(() => {
    if (!invite || !invite.expiresAt || invite.state !== "pending") {
      return null;
    }

    const parsed = new Date(invite.expiresAt);

    return Number.isNaN(parsed.getTime())
      ? null
      : `Scade il ${parsed.toLocaleDateString("it-IT")}`;
  }, [invite]);

  const cancel = useMutation({
    mutationFn: () =>
      cancelAdminInvite({
        clubId: clubId as string,
        expectedRevision: invite?.revision ?? 1,
        idempotencyKey: operationKey(),
        inviteId: inviteId as string,
      }),
    onError: (error) => {
      setConfirmVisible(false);
      setBannerError(describeRolesErrorSafe(error));
      trackRolesEvent("admin_invite_cancel_result", { outcome: "error" });
    },
    onSuccess: async (result) => {
      setConfirmVisible(false);

      for (const prefix of INVALIDATE_PREFIXES) {
        await queryClient.invalidateQueries({ queryKey: [prefix] });
      }

      /* §23: «Se accept ha già creato l'accesso, annullare il vecchio pending
         non deve revocare implicitamente la membership.» Non è un errore e
         non è un successo da festeggiare: è lo stato reale, e si rilegge. */
      if (result.state === "accepted") {
        setBannerError(ACCESS_COPY.inviteAccepted);
        await inviteQuery.refetch();
        trackRolesEvent("admin_invite_cancel_result", { outcome: "superseded" });

        return;
      }

      showToast({ message: ACCESS_COPY.cancelledToast, tone: "success" });
      trackRolesEvent("admin_invite_cancel_result", { outcome: "success" });
      router.back();
    },
  });

  const goBack = useCallback(() => {
    if (cancel.isPending) {
      return;
    }

    router.back();
  }, [cancel.isPending, router]);

  if (!clubId || !inviteId) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <DashboardGlobalEmpty
          copy={{
            actionLabel: "Torna al centro",
            body: "Torna al Centro Amministratori e riapri l'invito.",
            icon: "mail-outline",
            title: "Invito non disponibile",
          }}
          onAction={() => router.replace(ADMIN_HREFS.center() as never)}
        />
      </View>
    );
  }

  if (inviteQuery.isLoading && !invite) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <NetworkNavBar onBack={goBack} title={ACCESS_COPY.inviteTitle} />
        <View style={styles.content}>
          <DashboardSkeleton />
        </View>
      </View>
    );
  }

  if (!invite) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <NetworkNavBar onBack={goBack} title={ACCESS_COPY.inviteTitle} />
        <DashboardGlobalError
          body={ACCESS_COPY.inviteError}
          onRetry={() => void inviteQuery.refetch()}
          title={ACCESS_COPY.inviteTitle}
        />
      </View>
    );
  }

  const recipient = inviteRecipientName(invite);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NetworkNavBar onBack={goBack} title={ACCESS_COPY.inviteTitle} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing[24] },
        ]}
      >
        <SocietyIdentityHeader
          isVerified={current?.isVerified ?? false}
          logoUrl={current?.avatarUrl ?? null}
          name={current?.name ?? ""}
        />

        <View accessible style={styles.person}>
          <Avatar
            name={recipient}
            size="md"
            uri={invite.avatarUrl ?? undefined}
          />

          <View style={styles.personBody}>
            <AppText color="neutral" numberOfLines={2} variant="titleMd">
              {recipient}
            </AppText>

            <AppText color="neutralMuted" variant="meta">
              {inviteStatusLabel(invite)}
            </AppText>
          </View>
        </View>

        <View>
          <ReadOnlyRow label={ACCESS_COPY.roleRow} value={invite.roleLabel} />
          <ReadOnlyRow
            label={ACCESS_COPY.scopeRow}
            value={invite.scopeLabel ?? "—"}
          />
        </View>

        {expiryLabel ? (
          <AppText color="neutralSoft" variant="meta">
            {expiryLabel}
          </AppText>
        ) : null}

        {bannerError ? (
          <View style={styles.banner}>
            <AppText accessibilityRole="alert" color="danger" variant="bodySm">
              {bannerError}
            </AppText>
          </View>
        ) : null}

        {/* §23: la race vinta dall'accept non lascia un vicolo cieco —
            l'amministratore ormai attivo è raggiungibile da qui. */}
        {invite.state === "accepted" && invite.membershipProfileId ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.replace(
                ACCESS_HREFS.detail(
                  invite.membershipProfileId as string,
                ) as never,
              )
            }
            style={styles.navRow}
            testID="invite-open-admin"
          >
            <AppText color="neutral" style={styles.navLabel} variant="bodyLg">
              {ACCESS_COPY.detailTitle}
            </AppText>

            <Ionicons
              color={colors.textNeutralSoft}
              name="chevron-forward"
              size={18}
            />
          </Pressable>
        ) : null}

        {/* DAS-REV-13 §12: la ricondivisione resta disponibile sul percorso
            esterno, e non si sovrappone all'annullamento. */}
        {invite.recipientKind === "email" && invite.state === "pending" ? (
          <Button
            label="Ricondividi link"
            onPress={() =>
              router.push(ADMIN_HREFS.external({ inviteId }) as never)
            }
            testID="invite-reshare"
            variant="secondary"
          />
        ) : null}

        {invite.canCancel ? (
          <Pressable
            accessibilityLabel={cancelInviteQuestion(recipient)}
            accessibilityRole="button"
            onPress={() => {
              setBannerError(null);
              setConfirmVisible(true);
              trackRolesEvent("admin_invite_cancel_opened");
            }}
            style={styles.destructive}
            testID="invite-cancel"
          >
            <Ionicons color={colors.danger} name="trash-outline" size={18} />

            <AppText color="danger" variant="actionLabel">
              {ACCESS_COPY.cancelInviteCta}
            </AppText>
          </Pressable>
        ) : null}
      </ScrollView>

      <ConfirmModal
        cancelLabel={ACCESS_COPY.cancelInviteKeep}
        confirmLabel={ACCESS_COPY.cancelInviteCta}
        destructive
        isBusy={cancel.isPending}
        message={ACCESS_COPY.cancelInviteBody}
        onCancel={() => setConfirmVisible(false)}
        onConfirm={() => {
          trackRolesEvent("admin_invite_cancel_submitted");
          cancel.mutate();
        }}
        title={cancelInviteQuestion(recipient)}
        visible={confirmVisible}
      >
        <View style={styles.confirmIcon}>
          <Ionicons color={colors.danger} name="trash-outline" size={24} />
        </View>
      </ConfirmModal>
    </View>
  );
}

/** Riga di sola lettura: nessun chevron, nessun ruolo di pulsante (§23). */
function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.row}>
      <AppText color="neutral" style={styles.rowLabel} variant="bodyLg">
        {label}
      </AppText>

      <AppText color="neutralMuted" numberOfLines={2} variant="bodySm">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  content: {
    gap: spacing[16],
    padding: spacing[16],
  },
  person: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  personBody: {
    flex: 1,
    gap: spacing[4],
  },
  row: {
    alignItems: "center",
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[10],
  },
  rowLabel: {
    flex: 1,
  },
  navRow: {
    alignItems: "center",
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[10],
  },
  navLabel: {
    flex: 1,
  },
  destructive: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderRadius: radius[12],
    flexDirection: "row",
    gap: spacing[8],
    justifyContent: "center",
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[16],
  },
  banner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius[12],
    padding: spacing[12],
  },
  confirmIcon: {
    alignItems: "center",
    paddingBottom: spacing[8],
  },
});
