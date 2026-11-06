/**
 * Dettaglio Link di invito (DAS-REV-20, screen 13 e 17).
 *
 * Un solo schermo per i due stati: attivo e disattivato cambiano quali righe
 * sono toccabili e quali azioni compaiono, non la struttura (stesso principio
 * del Centro Inviti per sent/received, DAS-REV-19 §01-03). `completedUses` e
 * `activePeople` restano due numeri distinti ovunque (§10): un link può aver
 * esaurito il limite e avere ancora persone collegate in meno.
 *
 * Le mutazioni (limite, scadenza, disattivazione) vivono qui perché sono
 * l'unico punto che conosce `revision` e può costruire una `operationKey`
 * legata al contenuto (§29/§41): i due sheet restano presentazionali.
 */
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppText, Button, useToast } from "../../../../ui";
import { colors, spacing } from "../../../../theme/tokens";
import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardGlobalOffline,
  DashboardSkeleton,
} from "../../components/DashboardStates";
import { SocietyContextHeader } from "../../components/SocietyContextHeader";
import { useAccessWindow } from "../../state/use-access-window";
import { useDashboardConnection } from "../../state/use-dashboard-connection";
import { JoinLinkFieldRow } from "../components/JoinLinkFieldRow";
import { JoinLinkExpirySheet } from "../components/JoinLinkExpirySheet";
import { JoinLinkLimitSheet } from "../components/JoinLinkLimitSheet";
import { JoinLinkRevokeSheet } from "../components/JoinLinkRevokeSheet";
import { buildTeamJoinUrl, copyTeamJoinLink, shareTeamJoinLink } from "../join-link-url";
import { trackJoinLinksEvent } from "../join-links-analytics";
import { JOIN_LINKS_QK, JOIN_LINKS_QK_PREFIXES } from "../join-links-keys";
import {
  JOIN_LINKS_COPY,
  audienceSummary,
  availabilityLabel,
  constraintHelper,
  expiryLabel,
  formatLongDate,
  limitLabel,
  mutationErrorCopy,
  peopleLabel,
  shareMessage,
  usageLine,
} from "../join-links-presentation";
import {
  JOIN_LINKS_HREFS,
  parseJoinLinksOrigin,
} from "../join-links-routes";
import {
  fetchAssignmentRoles,
  isAuthorizationError,
  fetchJoinLink,
  fetchJoinLinkShare,
  fetchJoinLinksCenter,
  revokeJoinLink,
  toJoinLinksError,
  updateJoinLinkExpiry,
  updateJoinLinkLimit,
} from "../join-links-service";
import { newJoinSessionNonce, operationKeyOf } from "../operation-key";

function resolveRoleLabels(
  ids: readonly string[],
  customRoleName: string | null,
  roles: readonly { id: string; isCustom: boolean; label: string }[],
): string[] {
  return ids
    .map((id) => roles.find((role) => role.id === id))
    .filter((role): role is { id: string; isCustom: boolean; label: string } => Boolean(role))
    .map((role) => (role.isCustom && customRoleName ? customRoleName : role.label));
}

export function JoinLinkDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";

  const params = useLocalSearchParams<{ from?: string; linkId?: string }>();
  const linkId = typeof params.linkId === "string" ? params.linkId : "";
  const origin = parseJoinLinksOrigin(params.from) ?? "dashboard";

  const { connection, reportFailure, reportSuccess } = useDashboardConnection();

  const [limitSheetOpen, setLimitSheetOpen] = useState(false);
  const [expirySheetOpen, setExpirySheetOpen] = useState(false);
  const [revokeSheetOpen, setRevokeSheetOpen] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [expiryError, setExpiryError] = useState<string | null>(null);
  const [nonce] = useState(newJoinSessionNonce);

  const detailQuery = useQuery({
    enabled: !!linkId && !!actorId,
    queryFn: () => fetchJoinLink(linkId),
    queryKey: JOIN_LINKS_QK.detail(actorId, linkId),
    retry: (failureCount, error) => !isAuthorizationError(error) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const detail = detailQuery.data ?? null;

  const accessWindow = useAccessWindow({
    accessVerifiedAt: detail?.accessVerifiedAt ?? null,
    isOrganizational: true,
  });

  const validDetail = accessWindow.isValid ? detail : null;

  const rolesQuery = useQuery({
    enabled: !!actorId,
    queryFn: () => fetchAssignmentRoles(),
    queryKey: JOIN_LINKS_QK.roles(actorId),
    staleTime: STALE_MS.management,
  });

  const centerQuery = useQuery({
    enabled: !!validDetail?.clubId,
    queryFn: () => fetchJoinLinksCenter(validDetail?.clubId as string),
    queryKey: JOIN_LINKS_QK.center(actorId, validDetail?.clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const invalidateAll = () => {
    JOIN_LINKS_QK_PREFIXES.forEach((prefix) => {
      void queryClient.invalidateQueries({ queryKey: [prefix] });
    });
  };

  const limitMutation = useMutation({
    mutationFn: (value: number | null) =>
      updateJoinLinkLimit({
        linkId,
        maxRedemptions: value,
        operationKey: operationKeyOf(nonce, `limit:${value ?? "none"}:${validDetail?.revision}`),
        revision: validDetail?.revision as number,
      }),
    onError: (error) => {
      const joinError = toJoinLinksError(error);
      setLimitError(mutationErrorCopy(joinError.code, "update", joinError.detail));
    },
    onSuccess: () => {
      setLimitSheetOpen(false);
      setLimitError(null);
      invalidateAll();
      trackJoinLinksEvent("join_link_limit_result", {});
      showToast({ message: JOIN_LINKS_COPY.limitUpdated, tone: "success" });
    },
  });

  const expiryMutation = useMutation({
    mutationFn: (value: string | null) =>
      updateJoinLinkExpiry({
        expiresOn: value,
        linkId,
        operationKey: operationKeyOf(nonce, `expiry:${value ?? "none"}:${validDetail?.revision}`),
        revision: validDetail?.revision as number,
      }),
    onError: (error) => {
      const joinError = toJoinLinksError(error);
      setExpiryError(mutationErrorCopy(joinError.code, "update", joinError.detail));
    },
    onSuccess: () => {
      setExpirySheetOpen(false);
      setExpiryError(null);
      invalidateAll();
      trackJoinLinksEvent("join_link_expiry_result", {});
      showToast({ message: JOIN_LINKS_COPY.expiryUpdated, tone: "success" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () =>
      revokeJoinLink({
        linkId,
        operationKey: operationKeyOf(nonce, `revoke:${validDetail?.revision}`),
        revision: validDetail?.revision as number,
      }),
    onError: (error) => {
      const joinError = toJoinLinksError(error);
      showToast({
        message: mutationErrorCopy(joinError.code, "revoke", joinError.detail),
        tone: "neutral",
      });
    },
    onSuccess: () => {
      setRevokeSheetOpen(false);
      invalidateAll();
      trackJoinLinksEvent("join_link_revoke_result", {});
      showToast({ message: "Link disattivato", tone: "success" });
    },
  });

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace(
      JOIN_LINKS_HREFS.center({ from: origin }) as Parameters<
        typeof router.replace
      >[0],
    );
  };

  const shell = (body: React.ReactNode) => (
    <View style={styles.root}>
      <View style={styles.navWrap}>
        <SocietyContextHeader
          isVerified={validDetail?.clubIsVerified ?? false}
          logoUrl={validDetail?.clubLogoUrl ?? null}
          name={validDetail?.clubName ?? ""}
          onBack={goBack}
          title={validDetail?.teamName ?? JOIN_LINKS_COPY.peopleTitle}
        />
      </View>
      {body}
    </View>
  );

  if (isAuthorizationError(detailQuery.error)) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: "Torna ai link",
          body: JOIN_LINKS_COPY.notAuthorized,
          icon: "lock-closed-outline",
          title: JOIN_LINKS_COPY.notAuthorized,
        }}
        onAction={goBack}
      />,
    );
  }

  if (detailQuery.isLoading && !validDetail) {
    return shell(
      <View style={styles.content}>
        <DashboardSkeleton />
      </View>,
    );
  }

  if (!validDetail) {
    if (connection === "offline") {
      return shell(
        <DashboardGlobalOffline onRetry={() => void detailQuery.refetch()} />,
      );
    }

    return shell(
      <DashboardGlobalError
        onRetry={() => void detailQuery.refetch()}
        title={JOIN_LINKS_COPY.listError}
      />,
    );
  }

  void reportSuccess;
  void reportFailure;

  const roles = rolesQuery.data?.roles ?? [];
  const roleLabels = resolveRoleLabels(
    validDetail.allowedExecutiveRoles,
    validDetail.executiveCustomRoleName,
    roles,
  );

  const isRevoked = validDetail.status === "revoked";
  const isAvailable = !isRevoked && validDetail.availability === "available";
  const canEditSettings = validDetail.canManage && validDetail.status === "active";
  const helper = isRevoked
    ? null
    : constraintHelper({
        availability: validDetail.availability,
        completedUses: validDetail.completedUses,
        expiresOn: validDetail.expiresOn,
        maxRedemptions: validDetail.maxRedemptions,
      });

  const onShare = async () => {
    trackJoinLinksEvent("join_link_share_opened", {});

    try {
      const share = await fetchJoinLinkShare(validDetail.id);
      const url = buildTeamJoinUrl(share.token);
      const message = shareMessage({
        allowedProfileTypes: share.allowedProfileTypes,
        clubName: share.clubName,
        teamName: share.teamName,
        url,
      });
      const result = await shareTeamJoinLink(message);

      if (result === "unavailable") {
        const copied = await copyTeamJoinLink(url);
        showToast({
          message: copied ? JOIN_LINKS_COPY.copied : JOIN_LINKS_COPY.listError,
          tone: copied ? "success" : "neutral",
        });
      }
    } catch (error) {
      const joinError = toJoinLinksError(error);
      showToast({ message: mutationErrorCopy(joinError.code, "update", joinError.detail), tone: "neutral" });
    }
  };

  const onCopy = async () => {
    trackJoinLinksEvent("join_link_copied", {});

    try {
      const share = await fetchJoinLinkShare(validDetail.id);
      const url = buildTeamJoinUrl(share.token);
      const copied = await copyTeamJoinLink(url);
      showToast({
        message: copied ? JOIN_LINKS_COPY.copied : JOIN_LINKS_COPY.listError,
        tone: copied ? "success" : "neutral",
      });
    } catch (error) {
      const joinError = toJoinLinksError(error);
      showToast({ message: mutationErrorCopy(joinError.code, "update", joinError.detail), tone: "neutral" });
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.navWrap}>
        <SocietyContextHeader
          isVerified={validDetail.clubIsVerified}
          logoUrl={validDetail.clubLogoUrl}
          name={validDetail.clubName}
          onBack={goBack}
          title={validDetail.teamName}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <AppText color="neutralMuted" style={styles.availability} variant="meta">
          {availabilityLabel(validDetail.availability)}
        </AppText>

        <JoinLinkFieldRow
          label={JOIN_LINKS_COPY.audienceField}
          value={audienceSummary(validDetail.allowedProfileTypes)}
        />

        {roleLabels.length > 0 ? (
          <JoinLinkFieldRow
            label={JOIN_LINKS_COPY.executiveRolesField}
            value={roleLabels.join(", ")}
          />
        ) : null}

        <JoinLinkFieldRow
          label={JOIN_LINKS_COPY.expiryField}
          onPress={canEditSettings ? () => setExpirySheetOpen(true) : undefined}
          testID="join-link-expiry-row"
          value={expiryLabel(validDetail.expiresOn)}
        />

        <JoinLinkFieldRow
          label={JOIN_LINKS_COPY.limitField}
          onPress={canEditSettings ? () => setLimitSheetOpen(true) : undefined}
          secondLine={usageLine(validDetail.completedUses, validDetail.maxRedemptions)}
          testID="join-link-limit-row"
          value={limitLabel(validDetail.maxRedemptions)}
        />

        <JoinLinkFieldRow
          label={JOIN_LINKS_COPY.peopleField}
          onPress={
            validDetail.canViewPeople
              ? () => router.push(JOIN_LINKS_HREFS.people(validDetail.id) as never)
              : undefined
          }
          testID="join-link-people-row"
          value={peopleLabel(validDetail.activePeople)}
        />

        <JoinLinkFieldRow
          label={JOIN_LINKS_COPY.createdField}
          value={formatLongDate(validDetail.createdAt) ?? ""}
        />

        {isRevoked ? (
          <JoinLinkFieldRow
            label={JOIN_LINKS_COPY.revokedField}
            value={formatLongDate(validDetail.revokedAt) ?? ""}
          />
        ) : null}

        {helper ? (
          <AppText color="neutralMuted" style={styles.helper} variant="meta">
            {helper}
          </AppText>
        ) : null}

        {/* §8: «View-only vede dati autorizzati senza chevron di modifica o
            CTA non consentite.» §39 ricorda che `canShare` non si deduce dal
            solo stato: un actor che può consultare il link non per questo può
            distribuirlo. */}
        {isAvailable && validDetail.canShare ? (
          <View style={styles.actions}>
            <Button
              fullWidth
              label={JOIN_LINKS_COPY.share}
              onPress={() => void onShare()}
              testID="join-link-share"
              variant="primary"
            />
            <Button
              fullWidth
              label={JOIN_LINKS_COPY.copy}
              onPress={() => void onCopy()}
              style={styles.secondaryAction}
              testID="join-link-copy"
              variant="secondary"
            />
            {validDetail.canRevoke ? (
              <Button
                fullWidth
                label={JOIN_LINKS_COPY.revoke}
                onPress={() => setRevokeSheetOpen(true)}
                style={styles.secondaryAction}
                testID="join-link-revoke"
                variant="danger"
              />
            ) : null}
          </View>
        ) : null}

        {isRevoked && centerQuery.data?.canCreate ? (
          <Button
            fullWidth
            label={JOIN_LINKS_COPY.create}
            onPress={() =>
              router.push(
                JOIN_LINKS_HREFS.composeConfigure({ from: origin }) as Parameters<
                  typeof router.push
                >[0],
              )
            }
            style={styles.actions}
            testID="join-links-create"
            variant="primary"
          />
        ) : null}
      </ScrollView>

      <JoinLinkLimitSheet
        completedUses={validDetail.completedUses}
        error={limitError}
        isSaving={limitMutation.isPending}
        onClose={() => {
          setLimitSheetOpen(false);
          setLimitError(null);
        }}
        onSave={(value) => limitMutation.mutate(value)}
        value={validDetail.maxRedemptions}
        visible={limitSheetOpen}
      />

      <JoinLinkExpirySheet
        error={expiryError}
        isSaving={expiryMutation.isPending}
        onClose={() => {
          setExpirySheetOpen(false);
          setExpiryError(null);
        }}
        onSave={(value) => expiryMutation.mutate(value)}
        value={validDetail.expiresOn}
        visible={expirySheetOpen}
      />

      <JoinLinkRevokeSheet
        isBusy={revokeMutation.isPending}
        onClose={() => setRevokeSheetOpen(false)}
        onConfirm={() => revokeMutation.mutate()}
        visible={revokeSheetOpen}
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
  content: {
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
  },
  availability: {
    marginBottom: spacing[12],
  },
  helper: {
    marginTop: spacing[12],
  },
  actions: {
    marginTop: spacing[24],
  },
  secondaryAction: {
    marginTop: spacing[12],
  },
});
