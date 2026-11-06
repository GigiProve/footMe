/**
 * Screen 04 del composer — Riepilogo (§11, §16, §17, §25).
 *
 * L'unica mutazione di creazione parte da qui, mai dall'apertura dello
 * schermo: finché non si preme Genera link non esiste alcun record (§11).
 * La chiave idempotente viene dal provider (`operationKey`, §17, §25): stesso
 * submit e stesso payload restituiscono lo stesso link. In errore il modulo
 * resta compilato e permette un retry sicuro.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { AppText, Button } from "../../../../ui";
import { colors, spacing } from "../../../../theme/tokens";
import { DashboardGlobalError, DashboardSkeleton } from "../../components/DashboardStates";
import { SocietyContextHeader } from "../../components/SocietyContextHeader";
import { useSession } from "../../../auth/use-session";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  JOIN_LINKS_COPY,
  audienceSummary,
  expiryLabel,
  limitLabel,
  mutationErrorCopy,
  normalizeCustomRole,
} from "../join-links-presentation";
import { JOIN_LINKS_QK, JOIN_LINKS_QK_PREFIXES } from "../join-links-keys";
import { JOIN_LINKS_HREFS } from "../join-links-routes";
import { trackJoinLinksEvent } from "../join-links-analytics";
import type { JoinLinksErrorCode } from "../join-links-service";
import {
  createJoinLink,
  fetchAssignmentRoles,
  fetchJoinLinksCenter,
  toJoinLinksError,
} from "../join-links-service";
import { useComposeExitGuard } from "./use-compose-exit-guard";
import { useJoinLinkCompose } from "./JoinLinkComposeProvider";

export function JoinLinkReviewScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : "";
  const actorId = profile?.id ?? "";

  const { draft, isDirty, operationKey, reset } = useJoinLinkCompose();
  const handleExit = useComposeExitGuard({ isDirty });

  const centerQuery = useQuery({
    queryKey: JOIN_LINKS_QK.center(actorId, clubId),
    queryFn: () => fetchJoinLinksCenter(clubId),
    staleTime: STALE_MS.operational,
  });

  const hasDirector = draft.profileTypes.includes("director");

  const rolesQuery = useQuery({
    queryKey: JOIN_LINKS_QK.roles(actorId),
    queryFn: () => fetchAssignmentRoles(),
    staleTime: STALE_MS.presentation,
    enabled: hasDirector,
  });

  const [isSubmitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<JoinLinksErrorCode | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  function handleBack() {
    router.back();
  }

  async function handleGenerate() {
    if (isSubmitting || !draft.teamId) {
      return;
    }

    setSubmitting(true);
    setErrorCode(null);
    setErrorDetail(null);

    const normalizedCustom = hasDirector
      ? normalizeCustomRole(draft.customExecutiveRole)
      : "";

    try {
      const result = await createJoinLink({
        clubId,
        teamId: draft.teamId,
        profileTypes: draft.profileTypes,
        executiveRoleIds: hasDirector ? draft.executiveRoleIds : [],
        customExecutiveRole: normalizedCustom.length > 0 ? normalizedCustom : null,
        expiresOn: draft.expiresOn,
        maxRedemptions: draft.maxRedemptions,
        operationKey,
      });

      for (const prefix of JOIN_LINKS_QK_PREFIXES) {
        queryClient.invalidateQueries({ queryKey: [prefix] });
      }

      trackJoinLinksEvent("join_link_submit_result", {
        categoriesCount: draft.profileTypes.length,
        hasExpiry: draft.expiresOn !== null,
        hasLimit: draft.maxRedemptions !== null,
        hasExecutiveRoles: hasDirector && draft.executiveRoleIds.length > 0,
        alreadyApplied: result.alreadyApplied,
      });

      reset();
      router.replace(JOIN_LINKS_HREFS.composeReady(result.linkId) as Parameters<typeof router.replace>[0]);
    } catch (error) {
      const parsed = toJoinLinksError(error);
      setErrorCode(parsed.code as JoinLinksErrorCode);
      setErrorDetail(parsed.detail ?? null);
    } finally {
      setSubmitting(false);
    }
  }

  if (centerQuery.isLoading || (hasDirector && rolesQuery.isLoading)) {
    return <DashboardSkeleton />;
  }

  if (centerQuery.isError || !centerQuery.data || (hasDirector && (rolesQuery.isError || !rolesQuery.data))) {
    return (
      <DashboardGlobalError
        onRetry={() => {
          centerQuery.refetch();
          if (hasDirector) {
            rolesQuery.refetch();
          }
        }}
      />
    );
  }

  const center = centerQuery.data;
  const roleLabels = hasDirector
    ? draft.executiveRoleIds
        .map((id) => rolesQuery.data?.roles.find((role) => role.id === id))
        .filter((role): role is NonNullable<typeof role> => Boolean(role))
    : [];
  const customRoleValue = normalizeCustomRole(draft.customExecutiveRole);
  const executiveRolesText = [
    ...roleLabels.filter((role) => !role.isCustom).map((role) => role.label),
    ...(roleLabels.some((role) => role.isCustom) && customRoleValue
      ? [customRoleValue]
      : []),
  ].join(", ");

  return (
    <View style={styles.screen}>
      <SocietyContextHeader
        title={JOIN_LINKS_COPY.reviewTitle}
        isVerified={center.clubIsVerified}
        logoUrl={center.clubLogoUrl}
        name={center.clubName}
        onBack={handleBack}
        onCancel={handleExit}
      />

      <View style={styles.body}>
        <ReviewRow label={JOIN_LINKS_COPY.societyField} value={center.clubName} />
        <ReviewRow label={JOIN_LINKS_COPY.teamField} value={draft.teamLabel ?? ""} />
        <ReviewRow
          label={JOIN_LINKS_COPY.audienceField}
          value={audienceSummary(draft.profileTypes)}
        />
        {hasDirector && executiveRolesText.length > 0 ? (
          <ReviewRow
            label={JOIN_LINKS_COPY.executiveRolesField}
            value={executiveRolesText}
          />
        ) : null}
        <ReviewRow label={JOIN_LINKS_COPY.expiryField} value={expiryLabel(draft.expiresOn)} />
        <ReviewRow label={JOIN_LINKS_COPY.limitField} value={limitLabel(draft.maxRedemptions)} />

        <Button
          label={JOIN_LINKS_COPY.edit}
          onPress={handleBack}
          variant="link"
          testID="join-link-edit"
        />

        {errorCode ? (
          <AppText variant="caption" color="danger">
            {mutationErrorCopy(errorCode, "create", errorDetail)}
          </AppText>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Button
          label={JOIN_LINKS_COPY.generate}
          onPress={handleGenerate}
          variant="primary"
          fullWidth
          loading={isSubmitting}
          disabled={isSubmitting}
          testID="join-link-generate"
        />
      </View>
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="meta" color="neutralMuted">
        {label}
      </AppText>
      <AppText variant="bodyLg" color="neutral">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing[12],
    padding: spacing[4],
  },
  footer: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
  },
  row: {
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[4],
    paddingVertical: spacing[12],
  },
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
