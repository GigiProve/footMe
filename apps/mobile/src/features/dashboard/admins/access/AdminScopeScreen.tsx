/**
 * Modifica dell'ambito di un accesso amministrativo (screen 07), con il
 * selettore squadre (screen 08) agganciato come sotto-sheet.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button, ConfirmModal, Radio } from "../../../../ui";
import { useToast } from "../../../../ui/Toast/ToastProvider";
import { useSession } from "../../../auth/use-session";
import { NetworkNavBar } from "../../../network/components/NetworkNavBar";
import { STALE_MS } from "../../cache/freshness-policy";
import { DashboardGlobalError, DashboardSkeleton } from "../../components/DashboardStates";
import { SocietyIdentityHeader } from "../../components/SocietyIdentityHeader";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { ROLES_COPY, describeRolesError } from "../../roles/roles-presentation";
import { RolesAccessError, toRolesError } from "../../roles/roles-service";
import { trackRolesEvent } from "../../roles/roles-analytics";
import { useOperationKey } from "../../roles/use-operation-key";

import { AccessPersonHeader } from "./components/AccessPersonHeader";
import { TeamPickerSheet } from "./components/TeamPickerSheet";
import { ACCESS_QK, ACCESS_QK_PREFIXES } from "./access-keys";
import { fetchAdminAccessDetail, updateAdminScope } from "./access-service";
import {
  ACCESS_COPY,
  scopeChangeNotice,
  scopeSummary,
} from "./access-presentation";
import type { AdminScopeMode } from "./access-types";

export function AdminScopeScreen() {
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

  const [draftMode, setDraftMode] = useState<AdminScopeMode>("society");
  const [draftTeamIds, setDraftTeamIds] = useState<string[]>([]);
  const [draftTeamNames, setDraftTeamNames] = useState<string[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const detailQuery = useQuery({
    enabled: !!clubId && !!actorId && !!profileId,
    queryFn: () => fetchAdminAccessDetail({ clubId: clubId as string, profileId }),
    queryKey: ACCESS_QK.detail(actorId, clubId ?? "", profileId),
    retry: (count, error) => !(error instanceof RolesAccessError) && count < 1,
    staleTime: STALE_MS.management,
  });

  const detail = detailQuery.data ?? null;

  /* §27: la chiave segue il contenuto. Correggere la selezione dopo un
     fallimento è un'operazione diversa, non un retry della precedente. */
  const operationKey = useOperationKey(
    `${draftMode}|${[...draftTeamIds].sort().join(",")}`,
  );

  useEffect(() => {
    trackRolesEvent("admin_scope_opened", {});
  }, []);

  /* Semina in fase di render: un effetto avrebbe mostrato un frame con le
     radio tutte spente prima di riflettere l'ambito reale. `seeded` resta
     la garanzia che un refetch non sovrascriva il draft dell'utente. */
  if (detail && !seeded) {
    setDraftMode(detail.scopeMode);
    setDraftTeamIds(detail.teamIds);
    setDraftTeamNames(detail.teamNames);
    setSeeded(true);
  }

  const hasDraft =
    !!detail &&
    (draftMode !== detail.scopeMode ||
      JSON.stringify([...draftTeamIds].sort()) !==
        JSON.stringify([...detail.teamIds].sort()));

  const submit = useMutation({
    mutationFn: () =>
      updateAdminScope({
        clubId: clubId as string,
        expectedVersion: detail?.version ?? 0,
        idempotencyKey: operationKey(),
        profileId,
        scopeMode: draftMode,
        teamIds: draftTeamIds,
      }),
    onError: (error) => {
      setActionError(describeRolesError(toRolesError(error).code));
      trackRolesEvent("admin_scope_result", {
        outcome: "error",
        scope_type: draftMode,
      });
    },
    onSuccess: async () => {
      showToast({ message: ACCESS_COPY.scopeUpdatedToast, tone: "success" });
      for (const prefix of [
        ...ACCESS_QK_PREFIXES,
        "society-admins",
        "society-admin-center",
      ]) {
        await queryClient.invalidateQueries({ queryKey: [prefix] });
      }
      trackRolesEvent("admin_scope_result", {
        outcome: "success",
        scope_type: draftMode,
      });
      router.back();
    },
  });

  /* Definito **dopo** `submit`: catturarlo prima avrebbe memoizzato una
     mutation stantia, e `isPending` sarebbe rimasto falso durante il
     comando. */
  const goBack = useCallback(() => {
    if (pickerVisible) {
      setPickerVisible(false);

      return;
    }

    if (hasDraft && !submit.isPending) {
      setConfirmExit(true);

      return;
    }

    router.back();
  }, [hasDraft, pickerVisible, router, submit.isPending]);

  const handleSave = () => {
    setActionError(null);
    trackRolesEvent("admin_scope_submitted", {});
    submit.mutate();
  };

  const handlePickerConfirm = (teamIds: string[], teamNames: string[]) => {
    setDraftTeamIds(teamIds);
    setDraftTeamNames(teamNames);
    setPickerVisible(false);
    trackRolesEvent("admin_scope_teams_confirmed", { count: teamIds.length });
  };

  if (!detail && detailQuery.isLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <NetworkNavBar onBack={goBack} title={ACCESS_COPY.scopeTitle} />
        <DashboardSkeleton />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <NetworkNavBar onBack={goBack} title={ACCESS_COPY.scopeTitle} />
        <DashboardGlobalError onRetry={() => detailQuery.refetch()} />
      </View>
    );
  }

  const notice = scopeChangeNotice({
    nextMode: draftMode,
    nextNames: draftTeamNames,
    previousMode: detail.scopeMode,
    previousNames: detail.teamNames,
  });

  const canSave =
    hasDraft && (draftMode === "society" || draftTeamIds.length > 0) && !submit.isPending;

  const summary = scopeSummary(draftTeamNames);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NetworkNavBar onBack={goBack} title={ACCESS_COPY.scopeTitle} />
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

        <AccessPersonHeader avatarUrl={detail.avatarUrl} name={detail.fullName} status={null} />

        <View style={styles.optionGroup}>
          <Radio
            checked={draftMode === "society"}
            label={ACCESS_COPY.scopeSocietyLabel}
            onPress={() => setDraftMode("society")}
            tone="neutral"
          />
          <AppText color="neutralMuted" style={styles.helperIndent} variant="meta">
            {ACCESS_COPY.scopeSocietyHelper}
          </AppText>

          <Radio
            checked={draftMode === "teams"}
            label={ACCESS_COPY.scopeTeamsLabel}
            onPress={() => setDraftMode("teams")}
            tone="neutral"
          />
          <AppText color="neutralMuted" style={styles.helperIndent} variant="meta">
            {ACCESS_COPY.scopeTeamsHelper}
          </AppText>
        </View>

        {draftMode === "teams" ? (
          <View style={styles.teamsCard}>
            <AppText color="neutral" variant="bodySm">
              {summary ?? ACCESS_COPY.scopeTeamsLabel}
            </AppText>
            <Button
              label={
                draftTeamIds.length > 0
                  ? ACCESS_COPY.scopeEditSelection
                  : ACCESS_COPY.scopeTeamsLabel
              }
              onPress={() => setPickerVisible(true)}
              variant="link"
            />
            {draftTeamIds.length === 0 ? (
              <AppText accessibilityRole="alert" color="danger" variant="meta">
                {ACCESS_COPY.scopeEmptyTeams}
              </AppText>
            ) : null}
          </View>
        ) : null}

        <AppText color="neutralMuted" variant="meta">
          {ACCESS_COPY.scopeUnchangedHelper}
        </AppText>

        {notice ? (
          <View style={styles.noticeBox}>
            <Ionicons
              color={colors.textNeutralSoft}
              name="information-circle-outline"
              size={18}
            />
            <AppText color="neutralMuted" style={styles.noticeText} variant="meta">
              {notice}
            </AppText>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[16] }]}>
        <Button
          disabled={!canSave}
          fullWidth
          label={ACCESS_COPY.scopeSaveCta}
          loading={submit.isPending}
          onPress={handleSave}
          size="lg"
          variant="primary"
        />
      </View>

      <TeamPickerSheet
        clubId={clubId ?? ""}
        key={`teams-${pickerVisible ? "open" : "closed"}`}
        onClose={() => setPickerVisible(false)}
        onConfirm={handlePickerConfirm}
        selectedTeamIds={draftTeamIds}
        visible={pickerVisible}
      />

      <ConfirmModal
        cancelLabel={ROLES_COPY.exitKeep}
        confirmLabel={ROLES_COPY.exitLeave}
        message={ROLES_COPY.exitBody}
        onCancel={() => setConfirmExit(false)}
        onConfirm={() => {
          setConfirmExit(false);
          router.back();
        }}
        title={ROLES_COPY.exitTitle}
        visible={confirmExit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[16],
    padding: spacing[16],
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius[12],
    padding: spacing[12],
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing[16],
  },
  helperIndent: {
    paddingLeft: spacing[32],
  },
  noticeBox: {
    backgroundColor: colors.surfaceNeutral,
    borderColor: colors.borderNeutral,
    borderRadius: radius[12],
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[8],
    padding: spacing[12],
  },
  noticeText: {
    flex: 1,
  },
  optionGroup: {
    gap: spacing[8],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  teamsCard: {
    borderColor: colors.borderNeutral,
    borderRadius: radius[12],
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[8],
    padding: spacing[12],
  },
});
