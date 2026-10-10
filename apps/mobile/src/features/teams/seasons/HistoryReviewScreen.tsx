/**
 * Rivedi storico — screen 06.
 *
 * Il riepilogo **è** la conferma (§22: «Non aggiungere una seconda modal
 * generica Sei sicuro? dopo il tap finale»). Da qui si modifica un periodo,
 * lo si rimuove, se ne aggiunge un altro, oppure si conferma l'intero batch.
 *
 * Tutti i numeri vengono dal server, a ogni cambiamento della bozza (§20,
 * §31). È anche il motivo per cui il conflitto di §23 è rilevabile: la
 * `contextVersion` dell'ultima preview viaggia con il commit, e se lo
 * storico è cambiato nel frattempo il server rifiuta invece di salvare
 * cinque stagioni sotto una CTA che ne prometteva sei.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { ActionSheet, AppText, useToast } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { ProfileEditFieldsSkeleton } from "../../profiles/edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../profiles/edit/use-unsaved-changes-guard";
import { SeasonsIdentityHeader } from "./components/SeasonsIdentityHeader";
import { SeasonsListRow } from "./components/SeasonsListRow";
import { SeasonsScaffold } from "./components/SeasonsScaffold";
import { useHistoryDraft } from "./HistoryDraftProvider";
import { toPeriodInputs } from "./history-draft";
import { SEASONS_QK } from "./seasons-keys";
import {
  classificationLine,
  commitHistoryCta,
  conflictMessage,
  emptyPeriodReason,
  existingSeasonsNotice,
  historyTotalLabel,
  periodCountLine,
  periodErrorMessage,
  seasonErrorMessage,
} from "./seasons-presentation";
import {
  commitHistoryPeriods,
  fetchTeamSeasonsContext,
  previewHistoryPeriods,
  toSeasonError,
} from "./seasons-service";
import { trackSeasonsEvent } from "./seasons-analytics";
import { newOperationKey } from "./operation-key";

export function HistoryReviewScreen({ teamId }: { teamId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { showToast } = useToast();
  const draft = useHistoryDraft();

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const [operationKey, setOperationKey] = useState(() => newOperationKey());

  const contextQuery = useQuery({
    enabled: !!actorId,
    queryFn: () => fetchTeamSeasonsContext(teamId),
    queryKey: SEASONS_QK.teamContext(actorId, teamId),
  });

  const context = contextQuery.data ?? null;
  const periodInputs = useMemo(() => toPeriodInputs(draft.periods), [draft.periods]);

  const previewQuery = useQuery({
    enabled: !!actorId && draft.periods.length > 0,
    queryFn: () => previewHistoryPeriods(teamId, periodInputs),
    queryKey: [
      "seasons-history-preview",
      actorId,
      teamId,
      JSON.stringify(periodInputs),
    ],
    staleTime: 0,
  });

  const preview = previewQuery.data ?? null;

  useEffect(() => {
    if (preview) {
      trackSeasonsEvent("seasons_history_preview", {
        periods: draft.periods.length,
        total_new: preview.totalNew,
      });
    }
  }, [draft.periods.length, preview]);

  const leave = useCallback(() => {
    draft.clear();
    router.back();
  }, [draft, router]);

  // §33: il passaggio interno verso "Modifica periodo" o "Aggiungi un altro
  // periodo" conserva la bozza e non è un'uscita — l'avviso scatta solo
  // quando si abbandona davvero il flusso.
  useUnsavedChangesGuard({
    isDirty: draft.periods.length > 0,
    isSaving,
    onLeave: leave,
  });

  const commit = useCallback(async () => {
    if (!preview || preview.totalNew === 0) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const result = await commitHistoryPeriods({
        contextVersion: preview.contextVersion,
        expectedNewCount: preview.totalNew,
        idempotencyKey: operationKey,
        periods: periodInputs,
        teamId,
      });

      trackSeasonsEvent("seasons_history_commit_result", {
        created: result.createdCount,
        outcome: "success",
      });

      draft.clear();

      await queryClient.invalidateQueries({
        queryKey: SEASONS_QK.teamContext(actorId, teamId),
      });
      await queryClient.invalidateQueries({ queryKey: ["seasons-history-page"] });
      await queryClient.invalidateQueries({ queryKey: ["seasons-history-options"] });

      showToast({
        message:
          result.createdCount === 1
            ? "1 stagione aggiunta allo storico"
            : `${result.createdCount} stagioni aggiunte allo storico`,
        tone: "success",
      });

      router.replace(`/(tabs)/dashboard/seasons/${encodeURIComponent(teamId)}`);
    } catch (caught) {
      const seasonError = toSeasonError(caught);

      trackSeasonsEvent("seasons_history_commit_result", {
        code: seasonError.code,
        outcome: "error",
      });

      if (seasonError.code === "HISTORY_CONTEXT_CHANGED") {
        // §23: riepilogo aggiornato e **nuova conferma**. La bozza resta, la
        // chiave idempotente cambia perché cambia il contenuto confermato.
        trackSeasonsEvent("seasons_context_conflict", { code: seasonError.code });
        setOperationKey(newOperationKey());
        await previewQuery.refetch();
      }

      setErrorMessage(
        seasonErrorMessage(
          seasonError.code,
          "Non è stato possibile salvare le modifiche. Riprova.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }, [
    actorId,
    draft,
    operationKey,
    periodInputs,
    preview,
    previewQuery,
    queryClient,
    router,
    showToast,
    teamId,
  ]);

  if (contextQuery.isLoading || !context) {
    return (
      <SeasonsScaffold onBack={leave} title="Rivedi storico">
        <ProfileEditFieldsSkeleton />
      </SeasonsScaffold>
    );
  }

  const conflictSeasons = (preview?.conflicts ?? []).map((item) => item.seasonId);
  const conflictText = conflictMessage(conflictSeasons);
  const hasPeriodError = (preview?.periods ?? []).some(
    (period) => period.errorCode !== null,
  );

  const previewError = previewQuery.isError
    ? seasonErrorMessage(
        toSeasonError(previewQuery.error).code,
        "Non è stato possibile verificare il periodo. Riprova.",
      )
    : null;

  const totalNew = preview?.totalNew ?? 0;
  const existingNotice = existingSeasonsNotice(preview?.totalExisting ?? 0);

  return (
    <SeasonsScaffold
      errorMessage={errorMessage ?? conflictText ?? previewError}
      onBack={leave}
      // §21: «Se il draft torna vuoto, permettere di aggiungere un periodo;
      // non mostrare un submit finale con zero stagioni.»
      onPrimary={totalNew > 0 ? () => void commit() : undefined}
      primaryDisabled={
        isSaving || previewQuery.isFetching || !!conflictText || hasPeriodError
      }
      primaryLabel={commitHistoryCta(totalNew)}
      primaryLoading={isSaving}
      testID="history-review-screen"
      title="Rivedi storico"
    >
      <SeasonsIdentityHeader
        isVerified={context.clubIsVerified}
        logoUrl={context.crestUrl}
        name={context.name}
        subtitle={`Squadra di ${context.clubName}`}
      />

      <AppText color="neutral" variant="titleSm">
        {historyTotalLabel(totalNew)}
      </AppText>

      <View>
        {draft.periods.map((period, index) => {
          const summary = preview?.periods.find((item) => item.index === index) ?? null;
          const periodError = periodErrorMessage(summary?.errorCode ?? null);
          const emptyReason = summary ? emptyPeriodReason(summary) : null;

          return (
            <SeasonsListRow
              action={
                <View style={styles.actions}>
                  <Pressable
                    accessibilityLabel={`Modifica il periodo ${period.fromLabel}–${period.toLabel}`}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => {
                      draft.beginEdit(period.id);
                      router.push(
                        `/team-seasons/history-period?teamId=${encodeURIComponent(teamId)}`,
                      );
                    }}
                    style={styles.actionButton}
                    testID={`history-period-edit-${period.id}`}
                  >
                    <AppText color="accent" variant="actionLabel">
                      Modifica
                    </AppText>
                  </Pressable>

                  <Pressable
                    accessibilityLabel={`Altre azioni sul periodo ${period.fromLabel}–${period.toLabel}`}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => setMenuFor(period.id)}
                    style={styles.iconButton}
                    testID={`history-period-menu-${period.id}`}
                  >
                    <Ionicons
                      color={colors.textNeutralMuted}
                      name="ellipsis-horizontal"
                      size={18}
                    />
                  </Pressable>
                </View>
              }
              key={period.id}
              meta={classificationLine(period.typeLabel, period.levelLabel)}
              showChevron={false}
              showDivider={index > 0}
              testID={`history-period-${period.id}`}
              title={`${period.fromLabel} – ${period.toLabel}`}
              trailingLine={
                periodError ??
                emptyReason ??
                (summary ? periodCountLine(summary) : null)
              }
            />
          );
        })}
      </View>

      {existingNotice ? (
        <AppText color="neutralMuted" variant="caption">
          {existingNotice}
        </AppText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={() =>
          router.push(
            `/team-seasons/history-period?teamId=${encodeURIComponent(teamId)}`,
          )
        }
        style={styles.addRow}
        testID="history-add-period"
      >
        <AppText color="accent" variant="actionLabel">
          Aggiungi un altro periodo
        </AppText>
      </Pressable>

      <ActionSheet
        actions={[
          {
            destructive: true,
            label: "Rimuovi periodo",
            onPress: () => {
              if (menuFor) {
                draft.remove(menuFor);
                trackSeasonsEvent("seasons_period_removed", {});
              }

              setMenuFor(null);
            },
          },
        ]}
        onClose={() => setMenuFor(null)}
        visible={menuFor !== null}
      />
    </SeasonsScaffold>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  actionButton: {
    justifyContent: "center",
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[4],
  },
  iconButton: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget - spacing[8],
  },
  addRow: {
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
});
