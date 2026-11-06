/**
 * Dettaglio societario della richiesta (§21, §22, §23, §24 — screen 10, 11,
 * 12).
 *
 * Vive sulla **stessa** route del dettaglio consultabile di DAS-REV-19 §15,
 * che la preannunciava: «La gestione arriva con DAS-REV-21, sulla stessa
 * destinazione.» Nessun secondo Centro e nessuna seconda inbox (§3).
 *
 * «Approva è one tap. Il dettaglio contiene già i dati da confermare: non
 * introdurre un ulteriore sheet Approva richiesta?» Il rifiuto invece ha la
 * sua conferma, perché nega qualcosa che la persona ha chiesto.
 *
 * «La società non modifica la richiesta, il custom, la squadra o l'ambito
 * prima di approvarla»: qui non esiste nessun campo editabile.
 */
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, useToast } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../../dashboard/cache/freshness-policy";
import {
  DashboardGlobalError,
  DashboardSkeleton,
} from "../../dashboard/components/DashboardStates";
import { InviteFieldRow } from "../../dashboard/invites/components/InviteFieldRow";
import { InvitePersonHeader } from "../../dashboard/invites/components/InvitePersonHeader";
import { SocietyContextHeader } from "../../dashboard/components/SocietyContextHeader";
import { RoleConfirmSheet } from "../components/RoleConfirmSheet";
import { RoleOutcomeView } from "../components/RoleOutcomeView";
import { newRoleLinkNonce, roleLinkOperationKey } from "../operation-key";
import { trackRoleLinkEvent } from "../role-link-analytics";
import {
  ROLE_LINK_QK,
  ROLE_LINK_QK_PREFIXES,
  ROLE_LINK_RELATED_PREFIXES,
} from "../role-link-keys";
import {
  ROLE_LINK_COPY,
  ROLE_LINK_FAILURES,
  formatLongDate,
  profileTypeLabel,
  requestStateLabel,
  roleLinkErrorMessage,
} from "../role-link-presentation";
import {
  approveRoleRequest,
  declineRoleRequest,
  fetchSocietyRoleRequest,
  markSocietyRoleRequestRead,
  toRoleLinkError,
} from "../role-link-service";

export function SocietyRoleRequestScreen({
  requestId,
}: {
  requestId: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [nonce] = useState(newRoleLinkNonce);

  const requestQuery = useQuery({
    enabled: !!actorId && !!requestId,
    queryFn: () => fetchSocietyRoleRequest(requestId),
    queryKey: ROLE_LINK_QK.societyRequest(actorId, requestId),
    staleTime: STALE_MS.operational,
  });

  const request = requestQuery.data ?? null;

  const markRead = useMutation({
    mutationFn: () => markSocietyRoleRequestRead(requestId),
    onSuccess: () => {
      /* §17: la lista e i suoi count si riconciliano; il lifecycle non
         cambia, e la lettura è del solo actor. */
      void queryClient.invalidateQueries({ queryKey: ["society-invites-list"] });
      void queryClient.invalidateQueries({ queryKey: ["society-invites-center"] });
    },
  });

  const { isSuccess } = requestQuery;
  const isUnread = request?.isUnread ?? false;
  const { mutate: markReadMutate } = markRead;

  useEffect(() => {
    /* §17: «Marca la lettura mediante comando idempotente dopo l'apertura
       riuscita del dettaglio, non con GET del Centro, prefetch o scroll.» */
    if (isSuccess && isUnread && requestId) {
      markReadMutate();
    }
  }, [isSuccess, isUnread, markReadMutate, requestId]);

  useEffect(() => {
    if (isSuccess) {
      trackRoleLinkEvent("role_request_detail_opened", { actor_type: "society" });
    }
  }, [isSuccess]);

  function invalidate() {
    for (const prefix of [
      ...ROLE_LINK_QK_PREFIXES,
      ...ROLE_LINK_RELATED_PREFIXES,
    ]) {
      void queryClient.invalidateQueries({ queryKey: [prefix] });
    }
  }

  const approve = useMutation({
    mutationFn: () => {
      if (!request) throw new Error("ROLE_REQUEST_NOT_FOUND");

      return approveRoleRequest({
        expectedRevision: request.revision,
        operationKey: roleLinkOperationKey(
          nonce,
          `approve|${requestId}|${request.revision}`,
        ),
        requestId,
      });
    },
    onError: (raw) => {
      const failure = toRoleLinkError(raw);

      trackRoleLinkEvent("role_request_resolve_result", {
        outcome: "error",
        reason: failure.code,
      });
      setError(
        failure.code === "UNKNOWN"
          ? ROLE_LINK_FAILURES.updateRequest
          : roleLinkErrorMessage(failure.code, { club: request?.clubName }),
      );
      void requestQuery.refetch();
    },
    onSuccess: (result) => {
      trackRoleLinkEvent("role_request_resolve_result", {
        outcome: result.status,
      });
      invalidate();

      /* §22: «applica in tal caso la risoluzione neutra, senza fingere una
         nuova approvazione». L'esito celebrativo appartiene solo a
         `approved`. */
      if (result.status === "approved") {
        setApproved(true);

        return;
      }

      showToast({ message: ROLE_LINK_COPY.supersededState });
      void requestQuery.refetch();
    },
  });

  const decline = useMutation({
    mutationFn: () => {
      if (!request) throw new Error("ROLE_REQUEST_NOT_FOUND");

      return declineRoleRequest({
        expectedRevision: request.revision,
        operationKey: roleLinkOperationKey(
          nonce,
          `decline|${requestId}|${request.revision}`,
        ),
        requestId,
      });
    },
    onError: (raw) => {
      const failure = toRoleLinkError(raw);

      trackRoleLinkEvent("role_request_resolve_result", {
        outcome: "error",
        reason: failure.code,
      });
      setSheetOpen(false);
      setError(
        failure.code === "UNKNOWN"
          ? ROLE_LINK_FAILURES.updateRequest
          : roleLinkErrorMessage(failure.code, { club: request?.clubName }),
      );
      void requestQuery.refetch();
    },
    onSuccess: (result) => {
      trackRoleLinkEvent("role_request_resolve_result", {
        outcome: result.status,
      });
      setSheetOpen(false);
      invalidate();
      void requestQuery.refetch();
    },
  });

  function onBack() {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace("/(tabs)/dashboard/invites?tab=received" as never);
  }

  const header = (name: string, logo: string | null, verified: boolean) => (
    <SocietyContextHeader
      isVerified={verified}
      logoUrl={logo}
      name={name}
      onBack={onBack}
      title={ROLE_LINK_COPY.myRequestTitle}
    />
  );

  if (requestQuery.isLoading && !request) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.pad}>{header("", null, false)}</View>
        <DashboardSkeleton />
      </View>
    );
  }

  if (!request) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.pad}>{header("", null, false)}</View>
        <DashboardGlobalError
          body={ROLE_LINK_FAILURES.load}
          onRetry={() => void requestQuery.refetch()}
          title="Richiesta non disponibile"
        />
      </View>
    );
  }

  /* Screen 12 — esito dell'azione societaria (§22). */
  if (approved) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={styles.pad}>
          <SocietyContextHeader
            isVerified={request.clubIsVerified}
            logoUrl={request.clubLogoUrl}
            name={request.clubName}
            onBack={onBack}
          />

          <RoleOutcomeView
            avatarUrl={request.personAvatarUrl}
            body={ROLE_LINK_COPY.approvedBody(
              request.personName,
              request.roleLabel,
              request.contextLabel,
            )}
            name={request.personName}
            testID="role-request-approved"
            title={ROLE_LINK_COPY.approvedTitle}
          />

          <Button
            fullWidth
            label={ROLE_LINK_COPY.close}
            onPress={onBack}
            size="lg"
            testID="role-request-approved-close"
            variant="primary"
          />
        </ScrollView>
      </View>
    );
  }

  const resolved = formatLongDate(request.resolvedAt);
  const created = formatLongDate(request.createdAt);
  /* §24: tre indisponibilità diverse, tre frasi diverse. */
  const unavailable =
    request.status === "pending" && request.teamUnavailable
      ? ROLE_LINK_COPY.notApprovableBody
      : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.pad}>
        {header(request.clubName, request.clubLogoUrl, request.clubIsVerified)}

        <InvitePersonHeader
          avatarUrl={request.personAvatarUrl}
          name={request.personName}
        />

        {request.canViewPerson ? (
          <View style={styles.profileAction}>
            <Button
              label={ROLE_LINK_COPY.viewProfile}
              onPress={() =>
                router.push(`/profile/${request.personProfileId}` as never)
              }
              size="sm"
              testID="role-request-view-profile"
              variant="link"
            />
          </View>
        ) : null}

        <AppText color="neutralMuted" style={styles.section} variant="metaStrong">
          {ROLE_LINK_COPY.roleToConfirm}
        </AppText>

        <InviteFieldRow
          label={ROLE_LINK_COPY.profileFieldLabel}
          value={profileTypeLabel(request.profileType)}
        />

        {request.profileType === "staff" || request.profileType === "director" ? (
          <InviteFieldRow
            label={ROLE_LINK_COPY.roleFieldLabel}
            showDivider
            value={request.roleLabel}
          />
        ) : null}

        <InviteFieldRow
          label={
            request.scopeType === "society"
              ? ROLE_LINK_COPY.scopeFieldLabel
              : ROLE_LINK_COPY.teamFieldLabel
          }
          showDivider
          value={request.contextLabel}
        />

        {request.status !== "pending" ? (
          <InviteFieldRow
            label="Stato"
            showDivider
            value={
              resolved
                ? `${requestStateLabel(request.status)} · ${resolved}`
                : requestStateLabel(request.status)
            }
          />
        ) : null}

        {created ? (
          <InviteFieldRow label="Ricevuta" showDivider value={created} />
        ) : null}

        {unavailable ? (
          <AppText color="neutralMuted" style={styles.helper} variant="meta">
            {`${ROLE_LINK_COPY.notApprovable} ${unavailable}`}
          </AppText>
        ) : null}

        {error ? (
          <AppText
            accessibilityRole="alert"
            color="danger"
            style={styles.helper}
            variant="meta"
          >
            {error}
          </AppText>
        ) : null}

        {/* §21: «soltanto per richiesta ancora risolvibile e actor
            autorizzato». Lo decide il backend. */}
        {request.canResolve && !unavailable ? (
          <View style={styles.actions}>
            <Button
              fullWidth
              label={ROLE_LINK_COPY.approve}
              loading={approve.isPending}
              onPress={() => {
                setError(null);
                approve.mutate();
              }}
              size="lg"
              testID="role-request-approve"
              variant="primary"
            />

            <Button
              fullWidth
              label={ROLE_LINK_COPY.decline}
              onPress={() => setSheetOpen(true)}
              size="md"
              testID="role-request-decline"
              variant="neutralOutline"
            />
          </View>
        ) : null}
      </ScrollView>

      <RoleConfirmSheet
        body={ROLE_LINK_COPY.declineSheetBody(
          request.personName,
          request.roleLabel,
          request.contextLabel,
        )}
        cancelLabel={ROLE_LINK_COPY.cancelLabel}
        confirmLabel={ROLE_LINK_COPY.declineConfirm}
        destructive
        isBusy={decline.isPending}
        onCancel={() => setSheetOpen(false)}
        onConfirm={() => decline.mutate()}
        testID="role-request-decline-sheet"
        title={ROLE_LINK_COPY.declineSheetTitle}
        visible={sheetOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  pad: {
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  profileAction: {
    alignItems: "flex-start",
  },
  section: {
    paddingBottom: spacing[4],
    paddingTop: spacing[16],
  },
  helper: {
    paddingTop: spacing[16],
  },
  actions: {
    gap: spacing[8],
    paddingTop: spacing[24],
  },
});
