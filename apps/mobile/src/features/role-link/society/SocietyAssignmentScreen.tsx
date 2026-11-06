/**
 * Il singolo incarico, lato Società (§33, §34 — screen 22).
 *
 * «Header AC Como, avatar e nome Mario Rossi, sottotitolo Allenatore · Prima
 * squadra. Non sostituire il nome della persona con la professione.»
 *
 * «Indietro chiude soltanto il dettaglio; non annulla un salvataggio o
 * ripristino già confermato.» Per questo è una normale uscita e non una
 * conferma: non c'è niente da perdere, perché non c'è un draft.
 */
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Button, useToast } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../../dashboard/cache/freshness-policy";
import {
  DashboardGlobalError,
  DashboardSkeleton,
} from "../../dashboard/components/DashboardStates";
import { InviteFieldRow } from "../../dashboard/invites/components/InviteFieldRow";
import { SocietyContextHeader } from "../../dashboard/components/SocietyContextHeader";
import { RoleConfirmSheet } from "../components/RoleConfirmSheet";
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
  firstName,
  removeRoleSheetBody,
  roleLinkErrorMessage,
} from "../role-link-presentation";
import { ROLE_LINK_HREFS } from "../role-link-routes";
import {
  endAssignment,
  fetchSocietyAssignment,
  restoreAssignment,
  toRoleLinkError,
} from "../role-link-service";

export function SocietyAssignmentScreen({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce] = useState(newRoleLinkNonce);

  const detailQuery = useQuery({
    enabled: !!actorId && !!assignmentId,
    queryFn: () => fetchSocietyAssignment(assignmentId),
    queryKey: ROLE_LINK_QK.societyAssignment(actorId, assignmentId),
    staleTime: STALE_MS.operational,
  });

  const detail = detailQuery.data ?? null;

  useEffect(() => {
    if (detailQuery.isSuccess) {
      trackRoleLinkEvent("role_link_assignment_opened", {
        actor_type: "society",
      });
    }
  }, [detailQuery.isSuccess]);

  function invalidate() {
    for (const prefix of [
      ...ROLE_LINK_QK_PREFIXES,
      ...ROLE_LINK_RELATED_PREFIXES,
    ]) {
      void queryClient.invalidateQueries({ queryKey: [prefix] });
    }
  }

  const restore = useMutation({
    mutationFn: () => {
      if (!detail) throw new Error("ASSIGNMENT_NOT_FOUND");

      return restoreAssignment({
        assignmentId: detail.assignmentId,
        expectedRevision: detail.revision,
        operationKey: roleLinkOperationKey(
          nonce,
          `restore|${detail.assignmentId}|${detail.revision}`,
        ),
      });
    },
    onError: (raw) => {
      const failure = toRoleLinkError(raw);

      trackRoleLinkEvent("role_link_assignment_restore_result", {
        outcome: "error",
        reason: failure.code,
      });
      setError(
        failure.code === "UNKNOWN"
          ? ROLE_LINK_FAILURES.save
          : roleLinkErrorMessage(failure.code),
      );
      void detailQuery.refetch();
    },
    onSuccess: () => {
      trackRoleLinkEvent("role_link_assignment_restore_result", {
        outcome: "restored",
      });
      invalidate();
      showToast({ message: ROLE_LINK_COPY.roleRestored, tone: "success" });
      void detailQuery.refetch();
    },
  });

  const remove = useMutation({
    mutationFn: () => {
      if (!detail) throw new Error("ASSIGNMENT_NOT_FOUND");

      return endAssignment({
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
        actor_type: "society",
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
    onSuccess: () => {
      trackRoleLinkEvent("role_link_assignment_remove_result", {
        actor_type: "society",
        outcome: "removed",
      });
      setSheetOpen(false);
      invalidate();
      showToast({ message: ROLE_LINK_COPY.roleRemoved });
      onBack();
    },
  });

  function onBack() {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace(
      (detail
        ? ROLE_LINK_HREFS.societyPerson(detail.clubId, detail.personProfileId)
        : "/(tabs)/dashboard") as never,
    );
  }

  if (detailQuery.isLoading && !detail) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.pad}>
          <SocietyContextHeader
            isVerified={false}
            logoUrl={null}
            name=""
            onBack={onBack}
          />
        </View>
        <DashboardSkeleton />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.pad}>
          <SocietyContextHeader
            isVerified={false}
            logoUrl={null}
            name=""
            onBack={onBack}
          />
        </View>
        <DashboardGlobalError
          body={ROLE_LINK_FAILURES.load}
          onRetry={() => void detailQuery.refetch()}
          title="Incarico non disponibile"
        />
      </View>
    );
  }

  const sheet = removeRoleSheetBody({
    actorSide: "society",
    clubName: detail.clubName,
    contextLabel: detail.contextLabel,
    otherActiveCount: detail.otherActiveCount,
    personFirstName: firstName(detail.personName),
    roleLabel: detail.roleLabel,
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.pad}>
        <SocietyContextHeader
          isVerified={detail.clubIsVerified}
          logoUrl={detail.clubLogoUrl}
          name={detail.clubName}
          onBack={onBack}
        />

        <View style={styles.person}>
          <Avatar
            name={detail.personName}
            size="md"
            uri={detail.personAvatarUrl ?? undefined}
          />

          <View style={styles.personBody}>
            <AppText color="neutral" variant="titleSm">
              {detail.personName}
            </AppText>

            <AppText color="neutralMuted" variant="meta">
              {[detail.roleLabel, detail.contextLabel]
                .filter(Boolean)
                .join(" · ")}
            </AppText>
          </View>
        </View>

        {/* §33: «soltanto quando deriva da un cambiamento reale ancora
            pertinente». Lo decide il backend. */}
        {detail.changedByPerson ? (
          <AppText color="neutralMuted" style={styles.helper} variant="meta">
            {ROLE_LINK_COPY.personUpdatedRole(firstName(detail.personName))}
          </AppText>
        ) : null}

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
              testID="role-link-society-edit"
              variant="primary"
            />

            {/* §34: «Mostra prima del tap il ruolo/ambito che verrà
                ripristinato.» */}
            {detail.canRestore && detail.previousRoleLabel ? (
              <View style={styles.restore}>
                <AppText color="neutralMuted" variant="meta">
                  {`Ruolo precedente: ${[
                    detail.previousRoleLabel,
                    detail.previousContext,
                  ]
                    .filter(Boolean)
                    .join(" · ")}`}
                </AppText>

                <Button
                  label={ROLE_LINK_COPY.restorePrevious}
                  loading={restore.isPending}
                  onPress={() => restore.mutate()}
                  size="md"
                  testID="role-link-society-restore"
                  variant="link"
                />
              </View>
            ) : null}

            {/* §8: rimuovere è un permesso distinto dal modificare. */}
            {detail.canRemove ? (
              <Button
                destructive
                label={ROLE_LINK_COPY.removeRole}
                onPress={() => {
                  trackRoleLinkEvent("role_link_assignment_remove_confirm_opened", {
                    actor_type: "society",
                  });
                  setSheetOpen(true);
                }}
                size="md"
                testID="role-link-society-remove"
                variant="link"
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.backRow}>
          <Button
            label={ROLE_LINK_COPY.back}
            onPress={onBack}
            size="md"
            testID="role-link-society-back"
            variant="link"
          />
        </View>
      </ScrollView>

      <RoleConfirmSheet
        body={sheet.body}
        cancelLabel={ROLE_LINK_COPY.cancelLabel}
        confirmLabel={ROLE_LINK_COPY.removeRole}
        destructive
        isBusy={remove.isPending}
        note={sheet.note}
        onCancel={() => setSheetOpen(false)}
        onConfirm={() => remove.mutate()}
        testID="role-link-society-remove-sheet"
        title={ROLE_LINK_COPY.removeRoleSheetTitle}
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
  person: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  personBody: {
    flex: 1,
    gap: spacing[4],
  },
  helper: {
    paddingBottom: spacing[8],
    paddingTop: spacing[8],
  },
  actions: {
    gap: spacing[8],
    paddingTop: spacing[24],
  },
  restore: {
    gap: spacing[4],
    paddingTop: spacing[8],
  },
  backRow: {
    alignItems: "center",
    paddingTop: spacing[16],
  },
});
