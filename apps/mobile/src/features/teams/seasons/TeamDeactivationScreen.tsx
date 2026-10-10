/**
 * Attività da gestire — screen 07.
 *
 * Si arriva qui solo quando il controllo di §25 ha trovato impedimenti. Non
 * è una pagina di avvertimento: è un elenco di cose ancora aperte, con la
 * destinazione reale di ciascuna.
 *
 * §26 vieta espressamente «un grande warning rosso, CTA Disattiva attiva o
 * pulsante che risolve automaticamente tutti gli impedimenti». L'unica CTA
 * è "Chiudi", e abbandona il tentativo senza effetti.
 *
 * Al ritorno dai centri Posizioni e Inviti il controllo viene rifatto: §26
 * lo chiede, e senza di esso la pagina mostrerebbe un blocco già risolto.
 */
import { useCallback, useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { SOCIETY_HREFS } from "../../dashboard/society/society-presentation";
import { ProfileEditFieldsSkeleton } from "../../profiles/edit/ProfileEditStates";
import { SeasonsIdentityHeader } from "./components/SeasonsIdentityHeader";
import { SeasonsScaffold } from "./components/SeasonsScaffold";
import { SEASONS_QK } from "./seasons-keys";
import {
  blockerCopy,
  hasUnreadableBlocker,
  seasonErrorMessage,
} from "./seasons-presentation";
import {
  checkTeamDeactivation,
  fetchTeamSeasonsContext,
  toSeasonError,
  type DeactivationBlocker,
} from "./seasons-service";
import { trackSeasonsEvent } from "./seasons-analytics";

const BLOCKER_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  invites: "person-add-outline",
  positions: "document-text-outline",
};

export function TeamDeactivationScreen({ teamId }: { teamId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";

  const contextQuery = useQuery({
    enabled: !!actorId,
    queryFn: () => fetchTeamSeasonsContext(teamId),
    queryKey: SEASONS_QK.teamContext(actorId, teamId),
  });

  const checkQuery = useQuery({
    enabled: !!actorId,
    queryFn: () => checkTeamDeactivation(teamId),
    queryKey: SEASONS_QK.teamDeactivation(actorId, teamId),
    staleTime: 0,
  });

  // Ritorno dai centri collegati: gli impedimenti vengono rivalutati (§26).
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({
        queryKey: SEASONS_QK.teamDeactivation(actorId, teamId),
      });
    }, [actorId, queryClient, teamId]),
  );

  const context = contextQuery.data ?? null;
  const check = checkQuery.data ?? null;

  useEffect(() => {
    if (check && !check.allowed) {
      trackSeasonsEvent("seasons_deactivate_blocked", {
        blockers: check.blockers.length,
      });
    }
  }, [check]);

  const openBlocker = useCallback(
    (blocker: DeactivationBlocker) => {
      if (!blocker.canOpen) {
        return;
      }

      // I centri esistenti, non elenchi gestionali paralleli (§26). Il
      // perimetro viene rivalidato dal dominio proprietario.
      const href =
        blocker.kind === "positions" ? SOCIETY_HREFS.positions() : SOCIETY_HREFS.invites;

      router.push(href as Parameters<typeof router.push>[0]);
    },
    [router],
  );

  if (contextQuery.isLoading || checkQuery.isLoading || !context) {
    return (
      <SeasonsScaffold onBack={() => router.back()} title="Disattiva squadra">
        <ProfileEditFieldsSkeleton />
      </SeasonsScaffold>
    );
  }

  // §26: «Se il controllo fallisce … non interpretarlo come assenza di
  // blocker: mostrare errore locale e Riprova.»
  if (checkQuery.isError || !check) {
    return (
      <SeasonsScaffold onBack={() => router.back()} title="Disattiva squadra">
        <SeasonsIdentityHeader
          isVerified={context.clubIsVerified}
          logoUrl={context.crestUrl}
          name={context.name}
          subtitle={`Squadra di ${context.clubName}`}
        />

        <AppText accessibilityRole="alert" color="neutralMuted" variant="bodySm">
          {seasonErrorMessage(
            toSeasonError(checkQuery.error).code,
            "Non è stato possibile verificare le attività della squadra. Riprova.",
          )}
        </AppText>

        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => void checkQuery.refetch()}
          style={styles.linkRow}
          testID="deactivation-retry"
        >
          <AppText color="accent" variant="actionLabel">
            Riprova
          </AppText>
        </Pressable>
      </SeasonsScaffold>
    );
  }

  return (
    <SeasonsScaffold
      onBack={() => router.back()}
      onPrimary={() => router.back()}
      primaryLabel="Chiudi"
      testID="team-deactivation-screen"
      title="Disattiva squadra"
    >
      <SeasonsIdentityHeader
        isVerified={context.clubIsVerified}
        logoUrl={context.crestUrl}
        name={context.name}
        subtitle={`Squadra di ${context.clubName}`}
      />

      <AppText color="neutral" variant="bodyLg">
        {check.allowed
          ? `Le attività di ${context.name} sono state gestite. Torna indietro e riprova a disattivare la squadra.`
          : `Prima di disattivare ${context.name}, gestisci le attività ancora aperte.`}
      </AppText>

      <View>
        {check.blockers.map((blocker, index) => {
          const copy = blockerCopy(blocker);

          return (
            <View
              key={`${blocker.kind}-${index}`}
              style={[styles.blocker, index > 0 ? styles.blockerDivided : null]}
              testID={`deactivation-blocker-${blocker.kind}`}
            >
              <Ionicons
                color={colors.textNeutral}
                name={BLOCKER_ICON[blocker.kind] ?? "alert-circle-outline"}
                size={20}
              />

              <View style={styles.blockerBody}>
                <AppText color="neutral" variant="titleSm">
                  {copy.title}
                </AppText>

                <AppText color="neutralMuted" variant="meta">
                  {copy.body}
                </AppText>

                {copy.actionLabel ? (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => openBlocker(blocker)}
                    style={styles.blockerAction}
                    testID={`deactivation-open-${blocker.kind}`}
                  >
                    {/* §4: "Vedi posizioni" e "Gestisci inviti" sono i due
                        piccoli link funzionali del master 07. */}
                    <AppText color="accent" variant="actionLabel">
                      {copy.actionLabel}
                    </AppText>
                  </Pressable>
                ) : null}
              </View>

              {copy.actionLabel ? (
                <Ionicons
                  color={colors.textNeutralMuted}
                  name="chevron-forward"
                  size={18}
                />
              ) : null}
            </View>
          );
        })}
      </View>

      {hasUnreadableBlocker(check.blockers) ? (
        <AppText color="neutralMuted" variant="caption">
          Alcune attività devono essere gestite da un amministratore autorizzato.
        </AppText>
      ) : null}

      <AppText color="neutralMuted" variant="caption">
        Lo storico della squadra sarà conservato.
      </AppText>
    </SeasonsScaffold>
  );
}

const styles = StyleSheet.create({
  blocker: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  blockerDivided: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: 1,
  },
  blockerBody: {
    flex: 1,
    gap: spacing[4],
  },
  blockerAction: {
    justifyContent: "center",
    minHeight: sizes.touchTarget - spacing[12],
  },
  linkRow: {
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
});
