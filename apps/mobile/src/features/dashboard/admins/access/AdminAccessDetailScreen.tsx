/**
 * Dettaglio di un accesso amministrativo (screen 06), con il ramo Owner e il
 * flusso di revoca (screen 09) incorporati come lo specifica §14–§23.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, sizes, spacing } from "../../../../theme/tokens";
import { AppText, BottomSheet, Button, ConfirmModal, Radio } from "../../../../ui";
import { useToast } from "../../../../ui/Toast/ToastProvider";
import { useSession } from "../../../auth/use-session";
import { NetworkNavBar } from "../../../network/components/NetworkNavBar";
import { fetchAssignableRoles } from "../admins-service";
import { ADMINS_QK } from "../admins-keys";
import { useOperationKey } from "../../roles/use-operation-key";
import { STALE_MS } from "../../cache/freshness-policy";
import { DashboardGlobalError, DashboardSkeleton } from "../../components/DashboardStates";
import { SocietyIdentityHeader } from "../../components/SocietyIdentityHeader";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { describeRolesError } from "../../roles/roles-presentation";
import { RolesAccessError, toRolesError } from "../../roles/roles-service";
import { trackRolesEvent } from "../../roles/roles-analytics";

import { AccessFieldRow } from "./components/AccessFieldRow";
import { AccessPersonHeader } from "./components/AccessPersonHeader";
import { OwnerCandidateSheet } from "./components/OwnerCandidateSheet";
import { ACCESS_QK, ACCESS_QK_PREFIXES } from "./access-keys";
import { ACCESS_HREFS } from "./access-routes";
import {
  assignAdminRole,
  fetchAdminAccessDetail,
  revokeAdminAccess,
} from "./access-service";
import { ACCESS_COPY, revokeQuestion, withSociety } from "./access-presentation";
import type { OwnerCandidate } from "./access-types";

export function AdminAccessDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const clubName = current?.kind === "society" ? current.name : "";
  const params = useLocalSearchParams<{ profileId?: string }>();
  const profileId = params.profileId ?? "";

  const [actionError, setActionError] = useState<string | null>(null);
  const [roleSheetVisible, setRoleSheetVisible] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [ownerSheetVisible, setOwnerSheetVisible] = useState(false);
  const [revokeVisible, setRevokeVisible] = useState(false);
  /* §27: cambiare il ruolo scelto dopo un errore è un'operazione diversa.
     La revoca non ha payload, quindi la sua chiave resta stabile. */
  const roleOperationKey = useOperationKey(
    `${profileId}|role|${selectedRoleId ?? ""}`,
  );
  const revokeOperationKey = useOperationKey(`${profileId}|revoke`);

  const detailQuery = useQuery({
    enabled: !!clubId && !!actorId && !!profileId,
    queryFn: () => fetchAdminAccessDetail({ clubId: clubId as string, profileId }),
    queryKey: ACCESS_QK.detail(actorId, clubId ?? "", profileId),
    retry: (count, error) => !(error instanceof RolesAccessError) && count < 1,
    staleTime: STALE_MS.management,
  });

  const detail = detailQuery.data ?? null;

  const rolesQuery = useQuery({
    enabled: roleSheetVisible && !!clubId && !!actorId,
    queryFn: () => fetchAssignableRoles(clubId as string),
    queryKey: ADMINS_QK.roles(actorId, clubId ?? ""),
    staleTime: STALE_MS.management,
  });

  const invalidateAfterChange = async () => {
    for (const prefix of [
      ...ACCESS_QK_PREFIXES,
      "society-admin-center",
      "society-admins",
      "society-roles",
    ]) {
      await queryClient.invalidateQueries({ queryKey: [prefix] });
    }
  };

  const assignRole = useMutation({
    mutationFn: (roleId: string) =>
      assignAdminRole({
        clubId: clubId as string,
        expectedVersion: detail?.version ?? 0,
        idempotencyKey: roleOperationKey(),
        profileId,
        roleId,
      }),
    onError: (error) => setActionError(describeRolesError(toRolesError(error).code)),
    onSuccess: async () => {
      showToast({ message: ACCESS_COPY.roleAssignedToast, tone: "success" });
      await invalidateAfterChange();
      await detailQuery.refetch();
      setRoleSheetVisible(false);
    },
  });

  const revoke = useMutation({
    mutationFn: () =>
      revokeAdminAccess({
        clubId: clubId as string,
        expectedVersion: detail?.version ?? 0,
        idempotencyKey: revokeOperationKey(),
        profileId,
      }),
    onError: (error) => {
      setActionError(describeRolesError(toRolesError(error).code));
      trackRolesEvent("admin_revoke_result", { outcome: "error" });
    },
    onSuccess: async () => {
      showToast({ message: ACCESS_COPY.revokedToast, tone: "success" });
      await invalidateAfterChange();
      trackRolesEvent("admin_revoke_result", { outcome: "success" });
      setRevokeVisible(false);
      router.back();
    },
  });

  useEffect(() => {
    if (detail) {
      trackRolesEvent("admin_access_opened", { is_owner: detail.isOwner });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!detail]);

  const goBack = () => router.back();

  const openRoleSheet = () => {
    setSelectedRoleId(detail?.roleId ?? null);
    setRoleSheetVisible(true);
  };

  const openRevoke = () => {
    trackRolesEvent("admin_revoke_opened", {});
    setRevokeVisible(true);
  };

  const confirmRevoke = () => {
    trackRolesEvent("admin_revoke_submitted", {});
    revoke.mutate();
  };

  const confirmTransferCandidate = (candidate: OwnerCandidate) => {
    setOwnerSheetVisible(false);
    router.push(ACCESS_HREFS.transfer(candidate.profileId) as never);
  };

  if (!detail && detailQuery.isLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <NetworkNavBar onBack={goBack} title={ACCESS_COPY.detailTitle} />
        <DashboardSkeleton />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <NetworkNavBar onBack={goBack} title={ACCESS_COPY.detailTitle} />
        <DashboardGlobalError onRetry={() => detailQuery.refetch()} />
      </View>
    );
  }

  const title = detail.isOwner ? ACCESS_COPY.ownerTitle : ACCESS_COPY.detailTitle;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NetworkNavBar onBack={goBack} title={title} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing[24] }]}
      >
        {actionError ? (
          <View style={styles.errorBanner}>
            <AppText color="danger" variant="bodySm">
              {actionError}
            </AppText>
          </View>
        ) : null}

        <SocietyIdentityHeader
          isVerified={current?.kind === "society" ? current.isVerified : false}
          logoUrl={current?.kind === "society" ? (current.avatarUrl ?? null) : null}
          name={clubName}
        />

        {detail.isOwner ? (
          <View style={styles.block}>
            <AccessPersonHeader
              avatarUrl={detail.avatarUrl}
              name={detail.fullName}
              status={ACCESS_COPY.ownerStatus}
            />
            <AppText color="neutralMuted" variant="meta">
              {withSociety(ACCESS_COPY.ownerDescription, clubName)}
            </AppText>
            {detail.roleIsNamed ? (
              <View style={styles.fieldGroup}>
                <AccessFieldRow label={ACCESS_COPY.roleRow} value={detail.roleLabel} />
                <AccessFieldRow label={ACCESS_COPY.scopeRow} value={detail.scopeLabel} />
              </View>
            ) : null}
            {detail.canTransferOwner ? (
              <Button
                fullWidth
                label={ACCESS_COPY.transferOpenCta}
                onPress={() => {
                trackRolesEvent("owner_transfer_opened");
                setOwnerSheetVisible(true);
              }}
                size="lg"
                variant="primary"
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.block}>
            <AccessPersonHeader
              avatarUrl={detail.avatarUrl}
              name={detail.fullName}
              status={ACCESS_COPY.activeStatus}
            />
            <View style={styles.fieldGroup}>
              <AccessFieldRow
                label={ACCESS_COPY.roleRow}
                onPress={detail.canChangeRole ? openRoleSheet : undefined}
                value={detail.roleLabel}
              />
              <AccessFieldRow
                label={ACCESS_COPY.scopeRow}
                onPress={
                  detail.canChangeScope
                    ? () => router.push(ACCESS_HREFS.scope(profileId) as never)
                    : undefined
                }
                value={detail.scopeLabel}
              />
              {/* Riga di sola navigazione: §14 la vuole accanto a Ruolo e
                  Ambito, ma non è un campo con un valore. */}
              {detail.canViewPermissions ? (
                <AccessFieldRow
                  label={ACCESS_COPY.viewPermissions}
                  onPress={() => router.push(ACCESS_HREFS.permissions(profileId) as never)}
                />
              ) : null}
            </View>

            {detail.canRevoke ? (
              <View style={styles.revokeGroup}>
                <Pressable
                  accessibilityLabel={ACCESS_COPY.revokeCta}
                  accessibilityRole="button"
                  onPress={openRevoke}
                  style={styles.revokeRow}
                >
                  <Ionicons color={colors.danger} name="trash-outline" size={20} />
                  <AppText color="danger" variant="bodyLg">
                    {ACCESS_COPY.revokeCta}
                  </AppText>
                </Pressable>
                <AppText color="neutralMuted" variant="meta">
                  {withSociety(ACCESS_COPY.revokeScopeHelper, clubName)}
                </AppText>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <BottomSheet
        onClose={() => setRoleSheetVisible(false)}
        title={ACCESS_COPY.roleRow}
        visible={roleSheetVisible}
      >
        {rolesQuery.isLoading ? (
          <DashboardSkeleton />
        ) : (rolesQuery.data ?? []).length === 0 ? (
          <AppText color="neutralMuted" variant="bodySm">
            {ACCESS_COPY.noAssignableRoles}
          </AppText>
        ) : (
          <View style={styles.roleSheetContent}>
            {(rolesQuery.data ?? []).map((role) => (
              <Radio
                checked={selectedRoleId === role.roleId}
                key={role.roleId}
                label={role.name}
                onPress={() => setSelectedRoleId(role.roleId)}
                tone="neutral"
              />
            ))}
            <View style={styles.roleSheetSummary}>
              <AppText color="neutralMuted" variant="meta">
                {`${detail.roleLabel} → ${
                  (rolesQuery.data ?? []).find((r) => r.roleId === selectedRoleId)?.name ??
                  detail.roleLabel
                }`}
              </AppText>
              <AppText color="neutralMuted" variant="meta">
                L'ambito rimane invariato.
              </AppText>
            </View>
            <Button
              disabled={!selectedRoleId || selectedRoleId === detail.roleId || assignRole.isPending}
              fullWidth
              label={ACCESS_COPY.saveRoleCta}
              loading={assignRole.isPending}
              onPress={() => selectedRoleId && assignRole.mutate(selectedRoleId)}
              size="lg"
              variant="primary"
            />
          </View>
        )}
      </BottomSheet>

      <OwnerCandidateSheet
        clubId={clubId ?? ""}
        key={`owner-${ownerSheetVisible ? "open" : "closed"}`}
        onClose={() => setOwnerSheetVisible(false)}
        onContinue={confirmTransferCandidate}
        visible={ownerSheetVisible}
      />

      <ConfirmModal
        cancelLabel={ACCESS_COPY.revokeKeep}
        confirmLabel={ACCESS_COPY.revokeCta}
        destructive
        isBusy={revoke.isPending}
        onCancel={() => setRevokeVisible(false)}
        onConfirm={confirmRevoke}
        title={detail.isSelf ? "Lasciare la società?" : revokeQuestion(detail.fullName)}
        visible={revokeVisible}
      >
        <View style={styles.revokeModalBody}>
          <Ionicons color={colors.danger} name="trash-outline" size={28} />
          <AppText color="neutral" variant="bodySm">
            {detail.isSelf
              ? ACCESS_COPY.revokeSelfBody
              : withSociety(ACCESS_COPY.revokeBodyOne, clubName)}
          </AppText>
          {!detail.isSelf ? (
            <AppText color="neutral" variant="bodySm">
              {ACCESS_COPY.revokeBodyTwo}
            </AppText>
          ) : null}
        </View>
      </ConfirmModal>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[16],
  },
  content: {
    gap: spacing[16],
    padding: spacing[16],
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius[12],
    padding: spacing[12],
  },
  fieldGroup: {
    gap: 0,
  },
  revokeGroup: {
    gap: spacing[8],
  },
  revokeModalBody: {
    gap: spacing[8],
  },
  revokeRow: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderRadius: radius[12],
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[16],
  },
  roleSheetContent: {
    gap: spacing[12],
  },
  roleSheetSummary: {
    gap: spacing[4],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
