/**
 * Dettaglio amministrativo di un gruppo (DAS-REV-32 §11; screen 03 e 04).
 *
 * Mostra avatar, nome, «Gruppo operativo · Società» e le righe Squadra,
 * Persone, Amministratori, Stato — tutti metadata amministrativi, anche per
 * un viewer che è membro della chat (nessuna preview dell'ultimo messaggio).
 *
 * «Apri conversazione» esiste solo se il viewer è partecipante adesso, ed è
 * rivalidata al tap (§11, QA-028). Il manager non membro vede la stessa
 * pagina senza «Apri conversazione»: nessun avviso, nessuna promessa di
 * accesso (QA-022).
 *
 * DAS-REV-33 §9: «Gestisci gruppo» compare solo con `can_manage` dal server
 * (nascosto, mai disabilitato, §5) e apre la gestione completa, la stessa Info
 * gruppo che si raggiunge da Messaggi. Questa pagina resta l'anteprima
 * amministrativa. Una sola primaria: «Apri conversazione» se c'è, altrimenti
 * «Gestisci gruppo»; con entrambe, la seconda è secondaria.
 */
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { useToast } from "../../../ui/Toast/ToastProvider";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../cache/freshness-policy";
import { DashboardGlobalEmpty, DashboardGlobalError, DashboardSkeleton } from "../components/DashboardStates";
import { useDashboardIdentity } from "../identity/use-dashboard-identity";
import { PositionsCenterHeader } from "../positions/components/PositionsCenterHeader";
import { GroupAvatar } from "./components/GroupAvatar";
import { trackGroupDetailOpened, trackGroupOpenConversation } from "./groups-analytics";
import { GROUP_MANAGE_COPY, GROUPS_COPY } from "./groups-copy";
import { GROUPS_QK } from "./groups-keys";
import { GROUP_MANAGE_HREFS, GROUPS_HREFS } from "./groups-routes";
import { GroupsError, fetchSocietyGroupDetail } from "./groups-service";

const isAuthorizationError = (error: unknown) => error instanceof GroupsError && error.isAuthorization;

function DetailRow({ label, value, showDivider }: { label: string; value: string; showDivider: boolean }) {
  return (
    <View accessible style={[styles.detailRow, showDivider ? styles.rowDivider : null]}>
      <AppText color="neutralMuted" style={styles.detailLabel} variant="bodySm">
        {label}
      </AppText>
      <AppText color="neutral" style={styles.detailValue} variant="bodySm">
        {value}
      </AppText>
    </View>
  );
}

export function GroupDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const conversationId = typeof params.conversationId === "string" ? params.conversationId : "";
  const [opening, setOpening] = useState(false);

  const detailQuery = useQuery({
    enabled: !!clubId && !!actorId && !!conversationId,
    queryFn: () => fetchSocietyGroupDetail(clubId as string, conversationId),
    queryKey: GROUPS_QK.detail(actorId, clubId ?? "", conversationId),
    retry: (count, error) => !isAuthorizationError(error) && count < 1,
    staleTime: STALE_MS.operational,
  });

  const detail = detailQuery.data ?? null;
  const loadedCanOpen = detail ? detail.canOpenConversation : null;

  useEffect(() => {
    if (loadedCanOpen !== null) trackGroupDetailOpened(loadedCanOpen);
  }, [loadedCanOpen]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(GROUPS_HREFS.center() as never);
  };

  /** §11: rivalida al tap; l'ID ottenuto dalla Dashboard non è un token di lettura. */
  const openConversation = async () => {
    if (!clubId || opening) return;
    setOpening(true);

    try {
      const fresh = await fetchSocietyGroupDetail(clubId, conversationId);
      queryClient.setQueryData(GROUPS_QK.detail(actorId, clubId, conversationId), fresh);

      if (fresh.canOpenConversation) {
        trackGroupOpenConversation();
        router.push(GROUPS_HREFS.conversation(fresh.conversationId, fresh.name) as never);
      } else {
        showToast({ id: "group-open-revoked", message: GROUPS_COPY.conversationNoLongerAvailable, tone: "neutral" });
      }
    } catch (error) {
      if (isAuthorizationError(error)) {
        void detailQuery.refetch();
      } else {
        showToast({ id: "group-open-failed", message: GROUPS_COPY.loadError, tone: "neutral" });
      }
    } finally {
      setOpening(false);
    }
  };

  const shell = (content: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <PositionsCenterHeader
          isVerified={current?.isVerified ?? false}
          logoUrl={current?.avatarUrl ?? null}
          name={current?.name ?? ""}
          onBack={goBack}
        />
      </View>
      {content}
    </View>
  );

  /* Non trovato e non autorizzato sono la stessa risposta (QA-029). */
  if (!clubId || isAuthorizationError(detailQuery.error)) {
    return shell(
      <View style={styles.state}>
        <DashboardGlobalEmpty
          copy={{
            actionLabel: GROUPS_COPY.backToDashboard,
            body: GROUPS_COPY.detailNotFoundBody,
            icon: "people-outline",
            title: GROUPS_COPY.detailNotFound,
          }}
          onAction={() => router.replace(GROUPS_HREFS.center() as never)}
        />
      </View>,
    );
  }

  if (!detail && detailQuery.isLoading) {
    return shell(
      <View style={styles.state}>
        <DashboardSkeleton />
      </View>,
    );
  }

  if (!detail) {
    return shell(
      <View style={styles.state}>
        <DashboardGlobalError
          body={GROUPS_COPY.loadError}
          onRetry={() => void detailQuery.refetch()}
          title={GROUPS_COPY.loadError}
        />
      </View>,
    );
  }

  const rows = [
    { label: GROUPS_COPY.detailTeam, value: detail.teamId ? detail.teamName ?? GROUPS_COPY.societyContext : GROUPS_COPY.societyContext },
    { label: GROUPS_COPY.detailPeople, value: String(detail.peopleCount) },
    { label: GROUPS_COPY.detailAdmins, value: String(detail.adminCount) },
    { label: GROUPS_COPY.detailStatus, value: detail.status === "active" ? GROUPS_COPY.statusActive : GROUPS_COPY.statusArchived },
  ];

  return shell(
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing[32] + insets.bottom }]}>
      <View style={styles.hero}>
        <GroupAvatar name={detail.name} path={detail.avatarPath} size="lg" />
        <View style={styles.heroText}>
          <AppText accessibilityRole="header" color="neutral" variant="headingSm">
            {detail.name}
          </AppText>
          <AppText color="neutralMuted" variant="bodySm">
            {GROUPS_COPY.detailContext(detail.clubName)}
          </AppText>
        </View>
      </View>

      <View style={styles.rows}>
        {rows.map((row, index) => (
          <DetailRow key={row.label} label={row.label} showDivider={index > 0} value={row.value} />
        ))}
      </View>

      {detail.canOpenConversation ? (
        <Button
          fullWidth
          label={GROUPS_COPY.openConversation}
          loading={opening}
          onPress={() => void openConversation()}
          size="md"
          style={styles.cta}
          testID="group-open-conversation"
          variant="primary"
        />
      ) : null}

      {detail.canManage ? (
        <Button
          fullWidth
          label={GROUP_MANAGE_COPY.manageGroup}
          onPress={() => router.push(GROUP_MANAGE_HREFS.info(detail.conversationId, "dashboard") as never)}
          size="md"
          style={detail.canOpenConversation ? styles.secondaryCta : styles.cta}
          testID="group-manage"
          variant={detail.canOpenConversation ? "neutralOutline" : "primary"}
        />
      ) : null}
    </ScrollView>,
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing[20],
  },
  cta: {
    marginTop: spacing[24],
  },
  detailLabel: {
    flex: 1,
  },
  detailRow: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 44,
    paddingVertical: spacing[10],
  },
  detailValue: {
    flex: 1.4,
  },
  hero: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[16],
    paddingBottom: spacing[20],
    paddingTop: spacing[8],
  },
  heroText: {
    flex: 1,
    gap: spacing[4],
  },
  navWrap: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  rowDivider: {
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rows: {
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondaryCta: {
    marginTop: spacing[12],
  },
  state: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
  },
});
