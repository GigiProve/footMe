/**
 * Centro Amministratori (DAS-REV-13, screen 01).
 *
 * «Mantieni l'ordine del master: app bar, Society, riga Ruoli e permessi,
 * Amministratori attivi, Inviti in attesa, CTA Invita amministratore» (§7).
 *
 * Due liste, due query, due stati: §25 chiede che «se falliscono solo i
 * pending, gli attivi restano utilizzabili» e che il retry sia locale. Una
 * query sola li renderebbe un unico errore.
 *
 * La bottom navigation resta visibile con Dashboard selezionata: la route
 * vive nello Stack annidato della tab Dashboard (§6).
 */
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { Button } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { NetworkNavBar } from "../../network/components/NetworkNavBar";
import { STALE_MS } from "../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardGlobalOffline,
  DashboardModuleEmpty,
  DashboardOfflineNotice,
  DashboardSkeleton,
} from "../components/DashboardStates";
import {
  DashboardModuleError,
} from "../components/DashboardSection";
import { SocietyIdentityHeader } from "../components/SocietyIdentityHeader";
import { useDashboardIdentity } from "../identity/use-dashboard-identity";
import { useAccessWindow } from "../state/use-access-window";
import { useDashboardConnection } from "../state/use-dashboard-connection";
import { StructureRow } from "../structure/components/StructureRow";
import { AdminPersonRow } from "./components/AdminPersonRow";
import { AdminSection } from "./components/AdminSection";
import { ADMINS_QK } from "./admins-keys";
import { trackAdminEvent } from "./admins-analytics";
import {
  ADMIN_COPY,
  inviteChannelLabel,
  inviteRecipientName,
  sectionAccessibilityLabel,
  sectionCount,
} from "./admins-presentation";
import {
  AdminAccessError,
  fetchAdminCenter,
  fetchAdminInvites,
  fetchAdmins,
} from "./admins-service";
import { ADMIN_HREFS } from "./admins-routes";

const PAGE_SIZE = 20;

export function AdminCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const { connection, reportFailure, reportSuccess } = useDashboardConnection();
  const params = useLocalSearchParams<{ from?: string }>();
  const origin = typeof params.from === "string" ? params.from : null;

  /**
   * §7.2: «Caricare altri attivi non deve rendere irraggiungibile la sezione
   * pending: usa il pattern Mostra altri del prodotto prima della sezione
   * successiva, senza scaricare tutti gli amministratori in anticipo.»
   */
  const [adminsLimit, setAdminsLimit] = useState(PAGE_SIZE);
  const [invitesLimit, setInvitesLimit] = useState(PAGE_SIZE);

  const centerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchAdminCenter(clubId as string),
    queryKey: ADMINS_QK.center(actorId, clubId ?? ""),
    // Un rifiuto autorizzativo non è un errore di rete da ritentare (§27).
    retry: (failureCount, error) =>
      !(error instanceof AdminAccessError) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const loaded = centerQuery.data ?? null;

  const accessWindow = useAccessWindow({
    accessVerifiedAt: loaded?.accessVerifiedAt ?? null,
    isOrganizational: true,
  });

  const center = accessWindow.isValid ? loaded : null;

  useEffect(() => {
    if (!accessWindow.isValid && loaded && !centerQuery.isFetching) {
      void centerQuery.refetch();
    }
    // Solo la transizione di validità rivalida: le altre dipendenze cambiano
    // a ogni fetch e produrrebbero un ciclo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessWindow.isValid]);

  const canViewAdmins = center?.canViewAdmins ?? false;
  const canViewInvites = center?.canViewInvites ?? false;

  const adminsQuery = useQuery({
    enabled: !!clubId && !!actorId && canViewAdmins,
    queryFn: () =>
      fetchAdmins({ clubId: clubId as string, limit: adminsLimit }),
    queryKey: [...ADMINS_QK.admins(actorId, clubId ?? ""), adminsLimit],
    staleTime: STALE_MS.management,
  });

  const invitesQuery = useQuery({
    enabled: !!clubId && !!actorId && canViewInvites,
    queryFn: () =>
      fetchAdminInvites({ clubId: clubId as string, limit: invitesLimit }),
    queryKey: [...ADMINS_QK.invites(actorId, clubId ?? ""), invitesLimit],
    staleTime: STALE_MS.operational,
  });

  useEffect(() => {
    if (centerQuery.isSuccess) {
      reportSuccess();
    }
  }, [centerQuery.isSuccess, reportSuccess]);

  useEffect(() => {
    if (centerQuery.error) {
      reportFailure(centerQuery.error);
    }
  }, [centerQuery.error, reportFailure]);

  useFocusEffect(
    useCallback(() => {
      trackAdminEvent("admin_center_opened", { source: origin ?? "unknown" });
    }, [origin]),
  );

  /**
   * §26: «Pull-to-refresh rilegge accesso, scope, liste, count, disponibilità
   * delle azioni e revisioni.» Non solo la lista visibile.
   */
  const refresh = useCallback(async () => {
    await Promise.all([
      centerQuery.refetch(),
      canViewAdmins ? adminsQuery.refetch() : Promise.resolve(null),
      canViewInvites ? invitesQuery.refetch() : Promise.resolve(null),
    ]);
  }, [adminsQuery, canViewAdmins, canViewInvites, centerQuery, invitesQuery]);

  const goBack = useCallback(() => {
    // §24: il centro torna all'origine da cui è stato aperto. Senza stack —
    // un deep link diretto — si rientra nella Dashboard, non in un finto
    // stack amministrativo.
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace(
      (origin === "structure"
        ? "/(tabs)/dashboard/structure"
        : "/(tabs)/dashboard") as never,
    );
  }, [origin, router]);

  const navBar = (
    <NetworkNavBar onBack={goBack} title={ADMIN_COPY.centerTitle} />
  );

  const shell = (body: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>{navBar}</View>
      {body}
    </View>
  );

  const invalidateLists = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ADMINS_QK.invites(actorId, clubId ?? ""),
    });
    void queryClient.invalidateQueries({
      queryKey: ADMINS_QK.center(actorId, clubId ?? ""),
    });
  }, [actorId, clubId, queryClient]);

  // Il ritorno dal composer riconcilia le liste: §22 vuole pending e count
  // aggiornati dopo una creazione, senza che il composer scriva nella cache.
  useFocusEffect(
    useCallback(() => {
      invalidateLists();
    }, [invalidateLists]),
  );

  if (!clubId) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: "Torna alla Dashboard",
          body: "Seleziona la società da amministrare.",
          icon: "business-outline",
          title: "Nessuna società selezionata",
        }}
        onAction={() => router.replace("/(tabs)/dashboard" as never)}
      />,
    );
  }

  /**
   * §25: «Se nessuna parte del centro è accessibile, torna al contesto
   * autorizzato con feedback.» Non una card 403 e non una pagina vuota che
   * suggerisca che la Società non abbia amministratori.
   */
  if (
    centerQuery.error instanceof AdminAccessError &&
    centerQuery.error.code === "ADMIN_CENTER_NOT_AUTHORIZED"
  ) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: "Torna alla Dashboard",
          body: "Chiedi alla società l'accesso a questa area.",
          icon: "lock-closed-outline",
          title: "Non hai più accesso a questa area della società.",
        }}
        onAction={() => router.replace("/(tabs)/dashboard" as never)}
      />,
    );
  }

  if (centerQuery.isLoading && !center) {
    return shell(<DashboardSkeleton />);
  }

  if (!center) {
    if (connection === "offline") {
      return shell(
        <DashboardGlobalOffline
          body="Riprova quando sei online."
          onRetry={() => void refresh()}
        />,
      );
    }

    return shell(
      <DashboardGlobalError
        body="Riprova."
        onRetry={() => void refresh()}
        title="Non siamo riusciti a caricare gli amministratori."
      />,
    );
  }

  const admins = adminsQuery.data;
  const invites = invitesQuery.data;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>{navBar}</View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          // §7.3: la CTA non copre l'ultima riga né la bottom navigation.
          { paddingBottom: spacing[32] + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl
            onRefresh={() => void refresh()}
            refreshing={centerQuery.isRefetching}
            tintColor={colors.textNeutralMuted}
          />
        }
        testID="admin-center-scroll"
      >
        {connection === "offline" ? <DashboardOfflineNotice /> : null}

        <SocietyIdentityHeader
          isVerified={center.clubIsVerified}
          logoUrl={center.clubLogoUrl}
          name={center.clubName}
          scopeLabel={center.scopeLabel}
          testID="admin-center-identity"
        />

        {/* §7: la riga compare soltanto quando accessibile e disponibile.
            Nessun chevron morto verso una destinazione inesistente. */}
        {center.canOpenRoles ? (
          <StructureRow
            icon="options-outline"
            onPress={() => {
              trackAdminEvent("admin_roles_opened");
              router.push(ADMIN_HREFS.roles as never);
            }}
            testID="admin-center-roles"
            title={ADMIN_COPY.rolesRow}
          />
        ) : null}

        {/* §7.3: «Non sostituire dati non leggibili con zero.» Una sezione
            che l'actor non può leggere non compare affatto. */}
        {center.canViewAdmins ? (
          <AdminSection
            accessibilityLabel={sectionAccessibilityLabel(
              ADMIN_COPY.activeSection,
              center.adminsCount,
              "amministratore",
              "amministratori",
            )}
            count={sectionCount(center.adminsCount)}
            title={ADMIN_COPY.activeSection}
          >
            {adminsQuery.isLoading && !admins ? (
              <DashboardSkeleton />
            ) : adminsQuery.error ? (
              <DashboardModuleError
                isRetrying={adminsQuery.isRefetching}
                message="Non siamo riusciti a caricare gli amministratori."
                onRetry={() => void adminsQuery.refetch()}
              />
            ) : admins && admins.rows.length === 0 ? (
              <DashboardModuleEmpty message={ADMIN_COPY.emptyAdmins} />
            ) : (
              <View>
                {(admins?.rows ?? []).map((row, index) => (
                  <AdminPersonRow
                    avatarUrl={row.avatarUrl}
                    key={row.profileId}
                    meta={row.roleLabel}
                    note={row.scopeLabel}
                    /* §7.1: le righe aprono il **dettaglio amministratore**,
                       non il profilo pubblico. Quel dettaglio è di
                       DAS-REV-14: finché non esiste, la riga non è tappabile
                       — §7 vieta «un chevron morto o un toast fittizio
                       presentato come integrazione completata». */
                    showDivider={index > 0}
                    testID={`admin-row-${row.profileId}`}
                    title={row.fullName}
                  />
                ))}

                {admins && admins.rows.length < admins.total ? (
                  <Button
                    label="Mostra altri"
                    onPress={() => setAdminsLimit((value) => value + PAGE_SIZE)}
                    size="sm"
                    testID="admin-center-more-admins"
                    variant="ghost"
                  />
                ) : null}
              </View>
            )}
          </AdminSection>
        ) : null}

        {center.canViewInvites ? (
          <AdminSection
            accessibilityLabel={sectionAccessibilityLabel(
              ADMIN_COPY.pendingSection,
              center.invitesPendingCount,
              "invito",
              "inviti",
            )}
            count={sectionCount(center.invitesPendingCount)}
            title={ADMIN_COPY.pendingSection}
          >
            {invitesQuery.isLoading && !invites ? (
              <DashboardSkeleton />
            ) : invitesQuery.error ? (
              <DashboardModuleError
                isRetrying={invitesQuery.isRefetching}
                message="Non siamo riusciti a caricare gli inviti."
                onRetry={() => void invitesQuery.refetch()}
              />
            ) : invites && invites.rows.length === 0 ? (
              <DashboardModuleEmpty message={ADMIN_COPY.emptyPending} />
            ) : (
              <View>
                {(invites?.rows ?? []).map((row, index) => (
                  <AdminPersonRow
                    avatarUrl={row.avatarUrl}
                    key={row.inviteId}
                    meta={row.roleLabel}
                    note={row.scopeLabel}
                    /* §12: «L'invito esterno pending deve poter essere
                       riaperto dal centro per ricondividere il link
                       autorizzato.» L'invito interno non ha un link: la sua
                       riga resta informativa. */
                    onPress={
                      row.recipientKind === "email" && center.canInvite
                        ? () =>
                            router.push(
                              ADMIN_HREFS.external({
                                inviteId: row.inviteId,
                              }) as never,
                            )
                        : undefined
                    }
                    showDivider={index > 0}
                    status={inviteChannelLabel(row)}
                    testID={`admin-invite-row-${row.inviteId}`}
                    title={inviteRecipientName(row)}
                  />
                ))}

                {invites && invites.rows.length < invites.total ? (
                  <Button
                    label="Mostra altri"
                    onPress={() =>
                      setInvitesLimit((value) => value + PAGE_SIZE)
                    }
                    size="sm"
                    testID="admin-center-more-invites"
                    variant="ghost"
                  />
                ) : null}
              </View>
            )}
          </AdminSection>
        ) : null}

        {/* §7.3: «Chi può leggere ma non invitare vede la lista senza Invita
            amministratore. Nessun lucchetto o pulsante disabilitato per
            pubblicizzare un permesso mancante.» */}
        {center.canInvite ? (
          <Button
            fullWidth
            label={ADMIN_COPY.inviteCta}
            onPress={() => {
              trackAdminEvent("admin_invite_started", { path: "search" });
              router.push(ADMIN_HREFS.search as never);
            }}
            size="lg"
            testID="admin-center-invite"
            variant="primary"
          />
        ) : null}
      </ScrollView>
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
    gap: spacing[20],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
});
