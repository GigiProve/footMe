/**
 * Riattiva squadra — screen 10, e il caso A di §29.
 *
 * Due rami, una schermata:
 *
 *   Caso A — la configurazione corrente esiste ed è valida: la si mostra in
 *            riepilogo e la conferma la riusa. §29 vieta di «richiedere di
 *            reinserire Tipo/Livello o creare una nuova Team Season».
 *   Caso B — manca: il form breve di classificazione con stagione corrente
 *            read-only, e la CTA "Configura e riattiva".
 *
 * «Creazione/completamento della corrente e transizione Team devono riuscire
 * insieme»: sono una sola chiamata, quindi una sola transazione nel server.
 * Il client non fa due mutazioni in sequenza.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { spacing } from "../../../theme/tokens";
import { AppText, useToast } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { ProfileEditFieldsSkeleton } from "../../profiles/edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../profiles/edit/use-unsaved-changes-guard";
import {
  ClassificationFields,
  type ClassificationValue,
} from "./components/ClassificationFields";
import { SeasonFieldRow } from "./components/SeasonFieldRow";
import { SeasonsIdentityHeader } from "./components/SeasonsIdentityHeader";
import { SeasonsScaffold } from "./components/SeasonsScaffold";
import { SEASONS_QK } from "./seasons-keys";
import {
  SEASON_LIFECYCLE_LABEL,
  classificationLine,
  seasonErrorMessage,
} from "./seasons-presentation";
import {
  fetchTeamSeasonHistoryPage,
  fetchTeamSeasonsContext,
  reactivateClubTeam,
  toSeasonError,
} from "./seasons-service";
import { trackSeasonsEvent } from "./seasons-analytics";
import { newOperationKey } from "./operation-key";

const EMPTY: ClassificationValue = {
  levelId: null,
  levelLabel: null,
  typeId: null,
  typeLabel: null,
};

export function TeamReactivateScreen({ teamId }: { teamId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { showToast } = useToast();

  const [draft, setDraft] = useState<ClassificationValue | null>(null);
  const [levelNotice, setLevelNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const [operationKey, setOperationKey] = useState(() => newOperationKey());

  const contextQuery = useQuery({
    enabled: !!actorId,
    queryFn: () => fetchTeamSeasonsContext(teamId),
    queryKey: SEASONS_QK.teamContext(actorId, teamId),
  });

  const context = contextQuery.data ?? null;

  const historyQuery = useQuery({
    enabled: !!actorId && context?.canViewHistory === true,
    queryFn: () => fetchTeamSeasonHistoryPage(teamId, null, 1),
    queryKey: SEASONS_QK.historyPage(actorId, teamId),
  });

  // Caso A: configurazione corrente esistente **e completa**.
  const reuseConfig = !!context?.currentConfig?.typeId;

  const initial = useMemo<ClassificationValue>(() => {
    const fallback = context?.currentConfig ?? historyQuery.data?.items[0] ?? null;

    if (!fallback) {
      return EMPTY;
    }

    return {
      levelId: fallback.levelId,
      levelLabel: fallback.levelLabel,
      typeId: fallback.typeId,
      typeLabel: fallback.typeLabel,
    };
  }, [context?.currentConfig, historyQuery.data]);

  /* Vedi SeasonConfigScreen: il prefill è `draft ?? initial`, senza effetto. */
  const value = draft ?? initial;

  const leave = useCallback(() => router.back(), [router]);

  useUnsavedChangesGuard({
    isDirty: !reuseConfig && value.typeId !== initial.typeId,
    isSaving,
    onLeave: leave,
  });

  const submit = useCallback(async () => {
    if (!context) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      await reactivateClubTeam({
        expectedVersion: context.teamVersion,
        idempotencyKey: operationKey,
        levelId: reuseConfig ? null : value.levelId,
        seasonId: context.seasonId,
        teamId,
        typeId: reuseConfig ? null : value.typeId,
      });

      trackSeasonsEvent("seasons_reactivate_result", {
        branch: reuseConfig ? "reuse" : "configure",
        outcome: "success",
      });

      await queryClient.invalidateQueries({
        queryKey: SEASONS_QK.teamContext(actorId, teamId),
      });
      await queryClient.invalidateQueries({ queryKey: ["seasons-center"] });
      await queryClient.invalidateQueries({ queryKey: ["seasons-center-page"] });
      await queryClient.invalidateQueries({ queryKey: ["seasons-inactive"] });
      await queryClient.invalidateQueries({ queryKey: ["teams-center"] });
      await queryClient.invalidateQueries({ queryKey: ["teams-center-page"] });
      await queryClient.invalidateQueries({ queryKey: ["team-detail"] });

      setDraft(null);
      showToast({ message: "Squadra riattivata", tone: "success" });
      router.replace(`/(tabs)/dashboard/seasons/${encodeURIComponent(teamId)}`);
    } catch (caught) {
      const seasonError = toSeasonError(caught);

      trackSeasonsEvent("seasons_reactivate_result", {
        code: seasonError.code,
        outcome: "error",
      });

      if (
        seasonError.code === "SEASON_CONTEXT_CHANGED" ||
        seasonError.code === "TEAM_VERSION_CONFLICT" ||
        seasonError.code === "SEASON_ALREADY_EXISTS"
      ) {
        // §29: ricaricare e chiedere revisione, mai sovrascrivere con il
        // prefill obsoleto.
        trackSeasonsEvent("seasons_context_conflict", { code: seasonError.code });
        setOperationKey(newOperationKey());
        setDraft(null);
        await queryClient.invalidateQueries({
          queryKey: SEASONS_QK.teamContext(actorId, teamId),
        });
      }

      setErrorMessage(
        seasonErrorMessage(
          seasonError.code,
          "Non è stato possibile riattivare la squadra. Riprova.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }, [
    actorId,
    context,
    operationKey,
    queryClient,
    reuseConfig,
    router,
    showToast,
    teamId,
    value.levelId,
    value.typeId,
  ]);

  if (contextQuery.isLoading || !context) {
    return (
      <SeasonsScaffold onBack={leave} title="Riattiva squadra">
        <ProfileEditFieldsSkeleton />
      </SeasonsScaffold>
    );
  }

  // §29: «Se manca questa autorizzazione, spiegare il prerequisito senza
  // mostrare una CTA Configura e riattiva non eseguibile.»
  const missingConfigCapability = !reuseConfig && !context.canPrepare;

  return (
    <SeasonsScaffold
      errorMessage={errorMessage}
      onBack={leave}
      onPrimary={missingConfigCapability ? undefined : () => void submit()}
      primaryDisabled={isSaving || (!reuseConfig && !value.typeId)}
      primaryLabel={reuseConfig ? "Riattiva squadra" : "Configura e riattiva"}
      primaryLoading={isSaving}
      testID="team-reactivate-screen"
      title="Riattiva squadra"
    >
      <SeasonsIdentityHeader
        isVerified={context.clubIsVerified}
        logoUrl={context.crestUrl}
        name={context.name}
        statusLabel={SEASON_LIFECYCLE_LABEL.teamInactive}
        subtitle={`Squadra di ${context.clubName}`}
      />

      {missingConfigCapability ? (
        <AppText color="neutralMuted" variant="bodySm">
          Per riattivare la squadra serve anche il permesso di configurare la
          stagione corrente. Chiedi a un amministratore autorizzato.
        </AppText>
      ) : reuseConfig ? (
        <View style={styles.form}>
          <AppText color="neutral" variant="bodyLg">
            {`Riattivare ${context.name}?`}
          </AppText>

          <SeasonFieldRow
            label="Stagione corrente"
            readOnly
            testID="reactivate-season-field"
            value={context.seasonLabel}
          />

          <SeasonFieldRow
            label="Classificazione"
            readOnly
            value={classificationLine(
              context.currentConfig?.typeLabel ?? null,
              context.currentConfig?.levelLabel ?? null,
            )}
          />

          <AppText color="neutralMuted" variant="caption">
            La squadra e lo storico rimangono gli stessi.
          </AppText>
        </View>
      ) : (
        <View style={styles.form}>
          <AppText color="neutral" variant="bodyLg">
            Configura la stagione corrente per riattivare la squadra.
          </AppText>

          <SeasonFieldRow
            label="Stagione corrente"
            readOnly
            testID="reactivate-season-field"
            value={context.seasonLabel}
          />

          <ClassificationFields
            clubId={context.clubId}
            levelNotice={levelNotice}
            onChange={(next) => {
              setLevelNotice(
                next.typeId !== value.typeId && value.levelId && !next.levelId
                  ? "Il livello precedente non è compatibile con il nuovo tipo ed è stato rimosso."
                  : null,
              );
              setDraft(next);
            }}
            seasonId={context.seasonId}
            seasonLabel={context.seasonLabel}
            teamId={teamId}
            value={value}
          />

          <AppText color="neutralMuted" variant="caption">
            La squadra e lo storico rimangono gli stessi.
          </AppText>
        </View>
      )}
    </SeasonsScaffold>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing[16],
  },
});
