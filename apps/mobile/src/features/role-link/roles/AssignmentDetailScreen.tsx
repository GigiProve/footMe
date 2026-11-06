/**
 * Dettaglio del singolo incarico, lato persona (§28, §35 — screen 15 e 19).
 *
 * «Le righe Tipo di ruolo e Squadra del master sono riepiloghi read-only;
 * non campi che salvano al tap.» Per questo usano `InviteFieldRow` senza
 * `onPress`: non hanno chevron e non vengono annunciate come controlli.
 *
 * «Non mostrare Scollegati dalla società come azione equivalente in questo
 * livello»: il termine completo vive sul rapporto, una schermata sopra.
 */
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { spacing } from "../../../theme/tokens";
import { AppText, Avatar, Button, useToast } from "../../../ui";
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
import {
  ROLE_LINK_QK,
  ROLE_LINK_QK_PREFIXES,
  ROLE_LINK_RELATED_PREFIXES,
} from "../role-link-keys";
import {
  ROLE_LINK_COPY,
  ROLE_LINK_FAILURES,
  removeRoleSheetBody,
  roleLinkErrorMessage,
} from "../role-link-presentation";
import { ROLE_LINK_HREFS } from "../role-link-routes";
import {
  endAssignment,
  fetchMyAssignment,
  toRoleLinkError,
} from "../role-link-service";

export function AssignmentDetailScreen({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce] = useState(newRoleLinkNonce);

  const detailQuery = useQuery({
    enabled: !!actorId && !!assignmentId,
    queryFn: () => fetchMyAssignment(assignmentId),
    queryKey: ROLE_LINK_QK.myAssignment(actorId, assignmentId),
    staleTime: STALE_MS.operational,
  });

  const detail = detailQuery.data ?? null;

  useEffect(() => {
    if (detailQuery.isSuccess) {
      trackRoleLinkEvent("role_link_assignment_opened");
    }
  }, [detailQuery.isSuccess]);

  const remove = useMutation({
    mutationFn: () => {
      if (!detail) throw new Error("ASSIGNMENT_NOT_FOUND");

      return endAssignment({
        /* §28: il comando colpisce il **segmento corrente** della linea, non
           l'ID del deep link che potrebbe essere già superato. */
        assignmentId: detail.assignmentId,
        expectedRevision: detail.revision,
        operationKey: roleLinkOperationKey(
          nonce,
          `end|${detail.assignmentId}|${detail.revision}`,
        ),
      });
    },
    onError: (raw) => {
      const failure = toRoleLinkError(raw);

      trackRoleLinkEvent("role_link_assignment_remove_result", {
        outcome: "error",
        reason: failure.code,
      });
      setSheetOpen(false);
      setError(
        failure.code === "UNKNOWN"
          ? ROLE_LINK_FAILURES.remove
          : roleLinkErrorMessage(failure.code),
      );
      void detailQuery.refetch();
    },
    onSuccess: (result) => {
      trackRoleLinkEvent("role_link_assignment_remove_result", {
        outcome: "removed",
      });
      setSheetOpen(false);

      for (const prefix of [
        ...ROLE_LINK_QK_PREFIXES,
        ...ROLE_LINK_RELATED_PREFIXES,
      ]) {
        void queryClient.invalidateQueries({ queryKey: [prefix] });
      }

      showToast({ message: ROLE_LINK_COPY.roleRemoved });

      /* §35: «Se non ne rimane nessuno aggiorna la membership aggregata a
         inattiva»: l'elenco delle società è la destinazione corretta,
         perché il rapporto non c'è più. */
      router.replace(
        (result.remainingActive > 0 && detail
          ? ROLE_LINK_HREFS.society(detail.clubId)
          : ROLE_LINK_HREFS.societies) as never,
      );
    },
  });

  const onBack = () => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace(
      (detail
        ? ROLE_LINK_HREFS.society(detail.clubId)
        : ROLE_LINK_HREFS.societies) as never,
    );
  };

  if (detailQuery.isLoading && !detail) {
    return (
      <RoleLinkScaffold onBack={onBack} title={null}>
        <DashboardSkeleton />
      </RoleLinkScaffold>
    );
  }

  if (!detail) {
    return (
      <RoleLinkScaffold onBack={onBack} title={null}>
        <DashboardGlobalError
          body={ROLE_LINK_FAILURES.load}
          onRetry={() => void detailQuery.refetch()}
          title="Incarico non disponibile"
        />
      </RoleLinkScaffold>
    );
  }

  const sheet = removeRoleSheetBody({
    actorSide: "person",
    clubName: detail.clubName,
    contextLabel: detail.contextLabel,
    otherActiveCount: detail.otherActiveCount,
    roleLabel: detail.roleLabel,
  });

  return (
    <View style={styles.root}>
      <RoleLinkScaffold
        onBack={onBack}
        subheader={
          <ClubIdentityRow
            city={null}
            isVerified={detail.clubIsVerified}
            logoUrl={detail.clubLogoUrl}
            name={detail.clubName}
          />
        }
        testID="role-link-assignment"
        title={null}
      >
        {/* §28: società in testata, identità personale e titolo del ruolo
            corrente con la sua squadra o il suo ambito. */}
        <View style={styles.hero}>
          <Avatar
            name={profile?.full_name ?? ""}
            size="md"
            uri={profile?.avatar_url ?? undefined}
          />

          <View style={styles.heroBody}>
            <AppText accessibilityRole="header" color="neutral" variant="titleMd">
              {detail.roleLabel}
            </AppText>

            <AppText color="neutralMuted" variant="meta">
              {detail.contextLabel}
            </AppText>
          </View>
        </View>

        <InviteFieldRow
          label={ROLE_LINK_COPY.roleTypeFieldLabel}
          showDivider
          value={detail.profileTypeLabel}
        />

        <InviteFieldRow
          label={
            detail.scopeType === "society"
              ? ROLE_LINK_COPY.scopeFieldLabel
              : ROLE_LINK_COPY.teamFieldLabel
          }
          showDivider
          value={detail.contextLabel}
        />

        <AppText color="neutralMuted" style={styles.helper} variant="meta">
          {detail.canManage
            ? ROLE_LINK_COPY.assignmentHelper
            : /* §28: «Se la linea è terminata senza successore, mostra
                 l'esito corrente senza Modifica/Rimuovi attivi.» */
              "Questo incarico non è più attivo."}
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

        {detail.canManage ? (
          <View style={styles.actions}>
            <Button
              fullWidth
              label={ROLE_LINK_COPY.editRole}
              onPress={() =>
                router.push(
                  ROLE_LINK_HREFS.assignmentEdit(detail.assignmentId) as never,
                )
              }
              size="lg"
              testID="role-link-edit"
              variant="primary"
            />

            <Button
              destructive
              label={ROLE_LINK_COPY.removeRole}
              onPress={() => {
                trackRoleLinkEvent("role_link_assignment_remove_confirm_opened", {
                  actor_type: "person",
                });
                setSheetOpen(true);
              }}
              size="md"
              testID="role-link-remove"
              variant="link"
            />
          </View>
        ) : null}
      </RoleLinkScaffold>

      <RoleConfirmSheet
        body={sheet.body}
        cancelLabel={ROLE_LINK_COPY.cancelLabel}
        confirmLabel={ROLE_LINK_COPY.removeRole}
        destructive
        isBusy={remove.isPending}
        note={sheet.note}
        onCancel={() => setSheetOpen(false)}
        onConfirm={() => remove.mutate()}
        testID="role-link-remove-sheet"
        title={ROLE_LINK_COPY.removeRoleSheetTitle}
        visible={sheetOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingBottom: spacing[12],
    paddingTop: spacing[8],
  },
  heroBody: {
    flex: 1,
    gap: spacing[4],
  },
  helper: {
    paddingTop: spacing[16],
  },
  actions: {
    alignItems: "stretch",
    gap: spacing[8],
    paddingTop: spacing[24],
  },
});
