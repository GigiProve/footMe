/**
 * La propria richiesta (§18, §19, §24 — screen 07 e 08).
 *
 * «Titolo Richiesta di conferma del ruolo, identità del club, stato neutro
 * Conferma in attesa, profilo/ruolo e Team/ambito richiesti.»
 *
 * Una schermata per tutti gli stati del lifecycle, perché è lo stesso
 * record: §18 — «Un refresh o una notifica di risoluzione aggiorna lo stesso
 * record. Non lasciare Annulla su un APPROVED né mostrare Conferma in attesa
 * dopo un rifiuto».
 */
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
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
import { ClubIdentityRow } from "../components/ClubIdentityRow";
import { RoleConfirmSheet } from "../components/RoleConfirmSheet";
import { RoleLinkScaffold } from "../components/RoleLinkScaffold";
import { newRoleLinkNonce, roleLinkOperationKey } from "../operation-key";
import { trackRoleLinkEvent } from "../role-link-analytics";
import { ROLE_LINK_QK, ROLE_LINK_QK_PREFIXES } from "../role-link-keys";
import {
  ROLE_LINK_COPY,
  ROLE_LINK_FAILURES,
  formatLongDate,
  profileTypeLabel,
  requestStateLabel,
  roleLinkErrorMessage,
} from "../role-link-presentation";
import { ROLE_LINK_HREFS } from "../role-link-routes";
import {
  cancelMyRoleRequest,
  fetchMyRoleRequest,
  toRoleLinkError,
} from "../role-link-service";

export function MyRoleRequestScreen({ requestId }: { requestId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce] = useState(newRoleLinkNonce);

  const requestQuery = useQuery({
    enabled: !!actorId && !!requestId,
    queryFn: () => fetchMyRoleRequest(requestId),
    queryKey: ROLE_LINK_QK.myRequest(actorId, requestId),
    staleTime: STALE_MS.operational,
  });

  const request = requestQuery.data ?? null;

  useEffect(() => {
    if (requestQuery.isSuccess) {
      trackRoleLinkEvent("role_request_detail_opened");
    }
  }, [requestQuery.isSuccess]);

  const cancel = useMutation({
    mutationFn: () => {
      if (!request) throw new Error("ROLE_REQUEST_NOT_FOUND");

      return cancelMyRoleRequest({
        expectedRevision: request.revision,
        operationKey: roleLinkOperationKey(
          nonce,
          `cancel|${requestId}|${request.revision}`,
        ),
        requestId,
      });
    },
    onError: (raw) => {
      const failure = toRoleLinkError(raw);

      trackRoleLinkEvent("role_request_cancel_result", {
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
      trackRoleLinkEvent("role_request_cancel_result", {
        outcome: result.status,
      });
      setSheetOpen(false);

      for (const prefix of ROLE_LINK_QK_PREFIXES) {
        void queryClient.invalidateQueries({ queryKey: [prefix] });
      }

      /*
       * §19: «Se un'approvazione ha vinto la race, non cancellare la
       * membership per simulare l'annullamento. Aggiorna l'esito reale e
       * porta alla gestione del rapporto quando pertinente.»
       */
      if (result.status === "approved" || result.status === "superseded") {
        showToast({ message: ROLE_LINK_COPY.approvedState, tone: "success" });

        if (request) {
          router.replace(ROLE_LINK_HREFS.society(request.clubId) as never);
        }

        return;
      }

      showToast({ message: ROLE_LINK_COPY.cancelled });
    },
  });

  const onBack = () => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace(
      request ? (`/club/${request.clubId}` as never) : ("/(tabs)/cerca" as never),
    );
  };

  if (requestQuery.isLoading && !request) {
    return (
      <RoleLinkScaffold onBack={onBack} title={ROLE_LINK_COPY.myRequestTitle}>
        <DashboardSkeleton />
      </RoleLinkScaffold>
    );
  }

  if (!request) {
    return (
      <RoleLinkScaffold onBack={onBack} title={ROLE_LINK_COPY.myRequestTitle}>
        <DashboardGlobalError
          body={ROLE_LINK_FAILURES.load}
          onRetry={() => void requestQuery.refetch()}
          title="Richiesta non disponibile"
        />
      </RoleLinkScaffold>
    );
  }

  const isPending = request.status === "pending";
  /* §17: disponibilità e lifecycle sono fatti distinti. */
  const notApprovable = isPending && request.teamUnavailable;
  const stateText = notApprovable
    ? ROLE_LINK_COPY.notApprovable
    : requestStateLabel(request.status);

  return (
    <RoleLinkScaffold
      onBack={onBack}
      subheader={
        <ClubIdentityRow
          city={request.clubCity}
          isVerified={request.clubIsVerified}
          logoUrl={request.clubLogoUrl}
          name={request.clubName}
          region={request.clubRegion}
        />
      }
      testID="role-link-my-request"
      title={ROLE_LINK_COPY.myRequestTitle}
    >
      <View style={styles.state}>
        <Ionicons
          color={colors.textNeutralMuted}
          name={isPending ? "time-outline" : "information-circle-outline"}
          size={20}
        />

        <AppText color="neutral" variant="bodyLg">
          {stateText}
        </AppText>
      </View>

      <InviteFieldRow
        label={ROLE_LINK_COPY.profileFieldLabel}
        showDivider
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

      <AppText color="neutralMuted" style={styles.helper} variant="meta">
        {notApprovable
          ? ROLE_LINK_COPY.notApprovableBody
          : isPending
            ? ROLE_LINK_COPY.pendingHelper(request.clubName)
            : (formatLongDate(request.resolvedAt) ?? "")}
      </AppText>

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

      {/* §18: «Mostra Annulla richiesta quando la richiesta è ancora PENDING
          e appartiene alla persona autenticata.» Il backend lo decide, il
          client lo rispecchia. */}
      {request.canCancel ? (
        <View style={styles.actions}>
          <Button
            destructive
            label={ROLE_LINK_COPY.cancelRequest}
            onPress={() => {
              trackRoleLinkEvent("role_request_cancel_confirm_opened");
              setSheetOpen(true);
            }}
            size="md"
            testID="role-request-cancel"
            variant="link"
          />
        </View>
      ) : null}

      <RoleConfirmSheet
        body={ROLE_LINK_COPY.cancelSheetBody(request.clubName)}
        cancelLabel={ROLE_LINK_COPY.cancelBack}
        confirmLabel={ROLE_LINK_COPY.cancelRequest}
        destructive
        isBusy={cancel.isPending}
        onCancel={() => setSheetOpen(false)}
        onConfirm={() => cancel.mutate()}
        testID="role-request-cancel-sheet"
        title={ROLE_LINK_COPY.cancelSheetTitle}
        visible={sheetOpen}
      />
    </RoleLinkScaffold>
  );
}

const styles = StyleSheet.create({
  state: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    paddingBottom: spacing[8],
    paddingTop: spacing[8],
  },
  helper: {
    paddingTop: spacing[16],
  },
  actions: {
    alignItems: "flex-start",
    paddingTop: spacing[24],
  },
});
