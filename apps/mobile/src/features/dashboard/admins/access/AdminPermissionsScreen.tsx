/**
 * Vista di sola lettura dei permessi effettivi di un accesso amministrativo
 * (screen 14/"Visualizza permessi"). Nessun controllo editabile, nessuna CTA.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { NetworkNavBar } from "../../../network/components/NetworkNavBar";
import { STALE_MS } from "../../cache/freshness-policy";
import { DashboardGlobalError, DashboardSkeleton } from "../../components/DashboardStates";
import { SocietyIdentityHeader } from "../../components/SocietyIdentityHeader";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { AccessPersonHeader } from "./components/AccessPersonHeader";
import { fetchAdminAccessDetail } from "./access-service";
import { AREA_LEVEL_LABEL } from "../../roles/permission-catalog";
import { RolesAccessError } from "../../roles/roles-service";

import { ACCESS_QK } from "./access-keys";
import { fetchAdminEffectivePermissions } from "./access-service";
import { ACCESS_COPY } from "./access-presentation";

export function AdminPermissionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const params = useLocalSearchParams<{ profileId?: string }>();
  const profileId = params.profileId ?? "";

  const goBack = () => router.back();

  const permissionsQuery = useQuery({
    enabled: !!clubId && !!actorId && !!profileId,
    queryFn: () =>
      fetchAdminEffectivePermissions({ clubId: clubId as string, profileId }),
    queryKey: ACCESS_QK.permissions(actorId, clubId ?? "", profileId),
    retry: (count, error) => !(error instanceof RolesAccessError) && count < 1,
    staleTime: STALE_MS.management,
  });

  /* §4: «Ogni pagina conserva back, titolo funzionale e contesto AC Como.»
     Il dettaglio è già in cache — è la stessa chiave della schermata da cui
     si arriva — quindi la persona non costa una richiesta in più. */
  const detailQuery = useQuery({
    enabled: !!clubId && !!actorId && !!profileId,
    queryFn: () =>
      fetchAdminAccessDetail({ clubId: clubId as string, profileId }),
    queryKey: ACCESS_QK.detail(actorId, clubId ?? "", profileId),
    retry: (count, error) => !(error instanceof RolesAccessError) && count < 1,
    staleTime: STALE_MS.management,
  });

  const data = permissionsQuery.data ?? null;
  const person = detailQuery.data ?? null;

  if (!data && permissionsQuery.isLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <NetworkNavBar onBack={goBack} title={ACCESS_COPY.permissionsTitle} />
        <DashboardSkeleton />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <NetworkNavBar onBack={goBack} title={ACCESS_COPY.permissionsTitle} />
        <DashboardGlobalError onRetry={() => permissionsQuery.refetch()} />
      </View>
    );
  }

  const societyAreasInTeamsScope = data.areas.filter(
    (area) => area.scopeKind === "society" && area.level !== "none",
  );
  const showSocietyNotice = data.scopeMode === "teams" && societyAreasInTeamsScope.length > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NetworkNavBar onBack={goBack} title={ACCESS_COPY.permissionsTitle} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing[24] }]}
      >
        <SocietyIdentityHeader
          isVerified={current?.kind === "society" ? current.isVerified : false}
          logoUrl={current?.kind === "society" ? (current.avatarUrl ?? null) : null}
          name={current?.kind === "society" ? current.name : ""}
        />

        {person ? (
          <AccessPersonHeader
            avatarUrl={person.avatarUrl}
            name={person.fullName}
            status={person.roleLabel}
          />
        ) : null}

        <AppText color="neutralMuted" variant="bodySm">
          {`${ACCESS_COPY.scopeRow}: ${
            data.isOwner
              ? ACCESS_COPY.ownerStatus
              : (data.scopeLabel ?? "Non impostato")
          }`}
        </AppText>

        {data.isOwner ? (
          <AppText color="neutralMuted" variant="meta">
            L'accesso deriva dalla proprietà della società, non da un ruolo assegnato.
          </AppText>
        ) : null}

        <View style={styles.areaGroup}>
          {data.areas.map((area) => (
            <View key={area.areaId} style={styles.areaRow}>
              <View style={styles.areaHeader}>
                <AppText color="neutral" variant="bodyLg">
                  {area.areaLabel}
                </AppText>
                <AppText color="neutralMuted" variant="bodySm">
                  {AREA_LEVEL_LABEL[area.level]}
                </AppText>
              </View>
              {area.level === "custom" && area.controlLabels.length > 0 ? (
                <View style={styles.controlList}>
                  {area.controlLabels.map((label) => (
                    <AppText color="neutralMuted" key={label} variant="meta">
                      {label}
                    </AppText>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>

        {showSocietyNotice ? (
          <View style={styles.noticeBox}>
            <Ionicons
              color={colors.textNeutralSoft}
              name="information-circle-outline"
              size={18}
            />
            <View style={styles.noticeContent}>
              <AppText color="neutralMuted" variant="meta">
                {ACCESS_COPY.societyFunctionsNotice}
              </AppText>
              {societyAreasInTeamsScope.map((area) => (
                <AppText color="neutralMuted" key={area.areaId} variant="meta">
                  {area.areaLabel}
                </AppText>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  areaGroup: {
    gap: spacing[12],
  },
  areaHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  areaRow: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[4],
    paddingTop: spacing[12],
  },
  content: {
    gap: spacing[16],
    padding: spacing[16],
  },
  controlList: {
    gap: spacing[4],
    paddingLeft: spacing[12],
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
  noticeContent: {
    flex: 1,
    gap: spacing[4],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
