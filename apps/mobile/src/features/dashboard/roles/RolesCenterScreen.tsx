/**
 * Centro Ruoli e permessi (DAS-REV-14, screen 01).
 *
 * «Mostra lista verticale dei ruoli configurabili e, per ciascuno, nome,
 * numero di aree abilitate, amministratori attivi che lo utilizzano e
 * apertura» (§8).
 *
 * I conteggi arrivano dal server su ogni riga: §8 vieta di calcolarli «dalla
 * pagina parziale scaricata», e contare le righe visibili darebbe un numero
 * diverso da quello dell'hub.
 *
 * La bottom navigation resta visibile con Dashboard selezionata: la route
 * vive nello Stack annidato della tab (§4). Solo questo screen la mantiene.
 */
import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { NetworkNavBar } from "../../network/components/NetworkNavBar";
import { STALE_MS } from "../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardOfflineNotice,
  DashboardSkeleton,
} from "../components/DashboardStates";
import { SocietyIdentityHeader } from "../components/SocietyIdentityHeader";
import { useDashboardIdentity } from "../identity/use-dashboard-identity";
import { useAccessWindow } from "../state/use-access-window";
import { useDashboardConnection } from "../state/use-dashboard-connection";
import { RoleListRow } from "./components/RoleListRow";
import { ROLES_QK } from "./roles-keys";
import { ROLES_HREFS } from "./roles-routes";
import { trackRolesEvent } from "./roles-analytics";
import { ROLES_COPY, ROLES_LOAD_ERROR } from "./roles-presentation";
import { RolesAccessError, fetchRoles, fetchRolesCenter } from "./roles-service";

const PAGE_SIZE = 20;

export function RolesCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const { connection, reportFailure, reportSuccess } = useDashboardConnection();
  const params = useLocalSearchParams<{ from?: string }>();

  const [limit, setLimit] = useState(PAGE_SIZE);

  const centerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchRolesCenter(clubId as string),
    queryKey: ROLES_QK.center(actorId, clubId ?? ""),
    // Un rifiuto autorizzativo non è un errore di rete da ritentare (§29).
    retry: (failureCount, error) =>
      !(error instanceof RolesAccessError) && failureCount < 1,
    staleTime: STALE_MS.management,
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

  const rolesQuery = useQuery({
    enabled: !!clubId && !!actorId && !!center,
    queryFn: () => fetchRoles({ clubId: clubId as string, limit }),
    queryKey: [...ROLES_QK.list(actorId, clubId ?? ""), limit],
    retry: (failureCount, error) =>
      !(error instanceof RolesAccessError) && failureCount < 1,
    staleTime: STALE_MS.management,
  });

  useEffect(() => {
    if (centerQuery.error) {
      reportFailure(centerQuery.error);

      return;
    }

    if (centerQuery.data) {
      reportSuccess();
    }
  }, [centerQuery.data, centerQuery.error, reportFailure, reportSuccess]);

  useEffect(() => {
    trackRolesEvent("roles_center_opened", {
      origin: typeof params.from === "string" ? params.from : "direct",
    });
    // Un solo evento per apertura: le dipendenze cambierebbero a ogni render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roles = rolesQuery.data ?? null;

  if (!clubId) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <DashboardGlobalEmpty
          copy={{
            actionLabel: "Apri la Dashboard",
            body: "Scegli la società da amministrare dalla Dashboard.",
            icon: "shield-outline",
            title: "Nessuna società selezionata",
          }}
          onAction={null}
        />
      </View>
    );
  }

  if (centerQuery.isLoading && !loaded) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <NetworkNavBar onBack={() => router.back()} title={ROLES_COPY.centerTitle} />
        <View style={styles.content}>
          <DashboardSkeleton />
        </View>
      </View>
    );
  }

  if (!center) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <NetworkNavBar onBack={() => router.back()} title={ROLES_COPY.centerTitle} />
        <DashboardGlobalError
          body={ROLES_LOAD_ERROR.list}
          onRetry={() => void centerQuery.refetch()}
          title={ROLES_COPY.centerTitle}
        />
      </View>
    );
  }

  const isEmpty = !!roles && roles.rows.length === 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NetworkNavBar onBack={() => router.back()} title={ROLES_COPY.centerTitle} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing[24] },
        ]}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void centerQuery.refetch();
              void rolesQuery.refetch();
            }}
            refreshing={centerQuery.isRefetching || rolesQuery.isRefetching}
          />
        }
      >
        <SocietyIdentityHeader
          isVerified={center.clubIsVerified}
          logoUrl={center.clubLogoUrl}
          name={center.clubName}
        />

        {connection === "offline" ? <DashboardOfflineNotice /> : null}

        {rolesQuery.isLoading && !roles ? (
          <DashboardSkeleton />
        ) : rolesQuery.error ? (
          <DashboardGlobalError
            body={ROLES_LOAD_ERROR.list}
            onRetry={() => void rolesQuery.refetch()}
            title={ROLES_COPY.centerTitle}
          />
        ) : isEmpty ? (
          /* §8: empty con helper e CTA **solo se consentita**. Un pulsante
             disabilitato pubblicizzerebbe un permesso mancante. */
          <DashboardGlobalEmpty
            copy={{
              actionLabel: ROLES_COPY.createCta,
              body: ROLES_COPY.emptyHelper,
              icon: "shield-outline",
              title: ROLES_COPY.emptyTitle,
            }}
            /* §8: «CTA se consentita.» `null` è ciò che la fa sparire —
               un pulsante disabilitato pubblicizzerebbe un permesso che
               l'actor non ha. */
            onAction={
              center.canCreateRole
                ? () => router.push(ROLES_HREFS.editor() as never)
                : null
            }
          />
        ) : (
          <View>
            {(roles?.rows ?? []).map((row, index) => (
              <RoleListRow
                adminsCount={row.adminsCount}
                areasEnabled={row.areasEnabled}
                key={row.roleId}
                name={row.name}
                onPress={() =>
                  router.push(
                    ROLES_HREFS.editor({ roleId: row.roleId }) as never,
                  )
                }
                showDivider={index > 0}
                testID={`role-row-${row.roleId}`}
              />
            ))}

            {roles && roles.rows.length < roles.total ? (
              <Button
                label="Mostra altri"
                onPress={() => setLimit((value) => value + PAGE_SIZE)}
                size="sm"
                testID="roles-center-more"
                variant="ghost"
              />
            ) : null}
          </View>
        )}

        {!isEmpty ? (
          <AppText color="neutralMuted" variant="meta">
            {ROLES_COPY.centerHelper}
          </AppText>
        ) : null}

        {center.canCreateRole && !isEmpty ? (
          <Button
            fullWidth
            label={ROLES_COPY.createCta}
            onPress={() => router.push(ROLES_HREFS.editor() as never)}
            size="lg"
            testID="roles-center-create"
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
  content: {
    gap: spacing[16],
    padding: spacing[16],
  },
});
