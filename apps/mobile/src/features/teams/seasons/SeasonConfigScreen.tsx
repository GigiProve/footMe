/**
 * Preparazione futura e configurazione della corrente — screen 03, più il
 * caso di §13 e la modifica di una preparazione esistente.
 *
 * Una schermata sola per tre azioni: §12 e §13 descrivono lo **stesso** form
 * breve — stagione read-only, Tipo obbligatorio, Livello facoltativo — con
 * titolo e CTA diversi. Duplicarla avrebbe fatto divergere prefill,
 * validazione e gestione dei conflitti, che devono essere identici.
 *
 * Il target non viene scelto qui: `p_target` dice "corrente" o "prossima" e
 * il server risolve quale stagione sia (§6). Il `seasonId` che il form ha
 * caricato viaggia con la mutazione solo per far emergere il caso di §15 —
 * il calendario è cambiato mentre il form era aperto.
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
import { seasonErrorMessage } from "./seasons-presentation";
import {
  fetchTeamSeasonHistoryPage,
  fetchTeamSeasonsContext,
  saveTeamSeasonConfig,
  toSeasonError,
} from "./seasons-service";
import { trackSeasonsEvent } from "./seasons-analytics";
import { newOperationKey } from "./operation-key";

type Props = {
  target: "current" | "next";
  teamId: string;
};

const EMPTY: ClassificationValue = {
  levelId: null,
  levelLabel: null,
  typeId: null,
  typeLabel: null,
};

export function SeasonConfigScreen({ target, teamId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { showToast } = useToast();

  const [draft, setDraft] = useState<ClassificationValue | null>(null);
  const [levelNotice, setLevelNotice] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const [operationKey, setOperationKey] = useState(() => newOperationKey());

  const contextQuery = useQuery({
    enabled: !!actorId,
    queryFn: () => fetchTeamSeasonsContext(teamId),
    queryKey: SEASONS_QK.teamContext(actorId, teamId),
  });

  const context = contextQuery.data ?? null;

  /**
   * Prefill (§12, §13).
   *
   * «Precompilare dai dati pertinenti più recenti dello stesso Team, senza
   * considerarli confermati.» L'ordine è quello: il record del target se
   * esiste già (è una modifica, non una proposta), poi la corrente, poi la
   * storica più vicina. Quando nulla è determinabile il campo resta vuoto —
   * §12 lo chiede espressamente invece di inventare un valore.
   */
  const historyQuery = useQuery({
    enabled: !!actorId && context?.canViewHistory === true,
    queryFn: () => fetchTeamSeasonHistoryPage(teamId, null, 1),
    queryKey: SEASONS_QK.historyPage(actorId, teamId),
  });

  const existing = target === "next" ? context?.nextConfig : context?.currentConfig;

  const initial = useMemo<ClassificationValue>(() => {
    if (existing) {
      return {
        levelId: existing.levelId,
        levelLabel: existing.levelLabel,
        typeId: existing.typeId,
        typeLabel: existing.typeLabel,
      };
    }

    const fallback =
      (target === "next" ? context?.currentConfig : null) ??
      historyQuery.data?.items[0] ??
      null;

    if (!fallback) {
      return EMPTY;
    }

    return {
      levelId: fallback.levelId,
      levelLabel: fallback.levelLabel,
      typeId: fallback.typeId,
      typeLabel: fallback.typeLabel,
    };
  }, [context?.currentConfig, existing, historyQuery.data, target]);

  /*
    Nessun effetto per il prefill: il valore mostrato è `draft ?? initial`, e
    `initial` è memoizzato sul payload. Copiarlo in stato dentro un effetto
    avrebbe aggiunto un render in più e una finestra in cui il form mostra un
    valore e il confronto "dirty" un altro.
  */

  const value = draft ?? initial;
  const isDirty =
    value.typeId !== initial.typeId || value.levelId !== initial.levelId;

  const leave = useCallback(() => router.back(), [router]);

  useUnsavedChangesGuard({ isDirty, isSaving, onLeave: leave });

  const seasonLabel =
    target === "next" ? context?.nextSeasonLabel : context?.seasonLabel;
  const seasonId = target === "next" ? context?.nextSeasonId : context?.seasonId;

  const title =
    target === "current"
      ? "Configura stagione"
      : existing
        ? "Modifica preparazione"
        : "Prepara stagione";

  const ctaLabel =
    target === "current"
      ? "Configura stagione"
      : existing
        ? "Salva modifiche"
        : "Prepara stagione";

  const save = useCallback(async () => {
    if (!context || !seasonId) {
      return;
    }

    if (!value.typeId) {
      setTypeError("Seleziona il tipo squadra.");
      return;
    }

    setTypeError(null);
    setSaving(true);
    setErrorMessage(null);

    try {
      await saveTeamSeasonConfig({
        expectedVersion: existing?.version ?? null,
        idempotencyKey: operationKey,
        levelId: value.levelId,
        seasonId,
        target,
        teamId,
        typeId: value.typeId,
      });

      trackSeasonsEvent(
        target === "current" ? "seasons_configure_started" : "seasons_prepare_result",
        { mode: existing ? "edit" : "create", outcome: "success" },
      );

      await queryClient.invalidateQueries({
        queryKey: SEASONS_QK.teamContext(actorId, teamId),
      });
      // §24: dopo la preparazione il riepilogo del Centro cambia davvero, e
      // non viene incrementato a mano dal client.
      await queryClient.invalidateQueries({ queryKey: ["seasons-center"] });
      await queryClient.invalidateQueries({ queryKey: ["seasons-center-page"] });

      if (target === "current") {
        await queryClient.invalidateQueries({ queryKey: ["teams-center"] });
        await queryClient.invalidateQueries({ queryKey: ["teams-center-page"] });
        await queryClient.invalidateQueries({ queryKey: ["team-detail"] });
      }

      setDraft(null);
      showToast({
        message:
          target === "current"
            ? "Stagione configurata"
            : existing
              ? "Preparazione aggiornata"
              : "Stagione preparata",
        tone: "success",
      });
      router.back();
    } catch (caught) {
      const seasonError = toSeasonError(caught);

      trackSeasonsEvent("seasons_prepare_result", {
        code: seasonError.code,
        outcome: "error",
      });

      if (
        seasonError.code === "SEASON_CONTEXT_CHANGED" ||
        seasonError.code === "SEASON_VERSION_CONFLICT" ||
        seasonError.code === "SEASON_ALREADY_EXISTS"
      ) {
        // §15: il draft resta, il contesto si aggiorna e serve un nuovo
        // submit. La chiave idempotente cambia perché cambia la decisione.
        trackSeasonsEvent("seasons_context_conflict", { code: seasonError.code });
        setOperationKey(newOperationKey());
        await queryClient.invalidateQueries({
          queryKey: SEASONS_QK.teamContext(actorId, teamId),
        });
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
    context,
    existing,
    operationKey,
    queryClient,
    router,
    seasonId,
    showToast,
    target,
    teamId,
    value.levelId,
    value.typeId,
  ]);

  if (contextQuery.isLoading || !context) {
    return (
      <SeasonsScaffold onBack={leave} title={title}>
        <ProfileEditFieldsSkeleton />
      </SeasonsScaffold>
    );
  }

  // §6: una prossima stagione non in catalogo non diventa una CTA che
  // promette un anno inventato.
  if (!seasonId) {
    return (
      <SeasonsScaffold onBack={leave} title={title}>
        <SeasonsIdentityHeader
          isVerified={context.clubIsVerified}
          logoUrl={context.crestUrl}
          name={context.name}
          subtitle={`Squadra di ${context.clubName}`}
        />

        <AppText color="neutralMuted" variant="bodySm">
          La prossima stagione non è ancora disponibile nel calendario.
        </AppText>
      </SeasonsScaffold>
    );
  }

  return (
    <SeasonsScaffold
      errorMessage={errorMessage}
      onBack={leave}
      onPrimary={() => void save()}
      primaryDisabled={!value.typeId || isSaving}
      primaryLabel={ctaLabel}
      primaryLoading={isSaving}
      testID="season-config-screen"
      title={title}
    >
      <SeasonsIdentityHeader
        isVerified={context.clubIsVerified}
        logoUrl={context.crestUrl}
        name={context.name}
        subtitle={`Squadra di ${context.clubName}`}
      />

      <View style={styles.form}>
        <SeasonFieldRow
          label="Stagione"
          readOnly
          testID="season-target-field"
          value={seasonLabel ?? null}
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
            setTypeError(null);
            setDraft(next);
          }}
          seasonId={seasonId}
          seasonLabel={seasonLabel ?? null}
          teamId={teamId}
          typeErrorMessage={typeError}
          value={value}
        />

        {target === "next" ? (
          <AppText color="neutralMuted" variant="caption">
            L&apos;organico non viene copiato automaticamente.
          </AppText>
        ) : null}
      </View>
    </SeasonsScaffold>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing[16],
  },
});
