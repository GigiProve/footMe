/**
 * Aggiungi storico stagioni — screen 05, in creazione e in modifica di un
 * periodo già nella bozza.
 *
 * Un unico flusso per una stagione o per molti anni (§18): Da, A, Tipo,
 * Livello. «Da = A significa una stagione, senza una modalità singola
 * separata», quindi non esistono due form.
 *
 * Il conteggio della CTA **non** è una sottrazione fatta qui: ogni modifica
 * del periodo interroga `preview_team_season_history`, che esclude le
 * stagioni già persistite e risolve le sovrapposizioni (§20, §31). Il client
 * non sa quante stagioni esistano già, e non deve indovinarlo.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
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
import { TeamSelectorModal } from "../components/TeamSelectorModal";
import { useHistoryDraft } from "./HistoryDraftProvider";
import { isRangeValid, suggestPeriodDefaults, toPeriodInputs } from "./history-draft";
import { SEASONS_QK } from "./seasons-keys";
import {
  addSeasonsCta,
  emptyPeriodReason,
  periodErrorMessage,
  seasonErrorMessage,
} from "./seasons-presentation";
import {
  fetchHistorySeasonOptions,
  fetchTeamSeasonHistoryPage,
  fetchTeamSeasonsContext,
  previewHistoryPeriods,
  toSeasonError,
  type HistoryPeriodPreview,
} from "./seasons-service";
import { trackSeasonsEvent } from "./seasons-analytics";

type Bound = "from" | "to";

export function HistoryPeriodScreen({ teamId }: { teamId: string }) {
  const router = useRouter();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const draft = useHistoryDraft();

  const editing = draft.editing;

  // Override espliciti dell'utente. Finché sono `null` vale il valore
  // proposto: niente copia dei suggerimenti in stato dentro un effetto, che
  // aggiungerebbe un render e una finestra in cui il form e il confronto
  // "modificato" guardano due valori diversi.
  const [fromOverride, setFromOverride] = useState<string | null>(null);
  const [toOverride, setToOverride] = useState<string | null>(null);
  const [classification, setClassification] = useState<ClassificationValue | null>(
    null,
  );
  const [openBound, setOpenBound] = useState<Bound | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const contextQuery = useQuery({
    enabled: !!actorId,
    queryFn: () => fetchTeamSeasonsContext(teamId),
    queryKey: SEASONS_QK.teamContext(actorId, teamId),
  });

  const seasonsQuery = useQuery({
    enabled: !!actorId,
    queryFn: () => fetchHistorySeasonOptions(teamId),
    queryKey: SEASONS_QK.historyOptions(actorId, teamId),
  });

  const historyQuery = useQuery({
    enabled: !!actorId && contextQuery.data?.canViewHistory === true,
    queryFn: () => fetchTeamSeasonHistoryPage(teamId, null, PAGE_SAMPLE),
    queryKey: SEASONS_QK.historyPage(actorId, teamId),
  });

  const context = contextQuery.data ?? null;
  const seasons = useMemo(() => seasonsQuery.data ?? [], [seasonsQuery.data]);

  useEffect(() => {
    if (!actorId || !context) {
      return;
    }

    draft.scopeTo(actorId, context.clubId, teamId);
  }, [actorId, context, draft, teamId]);

  /**
   * Valori proposti: il periodo in modifica, oppure i suggerimenti di §19.
   *
   * `toSeason` ha un suggerimento solo in modifica — §19 vieta di sceglierlo
   * da soli («Non scegliere automaticamente A»), perché la durata del periodo
   * è la decisione che l'utente sta prendendo.
   */
  const suggestion = useMemo(() => {
    if (editing) {
      return {
        fromSeason: editing.fromSeason,
        levelId: editing.levelId,
        levelLabel: editing.levelLabel,
        toSeason: editing.toSeason,
        typeId: editing.typeId,
        typeLabel: editing.typeLabel,
      };
    }

    if (!context || seasons.length === 0) {
      return {
        fromSeason: null,
        levelId: null,
        levelLabel: null,
        toSeason: null,
        typeId: null,
        typeLabel: null,
      };
    }

    return {
      ...suggestPeriodDefaults({
        currentConfig: context.currentConfig,
        history: (historyQuery.data?.items ?? []).map((row) => ({
          levelId: row.levelId,
          levelLabel: row.levelLabel,
          seasonId: row.seasonId,
          typeId: row.typeId,
          typeLabel: row.typeLabel,
        })),
        periods: draft.periods,
        seasons,
      }),
      toSeason: null,
    };
  }, [context, draft.periods, editing, historyQuery.data, seasons]);

  const fromSeason = fromOverride ?? suggestion.fromSeason;
  const toSeason = toOverride ?? suggestion.toSeason;

  const value = useMemo<ClassificationValue>(
    () =>
      classification ?? {
        levelId: suggestion.levelId,
        levelLabel: suggestion.levelLabel,
        typeId: suggestion.typeId,
        typeLabel: suggestion.typeLabel,
      },
    [classification, suggestion],
  );

  /**
   * Preview del solo periodo in composizione, sommata a quelli già in bozza.
   *
   * I periodi precedenti entrano nella richiesta perché §20 conta le stagioni
   * **nuove uniche del batch**: senza di loro un periodo che ripete gli anni
   * di un altro mostrerebbe un conteggio che la conferma finale smentirebbe.
   */
  const periodsForPreview = useMemo(() => {
    const others = draft.periods.filter((period) => period.id !== editing?.id);

    if (!fromSeason || !toSeason || !value.typeId) {
      return toPeriodInputs(others);
    }

    return [
      ...toPeriodInputs(others),
      {
        fromSeason,
        levelId: value.levelId,
        toSeason,
        typeId: value.typeId,
      },
    ];
  }, [draft.periods, editing?.id, fromSeason, toSeason, value.levelId, value.typeId]);

  const isComplete = !!fromSeason && !!toSeason && !!value.typeId;

  const previewQuery = useQuery({
    enabled: !!actorId && isComplete,
    queryFn: () => previewHistoryPeriods(teamId, periodsForPreview),
    queryKey: [
      "seasons-history-preview",
      actorId,
      teamId,
      JSON.stringify(periodsForPreview),
    ],
    // Un conteggio non è un dato da riusare: §20 vuole che derivi sempre
    // dall'ultima risoluzione del server.
    staleTime: 0,
  });

  const candidate: HistoryPeriodPreview | null = useMemo(() => {
    const periods = previewQuery.data?.periods ?? [];

    return periods.length > 0 ? periods[periods.length - 1] : null;
  }, [previewQuery.data]);

  const leave = useCallback(() => {
    draft.cancelEdit();
    router.back();
  }, [draft, router]);

  useUnsavedChangesGuard({
    isDirty: touched && !editing,
    isSaving: false,
    onLeave: leave,
  });

  const selectBound = useCallback(
    (bound: Bound, seasonId: string) => {
      setTouched(true);
      setOpenBound(null);

      if (bound === "from") {
        setFromOverride(seasonId);

        // §19: «Cambiare Da non deve lasciare un estremo A precedente
        // considerato valido: segnalare l'incompatibilità e chiedere di
        // correggerlo, preservando gli altri dati.»
        setRangeError(
          toSeason && !isRangeValid(seasonId, toSeason, seasons)
            ? "La stagione finale precede quella iniziale. Aggiorna il campo A."
            : null,
        );

        return;
      }

      setToOverride(seasonId);
      setRangeError(
        fromSeason && !isRangeValid(fromSeason, seasonId, seasons)
          ? "La stagione finale precede quella iniziale. Aggiorna il campo A."
          : null,
      );
    },
    [fromSeason, seasons, toSeason],
  );

  const submit = useCallback(() => {
    if (!fromSeason || !toSeason || !value.typeId || !candidate) {
      return;
    }

    const period = {
      fromLabel: labelOf(seasons, fromSeason) ?? fromSeason,
      fromSeason,
      levelId: value.levelId,
      levelLabel: value.levelLabel,
      toLabel: labelOf(seasons, toSeason) ?? toSeason,
      toSeason,
      typeId: value.typeId,
      typeLabel: value.typeLabel,
    };

    if (editing) {
      draft.update({ ...period, id: editing.id });
      trackSeasonsEvent("seasons_period_updated", { new_count: candidate.newCount });
    } else {
      draft.add(period);
      trackSeasonsEvent("seasons_period_added", { new_count: candidate.newCount });
    }

    router.replace(
      `/team-seasons/history-review?teamId=${encodeURIComponent(teamId)}`,
    );
  }, [candidate, draft, editing, fromSeason, router, seasons, teamId, toSeason, value]);

  const title = editing ? "Modifica periodo" : "Aggiungi storico stagioni";

  if (contextQuery.isLoading || seasonsQuery.isLoading || !context) {
    return (
      <SeasonsScaffold onBack={leave} title={title}>
        <ProfileEditFieldsSkeleton />
      </SeasonsScaffold>
    );
  }

  // §19: «Se non esistono stagioni storiche selezionabili, mostrare un
  // messaggio coerente prima di presentare un form inutilizzabile.»
  if (seasons.length === 0) {
    return (
      <SeasonsScaffold onBack={leave} title={title}>
        <SeasonsIdentityHeader
          isVerified={context.clubIsVerified}
          logoUrl={context.crestUrl}
          name={context.name}
          subtitle={`Squadra di ${context.clubName}`}
        />

        <AppText color="neutralMuted" variant="bodySm">
          {seasonsQuery.isError
            ? "Non è stato possibile caricare le stagioni. Riprova."
            : "Non ci sono stagioni precedenti disponibili nel calendario."}
        </AppText>
      </SeasonsScaffold>
    );
  }

  const previewError = previewQuery.isError
    ? seasonErrorMessage(
        toSeasonError(previewQuery.error).code,
        "Non è stato possibile verificare il periodo. Riprova.",
      )
    : null;

  const periodError = periodErrorMessage(candidate?.errorCode ?? null);
  const emptyReason = candidate ? emptyPeriodReason(candidate) : null;
  const newCount = candidate?.newCount ?? 0;

  return (
    <SeasonsScaffold
      errorMessage={rangeError ?? periodError ?? previewError ?? emptyReason}
      onBack={leave}
      onPrimary={() => submit()}
      primaryDisabled={
        !isComplete ||
        !!rangeError ||
        previewQuery.isFetching ||
        !!previewError ||
        newCount === 0
      }
      primaryLabel={
        editing ? "Aggiorna periodo" : addSeasonsCta(Math.max(newCount, 1))
      }
      primaryLoading={previewQuery.isFetching}
      testID="history-period-screen"
      title={title}
    >
      <SeasonsIdentityHeader
        isVerified={context.clubIsVerified}
        logoUrl={context.crestUrl}
        name={context.name}
        subtitle={`Squadra di ${context.clubName}`}
      />

      <AppText color="neutralMuted" variant="bodySm">
        Seleziona un periodo con la stessa classificazione.
      </AppText>

      <View style={styles.form}>
        <SeasonFieldRow
          label="Da"
          onPress={() => setOpenBound("from")}
          placeholder="Seleziona"
          testID="history-from-field"
          value={labelOf(seasons, fromSeason)}
        />

        <SeasonFieldRow
          errorMessage={rangeError}
          label="A"
          onPress={() => setOpenBound("to")}
          placeholder="Seleziona"
          testID="history-to-field"
          value={labelOf(seasons, toSeason)}
        />

        <ClassificationFields
          clubId={context.clubId}
          onChange={(next) => {
            setTouched(true);
            setClassification(next);
          }}
          seasonId={fromSeason}
          seasonLabel={labelOf(seasons, fromSeason)}
          teamId={teamId}
          value={value}
        />

        {candidate && newCount > 0 ? (
          <AppText color="neutralMuted" variant="caption">
            {newCount === 1 ? "1 stagione da aggiungere" : `${newCount} stagioni da aggiungere`}
          </AppText>
        ) : null}
      </View>

      <TeamSelectorModal
        items={seasons.map((season) => ({
          id: season.seasonId,
          // §19: una stagione già presente è **indicata**, non esclusa.
          label: season.alreadyPresent
            ? `${season.label} (già nello storico)`
            : season.label,
        }))}
        onClose={() => setOpenBound(null)}
        onSelect={(id) => openBound && selectBound(openBound, id)}
        title={openBound === "to" ? "Stagione finale" : "Stagione iniziale"}
        tone="neutral"
        value={openBound === "to" ? toSeason : fromSeason}
        visible={openBound !== null}
      />
    </SeasonsScaffold>
  );
}

const PAGE_SAMPLE = 20;

function labelOf(
  seasons: { label: string; seasonId: string }[],
  seasonId: string | null,
): string | null {
  if (!seasonId) {
    return null;
  }

  return seasons.find((season) => season.seasonId === seasonId)?.label ?? seasonId;
}

const styles = StyleSheet.create({
  form: {
    gap: spacing[16],
  },
});
